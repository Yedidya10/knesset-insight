import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function ClusterDetailLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 animate-pulse">
      {/* Back button */}
      <div className="mb-6 h-8 w-20 rounded bg-muted" />

      {/* Header card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-primary/20 via-muted to-primary/10" />
        <CardContent className="p-6">
          <div className="h-7 w-3/4 rounded bg-muted" />
          <div className="mt-3 h-4 w-full rounded bg-muted" />
          <div className="mt-1 h-4 w-2/3 rounded bg-muted" />

          <div className="mt-4 flex gap-2">
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="h-6 w-16 rounded-full bg-muted" />
            <div className="h-6 w-24 rounded-full bg-muted" />
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-5 w-5 rounded bg-muted" />
                <div className="h-6 w-8 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Timeline card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="h-6 w-32 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="h-6 w-16 rounded bg-muted" />
                <div className="h-3 w-3 rounded-full bg-muted" />
                <div className="h-3 w-12 rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stage pipeline card */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="mt-1 h-4 w-24 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bills grid */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="h-6 w-40 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="h-5 w-3/4 rounded bg-muted" />
                <div className="mt-2 flex gap-2">
                  <div className="h-5 w-14 rounded-full bg-muted" />
                  <div className="h-5 w-18 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Initiators */}
      <Card className="glass-card mb-6 overflow-hidden">
        <CardHeader>
          <div className="h-6 w-28 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-5 w-12 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Vote timeline */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <div className="h-6 w-36 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 ps-10 relative">
                <div className="absolute start-[10px] top-1 h-3 w-3 rounded-full bg-muted" />
                <div className="flex-1 rounded-lg border p-3">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-muted" />
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
