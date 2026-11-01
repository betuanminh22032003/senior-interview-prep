import { useMemo, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { data, GROUPS } from '../data';
import { Accordion, Html, PageHeader, QAItem, StatusBadge } from '../components';
import { isLearned, useProgress } from '../store';
import { STATUS_LABEL, type Status } from '../types';

const STATUSES: Status[] = ['that', 'mot-phan', 'minh-hoa'];

export function Cards() {
  const { progress } = useProgress();
  const [group, setGroup] = useState<string>('all');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [query, setQuery] = useState('');

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.cards.filter(
      (c) =>
        (group === 'all' || c.group === group) &&
        (status === 'all' || c.status === status) &&
        (!q || c.search.includes(q)),
    );
  }, [group, status, query]);

  return (
    <div className="page">
      <PageHeader eyebrow="26 dòng" title="Từng dòng CV">
        Mở một dòng để xem trạng thái, cơ chế cần nói được và câu hỏi xoáy. Chấm mức nhớ ngay dưới mỗi đáp án.
      </PageHeader>

      <div className="section">
        <Accordion head={<span>Summary và dòng Platform</span>}>
          <Html html={data.summaryHtml} />
        </Accordion>
      </div>

      <div className="filters rise">
        <label className="search">
          <MagnifyingGlass weight="bold" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo từ khóa: Redis, applock, SLO..."
          />
        </label>
        <div className="chips">
          <button className={`chip ${group === 'all' ? 'active' : ''}`} onClick={() => setGroup('all')}>
            Mọi nơi
          </button>
          {GROUPS.map((g) => (
            <button key={g} className={`chip ${group === g ? 'active' : ''}`} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <div className="chips">
          <button className={`chip ${status === 'all' ? 'active' : ''}`} onClick={() => setStatus('all')}>
            Mọi trạng thái
          </button>
          {STATUSES.map((s) => (
            <button key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <p className="muted small">{cards.length} dòng</p>

      <div className="list">
        {cards.map((c, i) => {
          const learned = c.qas.filter((q) => isLearned(progress.srs[q.id])).length;
          return (
            <div key={c.id} className="rise" style={{ '--i': Math.min(i, 10) } as React.CSSProperties}>
              <Accordion
                head={
                  <span className="card-head">
                    <span className="mono code">{c.code}</span>
                    <span className="card-title">{c.title}</span>
                    <span className="card-tags">
                      <span className="badge badge-group">{c.group}</span>
                      <StatusBadge status={c.status} />
                      {c.qas.length > 0 && (
                        <span className="mono small muted">
                          {learned}/{c.qas.length}
                        </span>
                      )}
                    </span>
                  </span>
                }
              >
                <div className={`status-note note-${c.status}`}>
                  <Html html={c.statusHtml} />
                </div>
                <Html html={c.bodyHtml} />
                {c.qas.length > 0 && (
                  <div className="qas">
                    <h3>Câu hỏi xoáy</h3>
                    {c.qas.map((q) => (
                      <QAItem key={q.id} qa={q} />
                    ))}
                  </div>
                )}
              </Accordion>
            </div>
          );
        })}
      </div>
    </div>
  );
}
