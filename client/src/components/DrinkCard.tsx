import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "@db/schema";
import { useState } from "react";
import { Beer, Wine, GlassWater, Coffee, Droplet } from "lucide-react";

interface DrinkCardProps {
  drink: Drink & { price: number };
  onAdd: () => void;
  onRemove: () => void;
  quantity: number;
}

export function DrinkCard({ drink, onAdd, onRemove, quantity }: DrinkCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'beer':
        return <Beer className="h-6 w-6 text-amber-500" />;
      case 'wine':
        return <Wine className="h-6 w-6 text-purple-500" />;
      case 'spirits':
      case 'classics':
        return <GlassWater className="h-6 w-6 text-blue-500" />;
      case 'signature':
        return <Coffee className="h-6 w-6 text-pink-500" />;
      default:
        return <Droplet className="h-6 w-6 text-gray-500" />;
    }
  };

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
      <div className="relative overflow-hidden rounded-2xl bg-white 
                    shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]
                    transition-all duration-300">
        <div className="aspect-[2/3]">
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

          {/* Price Tag */}
          <div className="absolute right-3 top-3 px-3 py-1
                       bg-white/90 backdrop-blur-sm rounded-full
                       shadow-sm border border-gray-100">
            <span className="text-sm font-semibold text-gray-900">
              ${drink.price}
            </span>
          </div>

          <AnimatePresence>
            {quantity > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center 
                         rounded-full bg-primary shadow-sm
                         text-sm font-medium text-white"
              >
                {quantity}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-x-0 bottom-0 p-4 bg-white">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-full bg-gray-50">
                    {getCategoryIcon(drink.category)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-base text-gray-900 truncate">
                      {drink.name}
                    </h3>
                    <p className="text-sm font-medium text-gray-500">
                      {drink.category}
                    </p>
                  </div>
                </div>
                <div className="text-xs font-medium text-gray-400">
                  In Stock: {drink.inventory}
                </div>
              </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}