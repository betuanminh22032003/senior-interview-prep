# Tối ưu SQL Server: skill cần học

Rút ra từ báo cáo nội bộ "Phân tích hiệu năng API trên APM và giải pháp tối ưu hệ thống IOE" (6 cụm SQL Server, đợt rà soát lại 06/10/2026). Trang này không ghi IP, tên server, tên proc hay bảng thật; mỗi ví dụ ghi vị trí trong báo cáo (Cụm X – Mục Y) để tra lại.

Mỗi skill gồm: học gì, ví dụ trong báo cáo, cách sửa, cách kiểm chứng, bẫy cần tránh, câu tự hỏi. Skill có nhãn **Tương tác** có mô phỏng ngay trong thẻ.

**Thứ tự học:** T1 → T2 → T3 là phần lõi, đủ để tự xử lý phần lớn vấn đề trong báo cáo. Sau đó T4, T5. T6 dùng để luyện phản biện khi phỏng vấn.

**Tài liệu nên đọc:** Microsoft Learn: *Query processing architecture guide*, *Index architecture and design guide*, *Statistics*; Grant Fritchey, *SQL Server Execution Plans* (ebook miễn phí của Redgate); Itzik Ben-Gan, *T-SQL Querying*; blog Paul White, Erik Darling, Brent Ozar.

**Công cụ:** First Responder Kit (`sp_Blitz`, `sp_BlitzCache`, `sp_BlitzIndex`, `sp_BlitzFirst`), `sp_WhoIsActive`, Query Store, Plan Explorer, Ola Hallengren Maintenance Solution.

## T1. Đo trước khi sửa

Không sửa theo cảm giác. Tìm chỗ tốn nhất theo tổng tải (thời gian × số lần gọi), đọc nó đang chờ gì, rồi mới chọn cách sửa.

### S1. Đọc APM trace: N+1, gọi lặp, việc đồng bộ thừa

**Viz:** request-timeline

#### Học gì

- Đọc cây span trong APM (Elastic APM, OpenTelemetry): span SQL, span gRPC/HTTP, span cache. Thời gian request bằng tổng các span chạy tuần tự.
- Nhận dạng N+1: cùng một câu SQL lặp nhiều lần trong một request. Cùng tham số thì thiếu cache trong request; khác tham số theo từng dòng thì thiếu truy vấn theo lô.
- Phân biệt "SQL chậm" và "gọi SQL quá nhiều lần": 5 lần × 15 ms tệ ngang một câu 75 ms, và còn tốn thêm round-trip, kết nối.
- Việc không cần cho response (bắn event, ghi lịch sử) không nên nằm trên đường đi của request.

#### Trong báo cáo

- API cập nhật thông tin người dùng 504 ms (Vấn đề 3): proc lấy vị trí người dùng gọi 5 lần cho cùng một user (15 + 15 + 14 + 11 + 15 ms); proc kiểm tra điều kiện thi gọi 5 lần (~24 ms); vòng `foreach` theo 2 mã dịch vụ gọi DB 2 lần (65 + 67 ms); một proc lọc học sinh 94 ms khi trượt cache.
- Cũng trong API đó: mỗi lần bắn event tạo `GrpcChannel` mới, giữ luồng HTTP 9,2 ms dù đã viết `_ = ...`.
- Luồng lấy bảng xếp hạng: vòng lặp gọi tra cứu tỉnh, huyện cho từng dòng Top, thành 20–100 lượt gọi DB mỗi request (Cụm 4 – Mục 11).
- Một proc đọc thông tin rẻ (0,12 ms) nhưng chạy 112 triệu lần (Cụm 5 – Mục 4).

#### Cách sửa

- Nạp dữ liệu một lần ở đầu luồng, truyền object xuống các hàm con thay vì để mỗi hàm tự đọc lại DB.
- Gom vòng lặp thành một truy vấn theo tập (`WHERE code IN (...)` hoặc TVP).
- Danh mục ít đổi (tỉnh, huyện, trường): nhớ trong request, rồi cache Redis TTL dài.
- `GrpcChannel`, `HttpClient` dùng lại (singleton, `IHttpClientFactory`); event đẩy ra hàng đợi nền.

#### Kiểm chứng

- So số span và tổng thời gian trên APM trước và sau. Báo cáo ghi phần kiểm tra logic của API trên giảm từ 149–504 ms xuống dưới 60 ms sau khi bỏ gọi lặp.

#### Tự hỏi

- **"API A có một câu SQL 80 ms. API B gọi một câu 2 ms 40 lần. Sửa cái nào trước?"** Latency bằng nhau nhưng B tốn 40 round-trip, 40 lần mượn kết nối và chiếm CPU parse. Ưu tiên theo tổng tải: thời gian × số lần gọi mỗi giây của cả API. Với B, gom lô hoặc cache thường rẻ hơn tối ưu câu 80 ms của A.

### S2. DMV và Query Store: tìm truy vấn tốn nhất

#### Học gì

- `sys.dm_exec_procedure_stats` (theo proc) và `sys.dm_exec_query_stats` (theo **câu lệnh**: mỗi dòng là một statement trong plan). Các cột chính: `total_worker_time`, `total_logical_reads`, `total_spills`, `total_grant_kb`, `max_used_grant_kb`, `execution_count`.
- Xếp hạng theo tổng (trung bình × số lần gọi), không chỉ theo trung bình.
- Missing index DMV (`sys.dm_db_missing_index_details`, `_group_stats`): điểm ≈ `avg_total_user_cost × avg_user_impact × (seeks + scans)`. Là gợi ý, không phải lệnh.
- `sys.dm_db_index_usage_stats`: index nào có seek/scan, index nào chỉ bị update (index chết).
- Query Store: lịch sử plan theo `query_id` và `plan_id`, so sánh trước/sau, ép plan (force plan). Cấu hình `QUERY_CAPTURE_MODE`, `MAX_STORAGE_SIZE_MB`, `INTERVAL_LENGTH_MINUTES`.
- DMV mất số liệu khi restart hoặc khi plan bị đẩy khỏi cache. Ghi lại uptime và thời điểm đo.

#### Trong báo cáo

- Proc tin tức theo chuyên mục: chỉ 3.485 reads/lần nhưng 3,37 triệu lần, cộng dồn khoảng 11,7 tỷ reads (Cụm 2 – Mục 8).
- Proc thống kê hạng: 23 ms CPU/lần nhưng 9,1 triệu lần, 58,6 giờ CPU, điểm nóng CPU lớn nhất (Cụm 4 – Mục 7).
- Index đã tạo nhưng DMV vẫn đòi: tạo sai cột dẫn đầu, thiếu cột `INCLUDE`, thiếu cột năm báo cáo và 0 lượt dùng (Cụm 2 – Mục 10, Cụm 4 – Mục 12).

#### Cách sửa

- Có sẵn bộ truy vấn: top theo CPU, reads, spill, grant. Lưu ảnh chụp định kỳ vào bảng để so sánh qua các lần restart.
- Trước khi tạo index theo DMV: gộp các gợi ý trùng tiền tố và đối chiếu index đang có.
- Sau khi tạo: kiểm tra `index_usage_stats` có seek và DMV thôi đòi.

#### Kiểm chứng

- Proc giảm reads/CPU trong `dm_exec_procedure_stats` sau 24 giờ; gợi ý missing index tương ứng biến mất.

#### Bẫy

- Nhiều dòng trong `dm_exec_query_stats` cho cùng một proc thường là nhiều **câu lệnh** của cùng một plan, không phải nhiều plan. Báo cáo ghi "10 plan khác nhau" cho proc Top N xếp hạng, nhưng 3 dòng có cùng `execution_count` bằng đúng số lần gọi proc: dấu hiệu đó là các câu chạy mỗi lần gọi (Cụm 4 – Mục 8). Kiểm tra `plan_handle`, `statement_start_offset`, hoặc Query Store (nhiều `plan_id` cho cùng `query_id`) trước khi kết luận parameter sniffing.

#### Tự hỏi

- **"Vì sao không tạo ngay mọi index trong missing index DMV?"** DMV không biết index tương tự đã có, không tính chi phí ghi, bỏ qua thứ tự `ORDER BY`, xếp cột theo kiểu bằng rồi không bằng chứ không theo độ chọn lọc, và thường đề xuất nhiều index trùng nhau. Gộp lại, tính chi phí ghi, rồi thử bằng plan thật.

### S3. Wait stats: server đang chờ gì

**Viz:** waits

#### Học gì

- `sys.dm_os_wait_stats` cộng dồn từ lúc khởi động. Đo chênh lệch giữa hai lần chụp, và lọc bỏ wait nền (sleep, queue nền, XTP, Query Store nền).
- Nhóm wait: CPU (`SOS_SCHEDULER_YIELD`, `THREADPOOL`), song song (`CXPACKET`, `CXCONSUMER`, `CXSYNC_PORT`), bộ nhớ (`RESOURCE_SEMAPHORE`), I/O (`PAGEIOLATCH_*`, `WRITELOG`), latch trong bộ nhớ (`PAGELATCH_*`), khoá (`LCK_M_*`), client (`ASYNC_NETWORK_IO`), gọi ra ngoài (`MSQL_DQ`, `OLEDB`, `PREEMPTIVE_*`, `MSQL_XP`).
- Wait là triệu chứng. Từ wait lần ra truy vấn gây ra: `sp_WhoIsActive`, `sys.dm_exec_requests`, wait stats theo truy vấn trong Query Store.

#### Trong báo cáo

- Cụm log thi chính thức: `THREADPOOL` đứng đầu ở lần quét đầu (45,92%), `WRITELOG` 3 triệu giây (Cụm 3 – Mục 5, 10).
- Cụm kho dữ liệu: `CXSYNC_PORT` khoảng 61%, `RESOURCE_SEMAPHORE` tăng gần gấp đôi giữa hai lần quét (Cụm 4 – Mục 2, 13).
- Cụm core: `MSQL_DQ` + `OLEDB` chiếm 38,4% do gọi linked server (Cụm 2 – Mục 7).

#### Cách sửa

- Theo từng loại wait, xem mô phỏng.

#### Bẫy

- Không chữa `THREADPOOL` bằng cách tăng `max worker threads`: worker đang bận vì truy vấn chậm hoặc bị chặn, thêm thread chỉ thêm tải.
- Không đặt `MAXDOP = 1` cho cả server để hết `CXPACKET`. Nâng `cost threshold for parallelism` và sửa truy vấn lớn.
- Báo cáo coi `QDS_ASYNC_QUEUE` và `WAIT_XTP_HOST_WAIT` là điểm nghẽn ở cụm log tự luyện. Hai wait này thường nằm trong danh sách wait nền mà các script chuẩn (của Paul Randal, First Responder Kit) lọc bỏ. Cần kiểm chứng trước khi dồn công sửa.

#### Tự hỏi

- **"ASYNC_NETWORK_IO cao có phải mạng chậm?"** Thường không. SQL đã có dữ liệu và đang chờ client đọc. Hay gặp khi trả result set quá lớn, hoặc app xử lý từng dòng trong lúc vẫn giữ reader mở. Sửa ở app: phân trang, chọn đủ cột, đọc hết rồi mới xử lý.

### S4. Đọc Execution Plan

#### Học gì

- Plan ước lượng và plan thật. Đọc từ phải sang trái; độ dày mũi tên là số dòng.
- Toán tử cần biết: Index Seek/Scan, Clustered Index Scan, Table Scan (heap), Key Lookup/RID Lookup, Nested Loops/Hash Match/Merge Join, Sort, Top, Stream/Hash Aggregate, Table Spool/Eager Spool, Remote Query.
- So `Estimated Number of Rows` với `Actual Number of Rows`. Lệch hàng chục lần trở lên là gốc của join sai và memory grant sai.
- Cảnh báo trên toán tử: spill xuống tempdb, grant quá mức, `CONVERT_IMPLICIT`, missing index.
- `Cost %` là ước lượng của optimizer, không phải số đo. Đo bằng `SET STATISTICS IO, TIME ON` và plan thật.

#### Trong báo cáo

- Proc lấy danh mục trường: plan chỉ có một toán tử Clustered Index Scan vì không có index dẫn đầu bằng cột trạng thái (Cụm 2 – Mục 13).
- Proc lọc học sinh theo trường và khối: plan ước lượng 85 rồi 1 dòng, thực tế đọc 65.863 trang, lệch khoảng 775 lần (Cụm 5 – Mục 7).
- Job báo cáo tài khoản theo ngày: plan 294 toán tử, 83 Table Scan, đều quanh một bảng biến (Cụm 4 – Mục 14).
- Job sinh đề thi thử: toán tử tốn nhất là Remote Query qua linked server (Cụm 6 – Mục 7).

#### Cách sửa

- Dùng plan để chọn hướng: Scan vì thiếu index → S6; Scan vì cách viết điều kiện → S9; ước lượng lệch → S10, S11; Sort hoặc spill → S12; Remote Query → S20.

#### Kiểm chứng

- So plan và `STATISTICS IO` (logical reads) trước và sau, với cùng bộ tham số.

#### Tự hỏi

- **"Plan ghi Sort chiếm 80% cost. Có chắc Sort là chỗ chậm nhất?"** Không chắc, cost là ước lượng. Xem thời gian và I/O thật trên từng toán tử trong plan thật (có từ SQL Server 2016 SP1), cảnh báo spill, và số dòng thật.

## T2. Index

Phần lớn các con số lớn trong báo cáo (hàng chục nghìn đến hàng trăm triệu reads mỗi lần) đến từ thiếu index đúng, index sai thứ tự cột, hoặc quá nhiều index trên bảng ghi nhiều.

### S5. B-tree, heap, seek, scan, logical reads

**Viz:** seek-scan

#### Học gì

- Trang 8 KB. Logical reads là số trang đọc từ buffer pool, thước đo chính trong báo cáo.
- Heap (không có clustered index), clustered index (dữ liệu nằm ở tầng lá), nonclustered index (tầng lá chứa key và con trỏ về dòng: clustered key hoặc RID).
- Seek: đi từ gốc xuống lá rồi đọc một dải liên tục. Scan: đọc toàn bộ tầng lá.
- Key Lookup: seek trên index phụ rồi quay về clustered index lấy cột thiếu, mỗi dòng khoảng 3 trang. Khi số dòng khớp vượt điểm bùng phát (tipping point), optimizer chọn Scan.
- Covering index: index phụ chứa đủ cột cần (key + `INCLUDE`), không cần lookup.

#### Trong báo cáo

- Bảng thống kê học sinh lọc theo mã dịch vụ và trường, nhưng mọi index đều dẫn đầu bằng mã user → Index Scan 3.567 reads/lần; covering index mới kỳ vọng dưới 10 reads (Vấn đề 4).
- Bảng quản lý người dùng thiếu index dẫn đầu bằng `userId` → proc lấy vị trí 10,8 ms/lần, 25,4 triệu lần (Vấn đề 3).
- Heap lớn: bảng log thao tác 101 triệu dòng / 21 GB; bảng tổng hợp bài thi 94 triệu dòng không index, tìm theo user phải đọc khoảng 6,7 GB (Cụm 2 – Mục 6, Cụm 3 – Mục 2).

#### Cách sửa

- Index dẫn đầu bằng cột lọc; `INCLUDE` cột trả về để bỏ lookup. Heap lớn có truy vấn đọc: cân nhắc clustered index, tuỳ loại bảng (xem S7).

#### Kiểm chứng

- `SET STATISTICS IO ON` trước và sau; plan đổi Scan thành Seek.

#### Tự hỏi

- **"Có index trên cột lọc mà SQL vẫn Scan. Vì sao?"** (1) Điều kiện không SARGable; (2) số dòng khớp lớn, lookup đắt hơn scan; (3) ước lượng sai do statistics; (4) lệch kiểu dữ liệu gây implicit conversion; (5) index không dẫn đầu bằng cột đó.

### S6. Thiết kế composite và covering index theo truy vấn

**Viz:** index-order

#### Học gì

- Thứ tự cột key: cột so sánh bằng (`=`) trước, cột phạm vi (`>`, `<`, `BETWEEN`, `LIKE 'x%'`) sau. Cột `ORDER BY` đặt ngay sau các cột bằng thì bỏ được Sort.
- Chỉ seek được theo tiền tố bên trái của key.
- `INCLUDE` cho cột chỉ cần trả về, không đưa vào key.
- Index phụ tự mang theo các cột của clustered key.
- Filtered index (`WHERE status = 1`) cho tập con nhỏ được truy vấn nhiều.
- Với `TOP N ... ORDER BY`: index đã sắp đúng thứ tự cho phép đọc N dòng rồi dừng, không Sort, không cần memory grant.

#### Trong báo cáo

- Bảng xếp hạng vòng hiện tại: lọc theo năm, khối, tỉnh và `ORDER BY` hạng tỉnh, nhưng index có sẵn là (năm, tỉnh, huyện, trường): thiếu khối, không có cột hạng → đọc rộng rồi Sort. Đề xuất (năm, khối, tỉnh, hạng tỉnh) `INCLUDE (...)` (Cụm 4 – Mục 8).
- Bảng chi tiết đơn hàng: missing index điểm cao nhất hệ thống (204,9 triệu), 228 nghìn lượt tra cứu theo trường/địa bàn đang scan (Cụm 6 – Mục 4).
- Proc lớp của giáo viên: filtered index, 46.540 → dưới 10 reads (Cụm 5 – Mục 2).

#### Cách sửa

- Viết index từ truy vấn: cột trong `WHERE`, `JOIN`, `ORDER BY`, `SELECT`. Kiểm tra index đang có trước (`sp_BlitzIndex`).

#### Kiểm chứng

- Plan không còn Sort và Key Lookup; DMV thôi đòi; `index_usage_stats` có seek.

#### Bẫy

- Bảng xếp hạng được đề xuất 4 index cho 4 cấp hạng, mỗi cái `INCLUDE` khoảng 10 cột: mỗi lần job xếp hạng ghi lại bảng sẽ ghi gấp khoảng 5 lần. Chấp nhận được nếu bảng chỉ ghi theo lô ban đêm; không ổn nếu ghi liên tục.

#### Tự hỏi

- **"WHERE a = @a AND b > @b ORDER BY c. Chọn index nào?"** `(a, b)` seek hẹp nhưng vẫn phải Sort; `(a, c) INCLUDE (b)` bỏ Sort nhưng lọc b sau khi đọc. Có `TOP` nhỏ và b lọc ít thì chọn `(a, c)`; b lọc mạnh thì chọn `(a, b)`. Quyết định bằng số dòng thật, không bằng quy tắc.

### S7. Chi phí ghi: write amplification, page split, hotspot

**Viz:** write-cost

#### Học gì

- Mỗi `INSERT` ghi vào 1 + N cấu trúc (dữ liệu + N index phụ). `UPDATE` cột nằm trong index nào thì sửa index đó. Tất cả đều sinh transaction log.
- Page split: chèn vào giữa một trang đầy (khoá ngẫu nhiên như UserId, GUID). `FILLFACTOR` chừa chỗ trống để giảm split.
- Khoá tăng dần (IDENTITY, thời gian) không split nhưng mọi luồng chèn dồn vào trang cuối → `PAGELATCH_EX`. SQL Server 2019+ có `OPTIMIZE_FOR_SEQUENTIAL_KEY = ON`.
- Heap: chèn nhanh, nhưng `UPDATE` làm dòng dài ra sinh forwarded record, và đọc luôn phải scan.
- Phân loại bảng theo cách dùng: thuần ghi, ghi dồn rồi đọc tổng kết, đọc-ghi liên tục.

#### Trong báo cáo

- Bảng kết quả vòng có 7 index phụ, bảng thống kê vòng có 9: khoảng 19,2 triệu lượt ghi/ngày, mỗi lượt cập nhật toàn bộ index (Cụm 4 – Mục 5).
- Index trên `(LogId)` trùng tiền tố với clustered PK `(LogId, QuestId)`, thừa khoảng 400 MB (Cụm 1 – Mục 2).
- Bảng người dùng 120 triệu dòng có 13 index (Cụm 5 – Mục 8).
- Bảng log thao tác thi ghi 0,24–1,09 ms/lần; báo cáo cấm thêm index phụ trên DB chính và phân bảng thành 3 nhóm (Phần VI).

#### Cách sửa

- Xoá index trùng hoặc không dùng (seek = 0, update cao).
- Bảng log: clustered key tăng dần, không index phụ, tra cứu ở replica.
- Bảng ghi dồn theo ca thi: partition theo ca, đánh index sau khi ca kết thúc.

#### Kiểm chứng

- `sys.dm_db_index_operational_stats`: `leaf_allocation_count` (split), `page_latch_wait_count`; `WRITELOG`, `PAGELATCH_EX` giảm.

#### Bẫy

- Báo cáo đề xuất "thêm cột identity tuần tự" để chống tranh chấp chèn trên bảng log (Cụm 3 – Mục 10). Identity bỏ được page split nhưng chính nó tạo điểm nóng ở trang cuối. Đo `PAGELATCH_EX` sau khi đổi và bật `OPTIMIZE_FOR_SEQUENTIAL_KEY`. `FILLFACTOR` không giúp gì cho chèn vào cuối.

#### Tự hỏi

- **"Bảng log 5.000 insert/giây, CMS cần tra theo UserId. Làm sao?"** DB chính giữ đường ghi nhanh (clustered tăng dần, không index phụ); tra cứu ở replica hoặc kho dữ liệu có index theo UserId. Hoặc partition theo ngày, chỉ đánh index các partition đã đóng.

### S8. Tạo và bảo trì index an toàn trên production

#### Học gì

- `ONLINE = ON` chỉ có ở Enterprise (và Developer, Azure SQL). Standard Edition tạo index sẽ khoá bảng suốt thời gian tạo. Kiểm tra `SERVERPROPERTY('Edition')`.
- `SORT_IN_TEMPDB`, `MAXDOP`, `RESUMABLE = ON` (Enterprise, 2017+), `DATA_COMPRESSION`.
- Bảo trì định kỳ: rebuild/reorganize theo mức phân mảnh và mức dùng, update statistics. Ola Hallengren là chuẩn phổ biến.
- `ALTER PROCEDURE` nhanh, nhưng xoá plan cũ: lần gọi sau phải compile lại.
- Luôn có script rollback (`DROP INDEX`) và đo lại sau khi tạo.

#### Trong báo cáo

- Hai cụm chạy Standard Edition: báo cáo cảnh báo tạo index trên bảng triệu dòng sẽ khoá bảng, chỉ làm trong khung 23h–05h (Phần V).
- Bảng archive đã hết ca thi là bảng tĩnh, tạo index gần như không ảnh hưởng ghi (Cụm 3 – Mục 9).

#### Cách sửa

- Checklist trước khi tạo index: edition, kích thước bảng, đủ chỗ cho log và tempdb, khung giờ, script rollback, số đo trước và sau.

#### Bẫy

- Một số script trong báo cáo có `WITH (ONLINE = ON)`. Trên Standard Edition câu này báo lỗi. Kiểm tra edition từng cụm trước khi chạy.

#### Tự hỏi

- **"Tạo index trên bảng 120 triệu dòng, Standard Edition, giữa ca thi thì sao?"** Bảng bị khoá tới khi tạo xong. Truy vấn vào bảng chờ khoá, worker bị chiếm hết, `THREADPOOL`, API timeout dây chuyền. Chỉ làm trong khung bảo trì hoặc trên replica.

## T3. Viết truy vấn để Optimizer hiểu

Index đúng mà truy vấn viết sai thì vẫn scan. Ước lượng sai thì vẫn chọn plan sai.

### S9. Điều kiện SARGable

**Viz:** sargable

#### Học gì

- SARGable: điều kiện dạng `cột <phép so sánh> biểu thức` để optimizer dùng index seek được.
- Các kiểu phá SARG: hàm bao cột (`CONVERT(NVARCHAR, col)`, `YEAR(col)`, `ISNULL(col, 0)`), `CASE` bao cột, `LIKE '%x%'`, lệch kiểu dữ liệu (implicit conversion).
- Truy vấn "catch-all" `(@p = 0 OR col = @p)`: plan dùng lại phải đúng cho mọi giá trị nên thường scan. Cách xử lý: `OPTION (RECOMPILE)`, tách nhánh `IF/ELSE`, hoặc dynamic SQL có tham số (`sp_executesql`) chỉ thêm điều kiện cần.
- `LIKE '%x%'`: B-tree không giúp. Cách xử lý: full-text search, tách chuỗi danh sách thành bảng con, hoặc chỉ cho phép trên tập đã lọc nhỏ.

#### Trong báo cáo

- Proc lọc học sinh theo tỉnh/huyện/trường: `AND 1 = (CASE WHEN @school > 0 ...)` (Vấn đề 4).
- Proc tìm kiếm giải thưởng tháng: `CASE` + `CONVERT(NVARCHAR, user_id)` + `LIKE '%...%'`, scan dù có index trên user_id (Cụm 4 – Mục 9).
- Proc báo cáo đăng ký: `list_service_code LIKE '%IOK%'` trên bảng 120 triệu dòng, 151.930 reads/lần (Cụm 5 – Mục 3).
- Proc câu sai theo vòng: `CASE WHEN block = @block ...`, 75.133 trang/lần (Cụm 1 – Mục 2).

#### Cách sửa

- Viết lại điều kiện, xem các mẫu trong mô phỏng.

#### Kiểm chứng

- Plan đổi Scan thành Seek; cột xuất hiện trong `Seek Predicates` chứ không chỉ trong `Predicate`.

#### Tự hỏi

- **"`WHERE CAST(create_date AS date) = @d` có seek được không?"** Trường hợp đặc biệt: ép `datetime` sang `date` vẫn có thể seek nhờ dải động, nhưng ước lượng kém. Viết `create_date >= @d AND create_date < DATEADD(day, 1, @d)` rõ ràng và ổn định hơn.

### S10. Statistics và ước lượng số dòng

**Viz:** cardinality

#### Học gì

- Statistics gồm histogram (tối đa 200 bước) và density của cột/index. Optimizer dùng nó để ước lượng số dòng, từ đó chọn kiểu join, thứ tự join, memory grant.
- Ngưỡng tự cập nhật: compatibility level dưới 130 là 500 + 20% số dòng; từ 130 (SQL Server 2016) là `MIN(500 + 0,2·n, √(1000·n))`, bảng 100 triệu dòng chỉ cần khoảng 316 nghìn thay đổi. Tự cập nhật chỉ chạy khi có truy vấn compile cần statistics đó.
- Khoá tăng dần (thời gian, Id): dữ liệu mới nằm ngoài histogram nên bị ước lượng thấp, đúng vùng đang được truy vấn nhiều nhất.
- `UPDATE STATISTICS ... WITH FULLSCAN` và lấy mẫu; `sys.dm_db_stats_properties` (`modification_counter`, `last_updated`).

#### Trong báo cáo

- 35 statistics thay đổi trên 100% kể từ lần cập nhật cuối; cá biệt 1.001.794% ở một bảng 75 nghìn dòng; bảng log thi thử 23.127% (Cụm 1 – Mục 4, Cụm 3 – Mục 7).
- Báo cáo kết luận optimizer chọn sai Nested Loops/Hash Join; đề xuất `UPDATE STATISTICS ... FULLSCAN` ban đêm và job hằng tuần.

#### Cách sửa

- Job cập nhật statistics theo `modification_counter` (Ola Hallengren `@OnlyModifiedStatistics`). Bảng log tăng nhanh cập nhật dày hơn. Không chạy `FULLSCAN` trong giờ cao điểm.

#### Kiểm chứng

- Trong plan thật, số dòng ước lượng gần số dòng thật; `modification_counter` thấp.

#### Bẫy

- Báo cáo nói ngưỡng 20% "không bao giờ đạt được" trên bảng lớn. Chỉ đúng khi DB ở compatibility level dưới 130 hoặc tắt auto update. Kiểm tra `compatibility_level` và `is_auto_update_stats_on` trước. Mức thay đổi hàng triệu phần trăm trên bảng nhỏ thường là bảng bị xoá rồi nạp lại nhiều lần: cần cập nhật statistics ngay sau mỗi lần nạp.

#### Tự hỏi

- **"Ước lượng 1 dòng, thực tế 500.000 dòng. Plan bị gì?"** Optimizer chọn Nested Loops (500.000 lần seek bên trong), cấp memory grant quá nhỏ nên Sort/Hash spill xuống tempdb, và có thể chọn sai thứ tự join. Chậm hàng trăm lần.

### S11. Parameter sniffing và độ ổn định của plan

#### Học gì

- Proc được compile theo giá trị tham số của lần gọi đầu; plan đó dùng lại cho mọi giá trị sau. Tốt khi dữ liệu phân bố đều, tệ khi lệch (một trường 20 học sinh so với một tỉnh 200.000).
- Nhận biết: cùng proc lúc nhanh lúc chậm; trong plan XML `ParameterCompiledValue` khác `ParameterRuntimeValue`.
- Các cách xử lý và cái giá: `OPTION (RECOMPILE)` (đúng nhất, tốn CPU compile mỗi lần), `OPTIMIZE FOR`, tách proc con theo nhánh, dynamic SQL, ép plan bằng Query Store, PSP optimization (SQL Server 2022, nhiều plan theo dải giá trị).
- Gán tham số vào biến cục bộ làm optimizer dùng density trung bình (giống `OPTIMIZE FOR UNKNOWN`).

#### Trong báo cáo

- Proc lọc học sinh theo trường và khối chậm lại từ dưới 2 ms lên 669 ms, 65.863 reads/lần: plan compile cho bộ tham số nhỏ (Cụm 5 – Mục 7).
- Proc tìm kiếm giải thưởng tháng: CPU chênh 193 lần giữa các dòng thống kê (Cụm 4 – Mục 9).
- Đề xuất chung của báo cáo: thêm `OPTION (RECOMPILE)`.

#### Cách sửa

- Chọn theo tần suất gọi: proc gọi ít, tải nặng → `RECOMPILE`. Proc gọi hàng triệu lần → sửa gốc (index bỏ Sort, tách nhánh, cache ở app).

#### Kiểm chứng

- Query Store: mỗi `query_id` chỉ còn plan tốt; tổng CPU (gồm cả compile) giảm.

#### Bẫy

- Proc thống kê hạng chạy 9,1 triệu lần. Thêm `RECOMPILE` nghĩa là compile 9,1 triệu lần, mỗi lần có thể tốn vài ms CPU với proc nhiều câu. Đo CPU compile trước khi áp dụng; ưu tiên index và cache Top N (báo cáo cũng đề xuất cache).

#### Tự hỏi

- **"Khi nào không nên dùng OPTION (RECOMPILE)?"** Khi câu chạy rất thường xuyên và rẻ: chi phí compile vượt lợi ích. Khi proc phức tạp, compile lâu. Lúc đó dùng index để plan ổn định, tách nhánh, hoặc ép plan bằng Query Store.

### S12. Memory grant, Sort, Hash và spill

#### Học gì

- Sort và Hash Match cần bộ nhớ (memory grant), tính trước khi chạy từ số dòng ước lượng × độ rộng dòng.
- Grant thiếu → spill xuống tempdb. Grant thừa → giữ RAM vô ích, truy vấn khác xếp hàng chờ `RESOURCE_SEMAPHORE`.
- Sort phải đọc hết input trước khi trả dòng đầu, kể cả khi chỉ lấy `TOP 20`.
- Bỏ grant: index đã sắp đúng thứ tự (bỏ Sort), bỏ cột rộng không cần (`nvarchar(max)`), sửa ước lượng.
- Memory grant feedback (SQL Server 2019+ cho row mode) tự chỉnh grant qua các lần chạy.
- `sys.dm_exec_query_memory_grants`; `total_grant_kb`, `max_used_grant_kb`, `total_spills` trong `dm_exec_query_stats`.

#### Trong báo cáo

- Proc tìm kiếm giải thưởng tháng: cấp tối đa 7.147 MB, dùng 1,18 MB, trên bảng chỉ 56.170 dòng; spill 486.114 trang (Cụm 4 – Mục 9).
- Proc Top N xếp hạng: trung bình khoảng 313 MB mỗi lần, dùng 1,5 MB (Cụm 4 – Mục 8).
- Công cụ giám sát xin 60,76 GB grant cho một lần chạy (Cụm 3 – Mục 10, 11).

#### Cách sửa

- Index phục vụ `ORDER BY`; bỏ sort hai lần; sửa ước lượng (statistics, `#temp`, `RECOMPILE`). Giới hạn bằng Resource Governor (`REQUEST_MAX_MEMORY_GRANT_PERCENT`) cho nhóm báo cáo và giám sát, hoặc hint `MAX_GRANT_PERCENT` cho từng câu.

#### Kiểm chứng

- `max_used_grant_kb` gần `grant_kb`; spill bằng 0; `RESOURCE_SEMAPHORE` giảm. Mô phỏng grant và spill nằm ở S10.

#### Tự hỏi

- **"Grant thừa 99% thì hại gì nếu query vẫn nhanh?"** RAM bị giữ suốt lúc chạy. Nhiều phiên chạy cùng lúc thì tổng grant vượt quỹ, các truy vấn khác, kể cả truy vấn nhỏ, phải chờ `RESOURCE_SEMAPHORE`. Buffer pool cũng bị thu hẹp nên đọc đĩa nhiều hơn.

### S13. Bảng biến, bảng tạm, TVP, JSON và XML

#### Học gì

- Bảng biến (`@t`): không có statistics theo cột. Trước SQL Server 2019 luôn ước lượng 1 dòng. Từ 2019 với compatibility level 150 có deferred compilation, ước lượng đúng tổng số dòng ở lần compile đầu, nhưng vẫn không có histogram nên điều kiện lọc và join vẫn đoán.
- Bảng tạm (`#t`): có statistics, tạo được PK và index; có thể gây recompile khi số dòng đổi nhiều. Tạo và huỷ liên tục gây tranh chấp metadata tempdb.
- TVP: truyền danh sách từ app vào proc thay cho chuỗi CSV hay JSON. Về ước lượng, TVP giống bảng biến.
- `STRING_SPLIT`, `FOR JSON`, `OPENJSON`, `FOR XML PATH`: tốn CPU, ước lượng kém. Không dùng để chuyển dữ liệu giữa các proc trong cùng DB.

#### Trong báo cáo

- Nhóm proc sinh đề: 3.653.268 spill ở proc kiểm tra đề, 10.360.549 spill ở proc tìm câu hỏi CMS, đều dựng trên bảng biến (Cụm 6 – Mục 5).
- Proc tạo kết quả vòng theo lô: Eager Spool trên bảng biến, 9.619 spill (Cụm 4 – Mục 5).
- Proc lọc học sinh: gom ID thành JSON (`FOR JSON AUTO`) truyền sang proc con để parse lại (Vấn đề 4).
- Proc gói cước: `STRING_SPLIT` + `XML PATH`, 4,95 triệu lần; báo cáo đề xuất cache Redis 60 phút (Cụm 2 – Mục 3).
- 63,6 triệu lượt tạo bảng tạm trong metadata tempdb (Cụm 3 – Mục 10).

#### Cách sửa

- `#temp` + PRIMARY KEY khi tập trung gian lớn hoặc dùng để join, sắp xếp. Giữ bảng biến cho tập vài chục dòng.
- Danh sách lưu thành chuỗi trong một cột: chuẩn hoá thành bảng con có index.

#### Kiểm chứng

- Spill bằng 0; plan hết Table Scan trên bảng biến; Eager Spool biến mất.

#### Tự hỏi

- **"SQL Server 2019 đã sửa ước lượng bảng biến, còn cần đổi sang #temp không?"** Deferred compilation chỉ sửa tổng số dòng, không có phân bố giá trị theo cột, nên lọc và join trên bảng biến vẫn ước lượng theo đoán. Kiểm tra compatibility level (150+) và plan thật; tập lớn dùng để join thì vẫn nên `#temp` + PK.

### S14. Set-based, phân trang, đếm và sắp xếp

#### Học gì

- RBAR (xử lý từng dòng): cursor, `WHILE`, hoặc plan Nested Loops seek từng dòng để cập nhật → đổi thành một câu `UPDATE ... FROM ... JOIN`.
- Xoá rồi chèn lại → `MERGE` hoặc `UPDATE` + `INSERT ... WHERE NOT EXISTS`. `MERGE` cần `HOLDLOCK` nếu có ghi đồng thời.
- `OFFSET/FETCH` đọc rồi bỏ N dòng đầu, trang càng sâu càng chậm. Keyset pagination (`WHERE (sort_key, id) > (@last_key, @last_id)`) ổn định hơn.
- `COUNT(*)` tổng số dòng chạy riêng là quét thêm một lần.
- `ORDER BY CASE @p ...` động làm mất khả năng dùng index để bỏ Sort. Tách nhánh.
- Bảng tổng hợp cập nhật theo lô, thay cho `GROUP BY` toàn bảng mỗi lần mở báo cáo.

#### Trong báo cáo

- Proc phân xã và gộp trường cập nhật từng dòng → gộp thành một `UPDATE JOIN` (Cụm 2 – Mục 13, Cụm 5 – Mục 10).
- Proc tìm kiếm giải thưởng tháng: sắp xếp hai lần, `COUNT` riêng, `EXISTS` từng dòng trên bảng biến một cột (Cụm 4 – Mục 9).
- Job báo cáo giao dịch theo ngày: Delete + Insert riêng → `MERGE`; báo cáo doanh thu `GROUP BY` toàn bảng giao dịch → bảng tổng hợp (Cụm 4 – Mục 14).
- Job xếp hạng tháng chạy 864 lần/ngày, mỗi lần tính lại toàn bộ (Cụm 4 – Mục 6).

#### Cách sửa

- Tính tăng dần: chỉ xử lý phần đã thay đổi. Dời job nặng ra ngoài giờ cao điểm.

#### Tự hỏi

- **"Vì sao OFFSET 100000 FETCH 20 chậm dù có index?"** SQL vẫn đọc 100.020 dòng theo index rồi bỏ 100.000 dòng đầu. Keyset pagination seek thẳng tới vị trí sau khoá cuối của trang trước.

## T4. Server và vận hành

Cấu hình mặc định lúc cài và việc vận hành bỏ ngỏ (log, tempdb, bảng backup) gây ra nhiều cảnh báo đỏ nhất trong báo cáo.

### S15. Cấu hình instance

#### Học gì

- `max server memory`: chừa RAM cho hệ điều hành (thường 10–20%, tối thiểu vài GB). Mặc định 2.147.483.647 MB nghĩa là không giới hạn.
- `cost threshold for parallelism` (mặc định 5, quá thấp với phần cứng hiện nay) và `max degree of parallelism` (theo số core và NUMA, thường không quá 8).
- `optimize for ad hoc workloads`: chỉ lưu bản rút gọn cho plan dùng một lần.
- `backup compression default`.
- Cài Cumulative Update; Instant File Initialization; Lock Pages in Memory.
- Kiểm tra nhanh bằng `sp_Blitz`.

#### Trong báo cáo

- Cụm log tự luyện: không giới hạn bộ nhớ trên máy 32 GB, `cost threshold` = 5, ad hoc = 0, nén backup = 0, SQL Server 2019 RTM chưa cài CU; `CXCONSUMER` 460 triệu lượt chờ (Cụm 1 – Mục 9).
- Cụm log thi chính thức: SQL dùng khoảng 96% RAM máy 64 GB (Cụm 3 – Mục 11).

#### Cách sửa

- Các lệnh `sp_configure` trên chạy online không cần restart; cài CU trong khung bảo trì. Đo wait stats trước và sau.

#### Bẫy

- `cost threshold` từ 5 lên 50 là điểm khởi đầu, không phải con số đúng cho mọi hệ thống. Xem phân bố cost của các plan trong cache rồi chỉnh.

#### Tự hỏi

- **"Vì sao không để SQL Server dùng toàn bộ RAM?"** Hệ điều hành, dịch vụ khác, thread stack, linked server provider dùng RAM ngoài buffer pool. Khi OS thiếu RAM sẽ ép SQL trả bộ nhớ, hiệu năng dao động, có thể phân trang ra đĩa.

### S16. TempDB và transaction log

#### Học gì

- TempDB chứa `#temp`, bảng biến, spill, version store (RCSI, snapshot), sort khi tạo index. Đặt trên ổ riêng nhanh, không đặt ở ổ C:. Số file data bằng số core, tối đa 8 lúc đầu, cùng kích thước.
- Transaction log ghi tuần tự; `WRITELOG` là chờ ghi log khi commit.
- Recovery model FULL bắt buộc có job `BACKUP LOG` định kỳ, nếu không log không bao giờ được tái sử dụng (`log_reuse_wait_desc = LOG_BACKUP`).
- `log_reuse_wait_desc`: `LOG_BACKUP`, `ACTIVE_TRANSACTION`, `REPLICATION`, `AVAILABILITY_REPLICA`...
- SIMPLE và FULL: SIMPLE mất khả năng khôi phục tới một thời điểm. DB nghiệp vụ có tiền, giao dịch cần FULL + backup log; DB log, warehouse có thể SIMPLE.
- VLF: tăng log từng bước nhỏ sinh hàng nghìn VLF, backup và recovery chậm. Đặt `FILEGROWTH` cố định.
- Shrink log chỉ sau khi đã sửa nguyên nhân. Không shrink file data định kỳ (gây phân mảnh).

#### Trong báo cáo

- Một DB log 53,3 GB đầy 99,97%, kẹt `LOG_BACKUP`; `WRITELOG` 3,58 triệu giây trên cả cụm (Cụm 1 – Mục 1).
- DB kho câu hỏi log đầy 99,12%; ổ D: còn 9,16% (Cụm 6 – Mục 1, 6).
- TempDB 57,5 GB nằm trên ổ C: còn 9,59% trống (Cụm 3 – Mục 1).
- DB warehouse ở SIMPLE nhưng kẹt `ACTIVE_TRANSACTION` (Cụm 4 – Mục 15).

#### Cách sửa

- Chọn recovery model theo RPO của từng DB. DB ở FULL có job backup log 5–15 phút. Cảnh báo theo % log đã dùng và dung lượng ổ.

#### Bẫy

- Báo cáo đề xuất chuyển SIMPLE hàng loạt, kể cả ở cụm có DB giao dịch thanh toán (Cụm 6). Trước khi chuyển phải hỏi RPO: SIMPLE nghĩa là sự cố sẽ mất dữ liệu từ lần backup full/diff gần nhất. Nếu cần khôi phục theo thời điểm, giữ FULL và thêm job backup log.

#### Tự hỏi

- **"Log đầy 99% dù DB nhỏ. Kiểm tra gì đầu tiên?"** `SELECT name, recovery_model_desc, log_reuse_wait_desc FROM sys.databases` để biết vì sao log không được tái sử dụng: thiếu backup log, transaction mở lâu, replication chưa đọc log, replica AG chậm.

### S17. Vòng đời dữ liệu: archive, partition, dọn rác

#### Học gì

- Bảng nóng nên nhỏ. Dữ liệu cũ chuyển sang archive hoặc kho lạnh. Partition theo thời gian để `SWITCH` hoặc `TRUNCATE ... WITH (PARTITIONS ...)` thay cho `DELETE` hàng triệu dòng.
- Xoá theo lô (`DELETE TOP (N)` trong vòng lặp) để log không phình và không khoá lâu.
- Sao lưu bảng bằng `SELECT * INTO` tạo heap không index và tồn mãi. Dùng backup DB, BCP hoặc BACPAC, có quy ước tên và hạn xoá.
- Retention cho bảng log lỗi, log ứng dụng: job dọn hằng tuần.
- DB để OFFLINE vẫn chiếm đĩa.

#### Trong báo cáo

- Bảng feed 580 triệu dòng (54 GB), bảng cấu hình feed 1 tỷ dòng; proc tìm feed 509.798 reads/lần → archive dữ liệu cũ hơn 1 năm (Cụm 2 – Mục 2).
- Hơn 300 triệu dòng bảng backup ở cụm người dùng, và vẫn đang sinh bản mới (Cụm 5 – Mục 9).
- Bảng log lỗi 9–19 triệu dòng tích tụ từ 2021 (Cụm 3 – Mục 3, Cụm 5 – Mục 5).
- 10 DB OFFLINE chiếm 22,1 GB (Cụm 5 – Mục 6).

#### Cách sửa

- Chính sách giữ dữ liệu theo từng bảng; partition theo ca thi hoặc ngày cho bảng log; tắt tiến trình tự tạo bảng backup.

#### Tự hỏi

- **"Xoá 100 triệu dòng log cũ trên production thế nào?"** Không `DELETE` một lần (log phình, khoá leo thang). Có partition thì `SWITCH` ra bảng rỗng rồi `TRUNCATE`. Không có thì `DELETE TOP (5000–50000)` theo clustered key trong vòng lặp, có nghỉ, ngoài giờ cao điểm. Hoặc chép phần cần giữ sang bảng mới rồi đổi tên.

## T5. Tầng ứng dụng và kiến trúc

Nhiều vấn đề DB nằm ở cách app gọi DB: gọi quá nhiều, giữ kết nối quá lâu, gọi server khác trong transaction, đọc báo cáo chung server với luồng ghi.

### S18. Cache ở tầng ứng dụng

#### Học gì

- Ba lớp: nhớ trong một request, cache trong bộ nhớ một instance, Redis dùng chung.
- Cache-aside: đọc cache → trượt → đọc DB → ghi cache có TTL; xoá cache theo sự kiện khi dữ liệu đổi.
- Chọn TTL theo tần suất dữ liệu đổi; nạp sẵn (warmup) trước sự kiện lớn.
- Cache stampede: nhiều request cùng trượt và cùng gọi DB. Chống bằng single-flight/khoá, TTL lệch ngẫu nhiên, làm mới nền.
- Phân biệt "không có dữ liệu" với "lỗi" trước khi cache kết quả rỗng.

#### Trong báo cáo

- Proc thống kê hạng 9,1 triệu lần, proc hạng theo user 15,4 triệu lần, cho bảng hạng chỉ đổi khi job xếp hạng chạy → TTL 60–300 giây và ghi lại cache sau khi job chạy xong (Cụm 4 – Mục 11).
- Danh mục trường 7.623 lần/ngày, gần như không đổi → Redis TTL 24 giờ (Cụm 2 – Mục 13).
- Proc lấy đề theo mã đề 640.430 lần/ngày, đề không đổi trong ca thi → cache theo mã đề (Cụm 6 – Mục 5).
- API tự luyện trượt cache phải gọi DB 3 lần (Vấn đề 2).

#### Kiểm chứng

- Tỉ lệ cache hit; số lần gọi proc mỗi ngày giảm.

#### Tự hỏi

- **"Cache bảng xếp hạng TTL 5 phút, job xếp hạng xong lúc 10:00. Người dùng thấy hạng cũ tới 10:05 có được không?"** Hỏi nghiệp vụ. Nếu không được: job xong thì ghi đè cache hoặc xoá key theo sự kiện; TTL chỉ là lưới an toàn.

### S19. Connection pool và Little's law

**Viz:** pool

#### Học gì

- Little's law: số kết nối đang dùng = số request mỗi giây × thời gian giữ kết nối. Query nhanh hơn thì cần ít kết nối hơn.
- ADO.NET pool tách theo connection string, `Max Pool Size` mặc định 100. Hết pool thì request chờ tới `Connect Timeout` rồi báo lỗi.
- Tăng pool khi query còn chậm chỉ đẩy thêm việc vào DB: nhiều worker bị chiếm hơn, dẫn tới `THREADPOOL`.
- Giữ kết nối ngắn: mở muộn, đóng sớm, không giữ kết nối trong lúc gọi HTTP/gRPC khác.
- Kết nối ra ngoài cũng phải dùng lại: `HttpClient` qua `IHttpClientFactory`, `GrpcChannel` singleton. Mở TLS mới mỗi lần tốn CPU.

#### Trong báo cáo

- Phần IV: query 2 giây + pool 200 → 200 kết nối dồn vào SQL; query 2 ms → một kết nối phục vụ 500 request/giây, pool 50 đủ cho 25.000 request/giây. Kết luận: giữ nguyên pool, sửa query trước.
- `GrpcChannel` tạo mới mỗi request (Vấn đề 3); lỗi `Sockets.Connect failure` trong trace (Vấn đề 1).
- `PREEMPTIVE_OS_CRYPTOPS` 1,09 tỷ lượt: kết nối TLS bị mở lại liên tục (Cụm 2 – Mục 12).

#### Tự hỏi

- **"2.000 request/giây, mỗi request giữ kết nối 30 ms. Pool tối thiểu bao nhiêu?"** 2.000 × 0,03 = 60 kết nối đồng thời trung bình. Chia cho số instance app, cộng dư cho lúc đỉnh. Nếu đang cần nhiều hơn thế, giảm 30 ms trước khi tăng pool.

### S20. Không gọi server khác trong transaction

#### Học gì

- Linked server trong transaction thành distributed transaction (MSDTC). Khoá giữ tới khi server kia trả lời; wait `MSQL_DQ`, `OLEDB`.
- Remote Query trong plan ước lượng kém, có thể kéo cả bảng về.
- Outbox pattern: trong cùng transaction local ghi thêm một dòng vào bảng outbox; worker đọc outbox và gửi sang hệ khác, có idempotency.
- Kéo dữ liệu remote vào `#temp` có PK trước, rồi mới join.
- Transaction ngắn: không gọi HTTP, gRPC, linked server, hay chờ người dùng bên trong transaction.

#### Trong báo cáo

- Proc cập nhật vật phẩm người dùng (220,6 triệu lần, tối đa 29.997 ms): trong `BEGIN TRAN` gọi proc ghi lịch sử ở server giao dịch qua linked server, kèm khoá `UPDLOCK`; server kia chậm thì transaction treo (Cụm 2 – Mục 1).
- `MSQL_DQ` 21,51% + `OLEDB` 16,88% = 38,4% thời gian chờ của cụm core (Cụm 2 – Mục 7).
- Job sinh đề thi thử: Remote Query, 176,5 triệu trang/lần (Cụm 6 – Mục 7).

#### Tự hỏi

- **"Tách lệnh ghi lịch sử ra khỏi transaction thì mất nhất quán?"** Dùng outbox: dòng lịch sử ghi vào bảng outbox local trong cùng transaction nên vẫn nhất quán; worker gửi sang server kia sau, idempotent theo khoá. Chấp nhận nhất quán trễ vài giây.

### S21. Tách đọc và ghi

#### Học gì

- Phân loại bảng theo cách truy cập (báo cáo chia 3 nhóm: thuần ghi; ghi dồn rồi đọc tổng kết; đọc-ghi trên đường nóng).
- Các lựa chọn: transactional replication (index ở subscriber độc lập với publisher), Always On readable secondary (Enterprise, index giống hệt primary), log shipping standby, CDC sang kho dữ liệu.
- Điều hướng đọc (`ApplicationIntent=ReadOnly`), độ trễ đồng bộ, chấp nhận dữ liệu cũ vài giây.
- RCSI (Read Committed Snapshot) để đọc không chặn ghi trên primary, đổi lại tốn version store trong tempdb.
- Partition theo ca thi.

#### Trong báo cáo

- Phần VI: primary giữ bảng log không index phụ để insert dưới 0,5 ms; replica ở cụm kho dữ liệu có index cho CMS, báo cáo, tra cứu khiếu nại.
- `THREADPOOL` ở cụm log thi chính thức vì truy vấn báo cáo chạy chung server với luồng thi (Cụm 3 – Mục 5).

#### Bẫy

- Transactional replication yêu cầu bảng được publish có primary key. Báo cáo khuyên giữ heap trên primary rồi publish: phải thêm PK (vd clustered identity) trước.

#### Tự hỏi

- **"Readable secondary của Always On khác transactional replication thế nào cho bài toán này?"** Secondary là bản sao vật lý: index giống hệt primary, không tạo được index riêng. Replication là bản sao logic: subscriber có index và schema riêng, hợp khi primary muốn ít index còn báo cáo cần nhiều index.

### S22. Xử lý lỗi và giám sát không làm hại DB

#### Học gì

- Không nuốt exception (`catch { return null; }` trong C#, `BEGIN CATCH` không `THROW` trong T-SQL). Phân biệt "rỗng" với "lỗi".
- Kiểu dữ liệu khớp giữa C# và SQL (`long` ↔ `BIGINT`): tránh tràn số và implicit conversion.
- Công cụ giám sát cũng là tải: chu kỳ poll, câu DMV nặng, gọi `xp_*`.
- Cảnh báo theo SLO: tỉ lệ lỗi, p95/p99, % log đã dùng, dung lượng ổ, wait bất thường.

#### Trong báo cáo

- Hai lớp proxy C# bắt exception rồi trả null hoặc danh sách rỗng; bảng log lỗi không ghi nhận gì (Cụm 4 – Mục 11).
- Tham số user kiểu `INT` trong proc nhưng `long` trong entity; cột hạng `int` trong DB nhưng `string` trong entity (Cụm 4 – Mục 11).
- Công cụ giám sát: `MSQL_XP` 658.519 giây, `RESOURCE_SEMAPHORE_MUTEX` 33.739 giây; báo cáo coi chỉnh lại công cụ giám sát là việc có tác động lớn nhất ở cụm này (Cụm 3 – Mục 10).

#### Tự hỏi

- **"API xếp hạng trả danh sách rỗng trong giờ thi, log không có lỗi. Điều tra từ đâu?"** Nghi exception bị nuốt: tìm `catch` trả rỗng ở proxy và `BEGIN CATCH` trong proc. Đo tỉ lệ response rỗng theo thời gian. Kiểm tra timeout, deadlock trong `system_health`.

## T6. Đọc báo cáo bằng con mắt senior

Báo cáo này làm tốt việc gắn mỗi đề xuất với số đo và tiêu chí nghiệm thu ("spill phải về 0", "reads dưới 20.000 trang/lần"). Khi phỏng vấn, ngoài việc kể đã sửa gì, cần chỉ ra được chỗ một kết luận có thể sai và cách kiểm chứng:

- Nhiều dòng trong `dm_exec_query_stats` là nhiều câu lệnh, chưa chắc là nhiều plan (S2).
- `QDS_ASYNC_QUEUE`, `WAIT_XTP_HOST_WAIT` thường là wait nền cần lọc (S3).
- Ngưỡng tự cập nhật statistics phụ thuộc compatibility level (S10).
- Bảng biến trên SQL Server 2019 + compat 150 đã ước lượng đúng tổng số dòng, nhưng vẫn thiếu histogram (S13).
- `ONLINE = ON` chỉ chạy trên Enterprise (S8).
- Chuyển SIMPLE phải hỏi RPO trước (S16).
- Identity bỏ page split nhưng tạo điểm nóng trang cuối (S7).
- `RECOMPILE` trên proc gọi hàng triệu lần có giá CPU (S11).
- Transactional replication cần primary key (S21).
- Thứ tự ưu tiên hợp lý: sửa proc và code (nhanh, rollback dễ) → index trong khung đêm → cấu hình instance → thay đổi kiến trúc.
