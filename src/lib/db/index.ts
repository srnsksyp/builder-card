// Database connection. Uses Neon's HTTP driver: each query is one HTTPS request,
// so there are no long-lived connections to manage in a serverless environment.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { DatabaseNotConfiguredError } from "../errors";
import * as schema from "./schema";

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Created on first use (not at import time) so `next build` works without a database.
let cached: ReturnType<typeof createDb> | undefined;

function createDb(url: string) {
  return drizzle({ client: neon(url), schema });
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  cached ??= createDb(url);
  return cached;
}
