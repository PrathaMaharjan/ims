-- Merge `suppliers` + `customers` into a single `parties` table.
--
-- Run this ONCE against the existing database BEFORE running `pnpm db:push`
-- with the new schema. If `db:push` runs first it will drop the old tables
-- and every supplier/customer link on purchases, sales, batches, returns
-- and payments.
--
-- Party ids reuse the old supplier/customer ids, so every existing foreign
-- key value stays valid — it's a straight copy, no id remapping.
--
-- Everything runs in one transaction: if any statement fails, nothing changes.
-- Take a backup first anyway:  pg_dump "$DATABASE_URL" > before-parties.sql

BEGIN;

-- 1. New enum + table -------------------------------------------------------

CREATE TYPE "party_type" AS ENUM ('SUPPLIER', 'CUSTOMER', 'BOTH');

CREATE TABLE "parties" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "party_type" "party_type" DEFAULT 'BOTH' NOT NULL,
  "contact_person" varchar(255),
  "pan_vat_number" varchar(50),
  "address" text,
  "phone" varchar(30),
  "email" varchar(255),
  "payment_terms" varchar(255),
  "status" boolean DEFAULT true NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "parties_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade
);

-- 2. Copy the data ----------------------------------------------------------

INSERT INTO "parties"
  ("id", "organization_id", "name", "party_type", "contact_person", "pan_vat_number",
   "address", "phone", "email", "payment_terms", "status", "notes", "created_at")
SELECT
  "id", "organization_id", "name", 'SUPPLIER', "contact_person", "pan_vat_number",
  "address", "phone", "email", "payment_terms", "status", "notes", "created_at"
FROM "suppliers";

INSERT INTO "parties"
  ("id", "organization_id", "name", "party_type", "address", "phone", "email", "status", "created_at")
SELECT
  "id", "organization_id", "name", 'CUSTOMER', "address", "phone", "email", "status", "created_at"
FROM "customers";

-- 3. Re-point foreign keys --------------------------------------------------

-- purchases.supplier_id -> purchases.party_id (required)
ALTER TABLE "purchases" ADD COLUMN "party_id" uuid;
UPDATE "purchases" SET "party_id" = "supplier_id";
ALTER TABLE "purchases" ALTER COLUMN "party_id" SET NOT NULL;
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_party_id_parties_id_fk"
  FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE restrict;
ALTER TABLE "purchases" DROP COLUMN "supplier_id";

-- sales.customer_id -> sales.party_id (optional: walk-in sales have none)
ALTER TABLE "sales" ADD COLUMN "party_id" uuid;
UPDATE "sales" SET "party_id" = "customer_id";
ALTER TABLE "sales" ADD CONSTRAINT "sales_party_id_parties_id_fk"
  FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE set null;
ALTER TABLE "sales" DROP COLUMN "customer_id";

-- batches.supplier_id -> batches.party_id (optional)
ALTER TABLE "batches" ADD COLUMN "party_id" uuid;
UPDATE "batches" SET "party_id" = "supplier_id";
ALTER TABLE "batches" ADD CONSTRAINT "batches_party_id_parties_id_fk"
  FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE set null;
ALTER TABLE "batches" DROP COLUMN "supplier_id";

-- purchase_returns.supplier_id -> purchase_returns.party_id (required)
ALTER TABLE "purchase_returns" ADD COLUMN "party_id" uuid;
UPDATE "purchase_returns" SET "party_id" = "supplier_id";
ALTER TABLE "purchase_returns" ALTER COLUMN "party_id" SET NOT NULL;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_party_id_parties_id_fk"
  FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE restrict;
ALTER TABLE "purchase_returns" DROP COLUMN "supplier_id";

-- payments.supplier_id + payments.customer_id -> payments.party_id
ALTER TABLE "payments" ADD COLUMN "party_id" uuid;
UPDATE "payments" SET "party_id" = COALESCE("supplier_id", "customer_id");
ALTER TABLE "payments" ADD CONSTRAINT "payments_party_id_parties_id_fk"
  FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE set null;
ALTER TABLE "payments" DROP COLUMN "supplier_id";
ALTER TABLE "payments" DROP COLUMN "customer_id";

-- 4. Remove the old tables --------------------------------------------------

DROP TABLE "suppliers";
DROP TABLE "customers";

COMMIT;

-- Afterwards: `pnpm db:push` should report no changes (or only trivial ones).
-- Review its plan before confirming — it must NOT say it will drop data.
