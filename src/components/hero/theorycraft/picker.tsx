"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { costLabel } from "@/lib/item-filter-shared";
import { slotLabel } from "@/lib/item-colors";
import { itemImage } from "@/components/item/item-card";
import { contributionText, itemContributions } from "@/lib/stat-map";

import type { PickerItem, StatMap } from "./types";

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  // Starts true so the first open shows "Loading…" rather than a flash of
  // "no items found" before the request lands.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    void fetch(`/api/items?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { items?: PickerItem[] }) => {
        if (cancelled) return;
        setResults(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

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
          width: "min(760px, 100%)",
          maxHeight: "80vh",
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
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLoading(true);
          }}
          placeholder="Search items…"
          aria-label="Search items"
          className="search-field"
          style={{ width: "100%", marginBottom: 12 }}
        />

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
