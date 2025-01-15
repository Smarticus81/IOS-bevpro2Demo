import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "@db/schema";
import { useState, useEffect } from "react";
import { Beer, Wine, GlassWater, Coffee, Droplet } from "lucide-react";
import { useInventory } from "@/hooks/useInventory";

interface DrinkCardProps {
  drink: Drink;
  onAdd: () => void;
  onRemove: () => void;
  quantity: number;
}

export function DrinkCard({ drink, onAdd, onRemove, quantity }: DrinkCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [lastInventory, setLastInventory] = useState(drink.inventory);
  const { isConnected } = useInventory();

  // Track inventory changes for animation
  useEffect(() => {
    if (drink.inventory !== lastInventory) {
      console.log('Inventory changed:', {
        drinkId: drink.id,
        oldInventory: lastInventory,
        newInventory: drink.inventory,
        timestamp: new Date().toISOString()
      });
      setLastInventory(drink.inventory);
    }
  }, [drink.inventory, lastInventory, drink.id]);

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

  const getInventoryStatus = (inventory: number) => {
    if (inventory === 0) {
      return {
        color: 'bg-red-500',
        text: 'text-red-500',
        message: 'Out of Stock'
      };
    } else if (inventory < 10) {
      return {
        color: 'bg-yellow-500',
        text: 'text-yellow-500',
        message: 'Low Stock'
      };
    }
    return {
      color: 'bg-emerald-500',
      text: 'text-emerald-500',
      message: `${inventory} Available`
    };
  };

  const inventoryStatus = getInventoryStatus(drink.inventory);

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
      onClick={drink.inventory > 0 ? onAdd : undefined}
      className={`group relative ${drink.inventory === 0 ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'} select-none`}
    >
      <div className="relative overflow-hidden rounded-2xl bg-white/95 backdrop-blur-md
                    shadow-[0_8px_16px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.12)]
                    transition-all duration-300 border border-white/20">
        <div className="aspect-[4/3] relative">
          {/* Loading Skeleton */}
          <motion.div 
            className={`absolute inset-0 bg-gradient-to-b from-gray-50/90 to-gray-100/90
                     ${imageLoaded ? 'opacity-0' : 'opacity-100'} 
                     backdrop-blur-sm flex items-center justify-center`}
            initial={false}
            animate={{ opacity: imageLoaded ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col items-center gap-2">
              <Icon className={`h-10 w-10 ${color} opacity-60`} />
              <p className="text-xs font-medium text-gray-500">Loading...</p>
            </div>
          </motion.div>

          {/* Drink Image */}
          <img
            src={drink.image || ''}
            alt={drink.name}
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-500
                     ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Price Tag */}
          <div className="absolute right-3 top-3 px-2.5 py-1.5
                       bg-white/95 backdrop-blur-sm rounded-lg
                       shadow-sm border border-gray-100">
            <span className="text-sm font-semibold text-gray-900">
              ${drink.price}
            </span>
          </div>

          {/* Real-time Connection Indicator */}
          {!isConnected && (
            <div className="absolute left-3 top-3 px-2 py-1 bg-yellow-100 rounded-md">
              <span className="text-xs text-yellow-800">Syncing...</span>
            </div>
          )}

          {/* Quantity Badge */}
          <AnimatePresence>
            {quantity > 0 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center 
                          rounded-lg bg-primary shadow-sm
                          text-sm font-medium text-white"
              >
                {quantity}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inventory Update Animation */}
          <AnimatePresence>
            {drink.inventory !== lastInventory && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`absolute right-3 bottom-3 px-2 py-1 rounded-md
                          ${drink.inventory > lastInventory ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
              >
                <span className="text-xs font-medium">
                  {drink.inventory > lastInventory ? '+' : '-'}
                  {Math.abs(drink.inventory - lastInventory)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info Panel */}
          <div className="absolute inset-x-0 bottom-0 p-4 bg-white/95 backdrop-blur-md
                       border-t border-white/10">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-gray-50/80 backdrop-blur-sm shrink-0
                            border border-gray-100/50">
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-sm leading-5 text-gray-900 line-clamp-2
                             tracking-tight">
                    {drink.name}
                  </h3>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs font-medium text-gray-500 tracking-wide uppercase">
                      {drink.category}
                    </p>
                    <motion.div 
                      className="flex items-center gap-1.5"
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`h-2 w-2 rounded-full ${inventoryStatus.color}`}
                      />
                      <motion.span 
                        className={`text-xs font-medium ${inventoryStatus.text}`}
                        key={drink.inventory} // Force animation on inventory change
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {inventoryStatus.message}
                      </motion.span>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}