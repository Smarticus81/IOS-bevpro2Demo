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
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency,
          orderId,
          customerEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error('Failed to initialize payment. Please try again.');
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
    try {
      if (process.env.NODE_ENV === 'development') {
        console.info('Running in development mode - simulating Stripe key validation');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return key.startsWith('sk_') && key.length > 20;
      }

      const response = await fetch('/api/settings/stripe-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return true;
    } catch (error) {
      console.error('Error validating Stripe key:', error);
      return false;
    }
  },

  // Simulate payment validation
  async validatePayment(paymentDetails: any): Promise<boolean> {
    // Simulate validation delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Basic validation rules
    if (paymentDetails.type === 'credit_card') {
      return (
        paymentDetails.cardNumber?.length === 16 &&
        paymentDetails.cvv?.length === 3
      );
    }
    
    return true;
  },

  // Simulate checking if payment features are available
  async isPaymentEnabled(): Promise<boolean> {
    return true;
  }
};