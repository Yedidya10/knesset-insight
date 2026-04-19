import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function ClusterDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 py-8 sm:px-6">
      {/* Back button */}
      <div className="bg-muted mb-6 h-8 w-20 rounded" />

      {/* Header card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <div className="from-primary/20 via-muted to-primary/10 h-2 bg-linear-to-r" />
        <CardContent className="p-6">
          <div className="bg-muted h-7 w-3/4 rounded" />
          <div className="bg-muted mt-3 h-4 w-full rounded" />
          <div className="bg-muted mt-1 h-4 w-2/3 rounded" />

          <div className="mt-4 flex gap-2">
            <div className="bg-muted h-6 w-20 rounded-full" />
            <div className="bg-muted h-6 w-16 rounded-full" />
            <div className="bg-muted h-6 w-24 rounded-full" />
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="bg-muted h-5 w-5 rounded" />
                <div className="bg-muted h-6 w-8 rounded" />
                <div className="bg-muted h-3 w-16 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="bg-muted h-6 w-32 rounded" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="bg-muted h-6 w-16 rounded" />
                <div className="bg-muted h-3 w-3 rounded-full" />
                <div className="bg-muted h-3 w-12 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stage pipeline card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="bg-muted h-6 w-48 rounded" />
          <div className="bg-muted mt-1 h-4 w-24 rounded" />
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="bg-muted h-9 w-9 rounded-full" />
                <div className="bg-muted h-3 w-16 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bills grid */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="bg-muted h-6 w-40 rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="bg-muted h-5 w-3/4 rounded" />
                <div className="mt-2 flex gap-2">
                  <div className="bg-muted h-5 w-14 rounded-full" />
                  <div className="bg-muted h-5 w-18 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Initiators */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="bg-muted h-6 w-28 rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="bg-muted h-4 w-24 rounded" />
                <div className="bg-muted h-5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Vote timeline */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <div className="bg-muted h-6 w-36 rounded" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="relative flex gap-4 ps-10">
                <div className="bg-muted absolute inset-s-2.5 top-1 h-3 w-3 rounded-full" />
                <div className="flex-1 rounded-lg border p-3">
                  <div className="bg-muted h-4 w-2/3 rounded" />
                  <div className="bg-muted mt-2 h-3 w-1/3 rounded" />
                  <div className="bg-muted mt-2 h-1.5 w-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
