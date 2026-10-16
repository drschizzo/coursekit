// The stage of the course: the toy universes of the model, played back in the
// background. Six scenes: a cellular automaton, the dust put back in order,
// the TVC cube, the edge of the Cosmoplexe (heat), the boundary layer (atoms),
// and a swarm of Lambertians dancing a theory. Everything that is drawn or
// written stays in `safe`, the part of the screen no panel covers.

import { canvasStage } from '@coursekit/ui';
import { fr, type Rect } from '@coursekit/core';
import {
  BOOK, TOY, contestOf, dustOf, gateOf, growOf, heatOf, history, rng, supplyAt,
  type Contest, type DustRun, type GateRun, type GrowRun, type HeatRun, type Row, type Theory,
} from './model.ts';
import { THEORY_NAME } from './diagrams.ts';

type Ctx = CanvasRenderingContext2D;
type V = Record<string, number>;

const BG = '#0b0f1a';
const C = { fg: 'rgba(230,234,245,.85)', dim: 'rgba(230,234,245,.5)', acc: '#ffb35c', blue: '#7c9cff', green: '#5ee0a0', red: '#ff6b7a', violet: '#b48cff' };

function background(ctx: Ctx, w: number, h: number): void { ctx.fillStyle = BG; ctx.fillRect(0, 0, w, h); }

function hud(ctx: Ctx, safe: Rect, lines: string[], last: string, col: string): void {
  ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.dim;
  lines.forEach((l, i) => ctx.fillText(l, safe.x + 12, safe.y + 18 + i * 17));
  ctx.fillStyle = col;
  ctx.fillText(last, safe.x + 12, safe.y + 24 + lines.length * 17);
}

/** The area below the read-out where the action is drawn. */
const area = (safe: Rect, top = 96) => ({ x: safe.x + 12, y: safe.y + top, w: Math.max(40, safe.w - 24), h: Math.max(40, safe.h - top - 12) });

function rows(ctx: Ctx, r: Row[], from: number, n: number, x: number, y: number, k: number, on: string): void {
  for (let t = 0; t < n && from + t < r.length; t++) {
    const row = r[from + t];
    for (let i = 0; i < row.length; i++) if (row[i]) { ctx.fillStyle = on; ctx.fillRect(x + i * k, y + t * k, Math.max(1, k - 0.5), Math.max(1, k - 0.5)); }
  }
}

export const stage = () => canvasStage({
  // ------------------------------------------------------------ automaton
  ca: {
    label: 'Un automate cellulaire',
    prepare: (s: V) => ({ rule: Math.round(s.rule ?? 30), seed: Math.round(s.caSeed ?? 0), h: history(Math.round(s.rule ?? 30), 120, Math.round(s.caSeed ?? 0), 600) }),
    draw(ctx, w, h, t, s, data, safe) {
      const d = data as { rule: number; seed: number; h: Row[] };
      background(ctx, w, h);
      const a = area(safe, 124), k = Math.max(1.5, Math.min(6, a.w / 120)), vis = Math.max(1, Math.floor(a.h / k));
      const cyc = Math.floor(t * 14), from = Math.max(0, Math.min(cyc - vis, d.h.length - vis)) % Math.max(1, d.h.length - vis);
      const x = a.x + (a.w - 120 * k) / 2;
      ctx.fillStyle = 'rgba(230,234,245,.03)'; ctx.fillRect(x, a.y, 120 * k, vis * k);
      rows(ctx, d.h, from, Math.min(vis, cyc + 1), x, a.y, k, C.acc);
      // the ring, unrolled: its two ends are neighbours
      const W = 120 * k;
      ctx.strokeStyle = 'rgba(124,156,255,.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(x, a.y - 2); ctx.bezierCurveTo(x, a.y - 18, x + W, a.y - 18, x + W, a.y - 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.blue; ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('les deux bords sont voisins', x + W / 2, a.y - 25);
      ctx.textAlign = 'left';
      hud(ctx, safe, [`règle ${fr(d.rule)} · anneau de ${fr(120)} cellules`, `cycle ${fr(from + Math.min(vis, cyc + 1) - 1)}`], 'même règle partout, à chaque cycle', C.fg);
    },
  },
  // ----------------------------------------------------------------- dust
  dust: {
    label: 'La poussière remise en ordre',
    prepare: (s: V) => dustOf(Math.round(s.slices ?? 1), Math.round(s.missing ?? 0), 40, 36),
    draw(ctx, w, h, t, s, data, safe) {
      const d = data as DustRun;
      background(ctx, w, h);
      const a = area(safe), T = d.frames.length, N = d.frames[0].length;
      const k = Math.max(1, Math.min((a.w - 30) / (2 * N), (a.h - 12) / (T + 4))), ph = (t % 14) / 14;
      const shown = Math.floor(Math.min(1, ph * 2) * T), rebuilt = ph > 0.5 ? Math.floor(Math.min(1, (ph - 0.5) * 2.4) * T) : 0;
      const xa = a.x + (a.w - (2 * N * k + 30)) / 2, xb = xa + N * k + 30;
      const hue = (i: number) => `hsl(${30 + (i / T) * 200}, 75%, 62%)`;
      d.computed.slice(0, shown).forEach((i, j) => {
        if (!d.kept[i]) { ctx.strokeStyle = C.red; ctx.strokeRect(xa, a.y + j * k, N * k, k); return; }
        rows(ctx, [d.frames[i]], 0, 1, xa, a.y + j * k, k, hue(i));
      });
      let y = a.y, n = 0;
      d.chains.forEach((c, ci) => {
        if (ci > 0) { ctx.fillStyle = C.red; ctx.fillRect(xb - 4, y + k, N * k + 8, 2); y += 4 * k; }
        for (const i of c) { if (n++ < rebuilt) rows(ctx, [d.frames[i]], 0, 1, xb, y, k, hue(i)); y += k; }
      });
      hud(ctx, safe, [`${fr(T)} instants en ${fr(Math.round(s.slices ?? 1))} tranche${(s.slices ?? 1) > 1 ? 's' : ''} mélangée${(s.slices ?? 1) > 1 ? 's' : ''}`, 'à gauche : l’ordre de calcul · à droite : l’ordre retrouvé'],
        d.outcome === 'intact' ? 'une seule histoire, sans saut' : `${fr(d.chains.length)} morceaux : la règle ne relie pas les bords du trou`, d.outcome === 'intact' ? C.green : C.red);
    },
  },
  // -------------------------------------------------------------- Elysium
  elysium: {
    label: 'Le cube de l’Élysium',
    prepare: (s: V) => growOf(s.accel ?? 2, s.pop ?? 1),
    draw(ctx, w, h, t, s, data, safe) {
      const g = data as GrowRun;
      background(ctx, w, h);
      const R = rng(9);
      for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(230,234,245,${0.15 + R() * 0.35})`; ctx.fillRect(R() * w, R() * h, 1.2, 1.2); }
      const a = area(safe, 110), ph = (t % 16) / 16, k = Math.min(g.t.length - 1, Math.floor(ph * g.t.length));
      const gen = g.t[k], scale = 0.3 + 0.7 * Math.log(Math.cbrt(supplyAt(gen)) / BOOK.edge) / Math.log(Math.cbrt(supplyAt(TOY.horizon)) / BOOK.edge);
      const S = Math.min(a.w, a.h) * 0.42 * scale, cx = a.x + a.w / 2, cy = a.y + a.h / 2;
      // isometric cube
      const P = (x: number, y: number, z: number) => [cx + (x - y) * S * 0.87, cy + (x + y) * S * 0.5 - z * S] as const;
      const top = [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)], fl = [P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1)], fr2 = [P(1, -1, 1), P(1, 1, 1), P(1, 1, -1), P(1, -1, -1)];
      const face = (pts: readonly (readonly [number, number])[], col: string) => {
        ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(160,190,255,.5)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.moveTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.strokeStyle = 'rgba(160,190,255,.25)'; ctx.stroke();
      };
      face(top, 'rgba(120,150,255,.22)'); face(fl, 'rgba(90,120,230,.18)'); face(fr2, 'rgba(70,100,210,.14)');
      const collapse = Math.max(0, Math.min(1, s.collapse ?? 0));
      if (collapse > 0) {
        const [x, y] = P(1, 0.2, 0.1);
        const grd = ctx.createRadialGradient(x, y, 0, x, y, S * 1.6 * collapse);
        grd.addColorStop(0, 'rgba(0,0,0,.95)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, S * 1.6 * collapse, 0, 2 * Math.PI); ctx.fill();
      }
      const m = g.margin[k];
      const outcome = { surplus: 'surplus croissant', 'early-deficit': 'manque, puis surplus', 'late-deficit': 'surplus, puis manque', deficit: 'manque permanent' }[g.outcome];
      hud(ctx, safe, [`génération ${fr(gen)} · arête ${fr(BOOK.edge + 2 * gen)} processeurs`, `disponibles ÷ nécessaires : ${m >= 100 ? fr(m) : fr(m, 2)}`, collapse > 0 ? 'des processeurs ne répondent plus' : `Temps standard en t^${fr(s.accel ?? 2, 1)}`], outcome, m >= 1 ? C.green : C.red);
    },
  },
  // ----------------------------------------------------- Cosmoplexe: heat
  cosmo: {
    label: 'Le bord du Cosmoplexe',
    prepare: (s: V) => heatOf(s.absorb ?? 1, s.lum ?? 1),
    draw(ctx, w, h, t, s, data, safe) {
      const r = data as HeatRun, absorb = Math.max(0, Math.min(1, s.absorb ?? 1));
      background(ctx, w, h);
      const a = area(safe, 100), bx = a.x + 6, by = a.y + 6, bw = a.w - 12, bh = a.h - 12;
      ctx.strokeStyle = absorb > 0.99 ? 'rgba(180,140,255,.7)' : `rgba(180,140,255,${0.25 + 0.45 * absorb})`; ctx.setLineDash(absorb > 0.99 ? [] : [6, 5]); ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh); ctx.setLineDash([]);
      const cx = bx + bw * 0.42, cy = by + bh * 0.5, ph = (t % 12) / 12, hours = ph * TOY.heatHours;
      const i = Math.min(r.temp.length - 1, Math.round(hours * 2)), T = r.temp[i];
      // photons: each one crosses the volume, then leaves at the edge, or comes round again (k times);
      // a photon is visible during its laps out of a cycle of 8, so the light stored grows with k
      const R = rng(31), lum = Math.max(0.1, s.lum ?? 1), n = Math.round(110 * Math.sqrt(lum));
      for (let p = 0; p < n; p++) {
        const th = R() * 2 * Math.PI, u = R(), off = R() * 8;
        const laps = absorb >= 0.999 ? 1 : absorb <= 0.001 ? 8 : Math.min(8, 1 + Math.floor(Math.log(Math.max(u, 1e-6)) / Math.log(1 - absorb)));
        const ph8 = (t * 0.45 + off) % 8;
        if (ph8 >= laps) continue;
        const ex = Math.cos(th) > 0 ? (bx + bw - cx) / Math.cos(th) : (bx - cx) / Math.cos(th);
        const ey = Math.sin(th) > 0 ? (by + bh - cy) / Math.sin(th) : (by - cy) / Math.sin(th);
        const d = ph8 * Math.min(Math.abs(ex), Math.abs(ey));
        let x = cx + Math.cos(th) * d, y = cy + Math.sin(th) * d;
        x = bx + ((((x - bx) % bw) + bw) % bw); y = by + ((((y - by) % bh) + bh) % bh);
        ctx.fillStyle = `rgba(255,214,120,${0.75 - 0.05 * Math.floor(ph8)})`; ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
      }
      ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(cx, cy, 10 + 4 * Math.sqrt(lum), 0, 2 * Math.PI); ctx.fill();
      const orb = Math.min(bw, bh) * 0.3, pa = t * 0.5, px = cx + Math.cos(pa) * orb, py = cy + Math.sin(pa) * orb * 0.8;
      ctx.strokeStyle = 'rgba(230,234,245,.12)'; ctx.beginPath(); ctx.ellipse(cx, cy, orb, orb * 0.8, 0, 0, 2 * Math.PI); ctx.stroke();
      const col = T < TOY.aquaFreeze ? '#bcd4ff' : T > TOY.aquaBoil ? '#ff8a5c' : '#5aa9ff';
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 6, 0, 2 * Math.PI); ctx.fill();
      const state = T < TOY.aquaFreeze ? 'aqua gelée' : T > TOY.aquaBoil ? 'l’aqua bout' : 'aqua liquide';
      hud(ctx, safe, [`frontière : ${absorb >= 0.999 ? 'ouverte, la lumière sort' : absorb <= 0.001 ? 'refermée en tore, la lumière revient' : `${fr(absorb * 100)} % de la lumière sort`}`, `heure ${fr(hours)} · planète Lambert ${fr(T)} K`], state, T < TOY.aquaFreeze ? C.blue : T > TOY.aquaBoil ? C.red : C.green);
    },
  },
  // ----------------------------------------------------- Cosmoplexe: gate
  gate: {
    label: 'La couche limite',
    prepare: (s: V) => gateOf(Math.round(s.inject ?? -1), (s.defend ?? 0) > 0.5),
    draw(ctx, w, h, t, s, data, safe) {
      const g = data as GateRun;
      background(ctx, w, h);
      const a = area(safe, 100), L = g.frames[0].length, T = g.frames.length;
      const step = Math.floor((t * 4) % (T + 6)), k = Math.max(3, Math.min(a.w / L, 26)), x0 = a.x + (a.w - L * k) / 2;
      const now = g.frames[Math.min(step, T - 1)];
      ctx.fillStyle = 'rgba(180,140,255,.25)'; ctx.fillRect(x0 - 2, a.y - 2, k + 3, k + 3);
      for (let x = 0; x < L; x++) {
        const bad = g.violations.some((v) => v.t === Math.min(step, T - 1) && v.x === x);
        ctx.fillStyle = now[x] ? (bad ? C.red : C.blue) : 'rgba(230,234,245,.07)';
        ctx.beginPath(); ctx.arc(x0 + x * k + k / 2, a.y + k / 2, Math.max(1.5, k * 0.38), 0, 2 * Math.PI); ctx.fill();
      }
      const kk = Math.max(1.5, Math.min(k * 0.7, (a.h - k - 20) / T));
      for (let tt = 0; tt <= Math.min(step, T - 1); tt++) for (let x = 0; x < L; x++) if (g.frames[tt][x]) {
        ctx.fillStyle = g.violations.some((v) => v.t === tt && v.x === x) ? C.red : 'rgba(124,156,255,.6)';
        ctx.fillRect(x0 + x * k + k / 2 - kk / 2, a.y + k + 16 + tt * kk, kk, kk);
      }
      const name = { none: 'aucune injection', violation: 'loi violée : un atome surgi de nulle part', ignored: 'écriture ignorée : le Cosmoplexe garde ses règles', entered: 'l’atome est entré, sans enfreindre aucune loi' }[g.outcome];
      hud(ctx, safe, ['couche limite (violet) : hors des lois du Cosmoplexe', `cycle ${fr(Math.min(step, T - 1))} · atomes à l’intérieur : ${fr(g.count[Math.min(step, T - 1)])}`], name, g.outcome === 'entered' ? C.green : g.outcome === 'none' ? C.dim : C.red);
    },
  },
  // -------------------------------------------------------------- dance
  dance: {
    label: 'Une danse lambertienne',
    prepare: (s: V) => ({ c: contestOf(Math.round(s.prec ?? 8), (s.aest ?? 1) > 0.5), th: (['classic', 'field', 'creators'] as Theory[])[Math.round(s.theory ?? 0)] ?? 'classic' }),
    draw(ctx, w, h, t, s, data, safe) {
      const { c, th } = data as { c: Contest; th: Theory };
      background(ctx, w, h);
      const best = Math.min(...(Object.keys(c.costs) as Theory[]).filter((k) => !c.rejected[k]).map((k) => c.costs[k]));
      const coh = c.rejected[th] ? 0 : Math.exp(-(c.costs[th] - best) / 120);
      const a = area(safe, 100), cx = a.x + a.w / 2, cy = a.y + a.h / 2, rx = a.w * 0.36, ry = a.h * 0.32;
      ctx.fillStyle = 'rgba(60,110,90,.25)'; ctx.fillRect(a.x, a.y + a.h * 0.86, a.w, a.h * 0.14);
      const R = rng(77), n = 150;
      for (let i = 0; i < n; i++) {
        const ph = t * 0.7 + (i / n) * 2 * Math.PI, sx = Math.sin(ph), cs = Math.cos(ph);
        const tx = cx + rx * sx, ty = cy + ry * sx * cs;              // a figure of eight
        const j1 = R() * 2 * Math.PI, j2 = R() * 2 * Math.PI, sp = 0.3 + R();
        const nx = cx + rx * 1.1 * Math.cos(t * 0.21 * sp + j1), ny = cy + ry * 1.2 * Math.sin(t * 0.17 * sp + j2);
        const x = tx * coh + nx * (1 - coh), y = ty * coh + ny * (1 - coh);
        ctx.fillStyle = 'rgba(20,20,24,.95)'; ctx.beginPath(); ctx.ellipse(x, y, 3.2, 2, ph, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = 'rgba(200,170,120,.55)'; ctx.fillRect(x - 3, y - 3, 6, 1);
      }
      const state = coh > 0.8 ? 'la danse tient' : coh > 0.3 ? 'la danse vacille' : 'la danse se disloque';
      hud(ctx, safe, [`théorie dansée : ${THEORY_NAME[th]}`, c.rejected[th] ? 'rejetée : elle décrit un monde éternel' : `${fr(c.costs[th])} bits · la plus courte : ${fr(best)} bits`], state, coh > 0.8 ? C.green : coh > 0.3 ? C.acc : C.red);
    },
  },
});
