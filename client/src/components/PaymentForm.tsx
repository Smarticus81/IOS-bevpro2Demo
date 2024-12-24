import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard } from "lucide-react";
import { paymentService } from "@/lib/paymentService";

interface PaymentFormProps {
  amount: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function PaymentForm({ amount, onSuccess, onError }: PaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      console.log('Submitting payment:', {
        amount,
        timestamp: new Date().toISOString()
      });

      // Validate payment amount
      if (!amount || amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      // Process payment
      const result = await paymentService.processPayment({
        amount,
        paymentMethod: 'direct'
      });

      if (result.success) {
        console.log('Payment successful:', {
          amount,
          transactionId: result.transactionId,
          timestamp: new Date().toISOString()
        });

        toast({
          title: "Payment successful",
          description: result.message
        });

        onSuccess?.();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Payment form error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });

      const errorMessage = error instanceof Error ? error.message : "Payment failed";

      toast({
        title: "Payment failed",
        description: errorMessage,
        variant: "destructive"
      });

      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Button
            type="submit"
            disabled={isProcessing || !amount || amount <= 0}
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