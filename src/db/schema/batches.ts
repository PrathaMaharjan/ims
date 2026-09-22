import { pgTable, uuid, varchar, date, numeric, integer, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { products } from "./products";
import { suppliers } from "./suppliers";

import { batchStatusEnum } from "./enums";
import { saleItems } from "./sales";

// Batch = a specific received quantity of a product. This is the core entity —
// stock, expiry, and cost all live here, never directly on the product.
export const batches = pgTable("batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  supplierId: uuid("supplier_id").references(() => suppliers.id, {
    onDelete: "set null",
  }),
  batchNumber: varchar("batch_number", { length: 100 }).notNull(),
  manufacturingDate: date("manufacturing_date"),
  expiryDate: date("expiry_date").notNull(),
  purchasePrice: numeric("purchase_price", { precision: 12, scale: 2 }).notNull(),
  mrp: numeric("mrp", { precision: 12, scale: 2 }).notNull(),
  quantityReceived: integer("quantity_received").notNull(),
  quantityAvailable: integer("quantity_available").notNull(), // decremented on sale/return-out
  status: batchStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  productExpiryIdx: index("batches_product_expiry_idx").on(
    table.productId,
    table.expiryDate
  ),
  orgBatchNumberIdx: index("batches_org_batch_number_idx").on(
    table.organizationId,
    table.batchNumber
  ),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
  supplier: one(suppliers, {
    fields: [batches.supplierId],
    references: [suppliers.id],
  }),
  saleItems: many(saleItems),
}));