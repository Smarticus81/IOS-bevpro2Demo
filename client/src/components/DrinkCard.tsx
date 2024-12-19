import { motion, AnimatePresence } from "framer-motion";
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
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={quantity === 0 ? onAdd : onRemove}
      className="group relative cursor-pointer select-none"
    >
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white/80 via-white/60 to-white/40 
                    dark:from-black/80 dark:via-black/60 dark:to-black/40 
                    shadow-lg group-hover:shadow-xl
                    before:absolute before:inset-0 
                    before:rounded-xl before:border-[1.5px] 
                    before:border-primary/10 dark:before:border-primary/5
                    before:bg-gradient-to-br before:from-primary/5 before:to-transparent
                    dark:before:from-primary/10 dark:before:to-transparent/0
                    group-hover:before:border-primary/20
                    backdrop-blur-md transition-all duration-300">
        <div className="aspect-[3/4] sm:aspect-[4/3] md:aspect-square xl:aspect-[4/3]">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-60" />
          <img
            src={drink.image}
            alt={drink.name}
            className="h-full w-full object-cover"
          />
          
          <AnimatePresence>
            {quantity > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center 
                         rounded-full bg-primary/90 
                         text-sm font-semibold text-primary-foreground
                         ring-2 ring-white/20 shadow-lg backdrop-blur-sm"
              >
                {quantity}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-medium leading-tight text-white sm:text-lg">
                    {drink.name}
                  </h3>
                  <p className="text-xs font-medium text-white/70 sm:text-sm">
                    {drink.category}
                  </p>
                </div>
                <span className="text-lg font-semibold text-white sm:text-xl">
                  ${drink.price}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
