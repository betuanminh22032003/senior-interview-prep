# Phần I. Nhập môn

Phần này chưa dạy kỹ thuật. Nó dạy cách biến những việc bạn đã làm thành câu trả lời mà người phỏng vấn senior muốn nghe: có mạch, có lý do, có bằng chứng, và trung thực ở những chỗ mình chưa làm. Mọi phần sau trong sách đều dùng chung cách kể chuyện và cách nói về con số ở đây, nên hãy đọc phần này trước.

## Chương 1. Luật chơi của buổi phỏng vấn senior

Người phỏng vấn senior hiếm khi hỏi định nghĩa. Họ chọn một việc bạn kể, rồi hỏi sâu dần cho tới khi gặp chỗ bạn không trả lời được. Ở mức junior, chỗ dừng đó thường là "vì sao". Ở mức senior, chỗ dừng thường là "sao anh biết là đúng" và "nếu sai thì sao".

Chương này đi qua bốn việc: buổi phỏng vấn diễn ra thế nào và người hỏi đang tìm gì; cách kể một câu chuyện kỹ thuật có mạch; cách dùng con số cho người nghe hiểu và cách nói trung thực về việc chưa làm; cuối cùng là lộ trình ôn tập bốn tuần với cuốn sách này.

### Bài 1.1. Một buổi phỏng vấn senior diễn ra thế nào

#### Kiến thức

##### Các vòng thường gặp và mỗi vòng tìm gì

Một quy trình tuyển senior backend thường có bốn kiểu vòng, có thể gộp hoặc tách tùy công ty:

| Vòng | Người hỏi làm gì | Tín hiệu họ tìm |
|---|---|---|
| Đào sâu kinh nghiệm | Chọn một dự án bạn kể, hỏi xuống từng lớp | Bạn thật sự làm gì, hiểu tới đâu, quyết định có lý do không |
| Kiến thức nền | Hỏi .NET, SQL, cache, hệ phân tán theo những gì bạn nhắc tới | Hiểu cơ chế chứ không chỉ biết tên công nghệ |
| System design | Đưa một bài toán mở, bạn thiết kế trong 45–60 phút | Biết hỏi yêu cầu, ước lượng, chọn và bỏ có lý do |
| Hành vi | "Kể về một lần bạn…" | Cách bạn xử lý sự cố, bất đồng, sai lầm, dẫn dắt người khác |

Vòng đào sâu kinh nghiệm là nơi senior được phân biệt rõ nhất, vì không học thuộc được. Người hỏi không cần biết hệ thống của bạn; họ chỉ cần hỏi đủ sâu để thấy bạn có tự mình đi qua vấn đề đó hay không.

##### Senior khác junior ở câu trả lời nào

Cùng một câu hỏi "màn hình đó chậm, anh xử lý thế nào", hai câu trả lời khác nhau ở chỗ:

- Junior trả lời **dùng gì**: "Em thêm cache Redis."
- Senior trả lời **vì sao, đổi lấy gì, sao biết đúng**: "Trước khi sửa tôi đo xem thời gian đi đâu. Trace cho thấy 90% nằm ở một lệnh quét Redis, không phải ở database. Tôi chọn cách giữ một danh sách key cần xóa thay vì quét, đổi lại phải nhớ cập nhật danh sách ở mọi chỗ ghi. Sau khi sửa tôi so trace cùng màn hình, lệnh quét biến mất."

Người hỏi chấm, dù không nói ra: phạm vi quyết định của bạn, cách cân nhắc đánh đổi, thói quen đo trước khi sửa, ý thức rủi ro vận hành (giờ cao điểm, rollback), khả năng giải thích cho người ngoài, và sự trung thực.

##### Ba tầng đào sâu

Người phỏng vấn có kinh nghiệm thường hỏi sâu dần qua ba tầng:

| Tầng | Họ muốn biết | Câu hỏi điển hình | Bạn cần có |
|---|---|---|---|
| 1. Làm gì | Phạm vi và vai trò của bạn | "Anh làm phần nào? Ai làm phần còn lại?" | Tách rõ "tôi" và "team" |
| 2. Làm thế nào | Cơ chế, lựa chọn, đánh đổi | "Sao chọn cách này? Có cách nào khác?" | Hiểu tới mức vẽ được trên bảng |
| 3. Sao biết là đúng | Bằng chứng và cách đo | "Đo bằng gì? Trong bao lâu? So với cái gì?" | Công cụ, cửa sổ đo, số trước và sau |

Tầng 1 lọc người kể lại việc của cả team như việc của mình. Tầng 2 lọc người chỉ biết tên công nghệ. Tầng 3 lọc người nói con số mà chưa từng đo.

> **Ghi nhớ:** Dùng "tôi" cho phần mình làm, "team" cho phần làm chung. Câu "phần đó đồng nghiệp làm, tôi làm phần này" được đánh giá cao hơn nhiều so với nhận hết rồi bị lộ ở tầng 2.

##### Một câu chuyện đi qua ba tầng

Bối cảnh: hệ thống thi tiếng Anh trực tuyến cho học sinh cả nước, giờ cao điểm hàng trăm nghìn em vào thi cùng lúc. Có một đợt bạn dẫn việc rà soát hiệu năng database và các API chậm.

- **Tầng 1.** "Tôi dẫn đợt rà soát: đọc dữ liệu từ công cụ trace request và từ thống kê của SQL Server, xếp hạng các điểm nóng, đề xuất cách sửa. Ba bản sửa đầu tiên do đồng nghiệp commit."
- **Tầng 2.** "API bắt đầu bài thi thử chậm bất thường. Trace cho thấy hàm làm mới cache dùng lệnh `SCAN` quét toàn bộ Redis hàng trăm vòng để tìm key cần xóa. Cách sửa là giữ một Redis SET làm danh mục các key liên quan, khi cần thì xóa thẳng từng key trong danh mục, không quét nữa."
- **Tầng 3.** "Tôi so một trace điển hình trước và sau khi sửa trên Elastic APM: từ hơn 2 giây xuống khoảng 50 mili giây, và trace sau không còn lệnh `SCAN`. Tôi chưa đo phân vị 95 trên một khoảng thời gian dài, nên tôi gọi đúng nó là trace điển hình."

Câu trả lời tầng 3 ở trên trung thực và vẫn thuyết phục, vì nó chỉ ra **nguyên nhân đã biến mất**, không chỉ "tổng thời gian giảm".

##### Vì sao chuyện mượn luôn lộ ở tầng 3

Một việc bạn không tự làm vẫn có thể qua tầng 1 và tầng 2 nếu bạn học kỹ cơ chế. Tầng 3 hỏi thứ chỉ người trong cuộc mới có: tên dashboard và metric, khoảng thời gian đo, số trước khi sửa, những lần thử không thành, ai xác nhận được, rollback mất bao lâu. Thiếu những chi tiết này, câu trả lời sẽ chung chung và người hỏi sẽ hỏi tiếp cho tới khi bạn dừng.

##### Chuẩn bị bằng chứng trước buổi phỏng vấn

Với mỗi câu chuyện bạn định kể, chuẩn bị:

- [ ] Ảnh chụp trace hoặc biểu đồ trước và sau (lưu riêng cho bạn ôn, không mang tài liệu nội bộ ra ngoài).
- [ ] Kết quả truy vấn thống kê của SQL Server, ghi rõ thời điểm chạy.
- [ ] Ngày commit và phạm vi thay đổi của chính bạn.
- [ ] Một câu nói rõ phần nào là của đồng nghiệp.
- [ ] Một điều bạn sẽ làm khác nếu làm lại.

#### Cách show off

Đừng chờ bị hỏi tới tầng 3. Khi kể, tự đi qua cả ba tầng trong một mạch ngắn: một câu bối cảnh, phần của bạn, cơ chế và lựa chọn, rồi cách bạn biết nó đúng. Người hỏi sẽ thấy bạn quen tự kiểm chứng việc mình làm, và các câu hỏi tiếp theo sẽ là câu hỏi mở rộng chứ không phải câu hỏi bắt lỗi.

> **Ví dụ:** "Hệ thống của tôi là nền tảng thi tiếng Anh trực tuyến, giờ cao điểm rất đông học sinh vào thi cùng lúc. Có một đợt tôi được giao rà soát vì sao màn bắt đầu thi thử chậm. Tôi không đoán mà mở trace từng request, thấy gần hết thời gian nằm ở một lệnh quét toàn bộ Redis để xóa cache. Tôi đề xuất bỏ quét, thay bằng một danh mục key được cập nhật mỗi khi ghi; đồng nghiệp tôi là người commit bản sửa. So trace trước và sau, màn đó từ hơn 2 giây xuống dưới 0,1 giây, và lệnh quét không còn xuất hiện. Đó là trace điển hình, tôi chưa có số phân vị trên cả tuần, nếu cần tôi biết lấy ở đâu."

Điểm ăn điểm:

- **Tách "tôi" và "team" ngay từ đầu**, không đợi bị hỏi. Người hỏi tin phần còn lại hơn.
- **Nói đo trước khi sửa.** "Tôi mở trace trước" là một câu ngắn nhưng là tín hiệu senior rõ nhất.
- **Nói giới hạn của số đo.** "Đây là trace điển hình, chưa phải p95" làm bạn đáng tin hơn là làm bạn yếu đi.
- **Chỉ ra nguyên nhân biến mất**, không chỉ tổng thời gian giảm: tổng thời gian có thể giảm vì tải giảm.

#### Câu hỏi vặn
- **"Trong kết quả này, phần nào là của anh, phần nào của team?"** Tách theo việc cụ thể, không theo cảm giác: "Tôi phân tích dữ liệu trace và thống kê SQL, xếp hạng điểm nóng và đề xuất cách sửa. Ba bản sửa đầu do đồng nghiệp commit. Phần sửa cache cho procedure đọc cấu hình là tôi tự làm và commit." Đừng dùng "chúng tôi" cho mọi thứ, người hỏi sẽ hỏi lại "cụ thể anh".
- **"Con số đó anh đo bằng gì, trong khoảng thời gian nào?"** Trả lời đủ ba ý: công cụ (ví dụ Elastic APM, thống kê có sẵn của SQL Server), cửa sổ đo (một request, một giờ, bảy ngày), và loại số (một trace, trung bình, hay phân vị 95). Nếu chỉ là một trace điển hình, nói đúng như vậy.
- **"Sao anh biết nó nhanh lên là nhờ bản sửa, không phải vì hôm đó ít người dùng?"** So cùng khung giờ, cùng ngày trong tuần, với lượng request tương đương, và đưa kèm số request để chứng minh tải không giảm. Với trace, chỉ ra đoạn gây chậm đã biến mất, ví dụ không còn lệnh `SCAN`, chứ không chỉ tổng thời gian.
- **"Nếu làm lại, anh sẽ làm khác điều gì?"** Chọn một điều thật và cụ thể, ví dụ: "Tôi sẽ giữ cờ chuyển về luồng cũ trong file cấu hình tới hết đợt thi đầu tiên, thay vì gỡ nó ngay trong ngày." Trả lời "không có gì" là tín hiệu xấu.
- **"Có ai xác nhận được kết quả này không?"** Nêu vai trò, không cần nêu tên: DBA của cụm, quản lý trực tiếp, người review commit. Nếu thật sự không ai xác nhận được, đó là dấu hiệu câu chuyện này chưa nên kể như việc đã làm.
#### Bẫy cần tránh

- **Kể toàn bộ bằng "chúng tôi".** Nghe như né trách nhiệm. Thay bằng "tôi làm X, team làm Y".
- **Đọc một chuỗi con số không có ngữ cảnh.** Người hỏi không có tài liệu của bạn trước mặt; họ chỉ nhớ câu chuyện, không nhớ số.
- **Nhận một việc mình chỉ đứng xem.** Một lần bị lộ ở tầng 2 làm mất điểm của cả những câu chuyện thật.

#### Nhớ nhanh
- Người hỏi đào ba tầng: làm gì, làm thế nào, sao biết là đúng.
- Senior trả lời "vì sao, đổi lấy gì, sao biết đúng", không chỉ "dùng gì".
- Chuyện không tự làm có thể qua tầng 1 và 2 nhưng luôn lộ ở tầng 3.
- Tự kể tới tầng 3 trước khi bị hỏi; chỉ ra nguyên nhân đã biến mất.
- Chuẩn bị bằng chứng cho từng câu chuyện: trace, số trước/sau, ngày commit, phần của đồng nghiệp.

#### Bài tập
1. Chọn việc bạn viết lại luồng làm bài thi để bỏ các stored procedure đọc chéo nhiều database. Viết ba câu trả lời ngắn cho ba tầng.
   **Đáp án:** Tầng 1: tôi viết lại luồng làm bài; lớp khóa Redis và khóa chống gửi trùng phía trên do đồng nghiệp viết. Tầng 2: code C# lần lượt đọc dữ liệu từ ba database, rồi ghi một lần duy nhất trong một transaction, nhận danh sách câu trả lời qua table-valued parameter, và kiểm tra lại hạn mức trong transaction có `UPDLOCK, HOLDLOCK` để hai request song song không cùng vượt hạn mức. Tầng 3: số procedure còn đọc chéo database trước và sau khi chuyển, kiểm tra bằng cách tìm tên ba phần `Db.schema.object` trong định nghĩa các procedure.

### Bài 1.2. Kể một câu chuyện kỹ thuật có mạch

#### Kiến thức

##### Vì sao cần mạch kể

Người nghe không có sơ đồ hệ thống của bạn. Nếu bạn nhảy thẳng vào "tôi đổi TTL và thêm negative cache", họ không biết vấn đề là gì, vì sao nó quan trọng, và bạn đã cân nhắc gì. Một câu chuyện có mạch giúp họ theo kịp và cho họ chỗ để hỏi đúng thứ bạn muốn được hỏi.

##### Năm nhịp của một câu chuyện kỹ thuật

| Nhịp | Nói gì | Độ dài |
|---|---|---|
| 1. Vấn đề | Hệ thống gì, chuyện gì xảy ra, ai bị ảnh hưởng. Một hai câu, người ngoài nghe hiểu | ~15% |
| 2. Điều tra | Bạn đo gì, nhìn vào đâu, loại trừ giả thuyết nào | ~20% |
| 3. Lựa chọn và đánh đổi | Các phương án, chọn cái nào, bỏ cái nào, đổi lấy gì | ~35% |
| 4. Kết quả | Một hai con số có ngữ cảnh, hoặc dấu hiệu nguyên nhân đã hết | ~15% |
| 5. Bài học | Điều bạn rút ra hoặc sẽ làm khác | ~15% |

Đây là STAR (Situation, Task, Action, Result) được chỉnh cho câu chuyện kỹ thuật: phần Action được tách thành "điều tra" và "lựa chọn", vì đó là nơi người hỏi thấy phán đoán của bạn. Phần bài học là thứ nhiều người bỏ quên nhưng lại là câu người hỏi nhớ lâu nhất.

Ba lỗi thường gặp: kể bối cảnh quá dài; kể hành động bằng "chúng tôi" từ đầu đến cuối; kết quả không có số, hoặc có số nhưng không biết đo thế nào.

##### Ví dụ đầy đủ: một procedure bị gọi quá nhiều lần

> **Ví dụ:** **Vấn đề.** Khi rà soát thống kê của SQL Server, tôi thấy procedure lấy danh mục môn và vòng thi nằm đầu bảng số lần chạy, khoảng 81 triệu lần kể từ lúc được nạp vào cache [điền: khoảng bao nhiêu ngày]. Đây là dữ liệu cấu hình, gần như không đổi trong ngày, và đã có lớp cache phía trước. **Điều tra.** Tôi đọc code lớp cache và thấy hai lỗi: thời gian sống của cache dùng chung một biến chỉ 1 giây, nên gần như không có tác dụng; và code coi danh sách rỗng là "chưa có cache", nên các tổ hợp không có cấu hình lần nào cũng đi xuống database. **Lựa chọn.** Tôi cân nhắc thêm cache trong bộ nhớ từng máy, nhưng khi admin đổi cấu hình thì phải xóa trên nhiều máy, nên giữ Redis. Tôi lưu kết quả dạng JSON với quy ước rõ: không có key là chưa cache, danh sách rỗng là đã cache kết quả rỗng; đặt thời gian sống 6 giờ và thêm hàm xóa cache để trang quản trị gọi khi đổi cấu hình. **Kết quả.** Không thêm hạ tầng mới; tốc độ tăng của số lần chạy procedure là thước đo theo dõi. **Bài học.** Cache cho kết quả "không có gì" phải được thiết kế có chủ đích, nếu không phần đó sẽ luôn rơi xuống database.

Lưu ý phần kết quả: nếu chưa đo số lần gọi mỗi phút trước và sau, đừng tự đặt ra con số. Nói cách bạn theo dõi là đủ; khi đã đo thì thay bằng số thật.

##### Chọn câu chuyện cho các câu hỏi hay gặp

Chuẩn bị sẵn một câu chuyện thật cho mỗi kiểu câu hỏi:

| Câu hỏi | Câu chuyện có thể dùng |
|---|---|
| Sự cố hoặc vấn đề hiệu năng lớn nhất | Đợt rà soát hiệu năng và màn bắt đầu thi thử chậm vì lệnh quét Redis |
| Tự phát hiện vấn đề không ai giao | Hai lỗi cache khiến procedure cấu hình bị gọi hàng chục triệu lần |
| Quyết định kỹ thuật phải bảo vệ | Không đặt timeout ngắn cho lời gọi gRPC gửi sự kiện; không thêm index trên bảng log ghi liên tục |
| Một lần bạn sai | Gỡ cờ chuyển về luồng cũ quá sớm, ngay trong ngày phát hành |
| Bất đồng với team khác | Kế hoạch sửa procedure trong ngày, để DBA tạo index vào ca đêm |
| Dùng AI thế nào | Dùng Claude Code sinh nháp theo kế hoạch, tự review từng diff, build và chạy thật trên database dev |

Mỗi câu chuyện viết dàn ý năm dòng, mỗi nhịp một dòng, không viết nguyên văn để học thuộc.

##### Bản ngắn và bản sâu

Mỗi câu chuyện cần hai độ dài: bản ngắn khoảng 90 giây đến 2 phút, và bản sâu cho khi người hỏi muốn đào tiếp. Mở bằng bản ngắn, kết thúc bằng một câu móc sang chỗ bạn muốn được hỏi ("phần khó nhất thật ra là xóa cache khi admin đổi cấu hình"). Người hỏi thường đi theo móc đó.

#### Cách show off

Câu chuyện "một lần bạn sai" là nơi dễ ghi điểm nhất nếu kể đúng mạch, vì nó cho thấy bạn tự nhìn lại được.

> **Ví dụ:** "Khi đưa luồng làm bài mới lên production, tôi có một cờ trong file cấu hình để chuyển về luồng cũ nếu có lỗi. Ngay trong ngày phát hành, thấy luồng mới chạy ổn, tôi gỡ cờ đó và để luồng mới chạy cố định trong code cho gọn. Không có sự cố nào xảy ra, nhưng sau đó tôi nhận ra nếu có lỗi thì muốn quay lại phải build và deploy lại, mất cả chục phút thay vì đổi một dòng cấu hình. Với một hệ thống thi, mười phút giữa giờ thi là quá dài. Từ đó tôi giữ cờ quay lui tới hết đợt thi lớn đầu tiên, rồi mới dọn."

Điểm ăn điểm:

- **Nói phương án đã bỏ và vì sao.** "Tôi cân nhắc cache trong bộ nhớ nhưng bỏ vì khó xóa đồng bộ" cho thấy bạn có lựa chọn, không chỉ làm theo thói quen.
- **Nói đánh đổi bằng lời của người vận hành**: thời gian rollback, ai bị ảnh hưởng, giờ cao điểm.
- **Chọn lỗi thật có hậu quả nhỏ** cho câu "một lần bạn sai". Lỗi giả kiểu "tôi quá cầu toàn" bị nhận ra ngay.
- **Kết bằng bài học áp dụng được**, không phải "tôi học được là phải cẩn thận".

#### Câu hỏi vặn
- **"Kể về vấn đề hiệu năng lớn nhất anh từng xử lý?"** Dùng đợt rà soát hiệu năng. Vấn đề: màn bắt đầu thi thử chậm hơn 2 giây giờ cao điểm. Điều tra: trace request, rồi thống kê SQL Server, rồi đọc code; tìm ra lệnh quét toàn bộ Redis để xóa cache. Lựa chọn: thay bằng danh mục key. Kết quả: trace điển hình xuống dưới 0,1 giây, lệnh quét biến mất. Nói rõ ai commit bản sửa.
- **"Kể một quyết định kỹ thuật anh phải bảo vệ trước người khác?"** Không đặt timeout ngắn cho lời gọi gRPC gửi sự kiện sang service khác: service nhận có lúc chậm vài giây, timeout ngắn sẽ làm rơi sự kiện, tức đổi hành vi nghiệp vụ; lời gọi đã chạy nền nên không giữ request của người dùng. Nếu bị hỏi tiếp "vậy nếu service đó treo hẳn thì sao": nói bạn cần một giới hạn trên dài và một hàng đợi hoặc cơ chế gửi lại, đó là phần chưa làm.
- **"Kể một lần anh bất đồng với team khác?"** Bảng lớn thiếu index, nhưng server chạy SQL Server Standard Edition, không có tạo index online, nên tạo index giữa ngày sẽ khóa bảng trong giờ thi. Tôi tách hai bước: sửa procedure ngay trong ngày bằng `ALTER PROCEDURE`, phần index giao DBA chạy vào ca đêm. Kết quả chỉ nói phần đã xảy ra; trạng thái index ca đêm [điền: DBA đã tạo index chưa].
- **"Anh dùng AI trong công việc thế nào, và không tin AI ở đâu?"** Tôi dùng Claude Code sinh nháp theo kế hoạch từng bước, tự đọc từng diff, build trên máy thật, chạy với database dev. Tôi không tin AI ở tên bảng, tên cột, tên procedure (dễ bịa), ở logic đồng thời và transaction, và ở số liệu. Tài liệu nội bộ do AI soạn nháp, tôi review trước khi dùng.
- **"Nếu tôi hỏi sâu vào phần anh không làm, anh trả lời thế nào?"** "Tôi nói rõ phần đó ai làm, giải thích ở mức tôi hiểu, và nói chỗ nào tôi không chắc." Đưa ví dụ thật: lớp khóa Redis trong luồng làm bài do đồng nghiệp viết, tôi biết nó chặn hai request cùng ghi một bài, nhưng chi tiết thời gian khóa thì tôi không tự quyết.

#### Bẫy cần tránh

- **Bối cảnh dài hai phút** trước khi tới vấn đề. Người hỏi mất kiên nhẫn trước phần hay nhất.
- **Đổi "tôi" thành "chúng tôi" đúng ở đoạn khó.** Người hỏi nhận ra ngay và sẽ hỏi lại chính đoạn đó.
- **Kết quả chỉ có tính từ**: "nhanh hơn nhiều", "ổn định hơn". Thay bằng một con số có ngữ cảnh, hoặc một dấu hiệu cụ thể như "lệnh quét không còn trong trace".
- **Nói "theo best practice" mà không nêu được của ai.** Nêu nguồn: tài liệu Microsoft, tài liệu Redis, sách SRE của Google.

#### Nhớ nhanh
- Năm nhịp: vấn đề → điều tra → lựa chọn và đánh đổi → kết quả → bài học.
- Phần lựa chọn dài nhất; luôn nói phương án đã bỏ và vì sao.
- Mỗi kiểu câu hỏi hành vi có sẵn một câu chuyện thật, dàn ý năm dòng.
- Bản ngắn dưới 2 phút, kết bằng một câu móc sang chỗ bạn muốn được hỏi.

#### Bài tập
1. Viết dàn ý năm nhịp cho câu "Kể một lần anh bất đồng với team khác", dùng chuyện sửa procedure trong ngày và để DBA tạo index ca đêm.
   **Đáp án:** Vấn đề: bảng thiếu index, server Standard Edition nên tạo index sẽ khóa bảng. Điều tra: xác định procedure nào chậm vì thiếu index, procedure nào sửa được bằng cách viết lại. Lựa chọn: tách hai bước, sửa procedure trong ngày, index để ca đêm; bỏ phương án tạo index ngay vì khóa bảng giờ thi. Kết quả: chỉ nói phần đã xảy ra. Bài học: trước khi đề xuất sửa trên database, hỏi phiên bản và cửa sổ bảo trì.
### Bài 1.3. Con số và sự trung thực

#### Kiến thức

##### Một con số cần ba thứ đi kèm

"Giảm từ 2,45 giây xuống 55 ms" nghe ấn tượng trên giấy, nhưng khi nói, người nghe không biết nó là gì. Một con số chỉ có nghĩa khi đi kèm:

1. **Đo cái gì**: thời gian một request bắt đầu bài thi, số lần một procedure chạy, số bản ghi trùng mỗi ngày.
2. **Đo bằng gì, trong bao lâu**: một trace trên APM, trung bình một giờ, phân vị 95 trong bảy ngày, số đếm cộng dồn từ lúc khởi động.
3. **So với gì**: trước và sau, cùng khung giờ, cùng mức tải.

Các loại số hay bị nhầm với nhau:

| Loại số | Nghĩa | Nói thế nào cho đúng |
|---|---|---|
| Một trace | Thời gian của một request cụ thể | "Trace điển hình trước và sau" |
| Trung bình | Bị kéo lệch bởi vài request rất chậm hoặc rất nhanh | "Trung bình trong một giờ cao điểm" |
| Phân vị 95 (p95) | 95% request nhanh hơn mức này | Chỉ nói p95 khi thật sự đã tính trên nhiều request |
| Cộng dồn | Ví dụ số lần chạy procedure kể từ khi plan vào cache | Luôn kèm khoảng thời gian, không thì vô nghĩa |
| Ước lượng | Tính từ giả định, chưa đo | "Tôi ước lượng khoảng…, cách ước lượng là…" |

> **Cảnh báo:** Gọi một trace điển hình là "p95" là lỗi bị bắt nhiều nhất. Người hỏi chỉ cần hỏi "p95 trên bao nhiêu request, trong bao lâu" là đủ.

##### Nói con số cho người nghe hiểu

- **Một hai con số mỗi câu chuyện**, chọn con số gắn với người dùng hoặc chi phí.
- **Làm tròn và nói bằng lời**: "từ hơn 2 giây xuống dưới 0,1 giây" dễ nhớ hơn "2,45 s → 55 ms". Có thể nói tỉ lệ: "nhanh hơn khoảng 40 lần".
- **Đặt số trong trải nghiệm**: "học sinh bấm bắt đầu thi phải chờ hơn 2 giây, giờ cao điểm thì lâu hơn nữa" có sức nặng hơn một con số trần.
- **Nói cách đo ngay sau con số**, trong cùng câu: "đo bằng trace APM trước và sau khi sửa".

So sánh hai cách nói:

- Kém: "Tôi giảm từ 2,45 s xuống 55 ms, p95, 81 triệu lần, 9.400 xuống 40 lần một phút."
- Tốt: "Màn bắt đầu thi thử từ hơn 2 giây xuống dưới 0,1 giây, đo bằng trace APM trước và sau khi sửa. Trace sau không còn lệnh quét Redis, đó là cách tôi biết đúng là bản sửa đã có tác dụng."

##### Ba mức sự thật của một việc

Trước buổi phỏng vấn, xếp từng việc bạn định kể vào một trong ba mức:

- **Đã làm, có bằng chứng** (commit, báo cáo, người xác nhận): kể đầy đủ, dùng được cho câu hỏi hành vi. Vẫn phải tách phần của đồng nghiệp.
- **Làm phần cốt lõi, nhưng số liệu hoặc phạm vi chưa đo**: kể phần đã làm trước, rồi nói rõ loại số đang có. "Nguyên nhân và cách sửa là của tôi. Số tôi có là một trace điển hình; tôi chưa đo trên cả tuần."
- **Chưa làm, chỉ hiểu ở mức thiết kế**: không kể như việc đã làm. Nói "ở dự án tôi chưa triển khai phần này; nếu làm, tôi sẽ thiết kế thế này và đo bằng cách này".

Việc gì đang ghi trên CV mà chỉ ở mức thứ hai hoặc thứ ba thì có hai lựa chọn trước khi nộp: đo hoặc làm thật để nâng mức, hoặc sửa câu chữ cho khớp với sự thật. Nói ở mức thiết kế về một việc CV ghi là đã làm vẫn mất điểm; đó là phương án cuối.

##### Bốn tình huống và bốn mẫu câu

1. **Đồng nghiệp làm.** "Phần đó đồng nghiệp tôi làm. Tôi làm phần X, và tôi hiểu phần kia chạy thế này…" Giải thích ở mức bạn chắc chắn.
2. **Chưa ai làm, bạn biết cách làm.** "Ở dự án tôi chưa triển khai. Nếu làm, tôi sẽ… và đo bằng…" Nêu được nguồn tham khảo.
3. **Không nhớ số chính xác.** "Tôi không nhớ chính xác và không muốn đoán. Thứ tự độ lớn là khoảng X, và tôi lấy lại số đó ở chỗ này." Chỉ nói thứ tự độ lớn khi chắc.
4. **Bạn đã sai.** "Lúc đó tôi quyết định X. Kết quả là Y. Nếu làm lại tôi sẽ Z."

> **Mẹo:** Câu "tôi chưa làm" đứng một mình là điểm trừ. Nối ngay sau nó một thiết kế đúng hoặc một cách đo, nó thành điểm cộng: người hỏi thấy bạn biết giới hạn của mình và vẫn hiểu vấn đề.

#### Cách show off

Khi bị hỏi về một việc chưa làm, đừng xin lỗi dài. Một câu nhận, rồi chuyển ngay sang thiết kế với mức chi tiết của người đã đọc kỹ.

> **Ví dụ:** "Phần cảnh báo theo mục tiêu dịch vụ thì ở dự án tôi chưa triển khai, hiện team vẫn alert theo ngưỡng CPU và lỗi. Nếu làm, tôi sẽ bắt đầu từ vài API quan trọng nhất của luồng thi, đặt mục tiêu theo tỉ lệ request thành công và đủ nhanh. Cảnh báo gọi người dậy chỉ khi ngân sách lỗi bị đốt nhanh, kiểm tra trên cả cửa sổ ngắn lẫn dài để tránh báo động giả. Những alert không cần xử lý ngay thì chuyển thành ticket. Cách tôi biết nó có tác dụng là đếm số lần bị gọi dậy mỗi tháng, so cùng mùa thi năm trước."

Điểm ăn điểm:

- **Tự gắn nhãn loại số** trước khi bị hỏi: "đây là trace điển hình", "đây là ước lượng".
- **Đưa con số qua lăng kính người dùng**, rồi mới tới cách đo.
- **Thừa nhận nhanh, không biện minh** khi bị bắt một chỗ chưa chính xác; sự bình tĩnh ở đây làm tăng độ tin cho mọi câu chuyện khác.
- **Với việc chưa làm, nói cả cách đo**, không chỉ cách xây.

#### Câu hỏi vặn
- **"CV ghi p95, nhưng anh vừa nói đó là một trace. Vậy CV có chính xác không?"** Nhận ngay: "Chữ p95 chưa chính xác. Số tôi có là một trace điển hình trước và sau khi sửa. Tôi có thể đo p95 trên bảy ngày trước và sau và gửi lại." Không biện minh, không đổi chủ đề.
- **"Con số này anh đo hay ước lượng?"** Trả lời đúng loại số. Nếu là ước lượng, nói cách ước lượng: "Khoảng 10 nghìn người chơi cùng lúc là ước lượng từ số thí sinh đăng ký và tỉ lệ vào cùng giờ; tôi chưa có số đo từ monitoring."
- **"Việc nào anh tự tin nhất, việc nào ít tự tin nhất?"** Tự tin nhất: một việc có bằng chứng rõ, ví dụ viết lại luồng làm bài để bỏ hết procedure đọc chéo database. Ít tự tin nhất: chọn một việc làm phần cốt lõi nhưng số chưa đo, nói rõ phần nào chưa đo. Câu trả lời trung thực ở đây làm tăng độ tin cho mọi việc còn lại.
- **"Anh kể chi tiết phần đó được không?"** (về một việc chưa làm) "Phần này tôi chưa triển khai ở production. Tôi có thể trình bày cách tôi sẽ thiết kế và đo nó." Rồi trả lời bằng kiến thức thật. Không bịa mốc thời gian, không bịa người tham gia.
- **"Con số 81 triệu lần đó là trong bao lâu?"** Đó là số đếm cộng dồn từ lúc procedure được nạp vào plan cache, lấy từ thống kê của SQL Server, đi kèm thời điểm nạp. Nói khoảng thời gian thật [điền: khoảng bao nhiêu ngày]; nếu không nhớ, nói không nhớ và nói số đó lấy từ đâu.
#### Bẫy cần tránh

- **Kể bằng con số chưa đo vì "nghe hay hơn".** Một câu "đo ở đâu" là đủ để đổ cả câu chuyện.
- **Tự nâng mức sự thật khi chưa có bằng chứng mới.** Chỉ nâng khi bạn đã đo hoặc đã làm.
- **Kể dài phần chưa đo** trong một việc làm một phần. Phần chưa đo nói càng ngắn càng tốt, và luôn gắn nhãn.
#### Nhớ nhanh
- Mỗi con số cần: đo cái gì, đo bằng gì trong bao lâu, so với gì.
- Một hai số mỗi câu chuyện, làm tròn, nói bằng lời, kèm cách đo trong cùng câu.
- Ba mức sự thật: đã làm có bằng chứng; làm cốt lõi nhưng số chưa đo; chưa làm.
- Việc chưa làm: một câu nhận, rồi thiết kế và cách đo.
- Bị bắt sai: nhận ngay, đề nghị đo lại, không biện minh.

#### Bài tập
1. Viết lại cho trung thực: "Chúng tôi giảm số lần bị gọi dậy ban đêm từ 14 xuống 2 mỗi tháng nhờ SLO và burn-rate alert." Giả sử phần này chưa làm.
   **Đáp án:** "Phần này tôi chưa triển khai. Nếu làm, tôi sẽ đặt mục tiêu dịch vụ theo tỉ lệ request tốt cho các API thi, gọi người dậy theo tốc độ đốt ngân sách lỗi trên nhiều cửa sổ, chuyển alert không cần xử lý ngay thành ticket, và đo số lần bị gọi dậy mỗi tháng so với cùng mùa thi."
2. Phân loại câu sau, giả sử bạn đã code toàn bộ nhưng chưa đo tải: "Tôi xây bảng xếp hạng thời gian thực cho 10 nghìn người chơi cùng lúc, p95 dưới 150 ms."
   **Đáp án:** Làm cốt lõi nhưng số chưa đo. Luồng là thật; 10 nghìn là ước lượng; p95 chưa đo. Cách nói: "Tôi làm toàn bộ luồng bảng xếp hạng: sự kiện điểm đi qua Kafka, cập nhật vào Redis sorted set. Quy mô khoảng 10 nghìn là ước lượng của tôi; tôi chưa đo độ trễ dưới tải."
3. Biến chuỗi "2,45 s → 55 ms, 472 vòng SCAN" thành hai câu nói cho người không biết hệ thống.
   **Đáp án:** Ví dụ: "Học sinh bấm bắt đầu thi thử phải chờ hơn 2 giây, vì mỗi lần hệ thống lại quét toàn bộ Redis hàng trăm lượt để dọn cache. Bỏ việc quét đó, trace của cùng màn hình xuống dưới 0,1 giây."

### Bài 1.4. Lộ trình ôn tập bốn tuần

#### Kiến thức

##### Cuốn sách gồm những gì

| Phần | Nội dung | Mức ưu tiên |
|---|---|---|
| I | Luật chơi phỏng vấn, cách kể chuyện, con số, lộ trình | Đọc đầu tiên |
| II | Các dự án ở VTC Online: hiệu năng, SQL, tính đúng dữ liệu, nền tảng | Cao nhất: chắc chắn bị hỏi |
| III | Các dự án ở AvePoint | Cao, phần lớn nói ở mức thiết kế |
| IV | Kiến thức nền theo từng công nghệ bạn nhắc tới | Trung bình: người hỏi lan ra từ dự án |
| V | System design: phương pháp và bài mẫu | Cao nếu có vòng system design |
| VI | Tối ưu SQL Server: đo, wait, plan, index, locking, vận hành | Cao: kinh nghiệm của bạn xoay quanh SQL |
| VII | Câu hỏi hành vi và chuẩn bị cuối | Tuần cuối |

Nguyên tắc ưu tiên: câu chuyện bạn đã làm thật trước, kiến thức nền sau; hiểu cơ chế trước, nhớ câu trả lời sau.

##### Lịch bốn tuần

Giả định khoảng 2 giờ mỗi ngày trong tuần và 4 giờ mỗi ngày cuối tuần. Từ ngày thứ hai trở đi, mỗi ngày dành 15–20 phút đầu cho flashcard.

| Tuần | Việc chính | Kết thúc tuần, bạn phải |
|---|---|---|
| 1 | Phần I và Phần II; song song đo lại các số liệu còn thiếu | Kể được mọi câu chuyện ở VTC Online theo năm nhịp, đã xếp mức sự thật cho từng việc |
| 2 | Phần III và Phần IV; cuối tuần sửa CV theo số đã đo | Mỗi công nghệ trên CV nói được trong 30 giây: là gì, dùng khi nào, đánh đổi gì |
| 3 | Phần VI, mỗi ngày một hai chương; chạy các truy vấn chẩn đoán trên database dev | Viết lại được trên giấy các truy vấn chẩn đoán cơ bản và đọc được một execution plan |
| 4 | Phần V, Phần VII, hai buổi phỏng vấn thử | Làm một bài system design trong 40 phút; dàn ý năm dòng cho mọi câu chuyện hành vi |

Ngày cuối cùng trước phỏng vấn: chỉ ôn các thẻ bị đánh dấu quên, rồi nghỉ.

##### Đo lại số liệu trong tuần 1

Mỗi việc dưới một giờ, và mỗi việc nâng một câu chuyện lên mức "có bằng chứng":

- [ ] Phân vị 95 và 99 của API bắt đầu thi thử, bảy ngày trước và bảy ngày sau bản sửa, lấy trên Elastic APM.
- [ ] Số lần gọi mỗi phút của các procedure đã được cache lại: chụp `execution_count` trong `sys.dm_exec_procedure_stats` hai lần cách nhau một giờ, lấy hiệu chia 60.
- [ ] Số cặp (thí sinh, vòng thi) bị ghi trùng kết quả theo từng ngày, trước và sau khi thêm khóa chống ghi trùng.
- [ ] Hỏi DBA index ca đêm đã được tạo chưa; kiểm tra index có trong `sys.indexes` và có được dùng trong `sys.dm_db_index_usage_stats`.

##### Ôn bằng flashcard lặp lại ngắt quãng

Mỗi câu trong mục "Câu hỏi vặn" của từng bài trở thành một thẻ: mặt trước là câu hỏi, mặt sau là cách trả lời.

Trí nhớ suy giảm nhanh sau khi học; mỗi lần nhớ lại thành công ngay trước khi quên thì lần quên tiếp theo đến chậm hơn. Vì vậy ôn theo khoảng cách tăng dần hiệu quả hơn đọc lại nhiều lần trong một ngày, và việc tự nhớ lại quan trọng hơn đọc lại đáp án.

1. Đọc câu hỏi, **trả lời thành tiếng** trước khi lật thẻ, mục tiêu 30–60 giây.
2. Lật thẻ, tự chấm: quên, nhớ một phần, nhớ chắc.
3. Thẻ quên: ôn lại trong buổi và ngày hôm sau. Nhớ một phần: sau 2–3 ngày. Nhớ chắc: giãn dần khoảng 1 → 3 → 7 → 14 ngày.
4. Chỉ mở thẻ của các bài đã học xong.

> **Mẹo:** "Nhớ chắc" nghĩa là nói được cả cơ chế lẫn loại số đúng. Nhớ ý nhưng gọi trace điển hình là p95 thì chấm "nhớ một phần".

##### Phỏng vấn thử

- Nhờ một người đọc CV và hỏi tự do, không theo thứ tự sách.
- Yêu cầu họ đào tới tầng "sao biết là đúng" ở ít nhất ba câu chuyện.
- Ghi âm. Nghe lại những chỗ nói "chúng tôi" thay cho "tôi", những chỗ nói số mà không nói cách đo, và những chỗ kể bối cảnh quá dài.

#### Cách show off

Câu "anh đã chuẩn bị thế nào" là một câu hỏi thật, không phải câu xã giao: nó cho người hỏi thấy cách bạn làm việc khi có mục tiêu. Trả lời bằng việc cụ thể, và nếu đã đo lại số liệu thì nói ra, vì đó chính là hành vi senior họ đang tìm.

> **Ví dụ:** "Tôi rà lại từng việc trên CV và tự hỏi mình ba câu: tôi làm phần nào, nó chạy thế nào, sao tôi biết nó đúng. Với vài việc tôi chỉ có trace đơn lẻ, nên tôi đã lấy lại số trên một tuần cho chắc. Có một chỗ tôi phát hiện câu chữ trên CV mạnh hơn số tôi có, và tôi đã sửa lại. Ngoài ra tôi ôn lại phần SQL Server và luyện system design trên giấy, mỗi bài 40 phút."

Điểm ăn điểm:

- **Nói việc cụ thể**, không nói "tôi đọc nhiều tài liệu".
- **Cho thấy bạn tự kiểm chứng**: đo lại số, sửa câu chữ cho khớp sự thật.
- **Không nhắc tới tài liệu ôn thi**; nói về hành động của bạn.

#### Câu hỏi vặn
- **"Anh đã chuẩn bị cho buổi phỏng vấn này thế nào?"** Ngắn và cụ thể: rà từng việc trên CV qua ba câu hỏi làm gì, làm thế nào, sao biết đúng; đo lại các số liệu chính (nêu số nào đã đo); ôn SQL Server và system design.
- **"Gần đây anh học thêm điều gì về kỹ thuật, và áp dụng ở đâu?"** Chọn chủ đề gắn với việc thật: đọc execution plan và thống kê SQL Server trong đợt rà soát hiệu năng, hoặc những thay đổi của .NET 10 trong đợt nâng cấp. Nêu một điều cụ thể đã học và chỗ đã dùng.
- **"Điểm yếu kỹ thuật lớn nhất của anh hiện nay là gì?"** Chọn điểm yếu thật và có kế hoạch. Ví dụ: kinh nghiệm test tự động còn ít, vì codebase hiện tại chủ yếu test tay trên môi trường dev, chỉ có một bộ test chạy trên database mẫu. Kế hoạch: thêm integration test cho procedure quan trọng và contract test cho API.
- **"Anh tự thấy mình đã ở mức senior chưa, vì sao?"** Đưa bằng chứng thay vì tự nhận: dẫn một đợt rà soát hiệu năng, tự tìm ra lỗi cache gốc, thiết kế lại luồng làm bài để bỏ đọc chéo database. Thừa nhận khoảng trống: chức danh hiện tại là Backend Engineer, cần thêm kinh nghiệm vận hành và đo lường bài bản, và nói bạn đang lấp thế nào.
- **"Nếu vào đây, ba tháng đầu anh sẽ làm gì?"** Tháng đầu đọc hệ thống, đọc dashboard và sự cố gần đây, hỏi người vận hành chỗ nào đau nhất. Tháng thứ hai nhận một việc nhỏ có đo được kết quả. Tháng thứ ba đề xuất một cải tiến có số liệu đi kèm. Tránh hứa "viết lại kiến trúc".

#### Bẫy cần tránh

- **Học thuộc câu trả lời mẫu.** Nghe như đọc, và vỡ khi bị cắt ngang. Học dàn ý và cơ chế.
- **Dồn hết thời gian cho kiến thức nền** mà bỏ các câu chuyện thật. Câu chuyện thật mới là thứ chắc chắn bị hỏi.
- **Đọc lại thay vì nói thành tiếng.** Đọc thấy hiểu không có nghĩa là nói được trong 60 giây.
- **Phỏng vấn thử với người hỏi dễ.** Yêu cầu họ hỏi vặn.

#### Nhớ nhanh
- Tuần 1: Phần I–II và đo lại số; tuần 2: Phần III–IV và sửa CV; tuần 3: Phần VI; tuần 4: Phần V, VII và phỏng vấn thử.
- Câu chuyện thật trước, kiến thức nền sau.
- Mỗi ngày 15–20 phút flashcard, trả lời thành tiếng trước khi lật.
- Phỏng vấn thử phải đào tới "sao biết là đúng", có ghi âm.

#### Bài tập
1. Điền lịch bốn tuần vào lịch cá nhân, ghi ngày bắt đầu và ngày phỏng vấn dự kiến.
   **Đáp án:** Nếu còn ít hơn bốn tuần, giữ Phần II và Phần VI, rút Phần IV xuống các công nghệ có trên CV.
2. Học xong các bài về hiệu năng và SQL ở Phần II, chọn 10 thẻ, trả lời thành tiếng và tự chấm.
   **Đáp án:** Nếu hơn 3 thẻ ở mức "quên", đọc lại phần Kiến thức của các bài đó trước khi học tiếp.
3. Liệt kê bốn số liệu bạn sẽ đo lại trong tuần 1 và nơi lấy từng số.
   **Đáp án:** p95/p99 API bắt đầu thi thử (Elastic APM, bảy ngày trước và sau); số lần gọi mỗi phút của các procedure đã cache (`sys.dm_exec_procedure_stats`, chụp hai lần cách nhau một giờ); số cặp kết quả ghi trùng theo ngày (truy vấn trên bảng kết quả); trạng thái index ca đêm (hỏi DBA, kiểm tra `sys.indexes` và `sys.dm_db_index_usage_stats`).
