// The timeline a course compiles into: chapters, steps, diagrams, stage
// scenes and pauses, each at a time. The author never writes times: the
// builder lays the content out in order (see ./builder.ts). Times only serve
// the player's clock — a step animates for a while, then the reader moves on.
//
// Taken from avbd's course/tour.ts, with the content moved out.

import type { Control, Goal, Predict, QuizSpec, Vals } from './types.ts';

export interface Caption {
  t: number;
  kicker: string;
  title: string;
  text: string;
  note: string;
  code: string;
  hud: ((v: Vals) => string) | null;
  layers: number;
  tools: string[];
  /** seconds this step animates before the clock waits */
  dwell: number;
  claims: { text: string; check(model: unknown): boolean | string }[];
}

export interface DiagSpec { t0: number; t1: number; name: string; arg?: string; big?: boolean }
export interface Chapter { t: number; title: string; part: string; module: number }
export interface SceneEvent { t: number; key: string; patch?: Partial<Vals> }

export type StopKind = 'try' | 'quiz' | 'card' | 'review' | 'explain' | 'lab' | 'test';

export interface TourQuiz extends QuizSpec {
  module: number;
  /** false for the exam: those questions do not come back in reviews */
  review: boolean;
}

export interface Stop {
  t: number;
  until: number;
  kind: StopKind;
  id: string;
  title: string;
  prompt?: string;
  controls: Control[];
  goals?: Goal[];
  seq?: boolean;
  diag?: boolean;
  quiz?: TourQuiz;
  predict?: Predict;
  conclusion?: string;
  explain?: { prompt: string; model: string };
  /** lab: the exercise to open (or 'assembly') */
  lab?: string;
  test?: 'pre' | 'post';
  /** card: module just finished (−1 at the start) → next (null at the end) */
  from?: number;
  to?: number | null;
  module?: number;
  // runtime state
  visited?: boolean;
  reached?: boolean[];
  predicted?: number;
  ov: Vals;
}

export interface TimelineModule { id: string; title: string; kind: 'core' | 'exam' | 'bonus'; chapters: number[]; t0: number; t1: number }

export class Timeline {
  t = 0;
  playing = true;
  pauses = true;
  /** step-by-step reading: the clock waits at each new step and pause */
  stepMode = true;
  /** waiting for the learner at the end of a step */
  held = false;
  stop: Stop | null = null;
  /** seconds spent in pauses and waits — diagrams keep animating */
  extra = 0;
  ptr: { x: number; y: number } | null = null;
  hits = new Set<string>();

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

  /** Values in force at time t: defaults, SETs, the current scene's settings, the active pause. */
  eval(t: number): Vals {
    const v: Vals = { ...this.defaults };
    for (const layer of this.layersAt(t)) Object.assign(v, layer);
    return v;
  }

  private layersAt(t: number): Partial<Vals>[] {
    const out: Partial<Vals>[] = [];
    for (const s of this.sets) { if (t < s.t) break; out.push(s.patch); }
    const sc = this.sceneAt(t);
    if (sc?.patch) out.push(sc.patch);
    for (const st of this.stops) {
      if (st.kind !== 'try') continue;
      if (st === this.stop || (st.visited && t >= st.t && t <= st.until)) out.push(st.ov);
    }
    return out;
  }

  /** The stage's settings at time t: only the stage keys somebody actually set. */
  stageVals(t: number): Vals {
    const v = this.eval(t);
    const out: Vals = {};
    for (const layer of this.layersAt(t)) for (const k of Object.keys(layer)) if (this.stageKeys.has(k)) out[k] = v[k];
    return out;
  }

  sceneAt(t: number): SceneEvent | null {
    let cur: SceneEvent | null = null;
    for (const s of this.scenes) { if (t < s.t) break; cur = s; }
    return cur;
  }

  chapterAt(t: number): number {
    let i = 0;
    for (let j = 0; j < this.chapters.length; j++) if (t >= this.chapters[j].t) i = j;
    return i;
  }

  capAt(t: number): number {
    let i = 0;
    for (let j = 0; j < this.caps.length; j++) if (t >= this.caps[j].t) i = j;
    return i;
  }

  /** Time of the next step after t, or null at the end. */
  nextStepT(t: number): number | null {
    for (const c of this.caps) if (c.t > t + 1e-3) return c.t;
    return null;
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

  /** Index of the step within its chapter, and the number of steps in it. */
  stepInChapter(t: number): { i: number; n: number } {
    const ci = this.chapterAt(t);
    const t0 = this.chapters[ci]?.t ?? 0;
    const t1 = ci + 1 < this.chapters.length ? this.chapters[ci + 1].t : this.duration;
    const caps = this.caps.filter((c) => c.t >= t0 - 1e-3 && c.t < t1 - 1e-3);
    let i = 0;
    caps.forEach((c, k) => { if (t >= c.t - 1e-3) i = k; });
    return { i, n: Math.max(1, caps.length) };
  }

  diagAt(t: number): DiagSpec | null {
    return this.diags.find((d) => t >= d.t0 && t < d.t1) ?? null;
  }

  // ----------------------------------------------------------------- pauses

  enterStop(st: Stop): void {
    const v = this.eval(st.t);
    st.ov = {};
    for (const c of st.controls) st.ov[c.key] = v[c.key] ?? 0;
    st.visited = true;
    st.reached ||= st.goals?.map(() => false);
    this.stop = st;
    this.playing = false;
    this.held = false;
    this.ptr = null;
    this.hits = new Set();
  }

  resume(): void {
    if (!this.stop) return;
    this.stop = null;
    this.ptr = null;
    this.playing = true;
  }

  /** Pauses after t are asked again (a jump back on the timeline). */
  resetStops(t: number): void {
    this.stop = null;
    this.ptr = null;
    this.extra = 0;
    for (const st of this.stops) if (st.t >= t - 1e-3) { st.visited = false; st.ov = {}; st.reached = undefined; st.predicted = undefined; }
  }

  stopBetween(t0: number, t1: number): Stop | null {
    return this.stops.find((st) => !st.visited && (this.pauses || st.kind === 'card' || st.kind === 'test') && st.t > t0 && st.t <= t1) ?? null;
  }

  /** Every question that can come back in a review. */
  get bank(): Stop[] { return this.stops.filter((s) => s.kind === 'quiz' && s.quiz?.review); }
}
