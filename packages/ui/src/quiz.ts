// One question, rendered anywhere: in the step panel, in a module review, in
// a toolbox capsule or in the start and end tests. Taken from avbd's
// course/quiz.ts. Three formats:
//   choice — pick one answer among several
//   number — type a value, checked within a tolerance
//   order  — put a list of steps back in order
// The learner can be asked how sure they were before the answer is shown:
// confidence is what decides when a question comes back for review.

import { h } from './dom.ts';
import type { Confidence, QuizSpec } from '@coursekit/core';

export type { Confidence, QuizSpec };

export interface QuizResult { ok: boolean; conf: Confidence | null; given: string }

export interface QuizOptions {
  /** show right/wrong and the explanation once answered (false for tests) */
  feedback: boolean;
  /** ask how sure the learner is before revealing the answer */
  confidence: boolean;
  /** keyboard shortcuts 1–4 are routed here by the caller */
  onDone(r: QuizResult): void;
  /** label of the small tag above the question */
  tag?: string;
  /** a short line under the tag */
  head?: string;
}

const CONF: { label: string; v: Confidence }[] = [
  { label: 'Sûr de moi', v: 2 },
  { label: 'J’hésitais', v: 1 },
  { label: 'Au hasard', v: 0 },
];

/** Deterministic shuffle (order questions must not depend on Math.random). */
function shuffled<T>(xs: T[], seed: number): T[] {
  const out = xs.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  // never start already sorted
  if (out.every((x, i) => x === xs[i]) && out.length > 1) [out[0], out[1]] = [out[1], out[0]];
  return out;
}

const hash = (s: string) => { let x = 7; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); };

export const parseNum = (s: string): number => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

export function fmtNum(v: number): string {
  return String(+v.toPrecision(6)).replace('.', ',');
}

/**
 * Renders the question into `el` and returns a function that answers choice
 * questions from the keyboard (index), or null when that does not apply.
 */
export function renderQuiz(el: HTMLElement, q: QuizSpec, opt: QuizOptions): { key(i: number): void } {
  el.replaceChildren();
  const head = h('div', 'try-head', `<span class="try-tag quiz">${opt.tag ?? 'Question'}</span>`);
  if (opt.head) head.append(opt.head);
  const p = h('p', 'quiz-q');
  p.textContent = q.question;
  const body = h('div', 'quiz-body');
  const confRow = h('div', 'quiz-conf hidden');
  const fb = h('div', 'quiz-fb hidden');
  el.append(head, p, body, confRow, fb);

  let given = '';
  let ok = false;
  let locked = false;
  let onReveal: (() => void) | null = null;

  const reveal = (conf: Confidence | null) => {
    confRow.classList.add('hidden');
    onReveal?.();
    if (opt.feedback) {
      fb.replaceChildren();
      const b = h('b', undefined, ok ? 'Bonne réponse.' : 'Ce n’est pas la bonne réponse.');
      const t = h('p');
      t.textContent = q.explain;
      fb.append(b, t);
      if (!ok && conf === 2) fb.append(h('p', 'quiz-warn', 'Vous étiez sûr de vous : cette question vous sera reposée plus tard.'));
      fb.classList.remove('hidden');
      requestAnimationFrame(() => fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
    opt.onDone({ ok, conf, given });
  };

  const submit = (isOk: boolean, txt: string, revealFn: () => void) => {
    if (locked) return;
    locked = true;
    ok = isOk; given = txt; onReveal = revealFn;
    if (!opt.confidence) { reveal(null); return; }
    confRow.replaceChildren(h('span', undefined, 'Avant de voir la correction : quel était votre degré de certitude ?'));
    for (const c of CONF) {
      const b = h('button', 'c-btn', c.label) as HTMLButtonElement;
      b.onclick = () => reveal(c.v);
      confRow.append(b);
    }
    confRow.classList.remove('hidden');
    requestAnimationFrame(() => confRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  let key = (_i: number) => {};

  if (q.kind === 'choice') {
    const list = h('div', 'quiz-choices');
    const btns = q.choices.map((txt, i) => {
      const b = h('button', 'quiz-choice', `<kbd>${i + 1}</kbd>`) as HTMLButtonElement;
      b.append(txt);
      b.onclick = () => pick(i);
      list.append(b);
      return b;
    });
    const pick = (i: number) => {
      if (locked) return;
      btns.forEach((b, k) => { b.disabled = true; b.classList.toggle('picked', k === i); });
      submit(i === q.answer, q.choices[i], () => {
        if (!opt.feedback) return;
        btns.forEach((b, k) => { if (k === q.answer) b.classList.add('is-right'); else if (k === i) b.classList.add('is-wrong'); });
      });
    };
    key = (i) => { if (i < q.choices.length) pick(i); };
    body.append(list);
  } else if (q.kind === 'number') {
    const row = h('div', 'quiz-num');
    const inp = h('input') as HTMLInputElement;
    inp.type = 'text'; inp.inputMode = 'decimal'; inp.placeholder = 'votre réponse';
    const unit = h('span', 'quiz-unit', q.unit ?? '');
    const go = h('button', 'c-btn', 'Valider') as HTMLButtonElement;
    const send = () => {
      const v = parseNum(inp.value);
      if (!Number.isFinite(v)) { inp.classList.add('bad'); inp.focus(); return; }
      inp.disabled = true; go.disabled = true;
      const tol = q.tol ?? Math.max(1e-9, Math.abs(q.value ?? 0) * 0.02);
      submit(Math.abs(v - (q.value ?? 0)) <= tol, inp.value, () => {
        if (!opt.feedback) return;
        inp.classList.add(ok ? 'is-right' : 'is-wrong');
        if (!ok) row.append(h('span', 'quiz-expected', `réponse attendue : ${fmtNum(q.value ?? 0)}${q.unit ? ` ${q.unit}` : ''}`));
      });
    };
    go.onclick = send;
    inp.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') { ev.preventDefault(); send(); } });
    inp.addEventListener('input', () => inp.classList.remove('bad'));
    row.append(inp, unit, go);
    body.append(row);
    setTimeout(() => inp.focus(), 30);
  } else {
    // order: up / down buttons, then « Valider l'ordre »
    let items = shuffled(q.choices.map((_, i) => i), hash(q.question));
    const list = h('ol', 'quiz-order');
    const go = h('button', 'c-btn', 'Valider l’ordre') as HTMLButtonElement;
    const paint = () => {
      list.replaceChildren();
      items.forEach((idx, pos) => {
        const li = h('li');
        const lab = h('span');
        lab.textContent = q.choices[idx];
        const up = h('button', 'ord-b', '▲') as HTMLButtonElement;
        const dn = h('button', 'ord-b', '▼') as HTMLButtonElement;
        up.title = 'Monter'; dn.title = 'Descendre';
        up.disabled = locked || pos === 0;
        dn.disabled = locked || pos === items.length - 1;
        up.onclick = () => { [items[pos - 1], items[pos]] = [items[pos], items[pos - 1]]; paint(); };
        dn.onclick = () => { [items[pos + 1], items[pos]] = [items[pos], items[pos + 1]]; paint(); };
        if (locked && opt.feedback) li.classList.add(idx === pos ? 'is-right' : 'is-wrong');
        li.append(lab, up, dn);
        list.append(li);
      });
    };
    go.onclick = () => {
      go.disabled = true;
      submit(items.every((idx, pos) => idx === pos), items.map((i) => i + 1).join('-'), () => {
        paint();
        if (!opt.feedback || ok) return;
        const sol = h('ol', 'quiz-order sol');
        for (const c of q.choices) sol.append(h('li', undefined, escape(c)));
        body.append(h('p', 'quiz-expected', 'Ordre attendu :'), sol);
      });
      paint();
    };
    paint();
    body.append(list, go);
  }
  return { key: (i) => key(i) };
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
