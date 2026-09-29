import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  boolean,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { parties } from "./parties";
import { batches } from "./batches";
import { sales, saleItems } from "./sales";
import { purchaseReturnStatusEnum, returnResolutionTypeEnum, saleReturnStatusEnum } from "./enums";

export const purchaseReturns = pgTable("purchase_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  partyId: uuid("party_id")
    .notNull()
    .references(() => parties.id, { onDelete: "restrict" }),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  resolutionType: returnResolutionTypeEnum("resolution_type"), // null until completed
  resolutionAmount: numeric("resolution_amount", { precision: 12, scale: 2 }), // set only for MONEY
  resolvedBatchId: uuid("resolved_batch_id").references(() => batches.id, {
    onDelete: "set null",
  }),
  reason: varchar("reason", { length: 255 }), // e.g. "expired", "damaged"
  status: purchaseReturnStatusEnum("status").notNull().default("PENDING"),
  returnDate: date("return_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saleReturns = pgTable("sale_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "restrict" }),
  saleItemId: uuid("sale_item_id")
    .notNull()
    .references(() => saleItems.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  reason: varchar("reason", { length: 255 }),
  restocked: boolean("restocked").notNull().default(false), // whether it was added back to batch stock
  status: saleReturnStatusEnum("status").notNull().default("PENDING"),
  returnDate: date("return_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
