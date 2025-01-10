import { useState, useMemo } from "react";
import { DrinkCard } from "@/components/DrinkCard";
import { useQuery } from "@tanstack/react-query";
import { VoiceControlButton } from "@/components/VoiceControlButton";
import { OrderSummary } from "@/components/OrderSummary";
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
  const { cart, addToCart, removeItem: removeFromCart, placeOrder, isProcessing } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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
    <div className="h-screen bg-gray-50 flex flex-col">
      <NavBar />
      <div className="fixed top-4 right-4 z-50">
        <VoiceControlButton />
      </div>

      <main className="flex-1 flex">
        {/* Left Side - Menu */}
        <div className="w-1/2 p-4 overflow-y-auto">
          {/* Categories Grid */}
          {!selectedCategory && (
            <motion.div 
              layout
              className="grid grid-cols-3 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {categories.map((category) => (
                <motion.div
                  key={category}
                  className="relative"
                >
                  <button
                    onClick={() => setSelectedCategory(category)}
                    className="w-full h-full"
                  >
                    <Card className="overflow-hidden border-0">
                      <CardContent className="p-4 bg-white">
                        <div className="flex flex-col items-center text-center space-y-3">
                          <span className="text-3xl">
                            {category === 'Spirits' ? '🥃' :
                             category === 'Beer' ? '🍺' :
                             category === 'Wine' ? '🍷' :
                             category === 'Signature' ? '🍸' :
                             category === 'Classics' ? '🥂' :
                             category === 'Non-Alcoholic' ? '🥤' : '🍹'}
                          </span>
                          <h3 className="font-semibold text-gray-900">
                            {category}
                          </h3>
                          <Badge variant="secondary" className="bg-gray-100">
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-4"
            >
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Categories
              </button>
            </motion.div>
          )}

          {/* Drinks Grid */}
          {selectedCategory && (
            <motion.div 
              layout
              className="grid grid-cols-3 gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
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

        {/* Right Side - Order Summary */}
        <div className="w-1/2 border-l border-gray-200 p-4 bg-white">
          <OrderSummary
            cart={cart}
            onRemoveItem={removeFromCart}
            onPlaceOrder={placeOrder}
            isLoading={isProcessing}
            variant="default"
          />
        </div>
      </main>
    </div>
  );
}