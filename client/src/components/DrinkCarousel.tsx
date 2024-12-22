import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import type { Drink } from "@db/schema";
import { DrinkCard } from "./DrinkCard";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DrinkCarouselProps {
  drinks: Drink[];
  selectedDrinkId?: number;
  onSelectDrink: (drink: Drink) => void;
}

export function DrinkCarousel({ drinks, selectedDrinkId, onSelectDrink }: DrinkCarouselProps) {
  const [dragStart, setDragStart] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const handleScroll = () => {
    if (!containerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    
    const scrollAmount = containerRef.current.clientWidth * 0.8;
    containerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  return (
    <div className="relative group">
      {/* Navigation Arrows */}
      <AnimatePresence>
        {showLeftArrow && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              className="rounded-full bg-white/90 backdrop-blur-sm border-white/20 shadow-lg
                       hover:bg-white hover:shadow-xl transition-all duration-200"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
        
        {showRightArrow && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
              className="rounded-full bg-white/90 backdrop-blur-sm border-white/20 shadow-lg
                       hover:bg-white hover:shadow-xl transition-all duration-200"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drink Cards Container */}
      <motion.div
        ref={containerRef}
        className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory"
        onScroll={handleScroll}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <AnimatePresence>
          {drinks.map((drink, index) => (
            <motion.div
              key={drink.id}
              className="flex-shrink-0 snap-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                transition: { delay: index * 0.1 }
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectDrink(drink)}
            >
              <div 
                className={`relative p-1 rounded-xl transition-all duration-300
                  ${selectedDrinkId === drink.id 
                    ? 'bg-gradient-to-b from-white/20 to-white/10 shadow-lg' 
                    : 'hover:bg-white/5'
                  }`}
              >
                <DrinkCard
                  drink={drink}
                  onAdd={() => onSelectDrink(drink)}
                  onRemove={() => {}}
                  quantity={selectedDrinkId === drink.id ? 1 : 0}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
