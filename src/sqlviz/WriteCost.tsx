import { useState } from 'react';
import { fmt, fromLog, Metric, Seg, Slider, toLog, VizFrame } from './ui';

type KeyKind = 'heap' | 'seq' | 'random';

const DATA_ROWS_PER_PAGE = 40;
const INDEX_ROWS_PER_PAGE = 200;
const LOG_BYTES_PER_WRITE = 250;

const PRESETS: { label: string; n: number; kind: KeyKind; rate: number }[] = [
  { label: 'Bảng log thi: heap, 0 index phụ', n: 0, kind: 'heap', rate: 3000 },
  { label: 'Bảng log: clustered tăng dần', n: 0, kind: 'seq', rate: 3000 },
  { label: 'Bảng kết quả vòng: 7 index phụ', n: 7, kind: 'seq', rate: 220 },
  { label: 'Bảng thống kê vòng: 9 index', n: 9, kind: 'seq', rate: 220 },
  { label: 'Bảng người dùng: 13 index', n: 13, kind: 'random', rate: 500 },
];

export function WriteCost() {
  const [n, setN] = useState(7);
  const [kind, setKind] = useState<KeyKind>('seq');
  const [rate, setRate] = useState(220);
  const [seqOpt, setSeqOpt] = useState(false);

  const structures = 1 + n;
  const writesPerSec = rate * structures;
  const logMBps = (writesPerSec * LOG_BYTES_PER_WRITE) / 1024 / 1024;
  // A random key fills a split page again after about half a page of inserts. Index keys are assumed random (UserId, ExamKey).
  const dataSplits = kind === 'random' ? rate / (DATA_ROWS_PER_PAGE / 2) : 0;
  const indexSplits = n * (rate / (INDEX_ROWS_PER_PAGE / 2));
  const splits = dataSplits + indexSplits;
  const hotspot =
    kind === 'seq' ? (seqOpt ? 'Đã giảm' : rate >= 1000 ? 'Cao' : 'Thấp') : kind === 'heap' ? (rate >= 5000 ? 'Trung bình' : 'Thấp') : 'Thấp';
  const readPath =
    kind === 'heap' && n === 0
      ? 'Mọi truy vấn đọc phải quét cả bảng'
      : n === 0
        ? 'Chỉ đọc nhanh theo khoá clustered (thời gian, Id)'
        : `Seek được theo ${n} index phụ`;

  return (
    <VizFrame
      title="Mỗi index phụ là thêm một chỗ phải ghi"
      hint="Đổi số index, kiểu clustered key và tốc độ insert. Số ước lượng theo mô hình đơn giản, dùng để so sánh tương đối."
    >
      <div className="chips">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="chip"
            onClick={() => {
              setN(p.n);
              setKind(p.kind);
              setRate(p.rate);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="viz-controls two">
        <Slider label="Số index phụ" value={n} min={0} max={13} display={String(n)} onChange={setN} />
        <Slider
          label="Insert mỗi giây"
          value={toLog(rate, 50, 20000)}
          min={0}
          max={1000}
          display={fmt(rate)}
          onChange={(p) => setRate(fromLog(p, 50, 20000))}
        />
      </div>
      <Seg<KeyKind>
        label="Dữ liệu lưu dạng"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'heap', label: 'Heap' },
          { value: 'seq', label: 'Clustered tăng dần (IDENTITY, thời gian)' },
          { value: 'random', label: 'Clustered ngẫu nhiên (UserId, GUID)' },
        ]}
      />
      {kind === 'seq' && (
        <label className="toggle">
          <input type="checkbox" checked={seqOpt} onChange={(e) => setSeqOpt(e.target.checked)} />
          <span>OPTIMIZE_FOR_SEQUENTIAL_KEY = ON (SQL Server 2019+)</span>
        </label>
      )}

      <div className="structs" aria-label={`Một insert ghi vào ${structures} cấu trúc`}>
        <span className="struct data">Dữ liệu</span>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="struct" style={{ '--d': `${(i + 1) * 70}ms` } as React.CSSProperties}>
            IX{i + 1}
          </span>
        ))}
      </div>

      <div className="metrics">
        <Metric label="Cấu trúc phải ghi mỗi insert" value={structures} tone={n > 6 ? 'bad' : n > 2 ? 'warn' : 'good'} />
        <Metric label="Lượt ghi trang mỗi giây" value={fmt(writesPerSec)} note={`≈ ${fmt(logMBps, 2)} MB log/giây`} />
        <Metric label="Page split mỗi giây" value={fmt(splits, 1)} tone={splits > 50 ? 'bad' : splits > 5 ? 'warn' : 'good'} />
        <Metric
          label="Điểm nóng trang cuối (PAGELATCH_EX)"
          value={hotspot}
          tone={hotspot === 'Cao' ? 'bad' : hotspot === 'Trung bình' ? 'warn' : 'good'}
        />
      </div>
      <p className="viz-note">
        <strong>Đổi lại phía đọc:</strong> {readPath}. Báo cáo chọn: bảng thuần ghi giữ ít index ở DB chính, tra cứu ở replica (Phần VI).
      </p>
    </VizFrame>
  );
}
