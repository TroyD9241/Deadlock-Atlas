"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { ItemPopoverContent } from "./item-card";
import { themeStyle } from "@/lib/theme";

import type { ItemDetail } from "@/lib/queries";

/** Subscribe to nothing: this store only reports "we are on the client". */
const subscribeNothing = () => () => {};
const isClient = () => true;
const isServer = () => false;

/**
 * Item popout — design.md 5.5.
 *
 * Three states:
 *   preview — after ~150ms of hover or focus: translucent, a progress ring
 *             runs, the card is not interactive yet
 *   pinned  — after 5 seconds of staying: solid, the ring is complete, the
 *             card scrolls and has an "Open item page" button
 *   closed  — pointer and focus leave both the item and the popout, Esc, or
 *             a click outside
 *
 * Touch devices have no hover, so a tap opens the popout already pinned and
 * the button in it opens the page.
 *
 * The popout is rendered in a portal and positioned with fixed coordinates,
 * because the list is inside a horizontally scrolling grid and an absolutely
 * positioned child would be clipped by it.
 */

const PREVIEW_DELAY_MS = 150;
const PIN_DELAY_MS = 5000;

/** One fetch per item per session. */
const cache = new Map<string, ItemDetail>();

type Pos = { top: number; left: number };

export function ItemPopover({
  slug,
  accent,
  accentText,
  onAccent,
  children,
}: {
  slug: string;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0 });
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [ringKey, setRingKey] = useState(0);

  const triggerRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overPop = useRef(false);

  // Portals need document.body, which only exists in the browser.
  const mounted = useSyncExternalStore(subscribeNothing, isClient, isServer);

  const clearTimers = () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (pinTimer.current) clearTimeout(pinTimer.current);
    previewTimer.current = null;
    pinTimer.current = null;
  };

  const close = useCallback(() => {
    clearTimers();
    setOpen(false);
    setPinned(false);
  }, []);

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 320;
    const height = popRef.current?.offsetHeight ?? 220;

    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = window.innerWidth - width - 12;
    }
    if (left < 12) left = 12;

    let top = rect.bottom + 8;
    if (top + height > window.innerHeight - 12) {
      // Flip above the item when there is no room below.
      top = Math.max(12, rect.top - height - 8);
    }

    setPos({ top, left });
  }, []);

  const loadItem = useCallback(async () => {
    if (cache.has(slug)) {
      setItem(cache.get(slug) ?? null);
      return;
    }
    try {
      const res = await fetch(`/api/items/${slug}`);
      if (!res.ok) return;
      const data = (await res.json()) as { item: ItemDetail };
      cache.set(slug, data.item);
      setItem(data.item);
    } catch {
      // The popout simply stays empty.
    }
  }, [slug]);

  const openPreview = useCallback(() => {
    clearTimers();
    previewTimer.current = setTimeout(() => {
      updatePos();
      setOpen(true);
      setPinned(false);
      setRingKey((k) => k + 1);
      pinTimer.current = setTimeout(() => setPinned(true), PIN_DELAY_MS);
      void loadItem();
    }, PREVIEW_DELAY_MS);
  }, [clearTimers, updatePos, loadItem]);

  // Keep the popout in place while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePos();
    const onResize = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePos]);

  // Esc and outside clicks close it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, close]);

  const handleEnter = () => {
    if (overPop.current) return;
    openPreview();
  };

  const handleLeave = () => {
    // Moving onto the popout counts as staying.
    if (overPop.current) return;
    clearTimers();
    setOpen(false);
    setPinned(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Touch devices have no hover: the first tap opens the popout pinned
    // instead of following the link, and the popout's button opens the page.
    const touch = typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;
    if (!touch) return;
    if (pinned) return;
    e.preventDefault();
    clearTimers();
    updatePos();
    setOpen(true);
    setPinned(true);
    setRingKey((k) => k + 1);
    void loadItem();
  };

  const popover =
    open && mounted ? (
      <div
        ref={popRef}
        role={pinned ? "dialog" : undefined}
        aria-label={pinned ? "Item preview" : undefined}
        aria-hidden={pinned ? undefined : true}
        onMouseEnter={() => {
          overPop.current = true;
          if (previewTimer.current) clearTimeout(previewTimer.current);
        }}
        onMouseLeave={() => {
          overPop.current = false;
          handleLeave();
        }}
        className={`item-popover${pinned ? " is-pinned" : ""}`}
        style={{
          ...themeStyle({ accent, accentText, onAccent }),
          position: "fixed",
          top: pos.top,
          left: pos.left,
          width: 320,
          maxWidth: "calc(100vw - 24px)",
          zIndex: 9998,
        }}
      >
        <span className="item-popover-ring" key={ringKey} aria-hidden="true" />
        {item ? (
          <ItemPopoverContent item={item} />
        ) : (
          <div style={{ fontSize: 11, color: "var(--muted)", padding: "2px 0 4px" }}>
            Loading…
          </div>
        )}
        {pinned ? (
          <a
            className="secondary item-popover-open"
            href={`/items/${slug}`}
            style={{ textAlign: "center" }}
          >
            Open item page
          </a>
        ) : null}
      </div>
    ) : null;

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocusCapture={handleEnter}
      onBlurCapture={(e) => {
        if (popRef.current?.contains(e.relatedTarget as Node)) return;
        handleLeave();
      }}
      onClick={handleClick}
      style={{ position: "relative" }}
    >
      {children}
      {mounted ? createPortal(popover, document.body) : null}
    </div>
  );
}
