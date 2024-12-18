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
          className="max-w-sm"
        />
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="mb-4">
          {categories.map(category => (
            <TabsTrigger
              key={category}
              value={category}
              className="capitalize"
            >
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrinks.map(drink => (
            <Card key={drink.id}>
              <CardContent className="p-4">
                <div className="font-semibold">{drink.name}</div>
                <div className="text-sm text-muted-foreground mb-2">
                  {drink.subcategory}
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium">${drink.price}</span>
                  <Button
                    onClick={() => onAddToCart(drink)}
                    disabled={drink.inventory === 0}
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
