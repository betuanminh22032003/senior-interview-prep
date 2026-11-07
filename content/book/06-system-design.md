# Phần V. System design

Phần này luyện vòng system design: trong khoảng 40 phút, bạn nhận một đề mở ("thiết kế hệ thống thi cho 200K thí sinh"), phải hỏi lại yêu cầu, ước lượng tải bằng con số, vẽ kiến trúc, rồi đào sâu vào chỗ dễ hỏng. Interviewer không chấm sơ đồ đẹp; họ chấm cách bạn suy luận từ con số sang quyết định, và việc bạn tự nêu đánh đổi trước khi bị hỏi.

Chương 15 đưa ra phương pháp chung. Chương 16 là năm bài mẫu sát với domain thi trực tuyến và giáo dục, mỗi bài có ước lượng, thiết kế, điểm nghẽn, cách hỏng và cách quan sát. Ở chỗ có việc thật tương ứng, bài ghi rõ phần nào bạn đã làm, phần nào là lớp có sẵn, phần nào chỉ là thiết kế đề xuất.

## Chương 15. Phương pháp

Interviewer dùng câu hỏi system design để xem bạn có làm việc được ở mức thiết kế hay chỉ ở mức sửa code. Ứng viên trượt vòng này thường không phải vì thiếu kiến thức, mà vì nhảy vào vẽ ngay, không có con số, và không nói hệ thống hỏng thế nào. Học xong chương này, bạn có một khung trả lời cố định, một bảng số để ước lượng, và một danh sách khối xây dựng kèm đánh đổi.

### Bài 15.1. Khung trả lời 6 bước trong 40 phút

#### Mục tiêu
- Sau bài này, bạn đi được hết 6 bước của một buổi system design mà không hết giờ ở bước 3.
- Bạn có sẵn bộ câu hỏi làm rõ yêu cầu để dùng ngay ở 5 phút đầu.
- Bạn tránh được các lỗi làm mất điểm phổ biến.

#### Sáu bước và phân bổ thời gian

| Bước | Việc phải làm | Thời gian |
|---|---|---|
| 1. Hỏi yêu cầu | Chức năng, phi chức năng (tải, độ trễ, tính đúng), ràng buộc | 5 phút |
| 2. Ước lượng | QPS đọc/ghi, đỉnh tải, dung lượng, băng thông | 5 phút |
| 3. Luồng chính | Sơ đồ khối, API chính, mô hình dữ liệu | 10 phút |
| 4. Điểm nghẽn | Chọn 2–3 điểm nghẽn, đào sâu, nêu đánh đổi | 10 phút |
| 5. Cách hỏng | Từng thành phần chết hoặc chậm thì sao | 5 phút |
| 6. Quan sát | SLO, metric, alert, dashboard, vận hành | 3 phút |
| Dự phòng | Tóm tắt, trả lời câu hỏi thêm | 2 phút |

Bước 4 là phần chấm điểm chính. Nếu bước 3 vượt 15 phút, dừng lại và nói: "Luồng chính như vậy, tôi xin đào sâu vào điểm nghẽn ở giây đầu ca thi."

#### Câu hỏi làm rõ mẫu
- **Chức năng:** người dùng làm gì, thao tác nào quan trọng nhất? Tính năng nào ngoài phạm vi?
- **Quy mô:** bao nhiêu người dùng tổng, bao nhiêu đồng thời lúc đỉnh? Tải đều hay dồn vào một thời điểm (đầu ca thi)?
- **Độ trễ:** thao tác nào cần nhanh (bắt đầu thi, nộp bài), thao tác nào trễ được (báo cáo)?
- **Tính đúng:** được mất dữ liệu không? Được ghi trùng không? Đọc dữ liệu cũ vài giây có chấp nhận được không?
- **Ràng buộc:** hạ tầng có sẵn (SQL Server Standard Edition, Redis, Kafka), đội bao nhiêu người, có được thêm hệ thống mới không?

Khi interviewer không cho số, bạn tự đặt giả định có số và ghi lên bảng: "Tôi giả định 200K đồng thời, 80% vào trong 2 phút đầu." Giả định sai cũng được, miễn là nói ra và tính tiếp được.

#### Cách nói trong lúc thiết kế
- Nghĩ thành tiếng: nêu 2 phương án, chọn 1, nói lý do bằng con số.
- Mỗi khối thêm vào phải trả lời "vì sao cần". Kafka cho 10 request/s là thiết kế quá mức.
- Tách rõ đường nóng (hot path, đường người dùng đang chờ) với đường nền (chạy sau, chậm được).

#### Lỗi hay gặp
- Vẽ ngay sơ đồ microservice trước khi hỏi yêu cầu.
- Liệt kê công nghệ không có lý do ("dùng Kafka, Redis, Kubernetes").
- Chỉ tính tải trung bình, quên đỉnh tải ở giây đầu.
- Nói "exactly-once" khi ý thật là ghi idempotent (xem Bài 4.1).
- Không nói gì về cách hỏng và cách quan sát.
- Sa vào một chi tiết (cú pháp Lua, cấu hình Kafka) mà bỏ dở các bước sau.

> **Mẹo:** Viết 6 bước ở góc bảng ngay từ đầu, đánh dấu từng bước khi xong. Interviewer thấy bạn có cấu trúc, và bạn không quên bước 5, 6.

#### Câu hỏi phỏng vấn
- **"Bạn bắt đầu một bài system design thế nào?"** Tôi hỏi 5 phút về chức năng chính, quy mô đồng thời lúc đỉnh, độ trễ cần có và mức chấp nhận mất hoặc trùng dữ liệu. Sau đó tôi ước lượng tải bằng con số rồi mới vẽ.
- **"Nếu tôi không cho số liệu thì bạn làm gì?"** Tôi tự đặt giả định có số, ghi lên bảng và nói rõ đó là giả định. Thiết kế dựa trên giả định đó; nếu anh/chị đổi số, tôi chỉ ra phần nào phải đổi theo.
- **"Làm sao biết bạn đã đào đủ sâu?"** Khi tôi nói được: điểm nghẽn ở đâu bằng con số, có 2 phương án, chọn phương án nào, đánh đổi là gì, và hỏng thì hệ thống còn đúng không.
- **"Giữa chừng yêu cầu thay đổi, ví dụ tải tăng gấp 10, bạn xử lý thế nào?"** Tính lại con số, xác định khối nào vượt ngưỡng trước (thường là DB ghi hoặc một hot key), rồi nói thay đổi tối thiểu cho khối đó thay vì vẽ lại toàn bộ.

#### Tóm tắt
- 6 bước: yêu cầu, ước lượng, luồng chính, điểm nghẽn, cách hỏng, quan sát.
- Bước 4 là phần chính; đừng để bước 3 ăn hết thời gian.
- Không có số thì tự đặt giả định có số.
- Mỗi khối phải có lý do; mỗi quyết định phải có đánh đổi.

#### Bài tập
1. Viết 8 câu hỏi làm rõ cho đề "thiết kế hệ thống chấm bài viết bằng AI".
   **Đáp án:** Số bài mỗi ngày và đỉnh; thời gian chấm chấp nhận được; AI chấm mất bao lâu; giới hạn số lần nộp; chấm lỗi thì sao (chấm lại, báo lỗi); có cần người duyệt không; callback hay polling; lưu bài bao lâu.
2. Bấm giờ 40 phút, làm Bài 16.1 trên giấy, ghi lại bạn đã dùng bao nhiêu phút cho mỗi bước.
   **Đáp án:** Nếu bước 3 vượt 15 phút, luyện lại bằng cách vẽ luồng chính chỉ với 5–6 khối.

### Bài 15.2. Ước lượng tải bằng con số

#### Mục tiêu
- Sau bài này, bạn thuộc bảng số cỡ độ lớn về độ trễ, thông lượng và băng thông.
- Bạn dùng được Little's law để tính số request đồng thời và kích thước connection pool.
- Bạn chuyển được "200K thí sinh" thành QPS, dung lượng và băng thông trong 3 phút.

#### Bảng số cần thuộc
Các số dưới đây là cỡ độ lớn để ước lượng, không phải số đo của một hệ thống cụ thể.

| Thao tác | Cỡ độ lớn |
|---|---|
| Đọc RAM | ~100 ns |
| Đọc ngẫu nhiên SSD | ~20–100 µs |
| Round-trip mạng trong cùng datacenter | ~0,5 ms |
| Lệnh Redis đơn giản (GET/SET) tính cả mạng | ~0,2–1 ms |
| Một Redis instance | ~100K lệnh đơn giản/s |
| Procedure SQL seek theo index, tính cả round-trip | ~1–5 ms |
| Round-trip giữa hai châu lục | ~100–150 ms |
| Một instance API .NET có gọi DB | cỡ vài trăm đến vài nghìn request/s, tùy truy vấn |
| 1 Gbps | ~125 MB/s |
| Một ngày | 86.400 s ≈ 10^5 s; 1 triệu việc/ngày ≈ 12/s |

Quy tắc nhanh: query 2 ms thì một connection phục vụ được khoảng 500 request/s (nguồn: mục 2). Query 200 ms thì chỉ còn 5 request/s.

#### Little's law
**Định nghĩa:** L = λ × W. Số việc đang nằm trong hệ thống (L) bằng tốc độ đến (λ) nhân thời gian mỗi việc ở lại (W).

**Vì sao quan trọng:** nó nối độ trễ với tài nguyên. Độ trễ tăng thì số request đồng thời tăng theo, kéo theo thread, connection và bộ nhớ.

**Ví dụ:** API bắt đầu thi nhận 1.700 request/s.
- Nếu mỗi request mất 55 ms: L = 1.700 × 0,055 ≈ 94 request đồng thời.
- Nếu mỗi request mất 2,45 s: L = 1.700 × 2,45 ≈ 4.165 request đồng thời. Connection pool mặc định của SqlClient là 100 connection mỗi chuỗi kết nối, nên request sẽ xếp hàng chờ connection và timeout dây chuyền.

Hai con số 2,45 s và 55 ms là thời gian của một trace điển hình trước và sau đợt sửa thật (xem Bài 24.2), không phải p95.

#### Ví dụ tính cho đề thi 200K thí sinh
- **Bắt đầu thi:** 200.000 người trong 2 phút ≈ 1.700 request/s trung bình. Nếu 30% vào trong 10 giây đầu: 60.000 / 10 = 6.000 request/s.
- **Lưu bài tự động:** mỗi 30 s một lần: 200.000 / 30 ≈ 6.700 lần ghi/s. Mỗi 10 s: 20.000 lần ghi/s.
- **Bộ nhớ trạng thái bài làm:** 50 câu × ~20 byte ≈ 1 KB/thí sinh; 200K × 1 KB ≈ 200 MB trên Redis.
- **Băng thông tải đề:** đề 200 KB × 200K = 40 GB trong 2 phút ≈ 333 MB/s ≈ 2,7 Gbps. Con số này cho thấy đề nên đi qua CDN hoặc tải trước giờ thi.

> **Cảnh báo:** Luôn tính đỉnh, không chỉ trung bình. Hệ thống thi hỏng ở giây đầu ca, không hỏng ở mức trung bình.

#### Câu hỏi phỏng vấn
- **"200K người bắt đầu thi trong 2 phút, cần bao nhiêu QPS?"** Trung bình khoảng 1.700 request/s. Nhưng tải dồn vào giây đầu, nên tôi thiết kế cho đỉnh vài nghìn request/s và có cơ chế dàn tải.
- **"Little's law giúp gì khi chọn connection pool?"** Số connection cần ≈ QPS gọi DB × thời gian giữ connection. 1.000 request/s × 5 ms = 5 connection; nếu query chậm thành 500 ms thì cần 500, vượt pool. Vì vậy sửa query trước, không tăng pool trước.
- **"Tại sao không tăng connection pool khi thấy timeout?"** Query chậm mà tăng pool thì càng nhiều connection dồn vào DB, càng tranh chấp (nguồn: mục 2). Pool đầy là triệu chứng của W tăng.
- **"Một Redis chịu được bao nhiêu lệnh mỗi giây?"** Cỡ 100K lệnh đơn giản mỗi giây trên một instance. Lệnh O(N) như `SCAN` toàn keyspace hay script dài thì làm con số này sụp, vì Redis xử lý lệnh trên một luồng.

#### Tóm tắt
- Thuộc cỡ độ lớn: RAM ns, SSD µs, mạng nội bộ 0,5 ms, Redis dưới 1 ms, SQL seek vài ms.
- L = λ × W: độ trễ tăng thì tài nguyên đồng thời tăng tương ứng.
- 1 ngày ≈ 10^5 giây; 1 Gbps ≈ 125 MB/s.
- Luôn tính đỉnh và nói giả định phân bố tải.

#### Bài tập
1. Hệ thống có 5 triệu lượt nộp bài mỗi ngày, 40% dồn vào 2 giờ tối. Tính QPS trung bình và QPS trong 2 giờ đó.
   **Đáp án:** Trung bình 5.000.000 / 86.400 ≈ 58/s. Trong 2 giờ: 2.000.000 / 7.200 ≈ 278/s.
2. API nhận 800 request/s, mỗi request gọi DB 3 lần, mỗi lần giữ connection 4 ms. Cần bao nhiêu connection?
   **Đáp án:** λ = 2.400 lần gọi/s, W = 0,004 s, L ≈ 10 connection; cộng dư phòng cho đỉnh, pool 30–50 là đủ.
3. Tính băng thông nếu 200K thí sinh tải đề 500 KB trong 1 phút.
   **Đáp án:** 100 GB / 60 s ≈ 1,67 GB/s ≈ 13 Gbps. Cần CDN hoặc tải đề mã hóa trước giờ thi.

### Bài 15.3. Khối xây dựng: cache, queue, DB, replica, shard, rate limit

#### Mục tiêu
- Sau bài này, bạn chọn được khối phù hợp dựa trên dấu hiệu tải cụ thể.
- Bạn nêu được đánh đổi của từng khối mà không cần interviewer hỏi.
- Bạn biết khối nào giữ tính đúng, khối nào chỉ giữ tốc độ.

#### Bảng chọn khối

| Khối | Dùng khi | Đánh đổi chính |
|---|---|---|
| Cache (Redis, memory) | Đọc nhiều hơn ghi, dữ liệu đổi ít | Dữ liệu cũ, invalidation, stampede |
| Queue (Kafka, RabbitMQ) | Việc không cần làm ngay, cần làm phẳng đỉnh tải | Trễ, at-least-once nên consumer phải idempotent |
| DB quan hệ | Cần transaction, ràng buộc, truy vấn linh hoạt | Ghi khó scale ngang |
| Replica | Đọc lớn, chịu được dữ liệu trễ | Replication lag, read-your-writes |
| Shard | Một DB không chứa nổi dữ liệu hoặc tải ghi | Chọn shard key, truy vấn chéo shard |
| Rate limit | Bảo vệ hệ thống trước đỉnh tải hoặc lạm dụng | Từ chối người dùng hợp lệ lúc đỉnh |

#### Cache
Cache-aside: đọc cache, miss thì đọc DB rồi ghi cache. Các kỹ thuật cần nói được (xem Bài 3.3): TTL theo loại dữ liệu, negative cache cho kết quả rỗng, version key để invalidate O(1), single-flight chống stampede. Bẫy: đặt thao tác O(keyspace) như `SCAN` trên đường nóng; đây chính là nguyên nhân API bắt đầu thi mất 2,45 s trong đợt audit thật (xem Bài 24.2).

> **Ghi nhớ:** Redis lo phần nhanh và giảm tranh chấp; DB lo phần đúng. Mất Redis thì hệ thống chậm hơn nhưng không được sai dữ liệu (nguồn: B3).

#### Queue
Dùng khi phía sau chậm hơn phía trước, hoặc việc có thể làm sau (chấm bài, ghi lịch sử, đẩy báo cáo). Kafka giữ thứ tự trong một partition, nên đặt key theo thực thể cần giữ thứ tự (userId, matchId). Ngữ nghĩa thực tế là at-least-once: commit offset sau khi xử lý, consumer ghi idempotent. Kafka hợp với log sự kiện có replay; RabbitMQ hợp với hàng đợi việc có routing linh hoạt.

#### DB, replica, shard
- **DB:** chọn index theo access pattern. Bảng log ghi liên tục không nên thêm index trên key ngẫu nhiên vì page split và WRITELOG tăng (xem Phần VI).
- **Replica:** đẩy truy vấn báo cáo, tra cứu ra khỏi primary. Ngay sau khi ghi mà cần đọc lại thì đọc từ primary để tránh lag.
- **Partition:** chia một bảng theo khóa (ví dụ ca thi) trong cùng DB, giúp đánh index hoặc xóa theo ca.
- **Shard:** chia dữ liệu sang nhiều DB. Shard key cần cardinality cao, phân bố đều, và đa số truy vấn chỉ chạm một shard. Chỉ shard khi các bước trước không đủ.

#### Rate limit
Token bucket: mỗi client có thùng N token, nạp lại r token mỗi giây; cho phép burst tới N. Sliding window đếm chính xác hơn nhưng tốn bộ nhớ hơn. Đặt ở gateway, trả `429` kèm `Retry-After`. Với đầu ca thi, rate limit kết hợp phòng chờ (waiting room) để người dùng thấy hàng đợi thay vì lỗi.

#### Câu hỏi phỏng vấn
- **"Khi nào bạn không dùng cache?"** Khi dữ liệu phải luôn mới (số dư, quota đang trừ), khi tỉ lệ đọc lặp lại thấp, hoặc khi chi phí invalidation lớn hơn lợi ích. Cache cũng không được là nơi duy nhất giữ dữ liệu đúng.
- **"Kafka hay RabbitMQ?"** Kafka khi cần log bền, replay, thông lượng cao và thứ tự theo partition. RabbitMQ khi cần hàng đợi việc, routing linh hoạt, ack từng message. Cả hai đều cần consumer idempotent.
- **"Replica lag gây lỗi gì, xử lý thế nào?"** Người dùng vừa ghi xong đọc lại không thấy (read-your-writes). Xử lý: đọc từ primary trong một khoảng ngắn sau khi ghi, hoặc định tuyến theo phiên.
- **"Chọn shard key cho dữ liệu kết quả thi thế nào?"** Theo userId nếu truy vấn chủ yếu là "kết quả của tôi", phân bố đều. Theo kỳ thi sẽ tạo hot shard lúc đang thi. Báo cáo theo trường hoặc tỉnh thì đi qua kho dữ liệu riêng thay vì truy vấn chéo shard.
- **"Rate limit đặt ở đâu?"** Ở gateway cho giới hạn chung theo IP hoặc user; trong service cho giới hạn nghiệp vụ (số lần nộp). Nhiều pod thì bộ đếm phải dùng chung, thường trên Redis.

#### Tóm tắt
- Mỗi khối có dấu hiệu dùng và đánh đổi riêng; nói cả hai.
- Cache và Redis lock giữ tốc độ; DB giữ tính đúng.
- Queue làm phẳng đỉnh nhưng buộc consumer idempotent.
- Replica trước, partition sau, shard cuối cùng.
- Rate limit cộng phòng chờ cho tải dồn theo thời điểm.

#### Bài tập
1. Hệ thống báo cáo chạy truy vấn tổng hợp nặng trên primary làm chậm API thi. Liệt kê 3 phương án theo thứ tự nên thử.
   **Đáp án:** Chuyển truy vấn sang replica; tính sẵn bằng job vào bảng tổng hợp; nếu vẫn không đủ thì kho cột riêng (xem Bài 16.4).
2. Thiết kế token bucket cho API nộp thông tin: tối đa 5 lần/phút mỗi user, cho burst 3. Ghi lại tham số N và r.
   **Đáp án:** N = 3, r = 5/60 ≈ 0,083 token/s; trạng thái (token, thời điểm nạp cuối) lưu Redis theo userId, cập nhật nguyên tử bằng Lua.

## Chương 16. Bài mẫu

Năm bài trong chương này là các đề hay gặp, chọn sát với kinh nghiệm thi trực tuyến và giáo dục. Mỗi bài đi đủ 6 bước của Bài 15.1. Mục "Liên hệ việc thật" giúp bạn nối bài thiết kế với chuyện đã làm, nhưng chỉ đúng phạm vi: lớp có sẵn thì nói là có sẵn, thiết kế chưa triển khai thì nói là đề xuất.

### Bài 16.1. Nền tảng thi trực tuyến cho 200K thí sinh đồng thời

#### Mục tiêu
- Sau bài này, bạn trình bày trọn đề thi trực tuyến 200K đồng thời trong 40 phút.
- Bạn xử lý được điểm nghẽn ở giây đầu ca thi bằng con số.
- Bạn nói được từng thành phần hỏng thì hệ thống còn đúng không.

#### Yêu cầu
- **Chức năng:** bắt đầu thi đồng loạt theo ca, lưu bài tự động, nộp bài đúng một lần, không mở được 2 phiên cùng lúc, có kết quả và xếp hạng.
- **Phi chức năng:** bắt đầu thi và nộp bài phải nhanh, không mất bài đã lưu, không ghi trùng kết quả; báo cáo được trễ.

#### Ước lượng
- Bắt đầu thi: 200K trong 2 phút ≈ 1.700 request/s; giây đầu có thể 6.000 request/s trở lên.
- Lưu bài mỗi 30 s: ≈ 6.700 lần ghi/s.
- Nộp bài: nếu 200K nộp trong 5 phút cuối: ≈ 670 request/s, kèm retry.
- Trạng thái bài làm: ≈ 200 MB trên Redis.
- Tải đề: 200 KB × 200K = 40 GB, phải qua CDN hoặc tải trước.

#### Thiết kế
```text
 Thí sinh ──> CDN (đề đã mã hóa, tải trước giờ thi)
    │
    └──> Gateway (rate limit, phòng chờ)
            │
            v
        Exam API (nhiều pod)
         │      │         │
         │      │         └── publish ──> Kafka ──> Worker chấm ──> DB kết quả
         │      │                                       │
         │      └── lưu bài ──> Redis (hash theo attempt) ──> flush định kỳ ──> DB
         │
         └── phiên thi ──> Redis (CAS theo user + vòng)
                                                        Kho dữ liệu / replica
                                                        <── job xếp hạng, báo cáo
```

- **Đề thi:** sinh trước và cache trên Redis/CDN. Request bắt đầu thi không sinh đề. Có thể cho client tải đề mã hóa từ trước, đến giờ chỉ phát khóa giải mã.
- **Phiên thi:** CAS trên Redis bằng script Lua: key rỗng hoặc đúng sessionId cũ thì đặt sessionId mới, trả 1; ngược lại trả 0.
- **Lưu bài:** ghi Redis hash theo attempt; flush xuống DB định kỳ hoặc qua Kafka.
- **Nộp bài:** idempotent bằng applock hoặc unique key (xem Bài 16.3, Bài 4.1); chấm bất đồng bộ qua Kafka.
- **Dữ liệu:** DB tách theo loại thi; replica hoặc kho dữ liệu cho tra cứu và báo cáo.
- **Xếp hạng:** tính sẵn bằng job, hoặc sorted set realtime (xem Bài 16.2).

#### API chính
- `POST /exams/{examId}/attempts` → tạo attempt, trả sessionId, khóa giải mã đề.
- `PUT /attempts/{attemptId}/answers` → lưu bài, có sessionId; sessionId không khớp thì `409`.
- `POST /attempts/{attemptId}/submit` với `Idempotency-Key` → trả kết quả tạm hoặc trạng thái "đang chấm".
- `GET /attempts/{attemptId}/result`.

#### Dữ liệu
- Attempt: (attemptId, userId, roundId, sessionId, startedAt, status). Một kết quả cho mỗi (userId, roundId).
- Bảng log đáp án ghi dồn theo ca: HEAP hoặc clustered theo identity, partition theo ca, không thêm index trong ca thi (xem Phần VI).

#### Điểm nghẽn giây đầu
- **Bắt đầu thi dồn tải:** gateway dùng token bucket và phòng chờ; client nhận vị trí hàng đợi; tải đề trước nên giờ bắt đầu chỉ là một request nhẹ.
- **Không có thao tác O(N) trên đường nóng:** không `SCAN` Redis, không sinh đề, không truy vấn tổng hợp.
- **Connection pool:** theo Little's law, mỗi ms tăng thêm ở DB nhân thành hàng trăm connection đồng thời (xem Bài 15.2).
- **Hot key:** cache đề theo mã đề; nếu 200K người đọc một key, thêm L1 memory cache trong pod.

#### Khi hỏng
- **Mất Redis:** chậm hơn, có thể cho mở 2 phiên, nhưng kết quả vẫn ghi một lần vì DB giữ tính đúng. Lưu bài ghi thẳng DB với tốc độ bị giới hạn.
- **Kafka lag:** kết quả về chậm nhưng không mất; cảnh báo theo lag.
- **DB chậm:** đẩy việc không thiết yếu ra hàng đợi, nới hạn nộp bài, tắt tính năng phụ.
- **Service phụ chậm:** circuit breaker, timeout cho lời gọi đồng bộ trên đường request.

#### Quan sát
- SLO cho API bắt đầu thi và nộp bài, viết dạng tỉ lệ request nhanh hơn ngưỡng (xem Bài 4.4).
- Dashboard theo ca thi: request/s, tỉ lệ lỗi, thời gian phản hồi, consumer lag, số người trong phòng chờ.
- Phía DB: wait THREADPOOL, WRITELOG, số connection.

#### Liên hệ việc thật
- **Phiên thi bằng Lua CAS:** đây là lớp có sẵn trong hệ thống bạn làm việc (nguồn: B3, D2.5). Nói "tôi hiểu và dùng lớp đó", không nhận là tự viết.
- **Nộp bài một lần bằng applock:** của bạn, trong sự kiện Here I Come (nguồn: mục 6).
- **Bài học đường nóng:** API bắt đầu thi thử 2,45 s do 472 lệnh `SCAN` trong một request; đồng nghiệp commit fix sau đợt audit bạn dẫn (xem Bài 24.2).
- **Finish-game qua Kafka:** có thật, consumer do đồng nghiệp viết (nguồn: B2).

#### Câu hỏi phỏng vấn
- **"Giây đầu ca thi có 6.000 request/s, bạn làm gì?"** Đưa phần nặng ra khỏi giây đầu: đề tải trước qua CDN, giờ bắt đầu chỉ phát khóa và tạo attempt. Gateway có token bucket và phòng chờ. Đường nóng không có thao tác O(N).
- **"Làm sao chặn một thí sinh mở 2 phiên?"** CAS trên Redis theo (user, vòng): script Lua so sessionId rồi đặt mới, nguyên tử. Phiên cũ gửi bài sẽ bị từ chối vì sessionId không khớp.
- **"Redis chết giữa ca thi thì sao?"** Chậm hơn và mất chặn 2 phiên tạm thời, nhưng nộp bài vẫn đúng một lần vì DB có applock hoặc unique key. Lưu bài chuyển sang ghi DB có giới hạn tốc độ.
- **"Lưu bài 6.700 lần/s ghi thẳng DB được không?"** Được nhưng tốn: mỗi lần ghi là một transaction, WRITELOG tăng. Ghi Redis rồi flush theo lô giảm số transaction; đánh đổi là cửa sổ mất dữ liệu nếu Redis mất trước khi flush.
- **"Bạn đo hệ thống này thế nào trong ngày thi?"** SLO cho bắt đầu thi và nộp bài, dashboard theo ca, consumer lag, số người trong phòng chờ, wait THREADPOOL và WRITELOG trên DB.

#### Tóm tắt
- Tính đỉnh giây đầu, không chỉ trung bình.
- Đề sinh trước, tải trước; giờ bắt đầu chỉ là request nhẹ.
- Redis cho phiên và lưu bài nhanh; DB giữ tính đúng của kết quả.
- Nộp bài idempotent, chấm bất đồng bộ.
- Mỗi thành phần hỏng phải còn đúng dữ liệu.

#### Bài tập
1. Bấm giờ 40 phút, làm lại đề này trên giấy, không nhìn bài.
   **Đáp án:** So với bài: đủ 6 bước, có con số 1.700 và 6.700, có giây đầu, có "mất Redis vẫn đúng".
2. Đổi giả định: lưu bài mỗi 10 s. Tính lại tải ghi và nêu thay đổi thiết kế.
   **Đáp án:** 20.000 lần ghi/s. Bắt buộc ghi Redis rồi flush theo lô qua Kafka; bảng log không thêm index trong ca.
3. Viết script Lua CAS cho phiên thi.
   **Đáp án:**
   ```lua
   local cur = redis.call('GET', KEYS[1])
   if (not cur) or cur == ARGV[1] then
     redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
     return 1
   end
   return 0
   ```

### Bài 16.2. Leaderboard realtime

#### Mục tiêu
- Sau bài này, bạn thiết kế được leaderboard realtime bằng Redis sorted set.
- Bạn giải thích được cách phá hòa điểm, replay an toàn và dựng lại khi mất Redis.
- Bạn nói được khi nào nên tính sẵn thay vì realtime.

#### Yêu cầu
Người chơi thấy top-N và hạng của mình gần như ngay sau khi có điểm. Bằng điểm thì ai xong sớm hơn xếp trên. Không được cộng điểm hai lần khi message bị gửi lại.

#### Ước lượng
Giả định một mùa giải có 1 triệu người chơi, đỉnh 2.000 sự kiện điểm mỗi giây, 10.000 lượt xem bảng mỗi giây.
- Bộ nhớ: mỗi member khoảng 100 byte → 1 triệu × 100 byte ≈ 100 MB cho một key.
- Ghi: 2.000 `ZADD`/s, đọc: 10.000 `ZREVRANGE`/`ZREVRANK`/s; mỗi lệnh O(log N), nằm trong khả năng một Redis instance (~100K lệnh/s).

#### Thiết kế
```text
 Game service ──> Kafka (key = matchId) ──> Consumer ──> ZADD GT leaderboard:{season}
                                                │
                                                └──> DB (điểm gốc, để dựng lại)
 Client ──> Leaderboard API ──> ZREVRANGE (top-N), ZREVRANK (hạng của tôi)
```
- **Replay an toàn:** `ZADD key GT score member` với điểm tuyệt đối, không dùng `ZINCRBY`. Message gửi lại không làm điểm tăng gấp đôi.
- **Phá hòa điểm:** `score = points × 10^10 + (10^10 − 1 − finishEpochSeconds)`. Score là double, chính xác tới khoảng 2^53 ≈ 9 × 10^15, nên điểm tối đa khoảng 900 nghìn.
- **Thứ tự:** partition theo `matchId` để giữ thứ tự trong một trận.

#### Điểm nghẽn
- **Hot key:** một key toàn quốc nằm trên một shard của Redis Cluster. Vài nghìn lệnh/s vẫn ổn; lớn hơn thì chia key theo phòng hoặc mùa, gộp top-N định kỳ.
- **Đọc top-N:** cache top-100 vài giây trong memory; hạng của từng người vẫn đọc trực tiếp.

#### Khi hỏng
- **Mất Redis:** dựng lại từ DB hoặc replay Kafka từ offset cũ; trong lúc dựng, API trả bảng cũ đã cache hoặc báo đang cập nhật.
- **Consumer lag:** bảng trễ nhưng không sai; báo lag trên dashboard.
- **Lệch với DB:** đối soát định kỳ, DB là nguồn đúng.

#### Quan sát
Độ trễ cập nhật hạng: histogram (thời điểm `ZADD` xong − timestamp sự kiện), lấy p95. Consumer lag, bộ nhớ Redis, số lệnh/s trên shard chứa key.

#### Tính sẵn hay realtime
Tính hạng trên hàng triệu bản ghi cho mỗi request là không khả thi bằng SQL. Nếu nghiệp vụ chấp nhận trễ, job tính sẵn hạng theo phạm vi rồi API chỉ đọc. Đánh đổi là bảng trễ đúng bằng chu kỳ job.

#### Liên hệ việc thật
- **Leaderboard IOM:** bạn code toàn bộ luồng Kafka → Redis sorted set → API (nguồn: C2). Số 10K người chơi đồng thời là ước lượng của bạn, chưa đo (xem Bài 5.3).
- **Bảng xếp hạng 4 phạm vi (Trường, Xã, Tỉnh, Toàn quốc):** tính sẵn bằng SQL job trong kho dữ liệu; job không phải của bạn. Top-N giới hạn 1000/700/500/300/200/100 (nguồn: B4).

#### Câu hỏi phỏng vấn
- **"Vì sao chọn sorted set?"** `ZADD`, `ZREVRANK`, `ZREVRANGE` đều O(log N) hoặc O(log N + M), dữ liệu đã sắp sẵn trong bộ nhớ, nên đọc hạng không phải tính lại.
- **"Hai người bằng điểm thì xếp thế nào?"** Mã hóa (điểm, thời gian hoàn thành) vào một score; ai xong sớm hơn có phần thời gian lớn hơn. Phải tính giới hạn điểm vì double chỉ chính xác tới 2^53.
- **"Kafka gửi trùng message thì sao?"** Dùng `ZADD GT` với điểm tuyệt đối thay vì `ZINCRBY`, hoặc dedupe theo id sự kiện.
- **"Redis mất dữ liệu thì sao?"** Dựng lại từ DB hoặc replay Kafka. DB là nguồn đúng; Redis là bản chiếu để đọc nhanh.
- **"Khi nào bạn không làm realtime?"** Khi nghiệp vụ chấp nhận trễ và dữ liệu nằm sẵn trong kho; tính sẵn rẻ hơn và đơn giản hơn.

#### Tóm tắt
- Sorted set, điểm tuyệt đối với `ZADD GT`, phá hòa bằng mã hóa vào score.
- DB là nguồn đúng; Redis dựng lại được.
- Hot key: chia theo phòng hoặc mùa.
- Tính sẵn khi chấp nhận trễ.

#### Bài tập
1. Tính score cho người được 850 điểm, hoàn thành lúc epoch 1.790.000.000.
   **Đáp án:** 850 × 10^10 + (10^10 − 1 − 1.790.000.000) = 8.500.000.000.000 + 8.209.999.999 = 8.508.209.999.999.
2. Viết lệnh lấy top 10 và hạng của user 42.
   **Đáp án:**
   ```bash
   ZREVRANGE leaderboard:s1 0 9 WITHSCORES
   ZREVRANK leaderboard:s1 user:42
   ```

### Bài 16.3. API idempotent cho nộp bài và thanh toán

#### Mục tiêu
- Sau bài này, bạn thiết kế được API idempotent bằng `Idempotency-Key`.
- Bạn xử lý được request trùng đang chạy và request trùng đã xong.
- Bạn phân biệt được idempotent write với exactly-once delivery.

#### Yêu cầu
Client có thể gửi lại request (mất mạng, timeout, bấm hai lần). Server phải cho cùng một kết quả và chỉ ghi nhận nghiệp vụ một lần.

#### Ước lượng
- Nộp bài: 200K trong 5 phút cuối ≈ 670 request/s; giả định 5% retry ≈ 33 request trùng/s.
- Kho idempotency: 200K key × ~1 KB (trạng thái + response) ≈ 200 MB, TTL 24 giờ.

#### Thiết kế
```text
 Client ── POST /submit, Idempotency-Key: K ──> API
   API: GET idem:{user}:{K}
     ├─ không có  → SET NX idem:{user}:{K} = PROCESSING (TTL) → xử lý
     │              → DB: applock theo (user, vòng) / unique key → ghi một lần
     │              → SET idem:{user}:{K} = DONE + response
     ├─ PROCESSING → trả 409 (hoặc chờ ngắn rồi đọc lại)
     └─ DONE       → trả lại response đã lưu
```
- Key gắn với user để người khác không đoán được response.
- Lưu hash của body; cùng key mà body khác thì trả `422`.
- **Lớp bảo vệ cuối ở DB:** unique constraint hoặc applock kèm `UPDLOCK, HOLDLOCK`. Kho idempotency mất thì DB vẫn chặn ghi trùng.

#### Thanh toán
- Trạng thái: PENDING → SUCCEEDED / FAILED. Tạo bản ghi PENDING trước khi gọi cổng thanh toán.
- Gửi kèm idempotency key sang cổng thanh toán nếu cổng hỗ trợ.
- Timeout không có nghĩa là thất bại: đối soát qua webhook và truy vấn trạng thái định kỳ.
- Webhook ghi vào bảng inbox, xử lý idempotent theo id sự kiện.

#### Điểm nghẽn
Lock theo key chỉ serialize các request cùng user, không khóa bảng. Lock giữ ngắn (vài giây), có TTL để process chết thì tự nhả.

#### Khi hỏng
- **Mất kho idempotency:** DB vẫn chặn ghi trùng; request lặp lại nhận bản ghi đã có thay vì lỗi.
- **Process chết khi đang PROCESSING:** TTL hết thì request sau xử lý lại; DB đảm bảo không ghi hai lần.
- **Cổng thanh toán timeout:** giữ PENDING, đối soát sau; không tự trừ tiền lần hai.

#### Quan sát
Số request trùng theo endpoint, số lần trả `409`, số bản ghi PENDING quá hạn, số cặp (user, vòng) bị trùng trong DB (phải bằng 0).

#### Liên hệ việc thật
- **Applock insert-once (Here I Come):** của bạn. `sp_getapplock` theo (user, vòng) cùng `UPDLOCK/HOLDLOCK`; request retry nhận lại bản ghi đã có. Dùng applock vì ràng buộc không tạo object DB mới trên bảng dùng chung (nguồn: mục 6, xem Bài 4.1).
- **Idempotency key 24 giờ và Redis mutex 30 s cho attempt:** lớp có sẵn do đồng nghiệp viết (nguồn: B5).
- **Callback chấm IELTS:** ghi vào bảng inbox để xử lý idempotent khi callback đến trùng (nguồn: mục 9).

#### Câu hỏi phỏng vấn
- **"Request trùng đến khi request đầu đang xử lý thì sao?"** Request đầu đã đặt trạng thái PROCESSING bằng `SET NX`. Request sau thấy PROCESSING thì trả `409` hoặc chờ ngắn rồi đọc lại response.
- **"Đây có phải exactly-once không?"** Không. Request có thể đến nhiều lần (at-least-once); ghi nhận nghiệp vụ chỉ xảy ra một lần nhờ khóa theo key nghiệp vụ.
- **"Có kho idempotency rồi sao vẫn cần unique constraint?"** Kho có TTL và có thể mất. Unique constraint hoặc applock ở DB là lớp đảm bảo cuối cùng.
- **"Sao không dùng unique index cho nộp bài?"** Nếu được sửa schema thì unique index là cách tốt nhất. Ở sự kiện thật, ràng buộc là không tạo object mới trên bảng dùng chung, nên dùng applock: chỉ serialize theo từng key.
- **"Thanh toán timeout thì bạn làm gì?"** Không coi là thất bại. Giữ PENDING, đối soát qua webhook và truy vấn trạng thái; mọi lần gọi lại cổng đều mang cùng idempotency key.

#### Tóm tắt
- `Idempotency-Key` gắn với user, lưu trạng thái và response có TTL.
- PROCESSING → `409`; DONE → trả lại response cũ; body khác → `422`.
- DB là lớp bảo vệ cuối.
- Idempotent write, không phải exactly-once delivery.

#### Bài tập
1. Viết luồng xử lý webhook thanh toán đến trùng 3 lần.
   **Đáp án:** Insert vào inbox với unique trên eventId; trùng thì bỏ qua và trả 200. Xử lý cập nhật PENDING → SUCCEEDED trong transaction chỉ khi trạng thái hiện tại là PENDING.
2. Viết câu SQL đếm số cặp (user, vòng) bị trùng theo ngày.
   **Đáp án:**
   ```sql
   SELECT CAST(CreatedAt AS date) AS d, COUNT(*) AS dup_pairs
   FROM (SELECT UserId, RoundId, MIN(CreatedAt) AS CreatedAt
         FROM dbo.Result GROUP BY UserId, RoundId HAVING COUNT(*) > 1) x
   GROUP BY CAST(CreatedAt AS date);
   ```

### Bài 16.4. Pipeline báo cáo gần realtime

#### Mục tiêu
- Sau bài này, bạn thiết kế được pipeline báo cáo với độ tươi dữ liệu vài phút.
- Bạn so sánh được các phương án từ rẻ đến đắt trước khi chọn CDC.
- Bạn nêu được rủi ro vận hành của CDC trên SQL Server.

#### Yêu cầu
Dashboard quản lý (Sở, trường) xem kết quả thi gần realtime, mục tiêu dữ liệu trễ dưới vài phút, truy vấn tổng hợp không làm chậm DB nghiệp vụ.

#### Ước lượng
Giả định 5 triệu bản ghi kết quả mỗi ngày, đỉnh gấp 20 lần trung bình.
- Trung bình 5.000.000 / 86.400 ≈ 58 bản ghi/s; đỉnh ≈ 1.200/s.
- 200 byte mỗi bản ghi → 1 GB/ngày dữ liệu thô; kho cột nén 5–10 lần → 100–200 MB/ngày.

#### Các phương án theo thứ tự nên thử
1. Tăng tần suất job tổng hợp hiện có.
2. Columnstore index trên SQL Server (Standard Edition có từ 2016 SP1, giới hạn bộ nhớ columnstore và độ song song).
3. Đọc báo cáo từ replica.
4. CDC → Kafka → kho cột (ClickHouse), khi dữ liệu và số dashboard vượt khả năng SQL Server.

#### Thiết kế (phương án 4)
```text
 SQL Server (CDC bật trên bảng nguồn)
    │ capture job đọc transaction log
    v
 Debezium (Kafka Connect) ──> Kafka (mỗi bảng một topic)
                                  │
                                  v
 ClickHouse: bảng Kafka engine ──> materialized view ──> ReplacingMergeTree (version = LSN)
                                  │
                                  v
                           Dashboard API
```
- Ngữ nghĩa at-least-once. `ReplacingMergeTree` chỉ khử trùng khi merge, nên truy vấn cần chính xác dùng `FINAL` hoặc `argMax`.
- Dòng bị xóa: Debezium phát sự kiện delete; phía ClickHouse dùng cột `is_deleted` và lọc khi truy vấn.
- Độ tươi = thời điểm ghi vào ClickHouse − thời điểm commit ở nguồn.

#### Điểm nghẽn và khi hỏng
- **Capture job dừng:** transaction log không truncate được (`log_reuse_wait_desc = REPLICATION`), ổ đĩa đầy. Phải alert theo kích thước log.
- **Snapshot ban đầu bảng lớn (hàng trăm triệu dòng):** incremental snapshot của Debezium, chạy ngoài giờ cao điểm.
- **Đổi schema bảng nguồn:** cần quy trình riêng cho CDC và topic.
- **Kafka Connect hoặc ClickHouse chết:** dashboard trễ, dữ liệu không mất vì Kafka giữ lại; hệ nghiệp vụ không bị ảnh hưởng.

#### Quan sát
Độ tươi dữ liệu theo bảng, consumer lag, kích thước transaction log và `log_reuse_wait_desc` ở nguồn, số dòng đối soát nguồn và đích theo ngày.

#### Liên hệ việc thật
- **Thật:** warehouse báo cáo B2B dùng SQL Server Agent job mỗi 60 phút, 7 bảng tổng hợp, nạp incremental theo high-water mark (lô 50 nghìn dòng, tối đa 40 lô). Độ trễ tối đa khoảng 1 giờ. Production mới có một Sở đối tác (nguồn: mục 7).
- **Chưa triển khai:** pipeline CDC → Kafka → ClickHouse là thiết kế đề xuất, không phải việc đã làm (xem Bài 5.1).

#### Câu hỏi phỏng vấn
- **"Sao không dùng columnstore cho đơn giản?"** Nên thử trước. Nếu đạt mục tiêu thì không cần thêm hạ tầng. ClickHouse chỉ đáng khi dữ liệu và số dashboard vượt khả năng SQL Server.
- **"CDC ảnh hưởng gì tới DB nguồn?"** Tăng tải transaction log; nếu capture job dừng, log không truncate được và có thể đầy ổ đĩa.
- **"Dữ liệu trùng trong ClickHouse xử lý thế nào?"** `ReplacingMergeTree` theo version (LSN), khử trùng khi merge; truy vấn cần chính xác dùng `FINAL` hoặc `argMax`.
- **"Độ tươi dữ liệu đo thế nào?"** Lấy hiệu thời điểm ghi vào ClickHouse và thời điểm commit ở nguồn, đo theo bảng, đặt SLO cho nó.

#### Tóm tắt
- Thử rẻ trước: tăng tần suất job, columnstore, replica.
- CDC → Kafka → ClickHouse cho độ tươi vài phút và tải phân tích lớn.
- At-least-once, khử trùng bằng version.
- Rủi ro lớn nhất là log nguồn không truncate được.

#### Bài tập
1. Viết truy vấn ClickHouse lấy điểm mới nhất của mỗi bài thi khi bảng còn bản ghi trùng.
   **Đáp án:**
   ```sql
   SELECT attempt_id, argMax(score, lsn) AS score
   FROM results
   GROUP BY attempt_id
   HAVING argMax(is_deleted, lsn) = 0;
   ```
2. Liệt kê 3 metric cần alert cho pipeline này.
   **Đáp án:** Độ tươi dữ liệu vượt ngưỡng; consumer lag tăng liên tục; kích thước transaction log nguồn tăng bất thường.

### Bài 16.5. SSO cho nhiều sản phẩm

#### Mục tiêu
- Sau bài này, bạn thiết kế được SSO cho nhiều web app bằng OIDC, PKCE và BFF.
- Bạn giải thích được silent SSO khi trình duyệt chặn cookie bên thứ ba.
- Bạn nói được logout toàn bộ và đồng bộ giữa các tab.

#### Yêu cầu
Một tài khoản đăng nhập dùng cho nhiều sản phẩm; vào sản phẩm thứ hai không phải đăng nhập lại; logout một nơi thì các nơi khác cũng thoát; token không lộ ra JavaScript nếu tránh được.

#### Ước lượng
Giả định 200K người đăng nhập trong 10 phút trước ca thi: ≈ 333 lần đăng nhập/s, mỗi lần 4–6 request redirect và đổi token. Phiên phía server 2 KB × 200K ≈ 400 MB trên Redis. API kiểm JWT cục bộ bằng khóa từ JWKS đã cache, nên không gọi identity server cho mỗi request.

#### Thiết kế
```text
 Trình duyệt ──cookie HttpOnly──> BFF (ASP.NET Core, YARP)
                                   │  ticket phiên trên Redis
                                   │  data protection keys trên Redis
                                   ├──> Identity server (OIDC, code + PKCE)
                                   └──> API sản phẩm (access token gắn ở BFF)
 App khác ──redirect cả trang, skip_login──> Identity server ──(phiên SSO còn)──> code
```
- **Authorization Code + PKCE:** client sinh `code_verifier`, gửi `code_challenge = BASE64URL(SHA256(code_verifier))`; đổi code phải gửi lại verifier. Code dùng một lần, sống ngắn.
- **BFF:** token nằm ở server; trình duyệt giữ cookie `HttpOnly`, `SameSite=Lax`; bật antiforgery.
- **Silent SSO:** redirect cả trang thay vì iframe vì cookie bên thứ ba bị chặn; cooldown sau logout và cờ pending chống vòng lặp redirect.
- **Đồng bộ tab:** `BroadcastChannel`.
- **Logout toàn bộ:** xóa phiên trên Redis, thu hồi refresh token, front-channel hoặc back-channel logout của OIDC.

#### Điểm nghẽn và khi hỏng
- **Identity server chậm lúc đỉnh:** người đã có phiên vẫn dùng được vì API kiểm JWT cục bộ; chỉ đăng nhập mới bị chậm.
- **Mất Redis của BFF:** mất phiên, người dùng phải đăng nhập lại; không lộ dữ liệu.
- **Xoay khóa ký:** JWKS cache theo `kid`, tải lại khi gặp `kid` lạ.

#### Quan sát
Tỉ lệ đăng nhập thành công, số vòng lặp redirect bị chặn, thời gian đổi token, số ticket hỗ trợ về đăng nhập theo tuần.

#### Liên hệ việc thật
Lõi BFF (PKCE, ticket store trên Redis) có sẵn khi bạn vào. Phần của bạn: hardening BFF (CORS theo allow-list, cookie, chuyển endpoint token sang POST, cờ Turnstile) và SSO phía client cho IOE web và IOSTEM. "4 sản phẩm" và số ticket giảm là minh họa (nguồn: mục 10, B6; xem Bài 5.2).

#### Câu hỏi phỏng vấn
- **"Vì sao dùng PKCE mà không dùng client secret?"** SPA là public client, không giữ được secret. PKCE làm cho kẻ chặn được code cũng không đổi được token.
- **"Vì sao lưu ticket trên server thay vì JWT trong cookie?"** Thu hồi được phiên ngay, cookie nhỏ, không lộ claim ra client.
- **"Silent SSO làm thế nào khi cookie bên thứ ba bị chặn?"** Redirect cả trang tới identity server với `skip_login`; còn phiên thì nhận code, hết phiên thì quay về trạng thái chưa đăng nhập. Có cooldown sau logout và cờ chống vòng lặp.
- **"`SameSite=Lax` đủ chống CSRF chưa?"** Chặn được POST từ site khác, nhưng GET có tác dụng phụ vẫn nguy hiểm, nên bật thêm antiforgery token.
- **"Logout một app thì các app khác thế nào?"** Xóa phiên trên Redis, thu hồi refresh token, dùng front-channel hoặc back-channel logout; trong cùng trình duyệt thì `BroadcastChannel` báo các tab.

#### Tóm tắt
- OIDC Authorization Code + PKCE; BFF giữ token ở server.
- Cookie `HttpOnly`, `SameSite=Lax`, antiforgery; data protection keys dùng chung giữa các pod.
- Silent SSO bằng redirect cả trang, không dùng iframe.
- Logout toàn bộ: xóa phiên, thu hồi token, báo các app.

#### Bài tập
1. Viết các bước kiểm một JWT ở API.
   **Đáp án:** Chọn khóa theo `kid` từ JWKS đã cache; cố định thuật toán (chặn `alg: none`, chặn nhầm RS256/HS256); kiểm chữ ký; kiểm `iss`, `aud`, `exp`, `nbf` với độ lệch giờ nhỏ.
2. Vì sao data protection keys phải dùng chung giữa các pod của BFF?
   **Đáp án:** Pod A mã hóa cookie thì pod B cũng phải giải mã được; nếu mỗi pod một khóa, người dùng bị đăng xuất khi request rơi vào pod khác.
