# Phần IV. Kiến thức nền theo keyword trong CV

Mục Skills trong CV là một danh sách keyword, và interviewer thường dùng nó như một menu: chỉ vào một từ rồi hỏi "kể một lần bạn dùng nó". Câu hỏi đó kiểm tra hai thứ cùng lúc: bạn có hiểu keyword ở mức cơ chế không, và keyword đó có gắn với việc thật nào không. Trả lời trôi chảy phần lý thuyết nhưng không có câu chuyện thật thì bị đánh giá là "học thuộc"; có câu chuyện nhưng không giải thích được cơ chế thì bị nghi là "nhận việc của người khác".

Mỗi bài trong phần này dạy kiến thức nền của một nhóm keyword (định nghĩa, cơ chế, code ngắn, khi nào dùng, đánh đổi), rồi chốt bằng bảng **câu nói 30 giây và bằng chứng thật**. Cột bằng chứng giữ đúng nguồn: ô trống hoặc "Chưa có" nghĩa là bạn chỉ được nói ở mức hiểu biết, theo best practice. Các bài ở Phần II, III và VI đi sâu vào từng câu chuyện; phần này là nền để bạn không bị hỏi vặn ở tầng khái niệm.

## Chương 9. Core backend .NET

Chương này phủ các keyword nền của một backend .NET: pipeline của ASP.NET Core, DI, Minimal APIs, REST và gRPC, async/await, LINQ và truy cập dữ liệu. Đây là nhóm câu hỏi mở màn của hầu hết vòng kỹ thuật, nên trả lời sai ở đây làm mất điểm cho cả buổi.

Học xong chương, bạn giải thích được một request đi qua những tầng nào, vì sao một API chạy tốt lúc thấp tải lại timeout hàng loạt lúc cao điểm, và kể được các fix thật liên quan (`GrpcChannel` dùng chung, `async void` khi ghi cache) đúng phạm vi.

### Bài 9.1. ASP.NET Core pipeline, DI và Minimal APIs

#### Mục tiêu
- Sau bài này, bạn giải thích được middleware pipeline và vì sao thứ tự đăng ký quyết định hành vi.
- Phân biệt ba lifetime của DI, nhận ra captive dependency và biết cách phát hiện.
- So sánh controller với Minimal APIs, biết .NET 10 bổ sung gì cho Minimal APIs.
- Kể đúng phạm vi việc bạn làm trên BFF dùng Minimal APIs.

#### Middleware pipeline
Pipeline là một chuỗi delegate `RequestDelegate`. Mỗi middleware nhận `HttpContext`, làm việc trước, gọi `next(context)`, rồi làm việc sau khi tầng trong trả về. Middleware có thể **short-circuit**: trả response luôn mà không gọi `next` (file tĩnh, rate limiter trả `429`, CORS preflight).

```csharp
var app = builder.Build();
app.UseExceptionHandler("/error");  // ngoài cùng: bắt lỗi của mọi tầng bên trong
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("allow-list");          // sau routing, trước auth
app.UseAuthentication();            // xác định ai đang gọi
app.UseAuthorization();             // người đó được làm gì
app.UseRateLimiter();
app.MapControllers();
app.Run();
```

Bẫy hay gặp:
- Đặt `UseAuthorization` trước `UseAuthentication`: `HttpContext.User` chưa được điền, mọi endpoint có `[Authorize]` trả `401`.
- Middleware ghi header sau khi tầng trong đã bắt đầu ghi body: lỗi "response has already started".
- Exception handler đặt sau middleware gây lỗi thì không bắt được lỗi đó.

#### Dependency injection và lifetime
- **Transient:** tạo mới mỗi lần resolve. Hợp với service nhẹ, không trạng thái.
- **Scoped:** một instance cho mỗi request (mỗi scope). `DbContext` mặc định là scoped.
- **Singleton:** một instance cho cả process. Phải thread-safe.

**Captive dependency:** singleton giữ một service scoped, nên service scoped sống mãi và bị chia sẻ giữa các request. Với `DbContext` thì lỗi xuất hiện dưới dạng exception đa luồng hoặc dữ liệu tracking lẫn giữa request. Môi trường Development bật sẵn `ValidateScopes` để báo lỗi này khi resolve. Trong `BackgroundService` (singleton), muốn dùng service scoped thì tự tạo scope:

```csharp
public sealed class Worker(IServiceScopeFactory scopes) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            await using var scope = scopes.CreateAsyncScope();
            var repo = scope.ServiceProvider.GetRequiredService<IResultRepository>();
            await repo.FlushAsync(ct);
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }
}
```

Hai tính năng nên biết thêm: **keyed services** (.NET 8, `AddKeyedSingleton<IStore, RedisStore>("redis")` và `[FromKeyedServices("redis")]`) và **options pattern**: `IOptions<T>` đọc một lần, `IOptionsSnapshot<T>` đọc lại mỗi request (scoped), `IOptionsMonitor<T>` là singleton nhận thông báo khi config đổi. `ValidateOnStart()` làm app fail ngay lúc khởi động nếu config sai, thay vì fail ở request đầu tiên.

#### Controller và Minimal APIs

| Tiêu chí | Controller (`[ApiController]`) | Minimal APIs |
|---|---|---|
| Khai báo | Class, attribute routing | `app.MapGet/MapPost`, `MapGroup` |
| Validation model | Tự động trả `400` | Trước .NET 10 phải tự gắn (filter, FluentValidation); .NET 10 có `builder.Services.AddValidation()` cho DataAnnotations |
| Mở rộng | Action filter, convention | Endpoint filter (`AddEndpointFilter`) |
| Native AOT | Không hỗ trợ | Hỗ trợ |
| Hợp với | API lớn, nhiều convention chung | BFF, gateway, service nhỏ |

```csharp
var exams = app.MapGroup("/api/exams").RequireAuthorization();
exams.MapGet("/{id:int}", async Task<Results<Ok<ExamDto>, NotFound>> (
        int id, IExamService svc, CancellationToken ct) =>
    await svc.GetAsync(id, ct) is { } dto ? TypedResults.Ok(dto) : TypedResults.NotFound());
```

`TypedResults` cho kiểu trả về rõ ràng, OpenAPI sinh đúng schema và test dễ hơn. Hai kiểu dùng chung được trong một app.

> **Ghi nhớ:** Ở các service IOE, controller mỏng, logic nằm ở tầng proxy trong thư viện dùng chung, truy cập DB qua stored procedure (nguồn: B1). BFF identity viết bằng Minimal APIs và YARP; phần lõi PKCE và ticket store không phải của bạn (nguồn: mục 10).

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| ASP.NET Core, Web API, Minimal APIs | Request đi qua chuỗi middleware theo đúng thứ tự đăng ký; DI có ba lifetime, lỗi hay gặp là singleton giữ scoped. Minimal APIs ít nghi thức, hợp BFF và gateway, filter và validation phải tự gắn (.NET 10 có `AddValidation`); controller hợp API lớn nhiều convention. | Các service IOE; BFF dùng Minimal APIs (B6) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng Minimal APIs?"** BFF identity của nền tảng viết bằng Minimal APIs, YARP proxy tới identity server và user service. Lõi BFF (PKCE, ticket store) có sẵn khi tôi vào. Phần của tôi là hardening: CORS allow-list theo config, cookie "Remember" 7 ngày còn không chọn thì là session cookie, chuyển các endpoint status, verify-token, token sang POST để token không nằm trong URL hay log, thêm feature flag cho Cloudflare Turnstile.
- **"Đặt `UseAuthorization` trước `UseAuthentication` thì chuyện gì xảy ra?"** Authorization chạy khi `HttpContext.User` chưa được xác thực, nên mọi endpoint yêu cầu đăng nhập trả `401` dù token hợp lệ. Thứ tự đúng: routing, CORS, authentication, authorization, rồi endpoint.
- **"Captive dependency là gì, phát hiện thế nào?"** Service sống lâu (singleton) giữ service sống ngắn (scoped), làm service scoped bị dùng chung giữa các request. Phát hiện bằng `ValidateScopes` (bật sẵn ở Development) hoặc `ValidateOnBuild`. Sửa bằng cách đổi lifetime hoặc tạo scope qua `IServiceScopeFactory`.
- **"`IOptions`, `IOptionsSnapshot`, `IOptionsMonitor` khác nhau thế nào?"** `IOptions` đọc một lần lúc khởi tạo. `IOptionsSnapshot` là scoped, đọc lại theo từng request, không inject được vào singleton. `IOptionsMonitor` là singleton, luôn trả giá trị mới nhất và có `OnChange`.
- **"Khi nào bạn chọn Minimal APIs thay vì controller?"** Service nhỏ, BFF, gateway, cần startup nhanh hoặc Native AOT. API lớn nhiều filter và convention chung thì controller gọn hơn. Không phải chọn một: hai kiểu chạy chung được.

#### Tóm tắt
- Pipeline là chuỗi middleware; thứ tự đăng ký là thứ tự chạy, và exception handler phải ở ngoài cùng.
- Ba lifetime: transient, scoped, singleton; captive dependency là lỗi kinh điển.
- Options pattern có ba interface với vòng đời khác nhau; dùng `ValidateOnStart` để fail sớm.
- Minimal APIs ít nghi thức, hỗ trợ AOT; .NET 10 có validation sẵn qua `AddValidation`.

#### Bài tập
1. Tạo project `dotnet new web`, viết middleware ghi thời gian trước và sau `next`. Đăng ký `UseAuthorization` trước `UseAuthentication` với một endpoint có `RequireAuthorization()`, gửi request có token hợp lệ và quan sát kết quả.
   **Đáp án:** Nhận `401` vì `User` chưa được điền khi authorization chạy. Đổi lại thứ tự thì nhận `200`. Middleware đo thời gian cho thấy phần "sau" chạy theo thứ tự ngược với phần "trước".
2. Đăng ký một service scoped chứa `Guid Id = Guid.NewGuid()`, inject nó vào một singleton, gọi endpoint hai lần. Sau đó chạy ở môi trường Development.
   **Đáp án:** Ở Production, hai request in cùng một Guid (captive). Ở Development, app ném `InvalidOperationException` "Cannot consume scoped service ... from singleton" nhờ `ValidateScopes`.
3. Trên .NET 10, khai báo `record CreateExam([Required] string Name, [Range(1, 180)] int Minutes)`, gọi `builder.Services.AddValidation()`, map một endpoint POST nhận record này và gửi `Minutes = 0`.
   **Đáp án:** Endpoint trả `400` dạng ProblemDetails liệt kê lỗi của `Minutes` mà không cần filter tự viết.

### Bài 9.2. REST và gRPC

#### Mục tiêu
- Sau bài này, bạn trình bày được HTTP verb, tính idempotent, mã trạng thái, phân trang và versioning của một REST API.
- Giải thích được gRPC chạy trên HTTP/2 thế nào, vì sao phải dùng lại `GrpcChannel` và khi nào đặt deadline.
- Kể đúng fix gRPC thật của bạn và lý do cố ý không đặt deadline.

#### REST: verb, idempotency, mã trạng thái
REST mô hình hóa hệ thống thành **resource** (`/exams/42/attempts`) và thao tác bằng HTTP verb.

| Verb | Safe | Idempotent | Ghi chú |
|---|---|---|---|
| GET | Có | Có | Không được có tác dụng phụ |
| PUT | Không | Có | Thay toàn bộ resource; gửi lại cho cùng kết quả |
| DELETE | Không | Có | Xóa lần hai vẫn là "đã xóa" (có thể trả `404`) |
| POST | Không | Không | Tạo mới; muốn retry an toàn thì cần idempotency key |
| PATCH | Không | Không bắt buộc | Tùy cách định nghĩa patch |

Mã trạng thái nên dùng đúng: `201` kèm `Location` khi tạo, `204` khi không có body, `400` input sai, `401` chưa xác thực, `403` không có quyền, `404`, `409` xung đột trạng thái, `422` sai nghiệp vụ, `429` vượt giới hạn kèm `Retry-After`, `503` khi phụ thuộc chết. Body lỗi theo **ProblemDetails** (RFC 9457).

**Phân trang:** offset (`?page=500&size=20`) phải đọc và bỏ qua 10.000 dòng, càng về sau càng chậm và lệch khi có dòng mới chèn vào. **Keyset/cursor** (`WHERE Id < @lastId ORDER BY Id DESC`) seek thẳng index, ổn định trên bảng lớn. **Versioning:** theo URL (`/v3/...`) dễ nhìn và dễ route ở gateway; theo header gọn URL nhưng khó debug.

#### gRPC
gRPC dùng **Protobuf** làm hợp đồng (file `.proto` sinh client và server) và chạy trên **HTTP/2**: nhiều lời gọi song song (stream) trên một kết nối TCP. Có 4 kiểu: unary, server streaming, client streaming, bidirectional streaming.

Ba điểm vận hành phải nắm:
- **Dùng lại channel.** `GrpcChannel` giữ kết nối HTTP/2. Tạo mới mỗi lần gọi là mỗi lần mở TCP, handshake TLS và HTTP/2, tốn socket. Dùng `AddGrpcClient` (client factory) để framework quản lý channel. Một kết nối HTTP/2 thường giới hạn 100 stream đồng thời; tải cao thì bật `EnableMultipleHttp2Connections`.
- **Deadline.** Client đặt hạn chót; server nhận được qua `ServerCallContext.Deadline` và nên truyền tiếp cho lời gọi phía sau. Không đặt deadline thì lời gọi đồng bộ có thể treo vô hạn.
- **Cân bằng tải.** Load balancer L4 chỉ cân bằng theo kết nối; kết nối HTTP/2 sống lâu nên mọi request dồn vào một pod. Cần client-side load balancing hoặc proxy L7 (Envoy, service mesh).

```csharp
builder.Services
    .AddGrpcClient<EventPush.EventPushClient>(o => o.Address = new Uri(cfg["EventService:Url"]!))
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        EnableMultipleHttp2Connections = true,
        PooledConnectionIdleTimeout = Timeout.InfiniteTimeSpan
    });

// Lời gọi đồng bộ trên đường request: luôn có deadline
await client.PushAsync(req, deadline: DateTime.UtcNow.AddSeconds(2), cancellationToken: ct);
```

Khi nào không dùng gRPC: API công khai cho trình duyệt (cần gRPC-Web hoặc REST), tích hợp với bên thứ ba quen REST, payload cần đọc bằng mắt khi debug.

#### Câu chuyện thật: event gRPC trong API cập nhật thông tin
Trong commit 22/09 (của bạn, nguồn: mục 3.2), trace APM của API cập nhật thông tin GDPT là 504 ms. Một phần nguyên nhân: mỗi lần gửi event gRPC lại tạo `GrpcChannel` mới, và đoạn chạy đồng bộ trước `await` đầu tiên giữ thread của request khoảng 9 ms. Cách sửa: dùng chung một channel, gửi event trong `Task.Run` để ra khỏi luồng HTTP, và **cố ý không đặt deadline** vì service nhận có lúc chậm tới 3,6 s; đặt deadline sẽ làm rơi event, tức là đổi hành vi nghiệp vụ. Báo cáo chỉ ghi mục tiêu "dự kiến dưới 60 ms", chưa đo lại.

> **Cảnh báo:** Không nói API đã xuống dưới 60 ms khi chưa có trace APM sau deploy.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| REST APIs | Resource và verb; GET, PUT, DELETE idempotent còn POST thì không, nên POST cần idempotency key; mã trạng thái đúng nghĩa, ProblemDetails; phân trang keyset cho bảng lớn; versioning theo URL. | Các API IOE |
| gRPC | Protobuf trên HTTP/2, có streaming và deadline. Channel phải dùng lại vì tạo mới tốn socket và handshake; sau L4 load balancer phải cân bằng phía client hoặc qua proxy L7. | Fix tái dùng channel (mục 3.2) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng gRPC?"** Các service push event (ruby, feed) sang event-service qua gRPC. Ở API cập nhật thông tin GDPT, tôi thấy mỗi lần gửi event lại tạo `GrpcChannel` mới. Tôi sửa thành dùng chung channel và gửi trong `Task.Run` để không giữ thread của request. Tôi cố ý không đặt deadline vì service nhận có lúc chậm 3,6 s, đặt deadline thì event bị rơi. Kết quả mới có mục tiêu dưới 60 ms, tôi chưa đo lại bằng APM.
- **"Không đặt deadline cho gRPC có phải sai không?"** Với lời gọi đồng bộ trên đường request thì sai, vì request có thể treo vô hạn. Với event đã tách khỏi request thì deadline chỉ làm rơi event. Cách tốt hơn theo best practice là đưa event vào hàng đợi bền (Kafka, outbox) thay vì `Task.Run`.
- **"PUT và POST khác nhau thế nào về idempotency?"** PUT thay toàn bộ resource ở một URI xác định, gửi lại cho cùng trạng thái. POST tạo resource mới, gửi lại có thể tạo hai bản ghi; muốn retry an toàn thì client gửi header `Idempotency-Key` và server lưu kết quả theo key.
- **"Vì sao gRPC đứng sau load balancer L4 bị lệch tải?"** L4 chỉ chọn pod lúc mở kết nối. HTTP/2 giữ một kết nối lâu và dồn mọi lời gọi vào đó, nên một pod nhận hết. Sửa bằng client-side load balancing (resolver DNS headless service) hoặc proxy L7.
- **"Offset pagination có vấn đề gì trên bảng lớn?"** `OFFSET 100000` vẫn phải đọc và bỏ qua 100.000 dòng; dữ liệu chèn thêm làm trang bị lặp hoặc sót. Keyset dùng điều kiện trên cột có index nên chi phí mỗi trang gần như không đổi.

#### Tóm tắt
- GET, PUT, DELETE idempotent; POST không, nên cần idempotency key.
- Dùng đúng mã trạng thái và ProblemDetails; phân trang keyset cho bảng lớn.
- gRPC: Protobuf trên HTTP/2, channel phải dùng lại, lời gọi đồng bộ phải có deadline.
- gRPC sau L4 load balancer cần cân bằng phía client hoặc L7.

#### Bài tập
1. Viết một client gRPC gọi 1.000 lần một service mẫu theo hai cách: tạo `GrpcChannel` mới mỗi lần và dùng chung một channel. Đo tổng thời gian và đếm kết nối TCP bằng `netstat -an | find "ESTABLISHED"` (Windows) trong lúc chạy.
   **Đáp án:** Cách tạo mới chậm hơn nhiều lần và để lại hàng trăm kết nối (nhiều cái ở TIME_WAIT). Dùng chung channel chỉ có một vài kết nối.
2. Viết câu SQL keyset pagination lấy 20 bài thi tiếp theo theo `(CreatedAt DESC, Id DESC)` sau phần tử cuối `(@lastCreated, @lastId)`, và index cần có.
   **Đáp án:** `WHERE CreatedAt < @lastCreated OR (CreatedAt = @lastCreated AND Id < @lastId) ORDER BY CreatedAt DESC, Id DESC` với `TOP (20)`; index `(CreatedAt DESC, Id DESC)`.
3. Trong một service gRPC mẫu, server gọi tiếp một service khác. Viết code truyền deadline của request vào lời gọi phía sau.
   **Đáp án:** Dùng `context.Deadline` và `context.CancellationToken` của `ServerCallContext` khi gọi tiếp, hoặc bật `EnableCallContextPropagation()` trên client factory.

### Bài 9.3. async/await và thread pool

#### Mục tiêu
- Sau bài này, bạn giải thích được async/await giải phóng thread thế nào khi chờ I/O.
- Nhận ra thread pool starvation từ triệu chứng và đo được bằng `dotnet-counters`.
- Giải thích vì sao `async void` và `_ = Task.Run(...)` nguy hiểm, và cách làm fire-and-forget đúng.
- Kể đúng fix `async void` khi ghi cache của bạn.

#### async/await làm gì
Compiler biến method `async` thành một **state machine**. Tại `await` một tác vụ I/O chưa xong, method trả `Task` về cho caller và **trả thread về thread pool**. Khi I/O xong, phần còn lại chạy tiếp trên một thread pool thread bất kỳ. Lợi ích không phải "chạy nhanh hơn" mà là **phục vụ được nhiều request đồng thời hơn với cùng số thread**.

ASP.NET Core không có `SynchronizationContext`, nên deadlock kinh điển của `.Result` (WinForms, ASP.NET cũ) không xảy ra. Nhưng `.Result`, `.Wait()`, `GetAwaiter().GetResult()` vẫn **chặn thread**: đó là sync-over-async. Thư viện dùng chung vẫn nên viết `ConfigureAwait(false)` vì có thể bị gọi từ môi trường có context.

#### Thread pool starvation
Khi nhiều request chặn thread, pool hết thread rảnh. Thread pool chỉ bơm thêm thread khá chậm, nên hàng đợi work item dài ra: **request timeout hàng loạt trong khi CPU thấp**. Đo bằng:

```bash
dotnet-counters monitor -n MyApi System.Runtime
# Theo dõi: ThreadPool Queue Length tăng liên tục, ThreadPool Thread Count tăng dần
```

Sửa gốc: bỏ sync-over-async trên đường nóng. Tăng `ThreadPool.SetMinThreads` chỉ là băng dán tạm.

#### `async void`, `Task.WhenAll`, fire-and-forget
- **`async void`:** caller không `await` được, nên không biết khi nào xong; exception không bắt được ở caller và có thể làm sập process. Chỉ dùng cho event handler.
- **`Task.WhenAll`:** chạy song song các I/O độc lập, tổng thời gian bằng lời gọi chậm nhất. Không dùng chung một `DbContext` cho các tác vụ song song vì nó không thread-safe; mỗi tác vụ song song cũng chiếm thêm một connection trong pool.
- **`_ = Task.Run(...)` trong controller:** exception bị nuốt, process restart thì mất việc, không có backpressure, và service scoped (`DbContext`, `HttpContext`) có thể đã bị dispose khi request kết thúc.

Fire-and-forget đúng cách trong process: `Channel<T>` có giới hạn cộng `BackgroundService`. Cần bền qua restart thì dùng hàng đợi (Kafka, outbox).

```csharp
// Đăng ký: services.AddSingleton(Channel.CreateBounded<CacheWrite>(10_000)); services.AddHostedService<CacheWriter>();
public sealed class CacheWriter(Channel<CacheWrite> ch, ICache cache, ILogger<CacheWriter> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await foreach (var item in ch.Reader.ReadAllAsync(ct))
        {
            try { await cache.SetAsync(item.Key, item.Value, item.Ttl, ct); }
            catch (Exception ex) { log.LogWarning(ex, "Ghi cache lỗi {Key}", item.Key); }
        }
    }
}
// Trong request: ch.Writer.TryWrite(new CacheWrite(key, value, ttl)); // đầy thì bỏ, không chặn request
```

Luôn truyền `CancellationToken` (`HttpContext.RequestAborted`) xuống DB và HTTP để client hủy thì server ngừng làm việc thừa.

#### Câu chuyện thật: `async void` khi ghi cache
Trong commit 22/09 (của bạn, nguồn: mục 3.2), hàm ghi cache cũ là `async void`. Caller không chờ được, nên bước sau trong cùng request có thể đọc phải cache cũ. Fix: đổi thành `async Task` và `await`. Cùng commit, event gRPC được đẩy vào `Task.Run`; đó là đánh đổi chấp nhận được cho một event không quan trọng, nhưng nếu được hỏi thì nói rõ phương án tốt hơn là `Channel<T>` hoặc hàng đợi bền.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| async/await | Không chặn thread khi chờ I/O; tránh `async void`; `Task.WhenAll` cho việc độc lập; tránh `.Result` vì gây cạn thread pool, triệu chứng là timeout hàng loạt khi CPU thấp. Fire-and-forget đúng cách là `Channel<T>` cộng `BackgroundService`. | Fix `async void` khi ghi cache (mục 3.2) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn sửa lỗi liên quan async?"** Ở API cập nhật thông tin GDPT, hàm ghi cache là `async void`, nên bước sau trong cùng request có thể đọc cache cũ. Tôi đổi sang `async Task` và `await` (commit 22/09). Trong cùng fix tôi cũng chuyển event gRPC ra `Task.Run` để không giữ thread của request.
- **"API chạy bình thường, giờ cao điểm timeout hàng loạt nhưng CPU thấp. Bạn nghi gì?"** Thread pool starvation do sync-over-async. Tôi xem `ThreadPool Queue Length` bằng `dotnet-counters`, lấy dump hoặc `dotnet-stack` để xem thread đang chặn ở đâu, rồi bỏ `.Result`/`.Wait()` trên đường nóng.
- **"Vì sao `async void` nguy hiểm?"** Caller không chờ được nên thứ tự thực thi sai; exception không bắt được ở caller và có thể làm sập process. Chỉ dùng cho event handler.
- **"`_ = Task.Run(...)` trong controller có vấn đề gì?"** Exception bị nuốt, mất việc khi process restart, không có backpressure, và service scoped có thể đã bị dispose. Thay bằng `Channel<T>` có giới hạn cộng `BackgroundService`, hoặc hàng đợi bền nếu không được mất.
- **"Dùng `Task.WhenAll` với một `DbContext` chung có sao không?"** Có. `DbContext` không thread-safe, EF Core ném exception khi có hai thao tác song song. Mỗi tác vụ cần context riêng (`IDbContextFactory`) hoặc chạy tuần tự.

#### Tóm tắt
- async/await trả thread về pool khi chờ I/O, tăng số request đồng thời chứ không tăng tốc từng request.
- Sync-over-async gây thread pool starvation: timeout hàng loạt, CPU thấp.
- `async void` chỉ cho event handler.
- Fire-and-forget: `Channel<T>` cộng `BackgroundService`; cần bền thì dùng hàng đợi.

#### Bài tập
1. Viết endpoint `/sync` gọi `Task.Delay(200).Wait()` và `/async` gọi `await Task.Delay(200)`. Bắn 200 request đồng thời vào từng endpoint (k6 hoặc `bombardier -c 200`), theo dõi `dotnet-counters`.
   **Đáp án:** `/sync` có `ThreadPool Queue Length` tăng, latency tăng lên hàng giây, số thread tăng dần; `/async` giữ latency khoảng 200 ms với rất ít thread.
2. Viết một hàm `async void` ném exception sau `await Task.Delay(100)` và gọi nó từ một endpoint trong `try/catch`.
   **Đáp án:** `catch` không bắt được; exception thoát ra thread pool và process bị dừng. Đổi sang `async Task` và `await` thì bắt được.
3. Chuyển một đoạn `_ = Task.Run(() => SendEmail())` sang `Channel<T>` bounded cộng `BackgroundService`, rồi dừng app bằng Ctrl+C khi còn item trong channel.
   **Đáp án:** Xử lý `stoppingToken` và gọi `Writer.Complete()` khi dừng để worker đọc hết item còn lại trong thời gian `HostOptions.ShutdownTimeout`.

### Bài 9.4. LINQ, EF Core và Dapper

#### Mục tiêu
- Sau bài này, bạn giải thích được deferred execution và sự khác nhau giữa `IQueryable` và `IEnumerable`.
- Nhận ra và sửa N+1 ở cả ORM lẫn tầng gọi stored procedure.
- So sánh EF Core, Dapper và ADO.NET gọi stored procedure, chọn được theo tình huống.

#### LINQ: deferred execution, `IQueryable` và `IEnumerable`
Phần lớn toán tử LINQ là **deferred**: câu truy vấn chỉ chạy khi bị liệt kê (`foreach`, `ToList`, `Count`, `First`). Liệt kê hai lần là chạy hai lần.

- `IEnumerable<T>` nhận delegate, chạy **trong bộ nhớ**.
- `IQueryable<T>` nhận **expression tree**; provider (EF Core) dịch nó thành SQL.

```csharp
// Sai: AsEnumerable kéo toàn bộ bảng về rồi mới lọc trong bộ nhớ
var bad = db.Results.AsEnumerable().Where(r => r.UserId == userId).ToList();
// Đúng: điều kiện được dịch thành WHERE trong SQL
var good = await db.Results.Where(r => r.UserId == userId).ToListAsync(ct);
```

.NET 10 thêm toán tử `LeftJoin` và `RightJoin` cho LINQ, EF Core 10 dịch được thành `LEFT JOIN`, thay cho cách viết `GroupJoin` + `DefaultIfEmpty` dài dòng.

#### N+1
N+1 là một truy vấn lấy danh sách rồi N truy vấn cho từng phần tử. Với ORM, nguyên nhân thường là lazy loading hoặc truy vấn trong vòng lặp. Cách sửa: projection (`Select` đúng cột cần), `Include`, `AsSplitQuery()` khi include nhiều collection, hoặc gom ID rồi truy vấn một lần (`WHERE Id IN (...)`).

N+1 không chỉ có ở ORM. Gọi một stored procedure trong vòng lặp, hoặc nhiều hàm con cùng tự đọc lại một dữ liệu, cũng là N+1.

#### EF Core
- **Change tracking:** context ghi nhớ entity đã đọc để `SaveChanges` sinh `UPDATE`. Truy vấn chỉ đọc dùng `AsNoTracking()` để bớt bộ nhớ và CPU.
- **Cập nhật hàng loạt:** `ExecuteUpdateAsync` và `ExecuteDeleteAsync` (EF Core 7 trở lên) chạy một câu SQL, không nạp entity.
- **Concurrency:** cột `rowversion` làm concurrency token; `SaveChanges` ném `DbUpdateConcurrencyException` khi có người sửa trước.
- **SQL tay:** `FromSql($"... {param}")` tự tham số hóa; `FromSqlRaw` với chuỗi ghép là lỗ SQL injection.
- **Migration:** schema trong code, có version; với DB do DBA quản lý thì thường chỉ sinh script để review.

#### Dapper và ADO.NET gọi stored procedure
Dapper là micro-ORM: bạn viết SQL hoặc tên proc, Dapper map kết quả vào object nhanh, gần như ADO.NET thuần.

```csharp
var dt = new DataTable();
dt.Columns.Add("QuestionId", typeof(long));
foreach (var id in selectedIds) dt.Rows.Add(id);

var rows = await conn.QueryAsync<AttemptRow>(
    "dbo.usp_Attempt_Create",
    new { UserId = userId, Questions = dt.AsTableValuedParameter("dbo.QuestionIdList") },
    commandType: CommandType.StoredProcedure);
```

| Tiêu chí | EF Core | Dapper | ADO.NET + stored procedure |
|---|---|---|---|
| Năng suất viết CRUD | Cao | Trung bình | Thấp |
| Kiểm soát SQL | Thấp đến trung bình | Cao | Cao (SQL nằm ở DB) |
| Hiệu năng map | Tốt (đã cải thiện nhiều từ EF Core 6) | Rất tốt | Rất tốt |
| Hợp với | Domain phức tạp, nhiều ghi | Truy vấn đọc tối ưu tay | Team có DBA, logic set-based ở DB |

> **Ghi nhớ:** Nhóm hiện tại truy cập DB hoàn toàn qua stored procedure (nguồn: B1). Bằng chứng dùng EF Core hay Dapper chưa có trong tài liệu: chỉ kể nếu bạn đã dùng thật ở dự án trước.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| LINQ | Deferred execution, liệt kê hai lần là chạy hai lần; `IQueryable` dịch ra SQL còn `IEnumerable` chạy trong bộ nhớ; cẩn thận N+1 khi lặp. | |
| EF Core, Dapper | EF Core: change tracking, migration, `AsNoTracking` cho đọc, `ExecuteUpdate` cho cập nhật hàng loạt. Dapper: map nhanh, gần SQL. Nhóm tôi gọi stored procedure. | |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng EF Core hoặc Dapper?"** Trả lời trung thực: dự án hiện tại truy cập DB 100% qua stored procedure, nên tôi không có câu chuyện EF Core ở đó. Khái niệm N+1 thì tôi đã xử lý ở tầng gọi proc: trong commit 21/09 tôi khử N+1 ở API chứng chỉ bằng cache danh mục 24 giờ và memo dictionary theo request cho tên tỉnh, xã, trường. Phần EF Core tôi nói ở mức hiểu biết theo best practice.
- **"`IQueryable` khác `IEnumerable` thế nào?"** `IQueryable` giữ expression tree để provider dịch sang SQL, lọc ở DB. `IEnumerable` chạy delegate trong bộ nhớ. Gọi `AsEnumerable()` hoặc `ToList()` quá sớm sẽ kéo cả bảng về rồi mới lọc.
- **"N+1 là gì, sửa thế nào trong EF Core?"** Một truy vấn danh sách cộng N truy vấn con. Sửa bằng projection `Select`, `Include` (kèm `AsSplitQuery` nếu nhiều collection), hoặc gom ID truy vấn một lần. Bật `LogTo` hoặc xem APM để đếm số câu SQL mỗi request.
- **"Khi nào bạn chọn Dapper thay vì EF Core?"** Truy vấn đọc phức tạp cần SQL tối ưu tay, đường nóng cần overhead thấp, hoặc hệ thống đã dùng stored procedure. EF Core hợp khi domain nhiều ghi và cần change tracking, migration.
- **"`AsNoTracking` giúp gì?"** Context không lưu snapshot entity, giảm bộ nhớ và CPU cho truy vấn chỉ đọc. Đánh đổi: muốn cập nhật entity đó thì phải attach lại.

#### Tóm tắt
- LINQ deferred: liệt kê mới chạy, liệt kê hai lần là chạy hai lần.
- `IQueryable` lọc ở DB, `IEnumerable` lọc trong bộ nhớ.
- N+1 có ở cả ORM lẫn tầng gọi stored procedure; sửa bằng gom truy vấn.
- EF Core cho năng suất, Dapper cho kiểm soát SQL; dự án hiện tại dùng stored procedure.

#### Bài tập
1. Dựng SQL Server bằng Docker, tạo hai bảng `Exam` và `Question` (1–n) với EF Core. Viết vòng lặp truy cập `exam.Questions` với lazy loading bật, đếm câu SQL qua `optionsBuilder.LogTo(Console.WriteLine)`. Sửa bằng `Include` và bằng projection.
   **Đáp án:** Lazy loading sinh 1 + N câu; `Include` còn 1 câu có JOIN; projection chỉ lấy đúng cột cần nên payload nhỏ nhất.
2. Viết một stored procedure nhận TVP danh sách ID và gọi nó bằng Dapper với `AsTableValuedParameter`.
   **Đáp án:** Tạo `CREATE TYPE dbo.IdList AS TABLE (Id bigint PRIMARY KEY)`, proc nhận `@Ids dbo.IdList READONLY`, phía C# truyền `DataTable` có cột cùng tên và kiểu.
3. So sánh SQL sinh ra của `db.Results.Where(...).Count()` và `db.Results.AsEnumerable().Where(...).Count()`.
   **Đáp án:** Câu đầu sinh `SELECT COUNT(*) ... WHERE ...`; câu sau sinh `SELECT` toàn bộ cột không có `WHERE`, đếm trong bộ nhớ.

## Chương 10. Kiến trúc phần mềm

Chương này phủ các keyword kiến trúc: microservices, event-driven, DDD, Clean Architecture, SOLID và design pattern. Interviewer senior không hỏi định nghĩa suông; họ hỏi "vì sao chọn", "cái giá là gì" và "bạn đã thấy nó hỏng ở đâu". Vì vậy mỗi mục đều đi kèm đánh đổi.

Đây cũng là chương dễ bị lộ nhất nếu CV ghi keyword mà không có bằng chứng (DDD là ví dụ rõ nhất). Học xong, bạn nói được kiến thức chắc ở mức thiết kế và tách bạch rõ phần nào là kinh nghiệm thật.

### Bài 10.1. Microservices và event-driven

#### Mục tiêu
- Sau bài này, bạn nêu được lợi ích và cái giá của microservices, và dấu hiệu của distributed monolith.
- Phân biệt giao tiếp đồng bộ và bất đồng bộ, event và command, event notification và event-carried state transfer.
- Trình bày được khung trả lời system design.
- Kể đúng phạm vi kinh nghiệm thật với 20+ service IOE và luồng Kafka kết thúc game.

#### Microservices: lợi ích và cái giá
Microservice là service nhỏ, **deploy độc lập**, sở hữu **dữ liệu riêng** và giao tiếp với service khác qua API hoặc event. Ranh giới nên đi theo năng lực nghiệp vụ (bounded context), không theo bảng.

| Được | Mất |
|---|---|
| Deploy và scale từng phần | Vận hành nhiều thứ hơn: CI, monitoring, cấu hình cho từng service |
| Team sở hữu rõ ràng | Không còn transaction ACID giữa các service |
| Lỗi cô lập được nếu thiết kế đúng | Debug phân tán, cần tracing |
| Chọn công nghệ theo nhu cầu | Độ trễ mạng, lỗi mạng trở thành chuyện thường |

**Distributed monolith** là khi tách service nhưng vẫn phải deploy cùng nhau, dùng chung DB, hoặc một request đi qua chuỗi gọi đồng bộ dài. Phép tính đơn giản: 5 service gọi nối tiếp, mỗi cái 99,9% availability, thì cả chuỗi chỉ còn khoảng 0,999^5 ≈ 99,5%.

Khi nào chưa nên tách: team nhỏ, domain chưa rõ ranh giới, chưa có CI/CD và observability. **Modular monolith** (một deploy, module tách bạch, mỗi module một schema) thường là bước đầu hợp lý.

#### Event-driven
- **Command** là yêu cầu làm việc gì đó, gửi cho một nơi nhận xác định ("trừ lượt thi").
- **Event** là sự kiện đã xảy ra, ai quan tâm thì nghe ("bài thi đã kết thúc"). Bên phát không biết bên nghe.
- **Event notification:** event chỉ mang ID, bên nghe gọi ngược lại để lấy dữ liệu. Nhỏ gọn nhưng tạo lại phụ thuộc đồng bộ.
- **Event-carried state transfer:** event mang đủ dữ liệu cần thiết, bên nghe tự lưu bản sao. Độc lập hơn, đổi lại dữ liệu trùng lặp và trễ.

Event-driven giảm phụ thuộc trực tiếp và hấp thụ được tải đột biến (hàng đợi làm bộ đệm), nhưng luồng nghiệp vụ khó lần vết hơn, phải chấp nhận eventual consistency, và consumer phải idempotent vì message có thể đến nhiều lần (xem Bài 12.4).

#### Khung trả lời system design
1. Hỏi rõ yêu cầu chức năng và phi chức năng (tải, độ trễ, mức nhất quán).
2. Ước lượng tải bằng con số (QPS đọc, ghi, dung lượng).
3. API và mô hình dữ liệu.
4. Kiến trúc tổng thể.
5. Đào sâu 2–3 điểm nghẽn.
6. Cách hệ thống hỏng, đánh đổi, cách quan sát.

#### Kinh nghiệm thật để kể
- Nền tảng IOE có khoảng 20 repo service (nguồn: B0). Các service theo mô hình controller mỏng, logic ở tầng proxy, DB tách theo domain.
- Ở hệ Mastery, DB tách theo vai trò (đề thi, ngân hàng câu hỏi, tích hợp, log). Bạn viết lại attempt engine (chuỗi commit 21–24/08) để bỏ 12 procedure join chéo database: C# điều phối các lần đọc từ từng DB rồi ghi đúng một lần. Đây là ví dụ thật về **ranh giới sở hữu dữ liệu** (nguồn: mục 5).
- Luồng kết thúc game: API publish message lên topic theo loại thi; worker consume, kiểm tra rồi mới ghi kết quả. Consumer do đồng nghiệp viết; phần của bạn chắc chắn là nâng worker lên .NET 10 (nguồn: B2, mục 14).

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| System design | Hỏi rõ yêu cầu → ước lượng tải → thiết kế → điểm nghẽn → cách hỏng → quan sát. Luôn nói đánh đổi bằng con số. | |
| Microservices | Deploy độc lập, dữ liệu riêng, giao tiếp qua API và event; cái giá là vận hành, nhất quán dữ liệu, debug phân tán. Dấu hiệu sai: chung DB, chuỗi gọi đồng bộ dài. | 20+ service IOE |
| Event-driven architecture | Service phát event, service khác phản ứng; giảm phụ thuộc trực tiếp và đệm tải, đổi lại khó lần vết và consumer phải idempotent. | Kafka kết thúc game (B2) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn làm việc với microservices?"** Nền tảng IOE có khoảng 20 service. Việc tôi làm sát nhất với bài toán ranh giới là attempt engine của hệ Mastery: dự án yêu cầu không join chéo database, tôi viết lại để C# đọc từ từng DB rồi ghi đúng một lần qua table-valued parameter, bỏ 12 procedure join chéo. Ranh giới sở hữu dữ liệu rõ, và tách DB sang server khác không cần linked server.
- **"Kể một lần bạn dùng event-driven?"** Luồng kết thúc game đi qua Kafka: API publish theo loại thi, worker consume và ghi kết quả theo kiểu kiểm tra rồi mới ghi để không trùng. Consumer do đồng nghiệp viết; tôi nắm luồng và đã nâng worker lên .NET 10. Tôi cũng biết điểm yếu hiện tại là đang bật auto-commit.
- **"Làm sao tránh distributed monolith?"** Mỗi service sở hữu dữ liệu riêng, không dùng chung DB; tránh chuỗi gọi đồng bộ dài, dùng event khi không cần kết quả ngay; hợp đồng API có version để deploy độc lập.
- **"Khi nào không nên tách microservice?"** Team nhỏ, ranh giới domain chưa ổn định, chưa có CI/CD và tracing. Khi đó modular monolith rẻ hơn và tách sau vẫn được.
- **"Event notification và event-carried state transfer khác nhau thế nào?"** Notification chỉ mang ID, bên nghe phải gọi lại lấy dữ liệu nên vẫn phụ thuộc đồng bộ. State transfer mang đủ dữ liệu, bên nghe tự giữ bản sao, độc lập hơn nhưng dữ liệu trễ và trùng lặp.

#### Tóm tắt
- Microservice: deploy độc lập, dữ liệu riêng; cái giá là vận hành và nhất quán.
- Chuỗi gọi đồng bộ nhân availability với nhau; 5 tầng 99,9% còn khoảng 99,5%.
- Event khác command; event-carried state transfer giảm phụ thuộc nhưng dữ liệu trễ.
- System design: yêu cầu, ước lượng, thiết kế, điểm nghẽn, cách hỏng, quan sát.

#### Bài tập
1. Vẽ sơ đồ service cho một nền tảng thi trực tuyến (đăng ký, đề thi, làm bài, chấm, bảng xếp hạng, thông báo). Với mỗi service ghi dữ liệu nó sở hữu và event nó phát.
   **Đáp án:** Ví dụ: Làm bài sở hữu attempt, phát `AttemptSubmitted`; Chấm nghe event đó, phát `AttemptGraded`; Bảng xếp hạng và Thông báo nghe `AttemptGraded`. Không service nào đọc trực tiếp DB của service khác.
2. Một request đi qua 4 service đồng bộ, mỗi service p99 là 50 ms và availability 99,95%. Ước lượng availability của cả chuỗi và nêu hai cách giảm rủi ro.
   **Đáp án:** Khoảng 0,9995^4 ≈ 99,8%. p99 cả chuỗi lớn hơn 50 ms đáng kể vì đuôi chậm cộng dồn. Giảm bằng cách gọi song song phần độc lập, chuyển phần không cần kết quả ngay sang event, thêm cache hoặc fallback.

### Bài 10.2. DDD và Clean Architecture

#### Mục tiêu
- Sau bài này, bạn giải thích được các khái niệm chiến lược (bounded context, ngôn ngữ chung, context map, anti-corruption layer) và chiến thuật (entity, value object, aggregate) của DDD.
- Trình bày được quy tắc phụ thuộc của Clean Architecture và cái giá của nó.
- Trả lời trung thực khi bị hỏi "kể một lần dùng DDD" trong khi chưa có bằng chứng.

#### DDD chiến lược
- **Bounded context:** ranh giới trong đó một mô hình và một bộ thuật ngữ có nghĩa nhất quán. "Bài thi" trong context Làm bài (attempt, đáp án, thời gian) khác "bài thi" trong context Ngân hàng đề (ma trận, độ khó).
- **Ubiquitous language:** dev và nghiệp vụ dùng cùng thuật ngữ, và thuật ngữ đó xuất hiện trong code.
- **Context map:** quan hệ giữa các context (upstream/downstream, shared kernel, customer/supplier).
- **Anti-corruption layer (ACL):** lớp dịch giữa mô hình của mình và mô hình của hệ khác (thường là hệ cũ), để khái niệm lộn xộn bên kia không tràn vào.

#### DDD chiến thuật
- **Entity:** có định danh, sống qua thời gian (Attempt).
- **Value object:** định nghĩa bằng giá trị, bất biến (Score, TimeWindow). Trong C# hợp với `record`.
- **Aggregate:** cụm đối tượng có một **aggregate root** giữ bất biến. Bên ngoài chỉ được sửa qua root. Quy tắc: aggregate nhỏ, tham chiếu aggregate khác bằng ID, mỗi transaction chỉ sửa một aggregate.
- **Domain event:** sự kiện có ý nghĩa nghiệp vụ do aggregate phát ra.
- **Repository:** một repository cho mỗi aggregate root.

```csharp
public sealed class Attempt
{
    private readonly List<object> _events = new();          // domain event chờ phát
    public Guid Id { get; }
    public AttemptStatus Status { get; private set; } = AttemptStatus.InProgress;
    public DateTimeOffset Deadline { get; }

    public void Submit(DateTimeOffset now)
    {
        if (Status != AttemptStatus.InProgress)
            throw new DomainException("Bài đã nộp");          // bất biến: chỉ nộp một lần
        if (now > Deadline.AddSeconds(30))
            throw new DomainException("Quá hạn nộp");         // bất biến: có ân hạn 30 giây
        Status = AttemptStatus.Submitted;
        _events.Add(new AttemptSubmitted(Id, now));
    }
    // ...
}
```

DDD đáng giá khi domain phức tạp và thay đổi nhiều. Với CRUD đơn giản, nó chỉ thêm nghi thức.

#### Clean Architecture
Code chia thành vòng: **Domain** (entity, quy tắc) ở trong cùng, **Application** (use case), rồi **Infrastructure** (DB, Redis, Kafka) và **Web** ở ngoài. **Quy tắc phụ thuộc:** chỉ phụ thuộc hướng vào trong. Domain không biết DB hay HTTP; interface như `IAttemptRepository` khai báo ở Application, Infrastructure implement, DI nối lại.

Được: logic nghiệp vụ test được không cần DB, đổi hạ tầng ít ảnh hưởng. Mất: nhiều project, nhiều lớp mapping, dễ thành "lasagna" cho tính năng đơn giản. **Vertical slice** (mỗi tính năng một thư mục từ endpoint tới DB) là phương án thay thế hay được nhắc.

> **Ghi nhớ:** Kiến trúc thật ở IOE là controller mỏng, logic ở tầng proxy, phần lớn logic set-based nằm trong stored procedure (nguồn: B1). Đó không phải DDD hay Clean Architecture; nói đúng như vậy và nêu được đánh đổi của nó.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| DDD | Bounded context, aggregate giữ bất biến, ngôn ngữ chung, anti-corruption layer để cách ly hệ cũ. Đáng giá khi domain phức tạp, thừa thãi với CRUD. | Chưa có (mục 14) |
| Clean Architecture | Phụ thuộc hướng vào trong: domain không biết DB hay web; dễ test logic. Cái giá là nhiều lớp và mapping. | |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng DDD?"** Trả lời trung thực: tôi chưa có dự án áp dụng DDD đầy đủ có thể chứng minh. Hệ thống hiện tại để logic ở tầng proxy và stored procedure. Nếu thiết kế lại phần thi, tôi tách context Làm bài, Ngân hàng đề, Chấm, Xếp hạng; Attempt là aggregate root giữ bất biến "chỉ nộp một lần" và "nộp trong hạn".
- **"Aggregate là gì, vì sao nên nhỏ?"** Cụm đối tượng có một root giữ bất biến, sửa trong một transaction. Aggregate lớn làm transaction giữ khóa trên nhiều dữ liệu, tăng xung đột; nên tham chiếu aggregate khác bằng ID và đồng bộ qua domain event.
- **"Anti-corruption layer dùng khi nào?"** Khi tích hợp với hệ cũ hoặc hệ bên ngoài có mô hình khác mình, đặc biệt trong migration theo strangler fig: ACL dịch dữ liệu hai chiều để mô hình mới không bị nhiễm khái niệm cũ.
- **"Clean Architecture có nhược điểm gì?"** Nhiều project, interface và mapping cho cả tính năng đơn giản; dev mới khó lần luồng. Với service nhỏ, vertical slice hoặc cấu trúc phẳng thường đủ.
- **"Logic nghiệp vụ nằm trong stored procedure có trái Clean Architecture không?"** Có, theo nghĩa domain phụ thuộc DB. Đổi lại xử lý set-based cạnh dữ liệu nhanh và ít round-trip. Cái giá là khó unit test và khó version; bù lại bằng script đánh số trong git và integration test chạy trên SQL thật.

#### Tóm tắt
- Bounded context là ranh giới nghĩa của mô hình; chia service theo nó, không theo bảng.
- Aggregate root giữ bất biến; aggregate nhỏ, tham chiếu nhau bằng ID.
- Clean Architecture: phụ thuộc hướng vào trong; đổi lại nhiều lớp.
- DDD chưa có bằng chứng: nói ở mức thiết kế, không nhận là đã làm.

#### Bài tập
1. Viết aggregate `Attempt` với hai bất biến (chỉ nộp một lần, nộp trong hạn có ân hạn 30 giây) và 4 unit test xUnit dùng `[Theory]`.
   **Đáp án:** Test: nộp trong hạn thành công; nộp lần hai ném lỗi; nộp ở giây thứ 20 sau hạn thành công; nộp ở giây thứ 31 ném lỗi. Truyền `now` vào hàm (hoặc `TimeProvider`) để test không phụ thuộc giờ thật.
2. Liệt kê các bounded context của một nền tảng thi và vẽ context map, đánh dấu nơi cần anti-corruption layer khi tích hợp với hệ thống quản lý trường học có sẵn.
   **Đáp án:** Ví dụ: Danh tính, Tổ chức (trường, lớp), Ngân hàng đề, Làm bài, Chấm, Xếp hạng, Thông báo. ACL đặt giữa Tổ chức và hệ quản lý trường cũ để dịch mã trường, mã đơn vị.
3. Lấy một controller có gọi trực tiếp `SqlConnection`, tách thành use case ở Application và repository ở Infrastructure.
   **Đáp án:** Controller chỉ gọi `SubmitAttemptHandler`; handler phụ thuộc `IAttemptRepository`; `SqlAttemptRepository` implement và được đăng ký trong DI. Handler test được bằng fake repository.

### Bài 10.3. SOLID và design pattern

#### Mục tiêu
- Sau bài này, bạn nêu được ví dụ cụ thể cho từng nguyên tắc SOLID, đặc biệt S và D.
- Giải thích được template method, strategy, decorator, factory, adapter và khi nào dùng.
- Kể hai bằng chứng thật: shim `IHttpClient` qua DI và rank provider theo template method.

#### SOLID
- **S (Single responsibility):** một module chỉ có một lý do để thay đổi. Service vừa tính quota vừa gửi email thì đổi template email cũng phải test lại phần quota.
- **O (Open/closed):** thêm hành vi bằng cách thêm code mới, không sửa code đang chạy. Thêm loại bảng xếp hạng bằng một class mới.
- **L (Liskov substitution):** lớp con thay được cho lớp cha mà không đổi đúng đắn. Lớp con ném `NotSupportedException` cho một method của cha là dấu hiệu vi phạm.
- **I (Interface segregation):** interface nhỏ theo nhu cầu của client; không bắt client phụ thuộc method nó không dùng.
- **D (Dependency inversion):** module cấp cao phụ thuộc abstraction, không phụ thuộc chi tiết; inject qua DI.

#### Design pattern hay gặp trong backend
- **Template method:** lớp cha định nghĩa khung thuật toán, lớp con điền bước khác nhau.
- **Strategy:** thuật toán là một object inject vào, đổi được lúc chạy. Khác template method ở chỗ dùng composition thay vì kế thừa.
- **Decorator:** bọc một implementation bằng một lớp cùng interface để thêm hành vi (cache, log, retry).
- **Factory:** tạo object theo tham số mà caller không cần biết lớp cụ thể.
- **Adapter/shim:** bọc API cũ sau interface mới để code cũ chạy với hạ tầng mới.

```csharp
// Template method: khung chung, mỗi loại thi chỉ khai báo nguồn dữ liệu
public abstract class RankProviderBase(IDbExecutor db)
{
    protected abstract string RankProcName { get; }
    public Task<IReadOnlyList<RankRow>> GetTopAsync(int roundId, int top, CancellationToken ct) =>
        db.QueryProcAsync<RankRow>(RankProcName, new { roundId, top }, ct);
}
public sealed class MockExamRankProvider(IDbExecutor db) : RankProviderBase(db)
{
    protected override string RankProcName => "rank.GetTop_MockExam";
}

// Decorator: thêm cache mà không sửa repository gốc
public sealed class CachedCatalog(ICatalog inner, IDistributedCache cache) : ICatalog
{
    public async Task<Catalog> GetAsync(int id, CancellationToken ct)
    {
        var key = $"catalog:v2:{id}";
        var hit = await cache.GetStringAsync(key, ct);
        if (hit is not null) return JsonSerializer.Deserialize<Catalog>(hit)!;
        var value = await inner.GetAsync(id, ct);
        await cache.SetStringAsync(key, JsonSerializer.Serialize(value),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(6) }, ct);
        return value;
    }
}
```

Bẫy của decorator cache: object trả từ cache trong bộ nhớ là instance dùng chung; caller sửa nó là hỏng dữ liệu của request khác. Đó là lý do một fix thật chọn Redis (deserialize ra object mới mỗi lần) thay vì `MemoryCache` (xem Bài 3.3).

#### Bằng chứng thật
- **Shim `IHttpClient` qua DI** (commit 30/07, của bạn, nguồn: mục 11): khi nâng khoảng 70 project lên .NET 10, HTTP helper dạng static được thay bằng `IHttpClient` inject qua DI, kèm shim tương thích để business logic giữ nguyên. Đây là ví dụ cho D (phụ thuộc abstraction) và adapter. Xem Bài 6.1.
- **Rank provider theo template method** (nguồn: mục 8): mỗi loại thi có một rank provider, tên procedure là thành viên virtual, trỏ tới kho dữ liệu riêng của loại thi đó. Hạng được tính sẵn bằng SQL job không phải của bạn.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| SOLID | S: một lý do để đổi. D: phụ thuộc abstraction, inject qua DI; ví dụ thay HTTP helper static bằng interface để test và thay implementation được. | Shim `IHttpClient` qua DI (mục 11) |
| Design patterns | Template method, strategy, decorator (bọc cache quanh repository), factory. Template method dùng kế thừa, strategy dùng composition. | Rank provider dùng template method (mục 8) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn áp dụng SOLID?"** Khi nâng khoảng 70 project lên .NET 10, các HTTP helper static được thay bằng `IHttpClient` inject qua DI. Code nghiệp vụ phụ thuộc interface thay vì class static, nên thay được implementation và fake khi test. Tôi thêm shim để business logic cũ không phải sửa.
- **"Kể một lần bạn dùng design pattern?"** Bảng xếp hạng có một rank provider cho mỗi loại thi theo template method: lớp cha có khung đọc top-N, lớp con chỉ khai báo procedure của kho dữ liệu loại thi đó. Thêm loại thi mới là thêm một class.
- **"Template method khác strategy thế nào?"** Template method dùng kế thừa, cố định khung lúc compile. Strategy inject một object, đổi được lúc chạy và dễ test riêng. Khi phần khác nhau nhiều hơn một tên procedure, tôi chuyển sang strategy.
- **"Decorator cache quanh repository có rủi ro gì?"** Invalidation (dữ liệu cũ tới khi hết TTL), cache stampede khi key hết hạn, và nếu cache trong bộ nhớ thì caller sửa object dùng chung. Cần TTL hợp lý, hàm xóa cache khi dữ liệu đổi, và trả bản sao hoặc object bất biến.
- **"Khi nào SOLID bị lạm dụng?"** Khi mỗi class đều có interface chỉ có một implementation, hoặc tách nhỏ tới mức đọc một luồng phải mở mười file. Áp dụng khi có lý do thay đổi hoặc nhu cầu test thật.

#### Tóm tắt
- S và D là hai nguyên tắc hay bị hỏi nhất; chuẩn bị ví dụ cụ thể.
- Template method dùng kế thừa, strategy dùng composition.
- Decorator thêm cache hoặc log mà không sửa class gốc; cẩn thận object dùng chung.
- Hai bằng chứng thật: shim `IHttpClient` (D, adapter) và rank provider (template method).

#### Bài tập
1. Viết một class static `HttpHelper.GetJson(url)` và một service dùng nó. Refactor sang `IHttpClient` inject qua DI, viết unit test với fake.
   **Đáp án:** Tạo `interface IHttpClient { Task<T?> GetJsonAsync<T>(string url, CancellationToken ct); }`, implementation bọc `HttpClient` từ `IHttpClientFactory`; test dùng fake trả dữ liệu cố định, không cần mạng.
2. Chuyển `RankProviderBase` ở trên sang strategy: một `IRankSource` inject vào `RankService`, chọn theo loại thi bằng keyed services.
   **Đáp án:** Đăng ký `AddKeyedScoped<IRankSource, MockExamRankSource>("mock")`; `RankService` nhận `IServiceProvider` và gọi `GetRequiredKeyedService<IRankSource>(examType)`, hoặc inject một dictionary qua factory.
3. Đăng ký decorator `CachedCatalog` bọc `SqlCatalog` mà không dùng thư viện ngoài.
   **Đáp án:** `services.AddScoped<SqlCatalog>(); services.AddScoped<ICatalog>(sp => new CachedCatalog(sp.GetRequiredService<SqlCatalog>(), sp.GetRequiredService<IDistributedCache>()));`.

## Chương 11. Cơ sở dữ liệu

Chương này phủ các keyword về dữ liệu: T-SQL và stored procedure, query plan và index, locking và isolation, PostgreSQL, MongoDB, Redis và kho cột ClickHouse. SQL Server là thế mạnh có nhiều bằng chứng thật nhất của bạn, nên Bài 11.1 chỉ tổng quan và trỏ sang Phần VI (Chương 17–23) cho phần tối ưu chi tiết.

Các DB còn lại có mức bằng chứng khác nhau: PostgreSQL và MongoDB là kinh nghiệm thật ở AvePoint nhưng một số con số là minh họa; Redis có cả phần bạn sửa và phần có sẵn; ClickHouse chưa có. Học xong, bạn nói được cơ chế của từng loại và biết rõ ranh giới mình được nhận tới đâu.

### Bài 11.1. T-SQL, stored procedure, query plan và index

#### Mục tiêu
- Sau bài này, bạn viết được khung stored procedure chuẩn và giải thích từng dòng.
- Giải thích được set-based so với RBAR, parameter sniffing và table-valued parameter.
- Đọc được các tín hiệu cơ bản của plan: seek, scan, key lookup, covering index, leftmost prefix, sargable.
- Biết bài nào ở Phần VI để đào sâu.

#### Viết T-SQL theo tập hợp
SQL Server tối ưu cho xử lý **set-based**: một câu lệnh trên cả tập dòng. **RBAR** (row by agonizing row) là vòng `WHILE` hoặc cursor xử lý từng dòng, mỗi vòng một lần ghi log và một lần tìm kiếm.

```sql
CREATE OR ALTER PROCEDURE dbo.usp_Result_Save
    @UserId bigint, @RoundId int, @Items dbo.AnswerList READONLY   -- TVP
AS
BEGIN
    SET NOCOUNT ON;       -- bỏ thông báo "n rows affected", bớt round-trip
    SET XACT_ABORT ON;    -- lỗi bất kỳ thì rollback cả transaction
    BEGIN TRY
        BEGIN TRAN;
        INSERT dbo.Answer (UserId, RoundId, QuestionId, Choice)
        SELECT @UserId, @RoundId, i.QuestionId, i.Choice FROM @Items i;  -- một câu cho N dòng
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        THROW;            -- ném lại lỗi gốc cho caller
    END CATCH
END
```

- **Table-valued parameter (TVP):** truyền nhiều dòng vào proc trong một lần gọi qua user-defined table type, thay cho gọi N lần hoặc ghép chuỗi rồi `STRING_SPLIT`.
- **Parameter sniffing:** plan được compile theo giá trị tham số của lần chạy đầu và dùng lại. Nếu dữ liệu lệch (một user có 10 dòng, user khác 1 triệu dòng), plan tốt cho giá trị này có thể rất tệ cho giá trị kia. Xử lý: `OPTION (RECOMPILE)` cho câu chạy ít, `OPTIMIZE FOR`, tách proc con theo nhánh, hoặc Query Store ép plan.

#### Index và query plan
- **Seek** đi thẳng tới vùng dữ liệu theo key; **scan** đọc cả index hoặc bảng.
- **Key lookup:** seek trên nonclustered index rồi phải quay về clustered index lấy cột thiếu, mỗi dòng một lần. Nhiều dòng thì lookup đắt hơn scan.
- **Covering index:** đưa cột cần đọc vào `INCLUDE` để bỏ lookup. Đánh đổi: index to hơn, ghi chậm hơn.
- **Leftmost prefix:** index `(A, B, C)` seek được khi lọc theo `A`, `A,B`, `A,B,C`; lọc `A, C` thì chỉ seek được theo `A`.
- **Sargable:** điều kiện dùng được index. `WHERE YEAR(CreatedAt) = 2026` không sargable; viết lại `WHERE CreatedAt >= '2026-01-01' AND CreatedAt < '2027-01-01'`.

Đo một câu lệnh: `SET STATISTICS IO, TIME ON;`, xem actual plan. Đo toàn hệ thống: `sys.dm_exec_procedure_stats`, `sys.dm_os_wait_stats`, Query Store. Chi tiết ở Phần VI.

#### Ví dụ thật từ đợt audit
- **Leftmost prefix** (nguồn: mục 2): bảng kết quả luyện nói có index `(round, examOpenId, userId)` nhưng truy vấn lọc `round, userId`. SQL Server chỉ seek được theo `round` rồi lọc khoảng 4,9 triệu dòng, tốn khoảng 20 nghìn reads mỗi lần; DB luyện viết có index đúng `(round, userId)` chỉ tốn 28 reads.
- **Non-sargable** (nguồn: mục 4.4): `1 = CASE WHEN … AND [ID] = @ID THEN 1 …` được tách thành `IF … ELSE`, nhánh có ID seek thẳng khóa chính: 825 → 3 logical reads, 14,9 → 0,12 ms, đo trên khoảng 29 nghìn lần chạy sau deploy.
- **TVP, `XACT_ABORT`** (nguồn: mục 5): attempt engine V3 ghi đúng một lần, danh sách câu đã chọn đi qua TVP, trong transaction `XACT_ABORT ON` (chuỗi commit 21–24/08, của bạn).

> **Cảnh báo:** Các store procedure ở mục 4.4 không nằm trong git và báo cáo chỉ ghi "Dev Team". Chỉ nhận là mình viết nếu đúng như vậy; nếu không, nói "tôi phân tích và đề xuất, team viết lại".

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| T-SQL, stored procedures | Set-based thay vì RBAR; `SET NOCOUNT ON`; `XACT_ABORT ON`; parameter sniffing và cách xử lý; TVP để truyền nhiều dòng trong một lần gọi. | Mục 4.4, mục 5 |
| Query plans, indexing | Seek và scan; key lookup; covering index (`INCLUDE`); leftmost prefix; sargable. Đo bằng logical reads, không đoán. | Mục 2, 4.4 |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn tối ưu một truy vấn SQL?"** Trong đợt rà soát tôi dẫn, bảng kết quả luyện nói có index `(round, examOpenId, userId)` nhưng truy vấn lọc theo `round, userId`. Vì leftmost prefix, SQL Server chỉ seek theo `round` rồi lọc khoảng 4,9 triệu dòng, khoảng 20 nghìn reads mỗi lần, trong khi DB tương tự có index đúng chỉ 28 reads. Tôi đưa vào kế hoạch index ca đêm. Trạng thái triển khai thì tôi nói theo thực tế, không nhận là đã xong nếu chưa xong.
- **"Parameter sniffing là gì, xử lý thế nào?"** Plan compile theo giá trị tham số lần đầu rồi dùng lại cho mọi giá trị; dữ liệu lệch thì plan sai cho một nhóm giá trị. Xử lý theo mức: `OPTION (RECOMPILE)` cho câu chạy ít, `OPTIMIZE FOR`, tách proc con theo nhánh, hoặc ép plan qua Query Store.
- **"Covering index là gì, khi nào không nên thêm `INCLUDE`?"** Index chứa mọi cột truy vấn cần, nên không phải key lookup. Không nên khi bảng ghi nhiều (log, kết quả trong ca thi) vì mỗi index thêm là thêm ghi, page split và WRITELOG.
- **"Vì sao `WHERE YEAR(CreatedAt) = 2026` chậm?"** Hàm bọc cột làm điều kiện không sargable, SQL Server phải tính hàm cho từng dòng nên scan. Viết lại thành khoảng `>=` và `<` trên cột gốc.
- **"Table-valued parameter dùng để làm gì?"** Truyền nhiều dòng vào proc trong một lần gọi qua table type. Tôi dùng nó ở attempt engine V3 để ghi danh sách câu đã chọn trong đúng một lần ghi.

#### Tóm tắt
- Khung proc: `SET NOCOUNT ON`, `XACT_ABORT ON`, `TRY/CATCH` với `THROW`.
- Set-based thay RBAR; TVP thay gọi N lần.
- Plan: seek, scan, key lookup, covering, leftmost prefix, sargable.
- Phần VI (Chương 17–23) là nơi học tối ưu SQL Server chi tiết.

#### Bài tập
1. Tạo bảng 1 triệu dòng `(Id, RoundId, ExamOpenId, UserId, Score)` với index `(RoundId, ExamOpenId, UserId)`. Chạy truy vấn lọc `RoundId, UserId` với `SET STATISTICS IO ON`, rồi thêm index `(RoundId, UserId)` và so sánh.
   **Đáp án:** Trước: seek theo `RoundId` rồi residual predicate trên `UserId`, logical reads lớn. Sau: seek đủ hai cột, reads giảm hàng trăm lần.
2. Viết lại vòng `WHILE` cập nhật điểm từng dòng từ một JSON thành một câu set-based.
   **Đáp án:** `UPDATE r SET Score = j.Score FROM dbo.Result r JOIN OPENJSON(@json) WITH (Id bigint, Score int) j ON j.Id = r.Id;`.
3. Tạo dữ liệu lệch (một `UserId` có 500.000 dòng, các user khác vài dòng), gọi proc lần lượt với user nhỏ rồi user lớn, so plan.
   **Đáp án:** Plan của lần đầu (seek + lookup) bị dùng lại cho user lớn, chậm hẳn. Thêm `OPTION (RECOMPILE)` thì mỗi lần có plan riêng.

### Bài 11.2. Locking, isolation, RCSI và applock

#### Mục tiêu
- Sau bài này, bạn giải thích được các loại khóa S, U, X, Sch-M và tương thích giữa chúng.
- So sánh các mức isolation, đặc biệt READ COMMITTED, RCSI và SNAPSHOT.
- Viết được mẫu check-then-insert an toàn bằng `UPDLOCK, HOLDLOCK` và `sp_getapplock`.
- Kể đúng câu chuyện ghi kết quả một lần ở sự kiện Here I Come.

#### Loại khóa
- **S (shared):** đọc. Nhiều S cùng tồn tại.
- **U (update):** đọc với ý định ghi. Tương thích với S nhưng không tương thích với U khác, nên hai phiên cùng "định ghi" phải xếp hàng. Đây là cách tránh deadlock chuyển đổi S → X.
- **X (exclusive):** ghi. Không tương thích với gì.
- **IS, IX:** intent lock ở cấp cao hơn (page, bảng) báo rằng bên dưới có khóa.
- **Sch-S, Sch-M:** schema stability và schema modification. Rebuild clustered index offline giữ Sch-M, chặn mọi truy cập.
- **Lock escalation:** khoảng 5.000 khóa dòng trên một object thì SQL Server thử nâng lên khóa bảng.

#### Isolation level

| Mức | Đọc thấy gì | Cơ chế |
|---|---|---|
| READ UNCOMMITTED (`NOLOCK`) | Có thể đọc dữ liệu chưa commit, sót hoặc lặp dòng | Không giữ S |
| READ COMMITTED (mặc định) | Dữ liệu đã commit | S giữ trong lúc đọc dòng |
| READ COMMITTED SNAPSHOT (RCSI) | Bản đã commit tại lúc **bắt đầu câu lệnh** | Row versioning trong tempdb |
| SNAPSHOT | Bản đã commit tại lúc **bắt đầu transaction** | Row versioning; ghi đụng nhau thì lỗi 3960 |
| REPEATABLE READ | Dòng đã đọc không đổi | Giữ S tới hết transaction |
| SERIALIZABLE (`HOLDLOCK`) | Không có dòng ma | Key-range lock |

**RCSI** làm người đọc không chặn người ghi và ngược lại. Cái giá: version store trong tempdb, mỗi dòng thêm 14 byte, và hành vi đổi: câu đọc thấy bản cũ, nên logic "đọc rồi quyết định ghi" phải tự khóa (`UPDLOCK`) chứ không dựa vào việc bị chặn.

#### Check-then-insert an toàn
Hai request cùng kiểm tra "chưa có kết quả" rồi cùng insert là race kinh điển.
- Chỉ `HOLDLOCK`: hai phiên cùng lấy được S range lock, rồi cùng xin X để insert, gây deadlock.
- `UPDLOCK, HOLDLOCK`: phiên thứ hai chờ ở bước kiểm tra, thấy dòng đã có thì trả bản ghi cũ. Cần index phù hợp để key-range lock đúng phạm vi, không khóa cả bảng.
- **Unique constraint** là hàng rào mạnh nhất nếu được sửa schema.
- **`sp_getapplock`:** khóa theo một tên logic do bạn đặt, kể cả khi chưa có dòng nào. Giá trị trả về `>= 0` là thành công; `-1` timeout, `-2` bị hủy, `-3` bị chọn làm deadlock victim.

```sql
DECLARE @res nvarchar(255) = CONCAT(N'result:', @UserId, N':', @RoundId), @rc int;
BEGIN TRAN;
EXEC @rc = sp_getapplock @Resource = @res, @LockMode = 'Exclusive',
                         @LockOwner = 'Transaction', @LockTimeout = 5000;
IF @rc < 0 THROW 50001, N'Không lấy được lock', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Result WITH (UPDLOCK, HOLDLOCK)
               WHERE UserId = @UserId AND RoundId = @RoundId)
    INSERT dbo.Result (UserId, RoundId, Score) VALUES (@UserId, @RoundId, @Score);
SELECT * FROM dbo.Result WHERE UserId = @UserId AND RoundId = @RoundId;  -- trả bản ghi duy nhất
COMMIT;   -- applock owner = Transaction tự nhả khi commit
```

**Deadlock:** SQL Server chọn một victim và trả lỗi 1205; app nên retry có giới hạn. Xem deadlock graph trong Extended Events `system_health`.

#### Câu chuyện thật
- **Here I Come** (commit 02–09/10, của bạn, nguồn: mục 6): `sp_getapplock` theo (user, vòng) cộng `UPDLOCK/HOLDLOCK`, nên mỗi (user, vòng) chỉ có một bản ghi; request bị retry nhận lại bản ghi đã có. Không dùng unique index vì ràng buộc đã chốt với nghiệp vụ là không tạo object DB mới trên bảng dùng chung. Chi tiết ở Bài 4.1.
- **Phát hiện trong audit** (nguồn: mục 2): procedure cộng/trừ vật phẩm gọi linked server **trong transaction** đang giữ `UPDLOCK/HOLDLOCK`; khi mạng chậm, khóa bị giữ tới 30 s, và wait MSQL_DQ cộng OLEDB chiếm 38,4% thời gian chờ của instance.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| Locking | Khóa S, U, X, Sch-M; `UPDLOCK, HOLDLOCK` cho check-then-insert; applock khóa theo tên logic; RCSI giảm việc đọc chặn ghi nhưng đổi hành vi đọc. | Mục 6, B3 |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn xử lý ghi đồng thời?"** Sự kiện Here I Come: request kết thúc bài có thể bị retry hoặc client gửi lại. Tôi dùng `sp_getapplock` theo (user, vòng) cộng `UPDLOCK, HOLDLOCK` để mỗi (user, vòng) chỉ có một bản ghi kết quả; lần gửi lại nhận về bản ghi đã có. Unique index là cách tốt hơn, nhưng ràng buộc là không tạo object mới trên bảng dùng chung.
- **"Vì sao check-then-insert cần `UPDLOCK, HOLDLOCK` chứ không chỉ `HOLDLOCK`?"** `HOLDLOCK` giữ S range lock; hai phiên cùng giữ S rồi cùng xin X để insert sẽ deadlock. `UPDLOCK` đổi thành khóa U, không tương thích với U khác, nên phiên thứ hai phải chờ ở bước kiểm tra.
- **"RCSI khác SNAPSHOT thế nào?"** RCSI cho mỗi câu lệnh thấy bản đã commit tại lúc câu lệnh bắt đầu, bật ở cấp DB và áp dụng mặc định cho READ COMMITTED. SNAPSHOT giữ một bản nhất quán cho cả transaction, phải bật và chọn tường minh, và báo lỗi xung đột khi hai transaction cùng sửa một dòng.
- **"`NOLOCK` có vấn đề gì?"** Đọc dữ liệu chưa commit (có thể bị rollback), và khi có page split thì có thể sót hoặc đọc lặp dòng. Chấp nhận được cho truy vấn thống kê gần đúng, không dùng cho logic quyết định.
- **"Applock khác khóa dòng thế nào?"** Applock khóa theo tên logic, không cần dòng tồn tại và không phụ thuộc index; chỉ serialize các request cùng key. Khóa dòng với `HOLDLOCK` trên dòng chưa tồn tại phải dựa vào key-range lock, cần index phù hợp mới khóa đúng phạm vi.

#### Tóm tắt
- U lock tồn tại để tránh deadlock chuyển đổi S → X.
- RCSI: đọc không chặn ghi; phải tự khóa khi "đọc rồi quyết định ghi".
- Check-then-insert: unique constraint nếu được, nếu không thì `UPDLOCK, HOLDLOCK` hoặc applock.
- Không gọi ra ngoài (linked server, HTTP) khi đang giữ khóa.

#### Bài tập
1. Mở hai cửa sổ SSMS. Cửa sổ 1 chạy `BEGIN TRAN; UPDATE dbo.T SET V = 1 WHERE Id = 1;` không commit. Cửa sổ 2 chạy `SELECT * FROM dbo.T WHERE Id = 1`. Lặp lại sau khi `ALTER DATABASE ... SET READ_COMMITTED_SNAPSHOT ON`.
   **Đáp án:** Không có RCSI, cửa sổ 2 bị chặn (wait LCK_M_S). Có RCSI, cửa sổ 2 trả ngay giá trị cũ đã commit.
2. Viết check-then-insert chỉ dùng `HOLDLOCK`, chạy song song từ hai cửa sổ với `WAITFOR DELAY '00:00:05'` giữa bước kiểm tra và insert.
   **Đáp án:** Một phiên nhận lỗi 1205 (deadlock victim). Đổi sang `UPDLOCK, HOLDLOCK` thì phiên thứ hai chờ rồi thấy dòng đã có.
3. Gọi `sp_getapplock` với cùng `@Resource` từ hai phiên, `@LockTimeout = 2000`, phiên đầu chưa commit. In giá trị trả về ở phiên hai.
   **Đáp án:** Phiên hai nhận `-1` (timeout) sau 2 giây; phiên đầu commit thì lock tự nhả.

### Bài 11.3. PostgreSQL và MongoDB

#### Mục tiêu
- Sau bài này, bạn giải thích được MVCC của PostgreSQL, VACUUM và các loại index chính.
- Trình bày được streaming replication và vấn đề read-your-writes.
- Giải thích được document model, index ghép và cách chọn shard key của MongoDB.
- Nói đúng phần thật và phần minh họa của kinh nghiệm ở AvePoint.

#### PostgreSQL: MVCC và VACUUM
PostgreSQL lưu **nhiều phiên bản dòng ngay trong bảng**: `UPDATE` tạo tuple mới và đánh dấu tuple cũ hết hiệu lực (qua `xmin`, `xmax`). Người đọc thấy phiên bản hợp với snapshot của mình, nên đọc không chặn ghi. Khác SQL Server với RCSI, nơi bản cũ nằm ở tempdb.

Cái giá: tuple chết tích lại (**bloat**). **VACUUM** (thường do autovacuum chạy) thu hồi chỗ để tái dùng và cập nhật visibility map; `VACUUM FULL` viết lại bảng nhưng khóa độc quyền. VACUUM còn **đóng băng** transaction ID cũ để tránh wraparound của bộ đếm 32 bit. Transaction mở quá lâu chặn VACUUM dọn dẹp.

#### Index và replication
- **B-tree:** mặc định, cho so sánh và khoảng.
- **GIN:** cho `jsonb`, mảng, full-text (`WHERE data @> '{"tenant": 5}'`).
- **BRIN:** rất nhỏ, cho bảng append-only lớn có cột tăng dần theo thời gian.
- **Partial index** (`WHERE status = 'active'`) và **expression index** (`lower(email)`).
- Kế hoạch đọc bằng `EXPLAIN (ANALYZE, BUFFERS)`.

**Streaming replication:** primary gửi WAL sang replica; replica (hot standby) phục vụ đọc. Mặc định bất đồng bộ nên có **replication lag**: user vừa ghi rồi đọc từ replica có thể không thấy dữ liệu của mình (read-your-writes). Xử lý: đọc từ primary ngay sau khi ghi, hoặc chờ replica bắt kịp LSN. Mỗi connection là một process, nên hệ nhiều connection cần pooler như PgBouncer.

#### MongoDB
- **Document model:** dữ liệu thường đọc cùng nhau thì **nhúng** (embed); dữ liệu lớn dần không giới hạn hoặc dùng chung thì **tham chiếu**. Document tối đa 16 MB.
- **Index ghép theo quy tắc ESR:** cột so sánh bằng (Equality) trước, rồi cột sắp xếp (Sort), rồi cột khoảng (Range).
- **Aggregation pipeline:** chuỗi stage `$match`, `$group`, `$sort`, `$lookup`; đặt `$match` sớm để dùng index.
- **Sharding:** shard key quyết định phân bố. Cần cardinality cao, tần suất đều, không tăng đơn điệu (khóa tăng dần dồn ghi vào một shard). Hashed rải đều nhưng truy vấn khoảng phải hỏi mọi shard; ranged hợp truy vấn khoảng nhưng dễ hotspot. Từ 4.4 có **compound hashed shard key**, ví dụ `{ tenantId: 1, _id: "hashed" }`: truy vấn có `tenantId` đi đúng shard, dữ liệu tenant lớn vẫn rải đều. Truy vấn không có shard key thành **scatter-gather**. Từ 5.0 có reshard trực tuyến.
- **Nhất quán:** write concern `majority`, read preference; transaction nhiều document có từ 4.0 (replica set) và 4.2 (sharded cluster).

```javascript
db.attempts.createIndex({ tenantId: 1, status: 1, submittedAt: -1 });   // E, E, S
db.attempts.find({ tenantId: 5, status: "graded" }).sort({ submittedAt: -1 }).explain("executionStats");
sh.shardCollection("lms.attempts", { tenantId: 1, _id: "hashed" });
```

> **Ghi nhớ:** Ở AvePoint (IAS 2.0), PostgreSQL replica và MongoDB sharding là thật; "shard theo tenant" và "900 → 120 ms" là minh họa (nguồn: D4.2). Nói cơ chế thoải mái, không đọc con số minh họa như số đo.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| PostgreSQL | MVCC lưu phiên bản dòng trong bảng nên cần VACUUM; streaming replication bằng WAL, replica có lag nên phải xử lý read-your-writes; index B-tree, GIN cho `jsonb`, BRIN cho bảng append-only. | AvePoint (D4.2) |
| MongoDB | Document model nhúng hay tham chiếu; index ghép theo ESR; aggregation pipeline; shard key cardinality cao, tránh khóa tăng dần, truy vấn thiếu shard key thành scatter-gather. | AvePoint (D4.2) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng PostgreSQL replica?"** Ở IAS 2.0 tại AvePoint, chúng tôi chuyển truy vấn đọc nặng sang replica bằng streaming replication, primary bớt tranh chấp I/O và buffer cache với truy vấn báo cáo. Vấn đề phải xử lý là read-your-writes: ngay sau khi ghi thì đọc từ primary. Con số cải thiện cụ thể tôi không dùng vì không có số đo để đối chiếu.
- **"Kể một lần bạn dùng MongoDB sharding?"** Cũng ở IAS 2.0, dữ liệu được shard. Bài học chính là chọn shard key: chỉ dùng `tenantId` thì tenant lớn tạo chunk to và hotspot; khóa ghép `tenantId` cộng `_id` hashed giữ được truy vấn theo tenant đi đúng shard mà vẫn rải đều. Cấu hình chính xác của dự án tôi nói theo thực tế, không suy diễn thêm.
- **"VACUUM để làm gì?"** Thu hồi chỗ của tuple chết do MVCC để tái dùng, cập nhật visibility map cho index-only scan, và đóng băng transaction ID cũ để tránh wraparound. Transaction mở lâu chặn VACUUM nên phải theo dõi.
- **"MVCC của PostgreSQL khác RCSI của SQL Server thế nào?"** PostgreSQL giữ phiên bản cũ ngay trong bảng nên sinh bloat và cần VACUUM. SQL Server với RCSI đẩy bản cũ vào version store ở tempdb, dọn tự động, cái giá là tải tempdb và 14 byte mỗi dòng.
- **"Chọn shard key MongoDB thế nào?"** Cardinality cao, phân bố tần suất đều, không tăng đơn điệu, và phần lớn truy vấn chứa shard key để không phải scatter-gather. Cân nhắc compound hashed key khi cần cả định tuyến theo tenant lẫn rải đều.

#### Tóm tắt
- PostgreSQL MVCC giữ phiên bản trong bảng; VACUUM là bắt buộc, transaction dài là kẻ thù.
- Replica bất đồng bộ có lag: xử lý read-your-writes.
- MongoDB: index theo ESR; shard key quyết định cả phân bố lẫn định tuyến.
- Kinh nghiệm AvePoint: cơ chế thật, con số minh họa.

#### Bài tập
1. Chạy PostgreSQL bằng Docker, tạo bảng 1 triệu dòng, `UPDATE` toàn bộ hai lần, xem `n_dead_tup` trong `pg_stat_user_tables`, rồi chạy `VACUUM (VERBOSE)`.
   **Đáp án:** `n_dead_tup` khoảng 2 triệu sau hai lần update; sau VACUUM về gần 0 nhưng kích thước file không giảm (chỉ `VACUUM FULL` mới trả dung lượng cho OS).
2. Tạo cột `jsonb`, truy vấn `WHERE data @> '{"tenant": 5}'` trước và sau khi tạo index GIN, so `EXPLAIN ANALYZE`.
   **Đáp án:** Trước là Seq Scan; sau là Bitmap Index Scan trên index GIN, thời gian giảm mạnh khi điều kiện chọn lọc.
3. Với MongoDB, tạo hai index `{tenantId, submittedAt, status}` và `{tenantId, status, submittedAt}`, chạy truy vấn lọc `tenantId`, `status` và sort `submittedAt`, so `executionStats`.
   **Đáp án:** Index theo ESR (`tenantId, status, submittedAt`) không cần stage SORT trong bộ nhớ và đọc ít key hơn.

### Bài 11.4. Redis

#### Mục tiêu
- Sau bài này, bạn giải thích được mô hình thực thi đơn luồng và hệ quả của nó (`KEYS`, `SCAN`, Lua dài).
- Chọn đúng kiểu dữ liệu và pattern cache: cache-aside, version key, negative cache, single-flight.
- Giải thích Redis Cluster theo hash slot và lock `SET NX` có token.
- Tách bạch phần Redis bạn tự sửa với lớp có sẵn bạn chỉ dùng.

#### Mô hình thực thi và kiểu dữ liệu
Redis thực thi lệnh trên **một luồng chính** (từ Redis 6 có I/O thread cho mạng, nhưng lệnh vẫn chạy tuần tự). Mỗi lệnh nguyên tử; một lệnh chậm chặn mọi client.

| Kiểu | Dùng cho |
|---|---|
| String | Cache JSON, counter (`INCR`), lock |
| Hash | Object nhiều field, phiên thi |
| Set | Tập key liên quan (làm index để xóa), tập duy nhất |
| Sorted set | Bảng xếp hạng (`ZADD`, `ZREVRANK`, `ZREVRANGE`) |
| Stream | Log sự kiện nhẹ có consumer group |

- **`KEYS`** là O(N) trên toàn keyspace trong một lệnh: cấm trên production. **`SCAN`** chia nhỏ theo cursor nên không chặn lâu một lần, nhưng tổng chi phí vẫn O(N); gọi nó trên đường nóng là thiết kế sai. **`UNLINK`** xóa key lớn ở luồng nền thay vì `DEL` chặn.
- **Eviction** theo `maxmemory-policy` (mặc định `noeviction`; cache thường dùng `allkeys-lru` hoặc `allkeys-lfu`). **Persistence:** RDB (snapshot) và AOF (log lệnh).
- **Redis Cluster:** 16.384 hash slot, slot = CRC16(key) mod 16384. Lệnh nhiều key (`MGET`, Lua) chỉ chạy khi các key cùng slot; dùng **hash tag** `{user:42}:session` để ép cùng slot.
- Redis 7 thêm **Functions** (script lưu trên server) và sharded pub/sub; Redis 7.4 có TTL cho từng field của hash (`HEXPIRE`). Từ 7.4 Redis đổi license, cộng đồng tách nhánh **Valkey**; Redis 8 bổ sung lại lựa chọn AGPL.

#### Pattern cache
- **Cache-aside:** đọc cache, miss thì đọc DB rồi ghi cache với TTL. Khi ghi: ghi DB trước rồi xóa cache.
- **Version key:** key chứa số version (`pricing:v{n}:{service}`); dữ liệu đổi thì `INCR` version, key cũ không còn được đọc và tự hết hạn. Invalidate O(1), không cần `SCAN`.
- **Negative cache:** cache cả kết quả rỗng (TTL ngắn hơn) để tổ hợp không có dữ liệu không đập DB mãi.
- **Cache stampede:** nhiều request miss cùng lúc. Chống bằng single-flight, lock khi nạp lại, jitter TTL, refresh sớm.

#### Lua và lock
Lua chạy nguyên khối trên server: không lệnh nào xen vào giữa. `MULTI/EXEC` cũng nguyên tử nhưng không cho dùng kết quả đọc để quyết định bước sau trong cùng transaction (phải `WATCH` và retry). Script phải ngắn vì chặn cả server.

```lua
-- KEYS[1] = khóa phiên, ARGV[1] = sessionId mong đợi, ARGV[2] = sessionId mới, ARGV[3] = TTL giây
local cur = redis.call('GET', KEYS[1])
if (not cur) or cur == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return 1
end
return 0
```

Lock: `SET lock:{key} <token> NX PX 5000`; nhả bằng Lua chỉ `DEL` khi giá trị vẫn là token của mình. Lock có TTL vẫn có thể bị hai process cùng giữ (process bị GC pause quá TTL, lock hết hạn, process khác lấy). Vì vậy lock Redis chỉ để **giảm tranh chấp**; tính đúng đắn phải do DB đảm bảo (applock, unique, fencing token).

#### Bằng chứng: phần của bạn và phần có sẵn
- **Của bạn** (commit 21/09, nguồn: mục 4): procedure lấy danh mục môn/vòng chạy khoảng 81,16 triệu lần (số cộng dồn trong DMV) vì TTL dùng chung biến 1 giây và list rỗng không bao giờ được cache. Sửa: key V2 lưu JSON, cache cả list rỗng, TTL 6 giờ, hàm xóa cache cho CMS. Cache gói cước 60 phút với version key. Chi tiết ở Bài 3.3.
- **Lớp có sẵn** (nguồn: B3, B5): Lua CAS một phiên thi mỗi user, lock `SET NX` có token, cache 2 tầng, single-flight trong từng pod, idempotency key. Nói "tôi hiểu và làm việc trên lớp đó", không nhận là tự viết.
- **Fix `SCAN` 472 vòng** (nguồn: mục 3.1) là commit của đồng nghiệp; bạn chỉ nhận phần phân tích nếu đúng là bạn phân tích.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| Redis | Kiểu dữ liệu (string, hash, set, sorted set), TTL, Lua nguyên tử, Redis Cluster theo hash slot, không dùng `KEYS`/`SCAN` trên đường nóng. Invalidate bằng version key, cache cả kết quả rỗng; lock Redis chỉ giảm tranh chấp, DB giữ tính đúng. | B3, B5, mục 4 |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng Redis?"** Một procedure cấu hình chạy khoảng 81 triệu lần theo DMV. Tôi tìm ra hai lỗi trong code cache: TTL dùng chung biến 1 giây, và list rỗng bị coi là cache miss nên không bao giờ được cache. Tôi chuyển sang key V2 lưu JSON, cache cả kết quả rỗng, TTL 6 giờ và thêm hàm xóa cache cho CMS. Cùng commit, cache gói cước dùng version key để invalidate O(1).
- **"Vì sao không dùng `KEYS`, và `SCAN` trên đường nóng cũng không ổn?"** Redis chạy lệnh trên một luồng; `KEYS` duyệt toàn keyspace trong một lệnh và chặn mọi client. `SCAN` không chặn lâu một lần nhưng tổng chi phí vẫn tỉ lệ với keyspace. Cần thiết kế để biết trước key cần xóa: version key, hoặc một SET làm index.
- **"Redis Cluster xử lý lệnh nhiều key thế nào?"** Chỉ chạy được khi mọi key cùng hash slot, nếu không thì lỗi CROSSSLOT. Dùng hash tag `{...}` để ép các key liên quan về cùng slot, cẩn thận để không tạo slot nóng.
- **"Lua script khác `MULTI/EXEC` thế nào?"** Cả hai đều nguyên tử, nhưng Lua đọc được giá trị rồi quyết định ghi ngay trên server. `MULTI/EXEC` chỉ xếp lệnh; muốn điều kiện thì phải `WATCH` và retry phía client.
- **"Lock Redis có TTL, vì sao vẫn có thể hai process cùng giữ?"** Process giữ lock bị dừng (GC, mạng) quá TTL; lock hết hạn, process khác lấy; process cũ tỉnh lại vẫn tưởng mình giữ. Vì vậy cần fencing token hoặc để DB đảm bảo đúng đắn; lock Redis chỉ giảm tranh chấp.

#### Tóm tắt
- Một luồng thực thi: lệnh O(N) và Lua dài chặn tất cả.
- Version key và SET làm index thay cho xóa theo pattern.
- Negative cache với TTL ngắn; chống stampede bằng single-flight, jitter, refresh sớm.
- Cluster: 16.384 slot, multi-key cần hash tag.
- Phần của bạn là fix cache 81M và gói cước; Lua CAS và single-flight là lớp có sẵn.

#### Bài tập
1. Chạy Redis bằng Docker, nạp 1 triệu key bằng `redis-benchmark` hoặc script, đo thời gian `KEYS *` và vòng `SCAN 0 COUNT 1000` tới hết, đồng thời chạy `redis-cli --latency` ở cửa sổ khác.
   **Đáp án:** `KEYS` làm latency của client khác nhảy vọt trong lúc chạy; `SCAN` không gây đỉnh lớn nhưng cần hàng nghìn vòng, tổng thời gian không nhỏ.
2. Viết cache-aside bằng StackExchange.Redis cho một hàm đọc chậm 200 ms, có version key và negative cache (TTL 60 giây cho kết quả rỗng).
   **Đáp án:** Key `catalog:v{ver}:{id}`; lưu chuỗi `"[]"` cho rỗng để phân biệt với `null` (chưa cache); hàm invalidate chỉ `INCR catalog:ver`.
3. Viết script Lua nhả lock theo token và test: process A lấy lock TTL 1 giây, chờ 2 giây, process B lấy lock, A gọi nhả lock.
   **Đáp án:** Script `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`; A nhận 0, lock của B còn nguyên.

### Bài 11.5. ClickHouse và kho cột

#### Mục tiêu
- Sau bài này, bạn giải thích được vì sao lưu theo cột nhanh cho truy vấn tổng hợp.
- Trình bày được MergeTree: part, merge nền, `ORDER BY` làm sparse primary index, các biến thể Replacing và Aggregating.
- Biết khi nào ClickHouse đáng dùng và khi nào columnstore trên SQL Server là đủ.
- Trả lời trung thực rằng ClickHouse chưa có bằng chứng dùng thật.

#### Lưu theo cột
Kho dòng (row store) lưu cả dòng liền nhau, hợp với đọc/ghi từng bản ghi. Kho cột lưu từng cột liền nhau, nên truy vấn `SUM(score) GROUP BY province` chỉ đọc hai cột thay vì cả dòng. Cột cùng kiểu nén rất tốt (thường gấp nhiều lần), và engine xử lý theo khối vector, tận dụng SIMD. Đổi lại, cập nhật hay xóa từng dòng rất đắt.

#### MergeTree
- Mỗi lần insert tạo một **part** bất biến trên đĩa; tiến trình nền **merge** các part nhỏ thành part lớn.
- **`ORDER BY`** quyết định thứ tự lưu và tạo **sparse primary index**: mỗi granule (mặc định 8.192 dòng) một mục. Index không duy nhất và không đi tới từng dòng như B-tree của SQL Server; nó giúp bỏ qua các granule không liên quan.
- **`PARTITION BY`** (thường theo tháng) để quản lý vòng đời dữ liệu, không phải để tăng tốc truy vấn.
- **ReplacingMergeTree:** giữ dòng mới nhất theo cột version khi merge. Merge chạy lúc nào không biết trước, nên truy vấn cần chính xác phải dùng `FINAL` hoặc `argMax`.
- **AggregatingMergeTree / SummingMergeTree** cộng với **materialized view**: MV trong ClickHouse là trigger lúc insert, tổng hợp trước vào bảng đích.
- Insert theo lô lớn (hàng nghìn tới hàng trăm nghìn dòng); insert từng dòng tạo quá nhiều part. Cần insert nhỏ thì bật `async_insert`.
- Xóa: lightweight `DELETE` đánh dấu dòng; `ALTER TABLE ... DELETE` là mutation viết lại part, rất nặng.

```sql
CREATE TABLE attempt_events
(
    tenant_id UInt32, user_id UInt64, round_id UInt32,
    score Float32, submitted_at DateTime, version UInt64
)
ENGINE = ReplacingMergeTree(version)
PARTITION BY toYYYYMM(submitted_at)
ORDER BY (tenant_id, round_id, user_id);

SELECT round_id, avg(score) FROM attempt_events FINAL
WHERE tenant_id = 5 GROUP BY round_id;
```

#### Khi nào dùng
Dùng khi: dữ liệu sự kiện lớn (hàng trăm triệu dòng trở lên), truy vấn tổng hợp nhiều chiều, dashboard cần trả nhanh. Không dùng khi: cần transaction, cập nhật từng dòng thường xuyên, hoặc dữ liệu vừa sức SQL Server. **Columnstore index** trên SQL Server (có ở Standard Edition từ 2016 SP1, có giới hạn bộ nhớ và độ song song) là phương án nên thử trước, vì không thêm hạ tầng. Pipeline CDC → Kafka → ClickHouse đầy đủ ở Bài 5.1.

> **Ghi nhớ:** Thực tế hiện có là warehouse báo cáo dùng SQL Server Agent job chạy mỗi 60 phút, dữ liệu trễ tối đa khoảng 1 giờ (nguồn: mục 7). Design doc CDC → ClickHouse là minh họa (nguồn: D2.9).

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| ClickHouse | Lưu theo cột, MergeTree với `ORDER BY` làm sparse index, materialized view tổng hợp lúc insert; mạnh về tổng hợp trên dữ liệu lớn, yếu về update từng dòng. Thử columnstore trên SQL Server trước khi thêm hạ tầng. | Chưa có (D2.9) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng ClickHouse?"** Trả lời trung thực: tôi chưa vận hành ClickHouse trên production. Hệ báo cáo tôi làm việc là SQL Server Agent job tổng hợp mỗi giờ, phần C# của API báo cáo là của tôi. Tôi đã nghiên cứu phương án CDC qua Kafka vào ClickHouse cho bài toán đó và nói được thiết kế cùng đánh đổi, nhưng chưa triển khai.
- **"Vì sao kho cột nhanh cho truy vấn tổng hợp?"** Chỉ đọc đúng cột cần, cột cùng kiểu nén tốt nên I/O ít, và engine xử lý theo khối vector. Truy vấn quét hàng trăm triệu dòng nhưng chỉ vài cột là đúng sở trường.
- **"`ORDER BY` trong MergeTree khác primary key của SQL Server thế nào?"** Nó là thứ tự lưu cộng sparse index theo granule 8.192 dòng, không đảm bảo duy nhất và không trỏ tới từng dòng. Chọn cột hay lọc nhất, cardinality thấp đứng trước.
- **"ReplacingMergeTree có đảm bảo không trùng không?"** Không tức thì. Dòng trùng chỉ bị gộp khi merge nền chạy. Truy vấn cần chính xác dùng `FINAL` hoặc `argMax(col, version)` theo khóa.
- **"Vì sao không nên insert từng dòng vào ClickHouse?"** Mỗi insert tạo một part; quá nhiều part nhỏ làm merge không kịp và có thể bị chặn insert ("too many parts"). Gom lô, hoặc bật `async_insert` để server tự gom.

#### Tóm tắt
- Kho cột: đọc ít cột, nén tốt, xử lý vector; yếu ở update từng dòng.
- MergeTree: part bất biến, merge nền, `ORDER BY` là sparse index.
- ReplacingMergeTree chỉ khử trùng khi merge; dùng `FINAL` hoặc `argMax`.
- Thử columnstore trên SQL Server trước; ClickHouse chưa có bằng chứng thật.

#### Bài tập
1. Chạy ClickHouse bằng Docker, tạo bảng MergeTree và nạp 50 triệu dòng bằng `INSERT ... SELECT` từ `numbers(50000000)`. Đo `SELECT round_id, avg(score) ... GROUP BY round_id`, rồi xem `system.parts` để biết dung lượng nén.
   **Đáp án:** Truy vấn tổng hợp thường chạy dưới một giây trên máy cá nhân; tỉ lệ nén xem bằng `sum(data_compressed_bytes)` so với `sum(data_uncompressed_bytes)`.
2. Insert hai lần cùng một `(tenant_id, round_id, user_id)` với version khác nhau vào ReplacingMergeTree, đếm dòng có và không có `FINAL`, rồi chạy `OPTIMIZE TABLE ... FINAL`.
   **Đáp án:** Không `FINAL` thấy 2 dòng; có `FINAL` thấy 1; sau `OPTIMIZE` thì dữ liệu vật lý chỉ còn 1.
3. Trên SQL Server, tạo bảng 10 triệu dòng, chạy cùng truy vấn tổng hợp trước và sau khi thêm nonclustered columnstore index, so logical reads và thời gian.
   **Đáp án:** Có columnstore, plan dùng batch mode, reads và thời gian giảm mạnh; đây là phương án nên thử trước khi thêm ClickHouse.

## Chương 12. Hệ phân tán

Chương này phủ các keyword của hệ phân tán: Kafka, RabbitMQ, CQRS, saga, transactional outbox, CDC, idempotency và eventual consistency. Đây là nhóm interviewer senior đào sâu nhất, vì sai một chữ (gọi idempotent write là "exactly-once") là lộ ngay mức hiểu.

Bằng chứng ở chương này lẫn lộn giữa thật, một phần và chưa có, nên mỗi bài ghi rõ ranh giới: consumer Kafka kết thúc game do đồng nghiệp viết, bảng outbox ở Mastery chưa chung transaction, saga và CDC chưa có. Học xong, bạn giải thích được cơ chế chính xác và kể đúng phần mình.

### Bài 12.1. Kafka

#### Mục tiêu
- Sau bài này, bạn giải thích được topic, partition, offset, consumer group, rebalance và replication.
- Nêu được đảm bảo thứ tự và các chiến lược commit offset cùng ngữ nghĩa giao nhận tương ứng.
- Xử lý được câu hỏi về lag, retry, DLQ và exactly-once của Kafka.
- Kể đúng phạm vi hai luồng Kafka thật: kết thúc game và leaderboard IOM.

#### Mô hình log
Kafka là **log phân tán chỉ ghi nối**. Một **topic** chia thành nhiều **partition**; mỗi message trong partition có **offset** tăng dần. Message không bị xóa khi đọc mà giữ theo retention, nên nhiều **consumer group** đọc độc lập và có thể đọc lại (replay).

- **Replication:** mỗi partition có một leader và các follower; ISR là tập replica bắt kịp. Producer `acks=all` cùng `min.insync.replicas=2` (với replication factor 3) thì message chỉ được xác nhận khi ít nhất 2 replica đã có.
- **Idempotent producer:** `enable.idempotence=true` (mặc định từ client Kafka 3.0) chống ghi trùng khi producer retry.
- **Kafka 4.0** bỏ hẳn ZooKeeper, chỉ chạy KRaft, và giao thức consumer group mới (KIP-848) giúp rebalance nhẹ hơn.

#### Thứ tự, consumer group, commit
- **Thứ tự chỉ đảm bảo trong một partition.** Message cùng key vào cùng partition, nên đặt key theo thực thể cần giữ thứ tự (`userId`, `matchId`). Key nóng làm lệch tải.
- **Consumer group:** mỗi partition chỉ giao cho một consumer trong group; số consumer hữu ích tối đa bằng số partition.
- **Commit offset:**
  - Auto-commit theo chu kỳ: crash sau commit mà chưa xử lý xong thì **mất** message.
  - Commit sau khi xử lý: **at-least-once**, crash thì xử lý lại, nên handler phải idempotent.
  - Commit trước khi xử lý: at-most-once.
- **Exactly-once của Kafka** (transactions) chỉ đúng cho chuỗi đọc Kafka → xử lý → ghi Kafka. Ghi ra DB bên ngoài thì vẫn là at-least-once cộng xử lý idempotent.

```csharp
var config = new ConsumerConfig
{
    BootstrapServers = "localhost:9092", GroupId = "finish-game",
    EnableAutoCommit = false, AutoOffsetReset = AutoOffsetReset.Earliest
};
using var consumer = new ConsumerBuilder<string, string>(config).Build();
consumer.Subscribe("game-finished");
while (!ct.IsCancellationRequested)
{
    var cr = consumer.Consume(TimeSpan.FromMilliseconds(200));
    if (cr is null) continue;
    await handler.HandleAsync(cr.Message.Value, ct);   // check-then-insert, idempotent
    consumer.Commit(cr);                               // commit sau khi xử lý: at-least-once
}
```

#### Lag, retry, DLQ
- **Consumer lag** = offset mới nhất − offset đã commit. Lag tăng đều nghĩa là xử lý chậm hơn tốc độ đến: tối ưu handler, tăng partition và consumer, hoặc xử lý song song theo key trong một consumer (phải commit offset liên tục mới an toàn).
- **Lỗi tạm thời** (timeout DB): retry có backoff, hoặc retry topic có delay. **Lỗi dữ liệu** (message hỏng): đẩy vào DLQ để xử lý tay, không chặn partition.
- Handler chạy lâu hơn `max.poll.interval.ms` thì consumer bị coi là chết và bị rebalance.

#### Hai luồng thật
- **Kết thúc game** (nguồn: B2, mục 14): API kết thúc game publish lên topic theo loại thi; worker map topic nguồn sang đích, gọi hàm kiểm tra rồi mới ghi để không trùng; message lỗi ghi vào action log riêng. `Consume` timeout 200 ms; số message mỗi vòng tăng dần từ 5 lên 500 (mỗi 30 s cộng 10, nghỉ 50 ms giữa các vòng) để không dội tải vào DB sau khi restart. **Consumer do đồng nghiệp viết**; phần của bạn là nâng worker lên .NET 10. Config đang bật auto-commit: biết rủi ro và cách sửa.
- **Leaderboard IOM** (nguồn: D2.11, C2): bạn code toàn bộ luồng: sự kiện điểm vào Kafka partition theo `matchId`, consumer ghi Redis sorted set, API đọc top-N. Số 10K người chơi là ước lượng, chưa đo. Chi tiết ở Bài 5.3.

> **Cảnh báo:** Không gọi việc tăng dần 5 → 500 là "batch insert". Consumer xử lý tuần tự từng message; đó là ramp-up throughput.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| Kafka | Topic, partition, consumer group, offset; thứ tự chỉ trong một partition nên key theo thực thể; at-least-once khi commit sau xử lý, kèm handler idempotent; lag tăng thì tối ưu handler hoặc thêm partition và consumer. | B2, D2.11 |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng Kafka?"** Có hai luồng. Leaderboard IOM tôi code toàn bộ: sự kiện điểm vào Kafka với key `matchId` để giữ thứ tự trong trận, consumer ghi Redis sorted set bằng `ZADD` điểm tuyệt đối nên replay không làm điểm tăng gấp đôi. Luồng kết thúc game thì consumer do đồng nghiệp viết; tôi nắm luồng, nâng worker lên .NET 10, và chỉ ra rủi ro auto-commit.
- **"Kafka đảm bảo thứ tự thế nào?"** Chỉ trong một partition. Muốn mọi message của một user hoặc một trận theo thứ tự thì đặt key theo thực thể đó. Producer không đặt key thì message bị rải, không còn thứ tự theo thực thể.
- **"Auto-commit có rủi ro gì?"** Offset được commit theo chu kỳ, độc lập với việc xử lý. Crash sau khi commit mà chưa xử lý xong thì message bị mất. Sửa: tắt auto-commit, commit sau khi xử lý (hoặc `EnableAutoOffsetStore = false` và `StoreOffset` sau xử lý), handler idempotent để chịu được replay.
- **"Consumer lag tăng dần, bạn làm gì?"** Xem handler chậm ở đâu (DB, gọi ngoài) bằng metric latency xử lý; tối ưu hoặc ghi theo lô; tăng partition và consumer trong group nếu lag phân bố đều; nếu lệch vào một partition thì là key nóng, phải đổi key.
- **"Exactly-once của Kafka nghĩa là gì?"** Transaction của Kafka cho exactly-once trong phạm vi đọc từ Kafka và ghi lại Kafka. Khi handler ghi DB, ngữ nghĩa thực tế là at-least-once cộng xử lý idempotent, tức effectively-once.

#### Tóm tắt
- Log phân tán: partition, offset, consumer group đọc độc lập, replay được.
- Thứ tự chỉ trong partition; key theo thực thể cần thứ tự.
- Commit sau xử lý cho at-least-once; handler phải idempotent.
- Kafka 4.0 chỉ còn KRaft; exactly-once chỉ trong phạm vi Kafka.
- Consumer kết thúc game không phải của bạn; leaderboard IOM là của bạn.

#### Bài tập
1. Chạy Kafka 4.x một node (KRaft) bằng Docker, tạo topic 3 partition. Produce 30 message với 3 key khác nhau, chạy 2 consumer cùng group, in partition và offset.
   **Đáp án:** Message cùng key luôn vào cùng partition và đến theo thứ tự; 3 partition chia cho 2 consumer (một consumer nhận 2 partition).
2. Trong consumer tắt auto-commit, cho handler ném exception ngẫu nhiên rồi kill process giữa chừng. Khởi động lại và kiểm tra message nào bị xử lý lại.
   **Đáp án:** Các message sau offset đã commit cuối cùng được giao lại. Thêm bảng hoặc set "đã xử lý" theo message id để lần thứ hai bỏ qua.
3. Tính số partition tối thiểu: tải 6.000 message/s, mỗi consumer xử lý tuần tự 500 message/s, cần dư 50%.
   **Đáp án:** 6.000 / 500 = 12 consumer; dư 50% là 18. Cần ít nhất 18 partition vì số consumer hữu ích không vượt số partition.

### Bài 12.2. RabbitMQ

#### Mục tiêu
- Sau bài này, bạn giải thích được exchange, binding, queue và bốn loại exchange.
- Nắm ack, prefetch, publisher confirm, dead-letter exchange và quorum queue.
- So sánh được RabbitMQ với Kafka và chọn theo bài toán.

#### Mô hình
Producer gửi message tới **exchange**; exchange định tuyến tới **queue** theo **binding**; consumer nhận từ queue. Một message trong queue chỉ giao cho một consumer.

| Exchange | Định tuyến |
|---|---|
| direct | Routing key khớp chính xác |
| topic | Routing key khớp mẫu (`exam.*.submitted`, `exam.#`) |
| fanout | Gửi tới mọi queue đã bind |
| headers | Theo header của message |

#### Độ bền và giao nhận
- **Ack thủ công:** consumer ack sau khi xử lý; mất kết nối trước khi ack thì message được giao lại (at-least-once). `nack` với `requeue: false` đưa message sang dead-letter exchange.
- **Prefetch** (`basic.qos`): số message chưa ack tối đa mỗi consumer. Quá cao thì một consumer ôm hết, quá thấp thì throughput thấp.
- **Publisher confirm:** broker xác nhận đã nhận message; không bật thì producer không biết message có tới không.
- **Bền qua restart:** queue durable **và** message persistent. Thiếu một trong hai là mất khi broker restart.
- **Dead-letter exchange (DLX):** queue khai báo `x-dead-letter-exchange`; message bị nack, hết TTL hoặc vượt độ dài queue sẽ sang đó. Retry có delay: queue chờ có TTL, hết TTL thì dead-letter quay lại queue chính.
- **Quorum queue** (dựa trên Raft) là lựa chọn mặc định cho dữ liệu quan trọng. RabbitMQ 4.0 đã bỏ classic mirrored queue. **Streams** cho nhu cầu log có replay.

```csharp
var factory = new ConnectionFactory { HostName = "localhost" };
await using var conn = await factory.CreateConnectionAsync();
await using var ch = await conn.CreateChannelAsync();
await ch.QueueDeclareAsync("enrollment", durable: true, exclusive: false, autoDelete: false,
    arguments: new Dictionary<string, object?>
    {
        ["x-queue-type"] = "quorum",
        ["x-dead-letter-exchange"] = "enrollment.dlx"
    });
await ch.BasicQosAsync(prefetchSize: 0, prefetchCount: 20, global: false);

var consumer = new AsyncEventingBasicConsumer(ch);
consumer.ReceivedAsync += async (_, ea) =>
{
    try { await HandleAsync(ea.Body, ct); await ch.BasicAckAsync(ea.DeliveryTag, multiple: false); }
    catch (Exception) { await ch.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false); }
};
await ch.BasicConsumeAsync("enrollment", autoAck: false, consumer: consumer);
```

#### RabbitMQ hay Kafka

| Tiêu chí | RabbitMQ | Kafka |
|---|---|---|
| Mô hình | Queue: message giao một consumer rồi xóa | Log: giữ theo retention, nhiều group đọc độc lập |
| Định tuyến | Linh hoạt (topic, headers) | Theo topic và partition |
| Replay | Không (trừ Streams) | Có |
| Thứ tự | Theo queue, mất khi nhiều consumer | Theo partition |
| Hợp với | Task queue, command, định tuyến phức tạp | Event stream, throughput lớn, nhiều bên đọc |

> **Ghi nhớ:** Ở AvePoint (IAS 2.0), migrate sang .NET với CQRS và RabbitMQ là thật (nguồn: D4.1, mục 13): projection của read model cập nhật qua event từ RabbitMQ.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| RabbitMQ | Exchange (direct, topic, fanout), queue, ack thủ công, dead-letter queue, prefetch; quorum queue cho dữ liệu quan trọng. Chọn RabbitMQ cho task queue và định tuyến, Kafka cho event stream cần replay. | AvePoint |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng RabbitMQ?"** Ở IAS 2.0 tại AvePoint, hệ mới dùng CQRS: phía ghi phát event qua RabbitMQ, projection cập nhật read model. Những điều phải xử lý: consumer idempotent vì message có thể giao lại, không dựa vào thứ tự giữa các consumer, retry và dead-letter queue cho message lỗi. Chi tiết cấu hình cụ thể tôi nói theo đúng những gì còn nhớ, không thêm số.
- **"Khi nào chọn RabbitMQ thay vì Kafka?"** Khi cần hàng đợi công việc với ack từng message, định tuyến linh hoạt theo routing key, retry có delay, và không cần replay. Cần lưu lâu, nhiều nhóm đọc độc lập hoặc throughput rất lớn thì chọn Kafka.
- **"Prefetch ảnh hưởng gì?"** Giới hạn số message chưa ack mỗi consumer. Cao quá thì một consumer giữ nhiều message, consumer khác rảnh và message chậm bị kẹt; thấp quá thì mỗi message chờ một vòng mạng. Chọn theo thời gian xử lý mỗi message.
- **"Retry có delay trong RabbitMQ làm thế nào?"** Nack sang một queue chờ có TTL, queue đó dead-letter về queue chính khi hết TTL; đếm số lần qua header `x-death` và đẩy sang DLQ khi vượt ngưỡng. Hoặc dùng plugin delayed message.
- **"Broker restart làm mất message, nguyên nhân thường là gì?"** Queue không durable hoặc message không persistent, hoặc producer không bật publisher confirm nên không biết message chưa tới. Với dữ liệu quan trọng dùng quorum queue.

#### Tóm tắt
- Producer → exchange → binding → queue → consumer.
- Ack thủ công cho at-least-once; nack không requeue để sang DLX.
- Durable queue cộng persistent message cộng publisher confirm thì mới bền.
- Quorum queue là mặc định; RabbitMQ 4.0 bỏ mirrored queue.

#### Bài tập
1. Chạy RabbitMQ bằng Docker (có management UI), tạo topic exchange `exam` và hai queue bind `exam.*.submitted` và `exam.#`. Publish với routing key `exam.ielts.submitted` và `exam.ielts.graded`.
   **Đáp án:** `exam.ielts.submitted` vào cả hai queue; `exam.ielts.graded` chỉ vào queue bind `exam.#`.
2. Dựng retry có delay 10 giây và tối đa 3 lần bằng queue chờ có TTL và DLX.
   **Đáp án:** Queue chính có DLX trỏ tới exchange retry; queue retry có `x-message-ttl = 10000` và DLX trỏ về exchange chính; consumer đọc `x-death` count, vượt 3 thì publish sang queue `parking-lot`.
3. Cho handler mất 1 giây, chạy 2 consumer với prefetch 1 và prefetch 100, publish 200 message, quan sát phân bổ.
   **Đáp án:** Prefetch 100 làm consumer đầu tiên nhận gần hết; prefetch 1 chia đều, tổng thời gian khoảng 100 giây.

### Bài 12.3. CQRS, saga, outbox và CDC

#### Mục tiêu
- Sau bài này, bạn giải thích được CQRS, khi nào cần và cái giá eventual consistency.
- Phân biệt saga orchestration và choreography, thiết kế được hành động bù trừ.
- Giải thích dual-write và transactional outbox, nhận ra outbox "chưa đúng nghĩa".
- Giải thích CDC đọc transaction log và rủi ro vận hành.

#### CQRS
CQRS tách **mô hình ghi** (command, giữ bất biến, chuẩn hóa) khỏi **mô hình đọc** (query, phi chuẩn hóa theo màn hình). Read model được cập nhật bằng **projection** nghe event từ phía ghi, nên đọc trễ một chút (eventual consistency). CQRS không bắt buộc event sourcing. Đáng dùng khi tải đọc và ghi lệch nhau nhiều hoặc màn hình đọc cần dạng dữ liệu rất khác mô hình ghi; thừa thãi với CRUD.

#### Saga
Khi một nghiệp vụ trải qua nhiều service, không có transaction ACID chung. **Saga** là chuỗi transaction cục bộ; bước nào lỗi thì chạy **hành động bù trừ** cho các bước đã xong (hủy giữ chỗ, hoàn tiền).
- **Orchestration:** một state machine trung tâm gửi command và theo dõi trạng thái. Dễ nhìn luồng, có điểm điều phối.
- **Choreography:** mỗi service nghe event và phản ứng. Ít phụ thuộc, nhưng luồng khó nhìn khi nhiều bước.
- Mỗi bước cần idempotent, có timeout; bù trừ cũng phải idempotent và không phải lúc nào cũng "hoàn tác" được (email đã gửi thì chỉ gửi email đính chính).

Chỉ cần saga khi có **nhiều bước ghi ở nhiều nơi**. Luồng chỉ cần một lần ghi atomic thì không cần: attempt engine V3 cố ý gom về đúng một lần ghi nên không có trạng thái ghi dở (nguồn: mục 5). Thiết kế saga và outbox chi tiết ở Bài 8.3.

#### Transactional outbox
**Dual-write:** ghi DB rồi publish message. DB thành công mà publish lỗi thì event mất; publish trước mà DB rollback thì event sai. **Outbox:** ghi dữ liệu nghiệp vụ và một dòng outbox **trong cùng transaction**; một relay đọc outbox và publish, đánh dấu đã gửi. Relay có thể publish trùng (crash sau publish, trước khi đánh dấu), nên consumer phải idempotent (bảng **inbox** theo `messageId`).

```sql
BEGIN TRAN;
INSERT dbo.Attempt (Id, UserId, StartedAt) VALUES (@Id, @UserId, SYSUTCDATETIME());
INSERT dbo.Outbox (Id, Type, Payload, CreatedAt)
VALUES (NEWID(), N'lms.attempt.started', @PayloadJson, SYSUTCDATETIME());
COMMIT;

-- Relay: nhiều instance chạy song song không lấy trùng dòng
SELECT TOP (100) Id, Type, Payload FROM dbo.Outbox WITH (UPDLOCK, READPAST, ROWLOCK)
WHERE SentAt IS NULL ORDER BY CreatedAt;
```

#### CDC
**Change Data Capture** đọc transaction log của DB và phát luồng thay đổi (insert, update, delete). SQL Server có CDC sẵn (`sys.sp_cdc_enable_db`, `sys.sp_cdc_enable_table`; capture job ghi vào bảng change); **Debezium** chạy trên Kafka Connect, chụp snapshot ban đầu rồi stream thay đổi vào Kafka. CDC có thể làm relay cho outbox thay cho polling. Rủi ro: capture dừng thì log không truncate được (`log_reuse_wait_desc = REPLICATION`) và đĩa đầy; đổi schema bảng nguồn cần quy trình riêng. Pipeline đầy đủ ở Bài 5.1.

#### Bằng chứng thật
- **CQRS:** IAS 2.0 tại AvePoint, read model cập nhật qua RabbitMQ (nguồn: D4.1).
- **Outbox ở Mastery** (nguồn: B5, B0): sự kiện `lms.attempt.started` theo CloudEvents 1.0, tối đa 5 lần thử, bật/tắt bằng cờ config. Nhưng dòng outbox được ghi ở **bước riêng sau khi** ghi attempt, không chung transaction, nên vẫn có khe hở "attempt đã ghi mà event mất". Chưa rõ ai viết. Chi tiết và cách sửa ở Bài 8.3.
- **Saga, CDC:** chưa có.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| CQRS | Tách mô hình ghi và đọc; read model cập nhật qua event nên trễ; projection phải idempotent. Dùng khi đọc và ghi lệch nhau nhiều. | AvePoint |
| Saga | Chuỗi transaction cục bộ có bù trừ; orchestration hoặc choreography; mỗi bước idempotent và có timeout. Chỉ cần khi nhiều bước ghi ở nhiều nơi. | Chưa có |
| Transactional outbox | Ghi nghiệp vụ và outbox chung transaction; relay publish sau, có thể trùng nên consumer dùng inbox. | Bảng outbox ở mastery chưa chung transaction (B5) |
| CDC (Debezium) | Đọc transaction log thành luồng thay đổi; dùng làm relay hoặc nạp kho phân tích; rủi ro log không truncate khi capture dừng. | Chưa có |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng outbox?"** Hệ Mastery có bảng outbox: sự kiện bắt đầu attempt theo CloudEvents 1.0, tối đa 5 lần thử, bật tắt bằng cờ. Nói thật: dòng outbox ghi ở bước sau attempt, không chung transaction, nên chưa phải transactional outbox đúng nghĩa. Cách sửa là đưa insert outbox vào cùng transaction với lần ghi attempt. Tôi không nhận là người viết phần đó.
- **"Kể một lần bạn dùng CQRS?"** IAS 2.0 tại AvePoint: phía ghi phát event qua RabbitMQ, projection cập nhật read model cho màn hình đọc. Đánh đổi là dữ liệu đọc trễ, và nếu thiếu outbox thì DB ghi thành công mà publish lỗi sẽ làm read model lệch.
- **"Kể một lần bạn dùng saga?"** Trả lời trung thực: tôi chưa triển khai saga thật. Ở attempt engine tôi cố ý không cần saga vì thiết kế chỉ có một lần ghi atomic. Nếu cần, ví dụ đăng ký khóa học có thanh toán, tôi dùng orchestration: giữ chỗ, thanh toán, xác nhận; thanh toán lỗi thì hủy giữ chỗ; mỗi bước idempotent và có timeout.
- **"Vì sao outbox phải chung transaction với dữ liệu nghiệp vụ?"** Để hai việc cùng thành công hoặc cùng thất bại. Ghi ở hai bước thì crash giữa chừng để lại dữ liệu đã ghi mà không có event, hoặc event mà dữ liệu đã rollback.
- **"Relay outbox chạy nhiều instance thì tránh publish trùng thế nào?"** Lấy dòng bằng `UPDLOCK, READPAST` để mỗi instance nhận lô khác nhau. Vẫn có trùng khi crash sau publish trước khi đánh dấu, nên consumer phải dedupe theo `messageId`.

#### Tóm tắt
- CQRS: tách ghi và đọc, read model trễ; không bắt buộc event sourcing.
- Saga: transaction cục bộ cộng bù trừ; chỉ cần khi nhiều bước ghi ở nhiều nơi.
- Outbox phải chung transaction; relay có thể trùng nên consumer cần inbox.
- CDC đọc log; rủi ro lớn nhất là log không truncate khi capture dừng.
- Outbox ở Mastery chưa chung transaction; saga và CDC chưa có bằng chứng.

#### Bài tập
1. Viết relay outbox bằng C# dùng `SELECT TOP (100) ... WITH (UPDLOCK, READPAST, ROWLOCK)` trong transaction, publish lên Kafka, cập nhật `SentAt`. Chạy 2 instance song song.
   **Đáp án:** Hai instance nhận hai lô khác nhau. Kill một instance sau khi publish nhưng trước khi commit: dòng đó được publish lại, chứng minh consumer cần dedupe.
2. Vẽ saga orchestration cho "đăng ký khóa học có thanh toán": các bước, event, hành động bù trừ và timeout.
   **Đáp án:** ReserveSeat → ChargePayment → ConfirmEnrollment. ChargePayment lỗi hoặc quá 15 phút thì ReleaseSeat. Confirm lỗi thì RefundPayment rồi ReleaseSeat. Mỗi command mang `sagaId` để idempotent.
3. Trên SQL Server dev, bật CDC cho một bảng, sửa vài dòng, đọc bằng `cdc.fn_cdc_get_all_changes_<capture_instance>`, rồi dừng job capture và xem `log_reuse_wait_desc`.
   **Đáp án:** Thấy các dòng thay đổi với `__$operation` (1 xóa, 2 thêm, 3 và 4 trước và sau update). Khi capture dừng và có giao dịch mới, `log_reuse_wait_desc` thành `REPLICATION`.

### Bài 12.4. Idempotency và eventual consistency

#### Mục tiêu
- Sau bài này, bạn định nghĩa chính xác idempotency và vì sao "exactly-once delivery" không tồn tại giữa các hệ thống.
- Liệt kê và chọn được các cách làm idempotent: unique constraint, idempotency key, applock, inbox, thao tác tuyệt đối.
- Giải thích eventual consistency, các mô hình nhất quán và cách giao diện xử lý dữ liệu trễ.
- Kể đúng các bằng chứng thật và lớp có sẵn.

#### Idempotency
Thao tác idempotent là thao tác thực hiện nhiều lần cho cùng kết quả như một lần. Giữa các hệ thống qua mạng, message có thể mất hoặc lặp; thực tế là **at-least-once cộng xử lý idempotent**, cho ra *effectively-once*.

Các cách làm, từ mạnh tới yếu:
- **Unique constraint** trên khóa nghiệp vụ (user, vòng): hàng rào mạnh nhất, DB tự chặn.
- **Idempotency key:** client sinh key cho mỗi thao tác. Server lưu `(key → trạng thái, kết quả)` có TTL; gặp key đã xong thì trả lại kết quả cũ.
- **Khóa theo key nghiệp vụ:** applock hoặc `UPDLOCK, HOLDLOCK` rồi check-then-insert (Bài 11.2).
- **Inbox:** bảng lưu `messageId` đã xử lý, insert cùng transaction với tác dụng nghiệp vụ.
- **Thao tác tuyệt đối thay vì tương đối:** `ZADD` điểm tuyệt đối thay vì `ZINCRBY`; `SET status = 'paid'` thay vì cộng dồn.

Hai request cùng idempotency key đến **song song**: request đầu insert key ở trạng thái "đang xử lý" với ràng buộc unique; request sau thấy key đang xử lý thì trả `409` hoặc chờ rồi đọc kết quả. Thiếu bước này, hai request cùng không thấy key và cùng xử lý.

```csharp
app.MapPost("/attempts/{id:guid}/submit", async (Guid id, [FromHeader(Name = "Idempotency-Key")] string key,
    IIdempotencyStore store, ISubmitService svc, CancellationToken ct) =>
{
    var claim = await store.TryClaimAsync(key, TimeSpan.FromHours(24), ct);   // insert "processing", unique
    if (claim.State == ClaimState.Completed) return Results.Ok(claim.Response); // lặp lại: trả kết quả cũ
    if (claim.State == ClaimState.InProgress) return Results.Conflict();        // đang xử lý song song
    var result = await svc.SubmitAsync(id, ct);
    await store.CompleteAsync(key, result, ct);
    return Results.Ok(result);
});
```

#### Eventual consistency
Các bản sao dữ liệu khớp nhau sau một khoảng trễ nếu không có cập nhật mới. Các mô hình hay gặp: **strong** (đọc luôn thấy ghi mới nhất), **read-your-writes** (ít nhất thấy ghi của chính mình), **monotonic reads** (không đọc lùi về bản cũ hơn), **eventual**.

Giao diện phải xử lý trạng thái trung gian: hiện "đang xử lý" thay vì hứa kết quả ngay; sau khi user ghi thì đọc từ nguồn chính hoặc cập nhật lạc quan phía client; ghi rõ "dữ liệu cập nhật lúc 10:00". Đo độ trễ bằng timestamp ở cả hai đầu; có job đối soát định kỳ để bắt lệch.

#### Bằng chứng: của bạn và có sẵn
- **Của bạn:** ghi kết quả một lần bằng applock ở Here I Come (nguồn: mục 6, Bài 4.1).
- **Có sẵn** (nguồn: B3, B5, mục 0 #8): Redis mutex theo (user, activity) giữ 30 s và idempotency key 24 giờ cho start, answer, submit do đồng nghiệp viết; Lua CAS một phiên thi mỗi user.
- **Eventual consistency** (nguồn: mục 7): warehouse báo cáo B2B tổng hợp bằng SQL Agent job mỗi 60 phút, dữ liệu trễ tối đa khoảng 1 giờ, nghiệp vụ chấp nhận cho dashboard quản lý. Phần C# (scope dữ liệu theo token, proxy) là của bạn; phần SQL bị gitignore nên git không chứng minh được ai viết. Production mới có một Sở đối tác.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| Idempotency | Cùng request lặp lại cho cùng kết quả: unique key, idempotency key có trạng thái "đang xử lý", applock, inbox. At-least-once cộng idempotent là effectively-once. | Mục 6, B3, B5 |
| Eventual consistency | Dữ liệu các nơi khớp nhau sau một khoảng trễ; giao diện phải xử lý trạng thái trung gian; đo độ trễ và có đối soát. | Warehouse trễ ~1 giờ (mục 7) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn làm một thao tác idempotent?"** Sự kiện Here I Come: kết quả mỗi chặng chỉ được ghi một lần cho mỗi (user, vòng). Tôi dùng `sp_getapplock` theo key đó cộng `UPDLOCK, HOLDLOCK`; request retry nhận về bản ghi đã có. Tôi gọi đúng tên là idempotent write, không phải exactly-once delivery. Lớp idempotency key 24 giờ ở Mastery là lớp có sẵn do đồng nghiệp viết.
- **"Exactly-once có tồn tại không?"** Exactly-once delivery giữa các hệ thống qua mạng thì không. Cái đạt được là at-least-once cộng xử lý idempotent, tức tác dụng nghiệp vụ xảy ra đúng một lần.
- **"Hai request cùng idempotency key đến song song thì xử lý thế nào?"** Request đầu chiếm key bằng insert trạng thái "đang xử lý" có ràng buộc unique (hoặc `SET NX`). Request sau thấy đang xử lý thì trả `409` hoặc chờ có giới hạn rồi đọc kết quả. Key gắn với hash của body để chặn dùng lại key cho request khác.
- **"Kể một lần bạn gặp eventual consistency?"** Warehouse báo cáo B2B chạy job tổng hợp mỗi giờ, dashboard trễ tối đa khoảng 1 giờ và nghiệp vụ chấp nhận cho báo cáo quản lý. Tôi làm phần API C#: phạm vi dữ liệu theo token, cache Redis 10 phút cộng memory 60 giây. Quy mô production hiện mới một Sở đối tác.
- **"Làm sao để người dùng không bối rối với dữ liệu trễ?"** Hiển thị thời điểm cập nhật, trạng thái "đang xử lý", đọc từ nguồn chính ngay sau thao tác của chính họ, và không hiển thị số tổng hợp như số realtime.

#### Tóm tắt
- Idempotent: làm nhiều lần như một lần; unique constraint là hàng rào mạnh nhất.
- Idempotency key cần trạng thái "đang xử lý" để chặn request song song.
- Không có exactly-once delivery; có at-least-once cộng idempotent.
- Eventual consistency phải được thiết kế ở cả giao diện và đo lường.

#### Bài tập
1. Viết endpoint submit có header `Idempotency-Key`, lưu key trong SQL Server với unique constraint và trạng thái. Bắn 5 request cùng key song song bằng k6 hoặc `Parallel.ForEachAsync`.
   **Đáp án:** Một request xử lý, các request còn lại nhận `409` hoặc kết quả cũ; bảng nghiệp vụ chỉ có 1 bản ghi.
2. Viết consumer với bảng inbox: insert `messageId` và tác dụng nghiệp vụ trong cùng transaction, gửi lại cùng message 3 lần.
   **Đáp án:** Lần 2 và 3 vi phạm unique trên `messageId`, bắt lỗi 2627 và coi là đã xử lý, ack message.
3. Thiết kế màn hình kết quả thi khi việc chấm chạy bất đồng bộ mất 5–60 giây.
   **Đáp án:** Sau khi nộp hiển thị "đã nộp, đang chấm" kèm thời điểm nộp; client poll hoặc nhận push; quá 2 phút thì hiển thị "chấm chậm hơn dự kiến" và không cho nộp lại.

## Chương 13. Resilience, bảo mật, test, vận hành và quan sát

Chương này gom các keyword "xung quanh code": làm service chịu lỗi (retry, circuit breaker, rate limit, gateway), bảo mật (OAuth, OIDC, JWT, OWASP), test (xUnit, Testcontainers, TDD, k6), vận hành (Docker, Kubernetes, Helm, Terraform, Argo CD, CI) và quan sát (OpenTelemetry, Prometheus, Grafana, Elastic APM, SLO). Nhiều chủ đề đã có bài sâu ở Phần II và III; các bài ở đây là nền tảng và câu nói ngắn, kèm trỏ sang bài sâu.

Đây là chương có nhiều keyword "Chưa có" hoặc ô bằng chứng trống nhất. Mục tiêu là nói chắc kiến thức theo best practice, và không để một keyword vận hành làm lộ việc bạn chưa làm.

### Bài 13.1. Resilience, rate limiting và API gateway YARP

#### Mục tiêu
- Sau bài này, bạn giải thích được timeout, retry có backoff và jitter, circuit breaker, bulkhead và thứ tự của chúng.
- Thiết kế được rate limiter theo user, phân biệt giới hạn trong từng pod với giới hạn toàn cục.
- Trình bày được vai trò của API gateway và cấu hình YARP cơ bản.
- Nói nhất quán với quyết định thật "không đặt deadline cho gRPC event".

#### Các pattern resilience
- **Timeout:** mọi lời gọi đồng bộ ra ngoài phải có hạn. Có hai mức: timeout mỗi lần thử và timeout tổng.
- **Retry:** chỉ cho thao tác idempotent hoặc có idempotency key; **exponential backoff cộng jitter** để các client không retry cùng lúc (retry storm); giới hạn số lần.
- **Circuit breaker:** đóng (bình thường) → mở khi tỉ lệ lỗi vượt ngưỡng trong cửa sổ lấy mẫu với lưu lượng tối thiểu (từ chối ngay, không gọi) → half-open sau thời gian nghỉ (cho vài lời gọi thử).
- **Bulkhead:** giới hạn số lời gọi đồng thời cho từng dependency để một dependency chậm không ăn hết thread và connection.
- **Fallback, degrade:** trả dữ liệu cache, tắt tính năng phụ (feed, ruby) để luồng chính sống.

.NET 8 trở lên có gói `Microsoft.Extensions.Http.Resilience` xây trên Polly v8:

```csharp
builder.Services.AddHttpClient<IScoringClient, ScoringClient>()
    .AddStandardResilienceHandler(o =>
    {
        o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(2);
        o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(10);
        o.Retry.MaxRetryAttempts = 3;   // backoff mũ có jitter là mặc định
    });
```

Pipeline chuẩn từ ngoài vào trong: rate limiter → total timeout → retry → circuit breaker → attempt timeout.

#### Rate limiting
Thuật toán: **fixed window** (đơn giản, dồn tải ở mép cửa sổ), **sliding window** (mượt hơn), **token bucket** (cho phép burst trong giới hạn), **concurrency** (giới hạn số request đang chạy). ASP.NET Core có middleware sẵn:

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("per-user", ctx => RateLimitPartition.GetTokenBucketLimiter(
        ctx.User.FindFirst("sub")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 20, TokensPerPeriod = 10, ReplenishmentPeriod = TimeSpan.FromSeconds(1)
        }));
});
app.UseRateLimiter();
```

Bộ đếm của middleware nằm **trong bộ nhớ từng pod**: 10 pod thì giới hạn thực tế gấp khoảng 10 lần. Giới hạn toàn cục cần bộ đếm chung, thường là token bucket hoặc sliding window bằng Lua trên Redis.

#### API gateway và YARP
Gateway là điểm vào chung: định tuyến, xác thực, rate limit, biến đổi header và path, gom log. **YARP** là thư viện reverse proxy của Microsoft chạy trong ASP.NET Core, cấu hình bằng route (khớp request) và cluster (đích, load balancing, health check). Gắn policy cho route qua `RateLimiterPolicy`, `AuthorizationPolicy` trong cấu hình.

```json
{
  "ReverseProxy": {
    "Routes": {
      "identity": { "ClusterId": "idp", "Match": { "Path": "/connect/{**rest}" }, "RateLimiterPolicy": "per-user" }
    },
    "Clusters": {
      "idp": { "Destinations": { "d1": { "Address": "http://identity:8080/" } } }
    }
  }
}
```

#### High availability và scalability
Không có điểm hỏng đơn: nhiều pod cho service stateless, trạng thái đưa ra ngoài (Redis, DB); dữ liệu có replication và failover; trải pod qua nhiều node hoặc zone; `PodDisruptionBudget` để bảo trì không tắt hết pod. HA của SQL Server xem Bài 2.2; Polly và YARP trong câu chuyện CV xem Bài 4.2.

> **Cảnh báo:** Bạn cố ý không đặt deadline cho gRPC gửi event (Bài 9.2). Nói nhất quán: timeout áp cho lời gọi đồng bộ trên đường request; event chạy nền tách khỏi request thì deadline chỉ làm rơi event, cách đúng hơn là hàng đợi bền.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| Polly, circuit breaker, retry | Timeout cho mọi lời gọi đồng bộ; retry chỉ cho thao tác idempotent, backoff mũ cộng jitter; circuit breaker mở khi tỉ lệ lỗi vượt ngưỡng, half-open để thử lại; .NET 8 dùng `AddStandardResilienceHandler`. | Chưa có |
| Rate limiting | Token bucket, fixed và sliding window; theo user hay IP; giới hạn trong từng pod hay toàn cục (Redis). | Rate limiter cho API đọc (B5) |
| API gateway (YARP) | Định tuyến, auth, rate limit, chuyển đổi request ở một điểm vào; YARP cấu hình bằng route và cluster. | BFF dùng YARP (B6) |
| High availability, scalability | Không có điểm hỏng đơn; scale ngang service stateless; dữ liệu cần replication và failover. | Nhiều pod, Redis Cluster |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng YARP?"** BFF identity của nền tảng dùng YARP proxy tới identity server và user service. Lõi BFF có sẵn khi tôi vào; tôi làm phần hardening: CORS allow-list theo config, chuyển các endpoint token sang POST, feature flag cho Turnstile. Cấu hình route và cluster thì tôi đọc và giải thích được.
- **"Kể một lần bạn dùng Polly hoặc circuit breaker?"** Trả lời trung thực: tôi chưa có bằng chứng triển khai Polly trên production. Quyết định gần nhất tôi đã làm là ngược lại: không đặt deadline cho gRPC event vì service nhận có lúc chậm 3,6 s và event đã tách khỏi request. Nếu làm cho lời gọi đồng bộ, tôi dùng `AddStandardResilienceHandler` với attempt timeout, retry có jitter chỉ cho thao tác idempotent, và circuit breaker.
- **"Thiết kế rate limiter 1.000 request/phút mỗi user trên 10 pod?"** Middleware trong bộ nhớ không đủ vì mỗi pod đếm riêng. Dùng sliding window hoặc token bucket trên Redis bằng Lua (nguyên tử), key theo user, TTL bằng cửa sổ; Redis lỗi thì fallback về giới hạn cục bộ mỗi pod bằng 1/10 hạn mức. Trả `429` kèm `Retry-After`.
- **"Vì sao retry cần jitter?"** Không có jitter, mọi client lỗi cùng lúc sẽ retry cùng lúc, tạo đợt tải dồn đúng khi dependency đang yếu. Jitter rải các lần thử ra theo thời gian.
- **"Service A gọi B, B chậm. A nên làm gì?"** Timeout ngắn theo SLO của A, retry giới hạn có jitter nếu idempotent, circuit breaker để ngừng gọi khi B hỏng, bulkhead để B không ăn hết tài nguyên của A, và fallback hoặc degrade. Nếu không cần kết quả ngay thì chuyển sang bất đồng bộ.

#### Tóm tắt
- Timeout cho mọi lời gọi đồng bộ; retry chỉ khi idempotent, có backoff và jitter.
- Circuit breaker: đóng, mở, half-open; bulkhead cô lập dependency.
- Rate limit middleware chỉ trong từng pod; toàn cục cần Redis.
- YARP: route khớp request, cluster là đích; gắn policy theo route.

#### Bài tập
1. Tạo service B trả lỗi 50% và chậm ngẫu nhiên. Ở service A gắn `AddStandardResilienceHandler`, bắn tải và xem log retry và trạng thái circuit.
   **Đáp án:** Thấy retry với khoảng chờ tăng dần không đều (jitter); khi tỉ lệ lỗi vượt ngưỡng, circuit mở và lời gọi bị từ chối ngay với `BrokenCircuitException`.
2. Viết sliding window rate limiter bằng sorted set trên Redis (Lua): `ZREMRANGEBYSCORE` bỏ phần cũ, `ZCARD` đếm, `ZADD` nếu còn hạn mức.
   **Đáp án:** Key `rl:{userId}`, score là timestamp mili-giây, member là id duy nhất; script trả 1 nếu cho qua, 0 nếu chặn; đặt `PEXPIRE` bằng độ dài cửa sổ.
3. Dựng YARP proxy tới hai bản của một API, bật health check chủ động, tắt một bản và quan sát.
   **Đáp án:** Bật `HealthCheck.Active` cho cluster; sau vài chu kỳ kiểm tra, destination hỏng bị loại khỏi load balancing, request chỉ đi vào bản còn sống.

### Bài 13.2. OAuth 2.0, OIDC, JWT và OWASP

#### Mục tiêu
- Sau bài này, bạn phân biệt được OAuth 2.0 và OIDC, access token và id token, các flow chính.
- Giải thích được vì sao SPA dùng PKCE, vì sao BFF an toàn hơn SPA giữ token, và cách kiểm tra JWT đúng.
- Nêu được các nhóm lỗi OWASP Top 10 hay gặp ở backend.
- Biết bài nào đi sâu: Bài 5.2 (SSO) và Bài 7.6 (OWASP).

#### OAuth 2.0 và OIDC
**OAuth 2.0** là khung **ủy quyền**: client nhận access token để gọi API thay mặt user. **OIDC** thêm lớp **xác thực** trên OAuth: id token (JWT) cho biết user là ai, endpoint userinfo, discovery (`/.well-known/openid-configuration`).

- **Authorization code + PKCE:** cho mọi client có người dùng. Client sinh `code_verifier` ngẫu nhiên, gửi `code_challenge = BASE64URL(SHA256(code_verifier))`; lúc đổi code lấy token phải gửi lại `code_verifier`. Kẻ chặn được code cũng không đổi được token.
- **Client credentials:** service gọi service, không có user.
- Implicit và password grant đã bị loại trong OAuth 2.1 và best current practice.
- **Access token** dành cho API (resource server kiểm tra); **id token** dành cho client, không gửi lên API.

#### JWT và BFF
JWT gồm header, payload, chữ ký. Kiểm tra đúng: chữ ký theo khóa lấy từ JWKS (chọn theo `kid`, hỗ trợ xoay khóa); `iss`, `aud`, `exp`, `nbf` với độ lệch giờ nhỏ; **cố định thuật toán** để chặn `alg: none` và nhầm RS256 với HS256. JWT tự chứa nên khó thu hồi: access token ngắn hạn (5–15 phút), refresh token xoay vòng, phát hiện token cũ bị dùng lại thì thu hồi cả chuỗi.

```csharp
builder.Services.AddAuthentication().AddJwtBearer(o =>
{
    o.Authority = "https://id.example.com";
    o.Audience = "exam-api";
    o.TokenValidationParameters.ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 };
    o.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(30);
});
```

**BFF:** token nằm ở server; trình duyệt chỉ giữ cookie `HttpOnly`, `SameSite=Lax`, nên XSS không đọc được token. Đổi lại phải chống CSRF (antiforgery) và chia sẻ data protection key giữa các pod.

#### OWASP Top 10
Bản 2025: A01 Broken Access Control (đã gộp SSRF), A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Logging & Alerting Failures, A10 Mishandling of Exceptional Conditions. Với API, lỗi số một thực tế là **IDOR/BOLA**: kiểm tra quyền theo từng resource (`attempt.UserId == currentUser`), không chỉ theo role. Chi tiết ở Bài 7.6.

#### Bằng chứng thật
Phần của bạn trong SSO (nguồn: mục 10, B6): hardening BFF (CORS allow-list theo config, cookie remember, endpoint token chuyển sang POST, feature flag Turnstile), SSO stateless cho IOSTEM (PKCE sinh trong trình duyệt, token trong `sessionStorage`, `BroadcastChannel` đồng bộ tab), silent SSO cho IOE web bằng redirect cả trang. Lõi PKCE và ticket store có sẵn. Điểm yếu tự nhận: config CORS đang để `"*"`; private key RSA của tích hợp CRM nằm trong file config. Khi nâng .NET 10, bạn bỏ gói Elastic APM all-in-one để loại một dependency có lỗ hổng (cảnh báo NU1903, nguồn: mục 11). Chi tiết ở Bài 5.2.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| OAuth 2.0, OIDC, PKCE, JWT, BFF | OAuth ủy quyền, OIDC thêm xác thực qua id token. Code flow cộng PKCE cho client có người dùng; JWT kiểm chữ ký qua JWKS, `iss`, `aud`, `exp`, cố định thuật toán; BFF giữ token ở server, trình duyệt chỉ có cookie `HttpOnly`. | Mục 10, B6 |
| OWASP Top 10 | Access control đứng đầu, IDOR là lỗi hay gặp nhất ở API; misconfiguration, chuỗi cung ứng, injection; sửa theo mức độ rồi nhờ kiểm tra lại. | |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn làm việc với OAuth hoặc OIDC?"** Lõi BFF identity (PKCE, ticket store trên Redis) có sẵn khi tôi vào. Tôi làm hardening BFF và đưa IOE web, IOSTEM vào SSO: IOSTEM sinh PKCE trong trình duyệt, token trong `sessionStorage`, `BroadcastChannel` đồng bộ đăng nhập giữa tab; IOE web silent SSO bằng redirect cả trang với `skip_login` vì cookie bên thứ ba bị chặn, có cooldown 5 giây sau logout và cờ chống vòng lặp.
- **"Kể một lần bạn sửa một vấn đề bảo mật?"** Tôi chuyển các endpoint status, verify-token, token sang POST để token không nằm trong URL và log. Khi nâng .NET 10, tôi bỏ gói Elastic APM all-in-one, chỉ dùng subscriber HTTP và gRPC để loại dependency có lỗ hổng. Tôi cũng tự nhận các điểm còn yếu: CORS config đang `"*"`, private key trong config cần chuyển sang secret store.
- **"Id token và access token khác nhau thế nào?"** Id token cho client biết user là ai, có `aud` là client. Access token để gọi API, có `aud` là API. Gửi id token lên API là dùng sai.
- **"Vì sao SPA phải dùng PKCE?"** SPA là public client, không giữ được secret. PKCE ràng buộc code với `code_verifier` chỉ client đó biết, nên code bị chặn cũng vô dụng.
- **"JWT khó thu hồi, xử lý thế nào?"** Access token ngắn hạn; refresh token xoay vòng và phát hiện dùng lại; cần thu hồi tức thì thì dùng session phía server (BFF với ticket trên Redis) hoặc danh sách thu hồi theo `jti` cho thao tác nhạy cảm.

#### Tóm tắt
- OAuth là ủy quyền, OIDC thêm xác thực.
- Code flow cộng PKCE cho mọi client có người dùng; client credentials cho service.
- Kiểm JWT: chữ ký qua JWKS, `iss`, `aud`, `exp`, cố định thuật toán.
- IDOR là lỗi API hay gặp nhất; kiểm quyền theo resource.

#### Bài tập
1. Chạy Keycloak bằng Docker, tạo client public, viết một trang HTML thực hiện code flow cộng PKCE và in id token đã giải mã.
   **Đáp án:** Sinh `code_verifier` bằng `crypto.getRandomValues`, băm SHA-256 bằng `crypto.subtle.digest`, mã hóa base64url; đổi code tại token endpoint kèm `code_verifier`.
2. Viết API ASP.NET Core có endpoint `GET /attempts/{id}`, chỉ kiểm role "student". Chứng minh lỗi IDOR rồi sửa.
   **Đáp án:** User A đọc được attempt của user B bằng cách đổi id. Sửa: lọc `WHERE Id = @id AND UserId = @currentUser` hoặc resource-based authorization; trả `404` để không lộ sự tồn tại.
3. Tạo một JWT có `alg: none` và một JWT ký HS256 bằng public key, gửi vào API đã cấu hình `ValidAlgorithms` chỉ RS256.
   **Đáp án:** Cả hai bị từ chối `401`. Bỏ `ValidAlgorithms` để thấy vì sao phải cố định thuật toán (thư viện hiện đại đã chặn `none`, nhưng cấu hình tường minh vẫn là best practice).

### Bài 13.3. Test: xUnit, Testcontainers, TDD và k6

#### Mục tiêu
- Sau bài này, bạn trình bày được kim tự tháp test và chọn loại test cho từng phần của hệ thống.
- Viết được fixture xUnit dùng Testcontainers cho SQL Server và Redis.
- Giải thích TDD và khi nào không nên ép TDD.
- Thiết kế được một load test k6 có threshold, phân biệt mô hình open và closed.

#### Kim tự tháp và xUnit
- **Unit test:** logic thuần (planner, selector, tính quota), nhanh, nhiều.
- **Integration test:** code cộng DB, Redis, Kafka thật. Ít hơn, chậm hơn, bắt được lỗi mà mock không thấy (SQL sai, lock, serialization).
- **Contract test** cho API giữa các team; **end-to-end** rất ít.

xUnit: `[Fact]` cho một trường hợp, `[Theory]` cộng `[InlineData]` cho bảng trường hợp. Fixture: `IClassFixture<T>` dùng chung trong một class, `ICollectionFixture<T>` dùng chung giữa nhiều class; `IAsyncLifetime` cho khởi tạo bất đồng bộ. Các collection chạy song song, test trong một collection chạy tuần tự. xUnit v3 cho test project là file chạy được và có `TestContext.Current.CancellationToken`.

#### Testcontainers
Khởi động container thật cho mỗi lần chạy test, nên test chạy trên SQL Server và Redis thật thay vì mock hoặc provider InMemory (InMemory không có transaction, lock hay stored procedure).

```csharp
public sealed class DbFixture : IAsyncLifetime
{
    public MsSqlContainer Sql { get; } = new MsSqlBuilder().Build();
    public RedisContainer Redis { get; } = new RedisBuilder().Build();

    public async Task InitializeAsync()
    {
        await Task.WhenAll(Sql.StartAsync(), Redis.StartAsync());
        // chạy script schema và stored procedure theo thứ tự đánh số
    }
    public async Task DisposeAsync() { await Sql.DisposeAsync(); await Redis.DisposeAsync(); }
}

[CollectionDefinition("db")] public sealed class DbCollection : ICollectionFixture<DbFixture> { }

[Collection("db")]
public sealed class SubmitTests(DbFixture db)
{
    [Fact]
    public async Task Submit_twice_creates_one_result() { /* gọi proc hai lần, đếm dòng = 1 */ }
}
```

Dùng Respawn để xóa dữ liệu giữa các test. Chống test flaky: mỗi test tự tạo dữ liệu riêng, dùng `TimeProvider` (.NET 8) và `FakeTimeProvider` thay cho giờ thật, chờ theo điều kiện thay vì `Thread.Sleep`.

#### TDD
Red (viết test fail) → green (code tối thiểu cho qua) → refactor. Hợp với logic thuần có nhiều trường hợp biên: viết bảng `[Theory]` trước rồi mới code. Không nên ép cho code nối dây, giao diện, hay code thăm dò khi chưa rõ yêu cầu.

#### k6
- **Executor:** `ramping-vus`, `constant-vus` là mô hình **closed** (số user cố định; hệ chậm thì tải tự giảm, che giấu vấn đề). `constant-arrival-rate`, `ramping-arrival-rate` là mô hình **open** (request đến theo tốc độ đặt trước bất kể hệ chậm), đúng với lưu lượng thật hơn và tránh coordinated omission.
- **Threshold** làm test tự fail để dùng làm gate trong CI.
- k6 không giả lập được media WebRTC; signaling qua WebSocket thì test được.

```javascript
import http from 'k6/http';
export const options = {
  scenarios: { start_exam: { executor: 'ramping-arrival-rate', startRate: 50, timeUnit: '1s',
    preAllocatedVUs: 200, stages: [{ target: 1700, duration: '2m' }, { target: 1700, duration: '3m' }] } },
  thresholds: { http_req_duration: ['p(95)<300'], http_req_failed: ['rate<0.01'] },
};
export default function () { http.post(`${__ENV.BASE}/exam/start`, JSON.stringify({ roundId: 1 }),
  { headers: { 'Content-Type': 'application/json' } }); }
```

> **Ghi nhớ:** Thực tế hiện có là integration harness chạy trên SQL fixture cho logic sự kiện và ma trận đề; phần còn lại test tay trên dev; unit test của codebase cũ ít (nguồn: mục 12). Merge gate bằng Testcontainers là minh họa (Bài 4.3); k6 trước release là minh họa (Bài 7.4).

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| xUnit, Testcontainers, TDD | Unit test cho logic thuần, integration test trên DB và Redis thật bằng Testcontainers, fixture dùng chung theo collection; TDD cho logic có nhiều trường hợp biên, không ép cho code nối dây. | Harness SQL fixture (mục 12) |
| k6 | Mô hình open (`arrival-rate`) cho tải thật, threshold p95 và tỉ lệ lỗi làm gate; không giả lập được media WebRTC. | |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn viết test tự động?"** Có integration harness chạy trên SQL fixture cho logic sự kiện và ma trận đề. Nói thật là phần lớn còn lại kiểm thử tay trên dev và unit test của codebase cũ ít. Hướng tôi muốn làm là test procedure bằng container SQL Server và contract test cho API.
- **"Kể một lần bạn dùng k6?"** Trả lời trung thực: tôi chưa có lần chạy k6 nào có số liệu để kể. Nếu làm cho API bắt đầu thi, tôi dùng `ramping-arrival-rate` lên khoảng 1.700 request/s trong 2 phút như đầu ca thi, threshold p95 và tỉ lệ lỗi, chạy trên staging và so với lần trước.
- **"Vì sao dùng Testcontainers thay vì mock DB hoặc provider InMemory?"** Mock và InMemory không có transaction, lock, stored procedure, collation hay hành vi SQL thật, nên test xanh mà production vẫn lỗi. Container SQL Server thật bắt được các lỗi đó; đổi lại test chậm hơn, nên giữ số lượng vừa phải và dùng chung container theo collection.
- **"Test flaky vì thời gian xử lý thế nào?"** Inject `TimeProvider` và dùng `FakeTimeProvider` trong test; không gọi `DateTime.UtcNow` trực tiếp; chờ theo điều kiện có timeout thay vì sleep cố định.
- **"Mô hình open và closed trong load test khác nhau thế nào?"** Closed giữ số user cố định, mỗi user chờ phản hồi rồi mới gửi tiếp, nên hệ chậm thì tải giảm theo và số đo đẹp giả. Open đặt tốc độ đến cố định như traffic thật, lộ ra hàng đợi khi hệ quá tải.

#### Tóm tắt
- Unit cho logic thuần, integration trên hạ tầng thật, ít end-to-end.
- Testcontainers cộng `ICollectionFixture` cộng Respawn là bộ ba hay dùng.
- TDD cho logic nhiều trường hợp biên; dùng `TimeProvider` để test không phụ thuộc giờ.
- k6: mô hình open, threshold làm gate; không test được media WebRTC.

#### Bài tập
1. Viết fixture Testcontainers cho SQL Server, tạo bảng và proc ghi kết quả có applock, viết test gọi proc song song 10 lần cùng (user, vòng).
   **Đáp án:** Dùng `Task.WhenAll` 10 lời gọi, mỗi lời gọi một connection; assert bảng chỉ có 1 dòng. Bỏ applock để thấy test đỏ.
2. Viết hàm tính cooldown làm lại bài bằng TDD: bắt đầu bằng bảng `[Theory]` 6 trường hợp (chưa làm, vừa làm, đúng mốc, quá mốc, khác ngày, quota ngày đã hết).
   **Đáp án:** Hàm nhận `TimeProvider` hoặc `now`, trả `(bool allowed, TimeSpan? wait)`; viết test trước, chạy đỏ, code đủ cho xanh, rồi refactor.
3. Chạy script k6 ở trên vào một API mẫu chậm 100 ms, rồi đổi executor sang `constant-vus` với 50 VU, so số request/s và p95.
   **Đáp án:** Với `constant-vus`, khi API chậm thì request/s tự giảm và p95 trông ổn; với `arrival-rate`, k6 báo thiếu VU hoặc p95 tăng vọt, đúng với tình trạng quá tải.

### Bài 13.4. Docker, Kubernetes, Helm, Terraform, Argo CD và CI

#### Mục tiêu
- Sau bài này, bạn viết được Dockerfile nhiều tầng cho service .NET 10 và giải thích từng tầng.
- Giải thích được Deployment, Service, probe, resource, HPA và graceful shutdown.
- Phân biệt vai trò của Helm, Terraform, Argo CD và CI trong một luồng GitOps.
- Nói đúng phạm vi: không viết manifest IOE, Jenkins shared library là thật, Azure chưa xác nhận.

#### Docker
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY *.csproj ./
RUN dotnet restore                       # tầng restore được cache khi csproj không đổi
COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
USER $APP_UID                            # image .NET 8+ có sẵn user không phải root
EXPOSE 8080                              # cổng mặc định từ .NET 8
ENTRYPOINT ["dotnet", "Exam.Api.dll"]
```

Nhiều tầng giúp image chạy không chứa SDK, nhỏ và ít bề mặt tấn công. Image chiseled (Ubuntu tối giản) nhỏ hơn nữa.

#### Kubernetes
- **Deployment** quản lý ReplicaSet và rolling update; **Service** cho địa chỉ ổn định và cân bằng tải; **Ingress** đưa traffic từ ngoài vào; **ConfigMap, Secret** cho cấu hình.
- **Probe:** readiness quyết định pod có nhận traffic không (DB chưa sẵn thì chưa ready); liveness quyết định có restart pod không (chỉ kiểm tra process còn sống, **không** kiểm tra dependency, nếu không DB chậm sẽ làm mọi pod bị restart); startup probe cho app khởi động lâu.
- **Graceful shutdown:** Kubernetes gửi `SIGTERM`, app ngừng nhận request mới và xử lý nốt trong `HostOptions.ShutdownTimeout`; thêm `preStop` sleep ngắn để endpoint kịp bị gỡ khỏi Service.
- **Resource:** request để lập lịch, limit để chặn trên. CPU limit gây throttling (CFS) nên p99 có thể tăng dù CPU trung bình thấp.
- **HPA** scale theo CPU hoặc metric tùy chỉnh; **KEDA** scale theo consumer lag của Kafka.

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddSqlServer(cfg.GetConnectionString("Main")!, tags: ["ready"]);   // gói AspNetCore.HealthChecks.SqlServer
app.MapHealthChecks("/healthz/live", new() { Predicate = r => r.Tags.Contains("live") });
app.MapHealthChecks("/healthz/ready", new() { Predicate = r => r.Tags.Contains("ready") });
```

#### Helm, Terraform, Argo CD, CI
- **Helm:** đóng gói manifest thành chart có template; `values.yaml` khác nhau theo môi trường; `helm upgrade --install`, `helm rollback`.
- **Terraform:** khai báo hạ tầng (cluster, mạng, registry); `plan` xem thay đổi trước khi `apply`; **state** lưu remote có khóa để hai người không apply cùng lúc; drift là khi hạ tầng thật lệch khỏi code. OpenTofu là nhánh mã nguồn mở tách ra sau khi Terraform đổi license.
- **CI** (GitLab CI, Jenkins): build, test, quét dependency, build image, đẩy registry. Jenkins shared library cho phép mọi repo dùng chung một pipeline.
- **Argo CD (GitOps):** cluster tự kéo trạng thái mong muốn từ repo cấu hình. CI chỉ cập nhật image tag trong values; Argo CD thấy Git đổi thì sync. Rollback bằng `git revert`. Chi tiết ở Bài 7.5.
- **AKS:** Kubernetes được Azure quản lý control plane; node pool; tích hợp registry (ACR) và identity.

> **Ghi nhớ:** Ở IOE, có manifest deploy và Redis cluster trong Kubernetes, nhưng bạn không viết manifest; mọi repo dùng chung một Jenkins shared library (nguồn: mục 14, B1). Ở Examena, chuỗi Docker, Helm, Terraform, GitLab CI, Argo CD là thật; Azure (AKS) chưa xác nhận là cloud thật (nguồn: D3.5).

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| Azure (AKS) | Cluster Kubernetes được quản lý; node pool; tích hợp registry và identity. | Phải xác nhận cloud thật |
| Docker, Kubernetes, Helm | Image nhiều tầng, chạy non-root; Deployment, Service, HPA; readiness khác liveness; graceful shutdown qua `SIGTERM`; Helm chart và values theo môi trường. | Manifest deploy IOE (mục 14) |
| Terraform, Argo CD, GitLab CI, Jenkins | Terraform cho hạ tầng với state remote có khóa; CI build image và cập nhật tag; Argo CD kéo từ Git và sync, rollback bằng revert; Jenkins shared library dùng chung cho mọi repo IOE. | Jenkins (mục 14) |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn deploy service lên Kubernetes?"** Các service IOE chạy trên Kubernetes, build và deploy qua một Jenkins shared library dùng chung cho mọi repo. Manifest không phải tôi viết; phần tôi chạm vào là Dockerfile và cấu hình khi nâng các service lên .NET 10, ví dụ worker Kafka. Ở Examena, team dùng Docker, Helm, Terraform, GitLab CI và Argo CD; cloud cụ thể tôi xác nhận lại trước khi nói.
- **"Readiness và liveness probe khác nhau thế nào?"** Readiness quyết định pod có nhận traffic, nên kiểm tra được dependency. Liveness quyết định restart, chỉ nên kiểm tra process còn chạy; gắn DB vào liveness thì DB chậm sẽ làm cả cluster restart dây chuyền.
- **"Vì sao CPU limit có thể làm tăng p99?"** Linux CFS chia CPU theo chu kỳ 100 ms; pod dùng hết hạn mức trong chu kỳ thì bị dừng tới chu kỳ sau. Request rơi vào lúc bị throttle thì chậm thêm hàng chục mili-giây dù CPU trung bình thấp.
- **"GitOps rollback thế nào?"** `git revert` commit đổi image tag trong repo cấu hình; Argo CD sync về trạng thái cũ. Có thể chọn bản trước trong lịch sử Argo CD, nhưng sau đó phải sửa Git cho khớp để không bị sync đè.
- **"Terraform state để ở đâu, vì sao cần khóa?"** Ở backend remote (object storage của cloud) có khóa, để cả team dùng chung và hai lần apply không chạy cùng lúc làm hỏng state. State có thể chứa secret nên phải mã hóa và hạn chế quyền đọc.

#### Tóm tắt
- Dockerfile nhiều tầng, non-root, cổng 8080 từ .NET 8.
- Readiness kiểm dependency, liveness chỉ kiểm process.
- `SIGTERM` cộng `preStop` cho graceful shutdown; CPU limit gây throttling.
- Terraform cho hạ tầng, Helm cho đóng gói, Argo CD kéo từ Git, CI build và cập nhật tag.
- Bạn không viết manifest IOE; Azure chưa xác nhận.

#### Bài tập
1. Viết Dockerfile nhiều tầng cho một API .NET 10, build và so kích thước với image một tầng dùng `sdk:10.0`.
   **Đáp án:** Image dựa trên `aspnet:10.0` nhỏ hơn image SDK vài lần; chạy `docker run` và gọi `/healthz/live` để kiểm tra.
2. Dựng cluster bằng kind, viết Deployment 3 replica có readiness và liveness như ở trên, rồi chạy `kubectl rollout restart` trong lúc k6 bắn tải.
   **Đáp án:** Có readiness và `preStop` thì tỉ lệ lỗi gần 0 trong lúc rollout; bỏ readiness thì thấy lỗi kết nối khi pod mới chưa sẵn sàng nhận traffic.
3. Đóng gói Deployment trên thành Helm chart với `values-dev.yaml` và `values-prod.yaml` khác số replica, cài, nâng version, rồi `helm rollback`.
   **Đáp án:** `helm history <release>` liệt kê các revision; `helm rollback <release> 1` đưa về revision đầu, số replica trở lại theo values cũ.

### Bài 13.5. Observability: OpenTelemetry, Prometheus, Grafana, Elastic APM và SLO

#### Mục tiêu
- Sau bài này, bạn giải thích được ba tín hiệu trace, metric, log và cách chúng nối với nhau.
- Gắn được OpenTelemetry vào service .NET và biết cách truyền context qua HTTP, gRPC, Kafka.
- Viết được PromQL tính rate và percentile từ histogram, tránh bẫy cardinality.
- Định nghĩa SLI, SLO, error budget và burn-rate alert; biết Bài 4.4 đi sâu phần nào.

#### Ba tín hiệu
- **Trace:** một request đi qua nhiều service; mỗi bước là một **span** có thời gian, thuộc tính, quan hệ cha con. Trả lời "chậm ở đâu".
- **Metric:** số đo tổng hợp theo thời gian, rẻ để lưu lâu. Trả lời "có vấn đề không, từ khi nào".
- **Log:** sự kiện chi tiết. Gắn `trace_id` vào log để nhảy từ trace sang log.

#### OpenTelemetry trong .NET
OpenTelemetry là chuẩn mở cho cả ba tín hiệu, xuất qua giao thức **OTLP** tới bất kỳ backend nào (Elastic, Grafana Tempo, Jaeger).

```csharp
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("exam-api"))
    .WithTracing(t => t.AddAspNetCoreInstrumentation()
                       .AddHttpClientInstrumentation()
                       .AddSqlClientInstrumentation())
    .WithMetrics(m => m.AddAspNetCoreInstrumentation()
                       .AddRuntimeInstrumentation())
    .UseOtlpExporter();
```

- Context truyền qua header W3C `traceparent` trên HTTP và gRPC tự động. Với Kafka phải tự ghi `traceparent` vào header của message và đọc ra ở consumer.
- **Sampling:** head-based (`ParentBased` cộng `TraceIdRatioBased`) rẻ nhưng có thể bỏ sót trace lỗi; tail-based ở OpenTelemetry Collector giữ lại trace lỗi hoặc chậm.

#### Prometheus và Grafana
Bốn kiểu metric: **counter** (chỉ tăng: số request), **gauge** (lên xuống: số kết nối), **histogram** (đếm theo bucket: latency), summary (percentile tính sẵn ở client, không cộng được giữa các pod).

```promql
# Request/s theo route
sum by (http_route) (rate(http_server_request_duration_seconds_count[5m]))

# p95 latency tính từ histogram, gộp mọi pod
histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{http_route="/exam/start"}[5m])))
```

- Không lấy trung bình p95 của các pod: percentile không cộng được; phải gộp bucket rồi mới tính.
- **Cardinality:** mỗi tổ hợp label là một time series. Đưa `userId` hay URL có ID vào label làm Prometheus phình bộ nhớ.
- **Grafana:** mỗi service một dashboard **RED** (Rate, Errors, Duration); tài nguyên theo **USE** (Utilization, Saturation, Errors).

#### Elastic APM
Elastic APM ghi **transaction** (một request) và **span** (SQL, Redis, HTTP ra ngoài, gRPC) cho từng request; Elastic nhận được cả dữ liệu OTLP. Log ứng dụng ở IOE đi theo NLog → Kafka → Elasticsearch (nguồn: B1). Trong đợt audit, bạn lọc endpoint chậm trên APM rồi mở trace xem thời gian từng span; ví dụ API bắt đầu thi thử 2,45 s có 472 lệnh `SCAN` và 17 lệnh `UNLINK` trên Redis (nguồn: mục 2).

#### SLO và burn rate
- **SLI** là số đo (tỉ lệ request nhanh hơn 300 ms); **SLO** là mục tiêu nội bộ (99% trong 30 ngày); **SLA** là cam kết với khách hàng có chế tài.
- **Error budget** = 1 − SLO. SLO 99,9% trong 30 ngày cho phép 0,1% request xấu, tương đương khoảng 43 phút nếu tính theo thời gian.
- **Burn-rate alert** nhiều cửa sổ: page khi burn rate ≥ 14,4 trên cả cửa sổ 1 giờ và 5 phút (tiêu 2% budget trong 1 giờ); ticket khi burn chậm kéo dài. Page theo triệu chứng người dùng thấy, không theo nguyên nhân (CPU cao). Chi tiết ở Bài 4.4.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| OpenTelemetry, tracing, Grafana | Chuẩn mở cho trace, metric, log, xuất OTLP tới mọi backend; context đi qua `traceparent`, Kafka phải tự gắn header; Grafana dựng dashboard RED và USE. | |
| Prometheus | Counter, gauge, histogram; PromQL `rate`, `histogram_quantile` gộp bucket rồi mới tính; tránh label cardinality cao. | Metric worker Kafka (B2) |
| Elastic APM, Elasticsearch | Trace theo request, span cho SQL, Redis, HTTP, gRPC; log NLog → Kafka → Elasticsearch. | Mục 2, B1 |
| SLO, burn-rate alerting | SLI là số đo, SLO là mục tiêu, error budget là 1 − SLO; alert theo burn rate nhiều cửa sổ, page theo triệu chứng. | |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng APM để tìm nguyên nhân chậm?"** Trong đợt rà soát hiệu năng tôi dẫn, tôi lọc endpoint chậm trên Elastic APM rồi mở trace xem từng span. API bắt đầu thi thử mất 2,45 s, trace cho thấy 472 lệnh `SCAN` và 17 lệnh `UNLINK` trên Redis. Từ span SQL tôi truy xuống DMV để xem procedure, plan và wait. Fix cho API đó do đồng nghiệp commit; phần tôi là phân tích và báo cáo.
- **"Kể một lần bạn dùng Prometheus?"** Worker Kafka kết thúc game có metric Prometheus: số message đã consume, latency xử lý, số lần commit, số lỗi theo loại, kèm `/healthz`. Các metric đó có sẵn; phần tôi làm trên worker là nâng lên .NET 10. Tôi đọc được và viết được PromQL cho lag và latency, nhưng không nhận là người thiết kế bộ metric.
- **"Vì sao không lấy trung bình p95 của các pod?"** Percentile không cộng hay lấy trung bình được; pod ít traffic nhưng chậm sẽ kéo lệch. Phải cộng bucket histogram của mọi pod rồi mới `histogram_quantile`, hoặc định nghĩa SLO dạng tỉ lệ request tốt vì tỉ lệ thì cộng được.
- **"Burn-rate alert là gì?"** Burn rate là tốc độ tiêu error budget so với mức đều. Burn rate 14,4 kéo dài 1 giờ tiêu 2% budget 30 ngày; alert khi cả cửa sổ dài và cửa sổ ngắn cùng vượt ngưỡng để vừa chắc chắn vừa tự tắt nhanh khi sự cố hết.
- **"Label nào không được đưa vào metric?"** Label có cardinality cao hoặc không giới hạn: userId, sessionId, URL đầy đủ có ID, message lỗi tự do. Dùng route template thay cho URL, và để chi tiết đó cho trace hoặc log.

#### Tóm tắt
- Trace trả lời "chậm ở đâu", metric "có vấn đề không", log "chuyện gì xảy ra"; nối bằng `trace_id`.
- OpenTelemetry xuất OTLP; Kafka phải tự truyền `traceparent`.
- Percentile phải tính từ bucket gộp; tránh label cardinality cao.
- SLO dạng tỉ lệ, alert theo burn rate nhiều cửa sổ.
- Elastic APM là bằng chứng thật mạnh nhất; OTel và SLO chưa có.

#### Bài tập
1. Gắn OpenTelemetry vào hai API mẫu (A gọi B qua HTTP), xuất về Jaeger chạy bằng Docker, xem trace xuyên hai service.
   **Đáp án:** Một trace có span server của A, span client HTTP, và span server của B cùng `trace_id`; header `traceparent` được truyền tự động.
2. Bật Prometheus exporter, bắn tải bằng k6, viết PromQL cho request/s, tỉ lệ lỗi 5xx và p95 theo route trong Grafana.
   **Đáp án:** Tỉ lệ lỗi: `sum(rate(..._count{http_response_status_code=~"5.."}[5m])) / sum(rate(..._count[5m]))`; p95 dùng `histogram_quantile` trên `sum by (le, http_route)`.
3. Với SLO 99% request `/exam/start` dưới 300 ms trong 30 ngày, tính error budget theo số request khi có 50 triệu request mỗi tháng, và burn rate khi 1 giờ qua có 8% request chậm.
   **Đáp án:** Budget là 1% của 50 triệu, tức 500.000 request chậm. Burn rate = 8% / 1% = 8: nếu kéo dài, budget hết trong khoảng 30 / 8 ≈ 3,75 ngày.

## Chương 14. Realtime, AI và cách làm việc

Chương cuối của phần này gom ba nhóm keyword ít liên quan về kỹ thuật nhưng hay xuất hiện cuối buổi phỏng vấn: realtime media (WebRTC, SFU), đưa LLM vào production có người kiểm, và cách làm việc của một senior (Scrum, code review, design doc, postmortem).

Hai bài đầu là nền và trỏ sang bài sâu (Bài 7.2, Bài 5.4). Bài cuối có ít bằng chứng dạng số nhất, nên trọng tâm là kể được ví dụ cụ thể, đúng sự thật, theo khung rõ ràng.

### Bài 14.1. WebRTC và SFU

#### Mục tiêu
- Sau bài này, bạn giải thích được các thành phần của WebRTC: signaling, ICE, STUN, TURN, DTLS-SRTP.
- So sánh mesh, SFU và MCU bằng phép tính băng thông.
- Nêu được các khái niệm chính của mediasoup và simulcast.
- Kể đúng phạm vi: SFU thay mesh ở Examena là thật, số worker là minh họa.

#### Thành phần của WebRTC
- **Media capture:** `getUserMedia` lấy camera, micro; `getDisplayMedia` lấy màn hình.
- **`RTCPeerConnection`:** kết nối media và data giữa hai đầu.
- **Signaling:** trao đổi SDP (offer, answer) và ICE candidate. WebRTC **không chuẩn hóa** signaling; thường dùng WebSocket qua một server của mình.
- **ICE:** tìm đường kết nối. **STUN** cho biết địa chỉ công khai của client; **TURN** chuyển tiếp media khi NAT hoặc firewall không cho kết nối trực tiếp (tốn băng thông server).
- **Bảo mật:** media mã hóa bằng **DTLS-SRTP**, bắt buộc.

#### Mesh, SFU, MCU
Ví dụ phòng có 1 giám thị xem 25 thí sinh, mỗi luồng 500 kbps:
- **Mesh:** mọi peer nối trực tiếp. Nếu mỗi thí sinh còn phải gửi cho nhiều người xem, mỗi người gửi N luồng; uplink của client là giới hạn, không scale.
- **SFU (Selective Forwarding Unit):** mỗi thí sinh gửi **1 luồng** lên server; server chỉ chuyển tiếp, không giải mã. Giám thị nhận 25 luồng, nên dùng **simulcast** (client gửi nhiều lớp chất lượng) để giám thị xem lưới nhận lớp thấp.
- **MCU:** server giải mã và trộn thành một luồng. Client nhẹ nhất nhưng server tốn CPU rất lớn và mất linh hoạt bố cục.

Băng thông vào SFU cho 3.000 thí sinh: 3.000 × 300–500 kbps ≈ 0,9–1,5 Gbps.

#### mediasoup
- **Worker:** process C++, mỗi worker gắn một CPU core. Tài liệu mediasoup cho biết một worker thường chịu khoảng 500 consumer, tùy CPU.
- **Router:** nằm trong worker, thường một phòng một router. Thí sinh có **producer**, giám thị có **consumer**, kết nối qua `WebRtcTransport`.
- Phòng vượt một worker: `pipeToRouter` nối router giữa các worker.
- Ghi hình: `PlainTransport` đẩy RTP sang FFmpeg hoặc GStreamer.
- Thí sinh rớt mạng: ICE restart, client tự nối lại, giám thị thấy trạng thái mất kết nối.

> **Ghi nhớ:** Ở Examena, SFU (mediasoup) thay cho mesh là thật; "6 SFU workers" là minh họa vì bạn không nhớ cấu hình worker (nguồn: D3.2, C5). k6 không giả lập được media WebRTC. Chi tiết ở Bài 7.2.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| WebRTC, MediaSoup SFU | Signaling tự làm qua WebSocket, ICE với STUN và TURN, media mã hóa DTLS-SRTP. SFU nhận một luồng từ mỗi thí sinh và chỉ chuyển tiếp, khác mesh (mỗi peer gửi N luồng) và MCU (server trộn hình); simulcast cho người xem lưới. | Examena |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn dùng WebRTC?"** Ở Examena, hệ thống thi có giám sát bằng video; team chuyển từ mesh sang SFU dùng mediasoup để mỗi thí sinh chỉ upload một luồng. Kỳ thi thật có hơn 3.000 thí sinh đồng thời. Cấu hình worker chính xác tôi không nhớ, nên tôi chỉ nói cách ước lượng: khoảng 500 consumer mỗi worker, 3.000 consumer thì cần ít nhất 6 worker, chưa tính dư phòng.
- **"Mesh, SFU và MCU khác nhau thế nào?"** Mesh: peer nối trực tiếp, mỗi peer gửi N luồng, không scale. SFU: server chuyển tiếp, mỗi người gửi một luồng, nhận nhiều luồng. MCU: server trộn thành một luồng, client nhẹ nhưng server tốn CPU và thêm độ trễ.
- **"Khi nào cần TURN?"** Khi hai đầu không nối trực tiếp được (NAT đối xứng, firewall doanh nghiệp chặn UDP). TURN chuyển tiếp toàn bộ media nên tốn băng thông server; cần hỗ trợ TURN qua TCP hoặc TLS cổng 443 cho mạng khó.
- **"Signaling server làm gì?"** Trao đổi SDP offer, answer và ICE candidate giữa các bên, quản lý phòng và quyền. Nó không chuyển media. Với SFU, signaling còn điều khiển tạo transport, producer, consumer.

#### Tóm tắt
- WebRTC: signaling tự làm, ICE với STUN và TURN, DTLS-SRTP bắt buộc.
- SFU: mỗi người gửi một luồng, server chỉ chuyển tiếp; simulcast cho người xem nhiều luồng.
- mediasoup: worker theo core, router theo phòng, producer và consumer.
- SFU thay mesh là thật; số worker là ước lượng.

#### Bài tập
1. Tính băng thông uplink của một thí sinh và downlink của giám thị trong phòng 25 thí sinh, luồng 500 kbps, cho mesh (giám thị và 2 giám sát viên cùng xem) và SFU có simulcast lớp thấp 150 kbps.
   **Đáp án:** Mesh: mỗi thí sinh gửi 3 luồng, 1,5 Mbps uplink; giám thị nhận 25 × 500 = 12,5 Mbps. SFU: thí sinh gửi 1 luồng (các lớp simulcast cộng lại khoảng 700 kbps); giám thị nhận 25 × 150 ≈ 3,75 Mbps.
2. Chạy ví dụ demo của mediasoup (hoặc một sample WebRTC peer-to-peer) trên máy, mở `chrome://webrtc-internals` và tìm loại candidate được chọn.
   **Đáp án:** Trên cùng máy hoặc LAN, cặp candidate là `host`; qua NAT là `srflx` (nhờ STUN); khi bị chặn thì `relay` (qua TURN).

### Bài 14.2. LLM và human-in-the-loop

#### Mục tiêu
- Sau bài này, bạn nêu được các yêu cầu khi gọi LLM trong production: bất đồng bộ, timeout, retry, chi phí, structured output.
- Giải thích được thiết kế human-in-the-loop và cách đo độ chính xác của AI trên dữ liệu thật.
- Nêu được rủi ro bảo mật (prompt injection, PII) và cách giảm.
- Kể đúng hai câu chuyện thật: duyệt phiếu do AI trích xuất và chấm IELTS Writing bằng callback.

#### Gọi LLM trong production
- **Bất đồng bộ:** suy luận mất từ vài giây tới vài phút; không giữ HTTP request chờ. Dùng job cộng callback (webhook) hoặc polling. Callback cần xác thực (API key, chữ ký HMAC) và xử lý idempotent qua bảng inbox vì có thể đến trùng.
- **Timeout và retry** cho lỗi 429 và 5xx, có backoff; giới hạn số lần và **ngân sách chi phí** theo người dùng hoặc theo lô.
- **Structured output:** yêu cầu JSON theo schema, validate phía server; sai format thì retry có giới hạn hoặc chuyển người xử lý.
- **Ghi lại** prompt version, model, token, độ trễ, chi phí cho mỗi lần gọi.

#### Human-in-the-loop và đánh giá
Mô hình **đề xuất**, người **xác nhận**. Để biết AI tốt tới đâu thì phải đo trên dữ liệu thật:
- Chụp lại **bản gốc của AI** trước khi người sửa.
- Mỗi lần người lưu, so bản AI với bản người theo **từng field**: thêm, bỏ, đổi giá trị.
- Tính độ chính xác theo field và theo lô; dùng nó để quyết định field nào tin được tự động (ngưỡng tin cậy), field nào luôn cần người.
- Bước đánh giá lỗi thì chỉ ghi log, **không làm hỏng** thao tác chính của người duyệt.

Bổ sung theo best practice: **golden set** (bộ dữ liệu có đáp án do người làm) để chạy hồi quy mỗi khi đổi prompt hoặc model; LLM-as-judge chỉ dùng khi đã đối chiếu với người chấm, vì nó có thiên lệch.

#### Bảo mật
- **Prompt injection:** nội dung người dùng chứa chỉ dẫn ghi đè prompt. Tách rõ chỉ dẫn và dữ liệu, không cho model gọi công cụ có tác dụng phụ dựa trên nội dung chưa tin cậy, validate output.
- **PII:** chỉ gửi trường cần thiết, che thông tin cá nhân, xem điều khoản lưu dữ liệu của nhà cung cấp.

#### Câu chuyện thật
- **Duyệt phiếu do AI trích xuất** (commit 13/10, của bạn, nguồn: mục 9): AI trích xuất bản nháp phiếu đơn vị trường vào bảng staging; người duyệt sửa trên CMS; lần lưu đầu chụp bản gốc của AI; mỗi lần lưu so theo trường (thêm, bỏ, đổi vai trò, đổi tên) và theo phiếu (mã, tên đơn vị, trường chính, tỉnh/xã); ghi số trường AI đề xuất, số trường sai, tổng số sửa và chi tiết JSON; lỗi đánh giá chỉ ghi log. Khoảng 35K trường đã đi qua luồng này; **chưa có tỉ lệ đúng trên production** (nguồn: C0, C4).
- **Chấm IELTS Writing** (nguồn: mục 9): bạn viết phần lớn proxy writing. Gửi bài kèm `callback_url`; callback xác thực bằng API key, ghi vào bảng inbox; ghép callback với bài nộp qua Redis key TTL 48 giờ (phần ghép do đồng nghiệp viết); giới hạn 3 lần nộp; trạng thái từ chờ chấm tới đã chấm, lỗi, hết quota, AI quá tải. Chi tiết ở Bài 5.4.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| LLM, human-in-the-loop | Mô hình đề xuất, người xác nhận, đo độ chính xác trên dữ liệu thật theo từng field; gọi LLM bất đồng bộ qua callback, validate output theo schema, có ngân sách chi phí. | Mục 9 |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn đưa LLM vào production?"** Luồng duyệt phiếu đơn vị trường sau sáp nhập: AI trích xuất bản nháp, người duyệt sửa trên CMS. Tôi làm phần đánh giá: lần lưu đầu chụp bản gốc của AI, mỗi lần lưu so theo từng trường và ghi số trường AI sai, chi tiết dạng JSON; lỗi ở bước đánh giá không làm hỏng lần lưu. Khoảng 35K trường đã đi qua luồng; tỉ lệ đúng trên production tôi chưa có số nên không nêu.
- **"Đo độ chính xác của AI trên dữ liệu thật thế nào?"** Giữ bản gốc của AI, so với bản người đã duyệt theo từng field, tính `1 − số field sai / số field AI đề xuất` theo lô, trên dữ liệu production chứ không phải dev. Thêm golden set để chạy hồi quy khi đổi prompt hoặc model.
- **"Vì sao chấm bài bằng AI dùng callback mà không giữ request?"** Chấm mất từ vài giây tới vài phút, giữ request thì tốn connection và dễ timeout. Callback ghi vào bảng inbox giúp xử lý idempotent khi callback đến trùng, và trạng thái bài nộp cho giao diện biết đang chờ.
- **"Khi nào bỏ được bước người duyệt?"** Khi có số đo độ chính xác theo field đủ dài trên dữ liệu thật và field đó vượt ngưỡng đã thống nhất với nghiệp vụ; vẫn lấy mẫu kiểm tra định kỳ. Field ảnh hưởng lớn (mã đơn vị) có thể luôn giữ người duyệt.
- **"Phòng prompt injection thế nào?"** Tách chỉ dẫn hệ thống khỏi dữ liệu người dùng, không cho model tự gọi công cụ có tác dụng phụ từ nội dung chưa tin cậy, validate output theo schema, và có người duyệt cho thao tác quan trọng.

#### Tóm tắt
- LLM trong production: bất đồng bộ, timeout, retry 429 và 5xx, ngân sách, structured output.
- Human-in-the-loop: chụp bản AI, so theo field, đo trên production.
- Callback cần xác thực và inbox để idempotent.
- Bằng chứng thật: duyệt phiếu AI (của bạn), proxy chấm IELTS (phần lớn của bạn); chưa có tỉ lệ đúng.

#### Bài tập
1. Viết một hàm so sánh hai object JSON phiếu (bản AI và bản người) theo từng field, trả danh sách thay đổi `{field, ai, human, kind}` với `kind` là thêm, bỏ hoặc đổi.
   **Đáp án:** Duyệt hợp các key của hai bên: chỉ có ở người là thêm, chỉ có ở AI là bỏ, khác giá trị là đổi; danh sách trường con (danh sách trường học) so theo khóa định danh thay vì theo vị trí.
2. Thiết kế bảng và luồng cho chấm bài bất đồng bộ: bảng bài nộp có trạng thái, bảng inbox callback, endpoint callback xác thực bằng HMAC.
   **Đáp án:** Bài nộp (`Id`, `Status`, `Attempts`, `Score`); inbox (`CallbackId` unique, `SubmissionId`, `Payload`, `ReceivedAt`); callback kiểm chữ ký HMAC của body và timestamp, insert inbox (trùng thì trả `200` luôn), cập nhật bài nộp trong cùng transaction.

### Bài 14.3. Agile/Scrum, code review, design doc và postmortem

#### Mục tiêu
- Sau bài này, bạn trình bày được Scrum (vai trò, sự kiện, artifact) và nói được team thật làm khác sách ở đâu.
- Nêu được tiêu chí review PR theo thứ tự ưu tiên và cách viết comment.
- Viết được dàn ý design doc, ADR và postmortem blameless.
- Kể được ví dụ thật: review PR ở Examena, báo cáo audit hiệu năng.

#### Agile và Scrum
Scrum có ba vai trò (Product Owner, Scrum Master, Developers), các sự kiện trong sprint 1–4 tuần (thường 1–2 tuần): **planning**, **daily**, **review** (demo cho bên liên quan), **retrospective** (cải tiến cách làm); artifact: product backlog, sprint backlog, increment cùng **definition of done**. Ước lượng bằng story point hoặc thời gian. Kanban là lựa chọn thay thế cho team vận hành nhiều việc đến bất chợt: không có sprint, giới hạn WIP, đo lead time.

Interviewer không cần bạn đọc sách; họ hỏi team bạn làm khác sách ở đâu và vì sao. Chỉ nhận "Scrum" nếu team thật sự chạy Scrum (nguồn: D3.1).

#### Code review
Thứ tự ưu tiên: **đúng đắn** (logic, race, xử lý lỗi, idempotency) → **bảo mật** (quyền, injection, secret) → **hiệu năng** (N+1, truy vấn không sargable, gọi trong vòng lặp) → **dễ đọc**. PR nhỏ, một mục đích. Comment đề xuất cách sửa và lý do, phân biệt "bắt buộc" với "gợi ý"; không ra lệnh, không bình luận về người. Việc lặp lại nhiều lần thì đưa vào linter hoặc checklist thay vì nhắc tay.

#### Design doc và ADR
```text
1. Bối cảnh và vấn đề (có số liệu)
2. Mục tiêu / Không phải mục tiêu
3. Phương án đề xuất (sơ đồ, API, mô hình dữ liệu)
4. Phương án đã cân nhắc và vì sao loại
5. Rủi ro, rollback, migration
6. Đo lường thành công (metric, SLO)
7. Kế hoạch triển khai theo pha
```
**ADR** (Architecture Decision Record) ngắn hơn: Context → Decision → Consequences, một quyết định một file, lưu trong repo.

#### Postmortem blameless
```text
Tóm tắt | Ảnh hưởng (bao nhiêu user, bao lâu) | Timeline | Nguyên nhân gốc (5 Whys)
| Yếu tố góp phần | Điều làm tốt | Điều chưa tốt | Hành động (người chịu trách nhiệm, hạn)
```
Blameless nghĩa là tìm lỗ hổng của hệ thống và quy trình, không tìm người để trách; người viết code lỗi phải dám kể đủ chi tiết. Action item phải cụ thể, có chủ và có hạn, không phải "cẩn thận hơn".

#### Bằng chứng thật
- **Báo cáo audit** (nguồn: mục 2, C1): bạn dẫn đợt rà soát hiệu năng 6 cụm SQL Server dựa trên APM và DMV, viết báo cáo kèm kế hoạch xử lý theo mức ưu tiên cho Dev và DBA. Động từ đúng là "dẫn cuộc điều tra", kết quả là "các fix của team".
- **Review PR ở Examena** (nguồn: C5): bạn là Team Lead team 8 người, chịu trách nhiệm technical design, task planning, code review và release. Cần chuẩn bị một ví dụ cụ thể cho mỗi việc: một quyết định thiết kế, một lần chia lại việc, một PR đã chặn và lý do.
- Bài học thật có thể dùng cho câu "một lần bạn sai": cờ rollback V3 bị hard-code `true` ngay trong ngày 24/08 (nguồn: mục 5, mục 15).

> **Mẹo:** Viết postmortem cho đợt API bắt đầu thi 2,45 s (coi là sự cố) là cách biến keyword "postmortems" thành bằng chứng thật.

#### Câu nói 30 giây và bằng chứng

| Keyword | Nói trong 30 giây | Bằng chứng thật |
|---|---|---|
| Agile/Scrum | Sprint 1–2 tuần với planning, daily, review, retro; definition of done; nói được team mình làm khác sách ở đâu và vì sao. | |
| Code review, design docs, postmortems | Review theo tiêu chí rõ (đúng, an toàn, nhanh, dễ đọc); design doc có phương án thay thế và cách rollback; postmortem không đổ lỗi, action item có chủ và hạn. | Review PR ở Examena; báo cáo audit |

#### Câu hỏi phỏng vấn
- **"Kể một lần bạn viết tài liệu kỹ thuật dẫn tới quyết định?"** Đợt rà soát hiệu năng 6 cụm SQL Server: tôi đi từ Elastic APM xuống DMV và code, viết báo cáo gồm phát hiện, nguyên nhân và kế hoạch theo mức ưu tiên cho Dev và DBA, chia hai tầng: sửa procedure trong ngày và đánh index ca đêm vì Standard Edition không có index online. Tôi dẫn cuộc điều tra; các fix do team cùng triển khai, tôi trực tiếp làm phần cache.
- **"Kể một lần bạn chặn một PR?"** Dùng ví dụ thật từ vai trò Team Lead ở Examena, kể theo khung: PR làm gì, vấn đề bạn thấy (đúng đắn, bảo mật hay hiệu năng), bạn đề xuất gì, kết quả. Nếu không nhớ ví dụ cụ thể thì nói tiêu chí review bạn dùng, không dựng chuyện.
- **"Postmortem blameless nghĩa là gì?"** Tập trung vào hệ thống và quy trình đã cho phép lỗi xảy ra, không quy trách nhiệm cá nhân, để người trong cuộc kể đủ sự thật. Kết quả là action item cụ thể có người chịu trách nhiệm và hạn.
- **"Team bạn chạy Scrum khác sách ở đâu?"** Trả lời theo thực tế của team; nếu team không chạy Scrum thì nói thẳng quy trình thật (ví dụ Kanban theo sự kiện, release theo mùa thi) và vì sao nó hợp. Không nhận Scrum khi không làm.
- **"Kể một lần bạn sai và sửa thế nào?"** Khi rollout attempt engine V3, có cờ config để quay về đường cũ, nhưng chính tôi hard-code cờ thành `true` ngay trong ngày để bỏ nhánh cấu hình. Hệ quả là muốn rollback phải deploy lại. Bài học: giữ cờ trong config tới hết đợt live đầu tiên.

#### Tóm tắt
- Scrum: vai trò, sự kiện, definition of done; nói được team mình khác sách ở đâu.
- Review: đúng → an toàn → nhanh → dễ đọc; comment có lý do và đề xuất.
- Design doc luôn có phương án đã loại và cách rollback; ADR cho từng quyết định.
- Postmortem blameless: action item có chủ và hạn.
- Bằng chứng thật: báo cáo audit, vai trò review ở Examena, bài học cờ V3.

#### Bài tập
1. Viết postmortem 1 trang cho sự cố "API bắt đầu thi thử mất 2,45 s" theo mẫu ở trên, dùng các sự kiện đã biết (472 lệnh `SCAN`, 17 `UNLINK`, fix dùng SET làm index, còn 55 ms).
   **Đáp án:** Nguyên nhân gốc theo 5 Whys: luồng trừ lượt thi gọi hàm làm mới cache → hàm xóa key bằng `SCAN` toàn keyspace → Redis đơn luồng nên chặn client khác → thiết kế không lưu danh sách key cần xóa. Action item: cấm `SCAN`/`KEYS` trên đường nóng trong checklist review, alert theo latency API. Ghi đúng ai commit fix.
2. Viết một ADR cho quyết định "dùng applock thay vì unique index" ở sự kiện ghi kết quả một lần.
   **Đáp án:** Context: bảng dùng chung, ràng buộc không tạo object DB mới, request có thể retry. Decision: `sp_getapplock` theo (user, vòng) cộng `UPDLOCK, HOLDLOCK`. Consequences: chỉ serialize theo key, không khóa bảng; đúng đắn phụ thuộc mọi đường ghi đều lấy lock; nếu sau này được sửa schema thì thêm unique index.
3. Lấy một PR gần đây của bạn hoặc của đồng nghiệp, viết 3 comment review theo thứ tự đúng đắn, bảo mật, hiệu năng.
   **Đáp án:** Mỗi comment nêu vấn đề, tác động, đề xuất cụ thể, và đánh dấu bắt buộc hay gợi ý.
