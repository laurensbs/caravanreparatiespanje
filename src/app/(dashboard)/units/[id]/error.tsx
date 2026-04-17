"use client";

import { RouteError } from "@/components/layout/route-error";

export default function UnitDetailError({
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
      area="this unit"
      homeHref="/units"
    />
  );
}
