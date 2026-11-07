## Chương 5. Dữ liệu, định danh, realtime và AI

Chương này đi qua bốn dòng CV nằm ở bốn mảng khác nhau: pipeline báo cáo (CDC → Kafka → ClickHouse), đăng nhập một lần (OAuth 2.0 / OpenID Connect với BFF), bảng xếp hạng realtime (Kafka → Redis sorted set) và luồng AI có người duyệt. Đây là các chủ đề interviewer senior thích hỏi vì mỗi chủ đề có sẵn một chuỗi câu hỏi đào sâu: ngữ nghĩa giao nhận (at-least-once, idempotency), mô hình bảo mật trình duyệt (cookie, CSRF, XSS), cấu trúc dữ liệu (skiplist, độ chính xác số thực), và cách đo chất lượng một hệ thống có AI.

Bốn bài có trạng thái khác nhau: một bài Minh họa hoàn toàn, ba bài Một phần. Học xong chương, bạn tách được rõ phần mình đã làm với phần chỉ nói ở mức thiết kế, và trả lời được tầng thứ ba của mọi câu hỏi: "sao biết là đúng".

### Bài 5.1. Design doc pipeline CDC → Kafka → ClickHouse
**Dòng CV:** "Authored the design for a CDC pipeline (SQL Server CDC, Debezium, Kafka, ClickHouse), approved by the architecture group; the PoC served provincial dashboards at p95 180 ms versus 4.2 s."
**Trạng thái:** Minh họa. Chưa có design doc, chưa có PoC, chưa có ai duyệt; 180 ms và 4,2 s là số minh họa. Thật: warehouse báo cáo B2B chạy bằng SQL Server Agent job mỗi giờ (mục 7). Lộ trình biến dòng này thành thật: roadmap mục 3.3 (viết design doc được duyệt) và 4A (PoC có số đo).

#### Mục tiêu
- Sau bài này, bạn mô tả đúng warehouse đang chạy thật và giới hạn của nó.
- Giải thích được cơ chế từng khâu: SQL Server CDC, Debezium, Kafka, ClickHouse `ReplacingMergeTree`.
- Viết được phần rủi ro và phương án thay thế của một design doc, kể cả phương án "không cần ClickHouse".
- Biết cách đo để có số thật thay cho "p95 180 ms versus 4.2 s".

#### Bối cảnh và việc thật đã làm
Warehouse báo cáo B2B (nguồn: mục 7):

- Một schema báo cáo riêng gồm 7 bảng tổng hợp; bảng nguồn được truy cập qua **synonym** (tên thay thế trỏ sang bảng ở database khác, đổi đích không phải sửa procedure).
- 9 procedure tổng hợp (rollup) và 13 procedure đọc.
- **SQL Server Agent job** chạy mỗi 60 phút: lặp qua từng Sở đang hoạt động, mỗi Sở dùng `MERGE` hoặc xóa rồi nạp lại. Mỗi bước có `TRY/CATCH` riêng và ghi trạng thái job, nên một bước lỗi không làm hỏng cả job.
- Dữ liệu năng lực nạp **incremental theo high-water mark** (nhớ giá trị lớn nhất đã nạp, lần sau chỉ lấy phần mới hơn): mỗi lô 50 nghìn dòng, tối đa 40 lô, tức tối đa 2 triệu dòng mỗi lần chạy. Đây là trần mỗi lần chạy, không phải tổng dữ liệu.
- API: 24 action; phạm vi dữ liệu (Sở, Xã, Trường) suy ra từ token; cache Redis 10 phút cộng memory 60 giây; mục tiêu NFR 2 giây (mục tiêu thiết kế, chưa phải số đo); xuất `.xlsx` tối đa 100 nghìn dòng.
- Độ trễ dữ liệu tối đa khoảng 1 giờ, nghiệp vụ chấp nhận cho dashboard quản lý.
- Quy mô production: mới có một Sở đối tác với vài khóa học.

> **Cảnh báo:** Thư mục SQL bị gitignore nên git không chứng minh được bạn viết phần SQL. Phần C# (scope theo token, proxy cho manager) là của bạn. Không nói "hàng triệu học sinh".

Vì sao chọn SQL Agent thay cho background job C#: xử lý set-based ngay cạnh dữ liệu, không thêm hạ tầng. Trade-off: logic nằm trong SQL nên khó test, khó version; độ tươi dữ liệu bị chặn bởi chu kỳ job.

#### Kiến thức nền: từng khâu của pipeline
**Vấn đề design doc phải giải quyết.** Warehouse trễ tới khoảng 1 giờ; logic trong SQL khó test; truy vấn tổng hợp trên SQL Server (lưu theo dòng, rowstore) chậm dần khi dữ liệu lớn vì phải đọc cả dòng dù chỉ cần vài cột.

**1. SQL Server CDC (Change Data Capture).** Bật ở mức database rồi từng bảng. Capture job của SQL Server Agent đọc transaction log (cùng cơ chế log reader của replication) và ghi mỗi thay đổi vào bảng change riêng của bảng nguồn, kèm `__$start_lsn` (LSN: Log Sequence Number, vị trí trong log), `__$operation` (1 = delete, 2 = insert, 3 = giá trị trước update, 4 = giá trị sau update). Cleanup job xóa bảng change sau thời gian giữ, mặc định 3 ngày. CDC có ở Standard Edition từ SQL Server 2016 SP1.

```sql
EXEC sys.sp_cdc_enable_db;

EXEC sys.sp_cdc_enable_table
     @source_schema        = N'dbo',
     @source_name          = N'Result',   -- tên minh họa
     @role_name            = NULL,
     @supports_net_changes = 0;

-- Theo dõi: log có bị giữ lại vì CDC không?
SELECT name, log_reuse_wait_desc FROM sys.databases WHERE name = DB_NAME();
```

**2. Debezium SQL Server connector** chạy trên Kafka Connect. Nó không đọc log trực tiếp mà poll các bảng change của CDC. Lần đầu chụp snapshot toàn bảng, sau đó stream thay đổi; vị trí đã đọc (LSN) lưu trong offset topic của Kafka Connect, nên restart thì đọc tiếp đúng chỗ. Mỗi bảng một topic dạng `<topic.prefix>.<database>.<schema>.<table>`; message key là khóa chính của dòng, nên mọi thay đổi của một dòng vào cùng partition và giữ thứ tự. Mỗi sự kiện có `before`, `after`, `source` (gồm LSN, thời điểm ở nguồn `ts_ms`), `op` (`c` tạo, `u` sửa, `d` xóa, `r` đọc từ snapshot).

```json
{
  "name": "report-sqlserver-cdc",
  "config": {
    "connector.class": "io.debezium.connector.sqlserver.SqlServerConnector",
    "database.hostname": "sql-source",
    "database.port": "1433",
    "database.user": "cdc_reader",
    "database.password": "${file:/secrets/sql.properties:password}",
    "database.names": "ReportSource",
    "topic.prefix": "lms",
    "table.include.list": "dbo.Result",
    "snapshot.mode": "initial",
    "schema.history.internal.kafka.bootstrap.servers": "kafka:9092",
    "schema.history.internal.kafka.topic": "schema-history.lms",
    "transforms": "unwrap",
    "transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
    "transforms.unwrap.delete.handling.mode": "rewrite"
  }
}
```

SMT (Single Message Transform) `ExtractNewRecordState` làm phẳng sự kiện thành dòng `after`; chế độ `rewrite` thêm trường `__deleted` cho sự kiện xóa. Tên tùy chọn thay đổi giữa các phiên bản Debezium, phải tra tài liệu đúng phiên bản đang dùng.

**3. ClickHouse.** Cơ sở dữ liệu cột (columnar): mỗi cột lưu riêng và nén, truy vấn tổng hợp chỉ đọc các cột cần. Họ engine `MergeTree` ghi dữ liệu thành các part bất biến rồi merge nền. Đường nạp phổ biến: bảng `Kafka` engine (consumer) → materialized view → bảng đích.

```sql
CREATE TABLE result_queue
(
    result_id UInt64, province_id UInt32, score Float32,
    row_ver UInt64, __deleted String
)
ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka:9092',
         kafka_topic_list  = 'lms.ReportSource.dbo.Result',
         kafka_group_name  = 'ch_result',
         kafka_format      = 'JSONEachRow';

CREATE TABLE result
(
    result_id UInt64, province_id UInt32, score Float32,
    row_ver UInt64, is_deleted UInt8,
    ingested_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = ReplacingMergeTree(row_ver, is_deleted)
ORDER BY (province_id, result_id);

CREATE MATERIALIZED VIEW result_mv TO result AS
SELECT result_id, province_id, score, row_ver, __deleted = 'true' AS is_deleted
FROM result_queue;
```

`ReplacingMergeTree(ver)` giữ lại dòng có `ver` lớn nhất trong các dòng trùng **khóa sắp xếp** (`ORDER BY`), nhưng chỉ khi merge, và chỉ trong cùng partition. `row_ver` phải tăng đơn điệu theo từng dòng: ví dụ LSN hoặc `rowversion` của bảng nguồn đã đổi sang số. Tham số `is_deleted` có từ ClickHouse 23.2. Cho tới khi merge xong, truy vấn vẫn thấy bản trùng, nên truy vấn cần chính xác phải khử trùng lúc đọc:

```sql
-- Cách 1: FINAL (khử trùng lúc đọc, tốn CPU hơn)
SELECT province_id, count() AS results, avg(score) AS avg_score
FROM result FINAL
WHERE is_deleted = 0
GROUP BY province_id;

-- Cách 2: argMax theo version
SELECT province_id, count() AS results
FROM
(
    SELECT result_id,
           argMax(province_id, row_ver) AS province_id,
           argMax(is_deleted,  row_ver) AS is_deleted
    FROM result
    GROUP BY result_id
)
WHERE is_deleted = 0
GROUP BY province_id;
```

**Đặc tính end-to-end.** Ngữ nghĩa at-least-once: Kafka Connect hoặc bảng `Kafka` engine có thể gửi lại message sau sự cố; tính đúng đến từ ghi idempotent (cùng dòng, cùng version thì kết quả như nhau). Độ tươi dữ liệu (freshness) = `ingested_at` ở ClickHouse − thời điểm commit ở nguồn.

**Rủi ro phải ghi trong design doc:**

- CDC tăng tải transaction log. Nếu capture job dừng, log không truncate được (`log_reuse_wait_desc = REPLICATION`) và ổ đĩa đầy.
- Đổi schema bảng nguồn cần quy trình riêng: CDC phải tạo capture instance mới cho schema mới.
- Thêm hạ tầng phải vận hành: Kafka Connect, ClickHouse, giám sát lag.
- `ORDER BY` của bảng ClickHouse chỉ được chứa cột không đổi; nếu `province_id` của một dòng đổi, bản cũ và bản mới có khóa khác nhau và không bao giờ bị thay thế.

**Phương án thay thế phải so sánh:**

| Phương án | Ưu | Nhược |
|---|---|---|
| Tăng tần suất job hiện có | Không thêm gì | Tải lên nguồn tăng; vẫn trễ theo chu kỳ |
| Columnstore index trên SQL Server | Nén cột, batch mode, không thêm hạ tầng | Standard Edition có từ 2016 SP1 nhưng bị giới hạn bộ nhớ columnstore và độ song song |
| Đọc từ replica | Tách tải đọc khỏi primary | Không giải quyết bản chất rowstore |
| CDC → Kafka → ClickHouse | Tươi tính bằng giây, tổng hợp nhanh trên dữ liệu lớn | Nhiều thành phần vận hành nhất |

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Phần đang chạy thật là warehouse báo cáo B2B: Agent job mỗi giờ tổng hợp theo từng Sở, nạp incremental theo high-water mark, API có scope theo token. Giới hạn của nó là trễ tới một giờ và logic nằm trong SQL. Tôi đã nghiên cứu hướng CDC qua Debezium vào ClickHouse, nhưng chưa triển khai. Nếu làm, tôi sẽ thử columnstore trên SQL Server trước, vì quy mô hiện tại mới một Sở; ClickHouse chỉ đáng khi dữ liệu và số dashboard vượt khả năng của SQL Server."

> **Cảnh báo:** Nếu giữ dòng CV nguyên văn, câu tiếp theo sẽ là "nhóm kiến trúc nào duyệt, PoC chạy trên dữ liệu nào". Không có câu trả lời thật thì bỏ dòng này, hoặc làm roadmap 4A trước.

#### Đo để biến số minh họa thành số thật
- [ ] Baseline: p95 của API dashboard hiện tại lấy từ APM (roadmap 1.6), thay cho "4,2 s".
- [ ] Thời gian chạy mỗi lần job: trung vị và max, lấy từ bảng trạng thái job.
- [ ] PoC: p95 cùng truy vấn dashboard trên ClickHouse, cùng khối dữ liệu, cùng khoảng thời gian.
- [ ] Freshness: p95 của `ingested_at − source.ts_ms` trên toàn bộ dòng trong một giờ cao điểm.
- [ ] "Approved": phải có tài liệu và biên bản review thật (roadmap 3.3).

#### Bẫy
- Nói "exactly-once" cho pipeline này. Đúng là at-least-once cộng ghi idempotent.
- Quên rằng `ReplacingMergeTree` không khử trùng ngay; báo cáo đếm thiếu `FINAL` sẽ đếm dư.
- Quên rủi ro log đầy khi capture job dừng.
- Đề xuất ClickHouse cho quy mô một Sở mà không so với columnstore.

#### Câu hỏi phỏng vấn
- **"Sao không dùng columnstore index cho đơn giản?"** Nên thử trước. Columnstore cho nén cột và batch mode ngay trên SQL Server, không thêm hạ tầng. Nếu đạt mục tiêu thì dừng ở đó. ClickHouse chỉ đáng khi dữ liệu, số dashboard hoặc yêu cầu độ tươi vượt khả năng của SQL Server, nhất là khi bị giới hạn bộ nhớ và độ song song của Standard Edition.
- **"Snapshot ban đầu cho bảng 580 triệu dòng làm thế nào?"** Dùng incremental snapshot của Debezium, kích hoạt qua signal table: chụp theo từng khúc khóa chính, xen kẽ với stream thay đổi, dừng và chạy tiếp được. Chạy ngoài giờ cao điểm, theo dõi tải lên nguồn và lag của Kafka.
- **"Dòng bị xóa ở nguồn thì ClickHouse biết thế nào?"** Debezium phát sự kiện `op = d`, theo sau là tombstone (message value rỗng, dùng cho log compaction). Với SMT `ExtractNewRecordState` chế độ `rewrite`, sự kiện xóa thành một dòng có `__deleted = true`. Phía ClickHouse ghi cột `is_deleted` và lọc khi truy vấn, hoặc khai báo `ReplacingMergeTree(ver, is_deleted)`.
- **"Message bị gửi lại thì số liệu có bị nhân đôi không?"** Có thể có bản trùng tạm thời. `ReplacingMergeTree` chỉ khử trùng khi merge và chỉ trong cùng partition, nên truy vấn cần chính xác dùng `FINAL` hoặc `argMax(col, version)`. Version phải tăng đơn điệu theo dòng, ví dụ LSN.
- **"Capture job CDC dừng một đêm thì chuyện gì xảy ra?"** Log không truncate được, `log_reuse_wait_desc` báo `REPLICATION`, file log phình tới khi đầy ổ và database ngừng ghi. Phải có cảnh báo trên trạng thái job và dung lượng log; khi chạy lại, Debezium đọc tiếp từ LSN đã lưu, miễn dữ liệu chưa bị cleanup job xóa.
- **"Ai duyệt design doc, PoC chạy ở đâu?"** Trả lời thật: phần này chưa triển khai. Thứ đang chạy là warehouse bằng Agent job; tôi trình bày được thiết kế CDC và các rủi ro, và nếu làm tôi sẽ bắt đầu bằng columnstore.

#### Tóm tắt
- Thật: warehouse B2B bằng Agent job mỗi giờ, high-water mark, lô 50 nghìn dòng, trần 2 triệu dòng mỗi lần chạy, quy mô một Sở.
- CDC ghi bảng change từ transaction log; Debezium poll bảng change, snapshot rồi stream, mỗi bảng một topic, key là khóa chính.
- ClickHouse: `Kafka` engine → materialized view → `ReplacingMergeTree`; khử trùng chỉ khi merge, đọc chính xác cần `FINAL` hoặc `argMax`.
- Rủi ro lớn nhất: log đầy khi capture job dừng; đổi schema; thêm hạ tầng.
- Luôn so với columnstore và tăng tần suất job trước khi chọn ClickHouse.

#### Bài tập
1. Viết phần "Phương án thay thế" của design doc (tối đa nửa trang) cho dashboard một Sở, kết luận chọn phương án nào ở quy mô hiện tại.
   **Đáp án:** Ở quy mô một Sở, chọn tăng tần suất job hoặc columnstore. Nêu điều kiện chuyển sang CDC → ClickHouse: ví dụ p95 dashboard vượt 2 s trên dữ liệu thật, hoặc nghiệp vụ cần độ tươi dưới vài phút.
2. Cho bảng `ReplacingMergeTree(ver)` có 3 bản của cùng `result_id`: (ver 1, score 5), (ver 3, score 8), (ver 2, score 7), chưa merge. Viết truy vấn trả về điểm đúng của dòng đó.
   **Đáp án:** `SELECT argMax(score, ver) FROM result WHERE result_id = 42;` hoặc `SELECT score FROM result FINAL WHERE result_id = 42;`. Kết quả 8.
3. Trên database dev có bật CDC, tạm dừng capture job, ghi khoảng 10 nghìn dòng, rồi xem `log_reuse_wait_desc` và kích thước log (`DBCC SQLPERF(LOGSPACE)`).
   **Đáp án:** `log_reuse_wait_desc` chuyển sang `REPLICATION`, phần trăm log dùng tăng và không giảm sau backup log cho tới khi capture job chạy lại.

### Bài 5.2. SSO cho các sản phẩm: OIDC, PKCE, BFF
**Dòng CV:** "Unified sign-on for 4 products (IOE, IOK, IOSTEM, IOM) on OAuth 2.0 / OpenID Connect via a YARP BFF with PKCE and Redis-backed sessions; login support tickets fell 35%."
**Trạng thái:** Một phần. Lõi BFF (PKCE, ticket store trên Redis, reverse proxy) đã có sẵn khi bạn vào, do đồng nghiệp viết. Phần của bạn: hardening BFF, SSO stateless cho IOSTEM, silent SSO cho IOE web, xác thực service-to-service cho CRM. Minh họa: "4 products" và "tickets fell 35%".

#### Mục tiêu
- Sau bài này, bạn giải thích được Authorization Code + PKCE từ gốc, kể cả vì sao public client không dùng client secret.
- So sánh được BFF (token ở server) với SPA stateless (token trong trình duyệt), và trả lời vì sao hệ thống có cả hai.
- Nắm cookie `SameSite`, CSRF, CORS, kiểm tra JWT, refresh token, logout giữa nhiều app.
- Nói đúng ranh giới: phần lõi của đồng nghiệp, phần hardening và client của bạn.

#### Bối cảnh và việc thật đã làm
BFF identity viết bằng ASP.NET Core (Minimal APIs, YARP reverse proxy), đứng trước identity server và user service (nguồn: mục 10, B6, C3).

Lõi có sẵn (không phải của bạn): cookie `HttpOnly`, `SameSite=Lax`; ticket xác thực lưu trên Redis, cookie chỉ chứa khóa tham chiếu; data protection key lưu trên Redis; antiforgery; PKCE hỗ trợ S256 và plain (cho client cũ); authorization code lưu Redis 2 phút, dùng một lần; endpoint đổi token nhận `client_secret` (confidential client) hoặc `code_verifier` (public client).

Phần của bạn:

- **Hardening BFF:** CORS allow-list đọc từ config; cookie "Remember" lưu 7 ngày, không chọn thì là session cookie; các endpoint status, verify-token, token chuyển sang POST để token không nằm trong URL hay log; feature flag cho Cloudflare Turnstile.
- **SSO stateless cho IOSTEM:** PKCE sinh trong trình duyệt, token trong `sessionStorage`, `BroadcastChannel` đồng bộ đăng nhập và đăng xuất giữa các tab.
- **IOE web:** silent SSO bằng một lần redirect cả trang với `skip_login=true`; cooldown 5 giây sau logout để không tự đăng nhập lại ngay; cờ pending chống vòng lặp redirect; đổi token ở phía server.
- **CRM service-to-service:** token mã hóa RSA-OAEP kèm timestamp, chỉ chấp nhận lệch ±5 phút để chống replay.

> **Cảnh báo:** Config CORS hiện vẫn để `"*"`. Sửa trước khi đem phần hardening ra kể. Điểm yếu nên tự nhận ở tích hợp CRM: private key nằm trong file config (nên chuyển sang secret store), padding OAEP-SHA1 (nên đổi sang SHA-256), và cửa sổ ±5 phút không có nonce thì vẫn replay được trong cửa sổ đó.

#### Kiến thức nền: OAuth 2.0, OIDC và PKCE
**OAuth 2.0** là giao thức ủy quyền: client xin access token để gọi API thay mặt người dùng. **OpenID Connect (OIDC)** thêm lớp định danh trên OAuth: scope `openid`, `id_token` (JWT mô tả người đăng nhập), endpoint userinfo, discovery `/.well-known/openid-configuration`, tham số `nonce` chống replay `id_token`.

**Authorization Code + PKCE** (RFC 7636):

1. Client sinh `code_verifier` ngẫu nhiên (43–128 ký tự), tính `code_challenge = BASE64URL(SHA256(code_verifier))`, kèm `state` ngẫu nhiên (chống CSRF ở bước callback).
2. Redirect người dùng tới `/authorize?response_type=code&code_challenge=...&code_challenge_method=S256&state=...`.
3. Identity server xác thực, lưu challenge cùng `code`, redirect về client kèm `code`.
4. Client gọi `/token` với `code` và `code_verifier`; server tính lại SHA-256 và so với challenge đã lưu.

Kẻ chặn được `code` (qua log, lịch sử trình duyệt, app độc trên điện thoại) không có `code_verifier` nên không đổi được token. SPA và app di động là **public client**: mã nguồn nằm ở máy người dùng nên không giữ được `client_secret`; PKCE thay thế vai trò đó. `plain` (challenge = verifier) không chống được kẻ đọc được request authorize, chỉ để tương thích client cũ.

```csharp
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;

string verifier  = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32)); // 43 ký tự
string challenge = WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
```

#### Kiến thức nền: BFF và SPA stateless
**BFF (Backend for Frontend):** BFF là confidential client, giữ access token và refresh token ở server. Trình duyệt chỉ có cookie `HttpOnly` (JavaScript không đọc được), `Secure`, `SameSite=Lax`. Request API đi qua BFF; YARP gắn access token từ phiên server-side rồi chuyển tiếp.

```csharp
builder.Services.AddDataProtection()
    .SetApplicationName("identity-bff")
    .PersistKeysToStackExchangeRedis(redis, "DataProtection-Keys");

builder.Services.AddSingleton<ITicketStore, RedisTicketStore>();
builder.Services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
    .Configure<ITicketStore>((o, store) => o.SessionStore = store);
```

- `SessionStore` (ticket store): cookie chỉ chứa khóa, ticket nằm trên Redis. Lợi ích: thu hồi phiên ngay bằng cách xóa key, cookie nhỏ, không lộ claim ra client.
- Data protection key dùng chung: cookie được mã hóa bằng key ring. Nhiều pod sau load balancer phải dùng chung key ring, nếu không pod B không giải mã được cookie do pod A tạo và người dùng bị đăng xuất ngẫu nhiên.

**SPA stateless (IOSTEM):** PKCE sinh bằng Web Crypto, token trong `sessionStorage`, đồng bộ tab bằng `BroadcastChannel`:

```javascript
const bc = new BroadcastChannel('auth');
bc.onmessage = (e) => { if (e.data === 'logout') { sessionStorage.clear(); location.assign('/'); } };
function logout() { sessionStorage.clear(); bc.postMessage('logout'); }
```

Trade-off: token trong trình duyệt bị lộ nếu có XSS; đổi lại không cần BFF, không bị CSRF (token không tự gửi theo request như cookie) và tự xóa khi đóng tab. Theo best practice, ứng dụng xử lý dữ liệu nhạy cảm nên dùng BFF.

**Silent SSO:** cách cũ là iframe ẩn gọi `/authorize?prompt=none`; iframe cần cookie của identity server trong ngữ cảnh bên thứ ba, mà Safari (ITP) và Firefox (ETP) chặn cookie bên thứ ba. Redirect cả trang (top-level) là ngữ cảnh bên thứ nhất nên cookie được gửi. `skip_login=true` của IOE web đóng vai trò tương tự `prompt=none` chuẩn OIDC: có phiên thì trả `code`, không có thì quay về ngay thay vì hiện form.

#### Kiến thức nền: cookie, CSRF, CORS, JWT, logout
- **`SameSite=Lax`:** cookie không đi kèm request POST hay fetch từ site khác, nhưng vẫn đi kèm điều hướng GET cấp cao nhất. "Site" tính theo domain đăng ký (eTLD+1), nên các subdomain cùng domain là same-site: một subdomain bị chiếm vẫn gửi được request kèm cookie. Vì vậy vẫn bật antiforgery token.
- **CORS:** trình duyệt từ chối `Access-Control-Allow-Origin: *` khi request mang credentials; ASP.NET Core cũng không cho kết hợp `AllowAnyOrigin()` với `AllowCredentials()`. Allow-list theo config là cách đúng.
- **Kiểm tra JWT:** chữ ký qua JWKS (cache khóa, chọn theo `kid`, hỗ trợ xoay khóa); kiểm `iss`, `aud`, `exp`, `nbf`; cố định thuật toán để chặn `alg: none` và lỗi nhầm RS256 với HS256. `ClockSkew` mặc định của .NET là 5 phút, nên đặt nhỏ lại.

```csharp
builder.Services.AddAuthentication().AddJwtBearer(o =>
{
    o.Authority = "https://id.example.vn";
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer     = "https://id.example.vn",
        ValidAudience   = "exam-api",
        ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 },
        ClockSkew       = TimeSpan.FromSeconds(30)
    };
});
```

- **Refresh token (best practice):** access token 5–15 phút. Với BFF, refresh token ở server, BFF tự làm mới khi access token sắp hết hạn. Xoay vòng refresh token mỗi lần dùng; token cũ bị dùng lại thì thu hồi cả chuỗi của phiên đó. Logout thu hồi refresh token ở identity server. SPA stateless làm mới bằng silent re-auth thay vì giữ refresh token lâu trong trình duyệt.
- **Logout nhiều app:** RP-initiated logout (`end_session_endpoint`) kết thúc phiên ở identity server; front-channel logout (identity server tải URL logout của từng app trong trình duyệt) hoặc back-channel logout (identity server gọi server-to-server tới từng app kèm logout token). Phía BFF xóa ticket trên Redis.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Lõi BFF, gồm PKCE và ticket store trên Redis, có sẵn khi tôi vào. Tôi làm hai việc. Một là hardening BFF: CORS theo allow-list, đưa các endpoint token sang POST để token không lọt vào URL và log, cookie Remember 7 ngày, cờ bật Turnstile. Hai là đưa client vào SSO: IOSTEM là SPA stateless dùng PKCE trong trình duyệt và đồng bộ tab bằng BroadcastChannel; IOE web dùng silent SSO bằng redirect cả trang thay cho iframe, vì cookie bên thứ ba bị chặn, có cooldown sau logout và cờ chống vòng lặp."

#### Đo để biến số minh họa thành số thật
- [ ] Đếm số app thật sự dùng chung đăng nhập; chỉ ghi "4 products" nếu đủ 4.
- [ ] Ticket: gắn nhãn ticket theo loại (quên mật khẩu, không đăng nhập được) trên hệ thống CSKH, so 4–8 tuần trước và sau khi bật SSO, chia cho số người dùng hoạt động để loại ảnh hưởng mùa thi.
- [ ] Tỉ lệ đăng nhập lỗi theo ngày từ log BFF, trước và sau.

#### Bẫy
- Nhận cả lõi PKCE và ticket store là của mình.
- Nói "token chỉ nằm ở server" rồi bị hỏi IOSTEM để token ở đâu.
- Khoe CORS allow-list trong khi config đang `"*"`.
- Gọi RSA-OAEP là "giao thức xác thực". Nó chỉ là lớp mã hóa token cộng cửa sổ thời gian cho một tích hợp; cách chuẩn hơn là OAuth client credentials, mTLS, hoặc HMAC kèm nonce.
- Nói silent SSO "chạy với mọi trình duyệt" khi chưa test hết.

#### Câu hỏi phỏng vấn
- **"`SameSite=Lax` đã đủ chống CSRF chưa?"** Chưa. Lax chặn cookie trên POST từ site khác, nhưng vẫn gửi cookie khi điều hướng GET cấp cao nhất, nên endpoint GET có tác dụng phụ vẫn bị khai thác; subdomain cùng site cũng không bị chặn. Vì vậy BFF bật thêm antiforgery token và mọi thao tác đổi trạng thái dùng POST.
- **"Sao dùng PKCE mà không dùng client secret?"** SPA và app di động là public client, mã nằm trên máy người dùng nên không giữ được secret. PKCE ràng buộc `code` với `code_verifier` chỉ client đó biết. Dùng S256; plain chỉ để tương thích client cũ.
- **"Vì sao lưu ticket trên server thay vì JWT trong cookie?"** Thu hồi phiên ngay bằng cách xóa key trên Redis; cookie nhỏ; không lộ claim ra client. Điều kiện đi kèm: data protection key phải dùng chung giữa các pod, nếu không pod khác không giải mã được cookie.
- **"BFF giữ token ở server, vậy sao IOSTEM lại để token trong `sessionStorage`? Có bị XSS không?"** Có, token trong `sessionStorage` đọc được nếu có XSS, nên cần CSP và vệ sinh input. IOSTEM là SPA stateless, đổi lại được: không cần BFF, không bị CSRF, token tự xóa khi đóng tab. Với dữ liệu nhạy cảm hơn, best practice là đưa app đó qua BFF.
- **"Logout ở một app thì các app khác thế nào?"** Kết thúc phiên ở identity server (RP-initiated logout), xóa ticket trên Redis, rồi dùng front-channel hoặc back-channel logout của OIDC để báo các app còn lại. Trong cùng một app, các tab đồng bộ bằng `BroadcastChannel`.
- **"Ticket giảm 35% đo thế nào?"** Số này là minh họa. Theo best practice: gắn nhãn ticket theo loại, so 4–8 tuần trước và sau khi bật SSO, chuẩn hóa theo số người dùng hoạt động để loại ảnh hưởng mùa thi.
- **"Vì sao SSO làm giảm ticket đăng nhập?"** Một tài khoản cho nhiều app nên ít quên mật khẩu; silent login nên ít phải đăng nhập lại; logout đồng bộ nên ít trạng thái lệch giữa các app.
- **"Refresh token xử lý thế nào?"** Xem mục refresh token ở trên: ngắn hạn, xoay vòng, phát hiện dùng lại, thu hồi khi logout; SPA dùng silent re-auth.
- **"Vì sao data protection key phải dùng chung?"** Nhiều pod; pod nào tạo cookie thì pod khác cũng phải giải mã được.
- **"Plain PKCE có an toàn không?"** Không bằng S256; chỉ giữ cho client cũ và nên có kế hoạch bỏ.

#### Tóm tắt
- Lõi BFF có sẵn; phần của bạn là hardening và client SSO cho IOE web, IOSTEM, cộng xác thực CRM.
- PKCE: `code_challenge = BASE64URL(SHA256(code_verifier))`; public client không giữ được secret.
- BFF: token ở server, cookie `HttpOnly`, ticket trên Redis, data protection key dùng chung giữa pod.
- `SameSite=Lax` chưa đủ, cần antiforgery; CORS `"*"` không đi được với credentials.
- Silent SSO bằng redirect cả trang vì cookie bên thứ ba bị chặn trong iframe.

#### Bài tập
1. Viết hàm C# sinh `code_verifier` và `code_challenge`, rồi hàm phía server kiểm tra cặp đó.
   **Đáp án:** Sinh như đoạn code trong bài. Kiểm tra: tính `Base64UrlEncode(SHA256(ASCII(verifier)))` và so với challenge đã lưu bằng `CryptographicOperations.FixedTimeEquals` trên mảng byte.
2. Liệt kê 4 thay đổi config cần làm để BFF chạy đúng khi scale từ 1 lên 3 pod.
   **Đáp án:** Data protection key lưu chung (Redis) với cùng application name; ticket store chung (Redis); authorization code lưu chung (Redis), không giữ trong memory; CORS allow-list và cookie domain giống nhau trên mọi pod.
3. Viết lại cấu hình CORS của BFF từ `"*"` sang allow-list đọc từ config, có credentials.
   **Đáp án:** `policy.WithOrigins(config.GetSection("Cors:Origins").Get<string[]>()!).AllowCredentials().AllowAnyHeader().WithMethods("GET", "POST");` và không dùng `AllowAnyOrigin()`.

### Bài 5.3. Leaderboard realtime cho IOM
**Dòng CV:** "Built real-time leaderboards for IOM head-to-head battles: Kafka score events feed Redis sorted sets, serving 10K concurrent players with p95 rank updates under 150 ms."
**Trạng thái:** Một phần. Thật: bạn code toàn bộ luồng sự kiện điểm → Kafka → consumer → Redis sorted set → API đọc top-N và hạng (C2). 10K người chơi đồng thời là ước lượng của bạn, chưa đo. "p95 under 150 ms" là minh họa.

#### Mục tiêu
- Sau bài này, bạn giải thích được từng khâu của luồng IOM và cấu trúc dữ liệu bên dưới sorted set.
- Xử lý được ba câu khó: hòa điểm, message gửi lại, Redis mất dữ liệu.
- Tính được giới hạn điểm khi mã hóa (điểm, thời gian) vào score kiểu double.
- Phân biệt leaderboard realtime của IOM với bảng xếp hạng tính sẵn ở trang chủ học sinh.

#### Bối cảnh và việc thật đã làm
Có hai loại bảng xếp hạng trong hệ thống, đừng trộn:

- **Bảng xếp hạng trang chủ học sinh** (mục 8, B4): 4 phạm vi Trường, Xã, Tỉnh, Toàn quốc. Hạng được **tính sẵn** bằng SQL job trong kho dữ liệu; job này không phải của bạn. API chỉ đọc ra rồi ghép thông tin cá nhân. Giới hạn top-N theo vòng, khối, tỉnh: 1000/700/500/300/200/100, để giới hạn payload và chi phí truy vấn. Đánh đổi: bảng xếp hạng trễ đúng bằng chu kỳ job.
- **Leaderboard đấu đối kháng IOM** (C2): bạn code toàn bộ luồng. Producer gửi sự kiện điểm vào Kafka; consumer cập nhật Redis sorted set; API đọc top-N bằng `ZREVRANGE` và hạng của user bằng `ZREVRANK`.

> **Cảnh báo:** Các chi tiết bên dưới (partition key, `ZADD GT` hay `ZINCRBY`, công thức phá hòa điểm) là thiết kế theo best practice. Trước buổi phỏng vấn, mở lại code bạn đã viết và nói đúng code: nếu code dùng `ZINCRBY`, nói vậy và nói luôn rủi ro khi message bị gửi lại.

#### Kiến thức nền: sorted set
Sorted set lưu cặp (member, score), member duy nhất, sắp theo score; cùng score thì sắp theo thứ tự từ điển của member. Bên dưới là một hash table (member → score, tra `ZSCORE` O(1)) cộng một skiplist (sắp theo score, có đếm span nên tính được hạng O(log N)). Set nhỏ (mặc định tới 128 phần tử, giá trị ngắn) dùng encoding listpack gọn hơn.

| Lệnh | Việc | Độ phức tạp |
|---|---|---|
| `ZADD key [GT] score member` | Thêm hoặc cập nhật điểm | O(log N) |
| `ZREVRANGE key 0 9 WITHSCORES` | Top 10 | O(log N + M) |
| `ZREVRANK key member` | Hạng (đếm từ 0) | O(log N) |
| `ZSCORE key member` | Điểm | O(1) |
| `ZCARD key` | Số người | O(1) |

```bash
ZADD lb:iom:s12 GT 1520 "u:1001"
ZREVRANGE lb:iom:s12 0 9 WITHSCORES
ZREVRANK lb:iom:s12 "u:1001"          # trả 0 nghĩa là hạng 1
ZREVRANGE lb:iom:s12 40 50 WITHSCORES # 5 người trên và 5 người dưới user hạng 46
```

Từ Redis 6.2, `ZRANGE key 0 9 REV` thay cho `ZREVRANGE` (lệnh cũ vẫn chạy) và `ZADD` có `GT`/`LT`.

#### Kiến thức nền: Kafka và tính idempotent
- **Thứ tự:** Kafka chỉ giữ thứ tự trong một partition. Đặt key theo `matchId` (hoặc `userId`) để sự kiện của cùng một trận vào cùng partition.
- **Message gửi lại:** consumer commit offset sau khi xử lý thì được at-least-once, nghĩa là có thể xử lý một message hai lần. `ZINCRBY` cộng dồn nên điểm tăng gấp đôi. `ZADD` với điểm tuyệt đối là idempotent: ghi lại cùng giá trị cho cùng kết quả. Thêm `GT` để sự kiện cũ đến muộn không ghi đè điểm mới cao hơn.
- `GT` chỉ đúng khi điểm chỉ tăng. Nếu điểm có thể giảm (trừ điểm), dùng version của sự kiện trong một script Lua:

```lua
-- KEYS[1] = leaderboard, KEYS[2] = hash version theo member
-- ARGV[1] = member, ARGV[2] = score, ARGV[3] = version của sự kiện
local cur = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '-1')
if tonumber(ARGV[3]) <= cur then return 0 end
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
return 1
```

Trên Redis Cluster, hai key trong một script phải cùng hash slot: đặt hash tag, ví dụ `{lb:iom:s12}` và `{lb:iom:s12}:ver`.

#### Kiến thức nền: phá hòa điểm và giới hạn của double
Score là số double, chỉ biểu diễn chính xác số nguyên tới 2^53 = 9.007.199.254.740.992. Muốn "bằng điểm thì ai đạt trước xếp trên", mã hóa hai giá trị vào một số:

`score = points × T + (T − 1 − giây_kể_từ_đầu_mùa)`

Đạt sớm thì phần dư lớn hơn nên xếp trên. Giới hạn: `points × T < 2^53`.

- Dùng epoch giây (khoảng 1,7 × 10^9) thì phải chọn T = 10^10, khi đó points tối đa chỉ khoảng 900. Quá nhỏ.
- Dùng giây kể từ đầu mùa, mùa 100 ngày = 8.640.000 giây, chọn T = 10^7, points tối đa khoảng 9 × 10^8. Đủ.

```csharp
const long T = 10_000_000; // lớn hơn số giây của một mùa

static double Encode(long points, DateTimeOffset reachedAt, DateTimeOffset seasonStart)
{
    long sec = (long)(reachedAt - seasonStart).TotalSeconds;
    if (sec < 0 || sec >= T) throw new ArgumentOutOfRangeException(nameof(reachedAt));
    long encoded = checked(points * T + (T - 1 - sec));
    if (encoded > (1L << 53)) throw new OverflowException("score vượt 2^53, mất chính xác");
    return encoded;
}

static long DecodePoints(double score) => (long)score / T;
```

#### Kiến thức nền: dựng lại, hot key, bộ nhớ
- **Redis mất dữ liệu:** DB là nguồn sự thật. Dựng lại bằng cách đọc điểm từ DB và `ZADD` lại theo lô, hoặc replay Kafka từ offset cũ (retention của topic phải đủ dài). Trong lúc dựng, API trả trạng thái "đang cập nhật" hoặc đọc tạm từ DB. Định kỳ đối soát top-N giữa Redis và DB.
- **Hot key:** một key nằm trên một shard của Redis Cluster, mọi lệnh tới key đó do một luồng xử lý. Lệnh O(log N) rất nhẹ, vài nghìn lệnh mỗi giây không là vấn đề. Khi lớn hơn: chia key theo phòng, mùa giải hoặc vùng, đặt TTL cho key cũ; bảng tổng gộp top-N định kỳ; cache top-N trong memory của API 1 giây.
- **Bộ nhớ:** mỗi member cỡ vài chục tới khoảng 100 byte tùy độ dài member, nên 10K người chơi khoảng 1 MB. Đo thật bằng `MEMORY USAGE key`.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Tôi viết toàn bộ luồng leaderboard đấu đối kháng của IOM: sự kiện điểm đi qua Kafka, consumer cập nhật Redis sorted set, API đọc top-N bằng ZREVRANGE và hạng bằng ZREVRANK. Hòa điểm tôi xử lý bằng cách mã hóa điểm và thời gian vào score. Redis mất dữ liệu thì dựng lại từ DB. Về tải, tôi ước khoảng 10 nghìn người chơi đồng thời nhưng chưa có số đo; nếu cần tôi lấy từ monitoring."

#### Đo để biến số minh họa thành số thật
- [ ] Peak người chơi đồng thời: số phiên đang mở lúc cao điểm, hoặc số user khác nhau gửi điểm trong 1 phút cao nhất.
- [ ] Độ trễ cập nhật hạng: histogram Prometheus của (thời điểm `ZADD` xong − timestamp của sự kiện), lấy p95. Đồng hồ producer và consumer phải đồng bộ NTP, nếu không số sai.
- [ ] Consumer lag lớn nhất lúc cao điểm.

```promql
histogram_quantile(0.95, sum by (le) (rate(leaderboard_update_delay_seconds_bucket[5m])))
```

#### Bẫy
- Dùng epoch giây trong công thức phá hòa điểm mà không tính giới hạn 2^53.
- Nói `ZINCRBY` mà không nhắc rủi ro message gửi lại.
- Gộp bảng xếp hạng tính sẵn bằng SQL job (không phải của bạn) vào câu chuyện IOM.
- Nói "10K concurrent players" như số đo.

#### Câu hỏi phỏng vấn
- **"Hai người bằng điểm thì xếp thế nào?"** Mã hóa (điểm, thời gian) vào một score: `points × T + (T − 1 − giây_kể_từ_đầu_mùa)`, ai đạt trước xếp trên. Phải tính giới hạn 2^53 của double: dùng giây kể từ đầu mùa thay cho epoch để còn chỗ cho điểm. Nếu không mã hóa, Redis xếp người bằng điểm theo thứ tự từ điển của member, không có ý nghĩa nghiệp vụ.
- **"Kafka gửi trùng message thì điểm có bị cộng hai lần không?"** Với `ZINCRBY` thì có. Cách đúng: `ZADD` với điểm tuyệt đối (idempotent), thêm `GT` để sự kiện cũ đến muộn không ghi đè; nếu điểm có thể giảm thì so version trong script Lua; hoặc dedupe theo id sự kiện.
- **"Redis mất dữ liệu thì sao?"** DB là nguồn sự thật. Dựng lại từ DB theo lô, hoặc replay Kafka từ offset cũ nếu retention đủ. Trong lúc dựng, API báo đang cập nhật hoặc đọc tạm từ DB.
- **"Một key leaderboard toàn quốc có thành hot key không, và scale thế nào khi có nhiều phòng đấu?"** Một key nằm trên một shard. Lệnh O(log N) nhẹ nên vài nghìn lệnh mỗi giây vẫn ổn. Lớn hơn thì chia key theo phòng, mùa giải hoặc vùng, đặt TTL cho key cũ, gộp top-N định kỳ, cache top-N trong memory của API khoảng 1 giây.
- **"Leaderboard tốn bao nhiêu bộ nhớ?"** Mỗi member cỡ vài chục tới khoảng 100 byte, 10K người chơi khoảng 1 MB. Kiểm bằng `MEMORY USAGE`.
- **"Sao bảng xếp hạng trang chủ lại tính sẵn bằng SQL job mà không realtime?"** Tính hạng trên hàng triệu bản ghi kết quả cho mỗi request là không khả thi; tính sẵn đổi độ tươi lấy chi phí đọc thấp. Job đó không phải của tôi. Muốn realtime thì dùng sorted set như IOM.
- **"Làm realtime cho bảng xếp hạng trang chủ thì sao?"** `ZADD` khi nộp bài, `ZREVRANK`/`ZREVRANGE` khi đọc, phá hòa điểm bằng mã hóa score, đối soát định kỳ với DB. Nếu giữ cách tính sẵn bằng SQL: thứ tự điểm giảm dần, rồi thời gian làm bài tăng dần, rồi thời điểm nộp sớm hơn; `RANK()` nếu cho đồng hạng, `ROW_NUMBER()` nếu cần thứ tự duy nhất.
- **"10K đo thế nào?"** Xem mục đo ở trên; tới khi có số, nói "ước lượng".

#### Tóm tắt
- Thật: bạn code luồng IOM end to end; 10K là ước lượng, 150 ms là minh họa.
- Sorted set = hash table + skiplist; `ZADD`, `ZREVRANK` O(log N).
- `ZADD` điểm tuyệt đối (thêm `GT`) idempotent, `ZINCRBY` thì không.
- Phá hòa điểm bằng mã hóa score, nhớ giới hạn 2^53.
- DB là nguồn sự thật; Redis dựng lại được từ DB hoặc Kafka.

#### Bài tập
1. Với T = 10^7, tính score của người đạt 1.520 điểm ở giây thứ 3.600 của mùa, và kiểm tra người đạt 1.520 điểm ở giây 7.200 xếp dưới.
   **Đáp án:** 1520 × 10^7 + 9.999.999 − 3.600 = 15.209.996.399; người sau: 15.209.992.799, nhỏ hơn nên xếp dưới.
2. Trên Redis local, tạo leaderboard 100 nghìn member ngẫu nhiên, đo `MEMORY USAGE` và thời gian `ZREVRANK`.
   **Đáp án:** Dùng script `bash` lặp `ZADD` hoặc pipeline; bộ nhớ cỡ vài MB; `ZREVRANK` dưới 1 ms vì O(log N).
3. Viết consumer giả lập nhận cùng một sự kiện hai lần, so kết quả khi dùng `ZINCRBY` và `ZADD GT`.
   **Đáp án:** `ZINCRBY` cho điểm gấp đôi; `ZADD GT` giữ nguyên điểm đúng.

### Bài 5.4. AI nháp dữ liệu ~35K trường, người duyệt
**Dòng CV:** "Turned AI drafts of ~35K school records into a measured workflow: each save is diffed against the AI snapshot; field accuracy reached 94% and median review fell from 6 to 1.5 min."
**Trạng thái:** Một phần. Thật: luồng chụp bản AI gốc và so với mỗi lần người duyệt lưu (commit 13/10, mục 9); khoảng 35K là số trường đã đi qua luồng AI cộng người duyệt (C0). Phần trích xuất bằng AI có thể không phải bạn viết. Minh họa: "94%" và "6 → 1,5 phút".

#### Mục tiêu
- Sau bài này, bạn mô tả đúng luồng human-in-the-loop đã làm và ranh giới phần của mình.
- Định nghĩa chính xác "độ chính xác theo trường" và các chỉ số đi kèm.
- Trả lời được câu hỏi về trích xuất, chọn model, ngưỡng tin cậy theo best practice.
- Biết lấy số thật trên production thay cho 94% và thời gian duyệt.

#### Bối cảnh và việc thật đã làm
Sau đợt sáp nhập đơn vị hành chính, dữ liệu trường (mã đơn vị, tên, trường chính, phân hiệu, tỉnh/xã) phải cập nhật hàng loạt. Mục đích của luồng: giảm khối lượng duyệt phiếu và nhập tay của đội CSKH (C4).

Luồng (mục 9):

1. AI trích xuất bản nháp phiếu đơn vị trường, nạp vào bảng staging.
2. Người duyệt sửa phiếu trên CMS.
3. Lần lưu đầu tiên, hệ thống chụp lại **bản gốc của AI** (snapshot bất biến).
4. Mỗi lần lưu, so bản AI với bản người lưu:
   - Theo trường: thêm, bỏ, đổi vai trò, đổi tên phân hiệu, đổi tên trường.
   - Theo phiếu: mã đơn vị, tên đơn vị, trường chính, tỉnh/xã.
5. Ghi số trường AI đề xuất, số trường AI sai, tổng số sửa, và chi tiết dạng JSON.
6. Nếu bước đánh giá lỗi thì chỉ ghi log, **không làm hỏng lần lưu phiếu**.

Ý nghĩa: đo độ chính xác của AI trên dữ liệu thật theo từng lô, từ đó quyết định tin bản AI tới đâu và cần sửa prompt ở chỗ nào.

#### Kiến thức nền: thiết kế phép so
Phác thảo minh họa cơ chế (không phải code thật):

```csharp
public sealed record SchoolDraft(string Code, string Name, string Role, string? Campus);
public sealed record DiffResult(List<string> Added, List<string> Removed, List<string> Changed);

static DiffResult Compare(IReadOnlyList<SchoolDraft> ai, IReadOnlyList<SchoolDraft> saved)
{
    var a = ai.ToDictionary(s => s.Code);
    var s = saved.ToDictionary(x => x.Code);
    var added   = s.Keys.Except(a.Keys).ToList();                // người thêm: AI bỏ sót
    var removed = a.Keys.Except(s.Keys).ToList();                // người bỏ: AI đề xuất thừa
    var changed = a.Keys.Intersect(s.Keys).Where(k => a[k] != s[k]).ToList(); // đổi tên, vai trò, phân hiệu
    return new DiffResult(added, removed, changed);
}

// Đường lưu: việc chính trước, đánh giá sau, lỗi đánh giá không làm hỏng lần lưu
await repo.SaveFormAsync(form);
try
{
    await repo.SaveAiEvaluationAsync(form.Id, Compare(snapshot.Schools, form.Schools));
}
catch (Exception ex)
{
    logger.LogWarning(ex, "AI evaluation failed for form {FormId}", form.Id);
}
```

Điểm cần nghĩ khi thiết kế:

- **Khóa ghép cặp:** nếu ghép theo mã đơn vị mà AI đọc sai mã, một lỗi biến thành một "bỏ" cộng một "thêm". Phải định nghĩa rõ, hoặc ghép thêm theo tên gần đúng.
- **Snapshot bất biến:** chụp ở lần lưu đầu và không bao giờ sửa, nếu không mọi lần so sau đều so với bản đã bị người sửa.
- **Hai loại lỗi:** AI đề xuất sai (giống precision) và AI bỏ sót (giống recall). Công thức `1 − sai / đề xuất` chỉ đo loại thứ nhất.

#### Kiến thức nền: trích xuất và ngưỡng tin cậy (best practice)
- OCR rồi đưa văn bản cho LLM, hoặc dùng thẳng LLM đọc được ảnh.
- Bắt LLM trả JSON theo schema cố định (structured output), nhiệt độ thấp, prompt có vài ví dụ mẫu (few-shot).
- Kiểm tra bằng rule sau khi trích xuất: mã đơn vị phải tồn tại; tỉnh và xã phải khớp danh mục sau sáp nhập; tên trường so khớp gần đúng với danh mục.
- Lưu phiên bản prompt và model cùng kết quả, để so độ chính xác giữa các lần đổi prompt.
- **Ngưỡng tin cậy:** đặt theo từng loại trường dựa trên độ chính xác đo được (ví dụ tỉnh/xã sau khi qua rule thì tin cao, tên phân hiệu thì luôn duyệt). Vẫn lấy mẫu kiểm tra định kỳ phần được tự duyệt.
- **Automation bias:** người duyệt có xu hướng bấm lưu bản AI mà không đọc kỹ. Tỉ lệ "chấp nhận nguyên bản" cao chưa chắc là AI đúng; cần lấy mẫu kiểm tra độc lập.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Sau sáp nhập, dữ liệu khoảng 35 nghìn trường được AI soạn nháp rồi người duyệt trên CMS. Phần tôi làm là biến luồng đó thành thứ đo được: lần lưu đầu chụp lại bản AI, mỗi lần lưu so với bản người duyệt theo từng trường và từng phiếu, ghi số trường AI đề xuất, số sai, chi tiết sửa. Lỗi ở bước đánh giá chỉ ghi log, không chặn việc lưu. Phần trích xuất không phải tôi viết. Tỉ lệ đúng trên production tôi tính bằng một query trên bảng đánh giá."

#### Đo để biến số minh họa thành số thật
Chạy trên **production**, không dùng dữ liệu dev (roadmap 1.3):

```sql
SELECT COUNT(*) AS forms,
       SUM(AISchoolCount)      AS ai_schools,
       SUM(AISchoolWrongCount) AS ai_wrong,
       1.0 - 1.0 * SUM(AISchoolWrongCount) / NULLIF(SUM(AISchoolCount), 0) AS accuracy,
       SUM(CASE WHEN ChangeCount = 0 THEN 1 ELSE 0 END) * 1.0 / COUNT(*)   AS accepted_as_is
FROM <bảng đánh giá AI>;
```

Thời gian duyệt: trung vị của (lúc duyệt − lúc tạo phiếu) từ log, hoặc bấm giờ 20 phiếu làm tay và 20 phiếu có bản nháp AI.

```sql
SELECT DISTINCT
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY DATEDIFF(SECOND, CreatedAt, ApprovedAt)) OVER () / 60.0 AS median_min
FROM <bảng phiếu>
WHERE ApprovedAt IS NOT NULL;
```

> **Cảnh báo:** (lúc duyệt − lúc tạo) gồm cả thời gian phiếu nằm chờ trong hàng đợi, không phải thời gian người làm. Muốn nói "6 → 1,5 phút công", cần log lúc mở và lúc lưu phiếu, hoặc bấm giờ.

#### Bẫy
- Nhận phần trích xuất là của mình khi không viết.
- Nói 94% mà không định nghĩa 94% của cái gì (theo trường, theo phiếu, có tính bỏ sót không).
- Lấy số từ dữ liệu dev.
- Cho bước đánh giá chạy chung transaction với lần lưu, để lỗi đánh giá làm hỏng việc chính.

#### Câu hỏi phỏng vấn
- **"Phần trích xuất làm thế nào?"** Phần đó tôi không viết; theo best practice: OCR rồi LLM, hoặc LLM đọc ảnh; bắt trả JSON theo schema, nhiệt độ thấp, few-shot; kiểm tra bằng rule (mã đơn vị tồn tại, tỉnh/xã khớp danh mục, tên khớp gần đúng); lưu phiên bản prompt cùng kết quả.
- **"Dùng model nào?"** Nếu không chắc model cụ thể, nói tiêu chí chọn: độ chính xác trên một tập mẫu có nhãn, chi phí mỗi phiếu, độ trễ, và yêu cầu dữ liệu không rời khỏi hạ tầng được phép.
- **"Khi nào tin bản AI mà không cần người duyệt?"** Đặt ngưỡng theo từng loại trường dựa trên độ chính xác đo được trên production, và vẫn lấy mẫu kiểm tra định kỳ. Cẩn thận automation bias: tỉ lệ chấp nhận nguyên bản cao chưa chắc là AI đúng.
- **"Bước đánh giá lỗi thì sao?"** Chỉ ghi log, không làm hỏng lần lưu phiếu. Việc chính là lưu phiếu; đánh giá là đo lường phụ, mất vài bản ghi đánh giá chấp nhận được hơn là chặn người duyệt.
- **"Độ chính xác 94% là 94% của cái gì?"** Phải định nghĩa: theo trường, bằng `1 − số trường AI sai / số trường AI đề xuất` trên toàn bộ phiếu đã duyệt ở production. Công thức này không tính trường AI bỏ sót, nên báo kèm tỉ lệ bỏ sót và tỉ lệ phiếu chấp nhận nguyên bản. Số 94% trên CV là minh họa cho tới khi chạy query.
- **"Vì sao chụp bản AI ở lần lưu đầu mà không so với staging?"** Snapshot bất biến là mốc so cố định; staging có thể bị nạp lại hoặc sửa. Mọi lần lưu sau đều so với cùng một bản gốc, nên số liệu nhất quán.

#### Tóm tắt
- Thật: snapshot bản AI và so với mỗi lần lưu (commit 13/10); trích xuất không chắc là của bạn.
- Đo hai loại lỗi: đề xuất sai và bỏ sót; kèm tỉ lệ chấp nhận nguyên bản.
- Lỗi đánh giá chỉ ghi log, không làm hỏng việc lưu.
- Số thật lấy trên production; thời gian duyệt phải tách thời gian chờ.

#### Bài tập
1. Cho bản AI có trường {A, B, C} và bản người lưu {A, C', D} (C' là C đổi vai trò). Tính added, removed, changed và độ chính xác theo công thức trong bài, với "sai" = removed + changed.
   **Đáp án:** added = {D}, removed = {B}, changed = {C}; sai = 2, đề xuất = 3, độ chính xác = 1 − 2/3 ≈ 33%; bỏ sót 1 (D).
2. Viết câu trả lời 30 giây cho "AI sai thì ai chịu trách nhiệm?".
   **Đáp án:** Người duyệt là người quyết định cuối; hệ thống đo độ chính xác theo lô, lấy mẫu kiểm tra, và chỉ nới ngưỡng tự duyệt cho loại trường đã chứng minh độ chính xác.
3. Liệt kê các cột cần log để đo đúng thời gian công duyệt phiếu.
   **Đáp án:** thời điểm mở phiếu, thời điểm lưu, người duyệt, số lần mở lại; thời gian công = tổng các khoảng mở → lưu.

## Chương 6. Nền tảng kỹ thuật và con người

Chương này gồm ba dòng CV về nền tảng và cách làm việc: nâng cấp hàng loạt project lên .NET 10, xây knowledge base và mentor, dùng Claude Code với skill và MCP server. Interviewer hỏi các dòng này để xem bạn có tư duy vận hành (mốc hỗ trợ, rủi ro breaking change, rollout từng bước) và có nhân rộng được hiểu biết của mình ra team hay không.

Bài 6.1 là dòng Thật duy nhất trong cụm này, nên dùng được làm câu chuyện chính. Hai bài sau có phần minh họa về con số; phải nói đúng vai trò, nhất là phần AI soạn nháp và phần MCP server là tự viết hay chỉ cấu hình.

### Bài 6.1. Nâng ~70 project lên .NET 10
**Dòng CV:** "Upgraded ~70 projects in 12 services from .NET 5/6 to .NET 10 LTS behind compatibility shims, leaving business code untouched and removing a vulnerable APM dependency."
**Trạng thái:** Thật (commit 30/07, mục 11). Nguồn ghi "khoảng 12 service": đếm lại chính xác danh sách trước khi nói "12".

#### Mục tiêu
- Sau bài này, bạn kể được quy mô, các breaking change đã xử lý và cách kiểm chứng của đợt nâng cấp.
- Nắm mốc hỗ trợ của .NET (LTS, STS) và lý do lên thẳng .NET 10.
- Giải thích được shim, `IHttpClientFactory`, `Encrypt=true` của `Microsoft.Data.SqlClient`, và lỗi `OptionsValidationException`.

#### Bối cảnh và việc thật đã làm
Nguồn: mục 11.

- **Quy mô:** khoảng 600 file, +4.260/−2.764 dòng, khoảng 70 project chuyển từ net5/net6 lên net10. Rollout khoảng 12 service (API, worker, CMS, web).
- **Thư viện:** gom các thư viện cũ về một namespace mới (common, web, data).
- **Breaking change đã xử lý:**
  - `System.Data.SqlClient` → `Microsoft.Data.SqlClient`; driver mới mặc định `Encrypt=true`, nên connection string phải thêm `TrustServerCertificate`.
  - HTTP helper dạng static → HTTP client inject qua DI.
  - Lỗi ép kiểu unix time.
- **Shim tương thích** để business logic giữ nguyên.
- **Lỗi cấu hình:** config center vẫn bọc config trong khối `AppSettings` kiểu cũ, gây `OptionsValidationException` trên dev. Cách sửa: chép key lên root, chỉ khi root chưa có key đó.
- **Bảo mật:** chỉ dùng subscriber HTTP và gRPC của Elastic APM, bỏ gói all-in-one, để loại một dependency có lỗ hổng (cảnh báo NU1903).
- **Kiểm chứng:** build trên máy thật và chạy thử từng service. Có skill Claude Code ghi lại quy trình: chỉ sửa project web, không đụng thư viện dùng chung dạng git submodule (bài 6.3).

#### Kiến thức nền: mốc hỗ trợ của .NET
.NET ra một bản chính mỗi tháng 11. Bản số chẵn là **LTS** (hỗ trợ 3 năm); bản số lẻ là **STS**, trước đây 18 tháng, từ .NET 9 được kéo lên 24 tháng.

| Phiên bản | Loại | Hết hỗ trợ |
|---|---|---|
| .NET 5 | STS | 05/2022 |
| .NET 6 | LTS | 11/2024 |
| .NET 7 | STS | 05/2024 |
| .NET 8 | LTS | 11/2026 |
| .NET 9 | STS | 11/2026 |
| .NET 10 | LTS (ra 11/2025) | 11/2028 |

Hết hỗ trợ nghĩa là không còn bản vá bảo mật. net5/net6 đã hết hỗ trợ; .NET 8 cũng hết vào 11/2026, nên lên .NET 8 chỉ để phải nâng lần nữa ngay sau đó.

#### Kiến thức nền: các breaking change
**`Microsoft.Data.SqlClient` và `Encrypt=true`.** Từ bản 4.0, driver mặc định mã hóa kết nối và kiểm chứng chứng chỉ server. Server dùng chứng chỉ tự ký thì kết nối lỗi "certificate chain was issued by an authority that is not trusted". `TrustServerCertificate=True` vẫn mã hóa nhưng bỏ kiểm chứng chứng chỉ, nên không chống được man-in-the-middle. Chấp nhận được trong mạng nội bộ khi chuyển đổi; best practice dài hạn là cài chứng chỉ được tin cậy cho SQL Server.

**HttpClient.** `new HttpClient()` mỗi lần gọi làm cạn socket (socket ở trạng thái TIME_WAIT); một `HttpClient` tĩnh sống mãi thì không cập nhật DNS. `IHttpClientFactory` quản lý pool `HttpMessageHandler` có thời gian sống (mặc định 2 phút), giải quyết cả hai.

**Shim:** lớp adapter giữ nguyên API cũ mà business code đang gọi, bên trong chuyển sang cách làm mới. Minh họa cơ chế (không phải code thật):

```csharp
public static class HttpHelper   // chữ ký cũ giữ nguyên, business code không sửa
{
    private static IHttpClientFactory? _factory;
    public static void Configure(IHttpClientFactory factory) => _factory = factory;

    public static Task<string> GetAsync(string url) =>
        (_factory ?? throw new InvalidOperationException("HttpHelper chưa được cấu hình"))
            .CreateClient("legacy")
            .GetStringAsync(url);
}

// Program.cs
builder.Services.AddHttpClient("legacy", c => c.Timeout = TimeSpan.FromSeconds(30));
var app = builder.Build();
HttpHelper.Configure(app.Services.GetRequiredService<IHttpClientFactory>());
```

Trade-off: shim là nợ kỹ thuật có chủ đích. Nó cho phép nâng framework mà không đụng business code, nhưng vẫn là static nên khó test; sau đó nên chuyển dần sang inject trực tiếp.

**Unix time.** Nguồn chỉ ghi "lỗi ép kiểu unix time", không ghi chi tiết; nếu bị hỏi, nói đúng lỗi bạn đã sửa. Best practice: dùng `DateTimeOffset.FromUnixTimeSeconds` / `ToUnixTimeSeconds`, kiểu `long` thay cho `int` (giây kể từ 1970 vượt `int.MaxValue` năm 2038), và phân biệt giây với mili giây.

**Options validation.** Options có `ValidateDataAnnotations()` và `ValidateOnStart()` sẽ ném `OptionsValidationException` khi key bắt buộc thiếu. Config center đặt key dưới `AppSettings:` nên code mới đọc ở root không thấy. Cách sửa theo đúng mô tả "chép lên root nếu root chưa có":

```csharp
var promoted = builder.Configuration.GetSection("AppSettings")
    .AsEnumerable(makePathsRelative: true)
    .Where(kv => kv.Value is not null && builder.Configuration[kv.Key] is null)
    .ToDictionary(kv => kv.Key, kv => kv.Value);
builder.Configuration.AddInMemoryCollection(promoted);
```

**Dependency có lỗ hổng.** NuGet audit cảnh báo gói có lỗ hổng đã biết theo mức: NU1901 (thấp), NU1902 (trung bình), NU1903 (cao), NU1904 (nghiêm trọng). Gói APM all-in-one kéo theo nhiều integration không dùng, trong đó có dependency bắc cầu bị lỗ hổng; chỉ tham chiếu phần cần (HTTP, gRPC) thì loại được nó. Kiểm tra bằng:

```bash
dotnet list package --vulnerable --include-transitive
```

**Điểm nên kiểm khi nâng từ net5/6 (best practice):** image container từ .NET 8 mặc định lắng nghe cổng 8080 và chạy bằng user không phải root, nên manifest Kubernetes và health check có thể phải sửa; `BinaryFormatter` bị bỏ từ .NET 9; tag image base (`mcr.microsoft.com/dotnet/aspnet:10.0`) trong Dockerfile.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Tôi nâng khoảng 70 project từ .NET 5 và 6 lên .NET 10, khoảng 600 file. Nguyên tắc là business code không đổi: tôi gom thư viện cũ về namespace mới và viết shim, ví dụ helper HTTP tĩnh giữ nguyên chữ ký nhưng bên trong dùng IHttpClientFactory. Các breaking change chính là SqlClient mới mặc định Encrypt, config center còn bọc trong AppSettings làm options validation ném lỗi, và một lỗi ép kiểu unix time. Tôi cũng bỏ gói APM all-in-one để loại một dependency có lỗ hổng mức cao. Rollout từng service: build trên máy thật, chạy trên dev, rồi deploy."

#### Bẫy
- Nói "12 service" khi chưa đếm lại.
- Nói `TrustServerCertificate=True` là "an toàn" mà không nhắc nó bỏ kiểm chứng chứng chỉ.
- Nói "không đổi một dòng business code" nếu thực tế có sửa vài chỗ; nói "business logic giữ nguyên, thay đổi nằm ở hạ tầng và shim".
- Quên .NET 8 hết hỗ trợ 11/2026 khi giải thích vì sao chọn .NET 10.

#### Câu hỏi phỏng vấn
- **"Vì sao lên .NET 10 mà không dừng ở .NET 8?"** net5/net6 đã hết hỗ trợ, không còn bản vá bảo mật. .NET 8 cũng là LTS nhưng hết hỗ trợ tháng 11/2026; .NET 10 là LTS ra tháng 11/2025, hỗ trợ tới 11/2028. Lên thẳng .NET 10 để khỏi nâng hai lần.
- **"Shim là gì, và giá phải trả là gì?"** Lớp adapter giữ nguyên API cũ (ví dụ helper HTTP tĩnh) nhưng bên trong gọi cách làm mới (`IHttpClientFactory` qua DI), nên business code không phải sửa. Giá phải trả: vẫn là static, khó test; là nợ kỹ thuật có chủ đích, nên chuyển dần sang inject trực tiếp.
- **"Rollout 70 project thế nào để không làm sập production?"** Từng service một: build trên máy thật, chạy thử trên dev với config thật của config center, rồi deploy. Thư viện dùng chung đã được nâng trước; project web chỉ đổi TFM, package, DI và namespace.
- **"Chuyển sang `Microsoft.Data.SqlClient` gặp gì?"** Driver mới mặc định `Encrypt=true` và kiểm chứng chứng chỉ, nên server dùng chứng chỉ tự ký sẽ lỗi kết nối. Thêm `TrustServerCertificate=True` để chuyển đổi; nó vẫn mã hóa nhưng không chống man-in-the-middle, nên lâu dài cần chứng chỉ được tin cậy.
- **"`OptionsValidationException` trên dev là do đâu?"** Config center vẫn bọc key trong khối `AppSettings` kiểu cũ, còn code mới đọc ở root và validate lúc khởi động. Sửa bằng cách chép key từ `AppSettings` lên root, chỉ khi root chưa có, để không ghi đè giá trị mới.
- **"Bỏ dependency APM có lỗ hổng thế nào?"** NuGet audit báo NU1903 (lỗ hổng mức cao) ở một dependency bắc cầu của gói APM all-in-one. Chỉ tham chiếu subscriber HTTP và gRPC cần dùng thì dependency đó biến mất; kiểm lại bằng `dotnet list package --vulnerable --include-transitive`.

#### Tóm tắt
- Thật: khoảng 70 project, khoảng 600 file, commit 30/07; đếm lại số service.
- LTS 3 năm; .NET 8 và .NET 9 hết hỗ trợ 11/2026; .NET 10 tới 11/2028.
- Shim giữ API cũ, bên trong dùng cách mới; business logic không đổi.
- Ba breaking change: SqlClient `Encrypt=true`, HTTP helper tĩnh, unix time; cộng lỗi config `AppSettings`.
- Bỏ gói APM all-in-one để loại dependency NU1903.

#### Bài tập
1. Trên một project net6 mẫu, đổi TFM sang `net10.0`, chạy `dotnet list package --vulnerable --include-transitive` trước và sau khi cập nhật package.
   **Đáp án:** Ghi lại danh sách gói và mức cảnh báo; gói nào chỉ đến qua dependency bắc cầu thì xử lý bằng cách bỏ gói cha không cần hoặc nâng gói cha.
2. Viết test chứng minh đoạn "chép `AppSettings` lên root" không ghi đè key đã có ở root.
   **Đáp án:** Dựng `ConfigurationBuilder` với `AppSettings:X = 1` và `X = 2`, chạy đoạn chép, kiểm `config["X"] == "2"`; với key chỉ có trong `AppSettings` thì kiểm đã lên root.
3. Kể ra 3 thứ phải kiểm trong Dockerfile và manifest Kubernetes khi nâng một service từ net6 lên net10.
   **Đáp án:** Tag image base; cổng lắng nghe mặc định 8080 (`ASPNETCORE_HTTP_PORTS`) so với cổng trong service và probe; user không phải root (quyền ghi thư mục).

### Bài 6.2. Mentor và knowledge base
**Dòng CV:** "Mentored 2 engineers and wrote the team's knowledge base of flows, APIs, and procedures; new hires' time to first production PR fell from 4 weeks to 10 days."
**Trạng thái:** Một phần. Thật: knowledge base gồm tài liệu luồng nghiệp vụ, API chi tiết, store procedure theo DB, có file index điều hướng (khoảng 150+ tài liệu); AI soạn nháp, bạn review và giữ cấu trúc (mục 12, mục 0). Minh họa: "Mentored 2 engineers" và "4 weeks to 10 days". Roadmap mục 3.2 là cách làm thật.

#### Mục tiêu
- Sau bài này, bạn mô tả được cấu trúc knowledge base và cách giữ nó đúng với code.
- Nói đúng vai trò của AI trong việc soạn tài liệu.
- Trình bày được kế hoạch onboarding và cách review PR để dạy, ở mức best practice.
- Biết đo "thời gian tới PR đầu tiên" và giới hạn của con số đó.

#### Bối cảnh và việc thật đã làm
Knowledge base (mục 12):

- Tài liệu luồng nghiệp vụ, tài liệu API chi tiết, tài liệu store procedure chia theo database.
- Có file index điều hướng: từ một tài liệu luồng, người đọc biết luồng dùng API nào, mở index API, rồi tới chi tiết input, output, trạng thái của từng API; tương tự cho procedure theo từng database.
- Nói thật: AI soạn nháp, bạn review và giữ cấu trúc. Nên nói "tôi dựng và duy trì, có dùng AI soạn nháp, tôi review" thay cho "wrote".

Mentor 2 người và số "4 tuần → 10 ngày" chưa xảy ra. Roadmap 3.2: mentor 1–2 người, onboard bằng bộ tài liệu này và review PR hằng tuần.

#### Kiến thức nền: knowledge base dùng được
- **Phân loại tài liệu** (khung Diátaxis): hướng dẫn học (tutorial), hướng dẫn làm việc cụ thể (how-to), tham chiếu (reference: API, procedure), giải thích (explanation: luồng nghiệp vụ, lý do thiết kế). Trộn bốn loại trong một file làm tài liệu khó đọc và khó cập nhật.
- **Điều hướng hai chiều:** index là bản đồ; mỗi tài liệu luồng trỏ tới index API; mỗi tài liệu API ghi luồng nào dùng nó.
- **Giữ tài liệu không lỗi thời:** đặt tài liệu cạnh code (docs as code), sửa tài liệu trong cùng PR với thay đổi; mỗi tài liệu có người chịu trách nhiệm và ngày kiểm lần cuối; tài liệu không ai kiểm quá lâu thì đánh dấu.
- **Tài liệu do AI soạn nháp:** rủi ro là AI viết trôi chảy nhưng sai (tên tham số, trạng thái, điều kiện lọc). Cách kiểm: đối chiếu từng mục với code và schema DB dev, nhất là giá trị enum và mã trạng thái; không chép số liệu AI tự suy ra.

#### Kiến thức nền: onboarding và review để dạy (best practice)
- **Kế hoạch 30-60-90 ngày:** 30 ngày đầu chạy được hệ thống ở local, đọc luồng chính, sửa lỗi nhỏ; 60 ngày làm tính năng nhỏ trọn vẹn có review; 90 ngày tự nhận một hạng mục vừa và trực hỗ trợ.
- **Giao việc tăng dần độ khó**, việc đầu tiên nhỏ và có đường ra production rõ ràng, để người mới chạm đủ quy trình: branch, build, review, deploy.
- **Review PR theo hướng dạy:** giải thích lý do, không sửa hộ; phân biệt rõ góp ý bắt buộc với góp ý nhỏ; đặt câu hỏi để người viết tự tìm ra vấn đề; pair programming cho phần khó.
- **Đo:** thời gian tới PR đầu tiên được merge = ngày merge PR đầu − ngày vào công ty; "tới production" thì lấy ngày deploy.

```bash
# Commit đầu tiên của một người trên nhánh chính (xấp xỉ; ngày merge PR lấy từ hệ thống Git server chính xác hơn)
git log origin/main --author="ten.nguoi" --reverse --format="%ad %h %s" --date=short | head -1
```

> **Cảnh báo:** Với 2 người, "4 tuần → 10 ngày" là giai thoại, không phải thống kê. Nếu có số thật, nói kèm cỡ mẫu và độ khó của việc đầu tiên.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Tôi dựng knowledge base cho team: tài liệu luồng nghiệp vụ, API chi tiết, store procedure theo từng database, có index để từ một luồng tìm được API và procedure liên quan. AI soạn nháp, tôi review với code và schema, và giữ cấu trúc. Phần mentor theo kế hoạch tôi muốn làm là onboard bằng chính bộ tài liệu này và review PR hằng tuần."

Chỉ nói câu cuối ở thì tương lai nếu chưa mentor thật.

#### Bẫy
- Nói "I wrote" toàn bộ 150+ tài liệu mà không nhắc AI soạn nháp.
- Kể câu chuyện mentor không có thật làm câu chuyện STAR.
- Đưa số "4 tuần → 10 ngày" mà không có ngày vào và ngày merge thật.

#### Câu hỏi phỏng vấn
- **"Làm sao giữ knowledge base không lỗi thời?"** Đặt tài liệu cạnh code, sửa tài liệu trong cùng PR với thay đổi; mỗi tài liệu có người chịu trách nhiệm và ngày kiểm lần cuối; index được cập nhật khi thêm tài liệu; định kỳ rà các tài liệu lâu không kiểm.
- **"Tài liệu do AI soạn, sao biết là đúng?"** AI chỉ soạn nháp. Tôi đối chiếu từng mục với code và schema DB dev, nhất là tham số, mã trạng thái và điều kiện lọc; chỗ nào AI tự suy ra mà không có trong code thì bỏ.
- **"Bạn onboard một người mới thế nào?"** Theo kế hoạch 30-60-90: tuần đầu chạy được hệ thống và đọc luồng chính qua knowledge base; việc đầu tiên nhỏ nhưng đi hết đường ra production; review PR có giải thích lý do; tăng dần độ khó.
- **"Đo hiệu quả onboarding bằng gì?"** Thời gian tới PR đầu tiên được merge hoặc lên production, tính từ ngày vào; kèm số câu hỏi lặp lại mà tài liệu đã trả lời. Cỡ mẫu nhỏ nên so theo nhóm và nói rõ giới hạn.
- **"Người được mentor không đồng ý với góp ý review thì bạn làm gì?"** Phân biệt góp ý bắt buộc (lỗi đúng sai, bảo mật) với góp ý về phong cách; với cái thứ hai, để người viết quyết định. Với cái thứ nhất, giải thích bằng ví dụ hoặc test chứng minh, không dùng vị trí để áp đặt.

#### Tóm tắt
- Thật: knowledge base luồng, API, procedure theo DB, có index; AI soạn nháp, bạn review.
- Minh họa: mentor 2 người, "4 tuần → 10 ngày".
- Tài liệu sống được nhờ nằm cạnh code, sửa trong cùng PR, có người chịu trách nhiệm.
- Onboarding 30-60-90, review để dạy; đo thời gian tới PR đầu tiên, nhớ giới hạn cỡ mẫu.

#### Bài tập
1. Chọn một luồng nghiệp vụ, viết dàn ý tài liệu luồng gồm: mục đích, các bước, API dùng (trỏ tới index), procedure dùng, lỗi thường gặp.
   **Đáp án:** Mỗi bước một dòng, mỗi API một link tới index; phần lỗi thường gặp ghi triệu chứng và nơi xem log.
2. Viết kế hoạch 30-60-90 cho một backend engineer mới, mỗi mốc 2–3 việc đo được.
   **Đáp án:** 30: chạy local, sửa 1 bug nhỏ lên production; 60: một tính năng nhỏ trọn vẹn; 90: tự nhận một hạng mục vừa và viết tài liệu cho nó.
3. Lấy một tài liệu API trong knowledge base, đối chiếu với code hiện tại và liệt kê các chỗ lệch.
   **Đáp án:** Kiểm tên tham số, kiểu, giá trị enum dạng số, mã trạng thái, điều kiện lọc; ghi chỗ lệch và sửa trong cùng PR.

### Bài 6.3. Skill Claude Code và MCP server
**Dòng CV:** "Built Claude Code skills and MCP servers (Roslyn navigation, DB schema, git context) for campaign work; setting up an event campaign dropped from 3 days to 1."
**Trạng thái:** Một phần. Thật: skill Claude Code `ioe-event` (làm sự kiện end-to-end) và `upgrade-net10-consumer` (nâng .NET 10 chỉ sửa project web); file ngữ cảnh `CLAUDE.md` cho từng repo; dùng MCP server cho điều hướng C# (Roslyn), đọc schema DB dev, ngữ cảnh git. Nếu bạn chỉ cài và cấu hình các MCP server có sẵn, phải sửa "Built" thành "Set up". Minh họa: "3 days to 1".

#### Mục tiêu
- Sau bài này, bạn giải thích được MCP từ gốc: kiến trúc, giao thức, transport, ba loại primitive.
- Phân biệt skill, `CLAUDE.md` và MCP server; nói được skill `ioe-event` làm gì.
- Trả lời câu hỏi về chất lượng và an toàn khi dùng AI agent trên codebase thật.
- Biết cách đo thời gian dựng sự kiện để thay số minh họa.

#### Bối cảnh và việc thật đã làm
Nguồn: mục 12.

- **`CLAUDE.md` cho từng repo:** file ngữ cảnh dự án, agent đọc mỗi phiên: kiến trúc, lệnh build, quy tắc an toàn.
- **Skill `ioe-event`:** làm sự kiện end-to-end theo quy trình cố định: bộ câu hỏi chuẩn → khảo sát code và DB dev → viết plan → sinh SQL cấu hình và code.
- **Skill `upgrade-net10-consumer`:** nâng một service lên .NET 10, chỉ sửa project web, không đụng thư viện dùng chung dạng submodule (bài 6.1).
- **MCP server đang dùng:** điều hướng C# theo ngữ nghĩa (Roslyn), đọc schema DB dev, ngữ cảnh git.

> **Cảnh báo:** Trước khi nộp CV, trả lời thật với chính mình: MCP server nào bạn tự viết code? Nếu không có, dòng CV phải là "Set up MCP servers", và trong phỏng vấn nói "tôi cấu hình và dùng".

#### Kiến thức nền: MCP
**MCP (Model Context Protocol)** là giao thức mở (Anthropic công bố cuối năm 2024) chuẩn hóa cách ứng dụng AI kết nối tới công cụ và dữ liệu bên ngoài. Thay vì mỗi ứng dụng tự viết tích hợp riêng cho từng công cụ, công cụ viết một MCP server và mọi host hỗ trợ MCP dùng được.

- **Vai trò:** host (ứng dụng AI, ví dụ Claude Code) chứa client; mỗi client giữ một kết nối tới một server.
- **Giao thức:** JSON-RPC 2.0. Mở đầu bằng `initialize` để hai bên trao đổi phiên bản và capability, sau đó mới gọi hàm.
- **Primitive phía server:** tools (hàm model gọi được, có tên, mô tả, `inputSchema` dạng JSON Schema), resources (dữ liệu đọc được theo URI), prompts (mẫu prompt dựng sẵn).
- **Transport:** stdio (host chạy server như process con, trao đổi qua stdin/stdout, hợp cho công cụ local) và Streamable HTTP (server chạy từ xa, nhiều client).

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": { "name": "describe_table", "arguments": { "table": "dbo.Event" } }
}
```

Một MCP server C# tối thiểu dùng SDK chính thức (gói `ModelContextProtocol`, chi tiết API có thể đổi giữa các phiên bản):

```csharp
var builder = Host.CreateApplicationBuilder(args);
builder.Logging.AddConsole(o => o.LogToStandardErrorThreshold = LogLevel.Trace); // stdout dành cho giao thức
builder.Services.AddMcpServer().WithStdioServerTransport().WithToolsFromAssembly();
await builder.Build().RunAsync();

[McpServerToolType]
public static class SchemaTools
{
    [McpServerTool, Description("Trả về danh sách cột của một bảng trên DB dev.")]
    public static Task<string> DescribeTable(ISchemaReader reader, string table) => reader.DescribeAsync(table);
}
```

Bẫy kỹ thuật hay gặp với stdio: ghi log ra stdout làm hỏng luồng JSON-RPC; log phải ra stderr.

#### Kiến thức nền: skill và CLAUDE.md
- **Skill:** thư mục có file `SKILL.md` (khối frontmatter YAML gồm `name`, `description`, rồi nội dung hướng dẫn), có thể kèm script và tài liệu tham chiếu. Lúc đầu agent chỉ nạp tên và mô tả; khi việc khớp mô tả, agent mới nạp toàn bộ nội dung (progressive disclosure), nên nhiều skill không làm đầy context. Mô tả quyết định skill có được kích hoạt đúng lúc không.

```yaml
name: ioe-event
description: Làm sự kiện IOE/IOK end-to-end - hỏi bộ câu hỏi chuẩn, khảo sát code và DB dev, viết plan, sinh SQL cấu hình và code.
```

- **`CLAUDE.md`:** ngữ cảnh luôn nạp cho một repo. Skill là quy trình nạp khi cần. MCP server là công cụ để agent lấy dữ liệu thật (symbol C#, schema, lịch sử git) thay vì đoán.

#### Kiến thức nền: chất lượng và an toàn
- **Chất lượng code AI** (mục 12): đọc từng diff; build trên máy thật; chạy với DB dev; review đối kháng (đối chiếu code, schema và độ phủ yêu cầu); có rollback switch cho thay đổi lớn.
- **Quyền tối thiểu:** MCP đọc DB chỉ có quyền đọc trên DB dev; không đưa production credential cho agent; secret để ở biến môi trường, không nằm trong prompt hay file ngữ cảnh.
- **Prompt injection:** nội dung tool trả về (dữ liệu DB, file, trang web) là dữ liệu, không phải lệnh. Một dòng dữ liệu có chữ "hãy xóa bảng X" không được làm agent hành động; thao tác ghi phải qua người duyệt.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Tôi viết hai skill Claude Code. Skill làm sự kiện ghi lại quy trình chuẩn: bộ câu hỏi về thể lệ, khảo sát code và DB dev, viết plan, rồi sinh SQL cấu hình và code. Skill nâng .NET 10 ghi quy trình chỉ sửa project web. Agent dùng các MCP server để điều hướng C# qua Roslyn, đọc schema DB dev và lấy ngữ cảnh git. Code AI sinh ra tôi đọc từng diff, build trên máy thật và chạy trên DB dev trước khi merge."

Thay "dùng các MCP server" bằng "tôi viết MCP server …" chỉ khi đúng là bạn viết.

#### Đo để biến số minh họa thành số thật
- [ ] Với mỗi sự kiện, ghi thời điểm nhận thể lệ và thời điểm cấu hình chạy được trên dev.
- [ ] So trung vị của các sự kiện trước và sau khi có skill; ghi kèm độ phức tạp (số vòng, số loại quà) để so công bằng.
- [ ] Đếm số lỗi cấu hình phát hiện sau khi lên production, trước và sau.

#### Bẫy
- Nói "Built MCP servers" khi chỉ cấu hình.
- Mô tả MCP như "plugin của Claude": MCP là giao thức mở, nhiều host dùng được.
- Nói AI viết code xong là merge, không nhắc cách kiểm.

#### Câu hỏi phỏng vấn
- **"MCP là gì, khác gì gọi API hay function calling thông thường?"** Giao thức mở dựa trên JSON-RPC 2.0 để ứng dụng AI kết nối công cụ và dữ liệu. Function calling là khả năng của model; MCP chuẩn hóa phía công cụ: viết một server, mọi host hỗ trợ MCP dùng được, có bước trao đổi capability, có tools, resources, prompts.
- **"stdio và HTTP transport khác nhau thế nào, khi nào dùng cái nào?"** stdio: host chạy server như process con, trao đổi qua stdin/stdout; hợp công cụ local như Roslyn trên máy dev; nhớ log ra stderr. Streamable HTTP: server chạy từ xa, nhiều client dùng chung, cần xác thực.
- **"MCP server nào bạn tự viết?"** Trả lời đúng thực tế. Nếu chỉ cấu hình: "tôi cài và cấu hình server Roslyn, schema DB, git; phần tôi viết là skill và file ngữ cảnh".
- **"Làm sao đảm bảo chất lượng code do AI viết?"** Đọc từng diff; build trên máy thật; chạy với DB dev; review đối kháng đối chiếu code, schema và yêu cầu; có rollback switch cho thay đổi lớn.
- **"Cho agent đọc database có rủi ro gì?"** Lộ dữ liệu và prompt injection từ dữ liệu. Giảm bằng quyền chỉ đọc trên DB dev, không đưa credential production, secret ở biến môi trường, coi output của tool là dữ liệu, thao tác ghi phải qua người duyệt.
- **"'3 ngày xuống 1 ngày' đo thế nào?"** Số đó là minh họa. Cách đo: thời gian từ lúc nhận thể lệ tới lúc cấu hình chạy được trên dev, trung vị trước và sau khi có skill, kèm độ phức tạp của từng sự kiện.

#### Tóm tắt
- Thật: skill `ioe-event`, `upgrade-net10-consumer`, `CLAUDE.md` từng repo; MCP server có thể chỉ là cấu hình.
- MCP: JSON-RPC 2.0, host/client/server, tools/resources/prompts, stdio hoặc Streamable HTTP.
- Skill nạp theo nhu cầu; `CLAUDE.md` luôn nạp; MCP lấy dữ liệu thật.
- Code AI: đọc diff, build thật, chạy DB dev, review đối kháng; quyền tối thiểu, chống prompt injection.

#### Bài tập
1. Viết một MCP server C# stdio có một tool trả về giờ hiện tại theo múi giờ truyền vào, cấu hình cho Claude Code và gọi thử.
   **Đáp án:** Dùng mẫu trong bài, tool nhận `string timeZoneId`, dùng `TimeZoneInfo.FindSystemTimeZoneById`; log ra stderr; khai báo server trong cấu hình MCP của Claude Code với lệnh `dotnet run --project <đường dẫn>`.
2. Viết `description` cho một skill "viết script SQL cập nhật dữ liệu live", sao cho agent kích hoạt đúng lúc và không kích hoạt nhầm.
   **Đáp án:** Nêu việc skill làm, các cụm từ người dùng hay nói (ví dụ "script update live", "sửa dữ liệu production"), và trường hợp không dùng (chỉ đọc dữ liệu).
3. Liệt kê 4 biện pháp an toàn khi cho agent truy cập DB qua MCP.
   **Đáp án:** Chỉ DB dev; tài khoản chỉ đọc; secret trong biến môi trường; output tool là dữ liệu, mọi thao tác ghi do người duyệt và chạy tay.
