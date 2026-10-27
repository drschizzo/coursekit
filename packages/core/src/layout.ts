// Where the player's panels sit on a wide screen, in CSS pixels. The player
// writes these values as CSS variables (the theme places the panels with
// them), and the checker derives from them the safe area it draws the stage
// scenes in: the two cannot drift apart. On a narrow screen the panels stack
// in a column laid out by the theme alone (see SAFE_ZONES in the tooling).

import type { Rect } from './types.ts';

export const LAYOUT = {
  /** distance of the panels from the window's edges */
  margin: 18,
  /** room left between the safe area and a panel */
  gap: 12,
  /** width of the text panel (left) and of the diagram (right) */
  capWidth: 430,
  diagWidth: 380,
  /** the panels stand this far above the bottom edge, over the timeline */
  panelBottom: 84,
  /** height of the bars along the top, and of the timeline with its margin at the bottom */
  head: 64,
  bar: 80,
};

/** The CSS variables the theme reads. */
export const layoutCss = (): Record<string, string> => ({
  '--ck-margin': `${LAYOUT.margin}px`,
  '--ck-cap-w': `${LAYOUT.capWidth}px`,
  '--ck-diag-w': `${LAYOUT.diagWidth}px`,
  '--ck-panel-bottom': `${LAYOUT.panelBottom}px`,
});

/** The safe area of a wide window: between the text panel and the diagram, under the bars, above the timeline. */
export function wideSafeArea(w: number, h: number): Rect {
  const x = LAYOUT.margin + LAYOUT.capWidth + LAYOUT.gap;
  const right = w - LAYOUT.margin - LAYOUT.diagWidth - LAYOUT.gap;
  const y = LAYOUT.head + 8;
  return { x, y, w: right - x, h: h - LAYOUT.bar - 8 - y };
}
