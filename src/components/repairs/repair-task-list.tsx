"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addRepairTask, deleteRepairTask, approveGarageTask, getRepairTasks, updateTaskStatus } from "@/actions/garage";
import { searchParts, createPartRequest, removePartRequest, linkPartRequestToTask } from "@/actions/parts";
import { ICON_MAP, type PartCategory } from "@/components/parts/parts-client";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types";
import type { RepairTask, RepairTaskStatus } from "@/types";
import { Plus, Trash2, CheckCircle, Clock, Package, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PartRequestRow } from "@/components/parts/repair-parts-used";

interface Props {
  repairJobId: string;
  initialTasks: RepairTask[];
  totalLoggedMinutes?: number;
  partRequests?: PartRequestRow[];
  defaultMarkup?: number;
  partCategories?: PartCategory[];
}

const DEFAULT_TASKS = [
  { title: "Check everything", titleEs: "Revisar toda la caravana", titleNl: "Controle hele caravan" },
  { title: "Water test", titleEs: "Prueba de agua", titleNl: "Watertest" },
  { title: "Electric check", titleEs: "Revisión eléctrica", titleNl: "Elektra controle" },
  { title: "Gas check", titleEs: "Revisión de gas", titleNl: "Gas controle" },
  { title: "Roof inspection", titleEs: "Inspección del techo", titleNl: "Dak inspectie" },
] as const;

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function RepairTaskList({
  repairJobId,
  initialTasks,
  totalLoggedMinutes = 0,
  partRequests = [],
  defaultMarkup = 0,
  partCategories = [],
}: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [pickerForTaskId, setPickerForTaskId] = useState<string | null>(null);

  function refresh() {
    startTransition(async () => {
      const updated = await getRepairTasks(repairJobId);
      setTasks(updated);
    });
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    const match = DEFAULT_TASKS.find((d) => d.title === newTitle.trim());
    startTransition(async () => {
      const task = await addRepairTask(repairJobId, {
        title: newTitle.trim(),
        titleEs: match?.titleEs,
        titleNl: match?.titleNl,
      });
      setNewTitle("");
      setShowAdd(false);
      refresh();
      router.refresh();
      toast.success("Task added");
      // Direct de part-picker openen voor de nieuwe task, zodat de
      // gebruiker meteen een onderdeel kan toevoegen als hij wil.
      if (task?.id) setPickerForTaskId(task.id);
    });
  }

  function handleDelete(taskId: string) {
    startTransition(async () => {
      await deleteRepairTask(taskId);
      refresh();
      router.refresh();
      toast.success("Task removed");
    });
  }

  function handleToggleDone(task: RepairTask) {
    const next = task.status === "done" ? "pending" : "done";
    startTransition(async () => {
      await updateTaskStatus(task.id, next);
      refresh();
      router.refresh();
      toast.success(next === "done" ? "Task completed" : "Task reopened");
    });
  }

  function handleApprove(taskId: string) {
    startTransition(async () => {
      await approveGarageTask(taskId);
      refresh();
      toast.success("Task approved");
    });
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
          <span>
            Tasks
            {tasks.length > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                doneCount === tasks.length
                  ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {doneCount}/{tasks.length}
              </span>
            )}
          </span>
          {totalLoggedMinutes > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/70 dark:text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatMinutes(totalLoggedMinutes)}
            </span>
          )}
        </p>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-0.5"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="space-y-2 mb-2">
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task name..."
              className="h-7 text-xs rounded-lg"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setShowAdd(false); setNewTitle(""); }
              }}
              autoFocus
            />
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={isPending || !newTitle.trim()}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {DEFAULT_TASKS.filter((d) => !tasks.some((t) => t.title === d.title)).map((d) => (
              <button
                key={d.title}
                onClick={() => {
                  startTransition(async () => {
                    await addRepairTask(repairJobId, { title: d.title, titleEs: d.titleEs, titleNl: d.titleNl });
                    refresh();
                    toast.success("Task added");
                  });
                }}
                disabled={isPending}
                className="text-xs px-2.5 py-1 rounded-lg border border-border dark:border-border text-muted-foreground dark:text-muted-foreground/70 hover:bg-muted dark:hover:bg-foreground/[0.10] font-medium transition-colors"
              >
                + {d.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length > 0 ? (
        <div className="space-y-1">
          {tasks.map((task) => {
            const taskParts = partRequests.filter((p) => p.repairTaskId === task.id && p.status !== "cancelled");
            return (
              <div key={task.id}>
                <div
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs group ${
                    task.status === "problem" ? "bg-red-50/60 dark:bg-red-950/20" : "bg-card/60 dark:bg-card/5"
                  } ${task.status === "done" ? "opacity-50" : ""} border border-border/40`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleDone(task)}
                    disabled={isPending}
                    title={task.status === "done" ? "Mark as not done" : "Mark as done"}
                    className={`h-5 w-5 flex items-center justify-center text-[11px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                      task.status === "done"
                        ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10"
                        : task.status === "problem"
                        ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {task.status === "done" ? "✓" : task.status === "problem" ? "⚠" : task.status === "in_progress" ? "◐" : "○"}
                  </button>
                  <span className={`flex-1 truncate ${task.status === "done" ? "line-through" : ""}`}>
                    {task.title}
                  </span>
                  <Badge className={`text-[10px] shrink-0 ${TASK_STATUS_COLORS[task.status as RepairTaskStatus]}`}>
                    {TASK_STATUS_LABELS[task.status as RepairTaskStatus]}
                  </Badge>
                  {task.source === "garage" && !task.approvedAt && (
                    <button
                      className="h-5 px-1 text-green-700 hover:bg-green-100 rounded transition-colors"
                      onClick={() => handleApprove(task.id)}
                      title="Approve"
                    >
                      <CheckCircle className="h-3 w-3" />
                    </button>
                  )}
                  {task.problemCategory && (
                    <span className="text-[10px] text-red-600 shrink-0" title={task.problemNote ?? undefined}>
                      {task.problemCategory.replace("_", " ")}
                    </span>
                  )}
                  <button
                    onClick={() => setPickerForTaskId(pickerForTaskId === task.id ? null : task.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-foreground font-medium flex items-center gap-0.5 shrink-0 transition-all"
                    title="Add part for this task"
                  >
                    <Package className="h-3 w-3" /> Part
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-all shrink-0"
                    onClick={() => handleDelete(task.id)}
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>

                {/* Parts linked to this task */}
                {taskParts.length > 0 && (
                  <div className="ml-6 mt-1 flex flex-wrap gap-1">
                    {taskParts.map((pr) => (
                      <TaskPartChip
                        key={pr.id}
                        pr={pr}
                        onRemoved={() => {
                          router.refresh();
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Inline part picker for this task */}
                {pickerForTaskId === task.id && (
                  <div className="ml-6 mt-1">
                    <TaskPartPicker
                      repairJobId={repairJobId}
                      repairTaskId={task.id}
                      defaultMarkup={defaultMarkup}
                      partCategories={partCategories}
                      jobPartRequests={partRequests}
                      onAdded={() => {
                        router.refresh();
                      }}
                      onClose={() => setPickerForTaskId(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}

        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No tasks yet. Add tasks for the technicians.</p>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Inline part chip (linked to a specific task)
// ──────────────────────────────────────────────

function TaskPartChip({ pr, onRemoved }: { pr: PartRequestRow; onRemoved: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      try {
        await removePartRequest(pr.id);
        toast.success("Part removed");
        onRemoved();
      } catch {
        toast.error("Failed to remove part");
      }
    });
  }

  const statusIcon =
    pr.status === "received" ? "✓" :
    pr.status === "ordered" ? "📋" :
    pr.status === "shipped" ? "🚚" : "⏳";

  return (
    <span className="inline-flex items-center gap-1 h-5 pl-1.5 pr-0.5 rounded-md text-[10px] font-medium border border-border/60 bg-muted/30 dark:bg-foreground/[0.05] text-muted-foreground dark:text-muted-foreground/80">
      <span>{statusIcon}</span>
      <span className="truncate max-w-[160px]">{pr.partName}</span>
      {pr.quantity > 1 && <span className="text-muted-foreground/70">×{pr.quantity}</span>}
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="ml-0.5 h-4 w-4 flex items-center justify-center rounded hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 disabled:opacity-30 transition-colors"
        title="Remove part"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ──────────────────────────────────────────────
// Inline part picker (scoped to a task)
// ──────────────────────────────────────────────

type SearchResult = {
  id: string;
  name: string;
  partNumber: string | null;
  category: string | null;
  defaultCost: string | null;
  markupPercent: string | null;
  stockQuantity: number | null;
  minStockLevel: number | null;
  supplierName: string | null;
  supplierId: string | null;
};

function TaskPartPicker({
  repairJobId,
  repairTaskId,
  defaultMarkup,
  partCategories,
  jobPartRequests,
  onAdded,
  onClose,
}: {
  repairJobId: string;
  repairTaskId: string;
  defaultMarkup: number;
  partCategories: PartCategory[];
  jobPartRequests: PartRequestRow[];
  onAdded: () => void;
  onClose: () => void;
}) {
  // Parts die al voor deze job zijn aangevraagd maar nog niet aan een
  // task hangen (of die al binnen zijn) — makkelijk te linken zonder
  // een dubbele request te creëren.
  const requestedOnJob = jobPartRequests.filter(
    (p) =>
      p.status !== "cancelled" &&
      p.repairTaskId == null, // nog niet gekoppeld aan een andere task
  );

  const [tab, setTab] = useState<"requested" | "catalog">(
    requestedOnJob.length > 0 ? "requested" : "catalog",
  );
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === "catalog") inputRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    if (tab !== "catalog") return;
    if (query.length < 2 && !selectedCategory) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchParts(query, selectedCategory ?? undefined);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, selectedCategory, tab]);

  function addCatalogPart(part: SearchResult) {
    startTransition(async () => {
      try {
        const baseCost = part.defaultCost ? parseFloat(part.defaultCost) : 0;
        const markup = part.markupPercent ? parseFloat(part.markupPercent) : defaultMarkup;
        const sellPrice = baseCost > 0 ? baseCost * (1 + markup / 100) : 0;
        await createPartRequest({
          repairJobId,
          repairTaskId,
          partId: part.id,
          partName: part.name,
          unitCost: baseCost > 0 ? String(baseCost) : undefined,
          sellPrice: sellPrice > 0 ? String(Math.round(sellPrice * 100) / 100) : undefined,
          markupPercent: markup > 0 ? String(markup) : undefined,
          supplierId: part.supplierId ?? undefined,
        });
        toast.success(`"${part.name}" linked to task`);
        setQuery("");
        setResults([]);
        onAdded();
        onClose();
      } catch {
        toast.error("Failed to add part");
      }
    });
  }

  function addCustomPart() {
    const name = query.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        await createPartRequest({
          repairJobId,
          repairTaskId,
          partName: name,
        });
        toast.success(`"${name}" linked to task`);
        setQuery("");
        setResults([]);
        onAdded();
        onClose();
      } catch {
        toast.error("Failed to add part");
      }
    });
  }

  function linkExisting(pr: PartRequestRow) {
    startTransition(async () => {
      try {
        await linkPartRequestToTask(pr.id, repairTaskId);
        toast.success(`"${pr.partName}" linked to task`);
        onAdded();
        onClose();
      } catch {
        toast.error("Failed to link part");
      }
    });
  }

  const activeCats = partCategories.filter((c) => c.active);

  return (
    <div className="rounded-lg border border-border/60 bg-card/60 dark:bg-card/5 p-2 space-y-2">
      {/* Tabs + close */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTab("requested")}
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded transition-colors",
            tab === "requested"
              ? "bg-foreground text-white dark:bg-muted dark:text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Requested ({requestedOnJob.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("catalog")}
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded transition-colors",
            tab === "catalog"
              ? "bg-foreground text-white dark:bg-muted dark:text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Catalog
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Requested tab */}
      {tab === "requested" && (
        <div>
          {requestedOnJob.length === 0 ? (
            <p className="text-[10px] text-muted-foreground px-1 py-2">
              No unlinked part requests on this job.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded border border-border/40 bg-card">
              {requestedOnJob.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  onClick={() => linkExisting(pr)}
                  disabled={isPending}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/40 flex items-center justify-between gap-2 border-b border-border/30 last:border-b-0"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px]">
                      {pr.status === "received" ? "✓" : pr.status === "ordered" ? "📋" : pr.status === "shipped" ? "🚚" : "⏳"}
                    </span>
                    <span className="truncate">{pr.partName}</span>
                    {pr.quantity > 1 && (
                      <span className="text-[10px] text-muted-foreground">×{pr.quantity}</span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0 capitalize">
                    {pr.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Catalog tab */}
      {tab === "catalog" && (
        <>
          <div className="flex items-center gap-2">
            <Package className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (results.length > 0) addCatalogPart(results[0]);
                  else if (query.trim()) addCustomPart();
                }
                if (e.key === "Escape") onClose();
              }}
              placeholder="Search or type part name..."
              disabled={isPending}
              className="flex-1 h-7 px-2 text-xs rounded border border-border bg-card dark:bg-card/5 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            {isSearching || isPending ? (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/70 shrink-0" />
            ) : null}
          </div>

          {/* Category pills */}
          {activeCats.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activeCats.map((cat) => {
                const Icon = ICON_MAP[cat.icon] ?? Package;
                const isActive = selectedCategory === cat.key;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(isActive ? null : cat.key)}
                    className={cn(
                      "inline-flex items-center gap-1 h-5 px-1.5 rounded text-[10px] font-medium transition-colors",
                      isActive
                        ? "bg-foreground text-white dark:bg-muted dark:text-foreground"
                        : "bg-muted/40 text-muted-foreground hover:text-foreground dark:bg-foreground/[0.08]",
                    )}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}

          {results.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded border border-border/40 bg-card">
              {results.slice(0, 10).map((part) => (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => addCatalogPart(part)}
                  disabled={isPending}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted/40 flex items-center justify-between gap-2 border-b border-border/30 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="truncate block">{part.name}</span>
                    {(part.partNumber || part.category) && (
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {[part.partNumber, part.category].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </span>
                  {part.defaultCost && (
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      €{parseFloat(part.defaultCost).toFixed(2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {query.trim().length >= 2 && (
            <button
              type="button"
              onClick={addCustomPart}
              disabled={isPending}
              className="w-full text-left text-[10px] px-2 py-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"
            >
              + Add &ldquo;{query.trim()}&rdquo; as custom part
            </button>
          )}
        </>
      )}
    </div>
  );
}
