import { useCallback, useEffect, useState } from 'react';
import { DECKS, STUDY_ITEMS, type StudyItem } from '../data';
import { BoxDots, GradeButtons, Html, PageHeader } from '../components';
import { isDue, isLearned, useProgress, type Grade } from '../store';

const SESSION_SIZE = 20;
type DeckKey = (typeof DECKS)[number]['key'];

export function Practice() {
  const { progress, grade } = useProgress();
  const [deck, setDeck] = useState<DeckKey>('qa');
  const [queue, setQueue] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const inDeck = useCallback((i: StudyItem) => deck === 'all' || i.deck === deck, [deck]);

  const start = (mode: 'due' | 'unlearned') => {
    const now = Date.now();
    const items = STUDY_ITEMS.filter(inDeck);
    let ids: string[];
    if (mode === 'due') {
      const due = items
        .filter((i) => isDue(progress.srs[i.id], now))
        .sort((a, b) => progress.srs[a.id].due - progress.srs[b.id].due);
      const fresh = items.filter((i) => !progress.srs[i.id]);
      ids = [...due, ...fresh].slice(0, SESSION_SIZE).map((i) => i.id);
    } else {
      ids = items
        .filter((i) => !isLearned(progress.srs[i.id]))
        .slice(0, SESSION_SIZE)
        .map((i) => i.id);
    }
    setQueue(ids);
    setIndex(0);
    setRevealed(false);
  };

  const current = queue && index < queue.length ? STUDY_ITEMS.find((i) => i.id === queue[index]) : undefined;

  const onGraded = useCallback(
    (g: Grade) => {
      if (!current) return;
      setQueue((q) => {
        if (!q || g !== 'again') return q;
        // A missed item comes back once at the end of the session.
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
  const deckItems = STUDY_ITEMS.filter(inDeck);
  const dueCount = deckItems.filter((i) => isDue(progress.srs[i.id], now)).length;
  const freshCount = deckItems.filter((i) => !progress.srs[i.id]).length;
  const unlearnedCount = deckItems.filter((i) => !isLearned(progress.srs[i.id])).length;
  const nextDue = deckItems
    .map((i) => progress.srs[i.id]?.due)
    .filter((d): d is number => !!d && d > now)
    .sort((a, b) => a - b)[0];

  return (
    <div className="page">
      <PageHeader eyebrow="Lặp lại ngắt quãng" title="Luyện tập">
        Đọc câu hỏi, tự trả lời thành tiếng, rồi mới mở đáp án. Phím tắt: <kbd>Space</kbd> mở đáp án, <kbd>1</kbd> <kbd>2</kbd>{' '}
        <kbd>3</kbd> chấm mức nhớ.
      </PageHeader>

      <div className="chips rise">
        {DECKS.map((d) => (
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
          <div className="session-stats">
            <div>
              <p className="stat-value">{dueCount}</p>
              <p className="muted small">đến hạn</p>
            </div>
            <div>
              <p className="stat-value">{freshCount}</p>
              <p className="muted small">chưa học</p>
            </div>
            <div>
              <p className="stat-value">{unlearnedCount}</p>
              <p className="muted small">chưa thuộc</p>
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
        </div>
      )}

      {queue && current && (
        <div className="flash rise" key={`${current.id}-${index}`}>
          <div className="flash-top">
            <span className="muted small">{current.label}</span>
            <span className="mono small muted">
              {index + 1}/{queue.length}
            </span>
          </div>
          <div className="meter">
            <i style={{ transform: `scaleX(${index / queue.length})` }} />
          </div>
          <Html html={current.front} className="flash-front" />
          <BoxDots box={progress.srs[current.id]?.box ?? 0} />
          {revealed ? (
            <div className="flash-back">
              <Html html={current.back} />
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
          <p className="muted">Đã ôn {queue.length} thẻ. Thẻ trả lời sai sẽ quay lại sau 1 phút.</p>
          <button className="btn" onClick={() => setQueue(null)}>
            Về màn hình bắt đầu
          </button>
        </div>
      )}
    </div>
  );
}
