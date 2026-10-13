// @coursekit/exercises — the workshop's exercise kinds and their checks.
// No DOM: @coursekit/ui renders them, @coursekit/tooling checks them.

export * from './types.ts';
export * from './verify.ts';

/** A choice question for a workshop exercise; the right answer is written first. */
export { choice as choiceQ } from '@coursekit/core';
