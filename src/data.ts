import raw from './data/prep.json';
import sqlRaw from './data/sql.json';
import type { PrepData, SqlData } from './types';

export const data = raw as PrepData;

export const sql = sqlRaw as SqlData;

export const SQL_SKILLS = sql.groups.flatMap((g) => g.skills);

export const GROUPS = [...new Set(data.cards.map((c) => c.group))];

export const ALL_QAS = data.cards.flatMap((c) => c.qas);

/** One recall prompt per study item, used by the practice deck. */
export interface StudyItem {
  id: string;
  deck: 'qa' | 'card' | 'keyword' | 'behavior' | 'sql';
  label: string;
  front: string;
  back: string;
}

export const STUDY_ITEMS: StudyItem[] = [
  ...ALL_QAS.map((q) => ({
    id: q.id,
    deck: 'qa' as const,
    label: `${q.source} · ${q.sourceTitle}`,
    front: q.q,
    back: q.a,
  })),
  ...data.cards.map((c) => ({
    id: `card-${c.id}`,
    deck: 'card' as const,
    label: `${c.code} · ${c.group}`,
    front: `Giải thích dòng CV này đủ 3 tầng (làm gì, làm thế nào, sao biết là đúng): <strong>${c.title}</strong>`,
    back: c.statusHtml + c.bodyHtml,
  })),
  ...data.keywords.map((k) => ({
    id: k.id,
    deck: 'keyword' as const,
    label: k.group,
    front: `Nói trong 30 giây: <strong>${k.keyword}</strong>`,
    back: `<p>${k.say}</p>${k.evidence ? `<p class="muted">Bằng chứng thật: ${k.evidence}</p>` : ''}`,
  })),
  ...data.behavior.items.map((b) => ({
    id: b.id,
    deck: 'behavior' as const,
    label: 'Câu hỏi hành vi',
    front: b.question,
    back: `<p>${b.story}</p><p class="muted">Nguồn: ${b.source}</p>`,
  })),
  ...SQL_SKILLS.flatMap((s) =>
    s.qas.map((q) => ({
      id: q.id,
      deck: 'sql' as const,
      label: `${s.code} · ${s.title}`,
      front: q.q,
      back: q.a,
    })),
  ),
];

export const DECKS: { key: StudyItem['deck'] | 'all'; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'qa', label: 'Câu hỏi xoáy' },
  { key: 'card', label: 'Từng dòng CV' },
  { key: 'keyword', label: 'Keyword' },
  { key: 'behavior', label: 'Hành vi' },
  { key: 'sql', label: 'Tối ưu SQL' },
];
