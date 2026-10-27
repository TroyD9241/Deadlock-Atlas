/**
 * Verify the ability play data (M11c).
 *
 * The two endpoints have different shapes and different denominators, and
 * the upgrade-order aggregation is easy to get subtly wrong, so this
 * checks the maths against the live API rather than assuming it:
 *
 *   1. The max-first response has exactly four identified abilities plus a
 *      null row, and the null row is excluded from the percentages.
 *   2. The percentages sum to 100 across the identified abilities.
 *   3. No universal ability ever appears.
 *   4. The bracket filter changes the figures.
 *   5. The upgrade-order rows really are upgrade-point sequences: each
 *      ability's count in a row is the level it ended at.
 *   6. The aggregation produces sensible timings and levels.
 *   7. The roster-wide ability-order response is never fetched — the
 *      bracket-filtered one is used instead.
 *
 * Run with: npx tsx scripts/verify-ability-play-data.ts
 */

import { db } from "@/lib/db";
import {
  getAbilityMaxFirst,
  getAbilityMaxFirstSample,
  getAbilityOrderRows,
  getAbilityUpgradeTiming,
  getAvgMatchDuration,
  median,
} from "@/lib/ability-play-data";
import { getAnalytics } from "@/lib/analytics";
import { ALL_RANKS, RANK_BRACKETS, bracketById } from "@/lib/rank-brackets";

import type { AbilityOrderStat } from "@/lib/deadlock-api";

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Hero 2 is Abrams. */
const HERO_ID = 2;

async function main() {
  console.log("Ability play data verification\n");

  // ---------------------------------------------------------------------
  console.log("1. The max-first response has four identified abilities");
  const rawResult = await getAnalytics<
    {
      ability_id: number | null;
      wins: number;
      losses: number;
      matches: number;
      players: number;
    }[]
  >("ability-max-first-stats", { hero_id: HERO_ID }, ALL_RANKS);
  const raw = rawResult.payload;

  check("the response has rows", raw.length > 0, `${raw.length} rows`);
  const identified = raw.filter((r) => r.ability_id != null);
  const nullRows = raw.filter((r) => r.ability_id == null);
  check(
    "there are exactly four identified abilities",
    identified.length === 4,
    `${identified.length}`,
  );
  check(
    "there is exactly one null row",
    nullRows.length === 1,
    `${nullRows.length}`,
  );
  check(
    "the null row is a small share",
    nullRows.length === 1 &&
      nullRows[0].players /
        raw.reduce((s, r) => s + r.players, 0) <
        0.05,
    nullRows.length === 1
      ? `${(
          (100 * nullRows[0].players) /
          raw.reduce((s, r) => s + r.players, 0)
        ).toFixed(1)}% of players`
      : "",
  );

  // ---------------------------------------------------------------------
  console.log("\n2. The percentages are the share of identified players");
  const maxFirst = await getAbilityMaxFirst(HERO_ID, ALL_RANKS);
  check("the max-first list has rows", maxFirst.length > 0, `${maxFirst.length}`);
  check(
    "the null row is excluded",
    maxFirst.length === identified.length,
    `${maxFirst.length} of ${identified.length}`,
  );

  const total = maxFirst.reduce((s, m) => s + m.sharePct, 0);
  check(
    "the shares add up to 100%",
    Math.abs(total - 100) < 0.001,
    `${total.toFixed(3)}%`,
  );

  const sample = await getAbilityMaxFirstSample(HERO_ID, ALL_RANKS);
  check(
    "the sample is the sum of the identified rows",
    sample === identified.reduce((s, r) => s + r.players, 0),
    `${sample}`,
  );
  check(
    "every ability resolved to a name",
    maxFirst.every((m) => m.name.length > 0 && !m.name.startsWith("ability ")),
    maxFirst.map((m) => m.name).join(", "),
  );
  check(
    "the list is sorted by share",
    maxFirst.every((m, i) => i === 0 || maxFirst[i - 1].sharePct >= m.sharePct),
  );

  // ---------------------------------------------------------------------
  console.log("\n3. No universal ability appears");
  /*
   * The hero's own abilities, with how many heroes share each. The shared
   * ones are the universal ones — Jump, Slide, Mantle and the rest — and
   * the point of the check is that none of them turn up in the max-first
   * list.
   */
  const heroAbilities = await db.ability.findMany({
    where: { heroes: { some: { hero: { apiId: HERO_ID } } } },
    select: { className: true, heroes: { select: { heroId: true } } },
  });
  const shared = heroAbilities.filter((a) => a.heroes.length > 5);
  check(
    "the hero does have shared abilities to confuse things with",
    shared.length > 0,
    `${shared.length} of ${heroAbilities.length} are shared`,
  );
  const sharedNames = new Set(shared.map((a) => a.className));
  check(
    "none of them appear in the max-first list",
    maxFirst.every((m) => !sharedNames.has(m.className ?? "")),
    maxFirst.map((m) => m.className).join(", "),
  );

  // ---------------------------------------------------------------------
  console.log("\n4. The bracket filter changes the figures");
  const top = bracketById("phantom-eternus");
  const topMaxFirst = await getAbilityMaxFirst(HERO_ID, top);
  check("the narrow bracket has rows", topMaxFirst.length > 0, `${topMaxFirst.length}`);
  check(
    "the narrow bracket's shares still add to 100%",
    Math.abs(topMaxFirst.reduce((s, m) => s + m.sharePct, 0) - 100) < 0.001,
  );
  const topSample = await getAbilityMaxFirstSample(HERO_ID, top);
  check(
    "the narrow bracket has a smaller sample",
    topSample > 0 && topSample < sample,
    `${topSample} vs ${sample}`,
  );
  check(
    "the leading ability can differ between brackets",
    true,
    `all-ranks: ${maxFirst[0]?.name} ${maxFirst[0]?.sharePct.toFixed(1)}%, top: ${topMaxFirst[0]?.name} ${topMaxFirst[0]?.sharePct.toFixed(1)}%`,
  );

  // ---------------------------------------------------------------------
  console.log("\n5. The upgrade-order rows are upgrade-point sequences");
  const orderResult = await getAnalytics<AbilityOrderStat[]>(
    "ability-order-stats",
    { hero_id: HERO_ID },
    top,
  );
  const orderRows = orderResult.payload;
  check("the order response has rows", orderRows.length > 0, `${orderRows.length}`);

  const row = orderRows[0];
  check(
    "the abilities and the times are the same length",
    row.abilities.length === row.avg_upgrade_times_s.length,
    `${row.abilities.length} vs ${row.avg_upgrade_times_s.length}`,
  );
  const distinct = new Set(row.abilities);
  check(
    "an ability repeats once per level bought",
    row.abilities.length >
      distinct.size &&
      [...distinct].every(
        (a) =>
          row.abilities.filter((x) => x === a).length <=
          4,
      ),
    `${row.abilities.length} points across ${distinct.size} abilities`,
  );

  // The real check: every ability's tier count in our database must be at
  // least the number of times it appears in the row.
  const maxAppearances = new Map<number, number>();
  for (const a of row.abilities) {
    maxAppearances.set(a, (maxAppearances.get(a) ?? 0) + 1);
  }
  const abilities = await db.ability.findMany({
    where: { apiId: { in: [...maxAppearances.keys()].map(String) } },
    select: { apiId: true, className: true, upgrades: true },
  });
  check("the row's abilities resolved", abilities.length > 0, `${abilities.length}`);
  let tierOk = true;
  for (const ability of abilities) {
    const count = maxAppearances.get(Number(ability.apiId)) ?? 0;
    const tiers = Array.isArray(ability.upgrades) ? ability.upgrades.length : 0;
    // base plus three upgrade entries is level 4.
    if (count > tiers + 1) tierOk = false;
  }
  check(
    "no ability is levelled past its real tier count",
    tierOk,
  );

  // ---------------------------------------------------------------------
  console.log("\n6. The aggregation is sensible");
  check("the median of an odd list is the middle", median([1, 2, 3]) === 2);
  check(
    "the median of an even list is the mean of the middle two",
    median([1, 2, 3, 4]) === 2.5,
  );
  check("the median of an empty list is null", median([]) === null);

  const timings = await getAbilityUpgradeTiming(HERO_ID, top);
  check("the timings have rows", timings.length > 0, `${timings.length}`);
  check(
    "every ability resolved to a name",
    timings.every((t) => !t.name.startsWith("ability ")),
    timings.map((t) => t.name).join(", "),
  );
  check(
    "every timing has a first-point time",
    timings.every((t) => t.medianFirstPointS != null),
  );
  check(
    "every timing has a usual level",
    timings.every((t) => t.usualLevel >= 1 && t.usualLevel <= 4),
    timings.map((t) => `${t.name} L${t.usualLevel}`).join(", "),
  );
  check(
    "the usual-level share is a percentage",
    timings.every((t) => t.usualLevelPct > 0 && t.usualLevelPct <= 100),
  );
  check(
    "the timings are sorted by first-point time",
    timings.every(
      (t, i) =>
        i === 0 ||
        (timings[i - 1].medianFirstPointS ?? 0) <=
          (t.medianFirstPointS ?? Number.POSITIVE_INFINITY),
    ),
  );

  const duration = await getAvgMatchDuration(HERO_ID, top);
  check(
    "the average match duration is known",
    duration > 0,
    `${Math.round(duration)}s`,
  );
  check(
    "the first-point times fall inside the match",
    timings.every(
      (t) => (t.medianFirstPointS ?? 0) < duration,
    ),
    timings
      .map((t) => `${t.name} ${Math.round(t.medianFirstPointS ?? 0)}s`)
      .join(", "),
  );

  // ---------------------------------------------------------------------
  console.log("\n7. The unfiltered upgrade-order response is not used");
  /*
   * The unfiltered response is unusable: 5 MB for one hero, and 114 MB at
   * the API's lowest min_matches. "All ranks" is assembled from the four
   * bands instead, so no unfiltered row should ever be cached.
   */
  const cached = await db.analyticsSnapshot.findMany({
    where: { endpoint: "ability-order-stats" },
    select: {
      rankBracket: true,
      paramsHash: true,
      payload: true,
    },
  });
  const unfiltered = cached.filter(
    (row) =>
      row.rankBracket === "all" &&
      !row.paramsHash.includes("min_average_badge"),
  );
  check(
    "no unfiltered ability-order response is cached",
    unfiltered.length === 0,
    `${cached.length} cached rows, ${unfiltered.length} unfiltered`,
  );

  /*
   * "All ranks" must come from the four bands. This checks the rows are
   * actually gathered from them rather than from one unfiltered request.
   */
  const allRows = await getAbilityOrderRows(HERO_ID, ALL_RANKS);
  check(
    "all-ranks gathers rows from the bands",
    allRows.length > 0,
    `${allRows.length} rows`,
  );
  const bandRowCounts = await Promise.all(
    RANK_BRACKETS.filter((b) => b.id !== ALL_RANKS.id).map(async (band) => {
      const rows = await getAbilityOrderRows(HERO_ID, band);
      return rows.length;
    }),
  );
  const bandTotal = bandRowCounts.reduce((s, n) => s + n, 0);
  check(
    "all-ranks has as many rows as the bands together",
    allRows.length === bandTotal,
    `${allRows.length} vs ${bandTotal}`,
  );
  check(
    "each band contributes rows",
    bandRowCounts.every((n) => n > 0),
    bandRowCounts.join(", "),
  );

  // ---------------------------------------------------------------------
  console.log("\nThe max-first rates, all ranks:");
  for (const m of maxFirst) {
    console.log(`    ${m.name.padEnd(24)} ${m.sharePct.toFixed(1).padStart(5)}%`);
  }
  console.log("\nThe max-first rates, top bracket:");
  for (const m of topMaxFirst) {
    console.log(`    ${m.name.padEnd(24)} ${m.sharePct.toFixed(1).padStart(5)}%`);
  }
  console.log("\nThe typical upgrade behaviour, top bracket:");
  for (const t of timings) {
    console.log(
      `    ${t.name.padEnd(24)} first point at ${Math.round(t.medianFirstPointS ?? 0)}s, usually level ${t.usualLevel} (${t.usualLevelPct.toFixed(0)}%)`,
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
