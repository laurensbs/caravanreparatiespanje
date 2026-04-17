"use client";

import { RouteError } from "@/components/layout/route-error";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      area="settings"
      homeHref="/settings"
    />
  );
}
