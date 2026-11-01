import { data } from '../data';
import { PageHeader } from '../components';
import { useProgress } from '../store';

export function Checklist() {
  const { progress, toggleCheck } = useProgress();
  const done = data.checklist.filter((_, i) => progress.checklist[i]).length;
  return (
    <div className="page">
      <PageHeader eyebrow={`${done}/${data.checklist.length} xong`} title="Checklist trước khi dùng CV">
        Đánh dấu khi đã xử lý xong. Trạng thái lưu trên trình duyệt này.
      </PageHeader>
      <div className="meter rise">
        <i style={{ transform: `scaleX(${done / data.checklist.length})` }} />
      </div>
      <ul className="checklist">
        {data.checklist.map((item, i) => (
          <li key={i} className="rise" style={{ '--i': i } as React.CSSProperties}>
            <label className={progress.checklist[i] ? 'checked' : ''}>
              <input type="checkbox" checked={!!progress.checklist[i]} onChange={() => toggleCheck(i)} />
              <span dangerouslySetInnerHTML={{ __html: item }} />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
