"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { costLabel } from "@/lib/item-filter-shared";
import { slotLabel } from "@/lib/item-colors";
import { itemImage } from "@/components/item/item-card";
import { contributionText, itemContributions } from "@/lib/stat-map";
import { modifierDescription } from "@/lib/stat-glossary";
import { statGlossary } from "@/lib/stat-glossary";
import { Tooltip } from "@/components/hero/tooltip";

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
  const glossary = useMemo(() => statGlossary(), []);
  const [results, setResults] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ItemFilters>({
    search: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [facets, setFacets] = useState<
    Array<{ id: string; label: string; count: number }>
  >([]);
  const [counts, setCounts] = useState<{
    slots?: Record<string, number>;
    tiers?: Record<string, number>;
    gameFilters?: Array<{ id: string; label: string; count: number }>;
  }>({});
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput.trim() || undefined }));
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const id = ++requestIdRef.current;
    if (results.length === 0) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("q", filters.search);
      if (filters.slots?.length) params.set("slot", filters.slots.join(","));
      if (filters.tiers?.length) params.set("tier", filters.tiers.join(","));
      if (filters.gameFilters?.length) params.set("filter", filters.gameFilters.join(","));
      if (filters.facets?.length) params.set("facet", filters.facets.join(","));
      if (filters.minCost != null) params.set("minCost", String(filters.minCost));
      if (filters.maxCost != null) params.set("maxCost", String(filters.maxCost));
      if (filters.inShopOnly) params.set("shop", "1");
      if (filters.starterOnly) params.set("starter", "1");

      const res = await fetch(`/api/items?${params.toString()}`, { signal: controller.signal });
      const data = (await res.json()) as {
        items?: PickerItem[];
        counts?: {
          facets?: Array<{ id: string; label: string; count: number }>;
          slots?: Record<string, number>;
          tiers?: Record<string, number>;
          gameFilters?: Array<{ id: string; label: string; count: number }>;
        };
      };
      if (id !== requestIdRef.current) return;
      setResults(data.items ?? []);
      setFacets(data.counts?.facets ?? []);
      setCounts({
        slots: data.counts?.slots,
        tiers: data.counts?.tiers,
        gameFilters: data.counts?.gameFilters,
      });
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (id !== requestIdRef.current) return;
      setResults([]);
      setFacets([]);
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, [filters, results.length]);

  useEffect(() => {
    if (!open) return;
    // Deferred by a tick so the fetch starts outside the effect body. Calling
    // `load()` directly would set `loading` synchronously here, which causes
    // a cascading render on every open.
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => {
      clearTimeout(t);
      abortRef.current?.abort();
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
              fontFamily: "var(--font-body)",
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search items…"
          aria-label="Search items"
          className="search-field"
          style={{ width: "100%", marginBottom: 12 }}
        />

        {/* Filter rail */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 8,
            marginBottom: 10,
            paddingBottom: 10,
            borderBottom: "1px solid var(--line)",
            alignItems: "start",
          }}
        >
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
            counts={counts.slots}
          />

          <FilterSelect
            label="Tier"
            options={[
              { value: "1", label: "Tier 1" },
              { value: "2", label: "Tier 2" },
              { value: "3", label: "Tier 3" },
              { value: "4", label: "Tier 4" },
              { value: "5", label: "Tier 5" },
            ]}
            selected={(filters.tiers ?? []).map(String)}
            onChange={(v) => setFilters((f) => ({ ...f, tiers: v.map((x) => Number(x)) }))}
            placeholder="All tiers"
            counts={counts.tiers}
          />

          <div style={{ display: "flex", gap: 4 }}>
            <input
              type="number"
              min="0"
              placeholder="Min souls"
              value={filters.minCost ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  minCost: e.target.value === "" ? undefined : Number(e.target.value),
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
                  maxCost: e.target.value === "" ? undefined : Number(e.target.value),
                }))
              }
              style={{ width: "50%", padding: "6px 8px", fontSize: 11 }}
            />
          </div>

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
            counts={Object.fromEntries((counts.gameFilters ?? []).map((g) => [g.id, g.count]))}
            searchable
          />
        </div>

        {((filters.slots?.length ?? 0) +
          (filters.tiers?.length ?? 0) +
          (filters.gameFilters?.length ?? 0) +
          (filters.facets?.length ?? 0) +
          (filters.minCost != null ? 1 : 0) +
          (filters.maxCost != null ? 1 : 0) +
          (filters.search ? 1 : 0)) > 0 ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            {filters.slots?.map((s) => (
              <button
                key={`s-${s}`}
                type="button"
                className="tag-muted"
                style={{ cursor: "pointer", border: "none", background: "transparent" }}
                onClick={() => setFilters((f) => ({ ...f, slots: (f.slots ?? []).filter((x) => x !== s) }))}
              >
                {slotLabel(s)} ×
              </button>
            ))}
            {filters.tiers?.map((t) => (
              <button
                key={`t-${t}`}
                type="button"
                className="tag-muted"
                style={{ cursor: "pointer", border: "none", background: "transparent" }}
                onClick={() => setFilters((f) => ({ ...f, tiers: (f.tiers ?? []).filter((x) => x !== t) }))}
              >
                Tier {t} ×
              </button>
            ))}
            {filters.gameFilters?.map((g) => (
              <button
                key={`g-${g}`}
                type="button"
                className="tag-muted"
                style={{ cursor: "pointer", border: "none", background: "transparent" }}
                onClick={() => setFilters((f) => ({ ...f, gameFilters: (f.gameFilters ?? []).filter((x) => x !== g) }))}
              >
                {(counts.gameFilters ?? []).find((x) => x.id === g)?.label ?? g} ×
              </button>
            ))}
            {filters.facets?.map((f) => (
              <button
                key={`f-${f}`}
                type="button"
                className="tag-muted"
                style={{ cursor: "pointer", border: "none", background: "transparent" }}
                onClick={() => setFilters((prev) => ({ ...prev, facets: (prev.facets ?? []).filter((x) => x !== f) }))}
              >
                {facets.find((x) => x.id === f)?.label ?? f} ×
              </button>
            ))}
            {filters.minCost != null ? (
              <button type="button" className="tag-muted" style={{ cursor: "pointer", border: "none", background: "transparent" }} onClick={() => setFilters((f) => ({ ...f, minCost: undefined }))}>
                Min {filters.minCost} ×
              </button>
            ) : null}
            {filters.maxCost != null ? (
              <button type="button" className="tag-muted" style={{ cursor: "pointer", border: "none", background: "transparent" }} onClick={() => setFilters((f) => ({ ...f, maxCost: undefined }))}>
                Max {filters.maxCost} ×
              </button>
            ) : null}
            {filters.search ? (
              <button type="button" className="tag-muted" style={{ cursor: "pointer", border: "none", background: "transparent" }} onClick={() => { setSearchInput(""); setFilters((f) => ({ ...f, search: undefined })); }}>
                “{filters.search}” ×
              </button>
            ) : null}
            <button
              type="button"
              className="back-link"
              style={{ fontSize: 10 }}
              onClick={() =>
                setFilters({
                  search: undefined,
                  slots: [],
                  tiers: [],
                  gameFilters: [],
                  facets: [],
                  minCost: undefined,
                  maxCost: undefined,
                  inShopOnly: undefined,
                  starterOnly: undefined,
                })
              }
            >
              Clear all
            </button>
          </div>
        ) : null}

        {/* Facets with counts */}
        {facets.length > 0 && (
          <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid var(--line)" }}>
            <div
              style={{
                fontFamily: "var(--font-body)",
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

        <div style={{ opacity: loading && results.length > 0 ? 0.6 : 1, transition: "opacity 120ms ease" }}>
        {loading && results.length === 0 ? (
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
              const cond = statMap.conditions?.[item.slug];

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
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        fontWeight: 600,
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

                    {cond ? (
                      <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>
                        {cond.label} ·{" "}
                        {cond.bonusLabel || cond.bonusProperty}
                        {cond.thresholdProperty
                          ? `, ${cond.condition.toLowerCase()}`
                          : ""}
                      </div>
                    ) : null}

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
                          <Tooltip key={chip.key} content={modifierDescription(chip.modifierType, chip.group, glossary, chip.cssClass) ? { what: modifierDescription(chip.modifierType, chip.group, glossary, chip.cssClass)! } : null} placement="top">
                            <span
                              className="tag-muted"
                              style={{ fontFamily: "var(--font-mono)", fontSize: 9, cursor: "default" }}
                            >
                              {chip.label} {contributionText(chip)}
                            </span>
                          </Tooltip>
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
  counts,
  searchable,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[] | undefined;
  onChange: (v: string[]) => void;
  placeholder: string;
  counts?: Record<string, number>;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const sel = selected ?? [];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onClick);
    };
  }, []);

  const filtered = searchable && query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
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
          textAlign: "left",
        }}
      >
        {sel.length === 0 ? (
          <span style={{ color: "var(--muted)" }}>{placeholder}</span>
        ) : sel.length <= 2 ? (
          <span>{sel.map((s) => options.find((o) => o.value === s)?.label ?? String(s)).join(", ")}</span>
        ) : (
          <span>{sel.length} selected</span>
        )}
        <span style={{ fontSize: 10, color: "var(--muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
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
            zIndex: 50,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {searchable ? (
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}…`}
              style={{ width: "100%", padding: "4px 6px", fontSize: 10, marginBottom: 4 }}
            />
          ) : null}
          {filtered.length === 0 ? (
            <div style={{ fontSize: 10, color: "var(--muted)", padding: "4px 6px" }}>No options</div>
          ) : (
            filtered.map((opt) => {
              const checked = sel.includes(opt.value);
              const count = counts?.[opt.value];
              return (
                <label
                  key={String(opt.value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 6px",
                    fontSize: 11,
                    color: checked ? "#fff" : "#c3c5d4",
                    cursor: "pointer",
                    borderRadius: 4,
                    background: checked ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...sel, opt.value]
                          : sel.filter((v) => v !== opt.value),
                      )
                    }
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span style={{ flex: 1 }}>{opt.label}</span>
                  {count != null ? <span className="tag-muted" style={{ fontSize: 9 }}>{count}</span> : null}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}