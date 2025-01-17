import { db } from "@db";
import { orders, transactions, orderItems, drinks } from "@db/schema";
import { eq } from "drizzle-orm";
import { sql } from 'drizzle-orm';

export class PaymentService {
  // Process a payment and record transaction
  static async processPayment(amount: number, orderId: number) {
    try {
      // Validate inputs
      if (!amount || amount <= 0) {
        return {
          success: false,
          message: "Invalid payment amount"
        };
      }

      if (!orderId) {
        return {
          success: false,
          message: "Invalid order ID"
        };
      }

      // Create transaction record
      const [transaction] = await db
        .insert(transactions)
        .values({
          order_id: orderId,
          amount: Math.round(amount), // Round to nearest integer
          status: 'processing',
          attempts: 1,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning();

      // Update transaction record as completed
      const [updatedTransaction] = await db
        .update(transactions)
        .set({
          status: 'completed',
          updated_at: new Date(),
          metadata: {
            completed_at: new Date().toISOString(),
            success: true
          }
        })
        .where(eq(transactions.id, transaction.id))
        .returning();

      // Update order status
      const [updatedOrder] = await db
        .update(orders)
        .set({ 
          status: 'completed', 
          payment_status: 'completed',
          completed_at: new Date()
        })
        .where(eq(orders.id, orderId))
        .returning();

      // Update drink inventory and sales
      const orderDetails = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.order_id, orderId));

      for (const item of orderDetails) {
        await db
          .update(drinks)
          .set({
            inventory: sql`${drinks.inventory} - ${item.quantity}`,
            sales: sql`COALESCE(${drinks.sales}, 0) + ${item.quantity}`
          })
          .where(eq(drinks.id, item.drink_id));
      }

      return {
        success: true,
        transaction: updatedTransaction,
        order: updatedOrder,
        message: "Payment processed successfully"
      };
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Payment processing failed"
      };
    }
  }

  // Get transaction history with pagination
  static async getTransactionHistory(page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    try {
      const transactionData = await db
        .select({
          id: transactions.id,
          order_id: transactions.order_id,
          amount: transactions.amount,
          status: transactions.status,
          created_at: transactions.created_at,
          updated_at: transactions.updated_at,
          metadata: transactions.metadata,
          order: {
            id: orders.id,
            items: orders.items,
            total: orders.total,
            created_at: orders.created_at
          }
        })
        .from(transactions)
        .leftJoin(orders, eq(transactions.order_id, orders.id))
        .orderBy(sql`${transactions.created_at} DESC`) 
        .limit(limit)
        .offset(offset);

      const [count] = await db
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(transactions);

      return {
        data: transactionData,
        pagination: {
          currentPage: page,
          limit,
          totalItems: count.count,
          totalPages: Math.ceil(count.count / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw new Error('Failed to fetch transaction history');
    }
  }

  // Validate payment method details - always return true in demo mode
  static validatePaymentDetails(cardNumber: string, expiryDate: string, cvv: string): boolean {
    return true;
  }
}