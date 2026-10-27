// Saved progress and the spaced review of the questions. Taken from avbd's
// course/course.ts; the store is an interface (browser storage by default),
// and progress is keyed by the ids of the questions, experiments and
// exercises, never by chapter titles — so that it survives a new version of
// the course's content.
//
// What is saved has a schema version of its own, distinct from the course's
// version: a new version of the content keeps the learner's answers, reviews,
// experiments and exercises; only the positions on the timeline, which the
// new content moves, start again. A new schema is migrated, never dropped.

import type { QuizStop, Timeline } from './timeline.ts';

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

/** What is stored: the data, its schema and the version of the content it was recorded on. */
export interface SavedProgress { schema: number; content: number; data: ProgressData }

export interface ProgressStore {
  load(key: string): unknown;
  save(key: string, value: unknown): void;
  remove?(key: string): void;
}

/** Browser storage; falls back to memory when storage is off (private window, tests). */
export function browserStore(): ProgressStore {
  const mem = new Map<string, string>();
  const ls = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
  return {
    load(key) {
      try { const s = ls()?.getItem(key) ?? mem.get(key); return s ? JSON.parse(s) : null; } catch { return null; }
    },
    save(key, value) {
      const s = JSON.stringify(value);
      try { const st = ls(); if (st) st.setItem(key, s); else mem.set(key, s); } catch { mem.set(key, s); }
    },
    remove(key) {
      mem.delete(key);
      try { ls()?.removeItem(key); } catch { /* storage off */ }
    },
  };
}

/** A store that keeps nothing: for estimates and tests. */
export const memoryStore = (): ProgressStore => {
  const m = new Map<string, unknown>();
  return { load: (k) => m.get(k) ?? null, save: (k, v) => { m.set(k, v); }, remove: (k) => { m.delete(k); } };
};

/** The schema of `ProgressData`. Raise it with a migration in `MIGRATIONS` when the shape changes. */
export const PROGRESS_SCHEMA = 2;

/**
 * Migrations from each schema to the next: MIGRATIONS[n] turns schema n into
 * n + 1. Schema 1 is the data saved before the schema was versioned (under the
 * key `coursekit:<id>:v<version>`), which had the shape of schema 2.
 */
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  1: (d) => d,
};

/** Spaced review: a question in box b comes back after INTERVAL[b] review sessions. */
const INTERVAL = [1, 1, 2, 4, 8];

export const emptyProgress = (): ProgressData => ({
  lastT: 0, maxT: 0, seen: {}, quiz: {}, rev: {}, sessions: 0, missions: {}, predict: {}, explain: {},
  done: {}, code: {}, tools: {}, tests: {}, stepMode: true,
});

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Saved data, as far as it has the right shape: every field of the wrong type is left at its empty value. */
export function sanitizeProgress(raw: unknown): ProgressData {
  const d = emptyProgress();
  if (!isObj(raw)) return d;
  const out = d as unknown as Record<string, unknown>;
  for (const k of Object.keys(d) as (keyof ProgressData)[]) {
    const v = raw[k], empty = d[k];
    if (typeof empty === 'number' ? typeof v === 'number' && Number.isFinite(v) : typeof empty === 'boolean' ? typeof v === 'boolean' : isObj(v)) out[k] = v;
  }
  return d;
}

export class Progress {
  d: ProgressData = emptyProgress();
  readonly key: string;
  private store: ProgressStore;
  private content: number;

  constructor(courseId: string, version: number, store: ProgressStore = browserStore()) {
    this.key = `coursekit:${courseId}`;
    this.store = store;
    this.content = version;
    this.d = this.restore(courseId);
  }

  /** The saved progress, migrated to the current schema, or the progress saved before schemas (legacy key). */
  private restore(courseId: string): ProgressData {
    let saved = this.store.load(this.key);
    if (!isObj(saved)) {
      // before schemas: one key per version of the content, holding the data itself
      for (let v = this.content; v >= 1 && !isObj(saved); v--) {
        const old = this.store.load(`coursekit:${courseId}:v${v}`);
        if (isObj(old)) { saved = { schema: 1, content: v, data: old }; this.store.remove?.(`coursekit:${courseId}:v${v}`); }
      }
    }
    if (!isObj(saved)) return emptyProgress();
    let schema = typeof saved.schema === 'number' ? saved.schema : 1;
    let data = isObj(saved.data) ? saved.data : {};
    // a progress saved by a newer library: keep what still reads
    while (schema < PROGRESS_SCHEMA && MIGRATIONS[schema]) data = MIGRATIONS[schema++](data);
    const d = sanitizeProgress(data);
    if (saved.content !== this.content) {
      // the content changed: the times and chapter indices no longer point where they did
      d.lastT = 0; d.maxT = 0; d.seen = {};
    }
    return d;
  }

  save(): void { this.store.save(this.key, { schema: PROGRESS_SCHEMA, content: this.content, data: this.d } satisfies SavedProgress); }
  reset(): void { this.d = emptyProgress(); this.save(); }
  /** the learner's progress as a file they can keep or show */
  export(): string { return JSON.stringify({ key: this.key, schema: PROGRESS_SCHEMA, content: this.content, at: new Date().toISOString(), progress: this.d }, null, 2); }
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

// ----------------------------------------------------------------- reviews

/**
 * The review that opens a module: up to `n` questions from the earlier
 * modules — the due ones first, then those never answered, then the oldest.
 * Starts a review session.
 */
export function moduleReview(tl: Timeline, prog: Progress, module: number, n = 3): QuizStop[] {
  const pool = tl.bank.filter((q) => q.quiz.module < module);
  if (!pool.length) return [];
  const ids = pool.map((q) => q.id);
  const chosen: string[] = prog.due(ids).slice(0, n);
  for (const id of ids) if (chosen.length < n && !(id in prog.d.rev) && !chosen.includes(id)) chosen.push(id);
  const rest = ids.filter((id) => !chosen.includes(id)).sort((a, b) => (prog.d.rev[a]?.next ?? 0) - (prog.d.rev[b]?.next ?? 0));
  while (chosen.length < n && rest.length) chosen.push(rest.shift()!);
  prog.newSession();
  return chosen.map((id) => pool.find((q) => q.id === id)!);
}

/**
 * A review session from the home page: up to `n` questions already answered,
 * the due ones first — or, when none is due, the least known. Starts a review session.
 */
export function homeReview(tl: Timeline, prog: Progress, n = 5): QuizStop[] {
  const answered = tl.bank.filter((s) => s.id in prog.d.rev);
  let ids = prog.due(answered.map((s) => s.id));
  if (!ids.length) ids = answered.map((s) => s.id).sort((a, b) => prog.d.rev[a].box - prog.d.rev[b].box);
  prog.newSession();
  return ids.slice(0, n).map((id) => answered.find((s) => s.id === id)!);
}
