import { pgTable, uuid, varchar, text, boolean, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { categories } from "./categories";
import { batches } from "./batches";


// Product = the definition of a medicine. Stock lives on batches, not here.
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  genericName: varchar("generic_name", { length: 255 }),
   aliasName: varchar("alias_name", { length: 255 }), 
  brandName: varchar("brand_name", { length: 255 }),
  strength: varchar("strength", { length: 50 }), // e.g. "500mg"
  dosageForm: varchar("dosage_form", { length: 50 }), // Tablet, Capsule, Syrup...
  manufacturer: varchar("manufacturer", { length: 255 }),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  productCode: varchar("product_code", { length: 100 }),
  barcode: varchar("barcode", { length: 100 }),
  prescriptionRequired: boolean("prescription_required")
    .notNull()
    .default(false), // kept as a flag only — no prescription workflow built
  vatApplicable: boolean("vat_applicable").notNull().default(true),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 })
    .notNull()
    .default("13.00"), // Nepal standard VAT, editable per product
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  orgBarcodeIdx: uniqueIndex("products_org_barcode_idx").on(
    table.organizationId,
    table.barcode
  ),
  nameIdx: index("products_name_idx").on(table.name),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [products.organizationId],
    references: [organizations.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  batches: many(batches),
}));