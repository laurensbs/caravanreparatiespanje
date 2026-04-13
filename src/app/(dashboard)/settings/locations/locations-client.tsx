"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, MapPin } from "lucide-react";
import { createLocation, updateLocation } from "@/actions/locations";

interface Location {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
}

export function LocationsClient({ locations }: { locations: Location[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [tab, setTab] = useState<"main" | "misc">("main");

  const MAIN_NAMES = ["cruïllas", "peratallada", "sant climent"];
  const mainLocations = locations.filter((l) => MAIN_NAMES.includes(l.name.toLowerCase()));
  const miscLocations = locations.filter((l) => !MAIN_NAMES.includes(l.name.toLowerCase()));
  const visibleLocations = tab === "main" ? mainLocations : miscLocations;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      if (editId) {
        await updateLocation(editId, { name, description: description || undefined, active: true });
      } else {
        await createLocation({ name, description: description || undefined, active: true });
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
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Locations</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 rounded-lg text-xs" onClick={openNew}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editId ? "Edit Location" : "New Location"}
              </DialogTitle>
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
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending || !name.trim()}>
                  {editId ? "Save" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 border-b">
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "main"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("main")}
        >
          Locations ({mainLocations.length})
        </button>
        <button
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "misc"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("misc")}
        >
          Misc ({miscLocations.length})
        </button>
      </div>

      {visibleLocations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="mb-2 h-8 w-8 opacity-20" />
            <p className="font-medium text-sm text-muted-foreground">
              {tab === "main" ? "No main locations yet." : "No misc locations."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLocations.map((loc, idx) => (
            <Card
              key={loc.id}
              className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ring-1 ring-border/50 animate-slide-up"
              style={{ animationDelay: `${idx * 40}ms`, animationFillMode: "backwards" }}
              onClick={() => openEdit(loc)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{loc.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {loc.description || "No description"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Slug: {loc.slug}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
