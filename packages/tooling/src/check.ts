// The four levels of checks a course must pass before it is published:
//   1. it compiles (the builder refuses malformed content);
//   2. the pedagogical lint: the rules of the format, and the links;
//   3. the domain model's checks, the figures stated in the text, and the
//      clinic cases (the fault breaks the goal, restoring it repairs it);
//   4. a complete walk: every step, read-out, diagram, stage scene and
//      exercise runs.
// Levels 2 to 4 are a list of named checks (`CHECKS`), each reading a shared
// context and reporting findings: a project can add its own (`extra`) or
// silence a rule (`skip`). The messages are for the author, in French; the
// rules that depend on the course's language (`BANNED`, the effort) follow it.
// The rules come from avbd's course/mini.selftest.ts; the ones about terms,
// goals, test pairs and phrasing are new.

import {
  captionText, compile, controlBounds, courseMinutes, createGlossary, diagramVariants, effortMinutes, fmtMinutes, fr, labelsFor,
  type Control, type DiagramEnv, type Glossary, type LabelSet, type QuizSpec, type Timeline, type TryStop, type Vals,
} from '@coursekit/core';
import { DH, DW } from '@coursekit/diagrams';
import {
  primmDefinesSlot, verifyCalculation, verifyClassify, verifyCode, verifySequence,
  type Course, type Exercise, type WorkshopConfig,
} from '@coursekit/exercises';
import { TOOL_DIAGRAMS } from '@coursekit/toolbox';
import { mockContext, textProblems } from './mockctx.ts';
import { SAFE_ZONES, contentWords, coverage, jaccard, norm, numbersIn, screenReader, telling, textOf, type SceneLike } from './screen.ts';

export { SAFE_ZONES, type SceneLike } from './screen.ts';

export interface Finding { level: 'error' | 'warning'; rule: string; msg: string }
export interface Report { course: string; findings: Finding[]; stats: Record<string, number>; ok: boolean }

export interface CheckOptions {
  /** the course's stage: a canvasStage's scenes are drawn and their texts checked */
  stage?: { scenes?: Record<string, SceneLike> } | null;
  /** why the stage could not be loaded */
  stageError?: string;
  /** checks of the project's own, run after the library's */
  extra?: Check[];
  /** rules whose findings are dropped (their id, as the report prints it) */
  skip?: string[];
}

/** Everything a check reads, computed once. */
export interface CheckContext {
  course: Course;
  tl: Timeline;
  exercises: Exercise[];
  cfg: WorkshopConfig;
  labels: LabelSet;
  glossary: Glossary;
  modIdx: Map<string, number>;
  capsules: Set<string>;
  diagrams: Set<string>;
  scenes?: Record<string, SceneLike>;
  stageError?: string;
  /** estimated working time, in minutes */
  minutes: number;
  err(rule: string, msg: string): void;
  warn(rule: string, msg: string): void;
}

/** A named group of rules. */
export interface Check { name: string; run(x: CheckContext): void }

/** The effort announced may differ from the estimate by this much before a remark. */
const EFFORT_SLACK = 0.15;

const MAX_WORDS = 75;

/** Phrasings to avoid, by language: the course's `bannedPhrases` add to them. */
export const BANNED: Record<string, string[]> = {
  fr: ['incroyable', 'magique', 'la bonne nouvelle', 'le secret', 'révolutionnaire', 'génial', 'bluffant', 'spectaculaire'],
  en: ['amazing', 'magic', 'the good news', 'the secret', 'revolutionary', 'awesome', 'mind-blowing', 'spectacular'],
};

const message = (e: unknown) => String((e as Error)?.message ?? e);
const tryStops = (tl: Timeline) => tl.stops.filter((s): s is TryStop => s.kind === 'try');

// ------------------------------------------------- 2. pedagogical lint

/** Steps: length, tone, links, and terms used before their module. */
const steps: Check = {
  name: 'steps',
  run({ course, tl, glossary, modIdx, capsules, labels, err }) {
    const banned = [...(BANNED[labels.lang.split('-')[0]] ?? []), ...(course.bannedPhrases ?? [])];
    for (const c of tl.caps) {
      // a lazy text is written here, like at its first reading
      let text: string;
      try { text = captionText(c); } catch (x) { err('walk', `« ${c.title} » : le texte calculé lève une erreur (${message(x)})`); continue; }
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
  },
};

/** Every name points at something: diagrams, scenes, capsules, modules, exercises, tests. */
const links: Check = {
  name: 'links',
  run({ course, tl, exercises, cfg, modIdx, capsules, diagrams, err }) {
    for (const d of tl.diags) if (!diagrams.has(d.name)) err('link', `schéma inconnu : ${d.name}`);
    if (course.scenes) for (const s of tl.scenes) if (!(s.key in course.scenes)) err('link', `scène inconnue : ${s.key}`);
    for (const t of course.glossary ?? []) {
      if (t.tool && !capsules.has(t.tool)) err('link', `le terme « ${t.name} » renvoie à une fiche inconnue ${t.tool}`);
      if (t.module && !modIdx.has(t.module)) err('link', `le terme « ${t.name} » renvoie à un module inconnu ${t.module}`);
    }
    for (const cp of course.toolbox ?? []) for (const s of cp.steps) if (s.diagram && !diagrams.has(s.diagram)) err('link', `fiche ${cp.id} : schéma inconnu ${s.diagram}`);
    for (const st of tl.stops) {
      if (st.kind === 'lab' && st.lab !== 'assembly' && !exercises.some((e) => e.id === st.lab)) err('link', `atelier : exercice inconnu ${st.lab}`);
      if (st.kind === 'lab' && st.lab === 'assembly' && !cfg.assembly) err('link', 'atelier : page d’assemblage demandée mais non déclarée');
      if (st.kind === 'test' && !course.tests?.[st.test]?.length) err('link', `test ${st.test} proposé mais sans questions`);
      if (tl.caps.some((c) => Math.abs(c.t - st.t) < 1e-3)) err('timing', `la pause « ${st.title} » commence en même temps qu’une étape`);
    }
    for (const ex of exercises) {
      if (!tl.stops.some((s) => s.kind === 'lab' && s.lab === ex.id)) err('offered', `l’exercice ${ex.id} n’est jamais proposé dans le parcours`);
      if (!modIdx.has(ex.module)) err('link', `l’exercice ${ex.id} renvoie à un module inconnu ${ex.module}`);
    }
    for (const it of course.tests?.tools ?? []) if (it.tool && !capsules.has(it.tool)) err('link', `test de départ : la question ${it.id} renvoie à une fiche inconnue`);
  },
};

/** Questions: right answers spread over the positions, and not given away by their length; tests paired. */
const questions: Check = {
  name: 'questions',
  run({ course, tl, exercises, err }) {
    const qs: { id: string; q: QuizSpec }[] = [
      ...tl.stops.flatMap((s) => (s.kind === 'quiz' ? [{ id: s.id, q: s.quiz }] : [])),
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
  },
};

/** Modules: assessed, with something to write and a summary; the announced effort near the estimate. */
const modules: Check = {
  name: 'modules',
  run({ course, tl, minutes, err, warn }) {
    const announced = course.audience.effort ? effortMinutes(course.audience.effort) : null;
    if (announced && (minutes < announced[0] * (1 - EFFORT_SLACK) || minutes > announced[1] * (1 + EFFORT_SLACK))) {
      warn('effort', `le cours annonce « ${course.audience.effort} », l’estimation de la page d’accueil donne ${fmtMinutes(minutes)}`);
    }
    tl.modules.forEach((m, i) => {
      if (m.kind !== 'core') return;
      const stops = tl.stops.filter((s) => s.module === i);
      if (!stops.some((s) => s.kind === 'quiz')) warn('assessed', `module « ${m.title} » : aucune question`);
      if (!stops.some((s) => s.kind === 'explain') && i > 0) warn('explain', `module « ${m.title} » : aucune explication écrite`);
      if (!course.modules[i].summary.length) err('summary', `module « ${m.title} » : fiche de synthèse vide`);
    });
  },
};

// --------------------------------------------- 3. model and claims

/** The model's own checks, the figures stated in the text, and the clinic cases. */
const model: Check = {
  name: 'model',
  run({ course, tl, err }) {
    for (const c of course.model?.checks ?? []) {
      let e: string | null;
      try { e = c.run(); } catch (x) { e = `erreur : ${message(x)}`; }
      if (e) err('model', `${c.name} : ${e}`);
    }
    for (const st of tryStops(tl)) if (st.clinic) clinic(tl, st, err);
    for (const c of tl.caps) for (const cl of c.claims) {
      let r: boolean | string;
      try { r = cl.check(); } catch (x) { r = `erreur : ${message(x)}`; }
      if (r !== true) err('claim', `« ${c.title} » affirme « ${cl.text} » : ${r === false ? 'le modèle ne le confirme pas' : r}`);
    }
  },
};

// ------------------------------------------------ 4. exercises and walk

/** Each exercise accepts its solution and refuses its starting point. */
const exercisesCheck: Check = {
  name: 'exercises',
  run({ exercises, cfg, err }) {
    for (const ex of exercises) {
      switch (ex.kind) {
        case 'code':
        {
          const sol = verifyCode(ex, ex.solution, exercises, cfg);
          if (!sol.ok) err('exercise', `${ex.id} : la solution est refusée — ${sol.msg}`);
        }
          if (ex.starter && verifyCode(ex, ex.starter, exercises, cfg).ok) err('exercise', `${ex.id} : le point de départ est accepté, l’exercice ne vérifie rien`);
          if (primmDefinesSlot(ex) && verifyCode(ex, ex.primm!.code, exercises, cfg).ok) err('exercise', `${ex.id} : le code donné à lire est déjà accepté, il n’y a rien à modifier`);
          break;
        case 'calculation':
          if (!verifyCalculation(ex, ex.steps.map((s) => s.value)).ok) err('exercise', `${ex.id} : les valeurs attendues sont refusées`);
          break;
        case 'classify':
          if (!verifyClassify(ex, ex.items.map((i) => i.cat)).ok) err('exercise', `${ex.id} : le classement attendu est refusé`);
          break;
        case 'sequence':
          if (!verifySequence(ex, ex.items.map((_, i) => i)).ok) err('exercise', `${ex.id} : l’ordre attendu est refusé`);
          break;
      }
    }
  },
};

const walkCheck: Check = { name: 'walk', run: (x) => walk(x.course, x.tl, x.err, x.warn) };

const stageCheck: Check = {
  name: 'stage',
  run({ tl, scenes, stageError, err, warn }) {
    if (stageError) err('stage', `la scène ne se charge pas : ${stageError}`);
    if (scenes) stageWalk(tl, scenes, err, warn);
  },
};

const screenCheck: Check = { name: 'screen', run: (x) => onScreen(x.course, x.tl, x.scenes, x.labels, x.warn) };
const repeatsCheck: Check = { name: 'repeats', run: (x) => repeats(x.course, x.tl, x.exercises, x.labels, x.warn) };

/** The library's checks, in the order they run. */
export const CHECKS: Check[] = [steps, links, questions, modules, model, exercisesCheck, walkCheck, stageCheck, screenCheck, repeatsCheck];

export function checkCourse(course: Course, opts: CheckOptions = {}): Report {
  const findings: Finding[] = [];
  const skip = new Set(opts.skip ?? []);
  const err = (rule: string, msg: string) => { if (!skip.has(rule)) findings.push({ level: 'error', rule, msg }); };
  const warn = (rule: string, msg: string) => { if (!skip.has(rule)) findings.push({ level: 'warning', rule, msg }); };

  // ---------------------------------------------------------- 1. compile
  let tl: Timeline;
  try { tl = compile(course); } catch (e) {
    err('compile', message(e));
    return { course: course.id, findings, stats: {}, ok: false };
  }
  const exercises: Exercise[] = course.exercises ?? [];
  const x: CheckContext = {
    course, tl, exercises,
    cfg: course.workshop ?? {},
    labels: labelsFor(course.language, course.labels),
    glossary: createGlossary(course.glossary),
    modIdx: new Map(course.modules.map((m, i) => [m.id, i])),
    capsules: new Set((course.toolbox ?? []).map((c) => c.id)),
    diagrams: new Set([...Object.keys(course.diagrams ?? {}), ...Object.keys(TOOL_DIAGRAMS)]),
    scenes: opts.stage?.scenes,
    stageError: opts.stageError,
    minutes: courseMinutes(tl, exercises),
    err, warn,
  };
  for (const c of [...CHECKS, ...(opts.extra ?? [])]) {
    try { c.run(x); } catch (e) { err('check', `la vérification ${c.name} a échoué : ${message(e)}`); }
  }

  const count = (k: string) => tl.stops.filter((s) => s.kind === k).length;
  const stats = {
    modules: tl.modules.filter((m) => m.kind === 'core').length,
    chapitres: tl.chapters.length,
    étapes: tl.caps.length,
    questions: count('quiz'),
    expériences: count('try'),
    explications: count('explain'),
    exercices: exercises.length,
    révisions: count('review'),
    termes: course.glossary?.length ?? 0,
    fiches: course.toolbox?.length ?? 0,
    minutes: x.minutes,
  };
  return { course: course.id, findings, stats, ok: !findings.some((f) => f.level === 'error') };
}

/**
 * Every step's read-out and diagram, every capsule's diagram, and every
 * diagram shown with an experiment drawn with its controls at their bounds:
 * nothing may throw, print a non-number, leave the frame or overlap.
 */
function walk(course: Course, tl: Timeline, err: (rule: string, msg: string) => void, warn: (rule: string, msg: string) => void): void {
  const ctx = mockContext();
  const draw = { ...TOOL_DIAGRAMS, ...(course.diagrams ?? {}) } as Record<string, (c: CanvasRenderingContext2D, e: DiagramEnv) => void>;
  const reported = new Set<string>();
  /** draws once and reports what goes wrong, once per diagram and problem */
  const run = (name: string, where: string, env: Partial<DiagramEnv> & Pick<DiagramEnv, 't' | 'v'>): boolean => {
    ctx.reset();
    try { draw[name](ctx, { ptr: null, hits: new Set(), model: course.model, ...env }); } catch (x) {
      err('walk', `schéma ${name} (${where}) : ${message(x)}`);
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
      try { const s = c.hud(v); if (/NaN|undefined|Infinity/.test(s)) err('walk', `« ${c.title} » : l’affichage calculé donne « ${s} »`); } catch (x) { err('walk', `« ${c.title} » : l’affichage calculé lève une erreur (${message(x)})`); }
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
        try { g.test({ v, ptr: { x: 0, y: 0 }, hits: new Set() }); } catch (x) { err('walk', `expérience « ${st.title} », objectif « ${g.label} » : ${message(x)}`); break; }
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
function clinic(tl: Timeline, st: TryStop, err: (rule: string, msg: string) => void): void {
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
  } catch (x) { err('clinic', `${where} : l’objectif lève une erreur (${message(x)})`); return; }
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
  } catch (x) { err('clinic', `${where} : le symptôme lève une erreur (${message(x)})`); }
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
    try { data = scene.prepare ? scene.prepare({ ...v }) : null; } catch (x) { err('stage', `${label} : la préparation lève une erreur (${message(x)})`); continue; }
    for (const z of SAFE_ZONES) {
      const ctx = mockContext(z.w, z.h);
      for (const t of [0, 1.5, 6, 40]) {
        ctx.reset();
        try { scene.draw(ctx, z.w, z.h, t, { ...v }, data, { ...z.safe }); } catch (x) { err('stage', `${label}, zone ${z.name} : ${message(x)}`); break; }
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

type Ask = { kind: QuizSpec['kind']; question: string; choices: string[]; answer: number; value?: number; tol?: number };
const fmtNum = (x: number) => String(Number(x.toPrecision(4))).replace('.', ',');

/** What of a question's answer can be read in these texts, or null. */
function answerIn(q: Ask, texts: string[]): string | null {
  const all = texts.join(' · ');
  const nums = numbersIn(all);
  const near = (x: number, rel: number, abs = 0) => nums.some((y) => Math.abs(y - x) <= Math.max(abs, rel * Math.abs(x), 1e-9));
  if (q.kind === 'number' && q.value !== undefined) {
    if (telling(q.value) && near(q.value, 0.005, q.tol ?? Math.abs(q.value) * 0.02)) return `la réponse (${fmtNum(q.value)})`;
    return null;
  }
  if (q.kind === 'order') {
    const t = norm(all);
    const at = q.choices.map((it) => t.indexOf(norm(it)));
    if (q.choices.length >= 3 && at.every((i) => i >= 0) && at.every((i, k) => !k || i > at[k - 1])) return 'l’ordre attendu';
    return null;
  }
  const right = q.choices[q.answer], others = q.choices.filter((_, i) => i !== q.answer);
  if (!right) return null;
  // a figure of the right answer, and of no other choice
  const rn = numbersIn(right).filter(telling);
  if (rn.some((x) => near(x, 0.03)) && !others.some((o) => numbersIn(o).filter(telling).some((x) => near(x, 0.03)))) return `la bonne réponse (« ${right} »)`;
  // its words, much more than those of the other choices
  const pool = contentWords(all), rw = contentWords(right);
  const rc = coverage(rw, pool);
  if (rw.size >= 2 && rc >= 0.6 && others.every((o) => coverage(contentWords(o), pool) <= rc - 0.3)) return `la bonne réponse (« ${right} »)`;
  return null;
}

/** Whether a clinic case's broken setting is written in these texts: its control's label and value, or « key = value ». */
function faultIn(fault: Vals, controls: Control[], texts: string[]): string | null {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [key, val] of Object.entries(fault)) {
    const c = controls.find((x) => x.key === key);
    if (!c) continue;
    const opt = c.options?.find((o) => o.value === val)?.label;
    const shown = [...new Set([opt, c.fmt?.(val), fr(val, 0), fr(val, 1), fr(val, 2)].filter((s): s is string => !!s).map(norm))];
    const label = norm(c.label);
    for (const raw of texts) {
      const t = norm(raw);
      for (const v of shown) {
        const token = new RegExp(`(?<![\\d,.])${esc(v)}(?![\\d]|,\\d)`);
        if ((t.includes(label) && token.test(t)) || new RegExp(`(^|[^a-z])${esc(norm(key))}\\s*[=:]\\s*${esc(v)}(?![\\d]|,\\d)`).test(t)) return `${c.label} = ${opt ?? c.fmt?.(val) ?? fmtNum(val)}`;
      }
      if (opt && contentWords(opt).size >= 2 && t.includes(norm(opt))) return `${c.label} = ${opt}`;
    }
  }
  return null;
}

/**
 * What the learner sees when a question opens, and when a step shows a
 * picture:
 *   - `spoiler`: a question (a prediction, a diagnosis) whose answer can be
 *     read on screen — in the diagram, the stage scene or the step shown
 *     above it; the fault of a clinic case written on its diagram or scene;
 *   - `term-early`: a glossary term that a diagram or a scene shows before
 *     its module, or before any step uses it — a word without its tooltip,
 *     often a sign that the picture belongs to a later chapter.
 */
function onScreen(course: Course, tl: Timeline, scenes: Record<string, SceneLike> | undefined, L: LabelSet, warn: (rule: string, msg: string) => void): void {
  const screen = screenReader(course, tl, scenes);
  for (const st of tl.stops) {
    const asks: { what: string; q: Ask }[] = [];
    const fix = st.kind === 'quiz' ? tryStops(tl).find((x) => x.clinic?.id === st.id) : undefined;
    if (st.kind === 'quiz') asks.push({ what: fix ? `cas ${st.id}, diagnostic` : `question ${st.id}`, q: st.quiz });
    if (st.kind === 'try' && st.predict) asks.push({ what: `prédiction de « ${st.title} »`, q: { kind: 'choice', question: st.predict.question, choices: st.predict.choices, answer: st.predict.answer ?? 0 } });
    if (!asks.length) continue;
    const s = screen.at(st.t);
    const sources: { where: string; texts: string[] }[] = [];
    if (s.diagram) sources.push({ where: `le schéma ${s.diagram.name}`, texts: s.diagram.texts });
    if (s.scene) sources.push({ where: `la scène ${s.scene.key}`, texts: [s.scene.label, ...s.scene.texts] });
    // the generic step before a question asked first says nothing of the answer
    if (s.step && s.step.title !== L.askTitle) sources.push({ where: `l’étape « ${s.step.title} », affichée au-dessus`, texts: [s.step.text] });
    for (const { what, q } of asks) {
      for (const src of sources) {
        const hit = answerIn(q, src.texts);
        if (hit) warn('spoiler', `${what} : ${hit} se lit dans ${src.where}`);
      }
    }
    if (fix?.clinic) {
      for (const src of sources.slice(0, 2)) {
        const hit = faultIn(fix.clinic.fault, fix.controls, src.texts);
        if (hit) warn('spoiler', `cas ${st.id} : le réglage fautif (${hit}) est écrit dans ${src.where} pendant le diagnostic`);
      }
    }
  }

  // terms in the pictures
  const glossary = createGlossary(course.glossary);
  const modIdx = new Map(course.modules.map((m, i) => [m.id, i]));
  const first = new Map<string, number>();
  for (const c of tl.caps) for (const id of glossary.find(`${c.title} ${textOf(c)} ${c.note}`)) if (!first.has(id)) first.set(id, c.t);
  // a question names a term too: from the start of the step it opens under
  for (const st of tl.stops) {
    if (st.kind !== 'quiz') continue;
    const at = tl.caps[tl.capAt(st.t)]?.t ?? st.t;
    for (const id of glossary.find(`${st.quiz.question} ${st.quiz.choices.join(' ')}`)) if (!first.has(id) || first.get(id)! > at) first.set(id, at);
  }
  const reported = new Set<string>();
  const terms = (id: string, where: string, texts: string[], t: number, mi: number) => {
    for (const g of glossary.find(texts.join(' · '))) {
      const term = glossary.term(g)!;
      if (reported.has(`${id}|${g}`)) continue;
      if (term.module && (modIdx.get(term.module) ?? -1) > mi) {
        reported.add(`${id}|${g}`);
        warn('term-early', `« ${term.name} » apparaît dans ${where} avant le module où il est introduit`);
      } else if (!first.has(g) || first.get(g)! > t + 1e-6) {
        reported.add(`${id}|${g}`);
        warn('term-early', `« ${term.name} » apparaît dans ${where} avant toute étape qui l’emploie`);
      }
    }
  };
  for (const c of tl.caps) {
    const t = c.t + 0.01, mi = tl.chapters[tl.chapterAt(t)].module;
    const s = screen.at(t);
    if (s.diagram) terms(`d:${s.diagram.name}`, `le schéma ${s.diagram.name} (étape « ${c.title} »)`, s.diagram.texts, t, mi);
    if (s.scene) terms(`s:${s.scene.key}`, `la scène ${s.scene.key} (étape « ${c.title} »)`, [s.scene.label, ...s.scene.texts], t, mi);
  }
}

/** Two questions that ask the same thing with the same words share more than this part of their words. */
const REPEAT = 0.5;

/**
 * `repeat`: two questions of the course (in the reading, a prediction, the
 * tests, a guided calculation) that ask the same thing with the same words.
 * Asking an easy point again does not deepen it; a final question that
 * repeats its start-test twin does not test it « in another situation ».
 */
function repeats(course: Course, tl: Timeline, exercises: Exercise[], L: LabelSet, warn: (rule: string, msg: string) => void): void {
  const items: { id: string; words: Set<string>; pair?: string; group?: string }[] = [];
  const add = (id: string, q: string, right: string, pair?: string, group?: string) => items.push({ id, words: contentWords(`${q} ${right}`), pair, group });
  for (const st of tl.stops) {
    if (st.kind === 'quiz' && st.quiz.question !== L.clinicQuestion) add(`question ${st.id}`, st.quiz.question, st.quiz.kind === 'choice' ? st.quiz.choices[st.quiz.answer] : st.quiz.kind === 'order' ? st.quiz.choices.join(' ') : '');
    if (st.kind === 'try' && st.predict) add(`prédiction de « ${st.title} »`, st.predict.question, st.predict.choices[st.predict.answer ?? 0] ?? '');
  }
  const testQ = (prefix: string, its: { id: string; q: QuizSpec; pair?: string }[] | undefined) => {
    for (const it of its ?? []) add(`${prefix} ${it.id}`, it.q.question, it.q.kind === 'choice' ? it.q.choices[it.q.answer] : '', it.pair);
  };
  testQ('test de départ', course.tests?.pre);
  testQ('test final', course.tests?.post);
  for (const ex of exercises) if (ex.kind === 'calculation') ex.steps.forEach((s, i) => add(`exercice ${ex.id} (${i + 1})`, s.prompt, '', undefined, ex.id));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      // the steps of one guided calculation build on each other
      if (a.words.size < 3 || b.words.size < 3 || (a.group && a.group === b.group)) continue;
      const sim = jaccard(a.words, b.words);
      if (sim < REPEAT) continue;
      const twins = (a.pair && b.id === `test de départ ${a.pair}`) || (b.pair && a.id === `test de départ ${b.pair}`);
      warn('repeat', twins
        ? `${b.id.startsWith('test final') ? b.id : a.id} reprend les mots de sa jumelle du test de départ (${pctS(sim)} de mots communs) : posez la notion dans une autre situation`
        : `${a.id} et ${b.id} posent la même question (${pctS(sim)} de mots communs) : gardez-en une, ou faites appliquer la notion à un autre cas`);
    }
  }
}
const pctS = (x: number) => `${Math.round(x * 100)} %`;
