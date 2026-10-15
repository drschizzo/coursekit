// The course's stage: four scenes drawn from the model, behind the panels.
// A go board (the problem), the search tree of MCTS growing from the course's
// position, games of self-play replayed, and the robot assembling a nut on a
// bolt with the policy its training produced.

import { fr, pct } from '@coursekit/core';
import { canvasStage } from '@coursekit/ui';
import {
  FACTS, FORK, MCTS_NOMINAL, ROBOT_OUTCOME, TRAIN, TRAIN_OUTCOME, after, bestMoves, checkpointAt, rng, robotOf, rolloutEval,
  search, trainOf, type Node, type RobotRun, type TrainRun,
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

// ---------------------------------------------------------------- the robot

interface RobotData { run: RobotRun }
const STEP_NAMES = ['saisir', 'orienter', 'approcher', 'aligner', 'insérer'];

export const stage = () => canvasStage({
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
        [`après ${fr(cp.games)} parties : ${TRAIN_OUTCOME[cp.searchLoss === 0 ? 'unbeatable' : 'beatable']}`, cp.searchLoss === 0 ? GREEN : RED],
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
