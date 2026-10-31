// Pure business logic: no network, no database. That makes it easy to test and explain.

import type { ActivityEvent, LanguageSummary, Repository } from "./types";

// ---------- Repository ranking ----------
// Rule: most stars first. Ties are broken by repository full name (A to Z, ignoring case),
// then by GitHub's numeric repository ID, so the order is always the same for the same input.
export function rankRepositories(repositories: Repository[]): Repository[] {
  return [...repositories].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    const nameA = a.fullName.toLowerCase();
    const nameB = b.fullName.toLowerCase();
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    return a.githubId - b.githubId;
  });
}

// ---------- Language aggregation ----------
// Counts how many repositories list each language as their primary language.
// This is NOT a share of code written: a tiny repo counts the same as a huge one.
export function summarizeLanguages(repositories: Repository[], limit: number): LanguageSummary {
  const counts = new Map<string, number>();
  let reposWithoutLanguage = 0;

  for (const repo of repositories) {
    if (!repo.language) {
      reposWithoutLanguage += 1;
      continue;
    }
    counts.set(repo.language, (counts.get(repo.language) ?? 0) + 1);
  }

  const sorted = [...counts.entries()]
    .map(([language, repositories]) => ({ language, repositories }))
    .sort((a, b) => b.repositories - a.repositories || a.language.localeCompare(b.language, "en"));

  return {
    languages: sorted.slice(0, limit),
    otherLanguages: Math.max(0, sorted.length - limit),
    reposWithLanguage: repositories.length - reposWithoutLanguage,
    reposWithoutLanguage,
  };
}

// ---------- Event formatting ----------
const EVENT_LABELS: Record<string, string> = {
  PushEvent: "Pushed commits",
  CreateEvent: "Created",
  DeleteEvent: "Deleted",
  WatchEvent: "Starred a repository",
  ForkEvent: "Forked a repository",
  IssuesEvent: "Issue activity",
  IssueCommentEvent: "Commented on an issue",
  PullRequestEvent: "Pull request activity",
  PullRequestReviewEvent: "Reviewed a pull request",
  ReleaseEvent: "Release activity",
  PublicEvent: "Made a repository public",
};

// Unknown event types get a generic label. We never guess what happened.
export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? `Other activity (${type})`;
}

// Safe readers for the untyped "payload" object from the GitHub events API.
function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function readObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function branchName(ref: unknown): string | null {
  const text = readString(ref);
  return text ? text.replace(/^refs\/heads\//, "") : null;
}

// Builds a short detail line from the fields the API actually returned.
// Returns null when the payload has nothing useful to show.
export function describeEvent(type: string, payload: unknown): string | null {
  const data = readObject(payload);
  if (!data) return null;

  switch (type) {
    case "PushEvent": {
      const branch = branchName(data.ref);
      const count = readNumber(data.size) ?? (Array.isArray(data.commits) ? data.commits.length : null);
      if (count !== null && branch) return `${count} commit${count === 1 ? "" : "s"} to ${branch}`;
      if (branch) return `Pushed to ${branch}`;
      return null;
    }
    case "CreateEvent":
    case "DeleteEvent": {
      const refType = readString(data.ref_type);
      const ref = readString(data.ref);
      if (!refType) return null;
      return ref ? `${refType} ${ref}` : refType;
    }
    case "ForkEvent": {
      const forkee = readObject(data.forkee);
      const fullName = forkee ? readString(forkee.full_name) : null;
      return fullName ? `Fork created at ${fullName}` : null;
    }
    case "IssuesEvent": {
      const issue = readObject(data.issue);
      const action = readString(data.action);
      const number = issue ? readNumber(issue.number) : null;
      const title = issue ? readString(issue.title) : null;
      if (!action || number === null) return null;
      return title ? `${action} #${number}: ${truncate(title, 80)}` : `${action} #${number}`;
    }
    case "IssueCommentEvent": {
      const issue = readObject(data.issue);
      const number = issue ? readNumber(issue.number) : null;
      return number !== null ? `On #${number}` : null;
    }
    case "PullRequestEvent":
    case "PullRequestReviewEvent": {
      const pr = readObject(data.pull_request);
      const number = readNumber(data.number) ?? (pr ? readNumber(pr.number) : null);
      const action = readString(data.action);
      const title = pr ? readString(pr.title) : null;
      if (number === null) return null;
      const prefix = action ? `${action} #${number}` : `#${number}`;
      return title ? `${prefix}: ${truncate(title, 80)}` : prefix;
    }
    case "ReleaseEvent": {
      const release = readObject(data.release);
      const tag = release ? readString(release.tag_name) : null;
      const action = readString(data.action);
      if (!tag) return null;
      return action ? `${action} ${tag}` : tag;
    }
    default:
      return null;
  }
}

// ---------- Cache policy ----------
// Decides whether saved data can be reused instead of calling GitHub.
//  - Normal visit: reuse if the data is younger than the TTL.
//  - Explicit refresh: reuse only if the data is younger than the short cooldown.
export function shouldUseCache(options: {
  fetchedAt: string;
  now: Date;
  ttlMs: number;
  refresh: boolean;
  cooldownMs: number;
}): boolean {
  const fetchedTime = new Date(options.fetchedAt).getTime();
  if (Number.isNaN(fetchedTime)) return false;
  const ageMs = options.now.getTime() - fetchedTime;
  if (ageMs < 0) return true; // clock skew: treat as just fetched
  const allowedAgeMs = options.refresh ? options.cooldownMs : options.ttlMs;
  return ageMs < allowedAgeMs;
}

// Newest events first.
export function sortEventsNewestFirst(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
