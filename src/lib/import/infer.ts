import type { StatusConfidence, BusinessProcessType } from "@/types";

/**
 * Status inference from raw spreadsheet status text and row contents.
 *
 * Maps messy spreadsheet values to normalized repair statuses with
 * confidence scoring. Original text is always preserved separately.
 */

export type InferredStatus = {
  status:
    | "new"
    | "todo"
    | "in_inspection"
    | "quote_needed"
    | "waiting_approval"
    | "waiting_customer"
    | "waiting_parts"
    | "scheduled"
    | "in_progress"
    | "blocked"
    | "completed"
    | "invoiced"
    | "archived";
  confidence: StatusConfidence;
  reason: string;
};

export type InferredFlags = {
  warrantyInternalCostFlag: boolean;
  prepaidFlag: boolean;
  waterDamageRiskFlag: boolean;
  safetyFlag: boolean;
  tyresFlag: boolean;
  lightsFlag: boolean;
  brakesFlag: boolean;
  windowsFlag: boolean;
  sealsFlag: boolean;
  partsRequiredFlag: boolean;
  followUpRequiredFlag: boolean;
};

export type CustomerResponseInference = {
  status:
    | "not_contacted"
    | "contacted"
    | "waiting_response"
    | "approved"
    | "declined"
    | "no_response";
  reason: string;
};

// ─── Status mapping from raw spreadsheet values ─────────────────────────────

const STATUS_MAP: Record<string, { status: InferredStatus["status"]; confidence: StatusConfidence }> = {
  "to do":       { status: "todo", confidence: "high" },
  "todo":        { status: "todo", confidence: "high" },
  "waiting":     { status: "waiting_customer", confidence: "medium" },
  "wachten":     { status: "waiting_customer", confidence: "medium" },
  "parts needed": { status: "waiting_parts", confidence: "high" },
  "parts":       { status: "waiting_parts", confidence: "medium" },
  "no response": { status: "waiting_customer", confidence: "high" },
  "completed":   { status: "completed", confidence: "high" },
  "done":        { status: "completed", confidence: "high" },
  "klaar":       { status: "completed", confidence: "high" },
  "afgerond":    { status: "completed", confidence: "high" },
  "invoiced":    { status: "invoiced", confidence: "high" },
  "gefactureerd": { status: "invoiced", confidence: "high" },
  "in progress": { status: "in_progress", confidence: "high" },
  "bezig":       { status: "in_progress", confidence: "medium" },
  "blocked":     { status: "blocked", confidence: "high" },
  "cancelled":   { status: "archived", confidence: "medium" },
};

/**
 * Infer repair status from the raw status cell text.
 */
export function inferStatus(
  rawStatus: string | null,
  allText: string
): InferredStatus {
  if (!rawStatus || rawStatus.trim() === "") {
    // No status → try to infer from content
    return inferStatusFromContent(allText);
  }

  const normalized = rawStatus.trim().toLowerCase();

  // Direct match
  const mapped = STATUS_MAP[normalized];
  if (mapped) {
    return {
      status: mapped.status,
      confidence: mapped.confidence,
      reason: `Matched raw status "${rawStatus}" → ${mapped.status}`,
    };
  }

  // Partial match
  for (const [pattern, result] of Object.entries(STATUS_MAP)) {
    if (normalized.includes(pattern)) {
      return {
        status: result.status,
        confidence: "medium",
        reason: `Partial match in raw status "${rawStatus}" with pattern "${pattern}"`,
      };
    }
  }

  // Unknown status text
  return {
    status: "new",
    confidence: "low",
    reason: `Unrecognized status text: "${rawStatus}"`,
  };
}

/**
 * If no explicit status column, try to infer from the combined text.
 */
function inferStatusFromContent(text: string): InferredStatus {
  const lower = text.toLowerCase();

  if (lower.includes("completed") || lower.includes("klaar") || lower.includes("done")) {
    return { status: "completed", confidence: "low", reason: "Text mentions completion" };
  }
  if (lower.includes("waiting for reply") || lower.includes("wacht op antwoord")) {
    return { status: "waiting_customer", confidence: "medium", reason: "Text mentions waiting for reply" };
  }
  if (lower.includes("parts needed") || lower.includes("onderdelen nodig")) {
    return { status: "waiting_parts", confidence: "medium", reason: "Text mentions parts needed" };
  }

  return { status: "new", confidence: "low", reason: "No status information found" };
}

// ─── Flag inference from raw text ───────────────────────────────────────────

const FLAG_PATTERNS: { flag: keyof InferredFlags; patterns: RegExp[] }[] = [
  {
    flag: "tyresFlag",
    patterns: [
      /\bty?res?\b/i, /\bbanden?\b/i, /\btyre\s*siz/i,
      /\b\d{3}[\/x]\d{2,3}R?\d{2}/i, // tyre size pattern like 185/70R14
    ],
  },
  {
    flag: "lightsFlag",
    patterns: [
      /\blights?\b/i, /\blampen?\b/i, /\brear\s*light/i,
      /\bachterlicht/i, /\bverlichting/i,
    ],
  },
  {
    flag: "brakesFlag",
    patterns: [
      /\bbrakes?\b/i, /\bbrake\s*cable/i, /\bremmen?\b/i,
      /\bremkabel/i,
    ],
  },
  {
    flag: "windowsFlag",
    patterns: [
      /\bwindows?\b/i, /\braam\b/i, /\bramen\b/i,
      /\bglass\b/i, /\bglas\b/i,
    ],
  },
  {
    flag: "sealsFlag",
    patterns: [
      /\bseals?\b/i, /\brubber\b/i, /\bdoor\s*(seal|catch|lock)/i,
      /\bafdichting/i, /\bslot\b/i,
    ],
  },
  {
    flag: "waterDamageRiskFlag",
    patterns: [
      /\bwater\s*(damage|ingress|leak)/i, /\bvochtschade/i,
      /\blekkage?\b/i, /\bdamp\b/i, /\bwater\s*damage\s*risk/i,
    ],
  },
  {
    flag: "safetyFlag",
    patterns: [
      /\bsafety\b/i, /\bveiligheid/i, /\burgent\b/i,
      /\bdangerous?\b/i, /\bgevaarlijk/i,
    ],
  },
  {
    flag: "warrantyInternalCostFlag",
    patterns: [
      /\bwarranty\b/i, /\bgarantie\b/i, /\bour\s*costs?\b/i,
      /\bonze\s*kosten\b/i, /\binternal\s*cost/i,
    ],
  },
  {
    flag: "prepaidFlag",
    patterns: [
      /\bprepaid\b/i, /\bpre\s*paid\b/i, /\bvooruit\s*betaald/i,
      /\bbetaald\b/i, /\balready\s*paid/i,
    ],
  },
  {
    flag: "partsRequiredFlag",
    patterns: [
      /\bparts?\s*(needed|required|ordered)/i,
      /\borderd?\b/i, /\border\b/i,
      /\bonderdelen\b/i, /\bbesteld\b/i,
    ],
  },
  {
    flag: "followUpRequiredFlag",
    patterns: [
      /\bfollow[\s-]?up/i, /\bopvolging/i,
      /\bnabellen/i, /\bcall\s*back/i,
      /\bcheck\s*again/i,
    ],
  },
];

/**
 * Scan all raw text fields for flag-triggering patterns.
 */
export function inferFlags(
  issue: string | null,
  notes: string | null,
  extra: string | null,
  registration: string | null
): InferredFlags {
  const combined = [issue, notes, extra, registration]
    .filter(Boolean)
    .join(" ");

  const flags: InferredFlags = {
    warrantyInternalCostFlag: false,
    prepaidFlag: false,
    waterDamageRiskFlag: false,
    safetyFlag: false,
    tyresFlag: false,
    lightsFlag: false,
    brakesFlag: false,
    windowsFlag: false,
    sealsFlag: false,
    partsRequiredFlag: false,
    followUpRequiredFlag: false,
  };

  for (const { flag, patterns } of FLAG_PATTERNS) {
    if (patterns.some((p) => p.test(combined))) {
      flags[flag] = true;
    }
  }

  return flags;
}

// ─── Customer response inference ────────────────────────────────────────────

/**
 * Infer customer response status from status + notes text.
 */
export function inferCustomerResponse(
  rawStatus: string | null,
  notes: string | null,
  extra: string | null
): CustomerResponseInference {
  const combined = [rawStatus, notes, extra]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/no\s*response/i.test(combined) || /geen\s*reactie/i.test(combined)) {
    return { status: "no_response", reason: "Text indicates no response from customer" };
  }
  if (/waiting\s*(for)?\s*(reply|response|customer)/i.test(combined) ||
      /wacht\s*(op)?\s*(antwoord|reactie|klant)/i.test(combined)) {
    return { status: "waiting_response", reason: "Text indicates waiting for customer response" };
  }
  if (/approved/i.test(combined) || /goedgekeurd/i.test(combined) || /akkoord/i.test(combined)) {
    return { status: "approved", reason: "Text indicates customer approval" };
  }
  if (/declined/i.test(combined) || /afgewezen/i.test(combined)) {
    return { status: "declined", reason: "Text indicates customer declined" };
  }
  if (/contacted/i.test(combined) || /gebeld/i.test(combined) || /called/i.test(combined)) {
    return { status: "contacted", reason: "Text indicates customer was contacted" };
  }

  return { status: "not_contacted", reason: "No customer interaction indicators found" };
}

// ─── Business process type inference ────────────────────────────────────────

/**
 * Infer business process type from sheet category and row content.
 */
export function inferBusinessProcessType(
  sheetCategory: string,
  issue: string | null,
  notes: string | null
): BusinessProcessType {
  if (sheetCategory === "trailer_sales") return "trailer_sale";
  if (sheetCategory === "planning") return "planning";
  if (sheetCategory === "contact_queue") return "follow_up";

  const combined = [issue, notes].filter(Boolean).join(" ").toLowerCase();

  if (/\bquote\b/i.test(combined) || /\bofferte\b/i.test(combined)) return "quote";
  if (/\binspect/i.test(combined) || /\bkeuring/i.test(combined)) return "inspection";
  if (/\bparts?\s*order/i.test(combined) || /\bbestelling/i.test(combined)) return "parts_order";
  if (/\bdispos(al|e)/i.test(combined) || /\bafvoer/i.test(combined)) return "trailer_disposal";
  if (/\btrailer\s*sale/i.test(combined) || /\bte\s*koop/i.test(combined)) return "trailer_sale";
  if (/\breloc/i.test(combined) || /\bverplaats/i.test(combined)) return "relocation";
  if (/\bservice\b/i.test(combined) || /\bonderhoud/i.test(combined)) return "service";

  return "repair";
}

// ─── Invoice status inference ───────────────────────────────────────────────

/**
 * Infer invoice status from notes/status content.
 */
export function inferInvoiceStatus(
  allText: string
): "not_invoiced" | "warranty" | "paid" | "sent" | "draft" {
  const lower = allText.toLowerCase();

  if (/\bour\s*costs?\b/i.test(lower) || /\bwarranty\b/i.test(lower) ||
      /\bonze\s*kosten\b/i.test(lower) || /\bgarantie\b/i.test(lower)) {
    return "warranty";
  }
  if (/\bpaid\b/i.test(lower) || /\bbetaald\b/i.test(lower)) {
    return "paid";
  }
  if (/\binvoice\s*sent\b/i.test(lower) || /\bfactuur\s*verstuurd\b/i.test(lower)) {
    return "sent";
  }

  return "not_invoiced";
}
