// The rocket course's diagrams. Each one runs the model with the current
// values: nothing is drawn from figures written by hand.

import { fr, type DiagramEnv } from '@coursekit/core';
import { CC, DH, DW, alpha, arrow, axes, circle, clamp, dot, line, panel, text } from '@coursekit/diagrams';
import {
  G0, GM, LAUNCHER, OUTCOME, R_EARTH, coast, flightOf, liftoffMass, orbitalSpeed, rho, rocketOf, singleStage,
  stageDeltaV, verticalStepRef, type Vertical,
} from './model.ts';

type Ctx = CanvasRenderingContext2D;


/** A small rocket drawn at (x, y) (its base), pointing at angle `a` from vertical. */
function rocketIcon(ctx: Ctx, x: number, y: number, h: number, a = 0, flame = 0): void {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(a);
  const w = h * 0.22;
  if (flame > 0) {
    ctx.fillStyle = alpha(CC.acc, 0.85);
    ctx.beginPath(); ctx.moveTo(-w * 0.4, 0); ctx.lineTo(0, h * 0.5 * flame); ctx.lineTo(w * 0.4, 0); ctx.fill();
  }
  ctx.fillStyle = '#d9deea';
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -h * 0.8); ctx.lineTo(0, -h); ctx.lineTo(w / 2, -h * 0.8); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = CC.blue;
  ctx.fillRect(-w / 2, -h * 0.36, w, h * 0.05);
  ctx.restore();
}

// ------------------------------------------------------- 1. the forces

/** Thrust and weight at lift-off, and their comparison. */
function forces(ctx: Ctx, e: DiagramEnv): void {
  const r = rocketOf(e.v);
  const m = liftoffMass(r);
  const F = r.stages[0].thrust * (e.v.thrust ?? 1);
  const W = m * G0;
  const twr = F / W;
  const cx = 120, base = 168;
  const k = 70 / 5e6; // pixels per newton
  const lift = twr > 1 ? ((e.t * 0.6) % 1.6) * (twr - 1) * 30 : 0;
  line(ctx, 30, base + 4, 210, base + 4, CC.dim, 1.5);
  rocketIcon(ctx, cx, base - lift, 92, 0, twr > 1 ? 1 : 0.6);
  arrow(ctx, cx + 30, base - 40 - lift, cx + 30, base - 40 - lift - F * k, CC.acc, 2.4);
  arrow(ctx, cx - 30, base - 40 - lift, cx - 30, base - 40 - lift + W * k, CC.pink, 2.4);
  text(ctx, 'poussée', cx + 36, base - 50 - lift - F * k, CC.acc, 10);
  text(ctx, 'poids', cx - 36, base - 30 - lift + W * k, CC.pink, 10, 'right');
  const x0 = 236;
  text(ctx, `masse ${fr(m / 1000)} t`, x0, 30, CC.fg, 11);
  text(ctx, `poids m·g = ${fr(W / 1e6, 2)} MN`, x0, 52, CC.pink, 11);
  text(ctx, `poussée = ${fr(F / 1e6, 2)} MN`, x0, 74, CC.acc, 11);
  text(ctx, `poussée / poids = ${fr(twr, 2)}`, x0, 104, CC.fg, 12);
  text(ctx, twr > 1 ? 'la fusée décolle' : 'la fusée reste au sol', x0, 126, twr > 1 ? CC.green : CC.red, 11);
  text(ctx, `accélération ${fr(Math.max(0, F / m - G0), 1)} m/s²`, x0, 148, CC.dim, 10);
}

// ------------------------------------------------- 2. a vertical climb

/** Speed and altitude of the first stage flying straight up, without air. */
function climb(ctx: Ctx, e: DiagramEnv): void {
  const st = { ...LAUNCHER.stages[0], thrust: LAUNCHER.stages[0].thrust * (e.v.thrust ?? 1) };
  const upper = LAUNCHER.stages.slice(1).reduce((s, x) => s + x.dry + x.fuel, 0) + (e.v.payload ?? LAUNCHER.payload);
  const s: Vertical = { h: 0, v: 0, m: st.dry + st.fuel + upper };
  const mf = st.dry + upper;
  const pts: { t: number; v: number; a: number; m: number }[] = [];
  for (let i = 0; s.m > mf && i < 4000; i++) {
    if (i % 10 === 0) pts.push({ t: i * 0.1, v: s.v, a: st.thrust / s.m - G0, m: s.m });
    verticalStepRef(s, 0.1, st.thrust, st.ve, G0);
    if (s.h < 0) { s.h = 0; s.v = 0; }
  }
  const x0 = 46, y0 = 22, w = 230, h = 170;
  axes(ctx, x0, y0, w, h, 't (s)', 'vitesse (m/s)');
  const T = 200, V = 3000;
  const X = (t: number) => x0 + (t / T) * w, Y = (v: number) => y0 + h - (v / V) * h;
  for (const vv of [1000, 2000, 3000]) { line(ctx, x0, Y(vv), x0 + w, Y(vv), CC.grid, 1); text(ctx, fr(vv), x0 - 4, Y(vv), CC.dim, 9, 'right'); }
  for (const tt of [50, 100]) text(ctx, String(tt), X(tt), y0 + h + 10, CC.dim, 9, 'center');
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p.v)) : ctx.moveTo(X(p.t), Y(p.v))));
  ctx.stroke(); ctx.restore();
  if (!pts.length || pts[pts.length - 1].v <= 0) { text(ctx, 'la poussée ne dépasse pas le poids', x0 + 20, y0 + h / 2, CC.red, 11); return; }
  const p = pts[Math.floor(((e.t * 0.25) % 1) * (pts.length - 1))];
  dot(ctx, X(p.t), Y(p.v), CC.fg, 3.5);
  const xr = 290;
  text(ctx, `t = ${fr(p.t)} s`, xr, 40, CC.fg, 10);
  text(ctx, `masse ${fr(p.m / 1000)} t`, xr, 60, CC.dim, 10);
  text(ctx, `accélération`, xr, 84, CC.dim, 10);
  text(ctx, `${fr(p.a, 1)} m/s²`, xr, 98, CC.acc, 11);
  text(ctx, 'plus la fusée', xr, 130, CC.dim, 9);
  text(ctx, 's’allège, plus', xr, 142, CC.dim, 9);
  text(ctx, 'elle accélère', xr, 154, CC.dim, 9);
}

// ---------------------------------------------------- 3. Tsiolkovsky

/** Δv = ve·ln(m0/mf): the speed gained for each mass ratio. */
function tsiolkovskyPlot(ctx: Ctx, e: DiagramEnv): void {
  const ve = e.v.ve ?? 3000;
  const R = clamp(e.v.ratio ?? 4, 1, 20);
  const x0 = 46, y0 = 22, w = 300, h = 170;
  axes(ctx, x0, y0, w, h, 'm0 / mf', 'Δv (km/s)');
  const RM = 20, VM = 10;
  const X = (r: number) => x0 + ((r - 1) / (RM - 1)) * w, Y = (dv: number) => y0 + h - (dv / 1000 / VM) * h;
  for (const k of [2, 4, 6, 8, 10]) { line(ctx, x0, Y(k * 1000), x0 + w, Y(k * 1000), CC.grid, 1); text(ctx, String(k), x0 - 4, Y(k * 1000), CC.dim, 9, 'right'); }
  for (const r of [5, 10, 15]) text(ctx, String(r), X(r), y0 + h + 10, CC.dim, 9, 'center');
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  for (let r = 1; r <= RM; r += 0.1) { const yy = Y(ve * Math.log(r)); r === 1 ? ctx.moveTo(X(r), yy) : ctx.lineTo(X(r), yy); }
  ctx.stroke(); ctx.restore();
  // orbital speed, for scale
  line(ctx, x0, Y(7800), x0 + w, Y(7800), alpha(CC.blue, 0.7), 1, [4, 4]);
  text(ctx, 'vitesse orbitale 7,8 km/s', x0 + w, Y(7800) - 8, CC.blue, 9, 'right');
  const dv = ve * Math.log(R);
  line(ctx, X(R), Y(0), X(R), Y(dv), CC.dim, 1, [3, 3]);
  dot(ctx, X(R), Y(dv), CC.fg, 4);
  text(ctx, `m0/mf = ${fr(R, 1)}  →  Δv = ${fr(dv / 1000, 2)} km/s`, x0 + 10, y0 + 6, CC.fg, 11);
  text(ctx, `vitesse d’éjection ${fr(ve)} m/s`, x0 + 10, y0 + 22, CC.dim, 10);
}

// ------------------------------------------------------- 4. the budget

/** What the rocket can give against what the orbit asks. */
function budget(ctx: Ctx, e: DiagramEnv): void {
  const pay = e.v.payload ?? LAUNCHER.payload;
  const two = stageDeltaV({ ...LAUNCHER, payload: pay });
  const one = stageDeltaV({ ...singleStage(LAUNCHER), payload: pay });
  const need = 7800, losses = 1600;
  const x0 = 120, w = 200, KM = 11500;
  const X = (dv: number) => x0 + (dv / KM) * w;
  const bar = (y: number, parts: { v: number; col: string; label: string }[], title: string) => {
    text(ctx, title, x0 - 8, y + 11, CC.fg, 10, 'right');
    let a = 0;
    for (const p of parts) {
      ctx.fillStyle = alpha(p.col, 0.75); ctx.fillRect(X(a), y, X(a + p.v) - X(a) - 1, 22);
      if (X(a + p.v) - X(a) > 34) text(ctx, p.label, (X(a) + X(a + p.v)) / 2, y + 11, '#10131a', 9, 'center');
      a += p.v;
    }
    text(ctx, `${fr(a / 1000, 1)} km/s`, X(a) + 5, y + 11, CC.dim, 9);
  };
  bar(30, [{ v: need, col: CC.blue, label: 'vitesse orbitale' }, { v: losses, col: CC.pink, label: 'pertes' }], 'il faut');
  bar(90, [{ v: two[0], col: CC.acc, label: 'étage 1' }, { v: two[1], col: CC.green, label: 'étage 2' }], 'deux étages');
  bar(150, [{ v: one[0], col: CC.violet, label: 'un seul étage' }], 'un étage');
  line(ctx, X(need + losses), 20, X(need + losses), 182, CC.fg, 1, [4, 4]);
  text(ctx, `charge utile ${fr(pay / 1000, 1)} t · mêmes moteurs et même ergol au total`, 14, DH - 22, CC.dim, 10);
  text(ctx, 'Δv idéal, sans air ni pesanteur', 14, DH - 8, CC.dim, 10);
}

// --------------------------------------------- 5. Newton's cannon

const cannonCache = new Map<number, { x: number; y: number }[]>();
/** A horizontal shot at 200 km of altitude, for a given speed (km/s). */
function shot(v0: number): { x: number; y: number }[] {
  const key = Math.round(v0 * 20);
  const hit = cannonCache.get(key);
  if (hit) return hit;
  let x = 0, y = R_EARTH + 200_000, vx = key / 20 * 1000, vy = 0;
  const out = [{ x, y }];
  const dt = 5;
  for (let t = 0; t < 12_000; t += dt) {
    const r = Math.hypot(x, y);
    if (r < R_EARTH || r > 4 * R_EARTH) break;
    const a = GM / (r * r * r);
    vx -= a * x * dt; vy -= a * y * dt;
    x += vx * dt; y += vy * dt;
    out.push({ x, y });
    // one full turn is enough
    if (t > 600 && Math.atan2(x, y) < 0 && Math.atan2(out[out.length - 2].x, out[out.length - 2].y) >= 0) break;
  }
  cannonCache.set(key, out);
  return out;
}

function cannon(ctx: Ctx, e: DiagramEnv): void {
  const v0 = e.v.v0 ?? 6;
  const cx = 130, cy = 128, s = 78 / R_EARTH;
  circle(ctx, cx, cy, R_EARTH * s, null, '#1b2f4a');
  circle(ctx, cx, cy, (R_EARTH + 100_000) * s, alpha(CC.blue, 0.35), null, 3);
  const path = shot(v0);
  const n = Math.max(2, Math.floor(clamp((e.t % 6) / 4, 0, 1) * path.length));
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < n; i++) { const p = path[i]; const X = cx + p.x * s, Y = cy - p.y * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.stroke(); ctx.restore();
  dot(ctx, cx, cy - (R_EARTH + 200_000) * s, CC.fg, 3);
  arrow(ctx, cx, cy - (R_EARTH + 200_000) * s, cx + 24, cy - (R_EARTH + 200_000) * s, CC.fg, 1.5, 5);
  const vc = orbitalSpeed(200_000) / 1000;
  const last = path[path.length - 1];
  const fell = Math.hypot(last.x, last.y) < R_EARTH;
  const x0 = 232;
  text(ctx, 'tir horizontal à 200 km', x0, 28, CC.dim, 10);
  text(ctx, `vitesse ${fr(v0, 1)} km/s`, x0, 50, CC.fg, 12);
  text(ctx, `orbite : ${fr(vc, 1)} km/s`, x0, 72, CC.blue, 10);
  text(ctx, `libération : ${fr(Math.sqrt(2) * vc, 1)} km/s`, x0, 88, CC.dim, 10);
  const verdict = fell ? 'retombe sur la Terre' : v0 >= Math.sqrt(2) * vc ? 's’éloigne sans revenir' : Math.abs(v0 - vc) < 0.15 ? 'orbite presque circulaire' : 'orbite en ellipse';
  text(ctx, verdict, x0, 118, fell ? CC.red : CC.green, 11);
  text(ctx, 'l’échelle des altitudes', x0, 200, CC.dim, 9);
  text(ctx, 'n’est pas exagérée', x0, 212, CC.dim, 9);
}

// ------------------------------------------------- 6. the whole flight

/** Altitude against the distance covered over the ground, for the live settings. */
function flightPlot(ctx: Ctx, e: DiagramEnv): void {
  const f = flightOf(e.v);
  const pts = f.samples.map((s) => ({ d: Math.atan2(s.x, s.y) * R_EARTH / 1000, h: s.alt / 1000, st: s.stage, b: s.burning }));
  const tail = coast(f, 900, 2).map((p) => ({ d: Math.atan2(p.x, p.y) * R_EARTH / 1000, h: (Math.hypot(p.x, p.y) - R_EARTH) / 1000 }));
  const x0 = 40, y0 = 46, w = 320, h = 140;
  const D = 2500, H = 250;
  axes(ctx, x0, y0, w, h, 'distance au sol (km)', 'altitude (km)');
  const X = (d: number) => x0 + (d / D) * w, Y = (a: number) => y0 + h - (clamp(a, 0, H) / H) * h;
  for (const a of [100, 200]) { line(ctx, x0, Y(a), x0 + w, Y(a), CC.grid, 1); text(ctx, String(a), x0 - 4, Y(a), CC.dim, 9, 'right'); }
  for (const d of [500, 1000, 1500]) text(ctx, fr(d), X(d), y0 + h + 10, CC.dim, 9, 'center');
  line(ctx, x0, Y(100), x0 + w, Y(100), alpha(CC.blue, 0.4), 1, [4, 4]);
  text(ctx, 'limite de l’espace (100 km)', x0 + w, Y(100) - 7, alpha(CC.blue, 0.8), 9, 'right');
  // the coast after cut-off, dashed
  ctx.save(); ctx.strokeStyle = CC.dim; ctx.setLineDash([3, 4]); ctx.lineWidth = 1.2; ctx.beginPath();
  tail.forEach((p, i) => { if (p.d > D) return; i ? ctx.lineTo(X(p.d), Y(p.h)) : ctx.moveTo(X(p.d), Y(p.h)); });
  ctx.stroke(); ctx.restore();
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].d > D) break;
    line(ctx, X(pts[i - 1].d), Y(pts[i - 1].h), X(pts[i].d), Y(pts[i].h), !pts[i].b ? CC.dim : pts[i].st === 0 ? CC.acc : CC.green, 2);
  }
  for (const ev of f.events) {
    const s = f.samples[Math.min(f.samples.length - 1, Math.round(ev.t))];
    if (!s || ev.kind === 'kick') continue;
    const d = Math.atan2(s.x, s.y) * R_EARTH / 1000;
    if (d <= D) dot(ctx, X(d), Y(s.alt / 1000), ev.kind === 'maxq' ? CC.pink : CC.fg, 3);
  }
  if (pts.length) {
    const p = pts[Math.floor(((e.t * 0.12) % 1) * (pts.length - 1))];
    if (p.d <= D) dot(ctx, X(p.d), Y(p.h), CC.fg, 4);
  }
  const col = f.outcome === 'orbit' ? CC.green : CC.red;
  text(ctx, `basculement ${fr(e.v.kick ?? 6, 1)}° · ${OUTCOME[f.outcome]}`, x0 + 6, 12, col, 11);
  if (f.outcome === 'orbit') text(ctx, `périgée ${fr(f.peri)} km · apogée ${fr(f.apo)} km`, x0 + 6, 27, CC.dim, 10);
  else if (f.outcome !== 'pad') text(ctx, `altitude maximale ${fr(Math.max(f.maxAlt / 1000, f.apo))} km`, x0 + 6, 27, CC.dim, 10);
  text(ctx, 'étage 1', 50, DH - 10, CC.acc, 9); text(ctx, 'étage 2', 100, DH - 10, CC.green, 9); text(ctx, '• pression max', 150, DH - 10, CC.pink, 9);
}

// ----------------------------------------------------- 7. the losses

/** Where the ideal Δv goes during the flight. */
function losses(ctx: Ctx, e: DiagramEnv): void {
  const f = flightOf(e.v);
  // the speed when the engines stop, and what the propellant left could still give
  const burnt = [...f.samples].reverse().find((s) => s.burning) ?? f.samples[f.samples.length - 1];
  const final = burnt.speed;
  const r = rocketOf(e.v);
  const top = r.stages[r.stages.length - 1];
  const margin = f.margin > 0 ? top.ve * Math.log((top.dry + r.payload + f.margin) / (top.dry + r.payload)) : 0;
  const rows: [string, number, string][] = [
    ['Δv idéal (Tsiolkovsky)', f.idealDv, CC.acc],
    ['pertes par gravité', -f.gravityLoss, CC.pink],
    ['pertes par traînée', -f.dragLoss, CC.violet],
    ['ergol non brûlé (marge)', -margin, '#9aa3b5'],
    ['vitesse à l’arrêt des moteurs', final, CC.green],
  ];
  const x0 = 170, w = 150, M = 12500;
  const X = (v: number) => x0 + (v / M) * w;
  let acc = 0;
  rows.forEach(([label, v, col], i) => {
    const y = 26 + i * 36;
    const last = i === rows.length - 1;
    const a = last ? 0 : v < 0 ? acc + v : acc;
    const b = last ? v : v < 0 ? acc : acc + v;
    ctx.fillStyle = alpha(col, 0.75); ctx.fillRect(X(Math.min(a, b)), y, Math.max(1, X(Math.max(a, b)) - X(Math.min(a, b))), 20);
    text(ctx, label, x0 - 8, y + 10, CC.fg, 10, 'right');
    text(ctx, `${v < 0 ? '−' : ''}${fr(Math.abs(v))} m/s`, X(Math.max(a, b)) + 4, y + 10, CC.dim, 9);
    if (!last) acc += v;
  });
  text(ctx, `issue : ${OUTCOME[f.outcome]}`, 14, DH - 10, f.outcome === 'orbit' ? CC.green : CC.red, 10);
}

// -------------------------------------------- 8. the air and max Q

/** Air density with altitude, and the dynamic pressure along the flight. */
function airPlot(ctx: Ctx, e: DiagramEnv): void {
  const f = flightOf(e.v);
  // left: density against altitude
  const x0 = 40, y0 = 26, w = 130, h = 160;
  axes(ctx, x0, y0, w, h, 'ρ (kg/m³)', 'altitude (km)');
  const Y = (km: number) => y0 + h - (km / 60) * h, X = (r: number) => x0 + (r / 1.3) * w;
  ctx.save(); ctx.strokeStyle = CC.blue; ctx.lineWidth = 2; ctx.beginPath();
  for (let km = 0; km <= 60; km += 1) { const xx = X(rho(km * 1000)); km ? ctx.lineTo(xx, Y(km)) : ctx.moveTo(xx, Y(km)); }
  ctx.stroke(); ctx.restore();
  for (const km of [20, 40, 60]) text(ctx, String(km), x0 - 4, Y(km), CC.dim, 9, 'right');
  text(ctx, 'densité de l’air', x0 + 40, y0 + 6, CC.blue, 10);
  // right: q = ½ρv² against time
  const x1 = 220, w1 = 145;
  axes(ctx, x1, y0, w1, h, 't (s)', 'q (kPa)');
  const QM = Math.max(30_000, f.maxQ * 1.15), TM = 160;
  const Xq = (t: number) => x1 + (t / TM) * w1, Yq = (q: number) => y0 + h - (q / QM) * h;
  ctx.save(); ctx.strokeStyle = CC.pink; ctx.lineWidth = 2; ctx.beginPath();
  f.samples.filter((s) => s.t <= TM).forEach((s, i) => { const q = 0.5 * rho(s.alt) * s.speed * s.speed; i ? ctx.lineTo(Xq(s.t), Yq(q)) : ctx.moveTo(Xq(s.t), Yq(q)); });
  ctx.stroke(); ctx.restore();
  const mq = f.events.find((ev) => ev.kind === 'maxq');
  if (mq && mq.t <= TM) { dot(ctx, Xq(mq.t), Yq(f.maxQ), CC.fg, 3.5); text(ctx, `max ${fr(f.maxQ / 1000)} kPa à ${fr(mq.t)} s`, Xq(mq.t) + 6, Yq(f.maxQ) - 8, CC.fg, 9); }
  for (const t of [50, 100]) text(ctx, String(t), Xq(t), y0 + h + 10, CC.dim, 9, 'center');
  text(ctx, 'q = ½·ρ·v²', x1 + 40, y0 + 6, CC.pink, 10);
  void e;
}

// --------------------------------------------- 9. the log (toolbox)

function lnPlot(ctx: Ctx, e: DiagramEnv): void {
  const x0 = 40, y0 = 20, w = 300, h = 180;
  axes(ctx, x0, y0, w, h, 'x', 'ln x');
  const XM = 20, YM = 3.2;
  const X = (x: number) => x0 + (x / XM) * w, Y = (y: number) => y0 + h - ((y + 0.4) / (YM + 0.4)) * h;
  line(ctx, x0, Y(0), x0 + w, Y(0), CC.faint, 1);
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = 0.7; x <= XM; x += 0.1) { x < 0.75 ? ctx.moveTo(X(x), Y(Math.log(x))) : ctx.lineTo(X(x), Y(Math.log(x))); }
  ctx.stroke(); ctx.restore();
  for (const k of [1, 2, 3]) text(ctx, String(k), x0 - 4, Y(k), CC.dim, 9, 'right');
  for (const k of [1, 5, 10, 15]) text(ctx, String(k), X(k), y0 + h + 10, CC.dim, 9, 'center');
  const x = e.ptr ? clamp(((e.ptr.x - x0) / w) * XM, 1, XM) : 1 + ((Math.sin(e.t * 0.5) + 1) / 2) * 15;
  dot(ctx, X(x), Y(Math.log(x)), CC.fg, 4);
  line(ctx, X(x), Y(0), X(x), Y(Math.log(x)), CC.dim, 1, [3, 3]);
  text(ctx, `ln(${fr(x, 1)}) = ${fr(Math.log(x), 2)}`, x0 + 14, y0 + 8, CC.fg, 12);
  text(ctx, 'doubler x ajoute toujours ln 2 ≈ 0,69', x0 + 14, y0 + 26, CC.dim, 10);
}

/** Pipeline of a simulation step, lit progressively (the layers). */
function stepPipeline(ctx: Ctx, e: DiagramEnv): void {
  const boxes = ['forces', 'accélération', 'vitesse', 'position', 'masse'];
  const lit = Math.floor(e.t / 1.2) % (boxes.length + 2);
  boxes.forEach((b, i) => {
    const x = 14 + i * 73, y = 92;
    panel(ctx, x, y, 64, 40, i < lit ? CC.acc : CC.faint, i < lit ? alpha(CC.acc, 0.12) : null);
    text(ctx, b, x + 32, y + 20, i < lit ? CC.fg : CC.dim, 10, 'center');
    if (i) arrow(ctx, x - 9, y + 20, x - 1, y + 20, CC.dim, 1.2, 4);
  });
  text(ctx, 'un pas de temps dt', DW / 2, 60, CC.dim, 11, 'center');
  text(ctx, 'a = F/m − g   ·   v ← v + a·dt', DW / 2, 166, CC.fg, 10, 'center', true);
  text(ctx, 'h ← h + v·dt   ·   m ← m − débit·dt', DW / 2, 184, CC.fg, 10, 'center', true);
}

export const DIAGRAMS = { forces, climb, tsiolkovsky: tsiolkovskyPlot, budget, cannon, flight: flightPlot, losses, air: airPlot, ln: lnPlot, stepPipeline };
