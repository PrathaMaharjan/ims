import { pgTable, uuid, varchar, text, boolean, numeric, timestamp, uniqueIndex, index,integer } from "drizzle-orm/pg-core";
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
  aliasName: varchar("alias_name", { length: 255 }), 
  manufacturer: varchar("manufacturer", { length: 255 }), 
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  hsnCode: varchar("hsn_code", { length: 20 }), 
  unit: varchar("unit", { length: 30 }).notNull().default("Pcs"), 
  alternativeUnit: varchar("alternative_unit", { length: 30 }), 
   stockQuantity: integer("stock_quantity").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold"), 
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"), 
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  nameIdx: index("products_name_idx").on(table.name),
  aliasNameIdx: index("products_alias_name_idx").on(table.aliasName),
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