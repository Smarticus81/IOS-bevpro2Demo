import { useEffect, useRef } from 'react';
import { playCachedSpeech } from '@/lib/voiceSynthesis';
import { Card } from '@/components/ui/card';
import { Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ValidVoice } from '@/lib/voiceSynthesis';

interface VoiceFeedbackProps {
  message: string | null;
  isPlaying: boolean;
  voice?: ValidVoice;
}

export function VoiceFeedback({ message, isPlaying, voice = 'nova' }: VoiceFeedbackProps) {
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (message && message !== lastMessageRef.current) {
      lastMessageRef.current = message;
      playCachedSpeech(message, voice).catch(console.error);
    }
  }, [message, voice]);

  return (
    <AnimatePresence>
      {isPlaying && message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed bottom-4 left-4 z-50"
        >
          <Card className="bg-black/80 text-white border-white/10 backdrop-blur-sm p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Volume2 className="h-5 w-5" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-white/50"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <p className="text-sm">{message}</p>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
