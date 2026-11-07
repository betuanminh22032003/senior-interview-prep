import { useState } from 'react';
import { fmt, fromLog, Metric, Slider, toLog, VizFrame } from './ui';

// Simplified model of one join + sort on a 64 GB server.
const BYTES_PER_ROW = 300; // row width plus sort/hash overhead
const POOL_MB = 42_000; // memory the server can hand out as grants
const CAP_MB = 10_500; // one query gets at most 25% of that
const NL_THRESHOLD = 1_000; // below this estimate the optimizer prefers Nested Loops
const INNER_PAGES = 25_000; // pages a Hash Match reads from the inner table
const MAX_ROWS = 100_000_000;

const mb = (rows: number) => (rows * BYTES_PER_ROW) / 1024 / 1024;

const PRESETS = [
  { label: 'Bảng biến (ước lượng 1 dòng)', est: 1, act: 50_000, sessions: 10 },
  { label: 'Statistics cũ, khoá tăng dần', est: 300, act: 120_000, sessions: 10 },
  { label: 'Ước lượng thừa (grant 7 GB, dùng 1 MB)', est: 25_000_000, act: 4_000, sessions: 10 },
  { label: 'Ước lượng đúng (#temp + stats mới)', est: 50_000, act: 50_000, sessions: 10 },
];

export function Cardinality() {
  const [est, setEst] = useState(1);
  const [act, setAct] = useState(50_000);
  const [sessions, setSessions] = useState(10);

  const chosen = est < NL_THRESHOLD ? 'Nested Loops' : 'Hash Match';
  const best = act < NL_THRESHOLD ? 'Nested Loops' : 'Hash Match';
  const work = (join: string) => (join === 'Nested Loops' ? act * 3 : INNER_PAGES);
  const penalty = work(chosen) / work(best);

  const grant = Math.min(CAP_MB, Math.max(1, mb(est)));
  const needed = Math.max(0.5, mb(act));
  const spillPages = needed > grant ? Math.round((needed - grant) * 128 * 2) : 0;
  const wasted = Math.max(0, grant - needed);
  const running = Math.min(sessions, Math.max(1, Math.floor(POOL_MB / grant)));
  const waiting = sessions - running;

  const logMax = Math.log10(MAX_ROWS);
  const pct = (n: number) => `${Math.max(1.5, (Math.log10(Math.max(1, n)) / logMax) * 100)}%`;

  return (
    <VizFrame
      title="Ước lượng số dòng quyết định kiểu join và memory grant"
      hint="Kéo số dòng ước lượng và số dòng thật. Grant được cấp theo ước lượng trước khi chạy; dùng thật theo số dòng thật."
    >
      <div className="chips">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`chip ${est === p.est && act === p.act ? 'active' : ''}`}
            onClick={() => {
              setEst(p.est);
              setAct(p.act);
              setSessions(p.sessions);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="viz-controls two">
        <Slider
          label="Optimizer ước lượng"
          value={toLog(est, 1, MAX_ROWS)}
          min={0}
          max={1000}
          display={`${fmt(est)} dòng`}
          onChange={(p) => setEst(fromLog(p, 1, MAX_ROWS))}
        />
        <Slider
          label="Số dòng thật"
          value={toLog(act, 1, MAX_ROWS)}
          min={0}
          max={1000}
          display={`${fmt(act)} dòng`}
          onChange={(p) => setAct(fromLog(p, 1, MAX_ROWS))}
        />
        <Slider label="Số phiên chạy cùng lúc" value={sessions} min={1} max={40} display={String(sessions)} onChange={setSessions} />
      </div>

      <div className="est-bars">
        <div className="est-row">
          <span>Ước lượng</span>
          <span className="est-track">
            <i className="tone-bg-warn" style={{ width: pct(est) }} />
          </span>
        </div>
        <div className="est-row">
          <span>Thật</span>
          <span className="est-track">
            <i className="tone-bg-good" style={{ width: pct(act) }} />
          </span>
        </div>
        <p className="viz-note">Thang log. Lệch {fmt(Math.max(est / act, act / est), 1)} lần.</p>
      </div>

      <div className="metrics">
        <Metric
          label="Kiểu join được chọn"
          value={chosen}
          tone={chosen === best ? 'good' : 'bad'}
          note={chosen === best ? 'Đúng với số dòng thật' : `Đáng ra là ${best}; tốn gấp ${fmt(penalty, 1)} lần`}
        />
        <Metric
          label="Memory grant / dùng thật"
          value={`${fmt(grant, grant < 10 ? 1 : 0)} / ${fmt(needed, needed < 10 ? 1 : 0)} MB`}
          tone={spillPages ? 'bad' : wasted > 100 ? 'warn' : 'good'}
          note={spillPages ? 'Grant thiếu' : wasted > 100 ? `Giữ thừa ${fmt(wasted)} MB` : 'Vừa đủ'}
        />
        <Metric
          label="Spill xuống tempdb"
          value={spillPages ? `${fmt(spillPages)} trang` : '0'}
          tone={spillPages ? 'bad' : 'good'}
          note={spillPages ? 'Sort/Hash ghi ra tempdb rồi đọc lại' : ''}
        />
      </div>

      <div className="sessions">
        <span className="strip-label">
          {sessions} phiên cùng chạy, quỹ grant {fmt(POOL_MB / 1000)} GB: {running} chạy, {waiting} chờ RESOURCE_SEMAPHORE
        </span>
        <div className="session-grid">
          {Array.from({ length: sessions }, (_, i) => (
            <i key={i} className={i < running ? 'run' : 'wait'} />
          ))}
        </div>
      </div>
    </VizFrame>
  );
}
