function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function SettingsLoading() {
  return (
    <div className="space-y-5 motion-safe:animate-fade-in">
      <Skeleton className="h-5 w-32 rounded-full" />
      <div className="space-y-3">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
