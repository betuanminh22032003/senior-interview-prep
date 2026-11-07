# Phần III. Bảo vệ CV: AvePoint

Phần này đi qua từng dòng CV ở AvePoint Vietnam (MaivenPoint EdTech), vai trò Team Lead, 01/2023 – 03/2026, gồm hai dự án: Examena (nền tảng thi trực tuyến có giám sát video) và IAS 2.0 (chuyển đổi nền tảng giáo dục). Khác với phần VTC, dữ liệu AvePoint **không có bằng chứng đối chiếu** (không có commit, báo cáo hay dashboard để mở ra cho interviewer xem). Vì vậy giáo trình chỉ nói ở mức thiết kế cho những phần chưa xác nhận (nguồn: mục 13).

Mỗi bài ghi rõ trạng thái: **Thật** (bạn đã xác nhận), **Một phần** (cốt lõi thật, số liệu hoặc phạm vi là minh họa), **Minh họa** (chưa làm). Với phần minh họa, chỉ có ba cách an toàn: làm thật rồi mới giữ trên CV, bỏ khỏi CV khi nộp, hoặc nói đúng: "phần này tôi chưa triển khai; nếu làm, tôi sẽ…" kèm câu trả lời theo best practice. Không dùng dòng minh họa làm câu chuyện STAR.

## Chương 7. Examena: nền tảng thi có giám sát video

Examena là sản phẩm thi trực tuyến kèm giám sát trực tiếp (live proctoring): thí sinh làm bài trên trình duyệt, camera được truyền tới giám thị, AI hỗ trợ gắn cờ hành vi nghi gian lận. Đây là phần "Team Lead" của CV, nên interviewer sẽ hỏi cả hai chiều: kỹ thuật (WebRTC, SFU, load test, GitOps, bảo mật) và dẫn dắt (phân việc, phối hợp, tuyển người, vận hành ngày thi).

Học xong chương này, bạn tách được rõ phần đã làm thật (dẫn team 8 người tới kỳ thi 3.000+ thí sinh, SFU thay mesh, có tích hợp AI, chuỗi Docker/Helm/Terraform/GitLab CI/Argo CD) với phần minh họa, và trả lời được câu hỏi kỹ thuật sâu cho từng dòng mà không nhận việc mình chưa làm.

### Bài 7.1. Dẫn team 8 người tới kỳ thi 3.000+ thí sinh
**Dòng CV:** "Led an 8-person Scrum team that took Examena from design to live exams with 3,000+ concurrent candidates, owning system design, sprint planning, code review, and releases."
**Trạng thái:** Thật. Bạn đã xác nhận dẫn team 8 người đưa Examena tới kỳ thi 3.000+ thí sinh đồng thời (nguồn: C5). Chữ "Scrum" và "sprint planning" chỉ giữ nếu team thật sự chạy Scrum; cơ cấu vai trò (BE, FE, QA…) không ghi trên CV vì chưa có dữ liệu, bị hỏi thì trả lời đúng thực tế.

#### Mục tiêu
- Sau bài này, bạn kể được vai trò lead theo 4 trục interviewer hay đào: quyết định kiến trúc, phân việc, phối hợp, xử lý trễ hạn.
- Bạn trình bày được mỗi quyết định kiến trúc theo khung vấn đề → phương án → chọn gì → đánh đổi.
- Bạn nói được Scrum theo sách và chỉ ra team mình làm khác sách ở đâu.

#### Bối cảnh và việc thật đã làm
- Vai trò: Team Lead, AvePoint Vietnam (MaivenPoint EdTech), dự án Examena.
- Kết quả đã xác nhận: team 8 người, đưa sản phẩm từ thiết kế tới kỳ thi thật với hơn 3.000 thí sinh đồng thời.
- CV ghi bạn chịu trách nhiệm system design, sprint planning, code review và release. Mỗi việc phải có **một ví dụ cụ thể của chính bạn**: một quyết định thiết kế, một lần chia lại việc, một PR đã chặn và lý do, một lần release có vấn đề (nguồn: C5). Giáo trình không có các ví dụ này; bạn tự chuẩn bị từ trí nhớ thật.

#### Kiến thức nền: "lead end to end" nghĩa là gì
**Quyết định kiến trúc.** Ba quyết định trong chương này là xương sống câu chuyện:

| Quyết định | Vấn đề | Đánh đổi chấp nhận |
|---|---|---|
| SFU thay mesh (Bài 7.2) | Mesh bắt thí sinh mã hóa và gửi một luồng cho mỗi người xem | Phải vận hành media server, tốn băng thông server |
| AI ngoài luồng video (Bài 7.3) | Inference chậm không được làm giật video của giám thị | Cờ gian lận đến trễ vài giây, cần người duyệt |
| GitOps (Bài 7.5) | Deploy thủ công khó tái lập, khó rollback | Thêm một repo cấu hình và một công cụ (Argo CD) phải vận hành |

**Phân việc theo best practice.** Chia theo thành phần có người chịu trách nhiệm rõ (ownership): signaling, media server, API thi, frontend, AI, hạ tầng. Việc rủi ro cao giao cho người có kinh nghiệm, kèm một người học cùng để không phụ thuộc một người (bus factor). Mỗi thành phần có một người review chính và một người review dự phòng.

**Phối hợp.** Product chốt phạm vi ở planning và xem demo ở review; QA có test plan riêng cho từng kỳ thi của khách hàng; DevOps theo checklist release. Lead chịu trách nhiệm cái "giữa các ô": giao diện giữa signaling và media server, hợp đồng API giữa frontend và backend.

**Scrum tối thiểu phải nói được.** Sprint 1–2 tuần; bốn sự kiện planning, daily, review, retro; backlog do product owner sắp ưu tiên; ước lượng bằng story point hoặc thời gian; definition of done (code review xong, test xong, deploy được lên staging). Burndown cho thấy sprint đang lệch kế hoạch. Interviewer senior thích nghe bạn nói thật chỗ team làm khác sách (ví dụ: sprint bị cắt ngang bởi kỳ thi của khách hàng) hơn là đọc lại Scrum Guide.

**Khung kể một lần trễ hạn** (dùng câu chuyện thật của bạn, đây chỉ là khung): phát hiện sớm qua burndown hoặc daily → ngồi với product cắt phạm vi, giữ luồng thi chính → báo sớm cho khách hàng kèm mốc mới → retro sửa cách ước lượng. Điểm interviewer chấm: bạn báo xấu sớm hay muộn, và bạn cắt phạm vi hay bắt team làm thêm giờ.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Ở AvePoint tôi là Team Lead của Examena, team 8 người, đưa sản phẩm từ thiết kế tới kỳ thi thật hơn 3.000 thí sinh đồng thời. Tôi chịu trách nhiệm thiết kế hệ thống, chia việc, review code và release. Ba quyết định lớn tôi tham gia là dùng SFU thay mesh cho video, tách AI chống gian lận khỏi luồng video, và chuyển delivery sang GitOps. Ví dụ cụ thể về một lần chia lại việc là…" (điền câu chuyện thật).

Nếu team không chạy Scrum đúng nghĩa, nói "team làm theo sprint 2 tuần, có planning và demo, nhưng không có Scrum Master riêng" thay vì nhận "Scrum team".

#### Bẫy
- Kể "chúng tôi" suốt câu chuyện: interviewer không biết phần nào là của bạn. Tách rõ "tôi quyết định", "đồng nghiệp làm".
- Bịa cơ cấu vai trò hay một sự cố trễ hạn cho tròn câu chuyện. Không có thì nói chưa nhớ chi tiết, chuyển sang quyết định bạn nhớ rõ.
- Nhận các dòng minh họa (k6, pentest, 40+ kỳ thi) làm ví dụ cho trục "lead".

#### Câu hỏi phỏng vấn
- **"Bạn đã quyết định những gì về kiến trúc, và đánh đổi của từng quyết định là gì?"** SFU thay mesh (đổi lấy việc vận hành media server), AI chạy bất đồng bộ ngoài luồng video (đổi lấy cờ đến trễ và cần người duyệt), GitOps (đổi lấy thêm repo cấu hình và Argo CD). Mỗi ý nói theo khung vấn đề → phương án → chọn gì → đánh đổi.
- **"Bạn chia việc cho 8 người thế nào?"** Theo thành phần có owner rõ (signaling, media, API thi, frontend, AI, hạ tầng); việc rủi ro cao giao người có kinh nghiệm kèm một người học cùng; mỗi phần có reviewer chính và dự phòng. Sau đó kể đúng cách chia thật của team.
- **"Kể một lần delivery bị trễ và bạn xử lý thế nào?"** Dùng câu chuyện thật theo khung: phát hiện sớm → cắt phạm vi cùng product → báo khách hàng kèm mốc mới → retro sửa ước lượng.
- **"Một PR bạn đã chặn lại, vì sao?"** Chuẩn bị một ví dụ thật; tiêu chí hay dùng: thiếu xử lý lỗi ở đường thi chính, thay đổi hợp đồng API không báo, không có cách rollback.
- **"Team bạn chạy Scrum khác sách ở chỗ nào?"** Trả lời theo thực tế; nếu không chạy Scrum thì nói thẳng và mô tả quy trình thật.

#### Tóm tắt
- Trạng thái Thật: team 8 người, kỳ thi 3.000+ thí sinh đồng thời.
- "Scrum", "sprint planning" chỉ giữ nếu đúng thực tế.
- Bốn trục phải kể: kiến trúc, phân việc, phối hợp, một lần trễ hạn; mỗi trục một ví dụ thật.
- Quyết định kiến trúc luôn kèm đánh đổi.

#### Bài tập
1. Viết ra giấy 4 ví dụ thật: một quyết định thiết kế, một lần chia lại việc, một PR đã chặn, một lần release có vấn đề. Mỗi ví dụ không quá 5 câu.
   **Đáp án:** Mỗi ví dụ cần đủ: bối cảnh, việc bạn làm (không phải "chúng tôi"), kết quả, điều rút ra. Ví dụ nào không nhớ rõ thì bỏ, không bịa.
2. Viết câu trả lời 45 giây cho "Kể về vai trò lead của bạn ở Examena", không dùng số liệu minh họa.
   **Đáp án:** Chỉ dùng: 8 người, 3.000+ thí sinh đồng thời, SFU thay mesh, AI ngoài luồng video, chuỗi GitOps; không nhắc 6 worker, 5.000 thí sinh k6, 14 lỗi pentest, 40+ kỳ thi.

### Bài 7.2. MediaSoup SFU thay cho mesh
**Dòng CV:** "Built live proctoring on a MediaSoup SFU instead of a peer-to-peer mesh, so each candidate uploads one stream however many proctors watch; 3,000+ candidates ran on 6 SFU workers."
**Trạng thái:** Một phần. Dùng MediaSoup SFU thay mesh là thật. "6 SFU workers" là minh họa: bạn không nhớ cấu hình worker (nguồn: C5). Khi bị hỏi số worker, trình bày cách ước lượng, không khẳng định con số.

#### Mục tiêu
- Sau bài này, bạn so sánh được mesh, MCU, SFU theo băng thông và CPU.
- Bạn mô tả được mô hình mediasoup: worker, router, transport, producer, consumer, và cách scale qua `pipeToRouter`.
- Bạn ước lượng được số worker và băng thông cho 3.000 thí sinh bằng giả định nói rõ ra.

#### Bối cảnh và việc thật đã làm
Examena cần giám thị xem camera thí sinh theo thời gian thực. Team chọn kiến trúc SFU trên MediaSoup thay vì mesh peer-to-peer. Phần thật dừng ở quyết định và kiến trúc này; cấu hình worker cụ thể bạn không nhớ.

#### Kiến thức nền: ba mô hình truyền video nhiều bên
- **Mesh:** mỗi peer nối trực tiếp với từng peer khác. Thí sinh có N người xem thì mã hóa và upload N luồng. Không cần server media, nhưng CPU và uplink của máy thí sinh tăng tuyến tính, không ghi hình hay chạy AI phía server được.
- **MCU (Multipoint Control Unit):** server giải mã mọi luồng, trộn thành một hình ghép rồi mã hóa lại. Client nhẹ, nhưng server tốn CPU cực lớn và mất linh hoạt (mọi người nhận cùng một bố cục).
- **SFU (Selective Forwarding Unit):** server không giải mã, chỉ chuyển tiếp gói RTP đã mã hóa tới người cần nhận. Thí sinh upload đúng 1 luồng; server tốn băng thông, rất ít CPU so với MCU.

Với proctoring, lợi ích của SFU không chỉ là upload: server nằm giữa nên có thể ghi hình, lấy mẫu khung cho AI, chọn lớp chất lượng cho từng giám thị, và tập trung việc vượt NAT ở một chỗ.

#### Kiến thức nền: mô hình mediasoup
mediasoup là thư viện Node.js điều khiển các process C++. Signaling (trao đổi tham số giữa client và server) do ứng dụng tự làm, thường qua WebSocket.

- **Worker:** một process C++ đơn luồng, nên tạo số worker bằng số CPU core. Worker chết phải được phát hiện (`worker.on('died')`) và tạo lại.
- **Router:** nằm trong một worker, tương đương một "phòng"; producer và consumer chỉ gặp nhau trong cùng router. Thường mỗi phòng thi một router.
- **Transport:** đường đi của media. `WebRtcTransport` cho trình duyệt (ICE + DTLS-SRTP); `PlainTransport` cho RTP thường (ghi hình bằng FFmpeg/GStreamer); `PipeTransport` nối hai router; `WebRtcServer` cho nhiều transport dùng chung một cổng trong một worker.
- **Producer / Consumer:** thí sinh tạo producer (camera, micro, có thể cả màn hình); mỗi giám thị xem một luồng là một consumer.
- **Scale một phòng vượt một worker:** `router.pipeToRouter({ producerId, router: otherRouter })` nối producer sang router ở worker khác; giám thị ở router kia consume bình thường.

```javascript
const os = require('os');
const mediasoup = require('mediasoup');

const workers = [];
for (let i = 0; i < os.cpus().length; i++) {
  const w = await mediasoup.createWorker({ rtcMinPort: 40000, rtcMaxPort: 49999 });
  w.on('died', () => { /* báo động, tạo lại worker, chuyển phòng */ });
  workers.push(w);
}

const router = await workers[roomIndex % workers.length].createRouter({ mediaCodecs });

// Giám thị nhận luồng của thí sinh
if (router.canConsume({ producerId, rtpCapabilities })) {
  const consumer = await recvTransport.consume({ producerId, rtpCapabilities, paused: true });
  // gửi consumer.rtpParameters cho client, client sẵn sàng thì:
  await consumer.resume();
  // lưới nhiều ô: nhận lớp thấp nhất
  await consumer.setPreferredLayers({ spatialLayer: 0, temporalLayer: 2 });
}
```

Consumer tạo ở trạng thái `paused` rồi mới `resume` là khuyến nghị chuẩn để client kịp gắn track, tránh mất keyframe đầu.

**Simulcast và SVC.** Simulcast: thí sinh gửi cùng lúc 2–3 bản mã hóa ở độ phân giải khác nhau; SFU chọn bản phù hợp cho từng consumer. SVC (VP9, AV1): một luồng có nhiều lớp, SFU bỏ bớt lớp. Giám thị xem lưới 25 ô nhận lớp thấp, phóng to một thí sinh thì đổi lên lớp cao.

**Vượt NAT và bảo mật.** mediasoup là ICE-lite: không tự đi tìm đường mà chờ client kết nối tới. Mạng chặn UDP thì cần TURN (ví dụ coturn), tốt nhất TURN qua TLS cổng 443. Media luôn mã hóa bằng DTLS-SRTP: bắt tay DTLS sinh khóa cho SRTP.

#### Ước lượng số worker và băng thông
Giả định nói thành lời: 3.000 thí sinh, mỗi thí sinh 1 luồng video, mỗi luồng 1 người xem (giám thị), tài liệu mediasoup cho biết một worker thường chịu khoảng 500 consumer tùy CPU.

| Đại lượng | Cách tính | Kết quả |
|---|---|---|
| Consumer video | 3.000 × 1 người xem | 3.000 |
| Worker tối thiểu | 3.000 / 500 | 6, chưa tính dư phòng |
| Nếu thêm audio | producer × 2 | khoảng 6.000 consumer, 12 worker |
| Băng thông vào SFU | 3.000 × 300–500 kbps | khoảng 0,9–1,5 Gbps |
| Tải xuống một giám thị | 25 ô × 150 kbps lớp thấp | khoảng 3,75 Mbps |

Thêm ghi hình hoặc AI lấy mẫu phía server thì mỗi thứ là thêm một consumer cho mỗi thí sinh. Dư phòng 30–50% để một worker chết không làm sập phòng.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Chúng tôi dùng SFU trên mediasoup thay mesh, để mỗi thí sinh chỉ gửi một luồng, server lo chuyển tiếp, ghi hình và chọn chất lượng cho giám thị. Số worker cụ thể tôi không còn nhớ; cách tôi ước lượng là đếm consumer: khoảng 500 consumer mỗi worker, 3.000 thí sinh một người xem thì cần ít nhất 6 worker, cộng dư phòng."

#### Bẫy
- Khẳng định "6 worker" như số đo thật. Nói cách tính, không nói con số như sự kiện.
- Nói "SFU giải mã video": sai, SFU chỉ chuyển tiếp gói đã mã hóa.
- Quên rằng mỗi giám thị, bản ghi, AI phía server đều là consumer riêng.
- Lẫn worker (process) với router (phòng).

#### Câu hỏi phỏng vấn
- **"SFU, MCU, mesh khác nhau thế nào?"** Mesh: mỗi peer gửi N luồng, không scale. MCU: server trộn hình, tốn CPU, mất linh hoạt. SFU: server chỉ chuyển tiếp, mỗi thí sinh gửi 1 luồng.
- **"Thí sinh rớt mạng thì sao?"** Client phát hiện qua trạng thái ICE/DTLS, gọi ICE restart (`transport.restartIce()` trả `iceParameters` mới) hoặc tạo lại transport và producer; giám thị thấy trạng thái mất kết nối; mọi lần rớt được ghi log gắn với phiên thi để hội đồng xem lại.
- **"Ghi hình thế nào?"** Tạo `PlainTransport`, consume luồng của thí sinh lên đó, đẩy RTP sang FFmpeg hoặc GStreamer kèm file SDP mô tả codec để ghi file; bản ghi là thêm một consumer cho mỗi thí sinh.
- **"Nếu mỗi thí sinh chỉ có một giám thị xem thì mesh cũng chỉ upload một luồng, vì sao vẫn cần SFU?"** Vì giám thị xem 20–30 người: với mesh, trình duyệt giám thị giữ 20–30 peer connection và không chọn được lớp thấp; còn ghi hình, AI phía server, giám sát cấp cao hay vượt NAT tập trung đều cần một điểm ở giữa.
- **"Một phòng thi lớn hơn sức một worker thì làm gì?"** Dùng `pipeToRouter` nối producer sang router ở worker khác; giám thị nằm ở router kia vẫn consume được. Khác máy thì tự dựng `PipeTransport` giữa hai host.
- **"Bạn cấu hình bao nhiêu worker?"** Không nhớ con số thật; trình bày cách ước lượng theo số consumer và dư phòng.

#### Tóm tắt
- SFU chuyển tiếp, không giải mã; thí sinh upload một luồng.
- Worker = process C++ một core; router = phòng; producer gửi, consumer nhận.
- Scale qua `pipeToRouter`; giám thị xem lưới dùng simulcast lớp thấp.
- Số worker ước lượng theo consumer (khoảng 500 mỗi worker), không nhận "6 worker" là số thật.

#### Bài tập
1. Tính số worker và băng thông vào SFU cho 5.000 thí sinh, mỗi thí sinh gửi video + audio, mỗi luồng có 1 giám thị và 1 bản ghi, giả định 500 consumer mỗi worker, video 400 kbps, audio 32 kbps.
   **Đáp án:** Consumer = 5.000 × 2 luồng × 2 người nhận = 20.000 → 40 worker, cộng dư phòng khoảng 52–60. Vào SFU = 5.000 × 432 kbps ≈ 2,16 Gbps.
2. Vẽ sơ đồ luồng signaling khi một giám thị bắt đầu xem một thí sinh: client lấy `routerRtpCapabilities`, tạo recv transport, `connect`, `consume`, `resume`.
   **Đáp án:** Client `device.load(routerRtpCapabilities)` → server `createWebRtcTransport` trả ICE/DTLS params → client `transport.connect(dtlsParameters)` → server `consume(paused: true)` → client tạo track → server `consumer.resume()`.

### Bài 7.3. AI chống gian lận nằm ngoài luồng video
**Dòng CV:** "Kept AI cheating detection off the video path: inference samples 2 frames/s per candidate and flags go through a queue to reviewers, holding proctor video latency under 300 ms."
**Trạng thái:** Một phần. Có tích hợp AI chống gian lận là thật. "2 khung/s" và "< 300 ms" là minh họa. Câu trả lời về model chạy ở đâu, lấy mẫu bao nhiêu, tối ưu gì là theo best practice (nguồn: C5, D3.3).

#### Mục tiêu
- Sau bài này, bạn giải thích được vì sao AI phải nằm ngoài đường đi của video.
- Bạn trình bày được thiết kế lai client + server và cách tính tải inference.
- Bạn phân biệt được độ trễ video với độ trễ cờ gian lận và biết cách đo từng cái.

#### Bối cảnh và việc thật đã làm
Examena có tích hợp AI hỗ trợ phát hiện gian lận. Chi tiết model, tần suất lấy mẫu và số đo độ trễ không có dữ liệu xác nhận; phần dưới là thiết kế theo best practice để bạn nói ở mức thiết kế.

#### Kiến thức nền: "ngoài luồng video" nghĩa là gì
Đường video là thí sinh → SFU → giám thị. Nếu chèn model vào giữa (giải mã, chạy model, mã hóa lại), mọi lần model chậm là video giật. Thiết kế đúng: video đi thẳng; AI nhận **bản sao** khung hình, chạy bất đồng bộ, kết quả là **sự kiện** đi qua hàng đợi tới người duyệt. Model chậm thì cờ đến trễ vài giây, video không bị ảnh hưởng.

**Thiết kế lai theo best practice:**
- **Client:** model nhẹ phát hiện khuôn mặt (ví dụ MediaPipe hoặc TensorFlow.js) chạy trong Web Worker hoặc trên GPU qua WebGL, đầu vào thu nhỏ (ví dụ 320×240), bỏ khung khi CPU bận, không chạy chung luồng với mã hóa video. Client chỉ gửi sự kiện (không có mặt, nhiều mặt, rời tab), không gửi thêm video. Rẻ cho server nhưng phụ thuộc máy thí sinh và có thể bị can thiệp.
- **Server:** lấy khung từ SFU (consumer trên `PlainTransport` → giải mã) hoặc ảnh chụp client gửi; chạy model nặng hơn để xác minh thí sinh đã bị gắn cờ. Tốn GPU nhưng kiểm soát được.
- **Người duyệt:** mọi cờ vào hàng đợi review và audit log; không tự động xử lý thí sinh vì báo động giả luôn có.

Tín hiệu hay dùng: không có mặt, nhiều khuôn mặt, nhìn ra ngoài lâu, có điện thoại, rời tab hoặc thoát toàn màn hình (sự kiện trình duyệt).

#### Tính tải và chống quá tải
Lấy mẫu 2 khung/s cho mọi thí sinh: 3.000 × 2 = 6.000 lần inference mỗi giây phía server. Thiết kế lai chỉ xác minh phía server cho khoảng 10% thí sinh đang bị cờ: 300 × 2 = 600 lần/s, giảm 10 lần. Đây là số ước lượng để chọn kiến trúc, không phải số đo.

Hàng đợi giữa bộ lấy mẫu và worker inference phải **có giới hạn** và được phép bỏ khung cũ: khung hình cách đây 10 giây không còn giá trị.

```csharp
var frames = Channel.CreateBounded<FrameSample>(new BoundedChannelOptions(1_000)
{
    FullMode = BoundedChannelFullMode.DropOldest, // quá tải thì bỏ khung cũ
    SingleReader = false
});

// Worker inference
await foreach (var f in frames.Reader.ReadAllAsync(ct))
{
    var result = await detector.DetectAsync(f.Image, ct);
    if (result.IsSuspicious)
        await bus.Publish(new CheatingFlagRaised(f.SessionId, result.Kind, f.CapturedAt), ct);
}
```

Theo dõi tuổi khung (`now - CapturedAt`) như một SLI: tuổi tăng nghĩa là inference không theo kịp.

#### Đo độ trễ video
Độ trễ video giám thị đo bằng WebRTC `getStats()`: `roundTripTime` của candidate pair, `jitterBufferDelay / jitterBufferEmittedCount` phía nhận. Độ trễ cờ là `thời điểm cờ tới người duyệt - CapturedAt`. Hai số này độc lập; đó chính là ý nghĩa của "ngoài luồng video".

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Examena có tích hợp AI hỗ trợ phát hiện gian lận, nguyên tắc là AI không nằm trên đường đi của video: video đi thẳng qua SFU tới giám thị, AI xử lý bản sao bất đồng bộ, cờ đi qua hàng đợi tới người duyệt. Thông số lấy mẫu và độ trễ cụ thể tôi không có số đo để chia sẻ; nếu thiết kế lại, theo best practice tôi sẽ chạy model nhẹ ở client và chỉ xác minh phía server cho thí sinh bị gắn cờ."

#### Bẫy
- Đọc "2 khung/s" và "< 300 ms" như số đo thật.
- Cho AI tự động đánh trượt thí sinh: luôn có người xác nhận.
- Hàng đợi không giới hạn: khi GPU chậm, bộ nhớ phình và cờ đến trễ hàng phút.
- Quên quyền riêng tư: cần đồng ý của thí sinh, thời hạn lưu ảnh, phân quyền xem bản ghi.

#### Câu hỏi phỏng vấn
- **"Model chạy ở đâu, client hay server?"** Theo best practice: lai. Client chạy model nhẹ cho tín hiệu tức thời, rẻ nhưng có thể bị can thiệp; server xác minh bằng model nặng hơn cho thí sinh bị cờ, tốn GPU nhưng tin được.
- **"Lấy mẫu bao nhiêu khung mỗi giây và vì sao?"** 1–2 khung/s là đủ cho hành vi kéo dài vài giây (rời mắt, có người thứ hai); tính tải = số thí sinh × tần suất; chỉ lấy mẫu dày cho thí sinh đang bị cờ. Không nhận con số trên CV là số đo.
- **"Làm sao để AI không làm giật video?"** AI chỉ nhận bản sao, chạy bất đồng bộ; phía client chạy trong Web Worker hoặc WebGL, thu nhỏ đầu vào, bỏ khung khi CPU bận.
- **"GPU không theo kịp thì chuyện gì xảy ra?"** Hàng đợi có giới hạn bỏ khung cũ; cờ đến trễ hơn nhưng video không ảnh hưởng; cảnh báo khi tuổi khung vượt ngưỡng; scale thêm worker inference.
- **"Xử lý báo động giả thế nào?"** Cờ chỉ là gợi ý; người duyệt xem đoạn video quanh thời điểm cờ rồi mới quyết; theo dõi tỷ lệ cờ bị bác để chỉnh ngưỡng model.

#### Tóm tắt
- Video đi thẳng; AI xử lý bản sao, kết quả là sự kiện qua hàng đợi.
- Thiết kế lai: client rẻ, server tin được; luôn có người duyệt.
- Hàng đợi có giới hạn, bỏ khung cũ; đo tuổi khung.
- "2 khung/s", "< 300 ms" là minh họa.

#### Bài tập
1. Tính số lần inference mỗi giây phía server cho 3.000 thí sinh nếu: (a) lấy mẫu 1 khung/s cho mọi người; (b) chỉ lấy 2 khung/s cho 15% thí sinh bị cờ.
   **Đáp án:** (a) 3.000/s; (b) 450 × 2 = 900/s.
2. Liệt kê ba SLI cho hệ AI chống gian lận và ngưỡng cảnh báo hợp lý.
   **Đáp án:** Tuổi khung p95 (ví dụ > 10 s thì cảnh báo), độ dài hàng đợi review, tỷ lệ cờ bị người duyệt bác (tăng đột biến là model hoặc ngưỡng có vấn đề).

### Bài 7.4. Load test bằng k6 trước release
**Dòng CV:** "Made load testing a release gate after a pilot exam saturated signaling: k6 runs simulating 5,000 candidates on staging caught 3 capacity regressions before customer exams."
**Trạng thái:** Minh họa. Toàn bộ dòng chưa làm: không có sự cố pilot, không có lần chạy 5.000 thí sinh, không có 3 lỗi năng lực. Chỉ nói ở mức "chưa triển khai, nếu làm tôi sẽ…".

#### Mục tiêu
- Sau bài này, bạn chọn đúng executor k6 cho bài toán "mọi thí sinh vào thi cùng giờ".
- Bạn viết được script k6 có thresholds để test tự fail và dùng làm gate.
- Bạn nói được giới hạn của k6 với WebRTC và cách test media.

#### Kiến thức nền: mô hình tải đóng và mở
- **Mô hình đóng (closed):** số người dùng ảo (VU) cố định, mỗi VU làm xong mới làm tiếp. Server chậm thì tải tự giảm, che mất vấn đề. Executor: `constant-vus`, `ramping-vus`, `shared-iterations`, `per-vu-iterations`.
- **Mô hình mở (open):** số lần bắt đầu mỗi giây cố định, bất kể server phản hồi nhanh hay chậm, giống người thật bấm "vào thi" đúng 8:00. Executor: `constant-arrival-rate`, `ramping-arrival-rate`. Thiếu VU để giữ tốc độ thì k6 ghi metric `dropped_iterations`.

Kỳ thi có đặc điểm "đàn bò" (thundering herd): hàng nghìn người vào trong vài phút đầu. Dùng `ramping-arrival-rate` để dựng đỉnh này.

```javascript
import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';

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
    ws_connecting: ['p(95)<1000'],
    dropped_iterations: ['count<1'],
  },
};

export default function () {
  const res = http.post(`${__ENV.BASE}/api/exams/start`, JSON.stringify({ examId: 'demo' }),
    { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'start 200': (r) => r.status === 200 });

  ws.connect(`${__ENV.WS}/signaling`, {}, (socket) => {
    socket.on('open', () => socket.send(JSON.stringify({ type: 'join' })));
    socket.setTimeout(() => socket.close(), 30000);
  });
}
```

Threshold không đạt thì k6 thoát với mã lỗi khác 0 (99), nên CI tự đánh fail job: đó là "release gate".

#### Bẫy kỹ thuật: k6 không giả lập được media WebRTC
k6 test được HTTP và WebSocket signaling, nhưng không mã hóa và gửi video. Muốn test SFU phải dùng bot trình duyệt headless (Playwright hoặc Puppeteer với cờ Chrome `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`, có thể kèm `--use-file-for-fake-video-capture` để phát file `.y4m`) hoặc dịch vụ chuyên dụng. Mỗi trình duyệt tốn đáng kể CPU, nên vài trăm bot đã cần nhiều máy; thường test media ở quy mô nhỏ hơn rồi ngoại suy theo số consumer mỗi worker.

#### Dùng làm gate
- Chạy trên staging có cấu hình giống production (cùng số replica, cùng giới hạn tài nguyên) trước mỗi release lớn.
- Lưu kết quả mỗi lần chạy, so với lần trước: p95 tăng quá ngưỡng (ví dụ 20%) là suy giảm năng lực (capacity regression) dù chưa vượt threshold tuyệt đối.
- Dữ liệu test tách khỏi dữ liệu thật; dọn sau mỗi lần chạy.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Load test như trên CV tôi chưa triển khai, nên tôi không có số liệu để kể. Nếu làm, tôi dùng k6 với `ramping-arrival-rate` để dựng đỉnh vào thi đầu giờ, đặt thresholds cho p95 và tỷ lệ lỗi để CI tự fail, và test media riêng bằng bot trình duyệt vì k6 không gửi được video WebRTC."

#### Bẫy
- Kể "pilot exam saturated signaling" hay "3 regressions" như chuyện thật.
- Dùng `constant-vus` cho bài toán đỉnh tải: server chậm thì tải tự giảm, kết quả đẹp giả.
- Nói k6 test được toàn bộ hệ video.
- Load test từ một máy yếu: máy tạo tải nghẽn trước server.

#### Câu hỏi phỏng vấn
- **"Chọn executor nào trong k6 để giả lập giờ vào thi, vì sao?"** `ramping-arrival-rate` (mô hình mở): giữ tốc độ bắt đầu mỗi giây bất kể server chậm, đúng với người thật bấm vào thi cùng lúc; theo dõi `dropped_iterations` để biết k6 có đủ VU không.
- **"Làm sao để load test thành release gate?"** Thresholds (`p(95)<500`, `rate<0.01`) làm k6 thoát mã lỗi khi không đạt; chạy trong pipeline trên staging; so với lần chạy trước để bắt suy giảm. Nói rõ đây là thiết kế, chưa triển khai.
- **"k6 có test được WebRTC không?"** Không gửi được media; chỉ test HTTP và WebSocket signaling. Test media dùng bot trình duyệt headless với camera giả hoặc dịch vụ chuyên dụng.
- **"Kết quả load test trên staging có tin được cho production không?"** Chỉ khi staging giống production về số replica, giới hạn CPU/RAM, cấu hình DB và dữ liệu đủ lớn; khác ở đâu phải nói ra và ngoại suy thận trọng.

#### Tóm tắt
- Trạng thái Minh họa toàn bộ.
- Đỉnh vào thi dùng mô hình mở `ramping-arrival-rate`.
- Thresholds + mã thoát khác 0 = gate trong CI.
- k6 không test media WebRTC; dùng bot trình duyệt.

#### Bài tập
1. Viết `options` k6 cho kịch bản: trong 3 phút đầu tăng từ 0 lên 300 lượt vào thi mỗi giây, giữ 5 phút; fail nếu p99 > 1 s.
   **Đáp án:** `executor: 'ramping-arrival-rate'`, `startRate: 0`, `timeUnit: '1s'`, `stages: [{target:300,duration:'3m'},{target:300,duration:'5m'}]`, đủ `preAllocatedVUs`/`maxVUs`; `thresholds: { http_req_duration: ['p(99)<1000'] }`.
2. Giải thích vì sao `ramping-vus` với 5.000 VU không tương đương "5.000 thí sinh vào thi cùng lúc".
   **Đáp án:** VU chờ phản hồi mới gửi tiếp; server chậm thì số request mỗi giây giảm, tải thật bị đánh giá thấp. Mô hình mở giữ tốc độ đến không đổi.

### Bài 7.5. GitOps: GitLab CI, Helm, Argo CD, Terraform
**Dòng CV:** "Moved delivery to GitOps on Azure (AKS, Terraform, Helm, Argo CD): releases went from a monthly manual window to daily deploys with one-click rollback."
**Trạng thái:** Một phần. Docker, Helm, Terraform, GitLab CI, Argo CD là thật (nguồn: C5). Azure/AKS, "từ cửa sổ thủ công hằng tháng lên deploy hằng ngày" là minh họa. Nếu hạ tầng thật không phải Azure thì sửa CV theo cloud thật.

#### Mục tiêu
- Sau bài này, bạn mô tả được luồng từ commit tới cluster theo mô hình GitOps.
- Bạn cấu hình được một `Application` Argo CD dùng Helm và giải thích sync, self-heal, prune.
- Bạn nói được cách rollback và cách Terraform giữ state an toàn.

#### Bối cảnh và việc thật đã làm
Chuỗi delivery thật của Examena: Docker → Helm → Terraform (hạ tầng) → GitLab CI build → Argo CD sync theo GitOps. Cloud cụ thể và tần suất deploy không có dữ liệu xác nhận.

#### Kiến thức nền: GitOps là gì
GitOps: trạng thái mong muốn của cluster nằm trong Git; một agent trong cluster (Argo CD) liên tục so cluster với Git và kéo về cho khớp. Khác với CI "push" (`kubectl apply` từ pipeline): CI không cần quyền vào cluster, mọi thay đổi có lịch sử và người duyệt, rollback là quay lại commit.

**Luồng chuẩn:**
1. Dev merge vào nhánh chính của repo ứng dụng.
2. GitLab CI chạy test, build image, đẩy lên registry với tag là commit SHA (không dùng `latest`).
3. Job cuối cập nhật `image.tag` trong file values của repo cấu hình (hoặc mở merge request cho production).
4. Argo CD thấy repo cấu hình đổi, render chart và sync vào cluster.

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
metadata:
  name: exam-api-staging
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://gitlab.example.com/platform/deploy-config.git
    targetRevision: main
    path: charts/exam-api
    helm:
      valueFiles: [values-staging.yaml]
  destination:
    server: https://kubernetes.default.svc
    namespace: exam
  syncPolicy:
    automated:
      prune: true     # xóa resource không còn trong Git
      selfHeal: true  # ai sửa tay trên cluster sẽ bị kéo về theo Git
```

Argo CD render chart bằng `helm template` rồi tự apply manifest, nên `helm list` không thấy release; Helm hook được ánh xạ sang hook của Argo CD.

**Rollback.** Cách GitOps chuẩn: `git revert` commit cấu hình, Argo CD sync lại bản cũ, lịch sử ghi rõ ai rollback. Argo CD có lệnh rollback theo lịch sử sync, nhưng không dùng được khi bật auto-sync (auto-sync sẽ kéo về theo Git ngay); vì vậy với auto-sync, revert Git là đường chính.

**Terraform.** Quản lý cluster, mạng, registry, DNS. State lưu remote có khóa để hai người không apply chồng nhau: trên Azure là backend `azurerm` (blob có lease làm khóa), trên AWS là S3 kèm cơ chế khóa. Quy trình: `terraform plan` chạy trong merge request để review, `apply` chỉ chạy từ nhánh chính.

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate-rg"
    storage_account_name = "tfstateexamena"
    container_name       = "tfstate"
    key                  = "prod.tfstate"
  }
}
```

**Deploy thường xuyên an toàn (theo best practice):** thay đổi nhỏ, trunk-based development, feature flag tách deploy khỏi release, rollout dần (canary hoặc rolling với readiness probe), đóng băng deploy quanh ngày thi.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Delivery của Examena đi theo chuỗi Docker, Helm, GitLab CI build image, Argo CD sync từ repo cấu hình, Terraform quản lý hạ tầng. Rollback là revert commit cấu hình. Tần suất deploy cụ thể tôi không có số liệu chính xác để nói."

Nếu cloud thật không phải Azure, nói đúng cloud thật và sửa CV trước khi nộp.

#### Bẫy
- Nhận "monthly → daily deploys" khi không có số liệu.
- Nhận Azure/AKS khi hạ tầng thật khác.
- Dùng tag `latest`: Argo CD không thấy Git đổi, không biết đang chạy bản nào.
- Nói "rollback bằng nút trên Argo CD" trong khi bật auto-sync.
- Để secret dạng thô trong repo cấu hình; cần Sealed Secrets, External Secrets hoặc secret store của cloud.

#### Câu hỏi phỏng vấn
- **"GitOps khác CI/CD đẩy thẳng vào cluster ở điểm nào?"** Git là nguồn sự thật; agent trong cluster kéo về và sửa lệch (drift); CI không cần quyền cluster; rollback = revert commit.
- **"Rollback thế nào khi bật auto-sync?"** `git revert` commit cấu hình; Argo CD sync lại. Lệnh rollback của Argo CD bị chặn khi auto-sync bật.
- **"`selfHeal` và `prune` làm gì?"** `selfHeal` kéo cluster về theo Git khi có người sửa tay; `prune` xóa resource không còn trong Git. Bật `prune` cần cẩn thận với resource chứa dữ liệu.
- **"Terraform state để ở đâu, vì sao cần khóa?"** Backend remote có khóa (Azure Blob lease, S3); khóa ngăn hai lần apply đồng thời làm hỏng state; state chứa thông tin nhạy cảm nên phải mã hóa và giới hạn quyền.
- **"Deploy hằng ngày mà vẫn an toàn trong mùa thi bằng cách nào?"** Theo best practice: thay đổi nhỏ, feature flag, rollout dần với readiness probe, đóng băng deploy trước và trong ngày thi.

#### Tóm tắt
- Thật: Docker, Helm, Terraform, GitLab CI, Argo CD. Minh họa: Azure/AKS, tần suất deploy.
- Image tag = commit SHA; CI cập nhật values; Argo CD sync.
- Rollback chuẩn là revert Git.
- Terraform state remote, có khóa; plan trong MR, apply từ nhánh chính.

#### Bài tập
1. Viết `syncPolicy` cho production: tự sync nhưng không tự xóa resource, và tự kéo về khi bị sửa tay.
   **Đáp án:** `automated: { prune: false, selfHeal: true }`.
2. Một bản deploy lỗi lên production lúc 9:00 trong ngày thi, auto-sync đang bật. Liệt kê các bước rollback.
   **Đáp án:** Revert commit đổi `image.tag` trong repo cấu hình (merge nhanh theo quy trình khẩn), theo dõi Argo CD sync và readiness, xác nhận dashboard lỗi giảm, ghi lại cho postmortem; không sửa tay trên cluster vì self-heal sẽ kéo về.

### Bài 7.6. Sửa lỗi pentest theo OWASP Top 10:2025
**Dòng CV:** "Fixed all 14 findings of a customer's external pentest (OWASP Top 10, including JWT validation and access control) before a national rollout."
**Trạng thái:** Minh họa. Toàn bộ dòng chưa làm: không có đợt pentest 14 lỗi. Chỉ trả lời ở mức best practice.

#### Mục tiêu
- Sau bài này, bạn kể được 10 mục OWASP Top 10:2025 và thay đổi so với 2021.
- Bạn sửa được ba lỗi hay gặp trong ASP.NET Core: IDOR, cấu hình JWT, thiếu rate limit.
- Bạn trình bày được quy trình xử lý một báo cáo pentest.

#### Kiến thức nền: OWASP Top 10:2025
OWASP Top 10 là danh sách 10 nhóm rủi ro bảo mật ứng dụng web phổ biến nhất, cập nhật vài năm một lần. Bản 2025 (công bố bản đề xuất 11/2025):

| Mã | Tên | Ghi chú |
|---|---|---|
| A01 | Broken Access Control | Vẫn đứng đầu; đã gộp SSRF |
| A02 | Security Misconfiguration | Lên hạng 2 |
| A03 | Software Supply Chain Failures | Mới, mở rộng từ "thành phần có lỗ hổng" |
| A04 | Cryptographic Failures | Xuống từ hạng 2 |
| A05 | Injection | Xuống từ hạng 3 |
| A06 | Insecure Design | Xuống từ hạng 4 |
| A07 | Authentication Failures | |
| A08 | Software or Data Integrity Failures | |
| A09 | Logging & Alerting Failures | |
| A10 | Mishandling of Exceptional Conditions | Mới: xử lý lỗi sai, "fail open", lộ thông tin khi exception |

Danh sách đầy đủ ở owasp.org/Top10/2025. Nếu interviewer dùng bản 2021, nói được điểm khác: hai mục mới (chuỗi cung ứng, xử lý tình huống bất thường), SSRF gộp vào access control.

#### Sửa IDOR bằng phân quyền theo resource
IDOR (Insecure Direct Object Reference): đổi `/api/sessions/123` thành `/124` là xem được bài của người khác. Kiểm tra role là chưa đủ; phải kiểm tra quyền trên **từng resource**.

```csharp
public class SessionOwnerHandler
    : AuthorizationHandler<OperationAuthorizationRequirement, ExamSession>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext ctx,
        OperationAuthorizationRequirement req, ExamSession session)
    {
        var sub = ctx.User.FindFirst("sub")?.Value;
        if (sub is not null && session.CandidateId.ToString() == sub)
            ctx.Succeed(req);
        return Task.CompletedTask;
    }
}

// Trong endpoint
var session = await repo.GetAsync(id);
var auth = await authz.AuthorizeAsync(User, session, Operations.Read);
if (!auth.Succeeded) return NotFound(); // trả 404 để không lộ resource tồn tại
```

#### Cố định cấu hình JWT
```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.Authority = "https://idp.example.com";
        o.Audience = "exam-api";
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 }, // chặn "none", chặn nhầm HS/RS
            ClockSkew = TimeSpan.FromSeconds(30) // mặc định 5 phút
        };
    });
```

Kèm theo: access token hạn ngắn (5–15 phút), refresh token xoay vòng, không đặt dữ liệu nhạy cảm trong payload (JWT chỉ được ký, không mã hóa).

#### Rate limit cho đăng nhập và OTP
```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("otp", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(15) }));
});
app.UseRateLimiter();
app.MapPost("/auth/otp/verify", VerifyOtp).RequireRateLimiting("otp");
```

Sau reverse proxy phải cấu hình forwarded headers, không thì mọi request có cùng IP của proxy. Nên giới hạn thêm theo tài khoản, không chỉ theo IP.

#### Các lỗi hay gặp khác
- Thiếu header bảo mật: CSP, HSTS, `X-Content-Type-Options` (A02).
- Secret trong file config hoặc repo: chuyển sang secret store (A02, A04).
- Thư viện có lỗ hổng: `dotnet list package --vulnerable --include-transitive`, NuGet Audit trong build, quét image container trong CI, ghim image theo digest (A03).
- Trả stack trace ra client: `UseExceptionHandler` + ProblemDetails, chi tiết chỉ vào log (A10).

#### Quy trình xử lý báo cáo pentest
Phân loại theo CVSS (Low 0,1–3,9; Medium 4,0–6,9; High 7,0–8,9; Critical 9,0–10,0) → xác nhận tái hiện được → sửa theo thứ tự mức độ, có test hồi quy cho mỗi lỗi → nhờ bên pentest kiểm tra lại (retest) → lỗi chấp nhận rủi ro thì ghi lý do và người phê duyệt.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Đợt pentest như trên CV tôi chưa trực tiếp xử lý. Nếu nhận một báo cáo pentest, tôi phân loại theo CVSS, sửa theo mức độ kèm test hồi quy, rồi nhờ bên pentest retest. Với .NET, hai nhóm tôi kiểm tra đầu tiên là phân quyền theo từng resource để chặn IDOR và cấu hình JWT: cố định thuật toán, kiểm issuer, audience, hạn token."

#### Bẫy
- Kể "14 findings" như chuyện thật.
- Dùng danh sách OWASP 2021 mà không biết bản 2025 đã đổi.
- Chặn IDOR chỉ bằng ID khó đoán (GUID): vẫn phải kiểm quyền.
- Tin `ClockSkew` mặc định: token hết hạn vẫn dùng được thêm 5 phút.

#### Câu hỏi phỏng vấn
- **"OWASP Top 10:2025 có gì mới so với 2021?"** Thêm Software Supply Chain Failures (A03) và Mishandling of Exceptional Conditions (A10); SSRF gộp vào Broken Access Control; Security Misconfiguration lên hạng 2; Cryptographic Failures, Injection, Insecure Design xuống.
- **"Chặn IDOR trong ASP.NET Core thế nào?"** Phân quyền theo resource: load resource, gọi `IAuthorizationService.AuthorizeAsync(User, resource, requirement)` với handler kiểm chủ sở hữu; trả 404 để không lộ resource tồn tại.
- **"Những tham số JWT nào phải kiểm?"** Chữ ký với khóa đúng, thuật toán cố định, `iss`, `aud`, `exp`/`nbf`, `ClockSkew` nhỏ; access token hạn ngắn.
- **"Bạn ưu tiên sửa lỗi pentest theo thứ tự nào?"** Theo CVSS và khả năng khai thác thực tế: Critical/High trước, nhất là lỗi không cần đăng nhập; mỗi lỗi có test hồi quy; retest bởi bên pentest.
- **"Supply chain failure trong dự án .NET phòng thế nào?"** Quét package có lỗ hổng cả transitive trong CI, lock file, nguồn package tin cậy, quét và ghim image theo digest, giới hạn quyền token CI.

#### Tóm tắt
- Trạng thái Minh họa toàn bộ.
- Thuộc 10 mục OWASP 2025 và hai mục mới.
- IDOR: phân quyền theo resource, không chỉ theo role.
- JWT: cố định thuật toán, kiểm `iss`/`aud`/`exp`, giảm `ClockSkew`.
- Quy trình: CVSS → sửa + test hồi quy → retest.

#### Bài tập
1. Cho endpoint `GET /api/results/{id}` chỉ có `[Authorize(Roles = "Candidate")]`. Chỉ ra lỗ hổng và cách sửa.
   **Đáp án:** IDOR: thí sinh nào cũng đọc được kết quả của người khác. Load kết quả, kiểm `CandidateId == sub` qua resource-based authorization, không khớp thì trả 404.
2. Xếp các lỗi sau vào mục OWASP 2025: stack trace trả về client; package có CVE; secret trong appsettings; SSRF qua URL ảnh đại diện.
   **Đáp án:** A10; A03; A02 (kèm A04 nếu là khóa mã hóa); A01.

### Bài 7.7. Tuyển người và phát triển team
**Dòng CV:** "Grew the team from 4 to 8 through 20+ interviews, and set review standards and weekly 1:1s that took 2 engineers from junior to mid-level."
**Trạng thái:** Minh họa. Toàn bộ dòng chưa có dữ liệu xác nhận: 4 → 8 người, 20+ buổi phỏng vấn, 2 người lên mid. Nếu bạn thật sự đã phỏng vấn hoặc kèm người, kể đúng số lượng và việc thật.

#### Mục tiêu
- Sau bài này, bạn mô tả được quy trình phỏng vấn có cấu trúc và bảng tiêu chí chấm.
- Bạn nói được cách dùng 1:1 và góp ý SBI để phát triển người.
- Bạn trả lời trung thực khi bị hỏi về số liệu tuyển dụng không có thật.

#### Kiến thức nền
**Phỏng vấn có cấu trúc.** Mọi ứng viên cùng vị trí nhận cùng bộ câu hỏi, chấm theo cùng bảng tiêu chí (rubric) với thang điểm mô tả rõ từng mức. Mỗi người phỏng vấn chấm độc lập trước khi họp thống nhất, để tránh người nói to nhất quyết định. Bài tập kỹ thuật gần việc thật (đọc code, sửa bug, thiết kế nhỏ) hơn là câu đố thuật toán.

**1:1 hằng tuần.** Buổi của người được kèm, không phải buổi báo cáo tiến độ: vướng mắc, mục tiêu phát triển, phản hồi hai chiều. Lead ghi chú để theo dõi qua nhiều tuần.

**Góp ý theo SBI.** Situation (tình huống cụ thể) → Behavior (hành vi quan sát được) → Impact (tác động). Ví dụ: "Trong PR sửa luồng nộp bài hôm thứ Ba (S), phần retry không có test (B), nên reviewer phải tự dựng lại kịch bản và PR chậm hai ngày (I)."

**Đề xuất lên level.** Dựa trên khung năng lực (career ladder) của công ty và bằng chứng công việc: PR, thiết kế đã viết, sự cố đã xử lý, mức độ tự chủ. Lead chuẩn bị hồ sơ, không hứa trước kết quả.

**Chuẩn review.** Checklist ngắn: đúng nghiệp vụ, xử lý lỗi, test, log/metric, khả năng rollback; người review trả lời trong thời hạn thỏa thuận.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Con số tuyển dụng trên bản CV này tôi không dùng làm câu chuyện. Cách tôi sẽ làm nếu chịu trách nhiệm tuyển: phỏng vấn có cấu trúc với rubric chung, chấm độc lập trước khi thống nhất, bài tập gần việc thật; để phát triển người thì 1:1 hằng tuần và góp ý theo SBI."

#### Bẫy
- Kể số buổi phỏng vấn hay số người lên level khi không có thật.
- Nói 1:1 là buổi hỏi tiến độ.
- Góp ý chung chung ("cần cẩn thận hơn") thay vì hành vi cụ thể.

#### Câu hỏi phỏng vấn
- **"Bạn thiết kế buổi phỏng vấn kỹ thuật thế nào để công bằng?"** Cùng câu hỏi, cùng rubric có mô tả từng mức, chấm độc lập trước khi họp, bài tập gần việc thật.
- **"Một buổi 1:1 của bạn gồm những gì?"** Vướng mắc của người được kèm, mục tiêu phát triển, phản hồi hai chiều; không biến thành báo cáo tiến độ.
- **"Góp ý cho một người làm chưa tốt thế nào?"** SBI: tình huống, hành vi quan sát được, tác động; riêng tư, sớm, kèm đề xuất cụ thể.
- **"Dựa vào đâu để đề xuất một junior lên mid?"** Khung năng lực của công ty và bằng chứng công việc: tự chủ được tính năng cỡ vừa, review được PR người khác, xử lý được sự cố trong phạm vi mình.

#### Tóm tắt
- Trạng thái Minh họa toàn bộ.
- Phỏng vấn có cấu trúc + rubric + chấm độc lập.
- 1:1 hằng tuần, góp ý SBI, lên level dựa trên bằng chứng.

#### Bài tập
1. Viết rubric 4 mức cho tiêu chí "xử lý lỗi và edge case" khi phỏng vấn backend.
   **Đáp án:** Mức 1: không nghĩ tới lỗi; mức 2: xử lý khi được gợi ý; mức 3: tự nêu timeout, retry, dữ liệu rỗng; mức 4: thêm idempotency, quan sát (log/metric) và cách rollback.
2. Viết lại góp ý "code của bạn lộn xộn" theo SBI.
   **Đáp án:** Ví dụ: "Trong PR thêm API xuất kết quả (S), một hàm 300 dòng vừa truy vấn vừa định dạng file (B), nên khó review và khó test riêng phần định dạng (I). Tách thành hai hàm được không?"

### Bài 7.8. Vận hành ngày thi
**Dòng CV:** "Ran exam-day operations with product and support (runbooks, on-call rotation, live dashboards) across 40+ customer exams without a cancelled session."
**Trạng thái:** Minh họa. Toàn bộ dòng chưa có dữ liệu xác nhận: 40+ kỳ thi, không hủy phiên nào, runbook và lịch trực. Chỉ nói ở mức thiết kế.

#### Mục tiêu
- Sau bài này, bạn lập được checklist trước, trong và sau một kỳ thi.
- Bạn giải thích được vì sao phải scale trước giờ thi thay vì chờ autoscale.
- Bạn mô tả được một runbook và cách điều phối sự cố trong war room.

#### Kiến thức nền
**Trước kỳ thi.**
- Checklist cho từng kỳ thi: số thí sinh dự kiến, giờ bắt đầu, phòng thi, khách hàng liên hệ.
- **Scale trước:** HPA của Kubernetes phản ứng theo CPU sau vài chục giây tới vài phút (chờ metric, chờ pod khởi động, chờ node mới), không kịp với đỉnh vào thi đúng giờ. Scale SFU, API, signaling theo lịch trước giờ thi 30–60 phút (ví dụ KEDA cron scaler hoặc job đổi `replicas`).
- Làm nóng cache (đề thi, cấu hình kỳ thi), kiểm tra kết nối TURN.
- **Đóng băng deploy** từ trước kỳ thi tới khi kết thúc.

**Trong kỳ thi.**
- War room: một người điều phối sự cố (incident commander), một người liên lạc với khách hàng, các kỹ sư xử lý. Người điều phối không tự sửa.
- Dashboard trực tiếp: số thí sinh đang kết nối, tỷ lệ rớt kết nối, tải mỗi worker SFU, lỗi API, độ dài hàng đợi review.
- Runbook cho từng loại sự cố: triệu chứng → cách xác nhận → hành động → khi nào báo khách hàng. Ví dụ: một worker SFU chết → xác nhận qua log `died` và dashboard → chuyển phòng sang worker khác → thí sinh tự kết nối lại → ghi danh sách thí sinh bị ảnh hưởng để hội đồng gia hạn giờ.

**Sau kỳ thi.** Postmortem không đổ lỗi (blameless): dòng thời gian, nguyên nhân, việc cần làm có người nhận và hạn; cập nhật runbook.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Con số 40+ kỳ thi trên bản CV này tôi không dùng. Theo best practice, ngày thi tôi chia ba giai đoạn: trước thi thì scale theo lịch, làm nóng cache, đóng băng deploy; trong thi có war room, dashboard và runbook cho từng loại sự cố; sau thi là postmortem không đổ lỗi."

#### Bẫy
- Nhận "40+ exams without a cancelled session".
- Tin autoscale kịp đỉnh đầu giờ.
- Người điều phối sự cố vừa điều phối vừa sửa, không ai báo khách hàng.

#### Câu hỏi phỏng vấn
- **"Vì sao không để autoscale lo đỉnh đầu giờ thi?"** HPA cần thời gian thu metric, khởi động pod và có khi thêm node; đỉnh vào thi diễn ra trong vài phút đầu, nên phải scale theo lịch từ trước.
- **"Một runbook tốt gồm những gì?"** Triệu chứng, cách xác nhận, hành động từng bước, cách kiểm tra đã ổn, khi nào leo thang và báo khách hàng.
- **"Giữa kỳ thi một worker SFU chết thì làm gì?"** Theo thiết kế: phát hiện qua sự kiện `died` và dashboard, tạo lại worker, chuyển phòng, thí sinh tự kết nối lại; ghi danh sách thí sinh bị ảnh hưởng để gia hạn giờ; dư phòng worker để chịu được một worker chết.

#### Tóm tắt
- Trạng thái Minh họa toàn bộ.
- Trước: scale theo lịch, làm nóng cache, đóng băng deploy.
- Trong: war room có vai trò rõ, dashboard, runbook.
- Sau: postmortem không đổ lỗi, cập nhật runbook.

#### Bài tập
1. Viết checklist 8 mục cho 60 phút trước một kỳ thi 3.000 thí sinh.
   **Đáp án:** Gợi ý: xác nhận đóng băng deploy; scale SFU/API/signaling theo lịch; kiểm tra số worker và dư phòng; làm nóng cache đề và cấu hình; kiểm tra TURN; mở dashboard; xác nhận người trực và kênh liên lạc khách hàng; chạy một phiên thi thử end-to-end.
2. Viết runbook cho sự cố "tỷ lệ thí sinh không vào được phòng thi tăng đột biến".
   **Đáp án:** Xác nhận qua dashboard (lỗi API start, lỗi signaling, lỗi ICE); khoanh vùng theo thành phần; nếu do deploy thì rollback; nếu do tải thì scale thêm; báo khách hàng nếu quá 5 phút; ghi danh sách thí sinh bị ảnh hưởng.

## Chương 8. IAS 2.0: chuyển đổi kiến trúc

IAS 2.0 là dự án chuyển đổi một nền tảng giáo dục cũ của khách hàng. Phần thật đã xác nhận: migrate sang .NET với CQRS và RabbitMQ, có PostgreSQL replication và MongoDB sharding. Phần minh họa: con số 9 microservice, DDD, strangler chạy song song 3 tháng, shard theo tenant, "900 → 120 ms", outbox và saga (nguồn: mục 13, mục 14, C6, C7).

Interviewer hỏi migration để xem bạn có tư duy rủi ro không: migrate dữ liệu thế nào, đối soát ra sao, rollback bằng gì. Học xong chương này, bạn trả lời được ba bài toán kinh điển của hệ phân tán (tách service, mở rộng database, nhất quán dữ liệu qua message) ở mức thiết kế chính xác, và nói rõ phần nào mình đã làm.

### Bài 8.1. Tách monolith thành microservice: DDD, strangler fig, CQRS
**Dòng CV:** "Split a customer's legacy education monolith into 9 .NET microservices along DDD bounded contexts with CQRS read models; strangler routing ran old and new side by side for 3 months."
**Trạng thái:** Một phần. Migrate sang .NET với CQRS và RabbitMQ là thật (nguồn: mục 13, C6). "9 microservices", DDD và strangler chạy song song 3 tháng là minh họa (mục 14, C7: chưa có bằng chứng dùng DDD).

#### Mục tiêu
- Sau bài này, bạn chia được service theo bounded context và giải thích vì sao không chia theo bảng.
- Bạn mô tả được strangler fig: định tuyến, đồng bộ dữ liệu, đối soát, rollback.
- Bạn giải thích được CQRS read model, projection và eventual consistency.

#### Bối cảnh và việc thật đã làm
Phần thật: hệ thống được migrate sang .NET, dùng CQRS và RabbitMQ. C6 yêu cầu kể được chiến lược migrate (big-bang hay strangler), cách migrate dữ liệu, đối soát và rollback; giáo trình không có dữ liệu thật về các điểm này, nên bạn kể đúng thực tế nếu nhớ, phần còn lại nói theo best practice dưới đây.

#### Kiến thức nền: DDD đủ dùng cho phỏng vấn
- **Bounded context:** ranh giới mà trong đó một mô hình và từ vựng có nghĩa nhất quán. "Học viên" trong Enrollment (có trạng thái đăng ký) khác "học viên" trong Grading (có điểm).
- **Ubiquitous language:** dev và nghiệp vụ dùng chung từ ngữ, tên class đúng tên nghiệp vụ.
- **Context map:** quan hệ giữa các context (ai phụ thuộc ai, ai định nghĩa hợp đồng).
- **Anti-corruption layer (ACL):** lớp dịch giữa hệ mới và hệ cũ, để mô hình lộn xộn của hệ cũ không lan sang.
- **Aggregate:** cụm đối tượng thay đổi trong một transaction; ranh giới nhất quán mạnh.

Chia service theo năng lực nghiệp vụ, không theo bảng: chia theo bảng tạo ra service "CRUD" phải gọi nhau liên tục.

#### Strangler fig
Tên lấy từ cây đa bóp nghẹt: hệ mới mọc quanh hệ cũ, thay dần từng phần. Đặt một proxy trước hệ cũ; mỗi lần chuyển xong một nhóm endpoint thì đổi định tuyến sang service mới. Ví dụ với YARP (minh họa cách làm, không phải cấu hình thật của IAS):

```json
{
  "ReverseProxy": {
    "Routes": {
      "enrollment-new": {
        "ClusterId": "enrollment",
        "Match": { "Path": "/api/enrollments/{**rest}" }
      },
      "legacy-all": {
        "ClusterId": "legacy",
        "Order": 1000,
        "Match": { "Path": "{**catch-all}" }
      }
    },
    "Clusters": {
      "enrollment": { "Destinations": { "d1": { "Address": "http://enrollment-svc/" } } },
      "legacy": { "Destinations": { "d1": { "Address": "http://legacy-app/" } } }
    }
  }
}
```

**Dữ liệu khi chạy song song (theo best practice):**
- Một bên là nguồn sự thật cho mỗi loại dữ liệu tại mỗi thời điểm; bên kia nhận bản sao qua CDC hoặc event.
- Tránh dual-write từ ứng dụng (ghi hai nơi trong code): một bên lỗi là lệch, không có transaction chung.
- **Đối soát hằng đêm:** so số bản ghi và checksum theo tenant, theo ngày; lệch thì báo và có công cụ sửa.
- **Rollback:** đổi định tuyến về hệ cũ; điều kiện là hệ cũ vẫn nhận được dữ liệu ghi trong thời gian chạy mới (đồng bộ ngược), nếu không rollback sẽ mất dữ liệu.
- Big-bang chỉ hợp khi hệ nhỏ và chấp nhận được thời gian ngừng.

#### CQRS read model
CQRS tách mô hình ghi (command, kiểm nghiệp vụ, aggregate) khỏi mô hình đọc (query, dữ liệu dàn phẳng sẵn cho màn hình). Phía ghi phát event qua RabbitMQ; projection nhận event và cập nhật read model. Hệ quả: đọc trễ một chút (eventual consistency). Yêu cầu với projection (nguồn: mục 13): consumer idempotent, không giả định thứ tự (dùng version hoặc timestamp, bỏ event cũ hơn bản đang có), retry có giới hạn và dead-letter queue. Thiếu outbox thì có thể ghi DB thành công nhưng publish thất bại (Bài 8.3).

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Ở IAS 2.0 phần tôi làm thật là migrate hệ thống sang .NET với CQRS và RabbitMQ: phía ghi phát event, projection cập nhật read model, consumer idempotent. Con số service và cách chia theo DDD trên bản CV này tôi không dùng làm sự kiện; nếu làm lại, theo best practice tôi chia theo bounded context và chuyển dần bằng strangler: proxy định tuyến từng nhóm endpoint, đối soát hằng đêm, rollback bằng đổi định tuyến."

#### Bẫy
- Kể tên 9 service như hệ thật. Danh sách dưới đây là cách chia theo best practice.
- Distributed monolith: service tách ra nhưng gọi đồng bộ chuỗi dài và dùng chung database.
- Rollback "đổi định tuyến" mà quên dữ liệu ghi ở hệ mới chưa về hệ cũ.
- Nói CQRS bắt buộc đi với event sourcing: không, hai khái niệm độc lập.

#### Câu hỏi phỏng vấn
- **"Chia service theo tiêu chí gì?"** Theo năng lực nghiệp vụ và bounded context, không theo bảng; mỗi service sở hữu dữ liệu của mình và có thể deploy độc lập.
- **"Làm sao tránh distributed monolith?"** Mỗi service có dữ liệu riêng; tránh chuỗi gọi đồng bộ dài; giao tiếp qua event khi có thể; hợp đồng có version để deploy độc lập.
- **"Kể tên 9 service?"** Cách chia theo best practice cho nền tảng giáo dục, mỗi service một bounded context: Identity & Access, Organization (trường, lớp), Course Catalog, Enrollment, Learning Content, Assessment, Grading, Notification, Reporting. Nếu hệ thật chia khác thì nói theo hệ thật.
- **"Migrate dữ liệu và đối soát thế nào khi chạy song song?"** Một nguồn sự thật cho mỗi loại dữ liệu; đồng bộ qua CDC hoặc event, tránh dual-write; đối soát hằng đêm bằng số bản ghi và checksum theo tenant.
- **"Rollback một bước strangler thế nào?"** Đổi định tuyến về hệ cũ; chỉ an toàn khi dữ liệu ghi ở hệ mới đã được đồng bộ ngược, nên phải thiết kế đồng bộ ngược trước khi chuyển.
- **"Read model trễ thì người dùng thấy gì?"** Có thể thấy dữ liệu cũ vài trăm mili giây tới vài giây; xử lý bằng trạng thái "đang xử lý", đọc phía ghi cho màn hình ngay sau thao tác, hoặc trả kết quả từ command.

#### Tóm tắt
- Thật: migrate sang .NET với CQRS, RabbitMQ. Minh họa: 9 service, DDD, strangler 3 tháng.
- Chia theo bounded context; ACL cách ly hệ cũ.
- Strangler: proxy định tuyến, một nguồn sự thật, đối soát, rollback cần đồng bộ ngược.
- Projection idempotent, chịu sai thứ tự, có DLQ.

#### Bài tập
1. Cho một monolith giáo dục với các bảng: User, School, Class, Course, Enrollment, Lesson, Quiz, Score, Email. Gom thành bounded context và nêu event giữa chúng.
   **Đáp án:** Ví dụ: Identity (User), Organization (School, Class), Catalog (Course), Enrollment, Content (Lesson), Assessment (Quiz), Grading (Score), Notification (Email). Event: `StudentEnrolled` → Notification, Content mở quyền; `QuizSubmitted` → Grading; `ScoreRecorded` → Reporting.
2. Một projection nhận `EnrollmentStatusChanged` v5 rồi v4 (đến sai thứ tự). Thiết kế để read model không bị ghi lùi.
   **Đáp án:** Lưu `version` trong read model; chỉ cập nhật khi event.version > version hiện tại (`UPDATE ... WHERE id = @id AND version < @v`); event cũ bị bỏ qua và ghi log.

### Bài 8.2. PostgreSQL replica và MongoDB sharding
**Dòng CV:** "Moved reporting reads to PostgreSQL replicas and sharded MongoDB by tenant, cutting write p95 on the primary from 900 to 120 ms."
**Trạng thái:** Một phần. PostgreSQL replication và MongoDB sharding là thật. Shard theo tenant và "900 → 120 ms" là minh họa.

#### Mục tiêu
- Sau bài này, bạn giải thích được streaming replication, replication lag và cách xử lý read-your-writes.
- Bạn giải thích đúng vì sao chuyển đọc sang replica giúp phía ghi.
- Bạn chọn được shard key MongoDB cho dữ liệu đa tenant và tránh jumbo chunk, hotspot, scatter-gather.

#### Kiến thức nền: PostgreSQL streaming replication
Primary ghi mọi thay đổi vào WAL (write-ahead log). Process walsender trên primary gửi WAL cho walreceiver trên standby; standby phát lại (replay) WAL để có bản sao. Bật `hot_standby` thì standby nhận truy vấn chỉ đọc.

- **Bất đồng bộ (mặc định):** primary commit không chờ standby; nhanh nhưng mất được vài giao dịch cuối nếu primary chết.
- **Đồng bộ:** `synchronous_standby_names` + `synchronous_commit` (`remote_write`, `on`, `remote_apply`). `remote_apply` chờ standby replay xong nên đọc trên standby thấy ngay, đổi lại commit chậm hơn.

**Đo lag:**
```sql
-- Trên primary
SELECT application_name, state, sync_state, write_lag, flush_lag, replay_lag
FROM pg_stat_replication;

-- Trên replica (lưu ý: primary không có ghi thì số này tăng dù không lag)
SELECT now() - pg_last_xact_replay_timestamp() AS replay_delay;
```

**Read-your-writes.** Người dùng vừa ghi, đọc ngay trên replica chưa bắt kịp thì không thấy dữ liệu của mình. Cách xử lý:
1. Đọc từ primary trong một khoảng ngắn sau khi ghi (ví dụ đánh dấu phiên trong vài giây).
2. Chờ replica bắt kịp LSN:

```sql
-- Primary, ngay sau commit
SELECT pg_current_wal_lsn();  -- ví dụ 0/3A0012F8, trả về cho client hoặc lưu theo phiên
-- Replica, trước khi đọc
SELECT pg_last_wal_replay_lsn() >= '0/3A0012F8'::pg_lsn AS caught_up;
```

Trong .NET, tách hai data source (ghi và đọc) hoặc dùng chuỗi kết nối nhiều host của Npgsql với `Target Session Attributes` (`read-write`, `prefer-standby`).

**Xung đột trên hot standby.** Truy vấn báo cáo dài trên replica có thể bị hủy ("canceling statement due to conflict with recovery") khi primary đã dọn (vacuum) dòng mà truy vấn còn cần. Lựa chọn: tăng `max_standby_streaming_delay` (replica trễ thêm) hoặc bật `hot_standby_feedback` (primary giữ dòng lâu hơn, có thể phình bảng). Replica cho báo cáo thường tách riêng khỏi replica dự phòng HA.

**Vì sao chuyển đọc báo cáo sang replica giúp phía ghi.** Với MVCC, người đọc không khóa chặn người ghi, nên lợi ích chính **không phải khóa**. Truy vấn báo cáo quét lớn tranh CPU và I/O, đẩy trang nóng của phía ghi ra khỏi shared buffers, và transaction dài giữ snapshot cũ làm vacuum không dọn được, bảng phình. Chuyển sang replica loại bỏ các tranh chấp này trên primary.

#### Kiến thức nền: MongoDB sharding
Collection được chia thành chunk theo khoảng giá trị shard key; balancer di chuyển chunk giữa các shard; `mongos` định tuyến truy vấn.

- **Ranged:** chunk theo khoảng giá trị liên tục; truy vấn khoảng hiệu quả, nhưng khóa tăng dần (thời gian, ObjectId) dồn mọi lần ghi vào chunk cuối, gây hotspot.
- **Hashed:** băm giá trị, rải đều ghi; mất khả năng truy vấn khoảng hiệu quả trên trường băm.
- **Cardinality và tần suất:** shard key cần nhiều giá trị khác nhau và phân bố đều.

**Shard theo tenant:**
- Chỉ dùng `tenantId`: mọi document của một tenant có cùng giá trị khóa, chunk không chia nhỏ được, tenant lớn tạo **jumbo chunk** và hotspot.
- Khóa ghép băm `{ tenantId: 1, _id: "hashed" }` (MongoDB 4.4 trở lên, mỗi khóa chỉ được một trường hashed): truy vấn có `tenantId` chỉ đi tới các shard giữ chunk của tenant đó; dữ liệu của một tenant lớn vẫn rải đều.

```javascript
db.enrollments.createIndex({ tenantId: 1, _id: "hashed" })
sh.shardCollection("ias.enrollments", { tenantId: 1, _id: "hashed" })

// Có tiền tố shard key: truy vấn có đích
db.enrollments.find({ tenantId: "t-042", studentId: "s-9" })
// Không có shard key: scatter-gather, hỏi mọi shard
db.enrollments.find({ studentId: "s-9" })
```

Truy vấn không chứa tiền tố shard key là scatter-gather: `mongos` hỏi mọi shard rồi gộp, độ trễ bằng shard chậm nhất. Chọn sai shard key vẫn sửa được: `refineCollectionShardKey` (4.4+) thêm trường vào cuối khóa, `reshardCollection` (5.0+) đổi hẳn khóa, nhưng tốn tài nguyên. Zone sharding cho phép ghim tenant lớn vào shard riêng.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Ở IAS 2.0 hệ thống có PostgreSQL replication và MongoDB sharding. Con số 900 xuống 120 ms trên bản CV này tôi không có số đo để chứng minh. Về thiết kế: đọc báo cáo chuyển sang replica để primary bớt tranh CPU, I/O và buffer cache; màn hình vừa ghi xong thì đọc primary để tránh lỗi read-your-writes. Với dữ liệu đa tenant, theo best practice tôi chọn shard key ghép `tenantId` và `_id` băm để tenant lớn không thành jumbo chunk."

#### Bẫy
- Nói "replica giảm khóa trên primary": với MVCC đó không phải lý do chính.
- Đọc mọi thứ từ replica, kể cả ngay sau khi ghi.
- Shard chỉ bằng `tenantId` khi có tenant lớn.
- Nhận "shard theo tenant" và "900 → 120 ms" là số thật.

#### Câu hỏi phỏng vấn
- **"Replication lag gây lỗi gì và xử lý thế nào?"** Read-your-writes: người dùng không thấy dữ liệu vừa ghi. Đọc primary ngay sau khi ghi, chờ replica đạt LSN của lần ghi, hoặc dùng `remote_apply` cho luồng cần nhất quán.
- **"Vì sao chuyển đọc sang replica làm giảm latency ghi trên primary?"** Primary bớt tranh CPU, I/O, shared buffers với truy vấn quét lớn, và không còn transaction dài cản vacuum; không phải vì khóa, vì MVCC không cho người đọc chặn người ghi.
- **"Chọn shard key cho collection đa tenant thế nào?"** `{ tenantId: 1, _id: "hashed" }`: truy vấn theo tenant có đích, tenant lớn vẫn rải đều; tránh chỉ dùng `tenantId` (jumbo chunk) và khóa tăng dần (hotspot).
- **"Scatter-gather là gì, khi nào xảy ra?"** Truy vấn không có tiền tố shard key, `mongos` phải hỏi mọi shard; độ trễ theo shard chậm nhất và tải nhân theo số shard.
- **"Truy vấn báo cáo trên replica bị hủy giữa chừng, vì sao?"** Xung đột với recovery: primary đã vacuum dòng mà truy vấn cần. Tăng `max_standby_streaming_delay` hoặc bật `hot_standby_feedback`, mỗi cách có giá riêng.

#### Tóm tắt
- Thật: replication và sharding. Minh họa: shard theo tenant, 900 → 120 ms.
- Streaming replication gửi WAL; mặc định bất đồng bộ; đo lag bằng `pg_stat_replication`.
- Read-your-writes: đọc primary sau khi ghi hoặc chờ LSN.
- Shard key `{ tenantId: 1, _id: "hashed" }`; tránh jumbo chunk, hotspot, scatter-gather.

#### Bài tập
1. Một API "lưu hồ sơ rồi chuyển tới trang xem hồ sơ" đọc từ replica; thỉnh thoảng người dùng thấy dữ liệu cũ. Đề xuất hai cách sửa và đánh đổi.
   **Đáp án:** (1) Đọc primary trong vài giây sau khi ghi (đơn giản, tăng tải primary nhẹ); (2) trả LSN sau khi ghi, đọc replica chỉ khi `pg_last_wal_replay_lsn()` đã vượt LSN đó, nếu không thì đọc primary (chính xác hơn, phức tạp hơn).
2. Collection `submissions` có `tenantId`, `examId`, `createdAt`; 3 tenant chiếm 70% dữ liệu. Đánh giá ba shard key: `{ createdAt: 1 }`, `{ tenantId: 1 }`, `{ tenantId: 1, _id: "hashed" }`.
   **Đáp án:** `createdAt` tăng dần → mọi lần ghi vào một chunk (hotspot). `tenantId` → 3 tenant lớn thành jumbo chunk. Khóa ghép băm → rải đều, truy vấn theo tenant vẫn có đích.

### Bài 8.3. Outbox, saga, hết đăng ký trùng
**Dòng CV:** "Replaced synchronous integrations with RabbitMQ events, a transactional outbox, and a saga for multi-step enrollment, accepting eventual consistency and ending duplicate enrollments on retry."
**Trạng thái:** Minh họa. Chuyển tích hợp đồng bộ sang bất đồng bộ qua RabbitMQ là phần có thật (D0); transactional outbox, saga và kết quả "hết đăng ký trùng" chưa có bằng chứng (mục 14, C7). Chỉ nói ở mức thiết kế.

#### Mục tiêu
- Sau bài này, bạn giải thích được dual-write problem và cách transactional outbox giải quyết.
- Bạn phân biệt được saga orchestration và choreography, viết được khung state machine MassTransit.
- Bạn chặn được đăng ký trùng bằng consumer idempotent và unique constraint.

#### Kiến thức nền: dual-write problem
Code "ghi DB rồi publish message" có hai thao tác trên hai hệ không chung transaction. Ghi DB xong, process chết trước khi publish: dữ liệu có, event mất. Publish trước rồi ghi DB lỗi: event có, dữ liệu không. Retry không cứu được vì không biết bước nào đã xong.

**Transactional outbox:** ghi dữ liệu nghiệp vụ và một dòng outbox **trong cùng transaction**; một relay đọc outbox và publish ra RabbitMQ (polling hoặc CDC đọc WAL). Message được giao **ít nhất một lần** (at-least-once): relay có thể publish rồi chết trước khi đánh dấu, nên consumer phải idempotent.

```sql
CREATE TABLE outbox_message (
  id           uuid PRIMARY KEY,
  type         text        NOT NULL,
  payload      jsonb       NOT NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL
);
CREATE INDEX ix_outbox_pending ON outbox_message (occurred_at) WHERE published_at IS NULL;

-- Relay: nhiều instance chạy song song không lấy trùng nhờ SKIP LOCKED
BEGIN;
SELECT id, type, payload
FROM outbox_message
WHERE published_at IS NULL
ORDER BY occurred_at
LIMIT 100
FOR UPDATE SKIP LOCKED;
-- publish lên RabbitMQ, chờ publisher confirm
UPDATE outbox_message SET published_at = now() WHERE id = ANY(@ids);
COMMIT;
```

**Đối chiếu từ dự án VTC (nguồn: B5):** ở mastery-service, dòng outbox (sự kiện bắt đầu attempt theo chuẩn CloudEvents) được ghi ở bước sau khi lưu attempt, không chung transaction, nên vẫn có khe hở "attempt đã lưu nhưng event mất". Cách sửa đúng là đưa insert outbox vào cùng transaction với lần ghi attempt. Đây là ví dụ thật để minh họa vì sao "cùng transaction" là cốt lõi; chỉ kể ở mức bạn đã đọc và hiểu luồng, không nhận là người viết.

#### Consumer idempotent và hết đăng ký trùng
Hai lớp phòng thủ:
1. **Inbox:** bảng ghi `message_id` đã xử lý, insert cùng transaction với thay đổi nghiệp vụ; trùng khóa thì bỏ qua message.
2. **Unique constraint nghiệp vụ:** dù message khác `message_id` (người dùng bấm hai lần tạo hai command), database vẫn chặn.

```sql
CREATE TABLE inbox_message (
  message_id   uuid,
  consumer     text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, consumer)
);

ALTER TABLE enrollment
  ADD CONSTRAINT uq_enrollment UNIQUE (tenant_id, student_id, course_id);

INSERT INTO enrollment (id, tenant_id, student_id, course_id, status)
VALUES (@id, @tenant, @student, @course, 'Pending')
ON CONFLICT (tenant_id, student_id, course_id) DO NOTHING
RETURNING id;   -- không trả dòng nào nghĩa là đã đăng ký, trả về bản ghi cũ
```

Lớp thứ ba ở API: idempotency key do client gửi, request lặp nhận lại kết quả cũ.

#### Saga
Saga là chuỗi transaction cục bộ ở nhiều service; mỗi bước có **hành động bù trừ** (compensating action) khi bước sau thất bại, vì không có transaction phân tán.

- **Orchestration:** một state machine trung tâm gửi command và nhận event; dễ theo dõi, có chỗ đặt timeout; đổi lại có một thành phần trung tâm.
- **Choreography:** mỗi service phản ứng với event của service khác; ít khớp nối nhưng khó nhìn toàn luồng khi quá 3–4 bước.

Ví dụ đăng ký khóa học nhiều bước theo orchestration với MassTransit (khung minh họa):

```csharp
public class EnrollmentState : SagaStateMachineInstance
{
    public Guid CorrelationId { get; set; }
    public string CurrentState { get; set; } = default!;
    public Guid StudentId { get; set; }
    public Guid CourseId { get; set; }
    public int Version { get; set; }   // optimistic concurrency
}

public class EnrollmentStateMachine : MassTransitStateMachine<EnrollmentState>
{
    public State SeatReserving { get; private set; } = default!;
    public State Provisioning { get; private set; } = default!;
    public State Completed { get; private set; } = default!;
    public State Failed { get; private set; } = default!;

    public Event<EnrollmentSubmitted> Submitted { get; private set; } = default!;
    public Event<SeatReserved> SeatReserved { get; private set; } = default!;
    public Event<SeatUnavailable> SeatUnavailable { get; private set; } = default!;
    public Event<AccessProvisioned> Provisioned { get; private set; } = default!;
    public Event<ProvisioningFailed> ProvisionFailed { get; private set; } = default!;

    public EnrollmentStateMachine()
    {
        InstanceState(x => x.CurrentState);
        Event(() => Submitted, e => e.CorrelateById(c => c.Message.EnrollmentId));
        Event(() => SeatReserved, e => e.CorrelateById(c => c.Message.EnrollmentId));
        Event(() => SeatUnavailable, e => e.CorrelateById(c => c.Message.EnrollmentId));
        Event(() => Provisioned, e => e.CorrelateById(c => c.Message.EnrollmentId));
        Event(() => ProvisionFailed, e => e.CorrelateById(c => c.Message.EnrollmentId));

        Initially(
            When(Submitted)
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

```csharp
services.AddMassTransit(x =>
{
    x.AddEntityFrameworkOutbox<EnrollmentDbContext>(o =>
    {
        o.UsePostgres();
        o.UseBusOutbox();   // publish trong scope được ghi vào bảng outbox, commit cùng SaveChanges
    });
    x.AddSagaStateMachine<EnrollmentStateMachine, EnrollmentState>()
        .EntityFrameworkRepository(r =>
        {
            r.ConcurrencyMode = ConcurrencyMode.Optimistic;
            r.ExistingDbContext<EnrollmentDbContext>();
            r.UsePostgres();
        });
    x.UsingRabbitMq((ctx, cfg) => cfg.ConfigureEndpoints(ctx));
});
```

Timeout cho bước không phản hồi dùng `Schedule` của MassTransit (cần cấu hình message scheduler). Kiểm tra giấy phép phiên bản MassTransit đang dùng: bản 8 là mã nguồn mở, các bản sau công bố mô hình giấy phép thương mại.

**RabbitMQ đi kèm:** publisher confirms để relay biết message đã tới broker; quorum queue cho độ bền; dead-letter cho message lỗi lặp lại; message có thể đến sai thứ tự khi có nhiều consumer.

**Eventual consistency trên giao diện:** trả "đang xử lý" ngay sau khi nhận đăng ký, cập nhật trạng thái qua polling hoặc push; không hứa kết quả cuối ngay lập tức.

#### Cách nói trong phỏng vấn
> **Ví dụ:** "Ở IAS 2.0, phần tôi tham gia là chuyển tích hợp đồng bộ sang event qua RabbitMQ. Outbox và saga như trên bản CV này tôi chưa triển khai. Nếu làm, tôi ghi outbox cùng transaction với dữ liệu nghiệp vụ để không mất event, consumer idempotent bằng inbox, chặn đăng ký trùng bằng unique constraint trên tenant, học viên, khóa học, và điều phối luồng nhiều bước bằng saga orchestration có hành động bù trừ và timeout."

#### Bẫy
- Nói outbox cho "exactly-once": outbox cho at-least-once; exactly-once về hiệu ứng đến từ consumer idempotent.
- Ghi outbox ngoài transaction nghiệp vụ (đúng khe hở ở B5).
- Chỉ dựa vào inbox theo `message_id`: hai command khác nhau cho cùng một đăng ký vẫn lọt; cần unique constraint nghiệp vụ.
- Saga không có timeout: một bước im lặng làm saga treo mãi.
- Nhận đã dùng MassTransit saga khi chưa dùng (mục 14).

#### Câu hỏi phỏng vấn
- **"Vì sao cần transactional outbox, không publish thẳng sau khi commit được không?"** Publish sau commit có thể thất bại (process chết, broker lỗi) làm mất event; ghi outbox cùng transaction bảo đảm có dữ liệu thì có event, relay publish sau với at-least-once.
- **"Outbox đảm bảo exactly-once không?"** Không; relay có thể publish lại. Exactly-once về hiệu ứng cần consumer idempotent: inbox theo `message_id` cộng unique constraint nghiệp vụ.
- **"Orchestration và choreography chọn khi nào?"** Orchestration khi luồng nhiều bước, cần timeout và bù trừ rõ ràng, cần nhìn trạng thái từng instance; choreography khi luồng ngắn, ít bước, muốn các service độc lập.
- **"Một bước giữa saga thất bại thì sao?"** Chạy hành động bù trừ cho các bước đã xong theo thứ tự ngược (ví dụ nhả chỗ đã giữ), chuyển saga sang Failed, báo người dùng; bước không phản hồi thì timeout kích hoạt bù trừ.
- **"Làm sao hết đăng ký trùng khi client retry?"** Ba lớp: idempotency key ở API, inbox ở consumer, unique constraint `(tenant_id, student_id, course_id)` với `ON CONFLICT DO NOTHING` ở database.
- **"Nhiều instance relay cùng chạy có publish trùng không?"** Dùng `FOR UPDATE SKIP LOCKED` để mỗi instance lấy một lô khác nhau; vẫn có thể trùng khi chết giữa publish và cập nhật, nên consumer vẫn phải idempotent.

#### Tóm tắt
- Trạng thái Minh họa; phần có thật là chuyển tích hợp đồng bộ sang RabbitMQ.
- Outbox: cùng transaction, relay at-least-once.
- Idempotent: inbox + unique constraint nghiệp vụ + idempotency key.
- Saga: orchestration hoặc choreography, luôn có bù trừ và timeout.
- Giao diện hiển thị "đang xử lý", chấp nhận eventual consistency.

#### Bài tập
1. Viết luồng xử lý `EnrollmentSubmitted` ở consumer sao cho message lặp lại không tạo bản ghi thứ hai, trong một transaction.
   **Đáp án:** Mở transaction → insert `inbox_message(message_id, consumer)`, trùng khóa thì rollback và ack → insert `enrollment ... ON CONFLICT DO NOTHING` → insert outbox `EnrollmentCreated` nếu tạo mới → commit → ack message.
2. Saga đăng ký có ba bước: giữ chỗ, tạo quyền truy cập khóa học, gửi email. Bước nào cần bù trừ, bước nào không, và timeout đặt ở đâu?
   **Đáp án:** Giữ chỗ cần bù trừ (nhả chỗ); tạo quyền truy cập cần bù trừ (thu hồi) nếu có bước sau quan trọng; gửi email là bước cuối, không bù trừ, chỉ retry. Timeout đặt sau mỗi command chờ phản hồi (giữ chỗ, tạo quyền).
