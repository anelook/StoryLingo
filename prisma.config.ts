import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ path: ".env.local" });
loadEnv();

// DATABASE_URL="file:./dev.db" is resolved relative to the prisma/ folder → prisma/dev.db
const raw = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const abs = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), "prisma", raw);

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: `file:${abs}` },
});
