"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { itemImage } from "@/components/item/item-card";
import { BASE_SLOTS, TOTAL_SLOTS, readStoredBuild } from "@/lib/build";
import {
  buildReadout,
  headlineLines,
  heroStats,
  statTotal,
} from "@/lib/stat-map";
import { abilityDamages, conditionOutcome } from "@/lib/damage";
import { resolveAbilitiesAtLevel } from "@/lib/ability-stats";
import { heroStatsByDisplayName } from "@/lib/stat-map";

import type { StatMap } from "@/lib/stat-map";
import type { ConditionOutcome } from "@/lib/damage";
import type { HeroAbility } from "@/components/hero/theorycraft/types";

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
  abilities?: HeroAbility[];
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
  abilities = [],
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
  const procs = useMemo(() => {
    const items = slugs
      .map((slug) => {
        const row = itemIndex[slug];
        if (!row) return null;
        return { slug, name: row.name, properties: row.properties };
      })
      .filter((x): x is { slug: string; name: string; properties: unknown } => !!x);

    if (items.length === 0) return [];

    const dmg = abilityDamages(abilities ?? [], items);
    const conditions = statMap.conditions ?? {};
    const outcomes: ConditionOutcome[] = [];

    for (const item of items) {
      const cond = conditions[item.slug];
      if (!cond) continue;
      outcomes.push(conditionOutcome(cond, item.properties, dmg));
    }

    return outcomes;
  }, [slugs, itemIndex, abilities, statMap]);

  const abilityDeltas = useMemo(() => {
    const items = slugs
      .map((slug) => {
        const row = itemIndex[slug];
        if (!row) return null;
        return { slug, name: row.name, properties: row.properties };
      })
      .filter((x): x is { slug: string; name: string; properties: unknown } => !!x);

    if (items.length === 0 || !abilities || abilities.length === 0) return [];

    const displayNames = heroStatsByDisplayName(startingStats);
    const levels: Record<string, number> = {};
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(`deadlock-atlas:build:${heroSlug}`) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.abilityLevels) Object.assign(levels, parsed.abilityLevels);
      }
    } catch {}

    const resolved = resolveAbilitiesAtLevel(abilities, items, statMap, displayNames, levels);
    const deltas = [];
    for (const r of resolved) {
      for (const p of r.properties) {
        if (Math.abs(p.resolvedValue - p.baseValue) > 0.001) {
          deltas.push({
            abilityName: r.ability.ability.name,
            label: p.label,
            base: p.baseValue,
            resolved: p.resolvedValue,
            postfix: p.postfix,
          });
        }
      }
    }
    return deltas.slice(0, 2);
  }, [slugs, itemIndex, abilities, statMap, startingStats, heroSlug]);

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
                      {total != null ? Math.round(total) : line.total}
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

            {(abilityDeltas.length > 0 || procs.length > 0) ? (
              <div
                style={{
                  borderTop: "1px solid var(--line)",
                  paddingTop: 10,
                  display: "grid",
                  gap: 6,
                }}
              >
                {abilityDeltas.length > 0 ? (
                  <>
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--muted)",
                      }}
                    >
                      Abilities
                    </div>
                    {abilityDeltas.map((d, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                          fontSize: 11,
                          color: "var(--muted)",
                        }}
                      >
                        <div>
                          <span style={{ color: "var(--text)" }}>{d.abilityName}</span>
                          {" · "}
                          {d.label}{" "}
                          <span style={{ fontFamily: "var(--font-mono)" }}>
                            {d.base}{d.postfix} → {d.resolved > 0 ? "+" : ""}{d.resolved}{d.postfix}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}
                {procs.length > 0 ? (
                  <>
                    <div
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--muted)",
                        marginTop: abilityDeltas.length > 0 ? 4 : 0,
                      }}
                    >
                      Procs
                    </div>
                    <div style={{ borderTop: "1px solid var(--line)", marginTop: 10 }} />
                {procs.slice(0, 3).map((outcome, idx) => {
                  const top =
                    outcome.abilities.find((a) => a.meetsCondition) ||
                    outcome.abilities[0];
                  if (!top) return null;
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        flexWrap: "wrap",
                        fontSize: 11,
                        color: "var(--muted)",
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--text)" }}>
                          {outcome.condition.label}
                        </span>
                        {" · "}
                        {top.ability.abilityName}{" "}
                        {top.ability.scalable
                          ? `${top.ability.withoutBuild.toFixed(0)} → ${top.damage.toFixed(0)}`
                          : "—"}
                        {outcome.threshold != null && top.margin != null
                          ? top.meetsCondition
                            ? `, clears ${outcome.threshold} by ${Math.abs(top.margin).toFixed(0)}`
                            : `, below ${outcome.threshold} by ${Math.abs(top.margin).toFixed(0)}`
                          : ""}
                      </div>
                      {outcome.bonus != null ? (
                        <div style={{ color: "var(--accent)" }}>
                          +{outcome.bonus}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                  </>
                ) : null}
              </div>
            ) : null}

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
