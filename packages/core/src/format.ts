// Numbers as a reader of the course's language expects them: decimal comma
// and thin spaces between thousands in French, the host's conventions
// otherwise. Every figure a course prints (text, read-outs, diagrams, stage)
// goes through here, so that a course never writes its own formatter.

const NNBSP = ' '; // narrow no-break space, the French thousands separator

/** A number with `n` decimals, in French: 12 345,6 · −0,5. */
export function fr(x: number, n = 0): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  const [i, d] = Math.abs(x).toFixed(n).split('.');
  const neg = x < 0 && Number(Math.abs(x).toFixed(n)) !== 0;
  return (neg ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP) + (d ? ',' + d : '');
}

/** The same in the course's language (`fr`, or any BCP 47 tag for Intl). */
export function fmtNumber(x: number, n = 0, lang = 'fr'): string {
  if (lang === 'fr' || lang.startsWith('fr-')) return fr(x, n);
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : '—';
  return x.toLocaleString(lang, { minimumFractionDigits: n, maximumFractionDigits: n });
}

/** A formatter for experiment controls and read-outs: `fmt: dec(1)`. */
export const dec = (n: number) => (x: number): string => fr(x, n);
/** A fraction as a percentage: 0,25 → « 25 % ». */
export const pct = (x: number): string => `${fr(x * 100)}${NNBSP}%`;
