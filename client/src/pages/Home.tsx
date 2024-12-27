import { useState, useCallback, useMemo } from "react";
import { DrinkCard } from "@/components/DrinkCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { VoiceControlButton } from "@/components/VoiceControlButton";
import { OrderSummary } from "@/components/OrderSummary";
import OrderSummaryDrawer from "@/components/OrderSummaryDrawer";
import { Card, CardContent } from "@/components/ui/card";
import { NavBar } from "@/components/NavBar";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "@/types/models";

type CartAction = 
  | { type: 'ADD_ITEM'; drink: Drink; quantity: number }
  | { type: 'COMPLETE_TRANSACTION' };

export function Home() {
  const [cart, setCart] = useState<Array<{ drink: Drink; quantity: number }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isOrderSummaryCollapsed, setIsOrderSummaryCollapsed] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const { toast } = useToast();

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
    },
    onError: () => {
      toast({
        title: "Failed to place order",
        variant: "destructive"
      });
    }
  });

  const addToCart = useCallback((action: CartAction) => {
    console.log('Adding to cart:', action);
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
  }, [setCart]); 

  const removeFromCart = useCallback((drinkId: number) => {
    console.log('Removing from cart:', drinkId);
    setCart(prev => prev.filter(item => item.drink.id !== drinkId));
  }, [setCart]);

  const placeOrder = useCallback(async () => {
    if (cart.length === 0) {
      console.log('Attempted to place empty order');
      toast({
        title: "Empty Order",
        description: "Please add items to your cart first",
        variant: "destructive"
      });
      return;
    }

    console.log('Initiating order placement:', {
      cartItems: cart.length,
      timestamp: new Date().toISOString()
    });

    const total = cart.reduce((sum, item) => {
      const itemPrice = Number(item.drink.price);
      return sum + (itemPrice * item.quantity);
    }, 0);

    const items = cart.map(item => ({
      id: item.drink.id,
      quantity: item.quantity,
      price: Number(item.drink.price)
    }));

    try {
      console.log('Submitting order to backend...');
      await orderMutation.mutateAsync({ items, total });
      console.log('Order submitted successfully');
      setCart([]);
      console.log('Cart cleared');
      toast({
        title: "Order Completed",
        description: "Your order has been placed successfully!",
      });
    } catch (error) {
      console.error('Order placement failed:', error);
      toast({
        title: "Failed to place order",
        description: "There was an error processing your order. Please try again.",
        variant: "destructive"
      });
    }
  }, [cart, orderMutation, setCart, toast]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-pearl-light to-pearl-dark">
      <NavBar drinks={drinks} />
      <VoiceControlButton 
        onAddToCart={addToCart}
        onRemoveItem={removeFromCart}
        onPlaceOrder={placeOrder}
        cart={cart}
        setIsProcessingVoice={setIsProcessingVoice}
      />
      <main className="px-4 pt-4 pb-8 sm:px-6 lg:px-8">
        {/* Category Selector */}
        <div className="flex overflow-x-auto gap-2 py-2 mb-4 -mx-4 px-4 scrollbar-hide">
          <motion.button
            onClick={() => setSelectedCategory(null)}
            className={`
              shrink-0 px-4 h-8
              flex items-center gap-2
              text-sm font-medium
              rounded-full
              transition-all duration-300
              bg-white/80 hover:bg-white/90
              shadow-sm hover:shadow-md
              ${!selectedCategory ? 
                'ring-1 ring-primary text-primary scale-105' : 
                'text-gray-600 hover:text-gray-800'}
            `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-base">🍷</span>
            <span className="text-xs font-medium">All</span>
          </motion.button>

          {categories.map((category: string) => (
            <motion.button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`
                shrink-0 px-4 h-8
                flex items-center gap-2
                text-sm font-medium
                rounded-full
                transition-all duration-300
                bg-white/80 hover:bg-white/90
                shadow-sm hover:shadow-md
                ${selectedCategory === category ?
                  'ring-1 ring-primary text-primary scale-105' :
                  'text-gray-600 hover:text-gray-800'}
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="text-base">
                {category === 'Spirits' ? '🥃' :
                 category === 'Beer' ? '🍺' :
                 category === 'Wine' ? '🍷' :
                 category === 'Signature' ? '🍸' :
                 category === 'Classics' ? '🥂' :
                 category === 'Non-Alcoholic' ? '🥤' : '🍹'}
              </span>
              <span className="text-xs font-medium">{category}</span>
            </motion.button>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            {/* Drinks Grid */}
            <motion.div 
              layout
              className="grid grid-cols-2 gap-3 sm:gap-4"
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
              <Card className="glass-effect premium-shadow">
                <CardContent className="p-6">
                  <OrderSummary
                    cart={cart}
                    onRemoveItem={removeFromCart}
                    onPlaceOrder={placeOrder}
                    isLoading={orderMutation.isPending}
                    isProcessingVoice={isProcessingVoice}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Order Summary - Mobile */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
            <div className="container mx-auto px-4 pb-safe">
              <Card className="glass-morphism border-white/20 shadow-lg">
                <CardContent className="p-4">
                  <OrderSummaryDrawer
                    cart={cart}
                    onRemoveItem={removeFromCart}
                    onPlaceOrder={placeOrder}
                    isLoading={orderMutation.isPending}
                    isProcessingVoice={isProcessingVoice}
                    drinks={drinks}
                    onAddToCart={addToCart}
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