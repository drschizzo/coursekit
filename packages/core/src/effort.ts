// What a module holds, how long it takes, and how far the learner went in
// it. The counts and the estimate depend only on the course; the stats add
// the learner's progress on top.

import type { Progress } from './progress.ts';
import { STOP_KINDS, type Timeline } from './timeline.ts';

/** Minutes of work per element: reading and thinking, not just reading. */
export const EFFORT = { step: 1, question: 1.5, experiment: 4, explain: 3, exercise: 10, test: 10, review: 3 };
export type Effort = typeof EFFORT;

interface ExerciseRef { id: string; module: string }

/** The elements of module `i`. */
export interface ModuleCounts {
  chapters: number;
  steps: number;
  /** pauses, by line of the effort estimate */
  pauses: Record<Exclude<keyof Effort, 'step' | 'exercise'>, number>;
  exercises: number;
  /** estimated working time, in minutes */
  minutes: number;
}

export function moduleCounts(tl: Timeline, i: number, exercises: ExerciseRef[], effort: Effort = EFFORT): ModuleCounts {
  const m = tl.modules[i];
  const steps = tl.caps.filter((c) => c.t >= m.t0 - 1e-3 && c.t < m.t1 - 1e-3).length;
  const pauses = { question: 0, experiment: 0, explain: 0, test: 0, review: 0 };
  for (const s of tl.stops) {
    const line = STOP_KINDS[s.kind].effort;
    if (s.module === i && line) pauses[line]++;
  }
  const nEx = exercises.filter((c) => c.module === m.id).length;
  let minutes = steps * effort.step + nEx * effort.exercise;
  for (const [k, n] of Object.entries(pauses)) minutes += n * effort[k as keyof typeof pauses];
  return { chapters: m.chapters.length, steps, pauses, exercises: nEx, minutes: Math.round(minutes) };
}

export interface ModuleStats {
  chapters: number; seen: number;
  quiz: number; answered: number; right: number;
  missions: number; missDone: number;
  code: number; codeDone: number;
  explain: number; explainDone: number;
  /** estimated working time, in minutes */
  minutes: number;
}

/** Module `i`, and how far the learner went in it. */
export function moduleStats(tl: Timeline, prog: Progress, i: number, exercises: ExerciseRef[], effort: Effort = EFFORT): ModuleStats {
  const m = tl.modules[i];
  const stops = tl.stops.filter((s) => s.module === i);
  const quiz = stops.filter((s) => s.kind === 'quiz');
  const miss = stops.filter((s) => s.kind === 'try' && s.goals);
  const expl = stops.filter((s) => s.kind === 'explain');
  const code = exercises.filter((c) => c.module === m.id);
  return {
    chapters: m.chapters.length, seen: m.chapters.filter((k) => prog.d.seen[k]).length,
    quiz: quiz.length, answered: quiz.filter((s) => s.id in prog.d.quiz).length, right: quiz.filter((s) => prog.d.quiz[s.id] === 1).length,
    missions: miss.length, missDone: miss.filter((s) => prog.d.missions[s.id]).length,
    code: code.length, codeDone: code.filter((c) => prog.d.code[c.id]?.done).length,
    explain: expl.length, explainDone: expl.filter((s) => prog.d.explain[s.id]?.text).length,
    minutes: moduleCounts(tl, i, exercises, effort).minutes,
  };
}

/** Estimated working time of the whole course, in minutes (the bonus modules apart), as the home page shows it. */
export function courseMinutes(tl: Timeline, exercises: ExerciseRef[], effort: Effort = EFFORT): number {
  return tl.modules.reduce((s, m, i) => s + (m.kind === 'bonus' ? 0 : moduleCounts(tl, i, exercises, effort).minutes), 0);
}

/** A duration as the home page shows it: « ≈ 45 min », « ≈ 3 h 20 ». */
export const fmtMinutes = (m: number): string => (m < 60 ? `≈ ${m} min` : `≈ ${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`);

/** The words for numbers an announced effort may use, by language. */
const NUMBER_WORDS: Record<string, number> = {
  une: 1, un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

/** The minutes an announced effort says (« trois à quatre heures », « 90 min », « two hours »): [min, max], or null when it gives no duration. */
export function effortMinutes(s: string): [number, number] | null {
  const t = ` ${s.toLowerCase().replace(/[’']/g, ' ')} `;
  const n = `(\\d+(?:[.,]\\d+)?|${Object.keys(NUMBER_WORDS).join('|')})`;
  const m = new RegExp(`[\\s(]${n}(?:\\s*(?:à|-|–|ou|to|or)\\s*${n})?\\s*(heures?|hours?|h(?![a-zà-ü])|minutes?|min(?![a-zà-ü]))(\\s+(?:et\\s+demie|and\\s+a\\s+half))?`).exec(t);
  if (!m) return null;
  const val = (x: string) => NUMBER_WORDS[x] ?? Number(x.replace(',', '.'));
  const unit = /^m/.test(m[3]) ? 1 : 60;
  const half = m[4] ? 30 : 0;
  const lo = val(m[1]) * unit, hi = (m[2] ? val(m[2]) : val(m[1])) * unit + half;
  return [m[2] ? lo : lo + half, hi];
}
