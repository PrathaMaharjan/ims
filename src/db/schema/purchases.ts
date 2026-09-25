import { pgTable, uuid, varchar, date, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { suppliers } from "./suppliers";
import { products } from "./products";
import { batches } from "./batches";
import { users } from "./users";
import { paymentStatusEnum, purchasePaymentTypeEnum, purcTypeEnum, roundingDirectionEnum } from "./enums";

export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "restrict" }),
  supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 100 }),
  purchaseDate: date("purchase_date").notNull(),
  purcType: purcTypeEnum("purc_type").notNull().default("VAT_ITEM_WISE"),
  paymentType: purchasePaymentTypeEnum("payment_type").notNull().default("CASH"),
  roundingDirection: roundingDirectionEnum("rounding_direction").notNull().default("DOWN"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  freightCharges: numeric("freight_charges", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  vatRefund: numeric("vat_refund", { precision: 12, scale: 2 }).notNull().default("0"),
  // roundedOff: numeric("rounded_off", { precision: 12, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull(),

 paymentStatus: paymentStatusEnum("payment_status").notNull().default("UNPAID"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  purchaseId: uuid("purchase_id")
    .notNull()
    .references(() => purchases.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  batchId: uuid("batch_id").references(() => batches.id, {
    onDelete: "set null",
  }), // filled in once the batch row is created from this line
  batchNumber: varchar("batch_number", { length: 100 }).notNull(),

  manufacturingDate: date("manufacturing_date"),
  expiryDate: date("expiry_date").notNull(),
  quantity: integer("quantity").notNull(),
  purchaseRate: numeric("purchase_rate", { precision: 12, scale: 2 }).notNull(),
  mrp: numeric("mrp", { precision: 12, scale: 2 }).notNull(),
  vatApplicable: boolean("vat_applicable").notNull().default(true), // relevant for Item-wise purcType
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
});

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [purchases.supplierId],
    references: [suppliers.id],
  }),
  items: many(purchaseItems),
}));

export const purchaseItemsRelations = relations(purchaseItems, ({ one }) => ({
  purchase: one(purchases, {
    fields: [purchaseItems.purchaseId],
    references: [purchases.id],
  }),
  product: one(products, {
    fields: [purchaseItems.productId],
    references: [products.id],
  }),
  batch: one(batches, {
    fields: [purchaseItems.batchId],
    references: [batches.id],
  }),
}));