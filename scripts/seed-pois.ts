/**
 * Seed HeroPoi rows from data/curated/pois.json.
 *
 * Run: npx tsx scripts/seed-pois.ts
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/lib/db";

const POIS_PATH = path.resolve(process.cwd(), "data/curated/pois.json");

async function main() {
  const raw = JSON.parse(await readFile(POIS_PATH, "utf8")) as Record<
    string,
    Array<{ anchor: string; label: string; body: string; order?: number }>
  >;

  const heroes = await db.hero.findMany({ select: { id: true, slug: true } });
  const idBySlug = new Map(heroes.map((h) => [h.slug, h.id]));

  let count = 0;
  for (const [slug, pois] of Object.entries(raw)) {
    const heroId = idBySlug.get(slug);
    if (heroId === undefined) {
      console.warn(`  skip ${slug}: no hero row`);
      continue;
    }
    for (const poi of pois) {
      await db.heroPoi.upsert({
        where: { heroId_anchor: { heroId, anchor: poi.anchor } },
        create: {
          heroId,
          anchor: poi.anchor,
          label: poi.label,
          body: poi.body,
          order: poi.order ?? 0,
        },
        update: {
          label: poi.label,
          body: poi.body,
          order: poi.order ?? 0,
        },
      });
      count += 1;
    }
  }
  console.log(`upserted ${count} hero POIs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());