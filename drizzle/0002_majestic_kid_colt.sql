ALTER TABLE "batches" ALTER COLUMN "expiry_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_items" ALTER COLUMN "expiry_date" DROP NOT NULL;