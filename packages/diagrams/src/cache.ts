// Diagrams that run a model are far too expensive to recompute every frame.
// They do what an application does: compute once, keyed by their parameters,
// then play the result back. A diagram that needs many runs (a curve of
// results) asks for them lazily — at most a few new ones per drawn frame —
// and the curve fills in over the next frames instead of freezing the page.
// Generalised from avbd's course/simcache.ts.

const cache = new Map<string, unknown>();
const MAX = 128;
let budget = 0;

/** Called by the player before each drawn frame. */
export function beginBudget(n: number): void { budget = n; }

/** The cached result for `key`, computed now if missing. */
export function cached<T>(key: string, compute: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  budget--;
  const v = compute();
  if (cache.size > MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, v);
  return v;
}

/** Same, but null instead of computing when this frame's budget is spent. */
export function cachedMaybe<T>(key: string, compute: () => T): T | null {
  if (cache.has(key)) return cache.get(key) as T;
  if (budget <= 0) return null;
  return cached(key, compute);
}
