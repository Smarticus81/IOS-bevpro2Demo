import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';

export function useVoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();

  const startListening = useCallback(async () => {
    try {
      await googleVoiceService.startListening();
      setIsListening(true);
      toast({
        title: "Voice Commands Active",
        description: "Listening for your commands...",
      });
    } catch (error) {
      console.error('Failed to start voice commands:', error);
      toast({
        title: "Error",
        description: "Failed to start voice recognition. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopListening = useCallback(async () => {
    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      toast({
        title: "Voice Commands Stopped",
        description: "Voice recognition is now inactive.",
      });
    } catch (error) {
      console.error('Failed to stop voice commands:', error);
    }
  }, [toast]);

  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      if (isListening) {
        googleVoiceService.stopListening();
      }
    };
  }, [isListening]);

  return {
    isListening,
    startListening,
    stopListening
  };
}
