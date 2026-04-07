"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, ExternalLink, Search } from "lucide-react";
import { createPart, updatePart, deletePart } from "@/actions/parts";

interface Part {
  id: string;
  name: string;
  partNumber: string | null;
  supplierName: string | null;
  supplierId: string | null;
  defaultCost: string | null;
  description: string | null;
  orderUrl: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface PartsClientProps {
  parts: Part[];
  suppliers: Supplier[];
}

export function PartsClient({ parts, suppliers }: PartsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  const filtered = parts.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.partNumber?.toLowerCase().includes(q) ?? false) ||
      (p.supplierName?.toLowerCase().includes(q) ?? false) ||
      (p.description?.toLowerCase().includes(q) ?? false)
    );
  });

  function openCreate() {
    setEditingPart(null);
    setDialogOpen(true);
  }

  function openEdit(part: Part) {
    setEditingPart(part);
    setDialogOpen(true);
  }

  function handleDelete(part: Part) {
    if (!confirm(`Delete "${part.name}"?`)) return;
    startTransition(async () => {
      await deletePart(part.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search parts..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Part
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPart ? "Edit Part" : "Add Part"}</DialogTitle>
            </DialogHeader>
            <PartForm
              part={editingPart}
              suppliers={suppliers}
              onDone={() => {
                setDialogOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search ? "No parts match your search." : "No parts in catalog yet. Click \"Add Part\" to create one."}
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Part Number</TableHead>
                <TableHead className="hidden md:table-cell">Supplier</TableHead>
                <TableHead>Part Cost</TableHead>
                <TableHead>Our Price</TableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                <TableHead>Order Link</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((part) => (
                <TableRow key={part.id}>
                  <TableCell className="font-medium">{part.name}</TableCell>
                  <TableCell className="font-mono text-xs">{part.partNumber ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{part.supplierName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{part.defaultCost ? `€${part.defaultCost}` : "—"}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {part.defaultCost
                      ? `€${(parseFloat(part.defaultCost) * 1.25).toFixed(2)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-xs truncate">
                    {part.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    {part.orderUrl ? (
                      <a
                        href={part.orderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Order
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(part)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(part)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PartForm({
  part,
  suppliers,
  onDone,
}: {
  part: Part | null;
  suppliers: Supplier[];
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(part?.name ?? "");
  const [partNumber, setPartNumber] = useState(part?.partNumber ?? "");
  const [supplierId, setSupplierId] = useState(part?.supplierId ?? "");
  const [defaultCost, setDefaultCost] = useState(part?.defaultCost ?? "");
  const [description, setDescription] = useState(part?.description ?? "");
  const [orderUrl, setOrderUrl] = useState(part?.orderUrl ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      if (part) {
        await updatePart(part.id, {
          name: name.trim(),
          partNumber: partNumber.trim() || null,
          supplierId: supplierId || null,
          defaultCost: defaultCost.trim() || null,
          description: description.trim() || null,
          orderUrl: orderUrl.trim() || null,
        });
      } else {
        await createPart({
          name: name.trim(),
          partNumber: partNumber.trim() || undefined,
          supplierId: supplierId || undefined,
          defaultCost: defaultCost.trim() || undefined,
          description: description.trim() || undefined,
          orderUrl: orderUrl.trim() || undefined,
        });
      }
      onDone();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Window seal 60cm" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="partNumber">Part Number</Label>
          <Input id="partNumber" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} placeholder="e.g. WS-060" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cost">Part Cost (€)</Label>
          <Input id="cost" value={defaultCost} onChange={(e) => setDefaultCost(e.target.value)} placeholder="0.00" />
          {defaultCost && !isNaN(parseFloat(defaultCost)) && (
            <p className="text-xs text-muted-foreground">
              Our price: <span className="font-medium text-foreground">€{(parseFloat(defaultCost) * 1.25).toFixed(2)}</span> (25% markup)
            </p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="supplier">Supplier</Label>
        <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="orderUrl">Order URL</Label>
        <Input id="orderUrl" value={orderUrl} onChange={(e) => setOrderUrl(e.target.value)} placeholder="https://supplier.com/product/..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending || !name.trim()}>
          {isPending ? "Saving..." : part ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
