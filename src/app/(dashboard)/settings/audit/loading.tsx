function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

export default function AuditLoading() {
  return (
    <div className="space-y-4 motion-safe:animate-fade-in">
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-3.5 w-52" />
      </div>
      <div className="rounded-xl border border-border/80 bg-card/50 p-3">
        <Skeleton className="h-9 w-full max-w-md" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="space-y-0">
          <Skeleton className="h-11 w-full rounded-none" />
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-none" />
          ))}
        </div>
      </div>
    </div>
  );
}
