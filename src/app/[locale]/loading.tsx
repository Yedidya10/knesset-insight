import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      {/* Hero skeleton */}
      <section className="bg-muted/20 relative overflow-hidden py-16 sm:py-24">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 sm:px-6">
          {/* Hemicycle placeholder */}
          <Skeleton className="mx-auto aspect-[2.2/1] w-full max-w-[900px] rounded-xl" />
          {/* Title/CTA */}
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-5 w-64" />
            <div className="mt-4 flex gap-3">
              <Skeleton className="h-11 w-36 rounded-xl" />
              <Skeleton className="h-11 w-36 rounded-xl" />
              <Skeleton className="h-11 w-36 rounded-xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-4 px-4 py-12 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex flex-col items-center gap-2 p-5">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Latest votes */}
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Active legislation */}
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Members */}
      <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-12 sm:px-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col items-center gap-3 p-5">
                <Skeleton className="h-16 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Explore grid */}
      <div className="bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6">
          <Skeleton className="h-7 w-48" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-2 p-4">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
