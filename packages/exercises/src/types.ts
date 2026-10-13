// The kinds of workshop exercises. Only `code` needs programming; the others
// make the workshop useful for any subject.

import type { ExerciseBase, QuizSpec } from '@coursekit/core';

/** A set of functions by name: the learner's where they wrote one, the reference elsewhere. */
export type Impl = Record<string, Function>;

export interface TestResult { label: string; ok: boolean; msg: string }

export interface Verdict {
  ok: boolean;
  msg: string;
  results?: TestResult[];
  /** a curve to compare (learner and reference), shown under the preview */
  chart?: { label: string; unit?: string; mine: number[]; ref: number[] };
}

// ---------------------------------------------------------------- code

/** A pure check: null when it passes, else what went wrong (shown to the learner). */
export interface TestCase { label: string; run(fn: Function, impl: Impl): string | null }

/**
 * A scenario run with a whole implementation; the learner's version must stay
 * within `tol` of the reference at every sample.
 */
export interface Scenario { name: string; run(impl: Impl): number[]; tol: number; unit?: string }

/** Read a given function, predict, run, investigate — then modify it. */
export interface Primm {
  intro: string;
  /** the code given to read; when it defines the exercise's function, it is what is run */
  code: string;
  predict: QuizSpec;
  investigate: QuizSpec;
  /** what to change once the code is understood */
  modify: string;
}

export interface CodeExercise extends ExerciseBase {
  kind: 'code';
  /** the function's name */
  slot: string;
  sig: string;
  /** what the arguments are and what to return */
  doc: string;
  goal: string;
  solution: string;
  starter: string;
  /** three levels; the last one is not the whole solution */
  hints: string[];
  win: string;
  /** pure checks, all shown to the learner */
  tests?: TestCase[];
  /** or: scenarios compared with the reference (defaults to the workshop's) */
  scenarios?: Scenario[];
  /** a curve shown after « Vérifier » */
  chart?: { label: string; unit?: string; run(impl: Impl): number[] };
  primm?: Primm;
  /** put the solution's lines back in order before writing (long functions) */
  parsons?: boolean;
  /** live preview of the learner's function */
  preview?(ctx: CanvasRenderingContext2D, fn: Function | null, impl: Impl, t: number): void;
  /** not part of the assembled model (a pure exercise) */
  standalone?: boolean;
}

// ------------------------------------------------------------ other kinds

export interface CalculationExercise extends ExerciseBase {
  kind: 'calculation';
  intro: string;
  steps: { prompt: string; value: number; unit?: string; tol?: number; explain: string }[];
  win: string;
}

export interface ClassifyExercise extends ExerciseBase {
  kind: 'classify';
  intro: string;
  categories: string[];
  /** each item with the index of its category */
  items: { text: string; cat: number; why?: string }[];
  win: string;
}

export interface SequenceExercise extends ExerciseBase {
  kind: 'sequence';
  intro: string;
  /** in the right order */
  items: string[];
  explain: string;
  win: string;
}

export type Exercise = CodeExercise | CalculationExercise | ClassifyExercise | SequenceExercise;

/** Workshop-wide settings, given by the course. */
export interface WorkshopConfig {
  /** helpers in scope of every code exercise (rot, solve3…) */
  helpers?: Record<string, Function>;
  /** scenarios used by code exercises that have no tests of their own */
  scenarios?: Scenario[];
  /** the page where every function the learner wrote runs together */
  assembly?: {
    title: string;
    intro: string;
    /** checks the whole implementation (in addition to the scenarios) */
    scenarios?: Scenario[];
    chart?: { label: string; unit?: string; run(impl: Impl): number[] };
    preview?(ctx: CanvasRenderingContext2D, impl: Impl, t: number): void;
  };
}
