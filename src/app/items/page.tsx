import Link from "next/link";

import { ItemCard, ItemCardGrid } from "@/components/item/item-card";
import { ItemFilters } from "@/components/item/item-filters";
import { ItemPopover } from "@/components/item/item-popover";
import { ITEM_SLOTS, slotLabel } from "@/lib/item-colors";
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

export const metadata = { title: "Items" };
export const instant = false;

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value != null) params.set(key, value);
  }

  const filters = parseItemFilters(params);

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

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Loadout
        </div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 30,
            letterSpacing: "-0.04em",
            fontFamily: "var(--font-display)",
          }}
        >
          Items
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, maxWidth: "58ch" }}>
          {items.length} items from the Deadlock shop. Each item is themed with
          the colour the game uses for its category.
        </p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 18,
          alignItems: "start",
        }}
        className="items-layout"
      >
        <ItemFilters
          key={filters.search ?? ""}
          initialQuery={filters.search ?? ""}
          active={{
            slots: filters.slots ?? [],
            tiers: (filters.tiers ?? []).map(String),
            gameFilters: filters.gameFilters ?? [],
            facets: filters.facets ?? [],
            maxCost:
              filters.maxCost != null ? String(filters.maxCost) : null,
            inShopOnly: filters.inShopOnly ?? false,
            starterOnly: filters.starterOnly ?? false,
            query: filters.search ?? "",
          }}
          facets={facets}
          counts={{
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
          }}
        />

        {items.length > 0 ? (
          <ItemCardGrid>
            {items.map((item) => (
              <ItemPopover
                key={item.slug}
                slug={item.slug}
                accent={item.accent}
                accentText={item.accentText}
                onAccent={item.onAccent}
              >
                <ItemCard item={item} />
              </ItemPopover>
            ))}
          </ItemCardGrid>
        ) : (
          <div className="plate" style={{ padding: 22 }}>
            <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
              No items match these filters.
            </p>
            <Link
              href="/items"
              className="back-link"
              style={{ display: "inline-block", marginTop: 10 }}
            >
              Clear filters
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
