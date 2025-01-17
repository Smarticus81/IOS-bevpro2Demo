import { Router } from "express";
import { db } from "@db";
import { orders, orderItems, drinks } from "@db/schema";
import { calculateOrderTaxAndPours, recordPourTransactions } from "../services/tax-service";
import { eq, inArray } from "drizzle-orm";

const router = Router();

router.post("/api/orders", async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invalid order items" });
  }

  try {
    // Get drink details including names for both the order and order items
    const drinkIds = items.map(item => item.drink_id);
    const drinkDetails = await db
      .select({
        id: drinks.id,
        name: drinks.name,
        category: drinks.category,
        subcategory: drinks.subcategory
      })
      .from(drinks)
      .where(inArray(drinks.id, drinkIds));

    // Create a map for quick lookup of drink details
    const drinkDetailsMap = new Map(drinkDetails.map(drink => [drink.id, drink]));

    // Calculate tax and track pours
    const { totalTax, pours, itemTaxes } = await calculateOrderTaxAndPours(items);

    // Calculate subtotal from the actual items
    const subtotal = items.reduce((total, item) => {
      const itemPrice = typeof item.price === 'number' ? item.price : 0;
      return total + (itemPrice * item.quantity);
    }, 0);

    // Enhance items with drink names and details for the order response
    const itemsWithNames = items.map(item => {
      const drinkDetail = drinkDetailsMap.get(item.drink_id);
      return {
        price: item.price,
        drink_id: item.drink_id,
        quantity: item.quantity,
        name: drinkDetail?.name || 'Unknown Drink',
        category: drinkDetail?.category,
        subcategory: drinkDetail?.subcategory,
        tax_amount: itemTaxes[item.drink_id] || 0
      };
    });

    // Create order with tax
    const [order] = await db.insert(orders).values({
      status: "pending",
      subtotal: subtotal,
      tax_amount: totalTax,
      total: subtotal + totalTax,
      items: itemsWithNames,
      payment_status: "pending",
    }).returning();

    // Record order items with tax amounts
    await db.insert(orderItems).values(
      items.map((item) => {
        const drinkDetail = drinkDetailsMap.get(item.drink_id);
        return {
          order_id: order.id,
          drink_id: item.drink_id,
          quantity: item.quantity,
          price: item.price,
          drink_name: drinkDetail?.name || 'Unknown Drink',
          tax_amount: itemTaxes[item.drink_id] || 0
        };
      })
    );

    // Record pour transactions for tax tracking
    await recordPourTransactions(order.id, pours);

    res.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        subtotal: order.subtotal,
        tax_amount: order.tax_amount,
        total: order.total,
        items: itemsWithNames,
        created_at: order.created_at,
        completed_at: order.completed_at,
        payment_status: order.payment_status,
        tab_id: order.tab_id
      },
      subtotal,
      tax: totalTax,
      total: subtotal + totalTax,
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