import { useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import { isLearned, useProgress, type Grade } from './store';
import { STATUS_HINT, STATUS_LABEL, type Exercise, type QA, type Status } from './types';

export function Html({ html, className = 'prose', as: Tag = 'div' }: { html: string; className?: string; as?: 'div' | 'span' }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge badge-${status}`} title={STATUS_HINT[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
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
      <span className="grade-label">Bạn trả lời được tới đâu?</span>
      <button className="btn-ghost" onClick={() => pick('again')}>
        <kbd>1</kbd> Chưa nhớ
      </button>
      <button className="btn-ghost" onClick={() => pick('hard')}>
        <kbd>2</kbd> Mơ hồ
      </button>
      <button className="btn" onClick={() => pick('good')}>
        <kbd>3</kbd> Nhớ rõ
      </button>
    </div>
  );
}

/** Interview question with a hidden model answer; grading feeds the flashcard schedule. */
export function QAItem({ qa, index }: { qa: QA; index: number }) {
  const [open, setOpen] = useState(false);
  const { progress } = useProgress();
  const entry = progress.srs[qa.id];
  return (
    <li className={`qa ${open ? 'open' : ''}`}>
      <button className="qa-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="qa-num mono">{index}</span>
        <Html as="span" html={qa.q} className="qa-q" />
        <span className="qa-meta">
          {isLearned(entry) ? <span className="learned">Đã thuộc</span> : <BoxDots box={entry?.box ?? 0} />}
          <CaretDown weight="bold" className="caret" />
        </span>
      </button>
      {open && (
        <div className="qa-answer">
          <p className="answer-label">Cách trả lời</p>
          <Html html={qa.a} />
          <GradeButtons id={qa.id} onGraded={() => setOpen(false)} />
        </div>
      )}
    </li>
  );
}

export function ExerciseItem({ ex, index }: { ex: Exercise; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="exercise">
      <span className="exercise-num mono">{index}</span>
      <div className="exercise-body">
        <Html html={ex.q} />
        {ex.a &&
          (open ? (
            <div className="exercise-answer">
              <p className="answer-label">Đáp án</p>
              <Html html={ex.a} />
            </div>
          ) : (
            <button className="btn-link" onClick={() => setOpen(true)}>
              Xem đáp án
            </button>
          ))}
      </div>
    </li>
  );
}

export function Ring({ value, size = 44, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${Math.round(value * 100)}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function Meter({ value }: { value: number }) {
  return (
    <div className="meter" aria-hidden>
      <i style={{ transform: `scaleX(${Math.min(1, Math.max(0, value))})` }} />
    </div>
  );
}
