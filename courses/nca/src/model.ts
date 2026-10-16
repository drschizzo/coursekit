// The domain model of the course on « Reasoning with Neural Cellular
// Automata » (Etcheverry et al., arXiv 2609.36126). The paper learns the
// update rule of each cell; this model writes small rules by hand, with the
// same constraints (a cell sees only its neighbours, every cell runs the same
// rule, cells fire at random), so that what the paper observes can be run:
//
//   1. a maze automaton: an exploration wave from the endpoints, then a wave
//      that prunes dead ends (the « backtracking » of the paper's figure 2A),
//      with uniform or adaptive firing, and damage;
//   2. a constraint grid: two colours, no cell may share its colour with a
//      neighbour (a local constraint, a global solution, like a Sudoku), to
//      show symmetry breaking, local minima, noise and parallel trials;
//   3. small formulas: how far a signal travels, how many parameters a NCA
//      has, how old the states of a replay pool are, what pruning saves.
//
// Diagrams, the stage, experiments, exercises and the figures of the text all
// run this file. The paper's own results are in PAPER, quoted, never derived.

import { memo, rng, type DomainModel } from '@coursekit/core';

// the seeded generator comes from @coursekit/core
export { rng };

// ------------------------------------------------------------ the paper

/** Figures reported by the paper (table 1, section 4, appendix C). */
export const PAPER = {
  pFire: 0.8,              // cell fire rate, every benchmark
  pLow: 0.4,               // fire rate of confident cells (section 4.4)
  mazeTrain: 9,            // Maze-OOD: trained on 9 × 9 mazes
  mazeBig: 201,            // … tested up to 201 × 201
  mazeBigSteps: 13000,     // with D = 13 000 steps
  mazeParams: 10_000,      // NCA, Maze-OOD
  mazeC: 16, mazeHeads: 4, mazeE: 2, // its channels, perception heads, MLP expansion (table 3)
  mazeHardC: 32,           // Maze-Hard: 32 channels
  mazeHardParams: 41_000,  // NCA, Maze-Hard
  deepThinkParams: 784_000,
  deepThinkBig: 74.0,      // % solved on 201 × 201 by DeepThink
  ncaBig: 100.0,           // % solved on 201 × 201 by the NCA
  mazeN: 100,              // training rollout length (Maze-OOD)
  mazeSeedRatio: 0.25,     // share of fresh boards in a batch
  mazeTrainMinutes: 3,
  sudokuK1: 66.1,          // Sudoku-OOD, one rollout
  sudokuK: 2048,           // … number of parallel rollouts
  sudokuKAcc: 98.5,        // … solved with them
  sudokuTrainClues: 31,    // trained on boards with at least 31 clues
  sudokuTestClues: 17,     // solves boards with 17 clues
  adaptSteps: 1.29,        // adaptive firing: steps × 1,29 …
  adaptUpdates: 0.71,      // … cell updates × 0,71
  repairUpdates: 0.52,     // after damage: updates × 0,52
  arcNca: 48.8,            // ARC-AGI-1, pass@2
  arcTrm: 44.6,
  arcNcaParams: 3.5,       // millions
  arcTrmParams: 7,
  visualSide: 256,         // Visual Sudoku: 256 × 256 pixels
  visualEasy: 87.8,
  visualHard: 18.9,
  pruneD: 256, pruneAcc: 81.7, pruneBaseAcc: 25.6, // Sudoku-Extreme, same compute as D = 64
};

// ------------------------------------------------------ small formulas

/** Parameters of a NCA (appendix B.1): `heads` 3 × 3 kernels, a two-layer MLP expanding by E. */
export function ncaParams(C: number, heads: number, E: number): number {
  const z = heads * C, hidden = E * z;
  return heads * 9 + (z * hidden + hidden) + (hidden * C + C);
}

/** Compute of a pruned ensemble, as a share of K·D, when it is halved m times (appendix B.6). */
export const pruneShare = (m: number): number => (2 - 2 ** -(m - 1)) / m;

/** Probability that at least one of K independent trials succeeds. */
export const atLeastOne = (p: number, K: number): number => 1 - (1 - p) ** K;

/** Sample replay: probability that a training rollout starts at least k·N steps after a fresh board. */
export const replayOlder = (rSeed: number, k: number): number => (1 - rSeed) ** k;

/** A signal spreading from the centre of a side × side grid (Moore neighbourhood, firing p): cells reached after t steps. */
export function spread(side: number, t: number, p: number, seed = 1): Uint8Array {
  const R = rng(seed), N = side * side, c = (side - 1) / 2;
  let on = new Uint8Array(N);
  on[c * side + c] = 1;
  for (let s = 0; s < t; s++) {
    const nx = on.slice();
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const i = y * side + x;
      if (on[i] || R() >= p) continue;
      for (let dy = -1; dy <= 1 && !nx[i]; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < side && Y < side && on[Y * side + X]) { nx[i] = 1; break; }
      }
    }
    on = nx;
  }
  return on;
}

// ------------------------------------------------------------- the maze

export interface Maze { side: number; wall: Uint8Array; ends: [number, number]; truth: Uint8Array; open: number; pathLen: number }

/** A perfect maze (one path between any two cells), carved by a seeded depth-first search. */
export const makeMaze = memo((side: number, seed: number): Maze => {
  const n = (side - 1) / 2, S = side, R = rng(seed * 7919 + side);
  const wall = new Uint8Array(S * S).fill(1), seen = new Uint8Array(n * n);
  const stack: [number, number][] = [[0, 0]];
  seen[0] = 1; wall[S + 1] = 0;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => [x + dx, y + dy] as const)
      .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !seen[b * n + a]);
    if (!next.length) { stack.pop(); continue; }
    const [a, b] = next[Math.floor(R() * next.length)];
    seen[b * n + a] = 1;
    wall[(2 * b + 1) * S + 2 * a + 1] = 0;
    wall[(y + b + 1) * S + (x + a + 1)] = 0;
    stack.push([a, b]);
  }
  const ends: [number, number] = [S + 1, (S - 2) * S + S - 2];
  // the solution, for scoring only: the cells never see it
  const prev = new Int32Array(S * S).fill(-1), queue = [ends[0]];
  prev[ends[0]] = ends[0];
  for (let k = 0; k < queue.length; k++) for (const d of [1, -1, S, -S]) { const j = queue[k] + d; if (!wall[j] && prev[j] < 0) { prev[j] = queue[k]; queue.push(j); } }
  const truth = new Uint8Array(S * S);
  let pathLen = 0;
  for (let i = ends[1]; ; i = prev[i]) { truth[i] = 1; pathLen++; if (i === ends[0]) break; }
  return { side, wall, ends, truth, open: wall.reduce((s, w) => s + (w ? 0 : 1), 0), pathLen };
}, { key: (side, seed) => `${side}|${seed}`, max: 32 });

export interface CellState { reached: boolean; dead: boolean }

/**
 * The rule every open cell runs when it fires. `nb`: its open neighbours
 * (up, down, left, right; walls excluded). Explore: a cell is reached when a
 * neighbour is. Prune: a reached cell with at most one living neighbour is a
 * dead end, and dies.
 */
export function cellRule(c: CellState, nb: CellState[]): CellState {
  const reached = c.reached || nb.some((n) => n.reached);
  const alive = nb.filter((n) => !n.dead).length;
  return { reached, dead: c.dead || (reached && alive <= 1) };
}

export type MazeOutcome = 'solved' | 'exploring' | 'pruning' | 'frozen';
export const MAZE_OUTCOME: Record<MazeOutcome, string> = {
  solved: 'résolu', exploring: 'exploration inachevée', pruning: 'élagage inachevé', frozen: 'élagage figé',
};

export interface MazeParams { side: number; seed: number; p: number; adaptive: boolean; plow: number; D: number; damage: boolean; rule?: (c: CellState, nb: CellState[]) => CellState }
export const MAZE: MazeParams = { side: 21, seed: 1, p: PAPER.pFire, adaptive: false, plow: PAPER.pLow, D: 300, damage: false };

export interface MazeRun {
  maze: Maze; p: MazeParams; steps: number;
  /** cell states after each step t (index t, 0 = start): 0 unreached, 1 reached, 2 dead */
  frames: Uint8Array[];
  /** which cells fired at step t (index t − 1) */
  fired: Uint8Array[];
  wrong: number[]; updates: number[];
  solvedAt: number; damageAt: number; zone: Uint8Array;
  outcome: MazeOutcome;
  /** cell updates (all cells, walls included) up to the solution, or to the end */
  work: number;
  /** after damage: steps and cell updates to solve again (−1: not solved) */
  repairSteps: number; repairWork: number;
}

/** Damage circles of the maze: a fixed pattern for a given maze (zeroed states, as in figure 8B). */
function damageZone(m: Maze, seed: number): Uint8Array {
  const S = m.side, R = rng(seed + 101), z = new Uint8Array(S * S);
  for (let k = 0; k < 3; k++) {
    const cx = 2 + R() * (S - 4), cy = 2 + R() * (S - 4), r = 1.5 + S * 0.07;
    for (let i = 0; i < S * S; i++) if (!m.wall[i] && i !== m.ends[0] && i !== m.ends[1] && ((i % S) - cx) ** 2 + (Math.floor(i / S) - cy) ** 2 <= r * r) z[i] = 1;
  }
  return z;
}

/** Runs the maze automaton for D steps. Walls fire too (they never change: they count as confident). */
export function rollMaze(q: Partial<MazeParams> = {}): MazeRun {
  const P = { ...MAZE, ...q };
  const m = makeMaze(P.side, P.seed), S = m.side, N = S * S, R = rng(P.seed * 31 + 7);
  const rule = P.rule ?? cellRule;
  let st = new Uint8Array(N);
  st[m.ends[0]] = st[m.ends[1]] = 1;
  const sure = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (m.wall[i]) sure[i] = 1;
  const nbs: number[][] = [];
  for (let i = 0; i < N; i++) nbs.push(m.wall[i] ? [] : [i - S, i + S, i - 1, i + 1].filter((j) => !m.wall[j]));
  const zone = P.damage ? damageZone(m, P.seed) : new Uint8Array(N);
  const frames = [st.slice()], fired: Uint8Array[] = [], wrong: number[] = [], updates: number[] = [];
  const score = (s: Uint8Array) => { let w = 0; for (let i = 0; i < N; i++) if (!m.wall[i] && (s[i] === 1 ? 1 : 0) !== m.truth[i]) w++; return w; };
  wrong.push(score(st));
  let first = -1, damageAt = -1, again = -1, work = 0, lastChange = 0;
  for (let t = 1; t <= P.D; t++) {
    // damage: five steps after the first solution (or half-way), the zone is reset to its initial state
    if (P.damage && damageAt < 0 && (first > 0 ? t > first + 5 : t > P.D / 2)) {
      damageAt = t - 1;
      for (let i = 0; i < N; i++) if (zone[i]) { st[i] = 0; sure[i] = 0; }
    }
    const nx = st.slice(), f = new Uint8Array(N);
    let n = 0, changed = false;
    for (let i = 0; i < N; i++) {
      if (R() >= (P.adaptive && sure[i] ? P.plow : P.p)) continue;
      f[i] = 1; n++;
      if (m.wall[i] || i === m.ends[0] || i === m.ends[1]) continue;
      const c = { reached: st[i] >= 1, dead: st[i] === 2 };
      const r = rule(c, nbs[i].map((j) => ({ reached: st[j] >= 1, dead: st[j] === 2 })));
      const v = r.dead ? 2 : r.reached ? 1 : 0;
      if (v !== st[i]) changed = true;
      // a cell whose update changed nothing is confident (walls always are)
      sure[i] = v === st[i] && v > 0 ? 1 : 0;
      nx[i] = v;
    }
    st = nx; work += n;
    if (changed) lastChange = t;
    frames.push(st.slice()); fired.push(f); updates.push(n);
    const w = score(st);
    wrong.push(w);
    if (w === 0 && first < 0 && damageAt < 0) first = t;
    if (w === 0 && damageAt >= 0 && again < 0) again = t;
    const end = P.damage ? again : first;
    if (end > 0 && t >= end + 20) break;
  }
  const steps = frames.length - 1;
  const last = frames[steps];
  const done = wrong[steps] === 0;
  let outcome: MazeOutcome = 'solved';
  if (!done) {
    let unreached = false;
    for (let i = 0; i < N; i++) if (!m.wall[i] && last[i] === 0) unreached = true;
    outcome = unreached ? 'exploring' : steps - lastChange >= Math.max(50, P.D / 5) ? 'frozen' : 'pruning';
  }
  return {
    maze: m, p: P, steps, frames, fired, wrong, updates, solvedAt: first, damageAt, zone, outcome,
    work: first > 0 ? updates.slice(0, first).reduce((a, b) => a + b, 0) : work,
    repairSteps: again > 0 ? again - damageAt : -1, repairWork: again > 0 ? updates.slice(damageAt, again).reduce((a, b) => a + b, 0) : -1,
  };
}

/** The maze run the live values describe (shared by the stage and the diagrams). */
export const mazeOf = memo(
  (v: Record<string, number>): MazeRun => rollMaze({
    side: v.side ?? MAZE.side, seed: v.mseed ?? MAZE.seed, p: v.p ?? MAZE.p, D: v.D ?? MAZE.D,
    adaptive: (v.adaptive ?? 0) > 0.5, plow: v.plow ?? MAZE.plow, damage: (v.damage ?? 0) > 0.5,
  }),
  { key: (v) => [v.side ?? MAZE.side, v.mseed ?? 1, v.p ?? MAZE.p, v.D ?? MAZE.D, v.adaptive ?? 0, v.plow ?? MAZE.plow, v.damage ?? 0].join("|"), max: 6 },
);

/** Steps the automaton needs to solve mazes of a given side (seeds 1 to 5), with a large budget. */
export const stepsNeeded = memo((side: number, p: number): number[] => {
  const out: number[] = [];
  for (let s = 1; s <= 5; s++) out.push(rollMaze({ side, seed: s, p, D: 40 * side * side }).solvedAt);
  return out;
}, { key: (side, p) => `${side}|${p}` });

// ------------------------------------------------- the constraint grid

/** The colour rule: change colour when at least half of the neighbours share it. */
export function colorRule(color: number, nb: number[]): number {
  const same = nb.filter((c) => c === color).length;
  return same * 2 >= nb.length ? 1 - color : color;
}

export type GridOutcome = 'solved' | 'blink' | 'noisy' | 'stuck' | 'slow';
export const GRID_OUTCOME: Record<GridOutcome, string> = {
  solved: 'résolue', blink: 'clignote', noisy: 'agitée par le bruit', stuck: 'coincée', slow: 'pas encore stable',
};

export interface GridParams { n: number; p: number; eta: number; rn: number; D: number; seed: number; rule?: (c: number, nb: number[]) => number }
export const GRID: GridParams = { n: 10, p: PAPER.pFire, eta: 0, rn: 0.5, D: 250, seed: 1 };

export interface GridRun { n: number; frames: Uint8Array[]; conflicts: number[]; changes: number[]; outcome: GridOutcome; pairs: number }

/** Neighbour pairs that share a colour: the constraints still violated. */
export function conflicts(c: Uint8Array, n: number): number {
  let k = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (x + 1 < n && c[y * n + x] === c[y * n + x + 1]) k++;
    if (y + 1 < n && c[y * n + x] === c[(y + 1) * n + x]) k++;
  }
  return k;
}

/** Runs the grid: random colours, then D steps; noise flips firing cells during the first rn·D steps. */
export function rollGrid(q: Partial<GridParams> = {}, keep = true): GridRun {
  const P = { ...GRID, ...q }, n = P.n, R = rng(P.seed * 7 + 3);
  const rule = P.rule ?? colorRule;
  let c = new Uint8Array(n * n).map(() => (R() < 0.5 ? 1 : 0));
  const nbs: number[][] = [];
  for (let i = 0; i < n * n; i++) { const x = i % n, y = Math.floor(i / n); nbs.push([[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n).map(([a, b]) => b * n + a)); }
  const frames = [c.slice()], cf = [conflicts(c, n)], ch = [0];
  let lastChange = 0;
  for (let t = 1; t <= P.D; t++) {
    const nx = c.slice(), noisy = t <= P.rn * P.D;
    let k = 0;
    for (let i = 0; i < n * n; i++) {
      if (R() >= P.p) continue;
      const v = noisy && R() < P.eta ? 1 - c[i] : rule(c[i], nbs[i].map((j) => c[j]));
      if (v !== c[i]) k++;
      nx[i] = v;
    }
    c = nx;
    if (k) lastChange = t;
    if (keep) frames.push(c.slice());
    cf.push(conflicts(c, n)); ch.push(k);
  }
  // stuck: no progress over the last 60 steps (a seam may still flicker in place)
  const minBefore = Math.min(...cf.slice(0, P.D - 59)), minLast = Math.min(...cf.slice(P.D - 59));
  const outcome: GridOutcome = cf[P.D] === 0 ? 'solved'
    : P.rn >= 1 && P.eta > 0 ? 'noisy'
      : ch[P.D] > 0.3 * n * n ? 'blink'
        : minLast < minBefore && lastChange > 0 ? 'slow' : 'stuck';
  return { n, frames: keep ? frames : [frames[0], c], conflicts: cf, changes: ch, outcome, pairs: 2 * n * (n - 1) };
}

const gridKey = (v: Record<string, number>) => [v.p ?? GRID.p, v.eta ?? GRID.eta, v.rn ?? GRID.rn, v.gseed ?? GRID.seed].join('|');
const gridParams = (v: Record<string, number>, seed: number): Partial<GridParams> => ({ p: v.p ?? GRID.p, eta: v.eta ?? GRID.eta, rn: v.rn ?? GRID.rn, seed });

/** K parallel trials of the grid (seeds gseed … gseed + K − 1), and the one the board confidence picks. */
export const trialsOf = memo((v: Record<string, number>): { runs: GridRun[]; best: number; solved: boolean } => {
  const K = Math.max(1, Math.round(v.K ?? 1)), s0 = v.gseed ?? GRID.seed;
  const runs: GridRun[] = [];
  for (let k = 0; k < K; k++) runs.push(rollGrid(gridParams(v, s0 + k)));
  let best = 0;
  runs.forEach((r, k) => { if (r.conflicts[GRID.D] < runs[best].conflicts[GRID.D]) best = k; });
  return { runs, best, solved: runs[best].outcome === 'solved' };
}, { key: (v) => `${gridKey(v)}|${v.K ?? 1}`, max: 16 });

/** The single grid run the live values describe (trial 1). */
export const gridOf = (v: Record<string, number>): GridRun => trialsOf({ ...v, K: 1 }).runs[0];

/** Share of solved grids over 200 seeds (not the ones the course displays). */
export const gridRate = memo((p: number, eta: number, rn: number): number => {
  let ok = 0;
  for (let s = 0; s < 200; s++) if (rollGrid({ p, eta, rn, seed: 1000 + s }, false).outcome === 'solved') ok++;
  return ok / 200;
}, { key: (p, eta, rn) => `${p}|${eta}|${rn}` });

/** Measured success of K trials: 200 / K groups of K seeds. */
export const groupRate = memo((p: number, eta: number, rn: number, K: number): number => {
  const groups = Math.floor(200 / K);
  let ok = 0;
  for (let g = 0; g < groups; g++) {
    let any = false;
    for (let k = 0; k < K && !any; k++) any = rollGrid({ p, eta, rn, seed: 1000 + g * K + k }, false).outcome === 'solved';
    if (any) ok++;
  }
  return ok / groups;
}, { key: (p, eta, rn, K) => `${p}|${eta}|${rn}|${K}` });

// ------------------------------------------------------------ the model

const near = (a: number, b: number, rel: number) => Math.abs(a - b) <= Math.abs(b) * rel;

export const model: DomainModel = {
  name: 'automates locaux : labyrinthe et grille de contraintes',
  params: [
    { key: 'p', label: 'taux de mise à jour', min: 0, max: 1, value: PAPER.pFire },
    { key: 'D', label: 'nombre de pas', min: 0, max: 3000, value: MAZE.D },
  ],
  checks: [
    { name: 'le compte des paramètres retrouve les 10 000 de Maze-OOD', run: () => (near(ncaParams(PAPER.mazeC, PAPER.mazeHeads, PAPER.mazeE), PAPER.mazeParams, 0.05) ? null : `${ncaParams(PAPER.mazeC, PAPER.mazeHeads, PAPER.mazeE)}`) },
    { name: 'le compte des paramètres retrouve les 41 000 de Maze-Hard', run: () => (near(ncaParams(PAPER.mazeHardC, PAPER.mazeHeads, PAPER.mazeE), PAPER.mazeHardParams, 0.02) ? null : `${ncaParams(32, 4, 2)}`) },
    { name: 'l’élagage des essais économise 25,0 %, 53,1 % et 75,1 % (annexe B.6)', run: () => ([[2, 0.25], [4, 0.531], [8, 0.751]].every(([m, s]) => Math.abs(1 - pruneShare(m) - s) < 0.001) ? null : 'écart') },
    { name: 'synchrone (p = 1), la propagation avance d’une case par pas', run: () => { const s = spread(21, 7, 1); return s.reduce((a, b) => a + b, 0) === 15 * 15 ? null : 'le carré atteint n’a pas 15 cases de côté'; } },
    { name: 'le labyrinthe nominal (21 × 21) est résolu', run: () => { const r = rollMaze(); return r.outcome === 'solved' ? null : r.outcome; } },
    { name: 'l’élagage ne touche jamais le vrai chemin', run: () => { const r = rollMaze({ D: 2000 }); const f = r.frames[r.steps]; for (let i = 0; i < f.length; i++) if (r.maze.truth[i] && f[i] !== 1) return 'une case du chemin est morte'; return null; } },
    { name: 'la grille nominale (graine 1) est résolue', run: () => (rollGrid().outcome === 'solved' ? null : rollGrid().outcome) },
    { name: 'synchrone, la grille clignote', run: () => (rollGrid({ p: 1 }).outcome === 'blink' ? null : rollGrid({ p: 1 }).outcome) },
    {
      name: 'les âges du réservoir suivent (1 − r)^k',
      run: () => {
        // a pool of 256 states, batches of 64, a quarter replaced by fresh boards
        const R = rng(5), M = 256, B = 64, r = 0.25, age = new Array(M).fill(0);
        let older = 0, drawn = 0;
        for (let it = 0; it < 4000; it++) for (let b = 0; b < B; b++) {
          const k = Math.floor(R() * M);
          if (R() < r) age[k] = 0;
          if (it > 200) { drawn++; if (age[k] >= 3) older++; }
          age[k]++;
        }
        const want = replayOlder(r, 3);
        return Math.abs(older / drawn - want) < 0.02 ? null : `${(older / drawn).toFixed(3)} au lieu de ${want.toFixed(3)}`;
      },
    },
  ],
  rollMaze, rollGrid, mazeOf, trialsOf,
};
