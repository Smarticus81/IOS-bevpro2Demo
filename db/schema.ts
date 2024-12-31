import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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

// Payment Methods table for storing different payment types
export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // credit_card, mobile_wallet, qr_code
  provider: text("provider").notNull(), // stripe, apple_pay, google_pay
  display_name: text("display_name").notNull(),
  is_active: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
});

// Transactions table for payment tracking
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

// Tabs table for managing open tabs
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

// Split Payments table for managing shared bills
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

// Event Packages table for special events and bulk orders
export const eventPackages = pgTable("event_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price_per_person: integer("price_per_person").notNull(),
  minimum_guests: integer("minimum_guests").default(1),
  duration_hours: integer("duration_hours"), // Changed from real to integer
  is_active: boolean("is_active").default(true),
  included_items: jsonb("included_items"),
  created_at: timestamp("created_at").defaultNow(),
});

// Relations
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

// Types
export type Drink = typeof drinks.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Tab = typeof tabs.$inferSelect;
export type SplitPayment = typeof splitPayments.$inferSelect;
export type EventPackage = typeof eventPackages.$inferSelect;

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