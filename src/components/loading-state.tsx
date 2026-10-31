// Skeleton that mirrors the layout of the real card. role="status" announces it to screen readers.
export function LoadingState({ username }: { username: string }) {
  return (
    <div role="status" aria-busy="true" className="mt-10">
      <span className="sr-only">Loading the profile for {username}…</span>
      <div aria-hidden="true" className="skeleton rounded-2xl border border-line bg-paper p-6">
        <div className="flex items-center gap-5">
          <div className="size-24 rounded-full bg-line" />
          <div className="flex-1 space-y-3">
            <div className="h-6 w-1/2 rounded bg-line" />
            <div className="h-4 w-1/3 rounded bg-line" />
            <div className="h-4 w-3/4 rounded bg-line" />
          </div>
        </div>
      </div>
      <div aria-hidden="true" className="skeleton mt-6 grid gap-6 md:grid-cols-5">
        <div className="h-64 rounded-2xl border border-line bg-paper md:col-span-3" />
        <div className="h-64 rounded-2xl border border-line bg-paper md:col-span-2" />
      </div>
    </div>
  );
}
