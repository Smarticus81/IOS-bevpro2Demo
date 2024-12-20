import { Wine, Minimize2, Maximize2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";

export function BevProLogo() {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <motion.div
        className="relative"
        animate={{ width: isMinimized ? "40px" : "auto" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-2 rounded-full bg-gradient-to-br from-gray-900 to-gray-800">
            <Wine className="h-6 w-6 text-white" />
          </div>
          <AnimatePresence>
            {!isMinimized && (
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-2xl font-bold bg-gradient-to-br from-gray-900 to-gray-800 bg-clip-text text-transparent whitespace-nowrap"
              >
                BevPro
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="absolute -right-8 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          {isMinimized ? (
            <Maximize2 className="h-4 w-4" />
          ) : (
            <Minimize2 className="h-4 w-4" />
          )}
        </Button>
      </motion.div>
    </div>
  );
}
