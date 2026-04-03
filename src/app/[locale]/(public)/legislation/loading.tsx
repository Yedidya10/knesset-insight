import { VoteCardSkeleton } from '@/components/ui/card-skeleton';

export default function LegislationLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-14 w-14 animate-pulse rounded-2xl bg-muted" />
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-16 animate-pulse rounded-xl bg-muted" />
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
