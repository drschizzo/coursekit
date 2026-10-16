// The toy course's stage: a ball falling from a tower, drawn from the model.

import { fr } from '@coursekit/core';
import { canvasStage } from '@coursekit/ui';
import { simulate, type Sample } from './model.ts';

export const stage = () => canvasStage({
  fall: {
    label: 'Une balle lâchée du haut d’une tour',
    prepare: (s) => simulate({ h0: s.h0 ?? 20, k: s.k ?? 0, dt: 1 / 60, duration: 4 }),
    draw(ctx, w, h, t, s, data, safe) {
      const r = data as Sample[];
      const h0 = s.h0 ?? 20;
      // the tower stands in the safe area, the part of the stage no panel covers
      const ground = safe.y + safe.h - 30, top = safe.y + 60;
      const Y = (y: number) => ground - (y / Math.max(h0, 20)) * (ground - top);
      const cx = safe.x + safe.w * 0.62;
      // ground and tower
      ctx.fillStyle = '#1d212b'; ctx.fillRect(0, ground, w, h - ground);
      ctx.fillStyle = '#2a2f3c'; ctx.fillRect(cx - 120, Y(h0) - 6, 70, ground - Y(h0) + 6);
      // the ball, looping: fall, rest one second, start again
      const dur = r.length / 60 + 1;
      const i = Math.min(r.length - 1, Math.floor(((t % dur) * 60)));
      const y = Y(r[i].y);
      const g = ctx.createRadialGradient(cx - 6, y - 26, 4, cx, y - 18, 20);
      g.addColorStop(0, '#ffd7a8'); g.addColorStop(1, '#ff8a4c');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, y - 18, 18, 0, Math.PI * 2); ctx.fill();
      // the read-out, at the top of the safe area
      ctx.fillStyle = 'rgba(230,234,245,.55)'; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`hauteur ${fr(r[i].y, 1)} m · vitesse ${fr(Math.abs(r[i].v), 1)} m/s`, safe.x + 12, safe.y + 12);
    },
  },
});
