// The domain model of the rocket course: a launcher with one or two stages,
// flying over a round Earth (in a plane: two dimensions), with gravity that
// weakens with altitude, an exponential atmosphere, drag, a mass that
// decreases as the propellant burns, and a gravity turn (a small tilt at
// low speed, then the thrust follows the velocity).
//
// Integrated with semi-implicit Euler, like the rest of the course teaches.
// Diagrams, stages, experiments, exercises and the figures of the text all
// run this file: nothing in the course is drawn « by hand ».

import type { DomainModel } from '@coursekit/core';

// ------------------------------------------------------------- constants

export const G0 = 9.81;            // m/s², at the surface
export const R_EARTH = 6_371_000;  // m
export const GM = 3.986e14;        // m³/s²
export const RHO0 = 1.225;         // kg/m³, air at sea level
export const H_SCALE = 8_500;      // m, the atmosphere's scale height

/** Air density at altitude h (m). */
export const rho = (h: number): number => RHO0 * Math.exp(-Math.max(0, h) / H_SCALE);
/** Gravity at altitude h (m). */
export const gravity = (h: number): number => GM / (R_EARTH + h) ** 2;
/** Speed of a circular orbit at altitude h (m). */
export const orbitalSpeed = (h: number): number => Math.sqrt(GM / (R_EARTH + h));

// --------------------------------------------------------------- rockets

export interface Stage {
  /** empty mass (structure, engines, tanks), kg */
  dry: number;
  /** propellant mass, kg */
  fuel: number;
  /** thrust, N */
  thrust: number;
  /** exhaust velocity, m/s */
  ve: number;
}

export interface Rocket { stages: Stage[]; payload: number; cd: number; area: number }

/** The course's launcher: a fictional but realistic two-stage rocket. */
export const LAUNCHER: Rocket = {
  stages: [
    { dry: 30_000, fuel: 250_000, thrust: 4_500_000, ve: 2_800 },
    { dry: 6_000, fuel: 55_000, thrust: 900_000, ve: 3_300 },
  ],
  payload: 3_000,
  cd: 0.4,
  area: 10,
};

/** Total mass at lift-off, kg. */
export const liftoffMass = (r: Rocket): number => r.payload + r.stages.reduce((s, st) => s + st.dry + st.fuel, 0);

/** Tsiolkovsky: the speed a stage can give, Δv = ve·ln(m0/mf). */
export const tsiolkovsky = (ve: number, m0: number, mf: number): number => ve * Math.log(m0 / mf);

/** Ideal Δv of each stage (no gravity, no air), from the top stage down. */
export function stageDeltaV(r: Rocket): number[] {
  const out: number[] = [];
  let above = r.payload;
  for (let i = r.stages.length - 1; i >= 0; i--) {
    const s = r.stages[i];
    const m0 = above + s.dry + s.fuel, mf = above + s.dry;
    out.unshift(tsiolkovsky(s.ve, m0, mf));
    above = m0;
  }
  return out;
}

/** The same propellant and structure in a single stage: what staging buys. */
export function singleStage(r: Rocket): Rocket {
  const dry = r.stages.reduce((s, st) => s + st.dry, 0);
  const fuel = r.stages.reduce((s, st) => s + st.fuel, 0);
  return { ...r, stages: [{ dry, fuel, thrust: r.stages[0].thrust, ve: r.stages[0].ve }] };
}

// ---------------------------------------------------------------- flight

export interface FlightParams {
  rocket: Rocket;
  /** tilt given at low speed to start the gravity turn, degrees from vertical */
  kick: number;
  /** speed at which the tilt is given, m/s */
  kickSpeed: number;
  /** thrust multiplier (1 = nominal) */
  thrustScale: number;
  drag: boolean;
  dt: number;
  /** stop after this many seconds */
  tmax: number;
  /** the upper stage holds its altitude and pushes horizontally (else: pure gravity turn) */
  guidance: boolean;
}

export const FLIGHT: FlightParams = { rocket: LAUNCHER, kick: 6, kickSpeed: 100, thrustScale: 1, drag: true, dt: 0.1, tmax: 900, guidance: true };

export interface Sample { t: number; x: number; y: number; alt: number; speed: number; vh: number; vv: number; m: number; stage: number; burning: boolean; a: number }
export type Outcome = 'pad' | 'crash' | 'suborbital' | 'orbit';

export interface Flight {
  samples: Sample[];
  events: { t: number; kind: 'staging' | 'burnout' | 'maxq' | 'impact' | 'kick'; label: string }[];
  outcome: Outcome;
  /** apoapsis and periapsis altitudes, km, once the engines are off */
  apo: number;
  peri: number;
  /** losses, m/s */
  gravityLoss: number;
  dragLoss: number;
  /** ideal Δv of the rocket, m/s */
  idealDv: number;
  /** highest dynamic pressure ½ρv², Pa */
  maxQ: number;
  maxAlt: number;
  /** propellant left in the last stage at cut-off, kg */
  margin: number;
  /** the state when the computation stopped */
  end: { t: number; x: number; y: number; vx: number; vy: number };
}

/** Orbit of a state (r, v) around the Earth: apoapsis and periapsis altitudes, km. */
export function orbitOf(x: number, y: number, vx: number, vy: number): { apo: number; peri: number; ecc: number } {
  const r = Math.hypot(x, y), v2 = vx * vx + vy * vy;
  const energy = v2 / 2 - GM / r;
  const hmom = x * vy - y * vx;
  const a = -GM / (2 * energy);
  const e = Math.sqrt(Math.max(0, 1 + (2 * energy * hmom * hmom) / (GM * GM)));
  if (energy >= 0) return { apo: Infinity, peri: (a * (1 - e) - R_EARTH) / 1000, ecc: e };
  return { apo: (a * (1 + e) - R_EARTH) / 1000, peri: (a * (1 - e) - R_EARTH) / 1000, ecc: e };
}

/**
 * Flies the rocket. Position from the Earth's centre, the launch site at
 * (0, R). Before `kickSpeed` the thrust is vertical; then it is tilted by
 * `kick` degrees towards the east for 10 s; after that it follows the
 * velocity (gravity turn).
 */
export function fly(p: Partial<FlightParams> = {}): Flight {
  const q = { ...FLIGHT, ...p };
  const r = q.rocket;
  const stages = r.stages.map((s) => ({ ...s }));
  let k = 0;
  let x = 0, y = R_EARTH, vx = 0, vy = 0;
  const massOf = () => r.payload + stages.slice(k).reduce((s, st) => s + st.dry + st.fuel, 0);
  const samples: Sample[] = [];
  const events: Flight['events'] = [];
  let gravityLoss = 0, dragLoss = 0, maxQ = 0, maxQt = 0, maxAlt = 0;
  let kickT = -1;
  let burnout = false;
  let margin = 0;
  let outcome: Outcome = 'suborbital';
  let lifted = false;
  const n = Math.round(q.tmax / q.dt);
  for (let i = 0; i <= n; i++) {
    const t = i * q.dt;
    const rr = Math.hypot(x, y), alt = rr - R_EARTH;
    const ux = x / rr, uy = y / rr;              // local vertical
    const speed = Math.hypot(vx, vy);
    const vv = vx * ux + vy * uy;                 // vertical speed
    const vh = vx * uy - vy * ux;                 // horizontal speed (eastward)
    const m = massOf();
    const st = stages[k];
    const burning = !!st && st.fuel > 0;
    // thrust direction
    let dx = ux, dy = uy;
    if (speed >= q.kickSpeed && kickT < 0 && q.kick > 0) { kickT = t; events.push({ t, kind: 'kick', label: 'basculement' }); }
    const F = burning ? st.thrust * q.thrustScale : 0;
    if (kickT >= 0) {
      if (t - kickT < 10) {
        const a = (q.kick * Math.PI) / 180;
        dx = Math.cos(a) * ux + Math.sin(a) * uy; dy = Math.cos(a) * uy - Math.sin(a) * ux;
      } else if (k > 0 && q.guidance && F > 0) {
        // upper stage: push horizontally, tilting up just enough to hold the
        // altitude: the vertical part of the thrust cancels the weight not
        // yet balanced by the curvature (g − vh²/r) and the vertical speed
        const aV = gravity(alt) - (vh * vh) / rr - vv / 40;
        const sUp = Math.max(-0.4, Math.min(0.9, aV / (F / m)));
        const sH = Math.sqrt(1 - sUp * sUp);
        dx = sUp * ux + sH * uy; dy = sUp * uy - sH * ux;
      } else if (speed > 1) { dx = vx / speed; dy = vy / speed; }
    }
    const g = gravity(alt);
    const q_dyn = 0.5 * rho(alt) * speed * speed;
    const D = q.drag ? q_dyn * r.cd * r.area : 0;
    let ax = (F / m) * dx - g * ux, ay = (F / m) * dy - g * uy;
    if (speed > 0) { ax -= (D / m) * (vx / speed); ay -= (D / m) * (vy / speed); }
    if (i % Math.max(1, Math.round(1 / q.dt)) === 0) samples.push({ t, x, y, alt, speed, vh, vv, m, stage: k, burning, a: Math.hypot(ax, ay) });
    // on the pad: the ground holds the rocket until the thrust beats the weight
    if (!lifted) {
      if (F / m > g) lifted = true;
      else { if (!burning || t > 20) { outcome = 'pad'; break; } }
    }
    if (lifted) {
      if (burning) { gravityLoss += g * (vv / Math.max(speed, 1e-9)) * q.dt; dragLoss += (D / m) * q.dt; }
      if (q_dyn > maxQ) { maxQ = q_dyn; maxQt = t; }
      // semi-implicit Euler: velocity first, then position
      vx += ax * q.dt; vy += ay * q.dt;
      x += vx * q.dt; y += vy * q.dt;
    }
    maxAlt = Math.max(maxAlt, alt);
    // engine cut-off: the guided upper stage stops once it flies at the
    // circular speed of its altitude; the propellant left is the margin
    if (burning && q.guidance && k === stages.length - 1 && kickT >= 0 && vh >= orbitalSpeed(alt) && !burnout) {
      burnout = true; margin = st.fuel; st.fuel = 0;
      events.push({ t, kind: 'burnout', label: 'arrêt des moteurs : vitesse orbitale atteinte' });
    }
    // propellant
    if (burning && !burnout) {
      st.fuel = Math.max(0, st.fuel - (F / st.ve) * q.dt);
      if (st.fuel <= 0) {
        if (k < stages.length - 1) { events.push({ t, kind: 'staging', label: `séparation de l’étage ${k + 1}` }); k++; } else if (!burnout) { burnout = true; events.push({ t, kind: 'burnout', label: 'fin de la propulsion' }); }
      }
    }
    if (Math.hypot(x, y) < R_EARTH && lifted && t > 5) { outcome = 'crash'; events.push({ t, kind: 'impact', label: 'retour au sol' }); break; }
    // after burnout, the orbit is fixed: no need to fly it all
    if (burnout && Math.hypot(x, y) - R_EARTH > 90_000) break;
  }
  if (maxQ > 0) events.push({ t: maxQt, kind: 'maxq', label: 'pression dynamique maximale' });
  events.sort((a, b) => a.t - b.t);
  const o = orbitOf(x, y, vx, vy);
  if (outcome !== 'pad' && outcome !== 'crash') outcome = burnout && o.peri > 100 ? 'orbit' : 'suborbital';
  return {
    samples, events, outcome, apo: o.apo, peri: o.peri, gravityLoss, dragLoss, maxQ, maxAlt, margin,
    end: { t: samples.length ? samples[samples.length - 1].t + 1 : 0, x, y, vx, vy },
    idealDv: stageDeltaV(r).reduce((s, v) => s + v, 0),
  };
}

/** The coast after the engines stop: gravity only, until the ground or `tmax` seconds. */
export function coast(f: Flight, tmax = 6000, dt = 2): { x: number; y: number }[] {
  let { x, y, vx, vy } = f.end;
  const out = [{ x, y }];
  if (f.outcome === 'pad' || f.outcome === 'crash') return out;
  for (let t = 0; t < tmax; t += dt) {
    const r = Math.hypot(x, y);
    if (r < R_EARTH) break;
    const a = GM / (r * r * r);
    vx -= a * x * dt; vy -= a * y * dt;
    x += vx * dt; y += vy * dt;
    if (Math.round(t / dt) % 5 === 0) out.push({ x, y });
  }
  return out;
}

/** The rocket the course's live values describe (payload, single stage). */
export const rocketOf = (v: Record<string, number>): Rocket => {
  const base = (v.single ?? 0) > 0.5 ? singleStage(LAUNCHER) : LAUNCHER;
  return { ...base, payload: v.payload ?? LAUNCHER.payload };
};

/** The flight the live values describe, cached by its parameters. */
const flights = new Map<string, Flight>();
export function flightOf(v: Record<string, number>): Flight {
  const key = [v.payload ?? 3000, v.single ?? 0, v.kick ?? FLIGHT.kick, v.thrust ?? 1, v.drag ?? 1].join('|');
  let f = flights.get(key);
  if (!f) {
    f = fly({ rocket: rocketOf(v), kick: v.kick ?? FLIGHT.kick, thrustScale: v.thrust ?? 1, drag: (v.drag ?? 1) > 0.5 });
    if (flights.size > 64) flights.delete(flights.keys().next().value as string);
    flights.set(key, f);
  }
  return f;
}

/** Words for an outcome. */
export const OUTCOME: Record<Outcome, string> = {
  pad: 'reste sur le pas de tir',
  crash: 'retombe au sol',
  suborbital: 'vol suborbital : retombe',
  orbit: 'en orbite',
};

// ------------------------------------------------- a vertical flight (1D)

export interface Vertical { h: number; v: number; m: number }

/** One step of a vertical flight, without air: what the workshop asks to write. */
export function verticalStepRef(s: Vertical, dt: number, thrust: number, ve: number, g: number): void {
  const a = thrust / s.m - g;
  s.v += a * dt;
  s.h += s.v * dt;
  s.m -= (thrust / ve) * dt;
}

/** A vertical flight of one stage, sampled every second; `step` may be the learner's. */
export function verticalFlight(stage: Stage, payload: number, step: (s: Vertical, dt: number, thrust: number, ve: number, g: number) => void = verticalStepRef, dt = 0.1): number[] {
  const s: Vertical = { h: 0, v: 0, m: stage.dry + stage.fuel + payload };
  const mf = stage.dry + payload;
  const out: number[] = [];
  for (let i = 0; s.m > mf && i < 5000; i++) {
    if (i % Math.round(1 / dt) === 0) out.push(s.h);
    step(s, dt, stage.thrust, stage.ve, G0);
  }
  return out;
}

// ------------------------------------------------------------ the model

export const model: DomainModel = {
  name: 'lanceur à deux étages',
  params: [
    { key: 'kick', label: 'basculement', unit: '°', min: 0, max: 20, value: FLIGHT.kick },
    { key: 'thrust', label: 'poussée', unit: '× nominale', min: 0.5, max: 1.5, value: 1 },
  ],
  checks: [
    {
      name: 'Tsiolkovsky : Δv = ve·ln(m0/mf)',
      run: () => (Math.abs(tsiolkovsky(3000, Math.E * 1000, 1000) - 3000) < 1e-6 ? null : 'ln(e) ≠ 1'),
    },
    {
      name: 'la vitesse orbitale à 200 km vaut environ 7,8 km/s',
      run: () => { const v = orbitalSpeed(200_000); return Math.abs(v - 7_784) < 10 ? null : `v = ${v.toFixed(0)} m/s`; },
    },
    {
      name: 'le lanceur nominal atteint l’orbite',
      run: () => { const f = fly(); return f.outcome === 'orbit' ? null : `issue : ${f.outcome} (périgée ${f.peri.toFixed(0)} km)`; },
    },
    {
      name: 'sans air, un vol vertical monte plus haut qu’avec de l’air',
      run: () => (fly({ kick: 0, drag: false }).maxAlt > fly({ kick: 0, drag: true }).maxAlt ? null : 'l’air ne freine pas'),
    },
    {
      name: 'le vol vertical simple suit Tsiolkovsky moins les pertes par gravité',
      run: () => {
        // without air, the speed at burnout is Δv − g·t_burn (constant gravity)
        const st = LAUNCHER.stages[1], pay = 3000, dt = 0.01;
        const s: Vertical = { h: 0, v: 0, m: st.dry + st.fuel + pay };
        let t = 0;
        while (s.m > st.dry + pay) { verticalStepRef(s, dt, st.thrust, st.ve, G0); t += dt; }
        const want = tsiolkovsky(st.ve, st.dry + st.fuel + pay, st.dry + pay) - G0 * t;
        return Math.abs(s.v - want) < 5 ? null : `v = ${s.v.toFixed(0)} m/s, attendu ${want.toFixed(0)} m/s`;
      },
    },
  ],
  fly, stageDeltaV, orbitalSpeed, flightOf,
};
