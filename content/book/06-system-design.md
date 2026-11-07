# Phần V. System design

Vòng system design khác hẳn vòng hỏi kiến thức. Bạn nhận một đề mở, kiểu "thiết kế hệ thống thi trực tuyến cho vài trăm nghìn học sinh", và có khoảng 40 phút để biến nó thành một thiết kế đứng vững. Không có đáp án đúng duy nhất. Người phỏng vấn theo dõi cách bạn nghĩ: có hỏi lại yêu cầu không, có biến yêu cầu thành con số không, có biết chỗ nào sẽ gãy trước không, và có tự nói ra cái giá của mỗi lựa chọn trước khi bị hỏi không.

Lợi thế của bạn là đã làm nhiều năm trên một hệ thống thi tiếng Anh trực tuyến cho học sinh cả nước, nơi giờ cao điểm có hàng trăm nghìn em vào thi cùng lúc. Phần này dạy cách dùng lợi thế đó đúng chỗ: chương 15 là phương pháp dẫn dắt một buổi system design, chương 16 là năm đề mẫu sát với mảng thi cử và giáo dục. Ở mỗi đề, phần nào bạn đã làm thật, phần nào là lớp có sẵn do đồng nghiệp viết, phần nào mới chỉ là thiết kế, đều được nói rõ để bạn kể đúng.

## Chương 15. Phương pháp

Ứng viên trượt vòng này hiếm khi vì thiếu kiến thức. Họ trượt vì nhảy vào vẽ sơ đồ ngay phút đầu, không có con số nào để bảo vệ quyết định, và không bao giờ nói hệ thống sẽ hỏng thế nào. Ba bài trong chương này sửa đúng ba lỗi đó: một khung dẫn dắt cố định, cách ước lượng tải nhanh bằng con số, và bộ khối xây dựng kèm cái giá của từng khối.

### Bài 15.1. Dẫn dắt một buổi system design 40 phút

#### Kiến thức

##### Người phỏng vấn chấm gì

Không phải sơ đồ đẹp hay số công nghệ bạn biết, mà bốn thứ: có làm rõ bài toán trước khi giải không; có suy luận từ con số sang quyết định không; có đào sâu vào chỗ khó nhất thay vì dàn đều không; và có nghĩ tới lúc hệ thống hỏng, lúc phải vận hành nó không. Khung dưới đây giúp bạn tự biết mình đang ở đâu và còn bao nhiêu thời gian.

##### Sáu bước và phân bổ thời gian

| Bước | Việc phải làm | Thời gian |
|---|---|---|
| 1. Làm rõ yêu cầu | Chức năng chính, tải, độ trễ, mức chấp nhận mất hoặc trùng dữ liệu, ràng buộc | 5 phút |
| 2. Ước lượng | Số request mỗi giây lúc đỉnh, tải ghi, dung lượng, băng thông | 5 phút |
| 3. Vẽ khung | Sơ đồ 5–7 khối, API chính, mô hình dữ liệu | 10 phút |
| 4. Đào sâu | Chọn 2–3 chỗ khó nhất, đưa phương án, chọn, nói đánh đổi | 10 phút |
| 5. Cách hỏng | Từng thành phần chết hoặc chậm thì hệ thống còn đúng không | 5 phút |
| 6. Quan sát | SLO, metric, alert, cách vận hành ngày cao điểm | 3 phút |
| Dự phòng | Tóm tắt, trả lời câu hỏi thêm | 2 phút |

Bước 4 ăn điểm nhiều nhất. Lỗi thời gian phổ biến nhất là bước 3 kéo tới 20 phút vì vẽ quá chi tiết. Vượt 15 phút thì chủ động cắt: "Khung chính như vậy, tôi xin đào sâu vào chỗ dễ gãy nhất là giây đầu ca thi."

> **Mẹo:** Viết sáu bước ở góc bảng và gạch dần khi xong. Người phỏng vấn thấy bạn có cấu trúc, còn bạn không quên bước 5 và 6.

##### Hỏi làm rõ: hỏi gì và vì sao

Mỗi câu hỏi làm rõ phải dẫn tới một quyết định thiết kế. Hỏi cho có thì không được điểm.

- **Chức năng:** thao tác nào quan trọng nhất, cái gì ngoài phạm vi? Quyết định luồng nào vẽ trước.
- **Quy mô và hình dạng tải:** bao nhiêu người cùng lúc, tải rải đều hay dồn vào một thời điểm? Hệ thống thi dồn tải vào giây đầu ca, khác hẳn trang tin tức.
- **Độ trễ:** thao tác nào người dùng đang chờ (bắt đầu thi, nộp bài), thao tác nào chạy sau được (báo cáo)?
- **Tính đúng:** được mất, được ghi trùng, được đọc dữ liệu cũ vài giây không? Quyết định chỗ nào cần DB, chỗ nào cache là đủ.
- **Ràng buộc:** hạ tầng đang có (SQL Server Standard Edition, Redis, Kafka), đội bao nhiêu người, được thêm hệ thống mới không?

Khi không có số, đừng hỏi mãi. Tự đặt giả định có số, ghi lên bảng: "Tôi giả định 200 nghìn em cùng thi, phần lớn vào trong 2 phút đầu ca." Giả định sai không sao, miễn là có số để tính tiếp và chỉ ra được phần nào đổi nếu số đổi.

##### Đường nóng và đường nền

**Đường nóng** là những gì xảy ra khi người dùng đang chờ phản hồi; **đường nền** là việc chạy sau, chậm được. Mọi thứ nặng, mọi thao tác tỉ lệ với kích thước dữ liệu, mọi lời gọi sang hệ thống chậm đều nên bị đẩy khỏi đường nóng. Và mỗi khối thêm vào sơ đồ phải trả lời được "vì sao cần, ở tải nào thì cần": thiết kế tốt là thiết kế đơn giản nhất chịu được con số ở bước 2, cộng đường nâng cấp rõ ràng khi số tăng.

#### Cách show off

Thứ người phỏng vấn nhớ sau buổi là cảm giác "người này dẫn được buổi thảo luận": nói trước mình sẽ đi thế nào, đi đúng như vậy, và mỗi lần rẽ đều nói lý do.

Mạch: nhắc lại đề bằng lời của mình → 4–5 câu làm rõ có mục đích → chốt giả định có số → vẽ khung tối giản → tự chọn chỗ khó để đào sâu, nói vì sao → tự nêu cách hỏng → kết bằng quan sát. Kinh nghiệm thật đưa vào ở bước 4 và 5, mỗi lần một hai câu, như bằng chứng cho một quyết định.

> **Ví dụ:** "Trước khi vẽ, tôi muốn hỏi vài điều để biết chỗ nào khó nhất. Học sinh vào thi theo ca hay vào lúc nào cũng được? Nếu theo ca thì tải sẽ dồn vào mấy giây đầu, và đó là chỗ tôi sẽ đào sâu. Thứ hai, một em có được nộp hai lần không, vì câu trả lời quyết định tôi cần khóa ở tầng nào. Nếu anh chị chưa có số cụ thể, tôi xin giả định khoảng 200 nghìn em trong một ca, ghi lên đây để tính tiếp. Tôi sẽ đi theo sáu bước này, và để dành khoảng mười phút cho phần dễ gãy nhất."

Những điểm ăn điểm:

- **Chọn chỗ đào sâu bằng lý do, không chờ được chỉ định.** "Tôi đào vào giây đầu ca vì đó là chỗ tải gấp mấy lần trung bình" cho thấy bạn biết hệ thống hỏng ở đâu.
- **Tự nói đánh đổi trước khi bị hỏi.** Mỗi lựa chọn kèm một câu "cái giá là…". Người phỏng vấn không phải gặng hỏi, và bạn giữ được nhịp.
- **Nối con số với quyết định.** Không chỉ tính "6.000 request mỗi giây", mà nói tiếp "vì vậy request bắt đầu thi không được chạm DB nhiều lần".
- **Dùng kinh nghiệm như bằng chứng.** Một câu ngắn kiểu "ở hệ thống thi tôi làm, đúng chỗ này từng chậm vì…" nặng ký hơn nhiều so với kể lể.

#### Câu hỏi vặn

- **"Bạn bắt đầu một bài system design thế nào?"** Tôi dành khoảng năm phút hỏi về thao tác quan trọng nhất, quy mô lúc đỉnh, độ trễ chấp nhận được và mức chấp nhận mất hoặc trùng dữ liệu. Sau đó tôi ước lượng tải bằng con số rồi mới vẽ. Vẽ trước khi có số thì mọi quyết định sau đó đều là đoán.
- **"Tôi không cho số liệu, bạn làm sao?"** Tôi tự đặt giả định có số, ghi lên bảng và nói rõ là giả định. Thiết kế dựa trên đó; nếu anh chị đổi số, tôi chỉ ra khối nào vượt ngưỡng trước và phải đổi gì.
- **"Sao bạn chọn đào sâu chỗ này?"** Vì đây là chỗ tải cao nhất hoặc chỗ tính đúng quan trọng nhất theo yêu cầu vừa chốt. Anh chị muốn đi vào chỗ khác thì tôi chuyển ngay.
- **"Làm sao biết bạn đã đào đủ sâu?"** Khi tôi nói được điểm nghẽn ở đâu bằng con số, có ít nhất hai phương án, chọn cái nào, cái giá là gì, và khi thành phần đó hỏng thì dữ liệu còn đúng không.
- **"Giữa chừng tải tăng gấp 10, bạn làm gì?"** Tính lại, tìm khối vượt ngưỡng trước (thường là tải ghi DB hoặc một key nóng), rồi nói thay đổi nhỏ nhất cho khối đó thay vì vẽ lại.
- **"Thiết kế này có phức tạp quá không?"** Tôi chỉ ra khối nào bỏ được ở quy mô nhỏ hơn. Ví dụ dưới vài trăm lần ghi mỗi giây thì không cần hàng đợi, ghi thẳng DB là đủ.

#### Bẫy cần tránh

- Vẽ sơ đồ microservice ngay phút đầu. Thay bằng: nhắc lại đề và hỏi làm rõ.
- Liệt kê công nghệ không lý do ("dùng Kafka, Redis, Kubernetes"). Thay bằng: mỗi khối một câu "vì con số này nên cần khối này".
- Nói "exactly-once" khi ý thật là ghi idempotent: message có thể đến nhiều lần, tác dụng nghiệp vụ chỉ xảy ra một lần.
- Sa vào chi tiết cú pháp (Lua, cấu hình Kafka) rồi hết giờ trước bước 5 và 6.
- Kể kinh nghiệm thành câu chuyện dài giữa buổi thiết kế. Một hai câu làm bằng chứng là đủ.

#### Nhớ nhanh

- Sáu bước: làm rõ, ước lượng, vẽ khung, đào sâu, cách hỏng, quan sát. Viết ở góc bảng.
- Bước 4 là phần chính; bước 3 không quá 15 phút.
- Không có số thì tự đặt giả định có số và nói ra.
- Mỗi khối có lý do, mỗi quyết định có cái giá, và nói cái giá trước khi bị hỏi.
- Kinh nghiệm thật dùng như bằng chứng ngắn ở bước đào sâu và cách hỏng.

#### Bài tập

1. Viết 8 câu hỏi làm rõ cho đề "thiết kế hệ thống chấm bài viết tiếng Anh bằng AI", mỗi câu ghi nó quyết định điều gì.
   **Đáp án:** Số bài mỗi ngày và lúc đỉnh (có cần hàng đợi); người dùng chờ được bao lâu (đồng bộ hay bất đồng bộ); AI chấm mất bao lâu, có giới hạn tốc độ không (số worker); giới hạn số lần nộp (quota); chấm lỗi thì sao (chấm lại, trạng thái lỗi); có cần giáo viên duyệt không; callback hay polling (endpoint callback idempotent); lưu bài bao lâu (dung lượng, quyền riêng tư).
2. Bấm giờ 40 phút, làm đề thi trực tuyến ở Bài 16.1 trên giấy, ghi lại số phút cho từng bước.
   **Đáp án:** Nếu bước 3 vượt 15 phút, luyện lại với luật chỉ được vẽ tối đa 6 khối. Nếu chưa tới bước 5 khi hết giờ, luyện câu chuyển "khung chính như vậy, tôi xin đào sâu…".

### Bài 15.2. Ước lượng tải bằng con số

#### Kiến thức

##### Ước lượng để làm gì

Ước lượng không để ra con số chính xác mà để trả lời "khối nào gãy trước, ở mức tải nào". Con số "6.000 request mỗi giây ở giây đầu ca" lập tức loại vài phương án (mỗi request gọi DB năm lần) và đòi thêm vài thứ (dàn tải, cache). Cần tính: request mỗi giây lúc đỉnh (đọc và ghi riêng), dung lượng, băng thông.

##### Bảng cỡ độ lớn cần thuộc

Các số dưới đây là cỡ độ lớn để ước lượng, không phải số đo của một hệ thống cụ thể.

| Thao tác | Cỡ độ lớn |
|---|---|
| Đọc RAM | ~100 ns |
| Đọc ngẫu nhiên SSD | ~20–100 µs |
| Round-trip mạng trong cùng datacenter | ~0,5 ms |
| Lệnh Redis đơn giản (GET/SET) tính cả mạng | ~0,2–1 ms |
| Một Redis instance | ~100 nghìn lệnh đơn giản mỗi giây |
| Procedure SQL seek theo index, tính cả round-trip | ~1–5 ms |
| Round-trip giữa hai châu lục | ~100–150 ms |
| Một instance API .NET có gọi DB | vài trăm tới vài nghìn request mỗi giây, tùy truy vấn |
| 1 Gbps | ~125 MB/s |
| Một ngày | 86.400 s ≈ 10^5 s; 1 triệu việc mỗi ngày ≈ 12 việc mỗi giây |

Quy tắc nhẩm: query 2 ms thì một connection phục vụ được khoảng 500 lần gọi mỗi giây; query 200 ms thì chỉ còn 5.

##### Little's law: nối độ trễ với tài nguyên

**L = λ × W.** Số việc đang nằm trong hệ thống (L) bằng tốc độ việc đến (λ) nhân thời gian mỗi việc ở lại (W).

Định luật này giải thích vì sao một API chậm đi lại kéo sập cả hệ thống: độ trễ tăng thì số request đang treo tăng theo đúng tỉ lệ, và mỗi request treo giữ một thread, một connection, một ít bộ nhớ.

> **Ví dụ:** API bắt đầu thi nhận khoảng 1.700 request mỗi giây. Nếu mỗi request mất khoảng 50 ms thì chỉ có chừng 85 request đang chạy cùng lúc. Nếu mỗi request mất 2,5 giây thì con số đó là hơn 4.000. Connection pool mặc định của SqlClient là 100 connection cho mỗi chuỗi kết nối, nên request phải xếp hàng chờ connection, rồi timeout dây chuyền.

Hệ quả thực tế: khi thấy lỗi "hết connection trong pool", tăng pool là phản xạ sai. Pool đầy là triệu chứng của W tăng. Tăng pool thì càng nhiều truy vấn chậm dồn vào DB, càng tranh chấp. Phải tìm vì sao W tăng.

##### Tính mẫu cho đề thi 200 nghìn thí sinh

- **Bắt đầu thi:** 200.000 em trong 2 phút ≈ 1.700 request mỗi giây trung bình. Nếu 30% vào trong 10 giây đầu: 60.000 / 10 = 6.000 request mỗi giây.
- **Lưu bài tự động** mỗi 30 giây: 200.000 / 30 ≈ 6.700 lần ghi mỗi giây. Nếu mỗi 10 giây thì 20.000.
- **Trạng thái bài làm:** 50 câu × khoảng 20 byte ≈ 1 KB mỗi em; 200 nghìn em ≈ 200 MB trên Redis. Nhỏ, không phải vấn đề.
- **Băng thông tải đề:** đề 200 KB × 200 nghìn em = 40 GB trong 2 phút ≈ 333 MB/s ≈ 2,7 Gbps. Con số này nói ngay rằng đề phải đi qua CDN hoặc được tải trước giờ thi.

> **Cảnh báo:** Luôn tính đỉnh. Trung bình 1.700 request mỗi giây nghe nhẹ nhàng, nhưng hệ thống thi hỏng ở 10 giây đầu ca chứ không hỏng ở mức trung bình.

#### Cách show off

Ước lượng là chỗ dễ ghi điểm vì nhiều ứng viên làm qua loa. Nói to từng phép tính, làm tròn mạnh tay, ghi kết quả lên bảng, và ngay sau mỗi con số nói nó dẫn tới quyết định gì.

Little's law còn là cầu nối sang chuyện thật: bạn từng dẫn một đợt rà soát hiệu năng trên hệ thống thi, trong đó API bắt đầu thi chậm vì một hàm làm mới cache quét toàn bộ Redis ngay trong request.

> **Ví dụ:** "Với 200 nghìn em vào trong khoảng 2 phút, trung bình là chừng 1.700 request mỗi giây, nhưng tôi thiết kế cho đỉnh vài nghìn vì tải dồn vào mấy giây đầu. Ở mức đó, độ trễ của từng request quan trọng hơn ta tưởng. Ở hệ thống thi tôi làm, có lần màn bắt đầu thi chậm lên hơn 2 giây vì trong request có một hàm quét toàn bộ cache Redis để tìm key cần xóa. Nhân với tốc độ request đến, số request đang treo cùng lúc vượt xa connection pool, và triệu chứng nhìn thấy là timeout chứ không phải chậm. Sau khi bỏ thao tác quét đó, trace APM cho thấy request còn dưới 0,1 giây. Vì vậy trong thiết kế này tôi đặt luật: đường bắt đầu thi không có thao tác nào tỉ lệ với kích thước dữ liệu."

Những điểm ăn điểm:

- **Nói giả định phân bố tải, không chỉ tổng,** và đọc con số thành quyết định: 40 GB trong 2 phút là lý do phải có CDN.
- **Biết Little's law để chẩn đoán, không chỉ để tính.** Pool đầy là W tăng; sửa W chứ không phình pool.
- **Nói đúng con số mình có.** Con số trước và sau trong câu chuyện trên là thời gian của một trace điển hình, đo bằng APM, không phải p95. Nếu bị hỏi, nói thẳng như vậy. Vai trò cũng nói đúng: bạn dẫn đợt rà soát và đề xuất cách sửa, đồng nghiệp commit bản sửa.

#### Câu hỏi vặn

- **"200 nghìn người bắt đầu thi trong 2 phút thì cần bao nhiêu QPS?"** Trung bình khoảng 1.700 request mỗi giây. Nhưng tải dồn vào giây đầu, nếu 30% vào trong 10 giây thì là 6.000. Tôi thiết kế cho đỉnh đó và thêm cơ chế dàn tải để đỉnh thấp xuống.
- **"Little's law giúp gì khi chọn connection pool?"** Số connection cần xấp xỉ số lần gọi DB mỗi giây nhân thời gian giữ connection. 1.000 lần mỗi giây × 5 ms là 5 connection; query chậm thành 500 ms thì cần 500, vượt pool. Nên sửa query trước, không tăng pool trước.
- **"Thấy timeout do hết connection, sao không tăng pool?"** Vì pool đầy là triệu chứng: thời gian mỗi request tăng. Tăng pool làm nhiều truy vấn chậm dồn vào DB hơn, tranh chấp lock và CPU nặng hơn, có khi còn tệ hơn. Tôi tìm vì sao request chậm đi trước.
- **"Một Redis chịu được bao nhiêu lệnh mỗi giây?"** Cỡ 100 nghìn lệnh đơn giản mỗi giây trên một instance. Lệnh tỉ lệ với kích thước dữ liệu như quét toàn keyspace hay script dài làm con số này sụp, vì Redis chạy lệnh trên một luồng.
- **"Con số 2 giây xuống 0,1 giây đó đo thế nào?"** Bằng trace APM của cùng endpoint trước và sau khi sửa, là trace điển hình chứ không phải p95. Nếu cần nói chặt hơn, tôi sẽ lấy phân bố độ trễ của endpoint đó trong một ca thi trước và sau.
- **"Ước lượng sai thì sao?"** Sai gấp đôi thường không đổi kiến trúc; sai gấp mười thì tôi xem lại khối gãy trước. Đó là lý do tôi ghi giả định lên bảng.

#### Bẫy cần tránh

- Tính tới hàng đơn vị, mất ba phút cho một phép nhân. Làm tròn và đi tiếp.
- Tính ra số rồi không nói nó dẫn tới quyết định gì.
- Đọc dồn số liệu từ dự án cũ. Người nghe không có bối cảnh; chọn một cặp số, nói nó đo cái gì, và đừng gọi số đo một trace là p95.

#### Nhớ nhanh

- Cỡ độ lớn: RAM tính bằng ns, SSD bằng µs, mạng nội bộ 0,5 ms, Redis dưới 1 ms, SQL seek vài ms.
- L = λ × W: độ trễ tăng thì tài nguyên đồng thời tăng theo; pool đầy là triệu chứng.
- 1 ngày ≈ 10^5 giây; 1 Gbps ≈ 125 MB/s.
- Luôn tính đỉnh, nói giả định phân bố tải, và nói con số dẫn tới quyết định gì.

#### Bài tập

1. Hệ thống có 5 triệu lượt nộp bài mỗi ngày, 40% dồn vào 2 giờ buổi tối. Tính QPS trung bình và QPS trong 2 giờ đó.
   **Đáp án:** Trung bình 5.000.000 / 86.400 ≈ 58 mỗi giây. Trong 2 giờ: 2.000.000 / 7.200 ≈ 278 mỗi giây, gần gấp 5 lần trung bình.
2. API nhận 800 request mỗi giây, mỗi request gọi DB 3 lần, mỗi lần giữ connection 4 ms. Cần bao nhiêu connection?
   **Đáp án:** λ = 2.400 lần gọi mỗi giây, W = 0,004 s, L ≈ 10 connection. Cộng dư cho đỉnh, pool 30–50 là đủ.
3. Tính băng thông nếu 200 nghìn thí sinh tải đề 500 KB trong 1 phút, và nói kết luận.
   **Đáp án:** 100 GB / 60 s ≈ 1,67 GB/s ≈ 13 Gbps. Không thể phục vụ từ vài server ứng dụng; cần CDN hoặc cho tải đề đã mã hóa trước giờ thi, đến giờ chỉ phát khóa.

### Bài 15.3. Khối xây dựng: cache, queue, DB, replica, shard, rate limit

#### Kiến thức

Mỗi khối xây dựng giải quyết một vấn đề cụ thể và mang theo một cái giá cụ thể. Ở mức senior, nói tên khối là chưa đủ; phải nói dấu hiệu nào khiến bạn cần nó, và cái giá là gì.

##### Bảng chọn khối

| Khối | Dùng khi | Cái giá chính |
|---|---|---|
| Cache (Redis, memory) | Đọc nhiều hơn ghi, dữ liệu ít đổi | Dữ liệu cũ, invalidation, stampede |
| Queue (Kafka, RabbitMQ) | Việc không cần làm ngay, cần làm phẳng đỉnh tải | Trễ thêm; message có thể đến nhiều lần nên consumer phải idempotent |
| DB quan hệ | Cần transaction, ràng buộc, truy vấn linh hoạt | Tải ghi khó scale ngang |
| Replica | Đọc nhiều, chấp nhận dữ liệu trễ một chút | Replication lag, đọc lại ngay sau khi ghi không thấy |
| Shard | Một DB không chứa nổi dữ liệu hoặc tải ghi | Chọn shard key, truy vấn chéo shard đắt |
| Rate limit | Bảo vệ hệ thống trước đỉnh tải hoặc lạm dụng | Từ chối cả người dùng hợp lệ lúc đỉnh |

##### Cache

Cache-aside: đọc cache, miss thì đọc DB rồi ghi vào cache. Kỹ thuật nên nói được: TTL theo loại dữ liệu; negative cache cho kết quả rỗng; version key để invalidate cả nhóm bằng cách tăng một số; single-flight để khi key hết hạn chỉ một request đi đọc DB (chống stampede).

Bẫy lớn nhất là đặt thao tác tỉ lệ với kích thước keyspace, như `SCAN` tìm key cần xóa, trên đường nóng. Mỗi lệnh nhẹ, nhưng hàng trăm lệnh trong một request cộng lại thành giây. Muốn xóa theo nhóm thì giữ sẵn một SET chứa key của nhóm, hoặc dùng version key.

> **Ghi nhớ:** Redis lo phần nhanh và giảm tranh chấp; DB lo phần đúng. Mất Redis thì hệ thống chậm hơn, nhưng không được sai dữ liệu.

##### Queue

Dùng khi phía sau chậm hơn phía trước, hoặc việc có thể làm sau: chấm bài, ghi lịch sử, đẩy báo cáo. Kafka giữ thứ tự trong một partition, nên đặt key theo thực thể cần giữ thứ tự (userId, matchId). Ngữ nghĩa thực tế là at-least-once: consumer commit offset sau khi xử lý xong, nên nếu chết giữa chừng thì message được xử lý lại. Vì vậy consumer phải ghi idempotent.

Kafka hợp với log sự kiện cần lưu lâu và replay được, thông lượng cao. RabbitMQ hợp với hàng đợi việc, routing linh hoạt, ack từng message.

##### DB, replica, partition, shard

- **DB:** index theo access pattern. Bảng log ghi liên tục không nên có thêm index trên khóa ngẫu nhiên, vì mỗi lần insert phải chèn vào giữa index, gây page split và tăng tải ghi transaction log.
- **Replica:** đẩy truy vấn báo cáo và tra cứu khỏi primary. Ngay sau khi ghi mà cần đọc lại thì đọc từ primary để tránh lag.
- **Partition:** chia một bảng theo khóa (ví dụ ca thi) trong cùng DB, giúp quản lý và xóa dữ liệu theo ca nhanh.
- **Shard:** chia dữ liệu sang nhiều DB. Shard key cần nhiều giá trị khác nhau, phân bố đều, và đa số truy vấn chỉ chạm một shard. Shard là bước cuối, khi các bước trên không đủ.

##### Rate limit

Token bucket: mỗi client có một thùng tối đa N token, nạp lại r token mỗi giây, mỗi request lấy một token. Thùng đầy cho phép burst tới N, sau đó bị giới hạn theo r. Sliding window đếm chính xác hơn nhưng tốn bộ nhớ hơn.

Đặt ở gateway, trả `429` kèm `Retry-After`. Lưu ý với ASP.NET Core: middleware rate limiting có sẵn trả `503` theo mặc định, phải đặt `RejectionStatusCode = 429`, và `Retry-After` không tự có. Middleware này đếm trong bộ nhớ từng pod; nhiều pod mà cần giới hạn chính xác toàn cục thì bộ đếm phải nằm chung, thường là token bucket trên Redis bằng script Lua.

Với tải dồn theo giờ như đầu ca thi, rate limit nên đi kèm phòng chờ (waiting room): người dùng thấy vị trí của mình trong hàng, thay vì nhận lỗi rồi bấm thử lại liên tục.

#### Cách show off

Cách nói khối xây dựng có level là luôn đi theo mẫu: "tôi thêm X vì dấu hiệu Y, cái giá là Z, tôi chấp nhận vì…". Câu cuối là phần nhiều người bỏ. Người phỏng vấn hay thử bằng câu "sao không dùng…?"; nếu bạn đã tự so sánh trước thì câu đó chỉ còn là xác nhận.

> **Ví dụ:** "Ở đây tôi đặt Redis trước DB cho phần cấu hình đề thi, vì nó được đọc ở mọi request bắt đầu thi mà gần như không đổi trong ca. Cái giá là dữ liệu có thể cũ vài chục giây và phải có cách xóa cache khi sửa đề. Tôi sẽ xóa theo nhóm bằng version key chứ không quét Redis tìm key, vì ở hệ thống tôi từng làm, đúng thao tác quét đó nằm trong request đã làm màn bắt đầu thi chậm lên hơn 2 giây. Còn phần nộp bài thì tôi không dựa vào Redis cho tính đúng: Redis có mất thì DB vẫn chặn được ghi trùng."

Những điểm ăn điểm:

- **Phân biệt khối giữ tốc độ và khối giữ tính đúng.** Cache, lock trên Redis làm nhanh; ràng buộc ở DB làm đúng.
- **Nói at-least-once kèm idempotent mỗi khi nhắc queue.**
- **Biết chi tiết vận hành của công cụ quen thuộc,** như rate limiter của ASP.NET Core mặc định trả `503` và đếm theo từng pod.
- **Nói thứ tự leo thang:** thử cái rẻ trước, chỉ thêm hạ tầng khi số liệu đòi; replica, rồi partition, shard là cuối cùng.

#### Câu hỏi vặn

- **"Khi nào bạn không dùng cache?"** Khi dữ liệu phải luôn mới như số dư hay quota đang trừ, khi tỉ lệ đọc lặp lại thấp, hoặc khi chi phí invalidation lớn hơn lợi ích. Cache cũng không bao giờ được là nơi duy nhất giữ dữ liệu đúng.
- **"Kafka hay RabbitMQ?"** Kafka khi cần log bền, replay được, thông lượng cao và thứ tự theo partition. RabbitMQ khi cần hàng đợi việc với routing linh hoạt và ack từng message. Cả hai đều cần consumer idempotent.
- **"Replica lag gây lỗi gì, xử lý thế nào?"** Người dùng vừa ghi xong đọc lại không thấy dữ liệu của mình. Xử lý bằng cách đọc từ primary trong một khoảng ngắn sau khi ghi, hoặc định tuyến theo phiên người dùng.
- **"Chọn shard key cho dữ liệu kết quả thi thế nào?"** Theo userId nếu truy vấn chính là "kết quả của tôi", vì phân bố đều. Theo kỳ thi thì shard của kỳ đang diễn ra sẽ nóng. Báo cáo theo trường, tỉnh thì đi qua kho dữ liệu riêng thay vì truy vấn chéo shard.
- **"Rate limit đặt ở đâu?"** Ở gateway cho giới hạn chung theo IP hoặc user; trong service cho giới hạn nghiệp vụ như số lần nộp. Nhiều pod mà cần chính xác thì bộ đếm phải chung, thường trên Redis.
- **"Middleware rate limit của ASP.NET Core trả mã gì khi từ chối?"** Mặc định là `503`, nên tôi đặt `RejectionStatusCode` thành `429` và tự thêm `Retry-After` trong `OnRejected`. Nó cũng đếm trong bộ nhớ từng pod, nên năm pod thì một user có thể đạt gấp năm giới hạn.

#### Bẫy cần tránh

- Đưa cache vào mà không nói invalidation thế nào.
- Đề xuất shard ngay khi chưa thử replica, index, partition.
- Rate limit trả lỗi trần trụi lúc đầu ca thi, khiến client retry dồn dập.

#### Nhớ nhanh

- Mỗi khối: dấu hiệu dùng, cái giá, vì sao chấp nhận.
- Cache và lock Redis giữ tốc độ; DB giữ tính đúng.
- Queue làm phẳng đỉnh nhưng buộc consumer idempotent.
- Replica trước, partition sau, shard cuối cùng.
- Rate limit: `429` kèm `Retry-After`, bộ đếm chung khi nhiều pod, cộng phòng chờ cho tải dồn theo giờ.

#### Bài tập

1. Truy vấn báo cáo tổng hợp nặng chạy trên primary làm chậm API thi. Liệt kê 3 phương án theo thứ tự nên thử.
   **Đáp án:** Chuyển truy vấn sang replica; tính sẵn bằng job vào bảng tổng hợp để API chỉ đọc; nếu vẫn không đủ thì kho dữ liệu dạng cột riêng.
2. Thiết kế token bucket cho API nộp thông tin: tối đa 5 lần mỗi phút cho mỗi user, cho burst 3. Ghi tham số N, r và nơi lưu trạng thái.
   **Đáp án:** N = 3, r = 5/60 ≈ 0,083 token mỗi giây. Trạng thái (số token, thời điểm nạp cuối) lưu trên Redis theo userId, đọc và cập nhật nguyên tử bằng một script Lua để nhiều pod dùng chung.

## Chương 16. Bài mẫu

Năm đề trong chương này là những đề hay gặp, chọn sát với mảng thi trực tuyến và giáo dục để bạn có nhiều chỗ nối với kinh nghiệm thật. Mỗi đề đi đủ sáu bước của khung dẫn dắt: yêu cầu, ước lượng, khung kiến trúc, đào sâu, cách hỏng, quan sát.

Phần "Cách show off" ở mỗi bài tập trung vào hai việc: dẫn buổi thảo luận về đúng chỗ khó nhất của đề, và đưa kinh nghiệm vào đúng phạm vi. Hệ thống bạn làm có nhiều lớp do đồng nghiệp viết từ trước; lớp có sẵn thì nói là có sẵn và mình hiểu nó thế nào, thiết kế chưa triển khai thì nói là thiết kế. Người phỏng vấn thường hỏi "phần nào là của anh", và câu trả lời rạch ròi luôn được điểm hơn câu trả lời ôm hết.

### Bài 16.1. Nền tảng thi trực tuyến cho 200 nghìn thí sinh cùng lúc

#### Kiến thức

##### Yêu cầu đã chốt

- **Chức năng:** bắt đầu thi đồng loạt theo ca, lưu bài tự động, nộp đúng một lần, không mở hai phiên cùng lúc, có kết quả và xếp hạng.
- **Phi chức năng:** bắt đầu thi và nộp bài nhanh; không mất bài đã lưu; không ghi trùng kết quả; báo cáo được trễ.

##### Ước lượng

- **Bắt đầu thi:** 200 nghìn em trong 2 phút ≈ 1.700 request mỗi giây; mười giây đầu có thể 6.000 trở lên.
- **Lưu bài** mỗi 30 giây ≈ 6.700 lần ghi mỗi giây.
- **Nộp bài:** nếu dồn vào 5 phút cuối ≈ 670 request mỗi giây, cộng request retry khi mạng chập chờn.
- **Trạng thái bài làm** trên Redis ≈ 200 MB.
- **Tải đề:** 200 KB × 200 nghìn = 40 GB, phải qua CDN hoặc tải trước giờ thi.

##### Khung kiến trúc

```text
 Thí sinh ──> CDN (đề đã mã hóa, tải trước giờ thi)
    │
    └──> Gateway (rate limit, phòng chờ)
            │
            v
        Exam API (nhiều pod)
         │      │         │
         │      │         └── publish ──> Kafka ──> Worker chấm ──> DB kết quả
         │      │
         │      └── lưu bài ──> Redis (hash theo attempt) ──> flush theo lô ──> DB
         │
         └── phiên thi ──> Redis (compare-and-swap theo user + vòng)

 Replica / kho dữ liệu <── job xếp hạng, báo cáo
```

- **Đề thi** sinh trước, cache trên Redis và CDN; tốt hơn là client tải đề mã hóa từ trước, đến giờ chỉ nhận khóa giải mã.
- **Phiên thi** giữ trên Redis bằng compare-and-swap (CAS) qua script Lua: key rỗng hoặc đang giữ đúng sessionId cũ thì đặt sessionId mới, ngược lại từ chối. Lua chạy nguyên tử nên hai request song song không thể cùng thắng.
- **Lưu bài** ghi Redis hash theo attempt, flush xuống DB theo lô.
- **Nộp bài** idempotent bằng khóa theo (user, vòng) ở DB, chấm bất đồng bộ qua Kafka.
- **Xếp hạng, báo cáo** chạy trên replica hoặc kho dữ liệu, không trên DB nghiệp vụ trong ca.

API chính: `POST /exams/{examId}/attempts` (tạo attempt, trả sessionId và khóa đề), `PUT /attempts/{id}/answers` (kèm sessionId, không khớp thì `409`), `POST /attempts/{id}/submit` kèm `Idempotency-Key`. Bảng log đáp án ghi dồn theo ca: clustered theo cột tăng dần hoặc heap, partition theo ca, không thêm index trên khóa ngẫu nhiên trong lúc thi.

##### Đào sâu: giây đầu ca

1. **Dàn tải:** gateway có token bucket và phòng chờ; client nhận vị trí trong hàng thay vì lỗi.
2. **Đẩy phần nặng ra khỏi giây đầu:** đề tải trước, request bắt đầu thi chỉ tạo attempt và phát khóa.
3. **Đường nóng không có thao tác tỉ lệ với kích thước dữ liệu:** không quét Redis, không sinh đề, không truy vấn tổng hợp.
4. **Giữ độ trễ từng request thấp:** theo Little's law, mỗi mili giây thêm ở DB nhân với vài nghìn request mỗi giây thành hàng trăm connection đang treo. Key nóng như cấu hình đề thì thêm cache vài giây trong bộ nhớ từng pod.

##### Đào sâu: một phiên và nộp đúng một lần

Lớp Redis (CAS phiên thi) chặn nhanh việc mở hai tab, hai thiết bị, nhưng Redis có thể mất. Lớp DB (unique key hoặc applock theo user và vòng) là lớp cuối: request nộp đến hai lần, Redis mất, kết quả vẫn chỉ ghi một lần; request lặp nhận lại bản ghi đã có.

Lưu bài cũng có đánh đổi: ghi thẳng 6.700 lần mỗi giây vào DB làm được nhưng mỗi lần là một transaction, áp lực ghi log rất lớn. Ghi Redis rồi flush theo lô giảm số transaction nhiều lần, cái giá là cửa sổ có thể mất dữ liệu trước lần flush; thu hẹp bằng chu kỳ flush ngắn và bản nháp phía client.

##### Khi hỏng

- **Mất Redis:** chậm hơn, tạm thời không chặn được hai phiên, nhưng kết quả vẫn ghi một lần. Lưu bài chuyển sang ghi DB có giới hạn tốc độ.
- **Kafka lag:** kết quả về chậm nhưng không mất.
- **DB chậm:** đẩy việc không thiết yếu ra hàng đợi, tắt tính năng phụ, nới hạn nộp.
- **Service phụ chậm:** timeout và circuit breaker cho lời gọi đồng bộ.

##### Quan sát

SLO cho bắt đầu thi và nộp bài (tỉ lệ request nhanh hơn ngưỡng). Dashboard theo ca: tải, lỗi, độ trễ, consumer lag, số người trong phòng chờ. Phía DB: số connection, wait THREADPOOL (hết worker thread) và WRITELOG (chờ ghi log).

#### Cách show off

Đây là đề gần nhất với kinh nghiệm của bạn, nên rủi ro lớn nhất là kể chuyện dự án thay vì thiết kế. Giữ khung sáu bước, chốt yêu cầu "theo ca" và "nộp đúng một lần", rồi tự dẫn về hai chỗ đào sâu: giây đầu ca và nộp một lần. Kinh nghiệm thật chỉ xuất hiện như bằng chứng.

> **Ví dụ:** "Chỗ tôi lo nhất là mười giây đầu ca, khi vài nghìn request mỗi giây cùng đổ vào. Tôi xử lý bằng cách làm cho request bắt đầu thi gần như không có việc gì: đề đã tải trước, request chỉ tạo attempt và trả khóa. Bài học này tôi có từ hệ thống thi đang làm: màn bắt đầu thi từng chậm lên hơn 2 giây chỉ vì trong request có một hàm quét Redis tìm key để xóa cache. Tôi dẫn đợt rà soát tìm ra nó, đồng nghiệp sửa, và sau đó trace về dưới 0,1 giây. Còn chuyện nộp đúng một lần, tôi không giao cho Redis: Redis chặn hai phiên cho nhanh, nhưng lớp cuối là khóa theo user và vòng ở DB, vì Redis mất thì DB vẫn phải đúng."

Những điểm ăn điểm:

- **Tách lớp giữ tốc độ và lớp giữ tính đúng.** "Mất Redis thì chậm hơn nhưng không sai" là câu người phỏng vấn muốn nghe.
- **Tự nêu cái giá của lưu bài qua Redis** và cách thu hẹp nó.
- **Biến bài học thật thành luật thiết kế:** đường nóng không có thao tác tỉ lệ với kích thước dữ liệu.

##### Nối với việc đã làm, đúng phạm vi

- **Applock nộp một lần:** của bạn, cho một sự kiện thi nhiều vòng; không được tạo object mới trên bảng dùng chung nên dùng `sp_getapplock` theo (user, vòng) thay vì unique index.
- **Lua CAS phiên thi:** lớp có sẵn. Nói "tôi hiểu và dùng lớp đó".
- **Bắt đầu thi chậm vì quét Redis:** bạn dẫn đợt rà soát và đề xuất cách sửa, đồng nghiệp commit. Số trước và sau là trace điển hình, không phải p95; đây là sự cố hiệu năng, không phải lần sập.
- **Kết thúc bài qua Kafka:** có thật, consumer do đồng nghiệp viết.
- **Phòng chờ, CDN đề mã hóa, flush theo lô:** thiết kế đề xuất. Nói "ở hệ thống tôi làm chưa có; nếu làm tôi sẽ…".

#### Câu hỏi vặn

- **"Giây đầu ca có 6.000 request mỗi giây, bạn làm gì?"** Đưa phần nặng ra khỏi giây đầu: đề tải trước qua CDN, giờ bắt đầu chỉ tạo attempt và phát khóa. Gateway có token bucket và phòng chờ. Đường nóng không có thao tác tỉ lệ với kích thước dữ liệu.
- **"Làm sao chặn một thí sinh mở hai phiên?"** CAS trên Redis theo (user, vòng): script Lua so sessionId rồi đặt mới, nguyên tử. Phiên cũ gửi lưu bài nhận `409`.
- **"Redis chết giữa ca thi thì sao?"** Chậm hơn và tạm mất lớp chặn hai phiên, nhưng nộp bài vẫn đúng một lần vì DB khóa theo user và vòng. Lưu bài chuyển sang ghi DB có giới hạn tốc độ.
- **"Lưu bài 6.700 lần mỗi giây ghi thẳng DB được không?"** Được nhưng tốn: mỗi lần là một transaction. Ghi Redis rồi flush theo lô giảm số transaction; cái giá là cửa sổ có thể mất dữ liệu nếu Redis mất trước khi flush.
- **"Lua CAS đó anh viết à?"** Không, đó là lớp có sẵn trên nền tảng; tôi hiểu và dùng nó. Phần tôi viết là khóa ghi một lần ở tầng DB bằng applock, vì không được thêm unique index trên bảng dùng chung.
- **"Bạn theo dõi hệ thống này thế nào trong ngày thi?"** SLO cho bắt đầu thi và nộp bài, dashboard theo ca gồm tải, lỗi, độ trễ, consumer lag, số người trong phòng chờ; phía DB theo dõi connection và các wait THREADPOOL, WRITELOG.

#### Bẫy cần tránh

- Biến bài thiết kế thành buổi kể dự án.
- Nhận phần Lua CAS hay consumer Kafka là của mình.
- Để Redis là nơi duy nhất bảo đảm nộp một lần.

#### Nhớ nhanh

- Tính đỉnh giây đầu, không chỉ trung bình.
- Đề sinh trước, tải trước; bắt đầu thi chỉ là một request nhẹ.
- Redis cho phiên và lưu bài nhanh; DB giữ tính đúng của kết quả.
- Nộp bài idempotent, chấm bất đồng bộ.
- Thành phần nào hỏng, dữ liệu kết quả vẫn phải đúng.

#### Bài tập

1. Đổi giả định: lưu bài mỗi 10 giây. Tính lại tải ghi và nêu thay đổi thiết kế.
   **Đáp án:** 20.000 lần ghi mỗi giây. Bắt buộc ghi Redis rồi flush theo lô (trực tiếp hoặc qua Kafka); bảng log không thêm index trong ca; chỉ gửi phần đáp án thay đổi thay vì cả bài.
2. Viết script Lua CAS cho phiên thi.
   **Đáp án:** `KEYS[1]` là key phiên theo (user, vòng); `ARGV[1]` là sessionId client đang giữ, `ARGV[2]` là sessionId mới, `ARGV[3]` là TTL giây.
   ```lua
   local cur = redis.call('GET', KEYS[1])
   if (not cur) or cur == ARGV[1] then
     redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
     return 1
   end
   return 0
   ```

### Bài 16.2. Leaderboard realtime

#### Kiến thức

##### Yêu cầu

Người chơi thấy top-N và hạng của mình gần như ngay sau khi có điểm. Bằng điểm thì ai đạt trước xếp trên. Message bị gửi lại không được làm điểm bị cộng hai lần.

##### Ước lượng

Giả định một mùa có 1 triệu người chơi, đỉnh 2.000 sự kiện điểm mỗi giây, 10.000 lượt xem bảng mỗi giây.

- **Bộ nhớ:** khoảng 100 byte mỗi member, 1 triệu member ≈ 100 MB cho một key.
- **Lệnh:** 2.000 `ZADD` và 10.000 `ZREVRANGE`/`ZREVRANK` mỗi giây, mỗi lệnh O(log N). Tổng vài chục nghìn lệnh, nằm trong sức một Redis instance.

##### Vì sao sorted set

Tính hạng bằng SQL cho mỗi request trên hàng triệu bản ghi là không khả thi. Sorted set giữ cặp (member, score) sắp sẵn: một hash table (tra score O(1)) cộng một skiplist có đếm khoảng cách giữa các nút, nên tính hạng chỉ O(log N).

##### Khung kiến trúc

```text
 Game service ──> Kafka (key = matchId) ──> Consumer ──> ZADD leaderboard:{season}
                                                │
                                                └──> DB (điểm gốc, để dựng lại)
 Client ──> Leaderboard API ──> ZREVRANGE (top-N), ZREVRANK (hạng của tôi)
```

##### Đào sâu: message gửi lại

Kafka giao at-least-once, nên consumer sẽ có lúc nhận lại cùng một sự kiện. Nếu dùng `ZINCRBY` (cộng thêm điểm) thì mỗi lần gửi lại là một lần cộng sai. Hai cách an toàn:

- Sự kiện mang **điểm tuyệt đối** (tổng điểm hiện tại, tính từ DB), consumer dùng `ZADD key GT score member`: chỉ cập nhật khi điểm mới lớn hơn điểm đang có. Gửi lại bao nhiêu lần cũng ra cùng kết quả. `GT` có từ Redis 6.2.
- Hoặc dedupe theo id sự kiện trước khi cộng.

##### Đào sâu: phá hòa điểm

Cùng score, Redis xếp theo thứ tự từ điển của member, không có ý nghĩa nghiệp vụ. Muốn "ai đạt trước xếp trên" thì mã hóa cả điểm và thời gian vào score:

`score = points × T + (T − 1 − s)`, với `s` là số giây kể từ đầu mùa và `T` lớn hơn độ dài mùa tính bằng giây.

Ai đạt sớm thì `s` nhỏ, phần dư lớn hơn, nên xếp trên. Ràng buộc quan trọng: score là số double, chỉ biểu diễn chính xác số nguyên tới 2^53 ≈ 9 × 10^15. Với `T = 10^8` (đủ cho mùa dài khoảng ba năm), điểm tối đa là khoảng 90 triệu. Đừng dùng epoch giây làm `s`: epoch hiện đã cỡ 1,8 tỉ, đẩy `T` lên 10^10 và ăn mất phần lớn chỗ dành cho điểm. Khi tính `score` phải kiểm tra vượt 2^53 và báo lỗi thay vì lặng lẽ mất chính xác. Nếu dải điểm hoặc độ dài mùa không vừa, đừng cố nhồi: giữ score là điểm thuần và xử lý hòa ở tầng đọc.

##### Điểm nghẽn

- **Key nóng:** một key toàn quốc nằm trọn trên một node của Redis Cluster. Vài nghìn lệnh mỗi giây vẫn ổn; lớn hơn thì chia key theo phòng hoặc khu vực, gộp top-N định kỳ.
- **Đọc top-N:** cache top-100 vài giây trong bộ nhớ pod; hạng của từng người vẫn đọc trực tiếp.

##### Khi hỏng

- **Mất Redis:** dựng lại từ DB hoặc replay Kafka từ offset cũ. Trong lúc dựng, API trả bảng đã cache hoặc báo đang cập nhật.
- **Consumer lag:** bảng trễ nhưng không sai; hiện lag trên dashboard.
- **Lệch với DB:** đối soát định kỳ, DB là nguồn đúng.

##### Quan sát

Độ trễ cập nhật hạng = thời điểm `ZADD` xong trừ timestamp sự kiện, ghi bằng histogram, xem p95. Trong .NET, khai báo bucket hợp với đơn vị: bucket mặc định của OpenTelemetry .NET (0, 5, 10, 25… 10.000) dành cho mili giây, ghi giây mà không đổi bucket thì gần như mọi giá trị rơi vào bucket đầu. Thêm consumer lag, bộ nhớ Redis, số lệnh mỗi giây trên node chứa key.

##### Tính sẵn hay realtime

Nếu nghiệp vụ chấp nhận trễ, một job tính sẵn hạng theo phạm vi (trường, tỉnh, toàn quốc), API chỉ đọc ra, giới hạn top-N để payload nhỏ. Rẻ và đơn giản hơn nhiều; cái giá là bảng trễ đúng bằng chu kỳ job.

#### Cách show off

Bạn có kinh nghiệm thật ở đây: bạn viết toàn bộ luồng leaderboard cho chế độ thi đấu đối kháng, từ sự kiện điểm qua Kafka, consumer cập nhật Redis sorted set, tới API đọc top-N và hạng. Nhưng một số chi tiết trong bài (`ZADD GT`, công thức phá hòa, cách chia key) là thiết kế theo cách làm tốt, có thể khác code bạn đã viết. Trước buổi phỏng vấn, mở lại code và nói đúng code; nếu code dùng `ZINCRBY`, nói vậy kèm rủi ro khi message gửi lại.

Dẫn buổi này về ba câu khó: message gửi lại, hòa điểm, Redis mất dữ liệu. Bạn nói trước thì người phỏng vấn chỉ còn xác nhận.

> **Ví dụ:** "Tôi từng viết luồng leaderboard cho chế độ đấu đối kháng: điểm đi qua Kafka, consumer cập nhật Redis sorted set, API đọc top-N và hạng. Với thiết kế này tôi lo ba chỗ. Kafka có thể giao lại message, nên tôi muốn sự kiện mang tổng điểm và cập nhật bằng ZADD GT thay vì cộng dồn. Hòa điểm thì mã hóa thời gian vào score, nhưng phải tính giới hạn của số double, nên tôi dùng giây kể từ đầu mùa chứ không dùng epoch. Và Redis chỉ là bản chiếu để đọc nhanh; điểm gốc nằm ở DB, mất Redis thì dựng lại. Về tải, đỉnh khoảng mười nghìn người chơi gửi điểm trong cùng một khung vài phút giờ cao điểm, tôi lấy từ số user khác nhau trong topic Kafka trên monitoring."

Những điểm ăn điểm:

- **Tự nói giới hạn 2^53 của double.** Rất ít ứng viên nhớ tới, và đây là chỗ công thức phá hòa hay sai.
- **Phân biệt realtime và tính sẵn.** Hệ thống bạn làm có cả hai: leaderboard đối kháng realtime (của bạn) và bảng xếp hạng trang chủ học sinh theo trường, xã, tỉnh, toàn quốc được tính sẵn bằng job SQL trong kho dữ liệu (job không phải của bạn). Nói được vì sao mỗi cái hợp chỗ của nó là điểm cộng.
- **DB là nguồn đúng, Redis dựng lại được.**
- **Nói con số tải kèm nguồn đo.** Số user khác nhau trong topic Kafka trên monitoring, không phải số đoán.

#### Câu hỏi vặn

- **"Vì sao chọn sorted set mà không tính hạng bằng SQL?"** Sorted set giữ dữ liệu sắp sẵn trong bộ nhớ; `ZADD`, `ZREVRANK` là O(log N), `ZREVRANGE` là O(log N + M). Tính hạng bằng SQL trên hàng triệu dòng cho mỗi lượt xem là quá đắt, trừ khi chấp nhận tính sẵn theo chu kỳ.
- **"Hai người bằng điểm thì xếp thế nào?"** Mã hóa điểm và thời gian vào một score, ai đạt trước có phần thời gian lớn hơn. Phải tính giới hạn 2^53 của double: dùng giây kể từ đầu mùa thay cho epoch, và kiểm tra tràn khi tính.
- **"Kafka gửi trùng message thì sao?"** Sự kiện mang điểm tuyệt đối và consumer dùng `ZADD GT`, nên gửi lại không làm sai. Nếu luồng buộc phải cộng dồn thì dedupe theo id sự kiện trước khi cộng.
- **"Code thật của anh dùng ZADD GT à?"** Tôi trả lời đúng theo code: nếu code dùng cộng dồn thì tôi nói vậy, kèm rủi ro khi message gửi lại và cách tôi sẽ sửa.
- **"Redis mất dữ liệu thì sao?"** Dựng lại từ DB hoặc replay Kafka từ offset cũ; DB là nguồn đúng.
- **"Mười nghìn người chơi cùng lúc là đo hay đoán?"** Là số đo. Đỉnh khoảng mười nghìn người chơi gửi điểm trong cùng một khung vài phút giờ cao điểm, lấy từ số user khác nhau trong topic Kafka trên monitoring. Từ đó tôi tính ra số sự kiện điểm mỗi giây để chọn số partition và số consumer.
- **"Khi nào bạn không làm realtime?"** Khi nghiệp vụ chấp nhận trễ và dữ liệu đã nằm trong kho. Bảng xếp hạng trang chủ ở hệ thống tôi làm là ví dụ: job tính sẵn theo phạm vi, API chỉ đọc, rẻ và đơn giản hơn.

#### Bẫy cần tránh

- Dùng epoch giây trong công thức phá hòa mà không tính giới hạn 2^53.
- Dùng `ZINCRBY` mà không nói gì về message gửi lại.
- Gộp bảng xếp hạng tính sẵn (job không phải của bạn) vào câu chuyện leaderboard của mình.
- Nói con số người chơi mà không nói đo ở đâu, trong khung thời gian nào.

#### Nhớ nhanh

- Sorted set: hạng O(log N), dữ liệu sắp sẵn.
- Điểm tuyệt đối với `ZADD GT`, hoặc dedupe theo id sự kiện.
- Phá hòa bằng mã hóa vào score, dùng giây từ đầu mùa, kiểm tra 2^53.
- DB là nguồn đúng; Redis dựng lại được.
- Chấp nhận trễ thì tính sẵn.

#### Bài tập

1. Với `T = 10^8`, tính score cho người được 850 điểm, đạt lúc 1.000.000 giây kể từ đầu mùa.
   **Đáp án:** 850 × 10^8 + (10^8 − 1 − 1.000.000) = 85.000.000.000 + 98.999.999 = 85.098.999.999. Nhỏ hơn 2^53 rất xa nên an toàn.
2. Viết lệnh lấy top 10 kèm điểm và hạng của user 42.
   **Đáp án:**
   ```bash
   ZREVRANGE leaderboard:s1 0 9 WITHSCORES
   ZREVRANK leaderboard:s1 user:42
   ```
   `ZREVRANK` trả hạng tính từ 0, hiển thị cho người dùng thì cộng 1.

### Bài 16.3. API idempotent cho nộp bài và thanh toán

#### Kiến thức

##### Bài toán

Client luôn có lý do gửi lại request: mất mạng, timeout, bấm hai lần, thư viện HTTP tự retry. Yêu cầu: cùng một thao tác gửi nhiều lần thì cho cùng kết quả, nghiệp vụ chỉ ghi nhận một lần. Đây là **ghi idempotent**, không phải exactly-once delivery: request vẫn có thể đến nhiều lần, chỉ tác dụng nghiệp vụ là xảy ra một lần.

##### Ước lượng

- Nộp bài: 200 nghìn trong 5 phút cuối ≈ 670 request mỗi giây; giả định 5% retry ≈ 33 request trùng mỗi giây.
- Kho idempotency: 200 nghìn key × khoảng 1 KB (trạng thái và response) ≈ 200 MB, TTL 24 giờ. Nhỏ.

##### Thiết kế

```text
 Client ── POST /submit, Idempotency-Key: K ──> API
   API: SET NX idem:{user}:{K} = PROCESSING (TTL ngắn)
     ├─ đặt được  → xử lý
     │              → DB: khóa theo (user, vòng), ghi một lần
     │              → SET idem:{user}:{K} = DONE + response (TTL 24 giờ)
     └─ đã tồn tại → đọc trạng thái
                     ├─ PROCESSING → 409 (hoặc chờ ngắn rồi đọc lại)
                     └─ DONE       → trả lại response đã lưu
```

- Dùng thẳng `SET NX` để giành quyền xử lý. Làm "GET trước rồi mới SET" sẽ có khe hở: hai request cùng GET thấy rỗng rồi cùng xử lý.
- Key gắn với user, để người khác không dùng key đoán được mà đọc response của người khác.
- Lưu hash của body: cùng key mà body khác là lỗi phía client, trả `422`.
- **Lớp cuối ở DB:** unique constraint, hoặc applock kèm kiểm tra tồn tại với `UPDLOCK, HOLDLOCK`. Kho idempotency có TTL và có thể mất; DB thì không được sai.

##### Applock khi không thêm được unique index

`sp_getapplock` lấy một khóa có tên do mình đặt (ví dụ `submit:{userId}:{roundId}`) trong transaction. Hai request cùng user cùng vòng sẽ xếp hàng; request khác user không ảnh hưởng nhau. Bên trong khóa: kiểm tra đã có kết quả chưa (với `UPDLOCK, HOLDLOCK`), có thì trả bản ghi cũ, chưa có thì insert. Unique index vẫn là cách sạch nhất khi được sửa schema; applock là lựa chọn khi có ràng buộc không tạo thêm object trên bảng dùng chung.

##### Thanh toán

- Trạng thái PENDING → SUCCEEDED hoặc FAILED. Tạo bản ghi PENDING trước khi gọi cổng thanh toán.
- Gửi kèm idempotency key sang cổng thanh toán nếu cổng hỗ trợ, và mọi lần gọi lại dùng cùng key đó.
- Timeout không có nghĩa là thất bại: giữ PENDING, đối soát qua webhook và truy vấn trạng thái định kỳ.
- Webhook ghi vào bảng inbox với unique trên id sự kiện, xử lý idempotent: trùng thì bỏ qua và vẫn trả `200`.

##### Khi hỏng

- **Mất kho idempotency:** DB vẫn chặn ghi trùng; request lặp nhận lại bản ghi đã có thay vì lỗi.
- **Process chết khi đang PROCESSING:** TTL hết thì request sau xử lý lại; DB bảo đảm không ghi hai lần.
- **Cổng thanh toán timeout:** giữ PENDING, đối soát sau; không bao giờ tự trừ tiền lần hai.

##### Quan sát

Số request trùng theo endpoint, số lần trả `409`, số bản ghi PENDING quá hạn, và số cặp (user, vòng) bị trùng trong DB. Con số cuối phải luôn bằng 0; đặt alert nếu khác 0.

#### Cách show off

Đây là đề bạn có câu chuyện thật mạnh nhất: chính tay bạn làm khóa ghi một lần bằng applock cho một sự kiện thi nhiều vòng. Câu chuyện tốt vì có một ràng buộc thật (không được thêm unique index) buộc bạn chọn giải pháp khác sách vở. Mạch kể: vấn đề retry → unique index bị ràng buộc → applock theo (user, vòng), vì sao không khóa cả bảng → vị trí của nó trong các lớp bảo vệ → idempotent khác exactly-once thế nào.

> **Ví dụ:** "Ở một sự kiện thi nhiều vòng, mỗi học sinh mỗi vòng chỉ được có một kết quả, nhưng request kết thúc bài có thể bị gửi lại khi mạng chập chờn. Cách sạch nhất là unique index, nhưng ràng buộc của dự án là không tạo thêm object trên bảng dùng chung. Tôi dùng sp_getapplock theo khóa user và vòng trong transaction, kiểm tra tồn tại với UPDLOCK, HOLDLOCK; có rồi thì trả bản ghi cũ, chưa có mới insert. Khóa này chỉ xếp hàng các request của cùng một người nên không thành điểm nghẽn. Phía trên, nền tảng có sẵn idempotency key và khóa Redis do đồng nghiệp viết; tôi coi DB là lớp cuối, vì Redis có thể mất còn kết quả thi thì không được trùng."

Những điểm ăn điểm:

- **Nói "ghi idempotent", không nói "exactly-once",** và giải thích được khác nhau ở đâu.
- **Nhiều lớp, mỗi lớp một vai:** idempotency key cho trải nghiệm (trả lại đúng response), khóa DB cho tính đúng.
- **Chỉ ra khe hở GET rồi SET** khi có request song song.
- **Thanh toán: timeout không phải thất bại.** Bạn chưa làm thanh toán, nên nói thẳng: "phần này tôi chưa làm trực tiếp, nếu làm tôi sẽ…".

##### Nối với việc đã làm, đúng phạm vi

- **Applock ghi một lần:** của bạn.
- **Idempotency key giữ 24 giờ và khóa Redis ngắn cho attempt:** lớp có sẵn do đồng nghiệp viết.
- **Callback chấm bài viết bằng AI:** trong luồng chấm bài viết mà bạn viết phần lớn, callback được ghi vào bảng inbox để xử lý idempotent khi đến trùng.
- **Kết quả trùng giảm bao nhiêu:** trước khi có applock, vài chục cặp (user, vòng) bị trùng mỗi ngày, dồn vào giờ cao điểm; sau khi deploy về 0 và giữ ở 0 tới hết sự kiện. Đo bằng câu đếm cặp (user, vòng) có hơn một kết quả, nhóm theo ngày, chạy trước và sau.

#### Câu hỏi vặn

- **"Request trùng đến khi request đầu đang xử lý thì sao?"** Request đầu đã giành key bằng `SET NX` với trạng thái PROCESSING. Request sau thấy PROCESSING thì nhận `409`, hoặc chờ ngắn rồi đọc lại response.
- **"Đây có phải exactly-once không?"** Không. Request vẫn có thể đến nhiều lần; điều được bảo đảm là ghi nhận nghiệp vụ chỉ xảy ra một lần nhờ khóa theo key nghiệp vụ.
- **"Có kho idempotency rồi sao vẫn cần khóa ở DB?"** Vì kho có TTL và có thể mất, process có thể chết giữa chừng. Unique constraint hoặc applock ở DB là lớp đảm bảo cuối cùng.
- **"Sao không dùng unique index?"** Nếu được sửa schema thì đó là cách tốt nhất. Ở sự kiện thật, ràng buộc là không tạo object mới trên bảng dùng chung, nên tôi dùng applock: chỉ xếp hàng theo từng user và vòng, không khóa bảng.
- **"Applock có làm chậm hệ thống lúc đỉnh không?"** Không đáng kể, vì khóa theo tên riêng từng (user, vòng); chỉ request của cùng một người phải chờ nhau, và khóa chỉ giữ trong một transaction ngắn.
- **"Thanh toán timeout thì làm gì?"** Không coi là thất bại. Giữ PENDING, đối soát qua webhook và truy vấn trạng thái; mọi lần gọi lại cổng đều mang cùng idempotency key. Phần này tôi chưa làm trực tiếp, đây là cách tôi sẽ thiết kế.
- **"Phần nào trong luồng này là của anh?"** Khóa ghi một lần bằng applock ở tầng DB là của tôi. Idempotency key và khóa Redis cho attempt là lớp có sẵn của đồng nghiệp.

#### Bẫy cần tránh

- Nói "exactly-once" cho một hệ thống thực chất là at-least-once cộng ghi idempotent.
- Thiết kế kiểm tra rồi mới đặt key (GET rồi SET) mà không thấy khe hở song song.
- Dựa hoàn toàn vào Redis cho tính đúng.
- Nhận cả lớp idempotency key là của mình.

#### Nhớ nhanh

- `Idempotency-Key` gắn với user, lưu trạng thái và response có TTL.
- `SET NX` giành quyền; PROCESSING → `409`; DONE → trả lại response cũ; body khác → `422`.
- DB là lớp cuối: unique constraint hoặc applock theo key nghiệp vụ.
- Thanh toán: PENDING trước, timeout không phải thất bại, webhook qua inbox.

#### Bài tập

1. Viết luồng xử lý webhook thanh toán đến trùng 3 lần.
   **Đáp án:** Insert vào inbox với unique trên eventId; trùng thì bỏ qua và trả `200`. Trong cùng transaction, cập nhật PENDING → SUCCEEDED chỉ khi trạng thái hiện tại vẫn là PENDING (điều kiện trong câu `UPDATE`).
2. Viết câu SQL đếm số cặp (user, vòng) bị trùng theo ngày, để làm metric phải bằng 0.
   **Đáp án:**
   ```sql
   SELECT CAST(CreatedAt AS date) AS d, COUNT(*) AS dup_pairs
   FROM (SELECT UserId, RoundId, MIN(CreatedAt) AS CreatedAt
         FROM dbo.Result GROUP BY UserId, RoundId HAVING COUNT(*) > 1) x
   GROUP BY CAST(CreatedAt AS date);
   ```

### Bài 16.4. Pipeline báo cáo gần realtime

#### Kiến thức

##### Yêu cầu

Dashboard cho cấp quản lý (Sở giáo dục, trường) xem kết quả thi gần realtime, dữ liệu trễ dưới vài phút, và truy vấn tổng hợp không được làm chậm DB nghiệp vụ.

##### Ước lượng

Giả định 5 triệu bản ghi kết quả mỗi ngày, đỉnh gấp 20 lần trung bình.

- Trung bình 5.000.000 / 86.400 ≈ 58 bản ghi mỗi giây; đỉnh ≈ 1.200.
- 200 byte mỗi bản ghi → khoảng 1 GB mỗi ngày dữ liệu thô; kho dạng cột nén 5–10 lần → 100–200 MB mỗi ngày.

Các con số này không lớn. Đó là lý do phải thử phương án rẻ trước.

##### Các phương án, từ rẻ đến đắt

1. **Tăng tần suất job tổng hợp đang có.** Không thêm gì, nhưng độ tươi bị chặn bởi thời gian chạy job.
2. **Columnstore index trên SQL Server.** Lưu theo cột, nén tốt, truy vấn tổng hợp nhanh hơn nhiều. Có ở Standard Edition từ 2016 SP1, nhưng Standard giới hạn columnstore segment cache 32 GB mỗi instance và chỉ cho batch mode chạy tối đa DOP 2; tạo index cũng không chạy song song và không online được (kể cả SQL Server 2025 Standard), nên phải làm trong khung bảo trì.
3. **Đọc báo cáo từ replica** để tách hẳn tải khỏi primary.
4. **CDC → Kafka → kho dạng cột (ClickHouse)**, khi dữ liệu và số dashboard vượt khả năng SQL Server.

##### Thiết kế phương án 4

```text
 SQL Server (bật CDC trên bảng nguồn)
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

- **CDC** (Change Data Capture) của SQL Server dùng một job đọc transaction log và ghi mọi thay đổi vào bảng change, kèm vị trí trong log (LSN). Debezium đọc các bảng change đó và đẩy vào Kafka.
- Ngữ nghĩa at-least-once, nên dữ liệu có thể trùng. `ReplacingMergeTree` giữ bản có version lớn nhất, nhưng chỉ khử trùng khi merge chạy nền; truy vấn cần chính xác phải dùng `FINAL` hoặc `argMax`.
- Dòng bị xóa: Debezium phát sự kiện delete; phía ClickHouse dùng cột `is_deleted` và lọc khi truy vấn.
- **Độ tươi** = thời điểm ghi vào ClickHouse trừ thời điểm commit ở nguồn.

##### Rủi ro và khi hỏng

- **Capture job dừng:** transaction log không cắt được (`log_reuse_wait_desc = REPLICATION`), log phình tới đầy ổ đĩa và DB nghiệp vụ đứng. Đây là rủi ro lớn nhất; phải alert theo kích thước log.
- **Snapshot ban đầu bảng lớn:** dùng incremental snapshot của Debezium, chạy ngoài giờ cao điểm.
- **Đổi schema bảng nguồn:** CDC không tự theo; cần quy trình riêng cho bảng change và topic.
- **Kafka Connect hoặc ClickHouse chết:** dashboard trễ, dữ liệu không mất vì Kafka còn giữ; hệ nghiệp vụ không bị ảnh hưởng.

##### Quan sát

Độ tươi dữ liệu theo bảng (đặt SLO cho nó), consumer lag, kích thước transaction log và `log_reuse_wait_desc` ở nguồn, đối soát số dòng nguồn và đích theo ngày.

#### Cách show off

Đề này kiểm tra nhiều nhất một phẩm chất: bạn có cưỡng lại được việc đưa công nghệ mới vào khi chưa cần không. Câu trả lời ghi điểm là đi từ hiện trạng, thử phương án rẻ trước, và chỉ đề xuất CDC kèm điều kiện cụ thể.

Ở đây tách rõ hiện trạng và thiết kế. Phần chạy thật trong hệ thống bạn làm là một warehouse báo cáo cho khách hàng doanh nghiệp (các Sở giáo dục): job SQL Server Agent chạy mỗi giờ, tổng hợp theo từng Sở vào các bảng riêng, nạp dữ liệu mới theo kiểu incremental (nhớ mốc lớn nhất đã nạp, lần sau chỉ lấy phần mới hơn). Phần bạn làm chắc chắn là API báo cáo bằng C#, giới hạn phạm vi dữ liệu theo token của người dùng. Production hiện mới có một Sở đối tác. Pipeline CDC → Kafka → ClickHouse là thiết kế bạn đã tìm hiểu, chưa triển khai.

> **Ví dụ:** "Ở hệ thống tôi làm, báo cáo cho Sở đang chạy bằng job SQL Server Agent mỗi giờ, tổng hợp theo từng Sở và nạp incremental, còn phần tôi làm là API báo cáo giới hạn dữ liệu theo phạm vi của người đăng nhập. Giới hạn của cách đó là dữ liệu trễ tới một giờ và logic nằm trong SQL, khó test. Tôi đã tìm hiểu hướng CDC qua Debezium vào ClickHouse nhưng chưa triển khai. Với quy mô hiện tại mới một Sở, tôi sẽ thử columnstore và replica trước, vì không thêm hạ tầng. ClickHouse chỉ đáng khi số liệu cho thấy SQL Server không theo kịp, và khi đó rủi ro đầu tiên tôi theo dõi là capture job dừng làm transaction log nguồn phình đầy ổ."

Những điểm ăn điểm:

- **Thứ tự leo thang có lý do:** tăng tần suất job, columnstore, replica, rồi mới CDC.
- **Biết rủi ro vận hành của CDC trên DB nguồn:** log không cắt được khi capture job dừng. Đây là chi tiết người đã đọc kỹ mới nói ra.
- **Biết giới hạn Standard Edition:** columnstore có nhưng giới hạn bộ nhớ và song song; không tạo index online.
- **Nói rõ ranh giới:** đang chạy thật là job mỗi giờ; CDC là thiết kế chưa làm; phần SQL của warehouse không nhận bừa là của mình.

#### Câu hỏi vặn

- **"Sao không dùng columnstore cho đơn giản?"** Nên thử trước. Nếu đạt mục tiêu độ tươi và tốc độ dashboard thì không cần thêm hạ tầng. ClickHouse chỉ đáng khi dữ liệu và số dashboard vượt khả năng SQL Server.
- **"CDC ảnh hưởng gì tới DB nguồn?"** Tăng tải đọc transaction log và ghi bảng change. Nguy hiểm nhất là capture job dừng: log không cắt được, phình tới đầy ổ đĩa, DB nghiệp vụ đứng.
- **"Dữ liệu trùng trong ClickHouse xử lý thế nào?"** `ReplacingMergeTree` với version là LSN, khử trùng khi merge chạy nền. Truy vấn cần chính xác dùng `FINAL` hoặc `argMax` theo version.
- **"Độ tươi dữ liệu đo thế nào?"** Lấy thời điểm ghi vào ClickHouse trừ thời điểm commit ở nguồn, đo theo từng bảng, đặt SLO và alert cho nó.
- **"Anh đã chạy ClickHouse trên production chưa?"** Chưa, hiện trạng là job tổng hợp mỗi giờ trên SQL Server và phần của tôi là API báo cáo. Nếu làm, tôi bật CDC trên các bảng nguồn cần báo cáo, Debezium đẩy vào Kafka, ClickHouse dùng `ReplacingMergeTree` với version là LSN; hai chỉ số tôi theo dõi đầu tiên là độ trễ capture và dung lượng log của DB nguồn.
- **"Quy mô warehouse hiện tại thế nào?"** Mới có một Sở đối tác trên production, dữ liệu trễ tối đa khoảng một giờ và nghiệp vụ chấp nhận được. Chính vì quy mô đó mà tôi không đề xuất ClickHouse ngay.

#### Bẫy cần tránh

- Mở đầu bằng Kafka và ClickHouse khi chưa nói hiện trạng và phương án rẻ.
- Nói "hàng triệu học sinh" cho warehouse đang có một Sở.
- Nhận pipeline CDC là việc đã làm.
- Quên rủi ro log nguồn đầy khi nói về CDC.

#### Nhớ nhanh

- Thử rẻ trước: tăng tần suất job, columnstore, replica.
- CDC → Kafka → ClickHouse cho độ tươi vài phút và tải phân tích lớn.
- At-least-once, khử trùng bằng version; truy vấn chính xác cần `FINAL` hoặc `argMax`.
- Rủi ro lớn nhất: capture job dừng, log nguồn không cắt được.
- Thật: job mỗi giờ, API báo cáo của bạn; CDC chưa triển khai.

#### Bài tập

1. Viết truy vấn ClickHouse lấy điểm mới nhất của mỗi bài thi khi bảng còn bản ghi trùng, bỏ bài đã xóa.
   **Đáp án:**
   ```sql
   SELECT attempt_id, argMax(score, lsn) AS score
   FROM results
   GROUP BY attempt_id
   HAVING argMax(is_deleted, lsn) = 0;
   ```
2. Liệt kê 3 metric cần alert cho pipeline này.
   **Đáp án:** Độ tươi dữ liệu vượt ngưỡng; consumer lag tăng liên tục; kích thước transaction log nguồn tăng bất thường kèm `log_reuse_wait_desc = REPLICATION`.

### Bài 16.5. SSO cho nhiều sản phẩm

#### Kiến thức

##### Yêu cầu

Một tài khoản dùng cho nhiều sản phẩm web; vào sản phẩm thứ hai không phải đăng nhập lại; đăng xuất một nơi thì các nơi khác cũng thoát; token không lộ ra JavaScript nếu tránh được.

##### Ước lượng

Giả định 200 nghìn người đăng nhập trong 10 phút trước ca thi ≈ 333 lần đăng nhập mỗi giây, mỗi lần 4–6 request chuyển hướng và đổi token. Phiên phía server khoảng 2 KB × 200 nghìn ≈ 400 MB trên Redis. API kiểm JWT tại chỗ bằng khóa công khai lấy từ JWKS đã cache, nên không gọi identity server ở mỗi request.

##### Thiết kế

```text
 Trình duyệt ──cookie HttpOnly──> BFF (ASP.NET Core, YARP)
                                   │  ticket phiên trên Redis
                                   │  data protection keys trên Redis
                                   ├──> Identity server (OIDC, code + PKCE)
                                   └──> API sản phẩm (access token gắn ở BFF)
 App khác ──chuyển hướng cả trang, skip_login──> Identity server ──(phiên SSO còn)──> code
```

- **OIDC Authorization Code + PKCE.** Client sinh một chuỗi ngẫu nhiên `code_verifier`, gửi `code_challenge = BASE64URL(SHA256(code_verifier))` khi xin code; lúc đổi code lấy token phải gửi lại verifier. Kẻ chặn được code mà không có verifier thì không đổi được token. Code dùng một lần, sống ngắn.
- **BFF (Backend for Frontend).** Token nằm ở server; trình duyệt chỉ giữ cookie `HttpOnly`, `SameSite=Lax`; bật antiforgery. JavaScript bị XSS cũng không đọc được token.
- **Ticket phiên trên Redis** thay vì nhét cả JWT vào cookie: cookie nhỏ, thu hồi phiên ngay được. Data protection keys lưu chung để pod nào cũng giải mã được cookie.
- **Silent SSO.** Trình duyệt hiện đại chặn cookie bên thứ ba, nên kiểu kiểm phiên bằng iframe ẩn không còn đáng tin. Thay bằng chuyển hướng cả trang tới identity server với cờ `skip_login`: còn phiên thì nhận code, hết phiên thì quay về trạng thái chưa đăng nhập. Cần cooldown sau đăng xuất và cờ đánh dấu đang chờ để chống vòng lặp chuyển hướng.
- **Đồng bộ giữa các tab:** `BroadcastChannel`.
- **Đăng xuất toàn bộ:** xóa phiên trên Redis, thu hồi refresh token, dùng front-channel hoặc back-channel logout của OIDC để báo các app.

##### Khi hỏng

- **Identity server chậm lúc đỉnh:** người đã có phiên vẫn dùng bình thường vì API kiểm JWT tại chỗ; chỉ đăng nhập mới bị chậm.
- **Mất Redis của BFF:** mất phiên, người dùng phải đăng nhập lại; không lộ dữ liệu.
- **Xoay khóa ký:** cache JWKS theo `kid`, gặp `kid` lạ thì tải lại JWKS.

##### Quan sát

Tỉ lệ đăng nhập thành công, số vòng lặp chuyển hướng bị chặn, thời gian đổi token, số yêu cầu hỗ trợ liên quan tới đăng nhập theo tuần.

#### Cách show off

Đề SSO dễ biến thành buổi đọc thuộc chuẩn OIDC. Cách ghi điểm là giải thích từng lựa chọn bằng mối đe dọa nó chặn: PKCE chặn ai, BFF chặn gì, vì sao `SameSite=Lax` chưa đủ. Và nói được vấn đề thực tế mà sách cũ không có: trình duyệt chặn cookie bên thứ ba làm silent SSO bằng iframe hỏng.

Phạm vi thật của bạn cần nói rạch ròi. Lõi BFF (PKCE, ticket phiên trên Redis, reverse proxy) đã có sẵn khi bạn vào, do đồng nghiệp viết. Phần của bạn: siết bảo mật cho BFF (CORS theo danh sách cho phép, cấu hình cookie, chuyển endpoint đổi token sang POST, thêm cờ bật Turnstile chống bot), silent SSO phía client cho trang web thi IOE, SSO cho sản phẩm IOSTEM, và xác thực giữa các service cho hệ CRM. Về con số trong CV: bạn gia cố BFF và SSO cho web IOE và IOSTEM; hai sản phẩm còn lại dùng chung nền BFF/SSO đó, đồng nghiệp tích hợp, bạn hỗ trợ cấu hình. Kết quả: ticket hỗ trợ về đăng nhập giảm khoảng một nửa trong vài tuần sau, đếm theo nhãn ticket so vài tuần trước và sau.

> **Ví dụ:** "Lõi BFF ở hệ thống tôi làm đã có từ trước: token nằm ở server, trình duyệt chỉ giữ cookie HttpOnly, phiên lưu trên Redis. Phần tôi làm là siết bảo mật cho nó, như giới hạn CORS theo danh sách cho phép và chuyển endpoint đổi token sang POST, rồi làm silent SSO cho web thi. Chỗ khó nhất là trình duyệt chặn cookie bên thứ ba, nên cách kiểm phiên bằng iframe ẩn không chạy được. Tôi chuyển sang chuyển hướng cả trang tới identity server với cờ không bắt đăng nhập: còn phiên thì quay về với code, hết phiên thì về trạng thái khách. Cái giá là phải chống vòng lặp chuyển hướng, nên tôi thêm cooldown sau đăng xuất và cờ đánh dấu đang chờ. Vài tuần sau, ticket hỗ trợ về đăng nhập giảm khoảng một nửa, đếm theo nhãn ticket."

Những điểm ăn điểm:

- **Gắn mỗi lựa chọn với mối đe dọa:** PKCE cho public client, BFF chống lộ token qua XSS, antiforgery bổ sung cho `SameSite`.
- **Biết chuyện cookie bên thứ ba** và hệ quả với silent SSO.
- **Nói tới vận hành nhiều pod:** data protection keys dùng chung, xoay khóa ký theo `kid`.
- **Ranh giới rõ:** lõi có sẵn, phần siết bảo mật và client là của bạn.

#### Câu hỏi vặn

- **"Vì sao dùng PKCE mà không dùng client secret?"** SPA là public client, không giữ được secret vì mọi thứ trong trình duyệt đều đọc được. PKCE làm cho kẻ chặn được code cũng không đổi được token, vì không có verifier.
- **"Vì sao lưu ticket trên server thay vì JWT trong cookie?"** Thu hồi được phiên ngay bằng cách xóa trên Redis, cookie nhỏ, không lộ claim ra client. Cái giá là phụ thuộc Redis: mất Redis thì người dùng phải đăng nhập lại.
- **"Silent SSO làm thế nào khi cookie bên thứ ba bị chặn?"** Chuyển hướng cả trang tới identity server với `skip_login`; còn phiên thì nhận code, hết phiên thì quay về trạng thái chưa đăng nhập. Có cooldown sau đăng xuất và cờ chống vòng lặp.
- **"SameSite=Lax đủ chống CSRF chưa?"** Chặn được POST từ site khác, nhưng request GET có tác dụng phụ vẫn lọt và có những trường hợp đặc biệt, nên tôi vẫn bật antiforgery token.
- **"Đăng xuất một app thì các app khác thế nào?"** Xóa phiên trên Redis, thu hồi refresh token, dùng front-channel hoặc back-channel logout để báo các app; trong cùng trình duyệt thì `BroadcastChannel` báo các tab.
- **"Phần nào trong SSO là của anh?"** Lõi BFF có sẵn. Phần của tôi là siết bảo mật cho BFF, silent SSO cho web thi, SSO cho một sản phẩm khác và xác thực giữa các service cho CRM. Hai sản phẩm còn lại dùng chung nền đó, đồng nghiệp tích hợp, tôi hỗ trợ cấu hình.
- **"Identity server chết lúc đầu ca thi thì sao?"** Người đã đăng nhập vẫn làm bài được vì API kiểm JWT tại chỗ bằng khóa đã cache. Chỉ người đăng nhập mới bị ảnh hưởng, nên khuyến khích đăng nhập trước giờ thi và dàn tải màn đăng nhập.

#### Bẫy cần tránh

- Đọc thuộc luồng OIDC mà không nói mỗi bước chặn mối đe dọa gì.
- Đề xuất lưu token trong `localStorage` cho SPA.
- Nhận cả lõi BFF là của mình.
- Nói "4 sản phẩm" mà không tách phần mình làm (web IOE, IOSTEM) với phần đồng nghiệp tích hợp; nói mức giảm ticket mà không nói đếm theo nhãn, so khoảng nào.

#### Nhớ nhanh

- OIDC Authorization Code + PKCE; BFF giữ token ở server.
- Cookie `HttpOnly`, `SameSite=Lax`, cộng antiforgery; data protection keys dùng chung giữa các pod.
- Silent SSO bằng chuyển hướng cả trang, không dùng iframe; chống vòng lặp.
- Đăng xuất toàn bộ: xóa phiên, thu hồi token, báo các app và các tab.

#### Bài tập

1. Viết các bước kiểm một JWT ở API.
   **Đáp án:** Chọn khóa theo `kid` từ JWKS đã cache; cố định thuật toán chấp nhận (chặn `alg: none`, chặn nhầm RS256 thành HS256); kiểm chữ ký; kiểm `iss`, `aud`, `exp`, `nbf` với độ lệch giờ nhỏ.
2. Vì sao data protection keys phải dùng chung giữa các pod của BFF?
   **Đáp án:** Pod A mã hóa cookie thì pod B cũng phải giải mã được. Nếu mỗi pod một bộ khóa, người dùng bị đăng xuất mỗi khi request rơi vào pod khác.
