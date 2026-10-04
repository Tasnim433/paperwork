CREATE TYPE "public"."work_entry_source" AS ENUM('payslip', 'manual');--> statement-breakpoint
ALTER TABLE "work_entries" ADD COLUMN "source" "work_entry_source" DEFAULT 'payslip' NOT NULL;