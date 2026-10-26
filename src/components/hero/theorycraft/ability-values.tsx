"use client";

import { useMemo } from "react";

import { abilityPropertyDescription } from "@/lib/stat-glossary";
import { statGlossary } from "@/lib/stat-glossary";
import { Tooltip } from "@/components/hero/tooltip";

import type { AbilityFactor, ResolvedAbilityProperty } from "@/lib/ability-stats";
import type { StatGlossary } from "@/lib/stat-glossary";

export const ABILITY_VALUE_GRID = "minmax(0, 1fr) 76px 76px 92px";

/**
 * The tooltip for one factor chip.
 *
 * The chip says what kind of thing moved the number — spirit power, a
 * cooldown reduction — but not which item did it. The rows name them.
 */
function factorTooltip(
  factor: AbilityFactor,
  glossary: StatGlossary,
) {
  const prose = factor.source && glossary.modifiers[factor.source]
    ? glossary.modifiers[factor.source]
    : null;

  const content: {
    what: string;
    label?: string;
    rows?: { label: string; value: string }[];
    rowsLabel?: string;
  } = {
    what: prose ?? factor.label,
  };

  // The label is only worth showing when the prose says something different.
  if (prose) content.label = factor.label;

  const items = factor.items ?? [];
  if (items.length > 0) {
    content.rows = items.map((item) => ({
      label: item.name,
      value: (item.value > 0 ? "+" : "") + item.value + item.postfix,
    }));
    content.rowsLabel = items.length === 1 ? "From 1 item" : `From ${items.length} items`;
  }

  return content;
}

export function AbilityValues({ property }: { property: ResolvedAbilityProperty }) {
  const glossary = useMemo(() => statGlossary(), []);
  const base = property.baseValue;
  const tier = property.tierValue ?? base;
  const resolved = property.resolvedValue;
  const tierDelta = property.tierDelta ?? (tier - base);
  const itemDelta = property.itemDelta ?? (resolved - tier);
  const hasTier = Math.abs(tierDelta) > 0.0001;
  const hasItem = Math.abs(itemDelta) > 0.0001;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: ABILITY_VALUE_GRID,
          gap: 0,
          alignItems: "center",
          fontSize: 11,
          color: "#c3c5d4",
          paddingTop: 6,
          borderTop: "1px solid var(--line)",
        }}
      >
        <Tooltip content={abilityPropertyDescription(property.key, glossary)} placement="right">
          <span style={{ minWidth: 0, paddingRight: 8 }}>{property.label}</span>
        </Tooltip>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            color: "var(--muted)",
            textAlign: "right",
            padding: "1px 8px",
            borderLeft: "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
          }}
        >
          {base}
          {property.postfix}
        </span>
        <Tooltip
          content={
            hasTier
              ? { what: `Tier change: ${tierDelta >= 0 ? "+" : ""}${tierDelta}${property.postfix}`, affects: "Applied at the chosen upgrade tier." }
              : null
          }
          placement="top"
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              color: hasTier ? "var(--accent-text)" : "var(--muted)",
              textAlign: "right",
              padding: "1px 6px",
              borderRadius: 6,
              background: hasTier ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
              boxShadow: hasTier ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)" : "none",
              borderLeft: "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
            }}
          >
            {tier}
            {property.postfix}
          </span>
        </Tooltip>
        <Tooltip
          content={
            hasItem
              ? { what: `Change from build: ${itemDelta >= 0 ? "+" : ""}${itemDelta}${property.postfix}`, affects: "Items and spirit power applied to this value." }
              : null
          }
          placement="top"
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              color: hasItem ? "var(--accent-text)" : "var(--muted)",
              textAlign: "right",
              padding: "1px 6px",
              borderRadius: 6,
              background: hasItem ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
              boxShadow: hasItem ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)" : "none",
              borderLeft: "1px solid color-mix(in srgb, var(--line) 60%, transparent)",
            }}
          >
            {resolved}
            {property.postfix}
          </span>
        </Tooltip>
      </div>
      {(hasTier || hasItem) && property.factors.length > 1 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 9, color: "var(--muted)" }}>
          {property.factors
            .filter((f) => f.kind === "tier" || f.kind === "item" || f.kind === "scale" || f.kind === "proc")
            .slice(0, 4)
            .map((f, i) => (
              <Tooltip key={i} content={factorTooltip(f, glossary)} placement="top">
                <span
                  style={{
                    padding: "1px 6px",
                    border: "1px solid var(--line)",
                    borderRadius: 999,
                    color: f.kind === "item" || f.kind === "scale" || f.kind === "proc" ? "var(--accent-text)" : "var(--muted)",
                    cursor: "default",
                  }}
                >
                  {f.label}
                  {f.delta > 0 ? ` +${f.delta}${property.postfix}` : f.delta < 0 ? ` ${f.delta}${property.postfix}` : ""}
                  {f.kind === "scale" && property.scaleMode === "inferred-1to1" ? " *" : ""}
                </span>
              </Tooltip>
            ))}
        </div>
      ) : null}

      <FactorSources property={property} />
    </div>
  );
}

/**
 * Which items produced each factor on an ability.
 *
 * The factor chips say what kind of thing moved the number; this says which
 * item did it, so a computed ability value can be traced back to a build
 * slot. Only factors with items behind them are listed, so a tier-only
 * ability shows nothing here.
 */
function FactorSources({ property }: { property: ResolvedAbilityProperty }) {
  const withItems = property.factors.filter(
    (f) => f.kind !== "base" && f.kind !== "tier" && (f.items?.length ?? 0) > 0,
  );
  if (withItems.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gap: 3,
        marginTop: 2,
        paddingLeft: 10,
        borderLeft: "1px solid var(--line)",
      }}
    >
      {withItems.map((f, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "baseline",
            fontSize: 10,
            color: "var(--muted)",
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
            {f.label}
            <span style={{ color: "var(--muted)", opacity: 0.7 }}>
              {" · "}
            </span>
            {f.items!.map((item) => item.name).join(", ")}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--accent-text)",
              flex: "0 0 auto",
            }}
          >
            {f.delta > 0 ? "+" : ""}
            {f.delta}
            {property.postfix}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AbilityValuesNote({ property }: { property: ResolvedAbilityProperty }) {
  if (property.factors.length <= 1 && property.notes.length === 0) return null;
  const note = property.notes[0] ?? "";
  if (!note) return null;
  return (
    <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, paddingLeft: 2 }}>
      {note}
    </div>
  );
}
