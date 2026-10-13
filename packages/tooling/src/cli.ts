#!/usr/bin/env node
// coursekit — the command line.
//   coursekit check <course.ts>   the four levels of checks, a readable report
//   coursekit stats <course.ts>   chapters, steps, questions, estimated time
//   coursekit new <dir> [title]   a new course project, ready to run

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { checkCourse } from './check.ts';
import { scaffold } from './scaffold.ts';

const [cmd, arg, ...rest] = process.argv.slice(2);

async function load(file: string) {
  const mod = await import(pathToFileURL(resolve(file)).href);
  return mod.default;
}

async function main(): Promise<number> {
  if (cmd === 'check' && arg) {
    const r = checkCourse(await load(arg));
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
    const r = checkCourse(await load(arg));
    for (const [k, v] of Object.entries(r.stats)) console.log(`${k.padEnd(14)} ${v}`);
    return 0;
  }
  if (cmd === 'new' && arg) {
    scaffold(resolve(arg), rest.join(' ') || 'Nouveau cours');
    console.log(`Projet créé dans ${arg}. Ensuite : npm install, puis npm run dev.`);
    return 0;
  }
  console.log('usage : coursekit check <course.ts> | stats <course.ts> | new <dossier> [titre]');
  return 2;
}

main().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
