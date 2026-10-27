/**
 * Ability play data: max-first rates and typical upgrade behaviour.
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
 *   hero. It answers "when do people take each ability's first point, and
 *   what level does it end up at?".
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
  AbilityUpgradeTiming,
} from "@/lib/ability-play-data-format";
import type { RankBracket } from "@/lib/rank-brackets";

export type {
  AbilityMaxFirst,
  AbilityUpgradeTiming,
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
 * The typical upgrade behaviour for a hero's abilities, for a bracket.
 *
 * There is no single typical sequence — Abrams has thousands of distinct
 * ones, and the most common covers only 4.5% of players. So the rows are
 * aggregated two ways:
 *
 * - **First-point timing.** For each ability, take the time at which it
 *   first appears in each row, then take the median across rows. The
 *   median rather than the mean because a few players who take an ability
 *   very late would drag a mean far to the right.
 * - **Usual final level.** For each ability, count how many times it
 *   appears in a row — that is the level it ended at — and take the most
 *   common count, weighted by the row's player count.
 *
 * Both come off the same cached response, so one request answers both.
 *
 * **The unfiltered response is never fetched.** `ability-order-stats` with
 * no badge filter is 5 MB for one hero, and the API's `min_matches`
 * parameter does not help — at its lowest it answers with 114 MB in over
 * a minute. "All ranks" is therefore assembled from the four bracket
 * responses instead, which are 100–400 KB each.
 */
export async function getAbilityUpgradeTiming(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<AbilityUpgradeTiming[]> {
  const rows = await getAbilityOrderRows(heroApiId, bracket);
  if (rows.length === 0) return [];

  /*
   * Collect, per ability, the first-point time from each row and the final
   * level from each row.
   */
  const firstTimes = new Map<number, number[]>();
  const levelCounts = new Map<number, Map<number, number>>();

  for (const row of rows) {
    const { abilities, avg_upgrade_times_s: times, players } = row;
    if (!Array.isArray(abilities) || abilities.length === 0) continue;

    const seen = new Set<number>();
    for (let i = 0; i < abilities.length; i += 1) {
      const apiId = abilities[i];
      if (apiId == null) continue;

      // The first appearance in the row is the first point bought.
      if (!seen.has(apiId)) {
        seen.add(apiId);
        const time = times?.[i];
        if (typeof time === "number" && Number.isFinite(time)) {
          const list = firstTimes.get(apiId) ?? [];
          list.push(time);
          firstTimes.set(apiId, list);
        }
      }

      // The number of appearances in the row is the level it ended at.
      let level = 0;
      for (const other of abilities) {
        if (other === apiId) level += 1;
      }
      const levels = levelCounts.get(apiId) ?? new Map<number, number>();
      levels.set(level, (levels.get(level) ?? 0) + players);
      levelCounts.set(apiId, levels);
    }
  }

  const apiIds = [...firstTimes.keys()];
  if (apiIds.length === 0) return [];
  const names = await getAbilityNames(apiIds);

  const timings: AbilityUpgradeTiming[] = [];
  for (const apiId of apiIds) {
    const times = (firstTimes.get(apiId) ?? []).sort((a, b) => a - b);
    const levels = levelCounts.get(apiId) ?? new Map<number, number>();
    const levelTotal = [...levels.values()].reduce((s, v) => s + v, 0);

    let usualLevel = 0;
    let usualLevelPlayers = 0;
    for (const [level, count] of levels) {
      if (count > usualLevelPlayers) {
        usualLevel = level;
        usualLevelPlayers = count;
      }
    }

    const meta = names.get(String(apiId));
    timings.push({
      apiId,
      className: meta?.className ?? null,
      name: meta?.name ?? `ability ${apiId}`,
      // The median of an even-sized set is the mean of the two middle
      // values, which is the usual convention.
      medianFirstPointS: median(times),
      usualLevel,
      usualLevelPct: levelTotal > 0 ? (100 * usualLevelPlayers) / levelTotal : 0,
      totalRows: times.length,
    });
  }

  return timings.sort(
    (a, b) =>
      (a.medianFirstPointS ?? Number.POSITIVE_INFINITY) -
      (b.medianFirstPointS ?? Number.POSITIVE_INFINITY),
  );
}

/**
 * The median of a sorted list of numbers.
 *
 * The middle value for an odd-sized list, the mean of the two middle
 * values for an even-sized one.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return (values[mid - 1] + values[mid]) / 2;
}

/**
 * The average match duration for a bracket, in seconds.
 *
 * The upgrade timings are absolute times, so turning them into a stage
 * needs to know how long a match lasts. The API's `ability-order-stats`
 * does not carry it, so it comes from the flow endpoint's summary, which
 * does.
 *
 * Like the upgrade-order rows, "All ranks" is assembled from the four
 * bands rather than one unfiltered request, which would be 3 MB per hero.
 */
export async function getAvgMatchDuration(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<number> {
  const brackets =
    bracket.id === ALL_RANKS.id
      ? RANK_BRACKETS.filter((b) => b.id !== ALL_RANKS.id)
      : [bracket];

  let totalDuration = 0;
  let totalMatches = 0;

  for (const band of brackets) {
    try {
      const result = await getAnalytics<{
        summary: { matches: number; avg_duration_s: number } | null;
      }>("item-flow-stats", { hero_ids: heroApiId }, band);
      const summary = result.payload.summary;
      if (!summary) continue;
      totalDuration += summary.avg_duration_s * summary.matches;
      totalMatches += summary.matches;
    } catch {
      // A band that cannot be fetched simply does not contribute.
    }
  }

  if (totalMatches <= 0) return 0;
  return totalDuration / totalMatches;
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
