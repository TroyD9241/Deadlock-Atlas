import Link from "next/link";

import { flowStageLabel } from "@/lib/item-flow";

import type { FlowTransition, ItemBuyBand } from "@/lib/item-flow";

/**
 * The buy band for an item.
 *
 * Which slot the item is bought in, and how often. The slot is the
 * position in the player's shopping order — 0 is the first item of the
 * match — so "bought as the first item, 340K times" is a statement about
 * how early people take it.
 */
export function BuyBandPanel({ band }: { band: ItemBuyBand }) {
  return (
    <div className="plate" style={{ padding: 16 }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: 10,
        }}
      >
        When it is bought
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            fontSize: 11,
          }}
        >
          <span style={{ color: "var(--muted)" }}>Usually bought</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "#d8d9e6",
            }}
          >
            {ordinal(band.commonColumn)} item · {flowStageLabel(band.stage)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            fontSize: 11,
          }}
        >
          <span style={{ color: "var(--muted)" }}>Bought at that slot</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--accent-text)",
            }}
          >
            {band.commonMatches.toLocaleString()} times
          </span>
        </div>
      </div>

      {band.byColumn.length > 1 ? (
        <>
          <div
            style={{
              display: "flex",
              gap: 3,
              marginTop: 14,
              height: 6,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            {band.byColumn.map((entry) => (
              <div
                key={entry.column}
                title={`${ordinal(entry.column)} item — ${entry.matches.toLocaleString()} times`}
                style={{
                  width: `${(100 * entry.matches) / band.totalMatches}%`,
                  background: "var(--accent)",
                  opacity: 0.35 + 0.65 * (entry.matches / band.commonMatches),
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 8,
              fontSize: 9,
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {band.byColumn.map((entry) => (
              <span key={entry.column}>
                {ordinal(entry.column)} · {entry.matches.toLocaleString()}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * What players buy after an item.
 *
 * The transitions out of the item's slot, most-taken first. Each one is a
 * link to the item that came next.
 */
export function TransitionsPanel({
  transitions,
  fromName,
}: {
  transitions: FlowTransition[];
  fromName: string;
}) {
  if (transitions.length === 0) return null;

  const top = transitions[0].matches;

  return (
    <div className="plate" style={{ padding: 16 }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: 6,
        }}
      >
        Bought after
      </div>
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        What players bought after {fromName}. These are the most common
        follow-ups, not a recommended build.
      </p>

      <div style={{ display: "grid", gap: 3 }}>
        {transitions.map((transition) => (
          <div
            key={`${transition.fromColumn}-${transition.apiId}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 10,
              padding: "3px 6px",
              borderRadius: 6,
              fontSize: 11,
              color: "#c3c5d4",
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {transition.slug ? (
                <Link
                  href={`/items/${transition.slug}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {transition.name}
                </Link>
              ) : (
                transition.name
              )}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--accent-text)",
                flex: "0 0 auto",
              }}
            >
              {((100 * transition.matches) / top).toFixed(0)}%
              <span style={{ color: "var(--muted)", marginLeft: 7 }}>
                {transition.matches.toLocaleString()}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "1st", "2nd", "3rd", "4th". */
function ordinal(n: number): string {
  if (n === 0) return "1st";
  if (n === 1) return "2nd";
  if (n === 2) return "3rd";
  if (n === 3) return "4th";
  return `${n + 1}th`;
}
