"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const BASE_ITEMS: { href: string; label: string }[] = [
  { href: "/settings/account", label: "Account" },
  { href: "/settings/locations", label: "Locations" },
  { href: "/settings/users", label: "Users" },
  { href: "/settings/tags", label: "Tags" },
  { href: "/settings/holded", label: "Holded" },
  { href: "/settings/pricing", label: "Pricing" },
];

/** Inserted after Holded — only for admins (see layout). */
const AUDIT_ITEM = { href: "/settings/audit", label: "Audit log" } as const;

function isActive(pathname: string, href: string) {
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsNav({ showAudit }: { showAudit: boolean }) {
  const pathname = usePathname();
  const items = showAudit
    ? [
        ...BASE_ITEMS.slice(0, 5),
        AUDIT_ITEM,
        ...BASE_ITEMS.slice(5),
      ]
    : BASE_ITEMS;

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-border/70"
      aria-label="Settings sections"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative mb-[-1px] shrink-0 rounded-t-md border-b-2 px-3.5 pt-2 pb-2.5 text-sm font-medium whitespace-nowrap transition-[color,border-color,background-color,transform] duration-200 motion-safe:active:scale-[0.98]",
              active
                ? "border-primary bg-muted/30 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted/25 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
