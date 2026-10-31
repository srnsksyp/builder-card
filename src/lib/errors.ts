// Custom errors let the API route tell "user not found" apart from "rate limited"
// and from "GitHub is down".

export type GitHubErrorKind = "not_found" | "rate_limited" | "unavailable" | "bad_response";

export class GitHubError extends Error {
  constructor(
    public readonly kind: GitHubErrorKind,
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Copy .env.example to .env.local and add your Neon connection string.");
    this.name = "DatabaseNotConfiguredError";
  }
}
