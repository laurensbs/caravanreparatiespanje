"use client";

import { RouteError } from "@/components/layout/route-error";

export default function CustomerDetailError({
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
      area="this customer"
      homeHref="/customers"
    />
  );
}
