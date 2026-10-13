// Comment fonctionne une fusée : the course written to test coursekit on a
// subject that is not about programming. A lycée-level learner follows a
// two-stage launcher from the pad to orbit: thrust, the rocket equation,
// staging, orbits, the atmosphere and the gravity turn. The figures of the
// text, the diagrams, the stage and the exercises all run ./model.ts.

import { choice, defineCourse, numeric, type Capsule } from '@coursekit/core';
import { pickCapsules } from '@coursekit/diagrams';
import { choiceQ, type Exercise, type WorkshopConfig } from '@coursekit/exercises';
import { DIAGRAMS, fr } from './diagrams.ts';
import {
  FLIGHT, G0, LAUNCHER, OUTCOME, flightOf, gravity, liftoffMass, model, orbitalSpeed, singleStage, stageDeltaV,
  tsiolkovsky, verticalFlight, type Stage,
} from './model.ts';

const int = (v: number) => fr(v);
const dec = (n: number) => (v: number) => fr(v, n);
const pct = (v: number) => `${Math.round(v * 100)} %`;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const near = (a: number, b: number, rel = 0.03) => Math.abs(a - b) <= Math.abs(b) * rel;

const S1 = LAUNCHER.stages[0], S2 = LAUNCHER.stages[1];
const M0 = liftoffMass(LAUNCHER);
const DV = stageDeltaV(LAUNCHER);
const NOMINAL = flightOf({});
/** mass above the first stage: what it carries */
const UPPER = S2.dry + S2.fuel + LAUNCHER.payload;

// ------------------------------------------------------------- toolbox

/** Two capsules of the course's own, next to the library's T4. */
const CAPSULES: Capsule[] = [
  {
    id: 'N1', title: 'Forces et accélération',
    goal: 'Additionner des forces de même direction et en déduire l’accélération avec a = F/m.',
    used: 'Le décollage : la poussée, le poids et l’accélération qui en résulte.',
    steps: [
      { title: 'La somme des forces', diagram: 'forces', text: 'Quand plusieurs forces agissent sur un objet le long d’une même droite, on les additionne en comptant positivement celles qui vont vers le haut et négativement celles qui vont vers le bas. Le résultat s’appelle la force résultante.' },
      { title: 'La deuxième loi de Newton', text: 'La force résultante F donne à un objet de masse m une accélération a = F/m. Une même force accélère dix fois moins un objet dix fois plus lourd. Si la résultante est nulle, la vitesse ne change pas.', code: 'a = (poussée − poids) / m' },
      { title: 'Le poids', text: 'Le poids d’un objet de masse m vaut m·g, où g ≈ 9,81 m/s² près du sol. Il est dirigé vers le centre de la Terre. On écrit souvent l’accélération d’une fusée qui monte à la verticale a = poussée/m − g.', code: 'poids = m * 9.81   // en newtons' },
    ],
    check: [
      numeric('Une force résultante de 600 N agit sur un objet de 200 kg. Quelle est son accélération, en m/s² ?', 3, '600 / 200 = 3 m/s².', { unit: 'm/s²' }),
      choice('Un objet de 10 kg est poussé vers le haut avec une force de 98,1 N. Que se passe-t-il ?', ['la poussée compense juste le poids', 'il accélère vers le haut', 'il tombe en accélérant', 'il accélère vers le bas'], 'Le poids vaut 10 × 9,81 = 98,1 N : la résultante est nulle.'),
    ],
  },
  {
    id: 'L1', title: 'Le logarithme népérien',
    goal: 'Calculer ln x avec une calculatrice et utiliser ln(a·b) = ln a + ln b.',
    used: 'L’équation de la fusée : Δv = ve·ln(m0/mf).',
    steps: [
      { title: 'Une fonction qui croît lentement', diagram: 'ln', text: 'La fonction ln est définie pour x > 0. Elle vaut 0 en 1, et elle croît de plus en plus lentement : ln 10 ≈ 2,30, ln 100 ≈ 4,61. Elle est la réciproque de l’exponentielle : ln(eˣ) = x, avec e ≈ 2,718.' },
      { title: 'Produits et sommes', diagram: 'ln', text: 'La propriété principale du logarithme : ln(a·b) = ln a + ln b. Multiplier x par 2 ajoute donc toujours ln 2 ≈ 0,69, que x vaille 3 ou 300. Pour doubler ln x, il faut élever x au carré.', code: 'ln(4) = ln(2) + ln(2) ≈ 1,39' },
      { title: 'À la calculatrice', text: 'La touche « ln » donne le logarithme népérien (attention : la touche « log » donne le logarithme décimal, qui est un autre nombre). En programmation, on écrit Math.log(x) en JavaScript.', code: 'Math.log(7.39)   // ≈ 2' },
    ],
    check: [
      numeric('Que vaut ln(e³) ?', 3, 'ln est la réciproque de l’exponentielle : ln(e³) = 3.'),
      choice('ln 5 ≈ 1,61. Que vaut ln 25 ?', ['environ 3,22', 'environ 2,59', 'environ 8,05', 'environ 1,61'], '25 = 5 × 5, donc ln 25 = ln 5 + ln 5 ≈ 3,22.'),
    ],
  },
];

// ----------------------------------------------------------- exercises

const stepPreview = (ctx: CanvasRenderingContext2D, fn: Function | null) => {
  ctx.fillStyle = '#7c9cff'; ctx.font = '11px Inter, sans-serif';
  if (!fn) { ctx.fillText('écrivez votre fonction', 20, 20); return; }
  let mine: number[] = [];
  try { mine = verticalFlight(S2, LAUNCHER.payload, fn as never); } catch { ctx.fillText('votre fonction lève une erreur', 20, 20); return; }
  const ref = verticalFlight(S2, LAUNCHER.payload);
  const H = Math.max(...ref) * 1.1, T = ref.length;
  const curve = (r: number[], col: string) => {
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
    r.forEach((h, i) => { const X = 30 + (i / T) * 320, Y = 210 - (Math.max(0, Math.min(H, h)) / H) * 180; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
    ctx.stroke();
  };
  curve(ref, 'rgba(124,156,255,.6)');
  curve(mine, '#ffb35c');
  ctx.fillStyle = '#e6eaf5';
  ctx.fillText('altitude du second étage seul (sans air)', 30, 18);
  ctx.fillStyle = '#ffb35c'; ctx.fillText('votre calcul', 30, 34);
  ctx.fillStyle = '#7c9cff'; ctx.fillText('référence', 110, 34);
};

/** Three rockets to test a Δv function on. */
const TEST_ROCKETS: { name: string; stages: Stage[]; payload: number }[] = [
  { name: 'le lanceur du cours', stages: LAUNCHER.stages, payload: LAUNCHER.payload },
  { name: 'le même en un seul étage', stages: singleStage(LAUNCHER).stages, payload: LAUNCHER.payload },
  { name: 'un lanceur à trois étages', stages: [{ dry: 20_000, fuel: 200_000, thrust: 3e6, ve: 2700 }, { dry: 5_000, fuel: 40_000, thrust: 7e5, ve: 3100 }, { dry: 1_000, fuel: 8_000, thrust: 1e5, ve: 3400 }], payload: 1_000 },
];

const exercises: Exercise[] = [
  {
    id: 'twr', module: 'm1', kind: 'calculation', title: 'Le décollage du lanceur',
    intro: `Le lanceur du cours pèse ${fr(M0 / 1000)} t au décollage. Ses moteurs du premier étage poussent avec une force de ${fr(S1.thrust / 1e6, 1)} MN (méganewtons, millions de newtons). On prend g = 9,81 m/s².`,
    steps: [
      { prompt: 'Que vaut son poids, en MN ?', value: (M0 * G0) / 1e6, unit: 'MN', explain: `${fr(M0)} × 9,81 ≈ ${fr(M0 * G0 / 1e6, 2)} millions de newtons.` },
      { prompt: 'Que vaut le rapport poussée / poids ?', value: S1.thrust / (M0 * G0), explain: `${fr(S1.thrust / 1e6, 1)} / ${fr(M0 * G0 / 1e6, 2)} ≈ ${fr(S1.thrust / (M0 * G0), 2)} : il est plus grand que 1, la fusée décolle.` },
      { prompt: 'Quelle est son accélération au moment du décollage, en m/s² ?', value: S1.thrust / M0 - G0, unit: 'm/s²', explain: `a = poussée/m − g = ${fr(S1.thrust / M0, 2)} − 9,81 ≈ ${fr(S1.thrust / M0 - G0, 2)} m/s².` },
    ],
    win: 'Au départ, la fusée accélère lentement : environ un tiers de g.',
  },
  {
    id: 'climb', module: 'm1', kind: 'code', title: 'Un pas de vol vertical', slot: 'step',
    sig: 'function step(s, dt, thrust, ve, g)',
    doc: 's : l’état {h, v, m} (altitude en m, vitesse verticale en m/s, masse en kg) · dt : la durée du pas (s) · thrust : la poussée (N) · ve : la vitesse d’éjection (m/s) · g : la pesanteur (m/s²). Pas d’air dans cet exercice.',
    goal: 'Calculez l’accélération a = thrust/m − g, mettez à jour la vitesse, puis l’altitude avec la nouvelle vitesse, et enfin retirez de la masse l’ergol brûlé pendant dt : (thrust/ve)·dt.',
    solution: `function step(s, dt, thrust, ve, g) {
  const a = thrust / s.m - g;
  s.v += a * dt;
  s.h += s.v * dt;
  s.m -= (thrust / ve) * dt;
}`,
    starter: `function step(s, dt, thrust, ve, g) {
  // 1. l'accélération : poussée divisée par la masse, moins g
  // 2. la vitesse change de a·dt
  // 3. l'altitude avance avec la nouvelle vitesse
  // 4. la masse diminue du débit multiplié par dt
}`,
    hints: [
      'Le débit d’ergol vaut thrust / ve, en kilogrammes par seconde.',
      'Ordre des lignes : a, puis s.v, puis s.h, puis s.m.',
      's.m -= (thrust / ve) * dt : la masse baisse à chaque pas.',
    ],
    win: 'Votre fusée monte exactement comme celle de la référence, et s’allège au même rythme.',
    primm: {
      intro: 'Voici un pas de vol vertical incomplet. Lisez-le avant de l’exécuter.',
      code: `function step(s, dt, thrust, ve, g) {
  const a = thrust / s.m - g;
  s.v += a * dt;
  s.h += s.v * dt;
}`,
      predict: choiceQ('Avec ce code, comment évolue l’accélération pendant le vol ?', ['elle reste constante', 'elle augmente peu à peu', 'elle diminue peu à peu'], 'La masse s.m ne change jamais : thrust/s.m − g garde la même valeur à chaque pas.'),
      investigate: choiceQ('Que fait une fusée réelle que ce code oublie ?', ['elle perd la masse de l’ergol brûlé', 'elle subit une pesanteur plus forte', 'elle perd de la poussée en montant'], 'Le moteur éjecte (thrust/ve) kilogrammes de gaz chaque seconde.'),
      modify: 'Ajoutez la ligne qui fait diminuer la masse.',
    },
    preview: (ctx, fn) => stepPreview(ctx, fn),
  },
  {
    id: 'dv', module: 'm2', kind: 'calculation', title: 'Le Δv du second étage',
    intro: `Le second étage du lanceur pèse ${fr(S2.dry / 1000)} t à vide et emporte ${fr(S2.fuel / 1000)} t d’ergol ; la charge utile pèse ${fr(LAUNCHER.payload / 1000)} t. La vitesse d’éjection de son moteur vaut ${fr(S2.ve)} m/s.`,
    steps: [
      { prompt: 'Que vaut le rapport de masse m0/mf (plein / vide, charge utile comprise) ?', value: (S2.dry + S2.fuel + LAUNCHER.payload) / (S2.dry + LAUNCHER.payload), explain: `m0 = ${fr(S2.dry + S2.fuel + LAUNCHER.payload)} kg, mf = ${fr(S2.dry + LAUNCHER.payload)} kg : le rapport vaut environ ${fr((S2.dry + S2.fuel + LAUNCHER.payload) / (S2.dry + LAUNCHER.payload), 2)}.` },
      { prompt: 'Que vaut le logarithme népérien de ce rapport ?', value: Math.log((S2.dry + S2.fuel + LAUNCHER.payload) / (S2.dry + LAUNCHER.payload)), explain: `ln(${fr((S2.dry + S2.fuel + LAUNCHER.payload) / (S2.dry + LAUNCHER.payload), 2)}) ≈ ${fr(Math.log((S2.dry + S2.fuel + LAUNCHER.payload) / (S2.dry + LAUNCHER.payload)), 3)}.` },
      { prompt: 'Que vaut le Δv de l’étage, en m/s ?', value: DV[1], unit: 'm/s', explain: `${fr(S2.ve)} × ${fr(Math.log((S2.dry + S2.fuel + LAUNCHER.payload) / (S2.dry + LAUNCHER.payload)), 3)} ≈ ${fr(DV[1])} m/s.` },
    ],
    win: `Le second étage peut à lui seul donner environ ${fr(DV[1] / 1000, 1)} km/s.`,
  },
  {
    id: 'deltaV', module: 'm2', kind: 'code', title: 'Le Δv d’un lanceur', slot: 'deltaV', standalone: true, parsons: true,
    sig: 'function deltaV(stages, payload)',
    doc: 'stages : la liste des étages, du premier (en bas) au dernier, chacun {dry, fuel, thrust, ve} (masses en kg, vitesse d’éjection en m/s) · payload : la charge utile (kg). Renvoie le Δv idéal total, en m/s.',
    goal: 'Partez du dernier étage. Pour chacun, la masse au-dessus de lui (les étages supérieurs et la charge utile) fait partie de m0 et de mf. Ajoutez le Δv de l’étage au total, puis remontez d’un cran.',
    solution: `function deltaV(stages, payload) {
  let total = 0;
  let above = payload;
  for (let i = stages.length - 1; i >= 0; i--) {
    const s = stages[i];
    const m0 = above + s.dry + s.fuel;
    const mf = above + s.dry;
    total += s.ve * Math.log(m0 / mf);
    above = m0;
  }
  return total;
}`,
    starter: `function deltaV(stages, payload) {
  let total = 0;
  // pour chaque étage, du dernier au premier :
  //   m0 = (masse au-dessus) + vide + ergol ; mf = (masse au-dessus) + vide
  //   total += ve · ln(m0 / mf)
  return total;
}`,
    hints: [
      'La boucle descend : for (let i = stages.length - 1; i >= 0; i--).',
      'La masse au-dessus du dernier étage est la charge utile ; au-dessus de l’avant-dernier, c’est le dernier étage plein, plus la charge utile.',
      'Après avoir traité un étage, la masse au-dessus devient son m0.',
    ],
    tests: TEST_ROCKETS.map((r) => ({
      label: r.name,
      run: (fn: Function) => {
        const want = sum(stageDeltaV({ ...LAUNCHER, stages: r.stages, payload: r.payload }));
        const got = fn(r.stages.map((s) => ({ ...s })), r.payload);
        return typeof got === 'number' && Math.abs(got - want) < 1e-6 ? null : `attendu ${fr(want)} m/s, obtenu ${typeof got === 'number' ? fr(got) : String(got)}`;
      },
    })),
    win: 'Votre fonction calcule le Δv de n’importe quel lanceur, quel que soit son nombre d’étages.',
  },
  {
    id: 'orbit', module: 'm3', kind: 'calculation', title: 'Une orbite à 200 km',
    intro: 'On cherche la vitesse d’un satellite en orbite circulaire à 200 km d’altitude, puis la durée d’un tour. On prend GM = 3,986 × 10¹⁴ m³/s² et le rayon de la Terre R = 6 371 km.',
    steps: [
      { prompt: 'Quelle est la distance r du satellite au centre de la Terre, en km ?', value: 6571, unit: 'km', tol: 1, explain: '6 371 + 200 = 6 571 km, soit 6 571 000 m.' },
      { prompt: 'Que vaut v = √(GM/r), en m/s ?', value: orbitalSpeed(200_000), unit: 'm/s', explain: `√(3,986 × 10¹⁴ / 6 571 000) ≈ ${fr(orbitalSpeed(200_000))} m/s.` },
      { prompt: 'Combien de minutes dure un tour (2πr / v) ?', value: (2 * Math.PI * 6_571_000) / orbitalSpeed(200_000) / 60, unit: 'min', explain: `2π × 6 571 000 / ${fr(orbitalSpeed(200_000))} ≈ ${fr((2 * Math.PI * 6_571_000) / orbitalSpeed(200_000))} s, soit environ ${fr((2 * Math.PI * 6_571_000) / orbitalSpeed(200_000) / 60)} minutes.` },
    ],
    win: 'Un satellite à 200 km fait le tour de la Terre en un peu moins d’une heure et demie.',
  },
  {
    id: 'losses', module: 'm4', kind: 'classify', title: 'Ce qui aide, ce qui coûte',
    intro: 'Pour chaque changement apporté au lanceur ou à son vol, dites s’il augmente ou s’il diminue la vitesse atteinte à la fin de la propulsion (les autres réglages restant les mêmes).',
    categories: ['augmente la vitesse finale', 'diminue la vitesse finale'],
    items: [
      { text: 'un moteur avec une plus grande vitesse d’éjection', cat: 0 },
      { text: 'monter très longtemps à la verticale', cat: 1, why: 'la poussée lutte contre le poids au lieu d’accélérer à l’horizontale' },
      { text: 'larguer le premier étage une fois vide', cat: 0 },
      { text: 'une charge utile plus lourde', cat: 1 },
      { text: 'un basculement très fort dans l’air dense', cat: 1, why: 'la fusée va vite trop bas, la traînée la freine' },
      { text: 'un étage supérieur plus léger à vide', cat: 0 },
    ],
    win: 'Le vol réussi combine un bon lanceur (vitesse d’éjection, étages légers) et une bonne trajectoire.',
  },
  {
    id: 'events', module: 'm4', kind: 'sequence', title: 'Les étapes du vol',
    intro: 'Remettez dans l’ordre les événements du vol nominal du lanceur.',
    items: ['allumage et décollage', 'basculement', 'pression dynamique maximale', 'séparation du premier étage', 'arrêt des moteurs à la vitesse orbitale'],
    explain: 'Le basculement a lieu dès 100 m/s ; la pression dynamique est maximale vers une minute de vol ; le premier étage est largué vide ; le second s’arrête quand la vitesse d’orbite est atteinte.',
    win: 'C’est l’ordre de tous les lancements vers l’orbite.',
  },
];

const workshop: WorkshopConfig = {
  scenarios: [
    { name: 'second étage seul, à la verticale', run: (impl) => verticalFlight(S2, LAUNCHER.payload, impl.step as never), tol: 1e-6, unit: 'm' },
    { name: 'premier étage, avec tout le reste au-dessus', run: (impl) => verticalFlight(S1, UPPER, impl.step as never), tol: 1e-6, unit: 'm' },
  ],
  assembly: {
    title: 'Mon vol vertical',
    intro: 'Votre fonction step fait voler le second étage seul, sans air. Le Δv calculé par votre fonction deltaV est vérifié sur ses tests.',
    chart: { label: 'altitude (m)', unit: 'm', run: (impl) => verticalFlight(S2, LAUNCHER.payload, impl.step as never) },
  },
};

// --------------------------------------------------------------- course

const flightHud = (v: Record<string, number>) => {
  const f = flightOf(v);
  return `basculement ${fr(v.kick, 1)}° · ${OUTCOME[f.outcome]}`;
};
const isOrbit = (v: Record<string, number>) => flightOf(v).outcome === 'orbit';

const course = defineCourse({
  id: 'fusee', version: 1, language: 'fr',
  title: 'Comment fonctionne une fusée',
  lead: 'De la poussée des moteurs jusqu’à l’orbite : pourquoi une fusée décolle, pourquoi elle a plusieurs étages, pourquoi un satellite ne retombe pas, et pourquoi la fusée s’incline juste après le décollage. Chaque chiffre du cours est calculé par une petite simulation que vous pouvez faire varier.',
  audience: { level: 'lycée', prerequisites: 'Vitesse, accélération et forces (seconde) ; les puissances de dix. Le logarithme est rappelé dans une fiche.', effort: 'trois à quatre heures' },
  modules: [
    {
      id: 'm1', title: 'Pousser pour monter', pitch: 'D’où vient la poussée d’un moteur, et à quelle condition une fusée décolle.',
      goals: ['Expliquer la poussée par l’éjection de gaz', 'Calculer le rapport poussée / poids et dire si une fusée décolle', 'Programmer un pas de vol vertical'],
      summary: ['La fusée pousse les gaz vers le bas ; les gaz poussent la fusée vers le haut. Cela fonctionne dans le vide.', 'Poussée = débit d’ergol × vitesse d’éjection.', 'La fusée décolle si sa poussée dépasse son poids : rapport poussée / poids > 1.', 'La masse diminue pendant le vol : à poussée constante, l’accélération augmente.'],
    },
    {
      id: 'm2', title: 'L’équation de la fusée', pitch: 'Combien de vitesse une fusée peut gagner avec son ergol, et pourquoi on la découpe en étages.',
      goals: ['Calculer un Δv avec l’équation de Tsiolkovsky', 'Expliquer pourquoi les lanceurs ont plusieurs étages'],
      summary: ['Δv = ve · ln(m0/mf) : le gain de vitesse dépend de la vitesse d’éjection et du rapport des masses.', 'Le logarithme croît lentement : doubler l’ergol ne double pas le Δv.', 'Un étage vide est un poids mort ; le larguer permet au reste d’accélérer davantage.'],
    },
    {
      id: 'm3', title: 'Tourner autour de la Terre', pitch: 'Ce qu’est une orbite, et à quelle vitesse il faut aller pour y rester.',
      goals: ['Expliquer pourquoi un satellite ne retombe pas', 'Calculer la vitesse d’une orbite circulaire'],
      summary: ['Un satellite tombe en permanence, mais il va assez vite à l’horizontale pour que le sol se dérobe sous lui.', 'Vitesse d’une orbite circulaire : v = √(GM/r), environ 7,8 km/s à 200 km.', 'Trop lent, il retombe ; plus rapide, l’orbite devient une ellipse ; au-delà de √2 fois cette vitesse, il s’éloigne.'],
    },
    {
      id: 'm4', title: 'Le vol jusqu’à l’orbite', pitch: 'La traversée de l’atmosphère, le basculement et le bilan complet d’un lancement.',
      goals: ['Expliquer le rôle du basculement', 'Faire le bilan des pertes d’un lancement', 'Diagnostiquer un lancement raté'],
      summary: ['L’orbite demande surtout de la vitesse horizontale : la fusée monte d’abord, puis s’incline progressivement.', 'Pertes par gravité : la poussée qui sert à lutter contre le poids n’accélère pas la fusée.', 'Il faut environ 9,4 km/s de Δv pour atteindre 7,8 km/s en orbite basse.', 'Un basculement trop faible gaspille de l’ergol à monter ; trop fort, la fusée reste dans l’air dense.'],
    },
    { id: 'exam', title: 'Épreuve', kind: 'exam', pitch: 'Un lancement raté à diagnostiquer seul, et le test final.', goals: ['Diagnostiquer seul un cas inconnu'], summary: ['Observer, supposer, corriger un seul réglage, justifier.'] },
  ],
  glossary: [
    { id: 'thrust', name: 'poussée', def: 'Force exercée sur la fusée par les gaz qu’elle éjecte. Elle vaut le débit d’ergol multiplié par la vitesse d’éjection.', module: 'm1' },
    { id: 'propellant', name: 'ergol', forms: ['ergols'], def: 'Ce que brûle le moteur : un carburant et un comburant (par exemple kérosène et oxygène liquide).', module: 'm1' },
    { id: 've', name: 'vitesse d’éjection', def: 'Vitesse des gaz à la sortie de la tuyère, par rapport à la fusée. De 2 500 à 4 500 m/s selon les moteurs.', module: 'm1' },
    { id: 'flow', name: 'débit', def: 'Masse d’ergol brûlée chaque seconde, en kg/s.', module: 'm1' },
    { id: 'twr', name: 'rapport poussée / poids', def: 'Poussée divisée par le poids. Plus grand que 1 : la fusée décolle.', tool: 'N1', module: 'm1' },
    { id: 'payload', name: 'charge utile', def: 'Ce que la fusée doit mettre en orbite : un satellite, une capsule.', module: 'm1' },
    { id: 'dv', name: 'Δv', forms: ['delta-v'], def: 'Gain de vitesse qu’une fusée peut obtenir en brûlant son ergol, sans air ni pesanteur.', module: 'm2' },
    { id: 'tsio', name: 'équation de Tsiolkovsky', forms: ['Tsiolkovsky'], def: 'Δv = ve · ln(m0/mf), où m0 est la masse pleine et mf la masse une fois l’ergol brûlé.', tool: 'L1', module: 'm2' },
    { id: 'ratio', name: 'rapport de masse', def: 'Masse pleine divisée par masse vide, m0/mf.', module: 'm2' },
    { id: 'stage', name: 'étage', forms: ['étages'], def: 'Partie d’un lanceur avec ses réservoirs et ses moteurs, larguée une fois vide.', module: 'm1' },
    { id: 'vorb', name: 'vitesse orbitale', def: 'Vitesse d’une orbite circulaire : √(GM/r). Environ 7,8 km/s à 200 km d’altitude.', module: 'm3' },
    { id: 'apo', name: 'apogée', def: 'Point le plus haut d’une orbite en ellipse.', module: 'm3' },
    { id: 'peri', name: 'périgée', def: 'Point le plus bas d’une orbite en ellipse. Sous 100 km environ, l’air freine le satellite qui finit par retomber.', module: 'm3' },
    { id: 'drag', name: 'traînée', def: 'Force de l’air qui freine la fusée : ½·ρ·v²·Cd·A.', module: 'm4' },
    { id: 'maxq', name: 'pression dynamique', def: 'q = ½·ρ·v² : elle mesure l’effort de l’air sur la fusée. Elle passe par un maximum vers une minute de vol.', module: 'm4' },
    { id: 'kick', name: 'basculement', def: 'Petite inclinaison donnée à la fusée juste après le décollage ; ensuite la pesanteur courbe la trajectoire (virage gravitationnel).', module: 'm4' },
    { id: 'gloss', name: 'pertes par gravité', def: 'Part du Δv dépensée à lutter contre le poids au lieu d’accélérer la fusée.', module: 'm4' },
  ],
  toolbox: [...pickCapsules(['T4', 'Le calcul pas à pas du vol d’une fusée.']), ...CAPSULES],
  tests: {
    tools: [
      { id: 'a1', skill: 'Forces et accélération', tool: 'N1', q: numeric('Une force résultante de 1 500 N agit sur un objet de 500 kg. Quelle est son accélération, en m/s² ?', 3, '1 500 / 500 = 3 m/s².', { unit: 'm/s²' }) },
      { id: 'a2', skill: 'Le logarithme', tool: 'L1', q: choice('ln 2 ≈ 0,69. Que vaut ln 8 ?', ['environ 2,08', 'environ 5,52', 'environ 0,69', 'environ 1,38'], '8 = 2 × 2 × 2, donc ln 8 = 3 × ln 2 ≈ 2,08.') },
      { id: 'a3', skill: 'Calcul pas à pas', tool: 'T4', q: numeric('Une vitesse vaut 20 m/s ; l’accélération vaut 5 m/s². Que vaut la vitesse 0,2 s plus tard, en m/s ?', 21, '20 + 0,2 × 5 = 21 m/s.', { unit: 'm/s' }) },
    ],
    pre: [
      { id: 'b1', skill: 'L’origine de la poussée', q: choice('Une fusée peut-elle accélérer dans le vide, loin de toute atmosphère ?', ['oui, en éjectant des gaz vers l’arrière', 'non, elle n’a rien sur quoi s’appuyer', 'oui, grâce à l’attraction de la Lune', 'non, ses moteurs s’éteignent sans air'], 'Les gaz éjectés poussent la fusée en sens inverse : l’air n’est pas nécessaire.') },
      { id: 'b2', skill: 'Le décollage', q: choice('Une fusée de 100 t a des moteurs qui poussent avec 900 kN. Que se passe-t-il à l’allumage ?', ['elle reste sur le pas de tir', 'elle décolle lentement', 'elle décolle très vite', 'elle bascule sur le côté'], 'Son poids vaut 100 000 × 9,81 ≈ 981 kN : la poussée est plus faible.') },
      { id: 'b3', skill: 'L’équation de la fusée', q: choice('On double la masse d’ergol d’une fusée, sans rien changer d’autre. Son Δv…', ['augmente, mais ne double pas', 'double exactement', 'ne change pas du tout', 'diminue un peu'], 'Le Δv dépend du logarithme du rapport des masses, qui croît lentement.') },
      { id: 'b4', skill: 'L’orbite', q: choice('Pourquoi la Station spatiale internationale ne retombe-t-elle pas sur la Terre ?', ['elle va assez vite à l’horizontale', 'la pesanteur est nulle à son altitude', 'ses moteurs la soutiennent en permanence', 'l’air la porte comme un avion'], 'Elle tombe en permanence, mais sa vitesse horizontale fait que le sol se dérobe sous elle.') },
      { id: 'b5', skill: 'La trajectoire', q: choice('Pourquoi une fusée s’incline-t-elle peu après le décollage ?', ['l’orbite demande surtout de la vitesse horizontale', 'pour éviter de heurter la tour de lancement', 'pour que l’équipage voie l’horizon', 'parce que le vent la pousse'], 'Il faut atteindre 7,8 km/s à l’horizontale ; monter tout droit ne suffit pas.') },
    ],
    post: [
      { id: 'p1', pair: 'b1', skill: 'L’origine de la poussée', q: choice('Un astronaute immobile dans l’espace lance une clé vers l’avant. Que lui arrive-t-il ?', ['il part vers l’arrière', 'il reste immobile', 'il part vers l’avant', 'il se met à tourner sur place'], 'Comme une fusée : il pousse la clé, la clé le pousse en sens inverse.') },
      { id: 'p2', pair: 'b2', skill: 'Le décollage', q: choice('Une fusée de 50 t a un rapport poussée / poids de 1,5. Quelle est son accélération au décollage ?', ['environ 4,9 m/s²', 'environ 14,7 m/s²', 'environ 1,5 m/s²', 'environ 9,8 m/s²'], 'a = poussée/m − g = 1,5 g − g = 0,5 × 9,81 ≈ 4,9 m/s².') },
      { id: 'p3', pair: 'b3', skill: 'L’équation de la fusée', q: choice('Deux fusées ont le même rapport de masse ; la seconde a une vitesse d’éjection deux fois plus grande. Son Δv est…', ['deux fois plus grand', 'le même', 'quatre fois plus grand', 'un peu plus grand seulement'], 'Δv = ve · ln(m0/mf) est proportionnel à la vitesse d’éjection.') },
      { id: 'p4', pair: 'b4', skill: 'L’orbite', q: choice('Un satellite en orbite circulaire ralentit un peu. Que se passe-t-il ?', ['il descend vers la Terre', 'il continue sur la même orbite', 'il s’éloigne de la Terre', 'il s’arrête puis tombe à la verticale'], 'Trop lent pour son orbite, il tombe plus qu’il ne faut : sa trajectoire se rapproche de la Terre.') },
      { id: 'p5', pair: 'b5', skill: 'La trajectoire', q: choice('Une fusée bascule très fort juste après le décollage. Quel est le risque ?', ['rester trop bas, dans l’air dense', 'monter trop haut', 'dépasser la vitesse de libération', 'perdre un étage trop tôt'], 'Elle prend de la vitesse alors qu’elle est encore dans l’air dense : la traînée la freine et elle peut retomber.') },
    ],
  },
  diagrams: DIAGRAMS,
  stageKeys: ['thrust', 'payload', 'kick', 'single', 'drag'],
  scenes: { pad: 'Le décollage, vu de près', flight: 'Le vol complet, au-dessus de la Terre' },
  defaults: { thrust: 1, payload: LAUNCHER.payload, kick: FLIGHT.kick, single: 0, drag: 1, ratio: 4, ve: 3000, v0: 6 },
  model,
  exercises,
  rubric: [
    'Une justification complète décrit le symptôme (ce que fait la fusée), la cause (le réglage en défaut) et le mécanisme qui relie les deux.',
    'Elle s’appuie sur une grandeur du cours : rapport poussée / poids, Δv, vitesse orbitale, pertes.',
  ],
  content(c) {
    // ================================================================ m1
    c.module('m1');
    c.chapter('Le problème à résoudre', () => {
      c.stage('flight');
      c.step('Mettre un satellite en orbite', 'Une fusée doit emmener un satellite à environ 200 km d’altitude et lui donner une vitesse d’environ 7,8 km/s, soit 28 000 km/h, à l’horizontale. Monter à 200 km est la partie facile ; atteindre cette vitesse est la partie difficile. En arrière-plan, le vol complet du lanceur de ce cours, calculé par une simulation.', {
        claims: [{ text: '7,8 km/s à 200 km', check: () => near(orbitalSpeed(200_000), 7800, 0.01) || `v = ${fr(orbitalSpeed(200_000))} m/s` }, { text: 'le lanceur atteint l’orbite', check: () => NOMINAL.outcome === 'orbit' || NOMINAL.outcome }],
      });
      c.test('pre', 'Avant de commencer, un court test : il mesure ce que vous savez déjà, pour le comparer au test final.');
      c.step('Le lanceur du cours', `Le lanceur étudié est imaginaire mais réaliste : ${fr(M0 / 1000)} tonnes au décollage, dont ${fr((S1.fuel + S2.fuel) / 1000)} tonnes d’ergol, pour une charge utile de ${fr(LAUNCHER.payload / 1000)} tonnes. Il est fait de deux étages, deux fusées empilées. Moins de 1 % de sa masse arrive en orbite ; le cours explique pourquoi.`, {
        claims: [{ text: 'moins de 1 % en orbite', check: () => LAUNCHER.payload / M0 < 0.01 || `${pct(LAUNCHER.payload / M0)}` }],
      });
    });
    c.chapter('Action et réaction', () => {
      c.stage('pad');
      c.ask('q-vacuum', 'Dans le vide, sur quoi une fusée s’appuie-t-elle pour accélérer ?', ['sur les gaz qu’elle éjecte', 'sur l’air situé derrière elle', 'sur le sol, pendant tout le vol', 'sur rien : elle ne peut pas accélérer'], 'Elle pousse les gaz vers l’arrière ; en retour, les gaz la poussent vers l’avant.');
      c.step('Éjecter de la matière', 'Le moteur brûle de l’ergol et éjecte les gaz très vite vers le bas. Pour les accélérer, il les pousse ; en retour, les gaz poussent le moteur vers le haut avec une force de même intensité. C’est le principe des actions réciproques. Il ne demande pas d’air : une fusée fonctionne mieux dans le vide.');
      c.step('Ce qui fixe la poussée', `La poussée vaut le débit d’ergol (en kg/s) multiplié par la vitesse d’éjection des gaz (en m/s). Le premier étage du lanceur brûle ${fr(S1.thrust / S1.ve)} kg d’ergol par seconde et éjecte les gaz à ${fr(S1.ve)} m/s : sa poussée vaut environ ${fr(S1.thrust / 1e6, 1)} millions de newtons.`, {
        code: 'poussée = débit × vitesse_d_éjection     // N = (kg/s) × (m/s)',
        claims: [{ text: 'débit × vitesse d’éjection = poussée', check: () => near(Math.round(S1.thrust / S1.ve) * S1.ve, S1.thrust, 0.001) }],
      });
      c.numeric('q-flow', `Le second étage pousse avec ${fr(S2.thrust / 1000)} kN et éjecte ses gaz à ${fr(S2.ve)} m/s. Quel est son débit, en kg/s ?`, S2.thrust / S2.ve, `Débit = poussée / vitesse d’éjection = ${fr(S2.thrust)} / ${fr(S2.ve)} ≈ ${fr(S2.thrust / S2.ve)} kg/s.`, { unit: 'kg/s', tol: 3 });
    });
    c.chapter('Décoller', () => {
      c.stage('pad');
      c.diagram('forces');
      c.step('Deux forces au départ', `Sur le pas de tir, deux forces s’opposent : la poussée, vers le haut, et le poids m·g, vers le bas. Le lanceur pèse ${fr(M0 * G0 / 1e6, 2)} MN et pousse avec ${fr(S1.thrust / 1e6, 1)} MN. Le rapport poussée / poids vaut ${fr(S1.thrust / (M0 * G0), 2)} : plus grand que 1, la fusée décolle.`, {
        tools: ['N1'],
        claims: [{ text: `rapport poussée / poids ${fr(S1.thrust / (M0 * G0), 2)}`, check: () => near(S1.thrust / (M0 * G0), 1.33, 0.01) }],
      });
      c.experiment({
        title: 'Réglez la poussée', prompt: 'Faites varier la poussée des moteurs, exprimée en fraction de la poussée nominale. Observez le schéma et le décollage en arrière-plan.',
        predict: { question: 'Avec 70 % de la poussée nominale, la fusée…', choices: ['reste au sol', 'décolle lentement', 'décolle comme avant'], answer: 0 },
        controls: [{ type: 'range', key: 'thrust', label: 'poussée', min: 0.6, max: 1.4, step: 0.05, fmt: pct }],
        goals: [
          { label: 'Trouvez une poussée qui ne suffit pas à décoller', test: ({ v }) => S1.thrust * v.thrust < M0 * G0 },
          { label: 'Réglez un rapport poussée / poids d’au moins 1,5', test: ({ v }) => S1.thrust * v.thrust >= 1.5 * M0 * G0 },
        ],
        seq: true, conclusion: 'Sous 1, la poussée ne soulève pas la fusée : elle brûle son ergol sur place. Au-dessus, l’accélération de départ vaut (rapport − 1) × g.',
      });
      c.question('q-twr', 'Une fusée a un rapport poussée / poids de 1,2. Quelle est son accélération au décollage ?', ['environ 2 m/s²', 'environ 12 m/s²', 'environ 1,2 m/s²', 'elle reste au sol'], 'a = poussée/m − g = 1,2 g − g = 0,2 × 9,81 ≈ 2 m/s².');
      c.exercise('twr', 'Dans l’atelier, calculez le rapport poussée / poids du lanceur et son accélération au départ.');
    });
    c.chapter('Une fusée qui s’allège', () => {
      c.stage('pad');
      c.diagram('climb');
      c.step('La masse diminue', `Chaque seconde, le premier étage perd ${fr(S1.thrust / S1.ve)} kg d’ergol. La poussée reste la même, mais la masse à accélérer diminue : l’accélération poussée/m − g augmente pendant tout le vol de l’étage. Sur le schéma, la courbe de vitesse se redresse ; c’est un premier vol sans air, tout droit.`);
      c.diagram('stepPipeline');
      c.step('Calculer le vol pas à pas', 'Une simulation calcule le vol par petits pas de temps dt. À chaque pas : l’accélération à partir des forces, puis la vitesse, puis l’altitude, puis la masse, qui diminue du débit multiplié par dt. C’est la méthode d’Euler, la même que pour une chute.', {
        tools: ['T4'],
        code: 'a = poussée / m − g\nv = v + a·dt\nh = h + v·dt\nm = m − (poussée / ve)·dt',
      });
      c.order('q-order', 'Remettez dans l’ordre les calculs d’un pas de simulation.', ['calculer l’accélération', 'mettre la vitesse à jour', 'mettre l’altitude à jour', 'retirer l’ergol brûlé'], 'Les forces donnent l’accélération, qui change la vitesse, qui change l’altitude ; la masse est mise à jour pour le pas suivant.');
      c.exercise('climb', 'Dans l’atelier, programmez un pas de vol vertical.');
      c.explain('e-accel', 'La poussée du premier étage reste constante pendant tout son vol. Expliquez pourquoi son accélération augmente quand même.', 'L’accélération vaut poussée/m − g. La poussée ne change pas, mais la masse m diminue à mesure que l’ergol brûle. Diviser la même force par une masse plus petite donne une accélération plus grande.');
    });

    // ================================================================ m2
    c.module('m2');
    c.chapter('Le gain de vitesse', () => {
      c.stage('flight');
      c.step('Mesurer ce qu’une fusée peut faire', 'Pour comparer des fusées, on calcule le Δv (« delta-v ») : le gain de vitesse qu’elles obtiendraient en brûlant tout leur ergol, sans air ni pesanteur. On le compare ensuite à ce que demande la mission. Un Δv ne dépend pas de la durée de la combustion, seulement des masses et du moteur.');
      c.diagram('tsiolkovsky');
      c.step('L’équation de Tsiolkovsky', 'Δv = ve · ln(m0/mf). ve est la vitesse d’éjection, m0 la masse au départ, mf la masse une fois l’ergol brûlé. Le rapport m0/mf s’appelle le rapport de masse. Sur le schéma, la courbe monte de moins en moins vite : chaque kilogramme d’ergol ajouté doit aussi accélérer l’ergol qui reste à brûler.', {
        tools: ['L1'],
        claims: [{ text: 'ln(e) = 1', check: () => Math.abs(tsiolkovsky(3000, Math.E, 1) - 3000) < 1e-9 }],
      });
      c.experiment({
        title: 'Le rapport de masse', prompt: 'Faites varier le rapport de masse et la vitesse d’éjection. Lisez le Δv obtenu.',
        predict: { question: 'Avec ve = 3 000 m/s, quel rapport de masse faut-il pour atteindre 7,8 km/s ?', choices: ['plus de 13', 'environ 2,6', 'environ 5'], answer: 0 },
        controls: [
          { type: 'range', key: 'ratio', label: 'm0 / mf', min: 1, max: 20, step: 0.1, fmt: dec(1) },
          { type: 'range', key: 've', label: 'vitesse d’éjection (m/s)', min: 2000, max: 4500, step: 50, fmt: int },
        ],
        goals: [
          { label: 'Avec ve = 3 000 m/s, atteignez 7,8 km/s', test: ({ v }) => Math.abs(v.ve - 3000) < 1 && v.ve * Math.log(v.ratio) >= 7800 },
          { label: 'Atteignez 7,8 km/s avec un rapport de masse de 8 au plus', test: ({ v }) => v.ratio <= 8 && v.ve * Math.log(v.ratio) >= 7800 },
        ],
        seq: true, conclusion: 'Avec un seul réservoir, il faudrait que 93 % de la fusée soit de l’ergol. Une meilleure vitesse d’éjection réduit beaucoup le rapport nécessaire.',
      });
      c.numeric('q-dv', 'Une fusée a un rapport de masse de 4 et une vitesse d’éjection de 3 000 m/s. Quel est son Δv, en m/s ?', 3000 * Math.log(4), `3 000 × ln 4 ≈ 3 000 × 1,386 ≈ ${fr(3000 * Math.log(4))} m/s.`, { unit: 'm/s', tol: 40 });
      c.question('q-double', 'On double la masse d’ergol d’une fusée sans changer sa masse vide. Son Δv…', ['augmente, mais ne double pas', 'double exactement', 'reste le même', 'est multiplié par quatre'], 'Le rapport de masse augmente, mais le Δv suit son logarithme, qui croît lentement.');
    });
    c.chapter('Les étages', () => {
      c.stage('flight');
      c.diagram('budget');
      c.ask('q-why-stages', 'Pourquoi un lanceur largue-t-il ses étages vides ?', ['pour ne plus accélérer leur masse inutile', 'pour réduire la traînée de l’air', 'parce que leurs moteurs sont usés', 'pour alléger la tour de lancement'], 'Un réservoir vide n’apporte plus rien ; continuer à l’accélérer coûte de l’ergol.');
      c.step('Le poids mort', 'Une fois son ergol brûlé, un réservoir et ses moteurs deviennent un poids mort. Si on les garde, l’ergol restant doit aussi les accélérer. Un lanceur est donc découpé en étages : chacun a ses réservoirs et ses moteurs, et il est largué une fois vide.');
      c.step('Deux étages contre un', `Le premier étage du lanceur donne ${fr(DV[0] / 1000, 1)} km/s et le second ${fr(DV[1] / 1000, 1)} km/s : ${fr(sum(DV) / 1000, 1)} km/s au total. Avec les mêmes moteurs et le même ergol dans un seul étage, on n’obtiendrait que ${fr(sum(stageDeltaV(singleStage(LAUNCHER))) / 1000, 1)} km/s. Il en faut environ 9,4.`, {
        claims: [
          { text: 'deux étages : environ 10,1 km/s', check: () => near(sum(DV), 10100, 0.01) || fr(sum(DV)) },
          { text: 'un étage : environ 6,1 km/s', check: () => near(sum(stageDeltaV(singleStage(LAUNCHER))), 6100, 0.01) },
          { text: 'il en faut environ 9,4', check: () => near(orbitalSpeed(NOMINAL.end.y - 6_371_000) + NOMINAL.gravityLoss + NOMINAL.dragLoss, 9400, 0.03) || 'le bilan du vol nominal diffère' },
        ],
      });
      c.experiment({
        title: 'Un ou deux étages', prompt: 'Passez à un seul étage, puis revenez à deux étages et alourdissez la charge utile.',
        predict: { question: 'Avec un seul étage, le lanceur atteint-il les 9,4 km/s nécessaires ?', choices: ['non, il en est loin', 'oui, avec une petite marge', 'oui, largement'], answer: 0 },
        controls: [
          { type: 'toggle', key: 'single', label: 'un seul étage', on: 1, off: 0 },
          { type: 'range', key: 'payload', label: 'charge utile (kg)', min: 1000, max: 8000, step: 250, fmt: int },
        ],
        goals: [
          { label: 'Affichez la version à un seul étage', test: ({ v }) => v.single > 0.5 },
          { label: 'Avec deux étages, trouvez la charge utile qui fait passer sous 9,4 km/s', test: ({ v }) => v.single < 0.5 && sum(stageDeltaV({ ...LAUNCHER, payload: v.payload })) < 9400 },
        ],
        seq: true, conclusion: 'Un seul étage ne suffit pas. Avec deux étages, la charge utile maximale est d’environ 5 tonnes : chaque kilogramme de satellite réduit le Δv, surtout celui du second étage.',
      });
      c.exercise('dv', 'Dans l’atelier, calculez le Δv du second étage.');
      c.exercise('deltaV', 'Dans l’atelier, programmez le calcul du Δv d’un lanceur à plusieurs étages.');
      c.explain('e-stages', 'Expliquez pourquoi deux étages donnent plus de Δv qu’un seul étage contenant les mêmes moteurs et le même ergol.', 'Dans un seul étage, toute la structure reste accrochée jusqu’au bout : la masse finale mf est grande et le rapport m0/mf petit. Avec deux étages, on largue la structure du premier ; le second part avec une masse plus petite et atteint un meilleur rapport de masse. Les Δv des deux étages s’ajoutent.');
    });

    // ================================================================ m3
    c.module('m3');
    c.chapter('Tomber sans toucher le sol', () => {
      c.stage('flight');
      c.diagram('cannon');
      c.ask('q-iss-g', 'À 400 km d’altitude, là où vole la Station spatiale, la pesanteur est…', ['presque aussi forte qu’au sol', 'nulle', 'dix fois plus faible qu’au sol', 'plus forte qu’au sol'], `Elle vaut GM/r² ≈ ${fr(gravity(400_000), 1)} m/s², environ 89 % de sa valeur au sol.`);
      c.step('Le canon de Newton', 'Imaginez un canon au sommet d’une très haute montagne, qui tire à l’horizontale. Plus le boulet part vite, plus il tombe loin. Assez vite, il tombe aussi vite que la surface de la Terre, ronde, se dérobe sous lui : il ne touche jamais le sol. C’est une orbite. Les astronautes flottent parce qu’ils tombent avec leur station.', {
        claims: [{ text: 'pesanteur à 400 km : environ 8,7 m/s²', check: () => near(gravity(400_000), 8.7, 0.01) }],
      });
      c.step('La vitesse orbitale', `Sur une orbite circulaire de rayon r, la pesanteur sert juste à courber la trajectoire : v²/r = GM/r², donc v = √(GM/r). r se mesure depuis le centre de la Terre. À 200 km d’altitude, r = 6 571 km et v ≈ ${fr(orbitalSpeed(200_000))} m/s.`, {
        code: 'v = Math.sqrt(GM / r)    // GM = 3,986e14 m³/s²',
        claims: [{ text: `v ≈ ${fr(orbitalSpeed(200_000))} m/s`, check: () => near(orbitalSpeed(200_000), 7788, 0.001) }],
      });
      c.experiment({
        title: 'Le canon de Newton', prompt: 'Réglez la vitesse du tir horizontal, à 200 km d’altitude.',
        predict: { question: 'Tiré à 9 km/s, le boulet…', choices: ['décrit une ellipse qui l’éloigne puis le ramène', 'quitte la Terre pour toujours', 'retombe un peu plus loin'], answer: 0 },
        controls: [{ type: 'range', key: 'v0', label: 'vitesse (km/s)', min: 1, max: 11.5, step: 0.05, fmt: dec(2) }],
        goals: [
          { label: 'Faites retomber le boulet', test: ({ v }) => v.v0 < 7.6 },
          { label: 'Obtenez une orbite presque circulaire', test: ({ v }) => Math.abs(v.v0 - orbitalSpeed(200_000) / 1000) < 0.15 },
          { label: 'Obtenez une ellipse qui monte au-dessus de 2 000 km', test: ({ v }) => v.v0 > 8.6 && v.v0 < 10.9 },
        ],
        seq: true, conclusion: 'Sous 7,8 km/s, le boulet retombe ; à 7,8 km/s, il tourne à altitude constante ; plus vite, l’orbite s’allonge ; au-delà de 11 km/s environ, il ne revient plus.',
      });
      c.exercise('orbit', 'Dans l’atelier, calculez la vitesse et la durée d’une orbite à 200 km.');
      c.step('Apogée et périgée', 'Une orbite est en général une ellipse. Son point le plus haut s’appelle l’apogée, son point le plus bas le périgée. Si le périgée descend sous 100 km environ, le satellite traverse l’air à chaque tour, ralentit et finit par retomber. Le lanceur doit donc placer le périgée assez haut.');
      c.question('q-slow', 'Un satellite sur une orbite circulaire à 200 km ralentit de 100 m/s. Que devient son orbite ?', ['une ellipse dont le périgée est plus bas', 'la même orbite, parcourue plus lentement', 'une ellipse dont l’apogée est plus haut', 'une chute verticale vers la Terre'], 'Trop lent pour cette altitude, il tombe un peu vers la Terre : le point opposé de l’orbite devient le périgée, plus bas.');
      c.explain('e-orbit', 'Un élève dit : « Dans la Station spatiale, les astronautes flottent parce qu’il n’y a plus de pesanteur. » Expliquez ce qui est faux et ce qui se passe vraiment.', 'La pesanteur à 400 km vaut encore environ 89 % de sa valeur au sol. Les astronautes et la station tombent en permanence vers la Terre, avec la même accélération, donc ils ne pèsent pas les uns sur les autres. Ils ne s’écrasent pas parce qu’ils vont assez vite à l’horizontale : la Terre se dérobe sous eux.');
    });

    // ================================================================ m4
    c.module('m4');
    c.chapter('Traverser l’atmosphère', () => {
      c.stage('pad');
      c.diagram('air');
      c.step('La traînée', 'Dans l’air, la fusée subit une force qui la freine, la traînée : ½·ρ·v²·Cd·A. ρ est la densité de l’air, v la vitesse, Cd un coefficient de forme et A la section de la fusée. La densité diminue très vite avec l’altitude : elle est divisée par environ 2,7 tous les 8,5 km.');
      c.step('La pression dynamique maximale', `Au début, la fusée va lentement ; plus tard, l’air est trop rare. Entre les deux, la pression dynamique ½·ρ·v² passe par un maximum : vers ${fr(NOMINAL.events.find((e) => e.kind === 'maxq')!.t)} s de vol pour notre lanceur, à environ ${fr(NOMINAL.maxQ / 1000)} kPa. C’est le moment où la structure est la plus sollicitée.`, {
        claims: [{ text: 'maximum vers 70 s', check: () => { const t = NOMINAL.events.find((e) => e.kind === 'maxq')?.t ?? 0; return (t > 55 && t < 90) || `t = ${t}`; } }],
      });
      c.question('q-maxq', 'Pourquoi la pression dynamique ne cesse-t-elle pas d’augmenter alors que la fusée accélère ?', ['l’air devient trop peu dense en altitude', 'les moteurs réduisent la vitesse', 'la fusée perd sa forme aérodynamique', 'la pesanteur augmente avec l’altitude'], 'q = ½·ρ·v² : v augmente, mais ρ diminue plus vite encore au-dessus de 10 à 15 km.');
    });
    c.chapter('Le basculement', () => {
      c.stage('flight');
      c.diagram('flight');
      c.set({ kick: FLIGHT.kick });
      c.ask('q-tilt', 'Pourquoi une fusée ne monte-t-elle pas tout droit jusqu’à 200 km avant de tourner ?', ['elle gaspillerait son ergol à lutter contre le poids', 'elle risquerait de heurter un satellite', 'elle sortirait trop vite de l’air', 'elle ne pourrait plus larguer d’étage'], 'Pendant tout ce temps, une partie de la poussée ne ferait que compenser le poids.');
      c.step('Monter, puis accélérer à l’horizontale', 'L’orbite demande surtout de la vitesse horizontale. Mais la fusée doit d’abord sortir de l’air dense, qui la freinerait. Elle monte donc presque à la verticale, puis s’incline progressivement. Plus elle reste longtemps à la verticale, plus elle perd de Δv à lutter contre son poids : ce sont les pertes par gravité.');
      c.step('Le virage gravitationnel', `À ${fr(FLIGHT.kickSpeed)} m/s, la fusée s’incline de quelques degrés : c’est le basculement. Ensuite, les moteurs poussent dans la direction de la vitesse, et la pesanteur courbe peu à peu la trajectoire vers l’horizontale, sans effort de pilotage. Le second étage, au-dessus de l’air, est guidé : il pousse presque à l’horizontale jusqu’à la vitesse orbitale.`, { hud: flightHud });
      c.experiment({
        title: 'Réglez le basculement', prompt: 'Faites varier l’angle de basculement. Regardez la trajectoire sur le schéma et le vol en arrière-plan.',
        predict: { question: 'Sans basculement (0°), la fusée…', choices: ['monte très haut puis retombe', 'atteint l’orbite', 'reste dans l’air dense'], answer: 0 },
        controls: [{ type: 'range', key: 'kick', label: 'basculement (°)', min: 0, max: 15, step: 0.5, fmt: dec(1) }],
        goals: [
          { label: 'Réglez 0° : un vol vertical', test: ({ v }) => v.kick === 0 },
          { label: 'Trouvez un basculement trop fort : la fusée retombe au sol', test: ({ v }) => flightOf(v).outcome === 'crash' },
          { label: 'Trouvez un basculement qui mène en orbite', test: ({ v }) => isOrbit(v) },
        ],
        seq: true, conclusion: 'De 5 à 8° environ, le lanceur atteint l’orbite. En dessous, il monte trop et n’a plus assez de Δv pour la vitesse horizontale ; au-dessus, il prend de la vitesse trop bas, dans l’air dense, et retombe.',
      });
      c.exercise('events', 'Dans l’atelier, remettez dans l’ordre les étapes du vol.');
    });
    c.chapter('Le bilan d’un lancement', () => {
      c.stage('flight');
      c.diagram('losses');
      c.step('Où passe le Δv', `Pour le vol nominal, le lanceur dispose de ${fr(NOMINAL.idealDv)} m/s de Δv idéal. Il en perd environ ${fr(NOMINAL.gravityLoss)} à lutter contre la pesanteur et ${fr(NOMINAL.dragLoss)} à cause de l’air. Il arrive en orbite à ${fr(Math.hypot(NOMINAL.end.vx, NOMINAL.end.vy))} m/s avec un peu d’ergol de réserve.`, {
        hud: flightHud,
        claims: [
          { text: 'pertes par gravité de l’ordre de 1,6 km/s', check: () => near(NOMINAL.gravityLoss, 1600, 0.06) || fr(NOMINAL.gravityLoss) },
          { text: 'la traînée coûte bien moins que la pesanteur', check: () => NOMINAL.dragLoss < NOMINAL.gravityLoss / 10 },
        ],
      });
      c.step('Ce que montre le bilan', 'Les pertes par gravité sont le premier poste de dépense : c’est pourquoi un lanceur doit avoir une poussée nettement supérieure à son poids, et pourquoi la trajectoire s’incline tôt. La traînée coûte peu sur un gros lanceur, mais un mauvais réglage du basculement peut la rendre très coûteuse.');
      c.experiment({
        title: 'Le bilan selon le basculement', prompt: 'Changez le basculement et observez comment se répartissent les pertes.',
        predict: { question: 'Si le basculement augmente, les pertes par gravité…', choices: ['diminuent', 'augmentent', 'ne changent pas'], answer: 0 },
        controls: [{ type: 'range', key: 'kick', label: 'basculement (°)', min: 0, max: 15, step: 0.5, fmt: dec(1) }],
        goals: [{ label: 'Trouvez un réglage où la traînée coûte plus de 500 m/s', test: ({ v }) => flightOf(v).dragLoss > 500 }],
        conclusion: 'Plus la fusée s’incline tôt, moins elle lutte contre son poids, mais plus elle va vite dans l’air dense. Le bon réglage est un compromis.',
      });
      c.exercise('losses', 'Dans l’atelier, classez ce qui aide et ce qui coûte.');
      c.exercise('assembly', 'Dans l’atelier, vérifiez ensemble les fonctions que vous avez écrites.');
      c.explain('e-losses', 'Expliquez pourquoi il faut environ 9,4 km/s de Δv pour atteindre une orbite où l’on va à 7,8 km/s.', 'Pendant la montée, une partie de la poussée sert à compenser le poids au lieu d’accélérer la fusée : ce sont les pertes par gravité, environ 1,6 km/s. L’air freine aussi un peu la fusée. Le Δv doit couvrir la vitesse finale et ces pertes.');
    });
    c.clinicCase({
      id: 'clin-thrust', title: 'une fusée qui ne quitte pas le pas de tir', scene: 'pad', fault: { thrust: 0.7 },
      observe: 'Les moteurs s’allument, la flamme est bien là, mais la fusée ne bouge pas. Les autres réglages sont ceux du vol nominal.',
      choices: ['la poussée, plus faible que le poids', 'le basculement, donné trop tôt', 'la charge utile, trop légère'],
      explain: 'Avec 70 % de la poussée, le rapport poussée / poids vaut environ 0,93 : moins que 1.',
      controls: [
        { type: 'range', key: 'thrust', label: 'poussée', min: 0.6, max: 1.1, step: 0.05, fmt: pct },
        { type: 'range', key: 'kick', label: 'basculement (°)', min: 0, max: 15, step: 0.5, fmt: dec(1) },
      ],
      goal: { label: 'La fusée atteint l’orbite', test: (v) => isOrbit(v) },
      conclusion: 'Avec la poussée nominale, le rapport poussée / poids repasse à 1,33 et le vol se déroule normalement.',
      justify: 'Le symptôme : la fusée reste au sol malgré ses moteurs allumés. La cause : une poussée réduite à 70 %, plus faible que le poids de la fusée pleine. La résultante des forces est dirigée vers le bas ; le sol retient la fusée. En rétablissant la poussée, le rapport poussée / poids dépasse 1 et la fusée accélère vers le haut.',
    });
    c.clinicCase({
      id: 'clin-kick', title: 'une fusée qui retombe après deux minutes', scene: 'flight', fault: { kick: 12 },
      observe: 'La fusée décolle normalement, mais sa trajectoire se couche très vite. Elle ne dépasse pas une soixantaine de kilomètres et retombe.',
      choices: ['le basculement, beaucoup trop fort', 'la poussée, trop forte au décollage', 'le second étage, trop lourd'],
      explain: 'Un basculement de 12° couche la trajectoire alors que la fusée est encore dans l’air dense.',
      controls: [
        { type: 'range', key: 'kick', label: 'basculement (°)', min: 0, max: 15, step: 0.5, fmt: dec(1) },
        { type: 'range', key: 'thrust', label: 'poussée', min: 0.8, max: 1.1, step: 0.05, fmt: pct },
      ],
      goal: { label: 'La fusée atteint l’orbite', test: (v) => isOrbit(v) },
      conclusion: 'Avec un basculement de 5 à 8°, la fusée sort de l’air dense avant de prendre sa vitesse horizontale.',
      justify: 'Le symptôme : la trajectoire devient horizontale trop bas et la fusée retombe. La cause : un basculement trop fort. La fusée prend de la vitesse vers 20 à 50 km d’altitude, où l’air est encore dense ; la traînée la freine fortement et elle ne monte plus assez. Avec un basculement plus faible, elle sort d’abord de l’atmosphère puis accélère à l’horizontale.',
    });

    // ============================================================== exam
    c.module('exam');
    c.clinicCase({
      id: 'exam-payload', exam: true, title: 'un satellite qui n’atteint pas l’orbite', scene: 'flight', fault: { payload: 6000 },
      observe: 'Le décollage, le basculement et la séparation se passent normalement. Mais le second étage s’éteint, réservoirs vides, avant d’avoir atteint la vitesse d’orbite, et le satellite retombe.',
      choices: ['la charge utile, trop lourde pour ce lanceur', 'le basculement, trop faible', 'la traînée, trop forte en haute altitude'],
      explain: 'Avec 6 t de charge utile, le Δv du lanceur ne couvre plus la vitesse orbitale et les pertes.',
      controls: [
        { type: 'range', key: 'payload', label: 'charge utile (kg)', min: 1000, max: 8000, step: 250, fmt: int },
        { type: 'range', key: 'kick', label: 'basculement (°)', min: 0, max: 15, step: 0.5, fmt: dec(1) },
      ],
      goal: { label: 'Le satellite atteint l’orbite', test: (v) => isOrbit(v) },
      conclusion: 'Avec une charge utile de 4 t au plus, le Δv du lanceur suffit.',
      justify: 'Le symptôme : le second étage s’éteint avant la vitesse orbitale. La cause : une charge utile trop lourde. Elle augmente la masse finale de chaque étage, donc diminue les rapports de masse et le Δv, surtout celui du second étage. Avec une charge plus légère, le Δv couvre de nouveau la vitesse orbitale et les pertes.',
    });
    c.chapter('Test final', () => {
      c.stage('flight');
      c.step('Le test final', 'Ce test reprend les notions du test de départ, dans d’autres situations. Comparez ensuite vos deux résultats, notion par notion.');
      c.test('post', 'Le test final.');
    });
  },
});

export default Object.assign(course, { workshop });
