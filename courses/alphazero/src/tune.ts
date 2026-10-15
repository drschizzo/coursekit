// Tuning the machines: `npm run tune`. The windows below are the ones the
// experiments and the clinic cases rely on; they must hold for every seed
// listed, not for one lucky run. Change the model, run this again.

import { defineTune } from '@coursekit/tooling';
import {
  TRAIN_SEEDS, checkpointAt, gdOf, gradVariance, mctsOf, robotSeeds, train, valueBest, type MctsRun, type RobotSeeds, type TrainRun,
} from './model.ts';

const all = <P, R>(rows: { p: P; r: R }[], keep: (p: P) => boolean, ok: (r: R) => boolean) => rows.filter((x) => keep(x.p)).every((x) => ok(x.r));
const mcts = (r: MctsRun) => `${r.outcome} (${r.vsPerfect.losses}/${r.vsPerfect.games}, IC ${(r.ci[0] * 100).toFixed(0)}–${(r.ci[1] * 100).toFixed(0)} %)`;
const seeds = (r: RobotSeeds) => `${r.outcome} ${JSON.stringify(r.counts)} · ${r.runs.map((x) => `${(x.final.P[4] * 100).toFixed(0)}%${x.masteredAt >= 0 ? `@${x.masteredAt}` : ''}`).join(' ')}`;
const trainRuns = new Map<string, TrainRun[]>();
const trainAll = (noise: number, temp: number) => {
  const k = `${noise}|${temp}`;
  if (!trainRuns.has(k)) trainRuns.set(k, TRAIN_SEEDS.map((seed) => train({ noise, temp, seed })));
  return trainRuns.get(k)!;
};
const good = (rs: TrainRun[]) => rs.filter((r) => r.outcome === 'unbeatable').length;

export default [
  defineTune({
    title: 'MCTS pur (c = 5) : simulations par coup, 100 parties contre le joueur parfait',
    grid: { sims: [1, 10, 25, 50, 100, 200, 400, 800, 1200, 1600, 3200] },
    run: (p) => mctsOf({ sims: p.sims, c: 5 }),
    show: mcts,
    expect: [
      { label: 'perd souvent jusqu’à 50 simulations', test: (rows) => all(rows, (p) => p.sims <= 50, (r) => r.outcome === 'weak') },
      { label: 'perd au plus 1 partie sur 100 à 1 600 et 3 200 simulations', test: (rows) => all(rows, (p) => p.sims >= 1600, (r) => r.outcome === 'solid') },
      { label: 'entre les deux, ni l’un ni l’autre de façon sûre (400 et 800)', test: (rows) => all(rows, (p) => p.sims === 400 || p.sims === 800, (r) => r.outcome === 'fragile') },
    ],
  }),
  defineTune({
    title: 'MCTS pur (1 600 simulations) : constante d’exploration c',
    grid: { c: [0, 0.1, 0.5, 1.5, 3, 5, 10, 25, 50, 100] },
    run: (p) => mctsOf({ sims: 1600, c: p.c }),
    show: mcts,
    expect: [
      { label: 'c = 0 : perd souvent', test: (rows) => rows.find((x) => x.p.c === 0)?.r.outcome === 'weak' },
      { label: 'c de 3 à 10 : au plus 1 partie sur 100 (confirmé par OpenSpiel, règle AlphaZero)', test: (rows) => all(rows, (p) => p.c >= 3 && p.c <= 10, (r) => r.outcome === 'solid') },
      { label: 'c = 0,1 et c = 100 : perd encore', test: (rows) => all(rows, (p) => p.c === 0.1 || p.c === 100, (r) => r.outcome !== 'solid') },
    ],
  }),
  defineTune({
    title: `Auto-jeu avec réseau (600 parties, ${TRAIN_SEEDS.length} graines) : bruit à la racine × coups tirés`,
    grid: { noise: [0, 0.5], temp: [0, 2, 9] },
    run: (p) => trainAll(p.noise, p.temp),
    show: (rs) => `${good(rs)}/${rs.length} sous 5 % · recherche ${rs.map((r) => r.checkpoints[r.checkpoints.length - 1].searchLoss.toFixed(2)).join(' ')} · parties distinctes ${rs.map((r) => r.distinct).join(' ')}`,
    expect: [
      { label: 'nominal (bruit 0,5, 9 coups tirés) : au moins 4 graines sur 5 sous 5 % de défaites', test: (rows) => good(rows.find((x) => x.p.noise === 0.5 && x.p.temp === 9)!.r) >= 4 },
      { label: 'sans tirage des coups : aucune graine sous 5 % (cas clinique)', test: (rows) => all(rows, (p) => p.temp === 0, (rs) => good(rs) === 0) },
      { label: 'sans tirage des coups : au plus 55 % des parties distinctes du nominal, chaque graine', test: (rows) => { const nom = rows.find((x) => x.p.noise === 0.5 && x.p.temp === 9)!.r; const z = rows.find((x) => x.p.noise === 0.5 && x.p.temp === 0)!.r; return z.every((r, i) => r.distinct < nom[i].distinct * 0.55); } },
      { label: 'sans bruit à la racine : au plus 2 graines sur 5', test: (rows) => good(rows.find((x) => x.p.noise === 0 && x.p.temp === 9)!.r) <= 2 },
    ],
  }),
  defineTune({
    title: 'Auto-jeu nominal : politique seule et politique + recherche, sur 5 graines',
    grid: { seed: TRAIN_SEEDS },
    run: (p) => trainAll(0.5, 9)[p.seed - 1],
    show: (r) => { const c = r.checkpoints[r.checkpoints.length - 1]; return `bons coups : politique ${(c.netAcc * 100).toFixed(0)} %, recherche ${(c.searchAcc * 100).toFixed(0)} % · jamais vues ${(c.netUnseen * 100).toFixed(0)} % (hasard ${(r.unseenBase * 100).toFixed(0)} %) · défaites ${c.netLoss.toFixed(2)} / ${c.searchLoss.toFixed(2)}`; },
    expect: [
      { label: 'la recherche choisit plus souvent un bon coup que la politique seule (chaque graine)', test: (rows) => rows.every((x) => { const c = x.r.checkpoints[x.r.checkpoints.length - 1]; return c.searchAcc > c.netAcc + 0.15; }) },
      { label: 'sur les positions jamais vues, la politique fait mieux que le hasard (chaque graine)', test: (rows) => rows.every((x) => x.r.checkpoints[x.r.checkpoints.length - 1].netUnseen > x.r.unseenBase + 0.04) },
      { label: 'à la fin, la recherche perd moins qu’au départ (chaque graine)', test: (rows) => rows.every((x) => checkpointAt(x.r, 1e9).searchLoss < x.r.checkpoints[0].searchLoss) },
      { label: 'la politique seule perd encore plus de 30 % des parties (chaque graine)', test: (rows) => rows.every((x) => checkpointAt(x.r, 1e9).netLoss > 0.3) },
    ],
  }),
  defineTune({
    title: 'Descente de gradient (30 pas) : taux d’apprentissage η',
    grid: { eta: [0.005, 0.01, 0.03, 0.05, 0.1, 0.2, 0.3, 0.5, 0.6, 0.65, 0.7, 0.8, 1] },
    run: (p) => gdOf(p),
    show: (r) => { const e = r.path[r.path.length - 1]; return `${r.outcome} · erreur ${e.L.toPrecision(3)} (minimum ${valueBest().L.toFixed(3)})`; },
    expect: [
      { label: 'trop lent jusqu’à 0,03', test: (rows) => all(rows, (p) => p.eta <= 0.03, (r) => r.outcome === 'slow') },
      { label: 'atteint le minimum de 0,1 à 0,65', test: (rows) => all(rows, (p) => p.eta >= 0.1 && p.eta <= 0.65, (r) => r.outcome === 'converged') },
      { label: 'diverge à partir de 0,7', test: (rows) => all(rows, (p) => p.eta >= 0.7, (r) => r.outcome === 'diverged') },
    ],
  }),
  defineTune({
    title: 'Robot (4 graines) : tirage des configurations',
    grid: { sampler: [0, 1, 2] },
    run: (p) => robotSeeds(p),
    show: seeds,
    expect: [
      { label: 'uniforme : trop lent', test: (rows) => rows[0].r.outcome === 'slow' },
      { label: 'SGS : maîtrisé, chaque graine', test: (rows) => rows[1].r.counts.mastered === 4 },
      { label: 'tâche complète seule : bloqué, chaque graine', test: (rows) => rows[2].r.counts.stuck === 4 },
    ],
  }),
  defineTune({
    title: 'Robot, SGS (4 graines) : cible t',
    grid: { target: [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95] },
    run: (p) => robotSeeds(p),
    show: seeds,
    expect: [
      { label: 'maîtrisé (chaque graine) de 0,1 à 0,5 : peu sensible aux cibles basses, comme l’écrit l’article', test: (rows) => all(rows, (p) => p.target >= 0.1 && p.target <= 0.5, (r) => r.counts.mastered === 4) },
      { label: 'pas maîtrisé à 0,7 et plus', test: (rows) => all(rows, (p) => p.target >= 0.7, (r) => r.outcome !== 'mastered') },
      { label: 'à 0,9 et plus : réussit l’entraînement, échoue la tâche (cas clinique à 0,95), chaque graine', test: (rows) => all(rows, (p) => p.target >= 0.9, (r) => r.counts.easy === 4) },
    ],
  }),
  defineTune({
    title: 'Robot, récompense (4 graines) : naïve ou par potentiel × poids',
    grid: { reward: [1, 2], w: [0, 1, 2, 3, 4, 6] },
    run: (p) => robotSeeds(p),
    show: (r) => `${r.outcome} ${JSON.stringify(r.counts)}`,
    expect: [
      { label: 'naïve, poids 3 et plus : plafonne, chaque graine (cas d’épreuve à 4)', test: (rows) => all(rows, (p) => p.reward === 1 && p.w >= 3, (r) => r.counts.capped === 4) },
      { label: 'naïve, poids 1 : maîtrisé', test: (rows) => rows.find((x) => x.p.reward === 1 && x.p.w === 1)?.r.outcome === 'mastered' },
      { label: 'par potentiel : jamais de plafond, quel que soit le poids (Ng et al., 1999)', test: (rows) => all(rows, (p) => p.reward === 2, (r) => !r.counts.capped) },
    ],
  }),
  defineTune({
    title: 'Robot (8 graines, tirage uniforme) : pas × lot × base de référence',
    grid: { lr: [16, 64, 256], batch: [4, 16], baseline: [0, 1] },
    run: (p) => robotSeeds({ ...p, sampler: 0, nseeds: 8 }),
    show: (r) => `${8 - (r.counts.mastered ?? 0)}/8 plafonnent`,
    expect: [
      { label: 'pas 16 : aucune graine ne plafonne', test: (rows) => all(rows, (p) => p.lr === 16, (r) => r.counts.mastered === 8) },
      { label: 'pas 256, lots de 4 : au moins 2 graines sur 8 plafonnent, avec ou sans base', test: (rows) => all(rows, (p) => p.lr === 256 && p.batch === 4, (r) => 8 - (r.counts.mastered ?? 0) >= 2) },
      { label: 'pas 64, lots de 4 : la base de référence évite le plafond', test: (rows) => rows.find((x) => x.p.lr === 64 && x.p.batch === 4 && x.p.baseline === 0)!.r.counts.mastered! <= 6 && rows.find((x) => x.p.lr === 64 && x.p.batch === 4 && x.p.baseline === 1)!.r.counts.mastered === 8 },
    ],
  }),
  defineTune({
    title: 'Variance du gradient, à la politique de départ (20 000 épisodes)',
    grid: { k: [0] },
    run: () => gradVariance(),
    show: (v) => `sans base ${v.plain.toFixed(4)} · avec base ${v.baseline.toFixed(4)} · potentiel ${v.ws.map((w, i) => `w=${w}: ${v.shaped[i].toFixed(4)}`).join(', ')}`,
    expect: [
      { label: 'la base de référence réduit la variance d’au moins 15 %', test: (rows) => rows[0].r.baseline < 0.85 * rows[0].r.plain },
      { label: 'le façonnage par potentiel, bien dosé (w = 0,5), la réduit aussi', test: (rows) => rows[0].r.shaped[1] < rows[0].r.plain },
      { label: 'la réduction dépend du poids : w = 0,5 fait mieux que w = 1', test: (rows) => rows[0].r.shaped[1] < rows[0].r.shaped[2] },
    ],
  }),
];
