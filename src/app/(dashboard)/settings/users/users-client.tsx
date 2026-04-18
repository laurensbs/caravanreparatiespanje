"use client";

import { useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users, Search, MoreHorizontal, KeyRound, Power, PowerOff } from "lucide-react";
import { createUser, updateUser, deactivateUser, activateUser, resetUserPassword } from "@/actions/users";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import {
  SettingsPanel,
  SettingsSectionHeader,
  SettingsEmptyState,
} from "@/components/settings/settings-primitives";
import { cn } from "@/lib/utils";

const AVATAR_GRADIENTS = [
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-500",
  "from-violet-500 to-fuchsia-500",
  "from-indigo-500 to-blue-600",
  "from-stone-500 to-stone-700",
];
function avatarGradient(name: string | undefined | null): string {
  const key = (name ?? "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff" | "technician" | "viewer";
  active: boolean;
  createdAt: Date;
}

const ROLE_PILL: Record<User["role"], string> = {
  admin: "bg-foreground text-background",
  manager: "bg-foreground/[0.08] text-foreground",
  technician: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  staff: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  viewer: "bg-muted text-muted-foreground",
};

export function UsersClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "staff" as User["role"],
  });
  const [isPending, setIsPending] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, query]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      await createUser(form);
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "staff" });
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const toggleActive = async (user: User) => {
    if (user.active) {
      const ok = await confirmDialog({
        title: `Deactiveer ${user.name}?`,
        description: "Deze gebruiker kan niet meer inloggen totdat je het account weer activeert. Bestaande historie blijft staan.",
        tone: "destructive",
        confirmLabel: "Deactiveer",
      });
      if (!ok) return;
      await deactivateUser(user.id);
      toast.success(`${user.name} is gedeactiveerd`);
    } else {
      await activateUser(user.id);
      toast.success(`${user.name} is geactiveerd`);
    }
    router.refresh();
  };

  const handleResetPassword = async (user: User) => {
    const newPw = window.prompt(
      `Nieuw wachtwoord voor ${user.name}? Minimaal 6 tekens.`,
    );
    if (!newPw) return;
    try {
      await resetUserPassword(user.id, newPw);
      toast.success(`Wachtwoord van ${user.name} gereset`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kon wachtwoord niet wijzigen");
    }
  };

  const activeCount = users.filter((u) => u.active).length;

  return (
    <SettingsPanel className="space-y-5">
      <SettingsSectionHeader
        icon={Users}
        title="Team"
        description={`${users.length} member${users.length === 1 ? "" : "s"} · ${activeCount} active`}
        action={
          <Button
            type="button"
            size="sm"
            className="h-9 rounded-full px-4 text-[12.5px] font-medium shadow-sm"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add user
          </Button>
        }
      />

      {users.length > 0 ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or role…"
            className="h-10 rounded-xl pl-9 text-[13px]"
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        users.length === 0 ? (
          <SettingsEmptyState
            icon={Users}
            title="No users yet"
            description="Invite teammates so they can manage repairs and Holded sync with their own access level."
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 rounded-full px-4 text-[12.5px]"
                onClick={() => setOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add user
              </Button>
            }
          />
        ) : (
          <SettingsEmptyState
            icon={Search}
            title="No matches"
            description="Try a different name, email or role."
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 dark:border-border">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-muted/40 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground dark:bg-card/[0.03] dark:text-muted-foreground/70">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="hidden px-4 py-2.5 sm:table-cell">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="w-12 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 dark:divide-border/60">
              {filtered.map((user, idx) => (
                <tr
                  key={user.id}
                  className="motion-safe:animate-slide-up transition-colors hover:bg-muted/40 dark:hover:bg-card/[0.03]"
                  style={{ animationDelay: `${idx * 18}ms`, animationFillMode: "backwards" }}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white shadow-sm",
                        avatarGradient(user.name),
                      )}>
                        {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground dark:text-foreground">
                          {user.name}
                        </p>
                        <p className="truncate text-[11.5px] text-muted-foreground sm:hidden dark:text-muted-foreground/70">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 text-[12.5px] text-muted-foreground sm:table-cell dark:text-muted-foreground/70">
                    {user.email}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider",
                        ROLE_PILL[user.role],
                      )}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        user.active
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground dark:bg-card/[0.06] dark:text-muted-foreground/70",
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          user.active ? "bg-emerald-500" : "bg-muted-foreground/40",
                        )}
                      />
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          aria-label={`Acties voor ${user.name}`}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onSelect={() => handleResetPassword(user)}>
                          <KeyRound className="h-4 w-4" />
                          Reset wachtwoord
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => toggleActive(user)}
                          className={user.active ? "text-destructive focus:text-destructive" : ""}
                        >
                          {user.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          {user.active ? "Deactiveer account" : "Activeer account"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v as User["role"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
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
              <Button type="submit" className="h-9 rounded-full px-4" disabled={isPending}>
                Create user
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsPanel>
  );
}
