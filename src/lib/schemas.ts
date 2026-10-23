/**
 * Zod schemas for the Deadlock assets API.
 *
 * These validate at the ingest boundary only (Plan section 2). The site never
 * reads live API shapes, so everything downstream can rely on our own shape.
 *
 * Everything the API sends is treated as unknown and narrowed here, because a
 * community API can change shape without warning. Fields we do not model are
 * still carried through in the Json columns.
 */
import { z } from "zod";

// ── helpers ─────────────────────────────────────────────────────────────────

/** The API returns null almost as often as a value. */
const nullableish = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullish().transform((v) => v ?? null);

/** `{ value, display_stat_name }` — how the API wraps every hero stat. */
export const StartingStatSchema = z.object({
  value: z.number(),
  display_stat_name: z.string().nullish(),
});

export const HeroImagesSchema = z
  .object({
    icon_hero_card: nullableish(z.string()),
    icon_hero_card_webp: nullableish(z.string()),
    icon_image_small: nullableish(z.string()),
    minimap_image: nullableish(z.string()),
    minimap_image_webp: nullableish(z.string()),
    top_bar_vertical_image: nullableish(z.string()),
    background_image: nullableish(z.string()),
  })
  .loose();

// ── hero ────────────────────────────────────────────────────────────────────

export const ApiHeroSchema = z
  .object({
    id: z.number(),
    class_name: z.string(),
    name: z.string(),
    player_selectable: z.boolean().default(false),
    disabled: z.boolean().default(false),
    in_development: z.boolean().default(false),
    complexity: nullableish(z.number()),
    description: z
      .object({
        lore: nullableish(z.string()),
        playstyle: nullableish(z.string()),
        role: nullableish(z.string()),
      })
      .loose()
      .nullish(),
    colors: z
      .object({
        ui: z.array(z.number()).nullish(),
        style: z.array(z.number()).nullish(),
        style_hex: nullableish(z.string()),
      })
      .loose()
      .nullish(),
    starting_stats: z.record(z.string(), StartingStatSchema).nullish(),
    // Slot key -> ability class name, e.g. signature1 -> ability_fire_bomb.
    items: z.record(z.string(), z.string()).nullish(),
    item_slot_info: z.record(z.string(), z.unknown()).nullish(),
    images: HeroImagesSchema.nullish(),
    hero_stats_ui: z.unknown().nullish(),
    stats_display: z.unknown().nullish(),
    shop_stat_display: z.unknown().nullish(),
    physics: z.unknown().nullish(),
    tags: z.array(z.string()).nullish(),
    hero_type: nullableish(z.string()),
  })
  .loose();

export type ApiHero = z.infer<typeof ApiHeroSchema>;

// ── items, abilities, weapons ───────────────────────────────────────────────

/** `ability` | `weapon` | `upgrade` — a different axis from item_slot_type. */
export const ITEM_TYPES = ["ability", "weapon", "upgrade"] as const;

/** `weapon` | `vitality` | `spirit` — this is design.md's "category" label. */
export const SLOT_TYPES = ["weapon", "vitality", "spirit"] as const;

export const ApiItemSchema = z
  .object({
    // Ids run past 2^31, so they are stored as strings.
    id: z.number(),
    class_name: z.string(),
    name: nullableish(z.string()),
    type: z.enum(ITEM_TYPES),
    item_slot_type: z.enum(SLOT_TYPES).nullish(),
    item_tier: nullableish(z.number()),
    cost: nullableish(z.number()),
    shopable: z.boolean().nullish(),
    shop_version: nullableish(z.number()),
    start_trained: z.boolean().nullish(),
    // Universal abilities have hero: null and are shared across heroes.
    hero: nullableish(z.number()),
    heroes: z.array(z.number()).nullish(),
    image: nullableish(z.string()),
    image_webp: nullableish(z.string()),
    shop_image: nullableish(z.string()),
    description: z.unknown().nullish(),
    properties: z.record(z.string(), z.unknown()).nullish(),
    upgrades: z.array(z.unknown()).nullish(),
    tooltip_sections: z.array(z.unknown()).nullish(),
    videos: z.unknown().nullish(),
    behaviours: z.array(z.unknown()).nullish(),
    dependant_abilities: z.array(z.string()).nullish(),
    ability_type: nullableish(z.string()),
    disabled: z.boolean().nullish(),
  })
  .loose();

export type ApiItem = z.infer<typeof ApiItemSchema>;

// ── normalised shapes the loader consumes ───────────────────────────────────

export const HERO_SELECTABLE = {
  player_selectable: true,
  disabled: false,
  in_development: false,
} as const;

export function isSelectable(h: Pick<ApiHero, "player_selectable" | "disabled" | "in_development">) {
  return h.player_selectable && !h.disabled && !h.in_development;
}