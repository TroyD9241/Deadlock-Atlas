import Link from "next/link";

import { HeaderNav } from "./header-nav";

/**
 * Site header — design.md 5.2, ported from reference/deadlock-atlas.html.
 *
 * Server component. The only interactive part is which nav pill is active,
 * which lives in the NavLinks client island so we do not have to make the
 * whole header client-side.
 */
export function Header() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <Link
        href="/"
        className="brand"
      >
        DEADLOCK <span style={{ color: "var(--accent)" }}>ATLAS</span>
      </Link>

      <HeaderNav />
    </header>
  );
}