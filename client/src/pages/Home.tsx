import { useState, useMemo } from "react";
import { DrinkCard } from "@/components/DrinkCard";
import { useQuery } from "@tanstack/react-query";
import { VoiceControlButton } from "@/components/VoiceControlButton";
import { OrderSummary } from "@/components/OrderSummary";
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
    Array.from(new Set(drinks.map((drink) => drink.category))).sort(),
    [drinks]
  );

  const filteredDrinks = useMemo(() =>
    drinks.filter((drink) => !selectedCategory || drink.category === selectedCategory),
    [drinks, selectedCategory]
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Beer":
        return "bg-[#4D2D14]";
      case "Wine":
        return "bg-[#722F37]";
      case "Spirits":
        return "bg-[#0B4FA1]";
      case "Signature":
        return "bg-[#E67E23]";
      case "Non-Alcoholic":
        return "bg-[#2C8A3B]";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-pearl-light">
      {/* Main Container - Split for iPad mini landscape */}
      <div className="flex h-screen">
        {/* Left Panel - Menu Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Content Area */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
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
                    const cartItem = cart.find((item) => item.drink.id === drink.id);
                    return (
                      <DrinkCard
                        key={drink.id}
                        drink={drink}
                        quantity={cartItem?.quantity || 0}
                        onAdd={() => addToCart({ type: "ADD_ITEM", drink, quantity: 1 })}
                        onRemove={() => removeItem(drink.id)}
                      />
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Categories Grid - Fixed to Bottom */}
            {!selectedCategory && (
              <div className="fixed bottom-0 left-0 right-0 md:right-[360px]">
                <motion.div
                  layout
                  className="grid grid-cols-3 gap-0"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {categories.map((category) => (
                    <motion.button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className="aspect-square"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div
                        className={`w-full h-full ${getCategoryColor(
                          category
                        )} flex items-center justify-center`}
                      >
                        <div className="text-center">
                          <h3 className="text-white font-sf-pro-display text-lg">
                            {category}
                          </h3>
                          <span className="text-white/80 text-sm">
                            {drinks.filter((d) => d.category === category).length}{" "}
                            items
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              </div>
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

        {/* Voice Control Button - Optimized position for iPad mini landscape */}
        <div className="fixed bottom-24 right-4 z-[100] md:bottom-6 md:right-[380px]">
          <VoiceControlButton />
        </div>
      </div>
    </div>
  );
}