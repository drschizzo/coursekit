// The course's stage: scenes drawn from the model, behind the panels, each
// for the chapters that explain what it shows. A go board (the problem); the
// game tree of tic-tac-toe (minimax); random games played from the course's
// position (the estimate by playouts); the search tree of MCTS growing from
// that position; a neural network, the AlphaZero one or the two-parameter
// value network whose parameters follow gradient descent; games of self-play
// replayed; and the robot assembling a nut on a bolt with the policy its
// training produced.

import { fr, pct } from '@coursekit/core';
import { canvasStage } from '@coursekit/ui';
import {
  EMPTY, FACTS, FORK, GD, MCTS_NOMINAL, ROBOT_OUTCOME, TRAIN, TRAIN_OUTCOME, after, bestMoves, checkpointAt, gdOf, legal, play, playoutGames, rng,
  robotOf, rolloutEval, search, trainOf, type Node, type RobotRun, type TrainRun,
} from './model.ts';

type Ctx = CanvasRenderingContext2D;
interface Box { x: number; y: number; w: number; h: number }
const INK = 'rgba(230,234,245,.85)', DIM = 'rgba(230,234,245,.5)', FAINT = 'rgba(230,234,245,.18)';
const ACC = '#ffb35c', BLUE = '#7c9cff', GREEN = '#5ee0a0', RED = '#ff6b7a';

/** The read-out, at the top of the safe area (under the scene's label); on a short safe area, its first two lines only. Returns its bottom. */
function hud(ctx: Ctx, safe: Box, lines: [string, string][]): number {
  const small = safe.h < 340;
  const shown = small ? lines.slice(0, 2) : lines;
  const lh = small ? 14 : 17, y = safe.y + (small ? 54 : 46);
  ctx.font = `${small ? 11 : 12}px Inter, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  shown.forEach(([s, col], i) => { ctx.fillStyle = col; ctx.fillText(s, safe.x + 12, y + i * lh); });
  return y + (shown.length - 1) * lh + 8;
}
function bg(ctx: Ctx, w: number, h: number): void { ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h); }

/** A tic-tac-toe board, centred at (cx, cy). */
function board(ctx: Ctx, b: number[], cx: number, cy: number, s: number, ring = -1): void {
  const c = s / 3, x = cx - s / 2, y = cy - s / 2;
  ctx.lineWidth = 2; ctx.strokeStyle = DIM;
  for (let k = 1; k < 3; k++) {
    ctx.beginPath(); ctx.moveTo(x + k * c, y); ctx.lineTo(x + k * c, y + s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + k * c); ctx.lineTo(x + s, y + k * c); ctx.stroke();
  }
  b.forEach((v, i) => {
    const px = x + (i % 3) * c + c / 2, py = y + Math.floor(i / 3) * c + c / 2, r = c * 0.28;
    ctx.lineWidth = Math.max(2, c * 0.06);
    if (v === 1) { ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r); ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r); ctx.stroke(); }
    if (v === -1) { ctx.strokeStyle = BLUE; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke(); }
    if (i === ring) { ctx.strokeStyle = ACC; ctx.lineWidth = 2; ctx.strokeRect(px - c / 2 + 4, py - c / 2 + 4, c - 8, c - 8); }
  });
}

// ------------------------------------------------------------- the go board

const GO_MOVES = (() => {
  const r = rng(19), n = FACTS.goSide, taken = new Set<number>(), out: number[] = [];
  while (out.length < 160) {
    // stones gather near the corners and the sides first, like a real opening
    const a = Math.floor(r() * n), b = Math.floor(r() * n);
    const k = a * n + b;
    if (!taken.has(k) && (out.length > 30 || Math.min(a, b, n - 1 - a, n - 1 - b) <= 4)) { taken.add(k); out.push(k); }
  }
  return out;
})();

// ------------------------------------------------------------ the search tree

interface TreeData { root: Node; best: number; sims: number; c: number; nodes: { n: Node; d: number; x: number }[] }

function prepareTree(s: Record<string, number>): TreeData {
  const sims = Math.round(Math.min(400, Math.max(1, s.sims ?? MCTS_NOMINAL.sims))), c = s.c ?? MCTS_NOMINAL.c;
  const res = search(FORK, { sims, c, evaluate: rolloutEval, seed: 1 });
  // the nodes visited at least twice, three levels deep, laid out by subtree width
  const nodes: TreeData['nodes'] = [];
  const keep = (n: Node, d: number): Node[] => (d >= 3 ? [] : (n.children ?? []).filter((ch) => ch.N >= 2));
  const width = (n: Node, d: number): number => { const k = keep(n, d); return k.length ? k.reduce((s2, ch) => s2 + width(ch, d + 1), 0) : 1; };
  const total = width(res.root, 0);
  const walk = (n: Node, d: number, x0: number): void => {
    nodes.push({ n, d, x: (x0 + width(n, d) / 2) / total });
    let x = x0;
    for (const ch of keep(n, d)) { walk(ch, d + 1, x); x += width(ch, d + 1); }
  };
  walk(res.root, 0, 0);
  // revealed level by level, the most visited first
  nodes.sort((a, b) => a.d - b.d || b.n.N - a.n.N);
  return { root: res.root, best: res.best, sims, c, nodes };
}

// ------------------------------------------------------------ the game tree

/** A small board at (cx, cy), for the nodes of the game tree. */
function mini(ctx: Ctx, b: number[], cx: number, cy: number, s: number): void {
  ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
  const c = s / 3;
  b.forEach((v, i) => {
    if (!v) return;
    ctx.fillStyle = v === 1 ? INK : BLUE;
    ctx.fillRect(cx - s / 2 + (i % 3) * c + c * 0.2, cy - s / 2 + Math.floor(i / 3) * c + c * 0.2, c * 0.6, c * 0.6);
  });
}

// ---------------------------------------------------------- random playouts

/** Random games after O's corner (cell 2) and after O's edge (cell 1), as the model plays them. */
const PLAYOUTS = (() => { let g: { m: number; moves: number[]; v: number }[] | null = null; return () => (g ??= [2, 1].flatMap((m) => playoutGames(FORK, m, 40).map((x) => ({ m, ...x })))); })();

// ---------------------------------------------------------------- the robot

interface RobotData { run: RobotRun }
/** The input of the network for the course's position: the cells of the player to move (O), then X's. */
const encodeFork = (): number[] => { const x = Array(18).fill(0); FORK.forEach((v, i) => { if (v === -1) x[i] = 1; else if (v === 1) x[9 + i] = 1; }); return x; };
const STEP_NAMES = ['saisir', 'orienter', 'approcher', 'aligner', 'insérer'];

export const stage = () => canvasStage({
  gametree: {
    label: 'L’arbre du morpion, depuis le plateau vide',
    draw(ctx, w, h, t, _s, _d, safe) {
      bg(ctx, w, h);
      const top = hud(ctx, safe, [
        ['l’arbre du morpion, depuis le plateau vide', INK],
        ['une rangée par coup joué, une branche par coup possible', DIM],
        ['la rangée 3 est déjà trop dense pour être dessinée', DIM],
      ]) + 14;
      const rows = 4, rowH = Math.max(30, (safe.y + safe.h - 20 - top) / rows);
      // the row labels on the left, the tree on their right
      const left = 62, X = (f: number) => safe.x + left + f * (safe.w - left - 16);
      const shownRows = 1 + (Math.floor(t / 1.5) % (rows + 2));
      ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      // row 1: the 9 first moves of X, as small boards; row 2: O's 8 answers under each; row 3: a dense band
      const s1 = Math.min(26, (safe.w - left - 16) / 9 - 6, rowH * 0.6);
      const y = (k: number) => top + k * rowH + rowH * 0.4;
      if (shownRows > 0) mini(ctx, EMPTY, X(0.5), y(0), s1);
      legal(EMPTY).forEach((m, i) => {
        const fx = (i + 0.5) / 9;
        if (shownRows > 1) {
          ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(0.5), y(0) + s1 / 2); ctx.lineTo(X(fx), y(1) - s1 / 2); ctx.stroke();
          mini(ctx, play(EMPTY, m), X(fx), y(1), s1);
        }
        if (shownRows > 2) {
          const b1 = play(EMPTY, m);
          legal(b1).forEach((m2, j) => {
            const f2 = (i + (j + 0.5) / 8) / 9;
            ctx.strokeStyle = FAINT; ctx.beginPath(); ctx.moveTo(X(fx), y(1) + s1 / 2); ctx.lineTo(X(f2), y(2) - 3); ctx.stroke();
            ctx.fillStyle = m2 === 4 ? ACC : BLUE; ctx.beginPath(); ctx.arc(X(f2), y(2), 2, 0, Math.PI * 2); ctx.fill();
            if (shownRows > 3) { ctx.strokeStyle = 'rgba(124,156,255,.25)'; ctx.beginPath(); for (let k = 0; k < 7; k++) { ctx.moveTo(X(f2), y(2) + 3); ctx.lineTo(X(f2) + (k - 3) * 0.8, y(3) - 4); } ctx.stroke(); }
          });
        }
      });
      if (shownRows > 3) { ctx.fillStyle = 'rgba(124,156,255,.35)'; ctx.fillRect(X(0), y(3) - 4, X(1) - X(0), 6); }
      ['départ', '1 coup', '2 coups', '3 coups'].forEach((lab, k) => { if (k < shownRows) { ctx.fillStyle = DIM; ctx.fillText(lab, safe.x + 8, y(k) + 4); } });
    },
  },
  playouts: {
    label: 'Des parties au hasard, depuis la position du cours',
    draw(ctx, w, h, t, _s, _d, safe) {
      bg(ctx, w, h);
      const games = PLAYOUTS(), per = 0.45, pause = 1.2;
      // the games alternate: after the corner, after the edge
      const order = games.map((_, i) => (i % 2 === 0 ? i / 2 : games.length / 2 + (i - 1) / 2));
      const dur = (g: { moves: number[] }) => g.moves.length * per + pause;
      const total = order.reduce((a, k) => a + dur(games[k]), 0);
      let u = t % total, i = 0;
      while (u > dur(games[order[i]])) { u -= dur(games[order[i]]); i++; }
      const g = games[order[i]];
      const shown = Math.min(g.moves.length, Math.floor(u / per) + 1);
      const b = after([0, 4, 8, ...g.moves.slice(0, shown)]);
      const done = shown === g.moves.length && u > g.moves.length * per;
      const res = g.v > 0 ? 'O gagne : +1' : g.v < 0 ? 'O perd : −1' : 'partie nulle : 0';
      const top = hud(ctx, safe, [
        [`partie au hasard n° ${fr(Math.floor(i / 2) + 1)}, après le ${g.m === 2 ? 'coin' : 'bord'} de O`, INK],
        [done ? res : 'les deux joueurs tirent leurs coups au hasard', done ? (g.v > 0 ? GREEN : g.v < 0 ? RED : DIM) : DIM],
        ['chaque partie va jusqu’au bout', DIM],
      ]);
      const side = Math.max(40, Math.min(safe.w * 0.6, safe.y + safe.h - top - 24, 260));
      board(ctx, b, safe.x + safe.w / 2, top + 12 + side / 2, side, g.moves[shown - 1]);
    },
  },
  net: {
    label: 'Un réseau de neurones',
    prepare: (s) => (s.small ? gdOf({ eta: s.eta ?? GD.eta }) : checkpointAt(trainOf({}), 1e9).probe[1]),
    draw(ctx, w, h, t, s, data, safe) {
      bg(ctx, w, h);
      ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      if (s.small) {
        // the two-parameter value network, its parameters along the descent
        const run = data as ReturnType<typeof gdOf>;
        const k = Math.min(run.path.length - 1, Math.floor(t / 0.4) % (run.path.length + 6));
        const p = run.path[k];
        const big = (x: number) => (Math.abs(x) < 1e4 ? fr(x, 2) : x > 0 ? '+∞' : '−∞');
        const top = hud(ctx, safe, [
          ['v = a × menaces + b : deux paramètres', INK],
          [`pas ${fr(k)} sur ${fr(GD.steps)} : a = ${big(p.a)}, b = ${big(p.b)}`, ACC],
          [`erreur : ${big(p.L)}`, run.outcome === 'diverged' ? RED : run.outcome === 'converged' ? GREEN : DIM],
          [`η = ${fr(s.eta ?? GD.eta, 3)}`, DIM],
        ]);
        const cy = top + Math.max(40, (safe.y + safe.h - top) / 2), xi = safe.x + safe.w * 0.25, xo = safe.x + safe.w * 0.75;
        const wid = Math.max(1, Math.min(10, Math.abs(p.a) * 6));
        ctx.strokeStyle = p.a >= 0 ? ACC : BLUE; ctx.lineWidth = wid; ctx.beginPath(); ctx.moveTo(xi + 22, cy); ctx.lineTo(xo - 22, cy); ctx.stroke();
        for (const [x, lab] of [[xi, 'menaces'], [xo, 'v']] as const) {
          ctx.fillStyle = '#1a2130'; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, cy, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = INK; ctx.fillText(lab, x, cy + 40);
        }
        ctx.fillStyle = ACC; ctx.fillText(`a = ${big(p.a)}`, (xi + xo) / 2, cy - 14);
        ctx.fillStyle = DIM; ctx.fillText(`+ b = ${big(p.b)}`, xo, cy - 30);
        return;
      }
      const pr = data as { p: number[]; v: number };
      const top = hud(ctx, safe, [
        ['un réseau de neurones : 18 entrées, 32 neurones', INK],
        ['sorties : probabilité par case · nombre de −1 à +1', DIM],
      ]) + 10;
      const H = Math.max(80, safe.y + safe.h - 24 - top);
      const cols = [safe.x + safe.w * 0.12, safe.x + safe.w * 0.4, safe.x + safe.w * 0.68, safe.x + safe.w * 0.88];
      const ys = (n: number) => Array.from({ length: n }, (_, i) => top + ((i + 0.5) / n) * H);
      const inY = ys(18), hidY = ys(32);
      // the connections, and a pulse that runs from the board to the outputs
      ctx.strokeStyle = 'rgba(230,234,245,.06)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const a of inY) for (let j = 0; j < 32; j += 3) { ctx.moveTo(cols[0], a); ctx.lineTo(cols[1], hidY[j]); }
      for (const a of hidY) { ctx.moveTo(cols[1], a); ctx.lineTo(cols[2], top + H * 0.35); ctx.moveTo(cols[1], a); ctx.lineTo(cols[2], top + H * 0.82); }
      ctx.stroke();
      const x = encodeFork();
      inY.forEach((y, i) => { ctx.fillStyle = x[i] ? (i < 9 ? BLUE : INK) : FAINT; ctx.beginPath(); ctx.arc(cols[0], y, 3, 0, Math.PI * 2); ctx.fill(); });
      const pulse = (t * 0.8) % 1;
      hidY.forEach((y, j) => { ctx.fillStyle = `rgba(255,179,92,${0.15 + 0.6 * Math.max(0, 1 - Math.abs(pulse - 0.5) * 4) * ((j * 7) % 5) / 4})`; ctx.beginPath(); ctx.arc(cols[1], y, 3, 0, Math.PI * 2); ctx.fill(); });
      // the outputs: the probabilities on a board, the estimate on a bar
      const side = Math.min(safe.w * 0.22, H * 0.5);
      const bx = cols[2] - side / 2 + side * 0.2, by = top + H * 0.35 - side / 2, c = side / 3;
      pr.p.forEach((q, i) => {
        const cx = bx + (i % 3) * c, cy = by + Math.floor(i / 3) * c;
        ctx.fillStyle = FORK[i] ? 'rgba(230,234,245,.08)' : `rgba(255,179,92,${0.1 + 0.8 * q})`; ctx.fillRect(cx + 1, cy + 1, c - 2, c - 2);
      });
      const vy = top + H * 0.82, vw = side;
      ctx.fillStyle = FAINT; ctx.fillRect(bx, vy - 5, vw, 10);
      ctx.fillStyle = BLUE; ctx.fillRect(bx + vw / 2, vy - 5, (pr.v * vw) / 2, 10);
      ctx.fillStyle = DIM; ctx.fillText('entrées : le plateau', cols[0] + 8, top + H + 16);
    },
  },
  go: {
    label: `Un plateau de go, ${FACTS.goSide} × ${FACTS.goSide}`,
    draw(ctx, w, h, t, _s, _d, safe) {
      bg(ctx, w, h);
      const n = FACTS.goSide;
      const top = hud(ctx, safe, [
        [`${fr(n * n)} intersections`, INK],
        [`environ ${fr(FACTS.goBranching)} coups possibles à chaque tour`, DIM],
        [`une partie compte souvent ${fr(FACTS.goDepth)} coups ou plus`, DIM],
      ]);
      const side = Math.max(40, Math.min(safe.w - 40, safe.y + safe.h - top - 24));
      const x0 = safe.x + (safe.w - side) / 2, y0 = top + 12;
      ctx.fillStyle = '#3a2c17'; ctx.fillRect(x0 - side * 0.04, y0 - side * 0.04, side * 1.08, side * 1.08);
      const g = side / (n - 1);
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        ctx.beginPath(); ctx.moveTo(x0, y0 + i * g); ctx.lineTo(x0 + side, y0 + i * g); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0 + i * g, y0); ctx.lineTo(x0 + i * g, y0 + side); ctx.stroke();
      }
      const k = Math.floor((t * 2.5) % (GO_MOVES.length + 12));
      GO_MOVES.slice(0, k).forEach((m, i) => {
        const a = Math.floor(m / n), b = m % n;
        ctx.fillStyle = i % 2 === 0 ? '#111' : '#eee';
        ctx.beginPath(); ctx.arc(x0 + b * g, y0 + a * g, g * 0.45, 0, Math.PI * 2); ctx.fill();
      });
    },
  },
  tree: {
    label: 'La recherche Monte-Carlo, depuis la position du cours',
    prepare: prepareTree,
    draw(ctx, w, h, t, _s, data, safe) {
      bg(ctx, w, h);
      const d = data as TreeData;
      const ok = bestMoves(FORK).includes(d.best);
      const top = hud(ctx, safe, [
        [`position du cours · ${fr(d.sims)} simulations · c = ${fr(d.c, 1)}`, INK],
        [`coup choisi : case ${d.best + 1}, ${ok ? 'un bord' : 'un coin'}`, ok ? GREEN : RED],
        ['taille d’un nœud : nombre de visites', DIM],
        ['vert : tient le nul · rouge : perd', DIM],
      ]) + 24;
      const rowH = Math.max(12, (safe.y + safe.h - 24 - top) / 3);
      const X = (fx: number) => safe.x + 20 + fx * (safe.w - 40);
      const shown = Math.floor(t * 25);
      const pos = new Map<Node, [number, number]>();
      d.nodes.forEach((x) => pos.set(x.n, [X(x.x), top + x.d * rowH]));
      const parentOf = new Map<Node, Node>();
      const link = (n: Node) => { for (const ch of n.children ?? []) { parentOf.set(ch, n); link(ch); } };
      link(d.root);
      d.nodes.slice(0, shown).forEach(({ n }) => {
        const p = parentOf.get(n);
        const a = pos.get(n), b = p ? pos.get(p) : undefined;
        if (a && b) { ctx.strokeStyle = FAINT; ctx.lineWidth = 1 + Math.sqrt(n.N) * 0.15; ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(a[0], a[1]); ctx.stroke(); }
      });
      d.nodes.slice(0, shown).forEach(({ n, d: depth }) => {
        const a = pos.get(n)!;
        const r = Math.min(rowH * 0.45, 18, 2 + Math.sqrt(n.N) * 0.9);
        const good = depth === 1 ? bestMoves(FORK).includes(n.move) : null;
        ctx.fillStyle = depth === 0 ? INK : depth === 1 ? (good ? GREEN : RED) : depth === 2 ? INK : BLUE;
        ctx.globalAlpha = depth === 0 ? 1 : 0.8;
        ctx.beginPath(); ctx.arc(a[0], a[1], r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });
    },
  },
  selfplay: {
    label: 'Des parties d’auto-jeu, rejouées',
    prepare: (s) => trainOf(s),
    draw(ctx, w, h, t, s, data, safe) {
      bg(ctx, w, h);
      const run = data as TrainRun;
      const G = Math.max(1, Math.min(run.games.length, Math.round(s.games ?? TRAIN.games)));
      const per = 0.6, gameT = 9 * per + 1.6;
      const k = Math.floor(t / gameT);
      const gi = Math.max(0, G - 6 + (k % 6));
      const game = run.games[gi];
      const shown = Math.min(game.moves.length, Math.floor((t % gameT) / per) + 1);
      const b = after(game.moves.slice(0, shown));
      const cp = checkpointAt(run, G);
      const done = shown === game.moves.length;
      const result = done ? (game.w === 0 ? 'partie nulle' : game.w === 1 ? 'X gagne' : 'O gagne') : `coup ${fr(shown)}`;
      const top = hud(ctx, safe, [
        [`partie d’auto-jeu n° ${fr(gi + 1)} · ${result}`, INK],
        [`après ${fr(cp.games)} parties : ${TRAIN_OUTCOME[cp.searchLoss < 0.05 ? 'unbeatable' : 'beatable']}`, cp.searchLoss < 0.05 ? GREEN : RED],
        ['X et O : le même programme', DIM],
      ]);
      const side = Math.max(40, Math.min(safe.w * 0.6, safe.y + safe.h - top - 24, 260));
      board(ctx, b, safe.x + safe.w / 2, top + 12 + side / 2, side, game.moves[shown - 1]);
    },
  },
  robot: {
    label: 'Le robot visse un écrou, avec la politique apprise',
    prepare: (s): RobotData => ({ run: robotOf(s) }),
    draw(ctx, w, h, t, _s, data, safe) {
      bg(ctx, w, h);
      const { run } = data as RobotData;
      const f = run.final;
      const P = f.P[4], regrasp = f.x >= 0.5;
      const phase = 1.3, cycle = phase * 5 + 1.5;
      const k = Math.floor(t / cycle), u = (t % cycle) / phase;
      const success = rng(1000 + k)() < P;
      const s = Math.min(5, u);
      const step = STEP_NAMES[Math.min(4, Math.floor(s))];
      const top = hud(ctx, safe, [
        [`départ : pièces détachées · ${step}`, INK],
        [`tâche complète réussie : ${pct(P)}`, run.outcome === 'mastered' ? GREEN : RED],
        [ROBOT_OUTCOME[run.outcome], run.outcome === 'mastered' ? GREEN : RED],
        [regrasp ? 'il repose l’écrou, puis le reprend' : 'il force l’écrou, sans le reprendre', DIM],
      ]);
      // the scene fits between the read-out and the bottom of the safe area
      const ground = safe.y + safe.h - 24, rail = top + 4;
      const kk = Math.max(0.3, Math.min(1, (ground - rail) / 190));
      ctx.fillStyle = '#1a2130'; ctx.fillRect(0, ground, w, h - ground);
      const boltX = safe.x + safe.w * 0.72, startX = safe.x + safe.w * 0.28;
      const bh = 70 * kk;
      ctx.fillStyle = '#7d8799'; ctx.fillRect(boltX - 6, ground - bh, 12, bh);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(boltX - 6, ground - bh + 4 + i * (bh / 9), 12, 2); }
      // the nut's path through the five sub-steps
      const lift = ground - 130 * kk, rest = ground - 8 * kk, raised = ground - 48 * kk;
      let nx = startX, ny = rest, ang = 0.9, held = false, col = INK;
      if (s < 1) { held = s > 0.7; }
      else if (s < 2) {
        held = true; const v = s - 1;
        if (regrasp && v < 0.5) { ang = 0.9 * (1 - v * 2); held = v > 0.3; }
        else { ny = rest + (raised - rest) * v; ang = regrasp ? 0 : 0.9 * (1 - v) + 0.35 * v; }
      } else if (s < 3) { held = true; const v = s - 2; nx = startX + (boltX - startX) * v; ny = raised + (lift - raised) * v; ang = regrasp ? 0 : 0.35; }
      else if (s < 4) { held = true; nx = boltX + Math.sin((s - 3) * 9) * 4 * (4 - s); ny = lift; ang = regrasp ? 0 : 0.35; }
      else {
        held = s < 4.9; const v = s - 4;
        nx = boltX; ang = regrasp ? 0 : 0.35;
        const seated = ground - bh * 0.4;
        ny = success ? lift + (seated - lift) * Math.min(1, v * 1.4) : lift + (ground - bh - 6 * kk - lift) * Math.min(1, v * 2.5);
        if (v > 0.6) col = success ? GREEN : RED;
      }
      // the arm: a carriage on a rail, under the read-out
      ctx.strokeStyle = 'rgba(160,170,190,.35)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(startX - 40, rail); ctx.lineTo(boltX + 40, rail); ctx.stroke();
      ctx.strokeStyle = 'rgba(160,170,190,.8)'; ctx.lineWidth = 6;
      const reach = 22 * kk;
      const gx = s < 1 ? startX : nx, gy = s < 1 ? rail + (rest - reach - rail) * Math.min(1, s / 0.7) : ny - reach;
      ctx.beginPath(); ctx.moveTo(gx, rail); ctx.lineTo(gx, gy); ctx.stroke();
      ctx.lineWidth = 4;
      const open = held ? 9 : 16;
      ctx.beginPath(); ctx.moveTo(gx - open, gy); ctx.lineTo(gx - open, gy + 20 * kk); ctx.moveTo(gx + open, gy); ctx.lineTo(gx + open, gy + 20 * kk); ctx.stroke();
      // the nut
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(ang);
      ctx.fillStyle = col; ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 12, Math.sin(a) * 8); }
      ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = DIM;
      ctx.fillText('boulon', boltX, ground + 16);
      ctx.fillText('écrou', startX, ground + 16);
    },
  },
});
