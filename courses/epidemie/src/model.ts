// The domain model of the epidemic course: an SIR model of a town of
// 100 000 people. Each day, every contagious person meets a number of people;
// each contact with a susceptible person transmits the disease with some
// probability; a contagious person stays so for a number of days, then
// recovers and is immune. Vaccination moves people straight to « immune »
// before the start; measures cut the contacts from a given day on; the
// hospital has a fixed number of beds.
//
// Integrated with Euler steps of a tenth of a day, like the workshop asks to
// write. Diagrams, the stage, experiments, exercises and the figures of the
// text all run this file.

import { memo, type DomainModel } from '@coursekit/core';

// ------------------------------------------------------------- constants

/** inhabitants of the town */
export const N = 100_000;
/** contagious people on day 0 */
export const I0 = 10;
/** share of the contagious people who occupy a hospital bed */
export const HOSP = 0.02;
/** hospital beds available for the disease */
export const BEDS = 200;
/** the days the simulation covers */
export const DAYS = 365;

export interface Params {
  /** people met each day by one person */
  contacts: number;
  /** probability that one contact with a susceptible person transmits the disease */
  p: number;
  /** days during which a person is contagious */
  dur: number;
  /** share of the town vaccinated before the start (immune) */
  vax: number;
  /** share of the contacts removed by the measures (0: none) */
  cut: number;
  /** day the measures start */
  start: number;
  i0: number;
  dt: number;
  days: number;
}

export const BASE: Params = { contacts: 10, p: 0.03, dur: 8, vax: 0, cut: 0, start: 30, i0: I0, dt: 0.1, days: DAYS };

/** The town's plan: the measures the course sets before the clinic cases. */
export const PLAN = { cut: 0.5, start: 25 };

/** R0 = contacts × probability × duration: the people one case infects in a town where nobody is immune. */
export const r0 = (contacts: number, p: number, dur: number): number => contacts * p * dur;

/** Share of the town infected in the end, without measures: z = 1 − e^(−R·z) (solved by iteration). */
export function finalSize(R: number): number {
  if (R <= 1) return 0;
  let z = 0.5;
  for (let i = 0; i < 200; i++) z = 1 - Math.exp(-R * z);
  return z;
}

/** Share that must be immune for an epidemic not to start: 1 − 1/R0. */
export const herdThreshold = (R: number): number => (R <= 1 ? 0 : 1 - 1 / R);

/** Days for the number of cases to double, at the start of an epidemic. */
export const doublingTime = (R: number, dur: number): number => (R <= 1 ? Infinity : Math.LN2 / ((R - 1) / dur));

// ------------------------------------------------------------ one step

export interface SIR { S: number; I: number; R: number }

/**
 * One Euler step of the SIR model: what the workshop asks to write.
 * beta: transmissions per contagious person and per day in a fully
 * susceptible town (contacts × probability); gamma: 1 / duration.
 */
export function stepRef(s: SIR, dt: number, beta: number, gamma: number): void {
  const n = s.S + s.I + s.R;
  const infections = beta * s.I * (s.S / n) * dt;
  const recoveries = gamma * s.I * dt;
  s.S -= infections;
  s.I += infections - recoveries;
  s.R += recoveries;
}

export type StepFn = (s: SIR, dt: number, beta: number, gamma: number) => void;

// ----------------------------------------------------------- simulation

export interface Day { t: number; S: number; I: number; R: number; beds: number; reff: number; cases: number }
export type Outcome = 'fizzle' | 'contained' | 'overflow';

export interface Epidemic {
  /** one sample per day */
  days: Day[];
  outcome: Outcome;
  r0: number;
  peak: { t: number; I: number; beds: number };
  /** people infected during the year (vaccinated people excluded), and as a share of the town */
  infected: number;
  attack: number;
  /** days with more patients than beds */
  overflowDays: number;
  /** contagious people on the day the measures start */
  atStart: number;
}

export function simulate(p: Partial<Params> = {}, step: StepFn = stepRef): Epidemic {
  const q = { ...BASE, ...p };
  const vaccinated = N * q.vax;
  const s: SIR = { S: N - vaccinated - q.i0, I: q.i0, R: vaccinated };
  const gamma = 1 / q.dur;
  const days: Day[] = [];
  let peak = { t: 0, I: 0, beds: 0 };
  let overflowDays = 0, atStart = 0, prevS = s.S;
  const per = Math.round(1 / q.dt);
  const n = Math.round(q.days / q.dt);
  for (let i = 0; i <= n; i++) {
    const t = i * q.dt;
    const on = t >= q.start;
    const beta = q.contacts * (on ? 1 - q.cut : 1) * q.p;
    if (i % per === 0) {
      const beds = HOSP * s.I;
      days.push({ t: Math.round(t), S: s.S, I: s.I, R: s.R, beds, reff: (beta / gamma) * (s.S / N), cases: Math.max(0, prevS - s.S) });
      prevS = s.S;
      if (beds > BEDS) overflowDays++;
      if (Math.round(t) === Math.round(q.start)) atStart = s.I;
    }
    if (s.I > peak.I) peak = { t, I: s.I, beds: HOSP * s.I };
    if (i < n) step(s, q.dt, beta, gamma);
  }
  const infected = N - vaccinated - s.S;
  const outcome: Outcome = infected < 0.01 * N ? 'fizzle' : peak.beds > BEDS ? 'overflow' : 'contained';
  return { days, outcome, r0: r0(q.contacts, q.p, q.dur), peak, infected, attack: infected / N, overflowDays, atStart };
}

/** The parameters the course's live values describe. */
export const paramsOf = (v: Record<string, number>): Partial<Params> => ({
  contacts: v.contacts ?? BASE.contacts,
  p: v.p ?? BASE.p,
  dur: v.dur ?? BASE.dur,
  vax: v.vax ?? 0,
  cut: v.cut ?? 0,
  start: v.start ?? BASE.start,
});

/**
 * The epidemic the live values describe. The stage, the diagrams and the
 * goals of the experiments ask for it every frame: computed once per set of
 * parameters.
 */
export const epidemicOf = memo(
  (v: Record<string, number>): Epidemic => simulate(paramsOf(v)),
  { key: (v) => { const q = paramsOf(v); return [q.contacts, q.p, q.dur, q.vax, q.cut, q.start].join('|'); } },
);

/** R0 of the live values. */
export const r0Of = (v: Record<string, number>): number => r0(v.contacts ?? BASE.contacts, v.p ?? BASE.p, v.dur ?? BASE.dur);

/** Words for an outcome. */
export const OUTCOME: Record<Outcome, string> = {
  fizzle: 'pas d’épidémie',
  contained: 'épidémie, hôpital tenu',
  overflow: 'hôpital débordé',
};

/** Infections generation by generation, from one case: 1, R, R², … */
export const generations = (R: number, n: number): number[] => Array.from({ length: n }, (_, g) => R ** g);

// ------------------------------------------------------------ the model

const NOMINAL_R0 = r0(BASE.contacts, BASE.p, BASE.dur);

export const model: DomainModel = {
  name: 'modèle SIR d’une ville de 100 000 habitants',
  params: [
    { key: 'contacts', label: 'contacts par jour', min: 1, max: 20, value: BASE.contacts },
    { key: 'cut', label: 'réduction des contacts', min: 0, max: 0.9, value: 0 },
    { key: 'vax', label: 'part vaccinée', min: 0, max: 0.9, value: 0 },
  ],
  checks: [
    {
      name: 'la population reste constante : S + I + R = N',
      run: () => { const d = simulate().days.at(-1)!; const tot = d.S + d.I + d.R; return Math.abs(tot - N) < 1e-6 ? null : `S + I + R = ${tot}`; },
    },
    {
      name: 'taille finale : z = 1 − e^(−R0·z) (environ 88 % pour R0 = 2,4)',
      run: () => { const e = simulate({ i0: 1 }); const z = finalSize(NOMINAL_R0); return Math.abs(e.attack - z) < 0.01 ? null : `simulé ${e.attack.toFixed(3)}, attendu ${z.toFixed(3)}`; },
    },
    {
      name: 'pic des contagieux : 1 − (1 + ln R0)/R0 (environ 22 %)',
      run: () => { const e = simulate({ i0: 1 }); const want = 1 - (1 + Math.log(NOMINAL_R0)) / NOMINAL_R0; return Math.abs(e.peak.I / N - want) < 0.01 ? null : `simulé ${(e.peak.I / N).toFixed(3)}, attendu ${want.toFixed(3)}`; },
    },
    {
      name: 'au-dessus du seuil 1 − 1/R0, pas d’épidémie ; en dessous, une épidémie',
      run: () => {
        const h = herdThreshold(NOMINAL_R0);
        const above = simulate({ vax: h + 0.03 }).outcome, below = simulate({ vax: h - 0.08 }).outcome;
        return above === 'fizzle' && below !== 'fizzle' ? null : `vacciné à ${(h + 0.03).toFixed(2)} : ${above} ; à ${(h - 0.08).toFixed(2)} : ${below}`;
      },
    },
    {
      name: 'au début, les cas doublent en ln 2 / ((R0 − 1)/durée) jours',
      run: () => {
        const e = simulate({ i0: 1 }), T = doublingTime(NOMINAL_R0, BASE.dur);
        // between days 10 and 30, the growth is still exponential
        const measured = (20 * Math.LN2) / Math.log(e.days[30].I / e.days[10].I);
        return Math.abs(measured - T) / T < 0.1 ? null : `mesuré ${measured.toFixed(2)} j, attendu ${T.toFixed(2)} j`;
      },
    },
    {
      name: 'sans mesures, l’hôpital de la ville déborde',
      run: () => (simulate().outcome === 'overflow' ? null : `issue : ${simulate().outcome}`),
    },
  ],
  simulate, epidemicOf, finalSize, herdThreshold,
};
