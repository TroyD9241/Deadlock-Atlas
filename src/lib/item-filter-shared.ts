/**
 * Item filter shapes shared by the server and the browser.
 *
 * The query logic lives in src/lib/item-filters.ts, which reads the curated
 * facet file and talks to the database — that is server-only. This file is
 * the part the client island can import.
 */

export type ItemFacet = {
  id: string;
  label: string;
  description: string;
  properties: string[];
  shopFilters: string[];
};

export type ItemFilters = {
  /** Slot types: weapon, vitality, spirit. */
  slots?: string[];
  /** Tiers: 1 to 5. */
  tiers?: number[];
  /** Game shop filters (the API's `shop_filters`). */
  gameFilters?: string[];
  /** Curated modifier facet ids. */
  facets?: string[];
  /** Inclusive cost bounds. */
  minCost?: number;
  maxCost?: number;
  /** Only items currently in the shop rotation. */
  inShopOnly?: boolean;
  /** Only items the hero starts with. */
  starterOnly?: boolean;
  /** Free text over name, class name and description. */
  search?: string;
};

/**
 * The shop's price points, from the API's generic-data.item_price_per_tier:
 * [0, 800, 1600, 3200, 6400, 9999]. The currency is souls.
 *
 * 9999 is the game's "not a fixed price" value (tier 5), so it is labelled
 * as such rather than shown as a literal price.
 */
export const COST_STEPS = [800, 1600, 3200, 6400, 9999];

/** The label for a price. 9999 means "varies" in game. */
export function costLabel(cost: number): string {
  return cost === 9999 ? "9999+ souls" : `${cost} souls`;
}

/** A readable label for the API's shop filter names. */
export function gameFilterLabel(id: string): string {
  const labels: Record<string, string> = {
    anti_cc: "Anti-CC",
    jump_and_dash: "Jump & dash",
    status_grounded: "Ground",
    regen: "Regen",
    debuff_resist: "Debuff resist",
    teleport: "Teleport",
    invulnerability: "Invulnerability",
    mobility_reduction: "Slows",
    stealth: "Stealth",
    status_curse: "Curse",
    spirit_additional_damage_pct: "Bonus spirit damage",
    spirit_vuln: "Spirit vuln",
    status_immobilize: "Immobilise",
    melee: "Melee",
    spirit_damage_reduction: "Spirit resist",
    weapon_ammo: "Ammo",
    spirit_cooldown_and_charges: "Cooldown & charges",
    physical_resist: "Physical resist",
    status_stun: "Stun",
    bullet_vuln: "Bullet vuln",
    hp: "Health",
    out_of_combat_regen: "Out of combat regen",
    spirit_range: "Spirit range",
    weapon_range: "Weapon range",
    stamina: "Stamina",
  };
  if (labels[id]) return labels[id];
  return id
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Parse filters out of the URL's search params. */
export function parseItemFilters(params: URLSearchParams): ItemFilters {
  const list = (key: string) =>
    params
      .getAll(key)
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean);

  const num = (key: string) => {
    const value = params.get(key);
    if (value == null || value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  const tiers = list("tier")
    .map((t) => Number(t))
    .filter((t) => Number.isInteger(t));

  return {
    slots: list("slot"),
    tiers: tiers.length ? tiers : undefined,
    gameFilters: list("filter"),
    facets: list("facet"),
    minCost: num("minCost"),
    maxCost: num("maxCost"),
    inShopOnly: params.get("shop") === "1",
    starterOnly: params.get("starter") === "1",
    search: params.get("q") ?? undefined,
  };
}
