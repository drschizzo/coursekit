// The rocket course's stage: the flight computed by the model, played back
// in the background. Two views: the launch pad, close up, and the whole
// flight over the curve of the Earth.

import { canvasStage } from '@coursekit/ui';
import { OUTCOME, R_EARTH, coast, flightOf, type Flight, type Sample } from './model.ts';
import { fr } from '@coursekit/core';

interface Prepared { f: Flight; tail: { x: number; y: number }[] }

const prepare = (s: Record<string, number>): Prepared => {
  const f = flightOf(s);
  return { f, tail: coast(f, 5400, 4) };
};

/** The sample at time t (s), linearly interpolated. */
function at(f: Flight, t: number): Sample {
  const S = f.samples;
  const i = Math.min(S.length - 1, Math.max(0, Math.floor(t)));
  const j = Math.min(S.length - 1, i + 1);
  const k = Math.min(1, Math.max(0, t - i));
  const a = S[i], b = S[j];
  return { ...a, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, alt: a.alt + (b.alt - a.alt) * k, speed: a.speed + (b.speed - a.speed) * k };
}

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, angle: number, flame: boolean, stage: number): void {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  const w = h * 0.2;
  if (flame) {
    const fl = h * (0.35 + Math.random() * 0.12);
    const g = ctx.createLinearGradient(0, 0, 0, fl);
    g.addColorStop(0, 'rgba(255,230,180,.95)'); g.addColorStop(1, 'rgba(255,138,76,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-w * 0.45, 0); ctx.lineTo(0, fl); ctx.lineTo(w * 0.45, 0); ctx.fill();
  }
  ctx.fillStyle = '#d9deea';
  const body = stage === 0 ? h : h * 0.45;
  ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -body * 0.82); ctx.lineTo(0, -body); ctx.lineTo(w / 2, -body * 0.82); ctx.lineTo(w / 2, 0); ctx.closePath(); ctx.fill();
  if (stage === 0) { ctx.fillStyle = '#7c9cff'; ctx.fillRect(-w / 2, -h * 0.58, w, h * 0.04); }
  ctx.restore();
}

function hud(ctx: CanvasRenderingContext2D, x: number, y: number, s: Sample, f: Flight): void {
  ctx.fillStyle = 'rgba(230,234,245,.6)'; ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const lines = [
    `t = ${fr(s.t)} s`,
    `altitude ${fr(s.alt / 1000, 1)} km`,
    `vitesse ${fr(s.speed)} m/s`,
    `masse ${fr(s.m / 1000, 1)} t`,
  ];
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * 17));
  ctx.fillStyle = f.outcome === 'orbit' ? 'rgba(94,224,160,.85)' : 'rgba(255,107,122,.85)';
  ctx.fillText(`issue du vol : ${OUTCOME[f.outcome]}`, x, y + lines.length * 17 + 6);
}

export const stage = () => canvasStage({
  pad: {
    label: 'Le décollage, vu de près',
    prepare,
    draw(ctx, w, h, t, _s, data, safe) {
      const { f } = data as Prepared;
      // the first 40 s, played at real speed, then again
      const T = f.outcome === 'pad' ? 6 : 40;
      const tt = t % (T + 2);
      const s = at(f, Math.min(tt, T));
      // the ground at the bottom of the safe area: the rocket stands clear of the panels
      const ground = safe.y + safe.h - 10;
      const sky = ctx.createLinearGradient(0, 0, 0, ground);
      sky.addColorStop(0, '#0b0f1a'); sky.addColorStop(1, '#1b2740');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, ground);
      ctx.fillStyle = '#1d212b'; ctx.fillRect(0, ground, w, h - ground);
      // the view follows the rocket: 1 px per metre near the ground, then wider
      const scale = Math.max(0.02, Math.min(1, 300 / Math.max(1, s.alt)));
      const cx = safe.x + safe.w * 0.62;
      // the rocket climbs to just under the read-out, then the view follows it
      const y = ground - Math.min(ground - (safe.y + 230), s.alt * scale);
      // altitude marks
      ctx.fillStyle = 'rgba(230,234,245,.35)'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'right';
      for (const m of [100, 500, 1000, 2000, 5000, 10000]) {
        const ym = ground - m * scale;
        if (ym > safe.y + 110 && ym < ground - 10) { ctx.fillRect(cx - 120, ym, 30, 1); ctx.fillText(`${fr(m)} m`, cx - 126, ym + 4); }
      }
      // tower
      ctx.fillStyle = '#2a2f3c'; ctx.fillRect(cx - 70, ground - 150 * Math.min(1, scale * 1.2), 18, 150 * Math.min(1, scale * 1.2));
      drawRocket(ctx, cx, y, 120, 0, s.burning && (f.outcome !== 'pad' || tt < T), 0);
      hud(ctx, safe.x + 12, safe.y + 16, s, f);
    },
  },
  flight: {
    label: 'Le vol complet, au-dessus de la Terre',
    prepare,
    draw(ctx, w, h, t, _s, data, safe) {
      const { f, tail } = data as Prepared;
      ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
      // the view: the launch site at the left of the safe area, a few
      // thousand km of ground to the right (the trajectory passes above the
      // diagram); altitudes are exaggerated so that 250 km fill most of the
      // safe area's height
      const span = 3600e3;
      const ox = safe.x + safe.w * 0.08, oy = safe.y + safe.h * 0.8;
      const k = Math.max(1e-6, (w - ox - 16) / span);
      const ky = (oy - safe.y - 110) / 250e3;
      // the ground: the curve of the Earth, at the horizontal scale
      ctx.fillStyle = '#16233a';
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let px = 0; px <= w; px += 8) {
        const x = (px - ox) / k;
        const drop = R_EARTH - Math.sqrt(Math.max(0, R_EARTH * R_EARTH - x * x));
        ctx.lineTo(px, oy + drop * k);
      }
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      // the 100 km line
      ctx.strokeStyle = 'rgba(124,156,255,.25)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 1; ctx.beginPath();
      for (let px = 0; px <= w; px += 8) {
        const x = (px - ox) / k;
        const drop = R_EARTH - Math.sqrt(Math.max(0, R_EARTH * R_EARTH - x * x));
        const yy = oy + drop * k - 100e3 * ky;
        px ? ctx.lineTo(px, yy) : ctx.moveTo(px, yy);
      }
      ctx.stroke(); ctx.setLineDash([]);
      // polar → screen: the angle along the ground and the altitude
      const Q = (x: number, y: number) => {
        const ang = Math.atan2(x, y), alt = Math.hypot(x, y) - R_EARTH;
        const gx = ang * R_EARTH;
        const drop = R_EARTH - Math.sqrt(Math.max(0, R_EARTH * R_EARTH - gx * gx));
        return [ox + gx * k, oy + drop * k - alt * ky] as const;
      };
      // played at 15× real time, then the coast, then again
      const T = f.samples[f.samples.length - 1].t;
      const play = 15;
      const total = T / play + 4;
      const tt = (t % total) * play;
      // the coast, dashed
      if (tt > T) {
        ctx.strokeStyle = 'rgba(230,234,245,.35)'; ctx.setLineDash([3, 5]); ctx.beginPath();
        const n = Math.floor(((tt - T) / (4 * play)) * tail.length);
        tail.slice(0, n).forEach((p, i) => { const [X, Y] = Q(p.x, p.y); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.stroke(); ctx.setLineDash([]);
      }
      // the powered flight
      ctx.lineWidth = 2.5;
      for (let i = 1; i < f.samples.length && f.samples[i].t <= tt; i++) {
        const a = f.samples[i - 1], b = f.samples[i];
        ctx.strokeStyle = !b.burning ? 'rgba(230,234,245,.4)' : b.stage === 0 ? '#ffb35c' : '#5ee0a0';
        const [x1, y1] = Q(a.x, a.y), [x2, y2] = Q(b.x, b.y);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      const s = at(f, Math.min(tt, T));
      const [X, Y] = Q(s.x, s.y);
      const s2 = at(f, Math.min(tt + 1, T));
      const [X2, Y2] = Q(s2.x, s2.y);
      const ang = Math.atan2(X2 - X, -(Y2 - Y));
      drawRocket(ctx, X, Y, 26, Number.isFinite(ang) && (X2 !== X || Y2 !== Y) ? ang : 0, s.burning && tt <= T, s.stage);
      // the events, as dots: their names come with the chapters that explain them
      for (const ev of f.events) {
        if (ev.t > tt || ev.kind === 'kick') continue;
        const e = at(f, ev.t);
        const [ex, ey] = Q(e.x, e.y);
        ctx.fillStyle = 'rgba(230,234,245,.85)'; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(230,234,245,.35)'; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`altitudes exagérées ${fr(ky / k)} fois · vol accéléré quinze fois`, safe.x + 12, safe.y + safe.h - 6);
      hud(ctx, safe.x + 12, safe.y + 16, s, f);
    },
  },
});
