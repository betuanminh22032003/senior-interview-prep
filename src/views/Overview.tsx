import { ALL_QAS, data, STUDY_ITEMS } from '../data';
import { Accordion, Html, PageHeader, StatusBadge } from '../components';
import { isDue, isLearned, useProgress } from '../store';
import { STATUS_LABEL, type Status } from '../types';

const STATUS_ORDER: Status[] = ['that', 'mot-phan', 'minh-hoa'];

export function Overview({ go }: { go: (view: string) => void }) {
  const { progress } = useProgress();
  const now = Date.now();
  const learnedQa = ALL_QAS.filter((q) => isLearned(progress.srs[q.id])).length;
  const learnedAll = STUDY_ITEMS.filter((i) => isLearned(progress.srs[i.id])).length;
  const due = STUDY_ITEMS.filter((i) => isDue(progress.srs[i.id], now)).length;
  const fresh = STUDY_ITEMS.filter((i) => !progress.srs[i.id]).length;
  const checked = data.checklist.filter((_, i) => progress.checklist[i]).length;
  const rows = data.statusRows.filter((r) => r.num !== 'S');
  const counts = STATUS_ORDER.map((s) => ({ s, n: rows.filter((r) => r.status === s).length }));

  return (
    <div className="page">
      <PageHeader eyebrow="CV tham khảo · main.tex" title="Ôn phỏng vấn Senior Backend">
        Mỗi dòng CV có cơ chế, câu hỏi xoáy và đáp án. Ôn theo kiểu lặp lại ngắt quãng: câu trả lời sai quay lại trong vài phút, câu đã
        nhớ quay lại sau vài ngày.
      </PageHeader>

      <section className="bento">
        <div className="card stat rise" style={{ '--i': 1 } as React.CSSProperties}>
          <p className="stat-label">Câu hỏi xoáy đã thuộc</p>
          <p className="stat-value">
            {learnedQa}
            <span>/{ALL_QAS.length}</span>
          </p>
          <div className="meter">
            <i style={{ transform: `scaleX(${learnedQa / ALL_QAS.length})` }} />
          </div>
        </div>
        <div className="card stat rise" style={{ '--i': 2 } as React.CSSProperties}>
          <p className="stat-label">Đến hạn ôn</p>
          <p className="stat-value">{due}</p>
          <p className="muted small">{fresh} thẻ chưa học</p>
          <button className="btn" onClick={() => go('practice')}>
            Ôn ngay
          </button>
        </div>
        <div className="card stat rise" style={{ '--i': 3 } as React.CSSProperties}>
          <p className="stat-label">Tất cả thẻ đã thuộc</p>
          <p className="stat-value">
            {learnedAll}
            <span>/{STUDY_ITEMS.length}</span>
          </p>
          <p className="muted small">Gồm câu hỏi xoáy, từng dòng CV, keyword, hành vi</p>
        </div>
        <div className="card stat rise" style={{ '--i': 4 } as React.CSSProperties}>
          <p className="stat-label">Checklist trước khi dùng CV</p>
          <p className="stat-value">
            {checked}
            <span>/{data.checklist.length}</span>
          </p>
          <button className="btn-ghost" onClick={() => go('checklist')}>
            Mở checklist
          </button>
        </div>
        <div className="card wide rise" style={{ '--i': 5 } as React.CSSProperties}>
          <p className="stat-label">26 dòng CV theo mức độ thật</p>
          <div className="dist">
            {counts.map(({ s, n }) => (
              <div key={s} className="dist-row">
                <StatusBadge status={s} />
                <div className={`dist-bar dist-${s}`}>
                  <i style={{ transform: `scaleX(${n / rows.length})` }} />
                </div>
                <span className="mono">{n}</span>
              </div>
            ))}
          </div>
          <p className="muted small">
            {STATUS_LABEL['minh-hoa']}: chưa làm. Chỉ nói ở mức thiết kế, làm thật rồi đo, hoặc bỏ khỏi CV khi nộp.
          </p>
        </div>
      </section>

      <section className="section rise">
        <Html html={data.introHtml} />
      </section>

      <section className="section">
        <Accordion head={<span>Bảng trạng thái từng dòng CV</span>}>
          <div className="table-wrap">
            <table className="status-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Dòng CV</th>
                  <th>Trạng thái</th>
                  <th>Phần thật</th>
                  <th>Phần minh họa</th>
                </tr>
              </thead>
              <tbody>
                {data.statusRows.map((r) => (
                  <tr key={r.num}>
                    <td className="mono">{r.num}</td>
                    <td dangerouslySetInnerHTML={{ __html: r.line }} />
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td dangerouslySetInnerHTML={{ __html: r.real }} />
                    <td dangerouslySetInnerHTML={{ __html: r.illustrative }} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Accordion>
      </section>
    </div>
  );
}
