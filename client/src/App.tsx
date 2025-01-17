import { Switch, Route } from "wouter";
import { Home } from "@/pages/Home";
import { Inventory } from "@/pages/Inventory";
import { PaymentConfirmation } from "@/pages/PaymentConfirmation";
import { DatabaseView } from "@/pages/Database";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { CartProvider } from "@/contexts/CartContext";
import { OrderSummaryDrawer } from "@/components/OrderSummaryDrawer";
import { useWebSocket } from "@/hooks/useWebSocket";

function App() {
  // Initialize WebSocket connection for real-time updates
  useWebSocket();

  return (
    <CartProvider>
      <Switch>
        {/* Core POS and Inventory routes */}
        <Route path="/" component={Home} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/payment-confirmation" component={PaymentConfirmation} />
        <Route path="/database" component={DatabaseView} />
        <Route component={NotFound} />
      </Switch>
      <OrderSummaryDrawer />
    </CartProvider>
  );
}

// fallback 404 not found page
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