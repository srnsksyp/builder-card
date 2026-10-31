// Tunable policy values live here so they are easy to find and explain.

const DEFAULT_CACHE_TTL_MINUTES = 15;

// How long saved data counts as "fresh". Override with CACHE_TTL_MINUTES.
export function getCacheTtlMs(): number {
  const minutes = Number(process.env.CACHE_TTL_MINUTES);
  const valid = Number.isFinite(minutes) && minutes > 0;
  return (valid ? minutes : DEFAULT_CACHE_TTL_MINUTES) * 60_000;
}

// Even when the user clicks Refresh, data fetched less than this long ago is reused.
// This stops repeated clicks from burning through GitHub's rate limit.
export const REFRESH_COOLDOWN_MS = 60_000;

export const TOP_REPOSITORY_COUNT = 5;
export const LEADING_LANGUAGE_COUNT = 6;
export const RECENT_EVENT_COUNT = 10;
