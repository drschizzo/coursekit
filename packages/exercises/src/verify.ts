// Compiling the learner's code and checking every kind of exercise. No DOM:
// the content checker runs these too, to prove each exercise accepts its
// solution and rejects its starting point. Taken from avbd's course/lab.ts.
//
// The messages are the learner's: they come from the course's texts (`L`,
// French by default).

import { fmtValue, labelsFor, toleranceOf, tr, type LabelSet } from '@coursekit/core';
import type { CalculationExercise, ClassifyExercise, CodeExercise, Exercise, Impl, Scenario, SequenceExercise, TestResult, Verdict, WorkshopConfig } from './types.ts';

const FR = labelsFor('fr');
const codeOf = (exs: Exercise[]) => exs.filter((e): e is CodeExercise => e.kind === 'code');
const message = (e: unknown) => String((e as Error)?.message ?? e);

/** How long the learner's code may run in one call before it is stopped, in seconds. */
export const LOOP_LIMIT_S = 3;

/** Thrown into the learner's code when a loop runs past `LOOP_LIMIT_S`. */
export class LoopTimeout extends Error {}

/**
 * The learner's source with a check in every loop: past `LOOP_LIMIT_S`
 * seconds of one call, the loop throws instead of freezing the page. The check
 * goes in the loop's condition (`while (__ckLoop(), c)`, `for (a; __ckLoop(), c; b)`,
 * which also covers `do … while`), or at the top of the body of a `for … of` /
 * `for … in` in braces. It calls `__ckLoop`, which `compile` provides.
 */
export function guardLoops(src: string): string {
  const re = /\b(for|while)\s*\(/g;
  let out = '';
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = re.lastIndex; // just after « ( »
    let depth = 1, j = open;
    for (; j < src.length; j++) { const c = src[j]; if (c === '(') depth++; else if (c === ')' && --depth === 0) break; }
    if (j >= src.length) break;
    const inner = src.slice(open, j);
    out += src.slice(i, open);
    if (m[1] === 'while') out += `__ckLoop(), ${inner}`;
    else {
      // the « ; » of a classic for, outside any bracket
      const semis: number[] = [];
      let d = 0;
      for (let k = 0; k < inner.length; k++) { const c = inner[k]; if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) semis.push(k); }
      if (semis.length === 2) {
        const cond = inner.slice(semis[0] + 1, semis[1]).trim();
        out += `${inner.slice(0, semis[0] + 1)} __ckLoop(), ${cond || 'true'}${inner.slice(semis[1])}`;
      } else {
        out += inner;
        const ws = /^\s*/.exec(src.slice(j + 1))![0];
        if (src[j + 1 + ws.length] === '{') { out += src.slice(j, j + 2 + ws.length) + '__ckLoop();'; i = j + 2 + ws.length; re.lastIndex = i; continue; }
      }
    }
    i = j;
    re.lastIndex = j;
  }
  return out + src.slice(i);
}

/**
 * Compiles one function. The workshop's helpers and the other exercises'
 * functions are in scope, bound late: a function the learner wrote can call
 * another one (theirs if they wrote it, the reference otherwise). Every loop
 * stops after `LOOP_LIMIT_S` seconds of one call.
 */
export function compile(src: string, ex: CodeExercise, lib: Impl, all: Exercise[], cfg: WorkshopConfig, L: LabelSet = FR): Function {
  const helpers = cfg.helpers ?? {};
  const others = codeOf(all).map((e) => e.slot).filter((s) => s !== ex.slot && !(s in helpers));
  let t0 = 0;
  /** once a call ran out of time, the next ones fail at once: the code will not have changed */
  let stuck: LoopTimeout | null = null;
  const loop = () => {
    if (performance.now() - t0 > LOOP_LIMIT_S * 1000) throw (stuck = new LoopTimeout(tr(L, 'loopTimeout', { s: LOOP_LIMIT_S })));
  };
  const f = new Function('__ckLoop', ...Object.keys(helpers), ...others, `"use strict";\n${guardLoops(src)}\nreturn ${ex.slot};`);
  const fn = f(loop, ...Object.values(helpers), ...others.map((s) => (...a: unknown[]) => lib[s](...a)));
  if (typeof fn !== 'function') return fn;
  // the clock starts at each outermost call
  let depth = 0;
  return function (this: unknown, ...args: unknown[]) {
    if (stuck) throw stuck;
    if (depth++ === 0) t0 = performance.now();
    try { return fn.apply(this, args); } finally { depth--; }
  };
}

/** A whole implementation: the given sources, the reference solutions elsewhere. */
export function buildImpl(all: Exercise[], cfg: WorkshopConfig, srcs: Record<string, string> = {}, L: LabelSet = FR): Impl {
  const impl: Impl = {};
  for (const ex of codeOf(all)) impl[ex.slot] = compile(srcs[ex.slot] ?? ex.solution, ex, impl, all, cfg, L);
  return impl;
}

/** Runs the scenarios with `mine` and the reference and compares them sample by sample. */
export function compareScenarios(scenarios: Scenario[], mine: Impl, ref: Impl, L: LabelSet = FR): { ok: boolean; results: TestResult[]; firstBad: string } {
  const results: TestResult[] = [];
  const fmt = (x: number) => fmtValue(x, L.lang, 4);
  let firstBad = '';
  for (const sc of scenarios) {
    let a: number[];
    try { a = sc.run(mine); } catch (e) {
      const msg = tr(L, 'codeThrew', { msg: message(e) });
      results.push({ label: sc.name, ok: false, msg });
      firstBad ||= `${sc.name} : ${msg}.`;
      continue;
    }
    const b = sc.run(ref);
    let worst = 0, at = -1;
    for (let i = 0; i < b.length; i++) {
      const d = Math.abs((a[i] ?? NaN) - b[i]);
      if (!(d <= worst)) { worst = Number.isFinite(d) ? d : Infinity; at = i; }
    }
    const unit = sc.unit ? ` ${sc.unit}` : '';
    const ok = worst <= sc.tol;
    const msg = !Number.isFinite(worst) ? tr(L, 'nonNumeric', { i: at })
      : ok ? tr(L, 'maxGap', { v: `${fmt(worst)}${unit}` })
        : tr(L, 'gapTooBig', { v: `${fmt(worst)}${unit}`, tol: `${fmt(sc.tol)}${unit}` });
    results.push({ label: sc.name, ok, msg });
    if (!ok) firstBad ||= `${sc.name} : ${msg}.`;
  }
  return { ok: !firstBad, results, firstBad };
}

/** Checks a code exercise with the learner's source (the other functions: the reference). */
export function verifyCode(ex: CodeExercise, src: string, all: Exercise[], cfg: WorkshopConfig, L: LabelSet = FR): Verdict {
  const ref = buildImpl(all, cfg, {}, L);
  let fn: Function;
  const lib: Impl = { ...ref };
  try { fn = compile(src, ex, lib, all, cfg, L); } catch (e) { return { ok: false, reason: 'compile', msg: tr(L, 'compileError', { msg: message(e) }) }; }
  if (typeof fn !== 'function') return { ok: false, reason: 'compile', msg: tr(L, 'fnMissing', { slot: ex.slot }) };
  lib[ex.slot] = fn;
  if (ex.tests) {
    const results = ex.tests.map((t) => {
      let e: string | null;
      try { e = t.run(fn, lib); } catch (err) { e = tr(L, 'errorPrefix', { msg: message(err) }); }
      return { label: t.label, ok: !e, msg: e ?? L.passed };
    });
    const bad = results.find((r) => !r.ok);
    return bad ? { ok: false, msg: tr(L, 'testFailed', { label: bad.label, msg: bad.msg }), results } : { ok: true, msg: ex.win, results };
  }
  const scenarios = ex.scenarios ?? cfg.scenarios ?? [];
  if (!scenarios.length) return { ok: false, msg: tr(L, 'noTests', { id: ex.id }) };
  const r = compareScenarios(scenarios, lib, ref, L);
  const chart = ex.chart ? safeChart(ex.chart, lib, ref) : undefined;
  return r.ok ? { ok: true, msg: ex.win, results: r.results, chart } : { ok: false, msg: r.firstBad, results: r.results, chart };
}

function safeChart(c: { label: string; unit?: string; run(impl: Impl): number[] }, mine: Impl, ref: Impl): Verdict['chart'] {
  try { return { label: c.label, unit: c.unit, mine: c.run(mine), ref: c.run(ref) }; } catch { return undefined; }
}

/** The assembly: every function the learner wrote, run together. */
export function verifyAssembly(all: Exercise[], cfg: WorkshopConfig, srcs: Record<string, string>, L: LabelSet = FR): Verdict & { mine: string[] } {
  const mine = Object.keys(srcs);
  let impl: Impl;
  try { impl = buildImpl(all, cfg, srcs, L); } catch (e) { return { ok: false, reason: 'compile', msg: tr(L, 'assemblyBroken', { msg: message(e) }), mine }; }
  const ref = buildImpl(all, cfg, {}, L);
  const results: TestResult[] = [];
  // the pure exercises are checked on their own tests
  for (const ex of codeOf(all)) {
    if (!ex.tests || !(ex.slot in srcs)) continue;
    let bad: string | null = null;
    for (const t of ex.tests) { try { bad = t.run(impl[ex.slot], impl); } catch (e) { bad = message(e); } if (bad) break; }
    results.push({ label: tr(L, 'testsOf', { slot: ex.slot }), ok: !bad, msg: bad ?? L.passedAll });
  }
  const scenarios = cfg.assembly?.scenarios ?? cfg.scenarios ?? [];
  const r = compareScenarios(scenarios, impl, ref, L);
  const ok = r.ok && results.every((x) => x.ok);
  const chart = cfg.assembly?.chart ? safeChart(cfg.assembly.chart, impl, ref) : undefined;
  return { ok, msg: ok ? L.assemblyOk : r.firstBad || L.assemblyTestFails, results: [...results, ...r.results], chart, mine };
}

// ------------------------------------------------------------ other kinds

export function verifyCalculation(ex: CalculationExercise, answers: (number | null)[], L: LabelSet = FR): Verdict {
  const results = ex.steps.map((s, i) => {
    const a = answers[i];
    const ok = a != null && Number.isFinite(a) && Math.abs(a - s.value) <= toleranceOf(s.value, s.tol);
    return { label: s.prompt, ok, msg: ok ? L.calcRight : a == null ? L.noAnswer : tr(L, 'expectedV', { v: `${fmtValue(s.value, L.lang, 4)}${s.unit ? ` ${s.unit}` : ''}` }) };
  });
  const bad = results.filter((r) => !r.ok).length;
  return bad ? { ok: false, msg: tr(L, 'calcBad', { n: bad }), results } : { ok: true, msg: ex.win, results };
}

export function verifyClassify(ex: ClassifyExercise, answers: (number | null)[], L: LabelSet = FR): Verdict {
  const results = ex.items.map((it, i) => {
    const ok = answers[i] === it.cat;
    return { label: it.text, ok, msg: ok ? ex.categories[it.cat] : `${tr(L, 'classifyExpected', { cat: ex.categories[it.cat] })}${it.why ? ` (${it.why})` : ''}` };
  });
  const bad = results.filter((r) => !r.ok).length;
  return bad ? { ok: false, msg: tr(L, 'classifyBad', { n: bad }), results } : { ok: true, msg: ex.win, results };
}

export function verifySequence(ex: SequenceExercise, order: number[], L: LabelSet = FR): Verdict {
  const placed = order.filter((idx, pos) => idx === pos).length;
  const ok = placed === ex.items.length;
  return ok ? { ok: true, msg: ex.win } : { ok: false, msg: tr(L, 'sequenceBad', { n: placed, total: ex.items.length }) };
}

/** Is the given PRIMM code a version of the exercise's function (so it can be run and must fail)? */
export const primmDefinesSlot = (ex: CodeExercise): boolean => !!ex.primm && new RegExp(`function\\s+${ex.slot}\\b`).test(ex.primm.code);
