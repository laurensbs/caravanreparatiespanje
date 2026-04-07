"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/types";
import type { RepairStatus, Priority } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { BulkActions } from "./bulk-actions";

interface Job {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  priority: string;
  invoiceStatus: string;
  customerResponseStatus: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date | null;
  locationName: string | null;
  locationId: string | null;
  customerName: string | null;
  customerId: string | null;
  unitRegistration: string | null;
  unitId: string | null;
  assignedUserName: string | null;
  assignedUserId: string | null;
  descriptionRaw: string | null;
  partsNeededRaw: string | null;
  notesRaw: string | null;
}

interface RepairTableProps {
  jobs: Job[];
}

export function RepairTable({ jobs }: RepairTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleAll = () => {
    if (selected.size === jobs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(jobs.map((j) => j.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  return (
    <div>
      {selected.size > 0 && (
        <BulkActions
          selectedIds={Array.from(selected)}
          onClear={clearSelection}
        />
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={jobs.length > 0 && selected.size === jobs.length}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="w-28">Ref</TableHead>
              <TableHead>Title / Description</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="w-28">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                  No repair jobs found. Adjust your filters or create a new repair.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer"
                  data-state={selected.has(job.id) ? "selected" : undefined}
                  onClick={() => router.push(`/repairs/${job.id}`)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(job.id)}
                      onCheckedChange={() => toggleOne(job.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {job.publicCode ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <p className="truncate font-medium text-sm">
                        {job.title || "Unnamed repair"}
                      </p>
                      {job.descriptionRaw && (
                        <p className="truncate text-xs text-muted-foreground">
                          {job.descriptionRaw.slice(0, 80)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-[11px] ${STATUS_COLORS[job.status as RepairStatus]}`}>
                      {STATUS_LABELS[job.status as RepairStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-[11px] ${PRIORITY_COLORS[job.priority as Priority]}`}>
                      {PRIORITY_LABELS[job.priority as Priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{job.customerName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{job.locationName ?? "—"}</TableCell>
                  <TableCell className="text-sm font-mono text-xs">{job.unitRegistration ?? "—"}</TableCell>
                  <TableCell className="text-sm">{job.assignedUserName ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
