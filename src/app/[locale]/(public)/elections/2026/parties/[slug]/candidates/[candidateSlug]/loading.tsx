export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 h-4 w-56 animate-pulse rounded bg-muted" />
      {/* Profile header */}
      <div className="flex items-start gap-4">
        <div className="h-20 w-20 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="flex gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
            <div className="h-6 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
      {/* Cards */}
      <div className="mt-6 space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
