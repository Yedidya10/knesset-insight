export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="mb-2 h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="mb-6 h-4 w-64 animate-pulse rounded bg-muted" />
      {/* Chart skeleton */}
      <div className="mb-8">
        <div className="mb-3 h-6 w-28 animate-pulse rounded bg-muted" />
        <div className="h-72 animate-pulse rounded-xl bg-muted sm:h-80 lg:h-96" />
      </div>
      {/* Poll cards */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
