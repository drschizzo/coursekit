// The four levels of checks a course must pass before it is published:
//   1. it compiles (the builder refuses malformed content);
//   2. the pedagogical lint: the rules of the format, and the links;
//   3. the domain model's checks, the figures stated in the text, and the
//      clinic cases (the fault breaks the goal, restoring it repairs it);
//   4. a complete walk: every step, read-out, diagram, stage scene and
//      exercise runs.
// The rules come from avbd's course/mini.selftest.ts; the ones about terms,
// goals, test pairs and phrasing are new.

import {
  compile, controlBounds, courseMinutes, createGlossary, diagramVariants, effortMinutes, fmtMinutes,
  type CourseDef, type QuizSpec, type Rect, type Stop, type Timeline, type Vals,
} from '@coursekit/core';
import { DH, DW, TOOL_DIAGRAMS } from '@coursekit/diagrams';
import {
  primmDefinesSlot, verifyCalculation, verifyClassify, verifyCode, verifySequence,
  type Exercise, type WorkshopConfig,
} from '@coursekit/exercises';
import { mockContext, textProblems } from './mockctx.ts';

export interface Finding { level: 'error' | 'warning'; rule: string; msg: string }
export interface Report { course: string; findings: Finding[]; stats: Record<string, number>; ok: boolean }

/** A scene of a canvasStage, as the checker sees it (see @coursekit/ui). */
export interface SceneLike {
  prepare?(settings: Vals): unknown;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, settings: Vals, data: unknown, safe: Rect): void;
}

export interface CheckOptions {
  /** the course's stage: a canvasStage's scenes are drawn and their texts checked */
  stage?: { scenes?: Record<string, SceneLike> } | null;
  /** why the stage could not be loaded */
  stageError?: string;
}

/**
 * The two windows the stage scenes are drawn in: a wide screen, the text on
 * the left and the diagram on the right; a phone, the panels above and below.
 */
export const SAFE_ZONES: { name: string; w: number; h: number; safe: Rect }[] = [
  { name: 'large', w: 1440, h: 900, safe: { x: 440, y: 72, w: 560, h: 740 } },
  { name: 'étroite', w: 390, h: 844, safe: { x: 8, y: 64, w: 374, h: 300 } },
];
/** The effort announced may differ from the estimate by this much before a remark. */
const EFFORT_SLACK = 0.15;

const MAX_WORDS = 75;
const DEFAULT_BANNED = ['incroyable', 'magique', 'la bonne nouvelle', 'le secret', 'révolutionnaire', 'génial', 'bluffant', 'spectaculaire'];

export function checkCourse(course: CourseDef & { workshop?: WorkshopConfig }, opts: CheckOptions = {}): Report {
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
    // a lazy text is written here, like at its first reading
    let text: string;
    try { text = c.text; } catch (x: any) { err('walk', `« ${c.title} » : le texte calculé lève une erreur (${x?.message ?? x})`); continue; }
    if (/\bNaN\b|\bundefined\b|\bnull\b|Infinity/.test(text)) err('walk', `« ${c.title} » : texte non numérique « ${text.slice(0, 60)} »`);
    const words = text.split(/\s+/).filter(Boolean).length;
    if (words > MAX_WORDS) err('step-length', `étape trop longue (${words} mots) : « ${c.title} »`);
    for (const id of c.tools) if (!capsules.has(id)) err('link', `fiche inconnue ${id} dans « ${c.title} »`);
    const all = `${c.title} ${text} ${c.note}`;
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

  // the effort announced on the home page, against the estimate shown next to it
  const minutes = courseMinutes(tl, exercises);
  const announced = course.audience.effort ? effortMinutes(course.audience.effort) : null;
  if (announced && (minutes < announced[0] * (1 - EFFORT_SLACK) || minutes > announced[1] * (1 + EFFORT_SLACK))) {
    warn('effort', `le cours annonce « ${course.audience.effort} », l’estimation de la page d’accueil donne ${fmtMinutes(minutes)}`);
  }

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
  for (const st of tl.stops) if (st.clinic) clinic(tl, st, err);
  for (const c of tl.caps) for (const cl of c.claims) {
    let r: boolean | string;
    try { r = cl.check(); } catch (x: any) { r = `erreur : ${x?.message ?? x}`; }
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
  walk(course, tl, err, warn);
  if (opts.stageError) err('stage', `la scène ne se charge pas : ${opts.stageError}`);
  if (opts.stage?.scenes) stageWalk(tl, opts.stage.scenes, err, warn);

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
    minutes,
  };
  return { course: course.id, findings, stats, ok: !findings.some((f) => f.level === 'error') };
}

/**
 * Every step's read-out and diagram, every capsule's diagram, and every
 * diagram shown with an experiment drawn with its controls at their bounds:
 * nothing may throw, print a non-number, leave the frame or overlap.
 */
function walk(course: CourseDef, tl: Timeline, err: (rule: string, msg: string) => void, warn: (rule: string, msg: string) => void): void {
  const ctx = mockContext();
  const draw = { ...TOOL_DIAGRAMS, ...(course.diagrams ?? {}) } as Record<string, (c: CanvasRenderingContext2D, e: any) => void>;
  const reported = new Set<string>();
  /** draws once and reports what goes wrong, once per diagram and problem */
  const run = (name: string, where: string, env: Record<string, unknown>): boolean => {
    ctx.reset();
    try { draw[name](ctx, { ptr: null, hits: new Set(), model: course.model, ...env }); } catch (x: any) {
      err('walk', `schéma ${name} (${where}) : ${x?.message ?? x}`);
      return false;
    }
    for (const p of textProblems(ctx.texts, DW, DH)) {
      const key = `${name}|${p}`;
      if (reported.has(key)) continue;
      reported.add(key);
      (p.startsWith('texte non numérique') ? err : warn)(p.startsWith('texte non numérique') ? 'walk' : 'layout', `schéma ${name} (${where}) : ${p}`);
    }
    return true;
  };
  for (const c of tl.caps) {
    const v = tl.eval(c.t + 0.01);
    if (c.hud) {
      try { const s = c.hud(v); if (/NaN|undefined|Infinity/.test(s)) err('walk', `« ${c.title} » : l’affichage calculé donne « ${s} »`); } catch (x: any) { err('walk', `« ${c.title} » : l’affichage calculé lève une erreur (${x?.message ?? x})`); }
    }
  }
  for (const d of diagramVariants(tl)) {
    if (!draw[d.name]) continue;
    for (const t of [0, 3.7, 11.2]) if (!run(d.name, d.label, { t, v: d.v, arg: d.arg })) break;
  }
  for (const cp of course.toolbox ?? []) for (const s of cp.steps) {
    if (!s.diagram || !draw[s.diagram]) continue;
    run(s.diagram, `fiche ${cp.id}`, { t: 1, v: {}, ptr: { x: 120, y: 90 } });
  }
  // experiments: their goals run on their own controls, at their bounds too
  for (const st of tl.stops) {
    if (st.kind !== 'try' || !st.goals) continue;
    const base = tl.eval(st.t);
    const vs = [base, ...st.controls.flatMap((c) => controlBounds(c).map((x) => ({ ...base, [c.key]: x })))];
    for (const g of st.goals) {
      for (const v of vs) {
        try { g.test({ v, ptr: { x: 0, y: 0 }, hits: new Set() }); } catch (x: any) { err('walk', `expérience « ${st.title} », objectif « ${g.label} » : ${x?.message ?? x}`); break; }
      }
    }
  }
}

const shown = (x: unknown) => (typeof x === 'string' ? x : JSON.stringify(x));

/**
 * A clinic case must be diagnosable and repairable: with the broken settings
 * the goal is missed; restoring only them (to the values in force before the
 * case) reaches it; and the symptom, when given, is not the one another
 * control of the case would give.
 */
function clinic(tl: Timeline, st: Stop, err: (rule: string, msg: string) => void): void {
  const k = st.clinic!;
  const where = `cas clinique ${k.id}`;
  const goal = st.goals?.[0];
  if (!goal) return;
  const reached = (v: Vals) => goal.test({ v, ptr: { x: 0, y: 0 }, hits: new Set() });
  // the values before the case: defaults and set(), without the case's scene
  const before: Vals = { ...tl.defaults };
  for (const s of tl.sets) { if (st.t < s.t) break; Object.assign(before, s.patch); }
  const broken = tl.eval(st.t);
  const healthy: Vals = { ...broken };
  for (const key of Object.keys(k.fault)) { if (key in before) healthy[key] = before[key]; else delete healthy[key]; }
  const faultKeys = Object.keys(k.fault);
  for (const key of faultKeys) if (!st.controls.some((c) => c.key === key)) err('clinic', `${where} : le réglage fautif ${key} n’a pas de contrôle, il ne peut pas être réparé`);
  if (faultKeys.every((key) => broken[key] === healthy[key])) { err('clinic', `${where} : le réglage fautif est déjà la valeur par défaut`); return; }
  try {
    if (reached(broken)) err('clinic', `${where} : avec le réglage fautif, l’objectif « ${goal.label} » est déjà atteint`);
    if (!reached(healthy)) err('clinic', `${where} : en rétablissant ${faultKeys.map((key) => `${key} = ${healthy[key] ?? '(par défaut)'}`).join(', ')}, l’objectif « ${goal.label} » n’est pas atteint`);
  } catch (x: any) { err('clinic', `${where} : l’objectif lève une erreur (${x?.message ?? x})`); return; }
  if (!k.symptom) return;
  try {
    const sym = shown(k.symptom(broken));
    for (const c of st.controls) {
      if (faultKeys.includes(c.key)) continue;
      for (const x of controlBounds(c)) {
        if (x === healthy[c.key]) continue;
        if (shown(k.symptom({ ...healthy, [c.key]: x })) === sym) err('clinic', `${where} : le symptôme du défaut (${sym}) est aussi celui de « ${c.label} » = ${x}, le diagnostic ne peut pas les distinguer`);
      }
    }
  } catch (x: any) { err('clinic', `${where} : le symptôme lève une erreur (${x?.message ?? x})`); }
}

/**
 * Every stage scene, with the settings of each place it is shown (and of the
 * experiments there, their stage controls at their bounds), drawn in the two
 * windows of SAFE_ZONES at a few moments: nothing may throw or print a
 * non-number; a text out of the safe area, or over another, is a remark.
 */
function stageWalk(tl: Timeline, scenes: Record<string, SceneLike>, err: (rule: string, msg: string) => void, warn: (rule: string, msg: string) => void): void {
  const runs = new Map<string, { key: string; label: string; v: Vals }>();
  const add = (key: string, label: string, v: Vals) => {
    const id = `${key}|${JSON.stringify(Object.entries(v).sort())}`;
    if (!runs.has(id)) runs.set(id, { key, label, v });
  };
  for (const sc of tl.scenes) {
    if (!scenes[sc.key]) { err('link', `scène inconnue de la scène du cours : ${sc.key}`); continue; }
    add(sc.key, `scène ${sc.key}`, tl.stageVals(sc.t + 1e-3));
  }
  for (const st of tl.stops) {
    if (st.kind !== 'try') continue;
    const sc = tl.sceneAt(st.t);
    if (!sc || !scenes[sc.key]) continue;
    const base = tl.stageVals(st.t);
    for (const c of st.controls) {
      if (!tl.stageKeys.has(c.key)) continue;
      for (const x of controlBounds(c)) add(sc.key, `scène ${sc.key}, « ${st.title} », ${c.label} = ${x}`, { ...base, [c.key]: x });
    }
  }
  const reported = new Set<string>();
  for (const { key, label, v } of runs.values()) {
    const scene = scenes[key];
    let data: unknown;
    try { data = scene.prepare ? scene.prepare({ ...v }) : null; } catch (x: any) { err('stage', `${label} : la préparation lève une erreur (${x?.message ?? x})`); continue; }
    for (const z of SAFE_ZONES) {
      const ctx = mockContext(z.w, z.h);
      for (const t of [0, 1.5, 6, 40]) {
        ctx.reset();
        try { scene.draw(ctx, z.w, z.h, t, { ...v }, data, { ...z.safe }); } catch (x: any) { err('stage', `${label}, zone ${z.name} : ${x?.message ?? x}`); break; }
        for (const p of textProblems(ctx.texts, z.w, z.h, z.safe, 'de la zone utile')) {
          // once per scene, window and problem: a read-out whose figures change is one text
          const id = `${key}|${z.name}|${p.replace(/\d[\d\s,.]*/g, '#')}`;
          if (reported.has(id)) continue;
          reported.add(id);
          if (p.startsWith('texte non numérique')) err('stage', `${label}, zone ${z.name} : ${p}`);
          else warn('stage-layout', `${label}, zone ${z.name} : ${p}`);
        }
      }
    }
  }
}
