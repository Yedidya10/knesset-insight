import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function MemberProfileLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Back button skeleton */}
      <div className="mb-6 h-8 w-16 animate-pulse rounded-lg bg-muted" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile card skeleton */}
        <Card className="overflow-hidden lg:col-span-1">
          <div className="h-20 animate-pulse bg-muted/50" />
          <CardContent className="flex flex-col items-center gap-4 px-6 pb-6 -mt-12">
            {/* Avatar */}
            <div className="h-28 w-28 animate-pulse rounded-full bg-muted ring-4 ring-card" />

            {/* Name */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-36 animate-pulse rounded bg-muted" />
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
            </div>

            {/* Badges */}
            <div className="flex gap-2">
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
            </div>

            <Separator className="opacity-30" />

            {/* Info rows */}
            <div className="w-full space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  <div
                    className="h-4 animate-pulse rounded bg-muted"
                    style={{ width: `${60 + (i * 13) % 30}%` }}
                  />
                </div>
              ))}
            </div>

            <Separator className="opacity-30" />

            {/* History section skeleton */}
            <div className="w-full space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Details column skeleton */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Vote summary skeleton */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="h-6 w-40 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 rounded-xl bg-muted/30 p-3">
                    <div className="h-7 w-10 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-12 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>

              {/* Participation bar */}
              <div className="mb-4 space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
              </div>

              <Separator className="my-4" />

              {/* Recent votes */}
              <div className="mb-3 h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg p-2">
                    <div className="h-4 w-4 shrink-0 animate-pulse rounded bg-muted" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                    </div>
                    <div className="h-5 w-12 shrink-0 animate-pulse rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bills skeleton */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <div className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
                <div className="h-8 w-36 animate-pulse rounded-lg bg-muted" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg p-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                      <div className="flex gap-2">
                        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-20 animate-pulse rounded-full bg-muted" />
                      </div>
                    </div>
                    <div className="h-5 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
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
