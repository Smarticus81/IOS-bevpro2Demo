import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Drink } from "@db/schema";

interface DrinkMenuProps {
  drinks: Drink[];
  onAddToCart: (action: { type: 'ADD_ITEM'; drink: Drink; quantity: number }) => void;
}

export function DrinkMenu({ drinks, onAddToCart }: DrinkMenuProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

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

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Input
          placeholder="Search drinks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-white/10 border-white/20 text-white placeholder:text-white/50"
        />
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="mb-4 bg-black/40 border border-white/10">
          {categories.map(category => (
            <TabsTrigger
              key={category}
              value={category}
              className="capitalize text-white/70 data-[state=active]:bg-white/10 data-[state=active]:text-white"
            >
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredDrinks.map(drink => {
            const isLowStock = drink.inventory > 0 && drink.inventory < 10;
            const isOutOfStock = drink.inventory === 0;
            
            return (
              <motion.div
                key={drink.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Card 
                  className={`
                    relative overflow-hidden
                    bg-white/90 backdrop-blur-md border-white/20 
                    shadow-xl hover:shadow-2xl 
                    transition-all duration-300
                    ${isOutOfStock ? 'grayscale' : ''}
                  `}
                >
                  {isLowStock && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-2 right-2 z-10"
                    >
                      <Badge variant="destructive" className="bg-yellow-500/90 text-[10px]">
                        Low Stock
                      </Badge>
                    </motion.div>
                  )}
                  
                  <CardContent className="p-4">
                    <div className="font-semibold text-gray-900">{drink.name}</div>
                    <div className="text-sm text-gray-600 mb-2">
                      {drink.subcategory}
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">${drink.price}</span>
                        <span className={`text-xs ${
                          isOutOfStock ? 'text-red-500' :
                          isLowStock ? 'text-yellow-500' :
                          'text-emerald-500'
                        }`}>
                          {isOutOfStock ? 'Out of Stock' :
                           isLowStock ? `Only ${drink.inventory} left` :
                           `${drink.inventory} Available`}
                        </span>
                      </div>
                      <Button
                        onClick={() => onAddToCart({ type: 'ADD_ITEM', drink, quantity: 1 })}
                        disabled={isOutOfStock}
                        className={`
                          relative overflow-hidden
                          bg-gradient-to-b from-zinc-800 to-black 
                          text-white shadow-[0_4px_10px_rgba(0,0,0,0.3)] 
                          border border-white/10 backdrop-blur-sm 
                          hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] 
                          hover:from-zinc-700 hover:to-zinc-900 
                          transition-all duration-300
                          disabled:opacity-50
                        `}
                      >
                        {isOutOfStock ? 'Out of Stock' : 'Add to Order'}
                        <motion.div
                          className="absolute inset-0 bg-white/20"
                          initial={{ scale: 0, opacity: 0 }}
                          whileTap={{ scale: 2, opacity: 0 }}
                          transition={{ duration: 0.5 }}
                        />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
          ))}
        </div>
      </Tabs>
    </div>
  );
}
