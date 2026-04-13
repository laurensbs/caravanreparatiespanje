"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, Trash2 } from "lucide-react";

export interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

const TAG_COLORS = [
  "#6b7280", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
];

interface TagPickerProps {
  allTags: TagItem[];
  activeTags: TagItem[];
  onAdd: (tagId: string) => Promise<void>;
  onRemove: (tagId: string) => Promise<void>;
  onCreate?: (data: { name: string; color: string }) => Promise<void>;
  onDelete?: (tagId: string) => Promise<void>;
}

export function TagPicker({ allTags, activeTags, onAdd, onRemove, onCreate, onDelete }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeIds = new Set(activeTags.map((t) => t.id));
  const available = allTags.filter((t) => !activeIds.has(t.id));

  // Inline create state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);

  function handleAdd(tagId: string) {
    startTransition(async () => {
      await onAdd(tagId);
    });
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      await onRemove(tagId);
    });
  }

  function handleCreate() {
    if (!newName.trim() || !onCreate) return;
    startTransition(async () => {
      await onCreate({ name: newName.trim(), color: newColor });
      setNewName("");
      setNewColor(TAG_COLORS[0]);
      setShowCreate(false);
    });
  }

  function handleDelete(tagId: string, tagName: string) {
    if (!onDelete) return;
    if (!confirm(`Delete tag "${tagName}"?`)) return;
    startTransition(async () => {
      await onDelete(tagId);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="gap-1 rounded-full text-[11px] px-2 py-0.5 pr-1"
          style={{ borderColor: tag.color ?? undefined }}
        >
          {tag.color && (
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
          )}
          {tag.name}
          <button
            type="button"
            onClick={() => handleRemove(tag.id)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted transition-colors"
            disabled={pending}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setShowCreate(false); setNewName(""); } }}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="start">
          {available.length === 0 && !onCreate ? (
            <p className="px-2 py-3 text-xs text-center text-muted-foreground">
              {allTags.length === 0 ? (
                <>No tags yet — create them in <span className="font-medium">Settings → Tags</span></>
              ) : (
                "All tags assigned"
              )}
            </p>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto">
                {available.map((tag) => (
                  <div key={tag.id} className="flex items-center group">
                    <button
                      type="button"
                      onClick={() => { handleAdd(tag.id); setOpen(false); }}
                      disabled={pending}
                      className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors min-w-0"
                    >
                      {tag.color && (
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      )}
                      <span className="truncate">{tag.name}</span>
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(tag.id, tag.name)}
                        disabled={pending}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/50 hover:text-red-500 transition-all shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
                {/* Also show active tags with delete option */}
                {onDelete && activeTags.length > 0 && available.length > 0 && (
                  <div className="border-t border-border/50 my-1" />
                )}
                {onDelete && activeTags.map((tag) => (
                  <div key={tag.id} className="flex items-center group">
                    <span className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground/60 min-w-0">
                      {tag.color && (
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 opacity-50" style={{ backgroundColor: tag.color }} />
                      )}
                      <span className="truncate">{tag.name}</span>
                      <span className="text-[10px]">✓</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(tag.id, tag.name)}
                      disabled={pending}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/50 hover:text-red-500 transition-all shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Create new tag */}
              {onCreate && (
                <>
                  <div className="border-t border-border/50 my-1" />
                  {!showCreate ? (
                    <button
                      type="button"
                      onClick={() => setShowCreate(true)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      New tag…
                    </button>
                  ) : (
                    <div className="p-2 space-y-2">
                      <input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Tag name..."
                        className="w-full h-7 rounded-md border px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreate();
                          if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
                        }}
                      />
                      <div className="flex flex-wrap gap-1">
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewColor(c)}
                            className={`h-5 w-5 rounded-full border-2 transition-colors ${
                              newColor === c ? "border-foreground scale-110" : "border-transparent"
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-7 text-xs rounded-md"
                          onClick={() => { setShowCreate(false); setNewName(""); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-7 text-xs rounded-md"
                          onClick={handleCreate}
                          disabled={!newName.trim() || pending}
                        >
                          Create
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Read-only tag badges (for tables / quickviews) */
export function TagBadges({ tags }: { tags: TagItem[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge
          key={tag.id}
          variant="outline"
          className="gap-1 rounded-full text-[10px] px-1.5 py-0"
          style={{ borderColor: tag.color ?? undefined }}
        >
          {tag.color && (
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
          )}
          {tag.name}
        </Badge>
      ))}
    </div>
  );
}
