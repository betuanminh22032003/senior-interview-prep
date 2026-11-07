# Phần VII. Hành vi và chuẩn bị cuối

Vòng hành vi kiểm tra cách bạn làm việc: xử lý sự cố, bảo vệ quyết định, nhận sai, phối hợp với team khác, dẫn dắt người khác. Interviewer senior hỏi sâu từng tầng để phân biệt người làm thật với người kể chuyện, nên phần này chỉ dùng câu chuyện có thật, nói đúng vai trò, và chừa chỗ trống ở nơi nguồn chưa có sự kiện thay vì điền bừa.

Chương 24 viết sẵn từng câu chuyện theo dạng STAR, kèm các câu hỏi đào sâu. Chương 25 là checklist trước khi dùng CV và cách xử lý phần cuối buổi phỏng vấn.

## Chương 24. Câu hỏi hành vi

Mỗi câu hỏi hành vi là một cơ hội chứng minh một năng lực senior bằng sự kiện. Câu trả lời tốt có bối cảnh ngắn, hành động cụ thể dùng "tôi", kết quả có số và có nguồn, và một bài học. Học xong chương này, bạn có 7 câu chuyện thật nói được trong 2 phút, biết interviewer sẽ đào tiếp ở đâu, và biết chỗ nào phải nói "phần đó đồng nghiệp làm".

### Bài 24.1. Cấu trúc STAR và cách kể trong 2 phút

#### Mục tiêu
- Sau bài này, bạn chia một câu chuyện thành S, T, A, R với thời lượng đúng.
- Bạn biết câu chuyện thật nào dùng cho câu hỏi nào.
- Bạn tránh được các lỗi làm interviewer nghi ngờ.

#### STAR
- **S (Situation, bối cảnh):** 1–2 câu. Hệ thống gì, quy mô nào, chuyện gì xảy ra.
- **T (Task, nhiệm vụ):** việc của bạn là gì, khác việc của team ở đâu.
- **A (Action, hành động):** phần dài nhất. Bạn làm gì, theo thứ tự nào, vì sao chọn cách đó. Dùng "tôi" cho phần mình làm, "team" hoặc "đồng nghiệp" cho phần người khác làm.
- **R (Result, kết quả):** con số có nguồn (trace APM, DMV, commit), cộng một câu bài học.

#### Thời lượng
Nói tiếng Việt khoảng 130–160 từ mỗi phút, nên 2 phút là khoảng 260–320 từ.

| Phần | Thời lượng |
|---|---|
| S | 15 giây |
| T | 10 giây |
| A | 60–70 giây |
| R + bài học | 25–30 giây |

#### Bảng chọn câu chuyện

| Câu hỏi | Câu chuyện thật | Bài |
|---|---|---|
| Sự cố production lớn nhất | Đợt audit APM tháng 09/2026, API bắt đầu thi 2,45 s | 24.2 |
| Quyết định phải bảo vệ | Không đặt deadline cho gRPC gửi event; không đánh index trên bảng log ghi liên tục | 24.3 |
| Một lần bạn sai | Hard-code cờ V3 quá sớm | 24.4 |
| Bất đồng với team khác | Kế hoạch hotfix ngày và index ca đêm với DBA | 24.5 |
| Dẫn dắt team | Examena, team 8 người | 24.6 |
| Dùng AI | Claude Code có review từng diff, build thật, chạy trên DB dev | 24.7 |
| Tự tìm ra vấn đề | Hai lỗi cache khiến procedure chạy 81M lần | 24.8 |

#### Quy tắc trung thực
- Interviewer hỏi 3 tầng: làm gì → làm thế nào → sao biết là đúng. Chuẩn bị đủ cả 3 tầng cho mỗi chuyện.
- Phần nào không phải của bạn thì nói thẳng. Nói vậy được đánh giá cao hơn bịa.
- Số nào là trace điển hình thì không gọi là p95. Kế hoạch chưa chạy thì không nói là đã xong.

> **Cảnh báo:** Chỗ ghi `[điền ...]` trong các bài sau là chỗ nguồn chưa có sự kiện. Điền bằng sự kiện thật của bạn hoặc bỏ câu đó; không được bịa để lấp.

#### Câu hỏi phỏng vấn
- **"Kể về một dự án bạn tự hào nhất?"** Chọn câu chuyện có kết quả đo được và phần của bạn rõ nhất: đợt sửa cache procedure chạy 81M lần (Bài 24.8) hoặc attempt engine bỏ join chéo database (Bài 24.4, phần A).
- **"Bạn khác gì một mid-level?"** Trả lời bằng hành vi, không bằng tính từ: tôi dẫn audit từ APM xuống DMV, xếp hạng điểm nóng theo chi phí và rủi ro, rồi chia kế hoạch cho Dev và DBA (Bài 24.2, 24.5).
- **"Câu chuyện này bạn làm hay team làm?"** Tách rõ: phần tôi làm là X (có commit hoặc báo cáo), phần đồng nghiệp làm là Y.

#### Tóm tắt
- S, T ngắn; A dài nhất; R có số và nguồn.
- 2 phút ≈ 260–320 từ.
- "Tôi" cho phần mình, "đồng nghiệp" cho phần người khác.
- Mỗi chuyện chuẩn bị đủ 3 tầng câu hỏi.

#### Bài tập
1. Bấm giờ, kể câu chuyện ở Bài 24.2 thành tiếng. Ghi âm và đếm thời gian từng phần.
   **Đáp án:** Nếu S + T vượt 30 giây, cắt bối cảnh; nếu A dưới 50 giây, thêm bước "vì sao chọn cách đó".
2. Với mỗi câu chuyện trong bảng, viết 1 câu "phần nào không phải của tôi".
   **Đáp án:** Ví dụ Bài 24.2: "Ba fix ngày 16/09 do đồng nghiệp commit; tôi dẫn audit và đề xuất cách sửa."

### Bài 24.2. Sự cố production lớn nhất

#### Mục tiêu
- Sau bài này, bạn kể được đợt audit hiệu năng tháng 09/2026 trong 2 phút, đúng vai trò.
- Bạn trả lời được các câu hỏi đào sâu về cách tìm nguyên nhân và cách đo.

#### Câu chuyện thật
- **S:** Tháng 09/2026, nền tảng thi có 6 cụm SQL Server tách theo domain và một Redis cluster. API bắt đầu thi thử mất 2,45 s trên trace APM; nhiều procedure nóng chạy hàng triệu lần với logical reads cao.
- **T:** Tôi dẫn đợt rà soát hiệu năng toàn hệ thống: tìm điểm nóng, xếp hạng mức ưu tiên, đề xuất cách sửa cho Dev và DBA.
- **A:** Tôi làm theo 3 bước. Một, lọc endpoint chậm trên Elastic APM rồi mở trace xem thời gian từng span. Với API bắt đầu thi, span Redis chiếm phần lớn: 472 lệnh `SCAN` và 17 lệnh `UNLINK` trong một request, do hàm làm mới cache gói quét toàn keyspace để tìm key cần xóa. Hai, từ span SQL tôi truy xuống DMV: số lần chạy, logical reads, plan đang cache, missing index, wait stats. Ví dụ bảng chứng chỉ là HEAP 1,6 triệu dòng, procedure tra cứu chạy 2,87 triệu lần, trung bình 420 ms. Một procedure khác gọi linked server ngay trong transaction đang giữ lock, wait MSQL_DQ cộng OLEDB chiếm 38,4% thời gian chờ. Ba, đọc code để tìm chuỗi gọi từ controller xuống procedure. Với Redis, tôi đề xuất dùng một SET làm index chứa các key liên quan để xóa trực tiếp từng key, thay cho `SCAN`.
- **R:** Đồng nghiệp commit ba fix ngày 16/09. Trace sau fix: API bắt đầu thi 55 ms, không còn `SCAN`; kết thúc game còn 9,9 ms; xác nhận kết quả tự luyện 71 → 31 ms. Tôi tự commit phần cache cho procedure chạy 81M lần và API cập nhật thông tin GDPT. Bài học: thao tác O(kích thước keyspace) không được nằm trên đường nóng.

(nguồn: mục 2, 3.1, C0, C1)

> **Cảnh báo:** 2,45 s → 55 ms là thời gian của một trace điển hình trước và sau, không phải p95. Đây là sự cố hiệu năng phát hiện qua audit, không phải một lần sập hệ thống; nếu interviewer hỏi về outage, nói rõ điều này.

#### Câu hỏi đào sâu
- "`SCAN` không chặn như `KEYS`, sao vẫn chậm?"
- "Sao chắc nguyên nhân là `SCAN`?"
- "Xếp hạng điểm nóng theo tiêu chí nào?"
- "p95 trước và sau là bao nhiêu?"
- "Ai commit fix?"

#### Câu hỏi phỏng vấn
- **"Kể về sự cố production lớn nhất bạn đã xử lý?"** Kể câu chuyện trên, giữ đúng vai trò: tôi dẫn audit và đề xuất, đồng nghiệp commit ba fix.
- **"Kể về một lần hệ thống chậm và bạn tìm ra nguyên nhân?"** Cùng câu chuyện, nhấn vào phần A: APM → DMV → đọc code, và bằng chứng là span Redis chiếm phần lớn trace.
- **"`SCAN` không chặn như `KEYS`, sao vẫn chậm?"** Mỗi lệnh `SCAN` chỉ duyệt một phần keyspace, nhưng 472 round-trip trong một request cộng lại thành hàng trăm ms đến giây, và mỗi lệnh vẫn chiếm luồng đơn của Redis. Gốc rễ là thuật toán O(kích thước keyspace) trên đường nóng.
- **"p95 trước và sau là bao nhiêu?"** Tôi chưa có p95 trong khoảng thời gian dài; số tôi đưa là trace điển hình trước và sau fix.
- **"Bạn xếp hạng điểm nóng theo tiêu chí nào?"** Tổng chi phí (logical reads hoặc CPU trung bình nhân số lần chạy), mức ảnh hưởng tới API người dùng, rồi độ dễ sửa và rủi ro.

#### Tóm tắt
- Vai trò: dẫn audit, đề xuất; đồng nghiệp commit 3 fix ngày 16/09.
- Quy trình: APM → DMV → đọc code.
- Số: 2,45 s → 55 ms (trace), 472 `SCAN`, 38,4% wait linked server.
- Bài học: không đặt thao tác O(N) trên đường nóng.

#### Bài tập
1. Viết lại phần R trong 3 câu, không dùng chữ "p95".
   **Đáp án:** Trace sau fix 55 ms, không còn `SCAN`; kết thúc game 9,9 ms; xác nhận kết quả 71 → 31 ms. Ba fix do đồng nghiệp commit, tôi tự commit phần cache và API GDPT.
2. Viết truy vấn DMV liệt kê 20 procedure tốn logical reads nhất.
   **Đáp án:**
   ```sql
   SELECT TOP 20 OBJECT_NAME(ps.object_id, ps.database_id) AS proc_name,
          ps.execution_count,
          ps.total_logical_reads / ps.execution_count AS avg_reads,
          ps.total_elapsed_time / ps.execution_count / 1000.0 AS avg_ms
   FROM sys.dm_exec_procedure_stats ps
   ORDER BY ps.total_logical_reads DESC;
   ```

### Bài 24.3. Quyết định kỹ thuật phải bảo vệ

#### Mục tiêu
- Sau bài này, bạn kể được một quyết định đi ngược "cách làm mặc định" kèm lý do bằng con số.
- Bạn có hai câu chuyện dự phòng: deadline gRPC và index trên bảng log.

#### Câu chuyện thật: không đặt deadline cho gRPC gửi event
- **S:** API cập nhật thông tin GDPT mất 504 ms trên trace APM. Trong đó procedure lấy vị trí user bị gọi 5 lần, procedure kiểm tra điều kiện đăng ký 5 lần, và mỗi lần gửi event gRPC lại tạo `GrpcChannel` mới.
- **T:** Tôi tự sửa API này (commit 22/09), gồm cả phần gửi event gRPC.
- **A:** Tôi đọc vị trí user một lần ở đầu flow rồi truyền xuống các bước kiểm tra, gộp hai lần lấy vòng tự luyện thành một lần gọi DB. Với gRPC, tôi dùng chung một `GrpcChannel` và gửi event trong `Task.Run` để ra khỏi luồng HTTP. Cách làm mặc định là đặt deadline cho mọi lời gọi gRPC. Tôi cố ý không đặt, vì service nhận event có lúc chậm tới 3,6 s; đặt deadline sẽ làm rơi event, tức là đổi hành vi nghiệp vụ. Vì đã fire-and-forget nên request người dùng không bị giữ.
- **R:** Báo cáo ghi mục tiêu dự kiến dưới 60 ms; tôi chưa đo lại bằng APM nên không nói là đã đạt. Bài học: timeout áp cho lời gọi đồng bộ trên đường request; việc nền tách khỏi request thì nên đưa vào hàng đợi bền thay vì đặt deadline.

(nguồn: mục 3.2)

#### Câu chuyện dự phòng: không đánh index trên bảng log ghi liên tục
- **S:** Trong đợt audit, cụm log thi có WRITELOG khoảng 41% và THREADPOOL khoảng 46% thời gian chờ.
- **T:** Đề xuất cách xử lý các bảng log mà DMV báo thiếu index.
- **A:** Tôi không đề xuất đánh index hết. Bảng ghi liên tục mà thêm nonclustered index trên key ngẫu nhiên như `UserId` sẽ bị page split, write amplification và WRITELOG tăng thêm. Tôi chia bảng theo access pattern: bảng chỉ ghi để HEAP hoặc clustered theo identity; bảng ghi dồn theo ca thi thì partition và đánh index sau ca; bảng hot path dùng covering index gọn; nhu cầu tra cứu chuyển sang replica.
- **R:** Đây là chiến lược đề xuất trong báo cáo; trạng thái triển khai `[điền trạng thái thật]`. Không nói "đã giảm WRITELOG".

(nguồn: mục 2, B0 #5)

> **Cảnh báo:** Nguồn không ghi ai đã phản biện các quyết định này. Nếu có người phản biện thật trong review, nêu vai trò của họ; nếu không, kể là "quyết định đi ngược cách làm mặc định và tôi giải thích lý do trong thay đổi".

#### Câu hỏi đào sâu
- "Nếu service nhận event chết thì event đi đâu?"
- "Task.Run trong ASP.NET Core có rủi ro gì?"
- "Sao không đưa event vào Kafka ngay?"
- "Không có index thì truy vấn tra cứu trên bảng log chạy thế nào?"

#### Câu hỏi phỏng vấn
- **"Kể về một quyết định kỹ thuật bạn phải bảo vệ?"** Kể chuyện deadline gRPC: cách mặc định là đặt deadline, tôi chọn không đặt vì service nhận có lúc chậm 3,6 s và deadline sẽ làm rơi event.
- **"Kể về một lần bạn chọn không làm theo best practice?"** Cùng câu chuyện, nhấn vào điều kiện áp dụng: deadline là best practice cho lời gọi đồng bộ; ở đây lời gọi đã tách khỏi request.
- **"Nếu service nhận event chết thì sao?"** Với `Task.Run`, process chết là mất event. Hướng đúng hơn là đưa event vào hàng đợi bền như Kafka hoặc outbox; tôi nói rõ đây là giới hạn của cách đang làm.
- **"Sao không đánh index hết cho nhanh?"** Bảng log ghi liên tục mà thêm index trên key ngẫu nhiên thì page split và WRITELOG tăng, trong khi WRITELOG đã chiếm khoảng 41% thời gian chờ ở cụm đó. Tôi chia theo access pattern.

#### Tóm tắt
- Quyết định chính: không đặt deadline cho gRPC fire-and-forget, vì deadline làm rơi event.
- Số: trace 504 ms, service nhận chậm tới 3,6 s; mục tiêu dưới 60 ms chưa đo lại.
- Dự phòng: không index bảng log, WRITELOG 41%, THREADPOOL 46%.
- Luôn nêu giới hạn của chính quyết định.

#### Bài tập
1. Viết một câu giải thích vì sao bullet "Polly timeout" không mâu thuẫn với quyết định không đặt deadline.
   **Đáp án:** Timeout áp cho lời gọi đồng bộ trên đường request; event chạy nền đã tách khỏi request thì không cần deadline, và nên đưa vào hàng đợi bền.
2. Liệt kê 3 cách đưa event ra khỏi request an toàn hơn `Task.Run`.
   **Đáp án:** Ghi outbox trong cùng transaction rồi worker publish; publish Kafka với retry; `Channel<T>` cộng `BackgroundService` nếu chấp nhận mất khi process chết.

### Bài 24.4. Một lần bạn sai

#### Mục tiêu
- Sau bài này, bạn kể được một lỗi thật của mình, không đổ lỗi, có bài học cụ thể.
- Bạn trả lời được câu hỏi về rollback và quy trình rollout.

#### Câu chuyện thật: hard-code cờ V3 quá sớm
- **S:** Hệ thống Mastery tách 4 database theo vai trò. DB tích hợp có 18 procedure, 12 cái join chéo sang DB khác, trong khi review dự án yêu cầu không join chéo hai database.
- **T:** Tôi viết attempt engine V3 (chuỗi commit 21–24/08) để bỏ 12 procedure join chéo.
- **A:** C# điều phối 12 bước: 4 lần đọc DB đề, 2 lần đọc DB câu hỏi, 1 lần đọc DB tích hợp, rồi đúng 1 lần ghi, nhận danh sách câu đã chọn qua table-valued parameter. Lần ghi chạy trong transaction `XACT_ABORT ON`, `UPDLOCK, HOLDLOCK` và kiểm tra lại cooldown, quota ngày, thứ tự attempt. Lúc rollout tôi để một cờ đọc từ config để quay về đường cũ mà không cần deploy. Sai lầm: sau khi chạy ổn trên dev, chính tôi hard-code cờ thành `true` ngay trong ngày 24/08 để bỏ bớt nhánh cấu hình.
- **R:** Từ đó muốn rollback phải deploy lại, mất đúng lớp an toàn tôi đã đặt. Bài học: giữ cờ trong config đến hết đợt live đầu tiên, và chỉ gỡ khi có số liệu production.

(nguồn: mục 5, D2.6)

> **Ghi nhớ:** Nguồn còn nêu một chuyện thứ hai: "commit cache-control bị revert trong ngày" (mục 15), nhưng không có chi tiết. Chỉ dùng nếu bạn nhớ được bối cảnh, nguyên nhân và cách sửa thật: `[điền chi tiết thật]`.

#### Câu hỏi đào sâu
- "Vì sao lúc đó bạn hard-code?"
- "Có ai phát hiện ra không, hay bạn tự nhận?"
- "Nếu V3 lỗi trên production thì giờ làm thế nào?"
- "Phần AI viết trong V3 là bao nhiêu?"

#### Câu hỏi phỏng vấn
- **"Kể về một lần bạn sai?"** Kể chuyện cờ V3: tôi đặt rollback switch đúng cách rồi tự gỡ nó quá sớm, ngay trong ngày.
- **"Kể về một quyết định bạn muốn làm lại?"** Cùng câu chuyện, nhấn vào điều sẽ làm khác: giữ cờ đến hết đợt live đầu tiên.
- **"Nếu V3 lỗi trên production thì giờ làm sao?"** Phải deploy lại bản có đường cũ. Đây đúng là hệ quả của sai lầm; vì vậy tôi nêu nó như bài học.
- **"Ghi thành công nhưng bước sau lỗi thì sao?"** Chỉ có một lần ghi atomic, nên không có trạng thái ghi dở; các lần đọc trước chỉ mang tính tham khảo và được kiểm tra lại trong transaction.
- **"AI viết hay bạn viết?"** Tôi dùng Claude Code sinh nháp theo plan từng pha; tôi review, chạy trên DB dev và sửa cho khớp procedure V3. Các commit có co-author là AI.

#### Tóm tắt
- Lỗi: tự hard-code cờ V3 thành `true` ngay ngày 24/08.
- Hệ quả: rollback cần deploy lại.
- Bài học: giữ switch trong config đến hết đợt live đầu tiên.
- Không đổ lỗi; nói rõ phần thiết kế đúng và phần mình làm sai.

#### Bài tập
1. Viết lại phần R trong 2 câu, không dùng từ "nhưng".
   **Đáp án:** Từ đó rollback phải deploy lại. Lần sau tôi giữ cờ trong config đến hết đợt live đầu tiên và chỉ gỡ khi có số liệu production.
2. Viết điều kiện để gỡ một feature flag rollout.
   **Đáp án:** Đã chạy hết ít nhất một đợt live; metric lỗi và độ trễ không xấu hơn đường cũ; có người chịu trách nhiệm xác nhận; xóa cờ trong một PR riêng.

### Bài 24.5. Bất đồng với team khác

#### Mục tiêu
- Sau bài này, bạn kể được cách phối hợp với DBA khi nhu cầu của Dev và ràng buộc vận hành DB xung đột.
- Bạn giải thích được kế hoạch hai tầng bằng cơ chế khóa của SQL Server.

#### Câu chuyện thật
- **S:** Sau đợt audit, nhiều procedure cần sửa và nhiều bảng cần thêm index, ví dụ bảng chứng chỉ HEAP 1,6 triệu dòng mà DMV missing index báo impact 99,73%. Dev muốn sửa ngay; DBA phải giữ production ổn định.
- **T:** Tôi viết kế hoạch xử lý chia theo mức ưu tiên cho Dev và DBA.
- **A:** Ràng buộc là server chạy Standard Edition, không có `ONLINE = ON`, nên `CREATE INDEX` ban ngày sẽ khóa bảng. Ngược lại, `ALTER PROCEDURE` chỉ giữ schema lock dưới 1 ms. Tôi tách kế hoạch thành hai tầng: tầng một là hotfix procedure, deploy được trong ngày; tầng hai là index, giao DBA chạy trong cửa sổ 23h–05h. Với bảng log ghi liên tục, tôi không đề xuất thêm index mà chia theo access pattern (Bài 24.3). Cách đo sau khi sửa: `ALTER PROCEDURE` reset stats của procedure, nên số mới chỉ tính các lần chạy sau deploy, kèm so trace APM trước và sau.
- **R:** Phần hotfix không phải chờ cửa sổ index. Phần index ca đêm: `[điền trạng thái thật: DBA đã chạy bảng nào]`. Báo cáo là kế hoạch, tôi không nhận các mục chưa làm là đã xong.

(nguồn: mục 2, D2.3)

> **Cảnh báo:** Nguồn mô tả xung đột về ràng buộc (sửa ngay hay giữ ổn định), không ghi một cuộc tranh luận cụ thể. Nếu có tranh luận thật với DBA, kể đúng nội dung; nếu không, đừng dựng thêm.

#### Câu hỏi đào sâu
- "DBA đã đánh index chưa?"
- "Sao không mua Enterprise để đánh index online?"
- "Tách nhánh `IF/ELSE` trong hotfix có bị parameter sniffing không?"
- "Nếu DBA không đồng ý cửa sổ 23h–05h thì sao?"

#### Câu hỏi phỏng vấn
- **"Kể về một lần bạn bất đồng với team khác?"** Kể chuyện kế hoạch hai tầng với DBA: tách phần deploy được ngay khỏi phần cần cửa sổ đêm, dựa trên cơ chế khóa.
- **"Kể về một lần ưu tiên của bạn xung đột với ưu tiên của người khác?"** Cùng câu chuyện, nhấn vào cách tìm phần làm được ngay mà không ảnh hưởng ràng buộc của DBA.
- **"Sao không đánh index ban ngày?"** Standard Edition không có `ONLINE = ON`; nonclustered index giữ khóa S chặn ghi, clustered index giữ Sch-M chặn mọi truy cập.
- **"Sao không mua Enterprise?"** Chi phí license theo core rất lớn so với việc dời lịch đánh index sang 23h–05h.
- **"DBA đã đánh index chưa?"** Trả lời theo trạng thái thật; báo cáo là kế hoạch.

#### Tóm tắt
- Xung đột: Dev muốn sửa ngay, DBA giữ ổn định, Standard Edition không có index online.
- Giải pháp: hotfix procedure trong ngày, index trong cửa sổ 23h–05h.
- Lý do bằng cơ chế: schema lock của `ALTER PROCEDURE` dưới 1 ms.
- Không nhận mục chưa làm là đã xong.

#### Bài tập
1. Viết checklist đánh index ca đêm theo best practice.
   **Đáp án:** Thử trên bản sao dữ liệu để biết thời gian và dung lượng; mỗi đêm vài bảng, bảng nhỏ trước; `SORT_IN_TEMPDB = ON`, giới hạn `MAXDOP`; theo dõi blocking, có ngưỡng dừng; sáng hôm sau so plan và DMV.
2. Viết câu mở đầu khi đề xuất kế hoạch cho DBA, tập trung vào ràng buộc của họ.
   **Đáp án:** "Không có thay đổi nào trong ngày khóa bảng; phần index tôi đề xuất chạy trong cửa sổ 23h–05h, thứ tự theo mức ảnh hưởng, anh/chị chọn đêm."

### Bài 24.6. Dẫn dắt team

#### Mục tiêu
- Sau bài này, bạn kể được vai trò Team Lead ở Examena bằng các sự kiện có thật.
- Bạn biết chỗ nào phải chuẩn bị thêm ví dụ cụ thể và chỗ nào không được nói.

#### Câu chuyện thật
- **S:** Ở AvePoint, tôi là Team Lead của Examena, nền tảng thi trực tuyến có giám sát qua video. Team 8 người. Kỳ thi thật có hơn 3.000 thí sinh đồng thời.
- **T:** Tôi chịu trách nhiệm technical design, task planning, code review và release.
- **A:** Quyết định thiết kế lớn nhất là dùng SFU MediaSoup thay cho mesh: với mesh, mỗi thí sinh phải gửi N luồng cho N giám thị; với SFU, mỗi thí sinh chỉ gửi 1 luồng, server chuyển tiếp. Hệ thống có tích hợp AI chống gian lận; sự kiện bị gắn cờ đi vào hàng đợi duyệt bất đồng bộ và audit log, để video của giám thị không phải chờ model. Delivery chạy theo chuỗi Docker, Helm, Terraform, GitLab CI và Argo CD, nên rollback bằng Git. `[xác nhận: SFU và cách tách AI là quyết định của bạn hay của team]`. Về phân việc: `[điền một lần chia lại việc thật]`. Về code review: `[điền một PR đã chặn và lý do]`.
- **R:** Hệ thống chạy kỳ thi thật với hơn 3.000 thí sinh đồng thời. Tôi không nhớ chính xác cấu hình worker và không có công cụ đo để dẫn ra.

(nguồn: C5, D0 #16–18)

> **Cảnh báo:** Không nói số SFU worker, thông số AI (khung/s, độ trễ), Azure/AKS, Scrum hay sprint planning nếu chưa xác nhận là thật. Không bịa tên công cụ đo 3.000 thí sinh.

#### Câu hỏi đào sâu
- "Team 8 người gồm những vai trò nào?"
- "Một lần delivery bị trễ, bạn xử lý thế nào?"
- "Bạn phối hợp với product, QA, DevOps ra sao?"
- "Một worker MediaSoup chịu được bao nhiêu?"
- "Một PR bạn đã chặn, vì sao?"

#### Câu hỏi phỏng vấn
- **"Kể về một lần bạn dẫn dắt team?"** Kể chuyện Examena: vai trò, SFU thay mesh, AI chống gian lận không chặn luồng video, chuỗi delivery, và một ví dụ phân việc thật.
- **"Bạn ra quyết định kiến trúc thế nào khi team có ý kiến khác nhau?"** Theo khung vấn đề → phương án → chọn gì → đánh đổi; ví dụ SFU so với mesh và MCU. Nếu có tranh luận thật trong team, kể đúng nội dung.
- **"SFU, MCU, mesh khác nhau thế nào?"** Mesh: mỗi peer gửi N luồng, không scale. MCU: server trộn hình, tốn CPU. SFU: server chỉ chuyển tiếp, mỗi thí sinh gửi 1 luồng.
- **"Team 8 người gồm những vai trò nào?"** Trả lời đúng thực tế; CV không ghi cơ cấu vai trò.
- **"Một lần delivery bị trễ, bạn làm gì?"** Dùng sự kiện thật nếu có. Nếu không nhớ cụ thể, nói cách làm: phát hiện sớm, cắt phạm vi cùng product, giữ luồng thi chính, báo sớm mốc mới, retro để sửa cách ước lượng; và nói rõ đó là cách làm, không phải chuyện kể.

#### Tóm tắt
- Thật: Team Lead, 8 người, 3.000+ thí sinh trong kỳ thi thật, SFU thay mesh, có tích hợp AI chống gian lận, chuỗi Docker → Helm → Terraform → GitLab CI → Argo CD.
- Chưa có trong nguồn: ví dụ chia lại việc, PR bị chặn, lần trễ hạn; phải điền bằng chuyện thật.
- Không nói số worker, thông số AI, Azure, Scrum khi chưa xác nhận.

#### Bài tập
1. Viết 3 câu cho mỗi chỗ `[điền ...]` bằng sự kiện bạn nhớ được.
   **Đáp án:** Mỗi câu phải có: chuyện gì, bạn làm gì, kết quả. Không nhớ thì bỏ, không thay bằng ví dụ chung.
2. Ước lượng số worker MediaSoup cho 3.000 thí sinh, mỗi thí sinh có 1 giám thị xem, một worker khoảng 500 consumer.
   **Đáp án:** Khoảng 3.000 consumer / 500 = 6 worker, chưa tính dư phòng. Nói đây là ước lượng, không phải cấu hình thật.

### Bài 24.7. Dùng AI thế nào, không tin AI ở đâu

#### Mục tiêu
- Sau bài này, bạn kể được quy trình dùng AI agent có kiểm soát trong công việc thật.
- Bạn nói rõ được ranh giới: AI làm gì, bạn kiểm gì, chỗ nào không tin AI.

#### Câu chuyện thật
- **S:** Tôi làm trên nhiều repo .NET với codebase cũ, nhiều sự kiện theo mùa và một đợt nâng khoảng 70 project lên .NET 10.
- **T:** Tăng tốc độ làm việc bằng AI agent mà không hạ chất lượng.
- **A:** Mỗi repo có file ngữ cảnh dự án (`CLAUDE.md`). Tôi viết skill Claude Code ghi quy trình chuẩn: làm sự kiện end-to-end (bộ câu hỏi chuẩn → khảo sát code và DB dev → viết plan → sinh SQL cấu hình và code) và nâng cấp .NET 10. Tôi cài và cấu hình MCP server cho điều hướng C# theo ngữ nghĩa, đọc schema DB dev và ngữ cảnh git; MCP chỉ có quyền đọc DB dev. Kiểm soát chất lượng: đọc từng diff, build trên máy thật, chạy với DB dev, review đối kháng giữa code, schema và độ phủ yêu cầu, có rollback switch cho thay đổi lớn. Với attempt engine V3, Claude Code sinh nháp theo plan từng pha; tôi review, chạy trên DB dev và sửa cho khớp procedure.
- **R:** Knowledge base gồm tài liệu luồng nghiệp vụ, API và store procedure theo DB; AI soạn nháp, tôi review và giữ cấu trúc. Chỗ tôi không tin AI: số liệu và claim chưa đo, SQL chạy trên production, logic đồng thời. Ở luồng dữ liệu trường, tôi còn đo độ chính xác của AI bằng cách chụp bản AI gốc và so với bản người duyệt lưu.

(nguồn: mục 12, 5, 9, D2.15)

> **Cảnh báo:** Nếu chỉ cài và cấu hình MCP server có sẵn, nói "set up", không nói "built". Không nói số ngày tiết kiệm được nếu chưa đo.

#### Câu hỏi đào sâu
- "Bạn review code AI viết như thế nào, cụ thể?"
- "Một lần AI viết sai mà bạn bắt được?"
- "Dữ liệu nội bộ có đi ra ngoài qua AI không?"
- "Đo độ chính xác của AI thế nào?"

#### Câu hỏi phỏng vấn
- **"Bạn dùng AI trong công việc thế nào?"** Kể quy trình: file ngữ cảnh mỗi repo, skill ghi quy trình chuẩn, MCP chỉ đọc DB dev, và bốn lớp kiểm: đọc diff, build thật, chạy DB dev, review đối kháng.
- **"Bạn không tin AI ở chỗ nào?"** Số liệu và claim chưa đo, SQL chạy trên production, logic đồng thời và giao dịch. Những chỗ này tôi tự kiểm bằng build, DB dev và đọc từng dòng.
- **"Làm sao đảm bảo chất lượng code AI?"** Đọc từng diff, build trên máy thật, chạy với DB dev, review đối kháng, và rollback switch cho thay đổi lớn.
- **"Code trong commit là AI viết hay bạn viết?"** Trả lời thật: AI sinh nháp theo plan, tôi review, chạy và sửa; tôi giải thích được từng dòng.
- **"Đo độ chính xác của AI thế nào?"** Chụp bản AI gốc ở lần lưu đầu, so với mỗi lần người duyệt lưu theo từng trường, ghi số trường AI đề xuất, số trường sai và chi tiết; bước đánh giá lỗi chỉ ghi log, không làm hỏng lần lưu.

#### Tóm tắt
- Ngữ cảnh dự án, skill, MCP chỉ đọc DB dev.
- Bốn lớp kiểm: diff, build thật, DB dev, review đối kháng.
- Không tin AI ở số liệu, SQL production, logic đồng thời.
- Nói "set up" nếu chỉ cấu hình MCP; AI soạn nháp tài liệu, bạn review.

#### Bài tập
1. Viết 3 quy tắc an toàn khi cho AI agent truy cập DB.
   **Đáp án:** Chỉ DB dev; tài khoản chỉ đọc cho công cụ AI; script ghi chạy qua người, mặc định preview rồi rollback.
2. Viết câu trả lời 30 giây cho "AI viết hay bạn viết?" về attempt engine V3.
   **Đáp án:** "Claude Code sinh nháp theo plan từng pha. Tôi review từng diff, chạy trên DB dev và sửa cho khớp procedure V3. Tôi giải thích được từng bước của 12 bước điều phối."

### Bài 24.8. Tự tìm ra vấn đề không ai giao

#### Mục tiêu
- Sau bài này, bạn kể được câu chuyện procedure chạy 81M lần, phần chắc chắn là của bạn.
- Bạn nói đúng ý nghĩa con số 81M và cách đo sau khi sửa.

#### Câu chuyện thật
- **S:** Trong DMV, procedure lấy danh mục môn và vòng chạy khoảng 81,16 triệu lần, mỗi lần 3,7 ms và 244 reads, cộng dồn khoảng 19,8 tỷ logical reads. Đây là dữ liệu cấu hình, ít khi đổi, lẽ ra phải nằm trong cache.
- **T:** Tìm vì sao cache không chặn được các lần gọi này và sửa.
- **A:** Tôi đọc code cache và thấy hai lỗi. Một, TTL dùng chung một biến 1 giây, nên cache gần như vô dụng. Hai, kết quả rỗng không bao giờ được cache vì code coi list rỗng là cache miss, nên các tổ hợp không có cấu hình luôn đi xuống DB. Tôi đổi sang key V2 lưu JSON, quy ước `null` là chưa có cache, list rỗng là đã cache kết quả rỗng, TTL 6 giờ, và thêm hàm xóa cache để CMS gọi khi cấu hình thay đổi. Cùng commit, tôi cache procedure lấy gói theo service (khoảng 4,95 triệu lần, 34 ms mỗi lần) bằng version key để invalidate O(1), và khử N+1 ở API chứng chỉ.
- **R:** Commit ngày 21/09 là của tôi. Tôi theo dõi mức giảm qua tốc độ tăng của `execution_count` trong DMV và số span SQL trong APM; số cụ thể sau sửa: `[điền nếu đã đo]`. Đánh đổi: dữ liệu cấu hình có thể cũ tối đa 6 giờ, chấp nhận được vì có hàm xóa cache.

(nguồn: mục 4.1, 4.2, 4.3, C0)

> **Cảnh báo:** 81M là số lần chạy cộng dồn trong DMV kể từ khi plan được cache, không phải "đã loại bỏ 81M lần gọi". Không cộng 81M với 4,95M.

#### Câu hỏi đào sâu
- "Sao không chỉ tăng TTL?"
- "Negative cache có rủi ro gì?"
- "Cache stampede khi key hết hạn thì sao?"
- "Sao dùng Redis mà không dùng MemoryCache cho bảng giá?"
- "Sau khi sửa giảm được bao nhiêu?"

#### Câu hỏi phỏng vấn
- **"Kể về một vấn đề bạn tự tìm ra mà không ai giao?"** Kể chuyện procedure 81M lần: đọc DMV, thấy dữ liệu cấu hình mà chạy hàng chục triệu lần, đọc code tìm ra hai lỗi cache, tự commit sửa.
- **"Kể về một lần bạn chủ động cải thiện hệ thống?"** Cùng câu chuyện, nhấn vào việc tìm từ số liệu chứ không chờ ticket, và đánh đổi TTL 6 giờ.
- **"Sao không chỉ tăng TTL?"** TTL dài vẫn không cache kết quả rỗng, nên các tổ hợp không có cấu hình luôn miss. Phải có negative caching.
- **"Negative cache có rủi ro gì?"** Cấu hình vừa tạo vẫn bị coi là rỗng tới khi hết TTL. Xử lý: CMS gọi hàm xóa cache khi tạo hoặc sửa cấu hình, hoặc TTL ngắn hơn cho kết quả rỗng.
- **"81M có nghĩa là bạn bỏ được 81M lần gọi không?"** Không. Đó là số lần chạy cộng dồn trong DMV trước khi sửa; mức giảm đo bằng tốc độ tăng của `execution_count`.

#### Tóm tắt
- 81,16 triệu lần chạy, 3,7 ms, 244 reads, ~19,8 tỷ reads cộng dồn.
- Hai lỗi: TTL 1 giây dùng chung; kết quả rỗng không được cache.
- Sửa: key V2 JSON, `null` khác list rỗng, TTL 6 giờ, hàm xóa cache cho CMS.
- Commit 21/09 của bạn; nói đúng nghĩa con số.

#### Bài tập
1. Viết truy vấn đo tốc độ gọi của một procedure: chụp `execution_count` hai lần cách nhau 1 giờ.
   **Đáp án:**
   ```sql
   SELECT GETDATE() AS at, ps.execution_count
   FROM sys.dm_exec_procedure_stats ps
   WHERE ps.object_id = OBJECT_ID(N'dbo.ProcName');
   -- Chạy lại sau 1 giờ, lấy hiệu chia 60 để có số lần/phút; so cùng khung giờ trước và sau fix.
   ```
2. Viết đoạn C# phân biệt "chưa có cache" với "đã cache list rỗng".
   **Đáp án:**
   ```csharp
   var json = await redis.StringGetAsync(key);
   if (json.IsNull) { var data = await LoadFromDb(); /* ghi cache, kể cả list rỗng */ return data; }
   return JsonSerializer.Deserialize<List<Item>>(json!)!; // có thể là list rỗng
   ```

## Chương 25. Trước buổi phỏng vấn

Phần lớn câu hỏi xoáy nhắm vào chỗ CV nói quá sự thật. Chương này gom các việc phải làm trước khi gửi CV và trước buổi phỏng vấn, cùng cách dùng 5–10 phút cuối buổi để hỏi lại interviewer. Học xong, bạn có một danh sách tick được và một bộ câu hỏi lại có chủ đích.

### Bài 25.1. Checklist trước khi dùng CV

#### Mục tiêu
- Sau bài này, bạn rà được CV theo trạng thái Thật / Một phần / Minh họa trước khi gửi.
- Bạn biết những con số và cụm từ phải sửa hoặc đo lại.
- Bạn có lịch luyện nói và luyện system design trước buổi phỏng vấn.

#### Vì sao cần checklist
Mỗi dòng CV là một câu hỏi tiềm năng. Dòng Minh họa mà kể như việc đã làm sẽ bị lộ ở tầng thứ hai hoặc thứ ba của câu hỏi. Ba cách xử lý một dòng Minh họa: làm thật và đo; bỏ khỏi CV; hoặc chuẩn bị câu "chưa triển khai, tôi sẽ làm thế này".

#### Những chỗ hay sai
- **"p95":** số 2,45 s → 55 ms là trace điển hình. Đo p95 thật (7 ngày trước và sau 16/09) hoặc bỏ chữ "p95".
- **"Unified sign-on for 4 products":** phần thật là hardening BFF và SSO cho IOE web, IOSTEM.
- **"Built MCP servers":** nếu chỉ cài và cấu hình thì đổi thành "Set up".
- **Số service nâng .NET 10:** khoảng 12, phải đếm lại trước khi nói.

#### Checklist
- [ ] Với mỗi dòng **Minh họa**: làm thật và đo, hoặc bỏ khỏi CV, hoặc chuẩn bị câu "chưa triển khai, tôi sẽ làm thế này".
- [ ] Sửa hoặc đo chữ "p95" ở Summary và dòng 1.
- [ ] Sửa "Unified sign-on for 4 products" về đúng phạm vi bạn đã làm.
- [ ] Đổi "Built … MCP servers" thành "Set up" nếu bạn chỉ cài và cấu hình.
- [ ] Xác nhận cloud thật ở AvePoint (Azure hay khác) và team có chạy Scrum không.
- [ ] Đếm lại số service đã nâng lên .NET 10.
- [ ] Đọc lại các bài bảo vệ CV có trạng thái **Thật**.
- [ ] Tự trả lời thành tiếng từng câu hỏi xoáy, mỗi câu dưới 2 phút.
- [ ] Làm thử Bài 16.1 trên giấy trong 40 phút.
- [ ] Điền hoặc bỏ mọi chỗ `[điền ...]` trong Chương 24.
- [ ] Mỗi con số trong CV: biết là trace, trung bình, p95 hay số cộng dồn; đo bằng gì; trong khoảng thời gian nào.
- [ ] Vẽ được kiến trúc nền tảng hiện tại (service, DB, Redis, Kafka, gRPC) trong 3 phút.
- [ ] Mock interview ít nhất 2 lần với người hỏi xoáy.

#### Câu hỏi phỏng vấn
- **"Con số này bạn đo bằng gì, trong khoảng thời gian nào?"** Trả lời theo nguồn thật: trace APM trước và sau, DMV cộng dồn kể từ khi plan được cache, hoặc mục tiêu NFR chưa đo. Không có số đo thì nói là chưa đo.
- **"Dòng này bạn làm hay team làm?"** Tách phần của bạn (có commit, báo cáo) với phần đồng nghiệp hoặc lớp có sẵn.
- **"Phần này đã triển khai chưa?"** Theo trạng thái thật. Nếu là đề xuất: "chưa triển khai, tôi sẽ làm thế này", kèm cách đo.

#### Tóm tắt
- Rà từng dòng CV theo Thật / Một phần / Minh họa.
- Sửa "p95", "4 products", "Built MCP servers", số service.
- Luyện nói từng câu dưới 2 phút; làm Bài 16.1 trong 40 phút.
- Điền hoặc bỏ mọi chỗ trống trong câu chuyện hành vi.

#### Bài tập
1. Chọn 3 dòng CV bất kỳ, viết trạng thái và một câu nói an toàn cho mỗi dòng.
   **Đáp án:** Ví dụ: "Audit 6 cụm SQL Server" là Một phần, nói "Tôi dẫn audit, xếp hạng điểm nóng và đề xuất cách sửa; team cùng triển khai."
2. Viết các bước lấy p95 của API bắt đầu thi thử để thay chữ "p95" trong CV.
   **Đáp án:** Trên APM, lọc transaction của API đó, lấy p95 7 ngày trước và 7 ngày sau 16/09, cùng khung giờ; ghi lại nguồn và khoảng thời gian.

### Bài 25.2. Câu hỏi nên hỏi lại interviewer và buổi cuối

#### Mục tiêu
- Sau bài này, bạn có bộ câu hỏi lại giúp đánh giá công việc thật sự.
- Bạn biết cách xử lý vòng cuối với quản lý và phần trao đổi đãi ngộ.

#### Vì sao phải hỏi lại
Câu hỏi lại cho interviewer thấy bạn nghĩ như người sẽ chịu trách nhiệm hệ thống, và cho bạn thông tin để quyết định. Hỏi 2–3 câu có chủ đích, tránh câu trả lời có sẵn trên website.

#### Câu hỏi về kỹ thuật
- Hệ thống đang gặp vấn đề hiệu năng hoặc độ tin cậy lớn nhất ở đâu?
- Sự cố production gần nhất là gì, team xử lý và rút kinh nghiệm thế nào?
- Có SLO, on-call, postmortem không? Ai trực?
- Quy trình review và deploy: bao lâu một thay đổi lên production?

#### Câu hỏi về vai trò và team
- 6 tháng đầu, người ở vị trí này được kỳ vọng làm được gì?
- Senior ở đây khác mid ở điểm nào khi đánh giá?
- Ai ra quyết định kiến trúc, và một quyết định gần nhất được đưa ra thế nào?

#### Buổi cuối
- **Với quản lý:** chuẩn bị câu chuyện 24.6 (dẫn dắt) và 24.4 (sai lầm), vì quản lý hay hỏi cách làm việc hơn chi tiết kỹ thuật.
- **Đãi ngộ:** biết mức mong muốn và mức tối thiểu trước buổi; nói một khoảng, có lý do (phạm vi việc, thị trường).
- **Kết thúc:** tóm tắt 1–2 câu vì sao bạn hợp vị trí, dựa trên điều đã nghe trong buổi.

> **Mẹo:** Ghi lại câu trả lời của interviewer cho các câu hỏi lại. Chúng là dữ liệu để so sánh giữa các offer.

#### Câu hỏi phỏng vấn
- **"Bạn có câu hỏi gì cho chúng tôi không?"** Luôn có. Hỏi về vấn đề lớn nhất của hệ thống, sự cố gần nhất, và kỳ vọng 6 tháng đầu.
- **"Vì sao bạn muốn rời công ty hiện tại?"** Nói về điều muốn đạt tới (phạm vi hệ thống, quy mô, vai trò), không chê công ty cũ.
- **"Mức lương mong muốn của bạn là bao nhiêu?"** Đưa một khoảng có lý do, dựa trên phạm vi việc và thị trường; hỏi lại cơ cấu đãi ngộ nếu cần.
- **"Vì sao chúng tôi nên chọn bạn?"** Một câu nối kinh nghiệm thật với vấn đề họ vừa kể: ví dụ "anh/chị nói hệ thống chậm ở giờ cao điểm; tôi đã dẫn một đợt audit từ APM xuống DMV cho đúng loại vấn đề đó".

#### Tóm tắt
- Hỏi lại 2–3 câu có chủ đích: vấn đề lớn nhất, sự cố gần nhất, kỳ vọng 6 tháng.
- Vòng quản lý: chuẩn bị chuyện dẫn dắt và chuyện sai lầm.
- Đãi ngộ: nói khoảng, có lý do.
- Kết thúc bằng một câu nối kinh nghiệm thật với vấn đề của họ.

#### Bài tập
1. Viết 3 câu hỏi lại cho một công ty thương mại điện tử và 3 câu cho một công ty edtech.
   **Đáp án:** Thương mại điện tử: đỉnh tải ngày sale xử lý thế nào, idempotency thanh toán, sự cố gần nhất. Edtech: tải theo ca thi, cách chống gian lận, quy trình release trong mùa thi.
2. Viết câu kết thúc 20 giây cho một buổi mà interviewer nói hệ thống đang gặp vấn đề với báo cáo chậm.
   **Đáp án:** "Anh/chị nói báo cáo đang chậm và kéo DB chính. Tôi đã làm phần API cho warehouse báo cáo nạp incremental bằng job SQL Agent, và hiểu các bước tiếp theo nếu cần gần realtime: replica, columnstore, rồi CDC."
