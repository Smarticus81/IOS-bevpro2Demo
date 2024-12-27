import { Switch, Route } from "wouter";
import { Home } from "@/pages/Home";
import { Inventory } from "@/pages/Inventory";
import { Events } from "@/pages/Events";
import { Settings } from "@/pages/Settings";
import { Dashboard } from "@/pages/Dashboard";
import { PaymentConfirmation } from "@/pages/PaymentConfirmation";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useState, useCallback } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { VoiceControlButton } from "@/components/VoiceControlButton";
import type { CartItem, AddToCartAction } from "@/types/speech";
import { useToast } from "@/hooks/use-toast";

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  // Cart management functions
  const handleAddToCart = useCallback((action: AddToCartAction) => {
    setCart(currentCart => {
      const existingItem = currentCart.find(item => item.drink.id === action.drink.id);
      if (existingItem) {
        return currentCart.map(item =>
          item.drink.id === action.drink.id
            ? { ...item, quantity: item.quantity + action.quantity }
            : item
        );
      }
      return [...currentCart, { drink: action.drink, quantity: action.quantity }];
    });
  }, []);

  const handleRemoveItem = useCallback((drinkId: number) => {
    setCart(currentCart => currentCart.filter(item => item.drink.id !== drinkId));
  }, []);

  const handlePlaceOrder = useCallback(async () => {
    try {
      // Implement actual order processing logic here
      const total = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);

      // For now, just clear cart and show success message
      setCart([]);
      toast({
        title: "Order Complete",
        description: JSON.stringify({
          status: "success",
          total: `$${total.toFixed(2)}`,
          items: cart.length
        }),
        duration: 3000,
      });
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: "Order Failed",
        description: JSON.stringify({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to process order"
        }),
        variant: "destructive",
      });
      throw error;
    }
  }, [cart, toast]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/events" component={Events} />
        <Route path="/settings" component={Settings} />
        <Route path="/payment-confirmation" component={PaymentConfirmation} />
        <Route component={NotFound} />
      </Switch>
      <VoiceControlButton 
        onAddToCart={handleAddToCart}
        onRemoveItem={handleRemoveItem}
        onPlaceOrder={handlePlaceOrder}
        cart={cart}
      />
    </>
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