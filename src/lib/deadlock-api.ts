/**
 * The Deadlock API's analytics endpoints.
 *
 * SERVER CODE ONLY. This module opens network connections and must never be
 * imported from a `"use client"` file. The cache in `analytics.ts` is the
 * only thing the app calls; this module is underneath it.
 *
 * The host is `api.deadlock-api.com` — the same one the assets ingest uses
 * (`scripts/ingest/api.ts`). Note that `api.deadlock.com` is a different
 * host and does not resolve.
 *
 * Every endpoint here is rate-limited: 200 requests per minute per IP, 400
 * per key, 2000 globally. The cache in `analytics.ts` exists because of
 * that, and because `item-flow-stats` is a 1.7 MB response for one hero.
 */

import { badgeRangeFor, ALL_RANKS } from "@/lib/rank-brackets";

import type { RankBracket } from "@/lib/rank-brackets";

export const ANALYTICS_BASE = "https://api.deadlock-api.com/v1/analytics";

/** How long a cached response stays fresh. The data moves daily, not hourly. */
export const ANALYTICS_TTL_MS = 24 * 60 * 60 * 1000;

/** One item's statistics. */
export type ItemStat = {
  item_id: number;
  wins: number;
  losses: number;
  matches: number;
  /** Players who bought the item. */
  players: number;
  /** Average seconds into the match the item was bought. */
  avg_buy_time_s: number;
  avg_sell_time_s: number;
  /** Average percentage into the match the item was bought. */
  avg_buy_time_relative: number;
  avg_sell_time_relative: number;
  sold: number;
};

/** One hero's totals. The pick-rate denominator. */
export type HeroStat = {
  hero_id: number;
  wins: number;
  losses: number;
  matches: number;
  matches_per_bucket: number;
};

/** One ability's "maxed first" statistics. */
export type AbilityMaxFirstStat = {
  /** Null when the ability could not be identified. */
  ability_id: number | null;
  wins: number;
  losses: number;
  matches: number;
  players: number;
};

/** One ability upgrade order, with the timing of each point spent. */
export type AbilityOrderStat = {
  /** The ability ids in the order they were upgraded. */
  abilities: number[];
  /** The average time in seconds at which each point was spent. */
  avg_upgrade_times_s: number[];
  wins: number;
  losses: number;
  matches: number;
  players: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
};

/** One of the community's named builds for a hero. */
export type HeroBuildStat = {
  hero_build_id: number;
  hero_id: number;
  bucket: number;
  wins: number;
  losses: number;
  matches: number;
  players: number;
};

/** The endpoints this client knows about. */
export type AnalyticsEndpoint =
  | "item-stats"
  | "hero-stats"
  | "ability-max-first-stats"
  | "ability-order-stats"
  | "hero-build-stats";

/** Raised when the API answers with an error status. */
export class AnalyticsApiError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`Deadlock API ${endpoint} responded ${status}: ${body.slice(0, 300)}`);
    this.name = "AnalyticsApiError";
  }
}

/**
 * The query parameters a request takes.
 *
 * The badge bounds are added from the bracket, so a caller never sets them
 * by hand and two different brackets can never collide on the same key.
 */
export type AnalyticsParams = Record<string, string | number | undefined>;

/**
 * A stable hash of the request's parameters.
 *
 * The parameters are sorted, so the same request written in a different
 * order hashes the same and hits the same cache row.
 */
export function hashParams(params: AnalyticsParams): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries.map(([key, value]) => `${key}=${value}`).join("&");
}

/**
 * The full query string for a request, bracket included.
 *
 * `hero-build-stats` takes the hero in the path rather than the query, so it
 * is handled separately by its own fetcher.
 */
export function buildQuery(
  params: AnalyticsParams,
  bracket: RankBracket,
): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    query.set(key, String(value));
  }

  const range = badgeRangeFor(bracket);
  if (range) {
    query.set("min_average_badge", String(range.min));
    query.set("max_average_badge", String(range.max));
  }

  return query;
}

/**
 * Fetch a payload from an analytics endpoint.
 *
 * The badge filter is applied from the bracket. `hero-build-stats` is the
 * one endpoint with a path parameter, so it takes the hero id separately.
 */
export async function fetchAnalytics<T>(
  endpoint: AnalyticsEndpoint,
  params: AnalyticsParams,
  bracket: RankBracket = ALL_RANKS,
  pathSuffix = "",
): Promise<T> {
  const query = buildQuery(params, bracket);
  const search = query.toString();
  const url = `${ANALYTICS_BASE}/${endpoint}${pathSuffix}${search ? `?${search}` : ""}`;

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    // The API's own cache headers are not used: our cache decides freshness.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new AnalyticsApiError(endpoint, response.status, await response.text());
  }

  return (await response.json()) as T;
}

/** Item statistics, filtered by hero and bracket. */
export function fetchItemStats(
  params: { heroIds?: number[]; minMatches?: number },
  bracket: RankBracket = ALL_RANKS,
): Promise<ItemStat[]> {
  return fetchAnalytics<ItemStat[]>(
    "item-stats",
    {
      hero_ids: params.heroIds?.join(","),
      min_matches: params.minMatches,
    },
    bracket,
  );
}

/** Per-hero totals. This is the pick-rate denominator. */
export function fetchHeroStats(
  bracket: RankBracket = ALL_RANKS,
): Promise<HeroStat[]> {
  return fetchAnalytics<HeroStat[]>("hero-stats", {}, bracket);
}

/** Which ability each player maxed first. */
export function fetchAbilityMaxFirstStats(
  heroId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<AbilityMaxFirstStat[]> {
  return fetchAnalytics<AbilityMaxFirstStat[]>(
    "ability-max-first-stats",
    { hero_id: heroId },
    bracket,
  );
}

/**
 * The ability upgrade orders for a hero.
 *
 * This is the heaviest endpoint: 5 MB for one hero with no rank filter, and
 * it shrinks as the rank filter narrows. It always needs the cache.
 */
export function fetchAbilityOrderStats(
  heroId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<AbilityOrderStat[]> {
  return fetchAnalytics<AbilityOrderStat[]>(
    "ability-order-stats",
    { hero_id: heroId },
    bracket,
  );
}

/** The community's named builds for a hero. */
export function fetchHeroBuildStats(
  heroId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<HeroBuildStat[]> {
  return fetchAnalytics<HeroBuildStat[]>(
    "hero-build-stats",
    {},
    bracket,
    `/${heroId}`,
  );
}
