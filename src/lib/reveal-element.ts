/** Bring an element into view and hand it the keyboard.
 *
 * Two callers do the same thing for different reasons — the flow navigator
 * moving between builder panels, and the Card Studio jumping along a morph
 * chain — and both have to get the same two details right:
 *
 * - Focus must move, not just the scroll position. When the jump unmounts the
 *   control that was clicked, the browser drops focus to `<body>`, so a
 *   keyboard user loses their place entirely and the next Tab restarts at the
 *   top of the page. Scrolling alone looks correct and is not.
 * - Smooth scrolling is animation, so it needs the reduced-motion escape the
 *   rest of the app honours.
 */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION).matches
  );
}

export function revealElement(target: HTMLElement | null | undefined) {
  if (!target) {
    return;
  }
  target.scrollIntoView({
    block: "center",
    inline: "nearest",
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
  target.focus({ preventScroll: true });
}
