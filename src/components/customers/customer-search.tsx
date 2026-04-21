"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Users, X, Plus } from "lucide-react";
import { createCustomer } from "@/actions/customers";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  // Optionele search-velden — leeg in legacy callers, de picker werkt nog.
  vatnumber?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  holdedContactId?: string | null;
  plates?: string | null; // komma-gescheiden kentekens
}

interface CustomerSearchProps {
  customers: Customer[];
  value?: string;
  onSelect: (customerId: string | null) => void;
}

export function CustomerSearch({ customers, value, onSelect }: CustomerSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedName, setSelectedName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const c = customers.find((c) => c.id === value);
      if (c) setSelectedName(c.name);
    }
  }, [value, customers]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query.length >= 1
    ? (() => {
        // Normaliseer kentekens: spaties/streepjes weghalen voor de match
        // zodat "XR AB 42", "XR-AB-42" en "xrab42" gelijk matchen.
        const q = query.toLowerCase().trim();
        const qPlate = q.replace(/[\s-]/g, "");
        return customers.filter((c) => {
          if (c.name.toLowerCase().includes(q)) return true;
          if (c.vatnumber && c.vatnumber.toLowerCase().includes(q)) return true;
          if (c.holdedContactId && c.holdedContactId.toLowerCase().includes(q)) return true;
          if (c.phone && c.phone.toLowerCase().includes(q)) return true;
          if (c.mobile && c.mobile.toLowerCase().includes(q)) return true;
          if (c.email && c.email.toLowerCase().includes(q)) return true;
          if (
            c.plates &&
            c.plates.toLowerCase().replace(/[\s-]/g, "").includes(qPlate)
          )
            return true;
          return false;
        }).slice(0, 8);
      })()
    : [];

  function handleSelect(customer: Customer) {
    setSelectedName(customer.name);
    setQuery("");
    setOpen(false);
    setShowCreate(false);
    onSelect(customer.id);
  }

  function handleClear() {
    setSelectedName("");
    setQuery("");
    onSelect(null);
    inputRef.current?.focus();
  }

  async function handleCreateCustomer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      const customer = await createCustomer({
        name: fd.get("name"),
        phone: fd.get("phone") || undefined,
        email: fd.get("email") || undefined,
        contactType: "person",
      });
      customers.push({ id: customer.id, name: customer.name });
      handleSelect({ id: customer.id, name: customer.name });
      toast.success(`${customer.name} created & synced to Holded`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create contact");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {selectedName ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate flex-1">{selectedName}</span>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-sm p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search by name, plate, phone or VAT…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setShowCreate(false);
          }}
          onFocus={() => { if (query.length >= 1) setOpen(true); }}
        />
      )}

      {open && !showCreate && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg animate-fade-in">
          {filtered.map((c) => {
            const meta = [c.plates, c.phone ?? c.mobile, c.vatnumber]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="flex w-full items-start gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="truncate block">{c.name}</span>
                  {meta && (
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {meta}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-muted transition-colors text-left border-t"
          >
            <Plus className="h-3.5 w-3.5" />
            New contact...
          </button>
        </div>
      )}

      {open && !showCreate && query.length >= 1 && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-lg animate-fade-in">
          <div className="px-3 py-2 text-sm text-muted-foreground">No contacts found</div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-muted transition-colors text-left border-t"
          >
            <Plus className="h-3.5 w-3.5" />
            Create &quot;{query}&quot;...
          </button>
        </div>
      )}

      {showCreate && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-lg p-3 animate-fade-in">
          <p className="text-xs font-semibold mb-2">Quick add contact</p>
          <form onSubmit={handleCreateCustomer} className="space-y-2">
            <div>
              <Label className="text-[11px]">Name *</Label>
              <Input name="name" required defaultValue={query} className="h-8 text-xs mt-0.5" autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px]">Phone</Label>
                <Input name="phone" className="h-8 text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-[11px]">Email</Label>
                <Input name="email" type="email" className="h-8 text-xs mt-0.5" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={creating}>
                {creating ? <Spinner className="mr-1 h-3 w-3" /> : <Plus className="mr-1 h-3 w-3" />}
                Create
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
