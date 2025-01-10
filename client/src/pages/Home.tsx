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

interface DrinksResponse {
  drinks: Drink[];
  pagination: {
    currentPage: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

export function Home() {
  const { cart, addToCart, removeItem, placeOrder, isProcessing } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isOrderSummaryCollapsed, setIsOrderSummaryCollapsed] = useState(false);

  const { data } = useQuery<DrinksResponse>({
    queryKey: ["/api/drinks"],
  });

  const drinks = data?.drinks || [];
  const categories = useMemo(() => 
    Array.from(new Set(drinks.map(drink => drink.category))).sort(),
    [drinks]
  );

  const filteredDrinks = useMemo(() => 
    drinks.filter(drink => !selectedCategory || drink.category === selectedCategory),
    [drinks, selectedCategory]
  );

  return (
    <div className="min-h-screen bg-pearl-light">
      <NavBar />

      {/* Main Container - Split for iPad mini landscape */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Menu Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto px-4 py-4">
            {/* Categories Grid */}
            {!selectedCategory && (
              <motion.div 
                layout
                className="grid grid-cols-2 md:grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {categories.map((category) => (
                  <motion.button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className="h-full"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card className="border border-primary/10 shadow-glass hover:shadow-premium transition-all duration-300">
                      <CardContent className="p-4 bg-white/95">
                        <div className="flex flex-col items-center text-center space-y-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/90 to-primary/80 flex items-center justify-center shadow-lg">
                            <span className="text-2xl">
                              {category === 'Spirits' ? '🥃' :
                               category === 'Beer' ? '🍺' :
                               category === 'Wine' ? '🍷' :
                               category === 'Signature' ? '🍸' :
                               category === 'Classics' ? '🥂' :
                               category === 'Non-Alcoholic' ? '🥤' : '🍹'}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900">
                            {category}
                          </h3>
                          <Badge variant="secondary" className="bg-primary/5 text-primary">
                            {drinks.filter(d => d.category === category).length} items
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Back Button */}
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="text-lg">←</span>
                Back to Categories
              </button>
            )}

            {/* Drinks Grid */}
            {selectedCategory && (
              <motion.div 
                layout
                className="grid grid-cols-2 md:grid-cols-3 gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
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
                        onRemove={() => removeItem(drink.id)}
                      />
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Panel - Order Summary (Landscape) */}
        <div className="hidden md:block w-[360px] border-l border-gray-200 bg-white shadow-lg">
          <div className="h-full p-4">
            <OrderSummary
              cart={cart}
              onRemoveItem={removeItem}
              onPlaceOrder={placeOrder}
              isLoading={isProcessing}
              variant="default"
              isCollapsed={isOrderSummaryCollapsed}
              onToggleCollapse={() => setIsOrderSummaryCollapsed(!isOrderSummaryCollapsed)}
            />
          </div>
        </div>

        {/* Mobile Order Summary Panel */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
          <div className="px-4 pb-safe">
            <Card className="border-t border-primary/10 shadow-up bg-white/95 backdrop-blur-sm">
              <CardContent className="p-4">
                <OrderSummaryDrawer />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Voice Control Button - Optimized position for iPad mini landscape */}
        <div className="fixed bottom-24 right-4 z-[100] md:bottom-6 md:right-[380px]">
          <VoiceControlButton />
        </div>
      </div>
    </div>
  );
}