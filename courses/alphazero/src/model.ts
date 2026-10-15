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
    n.children = ms.map((m) => ({ move: m, board: play(n.board, m), N: 0, W: 0, P: p && tot > 0 ? p[m] / tot : 1 / ms.length, children: null }));
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

export type MctsOutcome = 'solid' | 'fragile' | 'weak';
export interface MctsRun { vsPerfect: Match; vsRandom: Match; outcome: MctsOutcome }
/** Pure MCTS (random playouts) with `sims` simulations per move and constant c: 40 games against each opponent. */
export const mctsOf = memo((v: Record<string, number>): MctsRun => {
  const sims = Math.round(v.sims ?? MCTS_NOMINAL.sims), c = v.c ?? MCTS_NOMINAL.c;
  const p = mctsPlayer(sims, c);
  const vsPerfect = match(p, perfectPlayer, 40, 7);
  const vsRandom = match(p, randomPlayer, 40, 11);
  const lr = vsPerfect.losses / vsPerfect.games;
  return { vsPerfect, vsRandom, outcome: vsPerfect.losses <= 1 ? 'solid' : lr <= 0.25 ? 'fragile' : 'weak' };
}, { key: (v) => `${Math.round(v.sims ?? MCTS_NOMINAL.sims)}|${v.c ?? MCTS_NOMINAL.c}` });
export const MCTS_NOMINAL = { sims: 1600, c: 1.5 };
export const MCTS_OUTCOME: Record<MctsOutcome, string> = { solid: 'ne perd presque jamais', fragile: 'perd quelques parties', weak: 'perd souvent' };

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

/**
 * The two « networks » of the miniature: a value table and a policy table.
 * Like AlphaGo Zero, it uses the symmetries of the board: a position and its
 * rotations or reflections share one entry.
 */
export interface Tables { V: Map<string, number>; P: Map<string, number[]> }
/** The prior of a board, in its own cells (null if the position was never seen). */
export function priorOf(t: Tables, b: Board): number[] | null {
  const { k, s } = canon(b);
  const pc = t.P.get(k);
  if (!pc) return null;
  const p = Array(9).fill(0);
  s.forEach((j, i) => { p[j] = pc[i]; });
  return p;
}
export const valueOf = (t: Tables, b: Board): number => t.V.get(canon(b).k) ?? 0;
export const tableEval = (t: Tables): Evaluator => (b) => ({ v: valueOf(t, b), p: priorOf(t, b) });
/** The policy alone: the move with the highest prior (the first one on a tie). */
export const netMove = (t: Tables, b: Board): number => {
  const p = priorOf(t, b);
  const ms = legal(b);
  return p ? ms.reduce((a, m) => (p[m] > p[a] ? m : a), ms[0]) : ms[0];
};

export interface TrainOpts { games: number; sims: number; c: number; explore: number; lr: number; seed: number; every: number; evalSims: number }
export const TRAIN: TrainOpts = { games: 600, sims: 48, c: 1.5, explore: 0.75, lr: 0.02, seed: 2, every: 20, evalSims: 48 };

export interface Checkpoint {
  games: number; netLoss: number; searchLoss: number; distinct: number; known: number;
  /** what the tables say about the FOCUS positions at this point */
  probe: { p: number[] | null; v: number }[];
}
export type TrainOutcome = 'unbeatable' | 'beatable';
export interface TrainRun { checkpoints: Checkpoint[]; tables: Tables; games: { moves: number[]; w: number }[]; outcome: TrainOutcome; distinct: number }

/**
 * A miniature AlphaZero. Each game of self-play runs the search at every move
 * with the current tables; the move is drawn in proportion to the visits with
 * probability `explore`, else the most visited one is played. After the game,
 * each position's value moves towards the result (from the side of the player
 * to move) and its policy towards the visit shares of the search.
 */
export function train(p: Partial<TrainOpts> = {}): TrainRun {
  const o = { ...TRAIN, ...p };
  const r = rng(o.seed);
  const t: Tables = { V: new Map(), P: new Map() };
  const ev = tableEval(t);
  const checkpoints: Checkpoint[] = [];
  const games: TrainRun['games'] = [];
  const seen = new Set<string>();
  const seenN = new Map<string, number>();
  const measure = (g: number): void => {
    checkpoints.push({
      games: g,
      netLoss: lossRate((b) => netMove(t, b)),
      searchLoss: lossRate((b) => search(b, { sims: o.evalSims, c: o.c, evaluate: ev }).best),
      distinct: seen.size,
      known: t.V.size,
      probe: FOCUS.map((b) => ({ p: priorOf(t, b), v: valueOf(t, b) })),
    });
  };
  measure(0);
  for (let g = 1; g <= o.games; g++) {
    let b = EMPTY;
    const hist: { k: string; pi: number[]; side: number }[] = [];
    const moves: number[] = [];
    while (!over(b)) {
      const s = search(b, { sims: o.sims, c: o.c, evaluate: ev, seed: Math.floor(r() * 1e9), noise: o.explore });
      const tot = s.visits.reduce((a, x) => a + x, 0);
      const pi = s.visits.map((x) => x / tot);
      let m = s.best;
      if (r() < o.explore) {
        let u = r(), acc = 0;
        for (let i = 0; i < 9; i++) { acc += pi[i]; if (pi[i] > 0) m = i; if (u < acc && pi[i] > 0) { m = i; break; } }
      }
      hist.push({ k: keyOf(b), pi, side: toMove(b) });
      moves.push(m);
      b = play(b, m);
    }
    const w = winner(b);
    for (const h of hist) {
      const z = w === 0 ? 0 : w === h.side ? 1 : -1;
      const { k, s } = canon(boardOf(h.k));
      const n = (seenN.get(k) ?? 0) + 1;
      seenN.set(k, n);
      const lr = Math.max(o.lr, 1 / n);               // a running mean at first, then a moving one
      const v0 = t.V.get(k) ?? 0;
      t.V.set(k, v0 + lr * (z - v0));
      const pi = s.map((j) => h.pi[j]);               // the visit shares, in the canonical cells
      const p0 = t.P.get(k) ?? pi;
      t.P.set(k, p0.map((x, i) => x + lr * (pi[i] - x)));
    }
    seen.add(moves.join(''));
    games.push({ moves, w });
    if (g % o.every === 0 || g === o.games) measure(g);
  }
  const last = checkpoints[checkpoints.length - 1];
  return { checkpoints, tables: t, games, distinct: seen.size, outcome: last.searchLoss === 0 ? 'unbeatable' : 'beatable' };
}

/** The training run the live values describe (explore, sims), shared by the stage and the diagrams. */
export const trainOf = memo(
  (v: Record<string, number>): TrainRun => { const sims = Math.round(v.tsims ?? TRAIN.sims); return train({ explore: v.explore ?? TRAIN.explore, sims, evalSims: sims }); },
  { key: (v) => `${v.explore ?? TRAIN.explore}|${Math.round(v.tsims ?? TRAIN.sims)}` },
);
/** The checkpoint at `games` games of self-play (the last one before). */
export const checkpointAt = (run: TrainRun, games: number): Checkpoint =>
  run.checkpoints.reduce((a, c) => (c.games <= games ? c : a), run.checkpoints[0]);
export const TRAIN_OUTCOME: Record<TrainOutcome, string> = { unbeatable: 'ne perd plus', beatable: 'perd encore' };

// --------------------------------------------------------- robot assembly

/** The sub-steps of an assembly, in the order the robot does them. */
export const STEPS = ['saisir', 'orienter', 'approcher', 'aligner', 'insérer'];
/** Start states: level j leaves the last j sub-steps to do (5: parts laid out, from scratch). */
export const LEVELS = ['pièce alignée', 'pièce près du but', 'pièce orientée en main', 'pièce saisie', 'pièces détachées'];
const ORIENT = 1;

export interface RobotOpts {
  iters: number;
  /** 0 uniform, 1 success-guided sampling, 2 from scratch only */
  sampler: number;
  /** SGS: the success rate it favours, and how sharply */
  target: number; conc: number; floor: number;
  /** weight of the dense reward (0: binary reward only) */
  w: number;
  lr: number; q0: number; x0: number;
  /** forcing a part without re-grasping keeps this share of the orientation skill */
  cap: number;
}
export const ROBOT: RobotOpts = { iters: 250, sampler: 1, target: 0.5, conc: 6, floor: 0.05, w: 0, lr: 0.3, q0: 0.15, x0: 0.05, cap: 0.4 };

/** Probability of each sub-step of the policy: skill q, and the share x of re-grasping for the orientation. */
export const stepProb = (q: number[], x: number, cap: number): number[] => q.map((qi, i) => (i === ORIENT ? qi * (x + (1 - x) * cap) : qi));
/** Success from each start level: the product of the sub-steps left. */
export const successByLevel = (e: number[]): number[] => LEVELS.map((_, j) => e.slice(STEPS.length - 1 - j).reduce((s, x) => s * x, 1));

/** The SGS weight of a start state of success rate s: a Beta-shaped bump around `target`, never below `floor`. */
export function sgsWeight(s: number, target: number, conc: number, floor: number): number {
  const a = 1 + conc * target, b = 1 + conc * (1 - target);
  const pdf = (u: number) => Math.pow(u, a - 1) * Math.pow(1 - u, b - 1);
  return floor + (1 - floor) * (pdf(Math.min(1, Math.max(0, s))) / pdf(target));
}
/** The share of episodes started at each level. */
export function samplerShares(P: number[], o: RobotOpts): number[] {
  if (o.sampler === 2) return LEVELS.map((_, j) => (j === LEVELS.length - 1 ? 1 : 0));
  const w = o.sampler === 1 ? P.map((s) => sgsWeight(s, o.target, o.conc, o.floor)) : P.map(() => 1);
  const tot = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / tot);
}

export type RobotOutcome = 'mastered' | 'slow' | 'capped' | 'stuck' | 'easy';
export interface RobotIter {
  it: number;
  /** success of each sub-step, success from each start level, share of episodes started there */
  e: number[]; P: number[]; share: number[];
  /** share of re-grasping for the orientation; success of the episodes played (the training curve) */
  x: number; train: number;
}
export interface RobotRun { hist: RobotIter[]; final: RobotIter; outcome: RobotOutcome; masteredAt: number }

/**
 * Training in expected value, one batch of episodes per iteration. A
 * sub-step learns from the episodes started at a level only in proportion to
 * P(1 − P), P the success from that level: a batch always lost, or always
 * won, teaches nothing with a binary reward. A dense reward adds, for each
 * sub-step reached, a signal of weight w, and it rewards staying close to the
 * goal: re-grasping (moving the part away first) costs w each time.
 */
export function trainRobot(p: Partial<RobotOpts> = {}): RobotRun {
  const o = { ...ROBOT, ...p };
  const n = STEPS.length;
  const q = Array(n).fill(o.q0);
  let lx = Math.log(o.x0 / (1 - o.x0));
  const hist: RobotIter[] = [];
  let masteredAt = -1;
  for (let it = 0; it <= o.iters; it++) {
    const x = 1 / (1 + Math.exp(-lx));
    const e = stepProb(q, x, o.cap);
    const P = successByLevel(e);
    const share = samplerShares(P, o);
    const rec = { it, e, P, share, x, train: share.reduce((s, sh, j) => s + sh * P[j], 0) };
    hist.push(rec);
    if (masteredAt < 0 && P[n - 1] >= 0.8) masteredAt = it;
    if (it === o.iters) break;
    const dq = Array(n).fill(0);
    let dx = 0;
    LEVELS.forEach((_, j) => {
      const first = n - 1 - j;                      // the first sub-step left at level j
      const signal = P[j] * (1 - P[j]);
      let reach = 1;
      for (let i = first; i < n; i++) {
        dq[i] += share[j] * (signal + o.w * reach) * (1 - q[i]);
        if (i === ORIENT) {
          const later = e.slice(i + 1).reduce((s, y) => s * y, 1);
          // binary: re-grasping raises the success; dense: it moves the part away from the goal
          dx += share[j] * reach * (signal * q[i] * (1 - o.cap) * later * 4 - o.w);
        }
        reach *= e[i];
      }
    });
    for (let i = 0; i < n; i++) q[i] = Math.min(0.995, q[i] + o.lr * dq[i]);
    lx = Math.max(-8, Math.min(8, lx + o.lr * 4 * dx * x * (1 - x) * 10));
  }
  const final = hist[hist.length - 1];
  const P5 = final.P[n - 1];
  const outcome: RobotOutcome = P5 >= 0.8 ? 'mastered' : final.train < 0.05 ? 'stuck' : final.train >= 0.6 && P5 < 0.2 ? 'easy' : final.x < 0.5 ? 'capped' : 'slow';
  return { hist, final, outcome, masteredAt };
}

/** The training the live values describe; shared by the stage and the diagrams. */
export const robotOf = memo(
  (v: Record<string, number>): RobotRun => trainRobot({ sampler: v.sampler ?? ROBOT.sampler, target: v.target ?? ROBOT.target, w: v.w ?? ROBOT.w, iters: ROBOT.iters }),
  { key: (v) => `${v.sampler ?? ROBOT.sampler}|${v.target ?? ROBOT.target}|${v.w ?? ROBOT.w}` },
);
/** The iteration `it` of a run (clamped). */
export const robotAt = (run: RobotRun, it: number): RobotIter => run.hist[Math.max(0, Math.min(run.hist.length - 1, Math.round(it)))];
export const ROBOT_OUTCOME: Record<RobotOutcome, string> = {
  mastered: 'tâche complète maîtrisée',
  slow: 'progrès trop lents',
  capped: 'plafonne : force la pièce',
  stuck: 'bloqué : aucun succès',
  easy: 'réussit l’entraînement, échoue la tâche complète',
};
export const SAMPLERS = ['uniforme', 'guidé par le succès', 'tâche complète seule'];

// ------------------------------------------------------------ the model

export const model: DomainModel = {
  name: 'morpion, recherche Monte-Carlo, auto-jeu et assemblage robotique',
  checks: [
    { name: 'le morpion compte 255 168 parties et 5 478 positions', run: () => { const t = countTree(); return t.games === 255_168 && t.positions === 5_478 ? null : `${t.games} parties, ${t.positions} positions`; } },
    { name: 'l’arbre complet du morpion a 549 946 nœuds', run: () => (countTree().nodes === 549_946 ? null : `${countTree().nodes} nœuds`) },
    { name: 'joué parfaitement, le morpion est nul', run: () => (minimax(EMPTY) === 0 ? null : `valeur ${minimax(EMPTY)}`) },
    { name: 'un coup gagnant immédiat est le seul meilleur coup', run: () => { const b = after([0, 3, 1, 4]); const ms = bestMoves(b); return ms.length === 1 && ms[0] === 2 ? null : `meilleurs coups ${ms}`; } },
    { name: 'la recherche nominale (1 600 simulations) ne perd pas contre le joueur parfait', run: () => (mctsOf({}).outcome === 'solid' ? null : MCTS_OUTCOME[mctsOf({}).outcome]) },
    { name: 'l’auto-jeu nominal mène à un joueur qui ne perd plus', run: () => (trainOf({}).outcome === 'unbeatable' ? null : `défaites ${checkpointAt(trainOf({}), 1e9).searchLoss}`) },
    { name: 'le robot nominal (SGS, récompense binaire) maîtrise la tâche complète', run: () => (robotOf({}).outcome === 'mastered' ? null : ROBOT_OUTCOME[robotOf({}).outcome]) },
    { name: 'le succès d’une chaîne est le produit des sous-étapes', run: () => (Math.abs(successByLevel([0.5, 0.5, 0.5, 0.5, 0.5])[4] - 0.5 ** 5) < 1e-12 ? null : 'produit faux') },
  ],
  countTree, minimax, search, train, trainRobot,
};
