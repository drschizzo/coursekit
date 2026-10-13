// Compiling the learner's code and checking every kind of exercise. No DOM:
// the content checker runs these too, to prove each exercise accepts its
// solution and rejects its starting point. Taken from avbd's course/lab.ts.

import type { CodeExercise, Exercise, Impl, Scenario, TestResult, Verdict, WorkshopConfig } from './types.ts';

const codeOf = (exs: Exercise[]) => exs.filter((e): e is CodeExercise => e.kind === 'code');

/**
 * Compiles one function. The workshop's helpers and the other exercises'
 * functions are in scope, bound late: a function the learner wrote can call
 * another one (theirs if they wrote it, the reference otherwise).
 */
export function compile(src: string, ex: CodeExercise, lib: Impl, all: Exercise[], cfg: WorkshopConfig): Function {
  const helpers = cfg.helpers ?? {};
  const others = codeOf(all).map((e) => e.slot).filter((s) => s !== ex.slot && !(s in helpers));
  const f = new Function(...Object.keys(helpers), ...others, `"use strict";\n${src}\nreturn ${ex.slot};`);
  return f(...Object.values(helpers), ...others.map((s) => (...a: unknown[]) => lib[s](...a)));
}

/** A whole implementation: the given sources, the reference solutions elsewhere. */
export function buildImpl(all: Exercise[], cfg: WorkshopConfig, srcs: Record<string, string> = {}): Impl {
  const impl: Impl = {};
  for (const ex of codeOf(all)) impl[ex.slot] = compile(srcs[ex.slot] ?? ex.solution, ex, impl, all, cfg);
  return impl;
}

const fmt = (x: number) => (Math.abs(x) < 1e-12 ? '0' : String(+x.toPrecision(4)).replace('.', ','));

/** Runs the scenarios with `mine` and the reference and compares them sample by sample. */
export function compareScenarios(scenarios: Scenario[], mine: Impl, ref: Impl): { ok: boolean; results: TestResult[]; firstBad: string } {
  const results: TestResult[] = [];
  let firstBad = '';
  for (const sc of scenarios) {
    let a: number[], b: number[];
    try { a = sc.run(mine); } catch (e: any) {
      const msg = `votre code a levé une erreur : ${e?.message ?? e}`;
      results.push({ label: sc.name, ok: false, msg });
      firstBad ||= `${sc.name} : ${msg}.`;
      continue;
    }
    b = sc.run(ref);
    let worst = 0, at = -1;
    for (let i = 0; i < b.length; i++) {
      const d = Math.abs((a[i] ?? NaN) - b[i]);
      if (!(d <= worst)) { worst = Number.isFinite(d) ? d : Infinity; at = i; }
    }
    const unit = sc.unit ? ` ${sc.unit}` : '';
    const ok = worst <= sc.tol;
    const msg = !Number.isFinite(worst) ? `résultat non numérique ou divergent (échantillon ${at})` : ok ? `écart maximal : ${fmt(worst)}${unit}` : `écart maximal de ${fmt(worst)}${unit} avec la référence (tolérance ${fmt(sc.tol)}${unit})`;
    results.push({ label: sc.name, ok, msg });
    if (!ok) firstBad ||= `${sc.name} : ${msg}.`;
  }
  return { ok: !firstBad, results, firstBad };
}

/** Checks a code exercise with the learner's source (the other functions: the reference). */
export function verifyCode(ex: CodeExercise, src: string, all: Exercise[], cfg: WorkshopConfig): Verdict {
  const ref = buildImpl(all, cfg);
  let fn: Function;
  const lib: Impl = { ...ref };
  try { fn = compile(src, ex, lib, all, cfg); } catch (e: any) { return { ok: false, msg: `Le code ne compile pas : ${e?.message ?? e}` }; }
  if (typeof fn !== 'function') return { ok: false, msg: `La fonction ${ex.slot} est introuvable : gardez sa signature.` };
  lib[ex.slot] = fn;
  if (ex.tests) {
    const results = ex.tests.map((t) => {
      let e: string | null;
      try { e = t.run(fn, lib); } catch (err: any) { e = `erreur : ${err?.message ?? err}`; }
      return { label: t.label, ok: !e, msg: e ?? 'réussi' };
    });
    const bad = results.find((r) => !r.ok);
    return bad ? { ok: false, msg: `Test « ${bad.label} » : ${bad.msg}.`, results } : { ok: true, msg: ex.win, results };
  }
  const scenarios = ex.scenarios ?? cfg.scenarios ?? [];
  if (!scenarios.length) return { ok: false, msg: `L’exercice ${ex.id} n’a ni tests ni scénarios.` };
  const r = compareScenarios(scenarios, lib, ref);
  const chart = ex.chart ? safeChart(ex.chart, lib, ref) : undefined;
  return r.ok ? { ok: true, msg: ex.win, results: r.results, chart } : { ok: false, msg: r.firstBad, results: r.results, chart };
}

function safeChart(c: { label: string; unit?: string; run(impl: Impl): number[] }, mine: Impl, ref: Impl): Verdict['chart'] {
  try { return { label: c.label, unit: c.unit, mine: c.run(mine), ref: c.run(ref) }; } catch { return undefined; }
}

/** The assembly: every function the learner wrote, run together. */
export function verifyAssembly(all: Exercise[], cfg: WorkshopConfig, srcs: Record<string, string>): Verdict & { mine: string[] } {
  const mine = Object.keys(srcs);
  let impl: Impl;
  try { impl = buildImpl(all, cfg, srcs); } catch (e: any) { return { ok: false, msg: `Une de vos fonctions ne compile plus : ${e?.message ?? e}`, mine }; }
  const ref = buildImpl(all, cfg);
  const results: TestResult[] = [];
  // the pure exercises are checked on their own tests
  for (const ex of codeOf(all)) {
    if (!ex.tests || !(ex.slot in srcs)) continue;
    let bad: string | null = null;
    for (const t of ex.tests) { try { bad = t.run(impl[ex.slot], impl); } catch (e: any) { bad = String(e?.message ?? e); } if (bad) break; }
    results.push({ label: `tests de ${ex.slot}`, ok: !bad, msg: bad ?? 'réussis' });
  }
  const scenarios = cfg.assembly?.scenarios ?? cfg.scenarios ?? [];
  const r = compareScenarios(scenarios, impl, ref);
  const ok = r.ok && results.every((x) => x.ok);
  const chart = cfg.assembly?.chart ? safeChart(cfg.assembly.chart, impl, ref) : undefined;
  return { ok, msg: ok ? 'Votre modèle reproduit la référence sur tous les scénarios.' : r.firstBad || 'Un des tests de vos fonctions échoue.', results: [...results, ...r.results], chart, mine };
}

// ------------------------------------------------------------ other kinds

export function verifyCalculation(ex: Extract<Exercise, { kind: 'calculation' }>, answers: (number | null)[]): Verdict {
  const results = ex.steps.map((s, i) => {
    const a = answers[i];
    const tol = s.tol ?? Math.max(1e-9, Math.abs(s.value) * 0.02);
    const ok = a != null && Number.isFinite(a) && Math.abs(a - s.value) <= tol;
    return { label: s.prompt, ok, msg: ok ? 'juste' : a == null ? 'pas de réponse' : `attendu ${fmt(s.value)}${s.unit ? ` ${s.unit}` : ''}` };
  });
  const bad = results.filter((r) => !r.ok).length;
  return bad ? { ok: false, msg: `${bad} étape${bad > 1 ? 's' : ''} à revoir.`, results } : { ok: true, msg: ex.win, results };
}

export function verifyClassify(ex: Extract<Exercise, { kind: 'classify' }>, answers: (number | null)[]): Verdict {
  const results = ex.items.map((it, i) => {
    const ok = answers[i] === it.cat;
    return { label: it.text, ok, msg: ok ? ex.categories[it.cat] : `catégorie attendue : ${ex.categories[it.cat]}${it.why ? ` (${it.why})` : ''}` };
  });
  const bad = results.filter((r) => !r.ok).length;
  return bad ? { ok: false, msg: `${bad} élément${bad > 1 ? 's' : ''} mal classé${bad > 1 ? 's' : ''}.`, results } : { ok: true, msg: ex.win, results };
}

export function verifySequence(ex: Extract<Exercise, { kind: 'sequence' }>, order: number[]): Verdict {
  const placed = order.filter((idx, pos) => idx === pos).length;
  const ok = placed === ex.items.length;
  return ok ? { ok: true, msg: ex.win } : { ok: false, msg: `${placed} élément${placed > 1 ? 's' : ''} sur ${ex.items.length} à la bonne place.` };
}

/** Is the given PRIMM code a version of the exercise's function (so it can be run and must fail)? */
export const primmDefinesSlot = (ex: CodeExercise): boolean => !!ex.primm && new RegExp(`function\\s+${ex.slot}\\b`).test(ex.primm.code);
