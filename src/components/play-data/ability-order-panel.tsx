/**
 * The typical upgrade order.
 *
 * There is no single typical sequence — a hero can have thousands of
 * distinct ones, and the most common covers under 5% of players — so
 * this does not pretend otherwise. What it shows is the **pairwise**
 * order, which is well defined:
 *
 * - **taken first vs** — for each other ability, how often *this* one was
 *   taken first. So "Lightning Ball 88%" means this ability was taken
 *   first 88% of the time against Lightning Ball. For Abrams, Power Surge
 *   wins its pair against Lightning Ball 88% of the time and against
 *   Static Charge 74%, and Storm Cloud loses every pair — it is the
 *   ability players save until last.
 * - **then next** — what people level after this ability. The
 *   actionable half.
 *
 * The order is computed on **when each ability was first taken**, not on
 * the raw sequence of upgrade points, so an ability being levelled twice
 * does not change its position in the order.
 *
 * A self-transition is not shown as a transition: an ability whose next is
 * mostly itself is simply levelled further, which is worth saying
 * plainly rather than dressing up as an ordering.
 */

import type { AbilityOrder } from "@/lib/ability-play-data-format";

export function AbilityOrderPanel({
  orders,
  bracketLabel,
}: {
  orders: AbilityOrder[];
  bracketLabel: string;
}) {
  if (orders.length === 0) return null;

  return (
    <div className="plate" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 8,
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
          Typical upgrade order
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
          }}
        >
          {bracketLabel}
        </span>
      </div>

      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        What players take before and after each ability. No single build
        order fits everyone, so these are the pairwise figures — the share
        of the times one ability came before another.
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        {orders.map((order) => (
          <div
            key={order.apiId}
            style={{
              display: "grid",
              gap: 3,
              padding: "8px 10px",
              borderRadius: 8,
              background: "#ffffff05",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                color: "#fff",
              }}
            >
              {order.name}
            </div>

            {order.before.length > 0 ? (
              <Line label="taken first vs">
                {order.before.map((b) => (
                  <Share key={b.apiId} name={b.name} pct={b.sharePct} />
                ))}
              </Line>
            ) : null}
            {order.next.length > 0 ? (
              <Line label="then next">
                {order.next.map((n) => (
                  <Share key={n.apiId} name={n.name} pct={n.sharePct} />
                ))}
              </Line>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Line({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "baseline",
        flexWrap: "wrap",
        fontSize: 10,
      }}
    >
      <span
        style={{
          color: "var(--muted)",
          minWidth: 84,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "baseline",
          minWidth: 0,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function Share({ name, pct }: { name: string; pct: number }) {
  return (
    <span style={{ color: "#c3c5d4" }}>
      {name}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--accent-text)",
          marginLeft: 5,
        }}
      >
        {pct.toFixed(0)}%
      </span>
    </span>
  );
}
