/**
 * Database smoke test.
 *
 * Run with: npm run check:db  (after `docker compose up -d`)
 *
 * Proves the model actually round-trips against the live database: nested
 * Json, Json array columns, relations, and case-insensitive matching (which
 * SQLite could not do). Writes one throwaway Hero and Patch, then removes them.
 *
 * Refuses to run against anything that is not a local database, so it can
 * never mutate a hosted or production one.
 */
import "dotenv/config";

import { db } from "../src/lib/db";

const url = process.env.DATABASE_URL ?? "";

function assertLocal() {
  const host = new URL(url).hostname;
  const local = ["localhost", "127.0.0.1", "::1", "host.docker.internal"];
  if (!local.includes(host)) {
    console.error(
      `check:db refuses to run against ${host}. It writes and deletes rows. Point DATABASE_URL at the local docker-compose database.`,
    );
    process.exit(1);
  }
}

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${detail !== undefined ? `  ${JSON.stringify(detail)}` : ""}`);
}

async function main() {
  assertLocal();

  const SLUG = "zz-check-db-smoke-test";

  // Remove only our own leftovers. Never deleteMany(): this table holds the
  // real ingest, and an earlier version of this script wiped it.
  await db.hero.deleteMany({ where: { slug: SLUG } });

  const hero = await db.hero.create({
    data: {
      slug: SLUG,
      apiId: 99999,
      name: "Smoke Test",
      palette: ["#1b1d2a", "#3b204c", "#8a6fa8", "#c09fc8", "#f4f2f8"],
      tags: ["support", "disruptive"],
    },
  });

  await db.patch.create({
    data: {
      clientVersion: 99999,
      isCurrent: false, // never mark the real build non-current
      heroSnapshots: {
        create: [
          { heroId: hero.id, stats: { max_health: 650, nested: { a: [1, 2, 3] } } },
        ],
      },
    },
  });

  const read = await db.patch.findUnique({
    where: { clientVersion: 99999 },
    include: { heroSnapshots: true },
  });
  const heroRead = await db.hero.findUnique({ where: { id: hero.id } });
  const stats = read?.heroSnapshots[0]?.stats as
    | { max_health: number; nested: { a: number[] } }
    | undefined;

  check("Patch readable with relation", read !== null);
  check("HeroSnapshot joined", read?.heroSnapshots.length === 1);
  check("Json scalar survived", stats?.max_health === 650);
  check("nested Json array survived", Array.isArray(stats?.nested.a) && stats?.nested.a[2] === 3);
  check("palette Json array survived", Array.isArray(heroRead?.palette) && heroRead.palette.length === 5);
  check("tags Json array survived", Array.isArray(heroRead?.tags) && heroRead.tags.length === 2);

  // The capability SQLite could not provide.
  const insensitive = await db.hero.findMany({
    where: { name: { equals: "smoke test", mode: "insensitive" } },
  });
  check("case-insensitive match works", insensitive.length === 1, `rows=${insensitive.length}`);

  // Unique constraint must actually bite, or upserts in M1 would duplicate.
  let uniqueHeld = false;
  try {
    await db.hero.create({ data: { slug: SLUG, name: "Dupe" } });
  } catch {
    uniqueHeld = true;
  }
  check("unique constraint enforced", uniqueHeld);

  // Clean up only our own rows. The snapshot goes with the patch cascade.
  await db.patch.deleteMany({ where: { clientVersion: 99999 } });
  await db.hero.deleteMany({ where: { slug: SLUG } });

  const left = await db.hero.count({ where: { slug: SLUG } });
  check("cleanup left no rows", left === 0, `heroes=${left}`);

  console.log("");
  if (failures === 0) {
    console.log("All database checks passed.");
  } else {
    console.log(`${failures} database check(s) failed.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    failures += 1;
  })
  .finally(async () => {
    await db.$disconnect();
    if (failures > 0) process.exit(1);
  });