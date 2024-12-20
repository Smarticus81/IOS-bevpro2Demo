import { useState, useEffect } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface PaymentFormProps {
  amount: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export function PaymentFormWrapper(props: PaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string>();

  // Create PaymentIntent when the component mounts
  useEffect(() => {
    fetch("/api/payment/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: props.amount })
    })
      .then(res => res.json())
      .then(data => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else if (data.error) {
          props.onError?.(data.message || "Failed to initialize payment");
        }
      })
      .catch(error => {
        props.onError?.(error.message || "Failed to initialize payment");
      });
  }, [props.amount, props.onError]);

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm {...props} />
    </Elements>
  );
}

function PaymentForm({ amount, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-confirmation`,
        },
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Payment successful",
        description: "Your payment has been processed successfully.",
      });
      
      onSuccess?.();
    } catch (error) {
      console.error("Payment error:", error);
      const message = error instanceof Error ? error.message : "Payment failed";
      toast({
        title: "Payment failed",
        description: message,
        variant: "destructive",
      });
      onError?.(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <PaymentElement />
          <Button
            type="submit"
            disabled={!stripe || isProcessing}
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
      </CardContent>
    </Card>
  );
}
