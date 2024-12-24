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
        toast({
          title: "Voice Response",
          description: message,
          duration: 5000,
        });
      }
    }
  }, [toast]);

  // Define stopListening before using it in handleVoiceCommand
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await googleVoiceService.stopListening();
      setIsListening(false);

      await voiceSynthesis.speak("Voice commands deactivated.");

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
  }, [isListening, toast]);

  const handleVoiceCommand = useCallback(async (text: string) => {
    // Validate required dependencies before processing commands
    if (!text || !Array.isArray(drinks) || drinks.length === 0) {
      console.warn('Missing required dependencies:', { 
        hasText: !!text, 
        hasDrinks: Array.isArray(drinks) && drinks.length > 0 
      });
      return;
    }

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

    // Check for system commands first
    if (/stop|end|quit|exit/.test(command)) {
      await respondWith("Voice commands deactivated.", "alloy", "neutral");
      await stopListening();
      return;
    }

    // Help command
    if (/help|what can i say|commands/.test(command)) {
      await respondWith(
        "You can order drinks by saying things like 'I want a Moscow Mule' or 'get me two beers'. Say 'complete order' or 'process order' to finalize your purchase. You can also say 'stop' to turn off voice commands.",
        "fable",
        "excited"
      );
      return;
    }

    // Complete order command
    if (/(?:complete|finish|process|submit|confirm|checkout)\s+(?:the\s+)?order/.test(command)) {
      if (!onPlaceOrder) {
        console.error('Place order function not available');
        return;
      }

      if (cart.length === 0) {
        await respondWith(
          "Your cart is empty. Would you like to order some drinks first?",
          "shimmer",
          "apologetic"
        );
        return;
      }

      const total = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);

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
      } catch (error) {
        console.error('Error processing order:', error);
        await respondWith(
          "I'm sorry, there was an error processing your order. Please try again.",
          "shimmer",
          "apologetic"
        );
      }
      return;
    }

    // Order matching
    const orderMatch = command.match(/(?:get|order|give|i want|i'll have|i would like)\s+(?:a |an |some )?(.+)/i);
    if (orderMatch && onAddToCart) {
      const orderText = orderMatch[1];
      // Split multiple items
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
          `I've added ${itemsList} to your order. Say 'complete order' when you're ready to finish, or continue ordering.`,
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
      `I heard you say: ${text}. I apologize, but I didn't quite understand that. Try saying 'help' to learn what I can do.`,
      "shimmer",
      "apologetic"
    );
  }, [drinks, cart, lastCommand, onAddToCart, onPlaceOrder, respondWith, stopListening]);

  const startListening = useCallback(async () => {
    console.log('Attempting to start voice recognition...', {
      drinksAvailable: drinks.length,
      hasAddToCart: !!onAddToCart,
      cartSize: cart.length,
      isVoiceSupported: googleVoiceService.isSupported()
    });

    try {
      if (!googleVoiceService.isSupported()) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      if (!Array.isArray(drinks) || drinks.length === 0) {
        throw new Error('Drinks data not yet loaded');
      }

      if (!onAddToCart || typeof onAddToCart !== 'function') {
        throw new Error('Add to cart function not provided');
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

      throw error; // Re-throw to allow parent components to handle the error
    }
  }, [drinks, onAddToCart, toast, handleVoiceCommand]);

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