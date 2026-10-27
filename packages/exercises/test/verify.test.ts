import { labelsFor } from '@coursekit/core';
import { describe, expect, it } from 'vitest';
import { LOOP_LIMIT_S, guardLoops, verifyCalculation, verifyCode, type CodeExercise } from '../src/index.ts';

const ex = (solution: string): CodeExercise => ({
  id: 'sum', module: 'm', title: 'Somme', kind: 'code', slot: 'sum', sig: 'sum(n)', doc: '', goal: '', solution, starter: 'function sum(n) { return 0; }',
  hints: [], win: 'Bravo.', tests: [{ label: 'sum(4)', run: (fn) => (fn(4) === 10 ? null : `sum(4) = ${fn(4)}`) }],
});
const SOLUTION = 'function sum(n) { let s = 0; for (let i = 1; i <= n; i++) s += i; return s; }';

describe('guardLoops', () => {
  it('puts a check in every kind of loop', () => {
    expect(guardLoops('for (let i = 0; i < n; i++) s++;')).toBe('for (let i = 0; __ckLoop(), i < n; i++) s++;');
    expect(guardLoops('for (;;) {}')).toBe('for (; __ckLoop(), true;) {}');
    expect(guardLoops('while (x) y();')).toBe('while (__ckLoop(), x) y();');
    expect(guardLoops('do { i++; } while (i < 3);')).toBe('do { i++; } while (__ckLoop(), i < 3);');
    expect(guardLoops('for (const x of xs) { s += x; }')).toBe('for (const x of xs) {__ckLoop(); s += x; }');
  });

  it('leaves the words that only contain « for » alone', () => {
    expect(guardLoops('const before = format(x);')).toBe('const before = format(x);');
  });
});

describe('verifyCode', () => {
  it('accepts the solution and refuses the starting point', () => {
    expect(verifyCode(ex(SOLUTION), SOLUTION, [ex(SOLUTION)], {}).ok).toBe(true);
    expect(verifyCode(ex(SOLUTION), ex(SOLUTION).starter, [ex(SOLUTION)], {}).ok).toBe(false);
  });

  it('says a compile error is one, so that the interface can explain it', () => {
    expect(verifyCode(ex(SOLUTION), 'function sum(n) {', [ex(SOLUTION)], {}).reason).toBe('compile');
  });

  it('stops an endless loop instead of freezing the page', () => {
    const t0 = performance.now();
    const v = verifyCode(ex(SOLUTION), 'function sum(n) { while (true) {} }', [ex(SOLUTION)], {});
    expect(v.ok).toBe(false);
    expect(v.msg).toMatch(/boucle/);
    expect(performance.now() - t0).toBeLessThan((LOOP_LIMIT_S + 2) * 1000);
  }, 10_000);

  it('speaks the course\'s language', () => {
    const v = verifyCalculation({ id: 'c', module: 'm', title: '', kind: 'calculation', intro: '', win: '', steps: [{ prompt: 'x', value: 1.5, explain: '' }] }, [2], labelsFor('en'));
    expect(v.msg).toBe('1 step to check again.');
    expect(v.results![0].msg).toBe('expected 1.5');
  });
});
