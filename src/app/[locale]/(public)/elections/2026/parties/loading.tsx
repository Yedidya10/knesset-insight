export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="mb-2 h-8 w-52 animate-pulse rounded bg-muted" />
      <div className="mb-6 h-4 w-72 animate-pulse rounded bg-muted" />
      {/* Filter skeletons */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="h-10 w-72 animate-pulse rounded-xl bg-muted" />
        <div className="h-10 w-96 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
