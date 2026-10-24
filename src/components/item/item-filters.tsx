"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { COST_STEPS } from "@/lib/item-filter-shared";

import type { ItemFacet } from "@/lib/item-filter-shared";

/**
 * The filter rail for `/items`.
 *
 * Every filter is a link, not a client-side state change: the page is a
 * server component, so the filtered rows come from the server and the URL
 * is the state. That makes a filtered view linkable, keeps the back button
 * working, and needs no client router round trips.
 *
 * The current query is read from `window.location` rather than
 * `useSearchParams`: the hook makes the route wait for a Suspense boundary,
 * which stops the page from hydrating.
 */

export type FilterCounts = {
  slots: Record<string, number>;
  tiers: Record<string, number>;
  gameFilters: { id: string; label: string; count: number }[];
  facets: { id: string; label: string; count: number }[];
  total: number;
};

type Props = {
  counts: FilterCounts;
  facets: ItemFacet[];
  /** The current search text, from the URL. */
  initialQuery: string;
  /** The filters that are on, from the URL. */
  active: {
    slots: string[];
    tiers: string[];
    gameFilters: string[];
    facets: string[];
    maxCost: string | null;
    inShopOnly: boolean;
    starterOnly: boolean;
    query: string;
  };
};

const SLOT_LABELS: Record<string, string> = {
  weapon: "Weapon",
  vitality: "Vitality",
  spirit: "Spirit",
};

export function ItemFilters({ counts, facets, initialQuery, active }: Props) {
  const pathname = usePathname();
  // The rail starts open: it is the point of the page. It can be collapsed
  // for a wider view of the grid.
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState(initialQuery);

  /**
   * The URL for a filter set.
   *
   * It is built from the active filters the server rendered, not from
   * window.location: during a client navigation the browser's URL can be
   * out of step with the page on screen, and toggling against it would add
   * or drop filters the user never picked.
   */
  const hrefFor = (
    key: string,
    value: string,
    mode: "toggle" | "set" = "toggle",
  ) => {
    const params = new URLSearchParams();

    const list = (values: string[]) => values.join(",");
    if (active.slots.length) params.set("slot", list(active.slots));
    if (active.tiers.length) params.set("tier", list(active.tiers));
    if (active.gameFilters.length) params.set("filter", list(active.gameFilters));
    if (active.facets.length) params.set("facet", list(active.facets));
    if (active.maxCost) params.set("maxCost", active.maxCost);
    if (active.inShopOnly) params.set("shop", "1");
    if (active.starterOnly) params.set("starter", "1");
    if (active.query) params.set("q", active.query);

    if (mode === "set") {
      if (params.get(key) === value) params.delete(key);
      else params.set(key, value);
    } else {
      const existing = (params.get(key) ?? "").split(",").filter(Boolean);
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      if (next.length) params.set(key, next.join(","));
      else params.delete(key);
    }

    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  const chipStyle = { cursor: "pointer", border: "none", font: "inherit" } as const;

  const activeChip = (
    filterKey: string,
    value: string,
    label: string,
    count?: number,
    on?: boolean,
  ) => (
    <Link
      key={`${filterKey}-${value}`}
      href={hrefFor(filterKey, value)}
      scroll={false}
      aria-pressed={on}
      className={`chip${on ? " active" : ""}`}
      style={{
        ...chipStyle,
        opacity: count === 0 && !on ? 0.4 : 1,
      }}
    >
      {label}
      {count != null ? (
        <span
          style={{
            marginLeft: 7,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            opacity: 0.6,
          }}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );

  const activeCount =
    active.slots.length +
    active.tiers.length +
    active.gameFilters.length +
    active.facets.length +
    (active.maxCost ? 1 : 0) +
    (active.inShopOnly ? 1 : 0) +
    (active.starterOnly ? 1 : 0) +
    (active.query ? 1 : 0);

  return (
    <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <form
          action={pathname}
          method="get"
          style={{ position: "relative", flex: "1 1 200px", maxWidth: 320 }}
        >
          {/* Keep the other filters when the search is submitted. */}
          {(
            [
              ["slot", active.slots],
              ["tier", active.tiers],
              ["filter", active.gameFilters],
              ["facet", active.facets],
              ["maxCost", active.maxCost ? [active.maxCost] : []],
              ["shop", active.inShopOnly ? ["1"] : []],
              ["starter", active.starterOnly ? ["1"] : []],
            ] as const
          ).flatMap(([key, values]) =>
            values.map((value) => (
              <input key={`${key}-${value}`} type="hidden" name={key} value={value} />
            )),
          )}
          <input
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            aria-label="Search items"
            className="search-field"
            style={{ width: "100%" }}
          />
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            {counts.total} items
          </span>
          <button
            type="button"
            className="chip"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={chipStyle}
          >
            {open ? "Hide filters" : `Filters${activeCount ? ` (${activeCount})` : ""}`}
          </button>
        </div>
      </div>

      {activeCount > 0 ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            ...active.slots.map((v) => ["slot", v, SLOT_LABELS[v] ?? v] as const),
            ...active.tiers.map((v) => ["tier", v, `Tier ${v}`] as const),
            ...active.gameFilters.map((v) => [
              "filter",
              v,
              counts.gameFilters.find((g) => g.id === v)?.label ?? v,
            ] as const),
            ...active.facets.map((v) => [
              "facet",
              v,
              facets.find((f) => f.id === v)?.label ?? v,
            ] as const),
            ...(active.maxCost
              ? ([["maxCost", active.maxCost, `≤ ${active.maxCost} gold`]] as const)
              : []),
            ...(active.inShopOnly ? ([["shop", "1", "In shop"]] as const) : []),
            ...(active.starterOnly ? ([["starter", "1", "Starter items"]] as const) : []),
            ...(active.query ? ([["q", active.query, `“${active.query}”`]] as const) : []),
          ].map(([key, value, label]) => (
            <Link
              key={`${key}-${value}`}
              href={hrefFor(key, value, key === "maxCost" || key === "q" ? "set" : "toggle")}
              scroll={false}
              className="tag-muted"
              style={{
                cursor: "pointer",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {label}
              <span aria-hidden="true">×</span>
            </Link>
          ))}
          <Link
            href={pathname}
            scroll={false}
            className="back-link"
            style={{ fontSize: 10 }}
          >
            Clear all
          </Link>
        </div>
      ) : null}

      <div
        style={{
          display: open ? "grid" : "none",
          gap: 16,
          padding: 16,
          border: "1px solid var(--line)",
          borderRadius: 14,
          background: "#ffffff05",
        }}
      >
        <FilterGroup label="Slot">
          {Object.entries(counts.slots).map(([slot, count]) =>
            activeChip("slot", slot, SLOT_LABELS[slot] ?? slot, count, active.slots.includes(slot)),
          )}
        </FilterGroup>

        <FilterGroup label="Tier">
          {Object.entries(counts.tiers)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([tier, count]) =>
              activeChip("tier", tier, `Tier ${tier}`, count, active.tiers.includes(tier)),
            )}
        </FilterGroup>

        <FilterGroup label="Maximum cost">
          {COST_STEPS.map((cost) =>
            activeChip(
              "maxCost",
              String(cost),
              String(cost),
              undefined,
              active.maxCost === String(cost),
            ),
          )}
        </FilterGroup>

        <FilterGroup label="Modifier">
          {facets.map((facet) => {
            const count = counts.facets.find((f) => f.id === facet.id)?.count ?? 0;
            return (
              <span key={facet.id} title={facet.description}>
                {activeChip(
                  "facet",
                  facet.id,
                  facet.label,
                  count,
                  active.facets.includes(facet.id),
                )}
              </span>
            );
          })}
        </FilterGroup>

        {counts.gameFilters.length > 0 ? (
          <FilterGroup label="Game filters">
            {counts.gameFilters.map((filter) =>
              activeChip(
                "filter",
                filter.id,
                filter.label,
                filter.count,
                active.gameFilters.includes(filter.id),
              ),
            )}
          </FilterGroup>
        ) : null}

        <FilterGroup label="Availability">
          {activeChip("shop", "1", "In shop", undefined, active.inShopOnly)}
          {activeChip("starter", "1", "Starter items", undefined, active.starterOnly)}
        </FilterGroup>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--accent)",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}
