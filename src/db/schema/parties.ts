import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { batches } from "./batches";
import { purchases } from "./purchases";
import { sales } from "./sales";
import { payments } from "./payments";
import { partyTypeEnum } from "./enums";

// One table for everyone the business trades with. A party we buy from is a
// "SUPPLIER", one we sell to is a "CUSTOMER", and one we do both with is "BOTH".
export const parties = pgTable("parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  partyType: partyTypeEnum("party_type").notNull().default("BOTH"),
  contactPerson: varchar("contact_person", { length: 255 }), // named individual at the party
  panVatNumber: varchar("pan_vat_number", { length: 50 }),
  address: text("address"),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 255 }),
  paymentTerms: varchar("payment_terms", { length: 255 }),
  status: boolean("status").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const partiesRelations = relations(parties, ({ many }) => ({
  batches: many(batches),
  purchases: many(purchases),
  sales: many(sales),
  payments: many(payments),
}));
