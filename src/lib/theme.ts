/*
 * Theming — design.md section 3.
 *
 * One function sets every themed variable on a scope element. Switching hero
 * changes the variables only; no component swaps classes per hero.
 *
 * This file is safe to import from both server and client code: it touches no
 * database and no Node APIs at module scope.
 */

/** The minimum shape `applyTheme` needs. Matches the palette fields on Hero and Item. */
export type Theme = {
  /** The hero or item's main accent, e.g. "#c09fc8". */
  accent?: string | null;
  /** Five colours, darkest to lightest, as `--p1`..`--p5`. */
  palette?: string[] | null;
  /**
   * Text colour for accent fills, already validated at ingest to reach 4.5:1
   * against `--panel`. Falls back to a contrast computation if absent.
   */
  onAccent?: string | null;
  /** The API's `colors.style_hex`, used only as a fallback. */
  apiAccent?: string | null;
};

/** Site default from design.md 2.1, used when a record has no usable accent. */
export const DEFAULT_ACCENT = "#c09fc8";
export const DEFAULT_ACCENT_RGB = "192, 159, 200";

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Normalise `#abc` / `AABBCC` / `#aabbcc` to `#aabbcc`, or null if not a hex colour. */
export function normalizeHex(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = HEX.exec(trimmed);
  if (!match) return null;

  const digits = match[1];
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;

  return `#${full.toLowerCase()}`;
}

/** `"#c09fc8"` -> `"192, 159, 200"`, for use inside `rgba(var(--accent-rgb), a)`. */
export function hexToRgb(hex: string): string {
  const normalized = normalizeHex(hex) ?? DEFAULT_ACCENT;
  const int = Number.parseInt(normalized.slice(1), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `${r}, ${g}, ${b}`;
}

/** `#c09fc8` -> `{ r: 192, g: 159, b: 200 }` */
export function hexToRgbObject(hex: string): { r: number; g: number; b: number } {
  const [r, g, b] = hexToRgb(hex).split(",").map((part) => Number(part.trim()));
  return { r, g, b };
}

type Rgb = { r: number; g: number; b: number };

function toRgb(hex: string): Rgb {
  return hexToRgbObject(hex);
}

/** WCAG relative luminance. */
export function relativeLuminance(color: string): number {
  const { r, g, b } = toRgb(color);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pick the text colour for an accent fill: whichever of the design system's
 * two extremes contrasts better. design.md 3.4 calls for "dark or white,
 * whichever contrasts better with the accent".
 */
export function readableTextOn(accent: string): string {
  const dark = contrastRatio(accent, "#17131b"); // --on-accent from design.md 2.1
  const light = contrastRatio(accent, "#ffffff");
  return dark >= light ? "#17131b" : "#ffffff";
}

/** `color-mix(in srgb, <accent> 34%, transparent)` as a hex with alpha. */
export function glowFrom(accent: string, alpha = 0x55): string {
  const { r, g, b } = toRgb(accent);
  return `#${[r, g, b]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}${alpha.toString(16).padStart(2, "0")}`;
}

/**
 * Apply a hero or item palette to a scope element.
 *
 * Scope matters (design.md 3.3): pass the page root for a whole themed page,
 * or a single card when a grid shows many heroes at once. A card that sets its
 * own variables does not disturb its siblings.
 */
export function applyTheme(el: HTMLElement, theme: Theme): void {
  // Fall back: manual override, then extraction, then the API's style_hex,
  // then the site default (design.md 3.4).
  const accent =
    normalizeHex(theme.accent) ??
    normalizeHex(theme.apiAccent) ??
    DEFAULT_ACCENT;

  el.style.setProperty("--accent", accent);
  el.style.setProperty("--accent-rgb", hexToRgb(accent));
  el.style.setProperty(
    "--on-accent",
    normalizeHex(theme.onAccent) ?? readableTextOn(accent),
  );
  el.style.setProperty("--glow", glowFrom(accent));

  const palette = (theme.palette ?? [])
    .map(normalizeHex)
    .filter((c): c is string => c !== null);

  // Always define all five slots so a partial palette degrades to the
  // defaults rather than leaving a stale colour behind.
  for (let i = 0; i < 5; i += 1) {
    el.style.setProperty(`--p${i + 1}`, palette[i] ?? "");
    if (!palette[i]) el.style.removeProperty(`--p${i + 1}`);
  }
}

/**
 * Server-friendly form of `applyTheme`: the same variables as a plain object,
 * to be spread onto a `style` prop. Used by server components, which have no
 * DOM to mutate.
 */
export function themeStyle(theme: Theme): Record<string, string> {
  const accent =
    normalizeHex(theme.accent) ??
    normalizeHex(theme.apiAccent) ??
    DEFAULT_ACCENT;

  const palette = (theme.palette ?? [])
    .map(normalizeHex)
    .filter((c): c is string => c !== null);

  const style: Record<string, string> = {
    "--accent": accent,
    "--accent-rgb": hexToRgb(accent),
    "--on-accent": normalizeHex(theme.onAccent) ?? readableTextOn(accent),
    "--glow": glowFrom(accent),
  };

  for (let i = 0; i < 5; i += 1) {
    if (palette[i]) style[`--p${i + 1}`] = palette[i];
  }

  return style;
}