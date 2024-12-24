import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { voiceSynthesis } from '@/lib/voice-synthesis';
import { useLocation } from 'wouter';

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
  onPlaceOrder: () => Promise<void>;
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
  const [_, navigate] = useLocation();
  const [lastCommand, setLastCommand] = useState<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 1000;

  // Validate required dependencies early
  if (!Array.isArray(drinks) || !onAddToCart || !onRemoveItem || !onPlaceOrder) {
    console.error('Missing required dependencies:', {
      hasDrinks: Array.isArray(drinks),
      hasAddToCart: !!onAddToCart,
      hasRemoveItem: !!onRemoveItem,
      hasPlaceOrder: !!onPlaceOrder
    });
    throw new Error('Required dependencies missing');
  }

  // Define stopListening before it's used in any callbacks
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      toast({
        title: "Voice Commands Stopped",
        description: "Voice recognition is now inactive.",
      });
    } catch (error) {
      console.error('Failed to stop voice commands:', error);
      setIsListening(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to stop voice recognition",
        variant: "destructive",
      });
    }
  }, [isListening, toast]);

  // Helper function to speak responses
  const respondWith = useCallback(async (
    message: string, 
    voice: VoiceId = "alloy", 
    emotion: "neutral" | "excited" | "apologetic" = "neutral"
  ) => {
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
    if (cart.length === 0) {
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
        "Your order has been processed successfully! Would you like to order anything else?",
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

      toast({
        title: "Order Failed",
        description: "There was an error processing your order. Please try again.",
        variant: "destructive"
      });

      return false;
    }
  }, [cart, onPlaceOrder, respondWith, toast]);

  // Handle voice commands
  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    // Prevent duplicate commands within the debounce window
    if (command === lastCommand.text && now - lastCommand.timestamp < COMMAND_DEBOUNCE_MS) {
      return;
    }

    setLastCommand({ text: command, timestamp: now });

    // Check for order completion commands first
    if (/(?:complete|finish|process|submit|confirm|checkout|pay for|place)\s+(?:the\s+)?order/.test(command) ||
        /(?:i(?:\'m|\s+am)\s+(?:done|finished|ready))|(?:that(?:\'s|\s+is)\s+all)/.test(command)) {
      await processOrder();
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

    // Order matching
    const orderMatch = command.match(/(?:get|order|give|i want|i'll have|i would like)\s+(?:a |an |some )?(.+)/i);
    if (orderMatch) {
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

    // Fallback for unrecognized commands
    await respondWith(
      `I heard you say: ${text}. I didn't quite understand that. Try saying 'help' to learn what I can do.`,
      "shimmer",
      "apologetic"
    );
  }, [drinks, cart, lastCommand, onAddToCart, respondWith, stopListening, toast, processOrder]);

  // Start listening function
  const startListening = useCallback(async () => {
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

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start voice recognition",
        variant: "destructive",
      });

      throw error;
    }
  }, [handleVoiceCommand, respondWith, toast]);

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