import { motion } from "framer-motion";
import { GlassWater } from "lucide-react";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Preparing your drinks..." }: LoadingScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <motion.div 
        className="flex flex-col items-center justify-center p-8 rounded-lg bg-white/90 shadow-lg"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.4 }}
      >
        <div className="relative">
          {/* Glass container */}
          <motion.div
            className="relative"
            animate={{ 
              y: [0, -10, 0],
              rotate: [-5, 5, -5] 
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <GlassWater size={48} className="text-primary" />
            {/* Liquid fill effect */}
            <motion.div
              className="absolute bottom-0 left-1/4 right-1/4 bg-primary/30 rounded-b-full"
              initial={{ height: 0 }}
              animate={{ height: "80%" }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut"
              }}
            />
          </motion.div>

          {/* Bubbles */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-primary/20 w-2 h-2"
              initial={{ 
                y: 20,
                x: 10 + (i * 15),
                opacity: 0 
              }}
              animate={{ 
                y: -20,
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeOut"
              }}
            />
          ))}
        </div>

        <motion.p 
          className="mt-4 text-lg font-medium text-gray-700"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {message}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
