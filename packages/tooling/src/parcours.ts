// `coursekit parcours`: the course as the learner meets it, in reading order,
// as Markdown. Every step with what the screen shows next to it (the texts of
// the diagram, the stage scene and its read-out), every question with its
// answer, every experiment with its prediction, goals and conclusion, every
// clinic case, and the tests. A reviewer — a person, or an agent that knows
// nothing else of the course — reads it in one go: an answer printed on the
// diagram, a scene that shows another chapter, an easy point asked three
// times or a hard one said in passing stand out on the page.

import { compile, labelsFor, type CourseDef, type QuizSpec, type Stop, type TestItem } from '@coursekit/core';
import type { Exercise } from '@coursekit/exercises';
import { screenReader, textOf, type SceneLike } from './screen.ts';

const MAX_TEXTS = 600;
const clip = (s: string) => (s.length > MAX_TEXTS ? `${s.slice(0, MAX_TEXTS - 1)}…` : s);
/** The texts of a picture, without its axis ticks (bare short numbers). */
const quote = (texts: string[]) => clip(texts.filter((t) => !/^[−+-]?[\d\s\u202f,.]{1,6}$/.test(t)).map((t) => `« ${t} »`).join(' · '));
const num = (x: number | undefined) => (x === undefined ? '' : String(Number(x.toPrecision(4))).replace('.', ','));

function choices(q: { choices: string[]; answer: number }): string[] {
  return q.choices.map((c, i) => `- ${i === q.answer ? '✓' : '✗'} ${c}`);
}

function quiz(q: QuizSpec): string[] {
  if (q.kind === 'number') return [`Réponse : ${num(q.value)}${q.unit ? ` ${q.unit}` : ''}${q.tol !== undefined ? ` (tolérance ${num(q.tol)})` : ''}`];
  if (q.kind === 'order') return q.choices.map((c, i) => `${i + 1}. ${c}`);
  return choices(q);
}

function testItems(title: string, items: TestItem[] | undefined): string[] {
  if (!items?.length) return [];
  const out = [`### ${title}`, ''];
  for (const it of items) {
    out.push(`**${it.id}** (${it.skill}${it.pair ? `, jumelle de ${it.pair}` : ''}${it.tool ? `, fiche ${it.tool}` : ''}) : ${it.q.question}`, ...quiz(it.q), `> ${it.q.explain}`, '');
  }
  return out;
}

export function parcours(course: CourseDef & { exercises?: unknown[] }, scenes?: Record<string, SceneLike>): string {
  const tl = compile(course);
  const L = labelsFor(course.labels);
  const screen = screenReader(course, tl, scenes);
  const exercises = (course.exercises ?? []) as Exercise[];
  const out: string[] = [`# ${course.title}`, '', `> ${course.lead}`, ''];
  let lastDiag = '', lastScene = '', chapter = -1, module = -1;

  type Ev = { t: number; cap?: (typeof tl.caps)[number]; stop?: Stop };
  const events: Ev[] = [...tl.caps.map((cap): Ev => ({ t: cap.t, cap })), ...tl.stops.map((stop): Ev => ({ t: stop.t, stop }))].sort((a, b) => a.t - b.t || (a.cap ? -1 : 1));

  for (const ev of events) {
    const ci = tl.chapterAt(ev.t + 1e-6);
    if (ci !== chapter) {
      chapter = ci;
      const ch = tl.chapters[ci];
      if (ch.module !== module) {
        module = ch.module;
        const m = course.modules[module];
        out.push(`## Module ${module + 1} · ${m.title}`, '', `*${m.pitch}*`, '', `Objectifs : ${m.goals.join(' ; ')}.`, '');
      }
      out.push(`### ${ch.title}`, '');
      lastDiag = lastScene = '';
    }
    if (ev.cap) {
      const c = ev.cap;
      const s = screen.at(c.t + 0.01);
      const scene = s.scene ? `Scène ${s.scene.key}${s.scene.label ? ` (${s.scene.label})` : ''} : ${quote(s.scene.texts)}` : 'Scène : aucune';
      if (scene !== lastScene) { out.push(`*${scene}*`, ''); lastScene = scene; }
      const diag = s.diagram ? `Schéma ${s.diagram.name}${s.diagram.arg ? ` (${s.diagram.arg})` : ''} : ${quote(s.diagram.texts)}` : 'Schéma : aucun';
      if (diag !== lastDiag) { out.push(`*${diag}*`, ''); lastDiag = diag; }
      // the generic step before a question asked first is said by the question itself
      if (c.title === L.askTitle || c.title === L.reviewTitle) continue;
      out.push(`**Étape — ${c.title}${/[.?!…:]$/.test(c.title) ? '' : '.'}** ${textOf(c)}`);
      if (c.code) out.push('', '```', c.code, '```');
      if (c.note) out.push('', `> ${c.note}`);
      if (c.tools.length) out.push('', `Fiches : ${c.tools.join(', ')}.`);
      out.push('');
      continue;
    }
    const st = ev.stop!;
    const prev = tl.caps[tl.capAt(st.t)];
    if (st.kind === 'quiz' && st.quiz) {
      const first = prev?.title === L.askTitle ? ', posée avant l’explication' : '';
      out.push(`**Question ${st.id}${first}** : ${st.quiz.question}`, ...quiz(st.quiz), `> ${st.quiz.explain}`, '');
    } else if (st.kind === 'try') {
      out.push(`**Expérience — ${st.title}.** ${st.prompt ?? ''}`);
      if (st.predict) out.push(`Prédiction : ${st.predict.question}`, ...choices({ choices: st.predict.choices, answer: st.predict.answer ?? 0 }));
      if (st.controls.length) out.push(`Contrôles : ${st.controls.map((c) => `${c.label} (${c.type === 'choice' ? (c.options ?? []).map((o) => o.label).join(' / ') : c.type === 'toggle' ? 'oui / non' : `${c.min} à ${c.max}`})`).join(' ; ')}.`);
      if (st.goals?.length) out.push(`Objectifs${st.seq ? ' (dans l’ordre)' : ''} : ${st.goals.map((g) => g.label).join(' ; ')}.`);
      if (st.clinic) out.push(`Réglage fautif : ${Object.entries(st.clinic.fault).map(([k, v]) => `${k} = ${v}`).join(', ')}.`);
      if (st.conclusion) out.push(`> Conclusion : ${st.conclusion}`);
      out.push('');
    } else if (st.kind === 'explain' && st.explain) {
      out.push(`**Explication écrite ${st.id}** : ${st.explain.prompt}`, `> Réponse modèle : ${st.explain.model}`, '');
    } else if (st.kind === 'lab') {
      const ex = exercises.find((e) => e.id === st.lab);
      out.push(`**Atelier — ${ex ? `${ex.title} (${ex.kind})` : st.lab}.** ${st.prompt ?? ''}`);
      if (ex?.kind === 'calculation') {
        out.push(ex.intro, ...ex.steps.map((s, i) => `${i + 1}. ${s.prompt} → ${num(s.value)}${s.unit ? ` ${s.unit}` : ''}`));
      }
      out.push('');
    } else if (st.kind === 'test') {
      out.push(`**${st.title}.** ${st.prompt ?? ''} (questions en fin de document)`, '');
    } else if (st.kind === 'review') {
      out.push('*Révision : des questions des modules précédents reviennent.*', '');
    }
  }
  out.push('## Tests', '', ...testItems('Outils', course.tests?.tools), ...testItems('Test de départ', course.tests?.pre), ...testItems('Test final', course.tests?.post));
  return out.join('\n');
}
