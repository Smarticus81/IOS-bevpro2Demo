import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface CreatePaymentIntentParams {
  amount: number;
  orderId?: string;
  customerEmail?: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  provider: string;
  display_name: string;
}

export const paymentService = {
  async createPaymentIntent({ amount, orderId, customerEmail }: CreatePaymentIntentParams) {
    const response = await fetch("/api/payment/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, orderId, customerEmail }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create payment intent");
    }

    return response.json();
  },

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await fetch("/api/payment-methods");
    if (!response.ok) {
      throw new Error("Failed to fetch payment methods");
    }
    return response.json();
  },

  async validateStripeKey(key: string): Promise<boolean> {
    try {
      const response = await fetch('/api/settings/stripe-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  getStripe() {
    return stripePromise;
  }
};
