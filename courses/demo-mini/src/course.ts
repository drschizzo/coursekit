// The toy course: two short modules and an exam on a falling object. It is
// not meant to teach much; it uses every element of the format at least once,
// so that the library can be tested on it.

import { choice, defineCourse, numeric } from '@coursekit/core';
import { pickCapsules } from '@coursekit/diagrams';
import { choiceQ, type Exercise, type WorkshopConfig } from '@coursekit/exercises';
import { DIAGRAMS } from './diagrams.ts';
import { model, simulate, stepRef } from './model.ts';

const int = (v: number) => String(Math.round(v));
const dec = (n: number) => (v: number) => v.toFixed(n).replace('.', ',');

const exercises: Exercise[] = [
  {
    id: 'step', module: 'm1', kind: 'code', title: 'Un pas de la chute', slot: 'step',
    sig: 'function step(s, dt, g, k)',
    doc: 's : l’état {y, v} (hauteur en m, vitesse en m/s, positive vers le haut) · dt : la durée du pas (s) · g : la pesanteur (positive) · k : le frottement de l’air (1/s).',
    goal: 'La vitesse change d’abord sous l’effet du poids et du frottement (−g − k·v), puis la hauteur avance avec la nouvelle vitesse.',
    solution: `function step(s, dt, g, k) {
  s.v += dt * (-g - k * s.v);
  s.y += dt * s.v;
}`,
    starter: `function step(s, dt, g, k) {
  // 1. la vitesse change : −g − k·v
  // 2. la hauteur avance avec la nouvelle vitesse
}`,
    hints: ['L’accélération vaut −g − k·s.v.', 's.v += dt * (−g − k·s.v), puis la hauteur.', 'La hauteur avance de dt fois la nouvelle vitesse.'],
    win: 'Votre balle tombe exactement comme celle de la référence.',
    primm: {
      intro: 'Voici un pas d’Euler explicite, sans frottement. Lisez-le avant de l’exécuter.',
      code: `function step(s, dt, g, k) {
  s.y += dt * s.v;
  s.v += dt * -g;
}`,
      predict: choiceQ('Quelle vitesse sert à faire avancer la hauteur dans ce code ?', ['celle du début du pas', 'celle de la fin du pas', 'la moyenne des deux'], 'La première ligne utilise s.v avant que la seconde ne la modifie.'),
      investigate: choiceQ('Ce code tient-il compte du frottement de l’air ?', ['non, k n’est jamais utilisé', 'oui, à travers la valeur de g', 'oui, à travers la durée dt'], 'Le paramètre k n’apparaît dans aucune ligne.'),
      modify: 'Modifiez ce code : mettez d’abord la vitesse à jour, avec le frottement.',
    },
    preview(ctx, fn) {
      ctx.fillStyle = '#7c9cff'; ctx.font = '11px Inter, sans-serif';
      if (!fn) { ctx.fillText('écrivez votre fonction', 20, 20); return; }
      const r = simulate({ k: 0.5 }, fn as never);
      ctx.strokeStyle = '#ffb35c'; ctx.lineWidth = 2; ctx.beginPath();
      r.forEach((s, i) => { const X = 30 + (s.t / 3) * 320, Y = 210 - (s.y / 20) * 180; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
      ctx.fillText('hauteur de votre balle (k = 0,5)', 30, 20);
    },
  },
  {
    id: 'landing', module: 'm1', kind: 'calculation', title: 'Le temps de chute',
    intro: 'Une balle est lâchée de 20 m, sans frottement de l’air (g = 9,81 m/s²). Calculez son temps de chute en deux étapes.',
    steps: [
      { prompt: 'Que vaut 2·h0 / g ? (en s²)', value: 40 / 9.81, unit: 's²', explain: '2 × 20 / 9,81 ≈ 4,08 s².' },
      { prompt: 'Le temps de chute est la racine carrée de ce nombre. Que vaut-il ? (en s)', value: Math.sqrt(40 / 9.81), unit: 's', explain: '√4,08 ≈ 2,02 s.' },
    ],
    win: 'Le temps de chute vaut environ 2 secondes.',
  },
  {
    id: 'forces', module: 'm1', kind: 'classify', title: 'Ce qui agit sur la balle',
    intro: 'Pour chaque grandeur, dites si c’est une force qui agit sur la balle ou une grandeur qui décrit son mouvement.',
    categories: ['force', 'mouvement'],
    items: [
      { text: 'le poids', cat: 0 },
      { text: 'la vitesse', cat: 1 },
      { text: 'le frottement de l’air', cat: 0 },
      { text: 'la hauteur', cat: 1 },
    ],
    win: 'Les forces modifient la vitesse ; la vitesse modifie la hauteur.',
  },
  {
    id: 'order', module: 'm2', kind: 'sequence', title: 'Un pas de simulation',
    intro: 'Remettez dans l’ordre les opérations d’un pas de simulation.',
    items: ['calculer l’accélération à partir des forces', 'mettre la vitesse à jour', 'mettre la hauteur à jour', 'vérifier si la balle touche le sol'],
    explain: 'Les forces donnent l’accélération, qui modifie la vitesse, qui modifie la position ; le contact avec le sol est traité en dernier.',
    win: 'L’ordre est juste.',
  },
];

const workshop: WorkshopConfig = {
  scenarios: [
    { name: 'chute sans frottement', run: (impl) => simulate({}, impl.step as never).map((s) => s.y), tol: 1e-9, unit: 'm' },
    { name: 'chute avec frottement', run: (impl) => simulate({ k: 0.8 }, impl.step as never).map((s) => s.y), tol: 1e-9, unit: 'm' },
  ],
  assembly: {
    title: 'Ma simulation',
    intro: 'Votre fonction step fait tomber la balle sur les deux scénarios.',
    chart: { label: 'hauteur (m)', unit: 'm', run: (impl) => simulate({ k: 0.8 }, impl.step as never).map((s) => s.y) },
  },
};

const course = defineCourse({
  id: 'demo-mini', version: 1, language: 'fr',
  title: 'La chute d’un objet',
  lead: 'Un cours jouet pour tester coursekit : comment un programme calcule la chute d’une balle, pas à pas, avec ou sans frottement de l’air.',
  audience: { level: 'lycée', prerequisites: 'La notion de vitesse et la dérivée (première).', effort: 'en une séance' },
  modules: [
    { id: 'm1', title: 'Calculer une chute', pitch: 'Le pas de temps, le poids et le frottement.', goals: ['Programmer un pas de chute', 'Expliquer le rôle du pas de temps'], summary: ['v ← v + h·a, puis y ← y + h·v.', 'Avec un frottement k·v, la vitesse tend vers g/k.'] },
    { id: 'm2', title: 'Vérifier une simulation', pitch: 'Comparer à la solution exacte et trouver une erreur.', goals: ['Diagnostiquer un mauvais réglage'], summary: ['Un pas trop grand donne une chute fausse.'] },
    { id: 'exam', title: 'Épreuve', kind: 'exam', pitch: 'Un cas inédit et le test final.', goals: ['Diagnostiquer seul un cas inconnu'], summary: ['Observer, supposer, corriger, justifier.'] },
  ],
  glossary: [
    { id: 'step', name: 'pas de temps', def: 'Durée entre deux états calculés.', tool: 'T4', module: 'm1' },
    { id: 'drag', name: 'frottement de l’air', forms: ['frottement'], def: 'Force qui s’oppose au mouvement dans l’air ; ici proportionnelle à la vitesse.', module: 'm1' },
    { id: 'terminal', name: 'vitesse limite', def: 'Vitesse atteinte quand le frottement compense le poids : g/k.', module: 'm1' },
  ],
  toolbox: pickCapsules(['T4', 'Le calcul pas à pas de la chute.']),
  tests: {
    tools: [{ id: 'a1', skill: 'Taux de variation', tool: 'T4', q: numeric('Un objet passe de 10 m à 25 m en 3 s. Vitesse moyenne, en m/s ?', 5, '(25 − 10)/3 = 5.', { unit: 'm/s' }) }],
    pre: [{ id: 'b1', skill: 'Pas de temps', q: choice('Si l’on divise le pas de temps par deux, le calcul devient…', ['plus précis et plus long', 'moins précis et plus rapide', 'identique', 'impossible'], 'Plus de pas : plus de calculs, une erreur plus petite.') }],
    post: [{ id: 'p1', pair: 'b1', skill: 'Pas de temps', q: choice('Une simulation à 10 pas par seconde s’écarte de la chute exacte. Que faire ?', ['augmenter le nombre de pas par seconde', 'augmenter la pesanteur de la scène', 'réduire la hauteur de départ', 'retirer le sol de la simulation'], 'Un pas plus court réduit l’erreur.') }],
  },
  diagrams: DIAGRAMS,
  stageKeys: ['h0', 'k'],
  scenes: { fall: 'Une balle lâchée du haut d’une tour' },
  defaults: { h0: 20, k: 0, steps: 30 },
  layers: ['Forces', 'Vitesse', 'Position'],
  model,
  exercises,
  rubric: ['Une justification complète décrit le symptôme, la cause, et le mécanisme qui les relie.'],
  content(c) {
    c.module('m1');
    c.chapter('Le pas de temps', () => {
      c.stage('fall', { h0: 20 });
      c.step('Calculer une chute', 'Un programme ne calcule pas une trajectoire continue : il calcule la hauteur à des instants séparés d’un pas de temps h. Entre deux instants, il suppose que la vitesse change peu.', { tools: ['T4'], layers: 3 });
      c.ask('q-intuition', 'Que se passe-t-il si le pas de temps est très grand ?', ['le calcul s’écarte de la vraie chute', 'le calcul devient exact', 'la balle tombe plus lentement'], 'Un grand pas suppose la vitesse constante trop longtemps.');
      c.diagram('fallPlot');
      c.step('Comparer au calcul fin', 'Sur le schéma, la courbe bleue est un calcul très fin, la courbe orange le calcul avec le nombre de pas choisi. Avec peu de pas, l’orange s’écarte.', { hud: (v) => `${Math.round(v.steps)} pas par seconde` });
      c.experiment({
        title: 'Changez le pas', prompt: 'Faites varier le nombre de pas par seconde.',
        predict: { question: 'Avec 4 pas par seconde, l’écart avec le calcul fin sera…', choices: ['grand', 'nul', 'le même qu’avec 30'], answer: 0 },
        controls: [{ type: 'range', key: 'steps', label: 'pas par seconde', min: 2, max: 60, step: 1, fmt: int }],
        goals: [{ label: 'Réglez 4 pas par seconde ou moins', test: ({ v }) => v.steps <= 4 }, { label: 'Réglez 40 ou plus', test: ({ v }) => v.steps >= 40 }],
        seq: true, conclusion: 'Avec peu de pas, l’écart est grand ; avec beaucoup de pas, les courbes se confondent.',
      });
      c.numeric('q-steps', 'À 30 pas par seconde, combien de pas faut-il pour 3 s ?', 90, '30 × 3 = 90.', { tol: 0.5 });
      c.exercise('step', 'Dans l’atelier, programmez un pas de la chute.');
    });
    c.chapter('Le frottement de l’air', () => {
      c.stage('fall', { h0: 40, k: 0.6 });
      c.diagram('fallPlot');
      c.step('Une force qui freine', 'Le frottement de l’air s’oppose au mouvement. Ici il vaut k·v : plus la balle va vite, plus il freine. La vitesse tend vers une vitesse limite, g/k.', {
        claims: [{ text: 'vitesse limite g/k', check: () => Math.abs(simulate({ h0: 1e4, k: 0.6, duration: 20, dt: 1 / 240 }).at(-1)!.v + 9.81 / 0.6) < 0.01 || 'la vitesse finale n’est pas g/k' }],
      });
      c.question('q-terminal', 'Avec k = 0,5 1/s, quelle est la vitesse limite ?', ['environ 19,6 m/s', 'environ 4,9 m/s', 'environ 9,8 m/s', 'il n’y en a pas'], 'g/k = 9,81 / 0,5 ≈ 19,6 m/s.');
      c.exercise('landing', 'Dans l’atelier, calculez un temps de chute.');
      c.exercise('forces', 'Dans l’atelier, classez forces et grandeurs du mouvement.');
      c.explain('e-terminal', 'Expliquez pourquoi la vitesse cesse d’augmenter quand il y a du frottement.', 'Le frottement grandit avec la vitesse. Quand il égale le poids, l’accélération est nulle : la vitesse ne change plus.');
    });
    c.module('m2');
    c.chapter('Vérifier', () => {
      c.step('Une méthode', 'Pour vérifier une simulation, on la compare à un cas dont on connaît la réponse exacte, par exemple la chute sans frottement. Puis on change un seul réglage à la fois.');
      c.order('q-order', 'Remettez la démarche dans l’ordre.', ['observer le symptôme', 'formuler une hypothèse', 'changer un réglage', 'vérifier et expliquer'], 'C’est la démarche de la clinique.');
      c.exercise('order', 'Dans l’atelier, ordonnez les opérations d’un pas.');
      c.exercise('assembly', 'Dans l’atelier, vérifiez votre simulation complète.');
      c.explain('e-method', 'Pourquoi changer un seul réglage à la fois ?', 'Sinon on ne sait pas lequel a produit l’effet observé.');
    });
    c.clinicCase({
      id: 'clin-1', title: 'une balle qui tombe trop lentement', scene: 'fall', fault: { k: 2 },
      observe: 'Cette balle devrait tomber de 20 m en environ 2 s. Elle met bien plus longtemps.',
      choices: ['le frottement de l’air, trop fort', 'la hauteur de départ, trop grande', 'le pas de temps, trop petit'],
      explain: 'Avec k = 2, la vitesse limite n’est que de 4,9 m/s.',
      controls: [{ type: 'range', key: 'k', label: 'frottement k', min: 0, max: 2, step: 0.05, fmt: dec(2) }, { type: 'range', key: 'h0', label: 'hauteur (m)', min: 5, max: 40, step: 1, fmt: int }],
      goal: { label: 'La balle tombe en environ 2 s', test: (v) => v.k <= 0.1 && Math.abs(v.h0 - 20) < 1 },
      conclusion: 'Sans frottement fort, la balle tombe de 20 m en 2 s environ.',
      justify: 'Le symptôme est une chute lente. Le frottement k limite la vitesse à g/k ; avec k = 2, cette limite est faible. En réduisant k, la balle retrouve une chute presque libre.',
    });
    c.module('exam');
    c.chapter('Test final', () => {
      c.step('Le test final', 'Ce test reprend les notions du test de départ, sous une autre forme.');
      c.test('post', 'Une question.');
    });
  },
});

export default Object.assign(course, { workshop });
void stepRef;
