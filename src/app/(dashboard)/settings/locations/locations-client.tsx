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
import { Plus, MapPin, Pencil } from "lucide-react";
import { createLocation, updateLocation } from "@/actions/locations";
import { SegmentedTabs } from "@/components/layout/dashboard-surface";
import {
  SettingsPanel,
  SettingsSectionHeader,
  SettingsEmptyState,
  SettingsTile,
} from "@/components/settings/settings-primitives";

interface Location {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
}

const MAIN_NAMES = ["cruïllas", "peratallada", "sant climent"];

export function LocationsClient({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [tab, setTab] = useState<"main" | "misc">("main");

  const mainLocations = locations.filter((l) =>
    MAIN_NAMES.includes(l.name.toLowerCase()),
  );
  const miscLocations = locations.filter(
    (l) => !MAIN_NAMES.includes(l.name.toLowerCase()),
  );
  const visibleLocations = tab === "main" ? mainLocations : miscLocations;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      if (editId) {
        await updateLocation(editId, {
          name,
          description: description || undefined,
          active: true,
        });
      } else {
        await createLocation({
          name,
          description: description || undefined,
          active: true,
        });
      }
      setOpen(false);
      setEditId(null);
      setName("");
      setDescription("");
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const openEdit = (loc: Location) => {
    setEditId(loc.id);
    setName(loc.name);
    setDescription(loc.description ?? "");
    setOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setName("");
    setDescription("");
    setOpen(true);
  };

  return (
    <SettingsPanel className="space-y-5">
      <SettingsSectionHeader
        icon={MapPin}
        title="Locations"
        description="Workshops, storage yards and any other spaces work orders can sit at."
        action={
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full px-4 text-[12.5px] font-medium shadow-sm"
            onClick={openNew}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add location
          </Button>
        }
      />

      <SegmentedTabs<"main" | "misc">
        tabs={[
          { value: "main", label: "Main", count: mainLocations.length },
          { value: "misc", label: "Other", count: miscLocations.length },
        ]}
        value={tab}
        onValueChange={setTab}
        size="sm"
      />

      {visibleLocations.length === 0 ? (
        <SettingsEmptyState
          icon={MapPin}
          title={tab === "main" ? "No main locations yet" : "No other locations"}
          description={
            tab === "main"
              ? "Add your workshops here so jobs can be scheduled per site."
              : "Misc locations show up here. Add one above when needed."
          }
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 rounded-full px-4 text-[12.5px]"
              onClick={openNew}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add location
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLocations.map((loc, idx) => (
            <SettingsTile key={loc.id} index={idx} onClick={() => openEdit(loc)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[14px] font-semibold tracking-tight text-foreground dark:text-foreground">
                    {loc.name}
                  </span>
                </div>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 dark:text-muted-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground dark:text-muted-foreground/70">
                {loc.description || "No description"}
              </p>
              <p className="mt-2 text-[10.5px] uppercase tracking-wider text-muted-foreground/70 dark:text-muted-foreground">
                Slug · {loc.slug}
              </p>
            </SettingsTile>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit location" : "New location"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loc-name">Name</Label>
              <Input
                id="loc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Peratallada Workshop"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc-description">Description (optional)</Label>
              <Input
                id="loc-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Workshop description or address"
              />
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
                {editId ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}
