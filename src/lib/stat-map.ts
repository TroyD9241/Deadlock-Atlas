/**
 * The stat model for the theorycraft tool.
 *
 * Hero base stats and item properties share no keys: heroes use engine
 * names (max_health, base_health_regen), items use modifier names
 * (BonusHealth, TechPower). They cannot be joined by name.
 *
 * The bridge is `provided_property_type` — the engine's own modifier
 * vocabulary, which both items and abilities carry. data/curated/stat-map.json
 * says what each modifier type does; the property's own `label` is used for
 * the display name, so the map never has to name things.
 *
 * This module is safe to import from the browser: it reads no files and
 * touches no Node APIs. The map itself is loaded by
 * src/lib/stat-map.server.ts.
 *
 * Honesty rule: these are numbers computed from API stat values, not the
 * numbers the game would show. The game applies hidden multipliers,
 * spirit-power thresholds and proc interactions that are not in the data.
 */

export type StatGroup = {
  id: string;
  label: string;
};

export type ModifierKind = "add" | "percent";

export type ModifierMap = {
  group: string;
  kind: ModifierKind;
  /** The hero base stat this modifier adds to, when there is one. */
  heroStat?: string;
};

export type CssGroupMap = {
  group: string;
  label: string;
};

export type Condition = {
  label: string;
  bonusProperty: string;
  bonusLabel?: string;
  thresholdProperty: string | null;
  damageType: "spirit" | "weapon";
  condition: string;
  wording: string;
};

export type HeroStatSpec = {
  group: string;
  label: string;
};

export type ReadOnlyAbilityProperty = {
  label: string;
  group: string;
};

export type ScaleStatModifiers = {
  /**
   * Modifier types that feed this derived scale stat.
   * Values are summed (percentages added together) and applied as described.
   */
  modifiers: string[];
  /** How to apply the modifiers to the stat. */
  kind: "percentMultiplier" | "additive" | "charges";
  /** Base value when not set by hero stats. */
  base?: number;
};

export type StatMap = {
  groups: StatGroup[];
  modifiers: Record<string, ModifierMap>;
  /** The stat rail's curated set. */
  rail?: Record<string, RailSpec>;
  /** A display label for modifier types whose properties carry none. */
  modifierLabels?: Record<string, string>;
  /** A display label for the ability upgrade bonuses nothing else resolves. */
  abilityBonusLabels?: Record<string, string>;
  /** A readable name for the game's display stats: ETechCooldown, etc. */
  displayStatLabels?: Record<string, string>;
  /**
   * The hero's stat keys by the game's display name.
   *
   * The abilities' scale functions name their source stat in the same `E*`
   * vocabulary the hero's stats use, so the bridge is the hero's own data.
   */
  displayNames?: Record<string, string>;
  /** Fallback mapping from the engine's css_class to a group. */
  cssGroups?: Record<string, CssGroupMap>;
  /** Verified proc conditions for items. */
  conditions?: Record<string, Condition>;
  /** Bridge from derived scale stats (ETech*) to item modifiers. */
  scaleStatModifiers?: Record<string, ScaleStatModifiers>;
  /** Grouping for hero base stats. */
  heroStatGroups?: Record<string, { label: string; order?: number }>;
  /** Specs for hero base stats. */
  heroStatSpecs?: Record<string, HeroStatSpec>;
  /** Read-only ability properties shown separately. */
  readOnlyAbilityProperties?: Record<string, ReadOnlyAbilityProperty>;
};

/** One stat the rail shows, and the modifier types that feed it. */
export type RailSpec = {
  label: string;
  modifiers: string[];
};

/** One property on an item or an ability. */
export type Property = {
  label?: string;
  value?: unknown;
  postfix?: string;
  icon?: string;
  provided_property_type?: string;
  /**
   * The engine's own class for the property, e.g. `tech_damage`,
   * `bullet_damage`, `healing`. It is the only way to tell a damage property
   * apart when the property carries no `provided_property_type`.
   */
  css_class?: string;
  scale_function?: {
    class_name?: string;
    subclass_name?: string;
    stat_scale?: number;
    specific_stat_scale_type?: string;
  };
};

/** The properties map an item or ability carries. */
export type Properties = Record<string, Property>;

export function toProperties(raw: unknown): Properties {
  if (!raw || typeof raw !== "object") return {};
  const out: Properties = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    out[key] = value as Property;
  }
  return out;
}

/** A numeric value, or null when it is not a number. */
export function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** The hero's base stats, as a flat map of key -> value. */
export type HeroStats = Record<string, number>;

export function heroStats(startingStats: unknown): HeroStats {
  const out: HeroStats = {};
  if (!startingStats || typeof startingStats !== "object") return out;
  for (const [key, raw] of Object.entries(
    startingStats as Record<string, unknown>,
  )) {
    if (!raw || typeof raw !== "object") continue;
    const value = numericValue((raw as { value?: unknown }).value);
    if (value != null) out[key] = value;
  }
  return out;
}

/**
 * The hero's stat keys by the game's own display name.
 *
 * The hero's stats carry a `display_stat_name` in the same `E*` vocabulary
 * the abilities' scale functions use, so this is the bridge between them.
 * `ETechRange` → `tech_range`.
 */
export function heroStatsByDisplayName(
  startingStats: unknown,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!startingStats || typeof startingStats !== "object") return out;
  for (const [key, raw] of Object.entries(
    startingStats as Record<string, unknown>,
  )) {
    if (!raw || typeof raw !== "object") continue;
    const name = (raw as { display_stat_name?: unknown }).display_stat_name;
    if (typeof name === "string" && name) out[name] = key;
  }
  return out;
}

/**
 * One line of the readout.
 *
 * `base` and `total` are only set when the modifier feeds a hero base stat.
 * A flat modifier (no hero stat) is summed on its own.
 */
/**
 * One item's contribution to a stat line.
 *
 * The property key and label are kept so the breakdown can show which
 * property of which item produced the number, and so two items using
 * different properties are not merged into one another.
 */
export type StatSource = {
  /** The item's slug. */
  slug: string;
  /** The item's display name. */
  name: string;
  /** The value this item contributes. */
  value: number;
  /** The item property that produced it, e.g. "BonusHealth". */
  propertyKey: string;
  /** The property's own label, e.g. "Bonus Health". */
  propertyLabel: string;
};

/**
 * A source split by item, ready for display.
 *
 * The same item can contribute the same property from two build slots, so
 * the values are summed. Sources are sorted by size, biggest first.
 */
export type SourceBreakdown = {
  slug: string;
  name: string;
  value: number;
  postfix: string;
  /** The item property behind the contribution, e.g. "BonusHealth". */
  propertyKey: string;
  /** The property's label, when the sources disagreed about it. */
  propertyLabel: string | null;
};

export type StatLine = {
  /** The property key, e.g. BonusHealth. */
  key: string;
  /** The display name, from the property's own label. */
  label: string;
  /** The engine modifier type, e.g. MODIFIER_VALUE_HEALTH_MAX. */
  modifierType: string | null;
  /** The group it belongs to, from the stat map. */
  group: string;
  kind: ModifierKind;
  /** The sum of this modifier across the build. */
  total: number;
  /** The hero's base for the stat it feeds, when there is one. */
  base: number | null;
  /** The hero stat key it feeds, when there is one. */
  heroStat: string | null;
  /** The postfix the API gives the value, e.g. "%" or "s". */
  postfix: string;
  /** Which items contributed, for the breakdown. */
  sources: StatSource[];
  /** Whether the stat could be mapped/explained. */
  mapped: boolean;
  /** The engine's css_class, if present. */
  cssClass?: string | null;
};

export type BuildItem = {
  slug: string;
  name: string;
  properties: unknown;
};

/**
 * The readout for a build.
 *
 * Every mapped modifier gets a line — the noise is the point — grouped by
 * the stat map's groups. Modifiers with no mapping are skipped rather than
 * guessed at.
 */
export function buildReadout(
  items: BuildItem[],
  stats: HeroStats,
  map: StatMap,
): StatLine[] {
  const lines = new Map<string, StatLine>();

  for (const item of items) {
    for (const line of itemContributions(item, map)) {
      const existing = lines.get(line.key);
      if (!existing) {
        // The base is set here, because itemContributions does not know the
        // hero — only the build does.
        lines.set(line.key, {
          ...line,
          base: line.heroStat ? (stats[line.heroStat] ?? null) : null,
          mapped: line.mapped !== undefined ? line.mapped : true,
        });
        continue;
      }
      existing.total += line.total;
      existing.sources.push(...line.sources);
    }
  }

  const result = [...lines.values()].sort((a, b) => {
    const ga = map.groups.findIndex((g) => g.id === a.group);
    const gb = map.groups.findIndex((g) => g.id === b.group);
    if (ga !== gb) return ga - gb;
    return a.label.localeCompare(b.label);
  });
  return result as StatLine[];
}

/**
 * The stat lines one item contributes on its own.
 *
 * The board shows this on the card, so the reader can see what an item does
 * without adding it first. `buildReadout` is the sum of these.
 *
 * Properties without a `provided_property_type` fall back to the engine's
 * `css_class` via `cssGroups` so they are not silently dropped. Properties
 * with neither are still listed as unmapped so the reader knows the tool
 * cannot explain them.
 */
export function itemContributions(
  item: BuildItem,
  map: StatMap,
): StatLine[] {
  const properties = toProperties(item.properties);
  const lines: StatLine[] = [];

  for (const [key, property] of Object.entries(properties)) {
    const type = property.provided_property_type;
    const cssClass = property.css_class;

    let mapped: ModifierMap | undefined;
    let group: string;
    let kind: ModifierKind = "add";
    let heroStat: string | null = null;
    let isMapped = true;
    let modifierType: string | null = type ?? null;

    if (type) {
      mapped = map.modifiers[type];
      if (mapped) {
        group = mapped.group;
        kind = mapped.kind;
        heroStat = mapped.heroStat ?? null;
        isMapped = true;
      } else {
        // Try css_class fallback if provided type isn't known
        if (cssClass && map.cssGroups?.[cssClass]) {
          group = map.cssGroups[cssClass].group;
          kind = "add";
          heroStat = null;
          isMapped = true;
          modifierType = modifierType ?? cssClass;
        } else {
          group = "unmapped";
          kind = "add";
          heroStat = null;
          isMapped = false;
          modifierType = modifierType ?? cssClass ?? null;
        }
      }
    } else if (cssClass && map.cssGroups?.[cssClass]) {
      // No provided_property_type, fall back to css_class
      group = map.cssGroups[cssClass].group;
      kind = "add";
      heroStat = null;
      isMapped = true;
      modifierType = cssClass;
    } else {
      group = "unmapped";
      kind = "add";
      heroStat = null;
      isMapped = false;
      modifierType = cssClass ?? null;
    }

    const value = numericValue(property.value);
    if (value == null || value === 0) continue;

    // Skip threshold/condition properties (they are handled by the procs system)
    const keyLower = key.toLowerCase();
    const isConditionKey =
      keyLower.includes("threshold") ||
      keyLower.includes("minimumdamage") ||
      keyLower.includes("morerange") ||
      keyLower.includes("minrange") ||
      keyLower === "minimumdamage" ||
      keyLower === "damagethreshold";

    if (isConditionKey) {
      continue;
    }

    const label =
      property.label?.trim() ||
      (cssClass && map.cssGroups?.[cssClass]?.label) ||
      key;

    lines.push({
      key,
      label,
      modifierType: modifierType as string,
      group,
      kind,
      total: value,
      base: null,
      heroStat,
      postfix: property.postfix ?? "",
      sources: [
        {
          slug: item.slug,
          name: item.name,
          value,
          propertyKey: key,
          propertyLabel: label,
        },
      ],
      mapped: isMapped,
      cssClass: cssClass ?? null,
    } as StatLine);
  }

  return lines;
}

/**
 * The final value of a stat after a build.
 *
 * `add` modifiers are added to the base; `percent` modifiers are summed and
 * applied to the base. The game applies several percent bonuses
 * multiplicatively in some cases — this is a simplification, and the tool
 * says so.
 */
export function statTotal(line: StatLine): number | null {
  if (line.base == null || line.base === 0) return null;
  if (line.kind === "add") return line.base + line.total;
  return line.base * (1 + line.total / 100);
}

/**
 * Whether a stat has a base worth showing.
 *
 * A base of zero is not a meaningful "before" value: the hero has no
 * Weapon Power to start from, so `0 → 14` says nothing. Those stats show
 * their contribution alone.
 */
export function hasBase(line: StatLine): boolean {
  return line.base != null && line.base !== 0;
}

/** The contribution as it is written on a card: `+80`, `+14%`. */
export function contributionText(line: StatLine): string {
  const sign = line.total > 0 ? "+" : "";
  return `${sign}${line.total}${line.postfix}`;
}

/**
 * The per-item split of a stat line.
 *
 * A line's total is the sum of every item that feeds it, so the breakdown
 * answers "where did this number come from". Sources for the same item and
 * the same property are summed, because an item can be built twice.
 *
 * When the sources disagree about the property label — two items granting
 * the same stat through different properties — the labels are joined so the
 * reader can see they are not the same thing.
 */
export function sourceBreakdown(line: StatLine): SourceBreakdown[] {
  const byKey = new Map<string, SourceBreakdown>();
  const labels = new Map<string, Set<string>>();

  for (const source of line.sources) {
    const key = source.slug + "\u0000" + source.propertyKey;
    const existing = byKey.get(key);
    if (existing) {
      existing.value += source.value;
    } else {
      byKey.set(key, {
        slug: source.slug,
        name: source.name,
        value: source.value,
        postfix: line.postfix,
        propertyKey: source.propertyKey,
        propertyLabel: source.propertyLabel,
      });
    }
    const set = labels.get(key) ?? new Set<string>();
    set.add(source.propertyLabel);
    labels.set(key, set);
  }

  const out: SourceBreakdown[] = [];
  for (const [key, entry] of byKey) {
    const set = labels.get(key);
    if (set && set.size > 1) {
      entry.propertyLabel = [...set].join(" / ");
    }
    out.push(entry);
  }

  out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return out;
}

/**
 * The per-item split across every line feeding a rail stat.
 *
 * The rail's headline row is one number for many modifier lines, so this
 * flattens them into a single list of where the total comes from.
 */
export function statSourceBreakdown(
  lines: StatLine[],
): { rows: { label: string; value: string }[]; count: number } {
  const rows: { label: string; value: string }[] = [];
  const seen = new Set<string>();

  // Collect first, so an item that contributes through two different
  // properties can be told apart by its property label.
  const collected: SourceBreakdown[] = [];
  for (const line of lines) {
    for (const source of sourceBreakdown(line)) {
      const key = source.slug + "\u0000" + source.propertyKey;
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(source);
    }
  }

  const itemCounts = new Map<string, number>();
  for (const entry of collected) {
    itemCounts.set(entry.slug, (itemCounts.get(entry.slug) ?? 0) + 1);
  }

  for (const entry of collected) {
    const repeated = (itemCounts.get(entry.slug) ?? 0) > 1;
    rows.push({
      label:
        repeated && entry.propertyLabel
          ? `${entry.name} — ${entry.propertyLabel}`
          : entry.name,
      value: (entry.value > 0 ? "+" : "") + entry.value + entry.postfix,
    });
  }

  return { rows, count: rows.length };
}

/** The lines grouped for display, in the stat map's group order. */
export function groupLines(
  lines: StatLine[],
  map: StatMap,
): { group: StatGroup; lines: StatLine[] }[] {
  const out: { group: StatGroup; lines: StatLine[] }[] = [];
  for (const group of map.groups) {
    const groupLines = lines.filter((l) => l.group === group.id);
    if (groupLines.length > 0) out.push({ group, lines: groupLines });
  }
  const unmapped = lines.filter((l) => l.group === "unmapped");
  if (unmapped.length > 0) {
    out.push({ group: { id: "unmapped", label: "Unmapped" }, lines: unmapped });
  }
  return out;
}

/**
 * The headline stats for the compact hero-page summary.
 *
 * Only the stats a reader wants at a glance, chosen by the stat key the
 * modifier feeds.
 */
const HEADLINE_KEYS = [
  "max_health",
  "weapon_power",
  "tech_range",
  "max_move_speed",
  "sprint_speed",
  "stamina",
];

/** The headline lines for the summary, in a stable order. */
export function headlineLines(lines: StatLine[]): StatLine[] {
  const out: StatLine[] = [];
  for (const key of HEADLINE_KEYS) {
    const line = lines.find((l) => l.heroStat === key);
    if (line) out.push(line);
  }
  return out;
}

/**
 * The stat rail's headline set.
 *
 * Seven stats a reader wants at a glance while building: health, the two
 * damage scales, the two resistances, movement, and ability uptime.
 *
 * The set is curated in `data/curated/stat-map.json`, keyed by modifier
 * type rather than by display label — several modifier types share a label
 * ("Spirit Resist" covers both the resist and the reduction), and the label
 * depends on which property an item happens to use.
 */
export type RailStat = {
  /** The stable key for the row. */
  id: string;
  /** The label shown. */
  label: string;
  /** The modifier types that feed this stat, so the board can match on them. */
  modifiers: string[];
  /** The line it reads from, when the build touches it. */
  line: StatLine | null;
  /** Every line that feeds this stat, so the breakdown can list them all. */
  lines: StatLine[];
  /** The hero's base, when the stat has one. */
  base: number | null;
  /** The build's contribution. */
  contribution: number;
  /** The postfix for the numbers. */
  postfix: string;
  /** Whether the stat has a base worth showing. */
  hasBase: boolean;
};

/**
 * The rail rows for a build.
 *
 * Every rail stat gets a row even when the build does not touch it, so the
 * reader can see what a stat is at with nothing in it.
 */
export function railStats(lines: StatLine[], map: StatMap): RailStat[] {
  const rail = map.rail ?? {};
  return Object.entries(rail)
    // The curated file carries a $comment key for the reader; it is not a
    // rail spec.
    .filter((entry): entry is [string, RailSpec] =>
      Array.isArray((entry[1] as RailSpec)?.modifiers),
    )
    .map(([id, spec]) => {
      const feeding = lines.filter((l) => l.modifierType && spec.modifiers.includes(l.modifierType));
      const first = feeding[0] ?? null;

      // The base comes from the hero, and only the first feeding line knows
      // it — they all feed the same stat, so they share a base.
      const base = first?.base ?? null;
      const contribution = feeding.reduce((sum, l) => sum + l.total, 0);

      return {
        id,
        label: spec.label,
        modifiers: spec.modifiers,
        line: first,
        lines: feeding,
        base,
        contribution,
        postfix: first?.postfix ?? "",
        hasBase: base != null && base !== 0,
      };
    });
}

/** The resist lines, so the contrast view can show them side by side. */
export function resistLines(lines: StatLine[]): {
  spirit: StatLine[];
  bullet: StatLine[];
} {
  const spirit: StatLine[] = [];
  const bullet: StatLine[] = [];
  for (const line of lines) {
    if (line.group !== "defence") continue;
    const label = line.label.toLowerCase();
    if (label.includes("bullet")) bullet.push(line);
    else spirit.push(line);
  }
  return { spirit, bullet };
}

export function heroStatList(stats: HeroStats, map: StatMap) {
  const specs = map.heroStatSpecs ?? {};
  const groups = map.heroStatGroups ?? {};
  const entries = Object.entries(stats).map(([key, value]) => {
    const spec = specs[key];
    return {
      key,
      label: spec?.label ?? key.replace(/_/g, " "),
      group: spec?.group ?? "utility",
      value,
    };
  });
  const order = ["health", "spirit", "weapon", "movement", "defence", "utility"];
  const grouped = order
    .map((g) => {
      const items = entries
        .filter((e) => e.group === g)
        .sort((a, b) => a.label.localeCompare(b.label));
      if (items.length === 0) return null;
      return { group: g, label: groups[g]?.label ?? g, items };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return grouped;
}

export function readOnlyAbilityPropertiesList(properties: Properties, map: StatMap) {
  const specs = map.readOnlyAbilityProperties ?? {};
  const out: Array<{ key: string; label: string; value: number; postfix: string }> = [];
  for (const [key, prop] of Object.entries(properties)) {
    if (!specs[key]) continue;
    const value = numericValue(prop.value);
    if (value == null) continue;
    out.push({
      key,
      label: specs[key].label,
      value,
      postfix: prop.postfix ?? (typeof prop.value === "string" && prop.value.endsWith("%") ? "%" : ""),
    });
  }
  return out;
}
