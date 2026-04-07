"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { STATUS_LABELS } from "@/types";
import type { RepairStatus } from "@/types";

interface Props {
  importBatch: any;
  statusBreakdown: { status: string; count: number }[];
  confidenceBreakdown: { confidence: string | null; count: number }[];
  lowConfidenceRows: any[];
  sheetBreakdown: { sheet: string; count: number }[];
  duplicateCount: number;
}

const STATUS_ROW_COLORS: Record<string, string> = {
  imported: "text-green-600",
  skipped: "text-muted-foreground",
  error: "text-destructive",
  duplicate: "text-amber-600",
  pending: "text-blue-600",
  merged: "text-purple-600",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  manual: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export function ImportReviewClient({
  importBatch,
  statusBreakdown,
  confidenceBreakdown,
  lowConfidenceRows,
  sheetBreakdown,
  duplicateCount,
}: Props) {
  const totalRows = statusBreakdown.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/import">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Import Review</h1>
            <Badge
              variant={
                importBatch.status === "completed"
                  ? "default"
                  : importBatch.status === "completed_with_errors"
                    ? "secondary"
                    : "destructive"
              }
            >
              {importBatch.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            <FileSpreadsheet className="mr-1 inline h-4 w-4" />
            {importBatch.filename} —{" "}
            {importBatch.createdAt
              ? format(new Date(importBatch.createdAt), "dd MMM yyyy HH:mm")
              : "Unknown date"}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalRows}</div>
            <p className="text-xs text-muted-foreground">Total Rows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {importBatch.importedRows}
            </div>
            <p className="text-xs text-muted-foreground">Imported</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">
              {importBatch.lowConfidenceRows}
            </div>
            <p className="text-xs text-muted-foreground">Low Confidence</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-600">
              {duplicateCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending Duplicates
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sheet Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Sheets Processed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sheetBreakdown.map((s) => (
                <div
                  key={s.sheet}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{s.sheet}</span>
                  <Badge variant="secondary">{s.count} rows</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Confidence Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Status Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {confidenceBreakdown.map((c) => (
                <div
                  key={c.confidence ?? "none"}
                  className="flex items-center justify-between text-sm"
                >
                  <Badge
                    variant="secondary"
                    className={CONFIDENCE_COLORS[c.confidence ?? ""] ?? ""}
                  >
                    {c.confidence ?? "No confidence"}
                  </Badge>
                  <span className="font-medium">{c.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Row Status Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Row Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {statusBreakdown.map((s) => (
                <div
                  key={s.status}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className={`font-medium ${STATUS_ROW_COLORS[s.status] ?? ""}`}
                  >
                    {s.status}
                  </span>
                  <Badge variant="outline">{s.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Confidence Rows */}
      {lowConfidenceRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Low Confidence Rows ({lowConfidenceRows.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Sheet</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Inferred Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowConfidenceRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.sourceRowNumber}
                      </TableCell>
                      <TableCell className="text-xs">{row.sourceSheet}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs">
                        {row.mappedCustomer || "—"}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-xs">
                        {row.mappedIssue || row.originalJoinedText?.slice(0, 100) || "—"}
                      </TableCell>
                      <TableCell>
                        {row.inferredStatus ? (
                          <Badge
                            variant="secondary"
                            className={CONFIDENCE_COLORS.low}
                          >
                            {STATUS_LABELS[row.inferredStatus as RepairStatus] ??
                              row.inferredStatus}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {row.inferredStatusReason || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {importBatch.warnings && importBatch.warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {importBatch.warnings.map((w: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-amber-500 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
