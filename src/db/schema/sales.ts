import { pgTable, uuid, integer, numeric, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { customers } from "./customers";
import { products } from "./products";
import { batches } from "./batches";
import { users } from "./users";
import { paymentStatusEnum } from "./enums";

export const sales = pgTable("sales", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  invoiceNumber: integer("invoice_number").notNull(), // sequential per org, no gaps
  customerId: uuid("customer_id").references(() => customers.id, {
    onDelete: "set null",
  }),
  saleDate: timestamp("sale_date").notNull().defaultNow(),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("UNPAID"),

  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  roundedOff: numeric("rounded_off", { precision: 12, scale: 2 }).notNull().default("0"),
  grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull(),

  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  orgInvoiceNumberIdx: uniqueIndex("sales_org_invoice_number_idx").on(
    table.organizationId,
    table.invoiceNumber
  ),
}));

export const saleItems = pgTable("sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "restrict" }), 
  quantity: integer("quantity").notNull(),
  salePrice: numeric("sale_price", { precision: 12, scale: 2 }).notNull(), 
  vatAmount: numeric("vat_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
});

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  items: many(saleItems),
}));

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  batch: one(batches, {
    fields: [saleItems.batchId],
    references: [batches.id],
  }),
}));