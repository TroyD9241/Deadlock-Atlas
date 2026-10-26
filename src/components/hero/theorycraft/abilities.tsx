"use client";

import Image from "next/image";
import { useMemo } from "react";

import { propertiesAtLevel, propertyLabel, scaleSource, upgradeTiers } from "@/lib/ability-upgrades";
import { numericValue, readOnlyAbilityPropertiesList, toProperties } from "@/lib/stat-map";
import { resolveAbilitiesAtLevel } from "@/lib/ability-stats";
import { abilityPropertyDescription, columnDescription } from "@/lib/stat-glossary";
import { statGlossary } from "@/lib/stat-glossary";
import { Tooltip } from "@/components/hero/tooltip";

import { ABILITY_VALUE_GRID, AbilityValues, AbilityValuesNote } from "./ability-values";

import type { ScaleSource } from "@/lib/ability-upgrades";
import type { HeroAbility, StatMap } from "./types";
import type { BuildItem } from "@/lib/stat-map";

/**
 * The ability list.
 *
 * Each ability carries an upgrade level — base, tier 2, tier 3, tier 4 —
 * and a match-stage preset sets every ability at once. The readout shows the
 * ability's own properties at the chosen level, and the scale coefficient
 * where the API gives one.
 */

type Props = {
  abilities: HeroAbility[];
  statMap: StatMap;
  /**
   * The hero's stat keys by the game's display name.
   *
   * The abilities' scale functions name their source stat in the same
   * vocabulary, so this is how "scales with ETechRange" becomes "scales
   * with tech range".
   */
  displayNames: Record<string, string>;
  levels: Record<string, number>;
  onSetLevel: (slot: string, level: number) => void;
  onSetStage: (stage: "early" | "mid" | "late") => void;
  items?: BuildItem[];
};

export function Abilities({
  abilities,
  statMap,
  displayNames,
  levels,
  onSetLevel,
  onSetStage,
  items = [],
}: Props) {
  // The shared abilities — the ones every hero has — carry no upgrade tiers
  // and no modifiers. Six full cards to say so is six rows of dead weight,
  // so they go in one line at the bottom.
  const own = abilities.filter((a) => !isShared(a));
  const shared = abilities.filter(isShared);

  return (
    <div className="plate" style={{ padding: 16 }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: 4,
        }}
      >
        Abilities
      </div>
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        Set each ability&apos;s upgrade level to read the same build at
        different points in the match.
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        {(["early", "mid", "late"] as const).map((stage) => (
          <button
            key={stage}
            type="button"
            className="chip"
            onClick={() => onSetStage(stage)}
            style={{ cursor: "pointer", border: "none", font: "inherit" }}
          >
            {stage} game
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {own.map((entry) => (
          <AbilityCard
            key={entry.slot}
            entry={entry}
            statMap={statMap}
            displayNames={displayNames}
            level={levels[entry.slot] ?? 0}
            onSetLevel={onSetLevel}
            items={items}
          />
        ))}
      </div>

      {shared.length > 0 ? (
        <div
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "baseline",
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Shared
          </span>
          {shared.map((entry) => (
            <span
              key={entry.slot}
              title="Every hero has this ability, and it has no upgrade tiers."
              style={{ fontSize: 11, color: "#c3c5d4" }}
            >
              {entry.ability.name}
            </span>
          ))}
          <span style={{ fontSize: 10, color: "var(--muted)" }}>
            — every hero has these, and they carry no upgrade tiers.
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Whether an ability is one of the shared ones.
 *
 * The shared abilities have no upgrade tiers in the API and no mapped
 * modifiers, so they carry nothing for the tool to show.
 */
function isShared(entry: HeroAbility): boolean {
  return upgradeTiers(entry.ability.upgrades).length === 0;
}

function AbilityCard({
  entry,
  statMap,
  displayNames,
  level,
  onSetLevel,
  items = [],
}: {
  entry: HeroAbility;
  statMap: StatMap;
  displayNames: Record<string, string>;
  level: number;
  onSetLevel: (slot: string, level: number) => void;
  items?: BuildItem[];
}) {
  const glossary = useMemo(() => statGlossary(), []);
  const tiers = upgradeTiers(entry.ability.upgrades);
  const resolved = resolveAbilitiesAtLevel([entry], items, statMap, displayNames, { [entry.slot]: level })[0];
  const resolvedProps = resolved?.properties ?? [];

  const labels = {
    bonus: statMap.abilityBonusLabels,
    modifier: statMap.modifierLabels,
  };

  /*
   * The ability's own properties, plus the bonuses its upgrade tiers add.
   *
   * A bonus that names a property the ability never had becomes a line of
   * its own rather than a change to an existing one.
   */
  const lines: {
    key: string;
    label: string;
    value: number;
    postfix: string;
    scale: ScaleSource | null;
  }[] = [];

  const seen = new Set<string>();

  if (resolvedProps.length > 0) {
    for (const rp of resolvedProps) {
      seen.add(rp.key);
      lines.push({
        key: rp.key,
        label: rp.label,
        value: rp.resolvedValue,
        postfix: rp.postfix,
        scale: rp.scale,
      });
    }
  } else {
    const properties = propertiesAtLevel(
      (entry.ability.properties ?? {}) as Record<string, never>,
      tiers,
      level,
    );

    for (const [key, property] of Object.entries(properties)) {
      const type = property.provided_property_type;
      const mapped = type ? statMap.modifiers[type] : null;
      if (type && !mapped) continue;

      const value = numericValue(property.value);
      if (value == null || value === 0) continue;

      seen.add(key);
      lines.push({
        key,
        label: propertyLabel(key, property, labels),
        value,
        postfix: property.postfix ?? "",
        scale: scaleSource(property, displayNames, statMap.displayStatLabels ?? {}),
      });
    }

    for (const tier of tiers.slice(0, level)) {
      for (const bonus of tier.upgrades) {
        if (seen.has(bonus.name)) continue;
        seen.add(bonus.name);
        lines.push({
          key: bonus.name,
          label: propertyLabel(bonus.name, undefined, labels),
          value: bonus.bonus,
          postfix: "",
          scale: null,
        });
      }
    }
  }

  return (
    <div
      id={`ability-${entry.ability.id || entry.slot}`}
      style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr",
        gap: 16,
        padding: 14,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "#ffffff06",
        minHeight: 96,
        scrollMarginTop: 100,
      }}
    >
      <div style={{ display: "grid", placeItems: "center" }}>
        {entry.ability.imageWebp ?? entry.ability.image ? (
          <Image
            src={(entry.ability.imageWebp ?? entry.ability.image) as string}
            alt=""
            width={56}
            height={56}
            unoptimized
            style={{ width: 52, height: 52, objectFit: "contain" }}
          />
        ) : (
          <span style={{ fontSize: 10, color: "var(--muted)" }}>—</span>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 16,
              color: "#fff",
            }}
          >
            {entry.ability.name}
          </span>

          <div style={{ display: "flex", gap: 5 }}>
            {Array.from({ length: tiers.length + 1 }, (_, levelIndex) => (
              <button
                key={levelIndex}
                type="button"
                onClick={() => onSetLevel(entry.slot, levelIndex)}
                aria-pressed={level === levelIndex}
                className={`chip${level === levelIndex ? " active" : ""}`}
                style={{
                  cursor: "pointer",
                  border: "none",
                  font: "inherit",
                  minHeight: 36,
                  padding: "6px 12px",
                  fontSize: 11,
                }}
              >
                {levelIndex === 0 ? "BASE" : `T${levelIndex + 1}`}
              </button>
            ))}
          </div>
        </div>

        {resolvedProps.length > 0 ? (
          <div style={{ display: "grid", gap: 4, marginTop: 10 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: ABILITY_VALUE_GRID,
                gap: 0,
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--muted)",
                alignItems: "center",
              }}
            >
              <span>Stat</span>
              <Tooltip content={columnDescription("base", glossary)} placement="top"><span style={{ textAlign: "right", paddingRight: 8 }}>Base</span></Tooltip>
              <Tooltip content={columnDescription("tier", glossary)} placement="top">
                <span style={{ textAlign: "right", paddingRight: 8, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
                  {level === 0 ? "Tier" : `Tier ${level}`}
                  <span
                    style={{
                      padding: "0 4px",
                      borderRadius: 999,
                      fontSize: 8,
                      lineHeight: "12px",
                      letterSpacing: "0.08em",
                      color: "var(--accent-text)",
                      background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                      boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)",
                    }}
                  >
                    {level === 0 ? "BASE" : `T${level + 1}`}
                  </span>
                </span>
              </Tooltip>
              <Tooltip content={columnDescription("items", glossary)} placement="top"><span style={{ textAlign: "right", paddingRight: 6 }}>With Build</span></Tooltip>
            </div>
            {resolvedProps.map((rp, idx) => (
              <div
                key={rp.key}
                style={{
                  padding: "2px 0",
                  background: idx % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                  borderRadius: 6,
                }}
              >
                <AbilityValues property={rp} />
                <AbilityValuesNote property={rp} />
              </div>
            ))}
          </div>
        ) : lines.length === 0 ? (
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>
            [no stat modifiers]
          </p>
        ) : (
          <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
            {lines.map((line) => (
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
                <span
                  style={{ fontFamily: "var(--font-mono)", color: "var(--accent-text)" }}
                >
                  {line.value > 0 ? "+" : ""}
                  {line.value}
                  {line.postfix}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, marginTop: 10 }}>
          <ReadOnlyAbilityValues ability={entry.ability} statMap={statMap} glossary={glossary} />
        </div>

        {resolvedProps.length === 0 ? (
          lines.some((l) => l.scale) ? (
            <div
              style={{
                marginTop: 7,
                display: "grid",
                gap: 3,
                fontSize: 10,
                color: "var(--muted)",
              }}
            >
              {lines
                .filter((l) => l.scale)
                .map((l) => (
                  <span key={l.key}>
                    {l.label} scales with {l.scale?.label}
                    {l.scale?.coefficient != null
                      ? ` (× ${l.scale.coefficient})`
                      : ""}
                    .
                  </span>
                ))}
            </div>
          ) : lines.length > 0 ? (
            <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--muted)" }}>
              Does not scale with spirit power or weapon damage.
            </p>
          ) : null
        ) : null}
      </div>
    </div>
  );
}

function ReadOnlyAbilityValues({
  ability,
  statMap,
  glossary,
}: {
  ability: HeroAbility["ability"];
  statMap: StatMap;
  glossary: ReturnType<typeof statGlossary>;
}) {
  const items = readOnlyAbilityPropertiesList(toProperties(ability.properties), statMap);
  if (items.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
        Movement values
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        {items.map((item, idx) => {
          const desc = abilityPropertyDescription(item.key, glossary);
          const striped = items.length > 10 && idx % 2 === 1;
          return (
            <Tooltip key={item.key} content={desc ? { what: desc.what, affects: desc.affects, label: item.label } : null} placement="right">
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
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {item.label}
                  <span
                    style={{
                      fontSize: 8,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      border: "1px solid var(--line)",
                      borderRadius: 999,
                      padding: "0 5px",
                    }}
                  >
                    not modified by items
                  </span>
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                  {item.value}
                  {item.postfix}
                </span>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
