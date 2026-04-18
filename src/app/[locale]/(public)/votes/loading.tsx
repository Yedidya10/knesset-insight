import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function VotesListLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* Vote cards */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card
            key={i}
            className="border-s-primary/30 overflow-hidden border-s-4"
          >
            <CardContent className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="hidden h-1.5 w-24 sm:block" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
