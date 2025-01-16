import { Router } from "express";
import { db } from "@db";
import { orders, orderItems } from "@db/schema";
import { calculateOrderTaxAndPours, recordPourTransactions } from "../services/tax-service";

const router = Router();

router.post("/api/orders", async (req, res) => {
  const { items } = req.body;

  try {
    // Calculate tax and track pours
    const { totalTax, pours } = await calculateOrderTaxAndPours(items);

    // Calculate subtotal
    const subtotal = items.reduce((total: number, item: any) => total + (item.price * item.quantity), 0);

    // Create order with tax
    const [order] = await db.insert(orders).values({
      status: "pending",
      total: subtotal + totalTax,
      items: items,
      payment_status: "pending",
    }).returning();

    // Record order items
    await db.insert(orderItems).values(
      items.map((item: any) => ({
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
    res.status(500).json({ error: "Failed to create order" });
  }
});

export default router;