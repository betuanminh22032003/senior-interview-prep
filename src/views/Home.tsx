import { ArrowRight, CheckCircle, CursorClick } from '@phosphor-icons/react';
import { CARDS, LESSONS, PARTS, TOTALS, chapterHref, lessonById, lessonHref } from '../data';
import { Html, Meter, Ring } from '../components';
import { isDue, isLearned, useProgress } from '../store';

export function Home() {
  const { progress } = useProgress();
  const now = Date.now();
  const readCount = LESSONS.filter((l) => progress.read[l.id]).length;
  const learned = CARDS.filter((c) => isLearned(progress.srs[c.id])).length;
  const due = CARDS.filter((c) => isDue(progress.srs[c.id], now)).length;
  const lastLesson = progress.last ? lessonById(progress.last) : undefined;
  const nextUnread = LESSONS.find((l) => !progress.read[l.id]);
  const resume = lastLesson && !progress.read[lastLesson.id] ? lastLesson : nextUnread;
  const taskIds = LESSONS.flatMap((l) => l.tasks);
  const tasksDone = taskIds.filter((t) => progress.tasks[t]).length;

  return (
    <div className="page home">
      <header className="cover rise">
        <p className="eyebrow">Giáo trình · {TOTALS.parts} phần · {TOTALS.chapters} chương · {TOTALS.lessons} bài</p>
        <h1>Ôn phỏng vấn Senior Backend .NET</h1>
        <p className="lede">
          Đọc tuần tự từ Phần I. Mỗi bài gồm kiến thức, cách show off khi trả lời, các câu hỏi vặn kèm cách trả lời, bẫy cần tránh và phần nhớ nhanh. Câu hỏi vặn
          được đưa vào mục Ôn tập để lặp lại ngắt quãng.
        </p>
        <div className="cover-actions">
          {resume && (
            <a className="btn" href={lessonHref(resume.id)}>
              {readCount ? 'Đọc tiếp' : 'Bắt đầu đọc'}: Bài {resume.id} <ArrowRight weight="bold" />
            </a>
          )}
          <a className="btn-ghost" href="#/on-tap">
            Ôn tập{due ? ` (${due} thẻ đến hạn)` : ''}
          </a>
        </div>
      </header>

      <section className="stats rise">
        <div className="stat">
          <Ring value={readCount / TOTALS.lessons} />
          <div>
            <p className="stat-value">
              {readCount}
              <span className="muted">/{TOTALS.lessons}</span>
            </p>
            <p className="stat-label">bài đã học</p>
          </div>
        </div>
        <div className="stat">
          <Ring value={learned / Math.max(1, TOTALS.questions)} />
          <div>
            <p className="stat-value">
              {learned}
              <span className="muted">/{TOTALS.questions}</span>
            </p>
            <p className="stat-label">câu hỏi đã thuộc</p>
          </div>
        </div>
        <div className="stat">
          <Ring value={tasksDone / Math.max(1, taskIds.length)} />
          <div>
            <p className="stat-value">
              {tasksDone}
              <span className="muted">/{taskIds.length}</span>
            </p>
            <p className="stat-label">việc trong checklist</p>
          </div>
        </div>
        <div className="stat plain">
          <div>
            <p className="stat-value">~{Math.round(TOTALS.minutes / 60)} giờ</p>
            <p className="stat-label">
              đọc · {TOTALS.exercises} bài tập · {TOTALS.simulations} mô phỏng
            </p>
          </div>
        </div>
      </section>

      <section className="contents">
        <h2 className="contents-title">Mục lục</h2>
        {PARTS.map((p) => {
          const lessons = p.chapters.flatMap((c) => c.lessons);
          const done = lessons.filter((l) => progress.read[l.id]).length;
          return (
            <div key={p.id} className="part rise">
              <div className="part-head">
                <span className="part-num">Phần {p.id}</span>
                <h3 className="part-title" dangerouslySetInnerHTML={{ __html: p.title }} />
                <span className="part-progress mono small muted">
                  {done}/{lessons.length}
                </span>
              </div>
              <Meter value={done / lessons.length} />
              {p.introHtml && <Html html={p.introHtml} className="prose part-intro" />}
              <div className="chapters">
                {p.chapters.map((c) => (
                  <div key={c.num} className="chapter-block">
                    <a className="chapter-link" href={chapterHref(c.num)}>
                      <span className="chapter-num mono">Chương {c.num}</span>
                      <span className="chapter-title" dangerouslySetInnerHTML={{ __html: c.title }} />
                    </a>
                    <ol className="lesson-rows">
                      {c.lessons.map((l) => (
                        <li key={l.id}>
                          <a href={lessonHref(l.id)} className={progress.read[l.id] ? 'done' : ''}>
                            <span className="mono lesson-row-num">{l.id}</span>
                            <span className="lesson-row-title">{l.titleText}</span>
                            <span className="lesson-row-meta">
                              {l.viz && <CursorClick weight="bold" aria-label="Có mô phỏng" />}
                              <span className="muted small">{l.minutes}′</span>
                              {progress.read[l.id] && <CheckCircle weight="fill" className="row-check" aria-label="Đã học" />}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
