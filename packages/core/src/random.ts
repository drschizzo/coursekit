// Chance, reproducibly: a seeded generator, so that every run of a course's
// model gives the same figures, and the interval that says how far a rate
// measured on n trials can be from the true one. The tune files run the
// model on several seeds (`seeds` in defineTune) and the content quotes
// intervals rather than single runs.

/** A seeded random generator (mulberry32), uniform in [0, 1): the same seed, the same sequence. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wilson interval of a proportion k / n (95 % by default): what the true
 * rate can be, given the luck of n trials. Unlike p ± 1,96·√(p(1−p)/n), it
 * stays in [0, 1] and does not shrink to a point when k = 0 or k = n.
 */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
