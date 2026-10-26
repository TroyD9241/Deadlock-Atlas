# Deadlock Site: Project Plan (Phase 1 focus)

A fan-made, interactive Deadlock reference: an "upscaled wiki" first, then play stats, then esports/HLTV-style coverage. This file is meant to be dropped in the repo root and used as context for opencode (rename or copy to `AGENTS.md` if you want it loaded automatically).

> **Read `design.md` first.** It is the source of truth for how the site looks and behaves (visual language, theming, pages, interactions). This file covers the stack, data model, and build order. If the two disagree, `design.md` wins on design; ask about anything else. The working mock `reference/deadlock-atlas.html` is the visual reference for every page.

> Fan project. Not affiliated with Valve. Deadlock and related assets belong to Valve. Include this disclaimer in the site footer.

---

## 1. Principles

1. **Data-driven.** Every page is generated from structured data in the database. A patch should mean a data update, never a page rewrite.
2. **Pre-render where possible.** Pages are generated at build time from the database. Prisma is only ever called from server code (server components, route handlers, scripts), never from client components. Mark only the interactive widgets as `"use client"`.
3. **Don't duplicate what exists.** Raw hero/item stats come from an existing source. Our value is the interactive layer and curated lore.
4. **Small, verifiable steps.** Each milestone below should be buildable and viewable on its own.
5. **Version-aware.** Hero, ability and item data is stamped with the game build (`clientVersion`) it came from, from day one. This is what makes a patch-diff feature possible later without backfilling.
6. **Characters drive color.** Theme colors come from artwork through one shared `extractPalette` function (heroes and items) and are applied with CSS variables. See `design.md` section 3.
7. **Credit, don't copy.** Wiki lore is linked and credited, never reproduced. See `design.md` section 4.2. Valve's own in-game text from the API is official content and may be shown when attributed.
8. **No accounts.** No login and no per-user data.

## 2. Stack (proposed)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router)** | React throughout; `generateStaticParams` makes data-driven pages (one per hero/item) easy; good SEO for wiki-style content; server code can call Prisma directly |
| Language | **TypeScript** | Type-safe data and components |
| Styling | **Tailwind CSS**, mapped to the CSS variables in `design.md` | Fast iteration; theme colors stay in variables, never hard-coded |
| Database | **PostgreSQL** 17 (local via Docker Compose, hosted on Neon/Supabase/similar) | JSON columns, scalar lists, JSON filtering and case-insensitive matching all work, and it handles Phase 2 stats volume. Started on SQLite for one day and moved, because Prisma Studio cannot open a SQLite `file:` URL |
| ORM | **Prisma 7**, pinned to `^7` (`prisma/schema.prisma`, migrations, typed client, seed script) | Typed queries, migrations, good fit for relational data like patch history. Pinned because `prisma@latest` now installs 8.x RC, which renames the whole workflow |
| Validation | **Zod** at the ingest boundary | Validate API responses before they are written to the DB |
| Long-form content | **MDX** for our own pages only (about, credits). No wiki prose | Lore is linked and credited, not copied |
| Relationship graph | **React Flow** or **Cytoscape.js** | Interactive node graph in React |
| Map | On hold (decide later; likely an image with hotspots) | Do not build yet |
| Animation (optional) | Framer Motion | Timeline scrubbing, transitions |
| Hosting | Vercel or similar Node host + hosted Postgres | A static-only host won't work unless pages are exported at build time (see risks) |

*Alternative:* **Vite + React Router** is lighter, but it would need a separate backend to talk to Prisma and gives up pre-rendered pages, so Next.js is the simpler fit with a database.

Verify current versions and compatibility before installing; don't assume.

**Runtimes are LTS only.** Never pin an odd-numbered or pre-release runtime.
Node 24 LTS; Python on a supported 3.x with a full bugfix cycle. Neither the
official Python installer nor winget can install on this machine without
elevation, so both runtimes are installed side by side from archives: Node from
the win-x64 zip, Python from the nuget package. See `AGENTS.md` for paths.

## 3. Data sources

| Need | Source | Notes |
|---|---|---|
| Hero/item/ability data, icons | **Deadlock API Assets API** (deadlock-api.com) | Verify endpoints and response shapes at the start; check the OpenAPI docs |
| Hero play counts (popularity) | Deadlock API Game Data API | Needed for Hero of the Patch; verify the endpoint and time window (API milestone) |
| Stat cross-check | Deadlock Wiki `Data:HeroData.json` | Good for sanity checks |
| Patch history | Valve patch notes / community changelogs | Needs a normalization step |
| Hero artwork and source links | **Character folders** (`data/characters/<Hero Name>/`: links `.md` plus a photo) | See `design.md` section 4.2 |
| Lore, movement, voice lines | **Link-out to The Deadlock Wiki**, credited (CC BY-SA 4.0 for wiki text) | No copying. We store links and our own short facts only |
| Relationship edges | Our own curated facts, each with a source link | Kumu graph and wiki are references only |
| Locations and factions | Our own short descriptions plus links | Direction undecided; keep general |
| Reference project | **Deadlock.io** (JustSereja/Deadlock.io on GitHub) | Similar architecture; read before building to avoid duplicated effort |
| **Measured** | **`DATA_INVENTORY.md`** | Generated from the cached responses by `scripts/ingest/inventory.ts`. What the API actually returns, field coverage per field, and what is missing. Regenerate it rather than trusting this table |

**Rule:** an ingest script fetches from the APIs, validates with Zod, normalizes to our shape, and upserts into the database through Prisma. The site reads only from the database, never directly from live APIs. Save raw API responses to `data/raw/` so ingests are reproducible and API outages or changes don't block work.

### Verified endpoints

Checked against `https://api.deadlock-api.com/openapi.json` (OpenAPI 3.1, MIT, no API key needed for the assets API). The spec is not served from the docs site, only from the API host.

| Need | Endpoint | Notes |
|---|---|---|
| Heroes | `GET /v1/assets/heroes?language=english&client_version=<int>&only_active=true` | 50 rows. `language` takes full names (`english`, `french`), not `en`. Carries `starting_stats`, `description.{lore,playstyle,role}`, `images.*` with `_webp` variants, the `items` ability class-name map, `colors.style_hex`, `complexity`, `item_slot_info` |
| Abilities | inside `GET /v1/assets/items`, entries with `type = "ability"` | 282 abilities. Rich `properties` maps (cooldown, cast range, channel time, resource cost…) each with its own label, postfix and display units, plus `upgrades[]` tiers of `property_upgrades` |
| Items | `GET /v1/assets/items/by-slot-type/{weapon\|vitality\|spirit}` | Prefer this over the flat list, which is about 4.4 MB. `item_slot_type` is the Weapon/Vitality/Spirit label; the `type` enum is a different axis |
| Build versions | `GET /v1/assets/client-versions` | Flat integer array, latest observed 5695. This is the real version key |
| Patch notes | `GET /v2/patches` | 30 Steam/forum items with raw HTML `content`. No structured diffs, see the risks section |
| Hero popularity | `GET /v1/analytics/hero-stats` | `AnalyticsHeroStats[]` with `bucket` (`start_time_day\|week\|month`), `matches`, `wins`. Answers the open question in `design.md` section 3.5 |

`Item` in the API is a `oneOf` of `Ability`, `Weapon` and `Upgrade`. `language=english` is a `400` if you pass `en`.

## 4. Repo layout

```
deadlock-atlas/
├─ AGENTS.md                  # read-first instructions for opencode
├─ design.md                  # design source of truth
├─ DEADLOCK_SITE_PLAN.md      # this file
├─ reference/
│  ├─ deadlock-atlas.html     # visual source of truth (the mock)
│  ├─ extract_palette.py      # prototype of the palette function
│  └─ designreferences/       # reference images, layout ideas only, never assets
├─ .env                       # DATABASE_URL (never commit)
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/             # Postgres history, the only one that is live
│  ├─ archive/sqlite-migrations/   # discarded, kept for reference, never edited
│  └─ seed.ts
├─ scripts/
│  ├─ ingest/
│  │   ├─ fetch.ts            # Deadlock API -> data/raw/
│  │   ├─ normalize.ts        # raw -> our shape (Zod-validated)
│  │   ├─ characters.ts       # reads data/characters/<Hero>/, runs extractPalette
│  │   └─ load.ts             # upserts into the DB via Prisma
│  └─ extract-palette.ts      # TypeScript port of the palette function
├─ data/
│  ├─ raw/                    # cached API responses
│  ├─ characters/<Hero Name>/ # links .md + hero photo (mirrors "deadlock files/characters")
│  └─ curated/                # relationship edges, locations, factions (own words + source links)
├─ src/
│  ├─ lib/
│  │   ├─ db.ts               # Prisma client singleton
│  │   ├─ queries.ts          # getHero, getHeroHistory, getHeroOfThePatch, ...
│  │   ├─ theme.ts            # applyTheme, readableTextOn, hexToRgb
│  │   └─ schemas.ts          # Zod schemas for ingest
│  ├─ styles/tokens.css       # CSS variables and @property registrations
│  ├─ components/
│  │   ├─ layout/             # Header, Footer (with wiki credit)
│  │   ├─ hero/               # HeroBanner, QuickStats, AbilityList, ColorStudy, LinkCard
│  │   ├─ patch/              # PatchTimeline, DiffBox, ChangeRow, Badge
│  │   ├─ items/              # ItemRow, ItemPopover
│  │   └─ widgets/            # RelationshipGraph ("use client")
│  └─ app/
│      ├─ layout.tsx
│      ├─ page.tsx            # Home
│      ├─ heroes/ , items/ , patches/ , lore/ , relationships/
│      └─ map/                # placeholder only
└─ public/
```

## 5. Core data model (`prisma/schema.prisma`)

Reviewed against live API responses, not a sketch. Four things the real data forced, which the first draft got wrong:

- **`Ability` is split into `Ability` + `HeroAbility`.** There are 282 distinct ability classes but 754 hero-to-ability references. 80 abilities have `hero: null` (Zip Line, Jump, Slide, Mantle) and belong to every hero, so an ability must never be owned by a single hero.
- **`apiId` is `String` on `Ability` and `Item`.** Their ids run up to 4,284,855,775, which overflows Prisma's 32-bit `Int`. It stays `Int` on `Hero`.
- **`Item.slotType` is design.md's "category".** The API's `type` field is a different axis and is only `ability`/`weapon`/`upgrade`.
- **`Patch` lost every patch-page field** (`title`, `url`, `summary`, `featuredHeroId`, `heroOfPatch`) because patches are deferred (section 7).

Postgres was not the first choice and the reason is worth keeping. SQLite was tried first because it needs no daemon, and `Json` columns were verified working on it. It was dropped for one concrete blocker: **Prisma Studio cannot open a SQLite `file:` URL in Prisma 7** — it rejects the protocol outright, so M0's "prisma studio opens" criterion was unsatisfiable. Provider switches also force a fresh migration history, so the sooner the switch happens the less history is discarded.

What was learned on SQLite and still applies: `enum` works (stored as `TEXT`), scalar lists (`String[]`) are Postgres-only, filtering inside a `Json` column needs Postgres, and `mode: "insensitive"` needs Postgres. The schema is unchanged by the move; only the connector and the URL differ.

### Reference model

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

/// One ingested game build. Patch notes, per-patch diffs and /patches pages are
/// deliberately deferred (section 7); this is a version stamp and nothing more.
model Patch {
  id            Int      @id @default(autoincrement())
  clientVersion Int      @unique          // e.g. 5695, from /v1/assets/client-versions
  isCurrent     Boolean  @default(false)
  ingestedAt    DateTime @default(now())

  heroSnapshots    HeroSnapshot[]
  abilitySnapshots AbilitySnapshot[]
  itemSnapshots    ItemSnapshot[]
}

model Hero {
  id         Int    @id @default(autoincrement())
  slug       String @unique
  apiId      Int?   @unique
  name       String
  complexity Int?
  /** In-game class: mystic, marksman, brawler or assassin. */
  heroType   String?

  // Release state. `isReleased` comes from the API's own `only_active=true`
  // list, NOT from the in_development flag: that flag lags, and it still marks
  // Baba and Violet as in development when both are live and playable.
  isReleased      Boolean @default(false)
  isDisabled      Boolean @default(false)
  isInDevelopment Boolean @default(false)

  // Our own words (design.md section 9). Never wiki prose.
  tagline String?
  summary String?

  // Valve's official in-game text, /v1/assets/heroes → description.*
  officialRole      String?
  officialPlaystyle String?
  officialLore      String?

  // Theming (design.md section 3).
  accent          String?
  accentText      String?
  onAccent        String?
  apiAccent       String?               // colors.style_hex — fallback + drift check
  accentSource    String  @default("default")  // extracted | override | api | default
  palette         Json?                 // string[5], dark → light
  paletteOverride Json?
  needsReview     Boolean @default(false)

  artwork         Json?                 // { type: cutout|wallpaper|splash, banner, card }
  sourceLinks     Json?                 // { lore, movement, voiceLines } wiki URLs
  startingStats   Json?
  heroStatsUi     Json?
  statsDisplay    Json?
  shopStatDisplay Json?
  itemSlots       Json?                 // the Hero.items class-name map
  itemSlotInfo    Json?
  physics         Json?
  tags            Json?                 // string[] kept as Json so the shape is explicit
  removedContent  Json?

  abilities     HeroAbility[]
  snapshots     HeroSnapshot[]
  relationsFrom Relationship[] @relation("From")
  relationsTo   Relationship[] @relation("To")
  playStats     HeroPlayStat[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name])
}

model HeroSnapshot {         // one row per hero per ingested build
  id      Int   @id @default(autoincrement())
  heroId  Int
  patchId Int
  stats   Json
  hero    Hero  @relation(fields: [heroId], references: [id], onDelete: Cascade)
  patch   Patch @relation(fields: [patchId], references: [id], onDelete: Cascade)
  @@unique([heroId, patchId])
}

/// A distinct ability from /v1/assets/items (type = "ability"), keyed by game
/// class name. 282 exist; 80 are universal (hero = null) and shared by many
/// heroes, so this is NOT owned by a single hero.
model Ability {
  id        Int     @id @default(autoincrement())
  className String  @unique
  apiId     String? @unique           // ids reach 4,284,855,775 — exceeds Int32
  name      String
  kind      String?                  // innate | signature | universal
  image     String?
  imageWebp String?

  videos             Json?
  behaviours         Json?
  dependantAbilities Json?
  description        Json?
  properties         Json?           // ItemProperty map (cooldown, range, …)
  upgrades           Json?           // RawAbilityUpgrade[] — tiers of property_upgrades
  removedContent     Json?

  heroes    HeroAbility[]
  snapshots AbilitySnapshot[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name])
}

/// Which hero has which ability, and in what slot (Hero.items keys).
model HeroAbility {
  id           Int     @id @default(autoincrement())
  heroId       Int
  abilityId    Int
  slot         String                 // signature1..4, ability_innate1..3, …
  displayOrder Int     @default(0)
  isInnate     Boolean @default(false)

  hero    Hero    @relation(fields: [heroId], references: [id], onDelete: Cascade)
  ability Ability @relation(fields: [abilityId], references: [id], onDelete: Cascade)

  @@unique([heroId, slot])
  @@index([abilityId])
}

model AbilitySnapshot {
  id        Int   @id @default(autoincrement())
  abilityId Int
  patchId   Int
  values    Json
  ability   Ability @relation(fields: [abilityId], references: [id], onDelete: Cascade)
  patch     Patch   @relation(fields: [patchId], references: [id], onDelete: Cascade)
  @@unique([abilityId, patchId])
}

/// Shop items from /v1/assets/items (type = "upgrade" | "weapon").
model Item {
  id         Int     @id @default(autoincrement())
  slug       String  @unique
  className  String? @unique
  apiId      String? @unique
  name       String
  nameSource String  @default("api")  // api | class | manual

  itemType     String?                 // "upgrade" | "weapon"
  slotType     String?                 // weapon | vitality | spirit
  tier         Int?
  cost         Int?
  shopable     Boolean?
  shopVersion  Int?
  startTrained Boolean?

  image     String?
  imageWebp String?
  shopImage String?

  accent          String?
  accentText      String?
  onAccent        String?
  apiAccent       String?
  accentSource    String  @default("default")
  palette         Json?
  paletteOverride Json?
  needsReview     Boolean @default(false)

  description     Json?
  properties      Json?
  upgrades        Json?
  tooltipSections Json?
  activation      Json?
  imbue           Json?
  disabled        Boolean?
  removedContent  Json?

  snapshots ItemSnapshot[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slotType])
  @@index([tier])
  @@index([itemType])
}

model ItemSnapshot {
  id      Int   @id @default(autoincrement())
  itemId  Int
  patchId Int
  data    Json                  // cost, stats, effect values
  item    Item  @relation(fields: [itemId], references: [id], onDelete: Cascade)
  patch   Patch @relation(fields: [patchId], references: [id], onDelete: Cascade)
  @@unique([itemId, patchId])
}

// ── Deferred: modelled now, populated later ────────────────────────────────
// M7. Our own curated edges, each with a required source link.
model Relationship {
  id        Int    @id @default(autoincrement())
  fromId    Int
  toId      Int
  type      String
  note      String?             // our own words
  sourceUrl String              // required: where the fact comes from
  from      Hero   @relation("From", fields: [fromId], references: [id], onDelete: Cascade)
  to        Hero   @relation("To",   fields: [toId],   references: [id], onDelete: Cascade)

  @@unique([fromId, toId, type])
}

model Faction {
  id        Int     @id @default(autoincrement())
  slug      String  @unique
  name      String
  summary   String?
  sourceUrl String?
}

model Location {
  id        Int     @id @default(autoincrement())
  slug      String  @unique
  name      String
  region    String?
  summary   String?
  sourceUrl String?
}

/// M8. Popularity input for Hero of the Patch (design.md section 3.5), from
/// /v1/analytics/hero-stats. Blocked on the same deferral as the formula.
model HeroPlayStat {
  id          Int      @id @default(autoincrement())
  heroId      Int
  windowStart DateTime
  windowEnd   DateTime
  matches     Int
  hero        Hero     @relation(fields: [heroId], references: [id], onDelete: Cascade)

  @@unique([heroId, windowStart, windowEnd])
}
```

**History design:** store a full snapshot per entity per ingested build, and compute diffs later in a query or at build time. Use `Json` columns for stats that change shape between builds; promote fields to columns only when you need to filter or sort on them. Re-running ingest at the same `clientVersion` must upsert, never duplicate.

**Deferred models:** `Voiceline` (blocked on the open question in `design.md`), and Phase 2 match and stats data (keep it in separate tables from reference data).

## 6. Pages and interactive features

Defined in `design.md` section 5 (pages) and section 6 (interaction patterns). Summary: Home dashboard, Heroes (directory and profile), Items (list, 5-second pin popover, item page), Patches (summaries), Lore (general), Relationships, Map (on hold), Stats and Esports (later phases).

## 7. Build order (opencode-sized tasks)

Work milestone by milestone. Finish and verify each before the next.

**M0: Scaffold and theme system**
- Next.js (App Router, TypeScript), Tailwind, Prisma 7 against Postgres from `docker-compose.yml`, folder layout above.
- Port the tokens from `design.md` section 2 into `src/styles/tokens.css`, register `--accent` and `--glow` with `@property`, and build `applyTheme` in `src/lib/theme.ts`.
- Header and footer from the mock, with the Valve disclaimer and the wiki credit line.
- *Done when:* the dev server shows an empty themed shell, the theme can be switched by calling `applyTheme`, and `prisma studio` opens.

**M1: Data pipeline**
- Build `fetch`, `normalize`, `load` for heroes, abilities (with the `HeroAbility` join) and items. Running the ingest twice must not create duplicates. Patch notes and diffing are deferred, but stamp every snapshot with the `clientVersion` it came from.
- Port `extractPalette` to TypeScript (`reference/extract_palette.py` is the prototype) and build `characters.ts` to read `data/characters/<Hero>/`, run it on the photo, and store `accent`, `accentText`, `onAccent`, `palette`.
- Seed four heroes from the mock and the character folders: Abrams, Celeste, Mina, Deadman Danny.
- *Done when:* heroes, abilities and items are in the database with palettes, and the computed accents are close to the mock's.

**M2: Hero profile and directory**
- Port the profile, switcher, and directory from `reference/deadlock-atlas.html`, data-driven. Credited wiki link cards replace lore text.
- Add a global `/abilities` index listing every ability across all heroes, alongside abilities on each hero page.
- *Done when:* every seeded hero has a page matching the mock, themed by its own palette, and the abilities index renders from data.

**M5: Items** *(promoted — patches are deferred, so items lead)*
- Items list, `ItemPopover` (hover and focus preview, pins after 5 seconds, touch opens pinned, Esc closes), item page themed by the item's own palette.
- *Done when:* the popover behavior matches `design.md` section 5.5 with mouse, keyboard, and touch.

**M7: Lore (general) and relationships**
- General lore landing and basic detail pages with credited links. Relationship graph from our own curated edges, each with a source URL.

**M9: Polish and deploy**
- Search, mobile layout, performance, accessibility pass, deployment.
- Art-forward backgrounds: use the API's unused character renders (`cardCritical`, `cardGloat`, `vertical`, `small`) and the `background` motif on the blank areas left by placeholder sections, the 3D fallback, directory cards and section headings (design.md 2.6). Decorative only, deterministic placement.

**M10: Ability reference rebuild (/abilities)**
- The M2 `/abilities` index is a flat alphabetical list (name, quip, owning hero). Rebuild it as a cross-hero reference grouped by what an ability does — damage, crowd control, mobility, healing, buff/debuff, and the genuinely shared universal abilities — so the page answers "which hero slows?" or "what does this status do?" rather than only "what is it called?"
- **Verify the categories against the real data first.** Derive groupings from ability properties (`css_class`, effect types) and the description HTML; do not hard-code a fixed list until the spread of categories is known.
- Show Valve's own description prose (`description.desc`) and the per-tier upgrade text (`t1_desc`/`t2_desc`/`t3_desc`). The API has a full description for 169 of the 176 released-hero signature abilities; the current page reads only `quip`. Derive the kind tag from `HeroAbility.slot` (not `Ability.kind`, which is only populated for universal abilities — 322 of 436 are null).
- Filter the universal list to the genuinely shared abilities (zip line, jump, slide, mantle, climb rope, zipline boost, dash, sprint, parry). The API's `hero: null` set includes hero internals (e.g. `citadel_ability_kali_spinning_blade`, `ability_boho_ridebroom`) which are not universal and must not be listed as such.
- Add search across every ability and hero.
- *Done when:* the page groups by function, shows description and tier text, searches across heroes, no hero-specific ability appears under universal, and categories were verified against the data.

**M11: Play data (pick rates, buy timing, ability max rates)**
- The Deadlock API's analytics endpoints are live and verified, but nothing in the site uses them yet. This milestone turns them into real features: item pick rates, when items are bought and upgraded, and which ability players max first.
- **M11a — analytics client, cache and rank brackets (the foundation).**
  - `src/lib/deadlock-api.ts`: typed fetchers for `/v1/analytics/item-stats`, `/v1/analytics/item-flow-stats`, `/v1/analytics/ability-max-first-stats`, `/v1/analytics/ability-order-stats`, and `/v1/analytics/hero-build-stats/{hero_id}`.
  - New Prisma model `AnalyticsSnapshot` keyed by `(endpoint, paramsHash, rankBracket)` with a `Json` payload and a `fetchedAt` timestamp. **Caching is required, not an optimisation:** the API rate-limits at 200 req/min per IP and `item-flow-stats` for a single hero is a 1.7 MB response. Refresh lazily on first request after expiry.
  - TTL is 24 hours. The data does not move meaningfully hour to hour.
  - `src/lib/rank-brackets.ts`: four **non-overlapping** brackets, labelled by rank name, derived from the API's own `/v1/analytics/badge-distribution`:

    | Bracket | Tiers | Measured share |
    | --- | --- | --- |
    | Initiate – Sentinel | 1–4 | 59.8% |
    | Mystic – Ritualist | 5–6 | 20.0% |
    | Emissary – Oracle | 7–8 | 15.6% |
    | Phantom – Eternus | 9–11 | 4.6% |

    These are the real measured shares, stable across a 30-day and a 13-month window. Do **not** label brackets with "top 5% / top 25%" style figures: those numbers do not match the API's distribution, and `min_average_badge` filters on the average badge of *both teams*, so a "top" bracket still contains lower-badge players. Show the measured share next to the bracket name.
  - A single global rank-bracket picker, visible on the pages that show play data, with the current bracket indicated.
- **M11b — item pick rates and buy timing.**
  - `/items`: each card shows its **pick rate** and **average buy time** as `mm:ss` plus the percentage into the match (the API gives `avg_buy_time_s` and `avg_buy_time_relative`). Pick rate is sortable.
  - Per item: the buy-time band (early / mid / late) derived from `item-flow-stats` phases, and the phase-to-phase transitions ("players who bought this next bought X").
- **M11c — ability max rates and upgrade order.**
  - Per ability, the share of players who **maxed that ability first**, split by bracket. The difference is large and worth showing: for one hero the top ability goes from 54% of all players to 79.6% of high-bracket players.
  - The typical upgrade order per hero, as the modal unlock sequence with per-upgrade timings (`avg_upgrade_times_s`).
  - Shown on the **hero page** as social proof ("maxed first by X% of high-bracket players") and on the **theorycraft page** as advice ("what to level, and when"). One shared component, two framings.
- **Win rate policy.** The API's win rates (and its net-worth-adjusted variant) are observational, not causal. Show them, but **never sort by them** — pick rate is the only sortable metric. A tooltip states that a high win rate reflects who buys the item, not that the item wins games.
- *Done when:* `/items` shows pick rate and buy timing with a working rank-bracket filter, hero pages show max-first rates and upgrade order per bracket, and every analytics response is served from the cache rather than hitting the API per request.

**M12: Popular builds**
- `/v1/analytics/hero-build-stats/{hero_id}` returns the community's named builds for a hero. Show them on the hero page with the items they use, and let the reader load a build straight into the theorycraft tool.
- Split out from M11 so M11 stays small and shippable. The theorycraft build model already lives in the URL (`?build=…&up=…`), so loading a build is a link, not a new state mechanism.
- *Done when:* a hero page lists the popular builds with their items, and "use this build" opens the theorycraft page with that build loaded.

**Deferred: patch work.** `Patch` stays in the schema as a build-version container so nothing needs backfilling when this resumes.

- **M3** (`PatchTimeline`, `DiffBox`, `ChangeRow`, `Badge`) — blocked.
- **M4** (Home dashboard) — blocked, and almost entirely patch-driven: Hero of the Patch banner, latest patch changes, patch timeline.
- **M6** (`/patches` list and patch pages) — blocked.
- **M8** (Hero of the Patch formula) — blocked twice over; it needs both change impact and play counts.

**Not scheduled:** Map (on hold) and the voiceline explorer (open question).

## 8. Suggested opencode workflow

- Put `AGENTS.md`, `design.md`, and this file in the repo root, and the mock and palette prototype in `reference/`, so the agent always has them in context.
- Tell it up front: server components by default, `"use client"` only for the widgets that need state or browser APIs.
- Give opencode one milestone at a time, with the "done when" line as the acceptance criterion.
- Ask it to **plan first, then implement** for anything touching the data schema.
- After each milestone: run the build, commit, then start the next.
- Keep schema changes deliberate; every change needs a Prisma migration and affects every query that touches it. Never edit applied migrations.
- Never import `src/lib/db.ts` from a `"use client"` file.
- Keep `AGENTS.md` short and pointed at `design.md`; do not duplicate rules in several places.
- Each milestone ends with: build passes, lint passes, the page is checked against the mock, and a commit.

## 9. Risks and open questions

- **Valve assets:** hero art, audio, and icons are Valve's. Check the Deadlock API's usage terms and Valve's policy for fan sites before self-hosting copies; hotlinking vs. self-hosting is a decision to make early.
- **Wiki content:** wiki text is CC BY-SA 4.0 (game content excluded). We link and credit rather than copy. Never paste wiki prose into data or components.
- **Voice lines:** the explorer is blocked until there is an allowed data source (`design.md` section 11, question 2).
- **Unreleased game:** heroes and content change or get removed often. The pipeline must be re-runnable, and removed content should be a first-class field.
- **API stability:** the community API can change or rate-limit. Always normalize into our own schema, and cache raw responses.
- **Analytics data is observational.** The `/v1/analytics` endpoints report what players did, not what caused it. Win rates in particular are confounded: players who are already ahead have more souls and buy items sooner. The API's `adjusted_win_rate` re-weights across net-worth buckets but remains observational. Never sort or rank by win rate, and never describe an item as "winning games".
- **Palette quality:** automatic extraction can pick a poor accent. The manual override field must always win.
- **Hero of the Patch formula:** incomplete by design. Do not build beyond the temporary rule before M8.
- **No structured changelog endpoint.** `/v2/patches` returns Steam and forum news as raw HTML with no per-entity data, and `/v1/assets/client-versions` is only a flat list of build numbers. There is no machine-readable diff, so per-hero and per-item changes must be computed by diffing our own snapshots across `clientVersion`s. This is the main reason M3, M4, M6 and M8 are deferred, and it should be proven on real data before any patch UI is built.
- **Item display names are often missing.** 230 of 633 entries in `/v1/assets/items` have `name === class_name`, mostly per-hero weapon sets such as `citadel_weapon_inferno_set`. `Item.nameSource` records whether a name came from the API, the class name, or a manual override, so the gap is reviewable rather than silent.
- **Abilities are shared between heroes.** 80 of 282 abilities are universal (`hero: null`) and appear on nearly every hero. Anything that assumes a hero owns its abilities will duplicate data and drift.
- **API ids overflow 32-bit integers.** Ability and item ids reach 4,284,855,775, so they are stored as strings.
- **The assets endpoint is large.** `/v1/assets/items` is about 4.4 MB in a single response. Use `/v1/assets/items/by-slot-type/{weapon|vitality|spirit}` and cache every response to `data/raw/`.
- **Local Postgres runs on port 5433, not 5432.** A Postgres under WSL already holds `127.0.0.1:5432` on this machine and its relay shadows Docker's published port on loopback, so the obvious `localhost:5432` reaches the wrong server and fails with an authentication error that looks like a bad password. Keep `docker-compose.yml` and `.env` in step.
- **Database access at build time:** pre-rendering needs the build environment to reach the database. Decide between a Node host with hosted Postgres (suits Phase 2) and exporting a static site from a local database.
- **Overlap with Deadlock.io:** review it first; decide whether to collaborate, borrow ideas, or stay separate.

## 10. Later phases (stubs only, don't build yet)

**Phase 2: Play data.** Hero pick/win rates, item popularity, buy timing and ability max rates, by rank bracket, from the Deadlock API. Shipped as M11 and M12 in section 7; the data lives on the existing item, hero and theorycraft pages rather than in a separate `/stats` section. Differentiator: link stats back to patch history ("why did this hero rise?") — still blocked on the patch work.

**Phase 3: Esports.** A `/esports` section: tournaments, results, rosters, player pages. Seed from Liquipedia-style public data and organizer results; scope to whatever the scene supports at the time.
