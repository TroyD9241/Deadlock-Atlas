import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton.
 *
 * SERVER CODE ONLY. Never import this from a `"use client"` file: the adapter
 * opens a real database connection and would be pulled into the browser
 * bundle. Components are server components by default; mark only interactive
 * widgets as `"use client"`.
 *
 * Prisma 7 requires an explicit driver adapter. We use `@prisma/adapter-pg`
 * against the Postgres from docker-compose.yml in development; in production
 * point DATABASE_URL at Neon or Supabase and nothing else changes here.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env, or start Postgres with `docker compose up -d`.",
    );
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Reuse the client across hot reloads in dev so we don't leak connections.
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}