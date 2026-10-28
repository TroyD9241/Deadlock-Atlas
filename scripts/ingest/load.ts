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
  abilitySnapshotRecord,
  heroSnapshotRecord,
  itemSnapshotRecord,
} from "@/lib/patch-snapshot";
import {
  heroAbilityRefs,
  normaliseAbility,
  normaliseHero,
  normaliseItem,
  resolveHeroModel,
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

  /*
   * `--history` loads a build as history rather than as the current one.
   *
   * Without it, loading a build overwrites the live `Hero` and `Item` rows
   * and flips `isCurrent`, so the site would show old heroes. With it, only
   * the snapshots are written and the live rows are left alone — which is
   * what ingesting an older build for the patch history needs.
   */
  const history = process.argv.includes("--history");

  console.log(
    `loading build ${clientVersion}${history ? " (history only)" : ""}`,
  );
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

  // Models endpoint is a CDN bucket listing; cache is best-effort (may be absent
  // on older builds). Missing file means no models, not a hard failure.
  let rawModels: unknown = null;
  try {
    rawModels = JSON.parse(
      await readFile(path.join(dir, "models.json"), "utf8"),
    );
  } catch {
    console.log("  (no models.json cache; skipping model ingest)");
  }

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
    create: { clientVersion, isCurrent: !history },
    update: history ? {} : { isCurrent: true },
  });

  // Only one build can be current. A history load must not steal that.
  if (!history) {
    await db.patch.updateMany({
      where: { clientVersion: { not: clientVersion } },
      data: { isCurrent: false },
    });
  }

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
    // A history load writes snapshots only. The live rows hold the current
    // build's data and must not be overwritten with an older build's.
    if (history) continue;
    const slug = h.slug;
    await db.hero.upsert({
      where: { slug },
      create: {
        slug,
        apiId: h.apiId,
        name: h.name,
        complexity: h.complexity,
        heroType: h.heroType,
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
                // The API's own art. The banner is built from the wide
                // background_image plus the icon_hero_card cutout.
                images: h.apiImages,
                folder: h.folder.folder,
                artworkType: h.folder.artworkType,
                links: h.folder.links,
              }
            : { images: h.apiImages },
        ),
        startingStats: h.startingStats as never,
        itemSlots: h.itemSlots as never,
        itemSlotInfo: h.itemSlotInfo as never,
        popularItems: h.popularItems as never,
        draftBucketing: h.draftBucketing as never,
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
        heroType: h.heroType,
        isReleased: h.selectable,
        isDisabled: h.isDisabled,
        isInDevelopment: h.isInDevelopment,
        artwork: json(
          h.folder
            ? {
                // The API's own art. The banner is built from the wide
                // background_image plus the icon_hero_card cutout.
                images: h.apiImages,
                folder: h.folder.folder,
                artworkType: h.folder.artworkType,
                links: h.folder.links,
              }
            : { images: h.apiImages },
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
        popularItems: h.popularItems as never,
        draftBucketing: h.draftBucketing as never,
        heroStatsUi: h.heroStatsUi as never,
        statsDisplay: h.statsDisplay as never,
        shopStatDisplay: h.shopStatDisplay as never,
        physics: h.physics as never,
        tags: json(h.tags),
      },
    });
    heroCount += 1;
  }
  console.log(
    history ? "skipped live hero rows (history load)" : `upserted ${heroCount} heroes`,
  );

  /*
   * Resolve database ids now that every hero exists, keyed by slug.
   *
   * A history load can meet a hero that only existed in the build being
   * loaded — the game has removed heroes before, and a hero that has been
   * removed is not in the live table. Those cannot be snapshotted against
   * a row, so they are skipped rather than failing the load.
   */
  const dbHeroes = await db.hero.findMany({ select: { id: true, slug: true } });
  const heroIdBySlug = new Map(dbHeroes.map((h) => [h.slug, h.id]));
  const heroId = (slug: string): number | null =>
    heroIdBySlug.get(slug) ?? null;

  // ── 3D models ────────────────────────────────────────────────────────────
  if (rawModels && !history) {
    let modelCount = 0;
    for (const h of normalisedHeroes) {
      const id = heroIdBySlug.get(h.slug);
      if (id === undefined) continue;
      const raw = (rawHeroes as ApiHero[]).find((r) => r.id === h.apiId);
      const model = raw ? resolveHeroModel(rawModels, raw.class_name) : null;
      if (model) {
        await db.heroModel.upsert({
          where: { heroId: id },
          create: { heroId: id, modelUrl: model.modelUrl, modelKey: model.modelKey, group: model.group },
          update: { modelUrl: model.modelUrl, modelKey: model.modelKey, group: model.group },
        });
        modelCount += 1;
      }
    }
    console.log(`upserted ${modelCount} hero models`);
  }

  // ── abilities and the hero join ─────────────────────────────────────────
  const abilities = items.filter((i) => i.type === "ability");
  const abilityByClass = new Map<string, ReturnType<typeof normaliseAbility>>();
  for (const a of abilities) {
    const n = normaliseAbility(a);
    abilityByClass.set(n.className, n);
  }

  let abilityCount = 0;
  for (const n of abilityByClass.values()) {
    // History mode writes the snapshot only.
    if (history) continue;
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
    if (history) continue;
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
      const hId = heroId(h.slug);
      if (hId === null) continue;
      await db.heroAbility.upsert({
        where: { heroId_slot: { heroId: hId, slot: ref.slot } },
        create: {
          heroId: hId,
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
    history
      ? "skipped live ability and join rows (history load)"
      : `upserted ${abilityCount} abilities, ${joinCount} hero-ability links` +
          (dangling ? `, ${dangling} refs had no matching ability` : ""),
  );

  // ── shop items ──────────────────────────────────────────────────────────
  const shopItems = items.filter((i) => i.type !== "ability");
  let itemCount = 0;
  for (const raw of shopItems) {
    if (history) continue;
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
        isActive: n.isActive,
        shopFilters: n.shopFilters,
        weaponInfo: n.weaponInfo as never,
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
        isActive: n.isActive,
        shopFilters: n.shopFilters,
        weaponInfo: n.weaponInfo as never,
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
  console.log(
    history
      ? "skipped live shop items (history load)"
      : `upserted ${itemCount} shop items`,
  );

  // ── snapshots ───────────────────────────────────────────────────────────
  /*
   * The snapshot is what a patch diff reads, so it is written in the
   * normalised shape rather than the raw API record: values rather than the
   * engine's full property objects, which is the difference between 2.22 MB
   * and 7.84 MB per build.
   *
   * A snapshot is keyed on the entity's own row, so an entity that only
   * existed in the build being loaded — a hero the game has since removed
   * — cannot be snapshotted and is skipped.
   */
  const patch = await db.patch.findUniqueOrThrow({ where: { clientVersion } });

  const rawHeroById = new Map(heroes.map((h) => [h.id, h]));

  let snapHeroes = 0;
  let skippedHeroes = 0;
  for (const h of normalisedHeroes) {
    const hId = heroId(h.slug);
    if (hId === null) {
      skippedHeroes += 1;
      continue;
    }
    const raw = rawHeroById.get(h.apiId);
    if (!raw) continue;
    const record = heroSnapshotRecord(raw as unknown as Record<string, unknown>);
    await db.heroSnapshot.upsert({
      where: { heroId_patchId: { heroId: hId, patchId: patch.id } },
      create: {
        heroId: hId,
        patchId: patch.id,
        stats: record as never,
      },
      update: { stats: record as never },
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
    // The snapshot is built from the raw API record, not the normalised
    // one, because the raw record still has the fields a diff needs.
    const rawAbility = items.find((i) => i.class_name === a.className);
    if (!rawAbility) continue;
    const record = abilitySnapshotRecord(
      rawAbility as unknown as Record<string, unknown>,
    );
    await db.abilitySnapshot.upsert({
      where: { abilityId_patchId: { abilityId: row.id, patchId: patch.id } },
      create: {
        abilityId: row.id,
        patchId: patch.id,
        values: record as never,
      },
      update: { values: record as never },
    });
    snapAbilities += 1;
  }

  /*
   * The item snapshots, which were never written before. An item can leave
   * the shop and come back, so the item rows are looked up rather than
   * assumed.
   */
  let snapItems = 0;
  let skippedItems = 0;
  const itemRows = await db.item.findMany({
    where: { apiId: { in: items.map((i) => String(i.id)) } },
    select: { id: true, apiId: true },
  });
  const itemRowByApiId = new Map(itemRows.map((r) => [String(r.apiId), r.id]));

  for (const raw of items) {
    const rowId = itemRowByApiId.get(String(raw.id));
    if (rowId === undefined) {
      skippedItems += 1;
      continue;
    }
    const record = itemSnapshotRecord(raw as unknown as Record<string, unknown>);
    await db.itemSnapshot.upsert({
      where: { itemId_patchId: { itemId: rowId, patchId: patch.id } },
      create: {
        itemId: rowId,
        patchId: patch.id,
        data: record as never,
      },
      update: { data: record as never },
    });
    snapItems += 1;
  }

  console.log(
    `upserted ${snapHeroes} hero, ${snapAbilities} ability and ${snapItems} item snapshots` +
      (skippedHeroes ? `, ${skippedHeroes} heroes had no row` : "") +
      (skippedItems ? `, ${skippedItems} items had no row` : ""),
  );
  console.log("");

  await db.$disconnect();
  console.log("load complete");
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
