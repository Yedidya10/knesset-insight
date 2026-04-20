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
      <div className="mb-6 rounded-lg border border-amber-200/60 bg-gradient-to-b from-amber-50/40 to-blue-50/40 p-4 dark:border-amber-900/40 dark:from-amber-950/10 dark:to-blue-950/15">
        <div className="mb-3 flex items-center gap-2">
          <div className="bg-muted h-5 w-5 animate-pulse rounded" />
          <div className="bg-muted h-4 w-48 animate-pulse rounded" />
          <div className="bg-muted h-5 w-24 animate-pulse rounded-full" />
        </div>
        <div className="mb-1.5 flex items-center justify-between">
          <div className="bg-muted h-3 w-32 animate-pulse rounded" />
          <div className="bg-muted h-3 w-20 animate-pulse rounded" />
        </div>
        <div className="mb-3 h-2 w-full animate-pulse rounded-full bg-blue-200/70 dark:bg-blue-900/50" />
        <div className="bg-muted mt-3 h-3 w-3/4 animate-pulse rounded" />
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
