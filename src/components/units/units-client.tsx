"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkflowGuide } from "@/components/workflow-guide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, X, Truck } from "lucide-react";
import Link from "next/link";
import { UnitDialog } from "./unit-dialog";
import { NewUnitDialog } from "./new-unit-dialog";

interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

interface UnitRow {
  id: string;
  registration: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  chassisId: string | null;
  customerId: string | null;
  customerName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UnitsClientProps {
  units: UnitRow[];
  total: number;
  page: number;
  limit: number;
  currentQ?: string;
  currentTagId?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
  allTags: TagItem[];
  customers?: { id: string; name: string }[];
}

export function UnitsClient({ units, total, page, limit, currentQ, currentTagId, currentDateFrom, currentDateTo, allTags, customers = [] }: UnitsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentQ ?? "");
  const [selectedUnit, setSelectedUnit] = useState<UnitRow | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const totalPages = Math.ceil(total / limit);

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`/units?${params.toString()}`);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setSearchInput(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => updateParams({ q: q || undefined }), 300);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Units</h1>
          <p className="text-sm text-muted-foreground">
            {total} unit{total !== 1 ? "s" : ""} registered
          </p>
        </div>
        <NewUnitDialog customers={customers} />
      </div>

      <WorkflowGuide page="units" />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1 min-w-0 sm:max-w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search registration, brand, model..."
              className="w-full pl-8 h-8 text-xs rounded-lg"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

        {allTags.length > 0 && (
          <Select
            value={currentTagId ?? "all"}
            onValueChange={(v) => updateParams({ tagId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs rounded-lg">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-1.5">
                    {tag.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />}
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Input
          type="date"
          className="w-[130px] h-8 text-xs rounded-lg"
          value={currentDateFrom ?? ""}
          onChange={(e) => updateParams({ dateFrom: e.target.value || undefined })}
          placeholder="From"
        />
        <Input
          type="date"
          className="w-[130px] h-8 text-xs rounded-lg"
          value={currentDateTo ?? ""}
          onChange={(e) => updateParams({ dateTo: e.target.value || undefined })}
          placeholder="To"
        />

        {(currentQ || currentTagId || currentDateFrom || currentDateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              router.push("/units");
            }}
          >
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Registration</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Customer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Truck className="h-8 w-8 opacity-20" />
                    <p className="font-medium text-sm">No units found</p>
                    <p className="text-xs">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              units.map((u, idx) => (
                <TableRow
                  key={u.id}
                  className="group interactive-row table-row-animate"
                  style={{ animationDelay: `${idx * 20}ms` }}
                  onClick={() => setSelectedUnit(u)}
                >
                  <TableCell className="font-mono text-[13px] font-medium group-hover:text-primary transition-colors">
                    {u.registration ?? "—"}
                  </TableCell>
                  <TableCell className="text-[13px]">{u.customerName ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" asChild>
                <Link href={`/units?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page - 1) }).toString()}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/units?${new URLSearchParams({ ...Object.fromEntries(searchParams), page: String(page + 1) }).toString()}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Unit detail popup */}
      {selectedUnit && (
        <UnitDialog
          unit={selectedUnit}
          open={!!selectedUnit}
          onOpenChange={(open) => { if (!open) setSelectedUnit(null); }}
          allTags={allTags}
        />
      )}
    </div>
  );
}
