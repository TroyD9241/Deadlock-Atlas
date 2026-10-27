/**
 * Build play data: the builds players use, ranked by how well they do.
 *
 * SERVER CODE ONLY. Reads the database and calls the API through the cache,
 * so it must never be imported from a `"use client"` file.
 *
 * The ranking is deliberately **not** by popularity. The most used build
 * for a hero is often slightly *below* that hero's own average — for
 * Abrams the most popular build wins 54.7% against his 54.8% baseline,
 * while a build used by 276 players wins 63.0%. Popularity and quality are
 * different things, and a site that ranks by popularity is endorsing
 * whatever the crowd happened to pick.
 *
 * So the ranking is by the **edge over the hero's baseline**, and a build
 * is only called better or worse than average when the edge is bigger
 * than the noise in its own win rate.
 */

import { db } from "@/lib/db";
import { getAnalytics, getCachedUrl } from "@/lib/analytics";
import { ALL_RANKS } from "@/lib/rank-brackets";
import { BUILDS_BASE } from "@/lib/deadlock-api";

import type {
  HeroBuild,
  HeroBuildStat,
  ItemStat,
  PerformancePoint,
} from "@/lib/deadlock-api";
import type {
  BuildCurvePoint,
  BuildDetail,
  BuildPhase,
  BuildPlayData,
  HeroBaseline,
} from "@/lib/build-play-data-format";
import type { RankBracket } from "@/lib/rank-brackets";

export type {
  BuildCurvePoint,
  BuildDetail,
  BuildPhase,
  BuildPlayData,
  HeroBaseline,
} from "@/lib/build-play-data-format";
export {
  edgeLabel,
  edgePp,
  isNonEnglishName,
  secondsLabel,
  standardErrorPp,
} from "@/lib/build-play-data-format";

/**
 * The fewest matches a build needs before it is listed.
 *
 * Below this the win rate carries too much noise to rank on. At 250
 * matches the standard error is about 3 points, which is the same size as
 * the gap between a good build and a bad one — so a lower floor would
 * rank noise.
 *
 * Every hero has between 27 and 102 builds clearing it in all ranks, and
 * between 2 and 16 in a single bracket.
 */
export const MIN_BUILD_MATCHES = 250;

/**
 * The detail for the builds worth showing in full.
 *
 * Only the top few are resolved, because the net worth curve is 29 KB
 * each and the item timings are 1.3 MB each. The timings are only fetched
 * when a reader asks for a build's phases.
 */
export async function getBuildDetails(
  heroApiId: number,
  buildIds: number[],
  bracket: RankBracket = ALL_RANKS,
): Promise<Map<number, BuildDetail>> {
  const details = new Map<number, BuildDetail>();
  await Promise.all(
    buildIds.map(async (buildId) => {
      const detail = await getBuildDetail(heroApiId, buildId, bracket);
      if (detail) details.set(buildId, detail);
    }),
  );
  return details;
}

/**
 * The item slugs for a build's core items, for the load link.
 *
 * The build model in the URL is a list of item slugs, so the ids have to
 * be resolved to slugs first.
 */
export async function getBuildItemSlugs(
  itemIds: number[],
): Promise<string[]> {
  if (itemIds.length === 0) return [];
  const items = await db.item.findMany({
    where: { apiId: { in: itemIds.map(String) } },
    select: { apiId: true, slug: true },
  });
  const byApiId = new Map(items.map((i) => [String(i.apiId), i.slug]));

  // Keep the order the items were ranked in.
  return itemIds
    .map((id) => byApiId.get(String(id)))
    .filter((slug): slug is string => !!slug);
}

/**
 * The hero's baseline: the win rate it averages over every match.
 *
 * A build's edge is measured against this, not against 50%.
 */
export async function getHeroBaseline(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<HeroBaseline | null> {
  try {
    const result = await getAnalytics<{
      hero_id: number;
      wins: number;
      losses: number;
      matches: number;
    }[]>("hero-stats", {}, bracket);

    const row = result.payload.find((h) => h.hero_id === heroApiId);
    if (!row || row.matches <= 0) return null;

    return {
      winRatePct: (100 * row.wins) / (row.wins + row.losses),
      matches: row.matches,
      wins: row.wins,
      losses: row.losses,
    };
  } catch {
    return null;
  }
}

/**
 * A build's definition, its curve and its phases.
 *
 * The phases here are the **author's** labels — "EARLY GAME" and so on.
 * The phases derived from the match data are separate, and are only
 * available once the item timings have been fetched.
 */
export async function getBuildDetail(
  heroApiId: number,
  buildId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<BuildDetail | null> {
  const build = await getBuildDefinition(heroApiId, buildId);
  if (!build) return null;

  const curve = await getBuildCurve(heroApiId, buildId, bracket);

  const authorPhases = (build.details.mod_categories ?? []).map((cat) => ({
    label: cat.name,
    itemIds: (cat.mods ?? []).map((m) => m.ability_id),
    optional: cat.optional === true,
  }));

  /*
   * The skill order is a list of ability points spent, and `delta` says
   * how many went in at once — so one entry can be five points. The order
   * is the ability ids repeated by their delta, which is what the
   * theorycraft tool's `up` parameter wants.
   */
  const skillOrder: number[] = [];
  for (const change of build.details.ability_order?.currency_changes ?? []) {
    for (let i = 0; i < Math.abs(change.delta); i += 1) {
      skillOrder.push(change.ability_id);
    }
  }

  /*
   * The imbue targets are the abilities the build's items get applied to.
   */
  const imbueTargets: number[] = [];
  for (const cat of build.details.mod_categories ?? []) {
    for (const mod of cat.mods ?? []) {
      if (mod.imbue_target_ability_id == null) continue;
      if (!imbueTargets.includes(mod.imbue_target_ability_id)) {
        imbueTargets.push(mod.imbue_target_ability_id);
      }
    }
  }

  const coreItemIds = await getBuildCoreItems(heroApiId, buildId, bracket);

  return {
    buildId,
    name: build.name,
    nonEnglish: isNonEnglish(build.name),
    coreItemIds,
    authorPhases,
    skillOrder,
    imbueTargets,
    curve,
  };
}

/**
 * The items players actually bought while using a build.
 *
 * This is the build's real contents, taken from the match data rather than
 * from the guide. The guide's phases are the author's own notes and do
 * not have a consistent shape, so they cannot be used to pick a loadable
 * set out.
 *
 * The item ids are resolved against the **items** table. Ability ids live
 * in the same numeric space, so the two must not be mixed.
 */
async function getBuildCoreItems(
  heroApiId: number,
  buildId: number,
  bracket: RankBracket,
): Promise<number[]> {
  try {
    /*
     * Through the cache. This is the heavy response — 1.3 MB for one hero
     * and build — so it is fetched once and kept.
     */
    const result = await getAnalytics<ItemStat[]>(
      "item-stats",
      {
        hero_ids: heroApiId,
        hero_build_id: buildId,
        min_matches: 1,
        bucket: "game_time_min",
      },
      bracket,
    );
    const rows = result.payload;
    if (rows.length === 0) return [];

    /*
     * The rows are one per item per minute, so the players have to be
     * added up across the minutes before the items can be ranked.
     */
    const playersByItem = new Map<number, number>();
    for (const row of rows) {
      playersByItem.set(
        row.item_id,
        (playersByItem.get(row.item_id) ?? 0) + row.players,
      );
    }

    const ids = [...playersByItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id]) => id);

    /*
     * Only ids that are really items. An ability id would slip through
     * otherwise, and it would be offered as a loadout slot.
     */
    const ours = await db.item.findMany({
      where: { apiId: { in: ids.map(String) } },
      select: { apiId: true },
    });
    const oursSet = new Set(ours.map((i) => String(i.apiId)));

    return ids.filter((id) => oursSet.has(String(id)));
  } catch {
    return [];
  }
}

/**
 * The builds for a hero, ranked by their edge over the baseline.
 *
 * Only builds with enough matches are listed, and only those whose edge
 * clears their own standard error are marked as better or worse.
 */
export async function getRankedBuilds(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
  options: { minMatches?: number; limit?: number } = {},
): Promise<{ builds: BuildPlayData[]; baseline: HeroBaseline | null }> {
  const minMatches = options.minMatches ?? MIN_BUILD_MATCHES;
  const limit = options.limit ?? 10;

  const baseline = await getHeroBaseline(heroApiId, bracket);

  let stats: HeroBuildStat[];
  try {
    const result = await getAnalytics<HeroBuildStat[]>(
      "hero-build-stats",
      { min_matches: minMatches },
      bracket,
      { pathSuffix: `/${heroApiId}` },
    );
    stats = result.payload;
  } catch {
    return { builds: [], baseline };
  }

  const eligible = stats.filter((row) => row.matches >= minMatches);
  if (eligible.length === 0) return { builds: [], baseline };

  /*
   * The build's definition is fetched per build id. The list endpoint's
   * `only_latest` filter cannot be used: the stats reference specific
   * versions and the filter drops the version the stats point at, so
   * none of the popular builds are in the list it returns.
   *
   * Only the top few are fetched — the definition is 7 KB each, and the
   * panel shows a handful.
   */
  const ranked = eligible
    .map((row) => {
      const winRatePct = (100 * row.wins) / (row.wins + row.losses);
      const edge = baseline ? winRatePct - baseline.winRatePct : 0;
      const stdErr = standardErrorFor(winRatePct, row.matches);
      return { row, winRatePct, edge, stdErr };
    })
    .sort((a, b) => b.edge - a.edge);

  const top = ranked.slice(0, limit);

  const names = await Promise.all(
    top.map(async ({ row }) => {
      const build = await getBuildDefinition(heroApiId, row.hero_build_id);
      return {
        buildId: row.hero_build_id,
        name: build?.name ?? `build ${row.hero_build_id}`,
      };
    }),
  );
  const nameById = new Map(names.map((n) => [n.buildId, n.name]));

  const builds: BuildPlayData[] = top.map(({ row, winRatePct, edge, stdErr }) => {
    const name = nameById.get(row.hero_build_id) ?? `build ${row.hero_build_id}`;
    return {
      buildId: row.hero_build_id,
      name,
      nonEnglish: isNonEnglish(name),
      players: row.players,
      matches: row.matches,
      winRatePct,
      edgePp: edge,
      stdErrPp: stdErr,
      significant: Math.abs(edge) > stdErr,
    };
  });

  return { builds, baseline };
}

/** The standard error of a win rate, in percentage points. */
function standardErrorFor(winRatePct: number, matches: number): number {
  if (matches <= 0) return 0;
  const p = winRatePct / 100;
  return Math.sqrt((p * (1 - p)) / matches) * 100;
}

/** Whether a name is in the Latin alphabet. */
function isNonEnglish(name: string): boolean {
  return /[^\x00-\x7F]/.test(name);
}

/**
 * A build's definition, through the cache.
 *
 * Returns null when the build cannot be fetched — the panel then shows the
 * build's id rather than nothing.
 */
export async function getBuildDefinition(
  heroApiId: number,
  buildId: number,
): Promise<HeroBuild | null> {
  const url = `${BUILDS_BASE}/${heroApiId}/${buildId}`;
  try {
    const result = await getCachedUrl<{ hero_build: HeroBuild }>(
      "hero-build-definition",
      url,
    );
    return result.payload.hero_build ?? null;
  } catch {
    return null;
  }
}

/**
 * A build's net worth curve.
 *
 * The curve is cumulative net worth sampled across the match, so it always
 * rises — the shape of the rise is the power spike.
 */
export async function getBuildCurve(
  heroApiId: number,
  buildId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<BuildCurvePoint[]> {
  try {
    /*
     * Through the cache, like every other analytics read. The curve is
     * 29 KB and the response is the same every time, so it does not need
     * to be fetched again.
     */
    const result = await getAnalytics<PerformancePoint[]>(
      "player-performance-curve",
      {
        hero_ids: heroApiId,
        hero_build_id: buildId,
        resolution: 10,
      },
      bracket,
    );
    return result.payload.map((p) => ({
      atPct: p.game_time,
      netWorth: p.net_worth_avg,
      samples: p.samples,
    }));
  } catch {
    return [];
  }
}

/**
 * The hero's own curve, for comparison against a build's.
 *
 * A build that is behind the hero's average at every point is not a good
 * build, whatever its win rate says.
 */
export async function getHeroCurve(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<BuildCurvePoint[]> {
  try {
    const result = await getAnalytics<PerformancePoint[]>(
      "player-performance-curve",
      { hero_ids: heroApiId, resolution: 10 },
      bracket,
    );
    return result.payload.map((p) => ({
      atPct: p.game_time,
      netWorth: p.net_worth_avg,
      samples: p.samples,
    }));
  } catch {
    return [];
  }
}

/**
 * The phases of a build, derived from when its items are bought and sold.
 *
 * The **author's** phase labels are not used for this. They are one
 * person's opinion and they vary between builds — one calls a group "CORE
 * ITEMS", another "Core Build", another "Defensive Core", and most call
 * it something else entirely. The boundaries are measured.
 *
 * The signal is the **cumulative** net flow of items. At the start of a
 * match players **sell** their starter items before they buy anything, so
 * the balance starts below zero; then buys dominate as they build up,
 * which is the power spike; and at the end the flow flattens because the
 * build is finished.
 *
 * Measured on build 722319, the cumulative balance:
 *
 * ```
 *   minute 0: -252       minute 3: +9,325      minute 21: peak
 *   minute 1: -5,595     minute 5: +16,031     minute 40: +7,633
 *   minute 2:   +144  <- crosses zero here
 * ```
 *
 * So the phases are:
 * - **early** — up to where the balance crosses zero. The swap: players
 *   clearing their starter items.
 * - **mid** — from there to where the buying-up tails off. The spike.
 * - **late** — after that. The finished build.
 *
 * The **cumulative** figure is used rather than the per-minute one
 * because the per-minute flow is noisy: on a small build the first minute
 * can swing either way on a handful of players, while the running
 * balance is stable.
 */
export function derivePhases(
  timings: {
    bucket: number;
    players: number;
    sold: number;
  }[],
): BuildPhase[] {
  if (timings.length === 0) return [];

  /*
   * The buys and sells per minute, from the bucketed item stats. The
   * bucket is the minute the item was bought in, and the sell count is
   * the items sold in that bucket.
   */
  const perMinute = new Map<
    number,
    { bought: number; sold: number }
  >();

  for (const row of timings) {
    const minute = Math.max(0, Math.floor(row.bucket));
    const entry = perMinute.get(minute) ?? { bought: 0, sold: 0 };
    entry.bought += row.players;
    if (row.sold > 0) entry.sold += row.sold;
    perMinute.set(minute, entry);
  }

  const minutes = [...perMinute.keys()].sort((a, b) => a - b);
  if (minutes.length === 0) return [];

  /*
   * The **cumulative** net flow, not the per-minute one.
   *
   * The per-minute flow is noisy — on a small build the first minute can
   * swing either way on a handful of players. The cumulative figure is
   * the running balance, and it is negative through the early game on
   * every build large enough to measure: players sell their starter
   * items before they buy anything, so the balance starts below zero
   * and crosses it when the buying-up starts.
   *
   * Measured, the cumulative balance crosses zero at minute 2 for the
   * biggest builds and minute 4-5 for the smaller ones.
   */
  let cumulative = 0;
  const flow = minutes.map((minute) => {
    const entry = perMinute.get(minute)!;
    cumulative += entry.bought - entry.sold;
    return {
      minute,
      ...entry,
      net: entry.bought - entry.sold,
      cumulative,
    };
  });

  /*
   * The early game ends when the cumulative balance crosses zero — the
   * moment the players have sold what they had and start buying up.
   *
   * A build too small to show the swap crosses zero at the first minute,
   * which would leave an empty early phase. The boundary is held at one
   * minute so the phase always covers something.
   */
  const crossing = flow.find((f) => f.cumulative > 0)?.minute;
  const earlyEnd = Math.max(crossing ?? 1, 1);

  /*
   * The mid game ends when the buying-up is over.
   *
   * The peak of the net flow is not the boundary — the flow stays high for
   * a while after it, and the match runs on well past it. The boundary is
   * where the net flow has fallen back to a small fraction of its peak,
   * which is the point after which players are no longer building up and
   * are just finishing the build.
   */
  let peak = earlyEnd;
  let peakNet = 0;
  for (const f of flow) {
    if (f.minute < earlyEnd) continue;
    if (f.net > peakNet) {
      peakNet = f.net;
      peak = f.minute;
    }
  }

  /*
   * A fifth of the peak is the threshold: past it the build is done.
   * The floor stops the boundary collapsing onto the peak itself when the
   * flow is flat.
   */
  const threshold = Math.max(peakNet * 0.2, 1);
  const afterPeak = flow.filter((f) => f.minute > peak);
  const midEnd =
    afterPeak.find((f) => f.net < threshold)?.minute ??
    afterPeak[afterPeak.length - 1]?.minute ??
    peak;

  const phases: BuildPhase[] = [];
  const bounds: { id: "early" | "mid" | "late"; label: string; from: number; to: number | null }[] =
    [
      { id: "early", label: "Early", from: 0, to: earlyEnd * 60 },
      { id: "mid", label: "Mid", from: earlyEnd * 60, to: midEnd * 60 },
      { id: "late", label: "Late", from: midEnd * 60, to: null },
    ];

  for (const bound of bounds) {
    let bought = 0;
    let sold = 0;
    for (const f of flow) {
      if (f.minute * 60 < bound.from) continue;
      if (bound.to != null && f.minute * 60 >= bound.to) continue;
      bought += f.bought;
      sold += f.sold;
    }
    phases.push({
      id: bound.id,
      label: bound.label,
      fromS: bound.from,
      toS: bound.to,
      bought,
      sold,
    });
  }

  return phases;
}

/**
 * A build's item timings, bucketed by the minute.
 *
 * This is the heavy response — about 1.3 MB for one hero and build — so
 * it is only fetched when a reader asks for a build's detail.
 */
export async function getBuildPhases(
  heroApiId: number,
  buildId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<BuildPhase[]> {
  try {
    const result = await getAnalytics<ItemStat[]>(
      "item-stats",
      {
        hero_ids: heroApiId,
        hero_build_id: buildId,
        min_matches: 1,
        bucket: "game_time_min",
      },
      bracket,
    );
    return derivePhases(
      result.payload.map((r) => ({
        bucket: r.bucket,
        players: r.players,
        sold: r.sold,
      })),
    );
  } catch {
    return [];
  }
}
