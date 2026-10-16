// `coursekit new <dir>`: a course project, ready to run, with one module and
// one chapter that use the main elements of the format, a stage scene drawn
// from the model, and a tune file run on several seeds.

import { mkdirSync, writeFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/**
 * The first port from 5181 that no course next to `dir` uses (`vite --port N`
 * in its package.json) and that no `.claude/launch.json` above it reserves.
 */
export function freePort(dir: string, from = 5181): number {
  const used = new Set<number>();
  const scan = (file: string, re: RegExp) => { if (existsSync(file)) for (const m of readFileSync(file, 'utf8').matchAll(re)) used.add(Number(m[1])); };
  const parent = dirname(dir);
  if (existsSync(parent)) for (const d of readdirSync(parent)) scan(join(parent, d, 'package.json'), /--port[ =](\d+)/g);
  for (let d = parent; ; d = dirname(d)) {
    scan(join(d, '.claude', 'launch.json'), /"port"\s*:\s*(\d+)/g);
    if (dirname(d) === d) break;
  }
  let p = from;
  while (used.has(p)) p++;
  return p;
}

export function scaffold(dir: string, title: string): void {
  if (existsSync(join(dir, 'package.json'))) throw new Error(`${dir} contient déjà un projet`);
  const id = basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  const port = freePort(dir);
  mkdirSync(join(dir, 'src'), { recursive: true });
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: `course-${id}`, version: '0.1.0', private: true, type: 'module',
      scripts: { dev: `vite --port ${port} --strictPort`, build: 'vite build', preview: 'vite preview', check: 'coursekit check src/course.ts', tune: 'coursekit tune src/tune.ts' },
      dependencies: { '@coursekit/core': '*', '@coursekit/ui': '*', '@coursekit/diagrams': '*', '@coursekit/exercises': '*' },
      devDependencies: { '@coursekit/tooling': '*' },
    }, null, 2),
    'index.html': `<!doctype html>\n<html lang="fr">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${title}</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n`,
    'vite.config.ts': `import { defineConfig } from 'vite';\n\n// relative asset paths: the built course (dist/) can be served from any folder\nexport default defineConfig({ base: './' });\n`,
    'README.md': `# ${title}\n\nUn cours écrit avec coursekit.\n\n\`\`\`bash\nnpm install          # à la racine du dépôt coursekit\nnpm run dev -w courses/${id}      # http://localhost:${port}\nnpm run tune -w courses/${id}     # régler le modèle\nnpm run check -w courses/${id}    # vérifier le contenu\nnpm run build -w courses/${id}    # site statique dans dist/\n\`\`\`\n\nFichiers : \`src/model.ts\` (le modèle exécutable), \`src/tune.ts\` (son réglage), \`src/course.ts\` (le contenu), \`src/stage.ts\` (la scène, en fond), \`src/main.ts\` (le point d’entrée).\nVoir docs/ecrire-un-cours.md à la racine du dépôt.\n`,
    'src/main.ts': `import '@coursekit/ui/theme.css';\nimport { mountCourse } from '@coursekit/ui';\nimport course from './course.ts';\nimport { stage } from './stage.ts';\n\nconst handle = mountCourse(document.getElementById('app')!, course, { stage: stage(), dev: import.meta.env.DEV });\nif (import.meta.env.DEV) (window as any).course = handle;\n`,
    'src/stage.ts': `// The course's stage: what fills the background, drawn from the model. Keep
// the action and the read-outs in \`safe\`, the part no panel covers:
// \`coursekit check\` draws every scene in a wide and a narrow window and
// reports the texts that leave it.

import { fr } from '@coursekit/core';
import { canvasStage } from '@coursekit/ui';
import { runOf } from './model.ts';

export const stage = () => canvasStage({
  bar: {
    label: 'Le résultat du modèle',
    prepare: (s) => runOf({ x: s.x ?? 1 }),
    draw(ctx, w, h, t, s, data, safe) {
      const r = data as ReturnType<typeof runOf>;
      ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
      // a bar that grows to the result, in the safe area
      const full = Math.min(1, t / 1.5) * Math.min(1, r.result / 10);
      ctx.fillStyle = '#7c9cff';
      ctx.fillRect(safe.x + 12, safe.y + safe.h / 2, (safe.w - 24) * full, 24);
      ctx.fillStyle = 'rgba(230,234,245,.75)'; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(\`x = \${fr(s.x ?? 1, 1)} · résultat \${fr(r.result, 1)}\`, safe.x + 12, safe.y + 12);
    },
  },
});
`,
    'src/course.ts': `import { defineCourse } from '@coursekit/core';\nimport { runOf } from './model.ts';\n\nexport default defineCourse({\n  id: '${id}', version: 1, language: 'fr',\n  title: ${JSON.stringify(title)},\n  lead: 'Une phrase qui dit ce que le cours explique.',\n  audience: { level: 'lycée', prerequisites: 'Ce qu’il faut savoir pour suivre le cours.', effort: 'trois à cinq minutes' },\n  modules: [\n    { id: 'm1', title: 'Premier module', pitch: 'De quoi parle ce module.', goals: ['Ce que l’élève saura faire'], summary: ['Ce qu’il faut retenir'] },\n  ],\n  scenes: { bar: 'Le résultat du modèle' },\n  stageKeys: ['x'],\n  defaults: { x: 1 },\n  content(c) {\n    c.module('m1');\n    c.chapter('Premier chapitre', () => {\n      c.stage('bar', { x: 2 });\n      c.step('Une première étape', 'Un texte court : une idée par étape, soixante-quinze mots au plus.');\n      // a text that quotes the model is written when it is shown: loading the page does not wait for the model\n      c.step('Ce que dit le modèle', () => \`Pour x = 2, le modèle donne \${runOf({ x: 2 }).result}.\`, { claims: [{ text: 'x = 2 donne 4', check: () => runOf({ x: 2 }).result === 4 }] });\n      c.question('q-1', 'Une question ?', ['la bonne réponse, écrite en premier', 'un premier distracteur plausible', 'un second distracteur plausible'], 'L’explication de la réponse.');\n    });\n  },\n});\n`,
    'src/model.ts': `// The course's executable model: pure functions, no DOM. Diagrams, the stage,\n// experiments, exercises and the figures of the text all call it.\n\nimport { memo, rng, type DomainModel } from '@coursekit/core';\n\n/** One run of the model for a set of values (memoised: the stage and the diagrams share it). */\nexport const runOf = memo((v: Record<string, number>) => ({ result: (v.x ?? 1) * 2 }));\n\n/** The same, measured with noise: a seed gives one reproducible run. */\nexport const measureOf = (v: Record<string, number>, seed: number) => {\n  const r = rng(seed);\n  return { result: runOf(v).result + (r() - 0.5) * 0.2 };\n};\n\nexport const model: DomainModel = {\n  name: 'modèle',\n  checks: [{ name: 'un cas dont on connaît la réponse', run: () => (runOf({ x: 2 }).result === 4 ? null : 'résultat inattendu') }],\n};\n`,
    'src/tune.ts': `// Tuning the model before writing the content: \`npm run tune\`. A model that\n// draws at random runs on several seeds; the windows hold for each one.\n\nimport { defineTune } from '@coursekit/tooling';\nimport { measureOf } from './model.ts';\n\nexport default defineTune({\n  title: 'x : résultat mesuré',\n  grid: { x: [0, 1, 2, 5] },\n  seeds: [1, 2, 3, 4, 5],\n  run: (p, seed) => measureOf(p, seed),\n  show: (r) => r.result.toFixed(2),\n  expect: [\n    { label: 'le résultat croît avec x', test: (rows) => rows.every((r, i) => !i || r.r.result >= rows[i - 1].r.result) },\n    { label: 'à x = 2, le résultat est proche de 4 (chaque graine)', where: (p) => p.x === 2, ok: (r) => Math.abs(r.result - 4) < 0.2 },\n    { label: 'à x = 5, au moins 4 graines sur 5 au-dessus de 9,9', where: (p) => p.x === 5, ok: (r) => r.result > 9.9, atLeast: 4 },\n  ],\n});\n`,
  };
  for (const [p, s] of Object.entries(files)) writeFileSync(join(dir, p), s);
}
