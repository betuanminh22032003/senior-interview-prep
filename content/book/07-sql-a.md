# Phần VI. Tối ưu SQL Server

Phần này dạy tối ưu SQL Server theo đúng thứ tự một người làm hiệu năng thực tế đi qua: đo để biết chậm ở đâu, đọc plan để hiểu vì sao chậm, rồi mới sửa bằng index, cách viết truy vấn hay cấu hình. Ví dụ lấy từ đợt rà soát hiệu năng hệ thống thi tiếng Anh trực tuyến IOE mà bạn đã làm: sáu cụm SQL Server chia theo vai trò (log luyện tập và thi thử, dữ liệu lõi về người dùng và trường học, log thi chính thức, kho dữ liệu báo cáo, đăng ký thi, ngân hàng câu hỏi và sinh đề). Bạn là người phân tích, xếp hạng điểm nóng và đề xuất cách sửa. Phần sửa do nhiều người làm: có việc bạn tự sửa, có việc đồng nghiệp hay DBA làm, có việc mới dừng ở đề xuất. Mỗi bài nói rõ điều đó để bạn kể đúng phần của mình.

Chương 17–19 là phần lõi: đo trước khi sửa, index, viết truy vấn để optimizer hiểu. Nắm chắc ba chương này là đủ tự xử lý phần lớn vấn đề hiệu năng hay gặp. Các chương sau (từ Chương 20) đi tiếp sang cấu hình server, tầng ứng dụng, cách phản biện một báo cáo hiệu năng và các chủ đề mở rộng.

**Tài liệu nên đọc:** Microsoft Learn: *Query processing architecture guide*, *Index architecture and design guide*, *Statistics*; Grant Fritchey, *SQL Server Execution Plans* (ebook miễn phí của Redgate); Itzik Ben-Gan, *T-SQL Querying*; blog của Paul White, Erik Darling, Brent Ozar.

**Công cụ:** First Responder Kit (`sp_Blitz`, `sp_BlitzCache`, `sp_BlitzIndex`, `sp_BlitzFirst`), `sp_WhoIsActive`, Query Store, Plan Explorer, Ola Hallengren Maintenance Solution.

## Chương 17. Đo trước khi sửa

Câu mở màn quen thuộc nhất của vòng phỏng vấn hiệu năng là "Hệ thống chậm, anh bắt đầu từ đâu?". Người hỏi không chờ một mẹo; họ muốn nghe một quy trình: biết thời gian nằm ở đâu, chọn chỗ sửa theo tổng tải, hiểu server đang chờ gì, đọc plan để biết vì sao, rồi đo lại bằng đúng thước đo cũ. Người chỉ biết "thêm index" sẽ lộ ngay ở câu hỏi này.

Chương đi theo đúng chuỗi đó: dựng phòng lab dùng cho cả Phần VI, đọc trace APM, dùng DMV và Query Store tìm truy vấn tốn nhất, đọc wait stats, đọc execution plan.

### Bài 17.1. Quy trình tối ưu và phòng lab dùng chung

#### Kiến thức

##### Sáu bước, theo đúng thứ tự

1. **Chốt triệu chứng bằng số.** API nào chậm, p95 bao nhiêu, vào giờ nào, từ khi nào. "Hệ thống chậm" chưa phải triệu chứng.
2. **Đọc trace APM.** Thời gian của request nằm ở SQL, cache, gọi service khác hay chính code? Nhiều khi thủ phạm không phải database.
3. **DMV và Query Store.** Proc hay câu lệnh nào tốn nhất theo *tổng* tải (chi phí mỗi lần × số lần chạy).
4. **Wait stats.** Server đang thiếu gì: CPU, I/O, khoá, bộ nhớ, worker.
5. **Execution plan.** Vì sao câu đó tốn: scan, lookup, sort, ước lượng lệch.
6. **Sửa nhỏ nhất đúng gốc, rồi đo lại** bằng cùng thước đo, cùng loại request, cùng khung giờ.

Thứ tự quan trọng vì mỗi bước thu hẹp phạm vi cho bước sau. Nhảy thẳng vào bước 6 là sửa theo cảm giác: thêm index cho câu chậm nhất trong khi tải thật nằm ở một câu rẻ chạy hàng chục triệu lần.

##### Thước đo nào cho việc gì

| Thước đo | Lấy ở đâu | Dùng để |
|---|---|---|
| Latency p95/p99 của API | APM | Báo cáo trải nghiệm người dùng |
| Logical reads | `SET STATISTICS IO`, DMV, Query Store | So hai plan với nhau, ổn định giữa các lần chạy |
| CPU time, elapsed time | DMV, Query Store | Tải server phải gánh |
| `execution_count` theo thời gian | DMV, Query Store | Phát hiện gọi lặp, cache hỏng |
| Wait theo loại | `sys.dm_os_wait_stats` (lấy chênh lệch) | Biết tài nguyên nào đang thiếu |

> **Ghi nhớ:** Đo trước khi sửa và ghi lại số đo trước. `ALTER PROCEDURE` xoá số liệu của proc trong plan cache; không ghi trước thì mất mốc để so.

##### Phòng lab LabPerf

Mọi bài tập trong Phần VI chạy trên SQL Server 2019/2022 Developer Edition (miễn phí, đủ tính năng Enterprise). Script dưới tạo database `LabPerf` với ba bảng: `School` (20.001 trường), `Student` (1 triệu học sinh, phân bố cố ý lệch: trường số 1 có 200.000 em, mỗi trường còn lại 40 em), `ExamResult` (2 triệu bài thi, mỗi học sinh 2 bài). Phân bố lệch là để tái hiện parameter sniffing và ước lượng sai ở Chương 19. Chạy khoảng 1 phút, chiếm vài trăm MB. Số `logical reads` nêu trong các bài là xấp xỉ; máy bạn có thể lệch vài phần trăm.

```sql
CREATE DATABASE LabPerf;
GO
ALTER DATABASE LabPerf SET RECOVERY SIMPLE;
ALTER DATABASE LabPerf SET COMPATIBILITY_LEVEL = 160;  -- SQL Server 2022; dùng 150 nếu là 2019
GO
USE LabPerf;
GO
CREATE TABLE dbo.School (
    SchoolId   INT           NOT NULL CONSTRAINT PK_School PRIMARY KEY,
    ProvinceId SMALLINT      NOT NULL,
    DistrictId INT           NOT NULL,
    SchoolName NVARCHAR(200) NOT NULL
);
CREATE TABLE dbo.Student (
    StudentId  INT           NOT NULL CONSTRAINT PK_Student PRIMARY KEY,
    ProvinceId SMALLINT      NOT NULL,
    DistrictId INT           NOT NULL,
    SchoolId   INT           NOT NULL,
    Grade      TINYINT       NOT NULL,
    FullName   NVARCHAR(100) NOT NULL,
    Phone      VARCHAR(20)   NULL,
    CreatedAt  DATETIME2(0)  NOT NULL,
    Status     TINYINT       NOT NULL
);
CREATE TABLE dbo.ExamResult (
    ResultId    BIGINT IDENTITY NOT NULL CONSTRAINT PK_ExamResult PRIMARY KEY,
    StudentId   INT          NOT NULL,
    RoundId     INT          NOT NULL,
    Score       INT          NOT NULL,
    SubmittedAt DATETIME2(0) NOT NULL
);
GO
WITH n AS (
    SELECT TOP (20001) CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS INT) AS i
    FROM sys.all_columns a CROSS JOIN sys.all_columns b
)
INSERT dbo.School (SchoolId, ProvinceId, DistrictId, SchoolName)
SELECT i, CASE WHEN i = 1 THEN 1 ELSE 1 + i % 63 END, i / 10 + 1, CONCAT(N'Trường ', i)
FROM n;

WITH n AS (
    SELECT TOP (1000000) CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS INT) AS i
    FROM sys.all_columns a CROSS JOIN sys.all_columns b
), s AS (
    SELECT i, CASE WHEN i <= 200000 THEN 1 ELSE 2 + i % 20000 END AS SchoolId FROM n
)
INSERT dbo.Student WITH (TABLOCK)
       (StudentId, ProvinceId, DistrictId, SchoolId, Grade, FullName, Phone, CreatedAt, Status)
SELECT s.i, sc.ProvinceId, sc.DistrictId, s.SchoolId,
       1 + s.i % 12,
       CONCAT(N'Học sinh ', s.i),
       CONCAT('09', RIGHT(CONCAT('0000000', s.i), 8)),
       DATEADD(MINUTE, s.i, '2024-01-01'),
       CASE WHEN s.i % 50 = 0 THEN 0 ELSE 1 END
FROM s JOIN dbo.School sc ON sc.SchoolId = s.SchoolId;

WITH n AS (
    SELECT TOP (2000000) CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS INT) AS i
    FROM sys.all_columns a CROSS JOIN sys.all_columns b
)
INSERT dbo.ExamResult WITH (TABLOCK) (StudentId, RoundId, Score, SubmittedAt)
SELECT 1 + CAST((CAST(i AS BIGINT) * 7919) % 1000000 AS INT),
       1 + i % 10, (i * 37) % 301, DATEADD(SECOND, i * 15, '2025-01-01')
FROM n;
GO
CHECKPOINT;
```

> **Mẹo:** Lab chỉ có bảng gốc và khoá chính. Mỗi bài tự tạo index mình cần; xoá index của bài trước nếu đề bài nói "chưa có index phụ", để số đo khớp.

#### Cách show off

Đây là câu trả lời khung cho mọi câu hỏi "hệ thống chậm thì làm gì". Kể bằng một đợt việc thật, đi đủ các bước, và nói rõ phần nào là của bạn.

> **Ví dụ:** "Hệ thống tôi làm là nền tảng thi tiếng Anh trực tuyến cho học sinh cả nước, giờ cao điểm rất nhiều em vào thi cùng lúc. Khi được giao rà soát hiệu năng, tôi không bắt đầu bằng việc thêm index. Tôi lọc các API chậm trên APM, mở trace xem thời gian nằm ở span nào, rồi từ span SQL lần xuống DMV để biết proc đó chạy bao nhiêu lần, tốn bao nhiêu CPU, plan ra sao. Đầu ra là một danh sách điểm nóng xếp theo tổng tải, mỗi mục có nguyên nhân và cách sửa, chia cho dev và DBA. Ca đáng nhớ nhất lại không nằm ở database: API bắt đầu thi thử mất hơn 2 giây vì một hàm làm mới cache quét toàn bộ Redis bằng hàng trăm lệnh `SCAN`, nằm ngay trên đường đi của request. Đồng nghiệp sửa theo phân tích đó, trace sau khi deploy còn khoảng 55 ms. Bài học của tôi là phải đo trước, vì chỗ cần sửa nhiều khi không phải chỗ mình đoán."

Điểm ăn điểm:
- Nói "xếp theo tổng tải" chứ không phải "tìm câu chậm nhất". Đó là dấu hiệu bạn nghĩ ở mức hệ thống.
- Nhắc ràng buộc vận hành: server chạy Standard Edition nên tạo index là khoá bảng; vì vậy kế hoạch tách hai tầng, sửa proc trong ngày, index để DBA chạy ca đêm.
- Nói cách đo lại: cùng API, cùng khung giờ, cùng thước đo, ghi số trước khi `ALTER`.
- Phân vai rõ ràng: phân tích và đề xuất là của bạn, commit nào của ai thì nói đúng người đó. Người phỏng vấn tin bạn hơn khi bạn không nhận hết.

#### Câu hỏi vặn

- **"Hệ thống chậm, anh bắt đầu từ đâu?"** Tôi chốt triệu chứng bằng số trước: API nào, p95 bao nhiêu, giờ nào. Sau đó đọc trace để biết thời gian nằm ở SQL, cache hay gọi ngoài, rồi xuống DMV tìm câu tốn nhất theo tổng tải, xem wait để biết server thiếu gì, đọc plan để biết vì sao. Chỉ sau đó mới chọn cách sửa và đo lại bằng cùng thước đo.
- **"Sao không bật SQL Profiler lên xem cho nhanh?"** Profiler và SQL Trace đã deprecated và khá nặng trên server đang tải cao. Tôi dùng DMV và Query Store vì có sẵn, gần như không tốn thêm; cần bắt sự kiện chi tiết thì dùng Extended Events với bộ lọc hẹp. APM cho góc nhìn từ phía request mà công cụ phía DB không có.
- **"Báo cáo đó anh làm một mình hay cả team? Phần nào là của anh?"** Phân tích, xếp hạng điểm nóng và đề xuất cách sửa là của tôi. Việc sửa chia cho nhiều người: một số fix tôi tự commit, một số do đồng nghiệp làm theo phân tích, phần index giao DBA chạy ca đêm. Tôi kể theo đúng vai đó.
- **"Làm sao chắc cải thiện là do anh sửa, không phải do hôm đó ít người dùng?"** So cùng API, cùng khung giờ, nhiều ngày trước và sau, kèm throughput để thấy tải tương đương. Ở phía DB, nhìn chi phí mỗi lần chạy (reads, CPU trung bình) chứ không chỉ tổng, vì tổng phụ thuộc lượng request.
- **"Lab 1 triệu dòng thì nói lên được gì về production?"** Hình dạng plan và logical reads co giãn theo kích thước khá đúng, nên lab đủ để hiểu cơ chế và so phương án. Lab không tái hiện được tải đồng thời và phân bố dữ liệu thật, nên kết luận cuối cùng phải kiểm tra bằng plan và Query Store trên production.

#### Bẫy cần tránh

- Mở đầu bằng "tôi thêm index". Nghe như sửa theo cảm giác. Mở đầu bằng cách bạn tìm ra chỗ cần sửa.
- Đọc chuỗi con số liền mạch. Chọn một con số, nói nó đo cái gì, bằng công cụ gì, so với lúc nào.
- Nhận commit của người khác là của mình. Nói "tôi tìm ra nguyên nhân và đề xuất, đồng nghiệp sửa" vẫn là điểm cộng.
- Nói như thể mọi đề xuất đã chạy xong. Việc nào chưa xác nhận thì nói là đề xuất.

#### Nhớ nhanh

- Triệu chứng bằng số → trace → DMV/Query Store → wait → plan → sửa → đo lại.
- Ưu tiên theo tổng tải, không theo câu chậm nhất.
- Logical reads để so plan; p95 để báo cáo trải nghiệm.
- Ghi số trước khi `ALTER`; đo lại cùng khung giờ.
- Kể đúng vai: phân tích và đề xuất là của bạn.

#### Bài tập

1. Chạy script tạo `LabPerf`, rồi kiểm tra phân bố: số học sinh của trường 1, của trường 500, và số trường có đúng 40 học sinh.
   **Đáp án:** `SELECT SchoolId, COUNT(*) FROM dbo.Student WHERE SchoolId IN (1, 500) GROUP BY SchoolId;` cho 200.000 và 40. Đếm trường có đúng 40 em: `SELECT COUNT(*) FROM (SELECT SchoolId FROM dbo.Student GROUP BY SchoolId HAVING COUNT(*) = 40) x;` ra 20.000. Đây là độ lệch mà Chương 19 dùng để tái hiện sniffing.
2. Ghi mốc ban đầu: số trang và số dòng của từng bảng.
   **Đáp án:** `SELECT OBJECT_NAME(object_id) AS t, SUM(used_page_count) AS pages, SUM(CASE WHEN index_id IN (0,1) THEN row_count END) AS row_cnt FROM sys.dm_db_partition_stats GROUP BY object_id;`. `Student` khoảng 9.500–10.000 trang; số này dùng để ước lượng chi phí scan trong các bài sau.

### Bài 17.2. Đọc trace APM: N+1, gọi lặp, việc đồng bộ thừa
**Viz:** request-timeline

#### Kiến thức

##### Trace và span

APM (Elastic APM, OpenTelemetry) ghi mỗi request thành một *transaction* (hay *trace*), bên trong là cây *span*: mỗi lần gọi SQL, Redis, HTTP, gRPC là một span có thời điểm bắt đầu và độ dài. Thời gian request bằng tổng các span chạy tuần tự cộng phần CPU của chính app (self time). Span chạy song song (`Task.WhenAll`) chồng lên nhau trên trục thời gian, nên tổng độ dài span có thể lớn hơn thời gian request. Dùng mô phỏng ở trên để thấy timeline thay đổi khi gom lời gọi và đẩy việc ra nền.

##### N+1 có hai dạng

Một câu lấy danh sách, rồi với mỗi phần tử lại gọi thêm một câu. Trên trace, dấu hiệu là cùng một proc lặp lại nhiều lần trong một request. Hai dạng có cách sửa khác nhau:

| Dạng | Dấu hiệu | Gốc rễ | Cách sửa |
|---|---|---|---|
| Cùng tham số | Vài span cùng proc, cùng `userId` | Mỗi hàm con tự đọc lại DB | Đọc một lần, truyền object xuống (cache trong phạm vi request) |
| Khác tham số | Hàng chục span cùng proc, tham số là Id của từng dòng | Vòng lặp gọi DB | Một truy vấn theo tập: `IN (...)`, TVP, `JOIN` |

##### Vì sao nhiều lời gọi nhỏ vẫn đắt

Câu lệnh chạy 1 ms trong SQL Server vẫn kéo theo một round-trip mạng, mượn và trả kết nối từ pool, tra plan cache, gửi tham số, đọc kết quả. Phía DB, mỗi lần chạy là một lần chiếm worker, lấy khoá, ghi thống kê. Năm lần gọi 15 ms tệ ngang một câu 75 ms về latency, và tệ hơn về tải vì chiếm kết nối và worker năm lần. Vì vậy ưu tiên sửa theo `chi phí mỗi lần × số lần gọi`: một proc chỉ tốn 0,1 ms nhưng chạy hàng trăm triệu lần vẫn là tải lớn.

##### Việc đồng bộ thừa

Việc không ảnh hưởng tới response (bắn event, ghi lịch sử, upload log) không nên nằm trên đường đi của request. Cẩn thận với cơ chế `async` của .NET: phương thức `async` chạy **đồng bộ** trên thread gọi nó cho tới `await` đầu tiên chưa hoàn tất. Viết `_ = SendAsync()` không đẩy phần đầu đó ra nền; nếu phần đầu tạo `GrpcChannel` mới (mở socket, bắt tay HTTP/2), request vẫn phải chờ.

```csharp
// Trước: mỗi bước kiểm tra tự đọc lại vị trí người dùng
await CheckRegionAsync(userId);
await CheckGradeAsync(userId);
await CheckSchoolAsync(userId);

// Sau: đọc một lần, truyền object xuống
var loc = await _userRepo.GetLocationAsync(userId);
CheckRegion(loc); CheckGrade(loc, dto); CheckSchool(loc);

// Trước: mỗi mã dịch vụ một lần gọi DB
foreach (var code in serviceCodes)
    rounds.Add(await _repo.GetRoundAsync(userId, code));

// Sau: một lần lấy mọi dòng của user, lọc trong bộ nhớ
var all = await _repo.GetRoundsByUserAsync(userId);
var rounds2 = all.Where(r => serviceCodes.Contains(r.ServiceCode)).ToList();

// Event: channel dùng chung (singleton), gửi hẳn ra nền
_ = Task.Run(async () =>
{
    try { await _eventClient.PushAsync(evt); }
    catch (Exception ex) { _logger.LogWarning(ex, "Push event failed"); }
});
```

> **Cảnh báo:** Gom lô xong phải kiểm tra proc mới trả đủ dòng cho mọi phần tử. Proc cũ chỉ trả một dòng theo một mã; gọi một lần mà không đổi proc sẽ thiếu dữ liệu.

#### Cách show off

Chất liệu thật từ đợt rà soát:
- API cập nhật thông tin học sinh: trace cho thấy proc lấy vị trí người dùng bị gọi năm lần cho cùng một user, proc kiểm tra điều kiện thi cũng vậy, thêm một vòng lặp theo mã dịch vụ gọi DB mỗi mã một lần. Báo cáo đề xuất đọc một lần rồi truyền xuống. [điền: phần bỏ gọi lặp đã triển khai chưa, ai làm]
- Cũng API đó, mỗi lần bắn event lại tạo `GrpcChannel` mới, giữ luồng request khoảng 9 ms dù code đã viết `_ = ...`. Phần này bạn tự sửa: dùng chung channel, đẩy việc gửi vào `Task.Run`, và cố ý không đặt deadline.
- Luồng bảng xếp hạng: với mỗi dòng trong top lại gọi tra tên tỉnh, huyện, thành vài chục tới cả trăm lượt gọi DB mỗi request.

> **Ví dụ:** "Ở API cập nhật thông tin học sinh, câu SQL nào cũng nhanh nhưng request vẫn chậm, nên tôi mở trace ra đếm span. Cùng một proc lấy vị trí người dùng xuất hiện năm lần với cùng tham số, nghĩa là mỗi bước kiểm tra tự đọc lại DB; cách sửa là đọc một lần rồi truyền xuống. Có một chi tiết thú vị hơn: đoạn gửi event đã viết kiểu fire-and-forget mà vẫn giữ request khoảng 9 ms. Nguyên nhân là phương thức async chạy đồng bộ tới await đầu tiên, và đoạn đó tạo GrpcChannel mới mỗi lần. Tôi chuyển sang một channel dùng chung và đẩy hẳn việc gửi ra nền. Tôi cố ý không đặt deadline, vì service nhận event có lúc chậm vài giây, đặt deadline là làm rơi event, tức đổi hành vi nghiệp vụ."

Điểm ăn điểm:
- Phân biệt hai dạng N+1 và hai cách sửa, không gộp chung là "thêm cache".
- Giải thích được vì sao `_ = SendAsync()` vẫn chặn. Rất ít người nói ra cơ chế này.
- Nêu quyết định không đặt deadline kèm lý do nghiệp vụ: cho thấy bạn cân nhắc hậu quả chứ không áp best practice máy móc.
- Không nhận số cải thiện chưa đo: báo cáo chỉ đặt mục tiêu, chưa có trace sau khi sửa.

#### Câu hỏi vặn

- **"API A có một câu SQL 80 ms. API B gọi một câu 2 ms 40 lần. Sửa cái nào trước?"** Latency hai bên ngang nhau, nhưng B tốn 40 round-trip, 40 lần mượn kết nối, 40 lần chiếm worker trên DB. Tôi xếp theo tổng tải của cả API nhân số request mỗi giây. Với B, gom lô hoặc cache thường rẻ và hiệu quả hơn tối ưu câu 80 ms của A.
- **"Nhìn trace, làm sao biết có N+1?"** Cùng một proc lặp lại nhiều lần trong một transaction. Tham số giống nhau thì thiếu cache trong request; tham số đổi theo từng dòng của kết quả trước thì thiếu truy vấn theo lô.
- **"Đã viết `_ = SendEventAsync()` mà request vẫn bị giữ. Vì sao?"** Phương thức async chạy đồng bộ trên thread gọi cho tới await đầu tiên chưa hoàn tất. Phần tạo channel, mở kết nối nằm trước await đó nên request vẫn chờ. Sửa bằng channel dùng chung và đẩy việc gửi ra nền.
- **"Sao không đặt deadline cho lời gọi gRPC gửi event?"** Service nhận có lúc chậm vài giây; deadline ngắn sẽ huỷ lời gọi và làm mất event, tức thay đổi nghiệp vụ. Lời gọi đã chạy nền nên không còn giữ request. Nếu bị hỏi tiếp: rủi ro là task nền dồn lại khi service nhận chậm kéo dài; bước tiếp theo nên là hàng đợi có giới hạn (`Channel<T>` bounded) với metric độ dài hàng đợi.
- **"Fire-and-forget có rủi ro gì, khi nào không được dùng?"** Mất việc khi process chết hoặc deploy giữa chừng, lỗi không quay về caller, khó retry. Việc có nghĩa vụ nghiệp vụ như trừ tiền, cấp quà thì ghi vào hàng đợi bền (outbox, message broker) rồi xử lý bất đồng bộ.
- **"Sau khi sửa, API đó nhanh lên bao nhiêu?"** Báo cáo đặt mục tiêu cho phần kiểm tra logic, nhưng tôi chưa có trace đo lại sau khi sửa nên không khẳng định đã đạt. Cách đo sẽ là so số span và thời gian trên APM cùng API, cùng khung giờ, trước và sau, kèm tốc độ tăng `execution_count` của proc bị gọi lặp.

#### Bẫy cần tránh

- Gom lô mà không kiểm tra proc cũ chỉ trả một dòng: thiếu dữ liệu, lỗi nghiệp vụ âm thầm.
- Biến cache trong request thành biến `static`: thành cache dùng chung không có invalidation.
- Dùng `Task.Run` cho việc bắt buộc phải xảy ra. Việc đó cần hàng đợi bền.
- Kể "giảm từ X xuống Y" khi chỉ có mục tiêu trong báo cáo. Nói "mục tiêu là…, cách tôi sẽ đo là…".

#### Nhớ nhanh

- Thời gian request = các span tuần tự + self time.
- N+1 cùng tham số → đọc một lần; khác tham số → truy vấn theo tập.
- Ưu tiên theo chi phí mỗi lần × số lần gọi.
- `_ = TaskAsync()` không đẩy phần đồng bộ đầu tiên ra nền; client gRPC/HTTP phải dùng lại.
- Đo lại bằng cùng trace và tốc độ tăng `execution_count`.

#### Bài tập

1. Một request có các span tuần tự: proc A 15 ms × 5 lần, proc B 4,8 ms × 5 lần, proc C 65 ms và 67 ms, gRPC 9,2 ms, self time 20 ms. Tính thời gian request trước, và sau khi: A gọi 1 lần, B gọi 1 lần, C gộp thành một lần 70 ms, gRPC ra nền.
   **Đáp án:** Trước: 75 + 24 + 132 + 9,2 + 20 = 260,2 ms. Sau: 15 + 4,8 + 70 + 0 + 20 = 109,8 ms. Phần lớn lợi ích đến từ bỏ gọi lặp, không phải từ tối ưu câu lệnh.
2. Trên `LabPerf`, mô phỏng N+1 bằng vòng `WHILE` lấy tên trường cho 1.000 học sinh đầu (mỗi vòng một `SELECT`), so với một câu `JOIN`. Bật `SET STATISTICS TIME ON`, rồi xem `execution_count` của câu trong vòng lặp ở `sys.dm_exec_query_stats`.
   **Đáp án:** Vòng lặp chạy 1.000 câu, mỗi câu vài logical reads cộng chi phí thực thi từng câu; `JOIN` chỉ một câu. `execution_count` của câu trong vòng lặp là 1.000. Qua mạng thật, mỗi câu còn thêm một round-trip.
   ```sql
   SET STATISTICS TIME ON;
   DECLARE @i INT = 1, @name NVARCHAR(200);
   WHILE @i <= 1000
   BEGIN
       SELECT @name = sc.SchoolName
       FROM dbo.Student s JOIN dbo.School sc ON sc.SchoolId = s.SchoolId
       WHERE s.StudentId = @i;
       SET @i += 1;
   END;
   SELECT s.StudentId, sc.SchoolName
   FROM dbo.Student s JOIN dbo.School sc ON sc.SchoolId = s.SchoolId
   WHERE s.StudentId <= 1000;
   ```
3. Viết lại để chỉ gọi DB một lần: `foreach (var row in top100) row.ProvinceName = await _repo.GetProvinceNameAsync(row.ProvinceId);`.
   **Đáp án:** Lấy tập `ProvinceId` khác nhau, gọi một lần `GetProvinceNamesAsync(ids)` (proc nhận TVP), dựng `Dictionary<int, string>`, gán trong bộ nhớ. Danh mục tỉnh ít đổi nên tốt hơn nữa là cache cả danh mục (`IMemoryCache` hoặc Redis, TTL dài).

### Bài 17.3. DMV và Query Store: tìm truy vấn tốn nhất

#### Kiến thức

##### Số liệu gắn với plan trong cache

Khi một proc hay câu lệnh được compile, plan nằm trong plan cache và SQL Server gắn số liệu chạy (số lần, CPU, reads, thời gian) vào chính plan đó. Hệ quả: plan bị đẩy khỏi cache (áp lực bộ nhớ, `ALTER PROCEDURE`, `sp_recompile`, cập nhật statistics, restart) thì số liệu mất theo.

- `sys.dm_exec_procedure_stats`: một dòng cho mỗi proc đang có plan. Cột chính: `execution_count`, `total_worker_time` (CPU), `total_elapsed_time`, `total_logical_reads`, `total_spills`, `cached_time`.
- `sys.dm_exec_query_stats`: một dòng cho mỗi **câu lệnh** trong một plan. Proc 5 câu có 5 dòng cùng `plan_handle`, phân biệt bằng `statement_start_offset`. Có thêm `total_grant_kb`, `max_used_grant_kb`, `min_*`/`max_*`, `query_hash`.
- Thời gian tính bằng micro giây; reads tính bằng trang 8 KB.

```sql
-- Top 20 câu lệnh theo tổng CPU
SELECT TOP (20)
    DB_NAME(st.dbid)                                   AS db,
    OBJECT_NAME(st.objectid, st.dbid)                  AS proc_name,
    qs.execution_count,
    qs.total_worker_time / 1000                        AS total_cpu_ms,
    qs.total_worker_time / qs.execution_count / 1000.0 AS avg_cpu_ms,
    qs.total_logical_reads / qs.execution_count        AS avg_reads,
    qs.total_spills, qs.max_grant_kb, qs.max_used_grant_kb,
    SUBSTRING(st.text, qs.statement_start_offset / 2 + 1,
        (CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text)
              ELSE qs.statement_end_offset END - qs.statement_start_offset) / 2 + 1) AS stmt,
    qs.plan_handle
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY qs.total_worker_time DESC;
```

Đổi `ORDER BY` sang `total_logical_reads`, `total_spills`, `max_grant_kb` để có bốn bảng xếp hạng. Xếp theo **tổng**, vì tổng mới là tải server gánh; xếp theo trung bình chỉ tìm ra câu chậm với một người dùng.

##### Missing index và index usage

Khi compile, nếu optimizer thấy một index giả định sẽ giúp, nó ghi gợi ý vào `sys.dm_db_missing_index_details` (cột bằng, cột không bằng, cột include) và `sys.dm_db_missing_index_group_stats` (số lần seek/scan, chi phí, `avg_user_impact`). Đây là gợi ý ghi lúc compile, không phải lệnh: nó không biết index tương tự đã có, không tính chi phí ghi, bỏ qua `ORDER BY`, và hay đề xuất nhiều index gần trùng.

`sys.dm_db_index_usage_stats` cho biết mỗi index có bao nhiêu seek, scan, lookup, update kể từ lần khởi động. Index có update cao mà không ai đọc là ứng viên xoá, nhưng chỉ sau khi số liệu đã phủ đủ một chu kỳ nghiệp vụ.

##### Query Store

Query Store lưu lịch sử bền ngay trong database: mỗi câu là một `query_id`, mỗi plan là một `plan_id`, số liệu gom theo khoảng thời gian, từ 2017 có thêm wait theo truy vấn. Không mất khi restart hay khi plan bị đẩy khỏi cache, cho phép so trước và sau một lần deploy và ép plan (`sp_query_store_force_plan`). SQL Server 2022 bật mặc định cho database mới.

```sql
ALTER DATABASE LabPerf SET QUERY_STORE = ON (
    OPERATION_MODE = READ_WRITE,
    QUERY_CAPTURE_MODE = AUTO,         -- bỏ qua câu ad hoc chạy ít, rẻ
    MAX_STORAGE_SIZE_MB = 1024,        -- đầy thì tự chuyển sang READ_ONLY
    INTERVAL_LENGTH_MINUTES = 15,
    CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30));
```

> **Ghi nhớ:** Mỗi số đo DMV phải đi kèm uptime (`sys.dm_os_sys_info.sqlserver_start_time`), `cached_time` của plan và thời điểm chụp. Cách bền hơn: job chụp DMV định kỳ vào bảng lịch sử rồi so chênh lệch.

> **Cảnh báo:** Nhiều dòng trong `dm_exec_query_stats` cho cùng một proc thường là nhiều *câu lệnh* của một plan, không phải nhiều plan. Kiểm tra `plan_handle` và `statement_start_offset`, hoặc xem Query Store có nhiều `plan_id` cho cùng `query_id` không, trước khi kết luận parameter sniffing.

#### Cách show off

Chất liệu thật:
- Một proc lấy danh mục môn và vòng thi, mỗi lần chỉ vài ms, nhưng DMV ghi khoảng 80 triệu lần chạy. Bạn lần ngược vào code và thấy hai lỗi: TTL cache dùng chung một biến chỉ 1 giây, và kết quả rỗng không bao giờ được cache vì code coi list rỗng là "chưa có cache". Bạn tự sửa: lưu JSON để cache được cả list rỗng, TTL 6 giờ, thêm hàm xoá cache cho CMS gọi khi cấu hình đổi.
- Một proc tin tức theo chuyên mục: mỗi lần đọc vừa phải, nhưng chạy vài triệu lần nên tổng reads lên hàng tỷ trang.
- Một chỗ cần tự sửa lại trong báo cáo: proc xếp hạng được ghi là "có 10 plan khác nhau", nhưng mấy dòng đó có `execution_count` bằng đúng số lần gọi proc, tức là các câu lệnh trong cùng một plan.

> **Ví dụ:** "Khi xếp DMV theo tổng reads, đứng đầu không phải câu chậm nhất mà là một proc lấy danh mục môn thi, mỗi lần chỉ vài mili giây nhưng chạy khoảng 80 triệu lần. Proc rẻ mà chạy dày như vậy thì tối ưu SQL không giải quyết được, nên tôi đọc code gọi nó. Có hai lỗi: TTL cache chỉ 1 giây, và kết quả rỗng không bao giờ được lưu nên lần nào cũng xuống DB. Tôi sửa cả hai ở tầng app, TTL 6 giờ, cache được cả kết quả rỗng, và thêm hàm xoá cache để CMS gọi khi đổi cấu hình. Đánh đổi là dữ liệu có thể cũ vài giờ nếu CMS quên gọi, chấp nhận được với dữ liệu cấu hình."

Điểm ăn điểm:
- Xếp theo tổng chứ không theo trung bình, và nói được vì sao.
- Biết lúc nào vấn đề "nằm ở SQL" nhưng cách sửa đúng nằm ở app.
- Biết giới hạn của DMV: reset khi `ALTER`, restart; gợi ý missing index không phải lệnh.
- Tự chỉ ra chỗ báo cáo đọc sai số liệu. Tự phản biện là dấu hiệu senior.

#### Câu hỏi vặn

- **"Vì sao không tạo ngay mọi index trong missing index DMV?"** DMV không biết index tương tự đã có, không tính chi phí ghi, bỏ qua thứ tự `ORDER BY`, và hay đề xuất nhiều index trùng tiền tố. Tôi gộp các gợi ý, đối chiếu index đang có bằng `sp_BlitzIndex`, tính chi phí ghi của bảng, rồi thử bằng plan thật.
- **"Xếp hạng truy vấn tốn nhất nên theo trung bình hay theo tổng?"** Theo tổng, vì đó là tải server gánh. Một câu đọc vài nghìn trang nhưng chạy vài triệu lần tốn hơn nhiều một câu đọc một triệu trang chạy mười lần. Trung bình chỉ cho biết trải nghiệm của một lần gọi.
- **"DMV và Query Store khác nhau thế nào, khi nào dùng cái nào?"** DMV đọc từ plan cache: có ngay, không cần cấu hình, nhưng mất khi plan bị đẩy hay restart. Query Store lưu bền, có lịch sử plan, so trước và sau, ép plan, wait theo truy vấn; đổi lại tốn dung lượng và chút overhead. Điều tra nhanh dùng DMV, theo dõi dài hạn dùng Query Store.
- **"Một proc có 3 dòng trong `dm_exec_query_stats`. Có phải 3 plan?"** Chưa chắc. Cùng `plan_handle`, khác `statement_start_offset` là 3 câu của một plan; `execution_count` bằng nhau và bằng số lần gọi proc càng khẳng định. Nhiều plan thật là nhiều `plan_handle`, hoặc nhiều `plan_id` cho cùng `query_id` trong Query Store.
- **"Sửa proc trên production rồi, đo hiệu quả thế nào?"** Ghi số trước khi `ALTER`, vì `ALTER` reset số liệu của proc. Sau deploy đo lại trên các lần chạy mới: reads, CPU, elapsed trung bình; đối chiếu Query Store hai khoảng thời gian và trace APM của API gọi proc.
- **"Proc danh mục đó sau khi sửa còn chạy bao nhiêu lần?"** Tôi không có số đo chính thức sau khi sửa nên không đưa con số. Cách đo đúng là chụp tốc độ tăng `execution_count` theo phút trong cùng khung giờ trước và sau deploy. [điền: số lần gọi mỗi phút trước và sau, nếu đã đo]

#### Bẫy cần tránh

- Kết luận "nhiều plan, bị sniffing" chỉ vì thấy nhiều dòng của một proc.
- Quên rằng proc `WITH RECOMPILE` hay câu ad hoc không tham số hoá có thể không nằm lại trong cache, nên không hiện trong top dù rất tốn. Query Store bắt được.
- Xoá index sau vài ngày uptime vì "0 lượt dùng".
- Tối ưu SQL cho một proc rẻ chạy hàng chục triệu lần trong khi gốc là cache hỏng ở app.

#### Nhớ nhanh

- Số liệu DMV gắn với plan trong cache: mất khi plan bị đẩy, `ALTER`, restart.
- `procedure_stats` theo proc, `query_stats` theo câu lệnh; xếp hạng theo tổng.
- Missing index là gợi ý: gộp, đối chiếu index có sẵn, tính chi phí ghi.
- Query Store giữ lịch sử plan, so trước/sau, ép plan.
- Proc rẻ chạy rất dày thường sửa ở app.

#### Bài tập

1. Bật Query Store cho `LabPerf`, chạy 50 lần `SELECT COUNT(*) FROM dbo.Student WHERE SchoolId = 500;`, rồi tìm câu đó trong Query Store kèm số lần chạy và logical reads trung bình.
   **Đáp án:**
   ```sql
   SELECT q.query_id, p.plan_id, qt.query_sql_text,
          SUM(rs.count_executions) AS execs,
          AVG(rs.avg_logical_io_reads) AS avg_reads
   FROM sys.query_store_query_text qt
   JOIN sys.query_store_query q   ON q.query_text_id = qt.query_text_id
   JOIN sys.query_store_plan p    ON p.query_id = q.query_id
   JOIN sys.query_store_runtime_stats rs ON rs.plan_id = p.plan_id
   WHERE qt.query_sql_text LIKE N'%SchoolId = 500%'
   GROUP BY q.query_id, p.plan_id, qt.query_sql_text;
   ```
   Chưa có index trên `SchoolId` nên reads trung bình xấp xỉ số trang của `Student` (khoảng 9–10 nghìn).
2. Tạo `IX_Student_SchoolId` trên `Student(SchoolId)`, chạy lại truy vấn vài lần, rồi xem index đó trong `sys.dm_db_index_usage_stats`.
   **Đáp án:** Lọc `database_id = DB_ID()` và `object_id = OBJECT_ID('dbo.Student')`, join `sys.indexes` để lấy tên. `user_seeks` tăng theo số lần chạy; `user_updates` bằng 0 vì chưa ghi.
3. Viết truy vấn tìm index chết: `user_updates > 0` nhưng `user_seeks + user_scans + user_lookups = 0`. Vì sao chưa nên xoá ngay dựa trên kết quả?
   **Đáp án:** `LEFT JOIN` từ `sys.indexes` sang `sys.dm_db_index_usage_stats` để thấy cả index chưa từng được dùng, loại `index_id <= 1`. Chưa xoá ngay vì số liệu reset khi restart và job cuối kỳ có thể cần; đối chiếu uptime và Query Store, giữ script tạo lại.

### Bài 17.4. Wait stats: server đang chờ gì
**Viz:** waits

#### Kiến thức

##### Mô hình scheduler

SQL Server tự lập lịch (SQLOS): mỗi lõi CPU có một scheduler, mỗi task chạy trên một worker thread. Worker ở một trong ba trạng thái: `RUNNING` (đang chiếm CPU), `SUSPENDED` (chờ tài nguyên: trang từ đĩa, khoá, bộ nhớ…), `RUNNABLE` (đã có tài nguyên, xếp hàng chờ CPU). Thời gian `SUSPENDED` là resource wait, thời gian `RUNNABLE` là signal wait. Trong `sys.dm_os_wait_stats`, `wait_time_ms` gồm cả hai, `signal_wait_time_ms` là phần chờ CPU. Signal wait chiếm quá khoảng 20–25% tổng là dấu hiệu thiếu CPU hoặc có câu đốt CPU.

##### Đo chênh lệch, không đọc số cộng dồn

`sys.dm_os_wait_stats` cộng dồn từ lúc khởi động; một lần chụp sau ba tháng uptime phản ánh cả sự cố tháng trước. Cách đúng là chụp hai lần cách nhau vài phút trong giờ cao điểm và lấy chênh lệch, lọc bỏ wait nền.

```sql
SELECT wait_type, waiting_tasks_count, wait_time_ms, signal_wait_time_ms
INTO #w1 FROM sys.dm_os_wait_stats;

WAITFOR DELAY '00:05:00';

SELECT w2.wait_type,
       (w2.wait_time_ms - w1.wait_time_ms) / 1000.0               AS wait_s,
       (w2.signal_wait_time_ms - w1.signal_wait_time_ms) / 1000.0 AS signal_s,
       w2.waiting_tasks_count - w1.waiting_tasks_count             AS tasks
FROM sys.dm_os_wait_stats w2
JOIN #w1 w1 ON w1.wait_type = w2.wait_type
WHERE w2.wait_time_ms > w1.wait_time_ms
  AND w2.wait_type NOT IN (   -- danh sách rút gọn; dùng danh sách đầy đủ của Paul Randal hoặc sp_BlitzFirst
      'SLEEP_TASK','LAZYWRITER_SLEEP','SQLTRACE_INCREMENTAL_FLUSH_SLEEP','XE_TIMER_EVENT',
      'XE_DISPATCHER_WAIT','REQUEST_FOR_DEADLOCK_SEARCH','LOGMGR_QUEUE','CHECKPOINT_QUEUE',
      'BROKER_TO_FLUSH','BROKER_TASK_STOP','DIRTY_PAGE_POLL','HADR_FILESTREAM_IOMGR_IOCOMPLETION',
      'SP_SERVER_DIAGNOSTICS_SLEEP','QDS_ASYNC_QUEUE','QDS_PERSIST_TASK_MAIN_LOOP_SLEEP',
      'WAIT_XTP_HOST_WAIT','WAIT_XTP_OFFLINE_CKPT_NEW_LOG','CXCONSUMER')
ORDER BY wait_s DESC;
```

##### Các nhóm wait chính

| Wait | Ý nghĩa | Hướng điều tra và sửa |
|---|---|---|
| `SOS_SCHEDULER_YIELD` | Worker dùng hết lượt CPU, nhường | Câu tốn CPU nhất (Bài 17.3) |
| `THREADPOOL` | Hết worker trống để nhận task | Câu chậm hoặc bị chặn giữ worker; không tăng `max worker threads` |
| `CXPACKET`, `CXSYNC_PORT` | Luồng song song chờ nhau | Nâng `cost threshold for parallelism` (mặc định 5 quá thấp), đặt `MAXDOP` theo NUMA, sửa câu lớn |
| `RESOURCE_SEMAPHORE` | Chờ được cấp memory grant | Câu xin grant lớn (Bài 19.4) |
| `PAGEIOLATCH_SH/EX` | Chờ đọc trang từ đĩa | Scan lớn, thiếu index, thiếu RAM |
| `WRITELOG` | Chờ ghi log khi commit | Nhiều commit nhỏ, đĩa log chậm, quá nhiều index |
| `PAGELATCH_EX/SH` | Tranh chấp một trang trong RAM | Chèn dồn trang cuối, metadata tempdb (Bài 18.3) |
| `LCK_M_*` | Chờ khoá phiên khác giữ | Blocking, transaction dài |
| `ASYNC_NETWORK_IO` | SQL chờ client đọc kết quả | Result set lớn, app đọc chậm |
| `MSQL_DQ`, `OLEDB`, `PREEMPTIVE_*` | Chờ linked server, API hệ điều hành | Linked server trong transaction (Chương 21) |

##### Wait là triệu chứng, phải lần ra truy vấn

Từ wait lần ra câu gây ra nó: `sys.dm_exec_requests`, `sys.dm_os_waiting_tasks`, `sp_WhoIsActive` cho thời điểm hiện tại; `sys.query_store_wait_stats` cho lịch sử theo truy vấn.

```sql
SELECT r.session_id, r.status, r.wait_type, r.wait_time, r.blocking_session_id,
       r.granted_query_memory * 8 AS grant_kb, t.text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id <> @@SPID AND r.session_id > 50;
```

> **Cảnh báo:** Đừng chữa wait bằng núm cấu hình khi gốc là truy vấn. Tăng `max worker threads` cho `THREADPOOL` hay đặt `MAXDOP = 1` toàn server cho `CXPACKET` chỉ đẩy vấn đề sang chỗ khác.

#### Cách show off

Chất liệu thật:
- Cụm log thi chính thức: `THREADPOOL` và `WRITELOG` đứng đầu, tức worker bị giữ lâu và có quá nhiều commit nhỏ trên bảng ghi liên tục.
- Cụm dữ liệu lõi: wait linked server chiếm phần lớn. Đáng chú ý nhất là proc cộng trừ vật phẩm gọi linked server ngay trong transaction đang giữ khoá cập nhật; mạng chậm thì khoá bị giữ hàng chục giây.
- Một chỗ cần sửa trong báo cáo: hai wait `QDS_ASYNC_QUEUE` và `WAIT_XTP_HOST_WAIT` từng bị coi là điểm nghẽn ở cụm log luyện tập, nhưng chúng nằm trong danh sách wait nền mà script chuẩn lọc bỏ.

> **Ví dụ:** "Ở cụm dữ liệu lõi, wait đứng đầu không phải I/O hay CPU mà là wait chờ linked server. Tôi lần từ wait ra truy vấn và gặp một proc cộng trừ vật phẩm: nó mở transaction, khoá dòng để cập nhật, rồi gọi sang server khác qua linked server ngay trong transaction đó. Mạng chậm một chút là khoá bị giữ rất lâu, các request khác xếp hàng sau, và worker bị chiếm dần. Đề xuất của tôi là đưa lời gọi ra khỏi transaction: lấy dữ liệu cần trước, transaction chỉ còn phần ghi cục bộ. Khi rà lại báo cáo, tôi cũng phải sửa một kết luận của chính mình: hai wait tôi từng xếp là điểm nghẽn thực ra là wait nền, script chuẩn đều lọc bỏ."

Điểm ăn điểm:
- Luôn đo chênh lệch trong giờ cao điểm, không đọc số cộng dồn.
- Coi wait là triệu chứng và nói được cách lần ra truy vấn.
- Biết những "cách sửa" sai phổ biến (`max worker threads`, `MAXDOP = 1`) và vì sao sai.
- Dám tự sửa kết luận cũ khi có bằng chứng mới.

#### Câu hỏi vặn

- **"`ASYNC_NETWORK_IO` cao có phải mạng chậm?"** Thường không. SQL đã có dữ liệu và đang chờ client đọc. Hay gặp khi trả result set quá lớn, hoặc app xử lý từng dòng trong lúc vẫn giữ reader mở. Sửa ở app: phân trang, chọn đủ cột, đọc hết rồi mới xử lý.
- **"`THREADPOOL` cao, có nên tăng `max worker threads`?"** Không. Hết worker là vì các worker đang bận với truy vấn chậm hoặc bị chặn. Thêm thread chỉ thêm tranh chấp và bộ nhớ. Tìm chuỗi blocking và câu chậm bằng `sys.dm_exec_requests` hoặc `sp_WhoIsActive` rồi sửa chúng.
- **"Signal wait chiếm 35% tổng wait nói lên điều gì?"** Task đã có tài nguyên nhưng phải xếp hàng chờ CPU: thiếu CPU hoặc có câu đốt CPU. Tìm top câu theo `total_worker_time` trước khi nghĩ tới mua thêm lõi.
- **"`CXPACKET` đứng đầu, đặt `MAXDOP = 1` cho xong được không?"** Không cho cả server. `CXPACKET` chỉ cho biết có song song. Nâng `cost threshold for parallelism` để câu nhỏ không chạy song song, đặt `MAXDOP` hợp lý, sửa các câu lớn (thường là scan do thiếu index). Trường hợp riêng thì đặt `MAXDOP` ở mức câu lệnh hoặc database.
- **"`WRITELOG` cao xử lý thế nào?"** Xem độ trễ ghi của file log qua `sys.dm_io_virtual_file_stats`. Nếu đĩa ổn, gốc thường là quá nhiều commit nhỏ: gom nhiều dòng vào một transaction, bỏ index thừa để giảm lượng log. `DELAYED_DURABILITY` đổi độ bền lấy tốc độ, chỉ dùng khi nghiệp vụ chấp nhận mất vài ms dữ liệu cuối.
- **"Vì sao gọi linked server trong transaction lại nguy hiểm?"** Transaction giữ khoá trong suốt lời gọi ra ngoài, nên độ trễ mạng và độ chậm của server bên kia biến thành thời gian giữ khoá ở server mình. Một sự cố bên kia lan thành blocking dây chuyền bên này. Gọi trước, ghi sau; transaction chỉ chứa phần ghi cục bộ.

#### Bẫy cần tránh

- Đọc phần trăm trên số cộng dồn nhiều tháng; một sự cố cũ có thể chi phối cả bảng.
- Xếp wait nền vào danh sách điểm nghẽn. Dùng danh sách lọc chuẩn.
- Nói "server thiếu RAM" chỉ vì thấy `PAGEIOLATCH`. Trước hết tìm câu đang scan lớn.
- Đề xuất `DELAYED_DURABILITY` mà không nói cái giá.

#### Nhớ nhanh

- Worker: `RUNNING`, `SUSPENDED` (resource wait), `RUNNABLE` (signal wait = chờ CPU).
- Đo chênh lệch giữa hai lần chụp; lọc wait nền.
- Mỗi nhóm wait chỉ tới một loại tài nguyên; wait là triệu chứng, phải lần ra truy vấn.
- Không chữa bằng núm cấu hình khi gốc là truy vấn.

#### Bài tập

1. Tạo blocking trên `LabPerf`: cửa sổ 1 chạy `BEGIN TRAN; UPDATE dbo.Student SET Status = 1 WHERE StudentId = 10;` (chưa commit); cửa sổ 2 chạy `SELECT * FROM dbo.Student WHERE StudentId = 10;`. Ở cửa sổ 3, tìm wait type và phiên chặn.
   **Đáp án:** `sys.dm_exec_requests` cho thấy phiên 2 có `wait_type = LCK_M_S`, `blocking_session_id` là phiên 1. `sys.dm_os_waiting_tasks` cho thêm `resource_description` (khoá KEY nào). `ROLLBACK` ở cửa sổ 1 để kết thúc.
2. Chạy script đo chênh lệch wait trong 2 phút; trong lúc đó, ở cửa sổ khác chạy `SELECT * FROM dbo.ExamResult;` trong SSMS (kết quả ra lưới). Wait nào tăng?
   **Đáp án:** `ASYNC_NETWORK_IO`: SQL Server đẩy dữ liệu nhanh hơn SSMS vẽ lưới. Chứng minh wait này thường do client, không do mạng.
3. Kiểm tra `cost threshold for parallelism` và `max degree of parallelism` của server dev. Đề xuất giá trị cho server 16 lõi, 2 NUMA node.
   **Đáp án:** `SELECT name, value_in_use FROM sys.configurations WHERE name IN ('cost threshold for parallelism','max degree of parallelism');`. Đề xuất: cost threshold khoảng 50 làm điểm xuất phát rồi chỉnh theo tải; `MAXDOP` 8, không vượt số lõi mỗi NUMA node.

### Bài 17.5. Đọc execution plan

#### Kiến thức

##### Optimizer làm gì

Câu lệnh đi qua: parse → bind (kiểm tra tên, kiểu) → optimize → lưu plan cache → thực thi. Optimizer dựa trên chi phí: sinh nhiều phương án (thứ tự join, loại join, index nào), ước lượng chi phí mỗi phương án từ **số dòng ước lượng** (lấy từ statistics) và mô hình chi phí I/O, CPU, rồi chọn phương án rẻ nhất trong thời gian tìm kiếm cho phép. Mọi quyết định đứng trên số dòng ước lượng; ước lượng sai thì plan sai.

##### Plan ước lượng và plan thật

Plan ước lượng (Ctrl+L, `SET SHOWPLAN_XML ON`) không chạy câu lệnh. Plan thật (Ctrl+M, `SET STATISTICS XML ON`) là cùng plan đó cộng số liệu khi chạy: số dòng thật, số lần thực thi, từ 2016 SP1 có thêm CPU, elapsed và I/O thật trên từng toán tử. Plan trong cache (`sys.dm_exec_query_plan`) chỉ là plan ước lượng. Từ 2019, bật `LAST_QUERY_PLAN_STATS` để lấy plan thật gần nhất qua `sys.dm_exec_query_plan_stats`.

##### Cách đọc và toán tử cần biết

Dữ liệu chảy từ phải sang trái, độ dày mũi tên là số dòng. Toán tử ngoài cùng bên trái gọi "cho tôi dòng tiếp theo" xuống toán tử con. Toán tử chặn như Sort, Hash build phải đọc hết input trước khi trả dòng đầu.

| Toán tử | Ý nghĩa |
|---|---|
| Index Seek | Đi từ gốc B-tree xuống, đọc một dải; rẻ khi dải hẹp |
| Index Scan / Table Scan | Đọc toàn bộ tầng lá của index / toàn bộ heap |
| Key Lookup / RID Lookup | Từ index phụ quay về bảng lấy cột thiếu, mỗi dòng một lần |
| Nested Loops | Mỗi dòng bên ngoài tìm bên trong; tốt khi bên ngoài nhỏ, bên trong seek được |
| Hash Match | Dựng bảng băm từ input nhỏ, dò bằng input kia; hợp tập lớn, cần memory grant |
| Merge Join | Hai input đã sắp theo khoá join; rẻ nếu không phải Sort thêm |
| Sort | Chặn, cần memory grant, có thể spill |
| Table Spool | Lưu tạm kết quả trung gian vào tempdb để dùng lại |
| Remote Query | Gửi câu lệnh sang linked server |

##### Thuộc tính quan trọng

- *Estimated Number of Rows Per Execution* so với *Actual Number of Rows for All Executions* và *Number of Executions*. Bên trong Nested Loops, ước lượng tính cho một lần chạy còn số thật cộng mọi lần: ước lượng 1, chạy 500 lần, thật 500 là đúng. Lệch hàng chục lần trở lên sau khi chia số lần chạy là gốc của join sai, grant sai.
- **Seek Predicate** là phần điều kiện dùng để đi xuống B-tree, giới hạn dải đọc. **Predicate** (residual) là điều kiện kiểm tra từng dòng sau khi đọc. Index Seek mà cột lọc chính chỉ nằm ở Predicate thì thực chất vẫn đọc rộng.
- Cảnh báo (tam giác vàng): spill (Sort/Hash Warnings), Excessive Grant, `CONVERT_IMPLICIT` ảnh hưởng seek, missing index, No Join Predicate.

> **Ghi nhớ:** `Cost %` là chi phí *ước lượng* của optimizer, không phải số đo. Đo bằng `SET STATISTICS IO, TIME ON` và số liệu thật trên plan.

```sql
SET STATISTICS IO, TIME ON;
SELECT StudentId, FullName FROM dbo.Student WHERE SchoolId = 500;
-- Messages (xấp xỉ, chưa có index trên SchoolId):
-- Table 'Student'. Scan count 1, logical reads 9500, physical reads 0, read-ahead reads 0 ...
-- SQL Server Execution Times: CPU time = 60 ms, elapsed time = 25 ms.
```

`logical reads` là số trang đọc từ buffer pool, ổn định giữa các lần chạy; `physical reads` phụ thuộc trang đã có trong RAM chưa; CPU time lớn hơn elapsed là dấu hiệu chạy song song.

##### Từ plan ra hướng sửa

- Scan vì thiếu index hoặc index sai thứ tự cột → Bài 18.1, 18.2.
- Scan dù có index, cột lọc nằm ở Predicate, có `CONVERT_IMPLICIT` → Bài 19.1.
- Ước lượng lệch xa số thật → Bài 19.2, 19.3, 19.5.
- Sort, Hash, cảnh báo spill hoặc grant → Bài 19.4.
- Remote Query → Chương 21.

#### Cách show off

Chất liệu thật:
- Proc lọc học sinh theo trường và khối: plan ước lượng chỉ vài chục rồi một dòng, nhưng thực tế đọc hàng chục nghìn trang mỗi lần, lệch hàng trăm lần.
- Job báo cáo tài khoản theo ngày: plan gần 300 toán tử, hàng chục Table Scan, tất cả xoay quanh một bảng biến.
- Job sinh đề thi thử: toán tử tốn nhất là Remote Query qua linked server.

> **Ví dụ:** "Khi đọc plan tôi không nhìn Cost phần trăm trước, vì đó chỉ là ước lượng. Tôi so số dòng ước lượng với số dòng thật ở từng toán tử. Ở proc lọc học sinh theo trường và khối, optimizer tưởng chỉ có một dòng nên chọn Nested Loops kèm lookup, trong khi thực tế đi qua hàng chục nghìn trang mỗi lần. Ước lượng lệch cỡ đó thì thêm index chưa chắc cứu được; phải tìm vì sao lệch, ở đây là plan được compile theo một bộ tham số nhỏ rồi dùng lại cho trường lớn. Plan cho tôi biết nên sửa theo hướng nào trước khi đụng vào code."

Điểm ăn điểm:
- Nói "so ước lượng với thật" thay vì "tìm toán tử cost cao nhất".
- Phân biệt Seek Predicate với Predicate: nhiều người thấy chữ Seek là yên tâm.
- Biết plan trong cache chỉ có ước lượng, và biết cách lấy plan thật trên production.
- Giải thích được "SSMS nhanh, app chậm".

#### Câu hỏi vặn

- **"Plan ghi Sort chiếm 80% cost. Có chắc Sort là chỗ chậm nhất?"** Không chắc, cost là ước lượng tính trên số dòng ước lượng. Tôi xem thời gian và I/O thật trên từng toán tử trong plan thật, cảnh báo spill, và số dòng thật trước khi kết luận.
- **"Plan trong cache là plan ước lượng hay plan thật?"** Ước lượng. Muốn số thật thì chạy với `STATISTICS XML`, hoặc từ 2019 bật `LAST_QUERY_PLAN_STATS` rồi đọc `sys.dm_exec_query_plan_stats`. Query Store cũng chỉ lưu plan ước lượng kèm số liệu runtime tổng hợp.
- **"Index Seek có phải lúc nào cũng tốt?"** Không. Seek chỉ nói cách vào B-tree. Nếu Seek Predicate chỉ khớp cột đầu và phần lọc chính nằm ở Predicate, toán tử vẫn đọc rất nhiều trang. Seek kèm Key Lookup cho hàng chục nghìn dòng có thể đắt hơn scan.
- **"Khi nào optimizer chọn Hash Join thay vì Nested Loops?"** Khi hai input đều lớn, phía trong không có index hỗ trợ, hoặc không sắp theo khoá join. Nested Loops hợp khi phía ngoài ít dòng và phía trong seek được. Ước lượng phía ngoài 1 dòng trong khi thật là nửa triệu là cách dễ nhất để có một Nested Loops thảm hoạ.
- **"SSMS chạy nhanh mà app chạy chậm cùng proc. Vì sao?"** Hai phiên có `SET` options khác nhau (thường là `ARITHABORT`) nên dùng hai plan riêng trong cache, mỗi plan compile theo tham số lần đầu của nó. Plan của app có thể được sniff với giá trị không điển hình. Lấy đúng plan app đang dùng từ cache hoặc Query Store, đừng so bằng phiên SSMS.

#### Bẫy cần tránh

- Kết luận về số dòng thật từ plan trong cache.
- So Estimated với Actual bên trong Nested Loops mà quên chia số lần chạy.
- Tái hiện bằng literal rồi nói "trên máy tôi nhanh". Gọi chính proc hoặc `sp_executesql` có tham số, cùng `SET` options như app.
- Nói "Cost 80% nên sửa Sort" như thể cost là thời gian.

#### Nhớ nhanh

- Optimizer chọn plan theo chi phí ước lượng từ số dòng ước lượng.
- Plan thật = plan ước lượng + số liệu chạy; plan trong cache chỉ là ước lượng.
- Đọc phải sang trái; chú ý mũi tên dày, Key Lookup, Sort, cảnh báo.
- So Estimated với Actual; phân biệt Seek Predicate và Predicate.
- Đo bằng logical reads và plan thật, không bằng `Cost %`.

#### Bài tập

1. Trên `LabPerf` (chưa có index phụ), chạy với plan thật: `SELECT s.FullName, sc.SchoolName FROM dbo.Student s JOIN dbo.School sc ON sc.SchoolId = s.SchoolId WHERE s.SchoolId = 500;`. Mô tả các toán tử và logical reads từng bảng.
   **Đáp án:** `Student` bị Clustered Index Scan (khoảng 9.500 reads) với Predicate `SchoolId = 500`, ra khoảng 40 dòng; `School` được Clustered Index Seek theo PK (2–3 reads). Join là Nested Loops vì một phía chỉ một dòng. Plan có gợi ý missing index trên `Student(SchoolId)`.
2. Tạo `CREATE INDEX IX_Student_SchoolId ON dbo.Student(SchoolId);` rồi so plan của `WHERE SchoolId = 500` và `WHERE SchoolId = 1`. Giải thích khác biệt.
   **Đáp án:** Trường 500 (khoảng 40 dòng): Index Seek + Key Lookup, khoảng 120 reads. Trường 1 (200.000 dòng): Clustered Index Scan, vì 200.000 lookup (khoảng 600.000 reads) đắt hơn đọc cả bảng. Đây là điểm bùng phát ở Bài 18.1.
3. Chạy `SELECT * FROM dbo.Student WHERE Phone = N'0900000123';` với plan thật. Tìm cảnh báo và giải thích.
   **Đáp án:** `N'...'` là `nvarchar`, cột `Phone` là `varchar`; `nvarchar` ưu tiên kiểu cao hơn nên cột bị chuyển: `CONVERT_IMPLICIT(nvarchar, Phone)`, cảnh báo trên toán tử SELECT. Có index trên `Phone` thì tuỳ collation có thể mất seek hoặc thành seek động kém hiệu quả. Sửa: truyền đúng kiểu `varchar`. Chi tiết ở Bài 19.1.

## Chương 18. Index

Phần lớn các truy vấn đọc hàng chục nghìn tới hàng triệu trang mỗi lần trong đợt rà soát đến từ ba nguyên nhân: thiếu index đúng, index sai thứ tự cột, hoặc quá nhiều index trên bảng ghi liên tục. Chương này đi từ cấu trúc lưu trữ (trang, B-tree, heap), tới cách thiết kế index từ truy vấn, chi phí ghi của index, và quy trình tạo index an toàn trên production.

Vòng phỏng vấn backend senior nào cũng hỏi index, nhưng câu khó không phải "index là gì". Câu khó là "vì sao có index mà vẫn scan", "chọn thứ tự cột thế nào", "sao không đánh index hết cho nhanh", "tạo index giữa giờ cao điểm thì sao". Học xong chương, bạn trả lời được các câu đó bằng cơ chế và số đo.

### Bài 18.1. B-tree, heap, seek, scan, logical reads
**Viz:** seek-scan

#### Kiến thức

##### Trang và logical reads

SQL Server đọc ghi theo trang 8 KB. Mọi lần đọc đi qua buffer pool trong RAM: trang chưa có thì đọc từ đĩa (physical read), có rồi thì chỉ là logical read. Logical reads là thước đo chính khi tối ưu vì nó ổn định giữa các lần chạy, không phụ thuộc cache nóng hay lạnh, và tỷ lệ với CPU và áp lực bộ nhớ.

##### Ba cách lưu một bảng

- **Heap**: bảng không có clustered index. Dòng nằm ở trang nào còn chỗ, định danh bằng RID (file:trang:slot). Tìm một dòng phải đọc mọi trang. `UPDATE` làm dòng dài ra mà trang hết chỗ thì dòng bị chuyển đi và để lại *forwarded record*: mỗi lần đọc qua tốn thêm một trang.
- **Clustered index**: một B+ tree mà tầng lá chính là dữ liệu, sắp theo khoá. Tầng trên chỉ chứa khoá và con trỏ, mỗi trang hàng trăm khoá, nên bảng hàng triệu dòng chỉ sâu 3–4 tầng.
- **Nonclustered index**: một B+ tree riêng; tầng lá chứa cột khoá, cột `INCLUDE` và con trỏ về dòng (khoá clustered, hoặc RID nếu bảng là heap).

##### Seek, Scan, Lookup

- **Index Seek**: đi từ gốc xuống lá theo khoá, rồi đọc một dải lá liên tục. Chi phí ≈ số tầng + số trang của dải.
- **Index Scan**: đọc toàn bộ tầng lá.
- **Key Lookup**: seek ở index phụ ra khoá clustered, rồi seek vào clustered index lấy cột thiếu. Mỗi dòng một lần, mỗi lần tốn bằng độ sâu clustered index (thường 3 trang).

Trên `LabPerf`, `Student` có 1 triệu dòng, khoảng 100 dòng mỗi trang, khoảng 9.500 trang lá, sâu 3 tầng:

| `WHERE SchoolId = 500` (40 dòng) | Plan | Logical reads (xấp xỉ) |
|---|---|---|
| Chưa có index trên `SchoolId` | Clustered Index Scan | 9.500 |
| `IX(SchoolId)` | Seek + 40 Key Lookup | 3 + 40 × 3 ≈ 123 |
| `IX(SchoolId) INCLUDE (FullName)` | Seek, không lookup | 3–4 |

##### Điểm bùng phát và covering index

Với `SchoolId = 1` (200.000 dòng), seek + lookup tốn khoảng 600.000 reads, gấp 60 lần đọc cả bảng, nên optimizer chọn Scan. Theo kinh nghiệm, điểm bùng phát rơi vào số dòng khoảng 25–33% **số trang** của bảng: với 9.500 trang chỉ là 2.400–3.100 dòng, tức 0,3% số dòng. Vì vậy index không covering chỉ hữu ích với điều kiện rất chọn lọc.

Covering index chứa đủ mọi cột câu lệnh cần (khoá + `INCLUDE`), không còn lookup, nên kể cả khi số dòng khớp lớn vẫn seek được và chi phí tỷ lệ với số dòng trả về.

```sql
SET STATISTICS IO ON;
SELECT StudentId, FullName FROM dbo.Student WHERE SchoolId = 500;   -- đo trước

CREATE INDEX IX_Student_SchoolId ON dbo.Student (SchoolId);
SELECT StudentId, FullName FROM dbo.Student WHERE SchoolId = 500;   -- seek + lookup

DROP INDEX IX_Student_SchoolId ON dbo.Student;
CREATE INDEX IX_Student_SchoolId_Name ON dbo.Student (SchoolId) INCLUDE (FullName);
SELECT StudentId, FullName FROM dbo.Student WHERE SchoolId = 500;   -- seek, covering
```

`StudentId` không cần `INCLUDE`: index phụ tự mang theo khoá clustered. Dùng mô phỏng ở trên để xem số trang đọc thay đổi theo Scan, Seek, Seek + Lookup và số dòng khớp.

> **Cảnh báo:** `SELECT *` biến mọi index phụ thành không covering. Chọn đúng cột cần.

#### Cách show off

Chất liệu thật:
- Bảng chứng chỉ là heap khoảng 1,6 triệu dòng, không index nào bắt đầu bằng mã người dùng. Proc tra chứng chỉ theo người dùng chạy hàng triệu lần, trung bình gần nửa giây mỗi lần vì lần nào cũng quét cả bảng.
- Bảng thống kê học sinh bị lọc theo mã dịch vụ và trường, nhưng mọi index đều dẫn đầu bằng mã người dùng, nên lần nào cũng scan.
- Vài bảng log rất lớn là heap không index; tìm theo một người dùng nghĩa là đọc hàng GB.
- Cách sửa đã đề xuất; tạo index thuộc phần DBA chạy ca đêm. [điền: các index này đã được tạo chưa, số đo sau]

> **Ví dụ:** "Ca dễ thấy nhất là proc tra chứng chỉ của học sinh: chạy hàng triệu lần, mỗi lần gần nửa giây. Mở plan ra chỉ có một Table Scan, vì bảng chứng chỉ là heap và không có index nào bắt đầu bằng mã người dùng, trong khi truy vấn luôn lọc theo đúng cột đó. Đây là kiểu lỗi mà missing index DMV cũng chỉ ra rất rõ. Tôi đề xuất index dẫn đầu bằng mã người dùng, include các cột proc trả về để khỏi lookup, và đưa vào danh sách DBA chạy ca đêm vì server là Standard Edition. Cái tôi muốn nhấn mạnh là cách xếp hạng: bảng này lên đầu danh sách không phải vì nó to, mà vì chi phí mỗi lần nhân số lần gọi là lớn nhất."

Điểm ăn điểm:
- Giải thích bằng logical reads và độ sâu cây, không chỉ "có index thì nhanh".
- Biết điểm bùng phát: index không covering thường vô dụng với điều kiện kém chọn lọc.
- Nói được heap hợp với chỗ nào và không hợp với chỗ nào.
- Phân biệt đề xuất với kết quả đã đo.

#### Câu hỏi vặn

- **"Có index trên cột lọc mà SQL vẫn scan. Vì sao?"** Năm nguyên nhân hay gặp: điều kiện không SARGable; số dòng khớp vượt điểm bùng phát nên lookup đắt hơn scan; ước lượng sai do statistics; lệch kiểu dữ liệu gây implicit conversion; index không dẫn đầu bằng cột đó. Tôi mở plan thật để biết là cái nào trước khi sửa.
- **"Vì sao đo bằng logical reads mà không bằng thời gian?"** Logical reads không đổi giữa các lần chạy với cùng plan và dữ liệu, không phụ thuộc trang đang ở RAM hay đĩa. Thời gian dao động theo tải, cache, song song. Tôi dùng reads để so plan, dùng thời gian để báo cáo trải nghiệm.
- **"Key Lookup tốn bao nhiêu, khi nào chấp nhận được?"** Mỗi dòng một lần seek vào clustered index, khoảng 3 trang. Vài chục dòng thì chấp nhận được. Số dòng lớn hoặc câu chạy rất dày thì đưa cột vào `INCLUDE` để covering.
- **"Heap hay clustered index, chọn thế nào?"** Bảng được đọc theo khoá và có cập nhật thì dùng clustered index với khoá hẹp, tăng dần, ổn định, unique. Heap chỉ hợp với bảng thuần chèn, đọc toàn bộ, hoặc bảng nạp tạm. Heap bị cập nhật nhiều sinh forwarded record, và mọi tra cứu đều scan.
- **"Bảng chứng chỉ đó sau khi đánh index thì nhanh lên bao nhiêu?"** Phần tôi làm là phân tích và đề xuất; việc tạo index giao DBA trong khung đêm. Tôi chỉ nói con số khi có số đo sau: reads và CPU trung bình của proc trong DMV, so cùng khung giờ. Về lý thuyết, từ scan cả bảng sang seek theo một người dùng sẽ giảm reads nhiều bậc độ lớn.

#### Bẫy cần tránh

- Nghĩ Seek luôn rẻ: seek trên dải rộng hoặc seek kèm hàng chục nghìn lookup có thể đắt hơn scan.
- Đo bằng thời gian chạy trong SSMS ở máy dev: cache nóng lạnh làm số dao động.
- Nói "missing index báo cải thiện 99% nên tôi tạo ngay": gợi ý DMV cần được gộp và đối chiếu trước.

#### Nhớ nhanh

- Trang 8 KB; logical reads là thước đo chính.
- Clustered: dữ liệu ở lá; nonclustered: khoá + con trỏ (khoá clustered hoặc RID).
- Seek ≈ số tầng + dải lá; Scan ≈ toàn bộ lá; Lookup ≈ 3 trang mỗi dòng.
- Điểm bùng phát rất thấp; covering index loại bỏ lookup.

#### Bài tập

1. Chạy ba bước trong script của bài (không index, index thường, covering), ghi logical reads mỗi bước. Lặp lại với `SchoolId = 1`.
   **Đáp án:** Trường 500: khoảng 9.500 → 120 → 3–4 reads. Trường 1: index thường không được dùng (scan khoảng 9.500 reads); covering index được dùng, khoảng 200.000 / (150–160 dòng mỗi trang lá) ≈ 1.200–1.300 reads, vẫn ít hơn scan cả bảng.
2. Xem độ sâu và số trang của các index trên `Student` bằng `sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('dbo.Student'), NULL, NULL, 'DETAILED')`.
   **Đáp án:** Lọc `index_level = 0` để có số trang lá; `index_depth` thường là 3. Từ đó tính lại chi phí seek và lookup để khớp với `STATISTICS IO`.
3. Tạo bản heap `SELECT * INTO dbo.StudentHeap FROM dbo.Student;`, tạo index phụ trên `SchoolId`, so plan và reads của truy vấn trường 500 trên heap và trên bảng gốc.
   **Đáp án:** Trên heap, lookup là RID Lookup: đi thẳng tới trang theo RID, khoảng 1 trang mỗi dòng (thêm nếu có forwarded record), tổng khoảng 3 + 40 ≈ 43 reads. Lookup trên heap rẻ hơn, nhưng heap mất khả năng tra theo khoá và dễ phân mảnh khi cập nhật.

### Bài 18.2. Thiết kế composite và covering index theo truy vấn
**Viz:** index-order

#### Kiến thức

##### Index nhiều cột sắp như danh bạ

Index `(ProvinceId, Grade, CreatedAt)` sắp theo tỉnh, trong cùng tỉnh sắp theo khối, trong cùng khối sắp theo thời gian tạo. Giống danh bạ sắp theo họ rồi tên: tìm theo họ được, theo họ + tên được, chỉ theo tên thì phải đọc cả cuốn. Seek chỉ dùng được trên **tiền tố liên tục từ cột đầu**: `WHERE Grade = 6` không seek được trên `(ProvinceId, Grade)`. SQL Server không có skip-scan tự động.

##### Bằng trước, phạm vi sau

Với `WHERE ProvinceId = @p AND CreatedAt >= @from AND Grade = @g`:
- `(ProvinceId, Grade, CreatedAt)`: Seek Predicate dùng cả ba cột, dải đọc đúng bằng số dòng khớp.
- `(ProvinceId, CreatedAt, Grade)`: seek theo tỉnh và dải thời gian, còn `Grade` chỉ lọc từng dòng; đọc gấp khoảng 12 lần nếu có 12 khối.

Sau cột phạm vi đầu tiên, các cột sau không giới hạn được dải đọc nữa.

##### Cột `ORDER BY` ngay sau cột bằng

Index đã sắp theo `CreatedAt` trong cùng (tỉnh, khối) thì `ORDER BY CreatedAt DESC` không cần Sort, chỉ cần đọc ngược dải. Có `TOP (20)` thì đọc 20 dòng rồi dừng: không Sort, không memory grant, chi phí gần như không đổi dù tỉnh có hàng trăm nghìn học sinh.

```sql
-- 20 học sinh mới nhất của một tỉnh, một khối
SELECT TOP (20) StudentId, FullName, CreatedAt
FROM dbo.Student
WHERE ProvinceId = @p AND Grade = @g
ORDER BY CreatedAt DESC;

-- (1) Chỉ ProvinceId: seek tỉnh, lọc khối từng dòng, Sort, lookup
CREATE INDEX IX_S_P ON dbo.Student (ProvinceId);
-- (2) ProvinceId, Grade: seek đúng, nhưng vẫn Sort cả dải trước khi lấy 20
CREATE INDEX IX_S_PG ON dbo.Student (ProvinceId, Grade);
-- (3) Đúng: bằng, bằng, rồi cột ORDER BY; INCLUDE cột trả về
CREATE INDEX IX_S_PG_Created ON dbo.Student (ProvinceId, Grade, CreatedAt DESC) INCLUDE (FullName);
```

Với tỉnh 1 (khoảng 212.000 học sinh, khoảng 17.700 mỗi khối), (2) phải đọc khoảng 17.700 dòng rồi Sort và lookup (hoặc chuyển sang scan vì vượt điểm bùng phát); (3) đọc 3–4 trang.

##### Key hay `INCLUDE`, và filtered index

- Cột trong key được sắp, dùng cho seek và `ORDER BY`, nhưng làm các tầng trên to ra và mọi `UPDATE` cột đó phải di chuyển dòng trong index. Cột chỉ cần trả về đặt ở `INCLUDE`: chỉ nằm ở tầng lá. Giới hạn key nonclustered: 1.700 byte (clustered 900 byte).
- Index phụ tự mang khoá clustered: không cần thêm `StudentId`. Index không unique thì khoá clustered nằm cuối key, dùng được cho `ORDER BY`.
- **Filtered index** (`... WHERE Status = 1`) nhỏ, rẻ khi ghi, statistics chính xác cho tập con. Nhưng với truy vấn tham số hoá (`WHERE Status = @s`), plan dùng lại phải đúng cho mọi giá trị nên optimizer **không dùng** filtered index; cần literal trong câu lệnh hoặc `OPTION (RECOMPILE)`.

> **Mẹo:** Viết index từ truy vấn: cột so sánh bằng trong `WHERE`/`JOIN` → cột `ORDER BY` (nếu muốn bỏ Sort) hoặc cột phạm vi → cột trả về vào `INCLUDE`. Trong nhóm cột bằng, chọn thứ tự để tiền tố dùng chung được cho nhiều truy vấn khác. Luôn xem index đang có trước (`sp_BlitzIndex`): sửa index cũ thường tốt hơn thêm một index gần trùng.

#### Cách show off

Chất liệu thật:
- Bảng kết quả luyện nói có index `(vòng, mã đề mở, mã người dùng)` nhưng truy vấn lọc theo vòng và người dùng. Index chỉ seek được theo vòng, rồi lọc tuần tự mấy triệu dòng của vòng đó, khoảng 20 nghìn trang mỗi lần. Hệ thống luyện viết, cùng kiểu truy vấn, có index đúng `(vòng, mã người dùng)` và chỉ đọc vài chục trang.
- Bảng xếp hạng vòng hiện tại lọc theo năm, khối, tỉnh rồi sắp theo hạng tỉnh, nhưng index có sẵn thiếu khối và không có cột hạng, nên đọc rộng rồi Sort.

> **Ví dụ:** "Có một ca tôi hay dùng để giải thích thứ tự cột. Bảng kết quả luyện nói có index ba cột: vòng, mã đề, mã người dùng; còn truy vấn lọc theo vòng và người dùng. Vì cột giữa không có trong điều kiện, SQL chỉ seek được theo vòng rồi phải lọc tuần tự hàng triệu dòng, khoảng 20 nghìn trang mỗi lần gọi. Điều buồn cười là hệ thống luyện viết, cùng kiểu truy vấn, có index đúng thứ tự vòng rồi người dùng và chỉ đọc vài chục trang. Cùng dữ liệu, cùng cột, chỉ khác thứ tự. Tôi đề xuất sửa index cũ thay vì thêm index mới, để không tăng chi phí ghi."

Điểm ăn điểm:
- Có ví dụ so sánh cùng kiểu truy vấn, khác thứ tự cột: thuyết phục hơn mọi định nghĩa.
- Nhắc chi phí ghi khi đề xuất index, và ưu tiên sửa index cũ.
- Biết giới hạn filtered index với proc tham số hoá.
- Quyết định bằng số dòng thật, không bằng quy tắc thuộc lòng.

#### Câu hỏi vặn

- **"`WHERE a = @a AND b > @b ORDER BY c`. Chọn index nào?"** `(a, b)` seek hẹp nhưng vẫn phải Sort; `(a, c) INCLUDE (b)` bỏ Sort nhưng lọc b sau khi đọc. Có `TOP` nhỏ và b lọc ít thì chọn `(a, c)`; b lọc mạnh thì chọn `(a, b)`. Tôi quyết bằng số dòng thật, không bằng quy tắc.
- **"Index `(a, b)` có giúp được `WHERE b = @b` không?"** Không seek được, vì giá trị b nằm rải rác trong từng nhóm a. Optimizer có thể scan index đó vì nó hẹp hơn bảng, nhưng không seek. Truy vấn đó quan trọng thì cần index dẫn đầu bằng b.
- **"Khi nào đưa cột vào key, khi nào vào `INCLUDE`?"** Key khi cột dùng để seek, join hoặc sắp thứ tự. `INCLUDE` khi cột chỉ cần trả về: chỉ nằm ở lá, không làm to tầng trên, cập nhật cột đó không phải di chuyển dòng trong index.
- **"Đã tạo filtered index `WHERE Status = 1` mà proc không dùng. Vì sao?"** Proc lọc bằng tham số `@Status`; plan cache phải đúng cho mọi giá trị nên optimizer không chọn index chỉ đúng với Status = 1. Viết literal nếu nghiệp vụ luôn lọc như vậy, tách nhánh, hoặc `OPTION (RECOMPILE)`.
- **"Bảng xếp hạng có 4 cấp hạng, sao không làm 4 index, mỗi cái include 10 cột?"** Mỗi index là một lần ghi nữa cho mỗi dòng; job xếp hạng ghi lại bảng sẽ ghi gấp khoảng 5 lần. Chấp nhận được nếu bảng chỉ ghi theo lô ban đêm; không ổn nếu ghi liên tục. Tôi sẽ hỏi bảng được ghi khi nào trước khi chốt.
- **"Vì sao index đúng cho `TOP 20 ORDER BY` lại quan trọng hơn bình thường?"** Không có index sắp đúng, SQL phải đọc hết tập khớp và Sort trước khi trả 20 dòng, kèm memory grant. Có index đúng thì đọc 20 dòng rồi dừng, chi phí không phụ thuộc kích thước tập khớp.

#### Bẫy cần tránh

- Thêm index mới gần trùng index cũ thay vì sửa index cũ.
- Tạo filtered index rồi tin là proc dùng: kiểm tra plan thật.
- `INCLUDE` cột `nvarchar(max)` làm index phình to.

#### Nhớ nhanh

- Seek theo tiền tố bên trái; cột bằng trước, cột phạm vi sau.
- Cột `ORDER BY` ngay sau các cột bằng để bỏ Sort; `TOP N` đọc N dòng rồi dừng.
- `INCLUDE` cho cột chỉ trả về; index phụ tự mang khoá clustered.
- Filtered index không hợp với truy vấn tham số hoá.

#### Bài tập

1. Tạo lần lượt ba index (1), (2), (3) của bài (xoá index trước khi tạo index sau), chạy truy vấn `TOP (20)` với `@p = 1, @g = 6` qua `sp_executesql`. Ghi plan và reads.
   **Đáp án:** (1) Seek tỉnh hoặc scan, có Sort và lookup, hàng nghìn tới gần 10 nghìn reads; (2) Seek đúng nhưng có Top N Sort và lookup, hoặc chuyển sang scan; (3) Seek + Top, không Sort, 3–4 reads.
   ```sql
   EXEC sp_executesql N'SELECT TOP (20) StudentId, FullName, CreatedAt
     FROM dbo.Student WHERE ProvinceId = @p AND Grade = @g ORDER BY CreatedAt DESC;',
     N'@p SMALLINT, @g TINYINT', @p = 1, @g = 6;
   ```
2. Trên `ExamResult`: (A) `WHERE RoundId = @r AND StudentId = @s`; (B) `WHERE RoundId = @r ORDER BY Score DESC` lấy `TOP (100)`. Một index có phục vụ tốt cả hai không?
   **Đáp án:** Không, hai câu cần thứ tự khác nhau sau `RoundId`. Nếu (A) chạy rất nhiều, chọn `(StudentId, RoundId)` (mỗi học sinh chỉ 2 bài) và `(RoundId, Score DESC) INCLUDE (StudentId)` cho bảng xếp hạng; cân nhắc chi phí ghi của bảng.
3. Tạo `CREATE INDEX IX_S_Inactive ON dbo.Student (SchoolId) WHERE Status = 0;`. So plan của `WHERE Status = 0 AND SchoolId = 500` (literal) và cùng câu qua `sp_executesql` với `@st = 0`.
   **Đáp án:** Literal dùng filtered index, rất ít reads. Câu tham số hoá không dùng được; plan có thể có cảnh báo `UnmatchedIndexes`. Thêm `OPTION (RECOMPILE)` thì dùng lại được.

### Bài 18.3. Chi phí ghi: write amplification, page split, hotspot
**Viz:** write-cost

#### Kiến thức

##### Mỗi index là một lần ghi nữa

Mỗi index là một B-tree riêng. `INSERT` một dòng vào bảng có clustered index và N index phụ là N + 1 lần chèn vào N + 1 cây, mỗi lần sinh bản ghi log. `UPDATE` chỉ chạm index chứa cột bị sửa, nhưng sửa khoá clustered thì dòng di chuyển và **mọi** index phụ phải cập nhật con trỏ. Commit phải chờ log ghi xuống đĩa (`WRITELOG`), nên log nhiều hơn là commit chậm hơn.

##### Page split và `FILLFACTOR`

Chèn một khoá vào giữa trang lá đã đầy: SQL Server cấp trang mới, chuyển khoảng nửa số dòng sang, sửa liên kết và trang cha, tất cả đều ghi log, để lại hai trang nửa rỗng. Khoá ngẫu nhiên (`NEWID()`, mã người dùng không theo thứ tự chèn) gây split liên tục. `FILLFACTOR` chừa chỗ trống **lúc tạo hoặc rebuild** (90 là chừa 10%) để lần chèn giữa trang có chỗ; hết chỗ thì vô tác dụng tới lần rebuild sau, và làm index to hơn.

##### Khoá tăng dần và điểm nóng trang cuối

`IDENTITY`, `SEQUENCE`, thời gian: dòng mới luôn vào cuối, không split giữa trang. Nhưng mọi luồng chèn cùng tranh một trang cuối, mỗi luồng phải giữ latch độc quyền trên trang đó, sinh `PAGELATCH_EX`. Với hàng nghìn insert mỗi giây trên nhiều lõi, đây là nút cổ chai. Cách giảm:
- `OPTIMIZE_FOR_SEQUENTIAL_KEY = ON` (2019+): điều tiết luồng vào trang cuối để throughput không sụp khi tranh chấp cao. Không xoá latch; một phần wait chuyển sang `BTREE_INSERT_FLOW_CONTROL`.
- Rải chèn: partition theo hash hoặc khoá có cột rải ở đầu (mất khả năng đọc theo dải).
- Gom nhiều dòng vào một lệnh chèn.

##### Phân loại bảng trước khi chọn index

| Loại bảng | Ví dụ | Chiến lược |
|---|---|---|
| Thuần ghi | Log thao tác thi | Clustered tăng dần (hoặc heap), không index phụ trên DB chính; tra cứu ở replica hoặc kho dữ liệu |
| Ghi dồn rồi đọc tổng kết | Kết quả theo ca thi | Partition theo ca/ngày; đánh index khi ca kết thúc |
| Đọc-ghi liên tục | Hồ sơ người dùng, số dư | Ít index, covering gọn cho đúng truy vấn nóng |

##### Đo chi phí ghi

```sql
-- Lượng log một thao tác sinh ra
BEGIN TRAN;
INSERT dbo.ExamResult (StudentId, RoundId, Score, SubmittedAt)
SELECT TOP (10000) StudentId, 11, 100, SYSDATETIME() FROM dbo.Student;
SELECT database_transaction_log_bytes_used
FROM sys.dm_tran_database_transactions WHERE database_id = DB_ID();
ROLLBACK;

-- Split và latch theo index
SELECT i.name, os.leaf_insert_count, os.leaf_allocation_count, os.nonleaf_allocation_count,
       os.page_latch_wait_count, os.page_latch_wait_in_ms
FROM sys.dm_db_index_operational_stats(DB_ID(), OBJECT_ID('dbo.ExamResult'), NULL, NULL) os
JOIN sys.indexes i ON i.object_id = os.object_id AND i.index_id = os.index_id;
```

`leaf_allocation_count` đếm cả cấp trang mới ở cuối lẫn split giữa trang; so với số insert và kiểu khoá để diễn giải. Dùng mô phỏng ở trên để thấy lượng ghi tăng theo số index và kiểu khoá.

#### Cách show off

Chất liệu thật:
- Ở cụm kho dữ liệu, bảng kết quả vòng có 7 index phụ, bảng thống kê vòng có 9, trong khi hai bảng nhận cỡ hai chục triệu lượt ghi mỗi ngày.
- Bảng người dùng cỡ trăm triệu dòng có 13 index; một bảng log có index trùng tiền tố với khoá chính, thừa vài trăm MB.
- Bảng log thao tác thi ghi liên tục: báo cáo đề xuất không thêm index phụ nào trên DB chính, tra cứu ở chỗ khác.
- Một đề xuất cần tự sửa lại: "thêm cột identity tuần tự để hết tranh chấp chèn". Identity bỏ được page split nhưng lại dồn mọi luồng vào trang cuối.

> **Ví dụ:** "Khi người ta hỏi sao không đánh index hết cho nhanh, tôi kể về cụm kho dữ liệu. Hai bảng kết quả và thống kê vòng thi có bảy, chín index phụ, mà mỗi ngày nhận hàng chục triệu lượt ghi; mỗi lượt ghi là chừng ấy cây B-tree phải cập nhật, chừng ấy bản ghi log phải xuống đĩa. Vì vậy tôi phân loại bảng trước: bảng log thuần ghi thì giữ đường ghi gọn, tra cứu chuyển sang replica hoặc kho; bảng đọc-ghi thì gộp các index gần trùng. Tôi cũng phải sửa một đề xuất cũ của chính mình về cột identity: nó hết page split thật, nhưng dồn mọi luồng chèn vào một trang cuối, nên phải đo latch và cân nhắc `OPTIMIZE_FOR_SEQUENTIAL_KEY`."

Điểm ăn điểm:
- Nói về index bằng cả hai phía đọc và ghi; người junior chỉ nói phía đọc.
- Phân loại bảng theo cách dùng rồi mới chọn chiến lược.
- Biết khoá tăng dần đổi page split lấy điểm nóng trang cuối.
- Xoá index cũng cần bằng chứng đủ chu kỳ nghiệp vụ.

#### Câu hỏi vặn

- **"Sao không đánh index hết cho nhanh?"** Mỗi index thêm một lần ghi B-tree và log cho mỗi insert, update, delete. Index trên khoá ngẫu nhiên còn gây page split. Bảng ghi liên tục mà nhiều index sẽ tăng `WRITELOG`, latch và thời gian giữ khoá. Index phải được trả bằng lượng đọc nó tiết kiệm.
- **"Bảng log 5.000 insert mỗi giây, CMS cần tra theo người dùng. Làm sao?"** DB chính giữ đường ghi nhanh: clustered tăng dần, không index phụ. Tra cứu ở replica hoặc kho dữ liệu có index theo người dùng. Hoặc partition theo ngày, chỉ đánh index các partition đã đóng.
- **"Page split là gì, `FILLFACTOR` giúp khi nào?"** Chèn vào giữa trang đầy: cấp trang mới, chuyển nửa số dòng, ghi log toàn bộ, để lại hai trang nửa rỗng. `FILLFACTOR` chừa chỗ lúc rebuild, giúp với khoá chèn ngẫu nhiên khi có rebuild định kỳ; không giúp chèn vào cuối và tốn thêm trang để đọc.
- **"Dùng GUID làm clustered key có vấn đề gì?"** `NEWID()` ngẫu nhiên nên chèn rải khắp index: split nhiều, trang nửa rỗng, phân mảnh; khoá 16 byte còn bị chép vào mọi index phụ. Cần GUID thì để nó làm khoá phụ unique, clustered theo cột tăng dần, hoặc sinh GUID tuần tự ở app.
- **"`OPTIMIZE_FOR_SEQUENTIAL_KEY` có xoá được `PAGELATCH_EX` không?"** Không. Nó điều tiết luồng vào trang cuối để latch không bị trao cho luồng đang chậm, giảm sụp throughput khi tranh chấp cao. Phải đo lại; vẫn nghẽn thì rải khoá hoặc partition.

#### Bẫy cần tránh

- Hạ `FILLFACTOR` cho mọi index "để đỡ split": index to ra, đọc nhiều hơn, chỗ trống hết sau vài giờ ghi.
- Xoá index chỉ dựa trên `index_usage_stats` sau một lần restart gần đây.
- Khuyên "thêm identity" mà không nhắc điểm nóng trang cuối.

#### Nhớ nhanh

- N index phụ = N + 1 lần ghi B-tree và log cho mỗi insert.
- Khoá ngẫu nhiên → page split; khoá tăng dần → điểm nóng trang cuối.
- `FILLFACTOR` chỉ có tác dụng từ lúc rebuild, không giúp chèn cuối.
- Phân loại bảng (thuần ghi, ghi dồn, đọc-ghi) rồi mới chọn index.

#### Bài tập

1. Tạo hai bảng giống `ExamResult`: một bảng chỉ có PK, một bảng thêm 5 index phụ (`StudentId`, `RoundId`, `Score`, `SubmittedAt`, `(RoundId, Score)`). Chèn 200.000 dòng vào mỗi bảng trong một transaction, đo `database_transaction_log_bytes_used` và thời gian.
   **Đáp án:** Bảng có 5 index phụ sinh log gấp nhiều lần (thường 3–5 lần) và chậm hơn tương ứng. Chênh lệch là chi phí ghi phải trả cho mỗi index.
2. Tạo `CREATE TABLE dbo.T_Guid (Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY, Pad CHAR(200) NOT NULL DEFAULT 'x');` và bảng tương tự với `Id INT IDENTITY`. Chèn 100.000 dòng theo lô 1.000, so `avg_fragmentation_in_percent`, `avg_page_space_used_in_percent`, `page_count`.
   **Đáp án:** Bảng GUID phân mảnh gần 99%, trang đầy khoảng 60–70%, nhiều trang hơn; bảng identity phân mảnh gần 0, trang gần đầy. Lấy số bằng `sys.dm_db_index_physical_stats(..., 'DETAILED')`.
3. Bảng 40 triệu dòng có: PK `(OrderId)`, `IX1 (CustomerId)`, `IX2 (CustomerId, CreatedAt)`, `IX3 (Status)` (3 giá trị), `IX4 (CreatedAt)` với 0 seek và 9 triệu update sau 60 ngày uptime. Đề xuất xoá index nào?
   **Đáp án:** `IX1` thừa vì trùng tiền tố với `IX2`. `IX4` là ứng viên xoá (kiểm tra thêm `user_scans` và báo cáo cuối kỳ). `IX3` độ chọn lọc thấp, thường vô ích trừ khi là filtered index cho trạng thái hiếm. Giữ script tạo lại trước khi xoá.

### Bài 18.4. Tạo và bảo trì index an toàn trên production

#### Kiến thức

##### Thao tác offline khoá gì

Theo tài liệu SQL Server: tạo nonclustered index offline giữ khoá Shared (S) trên bảng suốt thời gian tạo, nên mọi `INSERT/UPDATE/DELETE` bị chặn (đọc vẫn được). Tạo, rebuild, xoá clustered index, hoặc rebuild, xoá nonclustered index offline giữ khoá Schema modification (Sch-M), chặn cả đọc lẫn ghi. Với bảng ghi liên tục, chặn ghi vài chục phút là sự cố.

##### Online không có nghĩa là không khoá

`WITH (ONLINE = ON)` cho đọc ghi bình thường trong lúc tạo hoặc rebuild, chỉ cần khoá ngắn lúc đầu và lúc cuối. Khoá cuối (Sch-M với rebuild hay thao tác trên clustered index; S với tạo mới nonclustered) phải chờ các transaction đang giữ khoá xung đột kết thúc, và trong lúc chờ nó chặn các truy vấn mới xếp sau: một báo cáo chạy dài có thể làm cả bảng đứng. `WAIT_AT_LOW_PRIORITY` (cho `ALTER INDEX ... REBUILD` online và chuyển partition) cho thao tác chờ ở hàng ưu tiên thấp và chọn hành động khi hết giờ.

##### Edition quyết định cách làm

`ONLINE = ON`, `RESUMABLE`, thao tác index song song là tính năng Enterprise (Developer và Azure SQL cũng có). Trên Standard, `ONLINE = ON` báo lỗi và index được tạo đơn luồng. Kiểm tra trước:

```sql
SELECT SERVERPROPERTY('Edition') AS edition, SERVERPROPERTY('ProductVersion') AS version,
       SERVERPROPERTY('EngineEdition') AS engine_edition;  -- 3 = Enterprise/Developer, 2 = Standard
```

Tuỳ chọn khác: `RESUMABLE = ON` (kèm `ONLINE`; rebuild từ 2017, create từ 2019) cho tạm dừng và tiếp tục, có `MAX_DURATION`; `SORT_IN_TEMPDB = ON` sort trung gian ở tempdb; `MAXDOP` giới hạn số lõi; `DATA_COMPRESSION` có ở mọi edition từ 2016 SP1.

##### Dung lượng và log

Tạo index cần chỗ cho chính index mới, chỗ sort (trong DB hoặc tempdb), và log. Ở recovery model FULL, tạo index được log đầy đủ, log có thể lớn cỡ kích thước index; có Availability Group hay log shipping thì lượng log đó còn phải đẩy sang replica.

##### Bảo trì định kỳ

- Reorganize: sắp lại trang lá tại chỗ, luôn online, dừng được, không cập nhật statistics.
- Rebuild: dựng lại toàn bộ, cập nhật statistics của index bằng FULLSCAN, offline trên Standard.
- Ngưỡng 5%/30% phân mảnh là quy tắc kinh nghiệm cũ. Trên SSD, phân mảnh logic ít ảnh hưởng; mật độ trang và statistics quan trọng hơn. Ưu tiên cập nhật statistics thường xuyên, rebuild có chọn lọc (Ola Hallengren `IndexOptimize`).

##### `ALTER PROCEDURE`

Cần khoá Sch-M rất ngắn trên proc. Xong thì plan cũ bị loại, lần gọi sau compile theo tham số của lần gọi đó (rủi ro sniffing), và số liệu của proc trong DMV bắt đầu lại từ 0. Vì vậy sửa proc thường làm được trong ngày, còn index trên bảng lớn thì không.

```sql
-- Mẫu trên Enterprise/Developer
CREATE INDEX IX_ExamResult_Student ON dbo.ExamResult (StudentId) INCLUDE (RoundId, Score)
WITH (ONLINE = ON, RESUMABLE = ON, MAX_DURATION = 60 MINUTES, MAXDOP = 4);
SELECT name, percent_complete, state_desc FROM sys.index_resumable_operations;
-- ALTER INDEX IX_ExamResult_Student ON dbo.ExamResult PAUSE;
-- ALTER INDEX IX_ExamResult_Student ON dbo.ExamResult RESUME;
-- Rollback: DROP INDEX IX_ExamResult_Student ON dbo.ExamResult;
```

##### Checklist trước khi tạo index trên bảng lớn

- [ ] Kiểm tra edition và version của đúng cụm sẽ chạy.
- [ ] Kích thước bảng và index dự kiến (`sp_spaceused`, `sys.dm_db_partition_stats`).
- [ ] Đủ chỗ cho data file, log (và replica nếu có), tempdb nếu `SORT_IN_TEMPDB`.
- [ ] Khung giờ: Standard thì trong khung bảo trì; Enterprise vẫn tránh giờ cao điểm.
- [ ] Script rollback và script kiểm tra kết quả viết sẵn.
- [ ] Số đo trước (reads, CPU của proc mục tiêu) và lịch đo sau.
- [ ] Theo dõi blocking trong lúc chạy (`sp_WhoIsActive`), sẵn sàng huỷ.

#### Cách show off

Chất liệu thật:
- Các cụm chạy Standard Edition, nên kế hoạch xử lý chia hai tầng: sửa proc bằng `ALTER PROCEDURE` trong ngày; index giao DBA chạy trong khung 23h–05h.
- Bảng archive của các ca thi đã kết thúc là bảng tĩnh, tạo index gần như không ảnh hưởng ghi, nên được ưu tiên trước.
- Một lỗi trong chính báo cáo: vài script index có `WITH (ONLINE = ON)`, chạy trên Standard sẽ báo lỗi.
- [điền: DBA đã chạy đợt index ca đêm chưa, chạy những bảng nào, số đo sau]

> **Ví dụ:** "Khi lên kế hoạch sửa, ràng buộc lớn nhất không phải kỹ thuật mà là edition. Các server chạy Standard, không có online index, nên tạo index trên bảng trăm triệu dòng giữa ca thi là khoá bảng, request ghi xếp hàng, worker cạn dần, API timeout dây chuyền. Vì vậy tôi chia hai tầng: thứ gì sửa được bằng proc thì deploy trong ngày vì `ALTER PROCEDURE` chỉ cần khoá rất ngắn; index thì gom thành danh sách cho DBA chạy ca đêm, mỗi mục có script rollback và số đo trước. Rà lại, tôi phát hiện vài script trong chính báo cáo còn ghi `ONLINE = ON`, chạy trên Standard sẽ lỗi, nên đã sửa trước khi giao."

Điểm ăn điểm:
- Kiểm tra edition trước khi viết script. Nghe đơn giản nhưng rất nhiều người không làm.
- Biết online vẫn có khoá cuối, và biết khoá đó có thể chặn cả bảng.
- Có checklist: dung lượng, log, replica, rollback, số đo trước sau.
- Biết `ALTER PROCEDURE` reset số liệu DMV và gây compile lại.

#### Câu hỏi vặn

- **"Tạo index trên bảng 120 triệu dòng, Standard Edition, giữa ca thi thì sao?"** Tạo offline giữ khoá tới khi xong: mọi lệnh ghi phải chờ, với clustered index thì cả đọc. Truy vấn chờ khoá chiếm worker, dẫn tới `THREADPOOL` và API timeout dây chuyền. Chỉ làm trong khung bảo trì.
- **"`ONLINE = ON` thì hoàn toàn không khoá phải không?"** Không. Có khoá ngắn lúc đầu và lúc cuối. Khoá cuối phải chờ truy vấn đang giữ khoá xung đột xong và chặn truy vấn mới trong lúc chờ. Dùng `WAIT_AT_LOW_PRIORITY` khi rebuild và chọn thời điểm ít truy vấn dài.
- **"Rebuild hay reorganize? Ngưỡng 30% còn đúng không?"** Reorganize online, nhẹ, dừng được; rebuild dựng lại toàn bộ, cập nhật statistics FULLSCAN, offline trên Standard. Ngưỡng 5%/30% là quy tắc cũ; trên SSD tôi ưu tiên statistics và mật độ trang, rebuild có chọn lọc.
- **"Deploy `ALTER PROCEDURE` giữa ngày có an toàn không?"** Thường an toàn vì khoá Sch-M rất ngắn. Hệ quả cần biết: plan compile lại theo tham số của lần gọi đầu sau deploy, và số liệu DMV của proc reset. Ghi số trước khi deploy và theo dõi plan mới.
- **"Tạo index trên bảng lớn cần chuẩn bị dung lượng gì?"** Chỗ cho index mới, chỗ sort (data file hoặc tempdb), và log; ở FULL recovery log có thể xấp xỉ kích thước index, cộng thời gian đẩy sang replica. Kiểm tra trước để không tràn log giữa chừng.
- **"Đợt index ca đêm đó đã chạy chưa, kết quả thế nào?"** Trả lời theo trạng thái thật. Phần của tôi là danh sách ưu tiên, script và cách kiểm tra; việc chạy thuộc DBA. Chưa có số đo sau thì nói rõ chưa có, và nói sẽ đo bằng reads, CPU của proc mục tiêu cùng khung giờ.

#### Bẫy cần tránh

- Viết `ONLINE = ON` mà không kiểm tra edition của cụm sẽ chạy.
- Rebuild mọi index mỗi đêm "cho chắc": log lớn, replica trễ, lợi ích nhỏ trên SSD.
- Nói "đã đánh index xong" khi chưa hỏi lại DBA.

#### Nhớ nhanh

- Offline: tạo nonclustered chặn ghi; thao tác clustered chặn cả đọc và ghi.
- Online, resumable, song song là tính năng Enterprise.
- Online vẫn có khoá ngắn lúc đầu và lúc cuối.
- Checklist: edition, dung lượng, khung giờ, rollback, số đo trước và sau.
- Sửa proc trong ngày, index bảng lớn trong khung bảo trì.

#### Bài tập

1. Chạy truy vấn `SERVERPROPERTY` trên server dev. Viết `CREATE INDEX` cho `ExamResult(RoundId, Score DESC) INCLUDE (StudentId)` hai phiên bản: Enterprise/Developer và Standard.
   **Đáp án:** Bản Enterprise như mẫu trong bài. Bản Standard bỏ `ONLINE`, `RESUMABLE`, `MAX_DURATION`, `MAXDOP`; có thể thêm `SORT_IN_TEMPDB = ON` nếu tempdb đủ chỗ; ghi chú chạy trong khung bảo trì, kèm `DROP INDEX` để rollback.
2. Mô phỏng khoá cuối của thao tác online (Developer Edition): tạo sẵn `IX_ExamResult_Student` như mẫu. Phiên 1 chạy `BEGIN TRAN; SELECT COUNT(*) FROM dbo.ExamResult WITH (HOLDLOCK);` (chưa commit); phiên 2 chạy `ALTER INDEX IX_ExamResult_Student ON dbo.ExamResult REBUILD WITH (ONLINE = ON);`; phiên 3 chạy một `SELECT` bất kỳ trên `ExamResult`. Quan sát wait của phiên 2 và 3.
   **Đáp án:** Phiên 2 dựng xong rồi chờ khoá Sch-M (`LCK_M_SCH_M`) vì phiên 1 còn giữ khoá. Phiên 3 bị chặn sau phiên 2 (`LCK_M_SCH_S`). Commit phiên 1 thì cả hai chạy tiếp. Thử lại với `WITH (ONLINE = ON (WAIT_AT_LOW_PRIORITY (MAX_DURATION = 1 MINUTES, ABORT_AFTER_WAIT = SELF)))`: phiên 3 không còn bị chặn.
3. Liệt kê index trên `LabPerf` có `page_count > 1000` kèm `avg_fragmentation_in_percent` và `avg_page_space_used_in_percent`, đề xuất hành động cho từng dòng.
   **Đáp án:** `sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'SAMPLED')` join `sys.indexes`. Mật độ trang thấp (dưới khoảng 70%) và index lớn: rebuild trong khung bảo trì; phân mảnh cao nhưng mật độ tốt: reorganize hoặc bỏ qua trên SSD; statistics cập nhật theo `modification_counter`.

## Chương 19. Viết truy vấn để optimizer hiểu

Index đúng mà truy vấn viết sai thì vẫn scan; ước lượng sai thì vẫn chọn plan sai. Chương này đi qua các nguyên nhân nằm ở phía truy vấn: điều kiện không SARGable, statistics cũ và ước lượng lệch, parameter sniffing, memory grant và spill, cách truyền và giữ dữ liệu trung gian (bảng biến, bảng tạm, TVP, JSON), và cách viết theo tập thay vì từng dòng.

Đây là phần người phỏng vấn dùng để phân biệt người hiểu optimizer với người thuộc mẹo. Câu hỏi thường mở bằng một triệu chứng: "proc lúc nhanh lúc chậm", "có index mà vẫn scan", "SQL Server 2019 rồi còn cần #temp không", "phân trang trang 5.000 chậm". Học xong chương, bạn giải thích được từng triệu chứng bằng cơ chế, đưa ra vài cách sửa và nói được cái giá của mỗi cách.

### Bài 19.1. Điều kiện SARGable
**Viz:** sargable

#### Kiến thức

##### SARGable là gì

SARGable (Search ARGument-able) là điều kiện mà optimizer chuyển được thành một dải giá trị trên khoá index, dạng `cột <so sánh> biểu thức không phụ thuộc cột`. Với `WHERE SchoolId = @s`, optimizer biết đi xuống B-tree tới đúng `@s`. Với `WHERE ABS(SchoolId) = @s`, giá trị `ABS(SchoolId)` không được sắp trong index nên không biết bắt đầu từ đâu: phải đọc từng dòng, tính hàm, rồi so.

| Không SARGable | Viết lại |
|---|---|
| `WHERE YEAR(CreatedAt) = 2025` | `WHERE CreatedAt >= '20250101' AND CreatedAt < '20260101'` |
| `WHERE DATEADD(DAY, 7, CreatedAt) > SYSDATETIME()` | `WHERE CreatedAt > DATEADD(DAY, -7, SYSDATETIME())` |
| `WHERE ISNULL(Status, 0) = 0` | `WHERE (Status = 0 OR Status IS NULL)` |
| `WHERE LEFT(Phone, 4) = '0900'` | `WHERE Phone LIKE '0900%'` |
| `WHERE CONVERT(NVARCHAR(20), StudentId) = @s` | `WHERE StudentId = TRY_CONVERT(INT, @s)` |
| `WHERE 1 = CASE WHEN Grade = @g THEN 1 END` | `WHERE Grade = @g` |

Biểu thức nghiệp vụ cố định không viết lại được thì tạo computed column và index nó; optimizer khớp được biểu thức trong truy vấn với computed column.

##### Lệch kiểu dữ liệu

So hai kiểu khác nhau, SQL Server chuyển phía có độ ưu tiên kiểu thấp hơn. Nếu phía bị chuyển là **cột**, điều kiện có thể mất SARG:
- Cột `VARCHAR`, tham số `NVARCHAR`: cột bị bọc `CONVERT_IMPLICIT`. Collation kiểu SQL (`SQL_Latin1_General_CP1_CI_AS`) thường thành scan; collation Windows vẫn seek được qua dải động nhưng ước lượng kém hơn.
- Cột `VARCHAR` so với số (`WHERE Phone = 900000123`): cột bị chuyển sang `INT`, scan, và lỗi nếu có dòng không phải số.
- Cột `INT`, tham số `VARCHAR`: tham số bị chuyển, vẫn seek.

Nguồn phổ biến trong .NET: chuỗi mặc định đi thành `NVARCHAR` (`SqlParameter`, Dapper). Với cột `varchar`, khai báo `DbType.AnsiString` hoặc `SqlDbType.VarChar` kèm độ dài.

##### Truy vấn catch-all

```sql
CREATE OR ALTER PROCEDURE dbo.SearchStudents @ProvinceId SMALLINT = 0, @SchoolId INT = 0, @Grade TINYINT = 0
AS
SELECT StudentId, FullName
FROM dbo.Student
WHERE (@ProvinceId = 0 OR ProvinceId = @ProvinceId)
  AND (@SchoolId   = 0 OR SchoolId   = @SchoolId)
  AND (@Grade      = 0 OR Grade      = @Grade);
```

Plan cache phải đúng cho mọi tổ hợp, kể cả khi mọi tham số bằng 0, nên thường là scan. Ba cách xử lý:
- `OPTION (RECOMPILE)` ở câu lệnh: compile lại mỗi lần với giá trị thật; nhờ *parameter embedding*, vế `@SchoolId = 0` được rút gọn và câu còn lại seek được. Giá: CPU compile mỗi lần chạy.
- Dynamic SQL có tham số: chỉ nối điều kiện cần, chạy bằng `sp_executesql`. Mỗi tổ hợp một plan được cache; giá trị vẫn là tham số nên không có SQL injection.
- Tách proc con theo nhánh: hợp khi chỉ có vài tổ hợp.

```sql
DECLARE @sql NVARCHAR(MAX) = N'SELECT StudentId, FullName FROM dbo.Student WHERE 1 = 1';
IF @ProvinceId > 0 SET @sql += N' AND ProvinceId = @ProvinceId';
IF @SchoolId   > 0 SET @sql += N' AND SchoolId = @SchoolId';
IF @Grade      > 0 SET @sql += N' AND Grade = @Grade';
EXEC sp_executesql @sql, N'@ProvinceId SMALLINT, @SchoolId INT, @Grade TINYINT',
     @ProvinceId, @SchoolId, @Grade;
```

> **Cảnh báo:** Tách `IF/ELSE` trong *cùng* một proc có bẫy. Khi proc compile, **mọi** câu trong mọi nhánh được tối ưu cùng lúc theo tham số của lần gọi đầu, kể cả nhánh không chạy. Lần đầu gọi với `@SchoolId = 0` thì câu trong nhánh `IF @SchoolId > 0` được tối ưu cho giá trị 0. Tách nhánh thành proc con hoặc thêm `OPTION (RECOMPILE)` ở câu trong nhánh.

##### `LIKE`

`LIKE 'abc%'` seek được (dải từ `abc` tới trước `abd`). `LIKE '%abc'` và `'%abc%'` thì không, vì B-tree sắp theo ký tự đầu. Cách xử lý: full-text search; cột đảo ngược có index cho tìm hậu tố; cột chứa danh sách mã (`'IOE,IOK,...'`) thì chuẩn hoá thành bảng con; hoặc chỉ cho `%x%` chạy trên tập đã lọc nhỏ. Dùng mô phỏng ở trên để thử viết lại từng mẫu và xem Seek Predicate thay đổi.

#### Cách show off

Chất liệu thật:
- Proc tra trường theo mã dùng `1 = CASE WHEN ... AND ID = @ID THEN 1 ...` nên quét cả bảng, trong khi proc được gọi hàng chục triệu lần. Bản viết lại tách `IF/ELSE`, nhánh có mã đi thẳng vào khoá chính: từ hơn 800 trang xuống 3 trang mỗi lần, đo trên các lần chạy sau deploy. [điền: xác nhận ai viết lại proc này]
- Proc báo cáo đăng ký lọc `LIKE '%IOK%'` trên cột chứa danh sách mã dịch vụ, bảng trăm triệu dòng.
- Proc tìm kiếm giải thưởng bọc `CASE` và `CONVERT(NVARCHAR, user_id)` quanh cột, nên scan dù có index trên mã người dùng.

> **Ví dụ:** "Lỗi SARG hay gặp nhất ở hệ thống tôi là kiểu viết `1 = CASE WHEN ... THEN 1 END` để gom nhiều điều kiện tuỳ chọn vào một câu. Proc tra trường theo mã viết như vậy, nên dù có khoá chính, lần nào cũng quét cả bảng, mà proc này được gọi hàng chục triệu lần. Bản sửa tách thành nhánh: có mã thì seek thẳng vào khoá chính, số trang đọc mỗi lần xuống còn 3. Nhưng tôi luôn nói thêm một điều khi kể ca này: tách `IF/ELSE` trong cùng proc vẫn dính sniffing giữa các nhánh, vì cả proc compile một lần theo tham số đầu tiên. Ở đây nhánh có mã là seek theo khoá chính nên an toàn; với nhánh lọc theo cột phân bố lệch thì tôi sẽ tách proc con."

Điểm ăn điểm:
- Kiểm chứng bằng Seek Predicate trong plan, không bằng tên toán tử.
- Biết nguồn lệch kiểu nằm ở tầng .NET và sửa ở đó.
- Nêu được bẫy của chính cách sửa mình dùng (`IF/ELSE` cùng proc).
- `LIKE '%x%'` trên cột danh sách là lỗi mô hình dữ liệu, không phải lỗi index.

#### Câu hỏi vặn

- **"`WHERE CAST(create_date AS date) = @d` có seek được không?"** Đây là ngoại lệ: ép `datetime` sang `date` vẫn seek được qua dải động, nhưng ước lượng kém. Tôi vẫn viết `create_date >= @d AND create_date < DATEADD(day, 1, @d)` vì rõ ràng và ổn định hơn.
- **"Cột `VARCHAR`, app truyền `NVARCHAR` thì sao?"** `nvarchar` ưu tiên kiểu cao hơn nên cột bị bọc `CONVERT_IMPLICIT`. Collation SQL thường mất seek; collation Windows vẫn seek qua dải động nhưng ước lượng kém. Sửa ở app: khai báo đúng `varchar` và độ dài.
- **"Proc tìm kiếm nhiều tham số tuỳ chọn, làm sao để seek được?"** Mẫu `(@p = 0 OR col = @p)` buộc plan đúng cho mọi tổ hợp nên thường scan. Proc gọi không quá dày thì `OPTION (RECOMPILE)`; gọi dày và nhiều tổ hợp thì dynamic SQL có tham số; ít tổ hợp thì proc con.
- **"Dynamic SQL có sợ SQL injection không?"** Chỉ khi nối giá trị vào chuỗi. Ở đây chỉ nối các đoạn điều kiện cố định do code viết sẵn, giá trị vẫn đi qua tham số của `sp_executesql`. Tên cột hay hướng sắp nếu nhận từ ngoài thì phải so với danh sách cho phép.
- **"`LIKE '%abc%'` trên bảng 120 triệu dòng, xử lý ra sao?"** B-tree không giúp vì không biết ký tự đầu. Cột là danh sách mã thì chuẩn hoá thành bảng con có index và tra bằng phép bằng; là văn bản thì full-text search; bắt buộc giữ thì chỉ chạy trên tập đã lọc nhỏ bằng điều kiện SARGable khác.
- **"`OR` giữa hai cột đều có index, sao vẫn scan?"** `WHERE SchoolId = @s OR Phone = @p` cần hai dải trên hai index khác nhau; optimizer có thể chọn scan nếu ước lượng thấy rẻ hơn. Viết lại thành `UNION` hai câu seek nếu cần.

#### Bẫy cần tránh

- Thấy "Index Seek" là yên tâm mà không xem cột lọc nằm ở Seek Predicate hay Predicate.
- Dynamic SQL nối giá trị trực tiếp: mở SQL injection và làm phình plan cache.
- Nói con số cải thiện của proc mà không nói đo trên bao nhiêu lần chạy, sau deploy bao lâu.

#### Nhớ nhanh

- SARGable: cột "trần" một vế, biểu thức không phụ thuộc cột ở vế kia.
- Hàm, `CASE`, phép tính bao cột, `LIKE '%x'` làm mất seek.
- Lệch kiểu: cột bị chuyển thì có thể mất seek; sửa kiểu tham số ở app.
- Catch-all: `RECOMPILE`, dynamic SQL có tham số, hoặc proc con; `IF/ELSE` cùng proc dính sniffing.

#### Bài tập

1. Tạo `CREATE INDEX IX_Student_Created ON dbo.Student (CreatedAt);`. So plan và reads của `WHERE YEAR(CreatedAt) = 2025` và dạng viết lại theo dải.
   **Đáp án:** Dạng `YEAR()` scan index hoặc bảng, vài nghìn reads; dạng dải seek, reads tỷ lệ với số dòng năm 2025 (cộng lookup nếu chọn cột ngoài index). `Seek Predicates` có `CreatedAt`.
2. Tạo `CREATE INDEX IX_Student_Phone ON dbo.Student (Phone);`. Chạy `WHERE Phone = '0900000123'`, `WHERE Phone = N'0900000123'`, `WHERE Phone = 900000123`. Ghi plan, reads, cảnh báo; kiểm tra collation bằng `SELECT DATABASEPROPERTYEX('LabPerf','Collation');`.
   **Đáp án:** Câu 1 seek, 3–4 reads. Câu 2 có `CONVERT_IMPLICIT`: collation SQL thì scan index; collation Windows thì seek dải động, ít reads nhưng có cảnh báo. Câu 3 chuyển cột sang `INT`: scan và cảnh báo; có số điện thoại không phải số thì lỗi chuyển kiểu.
3. Tạo proc `dbo.SearchStudents` trong bài, tạo index `(SchoolId)` và `(ProvinceId, Grade)`. Đo reads khi gọi `@SchoolId = 500`. Viết lại bằng `OPTION (RECOMPILE)` và bằng dynamic SQL, đo lại.
   **Đáp án:** Bản catch-all scan, khoảng 9.500 reads. Bản `RECOMPILE` và dynamic SQL seek `IX(SchoolId)` + lookup, khoảng 120 reads. Với dynamic SQL, `sys.dm_exec_query_stats` cho thấy mỗi tổ hợp tham số có một plan riêng được dùng lại.

### Bài 19.2. Statistics và ước lượng số dòng
**Viz:** cardinality

#### Kiến thức

##### Statistics gồm gì

Mỗi statistics gắn với một cột hoặc tập cột (mỗi index có một statistics; SQL Server tự tạo thêm statistics cột đơn `_WA_Sys_...` khi truy vấn lọc trên cột chưa có). Gồm ba phần:
- Header: số dòng lúc tạo, số dòng lấy mẫu, thời điểm cập nhật.
- Density vector: `1 / số giá trị khác nhau` cho từng tiền tố cột. `SchoolId` có 20.001 giá trị nên density ≈ 0,00005.
- Histogram trên **cột đầu tiên**, tối đa 200 bước. Mỗi bước có `RANGE_HI_KEY` (biên), `EQ_ROWS` (số dòng bằng đúng biên), `RANGE_ROWS`, `DISTINCT_RANGE_ROWS`, `AVG_RANGE_ROWS` (số dòng trung bình mỗi giá trị nằm giữa hai biên).

```sql
DBCC SHOW_STATISTICS ('dbo.Student', 'IX_Student_SchoolId');
SELECT s.name, sp.last_updated, sp.rows, sp.rows_sampled, sp.modification_counter
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE s.object_id = OBJECT_ID('dbo.Student');
```

##### Ước lượng thế nào

- `SchoolId = 1` (giá trị là biên một bước): lấy `EQ_ROWS` = 200.000.
- `SchoolId = 500` (nằm trong một bước): lấy `AVG_RANGE_ROWS`, khoảng 40.
- Giá trị không biết lúc compile (biến cục bộ, `OPTIMIZE FOR UNKNOWN`): density × số dòng ≈ 1.000.000 / 20.001 ≈ 50. Đúng với đa số trường, sai với trường 1.
- Nhiều điều kiện `AND` trên các cột khác nhau: CE cũ (compatibility level dưới 120) giả định độc lập, nhân các độ chọn lọc. CE mới dùng *exponential backoff*: chọn lọc mạnh nhất × căn bậc hai cái thứ hai × căn bậc bốn cái thứ ba, bớt đánh giá thấp với các cột tương quan như tỉnh và huyện.

Mọi lựa chọn của optimizer đứng trên con số này: loại join, thứ tự join, seek + lookup hay scan, song song hay không, và memory grant. Ước lượng thấp → Nested Loops chạy hàng trăm nghìn lần, grant thiếu → spill. Ước lượng cao → scan, Hash, grant thừa.

##### Khi nào statistics tự cập nhật

Statistics bị coi là cũ khi `modification_counter` vượt ngưỡng:
- Compatibility level dưới 130: 500 + 20% số dòng. Bảng 100 triệu dòng cần 20 triệu thay đổi.
- Từ 130 (SQL Server 2016): `MIN(500 + 0,2·n, √(1000·n))`. Bảng 100 triệu dòng chỉ cần khoảng 316 nghìn thay đổi.

Tự cập nhật chỉ xảy ra khi có truy vấn compile cần statistics đó; mặc định đồng bộ (truy vấn chờ), có thể bật `AUTO_UPDATE_STATISTICS_ASYNC`. Tự cập nhật lấy mẫu, tỷ lệ mẫu giảm khi bảng lớn. Cập nhật tay: `UPDATE STATISTICS dbo.T WITH FULLSCAN` hoặc `SAMPLE n PERCENT`, kèm `PERSIST_SAMPLE_PERCENT = ON` để lần tự cập nhật sau giữ tỷ lệ mẫu.

##### Khoá tăng dần

Cột thời gian, Id tăng dần: dữ liệu mới luôn lớn hơn biên cuối của histogram. Truy vấn "bản ghi trong 1 giờ qua" rơi đúng vùng histogram không biết. CE cũ ước lượng 1 dòng; CE mới ước lượng theo density trung bình, tốt hơn nhưng vẫn có thể lệch. Đây lại là vùng được truy vấn nhiều nhất trên bảng log.

Dùng mô phỏng ở trên để thấy ước lượng lệch dẫn tới chọn join, memory grant và spill ra sao.

#### Cách show off

Chất liệu thật:
- Vài chục statistics đã thay đổi quá 100% kể từ lần cập nhật cuối; có bảng nhỏ vài chục nghìn dòng thay đổi tới hàng triệu phần trăm, bảng log thi thử hàng chục nghìn phần trăm.
- Proc lọc học sinh theo trường và khối ước lượng một dòng nhưng thực tế đọc hàng chục nghìn trang.
- Một kết luận cần sửa trong báo cáo: "ngưỡng 20% không bao giờ đạt được trên bảng lớn". Điều đó chỉ đúng khi database ở compatibility level dưới 130 hoặc tắt auto update. [điền: compatibility level và cấu hình auto update thực tế của các database đó]

> **Ví dụ:** "Trong đợt rà soát tôi thấy nhiều statistics đã thay đổi gấp nhiều lần số dòng kể từ lần cập nhật cuối. Lúc đầu báo cáo kết luận là do ngưỡng 20% trên bảng lớn không bao giờ đạt, nhưng khi kiểm tra lại thì từ SQL Server 2016, ở compatibility level 130 trở lên, ngưỡng đã là căn bậc hai, bảng trăm triệu dòng chỉ cần vài trăm nghìn thay đổi. Nên câu hỏi đúng là database đang ở level nào và có bật auto update không. Còn bảng nhỏ thay đổi hàng triệu phần trăm thì gần như chắc là bảng bị xoá rồi nạp lại liên tục; cách sửa là cập nhật statistics ngay trong job nạp, không phải chạy FULLSCAN cho cả hệ thống mỗi đêm."

Điểm ăn điểm:
- Tính được ước lượng từ histogram và density, không chỉ nói "statistics cũ".
- Biết ngưỡng tự cập nhật đổi theo compatibility level.
- Gắn ước lượng sai với hậu quả cụ thể: join, grant, spill.
- Cập nhật theo `modification_counter` và theo nhịp nạp dữ liệu, không theo lịch cứng.

#### Câu hỏi vặn

- **"Ước lượng 1 dòng, thực tế 500.000 dòng. Plan bị gì?"** Optimizer chọn Nested Loops với 500.000 lần seek bên trong, cấp memory grant quá nhỏ nên Sort hay Hash spill xuống tempdb, và có thể chọn sai thứ tự join. Chậm hàng trăm lần là bình thường.
- **"Statistics tự cập nhật khi nào?"** Khi số thay đổi vượt ngưỡng và có truy vấn compile cần statistics đó. Dưới level 130 là 500 + 20% số dòng; từ 130 là `MIN(500 + 0,2·n, √(1000·n))`. Tôi xem `modification_counter` trong `sys.dm_db_stats_properties`.
- **"Vì sao bảng log theo thời gian hay bị ước lượng sai ở dữ liệu mới?"** Dữ liệu mới nằm ngoài bước cuối của histogram vì khoá tăng dần. CE cũ ước lượng 1 dòng, CE mới ước lượng theo density trung bình, cả hai có thể lệch đúng ở vùng được truy vấn nhiều nhất. Cập nhật statistics dày hơn, hoặc thiết kế index để plan đúng bất kể ước lượng.
- **"Gán tham số vào biến cục bộ thì ước lượng thay đổi thế nào?"** Optimizer không biết giá trị lúc compile nên dùng density × số dòng, không dùng histogram. Ổn định nhưng sai với giá trị lệch phân bố, như trường 200.000 học sinh được ước lượng 50.
- **"Sao không chạy `UPDATE STATISTICS ... FULLSCAN` cho mọi bảng mỗi đêm cho chắc?"** FULLSCAN đọc cả bảng, trên bảng trăm triệu dòng là I/O rất lớn, và làm compile lại mọi plan liên quan. Nhiều bảng lấy mẫu là đủ. Tôi dùng FULLSCAN cho cột phân bố lệch mà mẫu không bắt được, còn lại cập nhật theo `modification_counter`.
- **"Đổi compatibility level từ 110 lên 150 có rủi ro gì?"** Đổi cả cardinality estimator: nhiều câu nhanh lên, một số chậm đi. Tôi bật Query Store trước khi đổi để có mốc so và ép lại plan cũ cho câu bị chậm.

#### Bẫy cần tránh

- Lặp lại "ngưỡng 20%" mà không hỏi compatibility level.
- FULLSCAN toàn hệ thống trong giờ cao điểm.
- Đổ hết cho statistics khi gốc là sniffing hay bảng biến: kiểm tra statistics mới cập nhật mà ước lượng vẫn lệch thì tìm nguyên nhân khác.

#### Nhớ nhanh

- Statistics = header + density vector + histogram (tối đa 200 bước, chỉ cột đầu).
- Ước lượng sai → join sai, grant sai, spill.
- Ngưỡng tự cập nhật từ level 130: `MIN(500 + 0,2n, √(1000n))`.
- Khoá tăng dần làm vùng dữ liệu mới bị ước lượng kém.
- Bảng nạp lại thì cập nhật statistics ngay sau khi nạp.

#### Bài tập

1. Tạo `IX_Student_SchoolId` (nếu chưa có), chạy `DBCC SHOW_STATISTICS`. Tìm bước có `RANGE_HI_KEY = 1`, ghi `EQ_ROWS`. Tính density × số dòng.
   **Đáp án:** `EQ_ROWS` = 200.000 cho `SchoolId = 1`. Density cột `SchoolId` ≈ 1/20.001 ≈ 0,00005; × 1.000.000 ≈ 50.
2. So ước lượng và số thật của ba câu: `WHERE SchoolId = 1`; `DECLARE @s INT = 1; ... WHERE SchoolId = @s`; cùng câu biến cục bộ thêm `OPTION (RECOMPILE)`.
   **Đáp án:** Literal: ước lượng 200.000, đúng. Biến cục bộ: ước lượng khoảng 50, thật 200.000, plan có thể chọn seek + lookup sai. `OPTION (RECOMPILE)`: optimizer thấy giá trị biến lúc compile, ước lượng lại 200.000.
3. Dùng index `IX_Student_Created` (Bài 19.1), tắt tự cập nhật: `ALTER DATABASE LabPerf SET AUTO_UPDATE_STATISTICS OFF;`. Chèn 50.000 học sinh mới (`StudentId` từ 1.000.001, `CreatedAt` tăng dần từ `MAX(CreatedAt)` + 1 phút). So ước lượng của `WHERE CreatedAt > '<mốc cũ>'` khi chạy bình thường và khi thêm `OPTION (USE HINT('FORCE_LEGACY_CARDINALITY_ESTIMATION'))`. Vì sao phải tắt tự cập nhật?
   **Đáp án:** 50.000 thay đổi đã vượt ngưỡng √(1000 × 1.000.000) ≈ 31.600, nên nếu để bật thì statistics tự cập nhật ở lần compile và không còn thấy vấn đề. CE cũ ước lượng khoảng 1 dòng; CE mới ước lượng lớn hơn nhưng vẫn lệch xa 50.000. Sau `UPDATE STATISTICS dbo.Student WITH FULLSCAN` cả hai ước lượng đúng. Bật lại `AUTO_UPDATE_STATISTICS ON` sau bài.

### Bài 19.3. Parameter sniffing và độ ổn định của plan

#### Kiến thức

##### Cơ chế

Lần đầu một proc (hoặc câu `sp_executesql`, truy vấn tham số hoá từ EF Core, Dapper) chạy, optimizer "ngửi" giá trị tham số thật, dùng histogram để ước lượng, rồi compile plan tối ưu cho giá trị đó. Plan được cache và dùng lại cho mọi lần gọi sau với bất kỳ giá trị nào, cho tới khi bị compile lại (plan bị đẩy khỏi cache, statistics cập nhật, schema đổi, `sp_recompile`, restart). Đây là tính năng, tiết kiệm CPU compile; nó chỉ thành vấn đề khi dữ liệu phân bố lệch và một plan không hợp mọi giá trị.

```sql
-- Cần IX_Student_SchoolId (không covering)
CREATE OR ALTER PROCEDURE dbo.GetStudentsBySchool @SchoolId INT
AS
SELECT StudentId, FullName, Grade FROM dbo.Student WHERE SchoolId = @SchoolId;
GO
SET STATISTICS IO ON;
EXEC dbo.GetStudentsBySchool @SchoolId = 500;  -- compile: Seek + Key Lookup, khoảng 120 reads
EXEC dbo.GetStudentsBySchool @SchoolId = 1;    -- dùng lại plan: 200.000 lookup, khoảng 600.000 reads

EXEC sp_recompile 'dbo.GetStudentsBySchool';
EXEC dbo.GetStudentsBySchool @SchoolId = 1;    -- compile: Clustered Index Scan, khoảng 9.500 reads
EXEC dbo.GetStudentsBySchool @SchoolId = 500;  -- dùng lại plan scan: 9.500 reads thay vì 120
```

Triệu chứng điển hình: "proc lúc nhanh lúc chậm", "sáng nay tự nhiên chậm", "restart xong lại nhanh".

##### Nhận biết

- Plan thật (XML), mục `ParameterList`: `ParameterCompiledValue` khác `ParameterRuntimeValue` và số dòng lệch xa.
- `sys.dm_exec_query_stats`: `min_logical_reads` và `max_logical_reads` chênh nhiều bậc với cùng plan.
- Query Store: một `query_id` có nhiều `plan_id` hiệu năng rất khác nhau; báo cáo *Regressed Queries*.

##### Cách xử lý và cái giá

| Cách | Cơ chế | Cái giá |
|---|---|---|
| `OPTION (RECOMPILE)` ở câu | Compile mỗi lần với giá trị thật | CPU compile mỗi lần chạy |
| `WITH RECOMPILE` ở proc | Cả proc compile mỗi lần | Nặng hơn với proc nhiều câu; plan không nằm trong cache |
| `OPTIMIZE FOR (@p = 500)` | Luôn compile cho giá trị chỉ định | Sai cho giá trị lệch |
| `OPTIMIZE FOR UNKNOWN` / biến cục bộ | Dùng density trung bình | Plan "trung bình", có thể không tốt cho ai |
| Tách proc con theo nhóm giá trị | Mỗi nhóm một plan | Phải biết trước nhóm; thêm code |
| Query Store force plan / hints (2022) | Ép plan tốt hoặc gắn hint không sửa code | Plan ép có thể hỏng khi dữ liệu, index đổi |
| PSP optimization (2022, level 160) | Điều kiện bằng trên cột lệch: tối đa 3 biến thể plan theo dải số dòng | Chỉ một số dạng điều kiện, không chắc kích hoạt |
| Sửa gốc: covering index | Mọi giá trị đều seek không lookup | Chi phí ghi của index |

Với ví dụ trên, `CREATE INDEX ... ON dbo.Student (SchoolId) INCLUDE (FullName, Grade)` cho cả hai giá trị dùng chung một plan seek tốt: trường 500 khoảng 3 reads, trường 1 khoảng 1.200–1.300 reads. Plan ổn định là kết quả của thiết kế index, không chỉ của hint.

##### Xử lý khẩn cấp và phía .NET

Proc đang chậm vì plan xấu: `EXEC sp_recompile 'dbo.ProcName';` hoặc xoá đúng một plan bằng `DBCC FREEPROCCACHE (plan_handle)`. Không chạy `DBCC FREEPROCCACHE` không tham số trên production: mọi câu compile lại cùng lúc, CPU tăng vọt. Đây chỉ là chữa cháy; plan xấu quay lại nếu giá trị không điển hình chạy đầu tiên lần sau.

EF Core và Dapper gửi `sp_executesql` có tham số nên cũng bị sniffing. Thêm một bẫy: tham số chuỗi không khai báo độ dài sẽ lấy độ dài theo giá trị, mỗi độ dài sinh một plan riêng, làm phình plan cache.

#### Cách show off

Chất liệu thật:
- Proc lọc học sinh theo trường và khối từ dưới 2 ms lên khoảng 670 ms mỗi lần: plan compile cho một bộ tham số nhỏ rồi dùng lại cho trường lớn.
- Báo cáo đề xuất chung là thêm `OPTION (RECOMPILE)`. Với proc thống kê hạng chạy hàng triệu lần, đề xuất này cần cân lại.

> **Ví dụ:** "Có một proc lọc học sinh theo trường và khối, bình thường dưới 2 ms, có lúc lên gần 700 ms mỗi lần. Tôi lấy plan ra xem thì thấy plan được compile cho một trường nhỏ, seek kèm lookup, rồi dùng lại cho trường lớn với hàng chục nghìn lookup. Cách nhanh nhất là thêm `OPTION (RECOMPILE)`, và với proc gọi vừa phải thì tôi chấp nhận. Nhưng tôi không áp nó đại trà: có proc thống kê hạng chạy hàng triệu lần, thêm recompile là thêm chừng ấy lần compile, có khi đắt hơn chính vấn đề. Với proc kiểu đó tôi ưu tiên index covering để mọi giá trị dùng chung một plan tốt, hoặc cache kết quả ở app."

Điểm ăn điểm:
- Nói sniffing là tính năng, chỉ hại khi dữ liệu lệch.
- Chứng minh bằng compiled value và runtime value, không đoán.
- Chọn cách xử lý theo tần suất gọi, nêu cái giá của `RECOMPILE`.
- Biết chữa cháy đúng cách: `sp_recompile` một proc, không xoá cả cache.

#### Câu hỏi vặn

- **"Khi nào không nên dùng `OPTION (RECOMPILE)`?"** Khi câu chạy rất dày và rẻ: chi phí compile vượt lợi ích. Khi proc phức tạp, compile lâu. Lúc đó dùng index để plan ổn định, tách nhánh, hoặc ép plan bằng Query Store.
- **"Làm sao chắc một proc bị parameter sniffing?"** Lấy plan thật, so `ParameterCompiledValue` với `ParameterRuntimeValue` và số dòng ước lượng với thật. Xem `min_logical_reads` và `max_logical_reads` có chênh nhiều bậc không. Query Store có nhiều plan cho cùng `query_id` với hiệu năng khác hẳn. Nhiều dòng của proc trong `dm_exec_query_stats` thì chưa đủ, đó có thể là nhiều câu lệnh.
- **"Gán tham số vào biến cục bộ có sửa được sniffing không?"** Nó tắt sniffing, optimizer dùng density trung bình như `OPTIMIZE FOR UNKNOWN`. Plan ổn định nhưng tối ưu cho giá trị trung bình, có thể tệ cho cả giá trị nhỏ lẫn lớn. Là lựa chọn có chủ đích, không phải cách sửa mặc định.
- **"PSP optimization của SQL Server 2022 giải quyết được không?"** Ở level 160, với điều kiện bằng trên cột phân bố lệch, optimizer tạo plan điều phối và tối đa 3 biến thể theo dải số dòng. Nhưng chỉ áp dụng cho một số dạng điều kiện và không chắc kích hoạt; tôi kiểm chứng bằng plan và Query Store trước khi trông vào nó.
- **"Proc đang chậm trên production vì plan xấu, xử lý ngay thế nào?"** Lấy plan đang dùng làm bằng chứng, rồi `sp_recompile` proc hoặc `DBCC FREEPROCCACHE (plan_handle)` cho đúng plan đó, không xoá cả cache. Nếu tái diễn, ép plan tốt bằng Query Store và lên kế hoạch sửa gốc.
- **"SSMS chạy nhanh, app chạy chậm. Có phải sniffing?"** Có thể, nhưng trước hết kiểm tra `SET` options: SSMS và app khác `ARITHABORT` nên dùng hai plan riêng. Lấy plan của app từ cache hoặc Query Store rồi mới kết luận.

#### Bẫy cần tránh

- Áp `RECOMPILE` cho proc chạy hàng triệu lần mà không đo CPU compile.
- Tái hiện bằng literal hoặc `SET` options khác app, ra plan khác, kết luận sai.
- `DBCC FREEPROCCACHE` không tham số trên production.

#### Nhớ nhanh

- Plan compile theo giá trị tham số lần đầu và dùng lại cho mọi giá trị.
- Chỉ gây hại khi dữ liệu phân bố lệch.
- Nhận biết bằng compiled vs runtime value, min/max reads, nhiều plan trong Query Store.
- Mỗi cách xử lý có cái giá; `RECOMPILE` không hợp proc gọi hàng triệu lần.
- Sửa gốc tốt nhất thường là covering index.

#### Bài tập

1. Chạy script trong bài theo hai thứ tự, ghi reads. Lấy plan thật của lần chạy `@SchoolId = 1` sau khi compile cho 500, tìm `ParameterCompiledValue`, `ParameterRuntimeValue`.
   **Đáp án:** Compile cho 500 rồi chạy 1: khoảng 600.000 reads, `ParameterCompiledValue = (500)`, `ParameterRuntimeValue = (1)`, Key Lookup có actual 200.000 so với estimated khoảng 40. Compile cho 1 rồi chạy 500: khoảng 9.500 reads thay vì 120.
2. Thử `OPTION (RECOMPILE)`, `OPTIMIZE FOR (@SchoolId UNKNOWN)`, covering index. Với mỗi cách, đo reads của hai giá trị và nêu cái giá.
   **Đáp án:** `RECOMPILE`: 120 và 9.500 reads, tốn compile. `UNKNOWN`: ước lượng 50, plan seek + lookup cố định, trường 1 vẫn khoảng 600.000 reads. Covering: khoảng 3 và 1.200–1.300 reads, không cần hint, thêm chi phí ghi.
3. Bật Query Store, chạy proc theo thứ tự tạo ra plan xấu, rồi ép plan tốt bằng `sp_query_store_force_plan`. Kiểm tra plan được dùng sau `sp_recompile`.
   **Đáp án:** Tìm `query_id`, `plan_id` trong `sys.query_store_plan` (join `sys.query_store_query` theo `object_id` của proc). Sau khi ép, mọi lần compile lại đều dùng plan đã ép, `is_forced_plan = 1`. Gỡ bằng `sp_query_store_unforce_plan`.

### Bài 19.4. Memory grant, Sort, Hash và spill

#### Kiến thức

##### Memory grant là gì

Một phần bộ nhớ của SQL Server dành cho các toán tử cần chỗ làm việc: Sort, Hash Match (join, aggregate). Trước khi chạy, mỗi truy vấn xin một memory grant dựa trên **ước lượng**: số dòng ước lượng × độ rộng dòng ước lượng ở các toán tử đó. Quỹ còn đủ thì nhận grant và chạy; không thì xếp hàng với wait `RESOURCE_SEMAPHORE`. Mặc định một truy vấn không được nhận quá 25% workspace memory.

Độ rộng dòng của cột độ dài thay đổi được ước lượng theo độ dài **khai báo** (khoảng một nửa), không theo dữ liệu thật; cột `(max)` dùng một giá trị cố định lớn. Kéo một cột `nvarchar(4000)` qua Sort làm grant phình to dù dữ liệu thật chỉ vài chục ký tự.

##### Hai hướng sai

- **Grant thiếu → spill.** Ước lượng 50 dòng, thực tế 200.000: Sort không đủ chỗ, ghi từng phần xuống tempdb rồi đọc lại (Sort Warnings); Hash chia partition xuống tempdb, có thể đệ quy (Hash Warnings). I/O tempdb thay cho phép toán trong RAM, chậm hàng chục lần.
- **Grant thừa → người khác chờ.** Ước lượng một triệu dòng rộng, thực tế vài trăm: grant hàng GB bị giữ suốt thời gian chạy dù chỉ dùng vài MB. Nhiều phiên cùng lúc thì quỹ cạn, truy vấn khác (kể cả câu nhỏ có Sort) xếp hàng `RESOURCE_SEMAPHORE`; buffer pool cũng bị thu hẹp.

Sort là toán tử chặn: phải đọc hết input trước khi trả dòng đầu. Với `TOP (20) ... ORDER BY`, Top N Sort chỉ giữ 20 dòng trong bộ nhớ nhưng vẫn đọc hết input.

##### Quan sát

```sql
-- Đang chạy: ai xin bao nhiêu, dùng bao nhiêu, ai đang chờ
SELECT session_id, requested_memory_kb, granted_memory_kb, used_memory_kb,
       max_used_memory_kb, ideal_memory_kb, wait_time_ms, queue_id
FROM sys.dm_exec_query_memory_grants;

-- Lịch sử theo câu lệnh
SELECT TOP (20) qs.execution_count, qs.max_grant_kb, qs.max_used_grant_kb,
       qs.total_spills, qs.total_grant_kb / qs.execution_count AS avg_grant_kb
FROM sys.dm_exec_query_stats qs
ORDER BY qs.max_grant_kb DESC;
```

Trong plan thật, thuộc tính toán tử SELECT → `MemoryGrantInfo`: `RequestedMemory`, `GrantedMemory`, `MaxUsedMemory`. Cảnh báo `ExcessiveGrant` khi dùng ít hơn nhiều so với cấp; tam giác vàng trên Sort/Hash khi spill.

##### Memory grant feedback

SQL Server tự chỉnh grant qua các lần chạy của cùng plan: batch mode từ 2017 (level 140), row mode từ 2019 (level 150); 2022 thêm tính theo phân vị và lưu phản hồi vào Query Store. Feedback không giúp lần chạy đầu, câu `RECOMPILE`, và tự tắt khi nhu cầu dao động mạnh giữa các lần chạy, đúng trường hợp parameter sniffing.

##### Cách giảm grant

- Index phục vụ `ORDER BY` (Bài 18.2): bỏ Sort là bỏ luôn grant của Sort.
- Sort trên tập đã lọc nhỏ, rồi mới join lấy cột rộng; không sort hai lần.
- Không kéo cột rộng qua Sort/Hash; khai báo độ dài cột sát dữ liệu.
- Sửa ước lượng: statistics, `#temp` thay bảng biến, `RECOMPILE` có chọn lọc.
- Giới hạn: hint `MAX_GRANT_PERCENT` cho từng câu; Resource Governor cho nhóm báo cáo, giám sát (Enterprise; trên Standard chỉ dùng được hint).

#### Cách show off

Chất liệu thật:
- Proc tìm kiếm giải thưởng tháng: mỗi lần được cấp tối đa khoảng 7 GB bộ nhớ nhưng chỉ dùng chừng 1 MB, trên một bảng chỉ vài chục nghìn dòng; đồng thời spill rất nhiều.
- Proc top N xếp hạng: trung bình vài trăm MB grant mỗi lần, dùng hơn 1 MB.
- Một công cụ giám sát xin grant hàng chục GB cho một lần chạy.
- Ở cụm kho dữ liệu, `RESOURCE_SEMAPHORE` tăng gần gấp đôi giữa hai lần quét.

> **Ví dụ:** "Có một proc tìm kiếm giải thưởng mà nhìn thời gian chạy thì không đáng lo, nhưng mở plan ra thì mỗi lần nó xin tới khoảng 7 GB bộ nhớ và chỉ dùng chừng 1 MB, trên một bảng chỉ vài chục nghìn dòng. Nguyên nhân là ước lượng sai cộng với sort hai lần trên các cột khai báo rộng. Một câu như vậy chạy một mình thì không sao, nhưng vào giờ cao điểm vài phiên cùng lúc là quỹ bộ nhớ cạn, các truy vấn nhỏ khác phải xếp hàng chờ, và đúng là wait chờ cấp bộ nhớ ở cụm đó tăng gần gấp đôi giữa hai lần đo. Tôi đề xuất sửa gốc: sort một lần trên tập đã lọc, bỏ cột rộng khỏi phần sort, sửa ước lượng; còn hint giới hạn grant chỉ là lưới an toàn."

Điểm ăn điểm:
- Nói được thiệt hại của grant thừa rơi vào truy vấn *khác*, không phải chính nó.
- Biết grant tính từ độ dài khai báo, nên kiểu dữ liệu ảnh hưởng hiệu năng.
- Biết giới hạn của memory grant feedback.
- Coi `MAX_GRANT_PERCENT` là lưới an toàn, không phải cách sửa.

#### Câu hỏi vặn

- **"Grant thừa 99% thì hại gì nếu query vẫn nhanh?"** RAM bị giữ suốt lúc chạy. Nhiều phiên cùng lúc thì tổng grant vượt quỹ, các truy vấn khác, kể cả truy vấn nhỏ, phải chờ `RESOURCE_SEMAPHORE`. Buffer pool cũng bị thu hẹp nên đọc đĩa nhiều hơn.
- **"Memory grant được tính từ đâu?"** Từ số dòng ước lượng và độ rộng dòng ước lượng ở các toán tử cần bộ nhớ. Cột độ dài thay đổi tính theo độ dài khai báo. Ước lượng số dòng sai hoặc cột khai báo quá rộng đều làm grant sai.
- **"Chỉ lấy TOP 20 sao vẫn cần Sort và grant?"** Không có index sắp đúng, SQL phải đọc hết tập khớp mới biết 20 dòng nào đứng đầu. Index có cột `ORDER BY` sau các cột lọc bằng cho phép đọc 20 dòng rồi dừng, không Sort, không grant.
- **"Làm sao biết truy vấn bị spill?"** Plan thật có Sort Warnings hoặc Hash Warnings; `total_spills` trong `sys.dm_exec_query_stats`; Extended Events `sort_warning`, `hash_warning`. Gốc thường là ước lượng thấp hơn thực tế.
- **"Tăng RAM có hết `RESOURCE_SEMAPHORE` không?"** Tạm thời đỡ, nhưng câu xin thừa vẫn xin thừa theo tỷ lệ quỹ. Gốc là ước lượng và cột rộng; thêm RAM chỉ dời ngưỡng sự cố.
- **"Memory grant feedback có thay việc sửa truy vấn không?"** Không. Nó chỉ chỉnh sau khi đã sai ít nhất một lần, cho plan được dùng lại, và tự tắt khi nhu cầu dao động như ở proc bị sniffing.

#### Bẫy cần tránh

- "Query vẫn nhanh nên grant thừa không sao".
- Đặt `MAX_GRANT_PERCENT` quá thấp cho câu thực sự cần nhiều bộ nhớ: đổi chờ thành spill.
- Khai báo mọi cột chuỗi `nvarchar(max)` hay `nvarchar(4000)` "cho tiện".

#### Nhớ nhanh

- Grant = số dòng ước lượng × độ rộng ước lượng cho Sort/Hash, cấp trước khi chạy.
- Thiếu → spill xuống tempdb; thừa → truy vấn khác chờ `RESOURCE_SEMAPHORE`.
- Sort đọc hết input kể cả với `TOP`; index đúng thứ tự bỏ được cả Sort lẫn grant.
- Cột khai báo rộng làm grant phình.
- Feedback hỗ trợ, không thay việc sửa.

#### Bài tập

1. So grant (plan thật, `MemoryGrantInfo`) của `SELECT TOP (100) StudentId, FullName FROM dbo.Student ORDER BY FullName;` và cùng câu với `CAST(FullName AS NVARCHAR(4000)) AS FullName`.
   **Đáp án:** Câu thứ hai có `GrantedMemory` lớn hơn nhiều dù dữ liệu như nhau, vì độ rộng ước lượng theo khai báo `nvarchar(4000)`. Thường kèm cảnh báo `ExcessiveGrant`.
2. Gây spill bằng ước lượng sai: `DECLARE @s INT = 1; SELECT StudentId, FullName, Phone FROM dbo.Student WHERE SchoolId = @s ORDER BY FullName;` (không có index covering). Chạy 3 lần liên tiếp với plan thật, theo dõi cảnh báo spill và `GrantedMemory`.
   **Đáp án:** Ước lượng khoảng 50 dòng, thực tế 200.000: lần đầu grant nhỏ, Sort spill. Ở level 150+, row mode feedback tăng grant ở các lần sau, spill biến mất. Thêm `OPTION (RECOMPILE)` thì ước lượng đúng ngay từ đầu.
3. Viết truy vấn tìm 10 câu lệnh có tỷ lệ dùng grant thấp nhất trong số câu có `max_grant_kb > 100 MB`.
   **Đáp án:** Từ `sys.dm_exec_query_stats` lọc `max_grant_kb > 102400`, tính `1.0 * max_used_grant_kb / NULLIF(max_grant_kb, 0)`, sắp tăng dần, `CROSS APPLY sys.dm_exec_sql_text` để lấy câu lệnh. Đây là danh sách ưu tiên để giảm grant.

### Bài 19.5. Bảng biến, bảng tạm, TVP, JSON và XML

#### Kiến thức

##### Bảng biến (`DECLARE @t TABLE`)

Nằm trong tempdb như bảng tạm, không phải "chỉ trong RAM". Đặc điểm:
- Không có statistics theo cột.
- Trước SQL Server 2019: lúc compile bảng còn rỗng nên optimizer ước lượng 1 dòng (trừ khi câu có `OPTION (RECOMPILE)`).
- Từ 2019, level 150: *table variable deferred compilation* hoãn compile tới lần chạy đầu nên biết **tổng số dòng** thật lúc đó; plan được dùng lại cho các lần gọi có số dòng khác. Vẫn không có histogram: lọc và join trên cột của bảng biến vẫn là đoán.
- Câu ghi vào bảng biến không chạy song song; không bị `ROLLBACK` ảnh hưởng; khai báo được PRIMARY KEY, UNIQUE, index inline.

##### Bảng tạm (`#t`)

Có statistics, tạo index được, ước lượng theo dữ liệu thật. Đổi lại, số dòng thay đổi nhiều có thể gây recompile. Trong proc, SQL Server có *temp table caching*: giữ lại cấu trúc bảng tạm giữa các lần gọi để khỏi tạo và huỷ metadata mỗi lần. Caching mất khi có DDL sau khi tạo (`ALTER TABLE #t ADD ...`, `CREATE INDEX` riêng, constraint có tên). Tạo và huỷ hàng triệu bảng tạm gây tranh chấp latch trên metadata tempdb; SQL Server 2019 có *memory-optimized tempdb metadata* để giảm việc này.

```sql
-- Đúng: khai báo đủ cột, PK, index ngay trong CREATE, không ALTER sau
CREATE TABLE #ids (StudentId INT NOT NULL PRIMARY KEY);
```

##### TVP

Kiểu bảng do người dùng định nghĩa, truyền từ app vào proc dưới dạng `READONLY`. Thay cho chuỗi CSV, JSON hay XML: có kiểu, không parse chuỗi, khai báo được PRIMARY KEY. TVP không có histogram theo cột như bảng biến, nên xem plan thật; tập lớn và join phức tạp thì chép sang `#temp` có PK trong proc.

```sql
CREATE TYPE dbo.IntList AS TABLE (Id INT NOT NULL PRIMARY KEY);
GO
CREATE OR ALTER PROCEDURE dbo.GetSchoolNames @Ids dbo.IntList READONLY
AS
SELECT sc.SchoolId, sc.SchoolName
FROM @Ids i JOIN dbo.School sc ON sc.SchoolId = i.Id;
```

```csharp
var table = new DataTable();
table.Columns.Add("Id", typeof(int));
foreach (var id in schoolIds.Distinct()) table.Rows.Add(id);

using var cmd = new SqlCommand("dbo.GetSchoolNames", conn) { CommandType = CommandType.StoredProcedure };
var p = cmd.Parameters.AddWithValue("@Ids", table);
p.SqlDbType = SqlDbType.Structured;
p.TypeName = "dbo.IntList";
```

##### Chuỗi, JSON, XML

`STRING_SPLIT`, `OPENJSON`, `FOR JSON`, `FOR XML PATH` tốn CPU để dựng và parse, mất kiểu dữ liệu, và optimizer không biết số phần tử (ước lượng theo hằng số cố định). Chúng hợp ở ranh giới hệ thống: nhận JSON từ API, trả JSON cho client. Không hợp để chuyển dữ liệu giữa hai proc trong cùng DB: proc con đọc được `#temp` của proc cha, hoặc dùng TVP.

| Tình huống | Chọn |
|---|---|
| Vài chục dòng, dùng một lần, không join phức tạp | Bảng biến có PK |
| Hàng nghìn dòng trở lên, dùng để join, lọc, sắp xếp | `#temp` + PK/index khai báo trong `CREATE` |
| Truyền danh sách từ .NET vào proc | TVP |
| Truyền tập giữa các proc cùng DB | `#temp` hoặc TVP, không JSON |
| Cột chứa danh sách mã | Chuẩn hoá thành bảng con có index |

#### Cách show off

Chất liệu thật:
- Proc lấy quan hệ người dùng tạo `#t` rồi `ALTER TABLE #t ADD ...` và `UPDATE`, mất temp table caching, có lần chạy tới 20 giây. Bản viết lại là một `SELECT` với hai `LEFT JOIN`, trung bình chưa tới 10 ms. [điền: xác nhận ai viết lại proc này]
- Nhóm proc sinh đề dựng trên hàng chục bảng biến, spill hàng triệu lần; một proc tạo kết quả vòng có Eager Spool trên bảng biến.
- Proc lọc học sinh gom ID thành JSON bằng `FOR JSON` rồi truyền sang proc con để parse lại.
- Proc gói cước dùng `STRING_SPLIT` + `FOR XML PATH`, chạy vài triệu lần; báo cáo đề xuất cache kết quả ở Redis.
- Metadata tempdb ghi nhận hàng chục triệu lượt tạo bảng tạm.

> **Ví dụ:** "Một proc lấy quan hệ người dùng có lúc chạy tới 20 giây, mà logic chỉ là ghép thông tin từ hai bảng. Đọc code thì thấy nó tạo bảng tạm, rồi `ALTER TABLE` thêm cột, rồi `UPDATE` từng phần. Chính câu `ALTER` sau khi tạo làm mất temp table caching: lần gọi nào cũng tạo và huỷ metadata thật trong tempdb, gây recompile và tranh chấp khi gọi dày. Bản viết lại chỉ là một `SELECT` với hai `LEFT JOIN`, không cần bảng tạm, và chạy dưới 10 ms. Bài học tôi rút ra là bảng tạm không xấu, nhưng phải khai báo đủ cột và index ngay lúc `CREATE`, và trước khi dùng bảng trung gian nên hỏi xem một câu set-based có làm được không."

Điểm ăn điểm:
- Biết bảng biến và bảng tạm đều ở tempdb; khác nhau ở statistics và recompile.
- Biết deferred compilation của 2019 sửa được gì và không sửa được gì.
- Biết temp table caching và DDL làm mất nó.
- Đặt JSON đúng chỗ: ranh giới hệ thống, không phải giữa hai proc.

#### Câu hỏi vặn

- **"SQL Server 2019 đã sửa ước lượng bảng biến, còn cần đổi sang #temp không?"** Deferred compilation chỉ sửa tổng số dòng, không có phân bố giá trị theo cột, nên lọc và join trên bảng biến vẫn là đoán. Kiểm tra compatibility level và plan thật; tập lớn dùng để join thì vẫn nên `#temp` + PK.
- **"Khác nhau chính giữa bảng biến và bảng tạm?"** Bảng tạm có statistics, tạo index sau được, ước lượng theo dữ liệu thật, có thể gây recompile, bị rollback theo transaction. Bảng biến không có statistics, không gây recompile vì số dòng, không bị rollback, ghi vào không song song. Cả hai đều ở tempdb.
- **"Truyền 5.000 ID từ .NET vào proc, cách nào tốt?"** TVP có PRIMARY KEY: có kiểu, không parse chuỗi, một round-trip. Tránh nối CSV hay JSON rồi split, và tránh `IN (@p1, ..., @p5000)` vì giới hạn 2.100 tham số và mỗi số lượng tham số sinh một plan.
- **"Vì sao `ALTER TABLE #t ADD ...` trong proc lại gây hại?"** DDL sau khi tạo làm mất temp table caching: mỗi lần gọi tạo, huỷ metadata thật trong tempdb, gây tranh chấp latch metadata khi gọi dày, và câu dùng `#t` bị recompile. Khai báo đủ cột và index ngay trong `CREATE TABLE`.
- **"Dùng `FOR JSON` chuyển tập ID giữa hai proc có vấn đề gì?"** Tốn CPU serialize và parse, mất kiểu, và `OPENJSON` có ước lượng cố định nên plan phía nhận đoán sai số dòng. Proc con đọc được `#temp` của proc cha; dùng `#temp` hoặc TVP.
- **"Đổi hết bảng biến sang #temp cho chắc được không?"** Không nên làm đại trà. Với tập rất nhỏ trong proc gọi rất dày, recompile và chi phí của `#temp` có thể đắt hơn. Đổi ở chỗ plan thật cho thấy ước lượng sai gây hại, rồi đo lại.

#### Bẫy cần tránh

- Tin bảng biến "nằm trong RAM nên nhanh hơn".
- `SELECT ... INTO #t` rồi `CREATE INDEX` trong proc gọi dày: mất caching.
- Lưu danh sách mã vào một cột chuỗi rồi `LIKE '%x%'`.

#### Nhớ nhanh

- Bảng biến: không statistics; 2019 chỉ sửa tổng số dòng.
- Bảng tạm: có statistics, có thể recompile; khai báo index trong `CREATE` để giữ caching.
- TVP cho danh sách từ app; `#temp` cho tập giữa các proc.
- JSON, XML, `STRING_SPLIT` dùng ở ranh giới hệ thống.

#### Bài tập

1. So ước lượng và reads của câu join 100.000 ID với `Student` khi dùng bảng biến, ở level 160 và khi thêm `OPTION (USE HINT('DISABLE_DEFERRED_COMPILATION_TV'))`.
   **Đáp án:**
   ```sql
   DECLARE @t TABLE (Id INT NOT NULL PRIMARY KEY);
   INSERT @t SELECT StudentId FROM dbo.Student WHERE StudentId % 10 = 0;
   SELECT COUNT(*) FROM @t t JOIN dbo.Student s ON s.StudentId = t.Id WHERE s.Grade = 6;
   SELECT COUNT(*) FROM @t t JOIN dbo.Student s ON s.StudentId = t.Id WHERE s.Grade = 6
   OPTION (USE HINT('DISABLE_DEFERRED_COMPILATION_TV'));
   ```
   Có deferred compilation: ước lượng `@t` 100.000 dòng, plan hợp lý (thường Merge hoặc Hash Join). Tắt đi: ước lượng 1 dòng, Nested Loops với 100.000 lần seek (khoảng 300.000 reads). `#temp` cho ước lượng đúng và có statistics nếu lọc thêm trên cột của nó.
2. Tạo kiểu `dbo.IntList` và proc `dbo.GetSchoolNames`, gọi bằng `DECLARE @ids dbo.IntList; INSERT @ids VALUES (1),(2),(500); EXEC dbo.GetSchoolNames @ids;`. Plan thật ước lượng `@Ids` bao nhiêu dòng?
   **Đáp án:** Ghi con số trên máy bạn và so với 3 dòng thật; gọi lại với 1.000 ID để xem plan có được dùng lại với ước lượng cũ không. Kết luận: luôn kiểm tra ước lượng TVP bằng plan thật; tập lớn thì chép sang `#temp`.
3. Viết hai proc: (A) `CREATE TABLE #t (Id INT)` rồi `ALTER TABLE #t ADD Name NVARCHAR(100)`; (B) khai báo đủ cột và PK ngay trong `CREATE`. Gọi mỗi proc 1.000 lần, đọc bộ đếm `Temp Tables Creation Rate` trước và sau.
   **Đáp án:** Với (A) bộ đếm tăng khoảng 1.000 vì mỗi lần gọi tạo bảng tạm mới; với (B) tăng rất ít nhờ caching. Đọc bằng `SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Temp Tables Creation Rate';`.

### Bài 19.6. Set-based, phân trang, đếm và sắp xếp

#### Kiến thức

##### Từ từng dòng sang theo tập

RBAR (row by agonizing row) là cursor, vòng `WHILE`, hay gọi proc cho từng dòng. Mỗi câu trong vòng lặp trả một chi phí cố định: thực thi plan, lấy và nhả khoá, ghi log, latch trang. Một câu theo tập trả chi phí đó một lần và cho optimizer chọn Hash/Merge Join thay vì seek lặp.

```sql
-- Set-based: cập nhật tỉnh, huyện của học sinh theo trường, một câu
UPDATE s SET s.ProvinceId = sc.ProvinceId, s.DistrictId = sc.DistrictId
FROM dbo.Student s JOIN dbo.School sc ON sc.SchoolId = s.SchoolId
WHERE s.StudentId <= 100000 AND (s.ProvinceId <> sc.ProvinceId OR s.DistrictId <> sc.DistrictId);
```

Điều kiện `<>` ở cuối tránh ghi lại dòng không đổi, giảm log và khoá.

Cập nhật hàng chục triệu dòng trong một câu thì giữ khoá lâu, có thể leo thang khoá lên cả bảng (khoảng 5.000 khoá trên một đối tượng), log phình, replica trễ. Cách làm: vẫn theo tập nhưng chia lô theo khoá, mỗi lô vài nghìn dòng trong một transaction ngắn.

```sql
DECLARE @from INT = 0, @batch INT = 5000, @max INT = (SELECT MAX(StudentId) FROM dbo.Student);
WHILE @from < @max
BEGIN
    UPDATE dbo.Student SET Status = 1
    WHERE StudentId > @from AND StudentId <= @from + @batch AND Status = 0;
    SET @from += @batch;
END;
```

`WHILE` chia lô vẫn là set-based vì mỗi vòng xử lý hàng nghìn dòng; RBAR là mỗi vòng một dòng.

##### Upsert an toàn

Xoá hết rồi chèn lại sinh log gấp đôi, làm statistics nhảy, và để người đọc thấy khoảng trống dữ liệu. Thay bằng cập nhật phần đổi, chèn phần mới. `MERGE` gọn nhưng không tự an toàn khi ghi đồng thời: hai phiên cùng thấy "chưa có" và cùng chèn. Cần `WITH (HOLDLOCK)` trên bảng đích; `MERGE` còn có lịch sử lỗi ở vài kịch bản, nên nhiều đội chọn mẫu tách rời:

```sql
BEGIN TRAN;
UPDATE t SET t.Score = s.Score
FROM dbo.DailyScore t WITH (UPDLOCK, SERIALIZABLE)
JOIN #src s ON s.StudentId = t.StudentId AND s.Day = t.Day;

INSERT dbo.DailyScore (StudentId, Day, Score)
SELECT s.StudentId, s.Day, s.Score FROM #src s
WHERE NOT EXISTS (SELECT 1 FROM dbo.DailyScore t WITH (UPDLOCK, SERIALIZABLE)
                  WHERE t.StudentId = s.StudentId AND t.Day = s.Day);
COMMIT;
```

##### Phân trang keyset

`OFFSET @n ROWS FETCH NEXT 20 ROWS ONLY` đọc `n + 20` dòng rồi bỏ `n` dòng đầu: trang càng sâu càng chậm, và dữ liệu chèn giữa hai lần bấm làm trùng hoặc sót dòng. Keyset pagination nhớ khoá của dòng cuối trang trước và seek thẳng tới sau nó. T-SQL **không** hỗ trợ so sánh bộ giá trị kiểu `(a, b) > (@a, @b)`; phải viết tách:

```sql
CREATE INDEX IX_Student_School_Created ON dbo.Student (SchoolId, CreatedAt) INCLUDE (FullName);

-- Trang đầu
SELECT TOP (20) StudentId, FullName, CreatedAt
FROM dbo.Student WHERE SchoolId = @s
ORDER BY CreatedAt, StudentId;

-- Trang sau: @lastCreated, @lastId là giá trị của dòng cuối trang trước
SELECT TOP (20) StudentId, FullName, CreatedAt
FROM dbo.Student
WHERE SchoolId = @s
  AND (CreatedAt > @lastCreated OR (CreatedAt = @lastCreated AND StudentId > @lastId))
ORDER BY CreatedAt, StudentId;
```

Thứ tự sắp phải kết thúc bằng cột duy nhất (`StudentId`) để không trùng, sót. Index không unique tự mang khoá clustered `StudentId` ở cuối key, nên khớp đúng `ORDER BY CreatedAt, StudentId`. Đánh đổi: không nhảy thẳng tới trang 500 được, chỉ có trang sau, trang trước.

##### Đếm tổng, sắp động, tổng hợp

- **Đếm tổng**: `SELECT COUNT(*)` riêng là quét thêm một lần; `COUNT(*) OVER ()` buộc tính trên toàn tập khớp. Lựa chọn: lấy `TOP (n + 1)` để biết còn trang sau; chỉ đếm ở trang đầu rồi cache theo bộ lọc; hiển thị số xấp xỉ; tổng cả bảng thì đọc `sys.dm_db_partition_stats`.
- **`ORDER BY` động**: `ORDER BY CASE @sort WHEN 1 THEN FullName END, ...` làm optimizer không dùng được thứ tự của index nào, luôn phải Sort. Tách nhánh theo kiểu sắp, hoặc dynamic SQL chỉ nhận tên cột từ danh sách cho phép.
- **Báo cáo tổng hợp**: `GROUP BY` toàn bảng giao dịch mỗi lần mở báo cáo là quét lại toàn bộ lịch sử. Thay bằng bảng tổng hợp theo ngày, job chỉ tính phần dữ liệu mới từ mốc lần chạy trước. Indexed view là cách khác, nhưng tăng chi phí ghi và trên Standard cần hint `NOEXPAND`.

#### Cách show off

Chất liệu thật:
- Proc lấy điểm danh theo sự kiện: vòng `WHILE`, mỗi vòng `OPENJSON` rồi `DELETE` từng dòng trên bảng biến không index, trung bình gần 5 giây. Bản viết lại là một câu set-based dùng `CROSS APPLY OPENJSON`. [điền: xác nhận ai viết lại proc này, số đo sau]
- Job xếp hạng tháng chạy khoảng 100 giây một lần, mỗi lần tính lại toàn bộ thay vì phần thay đổi.
- Job báo cáo giao dịch theo ngày xoá rồi chèn lại; báo cáo doanh thu `GROUP BY` cả bảng giao dịch.
- Proc tìm kiếm giải thưởng sắp xếp hai lần, `COUNT` riêng, `EXISTS` từng dòng.

> **Ví dụ:** "Có một proc lấy điểm danh theo sự kiện mất gần 5 giây mỗi lần. Bên trong là vòng lặp: mỗi vòng parse một mảnh JSON rồi xoá từng dòng trong một bảng biến không có index. Mỗi câu trong vòng lặp đều trả chi phí cố định của một câu lệnh, nhân lên hàng nghìn lần. Viết lại thành một câu duy nhất, parse cả mảng JSON bằng `CROSS APPLY OPENJSON` rồi lọc theo tập, thì không còn vòng lặp nào. Ở cùng đợt đó tôi cũng thấy một job xếp hạng chạy khoảng 100 giây một lần và lần nào cũng tính lại từ đầu; ở đây câu hỏi đúng không phải viết SQL nhanh hơn mà là nghiệp vụ có cần tươi tới mức đó không, và có tính tăng dần được không."

Điểm ăn điểm:
- Nói được vì sao RBAR chậm bằng chi phí cố định mỗi câu lệnh.
- Viết keyset đúng cú pháp T-SQL, biết thêm cột duy nhất cuối `ORDER BY`.
- Biết `MERGE` không tự an toàn khi ghi đồng thời.
- Hỏi lại tần suất nghiệp vụ trước khi tối ưu một job chạy dày.

#### Câu hỏi vặn

- **"Vì sao `OFFSET 100000 FETCH 20` chậm dù có index?"** SQL vẫn đọc 100.020 dòng theo index rồi bỏ 100.000 dòng đầu. Keyset pagination seek thẳng tới vị trí sau khoá cuối của trang trước.
- **"Viết keyset pagination trong T-SQL khi sắp theo cột không duy nhất?"** Thêm cột duy nhất (Id) vào cuối `ORDER BY`, viết điều kiện tách `CreatedAt > @c OR (CreatedAt = @c AND Id > @id)`, vì T-SQL không hỗ trợ so sánh bộ giá trị. Index `(cột lọc bằng, CreatedAt)` với khoá clustered `Id` ở cuối để seek và không Sort.
- **"`MERGE` có an toàn khi nhiều phiên cùng upsert?"** Không tự an toàn: hai phiên cùng không thấy dòng và cùng chèn. Thêm `WITH (HOLDLOCK)` trên bảng đích để giữ khoá dải. Nhiều đội tránh `MERGE` vì lịch sử lỗi, dùng `UPDATE` rồi `INSERT ... WHERE NOT EXISTS` với `UPDLOCK, SERIALIZABLE` trong một transaction.
- **"API phân trang cần trả tổng số dòng, làm sao để không chậm?"** Không đếm lại toàn tập mỗi trang. Chỉ đếm ở trang đầu và cache theo bộ lọc; hoặc trả "còn trang sau" bằng `TOP (n + 1)`; hoặc hiển thị số xấp xỉ. Tổng cả bảng thì đọc `sys.dm_db_partition_stats`.
- **"Cần cập nhật 10 triệu dòng trên bảng đang có người dùng?"** Chia lô theo khoá clustered, mỗi lô vài nghìn dòng trong transaction ngắn, chỉ cập nhật dòng thực sự đổi. Tránh leo thang khoá, log phình, replica trễ; theo dõi blocking, dừng được và chạy tiếp từ khoá cuối.
- **"Job xếp hạng chạy 100 giây một lần, anh tối ưu thế nào?"** Trước hết hỏi nghiệp vụ cần độ tươi bao nhiêu; nhiều khi vài phút là đủ. Sau đó chuyển sang tính tăng dần: chỉ xử lý điểm thay đổi từ mốc lần trước, hoặc cập nhật bảng xếp hạng theo sự kiện (Redis sorted set). Cuối cùng mới tới tối ưu câu SQL của job.

#### Bẫy cần tránh

- Chép mẫu keyset `(a, b) > (@a, @b)` từ PostgreSQL: T-SQL báo lỗi cú pháp.
- `MERGE` không `HOLDLOCK` dưới tải đồng thời: lỗi trùng khoá hoặc chèn trùng.
- Chia lô bằng `OFFSET` hoặc `TOP` không theo khoá: mỗi lô sau quét lại phần đã xử lý.

#### Nhớ nhanh

- Một câu theo tập thay cho hàng nghìn câu từng dòng; cập nhật lớn chia lô theo khoá.
- Upsert cần khoá đúng (`HOLDLOCK` hoặc `UPDLOCK, SERIALIZABLE`).
- `OFFSET` trang sâu đọc rồi bỏ; keyset seek thẳng, điều kiện viết tách trong T-SQL.
- Đếm tổng và `ORDER BY` động làm mất lợi thế index.
- Báo cáo đọc bảng tổng hợp tính tăng dần.

#### Bài tập

1. Tạo `CREATE INDEX IX_Student_Created_Name ON dbo.Student (CreatedAt) INCLUDE (FullName);`. So logical reads của `ORDER BY CreatedAt, StudentId OFFSET 500000 ROWS FETCH NEXT 20 ROWS ONLY` và câu keyset tương đương (lấy `@lastCreated`, `@lastId` là dòng thứ 500.000).
   **Đáp án:** `OFFSET` đọc khoảng 500.020 dòng của index, cỡ vài nghìn trang; keyset đọc 3–4 trang. Lấy mốc bằng `SELECT CreatedAt, StudentId FROM dbo.Student ORDER BY CreatedAt, StudentId OFFSET 499999 ROWS FETCH NEXT 1 ROWS ONLY;`.
2. Đặt sai `ProvinceId` cho 100.000 học sinh đầu (`UPDATE dbo.Student SET ProvinceId = 0 WHERE StudentId <= 100000;`), rồi sửa lại bằng (A) cursor cập nhật từng dòng và (B) câu `UPDATE ... JOIN` trong bài. So thời gian và lượng log.
   **Đáp án:** (A) chạy 100.000 câu `UPDATE`, mỗi câu một lần seek và một bản ghi log riêng, thường mất hàng chục giây; (B) một câu, vài giây hoặc nhanh hơn. Đo log bằng `sys.dm_tran_database_transactions` trong transaction, hoặc so `SET STATISTICS TIME`.
3. Viết upsert vào `dbo.DailyScore (StudentId INT, Day DATE, Score INT, PRIMARY KEY (StudentId, Day))` từ `#src`, an toàn khi hai phiên chạy đồng thời. Kiểm tra bằng cách chạy cùng lúc ở hai cửa sổ với cùng dữ liệu.
   **Đáp án:** Dùng mẫu `UPDATE` + `INSERT ... WHERE NOT EXISTS` với `UPDLOCK, SERIALIZABLE` trong một transaction như trong bài. Phiên thứ hai chờ phiên đầu, sau đó chỉ `UPDATE`, không lỗi trùng khoá. Bỏ hint thì có thể gặp lỗi vi phạm PRIMARY KEY khi hai phiên cùng chèn.
