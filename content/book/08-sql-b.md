## Chương 20. Server và vận hành
Các chương trước xử lý từng câu lệnh và từng index. Chương này lùi ra một bước: cấu hình instance, tempdb, transaction log và vòng đời dữ liệu. Trong báo cáo hiệu năng APM nội bộ, nhóm vấn đề này sinh ra nhiều cảnh báo đỏ nhất, phần lớn do giữ nguyên cấu hình mặc định lúc cài và do việc vận hành bị bỏ ngỏ: không có job backup log, tempdb nằm trên ổ hệ điều hành, bảng backup tự sinh không ai dọn.

Interviewer hay hỏi mảng này vì nó phân biệt người chỉ viết query với người từng chịu trách nhiệm một hệ thống chạy thật. Câu hỏi thường bắt đầu từ một triệu chứng ("log đầy", "ổ C: hết chỗ", "server dùng hết RAM") và chờ bạn đi đúng thứ tự: đo gì, nguyên nhân gốc là gì, sửa thế nào mà không mất dữ liệu.

Học xong chương này, bạn đọc được cấu hình một instance và chỉ ra chỗ lệch so với best practice, giải thích được vì sao log không được tái sử dụng, và thiết kế được chính sách giữ dữ liệu cho bảng lớn.

### Bài 20.1. Cấu hình instance

#### Mục tiêu
- Sau bài này, bạn giải thích được ý nghĩa và giá trị hợp lý của `max server memory`, `cost threshold for parallelism`, `max degree of parallelism`, `optimize for ad hoc workloads`.
- Bạn kiểm tra được cấu hình một instance bằng `sys.configurations` và `sp_Blitz`, rồi đề xuất thay đổi kèm cách đo trước và sau.
- Bạn biết thay đổi nào chạy online, thay đổi nào cần restart hoặc khung bảo trì.

#### Bộ nhớ: max server memory
SQL Server dùng phần lớn RAM cho buffer pool (cache trang dữ liệu 8 KB) và plan cache. Mặc định `max server memory` là 2.147.483.647 MB, tức là không giới hạn: SQL Server sẽ chiếm RAM tới khi hệ điều hành báo thiếu bộ nhớ (memory pressure) rồi mới nhả ra.

Vì sao không nên để vậy: ngoài buffer pool, tiến trình SQL Server còn dùng bộ nhớ cho thread stack (mỗi worker khoảng 2 MB trên x64), CLR, linked server provider, backup buffer. Hệ điều hành, agent giám sát, antivirus cũng cần RAM. Khi OS thiếu bộ nhớ, nó ép SQL Server trả bộ nhớ (working set trim), hiệu năng dao động, nặng hơn là phân trang ra đĩa.

Quy tắc khởi điểm: chừa cho OS khoảng 10–20% RAM, tối thiểu 4 GB. Máy 32 GB đặt khoảng 26–28 GB; máy 64 GB đặt khoảng 54–56 GB. Sau đó theo dõi `Available MBytes` của OS (nên còn trên vài GB) để chỉnh.

```sql
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'max server memory (MB)', 27648;  -- máy 32 GB
RECONFIGURE;
```

Hai thiết lập đi kèm:
- **Lock Pages in Memory** (quyền Windows cấp cho tài khoản service): OS không đẩy buffer pool ra pagefile. Chỉ bật khi đã đặt `max server memory`, nếu không OS có thể thiếu RAM nghiêm trọng.
- **Instant File Initialization** (quyền "Perform volume maintenance tasks"): file data được cấp phát mà không phải ghi số 0, tăng file và restore nhanh hơn nhiều. Log file vẫn phải ghi số 0; từ SQL Server 2022, lần tăng log tới 64 MB mới được hưởng IFI.

#### Song song: cost threshold và MAXDOP
Optimizer chỉ cân nhắc plan song song khi cost ước lượng của plan tuần tự vượt `cost threshold for parallelism`. Mặc định là 5, con số đặt ra từ thời phần cứng cũ. Với giá trị này, cả những truy vấn OLTP nhỏ cũng chạy song song: tốn thêm worker, tốn đồng bộ giữa các luồng (wait `CXPACKET`, `CXCONSUMER`), trong khi nhanh hơn không đáng kể.

`max degree of parallelism` (MAXDOP) giới hạn số luồng cho một toán tử song song. Hướng dẫn của Microsoft: một NUMA node có tối đa 8 logical processor thì MAXDOP không vượt số đó; nhiều hơn 8 thì đặt 8; nhiều NUMA node thì không vượt số logical processor mỗi node, tối đa 16. Từ SQL Server 2019, trình cài đặt tự đề xuất giá trị này.

```sql
EXEC sp_configure 'cost threshold for parallelism', 50;
EXEC sp_configure 'max degree of parallelism', 8;
RECONFIGURE;
```

Cost threshold 50 là điểm khởi đầu phổ biến, không phải con số đúng cho mọi hệ thống. Cách chỉnh có căn cứ: lấy phân bố `StatementSubTreeCost` của các plan trong cache rồi chọn ngưỡng sao cho truy vấn OLTP nằm dưới, truy vấn báo cáo nằm trên.

#### Plan cache: optimize for ad hoc workloads
Ứng dụng gửi SQL ghép chuỗi sinh mỗi câu một plan dùng đúng một lần, chiếm plan cache. Bật `optimize for ad hoc workloads` thì lần đầu SQL Server chỉ lưu một plan stub (vài trăm byte); lần thứ hai câu đó chạy lại mới lưu plan đầy đủ. Kiểm tra mức lãng phí:

```sql
SELECT objtype, COUNT(*) AS plans,
       SUM(CAST(size_in_bytes AS bigint)) / 1048576 AS size_mb
FROM sys.dm_exec_cached_plans
WHERE usecounts = 1
GROUP BY objtype;
```

Thêm `backup compression default = 1`: backup nhỏ hơn và thường nhanh hơn vì bớt I/O, đổi lại tốn CPU lúc backup.

#### Bản vá
Từ SQL Server 2017 không còn Service Pack, chỉ có Cumulative Update (CU). Một bản 2019 RTM chưa cài CU nào đang thiếu hàng trăm bản sửa lỗi, trong đó có lỗi hiệu năng và lỗi optimizer. Cài CU trong khung bảo trì, thử trên môi trường test trước, có kế hoạch rollback.

#### Trong báo cáo
- Cụm log tự luyện: không giới hạn bộ nhớ trên máy 32 GB, `cost threshold` = 5, `optimize for ad hoc` = 0, nén backup = 0, SQL Server 2019 RTM chưa cài CU; `CXCONSUMER` 460 triệu lượt chờ (Cụm 1 – Mục 9).
- Cụm log thi chính thức: SQL Server dùng khoảng 96% RAM máy 64 GB (Cụm 3 – Mục 11).

#### Cách sửa
- Các lệnh `sp_configure` ở trên có hiệu lực ngay sau `RECONFIGURE`, không cần restart. Đổi `max server memory` xuống thấp hơn mức đang dùng làm SQL Server nhả buffer pool dần, nên chạy ngoài giờ cao điểm.
- Đổi cost threshold hoặc MAXDOP xoá plan cache liên quan, nên có một đợt biên dịch lại tăng CPU ngắn.
- Cài CU, cấp quyền Lock Pages in Memory và IFI cần restart service: làm trong khung bảo trì.

#### Kiểm chứng
- Chụp wait stats trước và sau (`sys.dm_os_wait_stats`, lấy chênh lệch theo thời gian, không lấy tích luỹ từ lúc khởi động).
- So `CXPACKET` + `CXCONSUMER`, CPU trung bình, `Page life expectancy`, `Available MBytes` của OS.
- Chạy lại `sp_Blitz` để xác nhận các mục cảnh báo đã hết.

#### Bẫy
- Đặt `max server memory` quá thấp làm buffer pool nhỏ, đọc đĩa tăng. Con số phải dựa trên RAM máy và các dịch vụ chạy chung.
- `CXCONSUMER` thường được coi là wait vô hại (phía consumer của trao đổi song song). Số lượt chờ lớn cho thấy có nhiều truy vấn song song, nhưng tín hiệu cần sửa là `CXPACKET` và thời gian chờ, không phải số lượt của `CXCONSUMER`.
- Đặt MAXDOP = 1 toàn server để "hết CXPACKET" làm truy vấn báo cáo chậm hẳn. Giới hạn song song nên làm ở cost threshold, hoặc từng truy vấn bằng hint `MAXDOP`.

#### Câu hỏi phỏng vấn
- **"Vì sao không để SQL Server dùng toàn bộ RAM của máy?"** Ngoài buffer pool, tiến trình còn dùng bộ nhớ cho thread stack, CLR, linked server provider, backup buffer; OS và các dịch vụ khác cũng cần RAM. Khi OS thiếu, nó ép SQL Server trả bộ nhớ, hiệu năng dao động, có thể phân trang ra đĩa. Đặt `max server memory` chừa 10–20% (tối thiểu 4 GB) rồi theo dõi `Available MBytes`.
- **"Mặc định cost threshold for parallelism là 5 thì có vấn đề gì, và bạn chọn giá trị mới thế nào?"** Với phần cứng hiện nay, cost 5 khiến cả truy vấn OLTP nhỏ chạy song song, tốn worker và wait đồng bộ. Tôi bắt đầu từ 50, sau đó lấy phân bố cost của plan trong cache để chỉnh sao cho OLTP nằm dưới ngưỡng, báo cáo nằm trên.
- **"Optimize for ad hoc workloads giải quyết vấn đề gì, và có mặt trái không?"** Nó chỉ lưu plan stub ở lần chạy đầu, tránh plan dùng một lần chiếm plan cache. Mặt trái nhỏ: câu chạy lần hai phải biên dịch lại một lần. Gốc vấn đề vẫn là code ghép chuỗi, nên sửa sang tham số hoá.
- **"Server SQL Server 2019 RTM chưa cài CU nào, bạn xử lý ra sao?"** Lên kế hoạch cài CU mới nhất: đọc danh sách lỗi đã biết, thử trên môi trường test, cài trong khung bảo trì, chụp wait stats và hiệu năng trước và sau, có bản backup và kế hoạch gỡ CU nếu cần.
- **"Bạn thấy CXCONSUMER 460 triệu lượt chờ, có kết luận là song song đang gây hại không?"** Chưa. `CXCONSUMER` là phía chờ vô hại của trao đổi song song. Tôi xem `CXPACKET` theo thời gian chờ, CPU, và các truy vấn song song nặng nhất trong Query Store trước khi kết luận; cost threshold 5 là nguyên nhân đáng sửa đầu tiên.

#### Tóm tắt
- `max server memory` mặc định là không giới hạn; luôn đặt, chừa 10–20% cho OS.
- Cost threshold 5 quá thấp; 50 là điểm khởi đầu, chỉnh theo phân bố cost thật.
- MAXDOP theo số core mỗi NUMA node, thường không quá 8.
- `optimize for ad hoc workloads` và `backup compression default` gần như luôn nên bật.
- Cài CU định kỳ; IFI và Lock Pages in Memory là quyền Windows, cần restart.

#### Bài tập
1. Viết truy vấn liệt kê các thiết lập `max server memory (MB)`, `cost threshold for parallelism`, `max degree of parallelism`, `optimize for ad hoc workloads`, `backup compression default` cùng giá trị đang chạy.
   **Đáp án:** `SELECT name, value_in_use FROM sys.configurations WHERE name IN ('max server memory (MB)', 'cost threshold for parallelism', 'max degree of parallelism', 'optimize for ad hoc workloads', 'backup compression default');`
2. Máy 64 GB chạy riêng SQL Server, 2 NUMA node, mỗi node 12 logical processor. Đề xuất `max server memory` và MAXDOP.
   **Đáp án:** Khoảng 56 GB (57.344 MB), chừa 8 GB cho OS rồi theo dõi `Available MBytes`. MAXDOP: mỗi node 12 logical processor, tối đa bằng số đó; giá trị 8 là lựa chọn an toàn phổ biến.
3. Sau khi đổi cost threshold từ 5 lên 50, CPU tăng vọt khoảng 5 phút rồi về thấp hơn trước. Giải thích.
   **Đáp án:** Đổi thiết lập làm mất plan cache liên quan, các truy vấn phải biên dịch lại nên CPU tăng ngắn. Sau đó nhiều truy vấn nhỏ chạy tuần tự, bớt chi phí song song nên CPU thấp hơn.

### Bài 20.2. TempDB và transaction log

#### Mục tiêu
- Sau bài này, bạn mô tả được tempdb chứa những gì và cấu hình nó đúng cách.
- Bạn giải thích được cơ chế ghi log, `WRITELOG`, VLF và vì sao log không được tái sử dụng.
- Bạn chọn được recovery model theo RPO và đọc được `log_reuse_wait_desc`.

#### TempDB chứa gì
TempDB là database dùng chung cho cả instance, tạo lại mỗi lần SQL Server khởi động. Nó chứa:
- Đối tượng người dùng: `#temp`, `##global`, bảng biến (bảng biến cũng nằm trong tempdb, không phải "chỉ trong RAM").
- Đối tượng nội bộ: work table cho sort, hash spill, spool, cursor; sort khi tạo index với `SORT_IN_TEMPDB = ON`.
- Version store: phiên bản cũ của dòng khi bật RCSI, Snapshot isolation, online index rebuild, trigger (bảng `inserted`/`deleted`), readable secondary.

Vì mọi DB đều dùng chung tempdb, một truy vấn spill lớn hoặc một transaction mở lâu dưới RCSI có thể làm tempdb phình và ảnh hưởng cả instance.

Cấu hình đúng:
- Đặt trên ổ riêng, nhanh (SSD/NVMe), không đặt ở ổ C: của hệ điều hành. Ổ C: đầy thì cả Windows lẫn SQL Server gặp sự cố.
- Số file data bằng số logical processor, tối đa 8 lúc đầu; nếu vẫn có tranh chấp trang cấp phát (wait `PAGELATCH_UP` trên trang PFS/GAM/SGAM của tempdb) thì thêm theo bội số 4.
- Các file cùng kích thước và cùng mức tăng, vì SQL Server phân phối theo proportional fill: file to hơn nhận nhiều việc hơn, mất tác dụng chia tải.
- Từ SQL Server 2016, hành vi của trace flag 1117/1118 đã là mặc định cho tempdb. SQL Server 2019 có thêm memory-optimized tempdb metadata để giảm tranh chấp trên bảng hệ thống.

#### Transaction log hoạt động thế nào
Mọi thay đổi dữ liệu được ghi vào log trước (write-ahead logging), trang dữ liệu sửa trong bộ nhớ được ghi xuống đĩa sau (checkpoint). Khi commit, SQL Server phải đợi bản ghi log được ghi bền xuống đĩa rồi mới trả kết quả. Thời gian đợi này là wait `WRITELOG`. Log ghi tuần tự nên cần ổ có độ trễ ghi thấp; `WRITELOG` cao thường do ổ log chậm, do quá nhiều commit nhỏ (mỗi dòng một transaction), hoặc log chung ổ với data.

File log được chia thành các Virtual Log File (VLF). Log là vòng tròn: khi phần đầu không còn cần nữa, SQL Server quay lại ghi đè (log truncation). Nếu có lý do giữ lại, log phải tăng kích thước.

`log_reuse_wait_desc` cho biết lý do log chưa được tái sử dụng:

| Giá trị | Ý nghĩa | Hướng xử lý |
|---|---|---|
| `LOG_BACKUP` | DB ở FULL/BULK_LOGGED, chưa backup log | Tạo job `BACKUP LOG` định kỳ |
| `ACTIVE_TRANSACTION` | Có transaction mở lâu | Tìm bằng `DBCC OPENTRAN`, `sys.dm_tran_active_transactions` |
| `REPLICATION` | Log Reader chưa đọc xong | Kiểm tra agent replication, CDC |
| `AVAILABILITY_REPLICA` | Replica AG chưa nhận/redo kịp | Kiểm tra mạng, độ trễ redo |
| `NOTHING` | Đang tái sử dụng bình thường | |

```sql
SELECT name, recovery_model_desc, log_reuse_wait_desc
FROM sys.databases;

SELECT DB_NAME(database_id) AS db, total_log_size_in_bytes / 1048576 AS log_mb,
       used_log_space_in_percent
FROM sys.dm_db_log_space_usage;  -- chạy trong từng DB
```

#### Recovery model và RPO
- **SIMPLE**: log tự truncate sau checkpoint. Không backup log được, chỉ khôi phục tới lần backup full/differential gần nhất.
- **FULL**: giữ log tới khi backup log. Khôi phục được tới một thời điểm bất kỳ (point-in-time) nếu chuỗi backup log liên tục.
- **BULK_LOGGED**: như FULL nhưng ghi log tối thiểu cho thao tác bulk; mất point-in-time trong khoảng có thao tác bulk.

RPO (Recovery Point Objective) là lượng dữ liệu tối đa được phép mất khi sự cố. DB có tiền, giao dịch, kết quả thi cần FULL và backup log 5–15 phút. DB log kỹ thuật, warehouse nạp lại được từ nguồn có thể SIMPLE.

#### VLF và cách tăng log
Mỗi lần log tăng sinh thêm một số VLF. Log tăng từng bước nhỏ (mặc định cũ là 10% hoặc 1 MB) sinh hàng nghìn VLF, làm backup log, recovery khi khởi động và đồng bộ AG chậm. Đặt kích thước ban đầu đủ lớn và `FILEGROWTH` cố định (ví dụ 512 MB–1 GB). Đếm VLF:

```sql
SELECT COUNT(*) AS vlf_count FROM sys.dm_db_log_info(DB_ID());
```

Shrink log chỉ sau khi đã sửa nguyên nhân (đã có backup log, đã đóng transaction treo), và shrink về kích thước hợp lý chứ không về 0. Không shrink file data định kỳ: shrink data di chuyển trang từ cuối file lên đầu, gây phân mảnh index nặng, rồi file lại tăng.

#### Trong báo cáo
- Một DB log 53,3 GB đầy 99,97%, kẹt `LOG_BACKUP`; `WRITELOG` 3,58 triệu giây trên cả cụm (Cụm 1 – Mục 1).
- DB kho câu hỏi log đầy 99,12%; ổ D: còn 9,16% (Cụm 6 – Mục 1, 6).
- TempDB 57,5 GB nằm trên ổ C: còn 9,59% trống (Cụm 3 – Mục 1).
- DB warehouse ở SIMPLE nhưng kẹt `ACTIVE_TRANSACTION` (Cụm 4 – Mục 15): SIMPLE không cứu được khi một transaction mở lâu.

#### Cách sửa
- Chọn recovery model theo RPO của từng DB. DB ở FULL có job backup log 5–15 phút (Ola Hallengren Maintenance Solution là lựa chọn phổ biến).
- Sau khi backup log chạy đều, shrink log một lần về kích thước hợp lý, đặt `FILEGROWTH` cố định.
- Chuyển tempdb sang ổ riêng: `ALTER DATABASE tempdb MODIFY FILE (NAME = tempdev, FILENAME = 'T:\tempdb\tempdb.mdf');` cho từng file, có hiệu lực sau restart.
- Cảnh báo theo % log đã dùng (ví dụ trên 70%), dung lượng ổ (dưới 15%), và `log_reuse_wait_desc` khác `NOTHING` kéo dài.

#### Kiểm chứng
- `used_log_space_in_percent` dao động lên xuống theo chu kỳ backup log thay vì tăng một chiều.
- `WRITELOG` trung bình mỗi lượt chờ (tổng thời gian / số lượt) giảm; độ trễ ghi ổ log (`sys.dm_io_virtual_file_stats`) dưới vài ms.

#### Bẫy
- Báo cáo đề xuất chuyển SIMPLE hàng loạt, kể cả ở cụm có DB giao dịch thanh toán (Cụm 6). Trước khi chuyển phải hỏi RPO: SIMPLE nghĩa là sự cố sẽ mất dữ liệu từ lần backup full/diff gần nhất. Nếu cần khôi phục theo thời điểm, giữ FULL và thêm job backup log.
- Chuyển FULL sang SIMPLE rồi quay lại FULL làm đứt chuỗi backup log; phải chạy một backup full hoặc differential mới để bắt đầu chuỗi mới.
- `DELAYED_DURABILITY = FORCED` giảm `WRITELOG` nhưng có thể mất các commit gần nhất khi sự cố; chỉ dùng cho dữ liệu chấp nhận mất.

#### Câu hỏi phỏng vấn
- **"Log đầy 99% dù DB nhỏ, bạn kiểm tra gì đầu tiên?"** `SELECT name, recovery_model_desc, log_reuse_wait_desc FROM sys.databases` để biết vì sao log không được tái sử dụng: thiếu backup log, transaction mở lâu, replication chưa đọc log, replica AG chậm. Sửa theo đúng lý do, sau đó mới cân nhắc shrink.
- **"Chuyển hết DB sang SIMPLE cho nhẹ log có được không?"** Chỉ với DB chấp nhận mất dữ liệu tới lần backup full/diff gần nhất. DB thanh toán, kết quả thi cần point-in-time recovery nên giữ FULL và có job backup log. Quyết định dựa trên RPO, không dựa trên dung lượng log.
- **"DB ở SIMPLE mà log vẫn đầy, vì sao?"** SIMPLE chỉ truncate được phần log không còn cần. Transaction mở lâu (`ACTIVE_TRANSACTION`), replication/CDC chưa đọc log, hoặc AG đều giữ log lại. Tìm transaction bằng `DBCC OPENTRAN` hoặc `sys.dm_tran_active_transactions`.
- **"Tempdb nên cấu hình thế nào trên server 16 core?"** Ổ riêng, nhanh; bắt đầu 8 file data cùng kích thước và cùng mức tăng; theo dõi `PAGELATCH_UP` trên trang cấp phát, còn tranh chấp thì thêm theo bội số 4. Kích thước ban đầu đặt đủ lớn để khỏi tăng trong ngày.
- **"WRITELOG cao thì nguyên nhân thường gặp và cách giảm là gì?"** Ổ log chậm, log chung ổ với data, hoặc ứng dụng commit từng dòng. Đo độ trễ ghi file log; chuyển log sang ổ nhanh riêng; gom nhiều thao tác vào một transaction vừa phải hoặc ghi theo lô.

#### Tóm tắt
- TempDB chứa temp table, bảng biến, spill, version store; đặt ổ riêng, nhiều file bằng nhau.
- Commit chờ ghi log bền xuống đĩa; `WRITELOG` phản ánh độ trễ ghi log.
- `log_reuse_wait_desc` chỉ đúng lý do log không truncate.
- Recovery model chọn theo RPO; FULL luôn đi kèm job backup log.
- Log tăng theo bước cố định đủ lớn; không shrink file data định kỳ.

#### Bài tập
1. DB ở FULL, log 40 GB đầy 98%, `log_reuse_wait_desc = LOG_BACKUP`, ổ còn 5%. Liệt kê các bước xử lý theo thứ tự.
   **Đáp án:** Chạy `BACKUP LOG` ngay (ra ổ khác còn chỗ) để giải phóng log; tạo job backup log 5–15 phút; khi log đã truncate đều, shrink log về kích thước hợp lý một lần; đặt `FILEGROWTH` cố định; thêm cảnh báo % log và dung lượng ổ. Không chuyển SIMPLE nếu chưa hỏi RPO.
2. Viết truy vấn đếm số VLF của DB hiện tại và cho biết khi nào con số đó đáng lo.
   **Đáp án:** `SELECT COUNT(*) FROM sys.dm_db_log_info(DB_ID());`. Vài trăm là bình thường với log lớn; hàng nghìn VLF thường do tăng nhỏ nhiều lần, làm recovery và backup log chậm.
3. Giải thích vì sao bật RCSI có thể làm tempdb phình, và theo dõi bằng gì.
   **Đáp án:** RCSI lưu phiên bản cũ của dòng trong version store ở tempdb; transaction mở lâu giữ version store không được dọn. Theo dõi `sys.dm_tran_version_store_space_usage` và transaction lâu nhất trong `sys.dm_tran_active_snapshot_database_transactions`.

### Bài 20.3. Vòng đời dữ liệu: archive, partition, dọn rác

#### Mục tiêu
- Sau bài này, bạn giải thích được vì sao bảng nóng phải nhỏ và thiết kế được chính sách giữ dữ liệu theo bảng.
- Bạn xoá được hàng trăm triệu dòng trên production mà không làm phình log hay khoá bảng.
- Bạn dùng được partition switching và `TRUNCATE ... WITH (PARTITIONS ...)`.

#### Vì sao bảng nóng phải nhỏ
Chi phí của một bảng lớn không chỉ là dung lượng. Index lớn có nhiều cấp B-tree hơn, scan đọc nhiều trang hơn, rebuild index và update statistics lâu hơn, backup và restore lâu hơn, buffer pool bị chiếm bởi dữ liệu cũ hiếm khi đọc. Một proc "tìm feed" quét bảng 580 triệu dòng đọc hàng trăm nghìn trang mỗi lần, dù người dùng chỉ xem dữ liệu vài tháng gần nhất.

Nguyên tắc: tách dữ liệu nóng (đang được đọc/ghi thường xuyên) khỏi dữ liệu lạnh (chỉ giữ để tra cứu, đối soát). Dữ liệu lạnh chuyển sang bảng archive, DB archive, hoặc kho lạnh (file Parquet trên object storage, warehouse).

#### Partition theo thời gian
Partition chia một bảng logic thành nhiều phần vật lý theo một cột (thường là ngày hoặc mã ca thi). Lợi ích chính cho vòng đời dữ liệu là thao tác metadata thay cho xoá từng dòng:

```sql
CREATE PARTITION FUNCTION pf_month (date)
AS RANGE RIGHT FOR VALUES ('2026-01-01', '2026-02-01', '2026-03-01');
CREATE PARTITION SCHEME ps_month AS PARTITION pf_month ALL TO ([PRIMARY]);

-- Xoá cả tháng cũ nhất: chỉ đổi metadata, gần như tức thì
TRUNCATE TABLE dbo.ExamLog WITH (PARTITIONS (1));          -- SQL Server 2016+

-- Hoặc chuyển ra bảng archive cùng cấu trúc, cùng filegroup, đang rỗng
ALTER TABLE dbo.ExamLog SWITCH PARTITION 1 TO dbo.ExamLog_Archive;
```

Điều kiện `SWITCH`: bảng đích cùng cấu trúc cột, cùng index, cùng filegroup với partition nguồn, đích đang rỗng (hoặc đúng partition đích rỗng), index phải aligned (partition theo cùng scheme). Sliding window là quy trình định kỳ: `SPLIT` thêm partition cho tháng tới, `SWITCH`/`TRUNCATE` partition cũ nhất, `MERGE` ranh giới rỗng.

Partition không tự làm truy vấn nhanh hơn. Truy vấn chỉ hưởng lợi khi có điều kiện trên cột partition để optimizer loại bỏ partition (partition elimination).

#### Xoá theo lô
Khi không có partition, `DELETE` một lần hàng chục triệu dòng gây ba vấn đề: log phình vì cả thao tác là một transaction; khoá leo thang lên cả bảng (lock escalation thường xảy ra khi một câu lệnh giữ khoảng 5.000 khoá trên một đối tượng); rollback nếu bị huỷ còn lâu hơn lúc chạy. Xoá theo lô giải quyết cả ba:

```sql
DECLARE @batch int = 4000, @rows int = 1;
WHILE @rows > 0
BEGIN
    DELETE TOP (@batch) FROM dbo.ErrorLog
    WHERE CreatedAt < '2025-01-01';      -- cần index trên CreatedAt hoặc clustered key theo thời gian
    SET @rows = @@ROWCOUNT;
    WAITFOR DELAY '00:00:00.200';        -- nhường tài nguyên, cho backup log kịp chạy
END
```

Kích thước lô là đánh đổi: lô nhỏ dưới ngưỡng leo thang khoá thì an toàn cho truy vấn đồng thời; lô lớn hơn (vài chục nghìn) chạy nhanh hơn nhưng có thể khoá cả bảng ngắn. Ở FULL recovery, log vẫn tích tới khi backup log, nên job backup log phải chạy trong lúc xoá.

Cách thứ ba khi phần giữ lại nhỏ hơn nhiều phần xoá: chép phần cần giữ sang bảng mới (`INSERT ... SELECT` với `TABLOCK` để được minimal logging ở SIMPLE/BULK_LOGGED), tạo index, rồi đổi tên bảng trong một khoảng dừng ngắn.

#### Bảng backup và DB OFFLINE
`SELECT * INTO dbo.Table_bak_20240101 FROM dbo.Table` tạo một heap không index, không ai sở hữu, nằm trong cùng DB nên làm backup to ra và tồn mãi. Thay bằng: backup DB trước thay đổi, BCP/BACPAC ra file, hoặc nếu bắt buộc tạo bảng tạm thì có quy ước tên (kèm ngày hết hạn) và job dọn. DB để OFFLINE vẫn chiếm đĩa vì file vẫn nằm đó; DB không dùng nữa thì backup lần cuối, lưu file backup ở kho lạnh, rồi drop.

#### Retention theo bảng
Mỗi bảng lớn cần một dòng chính sách: giữ bao lâu ở bảng nóng, chuyển đi đâu, xoá hẳn khi nào, ai duyệt. Bảng log lỗi, log ứng dụng thường giữ 30–90 ngày với job dọn hằng tuần. Bảng nghiệp vụ (kết quả thi) giữ theo yêu cầu pháp lý và đối soát, thường archive chứ không xoá.

#### Trong báo cáo
- Bảng feed 580 triệu dòng (54 GB), bảng cấu hình feed 1 tỷ dòng; proc tìm feed 509.798 reads/lần → đề xuất archive dữ liệu cũ hơn 1 năm (Cụm 2 – Mục 2).
- Hơn 300 triệu dòng nằm trong các bảng backup ở cụm người dùng, và vẫn đang sinh bản mới (Cụm 5 – Mục 9).
- Bảng log lỗi 9–19 triệu dòng tích tụ từ 2021 (Cụm 3 – Mục 3, Cụm 5 – Mục 5).
- 10 DB OFFLINE chiếm 22,1 GB (Cụm 5 – Mục 6).

#### Cách sửa
- Lập chính sách giữ dữ liệu cho từng bảng lớn; partition theo ca thi hoặc theo ngày cho bảng log.
- Tắt tiến trình tự tạo bảng backup trước, rồi mới dọn các bảng đã có (nếu không, dọn xong lại sinh mới).
- Archive feed cũ hơn 1 năm bằng xoá theo lô hoặc chép-giữ-lại, kèm index phục vụ truy vấn trên dữ liệu gần.

#### Kiểm chứng
- Kích thước bảng (`sp_spaceused`) và số trang đọc mỗi lần của proc tìm feed giảm.
- Log không vượt ngưỡng cảnh báo trong lúc dọn; không có blocking kéo dài (`sp_WhoIsActive` trong lúc chạy).

#### Bẫy
- Xoá theo lô mà điều kiện `WHERE` không có index: mỗi lô quét lại cả bảng, càng về sau càng chậm.
- Partition bảng mà index không aligned thì không `SWITCH` được.
- Archive mà quên các truy vấn tra cứu cũ (khiếu nại, đối soát): cần có đường đọc dữ liệu archive trước khi xoá khỏi bảng nóng.

#### Câu hỏi phỏng vấn
- **"Xoá 100 triệu dòng log cũ trên production thế nào?"** Không `DELETE` một lần (log phình, khoá leo thang, rollback lâu). Có partition thì `SWITCH` ra bảng rỗng hoặc `TRUNCATE ... WITH (PARTITIONS ...)`. Không có thì `DELETE TOP (N)` theo index trên cột thời gian, trong vòng lặp, có nghỉ, ngoài giờ cao điểm, job backup log chạy song song. Nếu phần giữ lại nhỏ, chép phần giữ sang bảng mới rồi đổi tên.
- **"Partition có làm truy vấn nhanh hơn không?"** Chỉ khi truy vấn lọc trên cột partition để có partition elimination. Lợi ích chắc chắn là quản lý vòng đời: switch, truncate từng partition, rebuild từng partition. Truy vấn không lọc theo cột partition có thể còn chậm hơn.
- **"Vì sao không nên sao lưu bảng bằng SELECT INTO?"** Nó tạo heap không index trong cùng DB, làm backup và restore to ra, không có chủ, không có hạn xoá. Dùng backup DB, BCP hoặc BACPAC; nếu buộc phải tạo bảng tạm thì có quy ước tên kèm ngày hết hạn và job dọn.
- **"Bạn chọn kích thước lô khi xoá dữ liệu thế nào?"** Bắt đầu dưới ngưỡng leo thang khoá (vài nghìn dòng) để không khoá bảng, đo thời gian mỗi lô và blocking, rồi tăng dần nếu hệ thống chịu được. Theo dõi log và độ trễ replica trong lúc chạy.

#### Tóm tắt
- Bảng nóng nhỏ thì index nhỏ, bảo trì nhanh, buffer pool chứa đúng dữ liệu cần.
- Partition theo thời gian cho phép `SWITCH`/`TRUNCATE` partition thay cho xoá từng dòng.
- Không có partition thì xoá theo lô có index, có nghỉ, backup log chạy song song.
- Bảng backup tạo bằng `SELECT INTO` và DB OFFLINE là rác chiếm đĩa; cần quy ước và job dọn.
- Mỗi bảng lớn có chính sách giữ dữ liệu rõ ràng.

#### Bài tập
1. Bảng log 200 triệu dòng, clustered index trên `Id` identity, có index trên `CreatedAt`. Viết vòng lặp xoá dữ liệu trước 2025-01-01 theo lô 4.000 dòng.
   **Đáp án:** Vòng `WHILE` với `DELETE TOP (4000) FROM ... WHERE CreatedAt < '2025-01-01'`, gán `@@ROWCOUNT`, `WAITFOR DELAY` ngắn giữa các lô; chạy ngoài giờ cao điểm, backup log song song.
2. Bảng log đã partition theo tháng (RANGE RIGHT). Viết lệnh dọn tháng cũ nhất và thêm ranh giới cho tháng tới.
   **Đáp án:** `TRUNCATE TABLE dbo.ExamLog WITH (PARTITIONS (1));` rồi `ALTER PARTITION FUNCTION pf_month() MERGE RANGE ('2026-01-01');`; trước đó `ALTER PARTITION SCHEME ps_month NEXT USED [PRIMARY];` và `ALTER PARTITION FUNCTION pf_month() SPLIT RANGE ('2026-04-01');`. Split nên làm khi partition cuối còn rỗng để tránh di chuyển dữ liệu.
3. Viết một dòng chính sách giữ dữ liệu cho bảng log lỗi ứng dụng.
   **Đáp án:** Ví dụ: giữ 90 ngày ở bảng nóng; job xoá theo lô chạy 2:00 sáng Chủ nhật; dữ liệu lỗi nghiêm trọng xuất ra file trước khi xoá; chủ sở hữu là nhóm backend; cảnh báo nếu bảng vượt 5 triệu dòng.

## Chương 21. Tầng ứng dụng và kiến trúc
Nhiều vấn đề trông như "DB chậm" thực ra nằm ở cách ứng dụng gọi DB: gọi lặp lại cùng một dữ liệu hàng triệu lần, giữ kết nối quá lâu, gọi server khác trong lúc đang giữ khoá, chạy truy vấn báo cáo trên cùng server với luồng ghi nóng, nuốt lỗi khiến không ai biết DB đang hỏng. Sửa ở tầng ứng dụng thường rẻ hơn và tác động lớn hơn thêm index.

Interviewer senior thường hỏi theo hướng thiết kế: "bạn cache cái gì, invalidate thế nào", "pool bao nhiêu là đủ", "làm sao giữ nhất quán khi tách transaction". Câu trả lời tốt luôn có số (tần suất gọi, thời gian giữ kết nối) và có đánh đổi (độ cũ dữ liệu, độ trễ đồng bộ).

Học xong chương này, bạn thiết kế được lớp cache có chống stampede, tính được kích thước pool bằng Little's law, thay distributed transaction bằng outbox, chọn được cách tách đọc/ghi, và xử lý lỗi sao cho lỗi lộ ra mà không làm hại DB.

### Bài 21.1. Cache ở tầng ứng dụng

#### Mục tiêu
- Sau bài này, bạn phân biệt được ba lớp cache và chọn lớp phù hợp cho từng loại dữ liệu.
- Bạn cài được cache-aside có TTL, invalidation theo sự kiện và chống cache stampede.
- Bạn chọn được TTL dựa trên tần suất dữ liệu đổi và yêu cầu nghiệp vụ.

#### Ba lớp cache
1. **Trong một request**: nhớ kết quả trong biến hoặc dictionary của request. Ví dụ một request cần cấu hình sự kiện ở 5 chỗ thì chỉ gọi DB một lần. Không có vấn đề nhất quán vì sống đúng một request.
2. **Trong bộ nhớ một instance** (`IMemoryCache`): nhanh nhất (nanosecond tới microsecond), không qua mạng. Nhược điểm: mỗi instance có bản riêng, xoá cache phải báo tới từng instance; tốn RAM của process, tăng áp lực GC nếu giữ object lớn.
3. **Cache phân tán** (Redis): dùng chung cho mọi instance, sống qua lần deploy. Mỗi lần đọc là một round-trip mạng (thường dưới 1 ms trong cùng data center) cộng chi phí deserialize.

Hai lớp sau thường kết hợp: L1 trong process TTL ngắn (vài giây tới vài chục giây) trước L2 Redis TTL dài hơn. Bài 23.2 đi sâu phần này.

#### Cache-aside
Cache-aside (lazy loading): đọc cache → trượt thì đọc DB → ghi vào cache có TTL → trả kết quả. Khi dữ liệu đổi, xoá key (hoặc ghi đè) theo sự kiện.

```csharp
public async Task<ExamPaper?> GetPaperAsync(int paperId, CancellationToken ct)
{
    var key = $"exam:paper:v1:{paperId}";
    if (_memory.TryGetValue(key, out ExamPaper? cached))
        return cached;

    // Single-flight trong instance: chỉ một request nạp key này từ DB
    var gate = _locks.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
    await gate.WaitAsync(ct);
    try
    {
        if (_memory.TryGetValue(key, out cached)) return cached;
        var paper = await _repo.GetPaperAsync(paperId, ct);       // gọi proc
        if (paper is not null)
        {
            var ttl = TimeSpan.FromMinutes(30) + TimeSpan.FromSeconds(Random.Shared.Next(0, 120));
            _memory.Set(key, paper, ttl);                          // TTL lệch ngẫu nhiên
        }
        return paper;
    }
    finally { gate.Release(); }
}
```

Các điểm trong đoạn trên:
- Key có tiền tố theo miền và số version (`v1`). Đổi cấu trúc object thì tăng version, không cần xoá cache cũ.
- Kiểm tra lại cache sau khi lấy được khoá (double-check), tránh nạp lại khi request trước vừa nạp xong.
- TTL cộng thêm phần ngẫu nhiên để các key không hết hạn cùng lúc.
- Chỉ cache khi có dữ liệu thật. Nếu muốn cache "không tồn tại" (chống truy vấn lặp vào ID không có), cache một giá trị đánh dấu với TTL ngắn, và chỉ khi DB trả rỗng thật, không phải khi DB lỗi.

Ghi vào Redis nên chạy nền và tự bắt lỗi: cache hỏng không được làm request thất bại, request cũng không phải chờ ghi cache xong.

#### Cache stampede
Cache stampede (thundering herd trên cache): một key nóng hết hạn, hàng nghìn request cùng trượt và cùng gọi DB, DB quá tải đúng lúc tải cao nhất. Cách chống:
- **Single-flight / request coalescing**: chỉ một request nạp, các request khác chờ kết quả (như đoạn code trên, hoặc `HybridCache` đã làm sẵn trong một instance). Giữa nhiều instance, dùng khoá phân tán ngắn trên Redis (`SET key value NX PX 5000`).
- **TTL lệch ngẫu nhiên** (jitter) để không nhiều key hết hạn cùng lúc.
- **Làm mới nền**: job nạp lại key trước khi hết hạn; hoặc stale-while-revalidate: trả giá trị cũ, đồng thời một luồng nạp giá trị mới.
- **Warmup**: nạp sẵn cache đề thi, cấu hình ca thi trước giờ mở ca.

#### Chọn TTL
TTL là độ cũ tối đa chấp nhận được, không phải con số tuỳ ý. Câu hỏi đặt cho nghiệp vụ: dữ liệu này đổi bao lâu một lần, người dùng thấy dữ liệu cũ bao lâu thì chấp nhận được. Dữ liệu đổi theo sự kiện biết trước (job xếp hạng, admin sửa cấu hình) thì xoá hoặc ghi đè cache ngay khi sự kiện xảy ra; TTL chỉ là lưới an toàn khi bước xoá cache thất bại.

#### Trong báo cáo
- Proc thống kê hạng gọi 9,1 triệu lần, proc hạng theo user 15,4 triệu lần, trong khi bảng hạng chỉ đổi khi job xếp hạng chạy → đề xuất TTL 60–300 giây và ghi lại cache sau khi job chạy xong (Cụm 4 – Mục 11).
- Danh mục trường gọi 7.623 lần/ngày, gần như không đổi → Redis TTL 24 giờ (Cụm 2 – Mục 13).
- Proc lấy đề theo mã đề gọi 640.430 lần/ngày, đề không đổi trong ca thi → cache theo mã đề (Cụm 6 – Mục 5).
- API tự luyện khi trượt cache phải gọi DB 3 lần (Vấn đề 2).

#### Cách sửa
- Cache theo mã đề cho dữ liệu đề thi, warmup trước ca.
- Bảng hạng: job xếp hạng xong thì ghi đè cache; TTL 60–300 giây làm lưới an toàn.
- Gộp 3 lần gọi DB của API tự luyện thành một proc trả nhiều result set, hoặc cache từng phần riêng.

#### Kiểm chứng
- Tỉ lệ cache hit theo từng nhóm key (đếm hit/miss bằng metric).
- Số lần gọi proc mỗi ngày giảm tương ứng (Query Store, `execution_count`).
- p95/p99 của API không tăng vọt ở thời điểm key hết hạn.

#### Bẫy
- Cache kết quả rỗng do DB lỗi: lỗi biến thành "không có dữ liệu" và tồn tại tới hết TTL.
- Cache object có thể sửa (mutable) trong `IMemoryCache` rồi sửa object đó trong request: mọi request khác thấy bản đã sửa.
- Xoá cache trước khi commit DB: request khác nạp lại dữ liệu cũ vào cache. Xoá sau commit.

#### Câu hỏi phỏng vấn
- **"Cache bảng xếp hạng TTL 5 phút, job xếp hạng xong lúc 10:00, người dùng thấy hạng cũ tới 10:05 có chấp nhận được không?"** Hỏi nghiệp vụ trước. Nếu không chấp nhận: job xong thì ghi đè cache hoặc xoá key theo sự kiện; TTL chỉ là lưới an toàn khi bước cập nhật cache thất bại.
- **"Cache stampede là gì và bạn chống thế nào?"** Key nóng hết hạn, nhiều request cùng trượt và cùng gọi DB. Chống bằng single-flight (một request nạp, request khác chờ), TTL lệch ngẫu nhiên, làm mới nền hoặc stale-while-revalidate, và warmup trước sự kiện lớn.
- **"Khi nào dùng IMemoryCache, khi nào dùng Redis?"** Dữ liệu nhỏ, đọc rất nhiều, chấp nhận mỗi instance lệch nhau vài giây thì `IMemoryCache`. Cần dùng chung giữa instance, cần xoá đồng loạt, dữ liệu lớn hơn RAM một process thì Redis. Thường kết hợp L1 TTL ngắn trước L2 Redis.
- **"Có nên cache kết quả rỗng không?"** Có, để chặn truy vấn lặp vào ID không tồn tại, nhưng TTL ngắn và chỉ khi DB trả rỗng thật. Nếu code nuốt exception rồi trả rỗng, cache sẽ giữ lỗi đó như dữ liệu.
- **"Xoá cache trước hay sau khi ghi DB, vì sao?"** Sau khi commit. Xoá trước thì giữa lúc xoá và lúc commit, một request khác có thể nạp lại giá trị cũ vào cache và giữ tới hết TTL. Dù vậy vẫn còn cửa sổ race nhỏ, nên giữ TTL làm lưới an toàn.

#### Tóm tắt
- Ba lớp: trong request, trong process, Redis dùng chung.
- Cache-aside: đọc cache, trượt thì đọc DB, ghi cache có TTL; xoá theo sự kiện sau commit.
- Chống stampede bằng single-flight, TTL jitter, làm mới nền, warmup.
- TTL là độ cũ tối đa nghiệp vụ chấp nhận.
- Phân biệt "rỗng" với "lỗi" trước khi cache.

#### Bài tập
1. Proc lấy đề gọi 640.430 lần/ngày, mỗi ngày có 40 mã đề được dùng. Ước lượng số lần gọi proc sau khi cache theo mã đề với TTL 30 phút, ca thi kéo dài 12 giờ.
   **Đáp án:** Mỗi mã đề nạp lại khoảng 12 × 2 = 24 lần; 40 mã đề → khoảng 960 lần/ngày mỗi instance có L1 riêng (nhân số instance nếu chỉ dùng L1), giảm hơn 99%.
2. Chỉ ra lỗi trong đoạn: `try { var r = await db.GetRank(id); cache.Set(key, r ?? new List<Rank>()); } catch { cache.Set(key, new List<Rank>()); }`.
   **Đáp án:** Khi DB lỗi, danh sách rỗng được cache và trả cho người dùng tới hết TTL; lỗi không được ghi log. Không cache trong `catch`, ghi log và ném lại hoặc trả lỗi rõ ràng.
3. Thiết kế key và TTL cho cấu hình ca thi mà admin có thể sửa trong CMS.
   **Đáp án:** Key `exam:shift-config:v1:{shiftId}`; TTL vài phút làm lưới an toàn; CMS sửa xong (sau commit) thì xoá key ở Redis và phát thông báo (Pub/Sub) để các instance xoá L1; warmup trước giờ mở ca.

### Bài 21.2. Connection pool và Little's law
**Viz:** pool

#### Mục tiêu
- Sau bài này, bạn áp dụng được Little's law để tính số kết nối đồng thời cần cho một tải cho trước.
- Bạn giải thích được cơ chế ADO.NET connection pool và hiện tượng hết pool.
- Bạn biết vì sao tăng pool khi query còn chậm làm tình hình tệ hơn, và quản lý đúng kết nối ra ngoài (`HttpClient`, `GrpcChannel`).

#### Little's law
Với một hệ ổn định: L = λ × W. L là số phần tử đang nằm trong hệ, λ là tốc độ đến, W là thời gian mỗi phần tử ở trong hệ. Áp vào connection pool: số kết nối đang dùng = số request mỗi giây × thời gian mỗi request giữ kết nối.

- 2.000 request/giây, giữ kết nối 30 ms → 2.000 × 0,03 = 60 kết nối đồng thời trung bình.
- Query 2 ms → một kết nối phục vụ được 1 / 0,002 = 500 request/giây; pool 50 đủ cho 25.000 request/giây.
- Query 2 giây, 100 request/giây → cần 200 kết nối, và 200 truy vấn chạy đồng thời trên SQL Server.

Hệ quả: thời gian giữ kết nối quan trọng ngang tốc độ đến. Giảm W là cách rẻ nhất để giảm số kết nối.

#### ADO.NET connection pool
Mở một kết nối vật lý tới SQL Server tốn kém: TCP handshake, TLS handshake, xác thực, khởi tạo session. Pool giữ các kết nối đã mở để dùng lại. `SqlConnection.Open()` lấy một kết nối rảnh từ pool; `Dispose()`/`Close()` trả về pool (kết nối vật lý vẫn mở, session được reset ở lần dùng sau).

- Pool tách theo connection string chính xác từng ký tự (và theo identity khi dùng Integrated Security). Hai chuỗi khác nhau một khoảng trắng là hai pool.
- `Max Pool Size` mặc định 100, `Min Pool Size` mặc định 0.
- Hết pool: request mới chờ tới `Connect Timeout` (mặc định 15 giây) rồi nhận `InvalidOperationException` với thông báo hết thời gian chờ lấy kết nối từ pool. Triệu chứng: API chậm đúng khoảng 15 giây rồi lỗi, trong khi CPU SQL Server có thể không cao.

```csharp
// Mở muộn, đóng sớm: kết nối chỉ được giữ trong lúc chạy proc
await using (var conn = new SqlConnection(_cs))
await using (var cmd = new SqlCommand("dbo.usp_GetExamResult", conn) { CommandType = CommandType.StoredProcedure })
{
    cmd.Parameters.Add("@UserId", SqlDbType.BigInt).Value = userId;
    await conn.OpenAsync(ct);
    result = await ReadResultAsync(cmd, ct);
}
// Gọi dịch vụ khác SAU khi đã trả kết nối
await _notifyClient.SendAsync(result, ct);
```

Rò rỉ kết nối (quên `Dispose`, giữ `SqlDataReader` mở) làm pool cạn dần dù tải không đổi. Kiểm tra bằng số session theo `program_name`/`host_name` trong `sys.dm_exec_sessions`, hoặc event counter của Microsoft.Data.SqlClient (số kết nối active, số kết nối trong pool).

#### Vì sao tăng pool không cứu được query chậm
Mỗi truy vấn đang chạy chiếm ít nhất một worker thread của SQL Server; truy vấn song song chiếm nhiều hơn. Số worker có giới hạn (`max worker threads` tự tính theo số CPU, ví dụ máy 16 logical CPU khoảng 704 worker trên x64). Khi query chậm, tăng pool từ 100 lên 500 chỉ đẩy thêm truy vấn đồng thời vào SQL Server: tranh chấp CPU, khoá, memory grant tăng, mỗi truy vấn lại chậm hơn, W tăng nên cần L lớn hơn nữa. Vòng xoáy kết thúc bằng wait `THREADPOOL`: SQL Server hết worker, kết nối mới không được phục vụ, kể cả đăng nhập của DBA (lúc đó chỉ còn Dedicated Admin Connection).

Thứ tự đúng: giảm W (sửa query, bỏ gọi ngoài trong lúc giữ kết nối) trước, chỉ tăng pool khi phép tính Little's law với W đã tối ưu cho thấy cần.

Pool là giới hạn trên mỗi process. Với N instance app, tổng kết nối tới DB có thể lên N × Max Pool Size. Tính pool theo tải mỗi instance, cộng dư cho lúc đỉnh.

#### Kết nối ra ngoài cũng phải dùng lại
- `new HttpClient()` mỗi request: mỗi lần tạo connection mới, socket ở trạng thái TIME_WAIT tích tụ, có thể cạn cổng (socket exhaustion). Dùng `IHttpClientFactory` (quản lý vòng đời handler) hoặc một `HttpClient` singleton với `SocketsHttpHandler.PooledConnectionLifetime` để vẫn cập nhật DNS.
- `GrpcChannel` tốn kém khi tạo (kết nối HTTP/2, TLS). Tạo một lần và dùng lại; client gRPC tạo từ channel thì nhẹ. Dùng `AddGrpcClient` của `Grpc.Net.ClientFactory`.
- Mỗi kết nối TLS mới tốn CPU cho handshake ở cả hai phía.

#### Trong báo cáo
- Phần IV: query 2 giây + pool 200 → 200 kết nối dồn vào SQL Server; query 2 ms → một kết nối phục vụ 500 request/giây, pool 50 đủ cho 25.000 request/giây. Kết luận của báo cáo: giữ nguyên pool, sửa query trước.
- `GrpcChannel` tạo mới mỗi request (Vấn đề 3); lỗi `Sockets.Connect failure` trong trace (Vấn đề 1).
- `PREEMPTIVE_OS_CRYPTOPS` 1,09 tỷ lượt chờ, báo cáo diễn giải là kết nối TLS bị mở lại liên tục (Cụm 2 – Mục 12).

#### Cách sửa
- Sửa query chậm và bỏ gọi ngoài trong lúc giữ kết nối để giảm W.
- `GrpcChannel` và `HttpClient` đăng ký qua factory, dùng lại.
- Mỗi ứng dụng một connection string chuẩn (có `Application Name`) để pool không bị chia nhỏ và dễ truy session.

#### Kiểm chứng
- Số kết nối active và số request chờ pool (counter của SqlClient) trong giờ cao điểm.
- Số session theo ứng dụng trong `sys.dm_exec_sessions`; `THREADPOOL` về 0.
- Số kết nối TCP mới mỗi giây và số socket TIME_WAIT trên máy app giảm sau khi dùng lại channel.

#### Bẫy
- Tăng `Max Pool Size` khi thấy lỗi hết pool mà chưa đo W.
- Dùng `async` nhưng chặn bằng `.Result`: thread của app bị giữ, request xếp hàng trước khi kịp lấy kết nối, trông như hết pool.
- `PREEMPTIVE_OS_CRYPTOPS` là wait khi SQL Server gọi API mã hoá của Windows; nó có thể đến từ TLS, nhưng cũng có thể từ các thao tác mã hoá khác. Cần đối chiếu với số login mỗi giây trước khi kết luận.

#### Câu hỏi phỏng vấn
- **"2.000 request/giây, mỗi request giữ kết nối 30 ms, pool tối thiểu bao nhiêu?"** 2.000 × 0,03 = 60 kết nối đồng thời trung bình. Chia cho số instance app, cộng dư cho lúc đỉnh. Nếu đang cần nhiều hơn thế, giảm 30 ms trước khi tăng pool.
- **"API lỗi timeout lấy kết nối từ pool, bạn có tăng Max Pool Size không?"** Chưa. Tôi đo thời gian giữ kết nối và tìm nguyên nhân: query chậm, rò rỉ kết nối, gọi dịch vụ ngoài khi đang giữ kết nối, sync-over-async. Tăng pool khi query còn chậm chỉ dồn thêm tải vào SQL Server và có thể dẫn tới `THREADPOOL`.
- **"Wait THREADPOOL trên SQL Server nghĩa là gì?"** SQL Server hết worker thread để gán cho request mới. Thường do quá nhiều truy vấn đồng thời bị chặn hoặc chạy lâu, hoặc song song quá mức. Xử lý gốc: blocking, truy vấn chậm, cost threshold; không tăng `max worker threads` như phản xạ đầu tiên.
- **"Vì sao không tạo HttpClient hoặc GrpcChannel mới cho mỗi request?"** Mỗi lần tạo là một kết nối TCP/TLS mới: tốn CPU cho handshake, socket TIME_WAIT tích tụ dẫn tới cạn cổng, mất lợi ích multiplexing của HTTP/2. Dùng `IHttpClientFactory` và channel singleton.
- **"Có 10 instance app, mỗi instance Max Pool Size 100, điều gì có thể xảy ra với SQL Server?"** Tổng có thể lên 1.000 kết nối và 1.000 truy vấn đồng thời khi tải đỉnh hoặc khi query chậm. Cần tính tổng theo số instance, kết hợp giới hạn đồng thời ở tầng app (bulkhead) để bảo vệ DB.

#### Tóm tắt
- Little's law: kết nối đang dùng = request/giây × thời gian giữ kết nối.
- Pool tách theo connection string; mặc định 100; hết pool thì chờ `Connect Timeout` rồi lỗi.
- Sửa query và giảm thời gian giữ kết nối trước khi tăng pool.
- Tổng kết nối tới DB = số instance × pool mỗi instance.
- `HttpClient`, `GrpcChannel` phải được dùng lại.

#### Bài tập
1. Tải đỉnh 6.000 request/giây chia đều cho 4 instance, mỗi request giữ kết nối 8 ms. Tính số kết nối trung bình mỗi instance và đề xuất `Max Pool Size`.
   **Đáp án:** Mỗi instance 1.500 × 0,008 = 12 kết nối trung bình. Tải không đều theo giây nên để dư nhiều lần, ví dụ 50; giữ mặc định 100 cũng không sao.
2. Đoạn code mở `SqlConnection`, chạy proc, gọi HTTP sang dịch vụ thông báo (200 ms) rồi mới đóng kết nối. Tải 300 request/giây. Tính số kết nối trước và sau khi chuyển lệnh HTTP ra ngoài, biết proc chạy 5 ms.
   **Đáp án:** Trước: 300 × 0,205 ≈ 62 kết nối. Sau: 300 × 0,005 = 1,5 kết nối. Giảm khoảng 40 lần chỉ bằng đổi chỗ một dòng code.
3. Viết câu T-SQL đếm số session theo ứng dụng và máy client.
   **Đáp án:** `SELECT program_name, host_name, COUNT(*) AS sessions FROM sys.dm_exec_sessions WHERE is_user_process = 1 GROUP BY program_name, host_name ORDER BY sessions DESC;`

### Bài 21.3. Không gọi server khác trong transaction

#### Mục tiêu
- Sau bài này, bạn giải thích được vì sao gọi linked server, HTTP hay gRPC bên trong transaction làm khoá bị giữ lâu.
- Bạn cài được outbox pattern để giữ nhất quán mà không cần distributed transaction.
- Bạn xử lý được truy vấn qua linked server bằng cách kéo dữ liệu vào `#temp` trước.

#### Cơ chế: khoá giữ tới khi transaction kết thúc
Trong một transaction, khoá ghi (X) và khoá `UPDLOCK` được giữ tới khi `COMMIT` hoặc `ROLLBACK`. Thời gian giữ khoá bằng tổng thời gian mọi thứ chạy bên trong transaction. Nếu bên trong có một lời gọi ra server khác mất 5 giây, mọi phiên muốn đụng vào các dòng đó phải chờ 5 giây, và các phiên chờ đó lại giữ khoá của chúng: blocking lan rộng thành chuỗi.

Linked server làm vấn đề nặng thêm:
- Gọi proc remote trong transaction local khiến transaction được nâng thành distributed transaction do MSDTC điều phối (theo mặc định của tuỳ chọn `remote proc transaction promotion`). Commit lúc này là two-phase commit qua mạng giữa hai server; một bên chậm hoặc mất kết nối thì bên kia giữ khoá chờ.
- Wait đặc trưng: `OLEDB` (SQL Server chờ provider OLE DB, tức chờ server kia trả lời), `MSQL_DQ` (chờ distributed query), các wait `DTC*`.
- Optimizer ước lượng kém cho bảng remote; toán tử Remote Query có thể kéo cả bảng về rồi mới lọc/join ở local.

#### Nguyên tắc transaction ngắn
Bên trong transaction chỉ có thao tác trên DB local, theo thứ tự truy cập bảng cố định. Không gọi HTTP, gRPC, linked server, không chờ người dùng, không gửi email, không ghi file. Đọc chuẩn bị (lấy cấu hình, kiểm tra quyền) làm trước khi `BEGIN TRAN`.

#### Outbox pattern
Vấn đề cần giải: ghi vật phẩm ở server A và ghi lịch sử ở server B phải "cùng thành công". Outbox giải bằng cách biến thao tác thứ hai thành thao tác local:
1. Trong cùng transaction local, ghi dữ liệu nghiệp vụ và ghi thêm một dòng vào bảng outbox (cùng DB). Hai thao tác này nguyên tử với nhau.
2. Một worker đọc outbox theo lô, gửi sang server B (proc, API hoặc message broker), đánh dấu đã gửi.
3. Phía nhận xử lý idempotent theo khoá duy nhất của sự kiện: nhận trùng thì bỏ qua.

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
```

```sql
-- Worker lấy lô chưa gửi, nhiều worker chạy song song không lấy trùng
SELECT TOP (500) Id, EventId, EventType, Payload
FROM dbo.Outbox WITH (UPDLOCK, READPAST, ROWLOCK)
WHERE SentAt IS NULL
ORDER BY Id;
```

Giao hàng là at-least-once: worker có thể gửi xong nhưng chết trước khi đánh dấu, lần sau gửi lại. Vì vậy phía nhận phải có unique key trên `EventId` (inbox) hoặc kiểm tra tồn tại trước khi ghi. Đánh đổi: dữ liệu ở server B trễ vài giây; cần job dọn outbox đã gửi và cảnh báo khi outbox tồn đọng.

#### Kéo dữ liệu remote vào #temp
Khi buộc phải đọc qua linked server, chạy một truy vấn remote có lọc sẵn, đưa kết quả vào `#temp` có primary key, rồi join ở local:

```sql
CREATE TABLE #Q (QuestionId int PRIMARY KEY, Level tinyint);
INSERT #Q (QuestionId, Level)
EXEC ('SELECT QuestionId, Level FROM dbo.Question WHERE SubjectId = ?', @SubjectId) AT [REMOTE_BANK];
-- join #Q với bảng local; optimizer có số dòng thật và statistics trên #Q
```

`EXEC ... AT` gửi nguyên câu lệnh cho server kia thực thi, nên bộ lọc chạy ở phía remote. Cần bật `rpc out` cho linked server.

#### Trong báo cáo
- Proc cập nhật vật phẩm người dùng (220,6 triệu lần, tối đa 29.997 ms): trong `BEGIN TRAN` gọi proc ghi lịch sử ở server giao dịch qua linked server, kèm khoá `UPDLOCK`; server kia chậm thì transaction treo (Cụm 2 – Mục 1).
- `MSQL_DQ` 21,51% + `OLEDB` 16,88% = 38,4% thời gian chờ của cụm core (Cụm 2 – Mục 7).
- Job sinh đề thi thử: Remote Query đọc 176,5 triệu trang mỗi lần chạy (Cụm 6 – Mục 7).

#### Cách sửa
- Đưa lệnh ghi lịch sử ra khỏi transaction bằng outbox; worker gửi sang server giao dịch.
- Job sinh đề: kéo đúng tập câu hỏi cần vào `#temp` bằng `EXEC ... AT`, hoặc đồng bộ kho câu hỏi về local bằng replication nếu dùng thường xuyên.

#### Kiểm chứng
- Thời gian tối đa của proc vật phẩm giảm (không còn mốc gần 30 giây, sát timeout).
- `OLEDB`, `MSQL_DQ` giảm trong wait stats; blocking chain do proc này biến mất.
- Độ trễ outbox (thời gian từ `CreatedAt` tới `SentAt`) trong ngưỡng cam kết.

#### Bẫy
- Wait `OLEDB` không chỉ do linked server; một số DMV và `DBCC CHECKDB` cũng sinh wait này. Đối chiếu với truy vấn đang chạy trước khi quy hết cho linked server.
- Outbox không có idempotency phía nhận thì gửi lại sẽ sinh bản ghi trùng.
- Bỏ transaction hẳn để "nhanh" thì mất nhất quán: hai thao tác local vẫn phải nằm trong một transaction.

#### Câu hỏi phỏng vấn
- **"Tách lệnh ghi lịch sử ra khỏi transaction thì có mất nhất quán không?"** Không nếu dùng outbox: dòng lịch sử ghi vào bảng outbox local trong cùng transaction nên nguyên tử với cập nhật vật phẩm; worker gửi sang server kia sau, idempotent theo khoá sự kiện. Đánh đổi là nhất quán trễ vài giây.
- **"Vì sao gọi linked server trong transaction nguy hiểm hơn gọi ngoài transaction?"** Khoá local được giữ suốt thời gian chờ server kia; transaction có thể bị nâng thành distributed transaction với two-phase commit qua MSDTC. Server kia chậm hoặc mất mạng thì blocking lan ra mọi phiên đụng tới các dòng đó.
- **"Outbox đảm bảo giao hàng mức nào và phía nhận cần làm gì?"** At-least-once: có thể gửi trùng khi worker chết giữa chừng. Phía nhận phải idempotent, ví dụ unique key trên `EventId` hoặc bảng inbox ghi nhận sự kiện đã xử lý.
- **"Truy vấn qua linked server đọc 176 triệu trang, bạn xử lý thế nào?"** Xem plan: Remote Query kéo cả bảng về để join local. Đẩy bộ lọc sang phía remote bằng `EXEC ... AT` hoặc `OPENQUERY`, đưa kết quả nhỏ vào `#temp` có PK rồi join. Dùng thường xuyên thì đồng bộ dữ liệu về local.
- **"Nhiều worker cùng đọc bảng outbox, làm sao không xử lý trùng?"** Lấy lô với `UPDLOCK, READPAST, ROWLOCK` trong transaction ngắn để mỗi worker bỏ qua dòng đang bị worker khác khoá; hoặc cập nhật trạng thái "đang xử lý" kèm `OUTPUT` để nhận đúng các dòng mình đã giành.

#### Tóm tắt
- Khoá giữ tới hết transaction; mọi thứ chậm bên trong transaction đều kéo dài khoá.
- Linked server trong transaction dễ thành distributed transaction và sinh `OLEDB`, `MSQL_DQ`.
- Outbox: ghi sự kiện vào bảng local trong cùng transaction, worker gửi sau, phía nhận idempotent.
- Đọc remote: lọc ở phía remote, đưa vào `#temp` có PK rồi join.

#### Bài tập
1. Viết lại luồng: `BEGIN TRAN; UPDATE vật phẩm; EXEC [server khác].proc_ghi_lich_su; COMMIT;` theo outbox, nêu các bảng và job cần có.
   **Đáp án:** Bảng `Outbox(Id identity, EventId uniqueidentifier unique, EventType, Payload, CreatedAt, SentAt)`; transaction chỉ gồm `UPDATE` + `INSERT Outbox`; job/worker đọc lô `SentAt IS NULL` với `UPDLOCK, READPAST`, gọi proc ở server kia, cập nhật `SentAt`; phía server kia có unique key trên `EventId`; job dọn outbox cũ; cảnh báo khi tồn đọng.
2. Proc dùng linked server đọc 3 cột từ bảng 50 triệu dòng rồi join với bảng local theo `SubjectId`. Viết lại để bộ lọc chạy ở remote.
   **Đáp án:** Tạo `#temp` có PK; `INSERT #temp EXEC ('SELECT ... WHERE SubjectId = ?', @SubjectId) AT [REMOTE]`; join `#temp` với bảng local.
3. Kể ba thứ không được nằm trong transaction.
   **Đáp án:** Gọi HTTP/gRPC, gọi linked server, chờ thao tác người dùng; ngoài ra gửi email, ghi file, sleep/retry dài.

### Bài 21.4. Tách đọc và ghi

#### Mục tiêu
- Sau bài này, bạn phân loại được bảng theo cách truy cập để quyết định tách đọc hay không.
- Bạn so sánh được transactional replication, Always On readable secondary, log shipping standby và CDC.
- Bạn biết RCSI giải quyết gì và tốn gì.

#### Vì sao tách
Luồng ghi nóng (lưu đáp án trong giờ thi) cần ít index để insert nhanh và cần CPU, worker luôn sẵn. Truy vấn báo cáo, CMS, tra cứu khiếu nại cần nhiều index và quét nhiều dữ liệu. Chạy chung một server thì hai nhu cầu xung đột: thêm index cho báo cáo làm chậm ghi; truy vấn báo cáo chiếm worker và memory grant làm luồng thi phải chờ.

Báo cáo nội bộ chia bảng thành ba nhóm theo cách truy cập:
1. **Thuần ghi**: log hành vi, log đáp án. Hầu như chỉ insert, đọc lại khi tra cứu.
2. **Ghi dồn rồi đọc tổng kết**: ghi trong ca thi, sau ca chạy tổng hợp.
3. **Đọc-ghi trên đường nóng**: trạng thái bài làm, số lượt; vừa đọc vừa ghi trong luồng thi, không tách được.

Nhóm 1 và 2 là ứng viên tách đọc sang server khác. Nhóm 3 ở lại primary và tối ưu bằng index đúng, RCSI, dòng nóng (bài 23.1).

#### Các lựa chọn
| Cách | Bản chất | Index ở bản đọc | Độ trễ | Ghi chú |
|---|---|---|---|---|
| Transactional replication | Bản sao logic: Log Reader đọc log, Distributor áp lệnh lên subscriber | Độc lập, tạo index riêng được | Giây | Bảng publish phải có primary key |
| Always On readable secondary | Bản sao vật lý: gửi log và redo | Giống hệt primary | Giây (đồng bộ dữ liệu), redo có thể trễ | Cần Enterprise; Basic AG ở Standard không đọc được |
| Log shipping standby | Restore log định kỳ ở chế độ STANDBY | Giống hệt primary | Phút | Người đọc bị ngắt khi restore |
| CDC → warehouse/ETL | Ghi nhận thay đổi vào bảng change, ETL nạp sang kho | Tự thiết kế | Phút | Hợp cho kho phân tích |

Điểm mấu chốt: replication là bản sao logic nên subscriber có schema và index riêng, hợp khi primary muốn ít index còn báo cáo cần nhiều index. Readable secondary là bản sao vật lý nên không tạo được index riêng; statistics phụ trên secondary chỉ là statistics tạm trong tempdb.

Readable secondary tự dùng snapshot isolation cho truy vấn đọc, nên primary phải thêm 14 byte version tag vào dòng khi bị sửa. Điều hướng đọc: connection string có `ApplicationIntent=ReadOnly` trỏ vào listener, cấu hình read-only routing.

```text
Server=tcp:exam-listener,1433;Database=ExamLog;ApplicationIntent=ReadOnly;MultiSubnetFailover=True;Application Name=ExamReport
```

#### Chấp nhận dữ liệu cũ
Mọi cách tách đọc đều có độ trễ đồng bộ. Phải thống nhất với nghiệp vụ: màn hình nào chấp nhận dữ liệu cũ vài giây (báo cáo, thống kê), màn hình nào phải đọc primary (kết quả vừa nộp của chính người dùng: read-your-writes). Ứng dụng cần hai connection string và quy tắc chọn rõ ràng, có metric độ trễ đồng bộ.

#### RCSI trên primary
Read Committed Snapshot Isolation: ở mức READ COMMITTED, thay vì chờ khoá chia sẻ, câu đọc nhận phiên bản dòng đã commit tại thời điểm câu lệnh bắt đầu. Đọc không chặn ghi, ghi không chặn đọc.

```sql
ALTER DATABASE ExamLog SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
```

Chi phí: version store trong tempdb (hoặc persistent version store trong DB khi bật Accelerated Database Recovery), 14 byte mỗi dòng bị sửa, thêm I/O cho tempdb. Rủi ro logic: code dựa vào việc đọc bị chặn để tuần tự hoá (đọc số dư rồi cập nhật) có thể sai; đoạn đó cần `UPDLOCK` hoặc cập nhật có điều kiện.

#### Trong báo cáo
- Phần VI: primary giữ bảng log không index phụ để insert dưới 0,5 ms; replica ở cụm kho dữ liệu có index cho CMS, báo cáo, tra cứu khiếu nại.
- `THREADPOOL` ở cụm log thi chính thức vì truy vấn báo cáo chạy chung server với luồng thi (Cụm 3 – Mục 5).
- Báo cáo đề xuất partition theo ca thi cho bảng log.

#### Cách sửa
- Bảng nhóm 1 và 2 publish sang cụm kho dữ liệu bằng transactional replication; index cho báo cáo tạo ở subscriber.
- Truy vấn báo cáo, CMS chuyển sang connection string trỏ subscriber.
- Thêm metric độ trễ replication (tracer token, hoặc so sánh thời điểm dòng mới nhất).

#### Kiểm chứng
- `THREADPOOL` trên primary về 0 trong giờ thi; thời gian insert log giữ dưới 0,5 ms.
- Truy vấn báo cáo trên subscriber đạt mục tiêu reads/lần.

#### Bẫy
- Transactional replication yêu cầu bảng được publish có primary key. Báo cáo khuyên giữ heap trên primary rồi publish: phải thêm PK (ví dụ clustered trên cột identity) trước.
- Coi readable secondary là "miễn phí": nó cần license Enterprise và tạo version tag trên primary.
- Không xử lý read-your-writes: người dùng vừa nộp bài, màn hình đọc từ replica chưa thấy kết quả.

#### Câu hỏi phỏng vấn
- **"Readable secondary của Always On khác transactional replication thế nào cho bài toán này?"** Secondary là bản sao vật lý: index giống hệt primary, không tạo index riêng được, cần Enterprise. Replication là bản sao logic: subscriber có index và schema riêng, hợp khi primary muốn ít index còn báo cáo cần nhiều index; đổi lại cần PK và vận hành Distributor.
- **"Tách đọc sang replica thì xử lý màn hình xem kết quả vừa nộp thế nào?"** Màn hình đó đọc primary (read-your-writes), hoặc ứng dụng nhớ thời điểm ghi và chỉ đọc replica khi độ trễ đồng bộ nhỏ hơn khoảng thời gian đã trôi qua. Báo cáo tổng hợp thì đọc replica.
- **"Bật RCSI thì được gì, mất gì?"** Được: đọc không chờ khoá ghi, giảm blocking và deadlock đọc-ghi. Mất: version store trong tempdb, 14 byte mỗi dòng bị sửa, transaction dài giữ version store. Code tuần tự hoá dựa trên đọc bị chặn phải chuyển sang `UPDLOCK` hoặc cập nhật có điều kiện.
- **"Bảng nào không nên tách sang replica?"** Bảng đọc-ghi trên đường nóng, nơi người dùng cần thấy ngay giá trị vừa ghi (trạng thái bài làm, số lượt còn lại). Tách sẽ đọc phải dữ liệu cũ; tối ưu tại primary.

#### Tóm tắt
- Phân loại bảng theo cách truy cập trước khi chọn kiến trúc.
- Replication: bản sao logic, index riêng, cần PK. Readable secondary: bản sao vật lý, index giống primary, cần Enterprise.
- Mọi cách tách đọc đều trễ; xác định màn hình nào phải đọc primary.
- RCSI cho đọc không chặn ghi, trả bằng version store.

#### Bài tập
1. Phân loại ba bảng: log đáp án từng câu, bảng điểm tổng kết sau ca, bảng trạng thái phiên làm bài. Đề xuất nơi đọc cho từng bảng.
   **Đáp án:** Log đáp án: thuần ghi, tra cứu trên subscriber. Điểm tổng kết: ghi dồn rồi đọc, báo cáo trên subscriber, màn hình kết quả cá nhân ngay sau ca có thể đọc primary. Trạng thái phiên: đọc-ghi nóng, ở primary.
2. Viết lệnh thêm clustered primary key cho một heap log có cột `Id bigint identity` trước khi publish.
   **Đáp án:** `ALTER TABLE dbo.AnswerLog ADD CONSTRAINT PK_AnswerLog PRIMARY KEY CLUSTERED (Id) WITH (ONLINE = ON);` (`ONLINE` chỉ có ở Enterprise; ở Standard chạy trong khung bảo trì).
3. Đọc số dư rồi cập nhật trong hai câu lệnh riêng; sau khi bật RCSI, nêu rủi ro và cách sửa.
   **Đáp án:** Hai phiên cùng đọc số dư cũ rồi cùng trừ, gây âm. Sửa bằng một câu cập nhật có điều kiện `UPDATE ... SET Balance = Balance - @x WHERE Id = @id AND Balance >= @x` và kiểm tra `@@ROWCOUNT`, hoặc đọc với `UPDLOCK`.

### Bài 21.5. Xử lý lỗi và giám sát không làm hại DB

#### Mục tiêu
- Sau bài này, bạn nhận ra code nuốt exception ở C# và T-SQL, và sửa để lỗi lộ ra đúng chỗ.
- Bạn kiểm tra được sự khớp kiểu dữ liệu giữa entity C#, tham số và cột SQL.
- Bạn đánh giá được chi phí của công cụ giám sát và đặt cảnh báo theo SLO.

#### Không nuốt exception
Nuốt exception là bắt lỗi rồi trả về giá trị trông như bình thường:

```csharp
// Sai: lỗi DB biến thành "không có ai trong bảng xếp hạng"
public async Task<List<RankItem>> GetRankAsync(long userId)
{
    try { return await _repo.GetRankAsync(userId); }
    catch { return new List<RankItem>(); }
}
```

Hậu quả: người dùng thấy dữ liệu sai thay vì thông báo lỗi; metric tỉ lệ lỗi của API vẫn xanh; nếu có cache phía trên, kết quả rỗng còn bị lưu lại. Cách đúng: chỉ bắt exception khi có hành động cụ thể (retry lỗi tạm thời, chuyển sang dữ liệu dự phòng có đánh dấu), luôn ghi log có ngữ cảnh, và để phần còn lại lan lên middleware xử lý lỗi chung.

```csharp
catch (SqlException ex) when (ex.Number is 1205 or -2)   // deadlock victim, timeout
{
    _logger.LogWarning(ex, "Rank query failed for {UserId}", userId);
    throw;                                                // để retry policy hoặc middleware xử lý
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
    -- ghi bảng log lỗi nếu cần (sau ROLLBACK để không bị rollback theo)
    THROW;
END CATCH;
```

`XACT_ABORT ON` đảm bảo khi có lỗi (kể cả client timeout huỷ lệnh), transaction bị rollback thay vì để lại transaction mở giữ khoá.

#### Kiểu dữ liệu khớp nhau
- Entity C# dùng `long`, tham số proc là `INT`: khi ID vượt 2.147.483.647, gọi proc lỗi tràn số. Ngược lại, tham số khai báo sai kiểu so với cột gây implicit conversion; nặng nhất là `nvarchar` so với cột `varchar` trong collation SQL, khiến index seek thành scan.
- Cột hạng kiểu `int` trong DB nhưng `string` trong entity: sắp xếp theo chuỗi ("10" đứng trước "9"), tốn chuyển đổi, lỗi khó thấy.
- Khai báo kiểu tham số tường minh (`SqlDbType.BigInt`, `SqlDbType.VarChar` có độ dài) thay vì `AddWithValue`, vì `AddWithValue` suy kiểu từ giá trị .NET (chuỗi luôn thành `nvarchar` với độ dài theo giá trị, làm plan cache bị nhân bản theo độ dài).

Kiểm tra implicit conversion trong plan cache: tìm cảnh báo `PlanAffectingConvert` trong XML plan, hoặc dùng `sp_BlitzCache` (cột Warnings).

#### Giám sát cũng là tải
Công cụ giám sát poll DMV mỗi vài giây trên mọi DB, gọi `xp_*` để đọc thông tin hệ điều hành, đọc plan cache đầy đủ: tất cả đều chạy trên chính server đang giám sát. Câu DMV nặng (quét `sys.dm_exec_query_stats` kèm `sys.dm_exec_query_plan` cho mọi dòng) có thể tốn nhiều CPU và memory grant. Nguyên tắc: chu kỳ poll hợp lý (30–60 giây cho số liệu tổng, lâu hơn cho plan cache), dùng Query Store và Extended Events (ghi vào file, lọc chặt) thay cho poll liên tục, đo chính công cụ giám sát như một ứng dụng (lọc theo `program_name`).

#### Cảnh báo theo SLO
Cảnh báo tốt cho biết người dùng đang bị ảnh hưởng hoặc sắp bị ảnh hưởng, không phải mọi chỉ số vượt ngưỡng:
- Theo SLO: tỉ lệ lỗi, p95/p99 latency của API quan trọng, cảnh báo theo burn rate (tốc độ tiêu error budget, bài 23.7).
- Theo tài nguyên sắp cạn: % log đã dùng, dung lượng ổ, tuổi bản backup log gần nhất, độ trễ replication, tồn đọng outbox.
- Theo bất thường: wait type mới xuất hiện hoặc tăng đột biến so với cùng giờ tuần trước; tỉ lệ response rỗng của API tăng bất thường (phát hiện lỗi bị nuốt).

#### Trong báo cáo
- Hai lớp proxy C# bắt exception rồi trả null hoặc danh sách rỗng; bảng log lỗi không ghi nhận gì (Cụm 4 – Mục 11).
- Tham số user kiểu `INT` trong proc nhưng `long` trong entity; cột hạng `int` trong DB nhưng `string` trong entity (Cụm 4 – Mục 11).
- Công cụ giám sát: `MSQL_XP` 658.519 giây, `RESOURCE_SEMAPHORE_MUTEX` 33.739 giây; báo cáo coi chỉnh lại công cụ giám sát là việc có tác động lớn nhất ở cụm này (Cụm 3 – Mục 10).

#### Cách sửa
- Bỏ `catch` trả rỗng ở proxy; ghi log có ngữ cảnh; để middleware trả lỗi chuẩn.
- Đổi tham số proc sang `BIGINT`, entity hạng sang `int`; rà soát kiểu tham số toàn bộ proc của luồng đó.
- Giảm chu kỳ poll, tắt collector gọi `xp_*` không cần, chuyển sang Query Store/Extended Events.

#### Kiểm chứng
- Tỉ lệ lỗi của API xếp hạng có số liệu thật (có thể tăng lúc đầu: đó là lỗi trước đây bị giấu); tỉ lệ response rỗng giảm.
- `MSQL_XP` giảm; CPU do phiên của công cụ giám sát (`program_name`) giảm.

#### Bẫy
- Bỏ nuốt exception mà không có middleware xử lý lỗi: người dùng nhận stack trace.
- Retry mọi `SqlException`: lỗi logic (vi phạm khoá, dữ liệu sai) retry chỉ nhân tải. Chỉ retry lỗi tạm thời (deadlock 1205, timeout, lỗi kết nối, failover).
- Ghi bảng log lỗi trước `ROLLBACK` trong `CATCH`: dòng log bị rollback cùng transaction.

#### Câu hỏi phỏng vấn
- **"API xếp hạng trả danh sách rỗng trong giờ thi mà log không có lỗi, bạn điều tra từ đâu?"** Nghi exception bị nuốt: tìm `catch` trả rỗng ở proxy và `BEGIN CATCH` không `THROW` trong proc. Đo tỉ lệ response rỗng theo thời gian, đối chiếu với giờ cao điểm. Kiểm tra timeout, deadlock trong session `system_health`.
- **"Vì sao không nên dùng AddWithValue cho tham số SQL?"** Nó suy kiểu từ giá trị .NET: chuỗi thành `nvarchar` có độ dài theo giá trị, gây implicit conversion với cột `varchar` (có thể mất index seek) và sinh nhiều plan theo độ dài khác nhau. Khai báo `SqlDbType` và độ dài tường minh.
- **"SET XACT_ABORT ON có tác dụng gì trong proc?"** Khi có lỗi runtime, kể cả client timeout huỷ lệnh, transaction bị rollback toàn bộ thay vì để lại transaction mở giữ khoá. Kết hợp `TRY/CATCH` với `ROLLBACK` và `THROW`.
- **"Làm sao biết công cụ giám sát đang làm hại DB?"** Lọc phiên theo `program_name` của công cụ, đo CPU, reads và wait của chúng (`MSQL_XP` khi gọi `xp_*`); xem chu kỳ poll và câu DMV nặng. Giám sát cũng là một ứng dụng, phải nằm trong ngân sách tải.
- **"Bạn đặt những cảnh báo nào cho một DB phục vụ kỳ thi?"** Theo SLO: tỉ lệ lỗi và p99 của API nộp bài, lấy đề. Theo tài nguyên: % log, dung lượng ổ, tuổi backup log, độ trễ replication. Theo bất thường: blocking kéo dài, wait mới tăng đột biến, tỉ lệ response rỗng.

#### Tóm tắt
- Nuốt exception biến lỗi thành dữ liệu sai và làm metric lỗi vô nghĩa.
- T-SQL: `XACT_ABORT ON`, `TRY/CATCH` với `ROLLBACK` và `THROW`.
- Kiểu dữ liệu phải khớp từ entity tới tham số tới cột; khai báo `SqlDbType` tường minh.
- Công cụ giám sát là tải thật; đo và giới hạn nó.
- Cảnh báo theo SLO và tài nguyên sắp cạn, không theo mọi chỉ số.

#### Bài tập
1. Viết lại khối `BEGIN CATCH SELECT -1 AS Result END CATCH` cho đúng, có ghi log lỗi.
   **Đáp án:** `BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; INSERT dbo.ErrorLog (...) VALUES (ERROR_NUMBER(), ERROR_MESSAGE(), ERROR_PROCEDURE(), SYSUTCDATETIME()); THROW; END CATCH`, kèm `SET XACT_ABORT ON` ở đầu proc.
2. Entity có `long UserId`, proc nhận `@UserId INT`, cột là `BIGINT`. Nêu hai vấn đề và cách sửa.
   **Đáp án:** ID vượt giới hạn `int` thì lỗi tràn số khi gọi proc; giá trị đã bị ép kiểu trước khi so với cột. Sửa tham số proc sang `BIGINT`, khai báo `SqlDbType.BigInt` ở C#.
3. Liệt kê các mã lỗi SQL Server nên retry và các mã không nên retry.
   **Đáp án:** Nên retry: 1205 (deadlock victim), timeout phía client, lỗi kết nối tạm thời, lỗi failover AG. Không retry: 2627/2601 (trùng khoá), 547 (vi phạm ràng buộc), 8115 (tràn số), lỗi do `THROW` nghiệp vụ.

## Chương 22. Đọc báo cáo bằng con mắt senior
Báo cáo hiệu năng APM nội bộ làm tốt một việc mà nhiều báo cáo bỏ qua: mỗi đề xuất gắn với số đo và tiêu chí nghiệm thu cụ thể ("spill phải về 0", "reads dưới 20.000 trang/lần"). Nhưng một báo cáo dài, viết trên hàng chục DB, chắc chắn có chỗ kết luận vượt quá số liệu, hoặc đề xuất đúng về kỹ thuật nhưng sai về rủi ro.

Ở vòng phỏng vấn senior, kể "đã sửa gì" chưa đủ. Interviewer muốn thấy bạn biết nghi ngờ đúng chỗ: số liệu này đo cái gì, kết luận này đúng trong điều kiện nào, đề xuất này có thể gây hại ra sao, và bạn kiểm chứng bằng cách nào. Chương này gom các điểm phản biện rải rác trong Phần VI thành phương pháp, rồi luyện cách sắp thứ tự ưu tiên và trình bày.

Học xong chương này, bạn đọc một báo cáo hiệu năng và chỉ ra được các chỗ cần kiểm chứng lại, đề xuất được thứ tự triển khai có rủi ro thấp, và kể lại câu chuyện tối ưu một cách trung thực, có số.

### Bài 22.1. Phản biện số liệu và kết luận trong báo cáo hiệu năng

#### Mục tiêu
- Sau bài này, bạn áp dụng được bốn câu hỏi kiểm tra cho mọi kết luận trong báo cáo hiệu năng.
- Bạn chỉ ra được các chỗ kết luận có thể sai trong báo cáo nội bộ và nêu cách kiểm chứng từng chỗ.
- Bạn phân biệt được số liệu tích luỹ, số liệu theo khoảng thời gian và số liệu đã lọc nhiễu.

#### Bốn câu hỏi cho mọi kết luận
1. **Số này đo cái gì, ở đâu, trong khoảng thời gian nào?** Wait stats trong `sys.dm_os_wait_stats` tích luỹ từ lần khởi động cuối; server chạy 200 ngày thì "3,58 triệu giây `WRITELOG`" là tổng 200 ngày, không phải tình trạng hiện tại. Số đúng để ra quyết định là chênh lệch giữa hai lần chụp trong giờ cao điểm.
2. **Đơn vị đếm có đúng như người viết hiểu không?** Một dòng DMV có thể là một câu lệnh, một plan, hay một proc; lượt chờ khác thời gian chờ.
3. **Kết luận đúng trong điều kiện nào?** Phiên bản, edition, compatibility level, recovery model, cấu hình.
4. **Đề xuất có thể gây hại gì, và rollback thế nào?** Mọi thay đổi phải có rủi ro được nêu và đường lui.

#### Các điểm cần phản biện trong báo cáo
Mỗi điểm dưới đây có bài chi tiết trong Phần VI; ở đây gom lại theo bốn câu hỏi.

**Đơn vị đếm.**
- Nhiều dòng trong `sys.dm_exec_query_stats` cho cùng một proc chưa chắc là nhiều plan. View này có một dòng cho mỗi câu lệnh trong mỗi plan; proc 12 câu lệnh có 12 dòng cùng một `plan_handle`. Muốn biết số plan, đếm `DISTINCT plan_handle`; muốn biết lý do có nhiều plan, xem `sys.dm_exec_plan_attributes` (khác `set_options`, khác user mặc định schema...).
- Lượt chờ khác thời gian chờ: 460 triệu lượt `CXCONSUMER` chỉ nói có nhiều trao đổi song song, không nói chúng tốn bao lâu.

**Nhiễu nền.**
- `QDS_ASYNC_QUEUE` (Query Store ghi dữ liệu nền), `WAIT_XTP_HOST_WAIT` (In-Memory OLTP chờ nền) và nhiều wait khác như `SLEEP_TASK`, `LAZYWRITER_SLEEP`, `XE_TIMER_EVENT` là wait nền, cần lọc trước khi tính phần trăm. Không lọc thì phần trăm của các wait thật bị pha loãng hoặc bảng xếp hạng bị đẩy lệch. Script wait stats của Paul Randal có sẵn danh sách lọc.
- `OLEDB` không chỉ do linked server; một số DMV và `DBCC CHECKDB` cũng sinh wait này.

**Điều kiện phiên bản, edition, cấu hình.**
- Ngưỡng tự cập nhật statistics phụ thuộc compatibility level: từ compat 130 dùng ngưỡng động khoảng căn bậc hai của (1.000 × số dòng) cho bảng lớn; compat thấp hơn dùng 500 + 20% số dòng (trừ khi bật trace flag 2371). Kết luận "statistics bảng 100 triệu dòng chỉ cập nhật sau 20 triệu thay đổi" chỉ đúng với compat dưới 130.
- Bảng biến trên SQL Server 2019 với compat 150 trở lên đã được ước lượng đúng tổng số dòng nhờ table variable deferred compilation, nhưng vẫn không có histogram, nên phân bố giá trị vẫn sai. Kết luận "bảng biến luôn ước lượng 1 dòng" là cũ.
- `ONLINE = ON` khi tạo hay rebuild index chỉ có ở Enterprise (và Developer, Azure SQL). Đề xuất "rebuild online trong giờ hành chính" cần kiểm tra edition trước.

**Rủi ro của đề xuất.**
- Chuyển recovery model sang SIMPLE hàng loạt phải hỏi RPO trước: DB thanh toán, kết quả thi mất khả năng khôi phục tới thời điểm (bài 20.2).
- Clustered key identity bỏ được page split giữa trang nhưng tạo điểm nóng ở trang cuối (last page insert contention, wait `PAGELATCH_EX`) khi insert đồng thời cao. SQL Server 2019 có `OPTIMIZE_FOR_SEQUENTIAL_KEY` để giảm vấn đề này.
- `OPTION (RECOMPILE)` sửa parameter sniffing nhưng biên dịch lại mỗi lần chạy; proc gọi hàng triệu lần mỗi ngày sẽ tốn CPU đáng kể. Cần đo CPU biên dịch hoặc chọn cách khác (`OPTIMIZE FOR`, tách proc, PSP optimization của SQL Server 2022).
- Transactional replication yêu cầu bảng publish có primary key; đề xuất "giữ heap trên primary rồi publish" phải thêm PK trước (bài 21.4).
- Diễn giải nguyên nhân từ một wait duy nhất (ví dụ quy `PREEMPTIVE_OS_CRYPTOPS` hoàn toàn cho TLS) cần đối chiếu thêm số liệu khác (số login mỗi giây, cấu hình mã hoá).

#### Chụp wait stats theo khoảng thời gian
Cách lấy số liệu đáng tin hơn số tích luỹ:

```sql
SELECT wait_type, waiting_tasks_count, wait_time_ms, signal_wait_time_ms
INTO #w1 FROM sys.dm_os_wait_stats;

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

#### Trong báo cáo
- Báo cáo gắn đề xuất với tiêu chí nghiệm thu đo được: "spill phải về 0", "reads dưới 20.000 trang/lần". Đây là điểm mạnh nên giữ khi bạn viết báo cáo của mình.
- Các điểm phản biện ở trên lấy từ các mục: chuyển SIMPLE ở cụm có DB thanh toán (Cụm 6), heap publish qua replication (Phần VI), `PREEMPTIVE_OS_CRYPTOPS` (Cụm 2 – Mục 12), `CXCONSUMER` (Cụm 1 – Mục 9).

#### Cách sửa
- Với mỗi kết luận quan trọng, ghi kèm: nguồn số liệu, khoảng thời gian, phiên bản/edition/compat, và cách kiểm chứng lại.
- Thay số tích luỹ bằng số theo khoảng thời gian trong giờ cao điểm trước khi xếp hạng vấn đề.

#### Kiểm chứng
- Mỗi điểm phản biện có một truy vấn kiểm chứng: `SELECT compatibility_level FROM sys.databases`, `SELECT SERVERPROPERTY('Edition')`, `COUNT(DISTINCT plan_handle)`, wait stats theo khoảng.

#### Bẫy
- Phản biện để thắng tranh luận thay vì để ra quyết định đúng. Mỗi điểm phản biện nên kết thúc bằng "kiểm chứng bằng cách...".
- Bác bỏ cả báo cáo vì vài chỗ sai: phần lớn đề xuất vẫn đúng; chỉ điều chỉnh các mục có điều kiện.

#### Câu hỏi phỏng vấn
- **"Báo cáo ghi WRITELOG 3,58 triệu giây, bạn có kết luận ổ log đang chậm không?"** Chưa. Đó là số tích luỹ từ lần khởi động; tôi chụp chênh lệch trong giờ cao điểm, tính thời gian chờ trung bình mỗi lượt và đo độ trễ ghi file log bằng `sys.dm_io_virtual_file_stats`. Trung bình vài ms là bình thường; vài chục ms mới là ổ hoặc cấu hình có vấn đề.
- **"Một proc có 15 dòng trong dm_exec_query_stats, có phải nó có 15 plan không?"** Không chắc. View có một dòng cho mỗi câu lệnh trong mỗi plan. Đếm `DISTINCT plan_handle` để biết số plan; nếu thật sự nhiều plan, xem `sys.dm_exec_plan_attributes` để biết thuộc tính nào khác nhau.
- **"Báo cáo nói statistics bảng 100 triệu dòng chỉ tự cập nhật sau 20 triệu thay đổi, bạn phản biện thế nào?"** Ngưỡng 20% chỉ áp dụng cho compat dưới 130 không bật trace flag 2371. Từ compat 130 dùng ngưỡng động khoảng căn bậc hai của 1.000 × số dòng, tức khoảng 316.000 thay đổi. Kiểm tra compat level của DB trước khi kết luận.
- **"Đề xuất rebuild index với ONLINE = ON trong giờ hành chính có vấn đề gì?"** `ONLINE = ON` chỉ có ở Enterprise; trên Standard lệnh lỗi hoặc phải chạy offline, khoá bảng. Ngay cả trên Enterprise, online rebuild vẫn cần khoá ngắn đầu và cuối, tốn version store và log. Kiểm tra edition, chạy trong khung thấp tải.
- **"Bạn phản biện thế nào khi báo cáo đề xuất OPTION (RECOMPILE) cho proc gọi hàng triệu lần mỗi ngày?"** Nó sửa parameter sniffing nhưng biên dịch lại mỗi lần chạy. Tôi ước lượng CPU biên dịch (thời gian biên dịch × số lần gọi), so với lợi ích; cân nhắc `OPTIMIZE FOR`, tách proc theo nhánh, Query Store hint, hoặc PSP optimization trên SQL Server 2022.
- **"Wait stats nào bạn lọc bỏ trước khi phân tích, và vì sao?"** Wait nền như `SLEEP_TASK`, `LAZYWRITER_SLEEP`, `XE_TIMER_EVENT`, `QDS_ASYNC_QUEUE`, `WAIT_XTP_HOST_WAIT`. Chúng tăng đều kể cả khi server rảnh, không phản ánh chờ của truy vấn người dùng; không lọc thì tỉ lệ phần trăm sai lệch.

#### Tóm tắt
- Bốn câu hỏi: đo cái gì và trong bao lâu; đơn vị đếm; điều kiện đúng; rủi ro và rollback.
- Wait stats tích luỹ từ lúc khởi động; dùng chênh lệch theo khoảng trong giờ cao điểm, đã lọc wait nền.
- Nhiều kết luận phụ thuộc phiên bản, edition, compatibility level: kiểm tra trước.
- Mỗi điểm phản biện kết thúc bằng cách kiểm chứng.

#### Bài tập
1. Viết ba câu truy vấn kiểm tra điều kiện trước khi chấp nhận các đề xuất về statistics, `ONLINE = ON` và recovery model.
   **Đáp án:** `SELECT name, compatibility_level, recovery_model_desc FROM sys.databases;`, `SELECT SERVERPROPERTY('Edition'), SERVERPROPERTY('ProductVersion'), SERVERPROPERTY('ProductUpdateLevel');`, và hỏi RPO của từng DB (không truy vấn được, phải hỏi nghiệp vụ).
2. Báo cáo nói `CXCONSUMER` 460 triệu lượt là vấn đề lớn nhất của cụm. Viết lại nhận định này cho chính xác.
   **Đáp án:** "Cụm có nhiều truy vấn chạy song song (460 triệu lượt `CXCONSUMER`, wait thường vô hại). Cần đo `CXPACKET` theo thời gian chờ trong giờ cao điểm và xác định truy vấn song song nặng nhất; nguyên nhân khả dĩ là cost threshold = 5."
3. Chọn một đề xuất trong Phần VI và viết đầy đủ: rủi ro, cách rollback, tiêu chí nghiệm thu.
   **Đáp án:** Ví dụ thêm index cho proc tìm feed: rủi ro là ghi chậm hơn và tốn đĩa, khoá khi tạo nếu không online; rollback bằng `DROP INDEX`; nghiệm thu là reads/lần dưới ngưỡng đặt ra và thời gian insert của bảng không tăng quá X%.

### Bài 22.2. Sắp thứ tự ưu tiên và trình bày đề xuất tối ưu

#### Mục tiêu
- Sau bài này, bạn sắp được các đề xuất tối ưu theo thứ tự rủi ro và chi phí rollback.
- Bạn viết được một đề xuất có đủ số đo trước, thay đổi, tiêu chí nghiệm thu và đường lui.
- Bạn kể lại được một đợt tối ưu trong phỏng vấn đúng vai trò, có số, có đánh đổi.

#### Thứ tự ưu tiên theo rủi ro
Một báo cáo có hàng chục đề xuất; làm tất cả cùng lúc thì không biết thay đổi nào có tác dụng, thay đổi nào gây lỗi. Thứ tự hợp lý:

1. **Sửa proc và code** (tham số hoá, bỏ hàm trên cột, sửa kiểu dữ liệu, cache, bỏ gọi ngoài trong transaction): nhanh, phạm vi hẹp, rollback bằng deploy lại bản cũ.
2. **Index** trong khung đêm: tác động lớn, nhưng tốn đĩa, làm chậm ghi, tạo index lớn có thể khoá bảng (nhất là trên Standard). Rollback bằng `DROP INDEX`.
3. **Cấu hình instance** (bộ nhớ, song song, tempdb, CU): ảnh hưởng toàn server, có mục cần restart.
4. **Thay đổi kiến trúc** (tách đọc/ghi, replication, partition, outbox, hàng đợi): lợi ích dài hạn lớn nhất nhưng tốn công, nhiều thành phần mới phải vận hành.

Ngoại lệ: rủi ro mất dữ liệu hoặc sập ngay (log đầy 99,97%, ổ còn 9%, tempdb trên ổ C:) xử lý trước tiên, bất kể thuộc nhóm nào.

Trong mỗi nhóm, xếp theo tác động / công sức: lấy top truy vấn theo tổng CPU hoặc tổng reads (không theo trung bình), vì một proc nhẹ gọi 200 triệu lần thường quan trọng hơn một proc nặng chạy 10 lần mỗi ngày.

#### Mẫu một đề xuất tốt
```text
Vấn đề:    Proc lấy đề theo mã đề gọi 640.430 lần/ngày, đề không đổi trong ca thi.
Số đo trước: 640.430 lần/ngày; CPU tổng X giây/ngày (Query Store, 7 ngày).
Thay đổi:  Cache theo mã đề (L1 + Redis), warmup trước ca, xoá key khi CMS sửa đề.
Rủi ro:    Đề sửa giữa ca không cập nhật nếu bước xoá cache lỗi.
Đường lui: Feature flag tắt cache, đọc thẳng DB.
Nghiệm thu: Số lần gọi proc < 5.000/ngày; p99 API lấy đề không tăng; cache hit > 99%.
```

Mỗi đề xuất có năm phần: số đo trước, thay đổi, rủi ro, đường lui, tiêu chí nghiệm thu đo được. Thiếu số đo trước thì không chứng minh được thay đổi có tác dụng.

#### Triển khai và đo
- Mỗi lần một nhóm thay đổi nhỏ, có mốc thời gian, để quy được tác động.
- So sánh cùng khung giờ, cùng ngày trong tuần (tải kỳ thi thay đổi mạnh theo ca).
- Dùng Query Store để so plan và số liệu trước/sau theo từng truy vấn; với thay đổi cấu hình, so wait stats theo khoảng.

#### Kể lại trong phỏng vấn
Khung kể chuyện: bối cảnh (hệ thống, tải) → vấn đề có số → cách tìm nguyên nhân → quyết định và đánh đổi → kết quả có số → điều sẽ làm khác.

Quy tắc trung thực: nói đúng vai trò của bạn (dẫn audit, viết đề xuất, review, hay tự commit). Số nào đo được thì nói số đó; số nào là ước lượng thì nói là ước lượng. Đề xuất chưa triển khai thì nói "đề xuất", không nói "đã giảm".

#### Trong báo cáo
- Báo cáo đặt tiêu chí nghiệm thu đo được cho từng mục ("spill phải về 0", "reads dưới 20.000 trang/lần").
- Ví dụ các mục rủi ro cao cần làm trước: log 53,3 GB đầy 99,97% (Cụm 1 – Mục 1), tempdb 57,5 GB trên ổ C: còn 9,59% (Cụm 3 – Mục 1), ổ D: còn 9,16% (Cụm 6 – Mục 6).
- Ví dụ đề xuất kiến trúc: tách bảng log sang replica ở cụm kho dữ liệu (Phần VI).

#### Cách sửa
- Lập bảng đề xuất có cột: nhóm (code/index/cấu hình/kiến trúc), mức rủi ro, công sức, tác động ước tính, đường lui, tiêu chí nghiệm thu, trạng thái.

#### Kiểm chứng
- Mỗi đề xuất đã triển khai có số trước/sau cùng khung giờ; đề xuất chưa đạt tiêu chí thì mở lại, không đóng.

#### Bẫy
- Bắt đầu bằng thay đổi kiến trúc vì "đẹp" trong khi các proc nóng còn chưa sửa.
- Đo trung bình cả ngày: che mất giờ cao điểm, nơi vấn đề thật xảy ra.
- Nhận công cho số liệu của người khác hoặc cho đề xuất chưa triển khai.

#### Câu hỏi phỏng vấn
- **"Báo cáo có 40 đề xuất, bạn làm cái nào trước?"** Trước tiên là rủi ro mất dữ liệu hoặc sập ngay (log đầy, ổ đầy). Sau đó theo thứ tự rủi ro tăng dần: sửa proc và code, index trong khung đêm, cấu hình instance, cuối cùng là thay đổi kiến trúc. Trong mỗi nhóm, xếp theo tổng CPU hoặc reads, không theo trung bình.
- **"Vì sao xếp hạng truy vấn theo tổng chứ không theo trung bình?"** Tổng = trung bình × số lần gọi, phản ánh tải thật lên server. Proc 10 ms gọi 200 triệu lần tốn hơn proc 5 giây gọi 10 lần. Trung bình chỉ dùng khi quan tâm trải nghiệm một request cụ thể.
- **"Một đề xuất tối ưu tốt cần những phần nào?"** Số đo trước, thay đổi cụ thể, rủi ro, đường lui, tiêu chí nghiệm thu đo được. Thiếu số đo trước thì không chứng minh được tác dụng; thiếu đường lui thì không nên triển khai lên production.
- **"Kể một lần bạn tối ưu hệ thống, kết quả ra sao?"** Theo khung: bối cảnh và tải; vấn đề có số; cách tìm nguyên nhân (wait stats theo khoảng, Query Store); quyết định và đánh đổi; kết quả trước/sau cùng khung giờ; điều sẽ làm khác. Nói đúng vai trò và phân biệt số đo được với ước lượng.
- **"Làm sao biết một thay đổi thật sự có tác dụng chứ không phải do tải hôm đó thấp?"** So cùng khung giờ, cùng ngày trong tuần, chuẩn hoá theo số request (CPU trên mỗi lần gọi, reads trên mỗi lần gọi). Triển khai từng nhóm nhỏ có mốc thời gian; dùng Query Store so theo từng truy vấn.

#### Tóm tắt
- Rủi ro mất dữ liệu hoặc sập ngay xử lý trước tiên.
- Sau đó: code/proc → index → cấu hình instance → kiến trúc.
- Xếp hạng theo tổng tài nguyên, không theo trung bình.
- Mỗi đề xuất có số đo trước, rủi ro, đường lui, tiêu chí nghiệm thu.
- Khi kể lại: đúng vai trò, có số, có đánh đổi.

#### Bài tập
1. Sắp xếp theo thứ tự triển khai: thêm index cho proc tìm feed; cài CU cho SQL Server 2019 RTM; backup log cho DB đầy 99,97%; cache đề theo mã đề; tách bảng log sang replica.
   **Đáp án:** Backup log cho DB đầy (rủi ro sập) → cache đề (code) → index proc tìm feed (khung đêm) → cài CU (khung bảo trì) → tách bảng log sang replica (kiến trúc).
2. Viết đề xuất theo mẫu năm phần cho việc đưa lệnh ghi lịch sử ra khỏi transaction bằng outbox.
   **Đáp án:** Số đo trước: thời gian tối đa 29.997 ms, `OLEDB` + `MSQL_DQ` 38,4% thời gian chờ; thay đổi: outbox + worker; rủi ro: lịch sử trễ, gửi trùng; đường lui: flag quay về gọi trực tiếp; nghiệm thu: thời gian tối đa của proc dưới ngưỡng, `OLEDB`/`MSQL_DQ` giảm rõ, độ trễ outbox dưới vài giây.
3. Viết lại câu "Tôi đã giảm 90% CPU của cụm" cho trung thực khi bạn chỉ dẫn audit và đề xuất, đồng nghiệp triển khai, số đo là ước lượng.
   **Đáp án:** "Tôi dẫn đợt audit và viết đề xuất; đồng nghiệp triển khai. Theo ước lượng từ Query Store, các thay đổi đó có thể giảm khoảng X% CPU của nhóm proc nóng; số đo sau triển khai tôi chưa có đầy đủ."

## Chương 23. Ngoài báo cáo: tối ưu cho hệ thống lớn
Báo cáo nội bộ tập trung vào SQL Server và cách ứng dụng gọi nó. Khi hệ thống lớn lên, các nút thắt chuyển sang chỗ khác: dòng dữ liệu bị cập nhật dồn dập, cache phân tán, hàng đợi, giới hạn tải, runtime .NET, mạng, và chi phí. Chương này không phủ toàn bộ kiến thức tối ưu, nhưng phủ các mảng chính một backend senior hay bị hỏi.

Với bài toán kỳ thi (tải dồn theo ca, đỉnh ở đầu và cuối ca), thứ tự ưu tiên hợp lý:
1. Admission control và rate limit lúc vào thi; hàng đợi cho nộp bài (bài 23.3, 23.4).
2. Nạp sẵn cache đề và cấu hình trước ca; chống stampede (bài 23.2).
3. Dòng nóng, bộ đếm và RCSI trên bảng ghi dồn (bài 23.1).
4. Columnstore hoặc ClickHouse cho báo cáo, xếp hạng (bài 23.1).
5. Load test dạng spike bằng k6 trên dữ liệu cỡ thật; theo dõi SLO p99 (bài 23.7).

Sách nên đọc: *Designing Data-Intensive Applications* (Kleppmann), *Database Internals* (Petrov), *Systems Performance* (Gregg), *Release It!* (Nygard), *Site Reliability Engineering* (Google), *Pro .NET Memory Management* (Kokosa).

### Bài 23.1. Database nâng cao

#### Mục tiêu
- Sau bài này, bạn xử lý được dòng nóng, deadlock và lock escalation trong hệ thống ghi đồng thời cao.
- Bạn giải thích được columnstore, batch mode, In-Memory OLTP và Intelligent Query Processing, biết khi nào dùng.
- Bạn chọn được cách sinh ID, cách ghi theo lô và biết khi nào cần sharding hoặc kho dữ liệu khác.

#### Đồng thời và khoá
- **RCSI và Snapshot isolation**: RCSI cho mỗi câu lệnh đọc snapshot tại lúc câu lệnh bắt đầu; Snapshot isolation (`SET TRANSACTION ISOLATION LEVEL SNAPSHOT`, cần bật `ALLOW_SNAPSHOT_ISOLATION`) cho cả transaction đọc một snapshot và báo lỗi xung đột cập nhật (lỗi 3960) nếu dòng đã bị sửa sau khi transaction bắt đầu.
- **Deadlock**: SQL Server tự chọn một phiên làm nạn nhân (lỗi 1205). Deadlock graph có sẵn trong Extended Events session `system_health` (truy vấn bên dưới). Cách giảm: truy cập bảng theo cùng thứ tự, transaction ngắn, index phù hợp để không quét và khoá thừa, RCSI cho xung đột đọc-ghi, retry ở ứng dụng cho lỗi 1205.
- **Lock escalation**: khi một câu lệnh giữ khoảng 5.000 khoá trên một đối tượng, SQL Server cố nâng lên khoá bảng (hoặc partition nếu `LOCK_ESCALATION = AUTO`). Tránh bằng thao tác theo lô nhỏ.
- **Optimistic concurrency bằng `rowversion`**: đọc kèm cột `rowversion`, khi cập nhật thêm điều kiện `WHERE RowVer = @RowVer`; `@@ROWCOUNT = 0` nghĩa là có người sửa trước, báo xung đột cho người dùng. Hợp với màn hình CMS sửa cấu hình.

```sql
SELECT CAST(event_data AS xml) AS deadlock
FROM sys.fn_xe_file_target_read_file('system_health*.xel', NULL, NULL, NULL)
WHERE object_name = 'xml_deadlock_report';
```

#### Dòng nóng
Dòng nóng là một dòng bị cập nhật dồn dập: bộ đếm lượt tham gia, tổng điểm sự kiện, số lượt quay còn lại của một chương trình. Mọi `UPDATE` vào cùng một dòng phải xếp hàng chờ khoá X; thông lượng bị giới hạn bởi thời gian giữ khoá (cộng thời gian ghi log khi commit).

Hai cách tách:
- **Sharded counter**: chia bộ đếm thành N dòng, mỗi lần cập nhật chọn ngẫu nhiên một dòng, khi đọc thì cộng lại.

```sql
-- 16 slot cho mỗi bộ đếm
UPDATE dbo.CounterSlot
SET Value = Value + 1
WHERE CounterId = @CounterId AND Slot = ABS(CHECKSUM(NEWID())) % 16;

SELECT SUM(Value) FROM dbo.CounterSlot WHERE CounterId = @CounterId;
```

- **Gom theo lô**: ứng dụng (hoặc Redis `INCR`) cộng dồn trong bộ nhớ, mỗi vài giây ghi một lần xuống DB. Đánh đổi: mất phần chưa ghi nếu tiến trình chết; chỉ dùng cho số liệu chấp nhận sai lệch nhỏ hoặc có cơ chế đối soát.

Số dư, tồn kho không được sai thì không gom lô; dùng câu cập nhật có điều kiện (`WHERE Quantity >= @Qty`) và giữ transaction cực ngắn.

#### Columnstore và batch mode
Rowstore lưu theo dòng: một trang chứa các dòng đầy đủ. Columnstore lưu theo cột: dữ liệu chia thành rowgroup (tối đa 1.048.576 dòng), mỗi cột của rowgroup là một segment được nén riêng. Lợi ích cho truy vấn tổng hợp:
- Chỉ đọc cột cần dùng; nén theo cột thường gấp nhiều lần nén theo dòng.
- Segment elimination: bỏ qua segment có min/max không khớp điều kiện.
- Batch mode: toán tử xử lý theo lô hàng trăm dòng một lần thay vì từng dòng, giảm chi phí CPU mỗi dòng.

Truy vấn tổng hợp trên hàng trăm triệu dòng thường nhanh hơn rowstore hàng chục lần. Dữ liệu mới vào delta store (rowstore) trước, tuple mover nén sau; bulk insert từ 102.400 dòng trở lên vào thẳng rowgroup nén. Nonclustered columnstore trên bảng OLTP cho phép phân tích thời gian thực (operational analytics), đổi lại ghi chậm hơn. SQL Server 2019 có batch mode trên rowstore (compat 150, bản Enterprise).

Không dùng columnstore cho truy vấn lấy vài dòng theo khoá hay bảng cập nhật từng dòng liên tục.

#### In-Memory OLTP
Bảng memory-optimized nằm hoàn toàn trong RAM, không dùng khoá và latch (đồng thời lạc quan nhiều phiên bản), index là hash hoặc range trong bộ nhớ. Hai mức bền: `SCHEMA_AND_DATA` (ghi log, khôi phục được) và `SCHEMA_ONLY` (mất dữ liệu khi restart, hợp cho session, bảng staging). Memory-optimized table type thay cho bảng biến, `#temp` trong proc gọi rất nhiều. Memory-optimized tempdb metadata (SQL Server 2019, cần restart) giảm tranh chấp bảng hệ thống của tempdb. Đánh đổi: tốn RAM, hạn chế tính năng, vận hành phức tạp hơn.

#### Partitioning sâu
Partition elimination chỉ xảy ra khi điều kiện lọc trên cột partition khớp kiểu và không bị bọc hàm. Index aligned (cùng partition scheme) là điều kiện để `SWITCH` và rebuild từng partition. Sliding window (bài 20.3) là quy trình chuẩn cho bảng log theo thời gian.

#### Intelligent Query Processing
Nhóm tính năng optimizer tự điều chỉnh, bật theo compatibility level:
- SQL Server 2017 (compat 140): adaptive join, memory grant feedback (batch mode), interleaved execution cho multi-statement TVF.
- SQL Server 2019 (compat 150): memory grant feedback cho row mode, batch mode trên rowstore, table variable deferred compilation, scalar UDF inlining, `APPROX_COUNT_DISTINCT`.
- SQL Server 2022 (compat 160): Parameter Sensitive Plan optimization (nhiều plan cho một truy vấn theo giá trị tham số), memory grant feedback theo percentile và lưu bền qua Query Store, DOP feedback (bật bằng database scoped configuration), CE feedback, Query Store hints (gắn hint mà không sửa code).

Nâng compat level là thay đổi có rủi ro hồi quy plan: bật Query Store trước, nâng compat, so sánh, force plan cũ cho truy vấn bị hồi quy.

#### Ghi theo lô
Một lần gọi cho mỗi dòng tốn round-trip và một commit (một lần chờ `WRITELOG`) mỗi dòng. Các cách gom:
- **TVP** (table-valued parameter): truyền nhiều dòng vào proc trong một lần gọi.
- **`SqlBulkCopy`**: nạp hàng nghìn tới hàng triệu dòng; với `TABLOCK` vào heap hoặc bảng rỗng, ở SIMPLE/BULK_LOGGED được minimal logging.

```csharp
var table = new DataTable();
table.Columns.Add("UserId", typeof(long));
table.Columns.Add("QuestionId", typeof(int));
table.Columns.Add("Answer", typeof(string));
// ... thêm dòng
using var cmd = new SqlCommand("dbo.usp_SaveAnswers", conn) { CommandType = CommandType.StoredProcedure };
cmd.Parameters.Add(new SqlParameter("@Answers", SqlDbType.Structured)
{
    TypeName = "dbo.AnswerTableType",
    Value = table
});
await cmd.ExecuteNonQueryAsync(ct);
```

#### Sinh ID
GUID ngẫu nhiên (`NEWID()`, `Guid.NewGuid()`) làm clustered key gây chèn vào giữa index, page split, phân mảnh, và trang của index không nằm gọn trong buffer pool. Thay thế:
- `NEWSEQUENTIALID()` (chỉ dùng làm default của cột) hoặc identity/sequence.
- Snowflake ID: số 64 bit gồm 41 bit thời gian (ms), 10 bit mã máy, 12 bit số thứ tự (4.096 ID mỗi ms mỗi máy); tăng theo thời gian, sinh ở ứng dụng, không cần DB.
- UUID v7 (`Guid.CreateVersion7()` từ .NET 9): tăng theo thời gian theo thứ tự byte chuẩn. Cẩn thận: SQL Server so sánh `uniqueidentifier` theo thứ tự byte riêng (nhóm byte cuối được so trước), nên UUID v7 lưu vào cột `uniqueidentifier` không tăng dần theo cách SQL Server sắp xếp.

#### HA/DR, sharding và đúng kho
- **Always On AG**: failover tự động trong cụm; ứng dụng phải retry khi kết nối bị cắt lúc failover (vài giây tới vài chục giây), dùng listener và `MultiSubnetFailover=True`. Read scale-out đưa truy vấn đọc sang secondary (bài 21.4).
- **Sharding**: chia dữ liệu ra nhiều DB theo shard key. Chọn key sao cho truy vấn chính chỉ chạm một shard và tải chia đều (ví dụ `UserId` băm). Khó: truy vấn chéo shard, transaction chéo shard, chia lại shard khi thêm node. Distributed SQL (CockroachDB, YugabyteDB, TiDB, Citus cho PostgreSQL) làm sẵn phần chia và chia lại, đổi lại độ trễ ghi cao hơn do đồng thuận giữa các node.
- **Đúng việc đúng kho**: Elasticsearch/OpenSearch cho tìm kiếm toàn văn (thay `LIKE '%x%'` luôn quét); ClickHouse cho phân tích cột trên dữ liệu rất lớn; time-series DB cho metric; object storage cho file, ảnh, bài làm dạng file.
- **CQRS và read model**: tách mô hình ghi và mô hình đọc; read model được cập nhật từ sự kiện, thiết kế đúng hình dạng màn hình cần. Indexed view là dạng read model ngay trong SQL Server: kết quả tổng hợp được lưu và tự cập nhật, đổi lại mỗi lần ghi vào bảng gốc tốn thêm chi phí.

#### Kiểm chứng
- Dòng nóng: wait `LCK_M_X`/`LCK_M_U` trên đúng dòng giảm, thông lượng cập nhật tăng (đo bằng load test).
- Columnstore: `SET STATISTICS IO, TIME ON` so reads và CPU trước/sau; plan có toán tử chạy batch mode (`Actual Execution Mode = Batch`).
- Deadlock: số `xml_deadlock_report` mỗi ngày trong `system_health` giảm.

#### Bẫy
- Gom cập nhật theo lô cho dữ liệu tiền, tồn kho: tiến trình chết là mất cập nhật.
- Columnstore trên bảng cập nhật từng dòng liên tục: delta store và dòng bị đánh dấu xoá tích tụ, cần reorganize thường xuyên.
- Sharding quá sớm: chi phí vận hành và truy vấn chéo shard lớn hơn nhiều so với scale dọc, tách đọc, cache.

#### Câu hỏi phỏng vấn
- **"Bộ đếm lượt tham gia sự kiện bị cập nhật hàng nghìn lần mỗi giây và gây blocking, bạn xử lý thế nào?"** Đó là dòng nóng. Tách thành sharded counter (N dòng, cập nhật ngẫu nhiên một dòng, đọc thì cộng), hoặc đếm trên Redis `INCR` rồi ghi xuống DB theo lô vài giây một lần nếu chấp nhận sai lệch nhỏ. Số dư không được sai thì giữ cập nhật có điều kiện và transaction cực ngắn.
- **"Khi nào dùng columnstore index?"** Truy vấn tổng hợp, quét nhiều dòng ít cột trên bảng lớn: báo cáo, thống kê, xếp hạng. Nhờ nén theo cột, segment elimination và batch mode, thường nhanh hơn rowstore hàng chục lần. Không hợp cho lấy vài dòng theo khoá hay cập nhật từng dòng liên tục.
- **"GUID làm clustered key có vấn đề gì và thay bằng gì?"** GUID ngẫu nhiên chèn vào giữa index gây page split, phân mảnh, buffer pool kém hiệu quả. Dùng identity/sequence, `NEWSEQUENTIALID()`, hoặc Snowflake ID sinh ở ứng dụng; nếu dùng UUID v7 thì lưu ý thứ tự so sánh `uniqueidentifier` của SQL Server khác thứ tự byte chuẩn.
- **"Bạn tìm nguyên nhân deadlock thế nào?"** Lấy deadlock graph từ session `system_health` (event `xml_deadlock_report`), xem hai phiên giữ và chờ khoá gì trên đối tượng nào, câu lệnh nào. Sửa bằng thứ tự truy cập thống nhất, index để giảm phạm vi khoá, transaction ngắn, RCSI cho xung đột đọc-ghi; ứng dụng retry lỗi 1205.
- **"Nâng compatibility level để được Intelligent Query Processing có rủi ro gì?"** Đổi cardinality estimator và hành vi optimizer, có thể làm một số plan tệ đi. Bật Query Store trước, ghi baseline, nâng compat, so sánh truy vấn hồi quy và force plan cũ hoặc dùng Query Store hint cho chúng.

#### Tóm tắt
- Dòng nóng: sharded counter hoặc gom lô; số dư thì cập nhật có điều kiện.
- Deadlock graph có sẵn trong `system_health`; ứng dụng retry lỗi 1205.
- Columnstore + batch mode cho tổng hợp; In-Memory OLTP cho dữ liệu nóng nhỏ.
- IQP theo compat level; nâng compat có Query Store làm lưới an toàn.
- Ghi theo lô bằng TVP/`SqlBulkCopy`; ID tăng dần thay GUID ngẫu nhiên.

#### Bài tập
1. Thiết kế bảng sharded counter cho bộ đếm lượt tham gia, kèm câu cập nhật và câu đọc.
   **Đáp án:** `CounterSlot(CounterId int, Slot tinyint, Value bigint, PRIMARY KEY (CounterId, Slot))`, khởi tạo 16 dòng mỗi bộ đếm; cập nhật `Slot = ABS(CHECKSUM(NEWID())) % 16`; đọc `SUM(Value)`.
2. Bảng log đáp án 500 triệu dòng, báo cáo đếm số câu đúng theo môn, theo ngày chạy 3 phút. Đề xuất cách tăng tốc và đánh đổi.
   **Đáp án:** Thêm nonclustered columnstore (hoặc bảng tổng hợp/columnstore ở replica báo cáo); đánh đổi là ghi chậm hơn và tốn bộ nhớ tuple mover. Tốt hơn: làm ở replica để primary giữ insert nhanh.
3. Viết câu `UPDATE` dùng `rowversion` cho màn hình CMS sửa cấu hình ca thi và cách xử lý khi xung đột.
   **Đáp án:** `UPDATE dbo.ShiftConfig SET ... WHERE ShiftId = @Id AND RowVer = @RowVer; IF @@ROWCOUNT = 0 THROW 50010, N'Cấu hình đã bị người khác sửa', 1;`. Ứng dụng tải lại dữ liệu mới và cho người dùng sửa lại.

### Bài 23.2. Cache nâng cao

#### Mục tiêu
- Sau bài này, bạn thiết kế được cache hai tầng L1/L2 và dùng được `HybridCache`.
- Bạn chống được stampede bằng nhiều kỹ thuật, xử lý được hot key và big key.
- Bạn nắm các điểm vận hành Redis quan trọng và cache ở tầng HTTP.

#### Cache hai tầng
L1 là cache trong process (nanosecond, không qua mạng), L2 là Redis dùng chung. Đọc L1 → trượt thì đọc L2 → trượt thì đọc DB, ghi ngược lên L2 rồi L1. L1 có TTL ngắn hơn L2 để giới hạn độ lệch giữa các instance. Khi dữ liệu đổi: xoá L2 và phát thông báo (Redis Pub/Sub) để mọi instance xoá L1.

`HybridCache` (gói `Microsoft.Extensions.Caching.Hybrid`, ra cùng .NET 9) làm sẵn hai tầng, chống stampede trong một instance (một lần nạp cho mỗi key, các lời gọi đồng thời chờ chung) và hỗ trợ xoá theo tag:

```csharp
builder.Services.AddHybridCache(o =>
{
    o.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = TimeSpan.FromMinutes(30),        // L2
        LocalCacheExpiration = TimeSpan.FromSeconds(30) // L1
    };
});

var paper = await _cache.GetOrCreateAsync(
    $"exam:paper:{paperId}",
    async ct => await _repo.GetPaperAsync(paperId, ct),
    tags: new[] { $"exam:{examId}" },
    cancellationToken: ct);

await _cache.RemoveByTagAsync($"exam:{examId}");   // khi CMS sửa đề
```

#### Chống stampede: ba kỹ thuật
- **Request coalescing**: gộp các yêu cầu trùng key thành một lần nạp. Trong process: `HybridCache` hoặc `Lazy<Task<T>>` trong `ConcurrentDictionary`. Giữa nhiều instance: khoá Redis `SET lock:key token NX PX 5000`, instance không lấy được khoá thì chờ ngắn rồi đọc lại cache.
- **Hết hạn sớm theo xác suất (XFetch)**: mỗi lần đọc, nạp lại sớm với xác suất tăng dần khi gần hết hạn. Điều kiện: `now - delta * beta * ln(rand()) >= expiry`, với `delta` là thời gian nạp, `beta` thường là 1. Key nóng gần như luôn được một request làm mới trước khi hết hạn, không có thời điểm tất cả cùng trượt.
- **Stale-while-revalidate**: lưu kèm "hạn mềm" và "hạn cứng"; quá hạn mềm thì trả bản cũ ngay và kích hoạt nạp nền; chỉ quá hạn cứng mới chờ DB.

#### Hot key và big key
- **Hot key**: một key nhận phần lớn lượt đọc (cấu hình sự kiện đang chạy). Trong Redis Cluster, mọi lượt đọc key đó dồn vào một node. Cách xử lý: L1 trong process (gần như hết tải lên Redis), nhân bản key (`config:event:{n}` với n = 0..7, đọc ngẫu nhiên một bản), đọc từ replica.
- **Big key**: value lớn (chuỗi hàng MB, hash/list hàng trăm nghìn phần tử). Redis thực thi lệnh trên một luồng chính: đọc, ghi hay xoá một big key chặn mọi lệnh khác trong lúc đó, tốn băng thông mạng, và làm phân phối bộ nhớ giữa các node lệch. Xử lý: chia nhỏ (đề thi theo từng phần), nén, chỉ cache phần cần; xoá bằng `UNLINK` (giải phóng bộ nhớ nền) thay cho `DEL`. Tìm bằng `redis-cli --bigkeys` hoặc `MEMORY USAGE key`.

#### Invalidation
- Theo sự kiện từ chính ứng dụng sau commit (bài 21.1).
- Theo CDC hoặc outbox: thay đổi trong DB sinh sự kiện, consumer xoá cache. Bắt được cả thay đổi do job hay do sửa tay trong DB.
- Key có version: `exam:paper:{id}:v{version}`; khi dữ liệu đổi thì tăng version (lưu ở nơi rẻ để đọc), key cũ tự hết hạn. Tránh race giữa xoá và nạp lại.

#### Vận hành Redis
- **Pipeline**: gửi nhiều lệnh không chờ từng phản hồi, giảm round-trip. StackExchange.Redis tự multiplex nhiều lệnh async trên một kết nối; dùng một `ConnectionMultiplexer` singleton.
- **Lua script** (`EVAL`): chạy nguyên tử nhiều lệnh trên server, ví dụ "kiểm tra còn lượt rồi trừ".

```lua
-- KEYS[1] = số lượt còn lại; ARGV[1] = số lượt cần trừ
local left = tonumber(redis.call('GET', KEYS[1]) or '0')
if left >= tonumber(ARGV[1]) then
  return redis.call('DECRBY', KEYS[1], ARGV[1])
end
return -1
```

- **Cluster**: 16.384 hash slot chia cho các node; các key trong một lệnh nhiều key phải cùng slot, ép bằng hash tag `{user:123}:a`, `{user:123}:b`.
- **Eviction policy**: mặc định `noeviction` (đầy bộ nhớ thì lệnh ghi lỗi). Cache thuần thường dùng `allkeys-lru` hoặc `allkeys-lfu`; nếu Redis vừa làm cache vừa lưu dữ liệu không được mất thì tách instance.
- **Persistence**: RDB (snapshot định kỳ, fork tiến trình tốn bộ nhớ copy-on-write) và AOF (ghi log lệnh, `appendfsync everysec` có thể mất khoảng 1 giây dữ liệu). Cache thuần có thể tắt persistence để giảm độ trễ, đổi lại khởi động lại là cache lạnh.
- Không dùng `KEYS *` trên production (quét toàn bộ, chặn server); dùng `SCAN` theo con trỏ.

#### Cache ở tầng HTTP và CDN
- `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=30`: trình duyệt giữ 60 giây, CDN giữ 300 giây, quá hạn vẫn trả bản cũ trong 30 giây khi làm mới.
- ETag + `If-None-Match`: server trả 304 Not Modified không kèm body nếu dữ liệu chưa đổi; tiết kiệm băng thông, vẫn tốn một request.
- ASP.NET Core Output Caching (`AddOutputCache`, từ .NET 7): cache response ở server, có tag để xoá, có chống stampede. Dữ liệu cá nhân hoá không cache ở CDN, hoặc phải vary theo khoá phù hợp.

#### Kiểm chứng
- Tỉ lệ hit L1, L2 riêng; số lần nạp từ DB mỗi key mỗi giờ (phải gần 1 lần mỗi TTL mỗi instance).
- Redis: `INFO stats` (`keyspace_hits`, `keyspace_misses`, `evicted_keys`), `SLOWLOG GET` để thấy lệnh chậm, độ trễ p99 của lệnh phía client.
- Load test bằng cách xoá key nóng giữa lúc tải cao: DB không được tăng vọt.

#### Bẫy
- Xoá cache bằng `KEYS pattern` rồi `DEL` trên production: chặn Redis. Dùng tag, version, hoặc `SCAN` theo lô.
- L1 TTL dài trên nhiều instance mà không có Pub/Sub: mỗi instance thấy một phiên bản dữ liệu khác nhau.
- Await ghi cache trong đường xử lý request: Redis chậm kéo theo API chậm. Ghi cache chạy nền, có bắt lỗi và log.

#### Câu hỏi phỏng vấn
- **"Thiết kế cache cho cấu hình sự kiện được đọc 50.000 lần mỗi giây trên 20 instance thế nào?"** L1 trong process TTL vài giây tới vài chục giây trước L2 Redis; hot key gần như không chạm Redis. Khi admin sửa: xoá L2 và phát Pub/Sub để instance xoá L1. Warmup trước sự kiện, coalescing để mỗi instance chỉ nạp một lần.
- **"XFetch khác single-flight thế nào?"** Single-flight gộp request khi đã trượt: vẫn có một request phải chờ DB. XFetch làm mới sớm theo xác suất trước khi hết hạn, nên key nóng hầu như không bao giờ trượt. Thường dùng cùng nhau.
- **"Big key trong Redis gây hại gì?"** Redis thực thi lệnh trên một luồng chính, thao tác với big key chặn mọi lệnh khác; tốn băng thông; lệch bộ nhớ giữa các node cluster; xoá bằng `DEL` cũng chặn. Chia nhỏ, nén, xoá bằng `UNLINK`.
- **"Redis dùng làm cache nên chọn eviction policy và persistence thế nào?"** Cache thuần: `allkeys-lru` hoặc `allkeys-lfu`, đặt `maxmemory`; persistence có thể tắt hoặc chỉ RDB thưa, chấp nhận cache lạnh khi khởi động lại (cần warmup). Dữ liệu không được mất thì tách sang instance khác với `noeviction` và AOF.
- **"Khi nào dùng ETag, khi nào dùng max-age?"** `max-age` để client/CDN không gọi lại trong khoảng thời gian, hợp với dữ liệu đổi theo chu kỳ biết trước. ETag khi cần luôn kiểm tra tươi mới nhưng muốn tránh tải lại body; vẫn tốn một round-trip. Có thể kết hợp.

#### Tóm tắt
- L1 + L2 với TTL L1 ngắn hơn; xoá L1 qua Pub/Sub; `HybridCache` làm sẵn phần lớn.
- Stampede: coalescing, XFetch, stale-while-revalidate.
- Hot key: L1 và nhân bản key; big key: chia nhỏ, `UNLINK`.
- Redis: pipeline, Lua nguyên tử, hash tag trong cluster, chọn eviction và persistence theo vai trò.
- Cache HTTP: `Cache-Control`, ETag, Output Caching.

#### Bài tập
1. Viết pseudo-code XFetch cho hàm đọc key, biết cache lưu `value`, `delta` (thời gian nạp, giây) và `expiry`.
   **Đáp án:** `if (entry == null || now - entry.delta * beta * Math.Log(Random.Shared.NextDouble()) >= entry.expiry) { var start = now; value = Load(); delta = now - start; Set(key, value, delta, now + ttl); } return value;` (`Math.Log` của số trong (0,1) là số âm nên vế trái lớn hơn `now`).
2. Hai key `user:1:profile` và `user:1:stats` cần đọc trong một lệnh `MGET` trên Redis Cluster. Đặt lại tên key.
   **Đáp án:** `{user:1}:profile` và `{user:1}:stats`: phần trong ngoặc nhọn là hash tag, hai key cùng slot.
3. Viết script Lua trừ lượt quay chỉ khi còn đủ lượt và đặt TTL nếu key mới tạo.
   **Đáp án:** Như mẫu trong bài, thêm sau khi `DECRBY`: `if redis.call('TTL', KEYS[1]) == -1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end`.

### Bài 23.3. Bất đồng bộ và messaging

#### Mục tiêu
- Sau bài này, bạn dùng được hàng đợi để san tải đỉnh (load leveling), ví dụ nộp bài cuối ca thi.
- Bạn giải thích được partition, thứ tự, consumer group, consumer lag trong Kafka và mô hình ack/prefetch của RabbitMQ.
- Bạn thiết kế được giao hàng tin cậy (outbox/inbox, idempotency, DLQ, retry) và saga thay cho distributed transaction.

#### Load leveling
Cuối ca thi, hàng chục nghìn thí sinh nộp bài trong vài chục giây. Nếu mỗi lần nộp ghi thẳng vào DB, DB phải chịu đỉnh gấp nhiều lần tải trung bình. Load leveling: API nhận bài, ghi vào hàng đợi bền (Kafka, RabbitMQ, hoặc bảng queue), trả "đã nhận" kèm mã theo dõi; consumer ghi vào DB với tốc độ DB chịu được. Đỉnh 50.000 lượt trong 30 giây, consumer ghi 5.000 lượt/giây thì hàng đợi xả hết trong khoảng 10 giây.

Đánh đổi: kết quả không có ngay; client cần trạng thái "đang xử lý" và cách hỏi lại hoặc nhận thông báo. Bài nộp phải được ghi bền vào hàng đợi trước khi trả "đã nhận".

#### Kafka
- **Topic** chia thành **partition**; mỗi partition là log chỉ ghi nối tiếp, mỗi message có offset. Thứ tự chỉ đảm bảo trong một partition.
- **Partition key** quyết định message vào partition nào (băm key). Cần thứ tự theo thí sinh thì dùng `UserId` làm key. Key lệch (một key quá nhiều message) gây partition nóng.
- **Consumer group**: mỗi partition chỉ được một consumer trong group đọc; số consumer hữu ích tối đa bằng số partition. Muốn tăng song song phải tăng partition (chọn dư từ đầu, vì tăng partition làm đổi ánh xạ key).
- **Consumer lag**: offset mới nhất trừ offset đã commit; là metric chính để biết consumer có theo kịp không, và để autoscale (KEDA).
- **Độ bền**: producer `acks=all` + `min.insync.replicas=2` (với replication factor 3) để message không mất khi một broker chết; producer idempotent tránh trùng khi retry gửi.
- **Ngữ nghĩa giao hàng**: commit offset sau khi xử lý xong → at-least-once (có thể xử lý trùng). Exactly-once của Kafka chỉ đúng trong phạm vi Kafka (transaction đọc-xử lý-ghi topic); ghi ra DB ngoài vẫn cần idempotency.

#### RabbitMQ
Producer gửi vào exchange, exchange định tuyến vào queue theo binding (direct, topic, fanout). Consumer nhận message, xử lý xong thì `ack`; chưa ack mà consumer chết thì message được giao lại. `prefetch` (QoS) giới hạn số message chưa ack mỗi consumer giữ: đây là cơ chế backpressure chính. Queue bền (durable) + message persistent + publisher confirm để không mất message. Message thất bại nhiều lần chuyển sang dead letter exchange.

Chọn nhanh: Kafka khi cần thông lượng rất cao, lưu lại để đọc lại (replay), nhiều nhóm consumer đọc cùng luồng sự kiện. RabbitMQ khi cần định tuyến linh hoạt, hàng đợi công việc, độ trễ thấp ở thông lượng vừa phải.

#### Giao hàng tin cậy
- **Outbox** (bài 21.3): ghi sự kiện cùng transaction với dữ liệu, relay đẩy lên broker.
- **Inbox / idempotency**: consumer ghi `MessageId` đã xử lý vào bảng có unique key trong cùng transaction với thao tác nghiệp vụ; gặp trùng thì bỏ qua.

```sql
BEGIN TRAN;
  INSERT dbo.Inbox (MessageId, ProcessedAt) VALUES (@MessageId, SYSUTCDATETIME()); -- unique key
  INSERT dbo.Submission (...) VALUES (...);
COMMIT;
-- lỗi 2627 (trùng khoá) ở câu đầu nghĩa là đã xử lý: ack và bỏ qua
```

- **Idempotency key ở API**: client gửi kèm khoá duy nhất cho mỗi lần nộp; server lưu kết quả theo khoá, gửi lại cùng khoá thì trả kết quả cũ.
- **Retry có backoff**: lỗi tạm thời thì thử lại sau 1 s, 2 s, 4 s... cộng jitter; giới hạn số lần.
- **DLQ** (dead letter queue): message lỗi vượt số lần retry (hoặc lỗi không thể retry, như dữ liệu sai) chuyển sang hàng riêng để xem xét, không chặn hàng chính. Phải có cảnh báo và công cụ xử lý lại.

#### Saga
Saga thay distributed transaction bằng chuỗi transaction local, mỗi bước có hành động bù (compensation) nếu bước sau thất bại. Ví dụ đổi quà: trừ điểm → giữ quà → tạo đơn; tạo đơn lỗi thì trả quà, hoàn điểm.
- **Orchestration**: một bộ điều phối gọi từng bước, giữ trạng thái saga; dễ theo dõi.
- **Choreography**: mỗi dịch vụ nghe sự kiện và phát sự kiện tiếp; ít phụ thuộc nhưng khó nhìn toàn luồng.

Saga không có cô lập: trạng thái trung gian (điểm đã trừ, đơn chưa tạo) nhìn thấy được. Thiết kế trạng thái "đang xử lý" và hành động bù idempotent.

#### Xử lý luồng
Thay job tính lại toàn bộ (ví dụ xếp hạng chạy lại trên toàn bảng mỗi 5 phút) bằng tổng hợp tăng dần: mỗi sự kiện nộp bài cập nhật điểm và hạng ngay (Redis sorted set `ZINCRBY`, hoặc Kafka Streams/Flink với cửa sổ thời gian). Flink và Kafka Streams quản lý trạng thái, cửa sổ (tumbling, sliding), dữ liệu đến muộn (watermark). Đánh đổi: hệ thống phức tạp hơn; vẫn cần job đối soát định kỳ.

#### Kiểm chứng
- Consumer lag và thời gian từ lúc nhận tới lúc ghi DB (end-to-end latency) trong đỉnh nộp bài.
- Số message trong DLQ bằng 0 hoặc có cảnh báo; số bản ghi trùng bằng 0 (đếm theo `MessageId`).
- Đối soát định kỳ: số bài nộp nhận ở API bằng số bài ghi trong DB.

#### Bẫy
- Trả "đã nhận" trước khi message được ghi bền (producer chưa nhận ack): broker chết là mất bài.
- Retry vô hạn một message lỗi dữ liệu: chặn cả partition (Kafka xử lý tuần tự trong partition). Chuyển sang DLQ sau N lần.
- Tăng consumer khi nút thắt là DB: lag không giảm, DB quá tải thêm.

#### Câu hỏi phỏng vấn
- **"Cuối ca thi 50.000 thí sinh nộp bài trong 30 giây, bạn thiết kế thế nào để DB không sập?"** API ghi bài nộp vào hàng đợi bền rồi trả "đã nhận" kèm mã theo dõi; consumer ghi DB theo lô với tốc độ cố định; idempotency key để nộp lại không trùng. Theo dõi consumer lag, autoscale consumer trong giới hạn DB chịu được, client hiển thị trạng thái "đang xử lý".
- **"Kafka đảm bảo thứ tự message thế nào?"** Chỉ trong một partition. Message cùng key vào cùng partition nên giữ thứ tự theo key; giữa các partition không có thứ tự. Retry ở producer có thể đảo thứ tự nếu không bật idempotent producer.
- **"Vì sao consumer phải idempotent dù đã dùng Kafka exactly-once?"** Exactly-once của Kafka chỉ trong phạm vi đọc-ghi giữa các topic Kafka. Ghi ra DB ngoài, consumer có thể xử lý xong nhưng chết trước khi commit offset, lần sau xử lý lại. Inbox với unique key trên `MessageId` chặn trùng.
- **"Saga khác distributed transaction thế nào?"** Distributed transaction (2PC) khoá tài nguyên ở mọi bên tới khi commit chung; một bên chậm thì tất cả chờ. Saga là chuỗi transaction local, lỗi thì chạy hành động bù; không giữ khoá xuyên dịch vụ nhưng không có cô lập, trạng thái trung gian nhìn thấy được.
- **"Consumer lag tăng liên tục, bạn làm gì?"** Xem consumer chậm vì đâu (DB, API ngoài, message lỗi retry mãi); tăng consumer nếu còn partition rảnh; xử lý theo lô; chuyển message lỗi sang DLQ để không chặn. Nếu nút thắt là DB thì tăng consumer chỉ dồn tải vào DB.

#### Tóm tắt
- Hàng đợi bền san tải đỉnh; trả "đã nhận" sau khi ghi bền.
- Kafka: thứ tự trong partition, song song tối đa bằng số partition, theo dõi consumer lag.
- RabbitMQ: ack, prefetch làm backpressure, dead letter exchange.
- At-least-once là mặc định thực tế: outbox ở phía gửi, inbox/idempotency ở phía nhận, DLQ cho message lỗi.
- Saga thay 2PC bằng transaction local + hành động bù.

#### Bài tập
1. Hàng đợi nộp bài nhận 60.000 message trong 20 giây, consumer xử lý 4.000 message/giây. Tính độ dài hàng đợi lớn nhất và thời gian xả hết.
   **Đáp án:** Tốc độ vào 3.000/giây, nhỏ hơn 4.000/giây nên hàng đợi không tích luỹ đáng kể; xả gần như ngay sau 20 giây. Nếu tốc độ vào 10.000/giây trong 6 giây (cùng 60.000): tích 6 × 6.000 = 36.000, xả thêm 9 giây.
2. Chọn partition key cho topic sự kiện nộp bài cần giữ thứ tự theo thí sinh, và nêu rủi ro.
   **Đáp án:** `UserId`. Rủi ro: thí sinh gửi bất thường nhiều gây partition nóng (hiếm với nộp bài); thay đổi số partition làm đổi ánh xạ key.
3. Thiết kế saga đổi quà gồm trừ điểm, giữ quà, tạo đơn; liệt kê hành động bù.
   **Đáp án:** Trừ điểm ↔ hoàn điểm; giữ quà ↔ trả quà về kho; tạo đơn là bước cuối, lỗi thì chạy bù hai bước trước theo thứ tự ngược. Mỗi bước và hành động bù idempotent theo mã saga.

### Bài 23.4. Scale và chịu lỗi

#### Mục tiêu
- Sau bài này, bạn thiết kế được service stateless có autoscale và load balancing phù hợp.
- Bạn bảo vệ được hệ thống bằng rate limiting, load shedding, admission control.
- Bạn cấu hình được timeout, retry, circuit breaker, bulkhead, hedging cho lời gọi giữa service.

#### Stateless và autoscale
Service stateless không giữ trạng thái người dùng trong bộ nhớ process (session, giỏ hàng, tiến độ bài làm nằm ở Redis/DB), nên instance nào cũng phục vụ được mọi request và có thể thêm/bớt tự do.
- **HPA** (Kubernetes Horizontal Pod Autoscaler): scale theo CPU, bộ nhớ hoặc metric tuỳ chỉnh.
- **KEDA**: scale theo nguồn sự kiện (consumer lag Kafka, độ dài queue RabbitMQ, lịch cron). Với kỳ thi biết trước giờ, scale theo lịch trước ca hiệu quả hơn chờ CPU tăng mới scale (scale phản ứng chậm vài phút).

#### Load balancing
- Round-robin: đơn giản, kém khi request có độ dài rất khác nhau.
- Least-connection: gửi tới instance đang ít kết nối nhất.
- Power of two choices: chọn ngẫu nhiên hai instance, gửi tới instance tải thấp hơn. Gần tốt như least-connection mà không cần trạng thái toàn cục chính xác, tránh hiện tượng mọi load balancer cùng dồn vào một instance "đang rảnh".

#### Bảo vệ hệ thống
- **Rate limiting**: giới hạn số request theo khách (IP, user, API key). Token bucket: bucket chứa tối đa B token, nạp R token/giây, mỗi request lấy một token; cho phép burst tới B. Sliding window: đếm request trong cửa sổ trượt, mượt hơn fixed window (fixed window cho phép gấp đôi ở ranh giới cửa sổ). Rate limit trong process chỉ đúng cho một instance; giới hạn toàn cục cần Redis hoặc gateway. Ví dụ ASP.NET Core (từ .NET 7) ở cuối mục này.
- **Load shedding**: khi quá tải, chủ động từ chối sớm (503, `Retry-After`) một phần request thay vì để mọi request chậm rồi timeout. Từ chối rẻ hơn nhiều so với xử lý dở dang.
- **Admission control**: chỉ cho N người vào phiên làm bài đồng thời, người tới sau vào phòng chờ có thứ tự. Hợp cho kỳ thi: người đã vào làm bài có trải nghiệm ổn định.
- **Hàng đợi ưu tiên**: nộp bài ưu tiên hơn xem lịch sử; khi quá tải, cắt loại ít quan trọng trước.
- Giới hạn đồng thời trong .NET: `ConcurrencyLimiter` hoặc `SemaphoreSlim` quanh lời gọi DB (bulkhead).

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
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

#### Gọi giữa service
- **Timeout có ngân sách**: request vào có tổng ngân sách (ví dụ 2 giây); mỗi chặng con nhận phần còn lại, truyền deadline xuống (gRPC có deadline sẵn). Không đặt timeout chặng con dài hơn chặng cha.
- **Retry**: chỉ cho lỗi tạm thời và thao tác idempotent; exponential backoff + jitter; giới hạn số lần và có retry budget (ví dụ retry không quá 10% tổng request). Retry ở nhiều tầng nhân lên: 3 tầng × 3 lần = 27 lần gọi tới tầng cuối.
- **Circuit breaker**: lỗi vượt ngưỡng thì "mở mạch", trả lỗi ngay trong một khoảng thời gian, sau đó cho vài request thử (half-open). Bảo vệ cả dịch vụ đang hỏng lẫn tài nguyên của bên gọi.
- **Bulkhead**: chia tài nguyên (pool, giới hạn đồng thời) theo từng phụ thuộc, để một phụ thuộc chậm không chiếm hết thread/kết nối của cả service.
- **Hedged request**: gửi request thứ hai tới instance khác nếu request đầu chưa trả lời sau ngưỡng (ví dụ p95); lấy kết quả về trước. Giảm tail latency, đổi lại tăng tải; chỉ cho thao tác đọc idempotent.

.NET 8 có `Microsoft.Extensions.Http.Resilience` (dựa trên Polly v8): `AddStandardResilienceHandler()` gắn sẵn rate limiter, timeout tổng, retry, circuit breaker, timeout mỗi lần thử; `AddStandardHedgingHandler()` cho hedging.

```csharp
builder.Services.AddHttpClient<ScoreClient>(c => c.BaseAddress = new Uri("https://score.internal"))
    .AddStandardResilienceHandler(o =>
    {
        o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(3);
        o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(1);
        o.Retry.MaxRetryAttempts = 2;
    });
```

#### Suy giảm có kiểm soát
- **Graceful degradation**: khi phụ thuộc phụ hỏng, tắt tính năng phụ (gợi ý, thống kê), giữ luồng chính (làm bài, nộp bài).
- **Feature flag / kill switch**: bật tắt tính năng lúc chạy không cần deploy; kill switch là flag để tắt nhanh phần gây sự cố.

#### Warmup, cold start, thundering herd
Instance mới khởi động có JIT chưa chạy, cache trống, pool kết nối trống: request đầu chậm. Dùng readiness probe chỉ báo sẵn sàng sau khi warmup (nạp cache, mở sẵn kết nối, gọi thử endpoint nóng). Thundering herd: nhiều instance cùng khởi động (sau deploy, sau sự cố) cùng nạp cache, cùng kết nối DB; giãn thời điểm (rolling deploy, jitter khi khởi động), dùng L2 cache dùng chung.

#### Cell-based architecture
Chia hệ thống thành nhiều cell độc lập, mỗi cell đủ thành phần (app, cache, DB) và phục vụ một nhóm người dùng (theo tỉnh, theo trường). Sự cố hoặc deploy lỗi ở một cell chỉ ảnh hưởng nhóm đó (giới hạn blast radius). Đánh đổi: chi phí, định tuyến người dùng vào đúng cell, dữ liệu dùng chung giữa cell.

#### Kiểm chứng
- Load test vượt công suất: hệ thống trả 429/503 nhanh, p99 của request được nhận vẫn trong SLO, không sập dây chuyền.
- Fault injection: làm chậm một phụ thuộc, xác nhận circuit breaker mở, bulkhead giữ phần còn lại hoạt động.
- Đo thời gian từ lúc scale tới lúc instance mới nhận tải ổn định.

#### Bẫy
- Timeout chặng con dài hơn chặng cha: chặng cha đã bỏ cuộc nhưng chặng con vẫn làm, tốn tài nguyên vô ích.
- Retry thao tác không idempotent (nộp bài không có idempotency key): sinh bản ghi trùng.
- Autoscale theo CPU cho tải dồn trong vài giây: instance mới lên khi đỉnh đã qua.

#### Câu hỏi phỏng vấn
- **"Token bucket khác fixed window thế nào?"** Fixed window đếm theo khung cố định, cho phép gấp đôi giới hạn ở ranh giới hai khung. Token bucket cho phép burst tới dung lượng bucket rồi giới hạn theo tốc độ nạp, mượt hơn. Sliding window là lựa chọn ở giữa.
- **"Retry có thể làm sự cố tệ hơn như thế nào?"** Retry nhân tải lên dịch vụ đang quá tải, đặc biệt khi nhiều tầng cùng retry (3 tầng × 3 lần = 27 lần). Chỉ retry lỗi tạm thời và thao tác idempotent, có backoff + jitter, retry budget, và circuit breaker để dừng khi dịch vụ đang hỏng.
- **"Load shedding và rate limiting khác nhau ở đâu?"** Rate limiting giới hạn theo từng khách để công bằng và chống lạm dụng, áp dụng cả khi hệ thống rảnh. Load shedding dựa trên tình trạng của hệ thống: khi quá tải thì từ chối bớt request (ưu tiên giữ loại quan trọng) để phần còn lại vẫn nhanh.
- **"Hedged request giảm tail latency thế nào và giá phải trả là gì?"** Nếu request chưa trả lời sau ngưỡng như p95, gửi bản thứ hai tới instance khác và lấy kết quả về trước; p99 giảm vì ít khi cả hai cùng chậm. Giá: tăng tải (vài phần trăm nếu ngưỡng là p95), chỉ dùng cho thao tác idempotent.
- **"Kỳ thi bắt đầu lúc 8:00, bạn chuẩn bị scale thế nào?"** Scale theo lịch trước giờ mở ca (KEDA cron hoặc script), warmup instance (cache đề, kết nối), readiness probe sau warmup; admission control cho phòng chờ; rate limit cho nộp bài; load shedding cho tính năng phụ; theo dõi p99 và tỉ lệ lỗi theo thời gian thực.

#### Tóm tắt
- Service stateless để scale ngang; tải biết trước thì scale theo lịch.
- Rate limiting theo khách, load shedding theo tình trạng hệ thống, admission control cho phiên.
- Timeout có ngân sách, retry có backoff + jitter + budget, circuit breaker, bulkhead, hedging.
- Warmup trước khi nhận tải; giãn khởi động để tránh thundering herd.
- Cell-based architecture giới hạn phạm vi sự cố.

#### Bài tập
1. Một request đi qua gateway → API → dịch vụ điểm → DB, mỗi tầng retry 3 lần. Khi DB lỗi, một request người dùng tạo tối đa bao nhiêu lần gọi tới DB? Đề xuất sửa.
   **Đáp án:** Mỗi tầng gọi tối đa 4 lần (1 + 3 retry): 4 × 4 × 4 = 64 lần. Chỉ retry ở một tầng (gần lỗi nhất), có retry budget và circuit breaker.
2. Cấu hình token bucket cho API nộp bài: mỗi thí sinh tối đa 5 lần liên tiếp, sau đó 1 lần mỗi 2 giây.
   **Đáp án:** `TokenLimit = 5`, `TokensPerPeriod = 1`, `ReplenishmentPeriod = 2 s`, partition theo user; nếu nhiều instance thì giới hạn ở gateway hoặc Redis.
3. Liệt kê ba tính năng có thể tắt khi quá tải trong giờ thi và ba tính năng phải giữ.
   **Đáp án:** Tắt: bảng xếp hạng thời gian thực, lịch sử luyện tập, gợi ý bài. Giữ: vào phòng thi, lấy đề, lưu đáp án và nộp bài.

### Bài 23.5. Runtime .NET

#### Mục tiêu
- Sau bài này, bạn nhận ra và sửa được thread pool starvation do sync-over-async.
- Bạn giải thích được GC thế hệ, Server GC, LOH và giảm được cấp phát bằng `Span<T>`, `ArrayPool<T>`, object pooling.
- Bạn chọn được công cụ đo (`dotnet-counters`, `dotnet-trace`, BenchmarkDotNet) và biết khi nào dùng Native AOT, ReadyToRun.

#### Thread pool starvation
ASP.NET Core xử lý request trên thread của thread pool. Code async đúng cách trả thread về pool khi chờ I/O. Sync-over-async (`.Result`, `.Wait()`, `GetAwaiter().GetResult()` trên Task chưa xong) giữ thread chặn trong lúc chờ; phần tiếp theo của Task đó lại cần một thread khác từ pool để chạy. Khi tải cao, mọi thread đều bị chặn chờ những công việc đang xếp hàng sau chúng.

Thread pool có số thread tối thiểu bằng số CPU; vượt mức đó, nó chỉ thêm thread từ từ (thuật toán hill climbing, cỡ vài thread mỗi giây khi bị đói). Triệu chứng: latency tăng vọt theo bậc, CPU thấp, hàng đợi thread pool dài, số thread tăng dần đều.

```bash
dotnet-counters monitor -p <pid> --counters System.Runtime
# xem: ThreadPool Queue Length, ThreadPool Thread Count, ThreadPool Completed Work Item Count
# (tên counter khác nhau giữa các phiên bản .NET; .NET 9+ có tên dạng dotnet.thread_pool.queue.length)
```

Sửa gốc: async xuyên suốt từ controller tới driver DB. Tăng `ThreadPool.SetMinThreads` chỉ là băng tạm, che triệu chứng. Các nguồn chặn khác: `lock` quanh I/O, `Thread.Sleep`, thư viện chỉ có API đồng bộ.

#### GC và cấp phát
.NET GC chia heap theo thế hệ: Gen0 (đối tượng mới, thu gom thường xuyên và rẻ), Gen1 (đệm), Gen2 (sống lâu, thu gom đắt). Giả thuyết thế hệ: phần lớn đối tượng chết trẻ. Đối tượng từ 85.000 byte trở lên vào Large Object Heap (LOH), chỉ thu gom cùng Gen2 và mặc định không bị nén, dễ phân mảnh. Pinned Object Heap (từ .NET 5) cho buffer cần ghim.

- **Workstation GC**: một heap, hợp cho ứng dụng desktop.
- **Server GC**: mỗi core một heap và một luồng GC, thông lượng cao hơn, mặc định cho ASP.NET Core. Từ .NET 9, DATAS (Dynamic Adaptation To Application Sizes) bật mặc định với Server GC: số heap điều chỉnh theo tải, giảm bộ nhớ khi tải thấp.
- Background GC cho Gen2 chạy đồng thời với code ứng dụng, giảm thời gian dừng.

Cấp phát nhiều → GC chạy nhiều → CPU và pause tăng, p99 xấu. Cách giảm:

```csharp
// Span<T>: cắt chuỗi/mảng không cấp phát
ReadOnlySpan<char> line = "1001;A;45";
int sep = line.IndexOf(';');
int questionId = int.Parse(line[..sep]);

// ArrayPool<T>: mượn buffer thay vì new byte[] mỗi request
byte[] buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);
try { /* dùng buffer, chú ý độ dài thật có thể lớn hơn yêu cầu */ }
finally { ArrayPool<byte>.Shared.Return(buffer); }
```

- `Span<T>`/`ReadOnlySpan<T>` là kiểu `ref struct` chỉ sống trên stack, trỏ vào vùng nhớ có sẵn (mảng, chuỗi, `stackalloc`); không dùng được qua `await`. `Memory<T>` dùng được trong code async.
- `ObjectPool<T>` (Microsoft.Extensions.ObjectPool) cho đối tượng đắt khởi tạo (`StringBuilder` lớn).
- Tránh boxing, LINQ trong vòng lặp nóng, closure không cần thiết, chuỗi nối trong vòng lặp; `string.Create`, `StringBuilder`.

#### Serialization
- System.Text.Json source generator: sinh code serialize lúc build thay cho reflection lúc chạy, nhanh hơn, ít cấp phát, cần cho Native AOT.

```csharp
[JsonSerializable(typeof(ExamPaper))]
[JsonSerializable(typeof(List<RankItem>))]
internal partial class AppJsonContext : JsonSerializerContext { }

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.TypeInfoResolverChain.Insert(0, AppJsonContext.Default));
```

- Protobuf (gRPC) và MessagePack: định dạng nhị phân, nhỏ và nhanh hơn JSON, cần schema/contract; hợp cho giao tiếp nội bộ và value cache lớn.

#### HTTP trong .NET
- `IHttpClientFactory` hoặc `HttpClient` singleton với `SocketsHttpHandler.PooledConnectionLifetime` (bài 21.2).
- HTTP/2 multiplex nhiều request trên một kết nối; HTTP/3 chạy trên QUIC (UDP), tránh head-of-line blocking ở tầng TCP, hợp mạng di động.
- gRPC streaming cho luồng dữ liệu dài (đẩy trạng thái phòng thi).
- Nén response bằng Brotli/Gzip (`AddResponseCompression`); nén tốn CPU, cân nhắc ở reverse proxy; không nén response HTTPS chứa bí mật lẫn dữ liệu người dùng phản chiếu (rủi ro BREACH).

#### Đo
- `dotnet-counters`: số liệu thời gian thực (CPU, GC, thread pool, request/s, exception/s).
- `dotnet-trace`: thu trace CPU sampling, sự kiện GC; mở bằng PerfView, Visual Studio hoặc speedscope.
- `dotnet-dump`/`dotnet-gcdump`: xem heap, tìm rò rỉ bộ nhớ, xem stack của mọi thread khi treo.
- BenchmarkDotNet: micro-benchmark có warmup, nhiều lần lặp, thống kê, `[MemoryDiagnoser]` đo cấp phát.

```csharp
[MemoryDiagnoser]
public class ParseBench
{
    private const string Line = "1001;A;45";
    [Benchmark(Baseline = true)] public int Split() => int.Parse(Line.Split(';')[0]);
    [Benchmark] public int Span() => int.Parse(Line.AsSpan(0, Line.IndexOf(';')));
}
```

#### Khởi động nhanh
- **ReadyToRun**: biên dịch trước một phần sang mã máy, giảm JIT lúc khởi động; vẫn có JIT tối ưu sau (tiered compilation).
- **Native AOT**: biên dịch toàn bộ thành mã máy, khởi động nhanh, bộ nhớ thấp, không cần runtime cài sẵn. ASP.NET Core hỗ trợ từ .NET 8 cho minimal API và gRPC; không hỗ trợ MVC, nhiều thư viện dùng reflection động không chạy được. Hợp cho function, sidecar, service scale-out nhanh.

#### Kiểm chứng
- Thread pool queue length gần 0 trong đỉnh tải; số thread không tăng dần.
- `% time in GC` thấp (thường dưới vài phần trăm), tốc độ cấp phát giảm sau tối ưu; p99 ổn định hơn.

#### Bẫy
- Tăng `SetMinThreads` để "sửa" starvation: che lỗi, mỗi thread tốn bộ nhớ stack.
- Tối ưu cấp phát ở đoạn code không nóng: phức tạp hơn mà không đổi được gì. Đo trước bằng profiler.
- Quên trả buffer về `ArrayPool`, hoặc dùng buffer sau khi đã trả: lỗi dữ liệu khó tìm.

#### Câu hỏi phỏng vấn
- **"API chậm dần khi tải tăng nhưng CPU chỉ 20%, bạn nghi gì và kiểm tra thế nào?"** Nghi thread pool starvation do sync-over-async. Kiểm tra `dotnet-counters` (queue length cao, thread count tăng dần), lấy `dotnet-dump` xem nhiều thread chặn ở `.Result`/`.Wait()`. Sửa bằng async xuyên suốt.
- **"Server GC khác Workstation GC thế nào?"** Server GC có một heap và một luồng GC mỗi core, thông lượng cao hơn, tốn bộ nhớ hơn, mặc định cho ASP.NET Core; từ .NET 9 có DATAS điều chỉnh số heap theo tải. Workstation GC một heap, hợp ứng dụng client.
- **"Large Object Heap là gì và vì sao cần tránh cấp phát lớn liên tục?"** Đối tượng từ 85.000 byte trở lên vào LOH, chỉ thu gom cùng Gen2 và mặc định không nén, nên dễ phân mảnh và gây GC Gen2 đắt. Dùng `ArrayPool`, chia nhỏ, stream thay vì đọc cả khối.
- **"Span<T> giúp gì và có giới hạn gì?"** Cho phép làm việc trên một đoạn của mảng, chuỗi, bộ nhớ stack mà không cấp phát. Là `ref struct` nên chỉ sống trên stack: không làm field của class, không dùng qua `await`; khi cần trong async thì dùng `Memory<T>`.
- **"Khi nào chọn Native AOT?"** Khi khởi động nhanh và bộ nhớ thấp quan trọng: function, service scale-out theo đỉnh, sidecar. Đổi lại không có MVC, hạn chế reflection động, thư viện phải tương thích trimming; thông lượng lúc chạy lâu dài không chắc tốt hơn JIT.

#### Tóm tắt
- Sync-over-async gây thread pool starvation; sửa bằng async xuyên suốt.
- GC thế hệ; LOH từ 85.000 byte; Server GC mặc định cho web, DATAS từ .NET 9.
- Giảm cấp phát: `Span<T>`, `ArrayPool<T>`, object pool, JSON source generator.
- Đo bằng `dotnet-counters`, `dotnet-trace`, `dotnet-dump`, BenchmarkDotNet trước khi tối ưu.
- Native AOT, ReadyToRun cho khởi động nhanh.

#### Bài tập
1. Tìm lỗi: `public IActionResult Get(int id) { var r = _service.GetAsync(id).Result; return Ok(r); }` và sửa.
   **Đáp án:** Sync-over-async chặn thread pool. Sửa: `public async Task<IActionResult> Get(int id, CancellationToken ct) { var r = await _service.GetAsync(id, ct); return Ok(r); }`.
2. Viết benchmark so sánh `string.Split` và cách dùng `Span` để lấy phần tử đầu của chuỗi "1001;A;45"; dự đoán kết quả cột Allocated.
   **Đáp án:** Như mẫu trong bài; `Split` cấp phát mảng và 3 chuỗi (khoảng trên 100 byte), cách dùng `Span` cấp phát 0 byte.
3. Liệt kê ba counter cần xem khi nghi vấn đề GC.
   **Đáp án:** `% Time in GC`, Allocation Rate, Gen 0/1/2 GC Count (thêm GC Heap Size, LOH Size).

### Bài 23.6. Mạng và API

#### Mục tiêu
- Sau bài này, bạn giải thích được chi phí của kết nối mới (TCP, TLS) và cách tái sử dụng.
- Bạn thiết kế được API có payload nhỏ và phân trang bắt buộc; xử lý được N+1 trong GraphQL.
- Bạn ước lượng được latency theo khoảng cách và lập ngân sách latency cho từng chặng.

#### Chi phí kết nối
Một request HTTPS trên kết nối mới tốn: TCP handshake (1 RTT), TLS 1.3 handshake (1 RTT; TLS 1.2 là 2 RTT), rồi mới tới request (1 RTT). Với RTT 30 ms, kết nối mới tốn thêm 60 ms trước khi gửi byte dữ liệu đầu tiên, chưa kể CPU cho mã hoá khoá công khai.
- **Keep-alive**: giữ kết nối mở để dùng lại cho nhiều request. Đặt timeout keep-alive ở client ngắn hơn ở server/load balancer, tránh gửi request vào kết nối server vừa đóng.
- **TLS session resumption**: dùng lại khoá phiên đã thương lượng, bỏ phần tốn CPU; TLS 1.3 có 0-RTT nhưng dữ liệu 0-RTT có thể bị phát lại (replay), chỉ dùng cho request idempotent.
- HTTP/2 multiplex nhiều request trên một kết nối; HTTP/3/QUIC gộp handshake transport và TLS.

#### Payload
- Chỉ trả trường cần dùng; DTO riêng cho từng màn hình thay vì trả nguyên entity.
- Nén (Brotli/Gzip) cho JSON lớn; JSON lặp nhiều tên trường nén rất tốt.
- Định dạng nhị phân (Protobuf) cho giao tiếp nội bộ.
- Ảnh, file: trả URL tới object storage/CDN, không trả base64 trong JSON.

#### Phân trang bắt buộc
Mọi API trả danh sách phải có giới hạn. Hai kiểu:
- **Offset** (`OFFSET 10000 ROWS FETCH NEXT 20`): đơn giản, nhảy trang được, nhưng DB vẫn phải đọc và bỏ qua 10.000 dòng; trang càng sâu càng chậm; dữ liệu thay đổi giữa hai lần gọi gây trùng hoặc sót.
- **Keyset (cursor)**: nhớ khoá của dòng cuối trang trước, lấy các dòng sau nó; dùng index seek nên trang nào cũng nhanh như nhau.

```sql
SELECT TOP (20) SubmissionId, UserId, Score, SubmittedAt
FROM dbo.Submission
WHERE ExamId = @ExamId
  AND (SubmittedAt < @LastSubmittedAt
       OR (SubmittedAt = @LastSubmittedAt AND SubmissionId < @LastId))
ORDER BY SubmittedAt DESC, SubmissionId DESC;
-- index (ExamId, SubmittedAt DESC, SubmissionId DESC) INCLUDE (UserId, Score)
```

Server đặt `pageSize` tối đa, không tin giá trị client gửi.

#### GraphQL N+1
Resolver của trường con chạy một lần cho mỗi phần tử cha: danh sách 100 bài thi, mỗi bài resolve "môn học" bằng một truy vấn → 1 + 100 truy vấn. DataLoader gom các khoá được yêu cầu trong cùng một lượt thực thi thành một lời gọi theo lô (`WHERE SubjectId IN (...)`) và cache trong phạm vi request. HotChocolate (.NET) có DataLoader sẵn. Cũng cần giới hạn độ sâu và độ phức tạp truy vấn để client không gửi truy vấn quá nặng. Vấn đề N+1 không riêng GraphQL: ORM lazy loading trong REST cũng gây N+1.

#### Đa vùng và ngân sách latency
Ánh sáng trong cáp quang đi khoảng 200.000 km/s: mỗi 100 km khoảng cách thêm khoảng 1 ms RTT, chưa tính định tuyến. Hà Nội – TP.HCM khoảng 1.100–1.200 km đường thẳng, RTT thực tế thường vài chục ms. Một trang cần 10 request tuần tự giữa hai đầu thì riêng mạng đã vài trăm ms.

Ngân sách latency: tách mục tiêu p99 của API thành phần cho từng chặng (gateway, service, cache, DB, dịch vụ ngoài), mỗi chặng có timeout tương ứng. Khi một chặng vượt ngân sách, biết ngay phải sửa ở đâu.

Đa vùng (multi-region): đặt dữ liệu gần người dùng, đọc từ bản sao gần nhất. Khó ở phần ghi: một vùng chính ghi (các vùng khác chịu độ trễ ghi) hoặc nhiều vùng cùng ghi (phải xử lý xung đột). Chỉ làm khi yêu cầu latency hoặc chịu lỗi cấp vùng thật sự cần.

#### Kiểm chứng
- Số kết nối mới mỗi giây và tỉ lệ TLS resumption ở load balancer.
- Kích thước response p95 theo endpoint; số truy vấn DB mỗi request (từ tracing).
- Thời gian trang sâu với keyset so với offset trên dữ liệu thật.

#### Bẫy
- Keyset pagination với cột sắp xếp không duy nhất mà không thêm khoá phụ: sót hoặc trùng dòng.
- Bật 0-RTT cho request không idempotent: bị phát lại.
- Đo latency từ máy cùng data center rồi kết luận cho người dùng ở xa.

#### Câu hỏi phỏng vấn
- **"Vì sao trang 5.000 của danh sách chậm hơn trang 1 và bạn sửa thế nào?"** Offset pagination buộc DB đọc và bỏ qua mọi dòng trước trang đó. Chuyển sang keyset: nhớ khoá dòng cuối, lọc `WHERE (SortCol, Id) < (@last...)` với index đúng thứ tự, mọi trang đều là index seek. Nếu cần nhảy trang tuỳ ý, giới hạn độ sâu.
- **"GraphQL N+1 là gì và DataLoader giải quyết thế nào?"** Resolver con chạy một truy vấn cho mỗi phần tử cha, 100 phần tử thành 101 truy vấn. DataLoader gom khoá trong một lượt thực thi thành một truy vấn theo lô và cache trong request.
- **"Một kết nối HTTPS mới tốn bao nhiêu thời gian trước khi gửi dữ liệu?"** TCP 1 RTT + TLS 1.3 1 RTT (TLS 1.2 là 2 RTT), sau đó mới tới request. RTT 30 ms thì tốn thêm khoảng 60 ms, cộng CPU mã hoá. Keep-alive và session resumption tránh chi phí này.
- **"Bạn lập ngân sách latency cho API p99 300 ms thế nào?"** Chia cho từng chặng theo đo đạc thực tế, ví dụ gateway 20 ms, service 50 ms, cache 10 ms, DB 150 ms, dư 70 ms; timeout từng chặng theo ngân sách; tracing để thấy chặng nào vượt.

#### Tóm tắt
- Kết nối mới tốn 2–3 RTT và CPU TLS; keep-alive, resumption, HTTP/2 để dùng lại.
- Payload nhỏ: DTO theo màn hình, nén, nhị phân cho nội bộ.
- Phân trang bắt buộc; keyset cho danh sách lớn.
- N+1 xử lý bằng gom lô (DataLoader, `IN (...)`).
- Khoảng 1 ms RTT mỗi 100 km; lập ngân sách latency theo chặng.

#### Bài tập
1. Viết truy vấn keyset lấy 20 bài nộp tiếp theo theo `Score DESC, SubmissionId DESC`, biết điểm và Id của dòng cuối trang trước.
   **Đáp án:** `WHERE ExamId = @ExamId AND (Score < @LastScore OR (Score = @LastScore AND SubmissionId < @LastId)) ORDER BY Score DESC, SubmissionId DESC`, `TOP (20)`, index `(ExamId, Score DESC, SubmissionId DESC)`.
2. Một màn hình gọi 8 API tuần tự, RTT 40 ms, mỗi API xử lý 20 ms, dùng lại kết nối. Tính thời gian tối thiểu và đề xuất cải thiện.
   **Đáp án:** 8 × (40 + 20) = 480 ms. Gọi song song các API độc lập, gộp thành một API (BFF) trả đủ dữ liệu màn hình, hoặc cache phía client.
3. Kể hai cách giảm payload của API trả danh sách đề thi 2 MB.
   **Đáp án:** DTO chỉ chứa trường danh sách cần (bỏ nội dung câu hỏi, chỉ trả khi mở đề), phân trang, nén Brotli; ảnh trả URL CDN.

### Bài 23.7. Performance engineering

#### Mục tiêu
- Sau bài này, bạn dùng được RED, USE, SLI/SLO và error budget để định nghĩa "đủ nhanh".
- Bạn đọc được percentile từ histogram và giải thích vì sao không dùng trung bình.
- Bạn thiết kế được load test (soak, spike, stress) và áp dụng lý thuyết hàng đợi, Amdahl, USL vào capacity planning.

#### Metric: RED và USE
- **RED** cho service: Rate (request/giây), Errors (tỉ lệ lỗi), Duration (phân bố thời gian xử lý).
- **USE** cho tài nguyên (CPU, đĩa, mạng, pool, hàng đợi): Utilization (% thời gian bận), Saturation (mức xếp hàng, ví dụ run queue, queue length), Errors.
- **SLI** (chỉ số đo được, ví dụ % request nộp bài thành công dưới 500 ms), **SLO** (mục tiêu cho SLI, ví dụ 99,9% trong 30 ngày), **error budget** (phần được phép hỏng: 0,1% của 30 ngày ≈ 43,2 phút). Hết budget thì ưu tiên ổn định hơn tính năng mới.
- Cảnh báo theo burn rate: tốc độ tiêu budget. Burn rate 14,4 trong 1 giờ nghĩa là tiêu khoảng 2% budget 30 ngày trong 1 giờ; cảnh báo nhiều cửa sổ (nhanh và chậm) giảm báo động giả.

```promql
# Tỉ lệ request chậm hơn 500 ms trong 5 phút
1 - (
  sum(rate(http_server_request_duration_seconds_bucket{route="/exam/submit",le="0.5"}[5m]))
  /
  sum(rate(http_server_request_duration_seconds_count{route="/exam/submit"}[5m]))
)
```

#### Percentile, không phải trung bình
Trung bình che mất đuôi: 99 request 10 ms và 1 request 5 giây có trung bình khoảng 60 ms, nhưng 1% người dùng chờ 5 giây. Một trang gọi 20 API thì xác suất ít nhất một lời gọi rơi vào 1% chậm nhất là 1 − 0,99^20 ≈ 18%: p99 của từng API trở thành trải nghiệm thường gặp của trang. Dùng p50, p95, p99, p99,9 từ histogram.

Không lấy trung bình của các percentile (p99 của từng instance cộng lại chia đôi là sai); gộp histogram rồi mới tính percentile. Công cụ load test nhiều khi mắc lỗi coordinated omission: client chờ request chậm xong mới gửi request tiếp, nên số request chậm bị đếm thiếu. Dùng công cụ sinh tải theo tốc độ cố định (open model, như `constant-arrival-rate` của k6).

#### Quan sát
- **Distributed tracing** (OpenTelemetry): một trace đi qua mọi service, thấy chặng nào chậm. **Exemplar** gắn trace ID vào điểm metric, từ đồ thị p99 bấm thẳng tới trace của request chậm.
- **Continuous profiling** (Pyroscope, Parca): lấy mẫu CPU, cấp phát liên tục trên production với chi phí thấp; so sánh profile trước và sau deploy.

#### Load test
- **Load**: tải kỳ vọng, xác nhận SLO.
- **Stress**: tăng dần tới khi hỏng, tìm điểm gãy và cách hệ thống gãy (có từ chối sạch hay sập dây chuyền).
- **Spike**: tăng đột ngột (đầu ca thi), kiểm tra autoscale, cache lạnh, pool.
- **Soak**: tải vừa trong nhiều giờ, tìm rò rỉ bộ nhớ, kết nối, tăng dần latency.

Chạy trên dữ liệu cỡ production (bảng nhỏ thì mọi thứ nằm trong RAM, kết quả vô nghĩa), phân bố tham số giống thật (không phải cùng một user, cùng một đề). Cấu hình k6 cho kịch bản spike, dạng tốc độ đến cố định:

```json
{
  "scenarios": {
    "exam_start_spike": {
      "executor": "ramping-arrival-rate",
      "startRate": 100, "timeUnit": "1s",
      "preAllocatedVUs": 2000, "maxVUs": 10000,
      "stages": [
        { "target": 100,  "duration": "2m" },
        { "target": 5000, "duration": "30s" },
        { "target": 5000, "duration": "5m" },
        { "target": 100,  "duration": "1m" }
      ]
    }
  },
  "thresholds": { "http_req_duration{name:submit}": ["p(99)<500"], "http_req_failed": ["rate<0.001"] }
}
```

#### Lý thuyết hàng đợi và capacity planning
Với hàng đợi đơn giản (M/M/1), thời gian phản hồi R = S / (1 − U), S là thời gian phục vụ, U là mức sử dụng. U = 50% → R = 2S; U = 80% → 5S; U = 90% → 10S; U = 95% → 20S. Vì vậy vượt khoảng 70–80% utilization thì latency tăng vọt; capacity planning để đỉnh nằm dưới ngưỡng đó.

- **Amdahl's law**: speedup tối đa với N bộ xử lý = 1 / ((1 − p) + p/N), p là phần song song hoá được. p = 95% thì dù N vô hạn cũng chỉ nhanh gấp 20.
- **Universal Scalability Law**: C(N) = N / (1 + α(N − 1) + βN(N − 1)); α là tranh chấp (phần tuần tự), β là chi phí đồng bộ giữa các node (coherency). β > 0 thì thông lượng có điểm cực đại rồi giảm khi thêm node: thêm máy có thể làm chậm đi.
- Capacity planning: đo thông lượng mỗi instance ở mức utilization mục tiêu, dự báo đỉnh (số thí sinh × tỉ lệ đồng thời × request mỗi người), cộng dư cho mất một vùng/node.

#### Chặn hồi quy và chaos
- CI có benchmark gate (BenchmarkDotNet so với baseline, vượt ngưỡng thì fail), load test ngắn trên môi trường staging trước release.
- Query Store "Regressed Queries" sau mỗi deploy DB.
- Chaos engineering: chủ động gây lỗi có kiểm soát (giết instance, làm chậm DB, cắt mạng) để kiểm tra timeout, retry, circuit breaker hoạt động đúng như thiết kế; bắt đầu ở staging, phạm vi nhỏ, có nút dừng.

#### Kiểm chứng
- Mỗi API quan trọng có SLI, SLO, dashboard RED và cảnh báo burn rate.
- Báo cáo load test ghi rõ: kịch bản, dữ liệu, tốc độ đến, p50/p95/p99, tỉ lệ lỗi, tài nguyên nghẽn đầu tiên.

#### Bẫy
- Load test chỉ một endpoint với một tham số: cache hit 100%, kết quả lạc quan vô căn cứ.
- Báo cáo p99 từ công cụ closed model mà không xét coordinated omission.
- Đặt SLO 100%: không còn error budget, mọi thay đổi đều bị coi là rủi ro.

#### Câu hỏi phỏng vấn
- **"Vì sao không dùng latency trung bình để đánh giá API?"** Trung bình che đuôi phân bố; vài request rất chậm không làm trung bình đổi nhiều. Người dùng gặp đuôi thường xuyên vì một trang gọi nhiều API: 20 lời gọi thì khoảng 18% lượt tải trang chạm ít nhất một request p99. Dùng percentile từ histogram.
- **"Error budget là gì và dùng để làm gì?"** Phần không đạt SLO được phép trong một khoảng thời gian, ví dụ SLO 99,9% trong 30 ngày cho phép khoảng 43 phút. Còn budget thì được phát hành nhanh; tiêu nhanh (burn rate cao) thì cảnh báo, hết budget thì dừng tính năng mới để ưu tiên ổn định.
- **"Vì sao latency tăng vọt khi CPU vượt 80%?"** Theo lý thuyết hàng đợi, thời gian phản hồi xấp xỉ S / (1 − U): U 80% đã gấp 5 lần thời gian phục vụ, 90% gấp 10 lần. Request đến ngẫu nhiên nên hàng đợi dài ra rất nhanh khi gần bão hoà.
- **"Bạn load test cho kỳ thi thế nào?"** Kịch bản spike theo tốc độ đến cố định mô phỏng đầu ca và cuối ca, trên dữ liệu cỡ production với phân bố user, đề thật; ngưỡng p99 và tỉ lệ lỗi; theo dõi tài nguyên nghẽn đầu tiên (pool, DB, CPU, thread pool). Kèm soak test vài giờ để tìm rò rỉ.
- **"Universal Scalability Law nói gì mà Amdahl không nói?"** Amdahl chỉ có phần tuần tự nên thông lượng tiệm cận một mức trần. USL thêm chi phí đồng bộ giữa các node (β), khiến thông lượng đạt cực đại rồi giảm khi thêm node. Giải thích vì sao thêm máy có thể làm hệ thống chậm đi.

#### Tóm tắt
- RED cho service, USE cho tài nguyên; SLI, SLO, error budget, cảnh báo burn rate.
- Dùng percentile từ histogram; gộp histogram trước khi tính percentile; cẩn thận coordinated omission.
- Load test đủ bốn dạng, dữ liệu cỡ thật, tốc độ đến cố định.
- R = S / (1 − U): giữ đỉnh dưới 70–80% utilization.
- Chặn hồi quy trong CI; chaos engineering có kiểm soát.

#### Bài tập
1. SLO 99,95% trong 30 ngày. Tính error budget theo phút.
   **Đáp án:** 0,05% × 43.200 phút = 21,6 phút.
2. Thời gian phục vụ 20 ms. Tính thời gian phản hồi ở utilization 60%, 85%, 95% theo M/M/1.
   **Đáp án:** 20 / 0,4 = 50 ms; 20 / 0,15 ≈ 133 ms; 20 / 0,05 = 400 ms.
3. 70% công việc song song hoá được. Speedup tối đa với 8 core và với vô hạn core theo Amdahl?
   **Đáp án:** 1 / (0,3 + 0,7/8) = 1 / 0,3875 ≈ 2,58 lần; vô hạn core: 1 / 0,3 ≈ 3,33 lần.

### Bài 23.8. Vòng đời dữ liệu và chi phí

#### Mục tiêu
- Sau bài này, bạn thiết kế được phân tầng dữ liệu nóng, ấm, lạnh với TTL và nén phù hợp.
- Bạn tính được chi phí trên mỗi request và biết các đòn bẩy giảm chi phí chính.
- Bạn right-size được máy và DB dựa trên số đo.

#### Phân tầng nóng, ấm, lạnh
| Tầng | Đặc điểm truy cập | Nơi lưu điển hình | Ví dụ |
|---|---|---|---|
| Nóng | Đọc/ghi liên tục, cần ms | RAM, Redis, SSD, bảng chính | Ca thi đang diễn ra, cấu hình sự kiện |
| Ấm | Đọc thỉnh thoảng, chấp nhận chậm hơn | Bảng archive, replica, ổ rẻ hơn | Kết quả năm học hiện tại |
| Lạnh | Hiếm khi đọc, giữ cho đối soát, pháp lý | Object storage (tầng cool/archive), file Parquet, backup | Log đáp án các năm trước |

Dữ liệu di chuyển theo tuổi: partition switching (bài 20.3), job xuất ra Parquet, lifecycle rule của object storage tự chuyển tầng sau N ngày. Tầng lưu trữ archive của cloud rất rẻ nhưng lấy lại mất nhiều giờ và tốn phí truy xuất; chỉ đưa vào đó dữ liệu gần như không bao giờ đọc.

#### TTL ở mọi tầng
- Redis: mọi key cache có TTL.
- Bảng log: retention policy và job dọn (bài 20.3).
- Elasticsearch/OpenSearch: index theo ngày, Index Lifecycle Management xoá index cũ.
- Object storage: lifecycle rule xoá file tạm, bản export sau N ngày.
- Backup: chính sách giữ (ví dụ log 7 ngày, full hằng tuần 3 tháng, hằng tháng 1 năm).

#### Nén
- SQL Server row/page compression: giảm dung lượng và I/O (thường nhiều chục phần trăm với page compression), đổi lại tốn CPU khi đọc ghi. Ước lượng trước bằng `sp_estimate_data_compression_savings`.

```sql
EXEC sp_estimate_data_compression_savings
     @schema_name = 'dbo', @object_name = 'AnswerLog',
     @index_id = NULL, @partition_number = NULL, @data_compression = 'PAGE';

ALTER INDEX ALL ON dbo.AnswerLog REBUILD PARTITION = 1 WITH (DATA_COMPRESSION = PAGE);
```

- Columnstore nén rất cao; `COLUMNSTORE_ARCHIVE` nén thêm cho partition cũ hiếm đọc.
- Parquet + Zstd/Snappy cho dữ liệu lạnh: nhỏ và vẫn truy vấn được bằng công cụ phân tích.

#### FinOps: chi phí trên mỗi request
FinOps là gắn chi phí hạ tầng với giá trị nghiệp vụ để ra quyết định. Chỉ số cơ bản: chi phí trên mỗi đơn vị nghiệp vụ, ví dụ chi phí trên mỗi lượt thi = tổng chi phí hạ tầng của kỳ thi / số lượt thi. Theo dõi chỉ số này theo thời gian cho biết tối ưu có tác dụng thật hay chỉ chuyển chi phí sang chỗ khác.

Các đòn bẩy:
- **Right-sizing**: dựa trên utilization thật (CPU, RAM p95 trong nhiều tuần), giảm máy dư. Với SQL Server, license tính theo core, nên giảm core thừa tiết kiệm nhiều hơn tiền máy; tối ưu truy vấn giảm CPU có thể cho phép giảm core.
- **Tách tải theo đỉnh**: hệ thống thi có đỉnh vài giờ mỗi ngày. Autoscale tầng ứng dụng theo lịch; tầng DB khó co giãn thì giảm đỉnh bằng cache, hàng đợi.
- **Cam kết dài hạn** (reserved instance, savings plan) cho tải nền ổn định; instance giá rẻ có thể bị thu hồi (spot) cho job batch chịu được gián đoạn.
- **Lưu trữ**: dọn bảng backup, DB OFFLINE, log cũ (bài 20.3); phân tầng lạnh.
- **Truyền dữ liệu**: phí egress giữa vùng và ra internet; CDN và nén giảm egress.
- Gắn tag chi phí theo dịch vụ, theo đội để biết ai tiêu gì.

#### Kiểm chứng
- Chi phí trên mỗi lượt thi theo tháng; dung lượng mỗi tầng; utilization p95 của máy sau right-sizing vẫn trong ngưỡng an toàn.

#### Bẫy
- Right-sizing theo trung bình: máy đủ cho ngày thường, sập ở đỉnh kỳ thi.
- Đưa dữ liệu còn cần tra cứu (khiếu nại) vào tầng archive: lấy lại mất nhiều giờ, tốn phí.
- Nén page trên bảng ghi rất nóng: CPU tăng, insert chậm hơn.

#### Câu hỏi phỏng vấn
- **"Bạn phân tầng dữ liệu kết quả thi qua nhiều năm thế nào?"** Năm học hiện tại ở bảng chính (nóng/ấm), có index cho tra cứu; năm trước chuyển sang bảng archive nén page hoặc columnstore archive; dữ liệu nhiều năm xuất Parquet ra object storage tầng cool, giữ theo yêu cầu pháp lý; luôn có đường đọc cho tra cứu khiếu nại.
- **"Chi phí trên mỗi request dùng để làm gì?"** Gắn chi phí hạ tầng với đơn vị nghiệp vụ, so sánh theo thời gian và giữa các phương án. Nó cho biết tối ưu giảm chi phí thật hay chỉ chuyển sang chỗ khác, và giúp dự báo chi phí khi số người dùng tăng.
- **"Right-sizing server SQL Server cần lưu ý gì?"** Dựa trên p95 utilization và đỉnh theo mùa (kỳ thi), không theo trung bình; license tính theo core nên giảm core thừa tiết kiệm lớn; giảm RAM thì kiểm tra buffer pool và page life expectancy; thử trên replica hoặc môi trường test trước.
- **"Khi nào nên bật page compression?"** Bảng lớn, đọc nhiều, I/O là nút thắt, CPU còn dư: giảm dung lượng và số trang đọc. Không hợp với bảng ghi rất nóng và CPU đang cao. Ước lượng bằng `sp_estimate_data_compression_savings`, bật theo partition cũ trước.

#### Tóm tắt
- Dữ liệu chia nóng, ấm, lạnh; di chuyển theo tuổi bằng partition, export, lifecycle rule.
- Mọi tầng đều có TTL hoặc retention.
- Nén đổi CPU lấy dung lượng và I/O; ước lượng trước khi bật.
- FinOps: chi phí trên mỗi đơn vị nghiệp vụ; right-sizing theo p95 và đỉnh.
- License SQL Server theo core: tối ưu truy vấn có thể giảm chi phí license.

#### Bài tập
1. Kỳ thi tốn 120 triệu đồng hạ tầng mỗi tháng, phục vụ 2 triệu lượt thi. Sau tối ưu cache, chi phí còn 90 triệu, lượt thi tăng lên 2,5 triệu. Tính chi phí mỗi lượt thi trước và sau.
   **Đáp án:** Trước: 60 đồng/lượt; sau: 36 đồng/lượt, giảm 40%.
2. Viết lệnh ước lượng mức tiết kiệm khi bật page compression cho một bảng log.
   **Đáp án:** `EXEC sp_estimate_data_compression_savings 'dbo', 'AnswerLog', NULL, NULL, 'PAGE';`
3. Đề xuất chính sách giữ dữ liệu ba tầng cho log đáp án từng câu.
   **Đáp án:** Nóng: 30 ngày ở bảng chính partition theo ngày; ấm: tới hết năm học ở replica/bảng archive nén; lạnh: Parquet trên object storage tầng cool 5 năm; quá hạn thì xoá bằng lifecycle rule.

### Bài 23.9. Mảng khác chưa đi sâu

#### Mục tiêu
- Sau bài này, bạn nêu được các khái niệm cốt lõi của PostgreSQL, MySQL InnoDB khác SQL Server ở đâu.
- Bạn biết các điểm tối ưu chính ở tầng Linux, JVM, Go, frontend và dữ liệu lớn đủ để trao đổi với đội khác.
- Bạn biết mảng nào cần học sâu thêm tuỳ vị trí ứng tuyển.

#### PostgreSQL
- **MVCC**: `UPDATE` không sửa tại chỗ mà tạo phiên bản dòng mới (tuple), dòng cũ thành dead tuple. Khác SQL Server (version store riêng, chỉ khi bật RCSI/snapshot).
- **VACUUM và bloat**: autovacuum dọn dead tuple để tái sử dụng chỗ; bảng cập nhật nhiều mà vacuum không theo kịp thì phình (bloat), index cũng phình. Transaction mở lâu chặn vacuum dọn. VACUUM còn chống transaction ID wraparound; bỏ mặc thì DB có thể buộc dừng ghi.
- **`EXPLAIN (ANALYZE, BUFFERS)`**: chạy thật, cho số dòng thực tế và số buffer đọc từ cache (`shared hit`) hay từ đĩa (`read`); tương đương actual plan + `STATISTICS IO`.
- **PgBouncer**: PostgreSQL tạo một process cho mỗi kết nối, kết nối đắt hơn SQL Server nhiều; PgBouncer gộp kết nối. Chế độ transaction pooling cho phép nhiều client dùng chung ít kết nối thật, đổi lại không dùng được tính năng gắn với session (biến session, advisory lock theo session; prepared statement chỉ được hỗ trợ ở bản PgBouncer mới).

#### MySQL InnoDB
- **Clustered primary key**: bảng luôn được tổ chức theo PK; index phụ chứa giá trị PK làm con trỏ, nên PK dài (UUID chuỗi) làm mọi index phụ to ra.
- **Buffer pool** (`innodb_buffer_pool_size`): tương tự buffer pool SQL Server, thường đặt phần lớn RAM máy chuyên dụng.
- **Gap lock / next-key lock**: mức cô lập mặc định REPEATABLE READ khoá cả khoảng trống giữa các khoá index để chống phantom; truy vấn cập nhật theo khoảng không có index phù hợp có thể khoá rộng, gây deadlock bất ngờ khi insert đồng thời.

#### Linux
- **TCP backlog** (`net.core.somaxconn`, backlog của listen): hàng chờ kết nối chưa được accept; đầy thì kết nối mới bị từ chối hoặc trễ trong đỉnh.
- **File descriptor** (`ulimit -n`): mỗi socket là một fd; giới hạn thấp gây lỗi "too many open files" khi nhiều kết nối.
- **NUMA**: truy cập bộ nhớ của node khác chậm hơn; ảnh hưởng DB lớn và tiến trình nhiều thread.
- **Công cụ của Brendan Gregg**: phương pháp USE, `perf` (CPU profiling, flame graph), eBPF (`bcc`, `bpftrace`) để đo độ trễ I/O, syscall, mạng với chi phí thấp trên production.

```bash
# Kiểm tra nhanh 60 giây đầu khi máy chậm (theo checklist của Brendan Gregg)
uptime; dmesg | tail; vmstat 1 5; mpstat -P ALL 1 3; pidstat 1 3
iostat -xz 1 3; free -m; sar -n DEV 1 3; sar -n TCP,ETCP 1 3; top -b -n 1 | head -20
```

#### Runtime khác
- **JVM**: GC thế hệ tương tự .NET; G1 là mặc định, ZGC và Shenandoah cho pause rất ngắn với heap lớn; JIT với warmup (tiered compilation), nên load test phải có giai đoạn warmup.
- **Go**: goroutine nhẹ (stack nhỏ, tự lớn), scheduler M:N; `GOMAXPROCS` (cần khớp với giới hạn CPU của container ở các bản cũ); `pprof` cho CPU, heap, goroutine, block profile; GC đồng thời ưu tiên pause ngắn.

#### Frontend và mobile
- **Core Web Vitals**: LCP (thời gian hiển thị phần tử lớn nhất, tốt khi dưới 2,5 s), INP (độ trễ phản hồi tương tác, tốt khi dưới 200 ms; thay FID từ 2024), CLS (độ xô lệch bố cục, tốt khi dưới 0,1).
- Bundle size: chia nhỏ theo route (code splitting), bỏ thư viện thừa (tree shaking), nén.
- Lazy loading ảnh và component ngoài màn hình; ảnh định dạng hiện đại (WebP, AVIF) qua CDN.
- Backend ảnh hưởng trực tiếp: TTFB, payload, số request tuần tự (bài 23.6).

#### Dữ liệu lớn và tìm kiếm
- **Spark**: xử lý phân tán trên cụm; chú ý shuffle (đắt nhất), lệch dữ liệu (skew), số partition.
- **Data lake**: file Parquet trên object storage, định dạng bảng (Delta Lake, Apache Iceberg) thêm transaction, schema evolution, time travel; tách lưu trữ và tính toán.
- **Elasticsearch/OpenSearch**: số shard chọn khi tạo index (nhiều shard nhỏ tốn overhead; thường nhắm cỡ vài chục GB mỗi shard); mapping đúng (`keyword` cho lọc/gom nhóm chính xác, `text` cho tìm toàn văn); `refresh_interval` mặc định 1 giây quyết định bao lâu tài liệu mới tìm được, tăng lên (hoặc tắt khi nạp hàng loạt) để tăng tốc ghi.

#### Kiểm chứng
- Với mỗi mảng, tự trả lời được: nút thắt điển hình là gì, đo bằng công cụ nào, một cấu hình quan trọng nhất là gì.

#### Bẫy
- Mang thói quen SQL Server sang PostgreSQL: mở hàng nghìn kết nối trực tiếp, bỏ qua vacuum, transaction mở lâu.
- Dùng UUID chuỗi làm PK trong InnoDB: mọi index phụ to ra, insert ngẫu nhiên vào B-tree.
- Kết luận về hệ thống Linux từ một lần `top`: cần số theo thời gian (`vmstat`, `iostat`, `sar`).

#### Câu hỏi phỏng vấn
- **"MVCC của PostgreSQL khác row versioning của SQL Server thế nào?"** PostgreSQL luôn tạo phiên bản dòng mới ngay trong bảng, dòng cũ thành dead tuple chờ VACUUM dọn; bảng cập nhật nhiều có thể bloat. SQL Server mặc định sửa tại chỗ và dùng khoá; chỉ khi bật RCSI/snapshot mới lưu phiên bản cũ trong version store (tempdb hoặc PVS khi bật ADR).
- **"Vì sao PostgreSQL thường cần PgBouncer?"** Mỗi kết nối là một process riêng, tốn bộ nhớ và chi phí tạo; hàng nghìn kết nối làm server chậm. PgBouncer transaction pooling cho nhiều client dùng chung ít kết nối thật; đổi lại hạn chế tính năng gắn với session.
- **"Gap lock trong InnoDB gây vấn đề gì?"** Ở REPEATABLE READ, InnoDB khoá cả khoảng giữa các khoá index để chống phantom. Cập nhật hay xoá theo khoảng, đặc biệt không có index phù hợp, khoá rộng và chặn insert của phiên khác, dễ deadlock. Index đúng hoặc dùng READ COMMITTED nếu nghiệp vụ cho phép.
- **"Core Web Vitals gồm những chỉ số nào và backend ảnh hưởng tới chỉ số nào?"** LCP, INP, CLS. Backend ảnh hưởng LCP qua TTFB, kích thước payload, số request tuần tự; ảnh hưởng INP khi tương tác phải chờ API chậm.
- **"refresh_interval trong Elasticsearch là gì?"** Khoảng thời gian index làm mới để tài liệu mới tìm được, mặc định 1 giây. Mỗi lần refresh tạo segment mới, tốn tài nguyên; khi nạp hàng loạt nên tăng hoặc tắt tạm, chấp nhận dữ liệu mới tìm thấy chậm hơn.

#### Tóm tắt
- PostgreSQL: MVCC sinh dead tuple, VACUUM là bắt buộc, PgBouncer cho kết nối.
- InnoDB: bảng theo PK, index phụ chứa PK, gap lock ở REPEATABLE READ.
- Linux: backlog, file descriptor, NUMA; đo bằng `perf`, eBPF, checklist 60 giây.
- JVM, Go có GC và công cụ profiling riêng; nguyên tắc đo trước khi tối ưu giống .NET.
- Frontend: LCP, INP, CLS; dữ liệu lớn: shuffle, định dạng bảng, shard và mapping của Elasticsearch.

#### Bài tập
1. Bảng PostgreSQL cập nhật 10 triệu lần mỗi ngày, dung lượng tăng liên tục dù số dòng không đổi. Nêu nguyên nhân và cách kiểm tra.
   **Đáp án:** Bloat do dead tuple chưa được vacuum dọn kịp, có thể do transaction mở lâu hoặc autovacuum cấu hình quá thận trọng. Kiểm tra `pg_stat_user_tables` (`n_dead_tup`, `last_autovacuum`), `pg_stat_activity` tìm transaction lâu; chỉnh autovacuum riêng cho bảng.
2. Chọn mapping cho trường `schoolName` cần cả tìm toàn văn lẫn gom nhóm chính xác trong Elasticsearch.
   **Đáp án:** Multi-field: `text` cho tìm kiếm và sub-field `keyword` (ví dụ `schoolName.raw`) cho lọc, sắp xếp, aggregation.
3. Liệt kê ba lệnh Linux đầu tiên bạn chạy khi API trên máy Linux chậm, và mỗi lệnh cho biết gì.
   **Đáp án:** `uptime` (load average theo thời gian), `vmstat 1` (run queue, swap, CPU user/system/iowait), `iostat -xz 1` (độ trễ và mức bận của đĩa); thêm `sar -n TCP,ETCP 1` cho lỗi và retransmit TCP.
