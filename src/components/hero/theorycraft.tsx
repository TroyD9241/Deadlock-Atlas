"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { costLabel } from "@/lib/item-filter-shared";
import { slotLabel } from "@/lib/item-colors";
import { itemImage } from "@/components/item/item-card";
import { themeStyle } from "@/lib/theme";
import {
  BASE_SLOTS,
  TOTAL_SLOTS,
  buildCost,
  buildParams,
  emptyBuild,
  parseBuild,
  purchaseCapCheck,
  readStoredBuild,
  writeStoredBuild,
} from "@/lib/build";

import type { Build } from "@/lib/build";
import {
  buildReadout,
  groupLines,
  headlineLines,
  heroStats,
  numericValue,
  resistLines,
  statTotal,
} from "@/lib/stat-map";
import {
  propertiesAtLevel,
  scaleFor,
  upgradeTiers,
} from "@/lib/ability-upgrades";

import type { StatLine, StatMap } from "@/lib/stat-map";

/**
 * The theorycraft tool.
 *
 * Everything here is computed from the API's own stat values. The game
 * applies hidden multipliers, spirit-power thresholds and proc interactions
 * that are not in the data, so the numbers are a guide, not a promise.
 */

export type PickerItem = {
  slug: string;
  name: string;
  nameSource: string;
  slotType: string | null;
  tier: number | null;
  cost: number | null;
  image: string | null;
  imageWebp: string | null;
  shopImage: string | null;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  properties: unknown;
};

export type HeroAbility = {
  id: number;
  slot: string;
  displayOrder: number;
  isInnate: boolean;
  ability: {
    id: number;
    className: string;
    name: string;
    image: string | null;
    imageWebp: string | null;
    properties: unknown;
    upgrades: unknown;
  };
};

export type PopularItem = {
  className: string;
  pickPct: number;
  winRatePct: number;
};

export type PopularBuilds = {
  early: PopularItem[];
  mid: PopularItem[];
  late: PopularItem[];
};

type Props = {
  heroSlug: string;
  heroName: string;
  heroAccent: string | null;
  heroAccentText: string | null;
  heroOnAccent: string | null;
  startingStats: unknown;
  abilities: HeroAbility[];
  popular: PopularBuilds;
  /** The curated modifier map, loaded on the server. */
  statMap: StatMap;
};

type PickerState = {
  open: boolean;
  /** The slot the picker is filling. */
  slot: number;
  query: string;
  results: PickerItem[];
  loading: boolean;
};

/**
 * The saved build for a hero.
 *
 * The URL wins over storage, so a shared link always shows what it says.
 *
 * Read through useSyncExternalStore: the query string and localStorage are
 * both browser-only, so the server snapshot has to be an empty build. The
 * snapshot is a string rather than an object so it stays referentially stable
 * between calls — React compares snapshots by identity, and a fresh object
 * every call would loop forever.
 */
function useStoredBuild(heroSlug: string): Build {
  const snapshot = useCallback(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    const hasUrl = params.has("build") || params.has("up");
    const build = hasUrl
      ? parseBuild(params)
      : (readStoredBuild(heroSlug) ?? parseBuild(params));
    return JSON.stringify(build);
  }, [heroSlug]);

  const raw = useSyncExternalStore(
    useCallback(() => () => {}, []),
    snapshot,
    () => "",
  );

  return useMemo(() => {
    if (!raw) return emptyBuild();
    try {
      const parsed = JSON.parse(raw) as Build;
      return {
        items: Array.isArray(parsed.items) ? parsed.items : emptyBuild().items,
        abilityLevels: Array.isArray(parsed.abilityLevels)
          ? parsed.abilityLevels
          : [],
      };
    } catch {
      return emptyBuild();
    }
  }, [raw]);
}

export function Theorycraft({
  heroSlug,
  heroName,
  heroAccent,
  heroAccentText,
  heroOnAccent,
  startingStats,
  abilities,
  popular,
  statMap,
}: Props) {
  const [itemIndex, setItemIndex] = useState<Record<string, ItemIndexRow>>({});
  const [picker, setPicker] = useState<PickerState>({
    open: false,
    slot: 0,
    query: "",
    results: [],
    loading: false,
  });

  function emptyState() {
    return emptyBuild();
  }

  /*
   * The build comes from the URL first, then from storage. `storedBuild` is
   * the read; `edited` holds the user's changes and wins once there are any.
   */
  const storedBuild = useStoredBuild(heroSlug);
  const [edited, setEdited] = useState<Build | null>(null);
  const build = edited ?? storedBuild;

  /*
   * The mutators below run on click, so they have to act on the build as it
   * is at that moment, not on the copy captured when the callback was made.
   * The store refreshes a tick after hydration, so a click in that window
   * would otherwise be applied to an empty build. The ref holds the latest
   * committed build, which keeps the mutators stable.
   */
  const buildRef = useRef(build);
  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  /*
   * The URL and the saved build are written when the user changes the
   * build, not when the page loads: on load the URL is the source of truth
   * and writing it back would race the browser's own read of it.
   */
  const updateBuild = useCallback(
    (next: (current: Build) => Build) => {
      setEdited((current) => {
        const base = current ?? buildRef.current;
        const updated = next(base);
        if (typeof window !== "undefined") {
          const params = buildParams(updated);
          const search = params.toString();
          const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
          window.history.replaceState(null, "", url);
          writeStoredBuild(heroSlug, updated);
        }
        return updated;
      });
    },
    [heroSlug],
  );

  /*
   * The board only needs the items that are in the build. The whole shop is
   * 1.4MB of properties, so it is fetched for the twelve wells rather than
   * for everything — and re-fetched when the build changes.
   */
  const buildSlugs = useMemo(
    () => [...new Set(build.items.filter(Boolean))].sort(),
    [build.items],
  );
  const slugsKey = buildSlugs.join(",");

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/items?slugs=${encodeURIComponent(slugsKey)}`)
      .then((res) => res.json())
      .then((data: { items?: PickerItem[] }) => {
        if (cancelled) return;
        const index: Record<string, ItemIndexRow> = {};
        for (const item of data.items ?? []) {
          index[item.slug] = {
            slug: item.slug,
            name: item.name,
            slotType: item.slotType,
            tier: item.tier,
            cost: item.cost,
            properties: item.properties,
            image: item.image,
            imageWebp: item.imageWebp,
            shopImage: item.shopImage,
            accent: item.accent,
            accentText: item.accentText,
            onAccent: item.onAccent,
          };
        }
        setItemIndex(index);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slugsKey]);

  // URL and storage are only updated on user edits in updateBuild.

  const addItem = useCallback((slug: string) => {
    updateBuild((current) => {
      const items = [...current.items];
      const empty = items.indexOf("");
      if (empty >= 0) items[empty] = slug;
      else items[TOTAL_SLOTS - 1] = slug;
      return { ...current, items };
    });
  }, [updateBuild]);

  const removeItem = useCallback((slot: number) => {
    updateBuild((current) => {
      const items = [...current.items];
      items[slot] = "";
      return { ...current, items };
    });
  }, [updateBuild]);

  const clearBuild = useCallback(() => {
    updateBuild(() => emptyState());
  }, [updateBuild]);

  const setAbilityLevel = useCallback((slot: string, level: number) => {
    updateBuild((current) => {
      const levels = current.abilityLevels.filter((l) => l.slot !== slot);
      if (level > 0) levels.push({ slot, level });
      return { ...current, abilityLevels: levels };
    });
  }, [updateBuild]);

  // The items in the build, for the readout.
  const buildItems = useMemo(
    () =>
      build.items
        .filter(Boolean)
        .map((slug) => {
          const row = itemIndex[slug];
          if (!row) return null;
          return { slug, name: row.name, properties: row.properties };
        })
        .filter((x): x is { slug: string; name: string; properties: unknown } => !!x),
    [build.items, itemIndex],
  );

  const readout = useMemo(
    () => buildReadout(buildItems, heroStats(startingStats), statMap),
    [statMap, buildItems, startingStats],
  );

  const abilityReadout = useMemo(() => {
    const out: {
      slot: string;
      name: string;
      image: string | null;
      level: number;
      maxLevel: number;
      lines: StatLine[];
      scaled: { label: string; value: number; coefficient: number; from: string }[];
    }[] = [];

    for (const entry of abilities) {
      const tiers = upgradeTiers(entry.ability.upgrades);
      const level =
        build.abilityLevels.find((l) => l.slot === entry.slot)?.level ?? 0;
      const properties = propertiesAtLevel(
        (entry.ability.properties ?? {}) as Record<
          string,
          { label?: string; value?: unknown; postfix?: string; icon?: string; provided_property_type?: string; scale_function?: never }
        >,
        tiers,
        level,
      );

      const lines: StatLine[] = [];
      const scaled: { label: string; value: number; coefficient: number; from: string }[] = [];

      for (const [key, property] of Object.entries(properties)) {
        const type = property.provided_property_type;
        if (!type) continue;
        const mapped = statMap.modifiers[type];
        if (!mapped) continue;
        const value = numericValue(property.value);
        if (value == null || value === 0) continue;

        lines.push({
          key,
          label: property.label?.trim() || key,
          group: mapped.group,
          kind: mapped.kind,
          total: value,
          base: null,
          heroStat: mapped.heroStat ?? null,
          postfix: property.postfix ?? "",
          sources: [],
        });

        const scale = scaleFor(property);
        if (scale) {
          scaled.push({
            label: property.label?.trim() || key,
            value,
            coefficient: scale.coefficient,
            from: scale.from,
          });
        }
      }

      out.push({
        slot: entry.slot,
        name: entry.ability.name,
        image: entry.ability.imageWebp ?? entry.ability.image,
        level,
        maxLevel: tiers.length,
        lines,
        scaled,
      });
    }

    return out;
  }, [abilities, build.abilityLevels, statMap]);

  // The picker.
  const openPicker = useCallback(async (slot: number) => {
    setPicker({ open: true, slot, query: "", results: [], loading: true });
    try {
      const res = await fetch(`/api/items${slot === -1 ? "" : ""}`);
      const data = (await res.json()) as { items: PickerItem[] };
      setPicker((current) => ({ ...current, results: data.items ?? [], loading: false }));
    } catch {
      setPicker((current) => ({ ...current, loading: false }));
    }
  }, []);

  const searchItems = useCallback(async (query: string) => {
    setPicker((current) => ({ ...current, query, loading: true }));
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/items?${params.toString()}`);
      const data = (await res.json()) as { items: PickerItem[] };
      setPicker((current) => ({ ...current, results: data.items ?? [], loading: false }));
    } catch {
      setPicker((current) => ({ ...current, loading: false }));
    }
  }, []);

  const cost = useMemo(
    () =>
      buildCost(
        build,
        Object.fromEntries(
          Object.entries(itemIndex).map(([slug, row]) => [slug, row.cost]),
        ),
      ),
    [build, itemIndex],
  );

  const cap = useMemo(
    () =>
      purchaseCapCheck(
        build,
        Object.values(itemIndex).map((row) => ({
          slug: row.slug,
          slotType: row.slotType,
          tier: row.tier,
        })),
      ),
    [build, itemIndex],
  );

  const loadPopular = useCallback(
    (window: "early" | "mid" | "late") => {
      const picks = popular[window];
      if (!picks.length) return;
      const items = Array.from({ length: TOTAL_SLOTS }, () => "");
      let slot = 0;
      for (const pick of picks) {
        if (slot >= TOTAL_SLOTS) break;
        const slug = slugForClassName(pick.className);
        if (!slug) continue;
        items[slot] = slug;
        slot += 1;
      }
      updateBuild((current) => ({ ...current, items }));
    },
    [popular, updateBuild],
  );

  const headlines = useMemo(() => headlineLines(readout), [readout]);
  const resists = useMemo(() => resistLines(readout), [readout]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* The board */}
      <div className="plate" style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--accent)",
              }}
            >
              Loadout
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
              {build.items.filter(Boolean).length} of {TOTAL_SLOTS} slots filled ·{" "}
              {cost.toLocaleString()} souls
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="chip"
              onClick={() => openPicker(-1)}
              style={{ cursor: "pointer", border: "none", font: "inherit" }}
            >
              Add item
            </button>
            <button
              type="button"
              className="chip"
              onClick={clearBuild}
              style={{ cursor: "pointer", border: "none", font: "inherit" }}
            >
              Reset
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 12,
          }}
        >
          {build.items.map((slug, index) => {
            const locked = index >= BASE_SLOTS;
            const row = slug ? itemIndex[slug] : null;
            const src = row ? itemImage(row) : null;

            return (
              <button
                key={index}
                type="button"
                disabled={locked}
                onClick={() => (locked ? undefined : openPicker(index))}
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
                  gap: 6,
                  alignContent: "start",
                  padding: 8,
                  textAlign: "left",
                  color: "inherit",
                  ...(row
                    ? {
                        ...themeStyle({
                          accent: row.accent,
                          accentText: row.accentText,
                          onAccent: row.onAccent,
                        }),
                        background: "var(--panel)",
                        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)",
                      }
                    : {
                        background: "#ffffff06",
                        boxShadow: "inset 0 0 0 1px var(--line)",
                      }),
                  clipPath:
                    "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.4 : 1,
                  minHeight: 124,
                }}
              >
                {row && src ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        flex: "0 0 auto",
                        display: "grid",
                        placeItems: "center",
                        background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                        clipPath:
                          "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                      }}
                    >
                      <Image
                        src={src}
                        alt=""
                        width={64}
                        height={64}
                        unoptimized
                        style={{ width: 52, height: 52, objectFit: "contain" }}
                      />
                    </div>
                    <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 13,
                          letterSpacing: "0.02em",
                          lineHeight: 1.3,
                          color: "#fff",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {row.name}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span className="tag">{slotLabel(row.slotType)}</span>
                        {row.tier ? <span className="tag-muted">Tier {row.tier}</span> : null}
                        {row.cost != null ? <span className="tag-muted">{costLabel(row.cost)}</span> : null}
                      </div>
                    </div>
                    {row.tier ? (
                      <span
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 10,
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent-text)",
                        }}
                      >
                        {row.tier}
                      </span>
                    ) : null}
                  </div>
                ) : locked ? (
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>LOCKED</span>
                ) : (
                  <span style={{ fontSize: 16, color: "var(--muted)", opacity: 0.5 }}>
                    +
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p
          style={{
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 10,
            lineHeight: 1.6,
          }}
        >
          {BASE_SLOTS} slots to start with; the last {TOTAL_SLOTS - BASE_SLOTS} unlock with
          team size. Any item can go in any slot, and duplicates are allowed.
        </p>

        {cap.over.length > 0 ? (
          <p
            style={{
              fontSize: 11,
              color: "var(--nerf)",
              marginTop: 8,
            }}
          >
            This build buys more than {cap.maxPerTier} of a tier in one slot
            type ({cap.over.map((o) => `${o.count}× tier ${o.tier} ${o.slotType}`).join(", ")}),
            which cannot be bought in a single match.
          </p>
        ) : null}
      </div>

      {/* Popular builds */}
      <div className="plate" style={{ padding: 16 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 8,
          }}
        >
          Popular with {heroName}
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          The API&apos;s pick rates for this hero. Loading one assembles a build
          from the top picks — it is an assembly, not a real loadout.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["early", "mid", "late"] as const).map((window) => (
            <button
              key={window}
              type="button"
              className="chip"
              onClick={() => loadPopular(window)}
              disabled={!popular[window].length}
              style={{
                cursor: popular[window].length ? "pointer" : "not-allowed",
                border: "none",
                font: "inherit",
                opacity: popular[window].length ? 1 : 0.4,
              }}
            >
              {window} game
            </button>
          ))}
        </div>
      </div>

      {/* The contrast view */}
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
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          <ContrastColumn
            title="Spirit power"
            subtitle="Scales spirit abilities"
            lines={readout.filter(
              (l) =>
                l.heroStat === "weapon_power" &&
                l.label.toLowerCase().includes("spirit"),
            )}
          />
          <ContrastColumn
            title="Weapon damage"
            subtitle="Scales gun abilities"
            lines={readout.filter(
              (l) =>
                l.heroStat === "weapon_power" &&
                l.label.toLowerCase().includes("weapon"),
            )}
          />
          <ContrastColumn
            title="Spirit resist"
            subtitle="Against spirit damage"
            lines={resists.spirit}
          />
          <ContrastColumn
            title="Bullet resist"
            subtitle="Against bullet damage"
            lines={resists.bullet}
          />
        </div>
        <p
          style={{
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 12,
            lineHeight: 1.6,
          }}
        >
          Spirit resist and bullet resist are separate: one only helps against
          the matching damage type, so a build can raise one and leave the
          other untouched.
        </p>
      </div>

      {/* The full readout */}
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
        <p style={{ margin: "0 0 14px", fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Computed from the API&apos;s stat values. The game applies hidden
          multipliers and thresholds that are not in the data, so these are a
          guide, not exact numbers.
        </p>

        {readout.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Add items to see their modifiers.
          </p>
        ) : (
          groupLines(readout, statMap).map(({ group, lines }) => (
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
              <div style={{ display: "grid", gap: 4 }}>
                {lines.map((line) => (
                  <StatRow key={line.key} line={line} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Abilities and their upgrade levels */}
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
        <p style={{ margin: "0 0 14px", fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Set each ability&apos;s upgrade level to read the same build at
          different points in the match.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {(["early", "mid", "late"] as const).map((stage) => (
            <button
              key={stage}
              type="button"
              className="chip"
              onClick={() =>
                updateBuild((current) => ({
                  ...current,
                  abilityLevels: abilities.map((a) => ({
                    slot: a.slot,
                    level:
                      stage === "early"
                        ? 0
                        : stage === "mid"
                          ? 1
                          : Math.min(2, upgradeTiers(a.ability.upgrades).length),
                  })),
                }))
              }
              style={{ cursor: "pointer", border: "none", font: "inherit" }}
            >
              {stage} game
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {abilityReadout.map((ability) => (
            <div
              key={ability.slot}
              style={{
                display: "grid",
                gridTemplateColumns: "64px 1fr",
                gap: 16,
                padding: 16,
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "#ffffff06",
                minHeight: 96,
              }}
            >
              <div style={{ display: "grid", placeItems: "center" }}>
                {ability.image ? (
                  <Image
                    src={ability.image}
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
                    {ability.name}
                  </span>
                  <div style={{ display: "flex", gap: 5 }}>
                    {Array.from({ length: ability.maxLevel + 1 }, (_, level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setAbilityLevel(ability.slot, level)}
                        aria-pressed={ability.level === level}
                        className={`chip${ability.level === level ? " active" : ""}`}
                        style={{
                          cursor: "pointer",
                          border: "none",
                          font: "inherit",
                          minHeight: 36,
                          padding: "6px 12px",
                          fontSize: 11,
                        }}
                      >
                        {level === 0 ? "BASE" : `T${level + 1}`}
                      </button>
                    ))}
                  </div>
                </div>

                {ability.lines.length === 0 ? (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--muted)" }}>
                    [no stat modifiers]
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 3, marginTop: 7 }}>
                    {ability.lines.map((line) => (
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
                          {line.total}
                          {line.postfix}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {ability.scaled.length > 0 ? (
                  <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--muted)" }}>
                    Scales with {ability.scaled[0].from || "your stats"} (coefficient{" "}
                    {ability.scaled[0].coefficient}).
                  </p>
                ) : ability.lines.length > 0 ? (
                  <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--muted)" }}>
                    Does not scale with spirit power or weapon damage.
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The picker */}
      {picker.open ? (
        <div
          role="dialog"
          aria-label="Choose an item"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPicker((c) => ({ ...c, open: false }));
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#000a",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            className="plate"
            style={{
              width: "min(720px, 100%)",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: 18,
              background: "#141824",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Choose an item
              </div>
              <button
                type="button"
                className="chip"
                onClick={() => setPicker((c) => ({ ...c, open: false }))}
                style={{ cursor: "pointer", border: "none", font: "inherit" }}
              >
                Close
              </button>
            </div>

            <input
              type="search"
              value={picker.query}
              onChange={(e) => void searchItems(e.target.value)}
              placeholder="Search items…"
              aria-label="Search items"
              className="search-field"
              style={{ width: "100%", marginBottom: 12 }}
            />

            {picker.loading ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
            ) : picker.results.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)" }}>No items found.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {picker.results.slice(0, 80).map((item) => {
                  const src = itemImage(item);
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => {
                        addItem(item.slug);
                        setPicker((c) => ({ ...c, open: false }));
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 10,
                        border: "1px solid var(--line)",
                        borderRadius: 10,
                        background: "#ffffff06",
                        cursor: "pointer",
                        textAlign: "left",
                        color: "inherit",
                      }}
                    >
                      {src ? (
                        <Image
                          src={src}
                          alt=""
                          width={40}
                          height={40}
                          unoptimized
                          style={{ width: 32, height: 32, objectFit: "contain" }}
                        />
                      ) : null}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "#fff" }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>
                          {slotLabel(item.slotType)}
                          {item.tier ? ` · Tier ${item.tier}` : ""}
                          {item.cost != null ? ` · ${costLabel(item.cost)}` : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
};

function StatRow({ line }: { line: StatLine }) {
  const total = statTotal(line);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "baseline",
        fontSize: 12,
        color: "#c3c5d4",
        padding: "2px 0",
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
        {line.base != null ? (
          <span style={{ color: "var(--muted)" }}>{line.base}</span>
        ) : null}
        {line.base != null ? (
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

function ContrastColumn({
  title,
  subtitle,
  lines,
}: {
  title: string;
  subtitle: string;
  lines: StatLine[];
}) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 12,
        padding: 12,
        background: "#ffffff05",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#fff",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, marginBottom: 9 }}>
        {subtitle}
      </div>
      {lines.length === 0 ? (
        <div style={{ fontSize: 11, color: "var(--muted)" }}>No change in this build.</div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {lines.map((line) => {
            const total = statTotal(line);
            return (
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
                  {line.total > 0 ? "+" : ""}
                  {line.total}
                  {line.postfix}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The item slug for an API class name.
 *
 * The ingest slugs an item by replacing underscores with hyphens and
 * keeping the whole class name, so `upgrade_acolytes_glove` becomes
 * `upgrade-acolytes-glove`.
 */
function slugForClassName(className: string): string {
  return className.replace(/_/g, "-");
}
