import { VoteCardSkeleton } from '@/components/ui/card-skeleton';

export default function PoliciesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="bg-muted h-14 w-14 animate-pulse rounded-2xl" />
        <div className="space-y-2">
          <div className="bg-muted h-7 w-48 animate-pulse rounded" />
          <div className="bg-muted h-4 w-64 animate-pulse rounded" />
        </div>
      </div>
      <div className="bg-muted mb-6 h-9 w-full animate-pulse rounded-lg" />
      {/* Progress banner skeleton */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
        <div className="mb-3 flex items-center gap-2">
          <div className="bg-muted h-5 w-5 animate-pulse rounded" />
          <div className="bg-muted h-4 w-48 animate-pulse rounded" />
        </div>
        <div className="bg-muted mb-3 h-2 w-full animate-pulse rounded-full" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted h-8 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted h-9 w-28 animate-pulse rounded-md" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <VoteCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
