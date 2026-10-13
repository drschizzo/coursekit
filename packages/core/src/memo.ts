// Memoisation for a course's model. A simulation is often shared by the
// stage, several diagrams and the goals of an experiment, all evaluated every
// frame with the same values: compute it once per set of parameters.
//
// Use `memo` in the model, for a full computation the stage and the diagrams
// share (a flight, a run of the engine). Use `cached` / `cachedMaybe` from
// @coursekit/diagrams for what a single diagram draws, especially a curve
// that needs many runs: those spread the work over several frames.

/**
 * A memoised version of `fn`. The key is built from the arguments (JSON by
 * default); the oldest results are dropped beyond `max`.
 */
export function memo<A extends unknown[], R>(fn: (...args: A) => R, opts: { key?: (...args: A) => string; max?: number } = {}): ((...args: A) => R) & { clear(): void } {
  const cache = new Map<string, R>();
  const max = opts.max ?? 64;
  const keyOf = opts.key ?? ((...a: A) => JSON.stringify(a));
  const f = (...args: A): R => {
    const k = keyOf(...args);
    if (cache.has(k)) return cache.get(k)!;
    const r = fn(...args);
    if (cache.size >= max) cache.delete(cache.keys().next().value as string);
    cache.set(k, r);
    return r;
  };
  return Object.assign(f, { clear: () => cache.clear() });
}
