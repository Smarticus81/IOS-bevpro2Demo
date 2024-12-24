import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { 
  drinks, 
  orders, 
  orderItems,
  tabs,
  splitPayments,
  eventPackages 
} from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { setupRealtimeProxy } from "./realtime-proxy";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  console.log('Setting up routes and realtime proxy...');
  setupRealtimeProxy(httpServer);

  // Payment Processing
  app.post("/api/payments/process", async (req, res) => {
    try {
      const { amount, orderId } = req.body;

      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate 90% success rate
      const success = Math.random() > 0.1;

      if (success) {
        // If we have an order ID, update its status
        if (orderId) {
          await db
            .update(orders)
            .set({ status: 'paid' })
            .where(eq(orders.id, orderId));
        }

        res.json({ 
          success: true,
          message: `Payment of $${(amount / 100).toFixed(2)} processed successfully`,
          transactionId: `sim_${Date.now()}`
        });
      } else {
        throw new Error('Payment simulation failed');
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(500).json({ 
        success: false,
        message: error instanceof Error ? error.message : "Payment processing failed" 
      });
    }
  });


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

  // Create new order
  app.post("/api/orders", async (req, res) => {
    try {
      const { items, total } = req.body;

      // Create order
      const [order] = await db
        .insert(orders)
        .values({ total, items })
        .returning();

      // Create order items
      const orderItemsData = items.map((item: any) => ({
        order_id: order.id,
        drink_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      await db.insert(orderItems).values(orderItemsData);

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Get order by ID
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