// The step panel and everything around it while a course is read: the text,
// note, code with draggable values, « Rappel » buttons, previous / next, the
// diagram canvas, the pauses (questions, reviews, experiments with a
// prediction, written explanations, workshop and test invitations), the
// glossary tooltips and the timeline. Taken from avbd's course/tourUI.ts.

import type { Capsule, CourseDef, DiagramEnv, Glossary, LabelSet, Stop, Timeline, Vals, Control, Confidence } from '@coursekit/core';
import { DH, DW } from '@coursekit/diagrams';
import { h, esc } from './dom.ts';
import { highlight, highlightLive, decimals } from './highlight.ts';
import { renderQuiz } from './quiz.ts';

export interface PanelContext {
  course: CourseDef;
  glossary: Glossary;
  labels: LabelSet;
  capsule(id: string): Capsule | undefined;
  moduleLabel(i: number): string;
  /** draws a named diagram (the course's or the toolbox's) */
  draw(name: string, ctx: CanvasRenderingContext2D, env: DiagramEnv): void;
}

export interface PanelHooks {
  onSeek(t: number): void;
  onStop(st: Stop): void;
  onToggle(): void;
  onResume(): void;
  onNext(): void;
  onPrev(): void;
  onPauses(on: boolean): void;
  onStepMode(on: boolean): void;
  onLive(key: string, v: number, until: number): void;
  onCard(st: Stop): void;
  onQuiz(id: string, ok: boolean, conf: Confidence | null): void;
  onMission(id: string): void;
  onPredict(id: string, i: number): void;
  onExplain(id: string, patch: { text?: string; self?: 0 | 1 | 2 }): void;
  /** questions to ask in a review pause (chosen when it is reached) */
  onReview(st: Stop): Stop[];
  onMenu(): void;
  onLab(exercise?: string): void;
  onTest(kind: 'pre' | 'post'): void;
  onCapsule(id: string): void;
  onGlossary(): void;
  onQuit(): void;
  onViewReset(): void;
  explainText(id: string): string;
  labStatus(id: string): { title: string; done: boolean };
  testDone(kind: 'pre' | 'post'): boolean;
  toolDone(id: string): boolean;
}

interface LiveVal { el: HTMLElement; key: string; min: number; max: number; step: number; dec: number; busy: boolean; v?: number }

export class Panel {
  root: HTMLElement;
  private tl: Timeline;
  private hooks: PanelHooks;
  private x: PanelContext;
  private cap: HTMLElement;
  private kicker: HTMLElement;
  private title: HTMLElement;
  private body: HTMLElement;
  private note: HTMLElement;
  private codeEl: HTMLElement;
  private hudEl: HTMLElement;
  private layersEl: HTMLElement;
  private toolsEl: HTMLElement;
  private liveHint: HTMLElement;
  private tryEl: HTMLElement;
  private navEl: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private diagEl: HTMLElement;
  private ctx: CanvasRenderingContext2D;
  private chapterEl: HTMLElement;
  private clockEl: HTMLElement;
  private playBtn: HTMLButtonElement;
  private pausesBtn: HTMLButtonElement;
  private stepBtn: HTMLButtonElement;
  private badge: HTMLElement;
  private viewEl: HTMLButtonElement;
  private tip: HTMLElement;
  private segs: { el: HTMLElement; fill: HTMLElement; t0: number; t1: number }[] = [];
  private marks: HTMLElement[] = [];

  private capIdx = -1;
  private capTok = 0;
  private cv: HTMLCanvasElement;
  private cssW = 0;
  private diagKey: string | null | undefined = undefined;
  private shownStop: Stop | null | undefined;
  private lives: LiveVal[] = [];
  private ctlSync: Record<string, (v: number) => void> = {};
  private goalEls: HTMLElement[] | null = null;
  private goBtn: HTMLButtonElement | null = null;
  private tagEl: HTMLElement | null = null;
  private conclEl: HTMLElement | null = null;
  private quizKey: ((i: number) => void) | null = null;
  private hud: ((v: Vals) => string) | null = null;

  private tops: HTMLElement[] = [];
  private barEl!: HTMLElement;
  private roomEl!: HTMLElement;

  constructor(tl: Timeline, hooks: PanelHooks, x: PanelContext) {
    this.tl = tl; this.hooks = hooks; this.x = x;
    const L = x.labels;
    this.root = h('div', 'course hidden');

    const top = h('div', 'c-top');
    this.chapterEl = h('span', 'c-where');
    this.clockEl = h('span', 'c-clock');
    top.append(this.chapterEl, this.clockEl);

    const actions = h('div', 'c-actions');
    this.stepBtn = h('button', 'c-chip on') as HTMLButtonElement;
    this.stepBtn.innerHTML = `<span class="sw"><i></i></span>${esc(L.stepMode)}`;
    this.stepBtn.title = 'Activé : la visite attend que vous cliquiez sur « Suivant » à chaque étape. Désactivé : lecture continue.';
    this.stepBtn.onclick = () => hooks.onStepMode(!tl.stepMode);
    this.pausesBtn = h('button', 'c-chip on') as HTMLButtonElement;
    this.pausesBtn.innerHTML = `<span class="sw"><i></i></span>${esc(L.pauses)}`;
    this.pausesBtn.title = 'La visite s’arrête pour les questions, les expériences et les exercices (repères sur la frise)';
    this.pausesBtn.onclick = () => hooks.onPauses(!tl.pauses);
    const gloss = h('button', 'c-chip', esc(L.glossary)) as HTMLButtonElement;
    gloss.title = 'Tous les termes du cours (G)';
    gloss.onclick = () => hooks.onGlossary();
    const menu = h('button', 'c-chip', esc(L.menu)) as HTMLButtonElement;
    menu.title = 'Modules, chapitres, boîte à outils, fiches et progression (M)';
    menu.onclick = () => hooks.onMenu();
    actions.append(this.stepBtn, this.pausesBtn, gloss, menu);
    if (x.course.exercises?.length) {
      const lab = h('button', 'c-chip', esc(L.workshop)) as HTMLButtonElement;
      lab.title = 'Les exercices de l’atelier (L)';
      lab.onclick = () => hooks.onLab();
      actions.append(lab);
    }

    this.kicker = h('div', 'kicker');
    this.title = h('h2');
    this.body = h('p', 'c-text');
    this.note = h('p', 'c-note');
    this.layersEl = h('div', 'c-layers');
    this.hudEl = h('div', 'c-hud');
    this.codeEl = h('pre', 'c-code');
    this.toolsEl = h('div', 'c-tools');
    this.liveHint = h('div', 'c-livehint hidden', '↔ Les valeurs soulignées sont modifiables : faites-les glisser, ou cliquez pour taper un nombre.');
    this.tryEl = h('div', 'c-try hidden');
    this.navEl = h('div', 'c-nav');
    this.prevBtn = h('button', 'c-btn ghost', esc(L.prev)) as HTMLButtonElement;
    this.prevBtn.title = 'Étape précédente (←)';
    this.prevBtn.onclick = () => hooks.onPrev();
    this.nextBtn = h('button', 'c-btn go', esc(L.next)) as HTMLButtonElement;
    this.nextBtn.title = 'Étape suivante (→)';
    this.nextBtn.onclick = () => hooks.onNext();
    this.navEl.append(this.prevBtn, h('span', 'c-step'), this.nextBtn);
    this.cap = h('div', 'c-cap panel');
    this.cap.append(this.kicker, this.title, this.body, this.note, this.layersEl, this.hudEl, this.codeEl, this.liveHint, this.toolsEl, this.tryEl, this.navEl);

    this.cv = h('canvas');
    this.ctx = this.cv.getContext('2d')!;
    this.diagEl = h('div', 'c-diag panel out');
    this.diagEl.append(this.cv);
    this.sizeCanvas();

    this.playBtn = h('button', 'c-play', '❚❚') as HTMLButtonElement;
    this.playBtn.title = 'Mettre en pause les animations';
    this.playBtn.onclick = () => hooks.onToggle();
    const mods = h('div', 'c-mods');
    const chaps = h('div', 'c-chaps');
    const timeline = h('div', 'c-timeline');
    timeline.title = 'Cliquer pour aller à un chapitre';
    timeline.append(mods, chaps);
    timeline.onclick = (ev) => {
      const r = chaps.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * tl.duration;
      hooks.onSeek(tl.chapters[tl.chapterAt(t)].t + 0.01);
    };
    const bar = h('div', 'c-bar');
    bar.append(this.playBtn, timeline);

    this.badge = h('div', 'c-badge');
    this.viewEl = h('button', 'c-cam') as HTMLButtonElement;
    this.viewEl.onclick = () => hooks.onViewReset();
    this.setViewFree(false);
    this.tip = h('div', 'c-tip hidden');

    // the bars along the top: the toolbar wraps under the title when they do not fit
    const headRow = h('div', 'c-headrow');
    headRow.append(top, actions);
    const head = h('div', 'c-head');
    head.append(headRow, this.badge, this.viewEl);
    // on a narrow screen the panels stack in a column; this empty box is the stage's share of it
    this.roomEl = h('div', 'c-room');
    this.root.append(head, this.roomEl, this.diagEl, this.cap, bar, this.tip);
    this.tops = [top, actions, this.badge];
    this.barEl = bar;

    // one segment per chapter
    tl.chapters.forEach((ch, i) => {
      const end = i + 1 < tl.chapters.length ? tl.chapters[i + 1].t : tl.duration;
      const el = h('div', 'c-seg');
      el.style.flex = String(end - ch.t);
      el.innerHTML = `<i></i><span>${esc(ch.part === ch.title ? ch.title : `${ch.part} · ${ch.title}`)}</span>`;
      if (i && ch.module !== tl.chapters[i - 1].module) el.classList.add('mod-start');
      const kind = tl.modules[ch.module]?.kind;
      if (kind && kind !== 'core') el.classList.add(kind);
      chaps.append(el);
      this.segs.push({ el, fill: el.firstChild as HTMLElement, t0: ch.t, t1: end });
    });
    tl.modules.forEach((m, i) => {
      if (!m.chapters.length) return;
      const l = h('span');
      l.style.left = `${(m.t0 / tl.duration) * 100}%`;
      l.style.width = `${((m.t1 - m.t0) / tl.duration) * 100}%`;
      l.textContent = m.kind === 'bonus' ? L.bonus : m.kind === 'exam' ? L.exam : String(tl.modules.slice(0, i + 1).filter((k) => k.kind === 'core').length);
      l.title = `${x.moduleLabel(i)} · ${m.title}`;
      mods.append(l);
    });
    this.marks = tl.stops.filter((s) => s.kind !== 'card').map((st) => {
      const m = h('b', `stop-mark ${st.kind}`);
      m.style.left = `${(st.t / tl.duration) * 100}%`;
      m.title = st.kind === 'quiz' ? 'Question' : st.kind === 'review' ? 'Révision' : st.kind === 'explain' ? 'Explication écrite' : st.kind === 'lab' ? `Atelier : ${hooks.labStatus(st.lab!).title}` : st.kind === 'test' ? st.title : `Expérience : ${st.title}`;
      m.onclick = (ev) => { ev.stopPropagation(); hooks.onStop(st); };
      timeline.append(m);
      return m;
    });

    // the diagram reacts to the pointer during a hands-on pause
    const toDiag = (ev: PointerEvent | MouseEvent) => {
      const r = this.cv.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * DW, y: ((ev.clientY - r.top) / r.height) * DH };
    };
    this.cv.addEventListener('pointermove', (ev) => { if (tl.stop?.diag) tl.ptr = toDiag(ev); });
    this.cv.addEventListener('pointerleave', () => { if (tl.stop?.diag) tl.ptr = null; });
    this.cv.addEventListener('pointerdown', (ev) => {
      if (!tl.stop?.diag) return;
      const p = toDiag(ev);
      tl.ptr = p;
      tl.hits.add(`${Math.floor(p.x / 20)},${Math.floor(p.y / 20)}`);
    });

    // glossary tooltips
    const showTip = (el: HTMLElement) => {
      const t = x.glossary.term(el.dataset.g ?? '');
      if (!t) return;
      this.tip.replaceChildren(h('b', undefined, esc(t.name)), h('p', undefined, esc(t.def)));
      const c = t.tool ? x.capsule(t.tool) : null;
      if (c) {
        const b = h('button', 'c-link', `Fiche : ${esc(c.title)}`) as HTMLButtonElement;
        b.onmousedown = (ev) => { ev.preventDefault(); hooks.onCapsule(c.id); };
        this.tip.append(b);
      }
      this.tip.classList.remove('hidden');
      const r = el.getBoundingClientRect();
      this.tip.style.left = `${Math.min(innerWidth - 312, Math.max(12, r.left))}px`;
      this.tip.style.top = `${r.bottom + 6}px`;
      const th = this.tip.offsetHeight;
      if (r.bottom + 6 + th > innerHeight - 8) this.tip.style.top = `${r.top - th - 6}px`;
    };
    let hideT = 0;
    const hideTip = () => { hideT = window.setTimeout(() => this.tip.classList.add('hidden'), 120); };
    const glOf = (ev: Event) => (ev.target as HTMLElement).closest?.('.gl') as HTMLElement | null;
    this.cap.addEventListener('mouseover', (ev) => { const el = glOf(ev); if (el) { clearTimeout(hideT); showTip(el); } });
    this.cap.addEventListener('mouseout', (ev) => { if (glOf(ev)) hideTip(); });
    this.cap.addEventListener('focusin', (ev) => { const el = glOf(ev); if (el) { clearTimeout(hideT); showTip(el); } });
    this.cap.addEventListener('focusout', (ev) => { if (glOf(ev)) hideTip(); });
    this.tip.addEventListener('mouseover', () => clearTimeout(hideT));
    this.tip.addEventListener('mouseout', hideTip);
  }

  /** The drawing space stays DW × DH; the backing store follows the CSS size. */
  private sizeCanvas(): void {
    const w = this.cv.clientWidth || DW;
    if (w === this.cssW) return;
    this.cssW = w;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const scale = (w / DW) * dpr;
    this.cv.width = Math.round(DW * scale);
    this.cv.height = Math.round(DH * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
    if (on) { this.capIdx = -1; this.diagKey = undefined; this.shownStop = undefined; }
  }

  setPauses(on: boolean): void {
    this.pausesBtn.classList.toggle('on', on);
    for (const m of this.marks) m.classList.toggle('off', !on);
  }

  setStepMode(on: boolean): void { this.stepBtn.classList.toggle('on', on); }

  setViewFree(free: boolean): void {
    this.viewEl.classList.toggle('free', free);
    this.viewEl.textContent = free ? '⟲ Revenir à la vue de départ' : '';
    this.viewEl.disabled = !free;
  }

  /**
   * Where the panels sit, in viewport pixels: the bars along the top, the
   * text panel, the diagram (its place is kept even when hidden, so that the
   * safe area does not move between steps) and the timeline at the bottom.
   * On a narrow screen, where the panels stack, `room` is the part of the
   * column left to the stage (empty otherwise).
   */
  regions(): { tops: DOMRect[]; cap: DOMRect; diag: DOMRect; bar: DOMRect; room: DOMRect } {
    const vis = (e: HTMLElement) => e.offsetParent !== null;
    return {
      tops: this.tops.filter(vis).map((e) => e.getBoundingClientRect()),
      cap: this.cap.getBoundingClientRect(),
      diag: this.diagEl.getBoundingClientRect(),
      bar: this.barEl.getBoundingClientRect(),
      room: this.roomEl.getBoundingClientRect(),
    };
  }

  setBadge(txt: string, cls = ''): void {
    this.badge.textContent = txt;
    this.badge.className = `c-badge ${cls}${txt ? '' : ' hidden'}`;
  }

  /** Redraws the pause the learner is in (after the workshop or a test closed). */
  refreshStop(): void { this.shownStop = undefined; }

  // --------------------------------------------------------------- caption

  private setCaption(i: number): void {
    const c = this.tl.caps[i];
    if (!c) return;
    const tok = ++this.capTok;
    const fill = () => {
      if (tok !== this.capTok) return;
      this.kicker.textContent = c.kicker;
      this.title.textContent = c.title;
      const seen = new Set<string>();
      this.body.innerHTML = this.x.glossary.rich(c.text, seen);
      this.note.innerHTML = c.note ? this.x.glossary.rich(c.note, seen) : '';
      this.note.classList.toggle('hidden', !c.note);
      this.codeEl.innerHTML = c.code ? highlightLive(c.code) : '';
      this.codeEl.classList.toggle('hidden', !c.code);
      this.bindLive(i);
      this.layersEl.replaceChildren();
      const layers = this.x.course.layers ?? [];
      this.layersEl.classList.toggle('hidden', !c.layers || !layers.length);
      if (c.layers) layers.forEach((n, k) => this.layersEl.append(h('span', k < c.layers ? 'on' : undefined, esc(n))));
      this.toolsEl.replaceChildren();
      for (const id of c.tools) {
        const cp = this.x.capsule(id);
        if (!cp) continue;
        const b = h('button', `c-toolbtn${this.hooks.toolDone(id) ? ' done' : ''}`) as HTMLButtonElement;
        b.innerHTML = `<span>${esc(this.x.labels.reminder)}</span>${esc(cp.title)}`;
        b.title = `Ouvrir la fiche de la boîte à outils : ${cp.goal}`;
        b.onclick = () => this.hooks.onCapsule(id);
        this.toolsEl.append(b);
      }
      this.toolsEl.classList.toggle('hidden', !c.tools.length);
      this.hud = c.hud;
      this.cap.classList.remove('out');
      this.cap.scrollTop = 0;
    };
    this.cap.classList.add('out');
    if (this.capIdx < 0) fill(); else setTimeout(fill, 200);
    this.capIdx = i;
  }

  /** Draggable numbers inside the displayed code. */
  private bindLive(i: number): void {
    const tl = this.tl;
    const end = i + 1 < tl.caps.length ? tl.caps[i + 1].t : tl.duration;
    this.lives = [...this.codeEl.querySelectorAll<HTMLElement>('.tk-live')].map((el) => {
      const L: LiveVal = { el, key: el.dataset.key!, min: +el.dataset.min!, max: +el.dataset.max!, step: +el.dataset.step!, dec: 0, busy: false };
      L.dec = decimals(L.step);
      const set = (v: number) => {
        v = Math.min(L.max, Math.max(L.min, Math.round(v / L.step) * L.step));
        L.v = v;
        el.textContent = v.toFixed(L.dec);
        this.hooks.onLive(L.key, v, end);
        this.ctlSync[L.key]?.(v);
      };
      el.title = `${L.key} : faire glisser pour modifier (${L.min} à ${L.max})`;
      el.addEventListener('pointerdown', (ev) => {
        if (el.isContentEditable) return;
        ev.preventDefault();
        try { el.setPointerCapture(ev.pointerId); } catch { /* synthetic */ }
        const x0 = ev.clientX, v0 = L.v ?? +el.textContent!;
        let moved = false;
        L.busy = true; el.classList.add('drag');
        const move = (e2: PointerEvent) => {
          const dx = e2.clientX - x0;
          if (Math.abs(dx) > 2) moved = true;
          if (moved) set(v0 + (dx / 220) * (L.max - L.min));
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          el.classList.remove('drag'); L.busy = false;
          if (!moved) {
            L.busy = true; el.contentEditable = 'true'; el.focus();
            const r = document.createRange(); r.selectNodeContents(el);
            const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
          }
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
      el.addEventListener('keydown', (ev) => {
        ev.stopPropagation();
        if (el.isContentEditable) { if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); el.blur(); } return; }
        const k = ev.key === 'ArrowUp' || ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' ? -1 : 0;
        if (k) { ev.preventDefault(); set((L.v ?? +el.textContent!) + k * L.step * (ev.shiftKey ? 10 : 1)); }
      });
      el.addEventListener('blur', () => {
        if (!el.isContentEditable) return;
        el.contentEditable = 'false'; L.busy = false;
        const v = parseFloat((el.textContent ?? '').replace(',', '.'));
        if (Number.isFinite(v)) set(v);
      });
      el.addEventListener('wheel', (ev) => { ev.preventDefault(); set((L.v ?? +el.textContent!) - Math.sign(ev.deltaY) * L.step); }, { passive: false });
      return L;
    });
    this.liveHint.classList.toggle('hidden', !this.lives.length);
  }

  // ------------------------------------------------------------------ stop

  private showStop(st: Stop | null): void {
    this.ctlSync = {}; this.goalEls = null; this.quizKey = null; this.goBtn = null; this.tagEl = null; this.conclEl = null;
    this.diagEl.classList.toggle('live', !!st?.diag && (st.predicted != null || !st.predict));
    this.root.classList.toggle('in-card', st?.kind === 'card');
    if (!st || st.kind === 'card') {
      this.tryEl.classList.add('hidden');
      this.tryEl.replaceChildren();
      if (st) this.hooks.onCard(st);
      return;
    }
    const el = this.tryEl;
    el.replaceChildren();
    el.classList.remove('hidden');
    if (st.kind === 'quiz') this.showQuiz(st);
    else if (st.kind === 'review') this.showReview(st);
    else if (st.kind === 'explain') this.showExplain(st);
    else if (st.kind === 'lab') this.showLab(st);
    else if (st.kind === 'test') this.showTest(st);
    else this.showTry(st);
    requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' }));
  }

  private foot(label: string, ready = false): { foot: HTMLElement; go: HTMLButtonElement; hint: HTMLElement } {
    const foot = h('div', 'try-foot');
    const hint = h('small');
    const go = h('button', `c-btn ${ready ? 'go ready' : 'ghost'}`, esc(label)) as HTMLButtonElement;
    go.title = 'Continuer (Espace)';
    go.onclick = () => this.hooks.onResume();
    foot.append(hint, go);
    return { foot, go, hint };
  }

  // ---- experiment (with a prediction first)

  private showTry(st: Stop): void {
    const el = this.tryEl;
    const head = h('div', 'try-head', `<span class="try-tag">${st.goals ? 'Expérience' : 'À vous'}</span>`);
    head.append(st.title);
    this.tagEl = head.firstChild as HTMLElement;
    el.append(head);
    const rest = h('div');
    const { foot, go, hint } = this.foot(this.x.labels.continue);
    this.goBtn = go;
    const stageKeys = new Set(this.x.course.stageKeys ?? []);

    const showRest = () => {
      rest.replaceChildren();
      const p = h('p');
      p.innerHTML = this.x.glossary.rich(st.prompt ?? '');
      rest.append(p);
      if (st.goals) {
        st.reached ||= st.goals.map(() => false);
        const ul = h('ul', 'try-goals');
        this.goalEls = st.goals.map((g, i) => {
          const li = h('li');
          li.textContent = g.label;
          li.classList.toggle('ok', !!st.reached![i]);
          ul.append(li);
          return li;
        });
        rest.append(ul);
      }
      for (const c of st.controls) rest.append(this.control(st, c));
      this.conclEl = h('div', 'try-concl hidden');
      rest.append(this.conclEl);
      if (!st.goals && st.conclusion) {
        const b = h('button', 'c-link', 'Voir ce qu’il fallait observer') as HTMLButtonElement;
        b.onclick = () => { this.showConclusion(st); b.remove(); };
        rest.append(b);
      }
      hint.textContent = st.diag ? 'le schéma réagit à la souris' : st.controls.some((c) => stageKeys.has(c.key)) ? 'la scène est recalculée à chaque changement' : '';
      if (st.goals && st.reached!.every(Boolean)) this.missionDone(st, false);
      this.diagEl.classList.toggle('live', !!st.diag);
      this.updateGoals();
    };

    if (st.predict && st.predicted == null) {
      const box = h('div', 'try-predict');
      box.append(h('p', 'quiz-q', `<b>Votre prédiction.</b> ${esc(st.predict.question)}`));
      const list = h('div', 'quiz-choices');
      st.predict.choices.forEach((txt, i) => {
        const b = h('button', 'quiz-choice', `<kbd>${i + 1}</kbd>`) as HTMLButtonElement;
        b.append(txt);
        b.onclick = () => pick(i);
        list.append(b);
      });
      const pick = (i: number) => {
        st.predicted = i;
        this.hooks.onPredict(st.id, i);
        box.replaceChildren(h('p', 'try-pred', `Votre prédiction : <b>${esc(st.predict!.choices[i])}</b>. Vérifiez-la avec l’expérience.`));
        this.quizKey = null;
        showRest();
      };
      this.quizKey = (i) => { if (i < st.predict!.choices.length) pick(i); };
      box.append(list, h('small', 'try-note', 'Il n’y a pas de mauvaise réponse à ce stade : la prédiction sert à confronter votre idée à l’expérience.'));
      el.append(box, rest, foot);
      hint.textContent = 'faites une prédiction pour commencer';
    } else {
      if (st.predict && st.predicted != null) el.append(h('p', 'try-pred', `Votre prédiction : <b>${esc(st.predict.choices[st.predicted])}</b>.`));
      el.append(rest, foot);
      showRest();
    }
  }

  private showConclusion(st: Stop): void {
    if (!this.conclEl || !st.conclusion) return;
    let txt = '';
    if (st.predict && st.predicted != null && st.predict.answer != null) {
      txt = st.predicted === st.predict.answer
        ? '<b>Votre prédiction était juste.</b> '
        : `<b>Votre prédiction était différente</b> (la réponse attendue était : ${esc(st.predict.choices[st.predict.answer])}). `;
    }
    this.conclEl.innerHTML = `${txt}${this.x.glossary.rich(st.conclusion)}`;
    this.conclEl.classList.remove('hidden');
  }

  private control(st: Stop, c: Control): HTMLElement {
    const row = h('label', `try-row ${c.type}`);
    const name = h('span', 'try-name');
    name.textContent = c.label;
    if (c.help) row.title = c.help;
    if (c.type === 'range') {
      const out = h('output');
      const inp = h('input') as HTMLInputElement;
      const min = c.min ?? 0, max = c.max ?? 1, step = c.step ?? 0.01;
      const toV = (p: number) => (c.log ? Math.round((min * Math.pow(max / min, p / 1000)) / step) * step : p);
      const toP = (v: number) => (c.log ? (1000 * Math.log(Math.max(min, v) / min)) / Math.log(max / min) : v);
      Object.assign(inp, c.log ? { type: 'range', min: '0', max: '1000', step: '1' } : { type: 'range', min: String(min), max: String(max), step: String(step) });
      inp.value = String(toP(st.ov[c.key]));
      const show = (v: number) => { out.textContent = c.fmt ? c.fmt(v) : String(v); };
      const sync = () => { const v = Math.min(max, Math.max(min, toV(+inp.value))); st.ov[c.key] = v; show(v); };
      inp.addEventListener('input', sync);
      show(st.ov[c.key]);
      this.ctlSync[c.key] = (v) => { inp.value = String(toP(v)); show(v); };
      row.append(name, inp, out);
    } else if (c.type === 'choice') {
      const seg = h('div', 'try-seg');
      const paint = () => { [...seg.children].forEach((b, i) => b.classList.toggle('on', st.ov[c.key] === c.options![i].value)); };
      for (const o of c.options ?? []) {
        const b = h('button', undefined, esc(o.label));
        b.onclick = (ev) => { ev.preventDefault(); st.ov[c.key] = o.value; paint(); };
        seg.append(b);
      }
      paint();
      this.ctlSync[c.key] = () => paint();
      row.append(name, seg);
    } else {
      const sw = h('button', 'try-sw') as HTMLButtonElement;
      sw.type = 'button';
      sw.innerHTML = '<span class="sw"><i></i></span>';
      const on = () => Math.abs(st.ov[c.key] - (c.on ?? 1)) < Math.abs(st.ov[c.key] - (c.off ?? 0));
      const sync = () => sw.classList.toggle('on', on());
      sw.onclick = (ev) => { ev.preventDefault(); st.ov[c.key] = on() ? (c.off ?? 0) : (c.on ?? 1); sync(); };
      sync();
      row.append(sw, name);
    }
    return row;
  }

  updateGoals(): void {
    const st = this.tl.stop;
    if (!st || !st.goals || !this.goalEls) return;
    const x = { v: st.ov, ptr: this.tl.ptr, hits: this.tl.hits };
    let hit = false;
    st.goals.forEach((g, i) => {
      const open = !st.seq || i === 0 || st.reached![i - 1];
      this.goalEls![i].classList.toggle('locked', !open && !st.reached![i]);
      if (st.reached![i] || !open) return;
      let ok = false;
      try { ok = !!g.test(x); } catch { /* pointer missing */ }
      if (ok) { st.reached![i] = true; this.goalEls![i].classList.add('ok'); hit = true; }
    });
    if (hit && st.reached!.every(Boolean)) this.missionDone(st, true);
  }

  private missionDone(st: Stop, fresh: boolean): void {
    if (this.goBtn) { this.goBtn.className = 'c-btn go ready'; this.goBtn.textContent = this.x.labels.continue; }
    if (this.tagEl) { this.tagEl.textContent = 'Terminée ✓'; this.tagEl.classList.add('ok'); }
    this.showConclusion(st);
    if (fresh) this.hooks.onMission(st.id);
  }

  // ---- question

  private showQuiz(st: Stop): void {
    const el = this.tryEl, q = st.quiz!;
    const box = h('div');
    const { foot, go, hint } = this.foot(this.x.labels.skip);
    hint.textContent = q.kind === 'choice' ? 'Touches 1 à 4 pour répondre' : '';
    const r = renderQuiz(box, q, {
      feedback: true, confidence: true, head: 'Qu’en pensez-vous ?',
      onDone: (res) => {
        this.hooks.onQuiz(st.id, res.ok, res.conf);
        go.className = 'c-btn go ready'; go.textContent = this.x.labels.continue; go.focus();
        hint.textContent = '';
        this.quizKey = null;
      },
    });
    this.quizKey = (i) => r.key(i);
    el.append(box, foot);
  }

  // ---- review: questions from earlier modules

  private showReview(st: Stop): void {
    const el = this.tryEl;
    const qs = this.hooks.onReview(st);
    const { foot, go, hint } = this.foot('Passer la révision');
    if (!qs.length) {
      el.append(h('div', 'try-head', '<span class="try-tag quiz">Révision</span>Rien à revoir pour l’instant'),
        h('p', undefined, 'Aucune question des modules précédents n’est à revoir. Vous pouvez continuer.'));
      go.className = 'c-btn go ready'; go.textContent = this.x.labels.continue;
      el.append(foot);
      return;
    }
    const box = h('div');
    let k = 0, ok = 0;
    const next = () => {
      if (k >= qs.length) {
        box.replaceChildren(h('div', 'try-head', '<span class="try-tag ok">Révision terminée</span>'),
          h('p', undefined, `${ok} bonne${ok > 1 ? 's' : ''} réponse${ok > 1 ? 's' : ''} sur ${qs.length}. Les questions manquées reviendront lors d’une prochaine révision.`));
        go.className = 'c-btn go ready'; go.textContent = this.x.labels.continue; go.focus();
        hint.textContent = '';
        this.quizKey = null;
        return;
      }
      const q = qs[k];
      const qBox = h('div');
      const r = renderQuiz(qBox, q.quiz!, {
        feedback: true, confidence: true, tag: 'Révision', head: `Question ${k + 1} / ${qs.length} · ${this.x.course.modules[q.quiz!.module]?.title ?? ''}`,
        onDone: (res) => {
          if (res.ok) ok++;
          this.hooks.onQuiz(q.id, res.ok, res.conf);
          const more = h('button', 'c-btn go', k + 1 < qs.length ? 'Question suivante ▶' : 'Terminer la révision') as HTMLButtonElement;
          more.onclick = () => { k++; next(); };
          qBox.append(more);
          more.focus();
          this.quizKey = null;
        },
      });
      this.quizKey = (i) => r.key(i);
      box.replaceChildren(qBox);
    };
    hint.textContent = 'Touches 1 à 4 pour répondre';
    el.append(box, foot);
    next();
  }

  // ---- written explanation

  private showExplain(st: Stop): void {
    const el = this.tryEl, ex = st.explain!;
    const head = h('div', 'try-head', '<span class="try-tag">Explication</span>');
    head.append(st.title);
    const p = h('p');
    p.innerHTML = this.x.glossary.rich(ex.prompt);
    const ta = h('textarea', 'try-text') as HTMLTextAreaElement;
    ta.placeholder = 'Écrivez votre réponse ici (quelques phrases suffisent).';
    ta.value = this.hooks.explainText(st.id);
    ta.addEventListener('keydown', (ev) => ev.stopPropagation());
    const cmp = h('button', 'c-btn', 'Comparer avec une réponse modèle') as HTMLButtonElement;
    const model = h('div', 'try-model hidden');
    const { foot, go, hint } = this.foot(this.x.labels.skip);
    const sync = () => { cmp.disabled = ta.value.trim().length < 20; hint.textContent = cmp.disabled ? 'au moins une phrase complète' : ''; };
    ta.addEventListener('input', () => { sync(); this.hooks.onExplain(st.id, { text: ta.value }); });
    cmp.onclick = () => {
      this.hooks.onExplain(st.id, { text: ta.value });
      model.replaceChildren(h('b', undefined, 'Une réponse possible'), h('p', undefined, this.x.glossary.rich(ex.model)),
        h('p', 'try-note', 'Comparez avec votre réponse : contient-elle les mêmes idées, même formulées autrement ?'));
      const row = h('div', 'try-self');
      const opts: [string, 0 | 1 | 2][] = [['Oui, l’essentiel y est', 2], ['En partie', 1], ['Non, il me manquait l’idée principale', 0]];
      for (const [label, v] of opts) {
        const b = h('button', 'c-btn', esc(label)) as HTMLButtonElement;
        b.onclick = () => {
          this.hooks.onExplain(st.id, { self: v });
          [...row.children].forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          go.className = 'c-btn go ready'; go.textContent = this.x.labels.continue;
          if (v === 0) row.after(h('p', 'try-note', 'Relisez les étapes concernées avant de continuer : le sommaire permet d’y revenir.'));
        };
        row.append(b);
      }
      model.append(row);
      model.classList.remove('hidden');
      cmp.disabled = true;
      ta.readOnly = true;
    };
    sync();
    el.append(head, p, ta, cmp, model, foot);
  }

  // ---- invitation to the workshop

  private showLab(st: Stop): void {
    const el = this.tryEl;
    const s = this.hooks.labStatus(st.lab!);
    const head = h('div', 'try-head', `<span class="try-tag${s.done ? ' ok' : ''}">${s.done ? 'Réussi ✓' : 'Atelier'}</span>`);
    head.append(s.title);
    const p = h('p');
    p.innerHTML = this.x.glossary.rich(st.prompt ?? '');
    const open = h('button', 'c-btn go', s.done ? 'Revoir dans l’atelier' : 'Ouvrir l’atelier ▶') as HTMLButtonElement;
    open.onclick = () => this.hooks.onLab(st.lab);
    const { foot, hint } = this.foot(s.done ? this.x.labels.continue : this.x.labels.later, s.done);
    hint.textContent = s.done ? '' : 'l’exercice reste disponible dans l’atelier';
    el.append(head, p, open, foot);
  }

  // ---- invitation to a test

  private showTest(st: Stop): void {
    const el = this.tryEl;
    const done = this.hooks.testDone(st.test!);
    const head = h('div', 'try-head', `<span class="try-tag${done ? ' ok' : ' quiz'}">${done ? 'Fait ✓' : 'Test'}</span>`);
    head.append(st.title);
    const p = h('p');
    p.textContent = st.prompt ?? '';
    const open = h('button', 'c-btn go', done ? 'Repasser le test' : 'Commencer le test ▶') as HTMLButtonElement;
    open.onclick = () => this.hooks.onTest(st.test!);
    const { foot } = this.foot(done ? this.x.labels.continue : this.x.labels.later, done);
    el.append(head, p, open, foot);
  }

  answer(i: number): void { this.quizKey?.(i); }

  // ----------------------------------------------------------------- frame

  update(t: number, v: Vals, playing: boolean): void {
    const tl = this.tl;
    const ci = tl.capAt(t);
    if (ci !== this.capIdx) this.setCaption(ci);
    this.hudEl.textContent = this.hud ? safe(() => this.hud!(v)) : '';
    this.hudEl.classList.toggle('hidden', !this.hudEl.textContent);

    const dg = tl.diagAt(t);
    const key = dg ? `${dg.name}:${dg.arg ?? ''}:${dg.big ? 1 : 0}` : null;
    if (key !== this.diagKey) {
      this.diagKey = key;
      this.diagEl.classList.toggle('out', !key);
      this.diagEl.classList.toggle('big', !!dg?.big);
    }
    if (dg) {
      this.sizeCanvas();
      const live = tl.stop?.diag && (tl.stop.predicted != null || !tl.stop.predict);
      this.x.draw(dg.name, this.ctx, { t: t - dg.t0 + tl.extra, v, ptr: live ? tl.ptr : null, hits: tl.hits, arg: dg.arg, model: this.x.course.model });
    }

    if (tl.stop !== this.shownStop) { this.shownStop = tl.stop; this.showStop(tl.stop); }
    this.updateGoals();

    for (const s of this.segs) s.fill.style.width = `${Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0))) * 100}%`;
    const c = tl.chapters[tl.chapterAt(t)];
    if (c) {
      const where = c.part === c.title ? c.title : `${c.part} · ${c.title}`;
      this.chapterEl.textContent = `${this.x.moduleLabel(c.module)} · ${where}`;
      const st = tl.stepInChapter(t);
      this.clockEl.textContent = `${this.x.labels.step} ${st.i + 1} / ${st.n}`;
    }
    this.playBtn.textContent = playing || tl.held ? '❚❚' : '▶';
    this.root.classList.toggle('in-stop', !!tl.stop);
    this.navEl.classList.toggle('hidden', !!tl.stop);
    this.nextBtn.classList.toggle('waiting', tl.held);
    this.prevBtn.disabled = t < 0.5;

    for (const L of this.lives) {
      if (L.busy) continue;
      const x = v[L.key];
      if (typeof x !== 'number') continue;
      if (x !== L.v) { L.v = x; L.el.textContent = x.toFixed(L.dec); }
    }
  }
}

function safe(f: () => string): string { try { return f(); } catch { return ''; } }
export { highlight };
