"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TOOLS } from "@/lib/tool-registry";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const activeTool = TOOLS.find((tool) => pathname === tool.href);
  const isHome = pathname === "/";
  const fullBleed = Boolean(activeTool?.fullBleed);

  function toggleTheme() {
    const currentTheme =
      document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("digitools.theme", nextTheme);
  }

  return (
    <div data-app-shell className="app-shell">
      <header className="top-bar" data-component="Bar:Top">
        <Link className="brand" href="/" aria-label="Digi Tools home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span>Digi Tools</span>
        </Link>

        <nav className="tool-tabs" aria-label="Tools">
          <Link className={isHome ? "tool-tab is-active" : "tool-tab"} href="/">
            Welcome
          </Link>
          {TOOLS.map((tool) => (
            <Link
              className={
                pathname === tool.href ? "tool-tab is-active" : "tool-tab"
              }
              href={tool.href}
              key={tool.id}
            >
              {tool.shortName}
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
        {children}
      </main>

      <footer className="status-bar" data-component="Bar:Status">
        <span>
          <span className="status-dot" aria-hidden="true" />
          Ready
        </span>
        <span>No account. No cloud sync.</span>
      </footer>
    </div>
  );
}
