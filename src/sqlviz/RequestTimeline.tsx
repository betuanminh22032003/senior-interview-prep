import { useState } from 'react';
import { fmt, Metric, VizFrame } from './ui';

type Fix = 'position' | 'register' | 'static' | 'grpc';
type Lane = 'position' | 'register' | 'filter' | 'static' | 'common' | 'other' | 'grpc';

const LANES: { id: Lane; label: string }[] = [
  { id: 'position', label: 'Lấy vị trí user' },
  { id: 'register', label: 'Kiểm tra điều kiện thi' },
  { id: 'filter', label: 'Lọc học sinh theo trường' },
  { id: 'static', label: 'Đọc vòng tự luyện' },
  { id: 'common', label: 'Thông tin chung' },
  { id: 'other', label: 'Ghi DB, logic khác' },
  { id: 'grpc', label: 'Bắn event gRPC' },
];

// Spans of the 504 ms trace in Vấn đề 3, in call order. `fix` marks spans that fix removes.
const SPANS: { lane: Lane; ms: number; note: string; fix?: Fix }[] = [
  { lane: 'position', ms: 15, note: 'Đầu luồng' },
  { lane: 'position', ms: 15, note: 'Kiểm tra tài khoản cũ, đọc lại DB', fix: 'position' },
  { lane: 'register', ms: 3.7, note: 'Lần 1' },
  { lane: 'filter', ms: 94, note: 'Trượt cache, quét bảng + JSON', fix: 'register' },
  { lane: 'register', ms: 5, note: 'Lần 2', fix: 'register' },
  { lane: 'position', ms: 14, note: 'Kiểm tra đã thi, đọc lại DB', fix: 'position' },
  { lane: 'register', ms: 5.5, note: 'Lần 3', fix: 'register' },
  { lane: 'position', ms: 11, note: 'Kiểm tra đổi thông tin, đọc lại DB', fix: 'position' },
  { lane: 'register', ms: 5.3, note: 'Lần 4', fix: 'register' },
  { lane: 'register', ms: 4.9, note: 'Lần 5', fix: 'register' },
  { lane: 'static', ms: 65, note: 'Mã dịch vụ IOE' },
  { lane: 'static', ms: 67, note: 'Mã dịch vụ IOSTEM', fix: 'static' },
  { lane: 'common', ms: 20, note: 'Lần 1' },
  { lane: 'common', ms: 20, note: 'Lần 2' },
  { lane: 'other', ms: 134.4, note: 'Phần còn lại của trace' },
  { lane: 'position', ms: 15, note: 'Đọc lại sau khi ghi', fix: 'position' },
  { lane: 'grpc', ms: 5.3, note: 'Tạo GrpcChannel mới', fix: 'grpc' },
  { lane: 'grpc', ms: 3.9, note: 'Tạo GrpcChannel mới', fix: 'grpc' },
];

const FIXES: { id: Fix; label: string }[] = [
  { id: 'position', label: 'Nạp vị trí user một lần, truyền xuống hàm con' },
  { id: 'register', label: 'Cache kết quả kiểm tra điều kiện thi' },
  { id: 'static', label: 'Gom 2 lần đọc vòng tự luyện thành 1 truy vấn' },
  { id: 'grpc', label: 'GrpcChannel singleton, đẩy event ra hàng đợi nền' },
];

const BEFORE = SPANS.reduce((n, s) => n + s.ms, 0);

export function RequestTimeline() {
  const [on, setOn] = useState<Record<Fix, boolean>>({ position: false, register: false, static: false, grpc: false });

  let t = 0;
  const placed = SPANS.map((s) => {
    const removed = !!s.fix && on[s.fix];
    const start = t;
    if (!removed) t += s.ms;
    return { ...s, start, removed };
  });
  const total = t;
  const saved = (f: Fix) => SPANS.filter((s) => s.fix === f).reduce((n, s) => n + s.ms, 0);
  const calls = placed.filter((s) => !s.removed && s.lane !== 'other').length;

  return (
    <VizFrame
      title="Trace một API cập nhật thông tin: 504 ms"
      hint="Bật từng cách sửa trong báo cáo và xem các span biến mất. Trục ngang là thời gian, mỗi hàng là một loại lời gọi."
    >
      <div className="fixes">
        {FIXES.map((f) => (
          <label key={f.id} className={`toggle fix ${on[f.id] ? 'checked' : ''}`}>
            <input type="checkbox" checked={on[f.id]} onChange={(e) => setOn((o) => ({ ...o, [f.id]: e.target.checked }))} />
            <span>{f.label}</span>
            <span className="mono muted">−{fmt(saved(f.id), 1)} ms</span>
          </label>
        ))}
      </div>

      <div className="gantt">
        {LANES.map((lane) => (
          <div key={lane.id} className="gantt-row">
            <span className="gantt-label">{lane.label}</span>
            <span className="gantt-track">
              {placed
                .filter((s) => s.lane === lane.id)
                .map((s, i) => (
                  <i
                    key={i}
                    className={`span-${lane.id === 'other' ? 'other' : lane.id === 'grpc' ? 'grpc' : 'db'} ${s.removed ? 'gone' : ''}`}
                    style={{ left: `${(s.start / BEFORE) * 100}%`, width: `${(s.ms / BEFORE) * 100}%` }}
                    title={`${lane.label} · ${s.note} · ${fmt(s.ms, 1)} ms`}
                  />
                ))}
            </span>
          </div>
        ))}
        <div className="gantt-row">
          <span className="gantt-label" />
          <span className="gantt-axis">
            <span>0</span>
            <span>{fmt(BEFORE / 2)} ms</span>
            <span>{fmt(BEFORE)} ms</span>
          </span>
        </div>
      </div>

      <div className="metrics">
        <Metric label="Thời gian request" value={`${fmt(total, 1)} ms`} tone={total < 300 ? 'good' : 'bad'} note={`Ban đầu ${fmt(BEFORE)} ms`} />
        <Metric label="Số lời gọi DB/gRPC" value={calls} note={`Ban đầu ${SPANS.length - 1}`} />
      </div>
      <p className="viz-note">
        Hàng "Ghi DB, logic khác" là phần còn lại của trace mà báo cáo không tách chi tiết. Báo cáo ghi phần kiểm tra logic giảm về dưới 60 ms
        sau khi bỏ gọi lặp.
      </p>
    </VizFrame>
  );
}
