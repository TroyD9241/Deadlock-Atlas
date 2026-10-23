import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * SQLite for now; the schema is kept Postgres-portable so the switch is a
 * one-line provider change plus a `migrate diff`. See DEADLOCK_SITE_PLAN.md
 * section 5.
 *
 * When moving to Postgres, replace the url below with the Docker Compose
 * connection string and generate the diff:
 *   npx prisma migrate diff --from-url file:./prisma/dev.db \
 *     --to-url "$DATABASE_URL" --script
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});