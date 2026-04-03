import { VoteCardSkeleton } from '@/components/ui/card-skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-14 w-14 animate-pulse rounded-2xl bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <VoteCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
