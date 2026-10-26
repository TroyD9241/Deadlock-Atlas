"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { costLabel } from "@/lib/item-filter-shared";
import { slotLabel } from "@/lib/item-colors";
import { itemImage } from "@/components/item/item-card";
import { contributionText, itemContributions } from "@/lib/stat-map";

import type { PickerItem, StatMap } from "./types";
import type { ItemFilters } from "@/lib/item-filter-shared";

/**
 * The item picker.
 *
 * A dialog over the page: a search box, the results, and what each item
 * would add. The stats are shown before the item is committed, so a reader
 * can compare two items without swapping the build back and forth.
 */

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (slug: string) => void;
  statMap: StatMap;
};

export function Picker({ open, onClose, onPick, statMap }: Props) {
  const [results, setResults] = useState<PickerItem[]>([]);
  // Starts true so the first open shows "Loading…" rather than a flash of
  // "no items found" before the request lands.
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ItemFilters>({
    search: "",
  });
  const [facets, setFacets] = useState<
    Array<{ id: string; label: string; count: number }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("q", filters.search);
      if (filters.slots) params.set("slot", filters.slots.join(","));
      if (filters.tiers) params.set("tier", filters.tiers.join(","));
      if (filters.gameFilters) params.set("filter", filters.gameFilters.join(","));
      if (filters.facets) params.set("facet", filters.facets.join(","));
      if (filters.minCost != null) params.set("minCost", String(filters.minCost));
      if (filters.maxCost != null) params.set("maxCost", String(filters.maxCost));
      if (filters.inShopOnly) params.set("shop", "1");
      if (filters.starterOnly) params.set("starter", "1");

      const res = await fetch(`/api/items?${params.toString()}`);
      const data = (await res.json()) as {
        items?: PickerItem[];
        counts?: { facets?: Array<{ id: string; label: string; count: number }> };
      };
      setResults(data.items ?? []);
      setFacets(data.counts?.facets ?? []);
    } catch {
      setResults([]);
      setFacets([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Choose an item"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#000a",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        className="plate"
        style={{
          width: "min(860px, 100%)",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: 18,
          background: "#141824",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Choose an item
          </div>
          <button
            type="button"
            className="chip"
            onClick={onClose}
            style={{ cursor: "pointer", border: "none", font: "inherit" }}
          >
            Close
          </button>
        </div>

        <input
          type="search"
          value={filters.search ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          placeholder="Search items…"
          aria-label="Search items"
          className="search-field"
          style={{ width: "100%", marginBottom: 12 }}
        />

        {/* Filter rail */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
            marginBottom: 12,
            paddingBottom: 10,
            borderBottom: "1px solid var(--line)",
          }}
        >
          {/* Slot */}
          <FilterSelect
            label="Slot"
            options={[
              { value: "weapon", label: "Weapon" },
              { value: "vitality", label: "Vitality" },
              { value: "spirit", label: "Spirit" },
            ]}
            selected={filters.slots}
            onChange={(v) => setFilters((f) => ({ ...f, slots: v }))}
            placeholder="All slots"
          />

          {/* Tier */}
          <FilterSelect
            label="Tier"
            options={[
              { value: "1", label: "Tier 1" },
              { value: "2", label: "Tier 2" },
              { value: "3", label: "Tier 3" },
              { value: "4", label: "Tier 4" },
              { value: "5", label: "Tier 5" },
            ]}
            selected={filters.tiers?.map(String)}
            onChange={(v) => setFilters((f) => ({ ...f, tiers: v.map(Number) }))}
            placeholder="All tiers"
          />

          {/* Cost */}
          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="number"
              min="0"
              placeholder="Min souls"
              value={filters.minCost ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minCost: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              style={{ width: "50%", padding: "6px 8px", fontSize: 11 }}
            />
            <input
              type="number"
              min="0"
              placeholder="Max souls"
              value={filters.maxCost ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  maxCost: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              style={{ width: "50%", padding: "6px 8px", fontSize: 11 }}
            />
          </div>

          {/* Game filters */}
          <FilterSelect
            label="Shop filter"
            options={[
              { value: "anti_cc", label: "Anti-CC" },
              { value: "jump_and_dash", label: "Jump & dash" },
              { value: "regen", label: "Regen" },
              { value: "debuff_resist", label: "Debuff resist" },
              { value: "teleport", label: "Teleport" },
              { value: "invulnerability", label: "Invulnerability" },
              { value: "mobility_reduction", label: "Slows" },
              { value: "stealth", label: "Stealth" },
              { value: "spirit_vuln", label: "Spirit vuln" },
              { value: "bullet_vuln", label: "Bullet vuln" },
              { value: "hp", label: "Health" },
              { value: "melee", label: "Melee" },
              { value: "stamina", label: "Stamina" },
            ]}
            selected={filters.gameFilters}
            onChange={(v) => setFilters((f) => ({ ...f, gameFilters: v }))}
            placeholder="All filters"
          />
        </div>

        {/* Facets with counts */}
        {facets.length > 0 && (
          <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                marginBottom: 6,
              }}
            >
              Modifiers
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {facets.map((facet) => (
                <label
                  key={facet.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "2px 6px",
                    border: "1px solid var(--line)",
                    borderRadius: 4,
                    fontSize: 10,
                    color: "#c3c5d4",
                    cursor: "pointer",
                    background: "#ffffff04",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filters.facets?.includes(facet.id) ?? false}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        facets: e.target.checked
                          ? [...(prev.facets ?? []), facet.id]
                          : (prev.facets ?? []).filter((x) => x !== facet.id),
                      }))
                    }
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontSize: 9 }}>{facet.label}</span>
                  <span className="tag-muted" style={{ fontSize: 8 }}>
                    {facet.count}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Loading…</p>
        ) : results.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>No items found.</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {results.slice(0, 80).map((item) => {
              const src = itemImage(item);
              const chips = itemContributions(
                { slug: item.slug, name: item.name, properties: item.properties },
                statMap,
              ).slice(0, 3);

              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => onPick(item.slug)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    background: "#ffffff06",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "inherit",
                  }}
                >
                  {src ? (
                    <Image
                      src={src}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      style={{ width: 34, height: 34, objectFit: "contain" }}
                    />
                  ) : null}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 13,
                        color: "#fff",
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>
                      {slotLabel(item.slotType)}
                      {item.tier ? ` · Tier ${item.tier}` : ""}
                      {item.cost != null ? ` · ${costLabel(item.cost)}` : ""}
                    </div>

                    {chips.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                          marginTop: 5,
                        }}
                      >
                        {chips.map((chip) => (
                          <span
                            key={chip.key}
                            className="tag-muted"
                            style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                          >
                            {chip.label} {contributionText(chip)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A tiny multi-select chip dropdown.
 *
 * Keeps the picker self-contained; no new dependency.
 */
function FilterSelect({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[] | undefined;
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const sel = selected ?? [];

  return (
    <div
      style={{
        position: "relative",
      }}
      onClick={() => setOpen(!open)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "6px 8px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          fontSize: 11,
          color: sel.length ? "#fff" : "var(--muted)",
          background: "#ffffff04",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {sel.length === 0 ? (
          <span style={{ color: "var(--muted)" }}>{placeholder}</span>
        ) : sel.length <= 2 ? (
          <span>{sel.map((s) => options.find((o) => o.value === s)?.label ?? String(s)).join(", ")}</span>
        ) : (
          <span>{sel.length} selected</span>
        )}
        <span style={{ fontSize: 10, color: "var(--muted)" }}>
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            border: "1px solid var(--line)",
            borderRadius: 6,
            background: "#141824",
            padding: 4,
            zIndex: 1,
          }}
        >
          {options.map((opt) => (
            <label
              key={String(opt.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 8px",
                fontSize: 11,
                color: "#c3c5d4",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={sel.includes(opt.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...sel, opt.value]
                      : sel.filter((v) => v !== opt.value),
                  )
                }
                style={{ accentColor: "var(--accent)" }}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}