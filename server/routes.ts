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
  eventPackages,
  taxConfig 
} from "@db/schema";
import { eq, sql, count, sum, desc } from "drizzle-orm";
import { setupRealtimeProxy } from "./realtime-proxy";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  console.log('Setting up routes and realtime proxy...');
  setupRealtimeProxy(httpServer);

  // Dashboard Statistics
  app.get("/api/dashboard/stats", async (_req, res) => {
    try {
      // Get total sales and today's sales
      const salesStats = await db.select({
        totalSales: sum(transactions.amount).mapWith(Number),
        totalOrders: count(orders.id).mapWith(Number)
      })
      .from(transactions)
      .leftJoin(orders, eq(transactions.order_id, orders.id))
      .where(eq(transactions.status, 'completed'));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayStats = await db.select({
        todaySales: sum(transactions.amount).mapWith(Number)
      })
      .from(transactions)
      .where(sql`${transactions.created_at}::date = ${todayStart.toISOString().split('T')[0]} AND ${transactions.status} = 'completed'`);

      // Get active orders count
      const activeOrders = await db.select({
        count: count().mapWith(Number)
      })
      .from(orders)
      .where(eq(orders.status, 'pending'));

      // Get total customers (unique tabs)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const customerStats = await db.select({
        totalCustomers: count().mapWith(Number)
      })
      .from(tabs)
      .where(sql`${tabs.created_at}::date >= ${thirtyDaysAgo.toISOString().split('T')[0]}`);

      // Get category sales distribution
      const categorySales = await db.select({
        category: drinks.category,
        totalSales: sum(orderItems.quantity).mapWith(Number)
      })
      .from(orderItems)
      .leftJoin(drinks, eq(orderItems.drink_id, drinks.id))
      .groupBy(drinks.category);

      // Get weekly sales trend
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const weeklyTrend = await db.select({
        date: sql<string>`to_char(${transactions.created_at}, 'YYYY-MM-DD')`,
        sales: sum(transactions.amount).mapWith(Number)
      })
      .from(transactions)
      .where(sql`${transactions.created_at}::date >= ${sevenDaysAgo.toISOString().split('T')[0]}`)
      .groupBy(sql`to_char(${transactions.created_at}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${transactions.created_at}, 'YYYY-MM-DD')`);

      // Get popular drinks
      const popularDrinks = await db.select({
        id: drinks.id,
        name: drinks.name,
        sales: sum(orderItems.quantity).mapWith(Number)
      })
      .from(orderItems)
      .leftJoin(drinks, eq(orderItems.drink_id, drinks.id))
      .groupBy(drinks.id, drinks.name)
      .orderBy(sql`sum(${orderItems.quantity}) DESC`)
      .limit(5);

      res.json({
        totalSales: salesStats[0]?.totalSales || 0,
        todaySales: todayStats[0]?.todaySales || 0,
        activeOrders: activeOrders[0]?.count || 0,
        totalCustomers: customerStats[0]?.totalCustomers || 0,
        categorySales,
        weeklyTrend,
        popularDrinks,
        totalOrders: salesStats[0]?.totalOrders || 0
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // Add tax calculation endpoints
  app.get("/api/tax-summary", async (_req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get daily tax totals
      const dailyTaxes = await db.select({
        salesTax: sum(transactions.sales_tax).mapWith(Number),
        liquorTax: sum(transactions.liquor_tax).mapWith(Number),
        totalTax: sum(transactions.total_tax).mapWith(Number),
        transactionCount: count().mapWith(Number)
      })
      .from(transactions)
      .where(sql`${transactions.created_at}::date = ${today.toISOString().split('T')[0]} AND ${transactions.status} = 'completed'`);

      // Get monthly tax totals
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlyTaxes = await db.select({
        salesTax: sum(transactions.sales_tax).mapWith(Number),
        liquorTax: sum(transactions.liquor_tax).mapWith(Number),
        totalTax: sum(transactions.total_tax).mapWith(Number),
        transactionCount: count().mapWith(Number)
      })
      .from(transactions)
      .where(sql`${transactions.created_at}::date >= ${monthStart.toISOString().split('T')[0]} AND ${transactions.status} = 'completed'`);

      // Get tax rates
      const taxRates = await db.select()
        .from(taxConfig)
        .where(eq(taxConfig.is_active, true));

      res.json({
        daily: {
          salesTax: dailyTaxes[0]?.salesTax || 0,
          liquorTax: dailyTaxes[0]?.liquorTax || 0,
          totalTax: dailyTaxes[0]?.totalTax || 0,
          transactionCount: dailyTaxes[0]?.transactionCount || 0
        },
        monthly: {
          salesTax: monthlyTaxes[0]?.salesTax || 0,
          liquorTax: monthlyTaxes[0]?.liquorTax || 0,
          totalTax: monthlyTaxes[0]?.totalTax || 0,
          transactionCount: monthlyTaxes[0]?.transactionCount || 0
        },
        rates: taxRates
      });
    } catch (error) {
      console.error("Error fetching tax summary:", error);
      res.status(500).json({ error: "Failed to fetch tax summary" });
    }
  });

  // Get recent transactions
  app.get("/api/recent-transactions", async (_req, res) => {
    try {
      const recentTransactions = await db.select({
        id: transactions.id,
        amount: transactions.amount,
        subtotal: transactions.subtotal,
        salesTax: transactions.sales_tax,
        liquorTax: transactions.liquor_tax,
        totalTax: transactions.total_tax,
        status: transactions.status,
        createdAt: transactions.created_at
      })
      .from(transactions)
      .orderBy(desc(transactions.created_at))
      .limit(10);

      res.json(recentTransactions);
    } catch (error) {
      console.error("Error fetching recent transactions:", error);
      res.status(500).json({ error: "Failed to fetch recent transactions" });
    }
  });

  // Update the payment processing endpoint to include tax calculations
  app.post("/api/payment/process", async (req, res) => {
    let transactionId: number | null = null;

    try {
      const { amount, orderId } = req.body;
      console.log("Processing payment:", { amount, orderId });

      if (typeof amount !== 'number' || amount <= 0) {
        console.error("Invalid payment amount:", amount);
        return res.status(400).json({ error: "Invalid payment amount" });
      }

      // Get tax rates
      const taxRates = await db.select()
        .from(taxConfig)
        .where(eq(taxConfig.is_active, true));

      const salesTaxRate = taxRates.find(t => t.type === 'sales_tax')?.rate || 0.08; // Default 8%
      const liquorTaxRate = taxRates.find(t => t.type === 'liquor_tax')?.rate || 0.05; // Default 5%

      // Calculate taxes
      const subtotal = amount;
      const salesTax = Math.round(subtotal * Number(salesTaxRate));
      const liquorTax = Math.round(subtotal * Number(liquorTaxRate));
      const totalTax = salesTax + liquorTax;
      const total = subtotal + totalTax;

      // Create transaction record with tax information
      const [transaction] = await db.insert(transactions)
        .values({
          order_id: orderId,
          amount: total,
          subtotal,
          sales_tax: salesTax,
          liquor_tax: liquorTax,
          total_tax: totalTax,
          status: 'processing',
          attempts: 1,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning();

      transactionId = transaction.id;

      // Demo mode - payment always succeeds
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

      await db.update(orders)
        .set({ 
          status: 'completed',
          payment_status: 'completed',
          completed_at: new Date()
        })
        .where(eq(orders.id, orderId));

      console.log("Payment successful:", {
        orderId,
        transactionId,
        amount: (total / 100).toFixed(2),
        tax: (totalTax / 100).toFixed(2)
      });

      res.json({ 
        success: true,
        message: `Payment of $${(total / 100).toFixed(2)} processed successfully`,
        orderId,
        transactionId,
        tax: {
          salesTax: (salesTax / 100).toFixed(2),
          liquorTax: (liquorTax / 100).toFixed(2),
          totalTax: (totalTax / 100).toFixed(2)
        },
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


  return httpServer;
}