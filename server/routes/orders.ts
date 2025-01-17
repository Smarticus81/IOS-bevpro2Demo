import { Router } from "express";
import { db } from "@db";
import { orders, orderItems, drinks } from "@db/schema";
import { calculateOrderTaxAndPours, recordPourTransactions } from "../services/tax-service";

const router = Router();

router.post("/api/orders", async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid order items" });
  }

  try {
    // Get drink details for names
    const drinkIds = items.map(item => item.drink_id);
    const drinkDetails = await db
      .select({
        id: drinks.id,
        name: drinks.name,
      })
      .from(drinks)
      .where(drinks.id.in(drinkIds));

    // Create a map of drink_id to name for easy lookup
    const drinkNameMap = new Map(drinkDetails.map(d => [d.id, d.name]));

    // Calculate tax and track pours
    const { totalTax, pours } = await calculateOrderTaxAndPours(items);

    // Calculate subtotal from the actual items
    const subtotal = items.reduce((total, item) => {
      const itemPrice = typeof item.price === 'number' ? item.price : 0;
      return total + (itemPrice * item.quantity);
    }, 0);

    // Enhance items with drink names
    const itemsWithNames = items.map(item => ({
      ...item,
      name: drinkNameMap.get(item.drink_id) || 'Unknown Drink'
    }));

    // Create order with tax
    const [order] = await db.insert(orders).values({
      status: "pending",
      total: subtotal + totalTax,
      items: itemsWithNames,
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
      items: itemsWithNames,
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