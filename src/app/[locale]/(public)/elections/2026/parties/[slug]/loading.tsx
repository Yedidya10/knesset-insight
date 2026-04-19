export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="bg-muted mb-4 h-4 w-64 animate-pulse rounded" />
      <div className="mb-8 flex items-start gap-4">
        <div className="bg-muted h-16 w-2 animate-pulse rounded-full" />
        <div className="space-y-2">
          <div className="bg-muted h-8 w-56 animate-pulse rounded" />
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
          <div className="bg-muted h-4 w-32 animate-pulse rounded" />
        </div>
      </div>
      {/* Candidates */}
      <div className="bg-muted mb-3 h-6 w-28 animate-pulse rounded" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted h-16 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}
