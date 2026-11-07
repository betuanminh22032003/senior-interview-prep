import type { ReactNode } from 'react';

export const fmt = (n: number, digits = 0) =>
  n.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Maps a 0..1000 slider position to a value on a log scale between min and max. */
export const fromLog = (pos: number, min: number, max: number) =>
  Math.round(Math.exp(Math.log(min) + (pos / 1000) * (Math.log(max) - Math.log(min))));
export const toLog = (value: number, min: number, max: number) =>
  Math.round(((Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min))) * 1000);

export type Tone = 'good' | 'warn' | 'bad' | 'plain';

export function VizFrame({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="viz">
      <div className="viz-head">
        <span className="viz-tag">Mô phỏng</span>
        <p className="viz-title">{title}</p>
        {hint && <p className="viz-hint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {label && <span className="seg-label">{label}</span>}
      <div className="chips">
        {options.map((o) => (
          <button key={String(o.value)} className={`chip ${o.value === value ? 'active' : ''}`} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider-top">
        <span>{label}</span>
        <strong className="mono">{display}</strong>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Metric({ label, value, note, tone = 'plain' }: { label: string; value: ReactNode; note?: ReactNode; tone?: Tone }) {
  return (
    <div className={`metric tone-${tone}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {note && <span className="metric-note">{note}</span>}
    </div>
  );
}

export function HBar({ label, value, max, tone = 'plain', text }: { label: ReactNode; value: number; max: number; tone?: Tone; text: string }) {
  return (
    <div className="hbar">
      <span className="hbar-label">{label}</span>
      <span className="hbar-track">
        <i className={`tone-bg-${tone}`} style={{ transform: `scaleX(${max > 0 ? Math.min(1, value / max) : 0})` }} />
      </span>
      <span className="hbar-text mono">{text}</span>
    </div>
  );
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="viz-code">
      <code>{children}</code>
    </pre>
  );
}
