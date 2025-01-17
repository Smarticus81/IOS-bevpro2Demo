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
  eventPackages,
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
      const { items, total } = req.body;

      if (!Array.isArray(items) || !items.length || typeof total !== 'number' || total <= 0) {
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

      // Check inventory availability
      const inventoryChecks = await Promise.all(
        items.map(async (item: any) => {
          const [drink] = await db
            .select({ inventory: drinks.inventory })
            .from(drinks)
            .where(eq(drinks.id, item.drink_id))
            .limit(1);

          return {
            drink_id: item.drink_id,
            available: drink && drink.inventory >= item.quantity
          };
        })
      );

      const unavailableItems = inventoryChecks.filter(check => !check.available);
      if (unavailableItems.length > 0) {
        return res.status(400).json({
          success: false,
          error: "Some items are out of stock",
          items: unavailableItems
        });
      }

      // Create order
      const [order] = await db.insert(orders).values({
        total,
        items,
        status: 'pending',
        payment_status: 'pending',
        created_at: new Date()
      }).returning();

      // Create order items
      await db.insert(orderItems).values(
        items.map((item: any) => ({
          order_id: order.id,
          drink_id: item.drink_id,
          quantity: item.quantity,
          price: item.price
        }))
      );

      try {
        // Process payment
        const result = await PaymentService.processPayment(total, order.id);

        if (!result.success) {
          // Update order status as failed
          await db.update(orders)
            .set({ 
              status: 'failed',
              payment_status: 'failed'
            })
            .where(eq(orders.id, order.id));

          // Broadcast failure
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

        // If payment successful, update inventory
        const inventoryUpdates = [];
        for (const item of items) {
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

        // Broadcast success
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
        // Update order status as failed
        await db.update(orders)
          .set({ 
            status: 'failed',
            payment_status: 'failed'
          })
          .where(eq(orders.id, order.id));

        // Broadcast failure
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

      // Transform prices to match frontend expectations 
      const transformedDrinks = allDrinks.map(drink => ({
        ...drink,
        price: drink.price, // Keep as is since frontend handles formatting
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
      // Get pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Get total sales and today's sales
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

      // Get active orders with pagination
      const activeOrders = await db.select({
        count: sql`COUNT(*)`
      })
        .from(orders)
        .where(eq(orders.status, 'pending'));

      // Get category sales with pagination
      const categorySales = await db.select({
        category: drinks.category,
        totalSales: sql`SUM(orderItems.quantity)`
      })
        .from(orderItems)
        .leftJoin(drinks, eq(orderItems.drink_id, drinks.id))
        .groupBy(drinks.category)
        .limit(limit)
        .offset(offset);

      // Get popular drinks with pagination
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
      // Get all drinks without pagination
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

  // Event packages endpoints
  app.get("/api/event-packages", async (_req, res) => {
    try {
      const packages = await db.select().from(eventPackages);
      res.json(packages);
    } catch (error) {
      console.error("Error fetching event packages:", error);
      res.status(500).json({ error: "Failed to fetch event packages" });
    }
  });

  app.post("/api/event-packages", async (req, res) => {
    try {
      const [eventPackage] = await db
        .insert(eventPackages)
        .values(req.body)
        .returning();
      res.json(eventPackage);
    } catch (error) {
      console.error("Error creating event package:", error);
      res.status(500).json({ error: "Failed to create event package" });
    }
  });

  return httpServer;
}