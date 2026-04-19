import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  numeric,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "staff",
  "technician",
  "viewer",
]);

// UI/notification language preference per user. The garage iPad has its
// own device-wide default (set by an admin/owner), but each technician
// can have a personal preference: when *they* perform an action, toasts
// and confirmations switch to their language briefly. Stored on the
// user row so it follows them across devices.
export const userLanguageEnum = pgEnum("user_language", ["en", "es", "nl"]);

export const repairStatusEnum = pgEnum("repair_status", [
  "new",
  "todo",
  "in_inspection",
  "no_damage",
  "quote_needed",
  "waiting_approval",
  "waiting_customer",
  "waiting_parts",
  "scheduled",
  "in_progress",
  "blocked",
  "ready_for_check",
  "completed",
  "invoiced",
  "rejected",
  "archived",
]);

export const priorityEnum = pgEnum("priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const customerResponseEnum = pgEnum("customer_response_status", [
  "not_contacted",
  "contacted",
  "waiting_response",
  "approved",
  "declined",
  "no_response",
  "reply_not_required",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "not_invoiced",
  "draft",
  "sent",
  "paid",
  "warranty",
  "our_costs",
  "rejected",
  "no_damage",
]);

export const businessProcessTypeEnum = pgEnum("business_process_type", [
  "repair",
  "follow_up",
  "quote",
  "parts_order",
  "trailer_sale",
  "trailer_disposal",
  "inspection",
  "planning",
  "relocation",
  "service",
  "unknown",
]);

export const jobTypeEnum = pgEnum("job_type", [
  "repair",
  "wax",
  "maintenance",
  "inspection",
]);

export const contactTypeEnum = pgEnum("contact_type", [
  "person",
  "business",
]);

export const unitTypeEnum = pgEnum("unit_type", [
  "caravan",
  "trailer",
  "camper",
  "unknown",
]);

export const statusConfidenceEnum = pgEnum("status_confidence", [
  "high",
  "medium",
  "low",
  "manual",
]);

export const importRowClassEnum = pgEnum("import_row_class", [
  "record",
  "header",
  "divider",
  "empty",
  "unknown",
]);

export const partRequestStatusEnum = pgEnum("part_request_status", [
  "requested",
  "ordered",
  "shipped",
  "received",
  "cancelled",
]);

export const requestTypeEnum = pgEnum("request_type", ["part", "equipment"]);

export const repairTaskStatusEnum = pgEnum("repair_task_status", [
  "pending",
  "in_progress",
  "done",
  "problem",
  "review",
]);

export const estimateLineTypeEnum = pgEnum("estimate_line_type", [
  "labour",
  "part",
  "custom",
]);

export const estimateLineSourceEnum = pgEnum("estimate_line_source", [
  "task",
  "part_request",
  "manual",
]);

export const finalCheckStatusEnum = pgEnum("final_check_status", [
  "pending",
  "passed",
  "failed",
]);

export const findingSeverityEnum = pgEnum("finding_severity", [
  "minor",
  "normal",
  "critical",
]);

export const findingCategoryEnum = pgEnum("finding_category", [
  "tyres",
  "lighting",
  "brakes",
  "windows",
  "water_damage",
  "seals",
  "door_lock",
  "electrical",
  "bodywork",
  "chassis",
  "interior",
  "other",
]);

export const blockerReasonEnum = pgEnum("blocker_reason", [
  "waiting_parts",
  "waiting_customer",
  "unknown_issue",
  "no_time",
  "missing_info",
  "other",
]);

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "processing",
  "completed",
  "completed_with_errors",
  "failed",
]);

export const importRowStatusEnum = pgEnum("import_row_status", [
  "pending",
  "imported",
  "skipped",
  "error",
  "duplicate",
  "merged",
]);

export const duplicateStatusEnum = pgEnum("duplicate_status", [
  "pending",
  "confirmed_duplicate",
  "rejected",
  "merged",
]);

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("staff"),
    active: boolean("active").notNull().default(true),
    // Wanneer true moet de gebruiker bij de eerstvolgende login een nieuw
    // wachtwoord aanmaken. Wordt door de admin/migratie gezet voor nieuwe
    // accounts en automatisch op false gezet zodra het wachtwoord is gekozen.
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    // Personal UI/notification language. Defaults to English; admin can
    // override per technician (e.g. Mark/Rolf → "nl", Spanish team → "es").
    preferredLanguage: userLanguageEnum("preferred_language").notNull().default("en"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

// ─────────────────────────────────────────────────────────────────────────────
// LOCATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  sourceSheetName: varchar("source_sheet_name", { length: 255 }),
  sourceCategory: varchar("source_category", { length: 100 }),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 500 }).notNull(),
    contactType: contactTypeEnum("contact_type").notNull().default("person"),
    phone: varchar("phone", { length: 100 }),
    email: varchar("email", { length: 255 }),
    notes: text("notes"),
    address: varchar("address", { length: 500 }),
    city: varchar("city", { length: 255 }),
    postalCode: varchar("postal_code", { length: 50 }),
    province: varchar("province", { length: 255 }),
    country: varchar("country", { length: 100 }),
    vatnumber: varchar("vatnumber", { length: 100 }),
    mobile: varchar("mobile", { length: 100 }),
    holdedContactId: varchar("holded_contact_id", { length: 255 }),
    holdedSyncedAt: timestamp("holded_synced_at", { withTimezone: true }),
    provisional: boolean("provisional").notNull().default(false),
    confidenceScore: real("confidence_score"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("customers_name_idx").on(table.name)]
);

// ─────────────────────────────────────────────────────────────────────────────
// UNITS (Caravans / Trailers / Campers)
// ─────────────────────────────────────────────────────────────────────────────

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitType: unitTypeEnum("unit_type").notNull().default("unknown"),
    registration: varchar("registration", { length: 100 }),
    brand: varchar("brand", { length: 255 }),
    model: varchar("model", { length: 255 }),
    year: integer("year"),
    length: varchar("length", { length: 50 }),
    chassisId: varchar("chassis_id", { length: 255 }),
    internalNumber: varchar("internal_number", { length: 100 }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    // Holded custom fields
    storageLocation: varchar("storage_location", { length: 255 }),
    storageType: varchar("storage_type", { length: 100 }),
    currentPosition: varchar("current_position", { length: 255 }),
    nfcTag: varchar("nfc_tag", { length: 255 }),
    checklist: text("checklist"),
    notes: text("notes"),
    provisional: boolean("provisional").notNull().default(false),
    registrationRaw: text("registration_raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("units_registration_idx").on(table.registration),
    index("units_customer_id_idx").on(table.customerId),
    index("units_internal_number_idx").on(table.internalNumber),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// TAGS
// ─────────────────────────────────────────────────────────────────────────────

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  color: varchar("color", { length: 7 }).notNull().default("#6b7280"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR JOBS
// ─────────────────────────────────────────────────────────────────────────────

export const repairJobs = pgTable(
  "repair_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicCode: varchar("public_code", { length: 100 }),
    sourceCategory: varchar("source_category", { length: 100 }),
    sourceSheet: varchar("source_sheet", { length: 255 }),

    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    unitId: uuid("unit_id").references(() => units.id, {
      onDelete: "set null",
    }),

    title: varchar("title", { length: 500 }),
    descriptionRaw: text("description_raw"),
    descriptionNormalized: text("description_normalized"),
    partsNeededRaw: text("parts_needed_raw"),
    notesRaw: text("notes_raw"),
    extraNotesRaw: text("extra_notes_raw"),
    internalComments: text("internal_comments"),

    status: repairStatusEnum("status").notNull().default("todo"),
    statusReason: text("status_reason"),
    statusConfidence: statusConfidenceEnum("status_confidence"),
    priority: priorityEnum("priority").notNull().default("normal"),

    businessProcessType: businessProcessTypeEnum("business_process_type")
      .notNull()
      .default("repair"),
    jobType: jobTypeEnum("job_type").notNull().default("repair"),
    customerResponseStatus: customerResponseEnum("customer_response_status")
      .notNull()
      .default("not_contacted"),
    invoiceStatus: invoiceStatusEnum("invoice_status")
      .notNull()
      .default("not_invoiced"),

    warrantyInternalCostFlag: boolean("warranty_internal_cost_flag")
      .notNull()
      .default(false),
    prepaidFlag: boolean("prepaid_flag").notNull().default(false),
    waterDamageRiskFlag: boolean("water_damage_risk_flag")
      .notNull()
      .default(false),
    safetyFlag: boolean("safety_flag").notNull().default(false),
    tyresFlag: boolean("tyres_flag").notNull().default(false),
    lightsFlag: boolean("lights_flag").notNull().default(false),
    brakesFlag: boolean("brakes_flag").notNull().default(false),
    windowsFlag: boolean("windows_flag").notNull().default(false),
    sealsFlag: boolean("seals_flag").notNull().default(false),
    partsRequiredFlag: boolean("parts_required_flag")
      .notNull()
      .default(false),
    followUpRequiredFlag: boolean("follow_up_required_flag")
      .notNull()
      .default(false),
    customFlags: jsonb("custom_flags").$type<string[]>().default([]),

    nextAction: text("next_action"),
    currentBlocker: text("current_blocker"),

    holdedInvoiceId: varchar("holded_invoice_id", { length: 255 }),
    holdedInvoiceNum: varchar("holded_invoice_num", { length: 100 }),
    holdedInvoiceDate: timestamp("holded_invoice_date", { withTimezone: true }),
    holdedInvoiceSentAt: timestamp("holded_invoice_sent_at", { withTimezone: true }),
    lastPaymentReminderAt: timestamp("last_payment_reminder_at", { withTimezone: true }),
    holdedQuoteId: varchar("holded_quote_id", { length: 255 }),
    holdedQuoteNum: varchar("holded_quote_num", { length: 100 }),
    holdedQuoteDate: timestamp("holded_quote_date", { withTimezone: true }),
    holdedQuoteSentAt: timestamp("holded_quote_sent_at", { withTimezone: true }),

    bayReference: varchar("bay_reference", { length: 100 }),
    discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
    spreadsheetInternalId: varchar("spreadsheet_internal_id", { length: 100 }),

    assignedUserId: uuid("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    estimatedCost: numeric("estimated_cost", { precision: 10, scale: 2 }),
    actualCost: numeric("actual_cost", { precision: 10, scale: 2 }),
    internalCost: numeric("internal_cost", { precision: 10, scale: 2 }),
    estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
    actualHours: numeric("actual_hours", { precision: 6, scale: 2 }),

    dueDate: timestamp("due_date", { withTimezone: true }),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    // Final check (garage natest)
    finalCheckStatus: finalCheckStatusEnum("final_check_status"),
    finalCheckByUserId: uuid("final_check_by_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    finalCheckAt: timestamp("final_check_at", { withTimezone: true }),
    finalCheckNotes: text("final_check_notes"),

    // Garage-admin sync metadata
    garageLastUpdateAt: timestamp("garage_last_update_at", { withTimezone: true }),
    garageLastUpdateType: varchar("garage_last_update_type", { length: 100 }),
    garageLastUpdatedByUserId: uuid("garage_last_updated_by_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    garageNeedsAdminAttention: boolean("garage_needs_admin_attention")
      .notNull()
      .default(false),
    garageUnreadUpdatesCount: integer("garage_unread_updates_count")
      .notNull()
      .default(0),

    // Admin → Garage messaging
    garageAdminMessage: text("garage_admin_message"),
    garageAdminMessageAt: timestamp("garage_admin_message_at", { withTimezone: true }),
    garageAdminMessageReadAt: timestamp("garage_admin_message_read_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_jobs_status_idx").on(table.status),
    index("repair_jobs_location_idx").on(table.locationId),
    index("repair_jobs_customer_idx").on(table.customerId),
    index("repair_jobs_unit_idx").on(table.unitId),
    index("repair_jobs_assigned_idx").on(table.assignedUserId),
    index("repair_jobs_priority_idx").on(table.priority),
    index("repair_jobs_invoice_status_idx").on(table.invoiceStatus),
    index("repair_jobs_public_code_idx").on(table.publicCode),
    index("repair_jobs_created_idx").on(table.createdAt),
    index("repair_jobs_bay_reference_idx").on(table.bayReference),
    index("repair_jobs_business_type_idx").on(table.businessProcessType),
    index("repair_jobs_job_type_idx").on(table.jobType),
    index("repair_jobs_archived_idx").on(table.archivedAt),
    index("repair_jobs_deleted_idx").on(table.deletedAt),
    index("repair_jobs_garage_attention_idx").on(table.garageNeedsAdminAttention),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR JOB ↔ TAG (junction)
// ─────────────────────────────────────────────────────────────────────────────

export const repairJobTags = pgTable(
  "repair_job_tags",
  {
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.repairJobId, table.tagId] }),
    index("repair_job_tags_job_idx").on(table.repairJobId),
    index("repair_job_tags_tag_idx").on(table.tagId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER ↔ TAG (junction)
// ─────────────────────────────────────────────────────────────────────────────

export const customerTags = pgTable(
  "customer_tags",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.customerId, table.tagId] }),
    index("customer_tags_customer_idx").on(table.customerId),
    index("customer_tags_tag_idx").on(table.tagId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// UNIT ↔ TAG (junction)
// ─────────────────────────────────────────────────────────────────────────────

export const unitTags = pgTable(
  "unit_tags",
  {
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.unitId, table.tagId] }),
    index("unit_tags_unit_idx").on(table.unitId),
    index("unit_tags_tag_idx").on(table.tagId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR JOB EVENTS (Timeline)
// ─────────────────────────────────────────────────────────────────────────────

export const repairJobEvents = pgTable(
  "repair_job_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    fieldChanged: varchar("field_changed", { length: 100 }),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_job_events_job_idx").on(table.repairJobId),
    index("repair_job_events_created_idx").on(table.createdAt),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR MESSAGES (Bidirectional admin ↔ garage thread)
//
// The legacy `repairJobs.garageAdminMessage` field still powers the single
// "office message" banner on the Today card; this table backs the full
// per-repair conversation that both sides can read and reply to.
// ─────────────────────────────────────────────────────────────────────────────

export const repairMessageDirectionEnum = pgEnum("repair_message_direction", [
  "admin_to_garage",
  "garage_to_admin",
]);

export const repairMessages = pgTable(
  "repair_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    direction: repairMessageDirectionEnum("direction").notNull(),
    body: text("body").notNull(),
    // Author. For admin → garage we set userId. For garage → admin the
    // garage portal does not have a per-user session, so we store a
    // free-form workshop name (typed by the worker) in authorName.
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorName: varchar("author_name", { length: 120 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_messages_job_idx").on(table.repairJobId),
    index("repair_messages_created_idx").on(table.createdAt),
    index("repair_messages_unread_idx").on(table.repairJobId, table.direction, table.readAt),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR JOB ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

export const repairJobAssignments = pgTable(
  "repair_job_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
  },
  (table) => [
    index("repair_job_assignments_job_idx").on(table.repairJobId),
    index("repair_job_assignments_user_idx").on(table.userId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIERS
// ─────────────────────────────────────────────────────────────────────────────

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  phone: varchar("phone", { length: 100 }),
  email: varchar("email", { length: 255 }),
  website: varchar("website", { length: 500 }),
  holdedContactId: varchar("holded_contact_id", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PART CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────

export const partCategories = pgTable("part_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 50 }).notNull().unique(),
  label: varchar("label", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull().default("Package"),
  color: varchar("color", { length: 100 }).notNull().default("bg-muted/40 text-muted-foreground dark:bg-foreground/[0.06] dark:text-muted-foreground/70"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTS
// ─────────────────────────────────────────────────────────────────────────────

export const parts = pgTable(
  "parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 500 }).notNull(),
    partNumber: varchar("part_number", { length: 255 }),
    description: text("description"),
    category: varchar("category", { length: 50 }),
    defaultCost: numeric("default_cost", { precision: 10, scale: 2 }),
    orderUrl: varchar("order_url", { length: 1000 }),
    markupPercent: numeric("markup_percent", { precision: 5, scale: 2 }),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    minStockLevel: integer("min_stock_level").notNull().default(0),
    holdedProductId: varchar("holded_product_id", { length: 255 }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("parts_supplier_idx").on(table.supplierId),
    index("parts_category_idx").on(table.category),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// PART REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

export const partRequests = pgTable(
  "part_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    partId: uuid("part_id").references(() => parts.id, {
      onDelete: "set null",
    }),
    partName: varchar("part_name", { length: 500 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
    totalCost: numeric("total_cost", { precision: 10, scale: 2 }),
    status: partRequestStatusEnum("status").notNull().default("requested"),
    orderReference: varchar("order_reference", { length: 255 }),
    expectedDelivery: timestamp("expected_delivery", { withTimezone: true }),
    receivedDate: timestamp("received_date", { withTimezone: true }),
    notes: text("notes"),
    // Pricing fields
    sellPrice: numeric("sell_price", { precision: 10, scale: 2 }),
    markupPercent: numeric("markup_percent", { precision: 5, scale: 2 }),
    includeInEstimate: boolean("include_in_estimate").notNull().default(true),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    requestType: requestTypeEnum("request_type").notNull().default("part"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("part_requests_job_idx").on(table.repairJobId),
    index("part_requests_status_idx").on(table.status),
    index("part_requests_supplier_idx").on(table.supplierId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS (Batch records)
// ─────────────────────────────────────────────────────────────────────────────

export const imports = pgTable("imports", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: varchar("filename", { length: 500 }).notNull(),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  status: importStatusEnum("status").notNull().default("pending"),
  totalRows: integer("total_rows").notNull().default(0),
  importedRows: integer("imported_rows").notNull().default(0),
  skippedRows: integer("skipped_rows").notNull().default(0),
  errorRows: integer("error_rows").notNull().default(0),
  duplicateRows: integer("duplicate_rows").notNull().default(0),
  lowConfidenceRows: integer("low_confidence_rows").notNull().default(0),
  sheetsProcessed: jsonb("sheets_processed").$type<string[]>(),
  warnings: jsonb("warnings").$type<string[]>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT ROWS (Raw preservation – NEVER mutate original data)
// ─────────────────────────────────────────────────────────────────────────────

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),

    sourceWorkbook: varchar("source_workbook", { length: 500 }),
    sourceSheet: varchar("source_sheet", { length: 255 }).notNull(),
    sourceRowNumber: integer("source_row_number").notNull(),

    originalCellsJson: jsonb("original_cells_json")
      .notNull()
      .$type<(string | number | boolean | null)[]>(),
    originalJoinedText: text("original_joined_text").notNull(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),

    rowClass: importRowClassEnum("row_class").notNull().default("unknown"),
    status: importRowStatusEnum("status").notNull().default("pending"),

    mappedLocation: varchar("mapped_location", { length: 255 }),
    mappedBayRef: varchar("mapped_bay_ref", { length: 100 }),
    mappedCustomer: varchar("mapped_customer", { length: 500 }),
    mappedInternalId: varchar("mapped_internal_id", { length: 100 }),
    mappedRegistration: varchar("mapped_registration", { length: 500 }),
    mappedIssue: text("mapped_issue"),
    mappedNotes: text("mapped_notes"),
    mappedStatus: varchar("mapped_status", { length: 100 }),
    mappedExtra: text("mapped_extra"),

    inferredStatus: repairStatusEnum("inferred_status"),
    inferredStatusReason: text("inferred_status_reason"),
    inferredStatusConfidence: statusConfidenceEnum("inferred_status_confidence"),
    inferredFlags: jsonb("inferred_flags").$type<Record<string, boolean>>(),

    repairJobId: uuid("repair_job_id").references(() => repairJobs.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    unitId: uuid("unit_id").references(() => units.id, {
      onDelete: "set null",
    }),

    errors: jsonb("errors").$type<string[]>(),
    warnings: jsonb("warnings").$type<string[]>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("import_rows_import_idx").on(table.importId),
    index("import_rows_status_idx").on(table.status),
    index("import_rows_fingerprint_idx").on(table.fingerprint),
    index("import_rows_repair_job_idx").on(table.repairJobId),
    index("import_rows_source_idx").on(table.sourceSheet, table.sourceRowNumber),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR JOB ↔ RAW ROWS (junction)
// ─────────────────────────────────────────────────────────────────────────────

export const repairJobRawRows = pgTable(
  "repair_job_raw_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    importRowId: uuid("import_row_id")
      .notNull()
      .references(() => importRows.id, { onDelete: "cascade" }),
    linkType: varchar("link_type", { length: 50 }).notNull().default("primary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_job_raw_rows_job_idx").on(table.repairJobId),
    index("repair_job_raw_rows_row_idx").on(table.importRowId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// CANDIDATE DUPLICATES
// ─────────────────────────────────────────────────────────────────────────────

export const candidateDuplicates = pgTable(
  "candidate_duplicates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importRowAId: uuid("import_row_a_id")
      .notNull()
      .references(() => importRows.id, { onDelete: "cascade" }),
    importRowBId: uuid("import_row_b_id")
      .notNull()
      .references(() => importRows.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    reason: text("reason").notNull(),
    status: duplicateStatusEnum("status").notNull().default("pending"),
    mergedIntoJobId: uuid("merged_into_job_id").references(
      () => repairJobs.id,
      { onDelete: "set null" }
    ),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("candidate_duplicates_status_idx").on(table.status),
    index("candidate_duplicates_row_a_idx").on(table.importRowAId),
    index("candidate_duplicates_row_b_idx").on(table.importRowBId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 255 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id"),
    changes: jsonb("changes"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_user_idx").on(table.userId),
    index("audit_logs_created_idx").on(table.createdAt),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// ACTION REMINDERS
// ─────────────────────────────────────────────────────────────────────────────

export const reminderTypeEnum = pgEnum("reminder_type", [
  "create_invoice",
  "follow_up_customer",
  "order_parts",
  "check_delivery",
  "schedule_repair",
  "send_quote",
  "contact_customer",
  "custom",
]);

export const actionReminders = pgTable(
  "action_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id").references(() => repairJobs.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reminderType: reminderTypeEnum("reminder_type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    autoGenerated: boolean("auto_generated").notNull().default(false),
    triggerEvent: varchar("trigger_event", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("action_reminders_job_idx").on(table.repairJobId),
    index("action_reminders_user_idx").on(table.userId),
    index("action_reminders_due_idx").on(table.dueAt),
    index("action_reminders_completed_idx").on(table.completedAt),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNICATION LOGS
// ─────────────────────────────────────────────────────────────────────────────

export const contactMethodEnum = pgEnum("contact_method", [
  "phone",
  "whatsapp",
  "email",
  "in_person",
  "sms",
  "other",
]);

export const contactDirectionEnum = pgEnum("contact_direction", [
  "outbound",
  "inbound",
]);

export const feedbackStatusEnum = pgEnum("feedback_status", [
  "open",
  "in_progress",
  "done",
  "dismissed",
]);

export const communicationLogs = pgTable(
  "communication_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contactMethod: contactMethodEnum("contact_method").notNull(),
    direction: contactDirectionEnum("direction").notNull().default("outbound"),
    contactPerson: varchar("contact_person", { length: 255 }),
    summary: text("summary").notNull(),
    outcome: varchar("outcome", { length: 255 }),
    contactedAt: timestamp("contacted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("communication_logs_job_idx").on(table.repairJobId),
    index("communication_logs_user_idx").on(table.userId),
    index("communication_logs_contacted_idx").on(table.contactedAt),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK
// ─────────────────────────────────────────────────────────────────────────────

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    status: feedbackStatusEnum("status").notNull().default("open"),
    adminNotes: text("admin_notes"),
    /** True when team replied in admin_notes; cleared when author opens /feedback. */
    authorHasUnreadResponse: boolean("author_has_unread_response").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("feedback_user_idx").on(table.userId),
    index("feedback_status_idx").on(table.status),
    index("feedback_created_idx").on(table.createdAt),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  repairJobs: many(repairJobs),
  assignments: many(repairJobAssignments),
  auditLogs: many(auditLogs),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  units: many(units),
  repairJobs: many(repairJobs),
  importRows: many(importRows),
  tags: many(customerTags),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  customer: one(customers, {
    fields: [units.customerId],
    references: [customers.id],
  }),
  repairJobs: many(repairJobs),
  importRows: many(importRows),
  tags: many(unitTags),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  repairJobs: many(repairJobs),
}));

export const repairJobsRelations = relations(repairJobs, ({ one, many }) => ({
  location: one(locations, {
    fields: [repairJobs.locationId],
    references: [locations.id],
  }),
  customer: one(customers, {
    fields: [repairJobs.customerId],
    references: [customers.id],
  }),
  unit: one(units, {
    fields: [repairJobs.unitId],
    references: [units.id],
  }),
  assignedUser: one(users, {
    fields: [repairJobs.assignedUserId],
    references: [users.id],
  }),
  events: many(repairJobEvents),
  tags: many(repairJobTags),
  rawRows: many(repairJobRawRows),
  assignments: many(repairJobAssignments),
  partRequests: many(partRequests),
  reminders: many(actionReminders),
  communicationLogs: many(communicationLogs),
}));

export const repairJobEventsRelations = relations(
  repairJobEvents,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [repairJobEvents.repairJobId],
      references: [repairJobs.id],
    }),
    user: one(users, {
      fields: [repairJobEvents.userId],
      references: [users.id],
    }),
  })
);

export const tagsRelations = relations(tags, ({ many }) => ({
  repairJobs: many(repairJobTags),
  customers: many(customerTags),
  units: many(unitTags),
}));

export const repairJobTagsRelations = relations(repairJobTags, ({ one }) => ({
  repairJob: one(repairJobs, {
    fields: [repairJobTags.repairJobId],
    references: [repairJobs.id],
  }),
  tag: one(tags, {
    fields: [repairJobTags.tagId],
    references: [tags.id],
  }),
}));

export const customerTagsRelations = relations(customerTags, ({ one }) => ({
  customer: one(customers, {
    fields: [customerTags.customerId],
    references: [customers.id],
  }),
  tag: one(tags, {
    fields: [customerTags.tagId],
    references: [tags.id],
  }),
}));

export const unitTagsRelations = relations(unitTags, ({ one }) => ({
  unit: one(units, {
    fields: [unitTags.unitId],
    references: [units.id],
  }),
  tag: one(tags, {
    fields: [unitTags.tagId],
    references: [tags.id],
  }),
}));

export const repairJobRawRowsRelations = relations(
  repairJobRawRows,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [repairJobRawRows.repairJobId],
      references: [repairJobs.id],
    }),
    importRow: one(importRows, {
      fields: [repairJobRawRows.importRowId],
      references: [importRows.id],
    }),
  })
);

export const importsRelations = relations(imports, ({ one, many }) => ({
  user: one(users, {
    fields: [imports.userId],
    references: [users.id],
  }),
  rows: many(importRows),
}));

export const importRowsRelations = relations(importRows, ({ one, many }) => ({
  import: one(imports, {
    fields: [importRows.importId],
    references: [imports.id],
  }),
  repairJob: one(repairJobs, {
    fields: [importRows.repairJobId],
    references: [repairJobs.id],
  }),
  customer: one(customers, {
    fields: [importRows.customerId],
    references: [customers.id],
  }),
  unit: one(units, {
    fields: [importRows.unitId],
    references: [units.id],
  }),
  rawRowLinks: many(repairJobRawRows),
}));

export const repairJobAssignmentsRelations = relations(
  repairJobAssignments,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [repairJobAssignments.repairJobId],
      references: [repairJobs.id],
    }),
    user: one(users, {
      fields: [repairJobAssignments.userId],
      references: [users.id],
    }),
  })
);

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  parts: many(parts),
}));

export const partsRelations = relations(parts, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [parts.supplierId],
    references: [suppliers.id],
  }),
  partRequests: many(partRequests),
}));

export const partRequestsRelations = relations(partRequests, ({ one }) => ({
  repairJob: one(repairJobs, {
    fields: [partRequests.repairJobId],
    references: [repairJobs.id],
  }),
  part: one(parts, {
    fields: [partRequests.partId],
    references: [parts.id],
  }),
  supplier: one(suppliers, {
    fields: [partRequests.supplierId],
    references: [suppliers.id],
  }),
}));

export const candidateDuplicatesRelations = relations(
  candidateDuplicates,
  ({ one }) => ({
    rowA: one(importRows, {
      fields: [candidateDuplicates.importRowAId],
      references: [importRows.id],
      relationName: "duplicateRowA",
    }),
    rowB: one(importRows, {
      fields: [candidateDuplicates.importRowBId],
      references: [importRows.id],
      relationName: "duplicateRowB",
    }),
    mergedIntoJob: one(repairJobs, {
      fields: [candidateDuplicates.mergedIntoJobId],
      references: [repairJobs.id],
    }),
    reviewedBy: one(users, {
      fields: [candidateDuplicates.reviewedByUserId],
      references: [users.id],
    }),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const actionRemindersRelations = relations(
  actionReminders,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [actionReminders.repairJobId],
      references: [repairJobs.id],
    }),
    user: one(users, {
      fields: [actionReminders.userId],
      references: [users.id],
    }),
  })
);

export const communicationLogsRelations = relations(
  communicationLogs,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [communicationLogs.repairJobId],
      references: [repairJobs.id],
    }),
    user: one(users, {
      fields: [communicationLogs.userId],
      references: [users.id],
    }),
  })
);

export const feedbackRelations = relations(feedback, ({ one }) => ({
  user: one(users, {
    fields: [feedback.userId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR TASKS (garage subtasks per repair job)
// ─────────────────────────────────────────────────────────────────────────────

export const repairTasks = pgTable(
  "repair_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    titleEs: varchar("title_es", { length: 500 }),
    titleNl: varchar("title_nl", { length: 500 }),
    description: text("description"),
    status: repairTaskStatusEnum("status").notNull().default("pending"),
    sortOrder: integer("sort_order").notNull().default(0),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    problemCategory: varchar("problem_category", { length: 100 }),
    problemNote: text("problem_note"),
    source: varchar("source", { length: 50 }).notNull().default("office"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedByUserId: uuid("completed_by_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    // Pricing fields
    estimatedHours: numeric("estimated_hours", { precision: 6, scale: 2 }),
    actualHours: numeric("actual_hours", { precision: 6, scale: 2 }),
    billable: boolean("billable").notNull().default(true),
    hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }),
    includeInEstimate: boolean("include_in_estimate").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_tasks_job_idx").on(table.repairJobId),
    index("repair_tasks_status_idx").on(table.status),
    index("repair_tasks_assigned_idx").on(table.assignedUserId),
  ]
);

export const repairTasksRelations = relations(repairTasks, ({ one }) => ({
  repairJob: one(repairJobs, {
    fields: [repairTasks.repairJobId],
    references: [repairJobs.id],
  }),
  assignedUser: one(users, {
    fields: [repairTasks.assignedUserId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR PHOTOS (images attached to repairs / tasks)
// ─────────────────────────────────────────────────────────────────────────────

export const repairPhotos = pgTable(
  "repair_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    repairTaskId: uuid("repair_task_id").references(() => repairTasks.id, {
      onDelete: "cascade",
    }),
    findingId: uuid("finding_id").references(() => repairFindings.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    caption: text("caption"),
    photoType: varchar("photo_type", { length: 50 }).notNull().default("general"),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    onedrivePath: text("onedrive_path"),
    onedriveFolderUrl: text("onedrive_folder_url"),
    onedriveItemId: text("onedrive_item_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_photos_job_idx").on(table.repairJobId),
    index("repair_photos_task_idx").on(table.repairTaskId),
    index("repair_photos_finding_idx").on(table.findingId),
  ]
);

export const repairPhotosRelations = relations(repairPhotos, ({ one }) => ({
  repairJob: one(repairJobs, {
    fields: [repairPhotos.repairJobId],
    references: [repairJobs.id],
  }),
  repairTask: one(repairTasks, {
    fields: [repairPhotos.repairTaskId],
    references: [repairTasks.id],
  }),
  uploadedBy: one(users, {
    fields: [repairPhotos.uploadedByUserId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// APP SETTINGS (single-row key-value store)
// ─────────────────────────────────────────────────────────────────────────────

export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR WORKERS (who worked on a repair)
// ─────────────────────────────────────────────────────────────────────────────

export const repairWorkers = pgTable(
  "repair_workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: text("note"),
    addedByUserId: uuid("added_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_workers_job_idx").on(table.repairJobId),
    index("repair_workers_user_idx").on(table.userId),
  ]
);

export const repairWorkersRelations = relations(repairWorkers, ({ one }) => ({
  repairJob: one(repairJobs, {
    fields: [repairWorkers.repairJobId],
    references: [repairJobs.id],
  }),
  user: one(users, {
    fields: [repairWorkers.userId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR FINDINGS (inspection findings by technicians)
// ─────────────────────────────────────────────────────────────────────────────

export const repairFindings = pgTable(
  "repair_findings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    category: findingCategoryEnum("category").notNull().default("other"),
    description: text("description").notNull(),
    severity: findingSeverityEnum("severity").notNull().default("normal"),
    requiresFollowUp: boolean("requires_follow_up").notNull().default(false),
    requiresCustomerApproval: boolean("requires_customer_approval")
      .notNull()
      .default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_findings_job_idx").on(table.repairJobId),
    index("repair_findings_severity_idx").on(table.severity),
  ]
);

export const repairFindingsRelations = relations(
  repairFindings,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [repairFindings.repairJobId],
      references: [repairJobs.id],
    }),
    createdBy: one(users, {
      fields: [repairFindings.createdByUserId],
      references: [users.id],
    }),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR BLOCKERS (job-level blockers)
// ─────────────────────────────────────────────────────────────────────────────

export const repairBlockers = pgTable(
  "repair_blockers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    reason: blockerReasonEnum("reason").notNull().default("other"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("repair_blockers_job_idx").on(table.repairJobId),
    index("repair_blockers_active_idx").on(table.active),
  ]
);

export const repairBlockersRelations = relations(
  repairBlockers,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [repairBlockers.repairJobId],
      references: [repairJobs.id],
    }),
    createdBy: one(users, {
      fields: [repairBlockers.createdByUserId],
      references: [users.id],
    }),
    resolvedBy: one(users, {
      fields: [repairBlockers.resolvedByUserId],
      references: [users.id],
    }),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATE LINE ITEMS (persisted pricing lines linked to work sources)
// ─────────────────────────────────────────────────────────────────────────────

export const estimateLineItems = pgTable(
  "estimate_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    type: estimateLineTypeEnum("type").notNull().default("custom"),
    sourceType: estimateLineSourceEnum("source_type").notNull().default("manual"),
    sourceId: uuid("source_id"),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
    internalCost: numeric("internal_cost", { precision: 10, scale: 2 }).notNull().default("0"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("estimate_line_items_job_idx").on(table.repairJobId),
    index("estimate_line_items_source_idx").on(table.sourceType, table.sourceId),
  ]
);

export const estimateLineItemsRelations = relations(
  estimateLineItems,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [estimateLineItems.repairJobId],
      references: [repairJobs.id],
    }),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// DISMISSED WORKSHOP ITEMS (track manually removed workshop-sourced items)
// ─────────────────────────────────────────────────────────────────────────────

export const dismissedWorkshopItems = pgTable(
  "dismissed_workshop_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    sourceType: estimateLineSourceEnum("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    dismissedBy: uuid("dismissed_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("dismissed_workshop_items_job_idx").on(table.repairJobId),
    index("dismissed_workshop_items_source_idx").on(
      table.repairJobId,
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const dismissedWorkshopItemsRelations = relations(
  dismissedWorkshopItems,
  ({ one }) => ({
    repairJob: one(repairJobs, {
      fields: [dismissedWorkshopItems.repairJobId],
      references: [repairJobs.id],
    }),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// QUOTE OVERRIDES (dismiss or add note to uninvoiced Holded quotes)
// ─────────────────────────────────────────────────────────────────────────────

export const quoteOverrides = pgTable(
  "quote_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    holdedQuoteId: varchar("holded_quote_id", { length: 255 }).notNull().unique(),
    dismissed: boolean("dismissed").notNull().default(false),
    note: text("note"),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    convertedInvoiceId: varchar("converted_invoice_id", { length: 255 }),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("quote_overrides_holded_idx").on(table.holdedQuoteId),
  ]
);

// ─────────────────────────────────────────────────────────────────────────────
// TIME ENTRIES (time registration / timer)
// ─────────────────────────────────────────────────────────────────────────────

export const timeEntrySourceEnum = pgEnum("time_entry_source", [
  "garage_timer",
  "manual",
]);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
      .references(() => repairJobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
    roundedMinutes: integer("rounded_minutes"),
    source: timeEntrySourceEnum("source").notNull().default("garage_timer"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("time_entries_job_idx").on(table.repairJobId),
    index("time_entries_user_idx").on(table.userId),
    index("time_entries_active_idx").on(table.userId, table.endedAt),
  ]
);

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  repairJob: one(repairJobs, {
    fields: [timeEntries.repairJobId],
    references: [repairJobs.id],
  }),
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// TOOL REQUESTS — garage workers ask the office for a tool / part / supply
// ─────────────────────────────────────────────────────────────────────────────
//
// The shared iPad has a "Need a tool?" button on the today screen. Workers
// type (or speak) a short request — optionally tied to a specific repair job.
// Admin sees an inbox in the dashboard and ticks them off as they're handled.
// Kept intentionally simple: one free-text field, three states, no catalog.

export const toolRequestStatusEnum = pgEnum("tool_request_status", [
  "open",
  "resolved",
  "cancelled",
]);

export const toolRequests = pgTable(
  "tool_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id").references(() => repairJobs.id, {
      onDelete: "set null",
    }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    requestedByLabel: varchar("requested_by_label", { length: 80 }),
    description: text("description").notNull(),
    status: toolRequestStatusEnum("status").notNull().default("open"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("tool_requests_status_idx").on(table.status, table.createdAt),
    index("tool_requests_job_idx").on(table.repairJobId),
  ],
);

// ─────────────────────────────────────────────────────────────────────────────
// VOICE NOTES — short audio recordings attached to comments / blockers /
// findings / tool-requests. Workers can speak instead of typing on a tablet
// keyboard with gloves on. Admin plays them back inline.
// ─────────────────────────────────────────────────────────────────────────────
//
// We use a polymorphic owner_type / owner_id pattern instead of adding an
// `audio_url` column to four different tables. Audio is stored next to the
// repair photos in OneDrive and served through a proxy route, mirroring the
// pattern in src/app/api/photos.

export const voiceNoteOwnerTypeEnum = pgEnum("voice_note_owner_type", [
  "comment",
  "blocker",
  "finding",
  "tool_request",
  "repair_message",
]);

export const voiceNotes = pgTable(
  "voice_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id").references(() => repairJobs.id, {
      onDelete: "cascade",
    }),
    ownerType: voiceNoteOwnerTypeEnum("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    mimeType: varchar("mime_type", { length: 80 }).notNull(),
    url: text("url").notNull(),
    onedrivePath: text("onedrive_path"),
    onedriveFolderUrl: text("onedrive_folder_url"),
    onedriveItemId: text("onedrive_item_id"),
    transcript: text("transcript"),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedByLabel: varchar("uploaded_by_label", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("voice_notes_owner_idx").on(table.ownerType, table.ownerId),
    index("voice_notes_job_idx").on(table.repairJobId),
  ],
);
