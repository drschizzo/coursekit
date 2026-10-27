// Drawing primitives for the course diagrams: lines, arrows, panels, text,
// axes, a world → canvas camera, and the colour set every diagram shares.
// Taken from avbd's course/draw.ts. A diagram draws in a DW × DH space; the
// player scales it to the panel.

export const DW = 380, DH = 236;

export const CC = {
  fg: '#e6eaf5',
  dim: 'rgba(230,234,245,.45)',
  faint: 'rgba(230,234,245,.13)',
  grid: 'rgba(230,234,245,.07)',
  acc: '#ffb35c',      // the thing being explained
  blue: '#7c9cff',     // the reference / the correct answer
  pink: '#ff7aa8',     // forces, multipliers
  green: '#5ee0a0',    // satisfied, converged
  red: '#ff6b7a',      // violated, diverging
  violet: '#b48cff',
};

/**
 * The palette's colours as the theme's CSS variables: the player writes them
 * on its root, so that the panels and the diagrams share one source. A
 * course draws with `CC`, never with the hexadecimal values.
 */
export const CSS_PALETTE: Record<string, string> = {
  '--accent': CC.blue,
  '--accent-2': CC.violet,
  '--good': CC.green,
  '--warn': CC.acc,
  '--bad': CC.red,
};

export const PI = Math.PI;
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const sstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

type Ctx = CanvasRenderingContext2D;

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, col: string, w = 1.5, dash: number[] | null = null): void {
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

export function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, col: string, w = 2, head = 7): void {
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 0.5) return;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = x2 - Math.cos(a) * Math.min(head * 0.9, L * 0.4);
  const hy = y2 - Math.sin(a) * Math.min(head * 0.9, L * 0.4);
  line(ctx, x1, y1, hx, hy, col, w);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.42), y2 - head * Math.sin(a - 0.42));
  ctx.lineTo(x2 - head * Math.cos(a + 0.42), y2 - head * Math.sin(a + 0.42));
  ctx.closePath(); ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, stroke: string | null, fill: string | null = null, w = 1.5, dash: number[] | null = null): void {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, 2 * PI);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash); ctx.stroke(); }
  ctx.restore();
}

export const dot = (ctx: Ctx, x: number, y: number, col: string, r = 3.5) => circle(ctx, x, y, r, null, col);

export function text(ctx: Ctx, s: string, x: number, y: number, col = CC.fg, size = 11, align: CanvasTextAlign = 'left', mono = false, baseline: CanvasTextBaseline = 'middle'): void {
  ctx.fillStyle = col;
  ctx.font = `${size}px ${mono ? '"JetBrains Mono", ui-monospace, monospace' : 'Inter, system-ui, sans-serif'}`;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.fillText(s, x, y);
}

/** Rounded box, used for the pipeline diagrams. */
export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, stroke: string, fill: string | null = null, r = 6, lw = 1.2): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
  ctx.restore();
}

/** Translucent version of a hex colour. */
export const alpha = (hex: string, a: number): string => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** A plot frame with axes and optional labels. */
export function axes(ctx: Ctx, x: number, y: number, w: number, h: number, xl: string, yl: string): void {
  line(ctx, x, y, x, y + h, CC.dim, 1);
  line(ctx, x, y + h, x + w, y + h, CC.dim, 1);
  if (xl) text(ctx, xl, x + w, y + h + 13, CC.dim, 10, 'right');
  if (yl) text(ctx, yl, x - 2, y - 7, CC.dim, 10, 'left');
}

// ------------------------------------------------------------------ camera

export interface Cam { s: number; ox: number; oy: number }

/** Maps world metres to canvas pixels: y up in the world, down on screen. */
export function camFor(x0: number, x1: number, y0: number, y1: number, pad = 14): Cam {
  const s = Math.min((DW - pad * 2) / (x1 - x0), (DH - pad * 2) / (y1 - y0));
  return { s, ox: DW / 2 - ((x0 + x1) / 2) * s, oy: DH / 2 + ((y0 + y1) / 2) * s };
}
/** Same, but fitted into a sub-rectangle of the canvas instead of all of it. */
export function camIn(x0: number, x1: number, y0: number, y1: number, rx: number, ry: number, rw: number, rh: number): Cam {
  const s = Math.min(rw / (x1 - x0), rh / (y1 - y0));
  return { s, ox: rx + rw / 2 - ((x0 + x1) / 2) * s, oy: ry + rh / 2 + ((y0 + y1) / 2) * s };
}

export const px = (c: Cam, x: number) => c.ox + x * c.s;
export const py = (c: Cam, y: number) => c.oy - y * c.s;
export const unpx = (c: Cam, x: number) => (x - c.ox) / c.s;
export const unpy = (c: Cam, y: number) => (c.oy - y) / c.s;
