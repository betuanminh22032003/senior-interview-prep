import { data } from '../data';
import { Accordion, Html, PageHeader, Timer } from '../components';

export function Design() {
  return (
    <div className="page">
      <PageHeader eyebrow={`${data.design.topics.length} bài`} title="System design">
        Bấm giờ rồi tự trình bày trên giấy trước khi mở lời giải. Bài chính là D6.1, làm trong 40 phút.
      </PageHeader>

      <div className="card rise">
        <Timer presets={[40 * 60, 15 * 60]} />
      </div>

      <section className="section rise">
        <Html html={data.design.frameHtml} />
      </section>

      <section className="section">
        {data.design.topics.map((t) => (
          <Accordion
            key={t.id}
            head={
              <span className="card-head">
                <span className="mono code">{t.id}</span>
                <span className="card-title">{t.title}</span>
              </span>
            }
          >
            <Html html={t.html} />
          </Accordion>
        ))}
      </section>
    </div>
  );
}
