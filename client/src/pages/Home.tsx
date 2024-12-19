import { useState, useCallback, useMemo } from "react";
import { DrinkCard } from "@/components/DrinkCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DrinkMenu } from "@/components/DrinkMenu";
import { VoiceControl } from "@/components/VoiceControl";
import { OrderSummary } from "@/components/OrderSummary";
import { OrderSummaryDrawer } from "@/components/OrderSummaryDrawer";
import { VoiceFeedback } from "@/components/VoiceFeedback";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";
import { useToast } from "@/hooks/use-toast";
import type { Drink } from "@db/schema";

type CartAction = 
  | { type: 'ADD_ITEM'; drink: Drink; quantity: number }
  | { type: 'COMPLETE_TRANSACTION' };

export function Home() {
  const [cart, setCart] = useState<Array<{ drink: Drink; quantity: number }>>([]);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toast } = useToast();

  const playVoiceResponse = useCallback(async (message: string) => {
    setVoiceMessage(message);
    setIsPlaying(true);
    setTimeout(() => setIsPlaying(false), 5000);
  }, []);

  const { data: drinks = [] } = useQuery<Drink[]>({
    queryKey: ["/api/drinks"],
  });

  const categories = useMemo(() => 
    Array.from(new Set(drinks.map(drink => drink.category))).sort(),
    [drinks]
  );

  const filteredDrinks = useMemo(() => 
    drinks.filter(drink => !selectedCategory || drink.category === selectedCategory),
    [drinks, selectedCategory]
  );

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
      playVoiceResponse("Order placed successfully! Thank you for your order.");
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
          playVoiceResponse(`Updated ${drink.name} quantity to ${existing.quantity + quantity}`);
          return prev.map(item => 
            item.drink.id === drink.id 
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        playVoiceResponse(`Added ${drink.name} to your order`);
        return [...prev, { drink, quantity }];
      });
    } else if (action.type === 'COMPLETE_TRANSACTION') {
      placeOrder();
    }
  };

  const removeFromCart = (drinkId: number) => {
    setCart(prev => prev.filter(item => item.drink.id !== drinkId));
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => {
      const itemPrice = Number(item.drink.price);
      return sum + (itemPrice * item.quantity);
    }, 0);

    console.log('Placing order:', {
      cart,
      total,
      timestamp: new Date().toISOString()
    });

    const items = cart.map(item => ({
      id: item.drink.id,
      quantity: item.quantity,
      price: Number(item.drink.price)
    }));

    try {
      await orderMutation.mutateAsync({ items, total });
      console.log('Order placed successfully');
    } catch (error) {
      console.error('Failed to place order:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <NavBar />
      <VoiceFeedback 
        message={voiceMessage}
        isPlaying={isPlaying}
        voice="nova"
      />
      
      <main className="container mx-auto px-4 pt-20 pb-8 sm:px-6 lg:px-8">
        {/* Categories Scroll */}
        <div className="mb-6">
          <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300
                ${!selectedCategory 
                  ? 'bg-primary text-primary-foreground shadow-lg' 
                  : 'bg-white/80 dark:bg-black/80 text-foreground hover:bg-white/90 dark:hover:bg-black/90'
                }`}
            >
              All Drinks
            </button>
            {categories.map((category: string) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300
                  ${selectedCategory === category 
                    ? 'bg-primary text-primary-foreground shadow-lg' 
                    : 'bg-white/80 dark:bg-black/80 text-foreground hover:bg-white/90 dark:hover:bg-black/90'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
              {filteredDrinks.map((drink) => {
                const cartItem = cart.find(item => item.drink.id === drink.id);
                return (
                  <DrinkCard
                    key={drink.id}
                    drink={drink}
                    quantity={cartItem?.quantity || 0}
                    onAdd={() => addToCart({ type: 'ADD_ITEM', drink, quantity: 1 })}
                    onRemove={() => removeFromCart(drink.id)}
                  />
                );
              })}
            </div>
          </div>

          {/* Order Summary - Desktop */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <OrderSummary
                cart={cart}
                onRemoveItem={removeFromCart}
                onPlaceOrder={placeOrder}
                isLoading={orderMutation.isPending}
              />
            </div>
          </div>

          {/* Order Summary - Mobile */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t">
            <div className="container mx-auto p-4">
              <OrderSummaryDrawer
                cart={cart}
                onRemoveItem={removeFromCart}
                onPlaceOrder={placeOrder}
                isLoading={orderMutation.isPending}
              />
            </div>
          </div>
        </div>

        {/* Voice Control */}
        <div className="fixed bottom-20 lg:bottom-8 left-1/2 -translate-x-1/2 z-30">
          <Card className="bg-background/95 backdrop-blur-lg border-white/20">
            <CardContent className="p-4">
              <VoiceControl 
                drinks={drinks}
                onAddToCart={addToCart}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
