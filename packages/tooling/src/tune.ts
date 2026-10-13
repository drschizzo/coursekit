// `coursekit tune <tune.ts>`: tuning a course's model before writing the
// content. A tune file sweeps the model's parameters over a grid and prints
// what happens for each combination (one parameter: a list; two: a table),
// then checks the windows the content will rely on — « the launcher reaches
// orbit for a tilt between 5 and 8° », « below, it falls back ». The checks
// that matter for the course also go into the model's `checks`.

type Value = number | string | boolean;
type Params = Record<string, Value>;

export interface TuneRow<P extends Params, R> { p: P; r: R }

export interface TuneSpec<P extends Params, R> {
  title?: string;
  /** values to try for each parameter */
  grid: { [K in keyof P]: P[K][] };
  /** runs the model for one combination */
  run(p: P): R;
  /** how a result is printed (a short word for the tables); String(r) by default */
  show?(r: R, p: P): string;
  /** the windows the content relies on: true, or what is wrong */
  expect?: { label: string; test(rows: TuneRow<P, R>[]): boolean | string }[];
}

export const defineTune = <P extends Params, R>(spec: TuneSpec<P, R>): TuneSpec<P, R> => spec;

export interface TuneReport { lines: string[]; failures: string[] }

const cell = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

export function runTune<P extends Params, R>(spec: TuneSpec<P, R>): TuneReport {
  const keys = Object.keys(spec.grid) as (keyof P & string)[];
  const show = spec.show ?? ((r: R) => (typeof r === 'object' ? JSON.stringify(r) : String(r)));
  // every combination, the first parameter varying slowest
  let combos: Params[] = [{}];
  for (const k of keys) combos = combos.flatMap((c) => (spec.grid[k] as Value[]).map((v) => ({ ...c, [k]: v })));
  const rows: TuneRow<P, R>[] = combos.map((p) => ({ p: p as P, r: spec.run(p as P) }));
  const lines: string[] = [];
  if (spec.title) lines.push(spec.title, '');
  if (keys.length === 2) {
    const [a, b] = keys;
    const cols = spec.grid[b] as Value[];
    const shown = rows.map((x) => show(x.r, x.p));
    const w = Math.min(18, Math.max(6, ...shown.map((s) => s.length), ...cols.map((c) => String(c).length)) + 1);
    const corner = `${a} \\ ${b}`;
    const lw = Math.max(corner.length, ...(spec.grid[a] as Value[]).map((v) => String(v).length)) + 2;
    lines.push(`${cell(corner, lw + 2)}${cols.map((c) => cell(String(c), w)).join('')}`);
    (spec.grid[a] as Value[]).forEach((av, i) => {
      lines.push(`${cell(String(av), lw + 2)}${cols.map((_, j) => cell(shown[i * cols.length + j], w)).join('')}`);
    });
  } else {
    for (const x of rows) lines.push(`${keys.map((k) => `${k} = ${x.p[k]}`).join(' · ')}  →  ${show(x.r, x.p)}`);
  }
  const failures: string[] = [];
  for (const e of spec.expect ?? []) {
    let r: boolean | string;
    try { r = e.test(rows); } catch (x: any) { r = `erreur : ${x?.message ?? x}`; }
    if (r !== true) failures.push(`${e.label} : ${r === false ? 'non vérifié' : r}`);
  }
  if (spec.expect?.length) {
    lines.push('');
    for (const e of spec.expect) lines.push(`${failures.some((f) => f.startsWith(`${e.label} :`)) ? '✗' : '✓'} ${e.label}`);
    for (const f of failures) lines.push(`  ${f}`);
  }
  return { lines, failures };
}
