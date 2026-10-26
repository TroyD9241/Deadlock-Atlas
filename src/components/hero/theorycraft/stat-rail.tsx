"use client";

import { useMemo } from "react";

import {
  contributionText,
  groupLines,
  hasBase,
  railStats,
  statTotal,
} from "@/lib/stat-map";

import type { Highlight, StatLine, StatMap } from "./types";

/**
 * The stat rail.
 *
 * The stats a build produces, always on screen beside the board. Seven
 * headline rows first, then the spirit-and-gun contrast, then every mapped
 * modifier the build touches.
 *
 * The rows and the board are linked: hovering a row isolates the items that
 * feed it, and clicking it pins the breakdown open.
 */

type Props = {
  lines: StatLine[];
  statMap: StatMap;
  highlight: Highlight;
  onHighlight: (highlight: Highlight) => void;
  /** The stat whose breakdown is pinned open. */
  pinned: string | null;
  onPinned: (key: string | null) => void;
};

export function StatRail({
  lines,
  statMap,
  highlight,
  onHighlight,
  pinned,
  onPinned,
}: Props) {
  const rail = useMemo(() => railStats(lines, statMap), [lines, statMap]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* The headline rows */}
      <div className="plate" style={{ padding: 16 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 10,
          }}
        >
          Your stats
        </div>

        <div style={{ display: "grid", gap: 2 }}>
          {rail.map((stat) => {
            const isHot =
              highlight?.kind === "stat" && highlight.key === stat.id;
            const isDim =
              highlight?.kind === "stat" && highlight.key !== stat.id;
            const isPinned = pinned === stat.id;

            // Hovering an item lights up the stats that item feeds.
            const feedsHoveredItem =
              highlight?.kind === "item" &&
              stat.lines.some((l) =>
                l.sources.some((s) => s.slug === highlight.key),
              );
            const dimmedByItem =
              highlight?.kind === "item" && !feedsHoveredItem;

            return (
              <div key={stat.id}>
                <button
                  type="button"
                  onMouseEnter={() =>
                    onHighlight(
                      stat.lines.length > 0
                        ? {
                            kind: "stat",
                            key: stat.id,
                            modifiers: stat.modifiers,
                          }
                        : null,
                    )
                  }
                  onMouseLeave={() => onHighlight(null)}
                  onClick={() => onPinned(isPinned ? null : stat.id)}
                  aria-expanded={isPinned}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 10,
                    width: "100%",
                    padding: "7px 8px",
                    background: isHot || feedsHoveredItem
                      ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                      : isPinned
                        ? "color-mix(in srgb, var(--accent) 8%, transparent)"
                        : "transparent",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    font: "inherit",
                    textAlign: "left",
                    color: "inherit",
                    opacity: isDim || dimmedByItem ? 0.4 : 1,
                    transition: "opacity 120ms ease, background 120ms ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: stat.lines.length > 0 ? "#fff" : "var(--muted)",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stat.label}
                  </span>

                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      flex: "0 0 auto",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                    }}
                  >
                    {stat.hasBase && stat.line ? (
                      <>
                        <span style={{ color: "var(--muted)" }}>
                          {stat.base}
                        </span>
                        <span style={{ color: "var(--muted)" }}>→</span>
                        <span style={{ color: "var(--accent-text)" }}>
                          {statTotal(stat.line)}
                          {stat.postfix}
                        </span>
                      </>
                    ) : stat.contribution !== 0 ? (
                      <span style={{ color: "var(--accent-text)" }}>
                        {contributionText({
                          ...stat.line,
                          total: stat.contribution,
                        } as StatLine)}
                      </span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </span>
                </button>

                {isPinned ? (
                  <RailBreakdown
                    stat={stat}
                    onHighlight={onHighlight}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        <p
          style={{
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 10,
            marginBottom: 0,
            lineHeight: 1.6,
          }}
        >
          Computed from the API&apos;s stat values. The game applies hidden
          multipliers and thresholds that are not in the data, so these are a
          guide, not exact numbers.
        </p>
      </div>

      {/* The contrast view */}
      <ContrastView lines={lines} highlight={highlight} onHighlight={onHighlight} />

      {/* Every modifier */}
      <div className="plate" style={{ padding: 16 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 4,
          }}
        >
          Every modifier
        </div>
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.6,
          }}
        >
          Everything the build touches, grouped. Hover a line to isolate the
          items that feed it.
        </p>

        {lines.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Add items to see their modifiers.
          </p>
        ) : (
          groupLines(lines, statMap).map(({ group, lines: groupItems }) => (
            <div key={group.id} style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 7,
                }}
              >
                {group.label}
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                {groupItems.map((line) => (
                  <ModifierRow
                    key={line.key}
                    line={line}
                    highlight={highlight}
                    onHighlight={onHighlight}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * The breakdown under a pinned rail row: every line that feeds the stat, who
 * fed it, and the total.
 */
function RailBreakdown({
  stat,
  onHighlight,
}: {
  stat: ReturnType<typeof railStats>[number];
  onHighlight: (highlight: Highlight) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: "8px 10px 10px",
        margin: "0 0 6px",
        borderLeft: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
      }}
    >
      {stat.lines.length === 0 ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
          Nothing in this build changes it.
        </p>
      ) : (
        <>
          {stat.lines.map((line) => (
            <div
              key={line.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 11,
                color: "#c3c5d4",
              }}
            >
              <span>{line.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-text)" }}>
                {contributionText(line)}
              </span>
            </div>
          ))}

          {stat.lines.some((l) => l.sources.length > 0) ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 4,
              }}
            >
              {[...new Set(stat.lines.flatMap((l) => l.sources.map((s) => s.slug)))]
                .map((slug) => {
                  const source = stat.lines
                    .flatMap((l) => l.sources)
                    .find((s) => s.slug === slug);
                  return (
                    <span
                      key={slug}
                      className="tag"
                      style={{ cursor: "pointer" }}
                      onMouseEnter={() => onHighlight({ kind: "item", key: slug })}
                      onMouseLeave={() => onHighlight(null)}
                    >
                      {source?.name ?? slug}
                    </span>
                  );
                })}
            </div>
          ) : null}

          {stat.hasBase && stat.line ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                marginTop: 4,
                paddingTop: 5,
                borderTop: "1px solid var(--line)",
                fontSize: 11,
                color: "#fff",
              }}
            >
              <span>Total</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-text)" }}>
                {statTotal(stat.line)}
                {stat.postfix}
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/** One line of the full readout. */
function ModifierRow({
  line,
  highlight,
  onHighlight,
}: {
  line: StatLine;
  highlight: Highlight;
  onHighlight: (highlight: Highlight) => void;
}) {
  const total = statTotal(line);
  const isHot =
    highlight?.kind === "stat" && highlight.key === line.key;
  const isDim = highlight?.kind === "stat" && highlight.key !== line.key;

  return (
    <div
      onMouseEnter={() =>
        onHighlight({
          kind: "stat",
          key: line.key,
          modifiers: [line.modifierType],
        })
      }
      onMouseLeave={() => onHighlight(null)}
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "baseline",
        padding: "3px 6px",
        borderRadius: 6,
        fontSize: 12,
        color: "#c3c5d4",
        background: isHot
          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
          : "transparent",
        opacity: isDim ? 0.35 : 1,
        transition: "opacity 120ms ease, background 120ms ease",
      }}
    >
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {line.label}
        {line.sources.length > 1 ? (
          <span style={{ color: "var(--muted)", fontSize: 10 }}>
            {" "}
            ({line.sources.length} items)
          </span>
        ) : null}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
        {hasBase(line) ? (
          <span style={{ color: "var(--muted)" }}>{line.base}</span>
        ) : null}
        {hasBase(line) ? (
          <span style={{ color: "var(--muted)" }}> → </span>
        ) : null}
        <span style={{ color: total != null ? "var(--accent-text)" : "#e7dfee" }}>
          {total != null ? total : line.total}
          {line.postfix}
        </span>
      </span>
    </div>
  );
}

/**
 * The spirit-and-gun contrast.
 *
 * Spirit and gun side by side, because the point of the contrast is seeing
 * them together: a build can raise spirit power and leave weapon damage
 * alone, and resist that only helps against one damage type.
 */
function ContrastView({
  lines,
  highlight,
  onHighlight,
}: {
  lines: StatLine[];
  highlight: Highlight;
  onHighlight: (highlight: Highlight) => void;
}) {
  const columns = useMemo(() => {
    const spirit = lines.filter(
      (l) =>
        l.modifierType === "MODIFIER_VALUE_TECH_POWER" ||
        l.modifierType === "MODIFIER_VALUE_TECH_POWER_PERCENT",
    );
    const weapon = lines.filter(
      (l) =>
        l.modifierType === "MODIFIER_VALUE_WEAPON_POWER" ||
        l.modifierType === "MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE",
    );
    const spiritResist = lines.filter(
      (l) =>
        l.modifierType === "MODIFIER_VALUE_TECH_RESIST" ||
        l.modifierType === "MODIFIER_VALUE_TECH_RESIST_REDUCTION",
    );
    const bulletResist = lines.filter(
      (l) =>
        l.modifierType === "MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST" ||
        l.modifierType ===
          "MODIFIER_VALUE_BULLET_AND_MELEE_RESIST_REDUCTION",
    );
    return [
      { title: "Spirit Power", subtitle: "Scales spirit abilities", lines: spirit },
      { title: "Weapon Damage", subtitle: "Scales gun abilities", lines: weapon },
      { title: "Spirit Resist", subtitle: "Against spirit damage", lines: spiritResist },
      { title: "Bullet Resist", subtitle: "Against bullet damage", lines: bulletResist },
    ];
  }, [lines]);

  return (
    <div className="plate" style={{ padding: 16 }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: 12,
        }}
      >
        Spirit and gun
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        {columns.map((column) => (
          <div
            key={column.title}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 11,
              background: "#ffffff05",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              {column.title}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--muted)",
                marginTop: 2,
                marginBottom: 9,
              }}
            >
              {column.subtitle}
            </div>

            {column.lines.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                No change in this build.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 5 }}>
                {column.lines.map((line) => {
                  const total = statTotal(line);
                  const isHot =
                    highlight?.kind === "stat" && highlight.key === line.key;
                  return (
                    <div
                      key={line.key}
                      onMouseEnter={() =>
                        onHighlight({
                          kind: "stat",
                          key: line.key,
                          modifiers: [line.modifierType],
                        })
                      }
                      onMouseLeave={() => onHighlight(null)}
                      style={{
                        display: "grid",
                        gap: 1,
                        padding: "2px 4px",
                        borderRadius: 5,
                        background: isHot
                          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                          : "transparent",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          fontSize: 11,
                          color: "#c3c5d4",
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
                          {line.label}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--accent-text)",
                          }}
                        >
                          {contributionText(line)}
                        </span>
                      </div>
                      {total != null ? (
                        <div
                          style={{
                            fontSize: 9,
                            fontFamily: "var(--font-mono)",
                            color: "var(--muted)",
                            textAlign: "right",
                          }}
                        >
                          {line.base} → {total}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <p
        style={{
          fontSize: 10,
          color: "var(--muted)",
          marginTop: 12,
          marginBottom: 0,
          lineHeight: 1.6,
        }}
      >
        Spirit resist and bullet resist are separate: one only helps against
        the matching damage type, so a build can raise one and leave the
        other untouched.
      </p>
    </div>
  );
}
