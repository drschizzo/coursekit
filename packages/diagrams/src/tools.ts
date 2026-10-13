// Diagrams for the toolbox capsules: the mathematical tools courses rely on,
// each shown on the simplest possible example. Taken from avbd's
// course/diagrams5.ts. Most of them follow the
// pointer, so the learner can move a point and read the numbers change.

import { CC, DH, DW, alpha, arrow, axes, circle, clamp, dot, line, panel, text } from './draw.ts';
import type { DiagramEnv as DiagEnv } from '@coursekit/core';

type Ctx = CanvasRenderingContext2D;

const f2 = (x: number) => x.toFixed(1).replace('.', ',').replace('-0,0', '0,0');

/** A small grid with its origin at (ox, oy), `s` pixels per unit. */
function grid(ctx: Ctx, ox: number, oy: number, s: number): void {
  for (let x = ox % s; x < DW; x += s) line(ctx, x, 0, x, DH, CC.grid, 1);
  for (let y = oy % s; y < DH; y += s) line(ctx, 0, y, DW, y, CC.grid, 1);
  line(ctx, 0, oy, DW, oy, CC.faint, 1);
  line(ctx, ox, 0, ox, DH, CC.faint, 1);
}

/** The pointer in grid units, or a slow default motion when there is none. */
function pointer(e: DiagEnv, ox: number, oy: number, s: number, def: [number, number]): [number, number] {
  if (e.ptr) return [Math.round(((e.ptr.x - ox) / s) * 2) / 2, Math.round(((oy - e.ptr.y) / s) * 2) / 2];
  return def;
}

// ------------------------------------------------------------------ T1

function vectors(ctx: Ctx, e: DiagEnv): void {
  const ox = 70, oy = 190, s = 30;
  grid(ctx, ox, oy, s);
  const u: [number, number] = [3, 1];
  const v = pointer(e, ox + u[0] * s, oy - u[1] * s, s, [1 + Math.round(Math.sin(e.t * 0.6) * 2) / 2, 3]);
  const w: [number, number] = [u[0] + v[0], u[1] + v[1]];
  const P = (p: [number, number]) => [ox + p[0] * s, oy - p[1] * s] as const;
  arrow(ctx, ox, oy, ...P(u), CC.blue, 2.2);
  arrow(ctx, ...P(u), ...P(w), CC.acc, 2.2);
  arrow(ctx, ox, oy, ...P(w), CC.green, 2.2);
  text(ctx, `u = (${f2(u[0])} ; ${f2(u[1])})`, 14, 18, CC.blue, 11, 'left', true);
  text(ctx, `v = (${f2(v[0])} ; ${f2(v[1])})`, 14, 34, CC.acc, 11, 'left', true);
  text(ctx, `u + v = (${f2(w[0])} ; ${f2(w[1])})`, 14, 50, CC.green, 11, 'left', true);
  text(ctx, `longueur de u + v : ${Math.hypot(w[0], w[1]).toFixed(2).replace('.', ',')}`, 14, 66, CC.dim, 10.5, 'left', true);
  text(ctx, 'déplacez la souris : elle donne v', DW - 10, DH - 10, CC.dim, 10, 'right');
}

// ------------------------------------------------------------------ T2

function dotproj(ctx: Ctx, e: DiagEnv): void {
  const ox = 120, oy = 150, s = 34;
  grid(ctx, ox, oy, s);
  const ang = 0.45;
  const n: [number, number] = [Math.cos(ang), Math.sin(ang)];
  const p = pointer(e, ox, oy, s, [2.5 * Math.cos(e.t * 0.4) + 0.5, 1.6 * Math.sin(e.t * 0.5) + 1]);
  const d = p[0] * n[0] + p[1] * n[1];
  // the line carrying n
  line(ctx, ox - n[0] * 140, oy + n[1] * 140, ox + n[0] * 260, oy - n[1] * 260, alpha(CC.blue, 0.35), 1, [4, 4]);
  arrow(ctx, ox, oy, ox + n[0] * s, oy - n[1] * s, CC.blue, 2.4);
  text(ctx, 'n', ox + n[0] * s + 6, oy - n[1] * s - 8, CC.blue, 12, 'left', true);
  const P = [ox + p[0] * s, oy - p[1] * s] as const;
  const Q = [ox + d * n[0] * s, oy - d * n[1] * s] as const;
  arrow(ctx, ox, oy, ...P, CC.acc, 2);
  line(ctx, ...P, ...Q, CC.dim, 1, [3, 3]);
  line(ctx, ox, oy, ...Q, CC.green, 4);
  dot(ctx, ...P, CC.acc, 4);
  text(ctx, 'p', P[0] + 7, P[1] - 7, CC.acc, 12, 'left', true);
  text(ctx, `p · n = ${f2(p[0])}×${n[0].toFixed(2).replace('.', ',')} + ${f2(p[1])}×${n[1].toFixed(2).replace('.', ',')} = ${d.toFixed(2).replace('.', ',')}`, 12, 18, CC.fg, 11, 'left', true);
  text(ctx, 'en vert : la longueur de p dans la direction de n', 12, 34, CC.green, 10.5);
  text(ctx, d < 0 ? 'p · n < 0 : p pointe du côté opposé à n' : 'p · n > 0 : p pointe du côté de n', 12, 50, CC.dim, 10.5);
}

// ------------------------------------------------------------------ T3

function cross2d(ctx: Ctx, e: DiagEnv): void {
  const cx = 150, cy = 128, hw = 70, hh = 54;
  panel(ctx, cx - hw, cy - hh, hw * 2, hh * 2, CC.blue, alpha(CC.blue, 0.1), 6, 1.4);
  dot(ctx, cx, cy, CC.fg, 3.5);
  text(ctx, 'centre de masse', cx, cy + 14, CC.dim, 9.5, 'center');
  // the point of application on the left face, chosen with the pointer
  const yp = e.ptr ? clamp(e.ptr.y, cy - hh, cy + hh) : cy + Math.sin(e.t * 0.6) * hh * 0.9;
  const px = cx - hw;
  const F: [number, number] = [1, 0];
  const r: [number, number] = [(px - cx) / 50, (cy - yp) / 50];
  const tau = r[0] * F[1] - r[1] * F[0];
  arrow(ctx, px - 70, yp, px, yp, CC.pink, 2.6);
  text(ctx, 'F = (1 ; 0)', px - 70, yp - 12, CC.pink, 10.5, 'left', true);
  arrow(ctx, cx, cy, px, yp, CC.acc, 1.6);
  text(ctx, 'r', (cx + px) / 2, (cy + yp) / 2 - 9, CC.acc, 12, 'center', true);
  // the turning arrow, its size proportional to τ
  if (Math.abs(tau) > 0.01) {
    const R = 30 + Math.min(40, Math.abs(tau) * 40);
    const a0 = -Math.PI / 2, a1 = a0 + Math.sign(tau) * Math.min(2.4, Math.abs(tau) * 2.2);
    ctx.save();
    ctx.strokeStyle = CC.green; ctx.lineWidth = 2.2; ctx.beginPath();
    ctx.arc(cx, cy, R, -a0, -a1, tau > 0);
    ctx.stroke(); ctx.restore();
  }
  const x0 = 250;
  text(ctx, `r = (${r[0].toFixed(2).replace('.', ',')} ; ${r[1].toFixed(2).replace('.', ',')})`, x0, 40, CC.acc, 11, 'left', true);
  text(ctx, 'τ = rx·Fy − ry·Fx', x0, 66, CC.fg, 11, 'left', true);
  text(ctx, `  = ${tau.toFixed(2).replace('.', ',')}`, x0, 84, CC.fg, 11, 'left', true);
  text(ctx, Math.abs(tau) < 0.02 ? 'aucune rotation' : tau > 0 ? 'sens trigonométrique' : 'sens horaire', x0, 108, CC.green, 11);
  text(ctx, 'déplacez la souris de haut en bas', DW - 10, DH - 10, CC.dim, 10, 'right');
}

// ------------------------------------------------------------------ T4

function slope(ctx: Ctx, e: DiagEnv): void {
  const x0 = 40, y0 = 206, sx = 76, sy = 19;
  axes(ctx, x0, 26, DW - 60, 180, 't (s)', 'x (m)');
  const f = (t: number) => 0.5 * t * t + 0.5;          // x(t)
  const df = (t: number) => t;                          // x'(t)
  ctx.save(); ctx.strokeStyle = CC.blue; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 100; i++) { const t = (i / 100) * 4.1; const X = x0 + t * sx, Y = y0 - f(t) * sy; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.stroke(); ctx.restore();
  const t = e.ptr ? clamp((e.ptr.x - x0) / sx, 0.3, 3.2) : 1.8 + Math.sin(e.t * 0.5) * 1.3;
  const hstep = 0.8;
  const P = [x0 + t * sx, y0 - f(t) * sy] as const;
  const Q = [x0 + (t + hstep) * sx, y0 - f(t + hstep) * sy] as const;
  // the tangent, drawn over a fixed length
  const k = df(t);
  const dx = 1 / Math.hypot(1, (k * sy) / sx);
  const L = 70;
  line(ctx, P[0] - L * dx, P[1] + L * dx * (k * sy) / sx, P[0] + L * dx, P[1] - L * dx * (k * sy) / sx, CC.pink, 1.6);
  // the chord over one step
  line(ctx, ...P, ...Q, CC.acc, 1.4, [4, 3]);
  dot(ctx, ...P, CC.fg, 4); dot(ctx, ...Q, CC.acc, 3.5);
  text(ctx, `pente de la tangente (dérivée) : ${k.toFixed(2).replace('.', ',')} m/s`, 52, 24, CC.pink, 10.5);
  text(ctx, `pente moyenne sur h = 0,8 s : ${((f(t + hstep) - f(t)) / hstep).toFixed(2).replace('.', ',')} m/s`, 52, 40, CC.acc, 10.5);
  text(ctx, 'déplacez la souris le long de la courbe', DW - 10, DH - 8, CC.dim, 10, 'right');
}

// ------------------------------------------------------------------ T5

function energy(ctx: Ctx, e: DiagEnv): void {
  // a ball in a parabolic bowl, released from one side, without friction
  const cx = 130, by = 190, a = 0.012;
  ctx.save(); ctx.strokeStyle = CC.dim; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = -110; x <= 110; x += 2) { const X = cx + x, Y = by - a * x * x; x > -110 ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.stroke(); ctx.restore();
  const A = 95, w = 1.3;
  const x = A * Math.cos(e.t * w);
  const y = a * x * x;
  circle(ctx, cx + x, by - y - 8, 8, CC.acc, alpha(CC.acc, 0.35), 1.6);
  // energy bars: what the height loses, the speed gains
  const tot = a * A * A;
  const Ep = y, Ec = tot - Ep;
  const bx = 270, bw = 26, bh = 150;
  const bar = (i: number, val: number, col: string, lab: string) => {
    const hgt = (val / tot) * bh;
    panel(ctx, bx + i * 36, by - bh, bw, bh, CC.faint, null, 4, 1);
    panel(ctx, bx + i * 36, by - hgt, bw, Math.max(0.5, hgt), col, alpha(col, 0.4), 4, 1);
    text(ctx, lab, bx + i * 36 + bw / 2, by + 12, col, 10, 'center');
  };
  bar(0, Ep, CC.blue, 'Ep');
  bar(1, Ec, CC.pink, 'Ec');
  bar(2, Ep + Ec, CC.green, 'total');
  text(ctx, 'énergie potentielle (hauteur) et cinétique (vitesse)', 12, 18, CC.dim, 10.5);
}

// ------------------------------------------------------------------ T6

function newton1d(ctx: Ctx, e: DiagEnv): void {
  // f(x) = (x − 1)²/2 + 0.08·(x − 1)⁴ ; one Newton step shown at a time
  const f = (x: number) => 0.5 * (x - 1) ** 2 + 0.08 * (x - 1) ** 4;
  const d1 = (x: number) => (x - 1) + 0.32 * (x - 1) ** 3;
  const d2 = (x: number) => 1 + 0.96 * (x - 1) ** 2;
  const X = (x: number) => 30 + ((x + 1.2) / 5) * (DW - 60);
  const Y = (y: number) => 206 - y * 18;
  ctx.save(); ctx.strokeStyle = CC.blue; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 120; i++) { const x = -1.2 + (i / 120) * 5; i ? ctx.lineTo(X(x), Y(f(x))) : ctx.moveTo(X(x), Y(f(x))); }
  ctx.stroke(); ctx.restore();
  line(ctx, 30, 206, DW - 30, 206, CC.faint, 1);
  // iterates from x0 = 3.6
  const xs = [3.4];
  for (let k = 0; k < 4; k++) xs.push(xs[k] - d1(xs[k]) / d2(xs[k]));
  const k = Math.floor(e.t / 2.2) % 4;
  const x = xs[k];
  // the local parabola
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath();
  for (let i = 0; i <= 60; i++) { const u = x - 2 + (i / 60) * 4; const q = f(x) + d1(x) * (u - x) + 0.5 * d2(x) * (u - x) ** 2; const yy = Y(q); if (yy < 58 || u < -1.2) continue; ctx.lineTo(X(u), yy); }
  ctx.stroke(); ctx.restore();
  dot(ctx, X(x), Y(f(x)), CC.fg, 4);
  dot(ctx, X(xs[k + 1]), Y(f(xs[k + 1])), CC.green, 4);
  arrow(ctx, X(x), 218, X(xs[k + 1]), 218, CC.green, 1.6, 6);
  text(ctx, `étape ${k + 1} : x = ${x.toFixed(3).replace('.', ',')} → ${xs[k + 1].toFixed(3).replace('.', ',')}`, 12, 18, CC.fg, 11, 'left', true);
  text(ctx, 'en pointillés : la parabole de même pente et de même courbure', 12, 34, CC.acc, 10);
  text(ctx, 'le minimum est en x = 1', 12, 50, CC.dim, 10);
}

// ------------------------------------------------------------------ T7

function system2(ctx: Ctx, e: DiagEnv): void {
  // 2x + y = 5 and x − y = 1 : two lines crossing at (2, 1)
  const ox = 150, oy = 170, s = 34;
  grid(ctx, ox, oy, s);
  const L = (a: number, b: number, c: number, col: string, lab: string, ly: number) => {
    // a·x + b·y = c
    const pts: [number, number][] = [];
    for (const x of [-4, 7]) pts.push([x, (c - a * x) / b]);
    line(ctx, ox + pts[0][0] * s, oy - pts[0][1] * s, ox + pts[1][0] * s, oy - pts[1][1] * s, col, 2);
    text(ctx, lab, 12, ly, col, 11, 'left', true);
  };
  L(2, 1, 5, CC.blue, '2x + y = 5', 18);
  L(1, -1, 1, CC.acc, ' x − y = 1', 34);
  const pulse = 4 + Math.sin(e.t * 3) * 1.5;
  circle(ctx, ox + 2 * s, oy - 1 * s, pulse + 3, CC.green, alpha(CC.green, 0.3), 1.6);
  text(ctx, 'solution : x = 2, y = 1', ox + 2 * s - 14, oy - s + 20, CC.green, 11, 'right', true);
}

// ------------------------------------------------------------------ T8

const f32 = Math.fround;
const fmt32 = (v: number) => (Number.isInteger(v) ? v.toLocaleString('fr-FR') : String(+v.toPrecision(8)).replace('.', ','));

function float(ctx: Ctx, e: DiagEnv): void {
  // gap between neighbouring float32 values, against magnitude
  const x0 = 46, y0 = 40, w = DW - 66, hh = 72;
  axes(ctx, x0, y0, w, hh, '', '');
  text(ctx, 'écart entre deux flottants voisins', 14, 14, CC.dim, 10);
  text(ctx, 'taille du nombre →', x0 + 2, y0 + hh + 24, CC.faint, 9.5);
  const X = (lg: number) => x0 + ((lg + 3) / 10) * w;        // 1e-3 … 1e7
  const Y = (lg: number) => y0 + hh - ((lg + 10) / 11) * hh;  // 1e-10 … 1e1
  ctx.save(); ctx.strokeStyle = CC.blue; ctx.lineWidth = 1.8; ctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    const lg = -3 + i / 10;
    const v = 10 ** lg;
    const ulp = 2 ** (Math.floor(Math.log2(v)) - 23);
    i ? ctx.lineTo(X(lg), Y(Math.log10(ulp))) : ctx.moveTo(X(lg), Y(Math.log10(ulp)));
  }
  ctx.stroke(); ctx.restore();
  for (const [lg, l] of [[0, '1'], [3, '1 000'], [6, '10⁶']] as const) {
    line(ctx, X(lg), y0 + hh, X(lg), y0 + hh + 4, CC.dim, 1);
    text(ctx, l, X(lg), y0 + hh + 12, CC.faint, 9, 'center', true);
  }
  const lg = -2 + ((Math.sin(e.t * 0.35) + 1) / 2) * 8;
  const v = 10 ** lg, ulp = 2 ** (Math.floor(Math.log2(v)) - 23);
  dot(ctx, X(lg), Y(Math.log10(ulp)), CC.acc, 4);
  text(ctx, `près de ${v < 1 ? v.toPrecision(2).replace('.', ',') : Math.round(v).toLocaleString('fr-FR')} : pas plus fin que ${ulp.toExponential(1).replace('.', ',')}`, DW - 14, 28, CC.acc, 10, 'right', true);
  // three additions, computed in float32 right now
  const rows: [string, number, string][] = [
    ['1 000 + 0,00001', f32(f32(1000) + f32(1e-5)), 'le petit nombre disparaît'],
    ['(10⁸ − 10⁸) + 1', f32(f32(f32(1e8) - f32(1e8)) + f32(1)), ''],
    ['10⁸ + (−10⁸ + 1)', f32(f32(1e8) + f32(f32(-1e8) + f32(1))), 'même calcul, autre ordre'],
  ];
  rows.forEach(([lab, val, note], i) => {
    const y = 152 + i * 21;
    text(ctx, lab, 18, y, CC.fg, 10.5, 'left', true);
    text(ctx, `= ${fmt32(val)}`, 170, y, i === 0 || i === 2 ? CC.red : CC.green, 10.5, 'left', true);
    if (note) text(ctx, note, DW - 14, y, CC.dim, 9.5, 'right');
  });
  text(ctx, 'float32 : environ sept chiffres significatifs', DW / 2, DH - 10, CC.dim, 10, 'center');
}

/** The diagrams of the math toolbox (see ./capsules.ts). */
export const TOOL_DIAGRAMS = { vectors, dotproj, cross2d, slope, energy, newton1d, system2, float };
