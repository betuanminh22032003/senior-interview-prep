# Phần VI. Tối ưu SQL Server

Phần này dạy tối ưu SQL Server theo đúng thứ tự một người làm hiệu năng thực tế đi qua: đo, tìm chỗ tốn nhất, đọc plan, rồi mới sửa bằng index, cách viết truy vấn, cấu hình server. Mọi ví dụ lấy từ báo cáo nội bộ "Phân tích hiệu năng API trên APM và giải pháp tối ưu hệ thống IOE", rà soát 6 cụm SQL Server theo vai trò: (1) log tự luyện và thi thử, (2) core: user, danh mục, trường học, feed, (3) log thi chính thức, (4) kho dữ liệu và báo cáo chứng nhận, (5) user GDPT và đăng ký thi, (6) ngân hàng câu hỏi, sinh đề và billing. Đợt rà soát lại ngày 06/10/2026. Giáo trình không ghi IP, tên server, tên proc hay bảng thật; mỗi ví dụ ghi vị trí trong báo cáo dạng "(Cụm X – Mục Y)", còn "Vấn đề N" là các mục phân tích API ở đầu báo cáo. Một số ví dụ tham chiếu thêm `G:\portfolio\resume\interview-prep.md` dạng "(nguồn: mục 4.4)".

Thứ tự học: T1 (đo trước khi sửa, Chương 17) → T2 (index, Chương 18) → T3 (viết truy vấn để optimizer hiểu, Chương 19) là phần lõi, đủ để tự xử lý phần lớn vấn đề trong báo cáo. Sau đó T4 (server và vận hành), T5; T6 dùng để luyện phản biện khi phỏng vấn; T7 mở rộng sang các mảng tối ưu báo cáo chưa đụng tới. T4–T7 nằm ở các chương sau của Phần VI.

**Tài liệu nên đọc:** Microsoft Learn: *Query processing architecture guide*, *Index architecture and design guide*, *Statistics*; Grant Fritchey, *SQL Server Execution Plans* (ebook miễn phí của Redgate); Itzik Ben-Gan, *T-SQL Querying*; blog của Paul White, Erik Darling, Brent Ozar.

**Công cụ:** First Responder Kit (`sp_Blitz`, `sp_BlitzCache`, `sp_BlitzIndex`, `sp_BlitzFirst`), `sp_WhoIsActive`, Query Store, Plan Explorer, Ola Hallengren Maintenance Solution.

**Môi trường lab dùng chung.** Bài tập trong Phần VI chạy trên SQL Server 2019/2022 Developer Edition (miễn phí, đủ tính năng Enterprise). Script dưới tạo database `LabPerf` với ba bảng giả định: `School` (20.001 trường), `Student` (1 triệu học sinh, phân bố lệch: trường số 1 có 200.000 học sinh, mỗi trường còn lại 40), `ExamResult` (2 triệu bài thi, mỗi học sinh 2 bài). Chạy mất khoảng 1 phút, chiếm vài trăm MB. Các con số `logical reads` nêu trong bài là xấp xỉ; trên máy bạn có thể lệch vài phần trăm.

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

## Chương 17. Đo trước khi sửa

Chương này dạy cách tìm đúng chỗ cần sửa trước khi đụng vào index hay câu lệnh. Nguyên tắc: không sửa theo cảm giác. Tìm chỗ tốn nhất theo tổng tải (thời gian × số lần gọi), đọc xem server đang chờ gì, đọc plan để biết vì sao chậm, rồi mới chọn cách sửa.

Interviewer hỏi phần này để phân biệt người "biết thêm index" với người có quy trình. Câu hỏi điển hình: "Hệ thống chậm, bạn bắt đầu từ đâu?". Câu trả lời tốt đi theo chuỗi: APM trace → DMV/Query Store → wait stats → execution plan → sửa → đo lại với cùng thước đo.

Học xong chương, bạn đọc được trace APM để nhận ra N+1 và việc đồng bộ thừa, viết được truy vấn DMV tìm top proc tốn nhất, phân loại wait stats, và đọc execution plan để chọn hướng sửa.

### Bài 17.1. Đọc APM trace: N+1, gọi lặp, việc đồng bộ thừa
**Viz:** request-timeline

#### Mục tiêu
- Sau bài này, bạn đọc được cây span của một request trong APM và tính được phần thời gian nào do SQL, cache, gọi ra ngoài.
- Nhận dạng được N+1 và phân biệt hai dạng: cùng tham số (thiếu cache trong request) và khác tham số (thiếu truy vấn theo lô).
- Giải thích được vì sao "gọi SQL quá nhiều lần" có thể tệ hơn "một câu SQL chậm", và ưu tiên sửa theo tổng tải.
- Tách được việc không cần cho response ra khỏi đường đi của request.

#### Kiến thức nền
**Trace và span.** APM (Elastic APM, OpenTelemetry) ghi mỗi request thành một *transaction* (hay *trace*), bên trong là cây *span*: mỗi lần gọi SQL, Redis, HTTP, gRPC là một span có thời điểm bắt đầu và độ dài. Thời gian request bằng tổng các span chạy tuần tự cộng phần CPU của chính app (self time). Span chạy song song (`Task.WhenAll`) chồng lên nhau trên trục thời gian; khi đó tổng thời lượng span lớn hơn thời gian request. Dùng mô phỏng ở trên để thấy timeline thay đổi thế nào khi gom lời gọi và đẩy việc ra nền.

**N+1.** Một câu lấy danh sách N dòng, rồi với mỗi dòng gọi thêm một câu nữa. Trên trace, dấu hiệu là cùng một câu SQL (cùng tên proc) lặp lại nhiều lần trong một request. Có hai dạng, cách sửa khác nhau:

| Dạng | Dấu hiệu | Gốc rễ | Cách sửa |
|---|---|---|---|
| Cùng tham số | 5 span cùng proc, cùng `userId` | Mỗi hàm con tự đọc lại DB | Đọc một lần, truyền object xuống (request-scope cache) |
| Khác tham số theo dòng | 20–100 span cùng proc, tham số là Id của từng dòng | Vòng lặp gọi DB | Một truy vấn theo tập: `IN (...)`, TVP, `JOIN` |

**Vì sao nhiều lời gọi nhỏ vẫn đắt.** Mỗi lời gọi DB, dù câu lệnh chỉ chạy 1 ms trong SQL Server, còn tốn: một round-trip mạng (thường 0,2–1 ms trong cùng trung tâm dữ liệu), mượn và trả kết nối từ pool, tra plan cache, gửi tham số và serialize kết quả. Trên DB, mỗi lần chạy là một lần lấy worker thread, lấy khoá, ghi thống kê. Vì vậy 5 lần × 15 ms tệ ngang một câu 75 ms về latency, và tệ hơn về tải: 5 lần chiếm kết nối, 5 lần chiếm worker.

**Tổng tải.** Ưu tiên sửa theo `thời gian mỗi lần × số lần gọi mỗi giây`, không theo câu chậm nhất. Một proc 0,12 ms chạy 112 triệu lần vẫn là tải đáng kể.

**Việc đồng bộ thừa.** Việc không ảnh hưởng tới response (bắn event, ghi lịch sử, upload log) không nên nằm trên đường đi của request. Lưu ý cơ chế `async` trong .NET: một phương thức `async` chạy **đồng bộ** trên thread gọi nó cho tới `await` đầu tiên chưa hoàn tất. Viết `_ = SendAsync()` không đưa phần đó ra nền; nếu phần đầu của `SendAsync` tạo `GrpcChannel` mới (mở socket, bắt tay HTTP/2), request vẫn phải chờ.

```csharp
// Trước: mỗi bước kiểm tra tự đọc lại vị trí người dùng (5 lần gọi cùng proc)
await CheckRegionAsync(userId);
await CheckGradeAsync(userId);
await CheckSchoolAsync(userId);

// Sau: đọc một lần, truyền object xuống
var loc = await _userRepo.GetLocationAsync(userId);
CheckRegion(loc); CheckGrade(loc, dto); CheckSchool(loc);

// Trước: vòng lặp theo mã dịch vụ, mỗi mã một lần gọi DB
foreach (var code in serviceCodes)
    rounds.Add(await _repo.GetRoundAsync(userId, code));

// Sau: một lần gọi lấy mọi dòng của user, lọc trong bộ nhớ
var all = await _repo.GetRoundsByUserAsync(userId);
var rounds2 = all.Where(r => serviceCodes.Contains(r.ServiceCode)).ToList();

// Event: channel dùng chung (singleton), gửi hẳn ra nền
_ = Task.Run(async () =>
{
    try { await _eventClient.PushAsync(evt); }
    catch (Exception ex) { _logger.LogWarning(ex, "Push event failed"); }
});
```

#### Trong báo cáo
- API cập nhật thông tin người dùng 504 ms (Vấn đề 3): proc lấy vị trí người dùng gọi 5 lần cho cùng một user (15 + 15 + 14 + 11 + 15 ms); proc kiểm tra điều kiện thi gọi 5 lần (khoảng 24 ms); vòng `foreach` theo 2 mã dịch vụ gọi DB 2 lần (65 + 67 ms); một proc lọc học sinh 94 ms khi trượt cache.
- Cũng trong API đó: mỗi lần bắn event tạo `GrpcChannel` mới, giữ luồng HTTP 9,2 ms dù đã viết `_ = ...`.
- Luồng lấy bảng xếp hạng: vòng lặp gọi tra cứu tỉnh, huyện cho từng dòng Top, thành 20–100 lượt gọi DB mỗi request (Cụm 4 – Mục 11).
- Một proc đọc thông tin rẻ (0,12 ms) nhưng chạy 112 triệu lần (Cụm 5 – Mục 4).
- Span không phải SQL cũng đọc theo cách này: API bắt đầu thi thử 2,45 s, trong trace có 472 lệnh `SCAN` và 17 lệnh `UNLINK` trên Redis (nguồn: mục 2).

#### Cách sửa
- Nạp dữ liệu một lần ở đầu luồng, truyền object xuống các hàm con thay vì để mỗi hàm tự đọc lại DB.
- Gom vòng lặp thành một truy vấn theo tập (`WHERE code IN (...)` hoặc TVP). Kiểm tra proc mới trả đủ dòng cho mọi phần tử, không chỉ dòng đầu.
- Danh mục ít đổi (tỉnh, huyện, trường): nhớ trong request (dictionary), rồi cache Redis TTL dài.
- `GrpcChannel`, `HttpClient` dùng lại (singleton, `IHttpClientFactory`); event đẩy ra hàng đợi nền (`Channel<T>` + `BackgroundService`, hoặc message broker nếu không được mất).

#### Kiểm chứng
- So số span và tổng thời gian trên APM trước và sau, cùng loại request, cùng khung giờ. Với API cập nhật thông tin người dùng, báo cáo đặt mục tiêu phần kiểm tra logic giảm từ 149–504 ms xuống dưới 60 ms sau khi bỏ gọi lặp; con số này cần được đo lại trên APM trước khi nói là đã đạt.
- Trên DB: tốc độ tăng `execution_count` của proc bị gọi lặp trong `sys.dm_exec_procedure_stats` phải giảm tương ứng.

#### Bẫy
- Gom lô xong quên kiểm tra proc có lọc theo tham số cũ không: nếu proc vốn chỉ trả một dòng theo mã dịch vụ, gọi một lần sẽ thiếu dữ liệu.
- Request-scope cache khác cache dùng chung: chỉ sống trong một request, không cần invalidation. Đừng biến nó thành biến `static`.
- Fire-and-forget có thể mất việc khi process chết. Việc bắt buộc phải xảy ra (trừ tiền, cấp quà) cần hàng đợi bền, không dùng `Task.Run`.

#### Câu hỏi phỏng vấn
- **"API A có một câu SQL 80 ms. API B gọi một câu 2 ms 40 lần. Sửa cái nào trước?"** Latency bằng nhau nhưng B tốn 40 round-trip, 40 lần mượn kết nối và 40 lần chiếm worker trên DB. Ưu tiên theo tổng tải: thời gian × số lần gọi mỗi giây của cả API. Với B, gom lô hoặc cache thường rẻ hơn tối ưu câu 80 ms của A.
- **"Nhìn trace APM, làm sao biết có N+1?"** Cùng một câu SQL hoặc cùng proc xuất hiện nhiều lần trong một transaction. Cùng tham số thì thiếu cache trong request; tham số đổi theo từng dòng của kết quả trước thì thiếu truy vấn theo lô.
- **"Đã viết `_ = SendEventAsync()` mà request vẫn bị giữ 9 ms. Vì sao?"** Phương thức `async` chạy đồng bộ trên thread gọi cho tới `await` đầu tiên chưa hoàn tất. Phần tạo `GrpcChannel` mới, mở kết nối nằm trước `await` đó. Sửa: channel dùng chung, và đưa việc gửi ra nền bằng `Task.Run` hoặc hàng đợi.
- **"Request-scope cache khác Redis cache thế nào?"** Request-scope cache chỉ sống trong một request, không chia sẻ, không lo invalidation; mục đích là khử gọi lặp trong cùng một luồng. Redis cache chia sẻ giữa các request và instance, cần TTL và chiến lược invalidation.
- **"Fire-and-forget có rủi ro gì, khi nào không được dùng?"** Mất việc khi process chết hoặc deploy giữa chừng, lỗi không quay về caller, khó retry. Không dùng cho việc có nghĩa vụ nghiệp vụ; khi đó ghi vào hàng đợi bền (outbox, Kafka) rồi xử lý bất đồng bộ.

#### Tóm tắt
- Thời gian request = tổng span tuần tự + self time; đọc trace để biết thời gian nằm ở đâu.
- N+1 có hai dạng: cùng tham số → đọc một lần; khác tham số → truy vấn theo tập.
- Ưu tiên theo tổng tải (thời gian × số lần gọi), không theo câu chậm nhất.
- `_ = TaskAsync()` không đưa phần đồng bộ ra nền; client gRPC/HTTP phải dùng lại.
- Đo lại bằng cùng trace APM và tốc độ tăng `execution_count`.

#### Bài tập
1. Một request có các span tuần tự: proc A 15 ms × 5 lần, proc B 4,8 ms × 5 lần, proc C 65 ms và 67 ms, gRPC 9,2 ms, self time 20 ms. Tính thời gian request, và thời gian sau khi: A gọi 1 lần, B gọi 1 lần, C gộp thành một lần 70 ms, gRPC ra nền.
   **Đáp án:** Trước: 75 + 24 + 132 + 9,2 + 20 = 260,2 ms. Sau: 15 + 4,8 + 70 + 0 + 20 = 109,8 ms. Phần lớn lợi ích đến từ bỏ gọi lặp, không phải từ tối ưu câu lệnh.
2. Trên `LabPerf`, mô phỏng N+1 trong T-SQL: viết vòng `WHILE` lấy tên trường cho 1.000 học sinh đầu tiên (mỗi vòng một `SELECT` vào `School`), so với một câu `JOIN`. Bật `SET STATISTICS TIME ON` và so tổng thời gian; sau đó xem `execution_count` của câu lấy tên trường trong `sys.dm_exec_query_stats`.
   **Đáp án:** Vòng lặp chạy 1.000 câu, mỗi câu 2–3 logical reads trên `PK_School`, cộng chi phí thực thi từng câu; `JOIN` chỉ một câu, thường một Merge hoặc Hash Join. `execution_count` của câu trong vòng lặp là 1.000. Qua mạng thật, mỗi câu còn thêm một round-trip.
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
3. Viết lại đoạn C# sau để chỉ gọi DB một lần: `foreach (var row in top100) row.ProvinceName = await _repo.GetProvinceNameAsync(row.ProvinceId);`.
   **Đáp án:** Lấy tập `ProvinceId` khác nhau, gọi một lần `GetProvinceNamesAsync(ids)` (proc nhận TVP hoặc danh sách), dựng `Dictionary<int,string>`, rồi gán trong bộ nhớ. Danh mục tỉnh ít đổi nên tốt hơn nữa là cache cả danh mục trong Redis hoặc `IMemoryCache` TTL dài.

### Bài 17.2. DMV và Query Store: tìm truy vấn tốn nhất

#### Mục tiêu
- Sau bài này, bạn viết được truy vấn DMV xếp hạng proc và câu lệnh theo tổng CPU, reads, spill, grant.
- Giải thích được vì sao DMV mất số liệu và khi nào cần Query Store.
- Đọc được gợi ý missing index và biết vì sao không tạo ngay.
- Phân biệt được "nhiều dòng trong `dm_exec_query_stats`" và "nhiều plan".

#### Kiến thức nền
**Plan cache và DMV thống kê.** Khi một proc hoặc câu lệnh được compile, plan được lưu trong plan cache. SQL Server gắn số liệu chạy (số lần, CPU, reads, thời gian) vào chính plan đó. Hệ quả: plan bị đẩy khỏi cache (áp lực bộ nhớ, `ALTER PROCEDURE`, `sp_recompile`, cập nhật statistics, restart) thì số liệu mất theo.

- `sys.dm_exec_procedure_stats`: một dòng cho mỗi proc đang có plan trong cache. Cột chính: `execution_count`, `total_worker_time` (CPU, micro giây), `total_elapsed_time` (micro giây), `total_logical_reads`, `total_spills` (2016 SP2+/2017+), `cached_time`, `last_execution_time`.
- `sys.dm_exec_query_stats`: một dòng cho mỗi **câu lệnh** trong một plan. Proc 5 câu thì có 5 dòng cùng `plan_handle`, phân biệt bằng `statement_start_offset`/`statement_end_offset`. Thêm các cột `total_grant_kb`, `max_used_grant_kb`, `total_spills`, `min_*`/`max_*`, `query_hash`, `query_plan_hash`.
- Đơn vị: thời gian tính bằng micro giây; reads tính bằng trang 8 KB.

```sql
-- Top 20 câu lệnh theo tổng CPU, kèm text câu lệnh
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

Đổi `ORDER BY` sang `total_logical_reads`, `total_spills`, `max_grant_kb` để có bốn bảng xếp hạng. Xếp theo **tổng**, vì tổng mới là tải server phải gánh; xếp theo trung bình chỉ tìm ra câu chậm cho một người dùng.

**Missing index DMV.** Khi optimizer compile và thấy một index giả định sẽ giúp, nó ghi gợi ý vào `sys.dm_db_missing_index_details` (cột `equality_columns`, `inequality_columns`, `included_columns`) và `sys.dm_db_missing_index_group_stats` (`user_seeks`, `user_scans`, `avg_total_user_cost`, `avg_user_impact`). Điểm ưu tiên thường dùng: `avg_total_user_cost × avg_user_impact × (user_seeks + user_scans)`. Đây là gợi ý ghi lại lúc compile, không phải lệnh.

**Index usage.** `sys.dm_db_index_usage_stats` cho biết mỗi index có bao nhiêu `user_seeks`, `user_scans`, `user_lookups`, `user_updates` kể từ lần khởi động. Index có `user_updates` cao mà seek/scan/lookup bằng 0 là index chết: chỉ tốn chi phí ghi.

**Query Store.** Lưu lịch sử bền vững trong chính database: mỗi câu là một `query_id`, mỗi plan là một `plan_id`, số liệu chạy gom theo khoảng thời gian (`sys.query_store_runtime_stats`, `_interval`), từ 2017 có thêm wait theo truy vấn (`sys.query_store_wait_stats`). Không mất khi restart hay khi plan bị đẩy khỏi cache, cho phép so trước và sau một lần deploy và ép plan (`sp_query_store_force_plan`). SQL Server 2022 bật Query Store mặc định cho database mới. Cấu hình cần biết:

```sql
ALTER DATABASE LabPerf SET QUERY_STORE = ON (
    OPERATION_MODE = READ_WRITE,
    QUERY_CAPTURE_MODE = AUTO,         -- bỏ qua câu ad hoc chạy ít, rẻ
    MAX_STORAGE_SIZE_MB = 1024,        -- đầy thì chuyển sang READ_ONLY
    INTERVAL_LENGTH_MINUTES = 15,
    CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30));
```

**Quy tắc ghi số đo.** Luôn ghi kèm uptime (`sys.dm_os_sys_info.sqlserver_start_time`), `cached_time` của plan và thời điểm đo. Cách làm bền: job chụp DMV định kỳ vào bảng lịch sử, so chênh lệch giữa hai lần chụp.

#### Trong báo cáo
- Proc tin tức theo chuyên mục: chỉ 3.485 reads/lần nhưng 3,37 triệu lần, cộng dồn khoảng 11,7 tỷ reads (Cụm 2 – Mục 8).
- Proc thống kê hạng: 23 ms CPU/lần nhưng 9,1 triệu lần, 58,6 giờ CPU, điểm nóng CPU lớn nhất (Cụm 4 – Mục 7).
- Proc lấy danh mục môn/vòng: khoảng 81,16 triệu lần, 3,7 ms và 244 reads mỗi lần, cộng dồn khoảng 19,8 tỷ reads; gốc rễ là TTL cache 1 giây và kết quả rỗng không được cache (nguồn: mục 4.1).
- Index đã tạo nhưng DMV vẫn đòi: tạo sai cột dẫn đầu, thiếu cột `INCLUDE`, thiếu cột năm báo cáo và 0 lượt dùng (Cụm 2 – Mục 10, Cụm 4 – Mục 12).

#### Cách sửa
- Có sẵn bộ truy vấn: top theo CPU, reads, spill, grant. Lưu ảnh chụp định kỳ vào bảng để so qua các lần restart.
- Trước khi tạo index theo DMV: gộp các gợi ý trùng tiền tố, đối chiếu index đang có (`sp_BlitzIndex`), tính chi phí ghi.
- Sau khi tạo: kiểm tra `index_usage_stats` có seek và DMV thôi đòi.
- Proc rẻ nhưng chạy hàng chục triệu lần: sửa ở tầng app (cache, bỏ gọi lặp), không phải ở SQL.

#### Kiểm chứng
- Proc giảm reads/CPU trong `dm_exec_procedure_stats` sau 24 giờ; gợi ý missing index tương ứng biến mất.
- `ALTER PROCEDURE` xoá plan cũ nên số liệu của proc bắt đầu lại từ 0: số mới chỉ tính các lần chạy sau deploy. Ghi số trước khi deploy, hoặc dùng Query Store để so hai khoảng thời gian.

#### Bẫy
- Nhiều dòng trong `dm_exec_query_stats` cho cùng một proc thường là nhiều **câu lệnh** của cùng một plan, không phải nhiều plan. Báo cáo ghi "10 plan khác nhau" cho proc Top N xếp hạng, nhưng 3 dòng có cùng `execution_count` bằng đúng số lần gọi proc: dấu hiệu đó là các câu chạy mỗi lần gọi (Cụm 4 – Mục 8). Kiểm tra `plan_handle`, `statement_start_offset`, hoặc Query Store (nhiều `plan_id` cho cùng `query_id`) trước khi kết luận parameter sniffing.
- Proc dùng `WITH RECOMPILE` hoặc câu ad hoc không tham số hoá có thể không nằm lại trong cache, nên không xuất hiện trong top dù tốn. Query Store bắt được những câu này.
- `sys.dm_db_index_usage_stats` reset khi restart hoặc database offline; index "0 lượt dùng" sau 2 ngày uptime chưa đủ bằng chứng để xoá. Cân nhắc job chạy theo tháng, quý.

#### Câu hỏi phỏng vấn
- **"Vì sao không tạo ngay mọi index trong missing index DMV?"** DMV không biết index tương tự đã có, không tính chi phí ghi, bỏ qua thứ tự `ORDER BY`, xếp cột theo kiểu bằng rồi không bằng chứ không theo độ chọn lọc, và thường đề xuất nhiều index trùng nhau. Gộp lại, tính chi phí ghi, rồi thử bằng plan thật.
- **"Xếp hạng truy vấn tốn nhất nên theo trung bình hay theo tổng?"** Theo tổng (trung bình × số lần chạy), vì đó là tải server gánh. Trung bình chỉ cho biết trải nghiệm của một lần gọi. Câu 3.485 reads/lần chạy 3,37 triệu lần tốn hơn câu 1 triệu reads chạy 10 lần.
- **"`dm_exec_procedure_stats` và Query Store khác nhau thế nào, khi nào dùng cái nào?"** DMV đọc từ plan cache: tức thời, không tốn cấu hình, nhưng mất khi plan bị đẩy hoặc restart. Query Store lưu bền trong database, có lịch sử plan, so trước và sau, ép plan, wait theo truy vấn; tốn dung lượng và chút overhead. Điều tra nhanh dùng DMV; theo dõi và so sánh dài hạn dùng Query Store.
- **"Một proc có 3 dòng trong `dm_exec_query_stats`. Đó có phải 3 plan?"** Chưa chắc. Cùng `plan_handle`, khác `statement_start_offset` là 3 câu lệnh của một plan; `execution_count` bằng nhau và bằng số lần gọi proc càng khẳng định điều đó. Nhiều plan thật là nhiều `plan_handle` hoặc nhiều `plan_id` cho cùng `query_id` trong Query Store.
- **"Sau khi sửa proc trên production, đo hiệu quả thế nào?"** Ghi số trước khi `ALTER` (vì `ALTER` reset số liệu của proc), sau deploy đo lại trên số lần chạy mới: avg reads, avg CPU, avg elapsed; đối chiếu Query Store hai khoảng thời gian và trace APM của API gọi proc.

#### Tóm tắt
- Số liệu DMV gắn với plan trong cache: mất khi plan bị đẩy, `ALTER`, restart.
- `procedure_stats` theo proc; `query_stats` theo câu lệnh; xếp hạng theo tổng.
- Missing index là gợi ý: gộp, đối chiếu index có sẵn, tính chi phí ghi.
- Index có `user_updates` cao, seek/scan bằng 0 là ứng viên xoá.
- Query Store giữ lịch sử plan, so trước/sau, ép plan.

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
2. Tạo `IX_Student_SchoolId` trên `Student(SchoolId)`, chạy lại truy vấn ở bài 1 vài lần, rồi xem index đó trong `sys.dm_db_index_usage_stats`.
   **Đáp án:** Lọc `database_id = DB_ID()` và `object_id = OBJECT_ID('dbo.Student')`, join `sys.indexes` để lấy tên. `user_seeks` tăng theo số lần chạy; `user_updates` bằng 0 vì chưa ghi.
3. Viết truy vấn tìm index chết trong `LabPerf`: có `user_updates > 0` nhưng `user_seeks + user_scans + user_lookups = 0`. Giải thích vì sao chưa nên xoá ngay dựa trên kết quả.
   **Đáp án:** Join `sys.indexes` với `sys.dm_db_index_usage_stats` (LEFT JOIN để thấy cả index chưa từng dùng), loại `index_id <= 1` (heap, clustered). Chưa nên xoá ngay vì số liệu reset khi restart; báo cáo tháng, job cuối quý có thể dùng index đó. Đối chiếu thời gian uptime và Query Store trước khi xoá, và giữ script tạo lại.

### Bài 17.3. Wait stats: server đang chờ gì
**Viz:** waits

#### Mục tiêu
- Sau bài này, bạn giải thích được mô hình scheduler của SQL Server và ý nghĩa của resource wait, signal wait.
- Đo wait stats theo chênh lệch giữa hai lần chụp và lọc được wait nền.
- Phân loại được các nhóm wait chính và hướng điều tra cho từng nhóm.
- Lần được từ wait ra truy vấn gây ra nó.

#### Kiến thức nền
**Mô hình scheduler.** SQL Server tự lập lịch (SQLOS): mỗi lõi CPU có một scheduler, mỗi task chạy trên một worker thread. Worker ở một trong ba trạng thái: `RUNNING` (đang chiếm CPU), `SUSPENDED` (đang chờ tài nguyên: trang đọc từ đĩa, khoá, bộ nhớ...), `RUNNABLE` (đã có tài nguyên, xếp hàng chờ CPU). Thời gian ở `SUSPENDED` là resource wait; thời gian ở `RUNNABLE` là signal wait. Trong `sys.dm_os_wait_stats`, `wait_time_ms` gồm cả hai, `signal_wait_time_ms` là phần chờ CPU. Tỷ lệ signal wait cao (thường trên 20–25% tổng) là dấu hiệu thiếu CPU.

**Số liệu cộng dồn.** `sys.dm_os_wait_stats` cộng dồn từ lúc khởi động. Một lần chụp sau 90 ngày uptime phản ánh cả sự cố tháng trước. Cách đúng: chụp hai lần cách nhau một khoảng (5 phút trong giờ cao điểm), lấy chênh lệch.

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

**Nhóm wait chính.**

| Nhóm | Wait | Ý nghĩa | Hướng điều tra |
|---|---|---|---|
| CPU | `SOS_SCHEDULER_YIELD` | Worker dùng hết lượt 4 ms, nhường CPU | Câu tốn CPU nhất (Bài 17.2) |
| Worker | `THREADPOOL` | Không còn worker trống để nhận task mới | Truy vấn chậm hoặc bị chặn giữ worker; blocking chain |
| Song song | `CXPACKET`, `CXCONSUMER`, `CXSYNC_PORT` | Luồng song song chờ nhau, chờ đồng bộ exchange | Câu lớn chạy song song; `cost threshold for parallelism`, `MAXDOP` |
| Bộ nhớ | `RESOURCE_SEMAPHORE` | Chờ được cấp memory grant | Câu có grant lớn (Bài 19.4) |
| I/O | `PAGEIOLATCH_SH/EX` | Chờ đọc trang từ đĩa vào buffer pool | Scan lớn, thiếu index, thiếu RAM |
| Log | `WRITELOG` | Chờ ghi log khi commit | Nhiều commit nhỏ, đĩa log chậm |
| Latch bộ nhớ | `PAGELATCH_EX/SH` | Tranh chấp một trang trong RAM | Chèn dồn trang cuối, metadata tempdb (Bài 18.3) |
| Khoá | `LCK_M_*` | Chờ khoá do phiên khác giữ | Blocking, transaction dài |
| Client | `ASYNC_NETWORK_IO` | SQL chờ client đọc kết quả | Result set lớn, app đọc chậm |
| Gọi ra ngoài | `MSQL_DQ`, `OLEDB`, `PREEMPTIVE_*`, `MSQL_XP` | Chờ linked server, API hệ điều hành, extended proc | Linked server trong transaction |

**Wait là triệu chứng.** Từ wait phải lần ra truy vấn: `sys.dm_exec_requests` (cột `wait_type`, `blocking_session_id`), `sys.dm_os_waiting_tasks`, `sp_WhoIsActive` cho thời điểm hiện tại; `sys.query_store_wait_stats` cho lịch sử theo truy vấn (gom theo nhóm wait).

```sql
SELECT r.session_id, r.status, r.wait_type, r.wait_time, r.blocking_session_id,
       r.granted_query_memory * 8 AS grant_kb, t.text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id <> @@SPID AND r.session_id > 50;
```

#### Trong báo cáo
- Cụm log thi chính thức: `THREADPOOL` đứng đầu ở lần quét đầu (45,92%), `WRITELOG` 3 triệu giây (Cụm 3 – Mục 5, 10).
- Cụm kho dữ liệu: `CXSYNC_PORT` khoảng 61%, `RESOURCE_SEMAPHORE` tăng gần gấp đôi giữa hai lần quét (Cụm 4 – Mục 2, 13).
- Cụm core: `MSQL_DQ` + `OLEDB` chiếm 38,4% do gọi linked server (Cụm 2 – Mục 7); proc cộng/trừ vật phẩm gọi linked server ngay trong transaction đang giữ `UPDLOCK, HOLDLOCK`, khi mạng chậm khoá bị giữ tới 30 s (nguồn: mục 2).

#### Cách sửa
Theo từng loại wait (dùng mô phỏng ở trên để xem triệu chứng và hướng sửa):
- `THREADPOOL`: tìm câu chậm hoặc chuỗi blocking đang giữ worker, sửa chúng; giảm số kết nối đồng thời đổ vào.
- `WRITELOG`: gom commit (ghi theo lô thay vì một transaction mỗi dòng), đĩa log nhanh và tách riêng; `DELAYED_DURABILITY` chỉ khi chấp nhận mất vài ms dữ liệu cuối khi sự cố.
- `CXPACKET`/`CXSYNC_PORT`: nâng `cost threshold for parallelism` (mặc định 5 là quá thấp, thường đặt 30–50), đặt `MAXDOP` theo số lõi mỗi NUMA node, sửa câu lớn để không cần song song.
- `RESOURCE_SEMAPHORE`: giảm grant của câu xin nhiều (index bỏ Sort, sửa ước lượng), giới hạn bằng Resource Governor.
- `MSQL_DQ`/`OLEDB`: đưa lời gọi linked server ra khỏi transaction, thay bằng đồng bộ dữ liệu hoặc gọi từ app.

#### Kiểm chứng
- So chênh lệch wait stats cùng khung giờ trước và sau; wait mục tiêu phải giảm cả tuyệt đối lẫn tỷ trọng.
- Với wait theo truy vấn: so `sys.query_store_wait_stats` của câu đã sửa.

#### Bẫy
- Không chữa `THREADPOOL` bằng cách tăng `max worker threads`: worker đang bận vì truy vấn chậm hoặc bị chặn, thêm thread chỉ thêm tải và bộ nhớ.
- Không đặt `MAXDOP = 1` cho cả server để hết `CXPACKET`. Nâng `cost threshold for parallelism` và sửa truy vấn lớn. `CXCONSUMER` thường vô hại.
- Báo cáo coi `QDS_ASYNC_QUEUE` và `WAIT_XTP_HOST_WAIT` là điểm nghẽn ở cụm log tự luyện. Hai wait này thường nằm trong danh sách wait nền mà các script chuẩn (của Paul Randal, First Responder Kit) lọc bỏ. Cần kiểm chứng trước khi dồn công sửa.
- Tỷ lệ phần trăm trên số cộng dồn nhiều tháng có thể bị một sự cố cũ chi phối. Luôn đo chênh lệch.

#### Câu hỏi phỏng vấn
- **"ASYNC_NETWORK_IO cao có phải mạng chậm?"** Thường không. SQL đã có dữ liệu và đang chờ client đọc. Hay gặp khi trả result set quá lớn, hoặc app xử lý từng dòng trong lúc vẫn giữ reader mở. Sửa ở app: phân trang, chọn đủ cột, đọc hết rồi mới xử lý.
- **"THREADPOOL cao, có nên tăng max worker threads?"** Không. `THREADPOOL` nghĩa là mọi worker đang bận, thường vì truy vấn chậm hoặc bị chặn giữ worker lâu. Thêm thread làm tăng tranh chấp và bộ nhớ. Tìm chuỗi blocking và câu chậm bằng `sys.dm_exec_requests` hoặc `sp_WhoIsActive`, sửa chúng.
- **"Signal wait chiếm 35% tổng wait nói lên điều gì?"** Task đã có tài nguyên nhưng phải xếp hàng chờ CPU: server thiếu CPU hoặc có câu đốt CPU. Tìm top câu theo `total_worker_time` trước khi nghĩ tới mua thêm lõi.
- **"CXPACKET chiếm đầu bảng, có nên đặt MAXDOP = 1?"** Không cho cả server. `CXPACKET` chỉ cho biết có song song. Nâng `cost threshold for parallelism` để câu nhỏ không chạy song song, đặt `MAXDOP` hợp lý, và sửa các câu lớn (thường là scan do thiếu index). Có thể đặt `MAXDOP` ở mức câu lệnh hoặc database cho trường hợp riêng.
- **"WRITELOG cao xử lý thế nào?"** Kiểm tra độ trễ ghi của file log (`sys.dm_io_virtual_file_stats`). Nếu đĩa ổn, gốc thường là quá nhiều commit nhỏ: gom nhiều dòng vào một transaction, bỏ index thừa để giảm lượng log. `DELAYED_DURABILITY` là đánh đổi độ bền, chỉ dùng khi nghiệp vụ chấp nhận.

#### Tóm tắt
- Worker: `RUNNING`, `SUSPENDED` (resource wait), `RUNNABLE` (signal wait = chờ CPU).
- Đo chênh lệch giữa hai lần chụp; lọc wait nền.
- Mỗi nhóm wait chỉ tới một loại tài nguyên; wait là triệu chứng, phải lần ra truy vấn.
- Không chữa bằng núm cấu hình (`max worker threads`, `MAXDOP = 1`) khi gốc là truy vấn.

#### Bài tập
1. Tạo blocking trên `LabPerf`: cửa sổ 1 chạy `BEGIN TRAN; UPDATE dbo.Student SET Status = 1 WHERE StudentId = 10;` (chưa commit); cửa sổ 2 chạy `SELECT * FROM dbo.Student WHERE StudentId = 10;`. Ở cửa sổ 3, tìm wait type và phiên chặn.
   **Đáp án:** Truy vấn `sys.dm_exec_requests` thấy phiên 2 có `wait_type = LCK_M_S`, `blocking_session_id` là phiên 1. `sys.dm_os_waiting_tasks` cho thêm `resource_description` (khoá KEY nào). `ROLLBACK` ở cửa sổ 1 để kết thúc.
2. Chạy script đo chênh lệch wait stats trong 2 phút, trong lúc đó ở cửa sổ khác chạy `SELECT * FROM dbo.ExamResult;` trong SSMS (kết quả ra lưới). Wait nào tăng?
   **Đáp án:** `ASYNC_NETWORK_IO` tăng: SQL Server đẩy kết quả nhanh hơn SSMS vẽ lưới. Chứng minh wait này thường do client, không do mạng.
3. Kiểm tra cấu hình song song của server dev: `cost threshold for parallelism` và `max degree of parallelism` đang là bao nhiêu? Đề xuất giá trị cho một server 16 lõi, 2 NUMA node.
   **Đáp án:** `SELECT name, value_in_use FROM sys.configurations WHERE name IN ('cost threshold for parallelism','max degree of parallelism');`. Đề xuất: cost threshold khoảng 50 làm điểm xuất phát rồi chỉnh theo tải; `MAXDOP` 8 (không vượt số lõi mỗi NUMA node).

### Bài 17.4. Đọc execution plan

#### Mục tiêu
- Sau bài này, bạn giải thích được optimizer tạo plan thế nào và phân biệt plan ước lượng với plan thật.
- Đọc được các toán tử thường gặp và biết khi nào mỗi loại join phù hợp.
- So được số dòng ước lượng với số dòng thật, đọc được cảnh báo, phân biệt Seek Predicate với Predicate.
- Dùng plan để chọn hướng sửa thay vì đoán.

#### Kiến thức nền
**Optimizer làm gì.** Câu lệnh đi qua: parse → bind (algebrizer: kiểm tra tên, kiểu) → optimize → lưu plan cache → thực thi. Optimizer là cost-based: sinh nhiều phương án (thứ tự join, loại join, index nào), ước lượng chi phí mỗi phương án từ **số dòng ước lượng** (lấy từ statistics) và mô hình chi phí I/O, CPU, rồi chọn phương án rẻ nhất trong thời gian tìm kiếm cho phép. Mọi quyết định đứng trên số dòng ước lượng; ước lượng sai thì plan sai.

**Plan ước lượng và plan thật.** Plan ước lượng (Ctrl+L, `SET SHOWPLAN_XML ON`) không chạy câu lệnh. Plan thật (Ctrl+M, `SET STATISTICS XML ON`) là cùng plan đó cộng số liệu khi chạy: số dòng thật, số lần thực thi, từ SQL Server 2016 SP1 có thêm thời gian CPU, elapsed và I/O thật trên từng toán tử. Plan trong cache (`sys.dm_exec_query_plan`) là plan ước lượng. Từ 2019, bật `LAST_QUERY_PLAN_STATS` để lấy plan thật gần nhất qua `sys.dm_exec_query_plan_stats`.

**Cách đọc.** Dữ liệu chảy từ phải sang trái; độ dày mũi tên là số dòng. Thực thi theo mô hình iterator: toán tử ngoài cùng bên trái gọi "cho tôi dòng tiếp theo" xuống các toán tử con. Toán tử chặn (blocking) như Sort, Hash build phải đọc hết input trước khi trả dòng đầu.

**Toán tử cần biết.**

| Toán tử | Ý nghĩa |
|---|---|
| Index Seek | Đi từ gốc B-tree xuống, đọc một dải. Rẻ khi dải hẹp |
| Index Scan / Clustered Index Scan | Đọc toàn bộ tầng lá của index |
| Table Scan | Đọc toàn bộ heap |
| Key Lookup / RID Lookup | Từ index phụ quay về clustered index (hoặc heap) lấy cột thiếu, mỗi dòng một lần |
| Nested Loops | Với mỗi dòng bên ngoài, tìm bên trong. Tốt khi bên ngoài nhỏ, bên trong có index |
| Hash Match | Dựng bảng băm từ input nhỏ hơn, dò bằng input kia. Tốt với tập lớn chưa sắp xếp; cần memory grant |
| Merge Join | Hai input đã sắp theo khoá join, đi song song. Rẻ nếu không phải Sort thêm |
| Sort | Sắp xếp; chặn, cần memory grant, có thể spill |
| Top | Dừng sau N dòng |
| Stream / Hash Aggregate | Gom nhóm trên input đã sắp / bằng bảng băm |
| Table Spool / Eager Spool | Lưu tạm kết quả trung gian vào tempdb để dùng lại |
| Remote Query | Gửi câu lệnh sang linked server |

**Thuộc tính quan trọng.** Trên mỗi toán tử: *Estimated Number of Rows Per Execution* và *Actual Number of Rows for All Executions*, *Number of Executions*. Bên trong Nested Loops, ước lượng tính cho một lần chạy còn số thật cộng mọi lần chạy: ước lượng 1, chạy 500 lần, thật 500 là ước lượng đúng. Lệch hàng chục lần trở lên sau khi đã chia cho số lần chạy là gốc của join sai và grant sai.

**Seek Predicate và Predicate.** Seek Predicate là phần điều kiện dùng để đi xuống B-tree, giới hạn dải đọc. Predicate (residual) là điều kiện kiểm tra trên từng dòng sau khi đọc. Index Seek mà cột lọc chính chỉ nằm ở Predicate thì thực chất vẫn đọc rộng.

**Cảnh báo.** Biểu tượng tam giác vàng: spill xuống tempdb (Sort/Hash Warnings), grant quá mức (Excessive Grant), `CONVERT_IMPLICIT` ảnh hưởng tới seek, missing index (ở đầu plan), thiếu statistics, No Join Predicate.

**`Cost %` không phải số đo.** Đó là chi phí ước lượng của optimizer, tính trên số dòng ước lượng. Đo bằng `SET STATISTICS IO, TIME ON` và số liệu thật trên plan.

```sql
SET STATISTICS IO, TIME ON;
SELECT StudentId, FullName FROM dbo.Student WHERE SchoolId = 500;
-- Messages (xấp xỉ, chưa có index trên SchoolId):
-- Table 'Student'. Scan count 1, logical reads 9500, physical reads 0, read-ahead reads 0 ...
-- SQL Server Execution Times: CPU time = 60 ms, elapsed time = 25 ms.
```

`logical reads` là số trang đọc từ buffer pool, ổn định giữa các lần chạy; `physical reads`/`read-ahead reads` phụ thuộc trang đã có trong RAM chưa; CPU time lớn hơn elapsed time là dấu hiệu chạy song song.

#### Trong báo cáo
- Proc lấy danh mục trường: plan chỉ có một toán tử Clustered Index Scan vì không có index dẫn đầu bằng cột trạng thái (Cụm 2 – Mục 13).
- Proc lọc học sinh theo trường và khối: plan ước lượng 85 rồi 1 dòng, thực tế đọc 65.863 trang, lệch khoảng 775 lần (Cụm 5 – Mục 7).
- Job báo cáo tài khoản theo ngày: plan 294 toán tử, 83 Table Scan, đều quanh một bảng biến (Cụm 4 – Mục 14).
- Job sinh đề thi thử: toán tử tốn nhất là Remote Query qua linked server (Cụm 6 – Mục 7).

#### Cách sửa
Dùng plan để chọn hướng:
- Scan vì thiếu index hoặc index sai thứ tự cột → Bài 18.1, 18.2.
- Scan dù có index, cột lọc nằm trong `Predicate` hoặc có `CONVERT_IMPLICIT` → Bài 19.1.
- Ước lượng lệch xa số thật → Bài 19.2 (statistics), 19.3 (parameter sniffing), 19.5 (bảng biến).
- Sort, Hash, cảnh báo spill hoặc grant → Bài 19.4.
- Remote Query → bài về linked server ở chương sau.

#### Kiểm chứng
- So plan và `STATISTICS IO` (logical reads) trước và sau, với cùng bộ tham số. Với proc có tham số lệch phân bố, thử cả giá trị nhỏ và giá trị lớn.

#### Bẫy
- Đọc plan trong cache rồi kết luận về số dòng thật: plan trong cache chỉ có ước lượng.
- So `Estimated` với `Actual` bên trong Nested Loops mà quên nhân số lần chạy.
- Chạy câu lệnh trong SSMS với literal thay cho tham số: optimizer thấy giá trị cụ thể nên có thể ra plan khác hẳn plan proc dùng. Tái hiện bằng chính proc hoặc `sp_executesql` có tham số.
- SSMS và app có thể có `SET ARITHABORT` khác nhau, dẫn tới hai plan riêng trong cache cho cùng câu. "SSMS nhanh, app chậm" thường từ đây.

#### Câu hỏi phỏng vấn
- **"Plan ghi Sort chiếm 80% cost. Có chắc Sort là chỗ chậm nhất?"** Không chắc, cost là ước lượng. Xem thời gian và I/O thật trên từng toán tử trong plan thật (có từ SQL Server 2016 SP1), cảnh báo spill, và số dòng thật.
- **"Plan ước lượng và plan thật khác nhau thế nào? Plan trong cache là loại nào?"** Cùng hình dạng; plan thật có thêm số dòng thật, số lần chạy, thời gian và I/O thật, cảnh báo runtime như spill. Plan trong cache là plan ước lượng; muốn số thật thì chạy với `STATISTICS XML` hoặc dùng `sys.dm_exec_query_plan_stats` (2019+).
- **"Index Seek có phải lúc nào cũng tốt?"** Không. Seek chỉ nói cách vào B-tree; nếu Seek Predicate chỉ khớp cột đầu và phần lọc chính nằm ở Predicate, toán tử vẫn đọc rất nhiều trang. Seek kèm Key Lookup cho hàng chục nghìn dòng có thể đắt hơn scan.
- **"Khi nào optimizer chọn Hash Join thay vì Nested Loops?"** Khi hai input đều lớn, không có index hỗ trợ phía trong, hoặc không sắp theo khoá join. Nested Loops tốt khi phía ngoài ít dòng và phía trong seek được. Ước lượng phía ngoài là 1 dòng trong khi thật là 500.000 làm optimizer chọn Nested Loops sai.
- **"SSMS chạy nhanh mà app chạy chậm cùng proc. Vì sao?"** Hai phiên có `SET` options khác nhau (thường `ARITHABORT`) nên dùng hai plan khác nhau trong cache, mỗi plan compile theo tham số của lần đầu. Plan của app có thể là plan sniff giá trị không điển hình. Lấy plan app đang dùng từ cache hoặc Query Store, đừng so bằng phiên SSMS.

#### Tóm tắt
- Optimizer chọn plan theo chi phí ước lượng từ số dòng ước lượng.
- Plan thật = plan ước lượng + số liệu chạy; plan trong cache chỉ là ước lượng.
- Đọc phải sang trái; chú ý mũi tên dày, Key Lookup, Sort, cảnh báo.
- So Estimated với Actual (chia số lần chạy); phân biệt Seek Predicate và Predicate.
- Đo bằng logical reads và plan thật, không bằng `Cost %`.

#### Bài tập
1. Trên `LabPerf` (chưa có index phụ), chạy với plan thật: `SELECT s.FullName, sc.SchoolName FROM dbo.Student s JOIN dbo.School sc ON sc.SchoolId = s.SchoolId WHERE s.SchoolId = 500;`. Mô tả các toán tử và logical reads từng bảng.
   **Đáp án:** `Student` bị Clustered Index Scan (khoảng 9.500 reads) với Predicate `SchoolId = 500`, ra khoảng 40 dòng; `School` được Clustered Index Seek theo PK (2–3 reads). Join là Nested Loops vì một phía chỉ một dòng. Missing index gợi ý trên `Student(SchoolId)`.
2. Tạo `CREATE INDEX IX_Student_SchoolId ON dbo.Student(SchoolId);` rồi so plan của `WHERE SchoolId = 500` và `WHERE SchoolId = 1`. Giải thích khác biệt.
   **Đáp án:** Trường 500 (khoảng 40 dòng): Index Seek + Key Lookup, khoảng 120 reads. Trường 1 (200.000 dòng): optimizer chọn Clustered Index Scan vì 200.000 lookup (khoảng 600.000 reads) đắt hơn đọc cả bảng. Đây là điểm bùng phát, Bài 18.1.
3. Chạy `SELECT * FROM dbo.Student WHERE Phone = N'0900000123';` với plan thật. Tìm cảnh báo và giải thích.
   **Đáp án:** Tham số `N'...'` là `nvarchar`, cột `Phone` là `varchar`. `nvarchar` có độ ưu tiên kiểu cao hơn nên SQL chuyển cột: `CONVERT_IMPLICIT(nvarchar, Phone)`, cảnh báo trên toán tử SELECT. Chưa có index thì vẫn scan; có index trên `Phone` thì tuỳ collation có thể mất seek hoặc thành seek động kém hiệu quả. Sửa: truyền đúng kiểu `varchar`. Chi tiết ở Bài 19.1.

## Chương 18. Index

Phần lớn các con số lớn trong báo cáo (hàng chục nghìn đến hàng trăm triệu reads mỗi lần) đến từ ba nguyên nhân: thiếu index đúng, index sai thứ tự cột, hoặc quá nhiều index trên bảng ghi nhiều. Chương này đi từ cấu trúc lưu trữ (trang, B-tree, heap) tới cách thiết kế index từ truy vấn, chi phí ghi của index, và quy trình tạo index an toàn trên production.

Interviewer hỏi index ở mọi vòng backend senior. Câu hỏi khó không phải "index là gì" mà là "vì sao có index mà vẫn scan", "chọn thứ tự cột thế nào", "sao không đánh index hết cho nhanh", "tạo index giữa giờ cao điểm thì sao". Học xong chương, bạn trả lời được các câu đó bằng cơ chế và số đo.

### Bài 18.1. B-tree, heap, seek, scan, logical reads
**Viz:** seek-scan

#### Mục tiêu
- Sau bài này, bạn mô tả được cách SQL Server lưu dữ liệu: trang 8 KB, heap, clustered index, nonclustered index.
- Ước lượng được số logical reads của Seek, Scan, Key Lookup trên một bảng cụ thể.
- Giải thích được điểm bùng phát (tipping point) và covering index.
- Trả lời được vì sao có index trên cột lọc mà SQL Server vẫn scan.

#### Kiến thức nền
**Trang và logical reads.** SQL Server đọc và ghi theo trang 8 KB (khoảng 8.060 byte cho dữ liệu dòng). Mọi lần đọc đi qua buffer pool trong RAM: trang chưa có trong RAM thì đọc từ đĩa (physical read, read-ahead), có rồi thì chỉ là logical read. Logical reads là thước đo chính khi tối ưu vì nó ổn định giữa các lần chạy, tỷ lệ với CPU và áp lực bộ nhớ, và không phụ thuộc cache nóng hay lạnh. Báo cáo dùng thước đo này xuyên suốt.

**Heap.** Bảng không có clustered index. Dòng nằm ở trang nào còn chỗ, không theo thứ tự. Mỗi dòng định danh bằng RID (file:trang:slot). Tìm một dòng không có đường tắt: phải đọc mọi trang (Table Scan). Khi `UPDATE` làm dòng dài ra mà trang hết chỗ, dòng bị chuyển sang trang khác và để lại *forwarded record* ở chỗ cũ: mỗi lần đọc qua tốn thêm một trang.

**Clustered index.** Một B+ tree mà tầng lá chính là dữ liệu, sắp theo khoá clustered. Tầng trên (root, intermediate) chỉ chứa khoá và con trỏ trang con. Mỗi trang trung gian chứa hàng trăm khoá, nên bảng hàng triệu dòng chỉ sâu 3–4 tầng (xem `index_depth` trong `sys.dm_db_index_physical_stats`). Khoá clustered không unique thì SQL Server thêm uniquifier 4 byte.

**Nonclustered index.** Một B+ tree riêng; tầng lá chứa cột khoá, cột `INCLUDE` và con trỏ về dòng: khoá clustered (nếu bảng có clustered index) hoặc RID (nếu là heap).

**Seek và Scan.**
- Index Seek: đi từ root xuống lá theo khoá (đúng bằng số tầng), rồi đọc tiếp một dải lá liên tục. Chi phí ≈ số tầng + số trang lá của dải.
- Index Scan: đọc toàn bộ tầng lá. Chi phí ≈ số trang lá.
- Key Lookup: seek trên index phụ ra được khoá clustered, rồi seek vào clustered index lấy cột thiếu. Mỗi dòng một lần, mỗi lần tốn bằng độ sâu clustered index (thường 3 trang).

**Ví dụ trên `LabPerf`.** `Student` 1 triệu dòng, mỗi dòng khoảng 75–80 byte, nên khoảng 100 dòng/trang, khoảng 9.500 trang lá, sâu 3 tầng.

| Truy vấn `WHERE SchoolId = 500` (40 dòng) | Plan | Logical reads (xấp xỉ) |
|---|---|---|
| Chưa có index trên `SchoolId` | Clustered Index Scan | 9.500 |
| `IX(SchoolId)` | Seek + 40 Key Lookup | 3 + 40 × 3 ≈ 123 |
| `IX(SchoolId) INCLUDE (FullName)` | Seek, không lookup | 3–4 |

**Điểm bùng phát.** Với `WHERE SchoolId = 1` (200.000 dòng), seek + lookup tốn khoảng 600.000 reads, gấp 60 lần đọc cả bảng. Optimizer so chi phí và chọn Scan. Theo kinh nghiệm, điểm bùng phát rơi vào khoảng số dòng bằng 25–33% **số trang** của bảng: với 9.500 trang là chỉ khoảng 2.400–3.100 dòng, tức 0,3% số dòng. Vì vậy index không covering chỉ hữu ích cho điều kiện rất chọn lọc.

**Covering index.** Index phụ chứa đủ mọi cột câu lệnh cần (cột khoá + `INCLUDE`), không cần lookup. Khi đó số dòng khớp lớn cũng vẫn seek được, chi phí tỷ lệ với số dòng trả về chứ không nhân 3.

```sql
SET STATISTICS IO ON;
SELECT StudentId, FullName FROM dbo.Student WHERE SchoolId = 500;   -- đo trước

CREATE INDEX IX_Student_SchoolId ON dbo.Student (SchoolId);
SELECT StudentId, FullName FROM dbo.Student WHERE SchoolId = 500;   -- seek + lookup

DROP INDEX IX_Student_SchoolId ON dbo.Student;
CREATE INDEX IX_Student_SchoolId_Name ON dbo.Student (SchoolId) INCLUDE (FullName);
SELECT StudentId, FullName FROM dbo.Student WHERE SchoolId = 500;   -- seek, covering
```

`StudentId` không cần `INCLUDE`: index phụ tự mang theo khoá clustered.

Dùng mô phỏng ở trên để xem số trang đọc thay đổi khi đổi Scan, Seek, Seek + Lookup và số dòng khớp.

#### Trong báo cáo
- Bảng thống kê học sinh lọc theo mã dịch vụ và trường, nhưng mọi index đều dẫn đầu bằng mã user → Index Scan 3.567 reads/lần; covering index mới kỳ vọng dưới 10 reads (Vấn đề 4).
- Bảng quản lý người dùng thiếu index dẫn đầu bằng `userId` → proc lấy vị trí 10,8 ms/lần, 25,4 triệu lần (Vấn đề 3).
- Heap lớn: bảng log thao tác 101 triệu dòng / 21 GB; bảng tổng hợp bài thi 94 triệu dòng không index, tìm theo user phải đọc khoảng 6,7 GB (Cụm 2 – Mục 6, Cụm 3 – Mục 2).
- Bảng chứng chỉ là heap 1,6 triệu dòng, không index nào dẫn đầu bằng `userId`; proc tra chứng chỉ chạy 2,87 triệu lần, trung bình 420 ms và khoảng 194 nghìn reads mỗi lần; missing index DMV báo impact 99,73% (nguồn: mục 2).

#### Cách sửa
- Index dẫn đầu bằng cột lọc; `INCLUDE` cột trả về để bỏ lookup.
- Heap lớn có truy vấn đọc: cân nhắc clustered index, tuỳ loại bảng (Bài 18.3). Heap thuần ghi, không ai đọc theo khoá thì có thể giữ.
- Heap có nhiều forwarded record: `ALTER TABLE ... REBUILD` hoặc chuyển sang clustered index.

#### Kiểm chứng
- `SET STATISTICS IO ON` trước và sau; plan đổi Scan thành Seek, không còn Key Lookup.
- Heap: `forwarded_record_count` trong `sys.dm_db_index_physical_stats(..., 'DETAILED')`.

#### Bẫy
- Seek không đồng nghĩa với rẻ: seek trên dải rộng hoặc seek kèm hàng chục nghìn lookup có thể đắt hơn scan.
- Đo bằng thời gian chạy trong SSMS ở máy dev dễ sai do cache nóng/lạnh. Dùng logical reads.
- `SELECT *` biến mọi index phụ thành không covering. Chọn đúng cột cần.

#### Câu hỏi phỏng vấn
- **"Có index trên cột lọc mà SQL vẫn Scan. Vì sao?"** (1) Điều kiện không SARGable; (2) số dòng khớp lớn, lookup đắt hơn scan (vượt điểm bùng phát); (3) ước lượng sai do statistics; (4) lệch kiểu dữ liệu gây implicit conversion; (5) index không dẫn đầu bằng cột đó.
- **"Vì sao đo hiệu năng truy vấn bằng logical reads thay vì thời gian?"** Logical reads không đổi giữa các lần chạy với cùng plan và dữ liệu, không phụ thuộc trang đang ở RAM hay đĩa, và tỷ lệ với CPU, áp lực buffer pool. Thời gian dao động theo tải, cache, song song. Dùng reads để so plan, dùng thời gian để báo cáo trải nghiệm.
- **"Key Lookup tốn bao nhiêu, khi nào chấp nhận được?"** Mỗi dòng một lần seek vào clustered index, tốn bằng độ sâu của nó (thường 3 trang). Chấp nhận khi số dòng nhỏ (vài chục). Khi số dòng lớn hoặc câu chạy rất thường xuyên, thêm cột vào `INCLUDE` để covering.
- **"Heap hay clustered index, chọn thế nào?"** Bảng được đọc theo khoá, có cập nhật: clustered index (khoá hẹp, tăng dần, ổn định, unique). Heap chỉ hợp với bảng thuần chèn, đọc toàn bộ hoặc nạp tạm (staging). Heap bị cập nhật nhiều sinh forwarded record và mọi tra cứu đều scan.
- **"Điểm bùng phát là gì?"** Số dòng khớp mà tại đó seek + lookup đắt hơn scan cả bảng, nên optimizer chuyển sang scan. Thường chỉ khoảng 25–33% số trang tính theo dòng, tức rất nhỏ so với tổng số dòng. Covering index loại bỏ điểm bùng phát vì không còn lookup.

#### Tóm tắt
- Trang 8 KB; logical reads là thước đo chính.
- Clustered: dữ liệu ở lá; nonclustered: khoá + con trỏ (khoá clustered hoặc RID).
- Seek ≈ số tầng + dải lá; Scan ≈ toàn bộ lá; Lookup ≈ 3 trang mỗi dòng.
- Điểm bùng phát rất thấp; covering index loại bỏ lookup.

#### Bài tập
1. Chạy ba bước trong script của bài (không index, index thường, covering), ghi logical reads mỗi bước. Lặp lại với `SchoolId = 1`.
   **Đáp án:** Trường 500: khoảng 9.500 → 120 → 3–4 reads. Trường 1: index thường không được dùng (scan khoảng 9.500 reads); covering index được dùng, khoảng 200.000 / (khoảng 150–160 dòng mỗi trang lá) ≈ 1.200–1.300 reads, vẫn ít hơn scan cả bảng.
2. Xem độ sâu và số trang của các index trên `Student` bằng `sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('dbo.Student'), NULL, NULL, 'DETAILED')`.
   **Đáp án:** Lọc `index_level = 0` để có số trang lá; `index_depth` thường là 3 cho cả clustered và nonclustered. Từ đó tính lại chi phí seek và lookup để khớp với `STATISTICS IO`.
3. Tạo bản heap `SELECT * INTO dbo.StudentHeap FROM dbo.Student;`, tạo index phụ trên `SchoolId`, rồi so plan và reads của truy vấn trường 500 trên heap và trên bảng gốc.
   **Đáp án:** Trên heap, lookup là RID Lookup: đi thẳng tới trang theo RID, khoảng 1 trang mỗi dòng (cộng thêm nếu có forwarded record), nên tổng khoảng 3 + 40 ≈ 43 reads. Đây là lý do lookup trên heap rẻ hơn, nhưng heap mất khả năng tra theo khoá và dễ phân mảnh khi cập nhật.

### Bài 18.2. Thiết kế composite và covering index theo truy vấn
**Viz:** index-order

#### Mục tiêu
- Sau bài này, bạn chọn được thứ tự cột của index nhiều cột từ một truy vấn cụ thể.
- Giải thích được quy tắc tiền tố bên trái và vì sao cột bằng đứng trước cột phạm vi.
- Dùng được index để bỏ Sort cho `ORDER BY` và `TOP N`.
- Biết khi nào dùng `INCLUDE`, filtered index, và giới hạn của chúng.

#### Kiến thức nền
**Index nhiều cột sắp theo thứ tự từ điển.** Index `(ProvinceId, Grade, CreatedAt)` sắp theo `ProvinceId`, trong cùng tỉnh sắp theo `Grade`, trong cùng khối sắp theo `CreatedAt`. Giống danh bạ sắp theo họ rồi tên: tìm theo họ được, tìm theo họ + tên được, tìm theo tên thì phải đọc cả danh bạ.

**Tiền tố bên trái.** Seek chỉ dùng được trên tiền tố liên tục từ cột đầu. `WHERE Grade = 6` không seek được trên `(ProvinceId, Grade)`; optimizer chỉ có thể scan index đó (hẹp hơn bảng) hoặc scan bảng. SQL Server không có skip-scan tự động như một số hệ quản trị khác.

**Bằng trước, phạm vi sau.** Với `WHERE ProvinceId = @p AND CreatedAt >= @from AND Grade = @g`:
- Index `(ProvinceId, Grade, CreatedAt)`: Seek Predicate dùng cả ba cột, dải đọc đúng bằng số dòng khớp.
- Index `(ProvinceId, CreatedAt, Grade)`: seek theo `ProvinceId` và dải `CreatedAt`, còn `Grade` chỉ lọc từng dòng (Predicate); đọc gấp 12 lần nếu có 12 khối.
Sau cột phạm vi đầu tiên, các cột sau không giới hạn được dải đọc.

**`ORDER BY` ngay sau cột bằng.** Index đã sắp theo `CreatedAt` trong cùng (tỉnh, khối) thì `ORDER BY CreatedAt DESC` không cần Sort: đọc ngược dải. Với `TOP (20)`, SQL Server đọc 20 dòng rồi dừng: không Sort, không memory grant, chi phí gần như không đổi dù tỉnh có 200.000 học sinh.

```sql
-- Truy vấn: 20 học sinh mới nhất của một tỉnh, một khối
SELECT TOP (20) StudentId, FullName, CreatedAt
FROM dbo.Student
WHERE ProvinceId = @p AND Grade = @g
ORDER BY CreatedAt DESC;

-- (1) Chỉ ProvinceId: seek tỉnh, lọc khối từng dòng, Sort, lookup
CREATE INDEX IX_S_P ON dbo.Student (ProvinceId);
-- (2) ProvinceId, Grade: seek đúng, nhưng vẫn Sort toàn bộ dải trước khi lấy 20
CREATE INDEX IX_S_PG ON dbo.Student (ProvinceId, Grade);
-- (3) Đúng: bằng, bằng, rồi cột ORDER BY; INCLUDE cột trả về
CREATE INDEX IX_S_PG_Created ON dbo.Student (ProvinceId, Grade, CreatedAt DESC) INCLUDE (FullName);
```

Với tỉnh 1 (khoảng 212.000 học sinh, khoảng 17.700 mỗi khối), (2) phải đọc khoảng 17.700 dòng rồi Sort và lookup (hoặc chuyển sang scan cả bảng vì vượt điểm bùng phát); (3) đọc khoảng 3–4 trang.

**Cột key hay `INCLUDE`.** Cột trong key được sắp, dùng được cho seek và `ORDER BY`, nhưng làm các tầng trung gian to ra và mọi `UPDATE` cột đó phải di chuyển dòng trong index. Cột chỉ cần trả về đặt ở `INCLUDE`: chỉ nằm ở tầng lá. Giới hạn: key tối đa 16 cột (32 với nonclustered từ 2016) và 1.700 byte với nonclustered (900 byte với clustered).

**Index phụ tự mang khoá clustered.** Không cần thêm `StudentId` vào index phụ của `Student`. Khi index phụ không unique, khoá clustered nằm ở key (nên có thể dùng cho `ORDER BY` sau các cột khác); khi unique, nó nằm ở lá như một cột include.

**Filtered index.** `CREATE INDEX ... WHERE Status = 1` chỉ chứa tập con: nhỏ, rẻ khi ghi, statistics chính xác cho tập đó. Giới hạn quan trọng: với truy vấn tham số hoá (`WHERE Status = @s`), plan dùng lại phải đúng cho mọi giá trị nên optimizer **không dùng** filtered index; cần literal trong câu lệnh, hoặc `OPTION (RECOMPILE)`. Filtered index còn yêu cầu các `SET` option chuẩn (`ANSI_NULLS`, `QUOTED_IDENTIFIER`...) ở phiên ghi vào bảng.

**Cách viết index từ truy vấn.** Liệt kê: cột so sánh bằng trong `WHERE`/`JOIN` → cột `ORDER BY` (nếu muốn bỏ Sort) hoặc cột phạm vi → cột trả về đưa vào `INCLUDE`. Trong nhóm cột bằng, thứ tự không ảnh hưởng tới seek của truy vấn này; ưu tiên thứ tự giúp được nhiều truy vấn khác (tiền tố dùng chung).

#### Trong báo cáo
- Bảng xếp hạng vòng hiện tại: lọc theo năm, khối, tỉnh và `ORDER BY` hạng tỉnh, nhưng index có sẵn là (năm, tỉnh, huyện, trường): thiếu khối, không có cột hạng → đọc rộng rồi Sort. Đề xuất (năm, khối, tỉnh, hạng tỉnh) `INCLUDE (...)` (Cụm 4 – Mục 8).
- Bảng chi tiết đơn hàng: missing index điểm cao nhất hệ thống (204,9 triệu), 228 nghìn lượt tra cứu theo trường/địa bàn đang scan (Cụm 6 – Mục 4).
- Proc lớp của giáo viên: filtered index, từ 46.540 reads xuống dưới 10 reads theo đánh giá của báo cáo (Cụm 5 – Mục 2).
- Bảng kết quả luyện nói: index `(round, examOpenId, userId)` nhưng truy vấn lọc `round, userId` → chỉ seek được theo `round`, lọc tuần tự khoảng 4,9 triệu dòng của vòng đó, khoảng 20 nghìn reads mỗi lần; DB luyện viết có index đúng `(round, userId)` chỉ 28 reads (nguồn: mục 2).

#### Cách sửa
- Viết index từ truy vấn: cột trong `WHERE`, `JOIN`, `ORDER BY`, `SELECT`. Kiểm tra index đang có trước (`sp_BlitzIndex`): sửa index cũ (thêm cột, đổi thứ tự) thường tốt hơn thêm index mới gần trùng.
- Nhiều truy vấn trên một bảng: tìm tiền tố chung, một index phục vụ nhiều câu.

#### Kiểm chứng
- Plan không còn Sort và Key Lookup; tất cả cột lọc nằm trong Seek Predicate; DMV thôi đòi; `index_usage_stats` có seek.

#### Bẫy
- Bảng xếp hạng được đề xuất 4 index cho 4 cấp hạng, mỗi cái `INCLUDE` khoảng 10 cột: mỗi lần job xếp hạng ghi lại bảng sẽ ghi gấp khoảng 5 lần. Chấp nhận được nếu bảng chỉ ghi theo lô ban đêm; không ổn nếu ghi liên tục.
- Filtered index không được proc tham số hoá dùng: kiểm tra plan thật, đừng chỉ nhìn thấy index đã tạo.
- `INCLUDE` cột `nvarchar(max)` làm index phình to; chỉ include cột thực sự cần.

#### Câu hỏi phỏng vấn
- **"WHERE a = @a AND b > @b ORDER BY c. Chọn index nào?"** `(a, b)` seek hẹp nhưng vẫn phải Sort; `(a, c) INCLUDE (b)` bỏ Sort nhưng lọc b sau khi đọc. Có `TOP` nhỏ và b lọc ít thì chọn `(a, c)`; b lọc mạnh thì chọn `(a, b)`. Quyết định bằng số dòng thật, không bằng quy tắc.
- **"Index (a, b) có giúp được WHERE b = @b không?"** Không seek được, vì index sắp theo a trước; các giá trị b nằm rải rác trong từng nhóm a. Optimizer có thể scan index đó (hẹp hơn bảng) nhưng không seek. Cần index dẫn đầu bằng b nếu truy vấn này quan trọng.
- **"Khi nào đưa cột vào key, khi nào vào INCLUDE?"** Key khi cột dùng để seek, join hoặc sắp thứ tự. `INCLUDE` khi cột chỉ cần trả về: chỉ ở tầng lá, không làm to các tầng trên, cập nhật cột đó không phải di chuyển dòng trong index.
- **"Đã tạo filtered index WHERE Status = 1 mà proc vẫn không dùng. Vì sao?"** Proc dùng `@Status` tham số; plan cache phải đúng cho mọi giá trị nên optimizer không chọn index chỉ đúng với Status = 1. Viết literal `Status = 1` trong câu lệnh (nếu nghiệp vụ luôn lọc như vậy), tách nhánh, hoặc `OPTION (RECOMPILE)`.
- **"Vì sao index đúng cho TOP 20 ORDER BY lại quan trọng hơn cho truy vấn thường?"** Không có index sắp đúng, SQL phải đọc hết tập khớp và Sort trước khi trả 20 dòng đầu, kèm memory grant. Có index đúng thì đọc 20 dòng rồi dừng: chi phí không phụ thuộc kích thước tập khớp.

#### Tóm tắt
- Seek theo tiền tố bên trái; cột bằng trước, cột phạm vi sau.
- Cột `ORDER BY` đặt ngay sau các cột bằng để bỏ Sort; `TOP N` đọc N dòng rồi dừng.
- `INCLUDE` cho cột chỉ trả về; index phụ tự mang khoá clustered.
- Filtered index không hợp với truy vấn tham số hoá.
- Thiết kế từ truy vấn thật, đối chiếu index có sẵn.

#### Bài tập
1. Tạo lần lượt ba index (1), (2), (3) trong bài (xoá index trước khi tạo index sau), chạy truy vấn `TOP (20)` với `@p = 1, @g = 6` qua `sp_executesql`. Ghi plan và reads.
   **Đáp án:** (1) Seek tỉnh hoặc scan, có Sort và lookup, hàng nghìn tới gần 10 nghìn reads; (2) Seek đúng nhưng có Sort (Top N Sort) và lookup hoặc chuyển sang scan; (3) Seek + Top, không Sort, khoảng 3–4 reads.
   ```sql
   EXEC sp_executesql N'SELECT TOP (20) StudentId, FullName, CreatedAt
     FROM dbo.Student WHERE ProvinceId = @p AND Grade = @g ORDER BY CreatedAt DESC;',
     N'@p SMALLINT, @g TINYINT', @p = 1, @g = 6;
   ```
2. Thiết kế một index cho cả hai truy vấn: (A) `WHERE RoundId = @r AND StudentId = @s` trên `ExamResult`; (B) `WHERE RoundId = @r ORDER BY Score DESC` lấy `TOP (100)`. Có cần hai index không?
   **Đáp án:** Hai truy vấn cần thứ tự khác nhau sau `RoundId`: (A) cần `(RoundId, StudentId)` hoặc `(StudentId, RoundId)`; (B) cần `(RoundId, Score DESC)`. Một index không phục vụ tối ưu cả hai. Nếu (A) chạy rất nhiều, chọn `(StudentId, RoundId)` (mỗi học sinh chỉ 2 bài) và `(RoundId, Score DESC) INCLUDE (StudentId)` cho bảng xếp hạng; cân nhắc chi phí ghi của bảng.
3. Tạo `CREATE INDEX IX_S_Inactive ON dbo.Student (SchoolId) WHERE Status = 0;`. So plan của `WHERE Status = 0 AND SchoolId = 500` (literal) và cùng câu qua `sp_executesql` với `@st = 0`.
   **Đáp án:** Literal dùng filtered index (rất ít reads). Câu tham số hoá không dùng được filtered index; plan có thể có cảnh báo `UnmatchedIndexes`. Thêm `OPTION (RECOMPILE)` thì dùng lại được.

### Bài 18.3. Chi phí ghi: write amplification, page split, hotspot
**Viz:** write-cost

#### Mục tiêu
- Sau bài này, bạn tính được chi phí ghi của một bảng theo số index và loại thao tác.
- Giải thích được page split, `FILLFACTOR`, và vì sao khoá tăng dần lại sinh điểm nóng trang cuối.
- Phân loại được bảng theo cách dùng và chọn chiến lược index tương ứng.
- Đo được split, latch và lượng log bằng DMV.

#### Kiến thức nền
**Write amplification.** Mỗi index là một B-tree riêng. `INSERT` một dòng vào bảng có clustered index và N index phụ là N + 1 lần chèn vào N + 1 cây, mỗi lần chèn sinh bản ghi log. `UPDATE` chỉ chạm index chứa cột bị sửa; nhưng sửa khoá clustered thì dòng phải di chuyển và **mọi** index phụ đều phải cập nhật con trỏ. `DELETE` xoá khỏi mọi index. Commit phải chờ log được ghi xuống đĩa (`WRITELOG`), nên log nhiều hơn là commit chậm hơn.

**Page split.** Chèn một khoá vào giữa một trang lá đã đầy: SQL Server cấp trang mới, chuyển khoảng một nửa số dòng sang, sửa liên kết hai chiều và trang cha. Tất cả đều được ghi log đầy đủ, và để lại hai trang mỗi trang khoảng 50% đầy (tốn RAM, tốn đọc). Khoá ngẫu nhiên (`UserId` không theo thứ tự chèn, `NEWID()`) gây split liên tục.

**`FILLFACTOR`.** Chừa chỗ trống trên trang lá **khi tạo hoặc rebuild index** (ví dụ 90 là chừa 10%), để các lần chèn giữa trang có chỗ. Không có tác dụng giữa hai lần rebuild sau khi chỗ trống đã hết; cũng làm index to hơn và đọc nhiều trang hơn.

**Khoá tăng dần và điểm nóng trang cuối.** `IDENTITY`, `SEQUENCE`, thời gian: mọi dòng mới vào cuối index, không split giữa trang (cấp trang mới ở cuối là thao tác rẻ). Nhưng mọi luồng chèn cùng tranh một trang cuối: mỗi luồng phải giữ latch độc quyền trên trang đó, sinh `PAGELATCH_EX`. Với hàng nghìn insert/giây trên nhiều lõi, đây là nút cổ chai. Các cách giảm:
- `OPTIMIZE_FOR_SEQUENTIAL_KEY = ON` (SQL Server 2019+): điều tiết luồng vào trang cuối để latch được trao cho luồng sắp xong nhanh, cải thiện throughput khi tranh chấp cao. Không xoá latch; wait chuyển một phần sang `BTREE_INSERT_FLOW_CONTROL`.
- Rải chèn: partition theo hash, hoặc khoá kết hợp có cột rải ở đầu (đánh đổi khả năng đọc theo dải).
- Gom nhiều dòng vào một lệnh chèn.

**Heap.** Chèn rẻ (vào trang nào còn chỗ), không split. Nhưng `UPDATE` làm dòng dài ra sinh forwarded record, xoá không giải phóng trang nếu không lấy khoá bảng, và mọi tra cứu đều scan.

**Phân loại bảng theo cách dùng.**

| Loại bảng | Ví dụ | Chiến lược |
|---|---|---|
| Thuần ghi | Log thao tác thi | Clustered tăng dần (hoặc heap), không index phụ trên DB chính; tra cứu ở replica/kho |
| Ghi dồn rồi đọc tổng kết | Kết quả theo ca thi | Partition theo ca/ngày; đánh index khi ca kết thúc |
| Đọc-ghi liên tục | Hồ sơ người dùng, số dư | Ít index, covering gọn cho đúng truy vấn nóng |

**Đo chi phí ghi.**

```sql
-- Lượng log một thao tác sinh ra
BEGIN TRAN;
INSERT dbo.ExamResult (StudentId, RoundId, Score, SubmittedAt)
SELECT TOP (10000) StudentId, 11, 100, SYSDATETIME() FROM dbo.Student;
SELECT database_transaction_log_bytes_used
FROM sys.dm_tran_database_transactions WHERE database_id = DB_ID();
ROLLBACK;

-- Split, latch theo index
SELECT i.name, os.leaf_insert_count, os.leaf_allocation_count, os.nonleaf_allocation_count,
       os.page_latch_wait_count, os.page_latch_wait_in_ms
FROM sys.dm_db_index_operational_stats(DB_ID(), OBJECT_ID('dbo.ExamResult'), NULL, NULL) os
JOIN sys.indexes i ON i.object_id = os.object_id AND i.index_id = os.index_id;
```

`leaf_allocation_count` đếm cả cấp trang mới ở cuối lẫn split giữa trang; so với số insert và kiểu khoá để diễn giải. Dùng mô phỏng ở trên để thấy lượng ghi tăng theo số index và kiểu khoá.

#### Trong báo cáo
- Bảng kết quả vòng có 7 index phụ, bảng thống kê vòng có 9: khoảng 19,2 triệu lượt ghi/ngày, mỗi lượt cập nhật toàn bộ index (Cụm 4 – Mục 5).
- Index trên `(LogId)` trùng tiền tố với clustered PK `(LogId, QuestId)`, thừa khoảng 400 MB (Cụm 1 – Mục 2).
- Bảng người dùng 120 triệu dòng có 13 index (Cụm 5 – Mục 8).
- Bảng log thao tác thi ghi 0,24–1,09 ms/lần; báo cáo cấm thêm index phụ trên DB chính và phân bảng thành 3 nhóm (Phần VI của báo cáo).
- Cụm log thi chính thức: `WRITELOG` khoảng 41% và `THREADPOOL` khoảng 46% thời gian chờ (nguồn: mục 2).

#### Cách sửa
- Xoá index trùng hoặc không dùng (seek = 0, update cao), sau khi kiểm tra đủ chu kỳ nghiệp vụ.
- Bảng log: clustered key tăng dần, không index phụ, tra cứu ở replica.
- Bảng ghi dồn theo ca thi: partition theo ca, đánh index sau khi ca kết thúc.
- Bảng đọc-ghi: gộp các index gần trùng thành một index rộng hơn.

#### Kiểm chứng
- `sys.dm_db_index_operational_stats`: `leaf_allocation_count` (split), `page_latch_wait_count`; wait `WRITELOG`, `PAGELATCH_EX` giảm; thời gian proc ghi giảm.

#### Bẫy
- Báo cáo đề xuất "thêm cột identity tuần tự" để chống tranh chấp chèn trên bảng log (Cụm 3 – Mục 10). Identity bỏ được page split nhưng chính nó tạo điểm nóng ở trang cuối. Đo `PAGELATCH_EX` sau khi đổi và bật `OPTIMIZE_FOR_SEQUENTIAL_KEY`. `FILLFACTOR` không giúp gì cho chèn vào cuối.
- Hạ `FILLFACTOR` cho mọi index "để đỡ split": index to ra, đọc nhiều hơn, mà chỗ trống hết sau vài giờ ghi.
- Xoá index chỉ nhìn `index_usage_stats` sau một lần restart gần đây.

#### Câu hỏi phỏng vấn
- **"Bảng log 5.000 insert/giây, CMS cần tra theo UserId. Làm sao?"** DB chính giữ đường ghi nhanh (clustered tăng dần, không index phụ); tra cứu ở replica hoặc kho dữ liệu có index theo UserId. Hoặc partition theo ngày, chỉ đánh index các partition đã đóng.
- **"Sao không đánh index hết cho nhanh?"** Mỗi index thêm một lần ghi B-tree và log cho mỗi insert/update/delete. Index trên khoá ngẫu nhiên gây page split. Bảng ghi liên tục mà nhiều index sẽ tăng `WRITELOG`, latch và thời gian giữ khoá. Index phải được trả bằng lượng đọc nó tiết kiệm.
- **"Page split là gì, FILLFACTOR giúp khi nào?"** Chèn vào giữa trang đầy: SQL cấp trang mới, chuyển nửa số dòng, ghi log toàn bộ, để lại hai trang nửa rỗng. `FILLFACTOR` chừa chỗ khi rebuild, giúp với khoá chèn ngẫu nhiên và rebuild định kỳ; không giúp chèn vào cuối và tốn thêm dung lượng đọc.
- **"Dùng GUID làm clustered key có vấn đề gì?"** `NEWID()` ngẫu nhiên nên chèn rải khắp index, split nhiều, phân mảnh, trang nửa rỗng; khoá 16 byte bị chép vào mọi index phụ. Nếu cần GUID, dùng làm khoá phụ unique, clustered theo cột tăng dần, hoặc dùng GUID tuần tự sinh ở app.
- **"OPTIMIZE_FOR_SEQUENTIAL_KEY làm gì, có xoá được PAGELATCH_EX?"** Không xoá. Nó điều tiết luồng vào trang cuối để latch không bị chuyển cho luồng đang chậm (ví dụ bị lên lịch lại), giảm sụp throughput khi tranh chấp cao. Phải đo lại; nếu vẫn nghẽn thì rải khoá hoặc partition.

#### Tóm tắt
- N index phụ = N + 1 lần ghi B-tree và log cho mỗi insert.
- Khoá ngẫu nhiên → page split; khoá tăng dần → điểm nóng trang cuối.
- `FILLFACTOR` chỉ có tác dụng tại lúc rebuild, không giúp chèn cuối.
- Phân loại bảng (thuần ghi, ghi dồn, đọc-ghi) rồi mới chọn index.
- Đo bằng `index_operational_stats`, `WRITELOG`, `PAGELATCH_EX`.

#### Bài tập
1. Tạo hai bảng giống `ExamResult`: một bảng chỉ có PK, một bảng thêm 5 index phụ (`StudentId`, `RoundId`, `Score`, `SubmittedAt`, `(RoundId, Score)`). Chèn 200.000 dòng vào mỗi bảng trong một transaction, đo `database_transaction_log_bytes_used` và thời gian.
   **Đáp án:** Bảng 5 index phụ sinh log gấp nhiều lần (thường 3–5 lần) và chậm hơn tương ứng. Chênh lệch là chi phí ghi phải trả cho mỗi index.
2. Tạo bảng `CREATE TABLE dbo.T_Guid (Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY, Pad CHAR(200) NOT NULL DEFAULT 'x');` và bảng tương tự với `Id INT IDENTITY`. Chèn 100.000 dòng từng lô 1.000, rồi so `avg_fragment_in_percent`, `avg_page_space_used_in_percent`, `page_count`.
   **Đáp án:** Bảng GUID phân mảnh gần 99%, trang đầy khoảng 60–70%, nhiều trang hơn; bảng identity phân mảnh gần 0, trang gần đầy. Lấy số bằng `sys.dm_db_index_physical_stats(..., 'DETAILED')`.
3. Một bảng 40 triệu dòng có các index: PK `(OrderId)`, `IX1 (CustomerId)`, `IX2 (CustomerId, CreatedAt)`, `IX3 (Status)` (3 giá trị), `IX4 (CreatedAt)` với `user_seeks = 0`, `user_updates = 9 triệu` sau 60 ngày uptime. Đề xuất xoá index nào, vì sao?
   **Đáp án:** `IX1` thừa vì trùng tiền tố với `IX2`. `IX4` là ứng viên xoá (60 ngày không seek/scan; kiểm tra thêm `user_scans` và báo cáo cuối kỳ). `IX3` có độ chọn lọc thấp, thường vô ích trừ khi là filtered index cho trạng thái hiếm. Giữ script tạo lại trước khi xoá.

### Bài 18.4. Tạo và bảo trì index an toàn trên production

#### Mục tiêu
- Sau bài này, bạn biết thao tác index nào khoá gì, khác nhau thế nào giữa Standard và Enterprise Edition.
- Lập được checklist tạo index trên bảng lớn: edition, dung lượng, khung giờ, rollback, số đo.
- Chọn được chiến lược bảo trì: rebuild, reorganize, update statistics.
- Biết tác động của `ALTER PROCEDURE` lên plan và số liệu.

#### Kiến thức nền
**Thao tác offline khoá gì.** Theo tài liệu SQL Server: tạo nonclustered index offline giữ khoá Shared (S) trên bảng suốt thời gian tạo, nên mọi `INSERT/UPDATE/DELETE` bị chặn (đọc vẫn được). Tạo, rebuild, xoá clustered index hoặc rebuild nonclustered index offline giữ khoá Schema modification (Sch-M): chặn cả đọc lẫn ghi. Với bảng ghi liên tục, chặn ghi vài chục phút là sự cố.

**Online.** `WITH (ONLINE = ON)` cho phép đọc và ghi trong lúc tạo/rebuild; chỉ cần khoá ngắn ở đầu (S) và ở cuối (Sch-M) để chuyển đổi. Khoá Sch-M ở cuối vẫn phải chờ mọi truy vấn đang chạy trên bảng xong, và trong lúc chờ, nó chặn các truy vấn mới: một báo cáo chạy dài có thể làm cả bảng đứng. `WAIT_AT_LOW_PRIORITY` (từ 2014, cho `ALTER INDEX ... REBUILD` online và chuyển partition) cho phép thao tác chờ khoá ở hàng ưu tiên thấp, không chặn truy vấn khác, và chọn hành động khi hết thời gian; kiểm tra tài liệu phiên bản đang dùng trước khi áp cho `CREATE INDEX`.

**Edition.** `ONLINE = ON`, `RESUMABLE`, thao tác index song song (nhiều lõi) là tính năng Enterprise (Developer và Azure SQL cũng có). Trên Standard, `ONLINE = ON` báo lỗi và index được tạo đơn luồng. Kiểm tra trước:

```sql
SELECT SERVERPROPERTY('Edition') AS edition, SERVERPROPERTY('ProductVersion') AS version,
       SERVERPROPERTY('EngineEdition') AS engine_edition;  -- 3 = Enterprise/Developer, 2 = Standard
```

**Tuỳ chọn khác.**
- `RESUMABLE = ON` (kèm `ONLINE = ON`): tạm dừng và tiếp tục được; rebuild resumable có từ 2017, create resumable từ 2019. Có `MAX_DURATION` để tự dừng sau N phút. Không dùng chung với `SORT_IN_TEMPDB = ON`.
- `SORT_IN_TEMPDB = ON`: sort trung gian ở tempdb thay vì trong file của database, cần tempdb đủ chỗ.
- `MAXDOP`: giới hạn số lõi cho thao tác index (Enterprise), tránh chiếm hết CPU.
- `DATA_COMPRESSION = ROW | PAGE`: có ở mọi edition từ 2016 SP1; giảm dung lượng và reads, tốn CPU khi ghi.

**Dung lượng.** Tạo index cần chỗ cho chính index mới, chỗ sort (trong DB hoặc tempdb), và log. Ở recovery model FULL, tạo index được log đầy đủ: log có thể lớn cỡ kích thước index; nếu có Availability Group hoặc log shipping, lượng log này còn phải đẩy sang replica. Ở SIMPLE/BULK_LOGGED, thao tác được log tối thiểu.

**Bảo trì định kỳ.**
- Reorganize: sắp lại trang lá tại chỗ, luôn online, có thể dừng giữa chừng, không cập nhật statistics.
- Rebuild: dựng lại toàn bộ, cập nhật statistics của index với FULLSCAN, offline trên Standard.
- Ngưỡng truyền thống 5%/30% phân mảnh là quy tắc kinh nghiệm cũ. Trên SSD, phân mảnh logic ít ảnh hưởng; mật độ trang (`avg_page_space_used_in_percent`) và statistics quan trọng hơn. Ưu tiên cập nhật statistics thường xuyên, rebuild có chọn lọc.
- Ola Hallengren `IndexOptimize` là chuẩn phổ biến: `@FragmentationLevel1`, `@FragmentationLevel2`, `@UpdateStatistics = 'ALL'`, `@OnlyModifiedStatistics = 'Y'`.

**`ALTER PROCEDURE`.** Cần khoá Sch-M ngắn trên proc; xong thì plan cũ bị loại, lần gọi sau compile lại theo tham số của lần gọi đó (rủi ro sniffing), và số liệu của proc trong `dm_exec_procedure_stats` bắt đầu lại từ 0. Thường deploy được trong ngày, nhưng tránh lúc proc đang chịu tải đỉnh.

#### Trong báo cáo
- Hai cụm chạy Standard Edition: báo cáo cảnh báo tạo index trên bảng triệu dòng sẽ khoá bảng, chỉ làm trong khung 23h–05h (Phần V của báo cáo).
- Bảng archive đã hết ca thi là bảng tĩnh, tạo index gần như không ảnh hưởng ghi (Cụm 3 – Mục 9).

#### Cách sửa
Checklist trước khi tạo index trên bảng lớn:
- [ ] Kiểm tra edition và version của đúng cụm sẽ chạy.
- [ ] Kích thước bảng và index dự kiến (`sp_spaceused`, `sys.dm_db_partition_stats`).
- [ ] Đủ chỗ cho data file, log (và replica nếu có AG), tempdb nếu `SORT_IN_TEMPDB`.
- [ ] Khung giờ: Standard thì trong khung bảo trì; Enterprise vẫn tránh giờ cao điểm vì CPU, I/O và khoá cuối.
- [ ] Script rollback (`DROP INDEX`) và script kiểm tra kết quả viết sẵn.
- [ ] Số đo trước (reads, CPU của proc mục tiêu) và lịch đo sau.
- [ ] Theo dõi blocking trong lúc chạy (`sp_WhoIsActive`), sẵn sàng huỷ.

```sql
-- Mẫu trên Enterprise/Developer
CREATE INDEX IX_ExamResult_Student ON dbo.ExamResult (StudentId) INCLUDE (RoundId, Score)
WITH (ONLINE = ON, RESUMABLE = ON, MAX_DURATION = 60 MINUTES, MAXDOP = 4);
-- Theo dõi / tạm dừng / tiếp tục
SELECT name, percent_complete, state_desc FROM sys.index_resumable_operations;
-- ALTER INDEX IX_ExamResult_Student ON dbo.ExamResult PAUSE;
-- ALTER INDEX IX_ExamResult_Student ON dbo.ExamResult RESUME;
-- Rollback
-- DROP INDEX IX_ExamResult_Student ON dbo.ExamResult;
```

#### Kiểm chứng
- Sau khi tạo: plan của truy vấn mục tiêu dùng index mới; `index_usage_stats` có seek; reads/CPU của proc giảm; `user_updates` của index phù hợp với dự tính chi phí ghi.

#### Bẫy
- Một số script trong báo cáo có `WITH (ONLINE = ON)`. Trên Standard Edition câu này báo lỗi. Kiểm tra edition từng cụm trước khi chạy.
- Tưởng `ONLINE = ON` là không khoá: khoá Sch-M ở cuối vẫn có thể chặn khi có truy vấn dài.
- Rebuild index hằng đêm cho mọi index "cho chắc": sinh log lớn, tốn I/O, làm replica trễ, mà lợi ích trên SSD nhỏ.

#### Câu hỏi phỏng vấn
- **"Tạo index trên bảng 120 triệu dòng, Standard Edition, giữa ca thi thì sao?"** Tạo offline giữ khoá trên bảng tới khi xong: mọi lệnh ghi (và với clustered index, cả đọc) phải chờ. Truy vấn chờ khoá chiếm worker, dẫn tới `THREADPOOL`, API timeout dây chuyền. Chỉ làm trong khung bảo trì hoặc trên replica.
- **"ONLINE = ON có hoàn toàn không khoá không?"** Không. Cần khoá S ngắn lúc đầu và Sch-M ngắn lúc cuối. Khoá cuối phải chờ truy vấn đang chạy xong và chặn truy vấn mới trong lúc chờ. Dùng `WAIT_AT_LOW_PRIORITY` và chọn thời điểm ít truy vấn dài.
- **"Rebuild hay reorganize? Ngưỡng 30% còn đúng không?"** Reorganize online, nhẹ, dừng được; rebuild dựng lại toàn bộ và cập nhật statistics FULLSCAN, offline trên Standard. Ngưỡng 5%/30% là quy tắc kinh nghiệm; trên SSD nên ưu tiên statistics và mật độ trang, rebuild có chọn lọc thay vì theo lịch cho mọi index.
- **"Deploy ALTER PROCEDURE giữa ngày có an toàn không?"** Thường an toàn: khoá Sch-M rất ngắn. Hệ quả cần biết: plan bị compile lại theo tham số của lần gọi đầu sau deploy, và số liệu DMV của proc reset. Ghi số đo trước khi deploy và theo dõi plan mới.
- **"Tạo index trên bảng lớn cần chuẩn bị dung lượng gì?"** Chỗ cho index mới trong data file, chỗ sort (data file hoặc tempdb), và log: ở FULL recovery log có thể xấp xỉ kích thước index, cộng thời gian đẩy log sang replica. Kiểm tra trước, không để tràn log giữa chừng.

#### Tóm tắt
- Offline: tạo nonclustered chặn ghi; thao tác clustered chặn cả đọc và ghi.
- Online, resumable, song song là tính năng Enterprise; Standard báo lỗi với `ONLINE = ON`.
- Online vẫn có khoá ngắn đầu và cuối.
- Luôn có checklist: edition, dung lượng, khung giờ, rollback, số đo trước và sau.
- `ALTER PROCEDURE` làm compile lại và reset số liệu DMV.

#### Bài tập
1. Trên server dev, chạy truy vấn `SERVERPROPERTY` để biết edition. Viết câu `CREATE INDEX` cho `ExamResult(RoundId, Score DESC) INCLUDE (StudentId)` hai phiên bản: một cho Enterprise/Developer (online, resumable), một cho Standard.
   **Đáp án:** Phiên bản Enterprise như mẫu trong bài. Phiên bản Standard: bỏ `ONLINE`, `RESUMABLE`, `MAX_DURATION`, `MAXDOP`; có thể thêm `SORT_IN_TEMPDB = ON` nếu tempdb đủ chỗ; ghi chú chạy trong khung bảo trì và kèm `DROP INDEX` rollback.
2. Mô phỏng khoá cuối của thao tác online: phiên 1 chạy `BEGIN TRAN; SELECT COUNT(*) FROM dbo.ExamResult WITH (HOLDLOCK);` (chưa commit); phiên 2 chạy `CREATE INDEX ... WITH (ONLINE = ON)`; phiên 3 chạy một `SELECT` bất kỳ trên `ExamResult`. Quan sát wait của phiên 2 và 3.
   **Đáp án:** Phiên 2 dựng index xong rồi chờ khoá Sch-M (`LCK_M_SCH_M`) vì phiên 1 giữ khoá. Phiên 3 bị chặn sau phiên 2 (chờ `LCK_M_SCH_S`). Commit phiên 1 thì cả hai chạy tiếp. Đây là lý do cần `WAIT_AT_LOW_PRIORITY`.
3. Viết truy vấn liệt kê index trên `LabPerf` có `page_count > 1000` kèm `avg_fragmentation_in_percent` và `avg_page_space_used_in_percent`, đề xuất hành động cho từng dòng.
   **Đáp án:** Dùng `sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'SAMPLED')` join `sys.indexes`. Mật độ trang thấp (dưới khoảng 70%) và index lớn: rebuild trong khung bảo trì; phân mảnh cao nhưng mật độ tốt: thường chỉ cần reorganize hoặc bỏ qua trên SSD; luôn cập nhật statistics theo `modification_counter`.

## Chương 19. Viết truy vấn để optimizer hiểu

Index đúng mà truy vấn viết sai thì vẫn scan. Ước lượng sai thì vẫn chọn plan sai. Chương này đi qua các nguyên nhân phía truy vấn: điều kiện không SARGable, statistics cũ và ước lượng lệch, parameter sniffing, memory grant và spill, cách truyền và giữ dữ liệu trung gian (bảng biến, bảng tạm, TVP, JSON), và cách viết theo tập thay vì từng dòng.

Đây là phần interviewer dùng để kiểm tra bạn có hiểu optimizer hay chỉ thuộc mẹo. Câu hỏi thường bắt đầu bằng một triệu chứng: "proc lúc nhanh lúc chậm", "có index mà vẫn scan", "SQL Server 2019 rồi còn cần #temp không", "phân trang trang 5.000 chậm". Học xong chương, bạn giải thích được từng triệu chứng bằng cơ chế, đưa ra vài cách sửa và cái giá của mỗi cách.

### Bài 19.1. Điều kiện SARGable
**Viz:** sargable

#### Mục tiêu
- Sau bài này, bạn giải thích được vì sao một điều kiện dùng được index seek còn điều kiện khác thì không.
- Nhận ra và viết lại được các mẫu phá SARG thường gặp: hàm bao cột, `CASE`, `LIKE '%x%'`, lệch kiểu dữ liệu.
- Xử lý được truy vấn "catch-all" bằng `OPTION (RECOMPILE)`, tách nhánh hoặc dynamic SQL, và biết bẫy của từng cách.
- Kiểm chứng được bằng Seek Predicate trong plan.

#### Kiến thức nền
**SARGable** (Search ARGument-able): điều kiện mà optimizer có thể chuyển thành một dải giá trị trên khoá index, dạng `cột <phép so sánh> biểu thức không phụ thuộc cột`. Với `WHERE SchoolId = @s`, optimizer biết cần đi xuống B-tree tới đúng `@s`. Với `WHERE ABS(SchoolId) = @s`, giá trị `ABS(SchoolId)` không được sắp trong index nên optimizer không biết bắt đầu từ đâu: phải đọc từng dòng, tính hàm, rồi so.

**Các mẫu phá SARG và cách viết lại.**

| Không SARGable | Viết lại |
|---|---|
| `WHERE YEAR(CreatedAt) = 2025` | `WHERE CreatedAt >= '20250101' AND CreatedAt < '20260101'` |
| `WHERE DATEADD(DAY, 7, CreatedAt) > SYSDATETIME()` | `WHERE CreatedAt > DATEADD(DAY, -7, SYSDATETIME())` |
| `WHERE ISNULL(Status, 0) = 0` | `WHERE (Status = 0 OR Status IS NULL)` |
| `WHERE LEFT(Phone, 4) = '0900'` | `WHERE Phone LIKE '0900%'` |
| `WHERE SchoolId + 1 = @x` | `WHERE SchoolId = @x - 1` |
| `WHERE CONVERT(NVARCHAR(20), StudentId) = @s` | `WHERE StudentId = TRY_CONVERT(INT, @s)` |
| `WHERE 1 = CASE WHEN Grade = @g THEN 1 END` | `WHERE Grade = @g` |

Khi không viết lại được (biểu thức nghiệp vụ cố định), tạo computed column rồi index nó; optimizer khớp được biểu thức trong truy vấn với computed column có index.

**Lệch kiểu dữ liệu (implicit conversion).** So hai kiểu khác nhau, SQL Server chuyển phía có độ ưu tiên kiểu thấp hơn sang kiểu cao hơn. Nếu phía bị chuyển là **cột**, điều kiện có thể mất SARG:
- Cột `VARCHAR`, tham số `NVARCHAR` (`nvarchar` ưu tiên cao hơn): cột bị bọc `CONVERT_IMPLICIT`. Với collation kiểu SQL (`SQL_Latin1_General_CP1_CI_AS`) thường thành scan; với collation Windows, SQL Server vẫn seek được qua dải động nhưng ước lượng kém hơn.
- Cột `VARCHAR`, so với số nguyên (`WHERE Phone = 900000123`): cột bị chuyển sang `INT`, scan, và có thể lỗi chuyển kiểu nếu có dòng không phải số.
- Cột `INT`, tham số `VARCHAR`: tham số bị chuyển sang `INT`, vẫn seek.

Nguồn phổ biến trong .NET: `SqlParameter` mặc định chuỗi là `NVARCHAR`; Dapper truyền `string` thành `nvarchar(4000)`. Với cột `varchar`, khai báo rõ `DbType.AnsiString` hoặc `SqlDbType.VarChar`.

**Truy vấn catch-all.**

```sql
CREATE OR ALTER PROCEDURE dbo.SearchStudents @ProvinceId SMALLINT = 0, @SchoolId INT = 0, @Grade TINYINT = 0
AS
SELECT StudentId, FullName
FROM dbo.Student
WHERE (@ProvinceId = 0 OR ProvinceId = @ProvinceId)
  AND (@SchoolId   = 0 OR SchoolId   = @SchoolId)
  AND (@Grade      = 0 OR Grade      = @Grade);
```

Plan được cache phải đúng cho mọi tổ hợp tham số, kể cả khi mọi tham số bằng 0, nên optimizer thường chọn scan. Ba cách xử lý:
- `OPTION (RECOMPILE)` ở câu lệnh: mỗi lần chạy compile lại với giá trị thật; nhờ *parameter embedding optimization*, các vế `@SchoolId = 0` được rút gọn, câu còn lại chỉ có điều kiện cần và seek được. Cái giá: CPU compile mỗi lần chạy.
- Dynamic SQL có tham số: chỉ nối thêm điều kiện cần, chạy bằng `sp_executesql`. Mỗi tổ hợp có một plan riêng được cache, không có SQL injection vì giá trị vẫn là tham số.
- Tách nhánh `IF/ELSE` hoặc proc con: hợp khi chỉ có vài tổ hợp.

```sql
DECLARE @sql NVARCHAR(MAX) = N'SELECT StudentId, FullName FROM dbo.Student WHERE 1 = 1';
IF @ProvinceId > 0 SET @sql += N' AND ProvinceId = @ProvinceId';
IF @SchoolId   > 0 SET @sql += N' AND SchoolId = @SchoolId';
IF @Grade      > 0 SET @sql += N' AND Grade = @Grade';
EXEC sp_executesql @sql, N'@ProvinceId SMALLINT, @SchoolId INT, @Grade TINYINT',
     @ProvinceId, @SchoolId, @Grade;
```

**Bẫy của `IF/ELSE` trong cùng proc.** Khi proc compile, **mọi** câu lệnh trong mọi nhánh được tối ưu cùng lúc với giá trị tham số của lần gọi đầu, kể cả nhánh không chạy. Nếu lần đầu gọi với `@SchoolId = 0`, câu trong nhánh `IF @SchoolId > 0` được tối ưu cho `SchoolId = 0` (không có dòng nào), plan có thể không hợp với giá trị thật sau đó. Tách mỗi nhánh thành proc con để mỗi nhánh compile với giá trị của chính nó.

**`LIKE`.** `LIKE 'abc%'` seek được (dải từ `abc` tới trước `abd`). `LIKE '%abc'` và `LIKE '%abc%'` thì không: B-tree sắp theo ký tự đầu. Cách xử lý: full-text search; tìm hậu tố bằng cột đảo ngược có index (`REVERSE(col)`); với cột chứa danh sách (`'IOE,IOK,...'`), chuẩn hoá thành bảng con có index; hoặc chỉ cho phép `%x%` trên tập đã lọc nhỏ.

Dùng mô phỏng ở trên để thử viết lại từng mẫu và xem Seek Predicate thay đổi.

#### Trong báo cáo
- Proc lọc học sinh theo tỉnh/huyện/trường: `AND 1 = (CASE WHEN @school > 0 ...)` (Vấn đề 4).
- Proc tìm kiếm giải thưởng tháng: `CASE` + `CONVERT(NVARCHAR, user_id)` + `LIKE '%...%'`, scan dù có index trên user_id (Cụm 4 – Mục 9).
- Proc báo cáo đăng ký: `list_service_code LIKE '%IOK%'` trên bảng 120 triệu dòng, 151.930 reads/lần (Cụm 5 – Mục 3).
- Proc câu sai theo vòng: `CASE WHEN block = @block ...`, 75.133 trang/lần (Cụm 1 – Mục 2).
- Proc tra trường theo ID: `1 = CASE WHEN ... AND [ID] = @ID THEN 1 ...` quét cả bảng; tách nhánh `IF ... ELSE`, nhánh có ID seek thẳng PK: 825 → 3 reads, 14,9 → 0,12 ms, trên khoảng 13 triệu lượt gọi; số sau đo trên khoảng 29 nghìn lần chạy sau deploy (nguồn: mục 4.4).

#### Cách sửa
- Viết lại điều kiện theo bảng mẫu; giữ cột "trần" ở một vế.
- Catch-all: chọn `RECOMPILE` khi proc gọi không quá dày, dynamic SQL có tham số khi gọi dày và nhiều tổ hợp, proc con khi ít tổ hợp.
- Sửa kiểu tham số ở tầng app cho khớp kiểu cột.
- `LIKE '%x%'` trên bảng lớn: đổi mô hình dữ liệu (bảng con) hoặc full-text.

#### Kiểm chứng
- Plan đổi Scan thành Seek; cột xuất hiện trong `Seek Predicates` chứ không chỉ trong `Predicate`; không còn cảnh báo `CONVERT_IMPLICIT`.
- Logical reads giảm theo đúng tỷ lệ số dòng khớp / tổng số dòng.

#### Bẫy
- Tách `IF/ELSE` trong cùng proc vẫn dính sniffing giữa các nhánh (xem trên).
- `OR` giữa hai cột khác nhau (`WHERE SchoolId = @s OR Phone = @p`) có thể vẫn scan dù cả hai cột có index; viết lại thành `UNION` hai câu seek nếu cần.
- Dynamic SQL nối giá trị trực tiếp vào chuỗi (không qua tham số) mở SQL injection và làm phình plan cache.

#### Câu hỏi phỏng vấn
- **"`WHERE CAST(create_date AS date) = @d` có seek được không?"** Trường hợp đặc biệt: ép `datetime` sang `date` vẫn có thể seek nhờ dải động, nhưng ước lượng kém. Viết `create_date >= @d AND create_date < DATEADD(day, 1, @d)` rõ ràng và ổn định hơn.
- **"Cột VARCHAR, app truyền NVARCHAR thì chuyện gì xảy ra?"** `nvarchar` có độ ưu tiên kiểu cao hơn nên cột bị bọc `CONVERT_IMPLICIT`. Với collation SQL thường mất seek, thành scan; với collation Windows vẫn seek qua dải động nhưng ước lượng kém. Sửa ở app: khai báo tham số đúng `varchar` và độ dài.
- **"Proc tìm kiếm có nhiều tham số tuỳ chọn, xử lý thế nào để seek được?"** Mẫu `(@p = 0 OR col = @p)` buộc plan đúng cho mọi tổ hợp nên thường scan. Dùng `OPTION (RECOMPILE)` để rút gọn theo giá trị thật (tốn compile), hoặc dynamic SQL có tham số chỉ thêm điều kiện cần (mỗi tổ hợp một plan, cache được), hoặc tách proc con khi ít tổ hợp.
- **"Tách IF/ELSE trong cùng một proc có bẫy gì?"** Cả proc compile một lần với tham số của lần gọi đầu, kể cả các câu trong nhánh không chạy. Nhánh được tối ưu cho giá trị không điển hình (ví dụ 0) rồi dùng lại cho giá trị thật. Tách nhánh thành proc con hoặc thêm `OPTION (RECOMPILE)` ở câu trong nhánh.
- **"LIKE '%abc%' trên bảng 120 triệu dòng, xử lý ra sao?"** B-tree không giúp vì không biết ký tự đầu. Nếu cột là danh sách mã, chuẩn hoá thành bảng con có index và tra bằng bằng; nếu là văn bản, dùng full-text search; nếu bắt buộc giữ, chỉ cho chạy trên tập đã lọc nhỏ bằng điều kiện SARGable khác.

#### Tóm tắt
- SARGable: cột "trần" một vế, biểu thức không phụ thuộc cột ở vế kia.
- Hàm, `CASE`, phép tính bao cột, `LIKE '%x'` làm mất seek.
- Lệch kiểu: phía bị chuyển là cột thì có thể mất seek; sửa kiểu tham số ở app.
- Catch-all: `RECOMPILE`, dynamic SQL có tham số, hoặc proc con.
- Kiểm chứng bằng Seek Predicates, không bằng tên toán tử.

#### Bài tập
1. Tạo `CREATE INDEX IX_Student_Created ON dbo.Student (CreatedAt);`. So plan và reads của `WHERE YEAR(CreatedAt) = 2025` và dạng viết lại theo dải.
   **Đáp án:** Dạng `YEAR()` scan index hoặc bảng (vài nghìn reads), dạng dải seek; số reads tỷ lệ với số dòng năm 2025 (cộng lookup nếu chọn cột ngoài index). Kiểm tra `Seek Predicates` có `CreatedAt`.
2. Tạo `CREATE INDEX IX_Student_Phone ON dbo.Student (Phone);`. Chạy ba câu: `WHERE Phone = '0900000123'`, `WHERE Phone = N'0900000123'`, `WHERE Phone = 900000123`. Ghi plan, reads, cảnh báo. Kiểm tra collation bằng `SELECT DATABASEPROPERTYEX('LabPerf','Collation');`.
   **Đáp án:** Câu 1 seek, 3–4 reads. Câu 2 có `CONVERT_IMPLICIT`: collation SQL thì scan index; collation Windows thì seek dải động, ít reads nhưng có cảnh báo. Câu 3 chuyển cột sang `INT`: scan và có cảnh báo; nếu có số điện thoại không phải số sẽ lỗi chuyển kiểu.
3. Tạo proc `dbo.SearchStudents` dạng catch-all trong bài, tạo index `(SchoolId)` và `(ProvinceId, Grade)`. Đo reads khi gọi `@SchoolId = 500`. Viết lại bằng `OPTION (RECOMPILE)` và bằng dynamic SQL, đo lại.
   **Đáp án:** Bản catch-all scan (khoảng 9.500 reads). Bản `RECOMPILE` và dynamic SQL seek `IX(SchoolId)` + lookup, khoảng 120 reads. Với dynamic SQL, kiểm tra `sys.dm_exec_query_stats` thấy mỗi tổ hợp tham số có một plan riêng được dùng lại.

### Bài 19.2. Statistics và ước lượng số dòng
**Viz:** cardinality

#### Mục tiêu
- Sau bài này, bạn đọc được histogram và density vector, và tính được ước lượng số dòng cho các điều kiện đơn giản.
- Giải thích được ngưỡng tự cập nhật statistics theo compatibility level và vấn đề khoá tăng dần.
- Nhận ra hậu quả của ước lượng lệch: join sai, grant sai, spill.
- Lập được chiến lược cập nhật statistics cho bảng lớn và bảng nạp lại.

#### Kiến thức nền
**Statistics là gì.** Mỗi statistics gắn với một cột hoặc tập cột (mỗi index có một statistics; SQL Server tự tạo thêm statistics cột đơn tên `_WA_Sys_...` khi truy vấn lọc trên cột chưa có). Gồm ba phần:
- Header: số dòng lúc tạo, số dòng được lấy mẫu, thời điểm cập nhật.
- Density vector: `1 / số giá trị khác nhau` cho từng tiền tố cột. `SchoolId` có 20.001 giá trị nên density ≈ 0,00005.
- Histogram trên **cột đầu tiên**: tối đa 200 bước. Mỗi bước có `RANGE_HI_KEY` (giá trị biên), `EQ_ROWS` (số dòng bằng đúng biên), `RANGE_ROWS` (số dòng nằm giữa biên trước và biên này), `DISTINCT_RANGE_ROWS`, `AVG_RANGE_ROWS`.

```sql
DBCC SHOW_STATISTICS ('dbo.Student', 'IX_Student_SchoolId');
SELECT s.name, sp.last_updated, sp.rows, sp.rows_sampled, sp.modification_counter
FROM sys.stats s
CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE s.object_id = OBJECT_ID('dbo.Student');
```

**Ước lượng thế nào.**
- `SchoolId = 1` (giá trị là biên của một bước): lấy `EQ_ROWS` = 200.000.
- `SchoolId = 500` (nằm trong một bước): lấy `AVG_RANGE_ROWS` của bước đó, khoảng 40.
- `SchoolId = @x` mà optimizer không biết giá trị (biến cục bộ, `OPTIMIZE FOR UNKNOWN`): density × số dòng = 1.000.000 / 20.001 ≈ 50. Sai với trường 1 (200.000) dù đúng với đa số trường.
- Nhiều điều kiện `AND` trên các cột khác nhau: CE cũ (compatibility level dưới 120) giả định độc lập, nhân các độ chọn lọc. CE mới (120 trở lên) dùng *exponential backoff*: độ chọn lọc mạnh nhất × căn bậc hai của cái thứ hai × căn bậc bốn của cái thứ ba..., bớt đánh giá thấp với các cột tương quan (tỉnh và huyện). Statistics nhiều cột chỉ giúp qua density của tiền tố.

**Hậu quả của ước lượng lệch.** Mọi lựa chọn của optimizer dựa trên số dòng ước lượng: loại join (ước lượng nhỏ → Nested Loops), thứ tự join, dùng index + lookup hay scan, song song hay không, và memory grant cho Sort/Hash. Ước lượng thấp → Nested Loops chạy hàng trăm nghìn lần, grant thiếu → spill. Ước lượng cao → scan, Hash, grant thừa.

**Ngưỡng tự cập nhật.** Statistics được coi là cũ khi `modification_counter` vượt ngưỡng:
- Compatibility level dưới 130: 500 + 20% số dòng. Bảng 100 triệu dòng cần 20 triệu thay đổi.
- Từ 130 (SQL Server 2016): `MIN(500 + 0,2·n, √(1000·n))`. Bảng 100 triệu dòng chỉ cần khoảng 316 nghìn thay đổi. (Trước 2016 cần trace flag 2371 để có hành vi này.)
Tự cập nhật chỉ xảy ra khi có truy vấn compile cần statistics đó; mặc định đồng bộ (truy vấn chờ cập nhật xong), có thể đặt `AUTO_UPDATE_STATISTICS_ASYNC ON`. Tự cập nhật lấy mẫu, tỷ lệ mẫu giảm khi bảng lớn.

**Khoá tăng dần.** Cột thời gian, Id tăng dần: dữ liệu mới luôn lớn hơn `RANGE_HI_KEY` cuối của histogram. Truy vấn "bản ghi trong 1 giờ qua" rơi đúng vùng histogram không biết. CE cũ ước lượng 1 dòng; CE mới ước lượng theo density trung bình, tốt hơn nhưng vẫn có thể lệch. Đây đúng là vùng được truy vấn nhiều nhất trên bảng log.

**Cập nhật thủ công.** `UPDATE STATISTICS dbo.T WITH FULLSCAN` (chính xác, đọc cả bảng), `WITH SAMPLE 10 PERCENT`, `PERSIST_SAMPLE_PERCENT = ON` (các bản mới) để lần tự cập nhật sau giữ tỷ lệ mẫu. Cập nhật statistics khiến plan liên quan được compile lại ở lần chạy sau.

Dùng mô phỏng ở trên để thấy ước lượng lệch dẫn tới chọn join, memory grant và spill ra sao.

#### Trong báo cáo
- 35 statistics thay đổi trên 100% kể từ lần cập nhật cuối; cá biệt 1.001.794% ở một bảng 75 nghìn dòng; bảng log thi thử 23.127% (Cụm 1 – Mục 4, Cụm 3 – Mục 7).
- Báo cáo kết luận optimizer chọn sai Nested Loops/Hash Join; đề xuất `UPDATE STATISTICS ... FULLSCAN` ban đêm và job hằng tuần.
- Proc lọc học sinh theo trường và khối: ước lượng 85 rồi 1 dòng, thực tế đọc 65.863 trang (Cụm 5 – Mục 7).

#### Cách sửa
- Job cập nhật statistics theo `modification_counter` (Ola Hallengren `@OnlyModifiedStatistics = 'Y'`), không theo lịch cứng cho mọi bảng. Bảng log tăng nhanh cập nhật dày hơn. Không chạy `FULLSCAN` trong giờ cao điểm.
- Bảng bị xoá rồi nạp lại: `UPDATE STATISTICS` ngay sau mỗi lần nạp, trong chính job nạp.
- Bảng có khoá tăng dần và truy vấn vùng mới: cập nhật statistics dày hơn, hoặc viết truy vấn không phụ thuộc ước lượng vùng đó (index đúng để plan seek bất kể số dòng).

#### Kiểm chứng
- Trong plan thật, số dòng ước lượng gần số dòng thật (cùng bậc độ lớn); `modification_counter` thấp; `last_updated` gần.

#### Bẫy
- Báo cáo nói ngưỡng 20% "không bao giờ đạt được" trên bảng lớn. Chỉ đúng khi DB ở compatibility level dưới 130 hoặc tắt auto update. Kiểm tra `compatibility_level` và `is_auto_update_stats_on` trước. Mức thay đổi hàng triệu phần trăm trên bảng nhỏ thường là bảng bị xoá rồi nạp lại nhiều lần: cần cập nhật statistics ngay sau mỗi lần nạp.
- `FULLSCAN` không phải lúc nào cũng cần: tốn I/O lớn trên bảng trăm triệu dòng; nhiều bảng lấy mẫu đủ tốt. Dùng `FULLSCAN` cho cột phân bố lệch mà mẫu không bắt được.
- Đổi compatibility level (ví dụ 110 → 150) đổi cả CE: một số truy vấn nhanh lên, một số chậm đi. Bật Query Store trước khi đổi để so và ép plan cũ nếu cần.

#### Câu hỏi phỏng vấn
- **"Ước lượng 1 dòng, thực tế 500.000 dòng. Plan bị gì?"** Optimizer chọn Nested Loops (500.000 lần seek bên trong), cấp memory grant quá nhỏ nên Sort/Hash spill xuống tempdb, và có thể chọn sai thứ tự join. Chậm hàng trăm lần.
- **"Statistics tự cập nhật khi nào?"** Khi số thay đổi vượt ngưỡng và có truy vấn compile cần statistics đó. Compatibility level dưới 130: 500 + 20% số dòng; từ 130: `MIN(500 + 0,2·n, √(1000·n))`, bảng 100 triệu dòng khoảng 316 nghìn thay đổi. Kiểm tra `modification_counter` trong `sys.dm_db_stats_properties`.
- **"Vì sao bảng log theo thời gian hay bị ước lượng sai ở dữ liệu mới?"** Dữ liệu mới nằm ngoài bước cuối của histogram vì khoá tăng dần. CE cũ ước lượng 1 dòng, CE mới ước lượng theo density trung bình; cả hai có thể lệch đúng ở vùng được truy vấn nhiều nhất. Cập nhật statistics dày hơn hoặc thiết kế index để plan đúng bất kể ước lượng.
- **"Có ba điều kiện AND trên ba cột, optimizer ước lượng thế nào?"** CE cũ nhân ba độ chọn lọc (giả định độc lập), thường đánh giá thấp khi các cột tương quan. CE từ 120 dùng exponential backoff: mạnh nhất × căn bậc hai cái thứ hai × căn bậc bốn cái thứ ba. Statistics nhiều cột chỉ cung cấp density cho tiền tố, không có histogram kết hợp.
- **"Chỉ dùng biến cục bộ thay tham số thì ước lượng thay đổi thế nào?"** Optimizer không biết giá trị biến lúc compile nên dùng density × số dòng (giá trị trung bình), không dùng histogram. Ổn định nhưng sai với giá trị lệch phân bố, như trường có 200.000 học sinh được ước lượng 50.

#### Tóm tắt
- Statistics = header + density vector + histogram (tối đa 200 bước, chỉ cột đầu).
- Ước lượng sai → join sai, grant sai, spill.
- Ngưỡng tự cập nhật: từ compat 130 là `MIN(500 + 0,2n, √(1000n))`.
- Khoá tăng dần làm vùng dữ liệu mới bị ước lượng kém.
- Cập nhật theo `modification_counter`; bảng nạp lại thì cập nhật ngay sau nạp.

#### Bài tập
1. Tạo index `IX_Student_SchoolId` (nếu chưa có), chạy `DBCC SHOW_STATISTICS`. Tìm bước có `RANGE_HI_KEY = 1`, ghi `EQ_ROWS`. Tính density × số dòng.
   **Đáp án:** `EQ_ROWS` = 200.000 cho `SchoolId = 1`. Density vector cột `SchoolId` ≈ 1/20.001 ≈ 0,00005; × 1.000.000 ≈ 50.
2. So ước lượng và số thật của ba câu: `WHERE SchoolId = 1`; `DECLARE @s INT = 1; ... WHERE SchoolId = @s`; cùng câu biến cục bộ thêm `OPTION (RECOMPILE)`.
   **Đáp án:** Literal: ước lượng 200.000, đúng. Biến cục bộ: ước lượng khoảng 50 (density), thật 200.000, plan có thể chọn seek + lookup sai. `OPTION (RECOMPILE)`: optimizer thấy giá trị biến lúc compile, ước lượng lại 200.000.
3. Tạo statistics trên `CreatedAt` (ví dụ index `IX_Student_Created` ở Bài 19.1), rồi tắt tự cập nhật cho DB lab: `ALTER DATABASE LabPerf SET AUTO_UPDATE_STATISTICS OFF;`. Chèn 50.000 học sinh mới có `CreatedAt` sau mốc lớn nhất (`StudentId` từ 1.000.001, `CreatedAt` tăng dần từ `MAX(CreatedAt)` + 1 phút). So ước lượng của `WHERE CreatedAt > '<mốc cũ>'` khi chạy bình thường và khi thêm `OPTION (USE HINT('FORCE_LEGACY_CARDINALITY_ESTIMATION'))`. Vì sao phải tắt tự cập nhật?
   **Đáp án:** 50.000 thay đổi đã vượt ngưỡng √(1000 × 1.000.000) ≈ 31.600 của compat 130+, nên nếu để bật, statistics sẽ tự cập nhật ở lần compile và không còn thấy vấn đề. CE cũ ước lượng khoảng 1 dòng; CE mới ước lượng lớn hơn 1 nhưng vẫn lệch xa 50.000 (con số cụ thể tuỳ phiên bản). Sau `UPDATE STATISTICS dbo.Student WITH FULLSCAN` cả hai ước lượng đúng. Bật lại `AUTO_UPDATE_STATISTICS ON` sau bài.

### Bài 19.3. Parameter sniffing và độ ổn định của plan

#### Mục tiêu
- Sau bài này, bạn giải thích được cơ chế parameter sniffing và vì sao nó chỉ gây hại khi dữ liệu phân bố lệch.
- Nhận biết được sniffing bằng plan XML, DMV và Query Store.
- Chọn được cách xử lý phù hợp (`RECOMPILE`, `OPTIMIZE FOR`, tách proc, dynamic SQL, Query Store, PSP 2022) và nêu cái giá của mỗi cách.
- Xử lý khẩn cấp một proc đang chậm mà không xoá toàn bộ plan cache.

#### Kiến thức nền
**Cơ chế.** Lần đầu proc (hoặc câu `sp_executesql`, truy vấn tham số hoá từ EF Core, Dapper) chạy, optimizer "ngửi" giá trị tham số thật, dùng histogram để ước lượng, rồi compile plan tối ưu cho giá trị đó. Plan được cache và dùng lại cho mọi lần gọi sau với bất kỳ giá trị nào, cho tới khi bị compile lại (plan bị đẩy khỏi cache, statistics được cập nhật, schema đổi, `sp_recompile`, restart). Đây là tính năng: tiết kiệm CPU compile. Nó chỉ thành vấn đề khi phân bố dữ liệu lệch, một plan không hợp mọi giá trị.

**Ví dụ trên `LabPerf`** (có `IX_Student_SchoolId` không covering):

```sql
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

Cùng một proc, tuỳ giá trị nào chạy đầu tiên sau mỗi lần compile mà cả hệ thống nhanh hoặc chậm. Triệu chứng điển hình: "proc lúc nhanh lúc chậm, sáng nay tự nhiên chậm", "restart xong lại nhanh".

**Nhận biết.**
- Plan thật (XML): mục `ParameterList` có `ParameterCompiledValue` (giá trị lúc compile) và `ParameterRuntimeValue` (giá trị lần chạy này). Khác nhau và số dòng lệch xa là dấu hiệu. Plan trong cache chỉ có giá trị compile.
- `sys.dm_exec_query_stats`: `min_logical_reads` và `max_logical_reads` chênh nhiều bậc độ lớn với cùng plan.
- Query Store: một `query_id` có nhiều `plan_id` với hiệu năng rất khác nhau; báo cáo *Regressed Queries*.

**Cách xử lý và cái giá.**

| Cách | Cơ chế | Cái giá |
|---|---|---|
| `OPTION (RECOMPILE)` ở câu lệnh | Compile mỗi lần với giá trị thật, có parameter embedding | CPU compile mỗi lần chạy câu đó |
| `WITH RECOMPILE` ở proc | Cả proc compile mỗi lần | Nặng hơn với proc nhiều câu; không có parameter embedding; plan không được cache nên không thấy trong DMV plan cache (Query Store vẫn ghi) |
| `OPTIMIZE FOR (@p = 500)` | Luôn compile cho giá trị chỉ định | Đúng cho giá trị điển hình, sai cho giá trị lệch |
| `OPTIMIZE FOR UNKNOWN` / biến cục bộ | Dùng density trung bình | Plan "trung bình", ổn định nhưng có thể không tốt cho ai |
| Tách proc con / nhánh theo loại giá trị | Mỗi nhóm giá trị có plan riêng | Phải biết trước nhóm (ví dụ trường lớn/nhỏ); thêm code |
| Dynamic SQL có tham số | Văn bản câu khác nhau theo nhánh → plan khác nhau | Phức tạp hơn, cần kỷ luật tham số hoá |
| Query Store force plan | Ép một plan đã biết là tốt | Plan ép có thể hỏng khi dữ liệu, index đổi; phải theo dõi |
| Query Store hints (2022) | Gắn hint (`RECOMPILE`, `MAXDOP`...) cho `query_id` không sửa code | Như hint tương ứng |
| PSP optimization (2022, compat 160) | Với điều kiện bằng trên cột phân bố lệch, tạo plan điều phối và tối đa 3 biến thể plan theo dải số dòng | Chỉ áp dụng cho một số dạng điều kiện; không đảm bảo luôn kích hoạt |
| Sửa gốc: covering index | Mọi giá trị đều seek không lookup, plan tốt cho cả hai | Chi phí ghi của index |

Với ví dụ trên, `CREATE INDEX ... ON dbo.Student (SchoolId) INCLUDE (FullName, Grade)` làm cả hai giá trị dùng chung một plan seek: trường 500 khoảng 3 reads, trường 1 khoảng 1.200–1.300 reads. Plan ổn định là kết quả của thiết kế index, không chỉ của hint.

**Xử lý khẩn cấp.** Proc đang chậm vì plan xấu: `EXEC sp_recompile 'dbo.ProcName';` hoặc xoá đúng một plan bằng `DBCC FREEPROCCACHE (plan_handle)`. Không chạy `DBCC FREEPROCCACHE` không tham số trên production: mọi câu phải compile lại cùng lúc, CPU tăng vọt. Đây chỉ là chữa cháy; plan xấu sẽ quay lại nếu giá trị không điển hình chạy đầu tiên lần sau.

**Phía .NET.** EF Core và Dapper gửi `sp_executesql` có tham số nên cũng bị sniffing. Thêm một bẫy: `SqlParameter` không khai báo độ dài chuỗi sẽ lấy độ dài theo giá trị, mỗi độ dài sinh một plan riêng, làm phình plan cache. Khai báo độ dài cố định khớp cột.

#### Trong báo cáo
- Proc lọc học sinh theo trường và khối chậm lại từ dưới 2 ms lên 669 ms, 65.863 reads/lần: plan compile cho bộ tham số nhỏ (Cụm 5 – Mục 7).
- Proc tìm kiếm giải thưởng tháng: CPU chênh 193 lần giữa các dòng thống kê (Cụm 4 – Mục 9).
- Đề xuất chung của báo cáo: thêm `OPTION (RECOMPILE)`.

#### Cách sửa
- Chọn theo tần suất gọi: proc gọi ít, tải nặng → `RECOMPILE`. Proc gọi hàng triệu lần → sửa gốc (index covering, bỏ Sort, tách nhánh, cache ở app).
- Cần chữa ngay không sửa code: Query Store force plan hoặc Query Store hint, kèm theo dõi.
- SQL Server 2022: kiểm tra PSP có kích hoạt cho câu đó không (plan có toán tử điều phối, Query Store có các biến thể) trước khi trông vào nó.

#### Kiểm chứng
- Query Store: mỗi `query_id` chỉ còn plan tốt; tổng CPU (gồm cả compile) giảm.
- Chạy proc với cả giá trị nhỏ và giá trị lớn sau mỗi lần compile lại, theo cả hai thứ tự.

#### Bẫy
- Proc thống kê hạng chạy 9,1 triệu lần. Thêm `RECOMPILE` nghĩa là compile 9,1 triệu lần, mỗi lần có thể tốn vài ms CPU với proc nhiều câu. Đo CPU compile trước khi áp dụng; ưu tiên index và cache Top N (báo cáo cũng đề xuất cache).
- Kết luận sniffing chỉ vì thấy nhiều dòng của proc trong `dm_exec_query_stats` (đó có thể là nhiều câu lệnh, Bài 17.2).
- Tái hiện trong SSMS bằng literal hoặc với `SET` options khác app: được plan khác, kết luận sai.

#### Câu hỏi phỏng vấn
- **"Khi nào không nên dùng OPTION (RECOMPILE)?"** Khi câu chạy rất thường xuyên và rẻ: chi phí compile vượt lợi ích. Khi proc phức tạp, compile lâu. Lúc đó dùng index để plan ổn định, tách nhánh, hoặc ép plan bằng Query Store.
- **"Làm sao xác định một proc bị parameter sniffing?"** Lấy plan thật, so `ParameterCompiledValue` với `ParameterRuntimeValue` và số dòng ước lượng với số thật. Xem `min_logical_reads`/`max_logical_reads` của câu trong `dm_exec_query_stats` chênh nhiều bậc. Query Store có nhiều plan cho cùng `query_id` với hiệu năng khác hẳn.
- **"Gán tham số vào biến cục bộ có sửa được sniffing không?"** Nó tắt sniffing: optimizer dùng density trung bình thay vì histogram, giống `OPTIMIZE FOR UNKNOWN`. Plan ổn định nhưng tối ưu cho giá trị trung bình, có thể tệ cho cả giá trị nhỏ lẫn lớn. Là lựa chọn có chủ đích, không phải cách sửa mặc định.
- **"PSP optimization trong SQL Server 2022 giải quyết gì, giới hạn ở đâu?"** Với compatibility level 160, khi điều kiện bằng trên cột có phân bố lệch, optimizer tạo một plan điều phối và tối đa 3 biến thể plan theo dải số dòng ước lượng, chọn biến thể theo giá trị lúc chạy. Chỉ áp dụng cho một số dạng điều kiện và không phải lúc nào cũng kích hoạt; vẫn cần kiểm chứng bằng plan và Query Store.
- **"Proc đang chậm trên production vì plan xấu, xử lý ngay thế nào?"** Lấy plan đang dùng để làm bằng chứng, rồi `sp_recompile` proc hoặc `DBCC FREEPROCCACHE (plan_handle)` cho đúng plan đó; không xoá toàn bộ cache. Nếu tái diễn, ép plan tốt bằng Query Store và lên kế hoạch sửa gốc (index, tách nhánh).

#### Tóm tắt
- Plan compile theo giá trị tham số lần đầu và dùng lại cho mọi giá trị.
- Chỉ gây hại khi dữ liệu phân bố lệch.
- Nhận biết bằng compiled vs runtime value, min/max reads, nhiều plan trong Query Store.
- Mỗi cách xử lý có cái giá; `RECOMPILE` không hợp với proc gọi hàng triệu lần.
- Sửa gốc tốt nhất thường là index covering để mọi giá trị dùng chung một plan tốt.

#### Bài tập
1. Chạy đoạn script trong bài theo hai thứ tự, ghi reads mỗi lần. Lấy plan thật của lần chạy `@SchoolId = 1` sau khi compile cho 500 và tìm `ParameterCompiledValue`, `ParameterRuntimeValue`.
   **Đáp án:** Compile cho 500 rồi chạy 1: khoảng 600.000 reads, `ParameterCompiledValue = (500)`, `ParameterRuntimeValue = (1)`, Key Lookup có actual 200.000 so với estimated khoảng 40. Compile cho 1 rồi chạy 500: khoảng 9.500 reads thay vì 120.
2. Thử lần lượt ba cách: `OPTION (RECOMPILE)`, `OPTIMIZE FOR (@SchoolId UNKNOWN)`, covering index. Với mỗi cách, đo reads của hai giá trị và nêu cái giá.
   **Đáp án:** `RECOMPILE`: 120 và 9.500 reads (tốt cho từng giá trị), tốn compile. `UNKNOWN`: ước lượng 50, plan seek + lookup cố định, trường 1 vẫn khoảng 600.000 reads. Covering: khoảng 3 và 1.200–1.300 reads, không cần hint, tốn thêm chi phí ghi.
3. Bật Query Store, chạy proc theo thứ tự tạo ra plan xấu, rồi ép plan tốt bằng `sp_query_store_force_plan`. Kiểm tra plan được dùng sau `sp_recompile`.
   **Đáp án:** Tìm `query_id`, `plan_id` trong `sys.query_store_plan` (join `sys.query_store_query` theo `object_id` của proc). Sau khi ép, mọi lần compile lại đều dùng plan đã ép; `is_forced_plan = 1`. Gỡ bằng `sp_query_store_unforce_plan`.

### Bài 19.4. Memory grant, Sort, Hash và spill

#### Mục tiêu
- Sau bài này, bạn giải thích được memory grant được tính thế nào và vì sao Sort, Hash cần nó.
- Phân biệt được hai hướng sai: grant thiếu (spill) và grant thừa (`RESOURCE_SEMAPHORE`).
- Đọc được thông tin grant trong plan và DMV, nhận ra cảnh báo spill.
- Chọn được cách giảm grant: bỏ Sort bằng index, bỏ cột rộng, sửa ước lượng, giới hạn grant.

#### Kiến thức nền
**Workspace memory và grant.** Một phần bộ nhớ của SQL Server dành cho các toán tử cần chỗ làm việc: Sort, Hash Match (join, aggregate), một số toán tử khác. Trước khi chạy, mỗi truy vấn xin một memory grant dựa trên **ước lượng**: số dòng ước lượng × độ rộng dòng ước lượng cho mỗi toán tử cần bộ nhớ. Grant có hai mức: mức tối thiểu để bắt đầu chạy và mức lý tưởng để làm hết trong RAM. Nếu quỹ còn đủ, truy vấn nhận grant và chạy; nếu không, nó xếp hàng chờ với wait `RESOURCE_SEMAPHORE`. Mặc định một truy vấn không được nhận quá 25% workspace memory (thiết lập `REQUEST_MAX_MEMORY_GRANT_PERCENT` của workload group mặc định).

**Độ rộng dòng ước lượng.** Cột độ dài cố định tính đúng kích thước. Cột độ dài thay đổi được ước lượng theo độ dài khai báo (khoảng một nửa), không theo dữ liệu thật; cột `(max)` dùng một giá trị cố định lớn. Hệ quả: `SELECT` một cột `nvarchar(4000)` hay `nvarchar(max)` trong câu có Sort làm grant phình to dù dữ liệu thật chỉ vài chục ký tự.

**Sort và Hash.**
- Sort là toán tử chặn: phải đọc hết input trước khi trả dòng đầu. Với `TOP (20) ... ORDER BY`, plan dùng Top N Sort chỉ giữ 20 dòng tốt nhất trong bộ nhớ, nhưng vẫn phải đọc hết input.
- Hash Match dựng bảng băm từ input nhỏ hơn (build) trong bộ nhớ grant, rồi dò bằng input kia (probe).

**Grant thiếu → spill.** Ước lượng 50 dòng, thực tế 200.000: grant nhỏ, Sort không đủ chỗ phải ghi từng phần xuống tempdb rồi đọc lại để trộn (Sort Warnings); Hash phải chia partition xuống tempdb, có thể nhiều tầng đệ quy (Hash Warnings). I/O tempdb thay cho phép toán trong RAM: chậm hàng chục lần.

**Grant thừa → chờ.** Ước lượng 1 triệu dòng rộng, thực tế vài trăm: grant hàng GB được giữ suốt thời gian chạy dù chỉ dùng vài MB. Nhiều phiên cùng lúc thì quỹ cạn, truy vấn khác (kể cả truy vấn nhỏ có Sort) xếp hàng `RESOURCE_SEMAPHORE`. Bộ nhớ grant cũng lấy từ bộ nhớ mà buffer pool có thể dùng.

**Quan sát.**

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

Trong plan thật, mở thuộc tính toán tử SELECT → `MemoryGrantInfo`: `RequestedMemory`, `GrantedMemory`, `MaxUsedMemory`. Cảnh báo `ExcessiveGrant` khi dùng ít hơn nhiều so với cấp; tam giác vàng trên Sort/Hash khi spill.

**Memory grant feedback.** SQL Server tự chỉnh grant qua các lần chạy của cùng plan: batch mode từ 2017 (compatibility level 140), row mode từ 2019 (150); 2022 thêm tính theo phân vị và lưu bền phản hồi vào Query Store. Feedback giúp các câu chạy lặp với dữ liệu ổn định; không giúp lần chạy đầu, câu `RECOMPILE`, và tự tắt nếu grant cần thiết dao động mạnh giữa các lần chạy (đúng trường hợp parameter sniffing).

**Batch mode on rowstore** (2019, compatibility level 150, tính năng của Enterprise/Developer): Sort, Hash, aggregate xử lý theo lô dòng, hiệu quả CPU hơn cho truy vấn phân tích trên bảng rowstore lớn. Không thay thế việc sửa ước lượng.

Dùng mô phỏng ở Bài 19.2 để thấy ước lượng lệch dẫn tới grant thiếu và spill.

#### Trong báo cáo
- Proc tìm kiếm giải thưởng tháng: cấp tối đa 7.147 MB, dùng 1,18 MB, trên bảng chỉ 56.170 dòng; spill 486.114 trang (Cụm 4 – Mục 9).
- Proc Top N xếp hạng: trung bình khoảng 313 MB mỗi lần, dùng 1,5 MB (Cụm 4 – Mục 8).
- Công cụ giám sát xin 60,76 GB grant cho một lần chạy (Cụm 3 – Mục 10, 11).
- Cụm kho dữ liệu: `RESOURCE_SEMAPHORE` tăng gần gấp đôi giữa hai lần quét (Cụm 4 – Mục 13).

#### Cách sửa
- Index phục vụ `ORDER BY` (Bài 18.2): bỏ Sort thì bỏ luôn grant của Sort.
- Bỏ sort hai lần; Sort trên tập đã lọc nhỏ, rồi mới join lấy cột rộng.
- Không kéo cột rộng (`nvarchar(max)`, cột `nvarchar(4000)` dư độ dài) qua Sort/Hash; khai báo độ dài cột sát dữ liệu.
- Sửa ước lượng: statistics, `#temp` thay bảng biến, `RECOMPILE` có chọn lọc.
- Giới hạn: hint `MAX_GRANT_PERCENT` cho từng câu; Resource Governor (`REQUEST_MAX_MEMORY_GRANT_PERCENT`) cho nhóm báo cáo và giám sát. Resource Governor là tính năng Enterprise; trên Standard chỉ dùng được hint.

#### Kiểm chứng
- `max_used_grant_kb` gần `grant_kb`; `total_spills` bằng 0; `RESOURCE_SEMAPHORE` giảm trong wait stats chênh lệch.

#### Bẫy
- "Query vẫn nhanh nên grant thừa không sao": thiệt hại rơi vào các truy vấn khác lúc tải cao.
- Tăng RAM để hết `RESOURCE_SEMAPHORE`: quỹ to hơn nhưng câu xin thừa vẫn xin thừa theo tỷ lệ.
- `MAX_GRANT_PERCENT` quá thấp cho câu thực sự cần nhiều bộ nhớ: đổi chờ thành spill.
- Trông vào memory grant feedback cho proc bị sniffing: grant dao động nên feedback tự tắt.

#### Câu hỏi phỏng vấn
- **"Grant thừa 99% thì hại gì nếu query vẫn nhanh?"** RAM bị giữ suốt lúc chạy. Nhiều phiên chạy cùng lúc thì tổng grant vượt quỹ, các truy vấn khác, kể cả truy vấn nhỏ, phải chờ `RESOURCE_SEMAPHORE`. Buffer pool cũng bị thu hẹp nên đọc đĩa nhiều hơn.
- **"Memory grant được tính từ đâu?"** Từ số dòng ước lượng và độ rộng dòng ước lượng ở các toán tử cần bộ nhớ (Sort, Hash). Cột độ dài thay đổi được ước lượng theo độ dài khai báo, không theo dữ liệu thật. Vì vậy ước lượng số dòng sai hoặc cột khai báo quá rộng đều làm grant sai.
- **"Chỉ lấy TOP 20 sao vẫn cần Sort và grant?"** Không có index sắp đúng thứ tự, SQL phải đọc hết tập khớp để biết 20 dòng nào đứng đầu. Top N Sort chỉ giữ 20 dòng nhưng vẫn đọc toàn bộ input. Index có cột `ORDER BY` sau các cột lọc bằng cho phép đọc 20 dòng rồi dừng, không Sort, không grant.
- **"Làm sao biết truy vấn bị spill?"** Plan thật có cảnh báo Sort Warnings hoặc Hash Warnings trên toán tử; `total_spills` trong `sys.dm_exec_query_stats`; Extended Events `sort_warning`, `hash_warning`. Gốc thường là ước lượng thấp hơn thực tế.
- **"Memory grant feedback có thay thế việc sửa truy vấn không?"** Không. Nó chỉ chỉnh sau khi đã chạy sai ít nhất một lần, áp dụng cho plan được dùng lại, và tự tắt khi nhu cầu dao động (proc bị sniffing). Sửa gốc vẫn là index bỏ Sort, sửa ước lượng, bỏ cột rộng.

#### Tóm tắt
- Grant = số dòng ước lượng × độ rộng ước lượng cho Sort/Hash, cấp trước khi chạy.
- Thiếu → spill xuống tempdb; thừa → các truy vấn khác chờ `RESOURCE_SEMAPHORE`.
- Sort đọc hết input kể cả với `TOP`; index đúng thứ tự bỏ được cả Sort lẫn grant.
- Cột khai báo rộng làm grant phình.
- Feedback (2017 batch, 2019 row, 2022 persistence) hỗ trợ, không thay việc sửa.

#### Bài tập
1. So grant của hai câu (plan thật, thuộc tính `MemoryGrantInfo`): `SELECT TOP (100) StudentId, FullName FROM dbo.Student ORDER BY FullName;` và cùng câu với `CAST(FullName AS NVARCHAR(4000)) AS FullName`.
   **Đáp án:** Câu thứ hai có `GrantedMemory` lớn hơn nhiều dù dữ liệu như nhau, vì độ rộng ước lượng theo khai báo `nvarchar(4000)`. Thường kèm cảnh báo `ExcessiveGrant` vì `MaxUsedMemory` nhỏ.
2. Gây spill bằng ước lượng sai: `DECLARE @s INT = 1; SELECT StudentId, FullName, Phone FROM dbo.Student WHERE SchoolId = @s ORDER BY FullName;` (không có index covering). Chạy 3 lần liên tiếp với plan thật, theo dõi cảnh báo spill và `GrantedMemory`.
   **Đáp án:** Ước lượng khoảng 50 dòng (density), thực tế 200.000: lần đầu grant nhỏ, Sort spill. Ở compatibility level 150+, row mode memory grant feedback tăng grant ở các lần sau, spill biến mất. Thêm `OPTION (RECOMPILE)` thì ước lượng đúng ngay từ đầu.
3. Viết truy vấn tìm 10 câu lệnh có tỷ lệ dùng grant thấp nhất (`max_used_grant_kb / max_grant_kb`) trong số câu có `max_grant_kb > 100 MB`.
   **Đáp án:** Từ `sys.dm_exec_query_stats` lọc `max_grant_kb > 102400`, tính `1.0 * max_used_grant_kb / NULLIF(max_grant_kb, 0)`, sắp tăng dần, `CROSS APPLY sys.dm_exec_sql_text` để lấy câu lệnh. Đây là danh sách ưu tiên để giảm grant.

### Bài 19.5. Bảng biến, bảng tạm, TVP, JSON và XML

#### Mục tiêu
- Sau bài này, bạn so sánh được bảng biến, bảng tạm và TVP về statistics, recompile, phạm vi, và tác động tới plan.
- Giải thích được table variable deferred compilation (2019) sửa được gì và không sửa được gì.
- Chọn được cách truyền danh sách từ .NET vào proc và cách giữ tập trung gian trong proc.
- Nhận ra chi phí của `STRING_SPLIT`, `OPENJSON`, `FOR JSON`, `FOR XML PATH` khi dùng sai chỗ.

#### Kiến thức nền
**Bảng biến (`DECLARE @t TABLE`).** Nằm trong tempdb như bảng tạm (không phải "chỉ trong RAM"). Đặc điểm:
- Không có statistics theo cột, không tự tạo statistics.
- Trước SQL Server 2019: lúc compile bảng còn rỗng nên optimizer ước lượng 1 dòng (trừ khi câu có `OPTION (RECOMPILE)`).
- Từ 2019, compatibility level 150: *table variable deferred compilation* hoãn compile câu dùng bảng biến tới lần chạy đầu, nên biết **tổng số dòng** thật lúc đó. Plan sau đó được dùng lại cho các lần gọi có số dòng khác. Vẫn không có histogram: điều kiện lọc và join trên cột của bảng biến vẫn là đoán.
- Câu lệnh ghi vào bảng biến không chạy song song.
- Không bị ảnh hưởng bởi `ROLLBACK` của transaction (đôi khi hữu ích để giữ log lỗi).
- Có thể khai báo PRIMARY KEY, UNIQUE, và từ 2014 index inline.

**Bảng tạm (`#t`).** Có statistics, tạo index sau khi tạo bảng, ước lượng dựa trên dữ liệu thật. Đổi lại: thay đổi số dòng nhiều có thể gây recompile câu dùng nó (ngưỡng thấp hơn bảng thường). Trong proc, SQL Server có *temp table caching*: giữ lại cấu trúc bảng tạm giữa các lần gọi để không phải tạo, huỷ metadata mỗi lần. Caching mất khi có DDL sau khi tạo (`ALTER TABLE #t ADD ...`, `CREATE INDEX` riêng, constraint có tên). Tạo và huỷ hàng triệu bảng tạm gây tranh chấp latch trên trang metadata của tempdb (`PAGELATCH_*` trên tempdb). SQL Server 2019 có tuỳ chọn *memory-optimized tempdb metadata* để giảm tranh chấp này (cấu hình server, cần restart).

```sql
-- Đúng: khai báo index ngay trong CREATE, không ALTER sau
CREATE TABLE #ids (StudentId INT NOT NULL PRIMARY KEY);
```

**TVP (table-valued parameter).** Kiểu bảng do người dùng định nghĩa, truyền từ app vào proc dưới dạng `READONLY`. Thay cho chuỗi CSV, JSON hay XML: có kiểu, không parse chuỗi, có thể khai báo PRIMARY KEY. Về ước lượng, TVP không có histogram theo cột như bảng biến; ước lượng số dòng tuỳ phiên bản và thời điểm compile, nên xem plan thật. Nếu tập lớn và cần join phức tạp, chép TVP sang `#temp` có PK trong proc.

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

**Chuỗi, JSON, XML.** `STRING_SPLIT` (2016; 2022 thêm cột thứ tự `enable_ordinal`), `OPENJSON`, `FOR JSON`, `FOR XML PATH`:
- Tốn CPU để dựng và parse chuỗi, mất kiểu dữ liệu.
- Optimizer không biết số phần tử: ước lượng là một hằng số cố định, không theo dữ liệu thật.
- Hợp với ranh giới hệ thống (nhận JSON từ API, trả JSON cho client). Không hợp để chuyển dữ liệu giữa hai proc trong cùng DB: dùng `#temp` (proc con thấy `#temp` của proc cha) hoặc TVP.

**Chọn cái nào.**

| Tình huống | Chọn |
|---|---|
| Vài chục dòng, dùng một lần, không join phức tạp | Bảng biến (có PK) |
| Hàng nghìn dòng trở lên, dùng để join, lọc, sắp xếp | `#temp` + PK/index khai báo trong `CREATE` |
| Truyền danh sách từ .NET vào proc | TVP |
| Truyền tập giữa các proc cùng DB | `#temp` hoặc TVP, không JSON |
| Cột chứa danh sách mã | Chuẩn hoá thành bảng con có index |

#### Trong báo cáo
- Nhóm proc sinh đề: 3.653.268 spill ở proc kiểm tra đề, 10.360.549 spill ở proc tìm câu hỏi CMS, đều dựng trên bảng biến (Cụm 6 – Mục 5). Proc truy vấn câu hỏi theo mã đề dùng hơn 10 bảng biến, có đợt tăng đột biến khoảng 7,27 triệu reads (nguồn: mục 2).
- Proc tạo kết quả vòng theo lô: Eager Spool trên bảng biến, 9.619 spill (Cụm 4 – Mục 5).
- Job báo cáo tài khoản theo ngày: plan 294 toán tử, 83 Table Scan quanh một bảng biến (Cụm 4 – Mục 14).
- Proc lọc học sinh: gom ID thành JSON (`FOR JSON AUTO`) truyền sang proc con để parse lại (Vấn đề 4).
- Proc gói cước: `STRING_SPLIT` + `XML PATH`, 4,95 triệu lần, khoảng 34 ms và 2.500 reads mỗi lần; báo cáo đề xuất cache Redis 60 phút (Cụm 2 – Mục 3; nguồn: mục 4.2).
- 63,6 triệu lượt tạo bảng tạm trong metadata tempdb (Cụm 3 – Mục 10).
- Proc lấy quan hệ user: tạo `#t`, `ALTER TABLE #t ADD ...` rồi `UPDATE`, mất temp table caching, gây recompile và tranh chấp metadata, có lần tới 20 s; viết lại thành một `SELECT` với 2 `LEFT JOIN`, trung bình khoảng 7,9 ms (nguồn: mục 4.4).

#### Cách sửa
- `#temp` + PRIMARY KEY khi tập trung gian lớn hoặc dùng để join, sắp xếp. Giữ bảng biến cho tập vài chục dòng.
- Khai báo mọi cột, PK, index ngay trong `CREATE TABLE #t`; không `ALTER` sau.
- Danh sách lưu thành chuỗi trong một cột: chuẩn hoá thành bảng con có index.
- Truyền danh sách từ app bằng TVP; truyền tập giữa proc bằng `#temp`.
- Kết quả tính từ chuỗi, JSON tốn kém mà ít đổi: cache ở app.

#### Kiểm chứng
- Spill bằng 0; plan hết Table Scan trên bảng biến; Eager Spool biến mất; ước lượng trên bảng trung gian gần số thật.
- Bộ đếm `Temp Tables Creation Rate` (`sys.dm_os_performance_counters`, nhóm General Statistics) giảm sau khi sửa proc tạo bảng tạm.

#### Bẫy
- Tin rằng bảng biến nằm trong RAM nên nhanh hơn: cả hai đều ở tempdb.
- Đổi hết bảng biến sang `#temp` mà không đo: với tập rất nhỏ gọi rất dày, recompile của `#temp` có thể tốn hơn.
- `SELECT ... INTO #t` rồi `CREATE INDEX` trên `#t` trong proc gọi dày: mất caching. Cân nhắc `CREATE TABLE` có index inline rồi `INSERT`.

#### Câu hỏi phỏng vấn
- **"SQL Server 2019 đã sửa ước lượng bảng biến, còn cần đổi sang #temp không?"** Deferred compilation chỉ sửa tổng số dòng, không có phân bố giá trị theo cột, nên lọc và join trên bảng biến vẫn ước lượng theo đoán. Kiểm tra compatibility level (150+) và plan thật; tập lớn dùng để join thì vẫn nên `#temp` + PK.
- **"Khác nhau chính giữa bảng biến và bảng tạm là gì?"** Bảng tạm có statistics, tạo index sau được, ước lượng theo dữ liệu thật, có thể gây recompile, bị rollback theo transaction. Bảng biến không có statistics, ước lượng 1 dòng trước 2019 hoặc tổng số dòng ở lần compile từ 2019, không gây recompile vì số dòng, không bị rollback, ghi vào nó không song song. Cả hai đều nằm trong tempdb.
- **"Truyền một danh sách 5.000 ID từ .NET vào proc, cách nào tốt?"** TVP với kiểu bảng có PRIMARY KEY: có kiểu, không parse chuỗi, một round-trip. Tránh nối chuỗi CSV hay JSON rồi split trong proc, và tránh `IN (@p1, ..., @p5000)` vì giới hạn 2.100 tham số và mỗi số lượng tham số sinh một plan. Trong proc, nếu join phức tạp thì chép sang `#temp`.
- **"Vì sao `ALTER TABLE #t ADD ...` sau khi tạo bảng tạm trong proc lại gây hại?"** DDL sau khi tạo làm mất temp table caching: mỗi lần gọi phải tạo, huỷ metadata thật trong tempdb, gây tranh chấp latch metadata khi gọi dày, và câu dùng `#t` bị recompile. Khai báo đủ cột và index ngay trong `CREATE TABLE`.
- **"Dùng FOR JSON để chuyển tập ID giữa hai proc có vấn đề gì?"** Tốn CPU serialize và parse, mất kiểu, và `OPENJSON` có ước lượng cố định nên plan phía nhận đoán sai số dòng. Proc con đọc được `#temp` của proc cha; dùng `#temp` hoặc TVP thay thế.

#### Tóm tắt
- Bảng biến: không statistics; 2019 chỉ sửa tổng số dòng.
- Bảng tạm: có statistics, có thể recompile; khai báo index trong `CREATE` để giữ caching.
- TVP cho danh sách từ app; `#temp` cho tập giữa các proc.
- `STRING_SPLIT`, `OPENJSON`, `FOR JSON/XML`: dùng ở ranh giới hệ thống, không dùng nội bộ DB.
- Cột chứa danh sách là lỗi mô hình dữ liệu: chuẩn hoá.

#### Bài tập
1. So ước lượng và reads của câu join 100.000 ID với `Student` khi dùng bảng biến và khi dùng `#temp`, ở compatibility level 160 và khi thêm `OPTION (USE HINT('DISABLE_DEFERRED_COMPILATION_TV'))`.
   **Đáp án:**
   ```sql
   DECLARE @t TABLE (Id INT NOT NULL PRIMARY KEY);
   INSERT @t SELECT StudentId FROM dbo.Student WHERE StudentId % 10 = 0;
   SELECT COUNT(*) FROM @t t JOIN dbo.Student s ON s.StudentId = t.Id WHERE s.Grade = 6;
   SELECT COUNT(*) FROM @t t JOIN dbo.Student s ON s.StudentId = t.Id WHERE s.Grade = 6
   OPTION (USE HINT('DISABLE_DEFERRED_COMPILATION_TV'));
   ```
   Có deferred compilation: ước lượng `@t` là 100.000 dòng, plan hợp lý (thường Merge hoặc Hash Join). Tắt đi: ước lượng 1 dòng, Nested Loops với 100.000 lần seek (khoảng 300.000 reads). `#temp` cho ước lượng đúng và có statistics nếu lọc thêm trên cột của nó.
2. Tạo kiểu `dbo.IntList` và proc `dbo.GetSchoolNames` trong bài, gọi từ SSMS bằng `DECLARE @ids dbo.IntList; INSERT @ids VALUES (1),(2),(500); EXEC dbo.GetSchoolNames @ids;`. Xem plan thật: ước lượng số dòng của `@Ids` là bao nhiêu?
   **Đáp án:** Ghi lại con số trên máy bạn và so với 3 dòng thật; gọi lại với 1.000 ID để xem plan có được dùng lại với ước lượng cũ không. Kết luận: luôn kiểm tra ước lượng TVP bằng plan thật; tập lớn thì chép sang `#temp`.
3. Viết hai phiên bản proc tạo bảng tạm: (A) `CREATE TABLE #t (Id INT)` rồi `ALTER TABLE #t ADD Name NVARCHAR(100)`; (B) khai báo đủ cột và PK ngay trong `CREATE`. Gọi mỗi proc 1.000 lần và đọc bộ đếm `Temp Tables Creation Rate` trước và sau.
   **Đáp án:** Bộ đếm tăng khoảng 1.000 với (A) vì mỗi lần gọi tạo bảng tạm mới; với (B) tăng rất ít nhờ temp table caching. Đọc bằng `SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Temp Tables Creation Rate';`.

### Bài 19.6. Set-based, phân trang, đếm và sắp xếp

#### Mục tiêu
- Sau bài này, bạn chuyển được logic xử lý từng dòng (cursor, `WHILE`) thành câu lệnh theo tập.
- Viết được upsert an toàn khi có ghi đồng thời và biết bẫy của `MERGE`.
- Thay được `OFFSET/FETCH` trang sâu bằng keyset pagination đúng cú pháp T-SQL.
- Xử lý được đếm tổng, `ORDER BY` động, và báo cáo tổng hợp bằng bảng tổng hợp tính tăng dần.

#### Kiến thức nền
**RBAR** (row by agonizing row): cursor, vòng `WHILE`, hoặc gọi proc cho từng dòng. Mỗi câu lệnh trong vòng lặp tốn chi phí cố định: thực thi plan, lấy và nhả khoá, ghi bản ghi log, latch trang. Một câu theo tập trả chi phí đó một lần và cho optimizer chọn Hash/Merge Join thay vì seek lặp.

```sql
-- RBAR: cập nhật tỉnh của học sinh theo trường, từng dòng
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT StudentId, SchoolId FROM dbo.Student WHERE StudentId <= 100000;
-- ... FETCH, rồi UPDATE dbo.Student SET ProvinceId = (SELECT ...) WHERE StudentId = @id ...

-- Set-based: một câu
UPDATE s SET s.ProvinceId = sc.ProvinceId, s.DistrictId = sc.DistrictId
FROM dbo.Student s JOIN dbo.School sc ON sc.SchoolId = s.SchoolId
WHERE s.StudentId <= 100000 AND (s.ProvinceId <> sc.ProvinceId OR s.DistrictId <> sc.DistrictId);
```

Điều kiện `<>` ở cuối tránh ghi lại dòng không đổi (giảm log, giảm khoá).

**Cập nhật rất nhiều dòng.** Một câu `UPDATE` 10 triệu dòng giữ khoá lâu, có thể leo thang khoá lên cả bảng (khi một câu giữ khoảng 5.000 khoá trên một đối tượng), làm log phình và replica trễ. Cách làm: vẫn theo tập nhưng chia lô theo khoá, mỗi lô vài nghìn dòng, mỗi lô một transaction ngắn.

```sql
DECLARE @from INT = 0, @batch INT = 5000, @max INT = (SELECT MAX(StudentId) FROM dbo.Student);
WHILE @from < @max
BEGIN
    UPDATE dbo.Student SET Status = 1
    WHERE StudentId > @from AND StudentId <= @from + @batch AND Status = 0;
    SET @from += @batch;
END;
```

**Xoá rồi chèn lại và upsert.** Xoá toàn bộ rồi chèn lại sinh log gấp đôi, làm statistics nhảy, và có khoảng trống dữ liệu với người đọc. Thay bằng cập nhật phần đổi, chèn phần mới. `MERGE` gọn nhưng không tự an toàn khi có ghi đồng thời: hai phiên cùng thấy "chưa có" và cùng chèn. Cần `WITH (HOLDLOCK)` trên đích; `MERGE` cũng có lịch sử lỗi ở một số kịch bản, nên nhiều đội chọn mẫu tách rời:

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

**Phân trang.** `OFFSET @n ROWS FETCH NEXT 20 ROWS ONLY` đọc `n + 20` dòng theo thứ tự rồi bỏ `n` dòng đầu: trang càng sâu càng chậm, và dữ liệu chèn giữa hai lần bấm làm trùng hoặc sót dòng. Keyset pagination nhớ khoá của dòng cuối trang trước và seek thẳng tới sau nó. T-SQL không hỗ trợ so sánh bộ giá trị kiểu `(a, b) > (@a, @b)`; phải viết tách:

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

Thứ tự sắp phải có cột duy nhất cuối cùng (`StudentId`) để không trùng, sót. Index không unique tự mang `StudentId` (khoá clustered) ở cuối key, nên khớp đúng `ORDER BY CreatedAt, StudentId`. Đánh đổi: không nhảy thẳng tới trang 500 được, chỉ "trang sau", "trang trước".

**Đếm tổng.** Chạy thêm `SELECT COUNT(*)` với cùng điều kiện là quét thêm một lần; `COUNT(*) OVER ()` gắn vào câu lấy trang buộc SQL tính trên toàn bộ tập khớp. Lựa chọn: lấy `TOP (21)` để biết còn trang sau không; chỉ đếm ở trang đầu và cache; hiển thị số xấp xỉ; với tổng toàn bảng dùng `sys.dm_db_partition_stats`.

**`ORDER BY` động.** `ORDER BY CASE @sort WHEN 1 THEN FullName END, CASE @sort WHEN 2 THEN CreatedAt END` làm optimizer không dùng được thứ tự của index nào, luôn phải Sort. Tách nhánh theo từng kiểu sắp, hoặc dynamic SQL chỉ nhận tên cột từ danh sách cho phép.

**Tổng hợp.** Báo cáo `GROUP BY` toàn bảng giao dịch mỗi lần mở là quét lại toàn bộ lịch sử. Thay bằng bảng tổng hợp theo ngày, job chỉ tính phần dữ liệu mới (từ mốc lần chạy trước), báo cáo đọc bảng tổng hợp. Indexed view là cách khác, nhưng tăng chi phí ghi trên bảng gốc và trên Standard cần hint `NOEXPAND` để được dùng.

#### Trong báo cáo
- Proc phân xã và gộp trường cập nhật từng dòng → gộp thành một `UPDATE JOIN` (Cụm 2 – Mục 13, Cụm 5 – Mục 10).
- Proc tìm kiếm giải thưởng tháng: sắp xếp hai lần, `COUNT` riêng, `EXISTS` từng dòng trên bảng biến một cột (Cụm 4 – Mục 9).
- Job báo cáo giao dịch theo ngày: Delete + Insert riêng → `MERGE`; báo cáo doanh thu `GROUP BY` toàn bảng giao dịch → bảng tổng hợp (Cụm 4 – Mục 14).
- Job xếp hạng tháng chạy 864 lần/ngày (khoảng 100 giây một lần), mỗi lần tính lại toàn bộ (Cụm 4 – Mục 6).
- Proc lấy điểm danh theo sự kiện: vòng `WHILE`, `OPENJSON` rồi `DELETE` từng dòng trên bảng biến không index, trung bình khoảng 4,8 s → viết lại thành một câu set-based dùng `CROSS APPLY OPENJSON` (nguồn: mục 4.4).

#### Cách sửa
- Thay vòng lặp bằng `UPDATE/INSERT/DELETE ... JOIN`; cập nhật lớn thì chia lô theo khoá.
- Upsert: `UPDATE` + `INSERT ... WHERE NOT EXISTS` trong transaction với `UPDLOCK, SERIALIZABLE`, hoặc `MERGE ... WITH (HOLDLOCK)`.
- Phân trang sâu: keyset; đếm tổng: tránh đếm mỗi trang.
- Tính tăng dần: chỉ xử lý phần đã thay đổi. Dời job nặng ra ngoài giờ cao điểm, giảm tần suất về mức nghiệp vụ cần.

#### Kiểm chứng
- Số câu lệnh mỗi lần chạy job (Query Store, `execution_count`) giảm từ hàng nghìn về vài câu; logical reads và thời gian giảm.
- Trang sâu có reads gần bằng trang đầu.

#### Bẫy
- Chép mẫu keyset dạng `(a, b) > (@a, @b)` từ PostgreSQL: T-SQL báo lỗi cú pháp.
- `MERGE` không `HOLDLOCK` dưới tải đồng thời: lỗi trùng khoá hoặc chèn trùng.
- Chia lô bằng `OFFSET` hoặc `TOP` không theo khoá: mỗi lô sau quét lại phần đã xử lý.
- `WHILE` chia lô vẫn là set-based nếu mỗi vòng xử lý hàng nghìn dòng; RBAR là mỗi vòng một dòng.

#### Câu hỏi phỏng vấn
- **"Vì sao OFFSET 100000 FETCH 20 chậm dù có index?"** SQL vẫn đọc 100.020 dòng theo index rồi bỏ 100.000 dòng đầu. Keyset pagination seek thẳng tới vị trí sau khoá cuối của trang trước.
- **"Viết keyset pagination trong T-SQL thế nào khi sắp theo cột không duy nhất?"** Thêm cột duy nhất (Id) vào cuối `ORDER BY`, và viết điều kiện tách: `CreatedAt > @c OR (CreatedAt = @c AND Id > @id)`, vì T-SQL không hỗ trợ so sánh bộ giá trị. Index `(cột lọc bằng, CreatedAt)` với khoá clustered `Id` ở cuối để seek và không Sort.
- **"MERGE có an toàn khi nhiều phiên cùng upsert không?"** Không tự an toàn: hai phiên cùng không thấy dòng và cùng chèn. Thêm `WITH (HOLDLOCK)` trên bảng đích để giữ khoá dải. Nhiều đội tránh `MERGE` vì lịch sử lỗi, dùng `UPDATE` rồi `INSERT ... WHERE NOT EXISTS` với `UPDLOCK, SERIALIZABLE` trong một transaction.
- **"API phân trang cần trả tổng số dòng, làm sao để không chậm?"** Tránh đếm lại toàn tập mỗi trang. Chỉ đếm ở trang đầu và cache theo bộ lọc; hoặc trả "còn trang sau" bằng `TOP (n + 1)`; hoặc hiển thị số xấp xỉ. Với tổng cả bảng, đọc `sys.dm_db_partition_stats`.
- **"Cần cập nhật 10 triệu dòng trên bảng đang có người dùng, làm thế nào?"** Chia lô theo khoá clustered, mỗi lô vài nghìn dòng trong transaction ngắn, chỉ cập nhật dòng thực sự đổi. Tránh leo thang khoá (khoảng 5.000 khoá), tránh log phình và replica trễ; theo dõi blocking và có thể dừng, chạy tiếp từ khoá cuối.

#### Tóm tắt
- Một câu theo tập thay cho hàng nghìn câu từng dòng; cập nhật lớn chia lô theo khoá.
- Upsert cần khoá đúng (`HOLDLOCK` hoặc `UPDLOCK, SERIALIZABLE`).
- `OFFSET` trang sâu đọc rồi bỏ; keyset seek thẳng, viết điều kiện tách trong T-SQL.
- Đếm tổng và `ORDER BY` động đều làm mất lợi thế index.
- Báo cáo đọc bảng tổng hợp tính tăng dần.

#### Bài tập
1. Tạo `CREATE INDEX IX_Student_Created_Name ON dbo.Student (CreatedAt) INCLUDE (FullName);`. So logical reads của `ORDER BY CreatedAt, StudentId OFFSET 500000 ROWS FETCH NEXT 20 ROWS ONLY` và câu keyset tương đương (lấy `@lastCreated`, `@lastId` là dòng thứ 500.000).
   **Đáp án:** `OFFSET` đọc khoảng 500.020 dòng của index, cỡ vài nghìn trang; keyset đọc 3–4 trang. Thời gian chênh tương ứng. Lấy mốc bằng `SELECT CreatedAt, StudentId FROM dbo.Student ORDER BY CreatedAt, StudentId OFFSET 499999 ROWS FETCH NEXT 1 ROWS ONLY;`.
2. Đặt sai `ProvinceId` cho 100.000 học sinh đầu (`UPDATE dbo.Student SET ProvinceId = 0 WHERE StudentId <= 100000;`), rồi sửa lại bằng (A) cursor cập nhật từng dòng và (B) một câu `UPDATE ... JOIN`. So thời gian và lượng log.
   **Đáp án:** (A) chạy 100.000 câu `UPDATE`, mỗi câu một lần seek và một bản ghi log riêng, thường mất hàng chục giây; (B) một câu, vài giây hoặc nhanh hơn. Đo log bằng `sys.dm_tran_database_transactions` trong transaction, hoặc so `SET STATISTICS TIME`.
3. Viết upsert vào bảng `dbo.DailyScore (StudentId INT, Day DATE, Score INT, PRIMARY KEY (StudentId, Day))` từ `#src`, an toàn khi hai phiên chạy đồng thời. Kiểm tra bằng cách chạy cùng lúc ở hai cửa sổ với cùng dữ liệu.
   **Đáp án:** Dùng mẫu `UPDATE` + `INSERT ... WHERE NOT EXISTS` với `UPDLOCK, SERIALIZABLE` trong một transaction như trong bài. Phiên thứ hai chờ phiên đầu, sau đó chỉ `UPDATE`, không lỗi trùng khoá. Bỏ hint thì có thể gặp lỗi vi phạm PRIMARY KEY khi hai phiên cùng chèn.
