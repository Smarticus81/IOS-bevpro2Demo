import type { Express, Response } from "express";
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
  pourInventory,
  pourTransactions,
  pourSizes,
  taxCategories,
} from "@db/schema";
import { eq, sql, count, sum, desc, and } from "drizzle-orm";
import { setupRealtimeProxy } from "./realtime-proxy";

// Cache duration constants
const CACHE_DURATION = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
};

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  console.log('Setting up routes and realtime proxy...');

  // Enable compression for all routes
  app.use(compression());

  // Setup realtime connection with enhanced event handling
  const realtimeProxy = setupRealtimeProxy(httpServer);

  // Update the broadcast helper function to be more consistent
  const broadcastInventoryUpdate = (type: string, data: any) => {
    if (realtimeProxy) {
      console.log('Broadcasting inventory update:', { type, data });
      realtimeProxy.broadcast({
        type: 'INVENTORY_UPDATE',
        data: {
          type,
          ...data,
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  // Get drinks with real-time updates enabled
  app.get("/api/drinks", async (_req, res) => {
    try {
      // Add cache control headers for short-term caching
      res.set('Cache-Control', `public, max-age=${CACHE_DURATION.SHORT}`);

      // Get all drinks without pagination
      const allDrinks = await db
        .select()
        .from(drinks)
        .orderBy(drinks.category);

      console.log('Fetched drinks:', allDrinks.map(d => ({ 
        id: d.id, 
        name: d.name, 
        inventory: d.inventory 
      })));

      // Broadcast drinks update
      broadcastInventoryUpdate('DRINKS_UPDATE', {
        items: allDrinks,
      });

      res.json({
        drinks: allDrinks
      });
    } catch (error) {
      console.error("Error fetching drinks:", error);
      res.status(500).json({ error: "Failed to fetch drinks" });
    }
  });

  // Create new order with real-time inventory updates
  app.post("/api/orders", async (req, res) => {
    try {
      const { items, total } = req.body;
      console.log('Processing order:', { items, total });

      if (!items?.length || typeof total !== 'number' || total <= 0) {
        return res.status(400).json({
          error: "Invalid order data. Must include items array and valid total."
        });
      }

      // Process order in a transaction with proper locking
      const result = await db.transaction(async (tx) => {
        console.log('Starting transaction for order processing');

        // First, lock and validate all inventory items
        const lockedItems = await Promise.all(
          items.map(async (item: any) => {
            console.log('Locking item:', item);
            const [drink] = await tx
              .select()
              .from(drinks)
              .where(eq(drinks.id, item.drink.id))
              .limit(1);

            if (!drink || drink.inventory < item.quantity) {
              throw new Error(`Insufficient inventory for drink ID ${item.drink.id}`);
            }

            return { ...drink, requestedQuantity: item.quantity };
          })
        );

        console.log('Locked and validated items:', lockedItems);

        // Create order
        const [order] = await tx.insert(orders)
          .values({
            total,
            items: items,
            status: 'pending',
            payment_status: 'pending',
            created_at: new Date()
          })
          .returning();

        console.log('Created order:', order);

        // Create order items
        await Promise.all(
          items.map(async (item: any) => {
            await tx.insert(orderItems)
              .values({
                order_id: order.id,
                drink_id: item.drink.id,
                quantity: item.quantity,
                price: item.drink.price
              });
          })
        );

        // Update inventory atomically
        const updatedDrinks = await Promise.all(
          lockedItems.map(async (drink) => {
            console.log('Updating inventory for drink:', drink);
            const [updated] = await tx
              .update(drinks)
              .set({
                inventory: sql`${drinks.inventory} - ${drink.requestedQuantity}`,
                sales: sql`COALESCE(${drinks.sales}, 0) + ${drink.requestedQuantity}`
              })
              .where(eq(drinks.id, drink.id))
              .returning();

            return updated;
          })
        );

        console.log('Updated drinks inventory:', updatedDrinks);
        return { order, updatedDrinks };
      });

      // Broadcast individual inventory updates after successful transaction
      result.updatedDrinks.forEach(drink => {
        broadcastInventoryUpdate('INVENTORY_CHANGE', {
          drinkId: drink.id,
          newInventory: drink.inventory,
          sales: drink.sales
        });
      });

      console.log('Order processed successfully:', result);
      res.json(result.order);
    } catch (error: any) {
      console.error("Error processing order:", error);
      res.status(error.message?.includes("Insufficient inventory") ? 400 : 500)
        .json({
          error: error.message || "Failed to process order"
        });
    }
  });

  // Cancel order and restore inventory
  app.post("/api/orders/:id/cancel", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);

      const result = await db.transaction(async (tx) => {
        // Get order details with items
        const [order] = await tx
          .select()
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);

        if (!order) {
          throw new Error("Order not found");
        }

        if (order.status === 'cancelled') {
          throw new Error("Order already cancelled");
        }

        // Get order items
        const orderItems = await tx
          .select()
          .from(orderItems)
          .where(eq(orderItems.order_id, orderId));

        // Restore inventory for each item
        const updatedDrinks = await Promise.all(
          orderItems.map(async (item) => {
            const [updated] = await tx
              .update(drinks)
              .set({
                inventory: sql`${drinks.inventory} + ${item.quantity}`,
                sales: sql`COALESCE(${drinks.sales}, 0) - ${item.quantity}`
              })
              .where(eq(drinks.id, item.drink_id))
              .returning();

            return updated;
          })
        );

        // Update order status
        const [updatedOrder] = await tx
          .update(orders)
          .set({
            status: 'cancelled',
            completed_at: new Date()
          })
          .where(eq(orders.id, orderId))
          .returning();

        return { order: updatedOrder, updatedDrinks };
      });

      // Broadcast inventory updates
      result.updatedDrinks.forEach(drink => {
        broadcastInventoryUpdate('inventory_change', {
          drinkId: drink.id,
          newInventory: drink.inventory,
          sales: drink.sales
        });
      });

      res.json(result.order);
    } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json({ error: "Failed to cancel order" });
    }
  });

  // Get pour inventory with real-time updates
  app.get("/api/pour-inventory", async (_req, res) => {
    try {
      res.set('Cache-Control', `public, max-age=${CACHE_DURATION.SHORT}`);

      const inventory = await db.select({
        id: pourInventory.id,
        drink_id: pourInventory.drink_id,
        bottle_id: pourInventory.bottle_id,
        initial_volume_ml: pourInventory.initial_volume_ml,
        remaining_volume_ml: pourInventory.remaining_volume_ml,
        is_active: pourInventory.is_active,
        tax_category_id: pourInventory.tax_category_id,
        last_pour_at: pourInventory.last_pour_at,
        drink_name: drinks.name,
        drink_category: drinks.category,
        tax_category_name: taxCategories.name
      })
        .from(pourInventory)
        .leftJoin(drinks, eq(pourInventory.drink_id, drinks.id))
        .leftJoin(taxCategories, eq(pourInventory.tax_category_id, taxCategories.id))
        .where(eq(pourInventory.is_active, true))
        .orderBy(desc(pourInventory.last_pour_at));

      // Broadcast pour inventory update
      broadcastInventoryUpdate('inventory', {
        items: inventory,
        timestamp: new Date().toISOString()
      });

      res.json({
        data: inventory,
        pagination: {
          currentPage: 1,
          limit: inventory.length,
          totalItems: inventory.length
        }
      });
    } catch (error) {
      console.error("Error fetching pour inventory:", error);
      res.status(500).json({ error: "Failed to fetch pour inventory" });
    }
  });

  // Update the pour transaction endpoint with better atomic handling
  app.post("/api/pour-transactions/track", async (req, res) => {
    try {
      const { pourInventoryId, pourSizeId, staffId } = req.body;

      // Start a database transaction
      const result = await db.transaction(async (tx) => {
        // Get pour size details
        const [pourSize] = await tx.select({
          volume_ml: pourSizes.volume_ml,
          tax_amount: sql<number>`COALESCE(${pourSizes.tax_amount}::numeric, 0)`,
        })
          .from(pourSizes)
          .where(eq(pourSizes.id, pourSizeId))
          .limit(1);

        if (!pourSize) {
          throw new Error("Invalid pour size");
        }

        // Get current inventory with locking
        const [inventory] = await tx.select()
          .from(pourInventory)
          .where(eq(pourInventory.id, pourInventoryId))
          .forUpdate()
          .limit(1);

        if (!inventory) {
          throw new Error("Invalid inventory item");
        }

        if (inventory.remaining_volume_ml < pourSize.volume_ml) {
          throw new Error(`Insufficient volume: ${inventory.remaining_volume_ml}ml remaining, ${pourSize.volume_ml}ml requested`);
        }

        // Create transaction record
        const [transaction] = await tx.insert(pourTransactions)
          .values({
            pour_inventory_id: pourInventoryId,
            pour_size_id: pourSizeId,
            volume_ml: pourSize.volume_ml,
            staff_id: staffId,
            transaction_time: new Date(),
            tax_amount: pourSize.tax_amount
          })
          .returning();

        // Update inventory atomically
        const [updatedInventory] = await tx.update(pourInventory)
          .set({
            remaining_volume_ml: sql`${pourInventory.remaining_volume_ml} - ${pourSize.volume_ml}`,
            last_pour_at: new Date()
          })
          .where(eq(pourInventory.id, pourInventoryId))
          .returning();

        return { transaction, updatedInventory };
      });

      // Broadcast update after successful transaction
      broadcastInventoryUpdate('pour_transaction', {
        data: result,
        timestamp: new Date().toISOString()
      });

      res.json(result);
    } catch (error) {
      console.error("Error tracking pour:", error);
      res.status(error.message.includes("Insufficient volume") ? 400 : 500)
        .json({ error: error.message || "Failed to track pour" });
    }
  });
  //This route is duplicated in the original code. Removing the duplicate.
  // app.post("/api/pour-transactions/track", async (req, res) => { ... });


  // Dashboard Statistics with pagination and caching
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      // Add cache control headers for short-term caching
      res.set('Cache-Control', `public, max-age=${CACHE_DURATION.SHORT}`);

      // Get pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Get total sales and today's sales
      const [salesStats] = await db.select({
        totalSales: sum(transactions.amount).mapWith(Number),
        totalOrders: count(orders.id).mapWith(Number)
      })
        .from(transactions)
        .leftJoin(orders, eq(transactions.order_id, orders.id))
        .where(eq(transactions.status, 'completed'));

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [todayStats] = await db.select({
        todaySales: sum(transactions.amount).mapWith(Number)
      })
        .from(transactions)
        .where(sql`${transactions.created_at}::date = ${todayStart.toISOString().split('T')[0]} AND ${transactions.status} = 'completed'`);

      // Get active orders with pagination
      const activeOrders = await db.select({
        count: count().mapWith(Number)
      })
        .from(orders)
        .where(eq(orders.status, 'pending'));

      // Get category sales with pagination
      const categorySales = await db.select({
        category: drinks.category,
        totalSales: sum(orderItems.quantity).mapWith(Number)
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
        sales: sum(orderItems.quantity).mapWith(Number)
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
      // Add cache control headers for medium-term caching
      res.set('Cache-Control', `public, max-age=${CACHE_DURATION.MEDIUM}`);

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

  // Add new endpoints for pour tracking
  app.get("/api/pour-transactions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;

      const transactions = await db.select({
        id: pourTransactions.id,
        pour_inventory_id: pourTransactions.pour_inventory_id,
        pour_size_id: pourTransactions.pour_size_id,
        volume_ml: pourTransactions.volume_ml,
        staff_id: pourTransactions.staff_id,
        transaction_time: pourTransactions.transaction_time,
        tax_amount: pourTransactions.tax_amount,
        drink_name: drinks.name,
        drink_category: drinks.category,
      })
        .from(pourTransactions)
        .leftJoin(pourInventory, eq(pourTransactions.pour_inventory_id, pourInventory.id))
        .leftJoin(drinks, eq(pourInventory.drink_id, drinks.id))
        .orderBy(desc(pourTransactions.transaction_time))
        .limit(limit);

      res.json({
        data: transactions,
        pagination: {
          currentPage: 1,
          limit,
          totalItems: transactions.length
        }
      });
    } catch (error) {
      console.error("Error fetching pour transactions:", error);
      res.status(500).json({ error: "Failed to fetch pour transactions" });
    }
  });

  app.get("/api/tax-categories", async (_req, res) => {
    try {
      const categories = await db.select().from(taxCategories);
      res.json({
        data: categories,
        pagination: {
          currentPage: 1,
          limit: categories.length,
          totalItems: categories.length
        }
      });
    } catch (error) {
      console.error("Error fetching tax categories:", error);
      res.status(500).json({ error: "Failed to fetch tax categories" });
    }
  });

  app.post("/api/drinks", async (req, res) => {
    try {
      const {
        name,
        category,
        subcategory,
        price,
        initial_volume_ml,
        bottle_id,
        tax_category_id,
        inventory
      } = req.body;

      console.log("Received new drink request:", req.body);

      // Validate required fields
      if (!name || !category || typeof parseFloat(price) !== 'number') {
        console.error("Validation failed:", { name, category, price });
        return res.status(400).json({
          error: "Missing required fields: name, category, and price are required"
        });
      }

      // First insert the drink
      try {
        const [newDrink] = await db.insert(drinks)
          .values({
            name,
            category,
            subcategory: subcategory || null,
            price: parseFloat(price),
            inventory: parseInt(inventory) || 0
          })
          .returning();

        console.log("Created new drink:", newDrink);

        // If this is a pour-tracked item (spirits, classics, signature drinks)
        if (initial_volume_ml && bottle_id && tax_category_id) {
          // Create pour inventory record
          const [pourInventoryItem] = await db.insert(pourInventory)
            .values({
              drink_id: newDrink.id,
              bottle_id,
              initial_volume_ml: parseFloat(initial_volume_ml),
              remaining_volume_ml: parseFloat(initial_volume_ml),
              tax_category_id: parseInt(tax_category_id),
              is_active: true,
              last_pour_at: new Date()
            })
            .returning();

          console.log("Created pour inventory item:", pourInventoryItem);

          // Broadcast inventory update
          broadcastInventoryUpdate('new_item', {
            item: {
              ...newDrink,
              pour_inventory: pourInventoryItem
            }
          });

          return res.json({
            ...newDrink,
            pour_inventory: pourInventoryItem
          });
        }

        // Broadcast inventory update for non-pour items
        broadcastInventoryUpdate('new_item', {
          item: newDrink
        });

        res.json(newDrink);
      } catch (dbError: any) {
        console.error("Database error:", dbError);
        return res.status(500).json({
          error: "Failed to add drink to database",
          details: dbError.message
        });
      }
    } catch (error) {
      console.error("Error adding new drink:", error);
      res.status(500).json({
        error: "Failed to add new drink",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add inventory update endpoint with transaction logging
  app.post("/api/drinks/:id/inventory", async (req, res) => {
    try {
      const drinkId = parseInt(req.params.id);
      const { quantity, isIncrement } = req.body;

      if (typeof quantity !== 'number' || quantity <= 0) {
        return res.status(400).json({ error: "Invalid quantity" });
      }

      // Process inventory update in a transaction
      const result = await db.transaction(async (tx) => {
        // Get current drink with locking
        const [drink] = await tx
          .select()
          .from(drinks)
          .where(eq(drinks.id, drinkId))
          .limit(1);

        if(!drink) {
          throw new Error("Drink not found");
        }

        // Calculate new inventory
        const newInventory = isIncrement
          ? drink.inventory + quantity
          : drink.inventory - quantity;

        if (newInventory < 0) {
          throw new Error("Insufficient inventory");
        }

        // Update drink inventory
        const [updatedDrink] = await tx
          .update(drinks)
          .set({
            inventory: newInventory,
            ...(isIncrement ? {} : {
              sales: sql`COALESCE(${drinks.sales}, 0) + ${quantity}`
            })
          })
          .where(eq(drinks.id, drinkId))
          .returning();

        // Create a demo order for inventory updates
        const [order] = await tx
          .insert(orders)
          .values({
            total: drink.price * quantity,
            status: 'completed',
            payment_status: 'completed',
            created_at: new Date(),
            completed_at: new Date(),
            items: [{
              drink_id: drinkId,
              quantity: quantity,
              price: drink.price
            }]
          })
          .returning();

        // Create transaction record linked to the order
        const [transaction] = await tx
          .insert(transactions)
          .values({
            order_id: order.id,
            amount: drink.price * quantity,
            status: 'completed',
            created_at: new Date(),
            updated_at: new Date(),
            metadata: {
              type: isIncrement ? 'inventory_increase' : 'inventory_decrease',
              drink_id: drinkId,
              quantity,
              previous_inventory: drink.inventory,
              new_inventory: newInventory
            }
          })
          .returning();

        return { updatedDrink, transaction, order };
      });

      // Broadcast inventory update
      broadcastInventoryUpdate('inventory_change', {
        drinkId: result.updatedDrink.id,
        newInventory: result.updatedDrink.inventory,
        sales: result.updatedDrink.sales,
        transaction: result.transaction
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating inventory:", error);
      res.status(error.message?.includes("Insufficient inventory") ? 400 : 500)
        .json({
          error: error.message || "Failed to update inventory",
          details: error instanceof Error ? error.message : "Unknown error"
        });
    }
  });

  return httpServer;
}