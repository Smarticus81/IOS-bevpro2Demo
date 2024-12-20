import { useState, useCallback, useMemo } from "react";
import { DrinkCard } from "@/components/DrinkCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { VoiceControl } from "@/components/VoiceControl";
import { OrderSummary } from "@/components/OrderSummary";
import { VoiceFeedback } from "@/components/VoiceFeedback";
import OrderSummaryDrawer from "@/components/OrderSummaryDrawer";
import { PaymentDialog } from "@/components/PaymentDialog";
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
  const [isOrderSummaryCollapsed, setIsOrderSummaryCollapsed] = useState(false);
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

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [orderTotal, setOrderTotal] = useState(0);

  const placeOrder = async () => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => {
      const itemPrice = Number(item.drink.price);
      return sum + (itemPrice * item.quantity);
    }, 0);

    console.log('Initiating order:', {
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
      // Create the order first
      const orderResponse = await orderMutation.mutateAsync({ items, total });
      console.log('Order created successfully:', orderResponse);
      
      // Show payment dialog with total
      setOrderTotal(total);
      setShowPaymentDialog(true);
    } catch (error) {
      console.error('Failed to create order:', error);
      toast({
        title: "Order Creation Failed",
        description: "Unable to process your order. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-pearl-light to-pearl-dark">
      <NavBar drinks={drinks} onAddToCart={addToCart} />
      <VoiceFeedback 
        message={voiceMessage}
        isPlaying={isPlaying}
        voice="nova"
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
                    drinks={drinks}
                    onAddToCart={addToCart}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        total={orderTotal}
        onSuccess={() => {
          setShowPaymentDialog(false);
          setCart([]);
          toast({
            title: "Order Complete",
            description: "Your payment has been processed successfully.",
          });
        }}
      />
    </div>
  );
}
