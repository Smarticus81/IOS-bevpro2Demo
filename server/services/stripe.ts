import Stripe from 'stripe';
import { z } from 'zod';

// Custom error class for Stripe initialization issues
export class StripeUninitializedError extends Error {
  constructor(message: string = 'Stripe is not initialized. Please set up your Stripe API key in the settings.') {
    super(message);
    this.name = 'StripeUninitializedError';
  }
}

let stripe: Stripe | null = null;

function initializeStripe(): Stripe | null {
  // In development, allow the service to run without Stripe
  if (process.env.NODE_ENV === 'development' && !process.env.STRIPE_SECRET_KEY) {
    console.info('Running in development mode without Stripe integration');
    return null;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY not set - payment simulation mode enabled');
    return null;
  }

  try {
    return new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to initialize Stripe client:', err);
    return null;
  }
}

// Initialize stripe client
stripe = initializeStripe();

// Function to reinitialize stripe when key is updated
export function reinitializeStripe(): boolean {
  stripe = initializeStripe();
  return stripe !== null;
}

export const paymentIntentSchema = z.object({
  amount: z.number().min(1),
  currency: z.enum(['usd']).default('usd'),
  payment_method_types: z.array(z.string()).default(['card']),
  metadata: z.record(z.string()).optional(),
});

export type PaymentIntentRequest = z.infer<typeof paymentIntentSchema>;

function checkStripeInitialized(): Stripe {
  if (!stripe) {
    throw new StripeUninitializedError();
  }
  return stripe;
}

export async function createPaymentIntent(data: PaymentIntentRequest) {
  try {
    const stripeClient = checkStripeInitialized();
    const validated = paymentIntentSchema.parse(data);
    
    const paymentIntent = await stripeClient.paymentIntents.create({
      amount: Math.round(validated.amount * 100), // Convert to cents
      currency: validated.currency,
      payment_method_types: validated.payment_method_types,
      metadata: validated.metadata,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
    };
  } catch (error: unknown) {
    if (error instanceof StripeUninitializedError) {
      console.warn('Payment features unavailable - Stripe not initialized');
      throw error;
    }
    
    const err = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating payment intent:', err);
    throw new Error('Failed to create payment intent');
  }
}

export async function retrievePaymentIntent(id: string) {
  try {
    const stripeClient = checkStripeInitialized();
    return await stripeClient.paymentIntents.retrieve(id);
  } catch (error: unknown) {
    if (error instanceof StripeUninitializedError) {
      throw error;
    }
    const err = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error retrieving payment intent:', err);
    throw new Error('Failed to retrieve payment intent');
  }
}

export async function createCustomer(email: string, metadata?: Record<string, string>) {
  try {
    const stripeClient = checkStripeInitialized();
    return await stripeClient.customers.create({
      email,
      metadata,
    });
  } catch (error: unknown) {
    if (error instanceof StripeUninitializedError) {
      throw error;
    }
    const err = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating customer:', err);
    throw new Error('Failed to create customer');
  }
}

export async function attachPaymentMethod(customerId: string, paymentMethodId: string) {
  try {
    const stripeClient = checkStripeInitialized();
    const paymentMethod = await stripeClient.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    return paymentMethod;
  } catch (error: unknown) {
    if (error instanceof StripeUninitializedError) {
      throw error;
    }
    const err = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error attaching payment method:', err);
    throw new Error('Failed to attach payment method');
  }
}
