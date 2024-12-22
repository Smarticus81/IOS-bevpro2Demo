import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export function useVoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  
  // Only log initialization once during development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Voice commands hook initialized:', { location });
    }
  }, []); // Empty dependency array ensures it only runs once

  const handleVoiceCommand = useCallback((text: string) => {
    // Skip empty callbacks (used for error handling)
    if (!text) return;

    const command = text.toLowerCase().trim();
    console.log('Processing voice command:', command);

    // Voice command patterns
    const patterns = {
      navigation: /(?:go to|open|navigate to|show) (home|dashboard|inventory|events|settings)/i,
      addDrink: /(?:add|order) (?:a |an )?([a-zA-Z\s]+)/i,
      removeDrink: /(?:remove|delete|cancel) (?:a |an )?([a-zA-Z\s]+)/i,
      help: /(?:help|what can I say|commands|menu)/i
    };

    // Navigation commands
    const navMatch = command.match(patterns.navigation);
    if (navMatch) {
      const page = navMatch[1].toLowerCase();
      const routes = {
        home: '/',
        dashboard: '/dashboard',
        inventory: '/inventory',
        events: '/events',
        settings: '/settings'
      };
      
      if (routes[page]) {
        navigate(routes[page]);
        console.log('Navigation command processed:', { page, route: routes[page] });
        toast({
          title: "Navigation",
          description: `Navigating to ${page}`,
        });
        return;
      }
    }

    // Help command
    if (patterns.help.test(command)) {
      toast({
        title: "Voice Commands Help",
        description: "Available commands: 'go to [page]', 'add [drink]', 'remove [drink]', 'help'",
        duration: 5000,
      });
      return;
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

  // Enhanced cleanup effect
  useEffect(() => {
    let mounted = true;

    // Cleanup function
    return () => {
      mounted = false;
      if (isListening) {
        googleVoiceService.stopListening().catch(error => {
          if (process.env.NODE_ENV === 'development') {
            console.error('Error during voice command cleanup:', error);
          }
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
