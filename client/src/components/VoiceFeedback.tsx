import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Volume2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { voiceService } from '@/lib/voiceService';

interface VoiceFeedbackProps {
  message: string | null;
  isPlaying: boolean;
}

export function VoiceFeedback({ message, isPlaying }: VoiceFeedbackProps) {
  const lastMessageRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    if (message && message !== lastMessageRef.current && isPlaying) {
      lastMessageRef.current = message;
      setIsLoading(true);
      setError(null);
      
      const playMessage = async () => {
        try {
          if (!mounted) return;
          
          console.info('Attempting to play voice feedback:', {
            messageLength: message.length
          });
          
          try {
            await voiceService.speak(message, (progress) => {
              if (mounted) {
                setProgress(progress);
              }
            });
            if (!mounted) return;
            setUsingFallback(false);
            console.info('Voice feedback played successfully');
          } catch (speakError) {
            if (!navigator.onLine) {
              setUsingFallback(true);
              // Attempt Web Speech API fallback
              const utterance = new SpeechSynthesisUtterance(message);
              window.speechSynthesis.speak(utterance);
              await new Promise((resolve) => {
                utterance.onend = resolve;
              });
              console.info('Fallback voice feedback played successfully');
            } else {
              throw speakError;
            }
          }
        } catch (error) {
          if (!mounted) return;
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Failed to play voice feedback:', errorMessage);
          setError(errorMessage);
        } finally {
          if (mounted) {
            setIsLoading(false);
          }
        }
      };
      
      playMessage();
    }
    
    return () => {
      mounted = false;
    };
  }, [message, isPlaying]);

  return (
    <AnimatePresence>
      {(isPlaying || isLoading) && message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed bottom-4 left-4 z-50"
        >
          <Card className={`backdrop-blur-sm p-4 shadow-lg transition-colors duration-200 ${
            error ? 'bg-red-500/80 text-white' : 'bg-black/80 text-white'
          } border-white/10`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                {error ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <>
                    <Volume2 className="h-5 w-5" />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-white/50"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  {error ? error : message}
                </p>
                {isLoading && (
                  <div className="space-y-1">
                    <p className="text-xs text-white/70">
                      {usingFallback ? 'Using offline voice...' : progress > 0 ? `Streaming audio... ${Math.round(progress)}%` : 'Processing voice...'}
                    </p>
                    {progress > 0 && !usingFallback && (
                      <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-white/40 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}