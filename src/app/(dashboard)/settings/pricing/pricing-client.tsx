"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, DollarSign, Percent, Receipt } from "lucide-react";
import { updateAppSetting } from "@/actions/settings";
import { toast } from "sonner";

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

  function handleSave() {
    startTransition(async () => {
      await updateAppSetting("hourly_rate", hourlyRate);
      await updateAppSetting("default_markup_percent", defaultMarkup);
      await updateAppSetting("default_tax_percent", defaultTax);
      toast.success("Pricing settings saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Labour Rate
          </CardTitle>
          <CardDescription>
            Hourly rate for labour lines on cost estimates and invoices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hourly Rate (excl. VAT)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Incl. VAT ({tax}%)</Label>
              <div className="h-9 flex items-center px-3 rounded-lg border bg-muted/30 text-sm font-medium">
                €{rateInclVat.toFixed(2)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Default Markup
          </CardTitle>
          <CardDescription>
            Default markup percentage on parts. Can be overridden per part.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label>Markup %</Label>
            <div className="relative">
              <Input
                type="number"
                step="1"
                min="0"
                value={defaultMarkup}
                onChange={(e) => setDefaultMarkup(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              A part costing €100 will be priced at €{(100 * (1 + (parseFloat(defaultMarkup) || 0) / 100)).toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            VAT / Tax
          </CardTitle>
          <CardDescription>
            Default tax rate applied to invoice line items in Holded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label>Tax %</Label>
            <div className="relative">
              <Input
                type="number"
                step="1"
                min="0"
                value={defaultTax}
                onChange={(e) => setDefaultTax(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isPending} className="rounded-xl">
        <Save className="mr-2 h-4 w-4" />
        {isPending ? "Saving..." : "Save Pricing Settings"}
      </Button>
    </div>
  );
}
