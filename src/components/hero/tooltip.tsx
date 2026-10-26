"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type TooltipContent = {
  what: string;
  affects?: string;
  label?: string;
  /**
   * A list of labelled values, used to show where a number came from.
   * Rendered under the prose as a two-column list.
   */
  rows?: { label: string; value: string }[];
  /** A short heading above the rows. */
  rowsLabel?: string;
};

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * The choice is made once at module load, not per render, so the hook order
 * never changes and the rules of hooks hold.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function Tooltip({
  content,
  children,
  placement = "left",
}: {
  content: TooltipContent | null;
  children: React.ReactNode;
  placement?: "left" | "right" | "top";
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; actual: "left" | "right" | "top" } | null>(null);

  const compute = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const tr = trigger.getBoundingClientRect();
    const tt = tooltip.getBoundingClientRect();
    const gap = 10;
    const pad = 8;
    let actual: "left" | "right" | "top" = placement;

    if (actual === "left") {
      const left = tr.left - tt.width - gap;
      if (left < pad) actual = "right";
    } else if (actual === "right") {
      const left = tr.right + gap;
      if (left + tt.width > window.innerWidth - pad) actual = "left";
    } else if (actual === "top") {
      const top = tr.top - tt.height - gap;
      if (top < pad) actual = "right";
    }

    if (actual === "left") {
      let left = tr.left - tt.width - gap;
      let top = tr.top + tr.height / 2 - tt.height / 2;
      if (left < pad) left = pad;
      if (top < pad) top = pad;
      if (top + tt.height > window.innerHeight - pad) top = window.innerHeight - tt.height - pad;
      setPos({ top, left, actual });
      return;
    }
    if (actual === "right") {
      let left = tr.right + gap;
      let top = tr.top + tr.height / 2 - tt.height / 2;
      if (left + tt.width > window.innerWidth - pad) left = window.innerWidth - tt.width - pad;
      if (top < pad) top = pad;
      if (top + tt.height > window.innerHeight - pad) top = window.innerHeight - tt.height - pad;
      setPos({ top, left, actual });
      return;
    }
    // top
    let left = tr.left + tr.width / 2 - tt.width / 2;
    let top = tr.top - tt.height - gap;
    if (left < pad) left = pad;
    if (left + tt.width > window.innerWidth - pad) left = window.innerWidth - tt.width - pad;
    if (top < pad) {
      top = tr.bottom + gap;
      actual = "right";
    }
    if (top + tt.height > window.innerHeight - pad) top = window.innerHeight - tt.height - pad;
    setPos({ top, left, actual });
  }, [placement]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    compute();
    const raf = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(raf);
  }, [open, content, compute]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => compute();
    const onResize = () => compute();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, compute]);

  if (!content) return <>{children}</>;

  return (
    <span
      ref={triggerRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? tooltipId : undefined}
    >
      {children}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={tooltipRef}
              id={tooltipId}
              role="tooltip"
              style={{
                position: "fixed",
                zIndex: 10000,
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                maxWidth: 260,
                maxHeight: "40vh",
                overflowY: "auto",
                padding: "8px 10px",
                borderRadius: 10,
                background: "linear-gradient(180deg, rgba(20,24,36,0.98) 0%, rgba(14,17,28,0.98) 100%)",
                border: "1px solid color-mix(in srgb, var(--accent) 40%, var(--line))",
                boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.01)",
                backdropFilter: "blur(6px)",
                fontSize: 11,
                lineHeight: 1.7,
                color: "#c3c5d4",
                pointerEvents: "none",
                whiteSpace: "normal",
              }}
            >
              {content.label ? (
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#fff",
                    marginBottom: 4,
                  }}
                >
                  {content.label}
                </div>
              ) : null}
              <div style={{ display: "block", color: "#fff" }}>{content.what}</div>
              {content.affects ? (
                <div style={{ display: "block", color: "var(--muted)", marginTop: 4 }}>{content.affects}</div>
              ) : null}
              {content.rows && content.rows.length > 0 ? (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 7,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  {content.rowsLabel ? (
                    <div
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--accent)",
                        marginBottom: 5,
                      }}
                    >
                      {content.rowsLabel}
                    </div>
                  ) : null}
                  <div style={{ display: "grid", gap: 3 }}>
                    {content.rows.map((row, i) => (
                      <div
                        key={row.label + i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            color: "#c3c5d4",
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.label}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--accent-text)",
                            flex: "0 0 auto",
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
