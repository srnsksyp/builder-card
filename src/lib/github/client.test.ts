import { afterEach, describe, expect, it, vi } from "vitest";
import { GitHubError } from "../errors";
import { MAX_REPO_PAGES, fetchProfile, fetchRepositories, mapEvents, mapProfile } from "./client";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

const validUser = {
  id: 1,
  login: "octocat",
  name: null,
  avatar_url: "https://avatars.githubusercontent.com/u/1",
  bio: null,
  location: null,
  public_repos: 2,
  followers: 3,
  following: 4,
  html_url: "https://github.com/octocat",
};

function rawRepo(id: number, fork = false) {
  return {
    id,
    name: `r${id}`,
    full_name: `octocat/r${id}`,
    description: null,
    language: null,
    stargazers_count: id,
    forks_count: 0,
    html_url: `https://github.com/octocat/r${id}`,
    fork,
  };
}

afterEach(() => vi.unstubAllGlobals());

async function failureOf(promise: Promise<unknown>): Promise<GitHubError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GitHubError);
    return error as GitHubError;
  }
  throw new Error("expected the promise to reject");
}

describe("mapProfile", () => {
  it("turns missing optional fields into null instead of inventing values", () => {
    const profile = mapProfile({ ...validUser, name: undefined, bio: undefined, location: undefined });
    expect(profile.name).toBeNull();
    expect(profile.bio).toBeNull();
    expect(profile.location).toBeNull();
    expect(profile.username).toBe("octocat");
  });
});

describe("mapEvents", () => {
  it("drops events without a timestamp and keeps missing repos as null", () => {
    const events = mapEvents([
      { id: "1", type: "WatchEvent", created_at: "2026-01-01T00:00:00Z" },
      { id: "2", type: "WatchEvent", created_at: null },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]?.repoName).toBeNull();
  });
});

describe("GitHub API errors", () => {
  it("maps 404 to not_found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    expect((await failureOf(fetchProfile("nobody"))).kind).toBe("not_found");
  });

  it("maps 403 with no remaining quota to rate_limited and reads the reset time", async () => {
    const reset = Math.floor(Date.now() / 1000) + 120;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) } }),
      ),
    );
    const error = await failureOf(fetchProfile("octocat"));
    expect(error.kind).toBe("rate_limited");
    expect(error.retryAfterSeconds).toBeGreaterThan(100);
  });

  it("maps 429 with Retry-After to rate_limited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429, headers: { "retry-after": "30" } })));
    const error = await failureOf(fetchProfile("octocat"));
    expect(error.kind).toBe("rate_limited");
    expect(error.retryAfterSeconds).toBe(30);
  });

  it("treats a 403 that is not about rate limits as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "50" } })));
    expect((await failureOf(fetchProfile("octocat"))).kind).toBe("unavailable");
  });

  it("maps 500 and network failures to unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    expect((await failureOf(fetchProfile("octocat"))).kind).toBe("unavailable");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect((await failureOf(fetchProfile("octocat"))).kind).toBe("unavailable");
  });

  it("rejects JSON that does not match the expected shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ id: "not-a-number" })));
    expect((await failureOf(fetchProfile("octocat"))).kind).toBe("bad_response");
  });

  it("never sends the token unless one is configured", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(validUser)));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GITHUB_TOKEN", "");
    await fetchProfile("octocat");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).not.toHaveProperty("Authorization");

    vi.stubEnv("GITHUB_TOKEN", "test-token");
    await fetchProfile("octocat");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toHaveProperty("Authorization", "Bearer test-token");
    vi.unstubAllEnvs();
  });
});

describe("fetchRepositories", () => {
  it("returns an empty list when the user has no repositories", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
    expect(await fetchRepositories("octocat")).toEqual([]);
  });

  it("skips forks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([rawRepo(1), rawRepo(2, true)])));
    const repos = await fetchRepositories("octocat");
    expect(repos.map((r) => r.githubId)).toEqual([1]);
  });

  it("stops after the maximum number of pages even if GitHub keeps returning full pages", async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => rawRepo(i + 1));
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(fullPage)));
    vi.stubGlobal("fetch", fetchMock);
    await fetchRepositories("octocat");
    expect(fetchMock).toHaveBeenCalledTimes(MAX_REPO_PAGES);
  });
});
