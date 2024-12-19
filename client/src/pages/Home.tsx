import { useState, useCallback, useMemo } from "react";
import { DrinkCard } from "@/components/DrinkCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { VoiceControl } from "@/components/VoiceControl";
import { OrderSummary } from "@/components/OrderSummary";
import { VoiceFeedback } from "@/components/VoiceFeedback";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="min-h-screen bg-pearl-light">
      <NavBar />
      <VoiceFeedback 
        message={voiceMessage}
        isPlaying={isPlaying}
        voice="nova"
      />
      
      <main className="container mx-auto px-4 pt-16 pb-8 sm:px-6 lg:px-8">
        {/* Premium Status Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-white/80 backdrop-blur-sm">
              Premium POS
            </Badge>
            <span className="text-sm font-medium text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary">
              Active Orders: {cart.length}
            </Badge>
          </div>
        </div>
        {/* Premium Category Selector */}
        <div className="relative mb-8">
          <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide">
            <motion.button
              onClick={() => setSelectedCategory(null)}
              className={`shrink-0 px-8 py-3 rounded-xl text-sm font-medium transition-all duration-300
                bg-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-sm
                ${!selectedCategory ? 'ring-2 ring-primary/20 text-primary' : 'text-gray-700 hover:text-gray-900'}`}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              All Drinks
            </motion.button>
            {categories.map((category: string) => (
              <motion.button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`shrink-0 px-8 py-3 rounded-xl text-sm font-medium transition-all duration-300
                  bg-white shadow-lg hover:shadow-xl border border-white/20 backdrop-blur-sm
                  ${selectedCategory === category ? 'ring-2 ring-primary/20 text-primary' : 'text-gray-700 hover:text-gray-900'}`}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                {category}
              </motion.button>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            {/* Drinks Grid */}
            <motion.div 
              layout
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6"
            >
              <AnimatePresence>
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
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Order Summary - Desktop */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <Card className="backdrop-blur-xl bg-white/90 border-white/20">
                <CardContent className="p-6">
                  <OrderSummary
                    cart={cart}
                    onRemoveItem={removeFromCart}
                    onPlaceOrder={placeOrder}
                    isLoading={orderMutation.isPending}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Voice Control - Desktop */}
          <div className="hidden lg:block fixed right-8 top-24 z-50">
            <Card className="bg-white/95 backdrop-blur-lg border-white/20 shadow-lg">
              <CardContent className="p-4">
                <VoiceControl 
                  drinks={drinks}
                  onAddToCart={addToCart}
                />
              </CardContent>
            </Card>
          </div>

          {/* Voice Control - Mobile */}
          <div className="lg:hidden fixed left-1/2 -translate-x-1/2 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50">
            <Card className="bg-white/95 backdrop-blur-lg border-white/20 shadow-lg">
              <CardContent className="p-3">
                <VoiceControl 
                  drinks={drinks}
                  onAddToCart={addToCart}
                />
              </CardContent>
            </Card>
          </div>

          {/* Order Summary - Mobile */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
            <div className="container mx-auto p-4">
              <Card className="glass-morphism border-white/20">
                <CardContent className="p-4">
                  <OrderSummary
                    cart={cart}
                    onRemoveItem={removeFromCart}
                    onPlaceOrder={placeOrder}
                    isLoading={orderMutation.isPending}
                    variant="compact"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
