/**
 * The analytics cache.
 *
 * SERVER CODE ONLY. This module reads and writes the database and opens
 * network connections, so it must never be imported from a `"use client"`
 * file.
 *
 * The Deadlock API rate-limits at 200 requests per minute per IP, and
 * `item-flow-stats` is a 1.7 MB response for a single hero. Every read
 * therefore goes through `AnalyticsSnapshot` rather than straight to the
 * network:
 *
 *   1. Look up the row for `(endpoint, paramsHash, rankBracket)`.
 *   2. If it exists and is within the TTL, return the stored payload.
 *   3. Otherwise fetch from the API, upsert the row, and return it.
 *
 * The refresh is lazy: nothing is fetched until something asks for it, and
 * then only once per TTL. A failed fetch falls back to the stored payload
 * even when it is stale, because a stale number beats no number.
 */

import { db } from "@/lib/db";
import { ALL_RANKS } from "@/lib/rank-brackets";
import {
  ANALYTICS_TTL_MS,
  fetchAnalytics,
  hashParams,
} from "@/lib/deadlock-api";

import { Prisma } from "@/generated/prisma/client";

import type { AnalyticsEndpoint, AnalyticsParams } from "@/lib/deadlock-api";
import type { RankBracket } from "@/lib/rank-brackets";

/**
 * Raised when a request has no stored payload and the API could not be
 * reached. The caller shows "play data unavailable" rather than a zero.
 */
export class AnalyticsUnavailableError extends Error {
  constructor(
    readonly endpoint: string,
    readonly cause?: unknown,
  ) {
    super(`Play data for ${endpoint} is unavailable.`);
    this.name = "AnalyticsUnavailableError";
  }
}

/** A cached payload and where it came from. */
export type AnalyticsResult<T> = {
  payload: T;
  /** When the payload was fetched from the API. */
  fetchedAt: Date;
  /** True when the API could not be reached and the stored payload was used. */
  stale: boolean;
};

/**
 * Read an analytics endpoint through the cache.
 *
 * The fetch is injectable so a test can count how many times the network is
 * actually touched.
 */
export async function getAnalytics<T>(
  endpoint: AnalyticsEndpoint,
  params: AnalyticsParams,
  bracket: RankBracket = ALL_RANKS,
  options: {
    pathSuffix?: string;
    /** Overrides the network call. Used by the verification script. */
    fetchImpl?: typeof fetchAnalytics;
  } = {},
): Promise<AnalyticsResult<T>> {
  const paramsHash = hashParams(params);

  const stored = await db.analyticsSnapshot.findUnique({
    where: {
      endpoint_paramsHash_rankBracket: {
        endpoint,
        paramsHash,
        rankBracket: bracket.id,
      },
    },
  });

  const isFresh =
    stored != null && Date.now() - stored.fetchedAt.getTime() < ANALYTICS_TTL_MS;

  if (stored && isFresh) {
    return {
      payload: stored.payload as T,
      fetchedAt: stored.fetchedAt,
      stale: false,
    };
  }

  try {
    const doFetch = options.fetchImpl ?? fetchAnalytics;
    const payload = await doFetch<T>(
      endpoint,
      params,
      bracket,
      options.pathSuffix,
    );

    const saved = await db.analyticsSnapshot.upsert({
      where: {
        endpoint_paramsHash_rankBracket: {
          endpoint,
          paramsHash,
          rankBracket: bracket.id,
        },
      },
      // The payload shape can change between API versions, so the stored row
      // is replaced rather than merged.
      create: {
        endpoint,
        paramsHash,
        rankBracket: bracket.id,
        payload: payload as Prisma.InputJsonValue,
      },
      update: {
        payload: payload as Prisma.InputJsonValue,
        fetchedAt: new Date(),
      },
    });

    return { payload, fetchedAt: saved.fetchedAt, stale: false };
  } catch (error) {
    // A failed fetch must not take the page down. If there is a stored
    // payload, serve it and say it is stale.
    if (stored) {
      return {
        payload: stored.payload as T,
        fetchedAt: stored.fetchedAt,
        stale: true,
      };
    }
    throw new AnalyticsUnavailableError(endpoint, error);
  }
}

/**
 * The cached payload only, with no fetch.
 *
 * Used where a missing figure is acceptable — a panel that can be absent
 * rather than a page that must not fail.
 */
export async function getCachedAnalytics<T>(
  endpoint: AnalyticsEndpoint,
  params: AnalyticsParams,
  bracket: RankBracket = ALL_RANKS,
): Promise<T | null> {
  const paramsHash = hashParams(params);
  const stored = await db.analyticsSnapshot.findUnique({
    where: {
      endpoint_paramsHash_rankBracket: {
        endpoint,
        paramsHash,
        rankBracket: bracket.id,
      },
    },
  });
  return stored ? (stored.payload as T) : null;
}

/**
 * Drop every cached response.
 *
 * Used by the verification script and by a manual refresh.
 */
export async function clearAnalyticsCache(): Promise<number> {
  const result = await db.analyticsSnapshot.deleteMany();
  return result.count;
}

/**
 * The cached responses, newest first.
 *
 * Useful for seeing what the cache holds and how fresh it is.
 */
export async function listAnalyticsCache(): Promise<
  Array<{
    endpoint: string;
    paramsHash: string;
    rankBracket: string;
    fetchedAt: Date;
    bytes: number;
  }>
> {
  const rows = await db.analyticsSnapshot.findMany({
    orderBy: { fetchedAt: "desc" },
    select: {
      endpoint: true,
      paramsHash: true,
      rankBracket: true,
      fetchedAt: true,
      payload: true,
    },
  });

  return rows.map((row) => ({
    endpoint: row.endpoint,
    paramsHash: row.paramsHash,
    rankBracket: row.rankBracket,
    fetchedAt: row.fetchedAt,
    bytes: JSON.stringify(row.payload).length,
  }));
}
