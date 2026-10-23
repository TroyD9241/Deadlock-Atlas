// Seed script placeholder. M1 (data pipeline) writes the real one.
//
// Run with: npm run db:seed

import "dotenv/config";

import { db } from "../src/lib/db";

async function main() {
  const patches = await db.patch.count();
  const heroes = await db.hero.count();
  const abilities = await db.ability.count();
  const items = await db.item.count();

  console.log(
    `Database reachable. patches=${patches} heroes=${heroes} abilities=${abilities} items=${items}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());