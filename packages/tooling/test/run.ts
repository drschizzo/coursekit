// The tooling's tests: `node packages/tooling/test/run.ts`.
//   - every rule of the checker fires on the faulty course, with its stage;
//   - the demo course passes;
//   - lazy texts wait for their first reading, and the checker writes them;
//   - the tuner's seeds, per-seed windows and summaries;
//   - rng, wilson, the effort parser, the port of `coursekit new`.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile, defineCourse, effortMinutes, rng, wilson } from '@coursekit/core';
import { checkCourse } from '../src/check.ts';
import { defineTune, runTune, summarize } from '../src/tune.ts';
import { freePort } from '../src/scaffold.ts';
import faulty, { faultyStage } from './faulty.ts';
import demo from '../../../courses/demo-mini/src/course.ts';
import { stage as demoStage } from '../../../courses/demo-mini/src/stage.ts';

let bad = 0, n = 0;
const ok = (name: string, cond: boolean, detail = '') => {
  n++;
  if (cond) console.log(`✓ ${name}`);
  else { bad++; console.log(`✗ ${name}${detail ? ` — ${detail}` : ''}`); }
};

// ---------------------------------------------------------- the checker
console.log('Vérificateur');
const expected = [
  'step-length', 'tone', 'link', 'term-order', 'claim', 'answer-length', 'test-pair', 'offered', 'model', 'walk', 'layout', 'summary',
  'clinic', 'effort', 'stage', 'stage-layout', 'spoiler', 'term-early', 'repeat',
];
const r = checkCourse(faulty as any, { stage: faultyStage as any });
const rules = new Set(r.findings.map((f) => f.rule));
const has = (rule: string, part: string) => r.findings.some((f) => f.rule === rule && f.msg.includes(part));
for (const e of expected) ok(`la règle ${e} trouve son défaut`, rules.has(e));
// the walk must catch the NaN that appears only at the control's bound
ok('walk aux bornes des contrôles', has('walk', 'non numérique'));
ok('un texte paresseux qui échoue est signalé', has('walk', 'texte calculé lève une erreur (modèle indisponible)'));
ok('cas clinique : objectif déjà atteint avec le défaut', has('clinic', 'clin-always : avec le réglage fautif'));
ok('cas clinique : réglage fautif sans contrôle', has('clinic', 'le réglage fautif z n’a pas de contrôle'));
ok('cas clinique : symptôme qui ne distingue pas le défaut', has('clinic', 'est aussi celui de « j » = 1'));
ok('cas clinique : rétablir le défaut ne répare pas', has('clinic', 'clin-never : en rétablissant k = 1'));
ok('scène : texte hors de la zone utile, dans les deux zones', has('stage-layout', 'zone large : texte hors de la zone utile') && has('stage-layout', 'zone étroite : texte hors de la zone utile'));
ok('scène : texte non numérique', has('stage', 'texte non numérique « rapport NaN »'));
ok('scène : texte non numérique au bout d’un contrôle', has('stage', '« rapport Infinity »'));
ok('scène : préparation qui échoue', has('stage', 'la préparation lève une erreur (simulation impossible)'));
ok('scène : inconnue de la scène du cours', has('link', 'scène inconnue de la scène du cours : absent'));
ok('effort annoncé loin de l’estimation', has('effort', '« dix heures »'));
ok('réponse numérique écrite sur le schéma', has('spoiler', 'question q-num : la réponse (72) se lit dans le schéma tells'));
ok('ordre attendu écrit sur le schéma', has('spoiler', 'question q-ord : l’ordre attendu se lit dans le schéma tells'));
ok('réglage fautif écrit sur la scène pendant le diagnostic', has('spoiler', 'cas clin-always : le réglage fautif (k = 2) est écrit dans la scène lab'));
ok('terme montré par un schéma avant son module', has('term-early', '« notion tardive » apparaît dans le schéma tells') && has('term-early', 'avant le module'));
ok('terme montré par un schéma avant toute étape', has('term-early', '« notion précoce » apparaît dans le schéma tells') && has('term-early', 'avant toute étape'));
ok('deux questions qui posent la même chose', has('repeat', 'question q-r1 et question q-r2'));

const d = checkCourse(demo, { stage: demoStage() });
ok('le cours de démonstration est prêt, sans remarque', d.ok && !d.findings.length, d.findings.map((f) => `[${f.rule}] ${f.msg}`).join(' ; '));

// ----------------------------------------------------------- lazy texts
console.log('\nTextes paresseux');
let written = 0;
const lazyCourse = defineCourse({
  id: 'lazy', version: 1, language: 'fr', title: '—', lead: '—', audience: { level: '—', prerequisites: '—' },
  modules: [{ id: 'm', title: 'M', pitch: '—', goals: ['—'], summary: ['—'] }],
  content(c) {
    c.module('m');
    c.chapter('Un', () => {
      c.step('Calculé', () => { written++; return `Le modèle donne ${2 + 2}.`; });
      c.step('Long', () => 'mot '.repeat(90));
      c.question('q', 'Combien ?', ['quatre', 'cinq'], '—');
    });
  },
});
const tl = compile(lazyCourse);
ok('compiler n’écrit pas le texte', written === 0);
ok('un texte paresseux a une durée par défaut', tl.caps[0].dwell === 12 && tl.caps[0].lazy);
ok('le texte est écrit à la lecture, une seule fois', tl.caps[0].text === 'Le modèle donne 4.' && tl.caps[0].text.length > 0 && written === 1);
const lr = checkCourse(lazyCourse);
ok('le vérificateur écrit les textes paresseux et les vérifie', lr.findings.some((f) => f.rule === 'step-length' && f.msg.includes('« Long »')));

// ---------------------------------------------------------------- tune
console.log('\nRéglage');
const seen: number[] = [];
const spec = defineTune({
  title: 'graines',
  grid: { a: [1, 2] },
  seeds: [3, 4, 5],
  run: (p, seed) => { seen.push(seed); return { a: p.a, seed, win: seed !== 5 }; },
  show: (x) => (x.win ? 'gagne' : 'perd'),
  expect: [
    { label: 'chaque graine a une graine', ok: (x) => x.seed > 0 },
    { label: 'au moins 2 sur 3 gagnent', ok: (x) => x.win, atLeast: 2 },
    { label: 'chaque graine gagne', where: (p) => p.a === 2, ok: (x) => x.win },
    { label: 'au plus 0 perd', ok: (x) => !x.win, atMost: 0 },
    { label: 'une fenêtre écrite sur les lignes', test: (rows) => rows.every((x) => x.runs.length === 3 && x.r === x.runs[0]) },
  ],
});
const tr = runTune(spec);
ok('run reçoit chaque graine pour chaque combinaison', seen.join(',') === '3,4,5,3,4,5');
ok('l’en-tête donne les graines', tr.lines.includes('3 graines : 3, 4, 5'));
ok('la ligne résume les graines', tr.lines.some((l) => l === 'a = 1  →  gagne ×2 · perd ×1'), tr.lines.join(' | '));
ok('« chaque graine » et « au moins k » passent', !tr.failures.some((f) => f.startsWith('chaque graine a') || f.startsWith('au moins')));
ok('« chaque graine » échoue en disant où et combien', tr.failures.some((f) => f === 'chaque graine gagne : a = 2 : 2/3'), tr.failures.join(' | '));
ok('« au plus k » échoue', tr.failures.some((f) => f.startsWith('au plus 0 perd : a = 1 : 1/3 ; a = 2 : 1/3')));
ok('les fenêtres écrites sur les lignes voient les graines', !tr.failures.some((f) => f.startsWith('une fenêtre')));
const single = runTune(defineTune({ grid: { a: [1, 2, 3] }, run: (p, seed) => p.a * seed, expect: [{ label: 'sans graines, chaque ligne', ok: (x) => x < 3 }] }));
ok('sans graines : une exécution avec la graine 1, chaque ligne est une graine', single.lines.includes('a = 3  →  3') && single.failures[0] === 'sans graines, chaque ligne : a = 3 : 0/1');
ok('résumé : valeurs identiques', summarize(['x', 'x', 'x']) === 'x');
ok('résumé : nombres, médiane et étendue', summarize(['0.4', '0.1', '0.3', '0.2', '0.5']) === '0.3 [0.1–0.5]');

// ------------------------------------------------- core and scaffolding
console.log('\nHasard, statistiques, durée, port');
const a = rng(42), b = rng(42), c = rng(43);
const sa = [a(), a(), a()], sb = [b(), b(), b()];
ok('rng : même graine, même suite', sa.every((x, i) => x === sb[i]) && c() !== sa[0] && sa.every((x) => x >= 0 && x < 1));
const [lo, hi] = wilson(10, 100);
ok('wilson(10, 100) ≈ [5,5 %, 17,4 %]', Math.abs(lo - 0.0552) < 1e-3 && Math.abs(hi - 0.1744) < 1e-3, `${lo} ${hi}`);
ok('wilson(0, 50) ne se réduit pas à un point', wilson(0, 50)[0] === 0 && wilson(0, 50)[1] > 0.05);
const eff = (s: string) => JSON.stringify(effortMinutes(s));
ok('effort : « trois à quatre heures »', eff('trois à quatre heures') === '[180,240]');
ok('effort : « 90 min », « une heure et demie »', eff('90 min') === '[90,90]' && eff('une heure et demie') === '[90,90]');
ok('effort : « en une séance » ne donne pas de durée', effortMinutes('en une séance') === null);
const root = mkdtempSync(join(tmpdir(), 'coursekit-'));
for (const [dir, port] of [['a', 5181], ['b', 5182]] as const) {
  mkdirSync(join(root, dir));
  writeFileSync(join(root, dir, 'package.json'), JSON.stringify({ scripts: { dev: `vite --port ${port} --strictPort` } }));
}
ok('coursekit new : le premier port libre', freePort(join(root, 'nouveau')) === 5183);
mkdirSync(join(root, '.claude'));
writeFileSync(join(root, '.claude', 'launch.json'), JSON.stringify({ configurations: [{ name: 'x', port: 5183 }] }));
ok('coursekit new : sans les ports réservés par .claude/launch.json', freePort(join(root, 'nouveau')) === 5184);
rmSync(root, { recursive: true, force: true });

console.log(bad ? `\n${bad} test(s) en échec sur ${n}` : `\nLes ${n} tests passent.`);
process.exit(bad ? 1 : 0);
