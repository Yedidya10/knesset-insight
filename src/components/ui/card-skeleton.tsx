import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function MemberCardSkeleton() {
  return (
    <Card className="border-border/40">
      <CardContent className="flex flex-col items-center gap-3 p-5">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
        {/* Stats placeholders (bill count + absent count) */}
        <div className="border-border/40 w-full space-y-2 border-t pt-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function VoteCardSkeleton() {
  return (
    <Card className="border-border/40">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-14 rounded" />
            <Skeleton className="h-6 w-14 rounded" />
            <Skeleton className="h-6 w-14 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PartyCardSkeleton() {
  return (
    <Card className="border-border/40">
      <CardContent className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="border-border/40">
      <CardContent className="flex items-center gap-4 p-6">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}
