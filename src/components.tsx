import { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, Minus, Pause, Play, Plus } from '@phosphor-icons/react';
import { isLearned, useProgress, type Grade } from './store';
import { STATUS_LABEL, type QA, type Status } from './types';

export function Html({ html, className = 'prose' }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function BoxDots({ box }: { box: number }) {
  return (
    <span className="dots" aria-label={`Mức nhớ ${box}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= box ? 'on' : ''} />
      ))}
    </span>
  );
}

export function GradeButtons({ id, onGraded }: { id: string; onGraded?: (g: Grade) => void }) {
  const { grade } = useProgress();
  const pick = (g: Grade) => {
    grade(id, g);
    onGraded?.(g);
  };
  return (
    <div className="grade">
      <button className="btn-ghost" onClick={() => pick('again')}>
        <kbd>1</kbd> Chưa nhớ
      </button>
      <button className="btn-ghost" onClick={() => pick('hard')}>
        <kbd>2</kbd> Nhớ mơ hồ
      </button>
      <button className="btn" onClick={() => pick('good')}>
        <kbd>3</kbd> Nhớ rõ
      </button>
    </div>
  );
}

export function QAItem({ qa }: { qa: QA }) {
  const [open, setOpen] = useState(false);
  const { progress } = useProgress();
  const entry = progress.srs[qa.id];
  return (
    <div className="qa">
      <div className="qa-head">
        <span className="qa-q" dangerouslySetInnerHTML={{ __html: qa.q }} />
        <span className="qa-meta">
          {isLearned(entry) && <span className="learned">Đã thuộc</span>}
          <BoxDots box={entry?.box ?? 0} />
        </span>
      </div>
      {open ? (
        <div className="qa-answer">
          <Html html={qa.a} />
          <GradeButtons id={qa.id} onGraded={() => setOpen(false)} />
        </div>
      ) : (
        <button className="btn-link" onClick={() => setOpen(true)}>
          Xem đáp án
        </button>
      )}
    </div>
  );
}

export function Accordion({
  head,
  children,
  defaultOpen = false,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acc ${open ? 'open' : ''}`}>
      <button className="acc-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="acc-title">{head}</span>
        {open ? <Minus weight="bold" /> : <Plus weight="bold" />}
      </button>
      {open && <div className="acc-body">{children}</div>}
    </div>
  );
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export function Timer({ presets }: { presets: number[] }) {
  const [total, setTotal] = useState(presets[0]);
  const [left, setLeft] = useState(presets[0]);
  const [running, setRunning] = useState(false);
  const tick = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!running) return;
    tick.current = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(tick.current);
  }, [running]);

  useEffect(() => {
    if (left === 0) setRunning(false);
  }, [left]);

  const choose = (secs: number) => {
    setTotal(secs);
    setLeft(secs);
    setRunning(false);
  };

  return (
    <div className="timer">
      <span className={`timer-time ${left === 0 ? 'done' : ''}`}>{fmt(left)}</span>
      <div className="timer-bar">
        <i style={{ transform: `scaleX(${left / total})` }} />
      </div>
      <div className="timer-actions">
        {presets.map((p) => (
          <button key={p} className={`chip ${total === p ? 'active' : ''}`} onClick={() => choose(p)}>
            {p / 60} phút
          </button>
        ))}
        <button className="btn-icon" onClick={() => setRunning((r) => !r)} aria-label={running ? 'Tạm dừng' : 'Bắt đầu'}>
          {running ? <Pause weight="bold" /> : <Play weight="bold" />}
        </button>
        <button className="btn-icon" onClick={() => choose(total)} aria-label="Đặt lại">
          <ArrowCounterClockwise weight="bold" />
        </button>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="page-header rise">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <div className="lede">{children}</div>}
    </header>
  );
}
