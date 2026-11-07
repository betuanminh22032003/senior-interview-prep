import { useState } from 'react';
import { fmt, Seg, VizFrame } from './ui';

type Group = 'cpu' | 'parallel' | 'memory' | 'log' | 'latch' | 'lock' | 'client' | 'external' | 'background';

const GROUP_LABEL: Record<Group, string> = {
  cpu: 'CPU, worker',
  parallel: 'Song song',
  memory: 'Bộ nhớ',
  log: 'Ghi log',
  latch: 'Latch',
  lock: 'Khoá',
  client: 'Client',
  external: 'Gọi ra ngoài SQL',
  background: 'Wait nền',
};

interface Info {
  group: Group;
  meaning: string;
  fix: string;
  check: string;
}

const INFO: Record<string, Info> = {
  SOS_SCHEDULER_YIELD: {
    group: 'cpu',
    meaning: 'Thread dùng hết lượt CPU (4 ms) rồi nhường cho thread khác. Nhiều nghĩa là CPU đang bận.',
    fix: 'Giảm việc tốn CPU: index để bỏ scan, bỏ RBAR, cache kết quả gọi nhiều, nâng cost threshold for parallelism.',
    check: 'Top truy vấn theo total_worker_time trong sys.dm_exec_query_stats hoặc Query Store.',
  },
  THREADPOOL: {
    group: 'cpu',
    meaning: 'Không còn worker rảnh để nhận request mới. Request mới xếp hàng, API phía trên timeout dây chuyền.',
    fix: 'Rút ngắn truy vấn, gỡ chuỗi chặn khoá, tách truy vấn báo cáo sang replica. Không tăng max worker threads.',
    check: 'sys.dm_os_schedulers (work_queue_count), sp_WhoIsActive, chuỗi blocking. Khi đã nghẽn cần kết nối DAC.',
  },
  CXPACKET: {
    group: 'parallel',
    meaning: 'Các luồng của một truy vấn song song chờ nhau trao đổi dữ liệu.',
    fix: 'Nâng cost threshold for parallelism (5 → ~50), đặt MAXDOP theo số core/NUMA, sửa truy vấn lớn hoặc phân bố lệch.',
    check: 'Truy vấn song song có cost thấp trong plan cache; plan có toán tử Parallelism.',
  },
  CXCONSUMER: {
    group: 'parallel',
    meaning: 'Luồng tiêu thụ chờ luồng sản xuất trong truy vấn song song. Phần lớn là bình thường.',
    fix: 'Thường không xử lý riêng; xem CXPACKET và cấu hình song song.',
    check: 'So với CXPACKET; nếu chỉ CXCONSUMER cao thì ít đáng lo.',
  },
  CXSYNC_PORT: {
    group: 'parallel',
    meaning: 'Đồng bộ giữa các nhánh của truy vấn song song (SQL Server 2022). Cao khi nhiều truy vấn báo cáo chạy song song.',
    fix: 'Cost threshold for parallelism, MAXDOP; index để truy vấn báo cáo không cần quét lớn; dời job nặng ra ngoài giờ cao điểm.',
    check: 'Truy vấn song song đang chạy trong sys.dm_exec_requests (dop > 1).',
  },
  RESOURCE_SEMAPHORE: {
    group: 'memory',
    meaning: 'Truy vấn chờ được cấp memory grant cho Sort/Hash vì quỹ đã bị các truy vấn khác giữ.',
    fix: 'Index bỏ Sort/Hash, sửa ước lượng, Resource Governor hoặc MAX_GRANT_PERCENT cho truy vấn báo cáo và công cụ giám sát.',
    check: 'sys.dm_exec_query_memory_grants (granted vs used), max_used_grant_kb trong dm_exec_query_stats.',
  },
  RESOURCE_SEMAPHORE_MUTEX: {
    group: 'memory',
    meaning: 'Tranh chấp khi xin grant cho truy vấn hoặc compile.',
    fix: 'Giảm truy vấn xin grant lớn; báo cáo xác định nguồn là công cụ giám sát.',
    check: 'sys.dm_exec_query_memory_grants theo login/ứng dụng.',
  },
  MEMORY_ALLOCATION_EXT: {
    group: 'memory',
    meaning: 'Cấp phát bộ nhớ nội bộ. Số lượt rất lớn nhưng thời gian mỗi lượt rất nhỏ.',
    fix: 'Thường không cần xử lý riêng.',
    check: 'Thời gian trung bình mỗi lượt.',
  },
  WRITELOG: {
    group: 'log',
    meaning: 'Commit chờ ghi transaction log xuống đĩa.',
    fix: 'Đĩa log nhanh và riêng; log không bị đầy hoặc tự tăng liên tục; gom commit nhỏ thành lô; bỏ index thừa (ít log hơn).',
    check: 'sys.dm_io_virtual_file_stats: độ trễ ghi của file log; log_reuse_wait_desc.',
  },
  PAGELATCH_EX: {
    group: 'latch',
    meaning: 'Tranh chấp một trang trong bộ nhớ: nhiều luồng cùng chèn vào trang cuối, hoặc trang cấp phát của tempdb.',
    fix: 'OPTIMIZE_FOR_SEQUENTIAL_KEY = ON, partition/hash khoá, nhiều file tempdb cùng kích thước.',
    check: 'sys.dm_db_index_operational_stats (page_latch_wait_count), resource của wait trong dm_os_waiting_tasks.',
  },
  LATCH_EX: {
    group: 'latch',
    meaning: 'Latch không phải trang dữ liệu, thường gặp khi scan song song lớn.',
    fix: 'Giảm scan lớn song song (index, cost threshold).',
    check: 'sys.dm_os_latch_stats để biết loại latch.',
  },
  LCK_M_S: {
    group: 'lock',
    meaning: 'Câu đọc chờ khoá chia sẻ vì đang có transaction ghi giữ khoá.',
    fix: 'Transaction ngắn, index để khoá ít dòng hơn, cân nhắc RCSI để đọc không bị ghi chặn.',
    check: 'blocked process report, sp_WhoIsActive @find_block_leaders = 1.',
  },
  ASYNC_NETWORK_IO: {
    group: 'client',
    meaning: 'SQL đã có dữ liệu, đang chờ client đọc. Lỗi thường ở app, không ở mạng.',
    fix: 'Phân trang, chọn đủ cột, đọc hết result set rồi mới xử lý.',
    check: 'Câu nào trả nhiều dòng (rows trong dm_exec_query_stats); app đọc từng dòng trong vòng lặp nặng.',
  },
  MSQL_DQ: {
    group: 'external',
    meaning: 'Chờ distributed query qua linked server.',
    fix: 'Bỏ gọi linked server trong transaction; ghi outbox rồi worker gửi sang; kéo dữ liệu remote vào #temp trước khi join.',
    check: 'Proc có tên 4 phần [server].[db].[schema].[obj] hoặc OPENQUERY.',
  },
  OLEDB: {
    group: 'external',
    meaning: 'Chờ OLE DB provider, thường là linked server.',
    fix: 'Như MSQL_DQ.',
    check: 'Như MSQL_DQ.',
  },
  MSQL_XP: {
    group: 'external',
    meaning: 'Chờ extended stored procedure (xp_cmdshell, xp_fileexist, xp_regread...).',
    fix: 'Tìm job hoặc công cụ gọi xp_* và giảm tần suất; báo cáo chỉ ra công cụ giám sát.',
    check: 'sp_WhoIsActive lúc wait tăng; lịch job trong msdb.',
  },
  PREEMPTIVE_COM_QUERYINTERFACE: {
    group: 'external',
    meaning: 'SQL gọi ra COM/OLE DB bên ngoài (linked server, sp_OA*).',
    fix: 'Giảm gọi linked server, OPENQUERY, sp_OACreate.',
    check: 'Như MSQL_DQ.',
  },
  PREEMPTIVE_OS_CRYPTOPS: {
    group: 'external',
    meaning: 'Gọi hàm mã hoá của hệ điều hành, thường là bắt tay TLS khi mở kết nối mới.',
    fix: 'Bật connection pooling, dùng lại kết nối; kiểm tra app có mở/đóng kết nối liên tục.',
    check: 'Số login/giây (perfmon Logins/sec) so với số request.',
  },
  PREEMPTIVE_OS_QUERYREGISTRY: {
    group: 'external',
    meaning: 'Đọc registry, thường do xp_regread của công cụ giám sát hoặc backup.',
    fix: 'Giảm tần suất poll của công cụ.',
    check: 'Như MSQL_XP.',
  },
  XE_FILE_TARGET_TVF: {
    group: 'external',
    meaning: 'Đọc file Extended Events, thường do công cụ giám sát đọc system_health.',
    fix: 'Giảm tần suất đọc.',
    check: 'Câu dùng sys.fn_xe_file_target_read_file.',
  },
  QDS_ASYNC_QUEUE: {
    group: 'background',
    meaning: 'Hàng đợi nền của Query Store. Thường nằm trong danh sách wait nền cần lọc bỏ.',
    fix: 'Kiểm chứng trước khi coi là điểm nghẽn: xem Query Store có ở trạng thái READ_ONLY do đầy, hay cảnh báo flush chậm.',
    check: 'sys.database_query_store_options (actual_state_desc, current_storage_size_mb).',
  },
  WAIT_XTP_HOST_WAIT: {
    group: 'background',
    meaning: 'Wait nền của In-Memory OLTP. Thường được lọc bỏ.',
    fix: 'Không cần xử lý nếu không dùng bảng memory-optimized.',
    check: 'sys.dm_db_xtp_table_memory_stats.',
  },
  PWAIT_DIRECTLOGCONSUMER_GETNEXT: {
    group: 'background',
    meaning: 'Wait nền đọc log nội bộ. Thường được lọc bỏ.',
    fix: 'Không cần xử lý.',
    check: '',
  },
};

// Seconds accumulated since startup, from the report. Uptime differs per cluster.
const CLUSTERS: { id: string; label: string; waits: [string, number][] }[] = [
  {
    id: 'c1',
    label: 'Cụm 1 · log tự luyện',
    waits: [
      ['QDS_ASYNC_QUEUE', 28_908_639],
      ['WAIT_XTP_HOST_WAIT', 21_114_865],
      ['SOS_SCHEDULER_YIELD', 15_354_384],
      ['PWAIT_DIRECTLOGCONSUMER_GETNEXT', 9_197_902],
      ['CXCONSUMER', 5_616_692],
      ['LATCH_EX', 3_853_647],
      ['WRITELOG', 3_632_543],
      ['CXPACKET', 2_504_266],
      ['THREADPOOL', 1_411_475],
      ['PAGELATCH_EX', 356_874],
    ],
  },
  {
    id: 'c2',
    label: 'Cụm 2 · core người dùng',
    waits: [
      ['MSQL_DQ', 991_580],
      ['ASYNC_NETWORK_IO', 912_375],
      ['OLEDB', 778_742],
      ['PREEMPTIVE_COM_QUERYINTERFACE', 270_866],
      ['PREEMPTIVE_OS_CRYPTOPS', 249_614],
      ['MSQL_XP', 242_674],
      ['PREEMPTIVE_OS_QUERYREGISTRY', 155_389],
    ],
  },
  {
    id: 'c3',
    label: 'Cụm 3 · log thi chính thức',
    waits: [
      ['THREADPOOL', 3_429_319],
      ['WRITELOG', 3_084_404],
      ['MSQL_XP', 658_519],
      ['MEMORY_ALLOCATION_EXT', 51_429],
      ['XE_FILE_TARGET_TVF', 37_502],
      ['RESOURCE_SEMAPHORE_MUTEX', 33_739],
      ['LCK_M_S', 14_396],
    ],
  },
  {
    id: 'c4',
    label: 'Cụm 4 · kho dữ liệu',
    waits: [
      ['CXSYNC_PORT', 13_040_630],
      ['QDS_ASYNC_QUEUE', 3_636_663],
      ['SOS_SCHEDULER_YIELD', 386_893],
      ['RESOURCE_SEMAPHORE', 86_939],
      ['MSQL_XP', 75_682],
    ],
  },
];

export function Waits() {
  const [cluster, setCluster] = useState('c1');
  const [hideBg, setHideBg] = useState(false);
  const [picked, setPicked] = useState('SOS_SCHEDULER_YIELD');

  const c = CLUSTERS.find((x) => x.id === cluster)!;
  const rows = c.waits.filter(([w]) => !hideBg || INFO[w].group !== 'background');
  const max = Math.max(...rows.map(([, s]) => s));
  const total = rows.reduce((n, [, s]) => n + s, 0);
  const current = rows.some(([w]) => w === picked) ? picked : rows[0][0];
  const info = INFO[current];

  return (
    <VizFrame
      title="Wait stats các cụm trong báo cáo"
      hint="Bấm một wait để xem nghĩa, cách xử lý và cách kiểm tra. Số giây cộng dồn từ lúc khởi động, mỗi cụm uptime khác nhau nên chỉ so trong cùng cụm."
    >
      <Seg value={cluster} onChange={setCluster} options={CLUSTERS.map((x) => ({ value: x.id, label: x.label }))} />
      <label className="toggle">
        <input type="checkbox" checked={hideBg} onChange={(e) => setHideBg(e.target.checked)} />
        <span>Ẩn wait nền (Query Store, XTP, log nội bộ)</span>
      </label>

      <div className="wait-list">
        {rows.map(([w, s]) => {
          const g = INFO[w].group;
          return (
            <button key={w} className={`wait-row ${w === current ? 'active' : ''}`} onClick={() => setPicked(w)}>
              <span className="wait-name mono">{w}</span>
              <span className="wait-track">
                <i className={`g-${g}`} style={{ transform: `scaleX(${s / max})` }} />
              </span>
              <span className="wait-pct mono">{fmt((s / total) * 100, 1)}%</span>
            </button>
          );
        })}
      </div>

      <div className="wait-detail">
        <p className="wait-detail-head">
          <span className="mono">{current}</span>
          <span className={`badge wait-badge g-${info.group}`}>{GROUP_LABEL[info.group]}</span>
        </p>
        <p>
          <strong>Nghĩa là:</strong> {info.meaning}
        </p>
        <p>
          <strong>Xử lý:</strong> {info.fix}
        </p>
        {info.check && (
          <p>
            <strong>Kiểm tra bằng:</strong> {info.check}
          </p>
        )}
      </div>
      <p className="viz-note">% tính trên các wait đang hiển thị, không phải trên toàn bộ wait của server.</p>
    </VizFrame>
  );
}
