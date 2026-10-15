// The diagrams of the course. Each one runs the model with the current
// values: nothing is drawn from figures written by hand.

import { fr, pct, type DiagramEnv } from '@coursekit/core';
import { CC, DH, DW, alpha, arrow, axes, cached, cachedMaybe, circle, clamp, dot, line, panel, text } from '@coursekit/diagrams';
import {
  FACTS, FORK, LEVELS, MAIN, MATCH_GAMES, MCTS_NOMINAL, REWARDS, ROBOT, SAMPLERS, STEPS, TRAIN, TRAIN_SEEDS, VARIANTS, allPositions, bestMoves,
  checkpointAt, countTree, gradVariance, legal, mctsOf, minimax, play, playoutRun, randomAccuracy, robotAt, robotOf, robotSeeds, rolloutEval,
  search, sgsWeight, trainOf, treeLog10, GD, GD_OUTCOME, gdOf, valueBest, valueLoss, type Board, type RobotSeeds,
} from './model.ts';
import { OPENSPIEL } from './openspiel.ts';

type Ctx = CanvasRenderingContext2D;

/** The name of a cell of the board. */
export const CELL = ['coin', 'bord', 'coin', 'bord', 'centre', 'bord', 'coin', 'bord', 'coin'];
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 10 to a power, written with superscripts: 10¹²⁴. */
export const pow10 = (x: number): string => `10${String(Math.round(x)).split('').map((d) => SUP[+d]).join('')}`;

/** A tic-tac-toe board at (x, y), side s; `heat` shades the cells, `labels` writes in the empty ones. */
export function drawBoard(ctx: Ctx, b: Board, x: number, y: number, s: number, o: { heat?: number[]; labels?: string[]; labelCol?: (i: number) => string; ring?: number } = {}): void {
  const c = s / 3;
  for (let i = 0; i < 9; i++) {
    const cx = x + (i % 3) * c, cy = y + Math.floor(i / 3) * c;
    if (o.heat && b[i] === 0 && o.heat[i] > 0) { ctx.fillStyle = alpha(CC.acc, 0.12 + 0.6 * clamp(o.heat[i], 0, 1)); ctx.fillRect(cx + 2, cy + 2, c - 4, c - 4); }
    if (b[i] === 1) { const m = c * 0.25; line(ctx, cx + m, cy + m, cx + c - m, cy + c - m, CC.fg, 2.2); line(ctx, cx + c - m, cy + m, cx + m, cy + c - m, CC.fg, 2.2); }
    if (b[i] === -1) { ctx.save(); ctx.strokeStyle = CC.blue; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(cx + c / 2, cy + c / 2, c * 0.28, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    if (o.labels && b[i] === 0 && o.labels[i]) text(ctx, o.labels[i], cx + c / 2, cy + c / 2, o.labelCol ? o.labelCol(i) : CC.fg, Math.max(8, Math.min(11, c * 0.28)), 'center');
    if (o.ring === i) { ctx.save(); ctx.strokeStyle = CC.green; ctx.lineWidth = 2; ctx.strokeRect(cx + 2, cy + 2, c - 4, c - 4); ctx.restore(); }
  }
  for (let k = 1; k < 3; k++) { line(ctx, x + k * c, y, x + k * c, y + s, CC.dim, 1.2); line(ctx, x, y + k * c, x + s, y + k * c, CC.dim, 1.2); }
}

/** Axes whose horizontal label sits under the tick labels, at the left, so that no tick falls under it. */
function axes2(ctx: Ctx, x: number, y: number, w: number, h: number, xl: string, yl: string): void {
  axes(ctx, x, y, w, h, '', yl);
  text(ctx, xl, x, y + h + 22, CC.dim, 10);
}

// ------------------------------------------------------ 1. the game tree

/** Distinct positions after each number of moves, for the whole game. */
function tree(ctx: Ctx, e: DiagramEnv): void {
  const t = countTree();
  const x0 = 56, y0 = 50, w = 300, h = 140, M = 1600;
  axes2(ctx, x0, y0, w, h, 'coups joués', 'positions');
  for (const v of [500, 1000, 1500]) { const y = y0 + h - (v / M) * h; line(ctx, x0, y, x0 + w, y, CC.grid, 1); text(ctx, fr(v), x0 - 4, y, CC.dim, 9, 'right'); }
  const bw = w / 10;
  const lit = clamp(Math.round(e.v.depth ?? 2), 0, 9);
  t.byDepth.forEach((n, d) => {
    const bh = (n / M) * h;
    ctx.fillStyle = alpha(d === lit ? CC.acc : CC.blue, d === lit ? 0.85 : 0.5);
    ctx.fillRect(x0 + d * bw + 3, y0 + h - bh, bw - 6, bh);
    text(ctx, String(d), x0 + d * bw + bw / 2, y0 + h + 9, CC.dim, 9, 'center');
  });
  const n = t.byDepth[lit];
  text(ctx, `après ${lit} coup${lit > 1 ? 's' : ''} : ${fr(n)} position${n > 1 ? 's' : ''}`, x0 + 6, 12, CC.acc, 11);
  text(ctx, `en tout : ${fr(t.positions)} positions, ${fr(t.games)} parties différentes`, x0 + 6, 27, CC.dim, 10);
}

// ------------------------------------------- 2. the combinatorial explosion

/** Sizes of game trees, in powers of ten. */
function explosion(ctx: Ctx, e: DiagramEnv): void {
  const rows: [string, number, string][] = [
    ['morpion (parties)', Math.log10(countTree().games), CC.green],
    ['échecs (35⁸⁰)', treeLog10(FACTS.chessBranching, FACTS.chessDepth), CC.acc],
    ['go (positions légales)', FACTS.goLegalLog10, CC.violet],
    ['go (250¹⁵⁰)', treeLog10(FACTS.goBranching, FACTS.goDepth), CC.red],
  ];
  const x0 = 150, w = 175, M = 400;
  const X = (v: number) => x0 + (v / M) * w;
  const grow = clamp(e.t / 2, 0, 1);
  rows.forEach(([label, v, col], i) => {
    const y = 30 + i * 40;
    text(ctx, label, x0 - 8, y + 9, CC.fg, 10, 'right');
    ctx.fillStyle = alpha(col, 0.75); ctx.fillRect(x0, y, Math.max(2, (X(v) - x0) * grow), 18);
    text(ctx, pow10(v), X(v) * grow + x0 * (1 - grow) + 5, y + 9, CC.dim, 10);
  });
  const atoms = FACTS.atomsLog10;
  line(ctx, X(atoms), 22, X(atoms), 186, alpha(CC.blue, 0.8), 1, [4, 4]);
  text(ctx, `atomes de l’univers observable : ${pow10(atoms)}`, X(atoms) - 4, 200, CC.blue, 9, 'left');
  text(ctx, 'longueur des barres : l’exposant, pas le nombre', 14, DH - 12, CC.dim, 9);
}

// -------------------------------------------------------------- 3. minimax

/** The value of each answer of O in the course's position, by minimax. */
function minimaxDiag(ctx: Ctx, e: DiagramEnv): void {
  const b = FORK;
  const vals = legal(b).map((m) => [m, -minimax(play(b, m))] as const);
  const labels = Array(9).fill('');
  for (const [m, v] of vals) labels[m] = v > 0 ? 'gagne' : v === 0 ? 'nul' : 'perd';
  drawBoard(ctx, b, 24, 40, 150, { labels, labelCol: (i) => (labels[i] === 'perd' ? CC.red : labels[i] === 'nul' ? CC.green : CC.acc) });
  text(ctx, 'O doit jouer', 24, 22, CC.dim, 10);
  const x0 = 196;
  text(ctx, 'valeur de chaque réponse de O,', x0, 50, CC.fg, 10);
  text(ctx, 'si les deux joueurs jouent', x0, 64, CC.fg, 10);
  text(ctx, 'ensuite parfaitement', x0, 78, CC.fg, 10);
  text(ctx, `bords : nul (${bestMoves(b).length} coups)`, x0, 108, CC.green, 10);
  text(ctx, `coins : perdu (${vals.filter(([, v]) => v < 0).length} coups)`, x0, 124, CC.red, 10);
  const blink = Math.floor(e.t) % 2 === 0;
  text(ctx, 'après un coin, X joue l’autre', x0, 154, blink ? CC.dim : CC.faint, 9);
  text(ctx, 'coin et menace deux lignes', x0, 166, blink ? CC.dim : CC.faint, 9);
  text(ctx, `arbre complet : ${fr(countTree().nodes)} nœuds`, x0, 200, CC.dim, 9);
}

// ------------------------------------------------------- 4. random playouts

const playouts = (m: number): number[] => cached(`playouts-${m}`, () => playoutRun(FORK, m, 2000));
/** Random playouts after each answer of O: their average, against the true value. */
function rollouts(ctx: Ctx, e: DiagramEnv): void {
  const ms = legal(FORK);
  const n = Math.round(clamp(10 * Math.pow(2, e.t * 1.2), 10, 2000));
  const x0 = 46, y0 = 44, w = 300, h = 150;
  const Y = (v: number) => y0 + h / 2 - v * (h / 2);
  line(ctx, x0, Y(0), x0 + w, Y(0), CC.dim, 1);
  for (const v of [1, 0.5, 0, -0.5, -1]) { if (v) line(ctx, x0, Y(v), x0 + w, Y(v), CC.grid, 1); text(ctx, v === 0 ? '0' : `${v > 0 ? '+' : '−'}${fr(Math.abs(v), Math.abs(v) < 1 ? 1 : 0)}`, x0 - 6, Y(v), CC.dim, 9, 'right'); }
  const bw = w / ms.length;
  ms.forEach((m, i) => {
    const est = playouts(m)[n - 1];
    const truth = -minimax(play(FORK, m));
    const cx = x0 + i * bw + bw / 2;
    ctx.fillStyle = alpha(CC.acc, 0.7);
    const yy = Y(est);
    ctx.fillRect(cx - 12, Math.min(yy, Y(0)), 24, Math.abs(yy - Y(0)));
    line(ctx, cx - 16, Y(truth), cx + 16, Y(truth), truth < 0 ? CC.red : CC.green, 2.5);
    text(ctx, `${CELL[m]} ${m + 1}`, cx, y0 + h + 12, CC.fg, 9, 'center');
  });
  text(ctx, `moyenne de ${fr(n)} parties au hasard, pour O`, x0, 14, CC.acc, 11);
  text(ctx, 'trait : la vraie valeur (vert nul, rouge perdu)', x0, 29, CC.dim, 9);
}

// ----------------------------------------------------- 5. the four phases

function phases(ctx: Ctx, e: DiagramEnv): void {
  const boxes = ['sélection', 'expansion', 'évaluation', 'rétropropagation'];
  const lit = Math.floor(e.t / 1.1) % (boxes.length + 1);
  const bw = 88, gap = 6, x0 = (DW - (4 * bw + 3 * gap)) / 2, y = 70;
  boxes.forEach((b, i) => {
    const x = x0 + i * (bw + gap);
    panel(ctx, x, y, bw, 40, i < lit ? CC.acc : CC.faint, i < lit ? alpha(CC.acc, 0.12) : null);
    text(ctx, b, x + bw / 2, y + 20, i < lit ? CC.fg : CC.dim, 9, 'center');
    if (i) arrow(ctx, x - gap, y + 20, x - 1, y + 20, CC.dim, 1.2, 3);
  });
  text(ctx, 'une simulation, répétée des centaines de fois', DW / 2, 40, CC.dim, 11, 'center');
  const notes = ['descendre par le meilleur score', 'ajouter les coups suivants', 'estimer la position atteinte', 'remonter le résultat'];
  notes.forEach((s, i) => text(ctx, s, DW / 2, 140 + i * 16, i < lit ? CC.fg : CC.faint, 10, 'center'));
  text(ctx, 'score = Q + c·P·√N / (1 + n)', DW / 2, 214, CC.acc, 11, 'center', true);
}

// ------------------------------------------------- 6. the search, move by move

/** The search from the course's position: visits and average value of each answer. */
function puct(ctx: Ctx, e: DiagramEnv): void {
  const sims = Math.round(clamp(e.v.sims ?? MCTS_NOMINAL.sims, 1, 3200)), c = e.v.c ?? MCTS_NOMINAL.c;
  const s = cached(`puct-${sims}-${c}`, () => search(FORK, { sims, c, evaluate: rolloutEval, seed: 1 }));
  const ms = legal(FORK);
  drawBoard(ctx, FORK, 14, 54, 96, { heat: s.visits.map((v) => v / Math.max(1, ...s.visits)), ring: s.best });
  const x0 = 136, w = 230, h = 120, y0 = 50;
  const top = Math.max(1, ...s.visits);
  const bw = w / ms.length;
  ms.forEach((m, i) => {
    const bh = (s.visits[m] / top) * h;
    const good = bestMoves(FORK).includes(m);
    const cx = x0 + i * bw + bw / 2;
    ctx.fillStyle = alpha(good ? CC.green : CC.red, m === s.best ? 0.85 : 0.4);
    ctx.fillRect(cx - 11, y0 + h - bh, 22, bh);
    text(ctx, fr(s.visits[m]), cx, y0 + h - bh - 8, CC.fg, 9, 'center');
    text(ctx, CELL[m], cx, y0 + h + 10, CC.dim, 9, 'center');
    text(ctx, `Q ${s.q[m] >= 0 ? '+' : '−'}${fr(Math.abs(s.q[m]), 2)}`, cx, y0 + h + 23, CC.dim, 8, 'center');
  });
  const ok = bestMoves(FORK).includes(s.best);
  text(ctx, `${fr(sims)} simulations · c = ${fr(c, 1)} · barres : visites`, 14, 14, CC.fg, 11);
  text(ctx, `coup choisi (le plus visité) : ${CELL[s.best]}, ${ok ? 'il tient le nul' : 'il perd'}`, 14, 30, ok ? CC.green : CC.red, 10);
}

// ----------------------------------------------- 7. strength and simulations

const SIMS = [1, 10, 25, 50, 100, 200, 400, 800, 1200, 1600, 3200];
/** Losses against the perfect player for each number of simulations, with their 95 % intervals, and OpenSpiel's. */
function strength(ctx: Ctx, e: DiagramEnv): void {
  const x0 = 46, y0 = 46, w = 300, h = 140, G = MATCH_GAMES;
  axes2(ctx, x0, y0, w, h, 'simulations par coup', `défaites sur ${G}`);
  const X = (n: number) => x0 + (Math.log10(n) / Math.log10(3200)) * w, Y = (l: number) => y0 + h - (l / G) * h;
  for (const l of [25, 50, 75, 100]) { line(ctx, x0, Y(l), x0 + w, Y(l), CC.grid, 1); text(ctx, String(l), x0 - 4, Y(l), CC.dim, 9, 'right'); }
  for (const n of [1, 10, 100, 1000]) text(ctx, fr(n), X(n), y0 + h + 9, CC.dim, 9, 'center');
  let prev: [number, number] | null = null;
  for (const n of SIMS) {
    const r = cachedMaybe(`strength-${n}`, () => mctsOf({ sims: n, c: MCTS_NOMINAL.c }));
    if (!r) { prev = null; continue; }
    const p: [number, number] = [X(n), Y(r.vsPerfect.losses)];
    line(ctx, p[0], Y(r.ci[0] * G), p[0], Y(r.ci[1] * G), alpha(CC.blue, 0.6), 1);
    if (prev) line(ctx, prev[0], prev[1], p[0], p[1], alpha(CC.blue, 0.7), 1.5);
    dot(ctx, p[0], p[1], CC.blue, 2.5);
    prev = p;
  }
  for (const o of OPENSPIEL.bySims) circle(ctx, X(o.sims), Y(o.losses), 3.5, CC.violet, null, 1.3);
  const sims = Math.round(clamp(e.v.sims ?? MCTS_NOMINAL.sims, 1, 3200)), c = e.v.c ?? MCTS_NOMINAL.c;
  const cur = cachedMaybe(`strength-cur-${sims}-${c}`, () => mctsOf({ sims, c }));
  text(ctx, `bleu : ce cours (c = ${fr(MCTS_NOMINAL.c)}), intervalle à 95 % · cercles : OpenSpiel`, 14, 27, CC.dim, 9);
  if (cur) {
    dot(ctx, X(sims), Y(cur.vsPerfect.losses), CC.acc, 5);
    text(ctx, `${fr(sims)} simulations, c = ${fr(c, 1)} : ${fr(cur.vsPerfect.losses)} défaites (entre ${fr(cur.ci[0] * G)} et ${fr(cur.ci[1] * G)})`, x0, 12, CC.acc, 10);
  } else text(ctx, 'calcul des parties…', x0, 12, CC.dim, 10);
}

// ------------------------------------------------ 8. policy and value

/** What the network says about the course's position, after a number of games of self-play. */
function nets(ctx: Ctx, e: DiagramEnv): void {
  const run = trainOf(e.v);
  const cp = checkpointAt(run, e.v.games ?? TRAIN.games);
  const pr = cp.probe[1];
  drawBoard(ctx, FORK, 20, 56, 120, { heat: pr.p, labels: pr.p.map((x, i) => (FORK[i] === 0 ? pct(x) : '')) });
  text(ctx, `après ${fr(cp.games)} parties d’auto-jeu`, 20, 16, CC.fg, 11);
  text(ctx, 'politique : où chercher', 20, 40, CC.acc, 10);
  const x0 = 170;
  text(ctx, 'valeur : qui va gagner', x0, 40, CC.blue, 10);
  const v = pr.v, bx = x0, by = 64, bwid = 190, mid = bx + bwid / 2;
  ctx.fillStyle = CC.faint; ctx.fillRect(bx, by, bwid, 14);
  ctx.fillStyle = alpha(CC.blue, 0.8);
  ctx.fillRect(Math.min(mid, mid + (v * bwid) / 2), by, Math.abs((v * bwid) / 2), 14);
  line(ctx, mid, by - 4, mid, by + 18, CC.dim, 1);
  text(ctx, 'O perd', bx, by + 28, CC.dim, 9);
  text(ctx, 'O gagne', bx + bwid, by + 28, CC.dim, 9, 'right');
  text(ctx, `estimation pour O : ${v >= 0 ? '+' : '−'}${fr(Math.abs(v), 2)}`, x0, by + 48, CC.fg, 10);
  text(ctx, 'vraie valeur : 0 (partie nulle)', x0, by + 64, CC.dim, 9);
  text(ctx, `${fr(cp.known)} positions rencontrées sur ${fr(allPositions().length)}`, x0, by + 96, CC.dim, 9);
  text(ctx, 'le réseau répond aussi pour les autres', x0, by + 112, CC.dim, 9);
}

// ------------------------------------------------------- 9. AlphaGo 2016

function alphago(ctx: Ctx, e: DiagramEnv): void {
  const boxes: [string, string, number, number, string][] = [
    ['parties humaines', `${fr(FACTS.humanPositions)} millions de positions`, 14, 40, CC.blue],
    ['réseau de politique', `imite l’expert ${pct(FACTS.humanAccuracy)} du temps`, 200, 40, CC.acc],
    ['auto-jeu', 'la politique joue contre elle-même', 200, 112, CC.acc],
    ['réseau de valeur', 'apprend qui gagne', 14, 112, CC.acc],
    ['recherche Monte-Carlo', 'guidée par les deux réseaux', 107, 184, CC.green],
  ];
  const lit = Math.floor(e.t / 1.2) % (boxes.length + 1);
  boxes.forEach(([t, s2, x, y, col], i) => {
    panel(ctx, x, y, 166, 40, i < lit ? col : CC.faint, i < lit ? alpha(col, 0.12) : null);
    text(ctx, t, x + 83, y + 13, i < lit ? CC.fg : CC.dim, 10, 'center');
    text(ctx, s2, x + 83, y + 28, CC.dim, 8, 'center');
  });
  arrow(ctx, 182, 60, 198, 60, CC.dim, 1.2, 5);
  arrow(ctx, 283, 82, 283, 110, CC.dim, 1.2, 5);
  arrow(ctx, 198, 132, 182, 132, CC.dim, 1.2, 5);
  arrow(ctx, 97, 154, 150, 182, CC.dim, 1.2, 5);
  arrow(ctx, 283, 154, 240, 182, CC.dim, 1.2, 5);
  text(ctx, `AlphaGo, ${FACTS.leeYear} · AlphaGo Zero supprime la première case`, 14, 14, CC.fg, 11);
}

// -------------------------------------------------- 10. the self-play loop

function loop(ctx: Ctx, e: DiagramEnv): void {
  const run = trainOf(e.v);
  const cp = checkpointAt(run, e.v.games ?? TRAIN.games);
  const cx = DW / 2, cy = 124, R = 70;
  const nodes: [string, string][] = [
    ['réseau', `${fr(TRAIN.hidden)} neurones cachés`],
    ['auto-jeu', `${fr(TRAIN.sims)} simulations par coup`],
    ['parties', `${fr(cp.games)} jouées, ${fr(cp.distinct)} distinctes`],
    ['descente de gradient', 'cibles : résultat et visites'],
  ];
  const lit = Math.floor(e.t / 1.2) % 4;
  nodes.forEach(([t, s2], i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    const x = cx + Math.cos(a) * 112, y = cy + Math.sin(a) * R;
    panel(ctx, x - 66, y - 18, 132, 36, i === lit ? CC.acc : CC.faint, i === lit ? alpha(CC.acc, 0.12) : null);
    text(ctx, t, x, y - 6, i === lit ? CC.fg : CC.dim, 10, 'center');
    text(ctx, s2, x, y + 8, CC.dim, 8, 'center');
    const b2 = -Math.PI / 2 + ((i + 0.5) * Math.PI) / 2;
    dot(ctx, cx + Math.cos(b2) * R * 1.15, cy + Math.sin(b2) * R * 0.7, i === lit ? CC.acc : CC.faint, 3);
  });
  text(ctx, 'boucle', cx, cy, CC.dim, 10, 'center');
}

// ------------------------------------------------- 11. the learning curve

/** Share of optimal moves, along self-play: the policy alone, the policy with the search. */
function learning(ctx: Ctx, e: DiagramEnv): void {
  const run = trainOf(e.v);
  const G = run.checkpoints[run.checkpoints.length - 1].games;
  const x0 = 46, y0 = 50, w = 300, h = 128;
  axes2(ctx, x0, y0, w, h, 'parties d’auto-jeu', 'bons coups');
  const X = (g: number) => x0 + (g / G) * w, Y = (a: number) => y0 + h - ((a - 0.4) / 0.6) * h;
  for (const a of [0.6, 0.8, 1]) { line(ctx, x0, Y(a), x0 + w, Y(a), CC.grid, 1); text(ctx, pct(a), x0 - 4, Y(a), CC.dim, 9, 'right'); }
  for (const g of [200, 400]) text(ctx, fr(g), X(g), y0 + h + 9, CC.dim, 9, 'center');
  const base = randomAccuracy(allPositions());
  line(ctx, x0, Y(base), x0 + w, Y(base), alpha(CC.fg, 0.35), 1, [4, 4]);
  text(ctx, 'au hasard', x0 + w, Y(base) - 7, CC.dim, 9, 'right');
  const curve = (k: 'netAcc' | 'searchAcc', col: string) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    run.checkpoints.forEach((c, i) => (i ? ctx.lineTo(X(c.games), Y(c[k])) : ctx.moveTo(X(c.games), Y(c[k]))));
    ctx.stroke(); ctx.restore();
  };
  curve('netAcc', CC.acc);
  curve('searchAcc', CC.blue);
  const cp = checkpointAt(run, clamp(e.v.games ?? G, 0, G));
  line(ctx, X(cp.games), y0, X(cp.games), y0 + h, CC.dim, 1, [3, 3]);
  dot(ctx, X(cp.games), Y(cp.searchAcc), CC.blue, 4);
  dot(ctx, X(cp.games), Y(cp.netAcc), CC.acc, 4);
  text(ctx, `politique seule : ${pct(cp.netAcc)} de bons coups, perd ${pct(cp.netLoss)} des parties`, x0, 10, CC.acc, 10);
  text(ctx, `politique + recherche : ${pct(cp.searchAcc)} de bons coups, perd ${pct(cp.searchLoss)}`, x0, 24, CC.blue, 10);
}

// ------------------------------------------------- 12. generalisation

/** Share of optimal moves on the positions the network met, on those it never met, and at random. */
function generalize(ctx: Ctx, e: DiagramEnv): void {
  const run = trainOf(e.v);
  const cp = checkpointAt(run, e.v.games ?? TRAIN.games);
  const rows: [string, number, string][] = [
    ['au hasard (une table vide)', run.unseenBase, CC.dim],
    ['réseau, positions jamais vues', cp.netUnseen, CC.acc],
    ['réseau, positions rencontrées', cp.netSeen, CC.acc],
    ['réseau + recherche', cp.searchAcc, CC.blue],
  ];
  const x0 = 180, w = 160;
  rows.forEach(([label, v, col], i) => {
    const y = 40 + i * 38;
    text(ctx, label, x0 - 8, y + 9, CC.fg, 10, 'right');
    ctx.fillStyle = alpha(col === CC.dim ? CC.fg : col, col === CC.dim ? 0.3 : 0.75); ctx.fillRect(x0, y, v * w, 18);
    text(ctx, pct(v), x0 + v * w + 5, y + 9, CC.dim, 10);
  });
  text(ctx, `part des coups optimaux, après ${fr(cp.games)} parties`, 14, 14, CC.fg, 11);
  text(ctx, `${fr(allPositions().length - cp.known)} positions jamais rencontrées pendant l’auto-jeu`, 14, 200, CC.dim, 9);
  text(ctx, 'une table n’en saurait rien ; le réseau devine à partir des autres', 14, 214, CC.dim, 9);
}

// ---------------------------------------------- 13. exploration, five seeds

/** The losses of the search along self-play, for the five seeds of the current settings. */
function explore(ctx: Ctx, e: DiagramEnv): void {
  const x0 = 46, y0 = 50, w = 300, h = 128;
  axes2(ctx, x0, y0, w, h, 'parties d’auto-jeu', 'défaites');
  const G = TRAIN.games;
  const X = (g: number) => x0 + (g / G) * w, Y = (l: number) => y0 + h - l * h;
  for (const l of [0.5, 1]) { line(ctx, x0, Y(l), x0 + w, Y(l), CC.grid, 1); text(ctx, pct(l), x0 - 4, Y(l), CC.dim, 9, 'right'); }
  line(ctx, x0, Y(0.05), x0 + w, Y(0.05), alpha(CC.green, 0.5), 1, [4, 4]);
  for (const g of [200, 400]) text(ctx, fr(g), X(g), y0 + h + 9, CC.dim, 9, 'center');
  const noise = e.v.noise ?? TRAIN.noise, temp = Math.round(e.v.temp ?? TRAIN.temp);
  let ok = 0, done = 0;
  const dist: number[] = [];
  for (const seed of TRAIN_SEEDS) {
    const run = cachedMaybe(`train-${noise}-${temp}-${seed}`, () => trainOf({ noise, temp, tseed: seed }));
    if (!run) continue;
    done++;
    if (run.outcome === 'unbeatable') ok++;
    dist.push(run.distinct);
    ctx.save(); ctx.strokeStyle = run.outcome === 'unbeatable' ? alpha(CC.blue, 0.85) : alpha(CC.red, 0.75); ctx.lineWidth = 1.5; ctx.beginPath();
    run.checkpoints.forEach((c, i) => (i ? ctx.lineTo(X(c.games), Y(c.searchLoss)) : ctx.moveTo(X(c.games), Y(c.searchLoss))));
    ctx.stroke(); ctx.restore();
  }
  text(ctx, `bruit à la racine ${fr(noise, 2)} · coups tirés au hasard : ${fr(temp)} premiers`, x0, 10, CC.acc, 10);
  text(ctx, done < TRAIN_SEEDS.length ? `entraînement des ${TRAIN_SEEDS.length} graines… (${done})` : `${ok} graines sur ${TRAIN_SEEDS.length} sous 5 % de défaites · parties distinctes ≈ ${fr(dist.sort((a, b) => a - b)[2] ?? 0)}`, x0, 24, ok >= 4 ? CC.green : CC.red, 10);
}

// ---------------------------------------------------- 14. the robot chain

/** The sub-steps of the assembly of the small part and the success from each start state. */
function chain(ctx: Ctx, e: DiagramEnv): void {
  const run = robotOf(e.v);
  const T = run.hist[run.hist.length - 1].ep;
  const it = robotAt(run, e.arg !== undefined ? Number(e.arg) : Math.min(T, ((e.t * 400) % (T + 1600))));
  const q = it.e;
  const bw = 66, x0 = 18, y = 36;
  STEPS.forEach((s2, i) => {
    const x = x0 + i * (bw + 4);
    panel(ctx, x, y, bw, 34, alpha(CC.acc, 0.3 + 0.7 * q[i]), alpha(CC.acc, 0.08 + 0.3 * q[i]));
    text(ctx, s2, x + bw / 2, y + 11, CC.fg, 9, 'center');
    text(ctx, pct(q[i]), x + bw / 2, y + 25, CC.acc, 9, 'center');
  });
  text(ctx, `${VARIANTS[MAIN].name} : sous-étapes réussies, après ${fr(it.ep)} épisodes`, x0, 18, CC.fg, 10);
  const yb = 96, hb = 96;
  LEVELS.forEach((_, j) => {
    const x = x0 + (STEPS.length - 1 - j) * (bw + 4);
    const P = it.P[j];
    ctx.fillStyle = CC.faint; ctx.fillRect(x + 8, yb, bw - 16, hb);
    ctx.fillStyle = alpha(P >= 0.8 ? CC.green : P < 0.05 ? CC.red : CC.blue, 0.75);
    ctx.fillRect(x + 8, yb + hb * (1 - P), bw - 16, hb * P);
    text(ctx, pct(P), x + bw / 2, yb - 7, CC.fg, 9, 'center');
  });
  text(ctx, 'succès en partant de chaque état : produit des sous-étapes restantes', x0, yb + hb + 14, CC.dim, 9);
  text(ctx, '← pièces détachées', x0, yb + hb + 30, CC.dim, 9);
  text(ctx, 'pièce alignée →', DW - 18, yb + hb + 30, CC.dim, 9, 'right');
}

// --------------------------------------------- 15. success-guided sampling

/** The SGS weight against the success rate (Zhang et al.), and the share of episodes each variant receives. */
function sgs(ctx: Ctx, e: DiagramEnv): void {
  const o = { ...ROBOT, target: e.v.target ?? ROBOT.target };
  const run = robotOf(e.v);
  const T = run.hist[run.hist.length - 1].ep;
  const it = robotAt(run, e.arg !== undefined ? Number(e.arg) : Math.min(T, ((e.t * 400) % (T + 1600))));
  const x0 = 46, y0 = 50, w = 180, h = 120;
  axes2(ctx, x0, y0, w, h, 'taux de succès', 'poids');
  const X = (p: number) => x0 + p * w, Y = (q: number) => y0 + h - q * h;
  for (const p of [0.5, 1]) text(ctx, pct(p), X(p), y0 + h + 9, CC.dim, 9, 'center');
  ctx.save(); ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i <= 100; i++) { const p = i / 100; const yy = Y(sgsWeight(p, o)); i ? ctx.lineTo(X(p), yy) : ctx.moveTo(X(p), yy); }
  ctx.stroke(); ctx.restore();
  line(ctx, X(o.target), y0, X(o.target), y0 + h, alpha(CC.acc, 0.5), 1, [3, 3]);
  text(ctx, `cible t = ${pct(o.target)} · κ = ${fr(o.conc)} · T = ${fr(o.temp)}`, x0, 12, CC.acc, 10);
  text(ctx, `poids d’une configuration jamais réussie : ${pct(sgsWeight(0, o))} du maximum`, x0, 26, CC.dim, 9);
  const xr = 250;
  text(ctx, `épisodes, après ${fr(it.ep)}`, xr, 52, CC.fg, 10);
  VARIANTS.forEach((v, k) => {
    const y = 72 + k * 26;
    text(ctx, v.name, xr, y, CC.dim, 9);
    ctx.fillStyle = alpha(k === 3 ? CC.red : k === MAIN ? CC.acc : CC.blue, 0.75); ctx.fillRect(xr, y + 6, it.vshare[k] * 160, 8);
    text(ctx, pct(it.vshare[k]), xr + it.vshare[k] * 160 + 4, y + 10, CC.dim, 9);
  });
}

// ------------------------------------------------- 16. training curves

const ROBOT_OUTCOME_SHORT: Record<string, string> = { mastered: 'maîtrisé', slow: 'trop lent', capped: 'plafonne', stuck: 'bloqué', easy: 'que le facile', collapse: 'effondré' };
/** Success on the small part from scratch, along the episodes, for the trainings of the current settings (one per seed). */
function runsPlot(ctx: Ctx, rs: RobotSeeds, title: string, sub: string): void {
  const T = rs.runs[0].hist[rs.runs[0].hist.length - 1].ep;
  const x0 = 46, y0 = 52, w = 300, h = 128;
  axes2(ctx, x0, y0, w, h, 'épisodes', 'succès');
  const X = (i: number) => x0 + (i / T) * w, Y = (p: number) => y0 + h - p * h;
  for (const p of [0.5, 1]) { line(ctx, x0, Y(p), x0 + w, Y(p), CC.grid, 1); text(ctx, pct(p), x0 - 4, Y(p), CC.dim, 9, 'right'); }
  for (const k of [2000, 4000]) if (k <= T) text(ctx, fr(k), X(k), y0 + h + 9, CC.dim, 9, 'center');
  line(ctx, x0, Y(0.8), x0 + w, Y(0.8), alpha(CC.green, 0.4), 1, [4, 4]);
  for (const r of rs.runs) {
    ctx.save(); ctx.strokeStyle = r.outcome === 'mastered' ? alpha(CC.acc, 0.8) : alpha(CC.red, 0.8); ctx.lineWidth = 1.4; ctx.beginPath();
    r.hist.forEach((hh, i) => (i ? ctx.lineTo(X(hh.ep), Y(hh.P[4])) : ctx.moveTo(X(hh.ep), Y(hh.P[4]))));
    ctx.stroke(); ctx.restore();
  }
  text(ctx, title, x0, 10, rs.outcome === 'mastered' ? CC.green : CC.red, 10);
  text(ctx, sub, x0, 25, CC.dim, 9);
}
function curriculum(ctx: Ctx, e: DiagramEnv): void {
  const rs = robotSeeds(e.v);
  const m = rs.counts.mastered ?? 0;
  runsPlot(ctx, rs, `${SAMPLERS[e.v.sampler ?? ROBOT.sampler]} · ${ROBOT_OUTCOME_SHORT[rs.outcome]} · ${m} sur ${rs.runs.length} maîtrisent`,
    `${VARIANTS[MAIN].name} · épisodes réussis : ${pct(rs.runs[0].final.train)} · reprise : ${pct(rs.runs[0].final.x)}`);
}

// ----------------------------------------------- 17. naive or potential shaping

const WS = [0, 1, 2, 3, 4, 6];
function rewards(ctx: Ctx, e: DiagramEnv): void {
  const x0 = 46, y0 = 52, w = 300, h = 128;
  axes2(ctx, x0, y0, w, h, 'poids w de la récompense intermédiaire', 'à la fin');
  const X = (v: number) => x0 + (v / 6) * w, Y = (p: number) => y0 + h - p * h;
  for (const p of [0.5, 1]) { line(ctx, x0, Y(p), x0 + w, Y(p), CC.grid, 1); text(ctx, pct(p), x0 - 4, Y(p), CC.dim, 9, 'right'); }
  for (const v of [2, 4]) text(ctx, fr(v), X(v), y0 + h + 9, CC.dim, 9, 'center');
  const med = (rs: RobotSeeds) => { const xs = rs.runs.map((r) => r.final.P[4]).sort((a, b) => a - b); return (xs[1] + xs[2]) / 2; };
  for (const [reward, col] of [[1, CC.red], [2, CC.green]] as const) {
    const pts = WS.map((v) => cachedMaybe(`rew-${reward}-${v}`, () => robotSeeds({ reward, w: v })));
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    let started = false;
    pts.forEach((rs, i) => { if (!rs) { started = false; return; } const yy = Y(med(rs)); started ? ctx.lineTo(X(WS[i]), yy) : ctx.moveTo(X(WS[i]), yy); started = true; });
    ctx.stroke(); ctx.restore();
  }
  const wv = e.v.w ?? ROBOT.w, rw = e.v.reward ?? ROBOT.reward;
  const cur = robotSeeds(e.v);
  dot(ctx, X(wv), Y(med(cur)), CC.fg, 5);
  text(ctx, `${rw === 2 ? 'potentiel' : rw === 1 ? 'proximité' : REWARDS[rw]}, w = ${fr(wv, 1)} : succès ${pct(med(cur))} · reprise ${pct(cur.runs[0].final.x)}`, x0, 10, rw === 1 ? CC.red : rw === 2 ? CC.green : CC.fg, 10);
  text(ctx, 'rouge : points de proximité · vert : façonnage par potentiel', x0, 25, CC.dim, 9);
}
// --------------------------------------------- 17. AlphaNIST's results

function nist(ctx: Ctx, e: DiagramEnv): void {
  const rows: [string, number, string][] = [
    ['partagée, binaire', FACTS.nist.sharedBinary, CC.green],
    ['séparées, binaire', FACTS.nist.separateBinary, CC.blue],
    ['séparées, dense', FACTS.nist.separateDense, CC.violet],
    ['partagée, dense', FACTS.nist.sharedDense, CC.red],
  ];
  const x0 = 140, w = 190;
  const grow = clamp(e.t / 1.5, 0, 1);
  rows.forEach(([label, v, col], i) => {
    const y = 40 + i * 36;
    text(ctx, label, x0 - 8, y + 9, CC.fg, 10, 'right');
    ctx.fillStyle = alpha(col, 0.75); ctx.fillRect(x0, y, v * w * grow, 18);
    text(ctx, `${fr(v * 100, 1)} %`, x0 + v * w * grow + 5, y + 9, CC.dim, 10);
  });
  text(ctx, `AlphaNIST : succès sur les ${FACTS.nistTasks} assemblages (entraînement)`, 14, 14, CC.fg, 11);
  text(ctx, 'politique partagée : un seul réseau pour toutes les tâches', 14, 196, CC.dim, 9);
  text(ctx, 'dense : récompenses pour l’approche et l’alignement', 14, 212, CC.dim, 9);
}

// ------------------------------------------- 18. a slope, in one dimension

/** Gradient descent on L(w) = (w − 3)², from w = 0: each step goes against the slope. `arg`: the learning rate. */
function slope1d(ctx: Ctx, e: DiagramEnv): void {
  const eta = e.arg !== undefined ? Number(e.arg) : 0.2;
  const x0 = 46, y0 = 52, w = 300, h = 136;
  axes2(ctx, x0, y0, w, h, 'paramètre w', 'erreur');
  const X = (v: number) => x0 + ((v + 1) / 8) * w, Y = (L: number) => y0 + h - (L / 16) * h;
  for (const v of [0, 3, 6]) text(ctx, fr(v), X(v), y0 + h + 9, CC.dim, 9, 'center');
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0 - 4, w, h + 4); ctx.clip();
  ctx.strokeStyle = CC.blue; ctx.lineWidth = 2; ctx.beginPath();
  for (let v = -1; v <= 7; v += 0.05) { const yy = Y((v - 3) ** 2); v === -1 ? ctx.moveTo(X(v), yy) : ctx.lineTo(X(v), yy); }
  ctx.stroke();
  const pts: number[] = [0];
  for (let k = 0; k < 8; k++) { const v = pts[pts.length - 1]; pts.push(v - eta * 2 * (v - 3)); }
  const shown = Math.min(pts.length, 1 + Math.floor(e.t / 0.8));
  for (let k = 1; k < shown; k++) arrow(ctx, X(pts[k - 1]), Y((pts[k - 1] - 3) ** 2), X(pts[k]), Y((pts[k] - 3) ** 2), CC.acc, 1.5, 5);
  for (let k = 0; k < shown; k++) dot(ctx, X(pts[k]), Y((pts[k] - 3) ** 2), k === shown - 1 ? CC.fg : CC.acc, 3);
  ctx.restore();
  const v = pts[shown - 1];
  text(ctx, `taux d’apprentissage η = ${fr(eta, 2)} · pas ${shown - 1}`, x0, 12, CC.acc, 11);
  text(ctx, `w = ${fr(v, 2)} · pente 2(w − 3) = ${fr(2 * (v - 3), 2)} · nouveau w = w − η × pente`, x0, 27, CC.dim, 9);
}

// ------------------------------------------- 19. descent on the error map

const AMIN = -0.4, AMAX = 1.4, BMIN = -0.2, BMAX = 1.6;
/** The error of the small value network over (a, b), and the path of gradient descent for the current η. */
function descent(ctx: Ctx, e: DiagramEnv): void {
  const run = gdOf(e.v);
  const best = valueBest();
  const mx = 14, my = 30, S = 190;
  const X = (a: number) => mx + ((a - AMIN) / (AMAX - AMIN)) * S, Y = (b: number) => my + S - ((b - BMIN) / (BMAX - BMIN)) * S;
  const grid = cached('loss-grid', () => {
    const n = 38, out: number[][] = [];
    for (let i = 0; i < n; i++) { out.push([]); for (let j = 0; j < n; j++) out[i].push(valueLoss(AMIN + ((i + 0.5) / n) * (AMAX - AMIN), BMIN + ((j + 0.5) / n) * (BMAX - BMIN))); }
    return out;
  });
  const n = grid.length, cs = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = clamp((Math.log(grid[i][j]) - Math.log(best.L)) / 2.2, 0, 1);
    ctx.fillStyle = alpha(CC.blue, 0.55 * (1 - k) + 0.04);
    ctx.fillRect(mx + i * cs, my + S - (j + 1) * cs, cs + 0.5, cs + 0.5);
  }
  panel(ctx, mx, my, S, S, CC.faint, null, 2);
  ctx.save(); ctx.beginPath(); ctx.rect(mx, my, S, S); ctx.clip();
  const shown = Math.min(run.path.length, 1 + Math.floor(e.t / 0.25));
  for (let k = 1; k < shown; k++) line(ctx, X(run.path[k - 1].a), Y(run.path[k - 1].b), X(run.path[k].a), Y(run.path[k].b), CC.acc, 1.5);
  for (let k = 0; k < shown; k++) dot(ctx, X(run.path[k].a), Y(run.path[k].b), CC.acc, 2.2);
  ctx.restore();
  dot(ctx, X(best.a), Y(best.b), CC.green, 4);
  text(ctx, 'a (poids des menaces)', mx, my + S + 12, CC.dim, 9);
  text(ctx, 'b ↑', mx + 2, my - 8, CC.dim, 9);
  const last = run.path[shown - 1];
  const xr = 222, col = run.outcome === 'converged' ? CC.green : CC.red;
  text(ctx, `η = ${fr(e.v.eta ?? GD.eta, 3)}`, xr, 40, CC.acc, 12);
  text(ctx, `pas ${shown - 1} sur ${GD.steps}`, xr, 60, CC.dim, 10);
  text(ctx, `erreur : ${last.L < 1000 ? fr(last.L, 3) : pow10(Math.log10(last.L))}`, xr, 80, CC.fg, 10);
  text(ctx, `minimum : ${fr(best.L, 3)}`, xr, 96, CC.green, 10);
  text(ctx, GD_OUTCOME[run.outcome], xr, 120, col, 11);
  text(ctx, 'fond clair : erreur faible', xr, 168, CC.dim, 9);
  text(ctx, 'point vert : le minimum', xr, 182, CC.dim, 9);
  text(ctx, 'v = a × (menaces) + b', xr, 206, CC.fg, 10, 'left', true);
}

// ---------------------------------------- 20. eight trainings of the robot

/** Eight trainings of the robot that differ only by luck: step size, batch, baseline. */
function seeds(ctx: Ctx, e: DiagramEnv): void {
  const rs = robotSeeds({ ...e.v, sampler: 0, nseeds: 8 });
  const bad = rs.runs.filter((r) => r.outcome !== 'mastered').length;
  runsPlot(ctx, rs, `pas ${fr(e.v.lr ?? ROBOT.lr)} · lots de ${fr(e.v.batch ?? ROBOT.batch)} · ${(e.v.baseline ?? ROBOT.baseline) ? 'avec' : 'sans'} base · ${bad} sur 8 plafonnent`,
    'huit graines, même réglage · rouge : ne reprend plus l’écrou');
}

// ---------------------------------------------------- 20 bis. the variance

/** How much the gradient varies from one episode to the next, with and without a baseline, and with shaping. */
function variance(ctx: Ctx, e: DiagramEnv): void {
  const v = gradVariance();
  const rows: [string, number, string][] = [
    ['sans base de référence', v.plain, CC.red],
    ['avec base de référence', v.baseline, CC.green],
    ...v.ws.map((w, i) => [`potentiel, w = ${fr(w, 2)}`, v.shaped[i], CC.blue] as [string, number, string]),
  ];
  const x0 = 170, wd = 170, M = Math.max(...rows.map((r) => r[1]));
  const grow = clamp(e.t / 1.5, 0, 1);
  rows.forEach(([label, val, col], i) => {
    const y = 40 + i * 30;
    text(ctx, label, x0 - 8, y + 8, CC.fg, 10, 'right');
    ctx.fillStyle = alpha(col, 0.75); ctx.fillRect(x0, y, (val / M) * wd * grow, 16);
    text(ctx, pct(val / v.plain), x0 + (val / M) * wd * grow + 5, y + 8, CC.dim, 9);
  });
  text(ctx, 'variance du gradient d’un épisode (100 % : sans base)', 14, 14, CC.fg, 11);
  text(ctx, 'même direction en moyenne, moins de hasard d’un épisode à l’autre', 14, 212, CC.dim, 9);
}

// --------------------------------------------- 21. credit assignment

/** One failed episode: every action taken is made less likely, the right ones too. */
function credit(ctx: Ctx, e: DiagramEnv): void {
  const ok = [true, true, true, false];
  const bw = 66, x0 = 24, y = 70;
  STEPS.forEach((s, i) => {
    const x = x0 + i * (bw + 4);
    const done = i < ok.length, good = done && ok[i];
    panel(ctx, x, y, bw, 34, !done ? CC.faint : good ? CC.green : CC.red, !done ? null : alpha(good ? CC.green : CC.red, 0.12));
    text(ctx, s, x + bw / 2, y + 11, done ? CC.fg : CC.dim, 9, 'center');
    text(ctx, !done ? 'pas joué' : good ? 'réussi' : 'raté', x + bw / 2, y + 25, !done ? CC.dim : good ? CC.green : CC.red, 9, 'center');
    if (done) {
      const bob = Math.sin(e.t * 3) * 3;
      arrow(ctx, x + bw / 2, y + 48 + bob, x + bw / 2, y + 76 + bob, CC.pink, 2, 6);
    }
  });
  text(ctx, 'un épisode raté : récompense 0, moins que la moyenne du lot', 24, 30, CC.fg, 10);
  text(ctx, 'l’essai est entier : il ne dit pas quelle action a causé l’échec', 24, 46, CC.dim, 9);
  text(ctx, 'flèches : chaque action jouée devient moins probable,', 24, 180, CC.pink, 10);
  text(ctx, 'y compris les trois qui avaient réussi', 24, 196, CC.pink, 10);
  text(ctx, 'seule la moyenne de nombreux épisodes sépare les bonnes des mauvaises', 24, 218, CC.dim, 9);
}

export const DIAGRAMS = {
  tree, explosion, minimax: minimaxDiag, rollouts, phases, puct, strength, nets, alphago, loop, learning, generalize, explore, chain, sgs,
  curriculum, rewards, nist, slope1d, descent, seeds, variance, credit,
};
