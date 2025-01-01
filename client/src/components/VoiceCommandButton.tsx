import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SoundWaveVisualizer } from './SoundWaveVisualizer';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onStart?: () => void;
  onStop?: () => void;
  mode?: 'wake_word' | 'command' | 'shutdown';
  className?: string;
}

export function VoiceCommandButton({ onStart, onStop, mode = 'command', className }: Props) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();

  const handleMicrophoneClick = async () => {
    try {
      if (!isListening) {
        // Request microphone permissions
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately as we just want permission
        
        setIsListening(true);
        onStart?.();
        
        // Show feedback toast
        toast({
          title: "Voice Commands Active",
          description: "Speak your command clearly...",
          duration: 2000
        });
      } else {
        setIsListening(false);
        onStop?.();
      }
    } catch (error) {
      console.error('Microphone access error:', error);
      toast({
        title: "Microphone Access Error",
        description: "Please allow microphone access to use voice commands.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    // Cleanup function
    return () => {
      if (isListening) {
        setIsListening(false);
        onStop?.();
      }
    };
  }, []);

  return (
    <div className={`relative ${className}`}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={handleMicrophoneClick}
          variant={isListening ? "default" : "secondary"}
          size="lg"
          className={`
            relative overflow-hidden backdrop-blur-lg
            ${isListening 
              ? 'bg-primary shadow-lg ring-2 ring-primary/50' 
              : 'bg-white/50 dark:bg-gray-800/50 hover:bg-white/60 dark:hover:bg-gray-800/60'}
            transition-all duration-300 ease-out
          `}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isListening ? "mic-on" : "mic-off"}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              {isListening ? (
                <Mic className="h-5 w-5 text-white animate-pulse" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
              <span>
                {isListening ? "Listening..." : "Start Voice Command"}
              </span>
            </motion.div>
          </AnimatePresence>
        </Button>
      </motion.div>

      <SoundWaveVisualizer
        isListening={isListening}
        mode={mode}
      />
    </div>
  );
}
