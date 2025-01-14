import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import type { Drink } from "@db/schema";
import { DrinkCarousel } from "./DrinkCarousel";

interface DrinkMenuProps {
  drinks: Drink[];
  onAddToCart: (action: { type: 'ADD_ITEM'; drink: Drink; quantity: number }) => void;
}

export function DrinkMenu({ drinks, onAddToCart }: DrinkMenuProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDrinkId, setSelectedDrinkId] = useState<number>();

  const categories = useMemo(() => {
    const cats = new Set(drinks.map(d => d.category));
    return ["all", ...Array.from(cats)];
  }, [drinks]);

  const filteredDrinks = useMemo(() => {
    const filtered = drinks.filter(drink => {
      const matchesSearch = drink.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "all" || drink.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return filtered;
  }, [drinks, search, selectedCategory]);

  const handleSelectDrink = (drink: Drink) => {
    setSelectedDrinkId(drink.id);
    onAddToCart({ type: 'ADD_ITEM', drink, quantity: 1 });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-6">
      <motion.div 
        className="max-w-7xl mx-auto space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Search Bar */}
        <motion.div 
          className="w-full max-w-md mx-auto"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Input
            placeholder="Search drinks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/10 border-white/20 text-white placeholder:text-white/50
                      backdrop-blur-md rounded-xl shadow-xl focus:ring-2 focus:ring-white/30
                      transition-all duration-200"
          />
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="overflow-x-auto scrollbar-hide"
        >
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="w-full max-w-3xl mx-auto flex justify-center p-1 
                              bg-white/10 backdrop-blur-md border border-white/20 
                              rounded-xl shadow-xl">
              {categories.map(category => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="flex-1 capitalize text-sm text-white/70 data-[state=active]:bg-white/20 
                            data-[state=active]:backdrop-blur-md data-[state=active]:shadow-inner 
                            data-[state=active]:text-white rounded-lg transition-all duration-200 
                            hover:text-white/90 px-4 py-2 whitespace-nowrap"
                >
                  {category === "all" ? "All" : category}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </motion.div>

        {/* Drink Carousel */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full overflow-hidden pt-4"
        >
          <DrinkCarousel
            drinks={filteredDrinks}
            selectedDrinkId={selectedDrinkId}
            onSelectDrink={handleSelectDrink}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}