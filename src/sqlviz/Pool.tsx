import { useState } from 'react';
import { fmt, fromLog, Metric, Slider, toLog, VizFrame } from './ui';

const WORKERS = 960; // default max worker threads on a 32-core x64 server
const MAX_CELLS = 200;

const PRESETS = [
  { label: 'Query 2 giây, pool 200', rps: 500, ms: 2000, pool: 200, apps: 1 },
  { label: 'Query 2 ms, pool 50', rps: 20000, ms: 2, pool: 50, apps: 1 },
  { label: '2.000 req/s × 30 ms, 4 instance', rps: 2000, ms: 30, pool: 100, apps: 4 },
];

export function Pool() {
  const [rps, setRps] = useState(500);
  const [ms, setMs] = useState(2000);
  const [pool, setPool] = useState(200);
  const [apps, setApps] = useState(1);

  const needed = (rps * ms) / 1000; // Little's law: L = λ × W
  const capacity = pool * apps;
  const inUse = Math.min(needed, capacity);
  const over = needed > capacity;
  const maxRps = capacity / (ms / 1000);
  const perCell = Math.max(1, Math.ceil(capacity / MAX_CELLS));
  const cells = Math.ceil(capacity / perCell);
  const filled = Math.round(inUse / perCell);

  return (
    <VizFrame
      title="Little's law: kết nối cần = request/giây × thời gian giữ kết nối"
      hint="Tăng pool không làm query nhanh hơn. Kéo thời gian query xuống và xem số kết nối cần giảm theo."
    >
      <div className="chips">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className="chip"
            onClick={() => {
              setRps(p.rps);
              setMs(p.ms);
              setPool(p.pool);
              setApps(p.apps);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="viz-controls two">
        <Slider
          label="Request mỗi giây"
          value={toLog(rps, 10, 50000)}
          min={0}
          max={1000}
          display={fmt(rps)}
          onChange={(p) => setRps(fromLog(p, 10, 50000))}
        />
        <Slider
          label="Thời gian giữ kết nối (query)"
          value={toLog(ms, 1, 5000)}
          min={0}
          max={1000}
          display={`${fmt(ms)} ms`}
          onChange={(p) => setMs(fromLog(p, 1, 5000))}
        />
        <Slider label="Max Pool Size mỗi instance" value={pool} min={10} max={400} step={10} display={String(pool)} onChange={setPool} />
        <Slider label="Số instance app" value={apps} min={1} max={8} display={String(apps)} onChange={setApps} />
      </div>

      <div className="pool">
        <span className="strip-label">
          Pool tổng {fmt(capacity)} kết nối{perCell > 1 ? `, mỗi ô ${perCell} kết nối` : ''}
        </span>
        <div className="pool-grid">
          {Array.from({ length: cells }, (_, i) => (
            <i key={i} className={i < filled ? (over ? 'full' : 'used') : ''} />
          ))}
        </div>
        {over && (
          <div className="pool-queue">
            <i style={{ width: `${Math.min(100, ((needed - capacity) / needed) * 100)}%` }} />
            <span>
              Thiếu {fmt(needed - capacity)} kết nối: request xếp hàng chờ tới Connect Timeout (mặc định 15 giây) rồi lỗi
            </span>
          </div>
        )}
      </div>

      <div className="metrics">
        <Metric label="Kết nối cần đồng thời" value={fmt(needed, needed < 10 ? 1 : 0)} tone={over ? 'bad' : needed > capacity * 0.8 ? 'warn' : 'good'} />
        <Metric label="Thông lượng tối đa của pool" value={`${fmt(maxRps)} req/s`} tone={maxRps < rps ? 'bad' : 'plain'} />
        <Metric
          label="Request đồng thời ở SQL Server"
          value={fmt(inUse, inUse < 10 ? 1 : 0)}
          tone={inUse > WORKERS * 0.5 ? 'bad' : inUse > 100 ? 'warn' : 'good'}
          note={`Server 32 core có khoảng ${fmt(WORKERS)} worker; truy vấn song song dùng nhiều worker hơn`}
        />
      </div>
      <p className="viz-note">
        Báo cáo (Phần IV): query 2 ms thì một kết nối phục vụ 500 request/giây; giữ nguyên pool, sửa query trước khi nghĩ tới tăng pool.
      </p>
    </VizFrame>
  );
}
