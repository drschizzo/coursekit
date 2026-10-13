// The toy course's diagram: height and speed against time, computed by the
// model with the current values (h0, k, steps per second).

import type { DiagramEnv } from '@coursekit/core';
import { CC, DH, DW, axes, dot, text } from '@coursekit/diagrams';
import { simulate } from './model.ts';

export function fallPlot(ctx: CanvasRenderingContext2D, e: DiagramEnv): void {
  const h0 = e.v.h0 ?? 20, k = e.v.k ?? 0, sps = Math.max(2, Math.round(e.v.steps ?? 30));
  const exact = simulate({ h0, k, dt: 1 / 600, duration: 3 });
  const coarse = simulate({ h0, k, dt: 1 / sps, duration: 3 });
  const x0 = 40, y0 = 24, w = DW - 60, hgt = 170;
  axes(ctx, x0, y0, w, hgt, 't (s)', 'hauteur (m)');
  const X = (t: number) => x0 + (t / 3) * w, Y = (y: number) => y0 + hgt - (y / Math.max(1, h0)) * hgt;
  const path = (r: { t: number; y: number }[], col: string, lw: number) => {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    r.forEach((s, i) => (i ? ctx.lineTo(X(s.t), Y(s.y)) : ctx.moveTo(X(s.t), Y(s.y))));
    ctx.stroke(); ctx.restore();
  };
  path(exact, CC.blue, 2);
  path(coarse, CC.acc, 1.5);
  if (sps <= 30) for (const s of coarse) dot(ctx, X(s.t), Y(s.y), CC.acc, 2.2);
  // a marker running along the exact curve
  const i = Math.floor(((e.t * 0.5) % 1) * (exact.length - 1));
  dot(ctx, X(exact[i].t), Y(exact[i].y), CC.fg, 3.5);
  text(ctx, 'calcul fin', DW - 14, 16, CC.blue, 10, 'right');
  text(ctx, `${sps} pas par seconde`, DW - 14, 30, CC.acc, 10, 'right');
  text(ctx, k > 0 ? `vitesse limite g/k = ${(9.81 / k).toFixed(1).replace('.', ',')} m/s` : 'sans frottement de l’air', 46, DH - 8, CC.dim, 10);
}

export const DIAGRAMS = { fallPlot };
