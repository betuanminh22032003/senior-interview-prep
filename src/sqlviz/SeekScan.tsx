import { useState } from 'react';
import { fmt, fromLog, HBar, Metric, Seg, Slider, toLog, VizFrame } from './ui';

// A 1M-row table sized so a full scan costs about the 3,567 pages the report measured.
const ROWS = 1_000_000;
const DATA_PER_PAGE = 280;
const NARROW_PER_PAGE = 400; // index with only the filter column
const COVER_PER_PAGE = 150; // same key plus INCLUDE columns
const DEPTH = 3;
const DATA_PAGES = Math.ceil(ROWS / DATA_PER_PAGE);
const CELLS = 40;

type IndexKind = 'none' | 'narrow' | 'cover';
type Path = 'scan' | 'lookup' | 'cover';

const cost = (path: Path, m: number) => {
  if (path === 'scan') return DATA_PAGES;
  if (path === 'lookup') return DEPTH + Math.ceil(m / NARROW_PER_PAGE) - 1 + m * DEPTH;
  return DEPTH + Math.ceil(m / COVER_PER_PAGE) - 1;
};

const PATH_LABEL: Record<Path, string> = {
  scan: 'Clustered Index Scan',
  lookup: 'Index Seek + Key Lookup',
  cover: 'Index Seek (covering)',
};

const PRESETS = [
  { m: 1, label: '1 user' },
  { m: 40, label: '1 lớp' },
  { m: 600, label: '1 trường' },
  { m: 8000, label: '1 huyện' },
  { m: 40000, label: '1 tỉnh' },
];

// Fixed permutation of the cells (17 is coprime to 40), so lookups land on the same cells between renders.
const ORDER = Array.from({ length: CELLS }, (_, i) => (i * 17 + 5) % CELLS);
// m random lookups touch this many distinct cells on average.
const scatter = (m: number) => new Set(ORDER.slice(0, Math.round(CELLS * (1 - Math.pow(1 - 1 / CELLS, m)))));

export function SeekScan() {
  const [kind, setKind] = useState<IndexKind>('narrow');
  const [m, setM] = useState(600);

  const paths: Path[] = kind === 'none' ? ['scan'] : kind === 'narrow' ? ['scan', 'lookup'] : ['scan', 'cover'];
  const pick = paths.reduce((a, b) => (cost(b, m) < cost(a, m) ? b : a));
  const reads = cost(pick, m);
  const tipping = Math.floor((DATA_PAGES - DEPTH + 1) / (DEPTH + 1 / NARROW_PER_PAGE));
  const rangeCells = Math.max(1, Math.ceil((m / ROWS) * CELLS));
  const start = Math.floor((CELLS - rangeCells) / 2);
  const looked = pick === 'lookup' ? scatter(m) : new Set<number>();

  return (
    <VizFrame
      title="Đọc bao nhiêu trang để lấy m dòng từ bảng 1 triệu dòng?"
      hint="Đổi loại index và số dòng khớp. Optimizer chọn đường rẻ nhất trong các đường đang có."
    >
      <div className="viz-controls">
        <Seg<IndexKind>
          label="Index đang có trên cột lọc"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'none', label: 'Không có' },
            { value: 'narrow', label: 'Index chỉ có cột lọc' },
            { value: 'cover', label: 'Covering (key + INCLUDE)' },
          ]}
        />
        <Slider
          label="Số dòng khớp điều kiện (m)"
          value={toLog(m, 1, 100000)}
          min={0}
          max={1000}
          display={fmt(m)}
          onChange={(p) => setM(fromLog(p, 1, 100000))}
        />
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.m} className={`chip ${m === p.m ? 'active' : ''}`} onClick={() => setM(p.m)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="strips">
        {kind !== 'none' && (
          <div className="strip-row">
            <span className="strip-label">{kind === 'cover' ? 'Tầng lá covering index' : 'Tầng lá index phụ'}</span>
            <div className="strip">
              {Array.from({ length: CELLS }, (_, i) => (
                <i key={i} className={pick !== 'scan' && i >= start && i < start + rangeCells ? 'on seek' : ''} />
              ))}
            </div>
          </div>
        )}
        <div className="strip-row">
          <span className="strip-label">Tầng lá clustered (dữ liệu)</span>
          <div className="strip">
            {Array.from({ length: CELLS }, (_, i) => (
              <i
                key={i}
                className={pick === 'scan' ? 'on scan' : looked.has(i) ? 'on lookup' : ''}
                style={{ '--d': `${i * 18}ms` } as React.CSSProperties}
              />
            ))}
          </div>
        </div>
        <p className="viz-note">Mỗi ô đại diện khoảng {fmt(DATA_PAGES / CELLS)} trang. Cây B-tree sâu {DEPTH} tầng.</p>
      </div>

      <div className="metrics">
        <Metric label="Optimizer chọn" value={PATH_LABEL[pick]} tone={pick === 'scan' ? 'bad' : pick === 'lookup' ? 'warn' : 'good'} />
        <Metric label="Logical reads" value={fmt(reads)} note={`≈ ${fmt((reads * 8) / 1024, 1)} MB đọc từ buffer pool`} />
      </div>

      <div className="hbars">
        {(['scan', 'lookup', 'cover'] as Path[]).map((p) => {
          const available = paths.includes(p);
          return (
            <HBar
              key={p}
              label={PATH_LABEL[p]}
              value={available ? cost(p, m) : 0}
              max={Math.max(DATA_PAGES, ...paths.map((x) => cost(x, m)))}
              tone={!available ? 'plain' : p === pick ? 'good' : 'warn'}
              text={available ? fmt(cost(p, m)) : 'chưa có index'}
            />
          );
        })}
      </div>

      <p className="viz-note">
        Điểm bùng phát của index chỉ có cột lọc: khoảng {fmt(tipping)} dòng ({fmt((tipping / ROWS) * 100, 2)}% bảng). Quá mức này mỗi Key
        Lookup tốn {DEPTH} trang nên quét cả bảng lại rẻ hơn. Báo cáo: bảng thống kê học sinh quét {fmt(3567)} trang/lần, covering index kỳ
        vọng dưới 10 trang.
      </p>
    </VizFrame>
  );
}
