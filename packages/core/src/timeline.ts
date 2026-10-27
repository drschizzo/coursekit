// The timeline a course compiles into: chapters, steps, diagrams, stage
// scenes and pauses, each at a time. The author never writes times: the
// builder lays the content out in order (see ./builder.ts). Times only serve
// the player's clock — a step animates for a while, then the reader moves on.
//
// The timeline is what the course *is*: it does not change once compiled.
// What a reading of it does (the clock, the pause the learner is in, the
// settings they moved) lives in a `Reading` (see ./reading.ts).
//
// Taken from avbd's course/tour.ts, with the content moved out.

import type { Claim, Control, Goal, Predict, QuizSpec, Text, Vals } from './types.ts';

export interface Caption {
  t: number;
  kicker: string;
  title: string;
  /** the text, or the function that writes it on first reading (see `captionText`) */
  source: Text;
  note: string;
  code: string;
  hud: ((v: Vals) => string) | null;
  layers: number;
  tools: string[];
  /** seconds this step animates before the clock waits */
  dwell: number;
  claims: Claim[];
}

const written = new WeakMap<Caption, string>();

/** The text of a step: a lazy text is written on first reading, then kept. */
export function captionText(c: Caption): string {
  if (typeof c.source === 'string') return c.source;
  let s = written.get(c);
  if (s == null) { s = c.source(); written.set(c, s); }
  return s;
}

export interface DiagSpec { t0: number; t1: number; name: string; arg?: string; big?: boolean }
export interface Chapter { t: number; title: string; part: string; module: number }
export interface SceneEvent { t: number; key: string; patch?: Partial<Vals> }

export interface TourQuiz extends QuizSpec {
  module: number;
  /** false for the exam: those questions do not come back in reviews */
  review: boolean;
}

// ------------------------------------------------------------------ pauses

interface StopBase {
  t: number;
  id: string;
  title: string;
  /** index of the module the pause belongs to (set when the course compiles) */
  module: number;
}

/** An experiment: controls, goals, a prediction before, a conclusion after. */
export interface TryStop extends StopBase {
  kind: 'try';
  /** the settings hold until this time (end of chapter, or next step) */
  until: number;
  prompt: string;
  controls: Control[];
  goals?: Goal[];
  seq?: boolean;
  diag?: boolean;
  predict?: Predict;
  conclusion?: string;
  /** the fix of a clinic case: its broken settings, and its symptom (checked by the tools) */
  clinic?: { id: string; fault: Vals; symptom?: (v: Vals) => unknown };
}
export interface QuizStop extends StopBase { kind: 'quiz'; quiz: TourQuiz }
/** Module card: module just finished (−1 at the start) → next (null at the end). */
export interface CardStop extends StopBase { kind: 'card'; from: number; to: number | null }
export interface ReviewStop extends StopBase { kind: 'review' }
export interface ExplainStop extends StopBase { kind: 'explain'; explain: { prompt: string; model: string } }
/** An invitation to a workshop exercise (or 'assembly'). */
export interface LabStop extends StopBase { kind: 'lab'; lab: string; prompt: string }
export interface TestStop extends StopBase { kind: 'test'; test: 'pre' | 'post'; prompt: string }

export type Stop = TryStop | QuizStop | CardStop | ReviewStop | ExplainStop | LabStop | TestStop;
export type StopKind = Stop['kind'];
export type StopOf<K extends StopKind> = Extract<Stop, { kind: K }>;

/**
 * What every kind of pause is, in one place: whether the reader's « Questions
 * et exercices » switch can skip it, and which line of the effort estimate it
 * counts in (null: not counted, or counted elsewhere — the exercises by module).
 * Adding a kind means adding it here: the compiler then points at every
 * `Record<StopKind, …>` and exhaustive switch still to complete.
 */
export const STOP_KINDS: Record<StopKind, { skippable: boolean; effort: 'experiment' | 'question' | 'explain' | 'test' | 'review' | null }> = {
  try: { skippable: true, effort: 'experiment' },
  quiz: { skippable: true, effort: 'question' },
  card: { skippable: false, effort: null },
  review: { skippable: true, effort: 'review' },
  explain: { skippable: true, effort: 'explain' },
  lab: { skippable: true, effort: null },
  test: { skippable: false, effort: 'test' },
};

/** For exhaustive switches: the compiler fails here when a case is missing. */
export function assertNever(x: never): never { throw new Error(`cas non traité : ${JSON.stringify(x)}`); }

export interface TimelineModule { id: string; title: string; kind: 'core' | 'exam' | 'bonus'; chapters: number[]; t0: number; t1: number }

/** Index of the last item whose time is ≤ t (0 when none): a binary search over sorted times. */
function lastAt<T>(xs: T[], t: number, at: (x: T) => number): number {
  let lo = 0, hi = xs.length - 1, i = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (at(xs[mid]) <= t) { i = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return i;
}

/** Values from layers on top of the defaults. */
export function valsOf(defaults: Vals, layers: Partial<Vals>[]): Vals {
  const v: Vals = { ...defaults };
  for (const layer of layers) Object.assign(v, layer);
  return v;
}

/** The stage's settings: only the stage keys a layer actually sets. */
export function stageValsOf(stageKeys: Set<string>, defaults: Vals, layers: Partial<Vals>[]): Vals {
  const v = valsOf(defaults, layers);
  const out: Vals = {};
  for (const layer of layers) for (const k of Object.keys(layer)) if (stageKeys.has(k)) out[k] = v[k];
  return out;
}

export class Timeline {
  caps: Caption[] = [];
  diags: DiagSpec[] = [];
  chapters: Chapter[] = [];
  stops: Stop[] = [];
  scenes: SceneEvent[] = [];
  sets: { t: number; patch: Partial<Vals> }[] = [];
  modules: TimelineModule[] = [];
  duration = 1;

  defaults: Vals;
  stageKeys: Set<string>;

  constructor(defaults: Vals, stageKeys: string[]) {
    this.defaults = defaults;
    this.stageKeys = new Set(stageKeys);
  }

  // ------------------------------------------------------------- evaluation

  /** The authored layers at time t: the SETs, then the current scene's settings. */
  layersAt(t: number): Partial<Vals>[] {
    const out: Partial<Vals>[] = [];
    for (const s of this.sets) { if (t < s.t) break; out.push(s.patch); }
    const sc = this.sceneAt(t);
    if (sc?.patch) out.push(sc.patch);
    return out;
  }

  /** Values the course sets at time t, before the learner touches anything. */
  eval(t: number): Vals { return valsOf(this.defaults, this.layersAt(t)); }

  /** The stage's settings at time t, before the learner touches anything. */
  stageVals(t: number): Vals { return stageValsOf(this.stageKeys, this.defaults, this.layersAt(t)); }

  sceneAt(t: number): SceneEvent | null {
    return this.scenes.length && this.scenes[0].t <= t ? this.scenes[lastAt(this.scenes, t, (s) => s.t)] : null;
  }

  chapterAt(t: number): number { return lastAt(this.chapters, t, (c) => c.t); }

  capAt(t: number): number { return lastAt(this.caps, t, (c) => c.t); }

  /** Time of the next step after t, or null at the end. */
  nextStepT(t: number): number | null {
    const i = lastAt(this.caps, t + 1e-3, (c) => c.t);
    const c = this.caps[this.caps[i]?.t > t + 1e-3 ? i : i + 1];
    return c ? c.t : null;
  }

  /** Start of the current step, or of the previous one when t is at a step start. */
  prevStepT(t: number): number {
    let cur = 0;
    for (const c of this.caps) if (c.t <= t + 1e-3) cur = c.t;
    if (t - cur > 1.5) return cur;
    let prev = 0;
    for (const c of this.caps) if (c.t < cur - 1e-3) prev = c.t;
    return prev;
  }

  /** The steps of chapter `ci`. */
  capsOfChapter(ci: number): Caption[] {
    const t0 = this.chapters[ci]?.t ?? 0;
    const t1 = ci + 1 < this.chapters.length ? this.chapters[ci + 1].t : this.duration;
    return this.caps.filter((c) => c.t >= t0 - 1e-3 && c.t < t1 - 1e-3);
  }

  /** Index of the step within its chapter, and the number of steps in it. */
  stepInChapter(t: number): { i: number; n: number } {
    const caps = this.capsOfChapter(this.chapterAt(t));
    let i = 0;
    caps.forEach((c, k) => { if (t >= c.t - 1e-3) i = k; });
    return { i, n: Math.max(1, caps.length) };
  }

  diagAt(t: number): DiagSpec | null {
    return this.diags.find((d) => t >= d.t0 && t < d.t1) ?? null;
  }

  /** Every question that can come back in a review. */
  get bank(): QuizStop[] { return this.stops.filter((s): s is QuizStop => s.kind === 'quiz' && s.quiz.review); }
}
