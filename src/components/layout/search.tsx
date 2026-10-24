"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/** Subscribe to nothing: this store only reports "we are on the client". */
const subscribeNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

type SearchResult = {
  type: "hero" | "ability" | "item";
  id: string | number;
  name: string;
  subtitle: string;
  image: string | null;
  href: string;
};

type Pos = { top: number; left: number; width: number };

export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0, width: 320 });
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Portals need document.body, which only exists in the browser.
  const mounted = useSyncExternalStore(subscribeNothing, isClient, isServer);

  const updatePos = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: Math.max(8, rect.right - 320), width: Math.min(320, window.innerWidth - 16) });
  };

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
      setActiveIndex(-1);
      updatePos();
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 200);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        updatePos();
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        return;
      }
      if (!open || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + results.length) % results.length);
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const r = results[activeIndex];
        if (r) window.location.href = r.href;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, activeIndex]);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (inputRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setActiveIndex(-1);
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.type === "hero" ? "Heroes" : r.type === "ability" ? "Abilities" : "Items";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const dropdown =
    open && mounted && results.length > 0 ? (
      <div
        ref={dropdownRef}
        role="listbox"
        aria-label="Search results"
        style={{
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: pos.width,
          background: "linear-gradient(145deg, #171b28f0, #111520f0)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: 8,
          boxShadow: "0 24px 90px #000c",
          zIndex: 9999,
          maxHeight: 420,
          overflowY: "auto",
          scrollbarWidth: "thin",
        }}
      >
        {["Heroes", "Abilities", "Items"].map((group) => {
          const items = grouped[group];
          if (!items || items.length === 0) return null;
          return (
            <div key={group} style={{ marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  fontWeight: 800,
                  padding: "6px 10px 4px",
                  fontFamily: "var(--font-display)",
                }}
              >
                {group}
              </div>
              {items.map((r) => {
                const idx = results.indexOf(r);
                const active = idx === activeIndex;
                return (
                  <Link
                    key={`${r.type}-${r.id}`}
                    href={r.href}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setOpen(false);
                      setActiveIndex(-1);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 10,
                      textDecoration: "none",
                      color: "inherit",
                      fontSize: 13,
                      minHeight: 44,
                      background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      setActiveIndex(idx);
                      (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 14%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      if (activeIndex === idx) setActiveIndex(-1);
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    {r.image ? (
                      <img
                        src={r.image}
                        alt=""
                        loading="lazy"
                        style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", border: "1px solid var(--line)" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: "#141824",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 10,
                          color: "var(--muted)",
                          fontFamily: "var(--font-display)",
                        }}
                      >
                        {r.name.charAt(0)}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 12,
                          letterSpacing: "0.04em",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.name}
                      </div>
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                        }}
                      >
                        {r.subtitle}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
        {loading ? <div style={{ padding: "8px 10px", color: "var(--muted)", fontSize: 12 }}>Searching…</div> : null}
      </div>
    ) : null;

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onFocus={() => {
          updatePos();
          if (query.length >= 2 && results.length > 0) setOpen(true);
        }}
        onClick={updatePos}
        placeholder="Search…"
        aria-label="Search"
        className="search-field"
      />
      {mounted ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
