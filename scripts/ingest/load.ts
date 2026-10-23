/**
 * Upserts the normalised data into Postgres.
 *
 * Idempotent by construction: every write is an `upsert` on a natural unique
 * key, so running the ingest twice must not create duplicates. Snapshots are
 * keyed on (entity, clientVersion) for the same reason — that is what lets
 * patch work start later with no backfill.
 *
 * Usage: npx tsx scripts/ingest/load.ts [clientVersion]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";
import { ApiHeroSchema, ApiItemSchema, type ApiHero, type ApiItem } from "@/lib/schemas";

import { RAW_DIR, latestClientVersion } from "./api";
import { extractFolderPalettes, readAllCharacterFolders } from "./characters";
import {
  heroAbilityRefs,
  normaliseAbility,
  normaliseHero,
  normaliseItem,
  slugify,
  type NormalisedHero,
} from "./normalize";

/**
 * Match a character folder to an API hero.
 *
 * Folder names cannot be the key on their own: our `Doorman` folder is the
 * API's "The Doorman", `Bebop`'s links file is named `Bepop.md`, and
 * "Mo & Krill" is URL-encoded in its wiki name. Compare the hero against the
 * folder's own names, never the hero's name against itself.
 */
function matchFolder(
  folder: { folder: string; displayName: string | null },
  hero: NormalisedHero,
): boolean {
  // A leading article is not part of the identity.
  const canon = (s: string) => slugify(s).replace(/^the-/, "");
  const folderNames = [folder.folder, folder.displayName]
    .filter(Boolean)
    .map((s) => canon(s as string));
  return folderNames.includes(canon(hero.name));
}

/**
 * Prisma distinguishes JSON null from SQL NULL. An absent value should leave
 * the column SQL NULL, so map null and undefined to undefined rather than
 * writing the JSON literal `null`.
 */
function json(value: unknown): never {
  return (value === null || value === undefined ? undefined : value) as never;
}

async function main() {
  const arg = process.argv[2];
  const clientVersion = arg ? Number(arg) : (await latestClientVersion()).clientVersion;
  const dir = path.join(RAW_DIR, String(clientVersion));

  console.log(`loading build ${clientVersion}`);
  console.log("");

  // ── read and validate the cache ─────────────────────────────────────────
  const rawHeroes = JSON.parse(
    await readFile(path.join(dir, "heroes.json"), "utf8"),
  ) as unknown[];
  const rawItems = JSON.parse(
    await readFile(path.join(dir, "items.json"), "utf8"),
  ) as unknown[];

  // Release state comes from the API's own only_active list, not from the
  // lagging in_development flag.
  const rawActive = JSON.parse(
    await readFile(path.join(dir, "heroes-active.json"), "utf8"),
  ) as unknown[];
  const activeIds = new Set(
    (rawActive as ApiHero[]).map((h) => h.id),
  );

  const heroes = rawHeroes.map((h) => ApiHeroSchema.parse(h)) as ApiHero[];
  const items = rawItems.map((i) => ApiItemSchema.parse(i)) as ApiItem[];

  console.log(
    `validated ${heroes.length} heroes (${activeIds.size} released per only_active), ${items.length} items`,
  );

  // ── character folders and their palettes ────────────────────────────────
  const folders = await readAllCharacterFolders();
  const palettes = await extractFolderPalettes(folders);
  const failedPalettes = [...palettes.values()].filter((p) => p.error);
  console.log(
    `read ${folders.length} character folders, ${palettes.size - failedPalettes.length} palettes extracted` +
      (failedPalettes.length ? `, ${failedPalettes.length} failed` : ""),
  );

  // ── the build record ────────────────────────────────────────────────────
  await db.patch.upsert({
    where: { clientVersion },
    create: { clientVersion, isCurrent: true },
    update: { isCurrent: true },
  });

  // Only one build can be current.
  await db.patch.updateMany({
    where: { clientVersion: { not: clientVersion } },
    data: { isCurrent: false },
  });

  // ── heroes ──────────────────────────────────────────────────────────────
  const normalisedHeroes = heroes.map((raw) => {
    const released = activeIds.has(raw.id);
    const n = normaliseHero(raw, { isReleased: released });
    const folder = folders.find((f) => matchFolder(f, n));
    const extracted = folder ? palettes.get(folder.folder)?.palette ?? null : null;
    if (extracted) {
      // Re-normalise with artwork available, so heroes keep a stored palette
      // for the colour study even though their accent comes from the API.
      const withArt = normaliseHero(raw, { extracted, isReleased: released });
      return { ...withArt, folder };
    }
    return { ...n, folder: folder ?? null };
  });

  let heroCount = 0;
  for (const h of normalisedHeroes) {
    const slug = h.slug;
    await db.hero.upsert({
      where: { slug },
      create: {
        slug,
        apiId: h.apiId,
        name: h.name,
        complexity: h.complexity,
        isReleased: h.selectable,
        isDisabled: h.isDisabled,
        isInDevelopment: h.isInDevelopment,
        officialRole: h.officialRole,
        officialPlaystyle: h.officialPlaystyle,
        officialLore: h.officialLore,
        accent: h.accent,
        accentText: h.accentText,
        onAccent: h.onAccent,
        apiAccent: h.apiAccent,
        accentSource: h.accentSource,
        palette: json(h.palette),
        needsReview: h.needsReview,
        artwork: json(
          h.folder
            ? {
                type: h.folder.artworkType,
                folder: h.folder.folder,
                links: h.folder.links,
              }
            : h.artwork,
        ),
        startingStats: h.startingStats as never,
        itemSlots: h.itemSlots as never,
        itemSlotInfo: h.itemSlotInfo as never,
        heroStatsUi: h.heroStatsUi as never,
        statsDisplay: h.statsDisplay as never,
        shopStatDisplay: h.shopStatDisplay as never,
        physics: h.physics as never,
        tags: json(h.tags),
      },
      update: {
        apiId: h.apiId,
        name: h.name,
        complexity: h.complexity,
        isReleased: h.selectable,
        isDisabled: h.isDisabled,
        isInDevelopment: h.isInDevelopment,
        artwork: json(
          h.folder
            ? {
                type: h.folder.artworkType,
                folder: h.folder.folder,
                links: h.folder.links,
              }
            : h.artwork,
        ),
        officialRole: h.officialRole,
        officialPlaystyle: h.officialPlaystyle,
        officialLore: h.officialLore,
        accent: h.accent,
        accentText: h.accentText,
        onAccent: h.onAccent,
        apiAccent: h.apiAccent,
        accentSource: h.accentSource,
        palette: json(h.palette),
        needsReview: h.needsReview,
        startingStats: h.startingStats as never,
        itemSlots: h.itemSlots as never,
        itemSlotInfo: h.itemSlotInfo as never,
        heroStatsUi: h.heroStatsUi as never,
        statsDisplay: h.statsDisplay as never,
        shopStatDisplay: h.shopStatDisplay as never,
        physics: h.physics as never,
        tags: json(h.tags),
      },
    });
    heroCount += 1;
  }
  console.log(`upserted ${heroCount} heroes`);

  // Resolve database ids now that every hero exists, keyed by slug.
  const dbHeroes = await db.hero.findMany({ select: { id: true, slug: true } });
  const heroIdBySlug = new Map(dbHeroes.map((h) => [h.slug, h.id]));
  const heroId = (slug: string): number => {
    const id = heroIdBySlug.get(slug);
    if (id === undefined) throw new Error(`no hero row for slug ${slug}`);
    return id;
  };

  // ── abilities and the hero join ─────────────────────────────────────────
  const abilities = items.filter((i) => i.type === "ability");
  const abilityByClass = new Map<string, ReturnType<typeof normaliseAbility>>();
  for (const a of abilities) {
    const n = normaliseAbility(a);
    abilityByClass.set(n.className, n);
  }

  let abilityCount = 0;
  for (const n of abilityByClass.values()) {
    await db.ability.upsert({
      where: { className: n.className },
      create: {
        className: n.className,
        apiId: n.apiId,
        name: n.name,
        kind: n.kind,
        image: n.image,
        imageWebp: n.imageWebp,
        description: n.description as never,
        properties: n.properties as never,
        upgrades: n.upgrades as never,
        videos: n.videos as never,
        behaviours: n.behaviours as never,
        dependantAbilities: n.dependantAbilities as never,
      },
      update: {
        name: n.name,
        kind: n.kind,
        image: n.image,
        imageWebp: n.imageWebp,
        description: n.description as never,
        properties: n.properties as never,
        upgrades: n.upgrades as never,
        videos: n.videos as never,
        behaviours: n.behaviours as never,
        dependantAbilities: n.dependantAbilities as never,
      },
    });
    abilityCount += 1;
  }

  // The join. Hero.items gives slot -> class name.
  const rawById = new Map(heroes.map((h) => [h.id, h]));

  let joinCount = 0;
  let dangling = 0;
  for (const h of normalisedHeroes) {
    const raw = rawById.get(h.apiId);
    if (!raw) continue;
    const refs = heroAbilityRefs(h, raw);
    for (const ref of refs) {
      const ability = await db.ability.findUnique({
        where: { className: ref.className },
        select: { id: true },
      });
      if (!ability) {
        // Heroes reference classes the assets endpoint does not return.
        dangling += 1;
        continue;
      }
      await db.heroAbility.upsert({
        where: { heroId_slot: { heroId: heroId(h.slug), slot: ref.slot } },
        create: {
          heroId: heroId(h.slug),
          abilityId: ability.id,
          slot: ref.slot,
          displayOrder: ref.displayOrder,
          isInnate: ref.isInnate,
        },
        update: {
          abilityId: ability.id,
          displayOrder: ref.displayOrder,
          isInnate: ref.isInnate,
        },
      });
      joinCount += 1;
    }
  }
  console.log(
    `upserted ${abilityCount} abilities, ${joinCount} hero-ability links` +
      (dangling ? `, ${dangling} refs had no matching ability` : ""),
  );

  // ── shop items ──────────────────────────────────────────────────────────
  const shopItems = items.filter((i) => i.type !== "ability");
  let itemCount = 0;
  for (const raw of shopItems) {
    const n = normaliseItem(raw);
    await db.item.upsert({
      where: { slug: n.slug },
      create: {
        slug: n.slug,
        className: n.className,
        apiId: n.apiId,
        name: n.name,
        nameSource: n.nameSource,
        itemType: n.itemType,
        slotType: n.slotType,
        tier: n.tier,
        cost: n.cost,
        shopable: n.shopable,
        startTrained: n.startTrained,
        image: n.image,
        imageWebp: n.imageWebp,
        shopImage: n.shopImage,
        description: n.description as never,
        properties: n.properties as never,
        upgrades: n.upgrades as never,
        tooltipSections: n.tooltipSections as never,
      },
      update: {
        className: n.className,
        apiId: n.apiId,
        name: n.name,
        nameSource: n.nameSource,
        itemType: n.itemType,
        slotType: n.slotType,
        tier: n.tier,
        cost: n.cost,
        shopable: n.shopable,
        startTrained: n.startTrained,
        image: n.image,
        imageWebp: n.imageWebp,
        shopImage: n.shopImage,
        description: n.description as never,
        properties: n.properties as never,
        upgrades: n.upgrades as never,
        tooltipSections: n.tooltipSections as never,
      },
    });
    itemCount += 1;
  }
  console.log(`upserted ${itemCount} shop items`);

  // ── snapshots ───────────────────────────────────────────────────────────
  const patch = await db.patch.findUniqueOrThrow({ where: { clientVersion } });

  let snapHeroes = 0;
  for (const h of normalisedHeroes) {
    await db.heroSnapshot.upsert({
      where: { heroId_patchId: { heroId: heroId(h.slug), patchId: patch.id } },
      create: {
        heroId: heroId(h.slug),
        patchId: patch.id,
        stats: (h.startingStats ?? {}) as never,
      },
      update: { stats: (h.startingStats ?? {}) as never },
    });
    snapHeroes += 1;
  }

  let snapAbilities = 0;
  for (const a of abilityByClass.values()) {
    const row = await db.ability.findUnique({
      where: { className: a.className },
      select: { id: true },
    });
    if (!row) continue;
    await db.abilitySnapshot.upsert({
      where: { abilityId_patchId: { abilityId: row.id, patchId: patch.id } },
      create: {
        abilityId: row.id,
        patchId: patch.id,
        values: (a.properties ?? {}) as never,
      },
      update: { values: (a.properties ?? {}) as never },
    });
    snapAbilities += 1;
  }

  console.log(`upserted ${snapHeroes} hero snapshots, ${snapAbilities} ability snapshots`);
  console.log("");

  await db.$disconnect();
  console.log("load complete");
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});