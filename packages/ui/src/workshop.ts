// The workshop panel: the list of exercises, and for each kind its page.
//   code        — PRIMM (read, predict, run, investigate, modify) when the
//                 exercise has one, Parsons (put lines back in order) when
//                 asked, then the editor with hints, visible tests and curve;
//   calculation — a guided calculation, each step checked;
//   classify    — sort items into categories;
//   sequence    — put the steps of a process in order;
//   assembly    — every function the learner wrote, run together.
// Taken from avbd's course/lab.ts (the panel part); the solver it embedded
// is now the course's own business.

import type { Progress } from '@coursekit/core';
import { DH, DW, CC, axes, text } from '@coursekit/diagrams';
import {
  buildImpl, compile, primmDefinesSlot, verifyAssembly, verifyCalculation, verifyClassify, verifyCode, verifySequence,
  type CodeExercise, type Exercise, type Impl, type Verdict, type WorkshopConfig,
} from '@coursekit/exercises';
import { h, esc } from './dom.ts';
import { highlight } from './highlight.ts';
import { parseNum, renderQuiz } from './quiz.ts';

export interface WorkshopContext {
  exercises: Exercise[];
  cfg: WorkshopConfig;
  prog: Progress;
  moduleTitle(id: string): string;
}

/** Opens the workshop. `start`: an exercise id, or 'assembly'. */
export function openWorkshop(root: HTMLElement, x: WorkshopContext, onClose: () => void, start?: string): void {
  const { exercises: EX, cfg, prog } = x;
  const el = h('div', 'c-lab');
  let cur: number | 'assembly' = start === 'assembly' && cfg.assembly ? 'assembly' : EX.findIndex((c) => c.id === start);
  if (cur === -1) cur = Math.max(0, EX.findIndex((c) => !prog.d.code[c.id]?.done));
  let hintShown = 0;
  let raf = 0;
  let verdict: Verdict | null = null;
  let preview: ((ctx: CanvasRenderingContext2D, t: number) => void) | null = null;

  const list = h('div', 'lab-list');
  const mid = h('div', 'lab-mid');
  const right = h('div', 'lab-right');
  const cv = h('canvas', 'lab-canvas') as HTMLCanvasElement;
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = DW * dpr; cv.height = DH * dpr;
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const side = h('div', 'lab-sidebox');
  const chart = h('canvas', 'lab-chart hidden') as HTMLCanvasElement;
  chart.width = DW * dpr; chart.height = 120 * dpr;
  const cctx = chart.getContext('2d')!;
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  right.append(cv, side, chart);

  const closeBtn = h('button', 'home-x', '✕') as HTMLButtonElement;
  closeBtn.title = 'Fermer l’atelier (Échap)';
  closeBtn.onclick = () => done();

  const stage = (id: string) => prog.d.code[id]?.stage ?? 0;
  const setStage = (id: string, s: number) => prog.code(id, { stage: s });
  /** the learner's sources of the exercises they succeeded */
  const mySources = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const e of EX) if (e.kind === 'code' && !e.standalone && prog.d.code[e.id]?.done && prog.d.code[e.id]?.src) out[e.slot] = prog.d.code[e.id]!.src!;
    return out;
  };

  // ---------------------------------------------------------------- list
  const renderList = () => {
    list.replaceChildren(h('div', 'lab-listhead', 'Exercices'));
    let lastMod = '';
    EX.forEach((c, i) => {
      if (c.module !== lastMod) { list.append(h('div', 'lab-mod', esc(x.moduleTitle(c.module)))); lastMod = c.module; }
      const ok = prog.d.code[c.id]?.done;
      const b = h('button', `lab-item${i === cur ? ' on' : ''}${ok ? ' done' : ''}`) as HTMLButtonElement;
      const sub = c.kind === 'code' ? c.slot : { calculation: 'calcul guidé', classify: 'classement', sequence: 'mise en ordre' }[c.kind];
      b.innerHTML = `<span class="lab-n">${ok ? '✓' : i + 1}</span><span><b>${esc(c.title)}</b><small>${esc(sub)}</small></span>`;
      b.onclick = () => { cur = i; load(); };
      list.append(b);
    });
    if (cfg.assembly) {
      const eng = h('button', `lab-item engine${cur === 'assembly' ? ' on' : ''}${prog.d.code.assembly?.done ? ' done' : ''}`) as HTMLButtonElement;
      eng.innerHTML = `<span class="lab-n">${prog.d.code.assembly?.done ? '✓' : '★'}</span><span><b>${esc(cfg.assembly.title)}</b><small>toutes vos fonctions ensemble</small></span>`;
      eng.onclick = () => { cur = 'assembly'; load(); };
      list.append(eng);
    }
  };

  // ---------------------------------------------------------- preview loop
  const t0 = performance.now();
  const draw = () => {
    raf = requestAnimationFrame(draw);
    ctx.clearRect(0, 0, DW, DH);
    if (!preview) { text(ctx, 'pas d’aperçu pour cet exercice', DW / 2, DH / 2, CC.faint, 11, 'center'); return; }
    try { preview(ctx, (performance.now() - t0) / 1000); } catch (e: any) { ctx.clearRect(0, 0, DW, DH); text(ctx, `erreur : ${String(e?.message ?? e).slice(0, 60)}`, DW / 2, DH / 2, CC.red, 11, 'center'); }
  };
  const codePreview = (ex: CodeExercise, src: string | null) => {
    if (!ex.preview) { preview = null; return; }
    let fn: Function | null = null;
    const lib: Impl = buildImpl(EX, cfg);
    if (src) { try { fn = compile(src, ex, lib, EX, cfg); lib[ex.slot] = fn; } catch { fn = null; } }
    preview = (c, t) => ex.preview!(c, fn, lib, t);
  };

  const drawChart = () => {
    cctx.clearRect(0, 0, DW, 120);
    const ch = verdict?.chart;
    chart.classList.toggle('hidden', !ch || !ch.mine.length);
    if (!ch || !ch.mine.length) return;
    const x0 = 34, y0 = 14, w = DW - 50, hgt = 80;
    const vals = [...ch.mine, ...ch.ref].filter(Number.isFinite);
    const lo = Math.min(0, ...vals), hi = Math.max(1e-9, ...vals);
    axes(cctx, x0, y0, w, hgt, '', ch.label);
    const plot = (ys: number[], col: string) => {
      cctx.save(); cctx.strokeStyle = col; cctx.lineWidth = 1.6; cctx.beginPath();
      ys.forEach((y, i) => { const X = x0 + (i / Math.max(1, ys.length - 1)) * w, Y = y0 + hgt - ((Math.max(lo, Math.min(hi, y)) - lo) / (hi - lo)) * hgt; i ? cctx.lineTo(X, Y) : cctx.moveTo(X, Y); });
      cctx.stroke(); cctx.restore();
    };
    plot(ch.ref, CC.blue);
    plot(ch.mine, CC.acc);
    text(cctx, 'référence', DW - 14, y0 + 6, CC.blue, 10, 'right');
    text(cctx, 'votre code', DW - 14, y0 + 20, CC.acc, 10, 'right');
    text(cctx, `max ${String(+hi.toPrecision(3)).replace('.', ',')}${ch.unit ? ` ${ch.unit}` : ''}`, DW - 14, y0 + 34, CC.dim, 9.5, 'right');
  };

  const showResults = (box: HTMLElement, v: Verdict) => {
    box.replaceChildren();
    if (!v.results?.length) return;
    const ul = h('ul', 'lab-tests');
    for (const r of v.results) ul.append(h('li', r.ok ? 'ok' : 'ko', `<b>${esc(r.label)}</b> — ${esc(r.msg)}`));
    box.append(ul);
  };
  const success = (msg: HTMLElement, id: string) => {
    prog.code(id, { done: true });
    renderList();
    const nextI = typeof cur === 'number' ? cur + 1 : EX.length;
    if (nextI < EX.length) {
      const next = h('button', 'c-btn go', 'Exercice suivant ▶') as HTMLButtonElement;
      next.onclick = () => { cur = nextI; load(); };
      msg.append(' ', next);
    }
  };
  const hintsFor = (hints: string[]) => {
    const hintEl = h('div', 'lab-hints');
    const btn = h('button', 'c-btn', 'Un indice') as HTMLButtonElement;
    btn.disabled = !hints.length;
    btn.onclick = () => {
      if (hintShown >= hints.length) return;
      hintEl.append(h('p', undefined, `<b>Indice ${hintShown + 1}</b> ${esc(hints[hintShown])}`));
      hintShown++;
      if (hintShown >= hints.length) btn.disabled = true;
    };
    return { hintEl, btn };
  };

  // ---------------------------------------------------------------- page
  const load = () => {
    hintShown = 0;
    verdict = null;
    preview = null;
    renderList();
    mid.replaceChildren();
    side.replaceChildren();
    drawChart();
    if (cur === 'assembly') { loadAssembly(); cv.classList.toggle('hidden', !preview); return; }
    const ex = EX[cur];
    mid.append(h('div', 'lab-kicker', esc(`${x.moduleTitle(ex.module)} · exercice ${cur + 1} / ${EX.length}`)), h('h2', 'lab-title', esc(ex.title)));
    if (ex.kind === 'code') {
      const reading = (ex.primm || ex.parsons) && stage(ex.id) < 3 && !prog.d.code[ex.id]?.done;
      if (!reading) side.append(h('p', 'lab-side', ex.tests ? 'L’aperçu utilise votre fonction. « Vérifier » la passe sur une série de tests, tous affichés.' : 'L’aperçu utilise votre fonction. « Vérifier » rejoue les scénarios avec votre code et compare, échantillon par échantillon, avec la référence.'));
      if (ex.primm && stage(ex.id) < 3 && !prog.d.code[ex.id]?.done) loadPrimm(ex);
      else if (ex.parsons && stage(ex.id) < 3 && !prog.d.code[ex.id]?.done) loadParsons(ex);
      else loadEditor(ex);
    } else if (ex.kind === 'calculation') loadCalculation(ex);
    else if (ex.kind === 'classify') loadClassify(ex);
    else loadSequence(ex);
    // the preview frame only for exercises that have something to show
    cv.classList.toggle('hidden', ex.kind !== 'code' || !ex.preview);
  };

  /** PRIMM: read and predict, run and investigate, then modify. */
  const loadPrimm = (ex: CodeExercise) => {
    const p = ex.primm!;
    const s = stage(ex.id);
    mid.append(h('div', 'lab-steps', ['Lire et prédire', 'Exécuter et examiner', 'Modifier'].map((t, i) => `<span class="${i === Math.min(2, s) ? 'on' : i < s ? 'done' : ''}">${i + 1}. ${t}</span>`).join('')));
    mid.append(h('p', 'lab-goal', esc(p.intro)));
    const pre = h('pre', 'c-code');
    pre.innerHTML = highlight(p.code);
    mid.append(pre);
    const runsGiven = primmDefinesSlot(ex);
    const qBox = h('div', 'c-try');
    const next = h('button', 'c-btn go hidden') as HTMLButtonElement;
    mid.append(qBox, next);
    if (s === 0) {
      preview = null;
      renderQuiz(qBox, p.predict, { feedback: true, confidence: false, tag: 'Prédire', onDone: () => { next.classList.remove('hidden'); next.focus(); } });
      next.textContent = runsGiven ? 'Exécuter ce code ▶' : 'Continuer ▶';
      next.onclick = () => { setStage(ex.id, 1); load(); };
    } else {
      if (runsGiven) {
        side.append(h('p', 'lab-side', '<b>L’aperçu exécute le code donné.</b>'));
        codePreview(ex, p.code);
        if (!ex.tests) { verdict = verifyCode(ex, p.code, EX, cfg); drawChart(); }
      } else codePreview(ex, ex.solution);
      renderQuiz(qBox, p.investigate, { feedback: true, confidence: false, tag: 'Examiner', onDone: () => { next.classList.remove('hidden'); next.focus(); } });
      next.textContent = 'Passer à l’écriture ▶';
      next.onclick = () => {
        setStage(ex.id, 3);
        if (!prog.d.code[ex.id]?.src) prog.code(ex.id, { src: runsGiven ? p.code : ex.starter });
        load();
      };
    }
  };

  /** Parsons: put the solution's lines back in order. */
  const loadParsons = (ex: CodeExercise) => {
    const lines = ex.solution.split('\n');
    mid.append(h('p', 'lab-goal', esc(`${ex.goal} Les lignes sont mélangées : remettez-les dans l’ordre. L’indentation de chaque ligne est déjà la bonne.`)));
    const sig = h('div', 'lab-sig');
    sig.innerHTML = highlight(ex.sig);
    mid.append(sig, h('p', 'lab-doc', esc(ex.doc)));
    const fixedTop = lines[0], fixedEnd = lines[lines.length - 1];
    const body = lines.slice(1, -1);
    const order = body.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    if (order.every((v, i) => v === i) && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
    const ol = h('ol', 'lab-parsons');
    const msg = h('div', 'lab-msg');
    const res = h('div');
    const paint = () => {
      ol.replaceChildren(h('li', 'fixed', `<code>${esc(fixedTop)}</code>`));
      order.forEach((idx, pos) => {
        const li = h('li');
        const code = h('code');
        code.textContent = body[idx];
        const up = h('button', 'ord-b', '▲') as HTMLButtonElement;
        const dn = h('button', 'ord-b', '▼') as HTMLButtonElement;
        up.disabled = pos === 0; dn.disabled = pos === order.length - 1;
        up.onclick = () => { [order[pos - 1], order[pos]] = [order[pos], order[pos - 1]]; paint(); };
        dn.onclick = () => { [order[pos + 1], order[pos]] = [order[pos], order[pos + 1]]; paint(); };
        li.append(up, dn, code);
        ol.append(li);
      });
      ol.append(h('li', 'fixed', `<code>${esc(fixedEnd)}</code>`));
    };
    paint();
    const { hintEl, btn } = hintsFor(ex.hints);
    const check = h('button', 'c-btn go', 'Vérifier l’ordre ▶') as HTMLButtonElement;
    check.onclick = () => {
      const src = [fixedTop, ...order.map((i) => body[i]), fixedEnd].join('\n');
      const placedN = order.filter((idx, pos) => idx === pos).length;
      const v = verifyCode(ex, src, EX, cfg);
      verdict = v; drawChart();
      msg.className = `lab-msg ${v.ok ? 'ok' : 'bad'}`;
      if (v.ok) {
        msg.textContent = ex.win;
        prog.code(ex.id, { src, stage: 3 });
        success(msg, ex.id);
      } else {
        const why = v.msg.startsWith('Le code ne compile pas')
          ? 'Dans cet ordre, les lignes ne forment pas un programme valide : chaque bloc ouvert par « { » doit être fermé par « } » plus bas, après les lignes qu’il contient.'
          : v.msg;
        msg.textContent = `${placedN} ligne${placedN > 1 ? 's' : ''} sur ${body.length} ${placedN > 1 ? 'sont' : 'est'} à la bonne place. ${why}`;
      }
      showResults(res, v);
      codePreview(ex, src);
    };
    const actions = h('div', 'lab-actions');
    actions.append(check, btn);
    mid.append(ol, actions, msg, res, hintEl);
    codePreview(ex, ex.solution);
  };

  /** Writing: the editor, « Vérifier », hints, the solution. */
  const loadEditor = (ex: CodeExercise) => {
    const goal = ex.primm && stage(ex.id) >= 3 ? `${ex.primm.modify} ${ex.goal}` : ex.goal;
    mid.append(h('p', 'lab-goal', esc(goal)));
    const sig = h('div', 'lab-sig');
    sig.innerHTML = highlight(ex.sig);
    mid.append(sig, h('p', 'lab-doc', esc(ex.doc)));
    const editor = h('textarea', 'lab-editor') as HTMLTextAreaElement;
    editor.spellcheck = false;
    editor.value = prog.d.code[ex.id]?.src ?? (ex.parsons ? ex.solution : ex.starter);
    const msg = h('div', 'lab-msg');
    const res = h('div');
    const { hintEl, btn: hintBtn } = hintsFor(ex.hints);
    const runBtn = h('button', 'c-btn go', 'Vérifier ▶') as HTMLButtonElement;
    runBtn.title = 'Vérifier (Ctrl+Entrée)';
    const solBtn = h('button', 'c-btn ghost', 'Voir la solution') as HTMLButtonElement;
    const resetBtn = h('button', 'c-btn ghost', 'Repartir de zéro') as HTMLButtonElement;
    if (prog.d.code[ex.id]?.done) { msg.className = 'lab-msg ok'; msg.textContent = `Déjà réussi. ${ex.win}`; }
    editor.addEventListener('input', () => { prog.code(ex.id, { src: editor.value }); codePreview(ex, editor.value); });
    editor.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); runBtn.click(); }
      if (ev.key === 'Tab') { ev.preventDefault(); const s = editor.selectionStart; editor.setRangeText('  ', s, editor.selectionEnd, 'end'); }
      if (ev.key === 'Escape') { ev.preventDefault(); done(); }
    });
    runBtn.onclick = () => {
      prog.code(ex.id, { src: editor.value });
      const v = verifyCode(ex, editor.value, EX, cfg);
      verdict = v; drawChart();
      msg.className = `lab-msg ${v.ok ? 'ok' : 'bad'}`;
      msg.textContent = v.msg;
      showResults(res, v);
      if (v.ok) success(msg, ex.id);
    };
    solBtn.onclick = () => {
      if (!confirm('Afficher la solution de cet exercice ? Essayez d’abord les indices : chercher, même sans trouver, aide à retenir.')) return;
      editor.value = ex.solution;
      prog.code(ex.id, { src: editor.value });
      codePreview(ex, editor.value);
    };
    resetBtn.onclick = () => {
      editor.value = ex.primm && primmDefinesSlot(ex) ? ex.primm.code : ex.parsons ? ex.solution : ex.starter;
      prog.code(ex.id, { src: editor.value });
      codePreview(ex, editor.value);
    };
    const actions = h('div', 'lab-actions');
    actions.append(runBtn, hintBtn, solBtn, resetBtn);
    if (ex.primm) {
      const again = h('button', 'c-link', 'Revoir le code donné') as HTMLButtonElement;
      again.onclick = () => { setStage(ex.id, 0); load(); };
      actions.append(again);
    }
    mid.append(editor, actions, msg, res, hintEl);
    codePreview(ex, editor.value);
    setTimeout(() => editor.focus(), 50);
  };

  // ------------------------------------------------------- other kinds

  const loadCalculation = (ex: Extract<Exercise, { kind: 'calculation' }>) => {
    mid.append(h('p', 'lab-goal', esc(ex.intro)));
    const saved = (prog.d.code[ex.id]?.answer as (number | null)[] | undefined) ?? [];
    const inputs: HTMLInputElement[] = [];
    const ol = h('ol', 'lab-calc');
    ex.steps.forEach((s, i) => {
      const li = h('li');
      li.append(h('p', undefined, esc(s.prompt)));
      const row = h('div', 'quiz-num');
      const inp = h('input') as HTMLInputElement;
      inp.type = 'text'; inp.inputMode = 'decimal'; inp.placeholder = 'votre résultat';
      if (saved[i] != null) inp.value = String(saved[i]).replace('.', ',');
      inp.addEventListener('keydown', (ev) => ev.stopPropagation());
      inputs.push(inp);
      row.append(inp, h('span', 'quiz-unit', esc(s.unit ?? '')));
      li.append(row, h('p', 'lab-expl hidden', esc(s.explain)));
      ol.append(li);
    });
    const msg = h('div', 'lab-msg');
    const res = h('div');
    const check = h('button', 'c-btn go', 'Vérifier ▶') as HTMLButtonElement;
    check.onclick = () => {
      const ans = inputs.map((i) => { const v = parseNum(i.value); return Number.isFinite(v) ? v : null; });
      prog.code(ex.id, { answer: ans });
      const v = verifyCalculation(ex, ans);
      msg.className = `lab-msg ${v.ok ? 'ok' : 'bad'}`;
      msg.textContent = v.msg;
      v.results!.forEach((r, i) => { inputs[i].classList.toggle('is-right', r.ok); inputs[i].classList.toggle('is-wrong', !r.ok); });
      ol.querySelectorAll('.lab-expl').forEach((p, i) => p.classList.toggle('hidden', !!v.results![i].ok && !v.ok));
      if (v.ok) ol.querySelectorAll('.lab-expl').forEach((p) => p.classList.remove('hidden'));
      showResults(res, v);
      if (v.ok) success(msg, ex.id);
    };
    const actions = h('div', 'lab-actions');
    actions.append(check);
    mid.append(ol, actions, msg, res);
    side.append(h('p', 'lab-side', 'Faites chaque calcul, puis vérifiez. L’explication d’une étape s’affiche quand son résultat est faux, et toutes les explications quand tout est juste.'));
  };

  const loadClassify = (ex: Extract<Exercise, { kind: 'classify' }>) => {
    mid.append(h('p', 'lab-goal', esc(ex.intro)));
    const saved = (prog.d.code[ex.id]?.answer as (number | null)[] | undefined) ?? [];
    const answers: (number | null)[] = ex.items.map((_, i) => saved[i] ?? null);
    const tbl = h('div', 'lab-classify');
    const paint = () => {
      tbl.replaceChildren();
      ex.items.forEach((it, i) => {
        const row = h('div', 'cls-row');
        row.append(h('span', 'cls-item', esc(it.text)));
        const seg = h('div', 'try-seg');
        ex.categories.forEach((c, k) => {
          const b = h('button', answers[i] === k ? 'on' : undefined, esc(c)) as HTMLButtonElement;
          b.onclick = () => { answers[i] = k; paint(); };
          seg.append(b);
        });
        row.append(seg);
        tbl.append(row);
      });
    };
    paint();
    const msg = h('div', 'lab-msg');
    const res = h('div');
    const check = h('button', 'c-btn go', 'Vérifier ▶') as HTMLButtonElement;
    check.onclick = () => {
      prog.code(ex.id, { answer: answers });
      const v = verifyClassify(ex, answers);
      msg.className = `lab-msg ${v.ok ? 'ok' : 'bad'}`;
      msg.textContent = v.msg;
      showResults(res, { ...v, results: v.results!.filter((r) => !r.ok) });
      if (v.ok) success(msg, ex.id);
    };
    const actions = h('div', 'lab-actions');
    actions.append(check);
    mid.append(tbl, actions, msg, res);
  };

  const loadSequence = (ex: Extract<Exercise, { kind: 'sequence' }>) => {
    mid.append(h('p', 'lab-goal', esc(ex.intro)));
    const saved = prog.d.code[ex.id]?.answer as number[] | undefined;
    const order = saved?.length === ex.items.length ? saved.slice() : ex.items.map((_, i) => i);
    if (!saved) for (let i = order.length - 1; i > 0; i--) { const j = (i * 5 + 2) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    if (!saved && order.every((v, i) => v === i) && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
    const ol = h('ol', 'quiz-order');
    const paint = () => {
      ol.replaceChildren();
      order.forEach((idx, pos) => {
        const li = h('li');
        const lab = h('span');
        lab.textContent = ex.items[idx];
        const up = h('button', 'ord-b', '▲') as HTMLButtonElement;
        const dn = h('button', 'ord-b', '▼') as HTMLButtonElement;
        up.disabled = pos === 0; dn.disabled = pos === order.length - 1;
        up.onclick = () => { [order[pos - 1], order[pos]] = [order[pos], order[pos - 1]]; paint(); };
        dn.onclick = () => { [order[pos + 1], order[pos]] = [order[pos], order[pos + 1]]; paint(); };
        li.append(lab, up, dn);
        ol.append(li);
      });
    };
    paint();
    const msg = h('div', 'lab-msg');
    const check = h('button', 'c-btn go', 'Vérifier l’ordre ▶') as HTMLButtonElement;
    check.onclick = () => {
      prog.code(ex.id, { answer: order.slice() });
      const v = verifySequence(ex, order);
      msg.className = `lab-msg ${v.ok ? 'ok' : 'bad'}`;
      msg.textContent = v.ok ? `${v.msg} ${ex.explain}` : v.msg;
      if (v.ok) success(msg, ex.id);
    };
    const actions = h('div', 'lab-actions');
    actions.append(check);
    mid.append(ol, actions, msg);
  };

  // ------------------------------------------------------- assembly page
  const loadAssembly = () => {
    const a = cfg.assembly!;
    mid.append(h('div', 'lab-kicker', 'Atelier'), h('h2', 'lab-title', esc(a.title)), h('p', 'lab-goal', esc(a.intro)));
    const codeEx = EX.filter((e): e is CodeExercise => e.kind === 'code' && !e.standalone);
    const tbl = h('table', 'lab-engine');
    tbl.append(h('tr', undefined, '<th>Fonction</th><th>Exercice</th><th>Utilisée</th>'));
    for (const e of codeEx) {
      const yours = !!prog.d.code[e.id]?.done;
      tbl.append(h('tr', yours ? 'yours' : '', `<td><code>${esc(e.slot)}</code></td><td>${esc(e.title)}</td><td>${yours ? 'la vôtre ✓' : 'la référence'}</td>`));
    }
    const n = codeEx.filter((e) => prog.d.code[e.id]?.done).length;
    mid.append(tbl, h('p', 'lab-doc', `${n} fonction${n > 1 ? 's' : ''} sur ${codeEx.length} écrite${n > 1 ? 's' : ''} par vous.`));
    const msg = h('div', 'lab-msg');
    const res = h('div');
    const run = h('button', 'c-btn go', 'Vérifier ▶') as HTMLButtonElement;
    run.onclick = () => {
      const v = verifyAssembly(EX, cfg, mySources());
      verdict = v; drawChart();
      msg.className = `lab-msg ${v.ok ? 'ok' : 'bad'}`;
      msg.textContent = v.ok && v.mine.length < codeEx.length ? `${v.msg} Pour que ce soit entièrement votre modèle, réussissez aussi les exercices qui utilisent encore la référence.` : v.msg;
      showResults(res, v);
      if (v.ok && v.mine.length >= codeEx.length) { prog.code('assembly', { done: true }); renderList(); }
    };
    const actions = h('div', 'lab-actions');
    actions.append(run);
    mid.append(actions, msg, res);
    side.append(h('p', 'lab-side', 'L’aperçu fait fonctionner votre modèle. La courbe sous l’aperçu le compare à la référence.'));
    if (a.preview) {
      let impl: Impl | null = null;
      try { impl = buildImpl(EX, cfg, mySources()); } catch { impl = null; }
      preview = impl ? (c, t) => a.preview!(c, impl!, t) : null;
    }
  };

  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); done(); } };
  function done(): void {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey, true);
    el.remove();
    onClose();
  }

  const left = h('div', 'lab-left');
  left.append(list);
  const inner = h('div', 'lab-inner');
  inner.append(left, mid, right);
  el.append(inner, closeBtn);
  root.append(el);
  window.addEventListener('keydown', onKey, true);
  load();
  draw();
}
