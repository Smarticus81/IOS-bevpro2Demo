import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { voiceSynthesis } from '@/lib/voice-synthesis';

type VoiceId = "alloy" | "echo" | "fable" | "onyx" | "shimmer";

interface VoiceCommandsProps {
  drinks: Array<{
    id: number;
    name: string;
    price: number;
    category: string;
  }>;
  cart: Array<{ 
    drink: { id: number; name: string; price: number; }; 
    quantity: number; 
  }>;
  onAddToCart: (action: { type: 'ADD_ITEM'; drink: any; quantity: number }) => void;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
}

// Helper function to parse voice commands
const parseVoiceCommand = (command: string, drinks: VoiceCommandsProps['drinks']): { type: 'system' | 'order'; action?: 'stop' | 'help' | 'repeat'; items?: Array<{ name: string; quantity: number }> } | null => {
  const systemCommands = {
    stop: /stop listening/i,
    help: /(?:help|what can I say|commands|menu|what can you do)/i,
    repeat: /(?:repeat that|say that again|what did you say)/i,
  };

  for (const [action, pattern] of Object.entries(systemCommands)) {
    if (pattern.test(command)) {
      return { type: 'system', action };
    }
  }


  const orderPattern = /(?:add|order|get me|i want|i would like|i'd like|give me) (?:a |an )?([\w\s]+)(?:\s+(\d+))?/gi;
  const matches = [];
  let match;
  while ((match = orderPattern.exec(command)) !== null) {
    matches.push({ name: match[1].trim(), quantity: parseInt(match[2] || "1") });
  }

  if (matches.length > 0) {
    return { type: 'order', items: matches };
  }

  return null;
};


export function useVoiceCommands({
  drinks = [],
  cart = [],
  onAddToCart,
  onRemoveItem,
  onPlaceOrder
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const [location, navigate] = useLocation();
  const [lastCommand, setLastCommand] = useState<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const [lastResponse, setLastResponse] = useState<string>("");
  const COMMAND_DEBOUNCE_MS = 1000;

  // Helper function to speak and remember response
  const respondWith = useCallback(async (
    message: string, 
    voice: VoiceId = "alloy", 
    emotion: "neutral" | "excited" | "apologetic" = "neutral"
  ) => {
    setLastResponse(message);
    try {
      await voiceSynthesis.speak(message, voice, emotion);
    } catch (error) {
      console.error('Error speaking response:', error);
      // Fallback to browser's built-in speech synthesis
      try {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.0;
        utterance.pitch = emotion === 'excited' ? 1.2 : emotion === 'apologetic' ? 0.8 : 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (fallbackError) {
        console.error('Fallback speech synthesis failed:', fallbackError);
        // Show visual feedback when speech fails
        toast({
          title: "Voice Response",
          description: message,
          duration: 5000,
        });
      }
    }
  }, [toast]);

  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    console.log('Processing voice command:', {
      command,
      timestamp: now,
      lastCommand,
      hasAddToCart: !!onAddToCart,
      cartSize: cart.length,
      availableDrinks: drinks.length
    });

    // Prevent duplicate commands within the debounce window
    if (command === lastCommand.text && now - lastCommand.timestamp < COMMAND_DEBOUNCE_MS) {
      console.log('Skipping duplicate command:', command);
      return;
    }

    setLastCommand({ text: command, timestamp: now });

    // Parse the command using the enhanced parser
    const parsedCommand = parseVoiceCommand(command, drinks);

    if (!parsedCommand) {
      await respondWith(
        `I heard you say: ${text}. I apologize, but I didn't quite understand that. Try saying 'help' to learn what I can do.`,
        "shimmer",
        "apologetic"
      );
      return;
    }

    // Handle different command types
    switch (parsedCommand.type) {
      case 'system':
        switch (parsedCommand.action) {
          case 'stop':
            await respondWith("Voice commands deactivated.", "alloy", "neutral");
            stopListening();
            break;
          case 'help':
            await respondWith(
              "You can order drinks by saying 'I want a [drink name]', modify orders with 'make that 2 [drink name]', ask about drinks with 'tell me about [drink name]', or complete your order by saying 'confirm order'. You can also navigate pages by saying 'go to [page name]'.",
              "fable",
              "excited"
            );
            break;
          case 'repeat':
            if (lastResponse) {
              await respondWith(lastResponse, "alloy", "neutral");
            } else {
              await respondWith(
                "I don't have anything to repeat yet. How can I help you?",
                "alloy",
                "neutral"
              );
            }
            break;
        }
        break;

      case 'order':
        if (parsedCommand.items) {
          for (const item of parsedCommand.items) {
            const matchedDrink = drinks.find(d => d.name === item.name);
            if (matchedDrink) {
              onAddToCart({ type: 'ADD_ITEM', drink: matchedDrink, quantity: item.quantity });
            }
          }

          const itemDescriptions = parsedCommand.items
            .map(item => `${item.quantity} ${item.name}`)
            .join(' and ');

          await respondWith(
            `Added ${itemDescriptions} to your order. Would you like anything else?`,
            "fable",
            "excited"
          );

          toast({
            title: "Added to Order",
            description: `Added ${itemDescriptions}`,
          });
        }
        break;

      // Handle other command types...
    }
  }, [drinks, cart, lastCommand, lastResponse, onAddToCart, onRemoveItem, onPlaceOrder, respondWith, stopListening]);

  const findDrink = useCallback((name: string) => {
    // Remove common filler words and normalize input
    const normalizedInput = name.toLowerCase()
      .replace(/please|get|me|a|an|some|the/g, '')
      .trim();
    
    console.log('Searching for drink:', {
      originalInput: name,
      normalizedInput,
      availableDrinks: drinks.map(d => d.name.toLowerCase())
    });
    
    // First try exact match
    const exactMatch = drinks.find(d => 
      d.name.toLowerCase() === normalizedInput
    );
    
    if (exactMatch) {
      console.log('Found exact match:', exactMatch.name);
      return exactMatch;
    }
    
    // Then try partial matches with word boundaries
    const partialMatches = drinks.filter(d => {
      const drinkName = d.name.toLowerCase();
      return drinkName.includes(normalizedInput) ||
             normalizedInput.includes(drinkName) ||
             // Handle special cases like "cooler" variants
             (drinkName.includes('cooler') && normalizedInput.includes('cooler'));
    });
    
    if (partialMatches.length > 0) {
      // If multiple matches, prefer the shortest name as it's likely more specific
      const bestMatch = partialMatches.sort((a, b) => a.name.length - b.name.length)[0];
      console.log('Found best partial match:', {
        searchTerm: normalizedInput,
        matchedDrink: bestMatch.name,
        allMatches: partialMatches.map(d => d.name)
      });
      return bestMatch;
    }
    
    console.log('No drink match found:', {
      searchTerm: normalizedInput,
      availableDrinks: drinks.map(d => d.name)
    });
    return null;
  }, [drinks]);

  const startListening = useCallback(async () => {
    console.log('Attempting to start voice recognition...', {
      drinksAvailable: drinks.length,
      hasAddToCart: !!onAddToCart,
      hasRemoveItem: !!onRemoveItem,
      hasPlaceOrder: !!onPlaceOrder,
      cartItems: cart.length,
      isVoiceSupported: googleVoiceService.isSupported()
    });
    
    try {
      // Verify required props and data
      if (!drinks.length) {
        throw new Error('Drinks data not loaded');
      }
      
      if (typeof onAddToCart !== 'function') {
        throw new Error('Add to cart function not provided');
      }
      
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
      setIsListening(false);
      
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
      setIsListening(false);
      toast({
        title: "Error",
        description: error.message || "Failed to stop voice recognition",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    let mounted = true;
    
    return () => {
      mounted = false;
      if (isListening) {
        googleVoiceService.stopListening().catch(error => {
          console.error('Error during voice command cleanup:', error);
        });
      }
    };
  }, [isListening]);

  return {
    isListening,
    startListening,
    stopListening,
    isSupported: googleVoiceService.isSupported()
  };
}