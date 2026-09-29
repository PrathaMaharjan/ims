import { pgTable, uuid, integer, numeric, varchar, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { batches } from "./batches";
import { products } from "./products";
import { expenses } from "./expenses";
import { users } from "./users";

export const stockWriteOffs = pgTable("stock_write_offs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "restrict" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  totalLoss: numeric("total_loss", { precision: 12, scale: 2 }).notNull(),
  reason: varchar("reason", { length: 255 }),
  expenseId: uuid("expense_id").references(() => expenses.id, { onDelete: "set null" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});