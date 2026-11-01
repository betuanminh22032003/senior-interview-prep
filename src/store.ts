import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Grade = 'again' | 'hard' | 'good';

export interface SrsEntry {
  box: number;
  due: number;
}

interface Progress {
  srs: Record<string, SrsEntry>;
  checklist: Record<number, boolean>;
}

const KEY = 'senior-interview-prep:v1';
const EMPTY: Progress = { srs: {}, checklist: {} };

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// Leitner boxes: a wrong answer comes back within the session, a known one days later.
const INTERVAL: Record<number, number> = { 1: MINUTE, 2: 10 * MINUTE, 3: DAY, 4: 3 * DAY, 5: 7 * DAY };

/** An item counts as learned once it reaches box 3 (answered correctly at least twice in a row). */
export const LEARNED_BOX = 3;

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt: start empty.
  }
  return EMPTY;
}

export function useProgressState() {
  const [progress, setProgress] = useState<Progress>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {
      // Storage blocked: progress lives only in memory.
    }
  }, [progress]);

  const grade = useCallback((id: string, g: Grade) => {
    setProgress((p) => {
      const box = p.srs[id]?.box ?? 0;
      const next = g === 'again' ? 1 : g === 'hard' ? Math.max(1, box) : Math.min(5, box + 1);
      return { ...p, srs: { ...p.srs, [id]: { box: next, due: Date.now() + INTERVAL[next] } } };
    });
  }, []);

  const toggleCheck = useCallback((index: number) => {
    setProgress((p) => ({ ...p, checklist: { ...p.checklist, [index]: !p.checklist[index] } }));
  }, []);

  const reset = useCallback(() => setProgress(EMPTY), []);

  return { progress, grade, toggleCheck, reset };
}

export type ProgressApi = ReturnType<typeof useProgressState>;

export const ProgressContext = createContext<ProgressApi | null>(null);

export function useProgress(): ProgressApi {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressContext');
  return ctx;
}

export const isLearned = (entry: SrsEntry | undefined) => (entry?.box ?? 0) >= LEARNED_BOX;
export const isDue = (entry: SrsEntry | undefined, now: number) => !!entry && entry.due <= now;
