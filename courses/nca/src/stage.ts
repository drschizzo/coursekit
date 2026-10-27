// The stage of the NCA course: the runs computed by the model, played back in
// the background. Two scenes: the maze automaton (explore, prune, adaptive
// firing, damage) and the constraint grid (one trial, or several side by
// side with the one the board confidence picks).

import { canvasStage } from '@coursekit/ui';
import { fr, pct } from '@coursekit/core';
import { GRID, GRID_OUTCOME, MAZE_OUTCOME, mazeOf, trialsOf, type GridRun, type MazeRun } from './model.ts';
import { COL, drawGrid } from './diagrams.ts';
import { CC } from '@coursekit/diagrams';

type Ctx = CanvasRenderingContext2D;

function background(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = '#0b0f1a'; ctx.fillRect(0, 0, w, h);
}

function hud(ctx: Ctx, x: number, y: number, lines: string[], last: string, ok: boolean): void {
  ctx.font = '12px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(230,234,245,.6)';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * 17));
  ctx.fillStyle = ok ? 'rgba(94,224,160,.85)' : 'rgba(255,107,122,.85)';
  ctx.fillText(last, x, y + lines.length * 17 + 6);
}

/** Playback: the whole run in about 10 s (at least 20 steps a second), then a pause, then again. */
function playhead(steps: number, t: number): number {
  const speed = Math.max(20, steps / 10), total = steps / speed + 2.5;
  return Math.min(steps, Math.floor((t % total) * speed));
}

export const stage = () => canvasStage({
  maze: {
    label: 'Le labyrinthe, résolu par ses cellules',
    prepare: (s) => mazeOf(s),
    draw(ctx, w, h, t, s, data, safe) {
      const r = data as MazeRun;
      background(ctx, w, h);
      const k = playhead(r.steps, t);
      const top = safe.y + 100;
      const size = Math.max(60, Math.min(safe.w - 24, safe.y + safe.h - top - 12));
      const x = safe.x + (safe.w - size) / 2, S = r.maze.side, c = size / S;
      const f = r.frames[k];
      for (let i = 0; i < S * S; i++) {
        const st = f[i];
        ctx.fillStyle = r.maze.wall[i] ? COL.wall : i === r.maze.ends[0] || i === r.maze.ends[1] ? COL.end : st === 1 ? (r.solvedAt > 0 && k >= r.solvedAt && (r.damageAt < 0 || k < r.damageAt) ? CC.green : COL.reached) : st === 2 ? COL.dead : COL.open;
        ctx.fillRect(x + (i % S) * c, top + Math.floor(i / S) * c, Math.ceil(c), Math.ceil(c));
      }
      // with adaptive firing, the cells that fired at this step
      if ((s.adaptive ?? 0) > 0.5 && k > 0) {
        const fired = r.fired[k - 1];
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        for (let i = 0; i < S * S; i++) if (fired[i] && !r.maze.wall[i]) ctx.fillRect(x + (i % S) * c + c * 0.35, top + Math.floor(i / S) * c + c * 0.35, Math.max(1, c * 0.3), Math.max(1, c * 0.3));
      }
      // the damaged zone, from the moment of the damage
      if (r.damageAt >= 0 && k >= r.damageAt && k < r.damageAt + 40) {
        ctx.strokeStyle = 'rgba(94,214,255,.8)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < S * S; i++) if (r.zone[i]) ctx.strokeRect(x + (i % S) * c + 0.5, top + Math.floor(i / S) * c + 0.5, c - 1, c - 1);
      }
      const done = r.solvedAt > 0 && k >= r.solvedAt && (r.damageAt < 0 || k < r.damageAt || r.repairSteps > 0 && k >= r.damageAt + r.repairSteps);
      const outcome = k < r.steps ? (done ? 'résolu' : 'en cours') : MAZE_OUTCOME[r.outcome];
      hud(ctx, safe.x + 12, safe.y + 16, [
        `labyrinthe ${fr(S)} × ${fr(S)} · pas ${fr(k)} sur ${fr(r.p.D)}`,
        `mises à jour : ${pct(r.p.p)} par pas${r.p.adaptive ? ` · cellules sûres ${fr(r.p.plow, 2)}` : ''}`,
        `cases mal classées : ${fr(r.wrong[k])}`,
      ], outcome, k < r.steps ? done : r.outcome === 'solved');
    },
  },
  grid: {
    label: 'Une grille de contraintes locales',
    prepare: (s) => trialsOf(s),
    draw(ctx, w, h, t, s, data, safe) {
      const { runs, best } = data as { runs: GridRun[]; best: number; solved: boolean };
      background(ctx, w, h);
      const k = playhead(GRID.D, t);
      const top = safe.y + 100, avail = Math.max(60, Math.min(safe.w - 24, safe.y + safe.h - top - 12));
      const K = runs.length;
      if (K === 1) drawGrid(ctx, GRID.n, runs[0].frames[k], safe.x + (safe.w - avail) / 2, top, avail);
      else {
        // up to six trials, two per row; the one the confidence picks is framed at the end
        const shown = runs.slice(0, 6), cols = 2, rows = Math.ceil(shown.length / cols);
        const size = Math.min((avail - 16) / cols, (safe.y + safe.h - top - 12 - (rows - 1) * 16) / rows);
        shown.forEach((r, i) => {
          const gx = safe.x + (safe.w - (cols * size + 16)) / 2 + (i % cols) * (size + 16), gy = top + Math.floor(i / cols) * (size + 16);
          drawGrid(ctx, GRID.n, r.frames[k], gx, gy, size);
          if (k === GRID.D && i === best) { ctx.strokeStyle = CC.green; ctx.lineWidth = 3; ctx.strokeRect(gx - 4, gy - 4, size + 8, size + 8); }
        });
      }
      const r = runs[K === 1 ? 0 : best];
      const noisy = (s.eta ?? 0) > 0 && k <= (s.rn ?? GRID.rn) * GRID.D;
      hud(ctx, safe.x + 12, safe.y + 16, [
        `${K > 1 ? `${fr(K)} essais en parallèle · ` : ''}pas ${fr(k)} sur ${fr(GRID.D)}`,
        `taux de mise à jour ${fr(s.p ?? GRID.p, 2)}${noisy ? ' · bruit actif' : ''}`,
        `conflits${K > 1 ? ' (meilleur essai)' : ''} : ${fr(r.conflicts[k])}`,
      ], k < GRID.D ? (r.conflicts[k] === 0 ? 'aucun conflit' : 'en cours') : `grille ${GRID_OUTCOME[r.outcome]}`, k < GRID.D ? r.conflicts[k] === 0 : r.outcome === 'solved');
    },
  },
});
