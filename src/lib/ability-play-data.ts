/**
 * Ability play data: max-first rates, level spreads and upgrade order.
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
 *   hero. It answers "what level does each ability end up at?" and "what
 *   order do people take them in?".
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
  AbilityLevelSpread,
  AbilityMaxFirst,
  AbilityOrder,
  AbilityTransition,
} from "@/lib/ability-play-data-format";
import type { RankBracket } from "@/lib/rank-brackets";

export type {
  AbilityLevelSpread,
  AbilityMaxFirst,
  AbilityOrder,
  AbilityTransition,
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
 * The level spread for a hero's abilities, for a bracket.
 *
 * An ability's **level** is the number of times it appears in a player's
 * upgrade sequence — one appearance per point bought. So the level spread
 * is the distribution of final levels, weighted by player count.
 *
 * The distribution is what matters, not the mode. The most common final
 * level is level 4 for every ability of every hero, so a "usual level"
 * says nothing; the spread does. For Abrams at the top bracket:
 *
 * ```
 * Power Surge    L4 100%                            avg 3.97
 * Storm Cloud    L3 8%,  L4 90%                     avg 3.88
 * Lightning Ball L2 4%,  L3 17%, L4 78%            avg 3.72
 * Static Charge  L2 13%, L3 41%, L4 46%            avg 3.39
 * ```
 *
 * **The unfiltered response is never fetched.** `ability-order-stats` with
 * no badge filter is 5 MB for one hero, and the API's `min_matches`
 * parameter does not help — at its lowest it answers with 114 MB in over
 * a minute. "All ranks" is therefore assembled from the four bracket
 * responses instead, which are 100–400 KB each.
 */
export async function getAbilityLevelSpread(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<AbilityLevelSpread[]> {
  const rows = await getAbilityOrderRows(heroApiId, bracket);
  if (rows.length === 0) return [];

  /*
   * Per ability: the weighted count of sequences ending at each level.
   */
  const levelCounts = new Map<number, Map<number, number>>();
  const rowCounts = new Map<number, number>();

  for (const row of rows) {
    const { abilities, players } = row;
    if (!Array.isArray(abilities) || abilities.length === 0) continue;

    const counts = new Map<number, number>();
    for (const apiId of abilities) {
      counts.set(apiId, (counts.get(apiId) ?? 0) + 1);
    }

    for (const [apiId, level] of counts) {
      const levels = levelCounts.get(apiId) ?? new Map<number, number>();
      levels.set(level, (levels.get(level) ?? 0) + players);
      levelCounts.set(apiId, levels);
      rowCounts.set(apiId, (rowCounts.get(apiId) ?? 0) + 1);
    }
  }

  const apiIds = [...levelCounts.keys()];
  if (apiIds.length === 0) return [];
  const names = await getAbilityNames(apiIds);

  const spreads: AbilityLevelSpread[] = [];
  for (const apiId of apiIds) {
    const levels = levelCounts.get(apiId) ?? new Map<number, number>();
    const total = [...levels.values()].reduce((s, v) => s + v, 0);
    if (total <= 0) continue;

    // The levels run 1 to 4, so the array is indexed from zero.
    const highest = Math.max(...levels.keys());
    const levelPct: number[] = [];
    let weighted = 0;
    for (let level = 1; level <= highest; level += 1) {
      const share = (100 * (levels.get(level) ?? 0)) / total;
      levelPct.push(share);
      weighted += level * share;
    }

    const meta = names.get(String(apiId));
    spreads.push({
      apiId,
      className: meta?.className ?? null,
      name: meta?.name ?? `ability ${apiId}`,
      levelPct,
      avgLevel: weighted / 100,
      totalRows: rowCounts.get(apiId) ?? 0,
    });
  }

  return spreads.sort((a, b) => b.avgLevel - a.avgLevel);
}

/**
 * The upgrade order for a hero's abilities, for a bracket.
 *
 * There is no single typical sequence — Abrams has thousands of distinct
 * ones, and the most common covers only 4.5% of players. What is well
 * defined is the **pairwise** order: for any two abilities, how often one
 * is taken before the other. That is what this carries.
 *
 * Two directions, from the same underlying counts:
 *
 * - **next** — for each ability, what follows it. The share is over the
 *   sequences containing that ability, so the list adds up to at most 100.
 *   A self-transition is excluded: "Power Surge then Power Surge" is
 *   levelling, not a move to a different ability.
 * - **before** — for each ability, the other abilities it is paired with.
 *   The share is **this ability's** share of the pair, so it reads as
 *   "this was taken first X% of the time against that ability" and the
 *   two directions sum to 100.
 *
 * The order is on **when each ability was first taken**, not on the raw
 * sequence of upgrade points, so levelling the same ability twice does
 * not move it in the order.
 */
export async function getAbilityOrder(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
  options: { limit?: number } = {},
): Promise<AbilityOrder[]> {
  const limit = options.limit ?? 3;
  const rows = await getAbilityOrderRows(heroApiId, bracket);
  if (rows.length === 0) return [];

  /*
   * `nextCounts[from][to]` — the sequences that took `from` and then `to`.
   *
   * `pairCounts` is keyed by the **lower** ability id, then the higher
   * one, so the same pair always lands on the same key whichever way
   * round it was met. The value holds how many sequences contained the
   * pair and how many of those the lower-numbered ability came first in.
   *
   * Keying by direction instead would split a pair across two keys — one
   * ability first in some rows, the other first in the rest — and every
   * share would come out at 50%.
   */
  const nextCounts = new Map<number, Map<number, number>>();
  const pairCounts = new Map<number, Map<number, { total: number; lowFirst: number }>>();
  const abilityRows = new Map<number, number>();

  for (const row of rows) {
    const { abilities } = row;
    if (!Array.isArray(abilities) || abilities.length === 0) continue;

    /*
     * The first appearance of an ability is where it was taken; the
     * ability after that is what follows it.
     */
    const firstIndex = new Map<number, number>();
    for (let i = 0; i < abilities.length; i += 1) {
      const apiId = abilities[i];
      if (apiId == null || firstIndex.has(apiId)) continue;
      firstIndex.set(apiId, i);
      abilityRows.set(apiId, (abilityRows.get(apiId) ?? 0) + 1);
    }

    for (const [apiId, index] of firstIndex) {
      const next = abilities[index + 1];
      if (next == null || next === apiId) continue;
      const forFrom = nextCounts.get(apiId) ?? new Map<number, number>();
      forFrom.set(next, (forFrom.get(next) ?? 0) + 1);
      nextCounts.set(apiId, forFrom);
    }

    /*
     * The pairwise order: for each pair of different abilities in the
     * sequence, which one came first.
     *
     * The pair is keyed by the lower id first, so the same pair lands on
     * the same key whichever way round it was met. `lowFirst` counts the
     * sequences in which the lower-numbered ability came first.
     */
    const ordered = [...firstIndex.keys()];
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const first = ordered[i];
        const second = ordered[j];
        const low = Math.min(first, second);
        const high = Math.max(first, second);

        const forLow = pairCounts.get(low) ?? new Map<number, { total: number; lowFirst: number }>();
        const entry = forLow.get(high) ?? { total: 0, lowFirst: 0 };
        entry.total += 1;
        if (first === low) entry.lowFirst += 1;
        forLow.set(high, entry);
        pairCounts.set(low, forLow);
      }
    }
  }

  const apiIds = [...abilityRows.keys()];
  if (apiIds.length === 0) return [];
  const names = await getAbilityNames(apiIds);

  const orders: AbilityOrder[] = [];
  for (const apiId of apiIds) {
    const meta = names.get(String(apiId));
    const ownRows = abilityRows.get(apiId) ?? 0;

    const next: AbilityTransition[] = [];
    const forNext = nextCounts.get(apiId);
    if (forNext) {
      for (const [to, count] of forNext) {
        const toMeta = names.get(String(to));
        next.push({
          apiId: to,
          className: toMeta?.className ?? null,
          name: toMeta?.name ?? `ability ${to}`,
          sharePct: ownRows > 0 ? (100 * count) / ownRows : 0,
        });
      }
      next.sort((a, b) => b.sharePct - a.sharePct);
    }

    /*
     * The "before" list.
     *
     * For each pair this ability is in, the share is **this ability's**
     * share of the pair — how often it was taken first against the other.
     * So it reads "this one 88% against that one", and the two directions
     * of a pair sum to 100.
     */
    const before: AbilityTransition[] = [];
    for (const [low, forLow] of pairCounts) {
      for (const [high, entry] of forLow) {
        if (low !== apiId && high !== apiId) continue;

        const other = low === apiId ? high : low;
        // How often *this* ability was taken first.
        const thisFirst =
          low === apiId ? entry.lowFirst : entry.total - entry.lowFirst;
        const otherMeta = names.get(String(other));
        before.push({
          apiId: other,
          className: otherMeta?.className ?? null,
          name: otherMeta?.name ?? `ability ${other}`,
          sharePct: entry.total > 0 ? (100 * thisFirst) / entry.total : 0,
        });
      }
    }
    before.sort((a, b) => b.sharePct - a.sharePct);

    orders.push({
      apiId,
      className: meta?.className ?? null,
      name: meta?.name ?? `ability ${apiId}`,
      next: next.slice(0, limit),
      before: before.slice(0, limit),
    });
  }

  return orders;
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
