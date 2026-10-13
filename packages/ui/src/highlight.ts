// Code colouring for the snippets shown in steps, capsules and the workshop,
// and the draggable values ({{key|min|max|step}}) inside step code.

import { esc } from './dom.ts';

export function highlight(src: string): string {
  const re = /(\/\/[^\n]*)|(\b(?:for|if|else|return|break|continue|const|let|var|function|struct|float|vec2|vec3|vec4|int|bool|void|fn|u32|new|while|of|in|pour|chaque|si|tant|que)\b)|(\b[a-zA-Z_]\w*(?=\s*\())|((?:\b\d+\.?\d*|\.\d+)(?:e-?\d+)?)/g;
  let out = '', last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const cls = m[1] ? 'c' : m[2] ? 'k' : m[3] ? 'f' : 'n';
    out += `<span class="tk-${cls}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}

const LIVE = /\{\{(\w+)\|([-\d.e]+)\|([-\d.e]+)\|([\d.e]+)\}\}/g;

export function highlightLive(src: string): string {
  let out = '', last = 0, m: RegExpExecArray | null;
  LIVE.lastIndex = 0;
  while ((m = LIVE.exec(src))) {
    out += highlight(src.slice(last, m.index));
    out += `<span class="tk-live" tabindex="0" data-key="${m[1]}" data-min="${m[2]}" data-max="${m[3]}" data-step="${m[4]}"></span>`;
    last = LIVE.lastIndex;
  }
  return out + highlight(src.slice(last));
}

export const decimals = (step: number): number => Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
