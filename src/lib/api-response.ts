// Builds JSON error responses. Clients only ever see our own short messages,
// never stack traces, tokens or connection strings.

import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError, GitHubError } from "./errors";
import type { ApiFailure } from "./types";

// The database is our cache, so browsers and CDNs should not cache API responses too.
export const NO_STORE = { "Cache-Control": "no-store" };

export function errorResponse(status: number, code: string, message: string, retryAfterSeconds?: number) {
  const body: ApiFailure = { ok: false, error: { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } };
  const headers: Record<string, string> = { ...NO_STORE };
  if (retryAfterSeconds) headers["Retry-After"] = String(retryAfterSeconds);
  return NextResponse.json(body, { status, headers });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof GitHubError) {
    switch (error.kind) {
      case "not_found":
        return errorResponse(404, "USER_NOT_FOUND", "No GitHub user with that username. Check the spelling and try again.");
      case "rate_limited":
        return errorResponse(429, "RATE_LIMITED", "GitHub's rate limit was reached. Wait a bit and try again.", error.retryAfterSeconds);
      default:
        return errorResponse(502, "GITHUB_UNAVAILABLE", "GitHub could not be reached or sent unexpected data. Try again shortly.");
    }
  }
  if (error instanceof DatabaseNotConfiguredError) {
    return errorResponse(503, "DATABASE_NOT_CONFIGURED", error.message);
  }
  console.error("[builder-card] unexpected error:", error instanceof Error ? error.name : "unknown");
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong on our side. Try again.");
}
