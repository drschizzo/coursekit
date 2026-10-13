// The four levels of checks a course must pass before it is published:
//   1. it compiles (the builder refuses malformed content);
//   2. the pedagogical lint: the rules of the format, and the links;
//   3. the domain model's checks and the figures stated in the text;
//   4. a complete walk: every step, read-out, diagram and exercise runs.
// The rules come from avbd's course/mini.selftest.ts; the ones about terms,
// goals, test pairs and phrasing are new.

import { compile, createGlossary, type CourseDef, type QuizSpec, type Timeline } from '@coursekit/core';
import { TOOL_DIAGRAMS } from '@coursekit/diagrams';
import {
  primmDefinesSlot, verifyCalculation, verifyClassify, verifyCode, verifySequence,
  type Exercise, type WorkshopConfig,
} from '@coursekit/exercises';
import { mockContext } from './mockctx.ts';

export interface Finding { level: 'error' | 'warning'; rule: string; msg: string }
export interface Report { course: string; findings: Finding[]; stats: Record<string, number>; ok: boolean }

const MAX_WORDS = 75;
const DEFAULT_BANNED = ['incroyable', 'magique', 'la bonne nouvelle', 'le secret', 'révolutionnaire', 'génial', 'bluffant', 'spectaculaire'];

export function checkCourse(course: CourseDef & { workshop?: WorkshopConfig }): Report {
  const findings: Finding[] = [];
  const err = (rule: string, msg: string) => findings.push({ level: 'error', rule, msg });
  const warn = (rule: string, msg: string) => findings.push({ level: 'warning', rule, msg });

  // ---------------------------------------------------------- 1. compile
  let tl: Timeline;
  try { tl = compile(course); } catch (e: any) {
    err('compile', String(e?.message ?? e));
    return { course: course.id, findings, stats: {}, ok: false };
  }
  const exercises = (course.exercises ?? []) as Exercise[];
  const cfg: WorkshopConfig = course.workshop ?? {};
  const modIdx = new Map(course.modules.map((m, i) => [m.id, i]));
  const glossary = createGlossary(course.glossary);
  const capsules = new Set((course.toolbox ?? []).map((c) => c.id));
  const diagrams = new Set([...Object.keys(course.diagrams ?? {}), ...Object.keys(TOOL_DIAGRAMS)]);

  // ------------------------------------------------- 2. pedagogical lint
  // steps
  const banned = [...DEFAULT_BANNED, ...(course.bannedPhrases ?? [])];
  for (const c of tl.caps) {
    const words = c.text.split(/\s+/).filter(Boolean).length;
    if (words > MAX_WORDS) err('step-length', `étape trop longue (${words} mots) : « ${c.title} »`);
    for (const id of c.tools) if (!capsules.has(id)) err('link', `fiche inconnue ${id} dans « ${c.title} »`);
    const all = `${c.title} ${c.text} ${c.note}`;
    if (/!(?![=])/.test(all.replace(/\/\/[^\n]*/g, ''))) err('tone', `point d’exclamation dans « ${c.title} »`);
    for (const b of banned) if (all.toLowerCase().includes(b)) err('tone', `tournure à éviter « ${b} » dans « ${c.title} »`);
    // a glossary term must not appear before the module that introduces it
    const mi = tl.chapters[tl.chapterAt(c.t)].module;
    for (const id of glossary.find(all)) {
      const t = glossary.term(id)!;
      if (t.module && (modIdx.get(t.module) ?? -1) > mi) err('term-order', `« ${t.name} » apparaît dans « ${c.title} » avant le module où il est introduit`);
    }
  }
  for (const d of tl.diags) if (!diagrams.has(d.name)) err('link', `schéma inconnu : ${d.name}`);
  if (course.scenes) for (const s of tl.scenes) if (!(s.key in course.scenes)) err('link', `scène inconnue : ${s.key}`);
  for (const t of course.glossary ?? []) {
    if (t.tool && !capsules.has(t.tool)) err('link', `le terme « ${t.name} » renvoie à une fiche inconnue ${t.tool}`);
    if (t.module && !modIdx.has(t.module)) err('link', `le terme « ${t.name} » renvoie à un module inconnu ${t.module}`);
  }
  for (const cp of course.toolbox ?? []) for (const s of cp.steps) if (s.diagram && !diagrams.has(s.diagram)) err('link', `fiche ${cp.id} : schéma inconnu ${s.diagram}`);

  // pauses
  for (const st of tl.stops) {
    if (st.kind === 'lab' && st.lab !== 'assembly' && !exercises.some((e) => e.id === st.lab)) err('link', `atelier : exercice inconnu ${st.lab}`);
    if (st.kind === 'lab' && st.lab === 'assembly' && !cfg.assembly) err('link', 'atelier : page d’assemblage demandée mais non déclarée');
    if (st.kind === 'test' && !course.tests?.[st.test === 'pre' ? 'pre' : 'post']?.length) err('link', `test ${st.test} proposé mais sans questions`);
    if (tl.caps.some((c) => Math.abs(c.t - st.t) < 1e-3)) err('timing', `la pause « ${st.title} » commence en même temps qu’une étape`);
  }
  for (const ex of exercises) {
    if (!tl.stops.some((s) => s.lab === ex.id)) err('offered', `l’exercice ${ex.id} n’est jamais proposé dans le parcours`);
    if (!modIdx.has(ex.module)) err('link', `l’exercice ${ex.id} renvoie à un module inconnu ${ex.module}`);
  }

  // questions: right answers spread over the positions, and not given away by their length
  const qs: { id: string; q: QuizSpec }[] = [
    ...tl.stops.filter((s) => s.quiz).map((s) => ({ id: s.id, q: s.quiz! })),
    ...[...(course.tests?.tools ?? []), ...(course.tests?.pre ?? []), ...(course.tests?.post ?? [])].map((it) => ({ id: it.id, q: it.q })),
    ...exercises.flatMap((e) => (e.kind === 'code' && e.primm ? [{ id: `${e.id}-predire`, q: e.primm.predict }, { id: `${e.id}-examiner`, q: e.primm.investigate }] : [])),
  ];
  const pos = [0, 0, 0, 0, 0];
  for (const { id, q } of qs) {
    if (q.kind !== 'choice') continue;
    pos[Math.min(4, q.answer)]++;
    const right = q.choices[q.answer]?.length ?? 0;
    const longest = Math.max(...q.choices.filter((_, i) => i !== q.answer).map((c) => c.length));
    if (right > longest * 1.35 + 4) err('answer-length', `question ${id} : la bonne réponse est bien plus longue que les autres (${right} contre ${longest} caractères)`);
  }
  const nChoice = pos.reduce((a, b) => a + b, 0);
  if (nChoice >= 8 && Math.max(...pos.slice(0, 4)) > nChoice / 4 + 3) err('answer-position', `bonnes réponses mal réparties : ${pos.slice(0, 4).join(' / ')}`);

  // tests: every final item paired with a start item
  const pre = new Set((course.tests?.pre ?? []).map((t) => t.id));
  for (const it of course.tests?.post ?? []) if (!it.pair || !pre.has(it.pair)) err('test-pair', `test final : la question ${it.id} n’a pas de jumelle au test de départ`);
  for (const it of course.tests?.tools ?? []) if (it.tool && !capsules.has(it.tool)) err('link', `test de départ : la question ${it.id} renvoie à une fiche inconnue`);

  // modules: assessed, with something to write
  tl.modules.forEach((m, i) => {
    if (m.kind !== 'core') return;
    const stops = tl.stops.filter((s) => s.module === i);
    if (!stops.some((s) => s.kind === 'quiz')) warn('assessed', `module « ${m.title} » : aucune question`);
    if (!stops.some((s) => s.kind === 'explain') && i > 0) warn('explain', `module « ${m.title} » : aucune explication écrite`);
    if (!course.modules[i].summary.length) err('summary', `module « ${m.title} » : fiche de synthèse vide`);
  });

  // --------------------------------------------- 3. model and claims
  if (course.model) {
    for (const c of course.model.checks) {
      let e: string | null;
      try { e = c.run(); } catch (x: any) { e = `erreur : ${x?.message ?? x}`; }
      if (e) err('model', `${c.name} : ${e}`);
    }
  }
  for (const c of tl.caps) for (const cl of c.claims) {
    let r: boolean | string;
    try { r = cl.check(course.model); } catch (x: any) { r = `erreur : ${x?.message ?? x}`; }
    if (r !== true) err('claim', `« ${c.title} » affirme « ${cl.text} » : ${r === false ? 'le modèle ne le confirme pas' : r}`);
  }

  // ------------------------------------------------ 4. exercises and walk
  for (const ex of exercises) {
    if (ex.kind === 'code') {
      const sol = verifyCode(ex, ex.solution, exercises, cfg);
      if (!sol.ok) err('exercise', `${ex.id} : la solution est refusée — ${sol.msg}`);
      if (ex.starter && verifyCode(ex, ex.starter, exercises, cfg).ok) err('exercise', `${ex.id} : le point de départ est accepté, l’exercice ne vérifie rien`);
      if (primmDefinesSlot(ex) && verifyCode(ex, ex.primm!.code, exercises, cfg).ok) err('exercise', `${ex.id} : le code donné à lire est déjà accepté, il n’y a rien à modifier`);
    } else if (ex.kind === 'calculation') {
      if (!verifyCalculation(ex, ex.steps.map((s) => s.value)).ok) err('exercise', `${ex.id} : les valeurs attendues sont refusées`);
    } else if (ex.kind === 'classify') {
      if (!verifyClassify(ex, ex.items.map((i) => i.cat)).ok) err('exercise', `${ex.id} : le classement attendu est refusé`);
    } else if (ex.kind === 'sequence') {
      if (!verifySequence(ex, ex.items.map((_, i) => i)).ok) err('exercise', `${ex.id} : l’ordre attendu est refusé`);
    }
  }
  walk(course, tl, err);

  const stats = {
    modules: tl.modules.filter((m) => m.kind === 'core').length,
    chapitres: tl.chapters.length,
    étapes: tl.caps.length,
    questions: tl.stops.filter((s) => s.kind === 'quiz').length,
    expériences: tl.stops.filter((s) => s.kind === 'try').length,
    explications: tl.stops.filter((s) => s.kind === 'explain').length,
    exercices: exercises.length,
    révisions: tl.stops.filter((s) => s.kind === 'review').length,
    termes: course.glossary?.length ?? 0,
    fiches: course.toolbox?.length ?? 0,
  };
  return { course: course.id, findings, stats, ok: !findings.some((f) => f.level === 'error') };
}

/** Every step's read-out and diagram, every capsule's diagram, run once. */
function walk(course: CourseDef, tl: Timeline, err: (rule: string, msg: string) => void): void {
  const ctx = mockContext();
  const draw = { ...TOOL_DIAGRAMS, ...(course.diagrams ?? {}) } as Record<string, (c: CanvasRenderingContext2D, e: any) => void>;
  for (const c of tl.caps) {
    const v = tl.eval(c.t + 0.01);
    if (c.hud) { try { c.hud(v); } catch (x: any) { err('walk', `« ${c.title} » : l’affichage calculé lève une erreur (${x?.message ?? x})`); } }
    const d = tl.diagAt(c.t + 0.01);
    if (d && draw[d.name]) {
      for (const t of [0, 3.7, 11.2]) {
        try { draw[d.name](ctx, { t, v, ptr: null, hits: new Set(), arg: d.arg, model: course.model }); } catch (x: any) { err('walk', `schéma ${d.name} (« ${c.title} ») : ${x?.message ?? x}`); break; }
      }
    }
  }
  for (const cp of course.toolbox ?? []) for (const s of cp.steps) {
    if (!s.diagram || !draw[s.diagram]) continue;
    try { draw[s.diagram](ctx, { t: 1, v: {}, ptr: { x: 120, y: 90 }, hits: new Set(), model: course.model }); } catch (x: any) { err('walk', `fiche ${cp.id}, schéma ${s.diagram} : ${x?.message ?? x}`); }
  }
  // experiments: their goals run on their own controls
  for (const st of tl.stops) {
    if (st.kind !== 'try' || !st.goals) continue;
    const v = tl.eval(st.t);
    for (const g of st.goals) { try { g.test({ v, ptr: { x: 0, y: 0 }, hits: new Set() }); } catch (x: any) { err('walk', `expérience « ${st.title} », objectif « ${g.label} » : ${x?.message ?? x}`); } }
  }
}
