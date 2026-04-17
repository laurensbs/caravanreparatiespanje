"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { STATUS_LABELS, STATUS_COLORS } from "@/types";
import type { RepairStatus } from "@/types";
import { SmartDate } from "@/components/ui/smart-date";
import { RotateCcw, Trash2, ArrowLeft } from "lucide-react";
import { restoreRepairJob, permanentDeleteRepairJob } from "@/actions/repairs";
import { toast } from "sonner";
import Link from "next/link";

interface DeletedJob {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: string;
  invoiceStatus: string;
  deletedAt: Date | null;
  createdAt: Date;
  customerName: string | null;
  locationName: string | null;
  unitRegistration: string | null;
}

interface BinClientProps {
  jobs: DeletedJob[];
}

export function BinClient({ jobs }: BinClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);

  const toggleAll = () => {
    if (selected.size === jobs.length) setSelected(new Set());
    else setSelected(new Set(jobs.map((j) => j.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  async function handleRestore(id: string) {
    setLoading(id);
    try {
      await restoreRepairJob(id);
      toast.success("Repair restored");
      router.refresh();
    } catch {
      toast.error("Failed to restore");
    } finally {
      setLoading(null);
    }
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm("Permanently delete this repair? This cannot be undone.")) return;
    setLoading(id);
    try {
      await permanentDeleteRepairJob(id);
      toast.success("Permanently deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setLoading(null);
    }
  }

  async function handleBulkRestore() {
    setLoading("bulk");
    try {
      for (const id of selected) {
        await restoreRepairJob(id);
      }
      toast.success(`Restored ${selected.size} repair${selected.size > 1 ? "s" : ""}`);
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Failed to restore");
    } finally {
      setLoading(null);
    }
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`Permanently delete ${selected.size} repair${selected.size > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setLoading("bulk");
    try {
      for (const id of selected) {
        await permanentDeleteRepairJob(id);
      }
      toast.success(`Permanently deleted ${selected.size} repair${selected.size > 1 ? "s" : ""}`);
      setSelected(new Set());
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setLoading(null);
    }
  }

  function daysUntilPurge(deletedAt: Date | null): number {
    if (!deletedAt) return 30;
    const diff = 30 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs" asChild>
          <Link href="/repairs">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Repairs
          </Link>
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border bg-primary/5 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-full touch-manipulation text-xs sm:h-8 sm:w-auto"
            onClick={handleBulkRestore}
            disabled={loading === "bulk"}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Restore
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-10 w-full touch-manipulation text-xs sm:h-8 sm:w-auto"
            onClick={handleBulkPermanentDelete}
            disabled={loading === "bulk"}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete Forever
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
              <TableHead className="w-10">
                <Checkbox
                  checked={jobs.length > 0 && selected.size === jobs.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Ref</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Title</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Contact</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Deleted</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Auto-purge</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Trash2 className="h-8 w-8 opacity-20" />
                    <p className="font-medium text-sm">Bin is empty</p>
                    <p className="text-xs">Deleted repairs will appear here</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const days = daysUntilPurge(job.deletedAt);
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(job.id)}
                        onCheckedChange={() => toggleOne(job.id)}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {job.publicCode ?? "—"}
                    </TableCell>
                    <TableCell>
                      <p className="truncate font-medium text-[13px] max-w-xs">
                        {job.title || "Unnamed repair"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[11px] ${STATUS_COLORS[job.status as RepairStatus]}`}>
                        {STATUS_LABELS[job.status as RepairStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[13px]">{job.customerName ?? "—"}</TableCell>
                    <TableCell>
                      <SmartDate date={job.deletedAt!} className="text-xs text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${days <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                        {days} day{days !== 1 ? "s" : ""}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          onClick={() => handleRestore(job.id)}
                          disabled={loading === job.id}
                          title="Restore"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handlePermanentDelete(job.id)}
                          disabled={loading === job.id}
                          title="Delete forever"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
