// What the learner has on screen at a moment of the course, as texts: the
// step shown in the panel, the diagram and the stage scene, each drawn by
// `mockContext` with the values of that moment. The checker reads it to find
// questions whose answer is already on screen and terms a picture shows
// before the text introduces them; `coursekit parcours` prints it.
//
// Also the small text tools those rules share: normalised words, numbers
// read back from French figures, the overlap of two texts.

import { captionText, wideSafeArea, type Caption, type CourseDef, type DiagramEnv, type Rect, type Timeline, type Vals } from '@coursekit/core';
import { beginBudget } from '@coursekit/diagrams';
import { TOOL_DIAGRAMS } from '@coursekit/toolbox';
import { mockContext } from './mockctx.ts';

/** A scene of a canvasStage, as the checker sees it (see @coursekit/ui). */
export interface SceneLike {
  label?: string;
  prepare?(settings: Vals): unknown;
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, settings: Vals, data: unknown, safe: Rect): void;
}

/**
 * The two windows the stage scenes are drawn in: a wide screen, the text on
 * the left and the diagram on the right (its safe area comes from the
 * player's LAYOUT); a phone, the panels above and below.
 */
export const SAFE_ZONES: { name: string; w: number; h: number; safe: Rect }[] = [
  { name: 'large', w: 1440, h: 900, safe: wideSafeArea(1440, 900) },
  { name: 'étroite', w: 390, h: 844, safe: { x: 8, y: 64, w: 374, h: 300 } },
];

export interface Screen {
  /** the step in the panel: a question opens under the text of the step it follows */
  step: { title: string; text: string } | null;
  diagram: { name: string; arg?: string; texts: string[] } | null;
  scene: { key: string; label: string; texts: string[] } | null;
}

/** The moments a diagram is drawn at: animations that reveal their parts one after the other are seen whole. */
const DIAGRAM_TIMES = [0, 3.7, 11.2];
const SCENE_TIMES = [1.5, 6];

const valsKey = (v: Vals) => JSON.stringify(Object.entries(v).sort());
/** A step's text; a lazy text that fails is reported by the walk, and reads as empty here. */
export const textOf = (c: Caption): string => { try { return captionText(c); } catch { return ''; } };

export interface ScreenReader {
  at(t: number, v?: Vals): Screen;
  diagramTexts(name: string, arg: string | undefined, v: Vals): string[];
  sceneTexts(key: string, v: Vals): string[];
}

export function screenReader(course: CourseDef, tl: Timeline, scenes?: Record<string, SceneLike>): ScreenReader {
  const ctx = mockContext();
  const draw = { ...TOOL_DIAGRAMS, ...(course.diagrams ?? {}) } as Record<string, (c: CanvasRenderingContext2D, e: DiagramEnv) => void>;
  const dcache = new Map<string, string[]>();
  const scache = new Map<string, string[]>();
  const diagramTexts = (name: string, arg: string | undefined, v: Vals): string[] => {
    const key = `${name}|${arg ?? ''}|${valsKey(v)}`;
    const hit = dcache.get(key);
    if (hit) return hit;
    const out = new Set<string>();
    if (draw[name]) {
      for (const t of DIAGRAM_TIMES) {
        ctx.reset();
        // the curves a diagram fills in over several frames, all computed: the learner sees them once they are there
        beginBudget(Number.MAX_SAFE_INTEGER);
        try { draw[name](ctx, { t, v: { ...v }, arg, ptr: null, hits: new Set(), model: course.model }); } catch { break; } finally { beginBudget(0); }
        for (const x of ctx.texts) if (x.s.trim()) out.add(x.s.trim());
      }
    }
    const texts = [...out];
    dcache.set(key, texts);
    return texts;
  };
  const sceneTexts = (key: string, v: Vals): string[] => {
    const id = `${key}|${valsKey(v)}`;
    const hit = scache.get(id);
    if (hit) return hit;
    const out = new Set<string>();
    const scene = scenes?.[key];
    if (scene) {
      const z = SAFE_ZONES[0];
      const sctx = mockContext(z.w, z.h);
      try {
        const data = scene.prepare ? scene.prepare({ ...v }) : null;
        for (const t of SCENE_TIMES) {
          sctx.reset();
          scene.draw(sctx, z.w, z.h, t, { ...v }, data, { ...z.safe });
          for (const x of sctx.texts) if (x.s.trim()) out.add(x.s.trim());
        }
      } catch { /* the stage rules report it */ }
    }
    const texts = [...out];
    scache.set(id, texts);
    return texts;
  };
  return {
    diagramTexts,
    sceneTexts,
    at(t, v = tl.eval(t)) {
      const ci = tl.caps.length ? tl.capAt(t) : -1;
      const cap = ci >= 0 && tl.caps[ci].t <= t + 1e-6 ? tl.caps[ci] : null;
      const d = tl.diagAt(t);
      const sc = tl.sceneAt(t);
      const label = sc ? [course.scenes?.[sc.key], scenes?.[sc.key]?.label].filter(Boolean).join(' · ') : '';
      return {
        step: cap ? { title: cap.title, text: textOf(cap) } : null,
        diagram: d ? { name: d.name, arg: d.arg, texts: diagramTexts(d.name, d.arg, v) } : null,
        scene: sc ? { key: sc.key, label, texts: scenes?.[sc.key] ? sceneTexts(sc.key, tl.stageVals(t)) : [] } : null,
      };
    },
  };
}

// ------------------------------------------------------------ text tools

const STOP = new Set((
  'les des une aux par pour sur dans avec sans que qui quoi dont est sont ont été être avoir fait faire font '
  + 'elle elles ils leur leurs son ses sa mon ton nos vos cet cette ces ceux celle celles tout tous toute toutes '
  + 'très bien plus moins même aussi comme mais donc car chaque entre vers avant après encore jamais toujours souvent '
  + 'peu beaucoup trop assez rien quand alors ainsi lui eux une deux trois quatre cinq quel quelle quels quelles '
  + 'peut peuvent doit faut cela ceci ici là non oui pas ne the and for with from that this are was'
).split(/\s+/).map((w) => w.normalize('NFD').replace(/\p{M}/gu, '')));

/** Lower case, without accents, typographic apostrophes and spaces made plain. */
export const norm = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[’`]/g, '\'').replace(/[\u00a0\u202f\u2009]/g, ' ').replace(/\s+/g, ' ').trim();

/** A rough stem: « parties », « partie » and « parti » meet. */
const stem = (w: string): string => (w.length > 4 ? w.replace(/(es|s|x|e)$/, '') : w);

/** The words of a text that carry its meaning, stemmed. */
export function contentWords(s: string): Set<string> {
  const out = new Set<string>();
  for (const raw of norm(s).replace(/\b[ldjmnstcq]'/g, ' ').split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP.has(raw) || /^\d+$/.test(raw)) continue;
    out.add(stem(raw));
  }
  return out;
}

/** The share of the words of `a` found in `pool`. */
export const coverage = (a: Set<string>, pool: Set<string>): number => {
  if (!a.size) return 0;
  let k = 0;
  for (const w of a) if (pool.has(w)) k++;
  return k / a.size;
};

/** Jaccard index of two sets of words. */
export const jaccard = (a: Set<string>, b: Set<string>): number => {
  let k = 0;
  for (const w of a) if (b.has(w)) k++;
  return a.size + b.size - k ? k / (a.size + b.size - k) : 0;
};

/** The numbers written in a text, French or not: « 255 168 », « −0,25 », « 33 % » → 255168, −0.25, 33. */
export function numbersIn(s: string): number[] {
  const out: number[] = [];
  const re = /[−-]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:,\d+)?|[−-]?\d+(?:[,.]\d+)?/g;
  for (const m of s.matchAll(re)) {
    const x = Number(m[0].replace(/[ \u00a0\u202f]/g, '').replace('−', '-').replace(',', '.'));
    if (Number.isFinite(x)) out.push(x);
  }
  return out;
}

/**
 * Whether a number is specific enough that finding it written elsewhere is no
 * coincidence: 72, 255 168, 0,25 or 1,7 are; 0, 1, 3 or 0,5 (an axis tick) are not.
 */
export function telling(x: number): boolean {
  if (Math.abs(x) >= 10) return true;
  const digits = String(Number(Math.abs(x).toPrecision(6))).replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  return digits.length >= 2;
}
