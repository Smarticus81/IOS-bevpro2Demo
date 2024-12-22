import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export function useVoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleVoiceCommand = useCallback((text: string) => {
    const command = text.toLowerCase().trim();
    console.log('Processing voice command:', command);

    // Simple navigation commands
    if (command.includes('go to') || command.includes('open')) {
      if (command.includes('home')) setLocation('/');
      else if (command.includes('dashboard')) setLocation('/dashboard');
      else if (command.includes('inventory')) setLocation('/inventory');
      else if (command.includes('events')) setLocation('/events');
      else if (command.includes('settings')) setLocation('/settings');
    }

    // Feedback toast for received command
    toast({
      title: "Voice Command Received",
      description: text,
    });
  }, [navigate, toast]);

  const startListening = useCallback(async () => {
    try {
      await googleVoiceService.startListening(handleVoiceCommand);
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
  }, [handleVoiceCommand, toast]);

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
      toast({
        title: "Error",
        description: "Failed to stop voice recognition",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      if (isListening) {
        googleVoiceService.stopListening().catch(console.error);
      }
    };
  }, [isListening]);

  return {
    isListening,
    startListening,
    stopListening
  };
}
