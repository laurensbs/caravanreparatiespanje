import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-8 w-48 sm:h-9" />
        <Skeleton className="h-3.5 w-64 opacity-70" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl sm:w-auto sm:max-w-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="opacity-0 animate-fade-in"
            style={{ animationDelay: `${i * 50}ms`, animationFillMode: "forwards" }}
          >
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
