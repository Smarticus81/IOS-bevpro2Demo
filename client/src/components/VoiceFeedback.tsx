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
  const playbackAttemptRef = useRef<number>(0);
  const maxRetries = 3;
  const retryDelayMs = 1000;

  useEffect(() => {
    let mounted = true;
    let timeoutId: number | undefined;
    
    if (message && message !== lastMessageRef.current && isPlaying) {
      lastMessageRef.current = message;
      playbackAttemptRef.current = 0;
      
      const playMessage = async () => {
        try {
          if (!mounted) return;
          
          console.info('Attempting to play voice feedback:', {
            messageLength: message.length,
            voice,
            attempt: playbackAttemptRef.current + 1,
            maxRetries
          });
          
          await playCachedSpeech(message, voice);
          
          if (!mounted) return;
          
          playbackAttemptRef.current = 0; // Reset on success
          console.info('Voice feedback played successfully');
        } catch (error) {
          if (!mounted) return;
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Failed to play voice feedback:', {
            error: errorMessage,
            attempt: playbackAttemptRef.current + 1,
            maxRetries
          });
          
          // Attempt retry with exponential backoff
          if (playbackAttemptRef.current < maxRetries - 1) {
            playbackAttemptRef.current++;
            const delay = Math.min(retryDelayMs * Math.pow(2, playbackAttemptRef.current), 5000);
            console.info(`Scheduling retry ${playbackAttemptRef.current + 1}/${maxRetries} in ${delay}ms`);
            
            timeoutId = window.setTimeout(() => {
              if (mounted) {
                lastMessageRef.current = null; // Allow retry
                playMessage(); // Retry
              }
            }, delay);
          } else {
            console.error('Max retry attempts reached for voice feedback');
          }
        }
      };
      
      playMessage();
    }
    
    return () => {
      mounted = false;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [message, voice, isPlaying]);

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
