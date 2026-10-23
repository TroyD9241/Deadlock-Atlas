/**
 * Normalise cached API responses into the shapes the loader writes.
 *
 * Pure functions only: cache in, our shape out. No database, no network.
 */
import {
  type ApiHero,
  type ApiItem,
  isSelectable,
} from "@/lib/schemas";
import { DEFAULT_ACCENT, normalizeHex, readableTextOn } from "@/lib/theme";

/** Below this Lab chroma an accent reads as grey, so we refuse it. */
export const MIN_CHROMA = 12;

// ── colour ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lab lightness and chroma, used to reject grey accents. */
export function labChroma(hex: string): { L: number; chroma: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);
  return { L: 116 * fy - 16, chroma: Math.hypot(500 * (fx - fy), 200 * (fy - fz)) };
}

export function panelContrast(hex: string, panel = "#141824"): number {
  const lum = (h: string) => {
    const [r, g, b] = hexToRgb(h).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const la = lum(hex);
  const lb = lum(panel);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * accentText: lighten until 4.5:1 on the panel (design.md 3.4 step 7).
 *
 * Implemented as a blend toward white rather than a pure Lab lightness ramp,
 * because a Lab ramp clips: Mina's accent #A9171E lightens to #ff0029, which
 * already has red at 255, so raising L further cannot change the colour and the
 * ratio stays stuck at 4.46:1. Blending is monotonic in contrast and cannot
 * clip, so the binary search always terminates on a passing value.
 */
export function accentTextFor(accent: string, panel = "#141824"): string {
  if (panelContrast(accent, panel) >= 4.5) return accent;

  const from = hexToRgb(accent);
  const to: [number, number, number] = [255, 255, 255];
  const mix = (t: number): string => {
    const c = from.map((v, i) =>
      Math.round(v + (to[i] - v) * t),
    ) as [number, number, number];
    return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };

  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (panelContrast(mix(mid), panel) >= 4.5) hi = mid;
    else lo = mid;
  }

  // hi passed inside the loop, but rounding to 8 bits can drop it just under.
  let candidate = mix(hi);
  for (let i = 0; i < 20 && panelContrast(candidate, panel) < 4.5; i += 1) {
    const t = Math.min(1, hi + (i + 1) * 0.01);
    const next = mix(t);
    if (next === candidate) break;
    candidate = next;
  }
  return candidate;
}

// ── slugs ───────────────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Mo & Krill" -> "mo-and-krill"; "The Doorman" -> "the-doorman". */
export function heroSlug(name: string): string {
  return slugify(name);
}

// ── heroes ──────────────────────────────────────────────────────────────────

export type NormalisedHero = {
  slug: string;
  apiId: number;
  name: string;
  complexity: number | null;
  officialRole: string | null;
  officialPlaystyle: string | null;
  officialLore: string | null;
  accent: string | null;
  accentText: string | null;
  onAccent: string | null;
  apiAccent: string | null;
  accentSource: "override" | "api" | "extracted" | "default";
  palette: string[] | null;
  needsReview: boolean;
  artwork: Record<string, unknown> | null;
  startingStats: unknown;
  itemSlots: unknown;
  itemSlotInfo: unknown;
  heroStatsUi: unknown;
  statsDisplay: unknown;
  shopStatDisplay: unknown;
  physics: unknown;
  tags: unknown;
  selectable: boolean;
  inDevelopment: boolean;
  isDisabled: boolean;
  isInDevelopment: boolean;
};

/**
 * Release state.
 *
 * `isReleased` comes from the API's `only_active=true` list, never from the
 * `in_development` flag. That flag lags: at build 6819 it still marks Baba
 * and Violet as in development when both are live and playable, and it lists a
 * literal `hero_testhero`. The only_active list returns exactly the 44 heroes
 * we hold artwork for, no extras and none missing.
 *
 * `isDisabled` and `isInDevelopment` are kept as recorded truth so the
 * discrepancy stays visible instead of being hidden behind the derived column.
 */
export function normaliseHero(
  h: ApiHero,
  opts: {
    extracted?: { accent: string; palette: string[] } | null;
    isReleased?: boolean;
  } = {},
): NormalisedHero {
  const apiAccent = normalizeHex(h.colors?.style_hex ?? null);
  const extracted = opts.extracted?.accent
    ? normalizeHex(opts.extracted.accent)
    : null;

  // Precedence: override (applied later in the DB) > api > extracted > default.
  let accent: string | null = apiAccent;
  let accentSource: NormalisedHero["accentSource"] = "api";
  let needsReview = false;

  if (!apiAccent && extracted) {
    accent = extracted;
    accentSource = "extracted";
  }

  if (accent) {
    const { chroma } = labChroma(accent);
    if (chroma < MIN_CHROMA) {
      // A grey accent produces a grey page. design.md 3.4 says fall back and
      // flag it for review.
      accent = DEFAULT_ACCENT;
      accentSource = "default";
      needsReview = true;
    }
  } else {
    accent = DEFAULT_ACCENT;
    accentSource = "default";
  }

  const palette = opts.extracted?.palette?.map(normalizeHex).filter(Boolean) as
    | string[]
    | undefined;

  return {
    slug: heroSlug(h.name),
    apiId: h.id,
    name: h.name,
    complexity: h.complexity ?? null,
    officialRole: h.description?.role ?? null,
    officialPlaystyle: h.description?.playstyle ?? null,
    officialLore: h.description?.lore ?? null,
    accent,
    accentText: accent ? accentTextFor(accent) : null,
    onAccent: accent ? readableTextOn(accent) : null,
    apiAccent,
    accentSource,
    palette: palette?.length ? palette : null,
    needsReview,
    artwork: h.images ? (h.images as Record<string, unknown>) : null,
    startingStats: h.starting_stats ?? null,
    itemSlots: h.items ?? null,
    itemSlotInfo: h.item_slot_info ?? null,
    heroStatsUi: h.hero_stats_ui ?? null,
    statsDisplay: h.stats_display ?? null,
    shopStatDisplay: h.shop_stat_display ?? null,
    physics: h.physics ?? null,
    tags: h.tags ?? null,
    selectable: opts.isReleased ?? isSelectable(h),
    inDevelopment: h.in_development,
    isDisabled: h.disabled,
    isInDevelopment: h.in_development,
  };
}

// ── items and abilities ─────────────────────────────────────────────────────

export type NormalisedItem = {
  slug: string;
  className: string;
  apiId: string;
  name: string;
  nameSource: "api" | "class";
  itemType: string;
  slotType: string | null;
  tier: number | null;
  cost: number | null;
  shopable: boolean | null;
  startTrained: boolean | null;
  image: string | null;
  imageWebp: string | null;
  shopImage: string | null;
  description: unknown;
  properties: unknown;
  upgrades: unknown;
  tooltipSections: unknown;
};

/**
 * 220 of 781 items have name === class_name, so the fallback is tracked rather
 * than silent (see DATA_INVENTORY.md).
 */
export function normaliseItem(i: ApiItem): NormalisedItem {
  const hasName = typeof i.name === "string" && i.name.length > 0;
  const nameIsClass = hasName && i.name === i.class_name;

  return {
    slug: slugify(i.class_name),
    className: i.class_name,
    apiId: String(i.id),
    name: hasName ? (i.name as string) : humanize(i.class_name),
    nameSource: !hasName || nameIsClass ? "class" : "api",
    itemType: i.type,
    slotType: i.item_slot_type ?? null,
    tier: i.item_tier ?? null,
    cost: i.cost ?? null,
    shopable: i.shopable ?? null,
    startTrained: i.start_trained ?? null,
    image: i.image ?? null,
    imageWebp: i.image_webp ?? null,
    shopImage: i.shop_image ?? null,
    description: i.description ?? null,
    properties: i.properties ?? null,
    upgrades: i.upgrades ?? null,
    tooltipSections: i.tooltip_sections ?? null,
  };
}

export type NormalisedAbility = {
  className: string;
  apiId: string;
  name: string;
  kind: string | null;
  image: string | null;
  imageWebp: string | null;
  description: unknown;
  properties: unknown;
  upgrades: unknown;
  videos: unknown;
  behaviours: unknown;
  dependantAbilities: unknown;
};

/** `citadel_ability_fire_bomb` -> "Citadel Ability Fire Bomb". */
export function humanize(className: string): string {
  return className
    .replace(/^(citadel|hero|ability|upgrade)_/, "")
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const KIND_PREFIXES: Array<[RegExp, string]> = [
  [/^signature[1-4]$/, "signature"],
  [/^ability_innate[1-3]$/, "innate"],
  [/^weapon_primary$/, "weapon"],
  [/^weapon_melee$/, "melee"],
  [/^ability_(mantle|jump|slide|zip_line|zip_line_boost|climb_rope)$/, "universal"],
];

export function slotKind(slot: string): string | null {
  for (const [re, kind] of KIND_PREFIXES) if (re.test(slot)) return kind;
  return null;
}

export function normaliseAbility(i: ApiItem): NormalisedAbility {
  const hasName = typeof i.name === "string" && i.name.length > 0 && i.name !== i.class_name;
  return {
    className: i.class_name,
    apiId: String(i.id),
    name: hasName ? (i.name as string) : humanize(i.class_name),
    kind: i.hero === null || i.hero === undefined ? "universal" : null,
    image: i.image ?? null,
    imageWebp: i.image_webp ?? null,
    description: i.description ?? null,
    properties: i.properties ?? null,
    upgrades: i.upgrades ?? null,
    videos: i.videos ?? null,
    behaviours: i.behaviours ?? null,
    dependantAbilities: i.dependant_abilities ?? null,
  };
}

export type HeroAbilityRef = {
  heroSlug: string;
  className: string;
  slot: string;
  displayOrder: number;
  isInnate: boolean;
};

const SLOT_ORDER = [
  "weapon_primary",
  "signature1",
  "signature2",
  "signature3",
  "signature4",
  "ability_innate1",
  "ability_innate2",
  "ability_innate3",
  "weapon_melee",
  "ability_mantle",
  "ability_jump",
  "ability_slide",
  "ability_zip_line",
  "ability_zip_line_boost",
  "ability_climb_rope",
];

export function slotOrder(slot: string): number {
  const i = SLOT_ORDER.indexOf(slot);
  return i === -1 ? SLOT_ORDER.length : i;
}

/**
 * Build the hero -> ability join rows from Hero.items.
 *
 * 979 references over 400 distinct classes, of which 114 abilities are
 * universal. This is why Ability is never owned by a hero.
 */
export function heroAbilityRefs(hero: NormalisedHero, raw: ApiHero): HeroAbilityRef[] {
  const items = raw.items ?? {};
  return Object.entries(items).map(([slot, className]) => ({
    heroSlug: hero.slug,
    className,
    slot,
    displayOrder: slotOrder(slot),
    isInnate: slot.startsWith("ability_innate"),
  }));
}
