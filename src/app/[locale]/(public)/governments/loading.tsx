import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function GovernmentsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Title skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-muted" />
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Knesset filter skeleton */}
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-full bg-muted"
            style={{ width: `${56 + (i * 11) % 24}px` }}
          />
        ))}
      </div>

      {/* Card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-4 pb-3">
              <div className="h-14 w-14 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="flex gap-2">
                <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
