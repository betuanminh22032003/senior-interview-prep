export type Status = 'that' | 'mot-phan' | 'minh-hoa';

export interface QA {
  id: string;
  q: string;
  a: string;
  source: string;
  sourceTitle: string;
}

export interface Card {
  id: string;
  code: string;
  title: string;
  group: string;
  status: Status;
  statusHtml: string;
  bodyHtml: string;
  qas: QA[];
  search: string;
}

export interface StatusRow {
  num: string;
  line: string;
  status: Status;
  real: string;
  illustrative: string;
}

export interface Keyword {
  id: string;
  group: string;
  keyword: string;
  say: string;
  evidence: string;
}

export interface BehaviorItem {
  id: string;
  question: string;
  story: string;
  source: string;
}

export interface PrepData {
  introHtml: string;
  statusRows: StatusRow[];
  summaryHtml: string;
  cards: Card[];
  keywordIntroHtml: string;
  keywords: Keyword[];
  design: { frameHtml: string; topics: { id: string; title: string; html: string }[] };
  behavior: { items: BehaviorItem[]; noteHtml: string };
  checklist: string[];
}

export interface SqlSkill {
  id: string;
  code: string;
  title: string;
  group: string;
  /** Key of the interactive widget, empty when the skill has none. */
  viz: string;
  bodyHtml: string;
  qas: QA[];
}

export interface SqlGroup {
  id: string;
  title: string;
  introHtml: string;
  skills: SqlSkill[];
}

export interface SqlData {
  introHtml: string;
  groups: SqlGroup[];
}

export const STATUS_LABEL: Record<Status, string> = {
  that: 'Thật',
  'mot-phan': 'Một phần',
  'minh-hoa': 'Minh họa',
};
