// mountCourse: the whole player. It compiles the course, builds the panel,
// the home page, the overlays, and runs the clock — step by step by default:
// the clock runs through a step (diagrams and stage animate), then waits for
// the learner before the next step or pause. Leaving a pause moves on to what
// follows. Taken from avbd's course/index.ts; the Loop Lab calls are replaced
// by the Stage interface.
//
// The compiled timeline never changes; everything a reading does goes
// through a `Reading` (core), which the panel reads too.

import {
  Progress, Reading, browserStore, compile, createGlossary, diagramVariants, labelsFor, layoutCss, moduleReview, tr,
  type DiagramEnv, type ProgressStore, type Rect, type Stage, type Timeline, type Vals,
} from '@coursekit/core';
import { CC, CSS_PALETTE, DH, DW, beginBudget, clearCache, text } from '@coursekit/diagrams';
import type { Course, Exercise, WorkshopConfig } from '@coursekit/exercises';
import { TOOL_DIAGRAMS } from '@coursekit/toolbox';
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
  tl: Timeline;
  reading: Reading;
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

export function mountCourse(host: HTMLElement, course: Course, opts: MountOptions = {}): CourseHandle {
  const tl = compile(course);
  const r = new Reading(tl);
  const prog = new Progress(course.id, course.version, opts.store ?? browserStore());
  const L = labelsFor(course.language, course.labels);
  const glossary = createGlossary(course.glossary);
  const capsules = course.toolbox ?? [];
  const capsule = (id: string) => capsules.find((c) => c.id === id);
  const exercises: Exercise[] = course.exercises ?? [];
  const cfg: WorkshopConfig = course.workshop ?? {};
  const stage = opts.stage ?? noStage();
  r.stepMode = prog.d.stepMode;

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
    beginBudget(2, course.id);
    ctx.clearRect(0, 0, DW, DH);
    const fn = diagrams[name];
    if (!fn) { text(ctx, tr(L, 'missingDiagram', { name }), DW / 2, DH / 2, CC.dim, 11, 'center'); return; }
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
  // the palette and the panels' places: one source for the theme, the diagrams and the checker
  const cssVars = { ...CSS_PALETTE, ...layoutCss() };
  for (const [k, v] of Object.entries(cssVars)) host.style.setProperty(k, v);
  const stageEl = document.createElement('div');
  stageEl.className = 'ck-stage';
  const root = document.createElement('div');
  root.className = 'course-root';
  host.append(stageEl, root);
  stage.mount(stageEl);

  const setPauses = (on: boolean) => { r.setPauses(on); panel.setPauses(on); };

  const panel = new Panel(r, {
    onSeek: (t) => seek(t),
    onStop: (st) => { goto(st.t - 0.01); r.t = st.t; r.enterStop(st); },
    onToggle: () => { if (r.stop || r.held) return; r.playing = !r.playing; },
    onResume: () => resumeStop(),
    onNext: () => next(),
    onPrev: () => prev(),
    onPauses: setPauses,
    onStepMode: (on) => { r.stepMode = on; r.held = false; r.playing = true; prog.setStepMode(on); panel.setStepMode(on); },
    onLive: (key, v, until) => { r.editLive(key, v, until, { title: L.liveTitle, prompt: L.livePrompt }); },
    onCard: (st) => home.showCard(st),
    onQuiz: (id, ok, conf) => prog.answer(id, ok, conf),
    onMission: (id) => { prog.mission(id); toast(L.experimentDone); },
    onPredict: (id, i) => prog.predicted(id, i),
    onExplain: (id, patch) => prog.explained(id, patch),
    onReview: (st) => moduleReview(tl, prog, st.module),
    onMenu: () => openMenu(),
    onLab: (id) => showLab(id),
    onTest: (kind) => showTest(kind),
    onCapsule: (id) => showCapsule(id),
    onGlossary: () => showGlossary(),
    onQuit: () => openMenu(),
    onViewReset: () => { stage.resetView?.(); panel.setViewFree(false); },
    explainText: (id) => prog.d.explain[id]?.text ?? '',
    labStatus: (id) => {
      if (id === 'assembly') return { title: cfg.assembly?.title ?? L.assembly, done: !!prog.d.code.assembly?.done };
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
      if (r.stop?.kind === 'card') { resumeStop(); return; }
      r.resume(); r.playing = menuWasPlaying || r.stepMode;
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
    const ev = tl.sceneAt(r.t);
    const key = ev?.key ?? null;
    const vals = r.stageVals(r.t);
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
   * diagram hides. On a narrow screen, where the panels stack, the room the
   * column leaves above the diagram. In between (a column under 180 px), the
   * band above the panels.
   */
  function safeArea(): Rect {
    const S = stageEl.getBoundingClientRect();
    if (!S.width || mode !== 'tour') return { x: 0, y: 0, w: S.width, h: S.height };
    const g = panel.regions();
    if (g.room.height) return { x: g.room.left - S.left, y: g.room.top - S.top, w: g.room.width, h: g.room.height };
    const top = Math.max(S.top, ...g.tops.map((b) => b.bottom)) + 8;
    const bottom = Math.min(S.bottom, g.bar.height ? g.bar.top : S.bottom) - 8;
    const left = g.cap.width ? g.cap.right + 12 : S.left;
    const right = g.diag.width ? g.diag.left - 12 : S.right;
    if (right - left >= Math.min(180, 0.3 * S.width)) return { x: left - S.left, y: top - S.top, w: right - left, h: bottom - top };
    // the text panel grows with its text: use a fixed share of the height, not its top
    const low = Math.min(S.top + S.height * 0.45, g.diag.height ? g.diag.top - 8 : bottom);
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
    r.resetStops(t);
    r.t = t;
    r.playing = true;
    r.held = false;
    home.hideCard();
    syncStage(true);
  }

  /** Move to another step without forgetting the pauses already done. */
  function goto(t: number): void {
    const t0 = r.t;
    t = Math.min(tl.duration - 0.01, Math.max(0, t));
    r.stop = null;
    r.t = t;
    r.playing = true;
    r.held = false;
    home.hideCard();
    trackProgress(t0, t);
    syncStage();
  }

  function next(): void {
    if (r.stop) return;
    const nc = tl.nextStepT(r.t);
    const st = r.stopBetween(r.t, nc ?? tl.duration);
    if (st) { goto(st.t); r.enterStop(st); return; }
    if (nc == null) { finish(); return; }
    goto(nc + 0.001);
  }

  function prev(): void {
    if (r.stop) r.stop = null;
    goto(tl.prevStepT(r.t) + 0.001);
  }

  /** Leaving a pause: in step-by-step reading, go straight on to what follows. */
  function resumeStop(): void {
    const st = r.stop;
    if (!st) return;
    if (st.kind === 'card') home.hideCard();
    r.resume();
    if (r.stepMode && !r.isLive(st)) next();
  }

  function finish(): void {
    trackProgress(r.t, tl.duration);
    prog.seen(tl.chapters.length - 1);
    r.t = tl.duration - 0.01;
    r.playing = false;
    r.held = false;
    openMenu();
  }

  function startTour(t: number): void {
    mode = 'tour';
    panel.show(true);
    panel.setPauses(r.pauses);
    panel.setStepMode(r.stepMode);
    seek(t);
  }

  function openMenu(): void {
    menuWasPlaying = r.playing;
    r.playing = false;
    home.openHome(mode === 'tour');
  }

  // --------------------------------------------------------------- overlays

  function withOverlay(open: (done: () => void) => void): void {
    overlay++;
    const was = r.playing;
    r.playing = false;
    open(() => {
      overlay = Math.max(0, overlay - 1);
      if (mode === 'tour' && !home.open && !r.stop) r.playing = was || r.held;
      panel.refreshStop();
      if (home.open) home.openHome(mode === 'tour');
    });
  }
  function showLab(id?: string): void {
    if (!exercises.length) return;
    const moduleTitle = (m: string) => { const i = course.modules.findIndex((x) => x.id === m); return `${moduleLabel(i)} · ${course.modules[i]?.title ?? m}`; };
    withOverlay((done) => openWorkshop(root, { exercises, cfg, prog, labels: L, moduleTitle }, done, id));
  }
  function showCapsule(id: string): void {
    const c = capsule(id);
    if (!c) return;
    withOverlay((done) => openCapsule(root, c, glossary, L, draw, { onDone: (k) => { prog.tool(k); toast(L.capsuleDone); }, onClose: done }));
  }
  function showTest(kind: 'pre' | 'post'): void {
    const tests = course.tests;
    if (!tests) return;
    withOverlay((done) => openTest(root, kind, tests, capsules, L, {
      pre: prog.d.tests.pre,
      onDone: (k, rec) => prog.test(k, rec),
      onCapsule: (id) => setTimeout(() => showCapsule(id), 0),
      onClose: done,
    }));
  }
  function showGlossary(): void {
    withOverlay((done) => openGlossary(root, glossary, L, (id) => capsule(id)?.title ?? null, (id) => setTimeout(() => showCapsule(id), 0), done));
  }

  // -------------------------------------------------------------- the clock

  function frame(): void {
    rafId = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (home.open || overlay) { if (mode === 'tour') panel.update(r.t, r.eval(r.t), false); return; }
    if (mode !== 'tour') return;
    if (r.playing && !r.stop && !r.held) {
      const t0 = r.t;
      let t1 = t0 + dt;
      if (r.stepMode) {
        const nc = tl.nextStepT(t0) ?? tl.duration;
        const st = r.stopBetween(t0, nc);
        const hold = Math.min(nc, st ? st.t : Infinity) - HOLD;
        if (t1 >= hold) { t1 = Math.max(t0, hold); r.held = true; }
        r.t = t1;
        trackProgress(t0, t1);
      } else {
        const st = r.stopBetween(t0, t1);
        if (st) { r.t = st.t; r.enterStop(st); } else r.t = t1;
        trackProgress(t0, r.t);
        if (!st && r.t >= tl.duration) finish();
      }
    }
    if (r.stop || r.held) r.extra += dt;
    prog.setT(r.t);
    syncLayout();
    syncStage();
    panel.update(r.t, r.eval(r.t), r.playing);
    const s = stage.status();
    panel.setBadge(s.busy ? `${s.label} · ${L.computing}${s.progress != null ? ` ${Math.round(s.progress * 100)} %` : ''}` : s.label, s.busy ? 'baking' : '');
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
    if (ev.key === 'Escape') { if (home.open && mode === 'tour') { home.closeHome(); r.playing = menuWasPlaying || r.stepMode; } ev.preventDefault(); return; }
    if (home.open) return;
    if (ev.key === 'm' || ev.key === 'M') { openMenu(); return; }
    if (ev.key === 'l' || ev.key === 'L') { showLab(); return; }
    if (ev.key === 'g' || ev.key === 'G') { showGlossary(); return; }
    const qi = ['1', '2', '3', '4'].indexOf(ev.key);
    if (qi >= 0 && r.stop) { panel.answer(qi); return; }
    if (ev.code === 'Space') {
      if (r.stop) resumeStop();
      else if (r.stepMode) next();
      else r.playing = !r.playing;
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Enter' && r.stop?.kind === 'card') { resumeStop(); ev.preventDefault(); return; }
    if (ev.key === 'ArrowRight') { if (!r.stop) next(); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft') { prev(); ev.preventDefault(); }
  }

  // the learner moving the stage's view (a drag) is offered a way back
  const onStageDown = () => { if (stage.resetView) panel.setViewFree(true); };
  stageEl.addEventListener('pointerdown', onStageDown, true);

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
      head.textContent = tr(L, 'shotsHead', { n: variants.length });
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
    const caps = tl.capsOfChapter(chapter);
    const t = (caps[Math.min(step, caps.length - 1)]?.t ?? ch.t) + 0.01;
    home.closeHome(); home.hideCard();
    if (mode !== 'tour') startTour(t); else seek(t);
    r.visitBefore(t);
  }

  const handle: CourseHandle = {
    tl, reading: r, prog, next, prev,
    chapter: (i) => gotoStep(i, 0),
    list: () => tl.chapters.map((c, i) => `${i}  M${c.module} · ${c.part} · ${c.title}`).join('\n'),
    goto: gotoStep,
    pauses: setPauses,
    render, shots,
    destroy: () => {
      cancelAnimationFrame(rafId);
      clearTimeout(stageTimer);
      clearTimeout(toastTimer);
      window.removeEventListener('keydown', onKey, true);
      stageEl.removeEventListener('pointerdown', onStageDown, true);
      stage.dispose();
      clearCache(course.id);
      host.replaceChildren();
      for (const k of Object.keys(cssVars)) host.style.removeProperty(k);
      host.classList.remove('ck-root');
    },
  };
  if (opts.dev && new URLSearchParams(location.search).has('shots')) shots();
  return handle;
}
