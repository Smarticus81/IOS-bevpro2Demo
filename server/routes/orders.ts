import { Router } from "express";
import { db } from "@db";
import { orders, orderItems } from "@db/schema";
import { calculateOrderTaxAndPours, recordPourTransactions } from "../services/tax-service";

const router = Router();

router.post("/api/orders", async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid order items" });
  }

  try {
    // Calculate tax and track pours
    const { totalTax, pours } = await calculateOrderTaxAndPours(items);

    // Calculate subtotal from the actual items
    const subtotal = items.reduce((total, item) => {
      const itemPrice = typeof item.price === 'number' ? item.price : 0;
      return total + (itemPrice * item.quantity);
    }, 0);

    // Create order with tax
    const [order] = await db.insert(orders).values({
      status: "pending",
      total: subtotal + totalTax,
      items: items,
      payment_status: "pending",
    }).returning();

    // Record order items
    await db.insert(orderItems).values(
      items.map((item) => ({
        order_id: order.id,
        drink_id: item.drink_id,
        quantity: item.quantity,
        price: item.price,
      }))
    );

    // Record pour transactions for tax tracking
    await recordPourTransactions(order.id, pours);

    res.json({
      id: order.id,
      subtotal,
      tax: totalTax,
      total: subtotal + totalTax,
      items,
      pours
    });

  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ 
      error: "Failed to create order",
      details: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

export default router;