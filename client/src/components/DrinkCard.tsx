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
      transition={{ 
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1]
      }}
      onClick={onAdd}
      className="relative group interactive glass-card"
    >
      <div className="relative aspect-[3/4] sm:aspect-[4/3] md:aspect-square xl:aspect-[4/3]">
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 group-hover:opacity-80 transition-opacity"
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
              className="absolute top-3 right-3 bg-primary text-primary-foreground
                       w-8 h-8 rounded-full flex items-center justify-center
                       text-sm font-medium shadow-[var(--shadow-elevation-low)]"
            >
              {quantity}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="space-y-2">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h3 className="font-medium text-base sm:text-lg text-white leading-tight">
                  {drink.name}
                </h3>
                <p className="text-xs sm:text-sm text-white/80 font-medium">
                  {drink.category}
                </p>
              </div>
              <span className="text-lg sm:text-xl font-semibold text-white">
                ${drink.price}
              </span>
            </div>
            
            {quantity > 0 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="w-full py-2 px-4 rounded-full 
                         bg-white/10 backdrop-blur-sm
                         border border-white/20
                         text-white text-sm font-medium
                         transition-colors duration-200
                         hover:bg-white/20"
              >
                Remove
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
