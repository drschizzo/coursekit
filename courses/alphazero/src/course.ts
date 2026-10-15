// AlphaGo, AlphaZero et AlphaNIST : how a program learns, alone, to play
// better than champions, and how the same idea teaches a robot to assemble
// parts. The course builds miniatures of each step: tic-tac-toe and minimax,
// Monte-Carlo tree search with the PUCT rule, a self-play loop with two tables
// in place of the networks, and an assembly chain trained with a binary or a
// dense reward from start states chosen by success-guided sampling. The
// figures of the text, the diagrams, the stage and the exercises all run
// ./model.ts; the published results are quoted from FACTS.

import { choice, dec, defineCourse, fr, numeric, pct, type Capsule } from '@coursekit/core';
import { choiceQ, type Exercise, type WorkshopConfig } from '@coursekit/exercises';
import { CELL, DIAGRAMS, pow10 } from './diagrams.ts';
import {
  EMPTY, FACTS, FORK, MCTS_NOMINAL, MCTS_OUTCOME, ROBOT, STEPS, TRAIN, bestMoves, checkpointAt,
  countTree, legal, mctsOf, minimax, model, play, playoutCounts, playoutRun, robotOf, rolloutEval, scoreRef, search, sgsWeight,
  stepProb, successByLevel, trainOf, treeLog10, type BackupFn, type ScoreFn,
} from './model.ts';

const near = (a: number, b: number, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel;
/** A percentage with one decimal. */
const pct1 = (x: number) => `${fr(x * 100, 1)} %`;

const T = countTree();
const CORNER = 2, EDGE = 1;
const MEAN = (m: number) => playoutRun(FORK, m, 2000)[1999];
const CHESS = treeLog10(FACTS.chessBranching, FACTS.chessDepth);
const GO = treeLog10(FACTS.goBranching, FACTS.goDepth);
/** Games a machine checking a billion games a second would have seen since the Big Bang, as a power of ten. */
const SINCE_BIG_BANG = Math.log10(1e9 * FACTS.universeYears * 365.25 * 24 * 3600);
const M10 = mctsOf({ sims: 10 });
const MNOM = mctsOf({});
const RUN = trainOf({});
const LAST = RUN.checkpoints[RUN.checkpoints.length - 1];
const Q0_FULL = ROBOT.q0 ** STEPS.length;

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
  ctx.fillStyle = '#e6eaf5'; ctx.textAlign = 'left';
  ctx.fillText('visites depuis la position du cours (200 simulations)', 20, 18);
  ctx.fillStyle = '#ffb35c'; ctx.fillText('votre fonction', 20, 34);
  ctx.fillStyle = '#7c9cff'; ctx.fillText('référence', 120, 34);
  if (!got) { ctx.fillStyle = '#ff6b7a'; ctx.fillText(mine ? 'votre fonction lève une erreur' : 'écrivez votre fonction', 20, 54); }
  ms.forEach((m, i) => {
    const x = 30 + i * 52, base = 200, H = 130;
    ctx.fillStyle = 'rgba(124,156,255,.55)'; ctx.fillRect(x, base - (ref[m] / top) * H, 18, (ref[m] / top) * H);
    if (got) { const g = Math.max(0, Math.min(top, got[m] || 0)); ctx.fillStyle = '#ffb35c'; ctx.fillRect(x + 20, base - (g / top) * H, 18, (g / top) * H); }
    ctx.fillStyle = 'rgba(230,234,245,.6)'; ctx.textAlign = 'center'; ctx.fillText(`${CELL[m]} ${m + 1}`, x + 19, base + 14);
  });
  ctx.textAlign = 'left';
}

const C100 = playoutCounts(FORK, CORNER, 100);
const SC = { Q: 0.25, P: 1 / 6, N: 36, n: 4, c: 1.5 };
const SGS_ITEMS = [0, 0.02, 0.3, 0.5, 0.7, 0.98, 1];
const SGS_ON = (s: number) => sgsWeight(s, ROBOT.target, ROBOT.conc, ROBOT.floor) >= 0.5;
const Q9 = [0.9, 0.9, 0.9, 0.9, 0.9];

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
    id: 'goTree', module: 'm1', kind: 'calculation', title: 'La taille des arbres des échecs et du go',
    intro: `On estime la taille d’un arbre de jeu par b puissance d. Aux échecs, b ≈ ${FACTS.chessBranching} et d ≈ ${FACTS.chessDepth} ; au go, b ≈ ${FACTS.goBranching} et d ≈ ${FACTS.goDepth}.`,
    steps: [
      { prompt: `Que vaut log₁₀(${FACTS.chessBranching}) ?`, value: Math.log10(FACTS.chessBranching), explain: `log₁₀(${FACTS.chessBranching}) ≈ ${fr(Math.log10(FACTS.chessBranching), 3)} : ${FACTS.chessBranching} ≈ 10^${fr(Math.log10(FACTS.chessBranching), 2)}.` },
      { prompt: `Quel est l’exposant de ${FACTS.chessBranching} puissance ${FACTS.chessDepth}, écrit comme une puissance de dix ?`, value: CHESS, explain: `${FACTS.chessDepth} × ${fr(Math.log10(FACTS.chessBranching), 3)} ≈ ${fr(CHESS, 1)} : environ ${pow10(CHESS)} parties.` },
      { prompt: `Et celui de ${FACTS.goBranching} puissance ${FACTS.goDepth} ?`, value: GO, explain: `${FACTS.goDepth} × log₁₀(${FACTS.goBranching}) ≈ ${FACTS.goDepth} × ${fr(Math.log10(FACTS.goBranching), 3)} ≈ ${fr(GO, 1)}.` },
    ],
    win: `L’arbre du go est environ ${pow10(GO - CHESS)} fois plus grand que celui des échecs, qui est déjà hors de portée.`,
  },
  {
    id: 'mean', module: 'm2', kind: 'calculation', title: 'Une moyenne et un score',
    intro: `Dans la position du cours, O joue dans un coin, puis on fait 100 parties au hasard. O en gagne ${C100.wins}, en annule ${C100.draws} et en perd ${C100.losses}. Ensuite, un autre coup a été visité n = ${SC.n} fois, sur N = ${SC.N} visites de son parent, avec une moyenne Q = ${fr(SC.Q, 2)}, P = 1/6 et c = ${fr(SC.c, 1)}.`,
    steps: [
      { prompt: 'Quelle est la moyenne des 100 parties pour O ?', value: (C100.wins - C100.losses) / 100, tol: 0.5, explain: `(${C100.wins} − ${C100.losses}) / 100 = ${fr((C100.wins - C100.losses) / 100, 2)}. Le coin semble bon au hasard, alors qu’il perd contre un bon joueur.` },
      { prompt: 'Que vaut le bonus d’exploration c·P·√N / (1 + n) du second coup ?', value: scoreRef(0, SC.P, SC.N, SC.n, SC.c), explain: `${fr(SC.c, 1)} × 1/6 × √${SC.N} / (1 + ${SC.n}) = ${fr(SC.c, 1)} × 1/6 × 6 / 5 = ${fr(scoreRef(0, SC.P, SC.N, SC.n, SC.c), 2)}.` },
      { prompt: 'Que vaut son score ?', value: scoreRef(SC.Q, SC.P, SC.N, SC.n, SC.c), explain: `Q + bonus = ${fr(SC.Q, 2)} + ${fr(scoreRef(0, SC.P, SC.N, SC.n, SC.c), 2)} = ${fr(scoreRef(SC.Q, SC.P, SC.N, SC.n, SC.c), 2)}.` },
    ],
    win: 'Le score ajoute à la moyenne un bonus qui diminue à mesure que le coup est visité.',
  },
  {
    id: 'score', module: 'm2', kind: 'code', title: 'Le score PUCT', slot: 'score',
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
    id: 'backup', module: 'm2', kind: 'code', title: 'La rétropropagation', slot: 'backup', parsons: true,
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
    id: 'alphagoOrder', module: 'm3', kind: 'sequence', title: 'La construction d’AlphaGo',
    intro: 'Remettez dans l’ordre les étapes de la construction d’AlphaGo, en 2016.',
    items: ['apprendre à imiter des parties humaines', 'jouer contre soi-même pour renforcer la politique', 'entraîner le réseau de valeur sur ces parties', 'jouer le match avec la recherche guidée par les deux réseaux'],
    explain: 'La politique imite d’abord les experts, puis s’améliore en jouant contre elle-même ; ses parties servent à entraîner le réseau de valeur ; en match, les deux guident la recherche.',
    win: 'AlphaGo Zero supprimera la première étape.',
  },
  {
    id: 'targets', module: 'm3', kind: 'calculation', title: 'Ce que la table apprend d’une partie',
    intro: 'Une position a déjà été vue 3 fois pendant l’auto-jeu. Sa table donne au coup du centre une probabilité 0,40 et à la position une valeur 0,20. Pendant la nouvelle partie, la recherche fait 48 simulations depuis cette position et en envoie 30 vers le centre. La partie finit nulle.',
    steps: [
      { prompt: 'Quelle part des visites va au centre (la cible de la politique) ?', value: 30 / 48, explain: '30 / 48 = 0,625.' },
      { prompt: 'Nouvelle probabilité du centre, moyenne des 4 cibles vues : 0,40 + (0,625 − 0,40) / 4 ?', value: 0.4 + (30 / 48 - 0.4) / 4, explain: `0,40 + 0,225 / 4 ≈ ${fr(0.4 + (30 / 48 - 0.4) / 4, 3)}.` },
      { prompt: 'Nouvelle valeur, vers le résultat z = 0 : 0,20 + (0 − 0,20) / 4 ?', value: 0.2 - 0.2 / 4, explain: '0,20 − 0,05 = 0,15.' },
    ],
    win: 'La politique se rapproche de ce que la recherche a fait ; la valeur, de ce qui s’est passé.',
  },
  {
    id: 'chainCalc', module: 'm4', kind: 'calculation', title: 'Une chaîne de sous-étapes',
    intro: 'Le robot réussit chacune des cinq sous-étapes (saisir, orienter, approcher, aligner, insérer) 9 fois sur 10.',
    steps: [
      { prompt: 'Quel est son taux de succès sur la tâche complète, en % ?', value: successByLevel(Q9)[4] * 100, unit: '%', explain: `0,9⁵ ≈ ${fr(successByLevel(Q9)[4], 3)}, soit ${pct1(successByLevel(Q9)[4])}.` },
      { prompt: 'En partant d’une pièce près du but (il reste aligner et insérer), en % ?', value: successByLevel(Q9)[1] * 100, unit: '%', explain: '0,9² = 0,81.' },
      { prompt: `S’il force l’écrou sans le reprendre, l’orientation ne réussit plus que ${pct(ROBOT.cap)} de 0,9. Succès sur la tâche complète, en % ?`, value: successByLevel(stepProb(Q9, 0, ROBOT.cap))[4] * 100, unit: '%', explain: `0,9⁴ × ${fr(0.9 * ROBOT.cap, 2)} ≈ ${pct1(successByLevel(stepProb(Q9, 0, ROBOT.cap))[4])}.` },
    ],
    win: 'Dans une chaîne, le maillon faible coûte cher : le succès est un produit.',
  },
  {
    id: 'sgsSort', module: 'm4', kind: 'classify', title: 'Ce que SGS tire souvent',
    intro: `SGS vise ici un taux de succès de ${pct(ROBOT.target)}. Pour chaque état de départ, dites s’il est tiré souvent ou rarement.`,
    categories: ['tiré souvent', 'tiré rarement'],
    items: SGS_ITEMS.map((s) => ({ text: `un état réussi ${pct(s)} du temps`, cat: SGS_ON(s) ? 0 : 1, why: SGS_ON(s) ? 'son issue est incertaine : l’épisode apprend quelque chose' : s < ROBOT.target ? 'presque toujours raté : peu de signal pour l’instant' : 'presque toujours réussi : rien de neuf à apprendre' })),
    win: 'SGS dépense les épisodes là où l’issue est incertaine, sans abandonner les autres.',
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
const robot = (v: Record<string, number>) => robotOf(v);
const SIMS_OPTS = [0, 0.1, 0.5, 1.5, 5, 25, 100].map((x) => ({ label: fr(x, x < 1 ? 1 : 0), value: x }));
const EXPLORE_OPTS = [0, 0.25, 0.5, 0.75, 1].map((x) => ({ label: fr(x, 2), value: x }));
const TSIMS_OPTS = [16, 32, 48].map((x) => ({ label: fr(x), value: x }));

const course = defineCourse({
  id: 'alphazero', version: 1, language: 'fr',
  title: 'AlphaGo, AlphaZero et AlphaNIST',
  lead: 'Comment un programme apprend-il seul à jouer au go mieux que les champions, et comment la même idée apprend-elle à un robot à assembler des pièces ? Le cours construit des versions miniatures de chaque étape : l’arbre de jeu du morpion, la recherche Monte-Carlo, un AlphaZero qui apprend en jouant contre lui-même, et un robot qui apprend à visser un écrou. Chaque chiffre est calculé par ces programmes, que vous pouvez faire varier.',
  audience: { level: 'lycée', prerequisites: 'Probabilités simples, moyenne, puissances de dix ; lire une courte fonction JavaScript. Trois fiches rappellent les outils.', effort: 'quatre à cinq heures' },
  modules: [
    {
      id: 'm1', title: 'Chercher dans un arbre de jeu', pitch: 'Ce qu’est un arbre de jeu, comment le parcourir, et pourquoi celui du go est hors de portée.',
      goals: ['Expliquer ce qu’est un arbre de jeu et pourquoi il grandit si vite', 'Trouver la valeur minimax d’une position simple', 'Comparer la taille des arbres du morpion, des échecs et du go'],
      summary: ['Un arbre de jeu contient toutes les suites de coups possibles à partir d’une position.', 'Minimax remonte les valeurs depuis les fins de partie : chaque joueur choisit le coup le pire pour l’adversaire.', 'La taille d’un arbre vaut à peu près b puissance d : environ 10¹²³ aux échecs, 10³⁶⁰ au go.', 'Au go, il manque aussi une bonne manière de juger une position sans finir la partie.'],
    },
    {
      id: 'm2', title: 'La recherche Monte-Carlo', pitch: 'Explorer seulement la partie utile de l’arbre, en estimant les positions par des parties jouées au hasard.',
      goals: ['Décrire les quatre temps d’une simulation de la recherche Monte-Carlo', 'Expliquer le rôle de la constante d’exploration', 'Programmer le score PUCT et la rétropropagation'],
      summary: ['Chaque simulation descend dans l’arbre par le meilleur score, ajoute une feuille, l’estime, puis remonte le résultat.', 'Le score PUCT = Q + c·P·√N / (1 + n) équilibre ce qui semble bon et ce qui a été peu essayé.', 'Trop peu d’exploration fige la recherche sur un mauvais coup ; trop d’exploration la disperse.', 'Plus il y a de simulations, plus la recherche se rapproche du jeu parfait.'],
    },
    {
      id: 'm3', title: 'AlphaGo et AlphaZero', pitch: 'Deux réseaux de neurones guident la recherche, et le programme apprend en jouant contre lui-même.',
      goals: ['Expliquer le rôle du réseau de politique et du réseau de valeur', 'Décrire la boucle d’auto-jeu d’AlphaZero', 'Expliquer pourquoi la recherche améliore la politique'],
      summary: ['La politique dit où chercher ; la valeur dit qui va gagner sans finir la partie.', 'AlphaGo imitait d’abord des parties humaines ; AlphaGo Zero et AlphaZero partent des seules règles.', 'Pendant l’auto-jeu, la politique apprend à imiter la recherche, et la valeur apprend le résultat des parties.', 'Sans exploration pendant l’entraînement, le programme rejoue les mêmes parties et cesse de progresser.'],
    },
    {
      id: 'm4', title: 'AlphaNIST : du plateau de jeu au robot', pitch: 'La même philosophie appliquée à un robot qui assemble des pièces : récompense binaire et choix des états de départ.',
      goals: ['Expliquer pourquoi une récompense binaire peut mieux réussir qu’une récompense dense', 'Expliquer comment l’échantillonnage guidé par le succès choisit les états de départ', 'Diagnostiquer un entraînement raté'],
      summary: ['Le robot n’est récompensé que s’il réussit l’assemblage : il reste libre de trouver sa propre manière.', 'Une récompense dense pour l’approche et l’alignement peut interdire un détour utile, comme reposer une pièce pour la reprendre.', 'Un essai toujours raté n’apprend rien : il faut partir aussi d’états proches du but.', 'SGS tire surtout les états réussis environ une fois sur deux, sans abandonner les autres.'],
    },
    { id: 'exam', title: 'Épreuve', kind: 'exam', pitch: 'Un entraînement raté à diagnostiquer seul, et le test final.', goals: ['Diagnostiquer seul un cas inconnu'], summary: ['Observer, supposer, corriger un seul réglage, justifier.'] },
  ],
  glossary: [
    { id: 'tree', name: 'arbre de jeu', forms: ['arbres de jeu'], def: 'Toutes les suites de coups possibles à partir d’une position, rangées comme un arbre : chaque branche est un coup, chaque nœud une position.', module: 'm1' },
    { id: 'branch', name: 'facteur de branchement', def: 'Nombre moyen de coups possibles à chaque tour : environ 35 aux échecs, 250 au go.', tool: 'O1', module: 'm1' },
    { id: 'minimax', name: 'minimax', def: 'Calcul de la valeur d’une position en supposant que chaque joueur choisit toujours le coup le pire pour l’adversaire.', module: 'm1' },
    { id: 'perfect', name: 'joueur parfait', def: 'Joueur qui choisit toujours un coup de meilleure valeur minimax. Au morpion, il ne perd jamais.', module: 'm1' },
    { id: 'eval', name: 'fonction d’évaluation', def: 'Formule qui juge une position sans finir la partie, par exemple en comptant les pièces.', module: 'm1' },
    { id: 'mcts', name: 'recherche Monte-Carlo', forms: ['MCTS'], def: 'Recherche qui construit seulement la partie prometteuse de l’arbre, par des simulations répétées.', module: 'm2' },
    { id: 'sim', name: 'simulation', forms: ['simulations'], def: 'Un passage de la recherche Monte-Carlo : sélection, expansion, évaluation, rétropropagation.', module: 'm2' },
    { id: 'rollout', name: 'partie au hasard', forms: ['parties au hasard'], def: 'Partie jouée jusqu’au bout avec des coups tirés au hasard, pour estimer une position.', tool: 'P1', module: 'm2' },
    { id: 'puct', name: 'PUCT', def: 'Règle de sélection d’AlphaZero : score = Q + c·P·√N / (1 + n).', module: 'm2' },
    { id: 'explo', name: 'exploration', def: 'Essayer des coups peu connus, au risque de perdre du temps, pour ne pas manquer un meilleur coup.', module: 'm2' },
    { id: 'exploit', name: 'exploitation', def: 'Approfondir les coups qui semblent déjà les meilleurs.', module: 'm2' },
    { id: 'backprop', name: 'rétropropagation', def: 'Remontée du résultat d’une simulation de la feuille vers la racine, avec le signe de chaque joueur.', module: 'm2' },
    { id: 'nn', name: 'réseau de neurones', forms: ['réseaux de neurones'], def: 'Fonction à très nombreux paramètres réglables, ajustés sur des exemples pour réduire ses erreurs.', module: 'm3' },
    { id: 'policy', name: 'politique', forms: ['politiques'], def: 'Règle qui donne, pour chaque position, une probabilité à chaque coup (ou à chaque action d’un robot).', module: 'm3' },
    { id: 'vnet', name: 'réseau de valeur', def: 'Réseau qui estime, à partir d’une position, qui va gagner.', module: 'm3' },
    { id: 'sl', name: 'apprentissage supervisé', def: 'Apprentissage à partir d’exemples dont la bonne réponse est connue, comme le coup joué par un expert.', module: 'm3' },
    { id: 'rl', name: 'apprentissage par renforcement', def: 'Apprentissage par essais, guidé seulement par une récompense : le programme renforce ce qui a mené à la réussite.', module: 'm3' },
    { id: 'reward', name: 'récompense', forms: ['récompenses'], def: 'Nombre donné à la fin d’un essai (ou pendant) pour dire s’il a réussi.', module: 'm3' },
    { id: 'self', name: 'auto-jeu', def: 'Parties qu’un programme joue contre lui-même pour produire ses propres données d’entraînement.', module: 'm3' },
    { id: 'noise', name: 'bruit d’exploration', def: 'Hasard ajouté pendant l’entraînement (aux probabilités de la racine, au choix du coup) pour varier les parties.', module: 'm3' },
    { id: 'elo', name: 'Elo', def: 'Échelle de force des joueurs : avec 400 points d’écart, le plus fort gagne environ 10 parties sur 11.', module: 'm3' },
    { id: 'episode', name: 'épisode', forms: ['épisodes'], def: 'Un essai du robot, depuis un état de départ jusqu’au succès ou à l’échec.', module: 'm4' },
    { id: 'binary', name: 'récompense binaire', def: '1 si la tâche est réussie, 0 sinon ; rien pour les progrès intermédiaires.', module: 'm4' },
    { id: 'dense', name: 'récompense dense', def: 'Récompense donnée aussi pour les progrès intermédiaires, comme se rapprocher du but ou aligner une pièce.', module: 'm4' },
    { id: 'start', name: 'état de départ', forms: ['états de départ'], def: 'Situation où commence un épisode : pièces détachées, pièce déjà saisie, assemblage presque fini.', module: 'm4' },
    { id: 'sgs', name: 'échantillonnage guidé par le succès', forms: ['SGS'], def: 'Choix des états de départ selon leur taux de succès : surtout ceux réussis environ une fois sur deux.', tool: 'S1', module: 'm4' },
    { id: 'emerg', name: 'comportement émergent', forms: ['comportements émergents'], def: 'Manière de faire que personne n’a programmée et que l’apprentissage a trouvée.', module: 'm4' },
  ],
  toolbox: CAPSULES,
  tests: {
    tools: [
      { id: 'a1', skill: 'Puissances de dix', tool: 'O1', q: choice('Quel nombre est le plus grand ?', ['10¹²⁰', '10⁶⁰ × 10⁵⁰', '2 × 10¹⁰⁰', '10⁸⁰ + 10⁸⁰'], '10⁶⁰ × 10⁵⁰ = 10¹¹⁰ ; 2 × 10¹⁰⁰ et 2 × 10⁸⁰ sont bien plus petits que 10¹²⁰.') },
      { id: 'a2', skill: 'Moyenne de résultats', tool: 'P1', q: numeric('Sur 20 parties : 12 victoires, 2 nuls, 6 défaites (comptées +1, 0, −1). Quelle est la moyenne ?', 0.3, '(12 − 6) / 20 = 0,3.') },
      { id: 'a3', skill: 'Tirage pondéré', tool: 'S1', q: numeric('Trois états ont des poids 2, 3 et 5. Quelle est la probabilité de tirer le troisième ?', 0.5, '5 / (2 + 3 + 5) = 0,5.') },
    ],
    pre: [
      { id: 'b1', skill: 'La taille des arbres de jeu', q: choice('Un ordinateur très puissant pourrait-il examiner toutes les parties de go possibles avant de jouer ?', ['non, il y en a bien trop', 'oui, avec un supercalculateur', 'oui, en quelques jours', 'non, les règles sont floues'], `Il y en aurait de l’ordre de ${pow10(GO)}, bien plus que d’atomes dans l’univers observable.`) },
      { id: 'b2', skill: 'Apprendre sans humains', q: choice('D’où AlphaZero tire-t-il sa connaissance du go ?', ['de parties contre lui-même', 'de parties de champions', 'de conseils d’experts', 'd’une base de positions'], 'AlphaZero ne connaît que les règles ; il produit ses données en jouant contre lui-même.') },
      { id: 'b3', skill: 'Explorer et exploiter', q: choice('Une recherche qui approfondit toujours le coup qui lui semble le meilleur…', ['peut manquer un meilleur coup', 'trouve toujours le meilleur coup', 'explore tous les coups également', 'n’a besoin d’aucun calcul'], 'Un coup mal estimé au début ne serait plus jamais essayé.') },
      { id: 'b4', skill: 'Récompense binaire ou dense', q: choice('Pour un robot qui apprend à visser un écrou, récompenser chaque rapprochement du but…', ['peut l’enfermer dans une manière', 'l’aide toujours à mieux réussir', 'ne change rien au résultat', 'est indispensable pour apprendre'], 'Une récompense pour rester près du but pénalise les détours utiles, comme reposer la pièce pour la reprendre.') },
      { id: 'b5', skill: 'Choisir où commencer', q: choice('Avec une récompense binaire, où vaut-il mieux faire commencer la plupart des essais ?', ['là où il réussit une fois sur deux', 'toujours au début de la tâche', 'là où il réussit presque toujours', 'n’importe où, au hasard'], 'Un essai dont l’issue est incertaine apprend le plus ; un essai toujours raté ou toujours réussi n’apprend presque rien.') },
    ],
    post: [
      { id: 'p1', pair: 'b1', skill: 'La taille des arbres de jeu', q: choice('Pourquoi un programme d’échecs ne parcourt-il pas tout l’arbre du jeu ?', ['l’arbre est bien trop grand', 'les règles changent en partie', 'il ne connaît pas les règles', 'il le parcourt la nuit'], `L’arbre des échecs compte de l’ordre de ${pow10(CHESS)} parties.`) },
      { id: 'p2', pair: 'b2', skill: 'Apprendre sans humains', q: choice('Un AlphaZero entraîné à un jeu inventé hier, sans joueur humain, peut-il devenir fort ?', ['oui, en jouant contre lui-même', 'non, il lui faut des experts', 'non, il lui faut une base', 'oui, si le jeu ressemble au go'], 'Il lui suffit des règles : l’auto-jeu fournit les exemples.') },
      { id: 'p3', pair: 'b3', skill: 'Explorer et exploiter', q: choice('Dans le score PUCT, à quoi sert le terme c·P·√N / (1 + n) ?', ['à essayer les coups peu visités', 'à favoriser les coups très visités', 'à compter les parties gagnées', 'à remplacer les parties au hasard'], 'Il est grand pour un coup peu visité (n petit) : la recherche finit par le réessayer.') },
      { id: 'p4', pair: 'b4', skill: 'Récompense binaire ou dense', q: choice('Un robot payé pour rester près du but ne repose jamais la pièce pour la reprendre. Pourquoi ?', ['reposer la pièce l’éloigne du but', 'reposer une pièce est impossible', 'la simulation interdit de lâcher', 'il manque de puissance de calcul'], 'Le détour fait perdre des points de récompense dense, même s’il mène plus souvent au succès.') },
      { id: 'p5', pair: 'b5', skill: 'Choisir où commencer', q: choice('Un robot ne réussit jamais la tâche en partant des pièces détachées. Que changer d’abord ?', ['le faire partir près du but aussi', 'répéter la tâche complète plus', 'réduire la récompense du succès', 'supprimer les essais faciles'], 'Près du but, il réussit parfois : c’est là qu’un signal d’apprentissage apparaît.') },
    ],
  },
  diagrams: DIAGRAMS,
  stageKeys: ['sims', 'c', 'games', 'explore', 'tsims', 'sampler', 'target', 'w'],
  scenes: { go: 'Un plateau de go', tree: 'La recherche Monte-Carlo', selfplay: 'Des parties d’auto-jeu', robot: 'Le robot visse un écrou' },
  defaults: { sims: MCTS_NOMINAL.sims, c: MCTS_NOMINAL.c, depth: 2, games: TRAIN.games, explore: TRAIN.explore, tsims: TRAIN.sims, sampler: ROBOT.sampler, target: ROBOT.target, w: ROBOT.w, it: ROBOT.iters },
  model,
  exercises,
  rubric: [
    'Une justification complète décrit le symptôme (ce que l’on observe), la cause (le réglage en défaut) et le mécanisme qui relie les deux.',
    'Elle s’appuie sur une notion du cours : exploration, signal d’apprentissage, récompense, état de départ.',
  ],
  content(c) {
    // ================================================================ m1
    c.module('m1');
    c.chapter('Le défi du go', () => {
      c.stage('go');
      c.step('Une victoire attendue dans dix ans', `En mars ${FACTS.leeYear}, le programme AlphaGo bat le champion Lee Sedol au go, ${FACTS.leeWins} parties à ${FACTS.leeLosses}. Beaucoup de spécialistes pensaient qu’il faudrait encore une dizaine d’années. Le go se joue sur un plateau de ${FACTS.goSide} × ${FACTS.goSide} intersections ; les joueurs posent tour à tour une pierre noire ou blanche et cherchent à entourer le plus de territoire.`);
      c.test('pre', 'Avant de commencer, un court test : il mesure ce que vous savez déjà, pour le comparer au test final.');
      c.step('Trois programmes, une même idée', `AlphaGo apprend d’abord de parties humaines, puis contre lui-même. AlphaZero se passe des humains : il ne connaît que les règles, et devient le plus fort aux échecs, au shogi et au go. AlphaNIST reprend cette idée pour un bras robotique qui assemble de petites pièces, jusqu’à ${FACTS.nistSmallMm} mm, sans démonstration humaine.`);
      c.step('Ce que le cours construit', 'Le cours construit des versions miniatures de ces programmes : un morpion, sur lequel on fait tourner les mêmes méthodes de recherche et d’apprentissage, puis un robot simplifié. Chaque chiffre, chaque schéma et chaque scène viennent de ces petits programmes, que vous pouvez faire varier.');
    });
    c.chapter('L’arbre de jeu', () => {
      c.diagram('tree');
      c.ask('q-count', 'À votre avis, combien de parties de morpion différentes existe-t-il ?', [`environ ${fr(Math.round(T.games / 1000))} 000`, 'environ 9', 'environ 3 000', 'environ 36 milliards'], `Le modèle les compte toutes : ${fr(T.games)} parties.`);
      c.step('Positions et coups', 'Une position, c’est l’état du plateau et le joueur qui doit jouer. Un coup fait passer d’une position à une autre. Au morpion, X commence : il a 9 cases au choix, puis O en a 8, puis X en a 7, et ainsi de suite, jusqu’à ce qu’un joueur aligne trois symboles ou que la grille soit pleine.');
      c.step('L’arbre de jeu', `Dessinons toutes les suites de coups : la racine est le plateau vide, chaque branche est un coup, chaque feuille une partie finie. C’est l’arbre de jeu. Celui du morpion a ${fr(T.nodes)} nœuds et ${fr(T.games)} feuilles, mais seulement ${fr(T.positions)} positions différentes : on atteint souvent la même position par des ordres différents.`, {
        claims: [{ text: `${fr(T.games)} parties, ${fr(T.positions)} positions`, check: () => (T.games === 255_168 && T.positions === 5_478) || `${T.games} / ${T.positions}` }],
      });
      c.experiment({
        title: 'Les positions, coup après coup', prompt: 'Faites varier le nombre de coups joués et lisez le nombre de positions différentes.',
        predict: { question: 'Le nombre de positions différentes augmente-t-il à chaque coup ?', choices: ['non, il diminue vers la fin', 'oui, jusqu’à la fin', 'il reste le même'], answer: 0 },
        controls: [{ type: 'range', key: 'depth', label: 'coups joués', min: 0, max: 9, step: 1, fmt: dec(0) }],
        goals: [
          { label: 'Trouvez le nombre de coups qui donne le plus de positions', test: ({ v }) => T.byDepth[v.depth] === Math.max(...T.byDepth) },
          { label: 'Trouvez un nombre de coups où il y a moins de 100 positions', test: ({ v }) => v.depth > 0 && T.byDepth[v.depth] < 100 },
        ],
        seq: true, conclusion: `Le maximum, ${fr(Math.max(...T.byDepth))} positions, est atteint après ${T.byDepth.indexOf(Math.max(...T.byDepth))} coups. Ensuite, beaucoup de parties sont déjà finies et les cases libres se font rares.`,
      });
      c.numeric('q-depth2', 'Combien de positions différentes existe-t-il après deux coups ?', T.byDepth[2], `9 choix pour X, 8 pour O : ${fr(T.byDepth[2])} positions, toutes différentes.`, { tol: 0 });
    });
    c.chapter('Minimax', () => {
      c.diagram('minimax');
      c.step('La valeur d’une position', 'Supposons que les deux joueurs jouent parfaitement. Chaque position a alors une valeur pour le joueur qui doit jouer : gagné, nul ou perdu. Pour une partie finie, il suffit de lire le plateau. Pour les autres, il faut regarder ce qui se passe après chaque coup.');
      c.step('Remonter les valeurs', 'Le joueur qui doit jouer choisit le coup qui mène à la position la pire pour son adversaire. On calcule donc les valeurs depuis les feuilles et on les remonte jusqu’à la racine : c’est le calcul minimax. Le joueur parfait choisit toujours un coup de meilleure valeur. Au morpion, la racine vaut « nul ».', {
        claims: [{ text: 'le morpion joué parfaitement est nul', check: () => minimax(EMPTY) === 0 }],
      });
      c.step('La position du cours', `Sur le schéma, X occupe deux coins opposés et O le centre ; O doit jouer. Minimax donne la valeur de chaque réponse : les ${bestMoves(FORK).length} bords mènent au nul, les ${legal(FORK).length - bestMoves(FORK).length} coins perdent. Le cours reviendra souvent à cette position.`, {
        claims: [{ text: 'les bords tiennent le nul', check: () => bestMoves(FORK).every((m) => CELL[m] === 'bord') && bestMoves(FORK).length === 4 }],
      });
      c.question('q-fork', 'Dans la position du cours, pourquoi un coin perd-il pour O ?', ['X prend l’autre coin et menace deux lignes', 'O ne peut plus jamais aligner trois pions', 'les coins sont interdits au second joueur', 'X gagne tout de suite au coup suivant'], 'Après un coin de O, X joue le dernier coin libre et crée deux menaces à la fois ; O ne peut en parer qu’une.');
      c.exercise('count', 'Dans l’atelier, comptez les parties de morpion à partir d’une majoration simple.');
    });
    c.chapter('Pourquoi le go résiste', () => {
      c.stage('go');
      c.diagram('explosion');
      c.ask('q-bigbang', 'Une machine qui examinerait un milliard de parties d’échecs par seconde depuis le Big Bang aurait-elle tout vu ?', ['non, elle en serait très loin', 'oui, depuis longtemps', 'oui, tout juste aujourd’hui', 'non, il lui manquerait un an'], `Elle aurait vu environ ${pow10(SINCE_BIG_BANG)} parties, contre ${pow10(CHESS)} dans l’arbre des échecs.`);
      c.step('Le facteur de branchement', `Si un jeu offre environ b coups par tour et dure d coups, son arbre compte environ b puissance d parties. Aux échecs, b ≈ ${FACTS.chessBranching} et d ≈ ${FACTS.chessDepth} : environ ${pow10(CHESS)}. Au go, b ≈ ${FACTS.goBranching} et d ≈ ${FACTS.goDepth} : environ ${pow10(GO)}. L’univers observable compte environ ${pow10(FACTS.atomsLog10)} atomes.`, {
        tools: ['O1'],
        claims: [{ text: 'échecs ≈ 10¹²³, go ≈ 10³⁶⁰', check: () => near(CHESS, 123.5, 0.01) && near(GO, 359.7, 0.01) }, { text: 'loin du compte depuis le Big Bang', check: () => SINCE_BIG_BANG < CHESS - 90 }],
      });
      c.step('Couper l’arbre', `En ${FACTS.deepBlue}, Deep Blue bat le champion du monde d’échecs. Il applique minimax quelques coups en avant seulement, puis juge les positions avec une fonction d’évaluation écrite par des experts : la valeur des pièces, leur position. Au go, personne ne savait écrire une telle fonction : la valeur d’une pierre dépend de tout le plateau.`);
      c.step('Deux problèmes', 'Pour jouer au go, il faut donc résoudre deux problèmes : l’arbre est trop large (quels coups regarder parmi 250 ?) et trop profond (comment juger une position sans finir la partie ?). AlphaGo répond aux deux par des intuitions apprises : l’une dit où chercher, l’autre qui va gagner. La suite du cours les construit.');
      c.exercise('goTree', 'Dans l’atelier, calculez la taille des arbres des échecs et du go.');
      c.explain('e-go', 'Expliquez pourquoi la méthode qui suffit au morpion, parcourir tout l’arbre avec minimax, ne suffit pas au go.', `Minimax doit visiter tout l’arbre, dont la taille vaut à peu près b puissance d. Au morpion, cela fait quelques centaines de milliers de nœuds. Au go, avec environ ${FACTS.goBranching} coups par tour et ${FACTS.goDepth} coups par partie, cela fait de l’ordre de ${pow10(GO)} parties : aucun ordinateur ne peut les parcourir. Il faudrait couper l’arbre, mais on ne sait pas juger une position de go sans finir la partie.`);
    });

    // ================================================================ m2
    c.module('m2');
    c.chapter('Estimer en jouant au hasard', () => {
      c.stage('tree');
      c.diagram('rollouts');
      c.ask('q-random', 'Comment estimer une position de go sans savoir la juger ?', ['jouer beaucoup de parties au hasard', 'compter les pierres de chaque joueur', 'regarder seulement le coup suivant', 'demander la valeur à un champion'], 'On joue des parties jusqu’au bout et on fait la moyenne des résultats.');
      c.step('Des parties au hasard', 'Pour estimer une position, on la joue jusqu’au bout de nombreuses fois, avec des coups tirés au hasard : ce sont des parties au hasard. On compte +1 pour une victoire, 0 pour un nul, −1 pour une défaite. La moyenne des résultats estime la position, sans aucune connaissance du jeu.', { tools: ['P1'] });
      c.step('Une estimation trompeuse', `Sur le schéma, après chaque réponse de O dans la position du cours. Au hasard, le coin rapporte en moyenne ${fr(MEAN(CORNER), 2)} à O, plus que le bord (${fr(MEAN(EDGE), 2)}) ; pourtant, joué parfaitement, le coin perd. L’adversaire au hasard ne profite pas de la double menace. Une partie au hasard estime mal, mais elle ne coûte presque rien.`, {
        claims: [{ text: 'au hasard, le coin semble meilleur que le bord', check: () => MEAN(CORNER) > MEAN(EDGE) && -minimax(play(FORK, CORNER)) === -1 }],
      });
      c.numeric('q-mean', 'Sur 40 parties au hasard, O en gagne 14, en annule 16 et en perd 10. Quelle est la moyenne pour O ?', 0.1, '(14 − 10) / 40 = 0,1.', { tol: 0 });
    });
    c.chapter('Les quatre temps d’une simulation', () => {
      c.stage('tree');
      c.diagram('phases');
      c.step('Un arbre qui grandit là où c’est utile', `La recherche Monte-Carlo, proposée en ${FACTS.mctsYear}, ne construit qu’une petite partie de l’arbre, du côté des coups prometteurs. Elle répète des centaines de fois une simulation en quatre temps. En arrière-plan, l’arbre construit depuis la position du cours : la taille d’un nœud indique son nombre de visites.`);
      c.step('Sélection et expansion', 'Sélection : depuis la racine, on descend en choisissant à chaque nœud le coup de meilleur score, jusqu’à une position encore jamais développée, une feuille. Expansion : on ajoute à l’arbre les positions qui suivent cette feuille.');
      c.step('Évaluation et rétropropagation', 'Évaluation : on estime la feuille, par exemple par une partie au hasard. Rétropropagation : on remonte le chemin jusqu’à la racine ; chaque nœud reçoit une visite de plus et le résultat, compté du point de vue du joueur qui a choisi ce coup. Le signe change donc à chaque niveau.');
      c.order('q-phases', 'Remettez dans l’ordre les quatre temps d’une simulation.', ['sélection', 'expansion', 'évaluation', 'rétropropagation'], 'On descend dans l’arbre, on l’agrandit, on estime la nouvelle feuille, puis on remonte le résultat.');
      c.step('Choisir le coup', 'Quand les simulations sont finies, on joue le coup le plus visité, pas celui de meilleure moyenne : un coup très visité a été vérifié de nombreuses fois, alors qu’une bonne moyenne sur deux visites peut venir du hasard.');
    });
    c.chapter('Explorer ou exploiter', () => {
      c.stage('tree');
      c.diagram('puct');
      c.ask('q-greedy', 'Une recherche qui descend toujours vers le coup de meilleure moyenne…', ['risque d’ignorer un coup mal estimé', 'trouve toujours le meilleur coup', 'essaie tous les coups autant', 'n’a pas besoin de compter les visites'], 'Si un bon coup a eu une mauvaise moyenne au début, elle ne le réessaie jamais.');
      c.step('Le score PUCT', 'Le score d’un coup vaut Q + c·P·√N / (1 + n). Q est la moyenne de ses résultats : c’est l’exploitation. Le second terme, l’exploration, est grand quand le coup a peu de visites (n) par rapport à son parent (N). P est la confiance a priori dans le coup ; ici, la même pour tous. La constante c règle l’équilibre.', {
        code: 'score = Q + c * P * Math.sqrt(N) / (1 + n)',
      });
      c.experiment({
        title: 'La constante d’exploration', prompt: `Avec ${fr(MCTS_NOMINAL.sims)} simulations par coup, changez c. Le schéma montre les visites dans la position du cours ; le pied du panneau, le bilan de 40 parties contre le joueur parfait.`,
        predict: { question: 'Avec c = 0, la recherche…', choices: ['se fige souvent sur un mauvais coup', 'joue parfaitement', 'visite tous les coups autant'], answer: 0 },
        controls: [{ type: 'choice', key: 'c', label: 'constante c', options: SIMS_OPTS }],
        goals: [
          { label: 'Réglez c = 0 : la recherche perd souvent', test: ({ v }) => v.c === 0 && mctsOf(v).outcome === 'weak' },
          { label: 'Trouvez une valeur de c trop grande : elle perd de nouveau', test: ({ v }) => v.c > 25 && !isSolid(v) },
          { label: 'Trouvez une valeur de c avec laquelle elle ne perd presque jamais', test: ({ v }) => isSolid(v) },
        ],
        seq: true, conclusion: 'Sans exploration, la recherche approfondit le premier coup qui a semblé bon et ne revoit jamais les autres. Avec une exploration énorme, elle répartit ses visites presque également et ne creuse plus les bons coups. Entre les deux, de 1,5 à 25 environ, elle ne perd presque plus.',
      });
      c.exercise('score', 'Dans l’atelier, programmez le score PUCT.');
    });
    c.chapter('Plus de simulations', () => {
      c.stage('tree');
      c.diagram('strength');
      c.step('La force grandit avec le calcul', `Avec ${fr(M10.vsPerfect.games)} parties contre le joueur parfait : à 10 simulations par coup, la recherche en perd ${fr(M10.vsPerfect.losses)} ; à ${fr(MCTS_NOMINAL.sims)} simulations, ${fr(MNOM.vsPerfect.losses)}. Chaque partie au hasard estime mal, mais l’arbre concentre peu à peu les visites sur les bons coups, et les estimations se corrigent de niveau en niveau.`, {
        claims: [{ text: 'perd souvent à 10, presque jamais au nominal', check: () => M10.outcome === 'weak' && MNOM.outcome === 'solid' }],
      });
      c.experiment({
        title: 'Le nombre de simulations', prompt: 'Faites varier le nombre de simulations par coup (c = 1,5).',
        predict: { question: 'Avec 10 simulations par coup, contre le joueur parfait, la recherche…', choices: ['perd souvent', 'ne perd jamais', 'gagne parfois'], answer: 0 },
        controls: [{ type: 'range', key: 'sims', label: 'simulations par coup', min: 1, max: 3200, step: 1, log: true, fmt: (x: number) => fr(x) }],
        goals: [
          { label: 'Trouvez un réglage où la recherche perd au moins un quart des parties', test: ({ v }) => v.c === MCTS_NOMINAL.c && mctsOf(v).outcome === 'weak' },
          { label: 'Trouvez le réglage à partir duquel elle ne perd presque jamais', test: ({ v }) => v.c === MCTS_NOMINAL.c && isSolid(v) },
        ],
        seq: true, conclusion: `Jusqu’à 50 simulations environ, elle perd souvent. À partir de 1 200, elle ne perd presque plus. Elle ne gagne jamais : contre le joueur parfait, le mieux possible est le nul. ${MCTS_OUTCOME.solid[0].toUpperCase()}${MCTS_OUTCOME.solid.slice(1)} ne veut pas dire qu’elle connaît la valeur exacte de chaque coup.`,
      });
      c.exercise('mean', 'Dans l’atelier, calculez une moyenne de parties au hasard et un score.');
      c.exercise('backup', 'Dans l’atelier, programmez la rétropropagation.');
      c.exercise('assembly', 'Dans l’atelier, faites tourner ensemble votre score et votre rétropropagation.');
      c.explain('e-mcts', 'Expliquez pourquoi la recherche Monte-Carlo joue mieux avec plus de simulations, alors que chaque partie au hasard est une mauvaise estimation.', 'Chaque simulation ajoute une feuille et remonte un résultat. Le score dirige les simulations suivantes vers les coups qui semblent bons, tout en réessayant les autres. Avec beaucoup de simulations, l’arbre devient profond sous les bons coups : les estimations ne reposent plus seulement sur des parties au hasard, mais sur les meilleures réponses trouvées plus bas, comme dans minimax.');
    });

    // ================================================================ m3
    c.module('m3');
    c.chapter('Deux intuitions apprises', () => {
      c.stage('selfplay');
      c.diagram('nets');
      c.ask('q-missing', 'Qu’est-ce qui manquait à la recherche Monte-Carlo pour bien jouer au go ?', ['de bonnes estimations des coups et des positions', 'un ordinateur beaucoup plus rapide', 'des règles du jeu plus simples', 'un plateau plus petit'], 'Elle explorait encore trop de coups, et ses parties au hasard jugeaient mal les positions.');
      c.step('Un réseau de neurones', 'Un réseau de neurones est une fonction qui a des millions de paramètres réglables. On lui donne un plateau, il calcule des nombres. On l’entraîne sur des exemples : on règle ses paramètres, petit à petit, pour réduire l’écart entre ce qu’il calcule et ce qu’il aurait dû calculer.');
      c.step('La politique', 'Le réseau de politique donne, pour chaque coup, une probabilité : celle d’être un bon coup. Dans la recherche, elle remplace la confiance a priori P, égale pour tous jusqu’ici. La recherche se concentre sur quelques coups plausibles : l’arbre devient moins large.');
      c.step('La valeur', 'Le réseau de valeur estime, à partir d’une position, qui va gagner : un nombre entre −1 et +1. Dans la recherche, il remplace les parties au hasard. On n’a plus besoin de finir la partie pour juger une feuille : l’arbre peut rester moins profond.');
      c.question('q-roles', 'Dans la recherche d’AlphaZero, le réseau de valeur remplace…', ['les parties jouées au hasard', 'le choix du coup le plus visité', 'les règles du jeu', 'la rétropropagation'], 'La feuille est estimée par le réseau de valeur au lieu d’une partie au hasard.');
      c.step('Dans notre miniature', `À la place des réseaux, notre programme range dans deux tables, pour chaque position rencontrée, une politique et une valeur. Les positions symétriques partagent une entrée, comme dans AlphaGo Zero. Une table ne généralise pas : une position jamais vue n’a rien. Un réseau, lui, devine à partir de positions semblables ; c’est sa force au go.`);
    });
    c.chapter('AlphaGo', () => {
      c.stage('go');
      c.diagram('alphago');
      c.step('Apprendre des humains', `AlphaGo entraîne d’abord sa politique sur ${fr(FACTS.humanPositions)} millions de positions de parties humaines : c’est un apprentissage supervisé, où la bonne réponse est le coup joué par l’expert. Le réseau retrouve ce coup ${pct(FACTS.humanAccuracy)} du temps. Il joue déjà comme un bon amateur, sans aucune recherche.`);
      c.step('Puis contre lui-même', 'AlphaGo joue ensuite contre d’anciennes versions de lui-même. Chaque partie gagnée renforce les coups qui y ont mené : c’est l’apprentissage par renforcement, guidé par une seule récompense, +1 pour une victoire, −1 pour une défaite. Ces parties servent aussi à entraîner le réseau de valeur.');
      c.step('Le coup 37', `Pendant le match, la recherche est guidée par les deux réseaux. Au coup ${FACTS.move37} de la deuxième partie, AlphaGo joue un coup que sa politique jugeait très improbable pour un humain, et que les commentateurs prennent d’abord pour une erreur. La recherche l’a trouvé malgré la politique : elle peut corriger ce que les humains ont appris au réseau.`);
      c.question('q-sl', 'Qu’apprend un réseau de politique entraîné sur des parties humaines ?', ['à prédire le coup d’un expert', 'à prédire le vainqueur', 'à compter les positions', 'à jouer au hasard'], 'Chaque exemple est une position et le coup joué par l’expert : le réseau apprend à le retrouver.');
      c.exercise('alphagoOrder', 'Dans l’atelier, remettez dans l’ordre la construction d’AlphaGo.');
    });
    c.chapter('Apprendre en jouant contre soi', () => {
      c.stage('selfplay');
      c.diagram('loop');
      c.ask('q-self', 'Un programme qui ne joue que contre lui-même peut-il dépasser son niveau de départ ?', ['oui, sa recherche joue mieux que sa politique', 'non, il répète toujours ses erreurs', 'non, il lui faut un adversaire plus fort', 'oui, mais seulement au morpion'], 'La recherche, guidée par la politique, trouve de meilleurs coups qu’elle : la politique peut apprendre de la recherche.');
      c.step('La boucle d’AlphaZero', `À chaque coup d’une partie d’auto-jeu, le programme fait une recherche avec son réseau (${fr(FACTS.azSims)} simulations par coup pour AlphaZero, ${fr(TRAIN.sims)} dans notre miniature), puis joue. À la fin de la partie, chaque position reçoit deux cibles : pour la valeur, le résultat final ; pour la politique, la part des visites de chaque coup. Le réseau apprend à s’en rapprocher.`);
      c.step('Pourquoi le programme progresse', 'La recherche guidée par la politique joue mieux que la politique seule : la part des visites est une meilleure politique que celle de départ. En apprenant à imiter sa propre recherche, la politique s’améliore ; la recherche qu’elle guide s’améliore à son tour. La valeur, elle, apprend des parties de mieux en mieux jouées.');
      c.order('q-loop', 'Remettez dans l’ordre ce qui se passe pour une partie d’auto-jeu.', ['une recherche à chaque coup, guidée par le réseau', 'le coup est joué selon les visites', 'la partie se termine sur un résultat', 'le réseau apprend les visites et le résultat'], 'La recherche choisit les coups ; à la fin, le résultat et les visites deviennent les exemples d’entraînement.');
      c.step('Varier les parties', 'Pendant l’entraînement, AlphaZero ajoute du hasard : un bruit d’exploration sur les probabilités de la racine, et des coups tirés selon leurs visites plutôt que toujours le plus visité. Sans ce hasard, le programme rejouerait les mêmes parties et n’apprendrait rien des positions qu’il ne rencontre jamais.');
      c.diagram('learning');
      c.experiment({
        title: 'Combien de parties d’auto-jeu', prompt: 'Faites varier le nombre de parties d’auto-jeu. La courbe orange mesure la politique seule, la bleue la politique avec la recherche, contre le joueur parfait.',
        predict: { question: 'Au cours de l’entraînement, qui cesse de perdre le premier ?', choices: ['la politique avec la recherche', 'la politique seule', 'les deux en même temps'], answer: 0 },
        controls: [{ type: 'range', key: 'games', label: 'parties d’auto-jeu', min: 0, max: TRAIN.games, step: TRAIN.every, fmt: (x: number) => fr(x) }],
        goals: [
          { label: 'Trouvez un moment où la recherche ne perd plus mais la politique seule perd encore', test: ({ v }) => { const cp = checkpointAt(trainOf(v), v.games); return cp.searchLoss === 0 && cp.netLoss > 0; } },
          { label: 'Trouvez un moment où même la politique seule ne perd plus', test: ({ v }) => { const cp = checkpointAt(trainOf(v), v.games); return cp.netLoss === 0; } },
        ],
        seq: true, conclusion: `La recherche ne perd plus bien avant la politique seule : elle corrige ses erreurs. Après ${fr(TRAIN.games)} parties, même la politique seule ne perd plus contre le joueur parfait. Le programme n’a jamais vu une partie humaine.`,
      });
      c.exercise('targets', 'Dans l’atelier, calculez ce qu’une table apprend d’une partie.');
    });
    c.chapter('AlphaZero, sans connaissance humaine', () => {
      c.stage('selfplay');
      c.diagram('elo');
      c.step('AlphaGo Zero', `En 2017, AlphaGo Zero apprend le go sans aucune partie humaine, à partir des seules règles, avec un seul réseau pour la politique et la valeur. Après ${FACTS.zeroDays} jours et ${fr(FACTS.zeroGames, 1)} millions de parties d’auto-jeu, il bat la version qui avait battu Lee Sedol ${FACTS.zeroVsLee} parties à 0.`);
      c.step('Un seul algorithme pour trois jeux', `AlphaZero applique la même méthode aux échecs, au shogi (les échecs japonais) et au go. Il apprend chaque jeu en partant de zéro : ${FACTS.azHours.chess} heures d’entraînement pour les échecs, ${FACTS.azHours.shogi} pour le shogi, ${FACTS.azGoDays} jours pour le go, et bat les meilleurs programmes de chacun. Il ne reçoit que les règles.`);
      c.step('Ce que la miniature montre', `Dans notre miniature, après ${fr(LAST.games)} parties d’auto-jeu, le programme ne perd plus contre le joueur parfait, avec ou sans recherche. Il ne connaît que les règles du morpion. Ses tables ne contiennent que ${fr(LAST.known)} positions sur ${fr(T.positions)} : il n’a appris que celles que le jeu parfait rencontre.`, {
        claims: [{ text: 'ne perd plus après l’entraînement nominal', check: () => LAST.searchLoss === 0 && LAST.netLoss === 0 }, { text: 'une partie des positions seulement', check: () => LAST.known < T.positions / 4 }],
      });
      c.question('q-zero', 'Qu’a reçu AlphaZero au départ, pour apprendre les échecs ?', ['les règles du jeu seulement', 'des parties de grands maîtres', 'les ouvertures classiques', 'une fonction d’évaluation'], 'Ni parties, ni ouvertures, ni évaluation écrite par des experts : les règles, et du temps de calcul.');
      c.explain('e-search', 'Expliquez pourquoi l’entraînement d’AlphaZero fait une recherche à chaque coup, au lieu de faire jouer directement le réseau contre lui-même.', 'La recherche, guidée par la politique et la valeur, joue mieux que la politique seule : elle vérifie les coups proposés et en corrige certains. La part des visites qu’elle produit sert de cible à la politique, qui apprend donc à jouer comme la recherche. Le réseau s’améliore, ce qui améliore la recherche suivante. Sans recherche, la politique n’aurait pas de meilleur exemple qu’elle-même.');
    });

    // ================================================================ m4
    c.module('m4');
    c.chapter('Le plateau d’assemblage NIST', () => {
      c.stage('robot');
      c.step('Un banc d’essai pour robots', `Le NIST, un institut américain de mesure, propose des plateaux d’assemblage pour comparer les robots : insérer des tiges, visser des écrous, monter des engrenages, brancher des connecteurs. Certaines pièces mesurent ${FACTS.nistSmallMm} mm. Un écrou mal orienté se bloque ou se visse de travers ; avec plusieurs pièces, l’ordre compte.`);
      c.step('L’idée d’AlphaNIST', `AlphaNIST reprend la philosophie d’AlphaZero : apprendre par l’expérience, à grande échelle, sans démonstration humaine. Une seule politique, entraînée en simulation, apprend les ${FACTS.nistTasks} assemblages. Elle va de l’observation à la commande du bras, sans étapes de manipulation prescrites ; chaque essai est un épisode, qui finit par un succès ou un échec.`);
      c.step('Notre miniature', `Notre robot fait un assemblage en cinq sous-étapes : ${STEPS.join(', ')}. Un épisode réussit si toutes ses sous-étapes réussissent : le succès est un produit. Au départ, chaque sous-étape réussit ${pct(ROBOT.q0)} du temps ; la tâche complète, ${fr(Q0_FULL * 1e4, 1)} fois sur dix mille.`, {
        claims: [{ text: 'tâche complète presque impossible au départ', check: () => Q0_FULL < 1e-3 && near(successByLevel(stepProb(Array(5).fill(ROBOT.q0), 1, ROBOT.cap))[4], Q0_FULL, 1e-9) }],
      });
      c.numeric('q-chain', 'Chaque sous-étape réussit 8 fois sur 10. Quel est le taux de succès de la tâche complète, en % ?', 0.8 ** 5 * 100, `0,8⁵ ≈ ${fr(0.8 ** 5, 3)}, soit environ ${pct(0.8 ** 5)}.`, { unit: '%', tol: 1 });
    });
    c.chapter('Une récompense binaire', () => {
      c.stage('robot');
      c.diagram('chain');
      c.ask('q-dense', 'Récompenser le robot chaque fois qu’il se rapproche du but…', ['peut l’enfermer dans une mauvaise manière', 'l’aide toujours à mieux réussir', 'ne change rien au résultat final', 'l’empêche de saisir la pièce'], 'Une récompense pour rester près du but pénalise les détours, même ceux qui mènent au succès.');
      c.step('Un seul signal : réussi ou non', 'AlphaNIST donne au robot une récompense binaire : 1 si l’assemblage réussit, 0 sinon. Rien pour s’approcher ou pour aligner la pièce. C’est la récompense des jeux : on ne gagne qu’à la fin. Le robot reste libre de trouver sa propre manière de réussir.');
      c.step('Le détour utile', `Pour bien orienter un écrou, il vaut parfois mieux le reposer et le reprendre : il s’éloigne d’abord du but. Une récompense dense, qui donne des points pour la distance et l’alignement, pénalise ce détour. Dans notre miniature, un écrou forcé sans être repris ne s’oriente plus que ${pct(ROBOT.cap)} aussi souvent.`);
      c.diagram('rewards');
      c.experiment({
        title: 'Le poids de la récompense dense', prompt: 'Ajoutez une récompense dense, de plus en plus forte, à la récompense binaire. Lisez le succès sur la tâche complète après l’entraînement.',
        predict: { question: 'Avec une forte récompense dense, après l’entraînement, le robot…', choices: ['ne reprend jamais l’écrou et plafonne', 'réussit mieux qu’avec la binaire', 'réussit exactement pareil'], answer: 0 },
        controls: [{ type: 'range', key: 'w', label: 'poids de la récompense dense', min: 0, max: 1, step: 0.05, fmt: dec(2) }],
        goals: [
          { label: 'Avec la seule récompense binaire (0), vérifiez que le robot maîtrise la tâche', test: ({ v }) => v.w === 0 && robot(v).outcome === 'mastered' },
          { label: 'Trouvez un poids avec lequel le robot plafonne', test: ({ v }) => robot(v).outcome === 'capped' },
          { label: 'Trouvez un petit poids, non nul, avec lequel il maîtrise encore la tâche', test: ({ v }) => v.w > 0 && robot(v).outcome === 'mastered' },
        ],
        seq: true, conclusion: 'Un peu de récompense dense accélère le début de l’apprentissage. Au-delà d’un poids de 0,5 environ, reposer l’écrou coûte plus de points qu’il n’en rapporte : le robot apprend à le forcer et plafonne vers 40 % de succès. Il a appris ce qu’on récompensait, pas ce qu’on voulait.',
      });
      c.diagram('nist');
      c.step('Ce qu’AlphaNIST a mesuré', `Avec une politique partagée et la récompense binaire, AlphaNIST réussit ${pct1(FACTS.nist.sharedBinary)} des assemblages à l’entraînement. En ajoutant des récompenses pour l’approche et l’alignement, ce taux tombe à ${pct1(FACTS.nist.sharedDense)}. Notre miniature reproduit le sens de l’effet, pas ses chiffres.`);
      c.question('q-nist', 'Pourquoi la récompense dense a-t-elle fait baisser le succès d’AlphaNIST ?', ['elle récompense des gestes, pas le résultat', 'elle donne trop peu de signal au robot', 'elle empêche la simulation de tourner', 'elle oblige à séparer les politiques'], 'Le robot optimise ce qui est récompensé : rester près du but et aligné, même quand cela empêche de réussir.');
    });
    c.chapter('Choisir où commencer', () => {
      c.stage('robot');
      c.diagram('chain', { arg: '0' });
      c.step('Le problème du signal rare', `En partant des pièces détachées, le robot réussit au début ${fr(Q0_FULL * 1e4, 1)} fois sur dix mille. Avec une récompense binaire, des épisodes tous ratés n’apprennent rien : rien ne distingue un bon essai d’un mauvais. Un épisode apprend surtout quand son issue est incertaine ; dans le modèle, en proportion de P(1 − P).`);
      c.step('Partir près du but', 'AlphaNIST fait aussi commencer des épisodes plus près du but : pièce déjà en main, assemblage partiel gardé d’un épisode précédent. Ce ne sont pas des démonstrations : on ne montre pas comment faire, on choisit seulement où commencer. Près du but, le robot réussit vite ; sa compétence remonte ensuite vers le début de la tâche.');
      c.diagram('curriculum');
      c.experiment({
        title: 'Où commencer les épisodes', prompt: 'Choisissez comment les états de départ sont tirés, et lisez le succès sur la tâche complète.',
        predict: { question: 'En partant toujours des pièces détachées, avec la récompense binaire, le robot…', choices: ['n’apprend rien', 'apprend lentement', 'apprend le plus vite'], answer: 0 },
        controls: [{ type: 'choice', key: 'sampler', label: 'états de départ', options: [{ label: 'tâche complète seule', value: 2 }, { label: 'uniforme', value: 0 }, { label: 'guidé par le succès', value: 1 }] }],
        goals: [
          { label: 'Vérifiez qu’en partant toujours des pièces détachées, le robot reste bloqué', test: ({ v }) => robot(v).outcome === 'stuck' },
          { label: 'Trouvez un tirage qui progresse, mais trop lentement', test: ({ v }) => robot(v).outcome === 'slow' },
          { label: 'Trouvez un tirage qui maîtrise la tâche complète', test: ({ v }) => robot(v).outcome === 'mastered' },
        ],
        seq: true, conclusion: 'Sans état de départ facile, aucun succès, donc aucun signal. Le tirage uniforme apprend, mais dépense beaucoup d’épisodes sur des états déjà maîtrisés ou encore impossibles. Le tirage guidé par le succès concentre les épisodes là où ils apprennent le plus.',
      });
      c.diagram('sgs');
      c.step('Viser une réussite sur deux', `SGS, l’échantillonnage guidé par le succès, donne à chaque état de départ un poids qui dépend de son taux de succès : une bosse autour d’une cible, ici ${pct(ROBOT.target)}, avec un plancher de ${pct(ROBOT.floor)}. Le poids est faible tant que l’état n’est jamais réussi, fort quand il progresse, faible de nouveau quand il est maîtrisé.`, { tools: ['S1'] });
      c.diagram('curriculum');
      c.experiment({
        title: 'La cible de SGS', prompt: 'Changez le taux de succès que SGS favorise.',
        predict: { question: 'Si SGS favorise les états réussis 95 % du temps, le robot…', choices: ['s’entraîne surtout sur ce qu’il sait déjà', 'apprend plus vite', 'apprend exactement pareil'], answer: 0 },
        controls: [{ type: 'range', key: 'target', label: 'taux visé', min: 0.02, max: 0.95, step: 0.01, fmt: pct }],
        goals: [
          { label: 'Trouvez une cible avec laquelle le robot maîtrise la tâche complète', test: ({ v }) => robot(v).outcome === 'mastered' },
          { label: 'Trouvez une cible trop haute : l’entraînement réussit, la tâche complète échoue', test: ({ v }) => robot(v).outcome === 'easy' },
          { label: 'Trouvez une cible trop basse : le robot progresse trop lentement', test: ({ v }) => v.target < ROBOT.target && robot(v).outcome === 'slow' },
        ],
        seq: true, conclusion: 'De 5 à 60 % environ, le robot maîtrise la tâche en 250 itérations. Au-delà, il s’entraîne sur des états qu’il réussit déjà : ses épisodes réussissent presque tous, mais la tâche complète n’avance pas. Très bas, il insiste sur des états encore impossibles.',
      });
      c.exercise('chainCalc', 'Dans l’atelier, calculez le succès d’une chaîne de sous-étapes.');
      c.exercise('sgsSort', 'Dans l’atelier, dites quels états de départ SGS tire souvent.');
      c.explain('e-sgs', 'Expliquez pourquoi, avec une récompense binaire, il faut faire commencer des épisodes ailleurs qu’au début de la tâche, et pourquoi SGS favorise les états réussis environ une fois sur deux.', 'Avec une récompense binaire, un épisode n’apprend quelque chose que si l’on peut comparer des réussites et des échecs. Depuis le début de la tâche, le robot échoue toujours : aucun signal. Près du but, il réussit parfois, et il apprend les dernières sous-étapes, puis les précédentes. Un état réussi une fois sur deux a l’issue la plus incertaine : c’est là qu’un épisode apprend le plus. Les états maîtrisés ou impossibles apprennent peu.');
    });
    c.chapter('Ce qui émerge', () => {
      c.stage('robot');
      c.step('Des gestes que personne n’a programmés', 'Comme AlphaGo et son coup inattendu, la politique d’AlphaNIST trouve des comportements émergents : elle repose une pièce et la reprend pour mieux l’orienter, se sert du plateau pour faire tourner un connecteur, fait rouler un écrou posé sur sa tranche, pousse une tige du bout d’un doigt avant de la saisir.');
      c.step('Les limites', `Les résultats d’AlphaNIST sont mesurés en simulation, sur les tâches de l’entraînement ; passer à un vrai robot est un autre défi. Pour des enchaînements de dix pièces, la page du projet rapporte ${FACTS.nistTenParts} essais réussis, avec une politique entraînée à part. Notre miniature est un jouet : une chaîne de cinq sous-étapes, entraînée en moyenne, sans capteurs ni physique.`);
      c.question('q-emerge', 'Pourquoi une récompense binaire laisse-t-elle apparaître des gestes inattendus ?', ['seul le résultat compte, pas la manière', 'elle récompense chaque geste utile', 'elle copie les gestes des humains', 'elle interdit les gestes habituels'], 'Tout geste qui mène plus souvent au succès est renforcé, même si personne ne l’avait imaginé.');
    });
    c.clinicCase({
      id: 'clin-explore', title: 'un programme qui rejoue toujours les mêmes parties', scene: 'selfplay', fault: { explore: 0 },
      observe: `Après ${fr(TRAIN.games)} parties d’auto-jeu, le programme perd encore contre le joueur parfait. En rejouant ses parties d’entraînement, on constate qu’il n’a joué que ${fr(trainOf({ explore: 0 }).distinct)} parties différentes, toujours les mêmes.`,
      choices: ['le bruit d’exploration, réglé à zéro', 'les simulations par coup, trop peu nombreuses', 'le nombre de parties, trop faible'],
      explain: 'Sans bruit ni tirage selon les visites, la recherche est entièrement déterminée par les tables : chaque partie reproduit la précédente.',
      diagram: 'learning',
      controls: [
        { type: 'choice', key: 'explore', label: 'bruit d’exploration', options: EXPLORE_OPTS },
        { type: 'choice', key: 'tsims', label: 'simulations par coup', options: TSIMS_OPTS },
      ],
      goal: { label: 'Le programme ne perd plus contre le joueur parfait', test: (v) => trainOf(v).outcome === 'unbeatable' },
      conclusion: 'Avec un bruit d’exploration de 0,5 ou plus, les parties varient, les tables couvrent les positions que le joueur parfait peut atteindre, et le programme ne perd plus.',
      justify: 'Le symptôme : les parties d’entraînement sont toujours les mêmes et le programme perd encore. La cause : un bruit d’exploration nul. La recherche et le choix du coup sont alors entièrement déterminés par les tables ; chaque partie reproduit la précédente, et les tables n’apprennent rien des positions jamais jouées. Le joueur parfait l’y emmène. Avec du bruit, les parties varient et couvrent ces positions.',
    });
    c.clinicCase({
      id: 'clin-target', title: 'un entraînement qui réussit presque tout, sauf la tâche', scene: 'robot', fault: { target: 0.95 },
      observe: `Le tableau de bord de l’entraînement affiche ${pct(robotOf({ target: 0.95 }).final.train)} d’épisodes réussis. Pourtant, en partant des pièces détachées, le robot ne réussit l’assemblage que ${pct(robotOf({ target: 0.95 }).final.P[4])} du temps.`,
      choices: ['la cible de SGS, beaucoup trop haute', 'la récompense dense, trop forte', 'les épisodes, tous tirés au début de la tâche'],
      explain: 'SGS favorise les états réussis 95 % du temps : presque tous les épisodes partent d’états déjà maîtrisés, près du but.',
      diagram: 'curriculum',
      controls: [
        { type: 'range', key: 'target', label: 'taux visé par SGS', min: 0.02, max: 0.95, step: 0.01, fmt: pct },
        { type: 'range', key: 'w', label: 'poids de la récompense dense', min: 0, max: 1, step: 0.05, fmt: dec(2) },
      ],
      goal: { label: 'Le robot maîtrise la tâche complète', test: (v) => robotOf(v).outcome === 'mastered' },
      conclusion: 'Avec une cible autour de 50 %, les épisodes se déplacent vers les états qui progressent, et la compétence remonte jusqu’au début de la tâche.',
      justify: 'Le symptôme : presque tous les épisodes réussissent, mais la tâche complète échoue. La cause : une cible de SGS trop haute, qui tire surtout des états déjà maîtrisés près du but. Ces épisodes réussis n’apprennent presque rien, car leur issue est certaine. En visant environ une réussite sur deux, on tire les états dont l’issue est incertaine, plus loin du but, et le robot progresse.',
    });

    // ============================================================== exam
    c.module('exam');
    c.clinicCase({
      id: 'exam-dense', exam: true, title: 'un écrou qui se coince de travers', scene: 'robot', fault: { w: 0.8 },
      observe: `Le robot saisit l’écrou, l’amène et l’aligne parfaitement au-dessus du boulon. Mais l’écrou se coince de travers dans plus de la moitié des essais : le robot ne réussit que ${pct(robotOf({ w: 0.8 }).final.P[4])} du temps. On ne le voit jamais reposer l’écrou pour le reprendre.`,
      choices: ['la récompense dense, trop forte', 'la cible de SGS, trop haute', 'les épisodes, tous tirés au début de la tâche'],
      explain: 'La récompense dense paie le robot pour rester près du but et aligné : reposer l’écrou lui coûte des points.',
      diagram: 'rewards',
      controls: [
        { type: 'range', key: 'w', label: 'poids de la récompense dense', min: 0, max: 1, step: 0.05, fmt: dec(2) },
        { type: 'range', key: 'target', label: 'taux visé par SGS', min: 0.02, max: 0.95, step: 0.01, fmt: pct },
      ],
      goal: { label: 'Le robot maîtrise la tâche complète', test: (v) => robotOf(v).outcome === 'mastered' },
      conclusion: 'Avec une récompense dense faible ou nulle, le détour par la reprise de l’écrou redevient payant, et le robot l’apprend.',
      justify: 'Le symptôme : le robot approche et aligne bien, mais force l’écrou, qui se coince ; il ne le reprend jamais. La cause : une récompense dense trop forte. Elle récompense la proximité et l’alignement ; reposer l’écrou pour le réorienter éloigne la pièce du but et coûte plus de points que le succès n’en rapporte. Avec la seule récompense binaire, seul le succès compte, et le détour est appris.',
    });
    c.chapter('Test final', () => {
      c.stage('go');
      c.step('Le test final', 'Ce test reprend les notions du test de départ, dans d’autres situations. Comparez ensuite vos deux résultats, notion par notion.');
      c.test('post', 'Le test final.');
    });
  },
});

export default Object.assign(course, { workshop });
