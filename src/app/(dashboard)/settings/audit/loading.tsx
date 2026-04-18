import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLoading() {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-3.5 w-52 opacity-70" />
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm dark:border-border dark:bg-card/[0.03]">
        <Skeleton className="h-9 w-full max-w-md" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm dark:border-border dark:bg-card/[0.03]">
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="divide-y divide-border/60 dark:divide-border/60">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="opacity-0 animate-fade-in"
              style={{ animationDelay: `${i * 30}ms`, animationFillMode: "forwards" }}
            >
              <Skeleton className="h-11 w-full rounded-none" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
