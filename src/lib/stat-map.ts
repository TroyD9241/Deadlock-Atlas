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
    const properties = toProperties(item.properties);
    for (const [key, property] of Object.entries(properties)) {
      const type = property.provided_property_type;
      if (!type) continue;
      const mapped = map.modifiers[type];
      if (!mapped) continue;

      const value = numericValue(property.value);
      if (value == null || value === 0) continue;

      const line = lines.get(key) ?? {
        key,
        label: property.label?.trim() || key,
        group: mapped.group,
        kind: mapped.kind,
        total: 0,
        base: mapped.heroStat ? (stats[mapped.heroStat] ?? null) : null,
        heroStat: mapped.heroStat ?? null,
        postfix: property.postfix ?? "",
        sources: [],
      };

      line.total += value;
      line.sources.push({ slug: item.slug, name: item.name, value });
      lines.set(key, line);
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
 * The final value of a stat after a build.
 *
 * `add` modifiers are added to the base; `percent` modifiers are summed and
 * applied to the base. The game applies several percent bonuses
 * multiplicatively in some cases — this is a simplification, and the tool
 * says so.
 */
export function statTotal(line: StatLine): number | null {
  if (line.base == null) return null;
  if (line.kind === "add") return line.base + line.total;
  return line.base * (1 + line.total / 100);
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
