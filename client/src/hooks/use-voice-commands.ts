import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export function useVoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleVoiceCommand = useCallback((text: string) => {
    // Skip empty callbacks (used for error handling)
    if (!text) return;

    const command = text.toLowerCase().trim();
    console.log('Processing voice command:', command);

    // Simple navigation commands
    if (command.includes('go to') || command.includes('open')) {
      if (command.includes('home')) navigate('/');
      else if (command.includes('dashboard')) navigate('/dashboard');
      else if (command.includes('inventory')) navigate('/inventory');
      else if (command.includes('events')) navigate('/events');
      else if (command.includes('settings')) navigate('/settings');
      
      console.log('Navigation command processed:', command);
    }

    // Feedback toast for received command
    toast({
      title: "Voice Command Received",
      description: text,
    });
  }, [navigate, toast]);

  const startListening = useCallback(async () => {
    console.log('Attempting to start voice recognition...');
    try {
      // Check if speech recognition is supported
      if (!googleVoiceService.isSupported()) {
        console.warn('Speech recognition not supported');
        toast({
          title: "Error",
          description: "Speech recognition is not supported in this browser.",
          variant: "destructive",
        });
        return;
      }

      console.log('Speech recognition supported, initializing...');
      await googleVoiceService.startListening(handleVoiceCommand);
      
      setIsListening(true);
      console.log('Voice recognition started successfully');
      
      toast({
        title: "Voice Commands Active",
        description: "Listening for your commands...",
      });
    } catch (error: any) {
      console.error('Failed to start voice commands:', error);
      setIsListening(false); // Ensure state is consistent
      
      const errorMessage = error.message || "Failed to start voice recognition. Please check microphone permissions.";
      console.error('Voice command error details:', errorMessage);
      
      toast({
        title: "Error",
        description: errorMessage,
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
    } catch (error: any) {
      console.error('Failed to stop voice commands:', error);
      setIsListening(false); // Ensure state is consistent even on error
      toast({
        title: "Error",
        description: error.message || "Failed to stop voice recognition",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (isListening) {
        googleVoiceService.stopListening().catch(error => {
          console.error('Error during cleanup:', error);
        });
      }
    };
  }, [isListening]);

  // Initial check for browser support
  useEffect(() => {
    if (!googleVoiceService.isSupported()) {
      console.warn('Speech recognition is not supported in this browser');
    }
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    isSupported: googleVoiceService.isSupported()
  };
}
