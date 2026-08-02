"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";

// Roving tabindex for role="radiogroup" rows built from buttons: ONE Tab
// stop (the checked option, or the first when none is), arrow keys
// move-and-select with wrap, Home/End jump to the edges — the keyboard
// contract the radiogroup role promises assistive tech. `columns` makes
// Up/Down step by rows for grid-shaped groups (the canvas-size anchor
// grid); linear rows leave it at 1 so both axes work, per the APG pattern.
//
// Consumed keys stopPropagation as well as preventDefault: both editors
// bind window-level arrow shortcuts (nudge the selection) that exempt
// inputs but NOT buttons, so an arrow that moved a radio would otherwise
// also shove the artwork — including from a dialog, since dialogs portal
// to document.body and leave those listeners live.
export function useRovingRadioGroup(
  count: number,
  activeIndex: number,
  onSelect: (index: number) => void,
  columns = 1,
) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const base = activeIndex >= 0 && activeIndex < count ? activeIndex : 0;

  function onKeyDown(event: KeyboardEvent) {
    if (count === 0) return;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (base + 1) % count;
    else if (event.key === "ArrowLeft") next = (base - 1 + count) % count;
    else if (event.key === "ArrowDown") next = (base + columns) % count;
    else if (event.key === "ArrowUp") next = (base - columns + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(next);
    refs.current[next]?.focus();
  }

  function itemProps(index: number) {
    return {
      ref: (el: HTMLButtonElement | null) => {
        refs.current[index] = el;
      },
      tabIndex: index === base ? 0 : -1,
      onKeyDown,
    };
  }

  return { itemProps };
}
