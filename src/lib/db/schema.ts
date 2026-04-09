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
  "viewer",
]);

export const repairStatusEnum = pgEnum("repair_status", [
  "new",
  "todo",
  "in_inspection",
  "quote_needed",
  "waiting_approval",
  "waiting_customer",
  "waiting_parts",
  "scheduled",
  "in_progress",
  "blocked",
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
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "not_invoiced",
  "draft",
  "sent",
  "paid",
  "warranty",
  "rejected",
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

    status: repairStatusEnum("status").notNull().default("new"),
    statusReason: text("status_reason"),
    statusConfidence: statusConfidenceEnum("status_confidence"),
    priority: priorityEnum("priority").notNull().default("normal"),

    businessProcessType: businessProcessTypeEnum("business_process_type")
      .notNull()
      .default("repair"),
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

    holdedInvoiceId: varchar("holded_invoice_id", { length: 255 }),
    holdedInvoiceNum: varchar("holded_invoice_num", { length: 100 }),
    holdedInvoiceDate: timestamp("holded_invoice_date", { withTimezone: true }),
    holdedQuoteId: varchar("holded_quote_id", { length: 255 }),
    holdedQuoteNum: varchar("holded_quote_num", { length: 100 }),
    holdedQuoteDate: timestamp("holded_quote_date", { withTimezone: true }),

    bayReference: varchar("bay_reference", { length: 100 }),
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
    index("repair_jobs_archived_idx").on(table.archivedAt),
    index("repair_jobs_deleted_idx").on(table.deletedAt),
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
// PARTS
// ─────────────────────────────────────────────────────────────────────────────

export const parts = pgTable(
  "parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 500 }).notNull(),
    partNumber: varchar("part_number", { length: 255 }),
    description: text("description"),
    defaultCost: numeric("default_cost", { precision: 10, scale: 2 }),
    orderUrl: varchar("order_url", { length: 1000 }),
    markupPercent: numeric("markup_percent", { precision: 5, scale: 2 }),
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
  (table) => [index("parts_supplier_idx").on(table.supplierId)]
);

// ─────────────────────────────────────────────────────────────────────────────
// PART REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

export const partRequests = pgTable(
  "part_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repairJobId: uuid("repair_job_id")
      .notNull()
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
