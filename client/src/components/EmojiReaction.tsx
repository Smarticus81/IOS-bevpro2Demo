import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export type SentimentType = 'positive' | 'negative' | 'neutral' | 'listening' | 'processing' | null;

interface EmojiReactionProps {
  sentiment: SentimentType;
}

const emojiMap = {
  positive: ['😊', '👍', '🎉', '✨'],
  negative: ['😕', '🤔', '❌', '💫'],
  neutral: ['😐', '🎯', '💭', '✨'],
  listening: ['👂', '🎤', '📝', '✨'],
  processing: ['⚡️', '🔄', '💫', '✨'],
};

export function EmojiReaction({ sentiment }: EmojiReactionProps) {
  const [emojis, setEmojis] = useState<string[]>([]);
  
  useEffect(() => {
    if (!sentiment) {
      setEmojis([]);
      return;
    }
    
    setEmojis(emojiMap[sentiment] || []);
  }, [sentiment]);

  return (
    <div className="relative h-12 w-12">
      <AnimatePresence>
        {emojis.map((emoji, index) => (
          <motion.div
            key={`${emoji}-${index}`}
            className="absolute inset-0 flex items-center justify-center text-2xl"
            initial={{ 
              scale: 0,
              opacity: 0,
              y: 10 
            }}
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0, 1, 0],
              y: -20 
            }}
            exit={{ 
              scale: 0,
              opacity: 0 
            }}
            transition={{ 
              duration: 1.5,
              delay: index * 0.2,
              ease: "easeOut" 
            }}
          >
            {emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
