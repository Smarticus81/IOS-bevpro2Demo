import { Router } from "express";
import { db } from "@db";
import { transactions, orders, orderItems, drinks } from "@db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/api/transactions", async (req, res) => {
  try {
    // Get transactions with related orders and items
    const result = await db
      .select({
        id: transactions.id,
        order_id: transactions.order_id,
        amount: transactions.amount,
        status: transactions.status,
        created_at: transactions.created_at,
        order: orders,
        orderItems: orderItems
      })
      .from(transactions)
      .leftJoin(orders, eq(transactions.order_id, orders.id))
      .leftJoin(orderItems, eq(orders.id, orderItems.order_id))
      .orderBy(desc(transactions.created_at));

    // Group order items by transaction
    const transactionsMap = new Map();

    result.forEach(row => {
      if (!transactionsMap.has(row.id)) {
        transactionsMap.set(row.id, {
          id: row.id,
          order_id: row.order_id,
          amount: row.amount,
          status: row.status,
          created_at: row.created_at,
          order: {
            id: row.order.id,
            status: row.order.status,
            subtotal: row.order.subtotal,
            tax_amount: row.order.tax_amount,
            total: row.order.total,
            items: []
          }
        });
      }

      if (row.orderItems) {
        const transaction = transactionsMap.get(row.id);
        // Only add the item if it's not already in the array
        if (!transaction.order.items.some(item => item.id === row.orderItems.id)) {
          transaction.order.items.push({
            id: row.orderItems.id,
            quantity: row.orderItems.quantity,
            price: row.orderItems.price,
            tax_amount: row.orderItems.tax_amount,
            drink_name: row.orderItems.drink_name
          });
        }
      }
    });

    const enhancedTransactions = Array.from(transactionsMap.values());

    res.json({
      data: enhancedTransactions,
      pagination: {
        currentPage: 1,
        limit: 50,
        totalItems: enhancedTransactions.length,
        totalPages: 1
      }
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      error: "Failed to fetch transactions",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;