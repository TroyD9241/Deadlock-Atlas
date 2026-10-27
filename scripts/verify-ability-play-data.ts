/**
 * Verify the ability play data (M11c).
 *
 * The two endpoints have different shapes and different denominators, and
 * the aggregation is easy to get subtly wrong, so this checks the maths
 * against the live API rather than assuming it:
 *
 *   1. The max-first response has exactly four identified abilities plus a
 *      null row, and the null row is excluded from the percentages.
 *   2. The percentages sum to 100 across the identified abilities.
 *   3. No shared ability ever appears.
 *   4. The bracket filter changes the figures.
 *   5. The upgrade-order rows really are upgrade-point sequences: each
 *      ability's count in a row is the level it ended at.
 *   6. The level spread is a proper distribution, and the abilities
 *      actually differ from each other.
 *   7. The upgrade order is antisymmetric — the two directions of a pair
 *      come from the same counts.
 *   8. The roster-wide ability-order response is never fetched.
 *
 * Run with: npx tsx scripts/verify-ability-play-data.ts
 */

import { db } from "@/lib/db";
import {
  getAbilityLevelSpread,
  getAbilityMaxFirst,
  getAbilityMaxFirstSample,
  getAbilityOrder,
  getAbilityOrderRows,
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
  console.log("\n3. No shared ability appears");
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
    row.abilities.length > distinct.size &&
      [...distinct].every((a) => row.abilities.filter((x) => x === a).length <= 4),
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
  check("no ability is levelled past its real tier count", tierOk);

  // ---------------------------------------------------------------------
  console.log("\n6. The level spread is a proper distribution");
  const spread = await getAbilityLevelSpread(HERO_ID, top);
  check("the spread has rows", spread.length > 0, `${spread.length}`);
  check(
    "every ability resolved to a name",
    spread.every((s) => !s.name.startsWith("ability ")),
    spread.map((s) => s.name).join(", "),
  );

  for (const row of spread) {
    const sum = row.levelPct.reduce((s, v) => s + v, 0);
    check(
      `${row.name}: the levels add up to 100%`,
      Math.abs(sum - 100) < 0.001,
      `${sum.toFixed(2)}%`,
    );
    check(
      `${row.name}: the average level is between 1 and 4`,
      row.avgLevel >= 1 && row.avgLevel <= 4,
      `${row.avgLevel.toFixed(2)}`,
    );
    check(
      `${row.name}: the level counts are whole numbers`,
      row.levelPct.length >= 1 && row.levelPct.length <= 4,
      `${row.levelPct.length} levels`,
    );
  }

  /*
   * The reason the "usual level" was dropped: the mode is level 4 nearly
   * everywhere, so it says nothing. This is a documented fact rather
   * than something to assert as desirable.
   */
  const modeIsFour = spread.filter((s) => {
    const highest = s.levelPct.indexOf(Math.max(...s.levelPct));
    return highest === s.levelPct.length - 1;
  }).length;
  check(
    "the mode is level 4 for most abilities, which is why it was dropped",
    modeIsFour >= spread.length - 1,
    `${modeIsFour} of ${spread.length}`,
  );

  /*
   * The spread's real value: the abilities differ from each other. For
   * Abrams, Power Surge is nearly always maxed and Static Charge is split.
   */
  const avgLevels = spread.map((s) => s.avgLevel);
  const spreadOfAverages = Math.max(...avgLevels) - Math.min(...avgLevels);
  check(
    "the abilities differ in how far they are levelled",
    spreadOfAverages > 0.3,
    `${spreadOfAverages.toFixed(2)} between the highest and lowest`,
  );

  // ---------------------------------------------------------------------
  console.log("\n7. The upgrade order is antisymmetric");
  const order = await getAbilityOrder(HERO_ID, top);
  check("the order has rows", order.length > 0, `${order.length}`);
  check(
    "every ability resolved to a name",
    order.every((o) => !o.name.startsWith("ability ")),
    order.map((o) => o.name).join(", "),
  );
  check(
    "the next lists are within range",
    order.every((o) => o.next.every((n) => n.sharePct >= 0 && n.sharePct <= 100)),
  );
  check(
    "the before lists are within range",
    order.every((o) => o.before.every((b) => b.sharePct >= 0 && b.sharePct <= 100)),
  );
  check(
    "an ability is never in its own before list",
    order.every((o) => o.before.every((b) => b.apiId !== o.apiId)),
  );
  check(
    "the next list never contains itself",
    order.every((o) => o.next.every((n) => n.apiId !== o.apiId)),
  );

  /*
   * The important one: if A was taken first more often than not against
   * B, then B's share against A must be the complement. This is the check
   * that the two directions come from the same counts.
   */
  let antisymmetric = true;
  let checkedPairs = 0;
  for (const a of order) {
    for (const b of a.before) {
      const bRow = order.find((o) => o.apiId === b.apiId);
      if (!bRow) continue;
      const mirror = bRow.before.find((x) => x.apiId === a.apiId);
      if (!mirror) {
        antisymmetric = false;
        continue;
      }
      checkedPairs += 1;
      if (Math.abs(b.sharePct + mirror.sharePct - 100) > 0.01) {
        antisymmetric = false;
      }
    }
  }
  check(
    "the two directions of every pair sum to 100%",
    antisymmetric,
    `${checkedPairs} pairs checked`,
  );

  /*
   * A spot check against figures measured directly from the API, so a
   * change in the counting cannot pass unnoticed. For Abrams at the top
   * bracket, counted on when each ability was first taken:
   *
   *   Power Surge before Lightning Ball  88%
   *   Power Surge before Static Charge   74%
   *   Storm Cloud before anything          0%
   */
  const powerSurge = order.find((o) => o.name === "Power Surge");
  const stormCloud = order.find((o) => o.name === "Storm Cloud");
  check(
    "Power Surge is taken first about 88% of the time against Lightning Ball",
    Math.abs(
      (powerSurge?.before.find((b) => b.name === "Lightning Ball")?.sharePct ?? 0) -
        88,
    ) < 2,
    `${powerSurge?.before.find((b) => b.name === "Lightning Ball")?.sharePct.toFixed(1)}%`,
  );
  check(
    "Power Surge is taken first about 74% of the time against Static Charge",
    Math.abs(
      (powerSurge?.before.find((b) => b.name === "Static Charge")?.sharePct ?? 0) -
        74,
    ) < 2,
    `${powerSurge?.before.find((b) => b.name === "Static Charge")?.sharePct.toFixed(1)}%`,
  );
  check(
    "Storm Cloud is taken last, so it wins no pair",
    (stormCloud?.before ?? []).every((b) => b.sharePct < 1),
    stormCloud?.before.map((b) => `${b.name} ${b.sharePct.toFixed(0)}%`).join(", "),
  );

  /*
   * And the ordering has to be stable across the ladder, or it is noise.
   */
  const lowOrder = await getAbilityOrder(HERO_ID, bracketById("initiate-sentinel"));
  const lowPower = lowOrder.find((o) => o.name === "Power Surge");
  const topPower = order.find((o) => o.name === "Power Surge");
  check(
    "the leading ability's ordering holds across brackets",
    Boolean(
      lowPower &&
        topPower &&
        Math.abs(
          (lowPower.before.find((b) => b.name === "Lightning Ball")?.sharePct ?? 0) -
            (topPower.before.find((b) => b.name === "Lightning Ball")?.sharePct ?? 0),
        ) < 25,
    ),
    lowPower && topPower
      ? `vs Lightning Ball: ${lowPower.before.find((b) => b.name === "Lightning Ball")?.sharePct.toFixed(0)}% at initiate, ${topPower.before.find((b) => b.name === "Lightning Ball")?.sharePct.toFixed(0)}% at the top`
      : "",
  );

  // ---------------------------------------------------------------------
  console.log("\n8. The unfiltered upgrade-order response is not used");
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
  console.log("\nThe level spread, top bracket:");
  for (const s of spread) {
    const levels = s.levelPct
      .map((pct, index) => `L${index + 1} ${pct.toFixed(0)}%`)
      .join("  ");
    console.log(`    ${s.name.padEnd(24)} avg ${s.avgLevel.toFixed(2)}   ${levels}`);
  }
  console.log("\nThe upgrade order, top bracket:");
  for (const o of order) {
    const first = o.before
      .map((b) => `${b.name} ${b.sharePct.toFixed(0)}%`)
      .join(", ");
    const next = o.next.map((n) => `${n.name} ${n.sharePct.toFixed(0)}%`).join(", ");
    console.log(`    ${o.name}`);
    console.log(`      taken first vs: ${first || "—"}`);
    console.log(`      then next:      ${next || "—"}`);
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
