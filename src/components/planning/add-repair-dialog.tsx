"use client";

import { useState, useTransition } from "react";
import { Search, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PRIORITY_COLORS, STATUS_COLORS } from "@/types";
import type { Priority, RepairStatus } from "@/types";
import { type PlanningLang, getLocaleStrings, formatDateLocale } from "@/lib/planning-locale";
import { searchUnscheduledRepairs, scheduleRepair, type SearchableRepair } from "@/actions/planning";
import { SCHEDULE_NEEDS_TASKS } from "@/lib/planning-schedule-errors";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetDate: Date | null;
  lang: PlanningLang;
  onAdded: () => void;
}

export function AddRepairDialog({ open, onOpenChange, targetDate, lang, onAdded }: Props) {
  const t = getLocaleStrings(lang);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchableRepair[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const data = await searchUnscheduledRepairs(value);
      setResults(data);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSelect(repair: SearchableRepair) {
    if (!targetDate) return;
    setSelectedId(repair.id);
    startTransition(async () => {
      try {
        await scheduleRepair(repair.id, targetDate.toISOString());
        toast.success(`${t.scheduled}: ${repair.title ?? repair.publicCode ?? "Repair"}`);
        setQuery("");
        setResults([]);
        setSelectedId(null);
        onAdded();
      } catch (err) {
        const msg = (err as Error)?.message ?? "Failed to schedule repair";
        toast.error(msg === SCHEDULE_NEEDS_TASKS ? t.scheduleNeedsTasks : msg);
        setSelectedId(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setQuery(""); setResults([]); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {t.addRepair}
            {targetDate && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — {formatDateLocale(targetDate, lang)}, {String(targetDate.getHours()).padStart(2, "0")}:00
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t.searchRepairs}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t.searching}
            </div>
          )}

          {!isSearching && query.length >= 2 && results.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t.noResults}
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r)}
                  disabled={isPending}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 flex items-start gap-3"
                >
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_COLORS[r.priority as Priority]?.split(" ")[0] ?? "bg-foreground/30"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{r.title ?? "—"}</span>
                      {r.publicCode && (
                        <span className="text-xs text-muted-foreground shrink-0">{r.publicCode}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {r.customerName && (
                        <span className="text-xs text-muted-foreground truncate">{r.customerName}</span>
                      )}
                      <Badge className={`${STATUS_COLORS[r.status as RepairStatus]} rounded-full text-[9px] px-1.5 py-0`}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                  {isPending && selectedId === r.id && (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0 mt-1" />
                  )}
                </button>
              ))}
            </div>
          )}

          {!isSearching && query.length < 2 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t.searchRepairs}…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
