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
- Node 24 LTS. Prisma supports `^20.19 / ^22.12 / ^24`; odd-numbered Node
  releases are unsupported.
- SQLite via `@prisma/adapter-better-sqlite3` for now, Postgres via Docker
  Compose later. `docker-compose.yml` stays in the repo so the switch is small.
- The schema is deliberately Postgres-portable. Verified on SQLite: `Json`
  works, `enum` works (stored as `TEXT`), but scalar lists (`String[]`) are
  **not** supported (use `Json?`), filtering inside a `Json` column is not
  available, and `mode: "insensitive"` is not available. Promote any field we
  need to filter or sort on to a real column.

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

- `extractPalette` is the accent source. The API's `colors.style_hex` is stored
  as `apiAccent`, used as a fallback and as a drift check, never as the primary.
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
2. Set up Prisma 7 against SQLite for now, with a `docker-compose.yml` staged for Postgres later. Check the current Prisma docs rather than assuming setup details.
3. Port the tokens into `src/styles/tokens.css`, register `--accent` and `--glow` with `@property`, and write `applyTheme` in `src/lib/theme.ts`.
4. Build Header and Footer from the mock. Footer includes the Valve disclaimer and the wiki credit line.
5. Read the Deadlock API docs and list the real endpoints and response shapes you will use for heroes, abilities, items, and patches. Report them. Do not write ingest code yet.

Stop after step 5 and summarize what you built and what you found.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
