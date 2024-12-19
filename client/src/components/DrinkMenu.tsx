import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Drink } from "@db/schema";

interface DrinkMenuProps {
  drinks: Drink[];
  onAddToCart: (drink: Drink) => void;
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrinks.map(drink => (
            <Card key={drink.id} className="bg-white/90 backdrop-blur-md border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardContent className="p-4">
                <div className="font-semibold text-gray-900">{drink.name}</div>
                <div className="text-sm text-gray-600 mb-2">
                  {drink.subcategory}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">${drink.price}</span>
                  <Button
                    onClick={() => onAddToCart(drink)}
                    disabled={drink.inventory === 0}
                    className="bg-gradient-to-b from-zinc-800 to-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.3)] border border-white/10 backdrop-blur-sm hover:shadow-[0_6px_20px_rgba(0,0,0,0.4)] hover:from-zinc-700 hover:to-zinc-900 transition-all duration-300 disabled:opacity-50"
                  >
                    Add to Order
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
