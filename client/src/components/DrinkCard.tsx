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
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={quantity === 0 ? onAdd : onRemove}
      className="group relative cursor-pointer select-none"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/90 to-white/70 
                    shadow-lg hover:shadow-xl
                    before:absolute before:inset-0 
                    before:rounded-2xl before:border 
                    before:border-white/20
                    before:bg-gradient-to-br before:from-primary/5 before:to-transparent
                    group-hover:before:border-primary/20
                    backdrop-blur-xl transition-all duration-300">
        <div className="aspect-[3/4]">
          {/* Loading Skeleton */}
          <div className={`absolute inset-0 bg-gray-100
                        ${imageLoaded ? 'opacity-0' : 'opacity-100'} 
                        transition-opacity duration-300`}>
            <div className="h-full w-full animate-pulse bg-gradient-to-r from-gray-100 to-gray-200" />
          </div>

          <img
            src={`/static/images/${drink.image}`}
            alt={drink.name}
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-500
                     ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
          
          <AnimatePresence>
            {quantity > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center 
                         rounded-full bg-primary/90
                         text-sm font-medium text-white
                         ring-2 ring-white/30 shadow-lg backdrop-blur-sm
                         transition-all duration-300"
              >
                {quantity}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-base text-white">
                    {drink.name}
                  </h3>
                  <p className="text-sm font-medium text-white/80">
                    {drink.category}
                  </p>
                </div>
                <span className="text-lg font-semibold text-white">
                  ${drink.price}
                </span>
              </div>
              <div className="text-sm text-white/60 font-medium">
                In Stock: {drink.inventory}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
