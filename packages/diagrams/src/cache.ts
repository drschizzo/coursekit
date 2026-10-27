// Diagrams that run a model are far too expensive to recompute every frame.
// They do what an application does: compute once, keyed by their parameters,
// then play the result back. A diagram that needs many runs (a curve of
// results) asks for them lazily — at most a few new ones per drawn frame —
// and the curve fills in over the next frames instead of freezing the page.
// Generalised from avbd's course/simcache.ts.
//
// Each course draws in a scope of its own (its id, given by the player with
// the frame's budget): two courses on one page never read each other's
// results, even when their keys are the same.

const MAX = 128;
const scopes = new Map<string, Map<string, unknown>>();
let cache = new Map<string, unknown>();
let budget = 0;

/** Called by the player before each drawn frame: the frame's budget of new computations, and the course's scope. */
export function beginBudget(n: number, scope = ''): void {
  budget = n;
  let c = scopes.get(scope);
  if (!c) { c = new Map(); scopes.set(scope, c); }
  cache = c;
}

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

/** Forgets a scope's results (a course unmounted). */
export function clearCache(scope = ''): void { scopes.delete(scope); }
