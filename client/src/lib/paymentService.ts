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

export const paymentService = {
  async processPayment({ amount }: CreatePaymentParams): Promise<PaymentResult> {
    try {
      // Process the payment
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: 'usd'
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const result = await response.json();
      return {
        success: true,
        message: 'Payment processed successfully',
        transactionId: result.transactionId
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  },

  // Validate payment details
  async validatePayment(paymentDetails: {
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
  }): Promise<boolean> {
    try {
      const response = await fetch('/api/payments/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentDetails),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    } catch (error) {
      console.error('Payment validation error:', error);
      return false;
    }
  }
};