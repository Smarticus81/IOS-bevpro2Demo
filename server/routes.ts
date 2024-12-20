import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { 
  drinks, 
  orders, 
  orderItems,
  paymentMethods,
  tabs,
  splitPayments,
  eventPackages 
} from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { setupRealtimeProxy } from "./realtime-proxy";
import {
  createPaymentIntent,
  retrievePaymentIntent,
  createCustomer,
  attachPaymentMethod,
  reinitializeStripe,
  type PaymentIntentRequest
} from "./services/stripe";
import type { StripeUninitializedError } from "./services/stripe";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  console.log('Setting up routes and realtime proxy...');
  setupRealtimeProxy(httpServer);

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

      // Update inventory and sales
      for (const item of items) {
        await db
          .update(drinks)
          .set({ 
            inventory: sql`${drinks.inventory} - ${item.quantity}`,
            sales: sql`COALESCE(${drinks.sales}, 0) + ${item.quantity}`
          })
          .where(eq(drinks.id, item.id));
      }

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

  // Payment routes
  app.post("/api/payment/create-intent", async (req, res) => {
    try {
      const paymentData: PaymentIntentRequest = {
        amount: req.body.amount,
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: {
          orderId: req.body.orderId,
          customerEmail: req.body.customerEmail
        }
      };

      const intent = await createPaymentIntent(paymentData);
      res.json(intent);
    } catch (error: unknown) {
      console.error("Error creating payment intent:", error);
      if (error instanceof Error && error.name === 'StripeUninitializedError') {
        res.status(503).json({ 
          error: "Payment service unavailable",
          message: "Please configure Stripe API key in settings to enable payments"
        });
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ error: "Failed to create payment intent", message });
      }
    }
  });

  app.post("/api/payment/create-customer", async (req, res) => {
    try {
      const { email, metadata } = req.body;
      const customer = await createCustomer(email, metadata);
      res.json(customer);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'StripeUninitializedError') {
        res.status(503).json({ 
          error: "Payment service unavailable",
          message: "Please configure Stripe API key in settings to enable payments"
        });
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error("Error creating customer:", message);
        res.status(500).json({ error: "Failed to create customer", message });
      }
    }
  });

  app.post("/api/payment/attach-payment-method", async (req, res) => {
    try {
      const { customerId, paymentMethodId } = req.body;
      const paymentMethod = await attachPaymentMethod(customerId, paymentMethodId);
      res.json(paymentMethod);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'StripeUninitializedError') {
        res.status(503).json({ 
          error: "Payment service unavailable",
          message: "Please configure Stripe API key in settings to enable payments"
        });
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error("Error attaching payment method:", message);
        res.status(500).json({ error: "Failed to attach payment method", message });
      }
    }
  });

  app.get("/api/payment/intent/:id", async (req, res) => {
    try {
      const intent = await retrievePaymentIntent(req.params.id);
      res.json(intent);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'StripeUninitializedError') {
        res.status(503).json({ 
          error: "Payment service unavailable",
          message: "Please configure Stripe API key in settings to enable payments"
        });
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error("Error retrieving payment intent:", message);
        res.status(500).json({ error: "Failed to retrieve payment intent", message });
      }
    }
  });

  // Settings endpoints
  app.post("/api/settings/stripe-key", async (req, res) => {
    try {
      const { key } = req.body;
      
      if (!key || typeof key !== 'string' || !key.startsWith('sk_')) {
        return res.status(400).json({ error: "Invalid Stripe API key format" });
      }

      // In a production environment, you would want to:
      // 1. Encrypt the key before storing
      // 2. Store in a secure key management service
      // 3. Implement proper authentication
      // For now, we'll store it in an environment variable
      process.env.STRIPE_SECRET_KEY = key;
      
      // Reinitialize the Stripe client with the new key
      if (reinitializeStripe()) {
        res.json({ message: "Stripe API key updated successfully" });
      } else {
        throw new Error("Failed to initialize Stripe with the provided key");
      }
    } catch (error) {
      console.error("Error updating Stripe API key:", error);
      res.status(500).json({ error: "Failed to update Stripe API key" });
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