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

/**
 * The base for the build endpoints.
 *
 * The build definitions live outside `/v1/analytics` — they are published
 * content rather than aggregates — so they have their own base and their
 * own cache entries.
 */
export const BUILDS_BASE = "https://api.deadlock-api.com/v1/builds";

/** How long a cached response stays fresh. The data moves daily, not hourly. */
export const ANALYTICS_TTL_MS = 24 * 60 * 60 * 1000;

/** One item's statistics. */
export type ItemStat = {
  item_id: number;
  /**
   * The group the row falls in.
   *
   * Usually zero. With `bucket=game_time_min` it is the minute of the
   * match the item was bought in, which is what the build phases are
   * derived from.
   */
  bucket: number;
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

/**
 * One item in a build's phase.
 *
 * The field is named `ability_id` but holds an **item** id — the same ids
 * the item endpoints use.
 */
export type BuildMod = {
  ability_id: number;
  /** The author's note on the item, if any. */
  annotation: string | null;
  required_flex_slots: string | null;
  sell_priority: string | null;
  imbue_target_ability_id: number | null;
};

/** One phase of a build — "EARLY GAME", "MID GAME", and so on. */
export type BuildModCategory = {
  name: string;
  width: number | null;
  height: number | null;
  description: string | null;
  mods: BuildMod[];
  /** True for the alternative set, the items the author suggests instead. */
  optional: boolean | null;
};

/** One ability point spent, in the build's skill order. */
export type BuildAbilityPoint = {
  ability_id: number;
  currency_type: number;
  /** How many points went in at once: 1, 2 or 5. */
  delta: number;
  annotation: string | null;
};

/** A build's definition. */
export type HeroBuild = {
  hero_id: number;
  hero_build_id: number;
  author_account_id: number;
  last_updated_timestamp: number;
  publish_timestamp: number;
  /** The name the author gave it. May be in any language. */
  name: string;
  description: string | null;
  /** Valve's language code. 0 is English. */
  language: number;
  version: number;
  origin_build_id: number;
  /** The item ids the author tagged as this build's core. */
  tags: number[];
  details: {
    mod_categories: BuildModCategory[];
    ability_order: { currency_changes: BuildAbilityPoint[] } | null;
  };
};

/** The endpoint wrapper the builds come in. */
export type HeroBuildResponse = {
  hero_build: HeroBuild;
  num_favorites: number | null;
  num_ignores: number | null;
  num_reports: number | null;
  num_weekly_favorites: number | null;
  rollup_category: string | null;
};

/**
 * One point on a performance curve.
 *
 * The curve is sampled at regular points across the match, with the average
 * and spread of every metric at each one.
 */
export type PerformancePoint = {
  /** The point in the match, as a percentage unless the resolution was 0. */
  game_time: number;
  net_worth_avg: number;
  net_worth_std: number;
  kills_avg: number;
  deaths_avg: number;
  assists_avg: number;
  player_damage_avg: number;
  /** How many players the point was measured over. */
  samples: number;
};

/** The endpoints this client knows about. */
export type AnalyticsEndpoint =
  | "item-stats"
  | "item-flow-stats"
  | "hero-stats"
  | "ability-max-first-stats"
  | "ability-order-stats"
  | "hero-build-stats"
  | "player-performance-curve";

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
 * How long an analytics request may take before it is abandoned.
 *
 * The API occasionally takes a long time on a cold cache — an unfiltered
 * `item-stats` has timed out at the gateway before. A page should not hang
 * waiting for it, so the request is abandoned and the cached payload (or
 * nothing) is used instead.
 */
export const ANALYTICS_TIMEOUT_MS = 20_000;

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
    signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
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

/**
 * The item purchase flow for a hero.
 *
 * This is the heaviest endpoint: about 3 MB for one hero with no rank
 * filter. It takes `hero_ids`, not `hero_id`.
 */
export function fetchItemFlowStats(
  heroId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<ItemFlowStats> {
  return fetchAnalytics<ItemFlowStats>(
    "item-flow-stats",
    { hero_ids: heroId },
    bracket,
  );
}

/** The item purchase flow graph, as the API returns it. */
export type ItemFlowStats = {
  nodes: {
    column: number;
    item_id: number;
    wins: number;
    losses: number;
    matches: number;
    players: number;
    adjusted_win_rate: number;
    avg_net_worth_at_buy: number;
  }[];
  edges: {
    from_column: number;
    from_item_id: number;
    to_item_id: number;
    wins: number;
    losses: number;
    matches: number;
  }[];
  summary: {
    wins: number;
    losses: number;
    matches: number;
    players: number;
    avg_duration_s: number;
  } | null;
};

/** The community's named builds for a hero. */
export function fetchHeroBuildStats(
  heroId: number,
  bracket: RankBracket = ALL_RANKS,
  options: { minMatches?: number } = {},
): Promise<HeroBuildStat[]> {
  return fetchAnalytics<HeroBuildStat[]>(
    "hero-build-stats",
    { min_matches: options.minMatches },
    bracket,
    `/${heroId}`,
  );
}

/**
 * A build's definition.
 *
 * This one is **not** under `/v1/analytics` — the build definitions are
 * published content rather than aggregates — so it has its own base and its
 * own fetch.
 *
 * The definition is fetched per build id, never from the list endpoint.
 * The list's `only_latest` filter returns 100 distinct builds but none of
 * the top popular ones, because the stats reference specific *versions*
 * and the filter drops the version the stats point at.
 */
export async function fetchHeroBuild(
  heroId: number,
  buildId: number,
): Promise<HeroBuildResponse> {
  const response = await fetch(`${BUILDS_BASE}/${heroId}/${buildId}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AnalyticsApiError(
      "hero-build",
      response.status,
      await response.text(),
    );
  }

  return (await response.json()) as HeroBuildResponse;
}