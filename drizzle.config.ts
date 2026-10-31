import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next.js reads .env.local, so drizzle-kit reads it too (then falls back to .env).
config({ path: ".env.local" });
config();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
