import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminClustersLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-2 w-full rounded" />
      </div>

      {/* Manual Link Form */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-28" />
        <Card className="glass-card">
          <CardContent className="p-4 flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-20" />
          </CardContent>
        </Card>
      </div>

      {/* Review Queue */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-60" />
                  <Skeleton className="h-4 w-full max-w-md" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-12" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-px w-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-80" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
