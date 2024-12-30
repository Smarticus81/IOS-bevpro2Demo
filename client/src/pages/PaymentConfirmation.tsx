import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { NavBar } from "@/components/NavBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export function PaymentConfirmation() {
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");

  useEffect(() => {
    // In demo mode, always show success
    setMessage("Thank you! Your payment has been processed successfully.");
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
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <h2 className="text-xl font-semibold text-green-700">Payment Successful!</h2>
                  <p className="text-gray-600">{message}</p>

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