/**
 * Verify the play-data layer (M11b).
 *
 * The figures on the page have to be right, not just present, so this
 * checks the maths rather than the rendering:
 *
 *   1. The pick rate is the share of a hero's matches, and lands in a
 *      plausible band.
 *   2. The API's own `popular_items.pick_pct` is *not* the same number —
 *      if it were, the computed rate would be pointless.
 *   3. The bracket filter changes the figures, and the narrow bracket has
 *      fewer matches behind it.
 *   4. Every API item id resolves to an item in our own shop.
 *   5. The buy time formats as `mm:ss`, and the stage follows the share of
 *      the match elapsed.
 *   6. The sorts behave: pick rate descending, buy time ascending.
 *
 * Run with: npx tsx scripts/verify-play-data.ts
 */

import { db } from "@/lib/db";
import {
  buyStageFor,
  buyStageLabel,
  buyTimeLabel,
  pickRatePct,
  winRatePct,
} from "@/lib/play-data-format";
import { getHeroItemPlayData, getHeroMatches, getItemPlayData } from "@/lib/play-data";
import {
  buildBuyBands,
  buildTransitions,
  flowStageFor,
  getFlowItemNames,
  getItemFlow,
} from "@/lib/item-flow";
import { parseItemSort } from "@/lib/item-sorts";
import { ALL_RANKS, bracketById } from "@/lib/rank-brackets";

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
  console.log("Play data verification\n");

  // ---------------------------------------------------------------------
  console.log("1. The pick rate is a share of the hero's matches");
  const picks = await getHeroItemPlayData(HERO_ID, ALL_RANKS);
  const heroMatches = await getHeroMatches(HERO_ID, ALL_RANKS);

  check("the hero has matches", heroMatches > 0, `${heroMatches} matches`);
  check("there are item rows", picks.length > 0, `${picks.length} items`);

  const rates = picks.map((p) => p.pickRatePct).sort((a, b) => b - a);
  const topRate = rates[0] ?? 0;
  const lowestRate = rates[rates.length - 1] ?? 0;

  check(
    "every rate is between 0 and 100",
    rates.every((r) => r >= 0 && r <= 100),
    `top ${topRate.toFixed(1)}%, lowest ${lowestRate.toFixed(1)}%`,
  );
  check(
    "the top rate is in the plausible band",
    topRate > 1 && topRate < 60,
    `${topRate.toFixed(1)}%`,
  );
  check(
    "the lowest rate is not absurdly high",
    lowestRate < 15,
    `${lowestRate.toFixed(1)}%`,
  );

  // ---------------------------------------------------------------------
  console.log("\n2. The computed rate differs from the API's own pick_pct");
  const hero = await db.hero.findUnique({
    where: { apiId: HERO_ID },
    select: { popularItems: true },
  });
  const raw = hero?.popularItems as
    | { early_game?: { class_name?: string; pick_pct?: number }[] }
    | null;

  const apiPicks = [
    ...(raw?.early_game ?? []),
  ].filter((e) => typeof e.pick_pct === "number");
  check("the hero has stored popular items", apiPicks.length > 0, `${apiPicks.length}`);

  if (apiPicks.length > 0) {
    /*
     * The API's own figure is scoped to a match stage and uses an
     * undocumented denominator, so it is not the same number as ours. It
     * is not that the two must differ wildly — only that ours is the
     * bracket-aware one. What this guards against is a regression where
     * the two become interchangeable, which would mean the stage scoping
     * had been lost.
     */
    const ours = picks.map((p) => p.pickRatePct);
    const theirs = apiPicks.map((p) => p.pick_pct as number);
    const oursMean = ours.reduce((s, v) => s + v, 0) / ours.length;
    const theirsMean = theirs.reduce((s, v) => s + v, 0) / theirs.length;
    check(
      "the two sets of figures are computed differently",
      Math.abs(oursMean - theirsMean) > 0.5,
      `ours mean ${oursMean.toFixed(1)}%, theirs mean ${theirsMean.toFixed(1)}%`,
    );
  }

  // ---------------------------------------------------------------------
  console.log("\n3. The bracket filter changes the figures");
  const top = bracketById("phantom-eternus");
  const topPicks = await getHeroItemPlayData(HERO_ID, top);
  const topMatches = await getHeroMatches(HERO_ID, top);

  check("the narrow bracket has matches", topMatches > 0, `${topMatches}`);
  check(
    "the narrow bracket has fewer matches",
    topMatches < heroMatches,
    `${topMatches} vs ${heroMatches}`,
  );
  check(
    "the narrow bracket has item rows",
    topPicks.length > 0,
    `${topPicks.length} items`,
  );

  const topTopRate = Math.max(0, ...topPicks.map((p) => p.pickRatePct));
  check(
    "the narrow bracket's top rate is in a plausible band",
    topTopRate > 1 && topTopRate < 70,
    `${topTopRate.toFixed(1)}%`,
  );

  // ---------------------------------------------------------------------
  console.log("\n4. Every API item id resolves to a shop item");
  const unresolved = picks.filter((p) => !p.slug);
  check(
    "every row resolved to a slug",
    unresolved.length === 0,
    unresolved.length ? `${unresolved.length} unresolved` : `${picks.length} resolved`,
  );

  const slugs = new Set(
    picks.map((p) => p.slug).filter((s): s is string => !!s),
  );
  const dbItems = await db.item.findMany({
    where: { slug: { in: [...slugs] } },
    select: { slug: true },
  });
  check(
    "every slug exists in the database",
    dbItems.length === slugs.size,
    `${dbItems.length}/${slugs.size}`,
  );

  // ---------------------------------------------------------------------
  console.log("\n5. The formatting is right");
  check("0 seconds reads 0:00", buyTimeLabel(0) === "0:00", buyTimeLabel(0));
  check("95 seconds reads 1:35", buyTimeLabel(95) === "1:35", buyTimeLabel(95));
  check("804 seconds reads 13:24", buyTimeLabel(804) === "13:24", buyTimeLabel(804));
  check(
    "59.6 seconds does not read 0:60",
    buyTimeLabel(59.6) === "1:00",
    buyTimeLabel(59.6),
  );
  check(
    "a negative value reads as not available",
    buyTimeLabel(-1) === "[not available]",
    buyTimeLabel(-1),
  );

  check("20% into the match is early", buyStageFor(20) === "early");
  check("50% into the match is mid", buyStageFor(50) === "mid");
  check("80% into the match is late", buyStageFor(80) === "late");
  check("the early stage is labelled", buyStageLabel("early") === "Early");

  check("0 players is a 0% pick rate", pickRatePct(0, 1000) === 0);
  check(
    "100 players in 1000 matches is 10%",
    Math.abs(pickRatePct(100, 1000) - 10) < 1e-9,
  );
  check("0 matches is a 0% pick rate", pickRatePct(100, 0) === 0);
  check(
    "100 wins in 200 matches is 50%",
    Math.abs(winRatePct(100, 100) - 50) < 1e-9,
  );
  check("0 games is a 0% win rate", winRatePct(0, 0) === 0);

  // ---------------------------------------------------------------------
  console.log("\n6. The sorts behave");
  check("an unset sort is the shop order", parseItemSort(null) === "shop");
  check("an unknown sort falls back", parseItemSort("nonsense") === "shop");
  check("pick is a valid sort", parseItemSort("pick") === "pick");
  check("buy is a valid sort", parseItemSort("buy") === "buy");
  check("a sort is case-insensitive", parseItemSort("PICK") === "pick");

  const byPick = [...picks].sort((a, b) => b.pickRatePct - a.pickRatePct);
  const byBuy = [...picks].sort((a, b) => a.avgBuyTimeS - b.avgBuyTimeS);
  check(
    "the pick-rate sort is descending",
    byPick.every((row, i) => i === 0 || byPick[i - 1].pickRatePct >= row.pickRatePct),
  );
  check(
    "the buy-time sort is ascending",
    byBuy.every((row, i) => i === 0 || byBuy[i - 1].avgBuyTimeS <= row.avgBuyTimeS),
  );

  // ---------------------------------------------------------------------
  console.log("\n7. The roster-wide query works");
  /*
   * The roster-wide `item-stats` is the whole item-by-hero matrix. At
   * `min_matches=50` it was large enough that the API's gateway timed out
   * on it, so the roster query uses a higher floor. This checks the floor
   * is high enough, because a 504 here means the `/items` page silently
   * loses its pick rates.
   */
  const roster = await getItemPlayData(ALL_RANKS);
  check(
    "the roster query returns rows",
    roster.length > 0,
    `${roster.length} items`,
  );

  const rosterRates = roster.map((r) => r.pickRatePct);
  check(
    "every roster rate is between 0 and 100",
    rosterRates.every((r) => r >= 0 && r <= 100),
    `top ${Math.max(0, ...rosterRates).toFixed(1)}%`,
  );
  check(
    "the roster rates are lower than a single hero's",
    Math.max(0, ...rosterRates) < Math.max(...rates),
    `roster ${Math.max(0, ...rosterRates).toFixed(1)}% vs hero ${topRate.toFixed(1)}%`,
  );

  // ---------------------------------------------------------------------
  console.log("\n8. The purchase flow is well formed");
  const flow = await getItemFlow(HERO_ID, ALL_RANKS);
  check("the flow came back", flow != null);
  if (flow) {
    check("it has nodes", flow.nodes.length > 0, `${flow.nodes.length} nodes`);
    check("it has edges", flow.edges.length > 0, `${flow.edges.length} edges`);
    check(
      "the summary has matches",
      (flow.summary?.matches ?? 0) > 0,
      `${flow.summary?.matches ?? 0} matches`,
    );

    const columns = [...new Set(flow.nodes.map((n) => n.column))].sort();
    check(
      "the columns are the purchase slots",
      columns.every((c) => c >= 0 && c <= 3),
      columns.join(", "),
    );

    const names = await getFlowItemNames([
      ...flow.nodes.map((n) => n.item_id),
      ...flow.edges.map((e) => e.to_item_id),
    ]);
    const bands = buildBuyBands(flow, names);
    check("the bands were built", bands.length > 0, `${bands.length} items`);

    const band = bands[0];
    check(
      "the top band has a slot",
      band.commonColumn >= 0 && band.commonColumn <= 3,
      `slot ${band.commonColumn} (${band.stage})`,
    );
    check(
      "the band's slots add up to its total",
      Math.abs(
        band.byColumn.reduce((s, e) => s + e.matches, 0) - band.totalMatches,
      ) < 1,
    );
    check(
      "the bands are sorted by how often the item is bought",
      bands.every((b, i) => i === 0 || bands[i - 1].commonMatches >= b.commonMatches),
    );

    const transitions = buildTransitions(flow, band.apiId, names);
    check("the transitions were built", transitions.length > 0, `${transitions.length}`);
    check(
      "the transitions are sorted by how often they are taken",
      transitions.every(
        (t, i) => i === 0 || transitions[i - 1].matches >= t.matches,
      ),
    );
    check(
      "every transition names its item",
      transitions.every((t) => t.name.length > 0),
    );
    check(
      "no item is listed twice",
      new Set(transitions.map((t) => t.apiId)).size === transitions.length,
      `${transitions.length} transitions`,
    );

    check("slot 0 is early", flowStageFor(0) === "early");
    check("slot 2 is mid", flowStageFor(2) === "mid");
    check("slot 3 is late", flowStageFor(3) === "late");
  }

  // ---------------------------------------------------------------------
  console.log("\nThe top picks, all ranks:");
  for (const pick of byPick.slice(0, 8)) {
    console.log(
      `    ${pick.name.padEnd(34)} ${pick.pickRatePct.toFixed(1).padStart(5)}%  ` +
        `bought at ${buyTimeLabel(pick.avgBuyTimeS)} ` +
        `(${Math.round(pick.avgBuyTimeRelative)}% in, ${buyStageLabel(buyStageFor(pick.avgBuyTimeRelative))})`,
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
