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
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (!containerRef.current) {
      console.log('DrinkCarousel: containerRef is not available');
      return;
    }
    
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
    console.log('DrinkCarousel: Scroll metrics', { scrollLeft, scrollWidth, clientWidth });
    
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    
    const scrollAmount = direction === 'left' ? -300 : 300;
    containerRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  };

  return (
    <div className="relative w-full mx-auto px-12">
      {/* Left Navigation Arrow */}
      <AnimatePresence>
        {showLeftArrow && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('left')}
              className="h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm border-white/20 
                       shadow-lg hover:bg-white hover:shadow-xl transition-all duration-200"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right Navigation Arrow */}
      <AnimatePresence>
        {showRightArrow && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll('right')}
              className="h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm border-white/20 
                       shadow-lg hover:bg-white hover:shadow-xl transition-all duration-200"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drink Cards Container */}
      <motion.div
        ref={containerRef}
        className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-6 pt-2"
        onScroll={handleScroll}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <AnimatePresence>
          {drinks.map((drink, index) => (
            <motion.div
              key={drink.id}
              className="flex-none w-[280px] snap-start"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                transition: {
                  delay: index * 0.1,
                  duration: 0.3,
                  ease: "easeOut"
                }
              }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
            >
              <DrinkCard
                drink={drink}
                onAdd={() => onSelectDrink(drink)}
                onRemove={() => {}}
                quantity={selectedDrinkId === drink.id ? 1 : 0}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
