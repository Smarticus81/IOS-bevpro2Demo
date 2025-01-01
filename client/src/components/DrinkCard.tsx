import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "@db/schema";
import { useState } from "react";
import { Beer, Wine, GlassWater, Coffee, Droplet } from "lucide-react";
import { DrinkModifierSelector } from "./DrinkModifierSelector";

interface DrinkCardProps {
  drink: Drink;
  onAdd: (modifiers?: {
    pourSize: 'single' | 'double' | 'triple' | 'shot';
    extras: string[];
  }) => void;
  onRemove: () => void;
  quantity: number;
}

export function DrinkCard({ drink, onAdd, onRemove, quantity }: DrinkCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showModifiers, setShowModifiers] = useState(false);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'beer':
        return { icon: Beer, color: 'text-amber-500' };
      case 'wine':
        return { icon: Wine, color: 'text-purple-500' };
      case 'spirits':
      case 'classics':
        return { icon: GlassWater, color: 'text-blue-500' };
      case 'signature':
        return { icon: Coffee, color: 'text-pink-500' };
      default:
        return { icon: Droplet, color: 'text-gray-500' };
    }
  };

  const { icon: Icon, color } = getCategoryIcon(drink.category);

  const handleCardClick = () => {
    if (drink.category.toLowerCase() === 'spirits') {
      setShowModifiers(true);
    } else {
      onAdd();
    }
  };

  const handleModifierChange = (modifiers: {
    pourSize: 'single' | 'double' | 'triple' | 'shot';
    extras: string[];
  }) => {
    onAdd(modifiers);
    setShowModifiers(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ 
        y: -4,
        scale: 1.02,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      whileTap={{ 
        scale: 0.98,
        transition: { duration: 0.1, ease: "easeIn" }
      }}
      onClick={handleCardClick}
      className="relative w-full md:max-w-[280px] lg:max-w-[320px] mx-auto 
                transform transition-all duration-200 hover:scale-[1.02]"
    >
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-white/90 to-gray-50/90
                    dark:from-gray-900/90 dark:to-gray-800/90
                    shadow-lg hover:shadow-xl
                    transition-all duration-300 border border-white/20
                    backdrop-blur-lg">
        <div className="aspect-[4/3]">
          {/* Loading Skeleton with Category Icon */}
          <motion.div 
            className={`absolute inset-0 bg-gradient-to-b from-gray-50/90 to-gray-100/90
                     dark:from-gray-900/90 dark:to-gray-800/90
                     ${imageLoaded ? 'opacity-0' : 'opacity-100'} 
                     backdrop-blur-lg flex items-center justify-center`}
            initial={false}
            animate={{
              opacity: imageLoaded ? 0 : 1,
              transition: { duration: 0.3, ease: "easeInOut" }
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <Icon className={`h-12 w-12 ${color} opacity-60`} />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Loading...</p>
            </div>
          </motion.div>

          <img
            src={`/static/images/${drink.image}`}
            alt={drink.name}
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-500
                     ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Price Tag */}
          <div className="absolute right-3 top-3 px-3 py-1.5
                       bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg rounded-xl
                       shadow-lg border border-white/20">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
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
                          rounded-xl bg-primary shadow-lg
                          text-sm font-medium text-white"
              >
                {quantity}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-x-0 bottom-0 p-3 bg-white/95 dark:bg-gray-900/95 
                         backdrop-blur-lg border-t border-white/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {drink.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                      {drink.category}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`h-1.5 w-1.5 rounded-full ${
                          drink.inventory === 0 ? 'bg-red-500' :
                          drink.inventory < 10 ? 'bg-yellow-500' :
                          'bg-emerald-500'
                        }`}
                      />
                      <span className={`text-[10px] font-medium ${
                        drink.inventory === 0 ? 'text-red-500' :
                        drink.inventory < 10 ? 'text-yellow-500' :
                        'text-emerald-500'
                      }`}>
                        {drink.inventory === 0 ? 'Out of Stock' :
                         drink.inventory < 10 ? 'Low Stock' :
                         `${drink.inventory} Available`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modifier Selector Modal */}
      <AnimatePresence>
        {showModifiers && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute z-50 top-full left-0 right-0 mt-3 mx-auto max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <DrinkModifierSelector
              onModifierChange={handleModifierChange}
              isSpirit={drink.category.toLowerCase() === 'spirits'}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}