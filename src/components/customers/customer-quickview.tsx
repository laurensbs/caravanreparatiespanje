"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getCustomers, type CustomerFilters } from "@/actions/customers";
import { ExternalLink, Loader2, Wrench } from "lucide-react";
import { SmartDate } from "@/components/ui/smart-date";

interface CustomerRow {
  id: string;
  name: string;
  contactType: string;
  holdedContactId: string | null;
  repairCount: number;
  phone: string | null;
  email: string | null;
  updatedAt: Date;
}

interface Props {
  customers: CustomerRow[];
  total: number;
  filters: CustomerFilters;
}

export function CustomersTableClient({ customers: initialCustomers, total, filters }: Props) {
  const router = useRouter();
  const [allCustomers, setAllCustomers] = useState<CustomerRow[]>(initialCustomers);
  const [loading, startLoading] = useTransition();
  const [hasMore, setHasMore] = useState(initialCustomers.length < total);
  const pageRef = useRef(1);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset when initialCustomers change (filters/sort changed)
  useEffect(() => {
    setAllCustomers(initialCustomers);
    pageRef.current = 1;
    setHasMore(initialCustomers.length < total);
  }, [initialCustomers, total]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    startLoading(async () => {
      const nextPage = pageRef.current + 1;
      const { customers: more } = await getCustomers({ ...filters, page: nextPage });
      setAllCustomers(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newCustomers = (more as CustomerRow[]).filter(c => !existingIds.has(c.id));
        return [...prev, ...newCustomers];
      });
      pageRef.current = nextPage;
      const loaded = nextPage * (filters.limit ?? 50);
      if (loaded >= total) setHasMore(false);
    });
  }, [loading, hasMore, filters, total]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <>
      <tbody className="divide-y divide-border/60">
        {allCustomers.length === 0 ? (
          <tr>
            <td colSpan={5} className="py-20 text-center">
              <div className="flex flex-col items-center gap-2">
                <Wrench className="h-8 w-8 text-foreground/90" />
                <p className="text-sm font-medium text-muted-foreground/70">No contacts found</p>
                <p className="text-xs text-muted-foreground/70">Try adjusting your search or filters</p>
              </div>
            </td>
          </tr>
        ) : (
          allCustomers.map((c) => (
            <tr
              key={c.id}
              className="group cursor-pointer touch-manipulation transition-colors duration-150 hover:bg-muted/50 active:bg-muted/70"
              onClick={() => router.push(`/customers/${c.id}`)}
            >
              <td className="px-4 py-3.5 sm:px-5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-sm font-medium tracking-[-0.005em] text-foreground transition-colors group-hover:text-foreground/90">
                    {c.name}
                  </span>
                  {c.holdedContactId && (
                    <span className="text-emerald-600 dark:text-emerald-400" title="Linked to Holded">
                      <ExternalLink className="h-3 w-3" />
                    </span>
                  )}
                </span>
                {c.phone && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">{c.phone}</p>
                )}
              </td>
              <td className="px-4 py-3.5 text-center sm:px-5">
                {c.repairCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-foreground/85"
                    title="Work orders linked to this contact"
                  >
                    <Wrench className="h-3 w-3 opacity-60" />
                    {c.repairCount}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/40 tabular-nums">0</span>
                )}
              </td>
              <td className="hidden px-5 py-3.5 text-sm text-muted-foreground md:table-cell">{c.phone || <span className="text-muted-foreground/40">—</span>}</td>
              <td className="hidden px-5 py-3.5 text-sm text-muted-foreground md:table-cell">{c.email || <span className="text-muted-foreground/40">—</span>}</td>
              <td className="px-4 py-3.5 text-right sm:px-5">
                <SmartDate date={c.updatedAt} className="text-xs text-muted-foreground" />
              </td>
            </tr>
          ))
        )}
        {hasMore && (
          <tr>
            <td colSpan={5}>
              <div ref={sentinelRef} className="flex justify-center py-4">
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />}
              </div>
            </td>
          </tr>
        )}
        {!hasMore && allCustomers.length > 0 && (
          <tr>
            <td colSpan={5}>
              <p className="text-center text-[11px] text-muted-foreground/70 py-3">
                {allCustomers.length} contact{allCustomers.length !== 1 ? "s" : ""}
              </p>
            </td>
          </tr>
        )}
      </tbody>

    </>
  );
}

