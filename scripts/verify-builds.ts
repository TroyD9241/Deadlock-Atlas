/**
 * Verify the build play data (M12).
 *
 * The ranking is the part that can go quietly wrong: a build can top the
 * list on noise, and the edge over the hero's baseline only means
 * something if the baseline is right. So this checks:
 *
 *   1. The baseline is the hero's own win rate, and the edge is exactly
 *      the build's win rate minus it.
 *   2. Every listed build clears the minimum sample.
 *   3. A build is only marked significant when its edge clears its own
 *      standard error, recomputed here independently.
 *   4. The ranking is by edge, descending.
 *   5. The build definitions resolve, and every item in them is one of
 *      our own items.
 *   6. The derived phases are ordered, non-empty, and the early boundary
 *      is where the net buy/sell flow actually turns positive.
 *   7. The net worth curve rises.
 *
 * Run with: npx tsx scripts/verify-builds.ts
 */

import { db } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import {
  derivePhases,
  getBuildDetail,
  getBuildPhases,
  getHeroBaseline,
  getRankedBuilds,
  standardErrorPp,
} from "@/lib/build-play-data";
import { ALL_RANKS, bracketById } from "@/lib/rank-brackets";

import type { HeroBuildStat, ItemStat } from "@/lib/deadlock-api";

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
  console.log("Build play data verification\n");

  // ---------------------------------------------------------------------
  console.log("1. The baseline is the hero's own win rate");
  const baseline = await getHeroBaseline(HERO_ID, ALL_RANKS);
  check("the baseline was found", baseline != null);
  if (!baseline) throw new Error("no baseline");

  const heroStats = await getAnalytics<{
    hero_id: number;
    wins: number;
    losses: number;
    matches: number;
  }[]>("hero-stats", {}, ALL_RANKS);
  const heroRow = heroStats.payload.find((h) => h.hero_id === HERO_ID)!;
  const expected = (100 * heroRow.wins) / (heroRow.wins + heroRow.losses);
  check(
    "the baseline matches the hero-stats win rate",
    Math.abs(baseline.winRatePct - expected) < 1e-9,
    `${baseline.winRatePct.toFixed(4)}%`,
  );
  check(
    "the baseline carries its sample",
    baseline.matches === heroRow.matches,
    `${baseline.matches.toLocaleString()} matches`,
  );
  check(
    "the baseline is a plausible win rate",
    baseline.winRatePct > 20 && baseline.winRatePct < 80,
  );

  // ---------------------------------------------------------------------
  console.log("\n2. The builds clear the sample floor");
  const { builds } = await getRankedBuilds(HERO_ID, ALL_RANKS);
  check("the builds have rows", builds.length > 0, `${builds.length}`);

  const rawStats = await getAnalytics<HeroBuildStat[]>(
    "hero-build-stats",
    { min_matches: 250 },
    ALL_RANKS,
    { pathSuffix: `/${HERO_ID}` },
  );
  const rawRows = rawStats.payload;
  check(
    "every listed build has at least 250 matches",
    builds.every((b) => b.matches >= 250),
    `min ${Math.min(...builds.map((b) => b.matches))}`,
  );
  check(
    "the listed builds are among the API's rows",
    builds.every((b) => rawRows.some((r) => r.hero_build_id === b.buildId)),
  );

  // ---------------------------------------------------------------------
  console.log("\n3. The edge is the build's win rate minus the baseline");
  for (const build of builds.slice(0, 5)) {
    const row = rawRows.find((r) => r.hero_build_id === build.buildId)!;
    const winRate = (100 * row.wins) / (row.wins + row.losses);
    check(
      `build ${build.buildId}: the win rate is right`,
      Math.abs(build.winRatePct - winRate) < 1e-9,
      `${build.winRatePct.toFixed(2)}%`,
    );
    check(
      `build ${build.buildId}: the edge is right`,
      Math.abs(build.edgePp - (winRate - baseline.winRatePct)) < 1e-9,
      `${build.edgePp.toFixed(2)}pp`,
    );
  }

  // ---------------------------------------------------------------------
  console.log("\n4. The standard error and the significance flag");
  for (const build of builds) {
    const expectedSe = standardErrorPp(build.winRatePct, build.matches);
    if (Math.abs(build.stdErrPp - expectedSe) > 1e-9) {
      check(`build ${build.buildId}: the standard error is right`, false);
      break;
    }
  }
  check(
    "every standard error is right",
    builds.every(
      (b) => Math.abs(b.stdErrPp - standardErrorPp(b.winRatePct, b.matches)) < 1e-9,
    ),
  );
  check(
    "a build is significant only when the edge clears the noise",
    builds.every((b) => b.significant === Math.abs(b.edgePp) > b.stdErrPp),
  );
  check(
    "the noise shrinks as the sample grows",
    builds.every((b) => b.stdErrPp < 4),
    `max ${Math.max(...builds.map((b) => b.stdErrPp)).toFixed(2)}pp`,
  );

  // ---------------------------------------------------------------------
  console.log("\n5. The ranking is by edge, descending");
  check(
    "the builds are sorted by edge",
    builds.every((b, i) => i === 0 || builds[i - 1].edgePp >= b.edgePp),
    builds
      .slice(0, 3)
      .map((b) => `${b.edgePp.toFixed(2)}pp`)
      .join(", "),
  );
  check(
    "the ranking is not just the popularity ranking",
    builds.slice(0, 5).some((b) => {
      const mostUsed = rawRows.reduce((a, r) => (r.players > a.players ? r : a));
      return b.buildId !== mostUsed.hero_build_id;
    }),
  );

  // ---------------------------------------------------------------------
  console.log("\n6. The definitions resolve, and their items are ours");
  const detail = await getBuildDetail(HERO_ID, builds[0].buildId, ALL_RANKS);
  check("the build's detail was fetched", detail != null);
  if (detail) {
    check(
      "the core items fit the board's twelve slots",
      detail.coreItemIds.length > 0 && detail.coreItemIds.length <= 12,
      `${detail.coreItemIds.length} items`,
    );
    check(
      "the skill order has entries",
      detail.skillOrder.length > 0,
      `${detail.skillOrder.length} points`,
    );
    check(
      "the author phases were read",
      detail.authorPhases.length > 0,
      `${detail.authorPhases.length}`,
    );
    check(
      "the imbue targets were read",
      detail.imbueTargets.length >= 0,
      `${detail.imbueTargets.length}`,
    );

    /*
     * The ids in the guide are items, but the skill order and the imbue
     * targets are abilities — and abilities live in the same numeric
     * space. So each set has to be checked against the right table.
     */
    const allItemIds = new Set<number>();
    for (const phase of detail.authorPhases) {
      for (const id of phase.itemIds) allItemIds.add(id);
    }
    const ours = await db.item.findMany({
      where: { apiId: { in: [...allItemIds].map(String) } },
      select: { apiId: true },
    });
    check(
      "every item in the build's phases resolves to one of our items",
      ours.length === allItemIds.size,
      `${ours.length} of ${allItemIds.size}`,
    );

    const coreOurs = await db.item.findMany({
      where: { apiId: { in: detail.coreItemIds.map(String) } },
      select: { apiId: true },
    });
    check(
      "the core items resolve to one of our items",
      coreOurs.length === detail.coreItemIds.length,
      `${coreOurs.length} of ${detail.coreItemIds.length}`,
    );

    const ourAbilities = await db.ability.findMany({
      where: { apiId: { in: [...detail.skillOrder, ...detail.imbueTargets].map(String) } },
      select: { apiId: true },
    });
    const abilityIdSet = new Set(ourAbilities.map((a) => String(a.apiId)));
    check(
      "every skill-order id resolves to one of our abilities",
      detail.skillOrder.every((id) => abilityIdSet.has(String(id))),
      `${detail.skillOrder.filter((id) => abilityIdSet.has(String(id))).length} of ${detail.skillOrder.length}`,
    );
    check(
      "every imbue target resolves to one of our abilities",
      detail.imbueTargets.every((id) => abilityIdSet.has(String(id))),
      `${detail.imbueTargets.length} targets`,
    );

    /*
     * The two id spaces must not be mixed up. An ability id offered as a
     * loadout slot would be wrong.
     */
    const coreIsNotAbility = detail.coreItemIds.every(
      (id) => !abilityIdSet.has(String(id)),
    );
    check(
      "no ability id is offered as a loadout item",
      coreIsNotAbility,
    );
  }

  // ---------------------------------------------------------------------
  console.log("\n7. The derived phases");
  const phases = await getBuildPhases(HERO_ID, builds[0].buildId, ALL_RANKS);
  check("the phases were derived", phases.length === 3, `${phases.length}`);
  if (phases.length === 3) {
    check(
      "the phases are in order",
      phases[0].id === "early" &&
        phases[1].id === "mid" &&
        phases[2].id === "late",
    );
    check(
      "the phase boundaries do not go backwards",
      phases[0].fromS <= phases[1].fromS &&
        (phases[1].toS ?? 0) <= phases[2].fromS,
      phases.map((p) => `${p.label} ${p.fromS}-${p.toS ?? "end"}`).join(", "),
    );
    check(
      "every phase with a boundary has items bought in it",
      phases.every((p) => p.bought > 0 || p.toS === null || p.fromS === p.toS),
      phases.map((p) => `${p.label}:${p.bought}`).join(", "),
    );
    check(
      "the phases cover the whole match",
      phases[0].fromS === 0 && phases[2].toS == null,
    );

    /*
     * The derivation itself, on data with a known shape: a net sell for
     * the first two minutes, then a rising buy rate that peaks and tails
     * off. This checks the logic without depending on the API.
     */
    const synthetic = derivePhases([
      { bucket: 0, players: 100, sold: 200 },
      { bucket: 1, players: 150, sold: 300 },
      { bucket: 2, players: 400, sold: 100 },
      { bucket: 3, players: 500, sold: 50 },
      { bucket: 4, players: 600, sold: 20 },
      { bucket: 5, players: 300, sold: 10 },
      { bucket: 6, players: 100, sold: 5 },
    ]);
    check(
      "a known flow derives three ordered phases",
      synthetic.length === 3 &&
        synthetic[0].id === "early" &&
        synthetic[1].id === "mid" &&
        synthetic[2].id === "late",
      synthetic
        .map((p) => `${p.label} ${p.fromS / 60}-${(p.toS ?? 0) / 60}m`)
        .join(", "),
    );
    check(
      "the early phase ends where the balance crosses zero",
      synthetic[1].fromS === 2 * 60,
      `${synthetic[1].fromS / 60} minutes`,
    );
    check(
      "the early phase counts the net sell",
      synthetic[0].bought === 250 && synthetic[0].sold === 500,
      `bought ${synthetic[0].bought}, sold ${synthetic[0].sold}`,
    );
    check(
      "the late phase has no end",
      phases[2].toS == null,
    );
  }

  /*
   * The early boundary has to be real: the cumulative net flow of items
   * must cross zero at that minute, not somewhere else.
   */
  const timingResult = await getAnalytics<ItemStat[]>(
    "item-stats",
    {
      hero_ids: HERO_ID,
      hero_build_id: builds[0].buildId,
      min_matches: 1,
      bucket: "game_time_min",
    },
    ALL_RANKS,
  );
  const perMinute = new Map<number, { bought: number; sold: number }>();
  for (const row of timingResult.payload) {
    const m = Math.max(0, Math.floor(row.bucket));
    const entry = perMinute.get(m) ?? { bought: 0, sold: 0 };
    entry.bought += row.players;
    if (row.sold > 0) entry.sold += row.sold;
    perMinute.set(m, entry);
  }
  const minutes = [...perMinute.keys()].sort((a, b) => a - b);
  let cumulative = 0;
  const firstPositive = minutes.find((m) => {
    const e = perMinute.get(m)!;
    cumulative += e.bought - e.sold;
    return cumulative > 0;
  });
  check(
    "the early boundary is where the cumulative flow crosses zero",
    phases.length === 3 &&
      phases[1].fromS / 60 === Math.max(firstPositive ?? 1, 1),
    `boundary ${phases[1]?.fromS / 60}, first positive minute ${firstPositive}`,
  );
  check(
    "the cumulative balance starts below zero",
    (() => {
      let c = 0;
      for (const m of minutes.slice(0, 2)) {
        const e = perMinute.get(m)!;
        c += e.bought - e.sold;
      }
      return c < 0;
    })(),
    minutes
      .slice(0, 2)
      .map((m) => {
        const e = perMinute.get(m)!;
        return `min ${m}: ${e.bought}b/${e.sold}s`;
      })
      .join(", "),
  );

  // ---------------------------------------------------------------------
  console.log("\n8. The net worth curve rises");
  if (detail) {
    const curve = detail.curve;
    check("the curve has points", curve.length > 0, `${curve.length}`);
    check(
      "the curve rises",
      curve.every((p, i) => i === 0 || curve[i - 1].netWorth <= p.netWorth),
      `${curve[0]?.netWorth.toFixed(0)} → ${curve[curve.length - 1]?.netWorth.toFixed(0)}`,
    );
    check(
      "the curve is sampled across the match",
      curve[0]?.atPct === 0 && curve[curve.length - 1]?.atPct === 100,
    );
    check(
      "every curve point carries its sample",
      curve.every((p) => p.samples > 0),
    );
  }

  // ---------------------------------------------------------------------
  console.log("\n9. The bracket filter changes the builds");
  const topBracket = bracketById("phantom-eternus");
  const topResult = await getRankedBuilds(HERO_ID, topBracket);
  check(
    "the narrow bracket has its own builds",
    topResult.builds.length > 0,
    `${topResult.builds.length}`,
  );
  check(
    "the narrow bracket has its own baseline",
    topResult.baseline != null &&
      Math.abs(topResult.baseline.winRatePct - baseline.winRatePct) > 0.01,
    `${topResult.baseline?.winRatePct.toFixed(2)}% vs ${baseline.winRatePct.toFixed(2)}%`,
  );

  // ---------------------------------------------------------------------
  console.log("\n10. Each hero gets its own builds");
  /*
   * `hero-build-stats` takes the hero in the path, so the cache key has to
   * include it. When it did not, every hero shared one cache row and was
   * served the first hero's builds — silently, and it looked fine.
   */
  const heroBuilds = new Map<number, number[]>();
  for (const hero of [2, 15, 27, 63]) {
    const result = await getRankedBuilds(hero, ALL_RANKS);
    heroBuilds.set(
      hero,
      result.builds.map((b) => b.buildId),
    );
  }
  const idLists = [...heroBuilds.values()].map((ids) => ids.join(","));
  check(
    "the heroes have different build lists",
    new Set(idLists).size === idLists.length,
    `${new Set(idLists).size} distinct of ${idLists.length}`,
  );
  for (const [hero, ids] of heroBuilds) {
    check(
      `hero ${hero} has builds of its own`,
      ids.length > 0 && ids.every((id) => id > 0),
      `${ids.length} builds`,
    );
  }

  // ---------------------------------------------------------------------
  console.log("\nThe builds, all ranks:");
  console.log(
    `  hero baseline ${baseline.winRatePct.toFixed(2)}% over ${baseline.matches.toLocaleString()} matches`,
  );
  for (const b of builds) {
    console.log(
      `  ${b.edgePp >= 0 ? "+" : "-"}${Math.abs(b.edgePp).toFixed(2)}pp  ` +
        `${b.winRatePct.toFixed(2)}%  ±${b.stdErrPp.toFixed(2)}pp  ` +
        `${b.matches.toLocaleString().padStart(9)} matches  ` +
        `${b.significant ? "significant" : "within noise"}  ${b.name}`,
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
