"use client";

import { useMemo, useState } from "react";

import {
  contributionText,
  groupLines,
  hasBase,
  heroStatList,
  railStats,
  sourceBreakdown,
  statSourceBreakdown,
  statTotal,
} from "@/lib/stat-map";
import { modifierDescription, statDescription } from "@/lib/stat-glossary";
import { Tooltip } from "@/components/hero/tooltip";

import type { Highlight, StatLine, StatMap } from "./types";
import type { StatGlossary } from "@/lib/stat-glossary";

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
  glossary: StatGlossary;
  heroStats?: Record<string, number>;
};

export function StatRail({
  lines,
  statMap,
  highlight,
  onHighlight,
  pinned,
  onPinned,
  glossary,
  heroStats = {},
}: Props) {
  const rail = useMemo(() => railStats(lines, statMap), [lines, statMap]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* The headline rows */}
      <div className="plate" style={{ padding: 16 }}>
        <div
          style={{
            fontFamily: "var(--font-body)",
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
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
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
                  <Tooltip
                    content={headlineTooltip(stat, glossary)}
                    placement="left"
                  >
                    <span
                      tabIndex={0}
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
                  </Tooltip>

                  <span
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                      justifyContent: "flex-end",
                      fontFamily: "var(--font-mono)",
                      fontVariantNumeric: "tabular-nums",
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
                    glossary={glossary}
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
            fontFamily: "var(--font-body)",
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
                  borderTop: "1px solid var(--line)",
                  paddingTop: 10,
                  fontFamily: "var(--font-body)",
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
                {groupItems.map((line, idx) => {
                  const striped = groupItems.length > 10 && idx % 2 === 1;
                  return (
                    <div
                      key={line.key}
                      style={striped ? { background: "rgba(255,255,255,0.02)", borderRadius: 6 } : undefined}
                    >
                      <ModifierRow
                        line={line}
                        highlight={highlight}
                        onHighlight={onHighlight}
                        glossary={glossary}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <BaseStatsPanel stats={heroStats} statMap={statMap} glossary={glossary} />
    </div>
  );
}

function BaseStatsPanel({
  stats,
  statMap,
  glossary,
}: {
  stats: Record<string, number>;
  statMap: StatMap;
  glossary: StatGlossary;
}) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => heroStatList(stats, statMap), [stats, statMap]);
  if (grouped.length === 0) return null;

  return (
    <div className="plate" style={{ padding: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          width: "100%",
          background: "transparent",
          border: "none",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          padding: 0,
        }}
        aria-expanded={open}
      >
        <div>
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
            Base Stats
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Hero starting stats (read-only)
          </div>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          {grouped.map((group) => (
            <div key={group.group}>
              <div
                style={{
                  borderTop: "1px solid var(--line)",
                  paddingTop: 10,
                  fontFamily: "var(--font-body)",
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
                {group.items.map((item, idx) => {
                  const desc = statDescription(item.key, glossary);
                  const striped = group.items.length > 10 && idx % 2 === 1;
                  return (
                    <Tooltip key={item.key} content={desc ? { what: desc.what, affects: desc.affects, label: item.label } : null} placement="left">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          fontSize: 11,
                          color: "#c3c5d4",
                          padding: "3px 6px",
                          borderRadius: 6,
                          background: striped ? "rgba(255,255,255,0.02)" : "transparent",
                        }}
                      >
                        <span>{item.label}</span>
                        <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>{item.value}</span>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
          <p style={{ margin: 0, fontSize: 10, color: "var(--muted)" }}>Not changed by items in this view.</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The breakdown under a pinned rail row: every line that feeds the stat, who
 * fed it, and the total.
 */
/**
 * The tooltip for a headline rail row.
 *
 * The row shows one number, so the tooltip shows how that number is built:
 * the hero's base, the items that add to it, and the result.
 */
function headlineTooltip(
  stat: ReturnType<typeof railStats>[number],
  glossary: StatGlossary,
) {
  const desc = statDescription(stat.id, glossary);
  if (!desc) return null;

  const { rows, count } = statSourceBreakdown(stat.lines);
  const content: {
    what: string;
    affects?: string;
    label?: string;
    rows?: { label: string; value: string }[];
    rowsLabel?: string;
  } = { what: desc.what, affects: desc.affects };

  if (rows.length > 0) {
    content.rows = rows;
    content.rowsLabel = count === 1 ? "From 1 item" : `From ${count} items`;
  }

  return content;
}

/**
 * The tooltip for one modifier line.
 *
 * The line's number is the sum of the items behind it, so the tooltip
 * lists them.
 */
function modifierTooltip(line: StatLine, desc: string | null) {
  if (!desc) return null;
  const parts = sourceBreakdown(line);
  const content: {
    what: string;
    affects?: string;
    label?: string;
    rows?: { label: string; value: string }[];
    rowsLabel?: string;
  } = { what: desc, label: line.label };

  if (parts.length > 0) {
    // The same item can grant the same stat through two different
    // properties, so name the property when that happens.
    const itemCounts = new Map<string, number>();
    for (const part of parts) {
      itemCounts.set(part.slug, (itemCounts.get(part.slug) ?? 0) + 1);
    }
    content.rows = parts.map((part) => ({
      label:
        part.propertyLabel &&
        part.propertyLabel !== line.label &&
        (itemCounts.get(part.slug) ?? 0) > 1
          ? `${part.name} — ${part.propertyLabel}`
          : part.name,
      value: (part.value > 0 ? "+" : "") + part.value + part.postfix,
    }));
    content.rowsLabel =
      parts.length === 1 ? "From 1 item" : `From ${parts.length} items`;
  }

  return content;
}

function RailBreakdown({
  stat,
  onHighlight,
  glossary,
}: {
  stat: ReturnType<typeof railStats>[number];
  onHighlight: (highlight: Highlight) => void;
  glossary: StatGlossary;
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
          {stat.lines.map((line) => {
            const desc = modifierDescription(line.modifierType, line.group, glossary, line.cssClass);
            const parts = sourceBreakdown(line);
            // The same item can grant the same stat through two different
            // properties, so name the property when that happens.
            const itemCounts = new Map<string, number>();
            for (const part of parts) {
              itemCounts.set(part.slug, (itemCounts.get(part.slug) ?? 0) + 1);
            }
            return (
              <div key={line.key}>
                <Tooltip content={modifierTooltip(line, desc)} placement="left">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      fontSize: 11,
                      color: "#c3c5d4",
                      width: "100%",
                    }}
                  >
                    <span>{line.label}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-text)" }}>
                      {contributionText(line)}
                    </span>
                  </div>
                </Tooltip>
                {parts.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 2,
                      marginTop: 3,
                      paddingLeft: 10,
                      borderLeft: "1px solid var(--line)",
                    }}
                  >
                    {parts.map((part) => (
                      <div
                        key={part.slug + part.propertyLabel}
                        onMouseEnter={() =>
                          onHighlight({ kind: "item", key: part.slug })
                        }
                        onMouseLeave={() => onHighlight(null)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          fontSize: 10,
                          color: "var(--muted)",
                          cursor: "pointer",
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
                          {part.propertyLabel &&
                          part.propertyLabel !== line.label &&
                          (itemCounts.get(part.slug) ?? 0) > 1
                            ? `${part.name} — ${part.propertyLabel}`
                            : part.name}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--accent-text)",
                            flex: "0 0 auto",
                          }}
                        >
                          {(part.value > 0 ? "+" : "") + part.value + part.postfix}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

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
  glossary,
}: {
  line: StatLine;
  highlight: Highlight;
  onHighlight: (highlight: Highlight) => void;
  glossary: StatGlossary;
}) {
  const total = statTotal(line);
  const isHot =
    highlight?.kind === "stat" && highlight.key === line.key;
  const isDim = highlight?.kind === "stat" && highlight.key !== line.key;
  const desc = modifierDescription(line.modifierType, line.group, glossary, line.cssClass);

  return (
    <Tooltip content={modifierTooltip(line, desc)} placement="left">
      <div
        onMouseEnter={() =>
          onHighlight({
            kind: "stat",
            key: line.key,
            modifiers: line.modifierType ? [line.modifierType] : [],
          })
        }
        onMouseLeave={() => onHighlight(null)}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
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
          width: "100%",
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
        <span
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            justifyContent: "flex-end",
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {hasBase(line) ? (
            <span style={{ color: "var(--muted)" }}>{line.base as number}</span>
          ) : null}
          {hasBase(line) ? (
            <span style={{ color: "var(--muted)" }}>→</span>
          ) : null}
          <span style={{ color: total != null ? "var(--accent-text)" : "#e7dfee" }}>
            {total != null ? Math.round(total as number) : line.total}
            {line.postfix}
          </span>
        </span>
      </div>
    </Tooltip>
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
          fontFamily: "var(--font-body)",
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
                fontFamily: "var(--font-body)",
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
                          modifiers: line.modifierType ? [line.modifierType] : [],
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
