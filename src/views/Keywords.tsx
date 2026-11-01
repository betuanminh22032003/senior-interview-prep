import { useMemo, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { data } from '../data';
import { BoxDots, Html, PageHeader } from '../components';
import { useProgress } from '../store';

export function Keywords() {
  const { progress } = useProgress();
  const [query, setQuery] = useState('');
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = data.keywords.filter((k) => !q || `${k.keyword} ${k.say}`.toLowerCase().includes(q));
    return [...new Set(items.map((k) => k.group))].map((g) => ({ group: g, items: items.filter((k) => k.group === g) }));
  }, [query]);

  return (
    <div className="page">
      <PageHeader eyebrow={`${data.keywords.length} keyword`} title="Keyword trong Skills">
        Bấm vào thẻ để lật. Mặt trước là keyword, mặt sau là câu trả lời 30 giây và bằng chứng thật nếu có.
      </PageHeader>
      <Html html={data.keywordIntroHtml} />

      <label className="search rise">
        <MagnifyingGlass weight="bold" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm keyword..." />
      </label>

      {groups.map(({ group, items }) => (
        <section key={group} className="section">
          <h2>{group}</h2>
          <div className="kw-grid">
            {items.map((k, i) => {
              const open = !!flipped[k.id];
              return (
                <button
                  key={k.id}
                  className={`kw card rise ${open ? 'open' : ''}`}
                  style={{ '--i': Math.min(i, 8) } as React.CSSProperties}
                  onClick={() => setFlipped((f) => ({ ...f, [k.id]: !f[k.id] }))}
                >
                  {open ? (
                    <span className="kw-back">
                      <span className="kw-label">{k.keyword}</span>
                      <Html html={k.say} className="prose small-prose" />
                      {k.evidence && (
                        <span
                          className="kw-evidence"
                          dangerouslySetInnerHTML={{ __html: `Bằng chứng trong interview-prep.md: ${k.evidence}` }}
                        />
                      )}
                    </span>
                  ) : (
                    <span className="kw-front">
                      <span className="kw-name">{k.keyword}</span>
                      <BoxDots box={progress.srs[k.id]?.box ?? 0} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
