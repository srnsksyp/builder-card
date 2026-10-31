import type { LanguageSummary } from "@/lib/types";

export function LanguageChart({ summary }: { summary: LanguageSummary }) {
  const { languages, otherLanguages, reposWithLanguage, reposWithoutLanguage } = summary;

  return (
    <section aria-labelledby="languages-heading" className="rounded-2xl border border-line bg-paper p-6">
      <h2 id="languages-heading" className="font-display text-xl font-semibold">
        Languages Across Public Repositories
      </h2>
      <p className="mt-1 text-sm text-muted">
        Counts each repository once, by its primary language. This is not the amount of code written.
      </p>

      {languages.length === 0 ? (
        <p className="mt-6 text-muted">None of the analyzed repositories list a language.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {languages.map(({ language, repositories }) => (
            <li key={language}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{language}</span>
                <span className="text-muted">
                  {repositories} {repositories === 1 ? "repo" : "repos"}
                </span>
              </div>
              {/* The bar is decorative; the number above carries the information. */}
              <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-lichen">
                <div
                  className="h-2 rounded-full bg-spruce"
                  style={{ width: `${Math.max(4, (repositories / reposWithLanguage) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {(otherLanguages > 0 || reposWithoutLanguage > 0) && (
        <p className="mt-4 text-sm text-muted">
          {otherLanguages > 0 && `Plus ${otherLanguages} more ${otherLanguages === 1 ? "language" : "languages"}. `}
          {reposWithoutLanguage > 0 &&
            `${reposWithoutLanguage} ${reposWithoutLanguage === 1 ? "repository lists" : "repositories list"} no language.`}
        </p>
      )}
    </section>
  );
}
