// Les mondes de « La Cité des permutants »: a course on the ideas of Greg
// Egan's novel (Permutation City, 1994), mostly its second part (chapters 23
// to the epilogue): the Elysium, a universe of computers made of a cellular
// automaton; the Cosmoplexe, a toy physics run inside it; the Lambertians,
// who evolved there and found their own explanation of their world. The
// figures of the text, the diagrams, the stage and the exercises all run
// ./model.ts; the figures quoted from the novel come from BOOK.

import { choice, dec, defineCourse, fr, numeric, pct, type Capsule } from '@coursekit/core';
import { choiceQ, type Exercise, type WorkshopConfig } from '@coursekit/exercises';
import { DIAGRAMS, THEORY_NAME, drawHistory, sci } from './diagrams.ts';
import {
  BOOK, TOY, cellOf, contestOf, crossoverBits, dustOf, gardenOf, gateOf, growOf, heatOf, history, machineOf, model,
  reach, reorder, rowKey, secondsPerHour, stepRing, supplyAt, timeRatio, transmitterKinds, tvcOverhead, type CellFn,
} from './model.ts';

const near = (a: number, b: number, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel;

// ------------------------------------------------- figures of the text

const G30 = gardenOf(30, 10), G184 = gardenOf(184, 12);
const CELLS = supplyAt(0) * BOOK.cellsPerProc;
const SPH = secondsPerHour(BOOK.slowNested), OVER = tvcOverhead();
const RATIO = timeRatio(), DAY = RATIO / 365.25;
const M8 = machineOf(8, false), M16 = machineOf(16, false), MG = machineOf(8, true);
const H_NOM = heatOf(1, 1), H_TORUS = heatOf(0, 1), H_CLIN = heatOf(0.1, 1), H_HOT = heatOf(1, 4);
const LATE4 = growOf(4, 1);
const CROSS = crossoverBits();
const C8 = contestOf(8, true), C12 = contestOf(12, true);
const D1 = dustOf(24, 1);
const R1 = reach(1e12, 1), R3 = reach(1e12, 3);

// ------------------------------------------------------------- toolbox

const CAPSULES: Capsule[] = [
  {
    id: 'B1', title: 'Lire un nombre en binaire',
    goal: 'Passer d’un nombre écrit en binaire à son écriture ordinaire, et lire un de ses chiffres.',
    used: 'Le numéro d’une règle d’automate cellulaire.',
    steps: [
      { title: 'Des puissances de 2', text: 'En binaire, chaque chiffre vaut 0 ou 1. En partant de la droite, les positions valent 1, 2, 4, 8, 16, 32, 64, 128. Un nombre est la somme des positions qui portent un 1.', code: '00011110 = 16 + 8 + 4 + 2 = 30' },
      { title: 'Le numéro d’une règle', diagram: 'rule', text: 'Une règle d’automate élémentaire donne le nouvel état pour chacun des 8 voisinages possibles. Ces 8 réponses, écrites à la suite, forment un nombre binaire de 8 chiffres : le numéro de la règle, de 0 à 255.' },
      { title: 'Lire un chiffre', text: 'Le chiffre numéro k d’un nombre n (k = 0 tout à droite) s’obtient en divisant n par 2^k, en gardant la partie entière, puis en prenant le reste de la division par 2.', code: 'bit = Math.floor(n / 2 ** k) % 2' },
    ],
    check: [
      numeric('Que vaut le nombre binaire 01101110 ?', 110, '64 + 32 + 8 + 4 + 2 = 110.', { tol: 0 }),
      choice('Quel est le chiffre numéro 0, tout à droite, de 30 écrit en binaire ?', ['0', '1', '2', '3'], '30 est pair : son dernier chiffre binaire est 0.'),
    ],
  },
  {
    id: 'P1', title: 'Puissances et croissance',
    goal: 'Compter des états avec 2^N, et comparer des croissances en puissances du temps.',
    used: 'Les états d’une machine finie ; la croissance de la matrice TVC.',
    steps: [
      { title: '2 puissance N', text: 'Une mémoire de N bits peut prendre 2^N états différents : chaque bit ajouté double le nombre d’états. 10 bits donnent 1 024 états, 20 bits plus d’un million.', code: 'etats = 2 ** N' },
      { title: 'Un cube', text: 'Un cube de 1 000 objets par arête en contient 1 000³ = 10⁹. Si l’arête double, le volume est multiplié par 2³ = 8.' },
      { title: 'Qui gagne à la longue', diagram: 'crystal', text: 'Entre deux quantités qui croissent comme t³ et comme t⁴, la seconde finit toujours par dépasser la première, quels que soient les facteurs devant. Seul l’exposant compte à la longue.' },
    ],
    check: [
      numeric('Combien d’états différents une mémoire de 12 bits peut-elle prendre ?', 4096, '2^12 = 4 096.', { tol: 0 }),
      choice('Quand t devient très grand, laquelle de ces quantités devient la plus grande ?', ['t⁴', '1 000 × t³', 't³ + 10⁶', '100 × t²'], 'L’exposant le plus élevé finit par l’emporter, quel que soit le facteur devant.'),
    ],
  },
  {
    id: 'L1', title: 'Mesurer une description en bits',
    goal: 'Compter la longueur d’une description en bits, et comparer deux descriptions.',
    used: 'La compétition des explications, à la fin du roman.',
    steps: [
      { title: 'Un bit, deux possibilités', text: 'Avec b bits, on distingue 2^b valeurs. Noter une mesure avec 10 bits, c’est la donner à environ un millième près : 2^10 = 1 024.' },
      { title: 'Additionner les longueurs', text: 'Pour décrire des observations, on écrit des règles, puis les nombres que les règles n’expliquent pas. La longueur totale est la somme des deux. 32 nombres de 8 bits coûtent 256 bits.', code: 'longueur = regles + 32 * b' },
      { title: 'La plus courte', diagram: 'theories', text: 'Entre deux descriptions qui reproduisent les mêmes observations, on préfère la plus courte. C’est une façon précise d’énoncer le rasoir d’Occam.' },
    ],
    check: [
      numeric('32 nombres notés chacun sur 8 bits : combien de bits en tout ?', 256, '32 × 8 = 256.', { tol: 0 }),
      choice('Une mesure notée sur 10 bits distingue combien de valeurs ?', ['1 024', '10', '100', '20'], '2^10 = 1 024.'),
    ],
  },
];

// ----------------------------------------------------------- exercises

/** the learner's rule at work: the history of four rules from one cell, flattened */
const traceOf = (cell: CellFn, rule: number) => history(rule, 31, 0, 24, cell).flatMap((r) => Array.from(r));

/** a fixed shuffle of a 20-frame history, and the true position of each card */
const SHUFFLE = [7, 2, 15, 0, 11, 19, 4, 9, 13, 1, 17, 6, 3, 18, 10, 14, 5, 12, 8, 16];
const nextOf = (rule: number, cell: CellFn = cellOf) => (f: string) => rowKey(stepRing(Uint8Array.from(f, Number), rule, cell));
const cardsOf = (rule: number, seed: number, cell: CellFn = cellOf) => { const h = history(rule, 24, seed, 20, cell).map(rowKey); return SHUFFLE.map((i) => h[i]); };

const previewRuns = new WeakMap<Function, number[][] | null>();

function rulePreview(ctx: CanvasRenderingContext2D, fn: Function | null): void {
  ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (!fn) { ctx.fillStyle = '#7c9cff'; ctx.fillText('écrivez votre fonction', 20, 20); return; }
  if (!previewRuns.has(fn)) { try { previewRuns.set(fn, [30, 90, 184].map((r) => traceOf(fn as CellFn, r))); } catch { previewRuns.set(fn, null); } }
  const runs = previewRuns.get(fn);
  if (!runs) { ctx.fillStyle = '#ff6b7a'; ctx.fillText('votre fonction lève une erreur', 20, 20); return; }
  [30, 90, 184].forEach((r, i) => {
    const rows = history(r, 31, 0, 24, fn as CellFn);
    drawHistory(ctx, rows, 16 + i * 120, 36, 3.4);
    ctx.fillStyle = '#e6eaf5'; ctx.fillText(`règle ${r}`, 16 + i * 120, 24);
  });
}

function assemblyPreview(ctx: CanvasRenderingContext2D, cell: CellFn, sort: (f: string[], n: (f: string) => string) => number[]): void {
  ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let cards: string[], order: number[];
  try { cards = cardsOf(30, 3, cell); order = sort(cards, nextOf(30, cell)); } catch { ctx.fillStyle = '#ff6b7a'; ctx.fillText('une de vos fonctions lève une erreur', 20, 20); return; }
  ctx.fillStyle = '#e6eaf5'; ctx.fillText('cartes battues', 20, 22); ctx.fillText('remises en ordre', 200, 22);
  const draw = (keys: string[], x: number) => keys.forEach((k, j) => { for (let i = 0; i < k.length; i++) if (k[i] === '1') { ctx.fillStyle = `hsl(${30 + (SHUFFLE[cards.indexOf(k)] / 20) * 200},75%,62%)`; ctx.fillRect(x + i * 6, 32 + j * 9, 5, 7); } });
  draw(cards, 20);
  draw(order.map((j) => cards[j] ?? ''), 200);
  const ok = order.length === 20 && order.every((j, i) => SHUFFLE[j] === i);
  ctx.fillStyle = ok ? '#5ee0a0' : '#ff6b7a'; ctx.fillText(ok ? 'l’histoire est retrouvée' : 'l’ordre n’est pas encore le bon', 200, 222);
}

const exercises: Exercise[] = [
  {
    id: 'cell', module: 'm1', kind: 'code', title: 'La règle d’une cellule', slot: 'cell',
    sig: 'function cell(l, c, r, rule)',
    doc: 'l, c, r : les états (0 ou 1) de la voisine de gauche, de la cellule, de la voisine de droite · rule : le numéro de la règle, de 0 à 255. Renvoie le nouvel état de la cellule (0 ou 1).',
    goal: 'Lire le voisinage comme un nombre binaire de trois chiffres, k = 4·l + 2·c + r, puis renvoyer le chiffre numéro k du numéro de la règle.',
    solution: `function cell(l, c, r, rule) {
  const k = 4 * l + 2 * c + r;
  return Math.floor(rule / 2 ** k) % 2;
}`,
    starter: `function cell(l, c, r, rule) {
  // 1. le voisinage, lu comme un nombre de 0 à 7
  // 2. le chiffre correspondant du numéro de la règle
  return c;
}`,
    hints: [
      'Le voisinage 1, 1, 0 se lit 110 en binaire : 4 + 2 + 0 = 6.',
      'Le chiffre numéro k d’un nombre : divisez par 2 ** k, gardez la partie entière, prenez le reste de la division par 2.',
      'Vérifiez avec la règle 204 : elle doit toujours renvoyer c, l’état de la cellule elle-même.',
    ],
    win: 'Votre fonction fait tourner n’importe laquelle des 256 règles, exactement comme la référence.',
    primm: {
      intro: 'Voici une version presque juste. Lisez-la avant de l’exécuter.',
      code: `function cell(l, c, r, rule) {
  const k = l + c + r;
  return Math.floor(rule / 2 ** k) % 2;
}`,
      predict: choiceQ('Avec ce code, les voisinages 1, 0, 0 et 0, 0, 1 donnent-ils le même nouvel état ?', ['oui, toujours', 'non, jamais', 'seulement pour la règle 30'], 'Les deux voisinages donnent k = 1 : le code lit le même chiffre de la règle.'),
      investigate: choiceQ('Pourquoi ce code est-il faux ?', ['il confond la gauche et la droite', 'il lit les chiffres à l’envers', 'il oublie la cellule elle-même'], 'En additionnant l, c et r, on ne sait plus quelle position portait le 1 : huit voisinages se réduisent à quatre valeurs.'),
      modify: 'Corrigez le calcul de k : chaque position du voisinage a son propre poids, 4, 2 et 1.',
    },
    scenarios: [
      { name: 'règle 30, une cellule au départ', run: (impl) => traceOf(impl.cell as CellFn, 30), tol: 0 },
      { name: 'règle 90', run: (impl) => traceOf(impl.cell as CellFn, 90), tol: 0 },
      { name: 'règle 110', run: (impl) => traceOf(impl.cell as CellFn, 110), tol: 0 },
      { name: 'règle 184', run: (impl) => history(184, 31, 4, 24, impl.cell as CellFn).flatMap((r) => Array.from(r)), tol: 0 },
    ],
    preview: (ctx, fn) => rulePreview(ctx, fn),
  },
  {
    id: 'gardenCalc', module: 'm1', kind: 'calculation', title: 'Compter les jardins d’Éden',
    intro: 'Un anneau de 10 cellules évolue selon la règle 30. On a calculé, pour chaque configuration possible, combien de configurations y mènent en un cycle.',
    steps: [
      { prompt: 'Combien de configurations différentes un anneau de 10 cellules peut-il prendre ?', value: G30.total, tol: 0, explain: `Chaque cellule vaut 0 ou 1 : 2^10 = ${fr(G30.total)}.` },
      { prompt: `${fr(G30.gardens)} de ces configurations n’ont aucun antécédent. Quelle part du total est-ce (en %) ?`, value: G30.share * 100, unit: '%', tol: 0.02, explain: `${fr(G30.gardens)} ÷ ${fr(G30.total)} ≈ ${pct(G30.share)}.` },
      { prompt: 'Chaque configuration a exactement une suivante. Combien de configurations ont au moins un antécédent ?', value: G30.total - G30.gardens, tol: 0, explain: `${fr(G30.total)} − ${fr(G30.gardens)} = ${fr(G30.total - G30.gardens)}. Ces configurations se partagent les ${fr(G30.total)} flèches : certaines en reçoivent plusieurs.` },
    ],
    win: 'Les jardins d’Éden sont exactement les places que plusieurs configurations se disputent ailleurs.',
  },
  {
    id: 'reorder', module: 'm1', kind: 'code', title: 'Remettre la poussière en ordre', slot: 'reorder', parsons: true,
    sig: 'function reorder(frames, next)',
    doc: 'frames : une liste de chaînes de 0 et de 1, les lignes d’une histoire d’automate, mélangées (toutes différentes) · next(f) : la ligne qui suit f selon la règle. Renvoie la liste des indices de frames dans l’ordre de l’histoire.',
    goal: 'Pour chaque ligne, trouver l’indice de sa suivante (frames.indexOf(next(f)), −1 si elle n’est pas dans la liste). La première ligne est celle dont l’indice n’apparaît nulle part comme suivante. Partir d’elle et suivre les suivantes.',
    solution: `function reorder(frames, next) {
  const succ = frames.map((f) => frames.indexOf(next(f)));
  let i = 0;
  while (succ.includes(i)) i++;
  const order = [i];
  for (i = succ[i]; i !== -1; i = succ[i]) order.push(i);
  return order;
}`,
    starter: `function reorder(frames, next) {
  // 1. l'indice de la suivante de chaque ligne
  // 2. la première ligne : celle qui n'est la suivante d'aucune autre
  // 3. suivre les suivantes depuis la première
  return frames.map((f, i) => i);
}`,
    hints: [
      'frames.indexOf(next(f)) donne l’indice de la ligne suivante, ou −1 si elle n’est pas dans la liste.',
      'La première ligne est la seule dont l’indice n’apparaît pas dans succ : avancez i tant que succ.includes(i) est vrai.',
      'Une boucle for peut avancer avec i = succ[i] et s’arrêter quand i vaut −1.',
    ],
    win: 'Votre fonction retrouve l’histoire à partir des seules lignes : l’ordre était dans les états.',
    tests: [
      { label: 'règle 30, départ au hasard', run: (fn) => { const o = fn(cardsOf(30, 3), nextOf(30)); return Array.isArray(o) && o.length === 20 && o.every((j: number, i: number) => SHUFFLE[j] === i) ? null : 'l’ordre renvoyé n’est pas celui de l’histoire'; } },
      { label: 'règle 110, autre départ', run: (fn) => { const o = fn(cardsOf(110, 8), nextOf(110)); return Array.isArray(o) && o.length === 20 && o.every((j: number, i: number) => SHUFFLE[j] === i) ? null : 'l’ordre renvoyé n’est pas celui de l’histoire'; } },
      { label: 'identique à la référence', run: (fn) => { const c = cardsOf(30, 9); return JSON.stringify(fn(c, nextOf(30))) === JSON.stringify(reorder(c, nextOf(30))) ? null : 'différent de la référence'; } },
    ],
  },
  {
    id: 'tvcCalc', module: 'm2', kind: 'calculation', title: 'La taille du jardin d’Éden TVC',
    intro: `Au lancement, le cube TVC comptait ${fr(BOOK.edge)} processeurs par arête ; chaque processeur occupait ${sci(BOOK.cellsPerProc)} cellules d’automate, sans compter sa mémoire. La Copie de Durham tournait ${fr(BOOK.slowNested)} fois plus lentement que le temps réel.`,
    steps: [
      { prompt: 'Combien de processeurs le cube comptait-il ?', value: supplyAt(0), tol: 0.001, explain: `${fr(BOOK.edge)}³ = ${sci(supplyAt(0))}.` },
      { prompt: 'Combien de cellules d’automate ces processeurs occupaient-ils en tout ?', value: CELLS, tol: 0.01, explain: `${sci(supplyAt(0))} × ${sci(BOOK.cellsPerProc)} = ${sci(CELLS)}.` },
      { prompt: 'Combien de secondes de la vie de la Copie Maria et Durham voyaient-ils en une heure ?', value: SPH, unit: 's', tol: 0.03, explain: `3 600 s ÷ ${fr(BOOK.slowNested)} ≈ ${fr(SPH, 1)} s : « quatorze secondes » par heure, dit le roman.` },
    ],
    win: 'Des dizaines de millions de milliards de cellules, pour quelques secondes de vie par heure : le prix d’un univers simulé dans un autre.',
  },
  {
    id: 'timeCalc', module: 'm3', kind: 'calculation', title: 'Deux horloges',
    intro: `Durant les ${fr(BOOK.elysianYears)} ans vécus par la plupart des Élysiens, ${sci(BOOK.lambertYears)} années se sont écoulées sur la planète Lambert. Un neurotransmetteur lambertien est fait de ${fr(BOOK.subunits)} sous-unités qui ont chacune ${fr(BOOK.variants)} formes possibles.`,
    steps: [
      { prompt: 'Combien d’années lambertiennes passent pendant une année élysienne ?', value: RATIO, tol: 0.01, explain: `${sci(BOOK.lambertYears)} ÷ ${fr(BOOK.elysianYears)} ≈ ${fr(RATIO)}.` },
      { prompt: 'Et pendant une journée élysienne ?', value: DAY, tol: 0.01, explain: `${fr(RATIO)} ÷ 365,25 ≈ ${fr(DAY)} ans.` },
      { prompt: 'Combien de neurotransmetteurs différents peut-on former ?', value: transmitterKinds(), tol: 0, explain: `${fr(BOOK.variants)} × ${fr(BOOK.variants)} × ${fr(BOOK.variants)} = ${fr(transmitterKinds())} : « près de trois mille ».` },
    ],
    win: 'Le Cosmoplexe tourne à sa propre vitesse : les Élysiens peuvent la régler, pas les lois qu’il suit.',
  },
  {
    id: 'laws', module: 'm3', kind: 'classify', title: 'Qui obéit aux lois du Cosmoplexe ?',
    intro: 'Le Cosmoplexe est un automate cellulaire : une seule règle pour toutes ses cellules. Classez chaque élément du récit.',
    categories: ['obéit aux lois du Cosmoplexe', 'n’obéit pas aux lois du Cosmoplexe'],
    items: [
      { text: 'un Lambertien qui butine une prairie', cat: 0 },
      { text: 'la lumière qui quitte l’étoile', cat: 0 },
      { text: 'le vaisseau Ambassador, une fois entré', cat: 0 },
      { text: 'Porte-Parole, l’essaim de robots, une fois débarqué', cat: 0, why: 'ses robots sont faits d’atomes du Cosmoplexe ; seuls les signaux qui les commandent viennent du bord' },
      { text: 'le logiciel qui observe la planète', cat: 1, why: 'il lit les cellules de l’extérieur, sans être fait d’elles' },
      { text: 'la couche qui crée les atomes du gaz interstellaire', cat: 1 },
      { text: 'les gants de Maria qui saisissent une molécule', cat: 1, why: 'manipuler le contenu, c’est enfreindre les lois' },
    ],
    win: 'Tout ce qui est fait de cellules suit la règle ; ce qui lit, crée ou saisit de l’extérieur ne la suit pas.',
  },
  {
    id: 'mdlCalc', module: 'm4', kind: 'calculation', title: 'La plus courte explication',
    intro: `Les règles du Cosmoplexe s’écrivent, dans ce modèle, en ${fr(TOY.rulesBits)} bits ; les équations de champ lambertiennes en ${fr(TOY.fieldBits)} bits. Les abondances des ${fr(BOOK.atoms)} atomes sont mesurées à 12 bits près.`,
    steps: [
      { prompt: 'Combien de bits faut-il pour noter les abondances, si la théorie ne les explique pas ?', value: BOOK.atoms * 12, tol: 0, explain: `${fr(BOOK.atoms)} × 12 = ${fr(BOOK.atoms * 12)}.` },
      { prompt: 'Quelle est la longueur de la théorie classique (règles, puis abondances) ?', value: C12.costs.classic, tol: 0, explain: `${fr(TOY.rulesBits)} + ${fr(BOOK.atoms * 12)} = ${fr(C12.costs.classic)}.` },
      { prompt: 'De combien de bits les équations de champ sont-elles plus courtes ?', value: C12.costs.classic - C12.costs.field, tol: 0, explain: `${fr(C12.costs.classic)} − ${fr(TOY.fieldBits)} = ${fr(C12.costs.classic - C12.costs.field)} : elles prédisent les abondances au lieu de les recopier.` },
    ],
    win: 'Plus les mesures sont précises, plus une théorie qui prédit les abondances devient avantageuse.',
  },
  {
    id: 'collapse', module: 'm4', kind: 'sequence', title: 'La fin de l’Élysium',
    intro: 'Remettez dans l’ordre les événements des chapitres 24 à 32.',
    items: [
      'l’assemblée vote d’attendre que les Lambertiens imaginent les Élysiens',
      'Durham ne parvient plus à geler le Cosmoplexe',
      'un atome rouge écrit à l’intérieur reste sans effet',
      'le vaisseau entre par la couche limite',
      'les Lambertiens rejettent les règles TVC',
      'Permutation City implose',
      'les Élysiens partent vers une nouvelle configuration jardin d’Éden',
    ],
    explain: 'Le vote précède la découverte du gel impossible ; l’échec de l’atome rouge mène au plan du vaisseau ; le rejet des règles TVC coïncide avec l’implosion de la Cité ; l’évacuation vient en dernier.',
    win: 'Chaque tentative pour imposer l’explication des Élysiens a montré un peu plus qu’elle ne s’imposait plus.',
  },
];

const workshop: WorkshopConfig = {
  assembly: {
    title: 'Ma règle et mon tri',
    intro: 'Votre fonction cell fait tourner la règle 30 ; l’histoire est battue comme un jeu de cartes ; votre fonction reorder la remet en ordre. Le résultat est comparé à l’ordre vrai.',
    scenarios: [
      { name: 'règle 30 : ordre retrouvé', run: (impl) => (impl.reorder as (f: string[], n: (f: string) => string) => number[])(cardsOf(30, 3, impl.cell as CellFn), nextOf(30, impl.cell as CellFn)).map((j) => SHUFFLE[j]), tol: 0 },
      { name: 'règle 110 : ordre retrouvé', run: (impl) => (impl.reorder as (f: string[], n: (f: string) => string) => number[])(cardsOf(110, 8, impl.cell as CellFn), nextOf(110, impl.cell as CellFn)).map((j) => SHUFFLE[j]), tol: 0 },
    ],
    preview: (ctx, impl) => assemblyPreview(ctx, impl.cell as CellFn, impl.reorder as (f: string[], n: (f: string) => string) => number[]),
  },
};

// --------------------------------------------------------------- course

const course = defineCourse({
  id: 'permutants', version: 1, language: 'fr',
  title: 'Les mondes de La Cité des permutants',
  lead: 'Dans la seconde partie du roman de Greg Egan, Maria se réveille dans l’Élysium, un univers d’ordinateurs bâti sur un automate cellulaire. Une partie de cet univers fait tourner le Cosmoplexe, une physique jouet où une civilisation est apparue. Ce cours construit des versions miniatures de ces mondes, pour comprendre ce qu’ils sont, comment ils tiennent, et pourquoi l’explication des Lambertiens finit par l’emporter sur celle de leurs créateurs.',
  audience: { level: 'lecteurs du roman, à partir de la fin du lycée', prerequisites: 'Avoir lu le roman aide, sans être indispensable. Les nombres binaires, les puissances et la mesure d’une description en bits sont rappelés dans des fiches. Deux exercices facultatifs demandent un peu de programmation.', effort: 'trois à quatre heures' },
  modules: [
    {
      id: 'm1', title: 'Des univers faits de règles', pitch: 'Un automate cellulaire, ses configurations sans passé et la théorie de la poussière : les idées sur lesquelles repose toute la seconde partie.',
      goals: ['Faire tourner un automate cellulaire à partir du numéro de sa règle', 'Reconnaître une configuration jardin d’Éden et expliquer l’argument de Durham', 'Expliquer pourquoi l’ordre de calcul ne change rien à une histoire, alors qu’un trou se remarque'],
      summary: ['Un automate cellulaire : des cellules, un état chacune, une seule règle appliquée partout à chaque cycle d’horloge.', 'Une configuration jardin d’Éden n’a aucun antécédent : si on la trouve dans son passé, elle a été installée de l’extérieur.', 'Chaque état désigne son suivant : une histoire calculée dans le désordre se remet en ordre d’elle-même.', 'La théorie de la poussière : toute configuration cohérente « se trouve » elle-même, quel que soit l’ordre des événements qui la portent.'],
    },
    {
      id: 'm2', title: 'L’Élysium, un univers d’ordinateurs', pitch: 'Le TVC, des ordinateurs faits de cellules qui se recopient ; une matrice qui croît comme un cristal ; une ville partagée ; et ce que signifie vivre éternellement dans une machine.',
      goals: ['Expliquer pourquoi le TVC a plus de trois dimensions', 'Comparer la croissance de la matrice à celle du Temps standard', 'Expliquer pourquoi une machine finie finit par se répéter'],
      summary: ['Le TVC : un automate dont les machines sont à la fois constructeur universel et ordinateur universel ; à six dimensions, chaque processeur a sa mémoire en volume.', 'Les simulations emboîtées multiplient leurs ralentissements : environ 250 pour la Copie de Durham.', 'La matrice croît comme un cristal, en t³ ; elle garde un surplus tant que le Temps standard accélère moins vite.', 'Une machine finie de N bits revient à un état connu en au plus 2^N cycles : sans croissance, pas d’éternité nouvelle.'],
    },
    {
      id: 'm3', title: 'Le Cosmoplexe et la planète Lambert', pitch: 'Une physique jouet à 32 atomes, trois milliards d’années d’évolution, et le bord du monde : la seule porte qui n’enfreint aucune loi.',
      goals: ['Décrire ce qui distingue la physique du Cosmoplexe de la nôtre', 'Expliquer pourquoi Maria a laissé une frontière ouverte plutôt qu’un tore', 'Expliquer pourquoi on ne peut entrer que par la couche limite'],
      summary: ['Le Cosmoplexe : 32 atomes, ni noyaux ni fusion, une seule étoile chauffée par la gravitation, un espace plat qui ne s’étend pas.', 'Un seul germe, trois milliards d’années : 690 millions d’espèces que personne n’a dessinées.', 'Refermé en tore, le volume garderait sa lumière et la planète bouillirait ; ouvert, il la laisse sortir.', 'À l’intérieur, ajouter un atome viole la règle ; seule la couche limite, hors des lois, permet d’agir sans tricher.'],
    },
    {
      id: 'm4', title: 'La guerre des explications', pitch: 'Les Lambertiens choisissent leurs théories en dansant ; la plus courte l’emporte, et finit par défaire l’univers qui les fait tourner.',
      goals: ['Comparer deux explications par leur longueur', 'Expliquer pourquoi les Lambertiens rejettent les règles TVC', 'Diagnostiquer un univers simulé en panne'],
      summary: ['Une équipe de Lambertiens danse une théorie ; une théorie trop compliquée fait se disloquer la danse.', 'La plus courte description des observations gagne : les équations de champ, dès que les abondances sont mesurées finement.', 'Les créateurs ajoutent des règles sans rien expliquer de plus ; et un monde éternel est, pour les Lambertiens, une absurdité.', 'Quand deux explications cohérentes s’affrontent, la hiérarchie entre simulation et réalité ne tient plus : l’Élysium se défait.'],
    },
    { id: 'exam', title: 'Épreuve', kind: 'exam', pitch: 'Une histoire en panne à diagnostiquer seul, et le test final.', goals: ['Diagnostiquer seul un cas inconnu'], summary: ['Observer, supposer, corriger un seul réglage, justifier.'] },
  ],
  glossary: [
    { id: 'ca', name: 'automate cellulaire', forms: ['automates cellulaires', 'automate'], def: 'Un ensemble de cellules qui ont chacune un état ; à chaque cycle, chaque cellule calcule son nouvel état à partir du sien et de ceux de ses voisines, avec la même règle partout.', module: 'm1' },
    { id: 'tick', name: 'cycle d’horloge', forms: ['cycles d’horloge'], def: 'Un pas de temps d’un automate : toutes les cellules appliquent la règle une fois.', module: 'm1' },
    { id: 'pred', name: 'antécédent', forms: ['antécédents'], def: 'Une configuration qui mène à une autre en un cycle d’horloge.', module: 'm1' },
    { id: 'goe', name: 'configuration jardin d’Éden', forms: ['configurations jardin d’Éden', 'jardin d’Éden', 'jardins d’Éden'], def: 'Une configuration qu’aucune configuration ne produit : elle n’a pas d’antécédent. Elle ne peut être que l’état de départ, installé de l’extérieur.', module: 'm1' },
    { id: 'rev', name: 'réversible', forms: ['réversibles'], def: 'Se dit d’une règle où chaque configuration a exactement un antécédent : on peut remonter le temps, et il n’y a aucune configuration jardin d’Éden.', module: 'm1' },
    { id: 'copy', name: 'Copie', forms: ['Copies'], def: 'Une personne numérisée dont le cerveau et le corps sont calculés par un ordinateur.', module: 'm1' },
    { id: 'dust', name: 'théorie de la poussière', def: 'L’idée de Paul Durham : l’univers est un nuage d’événements sans ordre ; toute configuration cohérente de ces événements se perçoit elle-même, quel que soit l’ordre où ils ont eu lieu.', module: 'm1' },
    { id: 'occam', name: 'rasoir d’Occam', def: 'Le principe qui fait préférer, entre deux explications des mêmes faits, la plus simple.', tool: 'L1', module: 'm1' },
    { id: 'elysium', name: 'Élysium', def: 'L’univers TVC lancé par Durham, où vivent les Copies des fondateurs et leurs descendants.', module: 'm1' },
    { id: 'cosmo', name: 'Cosmoplexe', def: 'Un univers jouet inventé par Max Lambert : un automate cellulaire dont les lois imitent une physique simplifiée, à 32 atomes.', module: 'm1' },
    { id: 'tvc', name: 'TVC', def: 'Turing, von Neumann, Chiang : l’automate cellulaire à plusieurs dimensions sur lequel l’Élysium est bâti.', module: 'm1' },
    { id: 'lamb', name: 'Lambertien', forms: ['Lambertiens', 'lambertienne', 'lambertiennes', 'lambertien'], def: 'Un habitant pensant de la planète Lambert, dans le Cosmoplexe.', module: 'm1' },
    { id: 'launch', name: 'lancement', def: 'Le calcul des premiers instants de l’univers TVC sur des ordinateurs réels, avant qu’on les éteigne.', module: 'm1' },
    { id: 'ucons', name: 'constructeur universel', def: 'Une machine qui peut construire n’importe quelle autre machine, elle-même comprise, à partir de son plan.', module: 'm2' },
    { id: 'ucomp', name: 'ordinateur universel', def: 'Une machine qui peut effectuer n’importe quel calcul, si on lui donne le programme.', module: 'm2' },
    { id: 'matrix', name: 'matrice', def: 'Le réseau des processeurs TVC, rangés en un cube qui ne cesse de croître.', module: 'm2' },
    { id: 'std', name: 'Temps standard', def: 'La vitesse commune à laquelle la plupart des Élysiens vivent ; elle accélère par rapport à l’horloge de l’automate TVC.', tool: 'P1', module: 'm2' },
    { id: 'slow', name: 'facteur de ralentissement', def: 'Le nombre de secondes de temps réel nécessaires pour calculer une seconde vécue par une Copie.', module: 'm2' },
    { id: 'rv', name: 'RV composite', def: 'Une réalité virtuelle faite de milliers de règles particulières (une pour la lumière, une pour les foules, une pour les tapis…), qui se contredisent entre elles.', module: 'm2' },
    { id: 'pyr', name: 'pyramide', forms: ['pyramides'], def: 'Une des 24 parts du cube de l’Élysium : une par fondateur, six pour les projets communs.', module: 'm2' },
    { id: 'core', name: 'noyau', def: 'Le centre de l’Élysium : bases de données et communications, par où passent tous les échanges entre territoires.', module: 'm2' },
    { id: 'exo', name: 'exomental', def: 'Le logiciel qui assiste une Copie et peut modifier son cerveau à sa demande.', module: 'm2' },
    { id: 'puppet', name: 'pantin', forms: ['pantins'], def: 'Un passant simulé par des règles simples, sans conscience, qui peuple les rues de la Cité.', module: 'm2' },
    { id: 'finite', name: 'machine finie', def: 'Un calculateur dont la mémoire ne peut prendre qu’un nombre fini d’états : il finit par revenir à un état déjà connu.', tool: 'P1', module: 'm2' },
    { id: 'solip', name: 'Nation solipsiste', def: 'Une philosophie de Copies qui tournent le dos au monde physique ; Peer décide de devenir à lui seul une foule de personnes.', module: 'm2' },
    { id: 'false', name: 'couleurs fausses', def: 'Les couleurs conventionnelles qui servent à afficher le Cosmoplexe : ses atomes n’ont pas de couleur.', module: 'm3' },
    { id: 'cons', name: 'loi de conservation', def: 'Une loi qui garde une quantité constante : dans la règle 184, le nombre d’atomes ne change jamais.', module: 'm3' },
    { id: 'torus', name: 'tore', def: 'Un espace fini sans bord : ce qui sort d’un côté revient par le côté opposé.', module: 'm3' },
    { id: 'layer', name: 'couche limite', def: 'La mince couche de cellules au bord du Cosmoplexe, qui n’obéit pas à ses lois : le logiciel du gaz interstellaire y crée des atomes.', module: 'm3' },
    { id: 'aqua', name: 'aqua', def: 'L’équivalent de l’eau dans la chimie du Cosmoplexe.', module: 'm3' },
    { id: 'watch', name: 'logiciel de surveillance', def: 'Le programme qui observe la planète Lambert : il lit les cellules du Cosmoplexe sans en faire partie.', module: 'm3' },
    { id: 'dance', name: 'danse', forms: ['danses'], def: 'Le langage collectif des Lambertiens : une équipe exprime et met à l’épreuve un modèle en le dansant ensemble.', module: 'm4' },
    { id: 'field', name: 'équations de champ', def: 'La théorie lambertienne finale : 32 solutions stables, une par atome, et une génération de matière qui explique le nuage originel.', module: 'm4' },
    { id: 'relat', name: 'principe de relativité', def: 'L’idée de Zemansky : il n’y a plus de référentiel privilégié ; ralentir le Cosmoplexe revient à accélérer l’Élysium.', module: 'm4' },
  ],
  toolbox: CAPSULES,
  tests: {
    tools: [
      { id: 'a1', skill: 'Lire un nombre en binaire', tool: 'B1', q: numeric('Que vaut le nombre binaire 01011010 ?', 90, '64 + 16 + 8 + 2 = 90.', { tol: 0 }) },
      { id: 'a2', skill: 'Puissances et croissance', tool: 'P1', q: choice('Une mémoire passe de 10 à 20 bits. Le nombre d’états possibles est multiplié par…', ['1 024', '2', '10', '100'], '2^20 ÷ 2^10 = 2^10 = 1 024.') },
      { id: 'a3', skill: 'Mesurer une description en bits', tool: 'L1', q: numeric('Une théorie demande 1 500 bits de règles et laisse 32 nombres de 6 bits sans explication. Quelle est sa longueur totale, en bits ?', 1692, '1 500 + 32 × 6 = 1 692.', { tol: 0 }) },
    ],
    pre: [
      { id: 'b1', skill: 'Les configurations jardin d’Éden', q: choice('Dans un automate cellulaire, chaque configuration peut-elle être obtenue à partir d’une configuration précédente ?', ['non, certaines n’ont aucun antécédent', 'oui, chacune en a exactement un', 'oui, chacune en a au moins deux', 'seulement si la règle est simple'], 'Une règle qui envoie plusieurs configurations sur la même en laisse d’autres sans antécédent : les configurations jardin d’Éden.') },
      { id: 'b2', skill: 'L’ordre de calcul', q: choice('On calcule les instants de la vie d’une Copie dans le désordre, sur des machines dispersées. Que perçoit la Copie ?', ['une vie ordinaire, dans l’ordre', 'des instants mélangés', 'des instants qui manquent', 'un monde au ralenti'], 'Chaque instant découle du précédent : l’ordre vécu est dans les états, pas dans l’ordre de calcul.') },
      { id: 'b3', skill: 'Agir sur un monde simulé', q: choice('Peut-on ajouter un atome à l’intérieur d’un univers simulé sans en violer les lois ?', ['seulement par un bord hors des lois', 'oui, si l’atome est assez petit', 'oui, si on agit entre deux cycles', 'oui, si on le fait discrètement'], 'Un atome surgi à l’intérieur ne découle pas de l’état précédent : la règle est violée. Seule une région qui n’obéit pas aux lois peut en fournir.') },
      { id: 'b4', skill: 'La machine finie', q: choice('Un programme dispose d’une mémoire fixe et finie. Peut-il fonctionner éternellement sans jamais revenir à un état déjà connu ?', ['non, il finira par en revenir un', 'oui, s’il est assez compliqué', 'oui, si sa mémoire est grande', 'non, il finira par s’arrêter'], 'Une mémoire de N bits n’a que 2^N états : au-delà de 2^N cycles, l’un d’eux revient forcément.') },
      { id: 'b5', skill: 'Choisir une explication', q: choice('Deux théories rendent compte des mêmes observations ; l’une ajoute des créateurs qui ont tout installé. Selon le rasoir d’Occam…', ['on préfère celle sans créateurs', 'on préfère celle avec créateurs', 'les deux se valent toujours', 'on ne peut rien en conclure'], 'Les créateurs ajoutent des hypothèses sans rien expliquer de plus : la théorie la plus courte est l’autre.') },
    ],
    post: [
      { id: 'p1', pair: 'b1', skill: 'Les configurations jardin d’Éden', q: choice('Un physicien de l’Élysium trouve, au début de l’histoire de son univers, un état que les règles ne peuvent produire à partir d’aucun autre. Il en conclut…', ['qu’il a été installé de l’extérieur', 'que les règles ont changé ce jour-là', 'qu’il vient d’une erreur de mesure', 'que l’univers n’a pas eu de début'], 'Un état sans antécédent ne peut être qu’un état de départ, mis en place par quelqu’un : c’est l’argument de Durham.') },
      { id: 'p2', pair: 'b2', skill: 'L’ordre de calcul', q: choice('Les 40 lignes d’une histoire d’automate sont imprimées sur des cartes, puis battues. Peut-on retrouver leur ordre ?', ['oui, la règle désigne chaque suivante', 'non, l’ordre est perdu pour toujours', 'seulement si les cartes sont datées', 'seulement s’il y a peu de cartes'], 'La règle appliquée à une carte donne la carte suivante : l’ordre se reconstruit à partir des cartes elles-mêmes.') },
      { id: 'p3', pair: 'b3', skill: 'Agir sur un monde simulé', q: choice('Durham veut faire atterrir un vaisseau sur Lambert sans enfreindre les règles du Cosmoplexe. Il…', ['le fait entrer par la couche limite', 'le dépose directement près du sol', 'le construit atome par atome sur place', 'gèle le Cosmoplexe pendant l’envoi'], 'La couche limite n’obéit pas aux lois : ce qu’elle crée entre ensuite en suivant les règles, comme le gaz interstellaire.') },
      { id: 'p4', pair: 'b4', skill: 'La machine finie', q: choice('Peer et Kate vivent dans une machine qui a cessé de grandir. Que leur arrivera-t-il tôt ou tard ?', ['ils finiront par se répéter', 'ils vivront toujours du nouveau', 'ils s’arrêteront aussitôt', 'ils accéléreront sans fin'], 'Une machine finie a un nombre fini d’états : elle finit par repasser par un état connu, puis tourne en boucle.') },
      { id: 'p5', pair: 'b5', skill: 'Choisir une explication', q: choice('Les Lambertiens mesurent les abondances des atomes de plus en plus finement. Quelle théorie y gagne ?', ['celle qui prédit les abondances', 'celle qui les prend comme données', 'celle qui ajoute des créateurs', 'aucune, la précision ne compte pas'], 'Recopier des abondances précises coûte de plus en plus de bits ; une théorie qui les prédit ne coûte rien de plus.') },
    ],
  },
  diagrams: DIAGRAMS,
  stageKeys: ['rule', 'caSeed', 'slices', 'missing', 'accel', 'pop', 'collapse', 'absorb', 'lum', 'inject', 'defend', 'prec', 'aest', 'theory'],
  scenes: {
    ca: 'Un automate cellulaire', dust: 'La poussière remise en ordre', elysium: 'Le cube de l’Élysium',
    cosmo: 'Le bord du Cosmoplexe', gate: 'La couche limite', dance: 'Une danse lambertienne',
  },
  defaults: {
    rule: 30, caSeed: 0, gN: 10, slices: 1, missing: 0, mbits: 8, grows: 0, memLog: 12,
    accel: 2, pop: 1, collapse: 0, absorb: 1, lum: 1, inject: -1, defend: 0, prec: 8, aest: 1, theory: 0,
  },
  model,
  exercises,
  rubric: [
    'Une justification complète décrit le symptôme (ce qu’on observe), la cause (le réglage en défaut) et le mécanisme qui relie les deux.',
    'Elle s’appuie sur une notion du cours : règle locale, antécédent, croissance en puissance, frontière, longueur d’une description.',
  ],
  content(c) {
    // ================================================================ m1
    c.module('m1');
    c.chapter('Trois univers emboîtés', () => {
      c.stage('ca', { rule: 30, caSeed: 0 });
      c.step('Ce que raconte la seconde partie', `Maria se réveille dans l’Élysium, ${fr(BOOK.elysianYears)} ans après le lancement. C’est un univers fait d’ordinateurs, eux-mêmes faits des cellules d’un automate cellulaire, le TVC. Dans une partie de cet univers tourne le Cosmoplexe, une physique jouet où sont apparus les Lambertiens, des êtres pensants.`, {
        claims: [{ text: `${fr(BOOK.elysianYears)} ans`, check: () => BOOK.elysianYears === 7000 }],
      });
      c.test('pre', 'Avant de commencer, un court test : il mesure ce que vous savez déjà, pour le comparer au test final.');
      c.step('La question du cours', 'Comment un univers fait de règles peut-il en contenir un autre ? Et pourquoi la découverte des Lambertiens finit-elle par défaire celui qui les fait tourner ? Ce cours construit des versions miniatures de ces mondes ; chaque chiffre affiché est calculé par elles.');
      c.step('Ce qu’on voit au fond', 'En arrière-plan tourne un automate cellulaire : une ligne de cellules, recalculée à chaque instant, chaque nouvelle ligne étant dessinée sous la précédente. Le motif qui se forme n’est écrit nulle part : il découle d’une règle de quelques lignes.');
    });
    c.chapter('Un automate cellulaire', () => {
      c.stage('ca', { rule: 30, caSeed: 0 });
      c.diagram('rule');
      c.ask('q-rule', 'Dans un automate cellulaire, la règle qui calcule le nouvel état d’une cellule…', ['est la même partout et à chaque instant', 'change selon la place de la cellule', 'est tirée au hasard à chaque instant', 'dépend de la taille de l’automate'], 'Une seule règle, appliquée par toutes les cellules à chaque cycle : c’est ce qui fait d’un automate un univers cohérent.');
      c.step('Des cellules et une règle', 'Un automate cellulaire est une rangée de cellules, ici refermée en anneau. Chaque cellule vaut 0 ou 1. À chaque cycle d’horloge, chacune calcule son nouvel état à partir du sien et de ceux de ses deux voisines, avec la même règle partout.');
      c.step('Une règle tient dans un nombre', `Trois cellules de 0 ou de 1 forment 8 voisinages possibles. Une règle dit ce que devient la cellule pour chacun : 8 réponses, soit un nombre binaire de 8 chiffres. Il y a donc ${fr(2 ** 8)} règles, numérotées de 0 à 255. Le schéma montre la règle 30.`, { tools: ['B1'] });
      c.diagram('spacetime');
      c.step('Tout est fixé au départ', 'La règle ne laisse aucune place au hasard : le même état donne toujours le même suivant. Toute l’histoire est fixée par la règle et l’état de départ. Le schéma la dessine ligne après ligne, le temps descendant.');
      c.experiment({
        title: 'Changez de règle', prompt: 'Choisissez une règle et un état de départ, et regardez l’histoire qui en découle.',
        predict: { question: 'Avec la règle 204, que devient la ligne de départ ?', choices: ['elle reste identique', 'elle s’éteint', 'elle se remplit'], answer: 0 },
        controls: [
          { type: 'choice', key: 'rule', label: 'règle', options: [30, 90, 110, 184, 204, 0].map((r) => ({ label: fr(r), value: r })) },
          { type: 'toggle', key: 'caSeed', label: 'départ au hasard', on: 1, off: 0 },
        ],
        goals: [
          { label: 'Trouvez la règle qui ne change rien', test: ({ v }) => v.rule === 204 },
          { label: 'Trouvez la règle qui éteint tout en un cycle', test: ({ v }) => v.rule === 0 },
          { label: 'Regardez la règle 30 avec un départ au hasard', test: ({ v }) => v.rule === 30 && v.caSeed === 1 },
        ],
        seq: true, conclusion: 'La règle 204 recopie chaque cellule, la règle 0 éteint tout ; la règle 30, à partir d’une seule cellule, produit un motif irrégulier. Des règles tout aussi courtes donnent des histoires très différentes.',
      });
      c.exercise('cell', 'Dans l’atelier, programmez la règle d’une cellule à partir du numéro de la règle.');
      c.question('q-rule-num', 'Combien de règles différentes existe-t-il pour un automate dont chaque cellule, valant 0 ou 1, ne voit que ses deux voisines ?', ['256', '8', '3', '64'], 'Il y a 8 voisinages possibles et 2 réponses possibles pour chacun : 2^8 = 256 règles.');
    });
    c.chapter('La configuration jardin d’Éden', () => {
      c.stage('ca', { rule: 30, caSeed: 1 });
      c.diagram('garden');
      c.ask('q-goe', 'Dans un automate cellulaire, chaque configuration peut-elle être obtenue à partir d’une autre, un cycle plus tôt ?', ['non, certaines n’ont pas de passé', 'oui, toujours d’une seule', 'oui, toujours de plusieurs', 'seulement sur un anneau'], 'Certaines configurations ne sont la suivante d’aucune : on ne peut pas les atteindre en faisant tourner l’automate.');
      c.step('Remonter d’un cycle', 'Une configuration est l’état de toutes les cellules à un instant. Ses antécédents sont les configurations qui y mènent en un cycle. Chaque configuration a exactement une suivante ; mais plusieurs configurations peuvent avoir la même suivante.');
      c.step('Des états sans passé', 'Si deux configurations mènent à la même, il en reste d’autres que rien ne produit : elles n’ont aucun antécédent. Ce sont les configurations jardin d’Éden. On ne peut les obtenir qu’en les installant au départ, de l’extérieur de l’automate.');
      c.step('Les compter', `Sur un anneau de 10 cellules, la règle 30 a ${fr(G30.total)} configurations possibles ; ${fr(G30.gardens)} n’ont aucun antécédent, soit ${pct(G30.share)}. Le schéma range les configurations selon leur nombre d’antécédents ; la barre rouge compte les jardins d’Éden.`, {
        tools: ['P1'],
        claims: [{ text: 'la règle 30 a des jardins d’Éden', check: () => G30.gardens > 0 }],
      });
      c.experiment({
        title: 'Chercher des états sans passé', prompt: 'Choisissez une règle et la taille de l’anneau.',
        predict: { question: 'La règle 204 recopie chaque cellule. Combien de jardins d’Éden a-t-elle ?', choices: ['aucun', 'la moitié des configurations', 'toutes sauf une'], answer: 0 },
        controls: [
          { type: 'choice', key: 'rule', label: 'règle', options: [30, 90, 110, 184, 170, 204, 0].map((r) => ({ label: fr(r), value: r })) },
          { type: 'range', key: 'gN', label: 'cellules de l’anneau', min: 6, max: 12, step: 1, fmt: dec(0) },
        ],
        goals: [
          { label: 'Trouvez une règle sans aucun jardin d’Éden', test: ({ v }) => gardenOf(v.rule, v.gN).gardens === 0 },
          { label: 'Trouvez une règle où plus de la moitié des configurations sont des jardins d’Éden', test: ({ v }) => gardenOf(v.rule, v.gN).share > 0.5 },
        ],
        seq: true, conclusion: `Les règles 170 et 204 sont réversibles : chaque configuration a un seul antécédent, aucune n’est un jardin d’Éden. La règle 184 en a ${pct(G184.share)} sur 12 cellules, la règle 0 presque toutes.`,
      });
      c.step('Les règles réversibles', 'Une règle est réversible quand chaque configuration a exactement un antécédent : on peut alors remonter le temps sans ambiguïté, et aucune configuration n’est un jardin d’Éden. Dès que deux configurations se rejoignent, des jardins d’Éden apparaissent ailleurs.');
      c.step('L’argument de Durham', 'Durham veut une preuve de la théorie de la poussière. S’il se retrouve dans un univers d’automate dont le passé remonte à une configuration jardin d’Éden, cet état n’a pu être produit par les règles : il a été construit ailleurs, dans le monde qu’il se rappelle. Le TVC partira d’un tel état.');
      c.exercise('gardenCalc', 'Dans l’atelier, comptez les jardins d’Éden de la règle 30.');
      c.question('q-goe-why', 'Pourquoi une configuration jardin d’Éden ne peut-elle apparaître qu’au tout début d’une histoire ?', ['aucune configuration ne la produit', 'elle disparaît au premier cycle', 'elle est trop rare pour revenir', 'la règle l’interdit au départ'], 'Elle n’a pas d’antécédent : aucun cycle ne peut y mener, elle ne peut être que l’état initial.');
    });
    c.chapter('Calculer dans le désordre : la poussière', () => {
      c.stage('dust', { slices: 24, missing: 0 });
      c.diagram('dust');
      c.ask('q-dust', 'On calcule les instants de la vie d’une Copie dans le désordre, sur des machines dispersées dans le monde. Que perçoit-elle ?', ['une vie ordinaire, dans l’ordre', 'des instants mélangés', 'des instants manquants', 'un monde ralenti'], 'Chaque instant est l’état qui découle du précédent : l’ordre vécu est dans les états eux-mêmes.');
      c.step('L’expérience de Paul', 'Dans la première partie, Durham découpe une Copie de lui-même en 50 sections et 20 tranches de temps, réparties au hasard sur mille ordinateurs. La Copie compte jusqu’à dix et ne remarque rien : sa pièce reste intacte, son temps continu.');
      c.step('L’ordre est dans les états', 'Sur la scène, les lignes d’une histoire d’automate sont calculées dans un ordre mélangé, à gauche. À droite, on les remet en ordre sans aucune date : la règle appliquée à une ligne désigne la suivante. Une seule ligne n’est la suivante d’aucune autre : c’est la première.');
      c.experiment({
        title: 'Mélanger, puis perdre une tranche', prompt: 'Réglez le nombre de tranches mélangées et le nombre de lignes jamais calculées.',
        predict: { question: 'Si on mélange toutes les lignes, l’histoire reconstruite…', choices: ['est intacte', 'est en morceaux', 'est à l’envers'], answer: 0 },
        controls: [
          { type: 'range', key: 'slices', label: 'tranches mélangées', min: 1, max: 24, step: 1, fmt: dec(0) },
          { type: 'range', key: 'missing', label: 'lignes jamais calculées', min: 0, max: 3, step: 1, fmt: dec(0) },
        ],
        goals: [
          { label: 'Mélangez toutes les lignes : l’histoire reste intacte', test: ({ v }) => v.slices >= 24 && dustOf(v.slices, v.missing).outcome === 'intact' },
          { label: 'Ne calculez pas une ligne : l’histoire se casse', test: ({ v }) => dustOf(v.slices, v.missing).outcome === 'gap' },
          { label: 'Avec deux lignes manquantes, comptez les morceaux', test: ({ v }) => Math.round(v.missing) === 2 },
        ],
        seq: true, conclusion: `Le mélange ne change rien : la règle retrouve l’ordre. Une ligne manquante, en revanche, casse l’histoire en ${fr(D1.chains.length)} morceaux, car la règle ne relie pas les deux bords du trou. Deux lignes manquantes donnent trois morceaux.`,
      });
      c.step('La théorie de la poussière', 'Durham en tire une idée vertigineuse. L’univers serait un nuage d’événements sans ordre, « une gigantesque anagramme cosmique ». Toute configuration de ces événements qui est cohérente se perçoit elle-même, quel que soit l’endroit ou le moment où ses morceaux ont eu lieu.');
      c.step('Invérifiable ?', 'Maria objecte le rasoir d’Occam : la théorie de la poussière explique les mêmes faits qu’une simple Copie, avec plus d’hypothèses. La réponse de Durham est le TVC : un univers d’automate, parti d’une configuration jardin d’Éden, qui continuerait dans la poussière une fois les ordinateurs éteints.');
      c.exercise('reorder', 'Dans l’atelier, programmez la remise en ordre d’une histoire mélangée.');
      c.explain('e-dust', 'Expliquez pourquoi calculer les instants d’une histoire d’automate dans le désordre ne change rien à cette histoire, alors qu’un instant jamais calculé se remarque.', 'Chaque état d’un automate détermine son suivant par la règle. L’ordre de l’histoire est donc contenu dans les états eux-mêmes : quel que soit l’ordre de calcul, on retrouve la suite en cherchant, pour chaque état, celui que la règle produit. Si un état manque, l’état d’avant n’a plus de suivant et celui d’après plus de précédent : la chaîne se coupe en deux, et le saut viole la règle.');
    });

    // ================================================================ m2
    c.module('m2');
    c.chapter('Le TVC : construire et calculer', () => {
      c.stage('elysium', { accel: 2, pop: 1 });
      c.diagram('memory');
      c.step('La machine de von Neumann', 'Dans les années 1950, John von Neumann conçoit un automate cellulaire à deux dimensions où une configuration de cellules forme une machine. Avec le bon programme, elle peut tout calculer : c’est un ordinateur universel. Elle peut aussi tout construire, elle-même comprise : c’est un constructeur universel.');
      c.step('Des ordinateurs qui se recopient', 'Une telle machine peut fabriquer une copie d’elle-même, qui en fabrique une autre, et ainsi de suite. Dans le roman, chaque processeur TVC est à la fois une machine de Turing et une machine de von Neumann. Sa seule construction passée : se recopier, une fois.');
      c.step('Pourquoi six dimensions', `Dans deux dimensions, la machine de von Neumann va chercher ses données de plus en plus loin. Chiang étend l’automate à N dimensions. À six, un réseau de processeurs occupe trois dimensions, et chaque processeur range sa mémoire dans les trois autres. Pour atteindre ${sci(1e12)} cellules, il suffit d’aller à ${sci(R3)} cases, au lieu de ${sci(R1)} sur un ruban.`, {
        claims: [{ text: 'un volume réduit la distance à la racine cubique', check: () => near(R3, 1e4, 0.001) || fr(R3) }],
      });
      c.question('q-dims', 'Pourquoi Chiang donne-t-il au TVC plus de trois dimensions ?', ['pour que chaque processeur ait sa mémoire en volume', 'pour que les Copies voient en six dimensions', 'pour que les cellules aient plus de voisines', 'pour que l’automate tourne plus vite'], 'Trois dimensions servent au réseau de processeurs, les trois autres à la mémoire de chacun : les données restent proches.');
    });
    c.chapter('Le lancement', () => {
      c.stage('elysium', { accel: 2, pop: 1 });
      c.diagram('stack');
      c.step('Un milliard de processeurs', `La configuration jardin d’Éden du TVC contient ${sci(supplyAt(0))} processeurs déjà construits, ${fr(BOOK.edge)} par arête du cube, de ${sci(BOOK.cellsPerProc)} cellules chacun. Ils contiennent les Copies des commanditaires, des bibliothèques, et le germe de la planète Lambert. Le programme qui démarre l’ensemble s’appelle FIAT.`, {
        claims: [{ text: `${sci(supplyAt(0))} processeurs`, check: () => supplyAt(0) === 1e9 }],
      });
      c.step('Des simulations emboîtées', `Des ordinateurs réels simulent l’automate TVC ; ses cellules forment des ordinateurs ; ceux-ci simulent des ordinateurs classiques, qui font tourner la Copie de Durham. Les ralentissements se multiplient : ${fr(BOOK.slowCopy)} pour une Copie, environ ${fr(OVER, 1)} de plus pour le TVC simulé. En une heure, on voit ${fr(SPH, 1)} secondes de sa vie.`, {
        claims: [{ text: `${fr(SPH, 1)} secondes par heure`, check: () => near(SPH, 14.4, 0.01) || fr(SPH, 1) }],
      });
      c.step('Un univers hermétique', 'Une fois l’automate lancé, Maria et Durham ne doivent plus intervenir : toute manipulation extérieure violerait les règles du nouvel univers. Ils peuvent seulement regarder, ou tout arrêter. Seule la Copie, faite de cellules, agit en accord avec ces lois.');
      c.step('Aveugle dans la matrice', 'Dans un automate, aucune lumière ne porte l’information d’une cellule lointaine. Pour connaître une cellule, il faut aller la toucher. La Copie de Durham observe donc l’automate par une « Chambre », un dispositif de fils constructeurs et de capteurs, comme un physicien lit les détecteurs d’un accélérateur.');
      c.step('On débranche', 'À 22 h 03, l’argent est épuisé : la simulation est arrêtée, la mémoire effacée. Pour Maria, l’affaire s’arrête là. Pour Durham, l’univers TVC continue dans la poussière. La seconde partie s’ouvre sur cette continuation : Maria y est réveillée.');
      c.exercise('tvcCalc', 'Dans l’atelier, calculez la taille du jardin d’Éden TVC et le prix des simulations emboîtées.');
      c.question('q-slow', 'Une Copie tourne 17 fois plus lentement que le temps réel. On la fait tourner sur un automate simulé qui ajoute un ralentissement de 15. Son ralentissement total est d’environ…', ['255', '32', '17', '15'], 'Les ralentissements des niveaux emboîtés se multiplient : 17 × 15 = 255.');
    });
    c.chapter('Croître comme un cristal', () => {
      c.stage('elysium', { accel: 2, pop: 1 });
      c.diagram('crystal');
      c.ask('q-crystal', 'Un univers qui s’étend sans fin finit-il forcément par se refroidir et s’épuiser ?', ['non, s’il croît en ajoutant de l’ordre', 'oui, toute expansion dilue l’énergie', 'oui, l’entropie finit par gagner', 'non, s’il s’étire assez lentement'], 'Durham insiste : le TVC croît comme un cristal, pas comme un ballon. Chaque nouveau processeur ajoute de la mémoire et du calcul, donc de l’ordre.');
      c.step('Un cristal, pas un ballon', 'Étirer l’espace ordinaire étale la matière et augmente le désordre. Le TVC ne s’étire pas : ses processeurs se recopient sur les bords, et chaque nouvelle couche ajoute de la place pour des données et du calcul. Rien dans les règles n’empêche ces machines de durer toujours.');
      c.step('Une croissance en t³', `Si chaque face du cube gagne une couche de processeurs à chaque génération, l’arête grandit de 2 et le nombre de processeurs vaut (${fr(BOOK.edge)} + 2t)³. Il croît comme le cube du temps.`, { tools: ['P1'] });
      c.step('Le Temps standard accélère', 'La plupart des Élysiens vivent au Temps standard, qui accélère par rapport à l’horloge de l’automate. Chacun a donc besoin de toujours plus de processeurs. « Mais l’Élysium lui-même croissait encore plus vite. » Le modèle donne au Temps standard une accélération en puissance du temps.');
      c.experiment({
        title: 'Le cristal contre l’horloge', prompt: 'Réglez l’exposant de l’accélération du Temps standard et la population.',
        predict: { question: 'Si le Temps standard accélère comme t⁴, les processeurs…', choices: ['finissent par manquer', 'restent en surplus', 'manquent dès le départ'], answer: 0 },
        controls: [
          { type: 'range', key: 'accel', label: 'exposant du Temps standard', min: 0, max: 5, step: 0.5, fmt: dec(1) },
          { type: 'range', key: 'pop', label: 'population (× nominale)', min: 0.5, max: 6, step: 0.5, fmt: dec(1) },
        ],
        goals: [
          { label: 'Trouvez un exposant qui laisse un surplus pour toujours', test: ({ v }) => growOf(v.accel, v.pop).outcome === 'surplus' },
          { label: 'Trouvez un exposant qui fait manquer les processeurs tôt ou tard', test: ({ v }) => growOf(v.accel, v.pop).outcome === 'late-deficit' },
          { label: 'Avec un exposant sous 3, trouvez une population qui manque au départ', test: ({ v }) => growOf(v.accel, v.pop).outcome === 'early-deficit' },
        ],
        seq: true, conclusion: `Tant que l’exposant ne dépasse pas 3, le cristal garde l’avantage, même si la population est d’abord trop grande. Au-delà, le manque arrive toujours : avec 4, après ${fr(LATE4.firstDeficit)} générations.`,
      });
      c.diagram('cube');
      c.step('Vingt-quatre pyramides', `Le cube est partagé en ${fr(BOOK.pyramids)} pyramides obliques qui croissent avec lui : une pour chacun des ${fr(BOOK.founders)} fondateurs, six pour les projets communs. ${fr(BOOK.cosmoPyramids)} de ces six font tourner le Cosmoplexe ; la dernière porte Permutation City. Au centre, le noyau relaie tous les échanges.`);
    });
    c.chapter('Une ville que tout le monde partage', () => {
      c.stage('elysium', { accel: 2, pop: 1 });
      c.diagram('stack');
      c.step('Le seul lieu', 'Permutation City est le seul environnement de l’Élysium « qui ressemble à un lieu ». Chacun peut y marcher, personne ne peut la changer sur un caprice. Le corps de Maria est calculé dans son propre territoire ; la Cité et son corps échangent des données pour produire ses sensations.');
      c.step('Une carte sans ressemblance', 'Vu comme logiciel, l’appartement de Maria n’est pas une pièce : c’est un assemblage de modules dispersés, rendu optique des surfaces, courants d’air, texture des tapis. Les foules de pantins se réduisent à quelques blocs, « comportement grégaire ». Rien ne correspond point par point à ce qu’on perçoit.');
      c.step('Une réalité virtuelle composite', 'Les Élysiens sont encore des Copies en RV composite : des corps approximatifs, des villes en « papier peint indestructible ». Leurs lois physiques « se contredisent un milliard de fois par jour ». Tout est calculé par le TVC, mais les niveaux ne se voient pas entre eux. Ce point comptera à la fin.');
      c.question('q-rv', 'Qu’est-ce qui distingue une RV composite d’un automate cellulaire comme le Cosmoplexe ?', ['des milliers de règles qui se contredisent', 'une seule règle pour toutes les cellules', 'l’absence totale de lois physiques', 'une image plus précise du monde'], 'Une RV composite empile des règles particulières, une par phénomène ; un automate cellulaire applique la même règle partout.');
    });
    c.chapter('Vivre éternellement dans une machine', () => {
      c.stage('elysium', { accel: 2, pop: 1 });
      c.diagram('machine');
      c.step('Peer et ses pieds de table', 'Peer et Kate sont des clandestins, cachés dans les redondances du logiciel de la Cité par Malcolm Carter. Peer laisse son exomental lui imposer une nouvelle passion tous les trente à cinquante ans : mathématiques, opéras, et maintenant pieds de table, cent soixante-deux mille au dernier décompte.');
      c.step('Croître pour durer', 'Peer le dit : « Seule la promesse d’une croissance éternelle donnait un sens à la vie éternelle. » Tant que la Cité s’agrandit, la petite part de calcul qui les fait vivre s’agrandit aussi. Dans une machine finie, il aurait épuisé en un temps fini la liste de tout ce qu’il pourrait être.');
      c.step('Une mémoire finie boucle', 'Une machine de N bits ne peut prendre que 2^N états. Si elle tourne plus de 2^N cycles, un état revient forcément ; et comme la suite est fixée par l’état, tout recommence à l’identique. Le schéma montre une telle boucle pour un petit automate.', { tools: ['P1'] });
      c.experiment({
        title: 'Une machine qui se répète', prompt: 'Réglez la taille de la machine, et laissez-la grandir ou non.',
        predict: { question: 'Une machine de 16 bits peut prendre 65 536 états. Revient-elle un jour à un état connu ?', choices: ['oui, forcément', 'non, jamais', 'seulement par hasard'], answer: 0 },
        controls: [
          { type: 'range', key: 'mbits', label: 'bits de la machine', min: 4, max: 16, step: 1, fmt: dec(0) },
          { type: 'toggle', key: 'grows', label: 'la machine grandit', on: 1, off: 0 },
        ],
        goals: [
          { label: 'Avec 8 bits, sans croissance, trouvez la boucle', test: ({ v }) => v.mbits === 8 && v.grows === 0 },
          { label: 'Trouvez une taille où la boucle arrive après plus de 1 000 cycles', test: ({ v }) => v.grows === 0 && machineOf(v.mbits, false).repeatAt > 1000 },
          { label: 'Laissez la machine grandir', test: ({ v }) => v.grows === 1 && machineOf(v.mbits, true).outcome === 'open' },
        ],
        seq: true, conclusion: `Sans croissance, la boucle arrive toujours, avant 2^N cycles : au cycle ${fr(M8.repeatAt)} pour 8 bits, au cycle ${fr(M16.repeatAt)} pour 16 bits. Une machine qui gagne une cellule tous les trois cycles n’a, au bout de ${fr(4000)} cycles, jamais repassé par un même état.`,
      });
      c.step('Redevenus mortels', `Au chapitre 31, les Élysiens ont quitté la Cité. Elle ne grandit plus, et l’infrastructure de Carter non plus : la machine qui calcule Peer et Kate est devenue finie. Ils se ralentissent d’un facteur 10^${fr(BOOK.peerSlow)} ; plus de cent mille milliards d’années passent. « Ils étaient redevenus mortels. »`);
      c.step('La Nation solipsiste', 'Peer décide de partir lancer leur propre univers, et de « devenir » la Nation solipsiste : une foule de personnes heureuses, chacune à sa manière, au lieu d’une suite de passions qui se succèdent. Kate y voit une mort. Peer répond que rien d’autre ne le définit plus.');
      c.explain('e-finite', 'Expliquez pourquoi Peer se dit « redevenu mortel » quand la Cité cesse de grandir, alors que rien ne menace de l’arrêter.', 'Peer est calculé par une partie du logiciel de la Cité. Tant que la Cité grandit, sa part de mémoire grandit aussi, et le nombre d’états qu’il peut prendre n’a pas de limite. Quand elle cesse de grandir, il devient une machine finie : avec N bits, il n’a que 2^N états possibles. Au bout d’assez longtemps, il repassera forcément par un état déjà vécu et tout se répétera ; il ne peut plus rien vivre de nouveau à l’infini.');
    });

    // ================================================================ m3
    c.module('m3');
    c.chapter('Une physique jouet', () => {
      c.stage('cosmo', { absorb: 1, lum: 1 });
      c.diagram('atoms');
      c.ask('q-sim', 'Le Cosmoplexe est-il une simulation de la physique réelle ?', ['non, il a ses propres lois, plus simples', 'oui, à l’échelle des atomes', 'oui, mais sans la gravitation', 'non, il n’a pas de lois fixes'], 'Max Lambert l’a conçu comme un univers jouet aux lois simplifiées : il ne simule pas plus notre monde que les échecs ne simulent une bataille.');
      c.step('Les lois de Max Lambert', 'Le Cosmoplexe est un automate cellulaire dont les lois imitent une physique simplifiée. Ses atomes ressemblent aux nôtres sans l’être. Le roman le compare aux échecs : pas plus une simulation du monde réel que le jeu n’est une simulation des combats médiévaux. Sa chimie reste riche.');
      c.step('Trente-deux atomes, en couleurs fausses', `Le Cosmoplexe compte ${fr(BOOK.atoms)} atomes. On les affiche en couleurs fausses, rouge, vert, bleu : « l’expression était tautologique », note Maria. Toute vue du Cosmoplexe est une carte codée ; une vue « à l’œil nu » n’y a aucun sens.`, {
        claims: [{ text: '32 atomes', check: () => BOOK.atoms === 32 }],
      });
      c.step('Ce qui lui manque', 'Pas de noyaux ni de forces nucléaires, donc pas de fusion : l’étoile n’est chauffée que par la gravitation. L’espace est plat et ne s’étend pas, il n’y a pas de Big Bang, et le soleil de Lambert est la seule étoile. Rien, dans ces lois, n’explique l’origine des atomes.');
      c.step('Rien ne surgit de rien', 'Dans un automate, une loi de conservation peut être exacte. Avec la règle 184, un atome avance d’une case si la suivante est libre : le nombre d’atomes ne change jamais. Le schéma le montre ligne après ligne. Un atome qui apparaîtrait de nulle part violerait la règle.', {
        claims: [{ text: 'la règle 184 conserve les atomes', check: () => model.checks.find((k) => k.name.startsWith('règle 184'))!.run() ?? true }],
      });
      c.question('q-origin', 'Pourquoi les Lambertiens ne peuvent-ils trouver, dans les lois du Cosmoplexe, l’origine de leurs atomes ?', ['ces lois ne prévoient aucune création d’atomes', 'leurs instruments sont trop imprécis', 'les atomes sont trop petits pour eux', 'leurs savants refusent d’y penser'], 'Ni fusion ni Big Bang : les lois du Cosmoplexe conservent les atomes sans dire d’où ils viennent.');
    });
    c.chapter('Trois milliards d’années', () => {
      c.stage('cosmo', { absorb: 1, lum: 1 });
      c.diagram('timescale');
      c.step('Un seul ancêtre', `Maria a mis au point le germe de la biosphère, C. hydrophilum, à partir de la bactérie de Max Lambert. Pendant les ${fr(BOOK.elysianYears)} ans élysiens, ${sci(BOOK.lambertYears)} années ont passé sur Lambert : environ ${fr(Math.round(RATIO / 1000) * 1000)} ans lambertiens par an élysien.`, {
        claims: [{ text: 'plus de 400 000 ans lambertiens par an élysien', check: () => RATIO > 4e5 || fr(RATIO) }],
      });
      c.step('Personne ne les a dessinés', `${fr(BOOK.species / 1e6)} millions d’espèces vivent sur Lambert, toutes descendues de ce germe. Les archives ont enregistré chaque mutation. Maria finit par l’admettre : personne n’aurait pu concevoir tout cela, « il y a forcément eu évolution ».`);
      c.diagram('synapse');
      c.step('Les Lambertiens', `Quatre pattes, cinq segments, un estomac qui pend, exposé à l’air, sous les ailes. Leurs neurones portent des signaux par des polymères, et chaque synapse utilise près de ${fr(BOOK.transmitters)} neurotransmetteurs : trois sous-unités de ${fr(BOOK.variants)} formes chacune, soit ${fr(transmitterKinds())} combinaisons.`, {
        claims: [{ text: `${fr(transmitterKinds())} ≈ 3 000`, check: () => near(transmitterKinds(), 3000, 0.1) }],
      });
      c.step('Un univers déterministe', 'Peer le rappelle : le Cosmoplexe est « entièrement déterministe ». Qui recopierait le germe et le ferait tourner verrait chaque Lambertien battre des ailes exactement de la même façon. Maria en conclut que ses propres choix ne commandaient que ce qu’elle voyait : les Lambertiens auraient trouvé leur chemin sans elle.');
      c.exercise('timeCalc', 'Dans l’atelier, comparez les deux horloges et comptez les neurotransmetteurs.');
      c.question('q-copy', 'Kate recopie le germe originel de la biosphère et le fait tourner chez elle. Que verra-t-elle ?', ['exactement la même histoire', 'une histoire semblable mais différente', 'une planète sans vie', 'des Lambertiens plus avancés'], 'Le Cosmoplexe est déterministe : le même germe et les mêmes règles donnent la même histoire, battement d’aile après battement d’aile.');
    });
    c.chapter('Le bord du monde', () => {
      c.stage('cosmo', { absorb: 1, lum: 1 });
      c.diagram('heat');
      c.ask('q-torus', 'Pourquoi Maria n’a-t-elle pas refermé le Cosmoplexe sur lui-même, sans bord ?', ['la lumière serait revenue chauffer la planète', 'les atomes auraient fini par s’échapper', 'le calcul aurait été bien trop lent', 'les Lambertiens auraient vu le bord'], 'Dans un espace fini sans bord, la lumière de l’étoile ne part jamais : elle revient sans cesse et s’accumule.');
      c.step('Un disque modélisé', 'Le Cosmoplexe ne modélise qu’un disque mince autour du soleil de Lambert, un peu plus large que l’orbite de la planète la plus lointaine. Même vide, chaque kilomètre cube est calculé jusqu’au niveau des cellules : rien n’est approximé.');
      c.step('Le tore', 'On aurait pu refermer ce volume en tore : ce qui sort d’un côté revient par l’autre, sans aucun bord. Mais, dit Maria, « le rayonnement solaire aurait fait le tour de l’univers et reflué dans le système en quelques heures ». La planète aurait été trop chaude, et trop longtemps.');
      c.step('Une frontière ouverte', `Maria a donc laissé une frontière : la lumière la traverse et quitte le modèle. Le modèle du cours suit la lumière stockée dans le volume. Frontière ouverte, la planète se stabilise à ${fr(H_NOM.tEnd)} K ; refermée en tore, elle atteint ${fr(H_TORUS.tEnd)} K au bout de ${fr(TOY.heatHours)} heures, et chauffe encore.`, {
        claims: [{ text: 'tore : la planète bout', check: () => H_TORUS.outcome === 'boiling' && H_NOM.outcome === 'habitable' }],
      });
      c.experiment({
        title: 'Ouvrir ou fermer le monde', prompt: 'Réglez la part de lumière qui sort à la frontière et la luminosité de l’étoile.',
        predict: { question: 'Si aucune lumière ne sort (un tore), la température de la planète…', choices: ['monte sans s’arrêter', 'se stabilise plus haut', 'ne change pas'], answer: 0 },
        controls: [
          { type: 'range', key: 'absorb', label: 'part de lumière qui sort', min: 0, max: 1, step: 0.05, fmt: pct },
          { type: 'range', key: 'lum', label: 'luminosité de l’étoile (× nominale)', min: 0.5, max: 4, step: 0.1, fmt: dec(1) },
        ],
        goals: [
          { label: 'Refermez le monde en tore', test: ({ v }) => v.absorb <= 0.001 },
          { label: 'Avec l’étoile nominale, trouvez la plus petite ouverture où l’aqua reste liquide', test: ({ v }) => Math.abs(v.lum - 1) < 0.01 && heatOf(v.absorb, v.lum).outcome === 'habitable' && v.absorb <= 0.45 },
          { label: 'Frontière ouverte, gelez l’aqua en réglant l’étoile', test: ({ v }) => v.absorb >= 0.999 && heatOf(v.absorb, v.lum).outcome === 'frozen' },
        ],
        seq: true, conclusion: 'Sans sortie, la lumière s’accumule et la température monte sans fin. Avec l’étoile nominale, il faut laisser sortir au moins 40 % de la lumière qui atteint le bord ; frontière ouverte, une étoile deux fois moins lumineuse gèle l’aqua.',
      });
      c.step('Ce qui entre', 'Par cette frontière, n’entrent qu’un rayonnement thermique froid et quelques atomes, comme un gaz interstellaire tiré au hasard. Ils sont créés dans une mince couche de cellules qui n’obéit pas aux lois du Cosmoplexe : sans cela, aucun atome ne pourrait y apparaître.');
    });
    c.chapter('Agir sans tricher', () => {
      c.stage('gate', { inject: -1, defend: 0 });
      c.diagram('gate');
      c.ask('q-inject', 'Peut-on ajouter un atome à l’intérieur du Cosmoplexe sans en violer les lois ?', ['seulement par la couche du bord', 'oui, entre deux cycles d’horloge', 'oui, si l’atome est assez petit', 'oui, si personne ne regarde'], 'Un atome qui surgit à l’intérieur ne découle pas de l’état précédent : la règle est violée. La couche limite, elle, n’obéit à aucune loi.');
      c.step('Regarder sans toucher', 'Le logiciel de surveillance observe Lambert « au travers d’un quadrillion de fissures de l’espace ». Il lit les cellules sans en faire partie ni obéir à leurs lois. Lire ne change rien : les Élysiens ont pu tout voir pendant trois milliards d’années sans jamais rien modifier.');
      c.step('Les gants de Maria', 'Toucher, c’est autre chose. Quand Maria saisit une molécule avec ses gants, la physique du Cosmoplexe est suspendue. Construire de petites mains dans le Cosmoplexe ne ferait que « changer simplement le niveau où les règles étaient enfreintes ». Manipuler le contenu, c’est en violer les lois.');
      c.experiment({
        title: 'Faire entrer un atome', prompt: 'Choisissez où injecter un atome dans une bande du Cosmoplexe, et si les règles sont défendues, comme après l’arrivée des Lambertiens.',
        predict: { question: 'Un atome écrit directement au milieu de la bande…', choices: ['viole la règle', 'entre normalement', 'repousse ses voisins'], answer: 0 },
        controls: [
          { type: 'range', key: 'inject', label: 'case d’injection (−1 : aucune, 0 : couche limite)', min: -1, max: TOY.gateLen - 1, step: 1, fmt: dec(0) },
          { type: 'toggle', key: 'defend', label: 'règles défendues', on: 1, off: 0 },
        ],
        goals: [
          { label: 'Écrivez un atome à l’intérieur : la règle est violée', test: ({ v }) => gateOf(v.inject, v.defend > 0.5).outcome === 'violation' },
          { label: 'Défendez les règles et recommencez : l’écriture est ignorée', test: ({ v }) => gateOf(v.inject, v.defend > 0.5).outcome === 'ignored' },
          { label: 'Les règles défendues, faites quand même entrer un atome', test: ({ v }) => v.defend > 0.5 && gateOf(v.inject, true).outcome === 'entered' },
        ],
        seq: true, conclusion: 'Écrit à l’intérieur, l’atome surgit de rien : la case est hors la loi. Quand le Cosmoplexe défend ses règles, l’écriture reste sans effet. Injecté dans la couche limite, l’atome attend que la case voisine soit libre, puis entre en suivant la règle : aucune case n’est hors la loi.',
      });
      c.step('Le plan B de Durham', 'C’est exactement ce que fait Durham au chapitre 30. L’atome rouge écrit dans l’air de la prairie ne se matérialise pas. Mais le logiciel du gaz interstellaire accepte d’injecter mille atomes, tous avec la même vitesse : « le flux aléatoire n’était plus aléatoire ».');
      c.step('Un vaisseau et un maser', 'Durham injecte ensuite par le bord un vaisseau entier, l’Ambassador, tiré d’un vieux projet de la bibliothèque, et le guide par un rayon maser émis lui aussi depuis la frontière. À bord, des robots de téléprésence et Porte-Parole, un essaim de faux Lambertiens.');
      c.exercise('laws', 'Dans l’atelier, classez ce qui obéit aux lois du Cosmoplexe.');
      c.explain('e-gate', 'Expliquez pourquoi Durham, qui ne parvient pas à faire apparaître un atome rouge dans l’air de Lambert, peut y faire entrer un vaisseau entier.', 'Écrire un atome à l’intérieur du Cosmoplexe revient à changer une cellule sans que la règle l’ait produit : c’est violer ses lois, et le Cosmoplexe ne l’accepte plus. La couche limite, au bord du modèle, n’obéit pas à ces lois : le logiciel du gaz interstellaire y crée des atomes. Durham lui fait créer un vaisseau ; celui-ci passe ensuite dans le Cosmoplexe en suivant ses règles, comme n’importe quel atome du gaz.');
    });

    // ================================================================ m4
    c.module('m4');
    c.chapter('Penser en dansant', () => {
      c.stage('dance', { prec: 8, aest: 1, theory: 0 });
      c.step('Une pensée d’équipe', 'Un Lambertien seul ne peut pas méditer une théorie. Une équipe la danse : le mouvement de l’essaim exprime un modèle et en démontre les fondements. Le langage de la danse réunit écriture, logique formelle, notation mathématique et calcul, mais ses capacités sont innées.');
      c.step('Une danse qui se disloque', 'Les Lambertiens ont une esthétique précise, liée à un système nerveux qui évalue la simplicité. Si une équipe danse une théorie qui « n’entre pas en résonance » avec lui, la danse se disloque. Une danse réussie est reprise par d’autres équipes ; les messages faux meurent en route.');
      c.step('Ptolémée, puis Newton', 'Une équipe danse une Lambert immobile autour de laquelle tout tourne : l’essaim se désagrège. Quelques années plus tard, la version où les planètes tournent autour du soleil tient. Ce modèle contenait déjà la gravitation : « Ça, c’était Newton. » Il n’y avait rien eu avant, ni mythe, ni créateur.');
      c.question('q-dance', 'Que se passe-t-il quand une équipe de Lambertiens danse une théorie compliquée et peu convaincante ?', ['la danse se disloque', 'la danse devient plus longue', 'les autres équipes la recopient', 'la théorie est mise de côté pour plus tard'], 'Leur système nerveux évalue la simplicité : une théorie qui ne lui convient pas fait se désagréger l’essaim.');
    });
    c.chapter('La plus courte l’emporte', () => {
      c.stage('dance', { prec: 8, aest: 1, theory: 0 });
      c.diagram('theories');
      c.ask('q-mdl', 'Une théorie explique les observations ; une autre dit la même chose et ajoute qu’un créateur a tout installé. Laquelle est la plus courte ?', ['la première', 'la seconde', 'elles sont aussi longues', 'cela dépend du créateur'], 'La seconde contient la première, plus le créateur : elle est forcément plus longue, sans rien prédire de plus.');
      c.step('Mesurer une explication', 'On peut mesurer une théorie en bits : la longueur de ses règles, plus celle des nombres qu’elles n’expliquent pas. Entre deux théories qui reproduisent les mêmes observations, la plus courte est la plus simple. C’est une version précise du rasoir d’Occam.', { tools: ['L1'] });
      c.step('Trois explications du nuage', `La théorie classique : les règles du Cosmoplexe, puis les abondances des ${fr(BOOK.atoms)} atomes recopiées telles quelles. Les équations de champ : plus longues, mais elles prédisent les abondances. Les créateurs : la théorie classique, plus les règles TVC et ceux qui les ont lancées. Le modèle fixe ces longueurs.`);
      c.experiment({
        title: 'Mesurer plus finement', prompt: 'Réglez la précision des mesures des abondances, et la théorie que danse l’équipe sur la scène.',
        predict: { question: 'Plus les abondances sont mesurées finement, plus la théorie qui les prédit…', choices: ['devient avantageuse', 'devient longue', 'perd son intérêt'], answer: 0 },
        controls: [
          { type: 'range', key: 'prec', label: 'précision (bits par abondance)', min: 2, max: 20, step: 1, fmt: dec(0) },
          { type: 'choice', key: 'theory', label: 'théorie dansée', options: [{ label: 'classique', value: 0 }, { label: 'équations de champ', value: 1 }, { label: 'créateurs', value: 2 }] },
          { type: 'toggle', key: 'aest', label: 'esthétique lambertienne', on: 1, off: 0 },
        ],
        goals: [
          { label: 'Trouvez une précision où la théorie classique est la plus courte', test: ({ v }) => contestOf(v.prec, v.aest > 0.5).winner === 'classic' },
          { label: 'Trouvez une précision où les équations de champ l’emportent', test: ({ v }) => contestOf(v.prec, v.aest > 0.5).winner === 'field' },
          { label: 'Faites danser les créateurs', test: ({ v }) => v.theory === 2 },
        ],
        seq: true, conclusion: `Jusqu’à 10 bits par abondance, recopier les abondances coûte moins cher que des équations plus longues. Au-delà de ${fr(CROSS, 1)} bits, les équations de champ l’emportent. Les créateurs ne gagnent jamais : ils ajoutent ${fr(TOY.tvcBits)} bits sans rien prédire. Avec l’esthétique lambertienne, leur théorie est de toute façon rejetée.`,
      });
      c.step('« La plus simple pour nous »', `Repetto assure que les règles du Cosmoplexe sont « la plus simple explication des trente-deux atomes ». Maria répond : « La plus simple pour nous. » Avec ${fr(8)} bits par abondance, la théorie classique fait ${fr(C8.costs.classic)} bits ; rien dans leur monde n’oblige les Lambertiens à penser en automates cellulaires.`, {
        claims: [{ text: 'à 8 bits, la théorie classique gagne', check: () => C8.winner === 'classic' }],
      });
      c.exercise('mdlCalc', 'Dans l’atelier, calculez la longueur de deux explications.');
    });
    c.chapter('Le contact', () => {
      c.stage('dance', { prec: 8, aest: 1, theory: 2 });
      c.diagram('loop');
      c.step('Attendre d’être imaginés', `À l’assemblée, Repetto propose d’informer les Lambertiens ; Elaine Sanderson, d’attendre qu’ils postulent eux-mêmes l’existence des Élysiens. ${fr(BOOK.speakers)} orateurs se succèdent. Sanderson l’emporte avec dix points d’avance : le contact n’est permis qu’une fois l’idée née chez eux.`);
      c.step('Une horloge qu’on ne peut plus ralentir', 'Durham peut régler la vitesse du Cosmoplexe. Il peut l’accélérer, mais pas le ralentir au-delà d’un certain point : le logiciel ignore l’ordre. Zemansky en tire un principe de relativité : ralentir le Cosmoplexe, c’est accélérer l’Élysium, comme si le Cosmoplexe ne pouvait plus calculer l’Élysium plus vite.');
      c.step('La hiérarchie se défait', 'Le schéma montre la hiérarchie supposée : les règles TVC font tourner l’Élysium, qui fait tourner le Cosmoplexe. Mais, dit Durham, sur Lambert « tout ce qu’il se passe est intimement lié à un ensemble unique de lois physiques ». L’Élysium, fait de RV composite, est le moins cohérent des deux.');
      c.step('Le reste du message', 'Sur Lambert, Porte-Parole danse la cosmologie des Élysiens : un automate cellulaire créé avec le nuage originel. Les Lambertiens demandent « le reste du message » : l’univers où cet automate a été créé. Durham fait danser les règles TVC. Les Lambertiens répondent par une sphère parcourue d’ondes : une fin de non-recevoir.');
      c.step('Un monde éternel est absurde', 'Leur raison : le système décrit par les règles TVC « se maintiendrait éternellement ». Les Lambertiens connaissent l’infini comme outil de calcul, mais aucun de leurs modèles n’aboutit à un résultat infini. Une théorie qui en produit un est, pour eux, une absurdité.');
      c.question('q-reject', 'Pourquoi les Lambertiens rejettent-ils les règles TVC qu’on leur danse ?', ['elles décrivent un monde éternel', 'elles sont trop simples à leur goût', 'elles contredisent leurs mesures', 'elles viennent de robots étrangers'], 'Le système décrit par les règles TVC durerait toujours ; aucun modèle lambertien acceptable ne mène à un résultat infini.');
    });
    c.chapter('Quand l’explication change de camp', () => {
      c.stage('elysium', { accel: 2, pop: 1, collapse: 0.6 });
      c.diagram('cube');
      c.step('La Cité implose', 'Pendant le contact, Maria voit les tours de Permutation City fondre et converger vers un point. La Cité devient un système fermé et autonome, qui s’éloigne. Personne n’y était vraiment : les corps des Élysiens sont calculés ailleurs. Mais les processeurs muets s’étendent depuis les pyramides publiques.');
      c.step('Les équations de champ', `Les dernières analyses arrivent : une équipe a trouvé des équations de champ sans rapport avec l’automate du Cosmoplexe, avec ${fr(BOOK.atoms)} solutions stables, une par atome. À haute température, elles prédisent une génération de matière dans les proportions exactes du nuage originel. La danse a été jugée réussie.`);
      c.step('Évacuer vers un nouveau jardin d’Éden', 'Les Élysiens disposent de six heures pour partir. Durham assemble une nouvelle configuration jardin d’Éden : une matrice simulée par les processeurs de l’ancienne, qui se met à croître puis vit selon ses propres lois. Irene Shaw et ses sept cents millions de descendants passent en dernier, sauf Riemann.');
      c.step('Un monde qui tient debout', 'Dans la pyramide de Riemann, Maria et Durham trouvent un jeune homme endormi dans un jardin. La porte se referme, la maison s’éloigne « comme une maquette dans un presse-papiers ». Cet univers tient debout, « comme si sa propre logique était passée par-dessus celle de l’Élysium ».');
      c.step('Pas de dieux', 'Maria conclut : l’idée de créateur se détruit elle-même. En l’absence d’êtres conscients, « un univers soit se trouve tout seul dans la poussière, soit ne se trouve pas ». Soit il trouve sa propre cohérence, soit non. Les Élysiens n’ont jamais été que des témoins.');
      c.step('Plus haut, toujours plus haut', 'Durham veut mourir, épuisé par vingt-cinq vies. Maria lui rappelle qu’il peut choisir ce qu’il ressent. Il se reconfigure, et la suit. Mais que reste-t-il de lui ? Comme pour Peer, la frontière entre se transformer et mourir n’est pas tracée. Dans l’épilogue, la Maria restée sur Terre pose des fleurs.');
      c.exercise('collapse', 'Dans l’atelier, remettez dans l’ordre les événements de la fin.');
      c.explain('e-collapse', 'Expliquez, avec les idées du cours, pourquoi les Élysiens ne peuvent ni éteindre les Lambertiens ni leur imposer leur explication.', 'Selon la théorie de la poussière, un univers existe dès qu’il est cohérent : le Cosmoplexe, fait d’une seule règle appliquée partout depuis trois milliards d’années, l’est bien plus que l’Élysium et ses RV composites. Les Lambertiens ont trouvé une explication plus courte de leur monde, les équations de champ, qui ne passe pas par l’automate TVC ; ils rejettent même les règles TVC, qui décrivent un monde éternel. Éteindre leurs processeurs ne les supprimerait pas : leur histoire se retrouverait dans la poussière, et c’est l’Élysium, moins cohérent, qui se défait.');
    });
    c.clinicCase({
      id: 'clin-torus', title: 'une planète qui n’en finit pas de chauffer', scene: 'cosmo', fault: { absorb: 0.1 },
      observe: `Un Élysien recrée le système de Lambert pour un essai. L’étoile est réglée comme d’habitude. Pourtant, au bout de ${fr(TOY.heatHours)} heures, la planète atteint ${fr(H_CLIN.tEnd)} K : l’aqua bout. Surtout, la température monte encore, heure après heure, sans trouver d’équilibre.`,
      choices: ['la frontière, qui ne laisse presque rien sortir', 'l’étoile, réglée beaucoup trop lumineuse', 'l’aqua, mal définie dans la chimie'],
      explain: `Une étoile trop lumineuse donnerait une planète trop chaude, mais stable en quelques heures (${fr(H_HOT.tEnd)} K avec une étoile quatre fois plus lumineuse). Une température qui monte encore au bout de ${fr(TOY.heatHours)} heures signe une lumière qui ne s’en va pas.`,
      controls: [
        { type: 'range', key: 'absorb', label: 'part de lumière qui sort', min: 0, max: 1, step: 0.05, fmt: pct },
        { type: 'range', key: 'lum', label: 'luminosité de l’étoile (× nominale)', min: 0.5, max: 4, step: 0.1, fmt: dec(1) },
      ],
      goal: { label: 'L’aqua reste liquide, à l’équilibre', test: (v) => { const h = heatOf(v.absorb, v.lum); return h.outcome === 'habitable' && !h.rising; } },
      conclusion: 'En laissant sortir au moins 40 % de la lumière qui atteint le bord, la planète trouve un équilibre où l’aqua reste liquide, comme dans le Cosmoplexe de Maria.',
      justify: 'Le symptôme : la planète chauffe au-delà de l’ébullition de l’aqua, et sa température monte encore après des dizaines d’heures. La cause : la frontière ne laisse sortir qu’une petite part de la lumière, presque comme un tore. La lumière de l’étoile revient au lieu de quitter le modèle, s’accumule, et l’équilibre ne serait atteint que bien plus tard, à une température trop haute. En ouvrant la frontière, la lumière part et la planète se stabilise vite.',
    });
    c.clinicCase({
      id: 'clin-std', title: 'des Élysiens à court de processeurs', scene: 'elysium', fault: { accel: 4 },
      observe: `Dans un Élysien d’essai, tout va bien pendant des siècles : il reste des processeurs en surplus. Puis la marge fond, et après environ ${fr(LATE4.firstDeficit)} générations, les processeurs viennent à manquer. Le manque ne se résorbe pas : il s’aggrave.`,
      choices: ['le Temps standard, qui accélère trop vite', 'la population, trop nombreuse au départ', 'la matrice, qui a cessé de croître'],
      explain: 'Une population trop nombreuse manquerait de processeurs dès le départ, puis la croissance de la matrice rattraperait le retard. Un surplus suivi d’un manque qui s’aggrave signe une demande qui croît plus vite que le cristal.',
      controls: [
        { type: 'range', key: 'accel', label: 'exposant du Temps standard', min: 0, max: 5, step: 0.5, fmt: dec(1) },
        { type: 'range', key: 'pop', label: 'population (× nominale)', min: 0.5, max: 6, step: 0.5, fmt: dec(1) },
      ],
      goal: { label: 'Les processeurs restent en surplus pour toujours', test: (v) => growOf(v.accel, v.pop).outcome === 'surplus' },
      conclusion: 'Avec un exposant de 3 ou moins, le cube de processeurs, qui croît comme t³, garde toujours l’avantage.',
      justify: 'Le symptôme : un surplus pendant longtemps, puis un manque qui s’aggrave. La cause : le Temps standard accélère comme t⁴, plus vite que la matrice, qui croît comme t³. Au début, les constantes donnent l’avantage à la matrice ; à la longue, l’exposant le plus élevé l’emporte toujours. En ramenant l’exposant à 3 ou moins, l’offre de processeurs croît au moins aussi vite que la demande.',
    });

    // ============================================================== exam
    c.module('exam');
    c.clinicCase({
      id: 'exam-gap', exam: true, title: 'une Copie qui sent un saut', scene: 'dust', fault: { slices: 24, missing: 1 },
      observe: 'Une Copie est calculée en tranches réparties au hasard sur des machines dispersées. Elle compte de un à dix, comme Paul. Mais, à un moment, son souvenir saute : la pièce change d’un coup, sans transition. Reconstruite par la règle, son histoire tient en deux morceaux.',
      choices: ['un instant n’a jamais été calculé', 'les tranches ont été calculées dans le désordre', 'le modèle a été dispersé sur trop de machines'],
      explain: 'Le désordre et la dispersion ne laissent aucune trace : la règle retrouve l’ordre. Deux morceaux, c’est un trou : un instant manque, et rien ne relie ses deux bords.',
      controls: [
        { type: 'range', key: 'slices', label: 'tranches mélangées', min: 1, max: 24, step: 1, fmt: dec(0) },
        { type: 'range', key: 'missing', label: 'lignes jamais calculées', min: 0, max: 3, step: 1, fmt: dec(0) },
      ],
      goal: { label: 'L’histoire est d’un seul tenant', test: (v) => dustOf(v.slices, v.missing).outcome === 'intact' },
      conclusion: 'Quand tous les instants sont calculés, dans n’importe quel ordre, l’histoire se reconstruit d’un seul tenant.',
      justify: 'Le symptôme : un saut dans le vécu, et une histoire reconstruite en deux morceaux. La cause : un instant n’a jamais été calculé. Chaque état désigne son suivant par la règle ; sans l’instant manquant, l’état d’avant n’a plus de suivant et celui d’après plus de précédent. Le mélange des tranches, lui, ne change rien : l’ordre est contenu dans les états.',
    });
    c.chapter('Test final', () => {
      c.stage('ca', { rule: 110, caSeed: 1 });
      c.step('Le test final', 'Ce test reprend les notions du test de départ, dans d’autres situations. Comparez ensuite vos deux résultats, notion par notion.');
      c.test('post', 'Le test final.');
    });
  },
});

export default Object.assign(course, { workshop });

