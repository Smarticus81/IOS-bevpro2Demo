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

      <main className="container mx-auto px-4 pt-4 pb-8 sm:px-6 lg:px-8">
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Category and Drinks Section */}
          <div className="lg:col-span-3 space-y-8">
            {/* Categories Grid */}
            {!selectedCategory && (
              <motion.div 
                layout
                className="grid grid-cols-2 sm:grid-cols-3 gap-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {categories.map((category) => (
                  <motion.div
                    key={category}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative"
                  >
                    <button
                      onClick={() => setSelectedCategory(category)}
                      className="w-full h-full"
                    >
                      <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                        <CardContent className="p-6 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-md">
                          <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-xl transform transition-transform border border-white/10">
                              <span className="text-3xl">
                                {category === 'Spirits' ? '🥃' :
                                 category === 'Beer' ? '🍺' :
                                 category === 'Wine' ? '🍷' :
                                 category === 'Signature' ? '🍸' :
                                 category === 'Classics' ? '🥂' :
                                 category === 'Non-Alcoholic' ? '🥤' : '🍹'}
                              </span>
                            </div>
                            <h3 className="font-semibold text-gray-900">{category}</h3>
                            <Badge variant="secondary" className="bg-gray-100/80">
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
                className="mb-6"
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

            {/* Drinks Grid - Only show when category is selected */}
            {selectedCategory && (
              <motion.div 
                layout
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4"
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
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <Card className="glass-effect premium-shadow backdrop-blur-md border-white/20">
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
              <Card className="glass-morphism border-white/20 shadow-lg backdrop-blur-md">
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