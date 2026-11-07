# Phần I. Nhập môn

Giáo trình này chuẩn bị cho vòng phỏng vấn Senior Backend .NET dựa trên một CV cụ thể (`main.tex`, bản tham khảo). Mục tiêu không phải học thuộc câu trả lời, mà là nói được mọi dòng trên CV qua ba tầng câu hỏi, đồng thời không biến điều chưa làm thành điều đã làm.

Phần I giải thích cách giáo trình được tổ chức: interviewer hỏi thế nào, mỗi dòng CV đang ở trạng thái nào, cách kể chuyện và cách nói "tôi chưa làm phần này", và lịch học 4 tuần đi qua bảy Phần của sách.

## Chương 1. Cách dùng giáo trình

Chương này là "luật chơi" của cả cuốn sách. Interviewer senior không hỏi định nghĩa; họ chọn một dòng trên CV rồi đào xuống cho tới khi gặp chỗ bạn không trả lời được. Nếu chỗ đó là một con số bạn chưa từng đo, buổi phỏng vấn coi như kết thúc.

Học xong chương này, bạn biết dòng nào trên CV được kể như việc đã làm, dòng nào chỉ được nói ở mức thiết kế, và có lịch ôn cụ thể cho 4 tuần.

### Bài 1.1. Phỏng vấn 3 tầng: làm gì, làm thế nào, sao biết là đúng

#### Mục tiêu
- Sau bài này, bạn mô tả được ba tầng câu hỏi interviewer dùng để kiểm tra một dòng CV.
- Bạn chỉ ra được vì sao một dòng minh họa luôn lộ ở tầng thứ ba.
- Bạn biết mỗi dòng CV cần chuẩn bị bằng chứng gì trước buổi phỏng vấn.
- Bạn đọc được cấu trúc một bài trong giáo trình và biết mục nào dùng để làm gì.

#### Ba tầng câu hỏi

Interviewer có kinh nghiệm kiểm tra một dòng CV bằng cách hỏi sâu dần qua ba tầng:

| Tầng | Interviewer muốn biết | Câu hỏi điển hình | Bạn cần có |
|---|---|---|---|
| 1. Làm gì | Phạm vi và vai trò của bạn | "Bạn làm phần nào? Ai làm phần còn lại?" | Câu trả lời rõ "tôi" và "team" |
| 2. Làm thế nào | Cơ chế kỹ thuật, lựa chọn và đánh đổi | "Vì sao chọn cách này? Có cách nào khác?" | Hiểu cơ chế tới mức vẽ được trên bảng |
| 3. Sao biết là đúng | Bằng chứng và cách đo | "Đo bằng gì? Trong khoảng thời gian nào? So với cái gì?" | Công cụ, cửa sổ đo, số trước và sau |

Tầng 1 lọc người chỉ chép mô tả công việc của team. Tầng 2 lọc người chỉ biết tên công nghệ. Tầng 3 lọc người viết số trên CV mà không đo.

> **Ghi nhớ:** Dùng "tôi" cho phần mình làm, "team" cho phần làm chung. Nói "phần đó đồng nghiệp làm, tôi làm phần X" được đánh giá cao hơn nhận vơ rồi bị lộ ở tầng 2.

#### Ví dụ: một dòng CV đi qua ba tầng

Dòng CV về đợt audit SQL Server (Bài 3.1) là ví dụ tốt vì phần thật và phần minh họa nằm cạnh nhau.

- **Tầng 1.** "Tôi dẫn đợt audit hiệu năng trên 6 cụm SQL Server, xếp hạng điểm nóng và đề xuất cách sửa. Ba fix ngày 16/09 do đồng nghiệp commit."
- **Tầng 2.** "API bắt đầu thi thử mất 2,45 s. Trace cho thấy hàm làm mới cache gọi `SCAN` 472 vòng trên toàn keyspace Redis. Cách sửa là giữ một Redis SET làm index các key cần xóa, xóa trực tiếp từng key."
- **Tầng 3.** "Số 2,45 s và 55 ms là thời gian của một trace điển hình trước và sau fix, đọc trên Elastic APM. Trace sau fix không còn lệnh `SCAN`. Tôi chưa có p95 trên cửa sổ dài."

Câu trả lời tầng 3 ở trên trung thực nhưng lộ ra điểm yếu: CV ghi "p95". Có hai cách xử lý: bỏ chữ "p95" khỏi CV, hoặc đo p95 thật trước buổi phỏng vấn (Bài 2.1 và Bài 3.1 có cách đo).

#### Vì sao dòng minh họa lộ ở tầng 3

Một dòng minh họa có thể qua được tầng 1 (bạn nói được vai trò) và tầng 2 (bạn học kỹ cơ chế). Nhưng ở tầng 3, interviewer hỏi những thứ chỉ người làm thật mới có:

- Tên dashboard, tên metric, cửa sổ thời gian cụ thể.
- Con số trung gian: baseline trước khi sửa, các lần thử thất bại.
- Người hoặc nhóm có thể xác nhận: DBA, quản lý, đội vận hành.
- Chi tiết phụ: "lúc đó on-call là ai, alert nào kêu, mất bao lâu để rollback".

Không có các chi tiết này, câu trả lời sẽ chung chung, và interviewer hỏi tiếp cho tới khi bạn dừng.

#### Ba cách xử lý một dòng Minh họa

1. **Làm thật rồi đo**, sau đó mới giữ trên CV. Nhiều việc đã có hướng dẫn trong `cv-10-roadmap.md` (đo p95 trên APM, đo số lần gọi mỗi phút từ DMV, viết postmortem).
2. **Bỏ khỏi CV** khi nộp. Bản CV chỉ chứa số thật nằm ở commit `da5034a` của repo CV.
3. **Nói ở mức thiết kế**: "Phần này tôi chưa triển khai. Nếu làm, tôi sẽ…". Giáo trình vẫn chuẩn bị đủ kiến thức để bạn nói như vậy một cách thuyết phục.

> **Cảnh báo:** Không dùng dòng minh họa làm câu chuyện STAR. Câu chuyện hành vi luôn bị hỏi tầng 3.

#### Chuẩn bị bằng chứng cho tầng 3

Với mỗi dòng Thật hoặc Một phần, chuẩn bị trước:

- [ ] Ảnh chụp trace hoặc biểu đồ APM trước và sau (lưu cho riêng bạn, không mang tài liệu nội bộ ra ngoài).
- [ ] Kết quả query DMV có ghi thời điểm chạy và `cached_time`.
- [ ] Ngày commit và phạm vi thay đổi của chính bạn.
- [ ] Một câu nói rõ phần nào của đồng nghiệp.
- [ ] Một điều bạn sẽ làm khác nếu làm lại.

#### Cấu trúc một bài trong giáo trình

Mỗi bài bảo vệ CV (Phần II, III) có cùng khung:

- **Dòng CV** và **Trạng thái**: câu nguyên văn trên CV và mức độ thật của nó.
- **Mục tiêu**: bạn phải nói được gì sau bài.
- **Bối cảnh và việc thật đã làm**: chỉ phần có bằng chứng.
- **Kiến thức nền**: cơ chế từ gốc, có code và số, để trả lời tầng 2.
- **Cách nói trong phỏng vấn**: câu mẫu 30–60 giây, đúng vai trò.
- **Đo để biến số minh họa thành số thật**: cách lấy số cho tầng 3.
- **Bẫy**: các câu dễ nói sai.
- **Câu hỏi phỏng vấn**: câu hỏi xoáy kèm câu trả lời mẫu; mỗi câu thành một flashcard ở mục Ôn tập.
- **Tóm tắt** và **Bài tập** có đáp án ẩn.

#### Câu hỏi phỏng vấn
- **"Trong kết quả này, phần nào là của bạn và phần nào là của team?"** Tách rõ theo việc, không theo cảm giác. Ví dụ: "Tôi phân tích APM và DMV, xếp hạng điểm nóng và đề xuất cách sửa. Ba fix đầu do đồng nghiệp commit. Phần cache cho procedure cấu hình là tôi tự sửa và commit." Không dùng "chúng tôi" cho mọi thứ: interviewer sẽ hỏi lại "cụ thể bạn".
- **"Con số này bạn đo bằng công cụ gì, trong khoảng thời gian nào?"** Trả lời đủ ba ý: công cụ (Elastic APM, DMV), cửa sổ đo (một trace, 7 ngày, 1 giờ cùng khung giờ), và loại số (một request, trung bình, p95). Nếu số chỉ là một trace điển hình, nói đúng như vậy.
- **"Làm sao bạn biết thay đổi đó thật sự có tác dụng mà không phải do tải thấp hơn?"** So cùng khung giờ, cùng ngày trong tuần, ở lưu lượng tương đương; kèm số lần gọi hoặc throughput để chứng minh tải không giảm. Với trace, chỉ ra span gây chậm đã biến mất (ví dụ không còn lệnh `SCAN`), không chỉ là tổng thời gian giảm.
- **"Nếu làm lại, bạn sẽ làm khác điều gì?"** Chọn một điều thật và cụ thể. Ví dụ: "Tôi sẽ giữ cờ rollback trong config tới hết đợt live đầu tiên thay vì hard-code ngay trong ngày" (Bài 3.4). Câu trả lời "không có gì" là tín hiệu xấu.
- **"Có ai có thể xác nhận kết quả này không?"** Nêu vai trò, không cần nêu tên: DBA của cụm, quản lý trực tiếp, người review commit. Nếu không có ai xác nhận được, đó là dấu hiệu dòng này nên chuyển về trạng thái Minh họa.

#### Tóm tắt
- Interviewer hỏi ba tầng: làm gì, làm thế nào, sao biết là đúng.
- Dòng minh họa có thể qua tầng 1 và 2 nhưng luôn lộ ở tầng 3.
- Ba cách xử lý dòng minh họa: làm thật rồi đo, bỏ khỏi CV, hoặc nói ở mức thiết kế.
- Mỗi dòng thật cần bằng chứng: trace, DMV, ngày commit, phần của đồng nghiệp.
- Mục "Câu hỏi phỏng vấn" của mỗi bài là bộ flashcard để ôn.

#### Bài tập
1. Chọn dòng CV "Removed 12 cross-database stored procedures…". Viết ba câu trả lời ngắn cho ba tầng.
   **Đáp án:** Tầng 1: tôi viết lại luồng attempt (chuỗi commit 21–24/08), lớp Redis mutex và idempotency key do đồng nghiệp viết. Tầng 2: C# điều phối các lần đọc từ 3 database, một lần ghi atomic nhận danh sách câu qua table-valued parameter, kiểm tra lại quota trong transaction có `UPDLOCK, HOLDLOCK`. Tầng 3: số procedure join chéo trước (12 trên 18) và sau (0), kiểm tra bằng cách tìm tham chiếu tên 3 phần trong định nghĩa procedure.
2. Với dòng "peak-season pages fell from 14 to 2 a month", liệt kê 3 câu hỏi tầng 3 mà bạn không trả lời được nếu chưa làm.
   **Đáp án:** Ví dụ: "Hệ thống on-call nào, export số page ở đâu?"; "14 page đó là alert gì, alert nào bị xóa?"; "So mùa thi năm nào với năm nào?". Không trả lời được thì dòng này phải bỏ hoặc nói ở mức thiết kế.
3. Lập checklist bằng chứng cho dòng CV về procedure chạy 81M lần.
   **Đáp án:** Kết quả DMV ghi `execution_count`, `cached_time`, thời điểm chụp; ngày commit 21/09; hai nguyên nhân gốc trong code (TTL 1 giây, list rỗng bị coi là miss); kết quả đo `execution_count` hai lần cách nhau 1 giờ sau fix nếu đã đo.

### Bài 1.2. Ba trạng thái Thật, Một phần, Minh họa

#### Mục tiêu
- Sau bài này, bạn phân loại được mọi dòng trên CV vào một trong ba trạng thái.
- Bạn biết với mỗi trạng thái được phép nói gì và không được nói gì.
- Bạn tra được dòng CV nào được bảo vệ ở Phần nào của giáo trình.

#### Định nghĩa ba trạng thái

- **Thật**: có bằng chứng (commit, báo cáo, hoặc bạn đã xác nhận). Kể như việc đã làm, dùng được cho STAR.
- **Một phần**: cốt lõi thật, nhưng con số hoặc phạm vi là minh họa. Kể phần thật, tách bạch phần số chưa đo.
- **Minh họa**: chưa làm. Chỉ có ba cách: làm thật rồi đo, bỏ khỏi CV, hoặc nói ở mức thiết kế.

`main.tex` hiện là bản tham khảo: nhiều bullet và số liệu được viết để minh họa một CV senior và chưa xảy ra thật. Bảng dưới đây là nguồn chuẩn cho trạng thái của mọi bài bảo vệ CV trong giáo trình.

#### Bảng trạng thái từng dòng CV

| # | Dòng CV (rút gọn) | Trạng thái | Phần thật | Phần minh họa |
|---|---|---|---|---|
| S | Summary: "exam-start p95 2.45 s → 55 ms" | Một phần | 2,45 s → 55 ms lấy từ trace APM trước và sau | Chữ "p95": chưa đo p95 |
| 1 | Audit 6 cụm SQL Server, exam-start 2,45 s → 55 ms | Một phần | Bạn dẫn audit và đề xuất fix; đồng nghiệp commit fix | Chữ "p95" |
| 2 | Postmortem, SLO, OpenTelemetry, Grafana, page 14 → 2 | Minh họa | — | Toàn bộ |
| 3 | Hotfix trong ngày + index ca đêm với DBA, CPU 78% → 41% | Một phần | Kế hoạch 2 tầng trong báo cáo | CPU; index ca đêm có thể chưa chạy |
| 4 | Proc cấu hình chạy 81M lần, gọi 9.400 → 40 lần/phút | Một phần | Nguyên nhân và cách sửa (commit 21/09) | Số lần gọi mỗi phút |
| 5 | Lua CAS + applock, kết quả trùng ~1,2K/ngày → 0 | Một phần | Applock insert-once (Here I Come); Lua CAS là lớp có sẵn | Số bản ghi trùng |
| 6 | Bỏ 12 stored procedure join chéo database | Thật | Chuỗi commit V3 ngày 21–24/08 | — |
| 7 | Polly, rate limit ở YARP, 99,9% khi service phía sau sập | Minh họa | — | Toàn bộ |
| 8 | xUnit + Testcontainers làm merge gate, lỗi lọt 9 → 2 | Minh họa | Có harness chạy trên SQL fixture | Testcontainers, gate, số liệu |
| 9 | Design doc CDC → ClickHouse, PoC p95 180 ms | Minh họa | Warehouse dùng SQL Agent là thật | Toàn bộ |
| 10 | SSO thống nhất 4 sản phẩm, ticket −35% | Một phần | Hardening BFF; SSO cho IOE web và IOSTEM | "4 products", số ticket |
| 11 | Leaderboard IOM, 10K người chơi, p95 < 150 ms | Một phần | Bạn code toàn bộ luồng | 10K (ước lượng), 150 ms |
| 12 | AI nháp ~35K trường, đúng 94%, duyệt 6 → 1,5 phút | Một phần | Luồng so bản AI với bản lưu (commit 13/10) | 94%, thời gian duyệt |
| 13 | Nâng ~70 project, 12 service lên .NET 10 | Thật | Commit 30/07 | Đếm lại số service |
| 14 | Mentor 2 người, knowledge base, PR đầu tiên 4 tuần → 10 ngày | Một phần | Knowledge base (AI soạn nháp, bạn review) | Mentor, số ngày |
| 15 | Skill Claude Code và MCP server, dựng sự kiện 3 → 1 ngày | Một phần | Skill `ioe-event`, `upgrade-net10-consumer` | "Built MCP servers" nếu chỉ cấu hình; số ngày |
| 16 | Dẫn team 8 người tới kỳ thi 3.000+ thí sinh | Thật | Bạn đã xác nhận | "Scrum", "sprint planning" nếu team không chạy Scrum |
| 17 | MediaSoup SFU, 6 SFU worker | Một phần | SFU thay cho mesh | Số worker |
| 18 | AI chống gian lận ngoài luồng video, 2 khung/s, < 300 ms | Một phần | Có tích hợp AI chống gian lận | Các thông số |
| 19 | k6 giả lập 5.000 thí sinh, bắt 3 lỗi năng lực | Minh họa | — | Toàn bộ |
| 20 | GitOps trên Azure AKS, deploy hằng ngày | Một phần | Docker, Helm, Terraform, GitLab CI, Argo CD | Azure/AKS, tần suất deploy |
| 21 | Sửa 14 lỗi pentest (OWASP) | Minh họa | — | Toàn bộ |
| 22 | Team từ 4 lên 8 người, 20+ buổi phỏng vấn, 2 người lên mid | Minh họa | — | Toàn bộ |
| 23 | Vận hành ngày thi, 40+ kỳ thi | Minh họa | — | Toàn bộ |
| 24 | Tách monolith thành 9 microservice theo DDD, strangler | Một phần | Migrate sang .NET với CQRS và RabbitMQ | 9 service, DDD, strangler |
| 25 | PostgreSQL replica, shard MongoDB theo tenant, ghi 900 → 120 ms | Một phần | Replication và sharding | Số liệu, shard key |
| 26 | Outbox, saga, hết đăng ký trùng | Minh họa | Chuyển tích hợp đồng bộ sang bất đồng bộ | Outbox, saga |

Thống kê: 26 dòng kinh nghiệm cộng dòng Summary. Có 3 dòng Thật (6, 13, 16), 15 dòng Một phần, 9 dòng Minh họa (2, 7, 8, 9, 19, 21, 22, 23, 26).

#### Mỗi trạng thái nói thế nào

**Thật.** Kể đầy đủ, dùng làm câu chuyện STAR. Vẫn phải tách phần của đồng nghiệp. Ví dụ dòng 6: lớp Redis mutex và idempotency key phía trên do đồng nghiệp viết.

**Một phần.** Nói phần thật trước, sau đó nói rõ loại số đang có. Mẫu câu: "Nguyên nhân và cách sửa là của tôi. Số trên CV là [trace điển hình / ước lượng]; số đo chính thức tôi có là [X], hoặc tôi chưa đo [Y]." Không để interviewer tự phát hiện.

**Minh họa.** Không kể như việc đã làm. Nếu dòng vẫn còn trên CV và bị hỏi, chỉ có một câu an toàn: "Phần này tôi chưa triển khai ở production. Nếu làm, tôi sẽ…", rồi trả lời bằng kiến thức trong bài tương ứng. Cách tốt hơn là sửa CV trước khi nộp.

> **Cảnh báo:** Nói "tôi chưa triển khai" về một dòng đang ghi trên CV vẫn gây mất điểm. Dòng Minh họa nên được làm thật hoặc bỏ trước khi nộp; nói ở mức thiết kế là phương án cuối.

#### Dòng nào nằm ở đâu trong giáo trình

| Dòng | Bài |
|---|---|
| S | Bài 2.1 |
| Summary "high availability", dòng Platform | Bài 2.2 |
| 1 | Bài 3.1 |
| 3 | Bài 3.2 |
| 4 | Bài 3.3 |
| 6 | Bài 3.4 |
| 5 | Bài 4.1 |
| 7 | Bài 4.2 |
| 8 | Bài 4.3 |
| 2 | Bài 4.4 |
| 9–15 | Phần II, Chương 5–6 |
| 16–26 | Phần III, Chương 7–8 |
| Mục Skills | Phần IV, Chương 9–14 |

#### Bẫy

- Đọc bảng xong vẫn kể dòng Một phần bằng con số minh họa vì "nghe hay hơn". Interviewer chỉ cần hỏi "đo ở đâu" là đủ.
- Tự nâng trạng thái khi chưa có bằng chứng mới. Trạng thái chỉ đổi khi bạn đã đo hoặc đã làm.
- Coi "Một phần" là an toàn và kể dài phần minh họa. Phần minh họa nói càng ít càng tốt, và luôn gắn nhãn.

#### Câu hỏi phỏng vấn
- **"CV ghi p95, nhưng bạn vừa nói đó là một trace. Vậy CV có chính xác không?"** Nhận ngay: "Chữ p95 trên CV chưa chính xác. Số 2,45 s và 55 ms là thời gian một trace điển hình trước và sau fix. Tôi sẽ sửa CV hoặc gửi lại số p95 đo trên 7 ngày trước và sau." Không biện minh, không đổi chủ đề.
- **"Con số này là bạn đo hay ước lượng?"** Trả lời đúng loại số theo bảng trạng thái. Ví dụ dòng 11: "10K người chơi là ước lượng của tôi, chưa có số đo từ monitoring." Nếu là ước lượng, nói cách ước lượng.
- **"Dòng nào trên CV bạn tự tin nhất, dòng nào bạn ít tự tin nhất?"** Tự tin nhất: một dòng Thật có bằng chứng, ví dụ bỏ 12 procedure join chéo database. Ít tự tin nhất: chọn một dòng Một phần và nói rõ phần nào chưa đo. Câu trả lời trung thực ở đây làm tăng độ tin cho các dòng còn lại.
- **"Tôi muốn nghe về dòng [một dòng Minh họa]. Bạn kể chi tiết được không?"** "Phần này tôi chưa triển khai ở production. Tôi có thể trình bày cách tôi sẽ thiết kế và đo nó." Sau đó trả lời theo kiến thức nền của bài tương ứng. Không bịa timeline, không bịa người tham gia.

#### Tóm tắt
- Thật: có bằng chứng; Một phần: cốt lõi thật, số hoặc phạm vi minh họa; Minh họa: chưa làm.
- Bảng trạng thái là nguồn chuẩn; mọi bài bảo vệ CV ghi trạng thái theo bảng này.
- Hiện có 3 dòng Thật, 15 dòng Một phần, 9 dòng Minh họa.
- Dòng Một phần: nói phần thật trước, gắn nhãn phần số chưa đo.
- Dòng Minh họa: làm thật, bỏ, hoặc nói ở mức thiết kế; không dùng cho STAR.

#### Bài tập
1. Viết lại dòng 4 sao cho chỉ còn phần Thật.
   **Đáp án:** Ví dụ: "Traced a configuration procedure run 81M times (cumulative DMV count) to a 1 s TTL and never-cached empty results, and fixed both with no new infrastructure." Bỏ "9,400 to 40 a minute" cho tới khi đo được.
2. Phân loại câu sau theo ba trạng thái, giả sử bạn đã code toàn bộ nhưng chưa đo tải: "Built real-time leaderboards serving 10K concurrent players with p95 under 150 ms."
   **Đáp án:** Một phần. Luồng là thật; 10K là ước lượng; p95 150 ms chưa đo. Câu chỉ còn phần thật: "Built real-time leaderboards end to end: Kafka score events feed Redis sorted sets."
3. Đếm trong bảng: có bao nhiêu dòng mà toàn bộ nội dung là minh họa, và bạn chọn cách xử lý nào cho từng dòng?
   **Đáp án:** 9 dòng (2, 7, 8, 9, 19, 21, 22, 23, 26). Cách xử lý tùy bạn; gợi ý: dòng 2 và 9 có lộ trình làm thật trong `cv-10-roadmap.md` (postmortem, PoC CDC); các dòng AvePoint 19, 21, 22, 23 không còn làm thật được nên bỏ nếu không có ký ức và bằng chứng.

### Bài 1.3. Kể chuyện STAR và cách nói "tôi chưa làm phần này"

#### Mục tiêu
- Sau bài này, bạn kể được một câu chuyện kỹ thuật theo STAR trong tối đa 2 phút.
- Bạn chọn đúng câu chuyện thật cho từng câu hỏi hành vi hay gặp.
- Bạn có sẵn các mẫu câu để nói "phần đó không phải tôi làm" hoặc "tôi chưa làm" mà không mất điểm.

#### Cấu trúc STAR

STAR là khung kể chuyện cho câu hỏi hành vi ("Kể về một lần bạn…"):

| Phần | Nội dung | Tỉ lệ thời gian |
|---|---|---|
| Situation | Bối cảnh: hệ thống gì, quy mô, chuyện gì xảy ra (1–2 câu) | ~15% |
| Task | Nhiệm vụ của riêng bạn | ~10% |
| Action | Bạn đã làm gì, theo thứ tự, dùng "tôi"; đây là phần dài nhất | ~55% |
| Result | Kết quả có số, và bài học | ~20% |

Ba lỗi thường gặp: kể Situation quá dài; Action dùng "chúng tôi" từ đầu đến cuối; Result không có số hoặc có số không đo.

#### Ví dụ STAR từ câu chuyện thật: procedure chạy 81 triệu lần

Câu chuyện này là thật (mục 4.1 của nguồn, commit 21/09), nên dùng được cho câu hỏi "Kể về một vấn đề bạn tự phát hiện".

> **Ví dụ:** **S:** Trong đợt rà soát DMV tháng 09, tôi thấy một procedure lấy danh mục môn và vòng thi chạy khoảng 81 triệu lần, mỗi lần 3,7 ms và 244 logical reads, cộng dồn khoảng 19,8 tỷ reads. Đây là dữ liệu cấu hình, gần như không đổi trong ngày. **T:** Tôi muốn biết vì sao dữ liệu ít đổi lại bị đọc nhiều như vậy dù đã có cache. **A:** Tôi đọc code lớp cache và tìm ra hai lỗi. Thứ nhất, TTL dùng chung một biến có giá trị 1 giây, nên cache gần như vô dụng. Thứ hai, code coi list rỗng là cache miss, nên các tổ hợp không có cấu hình luôn gọi xuống DB. Tôi đổi sang key mới lưu JSON, quy ước `null` là chưa có cache và list rỗng là đã cache kết quả rỗng, đặt TTL 6 giờ và thêm hàm xóa cache để CMS gọi khi cấu hình đổi. **R:** Không thêm hạ tầng mới. Tôi theo dõi hiệu quả qua tốc độ tăng của `execution_count` trong DMV. Bài học: negative caching phải được thiết kế rõ, nếu không phần "không có dữ liệu" sẽ luôn đi xuống DB.

Lưu ý phần Result: không nói "giảm từ 9.400 xuống 40 lần/phút" vì số đó là minh họa. Nếu đã đo theo Bài 3.3 thì thay bằng số đo được.

#### Câu chuyện thật cho các câu hỏi hành vi

| Câu hỏi | Câu chuyện thật nên dùng | Bài |
|---|---|---|
| Sự cố production lớn nhất | Đợt audit APM tháng 09/2026 và API bắt đầu thi 2,45 s | Bài 3.1 |
| Quyết định kỹ thuật bạn phải bảo vệ | Không đặt deadline cho gRPC gửi event; không đánh index trên bảng log ghi liên tục | Bài 4.2, Bài 3.1 |
| Một lần bạn sai | Hard-code cờ V3 quá sớm; commit cache-control bị revert trong ngày | Bài 3.4 |
| Làm việc với team khác khi bất đồng | Kế hoạch hotfix ngày và index ca đêm với DBA | Bài 3.2 |
| Dẫn dắt team | Examena: một quyết định thiết kế, một lần chia lại việc, một PR đã chặn lại | Phần III |
| Dùng AI thế nào, không tin AI ở đâu | Claude Code có review từng diff, build thật, chạy trên DB dev | Phần II, Chương 5–6 |
| Tự tìm ra vấn đề không ai giao | Hai lỗi cache khiến procedure chạy 81M lần | Bài 3.3 |

Mỗi câu chuyện tối đa 2 phút khi nói thành tiếng. Viết sẵn dàn ý 5 dòng cho từng câu, không viết nguyên văn để học thuộc.

#### Nói "tôi chưa làm phần này"

Có bốn tình huống và bốn mẫu câu:

1. **Đồng nghiệp làm.** "Phần đó đồng nghiệp của tôi làm. Tôi làm phần X, và tôi hiểu phần đó chạy thế này…" Sau đó giải thích cơ chế ở mức bạn chắc chắn.
2. **Chưa ai làm, bạn biết cách làm.** "Phần này chúng tôi chưa triển khai. Theo best practice, tôi sẽ làm thế này, và đo bằng cách này…" Nói rõ "theo best practice".
3. **Không nhớ số chính xác.** "Tôi không nhớ chính xác con số, tôi không muốn đoán. Thứ tự độ lớn là khoảng X, và đây là cách tôi lấy lại số đó." Chỉ nói thứ tự độ lớn khi bạn chắc chắn.
4. **Bạn đã sai.** "Lúc đó tôi quyết định X. Kết quả là Y. Nếu làm lại tôi sẽ Z." Ví dụ thật: hard-code cờ rollback V3 ngay trong ngày 24/08.

> **Mẹo:** Sau câu "tôi chưa làm", luôn nối bằng một câu chứng minh bạn hiểu vấn đề. Câu "chưa làm" đứng một mình là điểm trừ; đi kèm một thiết kế đúng thì thành điểm cộng.

#### Bẫy

- Kể câu chuyện dựa trên dòng Minh họa. Câu hỏi hành vi luôn đi tới tầng 3.
- Chuyển "tôi" thành "chúng tôi" ở đoạn khó để tránh trách nhiệm. Interviewer nhận ra ngay.
- Kể "một lần bạn sai" bằng một lỗi không phải lỗi ("tôi quá cầu toàn"). Chọn lỗi thật, có hậu quả nhỏ và có bài học.
- Nói "theo best practice" nhưng không nêu được best practice của ai: tài liệu Microsoft, SRE Workbook, tài liệu Redis.

#### Câu hỏi phỏng vấn
- **"Kể về sự cố hoặc vấn đề hiệu năng lớn nhất bạn đã xử lý?"** Dùng đợt audit tháng 09/2026. S: API bắt đầu thi thử mất 2,45 s trên trace. T: tôi dẫn đợt rà soát trên 6 cụm SQL Server. A: APM → DMV → đọc code; tìm ra `SCAN` 472 vòng trên Redis; xếp hạng các điểm nóng khác. R: sau fix (đồng nghiệp commit), trace còn 55 ms và không còn `SCAN`. Nói rõ vai trò và loại số.
- **"Kể một lần bạn sai và bạn sửa thế nào?"** Cờ V3: lúc rollout có cờ đọc từ config để quay về đường cũ, nhưng tôi hard-code thành `true` ngay trong ngày 24/08 để bỏ nhánh cấu hình. Hệ quả: muốn rollback phải deploy lại. Bài học: giữ cờ trong config tới hết đợt live đầu tiên.
- **"Kể một quyết định kỹ thuật bạn phải bảo vệ trước người khác?"** Không đặt deadline cho lời gọi gRPC gửi event: service nhận có lúc chậm tới 3,6 s; đặt deadline sẽ làm rơi event, tức đổi hành vi nghiệp vụ; lời gọi đã chạy nền nên request không bị giữ. Hoặc: không đánh thêm index trên bảng log ghi liên tục vì WRITELOG đã cao.
- **"Bạn dùng AI trong công việc thế nào, và không tin AI ở chỗ nào?"** Dùng Claude Code sinh nháp theo plan từng pha; tôi đọc từng diff, build trên máy thật, chạy với DB dev. Không tin AI ở: tên cột và tên procedure (dễ bịa), logic đồng thời và transaction, số liệu. Tài liệu knowledge base do AI soạn nháp, tôi review.
- **"Nếu tôi hỏi sâu vào một phần bạn không làm, bạn sẽ trả lời thế nào?"** "Tôi nói rõ phần đó ai làm, rồi giải thích ở mức tôi hiểu, và nói phần nào tôi không chắc." Đây là câu hỏi kiểm tra tính trung thực; trả lời bằng một ví dụ thật, như lớp Redis mutex trong luồng attempt do đồng nghiệp viết.

#### Tóm tắt
- STAR: Situation ngắn, Action dài nhất và dùng "tôi", Result có số đo thật.
- Mỗi câu hỏi hành vi hay gặp đã có một câu chuyện thật tương ứng.
- Bốn mẫu câu cho bốn tình huống: đồng nghiệp làm, chưa ai làm, không nhớ số, bạn đã sai.
- "Chưa làm" phải đi kèm một thiết kế đúng hoặc một cách đo.
- Mỗi câu chuyện tối đa 2 phút.

#### Bài tập
1. Viết dàn ý STAR 5 dòng cho câu hỏi "Kể một lần bạn làm việc với team khác khi có bất đồng" dựa trên kế hoạch hotfix ngày và index ca đêm.
   **Đáp án:** S: bảng thiếu index, server chạy Standard Edition nên `CREATE INDEX` khóa bảng. T: đưa ra kế hoạch sửa không làm gián đoạn giờ thi. A: tách hai tầng; sửa procedure bằng `ALTER PROCEDURE` trong ngày; index giao DBA chạy ca 23h–05h; thống nhất thứ tự ưu tiên. R: chỉ nói kết quả có thật (ví dụ procedure đã sửa); nói đúng trạng thái index ca đêm.
2. Viết lại câu sau cho trung thực: "Chúng tôi giảm page từ 14 xuống 2 nhờ SLO và burn-rate alert."
   **Đáp án:** "Phần này tôi chưa triển khai. Nếu làm, tôi sẽ đặt SLO theo tỉ lệ request tốt cho các API thi, page theo burn rate nhiều cửa sổ, chuyển alert không cần xử lý ngay thành ticket, và đo số page mỗi tháng so cùng mùa thi."
3. Nói thành tiếng câu chuyện STAR về procedure 81 triệu lần, bấm giờ. Ghi lại thời gian và các chỗ bị vấp.
   **Đáp án:** Mục tiêu dưới 2 phút. Nếu quá, cắt phần Situation; giữ nguyên hai nguyên nhân gốc và cách sửa.

### Bài 1.4. Lộ trình học 4 tuần với giáo trình này

#### Mục tiêu
- Sau bài này, bạn có lịch học 4 tuần đi qua bảy Phần của giáo trình.
- Bạn biết thứ tự ưu tiên: dòng CV trước, kiến thức nền sau.
- Bạn dùng được mục Ôn tập theo nguyên tắc lặp lại ngắt quãng.

#### Bản đồ giáo trình

| Phần | Chương | Nội dung | Mức ưu tiên |
|---|---|---|---|
| I. Nhập môn | 1 | Luật chơi, bảng trạng thái, STAR, lộ trình | Đọc đầu tiên |
| II. Bảo vệ CV: VTC Online | 2–6 | Từng dòng CV ở VTC Online | Cao nhất: bị hỏi chắc chắn |
| III. Bảo vệ CV: AvePoint | 7–8 | Examena, IAS 2.0 | Cao: chủ yếu nói ở mức thiết kế |
| IV. Kiến thức nền theo keyword | 9–14 | Mỗi keyword trong mục Skills | Trung bình: hỏi lan từ CV |
| V. System design | 15–16 | Các bài thiết kế hay gặp | Cao với vòng system design |
| VI. Tối ưu SQL Server | 17–23 | Đo, DMV, wait, plan, index, locking | Cao: CV xoay quanh SQL |
| VII. Hành vi và chuẩn bị cuối | 24–25 | Câu hỏi hành vi, checklist trước buổi phỏng vấn | Tuần cuối |

Nguyên tắc ưu tiên: dòng Thật và Một phần trước, dòng Minh họa sau; cơ chế trước, thuộc lòng sau.

#### Lịch 4 tuần

Giả định khoảng 2 giờ mỗi ngày trong tuần và 4 giờ mỗi ngày cuối tuần. Từ ngày thứ 2 trở đi, mỗi ngày dành 15–20 phút đầu cho mục Ôn tập.

**Tuần 1: Phần I và Phần II.**

| Ngày | Việc |
|---|---|
| 1 | Chương 1. Đánh dấu dòng nào trên CV bạn sẽ giữ, sửa hay bỏ |
| 2 | Chương 2 (Summary, quy mô, HA) |
| 3 | Chương 3, Bài 3.1–3.2 |
| 4 | Chương 3, Bài 3.3–3.4 |
| 5 | Chương 4 |
| 6–7 | Chương 5–6; nói thành tiếng mọi câu hỏi của Phần II |

Song song trong tuần 1, thu số thật (mỗi việc dưới 1 giờ):

- [ ] p95 và p99 của API bắt đầu thi thử, 7 ngày trước và sau 16/09 (Bài 3.1).
- [ ] Số lần gọi mỗi phút của procedure cấu hình và procedure gói cước (Bài 3.3).
- [ ] Đếm cặp (user, vòng) bị trùng kết quả theo ngày (Bài 4.1).
- [ ] Xác nhận DBA đã đánh index ca đêm hay chưa, và ai viết lại các procedure trong mục 4.4 (Bài 3.2).

**Tuần 2: Phần III và Phần IV.**

| Ngày | Việc |
|---|---|
| 1–2 | Chương 7–8 (AvePoint) |
| 3–5 | Chương 9–14, mỗi keyword nói được trong 30 giây |
| 6–7 | Ôn lại Phần II; sửa CV theo những gì đã đo được ở tuần 1 |

**Tuần 3: Phần VI (Tối ưu SQL Server).**

| Ngày | Việc |
|---|---|
| 1–5 | Chương 17–23, mỗi ngày 1–2 chương; chạy các query DMV trên DB dev |
| 6–7 | Viết lại trên giấy các query DMV và plan cơ bản; ôn tập Phần II |

**Tuần 4: Phần V, Phần VII và phỏng vấn thử.**

| Ngày | Việc |
|---|---|
| 1–2 | Chương 15–16; làm một bài thiết kế trên giấy trong 40 phút |
| 3 | Chương 24: dàn ý STAR cho mọi câu chuyện thật |
| 4 | Chương 25: checklist cuối |
| 5–6 | Hai buổi phỏng vấn thử, mỗi buổi 60 phút |
| 7 | Chỉ ôn thẻ bị đánh dấu quên; nghỉ |

#### Ôn tập bằng flashcard lặp lại ngắt quãng

Mọi câu trong mục "Câu hỏi phỏng vấn" của mỗi bài trở thành một thẻ ở mục Ôn tập: mặt trước là câu hỏi, mặt sau là câu trả lời mẫu.

**Vì sao lặp lại ngắt quãng.** Trí nhớ suy giảm nhanh sau khi học; mỗi lần nhớ lại thành công ngay trước khi quên thì khoảng thời gian tới lần quên tiếp theo dài ra. Vì vậy ôn theo khoảng cách tăng dần hiệu quả hơn đọc lại nhiều lần trong một ngày. Việc *tự nhớ lại* (active recall) quan trọng hơn việc đọc lại đáp án.

**Cách dùng:**

1. Đọc câu hỏi, **trả lời thành tiếng** trước khi lật thẻ. Bấm giờ: mục tiêu 30–60 giây.
2. Lật thẻ, so với câu trả lời mẫu. Tự chấm theo ba mức: quên, nhớ một phần, nhớ chắc.
3. Thẻ quên: ôn lại ngay trong buổi và vào ngày hôm sau. Thẻ nhớ một phần: ôn lại sau 2–3 ngày. Thẻ nhớ chắc: giãn khoảng cách theo chuỗi gần đúng 1 → 3 → 7 → 14 ngày.
4. Mỗi ngày chỉ thêm thẻ của các bài đã học xong; không mở thẻ của bài chưa đọc.

> **Mẹo:** Khi tự chấm, "nhớ chắc" nghĩa là nói được cả cơ chế lẫn con số đúng phạm vi. Nhớ được ý nhưng dùng sai loại số (ví dụ gọi trace điển hình là p95) thì chấm "nhớ một phần".

#### Phỏng vấn thử

- Nhờ một người đọc CV và hỏi tự do, không theo thứ tự giáo trình.
- Yêu cầu người hỏi đào tới tầng 3 ở ít nhất 3 dòng.
- Ghi âm; nghe lại các chỗ dùng "chúng tôi" thay cho "tôi", và các chỗ nói số mà không nêu nguồn.

#### Câu hỏi phỏng vấn
- **"Bạn đã chuẩn bị cho buổi phỏng vấn này thế nào?"** Trả lời cụ thể và ngắn: rà lại từng dòng CV, đo lại các số liệu chính (nêu số nào đã đo), ôn lại SQL Server và system design. Không cần nhắc tới giáo trình.
- **"Gần đây bạn học thêm điều gì về kỹ thuật, và bạn áp dụng nó ở đâu?"** Chọn một chủ đề gắn với việc thật, ví dụ đọc execution plan và DMV trong đợt audit, hoặc .NET 10 trong đợt nâng cấp. Nêu một điều cụ thể đã học và nơi đã dùng.
- **"Điểm yếu kỹ thuật lớn nhất của bạn hiện nay là gì?"** Chọn điểm yếu thật và có kế hoạch. Ví dụ: kinh nghiệm viết test tự động còn ít (codebase hiện tại chủ yếu test tay trên dev, có một integration harness trên SQL fixture); kế hoạch là thêm integration test cho procedure và contract test cho API.
- **"Bạn tự đánh giá mình ở mức senior chưa, vì sao?"** Nêu bằng chứng thay vì tự nhận: dẫn một đợt audit hiệu năng, tự tìm và sửa lỗi cache gốc, thiết kế lại luồng attempt không join chéo DB. Thừa nhận khoảng trống (chức danh hiện tại là Backend Engineer, cần thêm kinh nghiệm SRE) và cách đang lấp.

#### Tóm tắt
- Tuần 1: Phần I–II và thu số thật; tuần 2: Phần III–IV; tuần 3: Phần VI; tuần 4: Phần V, VII và phỏng vấn thử.
- Dòng CV được ưu tiên trước kiến thức nền.
- Mỗi ngày 15–20 phút ôn flashcard, trả lời thành tiếng trước khi lật thẻ.
- Khoảng ôn tăng dần: thẻ quên ôn lại hôm sau, thẻ nhớ chắc giãn 1 → 3 → 7 → 14 ngày.
- Phỏng vấn thử phải đào tới tầng 3.

#### Bài tập
1. Điền lịch 4 tuần vào lịch cá nhân, ghi rõ ngày bắt đầu và ngày phỏng vấn dự kiến.
   **Đáp án:** Nếu còn ít hơn 4 tuần, giữ Phần II và Phần VI, rút gọn Phần IV xuống các keyword có trên CV.
2. Sau khi học xong Chương 3, chọn 10 thẻ, trả lời thành tiếng và tự chấm. Ghi số thẻ ở mỗi mức.
   **Đáp án:** Nếu hơn 3 thẻ ở mức "quên", đọc lại mục Kiến thức nền của các bài đó trước khi học chương mới.
3. Liệt kê 4 số liệu bạn sẽ đo trong tuần 1 và nơi lấy từng số.
   **Đáp án:** p95/p99 API bắt đầu thi (Elastic APM); số lần gọi mỗi phút của hai procedure đã cache (`sys.dm_exec_procedure_stats`, chụp hai lần cách nhau 1 giờ); số cặp kết quả trùng theo ngày (query trên bảng kết quả); trạng thái index ca đêm (hỏi DBA, kiểm tra index có tồn tại trong `sys.indexes` và có được dùng trong `sys.dm_db_index_usage_stats`).
