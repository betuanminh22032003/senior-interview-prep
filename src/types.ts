export type Status = 'that' | 'mot-phan' | 'minh-hoa';

export interface QA {
  id: string;
  q: string;
  a: string;
}

export interface Exercise {
  q: string;
  /** Hidden answer; empty when the exercise has none. */
  a: string;
}

export interface Section {
  id: string;
  title: string;
  html: string;
}

export interface Lesson {
  id: string;
  title: string;
  titleText: string;
  part: string;
  chapter: number;
  /** The CV line this lesson defends; empty for non-CV lessons. */
  cvLine: string;
  status: Status | '';
  statusHtml: string;
  /** Key of the interactive widget, empty when the lesson has none. */
  viz: string;
  goalsHtml: string;
  sections: Section[];
  qas: QA[];
  summaryHtml: string;
  exercises: Exercise[];
  /** Ids of interactive checklist items inside the sections. */
  tasks: string[];
  minutes: number;
}

export interface Chapter {
  num: number;
  title: string;
  introHtml: string;
  lessons: Lesson[];
}

export interface Part {
  id: string;
  title: string;
  introHtml: string;
  chapters: Chapter[];
}

export interface Book {
  parts: Part[];
}

export const STATUS_LABEL: Record<Status, string> = {
  that: 'Thật',
  'mot-phan': 'Một phần',
  'minh-hoa': 'Minh họa',
};

export const STATUS_HINT: Record<Status, string> = {
  that: 'Có bằng chứng: commit, báo cáo, hoặc đã xác nhận.',
  'mot-phan': 'Cốt lõi thật, con số hoặc phạm vi là minh họa.',
  'minh-hoa': 'Chưa làm. Chỉ nói ở mức thiết kế.',
};
