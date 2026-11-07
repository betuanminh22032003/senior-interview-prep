# Phần VII. Hành vi và chuẩn bị cuối

Vòng hành vi không hỏi bạn biết gì, mà hỏi bạn đã làm gì và làm như thế nào: xử lý một hệ thống chậm, bảo vệ một quyết định, nhận một lần sai, làm việc với team khác, dẫn dắt người khác. Người phỏng vấn senior thường hỏi xuống từng tầng cho tới khi chạm phần chi tiết chỉ người làm thật mới biết. Vì vậy phần này chỉ dùng chuyện có thật, nói đúng phần của mình, và chừa chỗ trống `[điền ...]` ở nơi chưa có sự kiện để bạn tự điền bằng trí nhớ thật trước buổi phỏng vấn, thay vì kể bừa cho tròn.

Chương 24 chuẩn bị sẵn từng câu chuyện: người hỏi muốn đánh giá điều gì, kể thế nào cho tự nhiên, và họ sẽ vặn ở đâu. Chương 25 là danh sách việc cần làm trước buổi phỏng vấn và cách dùng mấy phút cuối buổi.

## Chương 24. Câu hỏi hành vi

Mỗi câu hỏi hành vi là một cơ hội chứng minh một năng lực bằng sự kiện thay vì bằng tính từ. "Tôi là người chủ động" không có giá trị; "tôi thấy một procedure dữ liệu cấu hình mà chạy hàng chục triệu lần, tự đọc code tìm ra lỗi cache và sửa" thì có.

Chương này có bảy câu chuyện thật, mỗi câu kể được trong khoảng hai phút. Với mỗi câu, bạn sẽ biết người hỏi đang chấm điểm năng lực nào, họ sẽ đào tiếp ở đâu, và chỗ nào phải nói rõ "phần đó đồng nghiệp làm" hoặc "phần đó mới là đề xuất".

### Bài 24.1. Kể chuyện theo STAR trong hai phút

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
Câu hỏi hành vi dựa trên một giả định đơn giản: cách bạn đã xử lý tình huống trong quá khứ là dự báo tốt nhất cho cách bạn sẽ xử lý ở chỗ mới. Với vị trí senior, người hỏi nghe bốn thứ:

- **Phạm vi:** bạn xử lý vấn đề của một hàm, một service hay cả hệ thống; bạn có phải phối hợp với người ngoài team không.
- **Cách nghĩ:** bạn đo trước khi sửa không, có cân nhắc nhiều phương án không, có nói được mình đánh đổi cái gì không.
- **Sở hữu (ownership):** bạn tự nhận việc, tự nhận sai, và theo việc tới khi có kết quả, hay dừng ở "tôi đã báo rồi".
- **Trung thực về vai trò:** bạn tách được phần mình làm với phần team làm.

Câu chuyện hay nhưng không trả lời đúng năng lực họ đang hỏi vẫn mất điểm. Trước khi kể, tự hỏi một câu: "Câu này đang hỏi về năng lực gì?"

##### Khung STAR
STAR là bộ khung để người kể không lạc, không phải thứ đọc to lên.

| Phần | Nội dung | Thời lượng |
|---|---|---|
| S (Situation, bối cảnh) | Hệ thống gì, chuyện gì xảy ra, một câu người ngoài hiểu ngay | ~15 giây |
| T (Task, nhiệm vụ) | Việc của bạn là gì, khác việc của team ở đâu | ~10 giây |
| A (Action, hành động) | Bạn làm gì, theo thứ tự nào, vì sao chọn cách đó, bỏ cách nào | 60–70 giây |
| R (Result, kết quả) | Kết quả đo bằng gì, so với gì, cộng một câu bài học | 25–30 giây |

Nói tiếng Việt khoảng 130–160 từ mỗi phút, nên hai phút là khoảng 260–320 từ. Lỗi phổ biến nhất là bối cảnh dài một phút, còn phần hành động chỉ một câu. Phần hành động mới là nơi chứng minh năng lực.

##### Ba tầng câu hỏi
Sau câu chuyện, người hỏi gần như luôn đào xuống ba tầng:

1. **Làm gì:** "Cụ thể anh sửa cái gì?"
2. **Làm thế nào:** "Sao anh biết nguyên nhân là ở đó? Anh dùng công cụ gì?"
3. **Sao biết là đúng:** "Đo trước và sau thế nào? Có tác dụng phụ không?"

Người kể chuyện vay mượn thường gãy ở tầng hai. Mỗi câu chuyện trong chương này đều chuẩn bị sẵn cả ba tầng.

##### Bảng chọn câu chuyện

| Loại câu hỏi | Câu chuyện | Bài |
|---|---|---|
| Sự cố, hệ thống chậm, tìm nguyên nhân | Đợt rà soát hiệu năng tháng 09/2026, màn bắt đầu thi thử chậm vì Redis quét toàn bộ key | 24.2 |
| Quyết định phải bảo vệ, không theo best practice | Không đặt deadline cho lời gọi gRPC gửi event; không đánh index bảng log ghi liên tục | 24.3 |
| Một lần bạn sai | Gỡ công tắc rollback quá sớm khi viết lại luồng làm bài | 24.4 |
| Bất đồng, xung đột ưu tiên với team khác | Kế hoạch hai tầng với DBA: sửa procedure ban ngày, đánh index ban đêm | 24.5 |
| Dẫn dắt team | Team Lead Examena, team 8 người | 24.6 |
| Dùng AI | Quy trình dùng Claude Code có kiểm soát | 24.7 |
| Chủ động, tự tìm ra vấn đề | Procedure dữ liệu cấu hình chạy hàng chục triệu lần vì hai lỗi cache | 24.8 |

Một câu chuyện có thể trả lời nhiều câu hỏi; chỉ cần đổi phần nhấn mạnh.

##### Con số trong câu chuyện
Người nghe không có CV trước mặt. Một con số chỉ có giá trị khi đi kèm ba thông tin: đo cái gì, đo bằng gì, so với gì. Mỗi câu chuyện dùng tối đa một hai con số, làm tròn, nói bằng lời. Phân biệt rõ ba loại số:

- **Trace điển hình:** thời gian của một request cụ thể trên APM, trước và sau khi sửa. Không gọi là p95.
- **Số cộng dồn trong DMV:** số lần chạy, tổng logical reads kể từ khi plan được cache. Không phải "số lần đã loại bỏ".
- **Mục tiêu chưa đo:** con số trong kế hoạch. Không nói là đã đạt.

> **Cảnh báo:** Chỗ ghi `[điền ...]` trong các bài sau là chỗ chưa có sự kiện. Điền bằng sự kiện thật hoặc bỏ hẳn câu đó; không bịa để lấp.

#### Cách show off
Kể theo mạch tình huống → việc mình làm → kết quả → bài học, bằng lời bình thường. Mở đầu bằng một câu bối cảnh người ngoài hiểu, chuyển nhanh sang phần "tôi đã làm gì", và kết bằng một bài học có thể mang sang chỗ khác.

> **Ví dụ:** "Dự án tôi tự hào nhất là một lần sửa cache mà không ai giao. Hệ thống tôi làm là nền tảng thi tiếng Anh trực tuyến cho học sinh cả nước. Khi xem thống kê procedure trong SQL Server, tôi thấy procedure lấy danh mục môn và vòng thi, vốn là dữ liệu cấu hình rất ít đổi, lại chạy hàng chục triệu lần. Tôi đọc code cache và tìm ra hai lỗi: thời gian sống của cache chỉ một giây, và kết quả rỗng không bao giờ được cache nên luôn đi xuống DB. Tôi sửa cả hai, thêm hàm xóa cache để CMS gọi khi cấu hình đổi, và tự commit. Điều tôi rút ra là cache sai còn tệ hơn không có cache, vì nó cho cảm giác đã an toàn."

Điểm ăn điểm:
- Nói "tôi" cho phần mình làm, "đồng nghiệp" hoặc "team" cho phần người khác làm. Tách rõ được đánh giá cao hơn nhận hết.
- Nói vì sao chọn cách đó và đã bỏ cách nào. Junior kể việc; senior kể lựa chọn.
- Kết quả đi kèm cách đo. Nếu chưa đo, nói "chưa đo" và nói sẽ đo thế nào.
- Bài học cụ thể, dùng lại được ("thao tác quét toàn bộ dữ liệu không được nằm trên đường nóng"), không chung chung ("tôi học được phải cẩn thận hơn").

#### Câu hỏi vặn
- **"Kể về một dự án bạn tự hào nhất?"** Chọn câu chuyện có phần của bạn rõ nhất và kết quả đo được: lần sửa cache procedure chạy hàng chục triệu lần, hoặc lần viết lại luồng làm bài để bỏ join chéo database. Kể trong hai phút, kết bằng bài học.
- **"Bạn khác gì một mid-level?"** Trả lời bằng hành vi, không bằng tính từ. Ví dụ: tôi dẫn một đợt rà soát hiệu năng từ APM xuống thống kê của SQL Server, xếp hạng điểm nóng theo chi phí và rủi ro, rồi chia kế hoạch thành phần Dev làm ngay và phần DBA chạy ban đêm.
- **"Câu chuyện này bạn làm hay team làm?"** Tách rõ: phần tôi làm là gì, có commit hoặc báo cáo nào; phần đồng nghiệp làm là gì. Nếu bị hỏi tiếp, nói tên vai trò của người kia, không cần tên người.
- **"Con số đó bạn đo bằng gì?"** Nói đúng loại số: trace APM trước và sau, số cộng dồn trong DMV, hay mục tiêu chưa đo. Không có số đo thì nói thẳng là chưa đo và nói cách sẽ đo.
- **"Nếu làm lại, bạn sẽ làm khác điều gì?"** Luôn có một điều cụ thể. Không có câu trả lời cho câu này khiến câu chuyện nghe như được dựng sẵn.
- **"Bạn còn ví dụ nào khác không?"** Chuyển sang câu chuyện thứ hai cùng năng lực trong bảng chọn. Đây là lý do mỗi năng lực nên có ít nhất hai chuyện.

#### Bẫy cần tránh
- Mở đầu bằng một phút bối cảnh. Người hỏi mất kiên nhẫn trước khi tới phần quan trọng.
- Dùng "chúng tôi" suốt câu chuyện. Người hỏi không biết bạn làm gì và sẽ hỏi lại, mất thời gian.
- Đọc một chuỗi số liệu. Người nghe không nhớ được và nghi là học thuộc.
- Kết bằng "và mọi thứ đều ổn". Không có bài học thì không thấy sự trưởng thành.

#### Nhớ nhanh
- Hỏi trước: câu này đang chấm năng lực gì.
- Bối cảnh và nhiệm vụ ngắn; hành động dài nhất; kết quả có cách đo; luôn có bài học.
- Hai phút, khoảng 260–320 từ, tối đa một hai con số.
- "Tôi" cho phần mình, "đồng nghiệp" cho phần người khác.
- Mỗi chuyện chuẩn bị đủ ba tầng: làm gì, làm thế nào, sao biết là đúng.

#### Bài tập
1. Bấm giờ, kể câu chuyện đợt rà soát hiệu năng (Bài 24.2) thành tiếng. Ghi âm và đo thời gian từng phần.
   **Đáp án:** Nếu bối cảnh và nhiệm vụ vượt 30 giây, cắt bớt bối cảnh. Nếu phần hành động dưới 50 giây, thêm "vì sao chọn cách đó" và "đã bỏ cách nào".
2. Với mỗi câu chuyện trong bảng chọn, viết một câu "phần nào không phải của tôi".
   **Đáp án:** Ví dụ đợt rà soát hiệu năng: "Ba bản sửa ngày 16/09 do đồng nghiệp commit; tôi dẫn đợt rà soát, tìm nguyên nhân và đề xuất cách sửa."

### Bài 24.2. Một lần hệ thống chậm và cách tôi tìm ra nguyên nhân

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
Câu hỏi "sự cố lớn nhất" hay "một lần hệ thống chậm" kiểm tra cách bạn điều tra dưới áp lực: bạn có đi từ dữ liệu không hay đoán; bạn có phân biệt triệu chứng với nguyên nhân gốc không; bạn có phối hợp được với người khác để sửa không; và bạn có làm gì để chuyện đó không lặp lại không. Một câu trả lời tốt cho thấy một quy trình, không chỉ một lần may mắn.

##### Sự kiện của câu chuyện
Hệ thống là nền tảng thi tiếng Anh trực tuyến cho học sinh cả nước, dữ liệu tách thành nhiều cụm SQL Server theo nghiệp vụ, có một cụm Redis làm cache. Tháng 09/2026, tôi dẫn một đợt rà soát hiệu năng toàn hệ thống: tìm điểm nóng, xếp hạng mức ưu tiên, đề xuất cách sửa cho Dev và DBA.

Những gì tìm được, để trả lời khi bị đào sâu:
- **Màn bắt đầu thi thử:** một trace APM điển hình mất khoảng 2,45 giây, phần lớn nằm ở span Redis. Trong một request có 472 lệnh `SCAN` và 17 lệnh `UNLINK`, vì hàm làm mới cache gói dịch vụ quét toàn bộ keyspace để tìm key cần xóa. Tôi đề xuất giữ một Redis SET làm chỉ mục chứa các key liên quan để xóa thẳng từng key, thay cho việc quét.
- **Bảng chứng chỉ:** là HEAP (không có clustered index) khoảng 1,6 triệu dòng; procedure tra cứu chạy gần 2,9 triệu lần, trung bình khoảng 420 ms mỗi lần.
- **Linked server trong transaction:** một procedure gọi sang server khác ngay trong transaction đang giữ lock; hai loại wait của truy vấn phân tán (`MSQL_DQ` và `OLEDB`) chiếm khoảng 38% thời gian chờ của cụm đó.

Phần của ai:
- Đồng nghiệp commit ba bản sửa ngày 16/09. Trace sau sửa: màn bắt đầu thi thử khoảng 55 ms, không còn `SCAN`.
- Tôi tự commit phần cache cho procedure chạy hàng chục triệu lần (Bài 24.8) và phần sửa API cập nhật thông tin học sinh (Bài 24.3).

##### Quy trình điều tra
1. **Từ APM:** lọc các endpoint chậm, mở trace xem span nào chiếm thời gian (SQL, Redis, HTTP ra ngoài).
2. **Xuống DMV của SQL Server:** với span SQL, xem `sys.dm_exec_procedure_stats` (số lần chạy, logical reads, thời gian), plan đang cache, missing index, wait stats.
3. **Đọc code:** lần chuỗi gọi từ controller xuống procedure hoặc lệnh Redis để tìm chỗ sinh ra hành vi đó.
4. **Xếp hạng:** tổng chi phí (chi phí trung bình nhân số lần chạy), mức ảnh hưởng tới người dùng, rồi độ dễ sửa và rủi ro.

##### Vì sao `SCAN` vẫn chậm
`SCAN` không khóa Redis lâu như `KEYS`, vì mỗi lệnh chỉ duyệt một phần keyspace. Nhưng muốn duyệt hết vẫn phải gọi rất nhiều lần, mỗi lần một round-trip mạng, và mỗi lệnh vẫn chiếm luồng xử lý đơn của Redis. Chi phí tỷ lệ với kích thước keyspace, không tỷ lệ với số key cần xóa. Đặt việc đó trên đường request của người dùng là lỗi thiết kế, không phải lỗi cấu hình.

> **Cảnh báo:** 2,45 giây và 55 ms là hai trace điển hình trước và sau, không phải p95. Đây là vấn đề hiệu năng phát hiện qua rà soát, không phải một lần sập hệ thống. Nếu người hỏi muốn nghe về outage, nói rõ điều này ngay câu đầu.

#### Cách show off
Kể theo mạch: hệ thống chậm ở đâu → tôi điều tra theo thứ tự nào → bằng chứng chỉ ra nguyên nhân → ai sửa, sửa thế nào → đo lại ra sao → bài học. Nhấn vào quy trình, vì quy trình là thứ mang sang được công ty mới.

> **Ví dụ:** "Chuyện tôi muốn kể là một vấn đề hiệu năng chứ không phải sập hệ thống. Tháng 9 năm nay tôi dẫn một đợt rà soát hiệu năng cho nền tảng thi tiếng Anh trực tuyến, nơi giờ cao điểm rất nhiều học sinh vào thi cùng lúc. Màn bắt đầu thi thử mất hơn 2 giây, mở trace trên APM thì phần lớn thời gian nằm ở Redis chứ không phải SQL: một request bắn ra gần 500 lệnh SCAN, vì code làm mới cache đi quét toàn bộ key để tìm key cần xóa. Tôi đề xuất giữ một tập chỉ mục các key liên quan để xóa thẳng, đồng nghiệp tôi commit bản sửa. Trace sau sửa xuống dưới 0,1 giây và không còn lệnh SCAN nào. Bài học tôi giữ lại là thao tác có chi phí tỷ lệ với toàn bộ dữ liệu thì không bao giờ được nằm trên đường request của người dùng."

Điểm ăn điểm:
- Nói quy trình APM → DMV → code, và tiêu chí xếp hạng. Người hỏi thấy bạn không đoán.
- Nói rõ số là trace điển hình, không phải p95, trước khi bị hỏi.
- Tách vai trò: tôi điều tra và đề xuất, đồng nghiệp commit ba bản sửa, phần nào tôi tự commit.
- Nếu được thêm thời gian, nhắc thêm một phát hiện ở tầng DB (linked server trong transaction) để cho thấy phạm vi không chỉ một chỗ.

#### Câu hỏi vặn
- **"`SCAN` không chặn như `KEYS`, sao vẫn chậm?"** Mỗi lệnh chỉ duyệt một phần, nhưng duyệt hết keyspace thì phải gọi hàng trăm lần, mỗi lần một round-trip và mỗi lần vẫn chiếm luồng đơn của Redis. Chi phí tỷ lệ với kích thước keyspace chứ không với số key cần xóa, nên vấn đề là thuật toán chứ không phải lệnh.
- **"Sao chắc nguyên nhân là `SCAN`?"** Trace của request đó cho thấy span Redis chiếm phần lớn thời gian và đếm được gần 500 lệnh `SCAN`. Đọc code thì thấy đúng hàm làm mới cache sinh ra vòng quét. Sau bản sửa, trace không còn `SCAN` và thời gian giảm tương ứng.
- **"p95 trước và sau là bao nhiêu?"** Tôi chưa lấy p95 trong một khoảng thời gian dài; số tôi đưa là trace điển hình trước và sau. Nếu cần p95, tôi sẽ lấy trên APM cho đúng endpoint, bảy ngày trước và bảy ngày sau ngày sửa, cùng khung giờ.
- **"Bạn xếp hạng điểm nóng theo tiêu chí nào?"** Tổng chi phí là chi phí trung bình nhân số lần chạy, rồi mức ảnh hưởng tới API người dùng, sau đó độ dễ sửa và rủi ro. Một procedure 400 ms chạy vài lần một ngày xếp sau một procedure 4 ms chạy hàng triệu lần.
- **"Ai commit bản sửa?"** Ba bản sửa ngày 16/09 do đồng nghiệp commit, trên cơ sở phân tích và đề xuất của tôi. Phần tôi tự commit là cache cho procedure dữ liệu cấu hình và API cập nhật thông tin học sinh.
- **"Gọi linked server trong transaction thì sao?"** Transaction giữ lock trong suốt thời gian chờ server bên kia trả lời, nên mọi truy vấn cần dòng đó phải chờ theo. Hướng sửa là lấy dữ liệu từ server kia trước, ngoài transaction, rồi mới mở transaction cho phần ghi cục bộ.
- **"Làm gì để chuyện này không lặp lại?"** Đưa việc xem trace của endpoint nóng vào review khi đổi logic cache, và theo dõi số lệnh Redis mỗi request trên APM. Phần cảnh báo tự động theo ngưỡng thì tôi chưa triển khai: `[điền nếu đã có]`.

#### Bẫy cần tránh
- Gọi đây là "sự cố production làm sập hệ thống". Nếu bị hỏi tiếp về downtime, câu chuyện gãy ngay.
- Nói "tôi đã sửa" cho ba bản sửa đồng nghiệp commit. Nói "tôi tìm nguyên nhân và đề xuất, đồng nghiệp commit".
- Gọi trace là p95.
- Kể một danh sách mười phát hiện. Chọn một chuyện chính, giữ các phát hiện khác cho câu hỏi đào sâu.

#### Nhớ nhanh
- Vai trò: dẫn rà soát, tìm nguyên nhân, đề xuất; đồng nghiệp commit ba bản sửa ngày 16/09.
- Quy trình: APM → DMV → đọc code → xếp hạng theo tổng chi phí và ảnh hưởng.
- Màn bắt đầu thi thử: hơn 2 giây xuống dưới 0,1 giây, đo bằng trace điển hình.
- Bài học: thao tác tỷ lệ với toàn bộ dữ liệu không được nằm trên đường nóng.

#### Bài tập
1. Viết phần kết quả trong ba câu, không dùng chữ "p95".
   **Đáp án:** "Trace của màn bắt đầu thi thử sau bản sửa còn khoảng 55 ms và không còn lệnh SCAN. Ba bản sửa do đồng nghiệp commit theo đề xuất của tôi; tôi tự commit phần cache cho procedure dữ liệu cấu hình. Đó là trace điển hình, p95 tôi chưa đo."
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

### Bài 24.3. Một quyết định kỹ thuật đi ngược cách làm mặc định

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
Câu hỏi "kể về một quyết định bạn phải bảo vệ" hay "một lần bạn không theo best practice" kiểm tra hai thứ: bạn hiểu best practice đến mức biết nó đúng trong điều kiện nào, và bạn có dám đi ngược nó khi điều kiện không còn đúng. Phần thứ ba, ít người để ý: bạn có tự nói ra giới hạn của chính quyết định đó không. Senior không bảo vệ quyết định như bảo vệ cái tôi.

##### Câu chuyện chính: không đặt deadline cho lời gọi gRPC gửi event
API cập nhật thông tin học sinh phổ thông mất khoảng 500 ms trên trace APM. Đọc trace và code, tôi thấy procedure lấy vị trí của học sinh bị gọi năm lần, procedure kiểm tra điều kiện đăng ký cũng năm lần, và mỗi lần gửi event qua gRPC lại tạo một `GrpcChannel` mới. Tôi tự sửa API này (commit 22/09):

- Đọc vị trí học sinh một lần ở đầu flow rồi truyền xuống các bước kiểm tra; gộp hai lần lấy vòng tự luyện thành một lần gọi DB.
- Dùng chung một `GrpcChannel` (channel tốn kém khi tạo, được thiết kế để tái sử dụng) và gửi event trong `Task.Run` để ra khỏi luồng HTTP.
- Không đặt deadline cho lời gọi gửi event. Cách làm mặc định là mọi lời gọi gRPC đều có deadline, nhưng service nhận event có lúc chậm tới khoảng 3,6 giây. Đặt deadline ngắn thì event bị hủy giữa chừng, tức là đổi hành vi nghiệp vụ. Vì việc gửi đã tách khỏi request, người dùng không phải chờ.

Kết quả: báo cáo đặt mục tiêu dưới 60 ms, nhưng tôi chưa đo lại bằng APM sau khi deploy, nên không nói là đã đạt.

##### Vì sao deadline vẫn đúng ở chỗ khác
Deadline và timeout bảo vệ luồng đang chờ: nếu request người dùng phải chờ một service chậm, thread và kết nối bị giữ, và lỗi lan ngược lên. Khi lời gọi đã tách khỏi request thì không còn ai phải chờ, nên lợi ích của deadline mất đi, chỉ còn tác hại là rơi event. Vì vậy câu "tôi dùng Polly timeout cho lời gọi đồng bộ" và "tôi không đặt deadline cho event chạy nền" không mâu thuẫn.

##### Giới hạn của chính quyết định
`Task.Run` trong ASP.NET Core là fire-and-forget không có người quản lý:
- Process restart hoặc deploy thì event đang gửi bị mất.
- Exception trong task không ai quan sát nếu không tự `try/catch` và log.
- Không được dùng service có scope theo request (ví dụ `DbContext`, `HttpContext`) bên trong, vì request kết thúc thì scope bị dispose.

Hướng đúng hơn nếu event quan trọng: ghi vào bảng outbox trong cùng transaction rồi worker publish, hoặc đưa vào hàng đợi bền như Kafka có retry. `Channel<T>` cộng `BackgroundService` gọn hơn `Task.Run` nhưng vẫn mất khi process chết.

##### Câu chuyện dự phòng: không đánh index cho bảng log ghi liên tục
Trong đợt rà soát, cụm DB chứa log làm bài có wait `WRITELOG` khoảng 41% và `THREADPOOL` khoảng 46% thời gian chờ, trong khi DMV missing index gợi ý thêm index cho nhiều bảng log. Tôi không đề xuất đánh hết. Bảng ghi liên tục mà thêm nonclustered index trên một key ngẫu nhiên như `UserId` thì mỗi lần insert phải ghi thêm vào index, gây page split và tăng lượng log ghi, đúng thứ cụm này đang nghẽn. Tôi chia theo cách truy cập: bảng chỉ ghi để HEAP hoặc clustered theo identity; bảng ghi dồn theo ca thi thì partition và đánh index sau ca; bảng nằm trên đường nóng thì một covering index gọn; nhu cầu tra cứu chuyển sang replica. Đây là chiến lược đề xuất; trạng thái triển khai `[điền trạng thái thật]`.

> **Cảnh báo:** Không có ghi nhận ai đã phản biện các quyết định này. Nếu thật sự có người phản biện trong review, kể đúng vai trò và lập luận của họ. Nếu không, kể là "một quyết định đi ngược cách làm mặc định, và tôi giải thích lý do trong thay đổi".

#### Cách show off
Mạch kể: cách làm mặc định là gì → vì sao trong tình huống này nó gây hại → tôi chọn gì → giới hạn của lựa chọn đó và cách sẽ làm nếu có thêm thời gian. Nói giới hạn trước khi bị hỏi là điểm cộng lớn nhất của câu chuyện này.

> **Ví dụ:** "Tôi có một quyết định hơi ngược với thói quen chung là không đặt deadline cho một lời gọi gRPC. Khi sửa API cập nhật thông tin học sinh, tôi đưa phần gửi event sang chạy nền để người dùng không phải chờ. Thói quen là lời gọi gRPC nào cũng phải có deadline, nhưng service nhận event có lúc mất vài giây mới xử lý xong, đặt deadline ngắn thì event bị hủy giữa chừng, nghĩa là mất dữ liệu nghiệp vụ. Mà lời gọi đã tách khỏi request rồi, không còn ai đứng chờ nó, nên deadline chỉ còn tác hại. Tôi cũng nói rõ giới hạn: chạy nền kiểu này thì process restart là mất event, nếu event quan trọng hơn tôi sẽ chuyển sang outbox hoặc Kafka. Điều tôi rút ra là best practice nào cũng có điều kiện áp dụng, và việc của mình là kiểm tra điều kiện đó còn đúng không."

Điểm ăn điểm:
- Nêu đúng điều kiện áp dụng của best practice: deadline cho lời gọi đồng bộ trên đường request.
- Tự nói giới hạn của `Task.Run` và hướng nâng cấp, không chờ bị bắt bẻ.
- Không nhận kết quả chưa đo: mục tiêu dưới 60 ms là kế hoạch.
- Với câu chuyện index, nối quyết định với số đo (wait `WRITELOG` đang cao) chứ không dựa vào cảm giác.

#### Câu hỏi vặn
- **"Nếu service nhận event chết thì event đi đâu?"** Với cách hiện tại thì mất, và tôi coi đó là giới hạn có ý thức. Nếu event cần đảm bảo, tôi ghi vào bảng outbox trong cùng transaction với dữ liệu chính, rồi một worker đọc outbox và gửi có retry.
- **"`Task.Run` trong ASP.NET Core có rủi ro gì?"** Mất việc khi process restart, exception không ai quan sát nếu không tự bắt, và không được dùng service theo scope request vì scope đã bị dispose. Tôi bắt exception và log trong task, và chỉ dùng channel gRPC dùng chung, không dùng gì của request.
- **"Sao không đưa event vào Kafka ngay từ đầu?"** Phạm vi của lần sửa là hiệu năng API, và đổi kênh gửi event là thay đổi kiến trúc cần cả service nhận đồng ý. Tôi chọn bước nhỏ an toàn trước và ghi lại hướng nâng cấp.
- **"Không có deadline thì một lời gọi treo mãi có giữ tài nguyên không?"** Có giữ một task và một stream HTTP/2 trên channel dùng chung. Nếu số lời gọi treo tăng thì cần một giới hạn rộng, ví dụ vài chục giây, hoặc giới hạn số lời gọi đồng thời; đó là cách tôi sẽ siết nếu thấy dấu hiệu.
- **"Mục tiêu dưới 60 ms đạt chưa?"** Tôi chưa đo lại bằng APM sau khi deploy, nên chưa nói là đạt. Cách đo là lấy trace của đúng endpoint đó trước và sau, cùng khung giờ.
- **"Không đánh index thì truy vấn tra cứu trên bảng log chạy thế nào?"** Tra cứu không chạy trên bảng đang ghi nóng. Với bảng partition theo ca thi, index đánh sau khi ca kết thúc; còn nhu cầu tra cứu thường xuyên thì đẩy sang replica đọc.
- **"Ai phản biện quyết định này?"** `[điền nếu có người phản biện thật]`. Nếu không có, nói thẳng: không có tranh luận lớn, tôi ghi rõ lý do trong thay đổi để người review sau hiểu vì sao không có deadline.

#### Bẫy cần tránh
- Nói "best practice không phải lúc nào cũng đúng" mà không nêu điều kiện cụ thể. Nghe như biện hộ.
- Giấu giới hạn của `Task.Run`. Người hỏi biết, và họ sẽ hỏi.
- Nói API "đã xuống dưới 60 ms". Đó là mục tiêu chưa đo.
- Nói "tôi bỏ index cho bảng log" như đã làm, khi đó là chiến lược đề xuất.

#### Nhớ nhanh
- Quyết định: không đặt deadline cho gRPC gửi event chạy nền, vì deadline làm rơi event mà không còn ai cần chờ.
- Deadline đúng cho lời gọi đồng bộ trên đường request; không mâu thuẫn với Polly timeout.
- Tự nói giới hạn: process chết là mất event; hướng nâng cấp là outbox hoặc Kafka.
- Dự phòng: không index bảng log ghi liên tục khi `WRITELOG` đã là nút nghẽn; chia theo cách truy cập.

#### Bài tập
1. Viết một câu giải thích vì sao "tôi dùng Polly timeout" không mâu thuẫn với "tôi không đặt deadline cho event".
   **Đáp án:** Timeout bảo vệ luồng đang chờ trên đường request; event chạy nền đã tách khỏi request thì không còn ai chờ, nên thứ cần là độ bền như hàng đợi, không phải deadline.
2. Liệt kê ba cách đưa event ra khỏi request an toàn hơn `Task.Run`.
   **Đáp án:** Ghi outbox trong cùng transaction rồi worker publish; publish vào Kafka có retry; `Channel<T>` cộng `BackgroundService` nếu chấp nhận mất khi process chết.

### Bài 24.4. Một lần tôi sai: gỡ công tắc rollback quá sớm

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
"Kể về một lần bạn sai" kiểm tra ba thứ: bạn có tự nhận sai mà không đổ lỗi không, sai lầm đó có đủ thật và đủ cụ thể không (không phải kiểu "tôi quá cầu toàn"), và bạn rút ra bài học gì đã thay đổi cách làm sau đó. Một sai lầm nhỏ nhưng thật, kèm bài học rõ, tốt hơn một sai lầm lớn kể mơ hồ.

##### Bối cảnh: viết lại luồng tạo lượt làm bài
Hệ thống luyện tập Mastery tách dữ liệu ra bốn database theo vai trò: đề thi, ngân hàng câu hỏi, tích hợp và log. Database tích hợp có 18 procedure, trong đó 12 cái join chéo sang database khác, trong khi yêu cầu review của dự án là không join chéo hai database (join chéo khiến các database không tách ra được server riêng và khó tối ưu).

Tôi viết lại luồng tạo lượt làm bài (attempt engine, bản V3, chuỗi commit 21–24/08) để bỏ 12 procedure join chéo:
- Phần C# điều phối 12 bước: đọc dữ liệu từ từng database riêng (4 lần đọc DB đề, 2 lần đọc DB câu hỏi, 1 lần đọc DB tích hợp), ghép ở tầng ứng dụng, rồi đúng một lần ghi.
- Lần ghi nhận danh sách câu hỏi đã chọn qua table-valued parameter, chạy trong transaction có `SET XACT_ABORT ON`, đọc bằng `UPDLOCK, HOLDLOCK` và kiểm tra lại các điều kiện nghiệp vụ (thời gian chờ giữa hai lượt, giới hạn số lượt mỗi ngày, thứ tự lượt). Các lần đọc trước chỉ để chuẩn bị; quyết định cuối cùng nằm trong transaction.
- Khi rollout, tôi đặt một cờ đọc từ config để chuyển về luồng cũ mà không cần deploy lại.

##### Sai lầm
Sau khi chạy ổn trên dev, chính tôi hard-code cờ đó thành `true` ngay trong ngày 24/08 để bỏ bớt nhánh cấu hình. Từ lúc đó, muốn quay về luồng cũ phải sửa code và deploy lại. Tôi đã tự tháo đúng lớp an toàn mình đặt ra, trước khi có bất kỳ số liệu production nào.

##### Bài học về feature flag rollout
Cờ rollout có vòng đời: bật dần, theo dõi, rồi gỡ. Điều kiện gỡ hợp lý:
- Đã chạy hết ít nhất một đợt dùng thật trên production.
- Tỷ lệ lỗi và độ trễ không xấu hơn đường cũ.
- Có người chịu trách nhiệm xác nhận.
- Gỡ cờ và xóa code cũ trong một thay đổi riêng, dễ revert.

> **Ghi nhớ:** Còn một chuyện sai thứ hai có thể dùng: một commit về cache-control bị revert ngay trong ngày. Chưa có chi tiết. Chỉ dùng nếu bạn nhớ được bối cảnh, nguyên nhân và cách sửa thật: `[điền chi tiết thật]`.

#### Cách show off
Mạch kể: tôi đã làm đúng phần nào → tôi sai ở đâu, vì sao lúc đó tôi làm vậy → hệ quả cụ thể → bài học và điều đã thay đổi. Kể phần làm đúng ngắn thôi, đủ để thấy sai lầm không phải do thiếu hiểu biết mà do vội. Đừng biến câu chuyện sai thành câu chuyện khoe.

> **Ví dụ:** "Lần sai tôi nhớ nhất là khi viết lại luồng tạo lượt làm bài cho hệ thống luyện tập. Đây là thay đổi lớn, nên lúc rollout tôi đặt một cờ trong config để chuyển về luồng cũ mà không phải deploy. Nhưng chạy ổn trên dev rồi, tôi muốn code gọn nên hard-code cờ thành bật luôn ngay trong ngày. Từ đó, nếu luồng mới lỗi trên production thì muốn quay lại phải sửa code và deploy, tức là tôi tự tháo lớp an toàn mình vừa đặt, khi chưa có số liệu production nào. Đó là sai về quy trình, bất kể sau đó có phải rollback thật hay không. Giờ với cờ rollout, tôi giữ trong config ít nhất hết một đợt chạy thật, chỉ gỡ khi số lỗi và độ trễ không xấu hơn đường cũ, và gỡ trong một thay đổi riêng."

Điểm ăn điểm:
- Sai lầm do chính mình, không đổ cho deadline hay người khác.
- Hệ quả cụ thể: rollback từ "đổi config" thành "deploy lại".
- Bài học thành quy tắc có điều kiện rõ, không phải "tôi sẽ cẩn thận hơn".
- Nếu được hỏi về kỹ thuật, nói được vì sao chỉ có một lần ghi atomic.

`[điền: sau đó đã từng phải rollback luồng mới chưa; nếu có thì kể đúng chuyện đó]`

#### Câu hỏi vặn
- **"Vì sao lúc đó bạn hard-code?"** Tôi muốn bỏ bớt nhánh cấu hình cho code gọn ngay khi thấy chạy ổn trên dev. Lý do đó không sai, sai là thời điểm: tôi gỡ trước khi có số liệu production.
- **"Có ai phát hiện ra không, hay bạn tự nhận?"** `[điền sự thật: tự nhận ra khi nào, hay được người review chỉ ra]`. Dù cách nào, nói đúng như đã xảy ra.
- **"Nếu luồng mới lỗi trên production thì giờ làm thế nào?"** Phải deploy lại bản có đường cũ. Đó đúng là hệ quả của sai lầm, và là lý do tôi kể nó như một bài học.
- **"Ghi thành công nhưng bước sau lỗi thì sao?"** Chỉ có một lần ghi và nó là bước cuối, chạy trong transaction với `XACT_ABORT ON`, nên không có trạng thái ghi dở. Các lần đọc trước chỉ để chuẩn bị, điều kiện nghiệp vụ được kiểm tra lại trong transaction.
- **"Hai request cùng lúc của một học sinh thì sao?"** Lần ghi đọc dòng trạng thái bằng `UPDLOCK, HOLDLOCK`, nên request thứ hai phải chờ request thứ nhất commit, rồi kiểm tra lại giới hạn lượt và thời gian chờ trên dữ liệu mới. Một trong hai bị từ chối thay vì cả hai cùng qua.
- **"Phần AI viết trong luồng mới là bao nhiêu?"** Tôi dùng Claude Code sinh nháp theo plan từng pha; tôi review từng diff, chạy trên DB dev và sửa cho khớp procedure mới. Các commit có ghi AI là đồng tác giả, và tôi giải thích được từng bước.
- **"Ngoài chuyện này, còn sai lầm nào lớn hơn không?"** Nếu có chuyện thật lớn hơn thì kể; nếu không, nói rằng đây là sai lầm có hệ quả rõ nhất mà tôi nhớ chi tiết, thay vì dựng thêm.

#### Bẫy cần tránh
- Kể "sai lầm" thực chất là khoe ("tôi quá tận tụy", "tôi làm quá kỹ").
- Dành hai phút kể phần thiết kế đúng, mười giây kể phần sai.
- Đổ cho áp lực thời gian hoặc yêu cầu thay đổi.
- Kết thúc không có điều gì thay đổi trong cách làm.

#### Nhớ nhanh
- Bối cảnh: viết lại luồng tạo lượt làm bài để bỏ join chéo database, một lần ghi atomic cuối cùng.
- Đúng: đặt cờ trong config để rollback không cần deploy.
- Sai: tự hard-code cờ thành bật ngay trong ngày, trước khi có số liệu production.
- Bài học: giữ cờ hết ít nhất một đợt chạy thật, gỡ khi số liệu không xấu hơn, gỡ trong thay đổi riêng.

#### Bài tập
1. Viết phần kết quả và bài học trong hai câu, không dùng từ "nhưng".
   **Đáp án:** "Từ đó muốn rollback phải deploy lại. Giờ tôi giữ cờ trong config đến hết đợt chạy thật đầu tiên và chỉ gỡ khi có số liệu production."
2. Viết điều kiện để gỡ một feature flag rollout.
   **Đáp án:** Đã chạy hết ít nhất một đợt thật; tỷ lệ lỗi và độ trễ không xấu hơn đường cũ; có người chịu trách nhiệm xác nhận; gỡ cờ trong một thay đổi riêng.

### Bài 24.5. Khi ưu tiên của Dev và DBA xung đột

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
"Kể về một lần bất đồng với team khác" kiểm tra bạn có hiểu ràng buộc của người khác không, hay chỉ thấy ưu tiên của mình. Senior không thắng tranh luận bằng chức danh; họ tìm phương án mà cả hai bên đều làm được, và lý do của phương án phải dựa trên sự thật kỹ thuật, không dựa trên ý kiến.

##### Bối cảnh
Sau đợt rà soát hiệu năng, có nhiều procedure cần sửa và nhiều bảng cần thêm index. Ví dụ rõ nhất là bảng chứng chỉ: không có clustered index, khoảng 1,6 triệu dòng, và DMV missing index báo gần như toàn bộ chi phí truy vấn tra cứu có thể giảm nếu có index phù hợp. Dev muốn sửa ngay; DBA phải giữ production ổn định trong giờ học sinh đang làm bài. Tôi viết kế hoạch xử lý chia theo mức ưu tiên cho cả Dev và DBA.

##### Sự thật kỹ thuật làm nền cho kế hoạch
- Server chạy SQL Server Standard Edition. Tạo index online (`ONLINE = ON`) chỉ có ở Enterprise, nên ở đây tạo index là thao tác offline: tạo nonclustered index giữ khóa chia sẻ trên bảng, chặn mọi lệnh ghi; tạo clustered index giữ khóa schema-modification, chặn cả đọc lẫn ghi.
- Standard Edition cũng không build index song song, nên một index trên bảng lớn chạy lâu hơn so với Enterprise. Thời gian khóa vì vậy càng dài.
- Ngược lại, `ALTER PROCEDURE` chỉ cần khóa schema trên chính procedure trong khoảnh khắc ngắn, không khóa bảng dữ liệu. Sửa procedure deploy được trong ngày.
- `ALTER PROCEDURE` xóa plan cũ khỏi cache, nên thống kê trong `sys.dm_exec_procedure_stats` của procedure đó bắt đầu lại từ đầu. Số mới chỉ phản ánh các lần chạy sau khi deploy, tiện để so sánh, nhưng phải chụp số cũ trước khi sửa.

##### Kế hoạch hai tầng
1. **Tầng một, hotfix procedure:** sửa logic, bỏ lời gọi thừa, deploy trong ngày. Không chờ ai.
2. **Tầng hai, index:** giao DBA chạy trong cửa sổ 23h–05h, bảng nhỏ trước, mỗi đêm vài bảng, theo dõi blocking và có ngưỡng dừng.
3. **Bảng log ghi liên tục:** không thêm index, chia theo cách truy cập (Bài 24.3).
4. **Đo:** chụp thống kê procedure trước khi sửa, so với thống kê sau deploy, kèm trace APM trước và sau.

Kết quả thật: phần hotfix không phải chờ cửa sổ index. Phần index ban đêm: `[điền trạng thái thật: DBA đã chạy bảng nào]`. Báo cáo là kế hoạch; mục nào chưa làm thì không nhận là đã xong.

> **Cảnh báo:** Không có ghi nhận một cuộc tranh luận cụ thể với DBA; đây là xung đột về ràng buộc (sửa ngay hay giữ ổn định). Nếu có tranh luận thật, kể đúng nội dung. Nếu không, kể là "hai ưu tiên xung đột và tôi tìm cách cho cả hai cùng được", đừng dựng thêm kịch tính.

#### Cách show off
Mạch kể: hai bên muốn gì, ràng buộc của bên kia là gì → sự thật kỹ thuật nào cho phép tách vấn đề → phương án tôi đề xuất → kết quả thật đến đâu. Câu chuyện thắng điểm khi bạn mô tả ràng buộc của DBA công bằng như ràng buộc của mình.

> **Ví dụ:** "Sau đợt rà soát hiệu năng, bên tôi muốn sửa ngay, còn DBA thì phải giữ hệ thống ổn định trong giờ học sinh làm bài, và cả hai đều đúng. Tôi để ý là server chạy bản Standard, không tạo index online được, nên tạo index ban ngày sẽ khóa bảng. Nhưng sửa procedure thì chỉ khóa procedure trong khoảnh khắc, không đụng tới bảng. Vì vậy tôi tách kế hoạch làm hai tầng: phần sửa procedure deploy trong ngày, phần index giao DBA chạy trong cửa sổ đêm, bảng nhỏ trước, có ngưỡng dừng. Phần hotfix vì thế không phải chờ ai. Phần index thì `[điền trạng thái thật]`. Điều tôi rút ra là khi hai team xung đột, thường có một cách tách vấn đề để mỗi bên làm được phần của mình mà không vi phạm ràng buộc của bên kia."

Điểm ăn điểm:
- Nói ràng buộc của DBA bằng lời của họ: không có gì khóa bảng trong giờ cao điểm.
- Lý do dựa trên cơ chế khóa cụ thể, không dựa trên "theo kinh nghiệm".
- Có cách đo trước và sau, kể cả chi tiết thống kê bị reset khi sửa procedure.
- Không nhận phần index là đã xong khi chưa có xác nhận.

#### Câu hỏi vặn
- **"Sao không đánh index ban ngày cho nhanh?"** Standard Edition không có tạo index online. Tạo nonclustered index chặn mọi lệnh ghi vào bảng, clustered index chặn cả đọc, và vì không build song song nên thời gian khóa còn dài hơn. Với bảng đang phục vụ học sinh làm bài, đó là downtime trá hình.
- **"Sao không mua Enterprise để tạo index online?"** License Enterprise tính theo core và đắt hơn nhiều lần, trong khi vấn đề giải quyết được bằng việc dời lịch sang ban đêm. Nếu nhu cầu thay đổi schema ban ngày thành thường xuyên thì đó mới là lý do đáng đưa ra bàn.
- **"DBA đã đánh index chưa?"** Trả lời theo trạng thái thật: `[điền]`. Kế hoạch tôi viết là đề xuất; tôi không nhận phần đó là đã làm.
- **"Nếu DBA không đồng ý cửa sổ 23h–05h thì sao?"** Tôi hỏi khung nào họ chấp nhận được, rồi chia nhỏ hơn: mỗi lần một bảng, đo trước trên bản sao dữ liệu để biết thời gian. Mục tiêu là phương án họ chấp nhận, không phải phương án của tôi.
- **"Sửa procedure bằng tách nhánh `IF/ELSE` có bị parameter sniffing không?"** Có thể, nếu các nhánh dùng chung một plan được biên dịch cho giá trị đầu tiên. Cách xử lý là tách mỗi nhánh thành procedure con riêng để mỗi cái có plan riêng, hoặc dùng `OPTION (RECOMPILE)` cho câu lệnh ít chạy.
- **"Làm sao biết bản sửa có tác dụng?"** Chụp thống kê của procedure trước khi sửa, vì `ALTER PROCEDURE` sẽ reset thống kê. Sau deploy, so logical reads và thời gian trung bình trên các lần chạy mới, kèm trace APM của endpoint liên quan cùng khung giờ.
- **"Bất đồng này có căng thẳng không?"** `[điền sự thật]`. Nếu không căng thẳng, nói thẳng: đây là hai ưu tiên hợp lý xung đột, và kế hoạch được chấp nhận vì nó tôn trọng ràng buộc của cả hai.

#### Bẫy cần tránh
- Kể DBA như người cản trở. Người hỏi đang chấm cách bạn đối xử với team khác.
- Dựng một cuộc tranh luận không có thật cho câu chuyện kịch tính hơn.
- Nói "đánh index ban đêm là xong" khi chưa có xác nhận ai đã chạy.
- Dùng sự thật kỹ thuật sai: tạo nonclustered index offline chặn ghi, không phải chặn đọc.

#### Nhớ nhanh
- Xung đột: Dev muốn sửa ngay, DBA giữ ổn định; Standard Edition không tạo index online, không build song song.
- Tách hai tầng: sửa procedure trong ngày (khóa ngắn, không đụng bảng), index trong cửa sổ đêm.
- Đo: chụp thống kê trước khi sửa vì `ALTER PROCEDURE` reset thống kê.
- Không nhận phần chưa làm là đã xong.

#### Bài tập
1. Viết checklist đánh index ban đêm theo best practice.
   **Đáp án:** Thử trên bản sao dữ liệu để biết thời gian và dung lượng; mỗi đêm vài bảng, bảng nhỏ trước; `SORT_IN_TEMPDB = ON`; theo dõi blocking, có ngưỡng dừng; sáng hôm sau so plan và DMV.
2. Viết câu mở đầu khi trình kế hoạch cho DBA, xuất phát từ ràng buộc của họ.
   **Đáp án:** "Không có thay đổi nào trong ngày khóa bảng; phần index tôi đề xuất chạy trong cửa sổ 23h–05h, theo thứ tự ảnh hưởng, anh chị chọn đêm nào phù hợp."

### Bài 24.6. Dẫn dắt team

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
"Kể về một lần bạn dẫn dắt team" không hỏi về chức danh mà hỏi về hành vi dẫn dắt: bạn ra quyết định kỹ thuật thế nào khi team có nhiều ý kiến, bạn chia việc và chia lại việc ra sao khi kế hoạch đổi, bạn review code để nâng chất lượng hay để bắt lỗi, và bạn xử lý thế nào khi giao hàng trễ. Người hỏi muốn nghe ít nhất một tình huống cụ thể, không phải mô tả công việc.

##### Sự kiện có thật
Ở AvePoint, tôi là Team Lead của Examena, nền tảng thi trực tuyến có giám sát qua video. Team 8 người. Kỳ thi thật có hơn 3.000 thí sinh cùng lúc. Tôi chịu trách nhiệm thiết kế kỹ thuật, lập kế hoạch công việc, code review và release.

Các quyết định thiết kế nói được:
- **SFU (MediaSoup) thay cho mesh:** với mesh, mỗi thí sinh phải gửi một luồng video riêng cho từng người xem; với SFU, mỗi thí sinh chỉ gửi một luồng lên server, server chuyển tiếp cho người xem. MCU là phương án thứ ba: server trộn hình thành một luồng, tiết kiệm băng thông phía người xem nhưng rất tốn CPU server.
- **AI chống gian lận tách khỏi luồng video:** sự kiện bị gắn cờ đi vào hàng đợi duyệt bất đồng bộ và audit log, nên video của giám thị không phải chờ model.
- **Chuỗi delivery:** Docker, Helm, Terraform, GitLab CI và Argo CD; trạng thái triển khai nằm trong Git nên rollback bằng Git.

Những chỗ chưa có sự kiện, phải tự điền trước buổi phỏng vấn:
- `[xác nhận: SFU và cách tách AI là quyết định của bạn hay của team]`
- `[điền một lần chia lại việc thật]`
- `[điền một PR đã chặn và lý do]`
- `[điền một lần giao hàng trễ và cách xử lý, nếu có]`

> **Cảnh báo:** Không nói số SFU worker, thông số AI (khung hình mỗi giây, độ trễ), Azure hay AKS, Scrum hay sprint planning nếu chưa xác nhận là thật. Không bịa công cụ đo hơn 3.000 thí sinh.

#### Cách show off
Mạch kể: team và mục tiêu → một quyết định hoặc tình huống cụ thể mà bạn dẫn → bạn làm gì để team đi cùng → kết quả → bài học về dẫn dắt. Câu chuyện dẫn dắt mạnh nhất là câu chuyện về con người (chia lại việc, chặn một PR, xử lý trễ hạn), nên ưu tiên điền các chỗ trống trên. Phần kiến trúc dùng để chứng minh bạn dẫn về kỹ thuật.

> **Ví dụ:** "Ở AvePoint tôi là Team Lead của Examena, một nền tảng thi trực tuyến có giám thị theo dõi qua video, team 8 người, kỳ thi thật có hơn ba nghìn thí sinh cùng lúc. Bài toán lớn nhất là luồng video: nếu mỗi thí sinh gửi trực tiếp cho từng giám thị thì băng thông của thí sinh không chịu nổi, nên hệ thống dùng SFU, mỗi thí sinh chỉ gửi một luồng lên server. Phần AI chống gian lận được tách ra hàng đợi riêng, để video của giám thị không bao giờ phải chờ model. Ngoài kỹ thuật, việc của tôi là chia việc, review code và chịu trách nhiệm release. `[điền một tình huống con người thật: chia lại việc, chặn PR, hoặc trễ hạn]`. Điều tôi rút ra là quyết định kiến trúc đúng mới là một nửa; nửa còn lại là để team hiểu vì sao và tự ra được quyết định nhỏ theo cùng hướng đó."

Điểm ăn điểm:
- So sánh phương án (mesh, SFU, MCU) và nói vì sao chọn, không chỉ nói đã chọn.
- Có ít nhất một tình huống con người cụ thể.
- Tự nói rõ phần nào là quyết định của mình, phần nào của team.
- Không nói thông số chưa xác nhận; nói "tôi không nhớ chính xác cấu hình worker" là chấp nhận được.

#### Câu hỏi vặn
- **"Team 8 người gồm những vai trò nào?"** Trả lời đúng thực tế `[điền cơ cấu thật]`. Nếu không chắc, nói con số bạn nhớ chắc và nói rõ phần không chắc.
- **"Bạn ra quyết định kiến trúc thế nào khi team có ý kiến khác nhau?"** Đặt vấn đề, liệt kê phương án, so theo tiêu chí đã thống nhất (băng thông, chi phí server, độ phức tạp), chọn và ghi lại đánh đổi. Ví dụ SFU so với mesh và MCU. Nếu có tranh luận thật trong team, kể đúng nội dung.
- **"SFU, MCU, mesh khác nhau thế nào?"** Mesh: mỗi người gửi một luồng cho từng người xem, không mở rộng được. MCU: server trộn hình thành một luồng, tốn CPU server. SFU: server chỉ chuyển tiếp, mỗi thí sinh gửi một luồng, cân bằng nhất cho bài toán giám sát thi.
- **"Một worker MediaSoup chịu được bao nhiêu?"** Tôi không nhớ chính xác cấu hình worker của hệ thống nên không đưa số. Tài liệu MediaSoup cho mức tham khảo khoảng vài trăm consumer mỗi worker, mỗi worker dùng một nhân CPU; số thật phải đo tải.
- **"Một PR bạn đã chặn, vì sao?"** `[điền một PR thật]`. Câu trả lời tốt nói vấn đề trong PR, vì sao nó nghiêm trọng, và bạn giúp người viết sửa thế nào.
- **"Một lần giao hàng bị trễ, bạn làm gì?"** Dùng sự kiện thật nếu có. Nếu không nhớ cụ thể, nói cách làm và nói rõ đó là cách làm: phát hiện sớm, cùng product cắt phạm vi, giữ luồng thi chính, báo sớm mốc mới, rút kinh nghiệm về cách ước lượng.
- **"Bạn phối hợp với product, QA, DevOps thế nào?"** `[điền cách phối hợp thật]`. Có chuỗi delivery dựa trên Git (Argo CD) thì nói được: release và rollback đều qua Git, nên QA và DevOps nhìn cùng một nguồn trạng thái.

#### Bẫy cần tránh
- Mô tả công việc ("tôi review code, chia task") thay cho kể một tình huống.
- Nhận mọi quyết định kiến trúc là của mình khi chưa chắc.
- Nói thông số nghe chuyên nghiệp nhưng không có thật (số worker, độ trễ AI, công cụ load test).
- Kể câu chuyện dẫn dắt mà không có con người nào ngoài bạn.

#### Nhớ nhanh
- Có thật: Team Lead Examena, 8 người, hơn 3.000 thí sinh cùng lúc, SFU thay mesh, AI tách ra hàng đợi, delivery dựa trên Git.
- Phải điền trước buổi phỏng vấn: ai quyết định kiến trúc, một lần chia lại việc, một PR đã chặn, một lần trễ hạn.
- So sánh mesh, SFU, MCU bằng băng thông và CPU.
- Không nói số worker, thông số AI, cloud, Scrum khi chưa xác nhận.

#### Bài tập
1. Viết ba câu cho mỗi chỗ `[điền ...]` bằng sự kiện bạn nhớ được.
   **Đáp án:** Mỗi câu có: chuyện gì xảy ra, bạn làm gì, kết quả ra sao. Không nhớ thì bỏ, không thay bằng ví dụ chung.
2. Ước lượng số worker MediaSoup cho 3.000 thí sinh, mỗi thí sinh có một giám thị xem một luồng video, một worker khoảng 500 consumer.
   **Đáp án:** Khoảng 3.000 consumer chia 500 là 6 worker, chưa tính dự phòng. Nếu mỗi thí sinh gửi cả video và audio thì gấp đôi. Nói rõ đây là ước lượng, không phải cấu hình thật.

### Bài 24.7. Dùng AI thế nào và không tin AI ở đâu

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
Câu hỏi về AI giờ gần như chắc chắn xuất hiện. Người hỏi không muốn nghe "tôi dùng AI cho nhanh". Họ muốn biết: bạn có quy trình kiểm soát chất lượng không, bạn có hiểu đủ để bắt lỗi của AI không, bạn có ranh giới rõ ràng về dữ liệu và an toàn không, và bạn có trung thực về phần nào AI viết không. Một senior dùng AI tốt là người tăng tốc mà không hạ chuẩn.

##### Sự kiện có thật
Tôi làm trên nhiều repo .NET với codebase cũ, nhiều sự kiện theo mùa cho hệ thống thi, và một đợt nâng nhiều project lên .NET 10. Cách tôi dùng Claude Code:

- **Ngữ cảnh dự án:** mỗi repo có một file `CLAUDE.md` mô tả kiến trúc, lệnh build, quy tắc an toàn.
- **Skill cho việc lặp lại:** tôi viết skill ghi quy trình chuẩn, ví dụ làm một sự kiện thi từ đầu đến cuối (bộ câu hỏi chuẩn → khảo sát code và DB dev → viết plan → sinh script SQL cấu hình và code), và nâng một project lên .NET 10.
- **MCP server:** tôi cài và cấu hình (set up, không phải tự viết) MCP server cho điều hướng C# theo ngữ nghĩa, đọc schema DB dev và ngữ cảnh git. Công cụ đọc DB chỉ có quyền đọc, chỉ trên DB dev.
- **Kiểm soát chất lượng:** đọc từng diff, build trên máy thật, chạy với DB dev, review đối kháng (cho một lượt review riêng đối chiếu code với schema và với yêu cầu), có công tắc rollback cho thay đổi lớn.
- **Tài liệu:** knowledge base về luồng nghiệp vụ, API và stored procedure theo từng database; AI soạn nháp, tôi review và giữ cấu trúc.
- **Đo độ chính xác của AI trong sản phẩm:** ở một luồng nhập dữ liệu trường học có AI đề xuất, tôi lưu bản AI gốc ở lần lưu đầu, rồi so với bản người duyệt lưu theo từng trường, ghi số trường AI đề xuất, số trường bị sửa và chi tiết. Bước đánh giá này chỉ ghi log, lỗi ở đó không làm hỏng lần lưu.

##### Chỗ không tin AI
- Số liệu và nhận định chưa đo: AI viết "giảm 80%" rất tự tin.
- SQL chạy trên production: script ghi luôn qua người, mặc định chạy thử rồi rollback, chỉ commit khi đã xem kết quả.
- Logic đồng thời và transaction: khóa, thứ tự ghi, điều kiện race là nơi AI sai mà code vẫn trông hợp lý.

> **Cảnh báo:** Nếu chỉ cài và cấu hình MCP server có sẵn, nói "set up", không nói "built". Không nói số ngày tiết kiệm được nếu chưa đo.

#### Cách show off
Mạch kể: vì sao tôi dùng AI (codebase lớn, việc lặp lại) → tôi dựng quy trình gì → tôi kiểm soát ở đâu → một chỗ AI sai mà tôi bắt được → ranh giới tôi giữ. Điểm mạnh nhất là ví dụ AI sai, vì nó chứng minh bạn thật sự review.

> **Ví dụ:** "Tôi dùng Claude Code hằng ngày, nhưng theo một quy trình chứ không phải hỏi gì làm nấy. Mỗi repo có một file ngữ cảnh mô tả kiến trúc và quy tắc an toàn, và những việc lặp lại như làm một sự kiện thi tôi ghi thành skill để AI làm theo đúng các bước. Công cụ cho AI đọc database chỉ có quyền đọc và chỉ trên DB dev. Code AI sinh ra tôi đọc từng diff, build trên máy thật và chạy với DB dev trước khi coi là xong. `[điền một lần AI sai mà bạn bắt được: sai gì, phát hiện ở bước nào]`. Ba chỗ tôi không bao giờ tin AI là con số chưa đo, SQL chạy trên production, và logic đồng thời."

Điểm ăn điểm:
- Có quy trình, không chỉ có công cụ.
- Ranh giới dữ liệu rõ: chỉ DB dev, chỉ quyền đọc, script ghi qua người.
- Một ví dụ AI sai cụ thể, bắt được ở bước nào.
- Nói thẳng phần AI viết, và khẳng định giải thích được từng dòng.

#### Câu hỏi vặn
- **"Bạn review code AI viết như thế nào, cụ thể?"** Đọc từng diff như review code đồng nghiệp, đối chiếu với plan; build thật; chạy luồng chính trên DB dev; với thay đổi lớn thì thêm một lượt review riêng đối chiếu code với schema và yêu cầu. Thứ tôi soi kỹ nhất là tên cột, kiểu dữ liệu và điều kiện biên.
- **"Một lần AI viết sai mà bạn bắt được?"** `[điền một ví dụ thật]`. Câu trả lời tốt nói rõ sai gì, bắt được ở bước nào (đọc diff, build, hay chạy DB dev), và bạn thay đổi quy trình gì sau đó.
- **"Dữ liệu nội bộ có đi ra ngoài qua AI không?"** Công cụ chỉ đọc DB dev, không đọc production. Thông tin đăng nhập nằm trong biến môi trường, không đưa vào prompt. `[điền chính sách công ty về dùng AI nếu có]`.
- **"Code trong commit là AI viết hay bạn viết?"** Nói thật: AI sinh nháp theo plan, tôi review, chạy và sửa, commit có ghi AI là đồng tác giả. Tôi giải thích được từng dòng, và đó là tiêu chuẩn tôi tự đặt trước khi merge.
- **"Đo độ chính xác của AI thế nào?"** Ở luồng nhập dữ liệu trường, tôi lưu bản AI gốc ở lần lưu đầu, so với mỗi lần người duyệt lưu theo từng trường, ghi số trường đề xuất và số trường bị sửa. Bước đánh giá chỉ ghi log để không làm hỏng lần lưu.
- **"AI giúp nhanh hơn bao nhiêu?"** Tôi chưa đo một cách có hệ thống nên không đưa con số. Điều tôi thấy rõ là phần khảo sát code và soạn nháp nhanh hơn, còn phần kiểm tra thì không bớt được.
- **"Nếu một ngày không có AI thì sao?"** Quy trình vẫn chạy được, vì các skill và file ngữ cảnh là tài liệu người đọc được. AI làm nhanh hơn, không làm thay phần hiểu hệ thống.

#### Bẫy cần tránh
- Nói "AI viết 80% code" hoặc "tiết kiệm một nửa thời gian" khi chưa đo.
- Nói "tôi build MCP server" khi chỉ cấu hình server có sẵn.
- Không có ví dụ AI sai: nghe như chưa từng review thật.
- Né câu "AI viết hay bạn viết". Trả lời thẳng.

#### Nhớ nhanh
- Quy trình: file ngữ cảnh mỗi repo, skill cho việc lặp lại, MCP chỉ đọc DB dev.
- Bốn lớp kiểm: đọc diff, build thật, chạy DB dev, review đối kháng.
- Không tin AI ở: số liệu chưa đo, SQL production, logic đồng thời.
- Nói "set up" nếu chỉ cấu hình MCP; nói thật phần AI viết.

#### Bài tập
1. Viết ba quy tắc an toàn khi cho AI agent truy cập database.
   **Đáp án:** Chỉ DB dev; tài khoản chỉ đọc cho công cụ AI; script ghi chạy qua người, mặc định chạy thử rồi rollback, chỉ commit khi đã xem kết quả.
2. Viết câu trả lời 30 giây cho "AI viết hay bạn viết?" về luồng tạo lượt làm bài.
   **Đáp án:** "Claude Code sinh nháp theo plan từng pha. Tôi review từng diff, chạy trên DB dev và sửa cho khớp procedure mới. Tôi giải thích được từng bước trong 12 bước điều phối và vì sao lần ghi duy nhất nằm trong transaction."

### Bài 24.8. Tự tìm ra vấn đề không ai giao

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
"Kể về một vấn đề bạn tự phát hiện" kiểm tra tính chủ động: bạn có nhìn vào dữ liệu khi không ai bảo không, bạn có đủ tò mò để hỏi "vì sao con số này lạ" không, và bạn có theo đến tận lúc sửa xong không. Câu chuyện mạnh nhất là câu chuyện mà phần của bạn rõ ràng, có commit của chính bạn.

##### Sự kiện
Trong thống kê procedure của SQL Server, procedure lấy danh mục môn và vòng thi đã chạy khoảng 81 triệu lần kể từ khi plan được cache, mỗi lần trung bình khoảng 3,7 ms và 244 logical reads. Đây là dữ liệu cấu hình, rất ít đổi, lẽ ra phải nằm trong cache.

Đọc code cache, tôi tìm ra hai lỗi:
1. Thời gian sống (TTL) của cache dùng chung một biến đặt là 1 giây, nên cache gần như vô dụng.
2. Kết quả rỗng không bao giờ được cache, vì code coi list rỗng là cache miss. Các tổ hợp không có cấu hình luôn đi xuống DB.

Tôi sửa (commit 21/09, của tôi):
- Đổi sang key mới lưu JSON, quy ước `null` là chưa có cache, list rỗng là đã cache kết quả rỗng (negative caching).
- TTL 6 giờ, kèm hàm xóa cache để CMS gọi khi cấu hình thay đổi.
- Cùng commit: cache procedure lấy gói dịch vụ (khoảng 5 triệu lần chạy, khoảng 34 ms mỗi lần) bằng version key, để xóa cache chỉ cần tăng version thay vì tìm và xóa từng key; khử truy vấn N+1 ở API chứng chỉ.

Kết quả: theo dõi qua tốc độ tăng của `execution_count` và số span SQL trên APM; số cụ thể sau sửa `[điền nếu đã đo]`. Đánh đổi: dữ liệu cấu hình có thể cũ tối đa 6 giờ nếu CMS không gọi hàm xóa, chấp nhận được vì cấu hình đổi rất ít và đã có đường xóa chủ động.

##### Ý nghĩa của con số
81 triệu là số lần chạy cộng dồn trong DMV kể từ khi plan được cache, không phải "đã loại bỏ 81 triệu lần gọi". Muốn nói mức giảm phải đo tốc độ gọi: chụp `execution_count` hai lần cách nhau một khoảng, trước và sau khi sửa, cùng khung giờ. Không cộng số của hai procedure với nhau.

##### Version key là gì
Thay vì key cố định, key chứa một số phiên bản đọc từ một key khác: `goi:v{version}:{serviceId}`. Muốn xóa toàn bộ cache gói chỉ cần tăng `version`; các key cũ không ai đọc nữa và tự hết hạn theo TTL. Đây cũng là một cách tránh kiểu quét toàn bộ keyspace như ở Bài 24.2.

#### Cách show off
Mạch kể: tôi thấy con số lạ ở đâu → vì sao nó lạ (dữ liệu cấu hình mà chạy hàng chục triệu lần) → tôi đọc code tìm ra gì → tôi sửa thế nào và đánh đổi gì → đo ra sao → bài học. Nhấn vào khoảnh khắc "con số này không hợp lý", vì đó là thứ thể hiện tính chủ động.

> **Ví dụ:** "Một lần khi xem thống kê procedure trên SQL Server, tôi để ý procedure lấy danh mục môn và vòng thi đã chạy hàng chục triệu lần. Đó là dữ liệu cấu hình, cả học kỳ đổi vài lần, lẽ ra gần như không bao giờ phải xuống DB. Tôi mở code cache ra đọc và thấy hai lỗi: thời gian sống của cache chỉ một giây, và nếu kết quả rỗng thì code coi như chưa có cache, nên những tổ hợp không có cấu hình lần nào cũng gọi DB. Tôi đổi cách lưu để phân biệt 'chưa có cache' với 'đã cache kết quả rỗng', tăng thời gian sống lên vài giờ và thêm hàm để CMS xóa cache khi cấu hình đổi, rồi tự commit. Đánh đổi là cấu hình có thể cũ tối đa vài giờ nếu quên xóa, tôi chấp nhận vì đã có đường xóa chủ động. Bài học của tôi là cache phải được kiểm tra bằng số liệu thật, chứ không phải có code cache là coi như đã có cache."

Điểm ăn điểm:
- Nói được vì sao con số lạ: so với bản chất dữ liệu.
- Phân biệt "chưa có cache" và "đã cache kết quả rỗng": chi tiết chỉ người sửa thật mới nói ra.
- Nói đánh đổi độ tươi dữ liệu và cách giảm thiểu.
- Nói đúng nghĩa con số cộng dồn, không nói "loại bỏ 81 triệu lần gọi".

#### Câu hỏi vặn
- **"Sao không chỉ tăng TTL?"** TTL dài vẫn không cache kết quả rỗng, nên các tổ hợp không có cấu hình lần nào cũng xuống DB. Phải sửa cả hai lỗi: TTL và negative caching.
- **"Negative cache có rủi ro gì?"** Cấu hình vừa tạo vẫn bị coi là rỗng tới khi cache hết hạn. Xử lý bằng cách CMS gọi hàm xóa cache khi tạo hoặc sửa cấu hình, hoặc đặt TTL ngắn hơn riêng cho kết quả rỗng.
- **"Cache stampede khi key hết hạn thì sao?"** Với dữ liệu cấu hình, số tổ hợp nhỏ và mỗi lần nạp chỉ vài ms, nên hết hạn cùng lúc không đủ gây hại. Nếu tải lớn hơn, tôi thêm độ lệch ngẫu nhiên cho TTL hoặc khóa để chỉ một request nạp lại.
- **"Sao dùng Redis mà không dùng MemoryCache?"** Hệ thống chạy nhiều instance; Redis cho một nguồn cache chung nên xóa một lần là đúng ở mọi nơi. MemoryCache nhanh hơn nhưng phải phát tín hiệu xóa tới từng instance. Với dữ liệu nóng như vậy, kết hợp hai lớp là bước tiếp theo hợp lý.
- **"81 triệu có nghĩa là bạn bỏ được 81 triệu lần gọi không?"** Không. Đó là số lần chạy cộng dồn trong thống kê trước khi sửa. Mức giảm phải đo bằng tốc độ tăng của số lần chạy trước và sau, cùng khung giờ.
- **"Sau khi sửa giảm được bao nhiêu?"** `[điền nếu đã đo]`. Nếu chưa đo, nói thẳng là chưa có số và nói cách đo: chụp số lần chạy hai lần cách nhau một giờ, trước và sau, cùng khung giờ.
- **"Sao lỗi rõ thế mà trước đó không ai thấy?"** Vì hệ thống vẫn chạy, mỗi lần gọi chỉ vài ms, không có lỗi nào nổi lên. Vấn đề chỉ lộ ra khi nhìn tổng chi phí trên thống kê, và đó là lý do tôi coi việc xem thống kê định kỳ là một phần công việc.

#### Bẫy cần tránh
- Nói "tôi giảm 81 triệu lần gọi DB".
- Cộng số của hai procedure để có con số to hơn.
- Bỏ qua đánh đổi độ tươi dữ liệu.
- Kể như được giao việc: mất đúng điểm của câu hỏi này là tính chủ động.

#### Nhớ nhanh
- Phát hiện: dữ liệu cấu hình mà chạy hàng chục triệu lần trong thống kê procedure.
- Hai lỗi: TTL 1 giây dùng chung; kết quả rỗng không được cache.
- Sửa: phân biệt `null` với list rỗng, TTL 6 giờ, hàm xóa cache cho CMS, version key cho cache gói; commit 21/09 của bạn.
- Con số là cộng dồn; mức giảm đo bằng tốc độ gọi trước và sau.

#### Bài tập
1. Viết truy vấn đo tốc độ gọi của một procedure: chụp `execution_count` hai lần cách nhau một giờ.
   **Đáp án:**
   ```sql
   SELECT GETDATE() AS at, ps.execution_count
   FROM sys.dm_exec_procedure_stats ps
   WHERE ps.object_id = OBJECT_ID(N'dbo.ProcName')
     AND ps.database_id = DB_ID();
   -- Chạy lại sau 1 giờ, lấy hiệu chia 60 để có số lần mỗi phút; so cùng khung giờ trước và sau khi sửa.
   ```
2. Viết đoạn C# phân biệt "chưa có cache" với "đã cache list rỗng".
   **Đáp án:**
   ```csharp
   var json = await redis.StringGetAsync(key);
   if (json.IsNull)
   {
       var data = await LoadFromDb();
       await redis.StringSetAsync(key, JsonSerializer.Serialize(data), TimeSpan.FromHours(6)); // ghi cả list rỗng
       return data;
   }
   return JsonSerializer.Deserialize<List<Item>>(json.ToString())!; // có thể là list rỗng, vẫn là cache hit
   ```

## Chương 25. Trước buổi phỏng vấn

Phần lớn câu hỏi xoáy nhắm vào chỗ CV nói quá sự thật hoặc con số không rõ nguồn. Chương này gom những việc phải làm trước khi gửi CV và trước buổi phỏng vấn, cùng cách dùng 5–10 phút cuối buổi để hỏi lại người phỏng vấn.

Học xong, bạn có một danh sách tick được và một bộ câu hỏi hỏi lại có chủ đích.

### Bài 25.1. Rà CV và chuẩn bị trước buổi phỏng vấn

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
Mỗi dòng trong CV là một câu hỏi tiềm năng. Người phỏng vấn đọc CV để chọn chỗ đào sâu, và họ đặc biệt chú ý đến hai thứ: con số và động từ. "Built", "led", "p95", "4 products" là những chữ sẽ bị hỏi lại. Điều họ đánh giá không phải là CV có ấn tượng không, mà là mỗi chữ trong đó có đứng vững khi bị hỏi ba tầng không.

##### Ba loại dòng trong CV
Với từng dòng, tự xếp vào một trong ba loại:
- **Đã làm và có bằng chứng:** có commit, báo cáo, hoặc số đo. Kể được đủ ba tầng.
- **Làm một phần:** bạn làm một mảnh, team làm phần còn lại, hoặc lớp có sẵn trong nền tảng. Phải nói được ranh giới.
- **Mới ở mức thiết kế:** đề xuất, kế hoạch, hoặc hiểu biết chưa triển khai. Nếu để trong CV, phải nói như vậy khi bị hỏi.

Với dòng chỉ mới ở mức thiết kế, có ba cách xử lý: làm thật và đo; bỏ khỏi CV; hoặc chuẩn bị câu "ở dự án tôi chưa triển khai, nếu làm tôi sẽ thiết kế thế này, đo bằng cái này".

##### Những chỗ hay sai cần sửa trước khi gửi
- **"p95":** số màn bắt đầu thi thử từ khoảng 2,45 giây xuống khoảng 55 ms là trace điển hình. Hoặc đo p95 thật (bảy ngày trước và sau 16/09, cùng khung giờ), hoặc bỏ chữ "p95".
- **"Unified sign-on for 4 products":** phần đã làm thật là gia cố lớp BFF và SSO cho web IOE và IOSTEM. Sửa về đúng phạm vi.
- **"Built MCP servers":** nếu chỉ cài và cấu hình thì đổi thành "Set up".
- **Số service nâng lên .NET 10:** khoảng 12, phải đếm lại trước khi nói.

##### Mỗi con số cần trả lời được bốn câu
Đo cái gì? Đo bằng gì (APM, DMV, log)? Loại số nào (trace điển hình, trung bình, p95, cộng dồn, mục tiêu)? Trong khoảng thời gian nào? Con số nào không trả lời được cả bốn thì sửa hoặc bỏ.

#### Cách show off
Ở buổi phỏng vấn, việc rà CV thể hiện ra bằng cách bạn chủ động nói rõ loại số và ranh giới vai trò trước khi bị hỏi. Mạch trả lời khi bị hỏi về một dòng CV: dòng này nói về việc gì → phần tôi làm → số đo bằng gì → giới hạn hoặc phần chưa làm.

> **Ví dụ:** "Dòng này cần nói rõ một chút. Con số giảm thời gian màn bắt đầu thi thử là tôi so hai trace trên APM trước và sau bản sửa, không phải p95 trong một khoảng thời gian. Phần tôi làm là điều tra, tìm ra nguyên nhân ở Redis và đề xuất cách sửa; đồng nghiệp tôi commit bản sửa đó. Nếu cần p95, tôi sẽ lấy trên APM cho đúng endpoint, bảy ngày trước và sau ngày sửa, cùng khung giờ, để loại trừ khác biệt về tải."

Điểm ăn điểm:
- Tự nói loại số trước khi bị hỏi.
- Tự nói ranh giới vai trò.
- Với việc chưa làm, nói cách sẽ làm và cách sẽ đo, không né.

#### Checklist
- [ ] Xếp từng dòng CV vào một trong ba loại: đã làm có bằng chứng, làm một phần, mới ở mức thiết kế.
- [ ] Với mỗi dòng mới ở mức thiết kế: làm thật và đo, hoặc bỏ khỏi CV, hoặc chuẩn bị câu "chưa triển khai, tôi sẽ làm thế này".
- [ ] Đo p95 thật hoặc bỏ chữ "p95" ở phần Summary và dòng kinh nghiệm đầu tiên.
- [ ] Sửa "Unified sign-on for 4 products" về đúng phạm vi đã làm.
- [ ] Đổi "Built … MCP servers" thành "Set up" nếu chỉ cài và cấu hình.
- [ ] Xác nhận cloud thật ở AvePoint (Azure hay khác) và team có chạy Scrum không.
- [ ] Đếm lại số service đã nâng lên .NET 10.
- [ ] Với mỗi con số trong CV: biết đo cái gì, đo bằng gì, loại số nào, trong khoảng thời gian nào.
- [ ] Điền hoặc bỏ mọi chỗ `[điền ...]` trong Chương 24.
- [ ] Đọc lại các bài bảo vệ CV cho những việc đã làm và có bằng chứng.
- [ ] Tự trả lời thành tiếng từng câu hỏi vặn, mỗi câu dưới hai phút.
- [ ] Làm thử đề system design nền tảng thi trực tuyến (Chương 16) trên giấy trong 40 phút.
- [ ] Vẽ được kiến trúc nền tảng hiện tại (service, DB, Redis, Kafka, gRPC) trong ba phút.
- [ ] Mock interview ít nhất hai lần với người chịu hỏi xoáy.

#### Câu hỏi vặn
- **"Con số này bạn đo bằng gì, trong khoảng thời gian nào?"** Trả lời theo nguồn thật: trace APM trước và sau, số cộng dồn trong DMV kể từ khi plan được cache, hoặc mục tiêu chưa đo. Không có số đo thì nói là chưa đo, và nói sẽ đo thế nào.
- **"Dòng này bạn làm hay team làm?"** Tách phần của bạn (có commit hoặc báo cáo) với phần đồng nghiệp hoặc lớp có sẵn trong nền tảng. Nói ranh giới trước khi họ phải hỏi lần hai.
- **"Phần này đã triển khai chưa?"** Theo sự thật. Nếu là đề xuất: "chưa triển khai, tôi sẽ làm thế này", kèm cách đo kết quả.
- **"CV ghi p95, p95 là bao nhiêu?"** Nếu chưa sửa CV kịp: nhận ngay là số trong CV là trace điển hình, dùng chữ p95 là chưa chính xác, rồi nói cách sẽ đo p95. Nhận sớm tốt hơn nhiều so với bị bắt.
- **"Sao CV ghi 4 sản phẩm mà bạn chỉ kể 2?"** Nói đúng phạm vi đã làm: gia cố BFF và SSO cho web IOE và IOSTEM. Phần còn lại là `[điền: nền tảng có sẵn hay team khác làm]`.
- **"Bạn tự đánh giá mình ở mức nào so với vị trí senior?"** Dùng sự kiện: những việc đã dẫn dắt, phạm vi ảnh hưởng, và một điểm còn muốn phát triển, nói cụ thể.

#### Bẫy cần tránh
- Để nguyên chữ "p95", "built", "4 products" và hy vọng không ai hỏi.
- Bảo vệ một dòng CV sai đến cùng. Nhận sớm và sửa ngay trong câu trả lời.
- Chỉ học thuộc câu trả lời mà không nói thành tiếng. Câu trả lời hay trên giấy thường dài gấp đôi khi nói.

#### Nhớ nhanh
- Xếp từng dòng CV: đã làm có bằng chứng, làm một phần, mới ở mức thiết kế.
- Sửa "p95", "4 products", "Built MCP servers", số service trước khi gửi.
- Mỗi con số: đo cái gì, bằng gì, loại số nào, khoảng thời gian nào.
- Luyện nói thành tiếng, dưới hai phút mỗi câu; mock interview ít nhất hai lần.

#### Bài tập
1. Chọn ba dòng CV bất kỳ, xếp loại và viết một câu nói an toàn cho mỗi dòng.
   **Đáp án:** Ví dụ dòng rà soát nhiều cụm SQL Server thuộc loại làm một phần: "Tôi dẫn đợt rà soát, xếp hạng điểm nóng và đề xuất cách sửa; team cùng triển khai các bản sửa."
2. Viết các bước lấy p95 của API bắt đầu thi thử để thay chữ "p95" trong CV.
   **Đáp án:** Trên APM, lọc transaction của đúng API đó, lấy p95 bảy ngày trước và bảy ngày sau 16/09, cùng khung giờ cao điểm; ghi lại nguồn, khoảng thời gian và số request để con số có ngữ cảnh.

### Bài 25.2. Câu hỏi hỏi lại và phần cuối buổi phỏng vấn

#### Kiến thức

##### Người hỏi muốn đánh giá điều gì
Câu "bạn có câu hỏi gì cho chúng tôi không?" không phải phép lịch sự. Người phỏng vấn nghe xem bạn quan tâm tới điều gì: lương và ngày nghỉ, hay hệ thống đang gặp vấn đề gì và mình sẽ chịu trách nhiệm phần nào. Câu hỏi lại tốt cho thấy bạn nghĩ như người sẽ sở hữu hệ thống, đồng thời cho bạn dữ liệu để quyết định có nhận việc không. Hỏi 2–3 câu có chủ đích, tránh câu đã có câu trả lời trên website.

##### Câu hỏi về kỹ thuật
- Hệ thống đang gặp vấn đề hiệu năng hoặc độ tin cậy lớn nhất ở đâu?
- Sự cố production gần nhất là gì, team xử lý và rút kinh nghiệm thế nào?
- Có SLO, có trực on-call, có viết postmortem không? Ai trực?
- Một thay đổi mất bao lâu từ lúc merge đến lúc lên production? Review và deploy thế nào?

##### Câu hỏi về vai trò và team
- Sáu tháng đầu, người ở vị trí này được kỳ vọng làm được gì?
- Ở đây senior khác mid ở điểm nào khi đánh giá?
- Ai ra quyết định kiến trúc, và quyết định gần nhất được đưa ra thế nào?

##### Vòng cuối và đãi ngộ
- **Vòng với quản lý:** quản lý hay hỏi cách làm việc hơn chi tiết kỹ thuật. Chuẩn bị kỹ câu chuyện dẫn dắt (Bài 24.6) và câu chuyện sai lầm (Bài 24.4).
- **Đãi ngộ:** biết trước mức mong muốn và mức tối thiểu. Nói một khoảng, có lý do (phạm vi công việc, mặt bằng thị trường), hỏi lại cơ cấu đãi ngộ nếu cần.
- **Kết thúc:** tóm tắt một hai câu vì sao bạn hợp vị trí, dựa trên điều vừa nghe trong buổi, không dựa trên bài chuẩn bị sẵn.

> **Mẹo:** Ghi lại câu trả lời của người phỏng vấn cho các câu hỏi lại. Đó là dữ liệu để so sánh giữa các offer.

#### Cách show off
Câu hỏi lại mạnh nhất nối vào điều vừa được nghe trong buổi. Mạch: nhắc lại điều họ nói → hỏi sâu một tầng → nếu phù hợp, nói ngắn một kinh nghiệm thật liên quan. Đừng biến phần hỏi lại thành lượt kể chuyện thứ hai; một câu là đủ.

> **Ví dụ:** "Lúc nãy anh có nhắc hệ thống hay chậm vào giờ cao điểm. Em muốn hỏi thêm: hiện team phát hiện chuyện đó qua cảnh báo hay qua phản ánh của người dùng, và đã có trace để biết thời gian nằm ở đâu chưa? Em hỏi vì ở chỗ hiện tại, lần em tìm ra nguyên nhân nhanh nhất là nhờ mở trace thấy thời gian nằm ở Redis chứ không phải ở database như mọi người nghĩ."

Điểm ăn điểm:
- Câu hỏi nối vào điều vừa nghe, không phải câu học thuộc.
- Hỏi về sự cố, on-call, cách ra quyết định: cho thấy bạn nghĩ về vận hành, không chỉ về code.
- Kết buổi bằng một câu nối kinh nghiệm thật với vấn đề họ vừa kể.

#### Câu hỏi vặn
- **"Bạn có câu hỏi gì cho chúng tôi không?"** Luôn có. Hỏi về vấn đề lớn nhất của hệ thống, sự cố gần nhất và cách team xử lý, và kỳ vọng sáu tháng đầu. Ưu tiên câu nối vào điều họ vừa nói.
- **"Vì sao bạn muốn rời công ty hiện tại?"** Nói về điều muốn đạt tới (phạm vi hệ thống, quy mô, vai trò), không chê công ty cũ. `[điền lý do thật của bạn]`.
- **"Mức lương mong muốn của bạn là bao nhiêu?"** Đưa một khoảng có lý do, dựa trên phạm vi công việc và mặt bằng thị trường; hỏi lại cơ cấu đãi ngộ (thưởng, review lương) nếu cần.
- **"Vì sao chúng tôi nên chọn bạn?"** Một câu nối kinh nghiệm thật với vấn đề họ vừa kể. Ví dụ: "Anh chị nói hệ thống chậm ở giờ cao điểm; tôi đã dẫn một đợt rà soát hiệu năng từ APM xuống thống kê SQL Server cho đúng loại vấn đề đó."
- **"Điểm yếu lớn nhất của bạn là gì?"** Một điểm yếu thật, cụ thể, kèm việc bạn đang làm để cải thiện. Không dùng điểm mạnh giả dạng điểm yếu. `[điền điểm yếu thật]`.
- **"Bạn có đang phỏng vấn ở nơi khác không?"** Trả lời thật, ngắn, không nêu tên nếu không cần; nói tiêu chí bạn dùng để chọn.

#### Bẫy cần tránh
- Trả lời "em không có câu hỏi gì". Nghe như không quan tâm.
- Hỏi câu có sẵn trên website, hoặc mở đầu bằng lương và ngày nghỉ ở vòng kỹ thuật.
- Chê công ty cũ hoặc sếp cũ.
- Đưa một con số lương duy nhất mà không có lý do.

#### Nhớ nhanh
- Hỏi lại 2–3 câu có chủ đích: vấn đề lớn nhất, sự cố gần nhất, kỳ vọng sáu tháng.
- Câu hỏi tốt nhất nối vào điều vừa nghe trong buổi.
- Vòng quản lý: chuẩn bị chuyện dẫn dắt và chuyện sai lầm.
- Đãi ngộ: nói một khoảng có lý do; kết buổi bằng một câu nối kinh nghiệm thật với vấn đề của họ.

#### Bài tập
1. Viết ba câu hỏi lại cho một công ty thương mại điện tử và ba câu cho một công ty edtech.
   **Đáp án:** Thương mại điện tử: đỉnh tải ngày sale xử lý thế nào, chống trừ tiền hai lần ra sao, sự cố gần nhất. Edtech: tải dồn theo ca thi xử lý thế nào, cách chống gian lận, quy trình release trong mùa thi.
2. Viết câu kết thúc 20 giây cho một buổi mà người phỏng vấn nói hệ thống đang gặp vấn đề với báo cáo chậm.
   **Đáp án:** "Anh chị nói báo cáo đang chậm và kéo theo DB chính. Tôi đã làm phần API cho kho dữ liệu báo cáo nạp tăng dần bằng job SQL Agent, và hiểu các bước tiếp theo nếu cần gần thời gian thực: tách sang replica, dùng columnstore, rồi đến CDC."
