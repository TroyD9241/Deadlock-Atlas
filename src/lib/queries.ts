/**
 * Read helpers for the site.
 *
 * The site only ever reads from the database, never from the live API
 * (DEADLOCK_SITE_PLAN.md section 3).
 */
import { db } from "@/lib/db";

/** The image URLs the API gives a hero. */
export type HeroArt = {
  background: string | null;
  card: string | null;
  cardCritical: string | null;
  cardGloat: string | null;
  small: string | null;
  vertical: string | null;
  nameImage: string | null;
};

export type HeroArtwork = {
  images?: HeroArt;
  folder?: string;
  artworkType?: string;
  links?: {
    lore?: string | null;
    movement?: string | null;
    voiceLines?: string | null;
  };
};

export type HeroSummary = {
  slug: string;
  name: string;
  heroType: string | null;
  complexity: number | null;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  apiAccent: string | null;
  accentSource: string;
  palette: string[];
  artwork: HeroArtwork | null;
  officialPlaystyle: string | null;
  officialLore: string | null;
  officialRole: string | null;
  tagline: string | null;
  summary: string | null;
  model: { modelUrl: string; modelKey: string; group: string; byteSize: number | null } | null;
  pois: { anchor: string; label: string; body: string; order: number }[];
};

/**
 * The one line under a hero's name.
 *
 * The API's `playstyle` is missing for 18 of the 44 released heroes, and for
 * exactly those 18 the `role` is missing too. Only `lore` is always present,
 * so the fallback is its first sentence.
 *
 * The text may contain newlines, because the ingest turns the API's `<br>`
 * into real line breaks. A card wants one line, so this takes the first
 * paragraph and then the first sentence of it.
 */
export function cardTagline(hero: {
  officialPlaystyle: string | null;
  officialLore: string | null;
}): string {
  const playstyle = hero.officialPlaystyle?.trim();
  if (playstyle) return firstSentence(firstParagraph(playstyle));

  const lore = hero.officialLore?.trim();
  if (!lore) return "";

  return firstSentence(firstParagraph(lore));
}

/** The first non-empty paragraph. */
function firstParagraph(text: string): string {
  for (const block of text.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (trimmed) return trimmed.replace(/\n/g, " ");
  }
  return text.trim().replace(/\n/g, " ");
}

/** The first sentence, never a fragment of a word. */
function firstSentence(text: string): string {
  const match = text.match(/^(.+?[.!?])(\s|$)/);
  return (match ? match[1] : text).trim();
}

const HERO_SELECT = {
  slug: true,
  name: true,
  heroType: true,
  complexity: true,
  accent: true,
  accentText: true,
  onAccent: true,
  apiAccent: true,
  accentSource: true,
  palette: true,
  artwork: true,
  tagline: true,
  summary: true,
  officialPlaystyle: true,
  officialLore: true,
  officialRole: true,
} as const;

function toSummary(row: {
  slug: string;
  name: string;
  heroType: string | null;
  complexity: number | null;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  apiAccent: string | null;
  accentSource: string;
  palette: unknown;
  artwork: unknown;
  officialPlaystyle: string | null;
  officialLore: string | null;
  officialRole: string | null;
  tagline: string | null;
  summary: string | null;
  model?: unknown;
  pois?: unknown;
}): HeroSummary {
  return {
    ...row,
    palette: Array.isArray(row.palette) ? (row.palette as string[]) : [],
    artwork: (row.artwork as HeroArtwork | null) ?? null,
    model: (row.model as HeroSummary["model"]) ?? null,
    pois: Array.isArray(row.pois) ? (row.pois as HeroSummary["pois"]) : [],
  };
}

/**
 * Every released hero, for the directory.
 *
 * Release state comes from the API's `only_active` list, never from the
 * `in_development` flag, which lags (see AGENTS.md).
 */
export async function getReleasedHeroes(): Promise<HeroSummary[]> {
  const rows = await db.hero.findMany({
    where: { isReleased: true },
    orderBy: { name: "asc" },
    select: HERO_SELECT,
  });
  return rows.map(toSummary);
}

/** All abilities, for the /abilities index. */
export async function getAllAbilities() {
  const rows = await db.ability.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      className: true,
      name: true,
      kind: true,
      image: true,
      imageWebp: true,
      description: true,
      heroes: {
        select: {
          hero: {
            select: { slug: true, name: true },
          },
        },
      },
    },
  });
  return rows;
}

/** Released heroes of a given class, for the profile switcher. */
export async function getHeroesByClass(heroType: string): Promise<HeroSummary[]> {
  const rows = await db.hero.findMany({
    where: { isReleased: true, heroType },
    orderBy: { name: "asc" },
    select: HERO_SELECT,
  });
  return rows.map(toSummary);
}

/** One hero by slug, with its abilities. */
export async function getHero(slug: string) {
  const row = await db.hero.findUnique({
    where: { slug },
    select: {
      ...HERO_SELECT,
      id: true,
      isReleased: true,
      needsReview: true,
      startingStats: true,
      itemSlots: true,
      itemSlotInfo: true,
      heroStatsUi: true,
      statsDisplay: true,
      shopStatDisplay: true,
      model: { select: { modelUrl: true, modelKey: true, group: true, byteSize: true } },
  pois: { select: { anchor: true, label: true, body: true, order: true }, orderBy: { order: "asc" } },
  abilities: {
        select: {
          id: true,
          slot: true,
          displayOrder: true,
          isInnate: true,
          ability: {
            select: {
              id: true,
              className: true,
              name: true,
              kind: true,
              image: true,
              imageWebp: true,
              description: true,
              properties: true,
              upgrades: true,
            },
          },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
  });

  if (!row) return null;
  return {
    ...toSummary(row),
    id: row.id,
    isReleased: row.isReleased,
    needsReview: row.needsReview,
    startingStats: row.startingStats,
    abilities: row.abilities,
  };
}

/*
 * Items (M5).
 *
 * The 95 items with no `slotType` are the weapon-upgrade rows the API lists
 * as separate entries (weapon_upgrade_t1 and friends). They are not shop
 * items, so the list and the pages leave them out (see the M5 plan).
 */

export type ItemSummary = {
  slug: string;
  name: string;
  nameSource: string;
  slotType: string | null;
  tier: number | null;
  cost: number | null;
  itemType: string | null;
  shopable: boolean | null;
  image: string | null;
  imageWebp: string | null;
  shopImage: string | null;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  accentSource: string;
};

export type ItemDetail = ItemSummary & {
  description: unknown;
  properties: unknown;
  tooltipSections: unknown;
  upgrades: unknown;
  activation: unknown;
  imbue: unknown;
};

const ITEM_SELECT = {
  slug: true,
  name: true,
  nameSource: true,
  slotType: true,
  tier: true,
  cost: true,
  itemType: true,
  shopable: true,
  image: true,
  imageWebp: true,
  shopImage: true,
  accent: true,
  accentText: true,
  onAccent: true,
  accentSource: true,
} as const;

/**
 * Every item in the shop, for the list page.
 *
 * Slot-less rows are excluded. Ordered by slot, then tier, then name so the
 * list reads like the in-game shop.
 */
export async function getItems(): Promise<ItemSummary[]> {
  return db.item.findMany({
    where: { slotType: { not: null } },
    orderBy: [{ slotType: "asc" }, { tier: "asc" }, { name: "asc" }],
    select: ITEM_SELECT,
  });
}

/** One item, for its page and the popover. */
export async function getItem(slug: string): Promise<ItemDetail | null> {
  const row = await db.item.findUnique({
    where: { slug },
    select: {
      ...ITEM_SELECT,
      description: true,
      properties: true,
      tooltipSections: true,
      upgrades: true,
      activation: true,
      imbue: true,
    },
  });
  return row;
}

/** How many items each slot has, for the filter chips. */
export async function getItemSlotCounts(): Promise<Record<string, number>> {
  const rows = await db.item.groupBy({
    by: ["slotType"],
    where: { slotType: { not: null } },
    _count: true,
  });
  const counts: Record<string, number> = {};
  for (const row of rows) {
    if (row.slotType) counts[row.slotType] = row._count;
  }
  return counts;
}
