import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import {
  drinks,
  orders,
  orderItems,
  paymentMethods,
  transactions,
  tabs,
  splitPayments,
  eventPackages
} from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { setupRealtimeProxy } from "./realtime-proxy";
import { spawn } from "child_process";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  console.log('Setting up routes and realtime proxy...');
  setupRealtimeProxy(httpServer);

  // Start Rasa server
  console.log('Starting Rasa server...');
  const rasaServer = spawn('python3', ['server/rasa_server.py'], {
    stdio: 'inherit'
  });

  rasaServer.on('error', (err) => {
    console.error('Failed to start Rasa server:', err);
  });

  // Set up proxy for Rasa server
  app.use('/webhooks/rest/webhook', createProxyMiddleware({
    target: 'http://localhost:5005',
    changeOrigin: true,
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.writeHead(500, {
        'Content-Type': 'application/json'
      });
      res.end(JSON.stringify({ error: 'Rasa server error' }));
    }
  }));

  // Get all drinks
  app.get("/api/drinks", async (_req, res) => {
    try {
      const allDrinks = await db.select().from(drinks);
      res.json(allDrinks);
    } catch (error) {
      console.error("Error fetching drinks:", error);
      res.status(500).json({ error: "Failed to fetch drinks" });
    }
  });

  // Create new order with improved validation and error handling
  app.post("/api/orders", async (req, res) => {
    try {
      const { items, total } = req.body;

      if (!items?.length || typeof total !== 'number' || total <= 0) {
        console.error("Invalid order data:", { items, total });
        return res.status(400).json({
          error: "Invalid order data. Must include items array and valid total."
        });
      }

      // Validate all items have required fields
      const invalidItems = items.filter((item: any) => {
        const isValid = item.drink?.id &&
          typeof item.quantity === 'number' &&
          item.quantity > 0;
        if (!isValid) {
          console.error("Invalid item in order:", item);
        }
        return !isValid;
      });

      if (invalidItems.length > 0) {
        return res.status(400).json({
          error: "Invalid items in order. Each item must have a valid drink ID and quantity.",
          invalidItems
        });
      }

      // Create order
      const [order] = await db
        .insert(orders)
        .values({
          total,
          items,
          status: 'pending',
          payment_status: 'pending',
          created_at: new Date()
        })
        .returning();

      console.log("Order created successfully:", order);

      // Create order items with validation
      const orderItemsData = items.map((item: any) => ({
        order_id: order.id,
        drink_id: item.drink.id,
        quantity: item.quantity,
        price: item.drink.price
      }));

      await db.insert(orderItems).values(orderItemsData);
      console.log("Order items created:", orderItemsData);

      // Update inventory and sales with proper error handling
      for (const item of items) {
        const [updatedDrink] = await db
          .update(drinks)
          .set({
            inventory: sql`${drinks.inventory} - ${item.quantity}`,
            sales: sql`COALESCE(${drinks.sales}, 0) + ${item.quantity}`
          })
          .where(eq(drinks.id, item.drink.id))
          .returning();

        if (!updatedDrink) {
          throw new Error(`Failed to update inventory for drink ${item.drink.id}`);
        }
        console.log("Updated drink inventory:", updatedDrink);
      }

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({
        error: "Failed to create order",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get order by ID with detailed error logging
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log("Fetching order:", id);

      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, parseInt(id)))
        .limit(1);

      if (!order.length) {
        console.error("Order not found:", id);
        return res.status(404).json({ error: "Order not found" });
      }

      console.log("Order found:", order[0]);
      res.json(order[0]);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Payment processing endpoint with error handling and transaction recording
  app.post("/api/payment/process", async (req, res) => {
    let transactionId: number | null = null;

    try {
      const { amount, orderId } = req.body;
      console.log("Processing payment:", { amount, orderId });

      if (typeof amount !== 'number' || amount <= 0) {
        console.error("Invalid payment amount:", amount);
        return res.status(400).json({
          error: "Invalid payment amount"
        });
      }

      if (!orderId || typeof orderId !== 'number') {
        console.error("Invalid order ID:", orderId);
        return res.status(400).json({
          error: "Invalid order ID"
        });
      }

      // Create transaction record
      const [transaction] = await db.insert(transactions)
        .values({
          order_id: orderId,
          amount,
          status: 'processing',
          attempts: 1,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning();
      transactionId = transaction.id;
      console.log("Transaction created:", transactionId);

      // In demo mode, payment always succeeds
      // Update transaction record
      await db.update(transactions)
        .set({
          status: 'completed',
          updated_at: new Date(),
          metadata: {
            completed_at: new Date().toISOString(),
            success: true
          }
        })
        .where(eq(transactions.id, transactionId));

      // Update order status
      await db
        .update(orders)
        .set({
          status: 'completed',
          payment_status: 'completed',
          completed_at: new Date()
        })
        .where(eq(orders.id, orderId));

      console.log("Payment successful:", {
        orderId,
        transactionId,
        amount: (amount / 100).toFixed(2)
      });

      res.json({
        success: true,
        message: `Payment of $${(amount / 100).toFixed(2)} processed successfully`,
        orderId,
        transactionId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Payment processing error:", error);

      if (transactionId) {
        await db.update(transactions)
          .set({
            status: 'failed',
            last_error: error instanceof Error ? error.message : 'Payment processing failed',
            updated_at: new Date()
          })
          .where(eq(transactions.id, transactionId));
      }

      res.status(500).json({
        error: "Internal server error during payment processing",
        transactionId
      });
    }
  });

  // Get OpenAI API configuration
  app.get("/api/config", (_req, res) => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;

      // Detailed logging for debugging
      console.log({
        hasKey: !!openaiKey,
        keyLength: openaiKey?.length || 0,
        timestamp: new Date().toISOString()
      });

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