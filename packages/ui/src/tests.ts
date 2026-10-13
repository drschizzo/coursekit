// The start test and the final test, in an overlay, one question at a time,
// without corrections until the end. The start test has two parts: the tools
// (each missed question recommends a capsule) and the course's notions
// (a reference point). The final test asks the same notions in other words;
// each of its items names its pair, so the results compare skill by skill.
// Taken from avbd's course/assess.ts; the questions now come from the course.

import type { Capsule, TestItem, TestRecord, Tests } from '@coursekit/core';
import { h, esc } from './dom.ts';
import { renderQuiz } from './quiz.ts';

export interface TestHooks {
  onDone(kind: 'pre' | 'post', rec: TestRecord): void;
  onCapsule(id: string): void;
  onClose(): void;
  /** the start test's record, to compare with in the final test */
  pre?: TestRecord;
}

export function openTest(root: HTMLElement, kind: 'pre' | 'post', tests: Tests, capsules: Capsule[], hooks: TestHooks): void {
  const A = tests.tools ?? [], PRE = tests.pre ?? [], POST = tests.post ?? [];
  const items: { part: 'a' | 'b'; it: TestItem }[] = kind === 'pre'
    ? [...A.map((it) => ({ part: 'a' as const, it })), ...PRE.map((it) => ({ part: 'b' as const, it }))]
    : POST.map((it) => ({ part: 'b' as const, it }));
  const rec: TestRecord = { done: false, a: {}, b: {} };
  const el = h('div', 'c-capsule');
  const box = h('div', 'cap-inner');
  el.append(box);
  root.append(el);
  let i = -1;
  let keyFn: ((k: number) => void) | null = null;

  const close = () => { window.removeEventListener('keydown', onKey, true); el.remove(); hooks.onClose(); };
  const onKey = (ev: KeyboardEvent) => {
    const tgt = ev.target as HTMLElement | null;
    if (tgt && /INPUT|TEXTAREA/.test(tgt.tagName)) return;
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); return; }
    const k = ['1', '2', '3', '4'].indexOf(ev.key);
    if (k >= 0 && keyFn) { ev.preventDefault(); ev.stopPropagation(); keyFn(k); }
  };
  window.addEventListener('keydown', onKey, true);

  const header = () => {
    box.replaceChildren();
    const x = h('button', 'home-x', '✕') as HTMLButtonElement;
    x.title = 'Fermer (Échap) : le test pourra être repris depuis le début';
    x.onclick = close;
    box.append(x, h('div', 'kicker', kind === 'pre' ? 'Test de départ' : 'Test final'));
  };

  const intro = () => {
    header();
    box.append(h('h2', undefined, kind === 'pre' ? 'Test de départ' : 'Test final'));
    if (kind === 'pre') {
      box.append(h('p', undefined, `Ce test compte ${items.length} questions. Il ne donne pas de note : il sert à orienter votre travail.`));
      if (A.length) box.append(h('p', undefined, `<b>Partie A</b> (${A.length} questions) : les outils utilisés dans le cours. Chaque question manquée vous orientera vers une fiche de la boîte à outils.`));
      if (PRE.length) box.append(h('p', undefined, `<b>Partie B</b> (${PRE.length} questions) : les notions du cours. Vous n’êtes pas censé connaître les réponses. Répondez au mieux, sans chercher : ces questions reviendront, sous une autre forme, à la fin du cours.`));
      box.append(h('p', undefined, 'Les corrections ne sont pas affichées pendant le test, pour ne pas influencer les questions suivantes. Elles sont données à la fin.'));
    } else {
      box.append(
        h('p', undefined, 'Ce test reprend, sous une autre forme, les questions sur les notions du test de départ. Les deux résultats sont comparés compétence par compétence.'),
        h('p', undefined, 'Les corrections sont données à la fin.'),
      );
    }
    const foot = h('div', 'card-foot');
    const go = h('button', 'c-btn go', 'Commencer ▶') as HTMLButtonElement;
    go.onclick = () => { i = 0; ask(); };
    foot.append(go);
    box.append(foot);
    setTimeout(() => go.focus(), 30);
  };

  const ask = () => {
    if (i >= items.length) { results(); return; }
    header();
    const { part, it } = items[i];
    const prog = h('div', 'test-prog');
    const fill = h('i');
    fill.style.width = `${(i / items.length) * 100}%`;
    prog.append(fill);
    box.append(prog);
    const label = kind === 'pre' && A.length ? `Partie ${part.toUpperCase()} · question ${i + 1} / ${items.length}` : `Question ${i + 1} / ${items.length}`;
    const qEl = h('div', 'c-try');
    const foot = h('div', 'card-foot');
    const next = h('button', 'c-btn go', i + 1 < items.length ? 'Question suivante ▶' : 'Voir les résultats ▶') as HTMLButtonElement;
    next.disabled = true;
    next.onclick = () => { i++; ask(); };
    const skip = h('button', 'c-btn ghost', 'Je ne sais pas') as HTMLButtonElement;
    skip.onclick = () => { (part === 'a' ? rec.a : rec.b)[it.id] = 0; i++; ask(); };
    const r = renderQuiz(qEl, it.q, {
      feedback: false, confidence: false, tag: it.skill, head: label,
      onDone: (res) => { (part === 'a' ? rec.a : rec.b)[it.id] = res.ok ? 1 : 0; next.disabled = false; skip.disabled = true; next.focus(); },
    });
    keyFn = (k) => r.key(k);
    foot.append(skip, next);
    box.append(qEl, foot);
  };

  const sum = (r: Record<string, 0 | 1>) => Object.values(r).reduce<number>((s, v) => s + v, 0);

  const results = () => {
    keyFn = null;
    rec.done = true;
    hooks.onDone(kind, rec);
    header();
    box.append(h('h2', undefined, 'Résultats'));
    if (kind === 'pre') {
      box.append(h('p', undefined, [A.length ? `Partie A (outils) : <b>${sum(rec.a)} / ${A.length}</b>.` : '', PRE.length ? `Partie B (notions) : <b>${sum(rec.b)} / ${PRE.length}</b>.` : ''].join(' ')));
      const miss = A.filter((it) => !rec.a[it.id] && it.tool);
      if (miss.length) {
        box.append(h('h3', undefined, 'Fiches recommandées'), h('p', undefined, 'Ces fiches de la boîte à outils correspondent aux questions manquées. Le cours vous les rappellera au moment où l’outil est utilisé.'));
        const row = h('div', 'test-tools');
        for (const id of [...new Set(miss.map((it) => it.tool!))]) {
          const c = capsules.find((x) => x.id === id);
          if (!c) continue;
          const b = h('button', 'c-btn', esc(c.title)) as HTMLButtonElement;
          b.title = c.used;
          b.onclick = () => { close(); hooks.onCapsule(c.id); };
          row.append(b);
        }
        box.append(row);
      } else if (A.length) box.append(h('p', undefined, 'Tous les outils de la partie A sont acquis. La boîte à outils reste disponible si vous avez besoin d’un rappel.'));
    } else {
      const pre = hooks.pre;
      box.append(h('p', undefined, `Score : <b>${sum(rec.b)} / ${POST.length}</b>${pre?.done ? ` (test de départ : ${sum(pre.b)} / ${PRE.length})` : ''}.`));
      const tbl = h('table', 'test-table');
      tbl.append(h('tr', undefined, '<th>Compétence</th><th>Départ</th><th>Fin</th>'));
      for (const it of POST) {
        const a = pre?.done && it.pair ? (pre.b[it.pair] ? '✓' : '—') : '·';
        tbl.append(h('tr', undefined, `<td>${esc(it.skill)}</td><td>${a}</td><td>${rec.b[it.id] ? '✓' : '—'}</td>`));
      }
      box.append(tbl);
    }
    box.append(h('h3', undefined, 'Corrections'));
    const ul = h('ol', 'test-corr');
    for (const { part, it } of items) {
      const ok = (part === 'a' ? rec.a : rec.b)[it.id];
      const ans = it.q.kind === 'number' ? `${String(it.q.value).replace('.', ',')}${it.q.unit ? ` ${it.q.unit}` : ''}` : it.q.kind === 'order' ? it.q.choices.join(' → ') : it.q.choices[it.q.answer];
      ul.append(h('li', ok ? 'ok' : 'ko', `<b>${esc(it.skill)}</b> — ${esc(it.q.question)}<br><span>Réponse : ${esc(ans)}. ${esc(it.q.explain)}</span>`));
    }
    box.append(ul);
    const foot = h('div', 'card-foot');
    const done = h('button', 'c-btn go', 'Fermer') as HTMLButtonElement;
    done.onclick = close;
    foot.append(done);
    box.append(foot);
  };

  intro();
}
