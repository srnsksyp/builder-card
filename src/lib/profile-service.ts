// Business logic for one search: cache -> GitHub -> database -> response.

import { REFRESH_COOLDOWN_MS, LEADING_LANGUAGE_COUNT, RECENT_EVENT_COUNT, TOP_REPOSITORY_COUNT, getCacheTtlMs } from "./config";
import { isDatabaseConfigured } from "./db";
import { readCachedCard, saveCard } from "./db/queries";
import { DatabaseNotConfiguredError, GitHubError } from "./errors";
import { fetchFromGitHub } from "./github/client";
import { eventLabel, rankRepositories, shouldUseCache, sortEventsNewestFirst, summarizeLanguages } from "./logic";
import type { CardData, CardMeta, FetchedData } from "./types";

function logError(context: string, error: unknown) {
  // Only name + message are logged: never headers, tokens, or connection strings.
  const text = error instanceof Error ? `${error.name}: ${error.message}` : "unknown error";
  console.error(`[builder-card] ${context}: ${text}`);
}

// Turns raw data into the shape the UI renders: ranked repos, language summary, labelled events.
export function buildCardData(data: FetchedData, meta: CardMeta): CardData {
  return {
    profile: data.profile,
    topRepositories: rankRepositories(data.repositories).slice(0, TOP_REPOSITORY_COUNT),
    languageSummary: summarizeLanguages(data.repositories, LEADING_LANGUAGE_COUNT),
    events: sortEventsNewestFirst(data.events)
      .slice(0, RECENT_EVENT_COUNT)
      .map((event) => ({ ...event, label: eventLabel(event.type) })),
    meta,
  };
}

async function loadCard(username: string, refresh: boolean): Promise<CardData> {
  // A missing database is a setup mistake, so fail loudly instead of pretending to save.
  if (!isDatabaseConfigured()) throw new DatabaseNotConfiguredError();

  // 1. Look for saved data. If the read fails we still continue with GitHub.
  let cached: Awaited<ReturnType<typeof readCachedCard>> = null;
  try {
    cached = await readCachedCard(username);
  } catch (error) {
    logError("database read failed", error);
  }

  // 2. Fresh enough? Return it without calling GitHub.
  if (cached && shouldUseCache({ fetchedAt: cached.fetchedAt, now: new Date(), ttlMs: getCacheTtlMs(), refresh, cooldownMs: REFRESH_COOLDOWN_MS })) {
    return buildCardData(cached, {
      source: "cache",
      fetchedAt: cached.fetchedAt,
      persisted: true,
      warning: null,
      repositoriesAnalyzed: cached.repositories.length,
    });
  }

  // 3. Ask GitHub. If it fails for a reason other than "no such user",
  //    fall back to older saved data when we have it.
  let fresh: FetchedData;
  try {
    fresh = await fetchFromGitHub(username);
  } catch (error) {
    if (error instanceof GitHubError && error.kind !== "not_found" && cached) {
      logError("GitHub failed, serving stale cache", error);
      return buildCardData(cached, {
        source: "stale-cache",
        fetchedAt: cached.fetchedAt,
        persisted: true,
        warning: `${error.message} Showing the last saved data instead.`,
        repositoriesAnalyzed: cached.repositories.length,
      });
    }
    throw error;
  }

  // 4. Save to Neon. If saving fails we still show the data, but say clearly it was not saved.
  const fetchedAt = new Date();
  let persisted = true;
  let warning: string | null = null;
  try {
    await saveCard(fresh, fetchedAt);
  } catch (error) {
    logError("database write failed", error);
    persisted = false;
    warning = "This data is live from GitHub but could not be saved to the database, so it will not be cached.";
  }

  return buildCardData(fresh, {
    source: "github",
    fetchedAt: fetchedAt.toISOString(),
    persisted,
    warning,
    repositoriesAnalyzed: fresh.repositories.length,
  });
}

// If the same username is requested twice at the same moment on one server instance,
// both callers share one promise (one GitHub call, one database write).
// This only de-duplicates in-flight work. It is not the cache; the database is the cache.
const inFlight = new Map<string, Promise<CardData>>();

export function getCard(username: string, refresh: boolean): Promise<CardData> {
  const key = `${username.toLowerCase()}:${refresh}`;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = loadCard(username, refresh).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
