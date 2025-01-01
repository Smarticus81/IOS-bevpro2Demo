import { pgTable, text, serial, integer, timestamp, boolean, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const drinks = pgTable("drinks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  price: integer("price").notNull(),
  inventory: integer("inventory").notNull(),
  image: text("image").notNull(),
  sales: integer("sales").default(0),
});

// Pour size definitions (e.g., single, double, half)
export const pourSizes = pgTable("pour_sizes", {
  id: serial("id").primaryKey(),
  name: text("name", { length: 50 }).notNull(),
  volume_ml: decimal("volume_ml", { precision: 10, scale: 2 }).notNull(),
  volume_oz: decimal("volume_oz", { precision: 10, scale: 2 }).notNull(),
  is_default: boolean("is_default").default(false),
  created_at: timestamp("created_at").defaultNow(),
});

// Tax categories for different types of alcohol
export const taxCategories = pgTable("tax_categories", {
  id: serial("id").primaryKey(),
  name: text("name", { length: 100 }).notNull(),
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
});

// Pour inventory tracking for individual bottles
export const pourInventory = pgTable("pour_inventory", {
  id: serial("id").primaryKey(),
  drink_id: integer("drink_id").notNull().references(() => drinks.id),
  bottle_id: text("bottle_id", { length: 50 }).notNull(),
  initial_volume_ml: decimal("initial_volume_ml", { precision: 10, scale: 2 }).notNull(),
  remaining_volume_ml: decimal("remaining_volume_ml", { precision: 10, scale: 2 }).notNull(),
  opened_at: timestamp("opened_at").defaultNow(),
  tax_category_id: integer("tax_category_id").references(() => taxCategories.id),
  created_at: timestamp("created_at").defaultNow(),
  last_pour_at: timestamp("last_pour_at"),
  is_active: boolean("is_active").default(true),
});

// Track individual pours for tax and inventory
export const pourTransactions = pgTable("pour_transactions", {
  id: serial("id").primaryKey(),
  pour_inventory_id: integer("pour_inventory_id").references(() => pourInventory.id),
  pour_size_id: integer("pour_size_id").references(() => pourSizes.id),
  volume_ml: decimal("volume_ml", { precision: 10, scale: 2 }).notNull(),
  transaction_time: timestamp("transaction_time").defaultNow(),
  order_id: integer("order_id").references(() => orders.id),
  tax_amount: decimal("tax_amount", { precision: 10, scale: 2 }),
  staff_id: integer("staff_id"),
  notes: text("notes"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"),
  total: integer("total").notNull(),
  items: jsonb("items").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  completed_at: timestamp("completed_at"),
  payment_status: text("payment_status").default("pending"),
  tab_id: integer("tab_id").references(() => tabs.id),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull().references(() => orders.id),
  drink_id: integer("drink_id").notNull().references(() => drinks.id),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  display_name: text("display_name").notNull(),
  is_active: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull().references(() => orders.id),
  payment_method_id: integer("payment_method_id").references(() => paymentMethods.id),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  provider_transaction_id: text("provider_transaction_id"),
  attempts: integer("attempts").default(0),
  last_error: text("last_error"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const tabs = pgTable("tabs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("open"),
  pre_auth_amount: integer("pre_auth_amount"),
  current_amount: integer("current_amount").default(0),
  payment_method_id: integer("payment_method_id").references(() => paymentMethods.id),
  created_at: timestamp("created_at").defaultNow(),
  closed_at: timestamp("closed_at"),
  metadata: jsonb("metadata"),
});

export const splitPayments = pgTable("split_payments", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull().references(() => orders.id),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  payment_method_id: integer("payment_method_id").references(() => paymentMethods.id),
  payer_name: text("payer_name"),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
});

export const eventPackages = pgTable("event_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price_per_person: integer("price_per_person").notNull(),
  minimum_guests: integer("minimum_guests").default(1),
  duration_hours: integer("duration_hours"),
  is_active: boolean("is_active").default(true),
  included_items: jsonb("included_items"),
  created_at: timestamp("created_at").defaultNow(),
});

export const transactionRelations = relations(transactions, ({ one }) => ({
  order: one(orders, {
    fields: [transactions.order_id],
    references: [orders.id],
  }),
  paymentMethod: one(paymentMethods, {
    fields: [transactions.payment_method_id],
    references: [paymentMethods.id],
  }),
}));

export const orderRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  tab: one(tabs, {
    fields: [orders.tab_id],
    references: [tabs.id],
  }),
  transactions: many(transactions),
  splitPayments: many(splitPayments),
}));

export const drinkRelations = relations(drinks, ({ many }) => ({
  orderItems: many(orderItems),
}));

export const tabRelations = relations(tabs, ({ many, one }) => ({
  orders: many(orders),
  paymentMethod: one(paymentMethods, {
    fields: [tabs.payment_method_id],
    references: [paymentMethods.id],
  }),
}));

export const pourInventoryRelations = relations(pourInventory, ({ one, many }) => ({
  drink: one(drinks, {
    fields: [pourInventory.drink_id],
    references: [drinks.id],
  }),
  taxCategory: one(taxCategories, {
    fields: [pourInventory.tax_category_id],
    references: [taxCategories.id],
  }),
  pourTransactions: many(pourTransactions),
}));

export const pourTransactionRelations = relations(pourTransactions, ({ one }) => ({
  pourInventory: one(pourInventory, {
    fields: [pourTransactions.pour_inventory_id],
    references: [pourInventory.id],
  }),
  pourSize: one(pourSizes, {
    fields: [pourTransactions.pour_size_id],
    references: [pourSizes.id],
  }),
  order: one(orders, {
    fields: [pourTransactions.order_id],
    references: [orders.id],
  }),
}));

// Types
export type Drink = typeof drinks.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Tab = typeof tabs.$inferSelect;
export type SplitPayment = typeof splitPayments.$inferSelect;
export type EventPackage = typeof eventPackages.$inferSelect;
export type PourSize = typeof pourSizes.$inferSelect;
export type TaxCategory = typeof taxCategories.$inferSelect;
export type PourInventory = typeof pourInventory.$inferSelect;
export type PourTransaction = typeof pourTransactions.$inferSelect;

// Schemas
export const insertDrinkSchema = createInsertSchema(drinks);
export const selectDrinkSchema = createSelectSchema(drinks);
export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
export const insertPaymentMethodSchema = createInsertSchema(paymentMethods);
export const selectPaymentMethodSchema = createSelectSchema(paymentMethods);
export const insertTransactionSchema = createInsertSchema(transactions);
export const selectTransactionSchema = createSelectSchema(transactions);
export const insertTabSchema = createInsertSchema(tabs);
export const selectTabSchema = createSelectSchema(tabs);
export const insertSplitPaymentSchema = createInsertSchema(splitPayments);
export const selectSplitPaymentSchema = createSelectSchema(splitPayments);
export const insertEventPackageSchema = createInsertSchema(eventPackages);
export const selectEventPackageSchema = createSelectSchema(eventPackages);
export const insertPourSizeSchema = createInsertSchema(pourSizes);
export const selectPourSizeSchema = createSelectSchema(pourSizes);
export const insertTaxCategorySchema = createInsertSchema(taxCategories);
export const selectTaxCategorySchema = createSelectSchema(taxCategories);
export const insertPourInventorySchema = createInsertSchema(pourInventory);
export const selectPourInventorySchema = createSelectSchema(pourInventory);
export const insertPourTransactionSchema = createInsertSchema(pourTransactions);
export const selectPourTransactionSchema = createSelectSchema(pourTransactions);