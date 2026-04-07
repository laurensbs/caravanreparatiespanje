import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage locations, users, and tags.
        </p>
      </div>

      <nav className="flex gap-1 border-b">
        <Link
          href="/settings/locations"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium hover:border-muted-foreground/50 hover:text-foreground data-[active]:border-primary data-[active]:text-foreground"
        >
          Locations
        </Link>
        <Link
          href="/settings/users"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium hover:border-muted-foreground/50 hover:text-foreground"
        >
          Users
        </Link>
        <Link
          href="/settings/tags"
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium hover:border-muted-foreground/50 hover:text-foreground"
        >
          Tags
        </Link>
      </nav>

      {children}
    </div>
  );
}
