// `coursekit new <dir>`: a course project, ready to run, with one module and
// one chapter that use the main elements of the format.

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

export function scaffold(dir: string, title: string): void {
  if (existsSync(join(dir, 'package.json'))) throw new Error(`${dir} contient déjà un projet`);
  const id = basename(dir).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  mkdirSync(join(dir, 'src'), { recursive: true });
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: `course-${id}`, private: true, type: 'module',
      scripts: { dev: 'vite', build: 'vite build', check: 'coursekit check src/course.ts', tune: 'coursekit tune src/tune.ts' },
      dependencies: { '@coursekit/core': '*', '@coursekit/ui': '*', '@coursekit/diagrams': '*', '@coursekit/exercises': '*' },
      devDependencies: { '@coursekit/tooling': '*', vite: '^6.4.1', typescript: '^5.9.3' },
    }, null, 2),
    'index.html': `<!doctype html>\n<html lang="fr">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${title}</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n`,
    'src/main.ts': `import '@coursekit/ui/theme.css';\nimport { mountCourse } from '@coursekit/ui';\nimport course from './course.ts';\n\nconst handle = mountCourse(document.getElementById('app')!, course, { dev: import.meta.env.DEV });\nif (import.meta.env.DEV) (window as any).course = handle;\n`,
    'src/course.ts': `import { defineCourse } from '@coursekit/core';\n\nexport default defineCourse({\n  id: '${id}', version: 1, language: 'fr',\n  title: ${JSON.stringify(title)},\n  lead: 'Une phrase qui dit ce que le cours explique.',\n  audience: { level: 'lycée', prerequisites: 'Ce qu’il faut savoir pour suivre le cours.' },\n  modules: [\n    { id: 'm1', title: 'Premier module', pitch: 'De quoi parle ce module.', goals: ['Ce que l’élève saura faire'], summary: ['Ce qu’il faut retenir'] },\n  ],\n  content(c) {\n    c.module('m1');\n    c.chapter('Premier chapitre', () => {\n      c.step('Une première étape', 'Un texte court : une idée par étape, soixante-quinze mots au plus.');\n      c.question('q-1', 'Une question ?', ['la bonne réponse, écrite en premier', 'un premier distracteur plausible', 'un second distracteur plausible'], 'L’explication de la réponse.');\n    });\n  },\n});\n`,
    'src/model.ts': `// The course's executable model: pure functions, no DOM. Diagrams, the stage,\n// experiments, exercises and the figures of the text all call it.\n\nimport { memo, type DomainModel } from '@coursekit/core';\n\n/** One run of the model for a set of values (memoised: the stage and the diagrams share it). */\nexport const runOf = memo((v: Record<string, number>) => ({ result: (v.x ?? 1) * 2 }));\n\nexport const model: DomainModel = {\n  name: 'modèle',\n  checks: [{ name: 'un cas dont on connaît la réponse', run: () => (runOf({ x: 2 }).result === 4 ? null : 'résultat inattendu') }],\n};\n`,
    'src/tune.ts': `// Tuning the model before writing the content: \`npm run tune\`.\n\nimport { defineTune } from '@coursekit/tooling';\nimport { runOf } from './model.ts';\n\nexport default defineTune({\n  title: 'x : résultat',\n  grid: { x: [0, 1, 2, 5] },\n  run: (p) => runOf(p),\n  show: (r) => String(r.result),\n  expect: [{ label: 'le résultat croît avec x', test: (rows) => rows.every((r, i) => !i || r.r.result >= rows[i - 1].r.result) }],\n});\n`,
  };
  for (const [p, s] of Object.entries(files)) writeFileSync(join(dir, p), s);
}
