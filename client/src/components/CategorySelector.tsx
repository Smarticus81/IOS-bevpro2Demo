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
      <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => scroll("left")}
          className="p-2.5 rounded-full bg-white shadow-lg hover:shadow-xl
                    transition-all duration-200 backdrop-blur-md
                    border border-gray-200/50"
        >
          <ChevronLeft className="h-4 w-4 text-gray-700" />
        </motion.button>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto px-12 py-4 scrollbar-hide snap-x"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectCategory(null)}
          className={`shrink-0 snap-start px-6 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-200 border
                    ${!selectedCategory 
                      ? 'bg-gray-900 text-white border-transparent shadow-md' 
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
        >
          All Drinks
        </motion.button>

        {categories.map((category) => (
          <motion.button
            key={category}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectCategory(category)}
            className={`shrink-0 snap-start px-6 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-200 border
                      ${selectedCategory === category 
                        ? 'bg-gray-900 text-white border-transparent shadow-md' 
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}
          >
            {category}
          </motion.button>
        ))}
      </div>

      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => scroll("right")}
          className="p-2.5 rounded-full bg-white shadow-lg hover:shadow-xl
                    transition-all duration-200 backdrop-blur-md
                    border border-gray-200/50"
        >
          <ChevronRight className="h-4 w-4 text-gray-700" />
        </motion.button>
      </div>
    </div>
  );
}