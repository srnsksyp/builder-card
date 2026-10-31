import { Database, RefreshCw, TriangleAlert } from "lucide-react";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/utils";
import type { CardMeta } from "@/lib/types";

type Props = {
  meta: CardMeta;
  refreshing: boolean;
  refreshError: string | null;
  onRefresh: () => void;
};

// Tells the reader where the data came from and how old it is.
function sourceText(meta: CardMeta): string {
  const age = formatRelativeTime(meta.fetchedAt);
  if (meta.source === "github") return "Fetched live from GitHub just now";
  if (meta.source === "cache") return `Saved data, fetched from GitHub ${age}`;
  return `GitHub is unavailable. Showing data saved ${age}`;
}

export function FreshnessBar({ meta, refreshing, refreshError, onRefresh }: Props) {
  const warning = refreshError ?? meta.warning;

  return (
    <div className="mb-4 rounded-xl border border-line bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Database size={16} aria-hidden="true" />
          <span title={formatAbsoluteTime(meta.fetchedAt)}>{sourceText(meta)}</span>
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-spruce px-3 py-1.5 text-sm font-medium text-spruce hover:bg-spruce/10 disabled:opacity-60"
        >
          <RefreshCw size={15} aria-hidden="true" className={refreshing ? "motion-safe:animate-spin" : ""} />
          {refreshing ? "Refreshing…" : "Refresh from GitHub"}
        </button>
      </div>
      {warning && (
        <p role="status" className="mt-2 flex items-start gap-2 text-sm text-alert">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      )}
    </div>
  );
}
