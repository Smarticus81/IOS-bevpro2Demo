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
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  order_id: integer("order_id").notNull().references(() => orders.id),
  drink_id: integer("drink_id").notNull().references(() => drinks.id),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(),
});

export const orderRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const drinkRelations = relations(drinks, ({ many }) => ({
  orderItems: many(orderItems),
}));

export type Drink = typeof drinks.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;

export const insertDrinkSchema = createInsertSchema(drinks);
export const selectDrinkSchema = createSelectSchema(drinks);
export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
