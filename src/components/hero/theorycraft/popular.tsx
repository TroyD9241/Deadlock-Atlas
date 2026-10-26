"use client";

import { PopularBuilds } from "./types";

/**
 * The popular picks.
 *
 * The API's per-item pick rates for a hero, by match stage. These are the
 * most-picked items, not a loadout — so loading one assembles a build from
 * the top picks and says so.
 */

type Props = {
  popular: PopularBuilds;
  stage: "early" | "mid" | "late";
  onStage: (stage: "early" | "mid" | "late") => void;
  onLoad: (stage: "early" | "mid" | "late") => void;
  /** The pick rate of each item in the current build, by slug. */
  buildPicks: Record<string, number>;
};

/** The item slug for an API class name. */
function slugForClassName(className: string): string {
  return className.replace(/_/g, "-");
}

export function Popular({
  popular,
  stage,
  onStage,
  onLoad,
  buildPicks,
}: Props) {
  const picks = popular[stage] ?? [];

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

        <div style={{ display: "flex", gap: 6 }}>
          {(["early", "mid", "late"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`chip${stage === option ? " active" : ""}`}
              onClick={() => onStage(option)}
              style={{ cursor: "pointer", border: "none", font: "inherit" }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        The API&apos;s pick rates for this hero in the {stage} game. These are
        the most-picked items, not a loadout — loading one assembles a build
        from the top picks.
      </p>

      {picks.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          [no pick data for this stage]
        </p>
      ) : (
        <div style={{ display: "grid", gap: 3, marginBottom: 12 }}>
          {picks.slice(0, 8).map((pick) => {
            const slug = slugForClassName(pick.className);
            const inBuild = buildPicks[slug];
            return (
              <div
                key={pick.className}
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
                  {pick.className.replace(/^upgrade_/, "").replace(/_/g, " ")}
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
                  }}
                >
                  {pick.pickPct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="chip"
        onClick={() => onLoad(stage)}
        disabled={picks.length === 0}
        style={{
          cursor: picks.length ? "pointer" : "not-allowed",
          border: "none",
          font: "inherit",
          opacity: picks.length ? 1 : 0.4,
        }}
      >
        Load {stage} build
      </button>
    </div>
  );
}
