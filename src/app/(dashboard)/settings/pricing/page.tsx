import { getAppSettings } from "@/actions/settings";
import { PricingSettingsClient } from "./pricing-client";

export default async function PricingSettingsPage() {
  const settings = await getAppSettings();

  return (
    <PricingSettingsClient
      hourlyRate={settings.hourly_rate ?? "42.50"}
      defaultMarkup={settings.default_markup_percent ?? "25"}
      defaultTax={settings.default_tax_percent ?? "21"}
    />
  );
}
