// `coursekit tune <tune.ts>`: tuning a course's model before writing the
// content. A tune file sweeps the model's parameters over a grid and prints
// what happens for each combination (one parameter: a list; two: a table),
// then checks the windows the content will rely on — « the launcher reaches
// orbit for a tilt between 5 and 8° », « below, it falls back ». The checks
// that matter for the course also go into the model's `checks`.
//
// A model that draws at random is run on several seeds (`seeds`): a window
// tuned on one lucky run does not hold. Each cell then sums up the seeds, and
// the windows are written per seed — « every seed », « at least 4 seeds out
// of 5 » — rather than on one run.

type Value = number | string | boolean;
type Params = Record<string, Value>;

export interface TuneRow<P extends Params, R> {
  p: P;
  /** the result (with `seeds`: the first seed's) */
  r: R;
  /** one result per seed, in the order of `seeds` (without seeds: [r]) */
  runs: R[];
}

/** A window written as a function of all the rows: true, or what is wrong. */
export interface TuneTest<P extends Params, R> { label: string; test(rows: TuneRow<P, R>[]): boolean | string }

/**
 * A window written per seed: on every row `where` keeps (all of them by
 * default), `ok` must hold for every seed — or for at least `atLeast`, or at
 * most `atMost`, of them. Without seeds, every row is one seed.
 */
export interface TuneSeedTest<P extends Params, R> {
  label: string;
  where?(p: P): boolean;
  ok(r: R, p: P): boolean;
  atLeast?: number;
  atMost?: number;
}

export type TuneExpect<P extends Params, R> = TuneTest<P, R> | TuneSeedTest<P, R>;

export interface TuneSpec<P extends Params, R> {
  title?: string;
  /** values to try for each parameter */
  grid: { [K in keyof P]: P[K][] };
  /** the seeds every combination runs on; without it, one run per combination, with seed 1 */
  seeds?: number[];
  /** runs the model for one combination and one seed */
  run(p: P, seed: number): R;
  /** how a result is printed (a short word for the tables); String(r) by default */
  show?(r: R, p: P): string;
  /** with seeds: how the results of one combination are summed up (by default, from `show`, see `summarize`) */
  summary?(runs: R[], p: P): string;
  /** the windows the content relies on */
  expect?: TuneExpect<P, R>[];
}

export const defineTune = <P extends Params, R>(spec: TuneSpec<P, R>): TuneSpec<P, R> => spec;

export interface TuneReport { lines: string[]; failures: string[] }

const cell = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));
const num = (s: string) => (/^[−-]?\d+([.,]\d+)?$/.test(s.trim()) ? Number(s.trim().replace('−', '-').replace(',', '.')) : NaN);

/**
 * The results of the seeds as one cell: the value when they all agree
 * (« solid »), the counts when there are few different ones (« solid ×4 ·
 * fragile ×1 »), the median and the range for numbers (« 0.42 [0.38–0.51] »),
 * else all of them.
 */
export function summarize(shown: string[]): string {
  const counts = new Map<string, number>();
  for (const s of shown) counts.set(s, (counts.get(s) ?? 0) + 1);
  if (counts.size === 1) return shown[0] ?? '';
  const xs = shown.map(num);
  if (xs.every(Number.isFinite) && counts.size > 3) {
    const s = shown.map((v, i) => ({ v, x: xs[i] })).sort((a, b) => a.x - b.x);
    return `${s[(s.length - 1) >> 1].v} [${s[0].v}–${s[s.length - 1].v}]`;
  }
  if (counts.size <= 3) return [...counts].sort((a, b) => b[1] - a[1]).map(([s, k]) => `${s} ×${k}`).join(' · ');
  return shown.join(' ');
}

const isSeedTest = <P extends Params, R>(e: TuneExpect<P, R>): e is TuneSeedTest<P, R> => 'ok' in e;

/** A per-seed window: what is wrong, or true. */
function seedTest<P extends Params, R>(e: TuneSeedTest<P, R>, rows: TuneRow<P, R>[], keys: string[]): boolean | string {
  const kept = rows.filter((x) => !e.where || e.where(x.p));
  if (!kept.length) return 'aucune combinaison retenue';
  const bad: string[] = [];
  for (const x of kept) {
    const k = x.runs.filter((r) => e.ok(r, x.p)).length, n = x.runs.length;
    const pass = e.atLeast != null || e.atMost != null ? (e.atLeast == null || k >= e.atLeast) && (e.atMost == null || k <= e.atMost) : k === n;
    if (!pass) bad.push(`${keys.map((key) => `${key} = ${x.p[key]}`).join(' · ') || 'résultat'} : ${k}/${n}`);
  }
  return bad.length ? bad.join(' ; ') : true;
}

export function runTune<P extends Params, R>(spec: TuneSpec<P, R>): TuneReport {
  const keys = Object.keys(spec.grid) as (keyof P & string)[];
  const show = spec.show ?? ((r: R) => (typeof r === 'object' ? JSON.stringify(r) : String(r)));
  const seeds = spec.seeds?.length ? spec.seeds : [1];
  // every combination, the first parameter varying slowest
  let combos: Params[] = [{}];
  for (const k of keys) combos = combos.flatMap((c) => (spec.grid[k] as Value[]).map((v) => ({ ...c, [k]: v })));
  const rows: TuneRow<P, R>[] = combos.map((p) => {
    const runs = seeds.map((s) => spec.run(p as P, s));
    return { p: p as P, r: runs[0], runs };
  });
  const showRow = (x: TuneRow<P, R>) => (spec.seeds?.length ? (spec.summary ? spec.summary(x.runs, x.p) : summarize(x.runs.map((r) => show(r, x.p)))) : show(x.r, x.p));
  const lines: string[] = [];
  if (spec.title) lines.push(spec.title);
  if (spec.seeds?.length) lines.push(`${seeds.length} graine${seeds.length > 1 ? 's' : ''} : ${seeds.join(', ')}`);
  if (lines.length) lines.push('');
  if (keys.length === 2) {
    const [a, b] = keys;
    const cols = spec.grid[b] as Value[];
    const shown = rows.map(showRow);
    const w = Math.min(18, Math.max(6, ...shown.map((s) => s.length), ...cols.map((c) => String(c).length)) + 1);
    const corner = `${a} \\ ${b}`;
    const lw = Math.max(corner.length, ...(spec.grid[a] as Value[]).map((v) => String(v).length)) + 2;
    lines.push(`${cell(corner, lw + 2)}${cols.map((c) => cell(String(c), w)).join('')}`);
    (spec.grid[a] as Value[]).forEach((av, i) => {
      lines.push(`${cell(String(av), lw + 2)}${cols.map((_, j) => cell(shown[i * cols.length + j], w)).join('')}`);
    });
  } else {
    for (const x of rows) lines.push(`${keys.map((k) => `${k} = ${x.p[k]}`).join(' · ')}  →  ${showRow(x)}`);
  }
  const failures: string[] = [];
  const failed = new Set<string>();
  for (const e of spec.expect ?? []) {
    let r: boolean | string;
    try { r = isSeedTest(e) ? seedTest(e, rows, keys) : e.test(rows); } catch (x: any) { r = `erreur : ${x?.message ?? x}`; }
    if (r !== true) { failures.push(`${e.label} : ${r === false ? 'non vérifié' : r}`); failed.add(e.label); }
  }
  if (spec.expect?.length) {
    lines.push('');
    for (const e of spec.expect) lines.push(`${failed.has(e.label) ? '✗' : '✓'} ${e.label}`);
    for (const f of failures) lines.push(`  ${f}`);
  }
  return { lines, failures };
}
