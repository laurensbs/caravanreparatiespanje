import type {
  repairJobs,
  customers,
  units,
  locations,
  users,
  tags,
  repairJobEvents,
  repairJobAssignments,
  suppliers,
  parts,
  partRequests,
  imports,
  importRows,
  repairJobRawRows,
  candidateDuplicates,
  auditLogs,
} from "@/lib/db/schema";

export type UserRole = "admin" | "manager" | "staff" | "viewer";

export type RepairStatus =
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

export type Priority = "low" | "normal" | "high" | "urgent";

export type CustomerResponseStatus =
  | "not_contacted"
  | "contacted"
  | "waiting_response"
  | "approved"
  | "declined"
  | "no_response";

export type InvoiceStatus =
  | "not_invoiced"
  | "draft"
  | "sent"
  | "paid"
  | "warranty";

export type BusinessProcessType =
  | "repair"
  | "follow_up"
  | "quote"
  | "parts_order"
  | "trailer_sale"
  | "trailer_disposal"
  | "inspection"
  | "planning"
  | "relocation"
  | "service"
  | "unknown";

export type UnitType = "caravan" | "trailer" | "camper" | "unknown";

export type StatusConfidence = "high" | "medium" | "low" | "manual";

export type ImportRowClass = "record" | "header" | "divider" | "empty" | "unknown";

export type DuplicateStatus = "pending" | "confirmed_duplicate" | "rejected" | "merged";

export type PartRequestStatus =
  | "requested"
  | "ordered"
  | "shipped"
  | "received"
  | "cancelled";

// Inferred DB types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;

export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

export type RepairJob = typeof repairJobs.$inferSelect;
export type NewRepairJob = typeof repairJobs.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type RepairJobEvent = typeof repairJobEvents.$inferSelect;
export type RepairJobAssignment = typeof repairJobAssignments.$inferSelect;

export type Supplier = typeof suppliers.$inferSelect;
export type Part = typeof parts.$inferSelect;
export type PartRequest = typeof partRequests.$inferSelect;

export type Import = typeof imports.$inferSelect;
export type ImportRow = typeof importRows.$inferSelect;
export type RepairJobRawRow = typeof repairJobRawRows.$inferSelect;
export type CandidateDuplicate = typeof candidateDuplicates.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// Extended types with relations
export type RepairJobWithRelations = RepairJob & {
  location: Location | null;
  customer: Customer | null;
  unit: Unit | null;
  assignedUser: Pick<User, "id" | "name" | "email"> | null;
};

export type RepairJobDetail = RepairJobWithRelations & {
  events: (RepairJobEvent & { user: Pick<User, "id" | "name"> | null })[];
  partRequests: PartRequest[];
  rawRows?: (RepairJobRawRow & { importRow: ImportRow })[];
};

// UI labels
export const STATUS_LABELS: Record<RepairStatus, string> = {
  new: "New",
  todo: "To Do",
  in_inspection: "In Inspection",
  quote_needed: "Quote Needed",
  waiting_approval: "Waiting for Approval",
  waiting_customer: "Waiting for Customer",
  waiting_parts: "Waiting for Parts",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  invoiced: "Invoiced",
  archived: "Archived",
};

export const STATUS_COLORS: Record<RepairStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  todo: "bg-slate-100 text-slate-800",
  in_inspection: "bg-cyan-100 text-cyan-800",
  quote_needed: "bg-amber-100 text-amber-800",
  waiting_approval: "bg-yellow-100 text-yellow-800",
  waiting_customer: "bg-orange-100 text-orange-800",
  waiting_parts: "bg-purple-100 text-purple-800",
  scheduled: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-green-100 text-green-800",
  blocked: "bg-red-100 text-red-800",
  completed: "bg-emerald-100 text-emerald-800",
  invoiced: "bg-teal-100 text-teal-800",
  archived: "bg-gray-100 text-gray-500",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export const CUSTOMER_RESPONSE_LABELS: Record<CustomerResponseStatus, string> = {
  not_contacted: "Not Contacted",
  contacted: "Contacted",
  waiting_response: "Waiting Response",
  approved: "Approved",
  declined: "Declined",
  no_response: "No Response",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  not_invoiced: "Not Invoiced",
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  warranty: "Warranty / Internal",
};

export const BUSINESS_PROCESS_LABELS: Record<BusinessProcessType, string> = {
  repair: "Repair",
  follow_up: "Follow-Up",
  quote: "Quote",
  parts_order: "Parts Order",
  trailer_sale: "Trailer Sale",
  trailer_disposal: "Trailer Disposal",
  inspection: "Inspection",
  planning: "Planning",
  relocation: "Relocation",
  service: "Service",
  unknown: "Unknown",
};

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  caravan: "Caravan",
  trailer: "Trailer",
  camper: "Camper",
  unknown: "Unknown",
};

export const CONFIDENCE_COLORS: Record<StatusConfidence, string> = {
  high: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-red-100 text-red-700",
  manual: "bg-blue-100 text-blue-700",
};
