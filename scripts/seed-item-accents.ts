/**
 * Seed item accents from the API's own slot colours.
 *
 * Items carry no colour of their own, so an item's theme is the colour the
 * game uses for its slot: weapon -> weapon_color, vitality ->
 * fortitude_color, spirit -> spirit_color. Those constants come from the
 * API's colors.json, which the ingest caches at
 * data/raw/<version>/colors.json.
 *
 * Run: npx tsx scripts/seed-item-accents.ts
 *
 * Re-runnable: it recomputes every row from the slot each time.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/lib/db";
import {
  API_COLOR_CONSTANTS,
  isRgbRecord,
  itemAccent,
  rgbToHex,
} from "../src/lib/item-colors";

const RAW_DIR = path.resolve(process.cwd(), "data/raw");

/** Newest cached API snapshot. */
async function latestRawDir(): Promise<string> {
  const versions = (await readdir(RAW_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => Number(b) - Number(a));
  if (versions.length === 0) {
    throw new Error(`no cached API snapshots under ${RAW_DIR}`);
  }
  return path.join(RAW_DIR, versions[0]);
}

async function main() {
  const dir = await latestRawDir();
  const colorsPath = path.join(dir, "colors.json");
  const colors = JSON.parse(await readFile(colorsPath, "utf8")) as Record<
    string,
    unknown
  >;

  // The slot colours come from the API's own document, so the hexes are
  // verified against it rather than hard-coded twice.
  const slotHex: Record<string, string> = {};
  for (const [slot, constant] of Object.entries(API_COLOR_CONSTANTS)) {
    const record = colors[constant];
    if (!isRgbRecord(record)) {
      throw new Error(`colors.json has no usable "${constant}"`);
    }
    slotHex[slot] = rgbToHex(record);
    console.log(`${slot}: ${constant} -> ${slotHex[slot]}`);
  }

  const items = await db.item.findMany({
    where: { slotType: { not: null } },
    select: { id: true, slug: true, slotType: true, nameSource: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const accent = itemAccent(item.slotType);
    if (!accent) {
      skipped += 1;
      continue;
    }
    await db.item.update({
      where: { id: item.id },
      data: {
        accent: accent.accent,
        accentText: accent.accentText,
        onAccent: accent.onAccent,
        accentSource: accent.accentSource,
        // The palette stays empty: the slot colour is the item's identity, and
        // there is no art-derived palette to store (design.md 3.6).
      },
    });
    updated += 1;
  }

  console.log(
    `updated ${updated} item accents (${skipped} without a themed slot) from ${colorsPath}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
