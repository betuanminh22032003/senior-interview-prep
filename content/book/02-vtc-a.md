# Phần II. Bảo vệ CV: VTC Online

Phần II đi qua từng dòng CV ở VTC Online, nơi bạn làm Backend Engineer từ 03/2026 trên hệ sinh thái thi trực tuyến IOE. Đây là phần interviewer hỏi nhiều nhất, vì nó là kinh nghiệm gần nhất và có nhiều con số.

Mỗi bài mở đầu bằng dòng CV nguyên văn và trạng thái của nó (Thật, Một phần, Minh họa, xem Bài 1.2). Phần "Bối cảnh và việc thật đã làm" chỉ chứa sự kiện có bằng chứng; phần "Kiến thức nền" chứa cơ chế theo best practice để bạn trả lời được tầng 2 kể cả với dòng chưa làm.

## Chương 2. Summary và quy mô nền tảng

Summary là đoạn interviewer đọc đầu tiên và dùng để mở màn: "Anh kể về nền tảng 35 triệu tài khoản đi". Mọi con số trong Summary phải có nguồn, và mọi cụm từ định vị ("senior", "high availability", "turns incidents into SLOs") phải đứng được khi bị hỏi lại.

Học xong chương này, bạn nói được quy mô nền tảng đúng cách đếm, phân biệt người dùng đồng thời với request đồng thời, và trả lời được câu hỏi về high availability cho SQL Server ở mức thiết kế.

### Bài 2.1. Định vị trong Summary và quy mô 35M+ tài khoản, 200K đồng thời
**Dòng CV:** "Senior backend engineer (.NET microservices, SQL Server) building national-scale assessment platforms: 35M+ accounts, 200K peak concurrent users. Finds why production is slow and fixes the cause (exam-start p95 2.45 s to 55 ms), designs for high availability and correctness under retries, and turns incidents into SLOs."
**Trạng thái:** Một phần. Chức danh thật ở VTC là Backend Engineer; "Senior" là định vị. 35M+ và 200K là bối cảnh nền tảng, chưa tìm thấy nguồn đo. 2,45 s → 55 ms là trace APM thật trước và sau fix, nhưng chữ "p95" chưa đo. "Turns incidents into SLOs" đi kèm dòng postmortem/SLO là dòng Minh họa.

#### Mục tiêu
- Sau bài này, bạn trả lời đúng chức danh và vai trò thật khi bị hỏi về chữ "Senior".
- Bạn giải thích được cách đếm tài khoản và người dùng đồng thời, kèm thời điểm đo.
- Bạn phân biệt được người dùng đồng thời, request đồng thời và throughput, và tính được bằng định luật Little.
- Bạn giải thích được p95 là gì và vì sao một trace điển hình không phải p95.

#### Bối cảnh và việc thật đã làm

- Vai trò trên CV: **Backend Engineer, VTC Online, 03/2026 đến nay**. Trước đó là Team Lead ở AvePoint (01/2023 – 03/2026).
- Dòng Platform trên CV: 35M+ tài khoản, 200K người dùng đồng thời lúc cao điểm, 20+ service .NET, 6 cụm SQL Server, bảng 580 triệu dòng.
- Phần có nguồn: số repo service khoảng 20; kích thước bảng lấy từ DMV trong đợt rà soát tháng 09/2026 (bảng feed khoảng 580 triệu dòng, bảng lịch sử vật phẩm khoảng 396 triệu, bảng user khoảng 120 triệu).
- Phần chưa có nguồn: 35M và 200K không tìm thấy trong code hay tài liệu (nguồn: mục 0 #3). Đây là **bối cảnh nền tảng**, không phải năng lực do bạn xây.
- 2,45 s → 55 ms: thời gian của cả request API bắt đầu thi thử, đọc từ một trace APM trước và một trace sau fix ngày 16/09. Fix do đồng nghiệp commit; bạn dẫn đợt audit (Bài 3.1).

#### Kiến thức nền

**Đếm tài khoản.** "Tài khoản" phải có định nghĩa: tài khoản đăng ký, loại tài khoản đã xóa hoặc bị khóa, nói kèm ngày đếm. Trên nền tảng giáo dục, con số thường gồm học sinh, giáo viên và cán bộ. Một truy vấn đếm có dạng:

```sql
SELECT COUNT_BIG(*) AS active_accounts
FROM dbo.Users WITH (NOLOCK)
WHERE IsDeleted = 0 AND IsLocked = 0;
```

Dùng `COUNT_BIG` vì `COUNT` trả `int`; với bảng trăm triệu dòng thì vẫn vừa `int`, nhưng thói quen này tránh tràn số ở bảng lớn hơn. Trên bảng 120 triệu dòng, nên đếm trên replica hoặc dùng số dòng xấp xỉ từ `sys.dm_db_partition_stats` nếu chỉ cần thứ tự độ lớn.

**Người dùng đồng thời (concurrent users).** Có hai định nghĩa phổ biến, phải nói rõ dùng định nghĩa nào:

- Số phiên có hoạt động trong 1–5 phút gần nhất lúc cao điểm (đếm user khác nhau có request trong cửa sổ đó).
- Số thí sinh trong ca thi đông nhất (đếm theo dữ liệu ca thi).

**Người dùng đồng thời không phải request đồng thời.** Định luật Little: số request đang xử lý cùng lúc `L = λ × W`, với `λ` là throughput (request/giây) và `W` là thời gian xử lý trung bình.

> **Ví dụ:** 200.000 thí sinh, mỗi người gửi trung bình 1 request mỗi 20 giây, thì `λ = 10.000` request/giây. Nếu thời gian xử lý trung bình là 50 ms thì `L = 10.000 × 0,05 = 500` request đang xử lý cùng lúc. Nếu một API chậm lên 2,45 s, `L` của API đó tăng gần 50 lần: đó là lý do một API chậm có thể làm cạn thread pool và connection pool.

**Percentile (p95, p99).** p95 là giá trị mà 95% request nhanh hơn hoặc bằng. Trung bình che mất phần đuôi: 95 request 50 ms và 5 request 3 s cho trung bình 197,5 ms, nhưng 5% người dùng chờ 3 s. Percentile **không cộng hay lấy trung bình được** giữa các pod hoặc các khoảng thời gian; muốn gộp phải tính lại từ dữ liệu gốc hoặc từ histogram. Elasticsearch tính percentile bằng thuật toán xấp xỉ (TDigest), đủ chính xác cho mục đích này.

**Một trace không phải p95.** Một trace là một request. Nó có thể nằm bất kỳ đâu trong phân phối. Muốn nói "p95 giảm từ A xuống B" phải có hai cửa sổ đo (ví dụ 7 ngày trước và 7 ngày sau), cùng loại tải.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Chức danh hiện tại của tôi là Backend Engineer ở VTC Online. Tôi làm trên hệ sinh thái thi IOE: hơn 20 service .NET, 6 cụm SQL Server, bảng lớn nhất khoảng 580 triệu dòng. Số 35 triệu tài khoản và 200 nghìn người dùng đồng thời là quy mô nền tảng, không phải thứ tôi xây. Việc tôi làm nổi bật nhất là dẫn đợt audit hiệu năng: API bắt đầu thi thử mất 2,45 giây trên trace, nguyên nhân là một vòng `SCAN` trên Redis; sau fix trace còn 55 ms. Đó là số của trace điển hình, không phải p95."

#### Đo để biến số minh họa thành số thật

- **p95 của API bắt đầu thi** (roadmap 1.1): trên Kibana, APM → service → Transactions → chọn transaction → biểu đồ Latency chọn 95th và 99th percentile; hai cửa sổ 7 ngày trước và sau 16/09/2026. Hoặc query Elasticsearch:

```json
GET apm-*-transaction*/_search
{
  "size": 0,
  "query": { "bool": { "filter": [
    { "term": { "service.name": "<service>" } },
    { "term": { "transaction.name": "<transaction bắt đầu thi>" } },
    { "range": { "@timestamp": { "gte": "2026-09-09", "lt": "2026-09-16" } } }
  ] } },
  "aggs": { "p": { "percentiles": { "field": "transaction.duration.us", "percents": [50, 95, 99] } } }
}
```

  Kết quả tính bằng micro-giây. Chạy lại với khoảng `2026-09-17` đến `2026-09-24`. Ghi kèm throughput lúc cao điểm để chứng minh tải tương đương.
- **Người dùng đồng thời:** đếm user khác nhau có request trong cửa sổ 5 phút đông nhất của mùa thi, hoặc lấy số thí sinh của ca thi đông nhất. Ghi ngày đo.
- **Tài khoản:** chạy truy vấn đếm, ghi ngày và định nghĩa.

#### Bẫy

- Nói "tôi là senior engineer ở VTC". Chức danh thật là Backend Engineer; nói sai chức danh là lỗi bị phát hiện ngay khi kiểm tra tham chiếu.
- Nói "hệ thống của tôi phục vụ 200K người dùng đồng thời" như thể bạn thiết kế cho tải đó.
- Lấy trung bình của p95 các ngày để ra "p95 tuần".
- Nhận "turns incidents into SLOs" khi dòng SLO là Minh họa. Bỏ dòng SLO thì bỏ luôn cụm này.
- Bảng user khoảng 120 triệu dòng trong khi CV ghi 35M+ tài khoản. Nếu interviewer hỏi, phải biết lý do thật (tự kiểm tra trước); không đoán.

#### Câu hỏi phỏng vấn
- **"Chức danh thật của bạn ở VTC là gì, vì sao Summary ghi Senior?"** "Chức danh hiện tại là Backend Engineer. Summary mô tả mức công việc tôi đang làm: dẫn audit hiệu năng, thiết kế lại luồng attempt trên 4 database. Tôi không nhận chức danh senior ở VTC."
- **"35 triệu tài khoản đếm thế nào?"** Số tài khoản đăng ký của nền tảng, gồm học sinh, giáo viên, cán bộ; cách đếm đúng là loại tài khoản đã xóa hoặc bị khóa và ghi ngày đếm. Nói rõ đây là quy mô nền tảng, và nêu nguồn nếu đã kiểm tra; nếu chưa, nói chưa tự đếm.
- **"200 nghìn người dùng đồng thời bạn đo bằng gì?"** Nêu định nghĩa trước: user khác nhau có hoạt động trong cửa sổ vài phút lúc cao điểm, hoặc số thí sinh trong ca thi đông nhất. Nguồn: APM hoặc dữ liệu ca thi. Nếu chưa tự đo, nói thẳng đó là số của nền tảng.
- **"200 nghìn người dùng đồng thời thì hệ thống phải chịu bao nhiêu request mỗi giây?"** Dùng định luật Little với giả định nói rõ: mỗi người 1 request mỗi 20 giây thì khoảng 10.000 request/giây; với 50 ms mỗi request thì chỉ khoảng 500 request đang xử lý cùng lúc. Điểm chính: người dùng đồng thời khác request đồng thời.
- **"2,45 giây xuống 55 ms là p95 hay một request?"** "Là thời gian một trace điển hình trước và sau fix. Tôi chưa có p95 trên cửa sổ dài; nếu cần tôi lấy từ Elastic APM cho 7 ngày trước và sau ngày deploy."
- **"Bạn 'turns incidents into SLOs' cụ thể là đã làm gì?"** Nếu dòng SLO vẫn còn trên CV: "Phần SLO và burn-rate alert tôi chưa triển khai ở production. Tôi có thể trình bày cách tôi sẽ đặt SLO cho API thi." Cách tốt hơn là bỏ cụm này khỏi Summary trước khi nộp.

#### Tóm tắt
- Chức danh thật: Backend Engineer. "Senior" trong Summary là định vị, không phải chức danh.
- 35M+ và 200K là bối cảnh nền tảng; nói kèm định nghĩa và thời điểm đo.
- Người dùng đồng thời khác request đồng thời: `L = λ × W`.
- p95 cần cửa sổ đo; một trace không phải p95; percentile không lấy trung bình được.
- "Turns incidents into SLOs" sống chết cùng dòng SLO (Minh họa).

#### Bài tập
1. Một API có throughput 4.000 request/giây lúc cao điểm, thời gian trung bình 120 ms. Có bao nhiêu request đang xử lý cùng lúc? Nếu thời gian tăng lên 1,2 s thì sao?
   **Đáp án:** `L = 4.000 × 0,12 = 480`. Khi `W = 1,2 s`, `L = 4.800`, gấp 10 lần: cần gấp 10 lần thread và connection, hoặc request sẽ xếp hàng.
2. Cho 20 thời gian phản hồi (ms): 40, 42, 45, 45, 48, 50, 50, 52, 55, 55, 58, 60, 60, 62, 65, 70, 75, 90, 400, 2.450. Tính trung bình và p95 (theo cách lấy phần tử thứ ⌈0,95 × n⌉ sau khi sắp xếp).
   **Đáp án:** Tổng 3.872 ms, trung bình 193,6 ms. ⌈0,95 × 20⌉ = 19, phần tử thứ 19 là 400 ms. Trung vị là 56,5 ms; trung bình gấp hơn 3 lần trung vị vì một request 2,45 s kéo lên.
3. Viết lại câu Summary sao cho chỉ còn phần có bằng chứng.
   **Đáp án:** Ví dụ: "Backend engineer (.NET, SQL Server) on a national assessment platform (35M+ accounts). Finds why production is slow and fixes the cause: led an audit whose fixes cut the exam-start API from 2.45 s to 55 ms on traced requests." Bỏ "p95" và "turns incidents into SLOs" cho tới khi có số và có việc thật.

### Bài 2.2. Microservices và high availability cho SQL Server
**Dòng CV:** "Platform: 35M+ accounts, 200K peak concurrent users, 20+ .NET services, 6 SQL Server clusters, 580M-row tables." và trong Summary: "designs for high availability and correctness under retries".
**Trạng thái:** Một phần. 20+ service .NET, nhiều pod sau load balancer trên Kubernetes và Redis Cluster là thật của nền tảng. Bạn không thiết kế HA cho SQL Server; phần Always On, failover và RPO/RTO là kiến thức theo best practice.

#### Mục tiêu
- Sau bài này, bạn mô tả trung thực mức "microservices" của nền tảng, kể cả điểm chưa chuẩn.
- Bạn so sánh được Always On Availability Group, Basic AG, Failover Cluster Instance và log shipping theo edition, phạm vi và RPO/RTO.
- Bạn cấu hình được phía ứng dụng để chịu failover: listener, `MultiSubnetFailover`, retry lỗi tạm thời.
- Bạn chỉ ra được vì sao retry khi failover có thể gây ghi trùng.

#### Bối cảnh và việc thật đã làm

- Nền tảng có hơn 20 service .NET, mỗi service deploy riêng, gọi nhau qua HTTP/gRPC và Kafka. Service theo mô hình controller mỏng, logic ở tầng proxy trong thư viện dùng chung, truy cập DB qua stored procedure.
- Consul được dùng làm **kho config key/value**, không dùng service discovery (nguồn: B1).
- Điểm chưa "chuẩn microservices": nhiều service vẫn dùng chung database theo domain.
- Phía ứng dụng: nhiều pod sau load balancer trên Kubernetes; Redis Cluster chạy trong cluster. Bạn không viết manifest Kubernetes.
- Phía SQL Server: bạn không thiết kế HA. Mọi câu trả lời về AG/FCI là theo best practice.

#### Kiến thức nền

**Microservices là gì, và cái giá của nó.** Mỗi service sở hữu dữ liệu và deploy độc lập; giao tiếp qua API hoặc event. Lợi: deploy và scale riêng, lỗi được cô lập. Giá: lời gọi mạng có thể lỗi, không còn transaction xuyên service, cần observability phân tán. Database dùng chung giữa nhiều service là điểm nối chặt nhất: đổi schema phải phối hợp nhiều team, và một query nặng của service A làm chậm service B.

**HA ở tầng ứng dụng.** Service stateless, nhiều replica, readiness probe để load balancer không gửi request vào pod chưa sẵn sàng. Trạng thái (phiên thi, lock, cache) nằm ở Redis hoặc DB, không nằm trong bộ nhớ pod.

**RPO và RTO.** RPO (Recovery Point Objective): mất tối đa bao nhiêu dữ liệu, tính bằng thời gian. RTO (Recovery Time Objective): bao lâu thì hệ thống chạy lại. Mọi lựa chọn HA/DR được so theo hai số này và theo chi phí.

**Các phương án HA/DR của SQL Server:**

| Phương án | Edition | Phạm vi | Secondary đọc được | Storage | RPO / RTO điển hình |
|---|---|---|---|---|---|
| Always On Availability Group | Enterprise | Nhóm database | Có (readable secondary) | Riêng từng replica | Sync: RPO ≈ 0, failover tự động trong vài chục giây |
| Basic Availability Group | Standard (từ 2016) | 1 database mỗi AG, tối đa 2 replica | Không | Riêng | Như AG sync, nhưng không scale đọc |
| Failover Cluster Instance | Standard (2 node) và Enterprise | Cả instance: login, job, mọi DB | Không (chỉ một node chạy) | Dùng chung (SAN, S2D) | RPO 0; RTO = thời gian khởi động instance trên node khác |
| Log shipping | Standard trở lên | Database | Chỉ khi restore ở chế độ `STANDBY` | Riêng | RPO vài phút (chu kỳ backup log); failover thủ công |

Ba chi tiết hay bị hỏi:

- **Synchronous và asynchronous commit.** Sync: primary chờ secondary ghi log xong mới báo commit, nên RPO ≈ 0 nhưng mỗi commit chậm thêm một round-trip. Async: không chờ, dùng cho replica ở xa (DR), chấp nhận mất dữ liệu. Failover tự động chỉ áp dụng cho replica sync.
- **AG chỉ đồng bộ database.** Login, SQL Agent job, linked server nằm ở instance, phải tự đồng bộ giữa các replica (trừ contained AG từ SQL Server 2022). FCI không có vấn đề này vì cả instance chuyển sang node khác.
- **FCI dùng chung storage,** nên không bảo vệ khi storage hỏng. AG có bản sao dữ liệu riêng trên mỗi replica.

**Phía ứng dụng khi failover.** Ứng dụng kết nối qua **listener** (tên DNS ảo trỏ tới primary hiện tại), không kết nối thẳng tên server:

```text
Server=tcp:<listener>,1433;Database=<db>;MultiSubnetFailover=True;Encrypt=True;Connect Timeout=30
```

`MultiSubnetFailover=True` làm driver thử song song mọi IP của listener thay vì lần lượt, nên kết nối lại nhanh sau failover (đặc biệt khi listener có IP ở nhiều subnet). Muốn đọc từ secondary thì thêm `ApplicationIntent=ReadOnly` và cấu hình read-only routing.

Trong lúc failover, kết nối đang mở bị đứt và transaction đang chạy bị rollback. Ứng dụng phải retry lỗi tạm thời:

```csharp
var retry = SqlConfigurableRetryFactory.CreateExponentialRetryProvider(new SqlRetryLogicOption
{
    NumberOfTries = 5,
    DeltaTime = TimeSpan.FromSeconds(1),
    MaxTimeInterval = TimeSpan.FromSeconds(20)
});

using var conn = new SqlConnection(connectionString) { RetryLogicProvider = retry }; // retry khi mở kết nối
```

Với EF Core: `UseSqlServer(cs, o => o.EnableRetryOnFailure())`. Nếu code tự mở transaction, phải bọc trong execution strategy để cả khối được chạy lại:

```csharp
var strategy = db.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync();
    // ... các lệnh trong transaction
    await tx.CommitAsync();
});
```

> **Cảnh báo:** Retry ở tầng lệnh chỉ an toàn với thao tác idempotent. Nếu lỗi xảy ra sau khi server đã commit nhưng trước khi client nhận phản hồi, retry một lệnh `INSERT` sẽ ghi hai lần. Đây là lý do cần ghi idempotent (Bài 4.1): "correctness under retries" trong Summary nói về chính vấn đề này.

**Đọc từ secondary và read-your-writes.** Secondary async có thể trễ vài giây. User vừa nộp bài rồi đọc kết quả từ secondary có thể không thấy bài vừa nộp. Cách xử lý: đọc từ primary ngay sau khi ghi, hoặc chỉ đưa các truy vấn chấp nhận trễ (báo cáo) sang secondary.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Nền tảng có hơn 20 service .NET deploy riêng, gọi nhau qua HTTP, gRPC và Kafka; tầng ứng dụng chạy nhiều pod trên Kubernetes, Redis Cluster cho cache và lock. Nói thật là chưa chuẩn microservices: nhiều service vẫn dùng chung database theo domain. Tôi không thiết kế HA cho SQL Server. Nếu thiết kế, tôi bắt đầu từ RPO và RTO: cần RPO gần 0 và failover tự động thì Availability Group sync, trên Standard Edition là Basic AG; ứng dụng kết nối qua listener với MultiSubnetFailover và retry lỗi tạm thời, còn thao tác ghi phải idempotent để retry không ghi trùng."

#### Bẫy

- Nói "tôi thiết kế HA cho SQL Server" khi chỉ làm việc trên hệ thống có sẵn.
- Nhầm Basic AG có secondary đọc được. Không có; muốn đọc từ secondary phải là Enterprise.
- Quên rằng AG không đồng bộ login và job.
- Bật retry cho mọi lệnh ghi mà không có idempotency.
- Nói Consul làm service discovery trong hệ thống này. Nó chỉ là kho config.

#### Câu hỏi phỏng vấn
- **"Hệ thống của bạn có phải microservices đúng nghĩa không?"** "Một phần. Hơn 20 service deploy độc lập, giao tiếp qua HTTP, gRPC và Kafka. Nhưng nhiều service vẫn dùng chung database theo domain, nên đổi schema phải phối hợp và một query nặng có thể ảnh hưởng service khác. Việc tôi làm ở luồng attempt, bỏ join chéo database, là một bước tách ranh giới dữ liệu." (Bài 3.4)
- **"Always On AG, Basic AG và FCI khác nhau thế nào?"** AG (Enterprise) bảo vệ nhóm database, mỗi replica có bản sao riêng, secondary đọc được. Basic AG (Standard) giới hạn 2 replica, 1 database mỗi AG, secondary không đọc được. FCI bảo vệ cả instance, dùng chung storage, chỉ một node chạy tại một thời điểm.
- **"RPO và RTO của hệ thống bạn là bao nhiêu?"** Nếu không nắm số chính thức thì nói thẳng. Sau đó nói cách xác định: hỏi nghiệp vụ mất bao nhiêu phút dữ liệu thì chấp nhận được (với kết quả thi gần như bằng 0), bao lâu ngừng dịch vụ thì chấp nhận được, rồi chọn phương án và kiểm chứng bằng diễn tập failover.
- **"Ứng dụng kết nối thế nào để failover gần như trong suốt?"** Kết nối qua listener, `MultiSubnetFailover=True`, timeout kết nối hợp lý, retry lỗi tạm thời có backoff (`SqlRetryLogicOption` hoặc `EnableRetryOnFailure`). Transaction đang chạy lúc failover bị rollback, nên phải chạy lại cả khối, không chỉ lệnh cuối.
- **"Retry khi failover có nguy hiểm gì?"** Commit đã thành công nhưng client mất phản hồi; retry sẽ ghi lần hai. Chỉ retry thao tác idempotent, hoặc ghi theo khóa nghiệp vụ (applock, unique index, idempotency key) để lần ghi thứ hai trả lại kết quả cũ.
- **"Đưa truy vấn đọc sang secondary có vấn đề gì?"** Replication lag gây lỗi read-your-writes. Chỉ đưa sang secondary các truy vấn chấp nhận dữ liệu trễ (báo cáo, thống kê); luồng vừa ghi xong thì đọc từ primary.

#### Tóm tắt
- Nền tảng có 20+ service, nhiều pod, Redis Cluster; chưa chuẩn microservices vì DB dùng chung theo domain.
- Chọn HA theo RPO, RTO và chi phí; AG sync cho RPO ≈ 0.
- Basic AG: Standard, 2 replica, 1 DB, không đọc secondary. FCI: cả instance, storage chung.
- Ứng dụng: listener, `MultiSubnetFailover=True`, retry lỗi tạm thời, bọc cả transaction.
- Retry chỉ an toàn khi ghi idempotent.

#### Bài tập
1. Server chạy Standard Edition, nghiệp vụ yêu cầu không mất kết quả thi đã nộp và tự động failover. Chọn phương án và nêu giới hạn.
   **Đáp án:** Basic Availability Group, synchronous commit, failover tự động. Giới hạn: 2 replica, mỗi AG một database (nhiều DB thì nhiều AG), không đọc được secondary, phải tự đồng bộ login và job.
2. Viết connection string cho một service chỉ đọc báo cáo từ secondary qua listener.
   **Đáp án:** `Server=tcp:<listener>,1433;Database=<db>;MultiSubnetFailover=True;ApplicationIntent=ReadOnly;Encrypt=True`. Cần AG có readable secondary (Enterprise) và read-only routing.
3. Một lệnh `INSERT` kết quả thi bị timeout lúc failover; client retry và thấy hai bản ghi. Giải thích và nêu hai cách sửa.
   **Đáp án:** Lần đầu đã commit trên primary trước khi kết nối đứt; client không nhận phản hồi nên retry. Cách sửa: unique index theo (user, vòng) và bắt lỗi trùng để trả bản ghi cũ; hoặc `sp_getapplock` theo (user, vòng) kèm kiểm tra tồn tại trước khi insert.

## Chương 3. Hiệu năng và SQL

Đây là chương có nhiều bằng chứng thật nhất trên CV: một đợt audit hiệu năng trên 6 cụm SQL Server, các fix cache, và việc viết lại luồng attempt để bỏ join chéo database. Interviewer cho vị trí senior backend gần như chắc chắn chọn một trong các dòng này để hỏi sâu, vì đây là nơi lộ rõ ai đọc được execution plan và DMV, ai chỉ biết "thêm index".

Học xong chương này, bạn kể được quy trình APM → DMV → code, giải thích từng nguyên nhân gốc bằng cơ chế của SQL Server và Redis, và nói đúng phạm vi của từng con số.

### Bài 3.1. Audit 6 cụm SQL Server, exam-start 2,45 s → 55 ms
**Dòng CV:** "Led a 6-cluster SQL Server performance audit from APM spans to cached plans and wait stats, and drove the fixes: exam-start p95 fell from 2.45 s to 55 ms once a blocking Redis SCAN left the hot path."
**Trạng thái:** Một phần. Audit, xếp hạng điểm nóng và đề xuất cách sửa là của bạn. Ba fix ngày 16/09 do đồng nghiệp commit. Số 2,45 s → 55 ms lấy từ trace, không phải p95.

#### Mục tiêu
- Sau bài này, bạn trình bày được quy trình audit 3 bước: APM → DMV → đọc code.
- Bạn giải thích được vì sao 472 lệnh `SCAN` làm một API chậm tới 2,45 s, và vì sao Redis SET làm index sửa được.
- Bạn kể được 3–4 phát hiện tiêu biểu kèm cơ chế (heap thiếu index, leftmost prefix, linked server trong transaction, table variable).
- Bạn xếp hạng điểm nóng theo tổng chi phí thay vì theo thời gian một lần chạy.

#### Bối cảnh và việc thật đã làm

Tháng 09/2026, bạn rà soát hiệu năng toàn hệ thống dựa trên APM và DMV. Kết quả là một báo cáo kèm kế hoạch xử lý theo mức ưu tiên cho Dev và DBA (nguồn: mục 2).

**6 cụm theo vai trò:** log tự luyện và thi thử; core (user, danh mục, trường, feed); log thi chính thức; kho dữ liệu và báo cáo chứng nhận; user GDPT và đăng ký thi; ngân hàng câu hỏi, sinh đề và billing.

**Quy trình 3 bước:**

1. **Elastic APM:** lọc endpoint chậm, mở trace, xem thời gian theo span (SQL, Redis, HTTP, gRPC).
2. **DMV:** từ span SQL truy xuống `sys.dm_exec_procedure_stats`, plan đang cache, missing index, wait stats, tình trạng file log.
3. **Đọc code:** controller → proxy → implementation → stored procedure.

**API bắt đầu thi thử** (nguồn: mục 3.1): trace 2,45 s, trong đó có 472 lệnh `SCAN` và 17 lệnh `UNLINK`. Nguyên nhân: luồng trừ lượt thi gọi hàm làm mới cache gói, hàm này `SCAN` toàn keyspace để tìm key cần xóa. Cách sửa: giữ một Redis SET làm index các key liên quan, xóa trực tiếp từng key. Trace sau deploy: 55 ms, không còn `SCAN`, 17 lệnh `UNLINK` tốn 21 ms.

**Hai fix khác cùng ngày 16/09** (đồng nghiệp commit): API kết thúc game còn 9,9 ms nhờ chỉ giữ 1 procedure đồng bộ (1,6 ms), các ghi lịch sử chuyển sang chạy nền; API xác nhận kết quả tự luyện 71 → 31 ms nhờ đưa upload S3, HTTP và gRPC ra khỏi luồng chính.

**Phát hiện tiêu biểu khác:**

- Bảng chứng chỉ là HEAP 1,6 triệu dòng, không index nào bắt đầu bằng `userId`; procedure tra chứng chỉ chạy 2,87 triệu lần, trung bình 420 ms và khoảng 194 nghìn reads; DMV missing index báo impact 99,73%.
- Bảng kết quả luyện nói: index `(round, examOpenId, userId)` nhưng query lọc `round, userId`; mỗi lần khoảng 20 nghìn reads, trong khi DB luyện viết có index đúng `(round, userId)` chỉ 28 reads.
- Procedure cộng/trừ vật phẩm gọi linked server **trong transaction** đang giữ `UPDLOCK/HOLDLOCK`; wait MSQL_DQ cộng OLEDB chiếm 38,4% tổng thời gian chờ của instance; khi mạng chậm, lock bị giữ tới 30 s.
- Truy vấn câu hỏi theo mã đề dùng hơn 10 table variable; có spike khoảng 7,27 triệu reads.
- Biểu thức non-sargable dạng `AND 1 = (CASE WHEN … THEN 1 END)`.

#### Kiến thức nền

**Đọc trace APM.** Một trace là cây span. Tìm span chiếm nhiều thời gian nhất, rồi đếm số span: 472 span Redis giống nhau trong một request là dấu hiệu vòng lặp gọi mạng (giống N+1 trong SQL).

**Vì sao `SCAN` chậm dù không chặn như `KEYS`.** `KEYS pattern` duyệt toàn keyspace trong một lệnh, chặn event loop đơn luồng của Redis tới khi xong. `SCAN cursor MATCH pattern COUNT n` chỉ duyệt một phần mỗi lần gọi và trả cursor tiếp theo. Nhưng:

- `MATCH` lọc **sau khi** lấy phần tử ra, nên khi key khớp rất thưa, phải gọi rất nhiều lần mới duyệt hết.
- Duyệt hết keyspace vẫn là O(N) với N là tổng số key, chỉ là chia nhỏ ra nhiều round-trip.
- Trên Redis Cluster, `SCAN` chỉ chạy trên một node; muốn duyệt hết phải gọi trên từng master.

Nếu mỗi round-trip tốn 2–5 ms thì 472 vòng đã là 0,9–2,4 s. Gốc rễ là thuật toán O(kích thước keyspace) nằm trên đường nóng của mỗi request.

**Cách sửa bằng SET làm index** (minh họa cơ chế, không phải code thật):

```csharp
// Khi ghi một key cache gói của user: ghi thêm tên key vào SET index
string idx = $"pkg-idx:{userId}";
string key = $"pkg:{userId}:{serviceId}";
db.StringSet(key, json, TimeSpan.FromMinutes(60), flags: CommandFlags.FireAndForget);
db.SetAdd(idx, key, CommandFlags.FireAndForget);

// Khi cần làm mới: đọc index rồi xóa từng key, chi phí O(số key của user)
RedisValue[] members = await db.SetMembersAsync(idx);
foreach (var m in members)
    db.KeyDelete(m.ToString(), CommandFlags.FireAndForget);
db.KeyDelete(idx, CommandFlags.FireAndForget);
```

Đánh đổi: mỗi lần ghi key phải cập nhật SET. SET có thể chứa tên key đã hết hạn; vô hại vì xóa key không tồn tại không lỗi. Trên Redis Cluster, xóa nhiều key trong một lệnh chỉ được khi các key cùng hash slot (dùng hash tag như `{userId}`); xóa từng key thì không cần.

**Xếp hạng điểm nóng theo tổng chi phí.** Chi phí của một procedure = chi phí trung bình × số lần chạy. Procedure 420 ms chạy 2,87 triệu lần quan trọng hơn procedure 30 s chạy 3 lần. Sau tổng chi phí mới xét mức ảnh hưởng tới API người dùng, độ dễ sửa và rủi ro.

```sql
SELECT TOP 20 DB_NAME(ps.database_id) AS db,
       OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
       ps.execution_count,
       ps.total_logical_reads / ps.execution_count AS avg_reads,
       ps.total_elapsed_time / ps.execution_count / 1000.0 AS avg_ms,
       ps.total_worker_time / 1000 AS total_cpu_ms,
       ps.cached_time
FROM sys.dm_exec_procedure_stats ps
ORDER BY ps.total_logical_reads DESC;

SELECT TOP 20 wait_type, wait_time_ms / 1000 AS wait_s,
       100.0 * wait_time_ms / SUM(wait_time_ms) OVER () AS pct
FROM sys.dm_os_wait_stats
WHERE wait_type NOT LIKE 'SLEEP%'
ORDER BY wait_time_ms DESC;
```

Thời gian trong DMV tính bằng micro-giây. Wait stats cộng dồn từ lần khởi động instance; muốn xem một khoảng thời gian thì chụp hai lần rồi lấy hiệu.

**Leftmost prefix.** Index B-tree sắp theo cột đầu, rồi cột thứ hai trong cùng giá trị cột đầu. Với index `(RoundId, ExamOpenId, UserId)` và điều kiện `RoundId = @r AND UserId = @u`, SQL Server chỉ seek được theo `RoundId`; `UserId` thành residual predicate, phải đọc mọi dòng của round đó (khoảng 4,9 triệu dòng). Index `(RoundId, UserId)` seek thẳng tới vài dòng.

**Table variable.** Trước SQL Server 2019 (hoặc compatibility level dưới 150), optimizer ước lượng table variable có 1 dòng vì không có statistics, nên chọn nested loop cho cả nghìn dòng. Từ 2019, table variable deferred compilation dùng số dòng thật ở lần compile đầu, nhưng vẫn không có statistics cột. Cách sửa: `#temp` có index, hoặc `OPTION (RECOMPILE)`.

**Linked server trong transaction.** Lời gọi mạng nằm giữa `BEGIN TRAN` và `COMMIT` kéo dài thời gian giữ lock bằng thời gian mạng. Cách sửa: đọc dữ liệu từ xa trước, rồi mới mở transaction ngắn chỉ chứa phần ghi cục bộ.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Tôi dẫn đợt audit hiệu năng trên 6 cụm SQL Server. Quy trình là đi từ APM xuống: tìm endpoint chậm, xem span nào chiếm thời gian, truy span SQL xuống DMV để lấy số lần chạy, reads, plan và wait stats, rồi đọc code để tìm chuỗi gọi. Với API bắt đầu thi thử, trace 2,45 giây có 472 lệnh SCAN trên Redis do một hàm làm mới cache duyệt cả keyspace. Tôi đề xuất giữ một SET làm index để xóa thẳng từng key; đồng nghiệp commit fix, trace sau đó còn 55 ms và không còn SCAN. Đó là số của trace điển hình, chưa phải p95."

#### Đo để biến số minh họa thành số thật

Lấy p95 và p99 của API bắt đầu thi thử trên Elastic APM cho 7 ngày trước và 7 ngày sau 16/09/2026 (query ở Bài 2.1), ghi kèm throughput lúc cao điểm. Khi có số, câu CV đúng là: "cut exam-start API latency from p95 {a} ms to {b} ms over 7-day windows at {N} requests/min peak".

#### Bẫy

- Chữ "p95" trên CV khi số thật là một trace.
- Chữ "blocking Redis SCAN" trên CV: mỗi lệnh `SCAN` không chặn Redis lâu như `KEYS`. Cái "chặn" là vòng lặp đồng bộ trên đường nóng của request. Nói đúng cơ chế.
- Nói "tôi sửa" cho ba fix ngày 16/09. Đúng là "tôi tìm nguyên nhân và đề xuất, đồng nghiệp commit".
- Nhận các mục DBA trong báo cáo là đã xong khi chưa kiểm tra.

#### Câu hỏi phỏng vấn
- **"p95 trước và sau là bao nhiêu?"** Nói thật: số trên CV là thời gian một trace điển hình trước và sau fix. Tốt hơn là đo p95 trước buổi phỏng vấn trên Elastic APM, 7 ngày trước và sau ngày deploy, và nêu luôn cửa sổ đo.
- **"SCAN không chặn Redis như KEYS, vậy sao vẫn chậm?"** Mỗi lệnh `SCAN` chỉ duyệt một phần keyspace nên không chặn lâu. Nhưng 472 round-trip trong một request cộng lại thành hàng trăm ms tới giây, và mỗi lệnh vẫn chiếm event loop đơn luồng của Redis một chút. `MATCH` lọc sau khi lấy phần tử nên key khớp càng thưa càng phải gọi nhiều. Gốc rễ là thuật toán O(kích thước keyspace) trên đường nóng.
- **"Sao bạn chắc nguyên nhân là SCAN?"** Span Redis chiếm phần lớn thời gian trong trace, và có đúng 472 span `SCAN` giống nhau. Sau fix, trace không còn `SCAN` và tổng thời gian còn 55 ms; 17 lệnh `UNLINK` còn lại tốn 21 ms, khớp với phần còn lại.
- **"Bạn xếp hạng điểm nóng theo tiêu chí nào?"** Tổng chi phí trước (logical reads hoặc CPU trung bình nhân số lần chạy), rồi mức ảnh hưởng tới API người dùng, rồi độ dễ sửa và rủi ro. Một procedure 420 ms chạy 2,87 triệu lần đứng trên một procedure 30 s chạy vài lần.
- **"Sao không tăng connection pool cho đỡ timeout?"** Query chậm mà tăng pool thì càng nhiều connection dồn vào DB, càng tranh chấp CPU, lock và memory grant. Phải tối ưu query trước: query 2 ms thì một connection phục vụ được khoảng 500 request/giây.
- **"Sao không đánh index hết các bảng cho nhanh?"** Bảng log ghi liên tục mà thêm nonclustered index trên key ngẫu nhiên như `UserId` sẽ bị page split, write amplification và tăng WRITELOG; ở cụm log thi, WRITELOG đã chiếm khoảng 41% và THREADPOOL khoảng 46% thời gian chờ. Tôi chia theo access pattern: bảng chỉ ghi để HEAP hoặc clustered theo identity; bảng ghi dồn theo ca thi thì partition và đánh index sau ca; bảng vừa đọc vừa ghi dùng covering index gọn; nhu cầu tra cứu đưa sang replica. Đây là đề xuất trong báo cáo.

#### Tóm tắt
- Quy trình: APM tìm span chậm → DMV lấy số lần chạy, reads, plan, wait → đọc code tìm chuỗi gọi.
- Exam-start chậm vì 472 `SCAN` trên đường nóng; sửa bằng SET làm index, xóa thẳng từng key.
- Xếp hạng theo tổng chi phí = trung bình × số lần chạy.
- Phát hiện tiêu biểu: heap thiếu index, sai leftmost prefix, linked server trong transaction, table variable.
- Vai trò: bạn dẫn audit và đề xuất; đồng nghiệp commit ba fix; số là trace, không phải p95.

#### Bài tập
1. Xếp hạng theo tổng logical reads: procedure A chạy 2,87 triệu lần, 194.000 reads mỗi lần; procedure B chạy 81,16 triệu lần, 244 reads mỗi lần; procedure C chạy 4,95 triệu lần, 2.500 reads mỗi lần.
   **Đáp án:** A ≈ 556,8 tỷ reads; B ≈ 19,8 tỷ; C ≈ 12,4 tỷ. Thứ tự A, B, C. B có reads mỗi lần nhỏ nhưng vẫn đứng thứ hai vì số lần chạy.
2. Một query lọc `WHERE RoundId = @r AND UserId = @u`, index hiện có `(RoundId, ExamOpenId, UserId)`. Viết index phù hợp và giải thích vì sao index cũ không seek được theo `UserId`.
   **Đáp án:** `CREATE INDEX IX_x ON dbo.T (RoundId, UserId) INCLUDE (<cột cần trả>);`. Index cũ sắp theo `ExamOpenId` trước `UserId`, nên trong một `RoundId`, các dòng của một user nằm rải rác theo `ExamOpenId`; chỉ seek được tới đầu khoảng của `RoundId` rồi lọc tuần tự.
3. Viết pseudo-code làm mới cache gói của một user mà không dùng `SCAN`.
   **Đáp án:** Khi ghi key: `SET key value EX ttl` và `SADD idx:{user} key`. Khi làm mới: `SMEMBERS idx:{user}`, xóa từng key bằng `DEL` hoặc `UNLINK`, rồi xóa SET. Chi phí tỉ lệ với số key của user, không phụ thuộc kích thước keyspace.

### Bài 3.2. Hotfix trong ngày và index ca đêm
**Dòng CV:** "Split remediation into same-day hotfixes and night-window index builds with DBAs, as Standard Edition locks tables while indexing; peak CPU on the core cluster fell from 78% to 41%."
**Trạng thái:** Một phần. Kế hoạch 2 tầng (sửa procedure trong ngày, đánh index ca 23h–05h) là thật, nằm trong báo cáo. DBA đã đánh index chưa phải trả lời theo trạng thái thật. Số CPU 78% → 41% là minh họa.

#### Mục tiêu
- Sau bài này, bạn giải thích được vì sao trên Standard Edition phải tách sửa procedure và đánh index ra hai thời điểm.
- Bạn viết được ba mẫu hotfix: tách nhánh `IF/ELSE` cho biểu thức non-sargable, đổi RBAR sang set-based, giữ temp table caching.
- Bạn mô tả được quy trình đánh index ca đêm an toàn, và cách đo CPU trước và sau.
- Bạn nói được rủi ro parameter sniffing khi tách nhánh.

#### Bối cảnh và việc thật đã làm

- Server chạy **Standard Edition**, không có `ONLINE = ON`, nên `CREATE INDEX` khóa bảng. Báo cáo chia kế hoạch hai tầng: sửa procedure bằng `ALTER PROCEDURE` trong ngày; index giao DBA chạy trong cửa sổ 23h–05h (nguồn: mục 2).
- Các procedure được viết lại (nguồn: mục 4.4; **phải xác nhận ai viết**, vì procedure không nằm trong git và báo cáo chỉ ghi "Dev Team"):
  - Tra trường theo ID: bỏ biểu thức non-sargable bằng `IF/ELSE`; 825 → 3 logical reads, 14,9 → 0,12 ms trung bình, trên procedure có khoảng 13 triệu lần chạy trước khi sửa; số sau đo trên khoảng 29 nghìn lần chạy sau deploy.
  - Lấy điểm danh theo sự kiện: từ vòng `WHILE` + `OPENJSON` + `DELETE` từng dòng (trung bình khoảng 4,8 s) sang một câu set-based `CROSS APPLY OPENJSON`.
  - Lấy quan hệ user: bỏ `ALTER TABLE #t ADD …` (có lần chạy tới 20 s), thay bằng một `SELECT` với 2 `LEFT JOIN`, trung bình khoảng 7,9 ms.

#### Kiến thức nền

**Khóa khi tạo index offline.** Trên Standard Edition:

- Tạo **nonclustered** index giữ khóa S (shared) trên bảng: vẫn đọc được nhưng chặn mọi lệnh ghi.
- Tạo hoặc rebuild **clustered** index giữ khóa Sch-M (schema modification): chặn mọi truy cập, kể cả đọc.
- Online index operation, resumable index và **parallel index operation** đều là tính năng Enterprise. Trên Standard, việc tạo index chạy một luồng, nên thời gian chạy có thể dài hơn ước tính từ máy Enterprise.

**`ALTER PROCEDURE` deploy được giữa ngày** vì nó chỉ cần khóa schema trên chính procedure trong thời gian rất ngắn, không khóa bảng. Nó cũng xóa plan đang cache, nên dòng của procedure trong `sys.dm_exec_procedure_stats` bị reset: số đo sau deploy chỉ tính các lần chạy mới.

**Hotfix 1: biểu thức non-sargable.** Sargable nghĩa là optimizer dùng được điều kiện để seek index. Gói điều kiện trong `CASE` khiến nó không còn là phép so sánh trên cột:

```sql
-- Trước: không seek được, quét cả bảng
SELECT Id, Name FROM dbo.School
WHERE 1 = CASE WHEN @Id IS NOT NULL AND Id = @Id THEN 1
               WHEN @Id IS NULL AND ProvinceId = @ProvinceId THEN 1 END;

-- Sau: mỗi nhánh một câu sargable
IF @Id IS NOT NULL
    SELECT Id, Name FROM dbo.School WHERE Id = @Id;               -- seek PK
ELSE
    SELECT Id, Name FROM dbo.School WHERE ProvinceId = @ProvinceId;
```

**Parameter sniffing.** Lần chạy đầu, SQL Server compile **cả procedure**, mọi câu lệnh kể cả nhánh không chạy, theo giá trị tham số của lần đó. Nhánh chỉ dùng ở lần sau có thể mang plan tối ưu cho giá trị khác. Cách xử lý: tách mỗi nhánh thành procedure con (mỗi procedure có plan riêng, compile khi được gọi lần đầu), hoặc `OPTION (RECOMPILE)` cho nhánh hiếm. Phương án khác cho truy vấn nhiều điều kiện tùy chọn: dynamic SQL có tham số (`sp_executesql`).

**Hotfix 2: RBAR sang set-based.** RBAR (row by agonizing row) là xử lý từng dòng trong vòng lặp; mỗi vòng là một lần thực thi câu lệnh. Set-based để engine xử lý cả tập trong một plan:

```sql
SELECT a.EventId, j.UserId, j.CheckedAt
FROM dbo.Attendance a
CROSS APPLY OPENJSON(a.Payload)
     WITH (UserId bigint '$.userId', CheckedAt datetime2 '$.at') AS j
WHERE a.EventId = @EventId;
```

**Hotfix 3: temp table caching.** SQL Server cache lại cấu trúc `#temp` tạo trong procedure để lần sau không phải tạo mới metadata trong tempdb. Caching bị tắt khi có DDL sau lúc tạo bảng (`ALTER TABLE`, tạo index riêng bằng lệnh `CREATE INDEX` sau đó) hoặc có constraint được đặt tên. Mất caching thì mỗi lần chạy đều tạo và hủy metadata, gây tranh chấp trên các trang hệ thống của tempdb và recompile. Cách sửa: khai báo đủ cột ngay khi tạo, hoặc bỏ hẳn temp table nếu một câu `SELECT` với `JOIN` làm được.

**Quy trình đánh index ca đêm theo best practice:**

1. Thử trên bản sao dữ liệu thật để biết thời gian chạy và dung lượng cần (tempdb, log).
2. Mỗi đêm một vài bảng, bảng nhỏ trước. Dùng `SORT_IN_TEMPDB = ON` khi tempdb nằm trên ổ riêng.
3. Đặt thời gian chờ khóa để lệnh không xếp hàng vô hạn:

```sql
SET LOCK_TIMEOUT 60000;  -- chờ khóa tối đa 60 s rồi báo lỗi
CREATE NONCLUSTERED INDEX IX_Certificate_UserId
    ON dbo.Certificate (UserId) INCLUDE (CertType, IssuedAt)
    WITH (SORT_IN_TEMPDB = ON);
```

   Lý do: nếu một transaction dài đang giữ khóa ghi, lệnh `CREATE INDEX` phải chờ; các lệnh ghi mới đến sau sẽ xếp hàng sau yêu cầu khóa S đang chờ, và cả bảng bị kẹt.
4. Theo dõi blocking trong lúc chạy; có ngưỡng dừng nếu vượt cửa sổ 23h–05h.
5. Sáng hôm sau so plan và DMV của các procedure liên quan. Sau vài tuần, bỏ index không được dùng:

```sql
SELECT OBJECT_NAME(i.object_id) AS table_name, i.name AS index_name,
       s.user_seeks, s.user_scans, s.user_lookups, s.user_updates
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats s
       ON s.object_id = i.object_id AND s.index_id = i.index_id AND s.database_id = DB_ID()
WHERE OBJECTPROPERTY(i.object_id, 'IsUserTable') = 1 AND i.index_id > 1
ORDER BY ISNULL(s.user_seeks + s.user_scans + s.user_lookups, 0), s.user_updates DESC;
```

   Số liệu này reset khi instance khởi động lại; chỉ kết luận sau một chu kỳ tải đầy đủ.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Server chạy Standard Edition nên tạo index là khóa bảng: nonclustered chặn ghi, clustered chặn cả đọc. Vì vậy kế hoạch trong báo cáo của tôi chia hai tầng. Tầng một là sửa procedure trong ngày, vì ALTER PROCEDURE không khóa bảng: tách nhánh IF/ELSE cho điều kiện non-sargable, đổi vòng lặp từng dòng sang set-based, bỏ ALTER TABLE trên temp table. Tầng hai là index, giao DBA chạy ca 23h đến 5h, thử trước trên bản sao và làm từng bảng. Về trạng thái index ca đêm, [nói đúng trạng thái thật]."

#### Đo để biến số minh họa thành số thật

CPU theo phút trong khoảng 4 giờ gần nhất lấy từ ring buffer của scheduler monitor:

```sql
DECLARE @now bigint = (SELECT ms_ticks FROM sys.dm_os_sys_info);
SELECT TOP (240)
       DATEADD(ms, -1 * (@now - x.[timestamp]), GETDATE()) AS sample_time,
       x.rec.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu_pct,
       100 - x.rec.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS total_cpu_pct
FROM (SELECT [timestamp], CONVERT(xml, record) AS rec
      FROM sys.dm_os_ring_buffers
      WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
        AND record LIKE N'%<SystemHealth>%') AS x
ORDER BY x.[timestamp] DESC;
```

Ring buffer chỉ giữ vài giờ, nên phải chụp định kỳ hoặc dùng dashboard hạ tầng. So **cùng khung giờ cao điểm, cùng ngày trong tuần**, trước và sau, kèm throughput để chứng minh tải tương đương.

#### Bẫy

- Nói "CPU giảm từ 78% xuống 41%" khi chưa đo.
- Nói index ca đêm "đã chạy" khi chưa hỏi DBA.
- Nhận các procedure ở mục 4.4 là của mình khi chưa xác nhận ai viết.
- Khuyên giới hạn `MAXDOP` cho lệnh tạo index trên Standard: index build trên Standard vốn chạy một luồng.
- Nói "logical reads giảm 275 lần nên nhanh 275 lần".

#### Câu hỏi phỏng vấn
- **"Tách nhánh IF/ELSE có bị parameter sniffing không?"** Có thể. Lần chạy đầu compile cả procedure, mọi nhánh, theo giá trị tham số của lần đó. Xử lý: tách mỗi nhánh thành procedure con để có plan riêng, hoặc `OPTION (RECOMPILE)` cho nhánh hiếm; với truy vấn nhiều điều kiện tùy chọn thì dynamic SQL có tham số.
- **"Logical reads giảm thì CPU có giảm đúng tỉ lệ không?"** Không. Logical reads là số trang đọc từ buffer pool, không phải physical I/O; CPU còn phụ thuộc sort, hash, hàm, số dòng xử lý. Phải đo CPU và thời gian riêng: ở procedure tra trường, reads 825 → 3 còn thời gian trung bình 14,9 → 0,12 ms, hai tỉ lệ khác nhau.
- **"Sao không đánh index ban ngày, hoặc mua Enterprise để có ONLINE = ON?"** Standard không có online index, tạo index ban ngày là khóa bảng giữa giờ thi. Enterprise tính license theo core, chi phí rất lớn so với việc dời lịch đánh index sang 23h–05h. `ALTER PROCEDURE` chỉ khóa procedure trong thời gian rất ngắn nên vẫn deploy được trong ngày.
- **"DBA đã đánh index theo kế hoạch chưa?"** Trả lời theo trạng thái thật. Báo cáo là kế hoạch; không nhận những mục chưa làm là đã xong. Nếu chưa, nói mục nào còn treo và vì sao.
- **"Sau khi sửa procedure, bạn đo thế nào?"** `ALTER PROCEDURE` xóa plan cũ nên dòng trong `sys.dm_exec_procedure_stats` reset; số mới chỉ tính các lần chạy sau deploy (ví dụ khoảng 29 nghìn lần ở procedure tra trường). Đồng thời so trace APM trước và sau, và chạy thử với `SET STATISTICS IO, TIME ON`.
- **"Lệnh CREATE INDEX ban đêm chờ khóa sau một transaction dài thì chuyện gì xảy ra?"** Lệnh chờ khóa S trên bảng; các lệnh ghi mới đến sau xếp hàng sau nó, nên cả bảng bị kẹt dù index chưa bắt đầu tạo. Đặt `SET LOCK_TIMEOUT`, kiểm tra transaction đang mở trước khi chạy, theo dõi blocking và dừng nếu vượt ngưỡng.

#### Tóm tắt
- Standard Edition: tạo nonclustered index chặn ghi, clustered chặn mọi truy cập; không có online và parallel index operation.
- `ALTER PROCEDURE` deploy được giữa ngày và reset stats của procedure.
- Ba mẫu hotfix: tách nhánh sargable, RBAR sang set-based, giữ temp table caching.
- Index ca đêm: thử trên bản sao, từng bảng, `LOCK_TIMEOUT`, theo dõi blocking, bỏ index không dùng.
- CPU 78% → 41% là minh họa; số procedure ở mục 4.4 phải xác nhận ai viết.

#### Bài tập
1. Viết lại điều kiện sau cho sargable: `WHERE 1 = CASE WHEN @Code IS NOT NULL AND Code = @Code THEN 1 WHEN @Code IS NULL THEN 1 END`.
   **Đáp án:** `IF @Code IS NOT NULL SELECT … WHERE Code = @Code; ELSE SELECT …;` hoặc `WHERE (@Code IS NULL OR Code = @Code) OPTION (RECOMPILE)` để optimizer nhúng giá trị tham số mỗi lần chạy.
2. Một procedure tạo `#t (UserId bigint)`, sau đó `ALTER TABLE #t ADD Name nvarchar(100)`, rồi `UPDATE`. Nêu hai vấn đề và cách sửa.
   **Đáp án:** DDL sau khi tạo làm mất temp table caching (tạo lại metadata mỗi lần, tranh chấp tempdb) và gây recompile. Sửa: khai báo đủ cột ngay khi tạo, hoặc thay cả khối bằng một `SELECT` với `LEFT JOIN`.
3. Lập kế hoạch đo CPU để có thể viết "peak CPU fell from X% to Y%" một cách trung thực.
   **Đáp án:** Chọn khung giờ cao điểm cố định (ví dụ 19h–21h); thu CPU theo phút từ ring buffer hoặc dashboard trong 1–2 tuần trước và sau thay đổi, cùng ngày trong tuần; ghi throughput song song; báo cáo p95 của CPU theo phút trong khung giờ đó, không lấy một điểm đỉnh đơn lẻ.

### Bài 3.3. Procedure cấu hình chạy 81M lần: negative cache, version key
**Dòng CV:** "Traced a configuration procedure run 81M times to a 1 s TTL and never-cached empty results; fixing both cut its calls from 9,400 to 40 a minute with no new infrastructure."
**Trạng thái:** Một phần. Hai nguyên nhân gốc và cách sửa là của bạn (commit 21/09). "9.400 → 40 lần/phút" là minh họa.

#### Mục tiêu
- Sau bài này, bạn giải thích được chính xác ý nghĩa của "81 triệu lần" trong DMV.
- Bạn mô tả được hai lỗi cache (TTL 1 giây, list rỗng bị coi là miss) và cách sửa bằng negative caching.
- Bạn giải thích được version key cho cache gói cước và vì sao nó tránh được `SCAN`.
- Bạn xử lý được cache stampede và chọn đúng giữa Redis và MemoryCache.

#### Bối cảnh và việc thật đã làm

Commit 21/09 của bạn có ba phần (nguồn: mục 4.1–4.3):

**1. Procedure lấy danh mục môn và vòng.** DMV ghi khoảng 81,16 triệu lần chạy, mỗi lần 3,7 ms và 244 logical reads, cộng dồn khoảng 19,8 tỷ reads. Hai nguyên nhân gốc trong code:

- TTL dùng chung một biến có giá trị 1 giây, nên cache gần như vô dụng.
- Kết quả rỗng không bao giờ được cache, vì code coi list rỗng là cache miss.

Cách sửa: key V2 lưu JSON, cache được cả list rỗng; quy ước `null` là chưa có cache, list rỗng là đã cache kết quả rỗng; TTL 6 giờ; thêm hàm xóa cache để CMS gọi khi cấu hình đổi. Đánh đổi: dữ liệu cũ tối đa 6 giờ nếu CMS không gọi xóa, chấp nhận được với dữ liệu cấu hình.

**2. Cache gói cước.** Procedure lấy gói theo service chạy khoảng 4,95 triệu lần, mỗi lần 34 ms và khoảng 2.500 reads (do `STRING_SPLIT` và `XML PATH`). Cách sửa: cache Redis 60 phút, invalidate bằng version key. Đây là hot spot riêng, không cộng gộp với con số 81 triệu.

**3. Khử N+1 ở API chứng chỉ.** Danh mục chứng chỉ cache 24 giờ dùng chung cho 2 API; tên tỉnh, xã, trường dùng memo dictionary theo request; negative cache cho cặp (tỉnh, xã) không có dữ liệu trong MemoryCache 10 phút; TTL thành tích học sinh từ 2 lên 30 phút vì mỗi lần miss là một table scan khoảng 414 ms.

#### Kiến thức nền

**"81 triệu lần" nghĩa là gì.** `execution_count` trong `sys.dm_exec_procedure_stats` là số lần chạy **cộng dồn kể từ `cached_time`**, tức lúc plan được đưa vào cache. Nó reset khi plan bị đẩy khỏi cache, khi `ALTER PROCEDURE`, khi instance khởi động lại. Vì vậy 81 triệu không phải "số lần gọi đã loại bỏ", và không có đơn vị thời gian nếu không kèm `cached_time`.

**Cache-aside và negative caching.** Cache-aside: đọc cache; miss thì đọc DB rồi ghi vào cache. Lỗi phổ biến là dùng "rỗng" làm tín hiệu miss:

```csharp
// Lỗi: list rỗng bị coi là miss, nên tổ hợp không có cấu hình luôn gọi DB
var list = GetFromCache(key);
if (list != null && list.Count > 0) return list;
```

Negative caching nghĩa là cache cả kết quả "không có dữ liệu". Phân biệt "chưa có trong cache" (key không tồn tại) với "đã cache, kết quả rỗng" (key tồn tại, giá trị `[]`):

```csharp
public async Task<IReadOnlyList<SubjectRound>> GetRoundsAsync(int serviceId, int grade)
{
    string key = $"cfg:v2:rounds:{serviceId}:{grade}";
    RedisValue cached = await _redis.StringGetAsync(key);
    if (cached.HasValue)                                    // có key, kể cả "[]"
        return JsonSerializer.Deserialize<List<SubjectRound>>(cached.ToString())!;

    List<SubjectRound> rows = await _repo.GetRoundsAsync(serviceId, grade); // gọi procedure
    _redis.StringSet(key, JsonSerializer.Serialize(rows), TimeSpan.FromHours(6),
                     flags: CommandFlags.FireAndForget);    // list rỗng cũng được cache
    return rows;
}
```

Rủi ro: cấu hình vừa tạo vẫn bị coi là rỗng tới khi hết TTL. Xử lý: CMS gọi hàm xóa cache khi tạo hoặc sửa; hoặc TTL ngắn hơn cho kết quả rỗng.

**Version key.** Thay vì xóa theo pattern (cần `SCAN`, đúng bài học ở Bài 3.1), đặt số version vào tên key:

```csharp
long ver = (long)await _redis.StringGetAsync("pricing:ver");   // chưa có thì 0
string key = $"pricing:v{ver}:{serviceId}";
// ... cache-aside như trên với key này, TTL 60 phút

// CMS thêm, sửa, xóa hoặc đổi trạng thái gói:
_redis.StringIncrement("pricing:ver", flags: CommandFlags.FireAndForget);
```

Sau `INCR`, mọi lần đọc dùng version mới, key cũ không còn được đọc và tự hết hạn. Invalidate tốn O(1). Đánh đổi: mỗi lần đọc thêm một lệnh `GET` version; key cũ chiếm bộ nhớ tới khi hết TTL.

**Cache stampede.** Khi một key nóng hết hạn (hoặc version đổi), nhiều request cùng miss và cùng gọi DB. Cách xử lý:

- **Jitter:** cộng ngẫu nhiên vào TTL để các key không hết hạn cùng lúc.
- **Single-flight:** trong một process, các request cùng key chỉ chạy hàm nạp một lần. Nền tảng có sẵn cơ chế này ở dạng opt-in, chỉ trong phạm vi một pod (nguồn: B5):

```csharp
static readonly ConcurrentDictionary<string, Lazy<Task<T>>> Inflight = new();

var lazy = Inflight.GetOrAdd(key, k => new Lazy<Task<T>>(() => LoadAsync(k)));
try { return await lazy.Value; }
finally { Inflight.TryRemove(new KeyValuePair<string, Lazy<Task<T>>>(key, lazy)); }
```

- **Refresh trước khi hết hạn:** làm mới nền khi key còn ít thời gian sống.
- **Lock phân tán khi nạp:** `SET NX` một key lock, chỉ người giữ lock gọi DB; tốn thêm round-trip.

**Redis hay MemoryCache.** MemoryCache trả về **cùng một instance** cho mọi caller; nếu caller sửa object trả về, dữ liệu trong cache bị hỏng cho mọi request sau (đây là tình huống thật ở cache gói cước, nguồn: mục 4.2). Redis deserialize ra object mới mỗi lần đọc. Ngoài ra, nhiều pod cần invalidate cùng lúc khi CMS đổi cấu hình; MemoryCache nằm riêng trong từng pod.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Trong DMV, tôi thấy procedure lấy danh mục môn và vòng có khoảng 81 triệu lần chạy cộng dồn, mỗi lần 3,7 ms và 244 reads, dù đây là dữ liệu cấu hình gần như không đổi. Đọc code tôi tìm ra hai lỗi: TTL dùng chung biến 1 giây, và list rỗng bị coi là miss nên các tổ hợp không có cấu hình luôn xuống DB. Tôi đổi sang key mới lưu JSON, phân biệt key không tồn tại với kết quả rỗng, TTL 6 giờ, và thêm hàm xóa cache cho CMS. Cùng commit, tôi cache procedure gói cước 4,95 triệu lần chạy bằng version key để invalidate O(1) mà không cần SCAN. Con số 81 triệu là số cộng dồn trong DMV, không phải số lần gọi đã loại bỏ."

#### Đo để biến số minh họa thành số thật

Chụp DMV hai lần cách nhau đúng 1 giờ, cùng khung giờ trong ngày (roadmap 1.2):

```sql
SELECT OBJECT_NAME(object_id, database_id) AS proc_name,
       execution_count, cached_time, SYSDATETIME() AS sampled_at
FROM sys.dm_exec_procedure_stats
WHERE OBJECT_NAME(object_id, database_id) IN (N'<proc cấu hình môn/vòng>', N'<proc gói cước>');
```

Hiệu số `execution_count` chia 60 là số lần gọi mỗi phút. Kiểm tra `cached_time` không đổi giữa hai lần chụp; nếu đổi thì plan đã bị nạp lại và hiệu số sai. Tốc độ trước fix có thể ước từ báo cáo cũ: tổng số lần chạy chia cho thời gian từ `cached_time` tới lúc chụp.

#### Bẫy

- Nói "đã loại bỏ 81 triệu lần gọi".
- Cộng 81 triệu với 4,95 triệu thành một con số.
- Nói "giảm từ 9.400 xuống 40 lần/phút" khi chưa đo.
- Đề xuất "chỉ cần tăng TTL" mà quên negative caching.
- Dùng MemoryCache cho object mà caller sửa trực tiếp.

#### Câu hỏi phỏng vấn
- **"Sao không chỉ tăng TTL?"** TTL dài vẫn không cache kết quả rỗng, nên các tổ hợp không có cấu hình luôn miss và luôn gọi DB. Phải sửa cả hai: TTL hợp lý và negative caching.
- **"Negative cache có rủi ro gì?"** Cấu hình vừa được tạo vẫn bị coi là rỗng tới khi hết TTL. Xử lý: CMS gọi hàm xóa cache khi tạo hoặc sửa cấu hình; hoặc đặt TTL ngắn hơn cho kết quả rỗng.
- **"Khi key hết hạn, nhiều request cùng miss thì sao?"** Đó là cache stampede. Giải pháp: jitter cho TTL; single-flight hoặc lock khi nạp lại; refresh trước khi hết hạn. Single-flight trên nền tảng hiện chỉ gộp trong một pod; giữa các pod vẫn có thể cùng xuống DB.
- **"Version key cho bảng giá hoạt động thế nào?"** Key có dạng `pricing:v{n}:{service}`. CMS đổi gói thì `INCR` version; mọi lần đọc sau dùng version mới, key cũ không còn được đọc và tự hết hạn. Invalidate tốn O(1), không cần `SCAN`. Đánh đổi: thêm một lệnh `GET` version mỗi lần đọc.
- **"Sao dùng Redis mà không dùng MemoryCache?"** Caller sửa trực tiếp object trả về; MemoryCache trả chung một instance nên dữ liệu bị hỏng, Redis deserialize ra object mới. Thêm nữa, nhiều pod cần invalidate cùng lúc khi CMS đổi dữ liệu.
- **"81 triệu lần là trong bao lâu, và sau fix còn bao nhiêu?"** "81 triệu là số cộng dồn trong DMV kể từ lúc plan được cache, không phải số lần gọi đã loại bỏ. Mức giảm sau fix tôi theo dõi qua tốc độ tăng của execution_count: chụp hai lần cách nhau một giờ, cùng khung giờ." Nếu chưa đo thì nói chưa đo.

#### Tóm tắt
- `execution_count` cộng dồn từ `cached_time`; 81 triệu không phải số lần gọi đã loại bỏ.
- Hai lỗi: TTL 1 giây và list rỗng bị coi là miss. Sửa: phân biệt "không có key" với `[]`, TTL 6 giờ, hàm xóa cho CMS.
- Version key: `INCR` để invalidate O(1), không `SCAN`.
- Stampede: jitter, single-flight (trong một pod), refresh sớm, lock khi nạp.
- Redis thay MemoryCache vì caller sửa object và nhiều pod cần invalidate.

#### Bài tập
1. Kiểm tra con số "khoảng 19,8 tỷ reads" từ 81,16 triệu lần chạy và 244 reads mỗi lần.
   **Đáp án:** 81,16 × 10⁶ × 244 ≈ 1,98 × 10¹⁰, tức khoảng 19,8 tỷ logical reads.
2. Giả định lần chụp 1 có `execution_count` = 81.160.000 lúc 10:00, lần chụp 2 có 81.724.000 lúc 11:00, `cached_time` không đổi. Tính số lần gọi mỗi phút.
   **Đáp án:** (81.724.000 − 81.160.000) / 60 = 9.400 lần/phút. Đây là số giả định để luyện cách tính, không phải số đo.
3. Viết hàm đọc cache gói cước theo version key, gồm cả nhánh miss.
   **Đáp án:** `ver = GET pricing:ver` (null là 0) → `key = pricing:v{ver}:{service}` → `GET key`; có giá trị thì deserialize; không có thì gọi procedure, `SET key json EX 3600`, trả kết quả. CMS chỉ `INCR pricing:ver`.

### Bài 3.4. Bỏ 12 stored procedure join chéo database
**Dòng CV:** "Removed 12 cross-database stored procedures from the attempt flow so its 4 databases can live on separate servers: C# composes the reads, one atomic write rechecks quota under lock."
**Trạng thái:** Thật. Chuỗi commit V3 ngày 21–24/08 là của bạn. Lớp Redis mutex và idempotency key phía trên do đồng nghiệp viết. Các commit V3 có co-author là AI. Cờ rollback đã bị hard-code `true` ngay ngày 24/08.

#### Mục tiêu
- Sau bài này, bạn giải thích được vì sao join chéo database là rủi ro khi tách DB sang server khác.
- Bạn mô tả được thiết kế V3: các lần đọc do C# điều phối, đúng một lần ghi atomic qua table-valued parameter.
- Bạn chứng minh được thiết kế không có race khi hai request song song, mà không cần distributed transaction.
- Bạn kể trung thực chuyện cờ rollback và vai trò của AI.

#### Bối cảnh và việc thật đã làm

(nguồn: mục 5)

- Hệ thống Mastery tách 4 database theo vai trò: đề thi, ngân hàng câu hỏi, tích hợp, log.
- DB tích hợp có 18 procedure, trong đó 12 cái join chéo sang DB khác. Review dự án yêu cầu **không join chéo hai database**.
- **Thiết kế V3:** C# điều phối 12 bước: 4 lần đọc DB đề, 2 lần đọc DB câu hỏi, 1 lần đọc DB tích hợp, rồi **đúng 1 lần ghi**. Lần ghi nhận danh sách câu đã chọn qua table-valued parameter.
- Một planner xử lý 4 quyết định theo ma trận đề; một selector chọn câu từ pool.
- Phần chấm vẫn nằm ở DB câu hỏi; DB tích hợp chỉ nhận đúng/sai, nên đáp án không ra khỏi DB câu hỏi.
- Lần ghi chạy trong transaction `XACT_ABORT ON`, `UPDLOCK, HOLDLOCK`, và **kiểm tra lại** cooldown, quota ngày, thứ tự attempt.
- Script deploy: kiểm tra đúng tên DB, sai thì `THROW`; chạy theo thứ tự đánh số; chạy lại nhiều lần vẫn an toàn.
- Rollback: lúc rollout có cờ đọc từ config; bạn hard-code cờ thành `true` ngay ngày 24/08, nên muốn rollback phải deploy lại.
- Code được Claude Code sinh nháp theo plan từng pha; bạn review, chạy trên DB dev và sửa cho khớp procedure V3.

#### Kiến thức nền

**Vì sao không join chéo database.** Câu `JOIN OtherDb.dbo.T` chạy được khi hai DB cùng instance. Khi tách DB sang server khác, câu đó phải đi qua linked server (`Server.Db.dbo.T`), gặp đúng vấn đề ở Bài 3.1: wait MSQL_DQ/OLEDB, lock bị giữ trong lúc chờ mạng, optimizer ước lượng kém với dữ liệu từ xa. Join chéo còn làm mờ ranh giới sở hữu: không biết DB nào "chủ" của dữ liệu, đổi schema một DB làm vỡ procedure ở DB khác.

**Điều phối đọc ở C#.** Các lần đọc độc lập chạy song song, mỗi lần một kết nối riêng:

```csharp
var matrixTask = _examRepo.GetMatrixAsync(activityId, ct);      // DB đề
var poolTask   = _questionRepo.GetPoolAsync(bankId, ct);        // DB câu hỏi
var stateTask  = _integrationRepo.GetUserStateAsync(userId, ct); // DB tích hợp
await Task.WhenAll(matrixTask, poolTask, stateTask);

var plan     = AttemptPlanner.Plan(matrixTask.Result, stateTask.Result);  // 4 quyết định
var selected = QuestionSelector.Select(plan, poolTask.Result);
```

Không dùng chung một `SqlConnection` cho các lệnh song song; mỗi repository mở kết nối riêng từ pool.

**Table-valued parameter (TVP).** Truyền nhiều dòng vào procedure trong một lần gọi qua một user-defined table type, thay vì gọi nhiều lần hoặc ghép chuỗi:

```sql
CREATE TYPE dbo.SelectedQuestionList AS TABLE
(
    OrderNo    int    NOT NULL PRIMARY KEY,
    QuestionId bigint NOT NULL
);
```

```csharp
var table = new DataTable();
table.Columns.Add("OrderNo", typeof(int));
table.Columns.Add("QuestionId", typeof(long));
for (int i = 0; i < selected.Count; i++) table.Rows.Add(i + 1, selected[i].Id);

await using var cmd = new SqlCommand("dbo.usp_Attempt_Create", conn)
    { CommandType = CommandType.StoredProcedure };
cmd.Parameters.Add("@UserId", SqlDbType.BigInt).Value = userId;
var p = cmd.Parameters.Add("@Questions", SqlDbType.Structured);
p.TypeName = "dbo.SelectedQuestionList";
p.Value = table;
```

TVP là tham số chỉ đọc (`READONLY`) trong procedure.

**Một lần ghi, kiểm tra lại dưới khóa** (minh họa cơ chế, tên object là giả):

```sql
CREATE OR ALTER PROCEDURE dbo.usp_Attempt_Create
    @UserId bigint, @ActivityId int, @DailyQuota int, @CooldownSec int,
    @Questions dbo.SelectedQuestionList READONLY
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRAN;

    DECLARE @usedToday int, @lastAt datetime2;
    SELECT @usedToday = COUNT(*), @lastAt = MAX(CreatedAt)
    FROM dbo.Attempt WITH (UPDLOCK, HOLDLOCK)
    WHERE UserId = @UserId AND ActivityId = @ActivityId
      AND CreatedAt >= CAST(SYSDATETIME() AS date);

    IF @usedToday >= @DailyQuota THROW 50010, N'Hết lượt trong ngày', 1;
    IF @lastAt > DATEADD(second, -@CooldownSec, SYSDATETIME()) THROW 50011, N'Chưa hết cooldown', 1;

    DECLARE @AttemptId bigint;
    INSERT dbo.Attempt (UserId, ActivityId, CreatedAt) VALUES (@UserId, @ActivityId, SYSDATETIME());
    SET @AttemptId = SCOPE_IDENTITY();

    INSERT dbo.AttemptQuestion (AttemptId, OrderNo, QuestionId)
    SELECT @AttemptId, OrderNo, QuestionId FROM @Questions;

    COMMIT;
    SELECT @AttemptId AS AttemptId;
END
```

`UPDLOCK` giữ khóa update trên các dòng đọc được; `HOLDLOCK` (tương đương serializable) giữ khóa phạm vi tới hết transaction, kể cả khoảng chưa có dòng, nên request thứ hai phải chờ request đầu commit rồi mới đếm lại. Khóa phạm vi chỉ hẹp khi có index phù hợp trên `(UserId, ActivityId, CreatedAt)`; thiếu index, phạm vi khóa có thể lan rộng. `XACT_ABORT ON` bảo đảm mọi lỗi đều rollback toàn bộ.

**Script deploy an toàn khi chạy lại:**

```sql
:on error exit
IF DB_NAME() <> N'<tên DB tích hợp>'
    THROW 50000, N'Sai database, dừng script', 1;
GO
CREATE OR ALTER PROCEDURE dbo.usp_Attempt_Create ...
```

`:on error exit` (chế độ SQLCMD) hoặc chạy `sqlcmd -b` để lỗi ở batch đầu dừng cả script; nếu không, `THROW` chỉ dừng batch hiện tại và các batch sau `GO` vẫn chạy. `CREATE OR ALTER` giúp chạy lại không lỗi.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Luồng attempt của Mastery dùng 4 database và 12 trong 18 procedure ở DB tích hợp join chéo sang DB khác. Review dự án yêu cầu bỏ join chéo để các DB có thể tách server mà không phải đi qua linked server. Tôi viết lại thành V3: C# điều phối các lần đọc từ DB đề, DB câu hỏi và DB tích hợp, planner và selector chọn câu, rồi đúng một lần ghi nhận danh sách câu qua table-valued parameter. Lần ghi đó kiểm tra lại quota, cooldown và thứ tự attempt dưới UPDLOCK, HOLDLOCK, nên hai request song song không cùng vượt quota. Lớp Redis mutex và idempotency key phía trên do đồng nghiệp viết. Tôi dùng Claude Code sinh nháp theo plan, tự review và chạy trên DB dev."

#### Bẫy

- Nhận lớp Redis mutex và idempotency key là của mình.
- Nói "có rollback switch" mà không nói nó đã bị hard-code.
- Nói "AI không tham gia" khi commit có co-author AI.
- Nói các lần đọc trước "đảm bảo nhất quán". Chúng chỉ mang tính tham khảo; tính đúng nằm ở lần ghi.

#### Câu hỏi phỏng vấn
- **"Đọc trước rồi ghi sau, có race condition không?"** Lần ghi chạy trong transaction `XACT_ABORT ON`, `UPDLOCK, HOLDLOCK` và kiểm tra lại cooldown, quota, thứ tự attempt. Request thứ hai phải chờ request đầu commit rồi mới đếm lại, nên hai request song song không thể cùng vượt quota. Các lần đọc trước chỉ để lập kế hoạch.
- **"Table-valued parameter là gì, sao không truyền chuỗi JSON?"** TVP truyền nhiều dòng vào procedure trong một lần gọi qua một user-defined table type, có kiểu dữ liệu và khóa chính rõ ràng. Không phải gọi nhiều lần, không phải ghép chuỗi rồi parse trong SQL. JSON cũng làm được nhưng phải parse và không có kiểu cho tới lúc `OPENJSON ... WITH`.
- **"Nhiều round-trip hơn join chéo, có chậm hơn không?"** 7 lần đọc cộng 1 lần ghi thay vì 1 lần gọi. Các lần đọc độc lập chạy song song bằng `Task.WhenAll`, nên độ trễ gần bằng lần đọc chậm nhất. Đổi lại: ranh giới sở hữu dữ liệu rõ, tách DB sang server khác không cần linked server.
- **"Có rollback switch không?"** Lúc rollout có cờ đọc từ config. Tôi đã hard-code cờ thành `true` ngay trong ngày 24/08 sau khi chạy ổn trên dev, nên hiện muốn rollback phải deploy lại. Nếu làm lại, tôi giữ cờ trong config tới hết đợt live đầu tiên.
- **"Ghi xong mà bước sau lỗi thì sao, và sao không dùng saga hay outbox?"** Chỉ có một lần ghi, atomic, nên không có trạng thái ghi dở. Saga chỉ cần khi có nhiều bước ghi ở nhiều nơi phải bù trừ; outbox cần khi phải phát event chắc chắn cùng lần ghi. Luồng này chỉ cần một lần ghi.
- **"Code này AI viết hay bạn viết?"** Tôi dùng Claude Code sinh nháp theo plan từng pha; tôi review từng diff, chạy trên DB dev và sửa cho khớp procedure V3. Tôi giải thích được từng dòng, và tôi chịu trách nhiệm về thiết kế.

#### Tóm tắt
- Join chéo database thành linked server khi tách server: chậm, giữ lock lâu, mờ ranh giới sở hữu.
- V3: C# điều phối đọc song song, planner và selector, đúng một lần ghi qua TVP.
- Tính đúng nằm ở lần ghi: `XACT_ABORT ON`, `UPDLOCK, HOLDLOCK`, kiểm tra lại quota và cooldown.
- Script deploy kiểm tra tên DB, dừng khi lỗi, chạy lại an toàn.
- Nói thật: Redis mutex của đồng nghiệp, AI sinh nháp, cờ rollback đã hard-code.

#### Bài tập
1. Viết user-defined table type và lệnh C# truyền danh sách 3 câu hỏi vào procedure qua TVP.
   **Đáp án:** `CREATE TYPE dbo.SelectedQuestionList AS TABLE (OrderNo int NOT NULL PRIMARY KEY, QuestionId bigint NOT NULL);` Trong C#: `DataTable` hai cột, `Parameters.Add("@Questions", SqlDbType.Structured)`, `TypeName = "dbo.SelectedQuestionList"`, `Value = table`, `CommandType.StoredProcedure`.
2. Hai request cùng user gửi cách nhau 5 ms, quota ngày còn 1 lượt. Mô tả từng bước điều xảy ra trong procedure ghi.
   **Đáp án:** Request A vào transaction, `SELECT ... WITH (UPDLOCK, HOLDLOCK)` giữ khóa phạm vi, đếm còn 1 lượt, insert, commit. Request B chờ ở câu `SELECT` vì khóa của A; sau khi A commit, B đọc thấy đã hết lượt và `THROW`. Chỉ một attempt được tạo.
3. Script deploy có `IF DB_NAME() <> N'X' THROW ...; GO CREATE OR ALTER PROCEDURE ...`. Chạy nhầm trên DB khác bằng SSMS ở chế độ thường thì chuyện gì xảy ra?
   **Đáp án:** `THROW` chỉ dừng batch đầu; batch sau `GO` vẫn chạy và tạo procedure trên sai DB. Cần `:on error exit` ở chế độ SQLCMD, chạy `sqlcmd -b`, hoặc lặp lại kiểm tra trong từng batch.

## Chương 4. Tính đúng và độ tin cậy

Chương 3 nói về nhanh; chương này nói về đúng và bền. Bốn dòng CV ở đây có mức độ thật rất khác nhau: ghi kết quả một lần bằng applock là thật; Polly, Testcontainers merge gate và SLO burn-rate alert là minh họa. Interviewer thường dùng chính các chủ đề này để kiểm tra chiều sâu senior: idempotency, retry an toàn, kiểm thử với hạ tầng thật, và đo độ tin cậy bằng SLO.

Học xong chương này, bạn kể được phần thật về ghi idempotent, và trả lời được ở mức thiết kế, theo best practice, cho các dòng chưa làm mà không mâu thuẫn với code thật.

### Bài 4.1. Nộp bài an toàn khi retry: applock, Lua CAS, idempotency
**Dòng CV:** "Made exam submission retry-safe: a Redis Lua compare-and-swap keeps one active session per user and sp_getapplock makes results insert-once; duplicate results fell from ~1.2K a day to zero."
**Trạng thái:** Một phần. Applock insert-once là của bạn (sự kiện Here I Come, commit 02–09/10). Lua compare-and-swap là lớp có sẵn: bạn hiểu và dùng, không tự viết. "~1,2K/ngày → 0" là minh họa.

#### Mục tiêu
- Sau bài này, bạn giải thích được ba lớp bảo vệ: Redis Lua CAS cho phiên, `SET NX` có token cho lock ngắn, `sp_getapplock` cho ghi một lần ở DB.
- Bạn viết được procedure insert-once bằng applock và giải thích từng tham số.
- Bạn phân biệt được idempotent write với exactly-once delivery.
- Bạn so sánh được applock, `UPDLOCK, HOLDLOCK` và unique index.

#### Bối cảnh và việc thật đã làm

**Here I Come 2026–2027** (của bạn, commit 02–09/10; nguồn: mục 6):

- 7 chặng, mỗi chặng là một ca thi, mỗi chặng có 2 đề (tiểu học, THCS–THPT). Dưới 60% thì làm lại không giới hạn; từ 60% trở lên thì khóa chặng.
- Ghi một lần: `sp_getapplock` với key theo (user, vòng), kết hợp `UPDLOCK/HOLDLOCK`, nên mỗi (user, vòng) chỉ có một bản ghi kết quả. Request kết thúc bài bị retry, hoặc client mất phản hồi rồi gửi lại, thì server **trả bản ghi đã có** thay vì ghi thêm.
- Mỗi lần làm chặng định danh bằng sessionId, không dùng `startTime` vì có thể trùng.
- Ràng buộc đã chốt với nghiệp vụ: **không tạo object DB mới** trên bảng dùng chung, nên không thêm unique index.
- Vòng quay: tạo user vòng quay trong transaction có `UPDLOCK`, nên retry không reset số lượt quay.

**Lớp có sẵn trong nền tảng** (nguồn: B3, B5): Lua CAS giữ một phiên thi đang hoạt động cho mỗi user; lock ngắn bằng `SET NX` có token (trộn đề 15 s, ghi đáp án 5 s); ở luồng Mastery có idempotency key 24 giờ cho start, answer, submit.

#### Kiến thức nền

**Vì sao cần idempotency.** Mạng có thể mất phản hồi sau khi server đã xử lý xong. Client không biết nên gửi lại. Với API nộp bài, gửi lại không được tạo thêm kết quả. Idempotent nghĩa là gọi nhiều lần cho cùng hiệu ứng như gọi một lần.

**Lớp 1: một phiên hoạt động mỗi user, bằng Lua CAS.** Mỗi user có một key ghi sessionId đang hoạt động cho từng vòng. Script chạy nguyên tử trên Redis:

```lua
-- KEYS[1]: khóa phiên của (user, vòng)
-- ARGV[1]: sessionId mong đợi, ARGV[2]: sessionId mới, ARGV[3]: TTL (giây)
local cur = redis.call('GET', KEYS[1])
if (not cur) or cur == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return 1
end
return 0
```

Nếu làm `GET` rồi `SET` bằng hai lệnh riêng, hai tab hoặc hai thiết bị có thể cùng đọc thấy rỗng và cùng chiếm phiên. Lua chạy nguyên khối, không lệnh nào chen vào giữa. Lần nộp từ phiên cũ bị từ chối vì sessionId không còn khớp.

**Lớp 2: lock ngắn bằng `SET NX` có token.** Lấy lock: `SET lock:{key} <token> NX EX 5`. Nhả lock chỉ khi giá trị vẫn là token của mình:

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
```

Không có kiểm tra token, request A có thể xóa nhầm lock của request B khi lock của A đã hết hạn và B vừa lấy được. TTL ngắn để process chết thì lock tự nhả.

**Lớp 3: ghi một lần ở DB bằng applock.**

```sql
SET XACT_ABORT ON;
DECLARE @res nvarchar(255) = CONCAT(N'result:', @UserId, N':', @RoundId);
DECLARE @rc int;

BEGIN TRAN;
EXEC @rc = sp_getapplock @Resource = @res, @LockMode = 'Exclusive',
                         @LockOwner = 'Transaction', @LockTimeout = 5000;
IF @rc < 0 THROW 50001, N'Không lấy được lock', 1;

IF EXISTS (SELECT 1 FROM dbo.Result WITH (UPDLOCK, HOLDLOCK)
           WHERE UserId = @UserId AND RoundId = @RoundId)
    SELECT ResultId, Score FROM dbo.Result
    WHERE UserId = @UserId AND RoundId = @RoundId;          -- trả bản ghi đã có
ELSE
    INSERT dbo.Result (UserId, RoundId, Score, SessionId, CreatedAt)
    OUTPUT inserted.ResultId, inserted.Score
    VALUES (@UserId, @RoundId, @Score, @SessionId, SYSDATETIME());
COMMIT;
```

- `@Resource`: tên logic, tối đa 255 ký tự; khóa theo (user, vòng) nên chỉ serialize các request cùng key, không khóa bảng.
- `@LockOwner = 'Transaction'`: lock tự nhả khi commit hoặc rollback.
- Giá trị trả về: 0 là lấy được ngay, 1 là lấy được sau khi chờ, âm là thất bại (-1 hết thời gian chờ, -2 bị hủy, -3 bị chọn làm nạn nhân deadlock, -999 lỗi tham số).

**Idempotency key ở tầng HTTP.** Client gửi header (ví dụ `Idempotency-Key`) cố định cho một thao tác; server lưu (key → kết quả) trong một khoảng thời gian; request lặp lại nhận kết quả cũ. Key phải gắn với user và nội dung request để không trả nhầm kết quả của request khác.

**Exactly-once hay at-least-once.** Không có exactly-once delivery qua mạng. Message hoặc request có thể đến nhiều lần (at-least-once); hiệu ứng nghiệp vụ chỉ xảy ra một lần nhờ ghi idempotent theo khóa nghiệp vụ. Thuật ngữ đúng là **idempotent write** hoặc **insert-once**.

**Unique index, nếu được sửa schema:**

```sql
CREATE UNIQUE INDEX UX_Result_User_Round ON dbo.Result (UserId, RoundId);
-- Trong procedure: INSERT; nếu lỗi 2601 hoặc 2627 (trùng khóa) thì SELECT bản ghi đã có.
```

Tạo unique index sẽ thất bại nếu bảng đã có bản ghi trùng; phải dọn trùng trước.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Ở sự kiện Here I Come, mỗi user mỗi vòng chỉ được có một kết quả, nhưng request kết thúc bài có thể bị retry. Ràng buộc là không tạo object mới trên bảng dùng chung, nên tôi không thêm unique index được. Tôi dùng sp_getapplock theo khóa (user, vòng) trong transaction, kiểm tra tồn tại với UPDLOCK, HOLDLOCK; có rồi thì trả bản ghi cũ, chưa có thì insert. Phía trên, nền tảng có sẵn một script Lua compare-and-swap giữ một phiên hoạt động cho mỗi user; tôi dùng lớp đó, không tự viết. Đây là ghi idempotent, không phải exactly-once delivery."

#### Đo để biến số minh họa thành số thật

Đếm cặp (user, vòng) bị trùng theo ngày, trước và sau thay đổi (chạy trên bản sao hoặc ngoài giờ cao điểm):

```sql
SELECT CAST(CreatedAt AS date) AS d, COUNT(*) AS dup_pairs
FROM (SELECT UserId, RoundId, MIN(CreatedAt) AS CreatedAt
      FROM dbo.Result
      GROUP BY UserId, RoundId
      HAVING COUNT(*) > 1) AS x
GROUP BY CAST(CreatedAt AS date)
ORDER BY d;
```

Nếu trước thay đổi không có trùng nào, dòng CV phải bỏ phần "~1.2K a day".

#### Bẫy

- Nói "tôi viết Lua CAS".
- Gọi cơ chế này là "exactly-once".
- Nói "~1,2K bản ghi trùng mỗi ngày" khi chưa đếm.
- Dùng `HOLDLOCK` trên dòng chưa tồn tại mà không có index phù hợp, rồi tin là đã khóa đúng phạm vi.
- Nhả lock Redis bằng `DEL` không kiểm tra token.

#### Câu hỏi phỏng vấn
- **"Sao không dùng unique index?"** Unique index là cách tốt nhất nếu được sửa schema. Ràng buộc ở đây là không tạo object mới trên bảng dùng chung, nên dùng applock: chỉ serialize theo từng key (user, vòng), không khóa bảng.
- **"Applock khác UPDLOCK, HOLDLOCK thế nào?"** Applock khóa theo một tên logic, kể cả khi chưa có dòng nào. `HOLDLOCK` trên dòng chưa tồn tại phải dựa vào key-range lock, cần index phù hợp mới khóa đúng phạm vi; thiếu index thì phạm vi khóa có thể lan rộng hoặc không như ý.
- **"Đây có phải exactly-once không?"** Không. Request hoặc message có thể đến nhiều lần (at-least-once); ghi nhận nghiệp vụ chỉ xảy ra một lần nhờ khóa theo key nghiệp vụ. Thuật ngữ đúng là idempotent write.
- **"Script Lua có làm nghẽn Redis không?"** Script chỉ có `GET` và `SET` trên một key, O(1), chạy vài micro-giây. Script dài mới nguy hiểm vì Redis chạy script nguyên khối, chặn mọi client khác trong lúc chạy.
- **"Mất Redis thì sao?"** Hệ thống chậm hơn và có thể cho mở 2 phiên, nhưng kết quả vẫn chỉ ghi một lần vì DB giữ tính đúng đắn. Redis lo phần nhanh và giảm tranh chấp; DB lo phần đúng.
- **"Sao không dùng Redlock cho lock phân tán?"** Chỉ có một Redis cluster, và lock Redis chỉ dùng để giảm tranh chấp. Tính đúng cuối cùng do DB bảo đảm bằng applock hoặc `UPDLOCK`, nên không cần Redlock với chi phí và tranh cãi về độ an toàn của nó.

#### Tóm tắt
- Ba lớp: Lua CAS cho phiên, `SET NX` có token cho lock ngắn, applock cho ghi một lần.
- Applock theo (user, vòng), owner là transaction, kiểm tra tồn tại rồi mới insert; có rồi thì trả bản ghi cũ.
- Idempotent write, không phải exactly-once delivery.
- Unique index là lựa chọn tốt nhất khi được sửa schema.
- Của bạn: applock ở Here I Come. Có sẵn: Lua CAS, lock token, idempotency key.

#### Bài tập
1. Viết script Lua nhả lock chỉ khi token khớp, và giải thích lỗi xảy ra nếu dùng `DEL` thẳng.
   **Đáp án:** `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`. Dùng `DEL` thẳng: lock của A hết hạn, B lấy lock, A xong việc và xóa lock của B, request C vào được trong khi B vẫn đang chạy.
2. `sp_getapplock` trả về -1. Ứng dụng nên làm gì?
   **Đáp án:** Hết thời gian chờ (5 s): có request khác cùng (user, vòng) đang giữ lock. Procedure `THROW`, ứng dụng trả lỗi có thể retry; client retry sau một khoảng ngắn sẽ nhận bản ghi đã có.
3. Bảng kết quả đã có 300 cặp trùng. Nghiệp vụ đồng ý thêm unique index. Liệt kê các bước.
   **Đáp án:** Chốt quy tắc giữ bản ghi nào (ví dụ bản ghi đầu tiên); script xóa hoặc chuyển bản ghi thừa sang bảng lưu trữ, có preview và rollback; tạo unique index ngoài giờ cao điểm (Standard Edition khóa bảng); sửa procedure bắt lỗi 2601/2627 để trả bản ghi cũ.

### Bài 4.2. Polly, rate limit ở YARP, degrade khi service phía sau sập
**Dòng CV:** "Hardened calls across 20+ microservices with Polly timeouts, retries, and circuit breakers, plus rate limits at the YARP API gateway; a 20-minute downstream outage kept exam APIs at 99.9% success."
**Trạng thái:** Minh họa. Chưa triển khai. Liên quan và có thật: ở fix API cập nhật thông tin GDPT (commit 22/09), bạn cố ý **không đặt deadline** cho lời gọi gRPC gửi event, dùng chung `GrpcChannel` và đẩy lời gọi ra khỏi luồng request.

#### Mục tiêu
- Sau bài này, bạn mô tả được pipeline resilience chuẩn của .NET và thứ tự các lớp.
- Bạn nói được khi nào retry an toàn, cách cấu hình circuit breaker, bulkhead và timeout.
- Bạn cấu hình được rate limit cho route YARP, trả đúng `429` và `Retry-After`.
- Bạn trả lời nhất quán với quyết định thật "không đặt deadline cho gRPC event".

#### Bối cảnh và việc thật đã làm

Fix API cập nhật thông tin GDPT (commit 22/09, của bạn; nguồn: mục 3.2):

- Mỗi lần gửi event gRPC lại tạo `GrpcChannel` mới; đoạn đồng bộ trước `await` đầu tiên giữ thread của request khoảng 9 ms. Sửa: dùng chung một `GrpcChannel` (tạo mới tốn socket và handshake HTTP/2), gửi event trong `Task.Run` để ra khỏi luồng HTTP.
- **Cố ý không đặt deadline:** service nhận event có lúc chậm tới 3,6 s; đặt deadline sẽ làm rơi event, tức đổi hành vi nghiệp vụ. Vì đã chạy nền nên request không bị giữ.
- Số liệu: báo cáo chỉ ghi mục tiêu "dự kiến dưới 60 ms"; chưa đo lại bằng APM thì không nói là đã đạt.

Không có Polly, rate limit YARP hay số 99,9% nào là thật.

#### Kiến thức nền

**Pipeline resilience chuẩn (.NET 8 trở lên).** Gói `Microsoft.Extensions.Http.Resilience` (xây trên Polly v8):

```csharp
services.AddHttpClient<IScoreClient, ScoreClient>()
        .AddStandardResilienceHandler(o =>
        {
            o.AttemptTimeout.Timeout      = TimeSpan.FromSeconds(2);
            o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(6);
            o.Retry.MaxRetryAttempts      = 2;
        });
```

Thứ tự từ ngoài vào trong: rate limiter → total request timeout → retry → circuit breaker → attempt timeout. Ý nghĩa: total timeout giới hạn cả chuỗi retry; attempt timeout giới hạn từng lần thử; circuit breaker nằm trong retry nên mỗi lần thử đều được breaker tính. Gói có kiểm tra cấu hình, ví dụ cửa sổ lấy mẫu của circuit breaker phải đủ dài so với attempt timeout.

**Retry.** Chỉ retry lỗi tạm thời (timeout, 5xx, 408, 429) và chỉ với thao tác idempotent hoặc có idempotency key. Dùng exponential backoff kèm jitter để các client không retry cùng lúc (retry storm). Giới hạn số lần: mỗi lớp retry nhân tải lên lớp dưới; 3 lớp mỗi lớp retry 3 lần thì một request gốc có thể thành 4³ = 64 lời gọi.

**Circuit breaker.** Ba trạng thái: closed (cho qua), open (từ chối ngay, không gọi), half-open (cho vài lời gọi thử). Mở khi tỉ lệ lỗi vượt ngưỡng trong cửa sổ lấy mẫu **và** đủ lưu lượng tối thiểu (tránh mở vì 1 lỗi trên 2 request). Sau thời gian nghỉ chuyển half-open; thử thành công thì đóng lại.

**Bulkhead.** Giới hạn số lời gọi đồng thời tới từng dependency (Polly có concurrency limiter), để một dependency chậm không chiếm hết thread và connection của cả service.

**Deadline cho gRPC.** gRPC dùng deadline thay cho timeout và truyền deadline sang server:

```csharp
await client.PushEventAsync(request, deadline: DateTime.UtcNow.AddSeconds(2));
```

Quy tắc nhất quán với quyết định thật: lời gọi **đồng bộ trên đường request** phải có deadline; lời gọi gửi event đã tách khỏi request thì không đặt deadline ngắn, vì đặt deadline sẽ làm rơi event. Cách tốt hơn cho event là hàng đợi bền (Kafka hoặc outbox) để không mất event khi process chết.

**Rate limit ở YARP.** YARP chạy trong ASP.NET Core nên dùng middleware rate limiting có sẵn:

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;   // mặc định là 503
    o.OnRejected = (ctx, _) =>
    {
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            ctx.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
        return ValueTask.CompletedTask;
    };
    o.AddPolicy("per-user", ctx => RateLimitPartition.GetTokenBucketLimiter(
        ctx.User.FindFirst("sub")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 20,
            TokensPerPeriod = 10,
            ReplenishmentPeriod = TimeSpan.FromSeconds(1),
            QueueLimit = 0
        }));
});

app.UseRateLimiter();
app.MapReverseProxy();
```

Gắn policy cho route trong cấu hình YARP:

```json
"ReverseProxy": {
  "Routes": {
    "exam": {
      "ClusterId": "exam-cluster",
      "RateLimiterPolicy": "per-user",
      "Match": { "Path": "/exam/{**catch-all}" }
    }
  }
}
```

Token bucket cho phép burst tới `TokenLimit` rồi giới hạn theo tốc độ nạp. Partition theo user (claim `sub`), fallback theo IP.

**Giới hạn của middleware:** bộ đếm nằm trong bộ nhớ từng pod. 5 pod mỗi pod cho 10 request/giây thì một user có thể đạt 50. Muốn giới hạn toàn cục thì token bucket trên Redis bằng script Lua (đọc số token, tính lượng nạp theo thời gian, trừ một token, nguyên tử).

**Degrade.** "99,9% khi service phía sau sập 20 phút" chỉ đạt được nếu luồng thi **không phụ thuộc đồng bộ** vào service đó. Thiết kế: tính năng phụ (feed, ruby) tắt được bằng cờ; lời gọi tới service phụ có fallback (bỏ qua, trả mặc định) khi breaker mở; event đi qua hàng đợi bền để xử lý bù.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Phần Polly và rate limit ở gateway tôi chưa triển khai ở production. Việc thật gần nhất là fix API cập nhật thông tin GDPT: tôi dùng chung GrpcChannel và đẩy lời gọi gửi event ra khỏi luồng request, và cố ý không đặt deadline vì service nhận có lúc chậm 3,6 giây, deadline sẽ làm rơi event. Nếu làm resilience đầy đủ, tôi dùng standard resilience handler cho lời gọi đồng bộ: attempt timeout, retry có jitter chỉ cho thao tác idempotent, circuit breaker; event thì đưa qua hàng đợi bền thay vì gọi trực tiếp; rate limit token bucket theo user ở YARP, trả 429 kèm Retry-After."

#### Bẫy

- Nói "mọi lời gọi đều có timeout" trong khi code thật cố ý không đặt deadline cho gRPC event.
- Retry cho `POST` nộp bài không có idempotency key.
- Quên rằng `RejectionStatusCode` mặc định là `503`, và `Retry-After` không tự có.
- Tin rằng rate limit trong bộ nhớ pod là giới hạn toàn cục.
- Nói "99,9%" mà không định nghĩa thành công là gì và đo trong cửa sổ nào.

#### Câu hỏi phỏng vấn
- **"Khi nào không được retry?"** Thao tác không idempotent và không có idempotency key (nộp bài, trừ tiền); lỗi do dữ liệu (400, 422); khi breaker đang mở; khi đã hết total timeout. Retry luôn có backoff kèm jitter và giới hạn số lần, và chỉ ở một lớp nếu được, để tránh nhân tải.
- **"Circuit breaker hoạt động thế nào, mở theo tiêu chí gì?"** Closed cho qua và đếm lỗi; mở khi tỉ lệ lỗi vượt ngưỡng trong cửa sổ lấy mẫu và đủ lưu lượng tối thiểu; open thì từ chối ngay; sau thời gian nghỉ chuyển half-open cho vài lời gọi thử, thành công thì đóng. Mục đích: không dồn thêm tải vào service đang hỏng và trả lỗi nhanh cho caller.
- **"Timeout nên đặt ngoài hay trong retry?"** Cả hai: total timeout ở ngoài giới hạn cả chuỗi retry theo ngân sách thời gian của request; attempt timeout ở trong giới hạn từng lần thử. Chỉ có timeout ngoài thì một lần thử treo ăn hết ngân sách; chỉ có timeout trong thì chuỗi retry có thể kéo dài quá lâu.
- **"Bạn có 5 pod gateway, rate limit mỗi user 10 request/giây được không?"** Middleware của ASP.NET Core đếm trong bộ nhớ từng pod, nên user có thể đạt 50 request/giây. Muốn chính xác toàn cục thì token bucket trên Redis bằng Lua; hoặc chấp nhận xấp xỉ bằng cách chia giới hạn cho số pod nếu load balancer phân phối đều.
- **"Code thật của bạn không đặt deadline cho gRPC, vậy có mâu thuẫn với việc dùng timeout không?"** Không, nếu phân biệt hai loại lời gọi. Lời gọi đồng bộ trên đường request phải có deadline. Lời gọi gửi event đã tách khỏi request; đặt deadline ngắn làm rơi event vì service nhận có lúc chậm 3,6 s. Hướng đúng hơn là đưa event vào hàng đợi bền để vừa không giữ request vừa không mất event.
- **"Làm sao giữ API thi 99,9% khi một service phía sau sập 20 phút, và đo thế nào?"** Luồng thi không gọi đồng bộ service đó; tính năng phụ tắt bằng cờ hoặc fallback khi breaker mở; event đi qua hàng đợi để xử lý bù. Đo: tỉ lệ request không lỗi 5xx của các API thi trên APM trong đúng cửa sổ sự cố, kèm định nghĩa thành công. Đây là thiết kế, tôi chưa có số đo.

#### Tóm tắt
- Standard resilience handler: rate limiter → total timeout → retry → circuit breaker → attempt timeout.
- Retry chỉ cho thao tác idempotent, có backoff và jitter, giới hạn số lần.
- Rate limit YARP qua middleware ASP.NET Core; đặt `429` và `Retry-After` tường minh; bộ đếm nằm trong từng pod.
- Lời gọi đồng bộ có deadline; event chạy nền không đặt deadline ngắn, nên đưa vào hàng đợi bền.
- Dòng CV là Minh họa: nói ở mức thiết kế.

#### Bài tập
1. Gateway có 3 lớp: YARP → service A → service B. Mỗi lớp retry tối đa 2 lần (3 lần thử). B sập. Một request của user tạo ra tối đa bao nhiêu lời gọi tới B?
   **Đáp án:** 3 × 3 = 9 lời gọi tới B: YARP gọi A tối đa 3 lần, mỗi lần A gọi B tối đa 3 lần. Thêm một lớp nữa thì thành 27. Cách sửa: chỉ retry ở một lớp, có circuit breaker để ngừng gọi khi B đã sập.
2. Viết cấu hình token bucket cho phép burst 30 request rồi 5 request/giây cho mỗi user.
   **Đáp án:** `TokenLimit = 30`, `TokensPerPeriod = 5`, `ReplenishmentPeriod = TimeSpan.FromSeconds(1)`, `QueueLimit = 0`, partition theo claim `sub`.
3. Liệt kê những gì phải thay đổi để luồng nộp bài không bị ảnh hưởng khi service ruby sập.
   **Đáp án:** Bỏ lời gọi đồng bộ tới service ruby khỏi luồng nộp bài; ghi event cộng ruby vào outbox trong cùng transaction với kết quả hoặc publish lên Kafka; worker xử lý bù khi service ruby sống lại; cờ tắt tính năng ruby; consumer cộng ruby phải idempotent.

### Bài 4.3. xUnit, Testcontainers và merge gate
**Dòng CV:** "Introduced xUnit and Testcontainers integration tests (SQL Server, Redis, Kafka) for the exam engine as a Jenkins merge gate; escaped defects per release fell from 9 to 2."
**Trạng thái:** Minh họa. Thật: có integration harness chạy trên SQL fixture cho logic sự kiện và ma trận đề; phần lớn còn lại kiểm thử tay trên dev; unit test của codebase cũ ít.

#### Mục tiêu
- Sau bài này, bạn mô tả trung thực hiện trạng kiểm thử và hướng cải thiện.
- Bạn dựng được fixture Testcontainers cho SQL Server và Redis trong xUnit, dùng chung container giữa nhiều test.
- Bạn giải thích được kim tự tháp test và áp TDD đúng chỗ.
- Bạn định nghĩa được "escaped defect" và cách lấy số.

#### Bối cảnh và việc thật đã làm

(nguồn: mục 12, mục 14)

- Có integration harness chạy trên SQL fixture cho logic sự kiện và ma trận đề.
- Phần còn lại kiểm thử tay trên dev. Unit test của codebase cũ ít; không thấy unit test nào của bạn trong repo.
- Mọi repo dùng chung một Jenkins shared library để build và deploy.
- Hướng cải thiện đã ghi nhận: test cho procedure (tSQLt hoặc fixture) và contract test cho API.

#### Kiến thức nền

**Vì sao container thật thay vì giả lập.** Logic nằm nhiều trong stored procedure, lock và Redis script. EF InMemory hay SQLite không chạy được T-SQL, `sp_getapplock`, `UPDLOCK`; mock Redis không chạy Lua. Container chạy đúng engine production, nên test bắt được lỗi locking, kiểu dữ liệu, plan.

**Fixture dùng chung container (xUnit v2):**

```csharp
public sealed class DbFixture : IAsyncLifetime
{
    public MsSqlContainer Sql { get; } = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest").Build();
    public RedisContainer Redis { get; } = new RedisBuilder()
        .WithImage("redis:7").Build();

    public async Task InitializeAsync()
    {
        await Task.WhenAll(Sql.StartAsync(), Redis.StartAsync());
        // Chạy script schema và stored procedure theo thứ tự đánh số.
        // Script có dòng GO phải tách theo GO, vì SqlCommand không hiểu GO.
    }

    public async Task DisposeAsync()
    {
        await Sql.DisposeAsync();
        await Redis.DisposeAsync();
    }
}

[CollectionDefinition("db")]
public sealed class DbCollection : ICollectionFixture<DbFixture> { }

[Collection("db")]
public sealed class SubmitResultTests(DbFixture fx)
{
    [Fact]
    public async Task Second_submit_returns_existing_result() { /* gọi procedure 2 lần, kiểm tra 1 dòng */ }
}
```

`ICollectionFixture` cho mọi test trong collection dùng chung một bộ container (khởi động container mất vài giây đến vài chục giây). Giữa các test, xóa dữ liệu bằng Respawn (`Respawner.CreateAsync` một lần, `ResetAsync` trước mỗi test) thay vì dựng lại database.

**Kim tự tháp test:**

- Unit test cho logic thuần: planner, selector, tính quota và cooldown. Nhanh, nhiều.
- Integration test cho procedure + Redis + Kafka với container.
- Contract test cho API giữa các service.
- Rất ít end-to-end.

**TDD đúng chỗ.** Red → green → refactor. Áp cho logic thuần có bảng case rõ:

```csharp
[Theory]
[InlineData(0, 3, true)]
[InlineData(2, 3, true)]
[InlineData(3, 3, false)]
public void CanStart_respects_daily_quota(int usedToday, int quota, bool expected)
    => Assert.Equal(expected, AttemptRules.CanStart(usedToday, quota));
```

Logic phụ thuộc thời gian dùng `TimeProvider` (.NET 8) để test không phụ thuộc giờ thật:

```csharp
var time = new FakeTimeProvider(new DateTimeOffset(2026, 9, 1, 8, 0, 0, TimeSpan.Zero));
var rule = new CooldownRule(TimeSpan.FromMinutes(10), time);
var lastAttempt = time.GetUtcNow();
time.Advance(TimeSpan.FromMinutes(9));
Assert.False(rule.CanRetry(lastAttempt));
```

Không ép TDD cho code nối dây hay giao diện.

**Merge gate trên Jenkins.** Agent có Docker (Testcontainers cần Docker daemon); pipeline chạy:

```bash
dotnet test --configuration Release --logger "trx;LogFileName=results.trx" --results-directory TestResults
```

Xuất kết quả để Jenkins hiển thị; branch chỉ merge được khi pipeline xanh (cấu hình ở hệ thống quản lý mã nguồn).

**Escaped defect.** Bug phát hiện trên production, gắn với release đã đưa nó vào. Số "9 → 2" chỉ có nghĩa khi có định nghĩa này và lấy từ bug tracker, so số release tương đương.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Nói thật về kiểm thử: hiện chúng tôi có integration harness chạy trên SQL fixture cho logic sự kiện và ma trận đề, còn lại phần lớn kiểm thử tay trên dev, và codebase cũ ít unit test. Merge gate với Testcontainers tôi chưa triển khai. Nếu làm, tôi bắt đầu từ chỗ rủi ro nhất là procedure ghi kết quả và luồng attempt: fixture dựng SQL Server và Redis bằng Testcontainers, dùng chung theo collection, Respawn xóa dữ liệu giữa các test; unit test với bảng case cho planner và tính quota; Jenkins chặn merge khi test đỏ."

#### Bẫy

- Nói "tôi giới thiệu Testcontainers" khi chưa làm.
- Nói "lỗi lọt giảm từ 9 xuống 2" mà không có định nghĩa và bug tracker.
- Tạo container mới cho mỗi test: chậm, dễ timeout trên CI.
- Dùng `Thread.Sleep` để chờ consumer Kafka xử lý xong.

#### Câu hỏi phỏng vấn
- **"Bạn test stored procedure thế nào?"** Container SQL Server thật, chạy script schema và procedure theo thứ tự, gọi procedure như ứng dụng gọi, kiểm tra dữ liệu sau đó. Lựa chọn khác: tSQLt, viết test bằng T-SQL ngay trong database. Hiện tại tôi có harness trên SQL fixture cho logic sự kiện và ma trận đề.
- **"Test chạy bao lâu, chạy song song được không?"** Chia sẻ container theo collection; các collection chạy song song, mỗi collection dùng database riêng để không đụng dữ liệu. Thời gian khởi động container trả một lần cho cả collection.
- **"Xử lý test flaky thế nào?"** Mỗi test tự tạo dữ liệu riêng; không phụ thuộc giờ thật (dùng `TimeProvider` của .NET 8); chờ theo điều kiện có timeout thay vì `Thread.Sleep`; không phụ thuộc thứ tự chạy test.
- **"Sao không dùng EF InMemory hoặc SQLite cho nhanh?"** Logic chính nằm trong T-SQL, applock, `UPDLOCK` và script Lua; InMemory và SQLite không chạy được những thứ đó, nên test xanh nhưng production vẫn lỗi. Container chậm hơn nhưng đúng engine.
- **"Con số lỗi lọt 9 xuống 2 bạn lấy ở đâu?"** Nếu dòng còn trên CV: "Phần này tôi chưa triển khai, nên chưa có số." Theo best practice, escaped defect là bug phát hiện trên production gắn với release, lấy từ bug tracker, so trên số release tương đương trước và sau.

#### Tóm tắt
- Thật: harness trên SQL fixture cho sự kiện và ma trận đề; phần lớn test tay; ít unit test.
- Testcontainers chạy đúng engine: T-SQL, lock, Lua; dùng chung container qua `ICollectionFixture`, Respawn giữa các test.
- Kim tự tháp: nhiều unit test cho logic thuần, integration cho procedure và Redis, ít end-to-end.
- TDD cho logic thuần với `[Theory]`; `TimeProvider` cho logic theo thời gian.
- Escaped defect phải có định nghĩa và nguồn.

#### Bài tập
1. Viết bảng case `[Theory]` cho quy tắc: dưới 60% thì làm lại không giới hạn, từ 60% trở lên thì khóa chặng.
   **Đáp án:** `[InlineData(0, false)]`, `[InlineData(59.9, false)]`, `[InlineData(60, true)]`, `[InlineData(100, true)]` cho `IsStageLocked(scorePercent)`. Có case biên 59,9 và 60.
2. Viết test integration kiểm tra procedure ghi kết quả là insert-once.
   **Đáp án:** Gọi procedure hai lần (hoặc song song bằng `Task.WhenAll`) cùng (user, vòng); kiểm tra `SELECT COUNT(*)` theo (user, vòng) bằng 1 và hai lần gọi trả cùng `ResultId`.
3. Pipeline Jenkins báo Testcontainers không kết nối được Docker. Nêu hai nguyên nhân thường gặp.
   **Đáp án:** Agent không có Docker daemon hoặc user chạy job không có quyền dùng Docker socket; agent chạy trong container mà không mount Docker socket hoặc không cấu hình Docker-in-Docker.

### Bài 4.4. Postmortem, SLO, burn-rate alert, OpenTelemetry
**Dòng CV:** "Ran the postmortem for that slowdown and set SLOs on 6 exam APIs, tracked with OpenTelemetry traces, Grafana dashboards, and burn-rate alerts; peak-season pages fell from 14 to 2 a month."
**Trạng thái:** Minh họa. Chưa có postmortem, SLO, burn-rate alert hay số page. Muốn biến thành thật: viết postmortem cho đợt API bắt đầu thi 2,45 s, đề xuất SLO cho các API thi, đếm số alert/page hiện có làm mốc.

#### Mục tiêu
- Sau bài này, bạn phân biệt được SLI, SLO, SLA và error budget, và tính được error budget.
- Bạn viết được SLI latency bằng histogram Prometheus và hiểu ràng buộc về bucket.
- Bạn giải thích được burn-rate alert nhiều cửa sổ và nguồn gốc các ngưỡng 14,4, 6, 1.
- Bạn cấu hình được OpenTelemetry trong .NET và viết được khung postmortem blameless.

#### Bối cảnh và việc thật đã làm

Hiện trạng thật của observability (nguồn: B1, mục 14): Elastic APM cho trace theo request; Prometheus cho metric của worker Kafka; log ứng dụng đi NLog → Kafka → Elasticsearch. Chưa có SLO hay burn-rate alert do bạn đặt. Sự cố có thể dùng để viết postmortem thật: API bắt đầu thi thử mất 2,45 s do `SCAN` (Bài 3.1).

#### Kiến thức nền

**SLI, SLO, SLA.**

- **SLI** (indicator): số đo, ví dụ tỉ lệ request bắt đầu thi trả lời thành công trong dưới 250 ms.
- **SLO** (objective): mục tiêu nội bộ cho SLI, ví dụ 99% trong cửa sổ 30 ngày.
- **SLA** (agreement): cam kết với khách hàng, có chế tài; thường lỏng hơn SLO.

**Vì sao SLO latency viết dạng tỉ lệ thay vì "p95 < 300 ms".** Tỉ lệ request tốt là phép đếm: cộng được giữa các pod và các khoảng thời gian, tính được error budget. Percentile không cộng được.

**Đo bằng histogram.** .NET 8 phát metric `http.server.request.duration` (Prometheus: `http_server_request_duration_seconds`), label route là `http_route`. Tỉ lệ request nhanh hơn ngưỡng:

```promql
sum(rate(http_server_request_duration_seconds_bucket{http_route="/exam/start", le="0.25"}[5m]))
/
sum(rate(http_server_request_duration_seconds_count{http_route="/exam/start"}[5m]))
```

Ngưỡng `le` phải trùng một biên bucket. Biên mặc định của metric này gồm 0,1, 0,25, 0,5 giây…, không có 0,3. Muốn ngưỡng 300 ms phải khai báo bucket riêng:

```csharp
.WithMetrics(m => m
    .AddAspNetCoreInstrumentation()
    .AddView("http.server.request.duration",
        new ExplicitBucketHistogramConfiguration { Boundaries = [0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5] }))
```

**Error budget** = 1 − SLO. SLO 99,9% trong 30 ngày cho phép 0,1% request xấu; quy ra thời gian: 30 × 24 × 60 × 0,001 = 43,2 phút.

**Burn rate** = tỉ lệ lỗi hiện tại / tỉ lệ lỗi cho phép. Burn rate 1 nghĩa là tiêu hết budget đúng sau 30 ngày. Ngưỡng theo SRE Workbook cho SLO 99,9%, cửa sổ 30 ngày (720 giờ):

| Mức | Tiêu bao nhiêu budget | Cửa sổ dài / ngắn | Burn rate | Hành động |
|---|---|---|---|---|
| Nhanh | 2% trong 1 giờ | 1 giờ / 5 phút | 0,02 × 720 / 1 = 14,4 | Page |
| Vừa | 5% trong 6 giờ | 6 giờ / 30 phút | 0,05 × 720 / 6 = 6 | Page |
| Chậm | 10% trong 3 ngày | 3 ngày / 6 giờ | 0,10 × 720 / 72 = 1 | Ticket |

Alert chỉ kêu khi **cả hai** cửa sổ vượt ngưỡng: cửa sổ dài bảo đảm đủ ý nghĩa, cửa sổ ngắn giúp alert tự tắt nhanh khi sự cố đã hết.

```yaml
groups:
- name: exam-start-slo
  rules:
  - record: slo:exam_start_bad_ratio:rate1h
    expr: |
      1 - sum(rate(http_server_request_duration_seconds_bucket{http_route="/exam/start",le="0.25"}[1h]))
        / sum(rate(http_server_request_duration_seconds_count{http_route="/exam/start"}[1h]))
  - record: slo:exam_start_bad_ratio:rate5m
    expr: |
      1 - sum(rate(http_server_request_duration_seconds_bucket{http_route="/exam/start",le="0.25"}[5m]))
        / sum(rate(http_server_request_duration_seconds_count{http_route="/exam/start"}[5m]))
  - alert: ExamStartFastBurn
    expr: slo:exam_start_bad_ratio:rate1h > (14.4 * 0.001) and slo:exam_start_bad_ratio:rate5m > (14.4 * 0.001)
    labels:
      severity: page
```

Request lỗi (5xx) cũng phải tính là xấu; thường tách một SLI availability riêng hoặc lọc theo status code.

**Postmortem blameless.** Mục đích là sửa hệ thống, không tìm người có lỗi. Khung: tóm tắt; tác động (bao nhiêu user, bao lâu); timeline (phát hiện, chẩn đoán, khắc phục); nguyên nhân gốc và yếu tố góp phần; điều làm tốt; điều may mắn; action item có người chịu trách nhiệm và hạn.

**OpenTelemetry trong .NET:**

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSqlClientInstrumentation()
        .SetSampler(new ParentBasedSampler(new TraceIdRatioBasedSampler(0.1)))
        .AddOtlpExporter())
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddRuntimeInstrumentation()
        .AddPrometheusExporter());

app.MapPrometheusScrapingEndpoint();   // endpoint /metrics cho Prometheus
```

- Context truyền qua header W3C `traceparent` trên HTTP và gRPC tự động. Với Kafka phải tự gắn context vào header của message khi produce và lấy ra khi consume.
- Sampling head-based (`ParentBased` + `TraceIdRatioBased`) rẻ nhưng quyết định từ đầu nên có thể bỏ sót trace lỗi; tail-based ở OpenTelemetry Collector quyết định sau khi trace xong, giữ được trace lỗi hoặc chậm, đổi lại Collector phải đệm trace.

**Grafana.** Mỗi API một dashboard RED: Rate, Errors, Duration. Tài nguyên theo USE: Utilization, Saturation, Errors.

#### Cách nói trong phỏng vấn

> **Ví dụ:** "Phần SLO và burn-rate alert tôi chưa triển khai. Hệ thống hiện dùng Elastic APM cho trace và Prometheus cho metric của worker Kafka. Nếu đặt SLO cho API bắt đầu thi, tôi viết SLI dạng tỉ lệ request thành công dưới một ngưỡng latency, lấy ngưỡng từ baseline p95 hiện tại, đặt SLO trên cửa sổ 30 ngày, và page theo burn rate nhiều cửa sổ: 14,4 trên 1 giờ và 5 phút, 6 trên 6 giờ và 30 phút, ticket khi 1 trên 3 ngày. Sự cố đầu tiên tôi muốn viết postmortem là đợt API bắt đầu thi 2,45 giây do SCAN."

#### Đo để biến số minh họa thành số thật

- Viết postmortem cho đợt 2,45 s theo khung blameless (roadmap 3.4).
- Lấy baseline p95/p99 của các API thi trên Elastic APM làm cơ sở chọn ngưỡng.
- Đếm số alert và số page mỗi tháng hiện có trên hệ thống cảnh báo, theo mùa thi, làm mốc trước khi thay đổi.

#### Bẫy

- Viết `le="0.3"` khi histogram không có bucket 0,3.
- Lấy trung bình p95 của nhiều pod.
- Page theo nguyên nhân (CPU cao) thay vì theo triệu chứng người dùng thấy.
- Nói "page giảm từ 14 xuống 2" khi chưa có hệ thống on-call để đếm.

#### Câu hỏi phỏng vấn
- **"Đang có Elastic APM, sao còn thêm OpenTelemetry?"** OpenTelemetry là chuẩn mở, không khóa vào một vendor: instrument một lần, đổi backend bằng cấu hình exporter. Elastic APM nhận được OTLP nên không phải bỏ hệ thống cũ.
- **"Ngưỡng 300 ms cho SLO lấy từ đâu?"** Từ baseline p95/p99 hiện tại, từ thời gian chờ người dùng chấp nhận khi bắt đầu thi, và từ chi phí để đạt được. SLO quá chặt thì đội luôn chữa cháy; quá lỏng thì không phản ánh trải nghiệm. Ngưỡng phải trùng một biên bucket của histogram.
- **"Page giảm từ 14 xuống 2 nhờ đâu?"** Nếu chưa làm thì nói chưa làm, rồi nêu cách theo best practice: bỏ alert theo nguyên nhân, chỉ page theo triệu chứng (burn rate của SLO); gộp và khử trùng alert cùng một sự cố; alert không cần xử lý ngay thì chuyển thành ticket; mỗi page có runbook; alert không ai hành động thì xóa sau buổi review hằng tuần; đo bằng số page mỗi tháng trên hệ thống on-call, so cùng mùa thi.
- **"Vì sao SLO latency nên viết dạng tỉ lệ request tốt thay vì p95 dưới một ngưỡng?"** Tỉ lệ là phép đếm, cộng được giữa pod và khoảng thời gian, từ đó tính error budget và burn rate. Percentile không cộng hay lấy trung bình được.
- **"Ngưỡng burn rate 14,4 ở đâu ra?"** Tiêu 2% error budget của 30 ngày (720 giờ) trong 1 giờ: 0,02 × 720 / 1 = 14,4. Tương tự 5% trong 6 giờ cho 6, và 10% trong 3 ngày cho 1. Mỗi alert dùng cửa sổ dài kèm cửa sổ ngắn để vừa chắc chắn vừa tự tắt nhanh.
- **"Head-based và tail-based sampling khác nhau thế nào?"** Head-based quyết định giữ trace ngay ở span đầu theo tỉ lệ, rẻ nhưng có thể bỏ sót trace lỗi. Tail-based quyết định ở Collector sau khi trace hoàn tất, giữ lại trace lỗi hoặc chậm, đổi lại tốn bộ nhớ đệm và cần mọi span của một trace về cùng Collector.

#### Tóm tắt
- SLI là số đo, SLO là mục tiêu nội bộ, SLA là cam kết có chế tài; error budget = 1 − SLO.
- SLO latency viết dạng tỉ lệ request tốt; ngưỡng phải là biên bucket của histogram.
- Burn rate nhiều cửa sổ: 14,4 (1 giờ/5 phút), 6 (6 giờ/30 phút) để page; 1 (3 ngày/6 giờ) để mở ticket.
- Postmortem blameless có action item với người chịu trách nhiệm và hạn.
- Dòng CV là Minh họa; việc thật có thể làm ngay là postmortem cho đợt 2,45 s.

#### Bài tập
1. SLO 99,5% trong 28 ngày. Tính error budget theo thời gian và burn rate tương ứng với việc tiêu 2% budget trong 1 giờ.
   **Đáp án:** 28 × 24 × 60 × 0,005 = 201,6 phút. Cửa sổ 672 giờ; burn rate = 0,02 × 672 / 1 = 13,44.
2. Trong 1 giờ có 120.000 request bắt đầu thi, 1.900 request chậm hơn ngưỡng. Với SLO 99,9%, burn rate là bao nhiêu và có page không?
   **Đáp án:** Tỉ lệ xấu 1.900 / 120.000 ≈ 1,58%; burn rate ≈ 0,0158 / 0,001 ≈ 15,8 > 14,4. Page nếu cửa sổ 5 phút cũng vượt 14,4.
3. Viết dàn ý postmortem cho đợt API bắt đầu thi thử 2,45 s, chỉ dùng sự kiện có thật.
   **Đáp án:** Tóm tắt; tác động (chỉ ghi số có nguồn, ví dụ thời gian trace); phát hiện qua đợt rà soát APM; nguyên nhân gốc: hàm làm mới cache gọi `SCAN` 472 vòng trên đường nóng; khắc phục: SET làm index, deploy 16/09, trace còn 55 ms; action item: đo p95 trước/sau, rà các chỗ khác dùng `SCAN`/`KEYS` trên đường request, thêm alert latency cho API thi.
