import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "@db/schema";
import { useState } from "react";

interface DrinkCardProps {
  drink: Drink & { price: number };
  onAdd: () => void;
  onRemove: () => void;
  quantity: number;
}

export function DrinkCard({ drink, onAdd, onRemove, quantity }: DrinkCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={quantity === 0 ? onAdd : onRemove}
      className="group relative cursor-pointer select-none transition-all duration-300"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/90 via-white/80 to-white/70 
                    dark:from-black/90 dark:via-black/80 dark:to-black/70 
                    shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.12)]
                    group-hover:shadow-[0_12px_48px_rgba(0,0,0,0.08)] dark:group-hover:shadow-[0_12px_48px_rgba(0,0,0,0.16)]
                    before:absolute before:inset-0 
                    before:rounded-2xl before:border 
                    before:border-white/20 dark:before:border-white/10
                    before:bg-gradient-to-br before:from-primary/5 before:to-transparent
                    dark:before:from-primary/10 dark:before:to-transparent/0
                    group-hover:before:border-primary/20
                    backdrop-blur-xl transition-all duration-300">
        <div className="aspect-square sm:aspect-[4/3]">
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 
                       group-hover:opacity-80 transition-opacity duration-300" />
          
          {/* Loading Skeleton */}
          <div className={`absolute inset-0 bg-gray-100 dark:bg-gray-800 
                        ${imageLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-gray-100 to-gray-200 
                         dark:from-gray-800 dark:to-gray-700" />
          </div>

          <img
            src={drink.image}
            alt={drink.name}
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-500
                     ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          
          <AnimatePresence>
            {quantity > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center 
                         rounded-full bg-primary/95
                         text-sm font-medium tracking-tight text-primary-foreground
                         ring-2 ring-white/30 shadow-lg backdrop-blur-md
                         transition-transform duration-300 group-hover:scale-110"
              >
                {quantity}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <motion.div 
              initial={false}
              animate={{ y: quantity > 0 ? -8 : 0 }}
              className="space-y-1.5 transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-base sm:text-lg text-white leading-tight tracking-tight">
                    {drink.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/80 font-medium">
                    {drink.category}
                  </p>
                </div>
                <span className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                  ${drink.price}
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
