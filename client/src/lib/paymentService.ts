import { useToast } from "@/hooks/use-toast";

interface CreatePaymentParams {
  amount: number;
  orderId?: string;
  customerEmail?: string;
  paymentMethod?: string;
  currency?: string;
}

interface PaymentResult {
  success: boolean;
  message: string;
  transactionId?: string;
}

class PaymentService {
  async processPayment({ amount, orderId }: CreatePaymentParams): Promise<PaymentResult> {
    try {
      console.log('Processing payment request:', {
        amount,
        orderId,
        timestamp: new Date().toISOString()
      });

      // Basic validation
      if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount), // Ensure whole number
          orderId,
          currency: 'usd'
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Payment API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          timestamp: new Date().toISOString()
        });
        throw new Error(errorText || 'Payment processing failed');
      }

      const result = await response.json();
      console.log('Payment processed successfully:', {
        result,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: result.message || 'Payment processed successfully',
        transactionId: result.transactionId
      };
    } catch (error) {
      console.error('Payment processing error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  // Validate payment details before processing
  async validatePaymentDetails(details: {
    amount: number;
    orderId?: string;
  }): Promise<boolean> {
    try {
      if (!details.amount || details.amount <= 0) {
        console.warn('Invalid payment amount:', details.amount);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Payment validation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        details,
        timestamp: new Date().toISOString()
      });
      return false;
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();