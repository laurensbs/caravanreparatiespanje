CREATE TYPE "public"."final_check_status" AS ENUM('pending', 'passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."repair_task_status" AS ENUM('pending', 'in_progress', 'done', 'problem', 'review');--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'no_damage';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'technician' BEFORE 'viewer';--> statement-breakpoint
CREATE TABLE "repair_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid NOT NULL,
	"repair_task_id" uuid,
	"url" text NOT NULL,
	"thumbnail_url" text,
	"caption" text,
	"photo_type" varchar(50) DEFAULT 'general' NOT NULL,
	"uploaded_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"title_es" varchar(500),
	"title_nl" varchar(500),
	"description" text,
	"status" "repair_task_status" DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"assigned_user_id" uuid,
	"problem_category" varchar(100),
	"problem_note" text,
	"source" varchar(50) DEFAULT 'office' NOT NULL,
	"approved_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_workers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repair_job_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"note" text,
	"added_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repair_jobs" ALTER COLUMN "status" SET DEFAULT 'todo';--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "holded_invoice_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "last_payment_reminder_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "holded_quote_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "final_check_status" "final_check_status";--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "final_check_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "final_check_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD COLUMN "final_check_notes" text;--> statement-breakpoint
ALTER TABLE "repair_photos" ADD CONSTRAINT "repair_photos_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_photos" ADD CONSTRAINT "repair_photos_repair_task_id_repair_tasks_id_fk" FOREIGN KEY ("repair_task_id") REFERENCES "public"."repair_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_photos" ADD CONSTRAINT "repair_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tasks" ADD CONSTRAINT "repair_tasks_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tasks" ADD CONSTRAINT "repair_tasks_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tasks" ADD CONSTRAINT "repair_tasks_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_tasks" ADD CONSTRAINT "repair_tasks_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_workers" ADD CONSTRAINT "repair_workers_repair_job_id_repair_jobs_id_fk" FOREIGN KEY ("repair_job_id") REFERENCES "public"."repair_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_workers" ADD CONSTRAINT "repair_workers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repair_workers" ADD CONSTRAINT "repair_workers_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repair_photos_job_idx" ON "repair_photos" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_photos_task_idx" ON "repair_photos" USING btree ("repair_task_id");--> statement-breakpoint
CREATE INDEX "repair_tasks_job_idx" ON "repair_tasks" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_tasks_status_idx" ON "repair_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "repair_tasks_assigned_idx" ON "repair_tasks" USING btree ("assigned_user_id");--> statement-breakpoint
CREATE INDEX "repair_workers_job_idx" ON "repair_workers" USING btree ("repair_job_id");--> statement-breakpoint
CREATE INDEX "repair_workers_user_idx" ON "repair_workers" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "repair_jobs" ADD CONSTRAINT "repair_jobs_final_check_by_user_id_users_id_fk" FOREIGN KEY ("final_check_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;