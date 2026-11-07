import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { LESSONS, lessonHref } from '../data';
import { StatusBadge } from '../components';
import type { Lesson } from '../types';

/** Lowercase without Vietnamese diacritics, so "chi so" matches "chỉ số". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ');

/** Plain text of every lesson, built on first use. */
let index: { lesson: Lesson; text: string; folded: string; title: string }[] | null = null;
function getIndex() {
  index ??= LESSONS.map((l) => {
    const text = plain(
      [l.cvLine, l.statusHtml, l.goalsHtml, ...l.sections.map((s) => s.title + ' ' + s.html), ...l.qas.map((q) => q.q + ' ' + q.a), l.summaryHtml, ...l.exercises.map((e) => e.q + ' ' + e.a)].join(' '),
    ).trim();
    return { lesson: l, text, folded: fold(text), title: fold(`${l.id} ${l.titleText}`) };
  });
  return index;
}

function snippet(text: string, folded: string, terms: string[]) {
  const at = Math.min(...terms.map((t) => folded.indexOf(t)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return text.slice(0, 180);
  const start = Math.max(0, at - 70);
  const end = Math.min(text.length, at + 150);
  const piece = text.slice(start, end);
  const foldedPiece = folded.slice(start, end);
  // Highlight each term occurrence using positions found in the folded text.
  const marks: [number, number][] = [];
  for (const t of terms) {
    let i = foldedPiece.indexOf(t);
    while (i >= 0) {
      marks.push([i, i + t.length]);
      i = foldedPiece.indexOf(t, i + t.length);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  marks.forEach(([a, b], k) => {
    if (a < pos) return;
    out.push(piece.slice(pos, a), <mark key={k}>{piece.slice(a, b)}</mark>);
    pos = b;
  });
  out.push(piece.slice(pos));
  return (
    <>
      {start > 0 && '… '}
      {out}
      {end < text.length && ' …'}
    </>
  );
}

export function Search({ initial }: { initial: string }) {
  const [q, setQ] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const terms = useMemo(
    () =>
      fold(q)
        .split(/\s+/)
        .filter((t) => t.length > 1),
    [q],
  );
  const results = useMemo(() => {
    if (!terms.length) return [];
    return getIndex().filter((e) => terms.every((t) => e.folded.includes(t)))
      .map((e) => ({ ...e, score: terms.reduce((n, t) => n + (e.title.includes(t) ? 10 : 0) + e.folded.split(t).length - 1, 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);
  }, [terms]);

  return (
    <div className="page">
      <header className="page-header rise">
        <p className="eyebrow">Tra cứu</p>
        <h1>Tìm trong giáo trình</h1>
        <p className="lede">Gõ không dấu cũng được. Tìm trong tiêu đề, nội dung, câu hỏi và bài tập của mọi bài.</p>
      </header>
      <label className="search-box">
        <MagnifyingGlass weight="bold" aria-hidden />
        <input
          ref={input}
          type="search"
          value={q}
          placeholder="Ví dụ: parameter sniffing, applock, burn rate"
          onChange={(e) => {
            setQ(e.target.value);
            history.replaceState(null, '', `#/tim${e.target.value ? `?q=${encodeURIComponent(e.target.value)}` : ''}`);
          }}
          aria-label="Từ khóa"
        />
      </label>
      {terms.length > 0 && <p className="muted small">{results.length ? `${results.length} bài khớp` : 'Không có bài nào khớp.'}</p>}
      <ol className="search-results">
        {results.map(({ lesson, text, folded }) => (
          <li key={lesson.id}>
            <a href={lessonHref(lesson.id)}>
              <span className="search-title">
                <span className="mono">Bài {lesson.id}</span> {lesson.titleText}
                {lesson.status && <StatusBadge status={lesson.status} />}
              </span>
              <span className="search-snippet">{snippet(text, folded, terms)}</span>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
