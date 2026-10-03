CREATE TYPE "public"."page_text_source" AS ENUM('text_layer', 'ocr');--> statement-breakpoint
CREATE TYPE "public"."processing_stage" AS ENUM('text_recognition', 'classification', 'extraction', 'validation', 'summary');--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'failed';--> statement-breakpoint
CREATE TABLE "document_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"document_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"width" real NOT NULL,
	"height" real NOT NULL,
	"source" "page_text_source" NOT NULL,
	"text" text NOT NULL,
	"words" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "processing_stage" "processing_stage";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "type_confidence" real;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD COLUMN "rule" text;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_pages_document_id_page_unique" ON "document_pages" USING btree ("document_id","page_number");