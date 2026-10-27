import { timeLabel } from "@/lib/ability-play-data-format";

import type {
  AbilityMaxFirst,
  AbilityUpgradeTiming,
} from "@/lib/ability-play-data-format";

/**
 * The ability play data.
 *
 * One component, two framings, because the two pages want the same figures
 * and say different things with them:
 *
 * - The **hero page** frames it as social proof: "maxed first by X% of
 *   players".
 * - The **theorycraft page** frames it as advice: "when to level this, and
 *   how far people take it".
 *
 * The figures are the same and the denominator is the same: the share of
 * *identified* players, so the four percentages add up to 100%. The API
 * also returns a row for a player whose first-maxed ability it could not
 * identify, and that row is excluded rather than averaged in.
 *
 * The bracket is the reader's, so the shift up the ladder is visible: the
 * same hero's leading ability can go from about half of all players to
 * over 80% at the top bracket. It does not happen for every hero, and the
 * panel says what the numbers are rather than claiming a shift that is not
 * there.
 */

type Props = {
  /** The max-first share per ability, sorted by share. */
  maxFirst: AbilityMaxFirst[];
  /** When each ability's first point is bought, and where it ends up. */
  timings: AbilityUpgradeTiming[];
  /** The bracket the figures are filtered by. */
  bracketLabel: string;
  /** How many identified players the shares are relative to. */
  sample: number;
  /** Which framing to use. */
  framing: "social" | "advice";
  /** Whether to show the upgrade timings. The hero page does not. */
  showTimings?: boolean;
};

export function AbilityPlayData({
  maxFirst,
  timings,
  bracketLabel,
  sample,
  framing,
  showTimings = false,
}: Props) {
  if (maxFirst.length === 0) return null;

  const timingByApiId = new Map(timings.map((t) => [t.apiId, t]));

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
          {framing === "social" ? "What players max first" : "How players level"}
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
        {framing === "social"
          ? "The share of players who put all their points into one ability before any other."
          : "When each ability's first point is bought, and the level it usually ends up at."}
        {sample ? ` Based on ${sample.toLocaleString()} players.` : ""}
      </p>

      <div style={{ display: "grid", gap: 6, marginBottom: showTimings ? 14 : 0 }}>
        {maxFirst.map((ability) => {
          const timing = timingByApiId.get(ability.apiId);
          return (
            <div
              key={ability.apiId}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 12,
                alignItems: "center",
                padding: "6px 8px",
                borderRadius: 6,
                background: "#ffffff05",
                fontSize: 11,
                color: "#c3c5d4",
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
                {ability.name}
                {showTimings && timing?.medianFirstPointS != null ? (
                  <span
                    style={{
                      marginLeft: 8,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--muted)",
                      textTransform: "none",
                      letterSpacing: 0,
                    }}
                    title={`First point bought at ${timeLabel(timing.medianFirstPointS)} into the match`}
                  >
                    first point {timeLabel(timing.medianFirstPointS)}
                    {timing.usualLevel > 0
                      ? ` · usually level ${timing.usualLevel}`
                      : ""}
                  </span>
                ) : null}
              </span>

              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flex: "0 0 auto",
                }}
              >
                {showTimings && timing ? (
                  <span
                    style={{
                      display: "inline-block",
                      width: 54,
                      height: 4,
                      borderRadius: 2,
                      background: "var(--line)",
                      overflow: "hidden",
                    }}
                    title={`${timing.usualLevelPct.toFixed(0)}% of the sequences that include this ability end at level ${timing.usualLevel}`}
                  >
                    <span
                      style={{
                        display: "block",
                        width: `${timing.usualLevelPct}%`,
                        height: "100%",
                        background: "var(--accent)",
                        opacity: 0.7,
                      }}
                    />
                  </span>
                ) : null}
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--accent-text)",
                    minWidth: 44,
                    textAlign: "right",
                  }}
                >
                  {ability.sharePct.toFixed(1)}%
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {showTimings ? (
        <p
          style={{
            margin: 0,
            fontSize: 10,
            color: "var(--muted)",
            lineHeight: 1.6,
          }}
        >
          The first-point time is the median across every upgrade sequence
          that includes the ability, so a few players who take it very late
          do not drag it. The bar is the share of those sequences that end
          at the usual level.
        </p>
      ) : null}
    </div>
  );
}
