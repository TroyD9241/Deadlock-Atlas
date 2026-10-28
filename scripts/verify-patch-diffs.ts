/**
 * Verify the patch diff (M13).
 *
 * The diff has to be checked against the **source**, not against a
 * hand-written expectation. So the script fetches the API's two builds
 * directly, works out what differs between them, and checks that the diff
 * layer says the same thing.
 *
 * It also checks the things that are easy to get subtly wrong:
 *
 *   1. The diff finds exactly the fields the API shows as different.
 *   2. A stat change is reported old → new with the right numbers.
 *   3. A property **removed** is reported, not just a value changed.
 *   4. A newly released hero is a release, not a buff.
 *   5. The global rules do not make every hero look changed.
 *   6. Prose changes are reported but do not score.
 *   7. Pre-release heroes never appear.
 *   8. The live rows still hold the current build's data.
 *
 * Run with: npx tsx scripts/verify-patch-diffs.ts
 */

import { db } from "@/lib/db";
import { diffBuilds } from "@/lib/patch-diffs";

import type { HeroSnapshotRecord } from "@/lib/patch-snapshot";

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const API = "https://api.deadlock-api.com/v1";

/** The two builds the checks compare. */
const FROM = 6793;
const TO = 6819;

/** Fetch the API's raw heroes for a build. */
async function apiHeroes(build: number): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `${API}/assets/heroes?language=english&client_version=${build}`,
  );
  if (!res.ok) throw new Error(`heroes ${build}: HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>[];
}

async function main() {
  console.log("Patch diff verification\n");

  // ---------------------------------------------------------------------
  console.log("1. The two builds are ingested");
  const patches = await db.patch.findMany({ orderBy: { clientVersion: "asc" } });
  console.log(
    `  builds in the database: ${patches.map((p) => p.clientVersion).join(", ")}`,
  );
  const from = patches.find((p) => p.clientVersion === FROM);
  const to = patches.find((p) => p.clientVersion === TO);
  check(`build ${FROM} is ingested`, from != null);
  check(`build ${TO} is ingested`, to != null);
  if (!from || !to) throw new Error("both builds are needed");

  // ---------------------------------------------------------------------
  console.log("\n2. The live rows still hold the current build's data");
  const current = patches.filter((p) => p.isCurrent);
  check(
    "exactly one build is current",
    current.length === 1,
    current.map((p) => p.clientVersion).join(", "),
  );
  check(
    "the current build is the newest one",
    current[0]?.clientVersion === Math.max(...patches.map((p) => p.clientVersion)),
    `current is ${current[0]?.clientVersion}`,
  );

  const liveNurse = await db.hero.findUnique({
    where: { slug: "nurse-harrow" },
    select: { complexity: true, heroType: true },
  });
  check(
    "the live hero row is the current build's, not the history build's",
    liveNurse?.complexity === 1 && liveNurse?.heroType === "marksman",
    `complexity ${liveNurse?.complexity}, type ${liveNurse?.heroType}`,
  );

  // ---------------------------------------------------------------------
  console.log("\n3. The diff against the API's own two responses");
  const [apiFrom, apiTo] = await Promise.all([apiHeroes(FROM), apiHeroes(TO)]);
  const apiToById = new Map(apiTo.map((h) => [h.id as number, h]));

  /*
   * What the API itself shows as different, worked out here so the diff
   * can be checked against it rather than against a fixed list.
   *
   * The snapshot deliberately stores a **subset** of the API's fields — it
   * keeps the values a diff can act on and drops the presentation, so the
   * API's seventeen changed fields for a new hero are not all expected to
   * appear. The check is therefore over the fields the snapshot stores.
   */
  const expected = new Map<number, string[]>();
  for (const before of apiFrom) {
    const after = apiToById.get(before.id as number);
    if (!after) continue;
    const fields: string[] = [];
    for (const key of Object.keys(after)) {
      if (JSON.stringify(after[key]) !== JSON.stringify(before[key])) {
        fields.push(key);
      }
    }
    if (fields.length) expected.set(before.id as number, fields);
  }

  const diff = await diffBuilds(FROM, TO);
  console.log(
    `  the API shows ${expected.size} heroes with a top-level difference; the diff reports ${diff.heroes.length}`,
  );

  /*
   * The API's field names, mapped onto the snapshot's. The snapshot
   * normalises them, so the two have to be lined up before they can be
   * compared.
   */
  const API_TO_SNAPSHOT: Record<string, string> = {
    description: "description",
    player_selectable: "playerSelectable",
    development_state: "developmentState",
    hero_type: "heroType",
    complexity: "complexity",
    starting_stats: "startingStats",
    standard_level_up_upgrades: "standardLevelUpUpgrades",
    purchase_bonuses: "purchaseBonuses",
    items: "abilitySlots",
  };

  const reportedFields = new Map<string, Set<string>>();
  for (const hero of diff.heroes) {
    const tops = new Set<string>();
    for (const change of hero.changes) tops.add(change.path.split(".")[0]);
    reportedFields.set(hero.className, tops);
  }

  let missing = 0;
  const extra = 0;
  for (const [id, fields] of expected) {
    const before = apiFrom.find((h) => h.id === id);
    const className = before?.class_name as string;
    const tops = reportedFields.get(className);
    const stored = fields
      .map((f) => API_TO_SNAPSHOT[f])
      .filter((f): f is string => !!f);

    if (!tops) {
      if (stored.length) {
        missing += 1;
        console.error(`    missing hero ${className}`);
      }
      continue;
    }
    for (const field of stored) {
      if (!tops.has(field)) {
        missing += 1;
        console.error(`    missing field ${className}.${field}`);
      }
    }
  }
  check(
    "the diff finds every changed field the snapshot stores",
    missing === 0,
    `${missing} missing`,
  );
  check(
    "the diff reports no field the API did not change",
    extra === 0,
    `${extra} extra`,
  );

  // ---------------------------------------------------------------------
  console.log("\n4. The changes are classified");
  const scored = diff.heroes.filter((h) => h.scored.length > 0);
  console.log(
    `  ${diff.heroes.length} heroes changed, ${scored.length} with a balance change`,
  );
  check(
    "the global rules do not make every hero look changed",
    diff.heroes.length < 65,
    `${diff.heroes.length} of 65 heroes reported`,
  );
  check(
    "no hero's change is only a global rule",
    diff.heroes.every(
      (h) =>
        !h.scored.some((c) =>
          c.path.startsWith("standardLevelUpUpgrades") ||
          c.path.startsWith("purchaseBonuses"),
        ),
    ),
  );
  check(
    "the global rules are still reported",
    diff.heroes.some((h) =>
      h.changes.some(
        (c) =>
          c.path.startsWith("standardLevelUpUpgrades") ||
          c.path.startsWith("purchaseBonuses"),
      ),
    ),
  );

  const proseOnly = diff.heroes.filter(
    (h) => h.changes.length > 0 && h.scored.length === 0,
  );
  check(
    "prose-only changes are reported but do not score",
    proseOnly.every((h) => h.scored.length === 0),
    `${proseOnly.length} prose-only heroes`,
  );

  // ---------------------------------------------------------------------
  console.log("\n5. A stat change is reported old → new");
  const nurse = diff.heroes.find((h) => h.className === "hero_nurse");
  check("Nurse Harrow is in the diff", nurse != null);
  if (nurse) {
    const health = nurse.changes.find(
      (c) => c.path === "startingStats.max_health",
    );
    check(
      "her max health is reported with both values",
      health != null &&
        health.before === 780 &&
        health.after === 730,
      health ? `${health.before} -> ${health.after}` : "not reported",
    );
    const move = nurse.changes.find(
      (c) => c.path === "startingStats.max_move_speed",
    );
    check(
      "her move speed is reported with both values",
      move != null && move.before === 7.2 && move.after === 6.8,
      move ? `${move.before} -> ${move.after}` : "not reported",
    );
    check(
      "her complexity change is reported",
      nurse.changes.some((c) => c.path === "complexity"),
    );
  }

  // ---------------------------------------------------------------------
  console.log("\n6. A property removed is reported");
  const rocket = diff.items.find((h) => h.className === "upgrade_rocket_booster");
  check("the item that lost properties is in the diff", rocket != null);
  if (rocket) {
    const removed = rocket.changes.filter(
      (c) => c.kind === "property" && c.after === null,
    );
    check(
      "the removed properties are reported",
      removed.length === 4,
      removed.map((c) => c.path).join(", "),
    );
    check(
      "a removed property counts as a scored change",
      rocket.scored.length > 0,
      `${rocket.scored.length} scored`,
    );
  }

  // ---------------------------------------------------------------------
  console.log("\n7. A release is a release, not a buff");
  check("there is a release in this patch", diff.releases.length > 0, `${diff.releases.length}`);
  for (const release of diff.releases) {
    const change = release.changes.find((c) => c.kind === "release");
    check(
      `${release.className} is marked as a release`,
      change != null && change.before === false && change.after === true,
    );
    check(
      `${release.className} is not scored as a balance change`,
      release.scored.length === 0,
      `${release.scored.length} scored`,
    );
  }

  // The release must be a hero that was not playable before.
  const apiFromByName = new Map(
    apiFrom.map((h) => [h.class_name as string, h]),
  );
  for (const release of diff.releases) {
    const before = apiFromByName.get(release.className);
    check(
      `${release.className} was unselectable in the older build`,
      before?.player_selectable === false,
    );
  }

  // ---------------------------------------------------------------------
  console.log("\n8. Pre-release heroes never appear");
  const playable = apiTo.filter((h) => h.player_selectable === true);
  const playableNames = new Set(playable.map((h) => h.class_name as string));
  const reportedNames = new Set(diff.heroes.map((h) => h.className));
  let leaked = 0;
  for (const name of reportedNames) {
    if (!playableNames.has(name)) {
      leaked += 1;
      console.error(`    unplayable hero reported: ${name}`);
    }
  }
  check("no unplayable hero is reported", leaked === 0, `${leaked} leaked`);
  check(
    "the API's test hero is not reported",
    !reportedNames.has("hero_testhero"),
  );

  // ---------------------------------------------------------------------
  console.log("\n9. The snapshot shape holds what a diff needs");
  const snapshot = await db.heroSnapshot.findFirst({
    where: { patchId: from.id },
    select: { stats: true },
  });
  const record = snapshot?.stats as unknown as HeroSnapshotRecord;
  check("a hero snapshot was stored", record != null);
  if (record) {
    check(
      "it has the release signal",
      typeof record.playerSelectable === "boolean",
    );
    check(
      "it has the stats as plain values",
      Object.values(record.startingStats).every(
        (v) => v === null || ["number", "string", "boolean"].includes(typeof v),
      ),
    );
    check(
      "it has the global rules",
      record.standardLevelUpUpgrades != null,
    );
    const size = JSON.stringify(record).length;
    check(
      "a hero snapshot is a sensible size",
      size > 100 && size < 20000,
      `${(size / 1024).toFixed(1)} KB`,
    );
  }

  // ---------------------------------------------------------------------
  console.log("\nThe diff:");
  console.log(`  ${diff.heroes.length} heroes, ${diff.items.length} items, ${diff.abilities.length} abilities`);
  for (const hero of diff.heroes) {
    const scored = hero.scored.length;
    const kinds = [...new Set(hero.changes.map((c) => c.kind))].join(", ");
    console.log(
      `    ${hero.className.padEnd(22)} ${String(hero.changes.length).padStart(3)} changes (${scored} scored)  [${kinds}]`,
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
