/**
 * Ability play data: max-first rates and the most common build orders.
 *
 * SERVER CODE ONLY. Reads the database and calls the API through the cache,
 * so it must never be imported from a `"use client"` file.
 *
 * The two endpoints have different shapes and different denominators, and
 * they are deliberately kept apart:
 *
 * - **`ability-max-first-stats`** is small — five rows, one per ability.
 *   It answers "what did people max first?", and its percentages are
 *   relative to the four identified abilities.
 * - **`ability-order-stats`** is the heavy one. It gives the whole sequence
 *   of upgrade points a player spent, thousands of distinct sequences per
 *   hero. It answers "in what order do people take them?".
 *
 * See the M11c plan in `DEADLOCK_SITE_PLAN.md` for the verified details.
 */

import { db } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { ALL_RANKS, RANK_BRACKETS } from "@/lib/rank-brackets";

import type {
  AbilityMaxFirstStat,
  AbilityOrderStat,
} from "@/lib/deadlock-api";
import type {
  AbilityMaxFirst,
  BuildOrder,
} from "@/lib/ability-play-data-format";
import type { RankBracket } from "@/lib/rank-brackets";

export type {
  AbilityMaxFirst,
  BuildOrder,
} from "@/lib/ability-play-data-format";
export {
  stageFor,
  stageForSeconds,
  stageLabel,
  timeLabel,
} from "@/lib/ability-play-data-format";
export type { MatchStage } from "@/lib/ability-play-data-format";

/**
 * The ability's max-first rate, for a bracket.
 *
 * The API returns exactly four identified abilities plus one row with a
 * null `ability_id` — a player whose first-maxed ability the API could not
 * identify. That row carries 2–3.4% of players and is **excluded** rather
 * than averaged in, because there is no ability to attribute it to.
 *
 * The denominator is the sum of the four identified rows, so the
 * percentages say "of the players whose first-maxed ability we know, this
 * share maxed this one". The API's own `players` field is `uniq(account_id)`
 * — distinct people, not matches — so the figures are a share of players.
 *
 * Only hero-specific abilities ever appear here. The universal ones
 * (Jump, Slide, Mantle, Sprint and the rest) are not in the response at
 * all, so there is no risk of "Jump was maxed first by 40% of players".
 */
export async function getAbilityMaxFirst(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<AbilityMaxFirst[]> {
  let rows: AbilityMaxFirstStat[];
  try {
    const result = await getAnalytics<AbilityMaxFirstStat[]>(
      "ability-max-first-stats",
      { hero_id: heroApiId },
      bracket,
    );
    rows = result.payload;
  } catch {
    // Play data is a layer over the page, not the page itself.
    return [];
  }

  const identified = rows.filter((row) => row.ability_id != null);
  if (identified.length === 0) return [];

  const denominator = identified.reduce((sum, row) => sum + row.players, 0);
  if (denominator <= 0) return [];

  const names = await getAbilityNames(
    identified.map((row) => row.ability_id as number),
  );

  return identified
    .map((row) => {
      const meta = names.get(String(row.ability_id));
      return {
        apiId: row.ability_id as number,
        className: meta?.className ?? null,
        name: meta?.name ?? `ability ${row.ability_id}`,
        sharePct: (100 * row.players) / denominator,
        players: row.players,
      };
    })
    .sort((a, b) => b.sharePct - a.sharePct);
}

/**
 * The number of players the max-first percentages are relative to.
 *
 * This is the sum of the identified rows. It is the sample size behind the
 * figures, so it is worth showing alongside them.
 */
export async function getAbilityMaxFirstSample(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<number> {
  try {
    const result = await getAnalytics<AbilityMaxFirstStat[]>(
      "ability-max-first-stats",
      { hero_id: heroApiId },
      bracket,
    );
    return result.payload
      .filter((row) => row.ability_id != null)
      .reduce((sum, row) => sum + row.players, 0);
  } catch {
    return 0;
  }
}

/**
 * The upgrade-order rows for a hero and a bracket.
 *
 * For a single bracket this is one request. For **"All ranks"** it is four
 * — one per band — because the unfiltered response is unusable: 5 MB for
 * one hero, and 114 MB at the API's lowest `min_matches`.
 *
 * The four bands partition the ladder, so between them they cover the same
 * matches the unfiltered response would. The rows are simply concatenated:
 * the aggregation below is over players, not over rows, and each row
 * carries its own player count, so the extra rows from four brackets
 * weight correctly.
 */
export async function getAbilityOrderRows(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<AbilityOrderStat[]> {
  const brackets =
    bracket.id === ALL_RANKS.id
      ? RANK_BRACKETS.filter((b) => b.id !== ALL_RANKS.id)
      : [bracket];

  const results = await Promise.all(
    brackets.map(async (band) => {
      try {
        const result = await getAnalytics<AbilityOrderStat[]>(
          "ability-order-stats",
          { hero_id: heroApiId },
          band,
        );
        return result.payload;
      } catch {
        return [] as AbilityOrderStat[];
      }
    }),
  );

  return results.flat();
}

/**
 * The most common build orders for a hero, for a bracket.
 *
 * The API's raw sequence is the full list of upgrade points — an ability
 * repeated once per tier bought — so it is 15 entries for a hero with four
 * abilities at four levels each, and there are thousands of distinct
 * sequences per hero. The most common one covers under 5% of players, so
 * there is no "the" build order.
 *
 * What collapses is the order each ability was **first taken** in. That
 * gives 4–8 distinct orders per hero, and the top three cover 67–100% of
 * players (mean 96.6% across all 44 heroes). It is also the form a reader
 * can act on: "Power Surge, then Static Charge, then Lightning Ball".
 *
 * The order is on first-taken position, so levelling the same ability
 * twice does not move it.
 *
 * **The unfiltered response is never fetched.** `ability-order-stats` with
 * no badge filter is 5 MB for one hero, and the API's `min_matches`
 * parameter does not help — at its lowest it answers with 114 MB in over
 * a minute. "All ranks" is therefore assembled from the four bracket
 * responses instead, which are 100–400 KB each.
 */
export async function getBuildOrders(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<BuildOrder[]> {
  const rows = await getAbilityOrderRows(heroApiId, bracket);
  if (rows.length === 0) return [];

  /*
   * Group the rows by their first-taken order, weighted by the row's
   * player count.
   */
  const grouped = new Map<string, { apiIds: number[]; players: number }>();

  for (const row of rows) {
    const { abilities, players } = row;
    if (!Array.isArray(abilities) || abilities.length === 0) continue;

    const seen = new Set<number>();
    const order: number[] = [];
    for (const apiId of abilities) {
      if (apiId == null || seen.has(apiId)) continue;
      seen.add(apiId);
      order.push(apiId);
    }
    if (order.length === 0) continue;

    const key = order.join(">");
    const entry = grouped.get(key) ?? { apiIds: order, players: 0 };
    entry.players += players;
    grouped.set(key, entry);
  }

  const total = [...grouped.values()].reduce((sum, e) => sum + e.players, 0);
  if (total <= 0) return [];

  return [...grouped.values()]
    .map((entry) => ({
      apiIds: entry.apiIds,
      sharePct: (100 * entry.players) / total,
      players: entry.players,
    }))
    .sort((a, b) => b.players - a.players);
}

/**
 * The names for a set of API ability ids.
 *
 * The analytics response is keyed by the API's numeric id for the
 * ability, which our `Ability.apiId` stores — the same field the items
 * use.
 */
export async function getAbilityNames(
  apiIds: number[],
): Promise<Map<string, { className: string; name: string }>> {
  const unique = [...new Set(apiIds.map(String))];
  if (unique.length === 0) return new Map();

  const abilities = await db.ability.findMany({
    where: { apiId: { in: unique } },
    select: { apiId: true, className: true, name: true },
  });
  return new Map(
    abilities.map((a) => [
      String(a.apiId),
      { className: a.className, name: a.name },
    ]),
  );
}
