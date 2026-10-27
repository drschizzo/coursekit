// The capsule viewer: a toolbox capsule over whatever is on screen, step by
// step, with its diagram and its two check questions. Taken from avbd's
// course/toolbox.ts.

import { tr, type Capsule, type DiagramEnv, type Glossary, type LabelSet } from '@coursekit/core';
import { DH, DW } from '@coursekit/diagrams';
import { esc, h } from './dom.ts';
import { highlight } from './highlight.ts';
import { renderQuiz } from './quiz.ts';

export interface CapsuleHooks { onDone(id: string): void; onClose(): void }

export function openCapsule(
  root: HTMLElement, cap: Capsule, glossary: Glossary, L: LabelSet,
  draw: (name: string, ctx: CanvasRenderingContext2D, env: DiagramEnv) => void, hooks: CapsuleHooks,
): () => void {
  const el = h('div', 'c-capsule');
  const box = h('div', 'cap-inner');
  el.append(box);
  root.append(el);

  let step = 0;
  let raf = 0;
  let ptr: { x: number; y: number } | null = null;
  const t0 = performance.now();

  const cv = h('canvas', 'cap-canvas') as HTMLCanvasElement;
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = DW * dpr; cv.height = DH * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cv.addEventListener('pointermove', (ev) => {
    const r = cv.getBoundingClientRect();
    ptr = { x: ((ev.clientX - r.left) / r.width) * DW, y: ((ev.clientY - r.top) / r.height) * DH };
  });
  cv.addEventListener('pointerleave', () => { ptr = null; });

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const s = cap.steps[step];
    if (!s?.diagram) return;
    ctx.clearRect(0, 0, DW, DH);
    draw(s.diagram, ctx, { t: (performance.now() - t0) / 1000, v: {}, ptr, hits: new Set() });
  };

  const close = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    el.remove();
    hooks.onClose();
  };
  const onKey = (ev: KeyboardEvent) => {
    const tgt = ev.target as HTMLElement | null;
    if (tgt && /INPUT|TEXTAREA/.test(tgt.tagName)) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
    if (ev.key === 'ArrowRight' && step < cap.steps.length) { ev.preventDefault(); ev.stopPropagation(); step++; paint(); }
    if (ev.key === 'ArrowLeft' && step > 0) { ev.preventDefault(); ev.stopPropagation(); step--; paint(); }
  };

  const paint = () => {
    box.replaceChildren();
    const x = h('button', 'home-x', '✕') as HTMLButtonElement;
    x.title = L.closeEsc;
    x.onclick = close;
    box.append(x, h('div', 'kicker', esc(L.toolbox)), h('h2', undefined, esc(cap.title)));
    const dots = h('div', 'cap-dots');
    for (let i = 0; i <= cap.steps.length; i++) {
      const d = h('button', i === step ? 'on' : i < step ? 'done' : '') as HTMLButtonElement;
      d.title = i < cap.steps.length ? cap.steps[i].title : L.checkStep;
      d.onclick = () => { step = i; paint(); };
      dots.append(d);
    }
    box.append(dots);
    if (step < cap.steps.length) {
      const s = cap.steps[step];
      if (step === 0) box.append(h('p', 'cap-goal', tr(L, 'capsuleGoal', { goal: glossary.rich(cap.goal), used: glossary.rich(cap.used) })));
      box.append(h('h3', undefined, esc(s.title)), h('p', 'cap-text', glossary.rich(s.text)));
      if (s.code) { const pre = h('pre', 'c-code'); pre.innerHTML = highlight(s.code); box.append(pre); }
      if (s.diagram) box.append(cv);
    } else {
      box.append(h('h3', undefined, esc(L.capsuleCheckTitle)));
      let ok = 0, answered = 0;
      const res = h('p', 'cap-res hidden');
      for (const q of cap.check) {
        const qEl = h('div', 'c-try cap-q');
        renderQuiz(qEl, q, L, {
          feedback: true, confidence: false, tag: L.exerciseTag,
          onDone: (r) => {
            answered++; if (r.ok) ok++;
            if (answered === cap.check.length) {
              if (ok === cap.check.length) hooks.onDone(cap.id);
              res.textContent = ok === cap.check.length ? L.capsuleAllRight : L.capsuleRetry;
              res.classList.remove('hidden');
            }
          },
        });
        box.append(qEl);
      }
      box.append(res);
    }
    const nav = h('div', 'card-foot');
    const prev = h('button', 'c-btn', esc(L.prev)) as HTMLButtonElement;
    prev.disabled = step === 0;
    prev.onclick = () => { step--; paint(); };
    const next = h('button', 'c-btn go', esc(step < cap.steps.length - 1 ? L.next : step === cap.steps.length - 1 ? L.checkNext : L.close)) as HTMLButtonElement;
    next.onclick = () => { if (step < cap.steps.length) { step++; paint(); } else close(); };
    nav.append(prev, next);
    box.append(nav);
  };

  window.addEventListener('keydown', onKey, true);
  paint();
  frame();
  return close;
}
