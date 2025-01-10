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
  const { cart, addToCart, removeFromCart, placeOrder, isProcessing } = useCart();
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200">
      <NavBar />

      {/* Voice Control Button - Fixed position for iPad mini landscape */}
      <div className="fixed bottom-6 right-6 z-[100] md:bottom-8 md:right-8">
        <VoiceControlButton />
      </div>

      <main className="container mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-8">
        {/* Main Content Grid - Optimized for iPad mini landscape */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8">
          {/* Category and Drinks Section */}
          <div className="md:col-span-9 space-y-6">
            {/* Categories Grid */}
            {!selectedCategory && (
              <motion.div 
                layout
                className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {categories.map((category) => (
                  <motion.div
                    key={category}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <button
                      onClick={() => setSelectedCategory(category)}
                      className="w-full h-full"
                    >
                      <Card className="border-2 border-primary/10 shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="p-4 md:p-6 bg-gradient-to-br from-white/95 to-white/90">
                          <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-primary/90 to-primary/80 flex items-center justify-center shadow-lg">
                              <span className="text-2xl md:text-3xl">
                                {category === 'Spirits' ? '🥃' :
                                 category === 'Beer' ? '🍺' :
                                 category === 'Wine' ? '🍷' :
                                 category === 'Signature' ? '🍸' :
                                 category === 'Classics' ? '🥂' :
                                 category === 'Non-Alcoholic' ? '🥤' : '🍹'}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-900 text-base md:text-lg">
                              {category}
                            </h3>
                            <Badge variant="secondary" className="bg-primary/5 text-primary text-sm">
                              {drinks.filter(d => d.category === category).length} items
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Back Button when category is selected */}
            {selectedCategory && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span className="text-lg">←</span>
                  Back to Categories
                </button>
              </motion.div>
            )}

            {/* Drinks Grid - Optimized for iPad mini landscape */}
            {selectedCategory && (
              <motion.div 
                layout
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
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
                        onRemove={() => removeFromCart(drink.id)}
                      />
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Order Summary - Desktop */}
          <div className="hidden md:block md:col-span-3">
            <div className="sticky top-24">
              <Card className="border-2 border-primary/10 shadow-xl bg-white/95 backdrop-blur-sm">
                <CardContent className="p-6">
                  <OrderSummary
                    cart={cart}
                    onRemoveItem={removeFromCart}
                    onPlaceOrder={placeOrder}
                    isLoading={isProcessing}
                    variant="default"
                    isCollapsed={isOrderSummaryCollapsed}
                    onToggleCollapse={() => setIsOrderSummaryCollapsed(!isOrderSummaryCollapsed)}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Order Summary - Mobile/Tablet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
            <div className="container mx-auto px-4 pb-safe">
              <Card className="border-t-2 border-primary/10 shadow-up bg-white/95 backdrop-blur-sm">
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