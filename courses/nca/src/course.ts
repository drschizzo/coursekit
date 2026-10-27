// Raisonner avec des automates cellulaires neuronaux: a course on the paper
// « Reasoning with Neural Cellular Automata » (Etcheverry et al., 2026,
// arXiv 2609.36126). A learner who knows a little programming follows how a
// grid of cells that only see their neighbours can solve a maze or a
// constraint puzzle, why randomness helps them, and how the paper trains and
// runs them. The figures of the text, the diagrams, the stage and the
// exercises all run ./model.ts; the paper's own results come from PAPER.

import { choice, dec, defineCourse, fr, numeric, pct, type Capsule } from '@coursekit/core';
import { choiceQ, type Exercise, type WorkshopConfig } from '@coursekit/exercises';
import { COL, DIAGRAMS, drawGrid, drawMaze } from './diagrams.ts';
import {
  GRID, MAZE, PAPER, atLeastOne, gridRate, makeMaze, mazeOf, model, ncaParams, pruneShare, replayOlder, rollGrid,
  rollMaze, spread, stepsNeeded, trialsOf, type CellState,
} from './model.ts';
import { CC } from '@coursekit/diagrams';

const near = (a: number, b: number, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel;
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

// ------------------------------------------------- figures of the text

/** steps for a signal from the centre to reach the whole 21 × 21 grid */
const fullAt = (p: number): number => { for (let t = 0; t < 200; t++) if (spread(21, t, p).every((x) => x === 1)) return t; return -1; };
const F1 = fullAt(1), F08 = fullAt(PAPER.pFire);

const P_NCA = ncaParams(PAPER.mazeC, PAPER.mazeHeads, PAPER.mazeE);
const Z = PAPER.mazeHeads * PAPER.mazeC, HID = PAPER.mazeE * Z;

const NOM = mazeOf({});                       // the nominal maze: 21 × 21, seed 1, 300 steps
const MZ = makeMaze(MAZE.side, MAZE.seed);
/** step at which every open cell of the nominal maze is reached */
const EXPLORED = NOM.frames.findIndex((f) => f.every((s, i) => MZ.wall[i] || s > 0));
const NEED9 = median(stepsNeeded(9, PAPER.pFire)), NEED61 = median(stepsNeeded(61, PAPER.pFire));
const AREA = (PAPER.mazeBig / PAPER.mazeTrain) ** 2;

const R_ASYNC = gridRate(PAPER.pFire, 0, 0.5), R_SYNC = gridRate(1, 0, 0.5);
const R_NOISE = gridRate(PAPER.pFire, 0.02, 0.5), R_NEVER = gridRate(PAPER.pFire, 0.02, 1);
const R_SLOW = gridRate(0.02, 0, 0.5);

const U41 = rollMaze({ side: 41, D: 1500 }), A41 = rollMaze({ side: 41, D: 1500, adaptive: true, plow: PAPER.pLow });
const DU = mazeOf({ side: 41, D: 3000, damage: 1, adaptive: 0 }), DA = mazeOf({ side: 41, D: 3000, damage: 1, adaptive: 1 });

const N = PAPER.mazeN, RS = PAPER.mazeSeedRatio;

// ------------------------------------------------------------- toolbox

const CAPSULES: Capsule[] = [
  {
    id: 'G1', title: 'Distances sur une grille',
    goal: 'Compter le nombre minimal de pas entre deux cases d’une grille, selon le voisinage.',
    used: 'La vitesse à laquelle une information traverse un automate cellulaire.',
    steps: [
      { title: 'Repérer une case', text: 'Une case d’une grille se repère par sa colonne x et sa ligne y. Entre deux cases, on note dx l’écart des colonnes et dy l’écart des lignes, en valeur absolue.' },
      { title: 'Avec les diagonales', diagram: 'cone', text: 'Si l’on peut aller vers les huit voisines, un pas en diagonale avance à la fois en x et en y. Le nombre minimal de pas vaut alors le plus grand des deux écarts : max(dx, dy).', code: 'pas = Math.max(dx, dy)' },
      { title: 'Par les côtés seulement', text: 'Si l’on ne peut aller que vers les quatre voisines par les côtés, il faut parcourir les deux écarts l’un après l’autre : dx + dy. Dans un labyrinthe, les murs allongent encore le trajet.', code: 'pas = dx + dy' },
    ],
    check: [
      numeric('Avec les huit voisines, combien de pas au minimum de la case (0, 0) à la case (5, 3) ?', 5, 'max(5, 3) = 5 : trois pas en diagonale, puis deux pas en ligne droite.'),
      choice('Par les côtés seulement, combien de pas de (0, 0) à (5, 3) ?', ['8', '5', '3', '15'], 'dx + dy = 5 + 3 = 8.'),
    ],
  },
  {
    id: 'R1', title: 'Une couche de neurones',
    goal: 'Compter les paramètres d’une couche de neurones : poids et biais.',
    used: 'Le nombre de paramètres d’un automate cellulaire neuronal.',
    steps: [
      { title: 'Un neurone', text: 'Un neurone reçoit n nombres, les multiplie chacun par un poids, ajoute le tout et un biais, puis applique une fonction simple (par exemple, remplacer les valeurs négatives par 0). Il a donc n poids et un biais.', code: 'y = relu(w1·x1 + … + wn·xn + b)' },
      { title: 'Une couche', diagram: 'params', text: 'Une couche de m neurones qui lisent les mêmes n entrées a m × n poids et m biais : n × m + m paramètres. Les paramètres sont les nombres que l’apprentissage règle.' },
      { title: 'Deux couches à la suite', text: 'Quand une couche de m neurones alimente une couche de k neurones, la seconde a m × k + k paramètres. Le total d’un réseau est la somme des paramètres de ses couches.' },
    ],
    check: [
      numeric('Une couche relie 10 entrées à 4 neurones. Combien a-t-elle de paramètres ?', 44, '10 × 4 poids + 4 biais = 44.'),
      choice('On double le nombre d’entrées d’une couche, sans changer le nombre de neurones. Le nombre de poids…', ['double', 'ne change pas', 'est multiplié par quatre', 'augmente de deux'], 'Chaque neurone a un poids par entrée : deux fois plus d’entrées, deux fois plus de poids.'),
    ],
  },
  {
    id: 'P1', title: 'La probabilité d’au moins un succès',
    goal: 'Calculer la probabilité qu’au moins un essai réussisse parmi K essais indépendants.',
    used: 'Les essais en parallèle : lancer K déroulements et garder le meilleur.',
    steps: [
      { title: 'Des essais indépendants', text: 'Deux essais sont indépendants quand le résultat de l’un ne change pas les chances de l’autre. La probabilité que deux événements indépendants arrivent tous les deux est le produit de leurs probabilités.' },
      { title: 'Tous échouent', text: 'Si un essai réussit avec la probabilité p, il échoue avec la probabilité 1 − p. Les K essais échouent tous avec la probabilité (1 − p) × … × (1 − p) = (1 − p)^K.', code: 'tousRates = (1 - p) ** K' },
      { title: 'Au moins un réussit', diagram: 'trials', text: '« Au moins un succès » est le contraire de « tous échouent ». Sa probabilité vaut donc 1 − (1 − p)^K. Elle approche 1 très vite quand K augmente, même si p est modeste.', code: 'auMoinsUn = 1 - (1 - p) ** K' },
    ],
    check: [
      numeric('Un essai réussit avec la probabilité 0,5. Quelle est la probabilité qu’au moins un de 3 essais réussisse ?', 0.875, '1 − 0,5³ = 1 − 0,125 = 0,875.', { tol: 0.005 }),
      choice('Un essai réussit avec la probabilité 0,1. Avec 10 essais, au moins un réussit avec une probabilité…', ['d’environ 0,65', 'égale à 1', 'égale à 0,1', 'd’environ 0,01'], '1 − 0,9¹⁰ ≈ 1 − 0,35 = 0,65 : ce n’est pas une certitude.'),
    ],
  },
];

// ----------------------------------------------------------- exercises

type Rule = (c: CellState, nb: CellState[]) => CellState;
const mazeTrace = (rule: Rule | undefined, side: number, seed: number) => rollMaze({ side, seed, D: 400, rule }).frames.map((f) => f.reduce((s, x) => s + x, 0));
const gridTrace = (rule: ((c: number, nb: number[]) => number) | undefined, q: object) => rollGrid({ ...q, rule }, false).conflicts;

/** the learner's run, computed once per compiled function (the preview draws every frame) */
const previewRuns = new WeakMap<Function, ReturnType<typeof rollMaze> | null>();

function mazePreview(ctx: CanvasRenderingContext2D, fn: Function | null): void {
  ctx.fillStyle = CC.blue; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (!fn) { ctx.fillText('écrivez votre fonction', 20, 20); return; }
  if (!previewRuns.has(fn)) { try { previewRuns.set(fn, rollMaze({ D: 400, rule: fn as Rule })); } catch { previewRuns.set(fn, null); } }
  const r = previewRuns.get(fn);
  if (!r) { ctx.fillText('votre fonction lève une erreur', 20, 20); return; }
  drawMaze(ctx, r, r.frames[r.steps], 20, 30, 190);
  ctx.fillStyle = CC.fg;
  ctx.fillText(`après ${fr(r.steps)} pas : ${fr(r.wrong[r.steps])} cases mal classées`, 20, 18);
  ctx.fillStyle = COL.reached; ctx.fillText('atteinte et vivante', 226, 60);
  ctx.fillStyle = '#9fb3ff'; ctx.fillText('morte', 226, 80);
}

/** both of the learner's rules at work: the maze and the noisy grid, as they end */
const assemblyRuns = new WeakMap<Function, { maze: ReturnType<typeof rollMaze>; grid: ReturnType<typeof rollGrid> } | null>();

function assemblyPreview(ctx: CanvasRenderingContext2D, cellRule: Rule, colorRule: (c: number, nb: number[]) => number): void {
  ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (!assemblyRuns.has(cellRule) || !assemblyRuns.has(colorRule)) {
    let v: { maze: ReturnType<typeof rollMaze>; grid: ReturnType<typeof rollGrid> } | null = null;
    try { v = { maze: rollMaze({ D: 400, rule: cellRule }), grid: rollGrid({ seed: 3, eta: 0.02, rule: colorRule }) }; } catch { v = null; }
    assemblyRuns.set(cellRule, v); assemblyRuns.set(colorRule, v);
  }
  const r = assemblyRuns.get(cellRule);
  if (!r) { ctx.fillStyle = CC.red; ctx.fillText('une de vos fonctions lève une erreur', 20, 20); return; }
  drawMaze(ctx, r.maze, r.maze.frames[r.maze.steps], 20, 40, 160);
  drawGrid(ctx, r.grid.n, r.grid.frames[r.grid.frames.length - 1], 200, 40, 160);
  ctx.fillStyle = CC.fg;
  const w = r.maze.wrong[r.maze.steps], k = r.grid.conflicts[r.grid.conflicts.length - 1], sx = (n: number) => (n > 1 ? 's' : '');
  ctx.fillText(`labyrinthe : ${fr(w)} case${sx(w)} mal classée${sx(w)}`, 20, 24);
  ctx.fillText(`grille : ${fr(k)} conflit${sx(k)}`, 200, 216);
}

const exercises: Exercise[] = [
  {
    id: 'params', module: 'm1', kind: 'calculation', title: 'Les paramètres de la NCA des labyrinthes',
    intro: `La NCA de l’article pour les labyrinthes a ${fr(PAPER.mazeC)} canaux par cellule. Sa perception a ${fr(PAPER.mazeHeads)} têtes : chacune combine les 9 cellules du voisinage avec 9 poids et donne un vecteur de ${fr(PAPER.mazeC)} nombres. Son réseau a deux couches : la première a ${fr(PAPER.mazeE)} fois plus de neurones que d’entrées, la seconde rend ${fr(PAPER.mazeC)} nombres.`,
    steps: [
      { prompt: 'Combien de nombres le vecteur de perception contient-il (toutes les têtes mises bout à bout) ?', value: Z, explain: `${fr(PAPER.mazeHeads)} têtes × ${fr(PAPER.mazeC)} nombres = ${fr(Z)}.` },
      { prompt: `La première couche a ${fr(HID)} neurones. Combien a-t-elle de paramètres ?`, value: Z * HID + HID, explain: `${fr(Z)} × ${fr(HID)} poids + ${fr(HID)} biais = ${fr(Z * HID + HID)}.` },
      { prompt: 'Combien de paramètres la NCA a-t-elle en tout (perception, première et seconde couche) ?', value: P_NCA, explain: `${fr(PAPER.mazeHeads * 9)} + ${fr(Z * HID + HID)} + ${fr(HID * PAPER.mazeC + PAPER.mazeC)} = ${fr(P_NCA)}, les « 10K » du tableau 1 de l’article.` },
    ],
    win: `Une dizaine de milliers de paramètres suffisent, quelle que soit la taille de la grille.`,
  },
  {
    id: 'local', module: 'm2', kind: 'classify', title: 'Ce qu’une cellule peut savoir',
    intro: 'Une cellule du labyrinthe voit son état et celui de ses quatre voisines par les côtés, rien d’autre. Classez chaque information.',
    categories: ['une cellule peut le savoir seule', 'aucune cellule ne le sait seule'],
    items: [
      { text: 'si sa voisine de gauche est un mur', cat: 0 },
      { text: 'si une de ses voisines est déjà atteinte', cat: 0 },
      { text: 'combien de ses voisines sont encore vivantes', cat: 0 },
      { text: 'la longueur totale du chemin', cat: 1, why: 'il faudrait voir tout le chemin' },
      { text: 'la taille de la grille', cat: 1, why: 'rien dans son voisinage ne l’indique' },
      { text: 'si le labyrinthe est déjà résolu partout', cat: 1 },
    ],
    win: 'Chaque cellule ne décide qu’avec ce qu’elle voit ; la solution naît des échanges répétés.',
  },
  {
    id: 'rule', module: 'm2', kind: 'code', title: 'La règle d’une cellule du labyrinthe', slot: 'cellRule',
    sig: 'function cellRule(c, nb)',
    doc: 'c : l’état de la cellule, {reached, dead} (deux booléens : atteinte, morte) · nb : la liste des états de ses voisines libres par les côtés (les murs ne sont pas dans la liste), chacun {reached, dead}. Renvoie le nouvel état {reached, dead}. Les extrémités n’appellent pas la règle.',
    goal: 'Explorer : la cellule devient atteinte si elle l’était ou si une voisine l’est. Élaguer : elle meurt si elle était morte, ou si elle est atteinte et qu’au plus une de ses voisines est encore vivante.',
    solution: `function cellRule(c, nb) {
  const reached = c.reached || nb.some((n) => n.reached);
  const alive = nb.filter((n) => !n.dead).length;
  const dead = c.dead || (reached && alive <= 1);
  return { reached, dead };
}`,
    starter: `function cellRule(c, nb) {
  // 1. atteinte : déjà atteinte, ou une voisine atteinte
  // 2. compter les voisines encore vivantes
  // 3. morte : déjà morte, ou atteinte avec au plus une voisine vivante
  return { reached: c.reached, dead: c.dead };
}`,
    hints: [
      'nb.some((n) => n.reached) vaut vrai si au moins une voisine est atteinte.',
      'Les voisines vivantes sont celles dont dead vaut faux : nb.filter((n) => !n.dead).length.',
      'Une cellule morte le reste : dead = c.dead || (…).',
    ],
    win: 'Votre règle trouve le chemin exactement comme la référence : la vague, puis l’élagage.',
    primm: {
      intro: 'Voici une règle incomplète. Lisez-la avant de l’exécuter.',
      code: `function cellRule(c, nb) {
  const reached = c.reached || nb.some((n) => n.reached);
  return { reached, dead: c.dead };
}`,
      predict: choiceQ('Avec cette règle, que deviennent les cases libres du labyrinthe ?', ['elles finissent toutes atteintes', 'seul le chemin est atteint', 'aucune n’est atteinte'], 'La vague passe dans toutes les branches : rien ne l’arrête, et rien ne meurt.'),
      investigate: choiceQ('Pourquoi la réponse lue à la fin est-elle fausse ?', ['les impasses restent vivantes', 'le chemin n’est pas atteint', 'les murs deviennent atteints'], 'Une case atteinte et vivante est lue « sur le chemin » : sans élagage, les impasses le sont aussi.'),
      modify: 'Ajoutez l’élagage : une cellule atteinte qui a au plus une voisine vivante meurt.',
    },
    scenarios: [
      { name: 'labyrinthe 21 × 21 (graine 1)', run: (impl) => mazeTrace(impl.cellRule as Rule, 21, 1), tol: 0 },
      { name: 'labyrinthe 13 × 13 (graine 2)', run: (impl) => mazeTrace(impl.cellRule as Rule, 13, 2), tol: 0 },
    ],
    preview: (ctx, fn) => mazePreview(ctx, fn),
  },
  {
    id: 'color', module: 'm3', kind: 'code', title: 'La règle d’une cellule de la grille', slot: 'colorRule', parsons: true,
    sig: 'function colorRule(color, nb)',
    doc: 'color : la couleur de la cellule, 0 ou 1 · nb : la liste des couleurs de ses voisines par les côtés (deux, trois ou quatre selon sa place). Renvoie la nouvelle couleur.',
    goal: 'Comptez les voisines qui ont la même couleur que la cellule. Si elles sont au moins la moitié, la cellule change de couleur (1 − color) ; sinon, elle la garde.',
    solution: `function colorRule(color, nb) {
  let same = 0;
  for (const c of nb) {
    if (c === color) same++;
  }
  if (2 * same >= nb.length) return 1 - color;
  return color;
}`,
    starter: `function colorRule(color, nb) {
  // compter les voisines de même couleur
  // changer de couleur si c'est au moins la moitié
  return color;
}`,
    hints: [
      'Parcourez nb avec une boucle for…of et comptez les valeurs égales à color.',
      '« Au moins la moitié » s’écrit 2 * same >= nb.length, sans division.',
      'Changer de couleur : renvoyer 1 - color (1 devient 0, 0 devient 1).',
    ],
    win: 'Votre règle donne les mêmes conflits, pas après pas, que la référence.',
    scenarios: [
      { name: 'graine 1, sans bruit', run: (impl) => gridTrace(impl.colorRule as never, { seed: 1 }), tol: 0 },
      { name: 'graine 3, avec bruit', run: (impl) => gridTrace(impl.colorRule as never, { seed: 3, eta: 0.02 }), tol: 0 },
      { name: 'graine 2, synchrone', run: (impl) => gridTrace(impl.colorRule as never, { seed: 2, p: 1 }), tol: 0 },
    ],
  },
  {
    id: 'trialsCalc', module: 'm3', kind: 'calculation', title: 'Trois essais valent-ils mieux qu’un ?',
    intro: `Sur 200 grilles, sans bruit, un déroulement résout la grille avec une probabilité p ≈ ${fr(R_ASYNC, 3)}. On lance 3 déroulements indépendants et on garde celui qui a le moins de conflits.`,
    steps: [
      { prompt: 'Quelle est la probabilité qu’un déroulement échoue ?', value: 1 - R_ASYNC, tol: 0.002, explain: `1 − ${fr(R_ASYNC, 3)} = ${fr(1 - R_ASYNC, 3)}.` },
      { prompt: 'Quelle est la probabilité que les trois échouent ?', value: (1 - R_ASYNC) ** 3, tol: 0.0005, explain: `${fr(1 - R_ASYNC, 3)}³ ≈ ${fr((1 - R_ASYNC) ** 3, 4)}.` },
      { prompt: 'Quelle est la probabilité qu’au moins un réussisse ?', value: atLeastOne(R_ASYNC, 3), tol: 0.002, explain: `1 − ${fr((1 - R_ASYNC) ** 3, 4)} ≈ ${fr(atLeastOne(R_ASYNC, 3), 3)}. Le choix par le nombre de conflits trouve toujours l’essai réussi : il est le seul à n’en avoir aucun.` },
    ],
    win: 'Trois essais font passer la réussite d’environ quatre sur cinq à presque toujours.',
  },
  {
    id: 'replayCalc', module: 'm4', kind: 'calculation', title: 'L’âge des états du réservoir',
    intro: `Dans l’article, pour les labyrinthes, chaque lot est déroulé sur N = ${fr(N)} pas, et une part r = ${fr(RS, 2)} du lot est remplacée par des problèmes neufs. Un état qui n’est pas remplacé a déjà été déroulé une fois de plus.`,
    steps: [
      { prompt: 'Quelle est la probabilité qu’un état tiré ne soit pas remplacé ?', value: 1 - RS, explain: `1 − ${fr(RS, 2)} = ${fr(1 - RS, 2)}.` },
      { prompt: `Quelle est la probabilité qu’un déroulement commence après au moins 3 déroulements, soit ${fr(3 * N)} pas ?`, value: replayOlder(RS, 3), tol: 0.005, explain: `Il faut avoir échappé trois fois au remplacement : ${fr(1 - RS, 2)}³ ≈ ${fr(replayOlder(RS, 3), 3)}.` },
      { prompt: `Et après au moins ${fr(10 * N)} pas ?`, value: replayOlder(RS, 10), tol: 0.003, explain: `${fr(1 - RS, 2)}¹⁰ ≈ ${fr(replayOlder(RS, 10), 3)} : environ un déroulement sur ${fr(1 / replayOlder(RS, 10))}.` },
    ],
    win: `Sans jamais dérouler plus de ${fr(N)} pas d’un coup, l’entraînement voit des états qui ont vécu plus de ${fr(10 * N)} pas.`,
  },
  {
    id: 'training', module: 'm4', kind: 'sequence', title: 'Une itération d’entraînement',
    intro: 'Remettez dans l’ordre une itération d’entraînement d’une NCA avec réservoir (annexe B.2 de l’article).',
    items: ['tirer un lot d’états dans le réservoir', 'remplacer une partie du lot par des problèmes neufs', 'perturber les états (bruit, zones effacées)', 'dérouler la règle pendant N pas', 'comparer à la solution et corriger les poids', 'remettre les états dans le réservoir'],
    explain: 'Le lot vient du réservoir et se renouvelle en partie ; les perturbations précèdent le déroulement ; les poids sont corrigés d’après l’écart à la solution ; les états, une fois déroulés, retournent au réservoir.',
    win: 'C’est la boucle d’entraînement de toutes les NCA de l’article.',
  },
];

const workshop: WorkshopConfig = {
  assembly: {
    title: 'Mes deux règles',
    intro: 'Votre règle du labyrinthe résout deux labyrinthes, votre règle de couleur fait tourner trois grilles. Les résultats sont comparés à ceux de la référence, pas après pas.',
    scenarios: [
      { name: 'labyrinthe 21 × 21 (graine 1)', run: (impl) => mazeTrace(impl.cellRule as Rule, 21, 1), tol: 0 },
      { name: 'labyrinthe 29 × 29 (graine 4)', run: (impl) => mazeTrace(impl.cellRule as Rule, 29, 4), tol: 0 },
      { name: 'grille, graine 3, avec bruit', run: (impl) => gridTrace(impl.colorRule as never, { seed: 3, eta: 0.02 }), tol: 0 },
    ],
    chart: { label: 'cases mal classées, labyrinthe 21 × 21', run: (impl) => rollMaze({ D: 400, rule: impl.cellRule as Rule }).wrong },
    preview: (ctx, impl) => assemblyPreview(ctx, impl.cellRule as Rule, impl.colorRule as (c: number, nb: number[]) => number),
  },
};

// --------------------------------------------------------------- course

const isSolved = (v: Record<string, number>) => mazeOf(v).outcome === 'solved';
const gridIs = (v: Record<string, number>, o: string) => trialsOf({ ...v, K: 1 }).runs[0].outcome === o;
const full = (v: Record<string, number>) => spread(21, Math.round(v.steps), v.cp).every((x) => x === 1);

export default defineCourse({
  workshop,
  id: 'nca', version: 1, language: 'fr',
  title: 'Raisonner avec des automates cellulaires neuronaux',
  lead: 'Une grille de cellules qui ne voient que leurs voisines peut-elle résoudre un labyrinthe ou une grille de contraintes ? Ce cours suit l’article « Reasoning with Neural Cellular Automata » (Etcheverry et al., 2026) : comment l’information circule de proche en proche, pourquoi le hasard aide, comment on entraîne ces automates et comment ils économisent leur calcul. Chaque chiffre est calculé par deux petits automates que vous pouvez faire varier.',
  audience: { level: 'fin de lycée (spécialité NSI) ou début de licence', prerequisites: 'Les bases de la programmation (fonctions, boucles, listes) et les probabilités du lycée. Les distances sur une grille, les couches de neurones et la probabilité d’au moins un succès sont rappelées dans des fiches.', effort: 'trois à quatre heures' },
  modules: [
    {
      id: 'm1', title: 'Des cellules qui ne voient que leurs voisines', pitch: 'Ce qu’est un automate cellulaire, à quelle vitesse l’information y circule, et ce qu’ajoute un automate cellulaire neuronal.',
      goals: ['Décrire ce qu’une cellule perçoit et ce qu’elle partage avec les autres', 'Calculer le nombre minimal de pas pour qu’une information traverse une grille', 'Compter les paramètres d’un automate cellulaire neuronal'],
      summary: ['Un automate cellulaire : une grille de cellules qui appliquent toutes la même règle à leur voisinage 3 × 3.', 'L’information avance d’une case par pas au plus ; avec des mises à jour au hasard, plus lentement.', 'Une NCA : un état à plusieurs canaux, une perception, un petit réseau partagé, une mise à jour au hasard.', 'Le nombre de paramètres ne dépend pas de la taille de la grille : environ 10 000 pour les labyrinthes.'],
    },
    {
      id: 'm2', title: 'Résoudre un labyrinthe', pitch: 'Deux règles locales, explorer puis élaguer, trouvent le chemin ; la même règle sert pour toutes les tailles.',
      goals: ['Expliquer comment une vague puis un élagage trouvent le chemin', 'Programmer la règle d’une cellule du labyrinthe', 'Expliquer pourquoi la même règle résout des labyrinthes plus grands'],
      summary: ['La vague : une case devient atteinte quand une voisine l’est ; elle explore toutes les branches à la fois.', 'L’élagage : une case atteinte avec au plus une voisine vivante est une impasse et meurt ; la mort remonte la branche.', 'À la fin, les cases atteintes et vivantes forment le chemin.', 'Un labyrinthe plus grand demande plus de pas, pas une autre règle.'],
    },
    {
      id: 'm3', title: 'Le hasard qui aide', pitch: 'Sur une grille de contraintes, les mises à jour au hasard, un bruit passager et plusieurs essais en parallèle mènent à la solution.',
      goals: ['Expliquer pourquoi des mises à jour synchrones peuvent bloquer une grille', 'Expliquer comment un bruit passager aide à sortir d’un minimum local', 'Calculer la réussite de plusieurs essais en parallèle'],
      summary: ['Synchrones, deux voisines en conflit changent ensemble et restent en conflit : la grille clignote.', 'Au hasard, l’une change avant l’autre : la symétrie est brisée.', 'Un minimum local (une couture) ne se défait pas cellule par cellule ; un peu de bruit, coupé à temps, l’en fait sortir.', 'K essais : au moins un réussit avec la probabilité 1 − (1 − p)^K ; la confiance de la grille désigne le bon.'],
    },
    {
      id: 'm4', title: 'Apprendre la règle, économiser le calcul', pitch: 'Comment l’article entraîne ses automates sur des déroulements courts, et comment des cellules sûres d’elles économisent leurs mises à jour.',
      goals: ['Expliquer le rôle du réservoir d’échantillons', 'Mesurer ce que le calcul adaptatif économise', 'Diagnostiquer un automate qui échoue'],
      summary: ['L’entraînement compare la sortie à la solution et corrige les poids en remontant les pas : il ne peut dérouler que peu de pas à la fois.', 'Le réservoir d’échantillons reprend des états déjà déroulés : l’entraînement voit des milliers de pas.', 'Les perturbations apprennent à la règle à corriger un état abîmé.', 'Le calcul adaptatif : les cellules sûres se mettent moins souvent à jour ; moins de calcul, un peu plus de pas, mais jamais zéro.'],
    },
    { id: 'exam', title: 'Épreuve', kind: 'exam', pitch: 'Un automate en panne à diagnostiquer seul, et le test final.', goals: ['Diagnostiquer seul un cas inconnu'], summary: ['Observer, supposer, corriger un seul réglage, justifier.'] },
  ],
  glossary: [
    { id: 'ca', name: 'automate cellulaire', forms: ['automates cellulaires'], def: 'Une grille de cellules ; à chaque pas, chaque cellule calcule son nouvel état à partir du sien et de ceux de ses voisines, avec la même règle partout.', module: 'm1' },
    { id: 'nca', name: 'NCA', forms: ['automate cellulaire neuronal', 'automates cellulaires neuronaux'], def: 'Neural Cellular Automaton : un automate cellulaire dont la règle est un petit réseau de neurones appris, partagé par toutes les cellules.', tool: 'R1', module: 'm1' },
    { id: 'nbh', name: 'voisinage', def: 'Les cellules qu’une cellule perçoit : ici le carré 3 × 3 centré sur elle (ses huit voisines), ou ses quatre voisines par les côtés.', tool: 'G1', module: 'm1' },
    { id: 'chan', name: 'canal', forms: ['canaux'], def: 'Un des nombres de l’état d’une cellule. Les canaux d’entrée portent le problème, ceux de sortie la réponse, les canaux cachés servent au calcul.', module: 'm1' },
    { id: 'perc', name: 'perception', def: 'Ce qu’une cellule calcule de son voisinage : des combinaisons pondérées des états des neuf cellules.', module: 'm1' },
    { id: 'param', name: 'paramètre', forms: ['paramètres'], def: 'Un nombre de la règle réglé par l’apprentissage (un poids, un biais).', tool: 'R1', module: 'm1' },
    { id: 'pfire', name: 'taux de mise à jour', def: 'La probabilité p qu’une cellule se mette à jour à un pas donné. L’article prend p = 0,8.', module: 'm1' },
    { id: 'async', name: 'asynchrone', forms: ['asynchrones'], def: 'Se dit de mises à jour qui n’ont pas lieu toutes en même temps : chaque cellule se met à jour à des instants tirés au hasard.', module: 'm1' },
    { id: 'arc', name: 'ARC-AGI', forms: ['ARC-AGI-1'], def: 'Un ensemble d’énigmes visuelles : à partir de quelques exemples de grilles transformées, deviner la transformation et l’appliquer à une nouvelle grille.', module: 'm1' },
    { id: 'wave', name: 'vague', forms: ['vagues'], def: 'Un changement d’état qui se transmet de voisine en voisine, une case par mise à jour.', module: 'm2' },
    { id: 'deadend', name: 'impasse', forms: ['impasses'], def: 'Une branche du labyrinthe qui ne mène nulle part : sa dernière case n’a qu’une seule voisine libre.', module: 'm2' },
    { id: 'prune', name: 'élagage', forms: ['élaguer', 'élague', 'élaguée', 'élaguées'], def: 'La suppression des impasses : une case atteinte qui a au plus une voisine vivante meurt, et la mort remonte la branche.', module: 'm2' },
    { id: 'rollout', name: 'déroulement', forms: ['déroulements'], def: 'L’application de la règle pendant D pas à partir d’un état de départ ; la réponse se lit à la fin.', module: 'm2' },
    { id: 'ood', name: 'hors distribution', def: 'Se dit d’un problème différent de ceux de l’entraînement : plus grand, plus difficile.', module: 'm2' },
    { id: 'substrate', name: 'substrat', def: 'La grille de cellules qui porte le calcul. L’agrandir, c’est ajouter des cellules, sans changer la règle.', module: 'm2' },
    { id: 'conflict', name: 'conflit', forms: ['conflits'], def: 'Une contrainte violée : deux voisines par les côtés qui ont la même couleur.', module: 'm3' },
    { id: 'sync', name: 'synchrone', forms: ['synchrones'], def: 'Se dit de mises à jour qui ont toutes lieu au même instant (taux de mise à jour égal à 1).', module: 'm3' },
    { id: 'localmin', name: 'minimum local', forms: ['minimums locaux'], def: 'Un état presque juste où aucune cellule, seule, ne peut réduire les conflits : il faudrait en changer beaucoup à la fois.', module: 'm3' },
    { id: 'seam', name: 'couture', def: 'La ligne où se rencontrent deux damiers décalés : les seuls conflits d’une grille coincée.', module: 'm3' },
    { id: 'noise', name: 'bruit', def: 'Des changements tirés au hasard ajoutés pendant le calcul : ici, une cellule qui se met à jour change de couleur avec une petite probabilité η.', module: 'm3' },
    { id: 'trials', name: 'essais en parallèle', forms: ['essai en parallèle'], def: 'Plusieurs déroulements indépendants du même problème ; on garde celui que la confiance désigne.', tool: 'P1', module: 'm3' },
    { id: 'conf', name: 'confiance', def: 'Une note que la grille se donne sans connaître la solution : ici, la part des contraintes respectées ; dans l’article, la moyenne des certitudes des cellules.', module: 'm3' },
    { id: 'niche', name: 'niche', forms: ['niches'], def: 'Un groupe d’essais qui prédisent exactement la même grille ; l’article n’en garde que trois par niche.', module: 'm3' },
    { id: 'bptt', name: 'rétropropagation dans le temps', def: 'Le calcul, en remontant les pas d’un déroulement, de l’effet de chaque poids sur l’erreur finale ; sa mémoire grandit avec le nombre de pas.', module: 'm4' },
    { id: 'replay', name: 'réservoir d’échantillons', forms: ['réservoir'], def: 'Une réserve d’états déjà déroulés, repris à l’entraînement suivant : l’entraînement voit ainsi des déroulements très longs.', module: 'm4' },
    { id: 'perturb', name: 'perturbation', forms: ['perturbations'], def: 'Un dégât infligé à l’entraînement : bruit dans les états, zones remises à zéro, problème changé en cours de route.', module: 'm4' },
    { id: 'sure', name: 'cellule sûre', forms: ['cellules sûres'], def: 'Une cellule dont la dernière mise à jour n’a rien changé (les murs le sont toujours).', module: 'm4' },
    { id: 'adapt', name: 'calcul adaptatif', def: 'Des cellules sûres qui se mettent à jour moins souvent : le calcul se concentre là où quelque chose change.', module: 'm4' },
  ],
  toolbox: CAPSULES,
  tests: {
    tools: [
      { id: 'a1', skill: 'Distances sur une grille', tool: 'G1', q: numeric('Avec les huit voisines, combien de pas au minimum de la case (2, 3) à la case (9, 7) ?', 7, 'dx = 7, dy = 4 : max(7, 4) = 7 pas.') },
      { id: 'a2', skill: 'Une couche de neurones', tool: 'R1', q: numeric('Une couche relie 64 entrées à 32 neurones. Combien a-t-elle de paramètres ?', 2080, '64 × 32 poids + 32 biais = 2 080.', { tol: 1 }) },
      { id: 'a3', skill: 'Au moins un succès', tool: 'P1', q: choice('Un essai réussit une fois sur deux. Avec 3 essais indépendants, au moins un réussit avec la probabilité…', ['7/8', '3/2', '1/2', '1/8'], '1 − (1/2)³ = 1 − 1/8 = 7/8.') },
    ],
    pre: [
      { id: 'b1', skill: 'Du local au global', q: choice('Chaque cellule d’un labyrinthe ne voit que ses quatre voisines. Ensemble, peuvent-elles trouver le chemin ?', ['oui, par des échanges de proche en proche', 'non, il faut voir le labyrinthe entier', 'oui, mais seulement sur de petits labyrinthes', 'non, sans une cellule qui les dirige'], 'Une vague d’exploration puis un élagage des impasses suffisent : chaque cellule ne décide qu’avec ses voisines.') },
      { id: 'b2', skill: 'Les mises à jour au hasard', q: choice('Pour qu’un automate cellulaire résolve sûrement une grille de contraintes, il vaut mieux que ses cellules se mettent à jour…', ['à des instants tirés au hasard', 'toutes exactement au même instant', 'toujours dans le même ordre fixe', 'seulement au tout premier pas'], 'Au même instant, deux voisines en conflit changent ensemble et restent en conflit ; le hasard brise cette symétrie.') },
      { id: 'b3', skill: 'Le bruit', q: choice('Ajouter un peu de bruit pendant le calcul d’une grille de contraintes…', ['peut l’aider à sortir d’un blocage', 'ne peut que dégrader le résultat', 'n’a aucun effet sur le résultat', 'rend chaque pas plus rapide'], 'Un bruit passager défait des états presque justes mais bloqués ; il faut le couper avant la fin.') },
      { id: 'b4', skill: 'Des problèmes plus grands', q: choice('Une règle apprise sur des labyrinthes 9 × 9 est appliquée à un labyrinthe 59 × 59. Elle…', ['peut le résoudre avec plus de pas', 'ne peut pas fonctionner du tout', 'le résout avec autant de pas', 'doit d’abord être réentraînée'], 'La règle est locale : elle ne dépend pas de la taille de la grille, mais l’information doit parcourir plus de cases.') },
      { id: 'b5', skill: 'Les paramètres', q: choice('Pour traiter une grille dix fois plus large, un automate cellulaire neuronal a besoin de…', ['autant de paramètres qu’avant', 'dix fois plus de paramètres', 'cent fois plus de paramètres', 'deux fois moins de paramètres'], 'Toutes les cellules partagent la même règle : ses paramètres ne dépendent pas du nombre de cellules.') },
    ],
    post: [
      { id: 'p1', pair: 'b1', skill: 'Du local au global', q: choice('Chaque case d’une carte ne connaît que ses voisines. Peut-elle apprendre si elle est reliée à la mer par la terre ferme ?', ['oui, par une vague partie de la mer', 'non, il faudrait voir toute la carte', 'seulement si elle touche la mer', 'seulement sur une petite carte'], 'Une vague partie des cases de la mer atteint, de proche en proche, toutes les cases reliées.') },
      { id: 'p2', pair: 'b2', skill: 'Les mises à jour au hasard', q: choice('Deux voisines dans le même état appliquent la même règle et se mettent toujours à jour au même instant. Elles…', ['restent identiques pour toujours', 'finissent par se différencier', 'se différencient au premier pas', 'cessent de changer d’état'], 'Même état, même règle, mêmes instants : rien ne peut les distinguer.') },
      { id: 'p3', pair: 'b3', skill: 'Le bruit', q: choice('Une grille reste bloquée avec quelques conflits alignés qui ne disparaissent pas. Que faire ?', ['la secouer un peu, puis couper le bruit', 'ajouter du bruit jusqu’à la fin', 'tout mettre à jour au même instant', 'arrêter le calcul plus tôt'], 'Le bruit déplace la couture ; coupé à temps, il laisse la règle finir le travail.') },
      { id: 'p4', pair: 'b4', skill: 'Des problèmes plus grands', q: choice('Un automate résout des labyrinthes 21 × 21 en 300 pas. Sur un labyrinthe 61 × 61, avec 300 pas, il échoue. Que faut-il changer ?', ['lui laisser plus de pas', 'changer la règle des cellules', 'agrandir le voisinage', 'baisser le taux de mise à jour'], 'La même règle résout les grands labyrinthes ; l’information doit seulement parcourir plus de cases.') },
      { id: 'p5', pair: 'b5', skill: 'Les paramètres', q: choice('Pourquoi une NCA de 10 000 paramètres peut-elle traiter un labyrinthe de 40 000 cases ?', ['toutes les cellules partagent la même règle', 'chaque case a ses propres paramètres', 'elle ne lit qu’une partie du labyrinthe', 'ses paramètres grandissent avec la grille'], 'La règle est la même pour toutes les cellules : ses paramètres sont partagés.') },
    ],
  },
  diagrams: DIAGRAMS,
  stageKeys: ['side', 'mseed', 'D', 'p', 'adaptive', 'plow', 'damage', 'eta', 'rn', 'gseed', 'K'],
  scenes: { maze: 'Le labyrinthe, résolu par ses cellules', grid: 'Une grille de contraintes locales' },
  defaults: {
    side: MAZE.side, mseed: MAZE.seed, D: MAZE.D, p: PAPER.pFire, adaptive: 0, plow: PAPER.pLow, damage: 0,
    eta: GRID.eta, rn: GRID.rn, gseed: GRID.seed, K: 1, steps: 5, cp: 1, C: PAPER.mazeC, heads: PAPER.mazeHeads, E: PAPER.mazeE, m: 4, rseed: RS,
  },
  model,
  exercises,
  rubric: [
    'Une justification complète décrit le symptôme (ce qu’on voit sur la grille), la cause (le réglage en défaut) et le mécanisme local qui relie les deux.',
    'Elle s’appuie sur une notion du cours : propagation de proche en proche, symétrie, minimum local, cellules sûres.',
  ],
  content(c) {
    // ================================================================ m1
    c.module('m1');
    c.chapter('La question de l’article', () => {
      c.stage('maze');
      c.step('Raisonner sans vue d’ensemble', 'Les grands modèles d’intelligence artificielle relient chaque partie de leur entrée à toutes les autres, à chaque étape du calcul. L’article étudié ici teste l’inverse : une grille de cellules qui ne voient que leurs voisines. En arrière-plan, un labyrinthe se résout ainsi, sans qu’aucune cellule ne le voie en entier.', {
        claims: [{ text: 'le labyrinthe du fond est résolu', check: () => NOM.outcome === 'solved' || NOM.outcome }],
      });
      c.test('pre', 'Avant de commencer, un court test : il mesure ce que vous savez déjà, pour le comparer au test final.');
      c.step('Ce que l’article teste', 'Les auteurs entraînent des automates cellulaires neuronaux sur des labyrinthes, des sudokus et ARC-AGI-1, un ensemble d’énigmes visuelles. Ils regardent aussi s’ils résolvent des problèmes plus grands ou plus difficiles que ceux de l’entraînement. Ce cours reconstruit leurs mécanismes avec deux petits automates écrits à la main.');
    });
    c.chapter('Un automate cellulaire', () => {
      c.stage('maze');
      c.diagram('neighborhood');
      c.ask('q-see', 'Dans un automate cellulaire, que voit une cellule à chaque pas ?', ['son voisinage immédiat', 'la grille tout entière', 'sa ligne et sa colonne', 'les cellules qui ont changé'], 'Elle ne lit que les cellules qui la touchent : le carré 3 × 3 centré sur elle.');
      c.step('Une grille de cellules', 'Un automate cellulaire est une grille de cellules qui ont chacune un état. À chaque pas, chaque cellule calcule son nouvel état à partir du sien et de ceux de ses voisines. Le « jeu de la vie » de John Conway en est l’exemple le plus connu : des cellules vivantes ou mortes, et une règle de quelques lignes.');
      c.step('Le voisinage 3 × 3', 'Le voisinage d’une cellule est le carré 3 × 3 centré sur elle : elle-même et ses huit voisines. Dans un labyrinthe, on ne se déplace que par les côtés : seules comptent les quatre voisines du haut, du bas, de gauche et de droite. Rien au-delà n’est visible.', { tools: ['G1'] });
      c.step('Une seule règle', 'Toutes les cellules appliquent la même règle, à chaque pas. Elle ne dépend ni de la position de la cellule ni de la taille de la grille : une cellule ne sait pas où elle se trouve. Un comportement d’ensemble, comme trouver un chemin, doit naître de ces échanges répétés.');
      c.question('q-same-rule', 'Un même automate traite une grille 9 × 9 puis une grille 201 × 201. Combien de règles différentes ses cellules utilisent-elles ?', ['une seule, partout', 'une par taille de grille', 'une par cellule', 'une par ligne'], 'La règle est partagée par toutes les cellules, quelle que soit la grille.');
    });
    c.chapter('L’information avance d’une case par pas', () => {
      c.stage('maze');
      c.diagram(null);
      c.ask('q-cone', 'Une cellule au centre d’une grille 21 × 21 change d’état. Combien de pas faut-il, au moins, pour qu’une cellule du bord puisse le savoir ?', [`${fr(F1)} pas`, '1 pas', '21 pas', '441 pas'], `À chaque pas, l’information ne passe que d’une cellule à sa voisine : le bord est à ${fr(F1)} cases du centre.`);
      c.diagram('cone', { arg: 'sync' });
      c.step('Un cône d’influence', `À chaque pas, une cellule ne lit que ses voisines : une information avance d’une case au plus. Après t pas, elle couvre un carré de 2t + 1 cases de côté. Il faut ${fr(F1)} pas pour qu’elle atteigne tous les bords d’une grille 21 × 21.`, {
        tools: ['G1'],
        claims: [{ text: `${fr(F1)} pas pour couvrir la grille`, check: () => F1 === 10 || `${F1}` }],
      });
      c.diagram('cone');
      c.step('Des mises à jour au hasard', `Dans l’article, une cellule ne se met pas à jour à chaque pas : elle le fait avec une probabilité p = ${fr(PAPER.pFire, 1)}, tirée au hasard pour chaque cellule. Ce taux de mise à jour ralentit la propagation : avec p = ${fr(PAPER.pFire, 1)}, il faut ${fr(F08)} pas au lieu de ${fr(F1)} pour couvrir la grille.`, {
        claims: [{ text: 'le hasard ralentit la propagation', check: () => F08 > F1 || `${F08}` }],
      });
      c.experiment({
        title: 'Faites avancer le signal', prompt: 'Réglez le nombre de pas et le taux de mise à jour. La case blanche, au centre, a changé d’état au départ.',
        predict: { question: `Avec p = 0,5, une cellule ne se met à jour qu’un pas sur deux en moyenne. Combien de pas faut-il pour informer toute la grille 21 × 21 ?`, choices: [`plus de ${fr(2 * F1)}`, `${fr(2 * F1)} exactement`, `${fr(F1)}, comme avec p = 1`], answer: 0 },
        controls: [
          { type: 'range', key: 'steps', label: 'pas', min: 0, max: 30, step: 1, fmt: dec(0) },
          { type: 'range', key: 'cp', label: 'taux de mise à jour p', min: 0.2, max: 1, step: 0.05, fmt: dec(2) },
        ],
        goals: [
          { label: 'Avec p = 1, informez toute la grille', test: ({ v }) => v.cp >= 0.999 && full(v) },
          { label: 'Avec p = 0,5, informez toute la grille', test: ({ v }) => Math.abs(v.cp - 0.5) < 0.01 && full(v) },
        ],
        seq: true, conclusion: `Avec p = 1, ${fr(F1)} pas suffisent ; avec p = 0,5, il en faut ${fr(fullAt(0.5))}. Plus le taux est faible, plus l’information se propage lentement, et de façon irrégulière.`,
      });
      c.numeric('q-cross', 'Avec le voisinage 3 × 3 et p = 1, combien de pas faut-il au moins pour qu’une information aille d’un coin d’une grille 59 × 59 au coin opposé ?', 58, 'Les deux coins sont à 58 cases l’un de l’autre en x et en y ; en diagonale, il faut max(58, 58) = 58 pas.', { tol: 0 });
      c.explain('e-cone', 'Expliquez pourquoi, dans un automate cellulaire, une cellule du bord d’une grille 21 × 21 ne peut pas réagir avant dix pas à un changement survenu au centre.', 'Une cellule ne lit que ses voisines immédiates. Un changement ne peut donc passer que d’une cellule à sa voisine à chaque pas. Le bord est à dix cases du centre : il faut au moins dix pas pour que l’information y arrive, et davantage si les cellules ne se mettent pas toujours à jour.');
    });
    c.chapter('Une règle apprise : l’automate cellulaire neuronal', () => {
      c.stage('maze');
      c.diagram(null);
      c.step('Un état à plusieurs canaux', `Dans une NCA, l’état d’une cellule est une liste de nombres, ses canaux : ${fr(PAPER.mazeC)} pour les labyrinthes. Les canaux d’entrée portent le problème (mur, case libre, extrémité) et ne changent jamais. Les canaux de sortie portent la réponse. Les canaux cachés servent de mémoire de calcul.`);
      c.diagram('ncaCell');
      c.step('Percevoir, calculer, ajouter', 'À chaque mise à jour, la cellule calcule une perception : des combinaisons pondérées des états de ses neuf cellules. Un petit réseau de neurones transforme cette perception en une correction Δx, ajoutée à son état. Toutes les cellules utilisent le même réseau, avec les mêmes poids.', { tools: ['R1'] });
      c.step('Pas d’horloge commune', `Chaque cellule se met à jour avec le taux de mise à jour p = ${fr(PAPER.pFire, 1)}, indépendamment des autres : les mises à jour sont asynchrones. Rien ne coordonne les cellules ; seule la règle partagée les fait agir ensemble.`);
      c.step('Une règle apprise, ici écrite', 'Dans l’article, les poids du réseau sont appris à partir d’exemples de problèmes et de leurs solutions. Pour voir ce qu’une telle règle peut faire, ce cours écrit à la main deux règles qui respectent les mêmes contraintes : voisinage 3 × 3, même règle partout, mises à jour au hasard.');
      c.diagram('params');
      c.step('Peu de paramètres', `La NCA des labyrinthes a environ ${fr(PAPER.mazeParams)} paramètres : ${fr(P_NCA)} selon le calcul de son architecture. DeepThink, le modèle comparé dans l’article, en a ${fr(PAPER.deepThinkParams)}. Ce nombre ne dépend pas de la taille de la grille : chaque nouvelle cellule réutilise la même règle.`, {
        tools: ['R1'],
        claims: [{ text: 'environ 10 000 paramètres', check: () => near(P_NCA, PAPER.mazeParams, 0.05) || fr(P_NCA) }],
      });
      c.exercise('params', 'Dans l’atelier, comptez les paramètres de la NCA des labyrinthes.');
      c.question('q-params-size', 'On passe d’une grille 9 × 9 à une grille 201 × 201. Le nombre de paramètres de la NCA…', ['ne change pas', 'est multiplié par 22', 'est multiplié par 500', 'diminue un peu'], 'Les paramètres sont ceux de la règle, partagée par toutes les cellules : ajouter des cellules n’en ajoute aucun.');
    });

    // ================================================================ m2
    c.module('m2');
    c.chapter('Explorer depuis les extrémités', () => {
      c.stage('maze');
      c.diagram(null);
      c.ask('q-onpath', 'Une case ne voit que ses quatre voisines. Peut-elle savoir qu’elle est sur le chemin entre les deux extrémités ?', ['oui, après des échanges répétés', 'non, il faut voir tout le labyrinthe', 'oui, si elle touche une extrémité', 'non, sauf sur une petite grille'], 'Seule, elle ne le sait pas ; des messages passés de voisine en voisine le lui apprennent.');
      c.diagram('rules', { arg: 'wave' });
      c.step('Le labyrinthe vu par les cellules', `Le labyrinthe du fond a ${fr(MZ.side)} × ${fr(MZ.side)} cases, dont ${fr(MZ.open)} libres. Le canal d’entrée de chaque case dit si c’est un mur, une case libre ou l’une des deux extrémités. Chaque case libre doit finir par dire si elle est sur le chemin : ${fr(MZ.pathLen)} cases le sont.`, {
        claims: [{ text: 'un seul chemin, plus court que le nombre de cases libres', check: () => MZ.pathLen < MZ.open }],
      });
      c.step('La vague', 'Première règle : une case libre devient « atteinte » dès qu’une de ses voisines l’est. Au départ, seules les deux extrémités sont atteintes. Une vague part d’elles et envahit tout le labyrinthe, une case par mise à jour. Sur la scène, les cases atteintes sont orange.');
      c.step('Toutes les pistes à la fois', 'La vague avance dans toutes les branches en même temps : elle n’a pas à choisir une direction. C’est un parcours en largeur, mené par toutes les cellules ensemble. Les auteurs le comparent au blob, un organisme unicellulaire qui explore un labyrinthe de la même façon.');
      c.exercise('local', 'Dans l’atelier, classez ce qu’une cellule peut savoir seule.');
    });
    c.chapter('Élaguer les impasses', () => {
      c.stage('maze');
      c.diagram('rules');
      c.step('Une impasse se reconnaît de près', 'Seconde règle, l’élagage : une case atteinte qui a au plus une voisine encore vivante est le bout d’une impasse : elle meurt. Les murs ne comptent pas comme voisines. Les extrémités ne meurent jamais. Sur la scène, les cases mortes deviennent bleu pâle.');
      c.step('La mort remonte la branche', 'Quand le bout d’une impasse meurt, la case d’avant n’a plus qu’une voisine vivante : elle meurt à son tour. L’élagage remonte ainsi chaque impasse jusqu’au carrefour. L’article observe ce retour en arrière dans ses automates entraînés (figure 2A).');
      c.step('La réponse dans chaque case', 'Une case du vrai chemin garde toujours deux voisines vivantes, celles d’avant et d’après : elle ne meurt jamais. À la fin, les cases atteintes et vivantes sont exactement le chemin. Chaque case lit la réponse dans son propre état.', {
        claims: [{ text: 'le chemin n’est jamais élagué', check: () => model.checks.find((k) => k.name.startsWith('l’élagage ne touche'))!.run() ?? true }],
      });
      c.order('q-order', 'Remettez dans l’ordre ce que montre la scène.', ['les deux extrémités sont atteintes', 'la vague remplit le labyrinthe', 'les bouts des impasses meurent', 'l’élagage remonte jusqu’aux carrefours', 'seul le chemin reste en vie'], 'La vague doit atteindre le bout d’une impasse avant que celui-ci ne meure ; la mort remonte ensuite la branche.');
      c.exercise('rule', 'Dans l’atelier, programmez la règle d’une cellule : explorer, puis élaguer.');
    });
    c.chapter('Combien de pas ?', () => {
      c.stage('maze');
      c.diagram('progress');
      c.step('Un nombre de pas fixé', `Un déroulement applique la règle pendant D pas, puis on lit la réponse. Pour ce labyrinthe, la vague atteint toutes les cases libres au pas ${fr(EXPLORED)} ; l’élagage finit au pas ${fr(NOM.solvedAt)}. Sur le schéma : les cases atteintes, les cases mortes et les cases mal classées.`, {
        claims: [{ text: 'l’exploration finit avant l’élagage', check: () => EXPLORED > 0 && EXPLORED < NOM.solvedAt }],
      });
      c.experiment({
        title: 'Arrêter trop tôt', prompt: 'Réglez le nombre de pas D. La réponse est lue au dernier pas.',
        predict: { question: 'Avec D = 100, le labyrinthe est…', choices: ['encore en exploration', 'résolu', 'en cours d’élagage'], answer: 0 },
        controls: [{ type: 'range', key: 'D', label: 'nombre de pas D', min: 20, max: 400, step: 10, fmt: dec(0) }],
        goals: [
          { label: 'Arrêtez pendant l’exploration', test: ({ v }) => mazeOf(v).outcome === 'exploring' },
          { label: 'Arrêtez pendant l’élagage', test: ({ v }) => mazeOf(v).outcome === 'pruning' },
          { label: 'Trouvez le plus petit D qui résout (à dix pas près)', test: ({ v }) => isSolved(v) && v.D < NOM.solvedAt + 10 },
        ],
        seq: true, conclusion: `Avant ${fr(EXPLORED)} pas, des cases ne sont pas encore atteintes ; jusqu’à ${fr(NOM.solvedAt)} pas, des impasses sont encore vivantes. Il faut laisser à l’information le temps de faire l’aller et le retour.`,
      });
      c.question('q-d', 'Un labyrinthe a des impasses très longues. Que faut-il prévoir ?', ['plus de pas, pour que l’élagage les remonte', 'moins de pas, pour éviter de trop élaguer', 'une autre règle pour les longues impasses', 'un voisinage plus grand pour chaque case'], 'L’élagage remonte une impasse d’une case par mise à jour : plus elle est longue, plus il faut de pas.');
    });
    c.chapter('Des labyrinthes plus grands, la même règle', () => {
      c.stage('maze');
      c.diagram('scaling');
      c.ask('q-bigger', 'Une NCA entraînée sur des labyrinthes 9 × 9 reçoit un labyrinthe 59 × 59. Que faut-il changer ?', ['lui laisser plus de pas', 'réentraîner sa règle', 'lui ajouter des paramètres', 'agrandir son voisinage'], 'La règle locale ne dépend pas de la taille ; seule la distance à parcourir augmente.');
      c.step('Agrandir le substrat', `Pour traiter un labyrinthe plus grand, on agrandit le substrat : on ajoute des cellules, avec la même règle. Notre automate résout un 9 × 9 en ${fr(NEED9)} pas environ, un 61 × 61 en ${fr(NEED61)} pas environ. Chaque point du schéma est un labyrinthe.`, {
        claims: [{ text: 'les grands labyrinthes demandent plus de pas', check: () => NEED61 > 10 * NEED9 || `${NEED9} / ${NEED61}` }],
      });
      c.step('Ce que montre l’article', `Entraînée sur des labyrinthes ${fr(PAPER.mazeTrain)} × ${fr(PAPER.mazeTrain)} en ${fr(PAPER.mazeTrainMinutes)} minutes, la NCA résout tous les labyrinthes ${fr(PAPER.mazeBig)} × ${fr(PAPER.mazeBig)}, environ ${fr(Math.round(AREA / 10) * 10)} fois plus grands, avec ${fr(PAPER.mazeBigSteps)} pas. DeepThink, ${fr(PAPER.deepThinkParams / PAPER.mazeParams)} fois plus gros, en résout ${fr(PAPER.deepThinkBig)} %. C’est une généralisation hors distribution.`, {
        claims: [{ text: 'environ 500 fois plus de cases', check: () => near(AREA, 500, 0.01) || fr(AREA) }],
      });
      c.experiment({
        title: 'Agrandir le labyrinthe', prompt: 'Réglez la taille du labyrinthe et le nombre de pas. La règle des cellules ne change pas.',
        predict: { question: 'Avec 300 pas, un labyrinthe 41 × 41…', choices: ['n’est pas résolu', 'est résolu', 'demande une autre règle'], answer: 0 },
        controls: [
          { type: 'range', key: 'side', label: 'côté du labyrinthe', min: 9, max: 61, step: 4, fmt: dec(0) },
          { type: 'range', key: 'D', label: 'nombre de pas D', min: 50, max: 2400, step: 10, fmt: dec(0), log: true },
        ],
        goals: [
          { label: 'Trouvez un labyrinthe que 300 pas ne suffisent pas à résoudre', test: ({ v }) => v.D <= 300 && !isSolved(v) },
          { label: 'Résolvez un labyrinthe de côté 41 ou plus', test: ({ v }) => v.side >= 41 && isSolved(v) },
          { label: 'Résolvez le plus grand, 61 × 61', test: ({ v }) => v.side >= 61 && isSolved(v) },
        ],
        seq: true, conclusion: 'La même règle résout toutes les tailles. Le nombre de pas nécessaire grandit plus vite que le côté : la vague et l’élagage parcourent des chemins et des impasses de plus en plus longs.',
      });
      c.explain('e-scale', 'Expliquez pourquoi la même règle résout des labyrinthes de toutes les tailles, et pourquoi les grands demandent beaucoup plus de pas.', 'La règle ne lit que les quatre voisines d’une case : elle ne dépend ni de la taille ni de la position, et marche donc sur toute grille. Mais l’information ne passe que d’une case à sa voisine à chaque mise à jour : la vague doit parcourir tout le labyrinthe, puis l’élagage remonter chaque impasse. Dans un grand labyrinthe, ces trajets sont bien plus longs.');
    });

    // ================================================================ m3
    c.module('m3');
    c.chapter('Une grille de contraintes', () => {
      c.stage('grid');
      c.diagram('gridRule');
      c.step('Un sudoku miniature', 'Au sudoku, chaque case doit différer de celles de sa ligne, de sa colonne et de son carré : des contraintes locales, une solution d’ensemble. Notre version : colorier une grille 10 × 10 en deux couleurs, sans que deux voisines par les côtés aient la même couleur. Chaque paire en faute est un conflit, marqué en rouge.');
      c.step('Deux solutions seulement', 'Une telle grille n’a que deux solutions : les deux damiers, qui diffèrent par la couleur du coin. Une cellule ne peut pas savoir lequel les autres vont adopter. Comme au sudoku, les choix locaux doivent s’accorder sur toute la grille.');
      c.step('La règle de chaque cellule', `Chaque cellule part d’une couleur tirée au hasard. Quand elle se met à jour, elle change de couleur si au moins la moitié de ses voisines ont la même qu’elle. Avec p = ${fr(PAPER.pFire, 1)}, la grille du fond se résout en quelques dizaines de pas.`, {
        claims: [{ text: 'la grille du fond se résout', check: () => rollGrid().outcome === 'solved' || rollGrid().outcome }],
      });
      c.exercise('color', 'Dans l’atelier, programmez la règle d’une cellule de la grille.');
    });
    c.chapter('Tous en même temps : la grille clignote', () => {
      c.stage('grid');
      c.diagram('conflictCurve');
      c.ask('q-sync', 'Si toutes les cellules se mettent à jour exactement en même temps, la grille…', ['peut osciller sans fin', 'se résout plus vite', 'se résout aussi vite', 'se fige au premier pas'], 'Des voisines en conflit changent ensemble et restent en conflit.');
      c.step('La symétrie', 'Deux voisines de même couleur voient le même conflit. Si elles se mettent à jour au même instant, elles changent toutes les deux et restent de même couleur. Dans une zone d’une seule couleur, toutes les cellules changent à chaque pas : la zone clignote. Ces mises à jour synchrones ne brisent jamais la symétrie.');
      c.step('Le hasard brise la symétrie', 'Avec des mises à jour au hasard, l’une des deux voisines change avant l’autre ; la seconde ne voit alors plus de conflit et garde sa couleur. Les auteurs trouvent les mises à jour asynchrones indispensables pour que leurs NCA résolvent des sudokus plus difficiles que ceux de l’entraînement.');
      c.experiment({
        title: 'Le taux de mise à jour', prompt: 'Faites varier le taux de mise à jour p et regardez la grille du fond et la courbe des conflits.',
        predict: { question: 'Avec p = 1 (toutes les cellules à chaque pas), la grille…', choices: ['clignote sans fin', 'se résout', 'reste figée'], answer: 0 },
        controls: [{ type: 'range', key: 'p', label: 'taux de mise à jour p', min: 0.02, max: 1, step: 0.01, fmt: dec(2) }],
        goals: [
          { label: 'Réglez p = 1 : la grille clignote', test: ({ v }) => v.p >= 0.999 && gridIs(v, 'blink') },
          { label: 'Trouvez un taux si faible que la grille n’est pas stable après 250 pas', test: ({ v }) => gridIs(v, 'slow') },
          { label: 'Trouvez un taux qui résout la grille', test: ({ v }) => gridIs(v, 'solved') },
        ],
        seq: true, conclusion: 'De 0,9 à 1, la grille clignote : presque tout le monde change en même temps. Sous 0,05, trop peu de cellules se mettent à jour pour finir en 250 pas. Entre les deux, la grille se résout.',
      });
      c.diagram('rateVsP');
      c.step('Une fenêtre de réglage', `Sur 200 grilles, sans bruit : avec p = 1, ${pct(R_SYNC)} sont résolues ; avec p = ${fr(PAPER.pFire, 1)}, ${pct(R_ASYNC)} ; avec p = 0,02, ${pct(R_SLOW)}. Trop de synchronie bloque, trop peu de mises à jour ralentit. La valeur de l’article, ${fr(PAPER.pFire, 1)}, est dans la fenêtre.`, {
        claims: [
          { text: 'synchrone : aucune grille', check: () => R_SYNC === 0 || pct(R_SYNC) },
          { text: 'p = 0,8 : environ quatre sur cinq', check: () => near(R_ASYNC, 0.785, 0.05) || pct(R_ASYNC) },
        ],
      });
      c.question('q-p', 'Pourquoi un taux de mise à jour trop faible fait-il aussi échouer la grille ?', ['elle n’a pas le temps de finir', 'elle se met à clignoter', 'les conflits se multiplient', 'les cellules oublient leur couleur'], 'Avec p = 0,02, une cellule se met à jour en moyenne une fois tous les 50 pas : 250 pas ne suffisent pas.');
    });
    c.chapter('Coincée : le minimum local', () => {
      c.stage('grid', { gseed: 3 });
      c.diagram('conflictCurve');
      c.step('Une couture', 'Cette grille (graine 3) ne se résout pas. Deux damiers décalés s’y rencontrent le long d’une ligne, la couture, où se concentrent tous les conflits. Ailleurs, tout est juste. Pour corriger, il faudrait changer la couleur de toute une moitié de la grille : aucune cellule ne peut le faire seule.');
      c.step('Un minimum local', 'Un tel état est un minimum local : presque juste, mais aucune mise à jour d’une seule cellule ne réduit les conflits. L’article décrit la même chose au sudoku : une grille presque valide, avec quelques chiffres en conflit, dont l’automate sort en augmentant d’abord les conflits (figure 2D).');
      c.step('Secouer un peu, puis s’arrêter', 'Ajoutons du bruit : pendant la première moitié du déroulement, une cellule qui se met à jour change de couleur au hasard avec une probabilité η. La couture se déplace et finit par sortir de la grille. Puis le bruit s’arrête, et la règle seule termine. L’article injecte aussi du bruit, pendant le premier quart.');
      c.experiment({
        title: 'Un peu de bruit', prompt: 'Réglez la force du bruit η et la part du déroulement pendant laquelle il agit.',
        predict: { question: 'Avec η = 0,02 pendant la moitié du déroulement, la grille coincée…', choices: ['se résout', 'reste coincée', 'clignote'], answer: 0 },
        controls: [
          { type: 'range', key: 'eta', label: 'bruit η', min: 0, max: 0.05, step: 0.01, fmt: dec(2) },
          { type: 'range', key: 'rn', label: 'durée du bruit (part du déroulement)', min: 0.25, max: 1, step: 0.25, fmt: pct },
        ],
        goals: [
          { label: 'Résolvez la grille avec du bruit', test: ({ v }) => v.eta > 0 && gridIs(v, 'solved') },
          { label: 'Laissez le bruit jusqu’à la fin', test: ({ v }) => gridIs(v, 'noisy') },
        ],
        seq: true, conclusion: `Sur 200 grilles, un bruit η = 0,02 pendant la moitié du déroulement fait passer la réussite de ${pct(R_ASYNC)} à ${pct(R_NOISE)}. Laissé jusqu’à la fin, il empêche la grille de se stabiliser : ${pct(R_NEVER)} seulement.`,
      });
      c.question('q-noise', 'Pourquoi faut-il couper le bruit avant la fin du déroulement ?', ['pour que la règle répare ses dégâts', 'pour que la grille clignote moins', 'pour économiser des mises à jour', 'pour garder la couture en place'], 'Le bruit crée sans cesse de nouveaux conflits ; une fois coupé, la règle les efface.');
    });
    c.chapter('Plusieurs essais en parallèle', () => {
      c.stage('grid', { gseed: 3, eta: 0 });
      c.diagram('trials');
      c.step('Lancer plusieurs déroulements', 'Deux déroulements du même problème diffèrent : les couleurs de départ et les mises à jour sont tirées au hasard. On peut donc en lancer plusieurs, indépendants, sur la même grille. Ce sont des essais en parallèle ; l’article en lance des centaines, voire des milliers.', { tools: ['P1'] });
      c.step('Choisir sans connaître la solution', 'Il faut choisir un essai sans connaître la solution. Chaque grille se donne une confiance : ici, la part des contraintes respectées ; dans l’article, la moyenne des certitudes de ses cellules. On garde l’essai le plus confiant. Une grille résolue, sans aucun conflit, est toujours choisie.');
      c.step('Une réussite qui monte vite', `Si un essai réussit avec la probabilité p, au moins un des K essais réussit avec la probabilité 1 − (1 − p)^K. Avec p ≈ ${fr(R_ASYNC, 2)}, trois essais donnent ${pct(atLeastOne(R_ASYNC, 3))}. Au sudoku, l’article passe de ${fr(PAPER.sudokuK1, 1)} % avec un essai à ${fr(PAPER.sudokuKAcc, 1)} % avec ${fr(PAPER.sudokuK)}.`, {
        tools: ['P1'],
        claims: [{ text: 'trois essais : environ 99 %', check: () => near(atLeastOne(R_ASYNC, 3), 0.99, 0.01) || pct(atLeastOne(R_ASYNC, 3)) }],
      });
      c.experiment({
        title: 'Combien d’essais ?', prompt: 'Réglez le nombre d’essais lancés sur la grille coincée, sans bruit. L’essai choisi est encadré en vert à la fin.',
        predict: { question: 'La grille de la graine 3 est coincée. Avec deux essais, on obtient…', choices: ['sans doute une grille résolue', 'deux grilles coincées', 'une grille qui clignote'], answer: 0 },
        controls: [{ type: 'range', key: 'K', label: 'nombre d’essais K', min: 1, max: 6, step: 1, fmt: dec(0) }],
        goals: [
          { label: 'Un seul essai : la grille reste coincée', test: ({ v }) => v.K === 1 && !trialsOf(v).solved },
          { label: 'Trouvez le plus petit nombre d’essais qui résout', test: ({ v }) => trialsOf(v).solved && !trialsOf({ ...v, K: v.K - 1 }).solved },
        ],
        seq: true, conclusion: 'Le deuxième essai part d’autres couleurs et se résout ; la confiance le désigne, car il n’a aucun conflit.',
      });
      c.diagram('pruning');
      c.step('Ne pas payer deux fois le même essai', 'Beaucoup d’essais finissent par prédire la même grille. L’article les regroupe en niches à quelques moments du déroulement, garde au plus trois essais par niche et divise à chaque fois le nombre d’essais par deux. Le calcul total ne vaut plus qu’une part de K × D.', {
        claims: [{ text: 'm = 4 : 53,1 % économisés', check: () => near(1 - pruneShare(4), 0.531, 0.002) }],
      });
      c.numeric('q-prune', 'Avec trois tranches (m = 3), quelle part du calcul de K essais sur D pas l’élagage des niches utilise-t-il, en % ?', pruneShare(3) * 100, `Les trois tranches calculent K, K/2 puis K/4 essais : (1 + ½ + ¼) / 3 = (2 − 2⁻²) / 3 ≈ ${fr(pruneShare(3), 3)}, soit environ ${fr(pruneShare(3) * 100, 1)} % : ${fr((1 - pruneShare(3)) * 100, 1)} % sont économisés. Au sudoku difficile, à calcul égal, l’article passe ainsi de ${fr(PAPER.pruneBaseAcc, 1)} % à ${fr(PAPER.pruneAcc, 1)} %.`, { unit: '%', tol: 0.5 });
      c.exercise('trialsCalc', 'Dans l’atelier, calculez la réussite de trois essais en parallèle.');
      c.explain('e-noise', 'Expliquez pourquoi un peu de hasard (des mises à jour au hasard, un bruit passager) aide la grille à se résoudre, alors qu’un bruit qui ne s’arrête jamais l’en empêche.', 'Avec des mises à jour au même instant, deux voisines en conflit changent ensemble et restent en conflit : le hasard brise cette symétrie. Une grille peut aussi rester coincée dans un minimum local, une couture qu’aucune cellule seule ne peut défaire ; un bruit passager déplace la couture jusqu’à la faire sortir. Mais le bruit crée aussi des conflits : il faut l’arrêter pour que la règle les efface avant la lecture.');
    });

    // ================================================================ m4
    c.module('m4');
    c.set({ eta: 0.02 });
    c.chapter('Apprendre une règle', () => {
      c.stage('maze');
      c.diagram('ncaCell');
      c.step('Comparer à la solution', `Pour apprendre la règle, on part de problèmes dont on connaît la solution. On déroule la NCA pendant N pas (${fr(N)} pour les labyrinthes), on mesure l’écart entre ses canaux de sortie et la solution, puis on corrige légèrement les poids pour réduire cet écart. On recommence des milliers de fois.`);
      c.step('Remonter les pas', 'Pour savoir comment corriger un poids, il faut connaître son effet sur l’erreur finale, à travers tous les pas du déroulement. C’est la rétropropagation dans le temps. Elle garde en mémoire tous les états intermédiaires : sa mémoire grandit avec N, qui reste donc petit.');
      c.step('Le problème de l’horizon', `Or, sur un labyrinthe ${fr(PAPER.mazeBig)} × ${fr(PAPER.mazeBig)}, il faut ${fr(PAPER.mazeBigSteps)} pas. La règle n’est entraînée que sur des déroulements de ${fr(N)} pas : rien ne garantit qu’elle se comporte bien au-delà. Elle pourrait dériver, ou défaire une solution déjà trouvée.`);
    });
    c.chapter('Le réservoir d’échantillons', () => {
      c.stage('maze');
      c.diagram('replay');
      c.ask('q-replay', 'Comment entraîner une règle sur des milliers de pas avec des déroulements de 100 pas ?', ['reprendre des états déjà déroulés', 'entraîner sur des grilles plus petites', 'augmenter le taux de mise à jour', 'agrandir le voisinage des cellules'], 'Un état déjà déroulé plusieurs fois a vécu bien plus que 100 pas.');
      c.step('Reprendre là où on s’était arrêté', `L’article garde un réservoir d’échantillons : des états de grilles. À chaque itération, il en tire un lot, remplace une part r = ${pct(RS)} du lot par des problèmes neufs, déroule N pas, puis remet les états dans le réservoir. Un état tiré plusieurs fois a vécu plusieurs fois N pas.`);
      c.step('L’âge des états', `Un déroulement commence après au moins k déroulements avec la probabilité (1 − r)^k. Avec r = ${fr(RS, 2)}, ${pct(replayOlder(RS, 10))} des déroulements commencent au-delà de ${fr(10 * N)} pas. La règle apprend ainsi à garder une solution stable longtemps.`, {
        claims: [{ text: 'environ 5,6 % au-delà de 1 000 pas', check: () => near(replayOlder(RS, 10), 0.056, 0.01) || pct(replayOlder(RS, 10)) }],
      });
      c.experiment({
        title: 'La part de problèmes neufs', prompt: 'Réglez la part r de problèmes neufs dans chaque lot.',
        predict: { question: 'Sans réservoir (r = 100 %), quelle part des déroulements commence au-delà de 1 000 pas ?', choices: ['aucune', 'environ 5 %', 'environ la moitié'], answer: 0 },
        controls: [{ type: 'range', key: 'rseed', label: 'part de problèmes neufs r', min: 0.05, max: 1, step: 0.05, fmt: pct }],
        goals: [
          { label: 'Réglez r = 100 % : aucun état ne vieillit', test: ({ v }) => v.rseed >= 0.999 },
          { label: 'Trouvez un r qui donne au moins 10 % de neufs et 5 % au-delà de 1 000 pas', test: ({ v }) => v.rseed >= 0.1 - 1e-9 && replayOlder(v.rseed, 10) >= 0.05 },
        ],
        seq: true, conclusion: 'De 10 à 25 % de neufs, le réservoir mêle des débuts de déroulement et des états très âgés. Trop de neufs : la règle ne voit jamais de longs déroulements ; trop peu : elle voit peu de problèmes différents. L’article prend 25 %.',
      });
      c.exercise('replayCalc', 'Dans l’atelier, calculez l’âge des états du réservoir.');
      c.step('Des perturbations à l’entraînement', 'L’article abîme aussi les états pendant l’entraînement : du bruit, des disques remis à zéro, et parfois le problème remplacé par un autre en cours de route. Ces perturbations obligent la règle à toujours regarder son voisinage et à corriger. Sans elles ou sans réservoir, la généralisation s’effondre (figure 7A).');
      c.question('q-perturb', 'Pourquoi remplacer parfois le problème en cours de route pendant l’entraînement ?', ['pour que la règle relise toujours l’entrée', 'pour accélérer chaque déroulement', 'pour réduire le nombre de paramètres', 'pour que la réponse change moins'], 'Si le problème peut changer, la règle ne peut pas se contenter d’une réponse déjà calculée : elle doit continuer à percevoir et à corriger.');
      c.exercise('training', 'Dans l’atelier, remettez dans l’ordre une itération d’entraînement.');
    });
    c.chapter('Calculer seulement là où c’est utile', () => {
      c.stage('maze', { side: 41, D: 1500, adaptive: 1 });
      c.diagram('adaptive');
      c.step('Des cellules sûres', `Dans un labyrinthe presque résolu, la plupart des cellules ne changent plus. Disons qu’une cellule est sûre quand sa dernière mise à jour n’a rien changé ; les murs le sont toujours. Avec le calcul adaptatif, les cellules sûres se mettent à jour avec p = ${fr(PAPER.pLow, 1)} au lieu de ${fr(PAPER.pFire, 1)}. Sur la scène, un point blanc marque chaque mise à jour.`);
      c.step('Moins de calcul, plus de pas', `Sur ce labyrinthe 41 × 41, il faut ${fr(A41.solvedAt / U41.solvedAt, 2)} fois plus de pas, mais ${fr(A41.work / U41.work, 2)} fois les mises à jour du calcul uniforme. L’article mesure ×${fr(PAPER.adaptSteps, 2)} pour les pas et ×${fr(PAPER.adaptUpdates, 2)} pour les mises à jour, sur des labyrinthes ${fr(PAPER.mazeBig)} × ${fr(PAPER.mazeBig)}.`, {
        claims: [
          { text: 'plus de pas', check: () => A41.solvedAt > U41.solvedAt },
          { text: 'moins de mises à jour', check: () => A41.work < 0.9 * U41.work || fr(A41.work / U41.work, 2) },
        ],
      });
      c.experiment({
        title: 'Le taux des cellules sûres', prompt: 'Réglez le taux de mise à jour des cellules sûres. Le schéma compare les mises à jour cumulées au calcul uniforme.',
        predict: { question: 'Si les cellules sûres ne se mettent plus jamais à jour (taux 0)…', choices: ['l’élagage s’arrête en route', 'le calcul va plus vite', 'rien ne change'], answer: 0 },
        controls: [{ type: 'range', key: 'plow', label: 'taux des cellules sûres', min: 0, max: 0.8, step: 0.05, fmt: dec(2) }],
        goals: [
          { label: 'Réglez un taux nul : l’élagage se fige', test: ({ v }) => mazeOf({ ...v, adaptive: 1 }).outcome === 'frozen' },
          { label: 'Résolvez le labyrinthe avec au moins 20 % de mises à jour en moins', test: ({ v }) => { const a = mazeOf({ ...v, adaptive: 1 }), u = mazeOf({ ...v, adaptive: 0 }); return a.outcome === 'solved' && a.work <= 0.8 * u.work; } },
        ],
        seq: true, conclusion: 'Une cellule devenue sûre peut redevenir utile : quand sa voisine meurt, elle doit mourir à son tour. À taux nul, elle ne se met plus jamais à jour et l’élagage s’arrête. Un taux faible mais non nul économise des mises à jour au prix de quelques pas.',
      });
    });
    c.chapter('Réparer des dégâts', () => {
      c.stage('maze', { side: 41, D: 3000, damage: 1, adaptive: 1 });
      c.diagram('damage');
      c.step('Effacer une partie de la grille', 'Une fois le labyrinthe résolu, trois disques de cellules sont remis à zéro, comme dans l’article (figure 8). Les cellules effacées ne sont plus sûres : elles reprennent le taux plein. Autour, les cellules sûres restent presque au repos. La vague et l’élagage reprennent seulement dans les zones effacées.');
      c.step('Une réparation économe', `Sur ce labyrinthe, le calcul uniforme répare en ${fr(DU.repairSteps)} pas et ${fr(DU.repairWork)} mises à jour ; le calcul adaptatif en ${fr(DA.repairSteps)} pas et ${fr(DA.repairWork)} mises à jour. L’article mesure une réparation qui coûte ${fr(PAPER.repairUpdates, 2)} fois les mises à jour du calcul uniforme.`, {
        claims: [{ text: 'l’adaptatif répare avec moins de mises à jour', check: () => DA.repairWork > 0 && DA.repairWork < DU.repairWork }],
      });
      c.question('q-damage', 'Après les dégâts, où le calcul adaptatif concentre-t-il les mises à jour ?', ['dans les zones effacées', 'sur le chemin déjà trouvé', 'sur les murs du labyrinthe', 'uniformément partout'], 'Les cellules effacées ont changé : elles ne sont plus sûres et reprennent le taux plein.');
      c.explain('e-adapt', 'Expliquez pourquoi le calcul adaptatif économise des mises à jour, et pourquoi un taux nul pour les cellules sûres empêche de résoudre le labyrinthe.', 'Dans un labyrinthe en cours de résolution, la plupart des cellules ne changent plus : les mettre à jour à plein taux ne sert à rien, et le calcul adaptatif les ralentit. Mais une cellule sûre doit encore réagir quand ses voisines changent : au bout d’une impasse élaguée, la cellule d’avant doit mourir à son tour. Avec un taux nul, elle ne se met plus jamais à jour, et l’élagage s’arrête.');
    });
    c.chapter('Au-delà des labyrinthes', () => {
      c.stage('grid');
      c.diagram('results');
      c.step('Une NCA, plusieurs tâches', `Pour ARC-AGI-1, chaque cellule reçoit dans un canal une description apprise de la tâche. La même NCA applique alors des transformations différentes selon la tâche. Avec ${fr(PAPER.arcNcaParams, 1)} millions de paramètres, elle résout ${fr(PAPER.arcNca, 1)} % des énigmes, contre ${fr(PAPER.arcTrm, 1)} % pour TRM et ses ${fr(PAPER.arcTrmParams)} millions.`);
      c.step('Raisonner sur des pixels', `Au sudoku visuel, la grille est une image de ${fr(PAPER.visualSide)} × ${fr(PAPER.visualSide)} pixels, avec des chiffres manuscrits. La NCA doit lire les chiffres, résoudre et dessiner la réponse, sur une grille bien plus grande que ce qu’une cellule voit. Elle résout ${fr(PAPER.visualEasy, 1)} % des grilles faciles et ${fr(PAPER.visualHard, 1)} % des difficiles.`);
      c.step('Les limites', 'Le calcul est local, mais l’entraînement ne l’est pas : la rétropropagation dans le temps rassemble l’erreur de toute la grille. L’exploration par essais en parallèle reste une recherche au hasard. Enfin, la localité impose des délais : il faut beaucoup plus de pas qu’à un modèle qui voit toute la grille.');
    });
    c.set({ adaptive: 1, D: 1000 });
    c.clinicCase({
      id: 'clin-frozen', title: 'un élagage qui s’arrête en route', scene: 'maze', fault: { plow: 0 },
      observe: 'Le calcul adaptatif est activé, avec 1 000 pas. La vague remplit tout le labyrinthe, l’élagage commence, puis plus rien ne bouge : des impasses restent vivantes, orange, pendant des centaines de pas, jusqu’à la fin.',
      choices: ['le taux des cellules sûres, réglé à zéro', 'le nombre de pas, trop petit', 'le taux de mise à jour p, trop faible'],
      explain: 'Rien ne bouge depuis des centaines de pas : ce n’est pas une question de temps. Les cellules sûres ne se mettent plus jamais à jour.',
      controls: [{ type: 'range', key: 'plow', label: 'taux des cellules sûres', min: 0, max: 0.8, step: 0.05, fmt: dec(2) }],
      goal: { label: 'Le labyrinthe est résolu', test: (v) => isSolved(v) },
      conclusion: 'Avec un taux de 0,1 ou plus, les cellules sûres finissent par se mettre à jour, et l’élagage reprend jusqu’au bout.',
      justify: 'Le symptôme : l’élagage s’arrête et des impasses restent vivantes, sans aucun changement pendant des centaines de pas. La cause : le taux de mise à jour des cellules sûres est nul. Une cellule d’impasse devient sûre avant que sa voisine ne meure ; avec un taux nul, elle ne se remet jamais à jour et ne voit pas qu’elle est devenue un bout d’impasse. Avec un taux non nul, elle finit par se mettre à jour et meurt.',
    });
    c.clinicCase({
      id: 'clin-blink', title: 'une grille qui clignote', scene: 'grid', fault: { p: 1 },
      observe: 'Le bruit est coupé à mi-parcours, comme prévu. Mais, jusqu’à la fin, des zones entières de la grille changent de couleur à chaque pas, toutes ensemble. Le nombre de conflits ne baisse plus.',
      choices: ['les mises à jour, devenues synchrones', 'le bruit, laissé jusqu’à la fin', 'la grille, trop grande'],
      explain: 'Des zones entières changent ensemble à chaque pas : toutes les cellules se mettent à jour en même temps (p = 1).',
      controls: [{ type: 'range', key: 'p', label: 'taux de mise à jour p', min: 0.1, max: 1, step: 0.05, fmt: dec(2) }],
      goal: { label: 'La grille est résolue', test: (v) => gridIs(v, 'solved') },
      conclusion: `Avec p = ${fr(PAPER.pFire, 1)}, les voisines en conflit ne changent plus ensemble, et la grille se résout.`,
      justify: 'Le symptôme : des zones entières changent de couleur à chaque pas, ensemble, et les conflits ne baissent plus. La cause : un taux de mise à jour égal à 1, des mises à jour synchrones. Deux voisines de même couleur voient le même conflit et changent ensemble : elles restent de même couleur. Avec un taux plus faible, l’une change avant l’autre et la symétrie est brisée.',
    });

    // ============================================================== exam
    c.module('exam');
    c.clinicCase({
      id: 'exam-noise', exam: true, title: 'une grille qui ne se calme jamais', scene: 'grid', fault: { rn: 1 },
      observe: 'La grille est presque juste après une centaine de pas. Mais, jusqu’au dernier pas, des cases isolées changent de couleur, ici et là, jamais les mêmes, et quelques conflits apparaissent puis disparaissent. La grille n’est jamais tout à fait correcte.',
      choices: ['le bruit, qui n’est jamais coupé', 'les mises à jour, devenues synchrones', 'le nombre de pas, trop petit'],
      explain: 'Des changements isolés et dispersés jusqu’au bout : c’est le bruit, qui reste actif pendant tout le déroulement.',
      controls: [
        { type: 'range', key: 'rn', label: 'durée du bruit (part du déroulement)', min: 0.25, max: 1, step: 0.25, fmt: pct },
        { type: 'range', key: 'eta', label: 'bruit η', min: 0, max: 0.05, step: 0.01, fmt: dec(2) },
      ],
      goal: { label: 'La grille est résolue', test: (v) => gridIs(v, 'solved') },
      conclusion: 'Coupé à la moitié ou aux trois quarts du déroulement, le bruit laisse à la règle le temps d’effacer les derniers conflits.',
      justify: 'Le symptôme : des cases isolées changent de couleur jusqu’à la fin, sans que la grille se stabilise. La cause : le bruit n’est jamais coupé. Chaque cellule qui se met à jour peut changer de couleur au hasard et créer un conflit ; la règle le corrige, mais d’autres apparaissent. En coupant le bruit avant la fin, la règle seule efface les derniers conflits et la grille se résout.',
    });
    c.chapter('Test final', () => {
      c.stage('maze');
      c.step('Le test final', 'Ce test reprend les notions du test de départ, dans d’autres situations. Comparez ensuite vos deux résultats, notion par notion.');
      c.test('post', 'Le test final.');
    });
  },
});

