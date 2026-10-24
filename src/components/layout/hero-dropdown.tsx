"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { HeroSummary } from "@/lib/queries";

type PortraitVariant = "card" | "cardCritical" | "cardGloat";

function pickRandomVariant(artwork: HeroSummary["artwork"]): string | null {
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

export function HeroDropdown({ heroes }: HeroDropdownProps) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 200);
  };

  // Pick a random variant for each hero (stable per session)
  const heroPortraits = heroes.map((h) => ({
    ...h,
    portrait: pickRandomVariant(h.artwork),
  }));

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link
        href="/heroes"
        style={{
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          fontSize: 13,
          gap: 4,
        }}
        className="pill tap"
      >
        Heroes
        <span style={{ fontSize: 9, opacity: 0.6 }}>▼</span>
      </Link>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 8,
            background: "linear-gradient(145deg, #171b28e8, #111520e8)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 24px 90px #0008",
            zIndex: 100,
            maxWidth: 600,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
              gap: 8,
            }}
          >
            {heroPortraits.map((h) => (
              <Link
                key={h.slug}
                href={`/heroes/${h.slug}`}
                style={{
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: 4,
                  borderRadius: 8,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 12%, transparent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {h.portrait ? (
                  <img
                    src={h.portrait}
                    alt={h.name}
                    style={{
                      width: 64,
                      height: 88,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 88,
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: "#141824",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 9,
                      color: "var(--muted)",
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
                    letterSpacing: "0.05em",
                    lineHeight: 1.2,
                  }}
                >
                  {h.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}