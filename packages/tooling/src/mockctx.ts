// A canvas context that draws nothing, so diagrams can run without a browser
// and their exceptions be caught. It records the texts drawn, with an
// approximate box, so the checker can find labels that leave the frame,
// labels drawn over each other, and figures that are not numbers.

export interface DrawnText { s: string; x: number; y: number; w: number; h: number }

export interface MockContext extends CanvasRenderingContext2D {
  /** texts drawn since the last `reset()`, without the transformed ones */
  readonly texts: DrawnText[];
  reset(): void;
}

/** Average glyph width of the UI fonts, as a fraction of the font size. */
const GLYPH = 0.55;

/** A context for a canvas of w × h CSS pixels (a diagram's size by default). */
export function mockContext(w = 380, h = 236): MockContext {
  const noop = () => {};
  const texts: DrawnText[] = [];
  // a text drawn under a translate / rotate / scale is not where its x, y say
  let transformed = false;
  const stack: { font: unknown; align: unknown; base: unknown; transformed: boolean }[] = [];
  const state: Record<string | symbol, unknown> = {
    canvas: { width: w, height: h, clientWidth: w, clientHeight: h },
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
  };
  const size = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10);
  const fillText = (s: unknown, x: number, y: number) => {
    if (transformed) return;
    const str = String(s), fs = size();
    const w = str.length * fs * GLYPH, h = fs;
    const al = String(state.textAlign);
    const x0 = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
    const bl = String(state.textBaseline);
    const y0 = bl === 'middle' ? y - h / 2 : bl === 'top' || bl === 'hanging' ? y : y - h * 0.8;
    texts.push({ s: str, x: x0, y: y0, w, h });
  };
  const methods: Record<string, unknown> = {
    measureText: (s: string) => ({ width: String(s).length * size() * GLYPH }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({ addColorStop: noop }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    getLineDash: () => [],
    fillText, strokeText: fillText,
    save: () => { stack.push({ font: state.font, align: state.textAlign, base: state.textBaseline, transformed }); },
    restore: () => { const s = stack.pop(); if (s) { state.font = s.font; state.textAlign = s.align; state.textBaseline = s.base; transformed = s.transformed; } },
    translate: () => { transformed = true; }, rotate: () => { transformed = true; }, scale: () => { transformed = true; },
    transform: () => { transformed = true; }, setTransform: () => { transformed = true; },
    resetTransform: () => { transformed = false; },
    reset: () => { texts.length = 0; transformed = false; stack.length = 0; },
  };
  const handler: ProxyHandler<Record<string | symbol, unknown>> = {
    get(target, prop) {
      if (prop === 'texts') return texts;
      if (typeof prop === 'string' && prop in methods) return methods[prop];
      if (prop in target) return target[prop];
      return noop;
    },
    set(target, prop, v) { target[prop] = v; return true; },
  };
  return new Proxy(state, handler) as unknown as MockContext;
}

export interface Box { x: number; y: number; w: number; h: number }

/**
 * Problems in the texts of one drawing: out of the frame (0, 0, W, H — or the
 * rectangle `frame`, named `where`), over each other, not a number.
 */
export function textProblems(texts: DrawnText[], W: number, H: number, frame: Box = { x: 0, y: 0, w: W, h: H }, where = 'du cadre'): string[] {
  const out: string[] = [];
  const short = (s: string) => (s.length > 28 ? `${s.slice(0, 27)}…` : s);
  for (const t of texts) {
    if (/\bNaN\b|\bundefined\b|\bnull\b|Infinity/.test(t.s)) out.push(`texte non numérique « ${short(t.s)} »`);
    const m = 2; // tolerance, px
    const f = frame;
    if (t.s.trim() && (t.x < f.x - m || t.x + t.w > f.x + f.w + m || t.y < f.y - m || t.y + t.h > f.y + f.h + m)) out.push(`texte hors ${where} « ${short(t.s)} »`);
  }
  // two labels overlap when their boxes share more than 35 % of the smaller one
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (!a.s.trim() || !b.s.trim()) continue;
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix <= 0 || iy <= 0) continue;
      if (ix * iy > 0.35 * Math.min(a.w * a.h, b.w * b.h)) out.push(`textes superposés « ${short(a.s)} » et « ${short(b.s)} »`);
    }
  }
  return out;
}
