// Tuning the two automata: `npm run tune`. The windows below are the ones the
// experiments and the clinic cases rely on; change the model, run this again.

import { defineTune } from '@coursekit/tooling';
import { MAZE_OUTCOME, GRID_OUTCOME, gridRate, mazeOf, replayOlder, trialsOf, type GridRun, type MazeRun } from './model.ts';

const maze = (r: MazeRun) => (r.outcome === 'solved' ? `résolu en ${r.solvedAt}` : MAZE_OUTCOME[r.outcome]);
const grid = (r: GridRun) => GRID_OUTCOME[r.outcome];
const all = <P, R>(rows: { p: P; r: R }[], keep: (p: P) => boolean, ok: (r: R) => boolean) => rows.filter((x) => keep(x.p)).every((x) => ok(x.r));

export default [
  defineTune({
    title: 'Labyrinthe 21 × 21 (graine 1) : nombre de pas D',
    grid: { D: [40, 80, 100, 120, 150, 200, 210, 300, 400] },
    run: (p) => mazeOf({ D: p.D }),
    show: maze,
    expect: [
      { label: 'exploration inachevée jusqu’à 100 pas', test: (rows) => all(rows, (p) => p.D <= 100, (r) => r.outcome === 'exploring') },
      { label: 'élagage inachevé de 120 à 200 pas', test: (rows) => all(rows, (p) => p.D >= 120 && p.D <= 200, (r) => r.outcome === 'pruning') },
      { label: 'résolu à partir de 210 pas (D nominal : 300)', test: (rows) => all(rows, (p) => p.D >= 210, (r) => r.outcome === 'solved') },
    ],
  }),
  defineTune({
    title: 'Côté du labyrinthe × nombre de pas (graine 1)',
    grid: { side: [9, 13, 21, 29, 41, 61], D: [100, 300, 1000, 2000] },
    run: (p) => mazeOf(p),
    show: (r) => (r.outcome === 'solved' ? `ok ${r.solvedAt}` : 'non'),
    expect: [
      { label: '9 × 9 et 13 × 13 résolus en 100 pas', test: (rows) => all(rows, (p) => p.side <= 13 && p.D === 100, (r) => r.outcome === 'solved') },
      { label: 'avec 300 pas : 21 × 21 résolu, 41 × 41 et 61 × 61 non', test: (rows) => all(rows, (p) => p.D === 300, (r) => r.outcome === 'solved') === false && all(rows, (p) => p.D === 300 && p.side <= 21, (r) => r.outcome === 'solved') && all(rows, (p) => p.D === 300 && p.side >= 41, (r) => r.outcome !== 'solved') },
      { label: 'avec 2 000 pas, toutes les tailles sont résolues (même règle)', test: (rows) => all(rows, (p) => p.D === 2000, (r) => r.outcome === 'solved') },
    ],
  }),
  defineTune({
    title: 'Calcul adaptatif, labyrinthe 21 × 21, 1 000 pas : taux des cellules sûres',
    grid: { plow: [0, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8] },
    run: (p) => ({ a: mazeOf({ D: 1000, adaptive: 1, plow: p.plow }), u: mazeOf({ D: 1000 }) }),
    show: ({ a, u }) => `${maze(a)} · pas ×${(a.solvedAt / u.solvedAt).toFixed(2)} · mises à jour ×${(a.work / u.work).toFixed(2)}`,
    expect: [
      { label: 'taux nul : l’élagage se fige (cas clinique)', test: (rows) => rows.find((x) => x.p.plow === 0)?.r.a.outcome === 'frozen' },
      { label: 'résolu de 0,2 à 0,8', test: (rows) => all(rows, (p) => p.plow >= 0.2, (r) => r.a.outcome === 'solved') },
      { label: 'à 0,4 : plus de pas, moins de mises à jour', test: (rows) => { const r = rows.find((x) => x.p.plow === 0.4)!.r; return r.a.solvedAt > r.u.solvedAt && r.a.work < 0.9 * r.u.work; } },
    ],
  }),
  defineTune({
    title: 'Dégâts après la solution, labyrinthe 41 × 41 : uniforme ou adaptatif',
    grid: { adaptive: [0, 1] },
    run: (p) => mazeOf({ side: 41, D: 3000, adaptive: p.adaptive, damage: 1 }),
    show: (r) => `réparé en ${r.repairSteps} pas, ${r.repairWork} mises à jour`,
    expect: [
      { label: 'les deux réparent', test: (rows) => rows.every((x) => x.r.repairSteps > 0) },
      { label: 'l’adaptatif répare avec moins de mises à jour', test: (rows) => rows[1].r.repairWork < rows[0].r.repairWork },
    ],
  }),
  defineTune({
    title: 'Grille 10 × 10 (graine 1, sans bruit) : taux de mise à jour p',
    grid: { p: [0.02, 0.03, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95, 1] },
    run: (p) => trialsOf({ p: p.p, eta: 0 }).runs[0],
    show: grid,
    expect: [
      { label: 'synchrone ou presque (0,9 et plus) : clignote', test: (rows) => all(rows, (p) => p.p >= 0.9, (r) => r.outcome === 'blink') },
      { label: 'résolue de 0,05 à 0,8', test: (rows) => all(rows, (p) => p.p >= 0.05 && p.p <= 0.8, (r) => r.outcome === 'solved') },
      { label: 'trop lente à 0,03 et moins', test: (rows) => all(rows, (p) => p.p <= 0.03, (r) => r.outcome === 'slow') },
    ],
  }),
  defineTune({
    title: 'Grille 10 × 10 (graine 3) : bruit η × durée du bruit',
    grid: { eta: [0, 0.01, 0.02, 0.05], rn: [0.25, 0.5, 0.75, 1] },
    run: (p) => trialsOf({ gseed: 3, eta: p.eta, rn: p.rn }).runs[0],
    show: grid,
    expect: [
      { label: 'sans bruit : coincée', test: (rows) => all(rows, (p) => p.eta === 0, (r) => r.outcome === 'stuck') },
      { label: 'bruit 0,02 pendant la moitié du déroulement : résolue', test: (rows) => rows.find((x) => x.p.eta === 0.02 && x.p.rn === 0.5)?.r.outcome === 'solved' },
      { label: 'bruit jamais coupé : agitée', test: (rows) => all(rows, (p) => p.eta > 0 && p.rn === 1, (r) => r.outcome === 'noisy') },
    ],
  }),
  defineTune({
    title: 'Grille : taux de réussite sur 200 graines',
    grid: { eta: [0, 0.02] },
    run: (p) => ({ rate: gridRate(0.8, p.eta, 0.5), sync: gridRate(1, p.eta, 0.5), never: gridRate(0.8, p.eta, 1) }),
    show: (r) => `p = 0,8 : ${(r.rate * 100).toFixed(1)} % · synchrone : ${(r.sync * 100).toFixed(1)} % · bruit jamais coupé : ${(r.never * 100).toFixed(1)} %`,
    expect: [
      { label: 'le bruit ajoute plus de 10 points', test: (rows) => rows[1].r.rate > rows[0].r.rate + 0.1 },
      { label: 'synchrone : aucune grille résolue', test: (rows) => rows.every((x) => x.r.sync === 0) },
      { label: 'bruit jamais coupé : moins de 10 %', test: (rows) => rows[1].r.never < 0.1 },
    ],
  }),
  defineTune({
    title: 'Essais parallèles (graine 3, sans bruit) : nombre d’essais K',
    grid: { K: [1, 2, 3, 4] },
    run: (p) => trialsOf({ gseed: 3, eta: 0, K: p.K }),
    show: (r) => `${r.solved ? 'résolue' : 'non résolue'} (essai retenu : ${r.best + 1})`,
    expect: [
      { label: 'un essai : non résolue', test: (rows) => !rows[0].r.solved },
      { label: 'deux essais ou plus : résolue', test: (rows) => rows.slice(1).every((x) => x.r.solved) },
    ],
  }),
  defineTune({
    title: 'Cas cliniques de la grille (graine 1, bruit 0,02)',
    grid: { p: [0.2, 0.5, 0.8, 1], rn: [0.25, 0.5, 0.75, 1] },
    run: (p) => trialsOf({ eta: 0.02, p: p.p, rn: p.rn }).runs[0],
    show: grid,
    expect: [
      { label: 'synchrone : clignote, quelle que soit la durée du bruit', test: (rows) => all(rows, (p) => p.p === 1 && p.rn < 1, (r) => r.outcome === 'blink') },
      { label: 'bruit jamais coupé : agitée (cas d’épreuve)', test: (rows) => all(rows, (p) => p.rn === 1, (r) => r.outcome === 'noisy') },
      { label: 'de 0,2 à 0,8, bruit coupé à temps : résolue', test: (rows) => all(rows, (p) => p.p <= 0.8 && p.rn <= 0.75, (r) => r.outcome === 'solved') },
    ],
  }),
  defineTune({
    title: 'Réservoir d’échantillons (N = 100) : part de lots neufs r',
    grid: { r: [0.05, 0.1, 0.2, 0.25, 0.3, 0.5, 1] },
    run: (p) => ({ fresh: p.r, old: replayOlder(p.r, 10) }),
    show: (x) => `neufs ${(x.fresh * 100).toFixed(0)} % · au-delà de 1 000 pas ${(x.old * 100).toFixed(1)} %`,
    expect: [
      { label: 'r = 1 : aucun état au-delà de 100 pas', test: (rows) => rows.find((x) => x.p.r === 1)?.r.old === 0 },
      { label: 'fenêtre de 0,1 à 0,25 : au moins 10 % de neufs et 5 % au-delà de 1 000 pas', test: (rows) => all(rows, (p) => p.r >= 0.1 && p.r <= 0.25, (x) => x.fresh >= 0.1 && x.old >= 0.05) && all(rows, (p) => p.r < 0.1 || p.r > 0.25, (x) => !(x.fresh >= 0.1 && x.old >= 0.05)) },
    ],
  }),
];
