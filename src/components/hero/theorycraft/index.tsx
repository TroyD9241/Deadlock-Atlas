"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

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
import { buildReadout, heroStats as heroStatsFn, heroStatsByDisplayName } from "@/lib/stat-map";
import { upgradeTiers } from "@/lib/ability-upgrades";
import { abilityDamages, conditionOutcome } from "@/lib/damage";
import { statGlossary } from "@/lib/stat-glossary";

import { Abilities } from "./abilities";
import { Board } from "./board";
import { Picker } from "./picker";
import { Popular } from "./popular";
import { Procs } from "./procs";
import { StatRail } from "./stat-rail";

import type {
  Build,
  Highlight,
  HeroAbility,
  ItemIndexRow,
  PopularBuilds,
  StatMap,
} from "./types";
import type { ConditionOutcome } from "@/lib/damage";

/**
 * The theorycraft tool.
 *
 * The build is the only state: the items in the twelve wells and each
 * ability's upgrade level. It lives in the URL so a build can be shared,
 * and in localStorage so it survives a reload.
 *
 * The board and the stat rail are linked both ways. Hovering a stat
 * isolates the items that feed it; hovering an item isolates the stats it
 * contributes.
 */

type Props = {
  heroSlug: string;
  startingStats: unknown;
  abilities: HeroAbility[];
  popular: PopularBuilds;
  statMap: StatMap;
  /**
   * The build in the URL, read on the server.
   *
   * The board renders with its items on the first paint because of this,
   * rather than filling in a moment after the page loads.
   */
  initialBuild: Build;
  /** The items in that build, fetched on the server. */
  initialItems: Record<string, ItemIndexRow>;
  /** Whether the URL carried a build at all. */
  hasUrlBuild: boolean;
};

export function Theorycraft({
  heroSlug,
  startingStats,
  abilities,
  popular,
  statMap,
  initialBuild,
  initialItems,
  hasUrlBuild,
}: Props) {
  const glossary = useMemo(() => statGlossary(), []);
  const heroStats = useMemo(() => heroStatsFn(startingStats), [startingStats]);
  const [itemIndex, setItemIndex] = useState<Record<string, ItemIndexRow>>(
    initialItems,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [stage, setStage] = useState<"early" | "mid" | "late">("mid");

  const storedBuild = useStoredBuild(heroSlug);
  const [edited, setEdited] = useState<Build | null>(null);

  /*
   * The URL build wins, and it comes from the server, so the board is right
   * on the first paint. Storage is the fallback for a visit with no build in
   * the URL.
   */
  const build = edited ?? (hasUrlBuild ? initialBuild : storedBuild);

  /*
   * The mutators run on click, so they have to act on the build as it is at
   * that moment, not on the copy captured when the callback was made. The
   * store refreshes a tick after hydration, so a click in that window would
   * otherwise be applied to an empty build.
   */
  const buildRef = useRef(build);
  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  /*
   * The URL and the saved build are written when the user changes the build,
   * not when the page loads: on load the URL is the source of truth, and
   * writing it back would race the browser's own read of it.
   */
  const updateBuild = useCallback(
    (next: (current: Build) => Build) => {
      setEdited((current) => {
        const base = current ?? buildRef.current;
        return next(base);
      });
    },
    [],
  );

  useEffect(() => {
    if (!edited) return;
    if (typeof window !== "undefined") {
      const params = buildParams(edited);
      const search = params.toString();
      const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
      window.history.replaceState(null, "", url);
      writeStoredBuild(heroSlug, edited);
    }
  }, [edited, heroSlug]);

  /*
   * The board only needs the items that are in the build. The whole shop is
   * 1.4MB of properties, so it is fetched for the twelve wells rather than
   * for everything — and re-fetched when the build changes.
   *
   * The server already fetched the URL build's items, so the first request
   * is skipped: the key it would ask for is the one it already has.
   */
  const buildSlugs = useMemo(
    () => [...new Set(build.items.filter(Boolean))].sort(),
    [build.items],
  );
  const slugsKey = buildSlugs.join(",");
  const fetchedKey = useRef(
    [...new Set(initialBuild.items.filter(Boolean))].sort().join(","),
  );

  useEffect(() => {
    if (fetchedKey.current === slugsKey) return;
    fetchedKey.current = slugsKey;
    let cancelled = false;
    void fetch(`/api/items?slugs=${encodeURIComponent(slugsKey)}`)
      .then((res) => res.json())
      .then((data: { items?: { slug: string }[] }) => {
        if (cancelled) return;
        const index: Record<string, ItemIndexRow> = {};
        for (const item of (data.items ?? []) as ItemIndexRow[]) {
          index[item.slug] = item;
        }
        setItemIndex(index);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [slugsKey]);

  const addItem = useCallback(
    (slug: string) => {
      updateBuild((current) => {
        const items = [...current.items];
        const empty = items.indexOf("");
        if (empty >= 0) items[empty] = slug;
        else items[TOTAL_SLOTS - 1] = slug;
        return { ...current, items };
      });
      setPickerOpen(false);
    },
    [updateBuild],
  );

  const removeItem = useCallback(
    (slot: number) => {
      updateBuild((current) => {
        const items = [...current.items];
        items[slot] = "";
        return { ...current, items };
      });
    },
    [updateBuild],
  );

  const clearBuild = useCallback(() => {
    updateBuild(() => emptyBuild());
    setPinned(null);
  }, [updateBuild]);

  const setAbilityLevel = useCallback(
    (slot: string, level: number) => {
      updateBuild((current) => {
        const levels = current.abilityLevels.filter((l) => l.slot !== slot);
        if (level > 0) levels.push({ slot, level });
        return { ...current, abilityLevels: levels };
      });
    },
    [updateBuild],
  );

  const setAbilityStage = useCallback(
    (next: "early" | "mid" | "late") => {
      updateBuild((current) => ({
        ...current,
        abilityLevels: abilities.map((a) => ({
          slot: a.slot,
          level:
            next === "early"
              ? 0
              : next === "mid"
                ? 1
                : Math.min(2, upgradeTiers(a.ability.upgrades).length),
        })),
      }));
    },
    [abilities, updateBuild],
  );

  const loadPopular = useCallback(
    (which: "early" | "mid" | "late") => {
      const picks = popular[which];
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

  // The readout, computed from the items in the build.
  const readoutBuildItems = useMemo(() => {
    return build.items
      .filter(Boolean)
      .map((slug) => {
        const row = itemIndex[slug];
        if (!row) return null;
        return { slug, name: row.name, properties: row.properties };
      })
      .filter((x): x is { slug: string; name: string; properties: unknown } => !!x);
  }, [build.items, itemIndex]);

  const readout = useMemo(() => {
    return buildReadout(readoutBuildItems, heroStatsFn(startingStats), statMap);
  }, [readoutBuildItems, startingStats, statMap]);

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

  // The pick rate of each item in the build, for the popular markers.
  const buildPicks = useMemo(() => {
    const picks: Record<string, number> = {};
    for (const list of Object.values(popular)) {
      for (const pick of list) {
        const slug = slugForClassName(pick.className);
        if (build.items.includes(slug)) picks[slug] = pick.pickPct;
      }
    }
    return picks;
  }, [popular, build.items]);

  const abilityLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    for (const level of build.abilityLevels) levels[level.slot] = level.level;
    return levels;
  }, [build.abilityLevels]);

  const procs = useMemo(() => {
    const buildItems = build.items
      .filter(Boolean)
      .map((slug) => {
        const row = itemIndex[slug];
        if (!row) return null;
        return { slug, name: row.name, properties: row.properties };
      })
      .filter((x): x is { slug: string; name: string; properties: unknown } => !!x);

    const dmg = abilityDamages(abilities, buildItems);
    const conditions = statMap.conditions ?? {};
    const outcomes: ConditionOutcome[] = [];

    for (const item of buildItems) {
      const cond = conditions[item.slug];
      if (!cond) continue;
      outcomes.push(conditionOutcome(cond, item.properties, dmg));
    }

    return outcomes;
  }, [build.items, itemIndex, abilities, statMap]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 360px)",
        gap: 18,
        alignItems: "start",
      }}
    >
      {/* The left column: the board and everything that feeds it. */}
      <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
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
                  fontFamily: "var(--font-body)",
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
                {build.items.filter(Boolean).length} of {TOTAL_SLOTS} slots
                filled · {cost.toLocaleString()} souls
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="chip"
                onClick={() => setPickerOpen(true)}
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

          <Board
            items={build.items}
            itemIndex={itemIndex}
            statMap={statMap}
            highlight={highlight}
            onHighlight={setHighlight}
            onOpenPicker={() => setPickerOpen(true)}
            onRemove={removeItem}
          />

          <p
            style={{
              fontSize: 10,
              color: "var(--muted)",
              marginTop: 12,
              marginBottom: 0,
              lineHeight: 1.6,
            }}
          >
            {BASE_SLOTS} slots to start with; the last{" "}
            {TOTAL_SLOTS - BASE_SLOTS} unlock with team size. Any item can go
            in any slot, and duplicates are allowed. Hover a well to isolate
            the stats it changes.
          </p>

          {cap.over.length > 0 ? (
            <p style={{ fontSize: 11, color: "var(--nerf)", marginTop: 8 }}>
              This build buys more than {cap.maxPerTier} of a tier in one slot
              type (
              {cap.over
                .map((o) => `${o.count}× tier ${o.tier} ${o.slotType}`)
                .join(", ")}
              ), which cannot be bought in a single match.
            </p>
          ) : null}
        </div>

        <Procs outcomes={procs} />

        <Popular
          popular={popular}
          stage={stage}
          onStage={setStage}
          onLoad={loadPopular}
          buildPicks={buildPicks}
        />

        <Abilities
          abilities={abilities}
          statMap={statMap}
          displayNames={heroStatsByDisplayName(startingStats)}
          levels={abilityLevels}
          onSetLevel={setAbilityLevel}
          onSetStage={setAbilityStage}
          items={readoutBuildItems}
        />
      </div>

      {/* The right column: the stats, always on screen. */}
      <div style={{ position: "sticky", top: 80, minWidth: 0 }}>
        <StatRail
          lines={readout}
          statMap={statMap}
          highlight={highlight}
          onHighlight={setHighlight}
          pinned={pinned}
          onPinned={setPinned}
          glossary={glossary}
          heroStats={heroStats}
        />
      </div>

      <Picker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addItem}
        statMap={statMap}
      />
    </div>
  );
}

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

/**
 * The item slug for an API class name.
 *
 * The ingest slugs an item by replacing underscores with hyphens and keeping
 * the whole class name, so `upgrade_acolytes_glove` becomes
 * `upgrade-acolytes-glove`.
 */
function slugForClassName(className: string): string {
  return className.replace(/_/g, "-");
}
