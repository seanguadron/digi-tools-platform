"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

// The no-flash theme bootstrap. Injected into the streamed <head> via
// useServerInsertedHTML so it runs before first paint but never enters the
// hydrated React tree (React 19 dev-warns on <script> elements rendered in
// components). A module-level CONSTANT script whose sole input is a
// localStorage value checked against a strict two-value allowlist — the one
// sanctioned dangerouslySetInnerHTML in this repo (STANDARDS §2.4).
const THEME_SCRIPT = `
  (() => {
    try {
      const saved = localStorage.getItem("digitools.theme");
      const theme = saved === "light" || saved === "dark" ? saved : "dark";
      document.documentElement.dataset.theme = theme;
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  })();
`;

export function ThemeScript() {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    // The callback can run once per flush boundary; insert only once per
    // document so streaming never duplicates the script.
    if (inserted.current) {
      return null;
    }
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
  });

  return null;
}
