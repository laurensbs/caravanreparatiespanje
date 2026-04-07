CREATE TYPE "public"."business_process_type" AS ENUM('repair', 'follow_up', 'quote', 'parts_order', 'trailer_sale', 'trailer_disposal', 'inspection', 'planning', 'relocation', 'service', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."contact_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."contact_method" AS ENUM('phone', 'whatsapp', 'email', 'in_person', 'sms', 'other');--> statement-breakpoint
CREATE TYPE "public"."customer_response_status" AS ENUM('not_contacted', 'contacted', 'waiting_response', 'approved', 'declined', 'no_response');--> statement-breakpoint
CREATE TYPE "public"."duplicate_status" AS ENUM('pending', 'confirmed_duplicate', 'rejected', 'merged');--> statement-breakpoint
CREATE TYPE "public"."feedback_status" AS ENUM('open', 'in_progress', 'done', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."import_row_class" AS ENUM('record', 'header', 'divider', 'empty', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."import_row_status" AS ENUM('pending', 'imported', 'skipped', 'error', 'duplicate', 'merged');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'completed', 'completed_with_errors', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('not_invoiced', 'draft', 'sent', 'paid', 'warranty');--> statement-breakpoint
CREATE TYPE "public"."part_request_status" AS ENUM('requested', 'ordered', 'shipped', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."reminder_type" AS ENUM('create_invoice', 'follow_up_customer', 'order_parts', 'check_delivery', 'schedule_repair', 'send_quote', 'contact_customer', 'custom');--> statement-breakpoint
CREATE TYPE "public"."repair_status" AS ENUM('new', 'todo', 'in_inspection', 'quote_needed', 'waiting_approval', 'waiting_customer', 'waiting_parts', 'scheduled', 'in_progress', 'blocked', 'completed', 'invoiced', 'archived');--> statement-breakpoint
CREATE TYPE "public"."status_confidence" AS ENUM('high', 'medium', 'low', 'manual');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('caravan', 'trailer', 'camper', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'staff', 'viewer');--> statement-breakpoint
CREATE TABLE "action_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid,
	"user_id" uuid,
	"reminder_type" "reminder_type" NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"auto_generated" boolean DEFAULT false NOT NULL,
	"trigger_event" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(255) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"changes" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_duplicates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_row_a_id" uuid NOT NULL,
	"import_row_b_id" uuid NOT NULL,
	"confidence" real NOT NULL,
	"reason" text NOT NULL,
	"status" "duplicate_status" DEFAULT 'pending' NOT NULL,
	"merged_into_job_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid NOT NULL,
	"user_id" uuid,
	"contact_method" "contact_method" NOT NULL,
	"direction" "contact_direction" DEFAULT 'outbound' NOT NULL,
	"contact_person" varchar(255),
	"summary" text NOT NULL,
	"outcome" varchar(255),
	"contacted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"phone" varchar(100),
	"email" varchar(255),
	"notes" text,
	"provisional" boolean DEFAULT false NOT NULL,
	"confidence_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" "feedback_status" DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"source_workbook" varchar(500),
	"source_sheet" varchar(255) NOT NULL,
	"source_row_number" integer NOT NULL,
	"original_cells_json" jsonb NOT NULL,
	"original_joined_text" text NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"row_class" "import_row_class" DEFAULT 'unknown' NOT NULL,
	"status" "import_row_status" DEFAULT 'pending' NOT NULL,
	"mapped_location" varchar(255),
	"mapped_bay_ref" varchar(100),
	"mapped_customer" varchar(500),
	"mapped_internal_id" varchar(100),
	"mapped_registration" varchar(500),
	"mapped_issue" text,
	"mapped_notes" text,
	"mapped_status" varchar(100),
	"mapped_extra" text,
	"inferred_status" "repair_status",
	"inferred_status_reason" text,
	"inferred_status_confidence" "status_confidence",
	"inferred_flags" jsonb,
	"repair_job_id" uuid,
	"customer_id" uuid,
	"unit_id" uuid,
	"errors" jsonb,
	"warnings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(500) NOT NULL,
	"user_id" uuid,
	"status" "import_status" DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"low_confidence_rows" integer DEFAULT 0 NOT NULL,
	"sheets_processed" jsonb,
	"warnings" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"source_sheet_name" varchar(255),
	"source_category" varchar(100),
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "part_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid NOT NULL,
	"part_id" uuid,
	"part_name" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"status" "part_request_status" DEFAULT 'requested' NOT NULL,
	"order_reference" varchar(255),
	"expected_delivery" timestamp with time zone,
	"received_date" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(500) NOT NULL,
	"part_number" varchar(255),
	"description" text,
	"default_cost" numeric(10, 2),
	"supplier_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_job_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repair_job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid NOT NULL,
	"user_id" uuid,
	"event_type" varchar(100) NOT NULL,
	"field_changed" varchar(100),
	"old_value" text,
	"new_value" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_job_raw_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid NOT NULL,
	"import_row_id" uuid NOT NULL,
	"link_type" varchar(50) DEFAULT 'primary' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_job_tags" (
	"repair_job_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "repair_job_tags_repair_job_id_tag_id_pk" PRIMARY KEY("repair_job_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "repair_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" varchar(100),
	"source_category" varchar(100),
	"source_sheet" varchar(255),
	"location_id" uuid,
	"customer_id" uuid,
	"unit_id" uuid,
	"title" varchar(500),
	"description_raw" text,
	"description_normalized" text,
	"parts_needed_raw" text,
	"notes_raw" text,
	"extra_notes_raw" text,
	"internal_comments" text,
	"status" "repair_status" DEFAULT 'new' NOT NULL,
	"status_reason" text,
	"status_confidence" "status_confidence",
	"priority" "priority" DEFAULT 'normal' NOT NULL,
	"business_process_type" "business_process_type" DEFAULT 'repair' NOT NULL,
	"customer_response_status" "customer_response_status" DEFAULT 'not_contacted' NOT NULL,
	"invoice_status" "invoice_status" DEFAULT 'not_invoiced' NOT NULL,
	"warranty_internal_cost_flag" boolean DEFAULT false NOT NULL,
	"prepaid_flag" boolean DEFAULT false NOT NULL,
	"water_damage_risk_flag" boolean DEFAULT false NOT NULL,
	"safety_flag" boolean DEFAULT false NOT NULL,
	"tyres_flag" boolean DEFAULT false NOT NULL,
	"lights_flag" boolean DEFAULT false NOT NULL,
	"brakes_flag" boolean DEFAULT false NOT NULL,
	"windows_flag" boolean DEFAULT false NOT NULL,
	"seals_flag" boolean DEFAULT false NOT NULL,
	"parts_required_flag" boolean DEFAULT false NOT NULL,
	"follow_up_required_flag" boolean DEFAULT false NOT NULL,
	"bay_reference" varchar(100),
	"spreadsheet_internal_id" varchar(100),
	"assigned_user_id" uuid,
	"estimated_cost" numeric(10, 2),
	"actual_cost" numeric(10, 2),
	"estimated_hours" numeric(6, 2),
	"actual_hours" numeric(6, 2),
	"due_date" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_name" varchar(255),
	"phone" varchar(100),
	"email" varchar(255),
	"website" varchar(500),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#6b7280' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_type" "unit_type" DEFAULT 'unknown' NOT NULL,
	"registration" varchar(100),
	"brand" varchar(255),
	"model" varchar(255),
	"year" integer,
	"chassis_id" varchar(255),
	"internal_number" varchar(100),
	"customer_id" uuid,
	"notes" text,
	"provisional" boolean DEFAULT false NOT NULL,
	"registration_raw" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "action_reminders" ADD CONSTRAINT "action_reminders_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_reminders" ADD CONSTRAINT "action_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_duplicates" ADD CONSTRAINT "candidate_duplicates_import_row_a_id_import_rows_id_fk" FOREIGN KEY ("import_row_a_id") REFERENCES "public"."import_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_duplicates" ADD CONSTRAINT "candidate_duplicates_import_row_b_id_import_rows_id_fk" FOREIGN KEY ("import_row_b_id") REFERENCES "public"."import_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_duplicates" ADD CONSTRAINT "candidate_duplicates_merged_into_job_id_repair_jobs_id_fk" FOREIGN KEY ("merged_into_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_duplicates" ADD CONSTRAINT "candidate_duplicates_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_requests" ADD CONSTRAINT "part_requests_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_requests" ADD CONSTRAINT "part_requests_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_job_assignments" ADD CONSTRAINT "repair_job_assignments_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_job_assignments" ADD CONSTRAINT "repair_job_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_job_events" ADD CONSTRAINT "repair_job_events_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_job_events" ADD CONSTRAINT "repair_job_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_job_raw_rows" ADD CONSTRAINT "repair_job_raw_rows_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_job_raw_rows" ADD CONSTRAINT "repair_job_raw_rows_import_row_id_import_rows_id_fk" FOREIGN KEY ("import_row_id") REFERENCES "public"."import_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_job_tags" ADD CONSTRAINT "repair_job_tags_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_job_tags" ADD CONSTRAINT "repair_job_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_reminders_job_idx" ON "action_reminders" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "action_reminders_user_idx" ON "action_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "action_reminders_due_idx" ON "action_reminders" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "action_reminders_completed_idx" ON "action_reminders" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "candidate_duplicates_status_idx" ON "candidate_duplicates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "candidate_duplicates_row_a_idx" ON "candidate_duplicates" USING btree ("import_row_a_id");--> statement-breakpoint
CREATE INDEX "candidate_duplicates_row_b_idx" ON "candidate_duplicates" USING btree ("import_row_b_id");--> statement-breakpoint
CREATE INDEX "communication_logs_job_idx" ON "communication_logs" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "communication_logs_user_idx" ON "communication_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "communication_logs_contacted_idx" ON "communication_logs" USING btree ("contacted_at");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "import_rows_import_idx" ON "import_rows" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "import_rows_status_idx" ON "import_rows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_rows_fingerprint_idx" ON "import_rows" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "import_rows_repair_job_idx" ON "import_rows" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "import_rows_source_idx" ON "import_rows" USING btree ("source_sheet","source_row_number");--> statement-breakpoint
CREATE INDEX "part_requests_job_idx" ON "part_requests" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "part_requests_status_idx" ON "part_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "parts_supplier_idx" ON "parts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "repair_job_assignments_job_idx" ON "repair_job_assignments" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_job_assignments_user_idx" ON "repair_job_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "repair_job_events_job_idx" ON "repair_job_events" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_job_events_created_idx" ON "repair_job_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "repair_job_raw_rows_job_idx" ON "repair_job_raw_rows" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_job_raw_rows_row_idx" ON "repair_job_raw_rows" USING btree ("import_row_id");--> statement-breakpoint
CREATE INDEX "repair_job_tags_job_idx" ON "repair_job_tags" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_job_tags_tag_idx" ON "repair_job_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "repair_jobs_status_idx" ON "repair_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "repair_jobs_location_idx" ON "repair_jobs" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "repair_jobs_customer_idx" ON "repair_jobs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "repair_jobs_unit_idx" ON "repair_jobs" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "repair_jobs_assigned_idx" ON "repair_jobs" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "repair_jobs_priority_idx" ON "repair_jobs" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "repair_jobs_invoice_status_idx" ON "repair_jobs" USING btree ("invoice_status");--> statement-breakpoint
CREATE INDEX "repair_jobs_public_code_idx" ON "repair_jobs" USING btree ("public_code");--> statement-breakpoint
CREATE INDEX "repair_jobs_created_idx" ON "repair_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "repair_jobs_bay_reference_idx" ON "repair_jobs" USING btree ("bay_reference");--> statement-breakpoint
CREATE INDEX "repair_jobs_business_type_idx" ON "repair_jobs" USING btree ("business_process_type");--> statement-breakpoint
CREATE INDEX "repair_jobs_archived_idx" ON "repair_jobs" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "units_registration_idx" ON "units" USING btree ("registration");--> statement-breakpoint
CREATE INDEX "units_customer_id_idx" ON "units" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "units_internal_number_idx" ON "units" USING btree ("internal_number");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");