import { describe, expect, it } from "vitest";
import {
  describeEvent,
  eventLabel,
  rankRepositories,
  shouldUseCache,
  sortEventsNewestFirst,
  summarizeLanguages,
} from "./logic";
import { formatRelativeTime } from "./utils";
import type { Repository } from "./types";

function repo(overrides: Partial<Repository> & { githubId: number }): Repository {
  return {
    name: `repo${overrides.githubId}`,
    fullName: `me/repo${overrides.githubId}`,
    description: null,
    language: null,
    stars: 0,
    forks: 0,
    url: "https://github.com/me/x",
    ...overrides,
  };
}

describe("rankRepositories", () => {
  it("sorts by stars descending", () => {
    const ranked = rankRepositories([repo({ githubId: 1, stars: 5 }), repo({ githubId: 2, stars: 50 }), repo({ githubId: 3, stars: 10 })]);
    expect(ranked.map((r) => r.githubId)).toEqual([2, 3, 1]);
  });

  it("breaks ties by full name ignoring case, then by id", () => {
    const ranked = rankRepositories([
      repo({ githubId: 1, stars: 3, fullName: "me/Zeta" }),
      repo({ githubId: 2, stars: 3, fullName: "me/alpha" }),
      repo({ githubId: 4, stars: 3, fullName: "me/same" }),
      repo({ githubId: 3, stars: 3, fullName: "me/same" }),
    ]);
    expect(ranked.map((r) => r.githubId)).toEqual([2, 3, 4, 1]);
  });

  it("does not change the input array", () => {
    const input = [repo({ githubId: 1, stars: 1 }), repo({ githubId: 2, stars: 2 })];
    rankRepositories(input);
    expect(input[0]?.githubId).toBe(1);
  });

  it("handles an empty list", () => {
    expect(rankRepositories([])).toEqual([]);
  });
});

describe("summarizeLanguages", () => {
  it("counts repositories per primary language, most common first", () => {
    const summary = summarizeLanguages(
      [
        repo({ githubId: 1, language: "TypeScript" }),
        repo({ githubId: 2, language: "Go" }),
        repo({ githubId: 3, language: "TypeScript" }),
        repo({ githubId: 4, language: null }),
      ],
      6,
    );
    expect(summary.languages).toEqual([
      { language: "TypeScript", repositories: 2 },
      { language: "Go", repositories: 1 },
    ]);
    expect(summary.reposWithLanguage).toBe(3);
    expect(summary.reposWithoutLanguage).toBe(1);
  });

  it("breaks count ties alphabetically and applies the limit", () => {
    const summary = summarizeLanguages(
      [repo({ githubId: 1, language: "Rust" }), repo({ githubId: 2, language: "C" }), repo({ githubId: 3, language: "Go" })],
      2,
    );
    expect(summary.languages.map((l) => l.language)).toEqual(["C", "Go"]);
    expect(summary.otherLanguages).toBe(1);
  });

  it("handles an empty repository list", () => {
    expect(summarizeLanguages([], 6)).toEqual({
      languages: [],
      otherLanguages: 0,
      reposWithLanguage: 0,
      reposWithoutLanguage: 0,
    });
  });
});

describe("event formatting", () => {
  it("uses a generic label for unknown event types", () => {
    expect(eventLabel("PushEvent")).toBe("Pushed commits");
    expect(eventLabel("SomethingNewEvent")).toBe("Other activity (SomethingNewEvent)");
  });

  it("describes a push using the branch and commit count", () => {
    expect(describeEvent("PushEvent", { ref: "refs/heads/main", size: 3 })).toBe("3 commits to main");
    expect(describeEvent("PushEvent", { ref: "refs/heads/dev", size: 1 })).toBe("1 commit to dev");
    expect(describeEvent("PushEvent", { ref: "refs/heads/dev" })).toBe("Pushed to dev");
  });

  it("describes issues, pull requests and creates", () => {
    expect(describeEvent("IssuesEvent", { action: "opened", issue: { number: 7, title: "Bug" } })).toBe("opened #7: Bug");
    expect(describeEvent("PullRequestEvent", { action: "closed", number: 9, pull_request: { title: "Fix" } })).toBe("closed #9: Fix");
    expect(describeEvent("CreateEvent", { ref_type: "branch", ref: "feature" })).toBe("branch feature");
  });

  it("returns null instead of guessing when data is missing or the type is unknown", () => {
    expect(describeEvent("PushEvent", {})).toBeNull();
    expect(describeEvent("PushEvent", null)).toBeNull();
    expect(describeEvent("WatchEvent", { action: "started" })).toBeNull();
    expect(describeEvent("UnknownEvent", { a: 1 })).toBeNull();
  });

  it("sorts events newest first", () => {
    const events = [
      { githubEventId: "1", type: "A", repoName: null, detail: null, createdAt: "2026-01-01T00:00:00Z" },
      { githubEventId: "2", type: "A", repoName: null, detail: null, createdAt: "2026-03-01T00:00:00Z" },
    ];
    expect(sortEventsNewestFirst(events).map((e) => e.githubEventId)).toEqual(["2", "1"]);
  });
});

describe("shouldUseCache", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  const base = { now, ttlMs: 15 * 60_000, cooldownMs: 60_000 };

  it("uses data younger than the TTL", () => {
    expect(shouldUseCache({ ...base, fetchedAt: "2026-10-31T11:50:00Z", refresh: false })).toBe(true);
  });

  it("does not use data older than the TTL", () => {
    expect(shouldUseCache({ ...base, fetchedAt: "2026-10-31T11:40:00Z", refresh: false })).toBe(false);
  });

  it("on refresh, ignores the TTL but still honours the short cooldown", () => {
    expect(shouldUseCache({ ...base, fetchedAt: "2026-10-31T11:50:00Z", refresh: true })).toBe(false);
    expect(shouldUseCache({ ...base, fetchedAt: "2026-10-31T11:59:30Z", refresh: true })).toBe(true);
  });

  it("treats an unreadable timestamp as not fresh", () => {
    expect(shouldUseCache({ ...base, fetchedAt: "garbage", refresh: false })).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  it("formats minutes, hours and days", () => {
    expect(formatRelativeTime("2026-10-31T11:55:00Z", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-10-31T09:00:00Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-10-29T12:00:00Z", now)).toBe("2 days ago");
    expect(formatRelativeTime("2026-10-31T11:59:50Z", now)).toBe("just now");
  });
});
