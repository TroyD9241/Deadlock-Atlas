/**
 * The item purchase flow.
 *
 * SERVER CODE ONLY. Reads the database and calls the API through the cache.
 *
 * `item-flow-stats` returns a graph of what players buy and in what order:
 *
 * - **Nodes** are items, and a node's `column` is the slot it was bought in
 *   — 0 for the first item of the match, 3 for the fourth.
 * - **Edges** are transitions: "of the players who bought X, this many then
 *   bought Y", with `from_column` saying which slot X occupied.
 * - **Summary** is the hero's totals for the same filter.
 *
 * This is a big response — around 3 MB for one hero — so it only comes
 * through the cache, and only for a single hero. It is never fetched
 * roster-wide.
 */

import { db } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { ALL_RANKS } from "@/lib/rank-brackets";

import type { RankBracket } from "@/lib/rank-brackets";

/** One item in the flow graph. */
export type FlowNode = {
  /** The purchase slot the item was bought in: 0 is the first item. */
  column: number;
  item_id: number;
  wins: number;
  losses: number;
  matches: number;
  players: number;
  /** The win rate adjusted for the player's net worth at the time of the buy. */
  adjusted_win_rate: number;
  /** The average net worth the player had when they bought it. */
  avg_net_worth_at_buy: number;
};

/** One transition: "players who bought `from_item_id` then bought `to_item_id`". */
export type FlowEdge = {
  /** The slot the first item occupied. */
  from_column: number;
  from_item_id: number;
  to_item_id: number;
  wins: number;
  losses: number;
  matches: number;
};

/** The hero's totals for the flow. */
export type FlowSummary = {
  wins: number;
  losses: number;
  matches: number;
  players: number;
  avg_duration_s: number;
};

/** The whole flow graph, as the API returns it. */
export type ItemFlow = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  summary: FlowSummary | null;
};

/** The flow graph for a hero. */
export async function getItemFlow(
  heroApiId: number,
  bracket: RankBracket = ALL_RANKS,
): Promise<ItemFlow | null> {
  try {
    const result = await getAnalytics<ItemFlow>(
      "item-flow-stats",
      { hero_ids: heroApiId },
      bracket,
    );
    return result.payload;
  } catch {
    // The flow is a layer over the page, not the page itself.
    return null;
  }
}
/** The stage of the match a purchase slot falls in. */
export type FlowStage = "early" | "mid" | "late";

/**
 * The stage a purchase slot belongs to.
 *
 * Four slots across three stages: the first two slots are the early game,
 * the third is the mid game, and the fourth is the late game. A player
 * with four souls buys their first item in the opening minutes and their
 * fourth near the end.
 */
export function flowStageFor(column: number): FlowStage {
  if (column <= 1) return "early";
  if (column === 2) return "mid";
  return "late";
}

/** The label for a flow stage. */
export function flowStageLabel(stage: FlowStage): string {
  if (stage === "early") return "Early";
  if (stage === "mid") return "Mid";
  return "Late";
}

/**
 * What an item is usually bought as.
 *
 * The `column` an item appears in most often, with how often it was bought
 * there. An item that appears in several columns was bought at different
 * points in the match by different players.
 */
export type ItemBuyBand = {
  apiId: number;
  slug: string | null;
  name: string;
  /** The slot the item was bought in most often. */
  commonColumn: number;
  /** The stage that slot falls in. */
  stage: FlowStage;
  /** How many times the item was bought in that slot. */
  commonMatches: number;
  /** Every slot the item was bought in, with the counts. */
  byColumn: { column: number; stage: FlowStage; matches: number }[];
  /** How many times the item was bought at all. */
  totalMatches: number;
};

/**
 * The buy band for every item in a hero's flow.
 *
 * The nodes are grouped by item, and the slot with the most matches is the
 * one the item is bought in.
 */
export function buildBuyBands(
  flow: ItemFlow,
  names: Map<string, { slug: string; name: string }>,
): ItemBuyBand[] {
  const grouped = new Map<
    number,
    { column: number; matches: number }[]
  >();

  for (const node of flow.nodes) {
    const list = grouped.get(node.item_id) ?? [];
    list.push({ column: node.column, matches: node.matches });
    grouped.set(node.item_id, list);
  }

  const bands: ItemBuyBand[] = [];
  for (const [apiId, entries] of grouped) {
    const sorted = [...entries].sort((a, b) => b.matches - a.matches);
    const common = sorted[0];
    if (!common) continue;
    const meta = names.get(String(apiId));
    bands.push({
      apiId,
      slug: meta?.slug ?? null,
      name: meta?.name ?? `item ${apiId}`,
      commonColumn: common.column,
      stage: flowStageFor(common.column),
      commonMatches: common.matches,
      byColumn: sorted.map((entry) => ({
        column: entry.column,
        stage: flowStageFor(entry.column),
        matches: entry.matches,
      })),
      totalMatches: entries.reduce((sum, e) => sum + e.matches, 0),
    });
  }

  return bands.sort((a, b) => b.commonMatches - a.commonMatches);
}

/**
 * What players buy after an item.
 *
 * The transitions out of the item's most common slot, most-picked first.
 */
export type FlowTransition = {
  apiId: number;
  slug: string | null;
  name: string;
  /** The slot the first item occupied. */
  fromColumn: number;
  /** The slot the second item occupied. */
  toColumn: number;
  /** How many players made this transition. */
  matches: number;
};

/**
 * The transitions out of one item.
 *
 * The edge's `matches` is the number of players who bought the first item
 * and then the second, so the rate against the first item's own count says
 * how often the transition was taken.
 *
 * The same item can lead to the same follow-up from more than one slot —
 * a player who bought Mystic Vulnerability first and one who bought it
 * third both tend to buy Escalating Exposure next. Those are separate
 * edges, so the results are grouped by the item bought next and the counts
 * are added: the reader wants to know "what comes after this", not which
 * slot the first item was in.
 */
export function buildTransitions(
  flow: ItemFlow,
  fromItemId: number,
  names: Map<string, { slug: string; name: string }>,
  limit = 6,
): FlowTransition[] {
  const grouped = new Map<
    number,
    { matches: number; fromColumns: Set<number> }
  >();

  for (const edge of flow.edges) {
    if (edge.from_item_id !== fromItemId) continue;
    const entry = grouped.get(edge.to_item_id) ?? {
      matches: 0,
      fromColumns: new Set<number>(),
    };
    entry.matches += edge.matches;
    entry.fromColumns.add(edge.from_column);
    grouped.set(edge.to_item_id, entry);
  }

  return [...grouped.entries()]
    .sort((a, b) => b[1].matches - a[1].matches)
    .slice(0, limit)
    .map(([toItemId, entry]) => {
      const meta = names.get(String(toItemId));
      const columns = [...entry.fromColumns].sort((a, b) => a - b);
      return {
        apiId: toItemId,
        slug: meta?.slug ?? null,
        name: meta?.name ?? `item ${toItemId}`,
        fromColumn: columns[0] ?? 0,
        toColumn: (columns[0] ?? 0) + 1,
        matches: entry.matches,
      };
    });
}

/**
 * The item names for the ids in a flow, from the site's own shop.
 *
 * The flow is keyed by the API's numeric ids, which the site stores on
 * each item as `apiId`.
 */
export async function getFlowItemNames(
  apiIds: number[],
): Promise<Map<string, { slug: string; name: string }>> {
  const unique = [...new Set(apiIds.map(String))];
  if (unique.length === 0) return new Map();

  const items = await db.item.findMany({
    where: { apiId: { in: unique } },
    select: { apiId: true, slug: true, name: true },
  });
  return new Map(
    items.map((i) => [String(i.apiId), { slug: i.slug, name: i.name }]),
  );
}
