// Tuning the toy universes: `npm run tune`. The windows below are the ones the
// experiments and the clinic cases rely on; change the model, run this again.

import { defineTune } from '@coursekit/tooling';
import { contestOf, dustOf, gardenOf, gateOf, growOf, heatOf, machineOf } from './model.ts';

const all = <P, R>(rows: { p: P; r: R }[], keep: (p: P) => boolean, ok: (r: R) => boolean) => rows.filter((x) => keep(x.p)).every((x) => ok(x.r));
const pctOf = (x: number) => `${(x * 100).toFixed(1)} %`;

export default [
  defineTune({
    title: 'Configurations jardin d’Éden : part selon la règle et la taille de l’anneau',
    grid: { rule: [0, 30, 90, 110, 184, 204, 15, 170], N: [6, 8, 10, 12] },
    run: (p) => gardenOf(p.rule, p.N),
    show: (r) => pctOf(r.share),
    expect: [
      { label: 'règles 15, 170, 204 : aucune, à toutes les tailles (réversibles)', test: (rows) => all(rows, (p) => [15, 170, 204].includes(p.rule), (r) => r.gardens === 0) },
      { label: 'règles 30, 90, 110, 184 : au moins 5 % à toutes les tailles', test: (rows) => all(rows, (p) => [30, 90, 110, 184].includes(p.rule), (r) => r.share >= 0.05) },
      { label: 'règle 0 : plus de 98 %', test: (rows) => all(rows, (p) => p.rule === 0, (r) => r.share > 0.98) },
    ],
  }),
  defineTune({
    title: 'Poussière : tranches mélangées × tranches manquantes',
    grid: { slices: [1, 2, 4, 8, 24], missing: [0, 1, 2] },
    run: (p) => dustOf(p.slices, p.missing),
    show: (r) => (r.outcome === 'intact' ? 'intacte' : `${r.chains.length} morceaux`),
    expect: [
      { label: 'aucune tranche manquante : intacte, quel que soit le mélange', test: (rows) => all(rows, (p) => p.missing === 0, (r) => r.outcome === 'intact') },
      { label: 'k tranches manquantes : k + 1 morceaux (cas d’épreuve)', test: (rows) => all(rows, (p) => p.missing > 0, (r) => r.chains.length === 1 + 1 * (r.frames.length - r.kept.filter(Boolean).length)) },
    ],
  }),
  defineTune({
    title: 'Machine finie (règle 30, une cellule vivante) : bits × croissance',
    grid: { bits: [4, 6, 8, 10, 12, 14, 16], grows: [0, 1] },
    run: (p) => machineOf(p.bits, p.grows === 1),
    show: (r) => (r.outcome === 'repeats' ? `boucle au cycle ${r.repeatAt}` : 'jamais'),
    expect: [
      { label: 'sans croissance : toujours une boucle, avant 2^N cycles', test: (rows) => all(rows, (p) => p.grows === 0, (r) => r.outcome === 'repeats' && r.repeatAt <= r.states) },
      { label: '16 bits : la boucle arrive après plus de 1 000 cycles', test: (rows) => rows.find((x) => x.p.bits === 16 && x.p.grows === 0)!.r.repeatAt > 1000 },
      { label: 'avec croissance : aucune répétition avant l’horizon', test: (rows) => all(rows, (p) => p.grows === 1, (r) => r.outcome === 'open') },
    ],
  }),
  defineTune({
    title: 'Matrice TVC : accélération du Temps standard × population',
    grid: { accel: [0, 1, 2, 2.5, 3, 3.5, 4, 5], pop: [0.5, 1, 2, 4, 6] },
    run: (p) => growOf(p.accel, p.pop),
    show: (r) => ({ surplus: 'surplus', 'early-deficit': 'manque, puis surplus', 'late-deficit': 'surplus, puis manque', deficit: 'manque' })[r.outcome],
    expect: [
      { label: 'population nominale : surplus jusqu’à 3, manque tardif à partir de 3,5', test: (rows) => all(rows, (p) => p.pop === 1 && p.accel <= 3, (r) => r.outcome === 'surplus') && all(rows, (p) => p.pop === 1 && p.accel >= 3.5, (r) => r.outcome === 'late-deficit') },
      { label: 'accélération 4 (cas clinique) : le manque arrive après des centaines de générations', test: (rows) => rows.find((x) => x.p.accel === 4 && x.p.pop === 1)!.r.firstDeficit > 500 },
      { label: 'population ×4, accélération sous 3 : manque au départ, puis surplus', test: (rows) => all(rows, (p) => p.pop >= 4 && p.accel < 3, (r) => r.outcome === 'early-deficit') },
    ],
  }),
  defineTune({
    title: 'Frontière du Cosmoplexe : position de l’injection × règles défendues',
    grid: { inject: [-1, 0, 1, 2, 5, 12, 20, 31], defend: [0, 1] },
    run: (p) => gateOf(p.inject, p.defend === 1),
    show: (r) => ({ none: 'rien', violation: 'loi violée', ignored: 'écriture ignorée', entered: 'atome entré' })[r.outcome],
    expect: [
      { label: 'dans la couche limite : l’atome entre, sans violation, dans les deux régimes', test: (rows) => all(rows, (p) => p.inject === 0, (r) => r.outcome === 'entered' && r.violations.length === 0) },
      { label: 'à l’intérieur, avant : la loi est violée', test: (rows) => all(rows, (p) => p.inject > 0 && p.defend === 0, (r) => r.outcome === 'violation') },
      { label: 'à l’intérieur, règles défendues : l’écriture est ignorée', test: (rows) => all(rows, (p) => p.inject > 0 && p.defend === 1, (r) => r.outcome === 'ignored') },
    ],
  }),
  defineTune({
    title: 'Bilan thermique : part de lumière qui sort à la frontière × luminosité de l’étoile',
    grid: { absorb: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7, 1], lum: [0.5, 0.7, 1, 1.5, 4] },
    run: (p) => heatOf(p.absorb, p.lum),
    show: (r) => `${r.tEnd.toFixed(0)} K ${({ frozen: 'gelée', habitable: 'liquide', boiling: 'bout' })[r.outcome]}${r.rising ? ' ↑' : ''}`,
    expect: [
      { label: 'étoile nominale : aqua liquide de 0,4 à 1', test: (rows) => all(rows, (p) => p.lum === 1 && p.absorb >= 0.4, (r) => r.outcome === 'habitable') },
      { label: 'étoile nominale, 0,3 et moins : la planète bout', test: (rows) => all(rows, (p) => p.lum === 1 && p.absorb <= 0.3, (r) => r.outcome === 'boiling') },
      { label: 'tore ou presque (0,2 et moins) : la température monte encore au bout de 48 h (cas clinique)', test: (rows) => all(rows, (p) => p.absorb <= 0.2, (r) => r.rising) },
      { label: 'étoile ×4, frontière ouverte : bout, mais à l’équilibre (symptôme distinct)', test: (rows) => { const r = rows.find((x) => x.p.absorb === 1 && x.p.lum === 4)!.r; return r.outcome === 'boiling' && !r.rising; } },
      { label: 'étoile ×0,5, frontière ouverte : gelée', test: (rows) => rows.find((x) => x.p.absorb === 1 && x.p.lum === 0.5)!.r.outcome === 'frozen' },
    ],
  }),
  defineTune({
    title: 'Compétition des explications : précision des abondances (bits) × esthétique lambertienne',
    grid: { bits: [2, 4, 6, 8, 10, 11, 12, 16, 20], aesthetic: [0, 1] },
    run: (p) => contestOf(p.bits, p.aesthetic === 1),
    show: (r) => ({ classic: 'classique', field: 'champ', creators: 'créateurs' })[r.winner],
    expect: [
      { label: 'jusqu’à 10 bits : la théorie classique est la plus courte', test: (rows) => all(rows, (p) => p.bits <= 10, (r) => r.winner === 'classic') },
      { label: 'à partir de 11 bits : les équations de champ', test: (rows) => all(rows, (p) => p.bits >= 11, (r) => r.winner === 'field') },
      { label: 'les créateurs ne gagnent jamais, même sans l’esthétique', test: (rows) => rows.every((x) => x.r.winner !== 'creators') },
    ],
  }),
];
