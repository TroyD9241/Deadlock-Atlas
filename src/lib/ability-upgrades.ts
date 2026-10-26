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

/**
 * Where a scaled property scales from.
 *
 * Two shapes come out of the API:
 *
 * - `scale_function_tech_damage` — the value scales with the hero's spirit
 *   power. The subclass says what it does with it (`damage_scale` for the
 *   damage itself, `FireRateSlow_scale` for the slow it applies).
 * - `scale_function_single_stat` — the value scales with one named stat,
 *   given as a display name like `ETechRange`.
 *
 * The named stat is looked up in the hero's own stats, which use the same
 * `E*` vocabulary, so the bridge needs no curating.
 */
export type ScaleSource = {
  /** The coefficient, when the API gives one. */
  coefficient: number | null;
  /** The display name of the stat it scales from. */
  from: string;
  /** The hero's stat key, when we can tell which stat it is. */
  heroStat: string | null;
  /** The name to show a reader. */
  label: string;
};

/**
 * The hero's stat key for a scale source.
 *
 * `scale_function_tech_damage` scales with spirit power, which is the
 * hero's `weapon_power` stat — the API stores spirit power under the same
 * key the gun damage uses.
 */
const TECH_DAMAGE_STAT = "weapon_power";

export function scaleSource(
  property: Property | undefined,
  displayNames: Record<string, string> = {},
  displayLabels: Record<string, string> = {},
): ScaleSource | null {
  const scale = property?.scale_function;
  if (!scale) return null;

  const coefficient = numericValue(scale.stat_scale);
  const className = scale.class_name ?? "";

  if (className.includes("tech_damage")) {
    return {
      coefficient,
      from: "spirit power",
      heroStat: TECH_DAMAGE_STAT,
      label: "Spirit Power",
    };
  }

  const named = scale.specific_stat_scale_type;
  if (named) {
    const heroStat = displayNames[named] ?? null;
    return {
      coefficient,
      from: named,
      heroStat,
      label:
        displayLabels[named] ??
        (heroStat ? heroStat.replace(/_/g, " ") : named),
    };
  }

  return {
    coefficient,
    from: scale.subclass_name ?? "",
    heroStat: null,
    label: humaniseScaleName(scale.subclass_name ?? ""),
  };
}

/**
 * A readable name for a scale function's subclass.
 *
 * The API names these `scale_function_ability_recharge_time` and the like.
 * The prefix says what kind of function it is; the rest says what it does.
 */
export function humaniseScaleName(name: string): string {
  const stripped = name.replace(/^scale_function_?/, "");
  if (!stripped) return name;
  return stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * A readable name for a property.
 *
 * An ability's upgrade bonus names a property, and many of those properties
 * carry a label of their own — "Fire Rate", "Cooldown". The ones that do
 * not are either a hero-specific property with no label anywhere, or a
 * property the ability never had in its base set.
 *
 * The order is: the property's own label, the curated bonus label, the
 * modifier type's label, then the raw name. The curated map holds the 88
 * bonus names on released heroes that nothing else can resolve.
 */
export function propertyLabel(
  key: string,
  property: Property | undefined,
  labels: {
    bonus?: Record<string, string>;
    modifier?: Record<string, string>;
  } = {},
): string {
  const own = property?.label?.trim();
  if (own) return own;

  const bonus = labels.bonus?.[key];
  if (bonus) return bonus;

  const type = property?.provided_property_type;
  if (type) {
    const modifier = labels.modifier?.[type];
    if (modifier) return modifier;
  }

  return humanise(key);
}

/**
 * A raw property name, split into words.
 *
 * The last resort, and honest about it: the name is the property's, not
 * ours. `BuffGunRangePercent` becomes "Buff Gun Range Percent".
 */
export function humanise(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}
