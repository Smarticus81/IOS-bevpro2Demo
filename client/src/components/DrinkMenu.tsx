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
    return drinks.filter(drink => {
      const matchesSearch = drink.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === "all" || drink.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [drinks, search, selectedCategory]);

  const handleSelectDrink = (drink: Drink) => {
    setSelectedDrinkId(drink.id);
    onAddToCart({ type: 'ADD_ITEM', drink, quantity: 1 });
  };

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <Input
          placeholder="Search drinks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-white/10 border-white/20 text-white placeholder:text-white/50"
        />

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="p-1 bg-gradient-to-b from-white/10 to-black/20 backdrop-blur-lg 
                             border border-white/20 rounded-xl shadow-lg">
            {categories.map(category => (
              <TabsTrigger
                key={category}
                value={category}
                className="capitalize text-white/70 data-[state=active]:bg-gradient-to-b 
                          data-[state=active]:from-white/20 data-[state=active]:to-white/10 
                          data-[state=active]:shadow-inner data-[state=active]:text-white
                          transition-all duration-200 hover:text-white/90"
              >
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="w-full overflow-hidden"
      >
        <DrinkCarousel
          drinks={filteredDrinks}
          selectedDrinkId={selectedDrinkId}
          onSelectDrink={handleSelectDrink}
        />
      </motion.div>
    </div>
  );
}
