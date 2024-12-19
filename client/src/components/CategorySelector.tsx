import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CategorySelectorProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export function CategorySelector({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}: CategorySelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -200 : 200;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10">
        <button
          onClick={() => scroll("left")}
          className="p-2 rounded-full bg-white/80 dark:bg-black/80 
                   shadow-lg backdrop-blur-sm
                   hover:bg-white dark:hover:bg-black/90
                   transition-colors duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
      
      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto px-10 pb-4 pt-2 scrollbar-hide snap-x"
      >
        <motion.button
          onClick={() => onSelectCategory(null)}
          className={`shrink-0 snap-start px-6 py-2.5 rounded-full text-sm font-medium
                    transition-all duration-300 
                    ${!selectedCategory 
                      ? 'bg-primary text-primary-foreground shadow-lg' 
                      : 'bg-white/80 dark:bg-black/80 text-foreground hover:bg-white/90 dark:hover:bg-black/90'
                    }`}
        >
          All Drinks
        </motion.button>

        {categories.map((category) => (
          <motion.button
            key={category}
            onClick={() => onSelectCategory(category)}
            className={`shrink-0 snap-start px-6 py-2.5 rounded-full text-sm font-medium
                      transition-all duration-300
                      ${selectedCategory === category 
                        ? 'bg-primary text-primary-foreground shadow-lg' 
                        : 'bg-white/80 dark:bg-black/80 text-foreground hover:bg-white/90 dark:hover:bg-black/90'
                      }`}
          >
            {category}
          </motion.button>
        ))}
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
        <button
          onClick={() => scroll("right")}
          className="p-2 rounded-full bg-white/80 dark:bg-black/80 
                   shadow-lg backdrop-blur-sm
                   hover:bg-white dark:hover:bg-black/90
                   transition-colors duration-200"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
