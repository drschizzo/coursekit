// The epidemic course's stage: the year computed by the model, played back
// in the background. Two views: the town, one dot for 100 inhabitants, and
// the curve of the hospital beds against the capacity.

import { fr } from '@coursekit/core';
import { canvasStage } from '@coursekit/ui';
import { BEDS, DAYS, N, OUTCOME, epidemicOf, type Day, type Epidemic } from './model.ts';

const COLS = 40, ROWS = 25, DOTS = COLS * ROWS;
const PER_DOT = N / DOTS;

/** A fixed pseudo-random number in [0, 1) for an integer. */
const hash = (i: number): number => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/**
 * The order in which the dots are infected: the disease starts near one
 * corner of the town and spreads outwards, with some noise. The order of the
 * vaccinated dots is separate: they are spread over the whole town.
 */
const INFECT_ORDER: number[] = (() => {
  const keyed = Array.from({ length: DOTS }, (_, i) => {
    const c = i % COLS, r = Math.floor(i / COLS);
    const d = Math.hypot((c - COLS * 0.3) / COLS, (r - ROWS * 0.4) / ROWS);
    return { i, k: d + hash(i) * 0.45 };
  });
  return keyed.sort((a, b) => a.k - b.k).map((x) => x.i);
})();
const VAX_ORDER: number[] = Array.from({ length: DOTS }, (_, i) => i).sort((a, b) => hash(a + 7919) - hash(b + 7919));

const DAYS_PER_SECOND = 8;

const dayAt = (e: Epidemic, t: number): Day => {
  const total = DAYS / DAYS_PER_SECOND + 3;
  const d = Math.min(DAYS, Math.floor((t % total) * DAYS_PER_SECOND));
  return e.days[d];
};

const COL = { S: '#3a4a6b', I: '#ffb35c', R: '#5ee0a0', V: '#7c9cff' };

function hud(ctx: CanvasRenderingContext2D, x: number, y: number, d: Day, e: Epidemic): void {
  ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(230,234,245,.6)';
  const lines = [
    `jour ${fr(d.t)}`,
    `contagieux ${fr(d.I)}`,
    `déjà rétablis ou vaccinés ${fr(d.R)}`,
    `lits occupés ${fr(d.beds)} sur ${fr(BEDS)}`,
  ];
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * 17));
  ctx.fillStyle = e.outcome === 'overflow' ? 'rgba(255,107,122,.85)' : 'rgba(94,224,160,.85)';
  ctx.fillText(`issue de l’année : ${OUTCOME[e.outcome]}`, x, y + lines.length * 17 + 6);
}

export const stage = () => canvasStage({
  town: {
    label: 'La ville, un point pour cent habitants',
    prepare: (s) => epidemicOf(s),
    draw(ctx, w, h, t, s, data, safe) {
      const e = data as Epidemic;
      ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
      const d = dayAt(e, t);
      const vaxDots = Math.round((s.vax ?? 0) * DOTS);
      const vaxSet = new Set(VAX_ORDER.slice(0, vaxDots));
      const order = INFECT_ORDER.filter((i) => !vaxSet.has(i));
      const everInfected = Math.round((N - (s.vax ?? 0) * N - d.S) / PER_DOT);
      const recovered = Math.round((d.R - (s.vax ?? 0) * N) / PER_DOT);
      const state = new Array<keyof typeof COL>(DOTS).fill('S');
      for (const i of vaxSet) state[i] = 'V';
      order.forEach((i, k) => { if (k < recovered) state[i] = 'R'; else if (k < everInfected) state[i] = 'I'; });
      // the grid fills the safe area below the read-out
      const top = safe.y + 120, left = safe.x + 16;
      const gw = safe.w - 32, gh = safe.h - 120 - 24;
      const step = Math.max(4, Math.min(gw / COLS, gh / ROWS));
      const r = Math.max(1.5, step * 0.32);
      for (let i = 0; i < DOTS; i++) {
        const c = i % COLS, rr = Math.floor(i / COLS);
        ctx.fillStyle = COL[state[i]];
        ctx.beginPath(); ctx.arc(left + c * step + step / 2, top + rr * step + step / 2, r, 0, Math.PI * 2); ctx.fill();
      }
      hud(ctx, safe.x + 12, safe.y + 16, d, e);
      ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'left';
      const legend: [string, string][] = [['susceptible', COL.S], ['contagieux', COL.I], ['rétabli', COL.R], ['vacciné', COL.V]];
      let lx = left;
      for (const [label, col] of legend) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx + 4, safe.y + safe.h - 10, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(230,234,245,.5)'; ctx.fillText(label, lx + 12, safe.y + safe.h - 6);
        lx += ctx.measureText(label).width + 30;
      }
    },
  },
  curve: {
    label: 'Les lits d’hôpital occupés, jour après jour',
    prepare: (s) => epidemicOf(s),
    draw(ctx, w, h, t, s, data, safe) {
      const e = data as Epidemic;
      ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
      const d = dayAt(e, t);
      const T = 200;
      const x0 = safe.x + 50, x1 = safe.x + safe.w - 20;
      const y0 = safe.y + 130, y1 = safe.y + safe.h - 30;
      const top = Math.max(2 * BEDS, e.peak.beds * 1.15);
      const X = (day: number) => x0 + (day / T) * (x1 - x0);
      const Y = (b: number) => y1 - (Math.min(b, top) / top) * (y1 - y0);
      ctx.strokeStyle = 'rgba(230,234,245,.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
      // the capacity
      ctx.strokeStyle = 'rgba(255,107,122,.7)'; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(x0, Y(BEDS)); ctx.lineTo(x1, Y(BEDS)); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,107,122,.8)';
      ctx.fillText(`capacité : ${fr(BEDS)} lits`, x1, Y(BEDS) - 6);
      // the measures
      if ((s.cut ?? 0) > 0 && (s.start ?? 0) <= T) {
        ctx.strokeStyle = 'rgba(124,156,255,.6)'; ctx.beginPath(); ctx.moveTo(X(s.start), y0); ctx.lineTo(X(s.start), y1); ctx.stroke();
        ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(124,156,255,.8)'; ctx.fillText('début des mesures', X(s.start) + 5, y0 + 12);
      }
      // the beds, up to the current day, coloured above the capacity
      ctx.lineWidth = 3;
      for (let i = 1; i < e.days.length && e.days[i].t <= Math.min(d.t, T); i++) {
        const a = e.days[i - 1], b = e.days[i];
        ctx.strokeStyle = b.beds > BEDS ? '#ff6b7a' : '#ffb35c';
        ctx.beginPath(); ctx.moveTo(X(a.t), Y(a.beds)); ctx.lineTo(X(b.t), Y(b.beds)); ctx.stroke();
      }
      ctx.lineWidth = 1;
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,234,245,.4)';
      for (const day of [50, 100, 150, 200]) ctx.fillText(`j${day}`, X(day), y1 + 16);
      hud(ctx, safe.x + 12, safe.y + 16, d, e);
    },
  },
});
