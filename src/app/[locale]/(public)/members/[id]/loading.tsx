import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function MemberProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      {/* Breadcrumb skeleton */}
      <div className="bg-muted mb-4 h-4 w-48 animate-pulse rounded" />

      {/* Hero banner skeleton */}
      <section className="relative overflow-hidden rounded-2xl">
        <div className="bg-muted/50 h-48 animate-pulse" />
        <div className="absolute inset-0 flex flex-col justify-end px-6 pt-4 pb-6">
          <div className="bg-muted/60 mb-4 h-8 w-16 animate-pulse rounded-lg" />
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-end sm:gap-6">
            <div className="bg-muted ring-background h-28 w-28 shrink-0 animate-pulse rounded-full ring-4" />
            <div className="flex flex-1 flex-col items-center gap-3 sm:items-start">
              <div className="space-y-2 text-center sm:text-start">
                <div className="bg-muted h-8 w-48 animate-pulse rounded" />
                <div className="bg-muted h-4 w-32 animate-pulse rounded" />
              </div>
              <div className="flex gap-2">
                <div className="bg-muted h-6 w-20 animate-pulse rounded-full" />
                <div className="bg-muted h-6 w-24 animate-pulse rounded-full" />
              </div>
              <div className="flex gap-3">
                <div className="bg-muted h-4 w-36 animate-pulse rounded" />
                <div className="bg-muted h-4 w-24 animate-pulse rounded" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Details collapsible skeleton */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="bg-muted h-4 w-28 animate-pulse rounded" />
          <div className="bg-muted h-4 w-4 animate-pulse rounded" />
        </div>
      </Card>

      {/* Tab bar skeleton */}
      <div className="flex gap-1 border-b pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-muted h-8 animate-pulse rounded-md"
            style={{ width: `${60 + ((i * 17) % 40)}px` }}
          />
        ))}
      </div>

      {/* Tab content skeleton */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="bg-muted h-6 w-40 animate-pulse rounded" />
        </CardHeader>
        <CardContent>
          {/* Vote breakdown grid skeleton */}
          <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted/50 flex flex-col items-center gap-1 rounded-lg p-2"
              >
                <div className="bg-muted h-6 w-10 animate-pulse rounded" />
                <div className="bg-muted h-3 w-12 animate-pulse rounded" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                <div className="bg-muted h-10 w-10 shrink-0 animate-pulse rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="bg-muted h-4 w-full animate-pulse rounded" />
                  <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
                </div>
                <div className="bg-muted h-5 w-16 shrink-0 animate-pulse rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
