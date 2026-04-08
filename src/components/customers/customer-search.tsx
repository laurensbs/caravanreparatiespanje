"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
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
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query.length >= 1
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  function handleSelect(customer: Customer) {
    setSelectedName(customer.name);
    setQuery("");
    setOpen(false);
    onSelect(customer.id);
  }

  function handleClear() {
    setSelectedName("");
    setQuery("");
    onSelect(null);
    inputRef.current?.focus();
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
          placeholder="Type to search contacts..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => { if (query.length >= 1) setOpen(true); }}
        />
      )}

      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-lg animate-fade-in">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
            >
              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 1 && filtered.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
          No contacts found
        </div>
      )}
    </div>
  );
}
