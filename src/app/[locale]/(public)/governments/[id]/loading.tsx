import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function GovernmentDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Back link skeleton */}
      <div className="mb-6 h-5 w-24 animate-pulse rounded bg-muted" />

      {/* Header skeleton */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* PM avatar */}
        <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-muted" />

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="h-5 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </div>

      {/* Composition section skeleton */}
      <div className="mb-8">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-3 w-36 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Coalition section skeleton */}
      <div className="mb-8">
        <div className="mb-4 h-6 w-36 animate-pulse rounded bg-muted" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
