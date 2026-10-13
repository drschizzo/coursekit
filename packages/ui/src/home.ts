// Home page (modules, objectives, effort, progress, toolbox, reviews,
// summary sheets, glossary, assessment grid), the card shown between
// modules with its summary sheet, and the glossary overlay. Taken from avbd's
// course/home.ts; titles and texts now come from the course.

import { fmtMinutes, moduleStats, type CourseDef, type Glossary, type LabelSet, type Progress, type Stop, type Timeline } from '@coursekit/core';
import { h, esc } from './dom.ts';
import { renderQuiz } from './quiz.ts';

export interface HomeContext {
  course: CourseDef;
  tl: Timeline;
  prog: Progress;
  labels: LabelSet;
  glossary: Glossary;
  moduleLabel(i: number): string;
}

export interface HomeHooks {
  onStart(t: number): void;
  onClose(): void;
  onLab(id?: string): void;
  onCapsule(id: string): void;
  onTest(kind: 'pre' | 'post'): void;
  onGlossary(): void;
}

export class Home {
  root: HTMLElement;
  card: HTMLElement;
  open = false;
  private inTour = false;
  private x: HomeContext;
  private hooks: HomeHooks;

  constructor(x: HomeContext, hooks: HomeHooks) {
    this.x = x; this.hooks = hooks;
    this.root = h('div', 'c-home hidden');
    this.card = h('div', 'c-card hidden');
  }

  private get exercises() { return (this.x.course.exercises ?? []).map((e) => ({ id: e.id, module: e.module, title: e.title })); }

  openHome(inTour: boolean): void {
    this.inTour = inTour;
    this.open = true;
    const { tl, prog, course } = this.x;
    this.root.replaceChildren();
    const inner = h('div', 'home-inner');
    const stats = tl.modules.map((_, i) => moduleStats(tl, prog, i, this.exercises));
    const total = stats.reduce((s, st, i) => s + (tl.modules[i].kind === 'bonus' ? 0 : st.minutes), 0);
    const cores = tl.modules.filter((m) => m.kind === 'core').length;
    const hasExam = tl.modules.some((m) => m.kind === 'exam' && m.chapters.length);

    const hero = h('header', 'home-hero');
    hero.append(
      h('div', 'kicker', inTour ? 'Sommaire' : `Cours interactif · ${cores} modules${hasExam ? ' et une épreuve finale' : ''}`),
      h('h1', undefined, esc(course.title)),
      h('p', 'lead', esc(course.lead)),
    );
    const who = h('div', 'home-who');
    who.append(
      h('div', undefined, `<b>Ce qu’il faut savoir.</b> ${esc(course.audience.prerequisites)}`),
      h('div', undefined, `<b>Temps de travail.</b> ${fmtMinutes(total)} en tout${course.audience.effort ? `, ${esc(course.audience.effort)}` : ''}. Ce temps comprend la lecture, les questions, les expériences et les exercices.`),
    );
    hero.append(who);
    const cta = h('div', 'home-cta');
    const resumeT = prog.d.lastT > 5 && prog.d.lastT < tl.duration - 5 ? prog.d.lastT : 0;
    const go = h('button', 'c-btn go big') as HTMLButtonElement;
    if (inTour) { go.textContent = 'Reprendre ▶'; go.onclick = () => this.hooks.onClose(); } else if (resumeT) {
      const ch = tl.chapters[tl.chapterAt(resumeT)];
      go.innerHTML = `Reprendre ▶ <small>${esc(this.x.moduleLabel(ch.module))} · ${esc(ch.title)}</small>`;
      go.onclick = () => this.hooks.onStart(resumeT);
    } else { go.textContent = 'Commencer le cours ▶'; go.onclick = () => this.hooks.onStart(0); }
    cta.append(go);
    if (course.tests?.pre?.length && !prog.d.tests.pre?.done) {
      const t = h('button', 'c-btn big', 'Test de départ') as HTMLButtonElement;
      t.title = 'Quelques questions pour situer vos connaissances';
      t.onclick = () => this.hooks.onTest('pre');
      cta.append(t);
    }
    if (course.exercises?.length) {
      const lab = h('button', 'c-btn big', esc(this.x.labels.workshop)) as HTMLButtonElement;
      lab.onclick = () => this.hooks.onLab();
      cta.append(lab);
    }
    if (resumeT && !inTour) {
      const restart = h('button', 'c-link', 'Recommencer depuis le début') as HTMLButtonElement;
      restart.onclick = () => this.hooks.onStart(0);
      cta.append(restart);
    }
    hero.append(cta);

    if (prog.started) {
      let q = 0, qr = 0, mi = 0, md = 0, mods = 0, cd = 0, cn = 0;
      tl.modules.forEach((m, i) => {
        const s = stats[i];
        q += s.quiz; qr += s.right; mi += s.missions; md += s.missDone; cd += s.codeDone; cn += s.code;
        if (m.kind === 'core' && prog.d.done[m.id]) mods++;
      });
      hero.append(h('div', 'home-stats',
        `<span><b>${mods}</b> / ${cores} modules terminés</span><span><b>${qr}</b> / ${q} bonnes premières réponses</span><span><b>${md}</b> / ${mi} expériences</span>${cn ? `<span><b>${cd}</b> / ${cn} exercices</span>` : ''}`));
    }
    inner.append(hero, this.toolsRow());

    const grid = h('div', 'home-mods');
    tl.modules.forEach((m, i) => { if (m.chapters.length) grid.append(this.moduleCard(i, stats[i])); });
    inner.append(grid);
    if (course.rubric?.length) inner.append(this.rubric());

    const foot = h('footer', 'home-foot');
    if (prog.started) {
      const rst = h('button', 'c-link', 'Effacer ma progression') as HTMLButtonElement;
      rst.onclick = () => {
        if (confirm('Effacer votre progression (étapes vues, réponses, révisions, expériences, explications, tests, exercices) ?')) { prog.reset(); this.openHome(this.inTour); }
      };
      const exp = h('button', 'c-link', 'Télécharger ma progression') as HTMLButtonElement;
      exp.onclick = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([prog.export()], { type: 'application/json' }));
        a.download = `progression-${course.id}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      foot.append(rst, exp);
    }
    foot.append(h('span', undefined, '→ ou Espace : étape suivante · ← : étape précédente · M : sommaire · L : atelier · G : glossaire · progression enregistrée dans ce navigateur'));
    inner.append(foot);
    this.root.append(inner);
    if (inTour) {
      const x = h('button', 'home-x', '✕') as HTMLButtonElement;
      x.title = 'Fermer (Échap)';
      x.onclick = () => this.hooks.onClose();
      this.root.append(x);
    }
    this.root.classList.remove('hidden');
  }

  private toolsRow(): HTMLElement {
    const { prog, tl, course } = this.x;
    const row = h('div', 'home-tools');

    const answered = tl.bank.filter((s) => s.id in prog.d.rev);
    const due = prog.due(answered.map((s) => s.id));
    const rev = h('section', 'home-tool');
    rev.append(h('h3', undefined, 'Révisions'),
      h('p', undefined, answered.length
        ? `${due.length} question${due.length > 1 ? 's' : ''} à revoir. Les questions manquées, ou auxquelles vous avez répondu sans certitude, reviennent après un intervalle de plus en plus long à chaque bonne réponse.`
        : 'Les questions auxquelles vous répondez dans le cours reviendront ici, à intervalles espacés.'));
    const rb = h('button', 'c-btn', due.length ? `Réviser ${Math.min(5, due.length)} question${Math.min(5, due.length) > 1 ? 's' : ''}` : 'Réviser quand même') as HTMLButtonElement;
    rb.disabled = !answered.length;
    rb.onclick = () => this.reviewSession();
    rev.append(rb);
    row.append(rev);

    if (course.toolbox?.length) {
      const box = h('section', 'home-tool');
      box.append(h('h3', undefined, 'Boîte à outils'), h('p', undefined, 'Des fiches courtes sur les outils que le cours utilise. Celles que le test de départ recommande sont signalées.'));
      const pre = prog.d.tests.pre;
      const recommended = new Set(pre?.done ? (course.tests?.tools ?? []).filter((it) => !pre.a[it.id]).map((it) => it.tool) : []);
      const chips = h('div', 'home-chips');
      for (const c of course.toolbox) {
        const b = h('button', `home-chip${prog.d.tools[c.id] ? ' done' : ''}${recommended.has(c.id) && !prog.d.tools[c.id] ? ' rec' : ''}`) as HTMLButtonElement;
        b.textContent = `${prog.d.tools[c.id] ? '✓ ' : ''}${c.title}`;
        b.title = `${c.goal}${recommended.has(c.id) ? ' (recommandée par le test de départ)' : ''}`;
        b.onclick = () => this.hooks.onCapsule(c.id);
        chips.append(b);
      }
      box.append(chips);
      row.append(box);
    }

    const more = h('section', 'home-tool');
    more.append(h('h3', undefined, 'Pour retrouver une notion'), h('p', undefined, `Le glossaire définit ${this.x.glossary.terms.length} termes. Les fiches de synthèse résument chaque module et peuvent être imprimées.`));
    const r2 = h('div', 'home-chips');
    const gl = h('button', 'c-btn', 'Glossaire') as HTMLButtonElement;
    gl.onclick = () => this.hooks.onGlossary();
    const sh = h('button', 'c-btn', 'Fiches de synthèse') as HTMLButtonElement;
    sh.onclick = () => this.sheets();
    r2.append(gl, sh);
    if (course.tests?.pre?.length) {
      const t1 = h('button', 'c-btn', prog.d.tests.pre?.done ? 'Test de départ ✓' : 'Test de départ') as HTMLButtonElement;
      t1.onclick = () => this.hooks.onTest('pre');
      r2.append(t1);
    }
    if (prog.d.tests.post?.done) {
      const t2 = h('button', 'c-btn', 'Test final ✓') as HTMLButtonElement;
      t2.onclick = () => this.hooks.onTest('post');
      r2.append(t2);
    }
    more.append(r2);
    row.append(more);
    return row;
  }

  private moduleCard(i: number, s: ReturnType<typeof moduleStats>): HTMLElement {
    const { tl, prog, course } = this.x;
    const m = tl.modules[i];
    const def = course.modules[i];
    const el = h('section', `mod ${m.kind}${prog.d.done[m.id] ? ' done' : ''}`);
    const head = h('div', 'mod-head');
    head.append(
      h('span', 'mod-n', m.kind === 'bonus' ? '★' : m.kind === 'exam' ? '✓' : String(i)),
      h('div', 'mod-t', `<b>${esc(def.title)}</b><small>${esc(this.x.moduleLabel(i))} · ${s.chapters} chapitre${s.chapters > 1 ? 's' : ''} · ${fmtMinutes(s.minutes)}</small>`),
    );
    el.append(head, h('p', 'mod-pitch', esc(def.pitch)));
    const ul = h('ul', 'mod-goals');
    for (const g of def.goals) ul.append(h('li', undefined, esc(g)));
    el.append(h('div', 'mod-sub', 'À la fin de ce module, vous saurez :'), ul);
    const bar = h('div', 'mod-bar');
    const fill = h('i');
    fill.style.width = `${s.chapters ? (s.seen / s.chapters) * 100 : 0}%`;
    bar.append(fill);
    el.append(bar);
    const st = h('div', 'mod-stats');
    st.append(h('span', undefined, `${s.seen}/${s.chapters} chapitres`));
    if (s.quiz) st.append(h('span', undefined, `${s.right}/${s.quiz} réponses`));
    if (s.missions) st.append(h('span', undefined, `${s.missDone}/${s.missions} expériences`));
    if (s.code) st.append(h('span', undefined, `${s.codeDone}/${s.code} exercices`));
    if (s.explain) st.append(h('span', undefined, `${s.explainDone}/${s.explain} explications`));
    el.append(st);
    const det = h('details', 'mod-chaps');
    det.append(h('summary', undefined, 'Chapitres'));
    const ol = h('ol');
    for (const k of m.chapters) {
      const ch = tl.chapters[k];
      const li = h('li', prog.d.seen[k] ? 'seen' : '');
      const b = h('button', 'c-link', esc(ch.title)) as HTMLButtonElement;
      b.onclick = () => this.hooks.onStart(ch.t + 0.01);
      li.append(b);
      ol.append(li);
    }
    det.append(ol);
    el.append(det);
    const btn = h('button', 'c-btn', s.seen ? 'Reprendre ce module ▶' : 'Commencer ce module ▶') as HTMLButtonElement;
    btn.onclick = () => this.hooks.onStart(m.t0 + 0.01);
    el.append(btn);
    return el;
  }

  private rubric(): HTMLElement {
    const el = h('details', 'home-rubric');
    el.append(h('summary', undefined, 'Comment le travail est évalué'));
    for (const p of this.x.course.rubric ?? []) el.append(h('p', undefined, this.x.glossary.rich(p)));
    return el;
  }

  // ---------------------------------------------------------- review session

  private reviewSession(): void {
    const { tl, prog, course } = this.x;
    const answered = tl.bank.filter((s) => s.id in prog.d.rev);
    let ids = prog.due(answered.map((s) => s.id));
    if (!ids.length) ids = answered.map((s) => s.id).sort((a, b) => prog.d.rev[a].box - prog.d.rev[b].box);
    const qs = ids.slice(0, 5).map((id) => answered.find((s) => s.id === id)!) as Stop[];
    prog.newSession();
    const ov = h('div', 'c-capsule');
    const box = h('div', 'cap-inner');
    ov.append(box);
    this.root.append(ov);
    let k = 0, ok = 0;
    let key: ((i: number) => void) | null = null;
    const close = () => { window.removeEventListener('keydown', onKey, true); ov.remove(); this.openHome(this.inTour); };
    const onKey = (ev: KeyboardEvent) => {
      const tgt = ev.target as HTMLElement | null;
      if (tgt && /INPUT|TEXTAREA/.test(tgt.tagName)) return;
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
      const i = ['1', '2', '3', '4'].indexOf(ev.key);
      if (i >= 0 && key) { ev.preventDefault(); ev.stopPropagation(); key(i); }
    };
    window.addEventListener('keydown', onKey, true);
    const next = () => {
      box.replaceChildren();
      const x = h('button', 'home-x', '✕') as HTMLButtonElement;
      x.onclick = close;
      box.append(x, h('div', 'kicker', 'Révision'));
      if (k >= qs.length) {
        box.append(h('h2', undefined, 'Révision terminée'), h('p', undefined, `${ok} bonne${ok > 1 ? 's' : ''} réponse${ok > 1 ? 's' : ''} sur ${qs.length}. Les questions manquées reviendront à la prochaine révision ; les autres, plus tard.`));
        const f = h('div', 'card-foot');
        const b = h('button', 'c-btn go', 'Fermer') as HTMLButtonElement;
        b.onclick = close;
        f.append(b);
        box.append(f);
        key = null;
        return;
      }
      const q = qs[k];
      const qEl = h('div', 'c-try');
      const r = renderQuiz(qEl, q.quiz!, {
        feedback: true, confidence: true, tag: `Question ${k + 1} / ${qs.length}`, head: course.modules[q.quiz!.module]?.title,
        onDone: (res) => {
          if (res.ok) ok++;
          prog.answer(q.id, res.ok, res.conf);
          const f = h('div', 'card-foot');
          const b = h('button', 'c-btn go', k + 1 < qs.length ? 'Question suivante ▶' : 'Terminer') as HTMLButtonElement;
          b.onclick = () => { k++; next(); };
          f.append(b);
          box.append(f);
          b.focus();
          key = null;
        },
      });
      key = (i) => r.key(i);
      box.append(qEl);
    };
    next();
  }

  // ------------------------------------------------------------ the sheets

  private sheets(): void {
    const ov = h('div', 'c-capsule c-sheets');
    const box = h('div', 'cap-inner wide');
    ov.append(box);
    this.root.append(ov);
    const close = () => { window.removeEventListener('keydown', onKey, true); ov.remove(); };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    const x = h('button', 'home-x', '✕') as HTMLButtonElement;
    x.onclick = close;
    const pr = h('button', 'c-btn', 'Imprimer') as HTMLButtonElement;
    pr.onclick = () => { document.body.classList.add('printing-sheets'); window.print(); document.body.classList.remove('printing-sheets'); };
    box.append(x, h('div', 'kicker', 'Fiches de synthèse'), h('h2', undefined, 'Ce qu’il faut retenir'), pr);
    this.x.course.modules.forEach((_, i) => { if (this.x.tl.modules[i].chapters.length) box.append(this.sheet(i)); });
  }

  private sheet(i: number): HTMLElement {
    const m = this.x.course.modules[i];
    const el = h('section', 'sheet');
    el.append(h('h4', undefined, `${esc(this.x.moduleLabel(i))} · ${esc(m.title)}`));
    const ul = h('ul');
    for (const s of m.summary) ul.append(h('li', undefined, esc(s)));
    el.append(ul);
    return el;
  }

  closeHome(): void { this.open = false; this.root.classList.add('hidden'); }

  // ------------------------------------------------------------ module card

  showCard(st: Stop): void {
    const { tl, prog, course } = this.x;
    const from = st.from ?? -1, to = st.to ?? null;
    const el = this.card;
    el.replaceChildren();
    const inner = h('div', 'card-inner');
    if (from >= 0) {
      const m = tl.modules[from];
      const s = moduleStats(tl, prog, from, this.exercises);
      prog.done(m.id);
      inner.append(
        h('div', 'kicker', `${esc(this.x.moduleLabel(from))} terminé`),
        h('h2', undefined, esc(course.modules[from].title)),
        h('div', 'card-stats', `<span><b>${s.right}</b>/${s.quiz} bonnes réponses</span><span><b>${s.missDone}</b>/${s.missions} expériences</span>${s.code ? `<span><b>${s.codeDone}</b>/${s.code} exercices</span>` : ''}`),
        this.sheet(from),
      );
      const missing = this.exercises.filter((c) => c.module === m.id && !prog.d.code[c.id]?.done);
      if (missing.length) {
        const p = h('p', 'card-todo', `Exercice${missing.length > 1 ? 's' : ''} de l’atelier à faire pour ce module : `);
        missing.forEach((c, k) => {
          const b = h('button', 'c-link', esc(c.title)) as HTMLButtonElement;
          b.onclick = () => this.hooks.onLab(c.id);
          p.append(b);
          if (k < missing.length - 1) p.append(', ');
        });
        inner.append(p);
      }
    }
    if (to != null && tl.modules[to]) {
      const def = course.modules[to];
      const nx = h('div', 'card-next');
      nx.append(
        h('div', 'kicker', from >= 0 ? `Ensuite : ${esc(this.x.moduleLabel(to))}` : 'Pour commencer'),
        h('h3', undefined, esc(def.title)),
        h('p', undefined, esc(def.pitch)),
        h('div', 'mod-sub', 'À la fin de ce module, vous saurez :'),
      );
      const ul = h('ul', 'mod-goals');
      for (const g of def.goals) ul.append(h('li', undefined, esc(g)));
      nx.append(ul);
      if (from >= 0) nx.append(h('p', 'card-tip', 'Si vous vous arrêtez ici, reprenez la prochaine fois depuis le sommaire : le module suivant commence par quelques questions de révision.'));
      inner.append(nx);
    } else if (from >= 0 && to == null) {
      inner.append(h('p', 'card-end', 'Vous avez terminé le cours. Les révisions et les fiches de synthèse restent disponibles depuis le sommaire.'));
    }
    const foot = h('div', 'card-foot');
    const go = h('button', 'c-btn go big', esc(this.x.labels.continue)) as HTMLButtonElement;
    go.onclick = () => this.hooks.onClose();
    const menu = h('button', 'c-btn', esc(this.x.labels.menu)) as HTMLButtonElement;
    menu.onclick = () => { this.hideCard(); this.openHome(true); };
    foot.append(menu, go);
    inner.append(foot);
    el.append(inner);
    el.classList.remove('hidden');
    setTimeout(() => go.focus(), 30);
  }

  hideCard(): void { this.card.classList.add('hidden'); }
}

// ----------------------------------------------------------------- glossary

/** The glossary, searchable, over whatever is on screen. */
export function openGlossary(root: HTMLElement, glossary: Glossary, capsuleTitle: (id: string) => string | null, onCapsule: (id: string) => void, onClose: () => void): void {
  const ov = h('div', 'c-capsule');
  const box = h('div', 'cap-inner wide');
  ov.append(box);
  root.append(ov);
  const close = () => { window.removeEventListener('keydown', onKey, true); ov.remove(); onClose(); };
  const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); } };
  window.addEventListener('keydown', onKey, true);
  const x = h('button', 'home-x', '✕') as HTMLButtonElement;
  x.title = 'Fermer (Échap)';
  x.onclick = close;
  const search = h('input', 'gl-search') as HTMLInputElement;
  search.placeholder = 'Rechercher un terme…';
  search.addEventListener('keydown', (ev) => { if (ev.key !== 'Escape') ev.stopPropagation(); });
  const list = h('dl', 'gl-list');
  const sorted = glossary.terms.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const paint = () => {
    const q = norm(search.value.trim());
    list.replaceChildren();
    for (const t of sorted) {
      if (q && !norm(`${t.name} ${(t.forms ?? []).join(' ')} ${t.def}`).includes(q)) continue;
      const dd = h('dd', undefined, esc(t.def));
      const title = t.tool ? capsuleTitle(t.tool) : null;
      if (title) {
        const b = h('button', 'c-link', `Fiche : ${esc(title)}`) as HTMLButtonElement;
        b.onclick = () => { close(); onCapsule(t.tool!); };
        dd.append(' ', b);
      }
      list.append(h('dt', undefined, esc(t.name)), dd);
    }
    if (!list.children.length) list.append(h('p', undefined, 'Aucun terme ne correspond.'));
  };
  search.addEventListener('input', paint);
  box.append(x, h('div', 'kicker', 'Glossaire'), h('h2', undefined, 'Les termes du cours'), search, list);
  paint();
  setTimeout(() => search.focus(), 30);
}
