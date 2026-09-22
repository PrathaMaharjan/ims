import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { sales } from "./sales";
// import { sales } from "./sales";

// Lightweight — no medical/prescription data.
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  sales: many(sales),
}));