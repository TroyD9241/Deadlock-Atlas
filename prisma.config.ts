import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * PostgreSQL. The local database comes from docker-compose.yml:
 *
 *   docker compose up -d
 *
 * To use a hosted database instead (Neon, Supabase), replace DATABASE_URL
 * in .env and run `npm run db:deploy`.
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