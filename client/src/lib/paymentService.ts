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

// Simulated payment service
export const paymentService = {
  // Simulate payment processing
  async processPayment({ amount, orderId, paymentMethod = 'credit_card' }: CreatePaymentParams): Promise<{ success: boolean; message: string }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate 90% success rate
    const success = Math.random() > 0.1;
    
    if (success) {
      return {
        success: true,
        message: `Payment of $${(amount / 100).toFixed(2)} processed successfully`
      };
    } else {
      throw new Error('Payment simulation failed. Please try again.');
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
      // Simulate API key validation
      await new Promise(resolve => setTimeout(resolve, 1000));
      return key.startsWith('sk_') && key.length > 20;
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
