// Shared placement math for the hover/focus floating detail panels that the
// card workbench, role workbench, and archetype toolbars portal to the body:
// prefer the right side of the anchor, flip left when the viewport is tight,
// and clamp vertically so the panel never leaves the screen.

export const FLOATING_PANEL_WIDTH = 390;
export const FLOATING_PANEL_GAP = 12;
export const FLOATING_PANEL_MARGIN = 16;

// The panel clips rather than scrolls (it is pointer-events: none, so nobody
// could scroll it anyway), which makes this budget load-bearing: content past
// it disappears with no visible symptom. It is returned as an inline style
// rather than written in CSS so the number the placement math uses and the
// number the panel actually honours cannot drift apart.
// 660 fits the art-first layout: a ~362px square of art plus identity, bio,
// ability bullets, and the code line. The viewport clamp below still wins on
// short screens.
export const FLOATING_PANEL_MAX_HEIGHT = 660;

export function getFloatingPanelPosition(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const rightSideLeft = rect.right + FLOATING_PANEL_GAP;
  const leftSideLeft = rect.left - FLOATING_PANEL_WIDTH - FLOATING_PANEL_GAP;
  const fitsRight =
    rightSideLeft + FLOATING_PANEL_WIDTH <=
    window.innerWidth - FLOATING_PANEL_MARGIN;
  const left = fitsRight
    ? rightSideLeft
    : Math.max(FLOATING_PANEL_MARGIN, leftSideLeft);
  const top = Math.min(
    Math.max(FLOATING_PANEL_MARGIN, rect.top),
    Math.max(
      FLOATING_PANEL_MARGIN,
      window.innerHeight - FLOATING_PANEL_MAX_HEIGHT - FLOATING_PANEL_MARGIN,
    ),
  );

  return {
    left,
    top,
    maxHeight: Math.min(
      FLOATING_PANEL_MAX_HEIGHT,
      window.innerHeight - FLOATING_PANEL_MARGIN * 2,
    ),
  };
}
