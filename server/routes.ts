import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { db } from "@db";
import { drinks, orders, orderItems } from "@db/schema";
import { eq, sql } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  // WebSocket connection handler
  wss.on("connection", (ws: WebSocket, req) => {
    // Ignore Vite HMR connections
    if (req.headers["sec-websocket-protocol"] === "vite-hmr") {
      return;
    }

    console.log("New WebSocket connection");
    
    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "order_update") {
          // Broadcast order updates to all connected clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });
  });

  // Get all drinks
  app.get("/api/drinks", async (_req, res) => {
    try {
      const allDrinks = await db.select().from(drinks);
      res.json(allDrinks);
    } catch (error) {
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

      // Update inventory
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
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Update order status
  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const [updatedOrder] = await db
        .update(orders)
        .set({ 
          status,
          completed_at: status === "completed" ? new Date() : null
        })
        .where(eq(orders.id, parseInt(id)))
        .returning();

      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order" });
    }
  });

  return httpServer;
}
