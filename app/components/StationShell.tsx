import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Surface stack for every page: page ground → shell width → app container.
 * Content always sits inside a card; putting it straight on `.mist-app` makes
 * inset blocks disappear, because inset and the app container share a colour.
 */

export const STATIONS = [
  { href: "/", label: "站 1 · 方向假設" },
  { href: "/plan", label: "站 2 · 目標樹草案" },
  { href: "/ledger", label: "站 3 · 季度對帳" },
] as const;

export function StationShell({
  current,
  children,
}: {
  current: (typeof STATIONS)[number]["href"];
  children: ReactNode;
}) {
  return (
    <div className="mist-page">
      <div className="mist-shell">
        <div className="mist-app">
          <nav className="mist-nav mist-row--between" aria-label="流程">
            <Link className="mist-nav__brand" href="/">
              <span className="mist-nav__mark" />
              個人教練
            </Link>
            <div className="mist-nav__links">
              {STATIONS.map((station) => (
                <Link
                  key={station.href}
                  className={`mist-nav__link${station.href === current ? " is-active" : ""}`}
                  href={station.href}
                >
                  {station.label}
                </Link>
              ))}
            </div>
          </nav>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Every station closes with the same honesty note. Do not drop it. */
export function Colophon({ lines }: { lines: string[] }) {
  return (
    <div className="mist-card">
      <p className="mist-label mist-subtle">附註 NOTES</p>
      {lines.map((line) => (
        <p className="mist-caption mist-muted" key={line}>
          {line}
        </p>
      ))}
    </div>
  );
}
