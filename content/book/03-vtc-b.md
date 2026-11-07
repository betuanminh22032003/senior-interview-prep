## Chương 5. Dữ liệu, định danh, realtime và AI

Chương này gom bốn mảng việc khác nhau ở VTC Online: kho dữ liệu báo cáo cho khách hàng là các Sở Giáo dục, đăng nhập một lần cho nhiều sản phẩm, bảng xếp hạng realtime cho chế độ đấu đối kháng, và luồng AI soạn nháp dữ liệu có người duyệt. Người phỏng vấn senior thích những chủ đề này vì mỗi chủ đề kéo theo một chuỗi câu hỏi đào sâu: message bị gửi lại thì sao, cookie và token nằm ở đâu thì an toàn, số thực có đủ chính xác không, và "làm sao anh biết AI đúng".

Mức độ đã làm của bốn bài không giống nhau. Có bài bạn làm trọn, có bài bạn làm một phần trên nền đồng nghiệp đã dựng, có bài mới dừng ở mức hiểu và thiết kế. Mỗi bài chỉ rõ ranh giới đó và dạy cách nói trung thực mà vẫn cho thấy hiểu sâu.

### Bài 5.1. Pipeline báo cáo: từ job tổng hợp định kỳ tới CDC, Kafka và ClickHouse

#### Kiến thức

##### Vấn đề: báo cáo tổng hợp trên database giao dịch

Dashboard quản lý ("điểm trung bình theo xã") là truy vấn tổng hợp quét nhiều dòng; chạy thẳng trên database giao dịch thì chậm và tranh tài nguyên với luồng thi. Cách phổ biến nhất là **tính sẵn**: job định kỳ tổng hợp vào các bảng báo cáo nhỏ, API chỉ đọc bảng đã tính.

Hệ thống ở VTC chạy đúng như vậy: một SQL Server Agent job mỗi giờ lặp qua từng Sở đang hoạt động, `MERGE` vào schema báo cáo riêng. Bảng nguồn truy cập qua **synonym** (tên thay thế trỏ sang database khác, đổi nơi chứa không phải sửa procedure). Mỗi bước có `TRY/CATCH` và ghi trạng thái riêng, một bước lỗi không kéo đổ cả job.

##### Nạp incremental theo high-water mark

Thay vì đọc lại toàn bộ, job nhớ giá trị lớn nhất đã nạp (id hoặc thời điểm cập nhật) và lần sau chỉ lấy phần mới hơn, chia lô để mỗi transaction nhỏ:

```sql
DECLARE @from BIGINT = (SELECT LastId FROM rpt.LoadState WHERE Name = N'Result');
DECLARE @to   BIGINT = (SELECT MAX(Id) FROM src.Result WHERE Id > @from AND Id <= @from + 50000);
-- MERGE dòng trong (@from, @to] vào bảng báo cáo, rồi cập nhật LoadState trong cùng transaction
```

Điểm yếu cần biết: high-water mark theo id không thấy **dòng cũ bị sửa hoặc bị xóa**. Muốn bắt được thì dùng cột `rowversion` hoặc thời điểm cập nhật, còn xóa thì phải có xóa mềm hoặc cơ chế như CDC.

##### Giới hạn của cách tính sẵn

- Dữ liệu trễ tối đa bằng chu kỳ job (ở đây khoảng một giờ, nghiệp vụ chấp nhận cho dashboard quản lý).
- Logic nằm trong SQL nên khó viết test, khó review bằng diff.
- Bảng rowstore phải đọc cả dòng dù chỉ cần vài cột, nên khi dữ liệu lớn truy vấn tổng hợp chậm dần.

##### Hướng nâng cấp: CDC → Debezium → Kafka → ClickHouse

- **SQL Server CDC:** capture job đọc transaction log, ghi mỗi thay đổi vào bảng change kèm LSN (vị trí trong log). Có ở Standard Edition từ 2016 SP1; cleanup job xóa dữ liệu change sau 3 ngày theo mặc định.
- **Debezium** (chạy trên Kafka Connect) poll bảng change: snapshot lần đầu rồi stream, lưu LSN đã đọc nên restart đọc tiếp đúng chỗ. Mỗi bảng một topic, key là khóa chính nên thay đổi của một dòng giữ thứ tự.
- **ClickHouse** là database cột: truy vấn tổng hợp chỉ đọc và giải nén các cột cần. Đường nạp phổ biến: bảng `Kafka` engine → materialized view → bảng `ReplacingMergeTree`.

```sql
CREATE TABLE result
(
    result_id UInt64, province_id UInt32, score Float32,
    row_ver UInt64, is_deleted UInt8
)
ENGINE = ReplacingMergeTree(row_ver, is_deleted)
ORDER BY (province_id, result_id);

-- Đọc chính xác: khử trùng lúc đọc
SELECT province_id, count() AS results, avg(score) AS avg_score
FROM result FINAL
WHERE is_deleted = 0
GROUP BY province_id;
```

`ReplacingMergeTree` chỉ giữ bản có version lớn nhất **khi merge nền**, và chỉ trong cùng partition. Trước khi merge, truy vấn vẫn thấy bản trùng, nên truy vấn cần chính xác dùng `FINAL` hoặc `argMax(col, row_ver)`. Version phải tăng đơn điệu theo dòng (LSN, hoặc `rowversion` đổi sang số). Cột trong `ORDER BY` không được đổi giá trị, nếu không bản cũ và bản mới khác khóa và không bao giờ thay nhau.

> **Ghi nhớ:** Pipeline này là at-least-once cộng ghi idempotent, không phải exactly-once. Message có thể được gửi lại sau sự cố; tính đúng đến từ việc ghi lại cùng dòng, cùng version cho cùng kết quả.

##### Rủi ro và phương án thay thế

> **Cảnh báo:** Nếu capture job CDC dừng, transaction log không truncate được (`log_reuse_wait_desc = REPLICATION`), log phình tới khi đầy ổ và database ngừng ghi. Phải cảnh báo trên trạng thái job và dung lượng log.

Ngoài ra: đổi schema nguồn cần capture instance mới; thêm Kafka Connect và ClickHouse là thêm hạ tầng phải trực.

| Phương án | Được | Mất |
|---|---|---|
| Chạy job dày hơn | Không thêm gì | Tải nguồn tăng, vẫn trễ theo chu kỳ |
| Columnstore index trên SQL Server | Nén cột, batch mode, không thêm hạ tầng | Standard Edition giới hạn bộ nhớ columnstore và độ song song |
| CDC → Kafka → ClickHouse | Dữ liệu tươi tính bằng giây, tổng hợp nhanh trên dữ liệu lớn | Nhiều thành phần vận hành nhất |

#### Cách show off

Câu chuyện thật là kho báo cáo bằng job định kỳ, không phải pipeline CDC. Production mới có một Sở đối tác, đừng nói "hàng triệu học sinh". Phần C# (API báo cáo, phạm vi Sở/xã/trường suy ra từ token, cache Redis) chắc chắn là của bạn; phần SQL chỉ nhận đúng mức bạn đã viết.

Mạch kể: Sở cần số tổng hợp → tính sẵn bằng Agent job vì set-based cạnh dữ liệu, không thêm hạ tầng → biết rõ giới hạn → đã nghiên cứu CDC nhưng chưa làm vì quy mô chưa cần.

> **Ví dụ:** "Bên tôi có kho báo cáo cho các Sở Giáo dục. Dashboard cần số tổng hợp theo xã, theo trường, nên tôi không cho nó chạy thẳng trên database thi mà tính sẵn bằng một job mỗi giờ, nạp phần mới theo mốc đã nạp và chia lô nhỏ. API phía C# lấy phạm vi Sở, xã, trường từ token nên người dùng chỉ thấy dữ liệu của mình. Cái giá là dữ liệu trễ tới một giờ, nghiệp vụ chấp nhận được. Tôi có tìm hiểu hướng CDC qua Debezium vào ClickHouse để có dữ liệu gần realtime, nhưng ở dự án chưa triển khai. Nếu phải làm, tôi sẽ thử columnstore trên SQL Server trước, vì hiện mới một Sở; ClickHouse chỉ đáng khi dữ liệu và số dashboard vượt sức SQL Server."

Điểm ăn điểm:

- Nói được giới hạn của chính giải pháp mình làm (trễ, khó test, high-water mark không thấy dòng bị sửa).
- Đề xuất phương án rẻ nhất trước (columnstore, chạy job dày hơn) rồi mới tới kiến trúc mới.
- Nhắc rủi ro vận hành của CDC (log đầy) và nói đúng at-least-once cộng idempotent.

#### Câu hỏi vặn

- **"Sao không dùng columnstore index cho đơn giản?"** Nên thử trước. Columnstore cho nén cột và batch mode ngay trên SQL Server, không thêm hạ tầng; đạt mục tiêu thì dừng ở đó. ClickHouse chỉ đáng khi dữ liệu, số dashboard hoặc yêu cầu độ tươi vượt khả năng của SQL Server, nhất là với giới hạn bộ nhớ và độ song song của Standard Edition.
- **"Job lỗi giữa chừng thì dữ liệu báo cáo có bị nửa vời không?"** Mỗi bước có `TRY/CATCH` và ghi trạng thái riêng; mốc đã nạp chỉ được cập nhật cùng transaction với lô dữ liệu, nên lần chạy sau nạp lại đúng lô bị hỏng. Một Sở lỗi không chặn các Sở khác.
- **"Dòng cũ bị sửa thì high-water mark có bắt được không?"** Theo id thì không. Phải dùng `rowversion` hoặc cột thời điểm cập nhật làm mốc, còn dòng bị xóa thì cần xóa mềm hoặc CDC. Đây là giới hạn tôi nói rõ khi chọn cách nạp này.
- **"Capture job CDC dừng một đêm thì chuyện gì xảy ra?"** Log không truncate được, `log_reuse_wait_desc` báo `REPLICATION`, log phình tới khi đầy ổ. Cần cảnh báo trên trạng thái job và dung lượng log. Khi chạy lại, Debezium đọc tiếp từ LSN đã lưu, miễn cleanup job chưa xóa dữ liệu đó.
- **"Dòng bị xóa ở nguồn thì ClickHouse biết thế nào?"** Debezium phát sự kiện xóa; dùng SMT `ExtractNewRecordState` chế độ rewrite thì nó thành dòng có cờ `__deleted`, phía ClickHouse map sang `is_deleted` của `ReplacingMergeTree(ver, is_deleted)`.
- **"Pipeline CDC này anh đã chạy production chưa?"** Chưa. Thứ đang chạy là kho báo cáo bằng Agent job. Tôi trình bày được thiết kế CDC và rủi ro của nó, và nếu làm tôi sẽ bắt đầu bằng một PoC đo cùng truy vấn dashboard trên cùng khối dữ liệu.

#### Bẫy cần tránh

- Kể pipeline CDC như việc đã làm. Nói "đã nghiên cứu, chưa triển khai" và chuyển sang phần đang chạy thật.
- Quên rằng `ReplacingMergeTree` không khử trùng ngay; báo cáo đếm thiếu `FINAL` sẽ đếm dư.
- Đề xuất ClickHouse cho quy mô một Sở mà không so với columnstore.

#### Nhớ nhanh

- Đang chạy thật: job mỗi giờ tính sẵn theo từng Sở, nạp incremental theo mốc, lỗi từng bước được cô lập.
- Giới hạn: trễ theo chu kỳ, logic SQL khó test, high-water mark theo id không thấy dòng bị sửa.
- CDC → Debezium → Kafka → ClickHouse là at-least-once; `ReplacingMergeTree` cần `FINAL` hoặc `argMax` khi đọc.
- Luôn so columnstore trước ClickHouse; rủi ro lớn nhất của CDC là log đầy.

#### Bài tập

1. Viết phần "Phương án thay thế" (nửa trang) cho dashboard của một Sở, kết luận chọn gì ở quy mô hiện tại.
   **Đáp án:** Chọn chạy job dày hơn hoặc columnstore. Ghi điều kiện chuyển sang CDC → ClickHouse, ví dụ thời gian phản hồi dashboard đo được vượt mục tiêu trên dữ liệu thật, hoặc nghiệp vụ cần dữ liệu tươi dưới vài phút.
2. Bảng `ReplacingMergeTree(ver)` có 3 bản chưa merge của cùng `result_id = 42`: (ver 1, score 5), (ver 3, score 8), (ver 2, score 7). Viết truy vấn trả điểm đúng.
   **Đáp án:** `SELECT argMax(score, ver) FROM result WHERE result_id = 42;` hoặc `SELECT score FROM result FINAL WHERE result_id = 42;`. Kết quả 8.

### Bài 5.2. Đăng nhập một lần: OAuth 2.0, OIDC, PKCE và BFF

#### Kiến thức

##### OAuth 2.0 và OpenID Connect

**OAuth 2.0** là giao thức ủy quyền: client xin access token để gọi API thay mặt người dùng. **OpenID Connect (OIDC)** thêm lớp định danh: scope `openid`, `id_token` (JWT mô tả ai đã đăng nhập), discovery, `nonce`. SSO nghĩa là nhiều app cùng tin một identity server; đăng nhập một lần ở đó thì app khác lấy được phiên mà không hỏi lại mật khẩu.

##### Authorization Code + PKCE

1. Client sinh `code_verifier` ngẫu nhiên, tính `code_challenge = BASE64URL(SHA256(code_verifier))`, kèm `state` ngẫu nhiên để chống CSRF ở bước callback.
2. Redirect tới `/authorize?response_type=code&code_challenge=...&code_challenge_method=S256&state=...`.
3. Identity server xác thực, lưu challenge cùng `code`, redirect về client kèm `code`.
4. Client gọi `/token` với `code` và `code_verifier`; server băm lại và so với challenge.

Kẻ chặn được `code` (qua log, lịch sử trình duyệt, app độc trên điện thoại) không có verifier nên không đổi được token. SPA và app di động là **public client**: mã chạy trên máy người dùng nên không giữ được `client_secret`, PKCE thay vai trò đó. Chế độ `plain` (challenge bằng verifier) chỉ để tương thích client cũ.

```csharp
string verifier  = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32)); // 43 ký tự
string challenge = WebEncoders.Base64UrlEncode(SHA256.HashData(Encoding.ASCII.GetBytes(verifier)));
```

##### Hai mô hình giữ token: BFF và SPA stateless

**BFF (Backend for Frontend)** là confidential client đứng giữa trình duyệt và API. Token nằm ở server; trình duyệt chỉ có cookie `HttpOnly`, `Secure`, `SameSite=Lax`. Request đi qua BFF, reverse proxy (YARP) gắn access token rồi chuyển tiếp. Trong ASP.NET Core, hai mảnh quan trọng là `CookieAuthenticationOptions.SessionStore` (ticket store) và `AddDataProtection().PersistKeysToStackExchangeRedis(...)` (key ring dùng chung).

- **Ticket store:** cookie chỉ chứa khóa, phiên nằm trên Redis; thu hồi phiên bằng cách xóa key, không lộ claim.
- **Key ring dùng chung:** nhiều pod phải chung data protection key, nếu không pod B không giải mã được cookie pod A tạo và người dùng bị đăng xuất ngẫu nhiên.

**SPA stateless:** PKCE sinh bằng Web Crypto ngay trong trình duyệt, token để trong `sessionStorage`, các tab đồng bộ đăng nhập/đăng xuất bằng `BroadcastChannel`. Đổi lại: không cần BFF, không bị CSRF (token không tự đi kèm request như cookie), tự xóa khi đóng tab; nhưng có XSS là lộ token. App xử lý dữ liệu nhạy cảm nên đi qua BFF.

##### Silent SSO và cookie bên thứ ba

Cách cũ là iframe ẩn gọi `/authorize?prompt=none`. Iframe cần cookie của identity server trong ngữ cảnh bên thứ ba, mà Safari và Firefox chặn cookie bên thứ ba. Redirect cả trang là ngữ cảnh bên thứ nhất nên cookie vẫn được gửi: có phiên thì nhận `code` ngay, không có thì quay về trang cũ thay vì hiện form.

##### Cookie, CSRF, CORS, JWT

- **`SameSite=Lax`** chặn cookie trên POST từ site khác nhưng vẫn gửi khi điều hướng GET cấp cao nhất; các subdomain cùng domain là same-site. Vì vậy vẫn cần antiforgery token và mọi thao tác đổi trạng thái phải là POST.
- **CORS:** trình duyệt từ chối `Access-Control-Allow-Origin: *` khi request mang credentials; ASP.NET Core cũng không cho `AllowAnyOrigin()` đi cùng `AllowCredentials()`. Allow-list theo config là cách đúng.
- **Kiểm JWT:** chữ ký qua JWKS, kiểm `iss`, `aud`, `exp`, cố định thuật toán để chặn `alg: none`; `ClockSkew` mặc định 5 phút nên hạ xuống. Access token ngắn, refresh token xoay vòng mỗi lần dùng.
- **Logout nhiều app:** kết thúc phiên ở identity server rồi báo các app khác bằng front-channel hoặc back-channel logout; các tab trong một app đồng bộ bằng `BroadcastChannel`.

#### Bối cảnh dự án

Hệ sinh thái có nhiều sản phẩm học và thi trực tuyến (IOE là hệ thống thi tiếng Anh, cùng các sản phẩm anh em như IOSTEM) dùng chung một identity server, đứng trước là một BFF viết bằng ASP.NET Core và YARP. **Lõi BFF có sẵn khi bạn vào, do đồng nghiệp viết**: cookie `HttpOnly`, ticket trên Redis, data protection key trên Redis, antiforgery, PKCE, authorization code dùng một lần.

Phần của bạn:

- **Hardening BFF:** CORS allow-list đọc từ config; cookie "ghi nhớ đăng nhập" 7 ngày; endpoint liên quan token chuyển sang POST để token không nằm trong URL và log; cờ bật Cloudflare Turnstile.
- **IOSTEM:** SSO kiểu SPA stateless, PKCE trong trình duyệt, đồng bộ tab bằng `BroadcastChannel`.
- **IOE web:** silent SSO bằng redirect cả trang, cooldown vài giây sau logout, cờ chống vòng lặp redirect, đổi token ở server.
- **Tích hợp CRM:** token mã hóa RSA-OAEP kèm timestamp, lệch quá ±5 phút thì từ chối.

> **Cảnh báo:** Config CORS hiện vẫn để `"*"`; sửa trước khi đem phần hardening ra kể. Ở tích hợp CRM, tự nhận ba điểm yếu: private key nằm trong file config (nên vào secret store), padding OAEP-SHA1 (nên lên SHA-256), cửa sổ thời gian không có nonce nên vẫn replay được trong cửa sổ đó.

#### Cách show off

Mạch kể: lõi có sẵn → bạn thấy lỗ hổng gì và vá → mỗi loại client cần một cách SSO khác nhau, vì sao → bài học về ranh giới bảo mật.

> **Ví dụ:** "Phần lõi BFF, gồm PKCE và lưu phiên trên Redis, đồng nghiệp đã dựng trước khi tôi vào. Việc của tôi có hai mảng. Một là siết BFF lại: CORS theo danh sách cho phép, chuyển các endpoint liên quan token sang POST để token không lọt vào URL và log, thêm cờ bật captcha. Hai là đưa các client vào SSO. IOSTEM là SPA nên tôi làm PKCE ngay trong trình duyệt và đồng bộ các tab bằng BroadcastChannel. IOE web thì tôi bỏ cách iframe ẩn, vì Safari chặn cookie bên thứ ba, chuyển sang redirect cả trang, kèm cờ chống vòng lặp và một khoảng nghỉ sau logout để người dùng không bị tự đăng nhập lại. Bài học tôi rút ra là SSO hỏng thường không nằm ở giao thức mà ở các ca biên như logout và nhiều tab."

Điểm ăn điểm:

- Tự nói ranh giới phần đồng nghiệp với phần mình trước khi bị hỏi.
- Giải thích vì sao hệ thống có cả BFF lẫn SPA stateless, và đánh đổi XSS với CSRF của từng cách.
- Biết `SameSite=Lax` chưa đủ chống CSRF; tự nêu điểm yếu của tích hợp CRM và cách chuẩn hơn.

Đừng nói "ticket hỗ trợ giảm X%": chưa có số đo. Bị hỏi thì nói cách đo: gắn nhãn ticket theo loại, so vài tuần trước và sau, chia cho số người dùng hoạt động.

#### Câu hỏi vặn

- **"`SameSite=Lax` đã đủ chống CSRF chưa?"** Chưa. Lax vẫn gửi cookie khi điều hướng GET cấp cao nhất, nên endpoint GET có tác dụng phụ vẫn bị khai thác, và subdomain cùng site không bị chặn. Vì vậy BFF bật thêm antiforgery token và mọi thao tác đổi trạng thái dùng POST.
- **"Sao dùng PKCE mà không dùng client secret?"** SPA và app di động là public client, mã nằm trên máy người dùng nên không giữ được secret. PKCE ràng buộc `code` với verifier chỉ client đó biết. Dùng S256; `plain` chỉ để tương thích client cũ và nên có kế hoạch bỏ.
- **"BFF giữ token ở server, vậy sao IOSTEM lại để token trong `sessionStorage`?"** Hai mô hình cho hai loại app. SPA stateless không cần BFF, không bị CSRF, token tự xóa khi đóng tab, nhưng có XSS là lộ token, nên phải có CSP và vệ sinh input. Với dữ liệu nhạy cảm hơn tôi sẽ đưa app đó qua BFF.
- **"Silent SSO bằng iframe có gì sai?"** Iframe là ngữ cảnh bên thứ ba, Safari và Firefox chặn cookie của identity server trong đó, nên silent login hỏng âm thầm. Redirect cả trang là ngữ cảnh bên thứ nhất. Cái giá là một lần chuyển trang, và phải có cờ chống vòng lặp khi identity server trả về "chưa đăng nhập".
- **"Tích hợp CRM bằng RSA-OAEP cộng timestamp có an toàn không?"** Chống được đọc trộm và replay ngoài cửa sổ thời gian, nhưng trong cửa sổ đó vẫn replay được vì không có nonce, key đang nằm trong config, và padding SHA1 đã cũ. Cách chuẩn hơn là OAuth client credentials hoặc mTLS; nếu giữ cách hiện tại thì thêm nonce lưu Redis trong đúng độ dài cửa sổ.
- **"Phần nào trong SSO là của anh?"** Lõi BFF là của đồng nghiệp. Tôi làm hardening BFF, SSO cho IOSTEM và IOE web, và xác thực service-to-service với CRM.

#### Bẫy cần tránh

- Nhận cả lõi PKCE và ticket store là của mình.
- Nói "token chỉ nằm ở server" rồi bị hỏi IOSTEM để token ở đâu.
- Khoe CORS allow-list trong khi config production đang `"*"`.
- Gọi RSA-OAEP là "giao thức xác thực". Nó chỉ là lớp mã hóa token cộng cửa sổ thời gian.

#### Nhớ nhanh

- Lõi BFF có sẵn; phần của bạn là hardening, SSO cho IOSTEM và IOE web, xác thực CRM.
- PKCE: `challenge = BASE64URL(SHA256(verifier))`, thay client secret cho public client.
- BFF: token ở server, cookie `HttpOnly`, phiên trên Redis, key ring dùng chung giữa pod.
- `SameSite=Lax` chưa đủ, cần antiforgery; CORS `*` không đi với credentials.
- Silent SSO bằng redirect cả trang vì cookie bên thứ ba bị chặn trong iframe.

#### Bài tập

1. Liệt kê 4 thứ phải dùng chung để BFF chạy đúng khi scale từ 1 lên 3 pod.
   **Đáp án:** Data protection key ring (Redis) cùng application name; ticket store (Redis); authorization code (Redis, không giữ trong memory); CORS allow-list và cookie domain giống nhau trên mọi pod.
2. Viết lại cấu hình CORS từ `"*"` sang allow-list đọc từ config, có credentials.
   **Đáp án:** `policy.WithOrigins(config.GetSection("Cors:Origins").Get<string[]>()!).AllowCredentials().AllowAnyHeader().WithMethods("GET", "POST");`.

### Bài 5.3. Bảng xếp hạng realtime bằng Kafka và Redis sorted set

#### Kiến thức

##### Hai kiểu bảng xếp hạng

**Tính sẵn** (job định kỳ tính hạng, API chỉ đọc) rẻ khi đọc nhưng trễ bằng chu kỳ job, hợp bảng lớn theo trường, tỉnh, nơi không ai cần hạng đổi từng giây. **Realtime** (mỗi lần điểm đổi thì cập nhật cấu trúc giữ thứ tự sẵn) hợp trận đấu, mùa giải ngắn, nơi người chơi muốn thấy mình lên hạng ngay.

##### Redis sorted set chạy thế nào

Sorted set lưu cặp (member, score), member duy nhất, sắp theo score; cùng score thì sắp theo thứ tự từ điển của member. Bên dưới là một hash table (member → score, tra điểm O(1)) cộng một skiplist có đếm span, nên tính hạng O(log N). Set nhỏ dùng encoding listpack gọn hơn.

| Lệnh | Việc | Độ phức tạp |
|---|---|---|
| `ZADD key [GT] score member` | Thêm hoặc cập nhật điểm | O(log N) |
| `ZREVRANGE key 0 9 WITHSCORES` | Top 10 | O(log N + M) |
| `ZREVRANK key member` | Hạng, đếm từ 0 | O(log N) |
| `ZSCORE key member` | Điểm | O(1) |

```bash
ZADD lb:season12 GT 1520 "u:1001"
ZREVRANGE lb:season12 0 9 WITHSCORES
ZREVRANK lb:season12 "u:1001"      # 0 nghĩa là hạng 1
```

##### Kafka ở giữa và tính idempotent

Kafka tách nơi sinh điểm khỏi Redis: trận đấu không chờ Redis, consumer chết thì sự kiện vẫn nằm trong topic. Hai điều phải nắm:

- **Thứ tự chỉ giữ trong một partition.** Đặt key theo trận hoặc theo người chơi để sự kiện của cùng một đối tượng không bị đảo.
- **Consumer commit offset sau khi xử lý là at-least-once**, nên một message có thể được xử lý hai lần. `ZINCRBY` cộng dồn thì điểm tăng gấp đôi. `ZADD` với **điểm tuyệt đối** là idempotent; thêm `GT` để sự kiện cũ đến muộn không ghi đè điểm mới cao hơn.

`GT` chỉ đúng khi điểm chỉ tăng. Nếu điểm có thể giảm, lưu version mới nhất của mỗi người trong một hash và dùng script Lua để "so version rồi mới `ZADD`" thành một thao tác nguyên tử. Trên Redis Cluster, các key trong một script phải cùng hash slot: dùng hash tag như `{lb:s12}` và `{lb:s12}:ver`.

##### Phá hòa điểm và giới hạn của double

Score là số double, chỉ biểu diễn chính xác số nguyên tới 2^53 (khoảng 9 × 10^15). Muốn "bằng điểm thì ai đạt trước xếp trên", có thể mã hóa hai giá trị vào một số:

`score = points × T + (T − 1 − giây_kể_từ_đầu_mùa)`

Điều kiện: `points × T < 2^53`. Nếu nhồi thẳng epoch giây (khoảng 1,7 × 10^9) thì T phải là 10^10 và điểm tối đa chỉ còn khoảng 900, quá nhỏ; nhồi epoch mili giây thì còn tệ hơn. Dùng giây kể từ đầu mùa: mùa 100 ngày cần T = 10^7, điểm tối đa khoảng 9 × 10^8, đủ dùng.

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
```

> **Mẹo:** Nếu không chắc giới hạn điểm, đừng ép mọi thứ vào double. Giữ score là điểm thuần, rồi phá hòa ở tầng ứng dụng: lấy dư vài phần tử quanh vị trí cần đọc và sắp lại theo thời gian lưu trong hash riêng.

##### Mất dữ liệu, hot key, bộ nhớ

- **Redis mất dữ liệu:** database là nguồn sự thật. Dựng lại từ DB bằng `ZADD` theo lô, hoặc replay Kafka nếu retention đủ dài; trong lúc dựng API báo "đang cập nhật".
- **Hot key:** một key nằm trên một shard. Lệnh O(log N) nhẹ nên vài nghìn lệnh mỗi giây không là vấn đề; lớn hơn thì chia key theo phòng hoặc mùa, cache top-N trong memory API khoảng một giây.
- **Bộ nhớ:** mỗi member cỡ vài chục tới 100 byte, vài chục nghìn người chơi chỉ vài MB (`MEMORY USAGE key`).

#### Bối cảnh dự án

Hệ thống có hai loại bảng xếp hạng, đừng trộn khi kể. Bảng xếp hạng trên trang chủ học sinh (theo trường, xã, tỉnh, toàn quốc) được **tính sẵn** bằng job SQL trong kho dữ liệu; job đó không phải của bạn, API chỉ đọc ra và giới hạn top-N để payload nhỏ. Còn **chế độ đấu đối kháng của IOM** (một sản phẩm trong cùng hệ sinh thái, hai học sinh đấu trực tiếp với nhau) thì bạn code toàn bộ luồng: sự kiện điểm vào Kafka, consumer cập nhật Redis sorted set, API đọc top-N và hạng của người chơi.

> **Cảnh báo:** Các chi tiết như partition key, `ZADD GT` hay `ZINCRBY`, cách phá hòa điểm ở trên là thiết kế theo best practice. Trước buổi phỏng vấn, mở lại code bạn đã viết và nói đúng code. Nếu code dùng `ZINCRBY`, nói vậy và nói luôn rủi ro khi message bị gửi lại, kèm cách bạn sẽ sửa.

#### Cách show off

Mạch kể: chế độ đấu cần thấy hạng ngay → không thể tính hạng bằng SQL mỗi request → chọn sorted set vì hạng là O(log N), Kafka ở giữa để tách phía ghi → ba câu khó đã nghĩ tới: hòa điểm, message gửi lại, Redis mất dữ liệu.

> **Ví dụ:** "Ở chế độ đấu đối kháng của IOM, người chơi muốn thấy mình lên hạng ngay sau trận, nên tôi không tính hạng bằng SQL mà dùng Redis sorted set: lấy hạng của một người hay top 10 đều là thao tác logarit. Điểm sau mỗi trận được bắn vào Kafka, một consumer cập nhật Redis, nên trận đấu không phải chờ Redis và consumer chết thì sự kiện vẫn còn trong topic. Chỗ tôi phải cẩn thận là Kafka có thể giao lại một message, nên ghi điểm phải idempotent, ghi điểm tuyệt đối chứ không cộng dồn. Database vẫn là nguồn sự thật, Redis mất thì dựng lại từ đó. Về tải, tôi chỉ có ước lượng vài nghìn tới chục nghìn người chơi cùng lúc, chưa có số đo chính thức."

Điểm ăn điểm:

- Phân biệt rõ khi nào tính sẵn, khi nào realtime, thay vì nói "realtime luôn tốt hơn".
- Nói được at-least-once và vì sao `ZINCRBY` nguy hiểm.
- Tự nhắc giới hạn 2^53 khi mã hóa score.
- Nói rõ số người chơi là ước lượng. Bị hỏi độ trễ cập nhật hạng thì nói cách đo: histogram của (lúc `ZADD` xong − timestamp sự kiện), đồng hồ các máy đồng bộ NTP.

#### Câu hỏi vặn

- **"Hai người bằng điểm thì xếp thế nào?"** Mặc định Redis xếp theo thứ tự từ điển của member, không có ý nghĩa nghiệp vụ. Tôi mã hóa điểm và thời điểm đạt điểm vào một score, ai đạt trước xếp trên, dùng giây kể từ đầu mùa để không vượt 2^53. Nếu giới hạn điểm không chắc, tôi phá hòa ở tầng ứng dụng thay vì nhồi vào double.
- **"Kafka gửi trùng message thì điểm có bị cộng hai lần không?"** Với `ZINCRBY` thì có. Cách đúng là `ZADD` điểm tuyệt đối, thêm `GT` để sự kiện cũ đến muộn không ghi đè; nếu điểm có thể giảm thì so version trong script Lua, hoặc dedupe theo id sự kiện.
- **"Redis mất dữ liệu thì sao?"** Database là nguồn sự thật. Dựng lại từ DB theo lô hoặc replay Kafka nếu retention đủ. Trong lúc dựng API báo đang cập nhật; định kỳ đối soát top-N giữa Redis và DB để bắt lệch sớm.
- **"Sao không cập nhật Redis thẳng từ API mà phải qua Kafka?"** Gọi thẳng thì đơn giản hơn và ít độ trễ hơn. Qua Kafka thì trận đấu không phụ thuộc Redis còn sống, có thể replay khi cần dựng lại, và nhiều consumer khác (thống kê, thông báo) đọc cùng sự kiện. Cái giá là thêm một thành phần và phải xử lý giao lại.
- **"Sao bảng xếp hạng trang chủ lại không làm realtime?"** Bảng đó có nhiều phạm vi và rất nhiều bản ghi, mà không ai cần thấy hạng đổi từng giây, nên tính sẵn đổi độ tươi lấy chi phí đọc thấp. Job đó không phải của tôi. Nếu cần realtime thì dùng cùng cách như IOM, mỗi phạm vi một key.
- **"Con số người chơi cùng lúc anh lấy ở đâu?"** Đó là ước lượng của tôi, chưa đo. Muốn đo thật tôi sẽ lấy số người khác nhau gửi điểm trong phút cao nhất, hoặc số kết nối đang mở lúc cao điểm từ monitoring.

#### Bẫy cần tránh

- Dùng epoch trong công thức phá hòa điểm mà không tính giới hạn 2^53.
- Nói `ZINCRBY` mà không nhắc rủi ro message gửi lại.
- Gộp bảng xếp hạng tính sẵn (không phải của bạn) vào câu chuyện IOM.

#### Nhớ nhanh

- Sorted set là hash table cộng skiplist; `ZADD`, `ZREVRANK` O(log N).
- Kafka giữ thứ tự trong partition và giao at-least-once; ghi Redis phải idempotent.
- `ZADD` điểm tuyệt đối (kèm `GT`) an toàn khi gửi lại, `ZINCRBY` thì không.
- Phá hòa điểm bằng mã hóa score chỉ khi đã tính giới hạn 2^53.
- Database là nguồn sự thật; Redis dựng lại được từ DB hoặc Kafka.

#### Bài tập

1. Với T = 10^7, tính score của người đạt 1.520 điểm ở giây 3.600 của mùa, và kiểm tra người đạt 1.520 điểm ở giây 7.200 xếp dưới.
   **Đáp án:** 1520 × 10^7 + 9.999.999 − 3.600 = 15.209.996.399; người sau là 15.209.992.799, nhỏ hơn nên xếp dưới.
2. Viết consumer giả lập nhận cùng một sự kiện hai lần, so kết quả khi dùng `ZINCRBY` và `ZADD GT`.
   **Đáp án:** `ZINCRBY` cho điểm gấp đôi; `ZADD GT` giữ đúng điểm.

### Bài 5.4. Luồng AI soạn nháp có người duyệt và cách đo độ chính xác

#### Kiến thức

##### Human-in-the-loop là gì

Khi AI đủ tốt để soạn nháp nhưng chưa đủ tin để tự quyết, ta cho AI làm phần nặng và người làm phần quyết định: AI trích xuất, người duyệt sửa rồi lưu. Câu hỏi khó không phải "AI có giúp không" mà là "AI đúng tới đâu, và khi nào được bớt duyệt". Muốn trả lời thì phải **đo trên chính dữ liệu thật**, mà cách rẻ nhất là so bản AI với bản người đã sửa.

##### Thiết kế phép so

1. Lần lưu đầu tiên, chụp lại **bản gốc của AI** và không bao giờ sửa nó (snapshot bất biến).
2. Mỗi lần người duyệt lưu, so bản người lưu với snapshot.
3. Ghi kết quả so (số mục AI đề xuất, số mục AI sai, chi tiết sửa) vào bảng đánh giá riêng.

```csharp
public sealed record SchoolDraft(string Code, string Name, string Role, string? Campus);

static (List<string> Added, List<string> Removed, List<string> Changed) Compare(
    IReadOnlyList<SchoolDraft> ai, IReadOnlyList<SchoolDraft> saved)
{
    var a = ai.ToDictionary(x => x.Code);
    var s = saved.ToDictionary(x => x.Code);
    var added   = s.Keys.Except(a.Keys).ToList();                          // AI bỏ sót
    var removed = a.Keys.Except(s.Keys).ToList();                          // AI đề xuất thừa
    var changed = a.Keys.Intersect(s.Keys).Where(k => a[k] != s[k]).ToList(); // AI đề xuất sai
    return (added, removed, changed);
}

await repo.SaveFormAsync(form);            // việc chính trước
try { await repo.SaveAiEvaluationAsync(form.Id, Compare(snapshot.Schools, form.Schools)); }
catch (Exception ex) { logger.LogWarning(ex, "AI evaluation failed for form {FormId}", form.Id); }
```

Đoạn trên là phác thảo cơ chế, không phải code thật. Những điểm phải nghĩ:

- **Khóa ghép cặp:** ghép theo mã đơn vị mà AI đọc sai mã thì một lỗi biến thành một "bỏ" cộng một "thêm". Phải định nghĩa rõ, hoặc ghép thêm theo tên gần đúng.
- **Snapshot bất biến:** nếu so với bản staging có thể bị nạp lại, số liệu giữa các lần so không còn cùng mốc.
- **Hai loại lỗi:** AI đề xuất sai (giống precision) và AI bỏ sót (giống recall). Công thức `1 − sai / đề xuất` chỉ đo loại thứ nhất, phải báo kèm tỉ lệ bỏ sót.
- **Đo lường không được phá việc chính:** đánh giá lỗi thì ghi log, không làm hỏng lần lưu. Mất vài bản ghi đánh giá dễ chấp nhận hơn chặn người duyệt.

##### Trích xuất và ngưỡng tin cậy (best practice)

- OCR rồi đưa cho LLM, hoặc model đọc thẳng ảnh; bắt trả JSON theo schema, nhiệt độ thấp, có ví dụ mẫu. Kiểm lại bằng rule (mã đơn vị tồn tại, tỉnh và xã khớp danh mục mới). Lưu phiên bản prompt và model cùng kết quả.
- **Ngưỡng tin cậy theo từng loại trường**, dựa trên độ chính xác đo được: trường đã qua rule (tỉnh, xã) có thể tin cao, trường tự do (tên phân hiệu) thì luôn duyệt. Phần được tự duyệt vẫn lấy mẫu kiểm định kỳ.
- **Automation bias:** người duyệt có xu hướng bấm lưu bản AI mà không đọc kỹ. Tỉ lệ "chấp nhận nguyên bản" cao chưa chắc là AI đúng; cần lấy mẫu kiểm độc lập.

##### Đo cho đúng

```sql
SELECT COUNT(*) AS forms,
       1.0 - 1.0 * SUM(AISchoolWrongCount) / NULLIF(SUM(AISchoolCount), 0) AS accuracy,
       1.0 * SUM(CASE WHEN ChangeCount = 0 THEN 1 ELSE 0 END) / COUNT(*)     AS accepted_as_is
FROM <bảng đánh giá AI>;
```

Chạy trên production, không lấy số từ dev. Thời gian duyệt tính bằng (lúc duyệt − lúc tạo phiếu) lẫn cả thời gian phiếu nằm chờ; muốn nói "phút công" phải log lúc mở và lúc lưu phiếu.

#### Bối cảnh dự án

Sau đợt sáp nhập đơn vị hành chính, dữ liệu trường học trên cả nước (mã đơn vị, tên, trường chính, phân hiệu, tỉnh và xã mới) phải cập nhật hàng loạt, khoảng vài chục nghìn trường. AI soạn nháp phiếu cho từng đơn vị, đội chăm sóc khách hàng duyệt trên CMS. Phần trích xuất bằng AI có thể không phải bạn viết. Phần chắc chắn của bạn là biến luồng đó thành thứ đo được: chụp bản AI ở lần lưu đầu, so với mỗi lần lưu theo từng trường và từng phiếu, ghi số liệu và chi tiết sửa dạng JSON, lỗi đánh giá chỉ ghi log.

#### Cách show off

Mạch kể: dữ liệu lớn phải cập nhật, AI soạn nháp, người duyệt → câu hỏi "AI đúng tới đâu" không ai trả lời được → bạn thêm snapshot và phép so ngay trong luồng lưu → giờ có số theo từng lô để quyết định tin AI tới đâu, sửa prompt ở đâu.

> **Ví dụ:** "Sau sáp nhập tỉnh, dữ liệu vài chục nghìn trường phải cập nhật lại. AI soạn nháp phiếu, người của đội chăm sóc khách hàng duyệt và sửa trên CMS. Vấn đề là không ai biết AI đúng tới đâu, nên cũng không ai dám bớt khâu duyệt. Phần tôi làm là biến luồng đó thành thứ đo được: lần lưu đầu, hệ thống chụp lại bản gốc của AI, sau đó mỗi lần lưu đều so với bản đó theo từng trường và từng phiếu. Tôi tách hai loại lỗi, AI đề xuất sai và AI bỏ sót, vì chỉ đo một loại sẽ ra con số đẹp giả. Bước đánh giá chạy sau khi lưu xong và lỗi thì chỉ ghi log, vì đo lường không được làm hỏng việc chính. Phần trích xuất bằng AI không phải tôi viết."

Điểm ăn điểm:

- Định nghĩa rõ "độ chính xác" là của cái gì, theo trường hay theo phiếu, có tính bỏ sót không.
- Nhắc automation bias: người duyệt bấm lưu nguyên bản chưa chắc là AI đúng.
- Tách việc chính và đo lường để lỗi đo không chặn người dùng.
- Chưa chạy query trên production thì không đưa số; nói "tôi có sẵn bảng đánh giá, số lấy bằng một query".

#### Câu hỏi vặn

- **"Độ chính xác của AI là bao nhiêu, và đó là phần trăm của cái gì?"** Tôi định nghĩa theo trường: một trừ số trường AI sai chia số trường AI đề xuất, trên toàn bộ phiếu đã duyệt ở production. Công thức này không tính trường AI bỏ sót, nên tôi báo kèm tỉ lệ bỏ sót và tỉ lệ phiếu chấp nhận nguyên bản. Con số cụ thể tôi chỉ nói khi đã chạy query trên production.
- **"Phần trích xuất làm thế nào, dùng model nào?"** Phần đó không phải tôi viết. Nếu làm, tôi sẽ bắt model trả JSON theo schema, nhiệt độ thấp, có ví dụ mẫu, rồi kiểm bằng rule với danh mục. Chọn model theo độ chính xác trên một tập mẫu có nhãn, chi phí mỗi phiếu, độ trễ và yêu cầu dữ liệu không rời hạ tầng được phép.
- **"Khi nào tin bản AI mà không cần người duyệt?"** Đặt ngưỡng theo từng loại trường dựa trên độ chính xác đo được, chỉ nới cho loại đã chứng minh, và vẫn lấy mẫu kiểm định kỳ. Cẩn thận automation bias: tỉ lệ chấp nhận nguyên bản cao chưa chắc là AI đúng.
- **"AI đọc sai mã đơn vị thì phép so ra gì?"** Ghép theo mã thì một lỗi thành một mục bị bỏ cộng một mục được thêm, tức đếm hai lần. Tôi phải định nghĩa rõ quy tắc này hoặc ghép thêm theo tên gần đúng để đếm thành một lỗi "đổi".
- **"AI sai thì ai chịu trách nhiệm?"** Người duyệt là người quyết định cuối. Hệ thống đo độ chính xác theo lô, lấy mẫu kiểm, và chỉ nới ngưỡng tự duyệt cho loại trường đã chứng minh được.

#### Bẫy cần tránh

- Nhận phần trích xuất là của mình khi không viết.
- Đưa một con số phần trăm mà không định nghĩa nó đo cái gì, hoặc lấy số từ dữ liệu dev.
- Cho bước đánh giá chạy chung transaction với lần lưu, để lỗi đo làm hỏng việc chính.

#### Nhớ nhanh

- Phần của bạn: snapshot bản AI ở lần lưu đầu và so với mỗi lần lưu; trích xuất có thể không phải của bạn.
- Đo hai loại lỗi: đề xuất sai và bỏ sót; kèm tỉ lệ chấp nhận nguyên bản.
- Đo lường chạy sau việc chính, lỗi chỉ ghi log.
- Ngưỡng tự duyệt theo từng loại trường, vẫn lấy mẫu kiểm; nhớ automation bias.

#### Bài tập

1. Bản AI có {A, B, C}, bản người lưu có {A, C', D} (C' là C đổi vai trò). Tính added, removed, changed và độ chính xác với "sai" = removed + changed.
   **Đáp án:** added = {D}, removed = {B}, changed = {C}; sai = 2, đề xuất = 3, độ chính xác = 1 − 2/3 ≈ 33%; bỏ sót 1 (D).
2. Liệt kê các cột cần log để đo đúng thời gian công duyệt phiếu.
   **Đáp án:** Thời điểm mở phiếu, thời điểm lưu, người duyệt, số lần mở lại; thời gian công = tổng các khoảng mở → lưu.

## Chương 6. Nền tảng kỹ thuật và con người

Chương này nói về những việc không phải tính năng nhưng quyết định team đi nhanh hay chậm: nâng cấp framework cho cả loạt service, xây tài liệu để người mới tự tìm đường, và đưa AI agent vào quy trình làm việc một cách có kiểm soát. Người phỏng vấn hỏi các chủ đề này để xem bạn có tư duy vận hành (mốc hỗ trợ, breaking change, rollout từng bước) và có nhân rộng hiểu biết của mình ra team hay không.

Đợt nâng cấp .NET là việc bạn làm trọn vẹn, nên dùng nó làm câu chuyện chính. Hai bài sau có phần đã làm thật và phần mới ở mức kế hoạch; phải nói đúng vai trò, nhất là chỗ AI soạn nháp tài liệu và chỗ MCP server là tự viết hay chỉ cấu hình.

### Bài 6.1. Nâng cấp hàng loạt lên .NET 10 bằng shim tương thích

#### Kiến thức

##### Vì sao phải nâng: vòng đời hỗ trợ của .NET

.NET ra một bản chính mỗi tháng 11. Bản số chẵn là **LTS**, hỗ trợ 3 năm; bản số lẻ là **STS**, trước đây 18 tháng, từ .NET 9 kéo lên 24 tháng. Hết hỗ trợ nghĩa là không còn bản vá bảo mật.

| Phiên bản | Loại | Hết hỗ trợ |
|---|---|---|
| .NET 5 | STS | 05/2022 |
| .NET 6 | LTS | 11/2024 |
| .NET 8 | LTS | 11/2026 |
| .NET 9 | STS | 11/2026 |
| .NET 10 | LTS (ra 11/2025) | 11/2028 |

Từ .NET 5/6 mà chỉ lên .NET 8 thì vài tháng sau lại phải nâng tiếp. Lên thẳng LTS mới nhất là cách nâng một lần.

##### Shim: nâng framework mà không đụng business code

Shim là lớp adapter giữ nguyên API cũ mà business code đang gọi, bên trong chuyển sang cách làm mới. Nhờ đó thay đổi gom vào tầng hạ tầng, review dễ, rủi ro nhỏ. Minh họa cơ chế:

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

Shim là **nợ kỹ thuật có chủ đích**: nó vẫn là static nên khó test. Sau đợt nâng nên chuyển dần sang inject trực tiếp.

##### Các breaking change hay gặp

- **`System.Data.SqlClient` → `Microsoft.Data.SqlClient`.** Từ bản 4.0, driver mới mặc định `Encrypt=true` và kiểm chứng chứng chỉ server. Server dùng chứng chỉ tự ký thì kết nối lỗi. `TrustServerCertificate=True` vẫn mã hóa nhưng bỏ kiểm chứng chứng chỉ, nên không chống được man-in-the-middle; chấp nhận được trong mạng nội bộ khi chuyển đổi, lâu dài nên cài chứng chỉ được tin cậy.
- **HttpClient.** `new HttpClient()` mỗi lần gọi làm cạn socket; một instance tĩnh sống mãi thì không cập nhật DNS. `IHttpClientFactory` quản lý pool handler có thời gian sống (mặc định 2 phút), giải quyết cả hai.
- **Unix time.** Dùng `DateTimeOffset.FromUnixTimeSeconds` / `ToUnixTimeSeconds`, kiểu `long` thay cho `int` (giây kể từ 1970 vượt `int.MaxValue` năm 2038), phân biệt giây với mili giây.
- **Options validation.** Options có `ValidateOnStart()` ném `OptionsValidationException` lúc khởi động nếu thiếu key. Khi config center vẫn bọc key trong khối `AppSettings` kiểu cũ, code mới đọc ở root sẽ không thấy. Sửa bằng cách chép key lên root, chỉ khi root chưa có:

```csharp
var promoted = builder.Configuration.GetSection("AppSettings")
    .AsEnumerable(makePathsRelative: true)
    .Where(kv => kv.Value is not null && builder.Configuration[kv.Key] is null)
    .ToDictionary(kv => kv.Key, kv => kv.Value);
builder.Configuration.AddInMemoryCollection(promoted);
```

- **Dependency có lỗ hổng.** NuGet audit cảnh báo theo mức: NU1901 thấp, NU1902 trung bình, NU1903 cao, NU1904 nghiêm trọng. Gói all-in-one thường kéo theo nhiều integration không dùng, trong đó có dependency bắc cầu bị lỗ hổng; chỉ tham chiếu phần cần thì loại được nó. Kiểm bằng `dotnet list package --vulnerable --include-transitive`.
- **Container:** từ .NET 8 image mặc định lắng nghe cổng 8080 và chạy bằng user không phải root, nên manifest Kubernetes và health check có thể phải sửa.

**Rollout an toàn:** nâng thư viện dùng chung trước, rồi từng service một: build trên máy thật, chạy trên dev với config thật, rồi mới deploy; mỗi service rollback độc lập.

#### Bối cảnh dự án

Hệ sinh thái thi trực tuyến có khoảng 70 project (API, worker, CMS, web) còn chạy .NET 5 và 6, đều đã hết hỗ trợ. Bạn làm trọn đợt nâng lên .NET 10: gom các thư viện cũ về một bộ namespace mới (common, web, data), viết shim để business logic giữ nguyên, xử lý các breaking change ở trên, sửa lỗi config `AppSettings` làm service không khởi động được trên dev, và bỏ gói APM all-in-one, chỉ giữ phần HTTP và gRPC, để loại một dependency có cảnh báo lỗ hổng mức cao. Quy trình được ghi lại thành một skill Claude Code (bài 6.3): chỉ sửa project web, không đụng thư viện dùng chung đang là git submodule.

> **Cảnh báo:** Số service được rollout ghi là "khoảng 12". Đếm lại danh sách chính xác trước khi nói một con số cụ thể.

#### Cách show off

Mạch kể: framework hết hỗ trợ, không còn bản vá bảo mật → chọn đích .NET 10 vì sao → chiến lược giữ business code nguyên vẹn bằng shim → các breaking change gặp và cách xử lý → rollout từng service.

> **Ví dụ:** "Khi tôi vào, khoảng 70 project vẫn chạy .NET 5 và 6, cả hai đã hết hỗ trợ nên không còn bản vá bảo mật. Tôi chọn lên thẳng .NET 10 chứ không dừng ở .NET 8, vì .NET 8 cũng hết hỗ trợ tháng 11/2026, nâng hai lần là phí. Nguyên tắc của tôi là không đụng business logic: thay đổi nằm ở tầng hạ tầng, và chỗ nào API cũ bị gỡ thì tôi viết shim giữ nguyên chữ ký, ví dụ helper HTTP tĩnh bên trong chuyển sang IHttpClientFactory. Chỗ mất thời gian nhất lại là cấu hình: config center còn bọc key theo kiểu cũ nên service mới không khởi động được, tôi sửa bằng cách đưa key lên root mà không ghi đè giá trị mới. Tiện tay tôi bỏ gói APM all-in-one để loại một dependency có lỗ hổng mức cao. Rollout thì từng service: build thật, chạy trên dev với config thật, rồi mới deploy."

Điểm ăn điểm:

- Lý do chọn đích dựa trên vòng đời hỗ trợ, không phải "bản mới nhất cho xịn".
- Gọi shim là nợ kỹ thuật có chủ đích và nói kế hoạch trả nợ.
- Biết `TrustServerCertificate=True` là tạm, nó bỏ kiểm chứng chứng chỉ.
- Rollout từng bước, mỗi service rollback được độc lập.

#### Câu hỏi vặn

- **"Vì sao lên .NET 10 mà không dừng ở .NET 8?"** .NET 5/6 đã hết hỗ trợ. .NET 8 cũng là LTS nhưng hết hỗ trợ tháng 11/2026, còn .NET 10 hỗ trợ tới 11/2028. Lên thẳng .NET 10 để khỏi nâng hai lần trong một năm.
- **"Shim là gì, và giá phải trả là gì?"** Lớp adapter giữ nguyên API cũ nhưng bên trong gọi cách làm mới, nên business code không phải sửa. Giá là vẫn static, khó test, và người mới có thể tiếp tục dùng API cũ. Tôi coi nó là nợ kỹ thuật có chủ đích và chuyển dần sang inject trực tiếp.
- **"Anh nói không đụng business code, thật là không sửa dòng nào?"** Nói chính xác là business logic giữ nguyên; thay đổi nằm ở tầng hạ tầng, namespace và shim. Có những chỗ phải sửa theo breaking change như ép kiểu unix time, nhưng không đổi hành vi nghiệp vụ.
- **"Rollout 70 project thế nào để không làm sập production?"** Thư viện dùng chung nâng trước; mỗi service chỉ đổi target framework, package, DI và namespace. Từng service một: build trên máy thật, chạy thử trên dev với config thật, rồi deploy, và rollback được độc lập.
- **"Chuyển sang `Microsoft.Data.SqlClient` gặp gì?"** Driver mới mặc định mã hóa và kiểm chứng chứng chỉ, server dùng chứng chỉ tự ký sẽ lỗi kết nối. Tôi thêm `TrustServerCertificate=True` để chuyển đổi; nó vẫn mã hóa nhưng không chống man-in-the-middle, nên lâu dài cần chứng chỉ được tin cậy.
- **"`OptionsValidationException` trên dev là do đâu?"** Config center vẫn bọc key trong khối `AppSettings`, còn code mới đọc ở root và validate lúc khởi động. Tôi chép key lên root, chỉ khi root chưa có, để không ghi đè giá trị mới.

#### Bẫy cần tránh

- Nói một con số service cụ thể khi chưa đếm lại.
- Nói `TrustServerCertificate=True` là "an toàn" mà không nhắc nó bỏ kiểm chứng chứng chỉ.
- Nói "không đổi một dòng code nào"; nói "business logic giữ nguyên, thay đổi nằm ở hạ tầng và shim".
- Quên .NET 8 hết hỗ trợ 11/2026 khi giải thích vì sao chọn .NET 10.

#### Nhớ nhanh

- Việc làm trọn: khoảng 70 project từ .NET 5/6 lên .NET 10, business logic giữ nguyên.
- LTS 3 năm; .NET 8 và 9 hết hỗ trợ 11/2026; .NET 10 tới 11/2028.
- Shim giữ API cũ, bên trong dùng cách mới; là nợ có chủ đích.
- Breaking change: SqlClient `Encrypt=true`, HTTP helper tĩnh, unix time, config `AppSettings`.
- Bỏ gói APM all-in-one để loại dependency lỗ hổng mức cao.

#### Bài tập

1. Viết test chứng minh đoạn "chép `AppSettings` lên root" không ghi đè key đã có ở root.
   **Đáp án:** Dựng `ConfigurationBuilder` với `AppSettings:X = 1` và `X = 2`, chạy đoạn chép, kiểm `config["X"] == "2"`; với key chỉ có trong `AppSettings` thì kiểm đã lên root.
2. Kể 3 thứ phải kiểm trong Dockerfile và manifest Kubernetes khi nâng một service từ .NET 6 lên .NET 10.
   **Đáp án:** Tag image base; cổng lắng nghe mặc định 8080 so với cổng trong service và probe; user không phải root (quyền ghi thư mục).

### Bài 6.2. Knowledge base cho team và mentor người mới

#### Kiến thức

##### Knowledge base dùng được khác một thư mục tài liệu thế nào

Tài liệu nội bộ thường chết vì hai lý do: không ai tìm thấy, và tìm thấy rồi thì không tin vì nó cũ. Một knowledge base dùng được giải quyết cả hai.

- **Phân loại** theo khung Diátaxis: hướng dẫn học (tutorial), hướng dẫn làm một việc cụ thể (how-to), tham chiếu (reference: API, stored procedure), giải thích (explanation: luồng nghiệp vụ, lý do thiết kế). Trộn bốn loại trong một file làm tài liệu vừa khó đọc vừa khó cập nhật.
- **Điều hướng hai chiều:** có index làm bản đồ; tài liệu luồng trỏ tới API nó dùng; tài liệu API ghi luồng nào gọi nó.
- **Chống lỗi thời:** đặt tài liệu cạnh code (docs as code) và sửa tài liệu trong cùng PR với thay đổi; mỗi tài liệu có người chịu trách nhiệm và ngày kiểm lần cuối; tài liệu quá lâu không ai kiểm thì đánh dấu.

##### Tài liệu do AI soạn nháp

AI soạn nhanh nhưng viết trôi chảy cả khi sai: tên tham số, giá trị enum, mã trạng thái, điều kiện lọc. Cách kiểm là đối chiếu từng mục với code và schema DB dev, nhất là enum và mã trạng thái; chỗ nào AI tự suy ra mà không có trong code thì bỏ. Người review chịu trách nhiệm cho nội dung, không phải AI.

##### Onboarding và review để dạy

- **Kế hoạch 30-60-90 ngày:** 30 ngày đầu chạy được hệ thống ở local, đọc luồng chính, sửa lỗi nhỏ lên production; 60 ngày làm một tính năng nhỏ trọn vẹn; 90 ngày tự nhận một hạng mục vừa.
- **Việc đầu tiên nhỏ nhưng đi hết đường** ra production, để người mới chạm đủ quy trình: branch, build, review, deploy.
- **Review PR để dạy:** giải thích lý do thay vì sửa hộ; tách góp ý bắt buộc (đúng sai, bảo mật) với góp ý về phong cách; đặt câu hỏi để người viết tự tìm ra vấn đề; pair cho phần khó.
- **Đo:** thời gian từ ngày vào tới PR đầu tiên được merge hoặc lên production. Với hai ba người, đó là giai thoại chứ chưa phải thống kê; nói kèm cỡ mẫu và độ khó của việc đầu tiên.

```bash
# Commit đầu tiên của một người trên nhánh chính (xấp xỉ; ngày merge PR lấy từ Git server chính xác hơn)
git log origin/main --author="ten.nguoi" --reverse --format="%ad %h %s" --date=short | head -1
```

#### Bối cảnh dự án

Bạn dựng và duy trì knowledge base của team: tài liệu luồng nghiệp vụ, tài liệu API chi tiết, tài liệu stored procedure chia theo từng database, cộng các file index để từ một luồng tìm được API nào dùng, rồi tới input, output, trạng thái của API đó; tương tự cho procedure. Tổng cộng hơn trăm tài liệu. AI soạn nháp, bạn review với code và schema, và giữ cấu trúc.

Phần mentor thì **chưa diễn ra**: chưa có người mới nào được bạn kèm chính thức, nên cũng chưa có số đo thời gian onboarding. Đó là kế hoạch: kèm một hai người, onboard bằng chính bộ tài liệu này và review PR hằng tuần.

#### Cách show off

Mạch kể: kiến thức hệ thống nằm rải rác trong đầu vài người → dựng knowledge base có cấu trúc và index → dùng AI soạn nháp nhưng tự review vì AI viết sai một cách tự tin → cách giữ cho nó không chết. Phần mentor nói ở thì tương lai.

> **Ví dụ:** "Hệ thống bên tôi có nhiều luồng nghiệp vụ đi qua nhiều service và nhiều database, nên người mới thường không biết bắt đầu đọc từ đâu. Tôi dựng một knowledge base gồm tài liệu luồng, tài liệu API và tài liệu stored procedure theo từng database, có index để từ một luồng lần ra được API và procedure liên quan. Tôi dùng AI soạn nháp cho nhanh, nhưng đối chiếu từng mục với code và schema, vì AI viết sai mã trạng thái hay điều kiện lọc mà vẫn rất trôi chảy. Về mentor, tôi chưa kèm người mới chính thức; kế hoạch của tôi là onboard bằng chính bộ tài liệu này, giao việc đầu tiên nhỏ nhưng đi hết tới production, và review PR theo hướng giải thích lý do."

Điểm ăn điểm:

- Nói rõ vai trò của AI và trách nhiệm review của mình.
- Có cơ chế chống lỗi thời, không chỉ "viết xong là xong".
- Không bịa câu chuyện mentor; nói kế hoạch cụ thể và cách đo.
- Biết giới hạn của số đo khi cỡ mẫu chỉ hai ba người.

#### Câu hỏi vặn

- **"Làm sao giữ knowledge base không lỗi thời?"** Đặt tài liệu cạnh code, sửa tài liệu trong cùng PR với thay đổi; mỗi tài liệu có người chịu trách nhiệm và ngày kiểm lần cuối; index cập nhật khi thêm tài liệu; định kỳ rà các tài liệu lâu không ai kiểm.
- **"Tài liệu do AI soạn, sao biết là đúng?"** AI chỉ soạn nháp. Tôi đối chiếu từng mục với code và schema DB dev, nhất là tham số, giá trị enum, mã trạng thái và điều kiện lọc; chỗ nào AI tự suy ra mà không có trong code thì bỏ.
- **"Anh đã mentor ai chưa?"** Chưa chính thức. Tôi có kế hoạch cụ thể: onboard bằng knowledge base, việc đầu tiên nhỏ nhưng lên tới production, review PR có giải thích lý do, tăng dần độ khó theo mốc 30-60-90 ngày.
- **"Đo hiệu quả onboarding bằng gì?"** Thời gian từ ngày vào tới PR đầu tiên được merge hoặc lên production, kèm số câu hỏi lặp lại mà tài liệu đã có câu trả lời. Cỡ mẫu nhỏ nên tôi nói rõ giới hạn và độ khó của việc đầu tiên.
- **"Người được kèm không đồng ý với góp ý review thì sao?"** Tách góp ý bắt buộc (đúng sai, bảo mật) với góp ý phong cách; cái thứ hai để người viết quyết định. Cái thứ nhất thì chứng minh bằng ví dụ hoặc test, không dùng vị trí để áp đặt.
- **"Sao không dùng Confluence hay wiki mà để tài liệu cạnh code?"** Wiki dễ đọc cho người ngoài team nhưng tách khỏi PR nên dễ lệch với code. Tài liệu kỹ thuật cạnh code thì sửa cùng PR và review cùng diff. Có thể dùng cả hai: wiki cho tổng quan, repo cho chi tiết API và procedure.

#### Bẫy cần tránh

- Nói "tôi viết toàn bộ" mà không nhắc AI soạn nháp.
- Kể một câu chuyện mentor không có thật theo kiểu STAR.
- Đưa số "thời gian onboarding giảm từ X xuống Y" khi chưa có ngày vào và ngày merge thật.

#### Nhớ nhanh

- Thật: knowledge base luồng, API, procedure theo DB, có index; AI soạn nháp, bạn review.
- Chưa làm: mentor chính thức, số đo onboarding; nói ở thì tương lai.
- Tài liệu sống nhờ nằm cạnh code, sửa cùng PR, có người chịu trách nhiệm.
- Onboarding 30-60-90, review để dạy; nhớ giới hạn cỡ mẫu khi đo.

#### Bài tập

1. Chọn một luồng nghiệp vụ, viết dàn ý tài liệu luồng gồm: mục đích, các bước, API dùng (trỏ tới index), procedure dùng, lỗi thường gặp.
   **Đáp án:** Mỗi bước một dòng, mỗi API một link tới index; phần lỗi thường gặp ghi triệu chứng và nơi xem log.
2. Lấy một tài liệu API trong knowledge base, đối chiếu với code hiện tại và liệt kê chỗ lệch.
   **Đáp án:** Kiểm tên tham số, kiểu, giá trị enum dạng số, mã trạng thái, điều kiện lọc; ghi chỗ lệch và sửa trong cùng PR.

### Bài 6.3. Claude Code skill, CLAUDE.md và MCP server

#### Kiến thức

##### MCP là gì và giải quyết vấn đề gì

AI agent chỉ giỏi bằng dữ liệu nó lấy được. Không có công cụ, nó đoán tên bảng, đoán chữ ký hàm. **MCP (Model Context Protocol)** là giao thức mở, Anthropic công bố cuối 2024, chuẩn hóa cách ứng dụng AI kết nối tới công cụ và dữ liệu. Thay vì mỗi ứng dụng tự viết tích hợp cho từng công cụ, công cụ viết một MCP server và mọi host hỗ trợ MCP dùng được.

- **Vai trò:** host (ứng dụng AI như Claude Code) chứa client; mỗi client giữ một kết nối tới một server.
- **Giao thức:** JSON-RPC 2.0, mở đầu bằng `initialize` để trao đổi phiên bản và capability.
- **Primitive phía server:** tools (hàm model gọi được, có `inputSchema` dạng JSON Schema), resources (dữ liệu đọc theo URI), prompts (mẫu prompt dựng sẵn).
- **Transport:** stdio (host chạy server như process con, hợp công cụ local) và Streamable HTTP (server chạy từ xa, nhiều client, cần xác thực).

```json
{ "jsonrpc": "2.0", "id": 7, "method": "tools/call",
  "params": { "name": "describe_table", "arguments": { "table": "dbo.Event" } } }
```

Một MCP server C# tối thiểu với SDK chính thức (gói `ModelContextProtocol`, API có thể đổi giữa các phiên bản):

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

> **Cảnh báo:** Với stdio, ghi log ra stdout làm hỏng luồng JSON-RPC. Log phải ra stderr.

##### Skill, CLAUDE.md và MCP khác nhau thế nào

- **`CLAUDE.md`:** ngữ cảnh luôn nạp cho một repo: kiến trúc, lệnh build, quy tắc an toàn.
- **Skill:** thư mục có `SKILL.md` (frontmatter `name`, `description`, rồi hướng dẫn), có thể kèm script. Lúc đầu agent chỉ nạp tên và mô tả; khi việc khớp mô tả mới nạp toàn bộ (progressive disclosure), nên nhiều skill không làm đầy context. Mô tả quyết định skill có được gọi đúng lúc không.
- **MCP server:** công cụ để agent lấy dữ liệu thật (symbol C#, schema DB, lịch sử git) thay vì đoán.

Nói gọn: `CLAUDE.md` là luật nhà, skill là quy trình làm một loại việc, MCP là tay chân để lấy dữ liệu.

##### Chất lượng và an toàn

- **Code AI viết vẫn là code của mình:** đọc từng diff, build trên máy thật, chạy với DB dev, review đối chiếu code, schema và yêu cầu; thay đổi lớn có công tắc rollback.
- **Quyền tối thiểu:** MCP đọc DB chỉ có quyền đọc trên DB dev; không đưa credential production cho agent; secret ở biến môi trường, không nằm trong prompt hay file ngữ cảnh.
- **Prompt injection:** nội dung tool trả về (dữ liệu DB, file, trang web) là dữ liệu, không phải lệnh. Một dòng dữ liệu có chữ "hãy xóa bảng X" không được làm agent hành động; thao tác ghi phải qua người duyệt.

#### Bối cảnh dự án

Mỗi đợt sự kiện của IOE (vòng thi, ca thi, vòng quay, quà theo ngày) đều lặp lại một quy trình: đọc thể lệ, khảo sát code và cấu hình cũ, viết SQL cấu hình và code kiểm tra điều kiện. Bạn viết hai skill Claude Code: một skill làm sự kiện end-to-end theo quy trình cố định (bộ câu hỏi chuẩn về thể lệ → khảo sát code và DB dev → viết plan → sinh SQL cấu hình và code), và một skill nâng service lên .NET 10 chỉ sửa project web, không đụng thư viện dùng chung (bài 6.1). Mỗi repo có `CLAUDE.md` riêng. Agent dùng các MCP server để điều hướng C# theo ngữ nghĩa (Roslyn), đọc schema DB dev và lấy ngữ cảnh git.

> **Cảnh báo:** Trả lời thật với chính mình: MCP server nào bạn tự viết code? Nếu chỉ cài và cấu hình server có sẵn, nói "tôi cấu hình và dùng", không nói "tôi xây". Thời gian dựng một sự kiện trước và sau khi có skill cũng chưa được đo; đừng đưa con số.

#### Cách show off

Mạch kể: một loại việc lặp lại, dễ sai ở chi tiết cấu hình → đóng gói quy trình thành skill để agent làm theo cùng một bộ bước → cho agent công cụ lấy dữ liệu thật thay vì đoán → kiểm soát chất lượng và an toàn thế nào.

> **Ví dụ:** "Làm sự kiện ở bên tôi là việc lặp lại: đọc thể lệ, xem sự kiện cũ cấu hình thế nào, viết script SQL cho vòng thi, ca thi, quà, rồi sửa code kiểm tra điều kiện. Lỗi hay nằm ở chi tiết nhỏ như quên một ca hay sai khung giờ. Tôi viết một skill Claude Code ghi lại đúng quy trình đó: agent phải hỏi đủ bộ câu hỏi về thể lệ, khảo sát code và database dev, viết plan cho tôi duyệt, rồi mới sinh SQL và code. Agent dùng MCP server để tra symbol C# qua Roslyn và đọc schema thật, nên không đoán tên bảng. Code nó sinh ra tôi đọc từng diff, build trên máy thật và chạy trên database dev trước khi merge. Tôi chưa đo chính thức tiết kiệm được bao nhiêu thời gian; nếu đo, tôi sẽ lấy thời gian từ lúc nhận thể lệ tới lúc cấu hình chạy được trên dev, so trước và sau."

Điểm ăn điểm:

- Phân biệt được skill, `CLAUDE.md` và MCP, không gọi chung là "prompt".
- Nói được cách kiểm code AI, không phải "AI viết xong là merge".
- Nói quyền tối thiểu và prompt injection khi cho agent đọc database.
- Trung thực phần tự viết và phần chỉ cấu hình.

#### Câu hỏi vặn

- **"MCP khác gì function calling thông thường?"** Function calling là khả năng của model: nó trả về lời gọi hàm theo schema. MCP chuẩn hóa phía công cụ: viết một server theo giao thức JSON-RPC, mọi host hỗ trợ MCP dùng được, có bước trao đổi capability, có tools, resources và prompts.
- **"stdio và HTTP transport khác nhau thế nào, khi nào dùng cái nào?"** stdio: host chạy server như process con, trao đổi qua stdin/stdout, hợp công cụ local như Roslyn trên máy dev; nhớ log ra stderr. Streamable HTTP: server chạy từ xa, nhiều client dùng chung, cần xác thực.
- **"MCP server nào anh tự viết?"** Trả lời đúng thực tế. Nếu chỉ cấu hình thì nói: tôi cài và cấu hình server Roslyn, schema DB và git; phần tôi viết là các skill và file ngữ cảnh cho từng repo.
- **"Làm sao đảm bảo chất lượng code do AI viết?"** Đọc từng diff, build trên máy thật, chạy với DB dev, review đối chiếu code, schema và yêu cầu. Skill bắt agent viết plan trước để tôi duyệt hướng làm trước khi nó sinh code.
- **"Cho agent đọc database có rủi ro gì?"** Lộ dữ liệu và prompt injection từ dữ liệu. Giảm bằng quyền chỉ đọc trên DB dev, không đưa credential production, secret ở biến môi trường, coi output của tool là dữ liệu, thao tác ghi do người duyệt và chạy tay.
- **"Skill khác gì một file hướng dẫn dài trong `CLAUDE.md`?"** `CLAUDE.md` luôn được nạp nên dồn mọi quy trình vào đó làm đầy context. Skill chỉ nạp khi việc khớp mô tả, nên có thể có nhiều skill mà không tốn context; cái giá là phải viết mô tả đủ rõ để agent gọi đúng lúc.
- **"Skill giúp nhanh hơn bao nhiêu?"** Tôi chưa đo chính thức. Cách đo là thời gian từ lúc nhận thể lệ tới lúc cấu hình chạy được trên dev, trung vị trước và sau khi có skill, kèm độ phức tạp từng sự kiện, và đếm lỗi cấu hình lọt lên production.

#### Bẫy cần tránh

- Nói "tôi xây MCP server" khi chỉ cấu hình.
- Mô tả MCP như "plugin của Claude"; MCP là giao thức mở, nhiều host dùng được.
- Đưa con số tiết kiệm thời gian khi chưa đo.

#### Nhớ nhanh

- Thật: skill làm sự kiện, skill nâng .NET 10, `CLAUDE.md` từng repo; MCP server có thể chỉ là cấu hình.
- MCP: JSON-RPC 2.0, host/client/server, tools/resources/prompts, stdio hoặc Streamable HTTP.
- `CLAUDE.md` luôn nạp; skill nạp khi cần; MCP lấy dữ liệu thật.
- Code AI: đọc diff, build thật, chạy DB dev; quyền tối thiểu, coi output tool là dữ liệu.

#### Bài tập

1. Viết một MCP server C# stdio có một tool trả về giờ hiện tại theo múi giờ truyền vào, cấu hình cho Claude Code và gọi thử.
   **Đáp án:** Dùng mẫu trong bài, tool nhận `string timeZoneId`, dùng `TimeZoneInfo.FindSystemTimeZoneById`; log ra stderr; khai báo server trong cấu hình MCP của Claude Code với lệnh `dotnet run --project <đường dẫn>`.
2. Viết `description` cho skill "viết script SQL cập nhật dữ liệu live" sao cho agent gọi đúng lúc và không gọi nhầm.
   **Đáp án:** Nêu việc skill làm, các cụm từ người dùng hay nói ("script update live", "sửa dữ liệu production"), và trường hợp không dùng (chỉ đọc dữ liệu).
