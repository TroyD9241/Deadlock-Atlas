/**
 * Verify the analytics cache (M11a).
 *
 * The cache is the reason the site can use a rate-limited public API, so it
 * is checked rather than assumed:
 *
 *   1. A read fetches from the API and stores the payload.
 *   2. The next read is served from the cache — no second network call.
 *   3. The same request written with its parameters in a different order
 *      hits the same cache row.
 *   4. The rank bracket filter actually changes the numbers, and the
 *      narrower bracket has fewer matches.
 *   5. The pick rate — item-stats players over hero-stats matches — lands in
 *      a plausible band.
 *
 * Run with: npx tsx scripts/verify-analytics.ts
 */

import { db } from "@/lib/db";
import { clearAnalyticsCache, getAnalytics, listAnalyticsCache } from "@/lib/analytics";
import { fetchAnalytics, hashParams } from "@/lib/deadlock-api";
import {
  ALL_RANKS,
  DEFAULT_BRACKET,
  RANK_BRACKETS,
  bracketById,
  bracketFromParam,
} from "@/lib/rank-brackets";

import type { HeroStat, ItemStat } from "@/lib/deadlock-api";

/** The hero used for the checks. Hero 2 is Abrams. */
const HERO_ID = 2;
const HERO_IDS = [HERO_ID];

/** How many network calls a fetch made. */
let networkCalls = 0;

const countingFetch = (async <T>(
  endpoint: Parameters<typeof fetchAnalytics>[0],
  params: Parameters<typeof fetchAnalytics>[1],
  bracket?: Parameters<typeof fetchAnalytics>[2],
  pathSuffix?: string,
): Promise<T> => {
  networkCalls += 1;
  return fetchAnalytics<T>(endpoint, params, bracket, pathSuffix);
}) as typeof fetchAnalytics;

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  console.log("Analytics cache verification\n");

  // Start from a clean cache so the first read is definitely a miss.
  const cleared = await clearAnalyticsCache();
  console.log(`Cleared ${cleared} cached responses.\n`);

  // ---------------------------------------------------------------------
  console.log("1. A cold read fetches and stores");
  networkCalls = 0;
  const first = await getAnalytics<ItemStat[]>(
    "item-stats",
    { hero_ids: HERO_IDS.join(","), min_matches: 50 },
    ALL_RANKS,
    { fetchImpl: countingFetch },
  );
  check("the network was used", networkCalls === 1, `${networkCalls} call`);
  check("the payload has rows", first.payload.length > 0, `${first.payload.length} items`);
  check("the result is not stale", first.stale === false);

  const cacheAfterFirst = await listAnalyticsCache();
  check(
    "one row was stored",
    cacheAfterFirst.length === 1,
    `${cacheAfterFirst.length} rows`,
  );

  // ---------------------------------------------------------------------
  console.log("\n2. The next read is served from the cache");
  networkCalls = 0;
  const second = await getAnalytics<ItemStat[]>(
    "item-stats",
    { hero_ids: HERO_IDS.join(","), min_matches: 50 },
    ALL_RANKS,
    { fetchImpl: countingFetch },
  );
  check("the network was not used", networkCalls === 0, `${networkCalls} calls`);
  check(
    "the stored timestamp did not move",
    second.fetchedAt.getTime() === first.fetchedAt.getTime(),
  );
  check("the row count did not grow", (await listAnalyticsCache()).length === 1);

  // ---------------------------------------------------------------------
  console.log("\n3. Parameter order does not create a second row");
  const hashA = hashParams({ hero_ids: "2", min_matches: 50 });
  const hashB = hashParams({ min_matches: 50, hero_ids: "2" });
  check("the hash is order-independent", hashA === hashB, hashA);

  networkCalls = 0;
  await getAnalytics<ItemStat[]>(
    "item-stats",
    { min_matches: 50, hero_ids: "2" },
    ALL_RANKS,
    { fetchImpl: countingFetch },
  );
  check("the reordered request hit the cache", networkCalls === 0);
  check("no extra row was created", (await listAnalyticsCache()).length === 1);

  // ---------------------------------------------------------------------
  console.log("\n4. The rank bracket filter changes the numbers");
  const topBracket = bracketById("phantom-eternus");
  const top = await getAnalytics<ItemStat[]>(
    "item-stats",
    { hero_ids: HERO_IDS.join(","), min_matches: 50 },
    topBracket,
    { fetchImpl: countingFetch },
  );
  const allMatches = first.payload.reduce((sum, item) => sum + item.matches, 0);
  const topMatches = top.payload.reduce((sum, item) => sum + item.matches, 0);
  check(
    "the narrow bracket has fewer matches",
    topMatches > 0 && topMatches < allMatches,
    `${topMatches.toLocaleString()} vs ${allMatches.toLocaleString()}`,
  );
  check(
    "the two brackets have separate cache rows",
    (await listAnalyticsCache()).length === 2,
  );
  check(
    "the bracket id is stored on the row",
    (await listAnalyticsCache()).some((row) => row.rankBracket === "phantom-eternus"),
  );

  // ---------------------------------------------------------------------
  console.log("\n5. The pick rate is plausible");
  const heroStats = await getAnalytics<HeroStat[]>("hero-stats", {}, topBracket, {
    fetchImpl: countingFetch,
  });
  const hero = heroStats.payload.find((h) => h.hero_id === HERO_ID);
  check("the hero has matches", (hero?.matches ?? 0) > 0, `${hero?.matches} matches`);

  if (hero && hero.matches > 0) {
    const rates = top.payload
      .map((item) => ({
        item,
        rate: (100 * item.players) / hero.matches,
      }))
      .sort((a, b) => b.rate - a.rate);

    const topRate = rates[0]?.rate ?? 0;
    const worstRate = rates[rates.length - 1]?.rate ?? 0;
    check(
      "every rate is between 0 and 100",
      rates.every((r) => r.rate >= 0 && r.rate <= 100),
      `top ${topRate.toFixed(1)}%, lowest ${worstRate.toFixed(1)}%`,
    );
    check(
      "the top pick rate is a plausible band",
      topRate > 1 && topRate < 60,
      `${topRate.toFixed(1)}%`,
    );

    console.log("\n  Top picks at the top bracket:");
    for (const { item, rate } of rates.slice(0, 5)) {
      const minutes = Math.floor(item.avg_buy_time_s / 60);
      const seconds = Math.round(item.avg_buy_time_s % 60);
      console.log(
        `    item ${item.item_id}: ${rate.toFixed(1)}% picked, ` +
          `bought at ${minutes}:${String(seconds).padStart(2, "0")} ` +
          `(${item.avg_buy_time_relative.toFixed(0)}% into the match)`,
      );
    }
  }

  // ---------------------------------------------------------------------
  console.log("\n6. A failed fetch falls back to the stored payload");
  const failingFetch = (async () => {
    throw new Error("network is down");
  }) as typeof fetchAnalytics;

  // Force a stale row by backdating it, then read with a fetch that fails.
  await db.analyticsSnapshot.updateMany({
    where: { endpoint: "item-stats", rankBracket: "phantom-eternus" },
    data: { fetchedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
  });

  const stale = await getAnalytics<ItemStat[]>(
    "item-stats",
    { hero_ids: HERO_IDS.join(","), min_matches: 50 },
    topBracket,
    { fetchImpl: failingFetch },
  );
  check("the stale payload was served", stale.stale === true);
  check("the stale payload still has rows", stale.payload.length > 0);

  // ---------------------------------------------------------------------
  console.log("\n7. The brackets are well formed");
  const ranged = RANK_BRACKETS.filter((b) => b.id !== ALL_RANKS.id);
  let contiguous = true;
  for (let i = 1; i < ranged.length; i += 1) {
    if (ranged[i].minBadge !== ranged[i - 1].maxBadge + 1) contiguous = false;
  }
  check("the badge ranges are contiguous", contiguous);
  check(
    "the ranges cover the whole ladder",
    ranged[0].minBadge === 10 && ranged[ranged.length - 1].maxBadge === 116,
  );
  check(
    "the shares add up to about 100%",
    Math.abs(ranged.reduce((sum, b) => sum + b.sharePct, 0) - 100) < 0.5,
    `${ranged.reduce((sum, b) => sum + b.sharePct, 0).toFixed(1)}%`,
  );
  check(
    "an unknown rank parameter falls back to the default bracket",
    bracketFromParam("not-a-bracket").id === DEFAULT_BRACKET.id,
    DEFAULT_BRACKET.label,
  );
  check(
    "a missing rank parameter falls back to the default bracket",
    bracketFromParam(null).id === DEFAULT_BRACKET.id,
  );
  check(
    "the default bracket is a ranked band, not all ranks",
    DEFAULT_BRACKET.id !== ALL_RANKS.id,
    DEFAULT_BRACKET.label,
  );
  check(
    "all ranks is still reachable as an explicit choice",
    bracketFromParam("all").id === ALL_RANKS.id,
  );
  check(
    "the four bands cover the ladder contiguously",
    ranged.every(
      (band, i) =>
        i === 0 ||
        (ranged[i - 1].maxBadge + 1 === band.minBadge &&
          band.minBadge <= band.maxBadge),
    ),
    ranged.map((b) => `${b.minBadge}-${b.maxBadge}`).join(", "),
  );

  // ---------------------------------------------------------------------
  console.log("\n8. The cache contents");
  for (const row of await listAnalyticsCache()) {
    console.log(
      `    ${row.endpoint} [${row.rankBracket}] ` +
        `${(row.bytes / 1024).toFixed(1)} KB, fetched ${row.fetchedAt.toISOString()}`,
    );
  }

  console.log(
    failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
