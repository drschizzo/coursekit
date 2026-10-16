// The diagrams of the NCA course. Each one runs the model with the current
// values: nothing is drawn from figures written by hand. The paper's own
// results come from PAPER.

import { fr, pct, type DiagramEnv } from '@coursekit/core';
import { CC, DH, DW, alpha, arrow, axes, cached, cachedMaybe, clamp, dot, line, panel, text } from '@coursekit/diagrams';
import {
  GRID, GRID_OUTCOME, MAZE, MAZE_OUTCOME, PAPER, atLeastOne, gridRate, groupRate, mazeOf, ncaParams, pruneShare,
  replayOlder, spread, stepsNeeded, trialsOf, type GridRun, type MazeRun,
} from './model.ts';

type Ctx = CanvasRenderingContext2D;

/** The two colours of the constraint grid, and the cell states of the maze. */
export const COL = { a: '#7c9cff', b: '#ffb35c', wall: '#141822', open: 'rgba(230,234,245,.20)', reached: '#ffb35c', dead: 'rgba(124,156,255,.38)', end: '#e6eaf5' };

const val = (e: DiagramEnv, k: string, d: number) => (Number.isFinite(e.v[k]) ? e.v[k] : d);

/** One cell of a small pictogram. */
function cell(ctx: Ctx, x: number, y: number, s: number, fill: string, stroke: string | null = null): void {
  ctx.fillStyle = fill; ctx.fillRect(x, y, s - 1, s - 1);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, s - 3, s - 3); }
}

/** A maze state (0 unreached, 1 reached, 2 dead) drawn in a square. */
export function drawMaze(ctx: Ctx, r: MazeRun, frame: Uint8Array, x: number, y: number, size: number): void {
  const S = r.maze.side, k = size / S;
  for (let i = 0; i < S * S; i++) {
    const cx = x + (i % S) * k, cy = y + Math.floor(i / S) * k;
    const s = frame[i];
    ctx.fillStyle = r.maze.wall[i] ? COL.wall : i === r.maze.ends[0] || i === r.maze.ends[1] ? COL.end : s === 1 ? COL.reached : s === 2 ? COL.dead : COL.open;
    ctx.fillRect(cx, cy, Math.ceil(k), Math.ceil(k));
  }
}

/** A colour grid drawn in a square, the conflicts marked in red. */
export function drawGrid(ctx: Ctx, n: number, c: Uint8Array, x: number, y: number, size: number): void {
  const k = size / n;
  for (let i = 0; i < n * n; i++) { ctx.fillStyle = c[i] ? COL.b : COL.a; ctx.fillRect(x + (i % n) * k + 0.5, y + Math.floor(i / n) * k + 0.5, k - 1, k - 1); }
  ctx.strokeStyle = CC.red; ctx.lineWidth = Math.max(1.5, k * 0.18);
  ctx.beginPath();
  for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
    const i = yy * n + xx;
    if (xx + 1 < n && c[i] === c[i + 1]) { ctx.moveTo(x + (xx + 1) * k, y + yy * k + k * 0.2); ctx.lineTo(x + (xx + 1) * k, y + yy * k + k * 0.8); }
    if (yy + 1 < n && c[i] === c[i + n]) { ctx.moveTo(x + xx * k + k * 0.2, y + (yy + 1) * k); ctx.lineTo(x + xx * k + k * 0.8, y + (yy + 1) * k); }
  }
  ctx.stroke();
}

// ------------------------------------------------- m1: the neighbourhood

function neighborhood(ctx: Ctx, e: DiagramEnv): void {
  const n = 7, k = 27, x0 = 22, y0 = 24;
  const spots = [[3, 3], [1, 1], [5, 2], [2, 5], [4, 4]];
  const [cx, cy] = spots[Math.floor(e.t / 1.6) % spots.length];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const inside = Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1;
    cell(ctx, x0 + x * k, y0 + y * k, k, x === cx && y === cy ? CC.acc : inside ? alpha(CC.blue, 0.55) : CC.faint);
  }
  const xr = 232;
  text(ctx, 'une cellule', xr, 40, CC.acc, 12);
  text(ctx, 'ses huit voisines', xr, 62, CC.blue, 12);
  text(ctx, 'le voisinage 3 × 3', xr, 84, CC.dim, 10);
  text(ctx, 'chaque cellule applique', xr, 124, CC.fg, 11);
  text(ctx, 'la même règle', xr, 140, CC.fg, 11);
  text(ctx, 'aucune ne voit', xr, 172, CC.dim, 10);
  text(ctx, 'la grille entière', xr, 186, CC.dim, 10);
}

// ------------------------------------------------- m1: the light cone

function cone(ctx: Ctx, e: DiagramEnv): void {
  const side = 21, steps = Math.round(clamp(val(e, 'steps', 5), 0, 40)), p = clamp(val(e, 'cp', 1), 0.05, 1);
  const on = cached(`cone|${steps}|${p}`, () => spread(side, steps, p));
  const k = 9, x0 = 18, y0 = 24, c = (side - 1) / 2;
  let count = 0, radius = 0;
  for (let i = 0; i < side * side; i++) {
    const x = i % side, y = Math.floor(i / side);
    if (on[i]) { count++; radius = Math.max(radius, Math.abs(x - c), Math.abs(y - c)); }
    ctx.fillStyle = x === c && y === c ? CC.fg : on[i] ? alpha(CC.acc, 0.85) : CC.faint;
    ctx.fillRect(x0 + x * k, y0 + y * k, k - 1, k - 1);
  }
  const full = count === side * side;
  const xr = 222;
  text(ctx, `après ${fr(steps)} pas`, xr, 34, CC.fg, 12);
  // arg 'sync': every cell updates at every step, before the rate is introduced
  if (e.arg !== 'sync') text(ctx, `taux de mise à jour ${fr(p, 2)}`, xr, 56, CC.dim, 10);
  text(ctx, `cellules informées : ${fr(count)}`, xr, 86, CC.acc, 11);
  text(ctx, `sur ${fr(side * side)}`, xr, 102, CC.dim, 10);
  text(ctx, `distance couverte : ${fr(radius)}`, xr, 128, CC.fg, 11);
  text(ctx, `bord à ${fr(c)} cases du centre`, xr, 144, CC.dim, 10);
  text(ctx, full ? 'toute la grille est informée' : 'bord pas atteint partout', xr, 180, full ? CC.green : CC.red, 10);
}

// ---------------------------------------------- m1: what a NCA cell does

function ncaCell(ctx: Ctx, e: DiagramEnv): void {
  const boxes: [string, string, number, number][] = [
    ['voisinage', '3 × 3', 14, 34], ['perception', 'combinaisons', 134, 34], ['réseau', 'partagé', 254, 34],
    ['masque', `tirage p = ${fr(PAPER.pFire, 1)}`, 254, 132], ['mise à jour', 'x ← x + Δx', 134, 132], ['nouvel état', `${fr(PAPER.mazeC)} canaux`, 14, 132],
  ];
  const lit = Math.floor(e.t / 1.1) % (boxes.length + 2);
  boxes.forEach(([a, b, x, y], i) => {
    const on = i < lit;
    panel(ctx, x, y, 106, 46, on ? CC.acc : CC.faint, on ? alpha(CC.acc, 0.12) : null);
    text(ctx, a, x + 53, y + 16, on ? CC.fg : CC.dim, 11, 'center');
    text(ctx, b, x + 53, y + 32, CC.dim, 9, 'center');
  });
  arrow(ctx, 122, 57, 132, 57, CC.dim, 1.2, 5);
  arrow(ctx, 242, 57, 252, 57, CC.dim, 1.2, 5);
  arrow(ctx, 307, 82, 307, 130, CC.dim, 1.2, 5);
  arrow(ctx, 252, 155, 242, 155, CC.dim, 1.2, 5);
  arrow(ctx, 132, 155, 122, 155, CC.dim, 1.2, 5);
  text(ctx, 'Δx', 314, 106, CC.dim, 10);
  text(ctx, 'canaux : entrée (fixe) · sortie (la réponse) · cachés', DW / 2, 210, CC.dim, 10, 'center');
}

// ------------------------------------------------ m1: counting parameters

function params(ctx: Ctx, e: DiagramEnv): void {
  const C = Math.round(val(e, 'C', PAPER.mazeC)), H = Math.round(val(e, 'heads', PAPER.mazeHeads)), E = Math.round(val(e, 'E', PAPER.mazeE));
  const z = H * C, hid = E * z;
  const perc = H * 9, l1 = z * hid + hid, l2 = hid * C + C, total = ncaParams(C, H, E);
  text(ctx, `${fr(C)} canaux · ${fr(H)} têtes · expansion ${fr(E)}`, 14, 16, CC.fg, 11);
  const rows: [string, number, string][] = [['perception', perc, CC.blue], ['couche 1', l1, CC.acc], ['couche 2', l2, CC.violet]];
  rows.forEach(([lab, v, col], i) => {
    const y = 38 + i * 22;
    text(ctx, lab, 14, y, CC.dim, 10);
    text(ctx, fr(v), 140, y, col, 10, 'right');
  });
  text(ctx, `total ${fr(total)}`, 14, 106, CC.fg, 11);
  // log scale, 10³ to 10⁷
  const x0 = 160, w = 200, y0 = 30;
  const X = (v: number) => x0 + ((Math.log10(clamp(v, 1000, 1e7)) - 3) / 4) * w;
  const bars: [string, number, string][] = [['cette NCA', total, CC.acc], ['DeepThink', PAPER.deepThinkParams, CC.blue]];
  bars.forEach(([lab, v, col], i) => {
    const y = y0 + i * 40;
    ctx.fillStyle = alpha(col, 0.7); ctx.fillRect(x0, y, X(v) - x0, 22);
    text(ctx, lab, X(v) + 6, y + 11, col, 10);
  });
  line(ctx, x0, y0 + 80, x0 + w, y0 + 80, CC.dim, 1);
  ([[1e3, '10³'], [1e4, '10⁴'], [1e5, '10⁵'], [1e6, '10⁶']] as const).forEach(([v, s]) => text(ctx, s, X(v), y0 + 92, CC.dim, 9, 'center'));
  text(ctx, 'paramètres', x0 + w, y0 + 106, CC.dim, 10, 'right');
  text(ctx, `rapport : ${fr(PAPER.deepThinkParams / total)} fois moins de paramètres`, 14, 170, CC.fg, 11);
  text(ctx, 'échelle logarithmique : chaque graduation multiplie par dix', 14, 196, CC.dim, 10);
}

// ------------------------------------------------------ m2: the two rules

function rules(ctx: Ctx, e: DiagramEnv): void {
  // three situations; each a cross of five cells, before → after
  const W = COL.wall, O = COL.open, R = COL.reached, X = COL.dead;
  const cases: { title: string; nb: string[]; before: string; after: string; say: [string, string] }[] = [
    { title: 'explorer', nb: [O, W, R, W], before: O, after: R, say: ['une voisine atteinte :', 'la cellule l’est aussi'] },
    { title: 'élaguer', nb: [W, W, R, W], before: R, after: X, say: ['une seule voisine vivante :', 'une impasse, elle meurt'] },
    { title: 'garder', nb: [R, W, R, X], before: R, after: R, say: ['deux voisines vivantes :', 'elle reste sur le chemin'] },
  ];
  // arg 'wave': the first rule only, before the chapter on dead ends
  const wave = e.arg === 'wave';
  const k = 16, phase = Math.floor(e.t / 1.5) % 2;
  (wave ? cases.slice(0, 1) : cases).forEach((c, i) => {
    const ox = 14 + i * 124, cx = ox + 44, cy = 74;
    text(ctx, c.title, ox + 52, 22, CC.acc, 12, 'center');
    const pos = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    pos.forEach(([dx, dy], j) => cell(ctx, cx + dx * k, cy + dy * k, k, c.nb[j]));
    cell(ctx, cx, cy, k, phase ? c.after : c.before, CC.fg);
    text(ctx, phase ? 'après' : 'avant', ox + 52, 124, CC.dim, 10, 'center');
    text(ctx, c.say[0], ox + 52, 158, CC.fg, 9, 'center');
    text(ctx, c.say[1], ox + 52, 172, CC.fg, 9, 'center');
  });
  const leg: [string, string][] = [[COL.reached, 'atteinte'], [COL.dead, 'morte'], [COL.wall, 'mur'], [COL.open, 'pas encore atteinte']];
  const lx = [14, 88, 146, 194];
  leg.forEach(([col, lab], i) => { if (wave && col === COL.dead) return; cell(ctx, lx[i], 206, 12, col); text(ctx, lab, lx[i] + 16, 212, CC.dim, 9); });
}

// --------------------------------------------- m2: a run, step by step

/** Shares of open cells reached, dead and wrong after each step. */
const shares = (r: MazeRun) => cached(`shares|${r.maze.side}|${r.p.seed}|${r.p.p}|${r.p.D}|${r.p.adaptive}|${r.p.plow}|${r.p.damage}`, () => r.frames.map((f) => {
  let a = 0, d = 0;
  for (let i = 0; i < f.length; i++) if (!r.maze.wall[i]) { if (f[i] >= 1) a++; if (f[i] === 2) d++; }
  return { a: a / r.maze.open, d: d / r.maze.open };
}));

function progress(ctx: Ctx, e: DiagramEnv): void {
  const r = mazeOf(e.v), D = r.p.D, sh = shares(r);
  const x0 = 40, y0 = 52, w = 300, h = 130;
  axes(ctx, x0, y0, w, h, 'pas', 'part des cases ouvertes');
  const X = (t: number) => x0 + (Math.min(t, D) / D) * w, Y = (s: number) => y0 + h - s * h;
  for (const s of [0.5, 1]) { line(ctx, x0, Y(s), x0 + w, Y(s), CC.grid, 1); text(ctx, pct(s), x0 - 4, Y(s), CC.dim, 9, 'right'); }
  const curve = (f: (i: number) => number, col: string) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    for (let t = 0; t <= D; t += Math.max(1, Math.floor(D / 300))) { const i = Math.min(t, sh.length - 1); t ? ctx.lineTo(X(t), Y(f(i))) : ctx.moveTo(X(t), Y(f(i))); }
    ctx.stroke(); ctx.restore();
  };
  curve((i) => sh[i].a, CC.acc);
  curve((i) => sh[i].d, CC.blue);
  curve((i) => r.wrong[i] / r.maze.open, CC.red);
  if (r.solvedAt > 0) { line(ctx, X(r.solvedAt), y0, X(r.solvedAt), y0 + h, CC.green, 1, [3, 3]); }
  const done = r.outcome === 'solved';
  text(ctx, `${fr(r.maze.side)} × ${fr(r.maze.side)} · D = ${fr(D)} pas · ${MAZE_OUTCOME[r.outcome]}`, x0, 12, done ? CC.green : CC.red, 11);
  if (done) text(ctx, `solution trouvée au pas ${fr(r.solvedAt)}`, x0, 26, CC.dim, 10);
  text(ctx, 'atteintes', 40, DH - 10, CC.acc, 9); text(ctx, 'mortes', 110, DH - 10, CC.blue, 9); text(ctx, 'cases mal classées', 170, DH - 10, CC.red, 9);
}

// ------------------------------------------------- m2: bigger mazes

const SIDES = [9, 13, 21, 29, 41, 61];

function scaling(ctx: Ctx, e: DiagramEnv): void {
  const D = val(e, 'D', MAZE.D), p = clamp(val(e, 'p', PAPER.pFire), 0.1, 1);
  const x0 = 50, y0 = 40, w = 290, h = 150, TM = 2400;
  axes(ctx, x0, y0, w, h, 'côté du labyrinthe', 'pas nécessaires');
  const X = (s: number) => x0 + ((s - 5) / 60) * w, Y = (t: number) => y0 + h - (clamp(t, 0, TM) / TM) * h;
  for (const t of [800, 1600]) { line(ctx, x0, Y(t), x0 + w, Y(t), CC.grid, 1); text(ctx, fr(t), x0 - 4, Y(t), CC.dim, 9, 'right'); }
  for (const s of [9, 21, 41]) text(ctx, fr(s), X(s), y0 + h + 10, CC.dim, 9, 'center');
  let missing = false;
  for (const s of SIDES) {
    const pts = cachedMaybe(`need|${s}|${p}`, () => stepsNeeded(s, p));
    if (!pts) { missing = true; continue; }
    pts.forEach((t, i) => dot(ctx, X(s) + (i - 2) * 3, Y(t), t <= D ? CC.green : CC.red, 2.6));
  }
  line(ctx, x0, Y(D), x0 + w, Y(D), CC.acc, 1.5, [5, 4]);
  text(ctx, D <= TM ? `D = ${fr(D)} pas` : `D = ${fr(D)} pas, hors du cadre`, x0 + 8, Y(D) - 9 < y0 + 8 ? Y(D) + 10 : Y(D) - 9, CC.acc, 10);
  text(ctx, missing ? 'calcul des labyrinthes en cours' : 'chaque point : un labyrinthe, résolu (vert) ou non (rouge)', x0, 12, CC.dim, 10);
}

// ------------------------------------------------ m3: the colour rule

function gridRule(ctx: Ctx, e: DiagramEnv): void {
  const A = COL.a, B = COL.b;
  const cases: { nb: string[]; flip: boolean; say: [string, string] }[] = [
    { nb: [A, A, A, B], flip: true, say: ['trois voisines', 'de même couleur : change'] },
    { nb: [A, A, B, B], flip: true, say: ['deux sur quatre :', 'change aussi'] },
    { nb: [B, B, B, A], flip: false, say: ['une seule de même', 'couleur : garde'] },
  ];
  const k = 18, phase = Math.floor(e.t / 1.5) % 2;
  cases.forEach((c, i) => {
    const ox = 14 + i * 124, cx = ox + 43, cy = 64;
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy], j) => cell(ctx, cx + dx * k, cy + dy * k, k, c.nb[j]));
    cell(ctx, cx, cy, k, phase && c.flip ? B : A, CC.fg);
    text(ctx, phase ? 'après' : 'avant', ox + 52, 116, CC.dim, 10, 'center');
    text(ctx, c.say[0], ox + 52, 144, CC.fg, 9, 'center');
    text(ctx, c.say[1], ox + 52, 158, CC.fg, 9, 'center');
  });
  text(ctx, 'la règle : changer de couleur si au moins la moitié', DW / 2, 192, CC.dim, 10, 'center');
  text(ctx, 'des voisines ont la même couleur que soi', DW / 2, 206, CC.dim, 10, 'center');
}

// ------------------------------------------- m3: conflicts along a run

function conflictCurve(ctx: Ctx, e: DiagramEnv): void {
  const r: GridRun = trialsOf({ ...e.v, K: 1 }).runs[0];
  const eta = val(e, 'eta', GRID.eta), rn = val(e, 'rn', GRID.rn), D = GRID.D;
  const x0 = 36, y0 = 52, w = 220, h = 140;
  const CM = Math.max(10, ...r.conflicts) * 1.1;
  const X = (t: number) => x0 + (t / D) * w, Y = (c: number) => y0 + h - (c / CM) * h;
  if (eta > 0) { ctx.fillStyle = alpha(CC.pink, 0.12); ctx.fillRect(x0, y0, X(Math.min(D, rn * D)) - x0, h); text(ctx, 'bruit', x0 + 4, y0 + 8, CC.pink, 9); }
  axes(ctx, x0, y0, w, h, 'pas', 'conflits');
  for (const c of [Math.round(CM / 2.2)]) { line(ctx, x0, Y(c), x0 + w, Y(c), CC.grid, 1); text(ctx, fr(c), x0 - 4, Y(c), CC.dim, 9, 'right'); }
  text(ctx, fr(100), X(100), y0 + h + 10, CC.dim, 9, 'center');
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 1.6; ctx.beginPath();
  r.conflicts.forEach((c, t) => (t ? ctx.lineTo(X(t), Y(c)) : ctx.moveTo(X(t), Y(c))));
  ctx.stroke(); ctx.restore();
  const ok = r.outcome === 'solved';
  text(ctx, `p = ${fr(val(e, 'p', GRID.p), 2)} · grille ${GRID_OUTCOME[r.outcome]}`, x0, 12, ok ? CC.green : CC.red, 11);
  text(ctx, `conflits à la fin : ${fr(r.conflicts[D])}`, x0, 26, CC.dim, 10);
  // the grid as it ends
  text(ctx, 'à la fin', 322, 52, CC.dim, 10, 'center');
  drawGrid(ctx, r.n, r.frames[r.frames.length - 1], 276, 64, 92);
}

// ------------------------------------------ m3: success against p

const PS = [0.02, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 1];

function rateVsP(ctx: Ctx, e: DiagramEnv): void {
  const eta = val(e, 'eta', GRID.eta), rn = val(e, 'rn', GRID.rn), p = val(e, 'p', GRID.p);
  const x0 = 40, y0 = 40, w = 320, h = 144, bw = w / PS.length;
  axes(ctx, x0, y0, w, h, '', 'grilles résolues');
  for (const s of [0.5, 1]) { line(ctx, x0, y0 + h - s * h, x0 + w, y0 + h - s * h, CC.grid, 1); text(ctx, pct(s), x0 - 4, y0 + h - s * h, CC.dim, 9, 'right'); }
  let missing = false;
  PS.forEach((q, i) => {
    const rate = cachedMaybe(`rate|${q}|${eta}|${rn}`, () => gridRate(q, eta, rn));
    const x = x0 + i * bw + 4;
    const near = Math.abs(q - p) < 0.011;
    if (rate == null) missing = true;
    else { ctx.fillStyle = alpha(near ? CC.acc : CC.blue, near ? 0.9 : 0.55); ctx.fillRect(x, y0 + h - rate * h, bw - 8, rate * h); }
    text(ctx, fr(q, 2), x + (bw - 8) / 2, y0 + h + 10, near ? CC.acc : CC.dim, 9, 'center');
  });
  text(ctx, 'taux de mise à jour p', x0 + w, y0 + h + 24, CC.dim, 10, 'right');
  text(ctx, missing ? 'calcul sur 200 grilles en cours' : `sur 200 grilles${eta > 0 ? ', avec bruit' : ', sans bruit'}`, x0, 12, CC.dim, 10);
}

// ----------------------------------------------- m3: parallel trials

function trials(ctx: Ctx, e: DiagramEnv): void {
  const eta = val(e, 'eta', GRID.eta), rn = val(e, 'rn', GRID.rn), K = Math.round(clamp(val(e, 'K', 1), 1, 10));
  const p = cachedMaybe(`rate|0.8|${eta}|${rn}`, () => gridRate(0.8, eta, rn));
  const x0 = 40, y0 = 52, w = 300, h = 130;
  axes(ctx, x0, y0, w, h, 'nombre d’essais K', 'réussite');
  const X = (k: number) => x0 + ((k - 1) / 9) * w, Y = (s: number) => y0 + h - s * h;
  for (const s of [0.5, 1]) { line(ctx, x0, Y(s), x0 + w, Y(s), CC.grid, 1); text(ctx, pct(s), x0 - 4, Y(s), CC.dim, 9, 'right'); }
  for (const k of [1, 4, 7]) text(ctx, fr(k), X(k), y0 + h + 10, CC.dim, 9, 'center');
  if (p == null) { text(ctx, 'calcul sur 200 grilles en cours', x0, 14, CC.dim, 10); return; }
  ctx.save(); ctx.strokeStyle = CC.blue; ctx.lineWidth = 2; ctx.beginPath();
  for (let k = 1; k <= 10; k += 0.25) (k === 1 ? ctx.moveTo(X(k), Y(atLeastOne(p, k))) : ctx.lineTo(X(k), Y(atLeastOne(p, k))));
  ctx.stroke(); ctx.restore();
  for (const k of [1, 2, 3, 4]) { const m = cachedMaybe(`group|${k}|${eta}|${rn}`, () => groupRate(0.8, eta, rn, k)); if (m != null) dot(ctx, X(k), Y(m), CC.acc, 3.5); }
  dot(ctx, X(K), Y(atLeastOne(p, K)), CC.fg, 4.5);
  text(ctx, K > 1 ? `un essai : ${pct(p)} · ${fr(K)} essais : ${pct(atLeastOne(p, K))}` : `un essai : ${pct(p)}`, x0, 12, CC.fg, 11);
  text(ctx, 'courbe : 1 − (1 − p)^K · points : mesurés', x0, 27, CC.dim, 10);
}

// ------------------------------------------ m3: pruning the trials

function pruning(ctx: Ctx, e: DiagramEnv): void {
  const m = Math.round(clamp(val(e, 'm', 4), 1, 8));
  // left: the active trials along the rollout, halved m − 1 times
  const x0 = 30, y0 = 40, w = 170, h = 130;
  axes(ctx, x0, y0, w, h, 'pas', 'essais actifs');
  ctx.strokeStyle = CC.dim; ctx.setLineDash([3, 3]); ctx.strokeRect(x0, y0, w, h); ctx.setLineDash([]);
  for (let i = 0; i < m; i++) {
    const hh = h / 2 ** i;
    ctx.fillStyle = alpha(CC.acc, 0.6); ctx.fillRect(x0 + (i * w) / m, y0 + h - hh, w / m - 1, hh);
  }
  text(ctx, `${fr(m)} tranche${m > 1 ? 's' : ''}, divisé par deux à chaque fois`, x0, 16, CC.fg, 10);
  // right: share of the full compute, for m = 1, 2, 4, 8
  const bx = 230, bw = 30;
  [1, 2, 4, 8].forEach((q, i) => {
    const s = pruneShare(q), x = bx + i * 36, hh = s * 120;
    ctx.fillStyle = alpha(q === m ? CC.acc : CC.blue, q === m ? 0.9 : 0.5); ctx.fillRect(x, 170 - hh, bw, hh);
    text(ctx, pct(s), x + bw / 2, 162 - hh, CC.fg, 9, 'center');
    text(ctx, `m = ${fr(q)}`, x + bw / 2, 182, CC.dim, 9, 'center');
  });
  text(ctx, 'calcul utilisé', bx, 26, CC.dim, 10);
  text(ctx, `économie : ${pct(1 - pruneShare(m))} du calcul de K essais sur D pas`, 14, 214, CC.fg, 10);
}

// ------------------------------------------- m4: the replay pool

function replay(ctx: Ctx, e: DiagramEnv): void {
  const r = clamp(val(e, 'rseed', PAPER.mazeSeedRatio), 0.01, 1), N = PAPER.mazeN, KM = 14;
  const x0 = 46, y0 = 52, w = 300, h = 130, bw = w / (KM + 1);
  axes(ctx, x0, y0, w, h, '', 'part des lots');
  text(ctx, 'début du déroulement (pas)', x0 + w, y0 + h + 26, CC.dim, 10, 'right');
  const P = (k: number) => r * (1 - r) ** k;
  const top = Math.max(0.3, r * 1.1);
  for (let k = 0; k <= KM; k++) {
    const v = P(k), x = x0 + k * bw + 2;
    ctx.fillStyle = alpha(k >= 10 ? CC.pink : CC.blue, 0.7);
    ctx.fillRect(x, y0 + h - (Math.min(v, top) / top) * h, bw - 4, (Math.min(v, top) / top) * h);
  }
  for (const k of [0, 5, 10]) text(ctx, fr(k * N), x0 + k * bw + bw / 2, y0 + h + 10, CC.dim, 9, 'center');
  text(ctx, `part de lots neufs r = ${pct(r)}`, x0, 12, CC.fg, 11);
  text(ctx, `au-delà de ${fr(10 * N)} pas : ${pct(replayOlder(r, 10))}`, x0, 27, CC.pink, 10);
}

// --------------------------------------- m4: adaptive compute

function adaptive(ctx: Ctx, e: DiagramEnv): void {
  const u = mazeOf({ ...e.v, adaptive: 0, damage: 0 }), a = mazeOf({ ...e.v, adaptive: 1, damage: 0 });
  const plow = val(e, 'plow', PAPER.pLow);
  const cum = (r: MazeRun) => { let s = 0; return r.updates.map((x) => (s += x)); };
  const cu = cum(u), ca = cum(a);
  const WM = Math.max(cu[cu.length - 1] ?? 1, ca[ca.length - 1] ?? 1) * 1.1;
  const x0 = 46, y0 = 52, w = 290, h = 124, TM = Math.max(u.steps, a.steps, 10) * 1.05;
  axes(ctx, x0, y0, w, h, 'pas', 'mises à jour cumulées');
  const X = (t: number) => x0 + (Math.min(t, TM) / TM) * w, Y = (v: number) => y0 + h - (v / WM) * h;
  const plot = (c: number[], col: string) => { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); c.forEach((v, t) => (t ? ctx.lineTo(X(t + 1), Y(v)) : ctx.moveTo(X(1), Y(v)))); ctx.stroke(); ctx.restore(); };
  plot(cu, CC.blue); plot(ca, CC.acc);
  for (const r of [u, a]) if (r.solvedAt > 0) dot(ctx, X(r.solvedAt), Y((r === u ? cu : ca)[r.solvedAt - 1]), r === u ? CC.blue : CC.acc, 3.5);
  const ok = a.outcome === 'solved' && u.outcome === 'solved';
  text(ctx, `taux des cellules sûres ${fr(plow, 2)} · ${MAZE_OUTCOME[a.outcome]}`, x0, 12, a.outcome === 'solved' ? CC.fg : CC.red, 11);
  if (ok) text(ctx, `pas ×${fr(a.solvedAt / u.solvedAt, 2)} · mises à jour ×${fr(a.work / u.work, 2)}`, x0, 28, CC.acc, 10);
  else text(ctx, 'pas de solution : rien à comparer', x0, 28, CC.red, 10);
  text(ctx, 'uniforme', 46, DH - 10, CC.blue, 9); text(ctx, 'adaptatif', 110, DH - 10, CC.acc, 9); text(ctx, '• solution', 180, DH - 10, CC.dim, 9);
}

// --------------------------------------- m4: repairing damage

function damage(ctx: Ctx, e: DiagramEnv): void {
  const side = val(e, 'side', 41), base = { ...e.v, side, D: 3000, damage: 1 };
  const u = mazeOf({ ...base, adaptive: 0 }), a = mazeOf({ ...base, adaptive: 1 });
  const x0 = 46, y0 = 52, w = 290, h = 114, T = 80;
  axes(ctx, x0, y0, w, h, 'pas après les dégâts', 'cases mal classées');
  const WM = Math.max(...u.wrong.slice(u.damageAt), ...a.wrong.slice(a.damageAt), 4) * 1.1;
  const X = (t: number) => x0 + (Math.min(t, T) / T) * w, Y = (v: number) => y0 + h - (v / WM) * h;
  for (const [r, col] of [[u, CC.blue], [a, CC.acc]] as const) {
    if (r.damageAt < 0) continue;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    for (let t = 0; t <= T && r.damageAt + t < r.wrong.length; t++) { const v = r.wrong[r.damageAt + t]; t ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v)); }
    ctx.stroke(); ctx.restore();
  }
  for (const t of [20, 40]) text(ctx, fr(t), X(t), y0 + h + 10, CC.dim, 9, 'center');
  const ok = u.repairSteps > 0 && a.repairSteps > 0;
  text(ctx, `${fr(side)} × ${fr(side)} : trois zones remises à zéro`, x0, 12, CC.fg, 11);
  if (ok) {
    text(ctx, `uniforme : ${fr(u.repairSteps)} pas, ${fr(u.repairWork)} mises à jour`, x0, 28, CC.blue, 10);
    text(ctx, `adaptatif : ${fr(a.repairSteps)} pas, ${fr(a.repairWork)} mises à jour (×${fr(a.repairWork / u.repairWork, 2)})`, x0, DH - 12, CC.acc, 10);
  } else text(ctx, 'la réparation n’aboutit pas', x0, 28, CC.red, 10);
}

// --------------------------------------- m4: the paper's results

function results(ctx: Ctx, e: DiagramEnv): void {
  const rows: [string, number, string, string][] = [
    [`labyrinthes ${fr(PAPER.mazeBig)} × ${fr(PAPER.mazeBig)}, NCA`, PAPER.ncaBig, CC.acc, ''],
    ['… DeepThink', PAPER.deepThinkBig, CC.blue, ''],
    ['sudoku difficile, un essai', PAPER.sudokuK1, CC.acc, ''],
    [`… ${fr(PAPER.sudokuK)} essais`, PAPER.sudokuKAcc, CC.acc, ''],
    ['ARC-AGI-1, NCA', PAPER.arcNca, CC.acc, ''],
    ['… TRM', PAPER.arcTrm, CC.blue, ''],
    ['sudoku en pixels, facile', PAPER.visualEasy, CC.violet, ''],
    ['… difficile', PAPER.visualHard, CC.violet, ''],
  ];
  const x0 = 170, w = 160;
  const shown = Math.min(rows.length, 1 + Math.floor(e.t / 0.6));
  rows.slice(0, shown).forEach(([lab, v, col], i) => {
    const y = 18 + i * 25;
    text(ctx, lab, x0 - 8, y + 8, CC.fg, 10, 'right');
    ctx.fillStyle = alpha(col, 0.7); ctx.fillRect(x0, y, (v / 100) * w, 16);
    text(ctx, `${fr(v, 1)} %`, x0 + (v / 100) * w + 4, y + 8, CC.dim, 9);
  });
  text(ctx, 'résultats de l’article (pourcentage de problèmes résolus)', 14, DH - 8, CC.dim, 9);
}

export const DIAGRAMS = { neighborhood, cone, ncaCell, params, rules, progress, scaling, gridRule, conflictCurve, rateVsP, trials, pruning, replay, adaptive, damage, results };
