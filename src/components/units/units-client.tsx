"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { UnitDialog } from "./unit-dialog";

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
  currentType?: string;
}

export function UnitsClient({ units, total, page, limit, currentQ, currentType }: UnitsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(currentQ ?? "");
  const [selectedUnit, setSelectedUnit] = useState<UnitRow | null>(null);

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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ q: searchInput || undefined });
  }

  // Derive unique brands for quick filter
  const brands = useMemo(() => {
    const set = new Set(units.map((u) => u.brand).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [units]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Units</h1>
          <p className="text-muted-foreground">
            {total} unit{total !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button asChild>
          <Link href="/units/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Unit
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 min-w-0 sm:max-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search registration, brand, model..."
              className="w-full pl-9"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <Select
          value={currentType ?? "all"}
          onValueChange={(v) => updateParams({ type: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="caravan">Caravan</SelectItem>
            <SelectItem value="trailer">Trailer</SelectItem>
            <SelectItem value="camper">Camper</SelectItem>
          </SelectContent>
        </Select>

        {(currentQ || currentType) && (
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
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Registration</TableHead>
              <TableHead>Customer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-12 text-center text-muted-foreground">
                  No units found
                </TableCell>
              </TableRow>
            ) : (
              units.map((u) => (
                <TableRow
                  key={u.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => setSelectedUnit(u)}
                >
                  <TableCell className="font-mono text-sm font-medium">
                    {u.registration ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{u.customerName ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" asChild>
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
        />
      )}
    </div>
  );
}
