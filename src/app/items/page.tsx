import Link from "next/link";

import { ItemCard, ItemCardGrid } from "@/components/item/item-card";
import { ItemFilters } from "@/components/item/item-filters";
import { ItemPopover } from "@/components/item/item-popover";
import { RankPicker } from "@/components/play-data/rank-picker";
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
import { ITEM_SORTS, parseItemSort } from "@/lib/item-sorts";
import { getItemPlayData } from "@/lib/play-data";
import { bracketFromParam } from "@/lib/rank-brackets";

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
  const sort = parseItemSort(params.get("sort"));
  const bracket = bracketFromParam(params.get("rank"));

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

  /*
   * The play data comes from the analytics API through the cache. It is a
   * layer over the page, not the page itself, so a failure here leaves the
   * item list intact — it just means no pick rates are shown.
   */
  const playData = await getItemPlayData(bracket);
  const playBySlug = new Map(
    playData.filter((row) => row.slug).map((row) => [row.slug as string, row]),
  );

  /*
   * The shop order is the query's own order, so it is only re-applied when
   * a different sort was asked for. The other sorts move the items into
   * the order the reader asked for.
   */
  const sorted = [...items];
  if (sort === "pick") {
    sorted.sort((a, b) => {
      const aRate = playBySlug.get(a.slug)?.pickRatePct ?? -1;
      const bRate = playBySlug.get(b.slug)?.pickRatePct ?? -1;
      return bRate - aRate || a.name.localeCompare(b.name);
    });
  } else if (sort === "buy") {
    sorted.sort((a, b) => {
      const aTime = playBySlug.get(a.slug)?.avgBuyTimeS ?? Number.POSITIVE_INFINITY;
      const bTime = playBySlug.get(b.slug)?.avgBuyTimeS ?? Number.POSITIVE_INFINITY;
      return aTime - bTime || a.name.localeCompare(b.name);
    });
  }

  /*
   * The rank picker and the sort control both change the query string, so
   * they have to carry the rest of it across. These are the parameters
   * that are not theirs.
   */
  const rankParams = [...params.entries()].filter(
    ([key]) => key !== "rank",
  );
  const sortParams = [...params.entries()].filter(([key]) => key !== "sort");

  const hrefWith = (entries: Array<[string, string]>) => {
    const next = new URLSearchParams(entries);
    const search = next.toString();
    return search ? `/items?${search}` : "/items";
  };

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

      {playData.length > 0 ? (
        <section
          className="plate"
          style={{ padding: 16, display: "grid", gap: 14 }}
        >
          <RankPicker current={bracket} pathname="/items" otherParams={rankParams} />
        </section>
      ) : null}

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
          <>
            {playData.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                  }}
                >
                  Sort by
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ITEM_SORTS.map((option) => (
                    <Link
                      key={option.id}
                      href={
                        option.id === "shop"
                          ? hrefWith(sortParams)
                          : hrefWith([...sortParams, ["sort", option.id]])
                      }
                      scroll={false}
                      aria-current={sort === option.id ? "true" : undefined}
                      className={`chip${sort === option.id ? " active" : ""}`}
                      title={option.hint}
                      style={{
                        cursor: "pointer",
                        gap: 7,
                        minHeight: 44,
                        fontSize: 10,
                        letterSpacing: "0.1em",
                      }}
                    >
                      {option.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <ItemCardGrid>
              {sorted.map((item) => (
                <ItemPopover
                  key={item.slug}
                  slug={item.slug}
                  accent={item.accent}
                  accentText={item.accentText}
                  onAccent={item.onAccent}
                >
                  <ItemCard item={item} playData={playBySlug.get(item.slug)} />
                </ItemPopover>
              ))}
            </ItemCardGrid>
          </>
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
