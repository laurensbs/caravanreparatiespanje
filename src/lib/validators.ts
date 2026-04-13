import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "Username required"),
  password: z.string().min(1, "Password required"),
});

export const repairJobSchema = z.object({
  publicCode: z.string().max(100).optional(),
  locationId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  title: z.string().max(500).nullable().optional(),
  descriptionRaw: z.string().nullable().optional(),
  descriptionNormalized: z.string().nullable().optional(),
  partsNeededRaw: z.string().nullable().optional(),
  notesRaw: z.string().nullable().optional(),
  extraNotesRaw: z.string().nullable().optional(),
  internalComments: z.string().nullable().optional(),
  status: z.enum([
    "new", "todo", "in_inspection", "quote_needed", "waiting_approval",
    "waiting_customer", "waiting_parts", "scheduled", "in_progress",
    "blocked", "completed", "invoiced", "rejected", "archived",
  ]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  businessProcessType: z.enum([
    "repair", "follow_up", "quote", "parts_order", "trailer_sale",
    "trailer_disposal", "inspection", "planning", "relocation", "service", "unknown",
  ]).optional(),
  jobType: z.enum(["repair", "wax", "maintenance", "inspection"]).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  estimatedCost: z.string().nullable().optional(),
  actualCost: z.string().nullable().optional(),
  internalCost: z.string().nullable().optional(),
  estimatedHours: z.string().nullable().optional(),
  actualHours: z.string().nullable().optional(),
  invoiceStatus: z.enum([
    "not_invoiced", "draft", "sent", "paid", "warranty", "rejected", "no_damage",
  ]).optional(),
  customerResponseStatus: z.enum([
    "not_contacted", "contacted", "waiting_response",
    "approved", "declined", "no_response",
  ]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  bayReference: z.string().max(100).optional(),
  warrantyInternalCostFlag: z.boolean().optional(),
  prepaidFlag: z.boolean().optional(),
  waterDamageRiskFlag: z.boolean().optional(),
  safetyFlag: z.boolean().optional(),
  tyresFlag: z.boolean().optional(),
  lightsFlag: z.boolean().optional(),
  brakesFlag: z.boolean().optional(),
  windowsFlag: z.boolean().optional(),
  sealsFlag: z.boolean().optional(),
  partsRequiredFlag: z.boolean().optional(),
  followUpRequiredFlag: z.boolean().optional(),
  customFlags: z.array(z.string().max(50)).optional(),
  nextAction: z.string().nullable().optional(),
  currentBlocker: z.string().nullable().optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1, "Name required").max(500),
  contactType: z.enum(["person", "business"]).optional(),
  phone: z.string().max(100).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  mobile: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(255).optional(),
  postalCode: z.string().max(50).optional(),
  province: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  vatnumber: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export const unitSchema = z.object({
  unitType: z.enum(["caravan", "trailer", "camper", "unknown"]).optional(),
  registration: z.string().max(100).optional(),
  brand: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  year: z.coerce.number().min(1900).max(2100).optional(),
  length: z.string().max(50).optional(),
  chassisId: z.string().max(255).optional(),
  internalNumber: z.string().max(100).optional(),
  customerId: z.string().uuid().nullable().optional(),
  storageLocation: z.string().max(255).optional(),
  storageType: z.string().max(100).optional(),
  currentPosition: z.string().max(255).optional(),
  nfcTag: z.string().max(255).optional(),
  checklist: z.string().optional(),
  notes: z.string().optional(),
});

export const locationSchema = z.object({
  name: z.string().min(1, "Name required").max(255),
  description: z.string().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().optional(),
});

export const userSchema = z.object({
  email: z.string().email("Valid email required").max(255),
  name: z.string().min(1, "Name required").max(255),
  password: z.string().min(8, "Minimum 8 characters"),
  role: z.enum(["admin", "manager", "staff", "viewer"]),
});

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.enum([
    "new", "todo", "in_inspection", "quote_needed", "waiting_approval",
    "waiting_customer", "waiting_parts", "scheduled", "in_progress",
    "blocked", "completed", "invoiced", "archived",
  ]).optional(),
  locationId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  archivedAt: z.string().nullable().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RepairJobInput = z.infer<typeof repairJobSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type UnitInput = z.infer<typeof unitSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
