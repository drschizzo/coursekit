// Numbers as a reader of the course's language expects them: decimal comma
// and thin spaces between thousands in French, the host's conventions
// otherwise. Every figure a course prints (text, read-outs, diagrams, stage)
// goes through here, so that a course never writes its own formatter.

const NNBSP = ' '; // narrow no-break space, the French thousands separator

const isFr = (lang: string) => lang === 'fr' || lang.startsWith('fr-');
const nonFinite = (x: number) => (x > 0 ? '∞' : x < 0 ? '−∞' : '—');

/** A number with `n` decimals, in French: 12 345,6 · −0,5. */
export function fr(x: number, n = 0): string {
  if (!Number.isFinite(x)) return nonFinite(x);
  const [i, d] = Math.abs(x).toFixed(n).split('.');
  const neg = x < 0 && Number(Math.abs(x).toFixed(n)) !== 0;
  return (neg ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP) + (d ? ',' + d : '');
}

/** The same in the course's language (`fr`, or any BCP 47 tag for Intl). */
export function fmtNumber(x: number, n = 0, lang = 'fr'): string {
  if (isFr(lang)) return fr(x, n);
  if (!Number.isFinite(x)) return nonFinite(x);
  return x.toLocaleString(lang, { minimumFractionDigits: n, maximumFractionDigits: n });
}

/** A value with as many digits as it needs (at most `digits` significant ones), in the course's language: 0,125 · 3 · 1e-7. */
export function fmtValue(x: number, lang = 'fr', digits = 6): string {
  if (!Number.isFinite(x)) return nonFinite(x);
  if (Math.abs(x) < 1e-12) return '0';
  const s = String(+x.toPrecision(digits));
  return isFr(lang) ? s.replace('.', ',') : s;
}

/** A number typed by the learner: a comma or a point, spaces allowed. NaN when it is not one. */
export const parseNumber = (s: string): number => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

/** A formatter for experiment controls and read-outs: `fmt: dec(1)`. */
export const dec = (n: number, lang = 'fr') => (x: number): string => fmtNumber(x, n, lang);
/** A fraction as a percentage: 0,25 → « 25 % ». */
export const pct = (x: number, lang = 'fr'): string => `${fmtNumber(x * 100, 0, lang)}${isFr(lang) ? NNBSP : ''}%`;
