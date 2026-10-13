// Every rule must fire on the faulty course; the demo course must pass.
import { checkCourse } from '../src/check.ts';
import faulty from './faulty.ts';

const expected = ['step-length', 'tone', 'link', 'term-order', 'claim', 'answer-length', 'test-pair', 'offered', 'model', 'walk', 'summary'];
const r = checkCourse(faulty as any);
const rules = new Set(r.findings.map((f) => f.rule));
let bad = 0;
for (const e of expected) { if (rules.has(e)) console.log(`✓ ${e}`); else { bad++; console.log(`✗ la règle ${e} n’a rien trouvé`); } }
console.log(bad ? `${bad} règle(s) muette(s)` : `Les ${expected.length} règles détectent leur défaut.`);
process.exit(bad ? 1 : 0);
