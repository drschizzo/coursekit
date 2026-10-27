// AlphaGo, AlphaZero et AlphaNIST : how a program learns, alone, to play
// better than champions, and how the same idea teaches a robot to assemble
// parts. Four miniatures, all run by ./model.ts: tic-tac-toe searched by
// minimax and Monte-Carlo tree search (checked against OpenSpiel), a small
// network trained by gradient descent, an AlphaZero loop of self-play, and a
// robot trained by REINFORCE on twenty configurations. Five ideas come back in
// every module: search improves what one knows; explore or exploit; an
// estimate is biased or noisy; generalise; assign the credit.
//
// Writing rules this course follows (see the generate_course skill): a hard
// idea gets several steps, a worked example and its own diagram, an easy one
// a single step; a question is never answered by what is on screen when it
// opens (the diagram, the scene, the step above it); each scene shows what
// its chapter explains; a picture never shows a notion before the text.

import { choice, dec, defineCourse, fr, numeric, pct, type Capsule } from '@coursekit/core';
import { CC } from '@coursekit/diagrams';
import { pickCapsules } from '@coursekit/toolbox';
import { choiceQ, type Exercise, type WorkshopConfig } from '@coursekit/exercises';
import { CELL, DIAGRAMS, pow10 } from './diagrams.ts';
import {
  EMPTY, FACTS, FORK, MAIN, MATCH_GAMES, MCTS_NOMINAL, ROBOT, STEPS, TRAIN, TRAIN_SEEDS, VARIANTS, allPositions, answerMeans, bestMoves,
  checkpointAt, countTree, detourOf, gdOf, gradVariance, legal, mctsOf, minimax, model, play, playoutCounts, playoutRun, robotSeeds,
  rolloutEval, scoreRef, search, sgsWeight, chainSuccess, successByLevel, trainOf, treeLog10, valueBest, valueData, valueSplit, wilson, GD,
  type BackupFn, type ScoreFn,
} from './model.ts';
import { OPENSPIEL } from './openspiel.ts';

const near = (a: number, b: number, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel;
/** A percentage with one decimal. */
const pct1 = (x: number) => `${fr(x * 100, 1)} %`;

const T = countTree();
const CORNER = 2, EDGE = 1;
const MEAN = (m: number) => playoutRun(FORK, m, 2000)[1999];
const GO = treeLog10(FACTS.goBranching, FACTS.goDepth);
const CHESS = treeLog10(FACTS.chessBranching, FACTS.chessDepth);
/** A value computed on first use: the costly runs of the model wait until a text quotes them, not the loading of the page. */
const lazy = <V>(f: () => V) => { let v: V | undefined; return () => (v ??= f()); };
const M10 = lazy(() => mctsOf({ sims: 10 }));
const MNOM = lazy(() => mctsOf({}));
/** An example of noise: 10 losses in 100 games. */
const CI10 = wilson(10, MATCH_GAMES);
const LAST = lazy(() => { const run = trainOf({}); return run.checkpoints[run.checkpoints.length - 1]; });
const Q0_FULL = (1 / (1 + Math.exp(VARIANTS[MAIN].d) * (1 - ROBOT.q0) / ROBOT.q0)) ** STEPS.length;
const VBEST = valueBest();
const NDATA = valueData().length;
const GD_NOM = gdOf({});
/** One step of gradient descent on L(w) = (w − 3)², from w = 1. */
const W1 = 1, SLOPE1 = 2 * (W1 - 3);
const VAR = lazy(gradVariance);
const R_NOM = robotSeeds({}), R_UNI = robotSeeds({ sampler: 0 });
/** Generalisation with the small value network: half of the positions to learn from, the other half to test. */
const VS = valueSplit();
/** The detour, worked out for a weight w = 4 of the intermediate reward. */
const DET_W = 4, DET = detourOf(DET_W);
/** The success each sub-step needs for the whole task to succeed half of the time. */
const FIFTH = 0.5 ** (1 / STEPS.length);
/** The seeds the search is checked on. */
const QSEEDS = [1, 2, 3, 4, 5];
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2; };
const masteredAt = (rs: typeof R_NOM) => median(rs.runs.map((r) => (r.masteredAt >= 0 ? r.masteredAt : ROBOT.episodes)));

// ------------------------------------------------------------- toolbox

const CAPSULES: Capsule[] = [
  {
    id: 'O1', title: 'Puissances de dix',
    goal: 'Écrire un très grand nombre comme une puissance de dix et comparer deux tels nombres.',
    used: 'La taille des arbres de jeu : b puissance d.',
    steps: [
      { title: 'Compter les zéros', diagram: 'explosion', text: '10³ = 1 000 et 10⁶ = 1 000 000 : l’exposant compte les zéros. Un nombre de 124 chiffres s’écrit à peu près 10¹²³. Comparer deux puissances de dix revient à comparer leurs exposants.' },
      { title: 'Multiplier, c’est ajouter les exposants', text: '10³ × 10⁴ = 10⁷. Un nombre 10¹²⁰ fois plus grand qu’un autre a donc un exposant plus grand de 120. Les barres du schéma ont la longueur de l’exposant : une barre deux fois plus longue est un nombre immensément plus grand.', code: '10^a × 10^b = 10^(a + b)' },
      { title: 'Une puissance quelconque', text: 'Pour écrire b puissance d comme une puissance de dix, on calcule d × log₁₀(b). Par exemple 35 vaut environ 10^1,54 ; donc 35⁸⁰ vaut environ 10^(80 × 1,54), soit 10^123.', code: 'Math.log10(35) * 80   // ≈ 123,5' },
    ],
    check: [
      numeric('Que vaut l’exposant de 10⁵ × 10⁸ ?', 13, '10⁵ × 10⁸ = 10¹³ : on ajoute les exposants.'),
      choice('2¹⁰ = 1 024. À quelle puissance de dix 2¹⁰⁰ est-il proche ?', ['10³⁰', '10¹⁰⁰', '10¹⁰', '10²⁰⁰'], '2¹⁰⁰ = (2¹⁰)¹⁰ ≈ (10³)¹⁰ = 10³⁰.'),
    ],
  },
  {
    id: 'P1', title: 'Fréquence et moyenne',
    goal: 'Estimer une moyenne à partir d’essais répétés et savoir qu’elle se stabilise quand les essais sont nombreux.',
    used: 'Les parties au hasard de la recherche Monte-Carlo.',
    steps: [
      { title: 'La moyenne de résultats', diagram: 'rollouts', text: 'On note chaque partie +1 si elle est gagnée, 0 si elle est nulle, −1 si elle est perdue. La moyenne de ces nombres résume les résultats : 30 victoires, 50 nuls et 20 défaites sur 100 parties donnent (30 − 20) / 100 = 0,1.' },
      { title: 'Plus d’essais, moins de hasard', diagram: 'rollouts', text: 'Avec 10 parties, la moyenne varie beaucoup d’une série à l’autre ; avec 1 000 parties, beaucoup moins. L’écart typique diminue comme 1/√n : il faut 100 fois plus d’essais pour une estimation 10 fois plus précise.' },
      { title: 'Une moyenne n’est pas une vérité', text: 'Une moyenne décrit les essais réalisés. Si les essais sont faits d’une certaine manière (au hasard, par exemple), la moyenne décrit cette manière de jouer, pas le meilleur jeu possible.' },
    ],
    check: [
      numeric('Sur 50 parties : 20 victoires, 10 nuls, 20 défaites. Quelle est la moyenne ?', 0, '(20 − 20) / 50 = 0.'),
      choice('Pour diviser par 10 l’écart typique d’une moyenne, combien faut-il d’essais en plus ?', ['100 fois plus', '10 fois plus', '2 fois plus', '1 000 fois plus'], 'L’écart diminue comme 1/√n : √100 = 10.'),
    ],
  },
  {
    id: 'S1', title: 'Tirage pondéré',
    goal: 'Transformer des poids en probabilités et dire ce qu’un tirage pondéré favorise.',
    used: 'L’échantillonnage des états de départ du robot, et les coups tirés selon leurs visites.',
    steps: [
      { title: 'Des poids aux probabilités', diagram: 'sgs', text: 'On donne un poids positif à chaque possibilité. Sa probabilité d’être tirée vaut son poids divisé par la somme des poids. Avec des poids 1, 1 et 2, les probabilités valent 1/4, 1/4 et 1/2.' },
      { title: 'Ce qu’un poids nul fait', text: 'Une possibilité de poids nul n’est jamais tirée. Pour ne jamais abandonner complètement une possibilité, on ajoute à tous les poids un plancher, une petite valeur minimale.' },
      { title: 'Tirer au hasard', text: 'Pour tirer selon des probabilités, on prend un nombre au hasard u entre 0 et 1, puis on additionne les probabilités dans l’ordre jusqu’à dépasser u.', code: 'let acc = 0\nfor (i…) { acc += p[i]; if (u < acc) return i }' },
    ],
    check: [
      numeric('Deux états ont des poids 1 et 3. Quelle est la probabilité de tirer le second ?', 0.75, '3 / (1 + 3) = 0,75.'),
      choice('Pourquoi ajouter un plancher aux poids ?', ['pour que chaque possibilité garde une chance', 'pour que les poids restent entiers', 'pour que la somme des poids vaille 1', 'pour tirer plus souvent la meilleure'], 'Sans plancher, une possibilité de poids nul ne serait plus jamais essayée.'),
    ],
  },
];


// ----------------------------------------------------------- exercises

const sameVisits = (got: number[], want: number[]) => got.length === want.length && got.every((x, i) => x === want[i]);
const refVisits = (b: number[], sims: number) => search(b, { sims, c: MCTS_NOMINAL.c, evaluate: rolloutEval, seed: 1 }).visits;
const withFns = (b: number[], sims: number, score?: ScoreFn, backup?: BackupFn) => search(b, { sims, c: MCTS_NOMINAL.c, evaluate: rolloutEval, seed: 1, score, backup }).visits;
/** The visits of the search from the course's position, with the learner's function, against the reference's. */
function visitsPreview(ctx: CanvasRenderingContext2D, mine: (() => number[]) | null): void {
  ctx.font = '11px Inter, sans-serif'; ctx.textBaseline = 'alphabetic';
  let got: number[] | null = null;
  try { got = mine ? mine() : null; } catch { got = null; }
  const ref = refVisits(FORK, 200);
  const ms = legal(FORK);
  const top = Math.max(1, ...ref, ...(got ?? []).map((x) => (Number.isFinite(x) ? x : 0)));
  ctx.fillStyle = CC.fg; ctx.textAlign = 'left';
  ctx.fillText('visites depuis la position du cours (200 simulations)', 20, 18);
  ctx.fillStyle = CC.acc; ctx.fillText('votre fonction', 20, 34);
  ctx.fillStyle = CC.blue; ctx.fillText('référence', 120, 34);
  if (!got) { ctx.fillStyle = CC.red; ctx.fillText(mine ? 'votre fonction lève une erreur' : 'écrivez votre fonction', 20, 54); }
  ms.forEach((m, i) => {
    const x = 30 + i * 52, base = 200, H = 130;
    ctx.fillStyle = 'rgba(124,156,255,.55)'; ctx.fillRect(x, base - (ref[m] / top) * H, 18, (ref[m] / top) * H);
    if (got) { const g = Math.max(0, Math.min(top, got[m] || 0)); ctx.fillStyle = CC.acc; ctx.fillRect(x + 20, base - (g / top) * H, 18, (g / top) * H); }
    ctx.fillStyle = 'rgba(230,234,245,.6)'; ctx.textAlign = 'center'; ctx.fillText(`${CELL[m]} ${m + 1}`, x + 19, base + 14);
  });
  ctx.textAlign = 'left';
}


const C100 = playoutCounts(FORK, CORNER, 100);
const SC = { Q: 0.25, P: 1 / 6, N: 36, n: 4, c: 1.5 };
const SGS_ITEMS = [0, 0.02, 0.3, 0.5, 0.7, 0.98, 1];
const SGS_ON = (s: number) => sgsWeight(s) >= 0.5;
const Q9 = [0.9, 0.9, 0.9, 0.9, 0.9];
/** The visit shares and the result the network learns from, in the example of the workshop. */
const PI_EX = 30 / 48, V_EX = 0.2;

const exercises: Exercise[] = [
  {
    id: 'count', module: 'm1', kind: 'calculation', title: 'Compter les parties de morpion',
    intro: 'On cherche combien de parties de morpion existent, en partant d’une majoration simple.',
    steps: [
      { prompt: 'De combien de façons peut-on jouer les deux premiers coups ?', value: 9 * 8, explain: '9 cases pour X, puis 8 pour O : 9 × 8 = 72.' },
      { prompt: 'Si aucune partie ne s’arrêtait avant que la grille soit pleine, combien d’ordres de remplissage des 9 cases y aurait-il ?', value: 362_880, explain: '9 × 8 × 7 × … × 1 = 362 880 (on note 9!).' },
      { prompt: `Le modèle compte ${fr(T.games)} parties. Quelle part de 9! est-ce, en % ?`, value: (T.games / 362_880) * 100, unit: '%', tol: 1, explain: `${fr(T.games)} / 362 880 ≈ ${pct1(T.games / 362_880)} : beaucoup de parties s’arrêtent avant la fin, sur un alignement.` },
    ],
    win: 'Le morpion est assez petit pour être exploré en entier par un ordinateur.',
  },
  {
    id: 'mean', module: 'm1', kind: 'calculation', title: 'Une moyenne et un score',
    intro: `Dans la position du cours, O joue dans un coin, puis on fait 100 parties au hasard. O en gagne ${C100.wins}, en annule ${C100.draws} et en perd ${C100.losses}. Ensuite, un autre coup a été visité n = ${SC.n} fois, sur N = ${SC.N} visites de son parent, avec une moyenne Q = ${fr(SC.Q, 2)}, P = 1/6 et c = ${fr(SC.c, 1)}.`,
    steps: [
      { prompt: 'Quelle est la moyenne des 100 parties pour O ?', value: (C100.wins - C100.losses) / 100, tol: 0.5, explain: `(${C100.wins} − ${C100.losses}) / 100 = ${fr((C100.wins - C100.losses) / 100, 2)}. Le coin semble bon au hasard, alors qu’il perd contre un bon joueur.` },
      { prompt: 'Que vaut le bonus d’exploration c·P·√N / (1 + n) du second coup ?', value: scoreRef(0, SC.P, SC.N, SC.n, SC.c), explain: `${fr(SC.c, 1)} × 1/6 × √${SC.N} / (1 + ${SC.n}) = ${fr(SC.c, 1)} × 1/6 × 6 / 5 = ${fr(scoreRef(0, SC.P, SC.N, SC.n, SC.c), 2)}.` },
      { prompt: 'Que vaut son score ?', value: scoreRef(SC.Q, SC.P, SC.N, SC.n, SC.c), explain: `Q + bonus = ${fr(SC.Q, 2)} + ${fr(scoreRef(0, SC.P, SC.N, SC.n, SC.c), 2)} = ${fr(scoreRef(SC.Q, SC.P, SC.N, SC.n, SC.c), 2)}.` },
    ],
    win: 'Le score ajoute à la moyenne un bonus qui diminue à mesure que le coup est visité.',
  },
  {
    id: 'score', module: 'm1', kind: 'code', title: 'Le score PUCT', slot: 'score',
    sig: 'function score(Q, P, N, n, c)',
    doc: 'Q : la moyenne des résultats du coup (entre −1 et 1, 0 s’il n’a jamais été visité) · P : la probabilité a priori du coup · N : le nombre de visites du parent · n : le nombre de visites du coup · c : la constante d’exploration. Renvoie le score qui décide quel coup visiter.',
    goal: 'Renvoyez la moyenne Q plus le bonus d’exploration c·P·√N / (1 + n).',
    solution: `function score(Q, P, N, n, c) {
  return Q + c * P * Math.sqrt(N) / (1 + n);
}`,
    starter: `function score(Q, P, N, n, c) {
  // la moyenne, plus un bonus qui diminue avec les visites du coup
  return 0;
}`,
    hints: [
      'La racine carrée s’écrit Math.sqrt(N).',
      'Le bonus est grand quand n est petit : il faut diviser par (1 + n), pas par n, pour un coup jamais visité.',
      'Le bonus est proportionnel à c et à P.',
    ],
    tests: [
      { label: 'un coup jamais visité a un grand bonus', run: (fn) => { const g = fn(0, 1 / 6, 100, 0, 1.5); return Math.abs(g - 2.5) < 1e-9 ? null : `attendu 2,5, obtenu ${g}`; } },
      { label: 'le bonus diminue avec les visites', run: (fn) => { const g = fn(0, 1 / 6, 100, 9, 1.5); return Math.abs(g - 0.25) < 1e-9 ? null : `attendu 0,25, obtenu ${g}`; } },
      { label: 'la moyenne s’ajoute au bonus', run: (fn) => { const g = fn(0.2, 0.5, 100, 4, 1.5); return Math.abs(g - 1.7) < 1e-9 ? null : `attendu 1,7, obtenu ${g}`; } },
      { label: 'la recherche depuis la position du cours donne les mêmes visites', run: (fn) => (sameVisits(withFns(FORK, 200, fn as ScoreFn), refVisits(FORK, 200)) ? null : 'les visites diffèrent de la référence') },
    ],
    win: 'Votre score équilibre ce qui est connu (Q) et ce qui reste à essayer (le bonus).',
    preview: (ctx, fn) => visitsPreview(ctx, fn ? () => withFns(FORK, 200, fn as ScoreFn) : null),
    primm: {
      intro: 'Voici un score sans bonus d’exploration. Lisez-le avant de l’exécuter.',
      code: `function score(Q, P, N, n, c) {
  return Q;
}`,
      predict: choiceQ('Avec ce score, que fait la recherche une fois qu’un coup a obtenu une bonne moyenne ?', ['elle ne visite presque plus que lui', 'elle visite tous les coups autant', 'elle choisit un coup au hasard'], 'Le score vaut la moyenne seule : le coup en tête reste en tête, et les autres ne sont plus essayés.'),
      investigate: choiceQ('Que manque-t-il à ce score ?', ['un bonus pour les coups peu visités', 'la moyenne des résultats', 'le nombre de coups légaux'], 'Sans bonus, un coup mal estimé au début n’est jamais revu.'),
      modify: 'Ajoutez le bonus d’exploration c·P·√N / (1 + n).',
    },
  },
  {
    id: 'backup', module: 'm1', kind: 'code', title: 'La rétropropagation', slot: 'backup', parsons: true,
    sig: 'function backup(path, v)',
    doc: 'path : les nœuds parcourus, de la racine (path[0]) à la feuille (le dernier), chacun {N, W} (visites, somme des résultats) · v : la valeur de la feuille pour le joueur qui doit y jouer (+1, 0 ou −1). Chaque nœud compte ses résultats pour le joueur qui a choisi le coup menant à lui.',
    goal: 'De la feuille vers la racine : changez le signe de v, puis ajoutez une visite et v au nœud.',
    solution: `function backup(path, v) {
  for (let i = path.length - 1; i >= 0; i--) {
    v = -v;
    path[i].N += 1; path[i].W += v;
  }
}`,
    starter: `function backup(path, v) {
  // de la feuille (dernier nœud) vers la racine (premier nœud) :
  //   changer le signe de v, puis ajouter une visite et v au nœud
}`,
    hints: [
      'La boucle part de la fin : for (let i = path.length - 1; i >= 0; i--).',
      'Le coup qui mène à la feuille a été joué par l’adversaire du joueur qui doit y jouer : pour lui, le résultat vaut −v.',
      'Le signe change à chaque niveau, avant d’ajouter v à W.',
    ],
    tests: [
      { label: 'un chemin de trois nœuds', run: (fn) => { const p = [{ N: 0, W: 0 }, { N: 0, W: 0 }, { N: 0, W: 0 }]; fn(p, 1); return p.map((x) => x.W).join(',') === '-1,1,-1' && p.every((x) => x.N === 1) ? null : `W = ${p.map((x) => x.W).join(', ')} ; attendu −1, 1, −1` ; } },
      { label: 'les visites s’ajoutent', run: (fn) => { const p = [{ N: 4, W: 1 }, { N: 2, W: -1 }]; fn(p, 0); return p[0].N === 5 && p[1].N === 3 && p[0].W === 1 && p[1].W === -1 ? null : 'une partie nulle ajoute une visite sans changer W'; } },
      { label: 'la recherche depuis la position du cours donne les mêmes visites', run: (fn) => (sameVisits(withFns(FORK, 200, undefined, fn as BackupFn), refVisits(FORK, 200)) ? null : 'les visites diffèrent de la référence') },
    ],
    win: 'Votre rétropropagation compte chaque résultat du point de vue du bon joueur.',
    preview: (ctx, fn) => visitsPreview(ctx, fn ? () => withFns(FORK, 200, undefined, fn as BackupFn) : null),
  },
  {
    id: 'gdStep', module: 'm2', kind: 'calculation', title: 'Un pas de descente de gradient',
    intro: `L’erreur d’un réseau à un seul paramètre w vaut L(w) = (w − 3)², minimale en w = 3. Sa pente vaut 2(w − 3). On part de w = ${W1}.`,
    steps: [
      { prompt: `Que vaut la pente en w = ${W1} ?`, value: SLOPE1, tol: 0, explain: `2 × (${W1} − 3) = ${fr(SLOPE1)} : l’erreur diminue quand w augmente.` },
      { prompt: 'Avec η = 0,1, que vaut w après un pas (w − η × pente) ?', value: W1 - 0.1 * SLOPE1, explain: `${W1} − 0,1 × (${fr(SLOPE1)}) = ${fr(W1 - 0.1 * SLOPE1, 1)} : w se rapproche de 3.` },
      { prompt: 'Avec η = 1,1, que vaut w après un pas ?', value: W1 - 1.1 * SLOPE1, explain: `${W1} − 1,1 × (${fr(SLOPE1)}) = ${fr(W1 - 1.1 * SLOPE1, 1)} : w passe de l’autre côté de 3, plus loin qu’au départ. Le pas suivant ira plus loin encore : la descente diverge.` },
    ],
    win: 'Le même calcul, répété sur des millions de paramètres, entraîne les réseaux d’AlphaZero.',
  },
  {
    id: 'targets', module: 'm3', kind: 'calculation', title: 'Ce que le réseau apprend d’une partie',
    intro: `Pendant une partie d’auto-jeu, la recherche fait 48 simulations depuis une position et en envoie 30 vers le centre. Le réseau donne au centre une probabilité 0,40 et estime la position à ${fr(V_EX, 2)} pour le joueur qui doit jouer. La partie finit nulle.`,
    steps: [
      { prompt: 'Quelle est la cible de la politique pour le centre (sa part des visites) ?', value: PI_EX, explain: '30 / 48 = 0,625 : le réseau doit augmenter la probabilité du centre.' },
      { prompt: 'Quelle est la cible de la valeur (le résultat z, du point de vue du joueur qui doit jouer) ?', value: 0, tol: 0, explain: 'La partie est nulle : z = 0.' },
      { prompt: 'Que vaut l’erreur de la valeur, (v − z)² ?', value: V_EX ** 2, explain: `(${fr(V_EX, 2)} − 0)² = ${fr(V_EX ** 2, 2)}. La descente de gradient réduira cette erreur, avec celle de la politique.` },
    ],
    win: 'La politique apprend ce que la recherche a fait ; la valeur, ce qui s’est passé.',
  },
  {
    id: 'chainCalc', module: 'm4', kind: 'calculation', title: 'Une chaîne de sous-étapes',
    intro: 'Le robot réussit chacune des cinq sous-étapes (saisir, orienter, approcher, aligner, insérer) 9 fois sur 10.',
    steps: [
      { prompt: 'Quel est son taux de succès sur la tâche complète, en % ?', value: successByLevel(Q9)[4] * 100, unit: '%', explain: `0,9⁵ ≈ ${fr(successByLevel(Q9)[4], 3)}, soit ${pct1(successByLevel(Q9)[4])}.` },
      { prompt: 'En partant d’une pièce près du but (il reste aligner et insérer), en % ?', value: successByLevel(Q9)[1] * 100, unit: '%', explain: '0,9² = 0,81.' },
      { prompt: `S’il force l’écrou sans le reprendre, l’insertion ne réussit plus que ${pct(ROBOT.cap)} aussi souvent. Succès sur la tâche complète, en % ?`, value: chainSuccess(Q9, 0, ROBOT.cap)[4] * 100, unit: '%', explain: `0,9⁴ × ${fr(0.9 * ROBOT.cap, 2)} ≈ ${pct1(chainSuccess(Q9, 0, ROBOT.cap)[4])}.` },
    ],
    win: 'Dans une chaîne, le maillon faible coûte cher : le succès est un produit.',
  },
  {
    id: 'sgsSort', module: 'm4', kind: 'classify', title: 'Ce que SGS tire souvent',
    intro: `SGS vise ici un taux de succès de ${pct(ROBOT.target)}. Pour chaque configuration, dites si son poids dépasse la moitié du poids maximal.`,
    categories: ['plus de la moitié du maximum', 'moins de la moitié'],
    items: SGS_ITEMS.map((s) => ({ text: `une configuration réussie ${pct(s)} du temps (poids ${pct(sgsWeight(s))})`, cat: SGS_ON(s) ? 0 : 1, why: SGS_ON(s) ? 'son issue est incertaine : un épisode y apprend quelque chose' : s < ROBOT.target ? 'presque toujours ratée : peu de signal pour l’instant' : 'presque toujours réussie : rien de neuf à apprendre' })),
    win: 'SGS dépense les épisodes là où l’issue est incertaine, sans abandonner les autres : même une configuration jamais réussie garde une part du poids.',
  },
  {
    id: 'rlSort', module: 'm4', kind: 'classify', title: 'Reconnaître une difficulté du renforcement',
    intro: 'Pour chaque observation faite pendant un entraînement, dites de quelle difficulté elle relève.',
    categories: ['récompense rare', 'instabilité', 'récompense mal posée', 'écart simulation-réalité'],
    items: [
      { text: 'en partant des pièces détachées, aucun épisode ne réussit jamais', cat: 0 },
      { text: 'deux entraînements identiques, à la graine près, finissent l’un à 99 %, l’autre à 0 %', cat: 1 },
      { text: 'après une grosse mise à jour, le robot ne réussit plus rien et ne progresse plus', cat: 1, why: 'un effondrement : une action nécessaire est devenue presque impossible' },
      { text: 'le robot aligne parfaitement l’écrou mais ne le visse jamais', cat: 2, why: 'il optimise ce qui est récompensé, pas la tâche' },
      { text: 'la politique réussit en simulation et échoue sur le vrai bras', cat: 3 },
      { text: 'un robot payé pour avancer apprend à tourner en rond très vite', cat: 2 },
    ],
    win: 'Chaque difficulté a son remède : partir près du but, limiter la taille des mises à jour, récompenser le résultat, varier les simulations.',
  },
];

const workshop: WorkshopConfig = {
  scenarios: [
    { name: 'position du cours, 200 simulations', run: (impl) => withFns(FORK, 200, impl.score as ScoreFn, impl.backup as BackupFn), tol: 0, unit: 'visites' },
    { name: 'plateau vide, 100 simulations', run: (impl) => withFns(EMPTY, 100, impl.score as ScoreFn, impl.backup as BackupFn), tol: 0, unit: 'visites' },
  ],
  assembly: {
    title: 'Ma recherche Monte-Carlo',
    intro: 'Votre score et votre rétropropagation font tourner la recherche depuis la position du cours. La courbe donne les visites de chaque case.',
    chart: { label: 'visites par case, position du cours', run: (impl) => withFns(FORK, 200, impl.score as ScoreFn, impl.backup as BackupFn) },
    preview: (ctx, impl) => visitsPreview(ctx, () => withFns(FORK, 200, impl.score as ScoreFn, impl.backup as BackupFn)),
  },
};


// --------------------------------------------------------------- course

const isSolid = (v: Record<string, number>) => mctsOf(v).outcome === 'solid';
const rs = (v: Record<string, number>) => robotSeeds(v);
const C_OPTS = [0, 0.1, 0.5, 1.5, 5, 25, 100].map((x) => ({ label: fr(x, x < 1 ? 1 : 0), value: x }));
const NOISE_OPTS = [0, 0.5].map((x) => ({ label: fr(x, 1), value: x }));
const TEMP_OPTS = [0, 2, 9].map((x) => ({ label: fr(x), value: x }));
const finalLoss = (v: Record<string, number>) => checkpointAt(trainOf(v), 1e9).searchLoss;

export default defineCourse({
  workshop,
  id: 'alphazero', version: 4, language: 'fr',
  title: 'AlphaGo, AlphaZero et AlphaNIST',
  lead: 'Comment un programme apprend-il seul à jouer au go mieux que les champions, et comment la même idée apprend-elle à un robot à assembler des pièces ? Le cours construit des versions miniatures de chaque étape : la recherche Monte-Carlo au morpion, vérifiée contre une implémentation indépendante, un petit réseau entraîné par descente de gradient, un AlphaZero qui apprend en jouant contre lui-même, et un robot qui apprend à visser un écrou. Chaque chiffre est calculé par ces programmes, sur plusieurs graines quand le hasard compte.',
  audience: { level: 'lycée (fin)', prerequisites: 'Probabilités simples, moyenne, puissances de dix, dérivée d’un polynôme ; lire une courte fonction JavaScript. Cinq fiches rappellent les outils.', effort: 'quatre à cinq heures' },
  modules: [
    {
      id: 'm1', title: 'Chercher', pitch: 'L’arbre de jeu, minimax, puis la recherche Monte-Carlo, qui n’explore que la partie utile de l’arbre.',
      goals: ['Trouver la valeur minimax d’une position simple', 'Décrire les quatre temps d’une simulation de la recherche Monte-Carlo', 'Expliquer le rôle de la constante d’exploration', 'Distinguer une estimation biaisée d’une estimation bruitée'],
      summary: ['Minimax remonte les valeurs depuis les fins de partie ; l’arbre du go, environ 10³⁶⁰ parties, est hors de portée.', 'Les parties au hasard sont biaisées : au hasard, le coin de la position du cours paraît meilleur que le bord. Un résultat sur 100 parties est bruité : on donne un intervalle.', 'La recherche Monte-Carlo répète sélection, expansion, évaluation et rétropropagation, puis joue le coup le plus visité ; en creusant sous les coups, elle corrige le biais des parties au hasard.', 'Le score PUCT = Q + c·P·√N / (1 + n) équilibre exploitation et exploration : le bonus d’un coup négligé grandit comme √N, et la recherche finit par le réessayer. OpenSpiel confirme nos résultats.'],
    },
    {
      id: 'm2', title: 'Apprendre une intuition', pitch: 'Un réseau de neurones, réglé par descente de gradient, juge les positions et propose des coups, même pour des positions jamais vues.',
      goals: ['Expliquer le rôle de la politique et de la valeur', 'Expliquer comment la descente de gradient règle les paramètres d’un réseau', 'Expliquer pourquoi un réseau généralise et une table non'],
      summary: ['La politique dit où chercher ; la valeur dit qui va gagner sans finir la partie.', 'La descente de gradient recule chaque paramètre dans le sens où l’erreur diminue ; trop petit, le pas est lent, trop grand, il diverge.', 'Entraîné sur la moitié des positions, le petit réseau se trompe presque autant sur l’autre moitié : ses paramètres servent partout, il généralise. Une table ne sait rien de ce qu’elle n’a pas rencontré.'],
    },
    {
      id: 'm3', title: 'Apprendre en jouant contre soi', pitch: 'La boucle d’AlphaZero : la recherche améliore la politique, qui apprend à imiter la recherche.',
      goals: ['Décrire la boucle d’auto-jeu d’AlphaZero', 'Expliquer pourquoi la recherche améliore la politique', 'Expliquer pourquoi l’entraînement a besoin de parties variées, et le rôle du bruit à la racine et de la température'],
      summary: ['AlphaGo imitait d’abord des humains ; AlphaGo Zero et AlphaZero partent des seules règles.', 'Pendant l’auto-jeu, la politique apprend la part des visites de la recherche, et la valeur le résultat des parties.', 'La recherche choisit bien plus souvent un bon coup que la politique seule : c’est elle qui fait progresser le réseau.', 'Sur les positions jamais rencontrées, la politique généralise bien, la valeur moins : il faut des parties variées. Le bruit à la racine et la température les font varier ; on le vérifie sur plusieurs graines.'],
    },
    {
      id: 'm4', title: 'AlphaNIST : du jeu au robot', pitch: 'La même philosophie pour un robot qui visse un écrou : récompense, choix des départs, façonnage, hasard des épisodes.',
      goals: ['Expliquer pourquoi une récompense rare bloque l’apprentissage et comment SGS choisit les départs', 'Expliquer pourquoi le façonnage par potentiel ne change pas la meilleure politique', 'Expliquer le rôle de la base de référence et reconnaître un effondrement', 'Diagnostiquer un entraînement raté'],
      summary: ['Le robot rend plus probables les gestes des épisodes meilleurs que prévu. Un épisode toujours raté n’apprend rien : la variance d’une récompense binaire vaut P(1 − P). SGS tire surtout les configurations réussies environ une fois sur deux.', 'Des points pour être près du but peuvent faire préférer un écrou coincé à un détour utile ; le façonnage par potentiel, w × (Φ(s′) − Φ(s)) avec Φ = 0 à la fin, ne change pas la meilleure politique : sa somme ne dépend que du départ.', 'Une base de référence réduit le hasard du gradient. De grands pas sur de petits lots peuvent faire perdre définitivement un geste : un effondrement, qui ne frappe que certaines graines.', 'Même symptôme, causes différentes : plusieurs graines aident à trancher.'],
    },
    { id: 'exam', title: 'Épreuve', kind: 'exam', pitch: 'Un entraînement raté à diagnostiquer seul, et le test final.', goals: ['Diagnostiquer seul un cas inconnu'], summary: ['Observer, supposer, corriger un seul réglage, justifier.'] },
  ],
  glossary: [
    { id: 'tree', name: 'arbre de jeu', forms: ['arbres de jeu'], def: 'Toutes les suites de coups possibles à partir d’une position, rangées comme un arbre : chaque branche est un coup, chaque nœud une position.', module: 'm1' },
    { id: 'minimax', name: 'minimax', def: 'Calcul de la valeur d’une position en supposant que chaque joueur choisit toujours le coup le pire pour l’adversaire.', module: 'm1' },
    { id: 'perfect', name: 'joueur parfait', def: 'Joueur qui choisit toujours un coup de meilleure valeur minimax. Au morpion, il ne perd jamais.', module: 'm1' },
    { id: 'eval', name: 'fonction d’évaluation', def: 'Formule qui juge une position sans finir la partie.', module: 'm1' },
    { id: 'mcts', name: 'recherche Monte-Carlo', forms: ['MCTS'], def: 'Recherche qui construit seulement la partie prometteuse de l’arbre, par des simulations répétées.', module: 'm1' },
    { id: 'sim', name: 'simulation', forms: ['simulations'], def: 'Un passage de la recherche Monte-Carlo : sélection, expansion, évaluation, rétropropagation.', module: 'm1' },
    { id: 'rollout', name: 'partie au hasard', forms: ['parties au hasard'], def: 'Partie jouée jusqu’au bout avec des coups tirés au hasard, pour estimer une position.', tool: 'P1', module: 'm1' },
    { id: 'ci', name: 'intervalle de confiance', def: 'Les valeurs que le vrai taux peut prendre, compte tenu du hasard des essais : à 95 %, il tombe dedans 19 fois sur 20.', tool: 'P1', module: 'm1' },
    { id: 'puct', name: 'PUCT', def: 'Règle de sélection d’AlphaZero : score = Q + c·P·√N / (1 + n).', module: 'm1' },
    { id: 'explo', name: 'exploration', def: 'Essayer des coups peu connus, au risque de perdre du temps, pour ne pas manquer un meilleur coup.', module: 'm1' },
    { id: 'exploit', name: 'exploitation', def: 'Approfondir les coups qui semblent déjà les meilleurs.', module: 'm1' },
    { id: 'backprop', name: 'rétropropagation', def: 'Remontée du résultat d’une simulation de la feuille vers la racine, avec le signe de chaque joueur.', module: 'm1' },
    { id: 'nn', name: 'réseau de neurones', forms: ['réseaux de neurones'], def: 'Fonction à nombreux paramètres réglables, ajustés sur des exemples pour réduire ses erreurs.', module: 'm2' },
    { id: 'policy', name: 'politique', forms: ['politiques'], def: 'Règle qui donne, pour chaque position, une probabilité à chaque coup (ou à chaque action d’un robot).', module: 'm2' },
    { id: 'loss', name: 'fonction de perte', def: 'Nombre qui mesure l’erreur d’un réseau sur ses exemples, par exemple la moyenne des carrés des écarts.', module: 'm2' },
    { id: 'grad', name: 'gradient', forms: ['gradients'], def: 'Pour chaque paramètre, de combien l’erreur change quand on l’augmente un peu : la pente de l’erreur.', tool: 'T4', module: 'm2' },
    { id: 'gd', name: 'descente de gradient', def: 'Méthode qui règle les paramètres pas à pas, chacun dans le sens où l’erreur diminue : paramètre ← paramètre − η × gradient.', tool: 'T6', module: 'm2' },
    { id: 'eta', name: 'taux d’apprentissage', def: 'La taille η des pas de la descente de gradient.', module: 'm2' },
    { id: 'gen', name: 'généralisation', def: 'Le fait de bien répondre pour des exemples jamais vus pendant l’entraînement.', module: 'm2' },
    { id: 'sl', name: 'apprentissage supervisé', def: 'Apprentissage à partir d’exemples dont la bonne réponse est connue, comme le coup joué par un expert.', module: 'm3' },
    { id: 'rl', name: 'apprentissage par renforcement', def: 'Apprentissage par essais, guidé seulement par une récompense.', module: 'm3' },
    { id: 'reward', name: 'récompense', forms: ['récompenses'], def: 'Nombre donné pendant ou à la fin d’un essai pour dire s’il a réussi.', module: 'm3' },
    { id: 'self', name: 'auto-jeu', def: 'Parties qu’un programme joue contre lui-même pour produire ses propres données d’entraînement.', module: 'm3' },
    { id: 'noise', name: 'bruit à la racine', def: 'Hasard ajouté aux probabilités des coups de la racine pendant l’entraînement (bruit de Dirichlet).', module: 'm3' },
    { id: 'temp', name: 'température', def: 'Pendant l’entraînement, les premiers coups sont tirés au hasard selon leurs visites au lieu de prendre toujours le plus visité.', module: 'm3' },
    { id: 'seed', name: 'graine', forms: ['graines'], def: 'Le nombre qui fixe le hasard d’un entraînement : deux graines, deux suites de tirages différentes.', module: 'm3' },
    { id: 'episode', name: 'épisode', forms: ['épisodes'], def: 'Un essai du robot, depuis une configuration de départ jusqu’à la fin du temps imparti.', module: 'm4' },
    { id: 'binary', name: 'récompense binaire', def: '1 si la tâche est réussie, 0 sinon ; rien pour les progrès intermédiaires.', module: 'm4' },
    { id: 'dense', name: 'récompense dense', def: 'Récompense donnée aussi pour les progrès intermédiaires, comme se rapprocher du but.', module: 'm4' },
    { id: 'shaping', name: 'façonnage par potentiel', def: 'Récompense intermédiaire de la forme Φ(état suivant) − Φ(état) : elle ne change pas la meilleure politique (Ng, Harada et Russell, 1999).', module: 'm4' },
    { id: 'start', name: 'configuration de départ', forms: ['configurations de départ'], def: 'Situation où commence un épisode : un état de départ et une variante de la pièce.', module: 'm4' },
    { id: 'sgs', name: 'échantillonnage guidé par le succès', forms: ['SGS'], def: 'Choix des configurations de départ selon leur taux de succès récent : surtout celles réussies environ une fois sur deux.', tool: 'S1', module: 'm4' },
    { id: 'baseline', name: 'base de référence', def: 'Ce qu’on attendait d’un épisode, retiré de sa récompense : seul l’écart compte. Elle réduit le hasard du gradient sans en changer la direction moyenne.', module: 'm4' },
    { id: 'credit', name: 'attribution du mérite', def: 'Savoir quel choix a causé une réussite ou un échec, quand le résultat vient à la fin.', module: 'm1' },
    { id: 'batch', name: 'lot d’épisodes', forms: ['lots d’épisodes', 'lots'], def: 'Les épisodes joués avec la même politique avant de la mettre à jour.', module: 'm4' },
    { id: 'var', name: 'variance', def: 'La moyenne des carrés des écarts à la moyenne : elle mesure combien une grandeur change d’un essai à l’autre.', tool: 'P1', module: 'm4' },
    { id: 'collapse', name: 'effondrement', def: 'Une mise à jour trop forte rend une action presque impossible : la politique ne l’essaie plus, et ne peut plus apprendre qu’elle était utile.', module: 'm4' },
    { id: 'simreal', name: 'écart simulation-réalité', def: 'Différence entre le monde simulé où la politique apprend et le monde réel.', module: 'm4' },
    { id: 'emerg', name: 'comportement émergent', forms: ['comportements émergents'], def: 'Manière de faire que personne n’a programmée et que l’apprentissage a trouvée.', module: 'm4' },
  ],
  toolbox: [...CAPSULES, ...pickCapsules(['T4', 'La pente d’une erreur, que suit la descente de gradient.'], ['T6', 'Le minimum de l’erreur d’un réseau.'])],
  tests: {
    tools: [
      { id: 'a1', skill: 'Puissances de dix', tool: 'O1', q: choice('Quel nombre est le plus grand ?', ['10¹²⁰', '10⁶⁰ × 10⁵⁰', '2 × 10¹⁰⁰', '10⁸⁰ + 10⁸⁰'], '10⁶⁰ × 10⁵⁰ = 10¹¹⁰ ; 2 × 10¹⁰⁰ et 2 × 10⁸⁰ sont bien plus petits que 10¹²⁰.') },
      { id: 'a2', skill: 'Moyenne de résultats', tool: 'P1', q: numeric('Sur 20 parties : 12 victoires, 2 nuls, 6 défaites (comptées +1, 0, −1). Quelle est la moyenne ?', 0.3, '(12 − 6) / 20 = 0,3.') },
      { id: 'a3', skill: 'Tirage pondéré', tool: 'S1', q: numeric('Trois configurations ont des poids 2, 3 et 5. Quelle est la probabilité de tirer la troisième ?', 0.5, '5 / (2 + 3 + 5) = 0,5.') },
    ],
    pre: [
      { id: 'b1', skill: 'La taille des arbres de jeu', q: choice('Un ordinateur très puissant pourrait-il examiner toutes les parties de go possibles avant de jouer ?', ['non, il y en a bien trop', 'oui, avec un supercalculateur', 'oui, en quelques jours', 'non, les règles sont floues'], `Il y en aurait de l’ordre de ${pow10(GO)}, bien plus que d’atomes dans l’univers observable.`) },
      { id: 'b2', skill: 'Apprendre sans humains', q: choice('D’où AlphaZero tire-t-il sa connaissance du go ?', ['de parties contre lui-même', 'de parties de champions', 'de conseils d’experts', 'd’une base de positions'], 'AlphaZero ne connaît que les règles ; il produit ses données en jouant contre lui-même.') },
      { id: 'b3', skill: 'Explorer et exploiter', q: choice('Une recherche qui approfondit toujours le coup qui lui semble le meilleur…', ['peut manquer un meilleur coup', 'trouve toujours le meilleur coup', 'explore tous les coups également', 'n’a besoin d’aucun calcul'], 'Un coup mal estimé au début ne serait plus jamais essayé.') },
      { id: 'b4', skill: 'Récompenser les progrès', q: choice('Pour un robot qui apprend à visser un écrou, donner des points pour chaque rapprochement du but…', ['peut l’enfermer dans une manière', 'l’aide toujours à mieux réussir', 'ne change rien au résultat', 'est indispensable pour apprendre'], 'Des points pour rester près du but pénalisent les détours utiles, comme reposer la pièce pour la reprendre.') },
      { id: 'b5', skill: 'Choisir où commencer', q: choice('Avec une récompense binaire, où vaut-il mieux faire commencer la plupart des essais ?', ['là où il réussit une fois sur deux', 'toujours au début de la tâche', 'là où il réussit presque toujours', 'n’importe où, au hasard'], 'Un essai dont l’issue est incertaine apprend le plus ; un essai toujours raté ou toujours réussi n’apprend presque rien.') },
      { id: 'b6', skill: 'Le taux d’apprentissage', q: choice('Pendant l’entraînement d’un réseau, augmenter beaucoup le taux d’apprentissage…', ['peut faire diverger l’apprentissage', 'accélère toujours l’apprentissage', 'ne change que la durée du calcul', 'rend toujours le réseau plus précis'], 'Un pas trop grand dépasse le minimum de l’erreur, de plus en plus loin à chaque pas.') },
      { id: 'b7', skill: 'Le hasard des essais', q: choice('Un programme perd 10 parties sur 100. Son vrai taux de défaite est…', [`entre ${pct(CI10[0])} et ${pct(CI10[1])} environ`, 'exactement 10 %, sans doute', 'au moins 10 %, jamais moins', 'au plus 10 %, jamais plus'], `Le hasard des 100 parties laisse une marge : l’intervalle à 95 % va de ${pct(CI10[0])} à ${pct(CI10[1])}.`) },
    ],
    post: [
      { id: 'p1', pair: 'b1', skill: 'La taille des arbres de jeu', q: choice('Pourquoi un programme d’échecs ne parcourt-il pas tout l’arbre du jeu ?', ['l’arbre est bien trop grand', 'les règles changent en partie', 'il ne connaît pas les règles', 'il le parcourt la nuit'], `L’arbre des échecs compte de l’ordre de ${pow10(CHESS)} parties.`) },
      { id: 'p2', pair: 'b2', skill: 'Apprendre sans humains', q: choice('Un AlphaZero entraîné à un jeu inventé hier, sans joueur humain, peut-il devenir fort ?', ['oui, en jouant contre lui-même', 'non, il lui faut des experts', 'non, il lui faut une base', 'oui, si le jeu ressemble au go'], 'Il lui suffit des règles : l’auto-jeu fournit les exemples, et la recherche les améliore.') },
      { id: 'p3', pair: 'b3', skill: 'Explorer et exploiter', q: choice('Dans le score PUCT, à quoi sert le terme c·P·√N / (1 + n) ?', ['à essayer les coups peu visités', 'à favoriser les coups très visités', 'à compter les parties gagnées', 'à remplacer les parties au hasard'], 'Il est grand pour un coup peu visité (n petit) : la recherche finit par le réessayer.') },
      { id: 'p4', pair: 'b4', skill: 'Récompenser les progrès', q: choice('Quelle récompense intermédiaire ne peut pas changer la meilleure manière de faire ?', ['Φ(état suivant) − Φ(état)', 'des points pour être près du but', 'un malus pour chaque seconde', 'des points pour bien aligner'], 'Les différences de potentiel s’annulent sur un épisode entier : la somme ne dépend que du départ (Ng et al., 1999).') },
      { id: 'p5', pair: 'b5', skill: 'Choisir où commencer', q: choice('Un robot ne réussit jamais la tâche en partant des pièces détachées. Que changer d’abord ?', ['le faire partir près du but aussi', 'répéter la tâche complète plus', 'réduire la récompense du succès', 'supprimer les essais faciles'], 'Près du but, il réussit parfois : c’est là qu’un signal d’apprentissage apparaît.') },
      { id: 'p6', pair: 'b6', skill: 'Le taux d’apprentissage', q: choice('L’erreur d’une descente de gradient grandit à chaque pas. Que faire d’abord ?', ['réduire le taux d’apprentissage', 'augmenter le taux d’apprentissage', 'ajouter des paramètres au réseau', 'garder le résultat du premier pas'], 'Une erreur qui grandit signale des pas trop grands, qui dépassent le minimum.') },
      { id: 'p7', pair: 'b7', skill: 'Le hasard des essais', q: choice('Un réglage réussit avec une graine et échoue avec une autre. Que conclure ?', ['il faut essayer plusieurs graines', 'la première graine est la bonne', 'la seconde graine est fausse', 'le réglage est parfait'], 'Une seule graine peut être chanceuse ou malchanceuse ; seule une série de graines montre ce qui est fiable.') },
    ],
  },
  diagrams: DIAGRAMS,
  stageKeys: ['sims', 'c', 'games', 'noise', 'temp', 'sampler', 'target', 'reward', 'w', 'lr', 'batch', 'baseline', 'small', 'eta'],
  scenes: {
    go: 'Un plateau de go', gametree: 'L’arbre du morpion', playouts: 'Des parties au hasard', tree: 'La recherche Monte-Carlo',
    net: 'Un réseau de neurones', selfplay: 'Des parties d’auto-jeu', robot: 'Le robot visse un écrou',
  },
  defaults: {
    sims: MCTS_NOMINAL.sims, c: MCTS_NOMINAL.c, depth: 2, games: TRAIN.games, noise: TRAIN.noise, temp: TRAIN.temp, small: 0,
    sampler: ROBOT.sampler, target: ROBOT.target, reward: ROBOT.reward, w: ROBOT.w, lr: ROBOT.lr, batch: ROBOT.batch, baseline: ROBOT.baseline, eta: GD.eta,
  },
  model,
  exercises,
  rubric: [
    'Une justification complète décrit le symptôme (ce que l’on observe), la cause (le réglage en défaut) et le mécanisme qui relie les deux.',
    'Elle s’appuie sur une idée-clé du cours : chercher, explorer, biais et bruit, généraliser, attribuer le mérite.',
  ],
  content(c) {
    // ================================================================ m1
    c.module('m1');
    c.chapter('Le défi du go', () => {
      c.stage('go');
      c.step('Une victoire attendue dans dix ans', `En mars ${FACTS.leeYear}, le programme AlphaGo bat le champion Lee Sedol au go, ${FACTS.leeWins} parties à ${FACTS.leeLosses}. Beaucoup de spécialistes pensaient qu’il faudrait encore une dizaine d’années. Le go se joue sur un plateau de ${FACTS.goSide} × ${FACTS.goSide} intersections ; les joueurs posent tour à tour une pierre et cherchent à entourer le plus de territoire.`);
      c.test('pre', 'Avant de commencer, un court test : il mesure ce que vous savez déjà, pour le comparer au test final.');
      c.step('Cinq idées pour tout le cours', 'Le cours construit des versions miniatures d’AlphaGo, d’AlphaZero et d’AlphaNIST, un robot qui assemble des pièces. Cinq idées y reviennent sans cesse : chercher améliore ce qu’on sait ; il faut explorer autant qu’exploiter ; une estimation peut être biaisée ou bruitée ; un bon modèle généralise ; il faut attribuer le mérite d’un résultat aux bons choix.');
    });
    c.chapter('L’arbre de jeu et minimax', () => {
      c.stage('gametree');
      // asked before the diagram, which prints the number of games
      c.ask('q-count', 'À votre avis, combien de parties de morpion différentes existe-t-il ?', [`environ ${fr(Math.round(T.games / 1000))} 000`, 'environ 9', 'environ 3 000', 'environ 36 milliards'], `Le modèle les compte toutes : ${fr(T.games)} parties.`);
      c.diagram('tree');
      c.step('L’arbre de jeu', `Une position, c’est le plateau et le joueur qui doit jouer ; un coup mène à une autre position. Rangeons toutes les suites de coups : la racine est le plateau vide, chaque branche un coup, chaque feuille une partie finie. L’arbre du morpion a ${fr(T.nodes)} nœuds et ${fr(T.games)} feuilles, mais seulement ${fr(T.positions)} positions différentes : des suites différentes mènent souvent à la même position.`, {
        claims: [
          { text: `${fr(T.games)} parties, ${fr(T.positions)} positions`, check: () => (T.games === 255_168 && T.positions === 5_478) || `${T.games} / ${T.positions}` },
          { text: 'après trois coups : deux suites par position', check: () => T.byDepth[3] * 2 === 9 * 8 * 7 || `${T.byDepth[3]}` },
        ],
      });
      c.numeric('q-depth3', 'Après trois coups, X a posé deux croix et O un rond. Combien de positions différentes peut-on obtenir ?', T.byDepth[3], `Il y a 9 × 8 × 7 = ${fr(9 * 8 * 7)} suites de trois coups, mais l’ordre des deux croix ne change pas la position : chacune est obtenue par deux suites. ${fr(9 * 8 * 7)} / 2 = ${fr(T.byDepth[3])}.`, { tol: 0 });
      c.diagram('minimax');
      c.step('Minimax', 'Si les deux joueurs jouent parfaitement, chaque position a une valeur pour le joueur qui doit jouer : gagné, nul ou perdu. Le joueur choisit le coup qui mène à la position la pire pour son adversaire ; on remonte ainsi les valeurs des feuilles jusqu’à la racine. C’est minimax. Le joueur parfait choisit toujours un coup de meilleure valeur ; au morpion, la racine vaut « nul ».', {
        claims: [{ text: 'le morpion joué parfaitement est nul', check: () => minimax(EMPTY) === 0 }],
      });
      c.step('La position du cours', `Sur le schéma, X occupe deux coins opposés et O le centre ; O doit jouer. Les ${bestMoves(FORK).length} bords mènent au nul, les ${legal(FORK).length - bestMoves(FORK).length} coins perdent : X prend l’autre coin et menace deux lignes à la fois. Le cours reviendra souvent à cette position.`, {
        claims: [{ text: 'les bords tiennent le nul', check: () => bestMoves(FORK).every((m) => CELL[m] === 'bord') && bestMoves(FORK).length === 4 }],
      });
      c.stage('go');
      c.diagram('explosion');
      c.step('Trop grand pour minimax', `Un jeu de b coups par tour et de d coups par partie a environ b puissance d parties. Aux échecs, environ ${pow10(CHESS)} ; au go, environ ${pow10(GO)}, bien plus que d’atomes dans l’univers. Il faudrait couper l’arbre : ne regarder que quelques coups, et juger une position sans finir la partie. Au go, personne ne savait écrire une telle fonction d’évaluation.`, {
        tools: ['O1'],
        claims: [{ text: 'échecs ≈ 10¹²³, go ≈ 10³⁶⁰', check: () => near(CHESS, 123.5, 0.01) && near(GO, 359.7, 0.01) }],
      });
      c.exercise('count', 'Dans l’atelier, comptez les parties de morpion à partir d’une majoration simple.');
    });
    c.chapter('Estimer en jouant au hasard', () => {
      c.stage('playouts');
      c.ask('q-corner', 'Dans la position du cours, on estime chaque réponse de O par des milliers de parties au hasard. Le coin, qui perd contre un bon joueur, aura-t-il une moyenne plus basse que le bord ?', ['non : au hasard, il paraît même meilleur', 'oui : sa moyenne sera la plus basse', 'oui, mais seulement avec peu de parties', 'non : les deux moyennes seront égales'], `Au hasard, X ne voit pas sa double menace : le coin rapporte en moyenne ${fr(MEAN(CORNER), 2)} à O, le bord ${fr(MEAN(EDGE), 2)}. La suite du chapitre explique pourquoi.`);
      c.diagram('rollouts');
      c.step('Des parties au hasard', 'Pour estimer une position sans savoir la juger, on la joue jusqu’au bout de nombreuses fois, avec des coups tirés au hasard : la scène en montre. On compte +1 pour une victoire, 0 pour un nul, −1 pour une défaite. La moyenne des résultats estime la position, sans aucune connaissance du jeu.', { tools: ['P1'] });
      c.step('Une estimation biaisée', `Sur le schéma, chaque réponse de O dans la position du cours. Au hasard, le coin rapporte en moyenne ${fr(MEAN(CORNER), 2)} à O, plus que le bord (${fr(MEAN(EDGE), 2)}) ; pourtant le coin perd. L’adversaire au hasard ne profite pas de la double menace. Même avec des millions de parties, cette erreur ne disparaît pas : l’estimation est biaisée.`, {
        claims: [{ text: 'au hasard, le coin semble meilleur que le bord', check: () => MEAN(CORNER) > MEAN(EDGE) && -minimax(play(FORK, CORNER)) === -1 }],
      });
      c.step('Une estimation bruitée', `Un autre défaut vient du nombre d’essais. Un programme qui perd 10 parties sur ${MATCH_GAMES} a un vrai taux de défaite qui peut aller de ${pct(CI10[0])} à ${pct(CI10[1])} : c’est l’intervalle de confiance à 95 %. Plus d’essais le resserrent ; le biais, lui, reste. Dans ce cours, chaque résultat de match est donné avec son intervalle.`, {
        claims: [{ text: 'intervalle de 10 sur 100', check: () => near(CI10[0], 0.055, 0.05) && near(CI10[1], 0.174, 0.05) }],
      });
      c.numeric('q-mean', 'Sur 40 parties au hasard, O en gagne 14, en annule 16 et en perd 10. Quelle est la moyenne pour O ?', 0.1, '(14 − 10) / 40 = 0,1.', { tol: 0 });
      c.question('q-bias', 'Deux programmes estiment le coin de la position du cours : A avec 100 parties au hasard, B avec 100 000. Lequel se trompe sur sa valeur ?', ['les deux : au hasard, le coin semble bon', 'A seulement : 100 parties, c’est trop peu', 'B seulement : trop de parties brouillent', 'aucun : la moyenne finit par être juste'], 'Plus de parties réduisent le bruit : B est plus précis que A. Mais tous deux mesurent le jeu au hasard, où X rate la double menace : le biais reste, et le coin paraît bon aux deux.');
    });
    c.chapter('La recherche Monte-Carlo', () => {
      c.stage('tree');
      c.diagram('phases');
      c.step('Un arbre qui grandit là où c’est utile', `La recherche Monte-Carlo, proposée en ${FACTS.mctsYear}, ne construit qu’une petite partie de l’arbre. Chaque simulation descend depuis la racine en prenant à chaque nœud le coup qui semble le meilleur, jusqu’à une position jamais développée : la sélection. Elle l’ajoute à l’arbre (expansion), l’estime par une partie au hasard (évaluation), puis remonte le résultat (rétropropagation).`);
      c.step('Remonter le résultat', 'La rétropropagation remonte le chemin jusqu’à la racine. Chaque nœud reçoit une visite et le résultat, compté pour le joueur qui a choisi le coup menant à ce nœud : +1 s’il a gagné, −1 s’il a perdu. Le signe change donc à chaque niveau. C’est une première forme d’attribution du mérite : le résultat d’une partie est crédité à chacun des choix qui y ont mené.');
      c.question('q-sign', 'Une partie au hasard, lancée depuis la nouvelle feuille, se termine par une victoire de X. Que reçoit, sur le chemin, le nœud d’un coup joué par O ?', ['−1 : pour O, c’est une défaite', '+1 : la partie a été gagnée', '0 : seul X compte ici', '+1 puis −1, qui s’annulent'], 'Chaque nœud compte le résultat pour le joueur qui a choisi le coup qui y mène. Une victoire de X est une défaite pour O : −1 pour les coups de O, +1 pour ceux de X.');
      // no diagram from here: the four phases would answer the question that follows
      c.diagram(null);
      c.step('Choisir le coup', 'Quand les simulations sont finies, on joue le coup le plus visité, pas celui de meilleure moyenne : un coup très visité a été vérifié de nombreuses fois, alors qu’une bonne moyenne sur deux visites peut venir du hasard. La scène montre l’arbre construit depuis la position du cours : la taille d’un nœud donne ses visites.');
      c.order('q-phases', 'Remettez dans l’ordre les quatre temps d’une simulation.', ['sélection', 'expansion', 'évaluation', 'rétropropagation'], 'On descend dans l’arbre, on l’agrandit, on estime la nouvelle feuille, puis on remonte le résultat.');
    });
    c.chapter('Explorer ou exploiter', () => {
      c.stage('tree');
      c.diagram('puct');
      c.step('Le score PUCT', 'À chaque nœud, la sélection prend le coup de meilleur score : Q + c·P·√N / (1 + n). Q, la moyenne des résultats du coup, pousse à approfondir ce qui a réussi : c’est l’exploitation. Le second terme, le bonus d’exploration, pousse à essayer ce qui est peu connu : il est grand quand le coup a peu de visites, n. La constante c règle l’équilibre.', {
        code: 'score = Q + c * P * Math.sqrt(N) / (1 + n)',
      });
      c.step('Un bonus qui revient', 'N compte les visites du parent. Un coup négligé garde le même n pendant que N grandit : son bonus augmente, comme √N, jusqu’à ce que le coup repasse devant les autres. Aucun coup n’est abandonné pour toujours. Le « 1 + » évite de diviser par zéro pour un coup jamais visité. P est la confiance a priori dans le coup ; ici, la même pour tous.');
      c.question('q-sqrt', 'Un coup n’a plus été choisi depuis un moment : il a toujours n = 3 visites. Son parent passe de 100 à 400 visites. Que devient son bonus d’exploration ?', ['il double', 'il ne change pas', 'il est divisé par deux', 'il est multiplié par quatre'], '√400 / √100 = 20 / 10 = 2 : le bonus double, alors que n n’a pas changé. Un coup négligé finit par repasser devant, et la recherche le réessaie.');
      c.experiment({
        title: 'La constante d’exploration', prompt: `Avec ${fr(MCTS_NOMINAL.sims)} simulations par coup, changez c. Le schéma montre les visites dans la position du cours ; le bilan porte sur ${MATCH_GAMES} parties contre le joueur parfait.`,
        predict: { question: 'Avec c = 0, la recherche…', choices: ['se fige souvent sur un mauvais coup', 'joue parfaitement', 'visite tous les coups autant'], answer: 0 },
        controls: [{ type: 'choice', key: 'c', label: 'constante c', options: C_OPTS }],
        goals: [
          { label: 'Réglez c = 0 : la recherche perd souvent', test: ({ v }) => v.c === 0 && mctsOf(v).outcome === 'weak' },
          { label: 'Trouvez une valeur de c trop grande : elle perd de nouveau', test: ({ v }) => v.c > 25 && !isSolid(v) },
          { label: 'Trouvez une valeur de c avec laquelle elle perd au plus 1 partie sur 100', test: ({ v }) => isSolid(v) },
        ],
        seq: true, conclusion: 'Sans exploration (c = 0), la recherche approfondit le premier coup qui a semblé bon et ne revoit pas les autres. Avec une exploration énorme (c = 100), elle répartit ses visites presque également et ne creuse plus les bons coups. Entre les deux, de 1,5 à 25, elle ne perd presque plus.',
      });
      c.exercise('mean', 'Dans l’atelier, calculez une moyenne de parties au hasard et un score.');
      c.exercise('score', 'Dans l’atelier, programmez le score PUCT.');
    });
    c.chapter('Plus de simulations, et une vérification', () => {
      // the experiment starts from 10 simulations: the curve grows as the learner raises them
      c.stage('tree', { sims: 10 });
      c.diagram('strength');
      c.step('Mesurer la force', `Pour juger une recherche, on la fait jouer ${MATCH_GAMES} parties contre le joueur parfait, la moitié avec X, la moitié avec O. Le mieux possible est le nul : le joueur parfait ne perd jamais. On compte les défaites, avec leur intervalle de confiance. Le schéma se remplit à mesure que vous augmentez le nombre de simulations par coup.`);
      c.experiment({
        title: 'Le nombre de simulations', prompt: `Partez de 10 simulations par coup et augmentez-les (c = ${fr(MCTS_NOMINAL.c)}). La scène montre l’arbre construit pour un coup.`,
        predict: { question: 'De 10 à 1 600 simulations par coup, contre le joueur parfait, la recherche…', choices: ['perd de moins en moins, sans jamais gagner', 'finit par gagner souvent', 'perd autant : le hasard domine'], answer: 0 },
        controls: [{ type: 'range', key: 'sims', label: 'simulations par coup', min: 1, max: 3200, step: 1, log: true, fmt: (x: number) => fr(x) }],
        goals: [
          { label: 'Trouvez un réglage où l’on est sûr qu’elle perd plus d’une partie sur cinq', test: ({ v }) => v.c === MCTS_NOMINAL.c && mctsOf(v).outcome === 'weak' },
          { label: 'Trouvez un réglage où elle perd au plus 1 partie sur 100', test: ({ v }) => v.c === MCTS_NOMINAL.c && isSolid(v) },
        ],
        seq: true, conclusion: 'Jusqu’à 50 simulations, elle perd souvent ; à partir de 1 600, au plus une partie sur 100. Entre les deux, les intervalles ne permettent pas de trancher. Elle ne gagne jamais : contre le joueur parfait, le mieux possible est le nul.',
      });
      c.step('La force grandit avec le calcul', () => `Sur ${MATCH_GAMES} parties : à 10 simulations par coup, la recherche en perd ${fr(M10().vsPerfect.losses)} ; à ${fr(MCTS_NOMINAL.sims)}, ${fr(MNOM().vsPerfect.losses)}, et l’intervalle de confiance va jusqu’à ${pct(MNOM().ci[1])}. Pourtant, chaque simulation s’appuie toujours sur une partie au hasard, dont on a vu le biais. Comment des estimations biaisées donnent-elles un bon coup ?`, {
        claims: [{ text: 'perd souvent à 10, presque jamais au nominal', check: () => M10().outcome === 'weak' && MNOM().outcome === 'solid' }],
      });
      c.diagram('qconverge');
      c.step('Le biais se corrige', () => `Le schéma suit la moyenne Q des coins et des bords. À ${fr(25)} simulations, les coins valent ${fr(answerMeans(25).corner, 2)} pour O, les bords ${fr(answerMeans(25).edge, 2)} : le biais des parties au hasard. Puis l’arbre développe, sous chaque coin, la réponse de X qui gagne ; ses défaites remontent, et à ${fr(MCTS_NOMINAL.sims)} simulations les coins tombent à ${fr(answerMeans(MCTS_NOMINAL.sims).corner, 2)}, sous les bords.`, {
        claims: [
          { text: 'à 25 simulations, les coins paraissent meilleurs', check: () => answerMeans(25).corner > answerMeans(25).edge },
          { text: 'au nominal, les coins passent sous les bords, graines 1 à 5', check: () => QSEEDS.every((s) => { const r = answerMeans(MCTS_NOMINAL.sims, s); return r.corner < r.edge - 0.2; }) },
        ],
      });
      c.step('Comme minimax, là où l’arbre creuse', 'Sous les coups visités souvent, l’arbre devient profond : leurs moyennes reposent alors sur les meilleures réponses trouvées plus bas, comme dans minimax, et de moins en moins sur des parties au hasard. Les coins ne valent pas encore −1, car leur moyenne garde la trace des premières visites ; mais le classement est juste, et c’est lui qui choisit le coup.');
      c.stage('tree');
      c.diagram('strength');
      c.step('Comment sait-on que c’est juste ?', `Les mêmes parties ont été jouées par OpenSpiel, la bibliothèque de DeepMind, avec la même règle : ce sont les cercles du schéma. Pour chacun des ${OPENSPIEL.bySims.length + OPENSPIEL.byC.length} réglages comparés, les deux intervalles se recouvrent. La comparaison a d’abord révélé un défaut de notre recherche : à égalité, elle préférait les premières cases. Il est corrigé.`, {
        claims: [{ text: 'accord avec OpenSpiel', check: () => model.checks.find((k) => k.name.startsWith('OpenSpiel (DeepMind) : défaites'))!.run() === null }],
      });
      c.exercise('backup', 'Dans l’atelier, programmez la rétropropagation.');
      c.exercise('assembly', 'Dans l’atelier, faites tourner ensemble votre score et votre rétropropagation.');
      c.explain('e-mcts', 'Expliquez pourquoi la recherche Monte-Carlo joue mieux avec plus de simulations, alors que chaque partie au hasard est une estimation biaisée.', 'Chaque simulation ajoute une feuille et remonte un résultat. Le score dirige les simulations suivantes vers les coups qui semblent bons, tout en réessayant les autres. Avec beaucoup de simulations, l’arbre devient profond sous les coups visités : sous le coin, il trouve la réponse de X qui gagne, et la moyenne du coin baisse. Les estimations reposent sur les meilleures réponses trouvées plus bas, comme dans minimax : le biais se corrige, le bruit diminue.');
    });

    // ================================================================ m2
    c.module('m2');
    c.chapter('Politique et valeur', () => {
      c.ask('q-missing', 'Qu’est-ce qui manquait à la recherche Monte-Carlo pour bien jouer au go ?', ['de bonnes estimations des coups et des positions', 'un ordinateur beaucoup plus rapide', 'des règles du jeu plus simples', 'un plateau plus petit'], 'Elle explorait encore trop de coups, et ses parties au hasard jugeaient mal les positions.');
      c.stage('net');
      c.step('Un réseau de neurones', 'Un réseau de neurones est une fonction à nombreux paramètres réglables. On lui donne un plateau, il calcule des nombres. On l’entraîne sur des exemples : on règle ses paramètres, petit à petit, pour réduire l’écart entre ce qu’il calcule et ce qu’il aurait dû calculer.');
      c.diagram('nets');
      c.step('Deux intuitions', 'AlphaZero en tire deux sorties. La politique donne, pour chaque coup, une probabilité d’être bon : elle remplace la confiance a priori P, et la recherche se concentre sur peu de coups. La valeur estime qui va gagner, entre −1 et +1 : elle remplace les parties au hasard. L’arbre devient moins large et moins profond.');
      c.question('q-prior', 'Dans une position où le centre est libre, la politique donne 0,9 au centre et 0,01 à chacune des autres cases. Au début de la recherche, quel coup reçoit le plus de visites ?', ['le centre : son bonus est bien plus grand', 'toutes les cases autant', 'une case au hasard', 'celui de meilleure valeur minimax'], 'Le bonus c·P·√N / (1 + n) est proportionnel à P : 90 fois plus grand pour le centre. Si le centre déçoit, sa moyenne Q baisse, et les autres coups finissent par être essayés.');
    });
    c.chapter('La descente de gradient', () => {
      // the scene shows the two-parameter network whose parameters the descent tunes
      c.stage('net', { small: 1 });
      c.ask('q-gd', 'Comment règle-t-on les nombreux paramètres d’un réseau de neurones ?', ['petit à petit, en suivant la pente de l’erreur', 'en essayant toutes les combinaisons possibles', 'à la main, un par un, par des experts', 'au hasard, en gardant le meilleur tirage'], 'On calcule dans quel sens chaque paramètre fait baisser l’erreur, et on le déplace un peu dans ce sens.');
      c.diagram('slope1d');
      c.step('Suivre la pente de l’erreur', 'La fonction de perte résume en un nombre l’erreur du réseau sur ses exemples. Le gradient donne, pour chaque paramètre, la pente de cette erreur. La descente de gradient recule chaque paramètre dans le sens où l’erreur diminue : paramètre ← paramètre − η × pente. Le nombre η est le taux d’apprentissage.', {
        tools: ['T4', 'T6'], code: 'w = w - eta * pente     // pente = dL/dw',
      });
      c.diagram('descent');
      c.step('Un réseau de valeur à deux paramètres', `Prenons un réseau minuscule, celui de la scène : v = a × x + b, où x compte les menaces du joueur qui doit jouer (deux symboles alignés et une case libre) moins celles de son adversaire. On l’entraîne sur les ${fr(NDATA)} positions non finies du morpion, avec leur valeur minimax. Le meilleur réglage est a ≈ ${fr(VBEST.a, 2)}, b ≈ ${fr(VBEST.b, 2)}.`, {
        claims: [{ text: 'la descente nominale atteint ce minimum', check: () => GD_NOM.outcome === 'converged' && Math.abs(GD_NOM.path[GD_NOM.path.length - 1].a - VBEST.a) < 0.02 }],
      });
      c.experiment({
        title: 'Le taux d’apprentissage', prompt: `Changez η et regardez les ${GD.steps} pas de la descente sur la carte de l’erreur ; la scène suit a et b, pas à pas.`,
        predict: { question: 'Avec un taux d’apprentissage trop grand, la descente…', choices: ['s’éloigne du minimum', 'arrive plus vite au minimum', 'reste au point de départ'], answer: 0 },
        controls: [{ type: 'range', key: 'eta', label: 'taux d’apprentissage η', min: 0.005, max: 1, step: 0.005, log: true, fmt: dec(3) }],
        goals: [
          { label: 'Trouvez un η trop petit : le minimum n’est pas atteint', test: ({ v }) => gdOf(v).outcome === 'slow' },
          { label: 'Trouvez un η trop grand : la descente diverge', test: ({ v }) => gdOf(v).outcome === 'diverged' },
          { label: 'Trouvez un η qui atteint le minimum', test: ({ v }) => gdOf(v).outcome === 'converged' },
        ],
        seq: true, conclusion: `Jusqu’à 0,05 environ, les pas sont trop petits : ${GD.steps} pas ne suffisent pas. De 0,1 à 0,65, la descente atteint le minimum ; vers 0,6, elle zigzague avant de s’y poser. À partir de 0,7, chaque pas dépasse le minimum de plus en plus loin : l’erreur explose.`,
      });
      c.exercise('gdStep', 'Dans l’atelier, calculez un pas de descente de gradient à la main.');
      c.question('q-eta', 'Une descente de gradient voit son erreur baisser, mais très lentement. Que changer ?', ['augmenter un peu le taux d’apprentissage', 'diminuer le taux d’apprentissage', 'changer le signe des pas', 'arrêter, le minimum est atteint'], 'Des pas trop petits avancent lentement ; il faut les agrandir, sans dépasser la limite où la descente diverge.');
    });
    c.chapter('Généraliser', () => {
      c.stage('net', { small: 1 });
      c.diagram('split');
      c.step('Des positions jamais vues', `Entraînons le petit réseau sur la moitié des positions seulement, ${fr(VS.nSeen)} tirées au hasard, puis mesurons son erreur sur les ${fr(VS.nUnseen)} autres. Elle est presque la même : ${fr(VS.linSeen, 2)} sur les positions vues, ${fr(VS.linUnseen, 2)} sur les autres. Ses deux paramètres servent pour toutes les positions : ce qu’il a appris des menaces vaut aussi ailleurs. C’est la généralisation.`, {
        claims: [{ text: 'presque la même erreur sur les positions jamais vues', check: () => VS.linUnseen < VS.linSeen * 1.15 || `${VS.linSeen} / ${VS.linUnseen}` }],
      });
      c.step('Une table ne généralise pas', `Une table qui range la valeur de chaque position vue ne se trompe jamais sur celles-là. Sur les autres, elle ne sait rien et ne peut répondre que la moyenne : erreur ${fr(VS.tableUnseen, 2)}, ${fr(VS.tableUnseen / VS.linUnseen, 1)} fois celle du réseau. Au morpion, on pourrait tout ranger ; au go, avec environ 10¹⁷⁰ positions, presque toutes seront nouvelles. Sans généralisation, AlphaGo serait impossible.`, {
        claims: [
          { text: 'la table se trompe bien plus sur les positions jamais vues', check: () => VS.tableUnseen > 1.5 * VS.linUnseen },
          { text: '10¹⁷⁰ positions de go', check: () => Math.round(FACTS.goLegalLog10) === 170 },
        ],
      });
      c.question('q-gen', 'Pourquoi le petit réseau se trompe-t-il presque autant sur les positions jamais vues que sur les autres ?', ['ses deux paramètres servent partout', 'il a retenu toutes les positions', 'les nouvelles positions sont faciles', 'il joue des parties au hasard'], 'Il n’a pas une réponse par position : la même formule, v = a × menaces + b, s’applique à toutes. Ce qu’il a appris sur les unes vaut pour les autres.');
      c.explain('e-gd', 'Expliquez comment un réseau de neurones apprend à partir d’exemples, et pourquoi il peut bien répondre sur des positions qu’il n’a jamais vues.', 'Une fonction de perte mesure l’écart entre ce que le réseau calcule et les cibles des exemples. La descente de gradient déplace chaque paramètre un peu dans le sens où cette erreur diminue, avec un pas réglé par le taux d’apprentissage. Les mêmes paramètres servent pour toutes les positions : en réduisant l’erreur sur beaucoup d’exemples, ils captent des régularités, comme compter les menaces, qui valent aussi pour des positions nouvelles. Une table, elle, n’a rien à dire d’une position qu’elle n’a pas vue.');
    });

    // ================================================================ m3
    c.module('m3');
    c.chapter('D’AlphaGo à AlphaZero', () => {
      c.stage('go');
      c.diagram('alphago');
      c.step('AlphaGo', `AlphaGo entraîne d’abord sa politique sur ${fr(FACTS.humanPositions)} millions de positions humaines : un apprentissage supervisé, où la bonne réponse est le coup de l’expert, retrouvé ${pct(FACTS.humanAccuracy)} du temps. Il joue ensuite contre lui-même, en auto-jeu, et renforce les coups des parties gagnées : un apprentissage par renforcement, guidé par une récompense, +1 ou −1.`);
      c.step('AlphaGo Zero et AlphaZero', `AlphaGo Zero part des seules règles, sans partie humaine. Après ${FACTS.zeroDays} jours et ${fr(FACTS.zeroGames, 1)} millions de parties d’auto-jeu, il bat ${FACTS.zeroVsLee} à 0 la version qui avait battu Lee Sedol. AlphaZero applique la même méthode aux échecs (${FACTS.azHours.chess} heures d’entraînement), au shogi (${FACTS.azHours.shogi} heures) et au go (${FACTS.azGoDays} jours).`);
    });
    c.chapter('La recherche améliore la politique', () => {
      c.stage('selfplay');
      c.diagram('loop');
      c.ask('q-self', 'Un programme qui ne joue que contre lui-même peut-il dépasser son niveau de départ ?', ['oui, sa recherche joue mieux que sa politique', 'non, il répète toujours ses erreurs', 'non, il lui faut un adversaire plus fort', 'oui, mais seulement au morpion'], 'La recherche, guidée par la politique, trouve de meilleurs coups qu’elle : la politique peut apprendre de la recherche.');
      c.step('La boucle d’AlphaZero', `À chaque coup d’une partie d’auto-jeu, le programme fait une recherche guidée par son réseau (${fr(FACTS.azSims)} simulations pour AlphaZero, ${fr(TRAIN.sims)} ici), puis joue. Chaque position de la partie donne deux cibles : la part des visites de chaque coup pour la politique, le résultat final pour la valeur. Le réseau s’en rapproche par descente de gradient.`);
      // the experiment starts at the first game: the curves are drawn up to the current game
      c.stage('selfplay', { games: 0 });
      c.diagram('learning');
      c.step('Deux joueurs à comparer', 'Pour suivre l’entraînement, on mesure deux joueurs sur un échantillon de positions : la politique seule, qui joue sa case la plus probable, et la recherche guidée par le réseau. La courbe orange donne la part de coups optimaux de la politique seule, la bleue celle de la recherche. Elles se dessinent à mesure que l’entraînement avance.');
      c.experiment({
        title: 'Au fil de l’auto-jeu', prompt: 'Avancez dans l’entraînement, par paquets de parties.',
        predict: { question: `À la fin des ${fr(TRAIN.games)} parties, la politique seule a-t-elle rattrapé la recherche ?`, choices: ['non, elle reste nettement en dessous', 'oui, elles se rejoignent', 'elle la dépasse, ayant tout appris'], answer: 0 },
        controls: [{ type: 'range', key: 'games', label: 'parties d’auto-jeu', min: 0, max: TRAIN.games, step: TRAIN.every, fmt: (x: number) => fr(x) }],
        goals: [
          { label: 'Trouvez un moment où la recherche ne perd plus que 5 % des parties ou moins', test: ({ v }) => checkpointAt(trainOf(v), v.games).searchLoss <= 0.05 },
          { label: 'Vérifiez qu’à la fin, la politique seule reste sous 80 % de bons coups', test: ({ v }) => v.games >= TRAIN.games && checkpointAt(trainOf(v), v.games).netAcc < 0.8 },
        ],
        seq: true, conclusion: 'La recherche choisit un bon coup plus de 9 fois sur 10 dès le début ; la politique seule monte, puis plafonne vers 70 %. Au fil des parties, la recherche finit par ne presque plus perdre. C’est l’écart entre les deux qui fait progresser le réseau : la politique apprend ce que la recherche a trouvé.',
      });
      c.step('Mesurer l’amélioration', () => `À la fin, la politique seule choisit un coup optimal ${pct(LAST().netAcc)} du temps ; guidée par la recherche, ${pct(LAST().searchAcc)}. Une erreur suffit pour perdre contre le joueur parfait : la politique seule perd ${pct(LAST().netLoss)} des parties, la recherche ${pct(LAST().searchLoss)}. En imitant sa recherche, la politique apprend de meilleurs coups qu’elle n’en proposait.`, {
        claims: [{ text: 'la recherche choisit nettement mieux, chaque graine', check: () => TRAIN_SEEDS.every((s) => { const cp = checkpointAt(trainOf({ tseed: s }), 1e9); return cp.searchAcc > cp.netAcc + 0.15; }) }],
      });
      c.exercise('targets', 'Dans l’atelier, calculez ce que le réseau apprend d’une partie.');
      c.order('q-loop', 'Remettez dans l’ordre ce qui se passe pour une partie d’auto-jeu.', ['une recherche à chaque coup, guidée par le réseau', 'le coup est joué selon les visites', 'la partie se termine sur un résultat', 'le réseau apprend les visites et le résultat'], 'La recherche choisit les coups ; à la fin, le résultat et les visites deviennent les exemples d’entraînement.');
    });
    c.chapter('Ce que le réseau a retenu', () => {
      c.stage('selfplay');
      c.diagram('generalize');
      c.step('Le réseau de notre AlphaZero', `Notre AlphaZero utilise un réseau plus grand que celui du module précédent : ${fr(18)} entrées (les cases de chaque joueur), une couche de ${fr(TRAIN.hidden)} neurones, une sortie de politique et une sortie de valeur. Chaque position d’une partie d’auto-jeu est apprise sous ses 8 rotations et symétries : en voir une, c’est en voir huit.`);
      c.step('Les positions jamais vues', () => `Après ${fr(LAST().games)} parties, le programme n’a rencontré que ${fr(LAST().known)} des ${fr(allPositions().length)} positions. Sur les autres, sa politique choisit pourtant un coup optimal ${pct(LAST().netUnseen)} du temps, contre ${pct(trainOf({}).unseenBase)} au hasard. Comme le petit réseau du module précédent, il a appris des régularités, comme « parer une menace », qui valent aussi ailleurs : il généralise.`, {
        claims: [{ text: 'mieux que le hasard sur les positions jamais vues, chaque graine', check: () => TRAIN_SEEDS.every((s) => { const r = trainOf({ tseed: s }); return checkpointAt(r, 1e9).netUnseen > r.unseenBase + 0.04; }) }],
      });
      c.step('La valeur généralise moins bien', () => `La politique dit quel coup jouer ; la valeur, qui juge les feuilles de la recherche, dit qui va gagner. Elle se trompe davantage sur les positions jamais rencontrées : erreur ${fr(LAST().vUnseen, 2)}, contre ${fr(LAST().vSeen, 2)} sur les autres, à chaque graine. Une recherche guidée par une valeur fausse peut choisir un mauvais coup.`, {
        claims: [{ text: 'la valeur se trompe davantage sur les positions jamais vues, chaque graine', check: () => TRAIN_SEEDS.every((s) => { const cp = checkpointAt(trainOf({ tseed: s }), 1e9); return cp.vUnseen > cp.vSeen + 0.03; }) }],
      });
      c.question('q-unseen', 'Le joueur parfait cherche une position où le programme se trompe. Où a-t-il le plus de chances d’en trouver ?', ['parmi celles que l’auto-jeu n’a jamais vues', 'parmi les plus fréquentes de l’auto-jeu', 'au tout premier coup de la partie', 'nulle part : le réseau ne se trompe plus'], 'Sur les positions que l’auto-jeu n’a jamais rencontrées, la valeur du réseau se trompe davantage, et c’est elle qui juge les feuilles de la recherche : c’est là que le joueur parfait peut piéger le programme. D’où l’intérêt de parties d’entraînement variées, l’objet du chapitre suivant.');
    });
    c.chapter('Explorer pendant l’entraînement', () => {
      c.stage('selfplay');
      c.diagram('generalize');
      c.step('Pourquoi varier les parties', 'Le réseau n’apprend que des positions que l’auto-jeu rencontre ; sur les autres, il devine, et sa valeur s’y trompe davantage. Sans hasard, le programme rejoue presque les mêmes parties et ne voit qu’une partie du jeu. Le joueur parfait, lui, l’emmène ailleurs, là où il se trompe. Varier les parties d’entraînement, c’est explorer, comme le bonus de PUCT, mais à l’échelle des parties.');
      c.step('Le bruit à la racine', `À la racine de chaque recherche, AlphaZero mélange les probabilités de la politique avec un tirage au hasard, le bruit de Dirichlet : ici ${pct(TRAIN.noise)} de hasard. La recherche essaie ainsi des coups que la politique néglige encore. Ce bruit ne sert qu’à l’entraînement : en match, la recherche n’en ajoute pas.`);
      c.step('La température', `La recherche donne des visites ; il reste à choisir le coup joué. Pendant l’entraînement, les ${fr(TRAIN.temp)} premiers coups de chaque partie sont tirés au hasard, en proportion des visites : un coup qui a reçu 30 % des visites est joué 30 % du temps. Les suivants sont le plus visité. Deux parties divergent ainsi dès l’ouverture.`);
      c.diagram('explore');
      c.step('Plusieurs graines', `Un entraînement dépend du hasard de ses tirages, fixé par une graine. Un réglage peut réussir avec une graine et échouer avec une autre : chaque réglage est donc entraîné avec ${TRAIN_SEEDS.length} graines, et le schéma montre les ${TRAIN_SEEDS.length} courbes. Au réglage nominal, au moins quatre graines sur cinq finissent sous 5 % de défaites ; on ne conclut que sur ce qui tient pour la plupart d’entre elles.`, {
        claims: [{ text: 'au moins 4 graines sur 5', check: () => TRAIN_SEEDS.filter((s) => trainOf({ tseed: s }).outcome === 'unbeatable').length >= 4 }],
      });
      c.experiment({
        title: 'Le bruit à la racine', prompt: 'Retirez ou remettez le bruit à la racine ; la température reste celle du réglage nominal. Le schéma entraîne les cinq graines (patientez quelques secondes).',
        predict: { question: 'Sans bruit à la racine, sur cinq graines, le programme…', choices: ['reste battable pour la plupart des graines', 'ne perd plus, comme au réglage nominal', 'ne progresse plus du tout'], answer: 0 },
        controls: [{ type: 'choice', key: 'noise', label: 'bruit à la racine', options: NOISE_OPTS }],
        goals: [
          { label: 'Trouvez le réglage où la graine 1 perd encore plus de 5 % des parties', test: ({ v }) => finalLoss(v) > 0.05 },
          { label: 'Trouvez le réglage où elle perd moins de 5 % des parties', test: ({ v }) => finalLoss(v) < 0.05 },
        ],
        seq: true, conclusion: 'Sans bruit, au plus deux graines sur cinq finissent sous 5 % de défaites ; avec, au moins quatre. Le bruit fait essayer, à la racine, des coups que la politique néglige : les parties d’entraînement couvrent plus de positions, et le joueur parfait y trouve moins de pièges.',
      });
      c.explain('e-search', 'Expliquez pourquoi l’entraînement d’AlphaZero fait une recherche à chaque coup, au lieu de faire jouer directement le réseau contre lui-même.', 'La recherche, guidée par la politique et la valeur, joue mieux que la politique seule : elle vérifie les coups proposés et en corrige certains. La part des visites qu’elle produit sert de cible à la politique, qui apprend donc à jouer comme la recherche. Le réseau s’améliore, ce qui améliore la recherche suivante. Sans recherche, la politique n’aurait pas de meilleur exemple qu’elle-même.');
    });
    c.clinicCase({
      id: 'clin-temp', title: 'un programme dont les parties se ressemblent', scene: 'selfplay', fault: { temp: 0 },
      observe: `Après ${fr(TRAIN.games)} parties d’auto-jeu, le programme perd encore bien plus de 5 % des parties contre le joueur parfait. Ses parties d’entraînement se ressemblent : environ deux fois moins de parties différentes que d’habitude. Toutes les graines donnent le même tableau.`,
      choices: ['aucun coup tiré au hasard', 'trop peu de bruit à la racine', 'trop peu de parties jouées'],
      explain: 'Le programme joue toujours le coup le plus visité : à bruit égal, ses parties explorent bien moins de positions. Sans bruit, au contraire, certaines graines s’en sortaient encore, et les parties restaient presque aussi variées.',
      diagram: { name: 'explore', arg: 'case' },
      controls: [
        { type: 'choice', key: 'temp', label: 'coups tirés au hasard', options: TEMP_OPTS },
        { type: 'choice', key: 'noise', label: 'bruit à la racine', options: NOISE_OPTS },
      ],
      goal: { label: 'La graine 1 perd moins de 5 % des parties', test: (v) => finalLoss(v) < 0.05 },
      conclusion: 'En tirant les premiers coups selon leurs visites, les parties varient ; le réseau rencontre bien plus de positions, et la recherche ne perd presque plus.',
      justify: 'Le symptôme : des parties d’entraînement très semblables et un programme qui perd encore, à chaque graine. La cause : aucun coup tiré au hasard, le programme jouant toujours le plus visité. Le bruit à la racine ne suffit pas à varier les parties ; le réseau ne rencontre qu’une partie des positions, et le joueur parfait l’emmène ailleurs. Avec la température, les parties explorent davantage.',
    });

    // ================================================================ m4
    c.module('m4');
    c.chapter('Le plateau NIST', () => {
      c.stage('robot');
      c.step('Un banc d’essai pour robots', `Le NIST, un institut américain de mesure, propose des plateaux d’assemblage pour comparer les robots : insérer des tiges, visser des écrous, monter des engrenages. Certaines pièces mesurent ${FACTS.nistSmallMm} mm. AlphaNIST y applique la philosophie d’AlphaZero : une seule politique, entraînée en simulation sur ${FACTS.nistTasks} assemblages, sans démonstration humaine. Ses résultats viennent d’une page de projet, sans article ni auteurs publiés.`);
      c.diagram('chain', { arg: '0' });
      c.step('Notre robot', `Notre robot visse un écrou en cinq sous-étapes : ${STEPS.join(', ')}. Un épisode réussit si toutes réussissent : le succès est un produit. Il existe ${VARIANTS.length} variantes de pièce, de la ${VARIANTS[0].name} à une ${VARIANTS[3].name}, impossible. Le cours suit la ${VARIANTS[MAIN].name} : au départ, la tâche complète réussit ${fr(Q0_FULL * 1e6, 1)} fois sur un million.`, {
        claims: [{ text: 'tâche complète presque impossible au départ', check: () => Q0_FULL < 1e-4 }],
      });
      c.step('Comment le robot apprend', 'Le robot joue des épisodes avec sa politique, qui donne une probabilité à chaque geste. Après un lot d’épisodes, chaque geste d’un épisode meilleur que prévu devient un peu plus probable ; celui d’un épisode moins bon, un peu moins. C’est encore une descente de gradient, sur les probabilités des gestes, guidée par la récompense : un apprentissage par renforcement.');
      c.question('q-chain', 'Pour que la tâche complète réussisse une fois sur deux, chaque sous-étape doit réussir environ…', [`${pct(FIFTH)} du temps`, '50 % du temps', '20 % du temps', '99 % du temps'], `${fr(FIFTH, 2)}⁵ ≈ 0,5 : il faut ${pct(FIFTH)} par sous-étape. Avec 50 % par sous-étape, la tâche complète ne réussirait que ${pct1(0.5 ** STEPS.length)} du temps.`);
      c.exercise('chainCalc', 'Dans l’atelier, calculez le succès d’une chaîne de sous-étapes.');
    });
    c.chapter('Une récompense rare', () => {
      c.stage('robot');
      c.diagram('chain', { arg: '0' });
      c.ask('q-start', 'Avec une récompense binaire, si le robot part toujours des pièces détachées…', ['il n’apprend rien', 'il apprend lentement mais sûrement', 'il apprend le plus vite possible', 'il apprend surtout les dernières étapes'], 'Il ne réussit jamais : tous les épisodes reçoivent 0, rien ne distingue un bon essai d’un mauvais.');
      c.step('Un signal qui manque', 'Avec une récompense binaire, 1 si l’écrou est vissé et 0 sinon, un épisode raté vaut 0. Si tous les épisodes partis d’une configuration ratent, aucun n’est meilleur que prévu : aucun geste ne change de probabilité. Le robot n’apprend que de l’écart entre des épisodes réussis et ratés ; il lui en faut des deux sortes, donc une issue incertaine.');
      c.diagram('pvar');
      c.step('La variance P(1 − P)', 'Cet écart se mesure par la variance de la récompense. Pour une récompense binaire de taux de succès P, elle vaut P(1 − P) : nulle à P = 0 et à P = 1, quand tous les épisodes se ressemblent, et maximale à P = 0,5. Sur le schéma, la variance mesurée depuis chaque état de départ suit la courbe.', {
        tools: ['P1'],
        claims: [{ text: 'variance mesurée ≈ P(1 − P)', check: () => VAR().rewardVar.every((x, i) => Math.abs(x - VAR().rewardP[i]) < 0.02) }],
      });
      c.diagram('curriculum');
      c.experiment({
        title: 'Où commencer les épisodes', prompt: 'Choisissez comment les configurations de départ sont tirées. Le schéma montre quatre entraînements (quatre graines).',
        predict: { question: 'Avec un tirage uniforme des configurations de départ, le robot…', choices: ['apprend, mais lentement', 'n’apprend rien du tout', 'apprend le plus vite possible'], answer: 0 },
        controls: [{ type: 'choice', key: 'sampler', label: 'configurations de départ', options: [{ label: 'tâche complète seule', value: 2 }, { label: 'uniforme', value: 0 }, { label: 'guidé par le succès', value: 1 }] }],
        goals: [
          { label: 'Trouvez un tirage qui progresse, mais trop lentement', test: ({ v }) => rs(v).outcome === 'slow' },
          { label: 'Trouvez un tirage qui maîtrise la tâche, pour chaque graine', test: ({ v }) => rs(v).counts.mastered === rs(v).runs.length },
        ],
        seq: true, conclusion: `Le tirage uniforme apprend, mais dépense un quart des épisodes sur la pièce défectueuse et beaucoup sur des configurations déjà maîtrisées, à l’issue certaine. Le tirage guidé par le succès maîtrise la petite pièce en ${fr(masteredAt(R_NOM))} épisodes environ (médiane des graines), contre ${fr(masteredAt(R_UNI))} et plus pour l’uniforme. Sans départ plus facile, aucun succès : aucun signal.`,
      });
      c.diagram('sgs');
      c.step('Le poids de SGS', `SGS donne à chaque configuration un poids qui dépend de son taux de succès récent p : (p + ε)^(κt) · (1 − p + ε)^(κ(1−t)). Cette courbe, tracée sur le schéma, culmine à la cible t ; avec les réglages de l’article (t = ${fr(ROBOT.target, 1)}, κ = ${fr(ROBOT.conc)}), au sommet de P(1 − P). Les configurations sont tirées selon ces poids, adoucis par une température ${fr(ROBOT.temp)}.`, {
        tools: ['S1'],
      });
      c.step('Ce que SGS favorise', `Une configuration réussie une fois sur deux reçoit le poids maximal. Une configuration jamais réussie, ou toujours réussie, en garde ${pct(sgsWeight(0))} : le plancher ε, minuscule, et la température empêchent d’en abandonner une complètement. Les épisodes vont surtout là où ils apprennent quelque chose, sans perdre de vue le reste.`, {
        claims: [{ text: 'environ 14 % pour une configuration jamais réussie ou toujours réussie', check: () => (near(sgsWeight(0), 0.14, 0.1) && near(sgsWeight(1), sgsWeight(0), 0.05)) || `${pct(sgsWeight(0))} / ${pct(sgsWeight(1))}` }],
      });
      c.diagram('curriculum');
      c.experiment({
        title: 'La cible de SGS', prompt: 'Changez le taux de succès que SGS favorise, jusqu’à 0,6.',
        predict: { question: 'Si SGS vise les configurations réussies 20 % du temps au lieu de 50 %, le robot…', choices: ['maîtrise aussi la tâche', 'reste bloqué au départ', 'apprend deux fois plus vite'], answer: 0 },
        controls: [{ type: 'range', key: 'target', label: 'cible t', min: 0.05, max: 0.6, step: 0.05, fmt: pct }],
        goals: [
          { label: 'Trouvez une cible de 0,2 ou moins avec laquelle chaque graine maîtrise la tâche', test: ({ v }) => v.target <= 0.2 + 1e-9 && rs(v).counts.mastered === rs(v).runs.length },
          { label: 'Trouvez une autre cible, au-dessus de 0,2, avec le même résultat', test: ({ v }) => v.target > 0.2 + 1e-9 && rs(v).counts.mastered === rs(v).runs.length },
        ],
        seq: true, conclusion: 'De 0,1 à 0,5, chaque graine maîtrise la tâche : comme l’écrit l’article, SGS est peu sensible à ce réglage tant qu’il reste raisonnable. L’essentiel est de ne pas dépenser les épisodes sur des configurations dont l’issue est certaine.',
      });
      c.exercise('sgsSort', 'Dans l’atelier, dites quelles configurations SGS favorise.');
    });
    c.chapter('Façonner la récompense', () => {
      c.stage('robot');
      c.ask('q-telescope', 'Un robot reçoit +1 chaque fois qu’il se rapproche du but d’un cran, −1 chaque fois qu’il s’en éloigne d’un cran. Après des détours, un épisode le ramène à son point de départ. Combien a-t-il gagné en tout ?', ['0 : les + et les − s’annulent', 'un point par rapprochement', 'un point par pas de temps', 'cela dépend des détours'], 'Chaque cran gagné puis reperdu donne +1 puis −1. Revenu au départ, il a perdu autant de crans qu’il en a gagnés : 0, quel que soit le chemin.');
      c.diagram('detour', { arg: `${DET_W}b` });
      c.step('Le détour utile', `Pour bien orienter l’écrou, il vaut mieux le reposer et le reprendre : deux pas de plus, pendant lesquels sa progression recule (courbe verte). Un écrou forcé arrive aussi vite près du boulon, mais se coince à l’insertion : il ne passe que ${pct(ROBOT.cap)} du temps (courbe rouge). Avec le succès seul pour récompense, le détour rapporte ${fr(DET.value.binary[0], 1)} en moyenne, l’écrou forcé ${fr(DET.value.binary[1], 1)}.`);
      c.diagram('detour', { arg: `${DET_W}n` });
      c.step('Des points pour être près du but', `AlphaNIST a essayé des récompenses pour l’approche et l’alignement. Imitons-les : à chaque pas, des points proportionnels à la progression, de poids w. L’écrou forcé reste longtemps près du but et en accumule ; le détour en perd pendant deux pas. Avec w = ${DET_W}, forcer rapporte en moyenne ${fr(DET.value.naive[1], 2)}, le détour ${fr(DET.value.naive[0], 2)} : le robot apprend ce qu’on récompense, pas ce qu’on veut.`, {
        claims: [{ text: `w = ${DET_W} : forcer rapporte plus que le détour`, check: () => DET.value.naive[1] > DET.value.naive[0] }],
      });
      c.diagram('detour', { arg: `${DET_W}p` });
      c.step('Le façonnage par potentiel', 'Il existe une récompense intermédiaire sans ce défaut. Donnons à chaque état un potentiel Φ, ici la progression, et à chaque pas w × (Φ(état suivant) − Φ(état)). À la fin de l’épisode, le potentiel retombe à 0. Comme dans la question du début, gains et pertes s’annulent : sur l’épisode, leur somme vaut w × (0 − Φ(départ)), la même quelle que soit la manière de faire.');
      c.step('Seul le succès départage', `Sur le schéma, le détour gagne en progressant, perd en reposant l’écrou, et rend tout au dernier pas : sa récompense intermédiaire totale est nulle, comme celle de l’écrou forcé, puisque les deux partent des pièces détachées. Restent les gains du succès : ${fr(DET.value.potential[0], 2)} contre ${fr(DET.value.potential[1], 2)}. La meilleure politique ne change pas, quel que soit w (Ng, Harada et Russell, 1999).`, {
        claims: [{ text: 'par potentiel, chaque manière rapporte ce que rapporte son succès, quel que soit w', check: () => [1, 2, 4, 6].every((w) => { const d = detourOf(w); return d.value.potential.every((x, i) => Math.abs(x - d.value.binary[i]) < 1e-9); }) }],
      });
      c.diagram('rewards');
      c.experiment({
        title: 'Deux récompenses intermédiaires', prompt: 'Choisissez la récompense intermédiaire et son poids w. Le point blanc donne le succès médian des quatre graines ; le pointillé, la récompense binaire seule.',
        predict: { question: 'Avec les points pour être près du but, à partir de quel poids w le robot se met-il à forcer l’écrou ?', choices: ['vers w = 3', 'dès w = 0,5', 'jamais, quel que soit w'], answer: 0 },
        controls: [
          { type: 'choice', key: 'reward', label: 'récompense intermédiaire', options: [{ label: 'points pour être près du but', value: 1 }, { label: 'façonnage par potentiel', value: 2 }] },
          { type: 'range', key: 'w', label: 'poids w', min: 0, max: 6, step: 0.5, fmt: dec(1) },
        ],
        goals: [
          { label: 'Avec les points pour être près du but, trouvez un poids qui fait forcer l’écrou', test: ({ v }) => v.reward === 1 && rs(v).outcome === 'capped' },
          { label: 'Au même poids, passez au façonnage par potentiel : la tâche est maîtrisée', test: ({ v }) => v.reward === 2 && v.w >= 3 && rs(v).outcome === 'mastered' },
        ],
        seq: true, conclusion: 'À partir de w = 3, les points pour être près du but font forcer l’écrou à chaque graine : 40 % de succès, comme le calcul du détour le laissait prévoir. Le façonnage par potentiel, même à w = 6, laisse le robot apprendre le détour.',
      });
      c.diagram('nist');
      c.step('Ce qu’AlphaNIST a mesuré', `Avec une politique partagée et la récompense binaire, AlphaNIST réussit ${pct1(FACTS.nist.sharedBinary)} des assemblages à l’entraînement ; en ajoutant des récompenses pour l’approche et l’alignement, ${pct1(FACTS.nist.sharedDense)}. Notre miniature reproduit le sens de l’effet et en propose un mécanisme ; elle ne prouve pas que c’est celui d’AlphaNIST.`);
      c.question('q-shape', 'Un robot reçoit, à chaque pas, w × (Φ(état suivant) − Φ(état)), avec cette fois Φ = moins la distance au but ; Φ retombe à 0 à la fin. Ce façonnage change-t-il la meilleure politique ?', ['non, quel que soit le potentiel', 'oui, il fera forcer l’écrou', 'oui, il interdira le détour', 'non, mais seulement si w est petit'], 'La somme des différences vaut w × (0 − Φ(départ)), quel que soit Φ : elle ne dépend pas de la manière de faire. Le choix de Φ peut accélérer ou ralentir l’apprentissage, pas changer la meilleure politique.');
    });
    c.chapter('Le hasard des épisodes', () => {
      c.stage('robot');
      c.diagram('credit');
      c.step('Qui a fait échouer l’essai ?', 'Un épisode raté ne dit pas quelle action a causé l’échec : c’est le problème de l’attribution du mérite. La mise à jour rend moins probables toutes les actions de l’épisode, même celles qui avaient réussi. Seule la moyenne de nombreux épisodes sépare les bonnes actions des mauvaises : le gradient d’un seul épisode est très bruité.');
      c.diagram('variance');
      c.step('Une base de référence', () => `On ne crédite donc pas un geste de tout ce qui a suivi, mais de l’écart à ce qu’on attendait en partant de là : la base de référence. Parti près du but, où il réussit 8 fois sur 10, un succès ne vaut que +0,2 ; parti de loin, un succès inattendu vaut près de +1. Mesurée sur ${fr(20000)} épisodes, la variance du gradient baisse de ${pct(1 - VAR().baseline / VAR().plain)}.`, {
        claims: [{ text: 'la base réduit la variance', check: () => VAR().baseline < 0.85 * VAR().plain }],
      });
      c.step('La même direction, moins de hasard', 'La base ne dépend pas du geste choisi : retirée à tous les épisodes partis du même endroit, elle n’en favorise aucun. La direction moyenne du gradient reste la même ; seul le hasard d’un épisode à l’autre diminue. Le façonnage par potentiel fait de même : le retour à venir d’un geste reçoit −w × Φ(état), une attente qui ne dépend que de l’état. Bien dosé, il réduit aussi la variance.', {
        claims: [{ text: 'le potentiel bien dosé réduit la variance, trop fort moins', check: () => VAR().shaped[1] < VAR().plain && VAR().shaped[1] < VAR().shaped[2] }],
      });
      // the experiment starts from steps and batches it offers, where every seed succeeds
      c.stage('robot', { lr: 16, batch: 16 });
      c.diagram('seeds');
      c.step('Huit graines, un réglage', 'Pour voir le hasard des épisodes, on entraîne le robot huit fois avec le même réglage, chacune avec sa graine, en tirant les configurations de départ au hasard. Sur le schéma, chaque courbe donne le succès de la tâche complète au fil des épisodes ; elle est rouge quand l’entraînement ne la maîtrise pas.');
      c.experiment({
        title: 'Grands pas, petits lots', prompt: 'Changez la taille des pas, le nombre d’épisodes par lot et la base de référence. La taille des pas joue le rôle du taux d’apprentissage η du module 2. Le schéma montre huit entraînements (huit graines).',
        predict: { question: 'Avec de très grands pas et des lots de 4 épisodes, les huit entraînements…', choices: ['ne finissent pas tous au même endroit', 'réussissent tous plus vite', 'restent tous bloqués'], answer: 0 },
        controls: [
          { type: 'choice', key: 'lr', label: 'taille des pas', options: [16, 64, 256].map((x) => ({ label: fr(x), value: x })) },
          { type: 'choice', key: 'batch', label: 'épisodes par lot', options: [4, 16].map((x) => ({ label: fr(x), value: x })) },
          { type: 'toggle', key: 'baseline', label: 'base de référence', on: 1, off: 0 },
        ],
        goals: [
          { label: 'Trouvez un réglage où au moins deux graines sur huit plafonnent', test: ({ v }) => 8 - (rs({ ...v, sampler: 0, nseeds: 8 }).counts.mastered ?? 0) >= 2 },
          { label: 'Gardez des lots de 4 et trouvez un réglage où les huit graines réussissent', test: ({ v }) => v.batch === 4 && rs({ ...v, sampler: 0, nseeds: 8 }).counts.mastered === 8 },
        ],
        seq: true, conclusion: 'Avec des pas de 256 et des lots de 4, plusieurs graines cessent pour toujours de reposer l’écrou. Avec des pas de 64, la base de référence suffit à l’éviter ; des lots plus grands aussi. Comme un η trop grand, de grands pas apprennent vite, mais un lot malchanceux peut tout faire basculer.',
      });
      c.step('L’effondrement', 'Pourquoi plafonner pour toujours ? Un lot d’épisodes malchanceux, avec de grands pas, rend le geste « reposer l’écrou » presque impossible. Le robot ne l’essaie plus ; il ne peut donc plus découvrir qu’il était utile. En renforcement, la politique fabrique ses propres exemples : une mauvaise mise à jour peut supprimer ceux qui l’auraient corrigée. D’où les méthodes, comme PPO, qui limitent chaque mise à jour.');
      c.step('Même symptôme, deux causes', 'Un robot qui force l’écrou peut venir d’une récompense mal posée ou d’un effondrement. Plusieurs graines permettent de trancher : une récompense mal posée trompe toutes les graines de la même manière ; un effondrement n’en frappe que certaines, au hasard de leurs lots.');
      c.exercise('rlSort', 'Dans l’atelier, reconnaissez la difficulté derrière chaque observation.');
      c.explain('e-collapse', 'Expliquez pourquoi, en apprentissage par renforcement, une mise à jour trop grande peut bloquer définitivement l’apprentissage, et comment le vérifier.', 'La politique produit elle-même les épisodes dont elle apprend. Une mise à jour trop grande, tirée d’un lot malchanceux, peut rendre une action utile presque impossible. Ensuite, le robot ne l’essaie plus : aucun épisode ne montre qu’elle était bonne, et rien ne la ramène. Pour le vérifier, on relance avec plusieurs graines : l’effondrement n’en frappe que certaines, alors qu’une récompense mal posée les tromperait toutes.');
    });
    c.chapter('Ce qui émerge, et les limites', () => {
      c.stage('robot');
      c.step('Des gestes que personne n’a programmés', 'La politique d’AlphaNIST trouve des comportements émergents : elle repose une pièce et la reprend pour mieux l’orienter, se sert du plateau pour faire tourner un connecteur, fait rouler un écrou posé sur sa tranche, pousse une tige du bout d’un doigt avant de la saisir. Avec une récompense binaire, seul le résultat compte : tout geste qui y mène peut être renforcé.');
      c.step('Les limites', `Les résultats d’AlphaNIST sont mesurés en simulation, sur les tâches d’entraînement : l’écart simulation-réalité reste à franchir, et la page du projet ne donne ni article ni auteurs. Pour des enchaînements de dix pièces, elle rapporte ${FACTS.nistTenParts} essais réussis. Notre miniature est un jouet : cinq sous-étapes, sans physique ni capteurs.`);
      c.question('q-emerge', 'Avec une récompense binaire, une politique se met à faire rouler l’écrou au lieu de le saisir, et réussit plus souvent ainsi. Que fait l’apprentissage de ce geste ?', ['il le renforce : il mène au succès', 'il le corrige : ce n’est pas prévu', 'il l’ignore : il n’est pas payé', 'il l’interdit : il est trop risqué'], 'Seul le résultat compte : tout geste qui mène plus souvent au succès devient plus probable, même si personne ne l’avait imaginé. C’est ainsi qu’apparaissent des comportements émergents.');
    });
    c.clinicCase({
      id: 'clin-target', title: 'un entraînement qui réussit presque tout, sauf la tâche', scene: 'robot', fault: { target: 0.95 },
      observe: () => `Le tableau de bord affiche ${pct(robotSeeds({ target: 0.95 }).runs[0].final.train)} d’épisodes réussis. Pourtant, en partant des pièces détachées, le robot ne visse la petite pièce que ${pct(robotSeeds({ target: 0.95 }).runs[0].final.P[4])} du temps. Les quatre graines donnent le même tableau.`,
      choices: ['la cible de SGS, beaucoup trop haute', 'des points pour être près du but', 'des pas trop grands pour ces lots'],
      explain: 'SGS favorise les configurations réussies 95 % du temps : presque tous les épisodes partent de configurations déjà maîtrisées, dont l’issue est certaine.',
      diagram: 'curriculum',
      controls: [
        { type: 'range', key: 'target', label: 'cible de SGS', min: 0.05, max: 0.95, step: 0.05, fmt: pct },
        { type: 'range', key: 'w', label: 'poids des points de proximité', min: 0, max: 6, step: 0.5, fmt: dec(1) },
      ],
      goal: { label: 'Chaque graine maîtrise la tâche', test: (v) => robotSeeds(v).counts.mastered === robotSeeds(v).runs.length },
      conclusion: 'Avec une cible autour de 0,5, les épisodes vont aux configurations dont l’issue est incertaine, et la compétence remonte jusqu’aux pièces détachées.',
      justify: 'Le symptôme : presque tous les épisodes réussissent, mais la tâche complète échoue, à chaque graine. La cause : une cible de SGS trop haute, qui tire surtout des configurations déjà maîtrisées. Leur issue est certaine : leur récompense ne varie pas, et la variance P(1 − P) est presque nulle, donc ces épisodes n’apprennent presque rien. Avec une cible vers 0,5, on tire les configurations incertaines.',
    });

    // ============================================================== exam
    c.module('exam');
    c.clinicCase({
      id: 'exam-dense', exam: true, title: 'un écrou qui se coince de travers', scene: 'robot', fault: { reward: 1, w: 4 },
      observe: () => `Le robot amène l’écrou et l’aligne parfaitement, mais l’écrou se coince à l’insertion : il ne réussit que ${pct(robotSeeds({ reward: 1, w: 4 }).runs[0].final.P[4])} du temps, et ne repose jamais l’écrou pour le reprendre. Relancé avec trois autres graines, il fait exactement pareil.`,
      choices: ['des points trop forts pour être près du but', 'un effondrement dû à de trop grands pas', 'la cible de SGS, trop haute'],
      explain: 'Toutes les graines plafonnent de la même manière : ce n’est pas un accident de lot, c’est la récompense qui fait préférer l’écrou coincé.',
      diagram: { name: 'rewards', arg: 'case' },
      controls: [
        { type: 'choice', key: 'reward', label: 'récompense intermédiaire', options: [{ label: 'points pour être près du but', value: 1 }, { label: 'façonnage par potentiel', value: 2 }] },
        { type: 'range', key: 'w', label: 'poids w', min: 0, max: 6, step: 0.5, fmt: dec(1) },
        { type: 'choice', key: 'lr', label: 'taille des pas', options: [2, 16, 64].map((x) => ({ label: fr(x), value: x })) },
      ],
      goal: { label: 'Chaque graine maîtrise la tâche', test: (v) => robotSeeds(v).counts.mastered === robotSeeds(v).runs.length },
      conclusion: 'Avec un poids faible, ou avec le façonnage par potentiel, le détour par la reprise de l’écrou redevient payant, et le robot l’apprend.',
      justify: 'Le symptôme : l’écrou est forcé et se coince, à chaque graine. La cause : des points trop forts pour être près du but. L’écrou forcé, coincé près du boulon, accumule ces points ; reposer l’écrou en coûte. Un effondrement ne frapperait que certaines graines. Avec un poids faible, ou un façonnage par potentiel dont la somme ne dépend que du départ, seul le succès compte et le détour est appris.',
    });
    c.chapter('Test final', () => {
      c.stage('go');
      c.step('Le test final', 'Ce test reprend les notions du test de départ, dans d’autres situations. Comparez ensuite vos deux résultats, notion par notion.');
      c.test('post', 'Le test final.');
    });
  },
});

