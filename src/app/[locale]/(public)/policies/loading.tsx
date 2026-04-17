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
