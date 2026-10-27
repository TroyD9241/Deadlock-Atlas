/**
 * Play data for items and heroes, resolved against the database.
 *
 * SERVER CODE ONLY. This module reads the database and calls the API through
 * the cache, so it must never be imported from a `"use client"` file.
 *
 * The API's analytics rows are keyed by numeric ids (`item_id`, `hero_id`)
 * that have no name in them. This module turns those ids into the site's
 * own items and heroes, computes the derived figures, and hands back plain
 * data that a component can render without knowing any of this.
 *
 * The pick rate is **computed**, never taken from the API: see
 * `pickRatePct` below for why.
 */

import { db } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { ALL_RANKS } from "@/lib/rank-brackets";
import { pickRatePct, winRatePct } from "@/lib/play-data-format";

import type { ItemPlayData } from "@/lib/play-data-format";
import type { HeroStat, ItemStat } from "@/lib/deadlock-api";
import type { RankBracket } from "@/lib/rank-brackets";

export {
  buyStageFor,
  buyStageLabel,
  buyTimeLabel,
  pickRatePct,
  winRatePct,
} from "@/lib/play-data-format";
export type { BuyStage, ItemPlayData } from "@/lib/play-data-format";

/**
 * The minimum number of matches an item needs before its numbers are shown.
 *
 * The API's own `min_matches` parameter does the same thing on its side:
 * it filters the aggregated rows. The default is deliberately low, because
 * the API's figures are aggregated over a long window, so even a few
 * hundred matches is a stable sample for an item.
 */
export const DEFAULT_MIN_MATCHES = 50;

/**
 * The minimum for a roster-wide query.
 *
 * An unfiltered `item-stats` is the whole item-by-hero matrix, and at 50
 * it is large enough that the API's gateway times out on it (a 504). At 60
 * it comes back in about 40 KB; 100 is used here because an item bought in
 * fewer than 100 matches across the entire roster is not worth showing
 * anyway, and the margin against the timeout is worth having.
 *
 * Hero-scoped queries are small and have no such limit, which is why this
 * is only applied when no heroes were asked for.
 */
export const ROSTER_MIN_MATCHES = 100;

/**
 * The pick rate of an item, as a percentage.
 *
 * The API's own `popular_items.pick_pct` has an undocumented denominator
 * and no per-bracket variant, so it cannot answer the question the page
 * asks. Ours is `item-stats.players` over `hero-stats.matches`: the share
 * of a hero's matches in which the item was bought.
 *
 * `item-stats.matches` is the wrong denominator — a match has several
 * players, so dividing by it yields 35–91% where the real figure is
 * 10–19%.
 */

/**
 * The win rate of an item, as a percentage.
 *
 * Shown, but never sortable: a high win rate reflects who buys the item
 * rather than the item's effect (design.md, the play-data note).
 */

/**
 * The play data for every item the API knows about, for a bracket.
 *
 * The API's `item-stats` covers every hero at once when no `hero_ids` is
 * given, so this is one request rather than one per hero. The denominator
 * is the sum of every hero's matches, which is what "the share of matches
 * in which this item was bought" means across the whole roster.
 *
 * When a single hero is given, the denominator is that hero's matches, and
 * the figure is the share of *that hero's* matches.
 */
export async function getItemPlayData(
  bracket: RankBracket = ALL_RANKS,
  options: { heroIds?: number[]; minMatches?: number } = {},
): Promise<ItemPlayData[]> {
  const heroIds = options.heroIds;
  const minMatches =
    options.minMatches ?? (heroIds ? DEFAULT_MIN_MATCHES : ROSTER_MIN_MATCHES);

  const params: Record<string, string | number | undefined> = {
    hero_ids: heroIds?.join(","),
    min_matches: minMatches,
  };

  let stats: ItemStat[];
  try {
    const result = await getAnalytics<ItemStat[]>("item-stats", params, bracket);
    stats = result.payload;
  } catch {
    // Play data is a layer over the page, not the page itself. If the API
    // is unreachable and nothing is cached, the page renders without it.
    return [];
  }

  if (stats.length === 0) return [];

  // The denominator: the hero's matches.
  let heroMatches = 0;
  try {
    const heroResult = await getAnalytics<HeroStat[]>("hero-stats", {}, bracket);
    const rows = heroResult.payload;
    heroMatches = heroIds
      ? rows
          .filter((h) => heroIds.includes(h.hero_id))
          .reduce((sum, h) => sum + h.matches, 0)
      : rows.reduce((sum, h) => sum + h.matches, 0);
  } catch {
    // Without the denominator there is no pick rate, so there is nothing
    // to show. Returning nothing is better than showing a wrong number.
    return [];
  }

  if (heroMatches <= 0) return [];

  // Resolve the numeric ids into the site's own items.
  const apiIds = stats.map((s) => String(s.item_id));
  const items = await db.item.findMany({
    where: { apiId: { in: apiIds } },
    select: {
      apiId: true,
      slug: true,
      name: true,
      slotType: true,
      tier: true,
      image: true,
      imageWebp: true,
    },
  });
  const byApiId = new Map(items.map((i) => [String(i.apiId), i]));

  const resolved: ItemPlayData[] = [];
  for (const stat of stats) {
    const item = byApiId.get(String(stat.item_id));
    resolved.push({
      apiId: stat.item_id,
      slug: item?.slug ?? null,
      name: item?.name ?? `item ${stat.item_id}`,
      slotType: item?.slotType ?? null,
      tier: item?.tier ?? null,
      image: item?.image ?? null,
      imageWebp: item?.imageWebp ?? null,
      pickRatePct: pickRatePct(stat.players, heroMatches),
      winRatePct: winRatePct(stat.wins, stat.losses),
      matches: stat.matches,
      players: stat.players,
      avgBuyTimeS: stat.avg_buy_time_s,
      avgSellTimeS: stat.avg_sell_time_s,
      avgBuyTimeRelative: stat.avg_buy_time_relative,
      avgSellTimeRelative: stat.avg_sell_time_relative,
      sold: stat.sold,
    });
  }

  return resolved;
}

/**
 * The play data for one hero's items.
 *
 * The pick rate is the share of *that hero's* matches in which the item was
 * bought, so the denominator is the hero's own match count.
 */
export async function getHeroItemPlayData(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
  options: { minMatches?: number } = {},
): Promise<ItemPlayData[]> {
  return getItemPlayData(bracket, {
    heroIds: [heroApiId],
    minMatches: options.minMatches ?? DEFAULT_MIN_MATCHES,
  });
}

/** The play data for one item, across every hero. */
export async function getItemPlayDataByApiId(
  itemApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<ItemPlayData | null> {
  const all = await getItemPlayData(bracket);
  return all.find((row) => row.apiId === itemApiId) ?? null;
}

/**
 * The hero's match count, for a bracket.
 *
 * This is the pick-rate denominator, and it is also the honest way to say
 * how big the sample behind a number is.
 */
export async function getHeroMatches(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<number> {
  try {
    const result = await getAnalytics<HeroStat[]>("hero-stats", {}, bracket);
    const row = result.payload.find((h) => h.hero_id === heroApiId);
    return row?.matches ?? 0;
  } catch {
    return 0;
  }
}
