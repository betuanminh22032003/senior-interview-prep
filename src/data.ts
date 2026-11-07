import raw from './data/book.json';
import type { Book, Chapter, Lesson, Part, QA } from './types';

export const book = raw as Book;

export const PARTS: Part[] = book.parts;
export const CHAPTERS: Chapter[] = PARTS.flatMap((p) => p.chapters);
/** Every lesson in reading order. */
export const LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons);

const lessonIndex = new Map(LESSONS.map((l, i) => [l.id, i]));

export const lessonById = (id: string): Lesson | undefined => {
  const i = lessonIndex.get(id);
  return i === undefined ? undefined : LESSONS[i];
};
export const chapterByNum = (num: number) => CHAPTERS.find((c) => c.num === num);
export const partById = (id: string) => PARTS.find((p) => p.id === id);
export const partOfChapter = (num: number) => PARTS.find((p) => p.chapters.some((c) => c.num === num))!;

export const neighbours = (id: string) => {
  const i = lessonIndex.get(id) ?? -1;
  return { prev: i > 0 ? LESSONS[i - 1] : undefined, next: i >= 0 && i < LESSONS.length - 1 ? LESSONS[i + 1] : undefined };
};

/** One flashcard per interview question, tagged with the lesson and part it came from. */
export interface Flashcard extends QA {
  lesson: Lesson;
}

export const CARDS: Flashcard[] = LESSONS.flatMap((l) => l.qas.map((q) => ({ ...q, lesson: l })));

export const TOTALS = {
  parts: PARTS.length,
  chapters: CHAPTERS.length,
  lessons: LESSONS.length,
  questions: CARDS.length,
  exercises: LESSONS.reduce((n, l) => n + l.exercises.length, 0),
  simulations: LESSONS.filter((l) => l.viz).length,
  minutes: LESSONS.reduce((n, l) => n + l.minutes, 0),
};

export const lessonHref = (id: string) => `#/bai/${id}`;
export const chapterHref = (num: number) => `#/chuong/${num}`;
