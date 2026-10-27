// A small course that uses every kind of pause, for the core's tests.

import { defineCourse } from '../src/index.ts';

export default defineCourse({
  id: 'fixture', version: 1, language: 'fr', title: 'Fixture', lead: '—',
  audience: { level: '—', prerequisites: '—' },
  modules: [
    { id: 'm1', title: 'Un', pitch: '—', goals: ['—'], summary: ['—'] },
    { id: 'm2', title: 'Deux', pitch: '—', goals: ['—'], summary: ['—'] },
    { id: 'x', title: 'Épreuve', pitch: '—', goals: ['—'], summary: ['—'], kind: 'exam' },
  ],
  defaults: { a: 1, b: 10 },
  stageKeys: ['a'],
  content(c) {
    c.module('m1');
    c.chapter('Premier', () => {
      c.stage('scene', { a: 2 });
      c.step('Une', 'Un texte court pour la première étape du cours.');
      c.question('q1', 'Quelle réponse ?', ['la bonne', 'une autre', 'une troisième'], '—');
      c.step('Deux', 'Une deuxième étape.', { code: 'a = {{a|0|5|1}}' });
      c.experiment({
        id: 'e1', title: 'Essai', prompt: 'Faites varier a.', predict: { question: '?', choices: ['oui', 'non'], answer: 0 },
        controls: [{ type: 'range', key: 'a', label: 'a', min: 0, max: 5 }],
        goals: [{ label: 'a = 5', test: ({ v }) => v.a === 5 }], conclusion: '—',
      });
      c.step('Trois', 'Une troisième étape.');
    });
    c.module('m2');
    c.chapter('Second', () => {
      c.step('Quatre', () => 'Un texte écrit à la lecture.');
      c.explain('x1', 'Expliquez.', 'Une réponse modèle.');
      c.test('post', 'Le test final.');
      c.set({ b: 20 });
      c.step('Cinq', 'La dernière étape.');
    });
    c.module('x');
    c.chapter('Épreuve', () => {
      c.step('Six', 'Une question d’examen.');
      c.numeric('q2', 'Combien ?', 4, '—');
    });
  },
});
