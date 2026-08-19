"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MobileToolGate } from "@/components/mobile-tool-gate";
import { useMobilePreviewOverride } from "@/hooks/use-mobile-preview";
import { TOOLS, type ToolId } from "@/lib/tool-registry";

// One 20-viewBox line glyph per tool, same drawing rules as the image editor's
// toolbar icons (bare fragments, currentColor stroke). Kept beside the nav that
// renders them rather than in the registry - they are shell chrome, not tool
// metadata.
const TOOL_TAB_ICONS: Record<ToolId, React.ReactNode> = {
  "prompt-builder": (
    <>
      <rect x="4.5" y="3" width="11" height="14" rx="1.8" />
      <path d="M7.5 6.5h5M7.5 9.5h5M7.5 12.5h3" />
    </>
  ),
  "picture-deck": (
    <>
      <rect x="4.5" y="3" width="11" height="14" rx="1.8" />
      <circle cx="8" cy="7.2" r="1.1" />
      <path d="M4.8 13.6l2.9-2.9 2.1 2.1 1.7-1.7 3.6 3.6" />
    </>
  ),
  "architect-wizard": (
    <>
      <rect x="3" y="3.5" width="5.5" height="4.5" rx="1" />
      <rect x="11.5" y="12" width="5.5" height="4.5" rx="1" />
      <path d="M8.5 5.75h3.75a2 2 0 0 1 2 2V12" />
    </>
  ),
  skills: (
    <>
      <path d="M10 5.2C8.3 3.9 6.1 3.6 3.5 4v11.4c2.6-.4 4.8 0 6.5 1.3 1.7-1.3 3.9-1.7 6.5-1.3V4c-2.6-.4-4.8-.1-6.5 1.2z" />
      <path d="M10 5.2v11.5" />
    </>
  ),
  "image-editor": (
    <>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.8" />
      <circle cx="6.8" cy="8.2" r="1.2" />
      <path d="M4.5 13.5l3.4-3.4 2.4 2.4 2-2 3.2 3.2" />
    </>
  ),
  "vector-editor": (
    <>
      <path d="M5.5 14.5c0-5.2 3.8-9 9-9" />
      <rect x="2.5" y="13" width="3" height="3" rx="0.6" />
      <rect x="14.5" y="4" width="3" height="3" rx="0.6" />
    </>
  ),
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const activeTool = TOOLS.find((tool) => pathname === tool.href);
  const isHome = pathname === "/";
  const fullBleed = Boolean(activeTool?.fullBleed);
  const mobileGated = activeTool?.mobileSupport === "gated";

  // SSR renders every gated route in the gated state (the override lives in
  // sessionStorage, which the server cannot read); a previously-overridden
  // phone flips back before paint via the store's client snapshot. Desktop
  // never shows either state — the .is-mobile-* classes only act under the
  // 768px media query in globals.css.
  const { overridden: mobilePreview, override: previewAnyway } =
    useMobilePreviewOverride(mobileGated && activeTool ? activeTool.id : null);

  function toggleTheme() {
    const currentTheme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("digitools.theme", nextTheme);
  }

  const shellClassName = mobileGated
    ? mobilePreview
      ? "app-shell is-mobile-preview"
      : "app-shell is-mobile-gated"
    : "app-shell";

  return (
    <div data-app-shell className={shellClassName}>
      <header className="top-bar" data-component="Bar:Top">
        {/* The brand IS the Welcome button - there is no separate Welcome tab. */}
        <Link
          className={isHome ? "brand is-active" : "brand"}
          href="/"
          aria-label="Digi Tools home"
          aria-current={isHome ? "page" : undefined}
        >
          <svg
            className="brand-mark"
            viewBox="0 0 64 64"
            width="24"
            height="24"
            aria-hidden="true"
          >
            <rect
              x="1.5"
              y="1.5"
              width="61"
              height="61"
              rx="14"
              className="brand-mark-plate"
            />
            <path
              d="M20 14 36 50"
              fill="none"
              className="brand-mark-slash-cyan"
              strokeLinecap="round"
              strokeWidth="7"
            />
            <path
              d="m44 14-16 36"
              fill="none"
              className="brand-mark-slash-magenta"
              strokeLinecap="round"
              strokeWidth="7"
            />
          </svg>
          <span>Digi Tools</span>
        </Link>

        <nav className="tool-tabs" aria-label="Tools">
          {TOOLS.map((tool) => (
            <Link
              className={
                pathname === tool.href ? "tool-tab is-active" : "tool-tab"
              }
              href={tool.href}
              key={tool.id}
            >
              <svg
                className="tool-tab-icon"
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {TOOL_TAB_ICONS[tool.id]}
              </svg>
              {tool.shortName}
              {tool.stage === "alpha" ? (
                <span className="tool-tab-flag">Alpha</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle color theme"
        >
          <span aria-hidden="true">Theme</span>
        </button>
      </header>

      <div className="context-bar" data-component="Bar:Context">
        <div className="context-default">
          <span className="context-path">
            <span className="status-dot" aria-hidden="true" />
            {activeTool ? `Tools / ${activeTool.name}` : "Welcome"}
          </span>
          <span className="context-note">Local browser session</span>
        </div>
        <div
          className="app-subbar-slot"
          id="app-subbar-slot"
          aria-live="polite"
        />
      </div>

      <main className={fullBleed ? "page-stage is-fluid" : "page-stage"}>
        {mobileGated && activeTool ? (
          <MobileToolGate
            tool={activeTool}
            overridden={mobilePreview}
            onOverride={previewAnyway}
          />
        ) : null}
        {children}
      </main>

      <footer className="status-bar" data-component="Bar:Status">
        <div className="status-default">
          <span>
            <span className="status-dot" aria-hidden="true" />
            Ready
          </span>
          <span>No account. No cloud sync.</span>
        </div>
        <div
          className="app-statusbar-slot"
          id="app-statusbar-slot"
          aria-live="polite"
        />
      </footer>
    </div>
  );
}
