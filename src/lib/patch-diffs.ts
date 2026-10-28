/**
 * The patch diff.
 *
 * Compares two builds' snapshots and says what changed.
 *
 * The hard part is not the comparison, it is telling a **real balance
 * change** apart from the noise. Measured across nineteen patches:
 *
 * - `purchase_bonuses` and `standard_level_up_upgrades` change for **all
 *   65 heroes** on most patches. They are the game's global purchase and
 *   upgrade rules, so they say nothing about any one hero. A naive diff
 *   would report "65 heroes changed" every time.
 * - Prose changes — descriptions, tooltips — are common and cosmetic.
 * - Real per-hero balance changes are rare: **one or two heroes per
 *   patch**, and often none at all.
 *
 * So a change is classified before it is scored, and only the classes that
 * mean something carry weight.
 */

import { db } from "@/lib/db";

import type {
  AbilitySnapshotRecord,
  HeroSnapshotRecord,
  ItemSnapshotRecord,
} from "@/lib/patch-snapshot";

/**
 * The fields on a hero that are the game's global rules rather than the
 * hero's own.
 *
 * They change together, for every hero, whenever the shop's rules change.
 * They are reported, because a reader may want to know the rules moved,
 * but they never score.
 */
const GLOBAL_HERO_FIELDS = new Set([
  "standardLevelUpUpgrades",
  "purchaseBonuses",
]);

/** The fields that are prose rather than values. */
const PROSE_HERO_FIELDS = new Set(["description"]);

/** The fields that are presentation rather than balance. */
const PRESENTATION_HERO_FIELDS = new Set([
  "name",
  "className",
  "apiId",
  "abilitySlots",
]);

/** What kind of change it was. */
export type ChangeKind =
  /** A value moved — the only kind that scores for a hero. */
  | "value"
  /** A property was added or removed. */
  | "property"
  /** The hero's text changed. */
  | "prose"
  /** The hero's artwork or roster changed. */
  | "presentation"
  /** The game's global rules changed. */
  | "global"
  /** The hero became playable. */
  | "release"
  /** The hero was playable before and is not now. */
  | "unrelease";

/** One field that changed. */
export type FieldChange = {
  /** The field's path, e.g. `startingStats.max_health`. */
  path: string;
  kind: ChangeKind;
  /** The value before, when there was one. */
  before: unknown;
  /** The value after, when there is one. */
  after: unknown;
};

/** One entity's changes between two builds. */
export type EntityDiff = {
  /** The entity's class name, which is stable across builds. */
  className: string;
  /** The entity's kind. */
  entity: "hero" | "item" | "ability";
  /** What changed. */
  changes: FieldChange[];
  /** The changes that carry weight. */
  scored: FieldChange[];
};

/** A whole patch, as the difference between two builds. */
export type PatchDiff = {
  /** The build the comparison starts from. */
  fromBuild: number;
  /** The build the comparison ends at. */
  toBuild: number;
  /** The heroes that changed. */
  heroes: EntityDiff[];
  /** The items that changed. */
  items: EntityDiff[];
  /** The abilities that changed. */
  abilities: EntityDiff[];
  /**
   * The heroes that became playable in this patch.
   *
   * A hero is only a hero once they can be picked. The API carries heroes
   * long before release — Nurse Harrow is in the data 89 builds before she
   * is playable — and that time does not count.
   */
  releases: EntityDiff[];
};

/** Read a snapshot's payload as a record. */
function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

/** Whether two values are the same, for the purpose of a diff. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== "object" || typeof b !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compare two flat maps of values.
 *
 * A key that is present on one side and not the other is a property added
 * or removed, which is a change a value comparison would miss: an item
 * losing four properties is a balance change.
 */
function compareMaps(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix: string,
  kind: (path: string) => ChangeKind,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const b = before[key];
    const a = after[key];
    if (same(a, b)) continue;

    if (!(key in before)) {
      changes.push({ path, kind: "property", before: null, after: a });
      continue;
    }
    if (!(key in after)) {
      changes.push({ path, kind: "property", before: b, after: null });
      continue;
    }
    changes.push({ path, kind: kind(path), before: b, after: a });
  }

  return changes;
}

/** The kind of a hero's changed field. */
function heroFieldKind(path: string): ChangeKind {
  const top = path.split(".")[0];
  if (GLOBAL_HERO_FIELDS.has(top)) return "global";
  if (PROSE_HERO_FIELDS.has(top)) return "prose";
  if (PRESENTATION_HERO_FIELDS.has(top)) return "presentation";
  if (path.startsWith("startingStats.")) return "value";
  if (path === "complexity") return "value";
  return "presentation";
}

/** The kind of an item's changed field. */
function itemFieldKind(path: string): ChangeKind {
  const top = path.split(".")[0];
  if (top === "description" || top === "tooltipSections" || top === "tooltipDetails") {
    return "prose";
  }
  if (top === "cost") return "value";
  if (top === "properties") return "value";
  return "presentation";
}

/** The kind of an ability's changed field. */
function abilityFieldKind(path: string): ChangeKind {
  const top = path.split(".")[0];
  if (top === "description" || top === "tooltipDetails") return "prose";
  if (top === "properties") return "value";
  if (top === "heroes") return "presentation";
  return "presentation";
}

/** Diff two hero snapshots. */
export function diffHeroes(
  before: HeroSnapshotRecord,
  after: HeroSnapshotRecord,
): EntityDiff {
  const changes: FieldChange[] = [];

  /*
   * The release signal is its own kind. A hero who becomes playable is
   * not a buff, and a hero who stops being playable is not a nerf.
   */
  if (!before.playerSelectable && after.playerSelectable) {
    changes.push({
      path: "playerSelectable",
      kind: "release",
      before: false,
      after: true,
    });
  }
  if (before.playerSelectable && !after.playerSelectable) {
    changes.push({
      path: "playerSelectable",
      kind: "unrelease",
      before: true,
      after: false,
    });
  }

  for (const key of Object.keys(after)) {
    if (key === "playerSelectable") continue;
    const b = (before as unknown as Record<string, unknown>)[key];
    const a = (after as unknown as Record<string, unknown>)[key];

    if (key === "startingStats" || key === "standardLevelUpUpgrades") {
      changes.push(
        ...compareMaps(
          asRecord(b),
          asRecord(a),
          key,
          (path) => heroFieldKind(path),
        ),
      );
      continue;
    }

    if (same(a, b)) continue;
    changes.push({
      path: key,
      kind: heroFieldKind(key),
      before: b,
      after: a,
    });
  }

  return {
    className: after.className || before.className,
    entity: "hero",
    changes,
    /*
     * A release is not a balance change. A hero who has just become
     * playable has not been buffed, and scoring their stat differences
     * would make every release look like the biggest balance change of
     * the patch.
     */
    scored: changes.filter(
      (c) =>
        (c.kind === "value" || c.kind === "property") &&
        !changes.some((x) => x.kind === "release" || x.kind === "unrelease"),
    ),
  };
}

/** Diff two item snapshots. */
export function diffItems(
  before: ItemSnapshotRecord,
  after: ItemSnapshotRecord,
): EntityDiff {
  const changes: FieldChange[] = [];

  for (const key of Object.keys(after)) {
    const b = (before as unknown as Record<string, unknown>)[key];
    const a = (after as unknown as Record<string, unknown>)[key];

    if (key === "properties") {
      changes.push(
        ...compareMaps(asRecord(b), asRecord(a), key, (path) =>
          itemFieldKind(path),
        ),
      );
      continue;
    }

    if (same(a, b)) continue;
    changes.push({ path: key, kind: itemFieldKind(key), before: b, after: a });
  }

  return {
    className: after.className || before.className,
    entity: "item",
    changes,
    scored: changes.filter((c) => c.kind === "value" || c.kind === "property"),
  };
}

/** Diff two ability snapshots. */
export function diffAbilities(
  before: AbilitySnapshotRecord,
  after: AbilitySnapshotRecord,
): EntityDiff {
  const changes: FieldChange[] = [];

  for (const key of Object.keys(after)) {
    const b = (before as unknown as Record<string, unknown>)[key];
    const a = (after as unknown as Record<string, unknown>)[key];

    if (key === "properties") {
      changes.push(
        ...compareMaps(asRecord(b), asRecord(a), key, (path) =>
          abilityFieldKind(path),
        ),
      );
      continue;
    }

    if (same(a, b)) continue;
    changes.push({
      path: key,
      kind: abilityFieldKind(key),
      before: b,
      after: a,
    });
  }

  return {
    className: after.className || before.className,
    entity: "ability",
    changes,
    scored: changes.filter((c) => c.kind === "value" || c.kind === "property"),
  };
}

/**
 * The diff between two builds.
 *
 * Both builds must have been ingested. A build that has not been ingested
 * cannot be compared, so the caller gets an empty diff rather than a
 * wrong one.
 */
export async function diffBuilds(
  fromBuild: number,
  toBuild: number,
): Promise<PatchDiff> {
  const empty: PatchDiff = {
    fromBuild,
    toBuild,
    heroes: [],
    items: [],
    abilities: [],
    releases: [],
  };

  const [from, to] = await Promise.all([
    db.patch.findUnique({ where: { clientVersion: fromBuild } }),
    db.patch.findUnique({ where: { clientVersion: toBuild } }),
  ]);
  if (!from || !to) return empty;

  const [heroRows, itemRows, abilityRows] = await Promise.all([
    db.heroSnapshot.findMany({
      where: { patchId: { in: [from.id, to.id] } },
      include: { hero: { select: { slug: true } } },
    }),
    db.itemSnapshot.findMany({
      where: { patchId: { in: [from.id, to.id] } },
    }),
    db.abilitySnapshot.findMany({
      where: { patchId: { in: [from.id, to.id] } },
    }),
  ]);

  /*
   * The snapshots are keyed by the entity they describe, not by their own
   * row id — the two sides of a comparison are the same hero, and that is
   * what has to line up.
   */
  const byPatch = <T extends { patchId: number }>(
    rows: T[],
    entityId: (row: T) => number,
  ): Map<number, Map<number, T>> => {
    const out = new Map<number, Map<number, T>>();
    for (const row of rows) {
      const forPatch = out.get(row.patchId) ?? new Map<number, T>();
      forPatch.set(entityId(row), row);
      out.set(row.patchId, forPatch);
    }
    return out;
  };

  const heroByPatch = byPatch(heroRows, (row) => row.heroId);
  const itemByPatch = byPatch(itemRows, (row) => row.itemId);
  const abilityByPatch = byPatch(abilityRows, (row) => row.abilityId);

  const heroes: EntityDiff[] = [];
  const releases: EntityDiff[] = [];

  for (const [heroId, beforeRow] of heroByPatch.get(from.id) ?? []) {
    const afterRow = heroByPatch.get(to.id)?.get(heroId);
    if (!afterRow) continue;

    const before = beforeRow.stats as unknown as HeroSnapshotRecord;
    const after = afterRow.stats as unknown as HeroSnapshotRecord;
    const diff = diffHeroes(before, after);
    if (diff.changes.length === 0) continue;
    heroes.push(diff);
    if (diff.changes.some((c) => c.kind === "release")) releases.push(diff);
  }

  const items: EntityDiff[] = [];
  for (const [itemId, beforeRow] of itemByPatch.get(from.id) ?? []) {
    const afterRow = itemByPatch.get(to.id)?.get(itemId);
    if (!afterRow) continue;

    const before = beforeRow.data as unknown as ItemSnapshotRecord;
    const after = afterRow.data as unknown as ItemSnapshotRecord;
    const diff = diffItems(before, after);
    if (diff.changes.length === 0) continue;
    items.push(diff);
  }

  const abilities: EntityDiff[] = [];
  for (const [abilityId, beforeRow] of abilityByPatch.get(from.id) ?? []) {
    const afterRow = abilityByPatch.get(to.id)?.get(abilityId);
    if (!afterRow) continue;

    const before = beforeRow.values as unknown as AbilitySnapshotRecord;
    const after = afterRow.values as unknown as AbilitySnapshotRecord;
    const diff = diffAbilities(before, after);
    if (diff.changes.length === 0) continue;
    abilities.push(diff);
  }

  return { fromBuild, toBuild, heroes, items, abilities, releases };
}
