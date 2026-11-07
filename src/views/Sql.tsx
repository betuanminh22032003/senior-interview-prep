import { useState } from 'react';
import { CursorClick, Minus, Plus } from '@phosphor-icons/react';
import { sql, SQL_SKILLS } from '../data';
import { Html, PageHeader, QAItem } from '../components';
import { VIZ } from '../sqlviz';
import { isLearned, useProgress } from '../store';
import type { SqlSkill } from '../types';

function Skill({ skill, open, onToggle }: { skill: SqlSkill; open: boolean; onToggle: () => void }) {
  const Viz = skill.viz ? VIZ[skill.viz] : undefined;
  return (
    <div id={`sql-${skill.code}`} className={`acc sql-skill ${open ? 'open' : ''}`}>
      <button className="acc-head" onClick={onToggle} aria-expanded={open}>
        <span className="acc-title card-head">
          <span className="mono code">{skill.code}</span>
          <span className="card-title">{skill.title}</span>
          {Viz && <span className="badge badge-group">Tương tác</span>}
        </span>
        {open ? <Minus weight="bold" /> : <Plus weight="bold" />}
      </button>
      {open && (
        <div className="acc-body">
          {Viz && <Viz />}
          <Html html={skill.bodyHtml} className="prose sql-body" />
          {skill.qas.length > 0 && (
            <div className="qas">
              <h3>Tự hỏi</h3>
              {skill.qas.map((q) => (
                <QAItem key={q.id} qa={q} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Sql() {
  const { progress } = useProgress();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [onlyViz, setOnlyViz] = useState(false);

  const vizCount = SQL_SKILLS.filter((s) => s.viz).length;
  const qaIds = SQL_SKILLS.flatMap((s) => s.qas.map((q) => q.id));
  const learned = qaIds.filter((id) => isLearned(progress.srs[id])).length;

  const jump = (code: string) => {
    setOnlyViz(false);
    setOpen((o) => ({ ...o, [code]: true }));
    requestAnimationFrame(() => document.getElementById(`sql-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="page">
      <PageHeader eyebrow={`${SQL_SKILLS.length} skill · ${vizCount} mô phỏng`} title="Tối ưu SQL Server">
        Các skill cần học, rút từ báo cáo hiệu năng APM của hệ thống thi, mở rộng ở T7. Bấm một skill trên bản đồ để mở. Câu tự hỏi đã thuộc: {learned}/
        {qaIds.length}, ôn tiếp ở mục Luyện tập, bộ Tối ưu SQL.
      </PageHeader>

      <section className="sql-map rise">
        {sql.groups
          .filter((g) => g.skills.length)
          .map((g) => (
            <div key={g.id} className="sql-map-col">
              <p className="sql-map-head">
                <span className="mono">{g.id}</span>
                {g.title}
              </p>
              {g.skills.map((s) => (
                <button key={s.id} className={`sql-map-item ${s.viz ? 'has-viz' : ''}`} onClick={() => jump(s.code)}>
                  <span className="mono code">{s.code}</span>
                  <span className="sql-map-title">{s.title}</span>
                  {s.viz && <CursorClick weight="bold" aria-label="Có mô phỏng" />}
                </button>
              ))}
            </div>
          ))}
      </section>

      <section className="section rise">
        <Html html={sql.introHtml} />
      </section>

      <div className="row sql-tools">
        <button className={`chip ${onlyViz ? 'active' : ''}`} onClick={() => setOnlyViz((v) => !v)}>
          Chỉ skill có mô phỏng
        </button>
        <button
          className="chip"
          onClick={() => setOpen(Object.fromEntries(SQL_SKILLS.filter((s) => !onlyViz || s.viz).map((s) => [s.code, true])))}
        >
          Mở tất cả
        </button>
        <button className="chip" onClick={() => setOpen({})}>
          Đóng tất cả
        </button>
      </div>

      {sql.groups.map((g) => {
        const skills = g.skills.filter((s) => !onlyViz || s.viz);
        if (onlyViz && !skills.length) return null;
        return (
          <section key={g.id} className="section">
            <h2>
              <span className="mono group-code">{g.id}</span> {g.title}
            </h2>
            <Html html={g.introHtml} />
            {skills.length > 0 && (
              <div className="list">
                {skills.map((s) => (
                  <Skill key={s.id} skill={s} open={!!open[s.code]} onToggle={() => setOpen((o) => ({ ...o, [s.code]: !o[s.code] }))} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
