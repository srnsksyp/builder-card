// The only file that talks to the GitHub REST API.
// It fetches, validates, and converts GitHub's snake_case JSON into our own types.

import type { z } from "zod";
import { GitHubError } from "../errors";
import { describeEvent } from "../logic";
import type { ActivityEvent, FetchedData, Profile, Repository } from "../types";
import {
  eventListSchema,
  repositoryListSchema,
  userSchema,
  type GitHubEvent,
  type GitHubRepository,
  type GitHubUser,
} from "./schemas";

const GITHUB_API = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 8_000;
const REPOS_PER_PAGE = 100;
export const MAX_REPO_PAGES = 3; // at most 300 repositories are read
const EVENTS_PER_PAGE = 30;

// ---------- Mapping: GitHub JSON -> application types ----------
export function mapProfile(user: GitHubUser): Profile {
  return {
    githubId: user.id,
    username: user.login,
    name: user.name ?? null,
    avatarUrl: user.avatar_url,
    bio: user.bio ?? null,
    location: user.location ?? null,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    profileUrl: user.html_url,
  };
}

// Forks are skipped so a forked project does not count as the user's own work.
export function mapRepositories(repos: GitHubRepository[]): Repository[] {
  return repos
    .filter((repo) => !repo.fork)
    .map((repo) => ({
      githubId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description ?? null,
      language: repo.language ?? null,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      url: repo.html_url,
    }));
}

// Events without a timestamp cannot be shown or stored, so they are dropped.
export function mapEvents(events: GitHubEvent[]): ActivityEvent[] {
  const mapped: ActivityEvent[] = [];
  for (const event of events) {
    if (!event.created_at) continue;
    mapped.push({
      githubEventId: event.id,
      type: event.type,
      repoName: event.repo?.name ?? null,
      detail: describeEvent(event.type, event.payload),
      createdAt: event.created_at,
    });
  }
  return mapped;
}

// ---------- HTTP ----------
// How many seconds until we may retry, based on GitHub's headers.
function retryAfterSeconds(response: Response): number | undefined {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.ceil(retryAfter);

  const reset = Number(response.headers.get("x-ratelimit-reset")); // epoch seconds
  if (Number.isFinite(reset) && reset > 0) {
    return Math.max(1, Math.ceil(reset - Date.now() / 1000));
  }
  return undefined;
}

function isRateLimited(response: Response): boolean {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  return response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after");
}

// One GET request. No automatic retries, so there is nothing that can loop forever.
async function githubGet(path: string): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "builder-card",
  };
  // The token stays on the server. It is never sent to the browser or logged.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let response: Response;
  try {
    response = await fetch(`${GITHUB_API}${path}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new GitHubError("unavailable", "Could not reach GitHub (network error or timeout).");
  }

  if (response.ok) {
    try {
      return await response.json();
    } catch {
      throw new GitHubError("bad_response", "GitHub returned a response that was not valid JSON.");
    }
  }

  if (response.status === 404) throw new GitHubError("not_found", "No GitHub user with that username.");

  if (isRateLimited(response)) {
    throw new GitHubError("rate_limited", "GitHub's API rate limit was reached.", retryAfterSeconds(response));
  }

  throw new GitHubError("unavailable", `GitHub responded with an error (HTTP ${response.status}).`);
}

// Checks the JSON against a Zod schema and throws our own error if it does not match.
function validate<T extends z.ZodType>(schema: T, data: unknown, what: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new GitHubError("bad_response", `GitHub returned unexpected data for ${what}.`);
  }
  return result.data;
}

// ---------- Public functions ----------
export async function fetchProfile(username: string): Promise<Profile> {
  const raw = await githubGet(`/users/${encodeURIComponent(username)}`);
  return mapProfile(validate(userSchema, raw, "the profile"));
}

export async function fetchRepositories(username: string): Promise<Repository[]> {
  const all: GitHubRepository[] = [];
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const raw = await githubGet(
      `/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&per_page=${REPOS_PER_PAGE}&page=${page}`,
    );
    const repos = validate(repositoryListSchema, raw, "repositories");
    all.push(...repos);
    if (repos.length < REPOS_PER_PAGE) break; // last page reached
  }
  return mapRepositories(all);
}

export async function fetchEvents(username: string): Promise<ActivityEvent[]> {
  const raw = await githubGet(`/users/${encodeURIComponent(username)}/events/public?per_page=${EVENTS_PER_PAGE}`);
  return mapEvents(validate(eventListSchema, raw, "public events"));
}

// Profile first: an unknown username fails after 1 request instead of 3.
// Then repositories and events are fetched in parallel.
export async function fetchFromGitHub(username: string): Promise<FetchedData> {
  const profile = await fetchProfile(username);
  const [repositories, events] = await Promise.all([fetchRepositories(username), fetchEvents(username)]);
  return { profile, repositories, events };
}
