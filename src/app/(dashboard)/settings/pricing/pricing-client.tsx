"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, DollarSign, Percent, Receipt, Check } from "lucide-react";
import { updateAppSetting } from "@/actions/settings";
import { toast } from "sonner";
import {
  SettingsPanel,
  SettingsSectionHeader,
} from "@/components/settings/settings-primitives";

interface PricingSettingsClientProps {
  hourlyRate: string;
  defaultMarkup: string;
  defaultTax: string;
}

export function PricingSettingsClient({
  hourlyRate: initialRate,
  defaultMarkup: initialMarkup,
  defaultTax: initialTax,
}: PricingSettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hourlyRate, setHourlyRate] = useState(initialRate);
  const [defaultMarkup, setDefaultMarkup] = useState(initialMarkup);
  const [defaultTax, setDefaultTax] = useState(initialTax);

  const rate = parseFloat(hourlyRate) || 0;
  const tax = parseFloat(defaultTax) || 21;
  const rateInclVat = rate * (1 + tax / 100);
  const markup = parseFloat(defaultMarkup) || 0;

  const dirty =
    hourlyRate !== initialRate || defaultMarkup !== initialMarkup || defaultTax !== initialTax;

  function handleSave() {
    startTransition(async () => {
      await Promise.all([
        updateAppSetting("hourly_rate", hourlyRate),
        updateAppSetting("default_markup_percent", defaultMarkup),
        updateAppSetting("default_tax_percent", defaultTax),
      ]);
      toast.success("Pricing settings saved");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      <SettingsPanel className="space-y-5">
        <SettingsSectionHeader
          icon={DollarSign}
          title="Labour rate"
          description="Hourly rate used on cost estimates and invoices."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
              Hourly rate · excl. VAT
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70">
                €
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                className="h-10 rounded-xl pl-7 text-[14px] tabular-nums"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
              Incl. VAT · {tax}%
            </Label>
            <div className="flex h-10 items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-3 text-[14px] font-semibold tabular-nums text-foreground/90 dark:border-border dark:bg-card/[0.03] dark:text-foreground/90">
              <span>€{rateInclVat.toFixed(2)}</span>
              <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
                auto
              </span>
            </div>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel className="space-y-5">
        <SettingsSectionHeader
          icon={Percent}
          title="Default markup"
          description="Default markup % on parts. Can be overridden per part."
        />
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            Markup %
          </Label>
          <div className="relative max-w-xs">
            <Input
              type="number"
              step="1"
              min="0"
              value={defaultMarkup}
              onChange={(e) => setDefaultMarkup(e.target.value)}
              className="h-10 rounded-xl pr-8 text-[14px] tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70">
              %
            </span>
          </div>
          <p className="text-[12px] text-muted-foreground dark:text-muted-foreground/70">
            A part costing €100 sells at{" "}
            <span className="font-medium tabular-nums text-foreground dark:text-foreground">
              €{(100 * (1 + markup / 100)).toFixed(2)}
            </span>
          </p>
        </div>
      </SettingsPanel>

      <SettingsPanel className="space-y-5">
        <SettingsSectionHeader
          icon={Receipt}
          title="VAT / tax"
          description="Default tax rate applied to invoice line items pushed to Holded."
        />
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            Tax %
          </Label>
          <div className="relative max-w-xs">
            <Input
              type="number"
              step="1"
              min="0"
              value={defaultTax}
              onChange={(e) => setDefaultTax(e.target.value)}
              className="h-10 rounded-xl pr-8 text-[14px] tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70">
              %
            </span>
          </div>
        </div>
      </SettingsPanel>

      <SettingsPanel className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-tight text-foreground dark:text-foreground">
            {dirty ? "You have unsaved changes" : "All set"}
          </p>
          <p className="text-[12.5px] text-muted-foreground dark:text-muted-foreground/70">
            {dirty
              ? "Save to apply the new rate, markup and VAT everywhere."
              : "Your pricing defaults are up to date."}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending || !dirty}
          className="h-10 shrink-0 rounded-full px-5 text-[13px] font-medium shadow-sm"
        >
          {isPending ? (
            <>
              <Save className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
              Saving…
            </>
          ) : dirty ? (
            <>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save changes
            </>
          ) : (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Saved
            </>
          )}
        </Button>
      </SettingsPanel>
    </div>
  );
}
