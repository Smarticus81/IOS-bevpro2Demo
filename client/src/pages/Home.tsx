import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DrinkMenu } from "@/components/DrinkMenu";
import { VoiceControl } from "@/components/VoiceControl";
import { OrderSummary } from "@/components/OrderSummary";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { Drink } from "@db/schema";

export function Home() {
  const [cart, setCart] = useState<Array<{ drink: Drink; quantity: number }>>([]);
  const { toast } = useToast();

  const { data: drinks = [] } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"],
  });

  const orderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      if (!response.ok) throw new Error("Failed to create order");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order placed successfully",
        description: "Your order has been placed successfully"
      });
      setCart([]);
    },
    onError: () => {
      toast({
        title: "Failed to place order",
        variant: "destructive"
      });
    }
  });

  const addToCart = (action: CartAction) => {
    if (action.type === 'ADD_ITEM') {
      const { drink, quantity } = action;
      setCart(prev => {
        const existing = prev.find(item => item.drink.id === drink.id);
        if (existing) {
          return prev.map(item => 
            item.drink.id === drink.id 
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [...prev, { drink, quantity }];
      });
    } else if (action.type === 'COMPLETE_TRANSACTION') {
      placeOrder();
    }
  };

  const removeFromCart = (drinkId: number) => {
    setCart(prev => prev.filter(item => item.drink.id !== drinkId));
  };

  const placeOrder = () => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => 
      sum + (item.drink.price * item.quantity), 0
    );

    const items = cart.map(item => ({
      id: item.drink.id,
      quantity: item.quantity,
      price: item.drink.price
    }));

    orderMutation.mutate({ items, total });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  Voice-Controlled Bar POS
                </h1>
                <VoiceControl 
                  drinks={drinks}
                  onAddToCart={addToCart}
                />
                <DrinkMenu 
                  drinks={drinks}
                  onAddToCart={addToCart}
                />
              </CardContent>
            </Card>
          </div>
          <div>
            <OrderSummary
              cart={cart}
              onRemoveItem={removeFromCart}
              onPlaceOrder={placeOrder}
              isLoading={orderMutation.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
