// The values a diagram can be drawn with during the course: its value along
// the reading, and, for every experiment shown with it, each control at its
// bounds. The content checker draws them all; the player's test mode shows
// them side by side. Labels that collide or a figure that makes no sense
// usually appear only at the extremes.

import type { Timeline } from './timeline.ts';
import type { Control, Vals } from './types.ts';

export interface DiagramVariant { name: string; arg?: string; label: string; v: Vals }

/** The extreme values of a control: min and max, on and off, every option. */
export function controlBounds(c: Control): number[] {
  if (c.type === 'toggle') return [c.on ?? 1, c.off ?? 0];
  if (c.type === 'choice') return (c.options ?? []).map((o) => o.value);
  return [c.min ?? 0, c.max ?? 1];
}

export function diagramVariants(tl: Timeline): DiagramVariant[] {
  const out: DiagramVariant[] = [];
  const seen = new Set<string>();
  const add = (name: string, arg: string | undefined, label: string, v: Vals) => {
    const k = `${name}|${arg ?? ''}|${JSON.stringify(Object.entries(v).sort())}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ name, arg, label, v });
  };
  for (const c of tl.caps) {
    const d = tl.diagAt(c.t + 0.01);
    if (d) add(d.name, d.arg, `« ${c.title} »`, tl.eval(c.t + 0.01));
  }
  for (const st of tl.stops) {
    if (st.kind !== 'try') continue;
    const d = tl.diagAt(st.t);
    if (!d) continue;
    const base = tl.eval(st.t);
    for (const c of st.controls) {
      for (const x of controlBounds(c)) add(d.name, d.arg, `« ${st.title} », ${c.label} = ${x}`, { ...base, [c.key]: x });
    }
    // all the controls at their minimum, then at their maximum
    if (st.controls.length > 1) {
      for (const side of [0, 1]) {
        const v = { ...base };
        for (const c of st.controls) { const b = controlBounds(c); v[c.key] = b[Math.min(side, b.length - 1)]; }
        add(d.name, d.arg, `« ${st.title} », tous les réglages au ${side ? 'maximum' : 'minimum'}`, v);
      }
    }
  }
  return out;
}
