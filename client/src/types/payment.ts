import { z } from 'zod';

export const paymentIntentSchema = z.object({
  clientSecret: z.string(),
  id: z.string(),
  status: z.string(),
});

export const paymentMethodSchema = z.object({
  id: z.string(),
  type: z.string(),
  provider: z.string(),
  display_name: z.string(),
  enabled: z.boolean(),
});

export interface CreatePaymentParams {
  amount: number;
  orderId?: number;
  customerEmail?: string;
  currency?: string;
}

export type PaymentIntent = z.infer<typeof paymentIntentSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
