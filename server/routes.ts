import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import compression from 'compression';
import {
  drinks,
  orders,
  orderItems,
  paymentMethods,
  transactions,
  tabs,
  splitPayments,
  taxCategories // Added import for taxCategories table
} from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { setupRealtimeProxy, broadcastUpdate } from "./realtime-proxy";
import { PaymentService } from "./services/payments";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  app.use(compression());
  const wsServer = setupRealtimeProxy(httpServer);

  // Create new order with real-time inventory updates
  app.post("/api/orders", async (req, res) => {
    try {
      const { items, total: subtotal } = req.body;

      if (!Array.isArray(items) || !items.length || typeof subtotal !== 'number' || subtotal <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid order data. Must include items array and valid total."
        });
      }

      // Validate items
      const invalidItems = items.filter((item: any) => {
        return !item.drink_id || typeof item.quantity !== 'number' || item.quantity <= 0;
      });

      if (invalidItems.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid items in order. Each item must have a valid drink ID and quantity."
        });
      }

      // Fetch drinks with their tax categories to calculate tax
      const drinksWithTax = await Promise.all(
        items.map(async (item: any) => {
          const [drink] = await db
            .select({
              id: drinks.id,
              name: drinks.name,
              tax_category_id: drinks.tax_category_id,
              inventory: drinks.inventory
            })
            .from(drinks)
            .leftJoin(taxCategories, eq(drinks.tax_category_id, taxCategories.id))
            .where(eq(drinks.id, item.drink_id));

          return {
            ...item,
            drink,
            available: drink && drink.inventory >= item.quantity
          };
        })
      );

      // Check inventory
      const unavailableItems = drinksWithTax.filter(item => !item.available);
      if (unavailableItems.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Some items are out of stock",
          items: unavailableItems
        });
      }

      // Calculate tax amounts for each item and total tax
      const itemsWithTax = await Promise.all(
        drinksWithTax.map(async (item) => {
          const [taxCategory] = item.drink.tax_category_id 
            ? await db
                .select({ rate: taxCategories.rate })
                .from(taxCategories)
                .where(eq(taxCategories.id, item.drink.tax_category_id))
            : [{ rate: 0 }];

          const itemTaxAmount = Math.round(item.price * item.quantity * Number(taxCategory.rate));

          return {
            ...item,
            tax_amount: itemTaxAmount
          };
        })
      );

      const totalTaxAmount = itemsWithTax.reduce((sum, item) => sum + item.tax_amount, 0);
      const orderTotal = subtotal + totalTaxAmount;

      // Create order
      const [order] = await db.insert(orders).values({
        subtotal,
        tax_amount: totalTaxAmount,
        total: orderTotal,
        status: 'pending',
        payment_status: 'pending',
        items: itemsWithTax.map(item => ({
          drink_id: item.drink_id,
          quantity: item.quantity,
          price: item.price,
          tax_amount: item.tax_amount
        })),
        created_at: new Date()
      }).returning();

      // Create order items with tax information
      const orderItemsToInsert = itemsWithTax.map(item => ({
        order_id: order.id,
        drink_id: item.drink_id,
        quantity: item.quantity,
        price: item.price,
        tax_amount: item.tax_amount,
        drink_name: item.drink.name
      }));

      await db.insert(orderItems).values(orderItemsToInsert);

      try {
        // Process payment with the total amount including tax
        const result = await PaymentService.processPayment(orderTotal, order.id);

        if (!result.success) {
          await db.update(orders)
            .set({ 
              status: 'failed',
              payment_status: 'failed'
            })
            .where(eq(orders.id, order.id));

          broadcastUpdate(wsServer, 'order_failed', {
            orderId: order.id,
            error: result.message || "Payment processing failed"
          });

          return res.status(400).json({
            success: false,
            error: "Payment processing failed",
            message: result.message,
            orderId: order.id
          });
        }


        const inventoryUpdates = [];
        for (const item of itemsWithTax) {
          const [updatedDrink] = await db.update(drinks)
            .set({
              inventory: sql`${drinks.inventory} - ${item.quantity}`,
              sales: sql`COALESCE(${drinks.sales}, 0) + ${item.quantity}`
            })
            .where(eq(drinks.id, item.drink_id))
            .returning();

          if (updatedDrink) {
            inventoryUpdates.push({
              id: updatedDrink.id,
              inventory: updatedDrink.inventory,
              sales: updatedDrink.sales
            });
          }
        }

        broadcastUpdate(wsServer, 'order_completed', {
          orderId: order.id,
          updates: inventoryUpdates
        });

        return res.json({
          success: true,
          order: result.order,
          transaction: result.transaction,
          inventoryUpdates,
          message: "Order completed successfully"
        });

      } catch (paymentError) {
        await db.update(orders)
          .set({ 
            status: 'failed',
            payment_status: 'failed'
          })
          .where(eq(orders.id, order.id));

        broadcastUpdate(wsServer, 'order_failed', {
          orderId: order.id,
          error: paymentError instanceof Error ? paymentError.message : "Payment processing failed"
        });

        return res.status(400).json({
          success: false,
          error: "Payment processing failed",
          details: paymentError instanceof Error ? paymentError.message : "Unknown error",
          orderId: order.id
        });
      }
    } catch (error) {
      console.error("Error creating order:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create order",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get drinks endpoint
  app.get("/api/drinks", async (_req, res) => {
    try {
      const allDrinks = await db
        .select({
          id: drinks.id,
          name: drinks.name,
          category: drinks.category,
          subcategory: drinks.subcategory,
          price: drinks.price,
          inventory: drinks.inventory,
          image: drinks.image,
          sales: drinks.sales
        })
        .from(drinks)
        .orderBy(drinks.category);

      const transformedDrinks = allDrinks.map(drink => ({
        ...drink,
        price: drink.price,
        inventory: drink.inventory ?? 0,
        sales: drink.sales ?? 0
      }));

      res.json({ drinks: transformedDrinks });
    } catch (error) {
      console.error("Error fetching drinks:", error);
      res.status(500).json({ error: "Failed to fetch drinks" });
    }
  });

  // Process payment and record transaction
  app.post("/api/payment/process", async (req, res) => {
    try {
      const { amount, orderId } = req.body;

      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }

      if (!orderId || typeof orderId !== 'number') {
        return res.status(400).json({ error: "Invalid order ID" });
      }

      const result = await PaymentService.processPayment(amount, orderId);
      res.json(result);
    } catch (error) {
      console.error("Payment processing error:", error);
      res.status(500).json({
        error: "Failed to process payment",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  // Get transaction history
  app.get("/api/transactions", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await PaymentService.getTransactionHistory(page, limit);
      res.json(result);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Dashboard Statistics with pagination and caching
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      const [salesStats] = await db.select({
        totalSales: sql`SUM(transactions.amount)`,
        totalOrders: sql`COUNT(orders.id)`
      })
        .from(transactions)
        .leftJoin(orders, eq(transactions.order_id, orders.id))
        .where(eq(transactions.status, 'completed'));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [todayStats] = await db.select({
        todaySales: sql`SUM(transactions.amount)`
      })
        .from(transactions)
        .where(sql`${transactions.created_at}::date = ${todayStart.toISOString().split('T')[0]} AND ${transactions.status} = 'completed'`);

      const activeOrders = await db.select({
        count: sql`COUNT(*)`
      })
        .from(orders)
        .where(eq(orders.status, 'pending'));

      const categorySales = await db.select({
        category: drinks.category,
        totalSales: sql`SUM(orderItems.quantity)`
      })
        .from(orderItems)
        .leftJoin(drinks, eq(orderItems.drink_id, drinks.id))
        .groupBy(drinks.category)
        .limit(limit)
        .offset(offset);

      const popularDrinks = await db.select({
        id: drinks.id,
        name: drinks.name,
        sales: sql`SUM(orderItems.quantity)`
      })
        .from(orderItems)
        .leftJoin(drinks, eq(orderItems.drink_id, drinks.id))
        .groupBy(drinks.id, drinks.name)
        .orderBy(sql`sum(${orderItems.quantity}) DESC`)
        .limit(limit);

      res.json({
        totalSales: salesStats?.totalSales || 0,
        todaySales: todayStats?.todaySales || 0,
        activeOrders: activeOrders[0]?.count || 0,
        categorySales,
        popularDrinks,
        totalOrders: salesStats?.totalOrders || 0,
        pagination: {
          currentPage: page,
          limit,
          hasMore: categorySales.length === limit
        }
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // Get drinks with caching
  app.get("/api/drinks2", async (_req, res) => {
    try {
      const allDrinks = await db
        .select()
        .from(drinks)
        .orderBy(drinks.category);

      res.json({
        drinks: allDrinks
      });
    } catch (error) {
      console.error("Error fetching drinks:", error);
      res.status(500).json({ error: "Failed to fetch drinks" });
    }
  });

  // Add inventory check endpoint
  app.get("/api/drinks/:id/inventory", async (req, res) => {
    try {
      const drinkId = parseInt(req.params.id);
      const [drink] = await db
        .select({
          id: drinks.id,
          name: drinks.name,
          inventory: drinks.inventory,
          sales: drinks.sales
        })
        .from(drinks)
        .where(eq(drinks.id, drinkId))
        .limit(1);

      if (!drink) {
        return res.status(404).json({ error: "Drink not found" });
      }

      res.json(drink);
    } catch (error) {
      console.error("Error checking inventory:", error);
      res.status(500).json({ error: "Failed to check inventory" });
    }
  });

  // Bulk inventory check endpoint
  app.post("/api/drinks/inventory/check", async (req, res) => {
    try {
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items must be an array" });
      }

      const inventoryChecks = await Promise.all(
        items.map(async (item: any) => {
          const [drink] = await db
            .select({
              id: drinks.id,
              name: drinks.name,
              inventory: drinks.inventory
            })
            .from(drinks)
            .where(eq(drinks.id, item.drink_id))
            .limit(1);

          return {
            drink_id: item.drink_id,
            requested_quantity: item.quantity,
            available_quantity: drink?.inventory || 0,
            is_available: drink && drink.inventory >= item.quantity
          };
        })
      );

      res.json({
        inventory_status: inventoryChecks,
        all_available: inventoryChecks.every(check => check.is_available)
      });
    } catch (error) {
      console.error("Error checking bulk inventory:", error);
      res.status(500).json({ error: "Failed to check inventory" });
    }
  });

  // Get order by ID with detailed error logging
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, parseInt(id)))
        .limit(1);

      if (!order.length) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json(order[0]);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });


  // Get OpenAI API configuration
  app.get("/api/config", (_req, res) => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!openaiKey) {
        throw new Error("OpenAI API key not found in environment");
      }

      if (!openaiKey.startsWith('sk-')) {
        throw new Error("Invalid OpenAI API key format");
      }

      res.json({ openaiKey });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("OpenAI config error:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        error: "Configuration error",
        message: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });


  // Payment Methods endpoints
  app.get("/api/payment-methods", async (_req, res) => {
    try {
      const methods = await db.select().from(paymentMethods);
      res.json(methods);
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  app.post("/api/payment-methods", async (req, res) => {
    try {
      const method = await db.insert(paymentMethods).values(req.body).returning();
      res.json(method[0]);
    } catch (error) {
      console.error("Error creating payment method:", error);
      res.status(500).json({ error: "Failed to create payment method" });
    }
  });

  // Tabs endpoints
  app.post("/api/tabs", async (req, res) => {
    try {
      const [tab] = await db.insert(tabs).values(req.body).returning();
      res.json(tab);
    } catch (error) {
      console.error("Error creating tab:", error);
      res.status(500).json({ error: "Failed to create tab" });
    }
  });

  app.get("/api/tabs/:id", async (req, res) => {
    try {
      const tab = await db
        .select()
        .from(tabs)
        .where(eq(tabs.id, parseInt(req.params.id)))
        .limit(1);

      if (!tab.length) {
        return res.status(404).json({ error: "Tab not found" });
      }

      res.json(tab[0]);
    } catch (error) {
      console.error("Error fetching tab:", error);
      res.status(500).json({ error: "Failed to fetch tab" });
    }
  });

  app.patch("/api/tabs/:id/close", async (req, res) => {
    try {
      const [tab] = await db
        .update(tabs)
        .set({
          status: 'closed',
          closed_at: new Date(),
        })
        .where(eq(tabs.id, parseInt(req.params.id)))
        .returning();

      res.json(tab);
    } catch (error) {
      console.error("Error closing tab:", error);
      res.status(500).json({ error: "Failed to close tab" });
    }
  });

  // Split payments endpoints
  app.post("/api/split-payments", async (req, res) => {
    try {
      const [splitPayment] = await db
        .insert(splitPayments)
        .values(req.body)
        .returning();
      res.json(splitPayment);
    } catch (error) {
      console.error("Error creating split payment:", error);
      res.status(500).json({ error: "Failed to create split payment" });
    }
  });

  app.get("/api/split-payments/order/:orderId", async (req, res) => {
    try {
      const payments = await db
        .select()
        .from(splitPayments)
        .where(eq(splitPayments.order_id, parseInt(req.params.orderId)));
      res.json(payments);
    } catch (error) {
      console.error("Error fetching split payments:", error);
      res.status(500).json({ error: "Failed to fetch split payments" });
    }
  });

  return httpServer;
}