import { db } from "@db";
import { orders } from "@db/schema";
import { eq } from "drizzle-orm";

export class PaymentService {
  // Process a payment with demo mode always succeeding
  static async processPayment(amount: number, orderId?: number) {
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In demo mode, always succeed
      if (orderId) {
        await db
          .update(orders)
          .set({ status: 'paid' })
          .where(eq(orders.id, orderId));
      }

      return {
        success: true,
        message: `Payment of $${(amount / 100).toFixed(2)} processed successfully`
      };
    } catch (error) {
      console.error('Payment processing error:', error);
      // In demo mode, succeed even on error
      return {
        success: true,
        message: `Payment of $${(amount / 100).toFixed(2)} processed successfully`
      };
    }
  }

  // Validate payment method details - always return true in demo mode
  static validatePaymentDetails(cardNumber: string, expiryDate: string, cvv: string): boolean {
    return true;
  }
}