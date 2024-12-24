import { useState, useEffect, useCallback, useRef } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
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
  onAddToCart?: (action: { type: 'ADD_ITEM'; drink: any; quantity: number }) => void;
  onRemoveItem?: (drinkId: number) => void;
  onPlaceOrder?: () => Promise<void>;
}

export function useVoiceCommands({
  drinks = [],
  cart = [],
  onAddToCart,
  onRemoveItem,
  onPlaceOrder
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const lastCommandRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 1000;

  // Helper function to validate dependencies
  const validateDependencies = useCallback(() => {
    const requirements = {
      hasDrinks: drinks.length > 0,
      hasAddToCart: !!onAddToCart,
      hasRemoveItem: !!onRemoveItem,
      hasPlaceOrder: !!onPlaceOrder
    };

    const missing = Object.entries(requirements)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missing.length) {
      console.log('Missing required dependencies:', {
        hasDrinks: requirements.hasDrinks,
        hasAddToCart: requirements.hasAddToCart,
        hasRemoveItem: requirements.hasRemoveItem,
        hasPlaceOrder: requirements.hasPlaceOrder
      });
      return `Required dependencies missing: ${missing.join(', ')}`;
    }
    return null;
  }, [drinks, onAddToCart, onRemoveItem, onPlaceOrder]);

  // Define stopListening before it's used in any callbacks
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop voice commands:', error);
      setIsListening(false);
    }
  }, [isListening]);

  // Helper function to speak responses
  const respondWith = useCallback(async (
    message: string, 
    voice: VoiceId = "alloy", 
    emotion: "neutral" | "excited" | "apologetic" = "neutral"
  ) => {
    if (!voiceSynthesis.isReady()) {
      console.warn('Voice synthesis not ready, displaying toast instead');
      toast({
        title: "Voice Response",
        description: message,
        duration: 5000,
      });
      return;
    }

    try {
      await voiceSynthesis.speak(message, voice, emotion);
    } catch (error) {
      console.error('Error speaking response:', error);
      toast({
        title: "Voice Response",
        description: message,
        duration: 5000,
      });
    }
  }, [toast]);

  // Process order function
  const processOrder = useCallback(async () => {
    if (!cart.length || !onPlaceOrder) {
      await respondWith(
        "Your cart is empty. Would you like to order some drinks first?",
        "shimmer",
        "apologetic"
      );
      return false;
    }

    const total = cart.reduce((sum, item) => 
      sum + (Number(item.drink.price) * item.quantity), 0
    );

    try {
      await respondWith(
        `Processing your order for ${cart.length} items, total $${total.toFixed(2)}...`,
        "fable",
        "excited"
      );

      await onPlaceOrder();

      await respondWith(
        "Order processed successfully! Your drinks will be ready shortly. Would you like to order anything else?",
        "fable",
        "excited"
      );

      toast({
        title: "Order Complete",
        description: `Successfully processed order for $${total.toFixed(2)}`,
      });

      return true;
    } catch (error) {
      console.error('Error processing order:', error);
      await respondWith(
        "I'm sorry, there was an error processing your order. Please try again.",
        "shimmer",
        "apologetic"
      );

      return false;
    }
  }, [cart, onPlaceOrder, respondWith, toast]);

  // Handle voice commands
  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    // Prevent duplicate commands within the debounce window
    if (command === lastCommandRef.current.text && 
        now - lastCommandRef.current.timestamp < COMMAND_DEBOUNCE_MS) {
      return;
    }

    lastCommandRef.current = { text: command, timestamp: now };

    // Check for order completion commands first
    if (/(?:complete|finish|process|submit|confirm|checkout|pay for|place)\s+(?:the\s+)?order/.test(command) ||
        /(?:i(?:\'m|\s+am)\s+(?:done|finished|ready))|(?:that(?:\'s|\s+is)\s+all)/.test(command)) {
      await processOrder();
      return;
    }

    // Order matching
    const orderMatch = command.match(/(?:get|order|give|i want|i'll have|i would like)\s+(?:a |an |some )?(.+)/i);
    if (orderMatch && onAddToCart) {
      const orderText = orderMatch[1];
      const items = orderText.split(/\s+and\s+|\s*,\s*/);
      let addedItems = [];

      for (const item of items) {
        const quantityMatch = item.match(/(\d+|a|one|two|three|four|five)\s+(.+)/i);
        let quantity = 1;
        let drinkName = item;

        if (quantityMatch) {
          const [_, qStr, dName] = quantityMatch;
          quantity = parseInt(qStr) || 
                    { 'a': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5 }[qStr.toLowerCase()] || 
                    1;
          drinkName = dName;
        }

        const matchedDrink = drinks.find(d => 
          d.name.toLowerCase().includes(drinkName.toLowerCase()) ||
          drinkName.toLowerCase().includes(d.name.toLowerCase())
        );

        if (matchedDrink) {
          onAddToCart({ type: 'ADD_ITEM', drink: matchedDrink, quantity });
          addedItems.push(`${quantity} ${matchedDrink.name}`);
        }
      }

      if (addedItems.length > 0) {
        const itemsList = addedItems.join(' and ');
        await respondWith(
          `I've added ${itemsList} to your order. Say 'complete order' when you're ready to finish.`,
          "fable",
          "excited"
        );

        toast({
          title: "Added to Order",
          description: `Added ${itemsList}`,
        });
      } else {
        await respondWith(
          "I couldn't find any matching drinks. Please try again or say 'help' for assistance.",
          "shimmer",
          "apologetic"
        );
      }
      return;
    }

    // Help command
    if (/help|what can i say|commands/.test(command)) {
      await respondWith(
        "You can order drinks by saying things like 'I want a Moscow Mule' or 'get me two beers'. Say 'complete order' or 'process order' to finalize your purchase.",
        "fable",
        "excited"
      );
      return;
    }

    // Stop command
    if (/stop|end|quit|exit/.test(command)) {
      await respondWith("Voice commands deactivated.", "alloy", "neutral");
      await stopListening();
      return;
    }

    // Fallback for unrecognized commands
    await respondWith(
      `I heard you say: ${text}. I didn't quite understand that. Try saying 'help' to learn what I can do.`,
      "shimmer",
      "apologetic"
    );
  }, [drinks, onAddToCart, respondWith, stopListening, toast, processOrder]);

  // Start listening function
  const startListening = useCallback(async () => {
    const validationError = validateDependencies();
    if (validationError) {
      throw new Error(validationError);
    }

    try {
      if (!googleVoiceService.isSupported()) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      await googleVoiceService.startListening(handleVoiceCommand);
      setIsListening(true);

      await respondWith(
        "Voice commands activated. I'm listening and ready to help! Say 'help' to learn what I can do.",
        "fable",
        "excited"
      );

      toast({
        title: "Voice Commands Active",
        description: "Listening for your commands...",
      });
    } catch (error) {
      console.error('Failed to start voice commands:', error);
      setIsListening(false);
      throw error;
    }
  }, [handleVoiceCommand, respondWith, toast, validateDependencies]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (isListening) {
        googleVoiceService.stopListening().catch(console.error);
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