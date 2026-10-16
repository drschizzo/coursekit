// Saved progress, the spaced review of the questions, and the effort
// estimate. Taken from avbd's course/course.ts; the store is now an
// interface (browser storage by default), and progress is keyed by the ids
// of the questions, experiments and exercises, never by chapter titles.

import type { Timeline } from './timeline.ts';

export interface TestRecord { done: boolean; a: Record<string, 0 | 1>; b: Record<string, 0 | 1> }

export interface ProgressData {
  lastT: number;
  maxT: number;
  /** chapters seen, by index */
  seen: Record<string, 1>;
  /** first answer to each question: what the learner knew */
  quiz: Record<string, 0 | 1>;
  /** spaced review state of each question */
  rev: Record<string, { box: number; next: number }>;
  /** review sessions done so far (the review clock) */
  sessions: number;
  missions: Record<string, 1>;
  predict: Record<string, number>;
  explain: Record<string, { text: string; self?: 0 | 1 | 2 }>;
  /** modules whose end card was reached */
  done: Record<string, 1>;
  code: Record<string, { done?: boolean; src?: string; stage?: number; answer?: unknown }>;
  tools: Record<string, 1>;
  tests: { pre?: TestRecord; post?: TestRecord };
  stepMode: boolean;
}

export interface ProgressStore {
  load(key: string): ProgressData | null;
  save(key: string, data: ProgressData): void;
}

/** Browser storage; falls back to memory when storage is off (private window, tests). */
export function browserStore(): ProgressStore {
  const mem = new Map<string, string>();
  const ls = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
  return {
    load(key) {
      try { const s = ls()?.getItem(key) ?? mem.get(key); return s ? JSON.parse(s) : null; } catch { return null; }
    },
    save(key, data) {
      const s = JSON.stringify(data);
      try { const st = ls(); if (st) st.setItem(key, s); else mem.set(key, s); } catch { mem.set(key, s); }
    },
  };
}

/** Spaced review: a question in box b comes back after INTERVAL[b] review sessions. */
const INTERVAL = [1, 1, 2, 4, 8];

export const emptyProgress = (): ProgressData => ({
  lastT: 0, maxT: 0, seen: {}, quiz: {}, rev: {}, sessions: 0, missions: {}, predict: {}, explain: {},
  done: {}, code: {}, tools: {}, tests: {}, stepMode: true,
});

export class Progress {
  d: ProgressData = emptyProgress();
  readonly key: string;
  private store: ProgressStore;

  constructor(courseId: string, version: number, store: ProgressStore = browserStore()) {
    this.key = `coursekit:${courseId}:v${version}`;
    this.store = store;
    const saved = store.load(this.key);
    if (saved) Object.assign(this.d, saved);
  }
  save(): void { this.store.save(this.key, this.d); }
  reset(): void { this.d = emptyProgress(); this.save(); }
  /** the learner's progress as a file they can keep or show */
  export(): string { return JSON.stringify({ key: this.key, at: new Date().toISOString(), progress: this.d }, null, 2); }
  get started(): boolean { return this.d.maxT > 5; }
  setT(t: number): void { this.d.lastT = t; this.d.maxT = Math.max(this.d.maxT, t); }
  seen(chapter: number): void { if (!this.d.seen[chapter]) { this.d.seen[chapter] = 1; this.save(); } }

  /**
   * Records an answer. The first answer is kept as the measure of what the
   * learner knew; every answer moves the question in the review boxes: right
   * and sure goes up a box, right but hesitant stays low, anything else goes
   * back to the first box and comes back at the next review.
   */
  answer(id: string, ok: boolean, conf: 0 | 1 | 2 | null): void {
    if (!(id in this.d.quiz)) this.d.quiz[id] = ok ? 1 : 0;
    const r = this.d.rev[id] ?? { box: 0, next: 0 };
    if (ok && conf !== 0 && conf !== 1) r.box = Math.min(INTERVAL.length - 1, r.box + 1);
    else if (ok && conf === 1) r.box = 1;
    else r.box = 0;
    r.next = this.d.sessions + INTERVAL[r.box];
    this.d.rev[id] = r;
    this.save();
  }
  /** Questions due for review among `ids`, the most urgent first. */
  due(ids: string[]): string[] {
    return ids
      .filter((id) => id in this.d.rev && this.d.rev[id].next <= this.d.sessions)
      .sort((a, b) => this.d.rev[a].box - this.d.rev[b].box || this.d.rev[a].next - this.d.rev[b].next);
  }
  newSession(): void { this.d.sessions++; this.save(); }

  mission(id: string): void { if (!this.d.missions[id]) { this.d.missions[id] = 1; this.save(); } }
  predicted(id: string, i: number): void { this.d.predict[id] = i; this.save(); }
  explained(id: string, patch: { text?: string; self?: 0 | 1 | 2 }): void {
    this.d.explain[id] = Object.assign({ text: '' }, this.d.explain[id], patch);
    this.save();
  }
  done(id: string): void { if (!this.d.done[id]) { this.d.done[id] = 1; this.save(); } }
  code(id: string, patch: { done?: boolean; src?: string; stage?: number; answer?: unknown }): void {
    this.d.code[id] = { ...this.d.code[id], ...patch };
    this.save();
  }
  tool(id: string): void { this.d.tools[id] = 1; this.save(); }
  test(kind: 'pre' | 'post', rec: TestRecord): void { this.d.tests[kind] = rec; this.save(); }
  setStepMode(on: boolean): void { this.d.stepMode = on; this.save(); }
}

// ------------------------------------------------------------------ stats

export interface ModuleStats {
  chapters: number; seen: number;
  quiz: number; answered: number; right: number;
  missions: number; missDone: number;
  code: number; codeDone: number;
  explain: number; explainDone: number;
  /** estimated working time, in minutes */
  minutes: number;
}

/** Minutes of work per element: reading and thinking, not just reading. */
export const EFFORT = { step: 1, question: 1.5, experiment: 4, explain: 3, exercise: 10, test: 10, review: 3 };

export function moduleStats(tl: Timeline, prog: Progress, i: number, exercises: { id: string; module: string }[], effort = EFFORT): ModuleStats {
  const m = tl.modules[i];
  const inMod = (t: number) => t >= m.t0 - 1e-3 && t < m.t1 - 1e-3;
  const stops = tl.stops.filter((s) => s.module === i);
  const quiz = stops.filter((s) => s.kind === 'quiz');
  const miss = stops.filter((s) => s.kind === 'try' && s.goals);
  const expl = stops.filter((s) => s.kind === 'explain');
  const code = exercises.filter((c) => c.module === m.id);
  const caps = tl.caps.filter((c) => inMod(c.t)).length;
  const tries = stops.filter((s) => s.kind === 'try').length;
  const tests = stops.filter((s) => s.kind === 'test').length;
  const reviews = stops.filter((s) => s.kind === 'review').length;
  const minutes = Math.round(caps * effort.step + quiz.length * effort.question + tries * effort.experiment
    + expl.length * effort.explain + code.length * effort.exercise + tests * effort.test + reviews * effort.review);
  return {
    chapters: m.chapters.length, seen: m.chapters.filter((k) => prog.d.seen[k]).length,
    quiz: quiz.length, answered: quiz.filter((s) => s.id in prog.d.quiz).length, right: quiz.filter((s) => prog.d.quiz[s.id] === 1).length,
    missions: miss.length, missDone: miss.filter((s) => prog.d.missions[s.id]).length,
    code: code.length, codeDone: code.filter((c) => prog.d.code[c.id]?.done).length,
    explain: expl.length, explainDone: expl.filter((s) => prog.d.explain[s.id]?.text).length,
    minutes,
  };
}

/** Estimated working time of the whole course, in minutes (the bonus modules apart), as the home page shows it. */
export function courseMinutes(tl: Timeline, exercises: { id: string; module: string }[], effort = EFFORT): number {
  const prog = new Progress('', 0, { load: () => null, save() {} });
  return tl.modules.reduce((s, m, i) => s + (m.kind === 'bonus' ? 0 : moduleStats(tl, prog, i, exercises, effort).minutes), 0);
}

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
const NUMBER_WORDS: Record<string, number> = {
  une: 1, un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

export const fmtMinutes = (m: number): string => (m < 60 ? `≈ ${m} min` : `≈ ${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`);
