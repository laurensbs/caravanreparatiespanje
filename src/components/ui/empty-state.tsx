import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Action-oriented empty state. Used everywhere we used to render
 * "No items yet". Pairs an icon, a one-liner, an optional
 * description, and a primary CTA — either a Link or an onClick.
 *
 *   <EmptyState
 *     icon={Users}
 *     title="No customers yet"
 *     description="Add your first customer to start tracking repairs."
 *     action={{ label: "Add customer", href: "/customers/new" }}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondary,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: LucideIcon;
  };
  secondary?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}) {
  const ActionIcon = action?.icon;
  const actionContent = action ? (
    <>
      {ActionIcon ? <ActionIcon className="h-3.5 w-3.5" /> : null}
      {action.label}
    </>
  ) : null;

  return (
    <div
      className={cn(
        "animate-fade-in flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-card text-muted-foreground/70 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {(action || secondary) && (
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row">
          {action ? (
            action.href ? (
              <Button asChild size="sm">
                <Link href={action.href}>{actionContent}</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={action.onClick}>
                {actionContent}
              </Button>
            )
          ) : null}
          {secondary ? (
            secondary.href ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={secondary.onClick}>
                {secondary.label}
              </Button>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
