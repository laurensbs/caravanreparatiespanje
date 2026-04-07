function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function PartsLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="rounded-lg border bg-card">
        <div className="space-y-0">
          <Skeleton className="h-12 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
