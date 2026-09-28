import { pgTable, uuid, varchar, numeric, date, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { parties } from "./parties";
import { purchases } from "./purchases";
import { sales } from "./sales";
import { users } from "./users";
import { paymentDirectionEnum } from "./enums";

// One table for both directions: money paid to a party (against a purchase)
// or received from a party (against a sale). Exactly one of purchaseId or
// saleId should be set, matching `direction` — enforce this in application code.
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  direction: paymentDirectionEnum("direction").notNull(),

  partyId: uuid("party_id").references(() => parties.id, {
    onDelete: "set null",
  }),

  purchaseId: uuid("purchase_id").references(() => purchases.id, {
    onDelete: "set null",
  }),

  saleId: uuid("sale_id").references(() => sales.id, {
    onDelete: "set null",
  }),

  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  method: varchar("method", { length: 50 }), // cash, cheque, eSewa, Khalti, bank transfer...
  referenceNumber: varchar("reference_number", { length: 100 }), // cheque no., transaction ID
  notes: text("notes"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentsRelations = relations(payments, ({ one }) => ({
  party: one(parties, {
    fields: [payments.partyId],
    references: [parties.id],
  }),
  purchase: one(purchases, {
    fields: [payments.purchaseId],
    references: [purchases.id],
  }),
  sale: one(sales, {
    fields: [payments.saleId],
    references: [sales.id],
  }),
}));