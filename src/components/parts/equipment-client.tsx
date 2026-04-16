"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { AddRequestDialog } from "@/components/parts/part-requests-client";

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400",
  ordered: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  shipped: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  received: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  cancelled: "bg-gray-50 text-gray-600 dark:bg-gray-500/10 dark:text-gray-400",
};

interface EquipmentRequest {
  id: string;
  repairJobId: string;
  partName: string | null;
  status: string;
  notes: string | null;
  jobTitle: string | null;
  jobRef: string | null;
  customerName?: string | null;
  unitRegistration?: string | null;
}

export function EquipmentClient({ requests }: { requests: EquipmentRequest[] }) {
  const [showAdd, setShowAdd] = useState(false);

  if (requests.length === 0) {
    return (
      <>
        <div className="rounded-lg border bg-card py-12 text-center text-muted-foreground">
          <p>No equipment requests yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Equipment Request
          </Button>
        </div>
        <AddRequestDialog open={showAdd} onClose={() => setShowAdd(false)} requestType="equipment" />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Job</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Equipment</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell>
                    <Link href={`/repairs/${req.repairJobId}`} className="font-mono text-xs text-sky-600 dark:text-sky-400 hover:underline">
                      {req.jobRef}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{req.jobTitle}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{req.partName ?? "—"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_COLORS[req.status] ?? ""}>
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {req.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <AddRequestDialog open={showAdd} onClose={() => setShowAdd(false)} requestType="equipment" />
    </>
  );
}
