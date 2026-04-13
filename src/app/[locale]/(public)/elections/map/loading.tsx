export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-muted h-14 w-14 animate-pulse rounded-2xl" />
        <div className="space-y-2">
          <div className="bg-muted h-7 w-52 animate-pulse rounded" />
          <div className="bg-muted h-4 w-72 animate-pulse rounded" />
        </div>
      </div>

      {/* Controls skeleton */}
      <div className="mb-4 flex gap-3">
        <div className="bg-muted h-10 w-40 animate-pulse rounded-md" />
        <div className="bg-muted h-10 w-64 animate-pulse rounded-md" />
      </div>

      {/* Map + sidebar skeleton */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Map placeholder */}
        <div className="bg-muted/30 flex min-h-[500px] flex-1 items-center justify-center rounded-xl border sm:min-h-[600px] lg:min-h-[700px]">
          <div className="bg-muted h-80 w-48 animate-pulse rounded-lg" />
        </div>

        {/* Sidebar skeleton */}
        <div className="w-full space-y-4 lg:w-80 xl:w-96">
          <div className="rounded-xl border p-4">
            <div className="bg-muted mb-3 h-5 w-24 animate-pulse rounded" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                  <div className="bg-muted h-6 w-16 animate-pulse rounded" />
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <div className="bg-muted h-3 w-24 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-10 animate-pulse rounded" />
                  </div>
                  <div className="bg-muted h-1.5 w-full animate-pulse rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
