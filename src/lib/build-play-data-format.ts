/**
 * Formatting and shapes for build play data.
 *
 * CLIENT-SAFE. No database or network imports, so a component can take
 * these as props without pulling the server module in. The data itself
 * comes from `build-play-data.ts`, which is server-only.
 */

/**
 * One build's play data, as the panel shows it.
 *
 * The ranking is by the **edge over the hero's baseline** — how much
 * better or worse the build's win rate is than the hero's own average.
 * A raw win rate means nothing on its own, because the hero's own average
 * is not 50%.
 */
export type BuildPlayData = {
  /** The API's numeric build id. */
  buildId: number;
  /** The name the author gave it. May be in any language. */
  name: string;
  /**
   * True when the name is not in the Latin alphabet.
   *
   * The reader is told rather than shown a wall of Cyrillic, and the build
   * is not hidden — hiding by script would be hiding data.
   */
  nonEnglish: boolean;
  /** How many players started a match with this build. */
  players: number;
  /** How many matches were played with this build. */
  matches: number;
  /** The build's win rate, as a percentage. */
  winRatePct: number;
  /**
   * The edge over the hero's baseline, in percentage points. Positive is
   * better than average.
   */
  edgePp: number;
  /**
   * The standard error of the build's win rate, in percentage points.
   *
   * This is the noise in the number. A build is only called better or
   * worse than average when the edge clears it.
   */
  stdErrPp: number;
  /**
   * True when the edge is larger than the noise, so the build really is
   * distinguishable from the hero's average.
   */
  significant: boolean;
};

/**
 * The hero's baseline.
 *
 * The win rate the hero averages across every match it is played, which
 * is what a build's edge is measured against.
 */
export type HeroBaseline = {
  /** The hero's average win rate, as a percentage. */
  winRatePct: number;
  /** How many matches the hero has been played in. */
  matches: number;
  /** How many of those matches the hero won. */
  wins: number;
  /** How many of those matches the hero lost. */
  losses: number;
};

/** One point on a build's net worth curve. */
export type BuildCurvePoint = {
  /** Where in the match, as a percentage. */
  atPct: number;
  /** The average net worth at that point. */
  netWorth: number;
  /** How many players the point was measured over. */
  samples: number;
};

/** One phase of a build, derived from the match data. */
export type BuildPhase = {
  /** "early", "mid" or "late". */
  id: "early" | "mid" | "late";
  /** The label shown. */
  label: string;
  /** Where the phase starts, in seconds into the match. */
  fromS: number;
  /** Where it ends, in seconds into the match. Null for the last phase. */
  toS: number | null;
  /** How many items were bought in this phase. */
  bought: number;
  /** How many items were sold in this phase. */
  sold: number;
};

/**
 * A build's detail: its definition, its curve, and its phases.
 *
 * The definition and the curve are fetched per build. The item timings —
 * the 1.3 MB response — are only fetched when a reader expands the build,
 * so they are not part of this.
 */
export type BuildDetail = {
  buildId: number;
  name: string;
  nonEnglish: boolean;
  /**
   * The build's core items, by API id.
   *
   * These come from the **match data**, not from the build definition. The
   * definition's phase categories are the author's free-form notes — one
   * build calls a group "CORE ITEMS", another "Core Build", another
   * "Defensive Core", and most call it something else entirely — so
   * there is no reliable way to pick a loadable set out of them. The items
   * players actually bought while using this build are the real contents.
   */
  coreItemIds: number[];
  /** The phases, from the author's own labels. */
  authorPhases: { label: string; itemIds: number[]; optional: boolean }[];
  /**
   * The skill order, as ability ids in the order they are levelled.
   *
   * These are **abilities**, not items. The ids live in the same numeric
   * space, so they are resolved against the abilities table and never
   * against the items one.
   */
  skillOrder: number[];
  /**
   * The abilities the build's items are imbued onto.
   *
   * `imbue_target_ability_id` on a mod is always an ability id — verified
   * across 25 builds and 39 imbue targets.
   */
  imbueTargets: number[];
  /** The net worth curve. */
  curve: BuildCurvePoint[];
};

/**
 * The standard error of a win rate.
 *
 * The usual binomial approximation: the square root of the proportion times
 * its complement, over the number of matches. For a win rate of 50% over
 * 250 matches that is about 3.2 points, which is why a small sample's
 * "best" build is not actually distinguishable from average.
 */
export function standardErrorPp(
  winRatePct: number,
  matches: number,
): number {
  if (matches <= 0) return 0;
  const p = winRatePct / 100;
  return Math.sqrt((p * (1 - p)) / matches) * 100;
}

/**
 * The edge of a build over the hero's baseline, in percentage points.
 *
 * Positive means the build does better than the hero averages.
 */
export function edgePp(winRatePct: number, baselinePct: number): number {
  return winRatePct - baselinePct;
}

/**
 * The format for an edge.
 *
 * The sign is always shown, so "+3.2pp" and "-1.4pp" read as better and
 * worse rather than as two numbers.
 */
export function edgeLabel(pp: number): string {
  const sign = pp > 0 ? "+" : pp < 0 ? "-" : "";
  return `${sign}${Math.abs(pp).toFixed(1)}pp`;
}

/**
 * The format for a time into the match.
 *
 * The API gives seconds, so this is `mm:ss`.
 */
export function secondsLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "[not available]";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (secs === 60) return `${mins + 1}:00`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Whether a name is in the Latin alphabet.
 *
 * The build names come from the community, and about one in eight is in
 * Russian, Chinese or Turkish. Some are even tagged as English while
 * being written in another script.
 */
export function isNonEnglishName(name: string): boolean {
  return /[^\x00-\x7F]/.test(name);
}
