import { useState } from 'react';
import { ArrowLeft, X } from '@phosphor-icons/react';
import { Code, fmt, Metric, VizFrame } from './ui';

// Ranking table from Cụm 4 – Mục 8, renamed. Clustered PK (userId, block, yearReport).
const N = 5_556_170;
const DATA_PAGES = Math.ceil(N / 60);
const COLS: { name: string; width: number; sel?: number }[] = [
  { name: 'yearReport', width: 2, sel: 1 / 2 },
  { name: 'block', width: 1, sel: 1 / 10 },
  { name: 'provinceId', width: 4, sel: 1 / 63 },
  { name: 'villageId', width: 4 },
  { name: 'schoolId', width: 4 },
  { name: 'province_Rank', width: 4 },
  { name: 'userId', width: 8 },
  { name: 'fullName', width: 60 },
  { name: 'totalScore', width: 4 },
];
const WIDTH = Object.fromEntries(COLS.map((c) => [c.name, c.width]));
const SEL = Object.fromEntries(COLS.filter((c) => c.sel).map((c) => [c.name, c.sel!]));
const EQ = ['yearReport', 'block', 'provinceId'];
const ORDER_COL = 'province_Rank';
const OUTPUT = ['userId', 'fullName', 'totalScore'];
const CLUSTERED_KEY = ['userId', 'block', 'yearReport'];
const TOP = 20;
const MATCHED = Math.round(EQ.reduce((n, c) => n * SEL[c], N));

const QUERY = `SELECT TOP (20) userId, fullName, totalScore
FROM dbo.CurrentRank
WHERE yearReport = @year AND block = @block AND provinceId = @province
ORDER BY province_Rank;`;

const PRESETS: { label: string; key: string[]; include: string[] }[] = [
  { label: 'Chưa có index', key: [], include: [] },
  { label: 'Index đang có trong báo cáo', key: ['yearReport', 'provinceId', 'villageId', 'schoolId'], include: [] },
  { label: 'Chỉ cột lọc', key: ['yearReport', 'block', 'provinceId'], include: [] },
  { label: 'Đặt cột sắp xếp lên đầu', key: ['province_Rank', 'yearReport', 'block', 'provinceId'], include: [] },
  { label: 'Đề xuất', key: ['yearReport', 'block', 'provinceId', 'province_Rank'], include: ['fullName', 'totalScore'] },
];

interface Result {
  ops: string[];
  reads: number;
  lookups: number;
  sorted: boolean;
  fallback: boolean;
}

function evaluate(key: string[], include: string[]): Result {
  if (key.length === 0) {
    return {
      ops: ['Clustered Index Scan', `Lọc còn ${fmt(MATCHED)} dòng`, `Sort ${fmt(MATCHED)} dòng`, `Top ${TOP}`],
      reads: DATA_PAGES,
      lookups: 0,
      sorted: true,
      fallback: false,
    };
  }
  let k = 0;
  while (k < key.length && EQ.includes(key[k])) k++;
  const prefix = key.slice(0, k);
  const residual = EQ.filter((c) => !prefix.includes(c));
  const ordered = key[k] === ORDER_COL;
  const inIndex = new Set([...key, ...include, ...CLUSTERED_KEY]);
  const covered = [...EQ, ORDER_COL, ...OUTPUT].every((c) => inIndex.has(c));
  const residualInIndex = residual.every((c) => inIndex.has(c));
  const residualSel = residual.reduce((n, c) => n * SEL[c], 1);
  const inRange = prefix.reduce((n, c) => n * SEL[c], N);
  const rowsRead = Math.round(ordered ? Math.min(inRange, TOP / residualSel) : inRange);
  const rowWidth = [...new Set([...key, ...include, ...CLUSTERED_KEY])].reduce((n, c) => n + WIDTH[c], 10);
  const perPage = Math.floor(8060 / rowWidth);
  const indexReads = 3 + Math.ceil(rowsRead / perPage) - 1;
  const lookups = covered ? 0 : residualInIndex ? (ordered ? TOP : MATCHED) : rowsRead;
  const reads = indexReads + lookups * 3;

  // If walking this index costs more than scanning the table, the optimizer ignores it.
  if (reads > DATA_PAGES) {
    const scan = evaluate([], []);
    return { ...scan, fallback: true };
  }
  const ops = [
    k > 0 ? `Index Seek (${prefix.join(', ')})` : ordered ? 'Index Scan theo thứ tự' : 'Index Scan',
    ...(residual.length ? [`Lọc dư: ${residual.join(', ')}`] : []),
    ...(lookups ? [`Key Lookup × ${fmt(lookups)}`] : []),
    ...(ordered ? [] : [`Sort ${fmt(MATCHED)} dòng`]),
    `Top ${TOP}`,
  ];
  return { ops, reads, lookups, sorted: !ordered, fallback: false };
}

export function IndexOrder() {
  const [key, setKey] = useState<string[]>(PRESETS[1].key);
  const [include, setInclude] = useState<string[]>(PRESETS[1].include);
  const r = evaluate(key, include);

  const addKey = (c: string) => {
    setInclude((inc) => inc.filter((x) => x !== c));
    setKey((k) => (k.includes(c) ? k : [...k, c]));
  };
  const toggleInclude = (c: string) => {
    setKey((k) => k.filter((x) => x !== c));
    setInclude((inc) => (inc.includes(c) ? inc.filter((x) => x !== c) : [...inc, c]));
  };
  const moveLeft = (i: number) =>
    setKey((k) => {
      const next = [...k];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });

  return (
    <VizFrame
      title="Ghép index cho truy vấn Top 20 bảng xếp hạng"
      hint="Bấm Key để thêm cột vào khoá theo thứ tự, mũi tên để đổi chỗ, Include để thêm vào INCLUDE. Bảng 5,56 triệu dòng."
    >
      <Code>{QUERY}</Code>

      <div className="chips">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="chip"
            onClick={() => {
              setKey(p.key);
              setInclude(p.include);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="ix-builder">
        <div className="ix-line">
          <span className="ix-label">Key</span>
          <div className="ix-slots">
            {key.length === 0 && <span className="muted small">trống</span>}
            {key.map((c, i) => (
              <span key={c} className={`ix-col ${EQ.includes(c) ? 'eq' : c === ORDER_COL ? 'ord' : ''}`}>
                {i > 0 && (
                  <button aria-label={`Đưa ${c} lên trước`} onClick={() => moveLeft(i)}>
                    <ArrowLeft weight="bold" />
                  </button>
                )}
                <span className="mono">{c}</span>
                <button aria-label={`Bỏ ${c}`} onClick={() => setKey((k) => k.filter((x) => x !== c))}>
                  <X weight="bold" />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="ix-line">
          <span className="ix-label">Include</span>
          <div className="ix-slots">
            {include.length === 0 && <span className="muted small">trống</span>}
            {include.map((c) => (
              <span key={c} className="ix-col inc">
                <span className="mono">{c}</span>
                <button aria-label={`Bỏ ${c}`} onClick={() => toggleInclude(c)}>
                  <X weight="bold" />
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="ix-palette">
          {COLS.map((c) => (
            <span key={c.name} className="ix-pick">
              <span className="mono small">{c.name}</span>
              <button className="chip" disabled={key.includes(c.name)} onClick={() => addKey(c.name)}>
                Key
              </button>
              <button className={`chip ${include.includes(c.name) ? 'active' : ''}`} onClick={() => toggleInclude(c.name)}>
                Include
              </button>
            </span>
          ))}
        </div>
        <p className="viz-note">
          Index phụ tự mang theo cột của clustered key ({CLUSTERED_KEY.join(', ')}). Màu xanh: cột so sánh bằng; vàng: cột ORDER BY.
        </p>
      </div>

      <div className="plan">
        {r.ops.map((op, i) => (
          <span key={i} className={`plan-op ${/Sort|Lookup|Scan$|Clustered/.test(op) ? 'bad' : /Lọc dư/.test(op) ? 'warn' : ''}`}>
            {op}
          </span>
        ))}
      </div>
      {r.fallback && <p className="viz-note tone-bad">Index này đắt hơn quét cả bảng nên optimizer bỏ qua nó.</p>}
      {r.ops[0] === 'Index Scan theo thứ tự' && (
        <p className="viz-note">
          Đọc theo thứ tự hạng rồi lọc dư chỉ rẻ khi dòng khớp rải đều. Tỉnh ít học sinh, hoặc lấy trang sâu, thì phải đọc gần hết index.
        </p>
      )}

      <div className="metrics">
        <Metric label="Logical reads" value={fmt(r.reads)} tone={r.reads > 1000 ? 'bad' : r.reads > 50 ? 'warn' : 'good'} />
        <Metric label="Sort + memory grant" value={r.sorted ? 'Có' : 'Không'} tone={r.sorted ? 'bad' : 'good'} />
        <Metric label="Key Lookup" value={fmt(r.lookups)} tone={r.lookups ? 'warn' : 'good'} />
      </div>
    </VizFrame>
  );
}
