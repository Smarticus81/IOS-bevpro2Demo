import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CreditCard } from "lucide-react";
import { paymentService } from "@/lib/paymentService";

interface PaymentFormProps {
  amount: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function PaymentForm({ amount, onSuccess, onError }: PaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const result = await paymentService.processPayment({
        amount,
        paymentMethod,
      });

      toast({
        title: "Payment successful",
        description: result.message,
      });
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Payment failed";
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

  return (
    <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={setPaymentMethod}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="apple_pay">Apple Pay</SelectItem>
                <SelectItem value="google_pay">Google Pay</SelectItem>
                <SelectItem value="qr_code">QR Code Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paymentMethod === "credit_card" && (
            <>
              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input placeholder="**** **** **** ****" disabled={isProcessing} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiration</Label>
                  <Input placeholder="MM/YY" disabled={isProcessing} />
                </div>
                <div className="space-y-2">
                  <Label>CVC</Label>
                  <Input placeholder="***" disabled={isProcessing} />
                </div>
              </div>
            </>
          )}

          {paymentMethod === "qr_code" && (
            <div className="space-y-2 text-center">
              <div className="p-8 bg-gray-100 rounded-lg">
                <div className="w-32 h-32 mx-auto bg-gray-300 animate-pulse rounded-lg" />
              </div>
              <p className="text-sm text-gray-500">Scan QR code to pay</p>
            </div>
          )}

          {(paymentMethod === "apple_pay" || paymentMethod === "google_pay") && (
            <div className="space-y-2 text-center p-4">
              <p className="text-sm text-gray-500">
                Click the button below to open {paymentMethod === "apple_pay" ? "Apple" : "Google"} Pay
              </p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isProcessing}
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