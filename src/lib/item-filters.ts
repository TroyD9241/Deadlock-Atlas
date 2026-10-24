/**
 * Item filtering.
 *
 * The site's `/items` page filters on the game's own data: the slot, the
 * tier, the cost, the API's `shop_filters` taxonomy, and a curated set of
 * modifier facets (data/curated/item-facets.json) that name the 441 raw
 * property keys in player language.
 *
 * All filters live in the URL, so a filtered view is linkable and the back
 * button works.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";

import type { ItemSummary } from "@/lib/queries";

export {
  COST_STEPS,
  gameFilterLabel,
  parseItemFilters,
} from "@/lib/item-filter-shared";
export type { ItemFilters } from "@/lib/item-filter-shared";

import { gameFilterLabel } from "@/lib/item-filter-shared";
import type { ItemFacet, ItemFilters } from "@/lib/item-filter-shared";

const FACETS_PATH = path.resolve(
  process.cwd(),
  "data/curated/item-facets.json",
);

let facetCache: ItemFacet[] | null = null;

/** The curated facets, read once per process. */
export async function getItemFacets(): Promise<ItemFacet[]> {
  if (facetCache) return facetCache;
  const raw = JSON.parse(await readFile(FACETS_PATH, "utf8")) as {
    facets: ItemFacet[];
  };
  facetCache = raw.facets;
  return facetCache;
}

/** A filtered item row: the summary plus the properties the facets read. */
export type ItemFilterRow = ItemSummary & {
  properties: unknown;
};

const SELECT = {
  slug: true,
  name: true,
  nameSource: true,
  slotType: true,
  tier: true,
  cost: true,
  itemType: true,
  shopable: true,
  startTrained: true,
  isActive: true,
  shopFilters: true,
  image: true,
  imageWebp: true,
  shopImage: true,
  accent: true,
  accentText: true,
  onAccent: true,
  accentSource: true,
  properties: true,
} as const;

/** The property keys an item carries with a non-zero value. */
export function itemPropertyKeys(properties: unknown): Set<string> {
  const keys = new Set<string>();
  if (!properties || typeof properties !== "object") return keys;
  for (const [key, raw] of Object.entries(
    properties as Record<string, unknown>,
  )) {
    if (!raw || typeof raw !== "object") continue;
    const value = (raw as { value?: unknown }).value;
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n !== 0) keys.add(key);
  }
  return keys;
}

/**
 * Does an item match a facet?
 *
 * A facet matches when the item carries one of the facet's property keys
 * with a non-zero value, or one of the facet's game shop filters.
 */
export function matchesFacet(
  row: Pick<ItemFilterRow, "properties" | "shopFilters">,
  facet: ItemFacet,
): boolean {
  if (row.shopFilters?.some((f) => facet.shopFilters.includes(f))) return true;
  const keys = itemPropertyKeys(row.properties);
  return facet.properties.some((key) => keys.has(key));
}

/**
 * The rows matching a filter set.
 *
 * The slot-less rows are excluded: they are the API's weapon-upgrade
 * entries, not shop items.
 */
export async function getFilteredItems(
  filters: ItemFilters,
): Promise<ItemFilterRow[]> {
  const rows = await db.item.findMany({
    where: {
      slotType: { not: null },
      ...(filters.slots?.length ? { slotType: { in: filters.slots } } : {}),
      ...(filters.tiers?.length ? { tier: { in: filters.tiers } } : {}),
      ...(filters.minCost != null ? { cost: { gte: filters.minCost } } : {}),
      ...(filters.maxCost != null ? { cost: { lte: filters.maxCost } } : {}),
      ...(filters.inShopOnly ? { isActive: true } : {}),
      ...(filters.starterOnly ? { startTrained: true } : {}),
      ...(filters.gameFilters?.length
        ? { shopFilters: { hasSome: filters.gameFilters } }
        : {}),
    },
    orderBy: [{ slotType: "asc" }, { tier: "asc" }, { name: "asc" }],
    select: SELECT,
  });

  let result = rows;

  if (filters.facets?.length) {
    const facets = await getItemFacets();
    const wanted = facets.filter((f) => filters.facets?.includes(f.id));
    if (wanted.length > 0) {
      result = result.filter((row) =>
        wanted.some((facet) => matchesFacet(row, facet)),
      );
    }
  }

  if (filters.search?.trim()) {
    const needle = filters.search.trim().toLowerCase();
    result = result.filter((row) => {
      const haystack = `${row.name} ${row.slug} ${row.shopFilters.join(" ")}`;
      return haystack.toLowerCase().includes(needle);
    });
  }

  return result;
}

/** Counts per slot, for the filter chips. */
export async function getSlotCounts(
  filters: ItemFilters,
): Promise<Record<string, number>> {
  const rows = await getFilteredItems({
    ...filters,
    slots: undefined,
  });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (!row.slotType) continue;
    counts[row.slotType] = (counts[row.slotType] ?? 0) + 1;
  }
  return counts;
}

/** Counts per tier. */
export async function getTierCounts(
  filters: ItemFilters,
): Promise<Record<string, number>> {
  const rows = await getFilteredItems({ ...filters, tiers: undefined });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.tier == null) continue;
    const key = String(row.tier);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Counts per game shop filter, over the other filters. */
export async function getGameFilterCounts(
  filters: ItemFilters,
): Promise<Record<string, number>> {
  const rows = await getFilteredItems({ ...filters, gameFilters: undefined });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const filter of row.shopFilters ?? []) {
      counts[filter] = (counts[filter] ?? 0) + 1;
    }
  }
  return counts;
}

/** Counts per curated facet, over the other filters. */
export async function getFacetCounts(
  filters: ItemFilters,
): Promise<Record<string, number>> {
  const rows = await getFilteredItems({ ...filters, facets: undefined });
  const facets = await getItemFacets();
  const counts: Record<string, number> = {};
  for (const facet of facets) {
    counts[facet.id] = rows.filter((row) => matchesFacet(row, facet)).length;
  }
  return counts;
}

/** The distinct game shop filters that exist, with labels. */
export async function getGameFilters(): Promise<
  { id: string; label: string; count: number }[]
> {
  const rows = await db.item.findMany({
    where: { slotType: { not: null } },
    select: { shopFilters: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const filter of row.shopFilters ?? []) {
      counts.set(filter, (counts.get(filter) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ id, label: gameFilterLabel(id), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Build a URL search string from filters, omitting empty values. */
export function itemFilterParams(filters: ItemFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.slots?.length) params.set("slot", filters.slots.join(","));
  if (filters.tiers?.length) params.set("tier", filters.tiers.join(","));
  if (filters.gameFilters?.length) params.set("filter", filters.gameFilters.join(","));
  if (filters.facets?.length) params.set("facet", filters.facets.join(","));
  if (filters.minCost != null) params.set("minCost", String(filters.minCost));
  if (filters.maxCost != null) params.set("maxCost", String(filters.maxCost));
  if (filters.inShopOnly) params.set("shop", "1");
  if (filters.starterOnly) params.set("starter", "1");
  if (filters.search) params.set("q", filters.search);
  return params;
}
