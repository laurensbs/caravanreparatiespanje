/** Thrown as `Error.message` from `startTimer` when the repair is not in a billable active state. */
export const GARAGE_TIMER_NOT_ALLOWED = "GARAGE_TIMER_NOT_ALLOWED";

/** Repair job statuses where the garage "Wachten" tab groups the job — no billable timer start. */
export const GARAGE_WAITING_REPAIR_STATUSES = [
  "waiting_customer",
  "waiting_parts",
  "blocked",
] as const;

/** Only `in_progress` matches the garage "Actief" lane; timers accrue billable time on the linked repair. */
export function canStartGarageTimerOnRepair(status: string): boolean {
  return status === "in_progress";
}

export function garageTimerBlockedReason(
  status: string,
  t: (en: string, es?: string | null, nl?: string | null) => string
): string {
  if (GARAGE_WAITING_REPAIR_STATUSES.includes(status as (typeof GARAGE_WAITING_REPAIR_STATUSES)[number])) {
    return t(
      "Timer cannot run while this job is waiting.",
      "No se puede registrar tiempo mientras el trabajo está en espera.",
      "Timer kan niet tijdens wachtstatus; zet de klus eerst op Actief."
    );
  }
  return t(
    "Start the timer only when the job is active (in progress).",
    "Inicia el temporizador solo cuando el trabajo esté activo (en curso).",
    "Start de timer alleen als de klus actief is (in behandeling)."
  );
}
