/**
 * The rank brackets play data is grouped by.
 *
 * The Deadlock API filters matches with `min_average_badge` and
 * `max_average_badge`, where the badge value is `tier * 10 + subrank`:
 * Initiate is tier 1 (10-16), Seeker 2 (20-26), and so on up to Eternus
 * (110-116).
 *
 * The brackets are **non-overlapping**. Overlapping "top 5%" / "top 25%"
 * ranges are tempting because that is how players talk, but the numbers then
 * cannot be compared side by side — a player in the top bracket is also in
 * every wider one. These four partition the ladder instead.
 *
 * The shares below were measured from the API's own
 * `/v1/analytics/badge-distribution` on 2026-10-26, and were stable across a
 * 30-day window (322,404 unique players) and a 13-month window (403,096).
 * They are a snapshot of the distribution, not a live computation.
 *
 * Note that `min_average_badge` filters on the average badge of *both* teams
 * in a match, so a high-bracket match still contains lower-badge players.
 * These are brackets of matches, not of players.
 */

/** One rank bracket. */
export type RankBracket = {
  /** The value used in the `?rank=` parameter and the cache key. */
  id: string;
  /** The name shown to the reader. */
  label: string;
  /** The lowest badge value in the bracket. */
  minBadge: number;
  /** The highest badge value in the bracket. */
  maxBadge: number;
  /** The share of players in this bracket, as a percentage. */
  sharePct: number;
};

/**
 * Every bracket, in ladder order.
 *
 * "all" is the unfiltered ladder and carries no badge bounds — it is not a
 * fifth band, it is the absence of a filter.
 */
export const RANK_BRACKETS: RankBracket[] = [
  {
    id: "all",
    label: "All ranks",
    minBadge: 0,
    maxBadge: 0,
    sharePct: 100,
  },
  {
    id: "initiate-sentinel",
    label: "Initiate – Sentinel",
    minBadge: 10,
    maxBadge: 49,
    sharePct: 59.8,
  },
  {
    id: "mystic-ritualist",
    label: "Mystic – Ritualist",
    minBadge: 50,
    maxBadge: 69,
    sharePct: 20.0,
  },
  {
    id: "emissary-oracle",
    label: "Emissary – Oracle",
    minBadge: 70,
    maxBadge: 89,
    sharePct: 15.6,
  },
  {
    id: "phantom-eternus",
    label: "Phantom – Eternus",
    minBadge: 90,
    maxBadge: 116,
    sharePct: 4.6,
  },
];

/** The unfiltered bracket. */
export const ALL_RANKS = RANK_BRACKETS[0];

/**
 * The bracket a reader gets when they have not chosen one.
 *
 * **Initiate – Sentinel**, not "All ranks".
 *
 * The four bands partition the *ranked* ladder, and between them they
 * cover about 13% of the all-ranks sample — the other 87% is matches
 * with no badge at all, which is unranked and new-player play rather
 * than a rank anyone chose. So "All ranks" is mostly unranked matches,
 * and the bands are strict subsets of it rather than the other way round.
 *
 * Initiate – Sentinel is the largest band (45.9% of ranked matches), so
 * it is the most representative of the ranked population, and it is
 * where the play differs most from the bands above it: at initiate a
 * hero's leading ability is picked first 104 seconds into the match,
 * and from Mystic upward it is 16 seconds. Starting there means the
 * reader sees a real difference when they move up the ladder.
 *
 * "All ranks" is still one click away — the picker's first chip.
 */
export const DEFAULT_BRACKET = RANK_BRACKETS[1];

/**
 * The badge bounds to send to the API for a bracket.
 *
 * Returns null for the unfiltered bracket, which means the caller sends no
 * `min_average_badge` / `max_average_badge` at all.
 */
export function badgeRangeFor(
  bracket: RankBracket,
): { min: number; max: number } | null {
  if (bracket.id === ALL_RANKS.id) return null;
  return { min: bracket.minBadge, max: bracket.maxBadge };
}

/**
 * The bracket a `?rank=` value refers to.
 *
 * Anything unrecognised falls back to the default band rather than
 * erroring, so a stale or hand-edited link still renders the page.
 */
export function bracketFromParam(param: string | null | undefined): RankBracket {
  if (!param) return DEFAULT_BRACKET;
  const wanted = param.trim().toLowerCase();
  return (
    RANK_BRACKETS.find((b) => b.id === wanted) ??
    RANK_BRACKETS.find((b) => b.label.toLowerCase() === wanted) ??
    DEFAULT_BRACKET
  );
}

/**
 * The bracket with the given id.
 *
 * Unlike `bracketFromParam` this falls back to the default band, not to
 * "all" — an unknown id is a bad link, not a request for everything.
 */
export function bracketById(id: string): RankBracket {
  return RANK_BRACKETS.find((b) => b.id === id) ?? DEFAULT_BRACKET;
}
