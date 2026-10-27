/**
 * The types the theorycraft tool's components share.
 */

import type { Build } from "@/lib/build";
import type { StatLine, StatMap } from "@/lib/stat-map";
import type { ItemPlayData } from "@/lib/play-data-format";

export type { Build };
export type { ItemPlayData };

/**
 * One item as the tool sees it.
 *
 * The board and the picker both need the item's metadata; the properties are
 * what the stat readout is computed from.
 */
export type PickerItem = {
  slug: string;
  name: string;
  nameSource: string;
  slotType: string | null;
  tier: number | null;
  cost: number | null;
  image: string | null;
  imageWebp: string | null;
  shopImage: string | null;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  properties: unknown;
};

/** The item fields the board needs, keyed by slug. */
export type ItemIndexRow = {
  slug: string;
  name: string;
  slotType: string | null;
  tier: number | null;
  cost: number | null;
  properties: unknown;
  image: string | null;
  imageWebp: string | null;
  shopImage: string | null;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
};

/** One hero ability, with the data the tool needs. */
export type HeroAbility = {
  id: number;
  slot: string;
  displayOrder: number;
  isInnate: boolean;
  ability: {
    id: number;
    className: string;
    name: string;
    image: string | null;
    imageWebp: string | null;
    properties: unknown;
    upgrades: unknown;
  };
};

/**
 * What is highlighted, and on what.
 *
 * The board and the rail are linked: hovering a stat isolates the items that
 * feed it, and hovering an item isolates the stats it contributes.
 */
export type Highlight = {
  kind: "stat" | "item";
  /**
   * The key of what is highlighted: a rail stat's id, a readout line's
   * property key, or an item's slug.
   */
  key: string;
  /**
   * The modifier types the highlighted stat is fed by.
   *
   * The board's chips are properties, and a rail stat is fed by modifier
   * types, so the rail row has to carry them for the board to match on.
   */
  modifiers?: string[];
} | null;

/** The stat line as the rail and the board both refer to it. */
export type { StatLine, StatMap };
