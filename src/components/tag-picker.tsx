"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, Tag } from "lucide-react";

export interface TagItem {
  id: string;
  name: string;
  color: string | null;
}

interface TagPickerProps {
  allTags: TagItem[];
  activeTags: TagItem[];
  onAdd: (tagId: string) => Promise<void>;
  onRemove: (tagId: string) => Promise<void>;
}

export function TagPicker({ allTags, activeTags, onAdd, onRemove }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeIds = new Set(activeTags.map((t) => t.id));
  const available = allTags.filter((t) => !activeIds.has(t.id));

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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="start">
          {available.length === 0 ? (
            <p className="px-2 py-3 text-xs text-center text-muted-foreground">
              {allTags.length === 0 ? (
                <>No tags yet — create them in <span className="font-medium">Settings → Tags</span></>
              ) : (
                "All tags assigned"
              )}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {available.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => { handleAdd(tag.id); setOpen(false); }}
                  disabled={pending}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                >
                  {tag.color && (
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  )}
                  {tag.name}
                </button>
              ))}
            </div>
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
