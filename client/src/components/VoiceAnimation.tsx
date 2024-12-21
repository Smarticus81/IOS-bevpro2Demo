import { motion, AnimatePresence } from "framer-motion";

interface VoiceAnimationProps {
  isListening: boolean;
  isProcessing: boolean;
  amplitude?: number; // For dynamic wave height based on voice input
  sentiment?: 'neutral' | 'positive' | 'negative';
}

const getAnimationColor = (sentiment: 'neutral' | 'positive' | 'negative' | undefined) => {
  switch (sentiment) {
    case 'positive':
      return 'bg-emerald-500';
    case 'negative':
      return 'bg-red-500';
    default:
      return 'bg-primary';
  }
};

export function VoiceAnimation({ 
  isListening, 
  isProcessing, 
  amplitude = 1,
  sentiment 
}: VoiceAnimationProps) {
  const bars = 5; // Number of animation bars
  const baseHeight = 16; // Base height of bars in pixels
  const color = getAnimationColor(sentiment);
  
  return (
    <AnimatePresence>
      {(isListening || isProcessing) && (
        <div className="relative w-16 h-16">
          {/* Outer pulse ring */}
          <motion.div
            className={`absolute inset-0 rounded-full ${color}/10`}
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Inner pulse ring */}
          <motion.div
            className={`absolute inset-2 rounded-full ${color}/20`}
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.4, 0.2, 0.4],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2,
            }}
          />
          
          {/* Voice wave visualization */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center gap-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(bars)].map((_, i) => (
              <motion.div
                key={i}
                className={`w-1 rounded-full ${color}`}
                animate={isProcessing ? {
                  height: baseHeight,
                  opacity: [0.4, 1, 0.4]
                } : {
                  height: [
                    baseHeight * 0.5,
                    baseHeight * amplitude * (1 + (i % 2) * 0.5),
                    baseHeight * 0.5
                  ],
                }}
                transition={{
                  duration: isProcessing ? 0.8 : 1,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: isProcessing ? "linear" : "easeInOut",
                }}
              />
            ))}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
