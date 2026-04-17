"use client";

import { usePathname } from "next/navigation";
import { SegmentedTabs } from "@/components/layout/dashboard-surface";
import {
  User,
  MapPin,
  Users,
  Tag,
  Plug,
  Receipt,
  Shield,
  type LucideIcon,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };

const BASE: Item[] = [
  { href: "/settings/account", label: "Account", icon: User },
  { href: "/settings/locations", label: "Locations", icon: MapPin },
  { href: "/settings/users", label: "Users", icon: Users },
  { href: "/settings/tags", label: "Tags", icon: Tag },
  { href: "/settings/holded", label: "Holded", icon: Plug },
  { href: "/settings/pricing", label: "Pricing", icon: Receipt },
];

const AUDIT: Item = { href: "/settings/audit", label: "Audit log", icon: Shield };

function activeFor(pathname: string, items: Item[]): string {
  // Most specific match wins.
  let best = items[0]!.href;
  let bestLen = -1;
  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (item.href.length > bestLen) {
        best = item.href;
        bestLen = item.href.length;
      }
    }
  }
  return best;
}

export function SettingsNav({ showAudit }: { showAudit: boolean }) {
  const pathname = usePathname();
  const items = showAudit
    ? [...BASE.slice(0, 5), AUDIT, ...BASE.slice(5)]
    : BASE;
  const active = activeFor(pathname, items);

  return (
    <SegmentedTabs
      tabs={items.map((item) => {
        const Icon = item.icon;
        return {
          value: item.href,
          label: item.label,
          icon: <Icon className="h-3.5 w-3.5" />,
        };
      })}
      value={active}
      hrefFor={(href) => href}
      size="md"
      className="w-full overflow-x-auto"
    />
  );
}
