"use client";

import Image from "next/image";

import { costLabel } from "@/lib/item-filter-shared";
import { slotLabel } from "@/lib/item-colors";
import { itemImage } from "@/components/item/item-card";
import { themeStyle } from "@/lib/theme";
import { BASE_SLOTS } from "@/lib/build";
import { contributionText, itemContributions, sourceBreakdown } from "@/lib/stat-map";
import { modifierDescription } from "@/lib/stat-glossary";
import { statGlossary } from "@/lib/stat-glossary";
import { Tooltip } from "@/components/hero/tooltip";

import type { Highlight, ItemIndexRow, StatMap } from "./types";

/**
 * The loadout board.
 *
 * Twelve wells in three rows of four. Any item fits any well and duplicates
 * are allowed; nine wells are usable and the last three unlock with team
 * size.
 *
 * Each filled well shows what the item does, so the reader can see an
 * item's stat impact without adding it first.
 */

type Props = {
  items: string[];
  itemIndex: Record<string, ItemIndexRow>;
  statMap: StatMap;
  highlight: Highlight;
  onHighlight: (highlight: Highlight) => void;
  onOpenPicker: (slot: number) => void;
  onRemove: (slot: number) => void;
};

/** The short label for a stat chip: "Max Health" becomes "HP". */
const SHORT_LABELS: Record<string, string> = {
  "max health": "HP",
  "bonus health": "HP",
  "health": "HP",
  "spirit power": "SP",
  "weapon damage": "DMG",
  "spirit resist": "SPR",
  "bullet resist": "BUL",
  "move speed": "SPD",
  "cooldown reduction": "CD",
  "ability cooldown reduction": "CD",
  "health regen": "REG",
  "ability charges": "CHG",
};

/** The short label for a chip, if there is one. */
function shortLabel(label: string): string {
  return SHORT_LABELS[label.trim().toLowerCase()] ?? label;
}

/**
 * The order the chips are shown in.
 *
 * The stats a reader cares about come first — health, then the two damage
 * scales, then the resistances — rather than the alphabetical order the
 * properties happen to arrive in.
 */
const CHIP_ORDER = [
  "max_health",
  "weapon_power",
  "tech_range",
  "max_move_speed",
  "sprint_speed",
  "stamina",
];

/** The group's place in the chip order. */
const GROUP_ORDER = [
  "health",
  "spirit",
  "weapon",
  "defence",
  "ability",
  "movement",
  "sustain",
  "utility",
];

/**
 * The tooltip for one stat chip on an item card.
 *
 * The chip shows a short label, so the tooltip spells the property out and
 * names the stat it feeds.
 */
function chipTooltip(
  chip: ReturnType<typeof itemContributions>[number],
  glossary: ReturnType<typeof statGlossary>,
) {
  const desc = modifierDescription(
    chip.modifierType,
    chip.group,
    glossary,
    chip.cssClass,
  );
  if (!desc) return null;

  const content: {
    what: string;
    label?: string;
    rows?: { label: string; value: string }[];
    rowsLabel?: string;
  } = { what: desc, label: chip.label };

  const parts = sourceBreakdown(chip);
  if (parts.length > 0) {
    content.rows = parts.map((part) => ({
      label: part.name,
      value: (part.value > 0 ? "+" : "") + part.value + part.postfix,
    }));
    content.rowsLabel = parts.length === 1 ? "From 1 item" : `From ${parts.length} items`;
  }

  return content;
}

export function Board({
  items,
  itemIndex,
  statMap,
  highlight,
  onHighlight,
  onOpenPicker,
  onRemove,
}: Props) {
  const glossary = statGlossary();
  return (
    <div
      style={{
        display: "grid",
        // Three across, four down. The wells need about 220px to hold an
        // icon, a name and three stat chips without wrapping.
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 10,
      }}
    >
      {items.map((slug, index) => {
        const locked = index >= BASE_SLOTS;
        const row = slug ? itemIndex[slug] : null;
        const src = row ? itemImage(row) : null;

        const chips = row
          ? itemContributions(
              { slug: row.slug, name: row.name, properties: row.properties },
              statMap,
            )
          : [];

        // The chips shown are the three that matter most, but the highlight
        // has to look at every contribution the item makes.
        const shownChips = [...chips]
          .sort((a, b) => {
            const ai = CHIP_ORDER.indexOf(a.heroStat ?? "");
            const bi = CHIP_ORDER.indexOf(b.heroStat ?? "");
            if (ai !== bi) {
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
            }
            const ag = GROUP_ORDER.indexOf(a.group);
            const bg = GROUP_ORDER.indexOf(b.group);
            if (ag !== bg) return ag - bg;
            return a.label.localeCompare(b.label);
          })
          .slice(0, 3);

        // The item is dimmed when another stat is highlighted, and stands out
        // when it feeds the highlighted one.
        const isHot =
          highlight?.kind === "item" && highlight.key === slug;
        const feedsHotStat =
          highlight?.kind === "stat" &&
          chips.some((chip) =>
            (highlight.modifiers || []).includes(chip.modifierType as string),
          );
        const isDim =
          (highlight?.kind === "item" && highlight.key !== slug) ||
          (highlight?.kind === "stat" && !feedsHotStat);

        return (
          <div key={index} style={{ position: "relative", display: "grid" }}>
            <button
              type="button"
              disabled={locked}
              onClick={() => (locked ? undefined : onOpenPicker(index))}
              onMouseEnter={() =>
                onHighlight(slug ? { kind: "item", key: slug } : null)
              }
              onMouseLeave={() => onHighlight(null)}
              title={
                locked
                  ? "Unlocked by team size"
                  : row
                    ? `${row.name} — click to change`
                    : "Empty slot"
              }
              style={{
                position: "relative",
                display: "grid",
                gap: 8,
                alignContent: "start",
                padding: 10,
                paddingRight: row ? 30 : 10,
                minHeight: 112,
                textAlign: "left",
                color: "inherit",
                border: "none",
                ...(row
                  ? {
                      ...themeStyle({
                        accent: row.accent,
                        accentText: row.accentText,
                        onAccent: row.onAccent,
                      }),
                      background: "var(--panel)",
                      boxShadow: isHot
                        ? "inset 0 0 0 2px var(--accent)"
                        : feedsHotStat
                          ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 70%, transparent)"
                          : "inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent)",
                    }
                  : {
                      background: "#ffffff06",
                      boxShadow: "inset 0 0 0 1px var(--line)",
                    }),
                clipPath:
                  "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.35 : isDim ? 0.42 : 1,
                transition: "opacity 120ms ease, box-shadow 120ms ease",
              }}
            >
              {row && src ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      flex: "0 0 auto",
                      display: "grid",
                      placeItems: "center",
                      background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                      clipPath:
                        "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                    }}
                  >
                    <Image
                      src={src}
                      alt=""
                      width={52}
                      height={52}
                      unoptimized
                      style={{ width: 42, height: 42, objectFit: "contain" }}
                    />
                  </div>
                  <div style={{ minWidth: 0, display: "grid", gap: 4 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0",
                        lineHeight: 1.25,
                        color: "#fff",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {row.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 5,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <span className="tag">{slotLabel(row.slotType)}</span>
                      {row.tier ? (
                        <span className="tag-muted">Tier {row.tier}</span>
                      ) : null}
                      {row.cost != null ? (
                        <span className="tag-muted">{costLabel(row.cost)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : locked ? (
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  Locked
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 20,
                    color: "var(--muted)",
                    opacity: 0.45,
                    lineHeight: 1,
                  }}
                >
                  +
                </span>
              )}

              {shownChips.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    flexWrap: "wrap",
                  }}
                >
                  {shownChips.map((chip) => {
                    const chipHot =
                      highlight?.kind === "stat" && highlight.key === chip.key;
                    return (
                      <Tooltip
                        key={chip.key}
                        content={chipTooltip(chip, glossary)}
                        placement="right"
                      >
                        <span
                          className="tag-muted"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            color: chipHot ? "var(--accent-text)" : undefined,
                            background: chipHot
                              ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                              : undefined,
                          }}
                        >
                          {shortLabel(chip.label)} {contributionText(chip)}
                        </span>
                      </Tooltip>
                    );
                  })}
                </div>
              ) : row ? (
                <span style={{ fontSize: 10, color: "var(--muted)" }}>
                  {statMap.conditions?.[row.slug] ? "Condition" : "[no mapped stats]"}
                </span>
              ) : null}
            </button>

            {row ? (
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${row.name}`}
                title={`Remove ${row.name}`}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 20,
                  height: 20,
                  display: "grid",
                  placeItems: "center",
                  background: "none",
                  border: "none",
                  padding: 0,
                  font: "inherit",
                  fontSize: 15,
                  lineHeight: 1,
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
