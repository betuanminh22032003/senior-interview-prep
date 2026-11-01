import { useState } from 'react';
import { data } from '../data';
import { Html, PageHeader, Timer } from '../components';

export function Behavior() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div className="page">
      <PageHeader eyebrow="STAR" title="Câu hỏi hành vi">
        Chỉ dùng câu chuyện thật. Bấm giờ 2 phút, kể thành tiếng, rồi mới mở gợi ý.
      </PageHeader>

      <div className="card rise">
        <Timer presets={[120, 180]} />
      </div>

      <div className="list section">
        {data.behavior.items.map((b, i) => (
          <div key={b.id} className="bh rise" style={{ '--i': i } as React.CSSProperties}>
            <p className="bh-q" dangerouslySetInnerHTML={{ __html: b.question }} />
            {open[b.id] ? (
              <div className="qa-answer">
                <p dangerouslySetInnerHTML={{ __html: b.story }} />
                <p className="muted small" dangerouslySetInnerHTML={{ __html: `Nguồn trong interview-prep.md: ${b.source}` }} />
              </div>
            ) : (
              <button className="btn-link" onClick={() => setOpen((o) => ({ ...o, [b.id]: true }))}>
                Xem câu chuyện nên dùng
              </button>
            )}
          </div>
        ))}
      </div>

      <section className="section">
        <Html html={data.behavior.noteHtml} />
      </section>
    </div>
  );
}
