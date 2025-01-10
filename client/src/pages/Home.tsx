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
import type { CartItem } from "@/types/cart";

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
  const [selectedTier, setSelectedTier] = useState<string | null>("All Products");

  const { data } = useQuery<DrinksResponse>({
    queryKey: ["/api/drinks"],
  });

  const drinks = data?.drinks || [];

  const tiers = [
    { name: 'Silver' },
    { name: 'Gold' },
    { name: 'Platinum' },
    { name: 'Diamond' },
    { name: 'Cashbar' },
    { name: 'Tips' },
    { name: 'All Products' }
  ];

  const categories = useMemo(() => 
    Array.from(new Set(drinks.map(drink => drink.category))).sort(),
    [drinks]
  );

  const filteredDrinks = useMemo(() => 
    drinks.filter(drink => !selectedCategory || drink.category === selectedCategory),
    [drinks, selectedCategory]
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <NavBar />
      <div className="fixed top-4 right-4 z-50">
        <VoiceControlButton />
      </div>

      <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left Side - Menu */}
        <div className="w-1/2 flex flex-col h-full">
          {/* Tiers Selection */}
          <div className="bg-white border-b border-gray-200">
            <div className="overflow-x-auto scrollbar-hide whitespace-nowrap py-2 px-4">
              <div className="inline-flex gap-4">
                {tiers.map((tier) => (
                  <button
                    key={tier.name}
                    onClick={() => setSelectedTier(tier.name)}
                    className={`
                      transition-colors duration-200
                      font-medium
                      ${selectedTier === tier.name 
                        ? 'text-gray-900' 
                        : 'text-gray-500 hover:text-gray-700'}
                    `}
                  >
                    {tier.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Menu Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
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
                        <Card className="border">
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
                      const cartItem = cart.find((item: CartItem) => item.drink.id === drink.id);
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
          </div>
        </div>

        {/* Right Side - Order Summary with fixed height and bottom total */}
        <div className="w-1/2 bg-white border-l border-gray-200 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-4">
            <OrderSummary
              cart={cart}
              onRemoveItem={removeFromCart}
              onPlaceOrder={placeOrder}
              isLoading={isProcessing}
              variant="default"
            />
          </div>
        </div>
      </div>
    </div>
  );
}