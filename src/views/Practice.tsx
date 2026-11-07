import { useCallback, useEffect, useMemo, useState } from 'react';
import { CARDS, PARTS, lessonHref, type Flashcard } from '../data';
import { BoxDots, GradeButtons, Html, Meter } from '../components';
import { isDue, isLearned, useProgress, type Grade } from '../store';

const SESSION_SIZE = 20;

export function Practice() {
  const { progress, grade } = useProgress();
  const hasRead = Object.keys(progress.read).length > 0;
  const [deck, setDeck] = useState<string>(hasRead ? 'read' : 'all');
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const decks = useMemo(
    () => [
      { key: 'read', label: 'Bài đã học' },
      { key: 'all', label: 'Tất cả' },
      ...PARTS.map((p) => ({ key: p.id, label: `Phần ${p.id}` })),
    ],
    [],
  );

  const inDeck = useCallback(
    (c: Flashcard) => (deck === 'all' ? true : deck === 'read' ? !!progress.read[c.lesson.id] : c.lesson.part === deck),
    [deck, progress.read],
  );

  const start = (mode: 'due' | 'unlearned') => {
    const now = Date.now();
    const items = CARDS.filter(inDeck);
    let ids: string[];
    if (mode === 'due') {
      const due = items.filter((c) => isDue(progress.srs[c.id], now)).sort((a, b) => progress.srs[a.id].due - progress.srs[b.id].due);
      const fresh = items.filter((c) => !progress.srs[c.id]);
      ids = [...due, ...fresh].slice(0, SESSION_SIZE).map((c) => c.id);
    } else {
      ids = items
        .filter((c) => !isLearned(progress.srs[c.id]))
        .slice(0, SESSION_SIZE)
        .map((c) => c.id);
    }
    setQueue(ids);
    setIndex(0);
    setRevealed(false);
  };

  const current = queue && index < queue.length ? CARDS.find((c) => c.id === queue[index]) : undefined;

  const onGraded = useCallback(
    (g: Grade) => {
      if (!current) return;
      setQueue((q) => {
        if (!q || g !== 'again') return q;
        // A missed card comes back once at the end of the session.
        return q.slice(index + 1).includes(current.id) ? q : [...q, current.id];
      });
      setIndex((i) => i + 1);
      setRevealed(false);
    },
    [current, index],
  );

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3'].includes(e.key)) {
        const g: Grade = e.key === '1' ? 'again' : e.key === '2' ? 'hard' : 'good';
        grade(current.id, g);
        onGraded(g);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, revealed, grade, onGraded]);

  const now = Date.now();
  const deckItems = CARDS.filter(inDeck);
  const dueCount = deckItems.filter((c) => isDue(progress.srs[c.id], now)).length;
  const freshCount = deckItems.filter((c) => !progress.srs[c.id]).length;
  const unlearnedCount = deckItems.filter((c) => !isLearned(progress.srs[c.id])).length;
  const nextDue = deckItems
    .map((c) => progress.srs[c.id]?.due)
    .filter((d): d is number => !!d && d > now)
    .sort((a, b) => a - b)[0];

  return (
    <div className="page">
      <header className="page-header rise">
        <p className="eyebrow">Lặp lại ngắt quãng · {CARDS.length} câu hỏi</p>
        <h1>Ôn tập</h1>
        <p className="lede">
          Mỗi thẻ là một câu hỏi vặn trong giáo trình. Tự trả lời thành tiếng, rồi mới mở cách trả lời. Phím tắt: <kbd>Space</kbd> mở đáp án,{' '}
          <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> chấm mức nhớ. Thẻ nhớ rõ quay lại sau 1, 3, rồi 7 ngày.
        </p>
      </header>

      <div className="chips rise" role="group" aria-label="Bộ thẻ">
        {decks.map((d) => (
          <button
            key={d.key}
            className={`chip ${deck === d.key ? 'active' : ''}`}
            onClick={() => {
              setDeck(d.key);
              setQueue(null);
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {!queue && (
        <div className="card session-start rise">
          {deck === 'read' && !hasRead ? (
            <p className="muted">Chưa có bài nào được đánh dấu đã học. Đọc một bài rồi bấm "Đánh dấu đã học xong" ở cuối bài, hoặc chọn bộ Tất cả.</p>
          ) : (
            <>
              <div className="session-stats">
                <div>
                  <p className="stat-value">{dueCount}</p>
                  <p className="stat-label">đến hạn</p>
                </div>
                <div>
                  <p className="stat-value">{freshCount}</p>
                  <p className="stat-label">chưa ôn</p>
                </div>
                <div>
                  <p className="stat-value">{unlearnedCount}</p>
                  <p className="stat-label">chưa thuộc</p>
                </div>
              </div>
              <div className="row">
                <button className="btn" onClick={() => start('due')} disabled={dueCount + freshCount === 0}>
                  Bắt đầu phiên ôn
                </button>
                <button className="btn-ghost" onClick={() => start('unlearned')} disabled={unlearnedCount === 0}>
                  Ôn các thẻ chưa thuộc
                </button>
              </div>
              {dueCount + freshCount === 0 && nextDue && (
                <p className="muted small">Không còn thẻ đến hạn. Thẻ tiếp theo đến hạn lúc {new Date(nextDue).toLocaleString('vi-VN')}.</p>
              )}
            </>
          )}
        </div>
      )}

      {queue && current && (
        <div className="flash rise" key={`${current.id}-${index}`}>
          <div className="flash-top">
            <a className="muted small" href={lessonHref(current.lesson.id)}>
              Bài {current.lesson.id} · {current.lesson.titleText}
            </a>
            <span className="mono small muted">
              {index + 1}/{queue.length}
            </span>
          </div>
          <Meter value={index / queue.length} />
          <Html html={current.q} className="flash-front" />
          <BoxDots box={progress.srs[current.id]?.box ?? 0} />
          {revealed ? (
            <div className="flash-back">
              <p className="answer-label">Trả lời mẫu</p>
              <Html html={current.a} />
              <GradeButtons id={current.id} onGraded={onGraded} />
            </div>
          ) : (
            <button className="btn" onClick={() => setRevealed(true)}>
              Mở đáp án <kbd>Space</kbd>
            </button>
          )}
        </div>
      )}

      {queue && !current && (
        <div className="card session-start rise">
          <h2>Xong phiên ôn</h2>
          <p className="muted">Đã ôn {queue.length} thẻ. Thẻ trả lời sai quay lại sau 1 phút.</p>
          <button className="btn" onClick={() => setQueue(null)}>
            Về màn hình bắt đầu
          </button>
        </div>
      )}
    </div>
  );
}
