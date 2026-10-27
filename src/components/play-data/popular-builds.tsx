import Link from "next/link";

import { edgeLabel, secondsLabel } from "@/lib/build-play-data-format";

import type {
  BuildCurvePoint,
  BuildDetail,
  BuildPlayData,
  HeroBaseline,
} from "@/lib/build-play-data-format";

/**
 * The builds that do better than average.
 *
 * The ranking is by the **edge over the hero's baseline** — how much
 * better or worse a build's win rate is than the hero's own average.
 * Popularity is deliberately not the ranking: the most used build for a
 * hero is often slightly *below* that hero's average, and a site that
 * ranks by popularity is endorsing whatever the crowd happened to pick.
 *
 * The formula is spelled out on the page, because a percentage-point
 * figure means nothing without it, and a build is only marked as better
 * or worse when the gap is bigger than the noise in its own number.
 */

type Props = {
  /** The builds, best first. */
  builds: BuildPlayData[];
  /** The hero's average win rate, which the edges are measured against. */
  baseline: HeroBaseline | null;
  /** The bracket the figures are filtered by. */
  bracketLabel: string;
  /** The hero's slug, for the links. */
  heroSlug: string;
  /**
   * The detail for the top build — its net worth curve and the items it
   * is made of. Only the top build gets one; the rest are a line each.
   */
  topDetail?: BuildDetail | null;
  /** The top build's core items, as item slugs, for the load link. */
  topItemSlugs?: string[];
  /** How many builds to show. */
  limit?: number;
};

export function PopularBuilds({
  builds,
  baseline,
  bracketLabel,
  heroSlug,
  topDetail,
  topItemSlugs = [],
  limit = 5,
}: Props) {
  if (builds.length === 0) return null;

  const shown = builds.slice(0, limit);
  const base = baseline?.winRatePct ?? 0;

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
          Builds that do better than average
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

      {baseline ? (
        <p
          style={{
            margin: "0 0 14px",
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.65,
          }}
        >
          This hero wins{" "}
          <strong style={{ color: "#d8d9e6", fontWeight: 600 }}>
            {base.toFixed(1)}%
          </strong>{" "}
          of its matches. A build&apos;s edge is how much better or worse
          that is:{" "}
          <code
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--accent-text)",
            }}
          >
            edge = build win rate − {base.toFixed(1)}%
          </code>
          . So{" "}
          <strong style={{ color: "#d8d9e6", fontWeight: 600 }}>
            {shown[0] ? edgeLabel(shown[0].edgePp) : "±0.0pp"}
          </strong>{" "}
          means the top build wins{" "}
          {shown[0] ? Math.abs(shown[0].edgePp).toFixed(1) : "0.0"} points
          more of its matches than the hero does on average. It is not a
          claim that the build causes the wins — it is what the matches
          show.
        </p>
      ) : null}

      <div style={{ display: "grid", gap: 8 }}>
        {shown.map((build, index) => (
          <div key={build.buildId}>
            <BuildRow build={build} />

            {index === 0 && topDetail ? (
              <div
                style={{
                  marginTop: 6,
                  marginLeft: 11,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#ffffff04",
                  borderLeft: "2px solid var(--accent)",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  Net worth over the match
                </div>
                <BuildCurve points={topDetail.curve} />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 10,
                    marginTop: 6,
                    fontSize: 9,
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>0:00</span>
                  <span>
                    {topDetail.curve.length > 0
                      ? `${Math.round(topDetail.curve[topDetail.curve.length - 1].netWorth).toLocaleString()} souls at the end`
                      : ""}
                  </span>
                </div>

                {topItemSlugs.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <LoadBuildLink
                      heroSlug={heroSlug}
                      itemSlugs={topItemSlugs}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <p
        style={{
          margin: "14px 0 0",
          fontSize: 10,
          color: "var(--muted)",
          lineHeight: 1.65,
        }}
      >
        A build is only called better or worse than average when the gap is
        bigger than the noise in the number. With 500 matches a win rate
        carries about ±2 points of uncertainty, so a build claiming +1.2pp
        is not distinguishable from average. Only builds played at least
        250 times are listed.
      </p>
    </div>
  );
}

function BuildRow({ build }: { build: BuildPlayData }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "9px 11px",
        borderRadius: 8,
        background: "#ffffff05",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              color: "#fff",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "30ch",
            }}
            title={build.name}
          >
            {build.name}
          </span>
          {build.nonEnglish ? (
            <span
              className="tag-muted"
              style={{ fontSize: 8, letterSpacing: "0.08em" }}
              title="This build's name is not in English."
            >
              Non-English
            </span>
          ) : null}
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 10,
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {build.matches.toLocaleString()} matches ·{" "}
          {build.players.toLocaleString()} players
        </div>
      </div>

      <div style={{ textAlign: "right", flex: "0 0 auto" }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: build.significant
              ? build.edgePp > 0
                ? "var(--accent-text)"
                : "var(--nerf)"
              : "var(--muted)",
          }}
          title={`Win rate ${build.winRatePct.toFixed(2)}%, uncertainty ±${build.stdErrPp.toFixed(2)}pp`}
        >
          {edgeLabel(build.edgePp)}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 9,
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {build.winRatePct.toFixed(1)}% win
        </div>
      </div>
    </div>
  );
}

/**
 * The net worth curve for a build.
 *
 * Cumulative net worth always rises, so the shape of the rise is the
 * power spike: flat early while players are farming, then steep as the
 * core items land.
 */
export function BuildCurve({
  points,
  heroPoints,
}: {
  points: BuildCurvePoint[];
  /** The hero's own curve, drawn behind for comparison. */
  heroPoints?: BuildCurvePoint[];
}) {
  if (points.length < 2) return null;

  const max = Math.max(
    ...points.map((p) => p.netWorth),
    ...(heroPoints ?? []).map((p) => p.netWorth),
    1,
  );

  const width = 100;
  const x = (pct: number) => (pct / 100) * width;

  const heroPath = heroPoints
    ?.filter((p) => p.atPct <= 100)
    .map((p) => `${x(p.atPct)},${28 - (p.netWorth / max) * 26}`)
    .join(" ");

  const path = points
    .filter((p) => p.atPct <= 100)
    .map((p) => `${x(p.atPct)},${28 - (p.netWorth / max) * 26}`)
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      style={{
        display: "block",
        width: "100%",
        height: 28,
        marginTop: 8,
      }}
      role="img"
      aria-label="Net worth over the match"
    >
      {heroPath ? (
        <polyline
          points={heroPath}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <polyline
        points={path}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * A link that loads a build's core items into the theorycraft tool.
 *
 * The build model is already in the URL, so this is a link and not a new
 * piece of state.
 */
export function LoadBuildLink({
  heroSlug,
  itemSlugs,
  skillOrder,
}: {
  heroSlug: string;
  /** The build's core items, as item slugs. */
  itemSlugs: string[];
  /** The skill order, as ability levels keyed by slot. */
  skillOrder?: { slot: string; level: number }[];
}) {
  if (itemSlugs.length === 0) return null;

  const params = new URLSearchParams();
  params.set("build", itemSlugs.join(","));
  if (skillOrder && skillOrder.length > 0) {
    params.set(
      "up",
      skillOrder.map((s) => `${s.slot}:${s.level}`).join(","),
    );
  }

  return (
    <Link
      href={`/theorycraft/${heroSlug}?${params.toString()}`}
      scroll={false}
      className="chip"
      style={{
        cursor: "pointer",
        border: "none",
        font: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      Load into the tool
    </Link>
  );
}

/**
 * A phase row: where it falls, and what happened in it.
 */
export function PhaseRow({
  label,
  fromS,
  toS,
  bought,
  sold,
}: {
  label: string;
  fromS: number;
  toS: number | null;
  bought: number;
  sold: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 10,
        color: "var(--muted)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span style={{ minWidth: 42 }}>{label}</span>
      <span>
        {secondsLabel(fromS)}
        {toS != null ? ` ─ ${secondsLabel(toS)}` : " ─ end"}
      </span>
      <span style={{ textAlign: "right" }}>
        bought {bought.toLocaleString()}
        {sold > 0 ? ` · sold ${sold.toLocaleString()}` : ""}
      </span>
    </div>
  );
}
