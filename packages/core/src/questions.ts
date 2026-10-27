// Writing questions outside the builder (tests, capsules, workshop): the
// right answer is written first and moved to a rotating position, so that its
// place never gives it away. The builder does the same for the questions of
// the course itself, with its own counter (see `placeAnswer`).

import type { QuizSpec } from './types.ts';

/** A choice question whose right answer, written first in `choices`, is moved to position `pos % choices.length`. */
export function placeAnswer(question: string, choices: string[], explain: string, pos: number): QuizSpec {
  const at = pos % choices.length;
  const others = choices.slice(1);
  return { question, kind: 'choice', choices: [...others.slice(0, at), choices[0], ...others.slice(at)], answer: at, explain };
}

let place = 1;

/** A choice question; `choices[0]` is the right answer. */
export function choice(question: string, choices: string[], explain: string): QuizSpec {
  return placeAnswer(question, choices, explain, place++);
}

/** A question with a numeric answer (tolerance: 2 % by default). */
export function numeric(question: string, value: number, explain: string, opt: { unit?: string; tol?: number } = {}): QuizSpec {
  return { question, kind: 'number', choices: [], answer: 0, value, unit: opt.unit, tol: opt.tol, explain };
}

/** Moves the right answer of an already written question (answer 0) to a rotating position. */
export function placed(q: QuizSpec): QuizSpec {
  if (q.kind !== 'choice' || q.answer !== 0) return q;
  return choice(q.question, q.choices, q.explain);
}

/** The tolerance of a numeric answer: the one given, 2 % of the value otherwise. */
export const toleranceOf = (value: number, tol?: number): number => tol ?? Math.max(1e-9, Math.abs(value) * 0.02);
