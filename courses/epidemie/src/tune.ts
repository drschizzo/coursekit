// Tuning the town's epidemic: `npm run tune`. The windows below are the ones
// the experiments and the clinic cases rely on; change the model, run this again.

import { defineTune } from '@coursekit/tooling';
import { PLAN, epidemicOf, type Epidemic } from './model.ts';

const short: Record<Epidemic['outcome'], string> = { fizzle: 'rien', contained: 'tenu', overflow: 'déborde' };
const issue = (r: Epidemic) => `${short[r.outcome]} · pic j${Math.round(r.peak.t)}, ${Math.round(r.peak.beds)} lits · ${Math.round(r.attack * 100)} % infectés`;

export default [
  defineTune({
    title: 'Contacts par jour (R0 = contacts × 0,03 × 8) : issue sans mesures',
    grid: { contacts: [2, 3, 4, 5, 6, 8, 10, 12, 15, 20] },
    run: (p) => epidemicOf(p),
    show: (r) => `R0 ${r.r0.toFixed(2)} · ${issue(r)}`,
    expect: [
      { label: 'pas d’épidémie à 4 contacts et moins (R0 < 1)', test: (rows) => rows.filter((x) => x.p.contacts <= 4).every((x) => x.r.outcome === 'fizzle') },
      { label: 'à 5 contacts, une épidémie qui épargne plus de la moitié de la ville', test: (rows) => rows.filter((x) => x.p.contacts === 5).every((x) => x.r.outcome !== 'fizzle' && x.r.attack < 0.5) },
      { label: 'à 15 contacts et plus, plus de 95 % infectés, jamais 100 %', test: (rows) => rows.filter((x) => x.p.contacts >= 15).every((x) => x.r.attack > 0.95 && x.r.attack < 1) },
      { label: 'nominal (10 contacts) : l’hôpital déborde', test: (rows) => rows.find((x) => x.p.contacts === 10)?.r.outcome === 'overflow' },
    ],
  }),
  defineTune({
    title: 'Part vaccinée × contacts par jour',
    grid: { vax: [0, 0.3, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8], contacts: [10, 15] },
    run: (p) => epidemicOf(p),
    show: (r) => short[r.outcome],
    expect: [
      { label: '10 contacts : pas d’épidémie dès 60 % vaccinés, une épidémie à 55 %', test: (rows) => rows.filter((x) => x.p.contacts === 10 && x.p.vax >= 0.6).every((x) => x.r.outcome === 'fizzle') && rows.find((x) => x.p.contacts === 10 && x.p.vax === 0.55)?.r.outcome !== 'fizzle' },
      { label: '15 contacts : 60 et 70 % ne suffisent plus, 75 % suffit', test: (rows) => rows.filter((x) => x.p.contacts === 15 && (x.p.vax === 0.6 || x.p.vax === 0.7)).every((x) => x.r.outcome !== 'fizzle') && rows.find((x) => x.p.contacts === 15 && x.p.vax === 0.75)?.r.outcome === 'fizzle' },
    ],
  }),
  defineTune({
    title: 'Réduction des contacts × jour de début des mesures',
    grid: { cut: [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7], start: [10, 20, 25, 30, 35, 40, 45, 50, 70] },
    run: (p) => epidemicOf(p),
    show: (r) => short[r.outcome],
    expect: [
      { label: 'le plan de la ville (50 % au jour 25) tient l’hôpital', test: (rows) => rows.find((x) => x.p.cut === 0.5 && x.p.start === 25)?.r.outcome === 'contained' },
      { label: 'de 40 à 70 % de réduction, mesures au jour 25 : l’hôpital tient', test: (rows) => rows.filter((x) => x.p.start === 25 && x.p.cut >= 0.4).every((x) => x.r.outcome === 'contained') },
      { label: 'à partir du jour 45, même 70 % ne suffisent plus', test: (rows) => rows.filter((x) => x.p.start >= 45).every((x) => x.r.outcome === 'overflow') },
      { label: '20 % de réduction ne suffit jamais', test: (rows) => rows.filter((x) => x.p.cut <= 0.2).every((x) => x.r.outcome === 'overflow') },
    ],
  }),
  defineTune({
    title: 'Cas cliniques : un seul réglage en défaut par rapport au plan',
    grid: { k: [0, 1, 2, 3] },
    run: (p) => epidemicOf([PLAN, { ...PLAN, start: 50 }, { ...PLAN, cut: 0.2 }, { ...PLAN, p: 0.045 }][p.k]),
    show: (r) => `${issue(r)} · ${Math.round(r.atStart)} contagieux au début des mesures`,
    expect: [
      { label: 'plan : l’hôpital tient', test: (rows) => rows[0].r.outcome === 'contained' },
      { label: 'mesures au jour 50 : débordement, pic le jour même des mesures', test: (rows) => rows[1].r.outcome === 'overflow' && Math.abs(rows[1].r.peak.t - 50) < 2 },
      { label: 'réduction de 20 % : débordement, pic plus d’un mois après les mesures', test: (rows) => rows[2].r.outcome === 'overflow' && rows[2].r.peak.t > 25 + 30 },
      { label: 'transmission 0,045 : débordement, plus de 15 000 contagieux dès le jour 25', test: (rows) => rows[3].r.outcome === 'overflow' && rows[3].r.atStart > 15_000 },
      { label: 'correction de l’épreuve : à 0,03 ou moins, l’hôpital tient', test: () => [0.02, 0.025, 0.03].every((p) => epidemicOf({ ...PLAN, p }).outcome !== 'overflow') },
      { label: 'épreuve : avancer les mesures au jour 10 ne suffit pas', test: () => epidemicOf({ ...PLAN, p: 0.045, start: 10 }).outcome === 'overflow' },
    ],
  }),
];
