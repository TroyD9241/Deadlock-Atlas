"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HeroDropdown } from "./hero-dropdown";
import { Search } from "./search";

import type { HeroSummary } from "@/lib/queries";

/**
 * Pill navigation — design.md 5.2.
 *
 * Home, Heroes (with portrait dropdown), Abilities, Items, Lore, Map, Patches.
 * Under 780px the row scrolls horizontally and is never hidden (design.md 7).
 */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/abilities", label: "Abilities" },
  { href: "/items", label: "Items" },
  { href: "/lore", label: "Lore" },
  { href: "/map", label: "Map" },
  { href: "/patches", label: "Patches" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavLinksProps = {
  heroes: HeroSummary[];
};

export function NavLinks({ heroes }: NavLinksProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Primary"
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        overflowX: "auto",
        scrollbarWidth: "none",
        // Without this the row can push the header wider than the viewport.
        maxWidth: "100%",
      }}
    >
      <HeroDropdown heroes={heroes} />

      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`pill tap${active ? " pill-active" : ""}`}
            style={{
              // Keep the pill on one line while the row scrolls.
              flex: "0 0 auto",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            {link.label}
          </Link>
        );
      })}

      <Search />
    </nav>
  );
}