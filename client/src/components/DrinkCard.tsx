import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Minus } from "lucide-react";
import type { Drink } from "@db/schema";

interface DrinkCardProps {
  drink: Drink & { price: number };
  onAdd: () => void;
  onRemove: () => void;
  quantity: number;
}

export function DrinkCard({ drink, onAdd, onRemove, quantity }: DrinkCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ 
        duration: 0.3,
        ease: [0.23, 1, 0.32, 1]  // Apple's default cubic-bezier
      }}
      className="relative group select-none"
    >
      <Card className="overflow-hidden border-0 bg-white/90 dark:bg-black/90 backdrop-blur-xl
                     shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]
                     transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                     group-hover:shadow-[0_12px_48px_rgba(0,0,0,0.06)] dark:group-hover:shadow-[0_12px_48px_rgba(0,0,0,0.16)]
                     group-hover:translate-y-[-2px]">
        <div className="relative aspect-[4/3]">
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/60 opacity-60 group-hover:opacity-80 transition-opacity duration-300"
          />
          <img
            src={drink.image}
            alt={drink.name}
            className="object-cover w-full h-full"
          />
          <AnimatePresence>
            {quantity > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute top-3 right-3 bg-white/95 dark:bg-zinc-900/95 
                         text-black dark:text-white w-8 h-8 rounded-full 
                         flex items-center justify-center text-sm font-medium 
                         shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.16)] 
                         backdrop-blur-md border border-white/40 dark:border-white/10"
              >
                {quantity}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <CardContent className="p-5">
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="font-semibold text-lg leading-none tracking-tight text-zinc-900 dark:text-white mb-1">
                  {drink.name}
                </h3>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {drink.category}
                </p>
              </div>
              <span className="text-xl font-semibold text-zinc-900 dark:text-white">
                ${drink.price}
              </span>
            </div>
            <motion.div 
              className="flex items-center justify-between pt-2 gap-4"
              initial={false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-200"
                onClick={onRemove}
                disabled={quantity === 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-base min-w-[2rem] text-center">
                {quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors duration-200"
                onClick={onAdd}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
