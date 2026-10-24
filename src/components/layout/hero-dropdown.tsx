"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { HeroSummary } from "@/lib/queries";

type PortraitVariant = "card" | "cardCritical" | "cardGloat";

function pickVariant(artwork: HeroSummary["artwork"]): string | null {
  const images = artwork?.images;
  if (!images) return null;
  const variants: PortraitVariant[] = ["card", "cardCritical", "cardGloat"];
  const available = variants.filter((v) => images[v]);
  if (available.length === 0) return null;
  const pick = available[Math.floor(Math.random() * available.length)];
  return images[pick] ?? null;
}

type HeroDropdownProps = {
  heroes: HeroSummary[];
};

type Pos = { top: number; left: number };

export function HeroDropdown({ heroes }: HeroDropdownProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0 });
  const [portraits, setPortraits] = useState<Array<HeroSummary & { portrait: string | null }>>([]);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setPortraits(
      heroes.map((h) => ({
        ...h,
        portrait: pickVariant(h.artwork),
      })),
    );
  }, [heroes]);

  const updatePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: Math.max(8, rect.left) });
  };

  const openDropdown = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updatePos();
    setOpen(true);
  };

  const closeDropdown = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dropdown =
    open && mounted ? (
      <div
        ref={dropdownRef}
        role="menu"
        aria-label="Heroes"
        onMouseEnter={() => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }}
        onMouseLeave={closeDropdown}
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          background: "linear-gradient(145deg, #171b28f0, #111520f0)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: 16,
          boxShadow: "0 24px 90px #000c",
          zIndex: 9999,
          maxWidth: 680,
          maxHeight: 420,
          overflowY: "auto",
          scrollbarWidth: "thin",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(82px, 1fr))",
            gap: 10,
          }}
        >
          {portraits.map((h) => (
            <Link
              key={h.slug}
              href={`/heroes/${h.slug}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              style={{
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: 6,
                borderRadius: 10,
                transition: "background 0.15s, transform 0.15s",
                minHeight: 44,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "color-mix(in srgb, var(--accent) 14%, transparent)";
                el.style.transform = "scale(1.02)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
                el.style.transform = "scale(1)";
              }}
              onFocus={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "color-mix(in srgb, var(--accent) 14%, transparent)";
              }}
              onBlur={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
              }}
            >
              {h.portrait ? (
                <img
                  src={h.portrait}
                  alt={h.name}
                  loading="lazy"
                  style={{
                    width: 70,
                    height: 96,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    boxShadow: "0 10px 40px #0008",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 70,
                    height: 96,
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: "#141824",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    color: "var(--muted)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {h.name.charAt(0)}
                </div>
              )}
              <span
                style={{
                  fontSize: 9,
                  color: "var(--muted)",
                  textAlign: "center",
                  fontFamily: "var(--font-display)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  lineHeight: 1.2,
                }}
              >
                {h.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={openDropdown}
      onMouseLeave={closeDropdown}
    >
      <Link
        ref={triggerRef}
        href="/heroes"
        aria-haspopup="menu"
        aria-expanded={open}
        className="nav-link"
        onFocus={openDropdown}
        onBlur={(e) => {
          if (dropdownRef.current?.contains(e.relatedTarget as Node)) return;
          closeDropdown();
        }}
      >
        Heroes
        <span style={{ fontSize: 9, opacity: 0.6, marginLeft: 4 }}>▼</span>
      </Link>
      {mounted ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
