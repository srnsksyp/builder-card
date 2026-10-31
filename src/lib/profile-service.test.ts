import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseNotConfiguredError, GitHubError } from "./errors";
import type { FetchedData } from "./types";

// The service is tested with fake GitHub and database modules, so no network is needed.
vi.mock("./db", () => ({ isDatabaseConfigured: vi.fn() }));
vi.mock("./db/queries", () => ({ readCachedCard: vi.fn(), saveCard: vi.fn() }));
vi.mock("./github/client", () => ({ fetchFromGitHub: vi.fn() }));

import { isDatabaseConfigured } from "./db";
import { readCachedCard, saveCard } from "./db/queries";
import { fetchFromGitHub } from "./github/client";
import { getCard } from "./profile-service";

const data: FetchedData = {
  profile: {
    githubId: 1,
    username: "octocat",
    name: null,
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
    bio: null,
    location: null,
    publicRepos: 0,
    followers: 0,
    following: 0,
    profileUrl: "https://github.com/octocat",
  },
  repositories: [],
  events: [],
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isDatabaseConfigured).mockReturnValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getCard", () => {
  it("fails with a clear error when the database is not configured", async () => {
    vi.mocked(isDatabaseConfigured).mockReturnValue(false);
    await expect(getCard("octocat", false)).rejects.toBeInstanceOf(DatabaseNotConfiguredError);
    expect(fetchFromGitHub).not.toHaveBeenCalled();
  });

  it("returns fresh cached data without calling GitHub", async () => {
    vi.mocked(readCachedCard).mockResolvedValue({ ...data, fetchedAt: minutesAgo(2) });
    const card = await getCard("octocat", false);
    expect(card.meta.source).toBe("cache");
    expect(fetchFromGitHub).not.toHaveBeenCalled();
    expect(saveCard).not.toHaveBeenCalled();
  });

  it("calls GitHub and saves when the cache is stale", async () => {
    vi.mocked(readCachedCard).mockResolvedValue({ ...data, fetchedAt: minutesAgo(60) });
    vi.mocked(fetchFromGitHub).mockResolvedValue(data);
    const card = await getCard("octocat", false);
    expect(card.meta.source).toBe("github");
    expect(card.meta.persisted).toBe(true);
    expect(saveCard).toHaveBeenCalledOnce();
  });

  it("refresh bypasses a fresh cache once the cooldown has passed", async () => {
    vi.mocked(readCachedCard).mockResolvedValue({ ...data, fetchedAt: minutesAgo(5) });
    vi.mocked(fetchFromGitHub).mockResolvedValue(data);
    const card = await getCard("octocat", true);
    expect(card.meta.source).toBe("github");
  });

  it("serves stale saved data when GitHub is rate limited", async () => {
    vi.mocked(readCachedCard).mockResolvedValue({ ...data, fetchedAt: minutesAgo(60) });
    vi.mocked(fetchFromGitHub).mockRejectedValue(new GitHubError("rate_limited", "Rate limit reached."));
    const card = await getCard("octocat", false);
    expect(card.meta.source).toBe("stale-cache");
    expect(card.meta.warning).toContain("Rate limit reached.");
  });

  it("does not serve cached data when the user no longer exists", async () => {
    vi.mocked(readCachedCard).mockResolvedValue({ ...data, fetchedAt: minutesAgo(60) });
    vi.mocked(fetchFromGitHub).mockRejectedValue(new GitHubError("not_found", "No user."));
    await expect(getCard("octocat", false)).rejects.toMatchObject({ kind: "not_found" });
  });

  it("throws GitHub errors when there is nothing cached to fall back on", async () => {
    vi.mocked(readCachedCard).mockResolvedValue(null);
    vi.mocked(fetchFromGitHub).mockRejectedValue(new GitHubError("unavailable", "Down."));
    await expect(getCard("octocat", false)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("still returns live data, flagged as not saved, when the database write fails", async () => {
    vi.mocked(readCachedCard).mockResolvedValue(null);
    vi.mocked(fetchFromGitHub).mockResolvedValue(data);
    vi.mocked(saveCard).mockRejectedValue(new Error("connection refused"));
    const card = await getCard("octocat", false);
    expect(card.meta.source).toBe("github");
    expect(card.meta.persisted).toBe(false);
    expect(card.meta.warning).toContain("could not be saved");
  });

  it("continues to GitHub when the database read fails", async () => {
    vi.mocked(readCachedCard).mockRejectedValue(new Error("timeout"));
    vi.mocked(fetchFromGitHub).mockResolvedValue(data);
    const card = await getCard("octocat", false);
    expect(card.meta.source).toBe("github");
  });

  it("shares one GitHub call between identical simultaneous requests", async () => {
    vi.mocked(readCachedCard).mockResolvedValue(null);
    vi.mocked(fetchFromGitHub).mockResolvedValue(data);
    await Promise.all([getCard("octocat", false), getCard("OctoCat", false)]);
    expect(fetchFromGitHub).toHaveBeenCalledTimes(1);
  });
});
