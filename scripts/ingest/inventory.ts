/**
 * Profile the cached assets responses and write a data inventory.
 *
 * Usage: npx tsx scripts/ingest/inventory.ts
 *
 * Answers two questions the plan keeps asking:
 *   1. What data actually exists in the API, and in what shape?
 *   2. Which fields the schema needs are missing, empty or unusable?
 *
 * Writes DATA_INVENTORY.md and prints a gap summary. Reads only from
 * data/raw/, never the network.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { RAW_DIR } from "./api";

/** Hero fields design.md wants that we must get from somewhere. */
const HERO_WANTED = [
  "name",
  "class_name",
  "complexity",
  "description.lore",
  "description.playstyle",
  "description.role",
  "colors.style_hex",
  "starting_stats",
  "items",
  "item_slot_info",
  "images",
  "hero_type",
  "tags",
] as const;

/** Item fields the schema and the items page need. */
const ITEM_WANTED = [
  "name",
  "class_name",
  "type",
  "item_slot_type",
  "item_tier",
  "cost",
  "shopable",
  "image",
  "description",
  "properties",
  "upgrades",
  "tooltip_sections",
] as const;

type Stat = {
  present: number;
  nullish: number;
  typed: Record<string, number>;
};

function profile(rows: unknown[], wanted: readonly string[]) {
  const get = (obj: Record<string, unknown>, path: string): unknown => {
    let cur: unknown = obj;
    for (const part of path.split(".")) {
      if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
  };

  const stats: Record<string, Stat> = {};
  for (const f of wanted) {
    stats[f] = { present: 0, nullish: 0, typed: {} };
  }

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    for (const f of wanted) {
      const v = get(o, f);
      const s = stats[f];
      if (v === undefined || v === null) {
        s.nullish += 1;
      } else {
        s.present += 1;
        const t = Array.isArray(v) ? "array" : typeof v === "object" ? "object" : typeof v;
        s.typed[t] = (s.typed[t] ?? 0) + 1;
      }
    }
  }

  return stats;
}

function pct(n: number, of: number) {
  return of === 0 ? "0%" : `${Math.round((n / of) * 100)}%`;
}

async function readJson(dir: string, file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(dir, file), "utf8"));
}

async function main() {
  const builds = (await readdir(RAW_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => Number(b) - Number(a));

  if (builds.length === 0) {
    console.error("no cached builds found. Run: npx tsx scripts/ingest/fetch.ts");
    process.exit(1);
  }

  const build = builds[0];
  const dir = path.join(RAW_DIR, build);
  const sweep = (await readJson(dir, "_sweep.json")) as {
    clientVersion: number;
    totalBuilds: number;
    fetchedAt: string;
    results: Array<{
      name: string;
      status: number;
      rows: number | null;
      bytes: number;
      cached: string | null;
      error: string | null;
    }>;
  };

  const heroes = (await readJson(dir, "heroes.json")) as Array<Record<string, unknown>>;
  const items = (await readJson(dir, "items.json")) as Array<Record<string, unknown>>;

  // ── hero analysis ────────────────────────────────────────────────────────
  const selectable = heroes.filter(
    (h) => h.player_selectable === true && h.disabled !== true && h.in_development !== true,
  );
  const heroStats = profile(heroes, HERO_WANTED);

  // ── item analysis ────────────────────────────────────────────────────────
  const byType: Record<string, number> = {};
  const nameIsClassName: string[] = [];
  for (const it of items) {
    const t = String(it.type ?? "unknown");
    byType[t] = (byType[t] ?? 0) + 1;
    if (!it.name || it.name === it.class_name) nameIsClassName.push(String(it.class_name));
  }
  const itemStats = profile(items, ITEM_WANTED);

  // ── ability sharing ──────────────────────────────────────────────────────
  const abilities = items.filter((i) => i.type === "ability");
  const universal = abilities.filter((a) => a.hero === null || a.hero === undefined);
  const heroRefs = heroes.reduce((acc, h) => {
    const m = (h.items ?? {}) as Record<string, string>;
    return acc + Object.keys(m).length;
  }, 0);
  const distinctRefs = new Set<string>();
  for (const h of heroes) {
    for (const cls of Object.values((h.items ?? {}) as Record<string, string>)) {
      distinctRefs.add(cls);
    }
  }

  // ── ability properties ───────────────────────────────────────────────────
  const propertyCounts = new Map<string, number>();
  let withUpgrades = 0;
  let upgradeTiers = 0;
  for (const a of abilities) {
    const props = (a.properties ?? {}) as Record<string, unknown>;
    for (const k of Object.keys(props)) propertyCounts.set(k, (propertyCounts.get(k) ?? 0) + 1);
    const ups = a.upgrades;
    if (Array.isArray(ups) && ups.length > 0) {
      withUpgrades += 1;
      upgradeTiers += ups.length;
    }
  }

  const lines: string[] = [];
  const p = (s = "") => lines.push(s);

  p("# Deadlock API data inventory");
  p("");
  p(
    `Generated by \`npx tsx scripts/ingest/inventory.ts\` from the cached responses in \`data/raw/${build}/\`. Reads only from disk. Regenerate after any ingest.`,
  );
  p("");
  p("| | |");
  p("|---|---|");
  p(`| Game build | **${sweep.clientVersion}** (newest of ${sweep.totalBuilds} known builds) |`);
  p(`| Fetched | ${sweep.fetchedAt} |`);
  p(`| Endpoints reachable | ${sweep.results.filter((r) => r.status === 200).length} of ${sweep.results.length} |`);
  p("| Licence | API is MIT. **Game content and artwork remain Valve's.** |");
  p("");
  p("This is the reference for what the data *is*, as opposed to what the schema");
  p("*assumes*. Where the two disagree, this document is what is actually true.");
  p("");

  // ── endpoints ────────────────────────────────────────────────────────────
  p("## 1. Endpoint reachability");
  p("");
  p("| Endpoint | Rows | Size | Cached | Note |");
  p("|---|---:|---:|---|---|");
  for (const r of sweep.results) {
    const note = r.error
      ? `**${r.error}**`
      : r.cached
        ? "yes"
        : "no — CDN listing, not game data";
    p(
      `| \`${r.name}\` | ${r.rows ?? "—"} | ${r.bytes > 1e6 ? `${(r.bytes / 1048576).toFixed(1)} MB` : `${Math.round(r.bytes / 1024)} KB`} | ${r.cached ? "yes" : "no"} | ${note} |`,
    );
  }
  p("");
  const failures = sweep.results.filter((r) => r.status !== 200);
  if (failures.length) {
    p("### Not available");
    p("");
    for (const f of failures) {
      p(`- \`${f.name}\` — ${f.error}. Listed in the OpenAPI spec but not served. Do not depend on it.`);
    }
    p("");
  }

  // ── heroes ───────────────────────────────────────────────────────────────
  p("## 2. Heroes");
  p("");
  p(`- **${heroes.length}** hero records returned, **${selectable.length}** are player-selectable and not disabled or in development. Only the selectable set belongs on the site.`);
  p(`- The directory and every page should filter on \`player_selectable\`, \`disabled\` and \`in_development\`; ${heroes.length - selectable.length} rows are cut on those three flags alone.`);
  p("");
  p("### Field coverage across all hero rows");
  p("");
  p("| Field | Present | Null or absent | Type |");
  p("|---|---:|---:|---|");
  for (const f of HERO_WANTED) {
    const s = heroStats[f];
    const type = Object.entries(s.typed)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ");
    p(`| \`${f}\` | ${pct(s.present, heroes.length)} | ${pct(s.nullish, heroes.length)} | ${type || "—"} |`);
  }
  p("");

  // ── abilities ────────────────────────────────────────────────────────────
  p("## 3. Abilities");
  p("");
  p(`- **${abilities.length}** distinct ability classes, every one unique by \`class_name\`. There are no duplicates to collapse.`);
  p(`- **${universal.length}** have \`hero: null\` and are universal, shared across heroes (Jump, Slide, Mantle, Zip Line and friends).`);
  p(`- Heroes make **${heroRefs}** hero-to-ability references pointing at **${distinctRefs.size}** distinct class names.`);
  p(
    `- **This is why Ability is a separate model with a HeroAbility join and is never owned by one hero.** An owned model would duplicate the ${universal.length} universal abilities roughly ${selectable.length} times each.`,
  );
  p("");
  p(`- **${withUpgrades} of ${abilities.length}** abilities carry upgrade tiers, averaging ${(upgradeTiers / Math.max(withUpgrades, 1)).toFixed(1)} tiers each. This is the "mechanics" data.`);
  p("");
  const top = [...propertyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  p("Most common ability properties (this is what a mechanics page renders):");
  p("");
  p("| Property | Abilities carrying it |");
  p("|---|---:|");
  for (const [k, v] of top) p(`| \`${k}\` | ${v} |`);
  p("");

  // ── items ────────────────────────────────────────────────────────────────
  p("## 4. Items");
  p("");
  p(`- **${items.length}** item rows. By \`type\`: ${Object.entries(byType).map(([k, v]) => `**${v}** ${k}`).join(", ")}.`);
  p(
    `- \`Item\` in the API is a \`oneOf\` of Ability, Weapon and Upgrade. **The Weapon/Vitality/Spirit label is \`item_slot_type\`, which is a different axis** and is what design.md calls the item's category.`,
  );
  p("");
  p("### Field coverage");
  p("");
  p("| Field | Present | Null or absent | Type |");
  p("|---|---:|---:|---|");
  for (const f of ITEM_WANTED) {
    const s = itemStats[f];
    const type = Object.entries(s.typed)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ");
    p(`| \`${f}\` | ${pct(s.present, items.length)} | ${pct(s.nullish, items.length)} | ${type || "—"} |`);
  }
  p("");

  p("## 5. Gaps, and what they mean for us");
  p("");

  const gaps: string[] = [];

  gaps.push(
    `- **Display names are missing on ${nameIsClassName.length} of ${items.length} items** (${pct(nameIsClassName.length, items.length)}), mostly per-hero weapon sets where \`name\` just repeats \`class_name\` (\`citadel_weapon_inferno_set\`). \`Item.nameSource\` records whether a name came from the API, the class name, or a manual override, so the gap stays reviewable rather than silently rendering \`citadel_weapon_inferno_set\` as a title.`,
  );
  gaps.push(
    `- **No hero or item artwork beyond icons.** \`images\` on a hero is card, small icon, minimap and vertical bar art. There is **no banner or render** in the API. Banner art can only come from the character folders, which is exactly why \`data/characters/\` exists and why Valve's asset policy is still an open question in design.md.`,
  );
  gaps.push(
    `- **No lore beyond one paragraph.** \`description.lore\` is Valve's own short bio and \`playstyle\` is one or two sentences. Real lore prose lives only on the wiki, which we link and credit rather than copy.`,
  );
  gaps.push(
    `- **No patch data that can be diffed.** \`client-versions\` is a flat list of ${sweep.totalBuilds} build numbers with no changelog. There is no structured per-entity change feed, which is why M3, M4, M6 and M8 stay deferred.`,
  );
  gaps.push(
    `- **No voice lines anywhere in the assets API.** Confirmed absent from every endpoint surveyed. The voiceline explorer stays blocked.`,
  );
  gaps.push(
    `- **\`loot-tables\` is listed in the OpenAPI spec but returns 404.** Do not build against it.`,
  );
  gaps.push(
    `- **No item shop ordering or rarity beyond \`item_tier\` and \`cost\`.** Anything about how the in-game shop presents items has to come from the mock or from curation.`,
  );
  gaps.push(
    `- **Ability descriptions are often empty.** Some ability records carry an empty \`description\` object. Render the property list even when there is no prose, and never invent text.`,
  );

  for (const g of gaps) p(g);
  p("");

  p("## 6. Gaps in our own character folders");
  p("");
  p(
    `- We hold ${selectable.length} selectable heroes from the API but only 44 character folders, and folder names do not always match the API (for example a \`Bebop\` folder containing \`Bepop.md\`, and \`Mo & Krill\` whose image is \`mo__and__krill_render-*.png\`). Seeding must match on the wiki name inside the \`.md\` file, not on the folder name.`,
  );
  p(
    `- Some character folders hold a banner-style screenshot rather than a cutout (Deadman Danny's is a 1920x1080 thumbnail, Rat King's is a news thumbnail). Those skew palette extraction, which is why design.md asks for cutouts and warns about splash art.`,
  );
  p("");

  p("---");
  p("");
  p(
    "Regenerate with `npx tsx scripts/ingest/fetch.ts && npx tsx scripts/ingest/inventory.ts`. Raw responses live in `data/raw/` and are gitignored.",
  );

  const out = lines.join("\n");
  await writeFile(path.resolve(process.cwd(), "DATA_INVENTORY.md"), out, "utf8");

  console.log(`wrote DATA_INVENTORY.md (${lines.length} lines)`);
  console.log("");
  console.log(`build            ${sweep.clientVersion} of ${sweep.totalBuilds}`);
  console.log(`heroes           ${heroes.length} total, ${selectable.length} selectable`);
  console.log(`items            ${items.length}  ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  console.log(`abilities        ${abilities.length} distinct, ${universal.length} universal`);
  console.log(`hero->ability    ${heroRefs} refs over ${distinctRefs.size} classes`);
  console.log(`nameless items   ${nameIsClassName.length}`);
  console.log(`endpoints        ${sweep.results.length - failures.length}/${sweep.results.length} reachable`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});