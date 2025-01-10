import { useState, useMemo } from "react";
import { DrinkCard } from "@/components/DrinkCard";
import { useQuery } from "@tanstack/react-query";
import { VoiceControlButton } from "@/components/VoiceControlButton";
import { OrderSummary } from "@/components/OrderSummary";
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
  const { cart, addToCart, removeFromCart, placeOrder, isProcessing } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>("All");

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
    { name: 'All' }
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
    <div className="h-screen flex flex-col">
      <NavBar />
      <VoiceControlButton />

      <div className="flex-1 flex h-[calc(100vh-4rem)] overflow-hidden">
        {/* Left Side - Menu */}
        <div className="w-1/2 flex flex-col h-full bg-white">
          {/* Tiers Selection */}
          <div className="border-b border-gray-100">
            <div className="overflow-x-auto scrollbar-hide py-4 px-6">
              <div className="inline-flex gap-6">
                {tiers.map((tier) => (
                  <button
                    key={tier.name}
                    onClick={() => setSelectedTier(tier.name)}
                    className={`
                      font-medium text-base
                      ${selectedTier === tier.name 
                        ? 'text-gray-900' 
                        : 'text-gray-400 hover:text-gray-600'}
                      transition-colors
                    `}
                  >
                    {tier.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Menu Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-4">
            {/* Categories Grid */}
            {!selectedCategory && (
              <motion.div 
                layout
                className="grid grid-cols-2 gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {categories.map((category, index) => {
                  const colors = [
                    'bg-orange-500',
                    'bg-green-500',
                    'bg-red-500',
                    'bg-blue-500',
                    'bg-purple-500',
                    'bg-yellow-500'
                  ];
                  const color = colors[index % colors.length];

                  return (
                    <motion.button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`
                        ${color} text-white aspect-square rounded-lg
                        flex items-center justify-center
                        border border-white/10 backdrop-blur-sm
                        hover:opacity-90 transition-opacity duration-200
                      `}
                    >
                      <h3 className="text-2xl font-semibold">
                        {category}
                      </h3>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {/* Back Button */}
            {selectedCategory && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mb-6"
              >
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-gray-600 font-medium"
                >
                  ← Categories
                </button>
              </motion.div>
            )}

            {/* Drinks Grid */}
            {selectedCategory && (
              <motion.div 
                layout
                className="grid grid-cols-2 gap-4"
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

        {/* Right Side - Order Summary */}
        <div className="w-1/2 bg-white border-l border-gray-100 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto scrollbar-hide">
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