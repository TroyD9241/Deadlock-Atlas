/**
 * The `/items` play-data layer.
 *
 * The sort lives in the URL (`?sort=pick`) so a sorted view is shareable
 * and the back button works, like every other filter on the page.
 *
 * **Pick rate is the only sortable metric.** The API's win rates are
 * observational — a high win rate reflects who buys an item rather than
 * the item's effect — so sorting by them would read as a recommendation
 * the data does not support.
 */

/** The sorts the page offers. */
export const ITEM_SORTS = [
  {
    id: "shop",
    label: "Shop order",
    hint: "By slot, then tier, then name — the shop's own order.",
  },
  {
    id: "pick",
    label: "Pick rate",
    hint: "Most-picked first. The share of matches the item was bought in.",
  },
  {
    id: "buy",
    label: "Buy time",
    hint: "Earliest first. When players buy the item, on average.",
  },
] as const;

export type ItemSortId = (typeof ITEM_SORTS)[number]["id"];

/**
 * The sort the page is using.
 *
 * An unknown value falls back to the shop order rather than erroring, so a
 * hand-edited or stale link still renders.
 */
export function parseItemSort(param: string | null | undefined): ItemSortId {
  if (!param) return "shop";
  const wanted = param.trim().toLowerCase();
  const found = ITEM_SORTS.find((s) => s.id === wanted);
  return found?.id ?? "shop";
}
