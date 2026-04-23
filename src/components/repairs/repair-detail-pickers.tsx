"use client";

/**
 * Pickers + small card widgets that used to live inline in
 * `repair-detail.tsx`. Pulled out for two reasons:
 *   1. Re-render isolation — the parent is a 3.7k-line file with 70+
 *      useState calls; every keystroke triggered a walk through these
 *      pickers even when their own props hadn't changed.
 *   2. Maintainability — these components are self-contained, they
 *      consume only their own props and a few label/color maps.
 */

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { JOB_TYPE_COLORS, JOB_TYPE_LABELS, SELECTABLE_JOB_TYPES, STATUS_COLORS, STATUS_LABELS } from "@/types";
import type { JobType, RepairStatus } from "@/types";
import { deleteRepairPhoto } from "@/actions/photos";
import { toast } from "sonner";
import { ImageLightbox } from "@/components/ui/image-lightbox";

// ─── Photo card with hover actions + lightbox ─────────────────────────────

export function PhotoCard({
  photo,
}: {
  photo: {
    id: string;
    url: string;
    thumbnailUrl: string | null;
    caption: string | null;
    photoType: string | null;
    createdAt: Date | string;
  };
}) {
  const [deleting, startDelete] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="group relative rounded-lg overflow-hidden border border-border/50 bg-muted/20">
        <button onClick={() => setExpanded(true)} className="w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.thumbnailUrl || photo.url}
            alt={photo.caption || "Photo"}
            className="aspect-square w-full object-cover"
          />
        </button>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-center gap-1 p-1 opacity-0 group-hover:opacity-100">
          <a
            href={photo.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-card/90 p-1.5 hover:bg-card transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-foreground" />
          </a>
          <button
            disabled={deleting}
            onClick={() => {
              startDelete(async () => {
                try {
                  await deleteRepairPhoto(photo.id);
                  toast.success("Photo deleted");
                  router.refresh();
                } catch {
                  toast.error("Failed to delete photo");
                }
              });
            }}
            className="rounded-md bg-card/90 p-1.5 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600" />
          </button>
        </div>
        {photo.caption && (
          <p className="px-1.5 py-1 text-[10px] text-muted-foreground truncate">
            {photo.caption}
          </p>
        )}
      </div>

      {expanded && (
        <ImageLightbox
          images={[{ src: photo.url, alt: photo.caption ?? undefined }]}
          index={0}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}

// ─── Customer-repairs sidebar card ────────────────────────────────────────

export interface CustomerRepairItem {
  id: string;
  publicCode: string | null;
  title: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

export function CustomerRepairsCard({
  repairs,
  customerName,
}: {
  repairs: CustomerRepairItem[];
  customerName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? repairs : repairs.slice(0, 5);

  return (
    <Card className="rounded-xl">
      <CardContent className="pt-5">
        <p className="flex items-center gap-2 text-xs font-semibold mb-3">
          <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
          {customerName}&apos;s Repairs
          <span className="text-muted-foreground font-normal">({repairs.length})</span>
        </p>
        <div className="space-y-1">
          {shown.map((r) => (
            <Link
              key={r.id}
              href={`/repairs/${r.id}`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors group"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium group-hover:text-primary truncate block">
                  {r.publicCode ? `${r.publicCode} — ` : ""}
                  {r.title ?? "Untitled"}
                </span>
                {r.completedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(r.completedAt), "dd MMM yyyy")}
                  </span>
                )}
              </div>
              <Badge
                variant="secondary"
                className={`text-[9px] px-1.5 py-0 shrink-0 ml-2 ${STATUS_COLORS[r.status as RepairStatus] ?? ""}`}
              >
                {STATUS_LABELS[r.status as RepairStatus] ?? r.status}
              </Badge>
            </Link>
          ))}
        </div>
        {repairs.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground mt-1"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" /> Show all {repairs.length}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Job-type picker (inline dropdown badge) ──────────────────────────────

const JOB_TYPE_ICON: Record<JobType, React.ElementType> = {
  repair: Wrench,
  wax: Sparkles,
  maintenance: Settings,
  inspection: ClipboardCheck,
  service: Sparkles,
};

export function JobTypePicker({
  value,
  onChange,
}: {
  value: JobType;
  onChange: (v: JobType) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const Icon = JOB_TYPE_ICON[value];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-gray-300",
          JOB_TYPE_COLORS[value],
        )}
      >
        <Icon className="h-3 w-3" />
        {JOB_TYPE_LABELS[value]}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card dark:bg-foreground border border-border dark:border-border rounded-xl shadow-lg p-1 min-w-[160px]">
          {/* Legacy job-types blijven als value zichtbaar, maar de
              dropdown laat alleen nog de huidige keuzes toe. Als de
              work-order op een legacy-type staat verschijnt hij ook
              in de lijst zodat je hem kunt wisselen. */}
          {Array.from(new Set<JobType>([...SELECTABLE_JOB_TYPES, value])).map((type) => {
            const TypeIcon = JOB_TYPE_ICON[type];
            const active = value === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onChange(type);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  active
                    ? "bg-muted dark:bg-foreground/[0.08] text-foreground dark:text-foreground"
                    : "text-muted-foreground dark:text-muted-foreground/70 hover:bg-muted/40 dark:hover:bg-foreground/[0.05]",
                )}
              >
                <TypeIcon className="h-3.5 w-3.5" />
                {JOB_TYPE_LABELS[type]}
                {active && <CheckCircle className="h-3 w-3 ml-auto text-green-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Status picker ────────────────────────────────────────────────────────

const STATUS_GROUPS = [
  { label: "Intake", items: ["new", "todo", "in_inspection", "no_damage"] },
  {
    label: "Quote",
    items: ["quote_needed", "waiting_approval", "waiting_customer"],
  },
  {
    label: "Work",
    items: [
      "waiting_parts",
      "scheduled",
      "in_progress",
      "blocked",
      "ready_for_check",
    ],
  },
  { label: "Done", items: ["completed", "invoiced", "rejected", "archived"] },
] as const;

const STATUS_DOT_COLORS: Record<string, string> = {
  new: "bg-muted-foreground/40",
  todo: "bg-muted-foreground/40",
  in_inspection: "bg-blue-500",
  quote_needed: "bg-amber-500",
  waiting_approval: "bg-amber-500",
  waiting_customer: "bg-orange-500",
  waiting_parts: "bg-amber-500",
  no_damage: "bg-muted-foreground/40",
  scheduled: "bg-blue-400",
  in_progress: "bg-foreground/80",
  blocked: "bg-red-500",
  ready_for_check: "bg-amber-500",
  completed: "bg-emerald-500",
  invoiced: "bg-emerald-400",
  rejected: "bg-red-500",
  archived: "bg-muted-foreground/40",
};

export function StatusPicker({
  value,
  onChange,
  badgeColor,
  variant = "pill",
}: {
  value: string;
  onChange: (v: string) => void;
  badgeColor?: string;
  variant?: "pill" | "select";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const triggerPill = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-gray-300",
        badgeColor,
      )}
    >
      {STATUS_LABELS[value as RepairStatus]}
      <ChevronDown
        className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
      />
    </button>
  );

  const triggerSelect = (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className="flex items-center justify-between w-full h-11 rounded-xl border border-border dark:border-border bg-card dark:bg-card/5 px-3 text-sm font-medium text-foreground dark:text-foreground transition-all hover:border-foreground/20 dark:hover:border-foreground/30"
    >
      <span className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[value] ?? "bg-muted-foreground/40"}`}
        />
        {STATUS_LABELS[value as RepairStatus]}
      </span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 text-muted-foreground/70 transition-transform",
          open && "rotate-180",
        )}
      />
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      {variant === "select" ? triggerSelect : triggerPill}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card dark:bg-foreground border border-border dark:border-border rounded-xl shadow-lg p-1 min-w-[180px] max-h-[360px] overflow-y-auto">
          {STATUS_GROUPS.map((group) => (
            <div key={group.label} className="mb-0.5 last:mb-0">
              <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/50 dark:text-muted-foreground px-3 pt-2 pb-0.5">
                {group.label}
              </p>
              {group.items.map((val) => {
                const active = value === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      onChange(val);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      active
                        ? "bg-muted dark:bg-foreground/[0.08] text-foreground dark:text-foreground"
                        : "text-muted-foreground dark:text-muted-foreground/70 hover:bg-muted/40 dark:hover:bg-foreground/[0.05]",
                    )}
                  >
                    {STATUS_LABELS[val as RepairStatus]}
                    {active && (
                      <CheckCircle className="h-3 w-3 ml-auto text-green-500" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Generic inline pill picker ───────────────────────────────────────────

export function InlinePillPicker({
  value,
  onChange,
  options,
  colorMap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  colorMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const badgeColor =
    colorMap[value] ??
    "bg-muted text-muted-foreground border-border dark:bg-foreground/[0.08] dark:text-muted-foreground/50 dark:border-border";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-gray-300 border",
          badgeColor,
        )}
      >
        {options[value] ?? value}
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card dark:bg-foreground border border-border dark:border-border rounded-xl shadow-lg p-1 min-w-[160px] max-h-[300px] overflow-y-auto">
          {Object.entries(options).map(([val, label]) => {
            const active = value === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onChange(val);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  active
                    ? "bg-muted dark:bg-foreground/[0.08] text-foreground dark:text-foreground"
                    : "text-muted-foreground dark:text-muted-foreground/70 hover:bg-muted/40 dark:hover:bg-foreground/[0.05]",
                )}
              >
                {label}
                {active && <CheckCircle className="h-3 w-3 ml-auto text-green-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
