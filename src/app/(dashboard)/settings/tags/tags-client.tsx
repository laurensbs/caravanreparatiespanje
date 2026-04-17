"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Tag, Trash2 } from "lucide-react";
import { createTag, deleteTag } from "@/actions/tags";
import {
  SettingsPanel,
  SettingsSectionHeader,
  SettingsEmptyState,
} from "@/components/settings/settings-primitives";
import { cn } from "@/lib/utils";

interface TagType {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export function TagsClient({ tags }: { tags: TagType[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isPending, setIsPending] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      await createTag({ name, color });
      setOpen(false);
      setName("");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      setTimeout(() => setPendingDelete((prev) => (prev === id ? null : prev)), 3000);
      return;
    }
    setPendingDelete(null);
    await deleteTag(id);
    router.refresh();
  };

  return (
    <SettingsPanel className="space-y-5">
      <SettingsSectionHeader
        icon={Tag}
        title="Tags"
        description="Categorize repairs, contacts and units. Click a tag twice to delete it."
        action={
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full px-4 text-[12.5px] font-medium shadow-sm"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add tag
          </Button>
        }
      />

      {tags.length === 0 ? (
        <SettingsEmptyState
          icon={Tag}
          title="No tags yet"
          description="Add a tag to label work orders or contacts (e.g. Insurance Claim, VIP, Warranty)."
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 rounded-full px-4 text-[12.5px]"
              onClick={() => setOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add tag
            </Button>
          }
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => {
            const isPending = pendingDelete === tag.id;
            return (
              <div
                key={tag.id}
                className={cn(
                  "group flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3 py-1.5 text-[12.5px] shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all motion-safe:animate-slide-up dark:border-gray-800 dark:bg-white/[0.03]",
                  isPending && "border-red-300 bg-red-50/80 dark:border-red-700/60 dark:bg-red-500/10",
                )}
                style={{ animationDelay: `${idx * 25}ms`, animationFillMode: "backwards" }}
              >
                {tag.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/5"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                <span className="font-medium text-gray-800 dark:text-gray-100">{tag.name}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(tag.id)}
                  className={cn(
                    "ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors",
                    "hover:bg-red-500/10 hover:text-red-600 dark:hover:bg-red-500/20",
                    isPending && "bg-red-500/15 text-red-600",
                  )}
                  aria-label={isPending ? `Confirm delete ${tag.name}` : `Delete ${tag.name}`}
                  title={isPending ? "Click again to confirm" : "Delete"}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New tag</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Insurance Claim"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border transition-all motion-safe:active:scale-90",
                      color === c
                        ? "scale-110 border-gray-900 ring-2 ring-gray-900/10 dark:border-gray-100 dark:ring-white/10"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Choose ${c}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full px-4"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 rounded-full px-4"
                disabled={isPending || !name.trim()}
              >
                Create tag
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}
