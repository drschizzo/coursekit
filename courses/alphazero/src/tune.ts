// Tuning the three machines: `npm run tune`. The windows below are the ones the
// experiments and the clinic cases rely on; change the model, run this again.

import { defineTune } from '@coursekit/tooling';
import { checkpointAt, gdOf, mctsOf, rlOf, robotOf, trainOf, valueBest, type MctsRun, type RobotRun, type TrainRun } from './model.ts';

const all = <P, R>(rows: { p: P; r: R }[], keep: (p: P) => boolean, ok: (r: R) => boolean) => rows.filter((x) => keep(x.p)).every((x) => ok(x.r));
const mcts = (r: MctsRun) => `${r.outcome} (${r.vsPerfect.losses} défaites / ${r.vsPerfect.games})`;
const tr = (r: TrainRun) => { const c = r.checkpoints[r.checkpoints.length - 1]; return `${r.outcome} · seule ${c.netLoss.toFixed(2)} · recherche ${c.searchLoss.toFixed(2)} · ${r.distinct} parties distinctes`; };
const rob = (r: RobotRun) => `${r.outcome} · complète ${(r.final.P[4] * 100).toFixed(0)} % · entraînement ${(r.final.train * 100).toFixed(0)} % · reprise ${(r.final.x * 100).toFixed(0)} %${r.masteredAt >= 0 ? ` · maîtrisé à ${r.masteredAt}` : ''}`;

export default [
  defineTune({
    title: 'MCTS pur (c = 1,5) : simulations par coup, 40 parties contre le joueur parfait',
    grid: { sims: [1, 10, 25, 50, 100, 200, 400, 800, 1200, 1600, 3200] },
    run: (p) => mctsOf({ sims: p.sims }),
    show: mcts,
    expect: [
      { label: 'perd souvent jusqu’à 50 simulations', test: (rows) => all(rows, (p) => p.sims <= 50, (r) => r.outcome === 'weak') },
      { label: 'ne perd presque jamais à partir de 1 200 simulations', test: (rows) => all(rows, (p) => p.sims >= 1200, (r) => r.outcome === 'solid') },
      { label: 'bat presque toujours le joueur au hasard dès 100 simulations', test: (rows) => all(rows, (p) => p.sims >= 100, (r) => r.vsRandom.wins >= 36) },
    ],
  }),
  defineTune({
    title: 'MCTS pur (1 600 simulations) : constante d’exploration c',
    grid: { c: [0, 0.1, 0.5, 1.5, 5, 25, 100] },
    run: (p) => mctsOf({ sims: 1600, c: p.c }),
    show: mcts,
    expect: [
      { label: 'c = 0 : perd souvent', test: (rows) => rows.find((x) => x.p.c === 0)?.r.outcome === 'weak' },
      { label: 'c de 1,5 à 25 : ne perd presque jamais', test: (rows) => all(rows, (p) => p.c >= 1.5 && p.c <= 25, (r) => r.outcome === 'solid') },
      { label: 'c = 100 : perd de nouveau', test: (rows) => rows.find((x) => x.p.c === 100)?.r.outcome !== 'solid' },
      { label: 'c = 0,1 : perd encore', test: (rows) => rows.find((x) => x.p.c === 0.1)?.r.outcome !== 'solid' },
    ],
  }),
  defineTune({
    title: 'Auto-jeu (600 parties) : bruit d’exploration × simulations par coup',
    grid: { explore: [0, 0.25, 0.5, 0.75, 1], tsims: [16, 32, 48] },
    run: (p) => trainOf(p),
    show: (r) => (r.outcome === 'unbeatable' ? `ok (${r.distinct})` : `perd (${r.distinct})`),
    expect: [
      { label: 'nominal (bruit 0,75, 48 simulations) : ne perd plus', test: (rows) => rows.find((x) => x.p.explore === 0.75 && x.p.tsims === 48)?.r.outcome === 'unbeatable' },
      { label: 'bruit 1, 48 simulations : ne perd plus', test: (rows) => rows.find((x) => x.p.explore === 1 && x.p.tsims === 48)?.r.outcome === 'unbeatable' },
      { label: 'sans bruit : perd encore, et rejoue toujours les mêmes parties (cas clinique)', test: (rows) => all(rows, (p) => p.explore === 0, (r) => r.outcome === 'beatable' && r.distinct <= 5) },
      { label: 'avec du bruit : plus de 100 parties distinctes', test: (rows) => all(rows, (p) => p.explore >= 0.5, (r) => r.distinct > 100) },
    ],
  }),
  defineTune({
    title: 'Auto-jeu nominal : défaites contre le joueur parfait au fil des parties',
    grid: { games: [0, 20, 60, 100, 200, 300, 400, 500, 600] },
    run: (p) => checkpointAt(trainOf({}), p.games),
    show: (c) => `politique seule ${c.netLoss.toFixed(2)} · avec recherche ${c.searchLoss.toFixed(2)} · ${c.known} positions connues`,
    expect: [
      { label: 'au départ, perd souvent', test: (rows) => rows[0].r.searchLoss > 0.3 && rows[0].r.netLoss > 0.9 },
      { label: 'après 100 parties, perd encore', test: (rows) => rows.find((x) => x.p.games === 100)!.r.searchLoss > 0 },
      { label: 'à 600 parties, ne perd plus, avec ou sans recherche', test: (rows) => rows[rows.length - 1].r.searchLoss === 0 && rows[rows.length - 1].r.netLoss === 0 },
      { label: 'la recherche fait au moins aussi bien que la politique seule', test: (rows) => rows.every((x) => x.r.searchLoss <= x.r.netLoss + 1e-9) },
    ],
  }),
  defineTune({
    title: 'Robot : échantillonneur des états de départ (250 itérations, récompense binaire)',
    grid: { sampler: [0, 1, 2] },
    run: (p) => robotOf(p),
    show: rob,
    expect: [
      { label: 'uniforme : progrès trop lents', test: (rows) => rows[0].r.outcome === 'slow' },
      { label: 'guidé par le succès : maîtrisé', test: (rows) => rows[1].r.outcome === 'mastered' },
      { label: 'tâche complète seule : bloqué', test: (rows) => rows[2].r.outcome === 'stuck' && rows[2].r.final.train < 0.01 },
    ],
  }),
  defineTune({
    title: 'Robot, SGS : taux de succès visé',
    grid: { target: [0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95] },
    run: (p) => robotOf(p),
    show: rob,
    expect: [
      { label: 'maîtrisé de 0,1 à 0,5', test: (rows) => all(rows, (p) => p.target >= 0.1 && p.target <= 0.5, (r) => r.outcome === 'mastered') },
      { label: 'maîtrisé aussi à 0,05 et 0,6 (fenêtre large)', test: (rows) => all(rows, (p) => p.target === 0.05 || p.target === 0.6, (r) => r.outcome === 'mastered') },
      { label: 'trop lent à 0,02', test: (rows) => rows.find((x) => x.p.target === 0.02)?.r.outcome === 'slow' },
      { label: 'à 0,7 et plus : réussit l’entraînement, échoue la tâche complète', test: (rows) => all(rows, (p) => p.target >= 0.7, (r) => r.outcome === 'easy') },
      { label: 'à 0,95 : entraînement au-dessus de 80 %, tâche complète sous 5 % (cas clinique)', test: (rows) => { const r = rows.find((x) => x.p.target === 0.95)!.r; return r.final.train > 0.8 && r.final.P[4] < 0.05; } },
    ],
  }),
  defineTune({
    title: 'Robot, SGS : poids de la récompense dense',
    grid: { w: [0, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1] },
    run: (p) => robotOf(p),
    show: rob,
    expect: [
      { label: 'récompense binaire (0) : maîtrisé, la pièce est reprise', test: (rows) => rows[0].r.outcome === 'mastered' && rows[0].r.final.x > 0.9 },
      { label: 'à 0,6 et plus : plafonne, ne reprend jamais la pièce (cas d’épreuve)', test: (rows) => all(rows, (p) => p.w >= 0.6, (r) => r.outcome === 'capped' && r.final.x < 0.1) },
      { label: 'un peu de récompense dense (0,05) accélère le début', test: (rows) => robotAt100(rows[1].r) > robotAt100(rows[0].r) },
    ],
  }),
  defineTune({
    title: 'Descente de gradient (30 pas) : taux d’apprentissage η',
    grid: { eta: [0.005, 0.01, 0.03, 0.05, 0.1, 0.2, 0.3, 0.5, 0.6, 0.65, 0.7, 0.8, 1] },
    run: (p) => gdOf(p),
    show: (r) => { const e = r.path[r.path.length - 1]; return `${r.outcome} · erreur ${e.L.toPrecision(3)} (minimum ${valueBest().L.toFixed(3)}) · a ${e.a.toPrecision(3)} b ${e.b.toPrecision(3)}`; },
    expect: [
      { label: 'trop lent jusqu’à 0,03', test: (rows) => all(rows, (p) => p.eta <= 0.03, (r) => r.outcome === 'slow') },
      { label: 'atteint le minimum de 0,1 à 0,65', test: (rows) => all(rows, (p) => p.eta >= 0.1 && p.eta <= 0.65, (r) => r.outcome === 'converged') },
      { label: 'diverge à partir de 0,7', test: (rows) => all(rows, (p) => p.eta >= 0.7, (r) => r.outcome === 'diverged') },
    ],
  }),
  defineTune({
    title: 'REINFORCE, 8 essais de 3 200 épisodes : pas × taille du lot',
    grid: { lr: [1, 4, 16, 64, 256], batch: [4, 16, 64] },
    run: (p) => rlOf(p),
    show: (r) => `${r.outcome} ${r.finals.filter((f) => f < 1e-6).length}/${r.finals.filter((f) => f >= 0.9).length}`,
    expect: [
      { label: 'nominal (pas 16, lot de 16) : stable', test: (rows) => rows.find((x) => x.p.lr === 16 && x.p.batch === 16)?.r.outcome === 'stable' },
      { label: 'pas 1 avec des lots de 16 ou 64 : trop lent', test: (rows) => all(rows, (p) => p.lr === 1 && p.batch >= 16, (r) => r.outcome === 'slow') },
      { label: 'pas 256 avec des lots de 4 : au moins un essai s’effondre', test: (rows) => rows.find((x) => x.p.lr === 256 && x.p.batch === 4)?.r.outcome === 'collapse' },
      { label: 'aucun effondrement jusqu’au pas 64', test: (rows) => all(rows, (p) => p.lr <= 64, (r) => r.outcome !== 'collapse') },
    ],
  }),
];

function robotAt100(r: RobotRun): number { return r.hist[100].P[4]; }
