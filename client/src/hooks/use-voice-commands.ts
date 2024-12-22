import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { voiceSynthesis } from '@/lib/voice-synthesis';

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

  const [lastCommand, setLastCommand] = useState<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 1000; // Prevent duplicate commands within 1 second

  const handleVoiceCommand = useCallback((text: string) => {
    // Skip empty callbacks (used for error handling)
    if (!text) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    // Prevent duplicate commands within the debounce window
    if (command === lastCommand.text && now - lastCommand.timestamp < COMMAND_DEBOUNCE_MS) {
      console.log('Skipping duplicate command:', command);
      return;
    }

    setLastCommand({ text: command, timestamp: now });
    console.log('Processing voice command:', command);

    // Voice command patterns
    const patterns = {
      navigation: /(?:go to|open|navigate to|show) (home|dashboard|inventory|events|settings)/i,
      addDrink: /(?:add|order) (?:a |an )?([a-zA-Z\s]+)/i,
      removeDrink: /(?:remove|delete|cancel) (?:a |an )?([a-zA-Z\s]+)/i,
      help: /(?:help|what can I say|commands|menu)/i
    };

    // Navigation and help command processing
    const navMatch = command.match(patterns.navigation);
    if (navMatch) {
      const page = navMatch[1].toLowerCase();
      const routes = {
        home: '/',
        dashboard: '/dashboard',
        inventory: '/inventory',
        events: '/events',
        settings: '/settings'
      } as const;
      
      if (page in routes) {
        const response = `Navigating to ${page}`;
        navigate(routes[page as keyof typeof routes]);
        
        voiceSynthesis.speak(response)
          .catch(error => console.error('Error speaking navigation response:', error));
        
        toast({
          title: "Navigation",
          description: response,
        });
        return;
      }
    }

    // Help command
    if (patterns.help.test(command)) {
      const helpMessage = "Available commands are: go to pages like home or inventory, add or remove drinks, and ask for help.";
      voiceSynthesis.speak(helpMessage)
        .catch(error => console.error('Error speaking help message:', error));
      
      toast({
        title: "Voice Commands Help",
        description: "Available commands: 'go to [page]', 'add [drink]', 'remove [drink]', 'help'",
        duration: 5000,
      });
      return;
    }
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
        const response = `Navigating to ${page}`;
        voiceSynthesis.speak(response)
          .catch(error => console.error('Error speaking navigation response:', error));
        
        navigate(routes[page]);
        toast({
          title: "Navigation",
          description: response,
        });
        return;
      }
    }

    // Feedback for unrecognized command with apologetic tone
    const response = "I heard you say: " + text + ". I apologize, but I don't recognize this command. Try saying 'help' to learn what I can do.";
    voiceSynthesis.speak(response, "shimmer", "apologetic")
      .catch(error => console.error('Error speaking response:', error));
    
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
      
      // Attempt to initialize voice synthesis with retry
      try {
        await voiceSynthesis.speak(
          "Voice commands activated. I'm listening and ready to help!",
          "fable",
          "excited"
        );
      } catch (synthError) {
        console.error('Error with voice synthesis, falling back to text only:', synthError);
      }
      
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
      
      voiceSynthesis.speak("Voice commands deactivated.")
        .catch(error => console.error('Error speaking deactivation message:', error));
      
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

  return {
    isListening,
    startListening,
    stopListening,
    isSupported: googleVoiceService.isSupported()
  };
}
