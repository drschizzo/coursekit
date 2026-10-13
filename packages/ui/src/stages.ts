// Stages the library provides. A course passes one to mountCourse; heavier
// ones (a three.js scene, an existing application) implement the same
// interface on their side.

import type { Stage, Vals } from '@coursekit/core';

/** No background: the panels float on a plain page. */
export function noStage(): Stage {
  return { mount() {}, show() {}, update() {}, status: () => ({ busy: false, label: '' }), dispose() {} };
}

/** One picture per scene: scene key → image URL. */
export function imageStage(images: Record<string, string>, labels: Record<string, string> = {}): Stage {
  let el: HTMLElement | null = null;
  let label = '';
  return {
    mount(host) { el = host; host.classList.add('ck-stage-image'); },
    show(scene) {
      label = labels[scene] ?? '';
      if (el) el.style.backgroundImage = images[scene] ? `url("${images[scene]}")` : 'none';
    },
    update() {},
    status: () => ({ busy: false, label }),
    dispose() { if (el) el.style.backgroundImage = 'none'; },
  };
}

export interface CanvasScene {
  /** a label for the badge */
  label?: string;
  /** called when the scene is shown or its settings change: prepare (e.g. run a simulation) */
  prepare?(settings: Vals): unknown;
  /** draws one frame; `data` is what prepare returned, `t` seconds since it was ready */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, settings: Vals, data: unknown): void;
}

/**
 * A full-window 2D canvas animated every frame — typically a simulation run
 * by the course's domain model. Scenes are registered by key.
 */
export function canvasStage(scenes: Record<string, CanvasScene>): Stage {
  let cv: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let scene: CanvasScene | null = null;
  let settings: Vals = {};
  let data: unknown = null;
  let t0 = performance.now();
  let raf = 0;
  let busy = false;

  const prepare = () => {
    if (!scene) return;
    busy = true;
    try { data = scene.prepare ? scene.prepare(settings) : null; } finally { busy = false; }
    t0 = performance.now();
  };
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!cv || !ctx || !scene) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = cv.clientWidth, hgt = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hgt * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    scene.draw(ctx, w, hgt, (performance.now() - t0) / 1000, settings, data);
  };
  return {
    mount(host) {
      cv = document.createElement('canvas');
      cv.className = 'ck-stage-canvas';
      host.append(cv);
      ctx = cv.getContext('2d');
      raf = requestAnimationFrame(frame);
    },
    show(key, s) {
      scene = scenes[key] ?? null;
      settings = { ...s };
      prepare();
    },
    update(s) { settings = { ...s }; prepare(); },
    status: () => ({ busy, label: scene?.label ?? '' }),
    dispose() { cancelAnimationFrame(raf); cv?.remove(); cv = null; },
  };
}
