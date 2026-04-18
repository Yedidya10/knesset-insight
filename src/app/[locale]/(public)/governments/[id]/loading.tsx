import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function GovernmentDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Back link skeleton */}
      <div className="bg-muted mb-6 h-5 w-24 animate-pulse rounded" />

      {/* Header skeleton */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* PM avatar */}
        <div className="bg-muted h-24 w-24 shrink-0 animate-pulse rounded-full" />

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="bg-muted h-8 w-48 animate-pulse rounded" />
            <div className="bg-muted h-6 w-16 animate-pulse rounded-full" />
          </div>
          <div className="bg-muted h-5 w-56 animate-pulse rounded" />
          <div className="bg-muted h-4 w-40 animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="bg-muted h-6 w-20 animate-pulse rounded-full" />
            <div className="bg-muted h-6 w-28 animate-pulse rounded-full" />
          </div>
        </div>
      </div>

      {/* Composition section skeleton */}
      <div className="mb-8">
        <div className="bg-muted mb-4 h-6 w-32 animate-pulse rounded" />

        {/* Leadership card skeleton */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="bg-muted h-5 w-36 animate-pulse rounded" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg p-2">
                <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="bg-muted h-4 w-28 animate-pulse rounded" />
                  <div className="bg-muted h-3 w-40 animate-pulse rounded" />
                </div>
                <div className="bg-muted h-5 w-12 animate-pulse rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* View toggle buttons skeleton */}
        <div className="mb-6 flex gap-2">
          <div className="bg-muted h-8 w-24 animate-pulse rounded-md" />
          <div className="bg-muted h-8 w-24 animate-pulse rounded-md" />
        </div>

        {/* Ministers grid skeleton */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="bg-muted h-5 w-20 animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3 p-2">
                      <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
                      <div className="flex-1 space-y-1">
                        <div className="bg-muted h-3.5 w-24 animate-pulse rounded" />
                        <div className="bg-muted h-3 w-36 animate-pulse rounded" />
                      </div>
                      <div className="bg-muted h-5 w-10 animate-pulse rounded-full" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline section skeleton */}
      <div className="mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="bg-muted h-5 w-24 animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="relative space-y-4 ps-10">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="bg-muted h-3 w-3 animate-pulse rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                    <div className="bg-muted h-4 w-48 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coalition section skeleton */}
      <div className="mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="bg-muted h-5 w-36 animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="bg-muted h-8 w-1.5 animate-pulse rounded-full" />
                  <div className="flex-1 space-y-1">
                    <div className="bg-muted h-4 w-28 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-16 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
