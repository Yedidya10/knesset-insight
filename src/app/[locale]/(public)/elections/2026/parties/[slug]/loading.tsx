export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-4 h-4 w-64 animate-pulse rounded bg-muted" />
      <div className="mb-8 flex items-start gap-4">
        <div className="h-16 w-2 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
      {/* Candidates */}
      <div className="mb-3 h-6 w-28 animate-pulse rounded bg-muted" />
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
