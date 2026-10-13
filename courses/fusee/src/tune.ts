// Tuning the launcher: `npm run tune`. The windows below are the ones the
// experiments and the clinic cases rely on; change the model, run this again.

import { defineTune } from '@coursekit/tooling';
import { flightOf, type Flight } from './model.ts';

const short: Record<Flight['outcome'], string> = { pad: 'sol', crash: 'chute', suborbital: 'subo', orbit: 'orbite' };
const issue = (r: Flight) => (r.outcome === 'orbit' ? `orbite ${Math.round(r.peri)}` : short[r.outcome]);

export default [
  defineTune({
    title: 'Basculement (°) : issue du vol nominal (périgée en km pour une orbite)',
    grid: { kick: [0, 2, 4, 4.5, 5, 6, 7, 8, 9, 10, 12, 15] },
    run: (p) => flightOf({ kick: p.kick }),
    show: (r) => `${issue(r)} · gravité ${Math.round(r.gravityLoss)} m/s · traînée ${Math.round(r.dragLoss)} m/s`,
    expect: [
      { label: 'orbite de 5 à 8°', test: (rows) => rows.filter((x) => x.p.kick >= 5 && x.p.kick <= 8).every((x) => x.r.outcome === 'orbit') },
      { label: 'retombe à 4° et moins', test: (rows) => rows.filter((x) => x.p.kick <= 4).every((x) => x.r.outcome === 'suborbital') },
      { label: 'retombe au sol à 12° et plus (cas clinique)', test: (rows) => rows.filter((x) => x.p.kick >= 12).every((x) => x.r.outcome === 'crash') },
      { label: 'la traînée dépasse 500 m/s quelque part (expérience du bilan)', test: (rows) => rows.some((x) => x.r.dragLoss > 500) },
    ],
  }),
  defineTune({
    title: 'Charge utile (kg) × basculement (°)',
    grid: { payload: [2000, 3000, 4000, 5000, 6000], kick: [4, 5, 6, 7, 8] },
    run: (p) => flightOf(p),
    show: (r) => short[r.outcome],
    expect: [
      { label: 'charge nominale (3 t) en orbite à 6°', test: (rows) => rows.find((x) => x.p.payload === 3000 && x.p.kick === 6)?.r.outcome === 'orbit' },
      { label: '6 t ne passe à aucun angle (cas d’épreuve)', test: (rows) => rows.filter((x) => x.p.payload === 6000).every((x) => x.r.outcome !== 'orbit') },
      { label: '4 t passe à 6° (conclusion du cas d’épreuve)', test: (rows) => rows.find((x) => x.p.payload === 4000 && x.p.kick === 6)?.r.outcome === 'orbit' },
    ],
  }),
  defineTune({
    title: 'Poussée (× nominale)',
    grid: { thrust: [0.6, 0.7, 0.75, 0.9, 1, 1.1] },
    run: (p) => flightOf(p),
    show: (r) => short[r.outcome],
    expect: [{ label: 'reste au sol à 70 % (cas clinique)', test: (rows) => rows.find((x) => x.p.thrust === 0.7)?.r.outcome === 'pad' }],
  }),
];
