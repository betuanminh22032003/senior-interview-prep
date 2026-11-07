# Phần II. Kinh nghiệm ở VTC Online: hệ thống thi trực tuyến

Từ 03/2026 bạn là Backend Engineer ở VTC Online, làm backend cho hệ sinh thái thi IOE: kỳ thi tiếng Anh trực tuyến cho học sinh cả nước, cùng các hệ thống luyện tập, thi thử, sự kiện và cấp chứng nhận đi kèm. Đây là kinh nghiệm gần nhất, nên người phỏng vấn sẽ đào sâu nhất ở đây.

Phần này không đi theo từng câu trên CV mà theo chủ đề kỹ thuật: quy mô và kiến trúc, hiệu năng SQL Server và Redis, tính đúng khi request bị gửi lại, và độ tin cậy. Mỗi bài giải thích kiến thức trước, rồi chỉ cách kể câu chuyện dự án của bạn. Có việc bạn làm trọn, có việc bạn dẫn còn đồng nghiệp commit, có việc mới ở mức thiết kế. Bài nào cũng chỉ rõ ranh giới đó, vì một người nói đúng phần mình làm được tin hơn một người đọc con số đẹp.

## Chương 2. Quy mô hệ thống và kiến trúc nền tảng

Câu mở màn của hầu hết buổi phỏng vấn là "anh kể về hệ thống đang làm đi". Câu trả lời đầu tiên này quyết định người nghe tin bạn đến đâu: nói quy mô có định nghĩa, tách quy mô nền tảng khỏi phần mình làm, và mô tả kiến trúc trung thực kể cả chỗ chưa đẹp.

Chương này có hai bài. Bài đầu dạy cách nói về con số quy mô (tài khoản, người dùng đồng thời, độ trễ) sao cho đứng được khi bị hỏi lại. Bài thứ hai đi qua kiến trúc microservices của nền tảng và kiến thức high availability cho SQL Server mà người phỏng vấn hay hỏi tiếp.

### Bài 2.1. Nói về quy mô: người dùng đồng thời, throughput và percentile

#### Kiến thức

##### Con số quy mô dễ nói, khó bảo vệ

Mọi con số quy mô đều kéo theo ba câu hỏi: đếm thế nào, đo lúc nào, và phần nào anh xây. "35 triệu tài khoản" mà không nói đếm loại nào, ngày nào, thì người nghe chỉ thấy một con số trên slide. Quy tắc: nói định nghĩa trước, nói số sau, và nói rõ đó là quy mô của nền tảng hay của thứ bạn tự làm.

Đếm tài khoản cần định nghĩa: tài khoản đăng ký, đã loại tài khoản xóa hoặc khóa chưa, có gồm giáo viên và cán bộ không. Trên bảng trăm triệu dòng, đếm trên replica hoặc lấy số dòng xấp xỉ từ `sys.dm_db_partition_stats` nếu chỉ cần thứ tự độ lớn; dùng `COUNT_BIG` để không phụ thuộc giới hạn `int`.

##### Người dùng đồng thời không phải request đồng thời

"Người dùng đồng thời" có ít nhất hai định nghĩa: số user khác nhau có request trong cửa sổ vài phút lúc cao điểm, hoặc số thí sinh trong ca thi đông nhất. Cả hai đều không phải số request mà server đang xử lý cùng lúc.

Cầu nối giữa hai khái niệm là **định luật Little**: `L = λ × W`. `λ` là throughput (request/giây), `W` là thời gian xử lý trung bình, `L` là số request đang nằm trong hệ thống.

> **Ví dụ:** 200 nghìn thí sinh, mỗi em gửi một request mỗi 20 giây, cho `λ = 10.000` request/giây. Nếu mỗi request mất 50 ms thì chỉ có khoảng `10.000 × 0,05 = 500` request đang xử lý cùng lúc. Nếu một API chậm lên 2,5 giây, số request đang treo của API đó tăng khoảng 50 lần.

Đây là lý do một API chậm làm sập cả service: mỗi request đang treo giữ một thread, một connection DB, một ít bộ nhớ. Thời gian xử lý tăng 50 lần thì nhu cầu tài nguyên tăng 50 lần dù số người dùng không đổi.

##### Percentile và vì sao một trace không phải p95

p95 là giá trị mà 95% request nhanh hơn hoặc bằng. Trung bình che mất phần đuôi: 95 request 50 ms và 5 request 3 giây cho trung bình khoảng 200 ms, nghe ổn, nhưng cứ 20 người thì một người chờ 3 giây.

Hai điều hay bị sai:

- **Percentile không cộng, không lấy trung bình được.** p95 của 5 pod không phải trung bình năm số p95. Muốn gộp phải tính lại từ dữ liệu gốc hoặc từ histogram.
- **Một trace là một request.** Nó có thể nằm bất kỳ đâu trong phân phối. Muốn nói "p95 giảm từ A xuống B" phải có hai cửa sổ đo, ví dụ 7 ngày trước và 7 ngày sau deploy, với tải tương đương.

Trên Elastic APM, p95 lấy được từ biểu đồ latency của transaction, hoặc query thẳng:

```json
GET apm-*-transaction*/_search
{
  "size": 0,
  "query": { "bool": { "filter": [
    { "term": { "transaction.name": "<API bắt đầu thi>" } },
    { "range": { "@timestamp": { "gte": "2026-09-09", "lt": "2026-09-16" } } }
  ] } },
  "aggs": { "p": { "percentiles": { "field": "transaction.duration.us", "percents": [50, 95, 99] } } }
}
```

Kết quả tính bằng micro-giây. Elasticsearch tính percentile xấp xỉ (TDigest), đủ chính xác cho mục đích này. Ghi kèm throughput để chứng minh hai cửa sổ có tải tương đương.

#### Cách show off

Câu "kể về hệ thống anh đang làm" không phải để bạn đọc thông số. Người nghe muốn biết bạn hiểu hệ thống chịu áp lực ở đâu và bạn đứng ở vị trí nào trong đó. Mạch tốt: một câu bối cảnh dễ hình dung, áp lực kỹ thuật chính, ranh giới giữa nền tảng và phần của bạn, rồi chuyển ngay sang một câu chuyện cụ thể.

> **Ví dụ:** "Hiện tôi là Backend Engineer ở VTC Online, làm backend cho hệ thống thi tiếng Anh trực tuyến dành cho học sinh cả nước. Mùa thi có lúc hàng trăm nghìn em vào thi cùng một khung giờ, nên một API chậm vài trăm mili-giây là đủ làm cạn connection pool của cả service. Quy mô đó là của nền tảng, có từ trước khi tôi vào; phần của tôi là tìm vì sao những chỗ đó chậm và sửa đúng nguyên nhân. Ví dụ rõ nhất là màn bắt đầu thi thử: trace trên APM hơn 2 giây, gần như toàn bộ là một vòng lặp quét Redis. Bỏ vòng lặp đó đi, trace cùng loại còn dưới 0,1 giây. Đó là so một trace trước và sau, tôi chưa đo p95 trên cửa sổ dài nên không gọi nó là p95."

Điểm ăn điểm:

- Tự tách quy mô nền tảng khỏi việc mình làm trước khi bị hỏi. Người phỏng vấn thường thử đúng chỗ này.
- Nói định nghĩa đi kèm con số: "người dùng đồng thời ở đây là số thí sinh trong ca đông nhất".
- Biết đổi người dùng đồng thời ra request/giây bằng định luật Little, và giải thích vì sao độ trễ quan trọng hơn số người dùng.
- Phân biệt một trace với p95, và nói được sẽ đo p95 thế nào.

#### Câu hỏi vặn
- **"Chức danh của anh ở VTC là gì, sao CV ghi senior?"** Chức danh thật là Backend Engineer. Chữ senior trên CV mô tả mức công việc: dẫn đợt rà soát hiệu năng, thiết kế lại luồng tạo lượt làm bài trên nhiều database. Tôi không nhận chức danh senior ở VTC, và trước đó tôi là Team Lead ở AvePoint.
- **"Con số tài khoản trên CV đếm thế nào?"** Đó là số tài khoản đăng ký của nền tảng, gồm học sinh, giáo viên và cán bộ. Đếm đúng thì phải loại tài khoản đã xóa hoặc bị khóa và ghi ngày đếm. Nếu chưa tự đếm, nói thẳng đó là số của nền tảng, không phải số tôi đo.
- **"Hàng trăm nghìn người dùng đồng thời thì server chịu bao nhiêu request mỗi giây?"** Phải giả định tần suất gửi. Nếu mỗi em một request mỗi 20 giây thì 200 nghìn em là khoảng 10 nghìn request/giây. Với 50 ms mỗi request, chỉ khoảng 500 request đang xử lý cùng lúc. Điều quan trọng là độ trễ: API chậm gấp 50 lần thì số request treo cũng gấp 50 lần.
- **"Hơn 2 giây xuống dưới 0,1 giây là p95 hay một request?"** Là một trace điển hình trước và một trace sau khi sửa. Tôi chưa có p95 trên cửa sổ dài. Nếu cần, tôi lấy từ Elastic APM cho 7 ngày trước và 7 ngày sau ngày deploy, kèm throughput để chứng minh tải tương đương.
- **"Sao phải dùng p95 mà không dùng trung bình?"** Trung bình bị vài request rất chậm kéo lên hoặc bị rất nhiều request nhanh che đi. p95 cho biết 1 trong 20 người dùng chờ bao lâu, gần với cảm nhận thật hơn. Với API quan trọng tôi xem cả p99.
- **"Có 5 pod, mỗi pod một p95, gộp lại thế nào?"** Không lấy trung bình năm số đó. Phải tính lại từ dữ liệu gốc hoặc từ histogram cộng dồn của cả 5 pod. Đây cũng là lý do metric latency nên lưu dạng histogram.
- **"Bảng user hơn trăm triệu dòng mà tài khoản chỉ vài chục triệu, sao lệch vậy?"** Không đoán. Trả lời theo lý do thật đã kiểm tra: [điền: lý do bảng user có nhiều dòng hơn số tài khoản, sau khi tự kiểm tra]. Nếu chưa kiểm tra thì nói "tôi chưa xác minh, cần xem định nghĩa dòng trong bảng đó".

#### Bẫy cần tránh

- Nói "tôi là senior engineer ở VTC". Chức danh sai bị phát hiện ngay khi kiểm tra tham chiếu.
- Nói "hệ thống tôi thiết kế chịu 200 nghìn người dùng đồng thời". Thay bằng "nền tảng phục vụ…, phần tôi làm là…".
- Đọc một chuỗi con số liền nhau. Chọn một con số, nói nó đo cái gì.
- Lấy trung bình p95 các ngày để ra "p95 tuần".
- Nhận những cụm như "biến sự cố thành SLO" khi chưa làm. Nếu CV còn cụm đó, chuẩn bị câu "phần SLO tôi chưa triển khai, tôi sẽ làm thế này".

#### Nhớ nhanh
- Nói định nghĩa trước, con số sau; tách quy mô nền tảng khỏi phần mình làm.
- Định luật Little `L = λ × W`: độ trễ tăng thì số request treo tăng theo, dù số người dùng không đổi.
- p95 cần cửa sổ đo và tải tương đương; một trace không phải p95; percentile không lấy trung bình được.
- Chức danh thật ở VTC: Backend Engineer.

#### Bài tập
1. Một API có throughput 4.000 request/giây lúc cao điểm, thời gian trung bình 120 ms. Có bao nhiêu request đang xử lý cùng lúc? Nếu thời gian tăng lên 1,2 giây thì sao?
   **Đáp án:** `L = 4.000 × 0,12 = 480`. Khi `W = 1,2 s`, `L = 4.800`, gấp 10 lần: cần gấp 10 lần thread và connection, nếu không request sẽ xếp hàng.
2. Cho 20 thời gian phản hồi (ms): 40, 42, 45, 45, 48, 50, 50, 52, 55, 55, 58, 60, 60, 62, 65, 70, 75, 90, 400, 2.450. Tính trung bình và p95 (lấy phần tử thứ ⌈0,95 × n⌉ sau khi sắp xếp).
   **Đáp án:** Tổng 3.872 ms, trung bình 193,6 ms. ⌈0,95 × 20⌉ = 19, phần tử thứ 19 là 400 ms. Trung vị 56,5 ms; trung bình gấp hơn 3 lần trung vị chỉ vì một request 2,45 giây.

### Bài 2.2. Microservices và high availability cho SQL Server

#### Kiến thức

##### Microservices và cái giá của nó

Microservices nghĩa là mỗi service sở hữu dữ liệu của mình và deploy độc lập, giao tiếp qua API hoặc event. Lợi ích: deploy và scale riêng, lỗi ở một service không kéo cả hệ thống. Cái giá: lời gọi mạng có thể lỗi, không còn transaction xuyên service, cần observability phân tán để biết request đi qua đâu.

Điểm nối chặt nhất là **database dùng chung**. Khi nhiều service đọc ghi cùng một database, đổi schema phải phối hợp nhiều team, và một query nặng của service A làm chậm service B. Nhiều hệ thống thật nằm ở giữa: service tách riêng nhưng database còn chung theo domain. Nói thẳng điều đó trong phỏng vấn là dấu hiệu bạn hiểu, không phải điểm trừ.

Ở tầng ứng dụng, HA khá đơn giản: service stateless, nhiều replica sau load balancer, readiness probe để không gửi request vào pod chưa sẵn sàng. Trạng thái (phiên thi, lock, cache) nằm ở Redis hoặc DB, không nằm trong bộ nhớ pod. Phần khó là tầng dữ liệu.

##### RPO, RTO và các phương án HA của SQL Server

Mọi lựa chọn HA/DR bắt đầu từ hai câu hỏi nghiệp vụ. **RPO** (Recovery Point Objective): được phép mất tối đa bao nhiêu dữ liệu, tính bằng thời gian. **RTO** (Recovery Time Objective): bao lâu thì hệ thống phải chạy lại. Với kết quả thi, RPO gần như phải bằng 0.

| Phương án | Edition | Phạm vi | Đọc secondary | Storage | RPO / RTO |
|---|---|---|---|---|---|
| Always On Availability Group | Enterprise | Nhóm database | Có | Riêng từng replica | Sync: RPO ≈ 0, failover tự động vài chục giây |
| Basic Availability Group | Standard (từ 2016) | 1 database mỗi AG, tối đa 2 replica | Không | Riêng | Như AG sync, nhưng không scale đọc |
| Failover Cluster Instance | Standard (2 node), Enterprise | Cả instance: login, job, mọi DB | Không | Dùng chung (SAN, S2D) | RPO 0; RTO bằng thời gian khởi động instance ở node khác |
| Log shipping | Standard trở lên | Database | Chỉ khi restore `STANDBY` | Riêng | RPO vài phút; failover thủ công |

Ba chi tiết hay bị hỏi:

- **Sync và async commit.** Sync: primary chờ secondary ghi log xong mới báo commit, RPO ≈ 0 nhưng mỗi commit chậm thêm một round-trip. Async dùng cho replica ở xa, chấp nhận mất dữ liệu. Failover tự động chỉ áp dụng cho replica sync.
- **AG chỉ đồng bộ database.** Login, SQL Agent job, linked server nằm ở instance, phải tự đồng bộ (trừ contained AG từ SQL Server 2022). FCI không gặp vấn đề này vì cả instance chuyển sang node khác.
- **FCI dùng chung storage**, nên không bảo vệ khi chính storage hỏng.

##### Phía ứng dụng khi failover

Ứng dụng kết nối qua **listener** (tên DNS ảo trỏ tới primary hiện tại), không kết nối thẳng tên server:

```text
Server=tcp:<listener>,1433;Database=<db>;MultiSubnetFailover=True;Encrypt=True;Connect Timeout=30
```

`MultiSubnetFailover=True` làm driver thử song song mọi IP của listener nên kết nối lại nhanh sau failover. Muốn đọc từ secondary thì thêm `ApplicationIntent=ReadOnly` và cấu hình read-only routing.

Lúc failover, kết nối đang mở bị đứt, transaction đang chạy bị rollback. Ứng dụng phải retry lỗi tạm thời, và nếu code tự mở transaction thì phải chạy lại **cả khối**, không chỉ lệnh cuối. Với EF Core:

```csharp
var strategy = db.Database.CreateExecutionStrategy();   // cần EnableRetryOnFailure()
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync();
    // ... các lệnh trong transaction
    await tx.CommitAsync();
});
```

Với ADO.NET thuần thì dùng `SqlRetryLogicOption` gắn vào `SqlConnection.RetryLogicProvider`.

> **Cảnh báo:** Retry chỉ an toàn với thao tác idempotent. Nếu server đã commit nhưng client mất phản hồi, retry một lệnh `INSERT` sẽ ghi hai lần. Đây là lý do phải có ghi idempotent theo khóa nghiệp vụ, chủ đề của bài đầu Chương 4.

Đọc từ secondary async còn có vấn đề **read-your-writes**: em học sinh vừa nộp bài, đọc kết quả từ secondary trễ vài giây thì không thấy bài vừa nộp. Chỉ đưa sang secondary các truy vấn chấp nhận trễ như báo cáo; luồng vừa ghi xong thì đọc từ primary.

#### Cách show off

Câu hỏi về kiến trúc là chỗ dễ nói quá. Cách an toàn và vẫn ghi điểm: mô tả đúng hệ thống đang chạy, tự nêu điểm chưa chuẩn, nói rõ phần nào bạn không thiết kế, rồi trình bày cách bạn sẽ quyết định nếu được giao, bắt đầu từ RPO và RTO chứ không bắt đầu từ tên công nghệ.

Sự thật cần nhớ: nền tảng có hơn 20 service .NET deploy riêng, gọi nhau qua HTTP, gRPC và Kafka; tầng ứng dụng chạy nhiều pod trên Kubernetes, Redis Cluster cho cache và lock; Consul chỉ dùng làm kho config, không làm service discovery. Bạn không viết manifest Kubernetes và không thiết kế HA cho SQL Server.

> **Ví dụ:** "Nền tảng có hơn 20 service .NET deploy độc lập, gọi nhau qua HTTP, gRPC và Kafka, chạy nhiều pod trên Kubernetes với Redis Cluster cho cache và lock. Nói thật là chưa chuẩn microservices: nhiều service vẫn dùng chung database theo domain, nên một query nặng ở chỗ này có thể làm chậm chỗ khác. Phần HA của SQL Server do đội hạ tầng phụ trách, tôi không thiết kế. Nếu được giao, tôi bắt đầu bằng việc hỏi nghiệp vụ mất bao nhiêu dữ liệu và ngừng bao lâu thì chấp nhận được. Với kết quả thi thì gần như không được mất gì, nên tôi chọn Availability Group chế độ sync, trên Standard Edition là Basic AG. Phía ứng dụng kết nối qua listener, retry lỗi tạm thời, và mọi lệnh ghi phải idempotent để retry không tạo bản ghi trùng."

Điểm ăn điểm:

- Tự nói điểm yếu của kiến trúc (database dùng chung) và hệ quả cụ thể của nó.
- Chọn phương án từ RPO, RTO và edition, không phải từ tên công nghệ.
- Nối HA với tính đúng: failover sinh retry, retry đòi hỏi idempotency.
- Biết các chi tiết vận hành hay bị quên: AG không đồng bộ login và job; secondary async gây lỗi read-your-writes.

#### Câu hỏi vặn
- **"Hệ thống của anh có phải microservices đúng nghĩa không?"** Một phần. Service deploy độc lập và giao tiếp qua HTTP, gRPC, Kafka, nhưng nhiều service vẫn dùng chung database theo domain. Đổi schema phải phối hợp, và query nặng của service này ảnh hưởng service khác. Việc tôi bỏ join chéo database ở luồng tạo lượt làm bài là một bước tách ranh giới dữ liệu.
- **"Always On AG, Basic AG và FCI khác nhau thế nào?"** AG bảo vệ nhóm database, mỗi replica có bản sao riêng, Enterprise mới đọc được secondary. Basic AG trên Standard giới hạn 2 replica, mỗi AG một database, không đọc secondary. FCI bảo vệ cả instance, dùng chung storage, tại một thời điểm chỉ một node chạy.
- **"RPO và RTO của hệ thống anh là bao nhiêu?"** Tôi không nắm số chính thức, và tôi nói thẳng như vậy. Cách xác định: hỏi nghiệp vụ mất bao nhiêu phút dữ liệu và ngừng bao lâu thì chấp nhận được, chọn phương án theo đó, rồi kiểm chứng bằng diễn tập failover chứ không tin vào tài liệu.
- **"Ứng dụng làm gì để failover gần như trong suốt?"** Kết nối qua listener với `MultiSubnetFailover=True`, timeout kết nối hợp lý, retry lỗi tạm thời có backoff. Transaction đang chạy lúc failover bị rollback, nên phải chạy lại cả khối bằng execution strategy.
- **"Retry khi failover có nguy hiểm gì?"** Commit đã thành công nhưng client mất phản hồi, retry sẽ ghi lần hai. Chỉ retry thao tác idempotent, hoặc ghi theo khóa nghiệp vụ (unique index, applock, idempotency key) để lần thứ hai trả lại kết quả cũ.
- **"Đưa truy vấn đọc sang secondary có vấn đề gì?"** Replication lag gây lỗi read-your-writes: vừa nộp bài mà đọc từ secondary thì chưa thấy. Chỉ đưa sang secondary báo cáo và thống kê; luồng vừa ghi thì đọc primary. Và phải là Enterprise mới có readable secondary.

#### Bẫy cần tránh

- Nói "tôi thiết kế HA cho SQL Server" khi chỉ làm trên hệ thống có sẵn.
- Nói Basic AG đọc được secondary. Không được; muốn đọc phải là Enterprise.
- Nói Consul làm service discovery trong hệ thống này. Ở đây nó chỉ là kho config.
- Bật retry cho mọi lệnh ghi mà không nghĩ tới idempotency.
- Gọi hệ thống là "microservices chuẩn" rồi bị hỏi về database dùng chung.

#### Nhớ nhanh
- Kiến trúc thật: hơn 20 service .NET, nhiều pod, Redis Cluster; database còn dùng chung theo domain.
- Chọn HA theo RPO, RTO, edition và chi phí; kết quả thi cần sync commit.
- Basic AG: Standard, 2 replica, 1 DB, không đọc secondary. FCI: cả instance, storage chung.
- Ứng dụng: listener, `MultiSubnetFailover=True`, retry cả transaction; retry chỉ an toàn khi ghi idempotent.

#### Bài tập
1. Server chạy Standard Edition, nghiệp vụ yêu cầu không mất kết quả thi đã nộp và tự động failover. Chọn phương án và nêu giới hạn.
   **Đáp án:** Basic Availability Group, synchronous commit, failover tự động. Giới hạn: 2 replica, mỗi AG một database (nhiều DB thì nhiều AG), không đọc được secondary, phải tự đồng bộ login và job.
2. Một lệnh `INSERT` kết quả thi bị timeout lúc failover; client retry và thấy hai bản ghi. Giải thích và nêu hai cách sửa.
   **Đáp án:** Lần đầu đã commit trên primary trước khi kết nối đứt; client không nhận phản hồi nên gửi lại. Sửa: unique index theo (user, vòng) và bắt lỗi trùng để trả bản ghi cũ; hoặc `sp_getapplock` theo (user, vòng) kèm kiểm tra tồn tại trước khi insert.

## Chương 3. Hiệu năng: từ trace APM xuống SQL Server và Redis

Đây là chương có nhiều việc thật nhất của bạn ở VTC: một đợt rà soát hiệu năng trên sáu cụm SQL Server, các bản sửa cache, và việc viết lại luồng tạo lượt làm bài để bỏ join chéo database. Người phỏng vấn vị trí senior backend gần như chắc chắn chọn một trong các chủ đề này để hỏi sâu, vì đây là nơi lộ rõ ai biết đo trước khi sửa, ai chỉ biết "thêm index".

Bốn bài đi theo một mạch: tìm đúng chỗ chậm, sửa sao cho không làm khóa hệ thống giữa giờ thi, sửa cache cho đúng thay vì chỉ tăng TTL, và cuối cùng là thay đổi thiết kế để dữ liệu có ranh giới rõ.

### Bài 3.1. Tìm nguyên nhân chậm: từ trace APM xuống DMV và code

#### Kiến thức

##### Quy trình ba bước

Khi hệ thống chậm, người thiếu kinh nghiệm đoán rồi sửa. Cách làm bền là đi từ triệu chứng xuống nguyên nhân theo ba tầng:

1. **APM** (ở đây là Elastic APM): lọc endpoint chậm nhất theo tổng thời gian, mở trace, xem thời gian rơi vào span nào: SQL, Redis, HTTP hay gRPC.
2. **DMV của SQL Server**: từ span SQL, tra procedure đó trong `sys.dm_exec_procedure_stats` để lấy số lần chạy, reads, CPU; xem plan đang cache, gợi ý missing index, wait stats.
3. **Đọc code**: lần theo chuỗi gọi từ controller xuống stored procedure để biết vì sao lời gọi đó xảy ra, xảy ra bao nhiêu lần.

Một trace là cây span. Ngoài span dài nhất, hãy **đếm số span**: hàng trăm span Redis giống hệt nhau trong một request là dấu hiệu vòng lặp gọi mạng, giống lỗi N+1 trong SQL.

##### Vì sao `SCAN` trên Redis vẫn làm request chậm

`KEYS pattern` duyệt toàn bộ keyspace trong một lệnh, chặn event loop đơn luồng của Redis tới khi xong, nên ai cũng biết phải tránh. `SCAN cursor MATCH pattern COUNT n` chia nhỏ việc đó ra, mỗi lần chỉ duyệt một phần. Nhưng:

- `MATCH` lọc **sau khi** lấy phần tử ra, nên key khớp càng thưa thì càng phải gọi nhiều lần.
- Duyệt hết keyspace vẫn là O(tổng số key), chỉ là chia ra nhiều round-trip.
- Trên Redis Cluster, `SCAN` chỉ chạy trên một node; muốn duyệt hết phải gọi trên từng master.

Mỗi round-trip vài mili-giây, vài trăm vòng là cả giây. Gốc rễ không phải lệnh `SCAN` "chặn", mà là một thuật toán tỉ lệ với kích thước keyspace nằm trên đường nóng của mỗi request.

Cách sửa là giữ một **Redis SET làm index** các key cần xóa (minh họa cơ chế, không phải code thật):

```csharp
// Khi ghi key cache gói của user: ghi thêm tên key vào SET index
db.StringSet($"pkg:{userId}:{serviceId}", json, TimeSpan.FromMinutes(60), flags: CommandFlags.FireAndForget);
db.SetAdd($"pkg-idx:{userId}", $"pkg:{userId}:{serviceId}", CommandFlags.FireAndForget);

// Khi cần làm mới: chi phí O(số key của user), không phụ thuộc kích thước keyspace
foreach (var k in await db.SetMembersAsync($"pkg-idx:{userId}"))
    db.KeyDelete(k.ToString(), CommandFlags.FireAndForget);
db.KeyDelete($"pkg-idx:{userId}", CommandFlags.FireAndForget);
```

Đánh đổi: mỗi lần ghi key phải ghi thêm vào SET; SET có thể chứa tên key đã hết hạn, vô hại vì xóa key không tồn tại không lỗi. Trên Cluster, xóa nhiều key trong một lệnh chỉ được khi chúng cùng hash slot; xóa từng key thì không cần.

##### Xếp hạng điểm nóng theo tổng chi phí

Chi phí của một procedure là chi phí mỗi lần nhân số lần chạy. Procedure 400 ms chạy vài triệu lần quan trọng hơn procedure 30 giây chạy ba lần. Sau tổng chi phí mới xét ảnh hưởng tới API người dùng, độ dễ sửa và rủi ro.

```sql
SELECT TOP 20 DB_NAME(ps.database_id) AS db,
       OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
       ps.execution_count,
       ps.total_logical_reads / ps.execution_count AS avg_reads,
       ps.total_elapsed_time / ps.execution_count / 1000.0 AS avg_ms,   -- DMV tính bằng micro-giây
       ps.cached_time
FROM sys.dm_exec_procedure_stats ps
ORDER BY ps.total_logical_reads DESC;
```

Wait stats (`sys.dm_os_wait_stats`) cộng dồn từ lúc instance khởi động; muốn xem một khoảng thời gian thì chụp hai lần rồi lấy hiệu.

##### Những nguyên nhân gốc hay gặp

- **Bảng heap thiếu index đúng cột lọc.** Procedure tra cứu chạy hàng triệu lần, mỗi lần quét cả bảng. DMV missing index thường chỉ ra ngay.
- **Sai leftmost prefix.** Index `(RoundId, ExamOpenId, UserId)` mà query lọc `RoundId = @r AND UserId = @u`: chỉ seek được theo `RoundId`, `UserId` thành residual predicate, phải đọc mọi dòng của vòng đó. Index `(RoundId, UserId)` seek thẳng tới vài dòng.
- **Linked server trong transaction.** Lời gọi sang server khác nằm giữa `BEGIN TRAN` và `COMMIT` kéo dài thời gian giữ lock bằng thời gian mạng; wait `MSQL_DQ` và `OLEDB` cao là dấu hiệu. Sửa: đọc dữ liệu từ xa trước, rồi mới mở transaction ngắn chỉ chứa phần ghi cục bộ.
- **Table variable cho tập lớn.** Trước SQL Server 2019 optimizer ước lượng table variable có 1 dòng; từ 2019 có deferred compilation nhưng vẫn không có statistics cột. Với tập lớn, dùng `#temp` có index.

#### Bối cảnh dự án

Tháng 09/2026 bạn dẫn đợt rà soát hiệu năng trên sáu cụm SQL Server của nền tảng, chia theo vai trò: log luyện tập và thi thử, dữ liệu lõi (user, danh mục, trường), log thi chính thức, kho dữ liệu báo cáo, đăng ký thi, ngân hàng câu hỏi. Sản phẩm là một báo cáo xếp hạng điểm nóng kèm kế hoạch xử lý theo mức ưu tiên cho Dev và DBA. Phần của bạn: rà soát, tìm nguyên nhân, đề xuất cách sửa. Bản sửa cho API bắt đầu thi thử và hai API khác do đồng nghiệp commit ngày 16/09, theo đề xuất trong báo cáo.

#### Cách show off

Đây là câu chuyện mạnh nhất của bạn, vì nó có đủ mạch: triệu chứng, cách điều tra, nguyên nhân bất ngờ, cách sửa có đánh đổi, và kết quả đo lại được. Kể theo thứ tự đó, và nói rõ vai trò ngay trong câu chuyện.

> **Ví dụ:** "Tôi dẫn một đợt rà soát hiệu năng trên sáu cụm SQL Server. Tôi không bắt đầu từ database mà từ APM: lọc endpoint chậm, mở trace xem thời gian rơi vào đâu. API bắt đầu thi thử mất hơn 2 giây, nhưng bất ngờ là phần lớn không nằm ở SQL mà ở Redis: một request có gần 500 lệnh SCAN. Đọc code thì thấy luồng trừ lượt thi gọi một hàm làm mới cache, và hàm đó quét cả keyspace để tìm key cần xóa. Tôi đề xuất giữ một SET làm index các key của từng user, xóa thẳng từng key thay vì quét. Đồng nghiệp commit bản sửa, trace cùng loại sau đó dưới 0,1 giây và không còn SCAN. Bài học tôi rút ra là không đoán: trace cho biết thời gian ở đâu, DMV cho biết bao nhiêu lần, code cho biết vì sao."

Điểm ăn điểm:

- Nói quy trình trước, công cụ sau: APM → DMV → code. Người nghe thấy cách làm áp dụng được cho hệ thống của họ.
- Xếp hạng theo tổng chi phí, không theo thời gian một lần chạy.
- Hiểu đúng cơ chế: `SCAN` không chặn như `KEYS`; vấn đề là thuật toán O(keyspace) trên đường nóng.
- Nói đúng vai trò: "tôi tìm nguyên nhân và đề xuất, đồng nghiệp commit".

#### Câu hỏi vặn
- **"Sao anh chắc nguyên nhân là SCAN?"** Span Redis chiếm phần lớn thời gian của trace, và có hàng trăm span `SCAN` giống hệt nhau. Sau khi sửa, trace không còn `SCAN`, và phần thời gian còn lại khớp với các lệnh xóa key trực tiếp. Bằng chứng trước và sau cùng một loại đo.
- **"SCAN không chặn Redis như KEYS, vậy sao vẫn chậm?"** Mỗi lệnh `SCAN` chỉ duyệt một phần nên không chặn lâu. Nhưng hàng trăm round-trip trong một request cộng lại thành cả giây, và `MATCH` lọc sau khi lấy phần tử nên key khớp càng thưa càng phải gọi nhiều. Gốc rễ là thuật toán tỉ lệ với kích thước keyspace nằm trên đường nóng.
- **"Phần nào trong đợt đó là của anh?"** Tôi dẫn đợt rà soát, xếp hạng điểm nóng, tìm nguyên nhân và viết đề xuất sửa. Ba bản sửa đầu tiên do đồng nghiệp commit. Các mục giao DBA trong báo cáo, tôi chỉ nói là đã xong khi đã kiểm tra.
- **"Anh xếp hạng điểm nóng theo tiêu chí nào?"** Tổng chi phí trước: reads hoặc CPU mỗi lần nhân số lần chạy. Sau đó là mức ảnh hưởng tới API người dùng, rồi độ dễ sửa và rủi ro. Một procedure trung bình 400 ms chạy vài triệu lần đứng trên một procedure 30 giây chạy vài lần.
- **"Sao không tăng connection pool cho đỡ timeout?"** Query chậm mà tăng pool thì càng nhiều connection dồn vào DB, càng tranh chấp CPU, lock và memory grant. Phải làm query nhanh lại: query vài mili-giây thì một connection phục vụ được hàng trăm request mỗi giây.
- **"Sao không đánh index hết các bảng cho nhanh?"** Bảng log ghi liên tục mà thêm index trên key ngẫu nhiên như `UserId` sẽ bị page split và tăng chi phí ghi log; ở cụm log thi, chờ ghi log vốn đã là wait lớn. Tôi chia theo access pattern: bảng chỉ ghi thì giữ tối giản, bảng ghi dồn theo ca thi thì đánh index sau ca, nhu cầu tra cứu thì đưa sang replica. Đó là đề xuất trong báo cáo.

#### Bẫy cần tránh

- Nói "tôi sửa API bắt đầu thi". Nói "tôi tìm nguyên nhân và đề xuất, đồng nghiệp commit".
- Gọi số trước và sau là p95 khi đó là hai trace.
- Nói "Redis SCAN chặn server". Nói đúng: vòng lặp `SCAN` đồng bộ trên đường nóng của request.
- Liệt kê một tràng phát hiện kèm số. Chọn một câu chuyện kể trọn; các phát hiện khác chỉ nhắc khi được hỏi.

#### Nhớ nhanh
- APM cho biết thời gian ở đâu, DMV cho biết bao nhiêu lần, code cho biết vì sao.
- Hàng trăm span giống nhau trong một trace là vòng lặp gọi mạng.
- Xóa cache theo nhóm bằng SET làm index, không quét keyspace.
- Xếp hạng điểm nóng theo tổng chi phí = chi phí mỗi lần × số lần chạy.

#### Bài tập
1. Xếp hạng theo tổng logical reads: procedure A chạy 2,87 triệu lần, 194.000 reads mỗi lần; B chạy 81,16 triệu lần, 244 reads mỗi lần; C chạy 4,95 triệu lần, 2.500 reads mỗi lần.
   **Đáp án:** A ≈ 556,8 tỷ reads; B ≈ 19,8 tỷ; C ≈ 12,4 tỷ. Thứ tự A, B, C. B có reads mỗi lần nhỏ nhưng vẫn đứng thứ hai vì số lần chạy.
2. Query lọc `WHERE RoundId = @r AND UserId = @u`, index hiện có `(RoundId, ExamOpenId, UserId)`. Viết index phù hợp và giải thích vì sao index cũ không seek được theo `UserId`.
   **Đáp án:** `CREATE INDEX IX_x ON dbo.T (RoundId, UserId) INCLUDE (<cột cần trả>);`. Index cũ sắp theo `ExamOpenId` trước `UserId`, nên trong một `RoundId` các dòng của một user nằm rải rác; chỉ seek được tới đầu khoảng của `RoundId` rồi lọc tuần tự.

### Bài 3.2. Sửa procedure trong ngày, đánh index ban đêm trên Standard Edition

#### Kiến thức

##### Tạo index khóa gì trên Standard Edition

Online index operation (`ONLINE = ON`), resumable index và parallel index operation đều là tính năng Enterprise. Trên Standard Edition:

- Tạo **nonclustered** index giữ khóa S trên bảng: vẫn đọc được nhưng chặn mọi lệnh ghi.
- Tạo hoặc rebuild **clustered** index giữ khóa Sch-M: chặn mọi truy cập, kể cả đọc.
- Việc tạo index chạy một luồng, nên thời gian có thể dài hơn ước tính từ máy Enterprise.

Ngược lại, `ALTER PROCEDURE` chỉ cần khóa schema trên chính procedure trong thời gian rất ngắn, không khóa bảng, nên deploy được giữa ngày. Nó cũng xóa plan đang cache, nên số liệu của procedure trong `sys.dm_exec_procedure_stats` bị reset: số đo sau deploy chỉ tính các lần chạy mới.

Từ đó ra một kế hoạch hai tầng tự nhiên: sửa procedure trong ngày, còn index để dành cho cửa sổ bảo trì ban đêm.

##### Ba mẫu sửa procedure hay dùng

**Biểu thức non-sargable.** Sargable nghĩa là optimizer dùng được điều kiện để seek index. Gói điều kiện trong `CASE` làm mất điều đó:

```sql
-- Trước: không seek được
SELECT Id, Name FROM dbo.School
WHERE 1 = CASE WHEN @Id IS NOT NULL AND Id = @Id THEN 1
               WHEN @Id IS NULL AND ProvinceId = @ProvinceId THEN 1 END;

-- Sau: mỗi nhánh một câu sargable
IF @Id IS NOT NULL
    SELECT Id, Name FROM dbo.School WHERE Id = @Id;
ELSE
    SELECT Id, Name FROM dbo.School WHERE ProvinceId = @ProvinceId;
```

Tách nhánh có rủi ro **parameter sniffing**: lần chạy đầu, SQL Server compile cả procedure, mọi nhánh, theo giá trị tham số của lần đó. Cách xử lý: tách mỗi nhánh thành procedure con, `OPTION (RECOMPILE)` cho nhánh hiếm, hoặc dynamic SQL có tham số (`sp_executesql`) khi có nhiều điều kiện tùy chọn.

**RBAR sang set-based.** Vòng `WHILE` xử lý từng dòng thì mỗi vòng là một lần thực thi. Một câu set-based để engine xử lý cả tập trong một plan:

```sql
SELECT a.EventId, j.UserId, j.CheckedAt
FROM dbo.Attendance a
CROSS APPLY OPENJSON(a.Payload) WITH (UserId bigint '$.userId', CheckedAt datetime2 '$.at') AS j
WHERE a.EventId = @EventId;
```

**Giữ temp table caching.** SQL Server cache cấu trúc `#temp` tạo trong procedure để lần sau không phải tạo lại metadata. Caching mất khi có DDL sau lúc tạo (`ALTER TABLE`, `CREATE INDEX` riêng) hoặc constraint có tên. Mất caching thì mỗi lần chạy đều tạo và hủy metadata, gây tranh chấp tempdb và recompile. Sửa: khai báo đủ cột ngay khi tạo, hoặc bỏ hẳn temp table nếu một câu `SELECT` với `JOIN` làm được.

##### Đánh index ban đêm an toàn

1. Thử trên bản sao dữ liệu thật để biết thời gian chạy và dung lượng tempdb, log.
2. Mỗi đêm vài bảng, bảng nhỏ trước; `SORT_IN_TEMPDB = ON` khi tempdb nằm ổ riêng.
3. Đặt thời gian chờ khóa:

```sql
SET LOCK_TIMEOUT 60000;  -- chờ khóa tối đa 60 s rồi báo lỗi
CREATE NONCLUSTERED INDEX IX_Certificate_UserId
    ON dbo.Certificate (UserId) INCLUDE (CertType, IssuedAt)
    WITH (SORT_IN_TEMPDB = ON);
```

   Lý do: nếu một transaction dài đang giữ khóa ghi, `CREATE INDEX` phải chờ; các lệnh ghi đến sau xếp hàng sau yêu cầu khóa đang chờ đó, và cả bảng kẹt dù index chưa bắt đầu tạo.
4. Theo dõi blocking; có ngưỡng dừng nếu sắp vượt cửa sổ bảo trì.
5. Sáng hôm sau so plan và DMV; sau một chu kỳ tải đầy đủ, bỏ index không được dùng (xem `sys.dm_db_index_usage_stats`, số liệu reset khi instance khởi động lại).

Muốn nói "CPU giảm" thì phải đo cùng khung giờ cao điểm, cùng ngày trong tuần, trước và sau, kèm throughput. Nguồn: dashboard hạ tầng, hoặc ring buffer `RING_BUFFER_SCHEDULER_MONITOR` trong `sys.dm_os_ring_buffers` (chỉ giữ vài giờ, phải chụp định kỳ).

#### Bối cảnh dự án

Các cụm SQL Server của nền tảng chạy Standard Edition. Báo cáo rà soát của bạn chia kế hoạch làm hai tầng: sửa procedure bằng `ALTER PROCEDURE` trong ngày, còn index giao DBA chạy trong cửa sổ 23h–05h. Trong báo cáo có ba procedure được viết lại theo đúng ba mẫu trên: tra trường theo ID (tách nhánh non-sargable), lấy điểm danh theo sự kiện (bỏ vòng lặp từng dòng), lấy quan hệ user (bỏ `ALTER TABLE` trên temp table). Hai điều phải xác nhận trước khi kể: ai viết các procedure này, vì chúng không nằm trong git và báo cáo chỉ ghi "Dev Team" ([điền: ai viết]); và DBA đã đánh index theo kế hoạch chưa ([điền: trạng thái index ca đêm]). Con số CPU giảm trên CV chưa được đo.

#### Cách show off

Chủ đề này ghi điểm không phải ở kỹ thuật SQL mà ở **tư duy vận hành**: biết ràng buộc của edition đang chạy, biết thay đổi nào an toàn giữa giờ thi, và tách kế hoạch theo rủi ro. Đó là thứ phân biệt senior với người chỉ biết "thêm index là nhanh".

> **Ví dụ:** "Sau đợt rà soát, nhiều chỗ cần index mới, nhưng server chạy Standard Edition, không có online index. Tạo index giữa giờ thi là khóa ghi cả bảng, với bảng đang nhận bài nộp thì không chấp nhận được. Nên kế hoạch tôi viết chia hai tầng. Tầng một là sửa procedure trong ngày, vì `ALTER PROCEDURE` không khóa bảng: tách điều kiện kiểu CASE thành các nhánh seek được, đổi vòng lặp từng dòng sang một câu set-based, bỏ ALTER TABLE trên temp table. Ví dụ procedure tra trường, sau khi tách nhánh thì số trang đọc mỗi lần từ hàng trăm xuống còn vài trang. Tầng hai là index, giao DBA chạy ban đêm, thử trước trên bản sao, mỗi đêm vài bảng, có lock timeout. [điền: trạng thái index ca đêm]."

Nếu procedure không phải do bạn viết, đổi câu thành "đội đã viết lại procedure tra trường theo đề xuất".

Điểm ăn điểm:

- Nói được cơ chế khóa cụ thể: nonclustered chặn ghi, clustered chặn cả đọc.
- Biết `ALTER PROCEDURE` an toàn và biết nó reset số liệu DMV.
- Tự nhắc rủi ro parameter sniffing khi tách nhánh.
- Biết `CREATE INDEX` đang chờ khóa có thể làm kẹt cả bảng, và đặt `LOCK_TIMEOUT`.

#### Câu hỏi vặn
- **"Sao không mua Enterprise để có online index?"** Enterprise tính license theo core, chi phí rất lớn so với việc dời lịch đánh index sang ban đêm. Phần lớn lợi ích đến từ sửa procedure, việc đó làm được trong ngày trên Standard.
- **"Tách nhánh IF/ELSE có bị parameter sniffing không?"** Có thể. Lần chạy đầu compile cả procedure theo giá trị tham số lúc đó. Xử lý bằng procedure con cho mỗi nhánh, `OPTION (RECOMPILE)` cho nhánh hiếm, hoặc dynamic SQL có tham số khi có nhiều điều kiện tùy chọn.
- **"Logical reads giảm vài trăm lần thì có nhanh vài trăm lần không?"** Không. Logical reads là số trang đọc từ buffer pool; thời gian còn phụ thuộc sort, hash, số dòng xử lý, độ trễ mạng. Phải đo thời gian và CPU riêng, hai tỉ lệ thường khác nhau.
- **"Sau khi sửa procedure anh đo thế nào?"** `ALTER PROCEDURE` reset số liệu trong DMV, nên số mới chỉ tính các lần chạy sau deploy; đợi đủ nhiều lần chạy rồi so. Song song đó so trace APM trước và sau, và chạy thử với `SET STATISTICS IO, TIME ON`.
- **"Lệnh CREATE INDEX ban đêm chờ khóa sau một transaction dài thì sao?"** Nó chờ khóa trên bảng, các lệnh ghi mới đến sau xếp hàng sau nó, cả bảng kẹt dù index chưa bắt đầu tạo. Đặt `LOCK_TIMEOUT`, kiểm tra transaction đang mở trước khi chạy, theo dõi blocking và dừng nếu vượt ngưỡng.
- **"DBA đã đánh index theo kế hoạch chưa, CPU giảm bao nhiêu?"** Trả lời đúng trạng thái thật: [điền: trạng thái index ca đêm]. Báo cáo là kế hoạch; mục nào chưa làm thì nói chưa làm. Về CPU: tôi chưa có số đo trước và sau cùng khung giờ, nên không đưa ra con số.

#### Bẫy cần tránh

- Nói "CPU giảm từ X xuống Y" khi chưa đo cùng khung giờ, cùng tải.
- Nhận các procedure viết lại là của mình khi chưa xác nhận.
- Khuyên giới hạn `MAXDOP` cho lệnh tạo index trên Standard: trên Standard nó vốn chạy một luồng.
- Nói "logical reads giảm 275 lần nên nhanh 275 lần".

#### Nhớ nhanh
- Standard Edition: tạo nonclustered index chặn ghi, clustered chặn mọi truy cập; không online, không song song.
- `ALTER PROCEDURE` deploy được giữa ngày và reset số liệu DMV của procedure.
- Ba mẫu sửa: tách nhánh sargable, RBAR sang set-based, giữ temp table caching.
- Index ban đêm: thử trên bản sao, từng bảng, `LOCK_TIMEOUT`, theo dõi blocking.

#### Bài tập
1. Viết lại cho sargable: `WHERE 1 = CASE WHEN @Code IS NOT NULL AND Code = @Code THEN 1 WHEN @Code IS NULL THEN 1 END`.
   **Đáp án:** `IF @Code IS NOT NULL SELECT … WHERE Code = @Code; ELSE SELECT …;` hoặc `WHERE (@Code IS NULL OR Code = @Code) OPTION (RECOMPILE)` để optimizer nhúng giá trị tham số mỗi lần chạy.
2. Lập kế hoạch đo để có thể nói "CPU cao điểm giảm từ X% xuống Y%" một cách trung thực.
   **Đáp án:** Chọn khung giờ cao điểm cố định; thu CPU theo phút trong 1–2 tuần trước và sau thay đổi, cùng ngày trong tuần; ghi throughput song song; báo cáo p95 của CPU theo phút trong khung giờ đó, không lấy một điểm đỉnh đơn lẻ.

### Bài 3.3. Cache dữ liệu cấu hình: negative caching, version key và cache stampede

#### Kiến thức

##### Cache-aside và lỗi "rỗng là miss"

Cache-aside là mẫu phổ biến nhất: đọc cache, miss thì đọc DB rồi ghi vào cache. Lỗi kinh điển là dùng "rỗng" làm tín hiệu miss:

```csharp
// Lỗi: list rỗng bị coi là miss, nên tổ hợp không có cấu hình luôn gọi DB
var list = GetFromCache(key);
if (list != null && list.Count > 0) return list;
```

Với dữ liệu cấu hình, rất nhiều tổ hợp (môn, khối, vòng) hợp lệ nhưng không có dữ liệu. Những tổ hợp đó không bao giờ được cache và luôn đi xuống DB.

**Negative caching** là cache cả kết quả "không có dữ liệu", bằng cách phân biệt "key không tồn tại" với "key tồn tại, giá trị rỗng":

```csharp
string key = $"cfg:v2:rounds:{serviceId}:{grade}";
RedisValue cached = await _redis.StringGetAsync(key);
if (cached.HasValue)                                           // có key, kể cả "[]"
    return JsonSerializer.Deserialize<List<SubjectRound>>(cached.ToString())!;

var rows = await _repo.GetRoundsAsync(serviceId, grade);       // gọi procedure
_redis.StringSet(key, JsonSerializer.Serialize(rows), TimeSpan.FromHours(6),
                 flags: CommandFlags.FireAndForget);           // list rỗng cũng được cache
return rows;
```

Rủi ro: cấu hình vừa tạo vẫn bị coi là rỗng tới khi hết TTL. Xử lý: hệ thống quản trị (CMS) gọi hàm xóa cache khi tạo hoặc sửa cấu hình, hoặc đặt TTL ngắn hơn cho kết quả rỗng.

##### Version key: invalidate O(1) không cần quét

Khi một thay đổi phải làm mất hiệu lực cả nhóm key, cách ngây thơ là xóa theo pattern, tức là phải `SCAN` (đúng bài học ở bài trước). Cách gọn hơn là đặt số version vào tên key:

```csharp
long ver = (long)await _redis.StringGetAsync("pricing:ver");   // chưa có thì 0
string key = $"pricing:v{ver}:{serviceId}";
// ... cache-aside với key này, TTL 60 phút

// Khi CMS thêm, sửa, xóa gói:
_redis.StringIncrement("pricing:ver", flags: CommandFlags.FireAndForget);
```

Sau `INCR`, mọi lần đọc dùng version mới; key cũ không còn ai đọc và tự hết hạn. Đánh đổi: thêm một lệnh `GET` mỗi lần đọc, và key cũ chiếm bộ nhớ tới khi hết TTL.

##### Cache stampede

Khi một key nóng hết hạn (hoặc version đổi), nhiều request cùng miss và cùng gọi DB. Các cách giảm:

- **Jitter**: cộng ngẫu nhiên vào TTL để các key không hết hạn cùng lúc.
- **Single-flight**: trong một process, các request cùng key chỉ chạy hàm nạp một lần, ví dụ `ConcurrentDictionary<string, Lazy<Task<T>>>`. Chỉ gộp được trong một pod.
- **Refresh trước khi hết hạn**: làm mới nền khi key còn ít thời gian sống.
- **Lock phân tán khi nạp**: `SET NX` một key lock, chỉ người giữ lock gọi DB; tốn thêm round-trip.

##### Redis hay MemoryCache

MemoryCache trả về **cùng một instance** cho mọi caller; nếu code gọi sửa object đó, dữ liệu trong cache hỏng cho mọi request sau. Redis deserialize ra object mới mỗi lần. Ngoài ra, khi cấu hình đổi, mọi pod phải thấy cùng lúc; MemoryCache nằm riêng trong từng pod. MemoryCache hợp với dữ liệu nhỏ, bất biến, chấp nhận lệch giữa các pod trong vài phút.

##### "Chạy 81 triệu lần" nghĩa là gì

`execution_count` trong `sys.dm_exec_procedure_stats` cộng dồn **kể từ `cached_time`**, lúc plan vào cache, và reset khi plan bị đẩy ra, khi `ALTER PROCEDURE`, khi instance khởi động lại. Không kèm `cached_time` thì con số không có đơn vị thời gian. Muốn biết số lần gọi mỗi phút: chụp DMV hai lần cách nhau một giờ, kiểm tra `cached_time` không đổi, lấy hiệu chia 60.

#### Bối cảnh dự án

Trong đợt rà soát, bạn thấy procedure lấy danh mục môn và vòng thi đứng đầu về số lần chạy: khoảng 81 triệu lần cộng dồn trong DMV, dù đây là dữ liệu cấu hình gần như không đổi. Đọc code, bạn tìm ra hai lỗi: TTL dùng chung một biến có giá trị 1 giây, và list rỗng bị coi là miss. Commit ngày 21/09 của bạn sửa ba chỗ:

- Procedure cấu hình: key mới lưu JSON, cache được cả list rỗng, TTL 6 giờ, thêm hàm xóa cache để CMS gọi khi cấu hình đổi. Dữ liệu có thể cũ tối đa 6 giờ nếu CMS không gọi xóa, chấp nhận được với dữ liệu cấu hình.
- Procedure gói cước (một điểm nóng riêng, mỗi lần chạy nặng): cache Redis 60 phút, invalidate bằng version key. Dùng Redis thay MemoryCache vì code gọi sửa trực tiếp object trả về.
- API chứng chỉ: khử N+1 bằng cache danh mục dùng chung, memo theo request cho tên tỉnh, xã, trường, và negative cache cho cặp (tỉnh, xã) không có dữ liệu.

Mức giảm số lần gọi sau fix chưa được đo, nên con số mỗi phút trên CV chưa có cơ sở.

#### Cách show off

Câu chuyện này hay vì nguyên nhân rất "đời": không phải thiếu hạ tầng mà là hai lỗi nhỏ trong code cache. Người nghe đánh giá cao việc bạn sửa đúng gốc thay vì thêm máy, và việc bạn hiểu con số DMV đến mức không nói quá.

> **Ví dụ:** "Trong DMV có một procedure lấy danh mục môn và vòng thi chạy nhiều nhất cụm, hàng chục triệu lần cộng dồn, trong khi đó là dữ liệu cấu hình mấy tuần mới đổi một lần. Rõ ràng cache không hoạt động. Đọc code tôi thấy hai lỗi: TTL dùng chung một biến chỉ có 1 giây, và list rỗng bị coi là chưa có cache, nên những tổ hợp không có cấu hình lần nào cũng xuống DB. Tôi sửa để phân biệt 'chưa có key' với 'đã cache kết quả rỗng', tăng TTL lên vài giờ, và thêm hàm xóa cache cho trang quản trị gọi khi đổi cấu hình. Cùng đợt, cache gói cước tôi dùng version key, để khi đổi giá chỉ cần tăng một số thay vì quét Redis tìm key. Không thêm hạ tầng nào. Tôi chưa đo lại số lần gọi mỗi phút sau khi sửa, cách đo sẽ là chụp DMV hai lần cách nhau một giờ."

Điểm ăn điểm:

- Nhìn thấy điều bất thường trong số liệu: dữ liệu ít đổi mà gọi nhiều nhất.
- Biết "chỉ tăng TTL" là chưa đủ vì kết quả rỗng vẫn miss.
- Nói được đánh đổi của từng quyết định: dữ liệu cũ tối đa vài giờ, thêm một `GET` cho version key.
- Hiểu `execution_count` là số cộng dồn, không nói "đã loại bỏ 81 triệu lần gọi".

#### Câu hỏi vặn
- **"Sao không chỉ tăng TTL?"** TTL dài vẫn không cache kết quả rỗng, nên tổ hợp không có cấu hình vẫn miss mọi lần. Phải sửa cả hai: TTL hợp lý và negative caching.
- **"Negative cache có rủi ro gì?"** Cấu hình vừa tạo vẫn bị coi là rỗng tới khi hết TTL. Tôi thêm hàm xóa cache để trang quản trị gọi khi tạo hoặc sửa; nếu cần chặt hơn thì TTL ngắn hơn cho kết quả rỗng.
- **"Con số 81 triệu là trong bao lâu, sau fix còn bao nhiêu?"** Là số cộng dồn trong DMV kể từ lúc plan được cache, không phải số lần gọi đã loại bỏ. Muốn có tốc độ thì chụp hai lần cách nhau một giờ, cùng khung giờ, kiểm tra `cached_time` không đổi. Tôi chưa đo sau fix nên không đưa ra con số.
- **"Key hết hạn, nhiều request cùng miss thì sao?"** Đó là cache stampede. Dùng jitter cho TTL, single-flight hoặc lock khi nạp lại, hoặc refresh trước khi hết hạn. Single-flight trên nền tảng chỉ gộp trong một pod; giữa các pod vẫn có thể cùng xuống DB, với dữ liệu cấu hình thì chấp nhận được.
- **"Version key hoạt động thế nào, tốn gì?"** Key có dạng `pricing:v{n}:{service}`. Đổi gói thì `INCR` version; mọi lần đọc sau dùng version mới, key cũ tự hết hạn. Invalidate O(1), đổi lại thêm một `GET` mỗi lần đọc và bộ nhớ cho key cũ tới khi hết TTL.
- **"Sao dùng Redis mà không dùng MemoryCache cho nhanh?"** Code gọi sửa trực tiếp object trả về; MemoryCache trả chung một instance nên dữ liệu cache bị hỏng, Redis deserialize ra object mới. Thêm nữa, khi đổi giá thì mọi pod phải thấy cùng lúc.

#### Bẫy cần tránh

- Nói "đã loại bỏ 81 triệu lần gọi" hoặc cộng số lần chạy của hai procedure thành một con số.
- Nói mức giảm số lần gọi mỗi phút khi chưa đo.
- Đề xuất "chỉ cần tăng TTL" mà quên negative caching.
- Dùng MemoryCache cho object mà code gọi sửa trực tiếp.

#### Nhớ nhanh
- Phân biệt "không có key" với "đã cache kết quả rỗng"; đó là negative caching.
- Version key: `INCR` để invalidate cả nhóm, không cần quét.
- Stampede: jitter, single-flight, refresh sớm, lock khi nạp.
- `execution_count` cộng dồn từ `cached_time`; tốc độ phải đo bằng hai lần chụp.

#### Bài tập
1. Lần chụp DMV 1 có `execution_count` = 81.160.000 lúc 10:00, lần 2 có 81.724.000 lúc 11:00, `cached_time` không đổi. Tính số lần gọi mỗi phút.
   **Đáp án:** (81.724.000 − 81.160.000) / 60 = 9.400 lần/phút. Đây là số giả định để luyện cách tính, không phải số đo.
2. Viết luồng đọc cache gói cước theo version key, gồm cả nhánh miss.
   **Đáp án:** `ver = GET pricing:ver` (null là 0) → `key = pricing:v{ver}:{service}` → `GET key`; có giá trị thì deserialize; không có thì gọi procedure, `SET key json EX 3600`, trả kết quả. Khi đổi gói chỉ `INCR pricing:ver`.

### Bài 3.4. Bỏ join chéo database: đọc ở C#, ghi một lần dưới khóa

#### Kiến thức

##### Vì sao join chéo database là nợ kỹ thuật

Câu `JOIN OtherDb.dbo.T` chạy tốt khi hai database cùng instance. Khi muốn tách database sang server khác, câu đó phải đi qua linked server, và gặp đúng những vấn đề đã thấy khi rà soát: chờ mạng trong lúc giữ lock, optimizer ước lượng kém với dữ liệu từ xa. Join chéo còn làm mờ ranh giới sở hữu: không rõ database nào là chủ dữ liệu, đổi schema một database làm vỡ procedure ở database khác.

Cách gỡ phổ biến: **ứng dụng điều phối các lần đọc**, mỗi database chỉ trả dữ liệu của chính nó, rồi **một lần ghi** duy nhất vào database đích.

##### Điều phối đọc ở C#

Các lần đọc độc lập chạy song song, mỗi lần một kết nối riêng từ pool, nên độ trễ gần bằng lần đọc chậm nhất:

```csharp
var matrixTask = _examRepo.GetMatrixAsync(activityId, ct);       // DB đề thi
var poolTask   = _questionRepo.GetPoolAsync(bankId, ct);         // DB câu hỏi
var stateTask  = _integrationRepo.GetUserStateAsync(userId, ct); // DB tích hợp
await Task.WhenAll(matrixTask, poolTask, stateTask);

var plan     = AttemptPlanner.Plan(matrixTask.Result, stateTask.Result);
var selected = QuestionSelector.Select(plan, poolTask.Result);
```

Không dùng chung một `SqlConnection` cho các lệnh chạy song song.

##### Một lần ghi, kiểm tra lại dưới khóa

Các lần đọc ở trên chỉ để lập kế hoạch; giữa lúc đọc và lúc ghi, một request khác có thể đã tạo lượt làm bài. Vì vậy tính đúng phải nằm ở lần ghi: kiểm tra lại quota và cooldown **bên trong** transaction, dưới khóa. Danh sách câu hỏi đã chọn đi vào qua **table-valued parameter** (TVP), truyền nhiều dòng có kiểu rõ ràng trong một lần gọi:

```sql
CREATE TYPE dbo.SelectedQuestionList AS TABLE (OrderNo int NOT NULL PRIMARY KEY, QuestionId bigint NOT NULL);
GO
CREATE OR ALTER PROCEDURE dbo.usp_Attempt_Create      -- minh họa cơ chế, tên object là giả
    @UserId bigint, @ActivityId int, @DailyQuota int,
    @Questions dbo.SelectedQuestionList READONLY
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRAN;
    DECLARE @usedToday int =
        (SELECT COUNT(*) FROM dbo.Attempt WITH (UPDLOCK, HOLDLOCK)
         WHERE UserId = @UserId AND ActivityId = @ActivityId
           AND CreatedAt >= CAST(SYSDATETIME() AS date));
    IF @usedToday >= @DailyQuota THROW 50010, N'Hết lượt trong ngày', 1;

    INSERT dbo.Attempt (UserId, ActivityId, CreatedAt) VALUES (@UserId, @ActivityId, SYSDATETIME());
    DECLARE @AttemptId bigint = SCOPE_IDENTITY();
    INSERT dbo.AttemptQuestion (AttemptId, OrderNo, QuestionId)
    SELECT @AttemptId, OrderNo, QuestionId FROM @Questions;
    COMMIT;
    SELECT @AttemptId AS AttemptId;
END
```

Phía C#, tham số là `SqlDbType.Structured` với `TypeName = "dbo.SelectedQuestionList"` và giá trị là một `DataTable`, gọi bằng `CommandType.StoredProcedure`.

`UPDLOCK` giữ khóa update trên các dòng đọc được; `HOLDLOCK` (tương đương serializable) giữ khóa phạm vi tới hết transaction, kể cả khoảng chưa có dòng. Request thứ hai phải chờ request đầu commit rồi mới đếm lại, nên hai request song song không thể cùng vượt quota. Khóa phạm vi chỉ hẹp khi có index phù hợp trên `(UserId, ActivityId, CreatedAt)`. `XACT_ABORT ON` bảo đảm mọi lỗi đều rollback toàn bộ.

##### Script deploy chạy lại được

```sql
:on error exit
IF DB_NAME() <> N'<tên DB tích hợp>' THROW 50000, N'Sai database, dừng script', 1;
GO
CREATE OR ALTER PROCEDURE dbo.usp_Attempt_Create ...
```

Không có `:on error exit` (chế độ SQLCMD) hoặc `sqlcmd -b`, `THROW` chỉ dừng batch hiện tại; batch sau `GO` vẫn chạy trên sai database. `CREATE OR ALTER` giúp chạy lại không lỗi.

#### Bối cảnh dự án

Hệ thống luyện tập Mastery tách bốn database theo vai trò: đề thi, ngân hàng câu hỏi, tích hợp, log. Database tích hợp có 18 procedure, 12 cái trong số đó join chéo sang database khác; review dự án yêu cầu bỏ join chéo để các database có thể tách server. Đây là việc trọn của bạn (chuỗi commit 21–24/08):

- C# điều phối các lần đọc từ ba database, một planner ra quyết định theo ma trận đề, một selector chọn câu từ pool, rồi đúng một lần ghi qua TVP, kiểm tra lại cooldown, quota ngày và thứ tự lượt làm bài dưới `UPDLOCK, HOLDLOCK`.
- Phần chấm vẫn ở database câu hỏi; database tích hợp chỉ nhận đúng hay sai, nên đáp án không rời database câu hỏi.
- Script deploy kiểm tra tên database, chạy theo thứ tự đánh số, chạy lại an toàn.
- Lớp Redis mutex và idempotency key phía trên do đồng nghiệp viết.
- Bạn dùng Claude Code sinh nháp theo kế hoạch từng pha, tự review từng diff, chạy trên database dev và sửa cho khớp.
- Lúc rollout có cờ chuyển về luồng cũ đọc từ config; bạn hard-code cờ thành `true` ngay ngày 24/08, nên muốn quay lại luồng cũ phải deploy lại.

#### Cách show off

Đây là bài thiết kế thật duy nhất của bạn ở VTC, nên kể với đủ cân nhắc: vì sao phải đổi, đã cân nhắc phương án nào, tính đúng nằm ở đâu, và điều bạn sẽ làm khác. Tự nói chuyện cờ rollback và việc dùng AI trước khi bị hỏi; đó là điểm cộng về sự trung thực.

> **Ví dụ:** "Luồng tạo lượt làm bài của hệ thống luyện tập dùng bốn database, và phần lớn procedure ở database tích hợp join chéo sang các database khác. Muốn tách database ra server riêng thì những join đó thành lời gọi linked server, mà chúng tôi vừa thấy trong đợt rà soát là linked server trong transaction giữ lock rất lâu. Tôi viết lại để C# đọc song song từ từng database, chọn câu hỏi trong code, rồi ghi đúng một lần qua table-valued parameter. Chỗ tôi cân nhắc nhiều nhất là race: đọc trước ghi sau thì hai request có thể cùng thấy còn lượt. Nên lần ghi kiểm tra lại quota và cooldown trong transaction với UPDLOCK, HOLDLOCK, request thứ hai phải chờ rồi đếm lại. Một điều tôi sẽ làm khác: tôi bỏ cờ quay về luồng cũ quá sớm, ngay trong ngày rollout; nếu làm lại tôi giữ cờ tới hết đợt chạy thật đầu tiên."

Điểm ăn điểm:

- Nói được tính đúng nằm ở lần ghi, không phải ở các lần đọc.
- Giải thích vì sao không cần distributed transaction hay saga: chỉ có một lần ghi.
- Nói rõ phần của đồng nghiệp (Redis mutex, idempotency key) và vai trò của AI.
- Tự nêu sai lầm vận hành và bài học.

#### Câu hỏi vặn
- **"Đọc trước rồi ghi sau, có race condition không?"** Có nếu chỉ dựa vào lần đọc. Lần ghi chạy trong transaction `XACT_ABORT ON` với `UPDLOCK, HOLDLOCK` và kiểm tra lại cooldown, quota, thứ tự lượt. Request thứ hai chờ request đầu commit rồi mới đếm lại, nên không thể cùng vượt quota.
- **"Nhiều round-trip hơn join chéo, có chậm hơn không?"** Nhiều round-trip hơn, nhưng các lần đọc độc lập chạy song song nên độ trễ gần bằng lần đọc chậm nhất. Đổi lại ranh giới dữ liệu rõ và tách server không cần linked server. Tôi chấp nhận đánh đổi đó.
- **"Sao không dùng distributed transaction hay saga?"** Chỉ có một lần ghi, atomic, nên không có trạng thái ghi dở để bù trừ. Saga cần khi có nhiều bước ghi ở nhiều nơi; outbox cần khi phải phát event chắc chắn cùng lần ghi. Luồng này không có cả hai nhu cầu đó.
- **"Sao truyền TVP mà không truyền chuỗi JSON?"** TVP có kiểu và khóa chính rõ ràng ngay ở ranh giới, một lần gọi, không phải parse. JSON cũng được nhưng phải `OPENJSON ... WITH` và lỗi kiểu chỉ lộ ra lúc chạy.
- **"Có đường rollback không?"** Lúc rollout có cờ trong config để quay về luồng cũ. Tôi hard-code cờ ngay trong ngày sau khi chạy ổn trên dev, nên hiện muốn quay lại phải deploy lại. Đó là quyết định vội; lần sau tôi giữ cờ tới hết đợt chạy thật đầu tiên.
- **"Code này AI viết hay anh viết?"** Tôi dùng Claude Code sinh nháp theo kế hoạch từng pha; tôi review từng diff, chạy trên database dev và sửa cho khớp procedure mới. Thiết kế và trách nhiệm là của tôi, và tôi giải thích được từng dòng.
- **"Phần chống double-submit phía trên là của anh à?"** Không. Redis mutex và idempotency key do đồng nghiệp viết. Phần của tôi là lần ghi dưới khóa ở database, lớp cuối cùng giữ tính đúng kể cả khi Redis có vấn đề.

#### Bẫy cần tránh

- Nhận lớp Redis mutex và idempotency key là của mình.
- Nói "có rollback switch" mà không nói nó đã bị hard-code.
- Né chuyện dùng AI khi commit có co-author AI.
- Nói các lần đọc trước "đảm bảo nhất quán". Chúng chỉ để lập kế hoạch.

#### Nhớ nhanh
- Join chéo database thành linked server khi tách server: chậm, giữ lock lâu, mờ ranh giới sở hữu.
- Đọc song song ở C#, ghi đúng một lần qua TVP.
- Tính đúng ở lần ghi: `XACT_ABORT ON`, `UPDLOCK, HOLDLOCK`, kiểm tra lại quota và cooldown.
- Nói thật: Redis mutex của đồng nghiệp, AI sinh nháp, cờ rollback bỏ quá sớm.

#### Bài tập
1. Hai request cùng user cách nhau 5 ms, quota ngày còn 1 lượt. Mô tả từng bước trong procedure ghi.
   **Đáp án:** Request A vào transaction, `SELECT ... WITH (UPDLOCK, HOLDLOCK)` giữ khóa phạm vi, đếm còn 1 lượt, insert, commit. Request B chờ ở câu `SELECT`; sau khi A commit, B đếm thấy hết lượt và `THROW`. Chỉ một lượt được tạo.
2. Script deploy có `IF DB_NAME() <> N'X' THROW ...; GO CREATE OR ALTER PROCEDURE ...`. Chạy nhầm trên database khác bằng SSMS ở chế độ thường thì sao?
   **Đáp án:** `THROW` chỉ dừng batch đầu; batch sau `GO` vẫn chạy và tạo procedure trên sai database. Cần `:on error exit` ở chế độ SQLCMD, `sqlcmd -b`, hoặc lặp lại kiểm tra trong từng batch.

## Chương 4. Tính đúng và độ tin cậy

Chương 3 nói về nhanh; chương này nói về đúng và bền. Người phỏng vấn senior thường dùng chính các chủ đề này để đo chiều sâu: request bị gửi lại thì sao, service phía sau sập thì sao, làm sao biết thay đổi không phá gì, và làm sao biết hệ thống đang "đủ tốt".

Mức độ việc thật ở bốn bài rất khác nhau. Ghi kết quả một lần khi nộp bài là việc bạn làm. Resilience bằng Polly, kiểm thử bằng Testcontainers và SLO với burn-rate alert thì bạn chưa triển khai ở VTC; các bài đó dạy kiến thức đủ sâu để trả lời ở mức thiết kế, và dạy cách nói "tôi chưa làm, nếu làm tôi sẽ…" mà không mất điểm.

### Bài 4.1. Nộp bài an toàn khi bị gửi lại: idempotency, applock và Lua

#### Kiến thức

##### Vì sao cần idempotency

Mạng có thể mất phản hồi sau khi server đã xử lý xong. Client không biết điều đó nên gửi lại. Với API nộp bài, lần gửi lại không được tạo thêm kết quả. **Idempotent** nghĩa là gọi nhiều lần cho cùng hiệu ứng như gọi một lần.

Không có "exactly-once delivery" qua mạng: request và message luôn có thể đến nhiều lần (at-least-once). Cái làm được là hiệu ứng nghiệp vụ chỉ xảy ra một lần, nhờ **ghi idempotent theo khóa nghiệp vụ**. Thuật ngữ đúng là idempotent write hay insert-once.

Một hệ thống thi thường có ba lớp bảo vệ, mỗi lớp một việc:

##### Lớp 1: một phiên hoạt động mỗi user, bằng Lua compare-and-swap

Mỗi user có một key ghi sessionId đang hoạt động. Nếu làm `GET` rồi `SET` bằng hai lệnh, hai tab có thể cùng đọc thấy rỗng và cùng chiếm phiên. Script Lua chạy nguyên khối trên Redis, không lệnh nào chen vào giữa:

```lua
-- KEYS[1]: khóa phiên; ARGV[1]: sessionId mong đợi, ARGV[2]: sessionId mới, ARGV[3]: TTL giây
local cur = redis.call('GET', KEYS[1])
if (not cur) or cur == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return 1
end
return 0
```

Lần nộp từ phiên cũ bị từ chối vì sessionId không còn khớp. Script chỉ có `GET` và `SET` trên một key nên chạy vài micro-giây; script dài mới nguy hiểm vì Redis chạy script nguyên khối, chặn mọi client khác.

##### Lớp 2: lock ngắn bằng `SET NX` có token

Lấy lock: `SET lock:{key} <token> NX EX 5`. Nhả lock chỉ khi giá trị vẫn là token của mình (`if GET == token then DEL`), cũng bằng Lua. Không kiểm tra token thì request A có thể xóa nhầm lock của B khi lock của A đã hết hạn và B vừa lấy được. TTL ngắn để process chết thì lock tự nhả.

##### Lớp 3: ghi một lần ở database bằng applock

Redis lo phần nhanh và giảm tranh chấp; database lo phần đúng. Khi không được thêm unique index, `sp_getapplock` khóa theo một **tên logic**, kể cả khi chưa có dòng nào:

```sql
SET XACT_ABORT ON;
DECLARE @res nvarchar(255) = CONCAT(N'result:', @UserId, N':', @RoundId), @rc int;
BEGIN TRAN;
EXEC @rc = sp_getapplock @Resource = @res, @LockMode = 'Exclusive',
                         @LockOwner = 'Transaction', @LockTimeout = 5000;
IF @rc < 0 THROW 50001, N'Không lấy được lock', 1;

IF EXISTS (SELECT 1 FROM dbo.Result WITH (UPDLOCK, HOLDLOCK) WHERE UserId = @UserId AND RoundId = @RoundId)
    SELECT ResultId, Score FROM dbo.Result WHERE UserId = @UserId AND RoundId = @RoundId;  -- trả bản ghi cũ
ELSE
    INSERT dbo.Result (UserId, RoundId, Score, SessionId, CreatedAt)
    OUTPUT inserted.ResultId, inserted.Score
    VALUES (@UserId, @RoundId, @Score, @SessionId, SYSDATETIME());
COMMIT;
```

- Lock chỉ serialize các request cùng (user, vòng), không khóa bảng.
- `@LockOwner = 'Transaction'`: lock tự nhả khi commit hoặc rollback.
- Giá trị trả về: 0 lấy được ngay, 1 lấy được sau khi chờ, âm là thất bại (-1 hết thời gian chờ, -2 bị hủy, -3 bị chọn làm nạn nhân deadlock, -999 lỗi tham số).

##### Nếu được sửa schema: unique index

`CREATE UNIQUE INDEX UX_Result_User_Round ON dbo.Result (UserId, RoundId);` rồi trong procedure bắt lỗi 2601/2627 để trả bản ghi cũ. Đây là cách đơn giản và chắc nhất. Tạo index sẽ thất bại nếu bảng đã có bản ghi trùng; phải dọn trước. Ở tầng HTTP, thêm **idempotency key**: client gửi header cố định cho một thao tác, server lưu (key → kết quả) một thời gian, request lặp lại nhận kết quả cũ. Key phải gắn với user để không trả nhầm.

#### Bối cảnh dự án

Here I Come 2026–2027 là sự kiện thi theo chặng cho học sinh: 7 chặng, mỗi chặng một ca thi, dưới 60% điểm thì làm lại không giới hạn, từ 60% trở lên thì khóa chặng. Phần bạn làm (commit 02–09/10):

- Ghi kết quả một lần bằng `sp_getapplock` theo (user, vòng) kết hợp `UPDLOCK, HOLDLOCK`. Request kết thúc bài bị gửi lại thì server trả bản ghi đã có.
- Mỗi lần làm chặng định danh bằng sessionId, không dùng thời điểm bắt đầu vì có thể trùng.
- Ràng buộc đã chốt với nghiệp vụ: không tạo object mới trên bảng dùng chung, nên không thêm unique index được.
- Vòng quay thưởng: tạo bản ghi user vòng quay trong transaction có `UPDLOCK`, nên gửi lại không reset số lượt quay.

Lớp có sẵn của nền tảng, bạn hiểu và dùng chứ không viết: Lua compare-and-swap giữ một phiên mỗi user, lock `SET NX` có token, idempotency key ở luồng luyện tập. Số bản ghi trùng mỗi ngày trước và sau thay đổi chưa được đếm.

#### Cách show off

Mạch kể: vấn đề nghiệp vụ (một kết quả mỗi user mỗi vòng), ràng buộc thật (không được thêm unique index), lựa chọn và lý do, rồi đặt nó trong bức tranh nhiều lớp. Dùng đúng thuật ngữ, và nói rõ lớp nào có sẵn.

> **Ví dụ:** "Ở một sự kiện thi theo chặng, mỗi em mỗi vòng chỉ được có một kết quả, nhưng request kết thúc bài hay bị gửi lại khi mạng chập chờn. Cách sạch nhất là unique index trên user và vòng, nhưng bảng đó dùng chung với nhiều hệ thống và đã chốt là không thêm object mới. Nên tôi dùng sp_getapplock theo khóa user cộng vòng, trong transaction: có kết quả rồi thì trả lại bản ghi cũ, chưa có thì mới ghi. Lock chỉ chặn các request của cùng một em ở cùng một vòng, không khóa bảng. Phía trên, nền tảng có sẵn một script Lua giữ mỗi user một phiên thi; tôi dùng lớp đó chứ không tự viết. Tôi coi Redis là lớp giảm tranh chấp, còn tính đúng cuối cùng phải nằm ở database."

Điểm ăn điểm:

- Nói "idempotent write", không nói "exactly-once".
- Biết unique index là lựa chọn tốt nhất, và giải thích vì sao lần này không dùng được.
- Phân vai các lớp: Redis cho nhanh, database cho đúng; mất Redis thì chậm hơn nhưng không sai.
- Biết chi tiết dễ sai: nhả lock Redis phải kiểm tra token.

#### Câu hỏi vặn
- **"Sao không dùng unique index?"** Nếu được sửa schema thì đó là cách tốt nhất. Ở đây bảng dùng chung và đã chốt với nghiệp vụ là không thêm object mới, nên tôi dùng applock: chỉ serialize theo từng (user, vòng), không khóa bảng.
- **"Applock khác UPDLOCK, HOLDLOCK thế nào?"** Applock khóa theo một tên logic, kể cả khi chưa có dòng nào. `HOLDLOCK` trên dòng chưa tồn tại phải dựa vào key-range lock, cần index phù hợp mới khóa đúng phạm vi; thiếu index thì khóa có thể lan rộng.
- **"Đây có phải exactly-once không?"** Không. Request có thể đến nhiều lần; hiệu ứng nghiệp vụ chỉ xảy ra một lần nhờ ghi theo khóa nghiệp vụ. Thuật ngữ đúng là idempotent write.
- **"Mất Redis thì sao?"** Hệ thống chậm hơn và có thể cho mở hai phiên, nhưng kết quả vẫn chỉ ghi một lần vì database giữ tính đúng.
- **"Sao không dùng Redlock?"** Lock Redis ở đây chỉ để giảm tranh chấp; tính đúng do database bảo đảm. Nên không cần trả chi phí và chịu tranh cãi về độ an toàn của Redlock.
- **"sp_getapplock trả về -1 thì ứng dụng làm gì?"** Hết thời gian chờ, nghĩa là có request khác cùng (user, vòng) đang giữ lock. Procedure `THROW`, ứng dụng trả lỗi có thể thử lại; lần thử lại sau đó sẽ nhận bản ghi đã có.
- **"Trước khi sửa có bao nhiêu bản ghi trùng?"** Tôi chưa đếm, nên không đưa số. Cách đếm: group theo (user, vòng) có hơn một dòng, theo ngày, trước và sau ngày deploy, chạy trên bản sao.

#### Bẫy cần tránh

- Nói "tôi viết Lua compare-and-swap". Lớp đó có sẵn.
- Gọi cơ chế này là "exactly-once".
- Đưa ra số bản ghi trùng mỗi ngày khi chưa đếm.
- Nhả lock Redis bằng `DEL` không kiểm tra token.

#### Nhớ nhanh
- Ba lớp: Lua CAS cho phiên, `SET NX` có token cho lock ngắn, applock hoặc unique index cho ghi một lần.
- Applock theo (user, vòng), owner là transaction; có rồi thì trả bản ghi cũ.
- Idempotent write, không phải exactly-once delivery.
- Redis lo nhanh, database lo đúng.

#### Bài tập
1. Viết script Lua nhả lock chỉ khi token khớp, và giải thích lỗi nếu dùng `DEL` thẳng.
   **Đáp án:** `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`. Dùng `DEL` thẳng: lock của A hết hạn, B lấy lock, A xong việc và xóa lock của B, request C vào được trong khi B vẫn đang chạy.
2. Bảng kết quả đã có 300 cặp trùng, nghiệp vụ đồng ý thêm unique index. Liệt kê các bước.
   **Đáp án:** Chốt quy tắc giữ bản ghi nào; script chuyển bản ghi thừa sang bảng lưu trữ, có preview và rollback; tạo unique index ngoài giờ cao điểm (Standard Edition khóa bảng); sửa procedure bắt lỗi 2601/2627 để trả bản ghi cũ.

### Bài 4.2. Gọi service khác cho bền: timeout, retry, circuit breaker và rate limit

#### Kiến thức

##### Pipeline resilience chuẩn của .NET

Từ .NET 8, gói `Microsoft.Extensions.Http.Resilience` (xây trên Polly v8) cho một pipeline dựng sẵn:

```csharp
services.AddHttpClient<IScoreClient, ScoreClient>()
        .AddStandardResilienceHandler(o =>
        {
            o.AttemptTimeout.Timeout      = TimeSpan.FromSeconds(2);
            o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(6);
            o.Retry.MaxRetryAttempts      = 2;
        });
```

Thứ tự từ ngoài vào trong: rate limiter → total request timeout → retry → circuit breaker → attempt timeout. Total timeout giới hạn cả chuỗi retry theo ngân sách thời gian của request; attempt timeout giới hạn từng lần thử; breaker nằm trong retry nên mỗi lần thử đều được breaker tính.

##### Retry, circuit breaker, bulkhead

- **Retry** chỉ cho lỗi tạm thời (timeout, 5xx, 408, 429) và chỉ với thao tác idempotent hoặc có idempotency key. Luôn có exponential backoff kèm jitter để tránh retry storm. Mỗi lớp retry nhân tải lên lớp dưới: ba lớp, mỗi lớp thử tối đa 3 lần, thì một request gốc có thể thành 27 lời gọi tới service cuối. Retry ở một lớp nếu được.
- **Circuit breaker** có ba trạng thái: closed (cho qua và đếm lỗi), open (từ chối ngay), half-open (cho vài lời gọi thử). Mở khi tỉ lệ lỗi vượt ngưỡng trong cửa sổ lấy mẫu **và** đủ lưu lượng tối thiểu. Mục đích: không dồn tải vào service đang hỏng, trả lỗi nhanh cho caller.
- **Bulkhead** giới hạn số lời gọi đồng thời tới từng dependency, để một dependency chậm không chiếm hết thread và connection của cả service.

##### Deadline cho gRPC và lời gọi chạy nền

gRPC dùng deadline thay cho timeout và truyền deadline sang server: `client.PushEventAsync(req, deadline: DateTime.UtcNow.AddSeconds(2))`. Quy tắc nhất quán: lời gọi **đồng bộ trên đường request** phải có deadline. Lời gọi gửi event đã tách khỏi request thì deadline ngắn chỉ làm rơi event; cách đúng cho event là hàng đợi bền (Kafka hoặc outbox) để vừa không giữ request, vừa không mất event khi process chết. Kênh gRPC (`GrpcChannel`) nên dùng chung: tạo mới mỗi lần tốn socket và bắt tay HTTP/2.

##### Rate limit ở gateway YARP

YARP chạy trong ASP.NET Core nên dùng middleware rate limiting có sẵn:

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;   // mặc định là 503
    o.OnRejected = (ctx, _) =>
    {
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var ra))
            ctx.HttpContext.Response.Headers.RetryAfter = ((int)ra.TotalSeconds).ToString();
        return ValueTask.CompletedTask;
    };
    o.AddPolicy("per-user", ctx => RateLimitPartition.GetTokenBucketLimiter(
        ctx.User.FindFirst("sub")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new TokenBucketRateLimiterOptions
        { TokenLimit = 20, TokensPerPeriod = 10, ReplenishmentPeriod = TimeSpan.FromSeconds(1), QueueLimit = 0 }));
});
app.UseRateLimiter();
app.MapReverseProxy();
```

Route trong cấu hình YARP gắn policy bằng `"RateLimiterPolicy": "per-user"`. Token bucket cho phép burst tới `TokenLimit` rồi giới hạn theo tốc độ nạp. `Retry-After` không tự có, phải tự gắn như trên.

Giới hạn quan trọng: bộ đếm nằm trong bộ nhớ từng pod. Năm pod, mỗi pod 10 request/giây, thì một user đạt được 50. Muốn giới hạn toàn cục thì token bucket trên Redis bằng Lua.

##### Degrade thay vì sập theo

Luồng thi chỉ giữ được tỉ lệ thành công cao khi service phụ sập nếu nó **không phụ thuộc đồng bộ** vào service đó: tính năng phụ (feed, điểm thưởng) tắt được bằng cờ, lời gọi phụ có fallback khi breaker mở, event đi qua hàng đợi để xử lý bù.

#### Bối cảnh dự án

Bạn chưa triển khai Polly, rate limit ở YARP hay đo tỉ lệ thành công khi service phía sau sập; câu đó trên CV mới ở mức thiết kế. Việc thật gần nhất: fix API cập nhật thông tin học sinh phổ thông (commit 22/09). Mỗi lần gửi event gRPC code tạo `GrpcChannel` mới, và đoạn đồng bộ trước `await` đầu tiên giữ thread của request. Bạn dùng chung một `GrpcChannel`, đẩy lời gọi gửi event ra khỏi luồng request, và **cố ý không đặt deadline** vì service nhận có lúc chậm vài giây, đặt deadline sẽ làm rơi event. Báo cáo chỉ ghi mục tiêu độ trễ sau fix; chưa đo lại bằng APM.

#### Cách show off

Với chủ đề chưa làm, đừng né. Mở bằng câu thật ngắn gọn "tôi chưa triển khai", nối sang việc thật gần nhất cho thấy bạn đã nghĩ về cùng loại vấn đề, rồi trình bày thiết kế với đánh đổi rõ ràng.

> **Ví dụ:** "Polly và rate limit ở gateway tôi chưa triển khai ở production. Việc thật gần nhất là một API cập nhật thông tin học sinh: mỗi lần gửi event sang service khác, code tạo kết nối gRPC mới và giữ thread của request. Tôi dùng chung kênh gRPC, đẩy việc gửi event ra khỏi luồng request, và cố ý không đặt deadline, vì service nhận có lúc chậm vài giây, deadline ngắn sẽ làm mất event. Nhìn lại, hướng đúng hơn là đưa event vào hàng đợi bền. Nếu làm resilience đầy đủ, tôi tách hai loại lời gọi: lời gọi đồng bộ dùng standard resilience handler với timeout từng lần thử, retry có jitter chỉ cho thao tác idempotent, và circuit breaker; còn event thì đi qua Kafka. Ở gateway, token bucket theo user, trả 429 kèm Retry-After, và tôi biết bộ đếm đó chỉ nằm trong từng pod."

Điểm ăn điểm:

- Phân biệt lời gọi đồng bộ (phải có deadline) với event chạy nền (cần hàng đợi bền).
- Biết retry nhân tải qua các lớp và chỉ an toàn khi idempotent.
- Biết các mặc định dễ sai: rate limiter trả `503` nếu không đặt, `Retry-After` không tự có, bộ đếm theo pod.
- Không nói con số tỉ lệ thành công khi chưa có định nghĩa và cửa sổ đo.

#### Câu hỏi vặn
- **"Khi nào không được retry?"** Thao tác không idempotent và không có idempotency key, như nộp bài hay trừ tiền; lỗi do dữ liệu như 400, 422; khi breaker đang mở; khi đã hết ngân sách thời gian. Retry luôn có backoff, jitter và giới hạn số lần.
- **"Timeout đặt ngoài hay trong retry?"** Cả hai. Total timeout ở ngoài giới hạn cả chuỗi retry; attempt timeout ở trong giới hạn từng lần thử. Chỉ có timeout ngoài thì một lần treo ăn hết ngân sách; chỉ có timeout trong thì chuỗi retry kéo quá lâu.
- **"Code thật của anh không đặt deadline cho gRPC, vậy có mâu thuẫn không?"** Không, nếu tách hai loại lời gọi. Lời gọi đồng bộ trên đường request phải có deadline. Lời gọi gửi event đã tách khỏi request; deadline ngắn làm rơi event. Hướng đúng hơn là hàng đợi bền để vừa không giữ request vừa không mất event.
- **"5 pod gateway, giới hạn mỗi user 10 request/giây được không?"** Middleware đếm trong bộ nhớ từng pod, nên user có thể đạt 50. Muốn chính xác toàn cục thì token bucket trên Redis bằng Lua; hoặc chấp nhận xấp xỉ bằng cách chia giới hạn cho số pod nếu load balancer chia đều.
- **"Circuit breaker mở theo tiêu chí gì?"** Tỉ lệ lỗi vượt ngưỡng trong cửa sổ lấy mẫu, và phải đủ lưu lượng tối thiểu để không mở vì một lỗi trên hai request. Sau thời gian nghỉ chuyển half-open cho vài lời gọi thử, thành công thì đóng lại.
- **"Làm sao giữ API thi chạy được khi một service phía sau sập 20 phút?"** Luồng thi không gọi đồng bộ service đó; tính năng phụ tắt bằng cờ hoặc fallback khi breaker mở; event qua hàng đợi để xử lý bù. Đo bằng tỉ lệ request không lỗi 5xx của API thi trên APM trong đúng cửa sổ sự cố. Đây là thiết kế, tôi chưa có số đo.

#### Bẫy cần tránh

- Nói "mọi lời gọi đều có timeout" trong khi code thật cố ý không đặt deadline cho event.
- Bật retry cho `POST` nộp bài không có idempotency key.
- Tin rằng rate limit trong bộ nhớ pod là giới hạn toàn cục.
- Nói "99,9%" mà không định nghĩa thành công và cửa sổ đo.

#### Nhớ nhanh
- Standard resilience handler: rate limiter → total timeout → retry → circuit breaker → attempt timeout.
- Retry chỉ cho thao tác idempotent, có backoff, jitter, giới hạn; tránh retry ở nhiều lớp.
- Lời gọi đồng bộ có deadline; event đi hàng đợi bền.
- Rate limiter ASP.NET Core mặc định trả `503`; đặt `429` và `Retry-After` tường minh; bộ đếm theo pod.

#### Bài tập
1. YARP → service A → service B, mỗi lớp thử tối đa 3 lần. B sập. Một request của user tạo tối đa bao nhiêu lời gọi tới B?
   **Đáp án:** 3 × 3 = 9: YARP gọi A tối đa 3 lần, mỗi lần A gọi B tối đa 3 lần. Sửa: chỉ retry ở một lớp, có circuit breaker để ngừng gọi khi B đã sập.
2. Liệt kê thay đổi để luồng nộp bài không bị ảnh hưởng khi service điểm thưởng sập.
   **Đáp án:** Bỏ lời gọi đồng bộ tới service điểm thưởng khỏi luồng nộp bài; ghi event vào outbox cùng transaction với kết quả hoặc publish lên Kafka; worker xử lý bù khi service sống lại; cờ tắt tính năng; consumer cộng điểm phải idempotent.

### Bài 4.3. Kiểm thử tích hợp với Testcontainers và merge gate

#### Kiến thức

##### Vì sao cần engine thật

Khi logic nằm nhiều trong stored procedure, lock và script Redis, giả lập không bắt được lỗi. EF InMemory hay SQLite không chạy được T-SQL, `sp_getapplock`, `UPDLOCK`; mock Redis không chạy Lua. Test xanh mà production vẫn lỗi. Testcontainers dựng container SQL Server, Redis, Kafka thật cho test, chậm hơn nhưng đúng engine.

##### Dùng chung container giữa các test

Khởi động container mất vài giây tới vài chục giây, nên không dựng mới cho mỗi test. Trong xUnit, `ICollectionFixture` cho mọi test trong một collection dùng chung một bộ container:

```csharp
public sealed class DbFixture : IAsyncLifetime
{
    public MsSqlContainer Sql { get; } = new MsSqlBuilder()
        .WithImage("mcr.microsoft.com/mssql/server:2022-latest").Build();
    public RedisContainer Redis { get; } = new RedisBuilder().WithImage("redis:7").Build();

    public async Task InitializeAsync()
    {
        await Task.WhenAll(Sql.StartAsync(), Redis.StartAsync());
        // Chạy script schema và procedure theo thứ tự; tách theo GO vì SqlCommand không hiểu GO.
    }
    public async Task DisposeAsync() { await Sql.DisposeAsync(); await Redis.DisposeAsync(); }
}

[CollectionDefinition("db")] public sealed class DbCollection : ICollectionFixture<DbFixture> { }

[Collection("db")]
public sealed class SubmitResultTests(DbFixture fx)
{
    [Fact] public async Task Second_submit_returns_existing_result() { /* gọi procedure 2 lần, kiểm tra còn 1 dòng */ }
}
```

Giữa các test, xóa dữ liệu bằng Respawn (`ResetAsync` trước mỗi test) thay vì dựng lại database.

##### Kim tự tháp test và TDD đúng chỗ

- Nhiều **unit test** cho logic thuần: chọn câu hỏi, tính quota, cooldown. Nhanh, chạy mỗi lần build.
- **Integration test** với container cho procedure, Redis, Kafka.
- **Contract test** cho API giữa các service.
- Rất ít end-to-end.

TDD (red → green → refactor) hợp nhất với logic thuần có bảng case rõ, dùng `[Theory]` và `[InlineData]`. Logic theo thời gian dùng `TimeProvider` của .NET 8 và `FakeTimeProvider` trong test để không phụ thuộc giờ thật. Không ép TDD cho code nối dây.

##### Merge gate và cách đo hiệu quả

Jenkins agent cần Docker daemon (Testcontainers cần nó); pipeline chạy `dotnet test --logger "trx;LogFileName=results.trx"`, xuất kết quả cho Jenkins, và hệ thống quản lý mã nguồn chỉ cho merge khi pipeline xanh.

Muốn chứng minh test có ích thì đo **escaped defect**: bug phát hiện trên production, gắn với release đã đưa nó vào, lấy từ bug tracker, so trên số release tương đương trước và sau. Không có định nghĩa và nguồn thì con số "lỗi lọt giảm" không có nghĩa.

#### Bối cảnh dự án

Hiện trạng thật ở VTC: có integration harness chạy trên SQL fixture cho logic sự kiện và ma trận đề; phần lớn còn lại kiểm thử tay trên môi trường dev; codebase cũ ít unit test. Mọi repo dùng chung một Jenkins shared library để build và deploy. Merge gate với Testcontainers và số lỗi lọt giảm trên CV là việc chưa làm.

#### Cách show off

Nhiều đội vẫn kiểm thử tay là chính, và người phỏng vấn biết điều đó. Nói thật hiện trạng không mất điểm; mất điểm là nói quá rồi không trả lời được câu thứ hai. Ghi điểm bằng cách chỉ ra **chỗ nào đáng test trước** và vì sao phải dùng engine thật.

> **Ví dụ:** "Nói thật về kiểm thử ở chỗ tôi: có một bộ test tích hợp chạy trên SQL fixture cho logic sự kiện và ma trận đề, còn lại phần lớn vẫn kiểm thử tay trên dev. Merge gate với Testcontainers tôi chưa triển khai. Nếu làm, tôi không bắt đầu bằng phủ test cho đẹp mà từ chỗ rủi ro nhất: procedure ghi kết quả và luồng tạo lượt làm bài, vì lỗi ở đó là học sinh mất bài hoặc có hai kết quả. Logic đó nằm trong T-SQL và lock, nên phải chạy trên SQL Server thật trong container, dùng chung container theo collection cho nhanh. Phần chọn câu và tính quota là logic thuần, viết unit test dạng bảng case. Sau đó mới gắn vào Jenkins để chặn merge khi đỏ."

Điểm ăn điểm:

- Ưu tiên test theo rủi ro nghiệp vụ, không theo độ phủ.
- Giải thích được vì sao InMemory hay SQLite không dùng được ở đây.
- Biết chi phí khởi động container và cách chia sẻ.
- Biết cách đo hiệu quả test bằng escaped defect có định nghĩa.

#### Câu hỏi vặn
- **"Anh test stored procedure thế nào?"** Container SQL Server thật, chạy script schema và procedure theo thứ tự, gọi procedure như ứng dụng gọi, rồi kiểm tra dữ liệu. Lựa chọn khác là tSQLt, viết test bằng T-SQL ngay trong database. Hiện tôi có harness trên SQL fixture cho logic sự kiện và ma trận đề.
- **"Sao không dùng EF InMemory hoặc SQLite cho nhanh?"** Logic chính nằm trong T-SQL, applock, `UPDLOCK` và script Lua; InMemory và SQLite không chạy được những thứ đó. Test xanh nhưng production vẫn lỗi thì test vô nghĩa.
- **"Test chạy bao lâu, chạy song song được không?"** Chia sẻ container theo collection nên chi phí khởi động trả một lần. Các collection chạy song song, mỗi collection dùng database riêng để không đụng dữ liệu.
- **"Xử lý test flaky thế nào?"** Mỗi test tự tạo dữ liệu riêng; không phụ thuộc giờ thật, dùng `TimeProvider`; chờ theo điều kiện có timeout thay vì `Thread.Sleep`; không phụ thuộc thứ tự chạy.
- **"Viết test thế nào để chứng minh ghi kết quả là insert-once?"** Gọi procedure hai lần, hoặc song song bằng `Task.WhenAll`, cùng (user, vòng); kiểm tra chỉ còn một dòng và hai lần gọi trả cùng id.
- **"Con số lỗi lọt giảm trên CV lấy ở đâu?"** Phần này tôi chưa triển khai nên chưa có số. Nếu đo, escaped defect là bug phát hiện trên production gắn với release, lấy từ bug tracker, so trên số release tương đương.

#### Bẫy cần tránh

- Nói "tôi giới thiệu Testcontainers" khi chưa làm.
- Đưa số lỗi lọt giảm mà không có định nghĩa và bug tracker.
- Tạo container mới cho mỗi test: chậm, dễ timeout trên CI.
- Dùng `Thread.Sleep` để chờ consumer Kafka.

#### Nhớ nhanh
- Hiện trạng thật: harness trên SQL fixture cho sự kiện và ma trận đề; phần lớn test tay.
- Logic trong T-SQL, lock, Lua thì phải test trên engine thật bằng container.
- `ICollectionFixture` để dùng chung container, Respawn để xóa dữ liệu giữa các test.
- Test theo rủi ro: ghi kết quả và tạo lượt làm bài trước.

#### Bài tập
1. Viết bảng case `[Theory]` cho quy tắc: dưới 60% thì làm lại không giới hạn, từ 60% trở lên thì khóa chặng.
   **Đáp án:** `[InlineData(0, false)]`, `[InlineData(59.9, false)]`, `[InlineData(60, true)]`, `[InlineData(100, true)]` cho `IsStageLocked(scorePercent)`. Phải có case biên 59,9 và 60.
2. Pipeline Jenkins báo Testcontainers không kết nối được Docker. Nêu hai nguyên nhân thường gặp.
   **Đáp án:** Agent không có Docker daemon hoặc user chạy job không có quyền dùng Docker socket; agent chạy trong container mà không mount Docker socket hoặc không cấu hình Docker-in-Docker.

### Bài 4.4. Đo độ tin cậy: SLO, burn-rate alert, postmortem và OpenTelemetry

#### Kiến thức

##### SLI, SLO, SLA và error budget

- **SLI** là số đo, ví dụ tỉ lệ request bắt đầu thi thành công trong dưới 250 ms.
- **SLO** là mục tiêu nội bộ cho SLI, ví dụ 99,9% trong cửa sổ 30 ngày.
- **SLA** là cam kết với khách hàng, có chế tài, thường lỏng hơn SLO.
- **Error budget** = 1 − SLO. SLO 99,9% trong 30 ngày cho phép 0,1% request xấu, quy ra khoảng 43 phút.

SLO latency nên viết dạng **tỉ lệ request tốt** thay vì "p95 dưới 300 ms", vì tỉ lệ là phép đếm: cộng được giữa các pod và các khoảng thời gian, từ đó tính được error budget. Percentile không cộng được.

##### Đo bằng histogram

.NET 8 phát metric `http.server.request.duration` (trên Prometheus là `http_server_request_duration_seconds`, label route `http_route`). Tỉ lệ request nhanh hơn ngưỡng:

```promql
sum(rate(http_server_request_duration_seconds_bucket{http_route="/exam/start", le="0.25"}[5m]))
/
sum(rate(http_server_request_duration_seconds_count{http_route="/exam/start"}[5m]))
```

Ngưỡng `le` phải trùng một biên bucket. Biên mặc định của metric này có 0,1, 0,25, 0,5 giây… nhưng không có 0,3. Muốn ngưỡng 300 ms phải khai báo bucket riêng bằng `AddView("http.server.request.duration", new ExplicitBucketHistogramConfiguration { Boundaries = [0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5] })`.

##### Burn-rate alert nhiều cửa sổ

**Burn rate** = tỉ lệ lỗi hiện tại / tỉ lệ lỗi cho phép. Burn rate 1 nghĩa là tiêu hết budget đúng sau 30 ngày. Ngưỡng theo SRE Workbook cho SLO 99,9%, cửa sổ 30 ngày (720 giờ):

| Mức | Tiêu bao nhiêu budget | Cửa sổ dài / ngắn | Burn rate | Hành động |
|---|---|---|---|---|
| Nhanh | 2% trong 1 giờ | 1 giờ / 5 phút | 0,02 × 720 / 1 = 14,4 | Page |
| Vừa | 5% trong 6 giờ | 6 giờ / 30 phút | 0,05 × 720 / 6 = 6 | Page |
| Chậm | 10% trong 3 ngày | 3 ngày / 6 giờ | 0,10 × 720 / 72 = 1 | Ticket |

Alert chỉ kêu khi **cả hai** cửa sổ vượt ngưỡng: cửa sổ dài bảo đảm đủ ý nghĩa, cửa sổ ngắn giúp alert tự tắt nhanh khi sự cố đã hết.

```yaml
- alert: ExamStartFastBurn
  expr: slo:exam_start_bad_ratio:rate1h > (14.4 * 0.001) and slo:exam_start_bad_ratio:rate5m > (14.4 * 0.001)
  labels: { severity: page }
```

Hai recording rule `rate1h` và `rate5m` là `1 −` tỉ lệ request tốt ở trên, tính trên cửa sổ tương ứng. Request lỗi 5xx cũng phải tính là xấu, thường bằng một SLI availability riêng. Page theo **triệu chứng người dùng thấy**, không theo nguyên nhân như CPU cao.

##### Postmortem blameless

Mục đích là sửa hệ thống, không tìm người có lỗi. Khung: tóm tắt; tác động; timeline (phát hiện, chẩn đoán, khắc phục); nguyên nhân gốc và yếu tố góp phần; điều làm tốt; điều may mắn; action item có người chịu trách nhiệm và hạn.

##### OpenTelemetry trong .NET

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation()
        .AddSqlClientInstrumentation()
        .SetSampler(new ParentBasedSampler(new TraceIdRatioBasedSampler(0.1)))
        .AddOtlpExporter())
    .WithMetrics(m => m.AddAspNetCoreInstrumentation().AddRuntimeInstrumentation().AddPrometheusExporter());
```

Trace context truyền tự động qua header W3C `traceparent` trên HTTP và gRPC; với Kafka phải tự gắn vào header message khi produce và lấy ra khi consume. Head-based sampling rẻ nhưng quyết định từ đầu nên có thể bỏ sót trace lỗi; tail-based ở OpenTelemetry Collector giữ được trace lỗi hoặc chậm, đổi lại Collector phải đệm trace. Dashboard mỗi API theo RED (Rate, Errors, Duration), tài nguyên theo USE (Utilization, Saturation, Errors).

#### Bối cảnh dự án

Hiện trạng observability thật: Elastic APM cho trace theo request, Prometheus cho metric của các worker Kafka, log ứng dụng đi NLog → Kafka → Elasticsearch. Bạn chưa viết postmortem, chưa đặt SLO hay burn-rate alert, chưa có số page để so; câu đó trên CV mới ở mức thiết kế. Việc làm được ngay để có câu chuyện thật: viết postmortem cho sự cố API bắt đầu thi thử chậm vì vòng `SCAN`, lấy baseline p95 của các API thi trên APM, và đếm số alert hiện có mỗi tháng làm mốc.

#### Cách show off

Đây là chủ đề người phỏng vấn dùng để xem bạn nghĩ về độ tin cậy như một người vận hành hay không. Cách nói tốt: thừa nhận chưa làm, cho thấy bạn hiểu vì sao SLO viết dạng tỉ lệ, chọn ngưỡng từ dữ liệu, và chỉ ra sự cố thật đầu tiên bạn sẽ áp dụng.

> **Ví dụ:** "SLO và burn-rate alert tôi chưa triển khai. Hiện chúng tôi có Elastic APM cho trace và Prometheus cho metric của worker. Nếu đặt SLO cho API bắt đầu thi, tôi viết nó dạng tỉ lệ request thành công dưới một ngưỡng độ trễ, vì tỉ lệ cộng được giữa các pod còn p95 thì không. Ngưỡng tôi lấy từ baseline p95 hiện tại chứ không chọn một số đẹp, và phải trùng biên bucket của histogram. Alert thì page theo burn rate với hai cửa sổ, để vừa không kêu vì một đợt nhiễu vừa tự tắt khi sự cố hết. Postmortem đầu tiên tôi muốn viết là đợt API bắt đầu thi chậm vì vòng quét Redis, theo kiểu blameless, với action item rõ người và hạn."

Điểm ăn điểm:

- Giải thích vì sao SLO dạng tỉ lệ, không chỉ thuộc định nghĩa.
- Biết ràng buộc kỹ thuật nhỏ mà thật: ngưỡng phải là biên bucket.
- Nói được ngưỡng 14,4 từ đâu ra, không học thuộc.
- Page theo triệu chứng, không theo nguyên nhân.

#### Câu hỏi vặn
- **"Ngưỡng burn rate 14,4 ở đâu ra?"** Tiêu 2% error budget của 30 ngày (720 giờ) trong 1 giờ: 0,02 × 720 / 1 = 14,4. Tương tự 5% trong 6 giờ cho 6, và 10% trong 3 ngày cho 1. Mỗi alert dùng cửa sổ dài kèm cửa sổ ngắn.
- **"Ngưỡng 300 ms cho SLO lấy từ đâu?"** Từ baseline p95 và p99 hiện tại, từ thời gian chờ người dùng chấp nhận, và từ chi phí để đạt. SLO quá chặt thì đội luôn chữa cháy, quá lỏng thì không phản ánh trải nghiệm. Ngưỡng phải trùng một biên bucket.
- **"Đang có Elastic APM, sao còn thêm OpenTelemetry?"** OpenTelemetry là chuẩn mở: instrument một lần, đổi backend bằng cấu hình exporter. Elastic APM nhận được OTLP nên không phải bỏ hệ thống cũ.
- **"Head-based và tail-based sampling khác nhau thế nào?"** Head-based quyết định ngay ở span đầu theo tỉ lệ, rẻ nhưng có thể bỏ sót trace lỗi. Tail-based quyết định ở Collector sau khi trace xong, giữ được trace lỗi hoặc chậm, đổi lại tốn bộ nhớ đệm và cần mọi span của một trace về cùng Collector.
- **"Làm sao giảm số lần bị gọi dậy ban đêm?"** Bỏ alert theo nguyên nhân, chỉ page theo burn rate của SLO; gộp alert cùng sự cố; cái không cần xử lý ngay thì thành ticket; mỗi page có runbook; alert không ai hành động thì xóa sau buổi review. Tôi chưa làm việc này, và con số trên CV chưa được đo.
- **"Postmortem gần nhất anh viết là gì?"** Tôi chưa viết postmortem chính thức ở VTC. Sự cố tôi sẽ viết là API bắt đầu thi thử chậm vì vòng `SCAN`: phát hiện qua đợt rà soát APM, nguyên nhân gốc, cách sửa, và action item như đo p95 trước sau, rà các chỗ khác dùng `SCAN` hoặc `KEYS` trên đường request.

#### Bẫy cần tránh

- Viết `le="0.3"` khi histogram không có bucket 0,3.
- Lấy trung bình p95 của nhiều pod.
- Page theo nguyên nhân (CPU cao) thay vì theo triệu chứng.
- Nói "số page giảm từ X xuống Y" khi chưa có hệ thống on-call để đếm.

#### Nhớ nhanh
- SLI là số đo, SLO là mục tiêu nội bộ, SLA là cam kết có chế tài; error budget = 1 − SLO.
- SLO latency viết dạng tỉ lệ request tốt; ngưỡng là biên bucket của histogram.
- Burn rate hai cửa sổ: 14,4 và 6 để page, 1 để mở ticket.
- Việc thật làm được ngay: postmortem cho sự cố vòng `SCAN`, baseline p95, đếm alert hiện có.

#### Bài tập
1. SLO 99,5% trong 28 ngày. Tính error budget theo thời gian và burn rate ứng với việc tiêu 2% budget trong 1 giờ.
   **Đáp án:** 28 × 24 × 60 × 0,005 = 201,6 phút. Cửa sổ 672 giờ; burn rate = 0,02 × 672 / 1 = 13,44.
2. Trong 1 giờ có 120.000 request bắt đầu thi, 1.900 request chậm hơn ngưỡng. Với SLO 99,9%, burn rate là bao nhiêu và có page không?
   **Đáp án:** Tỉ lệ xấu 1.900 / 120.000 ≈ 1,58%; burn rate ≈ 15,8 > 14,4. Page nếu cửa sổ 5 phút cũng vượt 14,4.
