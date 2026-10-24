/*
 * Valve's item text, made safe for the page.
 *
 * The API stores item descriptions as HTML: inline `<svg>` stat icons, and
 * `<span>`s with the game's own classes (`highlight`, `diminish`,
 * `inline-attribute-label`). The hero pages strip tags because the API's
 * hero text is plain; items are different — the stat icons are the point of
 * the text, so they are kept.
 *
 * This is Valve's game content. It is rendered with the site's own styling
 * and clearly labelled as official in-game text on the page.
 */

/** Tags that survive. Everything else is unwrapped (text kept). */
const ALLOWED_TAGS = new Set(["span", "svg", "path", "g", "br", "b", "i", "sub", "sup"]);

/** Attributes allowed on the surviving tags. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  span: new Set(["class"]),
  svg: new Set(["width", "height", "viewBox", "fill", "xmlns"]),
  path: new Set(["d", "fill", "fill-rule", "clip-rule", "opacity", "transform"]),
  g: new Set(["fill", "opacity", "transform"]),
};

/** The game's span classes, mapped onto ours. */
const CLASS_MAP: Record<string, string> = {
  highlight: "item-highlight",
  diminish: "item-diminish",
  "inline-attribute-label": "item-attribute-label",
};

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/'/g, "&#39;");
}

/**
 * Sanitise Valve's item HTML down to the tags and attributes we allow.
 *
 * Text content is always kept, so an unknown tag loses its wrapper but not
 * its words. `<script>` and `<style>` contents are dropped entirely.
 */
export function sanitizeItemHtml(html: string | null | undefined): string {
  if (!html) return "";

  // Drop dangerous elements with their contents.
  let out = html.replace(
    /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  out = out.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\/?>/g,
    (match, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();

      // Comments and processing instructions.
      if (tag.startsWith("!")) return "";

      if (!ALLOWED_TAGS.has(tag)) {
        // Unknown tag: keep the text, drop the wrapper.
        return "";
      }

      if (match.startsWith("</")) return `</${tag}>`;

      const allowed = ALLOWED_ATTRS[tag];
      const attrs: string[] = [];

      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(rawAttrs)) !== null) {
        const name = m[1].toLowerCase();
        const value = m[3] ?? m[4] ?? m[5] ?? "";
        if (!allowed.has(name)) continue;
        if (name === "class") {
          const mapped = value
            .split(/\s+/)
            .map((cls) => CLASS_MAP[cls])
            .filter(Boolean)
            .join(" ");
          if (mapped) attrs.push(`class="${escapeAttr(mapped)}"`);
          continue;
        }
        attrs.push(`${name}="${escapeAttr(value)}"`);
      }

      const selfClosing = tag === "br" || tag === "path" ? " /" : "";
      return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}${selfClosing}>`;
    },
  );

  return out.trim();
}

/** Plain text from Valve's item HTML, for meta descriptions and popovers. */
export function itemText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The effect text for an item.
 *
 * `description.desc` is the API's short form. Some items only carry the
 * richer `tooltipSections`, so that is the fallback.
 */
export function itemEffectText(
  description: unknown,
  tooltipSections: unknown,
): string | null {
  const desc = (description as { desc?: unknown } | null)?.desc;
  if (typeof desc === "string" && desc.trim()) return desc;

  if (Array.isArray(tooltipSections)) {
    for (const section of tooltipSections) {
      const attributes = (section as { section_attributes?: unknown })
        ?.section_attributes;
      if (!Array.isArray(attributes)) continue;
      for (const attr of attributes) {
        const loc = (attr as { loc_string?: unknown })?.loc_string;
        if (typeof loc === "string" && loc.trim()) return loc;
      }
    }
  }

  return null;
}

/**
 * The item's stats, from the API's `properties`.
 *
 * Each property is `{ label, value, postfix, icon, ... }`. Two filters:
 * properties with a zero value are dropped, and so are the ones with no
 * label — those are engine-level modifiers (`ChannelMoveSpeed`,
 * `AbilityUnitTargetLimit`) that mean nothing to a player.
 */
export type ItemStat = {
  key: string;
  label: string;
  value: string;
  postfix: string;
  icon: string | null;
};

export function itemStats(properties: unknown): ItemStat[] {
  if (!properties || typeof properties !== "object") return [];

  const stats: ItemStat[] = [];
  for (const [key, raw] of Object.entries(
    properties as Record<string, unknown>,
  )) {
    if (!raw || typeof raw !== "object") continue;
    const prop = raw as {
      label?: unknown;
      value?: unknown;
      postfix?: unknown;
      icon?: unknown;
    };
    const value = typeof prop.value === "number" ? prop.value : Number(prop.value);
    if (!Number.isFinite(value) || value === 0) continue;

    const label = typeof prop.label === "string" ? prop.label.trim() : "";
    if (!label) continue;

    const postfix = typeof prop.postfix === "string" ? prop.postfix : "";
    const icon = typeof prop.icon === "string" ? prop.icon : null;

    stats.push({ key, label, value: String(value), postfix, icon });
  }

  return stats;
}

/**
 * Split an item's effect text into paragraphs.
 *
 * The API writes the text as one run with `<br><br>` between the parts, so
 * the breaks are where the paragraphs are (the prose rule, design.md 2.2).
 */
export function splitItemParagraphs(html: string): string[] {
  return html
    .split(/<br\s*\/?>\s*<br\s*\/?>/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

/** `BonusAbilityCharges` -> `Bonus Ability Charges`. */
export function humanizePropertyName(name: string): string {
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export type ItemUpgrade = {
  name: string;
  label: string;
  value: string;
};

/**
 * The item's property upgrades.
 *
 * Some items carry no prose at all: the API expresses their effect as
 * property upgrades (`BonusAbilityCharges: 1`). Those are the effect, so
 * they are shown instead of "[no description]".
 */
export function itemUpgrades(upgrades: unknown): ItemUpgrade[] {
  if (!Array.isArray(upgrades)) return [];

  const result: ItemUpgrade[] = [];
  for (const entry of upgrades) {
    const list = (entry as { property_upgrades?: unknown })?.property_upgrades;
    if (!Array.isArray(list)) continue;
    for (const upgrade of list) {
      const name = (upgrade as { name?: unknown })?.name;
      const bonus = (upgrade as { bonus?: unknown })?.bonus;
      if (typeof name !== "string" || !name) continue;
      const value = typeof bonus === "number" ? String(bonus) : String(bonus ?? "");
      result.push({
        name,
        label: humanizePropertyName(name),
        value,
      });
    }
  }

  return result;
}
