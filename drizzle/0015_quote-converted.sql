ALTER TABLE "quote_overrides" ADD COLUMN "converted_at" timestamp with time zone;
ALTER TABLE "quote_overrides" ADD COLUMN "converted_invoice_id" varchar(255);
