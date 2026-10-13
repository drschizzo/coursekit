// Comment une épidémie se propage : a lycée-level course on the spread of an
// epidemic in a town of 100 000 people. R0 and exponential growth, the SIR
// model, why an epidemic stops by itself, vaccination and the herd threshold,
// measures, their timing and the hospital beds. The figures of the text, the
// diagrams, the stage and the exercises all run ./model.ts.

import { choice, dec, defineCourse, fr, numeric, pct, type Capsule } from '@coursekit/core';
import { pickCapsules } from '@coursekit/diagrams';
import { choiceQ, type Exercise, type WorkshopConfig } from '@coursekit/exercises';
import { DIAGRAMS } from './diagrams.ts';
import {
  BASE, BEDS, HOSP, I0, N, PLAN, doublingTime, epidemicOf, finalSize, herdThreshold, model, r0, r0Of, simulate,
  stepRef, type StepFn,
} from './model.ts';

const near = (a: number, b: number, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel;

const R0 = r0(BASE.contacts, BASE.p, BASE.dur);
const NOM = epidemicOf({});
const PLANNED = epidemicOf(PLAN);
const DBL = doublingTime(R0, BASE.dur);
const TH = herdThreshold(R0);
const EARLY = simulate({ days: 40 }).days;
/** contagious people when the measures start on day 25, and 15 days later */
const AT25 = epidemicOf({ ...PLAN }).atStart, AT40 = epidemicOf({ ...PLAN, start: 40 }).atStart;
/** the clinic cases: one setting changed from the plan */
const LATE = epidemicOf({ ...PLAN, start: 50 });
const WEAK = epidemicOf({ ...PLAN, cut: 0.2 });
const VARIANT = epidemicOf({ ...PLAN, p: 0.045 });
const VARIANT_R0 = r0(BASE.contacts, 0.045, BASE.dur);
/** the first day the hospital lacks beds, without measures */
const FIRST_FULL = NOM.days.find((d) => d.beds > BEDS)!.t;
/** infected so far on the day of the peak */
const AT_PEAK = (N - NOM.days[Math.round(NOM.peak.t)].S) / N;

// ------------------------------------------------------------- toolbox

const CAPSULES: Capsule[] = [
  {
    id: 'E1', title: 'La croissance exponentielle',
    goal: 'Calculer ce que devient une quantité multipliée par le même nombre à intervalles réguliers.',
    used: 'Les débuts d’une épidémie : génération après génération, ou tous les quatre jours.',
    steps: [
      { title: 'Multiplier, pas ajouter', diagram: 'tree', text: 'Une croissance est linéaire quand on ajoute la même quantité à chaque étape : 10, 20, 30, 40. Elle est exponentielle quand on multiplie par le même nombre : 10, 20, 40, 80. Au début, les deux se ressemblent ; très vite, la seconde laisse la première loin derrière.' },
      { title: 'Les puissances', text: 'Multiplier n fois par R donne Rⁿ. Doubler dix fois multiplie par 2¹⁰ = 1 024, soit environ mille. Doubler vingt fois multiplie par environ un million. C’est pourquoi une quantité qui double régulièrement passe en peu de temps de quelques unités à des milliers.', code: '2 ** 10   // 1024' },
      { title: 'Le temps de doublement', text: 'Si une quantité double tous les T jours, elle est multipliée par 2 au bout de T jours, par 4 au bout de 2T, par 8 au bout de 3T. Au bout de t jours, elle est multipliée par 2 puissance t/T.', code: 'facteur = 2 ** (t / T)' },
    ],
    check: [
      numeric('Une quantité double tous les 3 jours. Par combien est-elle multipliée en 15 jours ?', 32, '15 jours font 5 doublements : 2⁵ = 32.'),
      choice('Que vaut 2¹⁰ environ ?', ['environ 1 000', 'environ 20', 'environ 100', 'environ 10 000'], '2¹⁰ = 1 024.'),
    ],
  },
  {
    id: 'P1', title: 'Pourcentages et proportions',
    goal: 'Calculer une part d’un tout, appliquer une réduction en pourcentage, retrouver un tout à partir d’une part.',
    used: 'La vaccination, la réduction des contacts, les lits d’hôpital.',
    steps: [
      { title: 'Une part d’un tout', text: 'Prendre 58 % d’une ville de 100 000 habitants, c’est multiplier 100 000 par 0,58 : on obtient 58 000 personnes. Un pourcentage est une fraction dont le dénominateur vaut 100.', code: '100000 * 0.58   // 58000' },
      { title: 'Réduire de x %', text: 'Réduire une quantité de 40 %, c’est en garder 60 % : on la multiplie par 1 − 0,40 = 0,60. Dix contacts réduits de 40 % deviennent six contacts.', code: '10 * (1 - 0.40)   // 6' },
      { title: 'Retrouver le tout', text: 'Si 90 % des personnes vaccinées sont protégées et qu’il faut 80 000 personnes protégées, il faut en vacciner 80 000 / 0,9, soit environ 88 900. On divise la part voulue par la proportion.', code: '80000 / 0.9   // ≈ 88889' },
    ],
    check: [
      numeric('Dix contacts par jour sont réduits de 40 %. Combien en reste-t-il ?', 6, '10 × (1 − 0,4) = 6.'),
      choice('Dans une ville de 50 000 habitants, 30 % sont vaccinés. Combien ne le sont pas ?', ['35 000', '15 000', '20 000', '30 000'], '70 % de 50 000 = 35 000.'),
    ],
  },
];

// ----------------------------------------------------------- exercises

const curve = (ctx: CanvasRenderingContext2D, I: number[], col: string, top: number) => {
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
  I.forEach((v, i) => { const X = 30 + (i / (I.length - 1)) * 320, Y = 222 - (Math.max(0, Math.min(top, v)) / top) * 170; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.stroke();
};

const yearOf = (step: StepFn, p = {}) => simulate({ ...p, days: 200 }, step).days.map((d) => d.I);

const stepPreview = (ctx: CanvasRenderingContext2D, fn: Function | null) => {
  ctx.fillStyle = '#7c9cff'; ctx.font = '11px Inter, sans-serif';
  if (!fn) { ctx.fillText('écrivez votre fonction', 20, 20); return; }
  let mine: number[] = [];
  try { mine = yearOf(fn as StepFn); } catch { ctx.fillText('votre fonction lève une erreur', 20, 20); return; }
  const ref = yearOf(stepRef);
  const top = Math.max(...ref) * 1.15;
  curve(ctx, ref, 'rgba(124,156,255,.6)', top);
  curve(ctx, mine, '#ffb35c', top);
  ctx.fillStyle = '#e6eaf5';
  ctx.fillText('contagieux pendant 200 jours, sans mesures', 30, 18);
  ctx.fillStyle = '#ffb35c'; ctx.fillText('votre calcul', 30, 34);
  ctx.fillStyle = '#7c9cff'; ctx.fillText('référence', 110, 34);
};

const R_FLU = r0(12, 0.025, 5);

const exercises: Exercise[] = [
  {
    id: 'r0calc', module: 'm1', kind: 'calculation', title: 'Le R0 d’une maladie',
    intro: 'Une maladie respiratoire : chaque malade rencontre 12 personnes par jour, chaque contact transmet la maladie avec une probabilité de 0,025, et un malade reste contagieux 5 jours. Personne n’est immunisé.',
    steps: [
      { prompt: 'Que vaut R0 ?', value: R_FLU, explain: `12 × 0,025 × 5 = ${fr(R_FLU, 1)}.` },
      { prompt: 'Combien de cas compte la quatrième génération, à partir d’un seul malade (R0 puissance 4) ?', value: R_FLU ** 4, tol: 3, explain: `${fr(R_FLU, 1)}⁴ ≈ ${fr(R_FLU ** 4, 2)}.` },
      { prompt: 'Combien de cas en tout, de la génération 0 (le premier malade) à la génération 4 ?', value: [0, 1, 2, 3, 4].reduce((s, g) => s + R_FLU ** g, 0), tol: 3, explain: `1 + 1,5 + 2,25 + 3,375 + 5,06 ≈ ${fr([0, 1, 2, 3, 4].reduce((s, g) => s + R_FLU ** g, 0), 1)}.` },
    ],
    win: 'Chaque génération est une fois et demie plus grande que la précédente : la somme grossit de plus en plus vite.',
  },
  {
    id: 'sir', module: 'm2', kind: 'code', title: 'Un pas du modèle SIR', slot: 'step',
    sig: 'function step(s, dt, beta, gamma)',
    doc: 's : l’état {S, I, R} (nombres de personnes) · dt : la durée du pas (jours) · beta : contacts × probabilité de transmission, par jour · gamma : 1 / durée contagieuse, par jour.',
    goal: 'Calculez la population n = S + I + R, puis les infections du pas, beta·I·(S/n)·dt, et les guérisons, gamma·I·dt. Les infections passent de S à I ; les guérisons passent de I à R.',
    solution: `function step(s, dt, beta, gamma) {
  const n = s.S + s.I + s.R;
  const infections = beta * s.I * (s.S / n) * dt;
  const recoveries = gamma * s.I * dt;
  s.S -= infections;
  s.I += infections - recoveries;
  s.R += recoveries;
}`,
    starter: `function step(s, dt, beta, gamma) {
  // 1. la population n = S + I + R
  // 2. les infections du pas : beta · I · (S / n) · dt
  // 3. les guérisons du pas : gamma · I · dt
  // 4. S perd les infections ; I gagne les infections et perd les guérisons ; R gagne les guérisons
}`,
    hints: [
      'Calculez les deux flux avant de modifier s.S, s.I ou s.R : sinon le second flux utilise des valeurs déjà changées.',
      'Les guérisons ne dépendent que de I : gamma * s.I * dt.',
      'La somme S + I + R ne doit pas changer : ce que S perd, I le gagne, et ce que I perd, R le gagne.',
    ],
    win: 'Votre ville suit exactement l’épidémie de la référence : montée, pic, puis décrue.',
    primm: {
      intro: 'Voici un pas du modèle incomplet. Lisez-le avant de l’exécuter.',
      code: `function step(s, dt, beta, gamma) {
  const n = s.S + s.I + s.R;
  const infections = beta * s.I * (s.S / n) * dt;
  s.S -= infections;
  s.I += infections;
}`,
      predict: choiceQ('Avec ce code, comment évolue le nombre de contagieux ?', ['il monte jusqu’à toute la ville', 'il monte puis redescend', 'il reste toujours constant'], 'Personne ne quitte jamais le groupe I : il ne fait que grossir, jusqu’à ce que S soit vide.'),
      investigate: choiceQ('Que fait le modèle complet que ce code oublie ?', ['les guérisons, qui vident le groupe I', 'le pas de temps, qui multiplie les flux', 'la population, qui sert à diviser S'], 'Chaque jour, une fraction gamma des contagieux guérit et passe dans R.'),
      modify: 'Ajoutez les guérisons : gamma·I·dt personnes passent de I à R à chaque pas.',
    },
    preview: (ctx, fn) => stepPreview(ctx, fn),
  },
  {
    id: 'levers', module: 'm3', kind: 'classify', title: 'Quel facteur de R0 ?',
    intro: 'Pour chaque mesure, dites lequel des trois facteurs de R0 elle réduit surtout.',
    categories: ['les contacts par jour', 'la probabilité de transmission', 'la durée contagieuse'],
    items: [
      { text: 'le télétravail', cat: 0 },
      { text: 'le port du masque', cat: 1 },
      { text: 'l’isolement dès les premiers symptômes', cat: 2, why: 'un malade isolé cesse de transmettre avant la fin de sa maladie' },
      { text: 'l’aération des salles de classe', cat: 1 },
      { text: 'l’annulation des grands rassemblements', cat: 0 },
      { text: 'un traitement qui raccourcit la maladie', cat: 2 },
    ],
    win: 'Chaque mesure réduit un facteur ; leurs effets se multiplient.',
  },
  {
    id: 'herd', module: 'm3', kind: 'calculation', title: 'Combien vacciner ?',
    intro: `Une maladie a un R0 de 5. La ville compte ${fr(N)} habitants, dont aucun n’est immunisé. Le vaccin protège 90 % des personnes vaccinées.`,
    steps: [
      { prompt: 'Quel est le seuil d’immunité collective, en % ?', value: herdThreshold(5) * 100, unit: '%', explain: `1 − 1/5 = 0,8, soit ${pct(herdThreshold(5))}.` },
      { prompt: 'Combien d’habitants doivent être immunisés ?', value: herdThreshold(5) * N, explain: `${pct(herdThreshold(5))} de ${fr(N)} = ${fr(herdThreshold(5) * N)}.` },
      { prompt: 'Combien faut-il en vacciner, si le vaccin protège 90 % des vaccinés ?', value: (herdThreshold(5) * N) / 0.9, explain: `${fr(herdThreshold(5) * N)} / 0,9 ≈ ${fr((herdThreshold(5) * N) / 0.9)}.` },
    ],
    win: 'Plus R0 est grand, plus le seuil est haut ; un vaccin imparfait oblige à vacciner davantage.',
  },
  {
    id: 'timeline', module: 'm4', kind: 'sequence', title: 'Une année sans mesures',
    intro: 'Remettez dans l’ordre les événements de l’épidémie de la ville, sans vaccin ni mesures.',
    items: ['les premiers cas apparaissent', 'les cas doublent tous les quatre jours environ', 'l’hôpital manque de lits', 'le pic épidémique', 'l’hôpital retrouve des lits libres', 'l’épidémie s’éteint'],
    explain: `Les lits manquent dès le jour ${fr(FIRST_FULL)}, avant le pic du jour ${fr(NOM.peak.t)} ; la décrue libère ensuite l’hôpital, puis l’épidémie s’éteint en laissant ${pct(1 - NOM.attack)} de la ville épargnée.`,
    win: 'L’hôpital déborde avant le pic : attendre le pic pour agir, c’est déjà trop tard.',
  },
];

const workshop: WorkshopConfig = {
  scenarios: [
    { name: 'la ville sans mesures', run: (impl) => yearOf(impl.step as never), tol: 0.5, unit: 'personnes' },
    { name: 'la ville vaccinée à 40 %', run: (impl) => yearOf(impl.step as never, { vax: 0.4 }), tol: 0.5, unit: 'personnes' },
    { name: 'des mesures au jour 25', run: (impl) => yearOf(impl.step as never, PLAN), tol: 0.5, unit: 'personnes' },
  ],
  assembly: {
    title: 'Mon modèle SIR',
    intro: 'Votre fonction step fait tourner l’épidémie de la ville pendant 200 jours, sans mesures.',
    chart: { label: 'contagieux', unit: 'personnes', run: (impl) => yearOf(impl.step as never) },
  },
};

// --------------------------------------------------------------- course

const isHeld = (v: Record<string, number>) => epidemicOf(v).outcome !== 'overflow';
const townHud = (v: Record<string, number>) => `R0 = ${fr(r0Of(v), 2)} · ${pct(epidemicOf(v).attack)} de la ville infectée en un an`;

const course = defineCourse({
  id: 'epidemie', version: 1, language: 'fr',
  title: 'Comment une épidémie se propage',
  lead: 'Pourquoi une épidémie démarre, accélère puis s’arrête d’elle-même, et comment la vaccination et la réduction des contacts la freinent. Le cours suit une maladie imaginaire dans une ville de 100 000 habitants ; chaque chiffre est calculé par une petite simulation que vous pouvez faire varier.',
  audience: { level: 'lycée', prerequisites: 'Les pourcentages, les puissances. La croissance exponentielle est rappelée dans une fiche.', effort: 'trois à quatre heures' },
  modules: [
    {
      id: 'm1', title: 'Une contagion qui se multiplie', pitch: 'Combien de personnes un malade contamine, et pourquoi le nombre de cas s’envole.',
      goals: ['Calculer R0 à partir des contacts, de la probabilité de transmission et de la durée contagieuse', 'Dire si une maladie peut provoquer une épidémie', 'Reconnaître une croissance exponentielle'],
      summary: ['R0 = contacts par jour × probabilité de transmission × durée contagieuse.', 'R0 > 1 : chaque génération de cas est plus grande que la précédente ; R0 < 1 : la maladie s’éteint.', 'Au début, le nombre de cas est multiplié par le même nombre à intervalles réguliers : il double tous les quatre jours environ dans la ville du cours.'],
    },
    {
      id: 'm2', title: 'Le modèle SIR', pitch: 'Trois groupes d’habitants, deux flux entre eux : la forme complète d’une épidémie.',
      goals: ['Décrire l’évolution des trois groupes pendant une épidémie', 'Expliquer pourquoi une épidémie s’arrête avant d’avoir touché tout le monde', 'Programmer un pas du modèle SIR'],
      summary: ['Les habitants passent de susceptibles à contagieux, puis à rétablis.', 'R effectif = R0 × part de susceptibles. Le pic arrive quand il passe à 1.', 'L’épidémie s’éteint faute de susceptibles, en laissant une partie de la ville épargnée : environ 12 % pour R0 = 2,4.'],
    },
    {
      id: 'm3', title: 'Freiner l’épidémie', pitch: 'Ce que changent les gestes barrières, l’isolement et la vaccination.',
      goals: ['Associer chaque mesure au facteur de R0 qu’elle réduit', 'Calculer le seuil d’immunité collective'],
      summary: ['Chaque mesure réduit un facteur de R0 : les contacts, la probabilité de transmission ou la durée contagieuse.', 'Pour faire reculer l’épidémie, il faut ramener R sous 1.', 'Seuil d’immunité collective : 1 − 1/R0. Pour R0 = 2,4, environ 58 % de la ville.'],
    },
    {
      id: 'm4', title: 'Aplatir la courbe', pitch: 'Les lits d’hôpital, la force des mesures et le moment où on les prend.',
      goals: ['Expliquer pourquoi le moment des mesures compte autant que leur force', 'Diagnostiquer une réponse ratée à une épidémie'],
      summary: ['L’hôpital a un nombre de lits fixe : le pic des contagieux doit rester en dessous.', 'Réduire les contacts abaisse et retarde le pic, et réduit le nombre total de malades.', 'Quinze jours de retard multiplient par dix le nombre de contagieux au moment d’agir.'],
    },
    { id: 'exam', title: 'Épreuve', kind: 'exam', pitch: 'Une épidémie qui déborde l’hôpital, à diagnostiquer seul, et le test final.', goals: ['Diagnostiquer seul un cas inconnu'], summary: ['Observer, supposer, corriger un seul réglage, justifier.'] },
  ],
  glossary: [
    { id: 'contagious', name: 'durée contagieuse', def: 'Nombre de jours pendant lesquels un malade peut transmettre la maladie.', module: 'm1' },
    { id: 'ptrans', name: 'probabilité de transmission', def: 'Probabilité qu’un contact entre un malade et une personne non immunisée transmette la maladie.', module: 'm1' },
    { id: 'r0', name: 'R0', forms: ['nombre de reproduction de base'], def: 'Nombre moyen de personnes contaminées par un malade dans une population où personne n’est immunisé : contacts × probabilité × durée.', module: 'm1' },
    { id: 'generation', name: 'génération', forms: ['générations'], def: 'Les cas contaminés par les cas de la génération précédente.', module: 'm1' },
    { id: 'expo', name: 'croissance exponentielle', def: 'Croissance où la quantité est multipliée par le même nombre à intervalles réguliers.', tool: 'E1', module: 'm1' },
    { id: 'doubling', name: 'temps de doublement', def: 'Durée au bout de laquelle une quantité en croissance exponentielle a doublé.', tool: 'E1', module: 'm1' },
    { id: 'sir', name: 'modèle SIR', def: 'Modèle qui répartit la population en trois groupes : susceptibles, contagieux (infectés), rétablis.', module: 'm2' },
    { id: 'susceptible', name: 'susceptible', forms: ['susceptibles'], def: 'Personne qui n’a jamais eu la maladie et peut l’attraper.', module: 'm2' },
    { id: 'recovered', name: 'rétabli', forms: ['rétablis'], def: 'Personne guérie, immunisée, qui ne transmet plus la maladie.', module: 'm2' },
    { id: 'reff', name: 'R effectif', def: 'Nombre moyen de personnes contaminées par un malade à un moment donné : R0 × part de susceptibles, réduit par les mesures.', module: 'm2' },
    { id: 'peak', name: 'pic épidémique', def: 'Moment où le nombre de contagieux est le plus grand.', module: 'm2' },
    { id: 'final', name: 'taille finale', def: 'Part de la population infectée une fois l’épidémie terminée.', module: 'm2' },
    { id: 'herd', name: 'immunité collective', def: 'Protection d’une population où assez de personnes sont immunisées pour qu’un malade contamine en moyenne moins d’une personne.', tool: 'P1', module: 'm3' },
    { id: 'isolation', name: 'isolement', def: 'Mise à l’écart d’un malade pour qu’il ne rencontre plus personne pendant qu’il est contagieux.', module: 'm3' },
    { id: 'capacity', name: 'capacité hospitalière', def: 'Nombre de lits disponibles pour les malades. La ville du cours en a 200.', module: 'm4' },
    { id: 'flatten', name: 'aplatir la courbe', def: 'Abaisser et étaler le pic des contagieux pour qu’il reste sous la capacité hospitalière.', module: 'm4' },
  ],
  toolbox: [...pickCapsules(['T4', 'Le calcul pas à pas du modèle SIR.']), ...CAPSULES],
  tests: {
    tools: [
      { id: 'a1', skill: 'La croissance exponentielle', tool: 'E1', q: numeric('Un nombre de cas double tous les 4 jours. Par combien est-il multiplié en 20 jours ?', 32, '20 jours font 5 doublements : 2⁵ = 32.') },
      { id: 'a2', skill: 'Les pourcentages', tool: 'P1', q: numeric('35 % d’une ville de 60 000 habitants sont vaccinés. Combien d’habitants ne le sont pas ?', 39000, '65 % de 60 000 = 39 000.') },
      { id: 'a3', skill: 'Le calcul pas à pas', tool: 'T4', q: numeric('Il y a 1 000 contagieux. Chaque jour, 300 personnes sont infectées et 125 guérissent. Combien de contagieux le lendemain ?', 1175, '1 000 + 300 − 125 = 1 175.') },
    ],
    pre: [
      { id: 'b1', skill: 'La croissance exponentielle', q: choice('Une ville compte 10 malades le 1er du mois et 20 le 5. Si rien ne change, combien le 13 ?', ['environ 80', 'environ 30', 'environ 40', 'environ 50'], 'Le nombre double tous les 4 jours : 40 le 9, 80 le 13.') },
      { id: 'b2', skill: 'La fin d’une épidémie', q: choice('Sans vaccin ni mesures, une épidémie s’arrête…', ['avant que tout le monde ait été infecté', 'quand tout le monde a été infecté', 'quand le virus s’affaiblit de lui-même', 'quand les malades restent chez eux'], 'Quand les susceptibles deviennent rares, chaque malade en contamine moins d’un : l’épidémie s’éteint en laissant des personnes épargnées.') },
      { id: 'b3', skill: 'Le seuil d’immunité', q: choice('Une maladie a un R0 de 2. Pour qu’elle ne puisse pas démarrer, quelle part de la population faut-il vacciner ?', ['la moitié', 'toute la population', 'un quart', 'les trois quarts'], '1 − 1/2 = 50 %.') },
      { id: 'b4', skill: 'R au-dessus ou en dessous de 1', q: choice('Dans une ville, chaque malade contamine en moyenne 0,8 personne. Le nombre de nouveaux cas…', ['diminue', 'augmente lentement', 'reste stable', 'augmente vite'], 'Chaque génération est plus petite que la précédente : 1, 0,8, 0,64…') },
      { id: 'b5', skill: 'Le moment des mesures', q: choice('Les cas doublent tous les 4 jours. Une ville prend des mesures 12 jours après sa voisine. Au moment d’agir, elle a…', ['environ 8 fois plus de cas', 'environ 3 fois plus de cas', 'à peu près autant de cas', 'environ 12 fois plus de cas'], '12 jours font 3 doublements : 2³ = 8.') },
    ],
    post: [
      { id: 'p1', pair: 'b1', skill: 'La croissance exponentielle', q: choice('Une rumeur : chaque personne qui l’apprend la répète à 3 personnes le lendemain. Le premier jour, une personne la connaît. Combien l’apprennent le sixième jour ?', ['243', '18', '15', '729'], '3⁵ = 243 nouvelles personnes le sixième jour.') },
      { id: 'p2', pair: 'b2', skill: 'La fin d’une épidémie', q: choice('Après le pic d’une épidémie sans mesures, les nouveaux cas diminuent parce que…', ['les susceptibles sont devenus rares', 'le virus a perdu de sa force', 'les malades restent chez eux', 'toute la ville a été infectée'], 'Un malade croise surtout des personnes immunisées : il contamine moins d’une personne en moyenne.') },
      { id: 'p3', pair: 'b3', skill: 'Le seuil d’immunité', q: choice('Une maladie a un R0 de 4. Quel est son seuil d’immunité collective ?', ['75 %', '100 %', '25 %', '40 %'], '1 − 1/4 = 75 %.') },
      { id: 'p4', pair: 'b4', skill: 'R au-dessus ou en dessous de 1', q: choice('Des mesures font passer R de 1,5 à 0,9. L’épidémie…', ['commence à reculer', 'progresse plus lentement', 'continue au même rythme', 's’arrête le lendemain'], 'Sous 1, chaque malade est remplacé par moins d’un nouveau malade : le nombre de cas diminue, progressivement.') },
      { id: 'p5', pair: 'b5', skill: 'Le moment des mesures', q: choice('Les cas doublent tous les 3 jours. Les mesures sont repoussées de 9 jours. Au moment d’agir, les contagieux sont…', ['8 fois plus nombreux', '3 fois plus nombreux', '9 fois plus nombreux', 'un peu plus nombreux'], '9 jours font 3 doublements : 2³ = 8.') },
    ],
  },
  diagrams: DIAGRAMS,
  stageKeys: ['contacts', 'p', 'dur', 'vax', 'cut', 'start'],
  scenes: { town: 'La ville, un point pour cent habitants', curve: 'Les lits d’hôpital occupés, jour après jour' },
  defaults: { contacts: BASE.contacts, p: BASE.p, dur: BASE.dur, vax: 0, cut: 0, start: PLAN.start },
  model,
  exercises,
  rubric: [
    'Une justification complète décrit le symptôme (ce que montre la courbe), la cause (le réglage en défaut) et le mécanisme qui relie les deux.',
    'Elle s’appuie sur une grandeur du cours : R0, R effectif, temps de doublement, lits d’hôpital.',
  ],
  content(c) {
    // ================================================================ m1
    c.module('m1');
    c.chapter('Une ville, une maladie', () => {
      c.stage('town');
      c.step('Ce que le cours étudie', `La ville du cours compte ${fr(N)} habitants. Un jour, ${fr(I0)} d’entre eux tombent malades d’une maladie nouvelle, contre laquelle personne n’est protégé. Sans vaccin ni mesures, en un an, ${pct(NOM.attack)} des habitants l’attrapent. En arrière-plan, chaque point représente cent habitants : en orange, ceux qui sont contagieux.`, {
        claims: [{ text: `${pct(NOM.attack)} des habitants infectés`, check: () => near(NOM.attack, finalSize(R0), 0.02) || pct(NOM.attack) }],
      });
      c.test('pre', 'Avant de commencer, un court test : il mesure ce que vous savez déjà, pour le comparer au test final.');
      c.step('Une simulation simplifiée', 'La maladie du cours est imaginaire, et la ville très simplifiée : tous les habitants ont le même nombre de rencontres, au hasard, et une personne guérie ne retombe pas malade. Ces simplifications laissent voir les mécanismes que l’on retrouve dans les vraies épidémies.');
    });
    c.chapter('De personne à personne', () => {
      c.stage('town');
      c.diagram('r0');
      c.ask('q-low', 'Une maladie ne se transmet qu’à 3 % des contacts. Peut-elle provoquer une épidémie ?', ['oui, si chaque malade a assez de contacts', 'non, 3 % est une probabilité trop faible', 'non, sauf si la maladie est très grave', 'oui, mais seulement pendant l’hiver'], 'Ce qui compte est le nombre total de personnes qu’un malade contamine, sur tous ses contacts et toute sa maladie.');
      c.step('Trois facteurs', 'Un malade transmet la maladie lors de ses rencontres. Trois nombres décident de combien de personnes il contamine : le nombre de personnes qu’il rencontre chaque jour, la probabilité qu’une rencontre transmette la maladie, et le nombre de jours pendant lesquels il est contagieux.');
      c.step('Le nombre R0', `On multiplie les trois facteurs pour obtenir R0 : le nombre moyen de personnes qu’un malade contamine quand personne n’est immunisé. Dans la ville du cours : ${fr(BASE.contacts)} contacts par jour × ${fr(BASE.p, 2)} × ${fr(BASE.dur)} jours = ${fr(R0, 1)}.`, {
        code: 'R0 = contacts × probabilité × durée',
        claims: [{ text: `R0 = ${fr(R0, 1)}`, check: () => near(R0, 2.4, 0.001) }],
      });
      c.experiment({
        title: 'Les trois facteurs', prompt: 'Faites varier les trois facteurs et regardez R0 sur le schéma.',
        predict: { question: 'Si chaque malade rencontre deux fois moins de personnes, R0…', choices: ['est divisé par deux', 'baisse un peu', 'ne change pas'], answer: 0 },
        controls: [
          { type: 'range', key: 'contacts', label: 'contacts par jour', min: 1, max: 20, step: 1, fmt: dec(0) },
          { type: 'range', key: 'p', label: 'probabilité par contact', min: 0.01, max: 0.08, step: 0.005, fmt: dec(3) },
          { type: 'range', key: 'dur', label: 'durée contagieuse (jours)', min: 2, max: 14, step: 1, fmt: dec(0) },
        ],
        goals: [
          { label: 'Ramenez R0 sous 1', test: ({ v }) => r0Of(v) < 1 },
          { label: 'Ramenez R0 sous 1 en gardant au moins 10 contacts par jour', test: ({ v }) => r0Of(v) < 1 && v.contacts >= 10 },
        ],
        seq: true, conclusion: 'R0 est un produit : diviser l’un des facteurs par deux divise R0 par deux. On peut passer sous 1 sans toucher aux contacts, en réduisant la probabilité de transmission ou la durée contagieuse.',
      });
      c.numeric('q-r0', 'Un malade rencontre 6 personnes par jour, la probabilité de transmission vaut 0,05 et il reste contagieux 10 jours. Que vaut R0 ?', r0(6, 0.05, 10), `6 × 0,05 × 10 = ${fr(r0(6, 0.05, 10))}.`);
    });
    c.chapter('Une croissance exponentielle', () => {
      c.stage('town');
      c.diagram('tree');
      c.ask('q-linear', 'Une ville compte 10 malades le 1er du mois et 20 le 5. Si rien ne change, combien le 13 ?', ['environ 80', 'environ 30', 'environ 40', 'environ 50'], 'Le nombre ne gagne pas 10 cas tous les 4 jours : il double tous les 4 jours. 40 le 9, 80 le 13.');
      c.step('Génération après génération', `Un malade en contamine R0 ; chacun d’eux en contamine R0 à son tour, et ainsi de suite. La génération n compte R0 puissance n cas. Avec R0 = ${fr(R0, 1)}, la cinquième génération compte déjà ${fr(R0 ** 5)} cas, issus d’un seul malade. Si R0 est plus petit que 1, chaque génération est plus petite que la précédente.`, {
        tools: ['E1'],
        claims: [{ text: `cinquième génération : ${fr(R0 ** 5)} cas`, check: () => near(R0 ** 5, 80, 0.01) }],
      });
      c.diagram('growth');
      c.step('Doubler tous les quatre jours', `Dans la ville, le nombre de contagieux double environ tous les ${fr(DBL)} jours au début : c’est une croissance exponentielle. En 40 jours, il passe de ${fr(I0)} à ${fr(EARLY[40].I)}. Au rythme de la première semaine, sans accélération, il n’y en aurait que ${fr(EARLY[0].I + ((EARLY[7].I - EARLY[0].I) / 7) * 40)}.`, {
        tools: ['E1'],
        claims: [
          { text: `doublement en ${fr(DBL)} jours`, check: () => near(DBL, 4, 0.02) },
          { text: 'plus de 5 000 contagieux au jour 40', check: () => EARLY[40].I > 5000 || fr(EARLY[40].I) },
        ],
      });
      c.step('Des débuts trompeurs', 'Pendant les premières semaines, les nombres restent petits : quelques dizaines de malades, puis quelques centaines. Une croissance exponentielle paraît lente tant que les nombres sont petits, puis elle devient très rapide. Quand les chiffres alarment enfin, il ne reste souvent que quelques doublements avant que la situation ne devienne grave.');
      c.exercise('r0calc', 'Dans l’atelier, calculez le R0 d’une maladie et le nombre de cas génération après génération.');
      c.explain('e-expo', 'Une ville compte 10 malades un lundi et 20 le vendredi. Un élu dit : « Dix cas de plus en quatre jours : nous en aurons une centaine dans un mois. » Expliquez son erreur.', 'L’élu suppose que le nombre de cas augmente de la même quantité tous les quatre jours. Or chaque malade en contamine d’autres : le nombre de cas est multiplié, pas augmenté, à chaque période. S’il double tous les quatre jours, il est multiplié par 2⁷, soit 128, en vingt-huit jours : plus de mille malades, pas une centaine.');
    });

    // ================================================================ m2
    c.module('m2');
    c.chapter('Trois groupes', () => {
      c.stage('town');
      c.diagram('flows');
      c.step('Susceptibles, contagieux, rétablis', `Le modèle SIR range chaque habitant dans un groupe : S, les susceptibles, qui n’ont jamais eu la maladie ; I, les contagieux ; R, les rétablis, guéris et immunisés. Chaque habitant passe de S à I, puis de I à R. Le total reste ${fr(N)}.`);
      c.step('Deux flux', 'Chaque jour, un contagieux a β = contacts × probabilité contacts qui transmettent, mais seule la part S/N d’entre eux touche un susceptible. Les infections du jour valent donc β·I·S/N. Les guérisons valent I/durée : un contagieux sur huit guérit chaque jour.', {
        tools: ['T4'],
        code: 'infections = β · I · S / N\nguérisons = I / durée',
      });
      c.question('q-flows', 'Dans le modèle, pourquoi les infections ralentissent-elles quand S diminue ?', ['moins de contacts touchent un susceptible', 'les malades ont moins de contacts', 'la maladie devient moins contagieuse', 'les rétablis bloquent les malades'], 'Les contacts d’un malade sont toujours aussi nombreux, mais une part croissante d’entre eux touche une personne déjà immunisée.');
      c.exercise('sir', 'Dans l’atelier, programmez un pas du modèle SIR.');
    });
    c.chapter('La courbe épidémique', () => {
      c.stage('town');
      c.diagram('sir');
      c.ask('q-slow', 'Sans aucune mesure, pourquoi l’épidémie finit-elle par ralentir ?', ['les malades croisent surtout des immunisés', 'le virus perd de sa force avec le temps', 'les habitants ont moins de contacts', 'tous les habitants ont été malades'], 'Les contacts restent les mêmes, mais de plus en plus de personnes croisées sont déjà rétablies.');
      c.step('Monter, culminer, redescendre', `Sur le schéma, la courbe des contagieux monte, culmine puis redescend : c’est le pic épidémique. Dans la ville, il arrive le jour ${fr(NOM.peak.t)}, avec ${pct(NOM.peak.I / N)} des habitants contagieux en même temps. Pendant ce temps, S ne fait que baisser et R que monter.`, {
        claims: [{ text: `pic : ${pct(NOM.peak.I / N)} contagieux`, check: () => near(NOM.peak.I / N, 1 - (1 + Math.log(R0)) / R0, 0.05) || pct(NOM.peak.I / N) }],
      });
      c.step('Le R effectif', `Un malade ne contamine que des susceptibles. Le nombre qu’il contamine vraiment, le R effectif, vaut R0 × S/N. Au début, il vaut R0. Quand la part de susceptibles tombe à 1/R0, soit ${pct(1 / R0)}, il vaut 1 : chaque malade n’est plus remplacé que par un seul. C’est le pic.`, {
        claims: [{ text: 'au pic, S/N ≈ 1/R0', check: () => near(NOM.days[Math.round(NOM.peak.t)].S / N, 1 / R0, 0.03) || pct(NOM.days[Math.round(NOM.peak.t)].S / N) }],
      });
      c.question('q-reff', 'Que vaut le R effectif au moment du pic épidémique ?', ['exactement 1', 'zéro', 'R0, soit 2,4', 'la moitié de R0'], 'Avant le pic, il est plus grand que 1 et les contagieux augmentent ; après, il est plus petit que 1 et ils diminuent.');
    });
    c.chapter('Qui reste épargné', () => {
      c.stage('town');
      c.diagram('final');
      c.ask('q-all', 'Sans vaccin ni mesures, quelle part de la ville finit par attraper la maladie ?', ['une grande partie, pas tout le monde', 'tout le monde, sans exception', 'environ la moitié, quel que soit R0', 'seulement les personnes fragiles'], 'L’épidémie s’éteint faute de susceptibles avant d’avoir atteint tout le monde.');
      c.step('La taille finale', `Quand les contagieux disparaissent, il reste des susceptibles qui n’ont jamais été malades. Pour R0 = ${fr(R0, 1)}, ${pct(finalSize(R0))} de la ville a été infectée et ${pct(1 - finalSize(R0))} est épargnée. Cette part, la taille finale, dépend seulement de R0 : le schéma la montre pour chaque valeur.`, {
        code: 'taille finale z : z = 1 − exp(−R0 · z)',
        claims: [{ text: `${pct(finalSize(R0))} infectés`, check: () => near(NOM.attack, finalSize(R0), 0.02) }],
      });
      c.step('Au-delà du pic', `Au pic, ${pct(AT_PEAK)} de la ville a déjà été infectée. Il reste pourtant beaucoup de contagieux, qui contaminent encore, même si chacun en contamine moins d’un. L’épidémie continue donc bien au-delà du seuil où elle cesse de croître : elle finit à ${pct(NOM.attack)}.`, {
        claims: [{ text: 'l’épidémie continue après le pic', check: () => NOM.attack - AT_PEAK > 0.2 || pct(NOM.attack - AT_PEAK) }],
      });
      c.experiment({
        title: 'Le nombre de contacts', prompt: 'Faites varier le nombre de contacts par jour. Regardez la courbe et la ville en arrière-plan.',
        predict: { question: 'Avec 15 contacts par jour (R0 = 3,6), la part de la ville infectée sera…', choices: ['plus de 95 %, sans atteindre 100 %', 'exactement 100 %', 'environ 50 %'], answer: 0 },
        controls: [{ type: 'range', key: 'contacts', label: 'contacts par jour', min: 1, max: 20, step: 1, fmt: dec(0) }],
        goals: [
          { label: 'Trouvez un réglage sans épidémie', test: ({ v }) => epidemicOf(v).outcome === 'fizzle' },
          { label: 'Trouvez une épidémie qui épargne plus de la moitié de la ville', test: ({ v }) => { const e = epidemicOf(v); return e.outcome !== 'fizzle' && e.attack < 0.5; } },
          { label: 'Trouvez un réglage où plus de 95 % de la ville est infectée', test: ({ v }) => epidemicOf(v).attack > 0.95 },
        ],
        seq: true, conclusion: 'Sous 1, rien ne se passe ; juste au-dessus de 1, l’épidémie est lente et épargne une grande partie de la ville ; plus R0 est grand, plus elle est rapide et plus elle touche de monde, sans jamais atteindre tout le monde.',
      });
      c.explain('e-stop', 'Expliquez pourquoi une épidémie sans mesures s’arrête avant d’avoir touché toute la ville.', 'Un malade ne contamine que les susceptibles qu’il rencontre. À mesure que l’épidémie avance, les rétablis deviennent nombreux et une part croissante des contacts touche des personnes immunisées. Le R effectif, R0 × S/N, passe sous 1 : chaque malade en contamine moins d’un et les contagieux disparaissent, alors qu’il reste des susceptibles.');
    });

    // ================================================================ m3
    c.module('m3');
    c.chapter('Trois leviers', () => {
      c.stage('town');
      c.diagram('r0');
      c.step('Agir sur chaque facteur', 'Chaque mesure réduit l’un des trois facteurs de R0. Moins de rencontres réduit les contacts. Le masque, l’aération et le lavage des mains réduisent la probabilité de transmission. L’isolement des malades réduit la durée pendant laquelle ils transmettent. Les effets se multiplient : deux mesures qui divisent chacune un facteur par deux divisent R0 par quatre.', { hud: townHud });
      c.step('Passer sous 1', `Pour faire reculer l’épidémie, il suffit que le R effectif passe sous 1 : chaque malade est alors remplacé par moins d’un nouveau malade. Pour R0 = ${fr(R0, 1)}, il faut diviser R0 par ${fr(R0, 1)}, par exemple réduire les contacts de ${pct(1 - 1 / R0)}, si rien d’autre ne change.`, {
        tools: ['P1'],
        claims: [{ text: `réduire de ${pct(1 - 1 / R0)}`, check: () => near(1 - 1 / R0, 0.583, 0.01) }],
      });
      c.exercise('levers', 'Dans l’atelier, rangez des mesures selon le facteur de R0 qu’elles réduisent.');
      c.question('q-iso', 'L’isolement des malades dès leurs premiers symptômes réduit surtout…', ['la durée contagieuse', 'la probabilité de transmission', 'le nombre d’habitants', 'la durée de l’immunité'], 'Un malade isolé ne rencontre plus personne : il cesse de transmettre avant d’être guéri.');
    });
    c.chapter('La vaccination', () => {
      c.stage('town');
      c.diagram('herd');
      c.ask('q-herd', `Pour qu’une épidémie de R0 = ${fr(R0, 1)} ne puisse pas démarrer, quelle part de la ville faut-il vacciner ?`, ['environ 60 %', '100 %', 'environ 24 %', 'environ 90 %'], `Il suffit que le R au départ, R0 × part non vaccinée, passe sous 1 : 1 − 1/${fr(R0, 1)} ≈ ${pct(TH)}.`);
      c.step('Des personnes qui ne transmettent plus', 'Une personne vaccinée ne tombe pas malade et ne transmet pas la maladie. Les contacts d’un malade avec elle ne servent à rien. Si une part v de la ville est vaccinée, un malade ne contamine plus que R0 × (1 − v) personnes au départ.', {
        code: 'R au départ = R0 × (1 − v)',
      });
      c.step('Le seuil d’immunité collective', `Si R0 × (1 − v) est plus petit que 1, un malade arrivé en ville contamine moins d’une personne : la maladie s’éteint sans épidémie. Il faut v > 1 − 1/R0, soit ${pct(TH)} pour la ville. Au-dessus de ce seuil, l’immunité collective protège aussi les personnes non vaccinées.`, {
        tools: ['P1'],
        claims: [{ text: `seuil ${pct(TH)}`, check: () => epidemicOf({ vax: Math.ceil(TH * 20) / 20 }).outcome === 'fizzle' || 'au-dessus du seuil, une épidémie' }],
      });
      c.experiment({
        title: 'La vaccination', prompt: 'Faites varier la part de la ville vaccinée, pour deux maladies plus ou moins contagieuses.',
        predict: { question: 'Avec 50 % de la ville vaccinée et R0 = 2,4, que se passe-t-il ?', choices: ['une épidémie plus petite', 'aucune épidémie', 'la même épidémie'], answer: 0 },
        controls: [
          { type: 'range', key: 'vax', label: 'part vaccinée', min: 0, max: 0.9, step: 0.05, fmt: pct },
          { type: 'choice', key: 'contacts', label: 'contacts par jour', options: [{ label: '10 (R0 = 2,4)', value: 10 }, { label: '15 (R0 = 3,6)', value: 15 }] },
        ],
        goals: [
          { label: 'Avec 10 contacts par jour, empêchez l’épidémie de démarrer', test: ({ v }) => v.contacts === 10 && epidemicOf(v).outcome === 'fizzle' },
          { label: 'Avec 15 contacts par jour, empêchez l’épidémie de démarrer', test: ({ v }) => v.contacts === 15 && epidemicOf(v).outcome === 'fizzle' },
        ],
        seq: true, conclusion: `Pour R0 = 2,4, 60 % de vaccinés suffisent ; pour R0 = 3,6, il en faut plus de ${pct(herdThreshold(3.6))}. Sous le seuil, la vaccination réduit déjà l’épidémie.`,
      });
      c.exercise('herd', 'Dans l’atelier, calculez combien d’habitants il faut vacciner contre une maladie plus contagieuse.');
      c.explain('e-herd', 'Expliquez pourquoi il n’est pas nécessaire de vacciner toute la population pour empêcher une épidémie de démarrer.', 'Une épidémie démarre si chaque malade contamine plus d’une personne. Les vaccinés ne peuvent pas être contaminés : un malade ne contamine plus que R0 multiplié par la part de non vaccinés. Dès que ce produit passe sous 1, chaque malade est remplacé par moins d’un nouveau malade et la maladie s’éteint. Il suffit donc de vacciner une part 1 − 1/R0 de la population.');
    });

    // ================================================================ m4
    c.module('m4');
    c.chapter('Les lits d’hôpital', () => {
      c.stage('curve');
      c.diagram('beds');
      c.step('Une capacité limitée', `Dans la ville, ${pct(HOSP)} des contagieux ont besoin d’un lit d’hôpital, et la capacité hospitalière est de ${fr(BEDS)} lits. Dès que plus de ${fr(BEDS / HOSP)} habitants sont contagieux en même temps, des malades ne peuvent plus être soignés. Sans mesures, le pic demande ${fr(NOM.peak.beds)} lits : l’hôpital manque de lits pendant ${fr(NOM.overflowDays)} jours.`, {
        claims: [{ text: `pic : ${fr(NOM.peak.beds)} lits`, check: () => NOM.peak.beds > 2 * BEDS || fr(NOM.peak.beds) }],
      });
      c.set(PLAN);
      c.step('Aplatir la courbe', `La ville décide de réduire les contacts de ${pct(PLAN.cut)} à partir du jour ${fr(PLAN.start)}. Le pic ne demande plus que ${fr(PLANNED.peak.beds)} lits, et il arrive le jour ${fr(PLANNED.peak.t)} au lieu du jour ${fr(NOM.peak.t)}. C’est ce qu’on appelle aplatir la courbe : moins de malades en même temps, et ${pct(PLANNED.attack)} de la ville infectée au lieu de ${pct(NOM.attack)}.`, {
        claims: [{ text: 'le plan tient l’hôpital', check: () => PLANNED.outcome === 'contained' || PLANNED.outcome }],
      });
      c.question('q-flat', 'Aplatir la courbe sert d’abord à…', ['rester sous la capacité hospitalière', 'faire disparaître la maladie', 'raccourcir la durée de l’épidémie', 'rendre la maladie moins grave'], 'Le pic plus bas permet de soigner tous les malades qui ont besoin d’un lit ; l’épidémie dure en revanche plus longtemps.');
    });
    c.chapter('Le moment des mesures', () => {
      c.stage('curve');
      c.diagram('beds');
      c.ask('q-delay', 'La ville prend les mêmes mesures, mais quinze jours plus tard. Au début des mesures, les contagieux sont…', ['environ dix fois plus nombreux', 'un peu plus nombreux', 'aussi nombreux', 'deux fois plus nombreux'], 'Quinze jours font presque quatre doublements : 2⁴ = 16, un peu moins en réalité car la croissance commence à ralentir.');
      c.step('Quinze jours qui comptent', `Le jour ${fr(PLAN.start)}, la ville compte ${fr(AT25)} contagieux ; le jour ${fr(PLAN.start + 15)}, ${fr(AT40)}. Des mesures prises quinze jours plus tard partent d’un nombre de malades ${fr(AT40 / AT25)} fois plus grand. Elles freinent la croissance à partir de là, mais elles ne font pas disparaître les malades déjà là.`, {
        claims: [{ text: 'environ dix fois plus', check: () => (AT40 / AT25 > 8 && AT40 / AT25 < 13) || fr(AT40 / AT25, 1) }],
      });
      c.experiment({
        title: 'La force et le moment', prompt: 'Faites varier la réduction des contacts et le jour où elle commence. Regardez le pic par rapport à la ligne des lits.',
        predict: { question: 'Des mesures au jour 45 réduisent les contacts de 70 %. L’hôpital…', choices: ['manque de lits quand même', 'tient sans difficulté', 'reste presque vide'], answer: 0 },
        controls: [
          { type: 'range', key: 'cut', label: 'réduction des contacts', min: 0, max: 0.8, step: 0.05, fmt: pct },
          { type: 'range', key: 'start', label: 'début des mesures (jour)', min: 10, max: 80, step: 5, fmt: dec(0) },
        ],
        goals: [
          { label: 'Avec des mesures au jour 25 au plus tard, trouvez une réduction trop faible pour tenir l’hôpital', test: ({ v }) => v.start <= 25 && !isHeld(v) },
          { label: 'Trouvez un réglage qui tient l’hôpital', test: ({ v }) => isHeld(v) },
          { label: 'Avec une réduction d’au moins 70 %, trouvez un début si tardif que l’hôpital déborde', test: ({ v }) => v.cut >= 0.7 && !isHeld(v) },
        ],
        seq: true, conclusion: 'Au jour 25, une réduction de 40 % suffit ; 20 % ne suffit jamais. À partir du jour 45, même 70 % ne suffisent plus : les malades sont déjà trop nombreux. La force des mesures et leur date comptent toutes les deux.',
      });
      c.exercise('timeline', 'Dans l’atelier, remettez dans l’ordre les événements d’une année sans mesures.');
      c.exercise('assembly', 'Dans l’atelier, faites tourner votre modèle SIR sur toute l’épidémie.');
      c.explain('e-timing', 'Deux villes réduisent leurs contacts de 60 %, l’une au jour 25, l’autre au jour 50. Expliquez pourquoi la seconde manque de lits et pas la première.', 'Avant les mesures, le nombre de contagieux double environ tous les quatre jours. Au jour 50, il est donc bien plus grand qu’au jour 25, et l’hôpital est déjà plein. Les mesures font passer le R effectif sous 1 et le nombre de malades se met à baisser, mais il part de trop haut : il faut attendre que les malades déjà là guérissent.');
    });
    c.clinicCase({
      id: 'clin-late', title: 'des mesures qui arrivent après la vague', scene: 'curve', fault: { start: 50 },
      observe: `Pendant sept semaines, les cas doublent environ tous les quatre jours. Les lits manquent à partir du jour ${fr(LATE.days.find((d) => d.beds > BEDS)!.t)}. Le pic arrive le jour ${fr(LATE.peak.t)}, puis la courbe redescend vite. Les contacts sont bien réduits de moitié, comme prévu.`,
      choices: ['les mesures, prises trop tard', 'la réduction des contacts, trop faible', 'la maladie, plus contagieuse que prévu'],
      explain: 'Le pic arrive le jour même du début des mesures : elles ont fait effet, mais trop tard.',
      controls: [
        { type: 'range', key: 'start', label: 'début des mesures (jour)', min: 10, max: 80, step: 5, fmt: dec(0) },
        { type: 'range', key: 'cut', label: 'réduction des contacts', min: 0, max: 0.8, step: 0.05, fmt: pct },
      ],
      goal: { label: 'L’hôpital ne manque jamais de lits', test: (v) => isHeld(v) },
      conclusion: 'Avec des mesures au jour 40 au plus tard, la même réduction de moitié tient l’hôpital.',
      justify: `Le symptôme : la croissance est normale jusqu’au jour 50, puis la courbe se retourne aussitôt, mais l’hôpital déborde déjà. La cause : des mesures commencées au jour 50 au lieu du jour 25. Pendant ces vingt-cinq jours, le nombre de contagieux a été multiplié par plus de vingt ; les mesures ramènent le R effectif sous 1, mais trop tard pour éviter la saturation.`,
    });
    c.clinicCase({
      id: 'clin-weak', title: 'des mesures prises à temps qui ne suffisent pas', scene: 'curve', fault: { cut: 0.2 },
      observe: `Les mesures commencent comme prévu au jour ${fr(PLAN.start)}. La croissance ralentit à peine : la courbe continue de monter pendant plus d’un mois, le pic arrive le jour ${fr(WEAK.peak.t)} et les lits manquent pendant ${fr(WEAK.overflowDays)} jours.`,
      choices: ['la réduction des contacts, trop faible', 'les mesures, prises trop tard', 'la maladie, plus contagieuse que prévu'],
      explain: 'Les mesures commencent à la bonne date, mais la courbe ne se retourne pas : le R effectif reste au-dessus de 1.',
      controls: [
        { type: 'range', key: 'cut', label: 'réduction des contacts', min: 0, max: 0.8, step: 0.05, fmt: pct },
        { type: 'range', key: 'start', label: 'début des mesures (jour)', min: 10, max: 80, step: 5, fmt: dec(0) },
      ],
      goal: { label: 'L’hôpital ne manque jamais de lits', test: (v) => isHeld(v) },
      conclusion: 'Avec une réduction d’au moins 40 % au jour 25, la courbe se retourne et l’hôpital tient.',
      justify: `Le symptôme : la croissance ralentit sans s’arrêter après le début des mesures. La cause : une réduction des contacts de 20 % seulement. R0 passe de ${fr(R0, 1)} à ${fr(R0 * 0.8, 2)} : le R effectif reste au-dessus de 1, chaque malade est encore remplacé par plus d’un nouveau malade, et la courbe continue de monter jusqu’à ce que les susceptibles manquent.`,
    });

    // ============================================================== exam
    c.module('exam');
    c.clinicCase({
      id: 'exam-variant', exam: true, title: 'un hôpital débordé avant même les mesures', scene: 'curve', fault: { p: 0.045 },
      observe: `Dès les premiers jours, les cas doublent tous les ${fr(doublingTime(VARIANT_R0, BASE.dur), 1)} jours environ, deux fois plus vite que d’habitude. Le jour ${fr(PLAN.start)}, quand la réduction des contacts de moitié commence, la ville compte déjà ${fr(VARIANT.atStart)} contagieux et l’hôpital déborde.`,
      choices: ['la maladie, plus contagieuse que prévu', 'les mesures, prises trop tard', 'la réduction des contacts, trop faible'],
      explain: 'La croissance est deux fois plus rapide dès le premier jour, avant toute mesure : c’est la transmission elle-même qui a changé.',
      controls: [
        { type: 'range', key: 'p', label: 'probabilité par contact (masques)', min: 0.01, max: 0.06, step: 0.005, fmt: dec(3) },
        { type: 'range', key: 'start', label: 'début des mesures (jour)', min: 10, max: 80, step: 5, fmt: dec(0) },
      ],
      goal: { label: 'L’hôpital ne manque jamais de lits', test: (v) => isHeld(v) },
      conclusion: 'Avec une probabilité de transmission de 0,03 au plus, par exemple grâce au masque porté dès le début, l’hôpital tient. Avancer seulement les mesures ne suffit pas.',
      justify: `Le symptôme : un doublement en deux jours dès le début, avant les mesures. La cause : une probabilité de transmission de 0,045 au lieu de 0,03, qui fait passer R0 à ${fr(VARIANT_R0, 1)}. L’épidémie atteint presque son pic avant le jour ${fr(PLAN.start)} ; réduire les contacts de moitié laisse R0 à ${fr(VARIANT_R0 / 2, 1)}. Le masque, en réduisant la probabilité de transmission dès le départ, ramène la croissance à son rythme habituel.`,
    });
    c.chapter('Test final', () => {
      c.stage('town');
      c.step('Le test final', 'Ce test reprend les notions du test de départ, dans d’autres situations. Comparez ensuite vos deux résultats, notion par notion.');
      c.test('post', 'Le test final.');
    });
  },
});

export default Object.assign(course, { workshop });
