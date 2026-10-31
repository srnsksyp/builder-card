import { ExternalLink, GitFork, Star } from "lucide-react";
import { formatCount } from "@/lib/utils";
import type { Repository } from "@/lib/types";

type Props = { repositories: Repository[]; analyzed: number };

export function RepositoryList({ repositories, analyzed }: Props) {
  return (
    <section aria-labelledby="repos-heading" className="rounded-2xl border border-line bg-paper p-6 md:col-span-3">
      <h2 id="repos-heading" className="font-display text-xl font-semibold">
        Top Repositories by Stars
      </h2>
      <p className="mt-1 text-sm text-muted">
        Ranked by star count, then name. Forks are left out. Based on {analyzed} original public{" "}
        {analyzed === 1 ? "repository" : "repositories"}.
      </p>

      {repositories.length === 0 ? (
        <p className="mt-6 text-muted">This user has no original public repositories yet.</p>
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {repositories.map((repo) => (
            <li key={repo.githubId} className="py-4 first:pt-0 last:pb-0">
              <a
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-spruce underline underline-offset-2"
              >
                {repo.name}
                <ExternalLink size={14} aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
              <p className="mt-1 text-sm">{repo.description ?? <span className="text-muted">No description.</span>}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                <span>{repo.language ?? "No language listed"}</span>
                <span className="inline-flex items-center gap-1">
                  <Star size={14} className="text-brass" aria-hidden="true" />
                  {formatCount(repo.stars)}
                  <span className="sr-only">stars</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <GitFork size={14} aria-hidden="true" />
                  {formatCount(repo.forks)}
                  <span className="sr-only">forks</span>
                </span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
