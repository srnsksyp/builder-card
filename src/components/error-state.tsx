import { CircleAlert } from "lucide-react";

type Props = {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  onRetry?: () => void;
};

// Short titles by error code. The message under the title explains how to fix it.
const TITLES: Record<string, string> = {
  INVALID_USERNAME: "That username isn't valid",
  USER_NOT_FOUND: "User not found",
  RATE_LIMITED: "GitHub rate limit reached",
  GITHUB_UNAVAILABLE: "GitHub didn't respond",
  DATABASE_NOT_CONFIGURED: "Database not configured",
  NETWORK_ERROR: "Connection problem",
};

function waitText(seconds: number): string {
  if (seconds < 90) return `about ${seconds} seconds`;
  return `about ${Math.ceil(seconds / 60)} minutes`;
}

export function ErrorState({ code, message, retryAfterSeconds, onRetry }: Props) {
  return (
    <div role="alert" className="mt-10 rounded-2xl border border-alert/40 bg-paper p-6">
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 shrink-0 text-alert" size={22} aria-hidden="true" />
        <div>
          <h2 className="font-display text-xl font-semibold">{TITLES[code] ?? "Something went wrong"}</h2>
          <p className="mt-1 text-muted">{message}</p>
          {retryAfterSeconds ? (
            <p className="mt-1 text-muted">GitHub says to wait {waitText(retryAfterSeconds)}.</p>
          ) : null}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-lg border border-spruce px-4 py-2 font-medium text-spruce hover:bg-spruce/10"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
