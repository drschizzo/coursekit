// Finding the glossary's terms in a text. The first occurrence of each term
// becomes a span the player turns into a tooltip. Pure string work: no DOM,
// so the content lint can use it too. Taken from avbd's course/glossary.ts.

import type { Term } from './types.ts';

export const esc = (s: string): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface Glossary {
  terms: Term[];
  term(id: string): Term | undefined;
  /** text → HTML: escapes, *emphasis*, and the first occurrence of each term linked */
  rich(src: string, seen?: Set<string>): string;
  /** ids of the terms found in a text */
  find(src: string): string[];
}

export function createGlossary(terms: Term[] = []): Glossary {
  const byId = new Map(terms.map((t) => [t.id, t]));
  // every spelling, longest first, so « Euler semi-implicite » wins over « semi-implicite »
  const forms = terms
    .flatMap((t) => [t.name, ...(t.forms ?? [])].map((f) => ({ f, id: t.id })))
    .sort((a, b) => b.f.length - a.f.length)
    .map(({ f, id }) => ({ id, re: new RegExp(`(?<![\\p{L}\\p{N}])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu') }));

  const rich = (src: string, seen: Set<string> = new Set()): string => {
    let s = esc(src).replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    // placeholders keep already-linked spans from being matched again
    const spans: string[] = [];
    for (const { re, id } of forms) {
      if (seen.has(id)) continue;
      const m = re.exec(s);
      if (!m) continue;
      const before = s.slice(0, m.index);
      if (/<[^>]*$/.test(before) || /\u0000\d*$/.test(before)) continue;
      seen.add(id);
      spans.push(`<span class="gl" tabindex="0" data-g="${id}">${m[0]}</span>`);
      s = `${before}\u0000${spans.length - 1}\u0001${s.slice(m.index + m[0].length)}`;
    }
    return s.replace(/\u0000(\d+)\u0001/g, (_, i) => spans[+i]);
  };

  const find = (src: string): string[] => {
    const out = new Set<string>();
    for (const { re, id } of forms) if (re.test(src)) out.add(id);
    return [...out];
  };

  return { terms, term: (id) => byId.get(id), rich, find };
}
