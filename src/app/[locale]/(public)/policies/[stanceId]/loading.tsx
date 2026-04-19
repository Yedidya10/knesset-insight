export default function PolicyDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl overflow-hidden px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-muted h-14 w-14 shrink-0 animate-pulse rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="bg-muted h-7 w-64 max-w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-40 max-w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-96 max-w-full animate-pulse rounded" />
        </div>
      </div>
      <div className="mb-6 flex gap-2">
        <div className="bg-muted h-9 w-28 animate-pulse rounded-md" />
        <div className="bg-muted h-9 w-28 animate-pulse rounded-md" />
      </div>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="bg-muted mb-3 h-4 w-48 animate-pulse rounded" />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, j) => (
                <div
                  key={j}
                  className="bg-muted h-16 animate-pulse rounded-lg"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
