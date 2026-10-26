"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { itemImage } from "@/components/item/item-card";
import { costLabel } from "@/lib/item-filter-shared";
import { slotLabel } from "@/lib/item-colors";
import { BASE_SLOTS, TOTAL_SLOTS, readStoredBuild } from "@/lib/build";
import {
  buildReadout,
  headlineLines,
  heroStats,
  statTotal,
} from "@/lib/stat-map";

import type { StatMap } from "@/lib/stat-map";

/**
 * The compact build block on the hero profile.
 *
 * The full tool lives on its own page; this is the summary that answers
 * "does this build help?" without turning the profile into an app.
 */

type ItemIndexRow = {
  slug: string;
  name: string;
  slotType: string | null;
  tier: number | null;
  cost: number | null;
  properties: unknown;
  image: string | null;
  imageWebp: string | null;
  shopImage: string | null;
};

type Props = {
  heroSlug: string;
  heroName: string;
  startingStats: unknown;
  itemIndex: Record<string, ItemIndexRow>;
  /** The curated modifier map, loaded on the server. */
  statMap: StatMap;
};

/**
 * The item slugs in a hero's saved build.
 *
 * localStorage is browser-only, so this reads it through
 * useSyncExternalStore: the server snapshot is empty and the client snapshot
 * is the stored build. Nothing is set in an effect, so the page does not
 * cascade a render on load.
 */
function useStoredSlugs(heroSlug: string): string[] {
  const subscribe = useCallback(() => () => {}, []);
  const snapshot = useCallback(
    () => readStoredBuild(heroSlug)?.items.filter(Boolean).join(",") ?? "",
    [heroSlug],
  );
  const key = useSyncExternalStore(subscribe, snapshot, () => "");
  return key ? key.split(",") : [];
}

export function BuildSummary({
  heroSlug,
  heroName,
  startingStats,
  itemIndex,
  statMap,
}: Props) {
  // The stored build is browser-only, so it is read after the page is
  // interactive rather than during render (the server has no storage).
  const slugs = useStoredSlugs(heroSlug);

  const readout = useMemo(() => {
    const items = slugs
      .map((slug) => {
        const row = itemIndex[slug];
        if (!row) return null;
        return { slug, name: row.name, properties: row.properties };
      })
      .filter((x): x is { slug: string; name: string; properties: unknown } => !!x);
    return buildReadout(items, heroStats(startingStats), statMap);
  }, [statMap, slugs, itemIndex, startingStats]);

  const headlines = useMemo(() => headlineLines(readout), [readout]);
  const cost = useMemo(
    () =>
      slugs.reduce((sum, slug) => {
        const row = itemIndex[slug];
        return sum + (row?.cost ?? 0);
      }, 0),
    [slugs, itemIndex],
  );

  const toolHref = `/theorycraft/${heroSlug}`;

  return (
    <section className="section" id="build">
      <div className="section-head">
        <div>
          <h2>Build</h2>
          <p>Your theorycrafted loadout for {heroName}.</p>
        </div>
        <Link
          href={toolHref}
          className="chip"
          style={{
            textDecoration: "none",
            border: "none",
            font: "inherit",
            cursor: "pointer",
          }}
        >
          Open theorycraft →
        </Link>
      </div>

      <div className="plate" style={{ padding: 16 }}>
        {slugs.length === 0 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
              No build set. Open the theorycraft tool to put items in your
              slots and read the stat changes.
            </p>
            <Link
              href={toolHref}
              className="chip"
              style={{ textDecoration: "none", border: "none", font: "inherit" }}
            >
              Open theorycraft →
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: 6,
              }}
            >
              {Array.from({ length: TOTAL_SLOTS }, (_, index) => {
                const slug = slugs[index];
                const row = slug ? itemIndex[slug] : null;
                const src = row ? itemImage(row) : null;
                const locked = index >= BASE_SLOTS;
                return (
                  <div
                    key={index}
                    title={locked ? "Unlocked by team size" : row?.name}
                    style={{
                      position: "relative",
                      aspectRatio: "1",
                      display: "grid",
                      placeItems: "center",
                      background: row
                        ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                        : "#ffffff06",
                      boxShadow: row
                        ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)"
                        : "inset 0 0 0 1px var(--line)",
                      clipPath:
                        "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                      opacity: locked ? 0.4 : 1,
                    }}
                  >
                    {row && src ? (
                      <Image
                        src={src}
                        alt=""
                        width={36}
                        height={36}
                        unoptimized
                        style={{ width: 30, height: 30, objectFit: "contain" }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "baseline",
              }}
            >
              {headlines.map((line) => {
                const total = statTotal(line);
                return (
                  <div key={line.key}>
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--muted)",
                      }}
                    >
                      {line.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 14,
                        color: "var(--accent-text)",
                        marginTop: 2,
                      }}
                    >
                      {total != null ? total : line.total}
                      {line.postfix}
                    </div>
                  </div>
                );
              })}
              <div style={{ marginLeft: "auto" }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  Souls
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                    color: "#e7dfee",
                    marginTop: 2,
                  }}
                >
                  {cost.toLocaleString()}
                </div>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>
              Computed from the API&apos;s stat values, not exact in-game
              numbers. The full tool shows every modifier, ability scaling and
              the spirit/gun contrast.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
