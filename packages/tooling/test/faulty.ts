// A course full of deliberate faults: `node packages/tooling/test/run.ts`
// checks that the content checker finds every one of them.

import { defineCourse, choice } from '@coursekit/core';

export default defineCourse({
  id: 'faulty', version: 1, language: 'fr', title: 'Défauts', lead: '—',
  // the estimate is a few minutes: the announced effort is far off
  audience: { level: 'lycée', prerequisites: '—', effort: 'dix heures' },
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
  defaults: { k: 1, j: 0 },
  stageKeys: ['k', 'j'],
  scenes: { lab: 'Le labo', absent: 'Une scène que la scène du cours n’a pas', broken: 'Une scène qui ne se prépare pas' },
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
      // a lazy text that fails when it is written
      c.step('Paresseux', () => { throw new Error('modèle indisponible'); });
      c.stage('absent');
      c.step('Ailleurs', 'Une scène inconnue de la scène du cours.');
      c.stage('broken');
      c.step('Cassée', 'Une scène qui ne se prépare pas.');
    });
    // a case whose goal is reached with the fault, whose symptom says nothing,
    // and whose second broken setting has no control
    c.clinicCase({
      id: 'clin-always', title: 'toujours réussi', scene: 'lab', fault: { k: 2, z: 1 },
      observe: 'On observe.', choices: ['k trop grand', 'j trop grand'], explain: '—',
      controls: [{ type: 'range', key: 'k', label: 'k', min: 0, max: 2 }, { type: 'range', key: 'j', label: 'j', min: 0, max: 1 }],
      goal: { label: 'toujours', test: () => true }, symptom: () => 'pareil', conclusion: '—', justify: '—',
    });
    // a case that restoring the fault does not repair
    c.clinicCase({
      id: 'clin-never', title: 'jamais réparé', scene: 'lab', fault: { k: 2 },
      observe: 'On observe.', choices: ['k trop grand', 'autre chose'], explain: '—',
      controls: [{ type: 'range', key: 'k', label: 'k', min: 0, max: 2 }],
      goal: { label: 'jamais', test: (v) => v.k < 0 }, conclusion: '—', justify: '—',
    });
  },
});

/**
 * The faulty course's stage: a read-out out of the safe area, a figure that
 * is not a number, and a scene whose preparation fails.
 */
export const faultyStage = {
  scenes: {
    lab: {
      draw(ctx: CanvasRenderingContext2D, _w: number, _h: number, _t: number, s: Record<string, number>, _d: unknown, safe: { x: number; y: number; w: number; h: number }) {
        ctx.font = '12px sans-serif';
        ctx.fillText('une lecture à gauche de la zone utile', safe.x - 200, safe.y + 20);
        ctx.fillText(`rapport ${s.j ? 1 / 0 : NaN}`, safe.x + 10, safe.y + 60);
      },
    },
    broken: { prepare: () => { throw new Error('simulation impossible'); }, draw() {} },
  },
};
