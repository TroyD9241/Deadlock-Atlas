/**
 * Verifies what the ingest actually wrote.
 *
 * Run with: npm run check:seed  (needs a completed ingest)
 *
 * Catches the failure modes that are invisible until data is loaded: a folder
 * matcher that quietly matches everything, an accent that reads as grey, an
 * accentText that misses 4.5:1, and an ability model that duplicates shared
 * abilities instead of joining them.
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { contrastRatio } from "../src/lib/theme";
import { MIN_CHROMA } from "./ingest/normalize";
import { labChroma } from "./ingest/normalize";

type HeroRow = {
  name: string;
  slug: string;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  apiAccent: string | null;
  accentSource: string;
  palette: unknown;
  artwork: unknown;
  needsReview: boolean;
};

type FolderArtwork = { folder?: string; links?: { lore?: string | null } };

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(
    `${ok ? "pass" : "FAIL"}  ${label.padEnd(48)}${detail !== undefined ? `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`,
  );
}

async function main() {
  const heroes = (await db.hero.findMany({
    orderBy: { name: "asc" },
  })) as HeroRow[];

  const abilities = await db.ability.count();
  const universal = await db.ability.count({ where: { kind: "universal" } });
  const join = await db.heroAbility.count();
  const items = await db.item.count();
  const patches = await db.patch.count();
  const snapHeroes = await db.heroSnapshot.count();
  const snapAbilities = await db.abilitySnapshot.count();

  // ── folder matching ──────────────────────────────────────────────────────
  const folders = new Map<string, string[]>();
  for (const h of heroes) {
    const f = (h.artwork as FolderArtwork | null)?.folder;
    if (f) (folders.get(f) ?? folders.set(f, []).get(f)!).push(h.name);
  }
  const collisions = [...folders.entries()].filter(([, n]) => n.length > 1);
  check("no folder claimed by two heroes", collisions.length === 0, collisions.map(([f, n]) => `${f}:${n}`));
  check(
    "matched folder count equals folder count",
    folders.size === 44,
    `matched=${folders.size} expected=44`,
  );

  // ── accents ──────────────────────────────────────────────────────────────
  const grey = heroes.filter(
    (h) => h.accent && labChroma(h.accent).chroma < MIN_CHROMA && !h.needsReview,
  );
  check("no unreviewed grey accent", grey.length === 0, grey.map((h) => h.name));

  const badText = heroes.filter(
    (h) => h.accentText && contrastRatio(h.accentText, "#141824") < 4.5,
  );
  check(
    "every accentText reaches 4.5:1 on --panel",
    badText.length === 0,
    badText.map((h) => `${h.name} ${h.accentText}`),
  );

  const noAccent = heroes.filter((h) => !h.accent);
  check("every hero has an accent", noAccent.length === 0, noAccent.map((h) => h.name));

  // ── abilities must be joined, never duplicated per hero ──────────────────
  const perAbility = await db.heroAbility.findMany({
    select: { abilityId: true },
  });
  const shareBy = new Map<number, number>();
  for (const r of perAbility) shareBy.set(r.abilityId, (shareBy.get(r.abilityId) ?? 0) + 1);
  const topShare = Math.max(0, ...shareBy.values());
  check(
    "universal abilities are shared, not duplicated",
    universal > 0 && topShare > 10,
    `universal=${universal} maxHeroesPerAbility=${topShare}`,
  );

  // ── versioning ───────────────────────────────────────────────────────────
  const stamped = await db.heroSnapshot.findMany({
    distinct: ["patchId"],
    select: { patchId: true },
  });
  check("snapshots stamped to a build", stamped.length >= 1, `patchIds=${stamped.length}`);
  check(
    "exactly one current build",
    (await db.patch.count({ where: { isCurrent: true } })) === 1,
  );

  // ── the two names that do not line up ────────────────────────────────────
  const doorman = heroes.find((h) => h.name === "The Doorman");
  check(
    "The Doorman folder matched despite the name",
    doorman?.artwork !== null && doorman !== undefined,
    (doorman?.artwork as FolderArtwork | null)?.folder ?? "none",
  );

  const loreLinks = heroes.filter((h) => (h.artwork as FolderArtwork | null)?.links?.lore);
  check("wiki lore links stored", loreLinks.length >= 42, `withLink=${loreLinks.length}`);

  console.log("");
  console.log(`heroes ${heroes.length}, abilities ${abilities} (${universal} universal)`);
  console.log(`heroAbility join ${join}, items ${items}, patches ${patches}`);
  console.log(`snapshots ${snapHeroes} hero / ${snapAbilities} ability`);
  console.log("");

  if (failures === 0) {
    console.log("All seed checks passed.");
  } else {
    console.log(`${failures} seed check(s) failed.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    failures += 1;
  })
  .finally(async () => {
    await db.$disconnect();
    if (failures > 0) process.exit(1);
  });