import { PartyCardSkeleton } from '@/components/ui/card-skeleton';

export default function FactionsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-14 w-14 animate-pulse rounded-2xl bg-muted" />
        <div className="h-7 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-6 h-10 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <PartyCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
