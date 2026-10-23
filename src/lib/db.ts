import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma client singleton.
 *
 * SERVER CODE ONLY. Never import this from a `"use client"` file: the adapter
 * opens a real filesystem connection and would be pulled into the browser
 * bundle. Components are server components by default; mark only interactive
 * widgets as `"use client"`.
 *
 * The adapter is required from Prisma 7 onwards. When we move to Postgres,
 * swap `PrismaBetterSqlite3` for `PrismaPg` and the connection string in
 * `.env` — nothing else in the app changes.
 */

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({ adapter });
}

// Reuse the client across hot reloads in dev so we don't leak connections.
export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}