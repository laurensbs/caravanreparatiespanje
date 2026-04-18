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
  actionReminders,
  communicationLogs,
  repairTasks,
  repairPhotos,
  repairFindings,
  repairBlockers,
  estimateLineItems,
  dismissedWorkshopItems,
} from "@/lib/db/schema";

export type UserRole = "admin" | "manager" | "staff" | "technician" | "viewer";

export type RepairStatus =
  | "new"
  | "todo"
  | "in_inspection"
  | "no_damage"
  | "quote_needed"
  | "waiting_approval"
  | "waiting_customer"
  | "waiting_parts"
  | "scheduled"
  | "in_progress"
  | "blocked"
  | "ready_for_check"
  | "completed"
  | "invoiced"
  | "rejected"
  | "archived";

export type Priority = "low" | "normal" | "high" | "urgent";

export type CustomerResponseStatus =
  | "not_contacted"
  | "contacted"
  | "waiting_response"
  | "approved"
  | "declined"
  | "no_response"
  | "reply_not_required";

export type InvoiceStatus =
  | "not_invoiced"
  | "draft"
  | "sent"
  | "paid"
  | "warranty"
  | "our_costs"
  | "rejected"
  | "no_damage";

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

export type JobType = "repair" | "wax" | "maintenance" | "inspection";

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
export type ActionReminder = typeof actionReminders.$inferSelect;
export type CommunicationLog = typeof communicationLogs.$inferSelect;
export type RepairTask = typeof repairTasks.$inferSelect;
export type RepairPhoto = typeof repairPhotos.$inferSelect;
export type RepairFinding = typeof repairFindings.$inferSelect;
export type RepairBlocker = typeof repairBlockers.$inferSelect;
export type EstimateLineItem = typeof estimateLineItems.$inferSelect;
export type DismissedWorkshopItem = typeof dismissedWorkshopItems.$inferSelect;

export type EstimateLineType = "labour" | "part" | "custom";
export type EstimateLineSource = "task" | "part_request" | "manual";

export type RepairTaskStatus = "pending" | "in_progress" | "done" | "problem" | "review";
export type FinalCheckStatus = "pending" | "passed" | "failed";
export type PhotoType = "before" | "damage" | "after" | "problem" | "general";
export type TaskSource = "office" | "garage";
export type ProblemCategory = "missing_part" | "extra_damage" | "unclear_instructions" | "time_shortage" | "other";

export type FindingSeverity = "minor" | "normal" | "critical";
export type FindingCategory = "tyres" | "lighting" | "brakes" | "windows" | "water_damage" | "seals" | "door_lock" | "electrical" | "bodywork" | "chassis" | "interior" | "other";
export type BlockerReason = "waiting_parts" | "waiting_customer" | "unknown_issue" | "no_time" | "missing_info" | "other";

export type ReminderType =
  | "create_invoice"
  | "follow_up_customer"
  | "order_parts"
  | "check_delivery"
  | "schedule_repair"
  | "send_quote"
  | "contact_customer"
  | "custom";

export type ContactMethod = "phone" | "whatsapp" | "email" | "in_person" | "sms" | "other";
export type ContactDirection = "outbound" | "inbound";

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
  no_damage: "No Damage",
  quote_needed: "Quote Needed",
  waiting_approval: "Waiting for Approval",
  waiting_customer: "Waiting for Contact",
  waiting_parts: "Waiting for Parts",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  blocked: "Blocked",
  ready_for_check: "Ready for Check",
  completed: "Completed",
  invoiced: "Invoiced",
  rejected: "Rejected by Client",
  archived: "Archived",
};

/**
 * Status pills are intentionally low-saturation. We avoid cyan / pure blue
 * brand tints — instead we use neutral foreground washes for "neutral"
 * states (new / todo / in_inspection / scheduled / in_progress) and reserve
 * tinted backgrounds for states the operator should actually notice
 * (waiting, blocked, completed, rejected). Keeps the dashboard quiet.
 */
export const STATUS_COLORS: Record<RepairStatus, string> = {
  new: "bg-foreground/[0.06] text-foreground/80 dark:bg-foreground/[0.08]",
  todo: "bg-foreground/[0.05] text-muted-foreground dark:bg-foreground/[0.06]",
  in_inspection: "bg-foreground/[0.06] text-foreground/80 dark:bg-foreground/[0.08]",
  no_damage: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  quote_needed: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  waiting_approval: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  waiting_customer: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  waiting_parts: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
  scheduled: "bg-foreground/[0.06] text-foreground/80 dark:bg-foreground/[0.08]",
  in_progress: "bg-foreground text-background dark:bg-foreground dark:text-background",
  blocked: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  ready_for_check: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  invoiced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400",
  archived: "bg-muted text-muted-foreground/70",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: "bg-slate-50 text-muted-foreground dark:bg-slate-500/10 dark:text-slate-400",
  normal: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  high: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  urgent: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
};

export const CUSTOMER_RESPONSE_LABELS: Record<CustomerResponseStatus, string> = {
  not_contacted: "Not Contacted",
  contacted: "Contacted",
  waiting_response: "Waiting Response",
  approved: "Approved",
  declined: "Declined",
  no_response: "No Response",
  reply_not_required: "No reply expected",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  not_invoiced: "Not Invoiced",
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  warranty: "Warranty / Internal",
  our_costs: "Our Costs",
  rejected: "Rejected by Client",
  no_damage: "No Damage",
};

export const TASK_STATUS_LABELS: Record<RepairTaskStatus, string> = {
  pending: "To Do",
  in_progress: "In Progress",
  done: "Done",
  problem: "Problem",
  review: "Review",
};

export const TASK_STATUS_COLORS: Record<RepairTaskStatus, string> = {
  pending: "bg-slate-50 text-muted-foreground dark:bg-slate-500/10 dark:text-slate-400",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  done: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  problem: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  review: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
};

export const PROBLEM_CATEGORY_LABELS: Record<ProblemCategory, string> = {
  missing_part: "Missing Part",
  extra_damage: "Extra Damage Found",
  unclear_instructions: "Unclear Instructions",
  time_shortage: "Time Shortage",
  other: "Other",
};

export const FINDING_CATEGORY_LABELS: Record<FindingCategory, string> = {
  tyres: "Tyres",
  lighting: "Lighting",
  brakes: "Brakes",
  windows: "Windows / Rooflight",
  water_damage: "Water Damage",
  seals: "Seals / Rails",
  door_lock: "Door / Lock",
  electrical: "Electrical",
  bodywork: "Bodywork",
  chassis: "Chassis",
  interior: "Interior",
  other: "Other",
};

export const FINDING_CATEGORY_EMOJI: Record<FindingCategory, string> = {
  tyres: "🛞",
  lighting: "💡",
  brakes: "🛑",
  windows: "🪟",
  water_damage: "💧",
  seals: "🔧",
  door_lock: "🚪",
  electrical: "⚡",
  bodywork: "🚗",
  chassis: "🔩",
  interior: "🪑",
  other: "📋",
};

export const FINDING_SEVERITY_LABELS: Record<FindingSeverity, string> = {
  minor: "Minor",
  normal: "Normal",
  critical: "Critical",
};

export const BLOCKER_REASON_LABELS: Record<BlockerReason, string> = {
  waiting_parts: "Waiting for Parts",
  waiting_customer: "Waiting for Customer",
  unknown_issue: "Unknown Issue",
  no_time: "No Time",
  missing_info: "Missing Information",
  other: "Other",
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

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  repair: "Repair",
  wax: "Wax",
  maintenance: "Maintenance",
  inspection: "Inspection",
};

export const JOB_TYPE_COLORS: Record<JobType, string> = {
  repair: "bg-muted text-slate-700 dark:bg-slate-500/15 dark:text-foreground/80",
  wax: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  maintenance: "bg-foreground/[0.06] text-foreground/80",
  inspection: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  caravan: "Caravan",
  trailer: "Trailer",
  camper: "Camper",
  unknown: "Unknown",
};

export const CONFIDENCE_COLORS: Record<StatusConfidence, string> = {
  high: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  medium: "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400",
  low: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  manual: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
};
