import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

export function PaymentConfirmation() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Get the payment intent ID and status from the URL
    const params = new URLSearchParams(window.location.search);
    const paymentIntentId = params.get("payment_intent");
    const redirectStatus = params.get("redirect_status");
    const paymentIntentClientSecret = params.get("payment_intent_client_secret");

    if (!paymentIntentId || !paymentIntentClientSecret) {
      setStatus("error");
      setMessage("Missing payment information");
      return;
    }

    // Check the payment status
    fetch(`/api/payment/intent/${paymentIntentId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to verify payment');
        return res.json();
      })
      .then(data => {
        switch (data.status) {
          case "succeeded":
            setStatus("success");
            setMessage("Thank you! Your payment has been processed successfully.");
            break;
          case "processing":
            setStatus("loading");
            setMessage("Your payment is being processed. We'll update you once it's complete.");
            // Poll for updates
            const pollInterval = setInterval(async () => {
              try {
                const response = await fetch(`/api/payment/intent/${paymentIntentId}`);
                const updatedData = await response.json();
                if (updatedData.status === "succeeded") {
                  clearInterval(pollInterval);
                  setStatus("success");
                  setMessage("Thank you! Your payment has been processed successfully.");
                } else if (updatedData.status === "canceled" || updatedData.status === "requires_payment_method") {
                  clearInterval(pollInterval);
                  setStatus("error");
                  setMessage("Payment was unsuccessful. Please try again.");
                }
              } catch (error) {
                clearInterval(pollInterval);
                console.error("Error polling payment status:", error);
              }
            }, 2000);
            return () => clearInterval(pollInterval);
          case "requires_payment_method":
            setStatus("error");
            setMessage("Your payment was declined. Please try another payment method.");
            break;
          case "canceled":
            setStatus("error");
            setMessage("The payment was canceled. Please try again.");
            break;
          default:
            setStatus("error");
            setMessage(data.last_payment_error?.message || "Payment could not be completed");
        }
      })
      .catch(error => {
        console.error("Payment verification error:", error);
        setStatus("error");
        setMessage("Failed to verify payment status. Please contact support if you were charged.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      
      <div className="container mx-auto p-4 lg:p-8">
        <div className="flex justify-center items-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <h2 className="text-xl font-semibold">Verifying Payment</h2>
                      <p className="text-gray-600">Please wait while we confirm your payment...</p>
                    </>
                  ) : status === "success" ? (
                    <>
                      <CheckCircle2 className="h-12 w-12 text-green-500" />
                      <h2 className="text-xl font-semibold text-green-700">Payment Successful!</h2>
                      <p className="text-gray-600">{message}</p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-12 w-12 text-red-500" />
                      <h2 className="text-xl font-semibold text-red-700">Payment Failed</h2>
                      <p className="text-gray-600">{message}</p>
                    </>
                  )}

                  <Button
                    onClick={() => setLocation("/")}
                    className="mt-6 bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm 
                             hover:shadow-lg hover:from-zinc-700 hover:to-black 
                             active:scale-[0.99] transform transition-all duration-200"
                  >
                    Return to Home
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
