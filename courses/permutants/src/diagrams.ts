// The diagrams of the course on « La Cité des permutants ». Each one runs the
// model with the current values: nothing is drawn from figures written by
// hand. Figures quoted from the novel come from BOOK.

import { fr, type DiagramEnv } from '@coursekit/core';
import { CC, alpha, arrow, axes, cached, circle, clamp, dot, line, panel, text } from '@coursekit/diagrams';
import {
  BOOK, RULE_ATOMS, THEORIES, TOY, contestOf, crossoverBits, dustOf, gardenOf, gateOf, growOf, heatOf, history,
  machineOf, nestedSlowdown, reach, secondsPerHour, timeRatio, transmitterKinds, tvcOverhead, type Row, type Theory,
} from './model.ts';

type Ctx = CanvasRenderingContext2D;

const val = (e: DiagramEnv, k: string, d: number) => (Number.isFinite(e.v[k]) ? e.v[k] : d);

/** Superscript digits, for powers of ten. */
const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
/** 6e16 → « 6 × 10¹⁶ »; small numbers as they are. */
export function sci(x: number, n = 1): string {
  if (!Number.isFinite(x) || x === 0) return fr(x, n);
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e < 6) return fr(x, 0);
  const m = x / 10 ** e;
  const mf = fr(m, n).replace(/,0+$/, '');
  const ms = mf === '1' ? '' : `${mf} × `;
  return `${ms}10${String(e).split('').map((c) => SUP[c]).join('')}`;
}

export const THEORY_NAME: Record<Theory, string> = { classic: 'classique', field: 'équations de champ', creators: 'créateurs' };

/** One row of cells, drawn as squares. */
export function drawRow(ctx: Ctx, row: Row, x: number, y: number, k: number, on = CC.acc, off = CC.faint): void {
  for (let i = 0; i < row.length; i++) { ctx.fillStyle = row[i] ? on : off; ctx.fillRect(x + i * k, y, Math.max(1, k - (k > 4 ? 1 : 0)), Math.max(1, k - (k > 4 ? 1 : 0))); }
}

/** A space-time diagram: one row per clock cycle, time going down. */
export function drawHistory(ctx: Ctx, rows: Row[], x: number, y: number, k: number, upto = rows.length, on = CC.acc): void {
  for (let t = 0; t < Math.min(upto, rows.length); t++) drawRow(ctx, rows[t], x, y + t * k, k, on, 'rgba(0,0,0,0)');
}

// ======================================================== m1: the rule

function rule(ctx: Ctx, e: DiagramEnv): void {
  const r = Math.round(clamp(val(e, 'rule', 30), 0, 255)), k = 11, w = 44, x0 = 14, y0 = 46;
  text(ctx, `règle ${fr(r)} : ce que devient une cellule selon son voisinage`, 14, 18, CC.fg, 11);
  for (let j = 0; j < 8; j++) {
    const n = 7 - j, l = (n >> 2) & 1, c = (n >> 1) & 1, rr = n & 1, out = (r >> n) & 1;
    const x = x0 + j * w;
    [l, c, rr].forEach((b, i) => { ctx.fillStyle = b ? CC.blue : CC.faint; ctx.fillRect(x + i * (k + 1), y0, k, k); });
    arrow(ctx, x + 17, y0 + 15, x + 17, y0 + 33, CC.dim, 1.2, 5);
    ctx.fillStyle = out ? CC.acc : CC.faint; ctx.fillRect(x + k + 1, y0 + 38, k, k);
    text(ctx, `${l}${c}${rr}`, x + 17, y0 + 66, CC.dim, 10, 'center', true);
    text(ctx, `${out}`, x + 17, y0 + 82, out ? CC.acc : CC.dim, 11, 'center', true);
  }
  text(ctx, 'voisinage (gauche, cellule, droite)', 14, 162, CC.blue, 10);
  text(ctx, 'nouvel état, lu de gauche à droite :', 14, 182, CC.fg, 10);
  text(ctx, `${r.toString(2).padStart(8, '0')} en binaire = ${fr(r)}`, 14, 200, CC.acc, 12, 'left', true);
  text(ctx, `${fr(2 ** 8)} règles possibles`, 366, 200, CC.dim, 10, 'right');
}

function spacetime(ctx: Ctx, e: DiagramEnv): void {
  const r = Math.round(clamp(val(e, 'rule', 30), 0, 255)), seed = Math.round(val(e, 'caSeed', 0));
  const rows = cached(`st|${r}|${seed}`, () => history(r, 51, seed, 46));
  const k = 4, x0 = 14, y0 = 20, upto = Math.min(rows.length, 1 + Math.floor(e.t * 12));
  ctx.fillStyle = 'rgba(230,234,245,.04)'; ctx.fillRect(x0, y0, 51 * k, 46 * k);
  drawHistory(ctx, rows, x0, y0, k, upto);
  arrow(ctx, x0 + 51 * k + 8, y0, x0 + 51 * k + 8, y0 + 46 * k, CC.dim, 1.2, 5);
  text(ctx, 'temps', x0 + 51 * k + 14, y0 + 8, CC.dim, 10);
  const xr = 250;
  text(ctx, `règle ${fr(r)}`, xr, 54, CC.acc, 13);
  text(ctx, seed === 0 ? 'départ : une cellule' : 'départ : au hasard', xr, 76, CC.dim, 10);
  text(ctx, 'une ligne = l’anneau', xr, 110, CC.fg, 10);
  text(ctx, 'à un cycle d’horloge', xr, 124, CC.fg, 10);
  text(ctx, 'chaque cellule lit', xr, 152, CC.dim, 10);
  text(ctx, 'ses deux voisines', xr, 166, CC.dim, 10);
  text(ctx, `${fr(Math.min(upto, rows.length))} cycles`, xr, 200, CC.blue, 10);
}

// =============================================== m1: Garden of Eden states

function garden(ctx: Ctx, e: DiagramEnv): void {
  const r = Math.round(clamp(val(e, 'rule', 30), 0, 255)), N = Math.round(clamp(val(e, 'gN', 10), 4, 12));
  const g = gardenOf(r, N);
  text(ctx, `règle ${fr(r)}, anneau de ${fr(N)} cellules : ${fr(g.total)} configurations`, 14, 16, CC.fg, 11);
  const x0 = 46, y0 = 40, w = 210, h = 140, bw = 34, max = Math.max(...g.hist, 1);
  axes(ctx, x0, y0, w, h, '', 'configurations');
  text(ctx, 'nombre d’antécédents', x0 + w / 2, y0 + h + 28, CC.dim, 10, 'center');
  const labels = ['0', '1', '2', '3', '4 et +'];
  g.hist.forEach((n, i) => {
    const bh = (n / max) * (h - 24), x = x0 + 10 + i * (bw + 8);
    ctx.fillStyle = i === 0 ? CC.red : alpha(CC.blue, 0.75); ctx.fillRect(x, y0 + h - bh, bw, bh);
    text(ctx, labels[i], x + bw / 2, y0 + h + 12, CC.dim, 10, 'center');
    if (n > 0) text(ctx, fr(n), x + bw / 2, y0 + h - bh - 8, i === 0 ? CC.red : CC.fg, 10, 'center');
  });
  const xr = 274;
  text(ctx, 'sans antécédent :', xr, 60, CC.red, 10);
  text(ctx, 'jardins d’Éden', xr, 74, CC.red, 10);
  text(ctx, `${fr(g.share * 100, 1)} %`, xr, 96, CC.red, 16);
  text(ctx, g.reversible ? 'règle réversible :' : 'aucune histoire', xr, 132, CC.dim, 10);
  text(ctx, g.reversible ? 'chacune a un passé' : 'ne mène à eux', xr, 146, CC.dim, 10);
}

// ========================================================== m1: the dust

function dust(ctx: Ctx, e: DiagramEnv): void {
  const slices = Math.round(clamp(val(e, 'slices', 1), 1, 24)), missing = Math.round(clamp(val(e, 'missing', 0), 0, 3));
  const d = dustOf(slices, missing), T = d.frames.length, k = 3, rh = 7, N = d.frames[0].length;
  const hue = (i: number) => `hsl(${30 + (i / T) * 200}, 75%, 62%)`;
  const xa = 22, xb = 214, y0 = 34;
  text(ctx, 'ordre de calcul', xa, 16, CC.dim, 10);
  text(ctx, 'ordre reconstruit par la règle', xb, 16, CC.dim, 10);
  d.computed.forEach((i, j) => {
    ctx.fillStyle = hue(i); ctx.fillRect(xa - 10, y0 + j * rh, 6, rh - 1);
    if (!d.kept[i]) { ctx.strokeStyle = CC.red; ctx.strokeRect(xa - 0.5, y0 + j * rh - 0.5, N * k + 1, rh); return; }
    drawRow(ctx, d.frames[i], xa, y0 + j * rh, k, CC.fg, 'rgba(230,234,245,.08)');
  });
  let y = y0;
  d.chains.forEach((c, ci) => {
    if (ci > 0) { line(ctx, xb - 6, y + 2, xb + N * k + 6, y + 2, CC.red, 2); y += 6; }
    for (const i of c) { ctx.fillStyle = hue(i); ctx.fillRect(xb - 10, y, 6, rh - 1); drawRow(ctx, d.frames[i], xb, y, k, CC.fg, 'rgba(230,234,245,.08)'); y += rh; }
  });
  arrow(ctx, xa + N * k + 14, y0 + 84, xb - 20, y0 + 84, CC.dim, 1.2, 6);
  const ok = d.outcome === 'intact';
  text(ctx, ok ? 'une seule histoire' : `${fr(d.chains.length)} morceaux`, 366, 224, ok ? CC.green : CC.red, 11, 'right');
}

// ===================================================== m2: nested worlds

function stack(ctx: Ctx, e: DiagramEnv): void {
  const over = tvcOverhead(), total = nestedSlowdown([BOOK.slowCopy, over]);
  const rows = [
    { t: 'ordinateurs réels (Tokyo, Dallas, Séoul)', c: CC.blue, f: '' },
    { t: 'automate TVC simulé : ses cellules', c: CC.violet, f: '' },
    { t: 'ordinateurs TVC faits de cellules', c: CC.violet, f: `× ${fr(over, 1)}` },
    { t: 'ordinateurs classiques simulés', c: CC.pink, f: '' },
    { t: 'Copie de Durham, en RV', c: CC.acc, f: `× ${fr(BOOK.slowCopy)}` },
  ];
  const lit = Math.floor(e.t * 1.2) % (rows.length + 2);
  rows.forEach((r, i) => {
    const y = 196 - i * 38, on = i <= lit;
    panel(ctx, 20, y, 236, 28, on ? r.c : CC.faint, on ? alpha(r.c, 0.12) : null);
    text(ctx, r.t, 30, y + 14, on ? CC.fg : CC.dim, 10);
    if (i > 0) arrow(ctx, 138, y + 37, 138, y + 29, CC.dim, 1, 5);
    if (r.f) text(ctx, r.f, 148, y + 33, CC.pink, 10);
  });
  text(ctx, 'ralentissement', 318, 70, CC.dim, 10, 'center');
  text(ctx, 'total', 318, 84, CC.dim, 10, 'center');
  text(ctx, `× ${fr(total)}`, 318, 106, CC.acc, 16, 'center');
  text(ctx, `${fr(secondsPerHour(total), 1)} s de vie`, 318, 138, CC.fg, 10, 'center');
  text(ctx, 'par heure', 318, 152, CC.dim, 10, 'center');
}

function memory(ctx: Ctx, e: DiagramEnv): void {
  const lg = clamp(val(e, 'memLog', 12), 3, 15), M = 10 ** lg;
  text(ctx, `atteindre ${sci(M)} cellules de mémoire`, 14, 16, CC.fg, 11);
  const x0 = 60, y0 = 36, w = 290, h = 150;
  axes(ctx, x0, y0, w, h, '', 'distance (cellules)');
  const dims = [{ k: 1, t: 'ruban (1 dim.)', c: CC.red }, { k: 2, t: 'plan (2 dim.)', c: CC.acc }, { k: 3, t: 'volume (3 dim.)', c: CC.green }];
  const top = 15;
  dims.forEach((d, i) => {
    const r = reach(M, d.k), bh = (Math.log10(r) / top) * h, x = x0 + 24 + i * 90;
    ctx.fillStyle = alpha(d.c, 0.8); ctx.fillRect(x, y0 + h - bh, 52, bh);
    text(ctx, sci(Math.round(r)), x + 26, y0 + h - bh - 9, d.c, 10, 'center');
    text(ctx, d.t, x + 26, y0 + h + 13, CC.dim, 10, 'center');
  });
  text(ctx, 'échelle logarithmique', 350, y0 + 6, CC.dim, 9, 'right');
}

// ===================================================== m2: the crystal

function crystal(ctx: Ctx, e: DiagramEnv): void {
  const accel = clamp(val(e, 'accel', 2), 0, 5), pop = clamp(val(e, 'pop', 1), 0.25, 8);
  const g = growOf(accel, pop);
  const x0 = 50, y0 = 26, w = 300, h = 160, lmin = -2, lmax = 3;
  const X = (t: number) => x0 + (Math.log10(1 + t) / Math.log10(1 + TOY.horizon)) * w;
  const Y = (m: number) => y0 + h - ((clamp(Math.log10(m), lmin, lmax) - lmin) / (lmax - lmin)) * h;
  ctx.fillStyle = alpha(CC.red, 0.1); ctx.fillRect(x0, Y(1), w, y0 + h - Y(1));
  axes(ctx, x0, y0, w, h, 'générations (échelle log.)', 'processeurs disponibles ÷ nécessaires');
  line(ctx, x0, Y(1), x0 + w, Y(1), CC.red, 1, [4, 3]);
  text(ctx, 'manque', x0 + 6, Y(1) + 12, CC.red, 10);
  text(ctx, '×1', x0 - 6, Y(1), CC.dim, 9, 'right');
  text(ctx, '×100', x0 - 6, Y(100), CC.dim, 9, 'right');
  ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  g.t.forEach((t, i) => (i ? ctx.lineTo(X(t), Y(g.margin[i])) : ctx.moveTo(X(t), Y(g.margin[i]))));
  ctx.stroke();
  const name = { surplus: 'surplus croissant', 'early-deficit': 'manque, puis surplus', 'late-deficit': 'surplus, puis manque', deficit: 'manque permanent' }[g.outcome];
  text(ctx, `Temps standard en t^${fr(accel, 1)}`, x0 + 8, y0 + 10, CC.fg, 10);
  text(ctx, name, x0 + 8, y0 + 26, g.outcome === 'surplus' ? CC.green : CC.red, 11);
}

function cube(ctx: Ctx, e: DiagramEnv): void {
  // the cube unfolded: six faces, each split into four triangles = 24 oblique pyramids
  const s = 54, ox = 40, oy = 12, collapse = clamp(val(e, 'collapse', 0), 0, 1);
  const faces = [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]];
  // which pyramid holds what (face, triangle): 5 for the Cosmoplexe, 1 for the City, Maria's next to them
  const cosmo = [[2, 0], [2, 1], [2, 2], [2, 3], [3, 3]], city = [[3, 0]], maria = [[1, 1]];
  const has = (L: number[][], f: number, q: number) => L.some(([a, b]) => a === f && b === q);
  let founders = 0;
  faces.forEach(([fx, fy], f) => {
    const x = ox + fx * s, y = oy + fy * s, cx = x + s / 2, cy = y + s / 2;
    const tri = [[[x, y], [x + s, y]], [[x + s, y], [x + s, y + s]], [[x + s, y + s], [x, y + s]], [[x, y + s], [x, y]]];
    tri.forEach(([[ax, ay], [bx, by]], q) => {
      const isC = has(cosmo, f, q), isCity = has(city, f, q), isM = has(maria, f, q);
      if (!isC && !isCity) founders++;
      const dark = collapse > 0 && (isC || isCity || Math.hypot(cx - (ox + 2.5 * s), cy - (oy + 1.5 * s)) < collapse * 2.2 * s);
      ctx.fillStyle = dark ? '#05070c' : isC ? 'rgba(40,60,140,.85)' : isCity ? alpha(CC.acc, 0.8) : isM ? alpha(CC.green, 0.35) : 'rgba(230,234,245,.08)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ax, ay); ctx.lineTo(bx, by); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(230,234,245,.25)'; ctx.lineWidth = 0.8; ctx.stroke();
    });
  });
  const xr = 270;
  text(ctx, `${fr(BOOK.pyramids)} pyramides`, xr, 140, CC.fg, 11);
  text(ctx, `${fr(BOOK.cosmoPyramids)} : le Cosmoplexe`, xr, 160, '#8fa8ff', 10);
  text(ctx, '1 : la Cité', xr, 176, CC.acc, 10);
  text(ctx, `${fr(founders)} : les fondateurs`, xr, 192, CC.dim, 10);
  text(ctx, 'dont celle de Maria', xr, 208, CC.green, 10);
  if (collapse > 0) text(ctx, 'processeurs muets', xr, 226, CC.red, 10);
}

function machine(ctx: Ctx, e: DiagramEnv): void {
  const bits = Math.round(clamp(val(e, 'mbits', 8), 4, 16)), grows = val(e, 'grows', 0) > 0.5;
  const m = machineOf(bits, grows);
  text(ctx, `machine de ${fr(bits)} bits : ${fr(m.states)} états possibles`, 14, 16, CC.fg, 11);
  if (!grows) {
    // the « rho »: a tail of transient states, then a loop
    const cx = 250, cy = 120, R = 56, tail = Math.min(10, m.transient);
    for (let i = 0; i < tail; i++) dot(ctx, 40 + i * ((cx - R - 50) / Math.max(1, tail)), cy, CC.dim, 3);
    line(ctx, 40, cy, cx - R, cy, CC.dim, 1);
    circle(ctx, cx, cy, R, CC.acc, null, 2);
    const a = e.t * 1.4;
    dot(ctx, cx + R * Math.cos(a + Math.PI), cy + R * Math.sin(a + Math.PI), CC.acc, 5);
    text(ctx, `${fr(m.transient)} cycle${m.transient > 1 ? 's' : ''} avant la boucle`, 40, cy + 26, CC.dim, 10);
    text(ctx, `boucle de ${fr(m.period)} états`, cx, cy, CC.acc, 11, 'center');
    text(ctx, `retour à un état connu au cycle ${fr(m.repeatAt)}`, 14, 214, CC.red, 11);
  } else {
    // the machine grows: the line of states never closes
    for (let i = 0; i < 18; i++) { const x = 30 + i * 18, y = 120 - Math.sin(i * 0.7 + e.t) * 10; dot(ctx, x, y, alpha(CC.green, 0.4 + (i / 18) * 0.6), 3.5); if (i) line(ctx, x - 18, 120 - Math.sin((i - 1) * 0.7 + e.t) * 10, x, y, CC.green, 1); }
    arrow(ctx, 336, 120, 362, 120, CC.green, 1.5, 6);
    text(ctx, 'une cellule de plus tous les 3 cycles', 14, 176, CC.dim, 10);
    text(ctx, `${fr(m.finalBits)} bits après ${fr(4000)} cycles`, 14, 194, CC.fg, 10);
    text(ctx, 'aucun état ne revient', 14, 214, CC.green, 11);
  }
}

// ========================================================= m3: the atoms

function atoms(ctx: Ctx, e: DiagramEnv): void {
  const rows = cached('atoms', () => history(RULE_ATOMS, 44, 11, 30));
  const k = 4, x0 = 14, y0 = 30, upto = Math.min(rows.length, 1 + Math.floor(e.t * 10));
  text(ctx, 'règle 184 : un atome avance si la case est libre', 14, 14, CC.fg, 11);
  drawHistory(ctx, rows, x0, y0, k, upto, CC.blue);
  const n = rows[0].reduce((s, b) => s + b, 0);
  text(ctx, `${fr(n)} atomes`, x0 + 44 * k + 12, y0 + 6, CC.blue, 10);
  text(ctx, 'à chaque ligne', x0 + 44 * k + 12, y0 + 20, CC.dim, 10);
  // the 32 atoms of the Cosmoplexe, in false colours
  const xr = 214, yr = 92, c = 18;
  text(ctx, `${fr(BOOK.atoms)} atomes, couleurs fausses`, xr, yr - 8, CC.fg, 10);
  for (let i = 0; i < BOOK.atoms; i++) {
    const x = xr + (i % 8) * c + c / 2, y = yr + 10 + Math.floor(i / 8) * c + c / 2;
    circle(ctx, x, y, 6.5, null, `hsl(${(i * 360) / BOOK.atoms}, 70%, 60%)`);
  }
  text(ctx, 'une couleur = une convention', xr, yr + 98, CC.dim, 10);
  text(ctx, 'd’affichage, pas une propriété', xr, yr + 112, CC.dim, 10);
}

function timescale(ctx: Ctx, e: DiagramEnv): void {
  const ratio = timeRatio(), x0 = 24, w = 330;
  const bar = (y: number, years: number, label: string, col: string) => {
    const bw = (Math.log10(years) / Math.log10(BOOK.lambertYears)) * w;
    ctx.fillStyle = alpha(col, 0.8); ctx.fillRect(x0, y, bw, 20);
    text(ctx, label, x0, y - 10, col, 10);
    text(ctx, `${sci(years)} ans`, x0 + bw - 4, y + 10, '#0b0f1a', 10, 'right');
  };
  bar(42, BOOK.elysianYears, 'vécu par les Élysiens', CC.acc);
  bar(98, BOOK.lambertYears, 'écoulé sur la planète Lambert', CC.blue);
  text(ctx, 'échelle logarithmique', 354, 140, CC.dim, 9, 'right');
  text(ctx, `1 an élysien ≈ ${fr(Math.round(ratio / 1000) * 1000)} ans lambertiens`, 24, 168, CC.fg, 12);
  text(ctx, `1 jour élysien ≈ ${fr(ratio / 365.25)} ans lambertiens`, 24, 190, CC.dim, 11);
  text(ctx, `${fr(BOOK.species / 1e6)} millions d’espèces aujourd’hui`, 24, 214, CC.green, 10);
}

function synapse(ctx: Ctx, e: DiagramEnv): void {
  const v = BOOK.variants, n = BOOK.subunits, pick = [0, 1, 2].map((i) => Math.floor(e.t * (1.3 + i * 0.4) + i * 5) % v);
  text(ctx, `${fr(n)} sous-unités, ${fr(v)} formes chacune`, 14, 16, CC.fg, 11);
  for (let i = 0; i < n; i++) {
    const x = 40 + i * 54;
    for (let j = 0; j < v; j++) {
      const y = 34 + j * 13, on = j === pick[i];
      circle(ctx, x, y, on ? 5.5 : 3.5, null, on ? [CC.acc, CC.pink, CC.blue][i] : CC.faint);
    }
  }
  arrow(ctx, 172, 120, 212, 120, CC.dim, 1.5, 6);
  [0, 1, 2].forEach((i) => circle(ctx, 236 + i * 13, 120, 7, null, [CC.acc, CC.pink, CC.blue][i]));
  text(ctx, 'un neurotransmetteur', 226, 146, CC.dim, 10);
  text(ctx, `${fr(v)} × ${fr(v)} × ${fr(v)} = ${fr(transmitterKinds())}`, 226, 176, CC.acc, 12);
  text(ctx, `« près de ${fr(BOOK.transmitters)} »`, 226, 196, CC.dim, 10);
}

// ======================================================= m3: the boundary

function heat(ctx: Ctx, e: DiagramEnv): void {
  const absorb = clamp(val(e, 'absorb', 1), 0, 1), lum = clamp(val(e, 'lum', 1), 0.1, 6);
  const h = heatOf(absorb, lum);
  const x0 = 50, y0 = 30, w = 300, h0 = 160, tmin = 0, tmax = 800;
  const X = (t: number) => x0 + (t / TOY.heatHours) * w, Y = (T: number) => y0 + h0 - ((clamp(T, tmin, tmax) - tmin) / (tmax - tmin)) * h0;
  ctx.fillStyle = alpha(CC.green, 0.12); ctx.fillRect(x0, Y(TOY.aquaBoil), w, Y(TOY.aquaFreeze) - Y(TOY.aquaBoil));
  axes(ctx, x0, y0, w, h0, 'heures', 'température (K)');
  text(ctx, 'aqua liquide', x0 + 6, Y((TOY.aquaBoil + TOY.aquaFreeze) / 2), CC.green, 9);
  text(ctx, fr(TOY.aquaBoil), x0 - 5, Y(TOY.aquaBoil), CC.dim, 9, 'right');
  text(ctx, fr(TOY.aquaFreeze), x0 - 5, Y(TOY.aquaFreeze) + 4, CC.dim, 9, 'right');
  ctx.strokeStyle = CC.acc; ctx.lineWidth = 2; ctx.beginPath();
  h.hours.forEach((t, i) => (i ? ctx.lineTo(X(t), Y(h.temp[i])) : ctx.moveTo(X(t), Y(h.temp[i]))));
  ctx.stroke();
  const col = h.outcome === 'habitable' ? CC.green : h.outcome === 'boiling' ? CC.red : CC.blue;
  const name = { frozen: 'aqua gelée', habitable: 'aqua liquide', boiling: 'l’aqua bout' }[h.outcome];
  text(ctx, `${fr(h.tEnd)} K au bout de ${fr(TOY.heatHours)} h : ${name}`, 350, y0 - 12, col, 11, 'right');
  text(ctx, h.rising ? 'monte encore' : 'équilibre atteint', 350, y0 + 6, h.rising ? CC.red : CC.dim, 10, 'right');
}

function gate(ctx: Ctx, e: DiagramEnv): void {
  const inject = Math.round(val(e, 'inject', -1)), defend = val(e, 'defend', 0) > 0.5;
  const g = gateOf(inject, defend), L = g.frames[0].length, k = 5, x0 = 20, y0 = 24;
  const upto = Math.min(g.frames.length, 1 + Math.floor(e.t * 14));
  ctx.fillStyle = alpha(CC.violet, 0.18); ctx.fillRect(x0 - 1, y0 - 1, k + 1, g.frames.length * k + 1);
  for (let t = 0; t < upto; t++) for (let x = 0; x < L; x++) if (g.frames[t][x]) {
    const mine = (inject === 0 && x === 0 && t >= g.injectedAt && g.injectedAt > 0 && (g.enteredAt < 0 || t < g.enteredAt)) || (inject > 0 && x === inject && t === g.injectedAt);
    ctx.fillStyle = mine ? CC.green : CC.blue; ctx.fillRect(x0 + x * k, y0 + t * k, k - 1, k - 1);
  }
  for (const v of g.violations) if (v.t < upto) circle(ctx, x0 + v.x * k + 2, y0 + v.t * k + 2, 5, CC.red, null, 1.5);
  text(ctx, 'couche limite', x0 - 4, 12, CC.violet, 10);
  text(ctx, 'intérieur : règle 184', x0 + 70, 12, CC.dim, 10);
  const xr = 196;
  const name = { none: 'aucune injection', violation: 'loi violée', ignored: 'écriture ignorée', entered: 'l’atome est entré' }[g.outcome];
  text(ctx, name, xr, 70, g.outcome === 'entered' ? CC.green : g.outcome === 'none' ? CC.dim : CC.red, 12);
  text(ctx, inject < 0 ? 'pas d’atome injecté' : inject === 0 ? 'injecté dans la couche limite' : `écrit dans la case ${fr(inject)}`, xr, 92, CC.fg, 10);
  text(ctx, defend ? 'règles défendues' : 'règles non défendues', xr, 110, CC.dim, 10);
  text(ctx, `${fr(g.violations.length)} case${g.violations.length > 1 ? 's' : ''} hors la loi`, xr, 140, g.violations.length ? CC.red : CC.dim, 10);
  text(ctx, `atomes à l’intérieur : ${fr(g.count[0])} → ${fr(g.count[g.count.length - 1])}`, xr, 160, CC.dim, 10);
}

// ================================================ m4: the explanations

function theories(ctx: Ctx, e: DiagramEnv): void {
  const bits = Math.round(clamp(val(e, 'prec', 8), 1, 24)), aest = val(e, 'aest', 1) > 0.5;
  const c = contestOf(bits, aest), max = TOY.rulesBits + BOOK.atoms * 24 + TOY.tvcBits;
  text(ctx, `abondances mesurées à ${fr(bits)} bits près`, 14, 16, CC.fg, 11);
  const x0 = 120, w = 240;
  THEORIES.forEach((th, i) => {
    const y = 48 + i * 52, win = c.winner === th;
    text(ctx, THEORY_NAME[th], x0 - 8, y + 9, win ? CC.green : CC.fg, 10, 'right');
    const parts = th === 'field' ? [[TOY.fieldBits, CC.violet]] : th === 'classic' ? [[TOY.rulesBits, CC.blue], [BOOK.atoms * bits, CC.acc]] : [[TOY.rulesBits, CC.blue], [BOOK.atoms * bits, CC.acc], [TOY.tvcBits, CC.pink]];
    let x = x0;
    for (const [b, col] of parts as [number, string][]) { const bw = (b / max) * w; ctx.fillStyle = alpha(col, c.rejected[th] ? 0.25 : 0.8); ctx.fillRect(x, y, bw, 18); x += bw; }
    if (win) panel(ctx, x0 - 3, y - 3, x - x0 + 6, 24, CC.green, null, 3, 1.5);
    text(ctx, c.rejected[th] ? 'rejetée : elle décrit un monde éternel' : `${fr(c.costs[th])} bits`, x0, y + 31, c.rejected[th] ? CC.red : CC.dim, 10);
  });
  text(ctx, 'règles', 14, 208, CC.blue, 9); text(ctx, 'abondances', 60, 208, CC.acc, 9);
  text(ctx, 'équations', 126, 208, CC.violet, 9); text(ctx, 'TVC et créateurs', 182, 208, CC.pink, 9);
  text(ctx, `seuil : ${fr(crossoverBits(), 1)} bits`, 366, 226, CC.dim, 10, 'right');
}

function loop(ctx: Ctx, e: DiagramEnv): void {
  const phase = (Math.floor(e.t / 3) % 2);
  const box = (x: number, y: number, t: string, c: string) => { panel(ctx, x, y, 130, 34, c, alpha(c, 0.12)); text(ctx, t, x + 65, y + 17, CC.fg, 10, 'center'); };
  box(24, 30, 'règles TVC', CC.violet);
  box(24, 100, 'Élysium', CC.acc);
  box(24, 170, 'Cosmoplexe', CC.blue);
  arrow(ctx, 89, 66, 89, 98, CC.dim, 1.5, 6); arrow(ctx, 89, 136, 89, 168, CC.dim, 1.5, 6);
  text(ctx, 'fait tourner', 96, 82, CC.dim, 9); text(ctx, 'fait tourner', 96, 152, CC.dim, 9);
  if (phase === 1) {
    ctx.strokeStyle = CC.red; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(156, 187); ctx.bezierCurveTo(240, 180, 240, 60, 156, 47); ctx.stroke(); ctx.setLineDash([]);
    arrow(ctx, 170, 48, 156, 47, CC.red, 1.8, 7);
    text(ctx, 'une explication cohérente', 236, 110, CC.red, 9);
    text(ctx, 'qui ne passe pas par elles', 236, 124, CC.red, 9);
  } else {
    text(ctx, 'une hiérarchie :', 214, 110, CC.dim, 10);
    text(ctx, 'le haut explique le bas', 214, 124, CC.dim, 10);
  }
}

export const DIAGRAMS = { rule, spacetime, garden, dust, stack, memory, crystal, cube, machine, atoms, timescale, synapse, heat, gate, theories, loop };

