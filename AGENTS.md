# AGENTS.md: Deadlock Atlas

A fan-made, interactive Deadlock reference site. Read these before doing anything, in this order:

1. `design.md`: how the site looks and behaves. Source of truth for design.
2. `DEADLOCK_SITE_PLAN.md`: stack, data model, repo layout, milestones.
3. `reference/deadlock-atlas.html`: the working mock. Match it visually.

## Rules

- Work on one milestone at a time (see the plan). Stop and report when it is done.
- Do not change the visual language (flat dark panels, soft glows, Inter, pill buttons). If something is unclear, ask.
- Theme colors always come from CSS variables set by `applyTheme`. Never hard-code a hero's hex values in components.
- Prisma is called from server code only. Never import `src/lib/db.ts` from a `"use client"` file. Components are server components by default.
- Never copy wiki prose. Link to the wiki and credit it. Our own text is in our own words.
- Anything not verified against real data is shown in brackets, for example `[old value]`. Never invent stats, patch notes, or lore.
- Schema changes need a plan first and a Prisma migration. Never edit an applied migration.
- No accounts, no per-user data, no emoji, no new fonts or libraries without asking.
- Accessibility is required: 4.5:1 text contrast, 44px targets, visible focus, buff/nerf shown with arrow and label.
- Before finishing a task: build passes, lint passes, check the page against the mock, then commit.
- Not in scope yet: the interactive map, the voiceline explorer, the Hero of the Patch formula (placeholder rule only until M8), Stats and Esports.

## Locked decisions

Agreed after verifying the stack and the Deadlock API against live data. Do not
re-litigate these without asking.

**Stack**

- Prisma is pinned to `^7` (`prisma@7` + `@prisma/client@7`). `prisma@latest`
  now installs 8.x RC, which renames `schema.prisma` to `contract.prisma` and
  replaces `migrate dev` with `contract emit` + `migration plan` + `db migrate`.
  Anywhere a Prisma command is run outside the project (CI, one-off), use
  `npx prisma@7`.
- **Always use LTS runtimes.** Never pin an odd-numbered or pre-release
  runtime. Node LTS only (currently 24.x "Krypton"); Prisma supports
  `^20.19 / ^22.12 / ^24` and explicitly does not support odd-numbered
  "Current" releases. Python LTS-equivalent, which means a supported 3.x with
  a full bugfix cycle rather than the newest major. When either runtime
  releases a new LTS, upgrade to it and update the versions below.
- **Tooling that cannot install system-wide.** This machine cannot grant
  elevation, so installers that need UAC will hang. Install side by side with
  no elevation instead:
  - Node: unzip the official win-x64 archive to `%LOCALAPPDATA%\node24`, do
    not use the MSI. Prefix `$env:Path = "C:\Users\Troy\AppData\Local\node24;$env:Path"`.
  - Python: the nuget package
    (`https://www.nuget.org/api/v2/package/python/<version>`) unzipped to
    `%LOCALAPPDATA%\python315\tools`. It is a complete, portable interpreter
    with pip, and needs no admin. numpy and Pillow are installed into it for
    running `reference/extract_palette.py`.
- **PostgreSQL 17**, via `docker-compose.yml`, with `@prisma/adapter-pg`. Run
  `docker compose up -d` before any `db:*` script. Host port is **5433, not
  5432**: a Postgres under WSL already holds `127.0.0.1:5432` on this machine
  and its relay shadows Docker's published port on loopback, so 5432 reaches
  the wrong server. Change `docker-compose.yml` and `.env` together.
- Postgres was originally SQLite, switched in revision M0.5. Prisma Studio
  cannot open a SQLite `file:` URL in Prisma 7 — it rejects the protocol — so
  the M0 "prisma studio opens" criterion was unsatisfiable. Switching provider
  also forces a fresh migration history, so the earlier the switch the less
  history is discarded. The discarded SQLite history is kept at
  `prisma/archive/sqlite-migrations/`, never edited.
- Schema notes learned on SQLite and still true: `enum` works (stored as
  `TEXT`); `String[]` scalar lists are Postgres-only; filtering inside a `Json`
  column needs Postgres; `mode: "insensitive"` needs Postgres.

**Schema**

- `Ability` is split into `Ability` + `HeroAbility`. There are 282 distinct
  ability classes but 754 hero-to-ability references: 80 abilities have
  `hero: null` (Zip Line, Jump, Slide, Mantle) and are shared by every hero.
  An ability must never be owned by a single hero.
- `apiId` is `String` on `Ability` and `Item`. Their ids run up to
  4,284,855,775, which overflows Prisma's 32-bit `Int`. It stays `Int` on
  `Hero` (ids 1 to 50).
- `Item.slotType` (weapon/vitality/spirit) is what design.md calls the item's
  category. The API's `type` enum is a different axis and is only
  `ability`/`weapon`/`upgrade`.
- `Patch` is a build-version container only. Patch notes, per-patch diffs and
  `/patches` pages are deferred.
- `Item.nameSource` records whether a display name came from the API, was
  derived from the class name, or was set by hand. 230 of 633 items have
  `name === class_name` and no display name, mostly hero weapon sets.
- No `apiRaw` column. Raw API responses are cached in `data/raw/` for
  reproducibility; the database stores normalised fields only.

**Data rules**

- **`isReleased` comes from `heroes?only_active=true`, never from the
  `in_development` flag.** That flag lags: at build 6819 it still marks **Baba
  and Violet** as in development when both are live and playable. The
  `only_active` list returns exactly the 44 heroes we hold artwork for, with no
  extras and none missing, which is how the discrepancy was caught. Keep
  `isDisabled` and `isInDevelopment` as recorded truth so the lag stays visible
  rather than hidden behind the derived column. The API also leaks a literal
  `hero_testhero` record, which is stored but never released.
- **The API's `style_hex` is the hero accent.** It is Valve's own UI
  colour, so it is authoritative, and all 44 released heroes have one.
  Precedence for a hero is: manual override, then `style_hex`, then
  `extractPalette`, then the site default. A hero with essentially zero chroma
  (Sinclair is `#6B6B6B`, chroma 0.0) falls back to the site default accent and
  is flagged `needsReview`, per design.md 3.4.
- **Items have no colour in the API at all.** Zero colour fields across all 781
  item records, so `extractPalette` on the item icon remains the only source for
  item themes. That is why the function is kept despite heroes no longer
  depending on it.
- On hero pages, our own words come first and Valve's official
  `description.lore`/`playstyle`/`role` from the API is shown below it, clearly
  labelled. This is official game content, so the "never copy wiki prose" rule
  does not apply to it. The wiki is still linked and credited for lore detail.

**Scope**

- Patches are deferred. No patch diffing, no `/patches` pages, no Hero of the
  Patch. This defers M3, M4 and M6, and blocks design.md 3.5 twice over (it
  needs both change impact and play counts). M8 is blocked behind the same
  decision. Build order is now M0, M1, M2 hero profile, items, mechanics, then
  patches.
- M2 gains a global `/abilities` index route listing every ability across all
  heroes, in addition to abilities on each hero page.

## First session

Do M0 only, then the "check the API docs" step of M1:

1. Scaffold Next.js (App Router, TypeScript) with Tailwind and the folder layout in the plan.
2. Set up Prisma 7 against Postgres. Check the current Prisma docs rather than assuming setup details.
3. Port the tokens into `src/styles/tokens.css`, register `--accent` and `--glow` with `@property`, and write `applyTheme` in `src/lib/theme.ts`.
4. Build Header and Footer from the mock. Footer includes the Valve disclaimer and the wiki credit line.
5. Read the Deadlock API docs and list the real endpoints and response shapes you will use for heroes, abilities, items, and patches. Report them. Do not write ingest code yet.

Stop after step 5 and summarize what you built and what you found.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
