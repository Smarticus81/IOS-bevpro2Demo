import { pgTable, text, serial, integer, timestamp, boolean, jsonb, real, uuid } from "drizzle-orm/pg-core";
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
  // New fields for enhanced recommendations
  popular_pairings: jsonb("popular_pairings").$type<number[]>(),
  peak_hours: jsonb("peak_hours").$type<string[]>(),
  taste_profile: jsonb("taste_profile").$type<{
    sweet: number;
    bitter: number;
    strong: number;
    refreshing: number;
  }>(),
  dietary_info: jsonb("dietary_info").$type<string[]>(),
  seasonal_availability: jsonb("seasonal_availability").$type<string[]>(),
  last_recommended: timestamp("last_recommended"),
  recommendation_score: real("recommendation_score").default(0),
});

// Customer preferences for personalized recommendations
export const customerPreferences = pgTable("customer_preferences", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  favorite_categories: jsonb("favorite_categories").$type<string[]>(),
  taste_preferences: jsonb("taste_preferences").$type<{
    sweet: number;
    bitter: number;
    strong: number;
    refreshing: number;
  }>(),
  dietary_restrictions: jsonb("dietary_restrictions").$type<string[]>(),
  last_orders: jsonb("last_orders").$type<number[]>(),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

// Order history for recommendation analytics
export const orderHistory = pgTable("order_history", {
  id: serial("id").primaryKey(),
  session_id: text("session_id").notNull(),
  items: jsonb("items").notNull(),
  order_time: timestamp("order_time").defaultNow(),
  total: integer("total").notNull(),
  context: jsonb("context").$type<{
    time_of_day: string;
    day_of_week: string;
    weather: string;
    special_occasion: boolean;
  }>(),
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
  session_id: text("session_id"), // Added for tracking customer sessions
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
  metadata: jsonb("metadata"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at"),
});

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
  duration_hours: real("duration_hours"),
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

export const customerPreferencesRelations = relations(customerPreferences, ({ many }) => ({
  orderHistory: many(orderHistory),
}));

export const orderHistoryRelations = relations(orderHistory, ({ many }) => ({
  drinks: many(drinks),
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
export type CustomerPreference = typeof customerPreferences.$inferSelect;
export type OrderHistory = typeof orderHistory.$inferSelect;

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
export const insertCustomerPreferenceSchema = createInsertSchema(customerPreferences);
export const selectCustomerPreferenceSchema = createSelectSchema(customerPreferences);
export const insertOrderHistorySchema = createInsertSchema(orderHistory);
export const selectOrderHistorySchema = createSelectSchema(orderHistory);