// A reading of a compiled course: where the clock is, the pause the learner
// is in, and what they did in each pause (settings moved, goals reached, the
// prediction made). The timeline itself never changes: two readings of one
// timeline do not see each other. No DOM: the player drives it, the tests
// drive it in Node.

import { STOP_KINDS, stageValsOf, valsOf, type Stop, type Timeline, type TryStop } from './timeline.ts';
import type { Vals } from './types.ts';

/** What the learner did in a pause. */
export interface StopState {
  /** reached during this reading (a jump back forgets it) */
  visited: boolean;
  /** the experiment's settings, as the learner left them */
  ov: Vals;
  reached?: boolean[];
  predicted?: number;
}

export class Reading {
  readonly tl: Timeline;
  t = 0;
  playing = true;
  /** the pauses that can be skipped are asked (the reader's switch) */
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

  private states = new Map<Stop, StopState>();
  /** pauses opened by editing a value in the displayed code: not part of the course */
  private lives: TryStop[] = [];

  constructor(tl: Timeline) { this.tl = tl; }

  state(st: Stop): StopState {
    let s = this.states.get(st);
    if (!s) { s = { visited: false, ov: {} }; this.states.set(st, s); }
    return s;
  }

  isLive(st: Stop): boolean { return st.kind === 'try' && this.lives.includes(st); }

  // ------------------------------------------------------------- evaluation

  /** The experiments whose settings are in force at time t, in time order. */
  private activeAt(t: number): TryStop[] {
    const out: TryStop[] = [];
    for (const st of [...this.tl.stops, ...this.lives]) {
      if (st.kind !== 'try') continue;
      const s = this.states.get(st);
      if (st === this.stop || (s?.visited && t >= st.t && t <= st.until)) out.push(st);
    }
    return out.sort((a, b) => a.t - b.t);
  }

  private layersAt(t: number): Partial<Vals>[] {
    return [...this.tl.layersAt(t), ...this.activeAt(t).map((st) => this.state(st).ov)];
  }

  /** Values in force at time t: defaults, SETs, the current scene's settings, the experiments. */
  eval(t: number): Vals { return valsOf(this.tl.defaults, this.layersAt(t)); }

  /** The stage's settings at time t: only the stage keys somebody actually set. */
  stageVals(t: number): Vals { return stageValsOf(this.tl.stageKeys, this.tl.defaults, this.layersAt(t)); }

  // ----------------------------------------------------------------- pauses

  enterStop(st: Stop): void {
    const v = this.eval(st.t);
    const s = this.state(st);
    s.ov = {};
    if (st.kind === 'try') {
      for (const c of st.controls) s.ov[c.key] = v[c.key] ?? 0;
      s.reached ||= st.goals?.map(() => false);
    }
    s.visited = true;
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

  /** Pauses after t are asked again (a jump back on the timeline); the values edited after t are forgotten. */
  resetStops(t: number): void {
    this.stop = null;
    this.ptr = null;
    this.extra = 0;
    for (const st of this.states.keys()) if (st.t >= t - 1e-3) this.states.delete(st);
    this.lives = this.lives.filter((st) => st.t < t - 1e-3);
  }

  /** The pauses before t count as done (a jump forward that skips them). */
  visitBefore(t: number): void {
    for (const st of this.tl.stops) if (st.t < t) this.state(st).visited = true;
  }

  /** The first pause not yet reached in (t0, t1], among those the reader asks for. */
  stopBetween(t0: number, t1: number): Stop | null {
    return this.tl.stops.find((st) => !this.states.get(st)?.visited && (this.pauses || !STOP_KINDS[st.kind].skippable) && st.t > t0 && st.t <= t1) ?? null;
  }

  /** The pauses the reader may skip are skipped: leave the one the learner is in, if it is one. */
  setPauses(on: boolean): void {
    this.pauses = on;
    if (!on && this.stop && STOP_KINDS[this.stop.kind].skippable) this.resume();
  }

  /**
   * A value edited straight in the displayed code: the reading waits on it,
   * in a pause of its own that holds the value until `until` — or the
   * experiment the learner is in takes it. Inside another kind of pause, the
   * value has no effect. Returns the pause that holds it.
   */
  editLive(key: string, v: number, until: number, text: { title: string; prompt: string }): TryStop | null {
    let st = this.stop;
    if (st && st.kind !== 'try') return null;
    if (!st) {
      st = {
        kind: 'try', t: this.t, until: Math.max(until, this.t + 0.5), id: `live-${key}-${this.t.toFixed(1)}`, module: -1,
        title: text.title, prompt: text.prompt, controls: [],
      };
      this.lives.push(st);
      const s = this.state(st);
      s.visited = true;
      s.ov[key] = this.eval(this.t)[key] ?? v;
      this.stop = st;
      this.playing = false;
      this.held = false;
      this.ptr = null;
    }
    this.state(st).ov[key] = v;
    return st;
  }
}
