import { db } from "@db";
import { orders } from "@db/schema";
import { eq } from "drizzle-orm";

export class PaymentService {
  // Process a payment with enhanced validation and error handling
  static async processPayment(amount: number, orderId?: number) {
    try {
      console.log('Starting payment processing:', {
        amount,
        orderId,
        timestamp: new Date().toISOString()
      });

      // Input validation
      if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate 90% success rate for testing
      const success = Math.random() > 0.1;

      if (success) {
        // If we have an order ID, update its status
        if (orderId) {
          console.log('Updating order status:', {
            orderId,
            status: 'paid',
            timestamp: new Date().toISOString()
          });

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
      console.error('Payment processing error:', {
        error: error instanceof Error ? error.message : "Unknown error",
        amount,
        orderId,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  // Enhanced payment validation with logging
  static validatePayment(amount: number): boolean {
    try {
      if (!amount || amount <= 0) {
        console.warn('Invalid payment amount:', {
          amount,
          timestamp: new Date().toISOString()
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Payment validation error:', {
        error: error instanceof Error ? error.message : "Unknown error",
        amount,
        timestamp: new Date().toISOString()
      });
      return false;
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