"use client";

import Image from "next/image";

import { propertiesAtLevel, scaleFor, upgradeTiers } from "@/lib/ability-upgrades";
import { numericValue } from "@/lib/stat-map";

import type { HeroAbility, StatMap } from "./types";

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
  levels: Record<string, number>;
  onSetLevel: (slot: string, level: number) => void;
  onSetStage: (stage: "early" | "mid" | "late") => void;
};

export function Abilities({
  abilities,
  statMap,
  levels,
  onSetLevel,
  onSetStage,
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
          fontFamily: "var(--font-display)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
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
            level={levels[entry.slot] ?? 0}
            onSetLevel={onSetLevel}
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
  level,
  onSetLevel,
}: {
  entry: HeroAbility;
  statMap: StatMap;
  level: number;
  onSetLevel: (slot: string, level: number) => void;
}) {
  const tiers = upgradeTiers(entry.ability.upgrades);
  const properties = propertiesAtLevel(
    (entry.ability.properties ?? {}) as Record<string, never>,
    tiers,
    level,
  );

  const lines: {
    key: string;
    label: string;
    value: number;
    postfix: string;
    scaled: { coefficient: number; from: string } | null;
  }[] = [];

  for (const [key, property] of Object.entries(properties)) {
    const type = property.provided_property_type;
    if (!type) continue;
    const mapped = statMap.modifiers[type];
    if (!mapped) continue;
    const value = numericValue(property.value);
    if (value == null || value === 0) continue;

    const scale = scaleFor(property);
    lines.push({
      key,
      label: property.label?.trim() || key,
      value,
      postfix: property.postfix ?? "",
      scaled: scale ? { coefficient: scale.coefficient, from: scale.from } : null,
    });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "64px 1fr",
        gap: 16,
        padding: 14,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "#ffffff06",
        minHeight: 96,
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
              fontFamily: "var(--font-display)",
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

        {lines.length === 0 ? (
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

        {lines.some((l) => l.scaled) ? (
          <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--muted)" }}>
            Scales with{" "}
            {lines.find((l) => l.scaled)?.scaled?.from || "your stats"} (
            coefficient {lines.find((l) => l.scaled)?.scaled?.coefficient}).
          </p>
        ) : lines.length > 0 ? (
          <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--muted)" }}>
            Does not scale with spirit power or weapon damage.
          </p>
        ) : null}
      </div>
    </div>
  );
}
