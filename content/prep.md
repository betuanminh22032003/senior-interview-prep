# Phần D: CV tham khảo `main.tex` (bản hiện tại)

`resume/main.tex` hiện là **bản tham khảo**. Nhiều bullet và số liệu được viết để minh họa một CV senior và **chưa xảy ra thật**. Phần này giúp bạn trả lời được mọi tầng câu hỏi kỹ thuật cho từng dòng, đồng thời chỉ rõ dòng nào không được kể như việc đã làm.

> **Nguyên tắc cho bản tham khảo**
>
> - Interviewer hỏi 3 tầng: *làm gì → làm thế nào → sao biết là đúng*. Dòng minh họa lộ ngay ở tầng 3: không có dashboard, không có ticket, không có người xác nhận.
> - Với dòng **Minh họa**, chỉ có 3 cách an toàn:
>   1. **Làm thật rồi đo**, sau đó mới giữ trên CV. Nhiều việc đã có hướng dẫn trong `cv-10-roadmap.md`.
>   2. **Bỏ khỏi CV** khi nộp. Bản dựa trên số thật nằm ở commit `da5034a`.
>   3. **Nói ở mức thiết kế**: "phần này tôi chưa triển khai; nếu làm, tôi sẽ…". Phần D vẫn chuẩn bị đủ kiến thức để nói như vậy.
> - Không dùng dòng minh họa làm câu chuyện STAR.

## D0. Trạng thái từng dòng

- **Thật**: có bằng chứng (commit, báo cáo, hoặc bạn đã xác nhận).
- **Một phần**: cốt lõi thật, nhưng con số hoặc phạm vi là minh họa.
- **Minh họa**: chưa làm.

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

## D1. Summary và dòng Platform

- **"Senior backend engineer"**: chức danh thật ở VTC là Backend Engineer. Summary là định vị. Nếu bị hỏi chức danh, trả lời đúng chức danh thật.
- **"35M+ accounts, 200K peak concurrent users"**: bối cảnh nền tảng, không phải năng lực do bạn xây. Cách đếm theo best practice, nói kèm thời điểm đo:
  - Tài khoản đăng ký: đếm trên bảng user, loại tài khoản đã xóa hoặc bị khóa.
  - Người dùng đồng thời: số phiên có hoạt động trong 1–5 phút gần nhất lúc cao điểm, hoặc số request đồng thời trên APM trong ca thi đông nhất.
- **"exam-start p95 2.45 s to 55 ms"**: số thật là thời gian của một trace điển hình trước và sau fix. Hoặc bỏ chữ "p95", hoặc đo p95 theo `cv-10-roadmap.md` mục 1.1 trước buổi phỏng vấn.
- **"turns incidents into SLOs"**: đi kèm dòng 2 (minh họa). Bỏ dòng 2 thì bỏ luôn cụm này.
- **"microservices"**: nền tảng có 20+ service .NET, mỗi service deploy riêng, gọi nhau qua HTTP/gRPC và Kafka. Nói được điểm chưa "chuẩn microservices": nhiều service vẫn dùng chung database theo domain.
- **"high availability"**: phía ứng dụng có nhiều pod sau load balancer trên Kubernetes và Redis Cluster. Phía SQL Server, trả lời theo best practice:
  - **Always On Availability Group** (Enterprise): nhiều replica, có secondary đọc được, failover tự động qua listener.
  - **Basic Availability Group** (Standard, từ 2016): tối đa 2 replica, mỗi AG một database, secondary không đọc được.
  - **Failover Cluster Instance:** HA ở mức instance, dùng chung storage.
  - **Log shipping:** cho DR, chấp nhận mất vài phút dữ liệu.
  - Nói theo RPO (mất tối đa bao nhiêu dữ liệu) và RTO (bao lâu thì chạy lại).
  - Phía ứng dụng: kết nối qua listener với `MultiSubnetFailover=True`; retry lỗi tạm thời (`SqlRetryLogicOption` của `Microsoft.Data.SqlClient`, hoặc `EnableRetryOnFailure` của EF Core).

---

## D2. VTC Online

### D2.1. Audit 6 cụm SQL Server, exam-start 2,45 s → 55 ms

**Trạng thái:** Một phần. Audit và đề xuất là của bạn. Ba fix ngày 16/09 do đồng nghiệp commit (mục 0 #1, mục 3.1). Số liệu lấy từ trace, không phải p95.

**Cách nói:** "Tôi dẫn đợt audit, xếp hạng điểm nóng và đề xuất cách sửa. Team cùng triển khai."

**Cơ chế:** quy trình 3 bước ở mục 2 (APM → DMV → đọc code). Nguyên nhân của API bắt đầu thi nằm ở mục 3.1: hàm làm mới cache gọi `SCAN` 472 vòng trên toàn keyspace Redis; cách sửa là dùng một Redis SET làm index rồi xóa trực tiếp từng key.

**Câu hỏi xoáy:**

- **"p95 trước và sau là bao nhiêu?"** Nói thật: số trong CV là trace điển hình. Tốt hơn là đo p95 trước buổi phỏng vấn (roadmap 1.1).
- **"`SCAN` không chặn như `KEYS`, sao vẫn chậm?"**
  - Mỗi lệnh `SCAN` chỉ duyệt một phần keyspace nên không chặn lâu.
  - Nhưng 472 lần round-trip trong một request cộng lại thành hàng trăm ms tới giây, và mỗi lệnh vẫn chiếm event loop đơn luồng của Redis.
  - Gốc rễ là thuật toán O(kích thước keyspace) nằm trên đường nóng.
- **"Sao chắc nguyên nhân là `SCAN`?"** Span Redis chiếm phần lớn thời gian trong trace. Sau fix, trace không còn `SCAN`.
- **"Xếp hạng điểm nóng theo tiêu chí nào?"** Tổng chi phí (logical reads hoặc CPU trung bình × số lần chạy), mức ảnh hưởng tới API người dùng, rồi tới độ dễ sửa và rủi ro.

### D2.2. Postmortem, SLO, OpenTelemetry, Grafana

**Trạng thái:** Minh họa.

**Muốn biến thành thật:** viết postmortem cho đợt 2,45 s (roadmap 3.4), đề xuất SLO cho các API thi, đếm số lần alert/page hiện có làm mốc.

**Kiến thức phải có:**

- **SLI, SLO, SLA:** SLI là số đo (tỉ lệ request nhanh hơn 300 ms). SLO là mục tiêu nội bộ (99% trong 30 ngày). SLA là cam kết với khách hàng, có chế tài.
- **Vì sao SLO latency viết dạng tỉ lệ thay vì "p95 < 300 ms":** tỉ lệ request tốt cộng dồn được giữa các pod và các khoảng thời gian; percentile thì không cộng được.
- **Đo bằng histogram Prometheus:**
  ```promql
  sum(rate(http_server_request_duration_seconds_bucket{le="0.3",route="/exam/start"}[5m]))
  /
  sum(rate(http_server_request_duration_seconds_count{route="/exam/start"}[5m]))
  ```
- **Error budget** = 1 − SLO. SLO 99,9% trong 30 ngày cho phép 0,1% request xấu, tương đương khoảng 43 phút nếu tính theo thời gian.
- **Burn-rate alert nhiều cửa sổ** (theo SRE Workbook, với SLO 99,9%):
  - Page khi burn rate ≥ 14,4 trên cả cửa sổ 1 giờ và 5 phút (tiêu 2% budget trong 1 giờ).
  - Page khi ≥ 6 trên 6 giờ và 30 phút (5% budget).
  - Ticket khi ≥ 1 trên 3 ngày (10% budget).
  - Cửa sổ ngắn giúp alert tự tắt nhanh khi sự cố đã hết.
- **Postmortem blameless:** timeline, tác động (bao nhiêu user, bao lâu), nguyên nhân gốc, yếu tố góp phần, điều làm tốt, action item có người chịu trách nhiệm và hạn.
- **OpenTelemetry trong .NET:**
  ```csharp
  builder.Services.AddOpenTelemetry()
      .WithTracing(t => t
          .AddAspNetCoreInstrumentation()
          .AddHttpClientInstrumentation()
          .AddSqlClientInstrumentation()
          .AddOtlpExporter())
      .WithMetrics(m => m
          .AddAspNetCoreInstrumentation()
          .AddRuntimeInstrumentation()
          .AddPrometheusExporter());
  ```
  - Context truyền qua header W3C `traceparent` trên HTTP và gRPC. Với Kafka phải tự gắn header vào message.
  - Sampling: head-based (`ParentBased` + `TraceIdRatioBased`) rẻ nhưng có thể bỏ sót trace lỗi; tail-based ở OpenTelemetry Collector giữ lại trace lỗi hoặc chậm.
- **Grafana:** mỗi API một dashboard RED (Rate, Errors, Duration); tài nguyên theo USE (Utilization, Saturation, Errors).

**Câu hỏi xoáy:**

- **"Đang có Elastic APM, sao thêm OpenTelemetry?"** Chuẩn mở, không khóa vào một vendor. Elastic APM nhận được OTLP nên không phải bỏ hệ thống cũ.
- **"Ngưỡng 300 ms lấy từ đâu?"** Baseline p95/p99 hiện tại, thời gian chờ người dùng chấp nhận khi bắt đầu thi, và chi phí để đạt được.
- **"Page giảm từ 14 xuống 2 nhờ đâu?"** Cách giảm page theo best practice:
  - Bỏ alert theo nguyên nhân (CPU cao, hàng đợi dài), chỉ page theo triệu chứng người dùng thấy (burn rate của SLO).
  - Gộp và khử trùng alert cùng một sự cố.
  - Alert không cần xử lý ngay thì chuyển thành ticket.
  - Mỗi page phải có runbook; alert không ai hành động thì xóa sau buổi review alert hằng tuần.
  - Đo bằng số page mỗi tháng trên hệ thống on-call, so cùng mùa thi.

### D2.3. Hotfix trong ngày và index ca đêm

**Trạng thái:** Một phần. Kế hoạch 2 tầng là thật (mục 2). DBA đã đánh index chưa thì trả lời theo trạng thái thật; quy trình đánh index ca đêm theo best practice ở dưới. Số CPU là minh họa. Số thật có thể dùng: procedure chạy ~13M lần giảm từ 825 xuống 3 logical reads, 14,9 → 0,12 ms trên ~29K lần chạy sau deploy (mục 4.4; phải xác nhận ai viết).

**Cơ chế:**

- **Standard Edition không có `ONLINE = ON`.** Khi tạo index offline:
  - Nonclustered index giữ khóa S trên bảng: vẫn đọc được nhưng chặn ghi.
  - Tạo hoặc rebuild clustered index giữ khóa Sch-M: chặn mọi truy cập.
- **`ALTER PROCEDURE`** chỉ giữ khóa schema trên procedure trong thời gian rất ngắn, nên deploy được giữa ngày.
- Các hotfix tiêu biểu: bỏ biểu thức non-sargable bằng cách tách nhánh `IF/ELSE`, đổi xử lý từng dòng (RBAR) sang set-based, bỏ `ALTER TABLE #temp` để temp table được cache lại (mục 4.4).

**Quy trình đánh index ca đêm theo best practice:**

- Thử trước trên bản sao dữ liệu thật để biết thời gian chạy và dung lượng cần.
- Mỗi đêm một vài bảng, bảng nhỏ trước; dùng `SORT_IN_TEMPDB = ON` và giới hạn `MAXDOP` để không chiếm hết CPU.
- Theo dõi blocking trong lúc chạy; có ngưỡng thời gian để dừng nếu vượt cửa sổ 23h–05h.
- Sáng hôm sau so plan và DMV của các procedure liên quan; bỏ index không được dùng sau vài tuần (`sys.dm_db_index_usage_stats`).

**Đo CPU nếu muốn số thật:** `sys.dm_os_ring_buffers` với `RING_BUFFER_SCHEDULER_MONITOR` cho CPU theo phút, hoặc dashboard hạ tầng. So cùng khung giờ cao điểm, cùng ngày trong tuần, trước và sau.

**Câu hỏi xoáy:**

- **"Tách nhánh `IF/ELSE` có bị parameter sniffing không?"** Có thể: mỗi câu lệnh compile theo giá trị tham số của lần chạy đầu. Cách xử lý: tách mỗi nhánh thành procedure con, hoặc `OPTION (RECOMPILE)` cho nhánh hiếm.
- **"Logical reads giảm thì CPU giảm đúng tỉ lệ không?"** Không. Phải đo CPU và thời gian riêng (C0).
- **"Sao không mua Enterprise để đánh index online?"** Chi phí license theo core rất lớn so với việc dời lịch đánh index sang 23h–05h.

### D2.4. Procedure cấu hình chạy 81M lần

**Trạng thái:** Một phần. Nguyên nhân và cách sửa là của bạn (commit 21/09, mục 4.1). "9.400 → 40 lần/phút" là minh họa.

**Phải nói chính xác:** 81M là số lần chạy cộng dồn trong DMV kể từ `cached_time`, không phải "đã loại bỏ 81M lần gọi" (C0).

**Đo số thật:** chụp `execution_count` 2 lần cách nhau đúng 1 giờ, cùng khung giờ, trước và sau fix (roadmap 1.2).

**Câu hỏi xoáy:**

- **"Sao không chỉ tăng TTL?"** TTL dài vẫn không cache kết quả rỗng, nên các tổ hợp không có cấu hình luôn miss và luôn gọi DB. Phải có negative caching.
- **"Negative cache có rủi ro gì?"** Cấu hình vừa được tạo vẫn bị coi là rỗng tới khi hết TTL. Xử lý: CMS gọi hàm xóa cache khi tạo hoặc sửa cấu hình; hoặc đặt TTL ngắn hơn cho kết quả rỗng.
- **"Cache stampede khi key hết hạn?"** Nhiều request cùng miss một lúc. Giải pháp: thêm jitter vào TTL, single-flight hoặc lock khi nạp lại, hoặc refresh trước khi hết hạn.
- **"Version key cho bảng giá hoạt động thế nào?"** Key có dạng `pricing:v{n}:{service}`. CMS đổi gói thì `INCR` version; key cũ không còn được đọc và tự hết hạn. Invalidate tốn O(1), không cần `SCAN`.
- **"Sao dùng Redis mà không dùng MemoryCache?"** Caller sửa trực tiếp object trả về (mục 4.2), và nhiều pod cần invalidate cùng lúc.

### D2.5. Nộp bài an toàn khi retry

**Trạng thái:** Một phần. Applock insert-once là của bạn (Here I Come, mục 6). Lua CAS là lớp có sẵn: nói "tôi hiểu và dùng lớp đó", đừng nhận là tự viết nếu không phải. "~1,2K/ngày → 0" là minh họa.

**Cơ chế applock** (mục 6, B3):

```sql
DECLARE @res nvarchar(255) = CONCAT(N'result:', @UserId, N':', @RoundId);
DECLARE @rc int;
BEGIN TRAN;
EXEC @rc = sp_getapplock @Resource = @res, @LockMode = 'Exclusive',
                         @LockOwner = 'Transaction', @LockTimeout = 5000;
IF @rc < 0 THROW 50001, N'Không lấy được lock', 1;

IF EXISTS (SELECT 1 FROM dbo.Result WITH (UPDLOCK, HOLDLOCK)
           WHERE UserId = @UserId AND RoundId = @RoundId)
    SELECT ... ;      -- trả bản ghi đã có
ELSE
    INSERT dbo.Result (...) VALUES (...);
COMMIT;
```

**Đo số thật:** đếm cặp (user, vòng) bị trùng theo ngày, trước và sau:

```sql
SELECT CAST(CreatedAt AS date) AS d, COUNT(*) AS dup_pairs
FROM (SELECT UserId, RoundId, MIN(CreatedAt) AS CreatedAt
      FROM dbo.Result GROUP BY UserId, RoundId HAVING COUNT(*) > 1) x
GROUP BY CAST(CreatedAt AS date);
```

**Câu hỏi xoáy:**

- **"Sao không dùng unique index?"** Unique index là cách tốt nhất nếu được sửa schema. Ràng buộc ở đây là không tạo object mới trên bảng dùng chung (mục 6).
- **"Applock khác `UPDLOCK, HOLDLOCK` thế nào?"** Applock khóa theo một tên logic, kể cả khi chưa có dòng nào. `HOLDLOCK` trên dòng chưa tồn tại phải dựa vào key-range lock, cần index phù hợp mới khóa đúng phạm vi.
- **"Đây có phải exactly-once không?"** Không. Message có thể đến nhiều lần (at-least-once); ghi nhận nghiệp vụ chỉ xảy ra một lần nhờ khóa theo key nghiệp vụ.
- **"Script Lua có làm nghẽn Redis không?"** Script chỉ có `GET` và `SET` trên một key, O(1), chạy vài micro-giây. Script dài mới nguy hiểm vì Redis chạy script nguyên khối.
- **"Mất Redis thì sao?"** Hệ thống chậm hơn và có thể cho mở 2 phiên, nhưng kết quả vẫn chỉ ghi một lần vì DB giữ tính đúng đắn.

### D2.6. Bỏ 12 stored procedure join chéo database

**Trạng thái:** Thật (mục 5). Lớp Redis mutex và idempotency key phía trên do đồng nghiệp viết.

**Câu hỏi xoáy bổ sung cho mục 5:**

- **"Đọc trước rồi ghi sau, có race không?"** Lần ghi chạy trong transaction `XACT_ABORT ON`, `UPDLOCK, HOLDLOCK` và kiểm tra lại cooldown, quota, thứ tự attempt. Hai request song song không thể cùng vượt quota.
- **"Table-valued parameter là gì?"** Truyền nhiều dòng vào procedure trong một lần gọi, qua một user-defined table type. Đỡ phải gọi nhiều lần hoặc ghép chuỗi.
- **"Nhiều round-trip hơn join chéo, có chậm không?"** 7 lần đọc + 1 lần ghi thay vì 1 lần gọi. Các lần đọc độc lập có thể chạy song song bằng `Task.WhenAll`. Đổi lại: ranh giới sở hữu dữ liệu rõ, tách DB sang server khác không cần linked server.
- **"Có rollback switch không?"** Lúc rollout có. Chính bạn hard-code cờ thành `true` ngay trong ngày (mục 5). Nói thẳng và nói bài học.

### D2.7. Polly, rate limit ở YARP, 99,9% khi service phía sau sập

**Trạng thái:** Minh họa.

**Mâu thuẫn phải tránh:** trong code thật, bạn **cố ý không đặt deadline** cho lời gọi gRPC gửi event (mục 3.2). Nếu kể bullet này, phải nói nhất quán: timeout áp cho lời gọi đồng bộ trên đường request; event chạy nền tách khỏi request thì không cần deadline, hoặc nên đưa vào hàng đợi bền.

**Kiến thức phải có:**

- **.NET 8 trở lên:** gói `Microsoft.Extensions.Http.Resilience`.
  ```csharp
  services.AddHttpClient<IEventClient, EventClient>()
          .AddStandardResilienceHandler();
  ```
  Pipeline mặc định, từ ngoài vào trong: rate limiter → total timeout → retry → circuit breaker → attempt timeout.
- **Retry:** chỉ cho thao tác idempotent hoặc có idempotency key; exponential backoff + jitter để tránh retry storm; giới hạn số lần.
- **Circuit breaker:** mở khi tỉ lệ lỗi vượt ngưỡng trong một cửa sổ lấy mẫu và đủ lưu lượng tối thiểu; sau thời gian nghỉ chuyển half-open để thử lại.
- **Bulkhead:** giới hạn số lời gọi đồng thời cho từng dependency, để một dependency chậm không chiếm hết thread và connection.
- **Rate limit ở YARP:** middleware rate limiting của ASP.NET Core.
  ```csharp
  builder.Services.AddRateLimiter(o => o.AddPolicy("per-user", ctx =>
      RateLimitPartition.GetTokenBucketLimiter(
          ctx.User.FindFirst("sub")?.Value
              ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
          _ => new TokenBucketRateLimiterOptions
          {
              TokenLimit = 20,
              TokensPerPeriod = 10,
              ReplenishmentPeriod = TimeSpan.FromSeconds(1)
          })));

  app.UseRateLimiter();
  app.MapReverseProxy();
  ```
  Gắn policy cho route YARP qua thuộc tính `RateLimiterPolicy` trong cấu hình route. Vượt giới hạn trả `429` kèm `Retry-After`.
- **Giới hạn của middleware:** bộ đếm nằm trong bộ nhớ từng pod. Muốn giới hạn toàn cục giữa nhiều pod thì cần token bucket trên Redis (script Lua).
- **"99,9% khi service phía sau sập 20 phút":** muốn đạt phải có degrade: tắt tính năng phụ (feed, ruby), luồng thi không phụ thuộc service đó. Đo bằng error rate trên APM trong đúng cửa sổ sự cố.

### D2.8. xUnit + Testcontainers làm merge gate

**Trạng thái:** Minh họa. Thật: có integration harness chạy trên SQL fixture cho logic sự kiện và ma trận đề; phần lớn còn lại test tay trên dev (mục 12).

**Kiến thức phải có:**

- **Testcontainers cho .NET:**
  ```csharp
  public sealed class DbFixture : IAsyncLifetime
  {
      public MsSqlContainer Sql { get; } = new MsSqlBuilder().Build();
      public RedisContainer Redis { get; } = new RedisBuilder().Build();

      public async Task InitializeAsync()
      {
          await Task.WhenAll(Sql.StartAsync(), Redis.StartAsync());
          // chạy script schema + stored procedure theo thứ tự đánh số
      }

      public async Task DisposeAsync()
      {
          await Sql.DisposeAsync();
          await Redis.DisposeAsync();
      }
  }
  ```
  Dùng `ICollectionFixture<DbFixture>` để nhiều test dùng chung container. Dùng Respawn để xóa dữ liệu giữa các test.
- **Jenkins:** agent có Docker; chạy `dotnet test`, xuất kết quả JUnit/TRX; branch chỉ merge được khi pipeline xanh.
- **Kim tự tháp test:** unit test cho planner và selector (logic thuần); integration cho procedure + Redis + Kafka; contract test cho API; rất ít end-to-end.
- **TDD:** red → green → refactor. Theo best practice, áp dụng TDD cho logic thuần như planner, selector, tính quota và cooldown: viết bảng case trước (`[Theory]` + `[InlineData]`), rồi mới code. Code chạm DB hoặc Redis thì dùng integration test. Không ép TDD cho code nối dây hoặc giao diện.
- **"Lỗi lọt 9 → 2":** phải định nghĩa "escaped defect" (bug phát hiện trên production, gắn với release) và lấy số từ bug tracker.

**Câu hỏi xoáy:**

- **"Test stored procedure thế nào?"** Container SQL Server thật + chạy script procedure. Lựa chọn khác: tSQLt.
- **"Test chạy bao lâu, chạy song song được không?"** Chia sẻ container theo collection; các collection chạy song song, mỗi collection một database riêng.
- **"Xử lý test flaky?"** Mỗi test tự tạo dữ liệu riêng; không phụ thuộc giờ thật (dùng `TimeProvider` của .NET 8); chờ theo điều kiện thay vì `Thread.Sleep`.

### D2.9. Design doc pipeline CDC → Kafka → ClickHouse

**Trạng thái:** Minh họa. Thật: warehouse báo cáo dùng SQL Agent job chạy mỗi giờ (mục 7). Roadmap mục 4A là cách biến bullet này thành thật.

**Vì sao cần (phần mở đầu của design doc):** warehouse hiện tại trễ tới khoảng 1 giờ, logic nằm trong SQL nên khó test và khó version, truy vấn tổng hợp trên SQL Server chậm dần khi dữ liệu lớn.

**Pipeline:**

1. **SQL Server CDC:** `sys.sp_cdc_enable_db`, rồi `sys.sp_cdc_enable_table` cho từng bảng nguồn. Capture job đọc transaction log, ghi vào bảng change.
2. **Debezium SQL Server connector** chạy trên Kafka Connect: chụp snapshot ban đầu, sau đó stream thay đổi. Mỗi bảng một topic.
3. **ClickHouse:** bảng `Kafka` engine đọc topic, materialized view ghi vào bảng `ReplacingMergeTree`, khử trùng theo version (LSN).
4. **API dashboard** đọc từ ClickHouse.

**Đặc tính:**

- Ngữ nghĩa at-least-once. `ReplacingMergeTree` chỉ khử trùng khi merge (chạy nền), nên truy vấn cần chính xác phải dùng `FINAL` hoặc `argMax`.
- Độ tươi dữ liệu = thời điểm ghi vào ClickHouse − thời điểm commit ở nguồn. Đo bằng cột timestamp ở cả hai đầu.

**Rủi ro phải ghi trong design doc:**

- CDC tăng tải transaction log. Nếu capture job dừng, log không truncate được (`log_reuse_wait_desc = REPLICATION`) và ổ đĩa đầy.
- Đổi schema bảng nguồn cần quy trình riêng.
- Thêm hạ tầng phải vận hành: Kafka Connect, ClickHouse.

**Phương án thay thế phải so sánh:** columnstore index ngay trên SQL Server (Standard Edition có từ 2016 SP1, nhưng giới hạn bộ nhớ columnstore và độ song song); đọc từ replica; tăng tần suất job hiện có.

**Câu hỏi xoáy:**

- **"Sao không dùng columnstore cho đơn giản?"** Nên thử trước. Nếu đạt mục tiêu thì không cần thêm hạ tầng. ClickHouse chỉ đáng khi dữ liệu và số dashboard vượt khả năng của SQL Server.
- **"Snapshot ban đầu bảng 580M dòng thế nào?"** Dùng incremental snapshot của Debezium (qua signal table), chạy ngoài giờ cao điểm, theo dõi tải lên nguồn.
- **"Dòng bị xóa ở nguồn thì sao?"** Debezium phát sự kiện delete và tombstone. Phía ClickHouse dùng cột cờ xóa (`is_deleted`) và lọc khi truy vấn.

### D2.10. SSO cho các sản phẩm

**Trạng thái:** Một phần (mục 10, B6, C3). Lõi BFF (PKCE, ticket store) đã có sẵn khi bạn vào. Phần của bạn: hardening BFF, đưa IOE web và IOSTEM vào SSO. "Unified sign-on for 4 products" và "ticket −35%" là minh họa.

**Cách nói:** "Lõi BFF có sẵn. Tôi hardening nó và làm phần SSO phía client cho IOE web và IOSTEM."

**Kiến thức phải có:**

- **Authorization Code + PKCE:** client sinh `code_verifier` ngẫu nhiên (43–128 ký tự), gửi `code_challenge = BASE64URL(SHA256(code_verifier))`; lúc đổi code lấy token phải gửi lại `code_verifier`. Kẻ chặn được `code` cũng không đổi được token.
- **BFF:** token nằm ở server; trình duyệt chỉ giữ cookie `HttpOnly`, `SameSite=Lax`. Ticket lưu trên Redis; data protection key lưu trên Redis để mọi pod giải mã được cookie.
- **Silent SSO** bằng redirect cả trang, vì cookie bên thứ ba bị chặn (Safari ITP, Firefox ETP), nên cách dùng iframe không còn tin cậy.
- **Đồng bộ giữa các tab** bằng `BroadcastChannel`.
- **Kiểm tra JWT đúng cách:**
  - Chữ ký qua JWKS: cache khóa, chọn khóa theo `kid`, hỗ trợ xoay khóa.
  - Kiểm `iss`, `aud`, `exp`, `nbf` với độ lệch giờ nhỏ.
  - Cố định thuật toán: chặn `alg: none` và lỗi nhầm RS256 với HS256.
  - Access token ngắn hạn; refresh token xoay vòng, phát hiện token cũ bị dùng lại.

**Câu hỏi xoáy:**

- **"`SameSite=Lax` đủ chống CSRF chưa?"** Chặn được POST từ site khác, nhưng GET có tác dụng phụ vẫn nguy hiểm. Vì vậy BFF bật thêm antiforgery token.
- **"Logout một app thì các app khác thế nào?"** Xóa session trên Redis và dùng front-channel hoặc back-channel logout của OIDC để báo các app còn lại.
- **"Vì sao SSO làm giảm ticket đăng nhập?"** Một tài khoản cho nhiều app nên ít quên mật khẩu; silent login nên ít phải đăng nhập lại; logout đồng bộ nên ít trạng thái lệch giữa các app.
- **"Ticket giảm 35% đo thế nào?"** Theo best practice: gắn nhãn ticket theo loại trên hệ thống CSKH, so 4–8 tuần trước và sau khi bật SSO, chia cho số người dùng hoạt động để loại ảnh hưởng của mùa thi.

### D2.11. Leaderboard realtime cho IOM

**Trạng thái:** Một phần. Bạn code toàn bộ luồng (C2). 10K người chơi là ước lượng của bạn, chưa đo. 150 ms là minh họa.

**Cơ chế** (C2, B4):

- Producer gửi sự kiện điểm vào Kafka, partition theo `matchId` để giữ thứ tự trong một trận.
- Consumer ghi vào Redis sorted set; API đọc top-N bằng `ZREVRANGE`, hạng của user bằng `ZREVRANK`.
- **Replay an toàn:** dùng `ZADD` với điểm tuyệt đối (thêm `GT` để chỉ cập nhật khi điểm lớn hơn) thay vì `ZINCRBY`. Message bị gửi lại không làm điểm tăng gấp đôi.
- **Phá hòa điểm:** mã hóa điểm và thời gian vào một số, ví dụ `score = points × 10^10 + (10^10 − 1 − finishEpochSeconds)`. Lưu ý score là số double, chỉ chính xác tới khoảng 2^53, nên phải tính trước giới hạn điểm.
- **Dựng lại khi Redis mất dữ liệu:** đọc lại từ DB, hoặc replay Kafka từ offset cũ.

**Đo số thật:**

- Người chơi đồng thời cao nhất: số phiên đang mở lúc cao điểm.
- Độ trễ cập nhật hạng: histogram Prometheus của (thời điểm `ZADD` xong − timestamp của sự kiện), lấy p95.

**Câu hỏi xoáy:**

- **"Một key leaderboard toàn quốc có thành hot key không?"** Một key nằm trên một shard của Redis Cluster. Vài nghìn lệnh mỗi giây vẫn ổn với Redis. Nếu lớn hơn: chia key theo phòng hoặc mùa giải, gộp top-N định kỳ.
- **"Tốn bao nhiêu bộ nhớ?"** Mỗi member trong sorted set cỡ vài chục tới khoảng 100 byte, nên 10K người chơi chỉ khoảng 1 MB.

### D2.12. AI nháp dữ liệu ~35K trường

**Trạng thái:** Một phần. Luồng chụp bản AI và so với mỗi lần lưu là của bạn (mục 9, C4). Phần trích xuất có thể không phải bạn viết. 94% và "6 → 1,5 phút" là minh họa.

**Đo số thật:** query độ chính xác ở roadmap 1.3, chạy trên **production**. Thời gian duyệt: trung vị của (lúc duyệt − lúc tạo phiếu) từ log.

**Câu hỏi xoáy:**

- **"Phần trích xuất làm thế nào?"** Theo best practice:
  - OCR rồi đưa văn bản cho LLM, hoặc dùng thẳng LLM đọc được ảnh.
  - Bắt LLM trả về JSON theo schema cố định (structured output), nhiệt độ thấp, prompt có vài ví dụ mẫu.
  - Kiểm tra bằng rule sau khi trích xuất: mã đơn vị phải tồn tại, tỉnh và xã phải khớp danh mục, tên trường so khớp gần đúng với danh mục.
  - Lưu phiên bản prompt cùng kết quả để so độ chính xác giữa các lần đổi prompt.
- **"Dùng model nào?"** Nếu không chắc model cụ thể, nói tiêu chí chọn: độ chính xác trên một tập mẫu có nhãn, chi phí mỗi phiếu, độ trễ, và yêu cầu dữ liệu không rời khỏi hạ tầng cho phép.
- **"Khi nào tin bản AI mà không cần người duyệt?"** Đặt ngưỡng theo từng loại trường dựa trên độ chính xác đo được, và vẫn lấy mẫu kiểm tra định kỳ.
- **"Bước đánh giá lỗi thì sao?"** Chỉ ghi log, không làm hỏng lần lưu phiếu.

### D2.13. Nâng ~70 project lên .NET 10

**Trạng thái:** Thật (mục 11). Đếm lại chính xác số service trước khi nói "12".

**Bổ sung cho mục 11:**

- **Mốc hỗ trợ:** .NET 10 là bản LTS, ra tháng 11/2025, hỗ trợ 3 năm. .NET 6 hết hỗ trợ tháng 11/2024; .NET 5 hết từ tháng 05/2022.
- **"Sao không lên .NET 8?"** .NET 8 cũng là LTS nhưng hết hỗ trợ tháng 11/2026. Lên thẳng .NET 10 để khỏi phải nâng hai lần.
- **"Shim là gì?"** Lớp adapter giữ nguyên API cũ (ví dụ helper HTTP dạng static) nhưng bên trong gọi cách làm mới (`IHttpClientFactory` qua DI). Business code không phải sửa.
- **"Rollout thế nào?"** Từng service một: build trên máy thật, chạy thử trên dev, rồi deploy.

### D2.14. Mentor và knowledge base

**Trạng thái:** Một phần. Knowledge base là thật: AI soạn nháp, bạn review và giữ cấu trúc (mục 12). Mentor 2 người và "4 tuần → 10 ngày" là minh họa. Roadmap 3.2 là cách làm thật.

**Kiến thức phải có:**

- Kế hoạch onboarding 30-60-90 ngày, giao việc tăng dần độ khó.
- Review PR theo hướng dạy: giải thích lý do, không chỉ sửa hộ.
- Đo: thời gian tới PR đầu tiên được merge = ngày merge PR đầu − ngày vào công ty.

### D2.15. Skill Claude Code và MCP server

**Trạng thái:** Một phần. Skill là thật (`ioe-event`, `upgrade-net10-consumer`). Nếu bạn chỉ cài và cấu hình MCP server có sẵn (Roslyn, SQL Server, git), phải sửa "Built" thành "Set up". "3 ngày → 1" là minh họa.

**Kiến thức phải có:**

- **MCP (Model Context Protocol):** giao thức để AI agent gọi công cụ bên ngoài. Server cung cấp tool và resource qua STDIO hoặc HTTP.
- **Skill:** file hướng dẫn cho agent, ghi quy trình chuẩn (bộ câu hỏi, các bước khảo sát code và DB, mẫu SQL).
- **An toàn khi dùng AI:** MCP chỉ có quyền đọc DB dev, đọc từng diff, build trên máy thật, chạy trên DB dev trước khi merge (mục 12).

---

## D3. AvePoint: Examena

### D3.1. Dẫn team 8 người tới kỳ thi 3.000+ thí sinh

**Trạng thái:** Thật (C5). "Scrum" và "sprint planning" chỉ giữ nếu team thật sự chạy Scrum.

**Phải kể được** (C5), kèm câu trả lời theo best practice:

- **Quyết định kiến trúc:** SFU thay mesh (D3.2); tách AI khỏi luồng video (D3.3); GitOps để rollback bằng Git (D3.5). Mỗi quyết định nói theo khung: vấn đề → phương án → chọn gì → đánh đổi.
- **Phân việc:** chia theo thành phần có người chịu trách nhiệm rõ: signaling, media server, API thi, frontend, AI, hạ tầng. Việc rủi ro cao giao cho người có kinh nghiệm, kèm một người học cùng.
- **Phối hợp:** product chốt phạm vi ở sprint planning và xem demo ở sprint review; QA có test plan riêng cho mỗi kỳ thi; DevOps theo checklist release.
- **Một lần trễ hạn:** phát hiện sớm qua burndown; ngồi với product cắt phạm vi, giữ luồng thi chính; báo sớm cho khách hàng kèm mốc mới; retro để sửa cách ước lượng.

**Scrum:** sprint 1–2 tuần; planning, daily, review, retro; ước lượng (story point hoặc thời gian); definition of done. Nói được team bạn làm khác sách ở đâu.

### D3.2. MediaSoup SFU thay cho mesh

**Trạng thái:** Một phần. SFU thay mesh là thật. "6 SFU workers" là minh họa (C5: bạn không nhớ cấu hình worker).

**Kiến thức phải có** (C5):

- **Worker** là một process C++, mỗi worker gắn một CPU core. **Router** nằm trong worker, thường mỗi phòng thi một router. Thí sinh có **producer**, giám thị có **consumer**, kết nối qua `WebRtcTransport`.
- Muốn một phòng vượt quá một worker: `pipeToRouter` nối router giữa các worker.
- **Simulcast hoặc SVC:** thí sinh gửi nhiều lớp chất lượng; giám thị xem lưới nhiều người thì nhận lớp thấp.
- **TURN** (ví dụ coturn) cho mạng NAT khó; truyền media qua DTLS-SRTP.
- **Cách ước lượng số worker:**
  - Tài liệu mediasoup cho biết một worker thường chịu được khoảng 500 consumer, tùy CPU.
  - Nếu 3.000 thí sinh, mỗi giám thị xem 25 người và mỗi thí sinh chỉ có 1 giám thị xem, thì có khoảng 3.000 consumer, tức cần ít nhất 6 worker, chưa tính dư phòng.
  - Băng thông vào SFU: 3.000 × 300–500 kbps ≈ 0,9–1,5 Gbps.

**Câu hỏi xoáy:**

- **"SFU, MCU, mesh khác nhau thế nào?"** Mesh: mỗi peer gửi N luồng, không scale. MCU: server trộn hình, tốn CPU, mất linh hoạt. SFU: server chỉ chuyển tiếp, mỗi thí sinh gửi 1 luồng.
- **"Thí sinh rớt mạng thì sao?"** ICE restart, client tự kết nối lại; giám thị thấy trạng thái mất kết nối và có log.
- **"Ghi hình thế nào?"** `PlainTransport` đẩy RTP sang FFmpeg hoặc GStreamer để ghi file.

### D3.3. AI chống gian lận nằm ngoài luồng video

**Trạng thái:** Một phần. Có tích hợp AI là thật. "2 khung/s" và "< 300 ms" là minh họa. C5 hỏi model chạy ở đâu, lấy mẫu bao nhiêu, tối ưu gì; câu trả lời theo best practice:

- **Thiết kế lai:** model nhẹ chạy ở client (phát hiện khuôn mặt, ví dụ MediaPipe hoặc TensorFlow.js) cho tín hiệu tức thời, chỉ gửi sự kiện lên server, không gửi thêm video. Server lấy mẫu 1–2 ảnh mỗi giây cho thí sinh bị gắn cờ và xác minh bằng model nặng hơn.
- **Tối ưu để video không giật:** chạy inference trong Web Worker hoặc trên GPU qua WebGL; giảm độ phân giải đầu vào (ví dụ 320×240); bỏ khung khi CPU bận; không chạy chung luồng với phần mã hóa video.

**Kiến thức phải có:**

- **Chạy ở client:** rẻ cho server, nhưng phụ thuộc máy thí sinh và có thể bị can thiệp.
- **Chạy ở server:** lấy khung hình từ luồng (qua `PlainTransport` → giải mã) hoặc ảnh chụp do client gửi; tốn GPU nhưng kiểm soát được.
- **Tín hiệu thường dùng:** không có mặt, nhiều khuôn mặt, nhìn ra ngoài lâu, có điện thoại, rời tab (sự kiện phía client).
- **Ngoài luồng video:** suy luận chạy bất đồng bộ; sự kiện bị gắn cờ đi qua hàng đợi tới người duyệt. Video của giám thị không phải chờ model.
- **Báo động giả:** luôn có người xác nhận trước khi xử lý thí sinh.

### D3.4. Load test bằng k6 trước release

**Trạng thái:** Minh họa.

**Kiến thức phải có:**

- **k6:** scenario `ramping-arrival-rate` để tăng tải theo số request mỗi giây; `thresholds` (ví dụ `http_req_duration: ['p(95)<500']`) để test tự fail; module WebSocket để test signaling.
- **Bẫy hay bị hỏi: k6 không giả lập được media WebRTC.** Muốn test media phải dùng bot trình duyệt headless (Playwright hoặc Puppeteer với cờ `--use-fake-device-for-media-stream`) hoặc dịch vụ chuyên dụng.
- **Làm gate:** chạy trên staging trước mỗi release lớn; so kết quả với lần chạy trước để phát hiện suy giảm năng lực.

### D3.5. GitOps trên Azure

**Trạng thái:** Một phần. Docker, Helm, Terraform, GitLab CI, Argo CD là thật. Azure (AKS) và "deploy hằng ngày" là minh họa. Nếu hạ tầng thật không phải Azure thì sửa CV theo cloud thật.

**Kiến thức phải có:**

- **Luồng:** GitLab CI build image → đẩy lên registry → cập nhật image tag trong repo cấu hình (Helm values) → Argo CD thấy Git thay đổi và sync vào cluster.
- **Rollback:** `git revert` commit cấu hình, hoặc chọn bản trước trong lịch sử Argo CD.
- **Terraform:** tạo cluster, mạng, registry; state lưu remote có khóa (ví dụ Azure Storage).
- **Deploy hằng ngày an toàn:** thay đổi nhỏ, trunk-based development, feature flag, rollout dần.

### D3.6. Sửa 14 lỗi pentest

**Trạng thái:** Minh họa.

**Kiến thức phải có:**

- **OWASP Top 10:2025** (công bố 11/2025, bản chính thức 01/2026): A01 Broken Access Control (đã gộp SSRF), A02 Security Misconfiguration, A03 Software Supply Chain Failures (mới), A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Logging & Alerting Failures, A10 Mishandling of Exceptional Conditions (mới). Danh sách đầy đủ ở owasp.org/Top10/2025.
- **So với bản 2021:** Broken Access Control vẫn đứng đầu; Security Misconfiguration lên hạng 2; Cryptographic Failures, Injection, Insecure Design cùng xuống 3 bậc; thêm hai mục mới là chuỗi cung ứng phần mềm và xử lý tình huống bất thường.
- **Lỗi hay gặp và cách sửa:**
  - IDOR: kiểm tra quyền theo từng resource, không chỉ theo role.
  - JWT: như D2.10 (cố định thuật toán, kiểm `aud`, `iss`, hạn ngắn).
  - Không giới hạn số lần thử đăng nhập hoặc OTP: thêm rate limit.
  - Thiếu header bảo mật: CSP, HSTS.
  - Secret nằm trong file config: chuyển sang secret store.
  - Thư viện có lỗ hổng: quét dependency trong CI.
- **Quy trình:** phân loại theo mức độ (CVSS), sửa, nhờ bên pentest kiểm tra lại.

### D3.7. Tuyển người và phát triển team

**Trạng thái:** Minh họa.

**Kiến thức phải có:** phỏng vấn có cấu trúc với bảng tiêu chí chấm; 1:1 hằng tuần; góp ý theo mô hình SBI (tình huống, hành vi, tác động); hồ sơ đề xuất lên level dựa trên bằng chứng công việc.

### D3.8. Vận hành ngày thi

**Trạng thái:** Minh họa.

**Kiến thức phải có:**

- **Trước kỳ thi:** checklist; scale SFU và API trước giờ thi; làm nóng cache; đóng băng deploy.
- **Trong kỳ thi:** phòng trực (war room), dashboard trực tiếp, runbook cho từng loại sự cố, kênh liên lạc với khách hàng.
- **Sau kỳ thi:** họp rút kinh nghiệm, cập nhật runbook.

---

## D4. AvePoint: IAS 2.0

### D4.1. Tách monolith thành microservice

**Trạng thái:** Một phần. Migrate sang .NET với CQRS và RabbitMQ là thật (mục 13, C6). "9 microservices", DDD và strangler là minh họa.

**Kiến thức phải có:**

- **DDD:** bounded context, ngôn ngữ chung (ubiquitous language), context map, anti-corruption layer để cách ly với hệ cũ.
- **Strangler fig:** đặt proxy phía trước, chuyển từng endpoint sang hệ mới; hai hệ chạy song song; đối soát dữ liệu hằng đêm.
- **CQRS read model:** projection cập nhật qua event, nên dữ liệu đọc trễ một chút (eventual consistency).

**Câu hỏi xoáy:**

- **"Chia service theo tiêu chí gì?"** Theo năng lực nghiệp vụ và bounded context, không theo bảng.
- **"Làm sao tránh distributed monolith?"** Mỗi service có dữ liệu riêng; tránh chuỗi gọi đồng bộ dài; giao tiếp qua event khi có thể.
- **"Kể tên 9 service?"** Cách chia theo best practice cho nền tảng giáo dục, mỗi service một bounded context: Identity & Access, Organization (trường, lớp), Course Catalog, Enrollment, Learning Content, Assessment, Grading, Notification, Reporting. Nếu hệ thật chia khác thì nói theo hệ thật.

### D4.2. PostgreSQL replica và MongoDB sharding

**Trạng thái:** Một phần. Replication và sharding là thật. Shard theo tenant và "900 → 120 ms" là minh họa.

**Kiến thức phải có:**

- **PostgreSQL streaming replication:** replica đọc được; replication lag gây lỗi read-your-writes. Xử lý: đọc từ primary ngay sau khi ghi, hoặc chờ replica bắt kịp LSN.
- **Vì sao chuyển đọc sang replica làm giảm latency ghi:** primary bớt tranh chấp I/O, khóa và buffer cache với truy vấn báo cáo.
- **MongoDB shard key:**
  - Chỉ dùng `tenantId` thì tenant lớn tạo chunk quá to và hotspot.
  - Dùng khóa ghép `{ tenantId: 1, _id: "hashed" }` (MongoDB 4.4 trở lên): truy vấn có `tenantId` vẫn đi đúng shard, dữ liệu một tenant lớn vẫn rải đều.
  - Truy vấn không có shard key sẽ phải hỏi mọi shard (scatter-gather).

### D4.3. Outbox, saga, hết đăng ký trùng

**Trạng thái:** Minh họa (mục 14: chưa có bằng chứng dùng Saga, Outbox).

**Kiến thức phải có** (mục 13, B5):

- **Transactional outbox:** ghi dữ liệu nghiệp vụ và dòng outbox trong cùng transaction; một relay (polling hoặc CDC) publish ra RabbitMQ; consumer idempotent bằng bảng inbox hoặc khử trùng theo `messageId`.
- **Saga:**
  - Orchestration: một state machine điều phối (ví dụ MassTransit).
  - Choreography: các service phản ứng với event của nhau.
  - Mỗi bước có hành động bù trừ (hủy giữ chỗ, hoàn tiền) và timeout.
- **Eventual consistency trên giao diện:** hiển thị trạng thái "đang xử lý", không hứa kết quả ngay.
- **Hết đăng ký trùng:** consumer idempotent + unique constraint trên (tenant, học viên, khóa học).

---

## D5. Mục Skills: mỗi keyword nói được trong 30 giây

Interviewer hay chỉ vào một keyword rồi hỏi "kể một lần bạn dùng nó". Cột cuối ghi bằng chứng thật nếu có. Keyword không có bằng chứng thì chỉ nói ở mức hiểu biết.

### Core backend

| Keyword | Nói được gì | Bằng chứng thật |
|---|---|---|
| ASP.NET Core, Web API, Minimal APIs | Pipeline middleware, DI, controller và Minimal APIs khác nhau ở đâu (Minimal ít nghi thức hơn, filter và validation phải tự gắn). | Các service IOE; BFF dùng Minimal APIs (B6) |
| REST APIs | Resource và HTTP verb, mã trạng thái, idempotency của PUT/DELETE, phân trang, versioning. | Các API IOE |
| gRPC | HTTP/2, Protobuf, streaming, deadline, dùng lại `GrpcChannel` vì tạo mới tốn socket và handshake. | Fix tái dùng channel (mục 3.2) |
| async/await | Không chặn thread khi chờ I/O; tránh `async void`; `Task.WhenAll` cho việc độc lập; tránh `.Result` gây deadlock và cạn thread pool. | Fix `async void` khi ghi cache (mục 3.2) |
| LINQ | Deferred execution; `IQueryable` dịch ra SQL, còn `IEnumerable` chạy trong bộ nhớ; cẩn thận N+1 khi lặp. | |
| EF Core, Dapper | EF Core: change tracking, migration, `AsNoTracking` cho đọc. Dapper: map nhanh, gần SQL. Nhóm của bạn gọi stored procedure. | |

### Architecture

| Keyword | Nói được gì | Bằng chứng thật |
|---|---|---|
| System design | Hỏi rõ yêu cầu → ước lượng tải → thiết kế → điểm nghẽn → cách hỏng → quan sát. Xem D6. | |
| Microservices | Deploy độc lập, dữ liệu riêng, giao tiếp qua API và event; cái giá: vận hành, nhất quán dữ liệu, debug phân tán. | 20+ service IOE |
| Event-driven architecture | Service phát event, service khác phản ứng; giảm phụ thuộc trực tiếp, đổi lại khó lần vết luồng. | Kafka kết thúc game (B2) |
| DDD | Bounded context, aggregate giữ bất biến, ngôn ngữ chung, anti-corruption layer. | Chưa có (mục 14) |
| Clean Architecture | Phụ thuộc hướng vào trong: domain không biết DB hay web; dễ test logic. | |
| SOLID | Nêu được ví dụ cho S (một lý do để đổi) và D (phụ thuộc vào abstraction, inject qua DI). | Shim `IHttpClient` qua DI (mục 11) |
| Design patterns | Template method, strategy, decorator (bọc cache quanh repository), factory. | Rank provider dùng template method (mục 8) |

### Databases

| Keyword | Nói được gì | Bằng chứng thật |
|---|---|---|
| T-SQL, stored procedures | Set-based thay vì RBAR; `SET NOCOUNT ON`; `XACT_ABORT ON`; parameter sniffing; TVP. | Mục 4.4, mục 5 |
| Query plans, indexing | Seek và scan; key lookup; covering index (`INCLUDE`); leftmost prefix; sargable. | Mục 2, 4.4 |
| Locking | Khóa S, U, X, Sch-M; `UPDLOCK, HOLDLOCK`; applock; RCSI giảm việc đọc chặn ghi. | Mục 6, B3 |
| PostgreSQL | MVCC, VACUUM, streaming replication, index B-tree/GIN. | AvePoint (D4.2) |
| MongoDB | Document model, shard key, index ghép, aggregation pipeline. | AvePoint (D4.2) |
| Redis | Kiểu dữ liệu (string, hash, set, sorted set), TTL, Lua, Redis Cluster theo hash slot, không dùng `KEYS`/`SCAN` trên đường nóng. | B3, B5, mục 4 |
| ClickHouse | Cột, MergeTree, materialized view, mạnh về tổng hợp, yếu về update từng dòng. | Chưa có (D2.9) |

### Distributed systems

| Keyword | Nói được gì | Bằng chứng thật |
|---|---|---|
| Kafka | Topic, partition, consumer group, offset; thứ tự chỉ trong một partition; at-least-once khi commit sau xử lý. | B2, D2.11 |
| RabbitMQ | Exchange (direct, topic, fanout), queue, ack, dead-letter queue, prefetch. | AvePoint |
| CQRS | Tách mô hình ghi và đọc; read model cập nhật qua event. | AvePoint |
| Saga | Chuỗi transaction cục bộ có bù trừ; orchestration và choreography. | Chưa có |
| Transactional outbox | Ghi nghiệp vụ và outbox chung transaction; relay publish sau. | Bảng outbox ở mastery chưa chung transaction (B5) |
| CDC (Debezium) | Đọc transaction log thành luồng thay đổi. | Chưa có |
| Idempotency | Cùng request lặp lại cho cùng kết quả: idempotency key, unique key, applock. | Mục 6, B3, B5 |
| Eventual consistency | Dữ liệu các nơi khớp nhau sau một khoảng trễ; giao diện phải xử lý trạng thái trung gian. | Warehouse trễ ~1 giờ (mục 7) |

### Resilience, security, testing, ops, observability

| Keyword | Nói được gì | Bằng chứng thật |
|---|---|---|
| Polly, circuit breaker, retry | D2.7. | Chưa có |
| Rate limiting | Token bucket, fixed và sliding window; theo user hay IP; giới hạn trong từng pod hay toàn cục. | Rate limiter cho API đọc (B5) |
| API gateway (YARP) | Định tuyến, auth, rate limit, chuyển đổi request ở một điểm vào. | BFF dùng YARP (B6) |
| High availability, scalability | Không có điểm hỏng đơn; scale ngang service stateless; dữ liệu cần replication và failover. | Nhiều pod, Redis Cluster |
| OAuth 2.0, OIDC, PKCE, JWT, BFF | D2.10. | Mục 10, B6 |
| OWASP Top 10 | D3.6. | |
| xUnit, Testcontainers, TDD | D2.8. | Harness SQL fixture (mục 12) |
| k6 | D3.4. | |
| Azure (AKS) | Cluster Kubernetes được quản lý; node pool; tích hợp registry và identity. | Phải xác nhận cloud thật |
| Docker, Kubernetes, Helm | Image nhiều tầng; Deployment, Service, HPA, readiness và liveness probe; Helm chart và values. | Manifest deploy IOE (mục 14) |
| Terraform, Argo CD, GitLab CI, Jenkins | D3.5; Jenkins shared library dùng chung cho mọi repo IOE. | Jenkins (mục 14) |
| OpenTelemetry, tracing, Grafana | D2.2. | |
| Prometheus | Counter, gauge, histogram; PromQL `rate`, `histogram_quantile`. | Metric worker Kafka (B2) |
| Elastic APM, Elasticsearch | Trace theo request, span; log NLog → Kafka → Elasticsearch. | Mục 2, B1 |
| SLO, burn-rate alerting | D2.2. | |

### Real-time, AI, cách làm việc

| Keyword | Nói được gì | Bằng chứng thật |
|---|---|---|
| WebRTC, MediaSoup SFU | D3.2. | Examena |
| LLM, human-in-the-loop | Mô hình đề xuất, người xác nhận, đo độ chính xác trên dữ liệu thật. | Mục 9 |
| Agile/Scrum | D3.1. | |
| Code review, design docs, postmortems | Review theo tiêu chí rõ; design doc có phương án thay thế; postmortem không đổ lỗi. | Review PR ở Examena; báo cáo audit |

---

## D6. Các bài system design hay gặp

Khung trả lời chung, khoảng 35–45 phút:

1. Hỏi rõ yêu cầu chức năng và phi chức năng (tải, độ trễ, tính đúng).
2. Ước lượng tải bằng con số.
3. Vẽ luồng chính.
4. Đào sâu điểm nghẽn.
5. Nêu cách hệ thống hỏng và cách chịu lỗi.
6. Nêu cách quan sát và vận hành.

### D6.1. Nền tảng thi trực tuyến cho 200K thí sinh đồng thời

**Yêu cầu:** bắt đầu thi đồng loạt, lưu bài tự động, nộp bài đúng một lần, không mở được 2 phiên, có kết quả và xếp hạng.

**Ước lượng:**

- Lưu bài mỗi 30 giây: 200.000 / 30 ≈ 6.700 lần ghi mỗi giây.
- Bắt đầu thi: 200K người trong 2 phút ≈ 1.700 request/giây trung bình, nhưng đỉnh ở giây đầu cao hơn nhiều. Cần phòng chờ hoặc token bucket để dàn tải.

**Thiết kế:**

- **Đề thi:** sinh trước và cache trên Redis. Request bắt đầu thi không phải sinh đề.
- **Phiên thi:** CAS trên Redis (B3).
- **Lưu bài:** ghi vào Redis (hash theo attempt), định kỳ hoặc qua Kafka ghi xuống DB.
- **Nộp bài:** idempotent bằng applock hoặc unique key; chấm bất đồng bộ qua Kafka.
- **Dữ liệu:** DB tách theo loại thi; replica cho tra cứu.
- **Xếp hạng:** tính sẵn (B4) hoặc sorted set realtime (D2.11).

**Khi hỏng:**

- Mất Redis: chậm hơn nhưng dữ liệu vẫn đúng, vì DB giữ tính đúng đắn.
- Kafka lag: kết quả về chậm nhưng không mất.
- Service phụ chậm: circuit breaker, tắt tính năng phụ.

**Quan sát:** SLO cho API bắt đầu thi và nộp bài; dashboard theo ca thi.

### D6.2. Leaderboard realtime

Xem D2.11 và B4. Phải nói được: chọn sorted set, cách phá hòa điểm, replay an toàn, hot key, dựng lại khi mất dữ liệu, và khi nào nên tính sẵn thay vì realtime.

### D6.3. API idempotent (nộp bài, thanh toán)

- Client gửi header `Idempotency-Key`.
- Server lưu (key → trạng thái, response) có TTL.
- Request trùng đang xử lý: chặn bằng lock theo key, trả `409` hoặc chờ.
- Request trùng đã xong: trả lại response đã lưu.
- DB vẫn có unique constraint làm lớp bảo vệ cuối.

### D6.4. Pipeline báo cáo

Xem D2.9: CDC, Kafka, kho cột; so với columnstore và replica; độ tươi dữ liệu; vận hành.

### D6.5. SSO cho nhiều sản phẩm

Xem D2.10: OIDC với PKCE, BFF, phiên phía server, silent SSO không dùng cookie bên thứ ba, logout toàn bộ.

---

## D7. Câu hỏi hành vi: chỉ dùng câu chuyện thật

| Câu hỏi | Câu chuyện thật nên dùng | Nguồn |
|---|---|---|
| Sự cố production lớn nhất | Đợt audit APM tháng 09/2026 và API bắt đầu thi 2,45 s | Mục 2, 3.1 |
| Quyết định kỹ thuật bạn phải bảo vệ | Không đặt deadline cho gRPC gửi event; không đánh index trên bảng log ghi liên tục | Mục 3.2, 2 |
| Một lần bạn sai | Hard-code cờ V3 quá sớm; commit cache-control bị revert trong ngày | Mục 5, 15 |
| Làm việc với team khác khi bất đồng | Kế hoạch hotfix ngày và index ca đêm với DBA | Mục 2 |
| Dẫn dắt team | Examena: một quyết định thiết kế, một lần chia lại việc, một PR đã chặn lại | C5 |
| Dùng AI thế nào, không tin AI ở đâu | Claude Code có review từng diff, build thật, chạy trên DB dev | Mục 12 |
| Tự tìm ra vấn đề không ai giao | Hai lỗi cache khiến procedure chạy 81M lần | Mục 4.1 |

Cấu trúc STAR: bối cảnh (1–2 câu), nhiệm vụ của bạn, hành động bạn làm (phần dài nhất, dùng "tôi"), kết quả có số. Mỗi câu chuyện tối đa 2 phút.

---

## D8. Checklist trước khi dùng CV này

- [ ] Với mỗi dòng **Minh họa** ở D0: làm thật và đo, hoặc bỏ khỏi CV, hoặc chuẩn bị câu "chưa triển khai, tôi sẽ làm thế này".
- [ ] Sửa hoặc đo chữ "p95" ở Summary và dòng 1.
- [ ] Sửa "Unified sign-on for 4 products" về đúng phạm vi bạn đã làm.
- [ ] Đổi "Built … MCP servers" thành "Set up" nếu bạn chỉ cài và cấu hình.
- [ ] Xác nhận cloud thật ở AvePoint (Azure hay khác) và team có chạy Scrum không.
- [ ] Đếm lại số service đã nâng lên .NET 10.
- [ ] Đọc lại Phần A–C cho các dòng **Thật**.
- [ ] Tự trả lời thành tiếng từng câu hỏi xoáy, mỗi câu dưới 2 phút.
- [ ] Làm thử D6.1 trên giấy trong 40 phút.
