// The domain model of the course on the worlds of Greg Egan's « La Cité des
// permutants » (Permutation City, 1994), part two. The novel's universes are
// made of rules; this file makes small versions of them that run:
//
//   1. an elementary cellular automaton on a ring: one rule for every cell,
//      the predecessors of every configuration (Garden of Eden states), the
//      cycle every finite machine ends in (Peer's « machine finie »);
//   2. the dust: a history computed in any order, put back in order by the
//      rule alone, and what a missing frame does;
//   3. the edge of the Cosmoplexe: atoms that move by rule 184 and cannot
//      appear from nowhere, a boundary layer that obeys no law, and the heat
//      balance that made Maria choose an open boundary rather than a torus;
//   4. the TVC matrix, which grows like a crystal, against Standard Time,
//      which speeds up; the slowdown of nested simulations;
//   5. the contest of explanations: description lengths of the classical
//      theory, of the field equations and of the creators' story.
//
// The diagrams, the stages, the experiments, the exercises and the figures of
// the text all run this file. Figures quoted from the novel are in BOOK; the
// constants of the toy models are in TOY. Neither is derived from the other.

import { memo, type DomainModel } from '@coursekit/core';

/** Figures quoted from the novel (French edition), never recomputed. */
export const BOOK = {
  slowCopy: 17,            // ralentissement minimal d'une Copie sur des ordinateurs réels (ch. 12)
  slowNested: 250,         // la Copie de Durham sur la matrice TVC simulée (ch. 16)
  edge: 1000,              // processeurs par arête du cube jardin d'Éden (ch. 16)
  cellsPerProc: 60e6,      // cellules d'automate par processeur (ch. 16)
  elysianYears: 7000,      // âge de l'Élysium au réveil de Maria (ch. 23)
  lambertYears: 3e9,       // années écoulées sur la planète Lambert (ch. 23)
  species: 690e6,          // espèces vivant sur Lambert (ch. 23)
  atoms: 32,               // atomes du Cosmoplexe (ch. 23, 26)
  subunits: 3,             // sous-unités d'un neurotransmetteur lambertien (ch. 23)
  variants: 14,            // possibilités par sous-unité (ch. 23)
  transmitters: 3000,      // « près de trois mille » neurotransmetteurs (ch. 23)
  founders: 18,            // fondateurs, une pyramide chacun (ch. 24)
  pyramids: 24,            // pyramides obliques du cube (ch. 24)
  cosmoPyramids: 5,        // pyramides publiques consacrées au Cosmoplexe (ch. 26)
  codeDigits: 99,          // chiffres du code d'accès d'un fondateur (ch. 30, 32)
  peerSlow: 18,            // ralentissement 10^-18 de Peer et Kate (ch. 31)
  assembly: 8000,          // Élysiens à l'assemblée municipale (ch. 24)
  speakers: 307, forRepetto: 162, forSanderson: 140, // orateurs (ch. 24)
};

/** Constants of the toy models (choices of the course, not of the novel). */
export const TOY = {
  // the heat balance of the Cosmoplexe
  crossHours: 4,           // temps pour que la lumière traverse le volume modélisé (« quelques heures »)
  tRef: 290,               // température d'équilibre (K) : étoile nominale, frontière ouverte
  tCold: 30,               // rayonnement thermique froid qui entre par la frontière (K)
  aquaFreeze: 273, aquaBoil: 373, // fenêtre où l'aqua reste liquide (K), fixée par le modèle
  heatHours: 48,           // horizon de l'observation (h)
  // the TVC matrix
  use0: 0.3,               // part des processeurs utilisée au lancement
  horizon: 1e6,            // horizon de la croissance (générations)
  // the contest of explanations
  rulesBits: 1500,         // longueur des règles du Cosmoplexe (bits)
  fieldBits: 1836,         // longueur des équations de champ lambertiennes (bits)
  tvcBits: 2400,           // longueur des règles TVC et de l'histoire des créateurs (bits)
  // the gate
  gateLen: 32, gateSteps: 40, gateGas: 0.12, gateAt: 6,
};

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

// =================================================== 1. the automaton

export type Row = Uint8Array;
export type CellFn = (l: number, c: number, r: number, rule: number) => number;

/** The new state of a cell: the bit of the rule number indexed by the neighbourhood read in binary. */
export const cellOf: CellFn = (l, c, r, rule) => (rule >> (4 * l + 2 * c + r)) & 1;

/** One clock cycle on a ring: every cell applies the same rule to itself and its two neighbours. */
export function stepRing(row: Row, rule: number, cell: CellFn = cellOf): Row {
  const N = row.length, out = new Uint8Array(N);
  for (let i = 0; i < N; i++) out[i] = cell(row[(i + N - 1) % N], row[i], row[(i + 1) % N], rule) ? 1 : 0;
  return out;
}

/** A starting row: one live cell in the middle (seed 0), or half the cells drawn at random. */
export function initRow(N: number, seed: number): Row {
  const row = new Uint8Array(N);
  if (seed === 0) { row[Math.floor(N / 2)] = 1; return row; }
  const R = rng(seed * 977 + N);
  for (let i = 0; i < N; i++) row[i] = R() < 0.5 ? 1 : 0;
  return row;
}

/** The history of T rows, the first one included. */
export function history(rule: number, N: number, seed: number, T: number, cell: CellFn = cellOf): Row[] {
  const rows = [initRow(N, seed)];
  for (let t = 1; t < T; t++) rows.push(stepRing(rows[t - 1], rule, cell));
  return rows;
}

export const rowKey = (row: Row): string => Array.from(row).join('');
const toInt = (row: Row): number => row.reduce((s, b, i) => s | (b << i), 0);
const fromInt = (x: number, N: number): Row => { const r = new Uint8Array(N); for (let i = 0; i < N; i++) r[i] = (x >> i) & 1; return r; };

/** For every configuration of a ring of N cells, how many configurations lead to it in one cycle. */
export const preimages = memo((rule: number, N: number): Int32Array => {
  const n = 1 << N, counts = new Int32Array(n);
  for (let s = 0; s < n; s++) counts[toInt(stepRing(fromInt(s, N), rule))]++;
  return counts;
}, { key: (rule, N) => `${rule}|${N}`, max: 48 });

export interface Garden { total: number; gardens: number; share: number; reversible: boolean; maxPre: number; hist: number[] }

/** The Garden of Eden configurations of a rule: those that no configuration leads to. */
export const gardenOf = memo((rule: number, N: number): Garden => {
  const c = preimages(rule, N), total = c.length;
  let gardens = 0, maxPre = 0;
  const hist = [0, 0, 0, 0, 0];            // 0, 1, 2, 3, 4 or more predecessors
  for (const k of c) { if (k === 0) gardens++; maxPre = Math.max(maxPre, k); hist[Math.min(4, k)]++; }
  return { total, gardens, share: gardens / total, reversible: gardens === 0, maxPre, hist };
}, { key: (rule, N) => `${rule}|${N}`, max: 48 });

/** Whether a row has a predecessor under the rule (a search over every row of the same size). */
export const hasPredecessor = (row: Row, rule: number): boolean => preimages(rule, row.length)[toInt(row)] > 0;

export interface Cycle { transient: number; period: number; repeatAt: number }

/** Run until a row comes back: how long before the loop, and how long the loop is. */
export function cycleOf(row: Row, rule: number, limit = 1 << 17): Cycle {
  const seen = new Map<string, number>();
  let r = row;
  for (let t = 0; t <= limit; t++) {
    const k = rowKey(r), s = seen.get(k);
    if (s !== undefined) return { transient: s, period: t - s, repeatAt: t };
    seen.set(k, t);
    r = stepRing(r, rule);
  }
  return { transient: -1, period: -1, repeatAt: -1 };
}

export interface MachineRun { bits: number; states: number; repeatAt: number; transient: number; period: number; grows: boolean; finalBits: number; outcome: 'repeats' | 'open' }

/**
 * A finite machine: a ring of `bits` cells under rule 30, from one live cell.
 * Without growth it must come back to a row it has already had, after at most
 * 2^bits cycles. With growth, a cell is added every `every` cycles: the ring
 * never repeats within the horizon.
 */
const machineMemo = memo((bits: number, grows: boolean, horizon: number, every: number): MachineRun => {
  const states = 2 ** bits;
  if (!grows) {
    const c = cycleOf(initRow(bits, 0), 30, states + 1);
    return { bits, states, repeatAt: c.repeatAt, transient: c.transient, period: c.period, grows, finalBits: bits, outcome: 'repeats' };
  }
  const seen = new Set<string>();
  let r = initRow(bits, 0);
  for (let t = 0; t <= horizon; t++) {
    const k = rowKey(r);
    if (seen.has(k)) return { bits, states, repeatAt: t, transient: -1, period: -1, grows, finalBits: r.length, outcome: 'repeats' };
    seen.add(k);
    r = stepRing(r, 30);
    if ((t + 1) % every === 0) { const g = new Uint8Array(r.length + 1); g.set(r, 1); g[0] = 1; r = g; }
  }
  return { bits, states, repeatAt: -1, transient: -1, period: -1, grows, finalBits: r.length, outcome: 'open' };
}, { key: (b, g, h, e) => `${b}|${g}|${h}|${e}` });
export const machineOf = (bits: number, grows: boolean, horizon = 4000, every = 3): MachineRun => machineMemo(bits, grows, horizon, every);

// ======================================================== 2. the dust

/**
 * Put frames back in order using the rule alone: each frame's successor is the
 * frame equal to next(frame). The chains start at the frames that are nobody's
 * successor. Indices refer to `frames`.
 */
export function chains(frames: string[], next: (f: string) => string): number[][] {
  const at = new Map(frames.map((f, i) => [f, i] as const));
  const succ = frames.map((f) => at.get(next(f)) ?? -1);
  const hasPred = new Set(succ.filter((j) => j >= 0));
  const out: number[][] = [];
  for (let i = 0; i < frames.length; i++) {
    if (hasPred.has(i)) continue;
    const c: number[] = [];
    for (let j = i; j >= 0 && !c.includes(j); j = succ[j]) c.push(j);
    out.push(c);
  }
  return out;
}

/** The reference of the « reorder » exercise: the order of the frames, from the one that has no predecessor. */
export function reorder(frames: string[], next: (f: string) => string): number[] {
  const succ = frames.map((f) => frames.indexOf(next(f)));
  let i = 0;
  while (succ.includes(i)) i++;
  const order = [i];
  for (i = succ[i]; i !== -1; i = succ[i]) order.push(i);
  return order;
}

export interface DustRun {
  frames: Row[];          // the true history
  computed: number[];     // the order in which the processors computed the frames (indices of frames)
  kept: boolean[];        // false for a frame that was never computed
  chains: number[][];     // the history rebuilt from the kept frames (indices of frames)
  jumps: number;          // places where the rebuilt history breaks the rule
  outcome: 'intact' | 'gap';
}

/** Paul's experiment: a history cut into `slices` blocks computed in a random order, `missing` frames never computed. */
const dustMemo = memo((slices: number, missing: number, T: number, N: number, rule: number, seed: number): DustRun => {
  const frames = history(rule, N, seed, T);
  const k = Math.max(1, Math.min(T, Math.round(slices)));
  const blocks: number[][] = Array.from({ length: k }, (_, b) => {
    const a = Math.floor((b * T) / k), z = Math.floor(((b + 1) * T) / k);
    return Array.from({ length: z - a }, (_, i) => a + i);
  });
  const R = rng(17 * k + 5);
  for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; }
  const computed = blocks.flat();
  const kept = frames.map(() => true);
  for (let m = 0; m < Math.round(missing); m++) kept[Math.floor(((m + 1) * T) / (Math.round(missing) + 1))] = false;
  const idx = frames.map((_, i) => i).filter((i) => kept[i]);
  const keys = idx.map((i) => rowKey(frames[i]));
  const next = (f: string) => rowKey(stepRing(Uint8Array.from(f, Number), rule));
  const cs = chains(keys, next).map((c) => c.map((j) => idx[j]));
  cs.sort((a, b) => a[0] - b[0]);
  return { frames, computed, kept, chains: cs, jumps: cs.length - 1, outcome: cs.length === 1 ? 'intact' : 'gap' };
}, { key: (s, m, T, N, r, sd) => `${s}|${m}|${T}|${N}|${r}|${sd}` });
export const dustOf = (slices: number, missing: number, T = 24, N = 32, rule = 30, seed = 3): DustRun => dustMemo(slices, missing, T, N, rule, seed);

// ================================================= 3. the Cosmoplexe

/** Rule 184: an atom moves one cell to the right when the cell is free. The number of atoms never changes. */
export const RULE_ATOMS = 184;

export interface GateRun {
  frames: Row[]; violations: { t: number; x: number }[]; count: number[];
  injectedAt: number; enteredAt: number;
  outcome: 'none' | 'violation' | 'ignored' | 'entered';
}

/**
 * A strip of the Cosmoplexe near its edge. Cell 0 is the boundary layer: it
 * obeys no law, the interstellar gas software fills it at random. Cells 1 to
 * L − 1 obey rule 184; atoms leave at the far end. An atom is injected at
 * `inject` (−1: none): in the boundary layer it waits there until it can move
 * in; inside, the write breaks the rule, unless the rules are defended
 * (`defend`: after the Lambertians), in which case the write is ignored.
 */
const gateMemo = memo((inject: number, defend: boolean, L: number, T: number, gas: number, at: number): GateRun => {
  const R = rng(4242);
  const frames: Row[] = [new Uint8Array(L)];
  let pending = false, injectedAt = -1, enteredAt = -1, written = false;
  for (let t = 1; t < T; t++) {
    const p = frames[t - 1], r = new Uint8Array(L);
    for (let x = 1; x < L; x++) r[x] = cellOf(p[x - 1], p[x], x + 1 < L ? p[x + 1] : 0, RULE_ATOMS);
    // the injected atom leaves the boundary layer when it moves into cell 1
    if (pending && p[0] === 1 && p[1] === 0) { pending = false; enteredAt = t; }
    const g = R() < gas ? 1 : 0;
    if (inject === 0 && t === at) { pending = true; injectedAt = t; }
    r[0] = pending ? 1 : g;
    if (inject > 0 && t >= at && !written && r[inject] === 0) {
      written = true; injectedAt = t;
      if (!defend) r[inject] = 1;
    }
    frames.push(r);
  }
  const violations: { t: number; x: number }[] = [];
  for (let t = 1; t < T; t++) for (let x = 1; x < L; x++) {
    const p = frames[t - 1];
    if (frames[t][x] !== cellOf(p[x - 1], p[x], x + 1 < L ? p[x + 1] : 0, RULE_ATOMS)) violations.push({ t, x });
  }
  const count = frames.map((f) => f.reduce((s, b, i) => s + (i > 0 ? b : 0), 0));
  const outcome = inject < 0 ? 'none' : violations.length ? 'violation' : inject > 0 ? (written ? 'ignored' : 'none') : enteredAt > 0 ? 'entered' : 'none';
  return { frames, violations, count, injectedAt, enteredAt, outcome };
}, { key: (i, d, L, T, g, a) => `${i}|${d}|${L}|${T}|${g}|${a}` });
export const gateOf = (inject: number, defend: boolean, L = TOY.gateLen, T = TOY.gateSteps, gas = TOY.gateGas, at = TOY.gateAt): GateRun => gateMemo(inject, defend, L, T, gas, at);

export interface HeatRun { hours: number[]; temp: number[]; tEnd: number; tEq: number; rising: boolean; outcome: 'frozen' | 'habitable' | 'boiling' }

/**
 * The heat balance of the modelled volume. The star pours light in at the rate
 * `lum`; light that reaches the edge leaves the model with the probability
 * `absorb` (1: an open boundary; 0: a torus, the light comes round again).
 * The planet's temperature follows the light stored in the volume.
 */
const heatMemo = memo((absorb: number, lum: number, H: number): HeatRun => {
  const tau = TOY.crossHours, a = Math.max(0, absorb);
  const energy = (t: number) => (a > 1e-9 ? (lum * tau / a) * (1 - Math.exp((-a * t) / tau)) : lum * t);
  const tempOf = (e: number) => (TOY.tCold ** 4 + TOY.tRef ** 4 * (e / tau)) ** 0.25;
  const hours: number[] = [], temp: number[] = [];
  for (let t = 0; t <= H; t += 0.5) { hours.push(t); temp.push(tempOf(energy(t))); }
  const tEnd = temp[temp.length - 1];
  const tEq = a > 1e-9 ? tempOf(lum * tau / a) : Infinity;
  const rising = tEnd - tempOf(energy(H - 6)) > 2;
  const outcome = tEnd < TOY.aquaFreeze ? 'frozen' : tEnd > TOY.aquaBoil ? 'boiling' : 'habitable';
  return { hours, temp, tEnd, tEq, rising, outcome };
}, { key: (a, l, h) => `${a}|${l}|${h}` });
export const heatOf = (absorb: number, lum: number, H = TOY.heatHours): HeatRun => heatMemo(absorb, lum, H);

/** Lambert years per Elysian year: 3 billion years in 7 000. */
export const timeRatio = (): number => BOOK.lambertYears / BOOK.elysianYears;

/** Lambertian neurotransmitters: subunits chosen among variants. */
export const transmitterKinds = (): number => BOOK.variants ** BOOK.subunits;

// ===================================================== 4. the TVC matrix

/** Processors of the matrix after t generations: one layer added on every face per generation. */
export const supplyAt = (t: number): number => (BOOK.edge + 2 * t) ** 3;

/** Processors the Elysians need: a share of the start, times the speed of Standard Time, (1 + 2t/edge)^accel. */
export const demandAt = (t: number, accel: number, pop: number): number => pop * TOY.use0 * BOOK.edge ** 3 * (1 + (2 * t) / BOOK.edge) ** accel;

export interface GrowRun { t: number[]; margin: number[]; firstDeficit: number; lastDeficit: number; outcome: 'surplus' | 'early-deficit' | 'late-deficit' | 'deficit' }

/** Supply against demand up to the horizon, on a logarithmic time grid. */
export const growOf = memo((accel: number, pop: number): GrowRun => {
  const t: number[] = [], margin: number[] = [];
  let first = -1, last = -1;
  for (let k = 0; k <= 120; k++) {
    const tt = k === 0 ? 0 : 10 ** ((k / 120) * Math.log10(TOY.horizon));
    const m = supplyAt(tt) / demandAt(tt, accel, pop);
    t.push(tt); margin.push(m);
    if (m < 1) { if (first < 0) first = tt; last = tt; }
  }
  const end = margin[margin.length - 1] < 1;
  const outcome = first < 0 ? 'surplus' : first === 0 ? (end ? 'deficit' : 'early-deficit') : 'late-deficit';
  return { t, margin, firstDeficit: first, lastDeficit: last, outcome };
}, { key: (a, p) => `${a}|${p}` });

/** Total slowdown of nested simulations: the factors multiply. */
export const nestedSlowdown = (factors: number[]): number => factors.reduce((p, f) => p * f, 1);

/** The extra factor of running on a simulated TVC matrix, from the novel's two figures. */
export const tvcOverhead = (): number => BOOK.slowNested / BOOK.slowCopy;

/** Seconds of the Copy's life seen in one hour of real time. */
export const secondsPerHour = (slow: number): number => 3600 / slow;

/** How far a processor must reach to address M cells of memory spread over k dimensions. */
export const reach = (M: number, k: number): number => M ** (1 / k);

// ============================================ 5. the contest of explanations

export type Theory = 'classic' | 'field' | 'creators';
export const THEORIES: Theory[] = ['classic', 'field', 'creators'];

export interface Contest { costs: Record<Theory, number>; rejected: Record<Theory, boolean>; winner: Theory }

/**
 * Description length (bits) of each explanation of the original cloud, when
 * the abundances of the 32 atoms are measured with `bits` bits each:
 * classic: the rules of the Cosmoplexe, then the abundances as given;
 * field: the field equations, which predict the abundances;
 * creators: the classic theory plus the TVC rules and the people who ran it.
 * With the Lambertian aesthetic, a theory whose world lasts for ever is rejected.
 */
export const contestOf = memo((bits: number, aesthetic: boolean): Contest => {
  const data = BOOK.atoms * bits;
  const costs = { classic: TOY.rulesBits + data, field: TOY.fieldBits, creators: TOY.rulesBits + data + TOY.tvcBits };
  const rejected = { classic: false, field: false, creators: aesthetic };
  const ok = THEORIES.filter((k) => !rejected[k]);
  const winner = ok.reduce((b, k) => (costs[k] < costs[b] ? k : b), ok[0]);
  return { costs, rejected, winner };
}, { key: (b, a) => `${b}|${a}` });

/** Precision (bits per abundance) from which the field equations are shorter than the classic theory. */
export const crossoverBits = (): number => (TOY.fieldBits - TOY.rulesBits) / BOOK.atoms;

// ============================================================== checks

const near = (a: number, b: number, rel: number) => Math.abs(a - b) <= Math.abs(b) * rel;

export const model: DomainModel = {
  name: 'les univers de La Cité des permutants',
  checks: [
    { name: 'règle 204 (identité) : aucune configuration jardin d’Éden', run: () => (gardenOf(204, 10).gardens === 0 ? null : `${gardenOf(204, 10).gardens}`) },
    { name: 'règle 0 : toutes les configurations sauf une sont des jardins d’Éden', run: () => (gardenOf(0, 10).gardens === 1023 ? null : `${gardenOf(0, 10).gardens}`) },
    { name: 'chaque configuration a exactement une suivante (somme des antécédents = 2^N)', run: () => (preimages(30, 10).reduce((s, k) => s + k, 0) === 1024 ? null : 'somme fausse') },
    { name: 'règle 184 : le nombre d’atomes se conserve sur un anneau', run: () => { const h = history(RULE_ATOMS, 40, 7, 30); const n = (r: Row) => r.reduce((s, b) => s + b, 0); return h.every((r) => n(r) === n(h[0])) ? null : 'non conservé'; } },
    { name: 'une machine de N bits se répète en au plus 2^N cycles', run: () => ([6, 8, 10, 12].every((b) => { const m = machineOf(b, false); return m.repeatAt > 0 && m.repeatAt <= 2 ** b; }) ? null : 'dépasse 2^N') },
    { name: 'la poussière mélangée redonne l’histoire entière', run: () => (dustOf(24, 0).outcome === 'intact' ? null : dustOf(24, 0).outcome) },
    { name: 'une tranche manquante coupe l’histoire en deux', run: () => (dustOf(24, 1).chains.length === 2 ? null : `${dustOf(24, 1).chains.length}`) },
    { name: 'la référence de l’exercice retrouve l’ordre', run: () => { const h = history(30, 24, 5, 20).map(rowKey); const perm = [7, 2, 15, 0, 11, 19, 4, 9, 13, 1, 17, 6, 3, 18, 10, 14, 5, 12, 8, 16]; const order = reorder(perm.map((i) => h[i]), (f) => rowKey(stepRing(Uint8Array.from(f, Number), 30))).map((j) => perm[j]); return order.every((v, i) => v === i) ? null : 'ordre faux'; } },
    { name: 'un atome injecté dans la couche limite entre sans violer la règle', run: () => (gateOf(0, false).outcome === 'entered' ? null : gateOf(0, false).outcome) },
    { name: 'un atome écrit à l’intérieur viole la règle', run: () => (gateOf(12, false).outcome === 'violation' ? null : gateOf(12, false).outcome) },
    { name: 'étoile nominale, frontière ouverte : l’aqua est liquide', run: () => (heatOf(1, 1).outcome === 'habitable' ? null : heatOf(1, 1).outcome) },
    { name: 'univers refermé en tore : la planète bout', run: () => (heatOf(0, 1).outcome === 'boiling' && heatOf(0, 1).rising ? null : heatOf(0, 1).outcome) },
    { name: 'la matrice nominale garde un surplus de processeurs', run: () => (growOf(2, 1).outcome === 'surplus' ? null : growOf(2, 1).outcome) },
    { name: 'jardin d’Éden TVC : 10^9 processeurs', run: () => (supplyAt(0) === 1e9 ? null : `${supplyAt(0)}`) },
    { name: 'ralentissement 250 : environ 14 secondes de vie par heure', run: () => (near(secondsPerHour(BOOK.slowNested), 14.4, 0.01) ? null : `${secondsPerHour(BOOK.slowNested)}`) },
    { name: '14³ ≈ 3 000 neurotransmetteurs', run: () => (near(transmitterKinds(), BOOK.transmitters, 0.1) ? null : `${transmitterKinds()}`) },
    { name: 'mesures grossières : la théorie classique est la plus courte', run: () => (contestOf(8, true).winner === 'classic' ? null : contestOf(8, true).winner) },
    { name: 'mesures fines : les équations de champ gagnent', run: () => (contestOf(16, true).winner === 'field' ? null : contestOf(16, true).winner) },
  ],
};
