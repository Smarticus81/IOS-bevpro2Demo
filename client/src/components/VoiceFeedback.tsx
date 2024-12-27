import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceFeedbackProps {
  isListening: boolean;
  isProcessing: boolean;
  volume?: number;
}

export function VoiceFeedback({ isListening, isProcessing, volume = 0 }: VoiceFeedbackProps) {
  return (
    <AnimatePresence mode="wait">
      <div className="relative">
        {/* Background pulse animation */}
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/20"
            initial={{ scale: 1, opacity: 0 }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0, 0.2, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Voice activity rings */}
        {isListening && (
          <div className="absolute inset-0">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border-2 border-primary/30"
                initial={{ scale: 1, opacity: 0 }}
                animate={{
                  scale: 1 + (i + 1) * 0.2 * (volume || 0.5),
                  opacity: [0.3, 0],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>
        )}

        {/* Main icon */}
        <motion.div
          className={cn(
            "relative flex h-12 w-12 items-center justify-center rounded-full",
            isListening ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
          initial={{ scale: 0.8 }}
          animate={{
            scale: isListening ? 1 : 0.8,
            backgroundColor: isListening ? "var(--primary)" : "var(--muted)",
          }}
          transition={{ duration: 0.2 }}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </motion.div>

        {/* Status text */}
        <motion.div
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-medium"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
        >
          {isProcessing
            ? "Processing..."
            : isListening
            ? "Listening..."
            : "Click to start"}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
