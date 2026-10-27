import Link from "next/link";

import { buyTimeLabel, buyStageFor, buyStageLabel } from "@/lib/play-data-format";

import type { ItemPlayData } from "@/lib/play-data-format";

/**
 * The play-data figures for one item.
 *
 * Pick rate and average buy time, with the win rate shown but not
 * sortable. The win rate is observational: a high win rate reflects who
 * buys the item rather than the item's effect, so the tooltip says so.
 *
 * The pick rate is the share of a hero's matches in which the item was
 * bought, so it is always relative to the bracket the page is filtered by.
 */
export function PlayDataFigures({
  data,
  showWinRate = true,
}: {
  data: ItemPlayData;
  showWinRate?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 10,
        }}
      >
        <span style={{ color: "var(--muted)" }}>Pick rate</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--accent-text)",
          }}
        >
          {data.pickRatePct.toFixed(1)}%
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 10,
        }}
      >
        <span style={{ color: "var(--muted)" }}>Bought at</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "#d8d9e6",
          }}
        >
          {buyTimeLabel(data.avgBuyTimeS)}
          <span style={{ color: "var(--muted)" }}>
            {" "}
            · {Math.round(data.avgBuyTimeRelative)}% in
          </span>
        </span>
      </div>

      {showWinRate ? (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
            fontSize: 10,
          }}
          title="The win rate of the matches this item was bought in. It reflects who buys the item, not that the item wins games."
        >
          <span style={{ color: "var(--muted)" }}>Win rate</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            {data.winRatePct.toFixed(1)}%
          </span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The play-data summary for a card in a list.
 *
 * One line: the pick rate, the buy time, and the stage the item is usually
 * bought in. Compact enough for the item grid, complete enough to be worth
 * reading.
 */
export function PlayDataLine({ data }: { data: ItemPlayData }) {
  const stage = buyStageFor(data.avgBuyTimeRelative);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        fontSize: 10,
        color: "var(--muted)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--accent-text)",
        }}
      >
        {data.pickRatePct.toFixed(1)}% picked
      </span>
      <span aria-hidden="true" style={{ color: "var(--line)" }}>
        ·
      </span>
      <span style={{ fontFamily: "var(--font-mono)" }}>
        {buyTimeLabel(data.avgBuyTimeS)}
      </span>
      <span aria-hidden="true" style={{ color: "var(--line)" }}>
        ·
      </span>
      <span>{buyStageLabel(stage)}</span>
    </div>
  );
}

/**
 * The play-data panel for a single item's page.
 *
 * A little more detail than the list line: the sample size, the sell
 * timing, and the note about what the win rate means.
 */
export function PlayDataPanel({
  data,
  heroMatches,
}: {
  data: ItemPlayData;
  /** The number of matches behind the figures, for the sample size. */
  heroMatches?: number;
}) {
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
        Play data
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <Row label="Pick rate" value={`${data.pickRatePct.toFixed(1)}%`} />
        <Row label="Average buy time" value={buyTimeLabel(data.avgBuyTimeS)} />
        <Row
          label="Bought"
          value={`${Math.round(data.avgBuyTimeRelative)}% into the match`}
        />
        <Row label="Win rate" value={`${data.winRatePct.toFixed(1)}%`} muted />
        <Row label="Player-plays" value={data.matches.toLocaleString()} muted />
        <Row label="Times sold" value={data.sold.toLocaleString()} muted />
      </div>

      <p
        style={{
          margin: "12px 0 0",
          fontSize: 10,
          color: "var(--muted)",
          lineHeight: 1.6,
        }}
      >
        The pick rate is the share of {heroMatches ? `${heroMatches.toLocaleString()} ` : ""}matches
        in which this item was bought. The win rate is the win rate of those
        matches — it reflects who buys the item, not that the item wins
        games. Player-plays counts each player in each match, so one match
        with four buyers counts four times.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
        fontSize: 11,
      }}
    >
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: muted ? "var(--muted)" : "#d8d9e6",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * A link to the item's page, used by the play-data list.
 *
 * The item id in the URL is the site's slug, not the API's numeric id.
 */
export function PlayDataItemLink({
  slug,
  children,
}: {
  slug: string | null;
  children: React.ReactNode;
}) {
  if (!slug) return <>{children}</>;
  return (
    <Link
      href={`/items/${slug}`}
      style={{
        color: "inherit",
        textDecoration: "none",
        display: "block",
      }}
    >
      {children}
    </Link>
  );
}
