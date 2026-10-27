/**
 * Formatting for play data.
 *
 * CLIENT-SAFE. This module has no database or network imports, so it can be
 * used from a component. The data itself comes from `play-data.ts`, which is
 * server-only.
 */

/**
 * One item's play data, resolved against the site's own item list.
 *
 * CLIENT-SAFE. This is a plain shape with no database or network in it, so
 * a component can take it as a prop without pulling the server module in.
 */
export type ItemPlayData = {
  /** The API's numeric item id. */
  apiId: number;
  /** The site's slug for the item. Null when the item is not in our shop. */
  slug: string | null;
  name: string;
  slotType: string | null;
  tier: number | null;
  image: string | null;
  imageWebp: string | null;
  /** The share of the hero's matches in which this item was bought, as a percentage. */
  pickRatePct: number;
  /** The item's win rate in the matches it was bought, as a percentage. */
  winRatePct: number;
  /** The average number of matches the item was bought in. */
  matches: number;
  /** The average number of players who bought the item per match. */
  players: number;
  /** The average time into the match the item was bought, in seconds. */
  avgBuyTimeS: number;
  /** The average time into the match the item was sold, in seconds. */
  avgSellTimeS: number;
  /** The average percentage into the match the item was bought. */
  avgBuyTimeRelative: number;
  /** The average percentage into the match the item was sold. */
  avgSellTimeRelative: number;
  /** How many times the item was sold. */
  sold: number;
};

/**
 * The format for a buy time.
 *
 * The API gives seconds into the match, so this is `mm:ss`. A negative or
 * missing value reads as "[not available]" rather than as zero, because
 * zero would claim the item is bought at the first second.
 */
export function buyTimeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "[not available]";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  // Rounding 59.6 seconds up to 60 would give "1:60".
  if (secs === 60) return `${mins + 1}:00`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/**
 * The stage of the match an item is usually bought in.
 *
 * Derived from the share of the match elapsed when it is bought, which is
 * the API's `avg_buy_time_relative`. The thirds are the same ones the
 * theorycraft tool uses for its early/mid/late ability presets.
 */
export type BuyStage = "early" | "mid" | "late";

export function buyStageFor(relativePct: number): BuyStage {
  if (relativePct < 33) return "early";
  if (relativePct < 66) return "mid";
  return "late";
}

/** The label for a buy stage. */
export function buyStageLabel(stage: BuyStage): string {
  if (stage === "early") return "Early";
  if (stage === "mid") return "Mid";
  return "Late";
}

/**
 * The pick rate of an item, as a percentage.
 *
 * **The share of a hero's matches in which the item was bought.**
 *
 * The API gives three numbers per item and they mean different things:
 *
 * - `hero-stats.matches` — the hero's match count. This is the denominator.
 * - `item-stats.players` — `uniq(account_id)`, the distinct players who
 *   bought the item. One account appears once however many matches it
 *   played, so this counts people, not matches.
 * - `item-stats.matches` — `wins + losses`, the number of *player-match
 *   appearances* in which the item was bought. One match with three people
 *   buying the item counts three times.
 *
 * Dividing `players` by `hero-stats.matches` gives the share of matches in
 * which at least one player bought the item, which is the question a
 * reader asks: "in a third of Abrams matches, somebody buys Mystic
 * Vulnerability". The result is always below 100%, because a match
 * contributes at most one to `players`.
 *
 * The API's own `popular_items.pick_pct` is not used: it is scoped to a
 * match stage, its denominator is undocumented, and it has no per-bracket
 * variant. The API's own website shows a "Pick Rate (Normalized)" that is
 * computed over its own filtered item list, so it cannot be reproduced
 * from the public endpoints either.
 */
export function pickRatePct(players: number, heroMatches: number): number {
  if (heroMatches <= 0) return 0;
  return (100 * players) / heroMatches;
}

/**
 * The win rate of an item, as a percentage.
 *
 * Shown, but never sortable: a high win rate reflects who buys the item
 * rather than the item's effect (design.md, the play-data note).
 */
export function winRatePct(wins: number, losses: number): number {
  const total = wins + losses;
  if (total <= 0) return 0;
  return (100 * wins) / total;
}
