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
 * One ability's level spread.
 *
 * Derived from `ability-order-stats`, which gives the whole sequence of
 * upgrade points a player spent.
 *
 * The **distribution** is what matters here, not the mode. The most
 * common final level is level 4 for every ability of every hero, so a
 * "usual level" says nothing at all. The distribution does: for Abrams,
 * Power Surge ends at level 4 almost every time while Static Charge is
 * split roughly half and half between levels 3 and 4.
 */
export type AbilityLevelSpread = {
  /** The API's numeric ability id. */
  apiId: number;
  /** The ability's class name, which is how the site identifies it. */
  className: string | null;
  name: string;
  /**
   * The share of sequences ending at each level, as a percentage.
   *
   * Index 0 is level 1. The entries sum to 100.
   */
  levelPct: number[];
  /** The average final level, weighted by player count. */
  avgLevel: number;
  /** How many sequences include this ability at all. */
  totalRows: number;
};

/**
 * One "what comes next" transition.
 *
 * The share is of the pairs it belongs to, so the two directions of a
 * pair add up to 100.
 */
export type AbilityTransition = {
  /** The API's numeric ability id. */
  apiId: number;
  /** The ability's class name, which is how the site identifies it. */
  className: string | null;
  name: string;
  /** The share of this ability's sequences that go this way, as a percentage. */
  sharePct: number;
};

/**
 * One ability's upgrade order.
 *
 * There is no single typical sequence — a hero can have thousands, and
 * the most common covers under 5% of players — but the *pairwise* order
 * is well defined: for any two abilities, how often one is taken before
 * the other.
 *
 * The order is on **when each ability was first taken**, not on the raw
 * sequence of upgrade points, so levelling the same ability twice does
 * not move it.
 */
export type AbilityOrder = {
  /** The API's numeric ability id. */
  apiId: number;
  /** The ability's class name, which is how the site identifies it. */
  className: string | null;
  name: string;
  /** The abilities that come next, most common first. */
  next: AbilityTransition[];
  /**
   * The other abilities, most common first.
   *
   * The share is **this ability's** share of the pair — how often it was
   * taken first against that ability. The two directions sum to 100.
   */
  before: AbilityTransition[];};

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
