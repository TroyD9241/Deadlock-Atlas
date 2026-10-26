/**
 * Ability stat resolution for the theorycraft tool.
 *
 * Resolves each ability property at a given upgrade level with the build
 * applied: base (at tier) → item modifiers → derived scale stats → proc
 * bonuses. Numbers are computed and labeled as such; where the API gives no
 * coefficient the 1:1 scale is inferred.
 */

import { numericValue, toProperties } from "@/lib/stat-map";
import { propertiesAtLevel, scaleBonusesAtLevel, scaleSource, upgradeTiers } from "@/lib/ability-upgrades";
import { buildSpiritPower } from "@/lib/damage";

import type { BuildItem, Property, StatMap } from "@/lib/stat-map";
import type { HeroAbility } from "@/components/hero/theorycraft/types";
import type { ScaleSource } from "@/lib/ability-upgrades";

export type AbilityFactor = {
  label: string;
  kind: "tier" | "item" | "scale" | "proc" | "base";
  delta: number;
  source?: string;
  /**
   * The items behind this factor, when it comes from the build.
   *
   * A spirit power factor is worth +12 because two items gave spirit power;
   * without the names, the reader cannot trace the number back to a build
   * decision.
   */
  items?: { slug: string; name: string; value: number; postfix: string }[];
};

export type ResolvedAbilityProperty = {
  key: string;
  label: string;
  postfix: string;
  baseValue: number;
  tierValue: number;
  resolvedValue: number;
  tierDelta: number;
  itemDelta: number;
  factors: AbilityFactor[];
  scale: ScaleSource | null;
  scaleMode: "coefficient" | "inferred-1to1" | "additive" | "none";
  notes: string[];
  isDamage: boolean;
};

export type ResolvedAbility = {
  ability: HeroAbility;
  slot: string;
  level: number;
  properties: ResolvedAbilityProperty[];
  hasProcBonus: boolean;
};

type ItemModTotals = {
  percent: Record<string, number>;
  add: Record<string, number>;
  /**
   * Which items contributed each modifier type, and by how much.
   *
   * The totals say what the build does; this says which item did it, so a
   * number on an ability can be traced back to a build slot.
   */
  sources: Record<string, AbilityFactorItem[]>;
};

/** One item's contribution to a modifier type. */
export type AbilityFactorItem = {
  slug: string;
  name: string;
  value: number;
  postfix: string;
};

function sumItemMods(items: BuildItem[], statMap: StatMap): ItemModTotals {
  const percent: Record<string, number> = {};
  const add: Record<string, number> = {};
  const sources: Record<string, AbilityFactorItem[]> = {};

  for (const item of items) {
    const props = toProperties(item.properties);
    for (const prop of Object.values(props)) {
      const type = prop.provided_property_type;
      if (!type) continue;
      const val = numericValue(prop.value);
      if (val == null || val === 0) continue;
      const mapped = statMap.modifiers?.[type];
      if (mapped?.kind === "percent") {
        percent[type] = (percent[type] ?? 0) + val;
      } else {
        add[type] = (add[type] ?? 0) + val;
      }
      const list = sources[type] ?? [];
      list.push({
        slug: item.slug,
        name: item.name,
        value: val,
        postfix: prop.postfix ?? "",
      });
      sources[type] = list;
    }
  }
  return { percent, add, sources };
}

/**
 * The items that gave the build its spirit power.
 *
 * The spirit power total is the sum of every spirit item's bonus, so the
 * breakdown has to name them.
 */
function spiritPowerItems(mods: ItemModTotals): AbilityFactorItem[] {
  return mods.sources["MODIFIER_VALUE_TECH_POWER"] ?? [];
}

function getDerivedStatValue(
  eStat: string,
  mods: ItemModTotals,
  statMap: StatMap,
  spiritPower: number,
): { multiplier: number; additive: number; charges: number; factors: AbilityFactor[] } {
  const bridge = statMap.scaleStatModifiers?.[eStat];
  const factors: AbilityFactor[] = [];
  let multiplier = 1;
  let additive = 0;
  let charges = 0;

  if (!bridge) {
    if (eStat === "ETechPower") {
      return {
        multiplier: 1,
        additive: spiritPower,
        charges: 0,
        factors: [
          {
            label: "Spirit Power",
            kind: "scale",
            delta: spiritPower,
            source: "build",
            items: spiritPowerItems(mods),
          },
        ],
      };
    }
    return { multiplier: 1, additive: 0, charges: 0, factors: [] };
  }

  if (bridge.kind === "percentMultiplier") {
    let totalPct = 0;
    for (const mt of bridge.modifiers) {
      const p = mods.percent[mt] ?? 0;
      if (p !== 0) {
        totalPct += p;
        factors.push({
          label: mt.replace("MODIFIER_VALUE_", "").replace(/_/g, " ").toLowerCase(),
          kind: "item",
          delta: p / 100,
          source: mt,
          items: mods.sources[mt],
        });
      }
    }
    multiplier = 1 + totalPct / 100;
  } else if (bridge.kind === "additive") {
    if (eStat === "ETechPower") {
      additive += spiritPower;
      if (spiritPower !== 0) {
        factors.push({
          label: "Spirit Power",
          kind: "scale",
          delta: spiritPower,
          source: "build",
          items: spiritPowerItems(mods),
        });
      }
    }
    for (const mt of bridge.modifiers) {
      const a = mods.add[mt] ?? 0;
      if (a !== 0) {
        additive += a;
        factors.push({
          label: mt.replace("MODIFIER_VALUE_", "").replace(/_/g, " ").toLowerCase(),
          kind: "item",
          delta: a,
          source: mt,
          items: mods.sources[mt],
        });
      }
    }
  } else if (bridge.kind === "charges") {
    for (const mt of bridge.modifiers) {
      const a = mods.add[mt] ?? 0;
      if (a !== 0) {
        charges += a;
        factors.push({
          label: "Charges",
          kind: "item",
          delta: a,
          source: mt,
          items: mods.sources[mt],
        });
      }
    }
  }

  return { multiplier, additive, charges, factors };
}

function isDamageProperty(key: string, prop: Property): boolean {
  const cssClass = prop?.css_class;
  if (cssClass === "tech_damage" || cssClass === "bullet_damage" || cssClass === "damage" || cssClass === "melee_damage") return true;
  const label = (prop?.label ?? "").toLowerCase();
  if (label.includes("damage")) return true;
  return false;
}

/**
 * Whether a property's own scale function scales off spirit power.
 *
 * The tool only resolves spirit power, so this decides whether the
 * property's `scale_function` contributes a number at all.
 */
function scalesWithSpiritPower(
  scale: ScaleSource | null,
  prop: Property,
): boolean {
  if (!scale || scale.notModelled) return false;
  return (
    scale.heroStat === "weapon_power" ||
    scale.from === "ETechPower" ||
    (prop.scale_function?.class_name?.includes("tech_damage") ?? false)
  );
}

/**
 * The spirit-power coefficient applied to a property.
 *
 * A tier's `EAddToScale` bonus adds to the property's *scale coefficient*,
 * not to its value: Crimson Slash's Damage has a 0.37 spirit coefficient and
 * its tier-3 "+0.6" makes that 0.97. Adding the 0.6 to the value as well
 * would count it twice once the scaling is applied.
 *
 * When the property's own scale is off a different stat — Mina's Rake
 * heals 30% of damage dealt, which the tool does not model — the tier's
 * coefficient stands on its own and is added alongside.
 */
function spiritCoefficient(
  scale: ScaleSource | null,
  tierCoefficient: number,
  ownIsSpirit: boolean,
): number {
  if (ownIsSpirit) return (scale?.coefficient ?? 0) + tierCoefficient;
  return tierCoefficient;
}

export function resolveAbilitiesAtLevel(
  abilities: HeroAbility[],
  items: BuildItem[],
  statMap: StatMap,
  displayNames: Record<string, string>,
  levels: Record<string, number>,
): ResolvedAbility[] {
  const mods = sumItemMods(items, statMap);
  const spiritPower = buildSpiritPower(items);

  const out: ResolvedAbility[] = [];

  for (const entry of abilities) {
    const tiers = upgradeTiers(entry.ability.upgrades);
    const level = levels[entry.slot] ?? 0;
    const baseProperties = propertiesAtLevel(
      (entry.ability.properties ?? {}) as Record<string, never>,
      tiers,
      0,
    );
    const properties = propertiesAtLevel(
      (entry.ability.properties ?? {}) as Record<string, never>,
      tiers,
      level,
    );
    const tierScales = scaleBonusesAtLevel(tiers, level);

    const resolvedProps: ResolvedAbilityProperty[] = [];

    for (const [key, prop] of Object.entries(properties)) {
      const type = prop.provided_property_type;
      const mapped = type ? statMap.modifiers?.[type] : null;
      if (type && !mapped && !prop.css_class) continue;

      const baseValue = numericValue(prop.value);
      const basePropValue = numericValue(baseProperties[key]?.value) ?? baseValue;
      if (baseValue == null || baseValue === 0) continue;

      const scale = scaleSource(prop, displayNames, statMap.displayStatLabels ?? {});
      const factors: AbilityFactor[] = [{ label: "Base", kind: "base", delta: basePropValue ?? baseValue }];
 
      let resolvedValue = baseValue;
      let scaleMode: ResolvedAbilityProperty["scaleMode"] = "none";
      const notes: string[] = [];

      /**
       * The tier's `EAddToScale` bonus adds to the property's *scale
       * coefficient*, not to the value. Crimson Slash's Damage has a 0.37
       * spirit coefficient and its tier-3 "+0.6" makes that 0.97 — adding
       * the 0.6 to the value as well would count it twice.
       */
      const tierCoefficient = tierScales.coefficients[key] ?? 0;
      const ownIsSpirit = scalesWithSpiritPower(scale, prop);
      const coefficient = spiritCoefficient(scale, tierCoefficient, ownIsSpirit);
      if (tierScales.notModelled.includes(key)) {
        notes.push("Tier upgrade scaling [not modelled]");
      }

      // A tier bonus always scales off spirit power, so it applies even when
      // the property's own scale is off a stat the tool does not compute.
      const tierSpiritAdd = tierCoefficient * spiritPower;

      // Special handling for Mina's Rake: base heals 30% of damage dealt [not modelled],
      // tier 3 adds +1.2 per spirit power
      const isRakeHeal = entry?.ability?.className === "ability_vampirebat_steallife" && key === "RakeHealPerKill";
      if (isRakeHeal) {
        scaleMode = "coefficient";
        resolvedValue = baseValue;
        factors.push({ label: "Damage dealt (30%)", kind: "scale", delta: 0, source: "herohealsf" });
        if (tierCoefficient > 0) {
          resolvedValue = baseValue + tierSpiritAdd;
          factors.push({
            label: "Spirit Power",
            kind: "scale",
            delta: Math.round(tierSpiritAdd * 100) / 100,
            source: String(tierCoefficient),
            items: spiritPowerItems(mods),
          });
          notes.push(
            `Heals 30% of damage dealt [not modelled] + ${tierCoefficient} × spirit power (Tier 3)`,
          );
        } else {
          notes.push("Heals 30% of damage dealt [not modelled]");
        }
      } else if (scale?.notModelled) {
        scaleMode = "none";
        notes.push(`${scale.label} scaling [not modelled]`);
        // The property's own scale is off a stat the tool does not compute,
        // but a tier bonus may still add spirit scaling on top.
        if (tierSpiritAdd !== 0) {
          resolvedValue = baseValue + tierSpiritAdd;
          factors.push({
            label: "Spirit Power",
            kind: "scale",
            delta: Math.round(tierSpiritAdd * 100) / 100,
            source: String(tierCoefficient),
            items: spiritPowerItems(mods),
          });
        }
      } else if (scale) {
        const eStat = scale.from;
        if (ownIsSpirit) {
          scaleMode = scale.coefficient != null || tierCoefficient > 0 ? "coefficient" : "inferred-1to1";
          if (scale.coefficient != null || tierCoefficient > 0) {
            resolvedValue = baseValue + coefficient * spiritPower;
            factors.push({
              label: "Spirit Power",
              kind: "scale",
              delta: Math.round(coefficient * spiritPower * 100) / 100,
              source: String(coefficient),
              items: spiritPowerItems(mods),
            });
            notes.push("Computed from base + coefficient × spirit power");
          } else {
            const derived = getDerivedStatValue("ETechPower", mods, statMap, spiritPower);
            resolvedValue = baseValue + derived.additive;
            factors.push(...derived.factors);
            notes.push("Spirit power scaling (inferred)");
          }
        } else if (eStat) {
          const derived = getDerivedStatValue(eStat, mods, statMap, spiritPower);
          if (scale.coefficient != null) {
            scaleMode = "coefficient";
            resolvedValue = baseValue * derived.multiplier + derived.additive;
            factors.push(...derived.factors);
            if (derived.multiplier !== 1) {
              factors.push({ label: "Scale stat", kind: "scale", delta: baseValue * (derived.multiplier - 1), source: eStat });
            }
            notes.push(`Scales with ${scale.label}${scale.coefficient != null ? ` (× ${scale.coefficient})` : ""}`);
          } else {
            scaleMode = "inferred-1to1";
            resolvedValue = baseValue * derived.multiplier + derived.additive;
            factors.push(...derived.factors);
            if (derived.multiplier !== 1) {
              factors.push({ label: "Scale stat", kind: "scale", delta: baseValue * (derived.multiplier - 1), source: eStat });
            }
            notes.push(`Scales with ${scale.label} (1:1, inferred)`);
          }
          // The property's own scale is off another stat, so a tier bonus
          // that scales off spirit power is added on top of it.
          if (tierSpiritAdd !== 0) {
            resolvedValue += tierSpiritAdd;
            factors.push({
              label: "Spirit Power",
              kind: "scale",
              delta: Math.round(tierSpiritAdd * 100) / 100,
              source: String(tierCoefficient),
              items: spiritPowerItems(mods),
            });
          }
        }
      } else if (tierSpiritAdd !== 0) {
        // No scale function of its own: the tier bonus introduces one.
        scaleMode = "coefficient";
        resolvedValue = baseValue + tierSpiritAdd;
        factors.push({
          label: "Spirit Power",
          kind: "scale",
          delta: Math.round(tierSpiritAdd * 100) / 100,
          source: String(tierCoefficient),
          items: spiritPowerItems(mods),
        });
        notes.push("Scales with spirit power from the tier upgrade");
      }

      const tierValue = baseValue;
      const tierDelta = (tierValue ?? basePropValue ?? 0) - (basePropValue ?? 0);
      const itemDelta = resolvedValue - tierValue;

      resolvedProps.push({
        key,
        label: prop.label?.trim() || key,
        postfix: prop.postfix ?? "",
        baseValue: basePropValue ?? baseValue,
        tierValue,
        resolvedValue: Math.round(resolvedValue * 100) / 100,
        tierDelta: Math.round(tierDelta * 100) / 100,
        itemDelta: Math.round(itemDelta * 100) / 100,
        factors,
        scale,
        scaleMode,
        notes,
        isDamage: isDamageProperty(key, prop),
      });
    }

    out.push({
      ability: entry,
      slot: entry.slot,
      level,
      properties: resolvedProps,
      hasProcBonus: false,
    });
  }

  return out;
}
