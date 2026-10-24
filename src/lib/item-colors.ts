/*
 * Item colours — Valve's own category colours.
 *
 * The Deadlock API ships a `colors.json` document with the game's colour
 * constants (the ingest already caches it at data/raw/<version>/colors.json).
 * Items have no colour of their own — `colors.style_hex` is a hero field — so
 * an item's theme comes from the colour the game uses for its slot:
 *
 *   weapon   -> weapon_color     #E58A00  orange
 *   vitality -> fortitude_color  #649717  olive green
 *   spirit   -> spirit_color     #8A55B3  purple
 *
 * These are Valve's values, so they are as authoritative as a hero's
 * `style_hex`. `accentSource` is recorded as "api" for exactly that reason
 * (see AGENTS.md: the accent precedence is manual override, then the API,
 * then extraction, then the site default).
 *
 * The alternates below are the brighter variants the game uses for text
 * highlights on those colours, not for the category accent.
 */
import { readableAccentText, readableTextOn } from "@/lib/theme";

export type ItemSlot = "weapon" | "vitality" | "spirit";

/** The slot type stored on an item row. */
export const ITEM_SLOTS: readonly ItemSlot[] = ["weapon", "vitality", "spirit"];

type Rgb = { red: number; green: number; blue: number; alpha: number };

/** The colour constants this site uses, straight from the API's colors.json. */
const SLOT_COLOR_CONSTANTS: Record<ItemSlot, string> = {
  weapon: "weapon_color",
  vitality: "fortitude_color",
  spirit: "spirit_color",
};

/** The API's colours.json, as of build 6819. */
const SLOT_COLORS: Record<ItemSlot, string> = {
  weapon: "#e58a00",
  vitality: "#649717",
  spirit: "#8a55b3",
};

/** The brighter variants, kept for the occasional highlight. */
export const SLOT_COLOR_BRIGHT: Record<ItemSlot, string> = {
  weapon: "#ffa826",
  vitality: "#d3fc96",
  spirit: "#e7c8ff",
};

export function isItemSlot(value: string | null | undefined): value is ItemSlot {
  return value === "weapon" || value === "vitality" || value === "spirit";
}

/** The official colour for a slot, or null when the slot is not one we theme. */
export function slotColor(slot: string | null | undefined): string | null {
  if (!isItemSlot(slot)) return null;
  return SLOT_COLORS[slot];
}

/** The name of the API constant a slot's colour comes from. */
export function slotColorConstant(slot: string | null | undefined): string | null {
  if (!isItemSlot(slot)) return null;
  return SLOT_COLOR_CONSTANTS[slot];
}

export type ItemAccent = {
  accent: string;
  accentText: string;
  onAccent: string;
  accentSource: "api";
};

/**
 * The accent triple for an item, from its slot.
 *
 * `accentText` is the readable variant for accent-coloured text on a panel and
 * `onAccent` is the text colour for accent fills — both computed the same way
 * as for heroes, so the contrast rules hold (design.md 3.4).
 */
export function itemAccent(slot: string | null | undefined): ItemAccent | null {
  const accent = slotColor(slot);
  if (!accent) return null;
  return {
    accent,
    accentText: readableAccentText(accent),
    onAccent: readableTextOn(accent),
    accentSource: "api",
  };
}

/** The slot label shown on cards and pages. */
export function slotLabel(slot: string | null | undefined): string {
  if (!isItemSlot(slot)) return "Item";
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

/** The raw colour constant map, for scripts that read the API's colors.json. */
export const API_COLOR_CONSTANTS = SLOT_COLOR_CONSTANTS;

/** Type guard for the API's colour records ({ red, green, blue, alpha }). */
export function isRgbRecord(value: unknown): value is Rgb {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.red === "number" &&
    typeof v.green === "number" &&
    typeof v.blue === "number"
  );
}

/** `{ red, green, blue }` from the API's colours.json -> `#rrggbb`. */
export function rgbToHex(rgb: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(rgb.red)}${part(rgb.green)}${part(rgb.blue)}`;
}
