import { db } from "@db";
import { orders } from "@db/schema";
import { eq } from "drizzle-orm";

export class PaymentService {
  // Process a payment with basic validation and simulated success rate
  static async processPayment(amount: number, orderId?: number) {
    try {
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate 90% success rate
      const success = Math.random() > 0.1;
      
      if (success) {
        // If we have an order ID, update its status
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
      } else {
        throw new Error('Payment simulation failed');
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  // Validate payment method details
  static validatePaymentDetails(cardNumber: string, expiryDate: string, cvv: string): boolean {
    const cardNumberValid = /^\d{16}$/.test(cardNumber.replace(/\s/g, ''));
    const expiryValid = /^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(expiryDate);
    const cvvValid = /^\d{3}$/.test(cvv);

    return cardNumberValid && expiryValid && cvvValid;
  }
}
