import { ArrowRight, CheckCircle, CursorClick } from '@phosphor-icons/react';
import { CHAPTERS, chapterByNum, chapterHref, lessonHref, partOfChapter } from '../data';
import { Html, Meter } from '../components';
import { useProgress } from '../store';

export function ChapterView({ num }: { num: number }) {
  const chapter = chapterByNum(num)!;
  const part = partOfChapter(num);
  const { progress } = useProgress();
  const done = chapter.lessons.filter((l) => progress.read[l.id]).length;
  const firstUnread = chapter.lessons.find((l) => !progress.read[l.id]) ?? chapter.lessons[0];
  const idx = CHAPTERS.findIndex((c) => c.num === num);
  const nextChapter = CHAPTERS[idx + 1];
  const isFirstInPart = part.chapters[0].num === num;

  return (
    <div className="page chapter-page">
      <nav className="crumbs" aria-label="Vị trí">
        <a href="#/">Phần {part.id}</a>
        <span aria-hidden>/</span>
        <span dangerouslySetInnerHTML={{ __html: part.title }} />
      </nav>
      <header className="chapter-header rise">
        <p className="eyebrow">Chương {chapter.num}</p>
        <h1 dangerouslySetInnerHTML={{ __html: chapter.title }} />
        <div className="chapter-progress">
          <Meter value={done / chapter.lessons.length} />
          <span className="muted small">
            {done}/{chapter.lessons.length} bài đã học · {chapter.lessons.reduce((n, l) => n + l.minutes, 0)} phút đọc
          </span>
        </div>
      </header>

      {isFirstInPart && part.introHtml && (
        <section className="part-intro-box">
          <p className="box-label">Phần {part.id}</p>
          <Html html={part.introHtml} />
        </section>
      )}
      {chapter.introHtml && <Html html={chapter.introHtml} className="prose chapter-intro" />}

      <ol className="chapter-lessons">
        {chapter.lessons.map((l) => (
          <li key={l.id}>
            <a href={lessonHref(l.id)} className={`chapter-lesson ${progress.read[l.id] ? 'done' : ''}`}>
              <span className="mono chapter-lesson-num">Bài {l.id}</span>
              <span className="chapter-lesson-title">{l.titleText}</span>
              <Html html={l.summaryHtml} className="prose chapter-lesson-goals" />
              <span className="chapter-lesson-meta">
                {l.viz && (
                  <span className="meta-viz">
                    <CursorClick weight="bold" /> Mô phỏng
                  </span>
                )}
                <span className="muted small">
                  {l.minutes} phút · {l.qas.length} câu hỏi vặn{l.exercises.length ? ` · ${l.exercises.length} bài tập` : ""}
                </span>
                {progress.read[l.id] && <CheckCircle weight="fill" className="row-check" aria-label="Đã học" />}
              </span>
            </a>
          </li>
        ))}
      </ol>

      <div className="row chapter-actions">
        <a className="btn" href={lessonHref(firstUnread.id)}>
          {done ? 'Học tiếp' : 'Bắt đầu chương'}: Bài {firstUnread.id} <ArrowRight weight="bold" />
        </a>
        {nextChapter && (
          <a className="btn-ghost" href={chapterHref(nextChapter.num)}>
            Chương {nextChapter.num} <ArrowRight weight="bold" />
          </a>
        )}
      </div>
    </div>
  );
}
