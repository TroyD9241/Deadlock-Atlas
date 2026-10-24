/**
 * Seed Hero tagline and summary from data/curated/summaries.json.
 *
 * Run: npx tsx scripts/seed-summaries.ts
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/lib/db";

const SUMMARIES_PATH = path.resolve(process.cwd(), "data/curated/summaries.json");

async function main() {
  const raw = JSON.parse(await readFile(SUMMARIES_PATH, "utf8")) as Record<
    string,
    { tagline: string; summary: string }
  >;

  let count = 0;
  for (const [slug, data] of Object.entries(raw)) {
    const hero = await db.hero.findUnique({ where: { slug } });
    if (!hero) {
      console.warn(`  skip ${slug}: no hero row`);
      continue;
    }
    await db.hero.update({
      where: { slug },
      data: { tagline: data.tagline, summary: data.summary },
    });
    count += 1;
  }
  console.log(`updated ${count} hero summaries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());