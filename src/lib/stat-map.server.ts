/**
 * Loads the curated stat map from disk.
 *
 * Server-only: it reads a file, so it must not be imported by a client
 * component. The pure logic lives in src/lib/stat-map.ts, which is safe in
 * the browser.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { StatMap } from "@/lib/stat-map";

const STAT_MAP_PATH = path.resolve(
  process.cwd(),
  "data/curated/stat-map.json",
);

let statMapCache: StatMap | null = null;

/** The curated modifier map, read once per process. */
export async function getStatMap(): Promise<StatMap> {
  if (statMapCache) return statMapCache;
  const raw = JSON.parse(await readFile(STAT_MAP_PATH, "utf8")) as StatMap;
  statMapCache = raw;
  return raw;
}
