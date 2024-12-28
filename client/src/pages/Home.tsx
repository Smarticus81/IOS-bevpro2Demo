import { useState, useMemo } from "react";
import { DrinkCard } from "@/components/DrinkCard";
import { useQuery } from "@tanstack/react-query";
import { VoiceControlButton } from "@/components/VoiceControlButton";
import { OrderSummary } from "@/components/OrderSummary";
import { OrderSummaryDrawer } from "@/components/OrderSummaryDrawer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";
import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "@db/schema";
import { useCart } from "@/contexts/CartContext";

export function Home() {
  const { cart, addToCart, removeItem: removeFromCart, placeOrder, isProcessing } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isOrderSummaryCollapsed, setIsOrderSummaryCollapsed] = useState(false);

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

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-50 via-pearl-light to-pearl-dark">
      <NavBar />
      <VoiceControlButton />

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

          {categories.map((category) => (
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
                    isLoading={isProcessing}
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
                  <OrderSummaryDrawer />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}