import { Skeleton } from '@/components/ui/skeleton';

export default function VoteRedirectLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Skeleton className="h-6 w-48" />
    </div>
  );
}
