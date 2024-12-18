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
              scale: [1, 1.4, 1],
              opacity: [0.3, 0.1, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          
          {/* Inner pulse animation */}
          <motion.div
            className="absolute inset-2 rounded-full bg-primary/30"
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.4, 0.2, 0.4],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2,
            }}
          />
          
          {/* Voice wave animation */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full bg-primary"
                animate={{
                  height: isProcessing 
                    ? [12, 16, 12] 
                    : isListening 
                      ? [8, 24, 8] 
                      : 12,
                  opacity: isProcessing 
                    ? [0.7, 1, 0.7] 
                    : 1
                }}
                transition={{
                  duration: isProcessing ? 0.5 : 0.8,
                  repeat: Infinity,
                  delay: i * 0.1,
                  ease: isProcessing ? "linear" : "easeInOut",
                }}
                style={{
                  transformOrigin: "center",
                }}
              />
            ))}
          </motion.div>

          {/* Status indicator */}
          <motion.div
            className={`absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium ${
              isProcessing ? 'text-amber-500' : 'text-primary'
            }`}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
          >
            {isProcessing ? 'Processing...' : isListening ? 'Listening' : ''}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
