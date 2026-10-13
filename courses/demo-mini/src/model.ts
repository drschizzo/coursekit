// The domain model of the toy course: an object falling with air drag
// proportional to its speed (dv/dt = −g − k·v), integrated with semi-implicit
// Euler. Diagrams, the stage, the experiment and the exercises all run it.

import type { DomainModel } from '@coursekit/core';

export interface FallParams { h0: number; g: number; k: number; dt: number; duration: number }
export interface Sample { t: number; y: number; v: number }

export const DEFAULTS: FallParams = { h0: 20, g: 9.81, k: 0, dt: 1 / 30, duration: 3 };

/** One step: velocity first, then position with the new velocity. */
export function stepRef(s: { y: number; v: number }, dt: number, g: number, k: number): void {
  s.v += dt * (-g - k * s.v);
  s.y += dt * s.v;
}

/** Runs the fall; stops at the ground. `step` may be the learner's. */
export function simulate(p: Partial<FallParams> = {}, step: (s: { y: number; v: number }, dt: number, g: number, k: number) => void = stepRef): Sample[] {
  const q = { ...DEFAULTS, ...p };
  const s = { y: q.h0, v: 0 };
  const out: Sample[] = [{ t: 0, y: s.y, v: s.v }];
  const n = Math.round(q.duration / q.dt);
  for (let i = 1; i <= n; i++) {
    step(s, q.dt, q.g, q.k);
    if (s.y <= 0) { s.y = 0; s.v = 0; }
    out.push({ t: i * q.dt, y: s.y, v: s.v });
  }
  return out;
}

/** Time to reach the ground (s), or Infinity. */
export function landingTime(p: Partial<FallParams> = {}): number {
  const r = simulate({ duration: 30, ...p });
  const hit = r.find((x) => x.y <= 0);
  return hit ? hit.t : Infinity;
}

export const model: DomainModel = {
  name: 'chute avec frottement',
  params: [
    { key: 'h0', label: 'hauteur de départ', unit: 'm', min: 1, max: 50, value: 20 },
    { key: 'k', label: 'frottement de l’air', unit: '1/s', min: 0, max: 2, value: 0 },
  ],
  checks: [
    {
      name: 'sans frottement, la chute suit h0 − ½·g·t²',
      run() {
        const r = simulate({ dt: 1 / 1000, duration: 1.5 });
        const s = r[r.length - 1];
        const exact = 20 - 0.5 * 9.81 * 1.5 * 1.5;
        return Math.abs(s.y - exact) < 0.02 ? null : `y(1,5 s) = ${s.y.toFixed(3)} m, attendu ${exact.toFixed(3)} m`;
      },
    },
    {
      name: 'avec frottement, la vitesse tend vers g/k',
      run() {
        const r = simulate({ h0: 1e4, k: 1, duration: 10, dt: 1 / 240 });
        const v = r[r.length - 1].v;
        return Math.abs(v + 9.81) < 0.01 ? null : `vitesse finale ${v.toFixed(3)} m/s, attendu −9,81 m/s`;
      },
    },
  ],
  simulate, landingTime,
};
