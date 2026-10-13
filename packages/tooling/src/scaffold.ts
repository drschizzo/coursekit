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
      scripts: { dev: 'vite', build: 'vite build', check: 'coursekit check src/course.ts' },
      dependencies: { '@coursekit/core': '*', '@coursekit/ui': '*', '@coursekit/diagrams': '*', '@coursekit/exercises': '*' },
      devDependencies: { '@coursekit/tooling': '*', vite: '^6.4.1', typescript: '^5.9.3' },
    }, null, 2),
    'index.html': `<!doctype html>\n<html lang="fr">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${title}</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.ts"></script>\n  </body>\n</html>\n`,
    'src/main.ts': `import '@coursekit/ui/theme.css';\nimport { mountCourse } from '@coursekit/ui';\nimport course from './course.ts';\n\nconst handle = mountCourse(document.getElementById('app')!, course);\nif (import.meta.env.DEV) (window as any).course = handle;\n`,
    'src/course.ts': `import { defineCourse } from '@coursekit/core';\n\nexport default defineCourse({\n  id: '${id}', version: 1, language: 'fr',\n  title: ${JSON.stringify(title)},\n  lead: 'Une phrase qui dit ce que le cours explique.',\n  audience: { level: 'lycée', prerequisites: 'Ce qu’il faut savoir pour suivre le cours.' },\n  modules: [\n    { id: 'm1', title: 'Premier module', pitch: 'De quoi parle ce module.', goals: ['Ce que l’élève saura faire'], summary: ['Ce qu’il faut retenir'] },\n  ],\n  content(c) {\n    c.module('m1');\n    c.chapter('Premier chapitre', () => {\n      c.step('Une première étape', 'Un texte court : une idée par étape, soixante-quinze mots au plus.');\n      c.question('q-1', 'Une question ?', ['la bonne réponse, écrite en premier', 'un distracteur', 'un autre distracteur'], 'L’explication de la réponse.');\n    });\n  },\n});\n`,
  };
  for (const [p, s] of Object.entries(files)) writeFileSync(join(dir, p), s);
}
