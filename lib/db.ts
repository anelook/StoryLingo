import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client";

// DATABASE_URL="file:./dev.db" resolves relative to the prisma/ folder → prisma/dev.db
function dbUrl() {
  const raw = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
  const abs = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), "prisma", raw);
  return `file:${abs}`;
}

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  g.prisma ?? new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl() }) });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
