// The domain model of the course on AlphaGo, AlphaZero and AlphaNIST. Three
// small machines that run in the browser:
//
//   1. tic-tac-toe (« le morpion »): the whole game tree, counted exactly,
//      and minimax, the perfect player;
//   2. Monte-Carlo tree search with the PUCT rule of AlphaZero, first with
//      random playouts (pure MCTS), then with two tables learnt by self-play
//      in place of the policy and value networks: a miniature AlphaZero;
//   3. a robot assembly as a chain of sub-steps (grasp, orient, approach,
//      align, insert), trained in expected value from start states chosen
//      uniformly, only from scratch, or by success-guided sampling (SGS), with
//      a binary reward or a dense one: the two choices AlphaNIST studies.
//
// Diagrams, the stage, experiments, exercises and the figures of the text all
// run this file. The published results are in FACTS, quoted, never derived.

import { memo, type DomainModel } from '@coursekit/core';
import { OPENSPIEL } from './openspiel.ts';

/** A seeded random generator (mulberry32): every run of the course is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------ the facts

/** Figures from the publications (AlphaGo 2016, AlphaGo Zero 2017, AlphaZero 2018, AlphaNIST, SGS). */
export const FACTS = {
  goSide: 19,
  deepBlue: 1997,            // Deep Blue beats Kasparov
  mctsYear: 2006,            // Monte-Carlo tree search (Coulom; Kocsis and Szepesvári)
  move37: 37,                // AlphaGo's 37th move, game 2 against Lee Sedol
  atomsLog10: 80,            // atoms in the observable universe, about 10^80
  universeYears: 13.8e9,
  goLegalLog10: 170.3,       // 2,08 × 10^170 legal positions (Tromp, 2016)
  goBranching: 250, goDepth: 150,
  chessBranching: 35, chessDepth: 80,
  fanHuiWins: 5,             // October 2015, 5–0
  leeYear: 2016, leeWins: 4, leeLosses: 1,
  humanPositions: 30,        // millions of KGS positions for AlphaGo's policy network
  humanAccuracy: 0.57,       // that network predicts the expert move 57 % of the time
  elo: { fan: 3144, lee: 3739, master: 4858, zero: 5185 },
  eloYear: { fan: 2015, lee: 2016, master: 2017, zero: 2017 },
  zeroDays: 3, zeroGames: 4.9, zeroVsLee: 100, // 3 days, 4,9 million games, 100–0 against AlphaGo Lee
  zeroSims: 1600,            // simulations per move, AlphaGo Zero
  azSims: 800,               // simulations per move, AlphaZero
  azHours: { chess: 9, shogi: 12 }, azGoDays: 13,
  nistTasks: 20, nistSmallMm: 4,
  nist: { sharedBinary: 0.982, separateBinary: 0.814, sharedDense: 0.178, separateDense: 0.783 },
  nistTenParts: 4,           // runs of ten components that succeeded
  sgsNut: { sgs: 0.70, uniform: 0.06, plr: 0.05 }, // nut on bolt, Franka arm, 1 M environments
};

/** The share of games the stronger player wins, for a gap of d Elo points. */
export const eloWin = (d: number): number => 1 / (1 + Math.pow(10, -d / 400));

/** log10 of b^d: the size of a game tree of branching b and depth d, in powers of ten. */
export const treeLog10 = (b: number, d: number): number => d * Math.log10(b);

// ------------------------------------------------------- tic-tac-toe

/** 9 cells, row by row: 0 empty, 1 for X (who starts), −1 for O. */
export type Board = number[];
export const EMPTY: Board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

export const toMove = (b: Board): number => (b.reduce((s, x) => s + (x !== 0 ? 1 : 0), 0) % 2 === 0 ? 1 : -1);
export function winner(b: Board): number {
  for (const [i, j, k] of LINES) if (b[i] !== 0 && b[i] === b[j] && b[j] === b[k]) return b[i];
  return 0;
}
export const full = (b: Board): boolean => b.every((x) => x !== 0);
export const over = (b: Board): boolean => winner(b) !== 0 || full(b);
export const legal = (b: Board): number[] => (over(b) ? [] : b.flatMap((x, i) => (x === 0 ? [i] : [])));
export const play = (b: Board, m: number): Board => { const c = b.slice(); c[m] = toMove(b); return c; };
export const keyOf = (b: Board): string => b.map((x) => (x === 1 ? 'x' : x === -1 ? 'o' : '.')).join('');
export const boardOf = (k: string): Board => [...k].map((ch) => (ch === 'x' ? 1 : ch === 'o' ? -1 : 0));
/** The board after a list of moves. */
export const after = (moves: number[]): Board => moves.reduce(play, EMPTY);

export interface TreeCount { games: number; nodes: number; positions: number; byDepth: number[]; xWins: number; oWins: number; draws: number }

/** The whole game tree, walked once: games, nodes, distinct positions per depth. */
export const countTree = memo((): TreeCount => {
  const seen = Array.from({ length: 10 }, () => new Set<string>());
  const out = { games: 0, nodes: 0, xWins: 0, oWins: 0, draws: 0 };
  const walk = (b: Board, d: number): void => {
    out.nodes++;
    seen[d].add(keyOf(b));
    const w = winner(b);
    if (w || full(b)) { out.games++; if (w === 1) out.xWins++; else if (w === -1) out.oWins++; else out.draws++; return; }
    for (const m of legal(b)) walk(play(b, m), d + 1);
  };
  walk(EMPTY, 0);
  const byDepth = seen.map((s) => s.size);
  return { ...out, byDepth, positions: byDepth.reduce((s, x) => s + x, 0) };
}, { key: () => 'tree' });

const mm = new Map<string, number>();
/** Minimax (negamax form): the value of a board for the player to move, with perfect play: 1 win, 0 draw, −1 loss. */
export function minimax(b: Board): number {
  const k = keyOf(b);
  const hit = mm.get(k);
  if (hit !== undefined) return hit;
  let v: number;
  if (winner(b) !== 0) v = -1;            // the player who just moved has won
  else if (full(b)) v = 0;
  else { v = -2; for (const m of legal(b)) v = Math.max(v, -minimax(play(b, m))); }
  mm.set(k, v);
  return v;
}
/** The moves that keep the minimax value. */
export const bestMoves = (b: Board): number[] => { const v = minimax(b); return legal(b).filter((m) => -minimax(play(b, m)) === v); };

// ------------------------------------------------------------ the search

export interface Node { move: number; board: Board; N: number; W: number; P: number; children: Node[] | null }
/** The score that chooses which child to visit: Q + c·P·√N / (1 + n). */
export type ScoreFn = (Q: number, P: number, Nparent: number, n: number, c: number) => number;
/** Back-propagation: adds a visit and the value, with the sign of each player, from the leaf up to the root. */
export type BackupFn = (path: { N: number; W: number }[], v: number) => void;

export const scoreRef: ScoreFn = (Q, P, Np, n, c) => Q + (c * P * Math.sqrt(Np)) / (1 + n);
export const backupRef: BackupFn = (path, v) => {
  for (let i = path.length - 1; i >= 0; i--) {
    v = -v;
    path[i].N += 1;
    path[i].W += v;
  }
};

/** What a leaf is worth for the player to move (v in [−1, 1]) and, optionally, priors over the 9 cells. */
export type Evaluator = (b: Board, r: () => number) => { v: number; p: number[] | null };

/** The position the course comes back to: X holds two opposite corners, O the centre; O must answer on an edge. */
export const FORK: Board = after([0, 4, 8]);
/** The positions whose policy and value the course follows during training. */
export const FOCUS: Board[] = [EMPTY, FORK];

/** A random game played to the end: +1 if the player to move wins, −1 if they lose, 0 for a draw. */
export function rollout(b: Board, r: () => number): number {
  const me = toMove(b);
  let c = b;
  while (!over(c)) { const ms = legal(c); c = play(c, ms[Math.floor(r() * ms.length)]); }
  const w = winner(c);
  return w === 0 ? 0 : w === me ? 1 : -1;
}
/** Running averages of n random games after move m, for the player who plays m (seeded per move). */
export function playoutRun(b: Board, m: number, n: number): number[] {
  const r = rng(100 + m);
  const out: number[] = [];
  let s = 0;
  for (let i = 1; i <= n; i++) { s += -rollout(play(b, m), r); out.push(s / i); }
  return out;
}
/** Wins, draws and losses of the first n random games after move m, for the player who plays m. */
export function playoutCounts(b: Board, m: number, n: number): { wins: number; draws: number; losses: number } {
  const r = rng(100 + m);
  const out = { wins: 0, draws: 0, losses: 0 };
  for (let i = 0; i < n; i++) { const v = -rollout(play(b, m), r); if (v > 0) out.wins++; else if (v < 0) out.losses++; else out.draws++; }
  return out;
}
export const rolloutEval: Evaluator = (b, r) => ({ v: rollout(b, r), p: null });

export interface SearchOpts {
  sims: number; c: number; evaluate: Evaluator; seed?: number; score?: ScoreFn; backup?: BackupFn;
  /** share of random noise mixed into the priors of the root (AlphaZero: 0,25 during self-play) */
  noise?: number;
}
export interface SearchResult { root: Node; visits: number[]; q: number[]; prior: number[]; best: number }

/** Monte-Carlo tree search from b: selection by `score`, expansion, evaluation, back-propagation. */
export function search(b: Board, o: SearchOpts): SearchResult {
  const r = rng(o.seed ?? 1);
  const score = o.score ?? scoreRef, backup = o.backup ?? backupRef;
  const root: Node = { move: -1, board: b, N: 0, W: 0, P: 1, children: null };
  const expand = (n: Node, p: number[] | null): void => {
    const ms = legal(n.board);
    const tot = p ? ms.reduce((s, m) => s + p[m], 0) : 0;
    // the children in a random order: ties are not broken in favour of the first cells (OpenSpiel does the same)
    const order = ms.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    n.children = order.map((m) => ({ move: m, board: play(n.board, m), N: 0, W: 0, P: p && tot > 0 ? p[m] / tot : 1 / ms.length, children: null }));
  };
  for (let s = 0; s < Math.max(1, o.sims); s++) {
    let n = root;
    const path: Node[] = [root];
    while (n.children && n.children.length) {
      let best = n.children[0], bs = -Infinity;
      for (const ch of n.children) {
        const sc = score(ch.N ? ch.W / ch.N : 0, ch.P, n.N, ch.N, o.c);
        if (sc > bs) { bs = sc; best = ch; }
      }
      n = best; path.push(n);
    }
    let v: number;
    if (winner(n.board) !== 0) v = -1;
    else if (full(n.board)) v = 0;
    else {
      const e = o.evaluate(n.board, r); v = e.v; expand(n, e.p);
      if (n === root && o.noise && n.children) {
        const eta = n.children.map(() => -Math.log(1 - r() * 0.999999));   // a flat Dirichlet draw
        const tot = eta.reduce((a, x) => a + x, 0);
        n.children.forEach((ch, i) => { ch.P = (1 - o.noise!) * ch.P + o.noise! * (eta[i] / tot); });
      }
    }
    backup(path, v);
  }
  const visits = Array(9).fill(0), q = Array(9).fill(0), prior = Array(9).fill(0);
  for (const ch of root.children ?? []) { visits[ch.move] = ch.N; q[ch.move] = ch.N ? ch.W / ch.N : 0; prior[ch.move] = ch.P; }
  const ms = legal(b);
  const best = ms.reduce((a, m) => (visits[m] > visits[a] || (visits[m] === visits[a] && q[m] > q[a]) ? m : a), ms[0] ?? -1);
  return { root, visits, q, prior, best };
}

/** The number of nodes of the search tree (the root included). */
export const treeSize = (n: Node): number => 1 + (n.children ?? []).reduce((s, ch) => s + (ch.N ? treeSize(ch) : 0), 0);

// ---------------------------------------------------------------- players

export type Player = (b: Board, r: () => number) => number;
export const perfectPlayer: Player = (b, r) => { const ms = bestMoves(b); return ms[Math.floor(r() * ms.length)]; };
export const randomPlayer: Player = (b, r) => { const ms = legal(b); return ms[Math.floor(r() * ms.length)]; };
export const mctsPlayer = (sims: number, c: number): Player => (b, r) => search(b, { sims, c, evaluate: rolloutEval, seed: Math.floor(r() * 1e9) }).best;

/** One game; returns the winner (1, −1) or 0. */
export function playGame(x: Player, o: Player, r: () => number): { w: number; moves: number[] } {
  let b = EMPTY;
  const moves: number[] = [];
  while (!over(b)) { const m = (toMove(b) === 1 ? x : o)(b, r); moves.push(m); b = play(b, m); }
  return { w: winner(b), moves };
}

export interface Match { games: number; wins: number; draws: number; losses: number }
/** `games` games against an opponent, half as X, half as O. */
export function match(p: Player, opp: Player, games: number, seed: number): Match {
  const r = rng(seed);
  const m: Match = { games, wins: 0, draws: 0, losses: 0 };
  for (let g = 0; g < games; g++) {
    const side = g % 2 === 0 ? 1 : -1;
    const { w } = side === 1 ? playGame(p, opp, r) : playGame(opp, p, r);
    if (w === 0) m.draws++; else if (w === side) m.wins++; else m.losses++;
  }
  return m;
}

/** Wilson 95 % interval of a proportion k / n: what the true rate can be, given the luck of n games. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
/** Games played against the perfect player to rate a search (half as X, half as O). */
export const MATCH_GAMES = 100;

export type MctsOutcome = 'solid' | 'fragile' | 'weak';
export interface MctsRun { vsPerfect: Match; vsRandom: Match; outcome: MctsOutcome; ci: [number, number] }
/** Pure MCTS (random playouts) with `sims` simulations per move and constant c: 40 games against each opponent. */
export const mctsOf = memo((v: Record<string, number>): MctsRun => {
  const sims = Math.round(v.sims ?? MCTS_NOMINAL.sims), c = v.c ?? MCTS_NOMINAL.c;
  const p = mctsPlayer(sims, c);
  const vsPerfect = match(p, perfectPlayer, MATCH_GAMES, 7);
  const vsRandom = match(p, randomPlayer, 40, 11);
  const ci = wilson(vsPerfect.losses, vsPerfect.games);
  // solid: we are 95 % sure it loses less than 6 % of its games (at most 1 in 100); weak: more than 20 %
  return { vsPerfect, vsRandom, ci, outcome: ci[1] < 0.06 ? 'solid' : ci[0] > 0.2 ? 'weak' : 'fragile' };
}, { key: (v) => `${Math.round(v.sims ?? MCTS_NOMINAL.sims)}|${v.c ?? MCTS_NOMINAL.c}` });
export const MCTS_NOMINAL = { sims: 1600, c: 5 };
export const MCTS_OUTCOME: Record<MctsOutcome, string> = { solid: 'perd au plus 1 partie sur 100', fragile: 'perd quelques parties', weak: 'perd souvent' };

/** The probability that a deterministic player loses against the perfect player (who picks at random among its best moves), as X and as O, averaged. */
export function lossRate(policy: (b: Board) => number): number {
  const memoL = new Map<string, number>();
  const rec = (b: Board, side: number): number => {
    const w = winner(b);
    if (w) return w === side ? 0 : 1;
    if (full(b)) return 0;
    const k = keyOf(b) + side;
    const hit = memoL.get(k);
    if (hit !== undefined) return hit;
    let out: number;
    if (toMove(b) === side) out = rec(play(b, policy(b)), side);
    else { const ms = bestMoves(b); out = ms.reduce((s, m) => s + rec(play(b, m), side), 0) / ms.length; }
    memoL.set(k, out);
    return out;
  };
  return (rec(EMPTY, 1) + rec(EMPTY, -1)) / 2;
}

// ------------------------------------------------------ self-play learning

/** The 8 symmetries of the board (rotations, reflections), as permutations: cell i of the image is cell s[i] of the board. */
export const SYMS: number[][] = (() => {
  const rot = [6, 3, 0, 7, 4, 1, 8, 5, 2], flip = [2, 1, 0, 5, 4, 3, 8, 7, 6];
  const out = new Map<string, number[]>([['012345678', [0, 1, 2, 3, 4, 5, 6, 7, 8]]]);
  for (let grew = true; grew;) {
    grew = false;
    for (const a of [...out.values()]) for (const g of [rot, flip]) {
      const c = g.map((j) => a[j]);
      if (!out.has(c.join(''))) { out.set(c.join(''), c); grew = true; }
    }
  }
  return [...out.values()];
})();
/** The canonical form of a board (the smallest key of its 8 images) and the permutation that gives it. */
export function canon(b: Board): { k: string; s: number[] } {
  let best = '', bs = SYMS[0];
  for (const s of SYMS) { const k = keyOf(s.map((j) => b[j])); if (!best || k < best) { best = k; bs = s; } }
  return { k: best, s: bs };
}

/** Every unfinished position, once (the course's test set). */
export const allPositions = memo((): Board[] => {
  const seen = new Map<string, Board>();
  const walk = (b: Board): void => { const k = keyOf(b); if (seen.has(k) || over(b)) return; seen.set(k, b); for (const m of legal(b)) walk(play(b, m)); };
  walk(EMPTY);
  return [...seen.values()];
}, { key: () => 'all' });

/**
 * The network of the miniature AlphaZero: 18 inputs (the cells of the player
 * to move, then the opponent's), one layer of H tanh units, a policy head (one
 * logit per cell, illegal cells left out of the softmax) and a value head
 * (tanh). Unlike a table, it answers for positions it has never seen.
 */
export interface Net { H: number; W1: number[][]; b1: number[]; Wp: number[][]; bp: number[]; Wv: number[]; bv: number }
export function makeNet(H: number, seed: number): Net {
  const r = rng(seed);
  const g = (sc: number) => (r() * 2 - 1) * sc;
  return {
    H, W1: Array.from({ length: H }, () => Array.from({ length: 18 }, () => g(0.3))), b1: Array(H).fill(0),
    Wp: Array.from({ length: 9 }, () => Array.from({ length: H }, () => g(0.1))), bp: Array(9).fill(0),
    Wv: Array.from({ length: H }, () => g(0.1)), bv: 0,
  };
}
export const encode = (b: Board): number[] => {
  const me = toMove(b), x = Array(18).fill(0);
  b.forEach((v, i) => { if (v === me) x[i] = 1; else if (v === -me) x[9 + i] = 1; });
  return x;
};
export function netForward(n: Net, b: Board): { x: number[]; h: number[]; p: number[]; v: number } {
  const x = encode(b);
  const h = n.W1.map((w, j) => { let z = n.b1[j]; for (let i = 0; i < 18; i++) if (x[i]) z += w[i]; return Math.tanh(z); });
  const lg = n.Wp.map((w, k) => w.reduce((s, wi, j) => s + wi * h[j], n.bp[k]));
  let mx = -Infinity;
  for (let k = 0; k < 9; k++) if (b[k] === 0) mx = Math.max(mx, lg[k]);
  const e = lg.map((l, k) => (b[k] === 0 ? Math.exp(l - mx) : 0));
  const se = e.reduce((a, c) => a + c, 0) || 1;
  const v = Math.tanh(n.Wv.reduce((s, w, j) => s + w * h[j], n.bv));
  return { x, h, p: e.map((q) => q / se), v };
}
export interface Sample { b: Board; pi: number[]; z: number }
/**
 * One step of stochastic gradient descent on a batch: the loss is
 * (v − z)² + cross-entropy(π, p), the value against the result and the policy
 * against the visit shares of the search, as in AlphaZero.
 */
export function netStep(n: Net, batch: Sample[], lr: number): number {
  let loss = 0;
  const f = lr / batch.length;
  for (const s of batch) {
    const { x, h, p, v } = netForward(n, s.b);
    loss += (v - s.z) ** 2 - s.pi.reduce((a, q, k) => a + (q > 0 ? q * Math.log(Math.max(1e-12, p[k])) : 0), 0);
    const gv = 2 * (v - s.z) * (1 - v * v);
    const gl = p.map((pk, k) => pk - s.pi[k]);
    for (let j = 0; j < n.H; j++) {
      let gh = gv * n.Wv[j];
      for (let k = 0; k < 9; k++) gh += gl[k] * n.Wp[k][j];
      gh *= 1 - h[j] * h[j];
      n.Wv[j] -= f * gv * h[j];
      for (let k = 0; k < 9; k++) n.Wp[k][j] -= f * gl[k] * h[j];
      for (let i = 0; i < 18; i++) if (x[i]) n.W1[j][i] -= f * gh;
      n.b1[j] -= f * gh;
    }
    n.bv -= f * gv;
    for (let k = 0; k < 9; k++) n.bp[k] -= f * gl[k];
  }
  return loss / batch.length;
}
export const netEval = (n: Net): Evaluator => (b) => { const o = netForward(n, b); return { v: o.v, p: o.p }; };
/** The policy alone: the legal move of highest probability. */
export const netMove = (n: Net, b: Board): number => { const p = netForward(n, b).p; const ms = legal(b); return ms.reduce((a, m) => (p[m] > p[a] ? m : a), ms[0]); };
/** The share of positions where a player picks a minimax-optimal move. */
export const accuracy = (pos: Board[], pick: (b: Board) => number): number => pos.reduce((s, b) => s + (bestMoves(b).includes(pick(b)) ? 1 : 0), 0) / Math.max(1, pos.length);
/** The same share for a player who picks at random among the legal moves. */
export const randomAccuracy = (pos: Board[]): number => pos.reduce((s, b) => s + bestMoves(b).length / legal(b).length, 0) / Math.max(1, pos.length);

export interface TrainOpts {
  games: number; sims: number; c: number;
  /** share of Dirichlet noise in the root priors during self-play */
  noise: number;
  /** the first `temp` moves of a game are drawn in proportion to the visits; the others are the most visited */
  temp: number;
  lr: number; decay: number; steps: number; batch: number; buffer: number; hidden: number; seed: number; every: number; evalSims: number;
}
export const TRAIN: TrainOpts = { games: 600, sims: 48, c: 3, noise: 0.5, temp: 9, lr: 0.1, decay: 300, steps: 8, batch: 32, buffer: 4000, hidden: 32, seed: 1, every: 100, evalSims: 48 };
export const TRAIN_SEEDS = [1, 2, 3, 4, 5];

export interface Checkpoint {
  games: number;
  /** probability of losing against the perfect player: the policy alone, the policy with the search */
  netLoss: number; searchLoss: number;
  /** share of optimal moves: the policy on positions met in self-play, on positions never met, the search on a sample */
  netSeen: number; netUnseen: number; searchAcc: number; netAcc: number;
  distinct: number; known: number;
  /** what the network says about the FOCUS positions */
  probe: { p: number[]; v: number }[];
  loss: number;
}
export type TrainOutcome = 'unbeatable' | 'beatable';
export interface TrainRun { checkpoints: Checkpoint[]; net: Net; games: { moves: number[]; w: number }[]; outcome: TrainOutcome; distinct: number; unseenBase: number }

/** A fixed sample of positions, to measure the search's choices cheaply. */
const SAMPLE = memo((): Board[] => { const all = allPositions(), r = rng(99); return Array.from({ length: 150 }, () => all[Math.floor(r() * all.length)]); }, { key: () => 's' });

/**
 * A miniature AlphaZero. Each game of self-play runs the search at every move,
 * guided by the network, with noise in the root priors; the first `temp` moves
 * are drawn in proportion to the visits. Every position of the game, in its 8
 * symmetric images, goes into a buffer with two targets: the result z for the
 * value, the visit shares π for the policy. After each game, the network takes
 * `steps` steps of gradient descent on batches drawn from the buffer.
 */
export function train(p: Partial<TrainOpts> = {}): TrainRun {
  const o = { ...TRAIN, ...p };
  const r = rng(o.seed);
  const net = makeNet(o.hidden, o.seed + 100);
  const ev = netEval(net);
  const buf: Sample[] = [];
  const checkpoints: Checkpoint[] = [];
  const games: TrainRun['games'] = [];
  const seenGames = new Set<string>(), seenPos = new Set<string>();
  let lastLoss = 0;
  const canonKey = (b: Board) => canon(b).k;
  const measure = (g: number): void => {
    const all = allPositions();
    const met = all.filter((b) => seenPos.has(canonKey(b))), unmet = all.filter((b) => !seenPos.has(canonKey(b)));
    checkpoints.push({
      games: g,
      netLoss: lossRate((b) => netMove(net, b)),
      searchLoss: lossRate((b) => search(b, { sims: o.evalSims, c: o.c, evaluate: ev, seed: 1 }).best),
      netSeen: accuracy(met, (b) => netMove(net, b)), netUnseen: accuracy(unmet, (b) => netMove(net, b)),
      netAcc: accuracy(SAMPLE(), (b) => netMove(net, b)),
      searchAcc: accuracy(SAMPLE(), (b) => search(b, { sims: o.evalSims, c: o.c, evaluate: ev, seed: 1 }).best),
      distinct: seenGames.size, known: met.length,
      probe: FOCUS.map((b) => { const f = netForward(net, b); return { p: f.p, v: f.v }; }),
      loss: lastLoss,
    });
  };
  measure(0);
  for (let g = 1; g <= o.games; g++) {
    let b = EMPTY;
    const hist: { b: Board; pi: number[]; side: number }[] = [];
    const moves: number[] = [];
    while (!over(b)) {
      const s = search(b, { sims: o.sims, c: o.c, evaluate: ev, seed: Math.floor(r() * 1e9), noise: o.noise });
      const tot = s.visits.reduce((a, x) => a + x, 0);
      const pi = s.visits.map((x) => x / tot);
      let m = s.best;
      if (moves.length < o.temp) {
        const u = r();
        let acc = 0;
        for (let i = 0; i < 9; i++) { acc += pi[i]; if (pi[i] > 0 && u < acc) { m = i; break; } }
      }
      hist.push({ b, pi, side: toMove(b) });
      seenPos.add(canonKey(b));
      moves.push(m);
      b = play(b, m);
    }
    const w = winner(b);
    for (const h of hist) {
      const z = w === 0 ? 0 : w === h.side ? 1 : -1;
      for (const S of SYMS) buf.push({ b: S.map((j) => h.b[j]), pi: S.map((j) => h.pi[j]), z });
    }
    if (buf.length > o.buffer) buf.splice(0, buf.length - o.buffer);
    let L = 0;
    for (let k = 0; k < o.steps; k++) L += netStep(net, Array.from({ length: o.batch }, () => buf[Math.floor(r() * buf.length)]), o.lr / (1 + g / o.decay));
    lastLoss = L / o.steps;
    seenGames.add(moves.join(''));
    games.push({ moves, w });
    if (g % o.every === 0 || g === o.games) measure(g);
  }
  const last = checkpoints[checkpoints.length - 1];
  const unmet = allPositions().filter((b) => !seenPos.has(canonKey(b)));
  return { checkpoints, net, games, distinct: seenGames.size, unseenBase: randomAccuracy(unmet), outcome: last.searchLoss < 0.05 ? 'unbeatable' : 'beatable' };
}

/** The training run the live values describe (noise, temp, seed), shared by the stage and the diagrams. */
export const trainOf = memo(
  (v: Record<string, number>): TrainRun => train({ noise: v.noise ?? TRAIN.noise, temp: Math.round(v.temp ?? TRAIN.temp), seed: Math.round(v.tseed ?? TRAIN.seed) }),
  { key: (v) => `${v.noise ?? TRAIN.noise}|${Math.round(v.temp ?? TRAIN.temp)}|${Math.round(v.tseed ?? TRAIN.seed)}` },
);
/** The checkpoint at `games` games of self-play (the last one before). */
export const checkpointAt = (run: TrainRun, games: number): Checkpoint =>
  run.checkpoints.reduce((a, c) => (c.games <= games ? c : a), run.checkpoints[0]);
export const TRAIN_OUTCOME: Record<TrainOutcome, string> = { unbeatable: 'perd moins de 5 % des parties', beatable: 'perd encore souvent' };

// ----------------------------------------------------- gradient descent

/** Threats of player p: lines with two of its marks and an empty cell. */
export const threats = (b: Board, p: number): number => LINES.filter((l) => l.filter((i) => b[i] === p).length === 2 && l.some((i) => b[i] === 0)).length;

/** The data of the small value network: every unfinished position, its feature x (threats of the player to move minus the opponent's) and its minimax value z. */
export const valueData = memo((): { x: number; z: number }[] => {
  const seen = new Map<string, { x: number; z: number }>();
  const walk = (b: Board): void => {
    const k = keyOf(b);
    if (seen.has(k) || over(b)) return;
    const me = toMove(b);
    seen.set(k, { x: threats(b, me) - threats(b, -me), z: minimax(b) });
    for (const m of legal(b)) walk(play(b, m));
  };
  walk(EMPTY);
  return [...seen.values()];
}, { key: () => 'data' });

/** The error of the value v = a·x + b: the mean of the squared differences with z. */
export function valueLoss(a: number, b: number): number {
  const d = valueData();
  return d.reduce((s, p) => s + (a * p.x + b - p.z) ** 2, 0) / d.length;
}
/** Its gradient: how the error changes when a, then b, increases a little. */
export function valueGrad(a: number, b: number): [number, number] {
  const d = valueData();
  let ga = 0, gb = 0;
  for (const p of d) { const e = a * p.x + b - p.z; ga += 2 * e * p.x; gb += 2 * e; }
  return [ga / d.length, gb / d.length];
}
/** The best (a, b), by the least-squares formula: what gradient descent should reach. */
export const valueBest = memo((): { a: number; b: number; L: number } => {
  const d = valueData(), n = d.length;
  const mx = d.reduce((s, p) => s + p.x, 0) / n, mz = d.reduce((s, p) => s + p.z, 0) / n;
  const sxx = d.reduce((s, p) => s + (p.x - mx) ** 2, 0), sxz = d.reduce((s, p) => s + (p.x - mx) * (p.z - mz), 0);
  const a = sxz / sxx, b = mz - a * mx;
  return { a, b, L: valueLoss(a, b) };
}, { key: () => 'best' });

export type GdOutcome = 'converged' | 'slow' | 'diverged';
export interface GdRun { path: { a: number; b: number; L: number }[]; outcome: GdOutcome }
export const GD = { eta: 0.3, steps: 30 };

/** Gradient descent from (0, 0) with the learning rate eta: each step moves (a, b) against the gradient. */
export function descend(eta: number, steps = GD.steps): GdRun {
  let a = 0, b = 0;
  const path: GdRun['path'] = [];
  for (let s = 0; s <= steps; s++) {
    const L = valueLoss(a, b);
    path.push({ a, b, L });
    if (!Number.isFinite(L) || L > 1e6) break;
    const [ga, gb] = valueGrad(a, b);
    a -= eta * ga; b -= eta * gb;
  }
  const best = valueBest(), end = path[path.length - 1], mid = path[Math.floor((path.length - 1) / 2)];
  // diverging: the error grows again in the second half of the descent
  const outcome: GdOutcome = end.L <= best.L * 1.01 ? 'converged' : !(end.L <= mid.L) ? 'diverged' : 'slow';
  return { path, outcome };
}
export const gdOf = memo((v: Record<string, number>): GdRun => descend(v.eta ?? GD.eta), { key: (v) => String(v.eta ?? GD.eta) });
export const GD_OUTCOME: Record<GdOutcome, string> = { converged: 'atteint le minimum', slow: 'trop lent', diverged: 'diverge' };

// --------------------------------------------------------- robot assembly

/** The sub-steps of an assembly, in the order the robot does them. */
export const STEPS = ['saisir', 'orienter', 'approcher', 'aligner', 'insérer'];
/** Start states: level j leaves the last j sub-steps to do (5: parts laid out, from scratch). */
export const LEVELS = ['pièce alignée', 'pièce près du but', 'pièce orientée en main', 'pièce saisie', 'pièces détachées'];
export const ORIENT = 1;
/** Time steps of an episode: one per sub-step, two more for a re-grasp (set the part down, pick it up). */
export const HORIZON = STEPS.length + 2;
export const SAMPLERS = ['uniforme', 'guidé par le succès', 'tâche complète seule'];
/** Variants of the part: a difficulty subtracted from every sub-step's logit (the last one is defective: impossible). */
export const VARIANTS = [{ name: 'grosse pièce', d: -1 }, { name: 'pièce standard', d: 0 }, { name: 'petite pièce', d: 1.5 }, { name: 'pièce défectueuse', d: 12 }];
/** The variant the course follows: the small part, 4 mm, like the smallest of the NIST board. */
export const MAIN = 2;
/** A configuration: a start level and a variant. */
export const CONFIGS = VARIANTS.flatMap((_, k) => LEVELS.map((_, j) => ({ level: j, variant: k })));
export const REWARDS = ['binaire', 'dense naïve', 'façonnage par potentiel'];

export interface RobotOpts {
  /** episodes of the whole training, episodes per update, step size */
  episodes: number; batch: number; lr: number;
  /** 0 uniform, 1 success-guided sampling, 2 from scratch only */
  sampler: number;
  /** SGS (Zhang et al., section 3.2): target t, concentration κ, floor ε, softmax temperature T, history H */
  target: number; conc: number; eps: number; temp: number; hist: number;
  /** 0 binary, 1 naive dense (a penalty for the distance at every step), 2 potential-based shaping */
  reward: number; w: number;
  /** 1: subtract a learnt baseline (the average return from each level and time) */
  baseline: number;
  q0: number; x0: number;
  /** forcing a part without re-grasping keeps this share of the orientation skill */
  cap: number;
  seed: number;
}
export const ROBOT: RobotOpts = {
  episodes: 4800, batch: 16, lr: 2, sampler: 1, target: 0.5, conc: 1, eps: 1e-4, temp: 2, hist: 100,
  reward: 0, w: 0, baseline: 1, q0: 0.15, x0: 0.05, cap: 0.4, seed: 1,
};
export const ROBOT_SEEDS = [1, 2, 3, 4];
const sig = (x: number) => 1 / (1 + Math.exp(-x));

export const INSERT = STEPS.length - 1;
/**
 * Probability of each sub-step of a policy: skill q, and the share x of
 * re-grasping. A nut forced without being re-grasped stays slightly
 * misoriented: the robot carries and aligns it as well, but it jams at the
 * insertion, which then succeeds only `cap` times as often.
 */
export const stepProb = (q: number[], x: number, cap: number): number[] => q.map((qi, i) => (i === INSERT ? qi * (x + (1 - x) * cap) : qi));
/** The skills of a variant: σ(θ − d). */
export const skillOf = (theta: number[], d: number): number[] => theta.map((t) => sig(t - d));
/** Success from each start level: the product of the sub-steps left. */
export const successByLevel = (e: number[]): number[] => LEVELS.map((_, j) => e.slice(STEPS.length - 1 - j).reduce((s, x) => s * x, 1));
/**
 * Success of a policy from each start level: the product of the skills left,
 * and, when the orientation is still to do, the insertion of a forced nut
 * (share 1 − x) succeeds only `cap` times as often.
 */
export const chainSuccess = (q: number[], x: number, cap: number): number[] =>
  successByLevel(q).map((P, j) => (STEPS.length - 1 - j <= ORIENT ? P * (x + (1 - x) * cap) : P));

/** The SGS kernel of a start state of success rate p: (p + ε)^(κt) · (1 − p + ε)^(κ(1−t)), a Beta shape whose mode is t. */
export const sgsKernel = (p: number, t: number, k: number, eps: number): number => Math.pow(p + eps, k * t) * Math.pow(1 - p + eps, k * (1 - t));
/** The share of episodes started at each level: SGS draws by a softmax of log(max(w, ε) + ε) / T. */
export function samplerShares(rates: number[], o: Pick<RobotOpts, 'sampler' | 'target' | 'conc' | 'eps' | 'temp'>): number[] {
  if (o.sampler !== 1) return rates.map(() => 1 / rates.length);
  const l = rates.map((p) => Math.log(Math.max(sgsKernel(p, o.target, o.conc, o.eps), o.eps) + o.eps) / Math.max(1, o.temp));
  const m = Math.max(...l), e = l.map((x) => Math.exp(x - m)), t = e.reduce((a, x) => a + x, 0);
  return e.map((x) => x / t);
}
/** The SGS weight, relative to the best one, of a start state of success rate p (for the diagrams). */
export const sgsWeight = (p: number, o: Pick<RobotOpts, 'target' | 'conc' | 'eps' | 'temp'> = ROBOT): number => {
  const f = (q: number) => Math.exp(Math.log(Math.max(sgsKernel(q, o.target, o.conc, o.eps), o.eps) + o.eps) / Math.max(1, o.temp));
  return f(p) / f(o.target);
};

/** Progress towards the goal, the potential Φ: the share of sub-steps done; setting the part down to re-grasp it moves it away. */
const progress = (done: number, down: boolean) => done / STEPS.length - (down ? 0.2 : 0);

export interface Episode {
  /** the actions: the sub-step (or −1: the re-grasp choice), the action taken, its time */
  acts: { i: number; a: number; t: number }[];
  rewards: number[]; success: boolean; level: number; variant: number; forced: boolean;
  /** the potential at each time (HORIZON + 1 values, the last one 0) */
  phi: number[];
}

/**
 * One episode from `level` (the last `level + 1` sub-steps are left) with a
 * part of variant `variant`, for a fixed horizon. A failed sub-step jams the
 * part where it is, and the episode waits for the end. Re-grasping takes two
 * more time steps and moves the part away from the goal.
 */
export function episode(theta: number[], tx: number, level: number, variant: number, o: RobotOpts, r: () => number): Episode {
  const n = STEPS.length, first = n - 1 - level, d = VARIANTS[variant].d;
  const acts: Episode['acts'] = [];
  const states: { done: number; down: boolean }[] = [];
  let t = 0, done = first, ok = true, forced = false;
  for (let i = first; i < n && ok; i++) {
    if (i === ORIENT) {
      const rg = r() < sig(tx) ? 1 : 0;
      acts.push({ i: -1, a: rg, t });
      forced = !rg;
      if (rg) { states.push({ done, down: false }); t++; states.push({ done, down: true }); t++; }
    }
    states.push({ done, down: false });
    const q = sig(theta[i] - d) * (i === INSERT && forced ? o.cap : 1);
    const a = r() < q ? 1 : 0;
    acts.push({ i, a, t });
    t++;
    if (a) done++; else ok = false;
  }
  while (states.length < HORIZON) states.push({ done, down: false });
  const success = ok && done === n;
  const phi = states.map((st) => progress(st.done, st.down));
  phi.push(0);                                        // Φ after the end of the episode: 0, as Ng et al. require
  const rewards = states.map((_, k) => {
    let rw = k === HORIZON - 1 && success ? 1 : 0;
    if (o.reward === 1) rw += o.w * phi[k] / HORIZON;       // naive dense: points for being close, at every step
    if (o.reward === 2) rw += o.w * (phi[k + 1] - phi[k]);  // potential-based: the change of Φ
    return rw;
  });
  return { acts, rewards, success, level, variant, forced, phi };
}
/** The gradient of the log-probability of the episode's actions, each weighted by its reward-to-go minus a baseline. */
function episodeGrad(ep: Episode, theta: number[], tx: number, o: RobotOpts, base: (ep: Episode, t: number) => number): number[] {
  const g = Array(STEPS.length + 1).fill(0);
  const d = VARIANTS[ep.variant].d;
  const togo = (t: number) => ep.rewards.slice(t).reduce((a, x) => a + x, 0);
  for (const { i, a, t } of ep.acts) {
    const adv = togo(t) - base(ep, t);
    if (i === -1) { g[STEPS.length] += adv * (a - sig(tx)); continue; }
    // d log P(a) / dθ for an action of probability k·σ(θ − d): 1 − σ if it succeeded, −k·σ(1 − σ)/(1 − k·σ) if not
    const q = sig(theta[i] - d), k = i === INSERT && ep.forced ? o.cap : 1;
    g[i] += adv * (a ? 1 - q : (-k * q * (1 - q)) / (1 - k * q));
  }
  return g;
}

export type RobotOutcome = 'mastered' | 'slow' | 'capped' | 'stuck' | 'easy' | 'collapse';
export interface RobotIter {
  ep: number;
  /** skill of each sub-step (a forced nut aside), success from each start level, share of episodes started there */
  e: number[]; P: number[]; share: number[];
  /** share of episodes on each variant */
  vshare: number[];
  /** share of re-grasping; success of the episodes played (the training curve) */
  x: number; train: number;
}
export interface RobotRun { hist: RobotIter[]; final: RobotIter; outcome: RobotOutcome; masteredAt: number; seed: number }

/** REINFORCE with reward-to-go and a learnt baseline; configurations drawn by the sampler. */
export function trainRobot(p: Partial<RobotOpts> = {}): RobotRun {
  const o = { ...ROBOT, ...p };
  const r = rng(o.seed * 7919 + 13);
  const n = STEPS.length;
  const theta = Array(n).fill(Math.log(o.q0 / (1 - o.q0)));
  let tx = Math.log(o.x0 / (1 - o.x0));
  const histories: number[][] = CONFIGS.map(() => []);
  const base = CONFIGS.map(() => Array(HORIZON).fill(0));
  const hist: RobotIter[] = [];
  let train = 0, masteredAt = -1;
  const iters = Math.round(o.episodes / o.batch);
  // the sampler draws a configuration; « from scratch only » means level 5 of every variant
  const shareOf = (rates: number[]) => {
    if (o.sampler === 2) { const w: number[] = CONFIGS.map((c) => (c.level === LEVELS.length - 1 ? 1 : 0)); const t = w.reduce((a, x) => a + x, 0); return w.map((x) => x / t); }
    return samplerShares(rates, o);
  };
  for (let it = 0; it <= iters; it++) {
    const rates = histories.map((h) => (h.length ? h.reduce((a, x) => a + x, 0) / h.length : 0));
    const share = shareOf(rates);
    const e = skillOf(theta, VARIANTS[MAIN].d);
    const P = chainSuccess(e, sig(tx), o.cap);
    if (it % 4 === 0 || it === iters) {
      const lv = LEVELS.map((_, j) => CONFIGS.reduce((a, c, ci) => a + (c.level === j ? share[ci] : 0), 0));
      const vs = VARIANTS.map((_, k) => CONFIGS.reduce((a, c, ci) => a + (c.variant === k ? share[ci] : 0), 0));
      hist.push({ ep: it * o.batch, e, P, share: lv, vshare: vs, x: sig(tx), train });
    }
    if (masteredAt < 0 && P[n - 1] >= 0.8) masteredAt = it * o.batch;
    if (it === iters) break;
    const g = Array(n + 1).fill(0);
    let wins = 0;
    const eps: { ep: Episode; ci: number }[] = [];
    for (let k = 0; k < o.batch; k++) {
      let u = r(), ci = CONFIGS.length - 1;
      for (let j = 0; j < CONFIGS.length; j++) { u -= share[j]; if (u < 0) { ci = j; break; } }
      const ep = episode(theta, tx, CONFIGS[ci].level, CONFIGS[ci].variant, o, r);
      eps.push({ ep, ci });
      wins += ep.success ? 1 : 0;
      histories[ci].push(ep.success ? 1 : 0);
      if (histories[ci].length > o.hist) histories[ci].shift();
    }
    for (const { ep, ci } of eps) {
      const d = episodeGrad(ep, theta, tx, o, (_, t) => (o.baseline ? base[ci][t] : 0));
      for (let i = 0; i <= n; i++) g[i] += d[i];
    }
    // the baseline: an average of the returns-to-go from each configuration and time
    for (const { ep, ci } of eps) for (let t = 0; t < HORIZON; t++) base[ci][t] += 0.1 * (ep.rewards.slice(t).reduce((a, x) => a + x, 0) - base[ci][t]);
    for (let i = 0; i < n; i++) theta[i] = Math.max(-30, Math.min(30, theta[i] + (o.lr * g[i]) / o.batch));
    tx = Math.max(-30, Math.min(30, tx + (o.lr * g[n]) / o.batch));
    train = 0.9 * train + 0.1 * (wins / o.batch);
  }
  const final = hist[hist.length - 1];
  const P5 = final.P[n - 1];
  const outcome: RobotOutcome = P5 >= 0.8 ? 'mastered' : P5 < 1e-6 && Math.min(...theta) < -10 ? 'collapse' : final.train < 0.05 ? 'stuck'
    : final.train >= 0.5 && P5 < 0.2 ? 'easy' : final.x < 0.5 ? 'capped' : 'slow';
  return { hist, final, outcome, masteredAt, seed: o.seed };
}

const robotKey = (v: Record<string, number>) => [...['sampler', 'target', 'reward', 'w', 'lr', 'batch', 'baseline'].map((k) => v[k] ?? (ROBOT as any)[k]), v.nseeds ?? ROBOT_SEEDS.length].join('|');
const robotOpts = (v: Record<string, number>): Partial<RobotOpts> => ({
  sampler: v.sampler ?? ROBOT.sampler, target: v.target ?? ROBOT.target, reward: v.reward ?? ROBOT.reward, w: v.w ?? ROBOT.w,
  lr: v.lr ?? ROBOT.lr, batch: Math.round(v.batch ?? ROBOT.batch), baseline: v.baseline ?? ROBOT.baseline,
});
export interface RobotSeeds { runs: RobotRun[]; outcome: RobotOutcome; counts: Partial<Record<RobotOutcome, number>> }
/** Trainings that differ only by the luck of their episodes (4, or `nseeds`); the outcome is the one most of them reach. */
export const robotSeeds = memo((v: Record<string, number>): RobotSeeds => {
  const runs = Array.from({ length: Math.round(v.nseeds ?? ROBOT_SEEDS.length) }, (_, i) => trainRobot({ ...robotOpts(v), seed: i + 1 }));
  const counts: Partial<Record<RobotOutcome, number>> = {};
  for (const x of runs) counts[x.outcome] = (counts[x.outcome] ?? 0) + 1;
  const outcome = (Object.entries(counts).sort((a, b) => b[1]! - a[1]!)[0][0]) as RobotOutcome;
  return { runs, outcome, counts };
}, { key: robotKey });
/** The first of these trainings: the one the stage shows. */
export const robotOf = (v: Record<string, number>): RobotRun => robotSeeds(v).runs[0];
export const robotAt = (run: RobotRun, ep: number): RobotIter => run.hist.reduce((a, h) => (h.ep <= ep ? h : a), run.hist[0]);
export const ROBOT_OUTCOME: Record<RobotOutcome, string> = {
  mastered: 'tâche complète maîtrisée',
  slow: 'progrès trop lents',
  capped: 'plafonne : force la pièce',
  stuck: 'bloqué : aucun succès',
  easy: 'réussit l’entraînement, échoue la tâche complète',
  collapse: 'effondré : une sous-étape est devenue impossible',
};

/**
 * How much the estimate of the gradient varies from one episode to the next,
 * at the starting policy, start states drawn uniformly: the sum of the
 * variances of its components, over n episodes. Compares REINFORCE with the
 * whole return, with the return-to-go minus a baseline, and with the shaping.
 */
export const gradVariance = memo((): { plain: number; baseline: number; shaped: number[]; ws: number[]; rewardVar: number[]; rewardP: number[] } => {
  const o: RobotOpts = { ...ROBOT };
  const theta = Array(STEPS.length).fill(Math.log(0.6 / 0.4)), tx = 0;
  const N = 20000;
  const draw = (oo: RobotOpts) => { const r = rng(4242); return Array.from({ length: N }, () => episode(theta, tx, Math.floor(r() * LEVELS.length), MAIN, oo, r)); };
  const eps = draw(o);
  const togo = (e: Episode, t: number) => e.rewards.slice(t).reduce((a, x) => a + x, 0);
  // the exact average return-to-go from each level and time: the best baseline of this kind
  const avg = LEVELS.map((_, l) => { const xs = eps.filter((e) => e.level === l); return Array.from({ length: HORIZON }, (_, t) => xs.reduce((a, e) => a + togo(e, t), 0) / Math.max(1, xs.length)); });
  const variance = (grads: number[][]) => {
    const d = grads[0].length, m = Array(d).fill(0);
    for (const g of grads) g.forEach((x, i) => (m[i] += x / grads.length));
    return grads.reduce((a, g) => a + g.reduce((p, x, i) => p + (x - m[i]) ** 2, 0), 0) / grads.length;
  };
  const plain = variance(eps.map((e) => episodeGrad(e, theta, tx, o, () => 0)));
  const baseline = variance(eps.map((e) => episodeGrad(e, theta, tx, o, (ep, t) => avg[ep.level][t])));
  const ws = [0.25, 0.5, 1];
  const shaped = ws.map((w) => { const so = { ...o, reward: 2, w }; return variance(draw(so).map((e) => episodeGrad(e, theta, tx, so, () => 0))); });
  // the variance of the binary reward from each level, against P(1 − P)
  const P = chainSuccess(skillOf(theta, VARIANTS[MAIN].d), sig(tx), o.cap);
  const rewardVar = LEVELS.map((_, l) => { const xs: number[] = eps.filter((e) => e.level === l).map((e) => (e.success ? 1 : 0)); const m = xs.reduce((a, x) => a + x, 0) / xs.length; return xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length; });
  return { plain, baseline, shaped, ws, rewardVar, rewardP: P.map((p) => p * (1 - p)) };
}, { key: () => 'var' });

// ------------------------------------------------------------ the model

export const model: DomainModel = {
  name: 'morpion, recherche Monte-Carlo, auto-jeu et assemblage robotique',
  checks: [
    { name: 'le morpion compte 255 168 parties et 5 478 positions', run: () => { const t = countTree(); return t.games === 255_168 && t.positions === 5_478 ? null : `${t.games} parties, ${t.positions} positions`; } },
    { name: 'l’arbre complet du morpion a 549 946 nœuds', run: () => (countTree().nodes === 549_946 ? null : `${countTree().nodes} nœuds`) },
    { name: 'joué parfaitement, le morpion est nul', run: () => (minimax(EMPTY) === 0 ? null : `valeur ${minimax(EMPTY)}`) },
    { name: 'un coup gagnant immédiat est le seul meilleur coup', run: () => { const b = after([0, 3, 1, 4]); const ms = bestMoves(b); return ms.length === 1 && ms[0] === 2 ? null : `meilleurs coups ${ms}`; } },
    { name: 'OpenSpiel (DeepMind) : même arbre, même valeur du morpion', run: () => (OPENSPIEL.nodes === countTree().nodes && OPENSPIEL.rootValue === minimax(EMPTY) ? null : 'désaccord') },
    {
      name: 'OpenSpiel (DeepMind) : défaites compatibles à 95 % pour chaque réglage comparé',
      run: () => {
        const overlap = (a: number, b: number) => { const x = wilson(a, OPENSPIEL.games), y = wilson(b, OPENSPIEL.games); return x[0] <= y[1] && y[0] <= x[1]; };
        const bad = [
          ...OPENSPIEL.bySims.filter((o) => !overlap(mctsOf({ sims: o.sims, c: 5 }).vsPerfect.losses, o.losses)).map((o) => `${o.sims} simulations`),
          ...OPENSPIEL.byC.filter((o) => !overlap(mctsOf({ sims: 1600, c: o.c }).vsPerfect.losses, o.losses)).map((o) => `c = ${o.c}`),
        ];
        return bad.length ? `désaccord : ${bad.join(', ')}` : null;
      },
    },
    { name: 'la recherche nominale (1 600 simulations) ne perd pas contre le joueur parfait', run: () => (mctsOf({}).outcome === 'solid' ? null : MCTS_OUTCOME[mctsOf({}).outcome]) },
    { name: 'l’auto-jeu nominal : la recherche guidée par le réseau perd moins de 5 % des parties', run: () => (trainOf({}).outcome === 'unbeatable' ? null : `défaites ${checkpointAt(trainOf({}), 1e9).searchLoss}`) },
    { name: 'le robot nominal (SGS, récompense binaire) maîtrise la tâche complète', run: () => (robotSeeds({}).outcome === 'mastered' ? null : ROBOT_OUTCOME[robotSeeds({}).outcome]) },
    { name: 'la descente de gradient nominale atteint le minimum des moindres carrés', run: () => { const r = gdOf({}); const e = r.path[r.path.length - 1]; return r.outcome === 'converged' && Math.abs(e.a - valueBest().a) < 0.02 ? null : `${r.outcome}, a = ${e.a.toFixed(3)} au lieu de ${valueBest().a.toFixed(3)}`; } },
    { name: 'au minimum, le gradient est nul', run: () => { const b = valueBest(); const g = valueGrad(b.a, b.b); return Math.hypot(g[0], g[1]) < 1e-9 ? null : `gradient ${g}`; } },
    { name: 'la variance d’une récompense binaire vaut P(1 − P)', run: () => { const v = gradVariance(); return v.rewardVar.every((x, i) => Math.abs(x - v.rewardP[i]) < 0.02) ? null : `${v.rewardVar} / ${v.rewardP}`; } },
    { name: 'la base de référence réduit la variance du gradient', run: () => { const v = gradVariance(); return v.baseline < v.plain ? null : `${v.baseline} ≥ ${v.plain}`; } },
    { name: 'le succès d’une chaîne est le produit des sous-étapes', run: () => (Math.abs(successByLevel([0.5, 0.5, 0.5, 0.5, 0.5])[4] - 0.5 ** 5) < 1e-12 ? null : 'produit faux') },
  ],
  countTree, minimax, search, train, trainRobot,
};
