// A course full of deliberate faults: `node packages/tooling/test/run.ts`
// checks that the content checker finds every one of them.

import { defineCourse, choice } from '@coursekit/core';

export default defineCourse({
  id: 'faulty', version: 1, language: 'fr', title: 'Défauts', lead: '—',
  audience: { level: 'lycée', prerequisites: '—' },
  modules: [
    { id: 'm1', title: 'Un', pitch: '—', goals: ['—'], summary: ['—'] },
    { id: 'm2', title: 'Deux', pitch: '—', goals: ['—'], summary: [] },
  ],
  glossary: [{ id: 'late', name: 'notion tardive', def: '—', module: 'm2' }],
  tests: {
    pre: [{ id: 'b1', skill: 'x', q: choice('?', ['a', 'b'], '—') }],
    post: [{ id: 'p1', skill: 'x', q: choice('?', ['a', 'b'], '—') }],
  },
  exercises: [{ id: 'orphan', module: 'm1', title: 'jamais proposé', kind: 'sequence', items: ['a', 'b'], intro: '—', explain: '—', win: '—' } as any],
  // a diagram whose labels leave the frame and overlap, and which prints NaN
  // when its experiment's control reaches zero
  diagrams: {
    messy: (ctx: CanvasRenderingContext2D, e: { v: Record<string, number> }) => {
      ctx.font = '11px sans-serif';
      ctx.fillText('un libellé bien trop long pour tenir dans le cadre du schéma', 200, 20);
      ctx.fillText('premier', 40, 100);
      ctx.fillText('second', 42, 101);
      ctx.fillText(`rapport ${(1 / e.v.k) * 0}`, 40, 200);
    },
  },
  defaults: { k: 1 },
  model: { name: 'faux', checks: [{ name: 'toujours faux', run: () => 'échec voulu' }] },
  content(c) {
    c.module('m1');
    c.chapter('Un', () => {
      c.step('Trop long', Array.from({ length: 90 }, () => 'mot').join(' '));
      c.step('Ton', 'Une découverte incroyable !', { tools: ['T99'] });
      c.step('Terme', 'Ici on parle déjà de la notion tardive.', { claims: [{ text: 'faux', check: () => false }] });
      c.diagram('absent');
      c.step('Schéma', 'Un schéma qui n’existe pas.', { hud: () => { throw new Error('boum'); } });
      c.question('q1', 'Laquelle ?', ['une réponse juste nettement plus longue que les autres', 'non', 'faux'], '—');
      c.exercise('inconnu', '—');
    });
    c.module('m2');
    c.chapter('Deux', () => {
      c.diagram('messy');
      c.step('Fin', 'Fin.');
      c.experiment({ title: 'k', prompt: '—', controls: [{ type: 'range', key: 'k', label: 'k', min: 0, max: 2 }] });
    });
  },
});
