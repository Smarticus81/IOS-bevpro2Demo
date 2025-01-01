import { Switch, Route, useRoute, useLocation } from "wouter";
import { Home } from "@/pages/Home";
import { Inventory } from "@/pages/Inventory";
import { Events } from "@/pages/Events";
import { Settings } from "@/pages/Settings";
import { Dashboard } from "@/pages/Dashboard";
import { PaymentConfirmation } from "@/pages/PaymentConfirmation";
import VoiceTutorialPage from "@/pages/VoiceTutorialPage";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { VoiceControlButton } from "@/components/VoiceControlButton";
import { CartProvider } from "@/contexts/CartContext";
import { OrderSummaryDrawer } from "@/components/OrderSummaryDrawer";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [, setLocation] = useLocation();
  const [paymentFailedMatch] = useRoute("/payment-failed");

  // Navigation guard for payment failed route
  useEffect(() => {
    if (paymentFailedMatch) {
      // In demo mode, redirect all payment failed attempts to success
      setLocation(`/payment-confirmation?transaction=demo-${Date.now()}`);
    }
  }, [paymentFailedMatch, setLocation]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <CartProvider>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/events" component={Events} />
        <Route path="/settings" component={Settings} />
        <Route path="/payment-confirmation" component={PaymentConfirmation} />
        <Route path="/voice-tutorial" component={VoiceTutorialPage} />
        <Route component={NotFound} />
      </Switch>
      <OrderSummaryDrawer />
      <VoiceControlButton />
    </CartProvider>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            The page you're looking for doesn't exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;