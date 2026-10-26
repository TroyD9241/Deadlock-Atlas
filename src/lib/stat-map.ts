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
export type StatLine = {
  /** The property key, e.g. BonusHealth. */
  key: string;
  /** The display name, from the property's own label. */
  label: string;
  /** The engine modifier type, e.g. MODIFIER_VALUE_HEALTH_MAX. */
  modifierType: string;
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
  sources: { slug: string; name: string; value: number }[];
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
        });
        continue;
      }
      existing.total += line.total;
      existing.sources.push(...line.sources);
    }
  }

  return [...lines.values()].sort((a, b) => {
    const ga = map.groups.findIndex((g) => g.id === a.group);
    const gb = map.groups.findIndex((g) => g.id === b.group);
    if (ga !== gb) return ga - gb;
    return a.label.localeCompare(b.label);
  });
}

/**
 * The stat lines one item contributes on its own.
 *
 * The board shows this on the card, so the reader can see what an item does
 * without adding it first. `buildReadout` is the sum of these.
 */
export function itemContributions(
  item: BuildItem,
  map: StatMap,
): StatLine[] {
  const properties = toProperties(item.properties);
  const lines: StatLine[] = [];

  for (const [key, property] of Object.entries(properties)) {
    const type = property.provided_property_type;
    if (!type) continue;
    const mapped = map.modifiers[type];
    if (!mapped) continue;

    const value = numericValue(property.value);
    if (value == null || value === 0) continue;

    lines.push({
      key,
      label: property.label?.trim() || key,
      modifierType: type,
      group: mapped.group,
      kind: mapped.kind,
      total: value,
      base: null,
      heroStat: mapped.heroStat ?? null,
      postfix: property.postfix ?? "",
      sources: [{ slug: item.slug, name: item.name, value }],
    });
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
      const feeding = lines.filter((l) => spec.modifiers.includes(l.modifierType));
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
