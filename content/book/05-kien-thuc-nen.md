# Phần IV. Kiến thức nền backend

Đến đoạn giữa buổi phỏng vấn, người phỏng vấn thường nhìn vào phần kỹ năng và chọn một từ: "anh nói về Kafka đi", "anh dùng Redis thế nào". Câu hỏi ngắn nhưng họ đang kiểm tra hai việc. Một là bạn hiểu công nghệ đó ở mức cơ chế hay chỉ thuộc tên. Hai là bạn đã dùng nó để giải quyết việc gì. Lý thuyết trôi chảy mà không có trải nghiệm thì nghe như học thuộc; kể chuyện được mà không giải thích được vì sao nó chạy thì dễ bị nghi là kể lại việc của người khác.

Phần này dạy lại nền tảng của từng nhóm công nghệ: vấn đề nào sinh ra nó, nó chạy thế nào, khi nào dùng, khi nào không, phải đánh đổi gì. Mỗi bài kết thúc bằng cách lồng kiến thức đó vào câu trả lời: nếu đã làm thật thì kể bằng lời thường, có bối cảnh và lý do; nếu chưa làm thì nói thẳng là chưa làm và cho thấy mình sẽ thiết kế thế nào. Người phỏng vấn senior đánh giá cao sự rõ ràng đó hơn một danh sách công nghệ dài.

## Chương 9. Core backend .NET

Đây là nhóm câu hỏi mở màn của gần như mọi vòng kỹ thuật .NET: một request đi qua những tầng nào, DI quản lý vòng đời ra sao, REST và gRPC khác nhau ở đâu, async/await thật ra làm gì, và truy cập dữ liệu nên dùng công cụ nào. Câu hỏi nghe cơ bản, nhưng chính vì cơ bản nên trả lời sai một chi tiết là mất điểm cho cả buổi.

Học xong chương này, bạn giải thích được vì sao một API chạy tốt lúc vắng lại timeout hàng loạt lúc cao điểm, và kể được vài lần sửa lỗi thật ở tầng này (dùng lại kết nối gRPC, bỏ `async void` khi ghi cache, khử truy vấn lặp) đúng với phần việc của mình.

### Bài 9.1. Request đi qua ASP.NET Core thế nào: middleware, DI và Minimal APIs

#### Kiến thức

##### Middleware pipeline

ASP.NET Core xử lý request bằng một chuỗi middleware. Mỗi middleware nhận `HttpContext`, làm phần việc "trước", gọi `next(context)` để chuyển vào tầng trong, rồi làm phần "sau" khi tầng trong trả về. Vì vậy phần "trước" chạy theo thứ tự đăng ký, còn phần "sau" chạy theo thứ tự ngược lại. Middleware cũng có thể trả response luôn mà không gọi `next` (short-circuit): file tĩnh, CORS preflight, rate limiter từ chối request.

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

Thứ tự đăng ký chính là hành vi. Ba lỗi hay gặp:
- `UseAuthorization` đặt trước `UseAuthentication`: lúc kiểm quyền, `HttpContext.User` chưa được điền nên mọi endpoint cần đăng nhập trả `401`, dù token hợp lệ.
- Exception handler đặt sau middleware gây lỗi thì không bắt được lỗi đó.
- Middleware sửa header sau khi tầng trong đã bắt đầu ghi body: lỗi "response has already started".

##### Dependency injection và vòng đời

DI của ASP.NET Core có ba vòng đời:
- **Transient:** tạo mới mỗi lần resolve; hợp với service nhẹ, không trạng thái.
- **Scoped:** một instance cho mỗi request; `DbContext` mặc định là scoped.
- **Singleton:** một instance cho cả process, nên bắt buộc thread-safe.

Lỗi kinh điển là **captive dependency**: singleton giữ một service scoped, làm service scoped sống mãi và bị dùng chung giữa các request. Với `DbContext`, lỗi hiện ra dưới dạng exception đa luồng hoặc dữ liệu tracking lẫn giữa các request. Môi trường Development bật sẵn `ValidateScopes` nên báo lỗi ngay khi resolve; Production thì không, lỗi chỉ lộ ra dưới tải. Trong `BackgroundService` (là singleton), muốn dùng service scoped phải tự tạo scope mỗi vòng lặp: `await using var scope = scopeFactory.CreateAsyncScope();` rồi lấy service từ `scope.ServiceProvider`.

Hai thứ nên biết thêm. **Keyed services** (.NET 8): đăng ký nhiều implementation của cùng interface theo key (`AddKeyedSingleton<IStore, RedisStore>("redis")`, nhận bằng `[FromKeyedServices("redis")]`). **Options pattern**: `IOptions<T>` đọc một lần; `IOptionsSnapshot<T>` là scoped, đọc lại mỗi request; `IOptionsMonitor<T>` là singleton, luôn có giá trị mới nhất và có `OnChange`. Gắn `ValidateOnStart()` để app chết ngay lúc khởi động khi config sai, thay vì chết ở request đầu tiên lúc nửa đêm.

##### Controller và Minimal APIs

| Tiêu chí | Controller (`[ApiController]`) | Minimal APIs |
|---|---|---|
| Khai báo | Class, attribute routing | `MapGet`, `MapPost`, `MapGroup` |
| Validation | Tự trả `400` | .NET 10 có `AddValidation()` cho DataAnnotations; bản cũ phải tự gắn filter |
| Mở rộng | Action filter, convention | Endpoint filter |
| Native AOT | Không | Có |
| Hợp với | API lớn, nhiều quy ước chung | BFF, gateway, service nhỏ |

```csharp
var exams = app.MapGroup("/api/exams").RequireAuthorization();
exams.MapGet("/{id:int}", async Task<Results<Ok<ExamDto>, NotFound>> (
        int id, IExamService svc, CancellationToken ct) =>
    await svc.GetAsync(id, ct) is { } dto ? TypedResults.Ok(dto) : TypedResults.NotFound());
```

`TypedResults` cho kiểu trả về rõ ràng: OpenAPI sinh đúng schema, unit test kiểm được kiểu kết quả. Hai kiểu viết dùng chung được trong một app, nên đây không phải lựa chọn một lần cho cả hệ thống.

#### Cách show off

Đừng trả lời như đọc định nghĩa; gắn nó vào hệ thống bạn đã làm. Trên nền tảng thi tiếng Anh trực tuyến, service theo kiểu controller mỏng, logic ở tầng proxy dùng chung, DB qua stored procedure. Riêng BFF đăng nhập (lớp trung gian giữa trình duyệt và identity server) viết bằng Minimal APIs và YARP; lõi BFF có sẵn, phần của bạn là làm cứng nó.

> **Ví dụ:** "Ở hệ thống thi trực tuyến tôi làm, các service theo kiểu controller mỏng, logic nằm ở tầng proxy dùng chung và mọi truy cập DB đi qua stored procedure. Có một chỗ dùng Minimal APIs là BFF đăng nhập, đứng giữa trình duyệt và identity server, proxy bằng YARP. Phần lõi của BFF có sẵn khi tôi vào, việc của tôi là làm cứng nó: CORS chỉ cho phép danh sách domain trong config, cookie ghi nhớ đăng nhập có hạn còn không chọn thì là session cookie, và chuyển các endpoint liên quan tới token sang POST để token không nằm trong URL hay log. Tôi chọn Minimal APIs cho kiểu service này vì nó gọn, khởi động nhanh, và các endpoint gần như chỉ chuyển tiếp. Với API nghiệp vụ lớn nhiều filter chung thì controller vẫn gọn hơn."

Điểm ăn điểm:
- Nói được vì sao thứ tự middleware quan trọng bằng một hậu quả cụ thể (authorization trước authentication thì mọi request `401`), không chỉ "phải đúng thứ tự".
- Nhắc captive dependency và cách phát hiện (`ValidateScopes`, `ValidateOnBuild`), vì đây là lỗi chỉ lộ dưới tải.
- Tách bạch phần có sẵn và phần mình làm trong BFF; người nghe tin phần còn lại hơn khi bạn chủ động nói ranh giới.

#### Câu hỏi vặn

- **"Đặt `UseAuthorization` trước `UseAuthentication` thì chuyện gì xảy ra?"** Lúc authorization chạy, `HttpContext.User` chưa được xác thực, nên mọi endpoint yêu cầu đăng nhập trả `401` dù token đúng. Thứ tự đúng là routing, CORS, authentication, authorization, rồi tới endpoint.
- **"Captive dependency là gì, phát hiện thế nào?"** Là khi service sống lâu (singleton) giữ service sống ngắn (scoped), làm service scoped bị dùng chung giữa các request. Development bật sẵn `ValidateScopes` nên báo lỗi khi resolve; có thể bật thêm `ValidateOnBuild`. Sửa bằng cách đổi vòng đời hoặc tạo scope qua `IServiceScopeFactory`.
- **"`IOptions`, `IOptionsSnapshot`, `IOptionsMonitor` khác nhau thế nào?"** `IOptions` đọc một lần lúc khởi tạo. `IOptionsSnapshot` là scoped, đọc lại mỗi request, nên không inject được vào singleton. `IOptionsMonitor` là singleton, luôn trả giá trị mới nhất và có callback `OnChange`.
- **"Khi nào anh chọn Minimal APIs thay vì controller?"** Service nhỏ, BFF, gateway, cần khởi động nhanh hoặc Native AOT. API lớn có nhiều filter và quy ước chung thì controller gọn hơn. Hai kiểu chạy chung được trong một app nên có thể chọn theo từng nhóm endpoint.
- **"Trong BFF đó, phần nào là của anh?"** Lõi BFF (luồng PKCE, nơi lưu phiên) có sẵn khi tôi vào. Tôi làm phần làm cứng: CORS theo danh sách trong config, cookie ghi nhớ đăng nhập, chuyển endpoint token sang POST, và cờ bật tắt captcha Cloudflare Turnstile.
#### Bẫy cần tránh

- Liệt kê ba vòng đời DI mà không nói lỗi nào xảy ra khi dùng sai; người phỏng vấn muốn nghe captive dependency.
- Nhận cả BFF là của mình. Nói rõ phần có sẵn và phần mình làm.

#### Nhớ nhanh

- Pipeline là chuỗi middleware; thứ tự đăng ký là thứ tự chạy, exception handler ở ngoài cùng.
- Ba vòng đời: transient, scoped, singleton; captive dependency là lỗi kinh điển, lộ ra dưới tải.
- Options có ba interface với vòng đời khác nhau; `ValidateOnStart` để fail sớm.
- Minimal APIs hợp BFF và service nhỏ; .NET 10 có `AddValidation` sẵn.

#### Bài tập

1. Tạo project `dotnet new web`, viết middleware ghi thời gian trước và sau `next`. Đăng ký `UseAuthorization` trước `UseAuthentication` với một endpoint có `RequireAuthorization()`, gửi request có token hợp lệ.
   **Đáp án:** Nhận `401` vì `User` chưa được điền khi authorization chạy. Đổi lại thứ tự thì nhận `200`. Middleware đo thời gian cho thấy phần "sau" chạy theo thứ tự ngược với phần "trước".
2. Đăng ký một service scoped chứa `Guid Id = Guid.NewGuid()`, inject vào một singleton, gọi endpoint hai lần ở Production rồi ở Development.
   **Đáp án:** Ở Production, hai request in cùng một Guid (captive). Ở Development, app ném `InvalidOperationException` "Cannot consume scoped service ... from singleton" nhờ `ValidateScopes`.
### Bài 9.2. REST và gRPC: thiết kế API và gọi giữa các service

#### Kiến thức

##### REST: resource, verb và tính idempotent

REST mô hình hóa hệ thống thành **resource** (`/exams/42/attempts`) và thao tác bằng HTTP verb. Điều quan trọng nhất khi thiết kế là biết verb nào gửi lại được an toàn, vì mạng sẽ làm client retry.

| Verb | Safe | Idempotent | Ghi chú |
|---|---|---|---|
| GET | Có | Có | Không được có tác dụng phụ |
| PUT | Không | Có | Thay toàn bộ resource; gửi lại cho cùng kết quả |
| DELETE | Không | Có | Xóa lần hai vẫn là "đã xóa" (có thể trả `404`) |
| POST | Không | Không | Tạo mới; muốn retry an toàn cần idempotency key |
| PATCH | Không | Không bắt buộc | Tùy cách định nghĩa patch |

Mã trạng thái dùng đúng nghĩa: `201` kèm `Location` khi tạo, `204` khi không có body, `400` input sai, `401` chưa xác thực, `403` không có quyền, `404`, `409` xung đột trạng thái, `422` sai nghiệp vụ, `429` vượt giới hạn kèm `Retry-After`, `503` khi phụ thuộc chết. Body lỗi theo chuẩn **ProblemDetails** (RFC 9457) để client xử lý thống nhất.

**Phân trang.** Offset (`?page=500&size=20`) bắt DB đọc rồi bỏ qua 10.000 dòng; càng về sau càng chậm và khi có dòng mới chèn vào thì trang bị lặp hoặc sót. **Keyset** (còn gọi cursor) nhớ phần tử cuối của trang trước và seek thẳng vào index, nên chi phí mỗi trang gần như không đổi. T-SQL không có so sánh bộ giá trị `(a, b) < (x, y)`, nên phải viết tách điều kiện:

```sql
SELECT TOP (20) Id, Name, CreatedAt
FROM dbo.Exam
WHERE CreatedAt < @lastCreated
   OR (CreatedAt = @lastCreated AND Id < @lastId)
ORDER BY CreatedAt DESC, Id DESC;   -- cần index (CreatedAt DESC, Id DESC)
```

**Versioning.** Theo URL (`/v3/...`) dễ nhìn, dễ route ở gateway; theo header thì URL gọn nhưng khó debug hơn.

##### gRPC

gRPC dùng **Protobuf** làm hợp đồng (file `.proto` sinh code client và server) và chạy trên **HTTP/2**: nhiều lời gọi song song (stream) trên một kết nối TCP. Có bốn kiểu: unary, server streaming, client streaming, bidirectional streaming. Payload nhị phân nhỏ, hợp đồng có kiểu, nên hợp cho giao tiếp nội bộ giữa các service.

Ba điểm vận hành phải nắm:
- **Dùng lại channel.** `GrpcChannel` giữ kết nối HTTP/2. Tạo mới mỗi lần gọi là mỗi lần mở TCP, bắt tay TLS và HTTP/2, tốn socket và thời gian. Dùng `AddGrpcClient` để framework quản lý channel. Một kết nối HTTP/2 thường giới hạn khoảng 100 stream đồng thời; tải cao thì bật `EnableMultipleHttp2Connections`.
- **Deadline.** Client đặt hạn chót; server đọc được qua `ServerCallContext.Deadline` và nên truyền tiếp cho lời gọi phía sau. Lời gọi đồng bộ trên đường request mà không có deadline thì có thể treo vô hạn.
- **Cân bằng tải.** Load balancer L4 chỉ chọn pod lúc mở kết nối. Kết nối HTTP/2 sống lâu nên mọi lời gọi dồn vào một pod. Cần cân bằng phía client hoặc proxy L7 (Envoy, service mesh).

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

Khi nào không dùng gRPC: API công khai cho trình duyệt (cần gRPC-Web hoặc REST), tích hợp với bên thứ ba quen REST, hoặc khi payload cần đọc bằng mắt lúc debug.

#### Cách show off

Với REST, xoay quanh câu hỏi "gửi lại có an toàn không": idempotency quyết định retry, retry quyết định thiết kế API. Với gRPC, nói về vận hành (channel, deadline, cân bằng tải) thay vì chỉ "nhanh hơn REST". Câu chuyện thật: API cập nhật thông tin học sinh chậm vì mỗi lần gửi event gRPC lại tạo channel mới; bạn dùng chung channel, đẩy việc gửi ra khỏi luồng request và **cố ý không đặt deadline**. Kết quả sau sửa chưa đo lại.

> **Ví dụ:** "Có một API cập nhật thông tin học sinh mà trace APM cho thấy mất khoảng nửa giây, nhiều hơn mức cần thiết cho một lần ghi. Mở trace ra tôi thấy mỗi lần gửi event sang service sự kiện qua gRPC đều tạo một channel mới, tức là mỗi lần lại mở kết nối và bắt tay TLS. Tôi sửa thành dùng chung channel và đưa việc gửi event ra khỏi luồng request. Có một quyết định tôi cân nhắc khá kỹ là không đặt deadline cho lời gọi này: service nhận có lúc chậm tới vài giây, đặt deadline ngắn thì event bị rơi, tức là thay đổi hành vi nghiệp vụ. Tôi cũng nói thẳng là phần đo lại sau deploy tôi chưa làm, nên chưa có con số sau sửa. Nếu làm lại, tôi sẽ đưa event vào hàng đợi bền thay vì gửi trực tiếp."

Điểm ăn điểm:
- Phân biệt deadline cho lời gọi đồng bộ (bắt buộc) với event đã tách khỏi request (deadline chỉ làm rơi event). Đây là kiểu đánh đổi người phỏng vấn muốn nghe.
- Nhắc vấn đề gRPC sau load balancer L4; ít người nói tới cho tới khi gặp một pod quá tải.
- Không nhận con số sau sửa khi chưa đo.

#### Câu hỏi vặn

- **"Không đặt deadline cho gRPC có phải sai không?"** Với lời gọi đồng bộ trên đường request thì sai, vì request có thể treo vô hạn. Với event đã tách khỏi request thì deadline ngắn chỉ làm rơi event. Cách tốt hơn là đưa event vào hàng đợi bền (Kafka hoặc outbox) để vừa không giữ request vừa không mất event.
- **"Con số nửa giây đó đo thế nào, sau khi sửa còn bao nhiêu?"** Đo bằng trace của Elastic APM trên endpoint đó, xem thời gian từng span. Sau sửa tôi chưa đo lại trên APM nên không nêu số; nếu được hỏi tiếp tôi nói rõ đó là việc còn thiếu.
- **"PUT và POST khác nhau thế nào về idempotency?"** PUT thay toàn bộ resource ở một URI xác định, gửi lại cho cùng trạng thái. POST tạo mới, gửi lại có thể tạo hai bản ghi; muốn retry an toàn thì client gửi header `Idempotency-Key` và server lưu kết quả theo key.
- **"Offset pagination có vấn đề gì trên bảng lớn?"** `OFFSET 100000` vẫn phải đọc và bỏ qua 100.000 dòng, và dữ liệu chèn thêm làm trang bị lặp hoặc sót. Keyset dùng điều kiện trên cột có index nên chi phí mỗi trang gần như không đổi; đổi lại không nhảy thẳng tới trang bất kỳ được.
- **"Sao không dùng REST luôn cho giao tiếp nội bộ?"** REST vẫn được, nhất là khi ít service và cần debug dễ. gRPC có hợp đồng sinh code, payload nhỏ, streaming và deadline sẵn, đáng giá khi nhiều service gọi nhau với tần suất cao. Cái giá là khó đọc bằng mắt và phải lo cân bằng tải HTTP/2.

#### Bẫy cần tránh

- Nói "gRPC nhanh hơn REST" mà không nói vì sao và khi nào điều đó không còn đúng.
- Viết keyset bằng `WHERE (CreatedAt, Id) < (@a, @b)` cho SQL Server; T-SQL không hỗ trợ cú pháp này.

#### Nhớ nhanh

- GET, PUT, DELETE idempotent; POST không, nên cần idempotency key để retry an toàn.
- Mã trạng thái đúng nghĩa, lỗi theo ProblemDetails, phân trang keyset cho bảng lớn.
- gRPC: Protobuf trên HTTP/2; dùng lại channel; lời gọi đồng bộ phải có deadline.
- gRPC sau L4 cần cân bằng phía client hoặc L7.

#### Bài tập

1. Viết client gRPC gọi 1.000 lần một service mẫu theo hai cách: tạo `GrpcChannel` mới mỗi lần và dùng chung một channel. Đo tổng thời gian và đếm kết nối TCP bằng `netstat -an | find "ESTABLISHED"` trong lúc chạy.
   **Đáp án:** Cách tạo mới chậm hơn nhiều lần và để lại hàng trăm kết nối (nhiều cái ở TIME_WAIT). Dùng chung channel chỉ có một vài kết nối.
### Bài 9.3. async/await, thread pool và fire-and-forget

#### Kiến thức

##### async/await thật ra làm gì

Compiler biến method `async` thành một state machine. Tại `await` một tác vụ I/O chưa xong, method trả `Task` về cho caller và **trả thread về thread pool**. Khi I/O xong, phần còn lại chạy tiếp trên một thread bất kỳ của pool. Lợi ích không phải "chạy nhanh hơn" mà là **phục vụ được nhiều request đồng thời hơn với cùng số thread**. Một request async vẫn mất đúng thời gian chờ DB như bản đồng bộ.

ASP.NET Core không có `SynchronizationContext`, nên deadlock kinh điển của `.Result` trong WinForms hay ASP.NET cũ không xảy ra. Nhưng `.Result`, `.Wait()`, `GetAwaiter().GetResult()` vẫn **chặn thread** trong lúc chờ: đó là sync-over-async. Thư viện dùng chung vẫn nên viết `ConfigureAwait(false)` vì có thể bị gọi từ môi trường có context.

##### Thread pool starvation

Khi nhiều request cùng chặn thread, pool hết thread rảnh. Pool chỉ bơm thêm thread khá chậm, nên hàng đợi công việc dài ra. Triệu chứng rất đặc trưng: **timeout hàng loạt trong khi CPU thấp**. Đo bằng:

```bash
dotnet-counters monitor -n MyApi System.Runtime
# Theo dõi ThreadPool Queue Length tăng liên tục, ThreadPool Thread Count tăng dần
```

Lấy `dotnet-stack` hoặc dump để xem thread đang chặn ở đâu. Sửa gốc là bỏ sync-over-async trên đường nóng. Tăng `ThreadPool.SetMinThreads` chỉ là băng dán tạm.

##### `async void`, `Task.WhenAll` và fire-and-forget

- **`async void`:** caller không `await` được nên không biết khi nào xong; exception không bắt được ở caller và có thể làm sập process. Chỉ dùng cho event handler.
- **`Task.WhenAll`:** chạy song song các I/O độc lập, tổng thời gian bằng lời gọi chậm nhất. Không dùng chung một `DbContext` cho các tác vụ song song vì nó không thread-safe; mỗi tác vụ song song cũng chiếm thêm một connection trong pool.
- **`_ = Task.Run(...)` trong controller:** exception bị nuốt, process restart thì mất việc, không có backpressure, và service scoped (`DbContext`, `HttpContext`) có thể đã bị dispose khi request kết thúc.

Fire-and-forget đúng cách trong process là `Channel<T>` có giới hạn cộng `BackgroundService`. Cần bền qua restart thì dùng hàng đợi (Kafka, outbox).

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

Luôn truyền `CancellationToken` (`HttpContext.RequestAborted`) xuống DB và HTTP, để client hủy thì server ngừng làm việc thừa.

#### Cách show off

Cách ghi điểm là đi từ triệu chứng: "cao điểm timeout hàng loạt nhưng CPU thấp". Ai nhận ra ngay thread pool starvation và biết đo bằng gì thì nghe như người đã trực sự cố. Câu chuyện thật nằm trong cùng lần sửa API ở bài trước: hàm ghi cache là `async void`, bạn đổi sang `async Task`; việc gửi event được đẩy vào `Task.Run`, một đánh đổi bạn phải nói rõ.

> **Ví dụ:** "Lần sửa liên quan async rõ nhất của tôi là ở một API cập nhật thông tin học sinh. Hàm ghi cache cũ được khai báo `async void`, nên caller không chờ được nó: bước tiếp theo trong cùng request có lúc đọc ra dữ liệu cũ, và nếu hàm đó ném lỗi thì không ai bắt được. Tôi đổi sang `async Task` và `await` đúng chỗ. Cùng lần đó tôi đẩy việc gửi event ra `Task.Run` để không giữ thread của request. Tôi biết `Task.Run` kiểu này nuốt exception và mất việc nếu process restart; với event phụ thì tôi chấp nhận, còn nếu event quan trọng thì tôi sẽ dùng `Channel` có giới hạn cộng background service, hoặc hàng đợi bền."

Điểm ăn điểm:
- Nói async tăng khả năng chịu đồng thời, không tăng tốc từng request.
- Tự nêu nhược điểm của chính giải pháp mình chọn (`Task.Run`) và phương án tốt hơn; người phỏng vấn thường định vặn đúng chỗ đó.
- Biết công cụ đo (`dotnet-counters`, `dotnet-stack`) chứ không chỉ đoán.

#### Câu hỏi vặn

- **"API bình thường, giờ cao điểm timeout hàng loạt nhưng CPU thấp. Anh nghi gì?"** Thread pool starvation do sync-over-async. Tôi xem `ThreadPool Queue Length` bằng `dotnet-counters`, lấy `dotnet-stack` hoặc dump để xem thread chặn ở đâu, rồi bỏ `.Result`/`.Wait()` trên đường nóng. Tăng min threads chỉ để cầm cự trong lúc sửa.
- **"Vì sao `async void` nguy hiểm?"** Caller không chờ được nên thứ tự thực thi sai, như chuyện đọc phải cache cũ của tôi. Exception thoát ra thread pool, không bắt được ở caller và có thể làm sập process. Chỉ dùng cho event handler.
- **"Anh dùng `Task.Run` để gửi event, vậy có vấn đề gì?"** Exception bị nuốt nếu không tự bắt, process restart thì event mất, không có giới hạn nên tải cao có thể sinh vô số task, và không được dùng service scoped của request bên trong. Với event phụ tôi chấp nhận; cần chắc chắn thì dùng hàng đợi bền.
- **"Dùng `Task.WhenAll` với một `DbContext` chung có sao không?"** Có. `DbContext` không thread-safe, EF Core ném exception khi có hai thao tác song song. Mỗi tác vụ cần context riêng qua `IDbContextFactory`, hoặc chạy tuần tự.
- **"Nếu async không làm request nhanh hơn thì dùng để làm gì?"** Để thread không bị giữ khi chờ I/O, nhờ đó cùng số thread phục vụ được nhiều request hơn và hệ thống không sụp lúc cao điểm. Muốn nhanh hơn thì phải chạy song song các I/O độc lập hoặc bớt I/O.
#### Bẫy cần tránh

- Nói "async làm code chạy nhanh hơn".
- Nói `.Result` gây deadlock trong ASP.NET Core; nó gây chặn thread và starvation, deadlock là chuyện của môi trường có `SynchronizationContext`.
- Trình bày `Task.Run` trong controller như giải pháp tốt mà không nêu rủi ro.

#### Nhớ nhanh

- await trả thread về pool khi chờ I/O: tăng số request đồng thời, không tăng tốc từng request.
- Sync-over-async gây starvation: timeout hàng loạt, CPU thấp; đo bằng `dotnet-counters`.
- `async void` chỉ cho event handler.
- Fire-and-forget: `Channel<T>` có giới hạn cộng `BackgroundService`; cần bền thì dùng hàng đợi.

#### Bài tập

1. Viết endpoint `/sync` gọi `Task.Delay(200).Wait()` và `/async` gọi `await Task.Delay(200)`. Bắn 200 request đồng thời vào từng endpoint, theo dõi `dotnet-counters`.
   **Đáp án:** `/sync` có `ThreadPool Queue Length` tăng, latency lên hàng giây, số thread tăng dần; `/async` giữ latency khoảng 200 ms với rất ít thread.
### Bài 9.4. LINQ, EF Core, Dapper và stored procedure

#### Kiến thức

##### Deferred execution, `IQueryable` và `IEnumerable`

Phần lớn toán tử LINQ là **deferred**: câu truy vấn chỉ chạy khi bị liệt kê (`foreach`, `ToList`, `Count`, `First`). Liệt kê hai lần là chạy hai lần.

- `IEnumerable<T>` nhận delegate và chạy **trong bộ nhớ**.
- `IQueryable<T>` nhận **expression tree**; provider (EF Core) dịch nó thành SQL.

```csharp
// Sai: AsEnumerable kéo toàn bộ bảng về rồi mới lọc trong bộ nhớ
var bad = db.Results.AsEnumerable().Where(r => r.UserId == userId).ToList();
// Đúng: điều kiện được dịch thành WHERE trong SQL
var good = await db.Results.Where(r => r.UserId == userId).ToListAsync(ct);
```

.NET 10 thêm toán tử `LeftJoin` và `RightJoin`, EF Core 10 dịch thành `LEFT JOIN`, thay cho cách viết `GroupJoin` cộng `DefaultIfEmpty` dài dòng.

##### N+1 không chỉ là chuyện của ORM

N+1 là một truy vấn lấy danh sách rồi N truy vấn cho từng phần tử. Với ORM, nguyên nhân thường là lazy loading hoặc truy vấn trong vòng lặp; sửa bằng projection (`Select` đúng cột cần), `Include` (kèm `AsSplitQuery()` khi include nhiều collection), hoặc gom ID truy vấn một lần. Nhưng N+1 cũng xuất hiện khi gọi stored procedure trong vòng lặp, hoặc khi nhiều hàm con cùng tự đọc lại một danh mục. Cách phát hiện giống nhau: đếm số câu SQL mỗi request trên APM hoặc log.

##### EF Core cần nắm

- **Change tracking:** context nhớ entity đã đọc để `SaveChanges` sinh `UPDATE`. Truy vấn chỉ đọc dùng `AsNoTracking()` để bớt bộ nhớ và CPU.
- **Cập nhật hàng loạt:** `ExecuteUpdateAsync`, `ExecuteDeleteAsync` (EF Core 7 trở lên) chạy một câu SQL, không nạp entity.
- **Concurrency:** cột `rowversion` làm concurrency token; `SaveChanges` ném `DbUpdateConcurrencyException` khi có người sửa trước.
- **SQL tay:** `FromSql($"... {param}")` tự tham số hóa; `FromSqlRaw` với chuỗi ghép là lỗ SQL injection.
- **Migration:** schema nằm trong code, có version; với DB do DBA quản lý thì thường chỉ sinh script để review.

##### Dapper và gọi stored procedure

Dapper là micro-ORM: bạn viết SQL hoặc tên procedure, Dapper map kết quả vào object, gần như nhanh bằng ADO.NET thuần. Muốn truyền nhiều dòng vào procedure trong một lần gọi thì dùng table-valued parameter:

```csharp
var dt = new DataTable();
dt.Columns.Add("QuestionId", typeof(long));
foreach (var id in selectedIds) dt.Rows.Add(id);

var rows = await conn.QueryAsync<AttemptRow>(
    "dbo.usp_Attempt_Create",
    new { UserId = userId, Questions = dt.AsTableValuedParameter("dbo.QuestionIdList") },
    commandType: CommandType.StoredProcedure);
```

Chọn thế nào: EF Core cho năng suất khi domain phức tạp, nhiều ghi; Dapper khi cần SQL tối ưu tay trên đường nóng; ADO.NET cộng stored procedure khi team có DBA và logic set-based nằm ở DB.

#### Cách show off

Dự án hiện tại không dùng EF Core, nên đừng dựng chuyện EF. Nói thẳng mô hình thật (mọi truy cập DB qua stored procedure), rồi chứng minh hiểu khái niệm chung bằng một lần khử N+1 thật ở tầng gọi procedure trong API tra cứu chứng chỉ.

> **Ví dụ:** "Ở dự án hiện tại, mọi truy cập DB đi qua stored procedure, nên tôi không có câu chuyện EF Core ở đó; EF Core tôi nói ở mức hiểu cơ chế. Nhưng N+1 thì tôi gặp thật, chỉ là ở tầng gọi procedure. API tra cứu chứng chỉ trả danh sách, và với mỗi dòng code lại gọi procedure lấy tên tỉnh, tên xã, tên trường. Tôi tách thành hai lớp: danh mục địa giới và trường được cache 24 giờ vì gần như không đổi trong ngày, còn trong một request thì có một dictionary ghi nhớ để cùng một mã chỉ tra một lần. Bài học của tôi là N+1 là vấn đề của cách gọi dữ liệu, không phải của riêng ORM."

Điểm ăn điểm:
- Trung thực về công cụ dự án dùng, rồi chuyển sang khái niệm chung mình làm thật.
- Nêu được đánh đổi của stored procedure: nhanh, set-based, DBA kiểm soát; đổi lại khó unit test và khó version nếu không quản script trong git.
- Biết cách đếm số truy vấn mỗi request để phát hiện N+1 thay vì đoán.

> **Mẹo:** Nếu bạn từng dùng EF Core hay Dapper ở dự án trước, kể ngắn một lần dùng thật: [điền: dự án và việc đã làm với EF Core/Dapper, nếu có]. Nếu chưa, giữ nguyên cách nói "tôi hiểu cơ chế" ở trên.

#### Câu hỏi vặn

- **"Kể một lần anh dùng EF Core hoặc Dapper?"** Dự án hiện tại truy cập DB hoàn toàn qua stored procedure nên tôi không có câu chuyện EF Core ở đó. Phần khái niệm như N+1 thì tôi đã xử lý ở tầng gọi procedure trong API chứng chỉ. EF Core tôi nói ở mức hiểu cơ chế: change tracking, `AsNoTracking`, `ExecuteUpdate`.
- **"`IQueryable` khác `IEnumerable` thế nào?"** `IQueryable` giữ expression tree để provider dịch sang SQL, lọc ở DB. `IEnumerable` chạy delegate trong bộ nhớ. Gọi `AsEnumerable()` hay `ToList()` quá sớm là kéo cả bảng về rồi mới lọc.
- **"N+1 sửa thế nào trong EF Core?"** Projection `Select` đúng cột, `Include` kèm `AsSplitQuery` nếu nhiều collection, hoặc gom ID truy vấn một lần. Bật `LogTo` hoặc xem APM để đếm số câu SQL mỗi request trước và sau khi sửa.
- **"Cache danh mục 24 giờ, nếu danh mục đổi trong ngày thì sao?"** Danh mục địa giới và trường gần như không đổi trong ngày; khi đổi thì có thể xóa key chủ động từ phía quản trị. Dictionary trong request thì sống theo request nên không có vấn đề dữ liệu cũ.
- **"Để logic trong stored procedure có nhược điểm gì?"** Khó unit test, khó review và version nếu script không nằm trong git, và logic bị chia giữa C# và SQL. Đổi lại xử lý set-based cạnh dữ liệu, ít round-trip, DBA tối ưu được. Bù nhược điểm bằng script đánh số trong git và integration test trên SQL thật.

#### Bẫy cần tránh

- Bịa câu chuyện EF Core khi dự án không dùng.
- Nghĩ N+1 chỉ có ở ORM.
- Gọi `ToList()` sớm rồi lọc trong bộ nhớ mà vẫn nghĩ "LINQ lo hết".

#### Nhớ nhanh

- LINQ deferred: liệt kê mới chạy, liệt kê hai lần là chạy hai lần.
- `IQueryable` lọc ở DB, `IEnumerable` lọc trong bộ nhớ.
- N+1 có ở cả ORM lẫn tầng gọi procedure; sửa bằng gom truy vấn hoặc cache có chủ đích.
- EF Core cho năng suất, Dapper cho kiểm soát SQL, stored procedure cho xử lý set-based cạnh dữ liệu.

#### Bài tập

1. Dựng SQL Server bằng Docker, tạo hai bảng `Exam` và `Question` (1–n) với EF Core. Viết vòng lặp truy cập `exam.Questions` với lazy loading bật, đếm câu SQL qua `optionsBuilder.LogTo(Console.WriteLine)`. Sửa bằng `Include` và bằng projection.
   **Đáp án:** Lazy loading sinh 1 + N câu; `Include` còn 1 câu có JOIN; projection chỉ lấy đúng cột cần nên payload nhỏ nhất.
## Chương 10. Kiến trúc phần mềm

Chương này đi qua microservices, event-driven, DDD, Clean Architecture, SOLID và design pattern. Người phỏng vấn senior hiếm khi hỏi định nghĩa suông. Họ hỏi "vì sao chọn", "cái giá là gì", "anh đã thấy nó hỏng ở đâu". Vì vậy mỗi khái niệm trong chương đều đi kèm đánh đổi.

Đây cũng là chương dễ lộ nhất nếu nói quá kinh nghiệm, DDD là ví dụ điển hình. Học xong, bạn nói chắc kiến thức ở mức thiết kế, và tách bạch rõ đâu là việc đã làm thật, đâu là cách mình sẽ làm.

### Bài 10.1. Microservices và kiến trúc hướng sự kiện

#### Kiến thức

##### Microservices: được gì, mất gì

Microservice là service nhỏ, **deploy độc lập**, **sở hữu dữ liệu riêng**, và giao tiếp với service khác qua API hoặc event. Ranh giới nên đi theo năng lực nghiệp vụ (bounded context), không theo bảng.

| Được | Mất |
|---|---|
| Deploy và scale từng phần | Vận hành nhiều thứ hơn: CI, monitoring, cấu hình cho từng service |
| Team sở hữu rõ ràng | Không còn transaction ACID giữa các service |
| Lỗi cô lập được nếu thiết kế đúng | Debug phân tán, cần tracing |
| Chọn công nghệ theo nhu cầu | Độ trễ và lỗi mạng trở thành chuyện thường |

**Distributed monolith** là khi đã tách service nhưng vẫn phải deploy cùng nhau, dùng chung DB, hoặc một request đi qua chuỗi gọi đồng bộ dài. Phép tính đơn giản: 5 service gọi nối tiếp, mỗi cái sẵn sàng 99,9%, thì cả chuỗi chỉ còn khoảng 0,999^5 ≈ 99,5%. Độ trễ đuôi cũng cộng dồn theo chuỗi.

Khi nào chưa nên tách: team nhỏ, ranh giới domain chưa rõ, chưa có CI/CD và observability. **Modular monolith** (một lần deploy, module tách bạch, mỗi module một schema) thường là bước đầu hợp lý và tách sau vẫn được.

##### Event-driven

- **Command** là yêu cầu làm một việc, gửi cho một nơi nhận xác định ("trừ lượt thi").
- **Event** là việc đã xảy ra, ai quan tâm thì nghe ("bài thi đã kết thúc"); bên phát không biết bên nghe.
- **Event notification:** event chỉ mang ID, bên nghe gọi ngược lại để lấy dữ liệu. Gọn nhưng tạo lại phụ thuộc đồng bộ.
- **Event-carried state transfer:** event mang đủ dữ liệu, bên nghe tự giữ bản sao. Độc lập hơn, đổi lại dữ liệu trùng lặp và trễ.

Event-driven giảm phụ thuộc trực tiếp và hấp thụ được tải đột biến vì hàng đợi làm bộ đệm. Cái giá: luồng nghiệp vụ khó lần vết hơn, phải chấp nhận eventual consistency, và consumer phải idempotent vì message có thể đến nhiều lần (Bài 12.4).

##### Khung trả lời câu hỏi thiết kế hệ thống

1. Hỏi rõ yêu cầu chức năng và phi chức năng (tải, độ trễ, mức nhất quán).
2. Ước lượng tải bằng con số (QPS đọc, ghi, dung lượng).
3. API và mô hình dữ liệu.
4. Kiến trúc tổng thể.
5. Đào sâu 2–3 điểm nghẽn.
6. Cách hệ thống hỏng, đánh đổi, cách quan sát.

#### Cách show off

Người phỏng vấn muốn biết bạn hiểu chỗ đau của microservices, không phải bạn đếm được bao nhiêu service. Câu chuyện tốt nhất là một lần xử lý **ranh giới sở hữu dữ liệu**: ở hệ luyện thi, database tách theo vai trò (đề thi, ngân hàng câu hỏi, tích hợp, log), và bạn viết lại engine tạo lượt làm bài để bỏ hơn chục procedure join chéo database.

> **Ví dụ:** "Hệ thống tôi làm có khoảng hai chục service, mỗi domain một database. Việc sát nhất với bài toán ranh giới mà tôi làm là viết lại engine tạo lượt làm bài ở hệ luyện thi. Bản cũ có nhiều procedure join thẳng sang database khác, nghĩa là service này đọc trực tiếp dữ liệu của service kia, và muốn tách database sang server khác thì phải dựng linked server. Tôi đổi sang cách để C# đọc từ từng database qua procedure của chính nó, gom dữ liệu lại, rồi ghi đúng một lần trong một transaction. Đánh đổi là nhiều round-trip hơn, nhưng các lần đọc độc lập chạy song song được, và ranh giới sở hữu dữ liệu rõ ràng. Bài học tôi rút ra là tách service mà vẫn join chéo DB thì chỉ là monolith phân tán."

Điểm ăn điểm:
- Nói được dấu hiệu của distributed monolith và phép nhân availability, cho thấy bạn nghĩ về cách hệ thống hỏng.
- Phân biệt event với command, notification với state transfer.
- Với luồng Kafka, nói rõ phần của mình và chủ động nhắc điểm yếu đang biết (consumer bật auto-commit, Bài 12.1).

#### Câu hỏi vặn

- **"Nhiều round-trip hơn join chéo, có chậm hơn không?"** Có thêm vài lần gọi, nhưng các lần đọc độc lập chạy song song được, nên tổng thời gian gần bằng lần đọc chậm nhất. Đổi lại mỗi database chỉ được đọc qua procedure của chính nó, và tách sang server khác không cần linked server.
- **"Khi nào không nên tách microservice?"** Team nhỏ, ranh giới domain chưa ổn định, chưa có CI/CD và tracing. Khi đó modular monolith rẻ hơn, và tách sau vẫn được nếu module đã tách bạch dữ liệu.
- **"Event notification và event-carried state transfer khác nhau thế nào?"** Notification chỉ mang ID, bên nghe phải gọi lại lấy dữ liệu nên vẫn phụ thuộc đồng bộ. State transfer mang đủ dữ liệu, bên nghe tự giữ bản sao, độc lập hơn nhưng dữ liệu trễ và trùng lặp.
- **"Luồng Kafka kết thúc game, phần nào là của anh?"** Consumer do đồng nghiệp viết. Tôi nắm luồng (API publish theo loại thi, worker kiểm tra rồi mới ghi để không trùng), và tôi nâng worker lên .NET 10. Tôi cũng chỉ ra rủi ro auto-commit của consumer đó.
- **"Một request đi qua 4 service đồng bộ, mỗi cái 99,95%. Cả chuỗi bao nhiêu, làm gì để giảm rủi ro?"** Khoảng 0,9995^4 ≈ 99,8%, và độ trễ đuôi cộng dồn. Giảm bằng cách gọi song song phần độc lập, chuyển phần không cần kết quả ngay sang event, thêm cache hoặc fallback.

#### Bẫy cần tránh

- Mở đầu bằng "hệ thống có hơn 20 service" như thành tích; số service không phải là điểm, cách xử lý ranh giới mới là điểm.
- Nói microservices là mặc định đúng. Senior luôn nói được khi nào không nên tách.
- Nhận luồng Kafka là của mình khi consumer do người khác viết.

#### Nhớ nhanh

- Microservice: deploy độc lập, dữ liệu riêng; cái giá là vận hành và nhất quán.
- Chuỗi gọi đồng bộ nhân availability và cộng dồn độ trễ đuôi.
- Event khác command; state transfer giảm phụ thuộc nhưng dữ liệu trễ.
- Thiết kế hệ thống: yêu cầu, ước lượng, thiết kế, điểm nghẽn, cách hỏng, quan sát.

#### Bài tập

1. Vẽ sơ đồ service cho một nền tảng thi trực tuyến (đăng ký, đề thi, làm bài, chấm, bảng xếp hạng, thông báo). Với mỗi service ghi dữ liệu nó sở hữu và event nó phát.
   **Đáp án:** Ví dụ: Làm bài sở hữu attempt, phát `AttemptSubmitted`; Chấm nghe event đó, phát `AttemptGraded`; Bảng xếp hạng và Thông báo nghe `AttemptGraded`. Không service nào đọc trực tiếp DB của service khác.

### Bài 10.2. DDD và Clean Architecture

#### Kiến thức

##### DDD chiến lược: chia ranh giới

- **Bounded context:** ranh giới trong đó một mô hình và bộ thuật ngữ có nghĩa nhất quán. "Bài thi" trong context Làm bài (attempt, đáp án, thời gian) khác "bài thi" trong context Ngân hàng đề (ma trận, độ khó).
- **Ubiquitous language:** dev và nghiệp vụ dùng cùng thuật ngữ, và thuật ngữ đó xuất hiện trong code.
- **Context map:** quan hệ giữa các context (upstream/downstream, shared kernel, customer/supplier).
- **Anti-corruption layer (ACL):** lớp dịch giữa mô hình của mình và mô hình của hệ khác, thường là hệ cũ, để khái niệm lộn xộn bên kia không tràn vào.

##### DDD chiến thuật: giữ bất biến

- **Entity:** có định danh, sống qua thời gian (Attempt).
- **Value object:** định nghĩa bằng giá trị, bất biến (Score, TimeWindow); trong C# hợp với `record`.
- **Aggregate:** cụm đối tượng có một **aggregate root** giữ bất biến; bên ngoài chỉ sửa qua root. Quy tắc: aggregate nhỏ, tham chiếu aggregate khác bằng ID, mỗi transaction chỉ sửa một aggregate.
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
}
```

DDD đáng giá khi domain phức tạp và thay đổi nhiều. Với CRUD đơn giản, nó chỉ thêm nghi thức.

##### Clean Architecture

Code chia thành vòng: **Domain** (entity, quy tắc) ở trong cùng, **Application** (use case), rồi **Infrastructure** (DB, Redis, Kafka) và **Web** ở ngoài. Quy tắc phụ thuộc: chỉ được phụ thuộc hướng vào trong. Domain không biết DB hay HTTP; interface như `IAttemptRepository` khai báo ở Application, Infrastructure implement, DI nối lại.

Được: logic nghiệp vụ test được không cần DB, đổi hạ tầng ít ảnh hưởng. Mất: nhiều project, nhiều lớp mapping, dễ thành "lasagna" cho tính năng đơn giản. **Vertical slice** (mỗi tính năng một thư mục từ endpoint tới DB) là phương án thay thế hay được nhắc.

#### Cách show off

Ở chủ đề này trung thực quan trọng hơn mọi thứ. Hệ thống bạn làm để logic ở tầng proxy và stored procedure, không phải DDD. Nói thẳng điều đó, nêu đánh đổi của kiến trúc thực tế, rồi áp DDD lên chính domain thi cử mà bạn rành.

> **Ví dụ:** "Tôi chưa có dự án áp dụng DDD đầy đủ để kể. Hệ thống thi tôi làm để logic ở tầng proxy và phần lớn xử lý theo tập hợp nằm trong stored procedure; cách đó nhanh vì xử lý sát dữ liệu, nhưng khó unit test và logic bị chia giữa C# và SQL. Nếu thiết kế lại phần thi theo DDD, tôi sẽ tách các context Làm bài, Ngân hàng đề, Chấm và Xếp hạng, vì cùng chữ 'bài thi' nhưng mỗi bên hiểu một kiểu. Trong context Làm bài, Attempt là aggregate root giữ hai bất biến: chỉ nộp một lần và nộp trong hạn. Hiện các bất biến đó được giữ ở DB bằng khóa và kiểm tra trong procedure, nên tôi hiểu rõ chúng quan trọng thế nào."

Điểm ăn điểm:
- Nói "chưa làm" ngay câu đầu, rồi đi thẳng vào thiết kế cụ thể trên domain quen thuộc; người nghe thấy bạn hiểu chứ không học thuộc.
- Giải thích vì sao aggregate nên nhỏ bằng hậu quả thật: transaction giữ khóa trên nhiều dữ liệu, tăng xung đột.
- Nêu được cái giá của Clean Architecture, không tôn nó thành chân lý.

#### Câu hỏi vặn

- **"Kể một lần anh dùng DDD?"** Tôi chưa có dự án áp dụng DDD đầy đủ để chứng minh. Hệ thống hiện tại để logic ở tầng proxy và stored procedure. Nếu thiết kế lại phần thi, tôi tách context Làm bài, Ngân hàng đề, Chấm, Xếp hạng, với Attempt là aggregate root giữ bất biến "chỉ nộp một lần" và "nộp trong hạn".
- **"Aggregate là gì, vì sao nên nhỏ?"** Là cụm đối tượng có một root giữ bất biến, sửa trong một transaction. Aggregate lớn làm transaction giữ khóa trên nhiều dữ liệu, tăng xung đột; nên tham chiếu aggregate khác bằng ID và đồng bộ qua domain event.
- **"Clean Architecture có nhược điểm gì?"** Nhiều project, interface và mapping cho cả tính năng đơn giản; người mới khó lần luồng. Với service nhỏ, vertical slice hoặc cấu trúc phẳng thường đủ.
- **"Logic trong stored procedure có trái Clean Architecture không?"** Có, theo nghĩa domain phụ thuộc DB. Đổi lại xử lý set-based cạnh dữ liệu nhanh và ít round-trip. Cái giá là khó unit test và khó version; bù bằng script đánh số trong git và integration test trên SQL thật.
- **"Vậy sao anh không đề xuất chuyển hệ thống sang DDD?"** Vì chi phí chuyển lớn và lợi ích chưa rõ với phần lớn tính năng CRUD. Tôi sẽ chỉ áp DDD cho phần domain phức tạp, thay đổi nhiều, ví dụ luật làm bài và chấm, và đo được lợi ích trước khi mở rộng.

#### Bẫy cần tránh

- Gật đầu "có dùng DDD" vì dự án có thư mục `Domain`. Một câu hỏi tiếp về aggregate là lộ.
- Coi DDD là tập pattern chiến thuật (entity, repository) mà bỏ qua phần chiến lược (bounded context).
- Chê kiến trúc hiện tại của công ty; nói đánh đổi của nó một cách công bằng.

#### Nhớ nhanh

- Bounded context là ranh giới nghĩa của mô hình; chia service theo nó, không theo bảng.
- Aggregate root giữ bất biến; aggregate nhỏ, tham chiếu nhau bằng ID.
- Clean Architecture: phụ thuộc hướng vào trong; đổi lại nhiều lớp.
- Chưa làm DDD thật: nói ở mức thiết kế, không nhận là đã làm.

#### Bài tập

1. Viết aggregate `Attempt` với hai bất biến (chỉ nộp một lần, nộp trong hạn có ân hạn 30 giây) và 4 unit test xUnit dùng `[Theory]`.
   **Đáp án:** Test: nộp trong hạn thành công; nộp lần hai ném lỗi; nộp ở giây thứ 20 sau hạn thành công; nộp ở giây thứ 31 ném lỗi. Truyền `now` vào hàm (hoặc `TimeProvider`) để test không phụ thuộc giờ thật.
### Bài 10.3. SOLID và design pattern trong code thật

#### Kiến thức

##### SOLID bằng ví dụ

- **S (Single responsibility):** một module chỉ có một lý do để thay đổi. Service vừa tính quota vừa gửi email thì đổi template email cũng phải test lại phần quota.
- **O (Open/closed):** thêm hành vi bằng code mới, không sửa code đang chạy; ví dụ thêm loại bảng xếp hạng bằng một class mới.
- **L (Liskov substitution):** lớp con thay được cho lớp cha mà không đổi tính đúng. Lớp con ném `NotSupportedException` cho một method của cha là dấu hiệu vi phạm.
- **I (Interface segregation):** interface nhỏ theo nhu cầu của client; không bắt client phụ thuộc method nó không dùng.
- **D (Dependency inversion):** module cấp cao phụ thuộc abstraction, không phụ thuộc chi tiết; inject qua DI.

##### Pattern hay gặp trong backend

- **Template method:** lớp cha định nghĩa khung thuật toán, lớp con điền bước khác nhau.
- **Strategy:** thuật toán là một object inject vào, đổi được lúc chạy. Khác template method ở chỗ dùng composition thay vì kế thừa.
- **Decorator:** bọc một implementation bằng lớp cùng interface để thêm hành vi (cache, log, retry).
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
```

Decorator hay gặp nhất là cache: `CachedCatalog : ICatalog` nhận `ICatalog inner` (bản đọc DB thật), đọc cache trước, miss thì gọi `inner` rồi ghi cache. Đăng ký trong DI bằng factory để `ICatalog` trả về bản bọc. Bẫy của decorator cache trong bộ nhớ: object trả từ `MemoryCache` là instance dùng chung, caller nào sửa nó là hỏng dữ liệu của request khác. Cache phân tán như Redis thì mỗi lần deserialize ra object mới nên không gặp lỗi này.

#### Cách show off

Ai cũng đọc được định nghĩa SOLID, nên điểm nằm ở ví dụ thật: trước đó code thế nào, đau ở đâu, đổi sang gì. Bạn có hai ví dụ: thay HTTP helper static bằng `IHttpClient` inject qua DI kèm shim khi nâng .NET 10 (D và adapter, phần bạn làm), và rank provider theo template method ở bảng xếp hạng (phần tính hạng bằng SQL job không phải của bạn).

> **Ví dụ:** "Ví dụ SOLID rõ nhất của tôi đến từ đợt nâng khoảng 70 project lên .NET 10. Code cũ gọi HTTP qua các helper static, nên không thay được implementation và không fake được khi test. Tôi thay bằng một interface inject qua DI, và viết thêm một lớp shim giữ nguyên chữ ký cũ, để code nghiệp vụ không phải sửa trong cùng đợt nâng cấp. Đó là dependency inversion cộng adapter, và lý do chọn shim là giảm rủi ro: đổi nền tảng và đổi logic trong cùng một lần thì rất khó biết lỗi đến từ đâu. Một ví dụ khác là bảng xếp hạng: mỗi loại thi có một rank provider theo template method, thêm loại thi mới là thêm một class."

Điểm ăn điểm:
- Nói lý do chọn pattern (giảm rủi ro khi nâng cấp), không chỉ tên pattern.
- Phân biệt template method (kế thừa, cố định lúc compile) với strategy (composition, đổi lúc chạy) và nói khi nào chuyển.
- Biết khi nào SOLID bị lạm dụng: interface chỉ có một implementation ở khắp nơi, đọc một luồng phải mở mười file.

#### Câu hỏi vặn

- **"Shim đó là của anh viết hay có sẵn?"** Trong đợt nâng .NET 10, việc thay HTTP helper static bằng interface inject qua DI và lớp shim tương thích là phần tôi làm. Mục tiêu là đổi nền tảng mà không đụng logic nghiệp vụ.
- **"Template method khác strategy thế nào?"** Template method dùng kế thừa, khung cố định lúc compile. Strategy inject một object, đổi được lúc chạy và test riêng dễ hơn. Khi phần khác nhau giữa các loại thi lớn hơn một tên procedure, tôi sẽ chuyển sang strategy, chọn theo key bằng keyed services.
- **"Decorator cache quanh repository có rủi ro gì?"** Dữ liệu cũ tới khi hết TTL, cache stampede khi key hết hạn, và với cache trong bộ nhớ thì caller sửa object dùng chung. Cần TTL hợp lý, đường xóa cache khi dữ liệu đổi, và trả bản sao hoặc object bất biến.
- **"Khi nào SOLID bị lạm dụng?"** Khi class nào cũng có interface dù chỉ một implementation, hoặc tách nhỏ tới mức đọc một luồng phải mở mười file. Tôi áp dụng khi có lý do thay đổi thật hoặc nhu cầu test thật.
- **"Ví dụ vi phạm Liskov mà anh hay gặp?"** Lớp con override rồi ném `NotSupportedException`, hoặc thêm điều kiện chặt hơn lớp cha khiến code dùng lớp cha bị lỗi khi nhận lớp con. Thường đó là dấu hiệu interface quá to, cần tách theo nguyên tắc I.

#### Bẫy cần tránh

- Đọc định nghĩa năm chữ cái mà không có ví dụ nào từ code mình viết.
- Nói "tôi luôn tạo interface cho mọi class" như một điểm cộng.
- Nhận phần tính hạng bằng SQL job là của mình.

#### Nhớ nhanh

- S và D là hai nguyên tắc hay bị hỏi nhất; chuẩn bị ví dụ cụ thể.
- Template method dùng kế thừa, strategy dùng composition.
- Decorator thêm cache hoặc log mà không sửa class gốc; cẩn thận object dùng chung trong cache bộ nhớ.
- Ví dụ thật: interface thay HTTP helper static khi nâng .NET 10, rank provider theo template method.

#### Bài tập

1. Viết class static `HttpHelper.GetJson(url)` và một service dùng nó. Refactor sang `IHttpClient` inject qua DI, viết unit test với fake.
   **Đáp án:** Tạo `interface IHttpClient { Task<T?> GetJsonAsync<T>(string url, CancellationToken ct); }`, implementation bọc `HttpClient` từ `IHttpClientFactory`; test dùng fake trả dữ liệu cố định, không cần mạng.
## Chương 11. Cơ sở dữ liệu

Chương này đi qua T-SQL và stored procedure, query plan và index, khóa và isolation, PostgreSQL, MongoDB, Redis và kho cột ClickHouse. SQL Server là mảng bạn có nhiều trải nghiệm thật nhất, nên Bài 11.1 chỉ là nền; phần tối ưu chi tiết nằm ở Phần VI.

Các hệ còn lại bạn có mức trải nghiệm khác nhau: PostgreSQL và MongoDB đã dùng ở dự án trước, Redis có cả phần tự sửa lẫn phần dùng lại của đồng nghiệp, còn ClickHouse thì chưa vận hành thật. Mỗi bài dạy cơ chế trước, rồi chỉ cách nói đúng tới đâu.

### Bài 11.1. T-SQL, stored procedure, query plan và index

#### Kiến thức

##### Viết theo tập hợp

SQL Server tối ưu cho xử lý **set-based**: một câu lệnh trên cả tập dòng. Vòng `WHILE` hay cursor xử lý từng dòng (hay bị gọi đùa là RBAR, "row by agonizing row") tốn một lần tìm kiếm và một lần ghi log cho mỗi vòng. Khung procedure chuẩn:

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

- **Table-valued parameter (TVP):** truyền nhiều dòng vào procedure trong một lần gọi qua user-defined table type, thay cho gọi N lần hoặc ghép chuỗi rồi `STRING_SPLIT`.
- **Parameter sniffing:** plan được compile theo giá trị tham số của lần chạy đầu rồi dùng lại. Dữ liệu lệch (user này 10 dòng, user kia 1 triệu dòng) thì plan tốt cho giá trị này có thể rất tệ cho giá trị kia. Xử lý theo mức: `OPTION (RECOMPILE)` cho câu chạy ít, `OPTIMIZE FOR`, tách procedure con theo nhánh, hoặc ép plan qua Query Store.

##### Đọc plan và thiết kế index

- **Seek** đi thẳng tới vùng dữ liệu theo key; **scan** đọc cả index hoặc bảng.
- **Key lookup:** seek trên nonclustered index rồi quay về clustered index lấy cột thiếu, mỗi dòng một lần. Nhiều dòng thì lookup còn đắt hơn scan.
- **Covering index:** đưa cột cần đọc vào `INCLUDE` để bỏ lookup. Đánh đổi: index to hơn, ghi chậm hơn.
- **Leftmost prefix:** index `(A, B, C)` seek được khi lọc theo `A`, `A,B`, `A,B,C`; lọc `A, C` thì chỉ seek theo `A` rồi lọc phần còn lại.
- **Sargable:** điều kiện dùng được index. `WHERE YEAR(CreatedAt) = 2026` không sargable; viết lại thành `CreatedAt >= '2026-01-01' AND CreatedAt < '2027-01-01'`.

Đo một câu lệnh bằng `SET STATISTICS IO, TIME ON` và actual plan; đo toàn hệ thống bằng `sys.dm_exec_procedure_stats`, `sys.dm_os_wait_stats`, Query Store. Đơn vị nên dùng khi so trước và sau là **logical reads** (số trang 8 KB đọc từ bộ nhớ), vì nó ít dao động hơn thời gian.

#### Cách show off

SQL là thế mạnh của bạn, nên kể theo đúng quy trình của người tối ưu thật: thấy vấn đề ở đâu (APM, DMV), đọc plan thấy gì, sửa gì, đo trước sau bằng logical reads. Ngoài câu chuyện index dưới đây, còn một ca non-sargable: điều kiện `1 = CASE WHEN ... AND ID = @ID THEN 1 END` được tách thành `IF ... ELSE` để nhánh có ID seek thẳng khóa chính; procedure đó do team viết lại, phần của bạn là phân tích và đề xuất.

> **Ví dụ:** "Trong đợt rà soát hiệu năng SQL Server tôi dẫn, tôi đi từ những endpoint chậm trên APM xuống DMV để tìm procedure tốn nhiều đọc nhất. Một ca điển hình là bảng kết quả luyện nói: index xếp theo vòng, rồi đợt mở đề, rồi user, nhưng truy vấn lại lọc theo vòng và user. Vì index chỉ dùng được từ cột trái sang, SQL Server seek theo vòng rồi phải lọc qua hàng triệu dòng, mỗi lần đọc hàng chục nghìn trang. Database luyện viết có bảng gần giống nhưng index đúng thứ tự, chỉ đọc vài chục trang, nên tôi có sẵn một phép so sánh rất thuyết phục. Tôi đưa index mới vào kế hoạch chạy ca đêm, vì bản Standard không tạo index online được."

Điểm ăn điểm:
- So bằng logical reads chứ không bằng cảm giác, và có đối chứng (database tương tự có index đúng).
- Biết ràng buộc vận hành: bản Standard không có `ONLINE = ON` và cũng không tạo index song song, nên index trên bảng lớn phải làm ngoài giờ cao điểm.
- Nói đúng vai: dẫn phân tích, đề xuất; procedure do team viết lại thì nói "team sửa theo đề xuất".

#### Câu hỏi vặn

- **"Index đó đã tạo chưa, kết quả sau khi tạo là bao nhiêu?"** Tôi nói theo trạng thái thực tế: [điền: index luyện nói đã tạo trên production chưa, số reads sau khi tạo]. Nếu chưa, tôi nói đó là đề xuất trong kế hoạch, với con số đối chứng từ database luyện viết.
- **"Parameter sniffing là gì, xử lý thế nào?"** Plan compile theo giá trị tham số lần đầu rồi dùng lại cho mọi giá trị; dữ liệu lệch thì plan sai cho một nhóm giá trị. Xử lý theo mức: `OPTION (RECOMPILE)` cho câu chạy ít, `OPTIMIZE FOR`, tách procedure con theo nhánh, hoặc ép plan qua Query Store.
- **"Khi nào không nên thêm `INCLUDE` cho covering index?"** Khi bảng ghi nhiều như log hay kết quả trong ca thi: mỗi index thêm là thêm ghi, thêm page split và thêm chờ ghi log. Phải cân tần suất đọc với chi phí ghi.
- **"Procedure sửa `CASE` thành `IF ... ELSE` là anh viết à?"** Tôi phân tích plan, chỉ ra điều kiện không sargable và đề xuất tách nhánh; procedure đó không nằm trong git và được team viết lại. Tôi không nhận phần code.
- **"Sao không cứ thêm index cho mọi truy vấn chậm?"** Mỗi index tốn chỗ, làm chậm ghi và tăng thời gian bảo trì. Tôi ưu tiên sửa truy vấn cho sargable trước, rồi mới thêm index, và xem index nào thừa hoặc trùng có thể gộp.

#### Bẫy cần tránh

- Kể "giảm từ X xuống Y" mà không nói đo bằng gì (logical reads, thời gian CPU, trên bao nhiêu lần chạy).
- Nhận procedure của team là của mình.
- Quên ràng buộc bản Standard khi nói chuyện tạo index trên bảng lớn.

#### Nhớ nhanh

- Khung procedure: `SET NOCOUNT ON`, `XACT_ABORT ON`, `TRY/CATCH` với `THROW`.
- Set-based thay vòng lặp; TVP thay gọi N lần.
- Plan: seek, scan, key lookup, covering, leftmost prefix, sargable.
- So trước sau bằng logical reads; chi tiết tối ưu ở Phần VI.

#### Bài tập

1. Tạo bảng 1 triệu dòng `(Id, RoundId, ExamOpenId, UserId, Score)` với index `(RoundId, ExamOpenId, UserId)`. Chạy truy vấn lọc `RoundId, UserId` với `SET STATISTICS IO ON`, rồi thêm index `(RoundId, UserId)` và so sánh.
   **Đáp án:** Trước: seek theo `RoundId` rồi lọc `UserId` như residual predicate, logical reads lớn. Sau: seek đủ hai cột, reads giảm hàng trăm lần.
### Bài 11.2. Khóa, isolation level và ghi đồng thời an toàn

#### Kiến thức

##### Các loại khóa

- **S (shared):** đọc. Nhiều S cùng tồn tại được.
- **U (update):** đọc với ý định ghi. Tương thích với S nhưng không tương thích với U khác, nên hai phiên cùng "định ghi" phải xếp hàng. Đây là cách tránh deadlock khi hai phiên cùng nâng S lên X.
- **X (exclusive):** ghi; không tương thích với gì.
- **IS, IX:** intent lock ở cấp cao hơn (page, bảng) báo rằng bên dưới có khóa.
- **Sch-S, Sch-M:** khóa schema. Rebuild index offline giữ Sch-M, chặn mọi truy cập.
- **Lock escalation:** khoảng 5.000 khóa dòng trên một object thì SQL Server thử nâng lên khóa bảng.

##### Isolation level

| Mức | Đọc thấy gì | Cơ chế |
|---|---|---|
| READ UNCOMMITTED (`NOLOCK`) | Có thể đọc dữ liệu chưa commit, sót hoặc lặp dòng | Không giữ S |
| READ COMMITTED (mặc định) | Dữ liệu đã commit | Giữ S trong lúc đọc dòng |
| READ COMMITTED SNAPSHOT (RCSI) | Bản đã commit lúc **bắt đầu câu lệnh** | Row versioning trong tempdb |
| SNAPSHOT | Bản đã commit lúc **bắt đầu transaction** | Row versioning; ghi đụng nhau thì lỗi 3960 |
| REPEATABLE READ | Dòng đã đọc không đổi | Giữ S tới hết transaction |
| SERIALIZABLE (`HOLDLOCK`) | Không có dòng ma | Key-range lock |

**RCSI** làm người đọc không chặn người ghi và ngược lại. Cái giá: version store trong tempdb, mỗi dòng thêm 14 byte, và hành vi đổi: câu đọc thấy bản cũ, nên logic "đọc rồi quyết định ghi" phải tự khóa bằng `UPDLOCK` chứ không dựa vào việc bị chặn.

##### Check-then-insert an toàn

Hai request cùng kiểm tra "chưa có kết quả" rồi cùng insert là race kinh điển.
- Chỉ `HOLDLOCK`: hai phiên cùng lấy được S range lock, rồi cùng xin X để insert, dẫn tới deadlock.
- `UPDLOCK, HOLDLOCK`: phiên thứ hai chờ ngay ở bước kiểm tra, khi được chạy thì thấy dòng đã có. Cần index phù hợp để key-range lock đúng phạm vi.
- **Unique constraint** là hàng rào mạnh nhất nếu được sửa schema.
- **`sp_getapplock`:** khóa theo một tên logic do bạn đặt, kể cả khi chưa có dòng nào. Trả về `>= 0` là thành công; `-1` timeout, `-2` bị hủy, `-3` bị chọn làm deadlock victim.

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

> **Cảnh báo:** Không gọi ra ngoài (linked server, HTTP) trong lúc đang giữ khóa. Mạng chậm bao lâu thì khóa bị giữ bấy lâu.

#### Cách show off

Đây là chỗ thể hiện bạn biết **chọn cơ chế theo ràng buộc**: vấn đề, các phương án, vì sao chọn, cái giá. Câu chuyện thật là ghi kết quả một lần ở sự kiện thi theo chặng "Here I Come". Một phát hiện bổ trợ từ đợt rà soát: procedure cộng trừ vật phẩm gọi linked server ngay trong transaction đang giữ khóa, mạng chậm thì khóa bị giữ tới hàng chục giây, và loại chờ đó chiếm hơn một phần ba thời gian chờ của cả instance.

> **Ví dụ:** "Ở một sự kiện thi theo chặng, mỗi học sinh chỉ được ghi một kết quả cho mỗi vòng, nhưng request nộp bài có thể bị gửi lại do mạng chập chờn. Cách sạch nhất là unique index trên cặp user và vòng, nhưng bảng đó dùng chung cho nhiều sự kiện và yêu cầu đã chốt là không tạo object mới trên nó. Nên tôi dùng `sp_getapplock` theo đúng cặp user và vòng, bên trong vẫn kiểm tra với `UPDLOCK, HOLDLOCK`, và nếu đã có bản ghi thì trả lại bản ghi đó. Applock chỉ xếp hàng các request cùng một học sinh cùng một vòng, nên không ảnh hưởng người khác. Cái giá là tính đúng phụ thuộc vào việc mọi đường ghi đều lấy cùng lock, nên tôi ghi rõ điều đó trong code và tài liệu."

Điểm ăn điểm:
- Nói unique constraint là lựa chọn tốt nhất trước, rồi giải thích vì sao không dùng được. Người nghe thấy bạn biết thứ tự ưu tiên.
- Giải thích vì sao phải `UPDLOCK` chứ không chỉ `HOLDLOCK` (deadlock nâng khóa).
- Nhắc nguyên tắc không gọi ra ngoài khi giữ khóa bằng phát hiện thật trong đợt rà soát.

#### Câu hỏi vặn

- **"Sao không dùng unique index cho xong?"** Đó là hàng rào mạnh nhất và tôi sẽ dùng nếu được sửa schema. Ở sự kiện đó, bảng dùng chung và yêu cầu đã chốt là không tạo object mới trên nó, nên tôi chọn applock theo key nghiệp vụ.
- **"Vì sao check-then-insert cần `UPDLOCK, HOLDLOCK` chứ không chỉ `HOLDLOCK`?"** `HOLDLOCK` giữ S range lock; hai phiên cùng giữ S rồi cùng xin X để insert sẽ deadlock. `UPDLOCK` đổi thành khóa U, không tương thích với U khác, nên phiên thứ hai phải chờ ngay ở bước kiểm tra.
- **"Applock khác khóa dòng thế nào?"** Applock khóa theo tên logic, không cần dòng tồn tại và không phụ thuộc index, chỉ xếp hàng các request cùng key. Khóa dòng với `HOLDLOCK` trên dòng chưa tồn tại phải dựa vào key-range lock, cần index phù hợp mới khóa đúng phạm vi.
- **"RCSI khác SNAPSHOT thế nào?"** RCSI cho mỗi câu lệnh thấy bản đã commit lúc câu lệnh bắt đầu, bật ở cấp DB và áp mặc định cho READ COMMITTED. SNAPSHOT giữ một bản nhất quán cho cả transaction, phải chọn tường minh, và báo lỗi khi hai transaction cùng sửa một dòng.
- **"Phát hiện linked server trong transaction, anh đề xuất sửa thế nào?"** Đưa lời gọi linked server ra khỏi transaction: đọc dữ liệu từ xa trước, rồi mới mở transaction và giữ khóa ngắn nhất có thể. Nếu cần nhất quán giữa hai server thì chuyển sang mô hình bất đồng bộ có đối soát thay vì transaction phân tán.

#### Bẫy cần tránh

- Gọi cách ghi một lần này là "exactly-once"; đúng tên là ghi idempotent.
- Nói bật RCSI là hết chặn mà không nhắc hành vi đọc thay đổi và tải tempdb.
- Dùng `NOLOCK` cho logic quyết định.

#### Nhớ nhanh

- Khóa U tồn tại để tránh deadlock nâng S lên X.
- RCSI: đọc không chặn ghi, nhưng "đọc rồi quyết định ghi" phải tự khóa.
- Check-then-insert: unique constraint nếu được; nếu không thì `UPDLOCK, HOLDLOCK` hoặc applock.
- Không gọi ra ngoài khi đang giữ khóa.

#### Bài tập

1. Viết check-then-insert chỉ dùng `HOLDLOCK`, chạy song song từ hai cửa sổ với `WAITFOR DELAY '00:00:05'` giữa bước kiểm tra và insert.
   **Đáp án:** Một phiên nhận lỗi 1205. Đổi sang `UPDLOCK, HOLDLOCK` thì phiên thứ hai chờ rồi thấy dòng đã có.

### Bài 11.3. PostgreSQL và MongoDB

#### Kiến thức

##### PostgreSQL: MVCC và VACUUM

PostgreSQL lưu **nhiều phiên bản dòng ngay trong bảng**: `UPDATE` tạo tuple mới và đánh dấu tuple cũ hết hiệu lực (qua `xmin`, `xmax`). Người đọc thấy phiên bản hợp với snapshot của mình nên đọc không chặn ghi. Khác SQL Server với RCSI, nơi bản cũ nằm trong tempdb.

Cái giá là tuple chết tích lại (**bloat**). **VACUUM** (thường do autovacuum chạy) thu hồi chỗ để tái dùng và cập nhật visibility map; `VACUUM FULL` viết lại bảng nhưng khóa độc quyền. VACUUM còn **đóng băng** transaction ID cũ để tránh wraparound của bộ đếm 32 bit. Transaction mở quá lâu chặn VACUUM dọn dẹp, nên đó là thứ phải theo dõi.

##### Index và replication

- **B-tree** mặc định; **GIN** cho `jsonb`, mảng, full-text (`WHERE data @> '{"tenant": 5}'`); **BRIN** rất nhỏ, cho bảng append-only có cột tăng theo thời gian; **partial index** (`WHERE status = 'active'`) và **expression index** (`lower(email)`).
- Đọc plan bằng `EXPLAIN (ANALYZE, BUFFERS)`.
- **Streaming replication:** primary gửi WAL sang replica, replica phục vụ đọc. Mặc định bất đồng bộ nên có **replication lag**: user vừa ghi rồi đọc từ replica có thể không thấy dữ liệu của mình (vấn đề read-your-writes). Xử lý: đọc từ primary ngay sau khi ghi, hoặc chờ replica bắt kịp LSN.
- Mỗi connection là một process, nên hệ nhiều connection cần pooler như PgBouncer.

##### MongoDB

- **Document model:** dữ liệu thường đọc cùng nhau thì **nhúng**; dữ liệu lớn dần không giới hạn hoặc dùng chung thì **tham chiếu**. Document tối đa 16 MB.
- **Index ghép theo quy tắc ESR:** trường so sánh bằng (Equality) trước, rồi trường sắp xếp (Sort), rồi trường khoảng (Range).
- **Aggregation pipeline:** chuỗi stage `$match`, `$group`, `$sort`, `$lookup`; đặt `$match` sớm để dùng index.
- **Sharding:** shard key quyết định cả phân bố lẫn định tuyến. Cần cardinality cao, tần suất đều, không tăng đơn điệu (khóa tăng dần dồn ghi vào một shard). Hashed rải đều nhưng truy vấn khoảng phải hỏi mọi shard; ranged hợp truy vấn khoảng nhưng dễ hotspot. Từ 4.4 có **compound hashed shard key** như `{ tenantId: 1, _id: "hashed" }`: truy vấn có `tenantId` đi đúng nhóm shard, tenant lớn vẫn rải đều. Truy vấn thiếu shard key thành **scatter-gather**. Từ 5.0 có reshard trực tuyến.
- **Nhất quán:** write concern `majority`, read preference; transaction nhiều document có từ 4.0 (replica set) và 4.2 (sharded cluster).

```javascript
db.attempts.createIndex({ tenantId: 1, status: 1, submittedAt: -1 });   // E, E, S
db.attempts.find({ tenantId: 5, status: "graded" }).sort({ submittedAt: -1 }).explain("executionStats");
sh.shardCollection("lms.attempts", { tenantId: 1, _id: "hashed" });
```

#### Cách show off

Bạn có trải nghiệm thật ở dự án trước (nền tảng IAS 2.0 tại AvePoint): chuyển truy vấn đọc nặng sang replica PostgreSQL, và dữ liệu MongoDB được shard. Chi tiết "shard theo tenant" và con số cải thiện độ trễ trong tài liệu cũ chỉ là minh họa. Kể cơ chế và bài học thoải mái, không đọc con số minh họa như số đo.

> **Ví dụ:** "Ở dự án trước, chúng tôi có các truy vấn báo cáo nặng chạy chung với phần ghi trên PostgreSQL, làm primary tranh chấp I/O và bộ nhớ đệm. Hướng xử lý là chuyển các truy vấn đọc nặng sang replica bằng streaming replication. Vấn đề phải lường trước là replication lag: người dùng vừa lưu xong mà đọc từ replica thì có thể không thấy thay đổi của mình, nên những màn hình đọc ngay sau khi ghi vẫn đọc từ primary. Mức cải thiện cụ thể tôi không nêu vì không còn số đo để đối chiếu. Với MongoDB, bài học lớn nhất là chọn shard key: chỉ dùng mã khách hàng thì khách hàng lớn tạo hotspot, nên khóa ghép có thêm phần hash rải dữ liệu đều hơn."

Điểm ăn điểm:
- Tự nêu vấn đề read-your-writes khi kể chuyện replica; đây là câu người phỏng vấn định hỏi tiếp.
- So sánh MVCC của PostgreSQL với RCSI của SQL Server, cho thấy bạn hiểu ở mức cơ chế xuyên hệ.
- Chủ động nói không có số đo, thay vì nêu con số không kiểm chứng được.

#### Câu hỏi vặn

- **"Cải thiện được bao nhiêu khi chuyển sang replica?"** Tôi không có số đo còn giữ được để đối chiếu, nên không nêu con số. Điều tôi chắc là primary bớt tranh chấp với truy vấn báo cáo, và chúng tôi phải xử lý read-your-writes.
- **"Shard key thực tế của dự án là gì?"** [điền: shard key thực tế của IAS 2.0 nếu nhớ]. Nếu không nhớ chính xác, tôi nói cách chọn: cardinality cao, phân bố đều, không tăng đơn điệu, và phần lớn truy vấn chứa shard key.
- **"VACUUM để làm gì?"** Thu hồi chỗ của tuple chết do MVCC để tái dùng, cập nhật visibility map cho index-only scan, và đóng băng transaction ID cũ để tránh wraparound. Transaction mở lâu chặn VACUUM nên phải theo dõi.
- **"MVCC của PostgreSQL khác RCSI của SQL Server thế nào?"** PostgreSQL giữ bản cũ ngay trong bảng nên sinh bloat và cần VACUUM. SQL Server với RCSI đẩy bản cũ vào version store trong tempdb, được dọn tự động; cái giá là tải tempdb và 14 byte thêm mỗi dòng.
- **"Truy vấn thiếu shard key thì sao?"** Router phải hỏi mọi shard rồi gộp kết quả (scatter-gather), độ trễ bằng shard chậm nhất và tải nhân theo số shard. Nếu nhóm truy vấn đó quan trọng thì phải xem lại shard key hoặc thêm bản đọc phụ.

#### Bẫy cần tránh

- Đọc con số minh họa trong tài liệu cũ như kết quả đo thật.
- Nói replica "làm mọi thứ nhanh hơn" mà không nhắc lag.
- Chọn shard key tăng dần (thời gian, ObjectId) mà không thấy hotspot.

#### Nhớ nhanh

- PostgreSQL MVCC giữ phiên bản trong bảng; VACUUM là bắt buộc, transaction dài là kẻ thù.
- Replica bất đồng bộ có lag: xử lý read-your-writes.
- MongoDB: index theo ESR; shard key quyết định phân bố và định tuyến.
- Dự án trước: cơ chế thật, con số không có số đo thì không nêu.

#### Bài tập

1. Chạy PostgreSQL bằng Docker, tạo bảng 1 triệu dòng, `UPDATE` toàn bộ hai lần, xem `n_dead_tup` trong `pg_stat_user_tables`, rồi chạy `VACUUM (VERBOSE)`.
   **Đáp án:** `n_dead_tup` khoảng 2 triệu sau hai lần update; sau VACUUM về gần 0 nhưng kích thước file không giảm, chỉ `VACUUM FULL` mới trả dung lượng cho hệ điều hành.
### Bài 11.4. Redis: mô hình thực thi, pattern cache và lock

#### Kiến thức

##### Một luồng thực thi

Redis thực thi lệnh trên **một luồng chính** (từ Redis 6 có I/O thread cho mạng, nhưng lệnh vẫn chạy tuần tự). Mỗi lệnh nguyên tử, và một lệnh chậm chặn mọi client. Hệ quả:
- **`KEYS`** duyệt toàn keyspace trong một lệnh: cấm trên production.
- **`SCAN`** chia nhỏ theo cursor nên không chặn lâu một lần, nhưng tổng chi phí vẫn tỉ lệ với keyspace; gọi nó trên đường nóng là thiết kế sai.
- **`UNLINK`** xóa key lớn ở luồng nền thay vì `DEL` chặn.
- Lua script chạy nguyên khối, nên script phải ngắn.

| Kiểu | Dùng cho |
|---|---|
| String | Cache JSON, counter (`INCR`), lock |
| Hash | Object nhiều field, phiên thi |
| Set | Tập key liên quan (làm index để xóa), tập duy nhất |
| Sorted set | Bảng xếp hạng (`ZADD`, `ZREVRANK`, `ZREVRANGE`) |
| Stream | Log sự kiện nhẹ có consumer group |

Vận hành: **eviction** theo `maxmemory-policy` (mặc định `noeviction`; cache thường dùng `allkeys-lru` hoặc `allkeys-lfu`); **persistence** bằng RDB (snapshot) và AOF (log lệnh). **Redis Cluster** chia 16.384 hash slot, slot = CRC16(key) mod 16384; lệnh nhiều key (`MGET`, Lua) chỉ chạy khi các key cùng slot, dùng **hash tag** `{user:42}:session` để ép cùng slot. Từ 7.4 Redis đổi license, cộng đồng tách nhánh **Valkey**; Redis 8 bổ sung lại lựa chọn AGPL.

##### Pattern cache

- **Cache-aside:** đọc cache, miss thì đọc DB rồi ghi cache với TTL. Khi dữ liệu đổi: ghi DB trước rồi xóa cache.
- **Version key:** key chứa số version (`pricing:v{n}:{service}`); dữ liệu đổi thì `INCR` version, key cũ không còn được đọc và tự hết hạn. Invalidate O(1), không cần `SCAN`.
- **Negative cache:** cache cả kết quả rỗng với TTL ngắn hơn, để tổ hợp không có dữ liệu không đập DB mãi.
- **Cache stampede:** nhiều request miss cùng lúc rồi cùng nạp lại. Chống bằng single-flight, lock khi nạp lại, jitter TTL, refresh sớm.

##### Lua và lock

Lua đọc được giá trị rồi quyết định ghi ngay trên server, không lệnh nào xen vào giữa. `MULTI/EXEC` cũng nguyên tử nhưng chỉ xếp lệnh; muốn có điều kiện thì phải `WATCH` và retry phía client.

```lua
-- KEYS[1] = khóa phiên, ARGV[1] = sessionId mong đợi, ARGV[2] = sessionId mới, ARGV[3] = TTL giây
local cur = redis.call('GET', KEYS[1])
if (not cur) or cur == ARGV[1] then
  redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
  return 1
end
return 0
```

Lock: `SET lock:{key} <token> NX PX 5000`, nhả bằng Lua chỉ `DEL` khi giá trị vẫn là token của mình. Lock có TTL vẫn có thể bị hai process cùng giữ: process A bị GC pause quá TTL, lock hết hạn, B lấy lock, A tỉnh dậy vẫn tưởng mình giữ. Vì vậy lock Redis chỉ để **giảm tranh chấp**; tính đúng phải do DB đảm bảo (applock, unique, fencing token).

#### Cách show off

Kể phần mình làm thật chi tiết (sửa cache danh mục và cache gói cước), phần có sẵn thì nói "tôi hiểu và làm việc trên lớp đó": Lua kiểm tra-và-đặt để mỗi user chỉ có một phiên thi, lock `SET NX` có token, cache hai tầng, single-flight trong từng pod. Lần sửa API bắt đầu thi thử gọi hàng trăm lệnh `SCAN` là commit của đồng nghiệp; bạn chỉ nhận phần phân tích.

> **Ví dụ:** "Trong lúc xem DMV, tôi thấy một procedure lấy danh mục môn và vòng thi bị gọi tới hàng chục triệu lần, trong khi dữ liệu đó gần như không đổi. Như vậy cache gần như không có tác dụng. Đọc code thì có hai lỗi: TTL dùng chung một biến chỉ 1 giây, và khi danh sách rỗng thì code coi là chưa có cache nên lần nào cũng xuống DB. Tôi đổi sang key phiên bản mới lưu JSON, cache cả kết quả rỗng, TTL 6 giờ, và thêm hàm xóa cache để trang quản trị gọi khi sửa danh mục. Với cache gói cước, tôi dùng version key: dữ liệu đổi thì tăng số version, key cũ tự hết hạn, không phải quét Redis để xóa."

Điểm ăn điểm:
- Đi từ số liệu bất thường (số lần gọi procedure) tới nguyên nhân trong code, không phải "thêm cache cho nhanh".
- Biết negative cache và version key, và giải thích vì sao không xóa theo pattern bằng `SCAN`.
- Nói rõ lock Redis không đảm bảo tính đúng; DB mới là hàng rào cuối.

#### Câu hỏi vặn

- **"Con số hàng chục triệu lần đó đo thế nào, sau khi sửa còn bao nhiêu?"** Đó là số lần chạy cộng dồn trong `sys.dm_exec_procedure_stats` kể từ khi plan vào cache, nên chỉ cho thấy mức độ bất thường chứ không phải tốc độ. Sau sửa: [điền: số lần gọi mỗi giờ hoặc mỗi ngày trước và sau, đo cùng cách]. Nếu chưa có thì tôi nói là chưa đo lại.
- **"Vì sao không dùng `KEYS`, và `SCAN` trên đường nóng cũng không ổn?"** Redis chạy lệnh trên một luồng; `KEYS` duyệt toàn keyspace trong một lệnh và chặn mọi client. `SCAN` không chặn lâu một lần nhưng tổng chi phí vẫn tỉ lệ keyspace. Phải thiết kế để biết trước key cần xóa: version key hoặc một SET làm index.
- **"Cache kết quả rỗng có rủi ro gì?"** Dữ liệu vừa được thêm sẽ chưa hiện tới khi key hết hạn hoặc bị xóa. Vì vậy TTL cho kết quả rỗng nên ngắn hơn, và thao tác thêm dữ liệu phải gọi xóa cache.
- **"Lock Redis có TTL, vì sao vẫn có thể hai process cùng giữ?"** Process giữ lock bị dừng (GC, mạng) quá TTL; lock hết hạn, process khác lấy; process cũ tỉnh lại vẫn tưởng mình giữ. Cần fencing token hoặc để DB đảm bảo đúng đắn.
- **"Lua CAS phiên thi là anh viết à?"** Không, lớp đó có sẵn do đồng nghiệp viết. Tôi đọc hiểu và làm việc trên nó: script chỉ đặt phiên mới khi phiên hiện tại trống hoặc đúng phiên mong đợi, nên một user không mở được hai phiên thi song song.

#### Bẫy cần tránh

- Nhận lớp Lua, lock, single-flight là của mình.
- Nhận commit sửa `SCAN` của đồng nghiệp.
- Đọc con số cộng dồn của DMV như "số lần mỗi ngày".

#### Nhớ nhanh

- Một luồng thực thi: lệnh O(N) và Lua dài chặn tất cả.
- Version key và SET làm index thay cho xóa theo pattern.
- Negative cache TTL ngắn; chống stampede bằng single-flight, jitter, refresh sớm.
- Lock Redis giảm tranh chấp; tính đúng do DB giữ.

#### Bài tập

1. Viết cache-aside bằng StackExchange.Redis cho một hàm đọc chậm 200 ms, có version key và negative cache (TTL 60 giây cho kết quả rỗng).
   **Đáp án:** Key `catalog:v{ver}:{id}`; lưu chuỗi `"[]"` cho rỗng để phân biệt với `null` (chưa cache); hàm invalidate chỉ `INCR catalog:ver`.
### Bài 11.5. ClickHouse và kho cột cho báo cáo

#### Kiến thức

##### Vì sao lưu theo cột nhanh cho tổng hợp

Kho dòng lưu cả dòng liền nhau, hợp với đọc ghi từng bản ghi. Kho cột lưu từng cột liền nhau, nên `SUM(score) GROUP BY province` chỉ đọc hai cột thay vì cả dòng. Cột cùng kiểu nén rất tốt, và engine xử lý theo khối vector, tận dụng SIMD. Đổi lại, cập nhật hay xóa từng dòng rất đắt.

##### MergeTree

- Mỗi lần insert tạo một **part** bất biến; tiến trình nền **merge** các part nhỏ thành part lớn.
- **`ORDER BY`** quyết định thứ tự lưu và tạo **sparse primary index**: mỗi granule (mặc định 8.192 dòng) một mục. Index không duy nhất và không trỏ tới từng dòng như B-tree; nó giúp bỏ qua granule không liên quan.
- **`PARTITION BY`** (thường theo tháng) để quản lý vòng đời dữ liệu, không phải để tăng tốc.
- **ReplacingMergeTree:** giữ dòng mới nhất theo cột version khi merge. Merge chạy lúc nào không biết trước, nên truy vấn cần chính xác dùng `FINAL` hoặc `argMax`.
- **AggregatingMergeTree, SummingMergeTree** cộng **materialized view**: MV của ClickHouse là trigger lúc insert, tổng hợp trước vào bảng đích.
- Insert theo lô lớn; insert từng dòng tạo quá nhiều part ("too many parts"). Cần insert nhỏ thì bật `async_insert`.
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

##### Khi nào đáng dùng

Dùng khi dữ liệu sự kiện rất lớn (hàng trăm triệu dòng trở lên), truy vấn tổng hợp nhiều chiều, dashboard cần trả nhanh. Không dùng khi cần transaction, cập nhật từng dòng thường xuyên, hoặc dữ liệu vẫn vừa sức SQL Server. **Columnstore index** trên SQL Server (có ở bản Standard từ 2016 SP1, nhưng giới hạn bộ nhớ columnstore và độ song song) là phương án nên thử trước, vì không thêm hạ tầng mới.

#### Cách show off

ClickHouse bạn chưa vận hành thật; phương án CDC qua Kafka vào ClickHouse mới ở mức thiết kế. Hệ báo cáo thật tổng hợp bằng SQL Agent job mỗi giờ, phần API C# là của bạn. Thừa nhận ngay, rồi cho thấy bạn biết **khi nào** nên dùng và **thứ tự** các phương án.

> **Ví dụ:** "Tôi chưa vận hành ClickHouse trên production. Hệ báo cáo tôi làm hiện tổng hợp bằng job SQL Server chạy mỗi giờ, nghiệp vụ chấp nhận số liệu trễ khoảng một giờ, và phần tôi viết là API C# phía trên. Tôi đã tìm hiểu phương án đưa thay đổi qua CDC và Kafka vào ClickHouse để có số gần realtime, nhưng nếu thật sự cần, tôi sẽ thử theo thứ tự rẻ trước: tăng tần suất job, thêm columnstore index ngay trên SQL Server, đọc từ replica, rồi mới tới thêm một hệ mới. ClickHouse mạnh khi tổng hợp trên hàng trăm triệu dòng, nhưng thêm nó là thêm một hệ phải vận hành, đồng bộ và giám sát."

Điểm ăn điểm:
- Nói thứ tự phương án từ rẻ tới đắt; đây là tư duy senior.
- Giải thích được `ORDER BY` của MergeTree khác primary key SQL Server, và ReplacingMergeTree không khử trùng tức thì.
- Nêu đúng ràng buộc columnstore ở bản Standard.

#### Câu hỏi vặn

- **"Kể một lần anh dùng ClickHouse?"** Tôi chưa vận hành ClickHouse trên production. Tôi đã nghiên cứu phương án CDC qua Kafka vào ClickHouse cho hệ báo cáo, nói được thiết kế và đánh đổi, nhưng chưa triển khai.
- **"Vì sao kho cột nhanh cho truy vấn tổng hợp?"** Chỉ đọc đúng cột cần, cột cùng kiểu nén tốt nên I/O ít, và engine xử lý theo khối vector. Truy vấn quét hàng trăm triệu dòng nhưng chỉ vài cột là đúng sở trường.
- **"`ORDER BY` trong MergeTree khác primary key của SQL Server thế nào?"** Nó là thứ tự lưu cộng sparse index theo granule 8.192 dòng, không đảm bảo duy nhất và không trỏ tới từng dòng. Chọn cột hay lọc nhất, cardinality thấp đứng trước.
- **"ReplacingMergeTree có đảm bảo không trùng không?"** Không tức thì; dòng trùng chỉ bị gộp khi merge nền chạy. Truy vấn cần chính xác dùng `FINAL` hoặc `argMax(col, version)` theo khóa.
- **"Dữ liệu trễ một giờ có vấn đề không?"** Với dashboard quản lý thì nghiệp vụ đã chấp nhận. Nếu có nhu cầu gần realtime, tôi hỏi rõ trễ bao nhiêu là đủ trước khi chọn công nghệ, vì từ một giờ xuống năm phút có thể chỉ cần tăng tần suất job.

#### Bẫy cần tránh

- Nhận đã dùng ClickHouse vì đã đọc thiết kế.
- Đề xuất ClickHouse ngay mà không xét columnstore hay tăng tần suất job.
- Nghĩ `PARTITION BY` là để tăng tốc truy vấn.

#### Nhớ nhanh

- Kho cột: đọc ít cột, nén tốt, xử lý vector; yếu ở cập nhật từng dòng.
- MergeTree: part bất biến, merge nền, `ORDER BY` là sparse index.
- ReplacingMergeTree chỉ khử trùng khi merge; dùng `FINAL` hoặc `argMax`.
- Thử columnstore trên SQL Server trước; ClickHouse mới ở mức thiết kế.

#### Bài tập

1. Insert hai lần cùng một `(tenant_id, round_id, user_id)` với version khác nhau vào ReplacingMergeTree, đếm dòng có và không có `FINAL`, rồi chạy `OPTIMIZE TABLE ... FINAL`.
   **Đáp án:** Không `FINAL` thấy 2 dòng; có `FINAL` thấy 1; sau `OPTIMIZE` dữ liệu vật lý chỉ còn 1.
## Chương 12. Hệ phân tán: messaging và nhất quán dữ liệu

Chương này đi qua Kafka, RabbitMQ, CQRS, saga, transactional outbox, CDC, idempotency và eventual consistency. Đây là nhóm người phỏng vấn senior đào sâu nhất, vì chỉ cần dùng sai một từ, ví dụ gọi ghi idempotent là "exactly-once", là lộ ngay mức hiểu.

Trải nghiệm của bạn ở chương này đan xen: có luồng bạn tự làm từ đầu tới cuối, có luồng do đồng nghiệp viết mà bạn chỉ nâng cấp, có phần mới ở mức thiết kế. Mỗi bài chỉ cách nói đúng ranh giới đó mà vẫn cho thấy hiểu sâu.

### Bài 12.1. Kafka: partition, consumer group và commit offset

#### Kiến thức

##### Mô hình log

Kafka là **log phân tán chỉ ghi nối**. Một **topic** chia thành nhiều **partition**; mỗi message trong partition có **offset** tăng dần. Message không bị xóa khi đọc mà giữ theo retention, nên nhiều **consumer group** đọc độc lập và có thể đọc lại (replay).

- **Replication:** mỗi partition có một leader và các follower; ISR là tập replica đang bắt kịp. Producer `acks=all` cùng `min.insync.replicas=2` (replication factor 3) thì message chỉ được xác nhận khi ít nhất 2 replica đã có.
- **Idempotent producer:** `enable.idempotence=true` (mặc định từ client Kafka 3.0) chống ghi trùng khi producer retry.
- **Kafka 4.0** bỏ hẳn ZooKeeper, chỉ chạy KRaft, và có giao thức consumer group mới giúp rebalance nhẹ hơn.

##### Thứ tự, consumer group và commit

- **Thứ tự chỉ đảm bảo trong một partition.** Message cùng key vào cùng partition, nên đặt key theo thực thể cần giữ thứ tự (`userId`, `matchId`). Key nóng làm lệch tải.
- **Consumer group:** mỗi partition chỉ giao cho một consumer trong group; số consumer hữu ích tối đa bằng số partition.
- **Commit offset quyết định ngữ nghĩa giao nhận:**
  - Auto-commit theo chu kỳ: crash sau khi commit mà chưa xử lý xong thì **mất** message.
  - Commit sau khi xử lý: **at-least-once**; crash thì xử lý lại, nên handler phải idempotent.
  - Commit trước khi xử lý: at-most-once.
- **Exactly-once của Kafka** (transactions) chỉ đúng cho chuỗi đọc Kafka, xử lý, ghi Kafka. Ghi ra DB bên ngoài thì vẫn là at-least-once cộng xử lý idempotent.

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

##### Lag, retry, DLQ

- **Consumer lag** = offset mới nhất trừ offset đã commit. Lag tăng đều nghĩa là xử lý chậm hơn tốc độ đến: tối ưu handler, ghi theo lô, tăng partition và consumer. Lag dồn vào một partition là dấu hiệu key nóng.
- **Lỗi tạm thời** (DB timeout): retry có backoff, hoặc retry topic có delay. **Lỗi dữ liệu** (message hỏng): đẩy vào DLQ để xử lý tay, không chặn partition.
- Handler chạy lâu hơn `max.poll.interval.ms` thì consumer bị coi là chết và bị rebalance.

#### Cách show off

Bạn có hai luồng Kafka với mức sở hữu khác nhau, và nên kể rõ sự khác nhau đó. **Bảng xếp hạng trận đấu** (sản phẩm IOM) là của bạn từ đầu tới cuối; quy mô người chơi trong tài liệu cũ là ước lượng, chưa đo. **Kết thúc game** trên hệ thống thi thì consumer do đồng nghiệp viết (kiểm tra rồi mới ghi, message lỗi ghi log riêng, số message mỗi vòng tăng dần sau khi khởi động lại để không dội tải vào DB); phần của bạn là nâng worker lên .NET 10.

> **Ví dụ:** "Luồng Kafka tôi làm trọn vẹn là bảng xếp hạng trận đấu. Mỗi lần người chơi có điểm, service phát sự kiện vào Kafka với key là mã trận, để mọi sự kiện của một trận đi vào cùng partition và giữ đúng thứ tự. Consumer ghi vào Redis sorted set bằng điểm tuyệt đối chứ không cộng dồn, nên nếu consumer crash và đọc lại message thì điểm không bị nhân đôi. Ngoài ra tôi có nâng cấp worker kết thúc game lên .NET 10; consumer đó do đồng nghiệp viết, và khi đọc code tôi thấy nó đang bật auto-commit. Nghĩa là nếu worker chết sau khi offset đã được commit mà chưa ghi xong, kết quả đó mất; hướng sửa là tắt auto-commit, commit sau khi xử lý và giữ handler idempotent."

Điểm ăn điểm:
- Giải thích thiết kế idempotent bằng thao tác tuyệt đối (`ZADD` thay vì `ZINCRBY`), không chỉ nói "consumer idempotent".
- Chủ động chỉ ra rủi ro auto-commit trong hệ thống đang chạy, kèm cách sửa.
- Không gọi việc tăng dần số message mỗi vòng là "batch insert"; consumer vẫn xử lý tuần tự, đó là tăng dần thông lượng.

#### Câu hỏi vặn

- **"Kafka đảm bảo thứ tự thế nào?"** Chỉ trong một partition. Muốn mọi message của một trận theo thứ tự thì đặt key theo mã trận. Producer không đặt key thì message bị rải, mất thứ tự theo thực thể.
- **"Auto-commit có rủi ro gì?"** Offset được commit theo chu kỳ, độc lập với việc xử lý. Crash sau khi commit mà chưa xử lý xong thì message mất. Sửa: tắt auto-commit, commit sau khi xử lý (hoặc tắt auto offset store và `StoreOffset` sau xử lý), handler idempotent để chịu được replay.
- **"Bảng xếp hạng chịu được bao nhiêu người chơi, đo chưa?"** Con số quy mô trong tài liệu là ước lượng, tôi chưa có load test. Nếu cần chứng minh, tôi đo độ trễ từ lúc có điểm tới lúc hiện trên bảng bằng timestamp trong message, dưới tải giả lập.
- **"Consumer lag tăng dần, anh làm gì?"** Xem handler chậm ở đâu bằng metric thời gian xử lý; tối ưu hoặc ghi theo lô; tăng partition và consumer nếu lag phân bố đều; nếu lag dồn vào một partition thì là key nóng, phải đổi cách chọn key.
- **"Exactly-once của Kafka nghĩa là gì?"** Transaction của Kafka cho exactly-once trong phạm vi đọc từ Kafka và ghi lại Kafka. Khi handler ghi ra DB, ngữ nghĩa thực tế là at-least-once cộng xử lý idempotent, tức tác dụng xảy ra đúng một lần.
#### Bẫy cần tránh

- Nhận consumer kết thúc game là của mình.
- Nói "Kafka đảm bảo exactly-once" mà không nói phạm vi.
- Nói số người chơi ước lượng như số đã đo.

#### Nhớ nhanh

- Log phân tán: partition, offset, consumer group đọc độc lập, replay được.
- Thứ tự chỉ trong partition; key theo thực thể cần thứ tự.
- Commit sau xử lý cho at-least-once; handler phải idempotent.
- Bảng xếp hạng trận đấu là của bạn; consumer kết thúc game là của đồng nghiệp.

#### Bài tập

1. Chạy Kafka 4.x một node (KRaft) bằng Docker, tạo topic 3 partition. Produce 30 message với 3 key khác nhau, chạy 2 consumer cùng group, in partition và offset.
   **Đáp án:** Message cùng key luôn vào cùng partition và đến theo thứ tự; 3 partition chia cho 2 consumer (một consumer nhận 2 partition).
### Bài 12.2. RabbitMQ và cách chọn giữa RabbitMQ với Kafka

#### Kiến thức

##### Mô hình

Producer gửi message tới **exchange**; exchange định tuyến tới **queue** theo **binding**; consumer nhận từ queue. Một message trong queue chỉ giao cho một consumer.

| Exchange | Định tuyến |
|---|---|
| direct | Routing key khớp chính xác |
| topic | Routing key khớp mẫu (`exam.*.submitted`, `exam.#`) |
| fanout | Gửi tới mọi queue đã bind |
| headers | Theo header của message |

##### Độ bền và giao nhận

- **Ack thủ công:** consumer ack sau khi xử lý; mất kết nối trước khi ack thì message được giao lại (at-least-once). `nack` với `requeue: false` đưa message sang dead-letter exchange.
- **Prefetch** (`basic.qos`): số message chưa ack tối đa mỗi consumer. Cao quá thì một consumer ôm hết, thấp quá thì throughput thấp.
- **Publisher confirm:** broker xác nhận đã nhận; không bật thì producer không biết message có tới không.
- **Bền qua restart:** queue durable **và** message persistent; thiếu một trong hai là mất khi broker restart.
- **Dead-letter exchange:** message bị nack, hết TTL hoặc vượt độ dài queue sẽ sang đó. Retry có delay: queue chờ có TTL, hết TTL thì dead-letter quay về queue chính.
- **Quorum queue** (dựa trên Raft) là lựa chọn mặc định cho dữ liệu quan trọng; RabbitMQ 4.0 đã bỏ classic mirrored queue. **Streams** cho nhu cầu log có replay.

Trong client .NET (RabbitMQ.Client 7, API async), khung consumer chuẩn là: khai báo queue `durable` với `x-queue-type = quorum` và `x-dead-letter-exchange`, đặt `BasicQosAsync(prefetchCount: 20)`, `autoAck: false`, xử lý xong thì `BasicAckAsync`, lỗi thì `BasicNackAsync(requeue: false)` để message sang dead-letter.

##### RabbitMQ hay Kafka

| Tiêu chí | RabbitMQ | Kafka |
|---|---|---|
| Mô hình | Queue: giao một consumer rồi xóa | Log: giữ theo retention, nhiều group đọc độc lập |
| Định tuyến | Linh hoạt (topic, headers) | Theo topic và partition |
| Replay | Không (trừ Streams) | Có |
| Thứ tự | Theo queue, mất khi nhiều consumer | Theo partition |
| Hợp với | Task queue, command, định tuyến phức tạp | Event stream, throughput lớn, nhiều bên đọc |

#### Cách show off

"RabbitMQ hay Kafka" là câu hỏi về **mô hình**, không phải tốc độ: cần replay không, bao nhiêu bên đọc, cần định tuyến phức tạp không. Kinh nghiệm thật ở dự án trước (IAS 2.0 tại AvePoint): chuyển hệ thống sang .NET theo hướng CQRS, read model cập nhật qua RabbitMQ. Cấu hình cụ thể nói đúng những gì còn nhớ, không thêm số.

> **Ví dụ:** "Ở dự án trước, khi chuyển hệ thống sang .NET, chúng tôi tách phía ghi và phía đọc. Phía ghi phát event qua RabbitMQ, các consumer cập nhật read model cho màn hình đọc. Mấy điều chúng tôi phải xử lý: consumer phải idempotent vì message có thể được giao lại khi mất kết nối trước lúc ack; không được giả định thứ tự khi chạy nhiều consumer trên một queue; và message lỗi phải đi sang dead-letter queue thay vì requeue mãi làm nghẽn hàng đợi. Chúng tôi chọn RabbitMQ vì bài toán là hàng đợi công việc với ack từng message, không cần đọc lại lịch sử. Nếu cần nhiều nhóm đọc độc lập và replay thì tôi sẽ chọn Kafka."

Điểm ăn điểm:
- Lý do chọn công cụ gắn với tính chất bài toán (replay, số bên đọc, ack từng message).
- Biết ba điều kiện để message bền: queue durable, message persistent, publisher confirm.
- Biết retry có delay bằng TTL cộng dead-letter, và giới hạn số lần qua header `x-death`.

#### Câu hỏi vặn

- **"Khi nào chọn RabbitMQ thay vì Kafka?"** Khi cần hàng đợi công việc với ack từng message, định tuyến linh hoạt theo routing key, retry có delay, và không cần replay. Cần lưu lâu, nhiều nhóm đọc độc lập hoặc throughput rất lớn thì chọn Kafka.
- **"Prefetch ảnh hưởng gì?"** Giới hạn số message chưa ack mỗi consumer. Cao quá thì một consumer giữ nhiều message, consumer khác rảnh và message chậm bị kẹt; thấp quá thì mỗi message chờ một vòng mạng. Chọn theo thời gian xử lý mỗi message.
- **"Broker restart làm mất message, nguyên nhân thường là gì?"** Queue không durable, message không persistent, hoặc producer không bật publisher confirm nên không biết message chưa tới. Dữ liệu quan trọng dùng quorum queue.
- **"Read model lệch với phía ghi thì sao?"** Nếu phía ghi lưu DB xong mà publish lỗi thì read model thiếu dữ liệu; cách đúng là transactional outbox. Ngoài ra cần cách dựng lại projection từ nguồn và job đối soát định kỳ.
- **"Cấu hình queue thực tế ở dự án đó thế nào?"** Tôi chỉ nói những gì còn nhớ chắc: ack thủ công, dead-letter cho message lỗi, consumer idempotent. Các con số cụ thể như prefetch tôi không nhớ nên không nêu.

#### Bẫy cần tránh

- Nói "Kafka nhanh hơn nên luôn dùng Kafka".
- Quên rằng nhiều consumer trên một queue làm mất thứ tự.
- Bịa thông số cấu hình không nhớ.

#### Nhớ nhanh

- Producer → exchange → binding → queue → consumer.
- Ack thủ công cho at-least-once; nack không requeue để sang dead-letter.
- Bền cần đủ ba thứ: durable queue, persistent message, publisher confirm.
- Quorum queue là mặc định; chọn RabbitMQ cho task queue, Kafka cho event stream có replay.

#### Bài tập

1. Chạy RabbitMQ bằng Docker, tạo topic exchange `exam` và hai queue bind `exam.*.submitted` và `exam.#`. Publish với routing key `exam.ielts.submitted` và `exam.ielts.graded`.
   **Đáp án:** `exam.ielts.submitted` vào cả hai queue; `exam.ielts.graded` chỉ vào queue bind `exam.#`.
### Bài 12.3. CQRS, saga, transactional outbox và CDC

#### Kiến thức

##### CQRS

CQRS tách **mô hình ghi** (command, giữ bất biến, chuẩn hóa) khỏi **mô hình đọc** (query, phi chuẩn hóa theo màn hình). Read model được cập nhật bằng **projection** nghe event từ phía ghi, nên đọc trễ một chút. CQRS không bắt buộc event sourcing. Đáng dùng khi tải đọc và ghi lệch nhau nhiều hoặc màn hình cần dạng dữ liệu rất khác mô hình ghi; thừa thãi với CRUD.

##### Saga

Khi một nghiệp vụ trải qua nhiều service thì không có transaction ACID chung. **Saga** là chuỗi transaction cục bộ; bước nào lỗi thì chạy **hành động bù trừ** cho các bước đã xong (hủy giữ chỗ, hoàn tiền).
- **Orchestration:** một state machine trung tâm gửi command và theo dõi trạng thái. Dễ nhìn luồng, có điểm điều phối.
- **Choreography:** mỗi service nghe event và phản ứng. Ít phụ thuộc, nhưng khó nhìn luồng khi nhiều bước.
- Mỗi bước cần idempotent và có timeout; bù trừ cũng phải idempotent và không phải lúc nào cũng "hoàn tác" được (email đã gửi thì chỉ gửi được email đính chính).

Chỉ cần saga khi có **nhiều bước ghi ở nhiều nơi**. Nếu thiết kế được để nghiệp vụ chỉ cần một lần ghi atomic thì không cần saga.

##### Transactional outbox

**Dual-write** là ghi DB rồi publish message. DB thành công mà publish lỗi thì event mất; publish trước mà DB rollback thì event sai. **Outbox**: ghi dữ liệu nghiệp vụ và một dòng outbox **trong cùng transaction**; một relay đọc outbox, publish, rồi đánh dấu đã gửi. Relay có thể publish trùng (crash sau publish, trước khi đánh dấu), nên consumer phải idempotent, thường bằng bảng **inbox** theo `messageId`.

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

##### CDC

**Change Data Capture** đọc transaction log của DB và phát luồng thay đổi. SQL Server có CDC sẵn (`sys.sp_cdc_enable_db`, `sys.sp_cdc_enable_table`; capture job ghi vào bảng change); **Debezium** chạy trên Kafka Connect, chụp snapshot ban đầu rồi stream thay đổi vào Kafka. CDC có thể làm relay cho outbox thay cho polling, hoặc nạp kho phân tích. Rủi ro: capture dừng thì log không truncate được (`log_reuse_wait_desc = REPLICATION`) và đĩa đầy; đổi schema bảng nguồn cần quy trình riêng.

#### Cách show off

Bốn khái niệm, bốn mức trải nghiệm khác nhau; nói rõ từng mức là cách ghi điểm. **CQRS** đã làm ở dự án trước (read model qua RabbitMQ). **Outbox** có trong hệ luyện thi (sự kiện "bắt đầu lượt làm bài" theo chuẩn CloudEvents, giới hạn số lần thử, bật tắt bằng cờ) nhưng không chung transaction và không rõ ai viết, bạn không nhận. **Saga** chưa triển khai, và bạn từng cố ý thiết kế để không cần nó. **CDC** chưa có.

> **Ví dụ:** "Hệ luyện thi tôi làm có bảng outbox để phát sự kiện khi học sinh bắt đầu một lượt làm bài. Khi đọc kỹ, tôi thấy dòng outbox được ghi ở một bước riêng sau khi lượt làm bài đã lưu, không nằm chung transaction. Nghĩa là nếu process chết đúng giữa hai bước, lượt làm bài có trong DB mà sự kiện thì không bao giờ được phát. Cách sửa là đưa lệnh insert outbox vào cùng transaction với lần ghi lượt làm bài, và consumer giữ bảng inbox để bỏ qua message trùng. Phần outbox đó không phải tôi viết, tôi chỉ phân tích. Còn saga thì tôi chưa triển khai thật; khi viết lại engine tạo lượt làm bài, tôi cố ý thiết kế để chỉ có một lần ghi atomic, nên không có trạng thái ghi dở cần bù trừ."

Điểm ăn điểm:
- Nhìn ra khe hở "outbox không chung transaction" trong code đang chạy; cho thấy bạn hiểu outbox để làm gì chứ không chỉ biết tên.
- Biết tránh saga bằng thiết kế (một lần ghi atomic) trước khi nghĩ tới saga.
- Nhắc rủi ro vận hành của CDC (log không truncate), điều chỉ người từng lo vận hành mới để ý.

#### Câu hỏi vặn

- **"Kể một lần anh dùng saga?"** Tôi chưa triển khai saga thật. Ở engine tạo lượt làm bài tôi cố ý không cần saga vì thiết kế chỉ có một lần ghi atomic. Nếu cần, ví dụ đăng ký khóa học có thanh toán, tôi dùng orchestration: giữ chỗ, thanh toán, xác nhận; thanh toán lỗi hoặc quá hạn thì hủy giữ chỗ; mỗi bước idempotent và có timeout.
- **"Vì sao outbox phải chung transaction với dữ liệu nghiệp vụ?"** Để hai việc cùng thành công hoặc cùng thất bại. Ghi ở hai bước thì crash giữa chừng để lại dữ liệu đã ghi mà không có event, hoặc event mà dữ liệu đã rollback.
- **"Relay outbox chạy nhiều instance thì tránh publish trùng thế nào?"** Lấy dòng bằng `UPDLOCK, READPAST` để mỗi instance nhận lô khác nhau. Vẫn có trùng khi crash sau publish trước khi đánh dấu, nên consumer phải dedupe theo `messageId`.
- **"Dùng CDC làm relay thay polling có gì hơn, có gì phải lo?"** Không phải quét bảng định kỳ, độ trễ thấp, không thêm tải truy vấn. Phải lo capture dừng làm log không truncate và đĩa đầy, đổi schema phải có quy trình, và thêm một hệ (Kafka Connect, Debezium) để vận hành.
- **"CQRS ở dự án trước có event sourcing không?"** CQRS không bắt buộc event sourcing. Ở đó phía ghi vẫn lưu trạng thái hiện tại và phát event để cập nhật read model. [điền: nếu dự án có lưu event store thì nói thêm]

#### Bẫy cần tránh

- Nói hệ thống "có outbox" như một điểm cộng mà không thấy nó không chung transaction.
- Nhận phần outbox là của mình.
- Nghĩ CQRS phải đi kèm event sourcing.

#### Nhớ nhanh

- CQRS: tách ghi và đọc, read model trễ.
- Saga: transaction cục bộ cộng bù trừ; tránh được thì tránh bằng thiết kế một lần ghi.
- Outbox phải chung transaction; relay có thể trùng nên consumer cần inbox.
- CDC đọc log; rủi ro lớn nhất là log không truncate khi capture dừng.

#### Bài tập

1. Vẽ saga orchestration cho "đăng ký khóa học có thanh toán": các bước, event, hành động bù trừ và timeout.
   **Đáp án:** ReserveSeat → ChargePayment → ConfirmEnrollment. ChargePayment lỗi hoặc quá 15 phút thì ReleaseSeat. Confirm lỗi thì RefundPayment rồi ReleaseSeat. Mỗi command mang `sagaId` để idempotent.
### Bài 12.4. Idempotency và eventual consistency

#### Kiến thức

##### Idempotency

Thao tác idempotent là thao tác thực hiện nhiều lần cho cùng kết quả như một lần. Giữa các hệ thống qua mạng, message có thể mất hoặc lặp; không có exactly-once delivery. Thực tế đạt được là **at-least-once cộng xử lý idempotent**, cho ra tác dụng đúng một lần (effectively-once).

Các cách làm, từ mạnh tới yếu:
- **Unique constraint** trên khóa nghiệp vụ (user, vòng): DB tự chặn, hàng rào mạnh nhất.
- **Idempotency key:** client sinh key cho mỗi thao tác; server lưu `(key → trạng thái, kết quả)` có TTL, gặp key đã xong thì trả kết quả cũ.
- **Khóa theo key nghiệp vụ:** applock hoặc `UPDLOCK, HOLDLOCK` rồi check-then-insert (Bài 11.2).
- **Inbox:** bảng lưu `messageId` đã xử lý, insert cùng transaction với tác dụng nghiệp vụ.
- **Thao tác tuyệt đối thay vì tương đối:** `ZADD` điểm tuyệt đối thay vì `ZINCRBY`; `SET status = 'paid'` thay vì cộng dồn.

Hai request cùng idempotency key đến **song song** là chỗ hay bị bỏ sót: request đầu phải chiếm key bằng insert trạng thái "đang xử lý" có ràng buộc unique; request sau thấy đang xử lý thì trả `409` hoặc chờ rồi đọc kết quả. Thiếu bước này, hai request cùng không thấy key và cùng xử lý.

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

##### Eventual consistency

Các bản sao dữ liệu khớp nhau sau một khoảng trễ nếu không có cập nhật mới. Các mô hình hay gặp: **strong** (đọc luôn thấy ghi mới nhất), **read-your-writes** (ít nhất thấy ghi của chính mình), **monotonic reads** (không đọc lùi về bản cũ hơn), **eventual**.

Giao diện phải được thiết kế cho trạng thái trung gian: hiện "đang xử lý" thay vì hứa kết quả ngay; sau khi user ghi thì đọc từ nguồn chính hoặc cập nhật lạc quan phía client; ghi rõ "số liệu cập nhật lúc 10:00". Đo độ trễ bằng timestamp ở cả hai đầu, và có job đối soát định kỳ để bắt lệch.

#### Cách show off

Từ nguy hiểm nhất ở đây là "exactly-once"; gọi đúng tên việc mình làm là ghi idempotent. Ghi kết quả một lần bằng applock (Bài 11.2) là của bạn; Redis mutex và idempotency key 24 giờ ở hệ luyện thi do đồng nghiệp viết. Về eventual consistency: kho báo cáo cho các Sở giáo dục tổng hợp bằng job mỗi giờ; phần C# (phạm vi dữ liệu theo token, proxy, cache) là của bạn, phần SQL không có trong git nên không chứng minh được ai viết, và production hiện mới có một Sở đối tác.

> **Ví dụ:** "Tôi không dùng từ exactly-once, vì giữa các hệ thống qua mạng thì không có chuyện giao đúng một lần. Cái tôi làm là đảm bảo tác dụng chỉ xảy ra một lần. Ví dụ ở sự kiện thi theo chặng, request nộp bài có thể bị gửi lại; tôi khóa theo cặp học sinh và vòng thi, kiểm tra trong khóa, và nếu đã có kết quả thì trả lại đúng bản ghi đó. Về nhất quán, hệ báo cáo cho các Sở giáo dục chấp nhận trễ khoảng một giờ vì dữ liệu được tổng hợp theo job; tôi làm phần API phía trên, nên điều tôi lưu ý là hiển thị rõ thời điểm cập nhật để người xem không nhầm với số realtime."

Điểm ăn điểm:
- Phân biệt exactly-once delivery với effectively-once.
- Nhắc trường hợp hai request cùng key đến song song, chỗ mà thiết kế idempotency key ngây thơ hay hỏng.
- Nói eventual consistency là quyết định nghiệp vụ (trễ bao nhiêu thì chấp nhận) và phải thể hiện trên giao diện.

#### Câu hỏi vặn

- **"Exactly-once có tồn tại không?"** Exactly-once delivery giữa các hệ thống qua mạng thì không. Cái đạt được là at-least-once cộng xử lý idempotent, tức tác dụng nghiệp vụ xảy ra đúng một lần.
- **"Hai request cùng idempotency key đến song song thì xử lý thế nào?"** Request đầu chiếm key bằng insert trạng thái "đang xử lý" có ràng buộc unique, hoặc `SET NX` trên Redis. Request sau thấy đang xử lý thì trả `409` hoặc chờ có giới hạn rồi đọc kết quả. Key nên gắn với hash của body để chặn dùng lại key cho request khác.
- **"Lớp idempotency key 24 giờ là của anh?"** Không, lớp đó có sẵn do đồng nghiệp viết. Phần idempotent tôi làm là ghi kết quả một lần bằng applock ở sự kiện thi theo chặng.
- **"Trễ một giờ ở hệ báo cáo, ai quyết định là chấp nhận được?"** Nghiệp vụ quyết định, dựa trên cách dùng dashboard: báo cáo quản lý xem theo ngày, không cần realtime. Phía kỹ thuật phải hiển thị thời điểm cập nhật và có cách phát hiện khi job chạy chậm hoặc lỗi.
- **"Hệ báo cáo đó phục vụ bao nhiêu đơn vị?"** Trên production hiện mới có một Sở đối tác. Tôi nói rõ để không bị hiểu nhầm là đã chạy ở quy mô lớn.

#### Bẫy cần tránh

- Gọi ghi một lần là "exactly-once delivery".
- Nhận lớp idempotency key hoặc Redis mutex có sẵn là của mình.
- Phóng đại quy mô hệ báo cáo.

#### Nhớ nhanh

- Idempotent: làm nhiều lần như một lần; unique constraint là hàng rào mạnh nhất.
- Idempotency key cần trạng thái "đang xử lý" để chặn request song song.
- Không có exactly-once delivery; có at-least-once cộng xử lý idempotent.
- Eventual consistency phải được thiết kế ở giao diện và được đo.

#### Bài tập

1. Viết endpoint submit có header `Idempotency-Key`, lưu key trong SQL Server với unique constraint và trạng thái. Bắn 5 request cùng key song song.
   **Đáp án:** Một request xử lý, các request còn lại nhận `409` hoặc kết quả cũ; bảng nghiệp vụ chỉ có 1 bản ghi.
## Chương 13. Resilience, bảo mật, test, vận hành và quan sát

Chương này gom những thứ "xung quanh code": làm service chịu lỗi (timeout, retry, circuit breaker, rate limit, gateway), bảo mật (OAuth, OIDC, JWT, OWASP), test (xUnit, Testcontainers, TDD, k6), vận hành (Docker, Kubernetes, Helm, Terraform, Argo CD, CI) và quan sát (OpenTelemetry, Prometheus, Grafana, Elastic APM, SLO).

Đây cũng là chương có nhiều mảng bạn mới hiểu ở mức kiến thức hơn là đã làm thật. Mục tiêu là nói chắc cơ chế theo best practice, kể đúng những việc đã làm, và không để một từ khóa vận hành làm lộ việc mình chưa làm.

### Bài 13.1. Resilience, rate limiting và API gateway

#### Kiến thức

##### Các pattern chịu lỗi

- **Timeout:** mọi lời gọi đồng bộ ra ngoài phải có hạn, ở hai mức: timeout mỗi lần thử và timeout tổng.
- **Retry:** chỉ cho thao tác idempotent hoặc có idempotency key; **exponential backoff cộng jitter** để các client không retry cùng lúc (retry storm); giới hạn số lần; và chỉ retry ở một lớp, vì 3 lớp mỗi lớp thử 3 lần là 27 lời gọi tới service đang hỏng.
- **Circuit breaker:** đóng (bình thường) → mở khi tỉ lệ lỗi vượt ngưỡng trong cửa sổ lấy mẫu có lưu lượng tối thiểu (từ chối ngay, không gọi) → half-open sau thời gian nghỉ (cho vài lời gọi thử).
- **Bulkhead:** giới hạn số lời gọi đồng thời tới từng dependency để một dependency chậm không ăn hết thread và connection.
- **Fallback, degrade:** trả dữ liệu cache, tắt tính năng phụ để luồng chính sống.

.NET 8 trở lên có gói `Microsoft.Extensions.Http.Resilience` xây trên Polly v8. Pipeline chuẩn từ ngoài vào trong: rate limiter → total timeout → retry → circuit breaker → attempt timeout.

```csharp
builder.Services.AddHttpClient<IScoringClient, ScoringClient>()
    .AddStandardResilienceHandler(o =>
    {
        o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(2);
        o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(10);
        o.Retry.MaxRetryAttempts = 3;   // backoff mũ có jitter là mặc định
    });
```

##### Rate limiting

Thuật toán: **fixed window** (đơn giản, dồn tải ở mép cửa sổ), **sliding window** (mượt hơn), **token bucket** (cho burst trong giới hạn), **concurrency** (giới hạn số request đang chạy).

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;   // mặc định là 503
    o.AddPolicy("per-user", ctx => RateLimitPartition.GetTokenBucketLimiter(
        ctx.User.FindFirst("sub")?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 20, TokensPerPeriod = 10, ReplenishmentPeriod = TimeSpan.FromSeconds(1)
        }));
});
app.UseRateLimiter();
```

Hai chi tiết hay bị bỏ sót. Một: `RejectionStatusCode` mặc định là `503`, phải đặt `429` tường minh, và `Retry-After` không tự có. Hai: bộ đếm của middleware nằm **trong bộ nhớ từng pod**, 10 pod thì giới hạn thực tế gấp khoảng 10 lần. Giới hạn toàn cục cần bộ đếm chung, thường là token bucket hoặc sliding window bằng Lua trên Redis.

##### API gateway và YARP

Gateway là điểm vào chung: định tuyến, xác thực, rate limit, biến đổi header và path, gom log. **YARP** là thư viện reverse proxy của Microsoft chạy trong ASP.NET Core, cấu hình bằng **route** (khớp request) và **cluster** (đích, load balancing, health check). Gắn policy cho từng route qua `RateLimiterPolicy`, `AuthorizationPolicy`; bật `HealthCheck.Active` cho cluster để loại đích hỏng khỏi cân bằng tải.

High availability: không có điểm hỏng đơn; nhiều pod cho service stateless, trạng thái đưa ra ngoài (Redis, DB); dữ liệu có replication và failover; trải pod qua nhiều node; `PodDisruptionBudget` để bảo trì không tắt hết pod.

#### Cách show off

Bạn chưa triển khai Polly hay circuit breaker trên production, nên đừng dựng chuyện. Điểm để kể là một quyết định thật **ngược chiều**: cố ý không đặt deadline cho gRPC gửi event (Bài 9.2), và giải thích nó nhất quán với nguyên tắc timeout. YARP có trải nghiệm thật ở BFF đăng nhập.

> **Ví dụ:** "Phần Polly và circuit breaker tôi chưa triển khai ở production, nên tôi nói ở mức thiết kế. Quyết định thật gần nhất của tôi về timeout lại là không đặt deadline cho lời gọi gRPC gửi event, vì service nhận có lúc chậm vài giây và event đó đã tách khỏi request; deadline ngắn chỉ làm rơi event. Với lời gọi đồng bộ thì tôi sẽ dùng standard resilience handler: timeout từng lần thử, timeout tổng, retry có jitter chỉ cho thao tác idempotent, và circuit breaker để ngừng dồn tải vào service đang hỏng. Về rate limit, tôi lưu ý middleware của ASP.NET Core trả 503 mặc định và đếm riêng trong từng pod, nên muốn giới hạn toàn cục phải đếm trên Redis."

Điểm ăn điểm:
- Phân biệt lời gọi đồng bộ và event, giải thích được quyết định có vẻ ngược nguyên tắc.
- Biết retry nhân lên qua các lớp và chỉ retry ở một lớp.
- Biết hai chi tiết của rate limiter (503 mặc định, bộ đếm theo pod).

#### Câu hỏi vặn

- **"Kể một lần anh dùng Polly hoặc circuit breaker?"** Tôi chưa có lần triển khai Polly trên production để kể. Nếu làm cho lời gọi đồng bộ, tôi dùng `AddStandardResilienceHandler` với attempt timeout, total timeout, retry có jitter chỉ cho thao tác idempotent, và circuit breaker; event thì đưa qua hàng đợi bền.
- **"Code của anh không đặt deadline cho gRPC, vậy có mâu thuẫn với việc dùng timeout không?"** Không, nếu phân biệt hai loại lời gọi. Lời gọi đồng bộ trên đường request phải có deadline. Lời gọi gửi event đã tách khỏi request; deadline ngắn làm rơi event vì service nhận có lúc chậm vài giây.
- **"Thiết kế rate limiter 1.000 request/phút mỗi user trên 10 pod?"** Middleware trong bộ nhớ không đủ vì mỗi pod đếm riêng. Dùng sliding window hoặc token bucket bằng Lua trên Redis, key theo user, TTL bằng cửa sổ; Redis lỗi thì fallback về giới hạn cục bộ bằng một phần mười hạn mức mỗi pod. Trả `429` kèm `Retry-After`.
- **"Service A gọi B, B chậm. A nên làm gì?"** Timeout ngắn theo ngân sách thời gian của A, retry giới hạn có jitter nếu idempotent, circuit breaker để ngừng gọi khi B hỏng, bulkhead để B không ăn hết tài nguyên của A, và fallback hoặc tắt tính năng phụ. Nếu không cần kết quả ngay thì chuyển sang bất đồng bộ.
- **"Kể một lần anh dùng YARP?"** BFF đăng nhập dùng YARP proxy tới identity server và user service. Lõi BFF có sẵn khi tôi vào; tôi làm phần làm cứng: CORS theo danh sách trong config, chuyển endpoint token sang POST, cờ bật tắt captcha. Cấu hình route và cluster tôi đọc và giải thích được.

#### Bẫy cần tránh

- Nói "mọi lời gọi đều có timeout" trong khi code thật cố ý không đặt deadline cho event.
- Retry cho `POST` nộp bài không có idempotency key.
- Tin rằng rate limit trong bộ nhớ pod là giới hạn toàn cục.

#### Nhớ nhanh

- Timeout cho mọi lời gọi đồng bộ; retry chỉ khi idempotent, có backoff và jitter, ở một lớp.
- Circuit breaker: đóng, mở, half-open; bulkhead cô lập dependency.
- Rate limiter ASP.NET Core: mặc định 503, đếm theo pod; toàn cục cần Redis.
- YARP: route khớp request, cluster là đích; gắn policy theo route.

#### Bài tập

1. Gateway có 3 lớp: YARP → service A → service B. Mỗi lớp retry tối đa 2 lần (3 lần thử). B sập. Một request của user tạo ra tối đa bao nhiêu lời gọi tới B?
   **Đáp án:** 3 × 3 = 9 lời gọi tới B. Thêm một lớp nữa thì thành 27. Cách sửa: chỉ retry ở một lớp, có circuit breaker để ngừng gọi khi B đã sập.
### Bài 13.2. OAuth 2.0, OIDC, JWT và OWASP

#### Kiến thức

##### OAuth 2.0 và OIDC

**OAuth 2.0** là khung **ủy quyền**: client nhận access token để gọi API thay mặt user. **OIDC** thêm lớp **xác thực**: id token (JWT) cho biết user là ai, endpoint userinfo, và discovery (`/.well-known/openid-configuration`).

- **Authorization code + PKCE:** cho mọi client có người dùng. Client sinh `code_verifier` ngẫu nhiên, gửi `code_challenge = BASE64URL(SHA256(code_verifier))`; lúc đổi code lấy token phải gửi lại `code_verifier`. Kẻ chặn được code cũng không đổi được token.
- **Client credentials:** service gọi service, không có user.
- Implicit và password grant đã bị loại trong OAuth 2.1 và best current practice.
- **Access token** dành cho API; **id token** dành cho client, không gửi lên API.

##### JWT và BFF

JWT gồm header, payload, chữ ký. Kiểm tra đúng: chữ ký theo khóa từ JWKS (chọn theo `kid`, hỗ trợ xoay khóa); `iss`, `aud`, `exp`, `nbf` với độ lệch giờ nhỏ; **cố định thuật toán** để chặn `alg: none` và nhầm RS256 với HS256. JWT tự chứa nên khó thu hồi: access token ngắn hạn (5–15 phút), refresh token xoay vòng, phát hiện refresh token cũ bị dùng lại thì thu hồi cả chuỗi.

```csharp
builder.Services.AddAuthentication().AddJwtBearer(o =>
{
    o.Authority = "https://id.example.com";
    o.Audience = "exam-api";
    o.TokenValidationParameters.ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 };
    o.TokenValidationParameters.ClockSkew = TimeSpan.FromSeconds(30);
});
```

**BFF** (backend for frontend): token nằm ở server, trình duyệt chỉ giữ cookie `HttpOnly`, `SameSite=Lax`, nên XSS không đọc được token. Đổi lại phải chống CSRF (antiforgery) và chia sẻ data protection key giữa các pod.

##### OWASP Top 10

Bản 2025: A01 Broken Access Control (đã gộp SSRF), A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Logging & Alerting Failures, A10 Mishandling of Exceptional Conditions. Với API, lỗi hay gặp nhất là **IDOR/BOLA**: chỉ kiểm role mà không kiểm quyền trên từng resource (`attempt.UserId == currentUser`).

#### Cách show off

Kể theo mạch: hệ thống có gì sẵn, bạn làm gì thêm, vì sao, và chủ động nói điểm còn yếu. Ngoài phần trong lời nói mẫu, bạn còn đưa trang STEM (IOSTEM) vào SSO theo kiểu không giữ phiên phía server (PKCE sinh trong trình duyệt, token trong `sessionStorage`, `BroadcastChannel` đồng bộ giữa các tab), và khi nâng .NET 10 đã bỏ gói Elastic APM trọn bộ để loại một dependency có lỗ hổng.

> **Ví dụ:** "Lõi đăng nhập một lần, gồm luồng PKCE và nơi lưu phiên trên Redis, đã có khi tôi vào. Việc của tôi là đưa thêm hai sản phẩm vào SSO và làm cứng BFF. Với web thi, trình duyệt chặn cookie bên thứ ba nên kiểu đăng nhập im lặng qua iframe không chạy; tôi chuyển sang redirect cả trang, thêm thời gian chờ ngắn sau đăng xuất và cờ chống vòng lặp redirect. Với BFF, tôi chuyển các endpoint liên quan tới token sang POST để token không nằm trong URL và log, và giới hạn CORS theo danh sách trong config. Tôi cũng tự nhận là còn hai điểm cần sửa: một cấu hình CORS vẫn để dấu sao, và một private key đang nằm trong file config thay vì kho bí mật."

Điểm ăn điểm:
- Giải thích lý do kỹ thuật thật đằng sau lựa chọn (cookie bên thứ ba bị chặn nên phải redirect cả trang).
- Chủ động nêu điểm yếu còn tồn tại và cách sửa; người phỏng vấn đánh giá cao sự tự nhận thức về bảo mật.
- Phân biệt id token với access token, và nói IDOR là lỗi API phổ biến nhất.

#### Câu hỏi vặn

- **"Id token và access token khác nhau thế nào?"** Id token cho client biết user là ai, có `aud` là client. Access token để gọi API, có `aud` là API. Gửi id token lên API là dùng sai.
- **"Để token trong `sessionStorage` có an toàn không?"** Nó không bị gửi tự động như cookie nên tránh được CSRF, và mất khi đóng tab. Nhưng XSS đọc được, nên phải có CSP chặt và token ngắn hạn; nếu yêu cầu bảo mật cao hơn thì BFF giữ token ở server là lựa chọn tốt hơn.
- **"JWT khó thu hồi, xử lý thế nào?"** Access token ngắn hạn; refresh token xoay vòng và phát hiện dùng lại; cần thu hồi tức thì thì dùng phiên phía server (BFF với ticket trên Redis) hoặc danh sách thu hồi theo `jti` cho thao tác nhạy cảm.
- **"Anh biết CORS đang để `"*"` sao chưa sửa?"** [điền: lý do thực tế, ví dụ chờ lịch release hoặc chưa được giao]. Cách sửa là đọc danh sách origin từ config như đã làm ở BFF, và không bao giờ kết hợp `"*"` với cho phép credentials.
- **"Lỗi bảo mật API hay gặp nhất là gì, phòng thế nào?"** IDOR: user đổi id trên URL là đọc được dữ liệu của người khác vì API chỉ kiểm role. Phòng bằng kiểm quyền trên từng resource, lọc theo user hiện tại ngay trong truy vấn, và trả `404` để không lộ sự tồn tại.

#### Bẫy cần tránh

- Nhận cả hệ thống SSO là của mình.
- Nói "dùng JWT nên an toàn" mà không nói cách kiểm tra chữ ký, `aud`, thuật toán.
- Giấu điểm yếu đã biết; bị hỏi ra sau sẽ mất điểm hơn.

#### Nhớ nhanh

- OAuth là ủy quyền, OIDC thêm xác thực.
- Code flow cộng PKCE cho mọi client có người dùng; client credentials cho service.
- Kiểm JWT: chữ ký qua JWKS, `iss`, `aud`, `exp`, cố định thuật toán.
- IDOR là lỗi API hay gặp nhất; kiểm quyền theo resource.

#### Bài tập

1. Viết API ASP.NET Core có endpoint `GET /attempts/{id}`, chỉ kiểm role "student". Chứng minh lỗi IDOR rồi sửa.
   **Đáp án:** User A đọc được attempt của user B bằng cách đổi id. Sửa: lọc `WHERE Id = @id AND UserId = @currentUser` hoặc resource-based authorization; trả `404` để không lộ sự tồn tại.
### Bài 13.3. Test: xUnit, Testcontainers, TDD và load test với k6

#### Kiến thức

##### Kim tự tháp test và xUnit

- **Unit test:** logic thuần (chọn đề, tính quota, cooldown), nhanh, nhiều.
- **Integration test:** code cộng DB, Redis, Kafka thật; ít hơn, chậm hơn, nhưng bắt được lỗi mock không thấy (SQL sai, khóa, serialization).
- **Contract test** cho API giữa các team; **end-to-end** rất ít.

xUnit: `[Fact]` cho một trường hợp, `[Theory]` cộng `[InlineData]` cho bảng trường hợp. `IClassFixture<T>` dùng chung trong một class, `ICollectionFixture<T>` dùng chung giữa nhiều class, `IAsyncLifetime` cho khởi tạo bất đồng bộ. Các collection chạy song song, test trong một collection chạy tuần tự.

##### Testcontainers

Khởi động container thật cho mỗi lần chạy test, nên test chạy trên SQL Server và Redis thật thay vì mock hay provider InMemory (InMemory không có transaction, khóa hay stored procedure).

```csharp
public sealed class DbFixture : IAsyncLifetime
{
    public MsSqlContainer Sql { get; } = new MsSqlBuilder().Build();
    public async Task InitializeAsync() => await Sql.StartAsync();   // rồi chạy script schema, procedure
    public async Task DisposeAsync() => await Sql.DisposeAsync();
}

[CollectionDefinition("db")] public sealed class DbCollection : ICollectionFixture<DbFixture> { }

[Collection("db")]
public sealed class SubmitTests(DbFixture db)
{
    [Fact] public async Task Submit_twice_creates_one_result() { /* gọi proc hai lần, đếm dòng = 1 */ }
}
```

Dùng Respawn để xóa dữ liệu giữa các test. Chống test chập chờn: mỗi test tự tạo dữ liệu riêng, dùng `TimeProvider` và `FakeTimeProvider` thay giờ thật, chờ theo điều kiện thay vì `Thread.Sleep`.

##### TDD

Red (viết test fail) → green (code tối thiểu cho qua) → refactor. Hợp với logic thuần có nhiều trường hợp biên: viết bảng `[Theory]` trước rồi mới code. Không nên ép cho code nối dây, giao diện, hay code thăm dò khi yêu cầu chưa rõ.

##### k6

- Executor `ramping-vus`, `constant-vus` là mô hình **closed**: số user cố định, hệ chậm thì tải tự giảm và số đo trông đẹp giả. `constant-arrival-rate`, `ramping-arrival-rate` là mô hình **open**: request đến theo tốc độ đặt trước bất kể hệ chậm, đúng với lưu lượng thật hơn.
- **Threshold** làm test tự fail để dùng làm cổng chặn trong CI.
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

#### Cách show off

Test là chỗ dễ nói quá nhất. Cổng chặn merge bằng Testcontainers và k6 trước mỗi lần release chỉ là thiết kế; thực tế ít hơn nhiều. Nói thẳng thực trạng, rồi nói sẽ cải thiện theo thứ tự nào và vì sao.

> **Ví dụ:** "Nói thật là codebase tôi đang làm có ít unit test. Thứ tự động hóa có giá trị nhất hiện có là một bộ integration test chạy trên dữ liệu SQL mẫu cho logic sự kiện và ma trận đề, vì phần lớn logic nằm trong stored procedure, mock không kiểm được. Phần còn lại vẫn kiểm thử tay trên dev. Nếu được đầu tư, tôi sẽ bắt đầu bằng test procedure trên container SQL Server thật, ưu tiên những chỗ có ghi đồng thời như ghi kết quả một lần, vì đó là lỗi khó thấy khi test tay. Với load test, tôi chưa có lần chạy k6 nào có số để kể; nếu làm cho API bắt đầu thi, tôi dùng mô hình open để mô phỏng đầu ca thi, vì mô hình closed sẽ che mất tình trạng quá tải."

Điểm ăn điểm:
- Trung thực về thực trạng test, kèm lộ trình cải thiện có ưu tiên.
- Giải thích vì sao integration test trên DB thật quan trọng với hệ dùng stored procedure.
- Phân biệt mô hình open và closed trong load test; ít người nói được.

#### Câu hỏi vặn

- **"Vì sao dùng Testcontainers thay vì mock DB hay InMemory?"** Mock và InMemory không có transaction, khóa, stored procedure hay collation thật, nên test xanh mà production vẫn lỗi. Container SQL Server thật bắt được các lỗi đó; đổi lại test chậm hơn, nên giữ số lượng vừa phải và dùng chung container theo collection.
- **"Kể một lần anh dùng k6?"** Tôi chưa có lần chạy k6 nào có số liệu để kể. Nếu làm cho API bắt đầu thi, tôi dùng `ramping-arrival-rate` lên mức tải đầu ca thi trong vài phút, đặt threshold cho p95 và tỉ lệ lỗi, chạy trên staging và so với lần trước.
- **"Mô hình open và closed khác nhau thế nào?"** Closed giữ số user cố định, mỗi user chờ phản hồi rồi mới gửi tiếp, nên hệ chậm thì tải giảm theo và số đo đẹp giả. Open đặt tốc độ đến cố định như traffic thật, lộ ra hàng đợi khi hệ quá tải.
- **"Anh có làm TDD không?"** Tôi dùng cách viết bảng `[Theory]` trước cho logic có nhiều trường hợp biên như cooldown và quota. Tôi không ép TDD cho code nối dây hay code thăm dò khi yêu cầu còn đổi.
- **"Làm sao test được ghi đồng thời?"** Gọi procedure song song nhiều lần cùng một key, mỗi lời gọi một connection riêng, rồi kiểm tra bảng chỉ có một dòng. Bỏ khóa đi thì test phải đỏ; nếu không đỏ thì test chưa đủ áp lực.

#### Bẫy cần tránh

- Nói "chúng tôi có CI chặn merge bằng integration test" khi đó mới là thiết kế.
- Kể số k6 không có thật.
- Coi coverage cao là mục tiêu.

#### Nhớ nhanh

- Unit cho logic thuần, integration trên hạ tầng thật, ít end-to-end.
- Testcontainers cộng `ICollectionFixture` cộng Respawn là bộ ba hay dùng.
- TDD cho logic nhiều trường hợp biên; `TimeProvider` để test không phụ thuộc giờ.
- k6: mô hình open, threshold làm cổng chặn; không test được media WebRTC.

#### Bài tập

1. Viết fixture Testcontainers cho SQL Server, tạo bảng và procedure ghi kết quả có applock, viết test gọi procedure song song 10 lần cùng (user, vòng).
   **Đáp án:** Dùng `Task.WhenAll` 10 lời gọi, mỗi lời gọi một connection; assert bảng chỉ có 1 dòng. Bỏ applock để thấy test đỏ.
### Bài 13.4. Docker, Kubernetes và luồng triển khai

#### Kiến thức

##### Docker

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

Nhiều tầng giúp image chạy không chứa SDK, nhỏ và ít bề mặt tấn công. Image chiseled (Ubuntu tối giản) còn nhỏ hơn nữa.

##### Kubernetes

- **Deployment** quản lý ReplicaSet và rolling update; **Service** cho địa chỉ ổn định và cân bằng tải; **Ingress** đưa traffic từ ngoài vào; **ConfigMap, Secret** cho cấu hình.
- **Probe:** readiness quyết định pod có nhận traffic (DB chưa sẵn thì chưa ready); liveness quyết định có restart pod (chỉ kiểm process còn sống, **không** kiểm dependency, nếu không DB chậm sẽ làm mọi pod restart dây chuyền); startup probe cho app khởi động lâu.
- **Graceful shutdown:** Kubernetes gửi `SIGTERM`, app ngừng nhận request mới và xử lý nốt trong `HostOptions.ShutdownTimeout`; thêm `preStop` sleep ngắn để endpoint kịp bị gỡ khỏi Service.
- **Resource:** request để lập lịch, limit để chặn trên. CPU limit gây throttling (CFS chia CPU theo chu kỳ 100 ms) nên p99 có thể tăng dù CPU trung bình thấp.
- **HPA** scale theo CPU hoặc metric tùy chỉnh; **KEDA** scale theo consumer lag của Kafka.

```csharp
builder.Services.AddHealthChecks()
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
    .AddSqlServer(cfg.GetConnectionString("Main")!, tags: ["ready"]);   // gói AspNetCore.HealthChecks.SqlServer
app.MapHealthChecks("/healthz/live", new() { Predicate = r => r.Tags.Contains("live") });
app.MapHealthChecks("/healthz/ready", new() { Predicate = r => r.Tags.Contains("ready") });
```

##### Helm, Terraform, Argo CD và CI

- **Helm:** đóng gói manifest thành chart có template; `values.yaml` khác nhau theo môi trường; `helm upgrade --install`, `helm rollback`.
- **Terraform:** khai báo hạ tầng (cluster, mạng, registry); `plan` xem thay đổi trước khi `apply`; **state** lưu remote có khóa để hai người không apply cùng lúc; drift là khi hạ tầng thật lệch khỏi code. OpenTofu là nhánh mã nguồn mở tách ra sau khi Terraform đổi license.
- **CI** (GitLab CI, Jenkins): build, test, quét dependency, build image, đẩy registry. Jenkins shared library cho mọi repo dùng chung một pipeline.
- **Argo CD (GitOps):** cluster tự kéo trạng thái mong muốn từ repo cấu hình. CI chỉ cập nhật image tag; Argo CD thấy Git đổi thì sync. Rollback bằng `git revert`.
- **AKS:** Kubernetes do Azure quản lý control plane; node pool; tích hợp registry (ACR) và identity.

#### Cách show off

Ở mảng vận hành, ranh giới trải nghiệm phải rõ: trên hệ thống thi bạn không viết manifest, chỉ chạm Dockerfile và cấu hình khi nâng .NET 10. Ở dự án Examena, chuỗi Docker, Helm, Terraform, GitLab CI, Argo CD là thật; cloud cụ thể chưa xác nhận là Azure: [điền: cloud thật đã dùng ở Examena].

> **Ví dụ:** "Các service tôi làm chạy trên Kubernetes, build và deploy qua một Jenkins shared library mà mọi repo dùng chung. Manifest và cluster do bộ phận khác quản lý, tôi không viết. Phần tôi trực tiếp làm là Dockerfile và cấu hình khi nâng các service lên .NET 10, ví dụ worker xử lý Kafka. Ở dự án trước, team dùng chuỗi Terraform, Helm, GitLab CI và Argo CD: CI build image và cập nhật tag trong repo cấu hình, Argo CD kéo về và đồng bộ. Điều tôi luôn kiểm tra khi đưa service lên Kubernetes là readiness và liveness tách đúng vai, và app xử lý `SIGTERM` để rollout không làm rơi request."

Điểm ăn điểm:
- Nói rõ phần không phải của mình (manifest, cluster) mà không làm câu trả lời yếu đi.
- Phân biệt readiness và liveness bằng hậu quả: gắn DB vào liveness là restart dây chuyền.
- Biết CPU limit gây throttling làm tăng p99; đây là chi tiết người từng vận hành mới biết.

#### Câu hỏi vặn

- **"Kể một lần anh deploy service lên Kubernetes?"** Service của tôi chạy trên Kubernetes qua Jenkins shared library; manifest không phải tôi viết. Phần tôi làm là Dockerfile và cấu hình khi nâng service lên .NET 10. Tôi đọc và giải thích được Deployment, probe, resource của service đó.
- **"Readiness và liveness khác nhau thế nào?"** Readiness quyết định pod có nhận traffic, nên kiểm được dependency. Liveness quyết định restart, chỉ nên kiểm process còn chạy; gắn DB vào liveness thì DB chậm sẽ làm cả cụm restart dây chuyền.
- **"Vì sao CPU limit có thể làm tăng p99?"** Linux CFS chia CPU theo chu kỳ 100 ms; pod dùng hết hạn mức trong chu kỳ thì bị dừng tới chu kỳ sau. Request rơi vào lúc bị throttle chậm thêm hàng chục mili-giây dù CPU trung bình thấp.
- **"GitOps rollback thế nào?"** `git revert` commit đổi image tag trong repo cấu hình; Argo CD sync về trạng thái cũ. Có thể chọn bản trước trong lịch sử Argo CD, nhưng sau đó phải sửa Git cho khớp để không bị sync đè.
- **"Dự án đó chạy trên cloud nào?"** [điền: cloud thật đã dùng ở Examena]. Nếu không chắc, tôi nói không chắc thay vì đoán là Azure.

#### Bẫy cần tránh

- Nhận đã viết manifest hay quản lý cluster.
- Nói "đã dùng AKS" khi chưa xác nhận cloud.
- Gắn kiểm tra DB vào liveness probe.

#### Nhớ nhanh

- Dockerfile nhiều tầng, chạy non-root, cổng 8080 từ .NET 8.
- Readiness kiểm dependency, liveness chỉ kiểm process.
- `SIGTERM` cộng `preStop` cho graceful shutdown; CPU limit gây throttling.
- Terraform cho hạ tầng, Helm đóng gói, Argo CD kéo từ Git, CI build và cập nhật tag.

#### Bài tập

1. Dựng cluster bằng kind, viết Deployment 3 replica có readiness và liveness như ở trên, rồi chạy `kubectl rollout restart` trong lúc bắn tải.
   **Đáp án:** Có readiness và `preStop` thì tỉ lệ lỗi gần 0 trong lúc rollout; bỏ readiness thì thấy lỗi kết nối khi pod mới chưa sẵn sàng nhận traffic.
### Bài 13.5. Observability: trace, metric, log và SLO

#### Kiến thức

##### Ba tín hiệu

- **Trace:** một request đi qua nhiều service; mỗi bước là một **span** có thời gian, thuộc tính, quan hệ cha con. Trả lời "chậm ở đâu".
- **Metric:** số đo tổng hợp theo thời gian, rẻ để lưu lâu. Trả lời "có vấn đề không, từ khi nào".
- **Log:** sự kiện chi tiết. Gắn `trace_id` vào log để nhảy từ trace sang log.

##### OpenTelemetry trong .NET

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
- **Sampling:** head-based rẻ nhưng có thể bỏ sót trace lỗi; tail-based ở OpenTelemetry Collector giữ lại trace lỗi hoặc chậm.

##### Prometheus và Grafana

Bốn kiểu metric: **counter** (chỉ tăng), **gauge** (lên xuống), **histogram** (đếm theo bucket, dùng cho latency), summary (percentile tính sẵn ở client, không cộng được giữa các pod).

```promql
# Request/giây theo route
sum by (http_route) (rate(http_server_request_duration_seconds_count[5m]))

# p95 latency tính từ histogram, gộp mọi pod
histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_seconds_bucket{http_route="/exam/start"}[5m])))
```

- Không lấy trung bình p95 của các pod: percentile không cộng được; phải gộp bucket rồi mới tính.
- **Biên bucket:** ngưỡng `le` trong PromQL phải trùng một biên bucket có thật. Histogram `http.server.request.duration` của ASP.NET Core có biên mặc định 0,005; 0,01; 0,025; 0,05; 0,075; 0,1; 0,25; 0,5; 0,75; 1; 2,5; 5; 7,5; 10 giây, không có 0,3. Muốn SLO ngưỡng 300 ms phải khai báo bucket riêng qua `AddView` với `ExplicitBucketHistogramConfiguration`, hoặc chọn ngưỡng 250 ms.
- **Cardinality:** mỗi tổ hợp label là một time series. Đưa `userId` hay URL có ID vào label làm Prometheus phình bộ nhớ.
- **Grafana:** mỗi service một dashboard **RED** (Rate, Errors, Duration); tài nguyên theo **USE** (Utilization, Saturation, Errors).

##### Elastic APM

Elastic APM ghi **transaction** (một request) và **span** (SQL, Redis, HTTP ra ngoài, gRPC) cho từng request, và nhận được cả dữ liệu OTLP. Log ứng dụng có thể đi theo NLog → Kafka → Elasticsearch.

##### SLO và burn rate

- **SLI** là số đo (tỉ lệ request nhanh hơn ngưỡng); **SLO** là mục tiêu nội bộ (99% trong 30 ngày); **SLA** là cam kết với khách hàng có chế tài.
- **Error budget** = 1 − SLO. SLO 99,9% trong 30 ngày cho phép 0,1% request xấu, tương đương khoảng 43 phút nếu tính theo thời gian.
- **Burn-rate alert** nhiều cửa sổ: page khi burn rate từ 14,4 trở lên trên cả cửa sổ 1 giờ và 5 phút (tiêu 2% budget trong 1 giờ); mở ticket khi burn chậm kéo dài. Page theo triệu chứng người dùng thấy, không theo nguyên nhân như CPU cao.

#### Cách show off

Elastic APM là công cụ bạn dùng thật và mạnh nhất ở mảng này. Metric Prometheus của worker Kafka có sẵn do người khác thiết kế; OpenTelemetry và SLO bạn chưa triển khai thật.

> **Ví dụ:** "Công cụ quan sát tôi dùng nhiều nhất là Elastic APM. Trong đợt rà soát hiệu năng, tôi lọc các endpoint chậm nhất rồi mở trace xem từng span. Một ca rất rõ là API bắt đầu thi thử mất hơn 2 giây; trace cho thấy trong một request có hàng trăm lệnh `SCAN` trên Redis, tức là code đang quét keyspace để xóa cache ngay trên đường người dùng chờ. Với các span SQL, tôi lấy tên procedure rồi xuống DMV xem plan và kiểu chờ. Bản sửa cho API đó do đồng nghiệp làm, sau sửa trace xuống dưới 0,1 giây; phần tôi là tìm ra nguyên nhân và viết vào báo cáo. OpenTelemetry và SLO thì tôi chưa triển khai thật, nhưng nếu làm, tôi sẽ định nghĩa SLO dạng tỉ lệ request nhanh hơn một ngưỡng trùng biên bucket của histogram và cảnh báo theo burn rate."

Điểm ăn điểm:
- Đi từ trace tới nguyên nhân gốc, rồi xuống DMV; cho thấy quy trình chứ không chỉ công cụ.
- Biết percentile không cộng được và ngưỡng SLO phải trùng biên bucket.
- Phân biệt rõ phần phân tích của mình với commit sửa của đồng nghiệp.

#### Câu hỏi vặn

- **"Con số hơn 2 giây đó đo thế nào, sau khi sửa còn bao nhiêu?"** Đo bằng trace của Elastic APM trên endpoint đó trước khi sửa. Sau khi đồng nghiệp sửa bằng cách lưu danh sách key cần xóa trong một SET thay vì quét keyspace, trace cùng endpoint xuống dưới 0,1 giây. Tôi nói rõ bản sửa không phải của tôi; phần của tôi là chỉ ra nguyên nhân.
- **"Vì sao không lấy trung bình p95 của các pod?"** Percentile không cộng hay lấy trung bình được; pod ít traffic nhưng chậm sẽ kéo lệch. Phải cộng bucket histogram của mọi pod rồi mới `histogram_quantile`, hoặc định nghĩa SLO dạng tỉ lệ request tốt vì tỉ lệ thì cộng được.
- **"SLO 300 ms, anh viết PromQL thế nào?"** Đếm request có `le="0.3"` chia tổng request. Nhưng histogram mặc định của ASP.NET Core không có biên 0,3 giây, nên phải khai báo bucket riêng hoặc đổi ngưỡng thành 0,25 giây.
- **"Burn-rate alert là gì?"** Burn rate là tốc độ tiêu error budget so với mức tiêu đều. Burn rate 14,4 kéo dài 1 giờ tiêu 2% budget 30 ngày; cảnh báo khi cả cửa sổ dài và cửa sổ ngắn cùng vượt ngưỡng để vừa chắc chắn vừa tự tắt nhanh khi sự cố hết.
- **"Kể một lần anh dùng Prometheus?"** Worker Kafka kết thúc game có sẵn metric Prometheus: số message đã xử lý, thời gian xử lý, số lỗi theo loại, kèm health check. Bộ metric đó không phải tôi thiết kế; tôi đọc và viết được PromQL cho lag và latency.
#### Bẫy cần tránh

- Nhận commit sửa API bắt đầu thi thử là của mình.
- Viết `le="0.3"` khi histogram không có bucket 0,3.
- Nói "chúng tôi có SLO" khi chưa định nghĩa SLI và cửa sổ đo.

#### Nhớ nhanh

- Trace trả lời "chậm ở đâu", metric "có vấn đề không", log "chuyện gì xảy ra"; nối bằng `trace_id`.
- OpenTelemetry xuất OTLP; Kafka phải tự truyền `traceparent`.
- Percentile tính từ bucket gộp; ngưỡng phải trùng biên bucket; tránh label cardinality cao.
- SLO dạng tỉ lệ, cảnh báo theo burn rate nhiều cửa sổ.

#### Bài tập

1. Với SLO 99% request `/exam/start` dưới ngưỡng trong 30 ngày, tính error budget khi có 50 triệu request mỗi tháng, và burn rate khi 1 giờ qua có 8% request chậm.
   **Đáp án:** Budget là 1% của 50 triệu, tức 500.000 request chậm. Burn rate = 8% / 1% = 8: nếu kéo dài, budget hết trong khoảng 30 / 8 ≈ 3,75 ngày.

## Chương 14. Realtime, AI và cách làm việc

Chương cuối của phần này gom ba nhóm chủ đề ít liên quan về kỹ thuật nhưng hay xuất hiện ở cuối buổi phỏng vấn: video thời gian thực (WebRTC, SFU), đưa mô hình ngôn ngữ lớn vào production có người kiểm, và cách làm việc của một senior (Scrum, code review, design doc, postmortem).

Hai bài đầu là nền tảng kỹ thuật, có câu chuyện thật nhưng phải nói đúng phạm vi. Bài cuối ít số liệu nhất, nên trọng tâm là kể được ví dụ cụ thể, đúng sự thật, theo khung rõ ràng.

### Bài 14.1. WebRTC và SFU cho giám sát thi bằng video

#### Kiến thức

##### Thành phần của WebRTC

- **Media capture:** `getUserMedia` lấy camera, micro; `getDisplayMedia` lấy màn hình.
- **`RTCPeerConnection`:** kết nối media và data giữa hai đầu.
- **Signaling:** trao đổi SDP (offer, answer) và ICE candidate. WebRTC **không chuẩn hóa** signaling; thường tự làm qua WebSocket.
- **ICE:** tìm đường kết nối. **STUN** cho biết địa chỉ công khai của client; **TURN** chuyển tiếp media khi NAT hoặc firewall không cho kết nối trực tiếp, tốn băng thông server.
- **Bảo mật:** media mã hóa bằng **DTLS-SRTP**, bắt buộc.

##### Mesh, SFU, MCU

Ví dụ phòng thi có 1 giám thị xem 25 thí sinh, mỗi luồng 500 kbps:
- **Mesh:** mọi peer nối trực tiếp. Nếu mỗi thí sinh phải gửi cho nhiều người xem, mỗi người gửi N luồng; uplink của client là giới hạn, không scale.
- **SFU (Selective Forwarding Unit):** mỗi thí sinh gửi **1 luồng** lên server; server chỉ chuyển tiếp, không giải mã. Giám thị nhận 25 luồng, nên dùng **simulcast** (client gửi nhiều lớp chất lượng) để giám thị xem dạng lưới chỉ nhận lớp thấp.
- **MCU:** server giải mã và trộn thành một luồng. Client nhẹ nhất nhưng server tốn CPU rất lớn, thêm độ trễ và mất linh hoạt bố cục.

Ước lượng băng thông vào SFU cho 3.000 thí sinh: 3.000 × 300–500 kbps ≈ 0,9–1,5 Gbps.

##### mediasoup

- **Worker:** process C++, mỗi worker gắn một CPU core. Tài liệu mediasoup cho biết một worker thường chịu khoảng 500 consumer, tùy CPU.
- **Router:** nằm trong worker, thường một phòng một router. Thí sinh có **producer**, giám thị có **consumer**, kết nối qua `WebRtcTransport`.
- Phòng vượt một worker: `pipeToRouter` nối router giữa các worker.
- Ghi hình: `PlainTransport` đẩy RTP sang FFmpeg hoặc GStreamer.
- Thí sinh rớt mạng: ICE restart, client tự nối lại, giám thị thấy trạng thái mất kết nối.

#### Cách show off

Ở Examena, chuyển từ mesh sang SFU dùng mediasoup là thật; số worker trong tài liệu cũ là minh họa vì bạn không nhớ cấu hình. Kể lý do chuyển kiến trúc bằng phép tính băng thông; với số worker thì trình bày cách ước lượng.

> **Ví dụ:** "Ở Examena, hệ thống thi có giám sát bằng camera. Bản đầu dùng mesh, tức thí sinh gửi video trực tiếp cho từng người xem, nên mỗi người xem thêm là uplink của thí sinh phải gánh thêm một luồng, mà mạng nhà học sinh thì rất yếu. Team chuyển sang SFU dùng mediasoup: mỗi thí sinh chỉ gửi một luồng lên server, server chuyển tiếp cho giám thị, và dùng simulcast để giám thị xem lưới chỉ nhận chất lượng thấp. Kỳ thi thật có hơn ba nghìn thí sinh cùng lúc. Cấu hình số worker chính xác tôi không nhớ, nên tôi chỉ nói cách ước lượng: mỗi worker chịu khoảng vài trăm consumer tùy CPU, từ đó tính số worker rồi cộng dư phòng."

Điểm ăn điểm:
- Lý do chuyển kiến trúc nằm ở uplink của client, nói bằng một phép tính đơn giản.
- Biết simulcast giải quyết phía người xem nhiều luồng.
- Nói "tôi không nhớ, đây là cách ước lượng" thay vì đưa một con số không kiểm chứng.

#### Câu hỏi vặn

- **"Mesh, SFU và MCU khác nhau thế nào?"** Mesh: peer nối trực tiếp, mỗi peer gửi N luồng, không scale. SFU: server chuyển tiếp, mỗi người gửi một luồng và nhận nhiều luồng. MCU: server trộn thành một luồng, client nhẹ nhưng server tốn CPU và thêm độ trễ.
- **"Hệ thống đó dùng bao nhiêu worker?"** Tôi không nhớ cấu hình chính xác nên không nêu số. Cách ước lượng: tổng số consumer chia khả năng mỗi worker, khoảng vài trăm tùy CPU, rồi cộng dư phòng và tính theo số core của máy.
- **"Khi nào cần TURN?"** Khi hai đầu không nối trực tiếp được, như NAT đối xứng hay firewall doanh nghiệp chặn UDP. TURN chuyển tiếp toàn bộ media nên tốn băng thông server; cần hỗ trợ TURN qua TCP hoặc TLS cổng 443 cho mạng khó.
- **"Load test hệ thống video thế nào?"** k6 không giả lập được media WebRTC, chỉ test được phần signaling qua WebSocket. Media phải dùng client headless thật (trình duyệt tự động hóa hoặc công cụ chuyên dụng) gửi luồng giả, và đo CPU, băng thông của SFU.
- **"Phần nào là của anh trong việc chuyển sang SFU?"** [điền: vai trò cụ thể trong đợt chuyển sang SFU ở Examena, ví dụ thiết kế, review hay code phần signaling]. Tôi chỉ nhận đúng phần đó và nói phần còn lại là của team.

#### Bẫy cần tránh

- Nêu số worker như cấu hình thật.
- Nói SFU "giảm băng thông" chung chung; nó giảm uplink của client, server vẫn nhận và gửi nhiều luồng.
- Quên rằng k6 không test được media.

#### Nhớ nhanh

- WebRTC: signaling tự làm, ICE với STUN và TURN, DTLS-SRTP bắt buộc.
- SFU: mỗi người gửi một luồng, server chỉ chuyển tiếp; simulcast cho người xem nhiều luồng.
- mediasoup: worker theo core, router theo phòng, producer và consumer.
- Chuyển mesh sang SFU là thật; số worker chỉ là ước lượng.

#### Bài tập

1. Tính băng thông uplink của một thí sinh và downlink của giám thị trong phòng 25 thí sinh, luồng 500 kbps, cho mesh (giám thị và 2 giám sát viên cùng xem) và SFU có simulcast lớp thấp 150 kbps.
   **Đáp án:** Mesh: mỗi thí sinh gửi 3 luồng, 1,5 Mbps uplink; giám thị nhận 25 × 500 = 12,5 Mbps. SFU: thí sinh gửi 1 luồng (các lớp simulcast cộng lại khoảng 700 kbps); giám thị nhận 25 × 150 ≈ 3,75 Mbps.
### Bài 14.2. Đưa LLM vào production có người kiểm

#### Kiến thức

##### Gọi LLM trong production

- **Bất đồng bộ:** suy luận mất từ vài giây tới vài phút; không giữ HTTP request chờ. Dùng job cộng callback (webhook) hoặc polling. Callback cần xác thực (API key, chữ ký HMAC) và xử lý idempotent qua bảng inbox vì có thể đến trùng.
- **Timeout và retry** cho lỗi 429 và 5xx, có backoff; giới hạn số lần và **ngân sách chi phí** theo người dùng hoặc theo lô.
- **Structured output:** yêu cầu JSON theo schema, validate phía server; sai format thì retry có giới hạn hoặc chuyển người xử lý.
- **Ghi lại** phiên bản prompt, model, số token, độ trễ, chi phí cho mỗi lần gọi.

##### Human-in-the-loop và đo độ chính xác

Mô hình **đề xuất**, người **xác nhận**. Để biết AI tốt tới đâu phải đo trên dữ liệu thật:
- Chụp lại **bản gốc của AI** trước khi người sửa.
- Mỗi lần người lưu, so bản AI với bản người theo **từng field**: thêm, bỏ, đổi giá trị.
- Tính độ chính xác theo field và theo lô; dùng nó để quyết định field nào tin được tự động, field nào luôn cần người.
- Bước đánh giá lỗi thì chỉ ghi log, **không làm hỏng** thao tác chính của người duyệt.

Bổ sung theo best practice: **golden set** (bộ dữ liệu có đáp án do người làm) để chạy hồi quy mỗi khi đổi prompt hoặc model; dùng LLM làm giám khảo chỉ sau khi đã đối chiếu với người chấm, vì nó có thiên lệch.

##### Bảo mật

- **Prompt injection:** nội dung người dùng chứa chỉ dẫn ghi đè prompt. Tách rõ chỉ dẫn và dữ liệu, không cho model gọi công cụ có tác dụng phụ dựa trên nội dung chưa tin cậy, validate output.
- **Dữ liệu cá nhân:** chỉ gửi trường cần thiết, che thông tin cá nhân, xem điều khoản lưu dữ liệu của nhà cung cấp.

#### Cách show off

Câu chuyện AI tốt nhất không phải "tôi gọi API của model" mà là "tôi làm cho việc dùng AI đo được và an toàn". Câu chuyện thứ hai, ngoài lời nói mẫu, là chấm IELTS Writing bằng AI: bạn viết phần lớn proxy (gửi bài kèm callback, callback xác thực bằng API key và ghi vào bảng inbox, giới hạn số lần nộp, các trạng thái chờ chấm, đã chấm, lỗi, hết quota, AI quá tải); phần ghép callback với bài nộp qua Redis do đồng nghiệp viết.

> **Ví dụ:** "Sau đợt sáp nhập địa giới, phải cập nhật lại thông tin đơn vị cho rất nhiều trường học, và team dùng AI để trích xuất bản nháp, người duyệt sửa lại trên trang quản trị. Phần tôi làm là trả lời câu hỏi 'AI đúng tới đâu'. Lần đầu người duyệt lưu, hệ thống chụp lại bản gốc của AI; mỗi lần lưu sau đó so bản AI với bản người theo từng trường, ghi lại trường nào AI đề xuất, trường nào bị sửa, sửa thế nào. Tôi cố ý để bước đánh giá chỉ ghi log khi lỗi, vì nó không được làm hỏng thao tác chính của người duyệt. Hiện đã có hàng chục nghìn trường đi qua luồng này, nhưng tôi chưa tính tỉ lệ đúng trên production, nên tôi không nêu con số độ chính xác."

Điểm ăn điểm:
- Thiết kế để đo chất lượng AI trên dữ liệu thật, không chỉ "tích hợp AI".
- Bước phụ không được làm hỏng bước chính: một nguyên tắc vận hành rõ ràng.
- Gọi AI bất đồng bộ qua callback có xác thực và inbox: áp đúng kiến thức idempotency vào bài toán mới.

#### Câu hỏi vặn

- **"AI đúng bao nhiêu phần trăm?"** Tôi chưa tính tỉ lệ đúng trên production nên không nêu số. Dữ liệu để tính đã có: với mỗi phiếu có số trường AI đề xuất và số trường bị sửa. Cách tính là một trừ tỉ lệ trường sai trên trường đề xuất, theo lô và theo từng loại trường: [điền: tỉ lệ khi đã tính].
- **"Vì sao chấm bài bằng AI dùng callback mà không giữ request?"** Chấm mất từ vài giây tới vài phút, giữ request thì tốn connection và dễ timeout. Callback ghi vào bảng inbox giúp xử lý idempotent khi callback đến trùng, và trạng thái bài nộp cho giao diện biết đang chờ.
- **"Phần nào trong proxy chấm IELTS là của anh?"** Tôi viết phần lớn proxy: gửi bài kèm callback, xác thực callback, ghi inbox, giới hạn số lần nộp và các trạng thái. Phần ghép callback với bài nộp qua Redis là đồng nghiệp viết.
- **"Khi nào bỏ được bước người duyệt?"** Khi có số đo độ chính xác theo field đủ dài trên dữ liệu thật và field đó vượt ngưỡng đã thống nhất với nghiệp vụ; vẫn lấy mẫu kiểm tra định kỳ. Field ảnh hưởng lớn như mã đơn vị có thể luôn giữ người duyệt.
- **"Đổi prompt hay đổi model thì sao biết không tệ đi?"** Cần một golden set có đáp án do người làm, chạy lại mỗi lần đổi và so theo từng field. Luồng đánh giá hiện có cho dữ liệu production; golden set là phần tôi sẽ bổ sung.

#### Bẫy cần tránh

- Nêu tỉ lệ chính xác khi chưa tính.
- Nhận phần ghép callback qua Redis là của mình.
- Kể chuyện AI như demo, không có phần đo lường và xử lý lỗi.

#### Nhớ nhanh

- LLM trong production: bất đồng bộ, timeout, retry 429 và 5xx, ngân sách, structured output.
- Human-in-the-loop: chụp bản AI, so theo field, đo trên production.
- Callback cần xác thực và inbox để idempotent.
- Bước đánh giá lỗi chỉ ghi log, không làm hỏng thao tác chính.

#### Bài tập

1. Viết hàm so sánh hai object JSON phiếu (bản AI và bản người) theo từng field, trả danh sách thay đổi `{field, ai, human, kind}` với `kind` là thêm, bỏ hoặc đổi.
   **Đáp án:** Duyệt hợp các key của hai bên: chỉ có ở người là thêm, chỉ có ở AI là bỏ, khác giá trị là đổi; danh sách con (danh sách trường học) so theo khóa định danh thay vì theo vị trí.
### Bài 14.3. Scrum, code review, design doc và postmortem

#### Kiến thức

##### Agile và Scrum

Scrum có ba vai trò (Product Owner, Scrum Master, Developers), các sự kiện trong sprint 1–4 tuần (thường 1–2 tuần): **planning**, **daily**, **review** (demo cho bên liên quan), **retrospective** (cải tiến cách làm); artifact là product backlog, sprint backlog, increment cùng **definition of done**. Kanban là lựa chọn cho team có nhiều việc đến bất chợt: không có sprint, giới hạn số việc đang làm (WIP), đo lead time. Người phỏng vấn không cần bạn đọc sách; họ hỏi team bạn làm khác sách ở đâu và vì sao.

##### Code review

Thứ tự ưu tiên: **đúng đắn** (logic, race, xử lý lỗi, idempotency) → **bảo mật** (quyền, injection, secret) → **hiệu năng** (N+1, truy vấn không sargable, gọi trong vòng lặp) → **dễ đọc**. PR nhỏ, một mục đích. Comment nêu vấn đề, tác động, đề xuất cụ thể, và phân biệt "bắt buộc" với "gợi ý"; không bình luận về người. Lỗi lặp lại nhiều lần thì đưa vào linter hoặc checklist thay vì nhắc tay.

##### Design doc và ADR

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

##### Postmortem blameless

```text
Tóm tắt | Ảnh hưởng (bao nhiêu user, bao lâu) | Timeline | Nguyên nhân gốc (5 Whys)
| Yếu tố góp phần | Điều làm tốt | Điều chưa tốt | Hành động (người chịu trách nhiệm, hạn)
```

Blameless nghĩa là tìm lỗ hổng của hệ thống và quy trình, không tìm người để trách, để người trong cuộc dám kể đủ chi tiết. Action item phải cụ thể, có chủ và có hạn, không phải "cẩn thận hơn".

#### Cách show off

Trả lời bằng ví dụ cụ thể theo khung tình huống, việc mình làm, kết quả, bài học. Ngoài báo cáo rà soát trong lời nói mẫu, bạn có hai ví dụ khác: vai trò Team Lead team tám người ở Examena (thiết kế kỹ thuật, chia việc, review code, release), và một lần tự mình làm sai khi đưa engine tạo lượt làm bài mới lên (xem câu hỏi vặn).

> **Ví dụ:** "Tài liệu kỹ thuật có ảnh hưởng nhất tôi viết là báo cáo rà soát hiệu năng sáu cụm SQL Server. Tôi đi từ những endpoint chậm trên APM xuống DMV rồi tới code, và viết báo cáo theo khung: phát hiện, nguyên nhân, mức ưu tiên, ai làm. Tôi chia kế hoạch hai tầng: sửa procedure trong ngày vì rủi ro thấp, còn tạo index trên bảng lớn thì để ca đêm, vì bản Standard không tạo index online được. Các bản sửa do team cùng triển khai, phần tôi trực tiếp code là cache. Bài học của tôi là báo cáo có đối chứng và có thứ tự ưu tiên thì Dev và DBA ra quyết định nhanh hơn nhiều so với một danh sách vấn đề."

Điểm ăn điểm:
- Dùng đúng động từ cho vai trò: dẫn điều tra, đề xuất, team triển khai.
- Kể được một lần sai của chính mình kèm bài học cụ thể; người phỏng vấn đánh giá cao sự trung thực này.
- Nói team làm khác sách ở đâu và vì sao, thay vì đọc định nghĩa Scrum.

#### Câu hỏi vặn

- **"Kể một lần anh chặn một PR?"** [điền: ví dụ PR thật ở Examena]. Kể theo khung: PR làm gì, vấn đề thấy được (đúng đắn, bảo mật hay hiệu năng), đề xuất gì, kết quả ra sao. Nếu không nhớ ví dụ cụ thể thì nói tiêu chí review mình dùng, không dựng chuyện.
- **"Kể một lần anh sai và sửa thế nào?"** Khi đưa engine tạo lượt làm bài phiên bản mới lên, có cờ config để quay về đường cũ, nhưng tôi hard-code cờ thành bật ngay trong ngày để gọn code. Hệ quả là muốn rollback phải deploy lại thay vì đổi config. Bài học: giữ cờ trong config tới hết đợt chạy thật đầu tiên rồi mới dọn.
- **"Team anh chạy Scrum khác sách ở đâu?"** [điền: quy trình thật của team]. Trả lời theo thực tế; nếu team không chạy Scrum thì nói thẳng quy trình thật (ví dụ Kanban theo sự kiện, release theo mùa thi) và vì sao nó hợp. Không nhận Scrum khi không làm.
- **"Postmortem blameless nghĩa là gì?"** Tập trung vào hệ thống và quy trình đã cho phép lỗi xảy ra, không quy trách nhiệm cá nhân, để người trong cuộc kể đủ sự thật. Kết quả là action item cụ thể có người chịu trách nhiệm và hạn.
- **"Báo cáo đó, phần nào anh làm, phần nào team làm?"** Tôi dẫn cuộc điều tra: thu thập từ APM và DMV, phân tích nguyên nhân, viết báo cáo và kế hoạch. Các bản sửa do team triển khai theo kế hoạch; phần tôi trực tiếp code là sửa cache.
#### Bẫy cần tránh

- Nhận "tôi đã tối ưu hệ thống" khi vai trò là dẫn điều tra và các bản sửa của team.
- Dựng chuyện review PR khi không nhớ ví dụ.
- Kể "một lần sai" mà thật ra là khoe khéo; chọn lỗi thật có hệ quả thật.

#### Nhớ nhanh

- Scrum: vai trò, sự kiện, definition of done; nói được team mình khác sách ở đâu.
- Review: đúng → an toàn → nhanh → dễ đọc; comment có lý do và đề xuất.
- Design doc luôn có phương án đã loại và cách rollback; ADR cho từng quyết định.
- Postmortem blameless: action item có chủ và có hạn.

#### Bài tập

1. Viết postmortem 1 trang cho sự cố "API bắt đầu thi thử mất hơn 2 giây" theo mẫu ở trên.
   **Đáp án:** Nguyên nhân gốc theo 5 Whys: luồng trừ lượt thi gọi hàm làm mới cache → hàm xóa key bằng `SCAN` toàn keyspace → Redis đơn luồng nên chặn client khác → thiết kế không lưu danh sách key cần xóa. Action item: cấm `SCAN`/`KEYS` trên đường nóng trong checklist review, cảnh báo theo latency API. Ghi đúng ai commit bản sửa.