#!/usr/bin/env node
// coursekit — the command line.
//   coursekit check <course.ts>   the four levels of checks, a readable report
//                                 (with the scenes of stage.ts, next to it)
//   coursekit stats <course.ts>   chapters, steps, questions, estimated time
//   coursekit parcours <course.ts> [out.md]
//                                 the course as the learner meets it, in
//                                 reading order: texts, what the diagram and
//                                 the scene show, questions and answers
//   coursekit tune <tune.ts>      sweep the model's parameters, check its windows
//   coursekit new <dir> [title]   a new course project, ready to run

import { existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { scaffold } from './scaffold.ts';
import type { SceneLike } from './screen.ts';

const [cmd, arg, ...rest] = process.argv.slice(2);

async function load(file: string) {
  const mod = await import(pathToFileURL(resolve(file)).href);
  return mod.default;
}

/** The stage next to the course file (`stage.ts`, exporting `stage()` or a default), for the checker. */
async function loadStage(courseFile: string): Promise<{ stage?: { scenes?: Record<string, SceneLike> }; stageError?: string }> {
  const file = join(dirname(resolve(courseFile)), 'stage.ts');
  if (!existsSync(file)) return {};
  try {
    const mod = await import(pathToFileURL(file).href);
    const s = mod.stage ?? mod.default;
    return { stage: typeof s === 'function' ? s() : s };
  } catch (e) { return { stageError: String((e as Error)?.message ?? e) }; }
}

async function main(): Promise<number> {
  // the checker and the tuner load the other packages: imported on demand, so
  // that `coursekit new` also works before the first `npm install`
  if (cmd === 'check' && arg) {
    const { checkCourse } = await import('./check.ts');
    const r = checkCourse(await load(arg), await loadStage(arg));
    const errors = r.findings.filter((f) => f.level === 'error');
    const warnings = r.findings.filter((f) => f.level === 'warning');
    console.log(`Cours « ${r.course} »`);
    console.log('  ' + Object.entries(r.stats).map(([k, v]) => `${v} ${k}`).join(' · '));
    for (const f of errors) console.log(`  ✗ [${f.rule}] ${f.msg}`);
    for (const f of warnings) console.log(`  ! [${f.rule}] ${f.msg}`);
    console.log(r.ok ? `  ✓ prêt (${warnings.length} remarque${warnings.length > 1 ? 's' : ''})` : `  ${errors.length} erreur${errors.length > 1 ? 's' : ''}`);
    return r.ok ? 0 : 1;
  }
  if (cmd === 'stats' && arg) {
    const { checkCourse } = await import('./check.ts');
    const r = checkCourse(await load(arg));
    for (const [k, v] of Object.entries(r.stats)) console.log(`${k.padEnd(14)} ${v}`);
    return 0;
  }
  if (cmd === 'parcours' && arg) {
    const { parcours } = await import('./parcours.ts');
    const { stage } = await loadStage(arg);
    const md = parcours(await load(arg), stage?.scenes);
    if (rest[0]) { writeFileSync(resolve(rest[0]), md); console.log(`Parcours écrit dans ${rest[0]}.`); }
    else console.log(md);
    return 0;
  }
  if (cmd === 'tune' && arg) {
    const { runTune } = await import('./tune.ts');
    const mod = await import(pathToFileURL(resolve(arg)).href);
    const specs = Array.isArray(mod.default) ? mod.default : [mod.default];
    let failed = 0;
    for (const spec of specs) {
      const r = runTune(spec);
      console.log(r.lines.join('\n'));
      console.log('');
      failed += r.failures.length;
    }
    return failed ? 1 : 0;
  }
  if (cmd === 'new' && arg) {
    scaffold(resolve(arg), rest.join(' ') || 'Nouveau cours');
    console.log(`Projet créé dans ${arg}. Ensuite, à la racine du dépôt : npm install, puis npm run dev -w ${arg}.`);
    return 0;
  }
  console.log('usage : coursekit check <course.ts> | stats <course.ts> | parcours <course.ts> [sortie.md] | tune <tune.ts> | new <dossier> [titre]');
  return 2;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
