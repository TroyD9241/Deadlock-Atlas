# Deadlock Atlas: Design Guide

The source of truth for how the site looks, behaves, and is organized. Read this before building or changing any page. Pair it with `DEADLOCK_SITE_PLAN.md` (stack, data model, milestones).

**Visual source of truth:** `deadlock-atlas.html` (the working mock, extended from the original `index.html`). When this document and the mock disagree, ask. When this document is silent, copy the mock.

> Fan project. Not affiliated with Valve. Deadlock and related assets belong to Valve. This line appears in every page footer.
>
> Lore text, movement notes, and voice line references link out to [The Deadlock Wiki](https://deadlock.wiki) (text licensed CC BY-SA 4.0). Credit the wiki on every page that links to it.

---

## 1. Principles

1. **Reference tool first.** The site exists to help people learn and look things up. Interaction serves understanding; it is never decoration. Do not copy marketing-site layouts (big hero videos, "play now" calls to action).
2. **The mock's look is final.** Flat dark panels, soft radial glows, rounded corners, pill buttons, letter-spaced eyebrows. Do not introduce a new visual language (glassmorphism, neon gradients, different fonts) without asking.
3. **Characters drive color.** Every page takes its colors from character artwork: the featured Hero of the Patch across the site, a hero's own palette on that hero's pages, and an item's own palette on that item's pages (section 3).
4. **No accounts.** There is no login and no per-user data. Nothing is saved per user, so no favourites, history, or profiles.
5. **Data-driven.** Every page renders from structured data. A patch is a data update, never a page rewrite.
6. **One source for changes.** Patch changes are stored once, per entity per patch, and displayed in several places (section 5.6).
7. **Honest placeholders.** Anything not verified against real game data is shown in brackets (`[old value]`, `[Patch name]`) or labeled as sample data. Never invent stats, patch notes, or lore.
8. **Accessible by default.** Contrast, keyboard use, and touch targets are requirements, not polish (section 8).

## 2. Visual language

All values below come from the mock. Keep them as CSS custom properties.

### 2.1 Tokens

```css
:root {
  color-scheme: dark;
  --bg: #090b12;            /* page background */
  --panel: #141824;         /* panel base */
  --line: #ffffff19;        /* borders and dividers */
  --text: #f4f2f8;
  --muted: #a6a9ba;
  --accent: #c09fc8;        /* site default; overridden per hero */
  --accent-rgb: 192,159,200;
  --on-accent: #17131b;     /* text on accent fills (computed, section 3) */
  --buff: #6fcf97;         /* semantic, never themed */
  --nerf: #ff8a80;         /* semantic, never themed */
  --radius-card: 18px;
  --radius-hero: 28px;
  
  /* Typography (section 2.3) */
  --font-body: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "Gronau Neue", "Inter", system-ui, sans-serif;
  --font-mono: "Colus", "JetBrains Mono", "Fira Code", ui-monospace, monospace;
}
```

Page background: two radial glows over `--bg` (purple at top right, teal at bottom left) as in the mock. Hero pages and themed Home pages replace the glow color with a mix of `--accent`.

### 2.2 Shapes and surfaces

- Panels: 1px `--line` border, `--radius-card`, subtle diagonal gradient (`#171b28e8` to `#111520e8`).
- Hero banner: `--radius-hero`, gradient base, plus a radial glow `color-mix(in srgb, var(--accent) 34%, transparent)` behind the artwork.
- Buttons: primary = accent fill with `--on-accent` text; secondary = translucent fill with a `#ffffff2b` border.
- **Plate language** (chamfered surfaces, section 5.2): `.plate` = list/data cards (abilities, stats, sources, builds) with 12px corner cuts; `.chip` = interactive pill replacement (switchers, filters) with 8px cuts, 44px target, accent-gradient active state; `.tag` = non-interactive micro-label (class badges, UNIVERSAL, SIGNATURE) with 6px cuts. The header nav uses `.nav-link` (10px cuts). All chamfered surfaces use `inset 0 0 0 1px` edge instead of border so the clip-path cuts read as open chamfers.
- **Prose rule**: never render API/official text as a single `<p>` blob. Split on blank lines: first paragraph = lead (Inter 15px, `--text`), rest = mono 12.5px; 3+ paragraphs → two columns with accent column-rule above 780px (same as `.hero-card-lore`). Our own words stay Inter.
- Max content width 1240px, centered.

### 2.3 Typography

The site uses a tiered font system to match Deadlock's aesthetic:

**Primary fonts:**

1. **Inter** — Body text and UI elements (fallback to system UI stack)
   - Used for: general body text, navigation, buttons, labels
   - Weights: 400 (regular), 500 (medium), 600 (semibold), 850 (eyebrows)

2. **Gronau Neue** — Stylized display elements (hero names, item names, ability names)
   - Source: Gronau Neue Trial (CC BY-NC license)
   - Weights: 400 (regular), 700 (bold), 900 (fette/black)
   - Used for: hero names on cards and banners, item names, ability names, section headings that need a "game UI" feel
   - Characteristics: condensed, geometric, slightly industrial — captures the game's aesthetic

3. **Colus** — Technical data and stats (monospace-like)
   - Used for: numerical stats, data tables, lore text overlays, any text that should feel technical or precise
   - Characteristics: all-caps optimized, mechanical/industrial feel
   - Style: 10px, uppercase, 0.08em letter-spacing, with subtle accent glow for lore overlays

**Typography scale:**

- **Eyebrows:** 10px, uppercase, 0.17-0.2em letter-spacing, weight 850 (Inter), accent colored
- **Hero names (display):** `clamp(44px, 7vw, 82px)`, tight negative letter-spacing, Gronau Neue
- **Item/ability names:** 18-24px, Gronau Neue Bold, accent color
- **Section headings:** 21px, letter-spacing -0.03em (Inter), or Gronau Neue for game-themed sections
- **Body text:** 14-16px, Inter Regular
- **Stats/data:** 11-13px, Colus, uppercase, 0.08em letter-spacing
- **Supporting text:** 12px, Inter, `--muted`

**Font loading:**
- All custom fonts use `font-display: swap` for fast initial render
- Inter loads from system fonts (no download required)
- Gronau Neue and Colus are self-hosted in `/public/fonts/`

### 2.4 Components (from the mock; port these as React components)

`Header` (brand + pill nav), `HeroBanner`, `QuickStats`, `ProfileSwitcher`, `AbilityList`, `BuildList`, `SkinCard`, `PaletteGrid`, `Card` (art + name + tagline + swatches), `Panel`, `PatchTimeline`, `DiffBox` (before/after), `ChangeRow` (name, old to new, badge), `ItemRow`, `ItemPopover`, `Badge`.

### 2.5 Icons and imagery

- Icons: inline SVG, stroke style, `currentColor`. No emoji.
- Buff/nerf badges always pair color with an arrow and a word or label (up/down). Color alone never carries meaning.

### 2.6 Art-forward backgrounds (idea to build on)

The API hands us far more art than a page needs, and blank areas are where a site looks unfinished. The idea: **use the game's own assets as background texture and as character, so a page is never empty where it could carry a character.**

Two layers of this pattern, one already shipped and one to build on:

**Shipped — ability icon field (`AbilityIconField`).** The hero profile's background gradient carries the hero's own ability icons: the API gives every hero ability class its own art (`abilities/vampirebat/vampirebat_love_bites.png`), so each hero's page is themed by its own kit. Signature and innate abilities render large and stronger; the shared universal ones render small and faint. The banner uses a stronger field; the page background uses a fainter, sticky one that drifts behind the sections as you scroll.

**Shipped/planned — ability reference.** `/abilities` began as a flat alphabetical index (M2) and is slated for a rebuild as a cross-hero reference grouped by what an ability does (damage, crowd control, mobility, healing, buff/debuff, universal). Its job is lookup across heroes — "which hero slows?" / "what does this status do?" — not restating hero pages. Valve's own `description.desc` and per-tier upgrade text (`t1_desc`/`t2_desc`/`t3_desc`) are the content; the kind tag comes from `HeroAbility.slot` (since `Ability.kind` is only set for universal abilities). The universal list is filtered to the genuinely shared movement/innate abilities. Categories will be verified against the real data before committing to the final grouping.

**To build on — character assets on blank backgrounds.** The API ships several renders per hero and we currently use one:

| Key | Size | Shape | Used today |
|---|---|---|---|
| `card` | 280×380 | portrait crop | banner cutout, directory cards, nav dropdown |
| `cardCritical` | 280×380 | portrait crop | nav dropdown only |
| `cardGloat` | 280×380 | portrait crop | nav dropdown only |
| `vertical` | portrait | full height | unused |
| `small` | 128×128 | square | unused |
| `background` | 4096×2312 | wide motif | banner backdrop, directory cards |
| `nameImage` | wordmark | official logo | banner and card headings |

Where a page has a blank area, reach for the assets before adding a box or a rule:

- **Placeholder sections** ("Looks & cosmetics", build paths, map, lore cards, item pages) can carry a character render or the hero's motif instead of sitting empty.
- **The 3D model's fallback** can use a different hero render than the banner, so the same hero is not repeated twice in a row.
- **Directory cards** can rotate through `card` / `cardCritical` / `cardGloat` so the grid is not 44 identical portraits.
- **Section backgrounds** can use the hero's `vertical` or `small` art at low opacity behind headings.

Rules when doing this:

- Decorative only: `aria-hidden`, no pointer events, never inside a link or a control.
- Never behind body text at a readable opacity — background art stays faint, text keeps its 4.5:1 contrast.
- Placement is deterministic (PRNG seeded with the entity slug), so a page renders identically on the server and the client.
- Hero-specific art only on hero-specific pages; a generic page uses the site's own gradient, not a hero's art.
- Asset use is Valve's: hotlink the API's CDN, never self-host copies (see the open question in section 11).

## 3. Theming system (character colors)

### 3.1 Rule

Every themed surface reads its colors from CSS variables. Pages never hard-code a hero's hex values. Switching hero means switching variables.

### 3.2 Variables

| Variable | Meaning |
|---|---|
| `--accent`, `--accent-rgb` | The hero's main accent |
| `--p1` ... `--p5` | The hero's five-color palette, darkest to lightest (as in the mock's color study) |
| `--on-accent` | Text color for accent fills, chosen for contrast |
| `--glow` | Derived: accent mixed with transparent, used in banner and page glow |

Register the main colors so changes can animate:

```css
@property --accent { syntax: '<color>'; inherits: true; initial-value: #c09fc8; }
@property --glow   { syntax: '<color>'; inherits: true; initial-value: #c09fc855; }
```

### 3.3 Applying a theme

One function sets everything on a scope element (the page root, a banner, or a single card):

```ts
function applyTheme(el: HTMLElement, hero: { accent: string; palette: string[] }) {
  el.style.setProperty('--accent', hero.accent);
  el.style.setProperty('--accent-rgb', hexToRgb(hero.accent));
  hero.palette.forEach((c, i) => el.style.setProperty(`--p${i + 1}`, c));
  el.style.setProperty('--on-accent', readableTextOn(hero.accent)); // dark or light by contrast
}
```

- Scope matters. A card sets its own variables so a grid can show many heroes at once.
- Changing the hero changes the variables only. No component swaps classes per hero.
- Transitions: 300-400ms color transitions on theme switches; none under `prefers-reduced-motion`.

### 3.4 Where colors come from: the shared `extractPalette` function

One function defines colors for heroes **and items**. Input: artwork (hero art, or an item icon). Output, stored on the record: `accent`, `accentText`, `onAccent`, `palette[5]`. Items use the same function and the same `applyTheme()`; there are no hand-picked category colors.

Steps (deterministic, so the same image always gives the same result):
1. Downscale to about 160px; ignore transparent pixels and near-black.
2. Convert to Lab color space.
3. Weight pixels by saturation, so flat dark backgrounds do not dominate.
4. Cluster with k-means (k = 10, fixed seed).
5. **Accent:** the colorful, mid-lightness cluster with the best combined score of presence and chroma.
6. **Palette:** the accent plus the four most distinct present clusters, ordered dark to light (`--p1` to `--p5`).
7. **`accentText`:** the accent lightened in Lab until it reaches 4.5:1 contrast on `--panel`. The original accent is kept for fills and glows.
8. **`onAccent`:** dark or white, whichever contrasts better with the accent.

**Scope.** This function themes **items only**. The Deadlock API returns an
official accent per hero in `colors.style_hex`, and all 44 released heroes
have one, so heroes use that and never run extraction. Items carry **no**
colour field of any kind across all 781 records, so their icon is the only
available source. The same `applyTheme()` still themes both.

**Release state does not come from the API's flags.** A hero belongs on the
site when it appears in `GET /v1/assets/heroes?only_active=true`. Do not derive
it from `in_development`: at build 6819 that flag still marked **Baba and
Violet** as in development when both were live and playable, and it lists a
literal `hero_testhero`. The `only_active` list returned exactly the 44 heroes
we held artwork for, no extras and none missing, which is how the discrepancy
surfaced. The raw `isDisabled` and `isInDevelopment` flags are still stored so
the lag stays visible rather than being hidden behind the derived flag.

> **Known instability.** k-means runs from a single initialisation, so the
> result depends on the random draw and can land in a different local optimum.
> A TypeScript port and the Python prototype below agree on only 3 of 44 hero
> accents. This matters little for items because a manual override always wins
> and there are only a few hundred of them, but it is a real property of the
> function, not a defect in either implementation. Stabilising it with
> k-means++ and multiple restarts would remove the dependence on the seed.

Reference prototype: `extract_palette.py` (ported to TypeScript as
`scripts/extract-palette.ts`, which the ingest uses). Both were run over all 44
character folders and compared:

| Hero | Curated accent | Python prototype | TypeScript port |
|---|---|---|---|
| Abrams | `#BE7052` | `#C0774F` | `#D07643` |
| Mina | `#C83A31` | `#D53B32` | `#D23B31` |
| Celeste | `#C09FC8` | `#A875BB` | `#A26AB4` |
| Deadman Danny | none yet | `#E77C2D` | `#EC682C` |

The two implementations agree on only 3 of 44 accents, for the reason given
above. Their results also no longer track the hand-curated column closely for
Celeste, because that folder's artwork has since been replaced with a newer
2026 splash. **None of these numbers are used for heroes**, which take
`style_hex` from the API. They are recorded only so nobody mistakes the
prototype for a specification.

Rules:
- Run at ingest, never in the browser.
- A manual override field exists on every hero and item, because automatic extraction can pick a poor accent.
- Low-chroma art (gray items) falls back to the site default accent and is flagged for review.
- Banner art should be a cutout or a wallpaper with calm negative space; splash art with baked-in logos can bias the result.
- Validate every output: `accentText` must reach 4.5:1 on `--panel`, and `onAccent` must have the best available contrast on the accent.
- The Deadlock API returns an official accent per hero in `colors.style_hex`, and **heroes use that.** Extraction is reserved for items, which carry no colour field at all. Store `style_hex` as `apiAccent` on heroes anyway, as the drift check.

### 3.5 Site theme: Hero of the Patch

The site takes its theme from the **Hero of the Patch**, as a nod to the featured character. It is set once on the page root, so the glow, accents, timeline highlight, active nav item, and links all follow it. It applies to every page except character-specific and item-specific pages (section 3.6). It is dynamic: when the featured hero changes, the whole site retheme with no code change.

**Selection:** a weighted score that combines what changed and how much the hero is played.

1. **Change impact** (per patch). For every changed value, `magnitude = min(|new - old| / old, 1)`, multiplied by two weights, then summed per hero:
   - Kind of change: stat tweak 1.0, ability value tweak 1.5, new or reworked ability 2.5.
   - Direction: buff 1.0, nerf 1.25.
   Buffs and nerfs both add to impact, since a large nerf makes a hero as notable as a large buff. The banner also shows the net direction (buffed, nerfed, or mixed).
2. **Popularity.** The hero's share of matches played in a recent window, from the Deadlock API (endpoint and window to be verified against the API when building).
3. **Combined:** `score = 0.6 x impactPercentile + 0.4 x playPercentile`, where each percentile ranks the hero among all heroes.

> **Work in progress: this formula is not close to complete.** The structure above is a starting sketch only. The weights are guesses, and the inputs are not defined yet (see the list below). Treat nothing in this section as final until it is revisited in the API data milestone.
>
> **Deferred.** Patch work is paused, so this formula is paused with it. It needs change impact (which needs patch diffs) *and* play counts. Until then no page has a Hero of the Patch, and the site theme uses the default accent. See the decisions log.

**Still to define (needed before the formula can be built):**
- Which stats count, and how each is measured (health, resists, move speed, damage, cooldowns, costs, ability values, and so on).
- What counts as a buff or a nerf for each stat. Direction is not always "higher is better": a lower cooldown is a buff, higher damage taken is a nerf, a cost increase is a nerf. Each stat needs a polarity.
- How to treat mixed changes (a buff and a nerf in the same patch) and how to scale magnitude across stats with different units.
- How item changes are scored, and whether items ever compete with heroes for the headline slot.
- Which Deadlock API endpoint and time window supply play counts, and how often the data refreshes.

All weights are starting values. Keep them in one config file and tune them against real patches.

Behavior:
- Recompute when a patch is ingested, and daily for 7 days afterwards while play data settles; then lock until the next patch (proposed, so the theme does not flip constantly).
- If play data is unavailable, rank by impact only.
- A patch record may carry a manual `featuredHeroId`, which always wins.
- Store the score breakdown with the result and show a short reason on Home (for example "most changes and most played"), so the choice is transparent.
- If there is no hero data yet, use the site default accent.

### 3.6 Which theme applies where

| Page | Theme source |
|---|---|
| Home, Heroes directory, Items list, Patches, Lore, Map, Relationships | Hero of the Patch |
| Hero profile (`/heroes/[slug]`) | That hero's own palette |
| Item page (`/items/[slug]`) | That item's palette, from `extractPalette` on its icon |

- Cards and rows theme themselves inside a page. On the Heroes directory, the page glow is the Hero of the Patch, but each hero card keeps that hero's colors. On the Items list, each row uses its own item palette.
- An item's category (Weapon, Vitality, Spirit) is shown as a label, not as a theme color.
- Changing page type changes the variables only; components do not change.

### 3.7 Fixed colors

`--buff` and `--nerf` never change with the theme. Neither do text, muted text, or line colors.

## 4. Hero artwork and source folders

### 4.1 Artwork types

| Type | Example | Use |
|---|---|---|
| Transparent cutout (PNG or WebP, about 1400-1700px tall) | Abrams, Mina | Best for banners; sits on the page glow |
| Wallpaper with calm negative space on one side | Deadman Danny (1920x1080, dark left half) | Banner background with a fade mask; text goes over the dark area |
| Square splash with background and baked-in text | Celeste | Cards only, cropped to hide text |

- Banner art must not contain baked-in text. The page supplies the name, tagline, and eyebrow.
- Store the original artwork reference, the extracted palette, and the manual override together on the record.
- All art is Valve's. Confirm usage terms before self-hosting.

### 4.2 Character source folder

Each hero has a folder:

```
deadlock files/characters/<Hero Name>/
  <Hero Name>.md      links to the source pages
  <hero photo>        artwork used for the palette and the card or banner
```

The `.md` file has one `KEY: URL` line per source, under a heading line with the hero's wiki name. Example (Deadman Danny):

```
Deadman_Danny:

CHARACTER INFO: https://deadlock.wiki/Deadman_Danny/Lore
MOVEMENT: https://deadlock.wiki/Deadman_Danny/Movement
VOICE LINES: https://deadlock.wiki/Deadman_Danny/Voice_lines
```

| Key | How we use it |
|---|---|
| CHARACTER INFO | A credited "Lore on the wiki" link card on the hero profile, plus our own short factual summary where needed |
| MOVEMENT | A credited link card to the hero's movement page |
| VOICE LINES | A credited link card to the hero's voice lines page (see open question 2) |

- Ingest reads the folder, runs `extractPalette` on the photo, and stores the source links. It does **not** copy wiki text.
- **License (verified from the wiki's footer):** text on the Deadlock Wiki is licensed under Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA), **except non-text media and any game content**. *Deadlock* is a trademark of Valve.
  - Wiki prose (bios, personality, appearance, relationship write-ups) was written by the community. It is not Valve's, and it is free to reuse only under CC BY-SA: credit the wiki, link the source page, say if changes were made, and release adapted text under the same license.
  - Game content (voice line text, art, icons, names, in-game stats) is excluded from that license and belongs to Valve. Voice line transcriptions are game content.
  - **Decision: credit and reference, do not copy.** The site links to the wiki for lore, movement, and voice lines, with a visible credit ("Source: The Deadlock Wiki, CC BY-SA 4.0"). No wiki prose is reproduced. Any text we write ourselves is our own words from the facts. Structured facts we record (for example, that two heroes are related) are our own data, with a source link.
  - This is not legal advice. Valve's own policy for fan sites and fan-hosted game assets has not been checked; confirm it separately.
- **What a wiki Lore page contains**, and where it goes:

| Wiki section | How we use it |
|---|---|
| Biography, Personality, Appearance | Linked and credited; not copied |
| Character Relationships (named characters and groups) | Our own relationship edges (facts), each with a source link |
| Character Interactions (which heroes they react to, and how) | Source for our own interaction edges; no quoted text |
| References (voice line citations) | Linked only; voice line text is game content, not ours to republish |
- Adding a hero means adding a folder. No code changes.

## 5. Pages

### 5.1 Site map

| Route | Purpose |
|---|---|
| `/` | Home dashboard (latest patch changes, Hero of the Patch) |
| `/heroes` | Directory |
| `/heroes/[slug]` | Hero profile (the current mock, as is) |
| `/abilities` | Ability index across all heroes, with a search box |
| `/items` | Item list |
| `/items/[slug]` | Dedicated item page |
| `/patches` | Patch list with summaries |
| `/patches/[version]` | One patch's summary |
| `/lore` | General lore overview (kept simple for now) |
| `/map` | Interactive map (later) |
| `/stats`, `/esports` | Later phases; shown as "coming soon" |

**Play data (M11, M12).** Item pick rates, buy timing and ability max rates are a layer over the existing `/items`, `/heroes/[slug]` and theorycraft pages, not a separate route — the nav gains no `/stats` entry. A global rank-bracket picker (four brackets: Initiate–Sentinel, Mystic–Ritualist, Emissary–Oracle, Phantom–Eternus) filters every play-data figure, with the current bracket indicated wherever the data appears. Buy times are shown as `mm:ss` plus the percentage into the match. Pick rate is the only sortable metric; win rate is shown but never sorted on, because it reflects who buys an item rather than the item's effect.

### 5.2 Header and navigation

- Brand `DEADLOCK ATLAS` in Gronau Neue (letter-spaced, accent on "ATLAS"), then chamfered-plate nav: Home, Heroes (with portrait dropdown), Items, Theorycraft, Lore, Map, Patches.
- Nav labels are Gronau Neue, uppercase, 12px/700, wide tracking. Each sits on a cut-corner angular plate (`clip-path` chamfer); hover = 12% accent tint; active page = 26%→10% gradient plate with 1px inset accent edge.
- A global search field, styled as a chamfered plate in matching typography, sits at the end of the nav row with Cmd+K shortcut and debounced autocomplete.
- The header bar is sticky at the top of the viewport with a translucent `--bg` background + backdrop blur; the mobile nav scrolls horizontally and is never hidden.
- "Hero profile" in the nav returns to the last hero viewed.

### 5.3 Home (dashboard)

Layout: main column plus a right rail (collapses to one column under 1000px).

Main column, in order:
1. **Hero of the Patch banner** (themed, uses the hero profile banner pattern; stats show old to new).
2. **Heroes row** (cards with swatches and change badges, plus an "All heroes" card).
3. **Patch timeline** (hero picker, patch dots, before/after).
4. **Lore and locations** (general; section 5.5).
5. **Explore the world** (map and relationship previews).

Right rail: latest patch summary, latest changes, most changed items. (The mock currently shows a "Recently viewed" panel. Remove it in the port; there are no accounts or saved history.)

Home shows the **actual detailed changes of the latest patch**. Older patches live on hero and item pages and, in summary form, on `/patches`.

### 5.4 Heroes

Use the current mock as is: hero profile (banner, quick stats, abilities and builds, looks and cosmetics, color study), profile switcher, directory with search. Add a patch history section later using the shared `PatchTimeline` component.

**Ability icon field**: the hero banner's background gradient carries the hero's own ability icons as texture (`AbilityIconField`). The API gives every hero ability class its own art, so each hero's banner is themed by its own kit: signature and innate abilities render large and stronger, the shared universal ones small and faint. Placement is deterministic — a PRNG seeded with the hero slug — so a hero always gets the same arrangement and the server and client agree. The field is decorative: aria-hidden, no pointer events, masked away from the headline's column.

### 5.5 Items

**List page** in the site's style: grouped or filterable by category (Weapon, Vitality, Spirit), searchable, each row showing icon, name, category, cost/tier from data, and a change badge if changed in the latest patch. Style it as a clean list or grid of `ItemRow` components, not a spreadsheet.

*Built (M5):* `/items` lists the 250 items that have a slot, filterable by All / Weapon / Vitality / Spirit (the chips carry counts). The 95 slot-less rows the API lists separately (the weapon-upgrade tiers) are not shop items and are left out. Cards are `.plate` surfaces with the in-game icon, the name, slot and tier tags, and the cost. The change badge and patch history stay deferred with the rest of patch work.
**Filtering.** `/items` carries a filter rail: slot, tier, maximum cost, curated modifier facets (health, spirit damage, weapon damage, resistance, cooldown & charges, movement, range, status effects, healing, defence & escapes), and the game's own `shop_filters` taxonomy (anti-CC, stealth, regen, teleport, vulnerability and the rest), plus in-shop and starter toggles and a scoped text search. Every filter is a link and the URL is the state, so a filtered view is shareable and the back button works. The facets are curated in `data/curated/item-facets.json` because the API's 441 property keys are engine vocabulary; the counts update as the other filters narrow the set.

**Item colour: the slot's official colour.** Items carry no colour of their own — `colors.style_hex` is a hero field — so an item's theme is the colour the game uses for its category, taken from the API's `colors.json`: weapon `weapon_color` `#E58A00`, vitality `fortitude_color` `#649717`, spirit `spirit_color` `#8A55B3`. These are Valve's own values, so `accentSource` is recorded as `api`. No palette is extracted from the icon: the item icon is monochrome line art on transparent, and the coloured `shopImage` is a shop tile on an opaque pale background that reads as a white square on this dark site, so the transparent icon is what the site shows.

**Hover popout that solidifies:**

| State | Trigger | Appearance | Behavior |
|---|---|---|---|
| Preview | Pointer hovers or keyboard focus lands on an item (after a short ~150ms delay) | Translucent card with a subtle progress ring | Not interactive; follows the item |
| Pinned | Pointer or focus stays on the item or the popout for **5 seconds** | Becomes solid (opaque background, full border); progress ring completes | Interactive: scrollable, has an "Open item page" button |
| Closed | Pointer and focus leave both item and popout; Esc; click outside | Fades out | Timer resets |

Rules:
- Leaving the item or popout before 5 seconds cancels the pin and resets the timer. Moving between the item and its popout counts as staying.
- Keyboard focus follows the same states. Esc closes. The popout never traps focus.
- **Touch devices have no hover:** a tap opens the popout already pinned. A second tap on the button opens the item page.
- Popout content: name, category, cost, effect text, key stats, "changed in latest patch" summary, link to the item page.
- Under `prefers-reduced-motion`, skip the ring animation; pin after 5 seconds with no motion.
- Popout stays inside the viewport (flip or shift near edges).

**Item page:** header with icon and name, category label and cost, description and stats, patch history using the shared timeline, and later (Phase 2) which heroes build it. Themed by the item's own palette (section 3.6), not by the Hero of the Patch.

*Built (M5):* `/items/[slug]` follows the hero profile's shape without the parts that do not apply to an item: no character model, no complexity, no hero switcher. It has the item header (art, name, category, tier, cost), the quick-stat row, the effect text, the stat modifiers, and the sources block. The item's art ghosts through the page background like the hero's ability icons (section 2.6).

**Item text.** The API's item descriptions are Valve's own HTML: inline `<svg>` stat icons and `<span>`s with the game's classes (`highlight`, `diminish`, `inline-attribute-label`). They are sanitised with an allowlist rather than stripped, so the stat icons survive; `highlight` becomes accent text, `diminish` muted, and `inline-attribute-label` a small chip. Text is split into paragraphs on `<br><br>`, like the prose rule (section 2.2). Items with no prose at all (the API states their effect as property upgrades, e.g. Extra Charge) show those upgrades instead of "[no description]". Stat modifiers without a label are engine-level keys (`ChannelMoveSpeed`) and are left out; only the player-facing ones are listed.
### 5.6 Where patch changes appear

One data source (snapshot per entity per patch), shown in different forms:

| Place | Shows |
|---|---|
| Home | The latest patch's changes in full detail |
| Hero page | That hero's full change history |
| Item page | That item's full change history |
| `/patches` | A **list of patches with summaries** (counts, buffs and nerfs, notable changes) and links to the affected heroes and items |
| `/patches/[version]` | The summary for one patch, linking to entity pages. It does not duplicate full diffs |

Summary only on Patches; detail lives with the thing that changed.

### 5.7 Lore (general for now)

Keep it simple until the direction is decided: a landing page listing locations and factions as cards, each linking to a basic detail page with text and an image placeholder. No deep features yet. Hero lore stays on hero pages. Every lore entry needs a source note so it can be corrected when the game changes.

### 5.8 Map (later, hard)

Interactive, so it is deferred. Intended progression, not a commitment:
1. Static annotated image with labeled hotspots (call-out names and lore).
2. Pan and zoom, hotspot detail panels.
3. Layers and filters (objectives, buff spawns, ziplines).

Home shows only a small preview linking to `/map`. Do not block other pages on the map.

### 5.9 Relationships

Graph of heroes and factions (React Flow or Cytoscape). Home shows a preview; the full page is `/relationships`. Lower priority than Items and Patches.

## 6. Interaction patterns

- **PatchTimeline** (shared): hero or item picker, patch dots (selected state in accent), before/after `DiffBox` with changed values in accent. Used on Home, hero pages, item pages.
- **ChangeRow:** name, `[old] to [new]`, buff/nerf badge with arrow. Whole row is a link to the entity.
- **Search:** one search index across heroes, items, lore, patches.
- Every clickable thing is a real link or button. Hover is never the only way to reach information.

## 7. Responsive behavior

- Under 1000px: Home grid collapses to one column; lore and tool grids stack.
- Under 780px: nav becomes a scrolling row; two-column diffs and location grids stack; hero banner stacks art under text.
- Under 480px: directory cards go to one column.
- Horizontal rows (hero row, locations) scroll within their own container; the page never scrolls sideways.

## 8. Accessibility

- Text contrast at least 4.5:1 (3:1 for large text). Themed accents are validated at ingest (section 3.4).
- Interactive targets at least 44px.
- Visible focus styles on all controls, using the accent.
- Buff/nerf never relies on color alone.
- All images have alt text; decorative glows are hidden from assistive tech.
- Respect `prefers-reduced-motion` and `prefers-color-scheme` is fixed dark.

## 9. Data and content rules

- Real data comes from the Deadlock API assets endpoints, normalized into the database (see the plan). Cross-check against the Deadlock Wiki data when unsure.
- Placeholders are bracketed. The footer says sample or editorial content is unverified.
- Never present ability, build, or lore text as official unless it comes from verified data.
- **Valve's own text from the API may be shown.** Each hero carries an official in-game `role`, `playstyle` and `lore` from the assets API. This is official game content, not wiki prose, so the credit-and-link rule does not apply to it. On a hero page, our own words come first and Valve's official text appears below it, clearly labelled as official. The wiki is still linked and credited for lore detail.
- Never copy wiki prose. Link and credit instead (section 4.2).
- Stats and Esports pages stay "coming soon" until their phases.

## 10. Build order (design-driven)

1. Scaffold the project and port the **tokens and theme system** (section 2 and 3), including `applyTheme` and `@property` registration.
2. Port the **Header** and **hero profile and directory** from the mock, driven by data.
3. Build the **Home dashboard** with Hero of the Patch theming.
4. Build the shared **PatchTimeline** and **ChangeRow**.
5. Build **Items**: list, popover, item page.
6. Build **Patches** list and patch summary pages.
7. **Lore** (general), then **Relationships**.
8. **Map** last.

## 11. Open questions

1. **Hero of the Patch formula:** incomplete by design (section 3.5). Stats, buff/nerf polarity, and the API play-count source are defined at the API data milestone.
2. **Voiceline explorer and interaction widget:** with the link-out policy, voice line text and audio cannot be copied from the wiki, and they are Valve game content in any case. Decide whether these features become link-based, wait for an official data source, or are cut. The Home page already dropped the voiceline panel; the hero page still plans one.
3. **Valve's fan-site policy:** not yet checked; confirm before self-hosting any game art or audio.
4. **Lore:** direction is undecided. Build only the general version (section 5.7) until it is decided.
5. **Map:** on hold.

## 12. Decisions log

- The glass-style redesign was rejected. The flat mock look is final.
- Reference designs (Valorant dashboard, Dota 2 site, Dribbble concept) are for layout ideas only, never for look or assets.
- Patch details live on Home and entity pages; the Patches page only summarizes.
- Voiceline explorer was removed from Home; it stays on hero pages when voiceline data is available.
- Theme scope: the Hero of the Patch theme applies to every page except character-specific pages (their own hero palette) and item-specific pages (the item's own palette).
- Item pages are themed by the item's own palette.
- No accounts and no per-user features. Favourites and Recently viewed are cut.
- Items popout pins after 5 seconds of continuous hover or focus.
- Lore stays general until a direction is chosen.
- Item colors come from the same `extractPalette` function as heroes, not from fixed category colors.
- Hero of the Patch is decided by a weighted score of change impact (buffs vs nerfs, weighted) and play popularity from the Deadlock API.
- Each hero is added through a source folder with a links file and a photo (section 4.2).
- Map: on hold.
- The Hero of the Patch formula is explicitly unfinished; its definitions are deferred to the API data milestone.
- Wiki text is CC BY-SA 4.0 (game content excluded). Credit and link the wiki wherever its text or structure is used.
- Wiki lore is referenced and credited, not copied (section 4.2).
- Accent precedence for **heroes**: manual override, then the API's `colors.style_hex`, then extraction, then the site default. A hero whose accent has effectively no chroma falls back to the site default and is flagged for review (Sinclair's `#6B6B6B` has chroma 0.0). Items have no API colour, so they go straight to extraction.
- Hero pages show our own words first, then Valve's official in-game description from the API, clearly labelled (section 9).
- Patch data is deferred for now: no patch diffing, no `/patches` pages, no Hero of the Patch. Hero, ability and item data is still stamped with the game build it came from, so nothing needs backfilling when this resumes. The site theme falls back to the default accent until a featured hero exists.
- **Hero profile body copy:** 18 of 44 released heroes have no `playstyle` or `role` from the API (only `lore`). Deferred — profile pages will lead with Valve's official text where present and show `[lore only]` for the rest until we draft personalized taglines. Revisit after M2 profile page scaffolding.
- **Hero profile image choice:** The profile banner currently uses the 280×380 card portrait as the character cutout (matching the mock). The 4096×2312 background motif is used as a backdrop. We explored using the background as the main image but reverted — the portrait reads better at this size. Revisit if better artwork (full-body renders) becomes available.
- **3D character model:** Each hero page has a "Character model" section below the banner, rendering the hero's `hero_select.glb` from Valve's CDN via three.js. The model is lazy-loaded (IntersectionObserver) and shows the card portrait as a placeholder. POI hotspots are HTML markers projected onto the model's bone positions each frame, with an accessible list of buttons below the canvas. POI copy is our own words, stored in `HeroPoi` and seeded from `data/curated/pois.json`. Anchors are validated by `scripts/check-model-anchors.ts` before seeding. Mo & Krill has no model and the section is omitted.
- **Art-forward backgrounds (accepted as a direction, section 2.6):** use the API's own art to fill blank areas instead of leaving them empty. Shipped: the hero profile's background gradient carries the hero's ability icons (banner field plus a fainter sticky page field). Next: use the unused character renders (`cardCritical`, `cardGloat`, `vertical`, `small`) and the `background` motif on placeholder sections, the 3D fallback, directory cards and section headings. Decorative only, deterministic placement, never behind body text at readable opacity.
- **Item theming:** an item's theme is the colour the game uses for its slot, taken from the API's `colors.json` — weapon `weapon_color` `#E58A00`, vitality `fortitude_color` `#649717`, spirit `spirit_color` `#8A55B3`. These are Valve's own values, so `accentSource` is `api`. No palette is extracted from the item icon: the icon is monochrome line art, and the coloured `shopImage` is a shop tile on an opaque pale background that reads as a white square on the dark site. The 95 slot-less rows the API lists (the weapon-upgrade tiers) are not shop items and are hidden from the list.- **Item filters and the game's shop taxonomy:** the API gives every item a `shop_filters` list (the game's own categories: `anti_cc`, `jump_and_dash`, `regen`, `debuff_resist`, `teleport`, `invulnerability`, `stealth`, `spirit_vuln`, `bullet_vuln`, `status_stun`, `stamina`, `hp`, `melee`, `weapon_ammo` and more). Only 41 items carry them, so the modifier facets do most of the filtering work; both are stored (`Item.shopFilters`) rather than invented. Filters live in the URL and are applied server-side.
- **Client components must not use `useSearchParams`** on a server-rendered page without a Suspense boundary: the route then waits for the boundary and the page never hydrates, so no event handler fires. The filter rail reads the query from `window.location` instead, and the active filters are passed down from the server so the chips render in their active state.
