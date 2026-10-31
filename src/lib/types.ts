// Application-level types. These are shared by the server code and the React components.
// Dates are ISO-8601 strings so the same shape works in JSON and in the browser.

export type Profile = {
  githubId: number;
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  location: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  profileUrl: string;
};

export type Repository = {
  githubId: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
};

export type ActivityEvent = {
  githubEventId: string;
  type: string; // e.g. "PushEvent"
  repoName: string | null;
  detail: string | null; // short human-readable summary, built when the event is fetched
  createdAt: string;
};

// Everything we get from GitHub (or from our database cache) for one user.
export type FetchedData = {
  profile: Profile;
  repositories: Repository[];
  events: ActivityEvent[];
};

export type LanguageCount = { language: string; repositories: number };

export type LanguageSummary = {
  languages: LanguageCount[]; // leading languages only
  otherLanguages: number; // how many more distinct languages were not listed
  reposWithLanguage: number;
  reposWithoutLanguage: number;
};

export type DisplayEvent = ActivityEvent & { label: string };

// "github"      = fetched from GitHub just now
// "cache"       = recent data from our database (fresh enough, GitHub not called)
// "stale-cache" = GitHub failed, so older saved data is shown instead
export type DataSource = "github" | "cache" | "stale-cache";

export type CardMeta = {
  source: DataSource;
  fetchedAt: string;
  persisted: boolean; // false when the database write failed
  warning: string | null;
  repositoriesAnalyzed: number;
};

export type CardData = {
  profile: Profile;
  topRepositories: Repository[];
  languageSummary: LanguageSummary;
  events: DisplayEvent[];
  meta: CardMeta;
};

export type ApiSuccess = { ok: true; data: CardData };
export type ApiFailure = {
  ok: false;
  error: { code: string; message: string; retryAfterSeconds?: number };
};
export type ApiResponse = ApiSuccess | ApiFailure;
