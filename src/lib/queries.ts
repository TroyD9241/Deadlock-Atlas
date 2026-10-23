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
};

/**
 * The one line under a hero's name.
 *
 * The API's `playstyle` is missing for 18 of the 44 released heroes, and for
 * exactly those 18 the `role` is missing too. Only `lore` is always present,
 * so the fallback is its first sentence. Everything here is Valve's own text
 * from the assets API, not wiki prose.
 */
export function cardTagline(hero: {
  officialPlaystyle: string | null;
  officialLore: string | null;
}): string {
  const playstyle = hero.officialPlaystyle?.trim();
  if (playstyle) return playstyle;

  const lore = hero.officialLore?.trim();
  if (!lore) return "";

  // First sentence, but never a fragment of a word.
  const match = lore.match(/^(.+?[.!?])(\s|$)/);
  return (match ? match[1] : lore).trim();
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
}): HeroSummary {
  return {
    ...row,
    palette: Array.isArray(row.palette) ? (row.palette as string[]) : [],
    artwork: (row.artwork as HeroArtwork | null) ?? null,
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
  return { ...toSummary(row), id: row.id, abilities: row.abilities };
}
