import { NextResponse } from "next/server";

import { getItemsBySlugs } from "@/lib/queries";
import {
  getFacetCounts,
  getFilteredItems,
  getGameFilterCounts,
  getGameFilters,
  getItemFacets,
  getSlotCounts,
  getTierCounts,
  parseItemFilters,
} from "@/lib/item-filters";

/** The shape the client needs from an item row. */
function toRow(item: {
  slug: string;
  name: string;
  nameSource?: string;
  slotType: string | null;
  tier: number | null;
  cost: number | null;
  itemType?: string | null;
  image: string | null;
  imageWebp: string | null;
  shopImage: string | null;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  properties: unknown;
}) {
  return {
    slug: item.slug,
    name: item.name,
    nameSource: item.nameSource ?? "api",
    slotType: item.slotType,
    tier: item.tier,
    cost: item.cost,
    itemType: item.itemType ?? null,
    image: item.image,
    imageWebp: item.imageWebp,
    shopImage: item.shopImage,
    accent: item.accent,
    accentText: item.accentText,
    onAccent: item.onAccent,
    properties: item.properties,
  };
}

/**
 * The filtered item list, for the theorycraft picker.
 *
 * The picker filters as the user types, so it needs the same filter engine
 * as the /items page but without shipping the whole grid on every keystroke.
 *
 * `?slugs=a,b,c` is a different mode: it returns just those items, with
 * their properties, and skips the facet counts. The theorycraft board uses it
 * to fill its twelve wells — the full list is 1.4MB of properties, and the
 * board only ever looks at the items in the build.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  // The presence of the param, not its value, picks the mode: an empty
  // build asks for no items, and must not fall through to the whole shop.
  if (url.searchParams.has("slugs")) {
    const wanted = (url.searchParams.get("slugs") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 24);
    const items = await getItemsBySlugs(wanted);
    return NextResponse.json({
      items: Object.values(items).map(toRow),
      total: Object.keys(items).length,
    });
  }

  const filters = parseItemFilters(url.searchParams);

  const [items, facets, slotCounts, tierCounts, gameFilterCounts, facetCounts, gameFilters] =
    await Promise.all([
      getFilteredItems(filters),
      getItemFacets(),
      getSlotCounts(filters),
      getTierCounts(filters),
      getGameFilterCounts(filters),
      getFacetCounts(filters),
      getGameFilters(),
    ]);

  return NextResponse.json({
    items: items.map(toRow),
    counts: {
      slots: slotCounts,
      tiers: tierCounts,
      gameFilters: gameFilters.map((g) => ({
        ...g,
        count: gameFilterCounts[g.id] ?? 0,
      })),
      facets: facets.map((f) => ({
        id: f.id,
        label: f.label,
        count: facetCounts[f.id] ?? 0,
      })),
      total: items.length,
    },
  });
}
