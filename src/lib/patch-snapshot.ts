/**
 * The snapshot record.
 *
 * A snapshot is what a patch diff reads. It is deliberately **not** the raw
 * API record: the raw heroes and items together are 7.84 MB per build, which
 * is 392 MB for fifty builds. Normalised — values rather than the engine's
 * full property objects — it is 2.22 MB per build, which is affordable and
 * holds everything a diff needs.
 *
 * Two rules shape it.
 *
 * **Values, not objects.** The API's `properties` is a map of engine
 * vocabulary: 441 keys, each an object with a `value`, a
 * `display_stat_name` and more. A diff only cares about the value, and
 * storing the rest is what makes the raw record 3.86 MB on its own.
 *
 * **Keep what you do not recognise.** A field the normaliser drops cannot
 * be diffed later. Since this is an ongoing process and the shape will be
 * revised as patches turn up new kinds of change, anything unrecognised is
 * kept rather than discarded, so nothing is lost by being cautious now.
 *
 * It lives here rather than in the ingest script because it is the shared
 * contract between the two: the ingest writes it, the diff reads it.
 */

/** A hero's snapshot. */
export type HeroSnapshotRecord = {
  apiId: number;
  className: string;
  name: string;
  complexity: number | null;
  /**
   * The API's own state. `"release"` for every playable hero, so it cannot
   * identify a new one on its own — but it is kept because it is cheap and
   * it says something.
   */
  developmentState: string | null;
  /**
   * Whether the hero could be played.
   *
   * This is the release signal. A hero is in the files long before it is
   * playable, and that time does not count: a character who cannot be
   * picked is not in the game yet.
   */
  playerSelectable: boolean;
  disabled: boolean;
  inDevelopment: boolean;
  heroType: string | null;
  /** The hero's own stats, as plain values. */
  startingStats: Record<string, number | string | boolean | null>;
  /**
   * The hero's ability slots, by class name.
   *
   * The API's `items` maps a slot name to a class name — `ability_mantle`
   * to `citadel_ability_mantle` — not to an id, so the class names are
   * what identify the abilities. They are kept because "which abilities
   * can this hero use" is a thing a patch can change.
   */
  abilitySlots: Record<string, string>;
  /** The global purchase and upgrade rules. */
  standardLevelUpUpgrades: Record<string, number | string | boolean | null>;
  purchaseBonuses: unknown;
  /**
   * The hero's own prose, kept apart from the values so a reader can see
   * what the description now says without the diff re-fetching the old
   * build.
   */
  description: unknown;
};

/** An item's snapshot. */
export type ItemSnapshotRecord = {
  apiId: number;
  className: string;
  name: string | null;
  type: string | null;
  /** The item's cost in souls. */
  cost: number | null;
  /** The item's properties, as plain values. */
  properties: Record<string, number | string | boolean | null>;
  /** The item's prose, kept apart from the values. */
  description: unknown;
  tooltipSections: unknown;
  tooltipDetails: unknown;
};

/** An ability's snapshot. */
export type AbilitySnapshotRecord = {
  apiId: number;
  className: string;
  name: string | null;
  type: string | null;
  /**
   * The ability's own values — cooldown, cast delay, damage and so on.
   *
   * Abilities carry no upgrade tiers of their own. What tiers an ability
   * up is the **hero's** `standard_level_up_upgrades`, which is the
   * per-level scaling the hero applies to its abilities. That is stored on
   * the hero snapshot.
   */
  properties: Record<string, number | string | boolean | null>;
  /** The heroes that share this ability — the universal roster. */
  heroes: number[];
  description: unknown;
  tooltipDetails: unknown;
};

/**
 * Flatten a value to a plain scalar.
 *
 * The API wraps most values as `{ value, display_stat_name, ... }`. A diff
 * only cares about the value, and the wrapper is what makes the raw record
 * large. Anything that is not a scalar is kept as-is under its own key, so
 * an unrecognised shape is still visible to a diff.
 */
export function plainValue(input: unknown): number | string | boolean | null {
  if (input === null || input === undefined) return null;
  if (
    typeof input === "number" ||
    typeof input === "string" ||
    typeof input === "boolean"
  ) {
    return input;
  }
  if (typeof input === "object" && "value" in (input as Record<string, unknown>)) {
    return plainValue((input as Record<string, unknown>).value);
  }
  return null;
}

/**
 * Flatten a map of engine properties to plain values.
 *
 * Keys whose value is not a scalar are kept under the key itself with the
 * raw object, so a diff can still see that something changed even when the
 * shape is unfamiliar.
 */
export function plainMap(input: unknown): Record<string, number | string | boolean | null> {
  const out: Record<string, number | string | boolean | null> = {};
  if (!input || typeof input !== "object") return out;

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const value = plainValue(raw);
    if (value === null && raw !== null && raw !== undefined) {
      // Not a scalar and not a wrapped value. Keep the shape under its own
      // key so the change is not invisible.
      out[key] = JSON.stringify(raw);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * The hero's ability slots, by class name.
 *
 * The API's `items` is a map of slot name to class name — `ability_mantle`
 * to `citadel_ability_mantle` — so the class names are what identify the
 * abilities. Weapon slots are included: a hero's weapon can change too.
 */
function heroAbilitySlots(raw: {
  items?: unknown;
}): Record<string, string> {
  const slots: Record<string, string> = {};
  if (!raw.items || typeof raw.items !== "object") return slots;

  for (const [slot, value] of Object.entries(
    raw.items as Record<string, unknown>,
  )) {
    if (typeof value !== "string") continue;
    slots[slot] = value;
  }
  return slots;
}

/**
 * The raw API hero, normalised for a snapshot.
 *
 * The shape is deliberately stable, because a diff compares two of these
 * and both sides have to hold the same fields.
 */
export function heroSnapshotRecord(
  raw: Record<string, unknown>,
): HeroSnapshotRecord {
  const startingStats = plainMap(raw.starting_stats);

  return {
    apiId: typeof raw.id === "number" ? raw.id : -1,
    className: typeof raw.class_name === "string" ? raw.class_name : "",
    name: typeof raw.name === "string" ? raw.name : "",
    complexity:
      typeof raw.complexity === "number" ? raw.complexity : null,
    developmentState:
      typeof raw.development_state === "string" ? raw.development_state : null,
    playerSelectable: raw.player_selectable === true,
    disabled: raw.disabled === true,
    inDevelopment: raw.in_development === true,
    heroType: typeof raw.hero_type === "string" ? raw.hero_type : null,
    startingStats,
    abilitySlots: heroAbilitySlots(raw as never),
    standardLevelUpUpgrades: plainMap(raw.standard_level_up_upgrades),
    purchaseBonuses: raw.purchase_bonuses ?? null,
    description: raw.description ?? null,
  };
}

/** The raw API item, normalised for a snapshot. */
export function itemSnapshotRecord(
  raw: Record<string, unknown>,
): ItemSnapshotRecord {
  return {
    apiId: typeof raw.id === "number" ? raw.id : -1,
    className: typeof raw.class_name === "string" ? raw.class_name : "",
    name: typeof raw.name === "string" ? raw.name : null,
    type: typeof raw.type === "string" ? raw.type : null,
    cost: typeof raw.cost === "number" ? raw.cost : null,
    properties: plainMap(raw.properties),
    description: raw.description ?? null,
    tooltipSections: raw.tooltip_sections ?? null,
    tooltipDetails: raw.tooltip_details ?? null,
  };
}

/** The raw API ability, normalised for a snapshot. */
export function abilitySnapshotRecord(
  raw: Record<string, unknown>,
): AbilitySnapshotRecord {
  const heroes: number[] = [];
  if (Array.isArray(raw.heroes)) {
    for (const hero of raw.heroes) {
      if (typeof hero === "number") heroes.push(hero);
      else if (hero && typeof hero === "object" && "id" in hero) {
        const id = (hero as { id?: unknown }).id;
        if (typeof id === "number") heroes.push(id);
      }
    }
  }

  return {
    apiId: typeof raw.id === "number" ? raw.id : -1,
    className: typeof raw.class_name === "string" ? raw.class_name : "",
    name: typeof raw.name === "string" ? raw.name : null,
    type: typeof raw.type === "string" ? raw.type : null,
    properties: plainMap(raw.properties),
    heroes: [...new Set(heroes)].sort((a, b) => a - b),
    description: raw.description ?? null,
    tooltipDetails: raw.tooltip_details ?? null,
  };
}
