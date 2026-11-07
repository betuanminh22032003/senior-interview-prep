## Chương 20. Server và vận hành
Các chương trước làm việc với từng câu lệnh và từng index. Chương này lùi ra một bước, nhìn cả instance: bộ nhớ, song song, tempdb, transaction log và chuyện dữ liệu cũ tích tụ theo năm tháng. Trong đợt rà soát hiệu năng các cụm SQL Server của hệ thống thi mà bạn dẫn, nhóm vấn đề này cho nhiều cảnh báo đỏ nhất. Nguyên nhân hiếm khi phức tạp: cấu hình để nguyên như lúc cài, không có job backup log, tempdb nằm trên ổ hệ điều hành, bảng backup tạo tay không ai dọn.

Người phỏng vấn hay hỏi mảng này vì nó tách người chỉ viết query khỏi người từng chịu trách nhiệm một hệ thống chạy thật. Câu hỏi thường mở bằng một triệu chứng ("log đầy", "ổ C hết chỗ", "SQL Server ăn hết RAM") và chờ xem bạn có đi đúng thứ tự không: đo gì trước, nguyên nhân gốc là gì, sửa thế nào mà không mất dữ liệu.

### Bài 20.1. Cấu hình instance

#### Kiến thức
Một instance SQL Server mới cài chạy được ngay, nhưng vài giá trị mặc định được đặt từ thời phần cứng khác hẳn bây giờ. Bốn thiết lập dưới đây gần như luôn phải xem lại.

##### Bộ nhớ: max server memory
SQL Server dùng phần lớn RAM cho buffer pool (cache các trang dữ liệu 8 KB) và plan cache. Mặc định `max server memory` gần như không giới hạn, nên SQL Server chiếm RAM tới khi Windows báo thiếu rồi mới nhả ra. Vấn đề là ngoài buffer pool, tiến trình còn cần bộ nhớ cho thread stack của worker, CLR, linked server provider, backup buffer; hệ điều hành, agent giám sát, antivirus cũng cần RAM. Khi OS thiếu, nó ép SQL Server trả bộ nhớ, hiệu năng dao động, nặng hơn là phân trang ra đĩa.

Quy tắc khởi điểm: chừa cho OS khoảng 10–20% RAM, tối thiểu 4 GB, rồi theo dõi counter `Available MBytes` của Windows để chỉnh.

```sql
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'max server memory (MB)', 27648;  -- máy 32 GB
RECONFIGURE;
```

Hai quyền Windows đi kèm: **Lock Pages in Memory** (OS không đẩy buffer pool ra pagefile; chỉ bật khi đã đặt `max server memory`) và **Instant File Initialization** (file data cấp phát không phải ghi số 0, tăng file và restore nhanh hơn nhiều; file log vẫn phải ghi số 0, trừ các lần tăng nhỏ tới 64 MB từ SQL Server 2022).

##### Song song: cost threshold và MAXDOP
Optimizer chỉ cân nhắc plan song song khi cost ước lượng của plan tuần tự vượt `cost threshold for parallelism`. Mặc định là 5, quá thấp với phần cứng hiện nay: cả truy vấn OLTP nhỏ cũng chạy song song, tốn thêm worker và thời gian đồng bộ giữa các luồng (wait `CXPACKET`) mà nhanh hơn không đáng kể.

`max degree of parallelism` (MAXDOP) giới hạn số luồng cho một toán tử song song. Hướng dẫn của Microsoft: không vượt số logical processor của một NUMA node, và thường không quá 8.

```sql
EXEC sp_configure 'cost threshold for parallelism', 50;
EXEC sp_configure 'max degree of parallelism', 8;
RECONFIGURE;
```

50 là điểm khởi đầu phổ biến, không phải đáp án cho mọi hệ thống. Cách chỉnh có căn cứ: lấy phân bố cost (`StatementSubTreeCost`) của các plan trong cache, chọn ngưỡng sao cho truy vấn OLTP nằm dưới, truy vấn báo cáo nằm trên.

##### Plan cache và các thiết lập nhỏ
Ứng dụng gửi SQL ghép chuỗi sinh mỗi câu một plan dùng đúng một lần, chiếm chỗ plan cache. `optimize for ad hoc workloads` cho lần chạy đầu chỉ lưu một plan stub vài trăm byte, lần thứ hai mới lưu plan đầy đủ. `backup compression default = 1` làm backup nhỏ hơn và thường nhanh hơn vì bớt I/O, đổi lại tốn CPU lúc backup.

```sql
SELECT objtype, COUNT(*) AS plans,
       SUM(CAST(size_in_bytes AS bigint)) / 1048576 AS size_mb
FROM sys.dm_exec_cached_plans
WHERE usecounts = 1
GROUP BY objtype;   -- plan chỉ dùng một lần đang chiếm bao nhiêu
```

##### Bản vá và cách thay đổi an toàn
Từ SQL Server 2017 chỉ còn Cumulative Update (CU). Một bản RTM chưa cài CU nào đang thiếu hàng trăm bản sửa lỗi, có cả lỗi optimizer. Cài CU trong khung bảo trì, thử ở môi trường test trước, có kế hoạch gỡ.

Về rủi ro triển khai: các lệnh `sp_configure` ở trên có hiệu lực ngay sau `RECONFIGURE`, không cần restart. Hạ `max server memory` làm SQL Server nhả buffer pool dần, nên làm ngoài giờ cao điểm. Đổi cost threshold hay MAXDOP làm mất plan cache liên quan, CPU tăng ngắn vì biên dịch lại. Cài CU, cấp Lock Pages in Memory và IFI cần restart service.

> **Cảnh báo:** Đặt MAXDOP = 1 toàn server để "hết CXPACKET" làm truy vấn báo cáo chậm hẳn. Giới hạn song song nên làm ở cost threshold, hoặc từng truy vấn bằng hint.

#### Cách show off
Câu chuyện thật của bạn ở đây là phát hiện, không phải tự tay đổi cấu hình: trong đợt rà soát, bạn chạy `sp_Blitz` và đọc `sys.configurations` trên từng cụm, thấy một cụm lưu log luyện tập vẫn để nguyên mặc định (không giới hạn bộ nhớ, cost threshold 5, chưa cài CU nào). Việc đổi cấu hình thuộc DBA. Hãy kể đúng như vậy, và kể cách bạn tránh kết luận vội.

> **Ví dụ:** "Khi rà các cụm SQL Server của hệ thống thi, tôi thấy một cụm vẫn để cấu hình như lúc cài: SQL Server được phép dùng hết RAM, ngưỡng song song vẫn là 5, và chưa cài bản vá nào từ khi lên 2019. Wait stats cho thấy rất nhiều trao đổi song song, nhưng tôi không kết luận ngay là song song gây hại, vì wait loại đó phần lớn vô hại; tôi xem thời gian chờ thật và các truy vấn song song nặng nhất trước. Đề xuất của tôi chia hai mức: các thiết lập đổi được online thì làm ngoài giờ cao điểm, còn cài CU và cấp quyền Windows thì gom vào một khung bảo trì có restart. Mỗi mục kèm cách đo trước và sau, chủ yếu là wait stats chụp theo khoảng thời gian và lượng RAM còn trống của Windows."

Điểm ăn điểm:
- Nói được thay đổi nào online, thay đổi nào cần restart, thay đổi nào gây một đợt biên dịch lại.
- Coi 50 là điểm xuất phát rồi chỉnh theo phân bố cost thật, không đọc thuộc lòng một con số.
- Đo wait stats theo khoảng thời gian, không dùng số tích luỹ từ lúc khởi động.
- Phân biệt rõ phần mình phát hiện và đề xuất với phần DBA triển khai. Nếu chưa biết đề xuất đã áp dụng chưa, nói thẳng là "đề xuất".

#### Câu hỏi vặn
- **"Vì sao không để SQL Server dùng toàn bộ RAM của máy?"** Ngoài buffer pool, tiến trình còn cần bộ nhớ cho thread stack, CLR, linked server provider, backup buffer; OS và các dịch vụ khác cũng cần RAM. Khi OS thiếu, nó ép SQL Server trả bộ nhớ, hiệu năng dao động. Tôi chừa 10–20% (tối thiểu 4 GB) rồi theo dõi `Available MBytes` để chỉnh.
- **"Cost threshold mặc định là 5 thì có vấn đề gì, và anh chọn giá trị mới thế nào?"** Với phần cứng hiện nay, cost 5 khiến truy vấn OLTP nhỏ cũng chạy song song, tốn worker và thời gian đồng bộ. Tôi bắt đầu từ 50, sau đó lấy phân bố cost của plan trong cache để chỉnh sao cho OLTP nằm dưới ngưỡng, báo cáo nằm trên.
- **"Wait CXCONSUMER có hàng trăm triệu lượt, có phải song song đang gây hại không?"** Chưa kết luận được. `CXCONSUMER` là phía chờ thường vô hại của trao đổi song song, và số lượt không nói lên thời gian. Tôi xem `CXPACKET` theo thời gian chờ trong giờ cao điểm, CPU, và các truy vấn song song nặng nhất trong Query Store. Cost threshold 5 là nguyên nhân đáng sửa đầu tiên.
- **"Server 2019 RTM chưa cài CU nào, anh xử lý ra sao?"** Lên kế hoạch cài CU mới nhất: đọc danh sách lỗi đã biết, thử trên môi trường test, cài trong khung bảo trì vì cần restart, chụp wait stats và hiệu năng trước và sau, có backup và cách gỡ CU nếu hồi quy.
- **"Đổi cost threshold xong thấy CPU vọt lên vài phút, có phải đổi sai không?"** Không hẳn. Đổi thiết lập này xoá plan cache liên quan nên mọi truy vấn biên dịch lại, CPU tăng ngắn. Phải so sau khi hệ thống ổn định, cùng khung giờ với trước đó.
- **"Phần cấu hình này anh tự đổi trên production à?"** Không. Tôi phát hiện trong đợt rà soát và viết đề xuất kèm cách đo; đổi cấu hình server là việc của DBA. Nếu bị hỏi tiếp về kết quả, tôi chỉ nói số đo trước và sau khi thật sự có số đó.

#### Bẫy cần tránh
- Nói "tôi đặt max server memory bằng 80% RAM" như công thức cố định. Nói thay: chừa cho OS theo RAM máy và các dịch vụ chạy chung, rồi chỉnh theo `Available MBytes`.
- Dùng số lượt chờ thay cho thời gian chờ để kết luận.
- Nhận việc đổi cấu hình là của mình khi thực tế chỉ đề xuất.

#### Nhớ nhanh
- `max server memory` mặc định gần như không giới hạn; luôn đặt, chừa 10–20% cho OS.
- Cost threshold 5 quá thấp; 50 là điểm khởi đầu, chỉnh theo phân bố cost thật. MAXDOP theo NUMA node, thường không quá 8.
- `optimize for ad hoc workloads` và `backup compression default` gần như luôn nên bật.
- `sp_configure` có hiệu lực ngay; CU, Lock Pages in Memory, IFI cần restart.

#### Bài tập
1. Viết truy vấn liệt kê giá trị đang chạy của năm thiết lập: max server memory, cost threshold, MAXDOP, optimize for ad hoc workloads, backup compression default.
   **Đáp án:** `SELECT name, value_in_use FROM sys.configurations WHERE name IN ('max server memory (MB)', 'cost threshold for parallelism', 'max degree of parallelism', 'optimize for ad hoc workloads', 'backup compression default');`
2. Máy 64 GB chạy riêng SQL Server, 2 NUMA node, mỗi node 12 logical processor. Đề xuất `max server memory` và MAXDOP.
   **Đáp án:** Khoảng 56 GB (57.344 MB), chừa 8 GB cho OS rồi theo dõi `Available MBytes`. MAXDOP tối đa bằng số logical processor mỗi node (12); 8 là lựa chọn an toàn phổ biến.

### Bài 20.2. TempDB và transaction log

#### Kiến thức
Hai thành phần này ít khi được nghĩ tới cho tới ngày chúng đầy. Khi đó cả instance dừng ghi, nên người làm backend senior phải hiểu chúng chứa gì và vì sao phình.

##### TempDB chứa gì
TempDB dùng chung cho cả instance và được tạo lại mỗi lần SQL Server khởi động. Bên trong có:
- Đối tượng người dùng: `#temp`, `##global`, bảng biến (bảng biến cũng nằm trong tempdb, không phải "chỉ trong RAM").
- Đối tượng nội bộ: work table cho sort, hash spill, spool, cursor.
- Version store: phiên bản cũ của dòng khi bật RCSI hoặc Snapshot isolation, online index rebuild, bảng `inserted`/`deleted` của trigger.

Vì mọi DB dùng chung, một truy vấn spill lớn hay một transaction mở lâu dưới RCSI có thể làm tempdb phình và kéo cả instance theo.

Cấu hình đúng: đặt trên ổ riêng, nhanh, không phải ổ C của hệ điều hành; số file data bằng số logical processor, tối đa 8 lúc đầu, còn tranh chấp trang cấp phát (wait `PAGELATCH_UP` trên trang PFS/GAM/SGAM) thì thêm theo bội số 4; các file cùng kích thước, cùng mức tăng, vì SQL Server chia việc theo tỉ lệ dung lượng trống của từng file.

##### Transaction log hoạt động thế nào
Mọi thay đổi được ghi vào log trước (write-ahead logging), trang dữ liệu sửa trong bộ nhớ được ghi xuống đĩa sau. Khi commit, SQL Server phải đợi bản ghi log xuống đĩa bền rồi mới trả kết quả; thời gian đợi đó là wait `WRITELOG`. `WRITELOG` cao thường do ổ log chậm, log chung ổ với data, hoặc ứng dụng commit từng dòng một.

File log là vòng tròn, chia thành các Virtual Log File (VLF). Khi phần đầu không còn cần, SQL Server quay lại ghi đè (truncation). Nếu có lý do giữ lại, log phải tăng kích thước. Lý do nằm ở cột `log_reuse_wait_desc`:

| Giá trị | Ý nghĩa | Hướng xử lý |
|---|---|---|
| `LOG_BACKUP` | DB ở FULL/BULK_LOGGED, chưa backup log | Tạo job `BACKUP LOG` định kỳ |
| `ACTIVE_TRANSACTION` | Có transaction mở lâu | Tìm bằng `DBCC OPENTRAN`, `sys.dm_tran_active_transactions` |
| `REPLICATION` | Log Reader hoặc CDC chưa đọc xong | Kiểm tra agent replication, CDC |
| `AVAILABILITY_REPLICA` | Replica AG chưa nhận hoặc redo kịp | Kiểm tra mạng, độ trễ redo |
| `NOTHING` | Đang tái sử dụng bình thường | |

```sql
SELECT name, recovery_model_desc, log_reuse_wait_desc FROM sys.databases;
SELECT total_log_size_in_bytes / 1048576 AS log_mb, used_log_space_in_percent
FROM sys.dm_db_log_space_usage;   -- chạy trong từng DB
```

##### Recovery model đi theo RPO
- **SIMPLE**: log tự truncate sau checkpoint; chỉ khôi phục được tới bản backup full/differential gần nhất.
- **FULL**: giữ log tới khi backup log; khôi phục được tới một thời điểm bất kỳ nếu chuỗi backup log liền mạch.
- **BULK_LOGGED**: như FULL nhưng ghi log tối thiểu cho thao tác bulk; mất khả năng khôi phục theo thời điểm trong khoảng có thao tác bulk.

RPO là lượng dữ liệu tối đa được phép mất khi sự cố. DB có tiền, giao dịch, kết quả thi cần FULL và backup log mỗi 5–15 phút. DB log kỹ thuật hay kho dữ liệu nạp lại được từ nguồn có thể để SIMPLE.

##### VLF, shrink và tăng log
Log tăng từng bước nhỏ sinh hàng nghìn VLF, làm backup log, khởi động lại và đồng bộ AG chậm. Đặt kích thước ban đầu đủ lớn và `FILEGROWTH` cố định (512 MB–1 GB). Đếm VLF bằng `SELECT COUNT(*) FROM sys.dm_db_log_info(DB_ID());`.

Shrink log chỉ sau khi đã sửa nguyên nhân, và về kích thước hợp lý chứ không về 0. Không shrink file data định kỳ: nó di chuyển trang từ cuối lên đầu, gây phân mảnh index nặng, rồi file lại tăng.

> **Cảnh báo:** Chuyển FULL sang SIMPLE rồi quay lại FULL làm đứt chuỗi backup log. Phải chạy một backup full hoặc differential mới để bắt đầu chuỗi mới.

#### Cách show off
Đây là phần bạn có phát hiện thật và rất dễ kể: trong đợt rà soát, một DB log khoảng 50 GB đã đầy gần 100% vì không có job backup log; một cụm khác để tempdb gần 60 GB trên ổ C chỉ còn chưa tới 10% trống. Điểm senior không nằm ở chỗ thấy log đầy, mà ở chỗ bạn phản biện một đề xuất nghe rất hợp lý: chuyển hàng loạt DB sang SIMPLE cho nhẹ log.

> **Ví dụ:** "Trong đợt rà soát, tôi gặp một database log khoảng 50 GB đã đầy gần hết. Cột `log_reuse_wait_desc` báo `LOG_BACKUP`, tức DB ở FULL nhưng chưa ai đặt job backup log, nên log chỉ tăng chứ không quay vòng. Có ý kiến chuyển hết sang SIMPLE cho xong, nhưng cụm đó có DB thanh toán, chuyển SIMPLE nghĩa là khi sự cố sẽ mất mọi giao dịch từ bản backup gần nhất. Tôi đề xuất quyết định theo RPO từng DB: DB nghiệp vụ giữ FULL và có job backup log vài phút một lần, DB log kỹ thuật thì SIMPLE. Sau khi backup log chạy đều mới shrink log một lần và đặt bước tăng cố định. Tôi cũng thấy một DB kho dữ liệu ở SIMPLE mà log vẫn đầy vì một transaction mở lâu, nên SIMPLE không phải thuốc vạn năng."

Điểm ăn điểm:
- Bắt đầu từ `log_reuse_wait_desc`, không bắt đầu bằng shrink.
- Recovery model là quyết định nghiệp vụ theo RPO, không phải theo dung lượng log.
- Thứ tự xử lý khi ổ sắp đầy: backup log ngay, rồi mới job định kỳ, rồi mới shrink.
- Biết SIMPLE vẫn có thể đầy log khi có transaction mở lâu, replication hay AG.

#### Câu hỏi vặn
- **"Log đầy 99% dù DB nhỏ, anh kiểm tra gì đầu tiên?"** Cột `log_reuse_wait_desc` trong `sys.databases` để biết vì sao log không được tái sử dụng: thiếu backup log, transaction mở lâu, replication chưa đọc, replica AG chậm. Sửa theo đúng lý do, sau đó mới cân nhắc shrink.
- **"Chuyển hết sang SIMPLE cho nhẹ log được không?"** Chỉ với DB chấp nhận mất dữ liệu tới bản backup gần nhất. DB thanh toán, kết quả thi cần khôi phục theo thời điểm nên giữ FULL kèm job backup log. Tôi hỏi RPO của từng DB trước khi đổi.
- **"DB ở SIMPLE mà log vẫn đầy, vì sao?"** SIMPLE chỉ truncate được phần log không còn cần. Transaction mở lâu, replication hoặc CDC chưa đọc log, hoặc AG đều giữ log lại. Tìm transaction bằng `DBCC OPENTRAN` hoặc `sys.dm_tran_active_transactions`.
- **"Tempdb nên cấu hình thế nào trên server 16 core?"** Ổ riêng, nhanh; bắt đầu 8 file data cùng kích thước và cùng mức tăng; theo dõi `PAGELATCH_UP` trên trang cấp phát, còn tranh chấp thì thêm theo bội số 4. Kích thước ban đầu đủ lớn để khỏi phải tăng trong ngày.
- **"WRITELOG cao thì nguyên nhân thường gặp là gì?"** Ổ log chậm, log chung ổ với data, hoặc ứng dụng commit từng dòng. Tôi đo độ trễ ghi file log bằng `sys.dm_io_virtual_file_stats`; nếu ổ ổn thì gom thao tác vào transaction vừa phải hoặc ghi theo lô.
- **"Bật DELAYED_DURABILITY để giảm WRITELOG thì sao?"** Commit trả về trước khi log xuống đĩa, nên sự cố có thể mất các commit gần nhất. Chỉ dùng cho dữ liệu chấp nhận mất, như log hành vi, không dùng cho bài nộp hay giao dịch.
- **"Bật RCSI rồi tempdb phình, anh theo dõi bằng gì?"** Version store nằm trong tempdb; transaction mở lâu giữ nó không được dọn. Tôi xem `sys.dm_tran_version_store_space_usage` và transaction snapshot lâu nhất trong `sys.dm_tran_active_snapshot_database_transactions`.

#### Bẫy cần tránh
- Trả lời "shrink log" ngay khi nghe log đầy. Nói thay: tìm lý do trong `log_reuse_wait_desc`, sửa lý do, rồi shrink một lần.
- Shrink file data định kỳ để "tiết kiệm đĩa".
- Nói "bảng biến nằm trong RAM nên nhanh hơn temp table".
- Quên rằng đổi recovery model làm đứt chuỗi backup log.

#### Nhớ nhanh
- TempDB chứa temp table, bảng biến, spill, version store; ổ riêng, nhiều file bằng nhau.
- Commit chờ log xuống đĩa; `WRITELOG` phản ánh độ trễ ghi log.
- `log_reuse_wait_desc` nói đúng lý do log không quay vòng.
- Recovery model chọn theo RPO; FULL luôn đi kèm job backup log.
- Log tăng theo bước cố định đủ lớn; không shrink file data định kỳ.

#### Bài tập
1. DB ở FULL, log 40 GB đầy 98%, `log_reuse_wait_desc = LOG_BACKUP`, ổ còn 5%. Liệt kê các bước xử lý theo thứ tự.
   **Đáp án:** Chạy `BACKUP LOG` ngay (ghi ra ổ khác còn chỗ) để log truncate; tạo job backup log 5–15 phút; khi log quay vòng đều, shrink log một lần về kích thước hợp lý; đặt `FILEGROWTH` cố định; thêm cảnh báo % log và dung lượng ổ. Không chuyển SIMPLE khi chưa hỏi RPO.

### Bài 20.3. Vòng đời dữ liệu: archive, partition, xoá theo lô

#### Kiến thức
Dữ liệu chỉ tăng, ít khi tự giảm. Một bảng log hay bảng feed không có chính sách giữ dữ liệu sẽ tới lúc chậm mọi thứ: truy vấn, bảo trì, backup.

##### Vì sao bảng nóng phải nhỏ
Chi phí của bảng lớn không chỉ là dung lượng. Index có nhiều cấp B-tree hơn, scan đọc nhiều trang hơn, rebuild index và update statistics lâu hơn, backup và restore lâu hơn, buffer pool bị chiếm bởi dữ liệu cũ hiếm khi đọc. Nguyên tắc: tách dữ liệu nóng (đọc ghi thường xuyên) khỏi dữ liệu lạnh (chỉ giữ để tra cứu, đối soát) và chuyển phần lạnh sang bảng archive, DB archive hoặc kho rẻ hơn.

##### Partition theo thời gian
Partition chia một bảng logic thành nhiều phần vật lý theo một cột, thường là ngày. Lợi ích chắc chắn cho vòng đời dữ liệu là xoá hay chuyển cả một khoảng thời gian bằng thao tác metadata:

```sql
CREATE PARTITION FUNCTION pf_month (date)
AS RANGE RIGHT FOR VALUES ('2026-01-01', '2026-02-01', '2026-03-01');
CREATE PARTITION SCHEME ps_month AS PARTITION pf_month ALL TO ([PRIMARY]);

TRUNCATE TABLE dbo.ExamLog WITH (PARTITIONS (1));          -- SQL Server 2016+, gần như tức thì
ALTER TABLE dbo.ExamLog SWITCH PARTITION 1 TO dbo.ExamLog_Archive;  -- hoặc chuyển ra bảng rỗng
```

`SWITCH` đòi bảng đích cùng cấu trúc cột và index, cùng filegroup, đang rỗng, và index phải aligned (partition theo cùng scheme). Quy trình sliding window định kỳ: `SPLIT` thêm partition cho tháng tới khi partition cuối còn rỗng, `SWITCH` hoặc `TRUNCATE` partition cũ nhất, `MERGE` ranh giới rỗng.

> **Ghi nhớ:** Partition không tự làm truy vấn nhanh hơn. Truy vấn chỉ hưởng lợi khi lọc trên cột partition để optimizer loại bỏ partition không liên quan; truy vấn không lọc theo cột đó có thể còn chậm hơn.

##### Xoá theo lô khi không có partition
`DELETE` một lần hàng chục triệu dòng gây ba vấn đề: log phình vì cả thao tác là một transaction; khoá leo thang lên cả bảng (thường khi một câu lệnh giữ khoảng 5.000 khoá trên một đối tượng); huỷ giữa chừng thì rollback còn lâu hơn lúc chạy. Xoá theo lô giải quyết cả ba:

```sql
DECLARE @batch int = 4000, @rows int = 1;
WHILE @rows > 0
BEGIN
    DELETE TOP (@batch) FROM dbo.ErrorLog
    WHERE CreatedAt < '2025-01-01';      -- cần index trên CreatedAt
    SET @rows = @@ROWCOUNT;
    WAITFOR DELAY '00:00:00.200';        -- nhường tài nguyên, cho backup log kịp chạy
END
```

Lô nhỏ dưới ngưỡng leo thang khoá thì an toàn cho truy vấn đồng thời; lô lớn hơn chạy nhanh hơn nhưng có thể khoá cả bảng trong chốc lát. Ở FULL recovery, log vẫn tích tới khi backup log, nên job backup log phải chạy trong lúc xoá. Khi phần giữ lại nhỏ hơn nhiều phần xoá, cách nhanh hơn là chép phần giữ sang bảng mới, tạo index, rồi đổi tên bảng trong một khoảng dừng ngắn.

##### Rác vận hành và chính sách giữ dữ liệu
`SELECT * INTO dbo.Table_bak_20240101 FROM dbo.Table` tạo một heap không index, không ai sở hữu, nằm trong cùng DB nên làm backup to ra và tồn tại mãi. Thay bằng backup DB trước khi thay đổi, BCP ra file, hoặc nếu buộc phải tạo bảng tạm thì có quy ước tên kèm ngày hết hạn và job dọn. DB để OFFLINE vẫn chiếm đĩa vì file vẫn nằm đó.

Mỗi bảng lớn cần một dòng chính sách: giữ bao lâu ở bảng nóng, chuyển đi đâu, xoá hẳn khi nào, ai duyệt. Log lỗi thường giữ 30–90 ngày; dữ liệu nghiệp vụ như kết quả thi giữ theo yêu cầu pháp lý và đối soát, thường archive chứ không xoá.

#### Cách show off
Phát hiện thật trong đợt rà soát: bảng feed hàng trăm triệu dòng mà người dùng chỉ xem vài tháng gần nhất, hàng trăm triệu dòng nằm trong các bảng backup tạo tay và vẫn đang sinh thêm, bảng log lỗi tích từ nhiều năm trước, vài DB để OFFLINE chiếm đĩa. Phần ăn điểm là thứ tự xử lý: chặn nguồn sinh rác trước, rồi mới dọn.

> **Ví dụ:** "Ở cụm dữ liệu lõi, proc tìm feed quét một bảng hàng trăm triệu dòng, mỗi lần đọc hàng trăm nghìn trang, trong khi người dùng gần như chỉ xem dữ liệu năm gần nhất. Tôi đề xuất chính sách giữ dữ liệu cho từng bảng lớn: feed cũ hơn một năm chuyển sang archive, bảng log thì partition theo thời gian để dọn bằng truncate từng partition. Ở cụm khác có rất nhiều bảng backup tạo bằng `SELECT INTO`, và vẫn đang được sinh thêm, nên bước đầu là tắt tiến trình tạo bảng đó, nếu không dọn xong lại có bảng mới. Với bảng chưa partition, tôi viết cách xoá theo lô vài nghìn dòng có index trên cột thời gian, chạy ngoài giờ thi, theo dõi log và blocking trong lúc chạy. Trước khi xoá khỏi bảng nóng, phải có đường đọc dữ liệu archive cho tra cứu khiếu nại."

Điểm ăn điểm:
- Ba rủi ro của `DELETE` lớn: log, lock escalation, rollback.
- Partition giúp quản lý vòng đời chắc chắn, còn hiệu năng truy vấn thì có điều kiện.
- Tắt nguồn sinh rác trước khi dọn.
- Luôn hỏi "ai còn cần đọc dữ liệu cũ" trước khi archive.

#### Câu hỏi vặn
- **"Xoá 100 triệu dòng log cũ trên production thế nào?"** Không `DELETE` một lần. Có partition thì `TRUNCATE ... WITH (PARTITIONS ...)` hoặc `SWITCH` ra bảng rỗng. Không có thì `DELETE TOP (N)` theo index trên cột thời gian, trong vòng lặp có nghỉ, ngoài giờ cao điểm, job backup log chạy song song. Nếu phần giữ lại nhỏ, chép phần giữ sang bảng mới rồi đổi tên.
- **"Partition có làm truy vấn nhanh hơn không?"** Chỉ khi truy vấn lọc trên cột partition để có partition elimination. Lợi ích chắc chắn là quản lý vòng đời: switch, truncate, rebuild từng partition.
- **"Anh chọn kích thước lô thế nào?"** Bắt đầu dưới ngưỡng leo thang khoá, vài nghìn dòng, đo thời gian mỗi lô và blocking, rồi tăng dần nếu hệ thống chịu được. Theo dõi log và độ trễ replica trong lúc chạy.
- **"Vì sao không nên sao lưu bảng bằng SELECT INTO?"** Nó tạo heap không index trong cùng DB, làm backup to ra, không có chủ, không có hạn xoá. Dùng backup DB hoặc BCP; nếu buộc tạo bảng tạm thì có quy ước tên kèm ngày hết hạn và job dọn.
- **"Xoá theo lô mà càng về sau càng chậm, vì sao?"** Thường do điều kiện `WHERE` không có index: mỗi lô phải quét lại bảng, đi qua cả các trang đã xoá. Cần index trên cột lọc, hoặc xoá theo khoảng khoá clustered.
- **"Archive xong khách hàng khiếu nại bài thi năm ngoái thì sao?"** Đó là lý do phải thiết kế đường đọc dữ liệu archive trước khi xoá khỏi bảng nóng: bảng archive hoặc kho dữ liệu có index cho tra cứu, chậm hơn cũng được nhưng phải đọc được.

#### Bẫy cần tránh
- Nói "partition để query nhanh hơn" mà không nhắc điều kiện lọc theo cột partition.
- Xoá theo lô mà cột lọc không có index.
- Dọn bảng backup trong khi tiến trình tạo chúng vẫn chạy.
- Đưa dữ liệu còn cần tra cứu vào chỗ không đọc lại được.

#### Nhớ nhanh
- Bảng nóng nhỏ thì index nhỏ, bảo trì nhanh, buffer pool chứa đúng dữ liệu cần.
- Partition theo thời gian cho phép `SWITCH`/`TRUNCATE` thay cho xoá từng dòng.
- Không có partition thì xoá theo lô có index, có nghỉ, backup log chạy song song.
- Mỗi bảng lớn có chính sách giữ dữ liệu; bảng backup và DB OFFLINE cần quy ước và job dọn.

#### Bài tập
1. Bảng log 200 triệu dòng, clustered trên `Id` identity, có index trên `CreatedAt`. Viết vòng lặp xoá dữ liệu trước 2025-01-01 theo lô 4.000 dòng.
   **Đáp án:** Vòng `WHILE` với `DELETE TOP (4000) FROM ... WHERE CreatedAt < '2025-01-01'`, gán `@@ROWCOUNT`, `WAITFOR DELAY` ngắn giữa các lô; chạy ngoài giờ cao điểm, backup log song song.
2. Bảng log đã partition theo tháng (RANGE RIGHT). Viết lệnh dọn tháng cũ nhất và thêm ranh giới cho tháng tới.
   **Đáp án:** `ALTER PARTITION SCHEME ps_month NEXT USED [PRIMARY];` rồi `ALTER PARTITION FUNCTION pf_month() SPLIT RANGE ('2026-04-01');` khi partition cuối còn rỗng; `TRUNCATE TABLE dbo.ExamLog WITH (PARTITIONS (1));` rồi `ALTER PARTITION FUNCTION pf_month() MERGE RANGE ('2026-01-01');`.

## Chương 21. Tầng ứng dụng và kiến trúc
Nhiều vấn đề trông như "database chậm" thực ra nằm ở cách ứng dụng gọi database: đọc lại cùng một dữ liệu hàng triệu lần, giữ kết nối quá lâu, gọi sang server khác trong lúc đang giữ khoá, chạy báo cáo trên cùng server với luồng ghi nóng, nuốt lỗi khiến không ai biết DB đang hỏng. Sửa ở tầng ứng dụng thường rẻ hơn và tác động lớn hơn thêm một index.

Người phỏng vấn senior hỏi mảng này theo hướng thiết kế: cache cái gì và xoá cache thế nào, pool bao nhiêu là đủ, tách transaction rồi giữ nhất quán ra sao. Câu trả lời tốt có lập luận định lượng (tần suất gọi, thời gian giữ kết nối) và nói rõ cái giá phải trả (dữ liệu cũ, độ trễ đồng bộ).

### Bài 21.1. Cache ở tầng ứng dụng

#### Kiến thức
Cache đáng làm khi cùng một dữ liệu được đọc nhiều lần hơn hẳn số lần nó thay đổi. Câu hỏi khó không phải "dùng Redis hay không", mà là cache ở lớp nào, giữ bao lâu, xoá khi nào.

##### Ba lớp cache
1. **Trong một request**: nhớ kết quả trong biến của request. Một request cần cấu hình sự kiện ở năm chỗ thì chỉ gọi DB một lần. Không có vấn đề nhất quán vì sống đúng một request.
2. **Trong bộ nhớ một instance** (`IMemoryCache`): nhanh nhất, không qua mạng. Nhược điểm: mỗi instance có bản riêng, xoá phải báo tới từng instance; giữ object lớn làm tăng áp lực GC.
3. **Cache phân tán** (Redis): dùng chung cho mọi instance, sống qua lần deploy. Mỗi lần đọc là một round-trip mạng cộng chi phí deserialize.

Hai lớp sau thường đi cùng nhau: L1 trong process TTL ngắn đứng trước L2 Redis TTL dài hơn (chi tiết ở bài cache nâng cao, chương 23).

##### Cache-aside
Đọc cache, trượt thì đọc DB, ghi vào cache kèm TTL, trả kết quả. Khi dữ liệu đổi, xoá key theo sự kiện.

```csharp
public async Task<ExamPaper?> GetPaperAsync(int paperId, CancellationToken ct)
{
    var key = $"exam:paper:v1:{paperId}";
    if (_memory.TryGetValue(key, out ExamPaper? cached)) return cached;

    var gate = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1)); // single-flight trong instance
    await gate.WaitAsync(ct);
    try
    {
        if (_memory.TryGetValue(key, out cached)) return cached;  // double-check
        var paper = await _repo.GetPaperAsync(paperId, ct);        // gọi proc
        if (paper is not null)
            _memory.Set(key, paper, TimeSpan.FromMinutes(30) + TimeSpan.FromSeconds(Random.Shared.Next(0, 120)));
        return paper;
    }
    finally { gate.Release(); }
}
```

Các điểm đáng nói: key có tiền tố miền và version (`v1`) để đổi cấu trúc object thì tăng version thay vì xoá cache; kiểm tra lại sau khi lấy khoá để không nạp hai lần; TTL cộng phần ngẫu nhiên để các key không hết hạn cùng lúc. Ghi vào Redis nên chạy nền và tự bắt lỗi: cache hỏng không được làm request thất bại, request cũng không phải chờ ghi cache xong.

##### Cache kết quả rỗng
Nếu chỉ cache khi có dữ liệu, mọi lần hỏi một thứ không tồn tại (một tổ hợp chưa có cấu hình, một ID sai) đều trượt và gọi DB. Cache một giá trị đánh dấu "không có" với TTL ngắn sẽ chặn được việc này, với hai điều kiện: chỉ khi DB trả rỗng thật, không phải khi DB lỗi; và khi tạo mới dữ liệu đó thì xoá key.

##### Cache stampede
Một key nóng hết hạn, hàng nghìn request cùng trượt và cùng gọi DB đúng lúc tải cao nhất. Cách chống:
- **Single-flight**: chỉ một request nạp, request khác chờ kết quả (như đoạn code trên). Giữa nhiều instance, dùng khoá ngắn trên Redis (`SET key value NX PX 5000`).
- **TTL lệch ngẫu nhiên** (jitter).
- **Làm mới nền** hoặc stale-while-revalidate: trả bản cũ, đồng thời một luồng nạp bản mới.
- **Warmup**: nạp sẵn đề thi, cấu hình ca thi trước giờ mở ca.

##### Chọn TTL
TTL là độ cũ tối đa nghiệp vụ chấp nhận, không phải con số tuỳ ý. Dữ liệu đổi theo sự kiện biết trước (job xếp hạng chạy xong, admin sửa cấu hình) thì ghi đè hoặc xoá cache ngay khi sự kiện xảy ra; TTL chỉ là lưới an toàn khi bước xoá thất bại. Xoá cache sau khi commit DB, không phải trước, vì xoá trước thì một request khác có thể nạp lại giá trị cũ vào cache.

#### Cách show off
Bạn có một câu chuyện cache thật và là của bạn: trong đợt rà soát, một proc lấy cấu hình xuất hiện với số lần chạy cực lớn. Bạn tìm ra nguyên nhân là lớp cache phía trên không lưu kết quả rỗng, nên các tổ hợp chưa có cấu hình luôn trượt và luôn gọi DB, rồi tự sửa. Ngoài ra là các đề xuất: cache bảng xếp hạng (chỉ đổi khi job xếp hạng chạy), cache đề theo mã đề (không đổi trong ca thi).

> **Ví dụ:** "Khi xếp hạng các proc theo tổng số lần chạy, tôi thấy một proc lấy cấu hình nằm gần đầu danh sách, dù đã có cache Redis phía trên. Đọc code thì thấy cache chỉ lưu khi có dữ liệu; với những tổ hợp chưa được cấu hình, kết quả rỗng không được lưu nên request nào cũng trượt và đi thẳng xuống DB. Tăng TTL không giải quyết được vì cái bị thiếu là cache cho trường hợp rỗng. Tôi thêm negative caching với TTL ngắn hơn và cho CMS xoá key khi tạo hoặc sửa cấu hình, để cấu hình mới không bị coi là rỗng tới hết TTL. Để đo, tôi chụp số lần chạy của proc hai lần cách nhau một giờ, cùng khung giờ, trước và sau khi deploy, thay vì nhìn con số cộng dồn trong DMV."

Điểm ăn điểm:
- Con số trong `sys.dm_exec_query_stats` là cộng dồn từ lúc plan vào cache; muốn nói "giảm bao nhiêu" phải đo theo khoảng thời gian.
- Phân biệt "rỗng thật" với "lỗi" trước khi cache.
- TTL là quyết định nghiệp vụ; sự kiện đổi dữ liệu thì xoá cache sau commit.
- Nghĩ tới stampede và warmup trước giờ thi, không chỉ hit rate.

#### Câu hỏi vặn
- **"Sao không tăng TTL cho xong?"** TTL dài không giúp gì cho trường hợp rỗng vì kết quả rỗng không được lưu, nên tổ hợp chưa có cấu hình vẫn trượt mãi. Cái thiếu là negative caching, cộng với xoá key khi CMS tạo cấu hình.
- **"Negative cache có rủi ro gì?"** Cấu hình vừa tạo có thể vẫn bị coi là rỗng tới khi hết TTL. Tôi đặt TTL ngắn hơn cho kết quả rỗng và cho CMS xoá key khi tạo hoặc sửa. Ngoài ra không bao giờ cache rỗng khi DB lỗi.
- **"Cache bảng xếp hạng TTL 5 phút, job chạy xong lúc 10:00, người dùng thấy hạng cũ tới 10:05 có được không?"** Hỏi nghiệp vụ trước. Nếu không chấp nhận, job xong thì ghi đè cache hoặc xoá key; TTL chỉ còn là lưới an toàn khi bước cập nhật cache thất bại.
- **"Cache stampede là gì và anh chống thế nào?"** Key nóng hết hạn, nhiều request cùng trượt và cùng gọi DB. Chống bằng single-flight, TTL lệch ngẫu nhiên, làm mới nền hoặc stale-while-revalidate, và warmup trước sự kiện lớn.
- **"Khi nào IMemoryCache, khi nào Redis?"** Dữ liệu nhỏ, đọc rất nhiều, chấp nhận các instance lệch nhau vài giây thì `IMemoryCache`. Cần dùng chung, cần xoá đồng loạt, dữ liệu lớn thì Redis. Thường kết hợp: L1 TTL ngắn trước L2 Redis.
- **"Xoá cache trước hay sau khi ghi DB?"** Sau commit. Xoá trước thì giữa lúc xoá và lúc commit, request khác có thể nạp giá trị cũ vào cache và giữ tới hết TTL. Vẫn còn cửa sổ race nhỏ, nên giữ TTL làm lưới an toàn.
- **"Con số số lần chạy anh nói lấy ở đâu?"** Từ `execution_count` trong DMV, nhưng đó là số cộng dồn từ lúc plan vào cache. Số để so sánh là chênh lệch giữa hai lần chụp cách nhau một khoảng cố định, cùng khung giờ, trước và sau khi sửa.

#### Bẫy cần tránh
- Nói "tôi giảm được X triệu lần gọi" bằng con số cộng dồn của DMV.
- Cache kết quả rỗng trong `catch`: lỗi DB biến thành "không có dữ liệu" tới hết TTL.
- Cache object mutable trong `IMemoryCache` rồi sửa nó trong request: mọi request khác thấy bản đã sửa.
- Await ghi Redis trên đường xử lý request: Redis chậm kéo API chậm theo.

#### Nhớ nhanh
- Ba lớp: trong request, trong process, Redis dùng chung.
- Cache-aside: đọc cache, trượt thì đọc DB, ghi cache có TTL; xoá theo sự kiện sau commit.
- Negative caching chặn truy vấn lặp vào thứ không tồn tại; TTL ngắn, không cache khi lỗi.
- Chống stampede: single-flight, jitter, làm mới nền, warmup.

#### Bài tập
1. Proc lấy đề gọi khoảng 640.000 lần/ngày, mỗi ngày dùng 40 mã đề. Ước lượng số lần gọi proc sau khi cache theo mã đề với TTL 30 phút, ca thi kéo dài 12 giờ, một instance.
   **Đáp án:** Mỗi mã đề nạp lại khoảng 12 × 2 = 24 lần; 40 mã đề → khoảng 960 lần/ngày mỗi instance (nhân số instance nếu chỉ dùng L1), giảm hơn 99%.
2. Chỉ ra lỗi: `try { var r = await db.GetRank(id); cache.Set(key, r ?? new List<Rank>()); } catch { cache.Set(key, new List<Rank>()); }`.
   **Đáp án:** Khi DB lỗi, danh sách rỗng được cache và trả cho người dùng tới hết TTL; lỗi không được ghi log. Không cache trong `catch`; ghi log và ném lại.

### Bài 21.2. Connection pool và Little's law
**Viz:** pool

#### Kiến thức
Khi API báo lỗi hết connection pool, phản xạ tự nhiên là tăng `Max Pool Size`. Bài này giải thích vì sao phản xạ đó thường làm tình hình tệ hơn.

##### Little's law
Với một hệ ổn định: L = λ × W. L là số phần tử đang nằm trong hệ, λ là tốc độ đến, W là thời gian mỗi phần tử ở lại. Áp vào pool: số kết nối đang dùng = số request mỗi giây × thời gian mỗi request giữ kết nối.

- 2.000 request/giây, giữ kết nối 30 ms → 60 kết nối đồng thời trung bình.
- Query 2 ms → một kết nối phục vụ được 500 request/giây; pool 50 đủ cho 25.000 request/giây.
- Query 2 giây, 100 request/giây → cần 200 kết nối, tức 200 truy vấn chạy đồng thời trên SQL Server.

Hệ quả: thời gian giữ kết nối quan trọng ngang tốc độ đến. Giảm W là cách rẻ nhất để giảm số kết nối.

##### ADO.NET connection pool
Mở một kết nối vật lý tốn kém: TCP, TLS, xác thực, khởi tạo session. Pool giữ các kết nối đã mở để dùng lại: `Open()` lấy một kết nối rảnh, `Dispose()` trả về pool.
- Pool tách theo connection string chính xác từng ký tự. Hai chuỗi khác nhau một khoảng trắng là hai pool.
- `Max Pool Size` mặc định 100.
- Hết pool: request mới chờ tới `Connect Timeout` (mặc định 15 giây) rồi nhận `InvalidOperationException`. Triệu chứng điển hình: API chậm đúng khoảng 15 giây rồi lỗi, trong khi CPU SQL Server có thể không cao.

```csharp
// Mở muộn, đóng sớm: kết nối chỉ được giữ trong lúc chạy proc
await using (var conn = new SqlConnection(_cs))
await using (var cmd = new SqlCommand("dbo.usp_GetExamResult", conn) { CommandType = CommandType.StoredProcedure })
{
    cmd.Parameters.Add("@UserId", SqlDbType.BigInt).Value = userId;
    await conn.OpenAsync(ct);
    result = await ReadResultAsync(cmd, ct);
}
await _notifyClient.SendAsync(result, ct);   // gọi dịch vụ khác SAU khi đã trả kết nối
```

Rò rỉ kết nối (quên `Dispose`, giữ `SqlDataReader` mở) làm pool cạn dần dù tải không đổi. Kiểm tra bằng số session theo `program_name` trong `sys.dm_exec_sessions`, hoặc event counter của Microsoft.Data.SqlClient.

##### Vì sao tăng pool không cứu được query chậm
Mỗi truy vấn đang chạy chiếm ít nhất một worker thread của SQL Server, và số worker có giới hạn (máy 16 logical CPU khoảng 700 worker). Khi query chậm, tăng pool từ 100 lên 500 chỉ đẩy thêm truy vấn đồng thời vào SQL Server: tranh chấp CPU, khoá, memory grant tăng, mỗi truy vấn chậm hơn, W tăng nên lại cần L lớn hơn. Vòng xoáy kết thúc bằng wait `THREADPOOL`: SQL Server hết worker, kết nối mới không được phục vụ, kể cả DBA muốn vào xem (chỉ còn Dedicated Admin Connection).

Pool còn là giới hạn trên mỗi process: N instance app thì tổng kết nối tới DB có thể lên N × Max Pool Size.

##### Kết nối ra ngoài cũng phải dùng lại
- `new HttpClient()` mỗi request: socket TIME_WAIT tích tụ, có thể cạn cổng. Dùng `IHttpClientFactory`, hoặc một `HttpClient` singleton với `SocketsHttpHandler.PooledConnectionLifetime` để vẫn cập nhật DNS.
- `GrpcChannel` tạo một lần và dùng lại (`AddGrpcClient`); tạo mới mỗi request là mỗi lần một kết nối HTTP/2 và TLS mới.

#### Cách show off
Trong báo cáo rà soát, bạn dùng đúng phép tính Little's law để bác bỏ ý tưởng tăng pool: với query 2 giây, pool 200 nghĩa là 200 truy vấn dồn vào SQL Server cùng lúc; với query 2 ms, pool 50 đã dư cho hàng chục nghìn request mỗi giây. Kết luận là giữ nguyên pool, sửa query trước. Bạn cũng chỉ ra service tạo `GrpcChannel` mới cho mỗi request.

> **Ví dụ:** "Khi có lỗi timeout lấy kết nối, đề xuất đầu tiên trong team là tăng pool. Tôi tính lại bằng Little's law: số kết nối cần bằng số request mỗi giây nhân thời gian giữ kết nối. Với query đang chạy khoảng 2 giây, pool lớn hơn chỉ có nghĩa là thêm hàng trăm truy vấn chạy đồng thời trên SQL Server, tranh CPU và khoá, mỗi truy vấn lại chậm hơn, cuối cùng có thể hết worker thread. Nếu đưa query về vài mili-giây, pool mặc định đã thừa. Nên tôi đề xuất giữ nguyên pool, sửa query và đưa các lời gọi ra ngoài khỏi đoạn đang giữ kết nối. Trong lúc đọc trace tôi cũng thấy service tạo kênh gRPC mới cho mỗi request, nên đề xuất đăng ký qua factory để dùng lại."

Điểm ăn điểm:
- Tính ra số kết nối bằng một phép nhân, không đoán.
- Biết hết pool có triệu chứng đặc trưng: chờ đúng khoảng `Connect Timeout` rồi lỗi.
- Nói được cơ chế `THREADPOOL` phía SQL Server.
- Tính tổng kết nối theo số instance, không chỉ một process.

#### Câu hỏi vặn
- **"2.000 request/giây, mỗi request giữ kết nối 30 ms, pool tối thiểu bao nhiêu?"** 2.000 × 0,03 = 60 kết nối đồng thời trung bình. Chia theo số instance, cộng dư cho lúc đỉnh vì tải không đều theo giây. Nếu cần nhiều hơn thế, giảm 30 ms trước khi tăng pool.
- **"API lỗi timeout lấy kết nối, anh có tăng Max Pool Size không?"** Chưa. Tôi đo thời gian giữ kết nối và tìm nguyên nhân: query chậm, rò rỉ kết nối, gọi dịch vụ ngoài khi đang giữ kết nối, sync-over-async. Tăng pool khi query còn chậm chỉ dồn thêm tải vào SQL Server.
- **"Wait THREADPOOL nghĩa là gì?"** SQL Server hết worker thread để gán cho request mới, thường do quá nhiều truy vấn bị chặn hoặc chạy lâu, hoặc song song quá mức. Xử lý gốc ở blocking, truy vấn chậm, cost threshold; tăng `max worker threads` không phải phản xạ đầu tiên.
- **"Có 10 instance app, mỗi cái pool 100, chuyện gì có thể xảy ra?"** Tổng có thể lên 1.000 kết nối và gần chừng đó truy vấn đồng thời khi tải đỉnh hoặc khi query chậm. Cần tính theo tổng, và đặt giới hạn đồng thời ở tầng app (bulkhead) để bảo vệ DB.
- **"Vì sao không tạo HttpClient hay GrpcChannel mới cho mỗi request?"** Mỗi lần là một kết nối TCP/TLS mới: tốn CPU handshake, socket TIME_WAIT tích tụ dẫn tới cạn cổng, mất lợi ích multiplexing của HTTP/2. Dùng `IHttpClientFactory` và channel dùng lại.
- **"Code dùng async nhưng có chỗ .Result, liên quan gì tới pool?"** Sync-over-async giữ thread của app; khi tải cao, request xếp hàng ở thread pool trước cả khi kịp lấy kết nối, nhìn bên ngoài rất giống hết pool. Phải xem counter của thread pool chứ không chỉ counter của SqlClient.
- **"Wait PREEMPTIVE_OS_CRYPTOPS rất cao, có phải do mở lại kết nối TLS liên tục?"** Có thể, nhưng wait này xuất hiện khi SQL Server gọi API mã hoá của Windows, không chỉ cho TLS. Tôi đối chiếu với số login mỗi giây và cấu hình mã hoá trước khi kết luận.

#### Bẫy cần tránh
- Tăng `Max Pool Size` khi chưa đo thời gian giữ kết nối.
- Gọi HTTP/gRPC trong khi `SqlConnection` vẫn mở.
- Mỗi chỗ trong code một connection string hơi khác nhau: pool bị chia nhỏ. Dùng một chuỗi chuẩn có `Application Name` để dễ truy session.

#### Nhớ nhanh
- Kết nối đang dùng = request/giây × thời gian giữ kết nối.
- Pool tách theo connection string; mặc định 100; hết pool thì chờ `Connect Timeout` rồi lỗi.
- Giảm thời gian giữ kết nối trước khi tăng pool; query chậm + pool lớn dẫn tới `THREADPOOL`.
- Tổng kết nối = số instance × pool; `HttpClient`, `GrpcChannel` phải dùng lại.

#### Bài tập
1. Tải đỉnh 6.000 request/giây chia đều cho 4 instance, mỗi request giữ kết nối 8 ms. Tính số kết nối trung bình mỗi instance và đề xuất `Max Pool Size`.
   **Đáp án:** Mỗi instance 1.500 × 0,008 = 12 kết nối trung bình. Tải không đều theo giây nên để dư nhiều lần, ví dụ 50; giữ mặc định 100 cũng không sao.
2. Code mở `SqlConnection`, chạy proc 5 ms, gọi HTTP sang dịch vụ thông báo 200 ms rồi mới đóng kết nối. Tải 300 request/giây. Tính số kết nối trước và sau khi chuyển lệnh HTTP ra ngoài.
   **Đáp án:** Trước: 300 × 0,205 ≈ 62 kết nối. Sau: 300 × 0,005 = 1,5 kết nối. Giảm khoảng 40 lần chỉ bằng đổi chỗ một dòng code.
3. Viết T-SQL đếm số session theo ứng dụng và máy client.
   **Đáp án:** `SELECT program_name, host_name, COUNT(*) AS sessions FROM sys.dm_exec_sessions WHERE is_user_process = 1 GROUP BY program_name, host_name ORDER BY sessions DESC;`

### Bài 21.3. Không gọi server khác trong transaction

#### Kiến thức
Một transaction giữ khoá ghi tới khi `COMMIT` hoặc `ROLLBACK`. Vì vậy thời gian giữ khoá bằng tổng thời gian mọi thứ chạy bên trong nó, kể cả những thứ không liên quan tới DB.

##### Cơ chế: khoá kéo dài theo việc chậm nhất
Nếu bên trong transaction có một lời gọi ra server khác mất 5 giây, mọi phiên muốn đụng vào các dòng đang bị khoá phải chờ 5 giây; các phiên đang chờ lại giữ khoá của chúng, và blocking lan thành chuỗi.

Linked server làm vấn đề nặng thêm:
- Gọi proc remote trong transaction local có thể khiến transaction được nâng thành distributed transaction do MSDTC điều phối (theo mặc định của tuỳ chọn `remote proc transaction promotion`). Commit lúc này là two-phase commit qua mạng; một bên chậm thì bên kia giữ khoá chờ.
- Wait đặc trưng: `OLEDB` (chờ server kia trả lời), `MSQL_DQ` (chờ distributed query), các wait `DTC*`.
- Optimizer ước lượng kém cho bảng remote; toán tử Remote Query có thể kéo cả bảng về rồi mới lọc ở local.

Nguyên tắc: trong transaction chỉ có thao tác trên DB local, theo thứ tự truy cập bảng cố định. Không HTTP, gRPC, linked server, email, ghi file, chờ người dùng. Đọc chuẩn bị (cấu hình, quyền) làm trước `BEGIN TRAN`.

##### Outbox pattern
Bài toán: ghi vật phẩm ở server A và ghi lịch sử ở server B phải cùng thành công. Outbox biến thao tác thứ hai thành thao tác local:
1. Trong cùng transaction local, ghi dữ liệu nghiệp vụ và ghi một dòng vào bảng outbox cùng DB. Hai việc này nguyên tử với nhau.
2. Một worker đọc outbox theo lô, gửi sang server B (proc, API hoặc message broker), đánh dấu đã gửi.
3. Phía nhận xử lý idempotent theo khoá duy nhất của sự kiện.

```sql
BEGIN TRAN;
    UPDATE dbo.UserItem SET Quantity = Quantity - @Qty
    WHERE UserId = @UserId AND ItemId = @ItemId AND Quantity >= @Qty;
    IF @@ROWCOUNT = 0 BEGIN ROLLBACK; THROW 50001, N'Không đủ vật phẩm', 1; END

    INSERT dbo.Outbox (EventId, EventType, Payload, CreatedAt)
    VALUES (NEWID(), 'ItemUsed',
            (SELECT @UserId AS userId, @ItemId AS itemId, @Qty AS qty FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
            SYSUTCDATETIME());
COMMIT;

-- Worker: nhiều worker chạy song song không lấy trùng
SELECT TOP (500) Id, EventId, EventType, Payload
FROM dbo.Outbox WITH (UPDLOCK, READPAST, ROWLOCK)
WHERE SentAt IS NULL ORDER BY Id;
```

Giao hàng là at-least-once: worker có thể gửi xong nhưng chết trước khi đánh dấu, lần sau gửi lại. Phía nhận phải có unique key trên `EventId`. Đánh đổi: dữ liệu ở server B trễ vài giây; cần job dọn outbox đã gửi và cảnh báo khi tồn đọng.

##### Đọc remote: lọc ở phía remote
Khi buộc phải đọc qua linked server, chạy truy vấn có lọc sẵn ở phía bên kia, đưa kết quả nhỏ vào `#temp` có primary key, rồi join ở local:

```sql
CREATE TABLE #Q (QuestionId int PRIMARY KEY, Level tinyint);
INSERT #Q (QuestionId, Level)
EXEC ('SELECT QuestionId, Level FROM dbo.Question WHERE SubjectId = ?', @SubjectId) AT [REMOTE_BANK];
```

`EXEC ... AT` gửi nguyên câu lệnh sang server kia thực thi (cần bật `rpc out`), và optimizer có số dòng thật cùng statistics trên `#Q`.

#### Cách show off
Ở mảng này bạn có cả việc đã làm thật lẫn đề xuất, cần tách bạch. Việc đã làm: một loạt commit bỏ các stored procedure join chéo database, thay bằng gọi riêng từng nơi. Phát hiện trong rà soát: proc cập nhật vật phẩm người dùng, được gọi rất nhiều, mở transaction có khoá rồi gọi proc ghi lịch sử ở server khác qua linked server; server kia chậm là transaction treo gần tới timeout, và hai wait của linked server chiếm gần 40% thời gian chờ của cụm. Outbox là đề xuất, chưa triển khai.

> **Ví dụ:** "Trong cụm dữ liệu lõi, gần 40% thời gian chờ là của linked server. Lần ngược lại, tôi thấy proc cập nhật vật phẩm mở transaction, khoá dòng của người dùng, rồi gọi sang server giao dịch để ghi lịch sử. Thời gian chạy tối đa ghi nhận trong DMV của proc này gần 30 giây, sát timeout, và trong suốt thời gian đó mọi request khác đụng tới vật phẩm của người đó phải chờ. Tôi đề xuất outbox: trong transaction chỉ cập nhật vật phẩm và ghi một dòng sự kiện vào bảng cùng database, một worker gửi sang server kia sau, phía nhận chặn trùng bằng khoá duy nhất. Cái giá là lịch sử trễ vài giây. Phần này tôi mới dừng ở thiết kế; việc tôi đã làm thật trước đó là bỏ một loạt proc join chéo database, cùng tinh thần là không để một database phụ thuộc trực tiếp vào database khác trong một câu lệnh."

Điểm ăn điểm:
- Giải thích bằng cơ chế: khoá giữ tới hết transaction, linked server có thể nâng thành 2PC.
- Nói rõ outbox là at-least-once, phía nhận phải idempotent, và cái giá là nhất quán trễ.
- Biết đọc remote đúng cách: đẩy bộ lọc sang phía remote.
- Tách bạch việc đã làm và việc mới thiết kế.

#### Câu hỏi vặn
- **"Tách lệnh ghi lịch sử ra khỏi transaction thì có mất nhất quán không?"** Không nếu dùng outbox: dòng sự kiện ghi vào bảng local trong cùng transaction nên nguyên tử với cập nhật vật phẩm; worker gửi sau, phía nhận idempotent. Đánh đổi là nhất quán trễ vài giây.
- **"Vì sao gọi linked server trong transaction nguy hiểm hơn gọi ngoài transaction?"** Khoá local bị giữ suốt thời gian chờ server kia, và transaction có thể bị nâng thành distributed transaction với two-phase commit. Server kia chậm hoặc mất mạng thì blocking lan ra mọi phiên đụng tới các dòng đó.
- **"Outbox đảm bảo giao hàng mức nào?"** At-least-once: worker có thể gửi xong rồi chết trước khi đánh dấu. Phía nhận phải idempotent, ví dụ unique key trên `EventId` hoặc bảng inbox.
- **"Nhiều worker cùng đọc outbox, làm sao không xử lý trùng?"** Lấy lô với `UPDLOCK, READPAST, ROWLOCK` trong transaction ngắn để mỗi worker bỏ qua dòng worker khác đang giữ; hoặc cập nhật trạng thái "đang xử lý" kèm `OUTPUT` để nhận đúng các dòng mình giành được.
- **"Truy vấn qua linked server đọc hơn trăm triệu trang mỗi lần, anh xử lý thế nào?"** Xem plan: Remote Query đang kéo cả bảng về để join local. Đẩy bộ lọc sang phía remote bằng `EXEC ... AT` hoặc `OPENQUERY`, đưa kết quả nhỏ vào `#temp` có PK rồi join. Nếu dùng thường xuyên thì đồng bộ dữ liệu về local.
- **"Outbox anh đã chạy production chưa?"** Chưa, đó là đề xuất trong đợt rà soát. Nếu làm, tôi cần bảng outbox, worker có cảnh báo tồn đọng, khoá duy nhất ở phía nhận, và một feature flag để quay về cách gọi cũ nếu có sự cố.
- **"Wait OLEDB cao có chắc là do linked server?"** Không chắc; một số DMV và `DBCC CHECKDB` cũng sinh wait này. Tôi đối chiếu với truy vấn đang chạy lúc wait tăng trước khi quy hết cho linked server.

#### Bẫy cần tránh
- Bỏ transaction hẳn cho "nhanh": hai thao tác local vẫn phải nằm chung một transaction.
- Outbox mà phía nhận không idempotent: gửi lại sinh bản ghi trùng.
- Kể outbox như đã triển khai khi mới là thiết kế.

#### Nhớ nhanh
- Khoá giữ tới hết transaction; mọi thứ chậm bên trong đều kéo dài khoá.
- Linked server trong transaction dễ thành distributed transaction, sinh `OLEDB`, `MSQL_DQ`.
- Outbox: sự kiện ghi local cùng transaction, worker gửi sau, phía nhận idempotent.
- Đọc remote: lọc ở phía remote, đưa vào `#temp` có PK rồi join.

#### Bài tập
1. Viết lại luồng `BEGIN TRAN; UPDATE vật phẩm; EXEC [server khác].proc_ghi_lich_su; COMMIT;` theo outbox, nêu các bảng và job cần có.
   **Đáp án:** Bảng `Outbox(Id identity, EventId uniqueidentifier unique, EventType, Payload, CreatedAt, SentAt)`; transaction chỉ gồm `UPDATE` + `INSERT Outbox`; worker đọc lô `SentAt IS NULL` với `UPDLOCK, READPAST`, gọi proc ở server kia, cập nhật `SentAt`; phía kia unique key trên `EventId`; job dọn outbox cũ; cảnh báo tồn đọng.
2. Kể ba thứ không được nằm trong transaction.
   **Đáp án:** Gọi HTTP/gRPC, gọi linked server, chờ thao tác người dùng; ngoài ra gửi email, ghi file, sleep hoặc retry dài.

### Bài 21.4. Tách đọc và ghi

#### Kiến thức
Luồng ghi nóng (lưu đáp án trong giờ thi) cần ít index để insert nhanh và cần CPU, worker luôn sẵn. Truy vấn báo cáo, CMS, tra cứu khiếu nại cần nhiều index và quét nhiều dữ liệu. Chạy chung một server thì hai nhu cầu kéo nhau: thêm index cho báo cáo làm chậm ghi; báo cáo chiếm worker và memory grant làm luồng thi phải chờ.

##### Phân loại bảng trước khi chọn kiến trúc
1. **Thuần ghi**: log hành vi, log đáp án. Hầu như chỉ insert, đọc lại khi tra cứu.
2. **Ghi dồn rồi đọc tổng kết**: ghi trong ca thi, sau ca chạy tổng hợp.
3. **Đọc-ghi trên đường nóng**: trạng thái bài làm, số lượt còn lại. Người dùng cần thấy ngay giá trị vừa ghi, không tách được.

Nhóm 1 và 2 là ứng viên đưa phần đọc sang server khác. Nhóm 3 ở lại primary và tối ưu bằng index đúng, RCSI, xử lý dòng nóng.

##### Các lựa chọn
| Cách | Bản chất | Index ở bản đọc | Độ trễ | Ghi chú |
|---|---|---|---|---|
| Transactional replication | Bản sao logic: đọc log, áp lệnh lên subscriber | Độc lập, tạo index riêng được | Giây | Bảng publish phải có primary key |
| Always On readable secondary | Bản sao vật lý: gửi log và redo | Giống hệt primary | Giây, redo có thể trễ | Cần Enterprise; Basic AG ở Standard không đọc được |
| Log shipping standby | Restore log định kỳ ở chế độ STANDBY | Giống hệt primary | Phút | Người đọc bị ngắt khi restore |
| CDC → kho dữ liệu | Ghi nhận thay đổi, ETL nạp sang kho | Tự thiết kế | Phút | Hợp cho phân tích |

Điểm mấu chốt: replication là bản sao logic nên subscriber có index riêng, hợp khi primary muốn ít index còn báo cáo cần nhiều index. Readable secondary là bản sao vật lý nên không tạo được index riêng, và primary phải thêm 14 byte version tag vào dòng bị sửa vì secondary đọc theo snapshot. Điều hướng đọc sang secondary bằng `ApplicationIntent=ReadOnly` trong connection string trỏ vào listener.

##### Chấp nhận dữ liệu cũ
Mọi cách tách đọc đều có độ trễ đồng bộ. Phải thống nhất với nghiệp vụ màn hình nào chấp nhận dữ liệu cũ vài giây (báo cáo, thống kê), màn hình nào phải đọc primary (kết quả vừa nộp của chính người dùng: read-your-writes). Ứng dụng cần hai connection string, quy tắc chọn rõ ràng, và metric độ trễ đồng bộ.

##### RCSI trên primary
Read Committed Snapshot Isolation: câu đọc nhận phiên bản dòng đã commit tại lúc câu lệnh bắt đầu, thay vì chờ khoá. Đọc không chặn ghi, ghi không chặn đọc.

```sql
ALTER DATABASE ExamLog SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
```

Chi phí: version store trong tempdb, 14 byte mỗi dòng bị sửa, thêm I/O. Rủi ro logic: code dựa vào việc đọc bị chặn để tuần tự hoá ("đọc số dư rồi trừ") sẽ sai; đoạn đó cần `UPDLOCK` hoặc một câu cập nhật có điều kiện.

#### Cách show off
Phát hiện thật: ở cụm lưu log thi chính thức có wait `THREADPOOL`, vì truy vấn báo cáo chạy chung server với luồng thi. Đề xuất trong báo cáo: primary giữ bảng log ít index để insert nhanh, publish sang cụm kho dữ liệu bằng replication và tạo index cho báo cáo, CMS, tra cứu ở đó. Phần senior là bạn bắt được lỗ hổng của chính đề xuất này: bảng log đang là heap, mà replication đòi bảng có primary key. Ở AvePoint bạn từng làm với PostgreSQL replica, nên có trải nghiệm thật về read-your-writes để kể thêm nếu được hỏi.

> **Ví dụ:** "Ở cụm log thi chính thức, wait stats có `THREADPOOL`, tức có lúc SQL Server hết worker thread, và lần ra thì thấy truy vấn báo cáo đang chạy chung server, tranh tài nguyên với luồng ghi đáp án. Tôi chia bảng theo cách truy cập: log thuần ghi, dữ liệu ghi dồn rồi tổng hợp, và trạng thái làm bài vừa đọc vừa ghi. Hai nhóm đầu tôi đề xuất đẩy sang cụm kho dữ liệu bằng transactional replication, vì subscriber được tạo index riêng cho báo cáo mà primary vẫn giữ ít index. Readable secondary không hợp vì index phải giống primary và cần bản Enterprise. Khi soát lại đề xuất, tôi thấy bảng log đang là heap, mà replication bắt buộc có primary key, nên phải thêm khoá trước. Màn hình xem kết quả vừa nộp thì vẫn đọc primary."

Điểm ăn điểm:
- Phân loại bảng theo cách truy cập trước khi nói tới công nghệ.
- Lý do chọn replication thay vì readable secondary: index riêng và edition.
- Bắt được điều kiện tiên quyết (primary key) mà đề xuất ban đầu bỏ sót.
- Nói tới read-your-writes và metric độ trễ đồng bộ.

#### Câu hỏi vặn
- **"Readable secondary khác transactional replication thế nào cho bài toán này?"** Secondary là bản sao vật lý: index giống hệt primary, không tạo index riêng, cần Enterprise. Replication là bản sao logic: subscriber có index và schema riêng, hợp khi primary muốn ít index còn báo cáo cần nhiều; đổi lại cần PK và vận hành Distributor.
- **"Tách đọc rồi thì màn hình xem kết quả vừa nộp xử lý thế nào?"** Màn hình đó đọc primary. Hoặc ứng dụng nhớ thời điểm ghi của người dùng và chỉ đọc replica khi độ trễ đồng bộ nhỏ hơn khoảng thời gian đã trôi qua. Báo cáo tổng hợp thì đọc replica.
- **"Bảng nào không nên tách sang replica?"** Bảng đọc-ghi trên đường nóng, nơi người dùng phải thấy ngay giá trị vừa ghi: trạng thái bài làm, số lượt còn lại. Những bảng này tối ưu ngay tại primary.
- **"Bật RCSI thì được gì, mất gì?"** Được: đọc không chờ khoá ghi, giảm blocking và deadlock đọc-ghi. Mất: version store trong tempdb, 14 byte mỗi dòng bị sửa, transaction dài giữ version store. Code tuần tự hoá bằng đọc bị chặn phải chuyển sang `UPDLOCK` hoặc cập nhật có điều kiện.
- **"Thêm primary key cho heap log hàng trăm triệu dòng trên bản Standard thì sao?"** Standard không có `ONLINE = ON` và không tạo index song song, nên tạo clustered PK sẽ khoá bảng và chạy lâu. Phải làm trong khung bảo trì, thử trước trên bản sao dữ liệu thật để biết thời gian, hoặc tạo bảng mới có PK rồi chuyển dữ liệu theo lô.
- **"Anh đo độ trễ replication bằng gì?"** Tracer token của replication, hoặc so thời điểm của dòng mới nhất giữa publisher và subscriber, đưa thành metric có cảnh báo.
- **"Phần này đã triển khai chưa?"** Đây là đề xuất trong báo cáo rà soát. Tôi nói rõ điều kiện tiên quyết và cách đo để người triển khai có tiêu chí nghiệm thu; nếu bị hỏi kết quả, tôi chỉ nói khi có số đo thật.

#### Bẫy cần tránh
- Coi readable secondary là "miễn phí": nó cần Enterprise và tạo version tag trên primary.
- Quên read-your-writes: người dùng vừa nộp bài nhưng màn hình đọc từ replica chưa thấy.
- Đề xuất publish heap qua replication.

#### Nhớ nhanh
- Phân loại bảng theo cách truy cập trước khi chọn kiến trúc.
- Replication: bản sao logic, index riêng, cần PK. Readable secondary: bản sao vật lý, index giống primary, cần Enterprise.
- Mọi cách tách đọc đều trễ; xác định màn hình nào phải đọc primary.
- RCSI cho đọc không chặn ghi, trả bằng version store.

#### Bài tập
1. Phân loại ba bảng: log đáp án từng câu, bảng điểm tổng kết sau ca, bảng trạng thái phiên làm bài. Đề xuất nơi đọc cho từng bảng.
   **Đáp án:** Log đáp án: thuần ghi, tra cứu trên subscriber. Điểm tổng kết: báo cáo trên subscriber, màn hình kết quả cá nhân ngay sau ca đọc primary. Trạng thái phiên: đọc-ghi nóng, ở primary.
2. Đọc số dư rồi cập nhật trong hai câu lệnh riêng; sau khi bật RCSI, nêu rủi ro và cách sửa.
   **Đáp án:** Hai phiên cùng đọc số dư cũ rồi cùng trừ, gây âm. Sửa bằng `UPDATE ... SET Balance = Balance - @x WHERE Id = @id AND Balance >= @x` và kiểm tra `@@ROWCOUNT`, hoặc đọc với `UPDLOCK`.

### Bài 21.5. Xử lý lỗi và giám sát không làm hại DB

#### Kiến thức
Hai thứ tưởng là "lưới an toàn" lại hay gây hại: code bắt lỗi rồi giả vờ như không có gì, và công cụ giám sát poll database quá dày.

##### Không nuốt exception
Nuốt exception là bắt lỗi rồi trả về giá trị trông như bình thường:

```csharp
// Sai: lỗi DB biến thành "không có ai trong bảng xếp hạng"
try { return await _repo.GetRankAsync(userId); }
catch { return new List<RankItem>(); }
```

Hậu quả: người dùng thấy dữ liệu sai thay vì thông báo lỗi; metric tỉ lệ lỗi của API vẫn xanh; nếu có cache phía trên, kết quả rỗng còn bị lưu lại. Cách đúng: chỉ bắt exception khi có hành động cụ thể (retry lỗi tạm thời, chuyển sang dữ liệu dự phòng có đánh dấu), luôn ghi log có ngữ cảnh, phần còn lại để middleware xử lý lỗi chung.

```csharp
catch (SqlException ex) when (ex.Number is 1205 or -2)   // deadlock victim, timeout
{
    _logger.LogWarning(ex, "Rank query failed for {UserId}", userId);
    throw;
}
```

Phía T-SQL, `BEGIN CATCH` không `THROW` cũng là nuốt lỗi. Mẫu chuẩn:

```sql
SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRAN;
        -- thao tác
    COMMIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    -- ghi bảng log lỗi ở đây, sau ROLLBACK để không bị rollback theo
    THROW;
END CATCH;
```

`XACT_ABORT ON` đảm bảo khi có lỗi, kể cả client timeout huỷ lệnh, transaction bị rollback thay vì để lại transaction mở giữ khoá.

##### Kiểu dữ liệu khớp từ entity tới cột
- Entity dùng `long`, tham số proc là `INT`: ID vượt 2,1 tỉ là lỗi tràn số.
- Tham số khác kiểu với cột gây implicit conversion; nặng nhất là `nvarchar` so với cột `varchar` theo collation SQL, biến seek thành scan.
- Cột hạng kiểu `int` trong DB nhưng `string` trong entity: sắp theo chuỗi ("10" đứng trước "9").
- Khai báo `SqlDbType` và độ dài tường minh thay vì `AddWithValue`: `AddWithValue` biến mọi chuỗi thành `nvarchar` có độ dài theo giá trị, vừa gây conversion vừa nhân bản plan theo độ dài.

Tìm implicit conversion trong plan cache: cảnh báo `PlanAffectingConvert` trong XML plan, hoặc cột Warnings của `sp_BlitzCache`.

##### Giám sát cũng là tải
Công cụ giám sát poll DMV mỗi vài giây trên mọi DB, gọi extended stored procedure `xp_*` để đọc thông tin hệ điều hành, đọc cả plan cache, và tất cả chạy trên chính server đang được giám sát. Câu DMV nặng có thể tốn nhiều CPU và memory grant. Nguyên tắc: chu kỳ poll hợp lý (30–60 giây cho số tổng, thưa hơn cho plan cache), dùng Query Store và Extended Events thay cho poll liên tục, và đo chính công cụ giám sát như một ứng dụng (lọc theo `program_name`).

##### Cảnh báo theo SLO
Cảnh báo tốt nói rằng người dùng đang hoặc sắp bị ảnh hưởng:
- Theo SLO: tỉ lệ lỗi, p95/p99 của API quan trọng, tốc độ tiêu error budget.
- Theo tài nguyên sắp cạn: % log, dung lượng ổ, tuổi bản backup log gần nhất, độ trễ replication, outbox tồn đọng.
- Theo bất thường: wait mới tăng đột biến so với cùng giờ tuần trước; tỉ lệ response rỗng tăng bất thường, dấu hiệu có lỗi đang bị nuốt.

#### Cách show off
Ba phát hiện thật ở cụm kho dữ liệu và báo cáo: hai lớp proxy C# bắt exception rồi trả null hoặc danh sách rỗng, nên bảng log lỗi không ghi được gì; tham số user là `INT` trong proc nhưng `long` trong entity, cột hạng là `int` trong DB nhưng `string` trong entity; ở cụm log thi, chính công cụ giám sát tạo nhiều wait đáng kể, và bạn đánh giá chỉnh lại nó là việc có tác động lớn nhất ở cụm đó.

> **Ví dụ:** "Khi rà luồng xếp hạng, tôi thấy bảng log lỗi gần như không có gì, dù luồng đó gọi DB rất nhiều trong giờ cao điểm. Đọc code thì thấy hai lớp proxy bắt mọi exception rồi trả null hoặc danh sách rỗng, nên lỗi DB biến thành dữ liệu, metric lỗi vẫn xanh. Tôi đề xuất bỏ các khối đó, ghi log có ngữ cảnh và để middleware trả lỗi chuẩn, đồng thời báo trước với team là tỉ lệ lỗi sẽ tăng lúc đầu, vì đó là những lỗi trước đây bị giấu. Cùng luồng đó tôi thấy ID người dùng là `long` ở C# nhưng `INT` ở proc, sẽ tràn khi ID vượt giới hạn, nên rà lại kiểu tham số của cả luồng. Ở cụm khác, chính công cụ giám sát gọi extended stored procedure liên tục và tạo nhiều wait; tôi đề xuất giãn chu kỳ poll và chuyển sang Query Store."

Điểm ăn điểm:
- Nói trước rằng sửa nuốt lỗi sẽ làm tỉ lệ lỗi tăng, và vì sao đó là tin tốt.
- Nhắc `XACT_ABORT ON` và vị trí ghi log lỗi sau `ROLLBACK`.
- Coi công cụ giám sát là một workload phải đo.
- Đề xuất cảnh báo theo tỉ lệ response rỗng để bắt lỗi bị nuốt.

#### Câu hỏi vặn
- **"API xếp hạng trả rỗng trong giờ thi mà log không có lỗi, anh điều tra từ đâu?"** Nghi exception bị nuốt: tìm `catch` trả rỗng ở proxy và `BEGIN CATCH` không `THROW` trong proc. Đo tỉ lệ response rỗng theo thời gian, đối chiếu với giờ cao điểm; xem timeout, deadlock trong session `system_health`.
- **"Vì sao không dùng AddWithValue?"** Nó suy kiểu từ giá trị .NET: chuỗi thành `nvarchar` có độ dài theo giá trị, gây implicit conversion với cột `varchar` (có thể mất seek) và sinh nhiều plan theo độ dài. Khai báo `SqlDbType` và độ dài tường minh.
- **"SET XACT_ABORT ON có tác dụng gì?"** Khi có lỗi runtime, kể cả client timeout huỷ lệnh, transaction bị rollback toàn bộ thay vì để lại transaction mở giữ khoá. Đi kèm `TRY/CATCH` với `ROLLBACK` và `THROW`.
- **"Retry những lỗi SQL nào?"** Lỗi tạm thời: deadlock 1205, timeout, lỗi kết nối, failover. Không retry lỗi logic như trùng khoá 2627/2601, vi phạm ràng buộc 547, tràn số; retry chúng chỉ nhân tải.
- **"Làm sao biết công cụ giám sát đang làm hại DB?"** Lọc phiên theo `program_name` của công cụ, đo CPU, reads và wait của chúng (`MSQL_XP` khi gọi `xp_*`), xem chu kỳ poll và câu DMV nặng. Giám sát cũng phải nằm trong ngân sách tải.
- **"Bỏ nuốt lỗi xong tỉ lệ lỗi tăng vọt, sếp hỏi thì anh nói sao?"** Đó là lỗi vốn đã có, trước đây bị giấu thành dữ liệu sai. Tôi báo trước khi deploy, kèm danh sách nguyên nhân lỗi xuất hiện để xử lý tiếp, thay vì để người dùng tiếp tục thấy bảng xếp hạng trống.

#### Bẫy cần tránh
- Bỏ nuốt exception mà không có middleware xử lý lỗi: người dùng nhận stack trace.
- Ghi bảng log lỗi trước `ROLLBACK` trong `CATCH`: dòng log bị rollback theo.
- Cảnh báo theo mọi chỉ số vượt ngưỡng: báo động giả nhiều, người trực bỏ qua cả cảnh báo thật.

#### Nhớ nhanh
- Nuốt exception biến lỗi thành dữ liệu sai và làm metric lỗi vô nghĩa.
- T-SQL: `XACT_ABORT ON`, `TRY/CATCH` với `ROLLBACK` rồi `THROW`.
- Kiểu dữ liệu khớp từ entity tới tham số tới cột; khai báo `SqlDbType` tường minh.
- Công cụ giám sát là tải thật; cảnh báo theo SLO và tài nguyên sắp cạn.

#### Bài tập
1. Viết lại khối `BEGIN CATCH SELECT -1 AS Result END CATCH` cho đúng, có ghi log lỗi.
   **Đáp án:** `BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; INSERT dbo.ErrorLog (...) VALUES (ERROR_NUMBER(), ERROR_MESSAGE(), ERROR_PROCEDURE(), SYSUTCDATETIME()); THROW; END CATCH`, kèm `SET XACT_ABORT ON` ở đầu proc.
2. Entity có `long UserId`, proc nhận `@UserId INT`, cột là `BIGINT`. Nêu vấn đề và cách sửa.
   **Đáp án:** ID vượt giới hạn `int` thì lỗi tràn số khi gọi proc. Sửa tham số proc sang `BIGINT`, khai báo `SqlDbType.BigInt` ở C#, rà các proc cùng luồng.

## Chương 22. Đọc báo cáo bằng con mắt senior
Một báo cáo hiệu năng tốt gắn mỗi đề xuất với số đo và tiêu chí nghiệm thu cụ thể, kiểu "spill phải về 0" hay "mỗi lần chạy đọc dưới 20.000 trang". Nhưng báo cáo nào viết trên hàng chục database cũng có chỗ kết luận vượt quá số liệu, hoặc đề xuất đúng về kỹ thuật mà sai về rủi ro. Báo cáo rà soát bạn dẫn cũng không ngoại lệ.

Ở vòng senior, kể "đã sửa gì" chưa đủ. Người phỏng vấn muốn thấy bạn nghi ngờ đúng chỗ: số này đo cái gì, kết luận đúng trong điều kiện nào, đề xuất có thể gây hại ra sao, kiểm chứng bằng cách nào. Chương này gom các điểm phản biện rải rác trong Phần VI thành phương pháp, rồi luyện cách sắp thứ tự ưu tiên và kể lại một đợt tối ưu cho trung thực.

### Bài 22.1. Phản biện số liệu và kết luận trong báo cáo hiệu năng

#### Kiến thức
Phần lớn sai lầm trong báo cáo hiệu năng không phải do tính sai, mà do đọc sai: hiểu nhầm con số đang đo cái gì, hoặc áp một kết luận ra ngoài điều kiện nó đúng.

##### Bốn câu hỏi cho mọi kết luận
1. **Số này đo cái gì, ở đâu, trong khoảng thời gian nào?** `sys.dm_os_wait_stats` cộng dồn từ lần khởi động cuối. Server chạy 200 ngày thì "hàng triệu giây `WRITELOG`" là tổng 200 ngày, không phải tình trạng hôm nay.
2. **Đơn vị đếm có đúng như người viết hiểu không?** Một dòng DMV có thể là một câu lệnh, một plan hay một proc; lượt chờ khác thời gian chờ.
3. **Kết luận đúng trong điều kiện nào?** Phiên bản, edition, compatibility level, recovery model, cấu hình.
4. **Đề xuất có thể gây hại gì, và rollback thế nào?**

##### Đơn vị đếm và nhiễu nền
- Một proc có nhiều dòng trong `sys.dm_exec_query_stats` chưa chắc có nhiều plan: view này có một dòng cho mỗi câu lệnh trong mỗi plan. Đếm `DISTINCT plan_handle` để biết số plan; xem `sys.dm_exec_plan_attributes` để biết vì sao có nhiều plan (khác `set_options`, khác schema mặc định...).
- Hàng trăm triệu lượt `CXCONSUMER` chỉ nói có nhiều trao đổi song song, không nói chúng tốn bao lâu.
- Wait nền như `SLEEP_TASK`, `LAZYWRITER_SLEEP`, `XE_TIMER_EVENT`, `QDS_ASYNC_QUEUE`, `WAIT_XTP_HOST_WAIT` tăng đều kể cả khi server rảnh; không lọc thì phần trăm của wait thật bị lệch. Script wait stats của Paul Randal và `sp_BlitzFirst` có sẵn danh sách lọc.
- `OLEDB` không chỉ do linked server; một số DMV và `DBCC CHECKDB` cũng sinh wait này.

##### Điều kiện phiên bản, edition, cấu hình
- Ngưỡng tự cập nhật statistics: từ compat 130 là ngưỡng động khoảng căn bậc hai của (1.000 × số dòng), bảng 100 triệu dòng khoảng 316.000 thay đổi; compat thấp hơn mới là 500 + 20% số dòng. Kết luận "bảng 100 triệu dòng chỉ cập nhật statistics sau 20 triệu thay đổi" chỉ đúng với compat cũ.
- Bảng biến từ SQL Server 2019 (compat 150) được ước lượng đúng tổng số dòng nhờ deferred compilation, nhưng vẫn không có histogram. "Bảng biến luôn ước lượng 1 dòng" là kiến thức cũ.
- `ONLINE = ON` khi tạo hay rebuild index, và tạo index song song, chỉ có ở Enterprise (và Developer, Azure SQL). Trên Standard, tạo index lớn khoá bảng và chạy một luồng.

##### Rủi ro của đề xuất
- Chuyển hàng loạt DB sang SIMPLE phải hỏi RPO trước: DB thanh toán, kết quả thi mất khả năng khôi phục theo thời điểm.
- Clustered key identity bỏ page split giữa trang nhưng dồn insert vào trang cuối (`PAGELATCH_EX`) khi insert đồng thời cao; SQL Server 2019 có `OPTIMIZE_FOR_SEQUENTIAL_KEY`.
- `OPTION (RECOMPILE)` sửa parameter sniffing nhưng biên dịch mỗi lần chạy; proc gọi hàng triệu lần mỗi ngày sẽ tốn CPU đáng kể.
- Transactional replication đòi bảng publish có primary key.
- Quy nguyên nhân từ một wait duy nhất (ví dụ coi `PREEMPTIVE_OS_CRYPTOPS` hoàn toàn là do TLS) cần đối chiếu số liệu khác.

##### Chụp wait stats theo khoảng thời gian
```sql
SELECT wait_type, waiting_tasks_count, wait_time_ms INTO #w1 FROM sys.dm_os_wait_stats;
WAITFOR DELAY '00:05:00';   -- chạy trong giờ cao điểm
SELECT w2.wait_type,
       w2.wait_time_ms - w1.wait_time_ms AS wait_ms,
       w2.waiting_tasks_count - w1.waiting_tasks_count AS waits,
       (w2.wait_time_ms - w1.wait_time_ms) * 1.0
         / NULLIF(w2.waiting_tasks_count - w1.waiting_tasks_count, 0) AS avg_ms
FROM sys.dm_os_wait_stats w2
JOIN #w1 w1 ON w1.wait_type = w2.wait_type
WHERE w2.wait_type NOT IN ('SLEEP_TASK','LAZYWRITER_SLEEP','XE_TIMER_EVENT',
                           'QDS_ASYNC_QUEUE','WAIT_XTP_HOST_WAIT','BROKER_TO_FLUSH')  -- rút gọn
ORDER BY wait_ms DESC;
```

`sp_BlitzFirst @Seconds = 300` làm việc tương tự và đã lọc wait nền.

#### Cách show off
Câu chuyện mạnh nhất ở đây là tự phản biện: đọc lại báo cáo rà soát của chính mình và chỉ ra các chỗ kết luận vượt quá số liệu. Nếu việc soát lại này bạn làm trong lúc ôn phỏng vấn chứ không phải lúc nộp báo cáo, nói đúng như vậy ("khi xem lại báo cáo"). Điều này cho thấy bạn không bảo vệ con số của mình một cách mù quáng. Chọn hai ví dụ dễ hiểu là đủ, ví dụ đề xuất chuyển SIMPLE ở cụm có DB thanh toán, và đề xuất publish bảng heap qua replication.

> **Ví dụ:** "Khi xem lại báo cáo, tôi soát từng kết luận bằng bốn câu hỏi: số này đo gì và trong bao lâu, đơn vị đếm là gì, đúng trong điều kiện nào, đề xuất có thể gây hại gì. Ví dụ phần lớn wait stats trong báo cáo là số cộng dồn từ lần khởi động, nên trước khi chốt thứ tự ưu tiên cần chụp lại theo khoảng vài phút trong giờ cao điểm. Một chỗ khác là đề xuất chuyển hàng loạt database sang SIMPLE cho nhẹ log; cụm đó có database thanh toán, nên tôi sửa thành quyết định theo RPO từng database. Hay đề xuất rebuild index online trong giờ hành chính: server chạy bản Standard, không có online rebuild, nên phải dời sang khung đêm. Mỗi điểm phản biện tôi đều kèm một truy vấn kiểm chứng, để cuộc trao đổi dựa trên số chứ không dựa trên ai nói to hơn."

Điểm ăn điểm:
- Phân biệt số cộng dồn với số theo khoảng thời gian, lượt chờ với thời gian chờ.
- Biết các kết luận phụ thuộc phiên bản, edition, compatibility level, và kiểm tra trước.
- Mỗi điểm phản biện kết thúc bằng "kiểm chứng bằng cách...".
- Không bác bỏ cả báo cáo vì vài chỗ sai; chỉ điều chỉnh các mục có điều kiện.

#### Câu hỏi vặn
- **"Báo cáo ghi WRITELOG hàng triệu giây, anh có kết luận ổ log chậm không?"** Chưa. Đó là số cộng dồn từ lần khởi động. Tôi chụp chênh lệch trong giờ cao điểm, tính thời gian chờ trung bình mỗi lượt, và đo độ trễ ghi file log bằng `sys.dm_io_virtual_file_stats`. Trung bình vài ms là bình thường; vài chục ms mới là ổ hoặc cấu hình có vấn đề.
- **"Một proc có 15 dòng trong dm_exec_query_stats, có phải nó có 15 plan?"** Không chắc. View có một dòng cho mỗi câu lệnh trong mỗi plan. Đếm `DISTINCT plan_handle`; nếu thật sự nhiều plan, xem `sys.dm_exec_plan_attributes` để biết thuộc tính nào khác nhau.
- **"Statistics bảng 100 triệu dòng chỉ tự cập nhật sau 20 triệu thay đổi, đúng không?"** Chỉ đúng với compat dưới 130 và không bật trace flag 2371. Từ compat 130 ngưỡng khoảng căn bậc hai của 1.000 × số dòng, tức khoảng 316.000 thay đổi. Tôi kiểm tra compat level của DB trước khi kết luận.
- **"Rebuild index với ONLINE = ON trong giờ hành chính có vấn đề gì?"** `ONLINE = ON` chỉ có ở Enterprise; trên Standard phải chạy offline, khoá bảng, và không song song. Ngay cả Enterprise, online rebuild vẫn cần khoá ngắn đầu và cuối, tốn version store và log. Kiểm tra edition, chạy trong khung thấp tải.
- **"Báo cáo đề xuất OPTION (RECOMPILE) cho proc gọi hàng triệu lần mỗi ngày, anh phản biện thế nào?"** Nó sửa parameter sniffing nhưng biên dịch lại mỗi lần chạy. Tôi ước lượng CPU biên dịch (thời gian biên dịch nhân số lần gọi) và so với lợi ích; cân nhắc `OPTIMIZE FOR`, tách proc theo nhánh, Query Store hint, hoặc PSP optimization trên SQL Server 2022.
- **"Báo cáo là của anh, sao lại tự bắt lỗi nó?"** Vì báo cáo dùng để ra quyết định trên production. Tìm ra chỗ sai trước khi DBA làm theo rẻ hơn nhiều so với rollback sau đó. Tôi giữ nguyên các đề xuất đúng và chỉ sửa những mục có điều kiện.

#### Bẫy cần tránh
- Phản biện để thắng tranh luận thay vì để ra quyết định đúng.
- Đọc số cộng dồn của DMV như số hiện tại.
- Nói kiến thức theo phiên bản cũ ("bảng biến luôn ước lượng 1 dòng", "statistics cập nhật sau 20%") mà không nêu điều kiện.

#### Nhớ nhanh
- Bốn câu hỏi: đo gì và trong bao lâu; đơn vị đếm; điều kiện đúng; rủi ro và rollback.
- Wait stats: chênh lệch theo khoảng trong giờ cao điểm, đã lọc wait nền.
- Nhiều kết luận phụ thuộc phiên bản, edition, compatibility level.
- Mỗi điểm phản biện kết thúc bằng cách kiểm chứng.

#### Bài tập
1. Viết các truy vấn kiểm tra điều kiện trước khi chấp nhận đề xuất về statistics, `ONLINE = ON` và recovery model.
   **Đáp án:** `SELECT name, compatibility_level, recovery_model_desc FROM sys.databases;` và `SELECT SERVERPROPERTY('Edition'), SERVERPROPERTY('ProductVersion'), SERVERPROPERTY('ProductUpdateLevel');`. RPO của từng DB không truy vấn được, phải hỏi nghiệp vụ.
2. Báo cáo viết "CXCONSUMER hàng trăm triệu lượt là vấn đề lớn nhất của cụm". Viết lại cho chính xác.
   **Đáp án:** "Cụm có nhiều truy vấn chạy song song (số lượt `CXCONSUMER` rất lớn, wait thường vô hại). Cần đo `CXPACKET` theo thời gian chờ trong giờ cao điểm và xác định truy vấn song song nặng nhất; nguyên nhân khả dĩ là cost threshold đang để mặc định 5."

### Bài 22.2. Sắp thứ tự ưu tiên và trình bày đề xuất tối ưu

#### Kiến thức
Một đợt rà soát cho ra hàng chục đề xuất. Làm tất cả cùng lúc thì không biết thay đổi nào có tác dụng, thay đổi nào gây lỗi. Kỹ năng ở đây là sắp thứ tự và viết đề xuất sao cho người khác triển khai được, đo được, lùi được.

##### Thứ tự ưu tiên theo rủi ro
Ngoại lệ đứng đầu: rủi ro mất dữ liệu hoặc sập ngay (log sắp đầy, ổ còn vài phần trăm, tempdb trên ổ C) xử lý trước tiên, bất kể thuộc nhóm nào. Sau đó, theo rủi ro tăng dần:

1. **Sửa proc và code** (tham số hoá, bỏ hàm trên cột, sửa kiểu dữ liệu, cache, bỏ gọi ngoài trong transaction): phạm vi hẹp, `ALTER PROCEDURE` chỉ giữ khoá schema trong chốc lát nên deploy được giữa ngày, rollback bằng bản cũ.
2. **Index** trong khung đêm: tác động lớn, nhưng tốn đĩa, làm chậm ghi, và trên Standard thì tạo index khoá bảng, chạy một luồng. Rollback bằng `DROP INDEX`.
3. **Cấu hình instance** (bộ nhớ, song song, tempdb, CU): ảnh hưởng toàn server, có mục cần restart.
4. **Thay đổi kiến trúc** (tách đọc/ghi, replication, partition, outbox, hàng đợi): lợi ích dài hạn lớn nhất nhưng tốn công và thêm thành phần phải vận hành.

Trong mỗi nhóm, xếp theo tác động trên công sức. Lấy top truy vấn theo tổng CPU hoặc tổng số trang đọc, không theo trung bình: proc nhẹ gọi hàng trăm triệu lần thường quan trọng hơn proc nặng chạy mười lần mỗi ngày.

##### Mẫu một đề xuất tốt
```text
Vấn đề:      Proc lấy đề theo mã đề gọi khoảng 640.000 lần/ngày; đề không đổi trong ca thi.
Số đo trước: Số lần gọi và CPU tổng mỗi ngày (Query Store, 7 ngày, cùng khung giờ).
Thay đổi:    Cache theo mã đề (L1 + Redis), warmup trước ca, xoá key khi CMS sửa đề.
Rủi ro:      Đề sửa giữa ca không được cập nhật nếu bước xoá cache lỗi.
Đường lui:   Feature flag tắt cache, đọc thẳng DB.
Nghiệm thu:  Số lần gọi proc giảm hơn 99%; p99 API lấy đề không tăng; cache hit trên 99%.
```

Năm phần bắt buộc: số đo trước, thay đổi, rủi ro, đường lui, tiêu chí nghiệm thu đo được. Thiếu số đo trước thì không chứng minh được tác dụng; thiếu đường lui thì không nên đưa lên production.

##### Triển khai và đo
- Mỗi lần một nhóm thay đổi nhỏ, có mốc thời gian, để quy được tác động.
- So cùng khung giờ, cùng ngày trong tuần, vì tải hệ thống thi đổi mạnh theo ca.
- Chuẩn hoá theo số lần gọi (CPU mỗi lần, số trang đọc mỗi lần), dùng Query Store so từng truy vấn; với thay đổi cấu hình, so wait stats theo khoảng.

##### Kể lại cho trung thực
Khung kể: bối cảnh (hệ thống, tải) → vấn đề có số → cách tìm nguyên nhân → quyết định và đánh đổi → kết quả có số → điều sẽ làm khác. Nói đúng vai trò (dẫn rà soát, viết đề xuất, review, hay tự commit). Số đo được thì nói số đó; số ước lượng thì nói là ước lượng; đề xuất chưa triển khai thì nói "đề xuất", không nói "đã giảm".

#### Cách show off
Kế hoạch hai tầng là việc thật của bạn: sửa proc trong ngày vì `ALTER PROCEDURE` gần như không gây gián đoạn, còn index thì gom sang khung đêm làm cùng DBA, vì server chạy bản Standard nên tạo index sẽ khoá bảng. Câu chuyện có số tốt nhất là API bắt đầu thi: trace APM trước và sau cho thấy từ hơn 2 giây xuống dưới 0,1 giây. Vai trò của bạn là tìm nguyên nhân và đề xuất, đồng nghiệp commit bản sửa; con số là trace điển hình, không phải p95.

> **Ví dụ:** "Đợt rà soát cho ra vài chục đề xuất, nên việc đầu tiên tôi làm là sắp thứ tự. Những thứ có thể làm sập hệ thống, như log gần đầy hay tempdb nằm trên ổ hệ điều hành sắp hết chỗ, xử lý ngay. Sau đó tôi chia hai tầng: sửa stored procedure thì deploy trong ngày vì gần như không gây gián đoạn và lùi được ngay; còn index thì gom sang khung đêm cùng DBA, vì server chạy bản Standard, tạo index sẽ khoá bảng. Mỗi đề xuất có số đo trước, rủi ro, đường lui và tiêu chí nghiệm thu. Ví dụ rõ nhất là API bắt đầu thi: tôi lần theo trace và thấy hàm làm mới cache quét toàn bộ keyspace Redis hàng trăm vòng trong một request; đồng nghiệp sửa theo hướng tôi đề xuất, và trace điển hình giảm từ hơn 2 giây xuống dưới 0,1 giây. Đó là trace trước và sau, tôi chưa đo p95 cho API này."

Điểm ăn điểm:
- Có ngoại lệ "rủi ro sập trước" trước khi nói tới thứ tự thường.
- Xếp hạng theo tổng tài nguyên, không theo trung bình.
- Đề xuất có đường lui và tiêu chí nghiệm thu đo được.
- Tách bạch vai trò và loại số liệu (trace điển hình, ước lượng, hay p95 đo thật).

#### Câu hỏi vặn
- **"Báo cáo có 40 đề xuất, anh làm cái nào trước?"** Trước tiên là rủi ro mất dữ liệu hoặc sập ngay. Sau đó theo rủi ro tăng dần: sửa proc và code, index trong khung đêm, cấu hình instance, cuối cùng là kiến trúc. Trong mỗi nhóm, xếp theo tổng CPU hoặc tổng số trang đọc.
- **"Vì sao xếp theo tổng chứ không theo trung bình?"** Tổng bằng trung bình nhân số lần gọi, phản ánh tải thật lên server. Proc 10 ms gọi hàng trăm triệu lần tốn hơn proc 5 giây gọi mười lần. Trung bình chỉ dùng khi quan tâm trải nghiệm của một request cụ thể.
- **"Làm sao biết thay đổi có tác dụng thật, không phải do hôm đó tải thấp?"** So cùng khung giờ, cùng ngày trong tuần, chuẩn hoá theo số lần gọi. Triển khai từng nhóm nhỏ có mốc thời gian; dùng Query Store so từng truy vấn.
- **"Sao không mua Enterprise để đánh index online cho nhanh?"** License tính theo core, chi phí rất lớn so với việc dời lịch tạo index sang khung đêm. Tôi chỉ đề xuất nâng edition khi có yêu cầu không làm được ở Standard, như readable secondary.
- **"Trước và sau là bao nhiêu, p95 hay trung bình?"** Con số tôi có là trace điển hình trước và sau, không phải p95. Nếu cần p95, tôi lấy từ histogram độ trễ của API trong cùng khung giờ thi trước và sau bản sửa.
- **"Phần nào trong đó là của anh?"** Tôi dẫn đợt rà soát, tìm nguyên nhân và viết đề xuất kèm cách đo; một số bản sửa do đồng nghiệp commit, phần index do DBA chạy. Tôi nói rõ để người nghe biết tôi chịu trách nhiệm phần nào.

#### Bẫy cần tránh
- Bắt đầu bằng thay đổi kiến trúc vì "đẹp" khi các proc nóng còn chưa sửa.
- Đo trung bình cả ngày: che mất giờ cao điểm, nơi vấn đề thật xảy ra.
- Nhận công cho số liệu của người khác hoặc cho đề xuất chưa triển khai; gọi trace điển hình là p95.

#### Nhớ nhanh
- Rủi ro mất dữ liệu hoặc sập ngay xử lý trước tiên.
- Sau đó: code/proc → index → cấu hình instance → kiến trúc; trong nhóm xếp theo tổng tài nguyên.
- Mỗi đề xuất có số đo trước, rủi ro, đường lui, tiêu chí nghiệm thu.
- Khi kể: đúng vai trò, đúng loại số liệu, có đánh đổi.

#### Bài tập
1. Sắp xếp theo thứ tự triển khai: thêm index cho proc tìm feed; cài CU cho SQL Server 2019 RTM; backup log cho DB đầy gần 100%; cache đề theo mã đề; tách bảng log sang replica.
   **Đáp án:** Backup log cho DB đầy (rủi ro sập) → cache đề (code) → index proc tìm feed (khung đêm) → cài CU (khung bảo trì) → tách bảng log sang replica (kiến trúc).
2. Viết lại câu "Tôi đã giảm 90% CPU của cụm" cho trung thực khi bạn chỉ dẫn rà soát và đề xuất, đồng nghiệp triển khai, số đo là ước lượng.
   **Đáp án:** "Tôi dẫn đợt rà soát và viết đề xuất; đồng nghiệp triển khai. Theo ước lượng từ Query Store, các thay đổi đó có thể giảm đáng kể CPU của nhóm proc nóng; số đo sau triển khai tôi chưa có đầy đủ."

## Chương 23. Ngoài báo cáo: tối ưu cho hệ thống lớn
Đợt rà soát tập trung vào SQL Server và cách ứng dụng gọi nó. Khi hệ thống lớn lên, nút thắt chuyển sang chỗ khác: một dòng dữ liệu bị cập nhật dồn dập, cache phân tán, hàng đợi, giới hạn tải, runtime .NET, mạng, và chi phí. Chương này không phủ hết kiến thức tối ưu, nhưng phủ các mảng một backend senior hay bị hỏi.

Phần lớn nội dung chương là kiến thức bạn chưa làm hết ở dự án, nên mỗi bài đều chỉ rõ phần nào bạn có trải nghiệm thật và cách nói trung thực cho phần còn lại: "ở dự án tôi chưa triển khai, nếu làm tôi sẽ thiết kế thế này". Với bài toán kỳ thi (tải dồn theo ca, đỉnh ở đầu và cuối ca), thứ tự ưu tiên hợp lý là: kiểm soát lượng người vào thi và hàng đợi cho nộp bài; nạp sẵn cache đề và chống stampede; xử lý dòng nóng; kho cột cho báo cáo; load test dạng spike trên dữ liệu cỡ thật.

Sách nên đọc: *Designing Data-Intensive Applications* (Kleppmann), *Database Internals* (Petrov), *Systems Performance* (Gregg), *Release It!* (Nygard), *Site Reliability Engineering* (Google), *Pro .NET Memory Management* (Kokosa).

### Bài 23.1. Database nâng cao

#### Kiến thức
Khi tải ghi đồng thời tăng, vấn đề chuyển từ "truy vấn chậm" sang "các truy vấn chặn nhau". Bài này gom các kỹ thuật cho tình huống đó và cho phân tích trên dữ liệu lớn.

##### Đồng thời và khoá
- **Snapshot isolation** khác RCSI: RCSI cho mỗi câu lệnh một snapshot; Snapshot isolation cho cả transaction một snapshot và báo lỗi xung đột cập nhật (3960) nếu dòng đã bị sửa sau khi transaction bắt đầu.
- **Deadlock**: SQL Server chọn một phiên làm nạn nhân (lỗi 1205). Deadlock graph có sẵn trong session `system_health`. Giảm bằng thứ tự truy cập bảng thống nhất, transaction ngắn, index đúng để không quét và khoá thừa, RCSI cho xung đột đọc-ghi, ứng dụng retry lỗi 1205.
- **Lock escalation**: khi một câu lệnh giữ khoảng 5.000 khoá trên một đối tượng, SQL Server cố nâng lên khoá bảng. Tránh bằng thao tác theo lô nhỏ.
- **Optimistic concurrency** bằng `rowversion`: cập nhật kèm `WHERE RowVer = @RowVer`, `@@ROWCOUNT = 0` nghĩa là có người sửa trước. Hợp cho màn hình CMS sửa cấu hình.
- **Application lock** (`sp_getapplock`): khoá trên một tên do ứng dụng tự đặt, ví dụ theo `userId` + `eventId`, để tuần tự hoá đoạn "kiểm tra đã có chưa rồi mới chèn" mà không khoá cả bảng.

```sql
SELECT CAST(event_data AS xml) AS deadlock
FROM sys.fn_xe_file_target_read_file('system_health*.xel', NULL, NULL, NULL)
WHERE object_name = 'xml_deadlock_report';
```

##### Dòng nóng
Dòng nóng là một dòng bị cập nhật dồn dập: bộ đếm lượt tham gia, tổng điểm sự kiện, số quà còn lại. Mọi `UPDATE` vào cùng dòng phải xếp hàng chờ khoá X; thông lượng bị giới hạn bởi thời gian giữ khoá cộng thời gian ghi log khi commit. Hai cách tách:
- **Sharded counter**: chia bộ đếm thành N dòng, mỗi lần cập nhật một dòng ngẫu nhiên, khi đọc thì cộng lại.

```sql
UPDATE dbo.CounterSlot SET Value = Value + 1
WHERE CounterId = @CounterId AND Slot = ABS(CHECKSUM(NEWID())) % 16;
SELECT SUM(Value) FROM dbo.CounterSlot WHERE CounterId = @CounterId;
```

- **Gom theo lô**: cộng dồn trong bộ nhớ hoặc Redis `INCR`, vài giây ghi xuống DB một lần. Đánh đổi: mất phần chưa ghi nếu tiến trình chết, nên chỉ dùng cho số liệu chấp nhận sai lệch nhỏ hoặc có đối soát. Số dư, tồn kho không được sai thì dùng câu cập nhật có điều kiện (`WHERE Quantity >= @Qty`) và giữ transaction cực ngắn.

##### Columnstore và batch mode
Columnstore lưu theo cột: dữ liệu chia thành rowgroup tối đa khoảng một triệu dòng, mỗi cột nén riêng. Truy vấn tổng hợp chỉ đọc cột cần, bỏ qua segment không khớp điều kiện (segment elimination), và chạy batch mode (xử lý hàng trăm dòng một lần), thường nhanh hơn rowstore hàng chục lần trên bảng hàng trăm triệu dòng. Dữ liệu mới vào delta store trước, được nén sau; bulk insert từ 102.400 dòng trở lên vào thẳng rowgroup nén. Không dùng cho truy vấn lấy vài dòng theo khoá hay bảng cập nhật từng dòng liên tục.

##### In-Memory OLTP và Intelligent Query Processing
Bảng memory-optimized nằm trong RAM, không dùng khoá và latch, có hai mức bền: `SCHEMA_AND_DATA` và `SCHEMA_ONLY` (mất khi restart, hợp cho session, staging). Đánh đổi: tốn RAM, hạn chế tính năng, vận hành phức tạp hơn.

Intelligent Query Processing là nhóm tính năng optimizer tự điều chỉnh, bật theo compatibility level: 2017 có adaptive join, memory grant feedback; 2019 có batch mode trên rowstore, table variable deferred compilation, scalar UDF inlining; 2022 có Parameter Sensitive Plan optimization, DOP feedback, Query Store hints. Nâng compat level có rủi ro hồi quy plan: bật Query Store trước, nâng, so sánh, force plan cũ cho truy vấn bị hồi quy.

##### Ghi theo lô và sinh ID
Mỗi dòng một lần gọi là một round-trip và một lần chờ `WRITELOG`. Gom bằng **TVP** (truyền nhiều dòng vào proc trong một lần gọi) hoặc **`SqlBulkCopy`** cho hàng nghìn tới hàng triệu dòng.

```csharp
cmd.Parameters.Add(new SqlParameter("@Answers", SqlDbType.Structured)
{
    TypeName = "dbo.AnswerTableType",   // user-defined table type
    Value = answersDataTable
});
```

GUID ngẫu nhiên làm clustered key gây chèn vào giữa index, page split, phân mảnh. Thay bằng identity/sequence, `NEWSEQUENTIALID()`, hoặc Snowflake ID sinh ở ứng dụng (thời gian + mã máy + số thứ tự). UUID v7 (`Guid.CreateVersion7()` từ .NET 9) tăng theo thời gian theo thứ tự byte chuẩn, nhưng SQL Server so `uniqueidentifier` theo thứ tự byte riêng (nhóm byte cuối so trước), nên lưu vào cột `uniqueidentifier` không tăng dần theo cách SQL Server sắp xếp.

##### Khi nào cần kho khác
Sharding chia dữ liệu ra nhiều DB theo shard key; khó ở truy vấn và transaction chéo shard, chia lại khi thêm node. Đúng việc đúng kho: Elasticsearch cho tìm kiếm toàn văn, ClickHouse cho phân tích cột rất lớn, object storage cho file. Indexed view là một dạng read model ngay trong SQL Server: kết quả tổng hợp được lưu sẵn, đổi lại mỗi lần ghi bảng gốc tốn thêm.

#### Cách show off
Trải nghiệm thật bạn có ở đây là application lock: trong một sự kiện, bạn dùng `sp_getapplock` để đảm bảo mỗi người chỉ được chèn kết quả một lần dù request tới đồng thời. Nếu không có số đo bản ghi trùng trước và sau, đừng đưa ra con số; kể cơ chế là đủ. Các phần còn lại (sharded counter, columnstore) nói theo hướng thiết kế. Phía báo cáo, kho dữ liệu hiện chạy job SQL Agent mỗi giờ; columnstore là bước nên thử trước khi nghĩ tới kho khác.

> **Ví dụ:** "Trong một sự kiện, mỗi người chơi chỉ được ghi kết quả một lần, nhưng client có thể gửi hai request gần như cùng lúc, và kiểu kiểm tra 'đã có kết quả chưa rồi mới chèn' có thể lọt khi hai request chạy song song. Tôi dùng application lock theo người chơi và sự kiện, giữ trong transaction rất ngắn, nên hai request cùng người bị tuần tự hoá còn người khác không ảnh hưởng nhau. Với bộ đếm tổng của cả sự kiện, nếu số lượt cập nhật lên tới hàng nghìn mỗi giây thì một dòng sẽ thành điểm nghẽn; khi đó tôi sẽ tách thành nhiều dòng rồi cộng khi đọc, hoặc đếm trên Redis rồi ghi xuống theo lô nếu chấp nhận lệch nhỏ. Còn số dư hay số quà thì không gom lô, chỉ dùng câu cập nhật có điều kiện. Phần tách bộ đếm tôi chưa phải làm ở dự án, vì tải chưa tới mức đó."

Điểm ăn điểm:
- Phân biệt dữ liệu chấp nhận lệch (bộ đếm hiển thị) với dữ liệu không được sai (số dư, tồn kho).
- Nói được columnstore hợp và không hợp với kiểu truy vấn nào.
- Nâng compat level có Query Store làm lưới an toàn.
- Chỉ ra cái bẫy UUID v7 với thứ tự sắp xếp của SQL Server.

#### Câu hỏi vặn
- **"Bộ đếm lượt tham gia bị cập nhật hàng nghìn lần mỗi giây và gây blocking, anh xử lý thế nào?"** Đó là dòng nóng. Tách thành sharded counter (N dòng, cập nhật ngẫu nhiên một dòng, đọc thì cộng), hoặc đếm trên Redis `INCR` rồi ghi xuống DB theo lô nếu chấp nhận sai lệch nhỏ. Số dư không được sai thì giữ cập nhật có điều kiện và transaction cực ngắn.
- **"Sao dùng applock mà không dùng unique constraint?"** Nếu nghiệp vụ biểu diễn được bằng một khoá duy nhất thì unique constraint là lựa chọn đầu tiên, rẻ và chắc. Applock dùng khi điều kiện phức tạp hơn một khoá, ví dụ phải đọc vài bảng để quyết định có được chèn không. Nếu bị hỏi tiếp: applock phải nằm trong transaction ngắn, owner là transaction để tự nhả khi commit hoặc rollback.
- **"Khi nào dùng columnstore?"** Truy vấn tổng hợp quét nhiều dòng ít cột trên bảng lớn: báo cáo, thống kê, xếp hạng. Không hợp cho lấy vài dòng theo khoá hay cập nhật từng dòng liên tục, vì delta store và dòng bị đánh dấu xoá sẽ tích tụ.
- **"GUID làm clustered key có vấn đề gì?"** GUID ngẫu nhiên chèn vào giữa index gây page split, phân mảnh, buffer pool kém hiệu quả. Dùng identity/sequence, `NEWSEQUENTIALID()`, hoặc Snowflake ID; nếu dùng UUID v7 thì lưu ý thứ tự so sánh `uniqueidentifier` của SQL Server khác thứ tự byte chuẩn.
- **"Anh tìm nguyên nhân deadlock thế nào?"** Lấy deadlock graph từ `system_health`, xem hai phiên giữ và chờ khoá gì, trên đối tượng nào, câu lệnh nào. Sửa bằng thứ tự truy cập thống nhất, index để thu hẹp phạm vi khoá, transaction ngắn, RCSI cho xung đột đọc-ghi; ứng dụng retry lỗi 1205.
- **"Nâng compatibility level để có IQP có rủi ro gì?"** Đổi cardinality estimator và hành vi optimizer, một số plan có thể tệ đi. Bật Query Store trước, ghi baseline, nâng compat, so truy vấn hồi quy và force plan cũ hoặc dùng Query Store hint.

#### Bẫy cần tránh
- Gom cập nhật theo lô cho tiền hay tồn kho: tiến trình chết là mất cập nhật.
- Nói "columnstore nhanh hơn" mà không nói nhanh cho loại truy vấn nào.
- Kể sharded counter như đã làm khi thực tế chưa gặp tải tới mức đó.

#### Nhớ nhanh
- Dòng nóng: sharded counter hoặc gom lô; số dư thì cập nhật có điều kiện.
- Applock tuần tự hoá theo khoá nghiệp vụ; unique constraint vẫn là lựa chọn đầu tiên nếu dùng được.
- Columnstore + batch mode cho tổng hợp; IQP theo compat level, nâng compat có Query Store.
- Ghi theo lô bằng TVP/`SqlBulkCopy`; ID tăng dần thay GUID ngẫu nhiên.

#### Bài tập
1. Thiết kế bảng sharded counter cho bộ đếm lượt tham gia, kèm câu cập nhật và câu đọc.
   **Đáp án:** `CounterSlot(CounterId int, Slot tinyint, Value bigint, PRIMARY KEY (CounterId, Slot))`, khởi tạo 16 dòng mỗi bộ đếm; cập nhật `Slot = ABS(CHECKSUM(NEWID())) % 16`; đọc `SUM(Value)`.
2. Bảng log đáp án 500 triệu dòng, báo cáo đếm số câu đúng theo môn, theo ngày chạy 3 phút. Đề xuất cách tăng tốc và đánh đổi.
   **Đáp án:** Columnstore ở replica báo cáo (hoặc nonclustered columnstore trên bảng gốc); đánh đổi là ghi chậm hơn và tốn tài nguyên nén. Làm ở replica để primary giữ insert nhanh.

### Bài 23.2. Cache nâng cao

#### Kiến thức
Bài cache ở chương 21 dừng ở cache-aside một lớp. Ở quy mô lớn, các câu hỏi chuyển sang: hai tầng cache phối hợp thế nào, key nóng làm gì, xoá cache hàng loạt ra sao mà không chặn Redis.

##### Cache hai tầng
L1 trong process (không qua mạng), L2 là Redis dùng chung. Đọc L1, trượt thì L2, trượt nữa thì DB, rồi ghi ngược lên L2 và L1. L1 có TTL ngắn hơn L2 để giới hạn độ lệch giữa các instance. Khi dữ liệu đổi: xoá L2 và phát Redis Pub/Sub để mọi instance xoá L1.

`HybridCache` (gói `Microsoft.Extensions.Caching.Hybrid`, ra mắt cùng thời .NET 9) làm sẵn hai tầng, chống stampede trong một instance và xoá theo tag:

```csharp
builder.Services.AddHybridCache(o => o.DefaultEntryOptions = new HybridCacheEntryOptions
{
    Expiration = TimeSpan.FromMinutes(30),          // L2
    LocalCacheExpiration = TimeSpan.FromSeconds(30) // L1
});

var paper = await _cache.GetOrCreateAsync($"exam:paper:{paperId}",
    async ct => await _repo.GetPaperAsync(paperId, ct),
    tags: new[] { $"exam:{examId}" }, cancellationToken: ct);

await _cache.RemoveByTagAsync($"exam:{examId}");   // khi CMS sửa đề
```

##### Chống stampede nâng cao
- **Request coalescing**: gộp yêu cầu trùng key thành một lần nạp. Giữa nhiều instance dùng khoá Redis `SET lock:key token NX PX 5000`.
- **Hết hạn sớm theo xác suất (XFetch)**: mỗi lần đọc, nạp lại sớm với xác suất tăng dần khi gần hết hạn, điều kiện `now - delta * beta * ln(rand()) >= expiry` (delta là thời gian nạp, beta thường là 1). Key nóng gần như luôn được một request làm mới trước khi hết hạn.
- **Stale-while-revalidate**: lưu "hạn mềm" và "hạn cứng"; quá hạn mềm thì trả bản cũ và nạp nền.

##### Hot key, big key và xoá hàng loạt
- **Hot key**: một key nhận phần lớn lượt đọc (cấu hình sự kiện đang chạy); trong Redis Cluster mọi lượt đọc dồn vào một node. Xử lý: L1 trong process, nhân bản key (`config:event:{n}`, đọc ngẫu nhiên một bản), đọc từ replica.
- **Big key**: value hàng MB hoặc collection hàng trăm nghìn phần tử. Redis thực thi lệnh trên một luồng chính, nên thao tác với big key chặn mọi lệnh khác. Chia nhỏ, nén, chỉ cache phần cần; xoá bằng `UNLINK` thay cho `DEL`.
- **Xoá theo pattern**: `KEYS` quét toàn bộ và chặn server. `SCAN` không chặn lâu từng lệnh, nhưng duyệt hết keyspace trên đường xử lý request là hàng trăm round-trip. Cách đúng là đừng phải tìm key: giữ một Redis SET làm chỉ mục các key thuộc một nhóm rồi xoá đúng các key đó, hoặc dùng key có version (`exam:paper:{id}:v{n}`), tăng version thì key cũ tự hết hạn.

##### Vận hành Redis
- Một `ConnectionMultiplexer` singleton; StackExchange.Redis tự pipeline các lệnh async.
- **Lua script** chạy nguyên tử nhiều lệnh trên server, ví dụ "còn lượt thì trừ":

```lua
local left = tonumber(redis.call('GET', KEYS[1]) or '0')
if left >= tonumber(ARGV[1]) then
  return redis.call('DECRBY', KEYS[1], ARGV[1])
end
return -1
```

- **Cluster**: 16.384 hash slot; key trong một lệnh nhiều key phải cùng slot, ép bằng hash tag `{user:123}:a`.
- **Eviction**: mặc định `noeviction` (đầy thì lệnh ghi lỗi). Cache thuần dùng `allkeys-lru` hoặc `allkeys-lfu`; dữ liệu không được mất thì tách instance.
- **Persistence**: RDB (snapshot định kỳ) và AOF (`appendfsync everysec` có thể mất khoảng 1 giây). Cache thuần có thể tắt, chấp nhận cache lạnh khi khởi động lại.

##### Cache ở tầng HTTP
`Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=30`; ETag + `If-None-Match` trả 304 không kèm body; ASP.NET Core Output Caching (từ .NET 7) cache response ở server, có tag và chống stampede. Dữ liệu cá nhân hoá không cache ở CDN.

#### Cách show off
Câu chuyện thật mạnh nhất của bạn nằm ở đây: API bắt đầu thi chậm vì hàm làm mới cache dùng `SCAN` duyệt toàn bộ keyspace Redis hàng trăm vòng trong một request. Bạn tìm ra qua trace APM và đề xuất dùng một Redis SET làm chỉ mục key; đồng nghiệp commit bản sửa. Ngoài ra, bạn dùng một lớp Lua kiểm tra-rồi-ghi có sẵn trong hệ thống; nói "tôi hiểu và dùng lớp đó", không nói là tự viết.

> **Ví dụ:** "API bắt đầu thi có trace điển hình hơn 2 giây, và gần như toàn bộ thời gian nằm ở các span Redis. Lần vào code thì thấy hàm làm mới cache phải xoá mọi key của một nhóm, và nó tìm các key đó bằng `SCAN` trên toàn keyspace, mấy trăm vòng trong một request. `SCAN` không chặn Redis như `KEYS`, nhưng vấn đề là thuật toán tỉ lệ với kích thước cả keyspace lại nằm trên đường nóng. Tôi đề xuất giữ một Redis SET liệt kê các key của nhóm, khi cần thì đọc SET đó rồi xoá đúng từng key. Đồng nghiệp sửa theo hướng đó, và trace điển hình sau khi deploy còn dưới 0,1 giây. Bài học tôi rút ra là thiết kế cache phải tính luôn cách xoá, chứ không chỉ cách đọc."

Điểm ăn điểm:
- Giải thích vì sao `SCAN` vẫn chậm: số round-trip và độ phức tạp theo kích thước keyspace.
- Nói được ba cách xoá hàng loạt không cần quét: SET chỉ mục, version key, tag.
- Hot key xử lý bằng L1 trước, không nhảy ngay sang nhân bản key.
- Nói đúng vai trò và loại số liệu (trace điển hình, không phải p95).

#### Câu hỏi vặn
- **"SCAN không chặn như KEYS, sao vẫn chậm?"** Mỗi lệnh `SCAN` chỉ duyệt một phần nên không chặn lâu, nhưng vài trăm round-trip trong một request cộng lại thành hàng trăm mili-giây tới giây, và mỗi lệnh vẫn chiếm luồng chính của Redis. Gốc là thuật toán tỉ lệ với cả keyspace nằm trên đường nóng.
- **"Sao chắc nguyên nhân là SCAN?"** Trong trace APM, span Redis chiếm phần lớn thời gian của request; sau bản sửa, trace không còn chuỗi `SCAN` và thời gian giảm tương ứng. Nếu bị hỏi tiếp: đó là trace điển hình trước và sau, chưa phải p95.
- **"Thiết kế cache cho cấu hình sự kiện đọc 50.000 lần mỗi giây trên 20 instance thế nào?"** L1 trong process TTL vài giây tới vài chục giây trước L2 Redis, nên key nóng gần như không chạm Redis. Admin sửa thì xoá L2 và phát Pub/Sub để instance xoá L1. Warmup trước sự kiện, coalescing để mỗi instance chỉ nạp một lần.
- **"XFetch khác single-flight thế nào?"** Single-flight gộp request khi đã trượt, vẫn có một request phải chờ DB. XFetch làm mới sớm theo xác suất trước khi hết hạn, nên key nóng hầu như không bao giờ trượt. Thường dùng cùng nhau.
- **"Big key gây hại gì?"** Redis thực thi lệnh trên một luồng chính, thao tác với big key chặn mọi lệnh khác, tốn băng thông, lệch bộ nhớ giữa các node. Chia nhỏ, nén, xoá bằng `UNLINK`.
- **"Lớp Lua kiểm tra-rồi-ghi đó anh viết à?"** Không, lớp đó có sẵn trong hệ thống, tôi hiểu cách nó chạy và dùng nó. Script chỉ có vài lệnh O(1) trên một key nên chạy rất nhanh; script dài mới nguy hiểm vì Redis chạy script nguyên khối.

#### Bẫy cần tránh
- Xoá cache bằng `KEYS pattern` rồi `DEL` trên production.
- L1 TTL dài trên nhiều instance mà không có Pub/Sub: mỗi instance thấy một phiên bản khác nhau.
- Nói "giảm p95 từ 2 giây xuống 55 ms" khi số thật là trace điển hình.

#### Nhớ nhanh
- L1 + L2, L1 TTL ngắn hơn, xoá L1 qua Pub/Sub; `HybridCache` làm sẵn phần lớn.
- Stampede: coalescing, XFetch, stale-while-revalidate.
- Xoá hàng loạt không quét keyspace: SET chỉ mục, version key, tag.
- Redis: một luồng chính, Lua nguyên tử, hash tag trong cluster, eviction và persistence theo vai trò.

#### Bài tập
1. Viết pseudo-code XFetch cho hàm đọc key, biết cache lưu `value`, `delta` (thời gian nạp, giây) và `expiry`.
   **Đáp án:** `if (entry == null || now - entry.delta * beta * Math.Log(Random.Shared.NextDouble()) >= entry.expiry) { var start = now; value = Load(); delta = now - start; Set(key, value, delta, now + ttl); } return value;` (`Math.Log` của số trong khoảng (0,1) là số âm nên vế trái lớn hơn `now`).
2. Hai key `user:1:profile` và `user:1:stats` cần đọc trong một lệnh `MGET` trên Redis Cluster. Đặt lại tên key.
   **Đáp án:** `{user:1}:profile` và `{user:1}:stats`: phần trong ngoặc nhọn là hash tag, hai key cùng slot.
3. Thiết kế cách xoá mọi key cache của một kỳ thi mà không dùng `KEYS` hay `SCAN`.
   **Đáp án:** Khi ghi key, `SADD exam:{examId}:keys <key>`; khi xoá, `SMEMBERS` rồi `UNLINK` từng lô và xoá SET. Hoặc đưa version vào key (`exam:{examId}:v{n}:...`), tăng version bằng `INCR`, key cũ tự hết hạn.

### Bài 23.3. Bất đồng bộ và messaging

#### Kiến thức
Hàng đợi giải quyết một vấn đề rất cụ thể: tải đến không đều mà tầng phía sau chỉ chịu được một tốc độ ổn định. Cái giá là kết quả không còn có ngay và phải xử lý giao hàng trùng.

##### Load leveling
Cuối ca thi, hàng chục nghìn thí sinh nộp bài trong vài chục giây. Ghi thẳng vào DB thì DB phải chịu đỉnh gấp nhiều lần trung bình. Load leveling: API ghi bài nộp vào hàng đợi bền, trả "đã nhận" kèm mã theo dõi; consumer ghi DB với tốc độ DB chịu được. Đỉnh 50.000 lượt trong 30 giây, consumer ghi 5.000 lượt/giây thì hàng đợi xả hết trong khoảng 10 giây. Bài nộp phải được ghi bền vào hàng đợi trước khi trả "đã nhận"; client cần trạng thái "đang xử lý".

##### Kafka
- **Topic** chia thành **partition**; mỗi partition là log chỉ ghi nối tiếp. Thứ tự chỉ đảm bảo trong một partition.
- **Partition key** quyết định message vào partition nào. Cần thứ tự theo thí sinh thì dùng `UserId`; key lệch gây partition nóng.
- **Consumer group**: mỗi partition chỉ một consumer trong group đọc; số consumer hữu ích tối đa bằng số partition. Tăng partition làm đổi ánh xạ key, nên chọn dư từ đầu.
- **Consumer lag**: offset mới nhất trừ offset đã commit; metric chính để biết consumer có theo kịp và để autoscale.
- **Độ bền**: producer `acks=all` + `min.insync.replicas=2` với replication factor 3; producer idempotent tránh trùng khi retry gửi.
- **Ngữ nghĩa giao hàng**: commit offset sau khi xử lý xong là at-least-once. Exactly-once của Kafka chỉ đúng trong phạm vi Kafka; ghi ra DB ngoài vẫn cần idempotency.

##### RabbitMQ
Producer gửi vào exchange, exchange định tuyến vào queue theo binding (direct, topic, fanout). Consumer xử lý xong thì `ack`; chết trước khi ack thì message được giao lại. `prefetch` giới hạn số message chưa ack mỗi consumer giữ, là cơ chế backpressure chính. Queue durable + message persistent + publisher confirm để không mất message; thất bại nhiều lần thì sang dead letter exchange. Chọn nhanh: Kafka khi cần thông lượng rất cao, đọc lại được, nhiều nhóm consumer cùng đọc một luồng sự kiện; RabbitMQ khi cần định tuyến linh hoạt và hàng đợi công việc.

##### Giao hàng tin cậy
- **Outbox** ở phía gửi: sự kiện ghi cùng transaction với dữ liệu, relay đẩy lên broker sau.
- **Inbox / idempotency** ở phía nhận: ghi `MessageId` vào bảng có unique key trong cùng transaction với thao tác nghiệp vụ; trùng thì bỏ qua.

```sql
BEGIN TRAN;
  INSERT dbo.Inbox (MessageId, ProcessedAt) VALUES (@MessageId, SYSUTCDATETIME()); -- unique key
  INSERT dbo.Submission (...) VALUES (...);
COMMIT;
-- lỗi 2627 ở câu đầu nghĩa là đã xử lý: ack và bỏ qua
```

- **Retry có backoff + jitter**, giới hạn số lần; **DLQ** cho message vượt số lần retry hoặc lỗi dữ liệu, có cảnh báo và công cụ xử lý lại.

##### Saga
Saga thay distributed transaction bằng chuỗi transaction local, mỗi bước có hành động bù. Ví dụ đổi quà: trừ điểm → giữ quà → tạo đơn; tạo đơn lỗi thì trả quà, hoàn điểm. Orchestration có một bộ điều phối giữ trạng thái, dễ theo dõi; choreography để mỗi dịch vụ nghe và phát sự kiện, ít phụ thuộc nhưng khó nhìn toàn luồng. Saga không có cô lập: trạng thái trung gian nhìn thấy được, nên cần trạng thái "đang xử lý" và hành động bù idempotent.

##### Xếp hạng theo luồng sự kiện
Thay job tính lại toàn bộ bảng xếp hạng mỗi vài phút bằng cập nhật tăng dần: mỗi sự kiện điểm cập nhật Redis sorted set (`ZINCRBY`, đọc top bằng `ZREVRANGE`, hạng bằng `ZREVRANK`). Score của sorted set là số `double`, chính xác tới khoảng 2^53. Đừng nhồi "điểm × hệ số lớn + thời gian" vào một score mà không tính số bit: vượt 2^53 thì hai người khác nhau có thể bị làm tròn về cùng score. Tie-break an toàn hơn là giữ score chỉ là điểm và phân định khi đọc top N (đọc thêm thời gian từ hash hoặc DB), hoặc ghép có tính toán sao cho tổng vẫn nằm gọn trong 53 bit. Vẫn cần job đối soát định kỳ với DB.

#### Cách show off
Bạn có trải nghiệm thật với cả hai broker: hệ thống thi có hơn 20 service .NET gọi nhau qua HTTP/gRPC và Kafka; bạn code toàn bộ luồng bảng xếp hạng của một trò chơi, sự kiện điểm đi qua Kafka (partition theo trận để giữ thứ tự) vào Redis sorted set. Ở AvePoint, bạn tham gia chuyển hệ thống sang .NET với CQRS và RabbitMQ. Outbox và saga chưa dùng thật; nếu được hỏi, nói thẳng.

> **Ví dụ:** "Ở bảng xếp hạng của một trò chơi trong hệ thống thi, tôi làm cả luồng: service game phát sự kiện điểm lên Kafka, partition theo mã trận để các sự kiện của một trận đi đúng thứ tự, consumer cập nhật Redis sorted set, API đọc top và hạng của từng người trực tiếp từ đó. Consumer xử lý at-least-once nên tôi cần chống trùng theo mã sự kiện, và khi Redis mất dữ liệu thì dựng lại từ DB hoặc đọc lại Kafka từ offset cũ. Một chi tiết hay bị bỏ qua là tie-break: score của sorted set là số thực, nhồi cả điểm lẫn thời gian vào đó dễ mất chính xác. Outbox và saga thì ở dự án tôi chưa dùng; nếu làm tích hợp kiểu đổi quà nhiều bước, tôi sẽ dùng outbox ở phía gửi, inbox ở phía nhận, và saga có hành động bù cho từng bước."

Điểm ăn điểm:
- Thứ tự chỉ trong một partition; chọn partition key theo đơn vị cần thứ tự.
- At-least-once là mặc định thực tế, nên phía nhận phải idempotent.
- Tăng consumer không giúp khi nút thắt là DB.
- Chi tiết tie-break và giới hạn chính xác của score.

#### Câu hỏi vặn
- **"Cuối ca thi 50.000 thí sinh nộp bài trong 30 giây, anh thiết kế thế nào để DB không sập?"** API ghi bài nộp vào hàng đợi bền rồi trả "đã nhận" kèm mã theo dõi; consumer ghi DB theo lô với tốc độ cố định; idempotency key để nộp lại không trùng. Theo dõi consumer lag, scale consumer trong giới hạn DB chịu được, client hiển thị "đang xử lý".
- **"Kafka đảm bảo thứ tự thế nào?"** Chỉ trong một partition. Message cùng key vào cùng partition nên giữ thứ tự theo key; giữa các partition không có thứ tự. Retry ở producer có thể đảo thứ tự nếu không bật idempotent producer.
- **"Vì sao consumer phải idempotent dù Kafka có exactly-once?"** Exactly-once của Kafka chỉ trong phạm vi đọc-ghi giữa các topic. Ghi ra DB ngoài, consumer có thể xử lý xong nhưng chết trước khi commit offset, lần sau xử lý lại. Inbox với unique key trên `MessageId` chặn trùng.
- **"Saga khác distributed transaction thế nào?"** 2PC khoá tài nguyên ở mọi bên tới khi commit chung; một bên chậm thì tất cả chờ. Saga là chuỗi transaction local, lỗi thì chạy hành động bù; không giữ khoá xuyên dịch vụ nhưng không có cô lập.
- **"Consumer lag tăng liên tục, anh làm gì?"** Xem consumer chậm vì đâu: DB, API ngoài, hay message lỗi retry mãi. Tăng consumer nếu còn partition rảnh, xử lý theo lô, đẩy message lỗi sang DLQ. Nếu nút thắt là DB thì tăng consumer chỉ dồn thêm tải.
- **"Hai người cùng điểm thì bảng xếp hạng xếp thế nào?"** Theo quy tắc nghiệp vụ, thường ai đạt trước xếp trên. Tôi không nhồi điểm và thời gian vào một score double vượt 53 bit; giữ score là điểm và phân định khi đọc top, hoặc ghép có tính số bit. Nếu bị hỏi tiếp: Redis với score bằng nhau sắp theo thứ tự từ điển của member, nên cũng có thể mã hoá thời gian vào tên member, nhưng phải tính chiều sắp xếp khi đọc ngược.
- **"Anh dùng outbox ở dự án chưa?"** Chưa. Có chỗ hệ thống có bảng outbox nhưng dòng outbox không được ghi chung transaction với dữ liệu nghiệp vụ, nên chưa có đúng đảm bảo của outbox. Nếu làm, tôi đưa việc ghi outbox vào cùng transaction và thêm inbox ở phía nhận.

#### Bẫy cần tránh
- Trả "đã nhận" trước khi message được ghi bền: broker chết là mất bài.
- Retry vô hạn một message lỗi dữ liệu: chặn cả partition. Sau N lần chuyển sang DLQ.
- Nhận outbox, saga là đã triển khai khi chỉ là thiết kế.

#### Nhớ nhanh
- Hàng đợi bền san tải đỉnh; trả "đã nhận" sau khi ghi bền.
- Kafka: thứ tự trong partition, song song tối đa bằng số partition, theo dõi consumer lag.
- RabbitMQ: ack, prefetch làm backpressure, dead letter exchange.
- At-least-once: outbox phía gửi, inbox/idempotency phía nhận, DLQ cho message lỗi; saga thay 2PC.

#### Bài tập
1. Hàng đợi nộp bài nhận 60.000 message trong 20 giây, consumer xử lý 4.000 message/giây. Tính độ dài hàng đợi lớn nhất và thời gian xả hết.
   **Đáp án:** Tốc độ vào 3.000/giây, nhỏ hơn 4.000/giây nên hàng đợi gần như không tích luỹ. Nếu vào 10.000/giây trong 6 giây (cùng 60.000): tích 6 × 6.000 = 36.000, xả thêm 9 giây.

### Bài 23.4. Scale và chịu lỗi

#### Kiến thức
Ở quy mô lớn, câu hỏi không phải "làm sao không bao giờ lỗi" mà là "khi một phần lỗi hoặc quá tải, phần còn lại có đứng vững không".

##### Stateless, autoscale, load balancing
Service stateless không giữ trạng thái người dùng trong process (session, tiến độ bài làm nằm ở Redis/DB), nên instance nào cũng phục vụ được mọi request. HPA scale theo CPU, bộ nhớ hoặc metric tuỳ chỉnh; KEDA scale theo nguồn sự kiện (consumer lag, độ dài queue, lịch cron). Với kỳ thi biết trước giờ, scale theo lịch trước ca tốt hơn chờ CPU tăng, vì scale phản ứng chậm vài phút. Load balancing: round-robin đơn giản; least-connection gửi tới instance ít kết nối nhất; power of two choices chọn ngẫu nhiên hai instance rồi gửi tới cái nhẹ hơn, gần tốt như least-connection mà không cần trạng thái toàn cục.

##### Bảo vệ hệ thống
- **Rate limiting** theo khách (IP, user, API key). Token bucket cho phép burst tới dung lượng bucket rồi giới hạn theo tốc độ nạp; fixed window cho phép gấp đôi ở ranh giới hai khung. Rate limit trong process chỉ đúng cho một instance; giới hạn toàn cục cần Redis hoặc gateway.
- **Load shedding**: quá tải thì chủ động từ chối sớm (503, `Retry-After`) một phần request, thay vì để mọi request chậm rồi timeout.
- **Admission control**: chỉ cho N người vào phiên làm bài đồng thời, người tới sau vào phòng chờ có thứ tự.
- **Bulkhead**: giới hạn đồng thời theo từng phụ thuộc (`ConcurrencyLimiter`, `SemaphoreSlim`), để một phụ thuộc chậm không chiếm hết tài nguyên.

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests; // mặc định là 503
    o.AddPolicy("submit", ctx => RateLimitPartition.GetTokenBucketLimiter(
        ctx.User.Identity?.Name ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = 5, TokensPerPeriod = 1, ReplenishmentPeriod = TimeSpan.FromSeconds(2),
            QueueLimit = 0, AutoReplenishment = true
        }));
});
app.UseRateLimiter();
app.MapPost("/exam/submit", SubmitAsync).RequireRateLimiting("submit");
```

> **Ghi nhớ:** Middleware rate limiting của ASP.NET Core mặc định trả 503 khi từ chối. Muốn client hiểu là "bạn gửi quá nhanh" thì phải đặt `RejectionStatusCode = 429`; 503 nên dành cho load shedding khi chính server quá tải.

##### Gọi giữa service
- **Timeout có ngân sách**: request vào có tổng ngân sách; mỗi chặng con nhận phần còn lại (gRPC có deadline sẵn). Timeout chặng con không dài hơn chặng cha.
- **Retry**: chỉ cho lỗi tạm thời và thao tác idempotent; exponential backoff + jitter; giới hạn số lần và có retry budget. Retry ở nhiều tầng nhân lên: ba tầng, mỗi tầng 1 lần gốc + 3 lần retry, là tới 64 lần gọi xuống tầng cuối.
- **Circuit breaker**: lỗi vượt ngưỡng thì mở mạch, trả lỗi ngay một thời gian, sau đó cho vài request thử.
- **Hedged request**: gửi bản thứ hai tới instance khác nếu bản đầu chưa trả lời sau ngưỡng như p95; giảm tail latency, đổi lại tăng tải, chỉ cho thao tác đọc idempotent.

.NET 8 có `Microsoft.Extensions.Http.Resilience` (dựa trên Polly v8): `AddStandardResilienceHandler()` gắn sẵn rate limiter, timeout tổng, retry, circuit breaker, timeout mỗi lần thử.

```csharp
builder.Services.AddHttpClient<ScoreClient>(c => c.BaseAddress = new Uri("https://score.internal"))
    .AddStandardResilienceHandler(o =>
    {
        o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(3);
        o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(1);
        o.Retry.MaxRetryAttempts = 2;
    });
```

##### Suy giảm có kiểm soát và warmup
Khi phụ thuộc phụ hỏng, tắt tính năng phụ (xếp hạng thời gian thực, gợi ý), giữ luồng chính (vào thi, lấy đề, nộp bài); feature flag và kill switch cho phép tắt nhanh mà không deploy. Instance mới khởi động có cache trống, pool trống, JIT chưa chạy: readiness probe chỉ báo sẵn sàng sau warmup. Nhiều instance cùng khởi động cùng nạp cache, cùng kết nối DB (thundering herd): giãn thời điểm bằng rolling deploy, jitter, và L2 cache dùng chung. Cell-based architecture chia hệ thống thành nhiều cell độc lập phục vụ từng nhóm người dùng, giới hạn phạm vi sự cố.

#### Cách show off
Phần thật: ứng dụng chạy nhiều pod sau load balancer trên Kubernetes, dùng Redis Cluster. Rate limiting, circuit breaker, load shedding ở dự án bạn chưa triển khai; đây là bài để nói theo hướng thiết kế, có lập luận cho đúng bài toán kỳ thi.

> **Ví dụ:** "Ở dự án, ứng dụng đã chạy nhiều pod sau load balancer trên Kubernetes, nhưng lớp bảo vệ quá tải như rate limit hay circuit breaker tôi chưa triển khai. Nếu thiết kế cho giờ mở ca thi, tôi sẽ scale theo lịch trước giờ mở ca thay vì chờ CPU tăng, vì tải dồn trong vài chục giây còn pod mới cần vài phút. Tôi đặt admission control để người đã vào thi có trải nghiệm ổn định, người đến sau vào phòng chờ có thứ tự. Nộp bài có rate limit theo thí sinh, trả 429 chứ không để mặc định 503, và có idempotency key để retry không sinh bài trùng. Khi quá tải, tắt trước những thứ không thiết yếu như xếp hạng thời gian thực, giữ nguyên luồng làm bài và nộp bài."

Điểm ăn điểm:
- Phân biệt rate limiting (công bằng theo khách) với load shedding (theo tình trạng hệ thống).
- Tính được hiệu ứng nhân của retry nhiều tầng.
- Biết mặc định 503 của rate limiter ASP.NET Core và vì sao đổi sang 429.
- Scale theo lịch cho tải biết trước.

#### Câu hỏi vặn
- **"Token bucket khác fixed window thế nào?"** Fixed window đếm theo khung cố định, cho phép gấp đôi giới hạn ở ranh giới hai khung. Token bucket cho burst tới dung lượng bucket rồi giới hạn theo tốc độ nạp, mượt hơn. Sliding window ở giữa.
- **"Retry có thể làm sự cố tệ hơn thế nào?"** Retry nhân tải lên dịch vụ đang quá tải, nhất là khi nhiều tầng cùng retry. Chỉ retry lỗi tạm thời và thao tác idempotent, có backoff + jitter, retry budget, và circuit breaker để dừng khi dịch vụ đang hỏng; tốt nhất chỉ retry ở một tầng.
- **"Load shedding và rate limiting khác nhau ở đâu?"** Rate limiting giới hạn theo từng khách để công bằng và chống lạm dụng, áp dụng cả khi hệ thống rảnh. Load shedding dựa trên tình trạng hệ thống: quá tải thì từ chối bớt, ưu tiên giữ loại request quan trọng.
- **"Sao đặt RejectionStatusCode là 429?"** Middleware mặc định trả 503, client và gateway sẽ hiểu là server hỏng và có thể retry ngay hoặc đánh dấu instance lỗi. 429 nói rõ client gửi quá nhanh, kèm `Retry-After` để client chờ đúng.
- **"Kỳ thi bắt đầu lúc 8:00, anh chuẩn bị scale thế nào?"** Scale theo lịch trước giờ mở ca, warmup cache đề và kết nối, readiness probe sau warmup; admission control cho phòng chờ; rate limit cho nộp bài; tắt tính năng phụ khi quá tải; theo dõi p99 và tỉ lệ lỗi theo thời gian thực.
- **"Phần này anh làm thật chưa?"** Hạ tầng nhiều pod và Redis Cluster là có thật. Rate limit, circuit breaker, load shedding tôi chưa triển khai ở dự án; tôi trình bày thiết kế tôi sẽ làm và các chỉ số để kiểm chứng bằng load test.

#### Bẫy cần tránh
- Timeout chặng con dài hơn chặng cha: chặng cha đã bỏ cuộc nhưng chặng con vẫn làm.
- Retry thao tác không idempotent (nộp bài không có idempotency key).
- Autoscale theo CPU cho tải dồn trong vài giây: pod mới lên khi đỉnh đã qua.

#### Nhớ nhanh
- Service stateless để scale ngang; tải biết trước thì scale theo lịch.
- Rate limiting theo khách (429), load shedding theo tình trạng hệ thống (503), admission control cho phiên.
- Timeout có ngân sách, retry có backoff + jitter + budget, circuit breaker, bulkhead, hedging.
- Warmup trước khi nhận tải; giãn khởi động để tránh thundering herd.

#### Bài tập
1. Request đi qua gateway → API → dịch vụ điểm → DB, mỗi tầng retry 3 lần. Khi DB lỗi, một request người dùng tạo tối đa bao nhiêu lần gọi tới DB? Đề xuất sửa.
   **Đáp án:** Mỗi tầng gọi tối đa 4 lần (1 + 3 retry): 4 × 4 × 4 = 64 lần. Chỉ retry ở một tầng gần lỗi nhất, có retry budget và circuit breaker.
2. Liệt kê ba tính năng có thể tắt khi quá tải trong giờ thi và ba tính năng phải giữ.
   **Đáp án:** Tắt: bảng xếp hạng thời gian thực, lịch sử luyện tập, gợi ý bài. Giữ: vào phòng thi, lấy đề, lưu đáp án và nộp bài.

### Bài 23.5. Runtime .NET

#### Kiến thức
Có những lúc DB và mạng đều ổn mà API vẫn chậm. Khi đó nút thắt nằm trong chính process .NET: thread pool, GC, cấp phát bộ nhớ.

##### Thread pool starvation
ASP.NET Core xử lý request trên thread của thread pool. Code async đúng cách trả thread về pool khi chờ I/O. Sync-over-async (`.Result`, `.Wait()`, `GetAwaiter().GetResult()` trên Task chưa xong) giữ thread đứng chờ, trong khi phần tiếp theo của chính Task đó lại cần một thread khác từ pool. Khi tải cao, mọi thread đều bị chặn chờ những việc đang xếp hàng sau chúng.

Thread pool có số thread tối thiểu bằng số CPU; vượt mức đó nó chỉ thêm thread từ từ (vài thread mỗi giây khi bị đói). Triệu chứng: latency tăng vọt theo bậc, CPU thấp, hàng đợi thread pool dài, số thread tăng dần đều.

```bash
dotnet-counters monitor -p <pid> --counters System.Runtime
# xem queue length, thread count, completed work items của thread pool
# (tên counter khác nhau giữa các phiên bản; .NET 9+ có dạng dotnet.thread_pool.queue.length)
```

Sửa gốc: async xuyên suốt từ controller tới driver DB. `ThreadPool.SetMinThreads` chỉ là băng tạm, che triệu chứng. Các nguồn chặn khác: `lock` quanh I/O, `Thread.Sleep`, thư viện chỉ có API đồng bộ.

##### GC và cấp phát
.NET GC chia heap theo thế hệ: Gen0 (đối tượng mới, thu gom rẻ), Gen1 (đệm), Gen2 (sống lâu, thu gom đắt), dựa trên giả thuyết phần lớn đối tượng chết trẻ. Đối tượng từ 85.000 byte vào Large Object Heap, chỉ thu gom cùng Gen2 và mặc định không bị nén, dễ phân mảnh.
- **Server GC** (mặc định cho ASP.NET Core): mỗi core một heap và một luồng GC, thông lượng cao hơn. Từ .NET 9, DATAS bật mặc định: số heap điều chỉnh theo tải, giảm bộ nhớ khi tải thấp.
- **Workstation GC**: một heap, hợp ứng dụng client.

Cấp phát nhiều thì GC chạy nhiều, CPU và thời gian dừng tăng, p99 xấu. Cách giảm:

```csharp
ReadOnlySpan<char> line = "1001;A;45";            // Span: cắt chuỗi không cấp phát
int questionId = int.Parse(line[..line.IndexOf(';')]);

byte[] buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);   // mượn buffer thay vì new
try { /* độ dài thật có thể lớn hơn yêu cầu */ }
finally { ArrayPool<byte>.Shared.Return(buffer); }
```

`Span<T>` là `ref struct`, chỉ sống trên stack, không dùng qua `await`; code async dùng `Memory<T>`. `ObjectPool<T>` cho đối tượng đắt khởi tạo. System.Text.Json source generator sinh code serialize lúc build, nhanh hơn, ít cấp phát, và bắt buộc cho Native AOT.

##### Đo trước khi tối ưu
- `dotnet-counters`: số liệu thời gian thực (CPU, GC, thread pool, exception/s).
- `dotnet-trace`: CPU sampling, sự kiện GC; mở bằng PerfView, Visual Studio hoặc speedscope.
- `dotnet-dump`/`dotnet-gcdump`: xem heap, tìm rò rỉ, xem stack mọi thread khi treo.
- BenchmarkDotNet với `[MemoryDiagnoser]` cho micro-benchmark có warmup và thống kê.

##### Khởi động nhanh
ReadyToRun biên dịch trước một phần, giảm JIT lúc khởi động. Native AOT biên dịch toàn bộ thành mã máy: khởi động nhanh, bộ nhớ thấp; ASP.NET Core hỗ trợ từ .NET 8 cho minimal API và gRPC, không hỗ trợ MVC, thư viện dùng reflection động có thể không chạy. Hợp cho function, sidecar, service cần scale-out nhanh.

#### Cách show off
Việc thật bạn có ở mảng runtime là nâng cấp hàng chục project của nhiều service lên .NET 10. Đừng biến nó thành câu chuyện hiệu năng nếu không đo; kể nó như một việc giảm rủi ro và mở đường cho các tính năng runtime mới. Phần starvation, GC: nói theo cách bạn sẽ chẩn đoán.

> **Ví dụ:** "Tôi phụ trách đưa các service phía backend lên .NET 10, khoảng vài chục project. Phần khó không nằm ở đổi target framework, mà ở các thư viện dùng chung đã được tổ chức lại, nên phải sửa namespace, đăng ký DI và cấu hình cho từng service rồi chạy thật để kiểm. Tôi không nói là nâng cấp làm hệ thống nhanh hơn bao nhiêu, vì tôi không có số đo trước sau theo cùng tải. Về chẩn đoán runtime, nếu gặp API chậm dần khi tải tăng mà CPU thấp, tôi nghi thread pool bị đói do code chặn đồng bộ trên Task; tôi xem `dotnet-counters` để thấy hàng đợi thread pool dài và số thread tăng đều, rồi lấy dump xem các thread đang kẹt ở đâu. Cách sửa là async xuyên suốt, không phải tăng số thread tối thiểu."

Điểm ăn điểm:
- Triệu chứng đặc trưng của starvation: CPU thấp, latency tăng theo bậc, thread tăng đều.
- Biết `SetMinThreads` chỉ che triệu chứng.
- Đo bằng profiler trước khi tối ưu cấp phát; chỉ tối ưu đoạn nóng.
- Không gắn số hiệu năng cho việc nâng cấp khi không có số đo.

#### Câu hỏi vặn
- **"API chậm dần khi tải tăng nhưng CPU chỉ 20%, anh nghi gì?"** Nghi thread pool starvation do sync-over-async. Kiểm tra `dotnet-counters` (queue length cao, thread count tăng dần), lấy `dotnet-dump` xem nhiều thread chặn ở `.Result`/`.Wait()`. Sửa bằng async xuyên suốt.
- **"Server GC khác Workstation GC thế nào?"** Server GC có một heap và một luồng GC mỗi core, thông lượng cao hơn, tốn bộ nhớ hơn, mặc định cho ASP.NET Core; từ .NET 9 có DATAS điều chỉnh số heap theo tải. Workstation GC một heap, hợp ứng dụng client.
- **"Large Object Heap là gì, sao cần tránh cấp phát lớn liên tục?"** Đối tượng từ 85.000 byte vào LOH, chỉ thu gom cùng Gen2 và mặc định không nén, dễ phân mảnh và kéo theo GC Gen2 đắt. Dùng `ArrayPool`, chia nhỏ, stream thay vì đọc cả khối.
- **"Span<T> giúp gì và có giới hạn gì?"** Làm việc trên một đoạn mảng, chuỗi hay bộ nhớ stack mà không cấp phát. Là `ref struct` nên không làm field của class, không dùng qua `await`; trong async thì dùng `Memory<T>`.
- **"Khi nào chọn Native AOT?"** Khi khởi động nhanh và bộ nhớ thấp quan trọng: function, service scale-out theo đỉnh, sidecar. Đổi lại không có MVC, hạn chế reflection động, thư viện phải tương thích trimming; thông lượng chạy lâu dài không chắc tốt hơn JIT.
- **"Nâng lên .NET 10 thì nhanh hơn bao nhiêu?"** Tôi không có số đo trước sau cùng tải nên không đưa con số. Lý do nâng là hỗ trợ dài hạn, bản vá bảo mật và các cải tiến runtime; nếu cần chứng minh hiệu năng, tôi sẽ chạy cùng một kịch bản load test trên hai phiên bản.
- **"Có nên tăng ThreadPool.SetMinThreads cho nhanh?"** Chỉ như biện pháp tạm khi đang sự cố. Nó che triệu chứng, mỗi thread tốn bộ nhớ stack, và lỗi gốc (code chặn đồng bộ) vẫn còn đó.

#### Bẫy cần tránh
- Tối ưu cấp phát ở đoạn code không nóng: phức tạp hơn mà không đổi được gì.
- Quên trả buffer về `ArrayPool` hoặc dùng buffer sau khi đã trả.
- Nhận nâng cấp phiên bản là "tối ưu hiệu năng" khi không có số đo.

#### Nhớ nhanh
- Sync-over-async gây thread pool starvation; sửa bằng async xuyên suốt.
- GC thế hệ; LOH từ 85.000 byte; Server GC mặc định cho web, DATAS từ .NET 9.
- Giảm cấp phát: `Span<T>`, `ArrayPool<T>`, object pool, JSON source generator.
- Đo bằng `dotnet-counters`, `dotnet-trace`, `dotnet-dump`, BenchmarkDotNet trước khi tối ưu.

#### Bài tập
1. Tìm lỗi và sửa: `public IActionResult Get(int id) { var r = _service.GetAsync(id).Result; return Ok(r); }`.
   **Đáp án:** Sync-over-async chặn thread pool. Sửa: `public async Task<IActionResult> Get(int id, CancellationToken ct) { var r = await _service.GetAsync(id, ct); return Ok(r); }`.
2. Liệt kê ba counter cần xem khi nghi vấn đề GC.
   **Đáp án:** `% Time in GC`, allocation rate, số lần GC Gen 0/1/2 (thêm kích thước heap, LOH).

### Bài 23.6. Mạng và API

#### Kiến thức
Mỗi lời gọi qua mạng có một chi phí cố định không phụ thuộc vào code của bạn. Thiết kế API tốt là giảm số lần phải trả chi phí đó và giảm lượng dữ liệu phải chở.

##### Chi phí kết nối
Một request HTTPS trên kết nối mới tốn TCP handshake (1 RTT), TLS 1.3 (1 RTT; TLS 1.2 là 2 RTT), rồi mới tới request. RTT 30 ms thì kết nối mới tốn thêm khoảng 60 ms trước byte dữ liệu đầu tiên, chưa kể CPU mã hoá. Keep-alive giữ kết nối để dùng lại (timeout ở client ngắn hơn ở server); TLS session resumption bỏ phần đắt của handshake; 0-RTT của TLS 1.3 có thể bị phát lại nên chỉ cho request idempotent. HTTP/2 multiplex nhiều request trên một kết nối; HTTP/3 chạy trên QUIC, tránh head-of-line blocking ở tầng TCP.

##### Payload
Chỉ trả trường cần, DTO theo từng màn hình; nén Brotli/Gzip cho JSON lớn; Protobuf cho giao tiếp nội bộ; ảnh và file trả URL tới CDN, không nhúng base64 vào JSON.

##### Phân trang bắt buộc
Mọi API trả danh sách phải có giới hạn, và server đặt `pageSize` tối đa.
- **Offset** (`OFFSET 10000 ROWS FETCH NEXT 20`): nhảy trang được, nhưng DB phải đọc rồi bỏ qua 10.000 dòng; trang càng sâu càng chậm, dữ liệu đổi giữa hai lần gọi gây trùng hoặc sót.
- **Keyset**: nhớ khoá của dòng cuối trang trước, lấy các dòng sau nó bằng index seek, trang nào cũng nhanh như nhau.

T-SQL không hỗ trợ so sánh bộ giá trị kiểu `(a, b) < (@x, @y)`, nên phải viết điều kiện tách ra. Cột sắp xếp không duy nhất thì luôn thêm khoá phụ để tie-break:

```sql
SELECT TOP (20) SubmissionId, UserId, Score, SubmittedAt
FROM dbo.Submission
WHERE ExamId = @ExamId
  AND (SubmittedAt < @LastSubmittedAt
       OR (SubmittedAt = @LastSubmittedAt AND SubmissionId < @LastId))
ORDER BY SubmittedAt DESC, SubmissionId DESC;
-- index (ExamId, SubmittedAt DESC, SubmissionId DESC) INCLUDE (UserId, Score)
```

##### N+1 và DataLoader
Resolver của trường con chạy một lần cho mỗi phần tử cha: 100 bài thi, mỗi bài resolve "môn học" bằng một truy vấn, thành 1 + 100 truy vấn. DataLoader gom các khoá trong một lượt thực thi thành một truy vấn `WHERE SubjectId IN (...)` và cache trong request; HotChocolate có sẵn. N+1 không riêng GraphQL: ORM lazy loading hay vòng lặp gọi API trong REST cũng vậy.

##### Ngân sách latency và khoảng cách
Ánh sáng trong cáp quang đi khoảng 200.000 km/s, mỗi 100 km thêm khoảng 1 ms RTT. Hà Nội – TP.HCM RTT thực tế thường vài chục ms; trang cần 10 request tuần tự giữa hai đầu thì riêng mạng đã vài trăm ms. Lập ngân sách latency: chia mục tiêu p99 của API cho từng chặng (gateway, service, cache, DB, dịch vụ ngoài), mỗi chặng có timeout tương ứng, tracing cho biết chặng nào vượt.

#### Cách show off
Phát hiện thật trong đợt rà soát: service tạo `GrpcChannel` mới cho mỗi request, và trace có lỗi kết nối socket. Bạn cũng làm phần hardening cho BFF của hệ thống đăng nhập. Phần phân trang keyset và DataLoader là kiến thức, nói theo hướng thiết kế; chi tiết "T-SQL không có so sánh bộ giá trị" là điểm cộng vì nhiều người viết sai.

> **Ví dụ:** "Trong trace của hệ thống thi, tôi thấy lỗi kết nối socket xuất hiện cùng lúc với một service tạo kênh gRPC mới cho mỗi request. Mỗi kênh mới là một lần bắt tay TCP và TLS, vừa tốn thời gian vừa tốn CPU cả hai phía, và socket đóng tích tụ có thể làm cạn cổng. Tôi đề xuất đăng ký client gRPC qua factory để dùng lại kênh. Ở tầng API, nguyên tắc tôi giữ là danh sách nào cũng có phân trang với giới hạn phía server; danh sách lớn thì dùng keyset thay cho offset. Khi viết keyset trên SQL Server phải tách điều kiện thành 'nhỏ hơn, hoặc bằng nhau và khoá phụ nhỏ hơn', vì T-SQL không so sánh được cả bộ giá trị như PostgreSQL."

Điểm ăn điểm:
- Tính được chi phí kết nối mới theo RTT.
- Keyset đúng cú pháp T-SQL và có tie-break bằng khoá duy nhất.
- Nhìn N+1 như một vấn đề chung, không chỉ của GraphQL.
- Nói latency theo ngân sách từng chặng.

#### Câu hỏi vặn
- **"Vì sao trang 5.000 chậm hơn trang 1, anh sửa thế nào?"** Offset buộc DB đọc rồi bỏ qua mọi dòng trước trang đó. Chuyển sang keyset: nhớ giá trị sắp xếp và Id của dòng cuối, lọc `WHERE SortCol < @lastSort OR (SortCol = @lastSort AND Id < @lastId)` với index đúng thứ tự, mọi trang đều là index seek. Nếu cần nhảy trang tuỳ ý thì giới hạn độ sâu.
- **"Sao không viết WHERE (SortCol, Id) < (@a, @b) cho gọn?"** Cú pháp so sánh bộ giá trị có ở PostgreSQL nhưng T-SQL không hỗ trợ. Trên SQL Server phải tách thành điều kiện OR như trên, và kiểm tra plan vẫn ra index seek.
- **"GraphQL N+1 là gì, DataLoader giải quyết thế nào?"** Resolver con chạy một truy vấn cho mỗi phần tử cha, 100 phần tử thành 101 truy vấn. DataLoader gom khoá trong một lượt thực thi thành một truy vấn theo lô và cache trong request.
- **"Một kết nối HTTPS mới tốn bao lâu trước khi gửi dữ liệu?"** TCP 1 RTT cộng TLS 1.3 1 RTT (TLS 1.2 là 2 RTT), rồi mới tới request. RTT 30 ms thì thêm khoảng 60 ms, cộng CPU mã hoá. Keep-alive và session resumption tránh chi phí này.
- **"Anh lập ngân sách latency cho API p99 300 ms thế nào?"** Chia cho từng chặng theo số đo thực tế, ví dụ gateway 20 ms, service 50 ms, cache 10 ms, DB 150 ms, dư 70 ms; timeout từng chặng theo ngân sách; tracing để thấy chặng nào vượt.
- **"Màn hình gọi 8 API tuần tự, anh cải thiện thế nào?"** Gọi song song các API độc lập, gộp thành một API cho màn hình (BFF) trả đủ dữ liệu, hoặc cache phía client. Mỗi lời gọi tuần tự là ít nhất một RTT.
- **"Bật 0-RTT cho mọi request có sao không?"** Dữ liệu 0-RTT có thể bị kẻ tấn công phát lại, nên chỉ dùng cho request idempotent như đọc. Nộp bài, trừ lượt thì không.

#### Bẫy cần tránh
- Keyset với cột sắp xếp không duy nhất mà không có khoá phụ: sót hoặc trùng dòng.
- Viết keyset bằng cú pháp so sánh bộ giá trị trên SQL Server.
- Đo latency từ máy cùng data center rồi kết luận cho người dùng ở xa.

#### Nhớ nhanh
- Kết nối mới tốn 2–3 RTT và CPU TLS; keep-alive, resumption, HTTP/2 để dùng lại.
- Payload nhỏ: DTO theo màn hình, nén, nhị phân cho nội bộ.
- Phân trang bắt buộc; keyset cho danh sách lớn, T-SQL tách điều kiện OR và có tie-break.
- N+1 xử lý bằng gom lô; latency lập ngân sách theo chặng.

#### Bài tập
1. Viết truy vấn keyset lấy 20 bài nộp tiếp theo theo `Score DESC, SubmissionId DESC`, biết điểm và Id của dòng cuối trang trước.
   **Đáp án:** `SELECT TOP (20) ... WHERE ExamId = @ExamId AND (Score < @LastScore OR (Score = @LastScore AND SubmissionId < @LastId)) ORDER BY Score DESC, SubmissionId DESC`, index `(ExamId, Score DESC, SubmissionId DESC)`.
2. Màn hình gọi 8 API tuần tự, RTT 40 ms, mỗi API xử lý 20 ms, dùng lại kết nối. Tính thời gian tối thiểu.
   **Đáp án:** 8 × (40 + 20) = 480 ms. Gọi song song các API độc lập hoặc gộp thành một API cho màn hình.

### Bài 23.7. Performance engineering

#### Kiến thức
"Đủ nhanh" phải được định nghĩa bằng số trước khi tối ưu, nếu không sẽ không biết khi nào dừng. Bài này là bộ công cụ để định nghĩa, đo và dự báo.

##### RED, USE, SLO
- **RED** cho service: Rate, Errors, Duration (phân bố thời gian xử lý).
- **USE** cho tài nguyên: Utilization, Saturation (mức xếp hàng), Errors.
- **SLI** là chỉ số đo được (% request nộp bài thành công dưới 500 ms), **SLO** là mục tiêu cho nó (99,9% trong 30 ngày), **error budget** là phần được phép hỏng (0,1% của 30 ngày khoảng 43 phút). Hết budget thì ưu tiên ổn định hơn tính năng mới.
- Cảnh báo theo **burn rate**, tốc độ tiêu budget: burn rate 14,4 trong 1 giờ nghĩa là tiêu khoảng 2% budget 30 ngày trong 1 giờ. Dùng nhiều cửa sổ (nhanh và chậm) để giảm báo động giả.

SLO latency viết dạng tỉ lệ request tốt dễ tính từ histogram, và cộng gộp được giữa các pod:

```promql
# Tỉ lệ request /exam/submit chậm hơn 500 ms trong 5 phút
1 - (
  sum(rate(http_server_request_duration_seconds_bucket{route="/exam/submit",le="0.5"}[5m]))
  /
  sum(rate(http_server_request_duration_seconds_count{route="/exam/submit"}[5m]))
)
```

> **Cảnh báo:** Ngưỡng `le` phải trùng một biên bucket có thật. Histogram `http.server.request.duration` của ASP.NET Core (.NET 8+) dùng bộ biên mặc định 0,005; 0,01; 0,025; 0,05; 0,075; 0,1; 0,25; 0,5; 0,75; 1; 2,5; 5; 7,5; 10 giây. Muốn SLO ở 300 ms thì phải tự cấu hình thêm biên 0,3, nếu không truy vấn với `le="0.3"` không trả về gì.

##### Percentile, không phải trung bình
99 request 10 ms và 1 request 5 giây có trung bình khoảng 60 ms, nhưng 1% người dùng chờ 5 giây. Trang gọi 20 API thì xác suất ít nhất một lời gọi rơi vào 1% chậm nhất là 1 − 0,99^20, khoảng 18%: p99 của từng API thành trải nghiệm thường gặp của trang. Không lấy trung bình các percentile; gộp histogram rồi mới tính. Công cụ load test dạng closed model hay mắc coordinated omission (chờ request chậm xong mới gửi tiếp, nên đếm thiếu request chậm); dùng tải theo tốc độ đến cố định như `constant-arrival-rate` của k6.

##### Load test
- **Load**: tải kỳ vọng, xác nhận SLO. **Stress**: tăng tới khi hỏng, xem hệ thống gãy sạch hay sập dây chuyền.
- **Spike**: tăng đột ngột như đầu ca thi, kiểm tra autoscale, cache lạnh, pool. **Soak**: tải vừa nhiều giờ, tìm rò rỉ.

Chạy trên dữ liệu cỡ production với phân bố tham số giống thật (không phải cùng một user, cùng một đề, vì như vậy cache hit 100%).

```json
{
  "scenarios": { "exam_start_spike": {
    "executor": "ramping-arrival-rate", "startRate": 100, "timeUnit": "1s",
    "preAllocatedVUs": 2000, "maxVUs": 10000,
    "stages": [ { "target": 100, "duration": "2m" }, { "target": 5000, "duration": "30s" },
                { "target": 5000, "duration": "5m" }, { "target": 100, "duration": "1m" } ] } },
  "thresholds": { "http_req_duration{name:submit}": ["p(99)<500"], "http_req_failed": ["rate<0.001"] }
}
```

##### Hàng đợi và capacity planning
Với hàng đợi đơn giản (M/M/1), thời gian phản hồi R = S / (1 − U): U 50% thì R = 2S, 80% thì 5S, 90% thì 10S. Vì vậy vượt khoảng 70–80% utilization thì latency tăng vọt. Amdahl: phần song song hoá được là p thì speedup tối đa là 1 / (1 − p), p = 95% thì tối đa gấp 20. Universal Scalability Law thêm chi phí đồng bộ giữa các node, khiến thông lượng có điểm cực đại rồi giảm: thêm máy có thể làm chậm đi. Capacity planning: đo thông lượng mỗi instance ở utilization mục tiêu, dự báo đỉnh, cộng dư cho mất một node.

##### Chặn hồi quy
Benchmark gate trong CI so với baseline; load test ngắn trên staging trước release; Query Store "Regressed Queries" sau mỗi lần deploy DB; chaos engineering có kiểm soát (giết instance, làm chậm DB) để kiểm tra timeout, retry, circuit breaker chạy đúng thiết kế.

#### Cách show off
Phần thật: hệ thống dùng Elastic APM, và câu chuyện API bắt đầu thi có số trước sau lấy từ trace. SLO, error budget, load test bằng k6 ở dự án bạn chưa làm. Điểm mạnh nhất bạn có thể thể hiện là sự chính xác về số liệu: biết con số mình có là loại gì và muốn có p95 thật thì đo thế nào.

> **Ví dụ:** "Số liệu tôi có cho API bắt đầu thi là trace điển hình trước và sau bản sửa trên Elastic APM, nên tôi không gọi nó là p95. Nếu làm lại cho đúng, tôi sẽ định nghĩa SLI là tỉ lệ request bắt đầu thi xong dưới một ngưỡng, lấy từ histogram độ trễ, và đặt SLO trên tỉ lệ đó; cần để ý ngưỡng phải trùng biên bucket, vì bộ biên mặc định của ASP.NET Core có 0,25 và 0,5 giây chứ không có 0,3. Trước mùa thi, tôi muốn có một bài load test dạng spike theo tốc độ đến cố định, trên dữ liệu cỡ thật, để thấy tài nguyên nào nghẽn đầu tiên. Phần SLO và load test này dự án chưa có, tôi trình bày là cách tôi sẽ làm."

Điểm ăn điểm:
- Phân biệt trace điển hình, trung bình và percentile.
- Biết giới hạn của histogram: ngưỡng phải trùng biên bucket.
- Nói được coordinated omission và vì sao dùng open model.
- R = S / (1 − U) để giải thích vì sao không chạy CPU sát 100%.

#### Câu hỏi vặn
- **"Vì sao không dùng latency trung bình?"** Trung bình che đuôi phân bố. Người dùng gặp đuôi thường xuyên vì một trang gọi nhiều API: 20 lời gọi thì khoảng 18% lượt tải trang chạm ít nhất một request p99. Dùng percentile từ histogram.
- **"Error budget là gì, dùng để làm gì?"** Phần không đạt SLO được phép trong một khoảng thời gian, SLO 99,9% trong 30 ngày cho phép khoảng 43 phút. Còn budget thì phát hành nhanh; tiêu nhanh thì cảnh báo; hết budget thì dừng tính năng mới để ưu tiên ổn định.
- **"Vì sao latency tăng vọt khi CPU vượt 80%?"** Theo lý thuyết hàng đợi, thời gian phản hồi xấp xỉ S / (1 − U): 80% đã gấp 5 lần thời gian phục vụ, 90% gấp 10 lần. Request đến ngẫu nhiên nên hàng đợi dài ra rất nhanh khi gần bão hoà.
- **"Anh load test cho kỳ thi thế nào?"** Kịch bản spike theo tốc độ đến cố định cho đầu ca và cuối ca, dữ liệu cỡ production với phân bố user và đề thật; ngưỡng p99 và tỉ lệ lỗi; theo dõi tài nguyên nghẽn đầu tiên. Kèm soak test vài giờ để tìm rò rỉ.
- **"Con số trước sau anh nói là p95 à?"** Không, đó là trace điển hình trên APM. Muốn có p95, tôi lấy histogram độ trễ của API trong cùng khung giờ thi trước và sau bản sửa, hoặc chạy cùng kịch bản load test hai lần.
- **"SLO 300 ms mà histogram không có bucket 0,3 thì sao?"** Truy vấn `le="0.3"` không khớp chuỗi nào. Tôi cấu hình biên bucket cho instrument đó (ví dụ qua `AddView` của OpenTelemetry) để có biên 0,3, hoặc chọn ngưỡng SLO trùng biên có sẵn.
- **"USL nói gì mà Amdahl không nói?"** Amdahl chỉ có phần tuần tự nên thông lượng tiệm cận một trần. USL thêm chi phí đồng bộ giữa các node, khiến thông lượng đạt cực đại rồi giảm khi thêm node, giải thích vì sao thêm máy có thể làm chậm đi.

#### Bẫy cần tránh
- Load test một endpoint với một tham số: cache hit 100%, kết quả lạc quan vô căn cứ.
- Báo cáo p99 từ công cụ closed model mà không xét coordinated omission.
- Gọi trace điển hình là p95; đặt SLO 100%.

#### Nhớ nhanh
- RED cho service, USE cho tài nguyên; SLI, SLO, error budget, cảnh báo burn rate.
- Percentile từ histogram; gộp histogram trước khi tính; ngưỡng phải trùng biên bucket.
- Load test bốn dạng, dữ liệu cỡ thật, tốc độ đến cố định.
- R = S / (1 − U): giữ đỉnh dưới 70–80% utilization.

#### Bài tập
1. SLO 99,95% trong 30 ngày. Tính error budget theo phút.
   **Đáp án:** 0,05% × 43.200 phút = 21,6 phút.
2. Thời gian phục vụ 20 ms. Tính thời gian phản hồi ở utilization 60%, 85%, 95% theo M/M/1.
   **Đáp án:** 20 / 0,4 = 50 ms; 20 / 0,15 ≈ 133 ms; 20 / 0,05 = 400 ms.
3. 70% công việc song song hoá được. Speedup tối đa với 8 core và với vô hạn core theo Amdahl?
   **Đáp án:** 1 / (0,3 + 0,7/8) ≈ 2,58 lần; vô hạn core: 1 / 0,3 ≈ 3,33 lần.

### Bài 23.8. Vòng đời dữ liệu và chi phí

#### Kiến thức
Mọi tối ưu cuối cùng quy về tiền: máy, license, dung lượng, băng thông. Senior được kỳ vọng nói chuyện chi phí bằng số theo đơn vị nghiệp vụ, không chỉ bằng CPU.

##### Phân tầng nóng, ấm, lạnh
| Tầng | Truy cập | Nơi lưu | Ví dụ |
|---|---|---|---|
| Nóng | Đọc ghi liên tục, cần mili-giây | RAM, Redis, SSD, bảng chính | Ca thi đang diễn ra, cấu hình sự kiện |
| Ấm | Đọc thỉnh thoảng | Bảng archive, replica, ổ rẻ hơn | Kết quả năm học hiện tại |
| Lạnh | Hiếm khi đọc, giữ cho đối soát, pháp lý | Object storage tầng cool/archive, Parquet, backup | Log đáp án các năm trước |

Dữ liệu di chuyển theo tuổi bằng partition switching, job xuất Parquet, lifecycle rule của object storage. Tầng archive của cloud rất rẻ nhưng lấy lại mất nhiều giờ và tốn phí truy xuất; chỉ đưa vào đó dữ liệu gần như không bao giờ đọc. Mọi tầng đều có TTL hoặc retention: key Redis, bảng log, index Elasticsearch (Index Lifecycle Management), file tạm trên object storage, backup.

##### Nén
Row/page compression của SQL Server giảm dung lượng và số trang đọc, đổi lại tốn CPU khi đọc ghi. Ước lượng trước, bật trên partition cũ trước:

```sql
EXEC sp_estimate_data_compression_savings
     @schema_name = 'dbo', @object_name = 'AnswerLog',
     @index_id = NULL, @partition_number = NULL, @data_compression = 'PAGE';
ALTER INDEX ALL ON dbo.AnswerLog REBUILD PARTITION = 1 WITH (DATA_COMPRESSION = PAGE);
```

Columnstore nén rất cao, `COLUMNSTORE_ARCHIVE` nén thêm cho partition cũ. Parquet với Zstd/Snappy cho dữ liệu lạnh: nhỏ mà vẫn truy vấn được bằng công cụ phân tích.

##### Chi phí trên mỗi đơn vị nghiệp vụ
FinOps gắn chi phí hạ tầng với giá trị nghiệp vụ. Chỉ số cơ bản: chi phí trên mỗi lượt thi = tổng chi phí hạ tầng của kỳ thi / số lượt thi. Theo dõi theo thời gian cho biết tối ưu có giảm chi phí thật hay chỉ chuyển sang chỗ khác. Các đòn bẩy:
- **Right-sizing** theo utilization p95 nhiều tuần và đỉnh theo mùa, không theo trung bình. License SQL Server tính theo core, nên giảm core thừa tiết kiệm hơn tiền máy; tối ưu truy vấn giảm CPU có thể cho phép giảm core.
- **Tải theo đỉnh**: autoscale tầng ứng dụng theo lịch; tầng DB khó co giãn thì giảm đỉnh bằng cache, hàng đợi.
- **Cam kết dài hạn** cho tải nền ổn định; instance giá rẻ có thể bị thu hồi cho job batch chịu được gián đoạn.
- **Lưu trữ**: dọn bảng backup, DB OFFLINE, log cũ; phân tầng lạnh. **Truyền dữ liệu**: phí egress, CDN và nén giảm egress.

#### Cách show off
Phần thật là các phát hiện về lưu trữ trong đợt rà soát (bảng backup tạo tay, DB OFFLINE, log tích nhiều năm) và lập luận chọn bản Standard thay vì nâng Enterprise chỉ để có online index. FinOps, chi phí trên mỗi lượt thi là khung bạn đề xuất, chưa có số liệu thật; đừng đưa con số tiền.

> **Ví dụ:** "Trong đợt rà soát, phần lưu trữ có nhiều thứ không ai sở hữu: hàng trăm triệu dòng trong các bảng backup tạo tay, vài database để offline nhưng file vẫn nằm trên đĩa, log lỗi tích từ nhiều năm. Những thứ đó không chỉ tốn đĩa mà còn làm backup và restore lâu hơn. Tôi đề xuất mỗi bảng lớn một chính sách giữ dữ liệu, dữ liệu lạnh chuyển ra kho rẻ nhưng vẫn có đường đọc lại cho tra cứu khiếu nại. Về license, khi cần tạo index lớn, tôi chọn dời sang khung đêm thay vì đề xuất nâng Enterprise, vì license tính theo core và chênh lệch rất lớn. Nếu được làm tiếp, tôi muốn theo dõi chi phí trên mỗi lượt thi để biết tối ưu nào giảm tiền thật; hiện tôi chưa có số liệu đó."

Điểm ăn điểm:
- Nói chi phí theo đơn vị nghiệp vụ, không chỉ theo tài nguyên.
- Right-sizing theo p95 và đỉnh mùa thi, không theo trung bình.
- License theo core là đòn bẩy lớn với SQL Server.
- Phân tầng lạnh nhưng giữ đường đọc cho tra cứu.

#### Câu hỏi vặn
- **"Anh phân tầng dữ liệu kết quả thi qua nhiều năm thế nào?"** Năm học hiện tại ở bảng chính có index cho tra cứu; năm trước chuyển sang bảng archive nén page hoặc columnstore archive; dữ liệu nhiều năm xuất Parquet ra object storage tầng cool, giữ theo yêu cầu pháp lý; luôn có đường đọc cho tra cứu khiếu nại.
- **"Chi phí trên mỗi request dùng để làm gì?"** Gắn chi phí hạ tầng với đơn vị nghiệp vụ, so sánh theo thời gian và giữa các phương án. Nó cho biết tối ưu giảm chi phí thật hay chỉ chuyển chỗ, và giúp dự báo khi số người dùng tăng.
- **"Right-sizing server SQL Server cần lưu ý gì?"** Dựa trên p95 utilization và đỉnh theo mùa thi, không theo trung bình; license theo core nên giảm core thừa tiết kiệm lớn; giảm RAM thì kiểm tra buffer pool và page life expectancy; thử trên replica hoặc môi trường test trước.
- **"Khi nào bật page compression?"** Bảng lớn, đọc nhiều, I/O là nút thắt, CPU còn dư. Không hợp với bảng ghi rất nóng khi CPU đang cao. Ước lượng bằng `sp_estimate_data_compression_savings`, bật trên partition cũ trước.
- **"Đưa log cũ vào tầng archive của cloud cho rẻ có vấn đề gì?"** Lấy lại mất nhiều giờ và tốn phí truy xuất. Dữ liệu còn có thể cần cho khiếu nại hay đối soát thì để tầng cool hoặc bảng archive, chỉ dữ liệu gần như không bao giờ đọc mới vào archive.
- **"Anh có số tiết kiệm được bao nhiêu không?"** Không. Tôi chỉ ra các nguồn lãng phí và đề xuất chính sách; số tiền cụ thể cần dữ liệu chi phí hạ tầng mà tôi không nắm. Tôi không ước đoán con số khi kể.

#### Bẫy cần tránh
- Right-sizing theo trung bình: máy đủ cho ngày thường, sập ở đỉnh kỳ thi.
- Nén page trên bảng ghi rất nóng khi CPU đang cao.
- Đưa ra con số tiết kiệm không có nguồn.

#### Nhớ nhanh
- Dữ liệu chia nóng, ấm, lạnh; di chuyển theo tuổi bằng partition, export, lifecycle rule.
- Mọi tầng có TTL hoặc retention; giữ đường đọc cho tra cứu.
- Nén đổi CPU lấy dung lượng và I/O; ước lượng trước khi bật.
- Chi phí trên mỗi đơn vị nghiệp vụ; right-sizing theo p95 và đỉnh; license SQL Server theo core.

#### Bài tập
1. Kỳ thi tốn 120 triệu đồng hạ tầng mỗi tháng, phục vụ 2 triệu lượt thi. Sau tối ưu, chi phí còn 90 triệu, lượt thi tăng lên 2,5 triệu. Tính chi phí mỗi lượt thi trước và sau.
   **Đáp án:** Trước 60 đồng/lượt; sau 36 đồng/lượt, giảm 40%.
2. Đề xuất chính sách giữ dữ liệu ba tầng cho log đáp án từng câu.
   **Đáp án:** Nóng: 30 ngày ở bảng chính partition theo ngày; ấm: tới hết năm học ở replica hoặc bảng archive nén; lạnh: Parquet trên object storage tầng cool 5 năm; quá hạn xoá bằng lifecycle rule.

### Bài 23.9. Mảng khác chưa đi sâu

#### Kiến thức
Vị trí senior backend thường đòi bạn nói chuyện được với đội khác, kể cả khi mảng đó không phải thế mạnh. Bài này là bản đồ các khái niệm cốt lõi, đủ để không trả lời sai và biết mình cần học sâu thêm chỗ nào.

##### PostgreSQL
- **MVCC**: `UPDATE` không sửa tại chỗ mà tạo phiên bản dòng mới, dòng cũ thành dead tuple. Khác SQL Server, nơi chỉ khi bật RCSI hoặc snapshot mới lưu phiên bản cũ, và lưu ở version store riêng.
- **VACUUM và bloat**: autovacuum dọn dead tuple; bảng cập nhật nhiều mà vacuum không kịp thì phình, index cũng phình. Transaction mở lâu chặn vacuum. VACUUM còn chống transaction ID wraparound; bỏ mặc thì DB có thể buộc dừng ghi.
- **`EXPLAIN (ANALYZE, BUFFERS)`**: chạy thật, cho số dòng thực tế và số buffer đọc từ cache hay từ đĩa.
- **PgBouncer**: mỗi kết nối PostgreSQL là một process, đắt hơn nhiều so với SQL Server. Transaction pooling cho nhiều client dùng chung ít kết nối thật, đổi lại hạn chế tính năng gắn với session.
- Streaming replication cho replica đọc được; độ trễ replica gây lỗi read-your-writes.

##### MySQL InnoDB
Bảng luôn tổ chức theo primary key; index phụ chứa giá trị PK làm con trỏ, nên PK dài (UUID dạng chuỗi) làm mọi index phụ to ra. Ở REPEATABLE READ mặc định, gap lock và next-key lock khoá cả khoảng trống giữa các khoá index để chống phantom; cập nhật theo khoảng không có index phù hợp có thể khoá rộng và deadlock bất ngờ.

##### Linux và runtime khác
- TCP backlog (`net.core.somaxconn`) đầy thì kết nối mới bị từ chối hoặc trễ; `ulimit -n` thấp gây "too many open files"; NUMA làm truy cập bộ nhớ node khác chậm hơn.
- Công cụ: phương pháp USE, `perf` và flame graph, eBPF (`bcc`, `bpftrace`) đo I/O, syscall, mạng với chi phí thấp.

```bash
# 60 giây đầu khi máy chậm, theo checklist của Brendan Gregg
uptime; dmesg | tail; vmstat 1 5; mpstat -P ALL 1 3; pidstat 1 3
iostat -xz 1 3; free -m; sar -n DEV 1 3; sar -n TCP,ETCP 1 3; top -b -n 1 | head -20
```

- JVM: G1 mặc định, ZGC và Shenandoah cho pause rất ngắn với heap lớn; load test phải có giai đoạn warmup JIT. Go: goroutine nhẹ, scheduler M:N, `GOMAXPROCS` cần khớp giới hạn CPU của container ở bản cũ, `pprof` cho CPU, heap, goroutine.

##### Frontend, dữ liệu lớn, tìm kiếm
- Core Web Vitals: LCP (tốt dưới 2,5 s), INP (tốt dưới 200 ms, thay FID từ 2024), CLS (tốt dưới 0,1). Backend ảnh hưởng qua TTFB, payload, số request tuần tự.
- Spark: shuffle là bước đắt nhất, cẩn thận lệch dữ liệu. Data lake: Parquet trên object storage, Delta Lake hoặc Iceberg thêm transaction và time travel.
- Elasticsearch: số shard chọn lúc tạo index (thường nhắm vài chục GB mỗi shard); `keyword` cho lọc và gom nhóm chính xác, `text` cho tìm toàn văn; `refresh_interval` mặc định 1 giây, tăng hoặc tắt tạm khi nạp hàng loạt.

#### Cách show off
Ở AvePoint bạn có trải nghiệm thật với PostgreSQL replica và sharding, nên phần PostgreSQL nói được bằng trải nghiệm. Hệ thống thi dùng Elasticsearch cho log (đi qua Kafka). Các mảng khác (InnoDB, JVM, Go, Spark) nói thẳng là hiểu ở mức khái niệm, và chỉ ra cách bạn sẽ học nhanh: tìm điểm tương đương với thứ đã biết trong SQL Server và .NET.

> **Ví dụ:** "Phần lớn kinh nghiệm của tôi là SQL Server, nhưng ở AvePoint tôi đã làm với PostgreSQL có replica, nên tôi quen với khác biệt lớn nhất giữa hai bên: PostgreSQL luôn tạo phiên bản dòng mới khi cập nhật, dòng cũ chờ vacuum dọn, nên bảng cập nhật nhiều hay transaction mở lâu sẽ làm bảng phình. Với replica, vấn đề hay gặp là đọc ngay sau khi ghi mà replica chưa kịp, nên màn hình nào cần thấy dữ liệu vừa ghi thì đọc primary. Với MySQL hay Go, tôi chưa vận hành production; tôi biết các điểm cốt lõi như InnoDB tổ chức bảng theo khoá chính, hay gap lock ở mức cô lập mặc định, và nếu vào đội dùng chúng, tôi sẽ bắt đầu bằng cách đối chiếu với những gì đã biết ở SQL Server."

Điểm ăn điểm:
- So sánh MVCC PostgreSQL với row versioning SQL Server một cách chính xác.
- Biết vì sao PostgreSQL cần PgBouncer.
- Nói rõ ranh giới giữa trải nghiệm thật và hiểu biết khái niệm.

#### Câu hỏi vặn
- **"MVCC của PostgreSQL khác row versioning của SQL Server thế nào?"** PostgreSQL luôn tạo phiên bản dòng mới ngay trong bảng, dòng cũ thành dead tuple chờ VACUUM; bảng cập nhật nhiều có thể bloat. SQL Server mặc định sửa tại chỗ và dùng khoá; chỉ khi bật RCSI hoặc snapshot mới lưu phiên bản cũ trong version store.
- **"Vì sao PostgreSQL thường cần PgBouncer?"** Mỗi kết nối là một process, tốn bộ nhớ và chi phí tạo; hàng nghìn kết nối làm server chậm. PgBouncer transaction pooling cho nhiều client dùng chung ít kết nối thật, đổi lại hạn chế tính năng gắn với session.
- **"Gap lock trong InnoDB gây vấn đề gì?"** Ở REPEATABLE READ, InnoDB khoá cả khoảng giữa các khoá index để chống phantom. Cập nhật hay xoá theo khoảng, nhất là không có index phù hợp, khoá rộng và chặn insert của phiên khác, dễ deadlock. Index đúng, hoặc READ COMMITTED nếu nghiệp vụ cho phép.
- **"Bảng PostgreSQL dung lượng tăng mãi dù số dòng không đổi, vì sao?"** Bloat do dead tuple chưa được dọn kịp, có thể vì transaction mở lâu hoặc autovacuum cấu hình quá thận trọng. Xem `pg_stat_user_tables` (`n_dead_tup`, `last_autovacuum`), `pg_stat_activity` tìm transaction lâu, chỉnh autovacuum riêng cho bảng.
- **"Core Web Vitals gồm gì, backend ảnh hưởng chỉ số nào?"** LCP, INP, CLS. Backend ảnh hưởng LCP qua TTFB, kích thước payload, số request tuần tự; ảnh hưởng INP khi tương tác phải chờ API chậm.
- **"refresh_interval trong Elasticsearch là gì?"** Khoảng thời gian index làm mới để tài liệu mới tìm được, mặc định 1 giây. Mỗi lần refresh tạo segment mới, tốn tài nguyên; nạp hàng loạt thì tăng hoặc tắt tạm, chấp nhận dữ liệu mới tìm thấy chậm hơn.
- **"Máy Linux chạy API chậm, anh chạy lệnh gì đầu tiên?"** `uptime` cho load average theo thời gian, `vmstat 1` cho run queue, swap, CPU user/system/iowait, `iostat -xz 1` cho độ trễ và mức bận của đĩa, thêm `sar -n TCP,ETCP 1` cho lỗi và retransmit TCP. Một lần `top` không đủ để kết luận.

#### Bẫy cần tránh
- Mang thói quen SQL Server sang PostgreSQL: mở hàng nghìn kết nối trực tiếp, bỏ qua vacuum, để transaction mở lâu.
- Dùng UUID dạng chuỗi làm PK trong InnoDB.
- Giả vờ có kinh nghiệm vận hành ở mảng chỉ biết khái niệm.

#### Nhớ nhanh
- PostgreSQL: MVCC sinh dead tuple, VACUUM bắt buộc, PgBouncer cho kết nối.
- InnoDB: bảng theo PK, index phụ chứa PK, gap lock ở REPEATABLE READ.
- Linux: backlog, file descriptor, NUMA; đo bằng checklist 60 giây, `perf`, eBPF.
- Nói rõ đâu là trải nghiệm thật, đâu là hiểu biết khái niệm.

#### Bài tập
1. Chọn mapping cho trường `schoolName` cần cả tìm toàn văn lẫn gom nhóm chính xác trong Elasticsearch.
   **Đáp án:** Multi-field: `text` cho tìm kiếm và sub-field `keyword` (ví dụ `schoolName.raw`) cho lọc, sắp xếp, aggregation.
2. Liệt kê ba lệnh Linux đầu tiên khi API trên máy Linux chậm và mỗi lệnh cho biết gì.
   **Đáp án:** `uptime` (load average), `vmstat 1` (run queue, swap, iowait), `iostat -xz 1` (độ trễ và mức bận của đĩa); thêm `sar -n TCP,ETCP 1` cho lỗi và retransmit TCP.
