"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchResult = {
  type: "hero" | "ability" | "item";
  id: string | number;
  name: string;
  subtitle: string;
  image: string | null;
  href: string;
};

export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
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

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleBlur = () => {
    // Delay to allow click on results
    setTimeout(() => setOpen(false), 150);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleChange}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={handleBlur}
        placeholder="Search…"
        style={{
          background: "#111520",
          border: "1px solid var(--line)",
          borderRadius: 999,
          padding: "9px 16px",
          color: "white",
          minWidth: 160,
          outline: "none",
          fontSize: 13,
          fontFamily: "var(--font-body)",
        }}
      />

      {open && results.length > 0 ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 8,
            background: "linear-gradient(145deg, #171b28e8, #111520e8)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: 8,
            boxShadow: "0 24px 90px #0008",
            zIndex: 100,
            minWidth: 280,
            maxHeight: 400,
            overflowY: "auto",
          }}
        >
          {results.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              href={r.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
                fontSize: 13,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 12%, transparent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {r.image ? (
                <img
                  src={r.image}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    background: "#141824",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 9,
                    color: "var(--muted)",
                  }}
                >
                  {r.name.charAt(0)}
                </div>
              )}
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 12 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {r.type}
                </div>
              </div>
            </Link>
          ))}
          {loading ? (
            <div style={{ padding: "8px 10px", color: "var(--muted)", fontSize: 12 }}>Searching…</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}