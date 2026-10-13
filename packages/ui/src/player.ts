// mountCourse: the whole player. It compiles the course, builds the panel,
// the home page, the overlays, and runs the clock — step by step by default:
// the clock runs through a step (diagrams and stage animate), then waits for
// the learner before the next step or pause. Leaving a pause moves on to what
// follows. Taken from avbd's course/index.ts; the Loop Lab calls are replaced
// by the Stage interface.

import {
  Progress, browserStore, compile, createGlossary, diagramVariants, labelsFor,
  type CourseDef, type DiagramEnv, type ProgressStore, type Rect, type Stage, type Stop, type Vals,
} from '@coursekit/core';
import { CC, DH, DW, TOOL_DIAGRAMS, beginBudget, text } from '@coursekit/diagrams';
import type { Exercise, WorkshopConfig } from '@coursekit/exercises';
import { openCapsule } from './capsule.ts';
import { Home, openGlossary } from './home.ts';
import { Panel } from './panel.ts';
import { noStage } from './stages.ts';
import { openTest } from './tests.ts';
import { openWorkshop } from './workshop.ts';

export interface MountOptions {
  stage?: Stage;
  store?: ProgressStore;
  /** open the course directly instead of the home page */
  autostart?: boolean;
  /** development: `?shots` in the URL opens the grid of every diagram variant */
  dev?: boolean;
}

/** The clock stops this far before the next step, so that its text is not shown early. */
const HOLD = 0.02;

export interface CourseHandle {
  /** dev helpers */
  tl: ReturnType<typeof compile>;
  prog: Progress;
  next(): void;
  prev(): void;
  chapter(i: number): void;
  list(): string;
  /** test helpers: jump to a step of a chapter; the pauses before it count as done */
  goto(chapter: number, step?: number): void;
  /** turn the pauses (questions, experiments…) on or off, like the reader's button */
  pauses(on: boolean): void;
  /** a diagram drawn alone, with the course's defaults patched by `v` */
  render(name: string, v?: Vals, t?: number, arg?: string): HTMLCanvasElement;
  /** every diagram, with the values of the reading and at the bounds of its experiments' controls */
  shots(): void;
  destroy(): void;
}

export function mountCourse(host: HTMLElement, course: CourseDef & { workshop?: WorkshopConfig }, opts: MountOptions = {}): CourseHandle {
  const tl = compile(course);
  const prog = new Progress(course.id, course.version, opts.store ?? browserStore());
  const L = labelsFor(course.labels);
  const glossary = createGlossary(course.glossary);
  const capsules = course.toolbox ?? [];
  const capsule = (id: string) => capsules.find((c) => c.id === id);
  const exercises = (course.exercises ?? []) as Exercise[];
  const cfg: WorkshopConfig = course.workshop ?? {};
  const stage = opts.stage ?? noStage();
  tl.stepMode = prog.d.stepMode;

  const moduleLabel = (i: number) => {
    const m = course.modules[i];
    if (!m) return '';
    if (m.kind === 'bonus') return L.bonus;
    if (m.kind === 'exam') return L.exam;
    // core modules are numbered from 1, the exam and bonus modules apart
    return `${L.module} ${course.modules.slice(0, i + 1).filter((x) => (x.kind ?? 'core') === 'core').length}`;
  };
  const diagrams: Record<string, (ctx: CanvasRenderingContext2D, e: DiagramEnv) => void> = { ...TOOL_DIAGRAMS, ...(course.diagrams ?? {}) };
  const draw = (name: string, ctx: CanvasRenderingContext2D, env: DiagramEnv) => {
    beginBudget(2);
    ctx.clearRect(0, 0, DW, DH);
    const fn = diagrams[name];
    if (!fn) { text(ctx, `schéma « ${name} » manquant`, DW / 2, DH / 2, CC.dim, 11, 'center'); return; }
    try { fn(ctx, { ...env, model: course.model }); } catch (err) { text(ctx, String(err).slice(0, 70), 10, 20, CC.red, 10); }
  };

  let rafId = 0;
  let last = performance.now();
  let mode: 'home' | 'tour' = 'home';
  let curScene: string | null = null;
  let lastStage = '';
  let stageTimer = 0;
  let overlay = 0;
  let menuWasPlaying = true;

  // ------------------------------------------------------------------ DOM
  host.classList.add('ck-root');
  const stageEl = document.createElement('div');
  stageEl.className = 'ck-stage';
  const root = document.createElement('div');
  root.className = 'course-root';
  host.append(stageEl, root);
  stage.mount(stageEl);

  const panel = new Panel(tl, {
    onSeek: (t) => seek(t),
    onStop: (st) => { goto(st.t - 0.01); tl.t = st.t; tl.enterStop(st); },
    onToggle: () => { if (tl.stop || tl.held) return; tl.playing = !tl.playing; },
    onResume: () => resumeStop(),
    onNext: () => next(),
    onPrev: () => prev(),
    onPauses: (on) => { tl.pauses = on; panel.setPauses(on); if (!on && tl.stop && tl.stop.kind !== 'card' && tl.stop.kind !== 'test') tl.resume(); },
    onStepMode: (on) => { tl.stepMode = on; tl.held = false; tl.playing = true; prog.setStepMode(on); panel.setStepMode(on); },
    onLive: (key, v, until) => liveEdit(key, v, until),
    onCard: (st) => home.showCard(st),
    onQuiz: (id, ok, conf) => prog.answer(id, ok, conf),
    onMission: (id) => { prog.mission(id); toast('Expérience terminée ✓'); },
    onPredict: (id, i) => prog.predicted(id, i),
    onExplain: (id, patch) => prog.explained(id, patch),
    onReview: (st) => pickReview(st),
    onMenu: () => openMenu(),
    onLab: (id) => showLab(id),
    onTest: (kind) => showTest(kind),
    onCapsule: (id) => showCapsule(id),
    onGlossary: () => showGlossary(),
    onQuit: () => openMenu(),
    onViewReset: () => { stage.resetView?.(); panel.setViewFree(false); },
    explainText: (id) => prog.d.explain[id]?.text ?? '',
    labStatus: (id) => {
      if (id === 'assembly') return { title: cfg.assembly?.title ?? 'Assemblage', done: !!prog.d.code.assembly?.done };
      const c = exercises.find((x) => x.id === id);
      return { title: c?.title ?? id, done: !!prog.d.code[id]?.done };
    },
    testDone: (kind) => !!prog.d.tests[kind]?.done,
    toolDone: (id) => !!prog.d.tools[id],
  }, { course, glossary, labels: L, capsule, moduleLabel, draw });

  const home = new Home({ course, tl, prog, labels: L, glossary, moduleLabel }, {
    onStart: (t) => { home.closeHome(); home.hideCard(); startTour(t); },
    onClose: () => {
      home.closeHome(); home.hideCard();
      if (mode !== 'tour') { startTour(prog.d.lastT || 0); return; }
      if (tl.stop?.kind === 'card') { resumeStop(); return; }
      tl.resume(); tl.playing = menuWasPlaying || tl.stepMode;
    },
    onLab: (id) => showLab(id),
    onCapsule: (id) => showCapsule(id),
    onTest: (kind) => showTest(kind),
    onGlossary: () => showGlossary(),
  });

  const toastEl = document.createElement('div');
  toastEl.className = 'c-toast hidden';
  let toastTimer = 0;
  function toast(msg: string): void {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), 2000);
  }
  root.append(panel.root, home.root, home.card, toastEl);

  // ---------------------------------------------------------------- stage

  const sig = (v: Vals) => JSON.stringify(Object.entries(v).sort());

  /** Shows the scene the current time calls for; re-runs it when its settings change. */
  function syncStage(force = false): void {
    const ev = tl.sceneAt(tl.t);
    const key = ev?.key ?? null;
    const vals = tl.stageVals(tl.t);
    if (!key) return;
    if (force || key !== curScene) {
      curScene = key;
      syncLayout(true);
      lastStage = sig(vals);
      void stage.show(key, vals);
      panel.setViewFree(false);
      return;
    }
    const s = sig(vals);
    if (s !== lastStage) {
      lastStage = s;
      clearTimeout(stageTimer);
      stageTimer = window.setTimeout(() => stage.update(vals), 140);
    }
  }

  // ------------------------------------------------------------ safe area

  /**
   * The part of the stage no panel covers. On a wide screen, the column
   * between the text panel (left) and the diagram (right), under the top bars
   * and above the timeline: it does not move when the text grows or the
   * diagram hides. On a narrow screen (a column under 180 px), the band
   * above the panels.
   */
  function safeArea(): Rect {
    const S = stageEl.getBoundingClientRect();
    if (!S.width || mode !== 'tour') return { x: 0, y: 0, w: S.width, h: S.height };
    const r = panel.regions();
    const top = Math.max(S.top, ...r.tops.map((b) => b.bottom)) + 8;
    const bottom = Math.min(S.bottom, r.bar.height ? r.bar.top : S.bottom) - 8;
    const left = r.cap.width ? r.cap.right + 12 : S.left;
    const right = r.diag.width ? r.diag.left - 12 : S.right;
    if (right - left >= Math.min(180, 0.3 * S.width)) return { x: left - S.left, y: top - S.top, w: right - left, h: bottom - top };
    // the text panel grows with its text: use a fixed share of the height, not its top
    const low = Math.min(S.top + S.height * 0.45, r.diag.height ? r.diag.top - 8 : bottom);
    return { x: 8, y: top - S.top, w: S.width - 16, h: Math.max(80, low - top) };
  }
  let lastSafe: Rect | null = null;
  let safeCheck = 0;
  function syncLayout(force = false): void {
    if (!stage.layout) return;
    const now = performance.now();
    if (!force && now - safeCheck < 250) return;
    safeCheck = now;
    const a = safeArea();
    const moved = !lastSafe || Math.abs(a.x - lastSafe.x) + Math.abs(a.y - lastSafe.y) + Math.abs(a.w - lastSafe.w) + Math.abs(a.h - lastSafe.h) > 4;
    if (moved) { lastSafe = a; stage.layout(a); }
  }

  // ------------------------------------------------------------ navigation

  /** Jump on the timeline: pauses after t are asked again. */
  function seek(t: number): void {
    t = Math.min(tl.duration - 0.01, Math.max(0, t));
    tl.resetStops(t);
    tl.t = t;
    tl.playing = true;
    tl.held = false;
    home.hideCard();
    syncStage(true);
  }

  /** Move to another step without forgetting the pauses already done. */
  function goto(t: number): void {
    const t0 = tl.t;
    t = Math.min(tl.duration - 0.01, Math.max(0, t));
    tl.stop = null;
    tl.t = t;
    tl.playing = true;
    tl.held = false;
    home.hideCard();
    trackProgress(t0, t);
    syncStage();
  }

  function next(): void {
    if (tl.stop) return;
    const nc = tl.nextStepT(tl.t);
    const st = tl.stopBetween(tl.t, nc ?? tl.duration);
    if (st) { goto(st.t); tl.enterStop(st); return; }
    if (nc == null) { finish(); return; }
    goto(nc + 0.001);
  }

  function prev(): void {
    if (tl.stop) tl.stop = null;
    goto(tl.prevStepT(tl.t) + 0.001);
  }

  /** Leaving a pause: in step-by-step reading, go straight on to what follows. */
  function resumeStop(): void {
    const st = tl.stop;
    if (!st) return;
    if (st.kind === 'card') home.hideCard();
    tl.resume();
    if (tl.stepMode && !st.id.startsWith('live-')) next();
  }

  function finish(): void {
    trackProgress(tl.t, tl.duration);
    prog.seen(tl.chapters.length - 1);
    tl.t = tl.duration - 0.01;
    tl.playing = false;
    tl.held = false;
    openMenu();
  }

  function startTour(t: number): void {
    mode = 'tour';
    panel.show(true);
    panel.setPauses(tl.pauses);
    panel.setStepMode(tl.stepMode);
    seek(t);
  }

  function openMenu(): void {
    menuWasPlaying = tl.playing;
    tl.playing = false;
    home.openHome(mode === 'tour');
  }

  // --------------------------------------------------------------- overlays

  function withOverlay(open: (done: () => void) => void): void {
    overlay++;
    const was = tl.playing;
    tl.playing = false;
    open(() => {
      overlay = Math.max(0, overlay - 1);
      if (mode === 'tour' && !home.open && !tl.stop) tl.playing = was || tl.held;
      panel.refreshStop();
      if (home.open) home.openHome(mode === 'tour');
    });
  }
  function showLab(id?: string): void {
    if (!exercises.length) return;
    withOverlay((done) => openWorkshop(root, { exercises, cfg, prog, moduleTitle: (m) => { const i = course.modules.findIndex((x) => x.id === m); return `${moduleLabel(i)} · ${course.modules[i]?.title ?? m}`; } }, done, id));
  }
  function showCapsule(id: string): void {
    const c = capsule(id);
    if (!c) return;
    withOverlay((done) => openCapsule(root, c, glossary, draw, { onDone: (k) => { prog.tool(k); toast('Fiche acquise ✓'); }, onClose: done }));
  }
  function showTest(kind: 'pre' | 'post'): void {
    if (!course.tests) return;
    withOverlay((done) => openTest(root, kind, course.tests!, capsules, {
      pre: prog.d.tests.pre,
      onDone: (k, rec) => prog.test(k, rec),
      onCapsule: (id) => setTimeout(() => showCapsule(id), 0),
      onClose: done,
    }));
  }
  function showGlossary(): void {
    withOverlay((done) => openGlossary(root, glossary, (id) => capsule(id)?.title ?? null, (id) => setTimeout(() => showCapsule(id), 0), done));
  }

  // ------------------------------------------------------------------ review

  /** Up to three questions from earlier modules: due ones first, then never answered, then the oldest. */
  function pickReview(st: Stop): Stop[] {
    const mod = st.module ?? 0;
    const pool = tl.bank.filter((q) => (q.quiz?.module ?? 0) < mod);
    if (!pool.length) return [];
    const ids = pool.map((q) => q.id);
    const chosen: string[] = prog.due(ids).slice(0, 3);
    for (const id of ids) if (chosen.length < 3 && !(id in prog.d.rev) && !chosen.includes(id)) chosen.push(id);
    const rest = ids.filter((id) => !chosen.includes(id)).sort((a, b) => (prog.d.rev[a]?.next ?? 0) - (prog.d.rev[b]?.next ?? 0));
    while (chosen.length < 3 && rest.length) chosen.push(rest.shift()!);
    prog.newSession();
    return chosen.map((id) => pool.find((q) => q.id === id)!).filter(Boolean);
  }

  /** A value edited straight in the displayed code pauses the course on it. */
  function liveEdit(key: string, v: number, until: number): void {
    let st = tl.stop;
    if (!st) {
      st = {
        t: tl.t, until: Math.max(until, tl.t + 0.5), kind: 'try', id: `live-${key}-${tl.t.toFixed(1)}`,
        title: 'Modifiez la valeur',
        prompt: 'La visite attend pendant que vous essayez différentes valeurs. Faites glisser les valeurs soulignées et observez le résultat. Vos réglages restent actifs jusqu’à l’étape suivante.',
        controls: [], ov: {}, visited: true,
      };
      const base = tl.eval(tl.t);
      st.ov[key] = base[key] ?? v;
      tl.stops.push(st);
      tl.stops.sort((a, b) => a.t - b.t);
      tl.stop = st;
      tl.playing = false;
      tl.held = false;
      tl.ptr = null;
    }
    st.ov[key] = v;
  }

  // -------------------------------------------------------------- the clock

  function frame(): void {
    rafId = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (home.open || overlay) { if (mode === 'tour') panel.update(tl.t, tl.eval(tl.t), false); return; }
    if (mode !== 'tour') return;
    if (tl.playing && !tl.stop && !tl.held) {
      const t0 = tl.t;
      let t1 = t0 + dt;
      if (tl.stepMode) {
        const nc = tl.nextStepT(t0) ?? tl.duration;
        const st = tl.stopBetween(t0, nc);
        const hold = Math.min(nc, st ? st.t : Infinity) - HOLD;
        if (t1 >= hold) { t1 = Math.max(t0, hold); tl.held = true; }
        tl.t = t1;
        trackProgress(t0, t1);
      } else {
        const st = tl.stopBetween(t0, t1);
        if (st) { tl.t = st.t; tl.enterStop(st); } else tl.t = t1;
        trackProgress(t0, tl.t);
        if (!st && tl.t >= tl.duration) finish();
      }
    }
    if (tl.stop || tl.held) tl.extra += dt;
    prog.setT(tl.t);
    syncLayout();
    syncStage();
    panel.update(tl.t, tl.eval(tl.t), tl.playing);
    const s = stage.status();
    panel.setBadge(s.busy ? `${s.label} · calcul${s.progress != null ? ` ${Math.round(s.progress * 100)} %` : ''}` : s.label, s.busy ? 'baking' : '');
  }

  function trackProgress(t0: number, t1: number): void {
    const c0 = tl.chapterAt(t0), c1 = tl.chapterAt(t1);
    if (c1 > c0) for (let c = c0; c < c1; c++) prog.seen(c);
  }

  // ------------------------------------------------------------------ keys

  function onKey(ev: KeyboardEvent): void {
    if (overlay) return;
    const tgt = ev.target as HTMLElement | null;
    if (tgt && (tgt.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(tgt.tagName))) return;
    if (ev.key === 'Escape') { if (home.open && mode === 'tour') { home.closeHome(); tl.playing = menuWasPlaying || tl.stepMode; } ev.preventDefault(); return; }
    if (home.open) return;
    if (ev.key === 'm' || ev.key === 'M') { openMenu(); return; }
    if (ev.key === 'l' || ev.key === 'L') { showLab(); return; }
    if (ev.key === 'g' || ev.key === 'G') { showGlossary(); return; }
    const qi = ['1', '2', '3', '4'].indexOf(ev.key);
    if (qi >= 0 && tl.stop) { panel.answer(qi); return; }
    if (ev.code === 'Space') {
      if (tl.stop) resumeStop();
      else if (tl.stepMode) next();
      else tl.playing = !tl.playing;
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Enter' && tl.stop?.kind === 'card') { resumeStop(); ev.preventDefault(); return; }
    if (ev.key === 'ArrowRight') { if (!tl.stop) next(); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft') { prev(); ev.preventDefault(); }
  }

  // the learner moving the stage's view (a drag) is offered a way back
  stageEl.addEventListener('pointerdown', () => { if (stage.resetView) panel.setViewFree(true); }, true);

  window.addEventListener('keydown', onKey, true);
  rafId = requestAnimationFrame(frame);
  if (opts.autostart) startTour(prog.d.lastT || 0); else home.openHome(false);

  // ------------------------------------------------------------ test helpers

  function render(name: string, v: Vals = {}, t = 2, arg?: string): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    const k = 2;
    cv.width = DW * k; cv.height = DH * k;
    cv.style.width = `${DW}px`;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    draw(name, ctx, { t, v: { ...(course.defaults ?? {}), ...v }, ptr: null, hits: new Set(), arg });
    return cv;
  }

  function shots(): void {
    withOverlay((done) => {
      const box = document.createElement('div');
      box.className = 'ck-shots';
      const head = document.createElement('div');
      head.className = 'ck-shots-head';
      const variants = diagramVariants(tl);
      head.textContent = `${variants.length} schémas · valeurs du fil du cours et bornes des expériences · Échap pour fermer`;
      box.append(head);
      for (const d of variants) {
        const fig = document.createElement('figure');
        const cap = document.createElement('figcaption');
        cap.textContent = `${d.name} — ${d.label}`;
        fig.append(render(d.name, d.v, 3.7, d.arg), cap);
        box.append(fig);
      }
      const close = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { window.removeEventListener('keydown', close, true); box.remove(); done(); } };
      window.addEventListener('keydown', close, true);
      root.append(box);
    });
  }

  function gotoStep(chapter: number, step = 0): void {
    const ch = tl.chapters[chapter];
    if (!ch) return;
    const end = chapter + 1 < tl.chapters.length ? tl.chapters[chapter + 1].t : tl.duration;
    const caps = tl.caps.filter((c) => c.t >= ch.t - 1e-3 && c.t < end - 1e-3);
    const t = (caps[Math.min(step, caps.length - 1)]?.t ?? ch.t) + 0.01;
    home.closeHome(); home.hideCard();
    if (mode !== 'tour') startTour(t); else seek(t);
    for (const st of tl.stops) if (st.t < t) st.visited = true;
  }

  const handle: CourseHandle = {
    tl, prog, next, prev,
    chapter: (i) => gotoStep(i, 0),
    list: () => tl.chapters.map((c, i) => `${i}  M${c.module} · ${c.part} · ${c.title}`).join('\n'),
    goto: gotoStep,
    pauses: (on) => { tl.pauses = on; panel.setPauses(on); if (!on && tl.stop && tl.stop.kind !== 'card' && tl.stop.kind !== 'test') tl.resume(); },
    render, shots,
    destroy: () => { cancelAnimationFrame(rafId); window.removeEventListener('keydown', onKey, true); stage.dispose(); host.replaceChildren(); },
  };
  if (opts.dev && new URLSearchParams(location.search).has('shots')) shots();
  return handle;
}
