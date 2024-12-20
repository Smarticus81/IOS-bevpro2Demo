import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";
import { PaymentMethodCarousel } from "@/components/PaymentMethodCarousel";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Initialize Stripe with fallback for development
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

// Flag to indicate if we're in simulation mode
const isSimulationMode = !stripePromise;

interface PaymentFormProps {
  amount: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  simulatePayment?: boolean;
}

function PaymentFormContent({ amount, onSuccess, onError }: PaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [clientSecret, setClientSecret] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  useEffect(() => {
    if (isSimulationMode) {
      return; // Skip payment intent creation in simulation mode
    }

    // Create PaymentIntent as soon as the page loads
    fetch("/api/payment/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json();
          if (res.status === 503) {
            // Payment service unavailable - switch to simulation mode
            console.info('Payment service unavailable, running in simulation mode');
            return null;
          }
          throw new Error(errorData.message || 'Failed to initialize payment');
        }
        return res.json();
      })
      .then((data) => {
        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
          setErrorMessage("");
        }
      })
      .catch((err) => {
        console.error('Payment initialization error:', err);
        setErrorMessage(err.message);
        toast({
          title: "Error",
          description: err.message || "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
      });
  }, [amount, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSimulationMode) {
      setIsProcessing(true);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate 90% success rate
      const success = Math.random() > 0.1;
      
      if (success) {
        toast({
          title: "Payment simulated",
          description: `Simulated payment of $${(amount / 100).toFixed(2)} processed successfully`
        });
        onSuccess?.();
      } else {
        const errorMessage = "Simulated payment failure";
        toast({
          title: "Payment failed",
          description: errorMessage,
          variant: "destructive"
        });
        onError?.(errorMessage);
      }
      
      setIsProcessing(false);
      return;
    }

    if (!stripe || !elements) {
      toast({
        title: "Payment unavailable",
        description: "Payment processing is currently unavailable. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message || "Failed to process payment form");
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-confirmation`,
          payment_method_data: {
            billing_details: {
              address: {
                country: 'US',
              },
            },
          },
        },
      });

      if (confirmError) {
        // Handle specific Stripe errors
        switch (confirmError.type) {
          case 'card_error':
            throw new Error('Your card was declined. Please try another payment method.');
          case 'validation_error':
            throw new Error('Please check your card details and try again.');
          default:
            throw new Error(confirmError.message || 'Payment failed');
        }
      }

      // Note: This won't actually be reached as confirmPayment will redirect on success
      toast({
        title: "Processing payment",
        description: "Please wait while we process your payment...",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Payment failed";
      console.error('Payment error:', error);
      toast({
        title: "Payment failed",
        description: errorMessage,
        variant: "destructive",
      });
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentMethodCarousel
        selectedMethod={paymentMethod}
        onSelect={setPaymentMethod}
      />

      <div className="space-y-6">
        <PaymentElement 
          className="payment-element"
          options={{
            layout: "tabs",
            wallets: {
              applePay: 'auto',
              googlePay: 'auto'
            }
          }}
        />
        <p className="text-sm text-gray-500 text-center">
          Payment is securely processed by Stripe
        </p>
      </div>

      <Button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className="w-full bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm 
                  hover:shadow-lg hover:from-zinc-700 hover:to-black 
                  active:scale-[0.99] transform transition-all duration-200"
      >
        {isProcessing ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </div>
        ) : (
          `Pay $${(amount / 100).toFixed(2)}`
        )}
      </Button>
    </form>
  );
}

export function PaymentForm(props: PaymentFormProps) {
  const options = {
    mode: 'payment' as const,
    amount: props.amount,
    currency: 'usd',
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#18181b',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        borderRadius: '0.5rem',
        spacingUnit: '4px',
      },
    },
    payment_method_types: ['card', 'us_bank_account'],
    currency_code: 'USD',
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
      <CardHeader>
        <CardTitle id="payment-form-title" className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </CardTitle>
        <p id="payment-form-description" className="text-sm text-gray-600">
          Enter your payment information to complete the transaction
        </p>
      </CardHeader>
      <CardContent aria-labelledby="payment-form-title" aria-describedby="payment-form-description">
        {stripePromise ? (
          <Elements stripe={stripePromise} options={options}>
            <PaymentFormContent {...props} />
          </Elements>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-4">
              Payment processing is in simulation mode. Stripe integration is not configured.
            </p>
            <Button
              onClick={() => props.onSuccess?.()}
              className="w-full bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm 
                        hover:shadow-lg hover:from-zinc-700 hover:to-black 
                        active:scale-[0.99] transform transition-all duration-200"
            >
              Simulate Payment of ${(props.amount / 100).toFixed(2)}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}