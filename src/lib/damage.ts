/**
 * The damage model for net damage deltas on procs.
 *
 * We compute spirit damage as: base + coefficient × (build's spirit power).
 * This is an inference about engine behaviour (the API gives a base value and
 * a coefficient; it does not state how they combine), and is labelled as
 * computed, not in-game exact. Where the coefficient is missing, the number
 * is not computed.
 *
 * Bullet damage is not modelled here. The gun formula is different and cannot
 * be verified the same way, so we only compute spirit damage.
 */

import type { BuildItem } from "./stat-map";
import { numericValue, toProperties } from "./stat-map";
import type { Condition } from "./stat-map";

export type AbilityDamage = {
  abilityName: string;
  abilityId: string;
  label: string;
  damageType: "spirit" | "bullet";
  base: number;
  coefficient: number | null;
  withBuild: number;
  withoutBuild: number;
  scalable: boolean;
  notes: string[];
};

export type ConditionOutcome = {
  condition: Condition;
  applies: boolean;
  threshold: number | null;
  bonus: number | null;
  reason: string;
  abilities: Array<{
    ability: AbilityDamage;
    damage: number;
    meetsCondition: boolean;
    margin: number | null;
    bonusApplied: number | null;
  }>;
};

/**
 * Where an ability's damage properties come from.
 *
 * The theorycraft board passes the hero's abilities, which carry their
 * properties directly; a resolved ability entry nests them under `ability`.
 * Both shapes are accepted.
 */
export type AbilityDamageSource = {
  name?: string | null;
  id?: string | number | null;
  properties?: unknown;
  ability?: {
    name?: string | null;
    id?: string | number | null;
    properties?: unknown;
  } | null;
};

/**
 * Sum spirit power (TECH_POWER) from items in the build.
 * Hero base spirit power is 0 according to the data.
 */
export function buildSpiritPower(items: BuildItem[]): number {
  let total = 0;
  for (const item of items) {
    const props = toProperties(item.properties);
    for (const prop of Object.values(props)) {
      if (prop.provided_property_type === "MODIFIER_VALUE_TECH_POWER") {
        const v = numericValue(prop.value);
        if (v != null) total += v;
      }
    }
  }
  return total;
}

/**
 * Compute ability damages for the build.
 * Only spirit damage properties with a tech_damage scale function are computed.
 */
export function abilityDamages(
  abilities: AbilityDamageSource[],
  items: BuildItem[],
): AbilityDamage[] {
  const spiritPower = buildSpiritPower(items);
  const out: AbilityDamage[] = [];

  for (const ability of abilities) {
    const props = toProperties(ability.properties ?? ability.ability?.properties);
    // Look for damage properties with tech_damage css_class and scale_function
    for (const [key, prop] of Object.entries(props)) {
      const cssClass = prop.css_class;
      if (cssClass !== "tech_damage") continue;

      const base = numericValue(prop.value);
      if (base == null || base === 0) continue;

      const scale = prop.scale_function;
      const cls = scale?.class_name;
      const coef = scale?.stat_scale;

      const abilityName = ability.name ?? ability.ability?.name ?? "";
      const abilityId = String(ability.id ?? ability.ability?.id ?? "");

      if (cls === "scale_function_tech_damage" && typeof coef === "number") {
        const withoutBuild = base;
        const withBuild = base + coef * spiritPower;
        out.push({
          abilityName,
          abilityId,
          label: prop.label?.trim() || key,
          damageType: "spirit" as const,
          base,
          coefficient: coef,
          withBuild,
          withoutBuild,
          scalable: true,
          notes: ["Computed from base + coefficient × spirit power"],
        });
      } else {
        // Not scalable or not a spirit damage scale we can compute
        out.push({
          abilityName,
          abilityId,
          label: prop.label?.trim() || key,
          damageType: "spirit" as const,
          base,
          coefficient: null,
          withBuild: base,
          withoutBuild: base,
          scalable: false,
          notes: ["Coefficient missing"],
        });
      }
    }
  }

  return out;
}

export function conditionOutcome(
  condition: Condition,
  itemProperties: unknown,
  abilities: AbilityDamage[],
): ConditionOutcome {
  const props = toProperties(itemProperties);
  let threshold: number | null = null;

  if (condition.thresholdProperty) {
    const prop = props[condition.thresholdProperty];
    if (prop) {
      threshold = numericValue(prop.value);
    }
  }

  const bonusProp = props[condition.bonusProperty];
  const bonus = bonusProp ? numericValue(bonusProp.value) : null;

  const abilityResults = abilities
    .filter((a) => {
      if (condition.damageType === "spirit") return a.damageType === "spirit";
      if (condition.damageType === "weapon") return a.damageType === "bullet" || a.damageType === "spirit";
      return true;
    })
    .map((ability) => {
      const damage = ability.withBuild;
      let meetsCondition = false;
      let margin: number | null = null;

      if (threshold != null) {
        // Most conditions are "more than X damage"
        if (damage > threshold) {
          meetsCondition = true;
          margin = damage - threshold;
        } else {
          margin = damage - threshold; // negative
        }
      } else {
        // No threshold, condition is something else (like "next bullet")
        meetsCondition = false;
        margin = null;
      }

      return {
        ability,
        damage,
        meetsCondition,
        margin,
        bonusApplied: meetsCondition && bonus != null ? bonus : null,
      };
    })
    .sort((a, b) => b.damage - a.damage);

  const applies = abilityResults.some((r) => r.meetsCondition);

  return {
    condition,
    applies,
    threshold,
    bonus,
    reason: applies ? "Some abilities meet the condition" : "No abilities meet the condition",
    abilities: abilityResults,
  };
}
