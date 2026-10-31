import { formatAbsoluteTime, formatRelativeTime } from "@/lib/utils";
import type { DisplayEvent } from "@/lib/types";

// Only link repo names that look like "owner/name".
const REPO_NAME_PATTERN = /^[\w.-]+\/[\w.-]+$/;

export function ActivityList({ events }: { events: DisplayEvent[] }) {
  return (
    <section aria-labelledby="activity-heading" className="rounded-2xl border border-line bg-paper p-6">
      <h2 id="activity-heading" className="font-display text-xl font-semibold">
        Recent Public Activity
      </h2>
      <p className="mt-1 text-sm text-muted">
        Public events only. Private work and older history are not included.
      </p>

      {events.length === 0 ? (
        <p className="mt-6 text-muted">No recent public activity for this user.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {events.map((event) => (
            <li key={event.githubEventId} className="py-3 first:pt-0 last:pb-0">
              <p className="font-medium">{event.label}</p>
              {event.detail && <p className="text-sm">{event.detail}</p>}
              <p className="mt-0.5 text-sm text-muted">
                {event.repoName &&
                  (REPO_NAME_PATTERN.test(event.repoName) ? (
                    <a
                      href={`https://github.com/${event.repoName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-spruce underline underline-offset-2"
                    >
                      {event.repoName}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    event.repoName
                  ))}
                {event.repoName && " · "}
                <time dateTime={event.createdAt} title={formatAbsoluteTime(event.createdAt)}>
                  {formatRelativeTime(event.createdAt)}
                </time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
