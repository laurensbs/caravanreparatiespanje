"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Building2, ExternalLink, Loader2 } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  holdedContactId: string | null;
}

const BATCH = 50;

export function BusinessesTableClient({ suppliers }: { suppliers: Supplier[] }) {
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < suppliers.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH, suppliers.length));
  }, [suppliers.length]);

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

  // Reset when supplier list changes
  useEffect(() => {
    setVisibleCount(BATCH);
  }, [suppliers]);

  const visible = suppliers.slice(0, visibleCount);

  return (
    <tbody className="divide-y divide-gray-50">
      {visible.length === 0 ? (
        <tr>
          <td colSpan={6} className="py-20 text-center">
            <div className="flex flex-col items-center gap-2">
              <Building2 className="h-8 w-8 text-foreground/90" />
              <p className="text-sm font-medium text-muted-foreground/70">No businesses found</p>
              <p className="text-xs text-muted-foreground/70">Businesses are synced from Holded</p>
            </div>
          </td>
        </tr>
      ) : (
        visible.map((s) => (
          <tr key={s.id} className="group hover:bg-muted/40 dark:hover:bg-accent transition-colors duration-150">
            <td className="px-5 py-3.5">
              <span className="text-sm font-medium text-foreground">{s.name}</span>
            </td>
            <td className="px-5 py-3.5 text-sm text-muted-foreground">{s.contactName || <span className="text-muted-foreground/50">—</span>}</td>
            <td className="px-5 py-3.5 text-sm text-muted-foreground">{s.phone || <span className="text-muted-foreground/50">—</span>}</td>
            <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">{s.email || <span className="text-muted-foreground/50">—</span>}</td>
            <td className="px-5 py-3.5 text-sm text-muted-foreground hidden md:table-cell">
              {s.website ? (
                <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline truncate max-w-[200px] inline-block">
                  {s.website.replace(/^https?:\/\//, "")}
                </a>
              ) : <span className="text-muted-foreground/50">—</span>}
            </td>
            <td className="px-5 py-3.5">
              {s.holdedContactId ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <ExternalLink className="h-2.5 w-2.5" /> Linked
                </span>
              ) : (
                <span className="text-muted-foreground/50">—</span>
              )}
            </td>
          </tr>
        ))
      )}
      {hasMore && (
        <tr>
          <td colSpan={6}>
            <div ref={sentinelRef} className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />
            </div>
          </td>
        </tr>
      )}
      {!hasMore && visible.length > 0 && (
        <tr>
          <td colSpan={6}>
            <p className="text-center text-[11px] text-muted-foreground/70 py-3">
              {suppliers.length} business{suppliers.length !== 1 ? "es" : ""}
            </p>
          </td>
        </tr>
      )}
    </tbody>
  );
}
