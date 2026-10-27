import type { BuildOrder } from "@/lib/ability-play-data-format";

/**
 * The most common build orders.
 *
 * There is no single build order — a hero has thousands of distinct
 * upgrade sequences, and the most common one covers under 5% of players.
 * But the order each ability is **first taken** in collapses to four to
 * eight distinct orders per hero, and the top three cover 67–100% of
 * players.
 *
 * So this shows the chains people actually follow, most common first:
 *
 *   1  Power Surge → Static Charge → Lightning Ball → Storm Cloud    51%
 *   2  Power Surge → Lightning Ball → Static Charge → Storm Cloud    25%
 *
 * The order is on first-taken position, so levelling the same ability
 * twice does not move it in the chain.
 */

type Props = {
  /** The orders, most common first. */
  orders: BuildOrder[];
  /** The ability names by API id. */
  names: Map<number, string>;
  /** The bracket the figures are filtered by. */
  bracketLabel: string;
  /** How many orders to show. */
  limit?: number;
};

export function AbilityOrderPanel({
  orders,
  names,
  bracketLabel,
  limit = 3,
}: Props) {
  if (orders.length === 0) return null;

  const shown = orders.slice(0, limit);
  const covered = shown.reduce((sum, order) => sum + order.sharePct, 0);
  const rest = orders.length - shown.length;

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
          Most common build orders
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
        The order each ability is first taken in.
      </p>

      <div style={{ display: "grid", gap: 5 }}>
        {shown.map((order, index) => (
          <div
            key={order.apiIds.join(">")}
            style={{
              display: "grid",
              gridTemplateColumns: "18px minmax(0, 1fr) auto",
              gap: 10,
              alignItems: "baseline",
              padding: "7px 9px",
              borderRadius: 8,
              background: "#ffffff05",
              fontSize: 11,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--muted)",
              }}
            >
              {index + 1}
            </span>

            <span
              style={{
                minWidth: 0,
                color: "#c3c5d4",
                lineHeight: 1.7,
              }}
            >
              {order.apiIds.map((apiId, position) => (
                <span key={`${apiId}-${position}`}>
                  {position > 0 ? (
                    <span
                      aria-hidden="true"
                      style={{ color: "var(--line)", margin: "0 6px" }}
                    >
                      →
                    </span>
                  ) : null}
                  {names.get(apiId) ?? `ability ${apiId}`}
                </span>
              ))}
            </span>

            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--accent-text)",
                whiteSpace: "nowrap",
              }}
            >
              {order.sharePct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      <p
        style={{
          margin: "12px 0 0",
          fontSize: 10,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        These {shown.length} cover {covered.toFixed(0)}% of players.
        {rest > 0
          ? ` The other ${rest} order${rest === 1 ? "" : "s"} cover the remaining ${(100 - covered).toFixed(1)}%.`
          : ""}
      </p>
    </div>
  );
}

/**
 * The names for the abilities in a set of orders.
 *
 * Kept separate so the panel can take a plain map rather than the whole
 * shape.
 */
export function orderNames(
  orders: BuildOrder[],
  lookup: Map<string, string>,
): Map<number, string> {
  const out = new Map<number, string>();
  for (const order of orders) {
    for (const apiId of order.apiIds) {
      if (out.has(apiId)) continue;
      const name = lookup.get(String(apiId));
      if (name) out.set(apiId, name);
    }
  }
  return out;
}
