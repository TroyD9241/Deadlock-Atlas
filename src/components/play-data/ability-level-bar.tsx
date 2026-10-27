/**
 * The level indicator on an ability card.
 *
 * A four-segment bar showing the share of players who ended that ability
 * at each level, plus the average level.
 *
 * The **distribution** is the point, not the mode. The most common final
 * level is level 4 for every ability of every hero, so a "usually level
 * 4" label says nothing. What differs is the spread: for Abrams, Power
 * Surge ends at level 4 almost every time while Static Charge is split
 * roughly half and half between levels 3 and 4. The bar shows that.
 *
 * The bar is tinted with the hero's accent, so it reads as part of the
 * card rather than as a chart dropped on top of it.
 */

import type { AbilityLevelSpread } from "@/lib/ability-play-data-format";

export function AbilityLevelBar({
  spread,
}: {
  spread: AbilityLevelSpread;
}) {
  const levels = spread.levelPct;
  const total = levels.reduce((s, v) => s + v, 0);
  if (total <= 0) return null;

  const breakdown = levels
    .map((pct, index) => `Level ${index + 1}: ${pct.toFixed(0)}%`)
    .join(" · ");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        marginTop: 7,
        marginRight: 10,
        fontSize: 9,
        color: "var(--muted)",
        verticalAlign: "middle",
      }}
      title={`${spread.name} — ${breakdown} (average level ${spread.avgLevel.toFixed(2)})`}
    >
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          gap: 2,
          alignItems: "flex-end",
          height: 8,
        }}
      >
        {levels.map((pct, index) => (
          <span
            key={index}
            style={{
              display: "block",
              width: 9,
              height: `${Math.max(2, Math.round((pct / 100) * 8))}px`,
              background: "var(--accent)",
              opacity: 0.3 + 0.7 * (pct / Math.max(...levels)),
            }}
          />
        ))}
      </span>
      <span style={{ fontFamily: "var(--font-mono)" }}>
        avg level {spread.avgLevel.toFixed(2)}
      </span>
    </span>
  );
}
