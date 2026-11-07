import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Circle, Clock, CursorClick, Quotes, Target } from '@phosphor-icons/react';
import { chapterByNum, chapterHref, lessonById, lessonHref, neighbours, partOfChapter } from '../data';
import { ExerciseItem, Html, QAItem, StatusBadge } from '../components';
import { VIZ } from '../sqlviz';
import { isLearned, useProgress } from '../store';
import { STATUS_HINT } from '../types';

export function LessonView({ id }: { id: string }) {
  const lesson = lessonById(id)!;
  const chapter = chapterByNum(lesson.chapter)!;
  const part = partOfChapter(lesson.chapter);
  const { prev, next } = neighbours(id);
  const { progress, toggleTask, toggleRead, visit } = useProgress();
  const bodyRef = useRef<HTMLDivElement>(null);
  const Viz = lesson.viz ? VIZ[lesson.viz] : undefined;
  const read = !!progress.read[id];
  const learned = lesson.qas.filter((q) => isLearned(progress.srs[q.id])).length;

  useEffect(() => visit(id), [id, visit]);

  // Checklist inputs live in server-rendered HTML: sync their state and listen through delegation.
  useEffect(() => {
    bodyRef.current?.querySelectorAll<HTMLInputElement>('input.task').forEach((el) => {
      el.checked = !!progress.tasks[el.dataset.task ?? ''];
    });
  }, [progress.tasks, id]);
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const onChange = (e: Event) => {
      const el = e.target as HTMLInputElement;
      if (el.matches('input.task') && el.dataset.task) toggleTask(el.dataset.task);
    };
    root.addEventListener('change', onChange);
    return () => root.removeEventListener('change', onChange);
  }, [toggleTask]);

  // Left / right arrows move between lessons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' && next) window.location.hash = `/bai/${next.id}`;
      if (e.key === 'ArrowLeft' && prev) window.location.hash = `/bai/${prev.id}`;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  const outline = [
    ...lesson.sections.map((s) => ({ id: s.id, title: s.title })),
    { id: 'cau-hoi', title: 'Câu hỏi phỏng vấn' },
    { id: 'tom-tat', title: 'Tóm tắt' },
    { id: 'bai-tap', title: 'Bài tập' },
  ];
  const activeSection = useScrollSpy(outline.map((o) => o.id));

  return (
    <div className="lesson-layout">
      <article className="lesson" ref={bodyRef}>
        <nav className="crumbs" aria-label="Vị trí">
          <a href="#/">Phần {part.id}</a>
          <span aria-hidden>/</span>
          <a href={chapterHref(chapter.num)}>
            Chương {chapter.num}. <span dangerouslySetInnerHTML={{ __html: chapter.title }} />
          </a>
        </nav>

        <header className="lesson-header rise">
          <p className="lesson-num mono">Bài {lesson.id}</p>
          <h1 className="lesson-title" dangerouslySetInnerHTML={{ __html: lesson.title }} />
          <div className="lesson-meta">
            {lesson.status && <StatusBadge status={lesson.status} />}
            <span>
              <Clock weight="bold" /> {lesson.minutes} phút đọc
            </span>
            <span>
              {lesson.qas.length} câu hỏi · {learned} đã thuộc
            </span>
            <span>{lesson.exercises.length} bài tập</span>
            {Viz && (
              <span className="meta-viz">
                <CursorClick weight="bold" /> Có mô phỏng
              </span>
            )}
          </div>
        </header>

        {(lesson.cvLine || lesson.status) && (
          <section className="cv-box">
            {lesson.cvLine && (
              <div className="cv-line">
                <Quotes weight="fill" aria-hidden />
                <div>
                  <p className="box-label">Dòng CV</p>
                  <Html html={lesson.cvLine} className="cv-text" />
                </div>
              </div>
            )}
            {lesson.status && (
              <div className={`cv-status status-${lesson.status}`}>
                <p className="box-label">
                  Trạng thái: <StatusBadge status={lesson.status} /> <span className="muted">{STATUS_HINT[lesson.status]}</span>
                </p>
                {lesson.statusHtml && <Html html={lesson.statusHtml} />}
              </div>
            )}
          </section>
        )}

        <section className="goals">
          <p className="box-label">
            <Target weight="bold" /> Mục tiêu bài học
          </p>
          <Html html={lesson.goalsHtml} />
        </section>

        {Viz && (
          <div className="lesson-viz">
            <Viz />
          </div>
        )}

        {lesson.sections.map((s) => (
          <section key={s.id} id={s.id} className="lesson-section">
            <h2 dangerouslySetInnerHTML={{ __html: s.title }} />
            <Html html={s.html} />
          </section>
        ))}

        <section id="cau-hoi" className="lesson-section">
          <h2>Câu hỏi phỏng vấn</h2>
          <p className="section-note">Tự trả lời thành tiếng trước, rồi mới mở trả lời mẫu. Mức nhớ bạn chấm được dùng cho phần Ôn tập.</p>
          <ol className="qa-list">
            {lesson.qas.map((q, i) => (
              <QAItem key={q.id} qa={q} index={i + 1} />
            ))}
          </ol>
        </section>

        <section id="tom-tat" className="lesson-section summary">
          <h2>Tóm tắt</h2>
          <Html html={lesson.summaryHtml} />
        </section>

        <section id="bai-tap" className="lesson-section">
          <h2>Bài tập</h2>
          <ol className="exercise-list">
            {lesson.exercises.map((ex, i) => (
              <ExerciseItem key={i} ex={ex} index={i + 1} />
            ))}
          </ol>
        </section>

        <div className="lesson-done">
          <button className={read ? 'btn-ghost' : 'btn'} onClick={() => toggleRead(id)}>
            {read ? <CheckCircle weight="fill" /> : <Circle weight="bold" />}
            {read ? 'Đã học xong bài này' : 'Đánh dấu đã học xong'}
          </button>
        </div>

        <nav className="pager" aria-label="Bài trước và bài sau">
          {prev ? (
            <a className="pager-link" href={lessonHref(prev.id)}>
              <span className="muted small">
                <ArrowLeft weight="bold" /> Bài trước
              </span>
              <span className="pager-title">
                <span className="mono">{prev.id}</span> {prev.titleText}
              </span>
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a className="pager-link next" href={lessonHref(next.id)}>
              <span className="muted small">
                Bài sau <ArrowRight weight="bold" />
              </span>
              <span className="pager-title">
                <span className="mono">{next.id}</span> {next.titleText}
              </span>
            </a>
          ) : (
            <span />
          )}
        </nav>
      </article>

      <aside className="outline" aria-label="Trong bài này">
        <p className="box-label">Trong bài này</p>
        {outline.map((o) => (
          <a
            key={o.id}
            href={`#${o.id}`}
            className={activeSection === o.id ? 'active' : ''}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(o.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            dangerouslySetInnerHTML={{ __html: o.title }}
          />
        ))}
        <button className={`outline-read ${read ? 'done' : ''}`} onClick={() => toggleRead(id)}>
          {read ? <CheckCircle weight="fill" /> : <Circle weight="bold" />}
          {read ? 'Đã học' : 'Đánh dấu đã học'}
        </button>
      </aside>
    </div>
  );
}

/** Returns the id of the last section whose top has scrolled past a line near the top of the viewport. */
function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');
  const key = ids.join('|');
  useEffect(() => {
    const list = key.split('|');
    const onScroll = () => {
      let current = list[0];
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 140) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [key]);
  return active;
}
