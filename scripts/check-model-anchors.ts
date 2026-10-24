/**
 * Validate that every anchor in data/curated/pois.json exists as a node name
 * inside that hero's GLB. Run before seeding.
 *
 * Run: npx tsx scripts/check-model-anchors.ts
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "../src/lib/db";

const POIS_PATH = path.resolve(process.cwd(), "data/curated/pois.json");

async function fetchGlbJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  const text = await res.text();
  const start = text.indexOf('{"asset"');
  if (start < 0) throw new Error(`no JSON chunk in ${url}`);
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  return JSON.parse(text.substring(start, end));
}

async function main() {
  const raw = JSON.parse(await readFile(POIS_PATH, "utf8")) as Record<
    string,
    Array<{ anchor: string; label: string; body: string; order?: number }>
  >;

  const heroes = await db.hero.findMany({
    select: { slug: true, model: { select: { modelUrl: true } } },
  });
  const modelBySlug = new Map(heroes.map((h) => [h.slug, h.model?.modelUrl ?? null]));

  let errors = 0;
  for (const [slug, pois] of Object.entries(raw)) {
    const url = modelBySlug.get(slug);
    if (!url) {
      console.error(`  ${slug}: no model URL in DB`);
      errors += 1;
      continue;
    }
    const gltf = await fetchGlbJson(url);
    const nodeNames = new Set((gltf.nodes as { name?: string }[]).map((n) => n.name).filter(Boolean));
    const meshNames = new Set((gltf.meshes as { name?: string }[]).map((m) => m.name).filter(Boolean));
    for (const poi of pois) {
      if (poi.anchor.startsWith("prop:")) {
        const suffix = poi.anchor.slice(5);
        const found = [...meshNames].some((n) => (n ?? "").endsWith(suffix));
        if (!found) {
          console.error(`  ${slug}: prop anchor "${poi.anchor}" not found in model meshes`);
          errors += 1;
        }
      } else if (!nodeNames.has(poi.anchor)) {
        console.error(`  ${slug}: anchor "${poi.anchor}" not found in model`);
        errors += 1;
      }
    }
    console.log(`  ${slug}: ${pois.length} POIs, all anchors valid`);
  }

  if (errors > 0) {
    console.error(`\n${errors} error(s) found.`);
    process.exit(1);
  }
  console.log("\nall anchors valid");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());