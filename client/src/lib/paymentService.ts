import type { CreatePaymentParams, PaymentIntent, PaymentMethod } from '@/types/payment';

export const paymentService = {
  async createPaymentIntent({ amount, orderId, customerEmail, currency = 'usd' }: CreatePaymentParams): Promise<PaymentIntent> {
    try {
      const response = await fetch('/api/payment/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          orderId,
          customerEmail,
          currency
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Payment processing failed');
      }

      const data = await response.json();
      return {
        clientSecret: data.clientSecret,
        id: data.transactionId,
        status: data.status
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  },

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await fetch('/api/payment-methods');
    if (!response.ok) {
      throw new Error('Failed to fetch payment methods');
    }
    return response.json();
  },

  async validatePayment(paymentDetails: any): Promise<boolean> {
    const response = await fetch('/api/payment/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentDetails),
    });

    if (!response.ok) {
      throw new Error('Payment validation failed');
    }

    const result = await response.json();
    return result.valid;
  },

  async isPaymentEnabled(): Promise<boolean> {
    try {
      const response = await fetch('/api/payment/status');
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data.enabled;
    } catch {
      return false;
    }
  }
};