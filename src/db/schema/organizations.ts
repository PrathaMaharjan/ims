import { pgTable, uuid, varchar, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sales } from "./sales";
import { purchases } from "./purchases";
import { customers } from "./customers";
import { batches } from "./batches";
import { suppliers } from "./suppliers";
import { products } from "./products";
import { users } from "./users";


// Single-tenant-per-account assumption: no roles table, one row = one account.
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  panVatNumber: varchar("pan_vat_number", { length: 50 }),
  vatRegistered: boolean("vat_registered").notNull().default(false),
  address: text("address"),
  logoUrl: text("logo_url"), 
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  // sequential invoice numbering, per org, no gaps
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  products: many(products),
  suppliers: many(suppliers),
  batches: many(batches),
  customers: many(customers),
  purchases: many(purchases),
  sales: many(sales),
}));