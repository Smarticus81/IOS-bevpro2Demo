interface PaymentMethod {
  id: string;
  type: string;
  provider: string;
  display_name: string;
  enabled: boolean;
}

interface CreatePaymentParams {
  amount: number;
  orderId?: string;
  customerEmail?: string;
  paymentMethod?: string;
  currency?: string;
}

interface PaymentIntent {
  clientSecret: string;
  id: string;
  status: string;
}

interface SimulatedPaymentMethod {
  id: string;
  type: string;
  provider: string;
  display_name: string;
  enabled: boolean;
}

interface CreatePaymentParams {
  amount: number;
  orderId?: string;
  customerEmail?: string;
  paymentMethod?: string;
}

export const paymentService = {
  async createPaymentIntent({ amount, orderId, customerEmail, currency = 'usd' }: CreatePaymentParams): Promise<PaymentIntent> {
    try {
      // In demo mode, always succeed after a short delay
      await new Promise(resolve => setTimeout(resolve, 800));

      return {
        clientSecret: `demo_${Date.now()}`,
        id: `demo_${orderId || Date.now()}`,
        status: 'succeeded'
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      // In demo mode, still succeed even on error
      return {
        clientSecret: `demo_${Date.now()}`,
        id: `demo_${orderId || Date.now()}`,
        status: 'succeeded'
      };
    }
  },

  // Get available payment methods
  async getPaymentMethods(): Promise<SimulatedPaymentMethod[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return simulated payment methods
    return [
      {
        id: 'credit_card',
        type: 'credit_card',
        provider: 'stripe',
        display_name: 'Credit Card',
        enabled: true
      },
      {
        id: 'apple_pay',
        type: 'digital_wallet',
        provider: 'apple',
        display_name: 'Apple Pay',
        enabled: true
      },
      {
        id: 'google_pay',
        type: 'digital_wallet',
        provider: 'google',
        display_name: 'Google Pay',
        enabled: true
      },
      {
        id: 'qr_code',
        type: 'qr_code',
        provider: 'custom',
        display_name: 'QR Code Payment',
        enabled: true
      }
    ];
  },

  // Validate Stripe API key
  async validateStripeKey(key: string): Promise<boolean> {
    // In demo mode, always return true
    return true;
  },

  // Simulate payment validation
  async validatePayment(paymentDetails: any): Promise<boolean> {
    // In demo mode, always return true after a short delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  },

  // Simulate checking if payment features are available
  async isPaymentEnabled(): Promise<boolean> {
    return true;
  }
};