// Every rule must fire on the faulty course; the demo course must pass.
import { checkCourse } from '../src/check.ts';
import faulty from './faulty.ts';

const expected = ['step-length', 'tone', 'link', 'term-order', 'claim', 'answer-length', 'test-pair', 'offered', 'model', 'walk', 'layout', 'summary'];
const r = checkCourse(faulty as any);
// the walk must catch the NaN that appears only at the control's bound
const nan = r.findings.some((f) => f.rule === 'walk' && f.msg.includes('non numérique'));
const rules = new Set(r.findings.map((f) => f.rule));
let bad = 0;
for (const e of expected) { if (rules.has(e)) console.log(`✓ ${e}`); else { bad++; console.log(`✗ la règle ${e} n’a rien trouvé`); } }
if (nan) console.log('✓ walk aux bornes des contrôles'); else { bad++; console.log('✗ le NaN aux bornes n’a pas été trouvé'); }
console.log(bad ? `${bad} règle(s) muette(s)` : `Les ${expected.length} règles détectent leur défaut.`);
process.exit(bad ? 1 : 0);
