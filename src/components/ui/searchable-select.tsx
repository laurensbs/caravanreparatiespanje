"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";

export interface SearchableOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Search...",
  emptyLabel = "None",
  className,
  disabled,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = search.length > 0
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.description?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(optionValue: string) {
    onValueChange(optionValue);
    setOpen(false);
    setSearch("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onValueChange("");
    setSearch("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center h-9 w-full rounded-lg border border-input bg-background px-3 text-sm cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          open && "ring-2 ring-ring ring-offset-1"
        )}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setSearch("");
              }
              if (e.key === "Enter" && filtered.length > 0) {
                handleSelect(filtered[0].value);
              }
            }}
          />
        ) : (
          <span className={cn("flex-1 truncate", !selectedOption && "text-muted-foreground")}>
            {selectedOption?.label ?? emptyLabel}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {value && !open && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-sm p-0.5 hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
          <div className="max-h-48 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={cn(
                "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors text-left",
                !value && "bg-accent"
              )}
            >
              <Check className={cn("h-3 w-3 shrink-0", value ? "invisible" : "visible")} />
              <span className="text-muted-foreground">{emptyLabel}</span>
            </button>
            {filtered.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-3 text-center">No results</p>
            ) : (
              filtered.slice(0, 50).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors text-left",
                    value === option.value && "bg-accent"
                  )}
                >
                  <Check className={cn("h-3 w-3 shrink-0", value === option.value ? "visible" : "invisible")} />
                  <div className="min-w-0 flex-1">
                    <span className="truncate block">{option.label}</span>
                    {option.description && (
                      <span className="text-[10px] text-muted-foreground truncate block">{option.description}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
