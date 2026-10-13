// The epidemic course's diagrams. Each one runs the model with the current
// values: nothing is drawn from figures written by hand.

import { fr, pct, type DiagramEnv } from '@coursekit/core';
import { CC, DH, DW, alpha, arrow, axes, clamp, dot, line, panel, text } from '@coursekit/diagrams';
import { BASE, BEDS, DAYS, N, OUTCOME, epidemicOf, finalSize, generations, herdThreshold, r0Of, simulate } from './model.ts';

type Ctx = CanvasRenderingContext2D;

const verdictColor = (R: number) => (R < 1 ? CC.green : CC.red);

// ------------------------------------------------------------ 1. R0

/** R0 as the product of its three factors. */
function r0Diagram(ctx: Ctx, e: DiagramEnv): void {
  const c = e.v.contacts ?? BASE.contacts, p = e.v.p ?? BASE.p, d = e.v.dur ?? BASE.dur;
  const R = r0Of(e.v);
  const boxes: [string, string, string][] = [
    ['contacts', 'par jour', fr(c, 1)],
    ['probabilité', 'par contact', fr(p, 3)],
    ['durée', 'contagieuse (j)', fr(d, 1)],
  ];
  boxes.forEach(([a, b, val], i) => {
    const x = 14 + i * 92, y = 40;
    panel(ctx, x, y, 76, 70, CC.acc, alpha(CC.acc, 0.1));
    text(ctx, a, x + 38, y + 16, CC.dim, 10, 'center');
    text(ctx, b, x + 38, y + 29, CC.dim, 9, 'center');
    text(ctx, val, x + 38, y + 52, CC.fg, 15, 'center');
    text(ctx, i < 2 ? '×' : '=', x + 84, y + 35, CC.dim, 14, 'center');
  });
  panel(ctx, 290, 40, 76, 70, verdictColor(R), alpha(verdictColor(R), 0.12));
  text(ctx, 'R0', 328, 58, CC.dim, 11, 'center');
  text(ctx, fr(R, 2), 328, 86, CC.fg, 17, 'center');
  text(ctx, 'R0 : personnes contaminées par un malade', 14, 140, CC.dim, 10);
  text(ctx, 'dans une ville où personne n’est immunisé', 14, 154, CC.dim, 10);
  text(ctx, R < 1 ? 'R0 < 1 : chaque génération est plus petite, la maladie s’éteint' : 'R0 > 1 : chaque génération est plus grande, l’épidémie démarre', 14, 186, verdictColor(R), 10);
}

// ------------------------------------------------- 2. the generations

/** One case, then R cases, then R² …: the chain of transmission. */
function tree(ctx: Ctx, e: DiagramEnv): void {
  const R = r0Of(e.v);
  const G = 6;
  const gen = generations(R, G);
  const total = gen.reduce((s, x) => s + x, 0);
  const lit = Math.floor(e.t / 1.1) % (G + 3);
  const colW = 52, x0 = 34, base = 176;
  const maxDots = 24;
  gen.forEach((n, g) => {
    const x = x0 + g * colW;
    const on = g <= lit;
    const shown = Math.min(maxDots, Math.round(n));
    for (let k = 0; k < shown; k++) {
      const col = k % 4, row = Math.floor(k / 4);
      dot(ctx, x - 12 + col * 8, base - 8 - row * 8, on ? CC.acc : CC.faint, 3);
    }
    if (n > maxDots + 0.5) text(ctx, '…', x, base - 8 - 6 * 8 - 6, on ? CC.acc : CC.faint, 11, 'center');
    text(ctx, fr(n, n < 10 ? 1 : 0), x, base + 14, on ? CC.fg : CC.dim, 10, 'center');
    text(ctx, `g${g}`, x, base + 28, CC.dim, 9, 'center');
  });
  text(ctx, `R0 = ${fr(R, 2)} : chaque génération est ${fr(R, 2)} fois la précédente`, 14, 18, CC.fg, 11);
  text(ctx, `en ${G} générations : ${fr(total, total < 10 ? 1 : 0)} cas, à partir d’un seul`, 14, 34, CC.dim, 10);
}

// ------------------------------------------- 3. exponential growth

/** The first weeks of the epidemic, against a growth by the same number each day. */
function growth(ctx: Ctx, e: DiagramEnv): void {
  const ep = simulate({ contacts: e.v.contacts ?? BASE.contacts, p: e.v.p ?? BASE.p, dur: e.v.dur ?? BASE.dur, days: 40 });
  const I = ep.days.map((d) => d.I);
  const T = 40;
  const x0 = 50, y0 = 30, w = 250, h = 160;
  const top = Math.max(1000, ...I.slice(0, T + 1));
  axes(ctx, x0, y0, w, h, 'jours', 'contagieux');
  const X = (t: number) => x0 + (t / T) * w, Y = (v: number) => y0 + h - (clamp(v, 0, top) / top) * h;
  for (const t of [10, 20, 30]) text(ctx, String(t), X(t), y0 + h + 10, CC.dim, 9, 'center');
  text(ctx, fr(top), x0 - 4, Y(top), CC.dim, 9, 'right');
  // the same first-week increase, repeated every week: a linear growth
  const perDay = (I[7] - I[0]) / 7;
  line(ctx, X(0), Y(I[0]), X(T), Y(I[0] + perDay * T), CC.blue, 1.5, [4, 4]);
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  I.forEach((v, t) => (t ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v))));
  ctx.stroke(); ctx.restore();
  const tt = Math.floor(((e.t * 0.2) % 1) * T);
  dot(ctx, X(tt), Y(I[tt]), CC.fg, 3.5);
  const xr = 310;
  text(ctx, `jour ${tt}`, xr, 44, CC.fg, 10);
  text(ctx, `${fr(I[tt])}`, xr, 60, CC.acc, 11);
  text(ctx, 'contagieux', xr, 74, CC.dim, 9);
  text(ctx, 'au même', xr, 120, CC.blue, 9);
  text(ctx, 'rythme que', xr, 132, CC.blue, 9);
  text(ctx, 'la 1re semaine', xr, 144, CC.blue, 9);
  text(ctx, `jour 40 : ${fr(I[T])} contagieux, contre ${fr(I[0] + perDay * T)} à rythme constant`, 14, DH - 10, CC.dim, 10);
}

// ------------------------------------------------- 4. the three groups

/** S → I → R: the two flows of the model. */
function flows(ctx: Ctx, e: DiagramEnv): void {
  const boxes: [string, string, string][] = [['S', 'susceptibles', CC.blue], ['I', 'contagieux', CC.acc], ['R', 'rétablis', CC.green]];
  const lit = Math.floor(e.t / 1.4) % 5;
  boxes.forEach(([k, label, col], i) => {
    const x = 20 + i * 128, y = 70;
    panel(ctx, x, y, 84, 56, col, alpha(col, i <= lit ? 0.16 : 0.04));
    text(ctx, k, x + 42, y + 20, CC.fg, 16, 'center');
    text(ctx, label, x + 42, y + 41, CC.dim, 10, 'center');
  });
  arrow(ctx, 108, 98, 144, 98, lit >= 1 ? CC.fg : CC.faint, 1.6);
  arrow(ctx, 236, 98, 272, 98, lit >= 2 ? CC.fg : CC.faint, 1.6);
  text(ctx, 'infections', 126, 58, CC.dim, 9, 'center');
  text(ctx, 'guérisons', 254, 58, CC.dim, 9, 'center');
  text(ctx, 'par jour : β · I · S / N', DW / 2 - 70, 160, CC.fg, 10, 'center', true);
  text(ctx, 'par jour : I / durée', DW / 2 + 90, 160, CC.fg, 10, 'center', true);
  text(ctx, `β = contacts × probabilité = ${fr((e.v.contacts ?? BASE.contacts) * (e.v.p ?? BASE.p), 2)} par jour`, DW / 2, 192, CC.dim, 10, 'center');
  text(ctx, `S + I + R = ${fr(N)} habitants, à chaque instant`, DW / 2, 210, CC.dim, 10, 'center');
}

// ------------------------------------------------ 5. the SIR curves

/** S, I and R over the year, for the live values. */
function sir(ctx: Ctx, e: DiagramEnv): void {
  const ep = epidemicOf(e.v);
  const x0 = 46, y0 = 50, w = 300, h = 142;
  axes(ctx, x0, y0, w, h, 'jours', 'part de la ville');
  const X = (t: number) => x0 + (t / DAYS) * w, Y = (f: number) => y0 + h - f * h;
  for (const f of [0.5, 1]) { line(ctx, x0, Y(f), x0 + w, Y(f), CC.grid, 1); text(ctx, pct(f), x0 - 4, Y(f), CC.dim, 9, 'right'); }
  for (const t of [100, 200, 300]) text(ctx, String(t), X(t), y0 + h + 10, CC.dim, 9, 'center');
  const curve = (get: (d: (typeof ep.days)[number]) => number, col: string) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    ep.days.forEach((d, i) => (i ? ctx.lineTo(X(d.t), Y(get(d) / N)) : ctx.moveTo(X(d.t), Y(get(d) / N))));
    ctx.stroke(); ctx.restore();
  };
  curve((d) => d.S, CC.blue); curve((d) => d.I, CC.acc); curve((d) => d.R, CC.green);
  if (ep.outcome !== 'fizzle') {
    line(ctx, X(ep.peak.t), Y(0), X(ep.peak.t), Y(ep.peak.I / N), CC.dim, 1, [3, 3]);
    dot(ctx, X(ep.peak.t), Y(ep.peak.I / N), CC.fg, 3.5);
  }
  text(ctx, 'S susceptibles', x0, 12, CC.blue, 10); text(ctx, 'I contagieux', x0 + 98, 12, CC.acc, 10); text(ctx, 'R rétablis', x0 + 186, 12, CC.green, 10);
  text(ctx, ep.outcome === 'fizzle' ? `R0 = ${fr(ep.r0, 2)} : la maladie s’éteint` : `R0 = ${fr(ep.r0, 2)} · pic le jour ${fr(ep.peak.t)} : ${pct(ep.peak.I / N)} contagieux · ${pct(ep.attack)} infectés`, x0, 27, CC.fg, 10);
}

// ------------------------------------------------ 6. the final size

/** Share of the town infected in the end, for each R0. */
function final(ctx: Ctx, e: DiagramEnv): void {
  const R = r0Of(e.v);
  const x0 = 46, y0 = 34, w = 300, h = 156, RM = 5;
  axes(ctx, x0, y0, w, h, 'R0', 'infectés à la fin');
  const X = (r: number) => x0 + (r / RM) * w, Y = (f: number) => y0 + h - f * h;
  for (const f of [0.5, 1]) { line(ctx, x0, Y(f), x0 + w, Y(f), CC.grid, 1); text(ctx, pct(f), x0 - 4, Y(f), CC.dim, 9, 'right'); }
  for (const r of [1, 2, 3, 4]) text(ctx, String(r), X(r), y0 + h + 10, CC.dim, 9, 'center');
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  for (let r = 0; r <= RM + 1e-9; r += 0.05) { const yy = Y(finalSize(r)); r ? ctx.lineTo(X(r), yy) : ctx.moveTo(X(r), yy); }
  ctx.stroke(); ctx.restore();
  // the herd threshold, for comparison
  ctx.save(); ctx.strokeStyle = alpha(CC.blue, 0.8); ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]); ctx.beginPath();
  for (let r = 1; r <= RM + 1e-9; r += 0.05) { const yy = Y(herdThreshold(r)); r > 1 ? ctx.lineTo(X(r), yy) : ctx.moveTo(X(r), yy); }
  ctx.stroke(); ctx.restore();
  const z = finalSize(Math.min(R, RM));
  dot(ctx, X(Math.min(R, RM)), Y(z), CC.fg, 4);
  text(ctx, `R0 = ${fr(R, 2)} : ${pct(finalSize(R))} de la ville infectée, ${pct(1 - finalSize(R))} épargnée`, x0, 12, CC.fg, 10);
  text(ctx, 'en pointillés : le seuil 1 − 1/R0', x0 + w, y0 + h - 12, CC.blue, 9, 'right');
}

// ------------------------------------------------ 7. vaccination

/** The town as a bar: vaccinated, then the rest; the threshold 1 − 1/R0. */
function herd(ctx: Ctx, e: DiagramEnv): void {
  const R = r0Of(e.v), v = e.v.vax ?? 0;
  const th = herdThreshold(R);
  const reff = R * (1 - v);
  const x0 = 30, w = 320, y = 70, hh = 34;
  const X = (f: number) => x0 + f * w;
  ctx.fillStyle = alpha(CC.blue, 0.7); ctx.fillRect(X(0), y, X(v) - X(0), hh);
  ctx.fillStyle = alpha(CC.dim, 0.35); ctx.fillRect(X(v), y, X(1) - X(v), hh);
  line(ctx, X(th), y - 14, X(th), y + hh + 14, CC.fg, 1.5, [4, 3]);
  text(ctx, `seuil ${pct(th)}`, X(th), y - 22, CC.fg, 10, 'center');
  text(ctx, `vaccinés ${pct(v)}`, x0, y + hh + 26, CC.blue, 10);
  text(ctx, `non vaccinés ${pct(1 - v)}`, x0 + w, y + hh + 26, CC.dim, 10, 'right');
  text(ctx, `R0 = ${fr(R, 2)}   ·   R au départ = R0 × part non vaccinée = ${fr(reff, 2)}`, x0, 26, CC.fg, 10);
  const ep = epidemicOf(e.v);
  text(ctx, reff < 1 ? 'chaque malade contamine moins d’une personne' : 'chaque malade contamine plus d’une personne', x0, 170, verdictColor(reff), 10);
  text(ctx, `issue : ${OUTCOME[ep.outcome]} · ${pct(ep.attack)} de la ville infectée`, x0, 188, CC.dim, 10);
}

// --------------------------------------------- 8. the hospital beds

/** Beds needed over time, with and without the measures, against the capacity. */
function beds(ctx: Ctx, e: DiagramEnv): void {
  const ep = epidemicOf(e.v);
  const none = epidemicOf({ ...e.v, cut: 0 });
  const T = 150, x0 = 46, y0 = 50, w = 300, h = 140;
  const top = 1000;
  axes(ctx, x0, y0, w, h, 'jours', 'lits occupés');
  const X = (t: number) => x0 + (t / T) * w, Y = (b: number) => y0 + h - (clamp(b, 0, top) / top) * h;
  for (const b of [500, 1000]) text(ctx, fr(b), x0 - 4, Y(b), CC.dim, 9, 'right');
  for (const t of [50, 100]) text(ctx, String(t), X(t), y0 + h + 10, CC.dim, 9, 'center');
  line(ctx, x0, Y(BEDS), x0 + w, Y(BEDS), CC.red, 1.2, [5, 4]);
  text(ctx, `${fr(BEDS)} lits`, x0 + w, Y(BEDS) - 8, CC.red, 9, 'right');
  const curve = (ds: typeof ep.days, col: string, dash: number[] | null) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; if (dash) ctx.setLineDash(dash); ctx.beginPath();
    ds.filter((d) => d.t <= T).forEach((d, i) => (i ? ctx.lineTo(X(d.t), Y(d.beds)) : ctx.moveTo(X(d.t), Y(d.beds))));
    ctx.stroke(); ctx.restore();
  };
  curve(none.days, alpha(CC.dim, 0.8), [3, 4]);
  curve(ep.days, CC.acc, null);
  const cut = e.v.cut ?? 0, start = e.v.start ?? BASE.start;
  if (cut > 0 && start <= T) {
    line(ctx, X(start), y0, X(start), y0 + h, CC.blue, 1.2);
    text(ctx, `mesures j${fr(start)}`, X(start) + 4, y0 + 8, CC.blue, 9);
  }
  text(ctx, cut > 0 ? `contacts réduits de ${pct(cut)} à partir du jour ${fr(start)}` : 'aucune mesure', x0, 12, CC.fg, 10);
  text(ctx, `pic : ${fr(ep.peak.beds)} lits le jour ${fr(ep.peak.t)} · ${OUTCOME[ep.outcome]}`, x0, 27, ep.outcome === 'overflow' ? CC.red : CC.green, 10);
  text(ctx, 'en pointillés : sans mesures', x0 + w, DH - 8, CC.dim, 9, 'right');
}

export const DIAGRAMS = { r0: r0Diagram, tree, growth, flows, sir, final, herd, beds };
