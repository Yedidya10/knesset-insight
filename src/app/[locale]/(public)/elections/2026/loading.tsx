export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-muted h-14 w-14 animate-pulse rounded-2xl" />
        <div className="space-y-2">
          <div className="bg-muted h-8 w-48 animate-pulse rounded" />
          <div className="bg-muted h-4 w-64 animate-pulse rounded" />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-muted mb-6 h-4 w-32 animate-pulse rounded" />

      {/* Countdown */}
      <div className="bg-muted mb-8 h-28 animate-pulse rounded-2xl" />

      {/* Seat projection */}
      <div className="mb-8 space-y-2">
        <div className="bg-muted h-6 w-40 animate-pulse rounded" />
        <div className="bg-muted h-8 animate-pulse rounded-lg" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted h-4 w-20 animate-pulse rounded" />
          ))}
        </div>
      </div>

      {/* Parties grid */}
      <div className="mb-8">
        <div className="mb-3 flex justify-between">
          <div className="bg-muted h-6 w-36 animate-pulse rounded" />
          <div className="bg-muted h-5 w-24 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted h-32 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>

      {/* Navigation links */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        <div className="bg-muted h-20 animate-pulse rounded-xl" />
        <div className="bg-muted h-20 animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
