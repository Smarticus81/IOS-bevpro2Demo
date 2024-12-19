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
      transition={{ 
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }}
      onClick={quantity > 0 ? onRemove : onAdd}
      className="relative group cursor-pointer select-none"
    >
      <div className="relative aspect-[4/3] sm:aspect-[3/4] md:aspect-square xl:aspect-[4/3]
                    overflow-hidden rounded-2xl
                    bg-gradient-to-br from-white/90 to-white/80 dark:from-black/90 dark:to-black/80
                    backdrop-blur-lg
                    shadow-lg hover:shadow-xl
                    transition-all duration-300
                    before:absolute before:inset-0 before:rounded-2xl
                    before:border before:border-primary/10 dark:before:border-primary/5
                    before:bg-gradient-to-br before:from-primary/10 before:to-transparent dark:before:from-primary/5
                    hover:before:opacity-50 dark:hover:before:opacity-30
                    group-hover:-translate-y-1">
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-60 group-hover:opacity-70 transition-opacity"
        />
        <img
          src={drink.image}
          alt={drink.name}
          className="object-cover w-full h-full rounded-2xl"
        />
        <AnimatePresence>
          {quantity > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="absolute top-3 right-3 
                       bg-primary/90 text-primary-foreground
                       w-8 h-8 rounded-full 
                       flex items-center justify-center
                       text-sm font-medium shadow-lg
                       ring-2 ring-white/20 backdrop-blur-sm"
            >
              {quantity}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="space-y-1.5">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="font-medium text-base sm:text-lg text-white leading-tight tracking-tight">
                  {drink.name}
                </h3>
                <p className="text-xs sm:text-sm text-white/90 font-medium">
                  {drink.category}
                </p>
              </div>
              <span className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                ${drink.price}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
