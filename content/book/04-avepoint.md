# Phần III. Kinh nghiệm ở AvePoint

Phần này chuẩn bị cho các câu hỏi về giai đoạn bạn làm Team Lead ở AvePoint Vietnam (MaivenPoint EdTech), từ 01/2023 tới 03/2026. Có hai dự án: Examena, một nền tảng thi trực tuyến mà giám thị xem camera thí sinh trực tiếp, và IAS 2.0, dự án chuyển đổi kiến trúc một nền tảng giáo dục cũ của khách hàng.

Khác với giai đoạn ở VTC, ở đây bạn không có dashboard, báo cáo hay commit để mở ra cho người phỏng vấn xem, nên mọi thứ dựa vào lời kể. Vì vậy mỗi bài có sẵn câu chuyện cụ thể: vai trò của bạn, ranh giới với DevOps và đồng nghiệp, một hai con số tròn kèm cách đo. Một vài việc thật sự chưa triển khai (load test làm cổng chặn release, xử lý một đợt pentest, transactional outbox và saga ở IAS 2.0) thì nói gọn "phần này tôi chưa làm", rồi chuyển ngay sang thiết kế và cách đo. Phần "Cách show off" của từng bài ghi rõ câu nào thuộc loại nào.

## Chương 7. Examena: nền tảng thi có giám sát video

Examena cho thí sinh làm bài trên trình duyệt trong khi camera được truyền tới giám thị, và AI hỗ trợ gắn cờ những hành vi nghi gian lận. Đây là dự án bạn ở vai trò dẫn team, nên người phỏng vấn sẽ hỏi cả hai chiều: kỹ thuật (truyền video thời gian thực, load test, deploy, bảo mật) và dẫn dắt (chia việc, phối hợp, tuyển người, vận hành ngày thi).

Xương sống câu chuyện: dẫn team tám người đưa sản phẩm tới kỳ thi thật với hơn ba nghìn thí sinh làm bài cùng lúc, chọn kiến trúc SFU trên mediasoup cho video, đưa AI chống gian lận ra khỏi đường đi của video, dựng luồng release GitOps trên Azure AKS, tuyển và kèm người, trực khoảng mười kỳ thi lớn trong năm đầu. Hai chủ đề nói ở mức thiết kế: load test làm cổng chặn release (chỉ có một lần diễn tập tải lớn trước kỳ thi đầu) và xử lý một đợt pentest.

### Bài 7.1. Dẫn dắt team từ bản thiết kế tới kỳ thi thật

#### Kiến thức

##### Người phỏng vấn đào gì khi nghe "Team Lead"
Họ không kiểm tra bạn có thuộc Scrum Guide không. Họ muốn biết bạn đã ra những quyết định mà người khác không ra thay được, và bạn xử lý ra sao khi mọi thứ không theo kế hoạch. Thường họ đào theo bốn hướng: quyết định kiến trúc, cách chia việc, cách phối hợp với các bên, và một lần trễ hạn hoặc release có vấn đề. Mỗi hướng cần ít nhất một ví dụ của chính bạn, kể bằng "tôi", không phải "chúng tôi".

##### Quyết định kiến trúc luôn đi kèm cái giá
Một quyết định chỉ có sức nặng khi bạn nói được mình đã chấp nhận mất gì. Khung kể: vấn đề → các phương án → chọn gì → đánh đổi. Ba quyết định là xương sống câu chuyện Examena (mỗi cái có bài riêng trong chương này):

| Quyết định | Vấn đề cần giải | Cái giá chấp nhận |
|---|---|---|
| SFU thay cho mesh | Với mesh, máy thí sinh phải mã hóa và gửi một luồng video cho mỗi người xem | Team phải tự vận hành media server, tốn băng thông phía server |
| AI nằm ngoài đường đi của video | Model chạy chậm không được làm giật video của giám thị | Cờ gian lận có thể đến trễ khi model quá tải, luôn cần người duyệt |
| GitOps cho deploy | Deploy bằng tay khó lặp lại, khó rollback | Thêm một repo cấu hình và một công cụ (Argo CD) phải vận hành |

##### Chia việc theo ownership
Chia theo thành phần có người chịu trách nhiệm rõ: signaling, media server, API thi, frontend, AI, hạ tầng. Việc rủi ro cao giao cho người có kinh nghiệm, kèm một người học cùng để không phụ thuộc vào một người duy nhất (bus factor). Mỗi thành phần có một người review chính và một người dự phòng. Phần lead phải tự giữ là "khoảng giữa các ô": giao diện giữa signaling và media server, hợp đồng API giữa frontend và backend, vì đó là chỗ không ai tự nhận.

##### Scrum theo sách và theo thực tế
Theo sách: sprint 1–2 tuần, bốn sự kiện planning, daily, review, retro; backlog do product owner sắp ưu tiên; definition of done rõ ràng. Người phỏng vấn senior thích nghe chỗ team bạn làm khác sách và vì sao, ví dụ sprint bị cắt ngang bởi lịch thi của khách hàng.

##### Khi bị trễ hạn
Khung tốt: phát hiện sớm qua daily hoặc burndown → cùng product cắt phạm vi, giữ luồng thi chính → báo khách hàng sớm kèm mốc mới → retro sửa cách ước lượng. Người nghe chấm việc bạn báo tin xấu sớm hay muộn, và cắt phạm vi hay bắt team làm thêm giờ.

#### Cách show off
Mạch kể: một câu bối cảnh → vai trò của bạn → một quyết định kèm cái giá → một tình huống khó → kết quả → bài học. Mỗi bước một chi tiết cụ thể, kể bằng "tôi".

> **Ví dụ:** "Ở AvePoint tôi dẫn một team tám người làm Examena, nền tảng thi trực tuyến mà giám thị xem camera thí sinh trực tiếp. Tôi chịu trách nhiệm thiết kế hệ thống, chia việc, review code và release, đi từ bản thiết kế tới kỳ thi thật đầu tiên có hơn ba nghìn thí sinh làm bài cùng lúc. Quyết định tôi nhớ nhất là chọn SFU cho video thay vì để trình duyệt nối trực tiếp với nhau, vì máy thí sinh không gánh nổi việc gửi nhiều luồng; cái giá là team phải tự vận hành media server. Lúc khó nhất là khoảng ba tuần trước kỳ thi thật đầu tiên: buổi diễn tập tải với QA ở quy mô thật cho thấy media server quá tải CPU khi mỗi thí sinh gửi cả camera và màn hình độ phân giải cao. Tôi cắt ba thứ: chỉ ghi hình những đoạn AI gắn cờ thay vì cả phiên, hạ độ phân giải chia sẻ màn hình, dời tính năng phát lại cho giám thị sang bản sau, và báo PM cùng khách hàng ngay trong tuần kèm mốc mới. Kỳ thi diễn ra đúng hạn. Từ đó tôi đưa chạy thử ở quy mô thật vào từ sớm và ước lượng có phần đệm cho phần kỹ thuật chưa chắc."

Điểm ăn điểm:
- Tách rõ "tôi quyết định" và "bạn A làm phần media server". Người nghe cần biết phần nào là của bạn.
- Mỗi quyết định đi kèm cái giá, không chỉ lợi ích.
- Khi kể trễ hạn, nhấn vào việc báo sớm và cắt phạm vi, không phải "cả team cày đêm".
- Nói rõ chỗ quy trình khác sách cho thấy bạn hiểu quy trình để dùng, không phải để trình diễn.

Cơ cấu team: tôi là Team Lead kiêm backend, thêm ba backend, hai frontend, một QA, một DevOps. Quy trình nói đúng cách team chạy: sprint hai tuần với planning, daily 15 phút, demo với PO cuối sprint và retro; không có Scrum Master riêng, tôi kiêm điều phối. Chỗ khác sách: trước mỗi kỳ thi lớn đóng băng tính năng một tuần, chỉ sửa lỗi.

#### Câu hỏi vặn
- **"Trong team tám người đó, phần nào là việc của chính anh?"** Kể các quyết định và việc bạn tự làm: thiết kế tổng thể, các hợp đồng giữa thành phần, review, release. Nêu tên một phần đồng nghiệp làm chính để cho thấy bạn biết giao việc. Tránh trả lời bằng "chúng tôi" từ đầu tới cuối.
- **"Ba nghìn thí sinh đó là số đăng ký hay số đang kết nối cùng lúc, và anh biết bằng cách nào?"** Hai con số này khác nhau rất xa, người hỏi đang kiểm tra bạn có phân biệt không. Nói rõ nguồn: "Đó là đỉnh số phiên đang kết nối trên dashboard media server trong ca thi lớn nhất, tôi đối chiếu với danh sách thí sinh của ca đó, nên là số đồng thời chứ không phải số đăng ký."
- **"Anh đã ra quyết định kiến trúc nào, và mỗi cái trả giá gì?"** SFU thay mesh (đổi lấy việc vận hành media server), AI chạy bất đồng bộ ngoài luồng video (đổi lấy cờ đến trễ và cần người duyệt), GitOps (đổi lấy thêm repo cấu hình và Argo CD). Chọn một cái kể sâu thay vì đọc cả ba.
- **"Anh chia việc cho tám người thế nào?"** Theo thành phần có owner rõ, việc rủi ro cao giao người có kinh nghiệm kèm một người học cùng, mỗi phần có reviewer chính và dự phòng. Cụ thể: "Hai backend làm phiên thi và signaling, tôi kèm bạn mới hơn; một backend làm pipeline AI và hàng đợi; tôi giữ phần tích hợp với hệ thống của khách hàng và báo cáo. Frontend chia màn thí sinh và màn giám thị, QA viết kịch bản test và chạy diễn tập tải, DevOps lo hạ tầng và pipeline. Mỗi phần có owner và một người review dự phòng."
- **"Kể một lần delivery bị trễ và anh xử lý thế nào?"** Khoảng ba tuần trước kỳ thi đầu, diễn tập tải cho thấy media server quá tải CPU. Tôi cắt ghi hình cả phiên xuống chỉ ghi đoạn bị gắn cờ, hạ độ phân giải màn hình, dời phát lại cho giám thị sang bản sau, báo PM và khách hàng trong tuần kèm mốc mới. Kỳ thi đúng hạn; retro sửa cách ước lượng: có phần đệm cho phần kỹ thuật chưa chắc.
- **"Có PR nào anh đã chặn không, vì sao?"** PR tạm dừng/tiếp tục phiên thi cập nhật trạng thái kiểu đọc rồi ghi đè: hai giám thị bấm cùng lúc thì trạng thái sai. Tôi yêu cầu cập nhật có điều kiện theo version (optimistic concurrency) và thêm test chạy song song, ngồi cùng bạn sửa trong buổi chiều, merge sau một ngày, lỗi không lên production.
- **"Có lần nào anh phải chia lại việc giữa sprint không?"** Bạn phụ trách signaling kẹt ở phần reconnect. Tôi chuyển reconnect cho một người có kinh nghiệm WebSocket, bạn kia chuyển sang ghi log phiên, hai người ngồi một buổi để bàn giao; sprint vẫn kịp demo.
- **"Anh phối hợp với PO, QA, DevOps thế nào?"** PO chốt phạm vi ở planning; QA tham gia từ lúc viết tiêu chí chấp nhận và test trên staging; release và rollback đi qua Git với Argo CD nên QA và DevOps nhìn cùng một nguồn; trước kỳ thi lớn họp go/no-go với cả ba bên.

#### Bẫy cần tránh
- Kể "chúng tôi" suốt câu chuyện. Thay bằng "tôi quyết định… vì…", "bạn X làm…".
- Kể chuyện trễ hạn mà không nói cắt cái gì và báo ai lúc nào.
- Lấy những việc chưa làm (load test làm cổng chặn release, pentest) làm ví dụ cho vai trò lead.
- Đọc định nghĩa Scrum thay vì nói team bạn thật sự làm thế nào.

#### Nhớ nhanh
- Bốn hướng bị đào: kiến trúc, chia việc, phối hợp, một lần trễ hạn. Mỗi hướng một ví dụ thật.
- Quyết định nào cũng phải có cái giá đi kèm.
- Tám người: lead + 3 backend, 2 frontend, 1 QA, 1 DevOps; sprint hai tuần, không có Scrum Master riêng.
- Hơn ba nghìn là đỉnh phiên đang kết nối trên dashboard media server, không phải số đăng ký.
- Lúc khó nhất: diễn tập tải ba tuần trước kỳ thi đầu, cắt phạm vi, báo sớm, thi đúng hạn.

#### Bài tập
1. Viết ra bốn ví dụ thật: một quyết định thiết kế, một lần chia lại việc, một PR đã chặn, một lần release có vấn đề. Mỗi ví dụ không quá năm câu.
   **Đáp án:** Mỗi ví dụ cần đủ bối cảnh, việc bạn làm (không phải "chúng tôi"), kết quả và điều rút ra. Bộ bốn ví dụ: chọn SFU thay mesh; chuyển phần reconnect cho người có kinh nghiệm WebSocket giữa sprint; chặn PR tạm dừng phiên thi vì đọc rồi ghi đè; cắt phạm vi sau buổi diễn tập tải ba tuần trước kỳ thi đầu.
2. Viết câu trả lời 45 giây cho "Kể về vai trò lead của anh ở Examena".
   **Đáp án:** Team tám người, kỳ thi đầu với hơn ba nghìn thí sinh cùng lúc, một quyết định kèm cái giá (SFU thay mesh, đổi lấy việc vận hành media server), lúc khó nhất ba tuần trước kỳ thi đầu và cách cắt phạm vi. Tối đa hai con số; số worker, độ trễ và tần suất deploy để dành cho câu hỏi đào sâu.

### Bài 7.2. Truyền video giám sát: vì sao chọn SFU thay cho mesh

#### Kiến thức

##### Bài toán: một thí sinh, nhiều người xem
Giám thị cần xem camera thí sinh gần như tức thời. Một thí sinh có thể được giám thị phòng xem, giám sát cấp cao xem, hệ thống ghi hình và AI cùng "xem". Câu hỏi kiến trúc là: ai chịu chi phí nhân bản luồng video đó?

##### Ba mô hình
- **Mesh (peer-to-peer):** mỗi trình duyệt nối thẳng với từng trình duyệt khác. Thí sinh có N người xem thì phải mã hóa và gửi N luồng. Không cần media server, nhưng CPU và băng thông upload của máy thí sinh tăng theo số người xem, và không có điểm nào ở giữa để ghi hình hay chạy AI.
- **MCU (Multipoint Control Unit):** server giải mã mọi luồng, ghép thành một hình rồi mã hóa lại. Client rất nhẹ, nhưng server tốn CPU khổng lồ và ai cũng nhận cùng một bố cục.
- **SFU (Selective Forwarding Unit):** server không giải mã, chỉ chuyển tiếp gói RTP đã mã hóa tới đúng người cần nhận. Thí sinh gửi đúng một luồng; server tốn băng thông nhưng rất ít CPU so với MCU.

Với giám sát thi, lợi ích của SFU không chỉ là bớt upload cho thí sinh. Vì server nằm giữa, nó là chỗ tự nhiên để ghi hình, lấy mẫu khung hình cho AI, chọn chất lượng phù hợp cho từng giám thị và gom việc vượt NAT về một nơi.

##### mediasoup chạy thế nào
mediasoup là thư viện Node.js điều khiển các process C++. Phần signaling (trao đổi tham số kết nối giữa client và server) do ứng dụng tự làm, thường qua WebSocket.

- **Worker:** một process C++ đơn luồng, thường tạo bằng số CPU core. Worker có thể chết, nên phải nghe sự kiện `died` để báo động và tạo lại.
- **Router:** nằm trong một worker, tương đương một "phòng". Người gửi và người nhận chỉ gặp nhau trong cùng router.
- **Transport:** đường đi của media. `WebRtcTransport` cho trình duyệt; `PlainTransport` cho RTP thường, dùng để đẩy sang FFmpeg ghi hình; `PipeTransport` nối hai router.
- **Producer / Consumer:** thí sinh tạo producer (camera, micro); mỗi người xem một luồng là một consumer.
- **Phòng lớn hơn sức một worker:** `router.pipeToRouter({ producerId, router: otherRouter })` nối luồng sang router ở worker khác, người xem bên đó consume bình thường.

```javascript
const router = await workers[roomIndex % workers.length].createRouter({ mediaCodecs });

if (router.canConsume({ producerId, rtpCapabilities })) {
  const consumer = await recvTransport.consume({ producerId, rtpCapabilities, paused: true });
  // gửi consumer.rtpParameters cho client; client gắn track xong mới resume
  await consumer.resume();
  // giám thị xem lưới nhiều ô thì nhận lớp chất lượng thấp
  await consumer.setPreferredLayers({ spatialLayer: 0, temporalLayer: 2 });
}
```

Tạo consumer ở trạng thái `paused` rồi mới `resume` là khuyến nghị chuẩn, để client kịp gắn track và không mất keyframe đầu.

##### Simulcast và vượt NAT
- **Simulcast:** thí sinh gửi cùng lúc 2–3 bản ở độ phân giải khác nhau; SFU chọn bản phù hợp cho từng người xem. Giám thị xem lưới 25 ô nhận bản thấp, phóng to một thí sinh thì đổi lên bản cao.
- **NAT:** mediasoup chỉ chờ client kết nối tới (ICE-lite). Mạng chặn UDP thì cần TURN server, tốt nhất có TURN qua TLS cổng 443. Media luôn mã hóa bằng DTLS-SRTP.

##### Ước lượng tài nguyên bằng cách đếm consumer
Tài nguyên SFU tỉ lệ với số consumer, không phải số thí sinh. Tài liệu mediasoup gợi ý một worker chịu cỡ vài trăm consumer (thường nói khoảng 500), tùy CPU. Với giả định nói thành lời: 3.000 thí sinh, mỗi người một luồng video, một giám thị xem.

| Đại lượng | Cách tính | Kết quả |
|---|---|---|
| Consumer video | 3.000 × 1 người xem | 3.000 |
| Worker tối thiểu | 3.000 / 500 | 6, chưa tính dư phòng |
| Thêm audio | gấp đôi consumer | khoảng 12 worker |
| Băng thông vào SFU | 3.000 × 300–500 kbps | khoảng 1–1,5 Gbps |

Mỗi thứ thêm vào phía server (ghi hình, AI lấy mẫu) là thêm một consumer cho mỗi thí sinh. Để một worker chết không làm sập cả phòng, cộng dư phòng 30–50%.

#### Cách show off
Vai trò của bạn: viết bản so sánh mesh / SFU / MCU, chọn mediasoup, thiết kế signaling (phòng thi, ai được nhận luồng nào) và code bản đầu của server signaling; frontend tích hợp phía client, DevOps triển khai media server. Cấu hình kể bằng một con số kèm cách tính: mỗi máy chạy số worker bằng số lõi, cụm bốn máy tám lõi cho ca khoảng ba nghìn thí sinh.

> **Ví dụ:** "Bài toán của Examena là giám thị phải xem camera thí sinh gần như tức thời, và mỗi thí sinh có thể có vài người cùng xem. Nếu để trình duyệt nối trực tiếp với nhau, máy thí sinh phải gửi một luồng cho mỗi người xem, mà nhiều em dùng laptop yếu và mạng nhà. Tôi viết bản so sánh ba phương án và chọn SFU trên mediasoup: thí sinh chỉ gửi một luồng, server lo chuyển tiếp, và vì server nằm giữa nên ghi hình và lấy mẫu cho AI cũng làm ở đó. Cái giá là phải tự vận hành media server và tính băng thông phía server. Mỗi máy media server chạy số worker bằng số lõi, tám worker trên máy tám lõi; ca khoảng ba nghìn thí sinh chạy trên cụm bốn máy. Con số đó tôi tính từ consumer: lưới độ phân giải thấp cho giám thị, bản ghi, luồng cho AI, chia cho khoảng 500 consumer mỗi worker theo tài liệu mediasoup, rồi cộng dư phòng để một worker chết không sập phòng thi."

Điểm ăn điểm:
- Nói được vì sao SFU hợp riêng với giám sát thi (ghi hình, AI, chọn chất lượng), không chỉ "đỡ băng thông".
- Ước lượng theo consumer, nói rõ giả định.
- Nghĩ tới worker chết giữa ca thi và dư phòng.
- Con số cấu hình luôn đi kèm cách tính ra nó.

#### Câu hỏi vặn
- **"SFU, MCU, mesh khác nhau thế nào?"** Mesh: mỗi người gửi một luồng cho từng người xem, không scale. MCU: server giải mã và ghép hình, tốn CPU, mất linh hoạt. SFU: server chỉ chuyển tiếp gói đã mã hóa, mỗi thí sinh gửi một luồng.
- **"Nếu mỗi thí sinh chỉ có một giám thị xem thì mesh cũng chỉ gửi một luồng, sao vẫn cần SFU?"** Vì phía giám thị xem 20–30 người: với mesh, trình duyệt giám thị giữ 20–30 kết nối và không chọn được bản chất lượng thấp. Còn ghi hình, AI phía server, giám sát cấp cao và vượt NAT tập trung đều cần một điểm ở giữa.
- **"Anh cấu hình bao nhiêu worker?"** "Mỗi máy số worker bằng số lõi, tám worker trên máy tám lõi, cụm bốn máy cho ca khoảng ba nghìn thí sinh. Mỗi thí sinh có khoảng ba consumer: giám thị xem camera, giám thị xem màn hình, AI đọc camera; bản ghi chỉ lấy đoạn bị gắn cờ. Ba nghìn thí sinh là khoảng chín nghìn consumer, tức mười tám worker ở mức 500 consumer mỗi worker; ba mươi hai worker là còn dư nhiều cho worker chết và lúc giám thị mở xem độ phân giải cao."
- **"Phần nào của SFU là việc của anh?"** Bản so sánh mesh / SFU / MCU, quyết định chọn mediasoup, thiết kế signaling (phòng thi, ai được nhận luồng nào) và bản đầu của server signaling. Frontend tích hợp phía client, DevOps triển khai media server.
- **"Thí sinh rớt mạng giữa giờ thì sao?"** Client phát hiện qua trạng thái kết nối, thử ICE restart hoặc tạo lại transport và producer. Giám thị thấy trạng thái mất kết nối. Mỗi lần rớt được ghi log gắn với phiên thi để hội đồng xem xét gia hạn.
- **"Ghi hình làm thế nào?"** Tạo `PlainTransport`, consume luồng của thí sinh lên đó, đẩy RTP sang FFmpeg hoặc GStreamer để ghi file. Mỗi bản ghi là thêm một consumer cho mỗi thí sinh, phải tính vào tài nguyên.
- **"Một phòng thi lớn hơn sức một worker thì làm gì?"** Dùng `pipeToRouter` nối luồng sang router ở worker khác, người xem bên đó consume bình thường. Khác máy thì dựng `PipeTransport` giữa hai host.

#### Bẫy cần tránh
- Nói số worker mà không nói cách tính ra nó.
- Nói "SFU giải mã video".
- Quên rằng mỗi người xem, mỗi bản ghi, mỗi luồng cho AI đều là một consumer riêng.
- Lẫn worker (process) với router (phòng).

#### Nhớ nhanh
- SFU chỉ chuyển tiếp, thí sinh gửi một luồng; server ở giữa nên ghi hình và AI làm được ở đó.
- Worker là process một core, router là phòng, producer gửi, consumer nhận.
- Phòng vượt một worker thì dùng `pipeToRouter`; lưới nhiều ô dùng simulcast bản thấp.
- Số worker bằng số lõi; bốn máy tám lõi cho ca ba nghìn thí sinh, tính từ consumer cộng dư phòng.

#### Bài tập
1. Ước lượng số worker và băng thông vào SFU cho 5.000 thí sinh, mỗi thí sinh gửi video và audio, mỗi luồng có một giám thị xem và một bản ghi. Giả định 500 consumer mỗi worker, video 400 kbps, audio 32 kbps.
   **Đáp án:** Consumer = 5.000 × 2 luồng × 2 người nhận = 20.000, tức 40 worker, cộng dư phòng thành khoảng 52–60. Băng thông vào SFU = 5.000 × 432 kbps, khoảng 2,2 Gbps.

### Bài 7.3. Đưa AI chống gian lận ra khỏi đường đi của video

#### Kiến thức

##### "Ngoài luồng video" nghĩa là gì
Đường đi của video là thí sinh → SFU → giám thị. Nếu chèn model vào giữa (giải mã, chạy model, mã hóa lại rồi mới chuyển tiếp), mỗi lần model chậm là video giật. Thiết kế đúng: video đi thẳng; AI nhận một **bản sao** khung hình, chạy bất đồng bộ, và kết quả là một **sự kiện** (cờ nghi vấn) đi qua hàng đợi tới người duyệt. Model chậm thì cờ đến trễ vài giây, video không bị ảnh hưởng.

Đây là một nguyên tắc chung, không riêng video: việc phụ, nặng, có thể chậm thì đưa ra khỏi đường đi chính, nối bằng hàng đợi.

##### Chạy model ở đâu: client, server hay cả hai
- **Client:** model nhẹ phát hiện khuôn mặt (MediaPipe, TensorFlow.js) chạy trong Web Worker hoặc trên GPU qua WebGL, ảnh đầu vào thu nhỏ, bỏ khung khi CPU bận. Client chỉ gửi sự kiện (không thấy mặt, nhiều khuôn mặt, rời tab), không gửi thêm video. Rẻ cho server, nhưng phụ thuộc máy thí sinh và có thể bị can thiệp.
- **Server:** lấy khung từ SFU hoặc ảnh client gửi lên, chạy model nặng hơn để xác minh. Tin cậy hơn nhưng tốn GPU.
- **Lai:** client gắn cờ sơ bộ cho mọi thí sinh, server chỉ xác minh những thí sinh đang bị cờ. Đây là cách cân bằng chi phí và độ tin cậy hay được chọn.

Dù chọn cách nào, AI chỉ **gợi ý**. Mọi cờ vào hàng đợi duyệt và nhật ký kiểm tra; không tự động xử lý thí sinh vì báo động giả luôn có.

##### Tính tải trước khi chọn kiến trúc
Lấy mẫu 2 khung mỗi giây cho mọi thí sinh: 3.000 × 2 = 6.000 lần chạy model mỗi giây phía server. Nếu chỉ xác minh phía server cho khoảng 10% thí sinh đang bị cờ: 300 × 2 = 600 lần mỗi giây, ít hơn mười lần. Phép tính này dùng để chọn kiến trúc, không phải số đo.

##### Hàng đợi phải có giới hạn
Khung hình cách đây mười giây không còn giá trị. Hàng đợi giữa bộ lấy mẫu và worker chạy model phải giới hạn kích thước và được phép bỏ khung cũ khi quá tải.

```csharp
var frames = Channel.CreateBounded<FrameSample>(new BoundedChannelOptions(1_000)
{
    FullMode = BoundedChannelFullMode.DropOldest // quá tải thì bỏ khung cũ
});

await foreach (var f in frames.Reader.ReadAllAsync(ct))
{
    var result = await detector.DetectAsync(f.Image, ct);
    if (result.IsSuspicious)
        await bus.Publish(new CheatingFlagRaised(f.SessionId, result.Kind, f.CapturedAt), ct);
}
```

Theo dõi **tuổi khung** (`now - CapturedAt`): tuổi tăng dần nghĩa là model không theo kịp, cần thêm worker hoặc giảm tần suất lấy mẫu.

##### Hai loại độ trễ độc lập
Độ trễ video giám thị thấy đo bằng WebRTC `getStats()` (round-trip time, độ trễ jitter buffer phía nhận). Độ trễ cờ là thời điểm cờ tới người duyệt trừ thời điểm chụp khung. Hai số này không phụ thuộc nhau, và đó chính là ý nghĩa của "ngoài luồng video".

> **Ghi nhớ:** Quyền riêng tư là một phần của thiết kế: thí sinh phải được thông báo và đồng ý, ảnh có thời hạn lưu, và chỉ người có quyền mới xem được bản ghi.

#### Cách show off
Trọng tâm: nguyên tắc AI không nằm trên đường đi của video, và một con số độ trễ kèm cách đo. Phân vai: bạn đặt nguyên tắc và kiến trúc (bản sao khung hình, hàng đợi có giới hạn, người duyệt), một backend trong team làm chính pipeline AI và hàng đợi. Độ trễ cảnh báo: trung vị khoảng 200–300 ms từ lúc chụp khung tới lúc cờ hiện trên màn giám thị.

> **Ví dụ:** "Examena có AI hỗ trợ phát hiện gian lận, và nguyên tắc chúng tôi giữ là AI không được đứng trên đường đi của video. Video đi thẳng từ thí sinh qua SFU tới giám thị; AI xử lý một bản sao khung hình một cách bất đồng bộ, kết quả là cờ đi qua hàng đợi tới người duyệt. Bình thường cờ hiện trên màn giám thị trong khoảng 200–300 ms, tôi đo bằng timestamp gắn vào khung hình phía client so với thời điểm cảnh báo hiện ở màn giám thị, cộng `getStats()` cho phần video. Nếu model chậm thì cờ đến trễ hơn, còn giám thị vẫn xem mượt. Thiết kế là lai: client chạy model nhẹ để gắn cờ sơ bộ, server chỉ xác minh những thí sinh bị cờ, và hàng đợi có giới hạn để quá tải thì bỏ khung cũ thay vì phình bộ nhớ."

Điểm ăn điểm:
- Tách hai loại độ trễ: video và cờ.
- Tính tải bằng phép nhân đơn giản trước khi chọn kiến trúc.
- Hàng đợi có giới hạn, bỏ khung cũ, đo tuổi khung.
- AI chỉ gợi ý, người quyết định; nhắc quyền riêng tư.

#### Câu hỏi vặn
- **"Model chạy ở client hay server?"** Theo thiết kế tôi chọn: lai. Client chạy model nhẹ cho tín hiệu tức thời, rẻ nhưng có thể bị can thiệp; server xác minh bằng model nặng hơn cho thí sinh bị cờ, tốn GPU nhưng tin được. Cách chia này giữ tải GPU tỷ lệ với số thí sinh bị cờ, không phải tổng số thí sinh.
- **"Lấy mẫu bao nhiêu khung mỗi giây, vì sao?"** Một đến hai khung mỗi giây đủ cho hành vi kéo dài vài giây như rời mắt hay có người thứ hai. Tải bằng số thí sinh nhân tần suất, nên chỉ lấy mẫu dày cho thí sinh đang bị cờ.
- **"Làm sao để AI không làm giật video?"** AI chỉ nhận bản sao, chạy bất đồng bộ. Ở client thì chạy trong Web Worker hoặc WebGL, thu nhỏ ảnh, bỏ khung khi CPU bận, không tranh với bộ mã hóa video.
- **"GPU không theo kịp thì sao?"** Hàng đợi có giới hạn bỏ khung cũ; cờ đến trễ hơn nhưng video không ảnh hưởng. Cảnh báo khi tuổi khung vượt ngưỡng và scale thêm worker.
- **"Xử lý báo động giả thế nào?"** Cờ chỉ là gợi ý; người duyệt xem đoạn video quanh thời điểm cờ rồi mới quyết. Theo dõi tỷ lệ cờ bị bác để chỉnh ngưỡng model.
- **"Độ trễ dưới 300 ms trên CV đo bằng gì?"** "Gắn timestamp vào khung hình ở phía client, so với thời điểm cảnh báo hiện trên màn giám thị; phần video thì lấy thêm từ `getStats()`. Trung vị khoảng 200–300 ms. Hai số này tách riêng: độ trễ video và độ trễ cờ."

#### Bẫy cần tránh
- Nói "dưới 300 ms" mà không nói đo từ đâu tới đâu, bằng gì.
- Cho AI tự động đánh trượt thí sinh.
- Hàng đợi không giới hạn: GPU chậm thì bộ nhớ phình và cờ trễ hàng phút.
- Quên quyền riêng tư và thời hạn lưu ảnh.

#### Nhớ nhanh
- Video đi thẳng; AI xử lý bản sao, kết quả là sự kiện qua hàng đợi.
- Lai: client rẻ, server tin được; luôn có người duyệt.
- Hàng đợi có giới hạn, bỏ khung cũ, theo dõi tuổi khung.
- Độ trễ video và độ trễ cờ là hai số độc lập; cờ trung vị 200–300 ms, đo bằng timestamp khung hình tới màn giám thị.

#### Bài tập
1. Tính số lần chạy model mỗi giây phía server cho 3.000 thí sinh nếu: (a) lấy 1 khung mỗi giây cho mọi người; (b) chỉ lấy 2 khung mỗi giây cho 15% thí sinh bị cờ.
   **Đáp án:** (a) 3.000 lần mỗi giây; (b) 450 × 2 = 900 lần mỗi giây.
2. Đề xuất ba chỉ số để theo dõi hệ AI chống gian lận và khi nào cảnh báo.
   **Đáp án:** Tuổi khung (ví dụ quá 10 giây thì cảnh báo), độ dài hàng đợi duyệt, tỷ lệ cờ bị người duyệt bác (tăng đột biến là model hoặc ngưỡng có vấn đề).

### Bài 7.4. Load test cho hệ thống có giờ cao điểm cố định

#### Kiến thức

##### Vì sao kỳ thi khó load test
Hệ thống thi có tải rất lệch: phần lớn thời gian vắng, rồi đúng giờ bắt đầu hàng nghìn người bấm "vào thi" trong vài phút. Hiện tượng này gọi là "đàn bò" (thundering herd). Một bài load test tăng tải từ từ sẽ cho kết quả đẹp mà vô nghĩa; phải dựng đúng cái đỉnh đó.

##### Mô hình tải đóng và mở
- **Đóng (closed):** số người dùng ảo (VU) cố định, mỗi VU đợi phản hồi xong mới làm tiếp. Server chậm thì tải tự giảm, che mất vấn đề. Trong k6: `constant-vus`, `ramping-vus`.
- **Mở (open):** giữ số lượt bắt đầu mỗi giây cố định, bất kể server nhanh hay chậm, giống người thật bấm vào thi đúng 8:00. Trong k6: `constant-arrival-rate`, `ramping-arrival-rate`. Nếu k6 thiếu VU để giữ tốc độ, metric `dropped_iterations` sẽ tăng.

Bài toán giờ vào thi dùng mô hình mở, cụ thể là `ramping-arrival-rate`.

```javascript
export const options = {
  scenarios: {
    exam_start: {
      executor: 'ramping-arrival-rate',
      startRate: 10, timeUnit: '1s',
      preAllocatedVUs: 500, maxVUs: 5000,
      stages: [
        { target: 200, duration: '2m' }, // dồn vào đầu giờ
        { target: 200, duration: '5m' },
        { target: 0, duration: '1m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [{ threshold: 'p(95)<500', abortOnFail: true }],
    dropped_iterations: ['count<1'],
  },
};
```

Mỗi lượt gọi API bắt đầu thi rồi mở WebSocket signaling. Threshold không đạt thì k6 thoát với mã lỗi khác 0, nên pipeline CI tự đánh fail. Đó là cách biến load test thành **cổng chặn release**.

##### Giới hạn của k6 với video
k6 test được HTTP và WebSocket signaling, nhưng không mã hóa và gửi được video WebRTC. Muốn test SFU phải dùng trình duyệt headless làm bot (Playwright hoặc Puppeteer với cờ Chrome `--use-fake-device-for-media-stream`, có thể phát file video giả) hoặc dịch vụ chuyên dụng. Mỗi trình duyệt tốn nhiều CPU, nên thường test media ở quy mô nhỏ rồi ngoại suy theo số consumer mỗi worker.

##### Để kết quả đáng tin
- Staging giống production về số replica, giới hạn CPU/RAM, cấu hình database và lượng dữ liệu. Khác chỗ nào phải nói ra.
- Máy tạo tải đủ mạnh; một máy yếu sẽ nghẽn trước server.
- Lưu kết quả mỗi lần chạy và so với lần trước: p95 tăng quá ngưỡng (ví dụ 20%) là năng lực bị suy giảm, dù chưa vượt threshold tuyệt đối.
- Dữ liệu test tách khỏi dữ liệu thật và được dọn sau mỗi lần chạy.

#### Cách show off
Ở Examena, load test như một cổng chặn release **chưa được triển khai**. Cái có thể kể là một lần diễn tập tải nội bộ ở quy mô thật cùng QA, khoảng ba tuần trước kỳ thi đầu, làm lộ việc media server quá tải CPU (chuyện ở Bài 7.1). Câu trả lời: một câu nhận, nhắc lần diễn tập đó, rồi chuyển ngay sang thiết kế cổng chặn và cách đo.

> **Ví dụ:** "Ở Examena tôi chưa đưa load test vào pipeline làm cổng chặn release. Lần gần nhất là buổi diễn tập tải với QA ở quy mô thật ba tuần trước kỳ thi đầu, và chính buổi đó cho thấy media server quá tải CPU, nên tôi biết giá trị của việc chạy thử sớm. Nếu đưa vào pipeline, điểm tôi chú ý đầu tiên là dựng đúng đỉnh đầu giờ: dùng k6 với mô hình mở, giữ số lượt vào thi mỗi giây cố định, vì mô hình số người dùng cố định sẽ tự giảm tải khi server chậm và cho kết quả đẹp giả. Tôi đặt threshold cho p95 và tỷ lệ lỗi để pipeline tự fail. Phần video thì k6 không gửi được, nên tôi test riêng bằng trình duyệt headless ở quy mô nhỏ rồi ngoại suy theo số consumer."

Điểm ăn điểm:
- Phân biệt mô hình đóng và mở, biết vì sao mô hình đóng che lỗi.
- Biết giới hạn của công cụ (k6 không test được media).
- Nghi ngờ chính kết quả của mình: staging có giống production không, máy tạo tải có nghẽn không.

#### Câu hỏi vặn
- **"Anh đã load test hệ thống này chưa?"** "Có một buổi diễn tập tải ở quy mô thật trước kỳ thi đầu, làm lộ việc media server quá tải CPU khi thí sinh gửi cả camera và màn hình độ phân giải cao; nhưng chưa đưa load test vào pipeline làm cổng chặn release." Sau đó chuyển sang cách bạn sẽ làm cổng chặn.
- **"Chọn executor nào trong k6 để giả lập giờ vào thi?"** `ramping-arrival-rate`: giữ tốc độ bắt đầu mỗi giây bất kể server chậm, đúng với người thật bấm cùng lúc. Theo dõi `dropped_iterations` để biết k6 có đủ VU không.
- **"Vì sao 5.000 VU không tương đương 5.000 thí sinh vào cùng lúc?"** VU đợi phản hồi mới gửi tiếp; server chậm thì số request mỗi giây giảm, tải thật bị đánh giá thấp. Mô hình mở giữ tốc độ đến không đổi.
- **"Làm sao để load test thành cổng chặn release?"** Threshold làm k6 thoát mã lỗi khi không đạt; chạy trong pipeline trên staging; so với lần trước để bắt suy giảm năng lực.
- **"k6 có test được WebRTC không?"** Không gửi được media, chỉ test HTTP và WebSocket signaling. Media test bằng trình duyệt headless với camera giả hoặc dịch vụ chuyên dụng.
- **"Kết quả trên staging có tin được cho production không?"** Chỉ khi staging giống production về replica, giới hạn tài nguyên, cấu hình database và lượng dữ liệu. Chỗ nào khác phải nêu ra và ngoại suy thận trọng.

#### Bẫy cần tránh
- Biến một buổi diễn tập tải thành "load test chạy mỗi release".
- Dùng `constant-vus` cho bài toán đỉnh tải.
- Nói k6 test được toàn bộ hệ video.
- Chạy load test từ một máy yếu rồi kết luận server chậm.

#### Nhớ nhanh
- Giờ vào thi là đỉnh nhọn, dùng mô hình mở `ramping-arrival-rate`.
- Threshold cộng mã thoát khác 0 là cổng chặn trong CI.
- k6 không test media WebRTC; dùng trình duyệt headless.
- Ở dự án: một buổi diễn tập tải trước kỳ thi đầu, chưa có cổng chặn release; nhận một câu rồi trình bày thiết kế.

#### Bài tập
1. Viết `options` k6 cho kịch bản: trong 3 phút đầu tăng từ 0 lên 300 lượt vào thi mỗi giây, giữ 5 phút; fail nếu p99 quá 1 giây.
   **Đáp án:** `executor: 'ramping-arrival-rate'`, `startRate: 0`, `timeUnit: '1s'`, `stages: [{ target: 300, duration: '3m' }, { target: 300, duration: '5m' }]`, đủ `preAllocatedVUs`/`maxVUs`; `thresholds: { http_req_duration: ['p(99)<1000'] }`.
2. Một lần chạy cho p95 tăng 35% so với tuần trước nhưng vẫn dưới threshold. Có chặn release không?
   **Đáp án:** Nên chặn hoặc ít nhất điều tra trước khi release: đó là dấu hiệu suy giảm năng lực. Kiểm tra thay đổi trong bản release (query mới, thiếu index, cấu hình replica), xác nhận môi trường test không đổi, rồi mới quyết.

### Bài 7.5. GitOps: từ commit tới cluster

#### Kiến thức

##### Vấn đề GitOps giải quyết
Cách deploy truyền thống là pipeline CI cầm quyền vào cluster và chạy `kubectl apply` hoặc `helm upgrade`. Nó chạy được, nhưng có ba điểm yếu: CI giữ quyền rất lớn với production, trạng thái thật của cluster có thể lệch khỏi những gì ghi trong repo (ai đó sửa tay), và rollback phụ thuộc vào việc nhớ bản trước là gì.

GitOps đảo ngược luồng: trạng thái mong muốn của cluster nằm trong Git; một agent chạy **trong** cluster (Argo CD) liên tục so cluster với Git và kéo về cho khớp. CI không cần quyền vào cluster, mọi thay đổi có lịch sử và người duyệt, rollback là quay lại một commit.

##### Luồng chuẩn
1. Dev merge vào nhánh chính của repo ứng dụng.
2. GitLab CI chạy test, build image, đẩy lên registry với tag là commit SHA (không dùng `latest`).
3. Job cuối cập nhật `image.tag` trong file values ở repo cấu hình; với production thì mở merge request để người duyệt.
4. Argo CD thấy repo cấu hình đổi, render Helm chart và sync vào cluster.

```yaml
# .gitlab-ci.yml (rút gọn)
build:
  stage: build
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

bump-staging:
  stage: deploy
  script:
    - git clone https://gitlab-ci-token:${DEPLOY_TOKEN}@gitlab.example.com/platform/deploy-config.git
    - cd deploy-config
    - TAG=$CI_COMMIT_SHORT_SHA yq -i '.image.tag = strenv(TAG)' charts/exam-api/values-staging.yaml
    - git commit -am "exam-api staging $CI_COMMIT_SHORT_SHA" && git push
```

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: exam-api-staging, namespace: argocd }
spec:
  source:
    repoURL: https://gitlab.example.com/platform/deploy-config.git
    targetRevision: main
    path: charts/exam-api
    helm: { valueFiles: [values-staging.yaml] }
  destination: { server: https://kubernetes.default.svc, namespace: exam }
  syncPolicy:
    automated:
      prune: true     # xóa resource không còn trong Git
      selfHeal: true  # ai sửa tay trên cluster sẽ bị kéo về theo Git
```

Argo CD render chart bằng `helm template` rồi tự apply, nên `helm list` không thấy release; Helm hook được ánh xạ sang hook của Argo CD.

##### Rollback
Cách chuẩn: `git revert` commit đổi tag ở repo cấu hình, Argo CD sync lại bản cũ, lịch sử ghi rõ ai rollback và lúc nào. Argo CD có lệnh rollback theo lịch sử sync, nhưng **không dùng được khi bật auto-sync**, vì auto-sync sẽ kéo cluster về theo Git ngay. Với auto-sync, revert Git là đường chính. Sửa tay trên cluster cũng vô ích khi bật `selfHeal`.

##### Terraform cho hạ tầng
Terraform quản lý cluster, mạng, registry, DNS. State phải lưu remote và có khóa, để hai người không apply chồng nhau làm hỏng state: trên Azure là backend `azurerm` (blob có lease làm khóa), trên AWS là S3 kèm cơ chế khóa. State chứa thông tin nhạy cảm nên phải mã hóa và giới hạn quyền. Quy trình: `terraform plan` chạy trong merge request để review, `apply` chỉ chạy từ nhánh chính.

##### Deploy thường xuyên mà vẫn an toàn
Thay đổi nhỏ, trunk-based development, feature flag để tách "deploy" khỏi "bật tính năng", rollout dần với readiness probe, và đóng băng deploy quanh ngày thi. Secret không để dạng thô trong repo cấu hình; dùng Sealed Secrets, External Secrets hoặc secret store của cloud.

#### Cách show off
Bối cảnh: Examena chạy trên Azure, cụm AKS; Terraform dựng hạ tầng, GitLab CI build image, Argo CD trên cụm đồng bộ từ repo cấu hình. Ranh giới việc: bạn thiết kế luồng release (dev/staging/prod, promote bằng commit vào repo cấu hình, rollback bằng revert), viết Helm chart cho các service backend và phần build/test của pipeline; DevOps dựng cụm bằng Terraform và cài Argo CD. Một con số: từ vài tuần một đợt deploy lên deploy staging nhiều lần mỗi ngày, production vài lần mỗi tuần.

> **Ví dụ:** "Examena chạy trên AKS của Azure, deploy theo GitOps. Tôi thiết kế luồng release và viết Helm chart cho các service backend: CI trên GitLab build image, gắn tag bằng commit SHA, rồi cập nhật tag đó trong một repo cấu hình riêng; Argo CD trong cluster thấy repo đổi thì tự sync. Promote từ staging lên production là một commit, rollback là revert. DevOps dựng cụm bằng Terraform và cài Argo CD. Lợi ích lớn nhất là CI không cần cầm quyền vào cluster, ai đổi gì lúc nào đều có trong lịch sử, nên team đi từ vài tuần một đợt deploy lên staging nhiều lần mỗi ngày, production vài lần mỗi tuần. Cái giá là thêm một repo và một công cụ phải vận hành, và team phải quen việc không bao giờ sửa tay trên cluster."

Điểm ăn điểm:
- Giải thích "kéo" (pull) khác "đẩy" (push) ở chỗ quyền và độ lệch, không chỉ liệt kê công cụ.
- Biết rollback bằng nút Argo CD bị chặn khi bật auto-sync.
- Nhắc state Terraform có khóa và secret không nằm thô trong Git.

#### Câu hỏi vặn
- **"GitOps khác pipeline deploy thẳng vào cluster ở điểm nào?"** Git là nguồn sự thật; agent trong cluster kéo về và tự sửa lệch; CI không cần quyền vào cluster; rollback là revert commit.
- **"Anh tự dựng chuỗi này hay dùng lại của người khác?"** "Tôi thiết kế luồng release: ba môi trường dev, staging, prod, promote bằng commit vào repo cấu hình, rollback bằng revert; tôi viết Helm chart cho các service backend và phần build/test của pipeline. DevOps dựng cụm AKS bằng Terraform và cài Argo CD." Người hỏi đang tìm ranh giới việc của bạn.
- **"Tần suất deploy thay đổi thế nào?"** Trước đó vài tuần mới có một đợt deploy; sau khi chuyển sang GitOps, staging được deploy nhiều lần mỗi ngày, production vài lần mỗi tuần, trừ tuần đóng băng trước kỳ thi lớn. Đếm từ lịch sử commit vào repo cấu hình của từng môi trường.
- **"Rollback thế nào khi bật auto-sync?"** `git revert` commit cấu hình rồi để Argo CD sync lại. Lệnh rollback của Argo CD bị chặn khi auto-sync bật, còn sửa tay sẽ bị `selfHeal` kéo về.
- **"`selfHeal` và `prune` làm gì, có rủi ro gì?"** `selfHeal` kéo cluster về theo Git khi có người sửa tay; `prune` xóa resource không còn trong Git. Bật `prune` phải cẩn thận với resource chứa dữ liệu, xóa nhầm khỏi Git là mất trên cluster.
- **"Vì sao không dùng tag `latest`?"** Tag không đổi thì Git không đổi, Argo CD không biết có bản mới và không ai biết cluster đang chạy bản nào. Tag theo commit SHA cho phép truy ngược và rollback chính xác.
- **"Terraform state để ở đâu, vì sao cần khóa?"** Backend remote có khóa (blob lease trên Azure, S3 có khóa trên AWS). Khóa ngăn hai lần apply đồng thời làm hỏng state; state có thông tin nhạy cảm nên phải mã hóa và giới hạn quyền.
- **"Deploy thường xuyên mà vẫn an toàn trong mùa thi bằng cách nào?"** Thay đổi nhỏ, feature flag, rollout dần với readiness probe, và đóng băng deploy trước và trong ngày thi.

#### Bẫy cần tránh
- Nói tần suất deploy mà không nói đếm từ đâu (lịch sử commit vào repo cấu hình).
- Nhận cả việc dựng cụm AKS bằng Terraform; phần đó DevOps làm.
- Nói "rollback bằng nút trên Argo CD" trong khi auto-sync đang bật.
- Để secret dạng thô trong repo cấu hình.

#### Nhớ nhanh
- Azure AKS; tôi: luồng release, Helm chart, build/test; DevOps: Terraform, Argo CD. Deploy từ vài tuần một đợt lên production vài lần mỗi tuần.
- Image tag là commit SHA; CI cập nhật values; Argo CD sync.
- Rollback chuẩn là revert Git.
- Terraform state remote, có khóa; plan trong merge request, apply từ nhánh chính.

#### Bài tập
1. Viết `syncPolicy` cho production: tự sync nhưng không tự xóa resource, và tự kéo về khi bị sửa tay.
   **Đáp án:** `automated: { prune: false, selfHeal: true }`.
2. Một bản deploy lỗi lên production lúc 9:00 trong ngày thi, auto-sync đang bật. Liệt kê các bước rollback.
   **Đáp án:** Revert commit đổi `image.tag` trong repo cấu hình theo quy trình merge khẩn, theo dõi Argo CD sync và readiness probe, xác nhận tỷ lệ lỗi trên dashboard giảm, ghi lại cho postmortem. Không sửa tay trên cluster vì `selfHeal` sẽ kéo về.

### Bài 7.6. Xử lý báo cáo pentest và OWASP Top 10

#### Kiến thức

##### OWASP Top 10 bản 2025
OWASP Top 10 là danh sách mười nhóm rủi ro bảo mật web phổ biến nhất, cập nhật vài năm một lần. Bản 2025 (bản RC công bố tháng 11/2025, bản chính thức ra sau đó):

| Mã | Tên | Ghi chú |
|---|---|---|
| A01 | Broken Access Control | Vẫn đứng đầu; đã gộp SSRF |
| A02 | Security Misconfiguration | Lên hạng 2 |
| A03 | Software Supply Chain Failures | Mới, mở rộng từ "thành phần có lỗ hổng" |
| A04 | Cryptographic Failures | Xuống từ hạng 2 |
| A05 | Injection | Xuống từ hạng 3 |
| A06 | Insecure Design | |
| A07 | Authentication Failures | |
| A08 | Software or Data Integrity Failures | |
| A09 | Security Logging and Alerting Failures | |
| A10 | Mishandling of Exceptional Conditions | Mới: xử lý lỗi sai, "fail open", lộ thông tin khi có exception |

Nếu người phỏng vấn quen bản 2021, nói được chỗ khác: hai mục mới (chuỗi cung ứng phần mềm, xử lý tình huống bất thường) và SSRF gộp vào access control.

##### Lỗi hay gặp nhất: IDOR
IDOR (Insecure Direct Object Reference): đổi `/api/sessions/123` thành `/124` là xem được bài thi của người khác. Kiểm tra role là chưa đủ; phải kiểm tra quyền trên **từng resource**. ASP.NET Core có sẵn cơ chế resource-based authorization:

```csharp
public class SessionOwnerHandler
    : AuthorizationHandler<OperationAuthorizationRequirement, ExamSession>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext ctx,
        OperationAuthorizationRequirement req, ExamSession session)
    {
        var sub = ctx.User.FindFirst("sub")?.Value;
        if (sub is not null && session.CandidateId.ToString() == sub) ctx.Succeed(req);
        return Task.CompletedTask;
    }
}

// Trong endpoint
var session = await repo.GetAsync(id);
var auth = await authz.AuthorizeAsync(User, session, Operations.Read);
if (!auth.Succeeded) return NotFound(); // 404 để không lộ resource có tồn tại
```

ID khó đoán (GUID) chỉ làm khó hơn, không thay được việc kiểm quyền.

##### Cấu hình JWT chặt
```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = "https://idp.example.com";
        o.Audience = "exam-api";
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true, ValidateAudience = true,
            ValidateLifetime = true, ValidateIssuerSigningKey = true,
            ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 }, // chặn "none", chặn nhầm HS/RS
            ClockSkew = TimeSpan.FromSeconds(30) // mặc định là 5 phút
        };
    });
```

Kèm theo: access token hạn ngắn, refresh token xoay vòng, không để dữ liệu nhạy cảm trong payload vì JWT chỉ được ký, không được mã hóa.

##### Rate limit cho đăng nhập và OTP
```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests; // mặc định là 503
    o.AddPolicy("otp", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(15) }));
});
app.UseRateLimiter();
app.MapPost("/auth/otp/verify", VerifyOtp).RequireRateLimiting("otp");
```

Rate limiter của ASP.NET Core mặc định trả 503, nên phải đặt 429 cho đúng nghĩa. Sau reverse proxy phải cấu hình forwarded headers, không thì mọi request mang IP của proxy. Nên giới hạn thêm theo tài khoản, không chỉ theo IP.

##### Các lỗi khác hay xuất hiện trong báo cáo
- Thiếu header bảo mật (CSP, HSTS, `X-Content-Type-Options`): A02.
- Secret trong file cấu hình hoặc repo: chuyển sang secret store (A02, A04).
- Thư viện có lỗ hổng: `dotnet list package --vulnerable --include-transitive`, NuGet Audit trong build, quét image trong CI (A03).
- Trả stack trace ra client: dùng `UseExceptionHandler` và ProblemDetails, chi tiết chỉ ghi log (A10).

##### Quy trình xử lý một báo cáo pentest
Phân loại theo CVSS (Low, Medium, High, Critical) kết hợp khả năng khai thác thực tế → tái hiện để xác nhận → sửa theo thứ tự mức độ, mỗi lỗi có test hồi quy → nhờ bên pentest kiểm tra lại (retest) → lỗi nào chấp nhận rủi ro thì ghi lý do và người phê duyệt.

#### Cách show off
Ở Examena bạn **chưa trực tiếp xử lý** một đợt pentest. Nhận một câu, rồi kể việc sửa bảo mật bạn đã làm ở VTC khi gia cố BFF/SSO, và trình bày quy trình bạn sẽ dùng cho một báo cáo pentest.

> **Ví dụ:** "Đợt pentest ở Examena tôi không trực tiếp xử lý. Việc bảo mật tôi tự làm là ở VTC khi gia cố BFF và SSO: chuyển CORS sang danh sách origin đọc từ config, đặt cookie phiên HttpOnly, Secure, SameSite, và kiểm tra redirect URL theo danh sách cho phép để chặn open redirect. Nếu nhận một báo cáo pentest, tôi phân loại theo mức độ và khả năng khai thác, ưu tiên những lỗi không cần đăng nhập cũng khai thác được. Mỗi lỗi sửa xong phải có test hồi quy, rồi nhờ bên pentest kiểm tra lại. Với hệ .NET, hai chỗ tôi rà đầu tiên là phân quyền theo từng resource để chặn kiểu đổi ID xem bài người khác, và cấu hình JWT: cố định thuật toán, kiểm issuer, audience, hạn token, giảm độ lệch đồng hồ mặc định năm phút."

Điểm ăn điểm:
- Biết bản OWASP mới và hai mục mới.
- Phân biệt kiểm role với kiểm quyền trên resource.
- Biết các mặc định nguy hiểm: `ClockSkew` 5 phút, rate limiter trả 503.
- Có quy trình: phân loại, test hồi quy, retest, ghi nhận rủi ro chấp nhận.

#### Câu hỏi vặn
- **"Anh đã từng xử lý pentest thật chưa?"** "Ở Examena thì chưa trực tiếp. Ở VTC, khi gia cố BFF và SSO, tôi chuyển CORS từ `*` sang danh sách origin đọc từ config, đặt cookie phiên HttpOnly/Secure/SameSite, và kiểm redirect URL theo danh sách cho phép để chặn open redirect." Rồi trình bày quy trình: phân loại, tái hiện, sửa kèm test hồi quy, retest.
- **"OWASP Top 10 bản 2025 có gì mới so với 2021?"** Thêm Software Supply Chain Failures và Mishandling of Exceptional Conditions; SSRF gộp vào Broken Access Control; Security Misconfiguration lên hạng 2.
- **"Chặn IDOR trong ASP.NET Core thế nào?"** Load resource, gọi `IAuthorizationService.AuthorizeAsync(User, resource, requirement)` với handler kiểm chủ sở hữu, không đạt thì trả 404. Dùng GUID không thay được việc kiểm quyền.
- **"Những tham số JWT nào phải kiểm?"** Chữ ký với khóa đúng, thuật toán cố định, `iss`, `aud`, `exp`/`nbf`, `ClockSkew` nhỏ; access token hạn ngắn.
- **"Sửa lỗi pentest theo thứ tự nào?"** Theo mức độ và khả năng khai thác: Critical, High trước, nhất là lỗi không cần đăng nhập. Mỗi lỗi có test hồi quy, rồi retest.
- **"Phòng lỗi chuỗi cung ứng trong dự án .NET thế nào?"** Quét package có lỗ hổng kể cả gói gián tiếp trong CI, lock file, nguồn package tin cậy, quét và ghim image theo digest, giới hạn quyền token CI.

#### Bẫy cần tránh
- Nhận đợt pentest ở Examena là việc mình xử lý.
- Dùng danh sách OWASP 2021 mà không biết đã có bản mới.
- Chặn IDOR chỉ bằng ID khó đoán.
- Tin các mặc định: `ClockSkew` 5 phút, rate limiter trả 503.

#### Nhớ nhanh
- Pentest ở Examena chưa trực tiếp xử lý: một câu, kể việc gia cố BFF/SSO ở VTC, rồi quy trình.
- OWASP 2025: hai mục mới, SSRF gộp vào access control.
- IDOR: kiểm quyền theo resource, trả 404.
- JWT: cố định thuật toán, kiểm `iss`/`aud`/`exp`, giảm `ClockSkew`.

#### Bài tập
1. Endpoint `GET /api/results/{id}` chỉ có `[Authorize(Roles = "Candidate")]`. Chỉ ra lỗ hổng và cách sửa.
   **Đáp án:** IDOR: thí sinh nào cũng đọc được kết quả của người khác. Load kết quả, kiểm `CandidateId == sub` bằng resource-based authorization, không khớp thì trả 404.
2. Xếp các lỗi sau vào mục OWASP 2025: stack trace trả về client; package có CVE; secret trong appsettings; SSRF qua URL ảnh đại diện.
   **Đáp án:** A10; A03; A02 (kèm A04 nếu là khóa mã hóa); A01.

### Bài 7.7. Tuyển người và kèm người trong team

#### Kiến thức

##### Phỏng vấn có cấu trúc
Vấn đề của phỏng vấn tự do là mỗi người hỏi một kiểu và quyết định theo cảm giác. Phỏng vấn có cấu trúc sửa việc đó: mọi ứng viên cùng vị trí nhận cùng bộ câu hỏi, chấm theo cùng một bảng tiêu chí (rubric) mô tả rõ từng mức. Mỗi người phỏng vấn chấm độc lập trước khi họp thống nhất, để người nói to nhất không quyết định thay cả nhóm. Bài tập kỹ thuật nên gần việc thật (đọc code, sửa bug, thiết kế nhỏ) hơn là câu đố thuật toán.

##### 1:1 hằng tuần
Buổi 1:1 là buổi của người được kèm, không phải buổi báo cáo tiến độ. Nội dung: vướng mắc, mục tiêu phát triển, phản hồi hai chiều. Lead ghi chú để theo dõi qua nhiều tuần, vì tiến bộ chỉ thấy được khi nhìn dài.

##### Góp ý theo SBI
Situation (tình huống cụ thể) → Behavior (hành vi quan sát được) → Impact (tác động). Ví dụ: "Trong PR sửa luồng nộp bài hôm thứ Ba, phần retry không có test, nên người review phải tự dựng lại kịch bản và PR chậm hai ngày." Góp ý kiểu "em cần cẩn thận hơn" không cho người nghe biết phải sửa gì.

##### Đề xuất lên level
Dựa trên khung năng lực của công ty và bằng chứng công việc: PR, thiết kế đã viết, sự cố đã xử lý, mức độ tự chủ. Lead chuẩn bị hồ sơ và nói rõ khoảng cách còn thiếu, không hứa trước kết quả.

##### Chuẩn review
Một checklist ngắn: đúng nghiệp vụ, xử lý lỗi, có test, có log hoặc metric, có cách rollback. Người review trả lời trong thời hạn đã thỏa thuận, để review không thành nút cổ chai.

#### Cách show off
Câu chuyện: năm cuối ở AvePoint bạn ngồi khoảng hai chục buổi phỏng vấn kỹ thuật, nhận ba người; kèm hai bạn junior, một bạn lên mid sau khoảng một năm. Chuẩn bị thêm một buổi phỏng vấn cụ thể đã từ chối và lý do.

> **Ví dụ:** "Năm cuối tôi ngồi khoảng hai chục buổi phỏng vấn kỹ thuật và nhận ba người. Cách tôi làm là phỏng vấn có cấu trúc: cùng bộ câu hỏi, cùng bảng tiêu chí, mỗi người chấm độc lập trước khi họp, và bài tập gần với việc thật của team. Tôi kèm hai bạn junior, giữ 1:1 hằng tuần cho chính người được kèm và góp ý bằng tình huống cụ thể chứ không nói chung chung. Một bạn lên mid sau khoảng một năm; hồ sơ đề xuất tôi dựa vào bằng chứng công việc theo khung năng lực của công ty: tính năng bạn tự làm, PR bạn review, sự cố bạn xử lý."

Điểm ăn điểm:
- Biết vì sao phải chấm độc lập trước khi họp.
- Phân biệt 1:1 với họp tiến độ.
- Góp ý bằng hành vi cụ thể, không bằng nhận xét về tính cách.

#### Câu hỏi vặn
- **"Anh đã phỏng vấn bao nhiêu người, tuyển được bao nhiêu?"** "Năm cuối khoảng hai chục buổi, nhận ba người." Rồi kể một buổi đã từ chối: "Ứng viên trả lời lý thuyết tốt, nhưng khi tôi đổi yêu cầu giữa bài thiết kế thì bạn không hỏi lại, không điều chỉnh, vẫn giữ nguyên bản cũ. Trong team, yêu cầu đổi giữa chừng là chuyện thường gặp, nên tôi từ chối."
- **"Anh thiết kế buổi phỏng vấn kỹ thuật thế nào để công bằng?"** Cùng câu hỏi, cùng rubric có mô tả từng mức, chấm độc lập trước khi họp, bài tập gần việc thật.
- **"Một buổi 1:1 của anh gồm những gì?"** Vướng mắc của người được kèm, mục tiêu phát triển, phản hồi hai chiều. Không biến thành báo cáo tiến độ, việc đó đã có daily.
- **"Anh góp ý cho một người làm chưa tốt thế nào?"** Theo SBI: tình huống, hành vi quan sát được, tác động; riêng tư, sớm, kèm đề xuất cụ thể.
- **"Dựa vào đâu để đề xuất một junior lên mid?"** Khung năng lực của công ty và bằng chứng: tự làm được tính năng cỡ vừa, review được PR người khác, xử lý được sự cố trong phạm vi mình.
- **"Nếu một người trong team liên tục trễ hạn thì sao?"** Nói chuyện riêng sớm, tìm nguyên nhân (ước lượng sai, bị kẹt, quá tải, vấn đề cá nhân) trước khi kết luận; chia việc nhỏ hơn và hẹn mốc kiểm tra gần; ghi lại để theo dõi.

#### Bẫy cần tránh
- Nói số buổi phỏng vấn mà không kể được một quyết định nhận hoặc từ chối cụ thể.
- Nói 1:1 là buổi hỏi tiến độ.
- Góp ý chung chung hoặc nhắm vào con người thay vì hành vi.

#### Nhớ nhanh
- Năm cuối khoảng hai chục buổi phỏng vấn, nhận ba; kèm hai junior, một lên mid sau khoảng một năm.
- Phỏng vấn có cấu trúc, rubric chung, chấm độc lập.
- 1:1 hằng tuần là của người được kèm; góp ý theo SBI.
- Lên level dựa trên bằng chứng công việc.

#### Bài tập
1. Viết rubric 4 mức cho tiêu chí "xử lý lỗi và edge case" khi phỏng vấn backend.
   **Đáp án:** Mức 1: không nghĩ tới lỗi; mức 2: xử lý khi được gợi ý; mức 3: tự nêu timeout, retry, dữ liệu rỗng; mức 4: thêm idempotency, quan sát (log, metric) và cách rollback.
2. Viết lại góp ý "code của bạn lộn xộn" theo SBI.
   **Đáp án:** Ví dụ: "Trong PR thêm API xuất kết quả, một hàm 300 dòng vừa truy vấn vừa định dạng file, nên khó review và khó test riêng phần định dạng. Mình tách thành hai hàm được không?"

### Bài 7.8. Vận hành ngày thi

#### Kiến thức

##### Vì sao ngày thi là một loại vận hành riêng
Với hầu hết hệ thống, sự cố năm phút là phiền. Với kỳ thi, năm phút là hàng nghìn thí sinh mất giờ làm bài, có thể phải tổ chức thi lại. Tải lại đến đúng một thời điểm biết trước. Hai đặc điểm này quyết định cách vận hành: chuẩn bị trước thay vì phản ứng, và có kịch bản sẵn cho từng loại sự cố.

##### Trước kỳ thi
- Checklist cho từng kỳ thi: số thí sinh dự kiến, giờ bắt đầu, phòng thi, người liên hệ phía khách hàng.
- **Scale trước theo lịch:** autoscale của Kubernetes (HPA) phản ứng theo CPU sau vài chục giây tới vài phút (chờ metric, chờ pod khởi động, có khi chờ thêm node), không kịp đỉnh vào thi đúng giờ. Scale SFU, API, signaling trước giờ thi 30–60 phút, ví dụ bằng KEDA cron scaler hoặc một job đổi số replica.
- Làm nóng cache (đề thi, cấu hình kỳ thi), kiểm tra TURN server.
- **Đóng băng deploy** từ trước kỳ thi tới khi kết thúc.

##### Trong kỳ thi
- War room có vai trò rõ: một người điều phối sự cố (không tự sửa), một người liên lạc khách hàng, các kỹ sư xử lý.
- Dashboard trực tiếp: số thí sinh đang kết nối, tỷ lệ rớt kết nối, tải mỗi worker SFU, lỗi API, độ dài hàng đợi duyệt cờ.
- Runbook cho từng loại sự cố: triệu chứng → cách xác nhận → hành động → khi nào báo khách hàng. Ví dụ worker SFU chết: xác nhận qua log và dashboard → chuyển phòng sang worker khác → thí sinh tự kết nối lại → ghi danh sách thí sinh bị ảnh hưởng để hội đồng gia hạn giờ.

##### Sau kỳ thi
Postmortem không đổ lỗi (blameless): dòng thời gian, nguyên nhân, việc cần làm có người nhận và hạn; cập nhật runbook từ những gì vừa học được.

> **Mẹo:** Một runbook tốt viết cho người đang hoảng lúc 8 giờ sáng: từng bước ngắn, có lệnh cụ thể, có cách kiểm tra đã ổn.

#### Cách show off
Câu chuyện chính là ngày thi thật đầu tiên: chuẩn bị gì, sự cố gì, xử lý thế nào. Thêm một con số: bạn trực hầu hết các kỳ thi lớn trong năm đầu, khoảng mười lần. Sự cố thứ hai để dự phòng: một node media server đầy đĩa vì log.

> **Ví dụ:** "Năm đầu tôi trực hầu hết các kỳ thi lớn, khoảng mười lần. Ngày thi thật đầu tiên, tuần trước đó team đã diễn tập đúng quy mô; sáng thi tôi cho scale media server trước một giờ, chạy checklist, mở kênh chat với giám thị và bộ phận hỗ trợ. Sự cố đến ngay đầu giờ: một nhóm thí sinh ở mạng trường chặn UDP nên không lên được video. TURN qua TCP/TLS cổng 443 đã được cấu hình dự phòng nhưng chưa bật cho mọi client; tôi bật nó, vài phút sau các em vào lại được, không phải hủy phiên nào. Một lần khác, một node media server đầy đĩa vì log; phiên mới được điều sang node khác, sau đó tôi thêm cảnh báo dung lượng và xoay vòng log."

Điểm ăn điểm:
- Giải thích vì sao autoscale không kịp, không chỉ nói "scale trước".
- Tách vai điều phối khỏi vai sửa lỗi.
- Nghĩ tới thí sinh bị ảnh hưởng: ghi danh sách để gia hạn giờ.

#### Câu hỏi vặn
- **"Anh đã trực ngày thi bao nhiêu lần, có sự cố gì?"** "Hầu hết các kỳ thi lớn năm đầu, khoảng mười lần." Kể sự cố mạng trường chặn UDP ở kỳ thi đầu: bật TURN qua TCP/TLS cổng 443 đã cấu hình sẵn, vài phút sau thí sinh vào lại, không hủy phiên nào. Bài học: phương án dự phòng phải bật sẵn cho mọi client, không chờ sự cố.
- **"Vì sao không để autoscale lo đỉnh đầu giờ thi?"** HPA cần thời gian thu metric, khởi động pod và có khi thêm node; đỉnh vào thi diễn ra trong vài phút đầu, nên phải scale theo lịch từ trước.
- **"Một runbook tốt gồm những gì?"** Triệu chứng, cách xác nhận, hành động từng bước, cách kiểm tra đã ổn, khi nào leo thang và báo khách hàng.
- **"Giữa giờ thi một worker SFU chết thì làm gì?"** Phát hiện qua sự kiện worker chết và dashboard, tạo lại worker, chuyển phòng, thí sinh tự kết nối lại; ghi danh sách thí sinh bị ảnh hưởng để gia hạn giờ. Dư phòng worker để chịu được một worker chết.
- **"Trong war room, ai làm gì?"** Người điều phối giữ bức tranh chung và ra quyết định, không tự sửa; người liên lạc cập nhật khách hàng theo nhịp cố định; kỹ sư xử lý theo runbook. Thiếu người liên lạc thì khách hàng gọi thẳng vào kỹ sư đang sửa.
- **"Sự cố đã xử lý xong, việc tiếp theo là gì?"** Postmortem không đổ lỗi trong vài ngày: dòng thời gian, nguyên nhân, việc cần làm có người nhận và hạn; cập nhật runbook và dashboard nếu thiếu tín hiệu.

#### Bẫy cần tránh
- Nói "không hủy phiên nào" mà không kể được sự cố nào đã suýt làm hủy phiên và xử lý ra sao.
- Tin autoscale kịp đỉnh đầu giờ.
- Người điều phối vừa điều phối vừa sửa, không ai báo khách hàng.

#### Nhớ nhanh
- Trước: scale theo lịch, làm nóng cache, đóng băng deploy.
- Trong: war room có vai trò rõ, dashboard, runbook.
- Sau: postmortem không đổ lỗi, cập nhật runbook.
- Trực khoảng mười kỳ thi lớn năm đầu; sự cố mạng chặn UDP, bật TURN qua TCP/TLS 443, không hủy phiên nào.

#### Bài tập
1. Viết checklist 8 mục cho 60 phút trước một kỳ thi 3.000 thí sinh.
   **Đáp án:** Xác nhận đóng băng deploy; scale SFU, API, signaling theo lịch; kiểm tra số worker và dư phòng; làm nóng cache đề và cấu hình; kiểm tra TURN; mở dashboard; xác nhận người trực và kênh liên lạc khách hàng; chạy một phiên thi thử từ đầu tới cuối.
2. Viết runbook cho sự cố "tỷ lệ thí sinh không vào được phòng thi tăng đột biến".
   **Đáp án:** Xác nhận qua dashboard (lỗi API bắt đầu thi, lỗi signaling, lỗi kết nối ICE); khoanh vùng theo thành phần; nếu do deploy thì rollback; nếu do tải thì scale thêm; báo khách hàng nếu kéo dài quá 5 phút; ghi danh sách thí sinh bị ảnh hưởng.

## Chương 8. IAS 2.0: chuyển đổi kiến trúc

IAS 2.0 là dự án chuyển một nền tảng giáo dục cũ của khách hàng sang kiến trúc mới trên .NET. Xương sống câu chuyện: chuyển dần theo module (strangler) qua gateway sang khoảng bảy service trên .NET theo hướng CQRS với RabbitMQ, chạy song song hệ cũ và mới có đối soát, PostgreSQL replica cho báo cáo và MongoDB shard theo tenant. Phần chưa triển khai, nói ở mức thiết kế: transactional outbox và saga.

Người phỏng vấn hỏi về migration để xem bạn có tư duy rủi ro không: dữ liệu chuyển thế nào, đối soát ra sao, hỏng thì quay lại bằng gì. Chương này đi qua ba bài toán kinh điển của hệ phân tán: tách service, mở rộng database và giữ dữ liệu nhất quán qua message. Mỗi bài nói rõ phần nào bạn kể như chuyện thật, phần nào bạn trình bày ở mức thiết kế.

### Bài 8.1. Tách monolith: bounded context, strangler fig và CQRS

#### Kiến thức

##### Chia service theo cái gì
Sai lầm phổ biến nhất khi tách monolith là chia theo bảng: service User, service Course, service Score. Kết quả là các service "CRUD" phải gọi nhau liên tục cho mọi nghiệp vụ, và hệ thống thành **distributed monolith**: vẫn dính chặt như cũ nhưng giờ thêm độ trễ mạng và lỗi từng phần.

DDD (Domain-Driven Design) cho một cách chia tốt hơn, theo năng lực nghiệp vụ. Vài khái niệm đủ dùng khi phỏng vấn:
- **Bounded context:** ranh giới mà trong đó một mô hình và từ vựng có nghĩa nhất quán. "Học viên" trong Đăng ký (có trạng thái đăng ký) khác "học viên" trong Chấm điểm (có điểm).
- **Ubiquitous language:** dev và người làm nghiệp vụ dùng chung từ ngữ; tên class đúng tên nghiệp vụ.
- **Aggregate:** cụm đối tượng thay đổi cùng nhau trong một transaction, là ranh giới nhất quán mạnh.
- **Anti-corruption layer:** lớp dịch giữa hệ mới và hệ cũ, để mô hình lộn xộn của hệ cũ không lan sang.

Mỗi service sở hữu dữ liệu của mình, deploy độc lập, và giao tiếp qua event khi có thể.

##### Strangler fig: thay dần thay vì đập đi xây lại
Tên lấy từ loài cây đa mọc quanh cây chủ rồi dần thay thế nó. Đặt một proxy trước hệ cũ; mỗi khi chuyển xong một nhóm endpoint thì đổi định tuyến nhóm đó sang service mới. Ví dụ cách làm với YARP:

```json
{
  "ReverseProxy": {
    "Routes": {
      "enrollment-new": { "ClusterId": "enrollment", "Match": { "Path": "/api/enrollments/{**rest}" } },
      "legacy-all": { "ClusterId": "legacy", "Order": 1000, "Match": { "Path": "{**catch-all}" } }
    },
    "Clusters": {
      "enrollment": { "Destinations": { "d1": { "Address": "http://enrollment-svc/" } } },
      "legacy": { "Destinations": { "d1": { "Address": "http://legacy-app/" } } }
    }
  }
}
```

Phần khó không nằm ở định tuyến mà ở **dữ liệu** khi hai hệ cùng chạy:
- Tại mỗi thời điểm, mỗi loại dữ liệu chỉ có một nguồn sự thật; bên kia nhận bản sao qua CDC hoặc event.
- Tránh dual-write từ code (ghi hai nơi trong cùng một hàm): một bên lỗi là lệch, không có transaction chung.
- Đối soát định kỳ, ví dụ hằng đêm: so số bản ghi và checksum theo đơn vị và theo ngày; lệch thì cảnh báo và có công cụ sửa.
- Rollback là đổi định tuyến về hệ cũ, nhưng chỉ an toàn khi dữ liệu ghi ở hệ mới đã được đồng bộ ngược về hệ cũ. Thiếu điều này thì rollback làm mất dữ liệu.

Big-bang (chuyển một lần) chỉ hợp khi hệ nhỏ và chấp nhận được thời gian ngừng.

##### CQRS và read model
CQRS tách phía ghi (command: kiểm nghiệp vụ, thay đổi aggregate) khỏi phía đọc (query: dữ liệu dàn phẳng sẵn cho màn hình). Phía ghi phát event qua RabbitMQ; một projection nhận event và cập nhật read model. Hệ quả là đọc trễ một chút so với ghi (eventual consistency).

Projection phải chịu được thực tế của message:
- **Idempotent:** cùng một event đến hai lần không làm sai dữ liệu.
- **Không giả định thứ tự:** lưu version, chỉ cập nhật khi event mới hơn bản đang có.
- **Retry có giới hạn và dead-letter queue** cho message lỗi lặp lại.

CQRS không bắt buộc đi với event sourcing; phần lớn hệ CQRS vẫn lưu trạng thái hiện tại bình thường.

#### Cách show off
Câu chuyện: hệ cũ được chuyển dần theo module (strangler) qua gateway sang khoảng bảy service chia theo nghiệp vụ, trên .NET theo hướng CQRS với RabbitMQ. Câu hỏi khó nhất sẽ là "anh migrate dữ liệu và rollback thế nào": đợt đầu job ETL chuyển dữ liệu lịch sử; trong thời gian chạy song song, thay đổi ở hệ cũ được đồng bộ sang hệ mới bằng event; đối soát bằng script so số dòng và checksum theo ngày và theo tenant; rollback bằng chuyển route ở gateway về hệ cũ.

> **Ví dụ:** "IAS 2.0 chuyển một nền tảng giáo dục cũ của khách hàng sang .NET. Chúng tôi không làm big-bang mà chuyển dần theo module qua gateway, tổng cộng khoảng bảy service theo nghiệp vụ. Đợt đầu một job ETL chuyển dữ liệu lịch sử; trong thời gian hai hệ chạy song song, thay đổi ở hệ cũ được đồng bộ sang bằng event, và script đối soát so số dòng và checksum theo ngày, theo tenant. Rollback là chuyển route ở gateway về hệ cũ. Bên trong, phía ghi xử lý nghiệp vụ và phát event qua RabbitMQ, các projection dựng read model cho màn hình đọc. Điều tôi chú ý nhất là projection phải chịu được message trùng và đến sai thứ tự, nên mỗi bản ghi đọc có version và event cũ bị bỏ qua."

Điểm ăn điểm:
- Nói được distributed monolith là gì và vì sao chia theo bảng dẫn tới nó.
- Thấy phần khó của strangler là dữ liệu, không phải định tuyến.
- Rollback chỉ an toàn khi có đồng bộ ngược.
- Projection idempotent và chịu sai thứ tự.

#### Câu hỏi vặn
- **"Hệ mới có bao nhiêu service, kể tên được không?"** "Khoảng bảy: định danh, tổ chức trường lớp, khóa học, đăng ký, bài kiểm tra và chấm điểm, thông báo, báo cáo." Thêm lý do gộp: bài kiểm tra và chấm điểm để chung vì luôn đổi cùng nhau, tách ra chỉ thêm gọi qua mạng.
- **"Có event store không, có replay để dựng lại trạng thái không?"** Không. Phía ghi lưu trạng thái hiện tại trong PostgreSQL; event qua RabbitMQ chỉ để cập nhật read model. Đó là CQRS không có event sourcing.
- **"Dùng EF Core hay Dapper?"** Cả hai: EF Core cho phía ghi (aggregate, migration), Dapper cho truy vấn đọc trên read model và báo cáo, nơi cần kiểm soát câu SQL.
- **"Chia service theo tiêu chí gì?"** Theo năng lực nghiệp vụ và bounded context, không theo bảng. Mỗi service sở hữu dữ liệu của mình và deploy độc lập được.
- **"Làm sao tránh distributed monolith?"** Không dùng chung database; tránh chuỗi gọi đồng bộ dài; giao tiếp qua event khi có thể; hợp đồng có version để deploy độc lập.
- **"Khi hai hệ chạy song song, dữ liệu đồng bộ và đối soát thế nào?"** Một nguồn sự thật cho mỗi loại dữ liệu; đồng bộ qua CDC hoặc event, tránh dual-write; đối soát định kỳ bằng số bản ghi và checksum.
- **"Rollback một bước chuyển đổi thế nào?"** Đổi định tuyến ở gateway về hệ cũ, nhưng chỉ an toàn khi dữ liệu ghi ở hệ mới không bị mất: hoặc hệ cũ vẫn là nguồn ghi trong giai đoạn song song, hoặc có đồng bộ ngược. Phải thiết kế việc này trước khi chuyển, không phải lúc đang cháy.
- **"Read model trễ thì người dùng thấy gì?"** Có thể thấy dữ liệu cũ trong khoảng ngắn. Xử lý bằng trạng thái "đang xử lý", trả kết quả trực tiếp từ command, hoặc đọc phía ghi cho màn hình ngay sau thao tác.
- **"Vì sao chọn CQRS, nó có đáng với độ phức tạp không?"** Đáng khi đọc và ghi có hình dạng rất khác nhau, hoặc tải đọc lớn hơn nhiều tải ghi. Với màn hình CRUD đơn giản thì không đáng; đừng áp CQRS cho cả hệ thống.

#### Bẫy cần tránh
- Kể tên danh sách service mà không nói được vì sao chia đúng chỗ đó.
- Service tách ra nhưng dùng chung database và gọi nhau đồng bộ chuỗi dài.
- Nói rollback là "đổi định tuyến" mà quên dữ liệu ghi ở hệ mới.
- Nói CQRS bắt buộc đi với event sourcing.

#### Nhớ nhanh
- Chuyển dần theo module qua gateway, khoảng bảy service; ETL dữ liệu lịch sử, đồng bộ bằng event, đối soát số dòng và checksum theo ngày, theo tenant.
- Chia theo nghiệp vụ, không theo bảng; anti-corruption layer cách ly hệ cũ.
- Strangler: proxy định tuyến, một nguồn sự thật, đối soát, rollback cần đồng bộ ngược.
- Projection idempotent, chịu sai thứ tự, có dead-letter queue.

#### Bài tập
1. Một monolith giáo dục có các bảng: User, School, Class, Course, Enrollment, Lesson, Quiz, Score, Email. Gom thành bounded context và nêu event giữa chúng.
   **Đáp án:** Ví dụ: Identity (User), Organization (School, Class), Catalog (Course), Enrollment, Content (Lesson), Assessment (Quiz), Grading (Score), Notification (Email). Event: `StudentEnrolled` → Notification gửi email, Content mở quyền học; `QuizSubmitted` → Grading; `ScoreRecorded` → báo cáo.
2. Một projection nhận `EnrollmentStatusChanged` version 5 rồi mới tới version 4. Thiết kế để read model không bị ghi lùi.
   **Đáp án:** Lưu `version` trong read model; chỉ cập nhật khi version của event lớn hơn version hiện tại (`UPDATE ... WHERE id = @id AND version < @v`); event cũ bị bỏ qua và ghi log.

### Bài 8.2. Mở rộng database: PostgreSQL replica và MongoDB sharding

#### Kiến thức

##### Hai cách mở rộng khác nhau
Replica giải bài toán **đọc** nhiều: nhân bản toàn bộ dữ liệu ra nhiều máy, phân tải đọc, nhưng mọi lần ghi vẫn đi qua một primary. Sharding giải bài toán dữ liệu hoặc tải **ghi** vượt sức một máy: chia dữ liệu thành nhiều phần nằm ở nhiều máy. Nói rõ được mình đang giải bài toán nào là điều đầu tiên người phỏng vấn muốn nghe.

##### PostgreSQL streaming replication
Primary ghi mọi thay đổi vào WAL (write-ahead log) và gửi WAL cho standby; standby phát lại WAL để có bản sao. Bật `hot_standby` thì standby nhận truy vấn chỉ đọc.

- **Bất đồng bộ (mặc định):** primary commit không chờ standby. Nhanh, nhưng có thể mất vài giao dịch cuối nếu primary chết, và đọc trên replica có thể thấy dữ liệu cũ.
- **Đồng bộ:** cấu hình `synchronous_standby_names` và `synchronous_commit`. Mức `remote_apply` chờ standby phát lại xong, nên đọc trên standby thấy ngay, đổi lại commit chậm hơn.

```sql
-- Trên primary: độ trễ từng replica
SELECT application_name, sync_state, write_lag, flush_lag, replay_lag
FROM pg_stat_replication;
```

##### Read-your-writes
Người dùng vừa lưu hồ sơ, trang sau đọc từ replica chưa bắt kịp, và họ không thấy thay đổi của mình. Hai cách xử lý:
1. Đọc từ primary trong vài giây sau khi người đó ghi (đánh dấu theo phiên). Đơn giản, primary chịu thêm chút tải.
2. Ghi xong lấy vị trí WAL (`pg_current_wal_lsn()`), trước khi đọc replica kiểm tra replica đã phát lại tới đó chưa (`pg_last_wal_replay_lsn()`); chưa thì đọc primary. Chính xác hơn, phức tạp hơn.

Trong .NET, có thể tách hai data source ghi và đọc, hoặc dùng chuỗi kết nối nhiều host của Npgsql với `Target Session Attributes` (`read-write`, `prefer-standby`).

##### Vì sao chuyển đọc báo cáo sang replica giúp phía ghi
Câu trả lời hay gặp là "để bớt khóa", nhưng với MVCC của PostgreSQL, người đọc không chặn người ghi. Lợi ích thật là: truy vấn báo cáo quét lớn tranh CPU và I/O, đẩy dữ liệu nóng của phía ghi ra khỏi bộ nhớ đệm, và transaction dài giữ snapshot cũ khiến vacuum không dọn được, bảng phình ra. Chuyển sang replica loại bỏ các tranh chấp đó trên primary.

Đổi lại, truy vấn dài trên replica có thể bị hủy với lỗi "conflict with recovery" khi primary đã dọn những dòng truy vấn còn cần. Lựa chọn: tăng `max_standby_streaming_delay` (replica chấp nhận trễ hơn) hoặc bật `hot_standby_feedback` (primary giữ dòng lâu hơn, có thể phình bảng). Vì vậy replica cho báo cáo thường tách riêng khỏi replica dự phòng.

##### MongoDB sharding và chọn shard key
Collection được chia thành chunk theo giá trị shard key; balancer di chuyển chunk giữa các shard; `mongos` định tuyến truy vấn. Shard key quyết định gần như mọi thứ:
- **Khóa tăng dần** (thời gian, ObjectId) theo kiểu ranged: mọi lần ghi dồn vào chunk cuối, một shard nóng còn lại ngồi chơi.
- **Chỉ dùng `tenantId`:** mọi document của một tenant cùng giá trị, chunk không chia nhỏ được; tenant lớn tạo **jumbo chunk** và điểm nóng.
- **Khóa ghép có phần băm** `{ tenantId: 1, _id: "hashed" }` (MongoDB 4.4 trở lên): truy vấn có `tenantId` chỉ đi tới các shard giữ dữ liệu của tenant đó, còn dữ liệu của một tenant lớn vẫn rải đều.

```javascript
sh.shardCollection("ias.enrollments", { tenantId: 1, _id: "hashed" })

db.enrollments.find({ tenantId: "t-042", studentId: "s-9" }) // có đích
db.enrollments.find({ studentId: "s-9" })                    // hỏi mọi shard
```

Truy vấn không có tiền tố shard key là **scatter-gather**: `mongos` hỏi mọi shard rồi gộp, độ trễ bằng shard chậm nhất. Chọn sai shard key vẫn sửa được (`refineCollectionShardKey` từ 4.4, `reshardCollection` từ 5.0) nhưng tốn tài nguyên; zone sharding cho phép ghim tenant lớn vào shard riêng.

#### Cách show off
Ranh giới việc: PostgreSQL streaming replication do DevOps dựng, replica phục vụ báo cáo và API chỉ đọc; bạn viết phần tách đọc/ghi trong code (đọc ngay sau khi ghi thì đi primary). MongoDB shard key `{ tenantId: 1, userId: 1 }` cho dữ liệu hoạt động học và bài làm; bạn tham gia chọn shard key và đảm bảo truy vấn luôn kèm tenantId, cụm do DevOps dựng. Một con số: sau khi chuyển đọc báo cáo sang replica, p95 ghi trên primary giảm khoảng một phần ba giờ cao điểm.

> **Ví dụ:** "Ở IAS 2.0, DevOps dựng PostgreSQL streaming replication, còn tôi viết phần tách đọc/ghi trong code: báo cáo và API chỉ đọc đi replica, màn hình ngay sau khi người dùng lưu thì đi primary vì replica có độ trễ. Chuyển đọc báo cáo sang replica không phải để bớt khóa, vì PostgreSQL đọc không chặn ghi, mà để primary bớt tranh CPU, I/O và bộ nhớ đệm với các truy vấn quét lớn. Kết quả: p95 các API báo cáo giảm khoảng một nửa giờ cao điểm, p95 ghi trên primary giảm khoảng một phần ba, tôi so trên APM và `pg_stat_statements` cùng khung giờ trước và sau. Với MongoDB, tôi tham gia chọn shard key `{ tenantId, userId }` cho dữ liệu hoạt động học và bài làm: truy vấn gần như luôn theo tenant và học sinh nên có đích, còn userId đủ nhiều giá trị để tenant lớn tách ra nhiều chunk."

Điểm ăn điểm:
- Sửa đúng ngộ nhận "replica giảm khóa".
- Nghĩ tới read-your-writes ngay khi nói replica.
- Chọn shard key bằng cách nói ra từng phương án và chỗ hỏng của nó.

#### Câu hỏi vặn
- **"Ở dự án, anh trực tiếp làm phần nào của replication và sharding?"** "Replication và cụm MongoDB do DevOps dựng. Tôi viết phần tách đọc/ghi trong code, quy tắc đọc ngay sau khi ghi thì đi primary; với MongoDB tôi tham gia chọn shard key và rà để mọi truy vấn đều kèm tenantId." Ranh giới này quan trọng hơn mọi chi tiết kỹ thuật.
- **"Con số giảm độ trễ ghi đó đo thế nào?"** "p95 thời gian ghi trên primary từ APM, đối chiếu với `pg_stat_statements`, so cùng khung giờ cao điểm trước và sau khi chuyển đọc báo cáo sang replica: giảm khoảng một phần ba. API báo cáo thì p95 giảm khoảng một nửa."
- **"Replication lag gây lỗi gì và xử lý thế nào?"** Read-your-writes: người dùng không thấy dữ liệu vừa ghi. Đọc primary ngay sau khi ghi, chờ replica tới vị trí WAL của lần ghi, hoặc dùng `remote_apply` cho luồng cần nhất quán.
- **"Vì sao chuyển đọc sang replica làm primary ghi nhanh hơn?"** Primary bớt tranh CPU, I/O, bộ nhớ đệm với truy vấn quét lớn, và không còn transaction dài cản vacuum. Không phải vì khóa, vì MVCC không cho người đọc chặn người ghi.
- **"Chọn shard key cho collection nhiều tenant thế nào?"** `{ tenantId: 1, _id: "hashed" }`: truy vấn theo tenant có đích, tenant lớn vẫn rải đều. Tránh chỉ dùng `tenantId` (jumbo chunk) và khóa tăng dần (điểm nóng). Ở IAS chúng tôi dùng `{ tenantId: 1, userId: 1 }` vì truy vấn dữ liệu học và bài làm gần như luôn theo tenant và học sinh; userId nhiều giá trị nên tenant lớn vẫn tách được thành nhiều chunk.
- **"Truy vấn báo cáo trên replica bị hủy giữa chừng, vì sao?"** Xung đột với recovery: primary đã dọn dòng mà truy vấn cần. Tăng `max_standby_streaming_delay` hoặc bật `hot_standby_feedback`, mỗi cách có giá riêng.

#### Bẫy cần tránh
- Nói "replica giảm khóa trên primary".
- Đọc mọi thứ từ replica, kể cả ngay sau khi ghi.
- Shard chỉ bằng `tenantId` khi có tenant lớn.
- Nhận cả việc dựng replication và cụm shard; phần đó DevOps làm.

#### Nhớ nhanh
- Replica giải bài toán đọc, sharding giải bài toán dữ liệu và ghi.
- Streaming replication mặc định bất đồng bộ; đo lag bằng `pg_stat_replication`.
- Read-your-writes: đọc primary sau khi ghi hoặc chờ replica bắt kịp.
- Shard key `{ tenantId: 1, _id: "hashed" }` hoặc như IAS `{ tenantId: 1, userId: 1 }`; tránh jumbo chunk, điểm nóng, scatter-gather.
- IAS: replica cho báo cáo, p95 ghi trên primary giảm khoảng một phần ba (APM, `pg_stat_statements`).

#### Bài tập
1. API "lưu hồ sơ rồi chuyển tới trang xem hồ sơ" đọc từ replica; thỉnh thoảng người dùng thấy dữ liệu cũ. Đề xuất hai cách sửa và đánh đổi.
   **Đáp án:** (1) Đọc primary trong vài giây sau khi ghi: đơn giản, primary thêm chút tải. (2) Trả vị trí WAL sau khi ghi, chỉ đọc replica khi `pg_last_wal_replay_lsn()` đã vượt vị trí đó, nếu không thì đọc primary: chính xác hơn, phức tạp hơn.
2. Collection `submissions` có `tenantId`, `examId`, `createdAt`; ba tenant chiếm 70% dữ liệu. Đánh giá ba shard key: `{ createdAt: 1 }`, `{ tenantId: 1 }`, `{ tenantId: 1, _id: "hashed" }`.
   **Đáp án:** `createdAt` tăng dần: mọi lần ghi vào một chunk (điểm nóng). `tenantId`: ba tenant lớn thành jumbo chunk. Khóa ghép có băm: rải đều, truy vấn theo tenant vẫn có đích.

### Bài 8.3. Nhất quán dữ liệu qua message: outbox, idempotent và saga

#### Kiến thức

##### Dual-write problem
Đoạn code "ghi database rồi publish message" có hai thao tác trên hai hệ thống không chung transaction. Ghi database xong, process chết trước khi publish: dữ liệu có, event mất. Publish trước, ghi database lỗi: event có, dữ liệu không. Retry không cứu được vì không biết bước nào đã xong.

##### Transactional outbox
Ghi dữ liệu nghiệp vụ và một dòng vào bảng outbox **trong cùng một transaction**. Một relay đọc outbox và publish ra RabbitMQ (bằng polling, hoặc CDC đọc WAL). Có dữ liệu thì chắc chắn có event.

```sql
CREATE TABLE outbox_message (
  id uuid PRIMARY KEY, type text NOT NULL, payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz NULL
);
CREATE INDEX ix_outbox_pending ON outbox_message (occurred_at) WHERE published_at IS NULL;

-- Relay: nhiều instance chạy song song không lấy trùng lô nhờ SKIP LOCKED
BEGIN;
SELECT id, type, payload FROM outbox_message
WHERE published_at IS NULL ORDER BY occurred_at LIMIT 100
FOR UPDATE SKIP LOCKED;
-- publish lên RabbitMQ, chờ publisher confirm
UPDATE outbox_message SET published_at = now() WHERE id = ANY(@ids);
COMMIT;
```

Outbox cho **ít nhất một lần** (at-least-once), không phải đúng một lần: relay có thể publish xong rồi chết trước khi đánh dấu, lần sau publish lại. Vì vậy phía nhận bắt buộc phải idempotent.

> **Ví dụ:** Ở VTC, trong dịch vụ theo dõi tiến độ học, dòng outbox cho sự kiện "bắt đầu lượt làm bài" được ghi sau khi lưu lượt làm bài, không chung transaction: lượt làm bài đã lưu nhưng event vẫn có thể mất. Cách sửa là đưa lệnh ghi outbox vào cùng transaction. Đây là code bạn đã đọc và hiểu, không phải bạn viết; kể đúng mức đó.

##### Phía nhận idempotent: chặn xử lý trùng
Ba lớp phòng thủ, mỗi lớp chặn một kiểu trùng khác nhau:
1. **Idempotency key ở API:** client gửi kèm một khóa; request lặp lại nhận lại kết quả cũ.
2. **Inbox ở consumer:** bảng ghi `message_id` đã xử lý, insert cùng transaction với thay đổi nghiệp vụ; trùng khóa thì bỏ qua.
3. **Unique constraint nghiệp vụ:** người dùng bấm hai lần tạo hai command khác `message_id`, nhưng database vẫn chặn.

```sql
ALTER TABLE enrollment ADD CONSTRAINT uq_enrollment UNIQUE (tenant_id, student_id, course_id);

INSERT INTO enrollment (id, tenant_id, student_id, course_id, status)
VALUES (@id, @tenant, @student, @course, 'Pending')
ON CONFLICT (tenant_id, student_id, course_id) DO NOTHING
RETURNING id;  -- không trả dòng nào nghĩa là đã đăng ký rồi
```

##### Saga cho luồng nhiều bước
Đăng ký khóa học có thể gồm: giữ chỗ, mở quyền học, gửi email, mỗi bước ở một service. Không có transaction phân tán, nên saga là chuỗi transaction cục bộ, mỗi bước có **hành động bù trừ** chạy khi bước sau thất bại (ví dụ nhả chỗ đã giữ).

- **Orchestration:** một state machine trung tâm gửi command và nhận event. Dễ theo dõi, có chỗ đặt timeout; đổi lại có một thành phần trung tâm.
- **Choreography:** mỗi service phản ứng với event của service khác. Ít phụ thuộc, nhưng khó nhìn toàn luồng khi quá ba bốn bước.

Khung orchestration với MassTransit (rút gọn):

```csharp
public class EnrollmentStateMachine : MassTransitStateMachine<EnrollmentState>
{
    // khai báo State (SeatReserving, Provisioning, Completed, Failed) và Event<...> tương ứng
    public EnrollmentStateMachine()
    {
        InstanceState(x => x.CurrentState);
        Initially(When(Submitted)
            .Then(c => { c.Saga.StudentId = c.Message.StudentId; c.Saga.CourseId = c.Message.CourseId; })
            .Publish(c => new ReserveSeat(c.Saga.CorrelationId, c.Saga.CourseId))
            .TransitionTo(SeatReserving));
        During(SeatReserving,
            When(SeatReserved)
                .Publish(c => new ProvisionAccess(c.Saga.CorrelationId, c.Saga.StudentId, c.Saga.CourseId))
                .TransitionTo(Provisioning),
            When(SeatUnavailable).TransitionTo(Failed));
        During(Provisioning,
            When(Provisioned).TransitionTo(Completed),
            When(ProvisionFailed)
                .Publish(c => new ReleaseSeat(c.Saga.CorrelationId, c.Saga.CourseId)) // bù trừ
                .TransitionTo(Failed));
    }
}
```

MassTransit có sẵn outbox gắn với Entity Framework (`AddEntityFrameworkOutbox` cùng `UseBusOutbox`): message publish trong scope được ghi vào bảng outbox và commit cùng `SaveChanges`. Bước không phản hồi thì dùng `Schedule` để đặt timeout, nếu không saga treo mãi. Kiểm tra giấy phép phiên bản đang dùng: bản 8 là mã nguồn mở, các bản sau chuyển sang mô hình giấy phép thương mại.

Phía RabbitMQ cần publisher confirms, quorum queue và dead-letter. Trên giao diện, trả "đang xử lý" ngay khi nhận đăng ký rồi cập nhật trạng thái sau.

#### Cách show off
Đã làm: ở IAS 2.0 bạn tham gia chuyển các tích hợp đồng bộ sang event qua RabbitMQ, consumer ack thủ công, prefetch nhỏ, dead-letter sau vài lần retry, idempotent theo message id. Phần **chưa triển khai**: transactional outbox và saga. Kể phần đã làm, nhận một câu phần chưa làm, rồi cho thấy bạn hiểu chỗ dễ sai nhất.

> **Ví dụ:** "Ở IAS 2.0, phần tôi tham gia là chuyển các tích hợp gọi đồng bộ sang event qua RabbitMQ, để một service chậm không kéo cả chuỗi chậm theo. Consumer ack thủ công, prefetch khoảng 10–20 để một consumer không ôm quá nhiều message, lỗi sau vài lần retry thì vào dead-letter, và xử lý idempotent theo message id. Outbox và saga thì tôi chưa triển khai ở dự án đó. Nếu làm, điều đầu tiên tôi đảm bảo là ghi outbox cùng transaction với dữ liệu nghiệp vụ, vì ghi rồi mới publish thì sớm muộn sẽ mất event. Outbox chỉ cho ít nhất một lần, nên phía nhận phải idempotent: inbox theo message id, cộng unique constraint trên tenant, học viên, khóa học để chặn đăng ký trùng tận gốc. Luồng nhiều bước thì tôi chọn saga có điều phối trung tâm, mỗi bước có bù trừ và timeout."

Điểm ăn điểm:
- Giải thích dual-write bằng một kịch bản process chết, không chỉ nêu tên.
- Nói outbox là at-least-once; "đúng một lần" về hiệu ứng đến từ phía nhận idempotent.
- Biết inbox theo `message_id` là chưa đủ, cần unique constraint nghiệp vụ.

#### Câu hỏi vặn
- **"Ở dự án, outbox và saga là anh làm à?"** Không. Phần tôi làm là chuyển tích hợp đồng bộ sang event qua RabbitMQ, với consumer ack thủ công, dead-letter và idempotent theo message id. Outbox và saga tôi trình bày ở mức thiết kế, kèm cách đo: số dòng outbox chưa publish và tuổi dòng cũ nhất, cảnh báo khi vượt ngưỡng.
- **"Cấu hình consumer RabbitMQ ở IAS thế nào?"** Ack thủ công sau khi xử lý xong, prefetch khoảng 10–20, retry vài lần rồi đẩy sang dead-letter, consumer idempotent theo message id để message giao lại không làm sai dữ liệu.
- **"Vì sao cần outbox, publish ngay sau khi commit không được à?"** Publish sau commit có thể thất bại (process chết, broker lỗi) làm mất event mà không ai biết. Ghi outbox cùng transaction bảo đảm có dữ liệu thì có event; relay publish sau.
- **"Outbox có bảo đảm đúng một lần không?"** Không; relay có thể publish lại. Hiệu ứng đúng một lần cần phía nhận idempotent: inbox theo `message_id` cộng unique constraint nghiệp vụ.
- **"Làm sao hết đăng ký trùng khi client retry?"** Ba lớp: idempotency key ở API, inbox ở consumer, unique constraint `(tenant_id, student_id, course_id)` với `ON CONFLICT DO NOTHING` ở database.
- **"Orchestration và choreography chọn khi nào?"** Orchestration khi luồng nhiều bước, cần timeout và bù trừ rõ, cần nhìn trạng thái từng instance. Choreography khi luồng ngắn, ít bước, muốn các service độc lập.
- **"Một bước giữa saga thất bại thì sao?"** Chạy bù trừ cho các bước đã xong theo thứ tự ngược (ví dụ nhả chỗ đã giữ), chuyển saga sang Failed, báo người dùng. Bước không phản hồi thì timeout kích hoạt bù trừ.
- **"Nhiều instance relay cùng chạy có publish trùng không?"** `FOR UPDATE SKIP LOCKED` giúp mỗi instance lấy một lô khác nhau, nhưng vẫn có thể trùng khi chết giữa publish và đánh dấu. Vì vậy phía nhận vẫn phải idempotent.

#### Bẫy cần tránh
- Nói outbox cho "exactly-once", hoặc ghi outbox ngoài transaction nghiệp vụ.
- Chỉ dựa vào inbox theo `message_id` mà không có unique constraint nghiệp vụ.
- Saga không có timeout.
- Nhận đã dùng saga MassTransit khi chưa dùng.

#### Nhớ nhanh
- Đã làm: tích hợp đồng bộ sang RabbitMQ, ack thủ công, prefetch 10–20, dead-letter, idempotent theo message id. Outbox, saga: chưa triển khai, nói thiết kế.
- Outbox cùng transaction, relay at-least-once.
- Idempotent ba lớp: idempotency key, inbox, unique constraint nghiệp vụ.
- Saga: orchestration hoặc choreography, luôn có bù trừ và timeout; giao diện hiển thị "đang xử lý".

#### Bài tập
1. Viết luồng xử lý `EnrollmentSubmitted` ở consumer sao cho message lặp lại không tạo bản ghi thứ hai, trong một transaction.
   **Đáp án:** Mở transaction → insert `inbox_message(message_id, consumer)`, trùng khóa thì rollback và ack → insert `enrollment ... ON CONFLICT DO NOTHING` → nếu tạo mới thì insert outbox `EnrollmentCreated` → commit → ack message.
2. Saga đăng ký có ba bước: giữ chỗ, mở quyền học, gửi email. Bước nào cần bù trừ?
   **Đáp án:** Giữ chỗ (nhả chỗ) và mở quyền học (thu hồi) nếu sau nó còn bước có thể thất bại; gửi email là bước cuối, chỉ retry. Timeout đặt sau mỗi command chờ phản hồi.
