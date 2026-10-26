/**
 * Ability upgrade tiers.
 *
 * `Ability.upgrades` holds an array of three tiers for 304 of the 436
 * abilities (the rest are JSON null). Each tier is a list of property
 * upgrades: `{ name, bonus }`, the same shape item upgrades use.
 *
 * An ability's value at tier N is its base property plus the summed
 * bonuses of tiers 1..N. Bonuses that name a property the ability does not
 * have in its base set become new modifier lines rather than changes to an
 * existing one.
 */
import { numericValue, type Properties, type Property } from "@/lib/stat-map";

export type PropertyUpgrade = {
  name: string;
  bonus: number;
};

/** One upgrade tier. */
export type UpgradeTier = {
  /** The properties this tier changes, with their bonuses. */
  upgrades: PropertyUpgrade[];
  /** The raw bonus string, when it is not a plain number (e.g. "5m"). */
  raw: { name: string; bonus: string }[];
};

export type UpgradeTierRaw = {
  property_upgrades?: { name?: string; bonus?: unknown }[];
};

/** The upgrade tiers of an ability, empty when it has none. */
export function upgradeTiers(raw: unknown): UpgradeTier[] {
  if (!Array.isArray(raw)) return [];
  const tiers: UpgradeTier[] = [];
  for (const entry of raw as UpgradeTierRaw[]) {
    const list = entry?.property_upgrades;
    if (!Array.isArray(list)) {
      tiers.push({ upgrades: [], raw: [] });
      continue;
    }
    const upgrades: PropertyUpgrade[] = [];
    const rawBonuses: { name: string; bonus: string }[] = [];
    for (const upgrade of list) {
      const name = upgrade?.name;
      if (typeof name !== "string" || !name) continue;
      const bonus = numericValue(upgrade?.bonus);
      rawBonuses.push({
        name,
        bonus: typeof upgrade?.bonus === "number" ? String(upgrade.bonus) : String(upgrade?.bonus ?? ""),
      });
      if (bonus == null || bonus === 0) continue;
      upgrades.push({ name, bonus });
    }
    tiers.push({ upgrades, raw: rawBonuses });
  }
  return tiers;
}

/** How many upgrade levels an ability offers. */
export function upgradeLevelCount(tiers: UpgradeTier[]): number {
  return tiers.length;
}

/**
 * The ability's properties at a given upgrade level.
 *
 * Level 0 is the base ability. Level N applies the bonuses of tiers 1..N.
 * Bonuses are added to the property when it exists, and added as a new
 * property when it does not.
 */
export function propertiesAtLevel(
  properties: Properties,
  tiers: UpgradeTier[],
  level: number,
): Properties {
  const out: Properties = {};
  for (const [key, property] of Object.entries(properties)) {
    out[key] = { ...property };
  }

  const applied = Math.max(0, Math.min(level, tiers.length));
  for (let i = 0; i < applied; i += 1) {
    for (const upgrade of tiers[i]?.upgrades ?? []) {
      const existing = out[upgrade.name];
      if (existing) {
        const value = numericValue(existing.value) ?? 0;
        out[upgrade.name] = {
          ...existing,
          value: value + upgrade.bonus,
        };
      } else {
        out[upgrade.name] = {
          label: upgrade.name,
          value: upgrade.bonus,
        } as Property;
      }
    }
  }

  return out;
}

/** The bonuses a given tier adds, for the breakdown in the readout. */
export function tierContributions(
  tiers: UpgradeTier[],
  level: number,
): { name: string; bonus: number }[] {
  const applied = Math.max(0, Math.min(level, tiers.length));
  const out: { name: string; bonus: number }[] = [];
  for (let i = 0; i < applied; i += 1) {
    for (const upgrade of tiers[i]?.upgrades ?? []) {
      out.push(upgrade);
    }
  }
  return out;
}

/**
 * The scale coefficient for a property, when the API gives one.
 *
 * Some properties carry a `scale_function` with a `stat_scale` coefficient
 * and the stat it scales from. Where it is missing the value does not scale
 * and the tool says so.
 */
export function scaleFor(
  property: Property | undefined,
): { coefficient: number; from: string } | null {
  const scale = property?.scale_function;
  if (!scale) return null;
  const coefficient = numericValue(scale.stat_scale);
  if (coefficient == null) return null;
  return {
    coefficient,
    from: scale.specific_stat_scale_type ?? scale.subclass_name ?? "",
  };
}
