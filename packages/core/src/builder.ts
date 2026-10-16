// The builder: what a course's `content(c)` calls, in reading order. It lays
// the content out on a timeline:
//   - a step lasts `dwell` seconds (from its length when not given);
//   - a pause sits after the step it follows, never at a step's start, so
//     leaving it always moves on to what comes next;
//   - module cards, module-start reviews and the question-first steps are
//     written here, not by the author.
//
// Taken from the content API of avbd's course/tour.ts (CH, C, Q, I, E, LAB,
// REVIEW, TEST, CARD), without the timestamps.

import { labelsFor, type LabelSet } from './labels.ts';
import { Timeline, type Caption, type Stop } from './timeline.ts';
import type { Control, CourseDef, ExperimentSpec, Goal, QuizSpec, StepOptions, Text, Vals } from './types.ts';

export interface ClinicCase {
  id: string;
  title: string;
  /** stage scene, and the broken settings (they end with the case) */
  scene: string;
  fault: Vals;
  /** what the learner sees (a function: written when shown, see `Text`) */
  observe: Text;
  /** diagnosis choices, the right one first */
  choices: string[];
  explain: string;
  controls: Control[];
  goal: { label: string; test: (v: Vals) => boolean };
  conclusion: string;
  /** model justification */
  justify: string;
  /** an exam case: its diagnosis does not come back in reviews */
  exam?: boolean;
  /** a diagram to show instead of (or with) the stage */
  diagram?: string;
  /**
   * What the learner observes, as a value (a word, a figure): the checker
   * requires that the fault gives a symptom no other control of the case
   * gives, so that the diagnosis can be made from what is shown.
   */
  symptom?: (v: Vals) => unknown;
}

export interface Builder {
  /** start a module (declared in `modules`) */
  module(id: string): void;
  /** a chapter; its body calls the other functions */
  chapter(title: string, body: () => void, opts?: { part?: string }): void;
  /**
   * a step: a title and a short text (≤ 75 words). The text may be a
   * function, written when the step is first shown (see `Text`).
   */
  step(title: string, text: Text, opts?: StepOptions): void;
  /** the diagram shown from the next step on (null: none); reset at each chapter */
  diagram(name: string | null, opts?: { arg?: string; big?: boolean }): void;
  /** the stage scene from the next step on, with its own settings (they end with the scene) */
  stage(scene: string, settings?: Vals): void;
  /** values that hold from here to the end of the course */
  set(patch: Vals): void;
  /** a question asked BEFORE the explanation (adds its own short step) */
  ask(id: string, question: string, choices: string[], explain: string): void;
  /** a choice question; the right answer is written first */
  question(id: string, question: string, choices: string[], explain: string, opt?: { review?: boolean }): void;
  numeric(id: string, question: string, value: number, explain: string, opt?: { unit?: string; tol?: number; review?: boolean }): void;
  /** put items back in order; `items` are written in the right order */
  order(id: string, question: string, items: string[], explain: string): void;
  experiment(spec: ExperimentSpec): void;
  /** a written explanation, compared with a model answer */
  explain(id: string, prompt: string, model: string): void;
  /** an invitation to a workshop exercise (or 'assembly') */
  exercise(id: string, prompt: string): void;
  test(kind: 'pre' | 'post', prompt: string): void;
  /** observe, diagnose, fix, justify — a chapter of its own */
  clinicCase(spec: ClinicCase): void;
}

/** Seconds a step animates by default: about 4 s per 15 words, 6 to 20 s. */
export const dwellOf = (text: string): number => Math.max(6, Math.min(20, Math.round((text.split(/\s+/).length / 15) * 4)));
/** Seconds a lazy text animates when no `dwell` is given: its length is not known when the course compiles. */
export const LAZY_DWELL = 12;

export function compile(course: CourseDef): Timeline {
  const L: LabelSet = labelsFor(course.labels);
  const tl = new Timeline(course.defaults ?? {}, course.stageKeys ?? []);
  const modIndex = new Map(course.modules.map((m, i) => [m.id, i]));
  const kindOf = (i: number) => course.modules[i]?.kind ?? 'core';

  let cursor = 0;
  let mod = -1;
  let part = '';
  let chap = '';
  let inChapter = false;
  /** last step: its time and dwell, and how many pauses follow it so far */
  let last: { t: number; dwell: number; pauses: number } | null = null;
  let place = 0;
  let pendingReview = false;
  let started = false;
  let diag: { name: string; arg?: string; big?: boolean } | null = null;
  let diagOpen: { t0: number; name: string; arg?: string; big?: boolean } | null = null;
  /** experiments waiting for their `until` (end of chapter or next step) */
  const holdChapter: Stop[] = [];
  let holdStep: Stop[] = [];
  const ids = new Set<string>();

  const fail = (msg: string): never => { throw new Error(`[${course.id}] ${msg}`); };
  const uniq = (id: string) => { if (ids.has(id)) fail(`identifiant en double : ${id}`); ids.add(id); return id; };

  /** time for the next pause after the last step */
  const pauseT = (): number => {
    if (!last) return fail(`une pause doit suivre une étape (chapitre « ${chap} »)`);
    const t = last.t + last.dwell * Math.min(0.95, 0.5 + 0.08 * last.pauses);
    last.pauses++;
    return t;
  };
  const push = (st: Omit<Stop, 't' | 'until' | 'ov' | 'controls'> & { controls?: Control[] }): Stop => {
    const t = pauseT();
    const s: Stop = { controls: [], ...st, t, until: t, ov: {} };
    tl.stops.push(s);
    return s;
  };
  const closeDiag = (t: number) => {
    if (diagOpen && t > diagOpen.t0) tl.diags.push({ t0: diagOpen.t0, t1: t, name: diagOpen.name, arg: diagOpen.arg, big: diagOpen.big });
    diagOpen = null;
  };
  const quizStop = (id: string, q: QuizSpec, review: boolean) => {
    push({ kind: 'quiz', id: uniq(id), title: 'Question', quiz: { ...q, module: 0, review } });
  };
  const card = (from: number, to: number | null) => {
    push({ kind: 'card', id: `card${from}`, title: 'Module', from, to });
  };

  const c: Builder = {
    module(id) {
      const i = modIndex.get(id);
      if (i == null) fail(`module inconnu : ${id}`);
      if (inChapter) fail('module() se place entre deux chapitres');
      if (mod >= 0 && last) card(mod, i!);
      mod = i!;
      part = course.modules[mod].title;
      // a review opens every core module after the first one
      const cores = course.modules.filter((m) => (m.kind ?? 'core') === 'core');
      pendingReview = kindOf(mod) === 'core' && cores[0]?.id !== id;
    },

    chapter(title, body, opts = {}) {
      if (mod < 0) fail(`chapitre « ${title} » hors d’un module`);
      if (inChapter) fail(`chapitre « ${title} » dans un autre chapitre`);
      inChapter = true;
      chap = title;
      const p = opts.part ?? part;
      tl.chapters.push({ t: cursor, title, part: p, module: mod });
      closeDiag(cursor);
      diag = null;
      last = null;
      if (pendingReview) {
        pendingReview = false;
        c.step(L.reviewTitle, L.reviewText, { dwell: 3 });
        push({ kind: 'review', id: uniq(`review-${mod}`), title: L.reviewTitle });
      }
      body();
      // the course's first step is followed by the card that presents module 0
      if (!started) fail(`chapitre « ${title} » sans étape`);
      for (const s of holdChapter) s.until = cursor;
      holdChapter.length = 0;
      for (const s of holdStep) s.until = cursor;
      holdStep = [];
      closeDiag(cursor);
      inChapter = false;
    },

    step(title, text, o = {}) {
      if (!inChapter) fail(`étape « ${title} » hors d’un chapitre`);
      const write = typeof text === 'function' ? text : null;
      const lazy = write != null;
      const dwell = o.dwell ?? (write ? LAZY_DWELL : dwellOf(text as string));
      const t = cursor;
      for (const s of holdStep) s.until = t;
      holdStep = [];
      // the diagram asked for since the last step starts here
      if (diag && (!diagOpen || diagOpen.name !== diag.name || diagOpen.arg !== diag.arg || diagOpen.big !== diag.big)) {
        closeDiag(t);
        diagOpen = { t0: t, ...diag };
      } else if (!diag && diagOpen) closeDiag(t);
      const cap: Caption = {
        t, kicker: part === chap ? part : `${part} · ${chap}`, title, text: write ? '' : (text as string), lazy,
        note: o.note ?? '', code: o.code ?? '', hud: o.hud ?? null, layers: o.layers ?? 0, tools: o.tools ?? [], dwell,
        claims: o.claims ?? [],
      };
      if (write) {
        // written on first reading, then kept
        let s: string | undefined;
        Object.defineProperty(cap, 'text', { enumerable: true, get: () => (s ??= write()) });
      }
      tl.caps.push(cap);
      last = { t, dwell, pauses: 0 };
      cursor = t + dwell;
      if (!started) {
        started = true;
        const first = course.modules.findIndex((m) => (m.kind ?? 'core') === 'core');
        card(-1, Math.max(0, first));
      }
    },

    diagram(name, opts = {}) { diag = name ? { name, ...opts } : null; },

    stage(scene, settings) {
      tl.scenes.push({ t: cursor, key: scene, patch: settings });
    },

    set(patch) { tl.sets.push({ t: cursor, patch }); },

    ask(id, question, choices, explain) {
      c.step(L.askTitle, L.askText, { dwell: 3 });
      c.question(id, question, choices, explain);
    },

    question(id, question, choices, explain, opt = {}) {
      if (choices.length < 2) fail(`question ${id} : au moins deux choix`);
      const pos = place++ % choices.length;
      const others = choices.slice(1);
      const shown = [...others.slice(0, pos), choices[0], ...others.slice(pos)];
      quizStop(id, { question, kind: 'choice', choices: shown, answer: pos, explain }, opt.review ?? kindOf(mod) !== 'exam');
    },

    numeric(id, question, value, explain, opt = {}) {
      quizStop(id, { question, kind: 'number', choices: [], answer: 0, value, unit: opt.unit, tol: opt.tol, explain }, opt.review ?? kindOf(mod) !== 'exam');
    },

    order(id, question, items, explain) {
      quizStop(id, { question, kind: 'order', choices: items, answer: 0, explain }, kindOf(mod) !== 'exam');
    },

    experiment(spec) {
      if (spec.goals?.length && !spec.predict && !spec.afterDiagnosis) fail(`expérience « ${spec.title} » : une prédiction est requise`);
      if (spec.goals?.length && !spec.conclusion) fail(`expérience « ${spec.title} » : une conclusion est requise`);
      const s = push({
        kind: 'try', id: uniq(spec.id ?? `try-${spec.title}`), title: spec.title, prompt: spec.prompt,
        controls: spec.controls ?? [], goals: spec.goals as Goal[] | undefined, seq: spec.seq, diag: spec.diag,
        predict: spec.predict, conclusion: spec.conclusion,
      });
      (spec.hold === 'step' ? holdStep : holdChapter).push(s);
    },

    explain(id, prompt, model) {
      push({ kind: 'explain', id: uniq(id), title: L.explainTitle, explain: { prompt, model } });
    },

    exercise(id, prompt) {
      push({ kind: 'lab', id: uniq(`lab-${id}`), title: 'Atelier', lab: id, prompt });
    },

    test(kind, prompt) {
      push({ kind: 'test', id: uniq(`test-${kind}`), title: kind === 'pre' ? 'Test de départ' : 'Test final', test: kind, prompt });
    },

    clinicCase(k) {
      c.chapter(`${k.exam ? L.examCase : L.clinicCase} : ${k.title}`, () => {
        c.stage(k.scene, k.fault);
        if (k.diagram) c.diagram(k.diagram);
        c.step(L.clinicObserve, k.observe, { note: L.clinicObserveNote });
        c.question(k.id, L.clinicQuestion, k.choices, k.explain, { review: !k.exam });
        c.step(L.clinicFix, L.clinicFixText);
        c.experiment({
          id: `${k.id}-fix`, title: L.clinicFixTitle, prompt: L.clinicFixPrompt, controls: k.controls,
          // the diagnosis question was the prediction: the experiment only checks the fix
          afterDiagnosis: true,
          goals: [{ label: k.goal.label, test: ({ v }) => k.goal.test(v) }], conclusion: k.conclusion,
        });
        tl.stops[tl.stops.length - 1].clinic = { id: k.id, fault: k.fault, symptom: k.symptom };
        c.step(L.clinicJustify, L.clinicJustifyText);
        c.explain(`${k.id}-why`, L.clinicJustifyPrompt, k.justify);
      });
    },
  };

  course.content(c);
  if (inChapter) fail('chapitre non fermé');
  // the course ends on the card of its last module
  if (last && mod >= 0) card(mod, null);
  tl.duration = cursor;

  // modules: chapters and spans
  tl.modules = course.modules.map((m, i) => {
    const chs = tl.chapters.map((ch, k) => ({ ch, k })).filter(({ ch }) => ch.module === i).map(({ k }) => k);
    const t0 = chs.length ? tl.chapters[chs[0]].t : 0;
    const lastCh = chs.length ? chs[chs.length - 1] : 0;
    const t1 = lastCh + 1 < tl.chapters.length ? tl.chapters[lastCh + 1].t : tl.duration;
    return { id: m.id, title: m.title, kind: m.kind ?? 'core', chapters: chs, t0, t1 };
  });
  tl.stops.sort((a, b) => a.t - b.t);
  for (const st of tl.stops) {
    st.module = tl.chapters[tl.chapterAt(st.t)]?.module ?? 0;
    if (st.quiz) st.quiz.module = st.module;
  }
  return tl;
}

/** Identity with type checking: `export default defineCourse({...})`. */
export const defineCourse = (def: CourseDef): CourseDef => def;
