"use client";

import Link from "next/link";

import { buyTimeLabel, buyStageFor, buyStageLabel } from "@/lib/play-data-format";

import type { ItemPlayData } from "@/lib/play-data-format";

/**
 * The popular picks, from live play data.
 *
 * These are the most-picked items for a hero, computed from the analytics
 * API rather than the hero record's stored `popular_items`. The stored
 * figure is a snapshot from ingest time and drifts out of date; this one
 * comes through the cache and is filtered by the rank bracket.
 *
 * These are the most-picked items, not a loadout — so loading one
 * assembles a build from the top picks and says so.
 */

type Props = {
  /** The hero's items, with their play data. */
  popular: ItemPlayData[];
  /** The bracket the figures are filtered by. */
  bracketLabel: string;
  /** The sample size behind the figures. */
  heroMatches: number;
  onLoad: (slugs: string[]) => void;
  /** The pick rate of each item in the current build, by slug. */
  buildPicks: Record<string, number>;
};

export function Popular({
  popular,
  bracketLabel,
  heroMatches,
  onLoad,
  buildPicks,
}: Props) {
  const top = popular.slice(0, 10);

  const loadable = top
    .map((pick) => pick.slug)
    .filter((slug): slug is string => !!slug);

  return (
    <div className="plate" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          Popular picks
        </div>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
          }}
        >
          {bracketLabel}
        </span>
      </div>

      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        The most-bought items for this hero
        {heroMatches ? ` across ${heroMatches.toLocaleString()} matches` : ""}.
        These are the most-picked items, not a loadout — loading one
        assembles a build from the top picks.
      </p>

      {top.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          [no pick data available]
        </p>
      ) : (
        <div style={{ display: "grid", gap: 3, marginBottom: 12 }}>
          {top.map((pick) => {
            const inBuild = pick.slug ? buildPicks[pick.slug] : undefined;
            const stage = buyStageFor(pick.avgBuyTimeRelative);
            return (
              <div
                key={pick.apiId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  padding: "3px 6px",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "#c3c5d4",
                  background: inBuild
                    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                    : "transparent",
                }}
              >
                <span
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pick.slug ? (
                    <Link
                      href={`/items/${pick.slug}`}
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {pick.name}
                    </Link>
                  ) : (
                    pick.name
                  )}
                  {inBuild ? (
                    <span
                      className="tag"
                      style={{ marginLeft: 6, fontSize: 8 }}
                    >
                      in build
                    </span>
                  ) : null}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--accent-text)",
                    flex: "0 0 auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pick.pickRatePct.toFixed(1)}%
                  <span
                    style={{
                      color: "var(--muted)",
                      marginLeft: 7,
                      fontSize: 9,
                    }}
                    title={`Bought at ${buyTimeLabel(pick.avgBuyTimeS)}, ${Math.round(pick.avgBuyTimeRelative)}% into the match`}
                  >
                    {buyTimeLabel(pick.avgBuyTimeS)} · {buyStageLabel(stage)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="chip"
        onClick={() => onLoad(loadable)}
        disabled={loadable.length === 0}
        style={{
          cursor: loadable.length ? "pointer" : "not-allowed",
          border: "none",
          font: "inherit",
          opacity: loadable.length ? 1 : 0.4,
        }}
      >
        Load top picks
      </button>
    </div>
  );
}
