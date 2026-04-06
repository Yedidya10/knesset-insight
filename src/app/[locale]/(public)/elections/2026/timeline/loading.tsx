export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-4 h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="mb-2 h-8 w-32 animate-pulse rounded bg-muted" />
      <div className="mb-8 h-4 w-56 animate-pulse rounded bg-muted" />
      {/* Timeline skeleton */}
      <div className="space-y-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              <div className="h-5 w-52 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
