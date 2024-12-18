import { motion, AnimatePresence } from "framer-motion";

interface VoiceAnimationProps {
  isListening: boolean;
  isProcessing: boolean;
}

export function VoiceAnimation({ isListening, isProcessing }: VoiceAnimationProps) {
  return (
    <AnimatePresence>
      {(isListening || isProcessing) && (
        <div className="relative w-12 h-12">
          {/* Background pulse animation */}
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/20"
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Voice wave animation */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 bg-primary"
                animate={{
                  height: isProcessing ? 16 : [8, 24, 8],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
