#!/usr/bin/env node
// Builds every course of `courses/` into one static site: each course in its
// own folder (`_site/<course>/`), and a home page that lists them. The
// courses are built with relative paths (`base: './'`), so the site can be
// served from any address — GitHub Pages serves it under /<repository>/.
//
//   node scripts/build-site.ts [out]      (default: _site)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { esc } from '@coursekit/core';
import type { Course } from '@coursekit/exercises';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, process.argv[2] ?? '_site');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const dirs = readdirSync(join(root, 'courses'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, 'courses', d.name, 'index.html')))
  .map((d) => d.name)
  .sort();

const entries: { dir: string; course: Course }[] = [];
for (const dir of dirs) {
  const cwd = join(root, 'courses', dir);
  console.log(`— ${dir}`);
  execFileSync('npx', ['vite', 'build', '--outDir', join(out, dir), '--emptyOutDir', '--logLevel', 'warn'], { cwd, stdio: 'inherit' });
  const course = (await import(pathToFileURL(join(cwd, 'src', 'course.ts')).href)).default as Course;
  entries.push({ dir, course });
}

const card = ({ dir, course }: { dir: string; course: Course }) => `
      <a class="card" href="./${encodeURIComponent(dir)}/">
        <span class="level">${esc(course.audience.level)}${course.audience.effort ? ` · ${esc(course.audience.effort)}` : ''}</span>
        <h2>${esc(course.title)}</h2>
        <p>${esc(course.lead)}</p>
      </a>`;

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { description: string };
writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>coursekit · cours d’exemple</title>
    <style>
      :root { --bg: #0d0e12; --panel: #15171d; --line: #262a34; --text: #e8eaf0; --muted: #8b91a1; --accent: #7c9cff; color-scheme: dark; }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 Inter, system-ui, sans-serif; }
      main { max-width: 1000px; margin: 0 auto; padding: 48px 16px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      .lead { color: var(--muted); margin: 0 0 32px; max-width: 640px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
      .card { display: block; padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); color: inherit; text-decoration: none; }
      .card:hover, .card:focus-visible { border-color: var(--accent); }
      .card h2 { margin: 6px 0 8px; font-size: 18px; }
      .card p { margin: 0; color: var(--muted); font-size: 14px; }
      .level { font-size: 12px; color: var(--accent); text-transform: uppercase; letter-spacing: .08em; }
    </style>
  </head>
  <body>
    <main>
      <h1>coursekit</h1>
      <p class="lead">${esc(pkg.description)} Les cours ci-dessous sont les exemples fournis avec la bibliothèque.</p>
      <div class="grid">${entries.map(card).join('')}
      </div>
    </main>
  </body>
</html>
`);
// GitHub Pages: serve the files as they are
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Site écrit dans ${out} (${entries.length} cours).`);
