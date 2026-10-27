/**
 * Formatting and shapes for ability play data.
 *
 * CLIENT-SAFE. No database or network imports, so a component can take
 * these as props without pulling the server module in. The data itself
 * comes from `ability-play-data.ts`, which is server-only.
 */

/**
 * One ability's max-first rate.
 *
 * The share of players who put all their points into this ability before
 * any other.
 */
export type AbilityMaxFirst = {
  /** The API's numeric ability id. */
  apiId: number;
  /** The ability's class name, which is how the site identifies it. */
  className: string | null;
  name: string;
  /** The share of identified players who maxed this one first, as a percentage. */
  sharePct: number;
  /** How many players maxed this ability first. */
  players: number;
};

/**
 * One build order.
 *
 * The order the abilities were **first taken** in, which is the readable
 * unit. The API's raw sequence is the full list of upgrade points — an
 * ability repeated once per tier bought — so it is 15 entries for a hero
 * with four abilities at four levels each, and there are thousands of
 * distinct ones.
 *
 * Collapsing to the first-taken order gives 4–8 distinct orders per hero,
 * and the top three cover 67–100% of players.
 */
export type BuildOrder = {
  /** The ability ids, in the order they were first taken. */
  apiIds: number[];
  /** The share of players who followed this order, as a percentage. */
  sharePct: number;
  /** How many players followed it. */
  players: number;
};

/**
 * The format for a time into the match.
 *
 * The API gives seconds, so this is `mm:ss`. A negative or missing value
 * reads as "[not available]" rather than as zero, because zero would claim
 * the ability was bought at the first second.
 */
export function timeLabel(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "[not available]";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  // Rounding 59.6 seconds up to 60 would give "1:60".
  if (secs === 60) return `${mins + 1}:00`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * The stage of the match a time falls in.
 *
 * The thirds are the same ones the theorycraft tool uses for its early,
 * mid and late ability presets, and the same ones the item buy timing
 * uses.
 */
export type MatchStage = "early" | "mid" | "late";

export function stageFor(relativePct: number): MatchStage {
  if (relativePct < 33) return "early";
  if (relativePct < 66) return "mid";
  return "late";
}

/** The label for a stage. */
export function stageLabel(stage: MatchStage): string {
  if (stage === "early") return "Early";
  if (stage === "mid") return "Mid";
  return "Late";
}

/**
 * The stage a time into the match falls in.
 *
 * The thresholds are on the share of the match elapsed, so they need the
 * match's average duration — a 10-minute match and a 40-minute match put
 * the same absolute time in different stages.
 */
export function stageForSeconds(
  seconds: number | null,
  avgMatchDurationS: number,
): MatchStage | null {
  if (seconds == null || avgMatchDurationS <= 0) return null;
  return stageFor((100 * seconds) / avgMatchDurationS);
}
