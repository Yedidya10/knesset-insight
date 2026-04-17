import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function MemberProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Back button skeleton */}
      <div className="bg-muted mb-6 h-8 w-16 animate-pulse rounded-lg" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card skeleton */}
        <Card className="overflow-hidden lg:col-span-1">
          <div className="bg-muted/50 h-20 animate-pulse" />
          <CardContent className="-mt-12 flex flex-col items-center gap-4 px-6 pb-6">
            {/* Avatar */}
            <div className="bg-muted ring-card h-28 w-28 animate-pulse rounded-full ring-4" />

            {/* Name */}
            <div className="flex flex-col items-center gap-2">
              <div className="bg-muted h-6 w-36 animate-pulse rounded" />
              <div className="bg-muted h-4 w-48 animate-pulse rounded" />
            </div>

            {/* Badges */}
            <div className="flex gap-2">
              <div className="bg-muted h-6 w-20 animate-pulse rounded-full" />
            </div>

            <Separator className="opacity-30" />

            {/* Info rows */}
            <div className="w-full space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="bg-muted h-4 w-4 animate-pulse rounded" />
                  <div
                    className="bg-muted h-4 animate-pulse rounded"
                    style={{ width: `${60 + ((i * 13) % 30)}%` }}
                  />
                </div>
              ))}
            </div>

            <Separator className="opacity-30" />

            {/* History section skeleton */}
            <div className="w-full space-y-2">
              <div className="bg-muted h-4 w-32 animate-pulse rounded" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                  <div className="bg-muted h-5 w-14 animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Details column skeleton */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Policy stances skeleton */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="bg-muted h-6 w-40 animate-pulse rounded" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 rounded-xl border p-3"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="bg-muted h-4 w-40 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-24 animate-pulse rounded" />
                  </div>
                  <div className="bg-muted h-5 w-16 shrink-0 animate-pulse rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent votes skeleton */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="bg-muted h-6 w-36 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg p-2"
                  >
                    <div className="bg-muted h-4 w-4 shrink-0 animate-pulse rounded" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="bg-muted h-4 w-full animate-pulse rounded" />
                      <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                    </div>
                    <div className="bg-muted h-5 w-12 shrink-0 animate-pulse rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bills skeleton */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="bg-muted h-6 w-48 animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <div className="bg-muted h-8 w-28 animate-pulse rounded-lg" />
                <div className="bg-muted h-8 w-36 animate-pulse rounded-lg" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg p-2"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="bg-muted h-4 w-full animate-pulse rounded" />
                      <div className="flex gap-2">
                        <div className="bg-muted h-3 w-16 animate-pulse rounded" />
                        <div className="bg-muted h-4 w-20 animate-pulse rounded-full" />
                      </div>
                    </div>
                    <div className="bg-muted h-5 w-24 shrink-0 animate-pulse rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
