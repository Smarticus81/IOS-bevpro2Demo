import { useState, useEffect, useCallback } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { voiceSynthesis } from '@/lib/voice-synthesis';

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

// Enhanced response templates for different scenarios
const RESPONSES = {
  welcome: "I'm here to assist with your order. You can ask for drinks like 'I'd like a Moscow Mule' or 'three beers please'. How may I help you today?",
  orderConfirmation: (items: string) => `I've added ${items} to your order. Would you like anything else?`,
  orderComplete: (total: number) => `Perfect. Your order total comes to $${total.toFixed(2)}. I'll process that right away for you.`,
  orderSuccess: "Your order has been successfully processed. Is there anything else I can help you with?",
  notFound: (drink: string) => `I apologize, but I couldn't find ${drink} in our menu. Would you like me to suggest some alternatives?`,
  help: "Let me assist you. You can order drinks by saying phrases like 'I'd like a Moscow Mule' or 'three beers please'. When you're ready to complete your order, just say 'process order' or 'complete order'. How can I help you today?",
  error: "I apologize for the inconvenience. There seems to be an error. Please try again or let me know if you need assistance.",
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
  const COMMAND_DEBOUNCE_MS = 1000;

  const respondWith = useCallback(async (
    message: string,
    emotion: "professional" | "friendly" | "excited" | "apologetic" | "confirmative" = "professional"
  ) => {
    try {
      await voiceSynthesis.speak(message, emotion);
    } catch (error) {
      console.error('Error speaking response:', error);
      toast({
        title: "Voice Response",
        description: message,
        duration: 5000,
      });
    }
  }, [toast]);

  const stopListening = useCallback(async () => {
    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      await respondWith("Voice commands deactivated.", "professional");
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
  }, [respondWith, toast]);

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
      availableDrinks: drinks.length,
      currentCart: cart // Add this for debugging
    });

    if (command === lastCommand.text && now - lastCommand.timestamp < COMMAND_DEBOUNCE_MS) {
      return;
    }

    setLastCommand({ text: command, timestamp: now });

    // Enhanced command patterns
    const patterns = {
      stop: /(?:stop|end|quit|exit|turn off|disable)\s+(?:listening|voice|commands?)/i,
      help: /(?:help|what can (?:I|you) (?:say|do)|how does this work|what are my options)/i,
      order: /(?:(?:can|could|may) (?:I|you)|(?:I|I'd) (?:like|want|would like)|(?:give|get|bring) me|order|add)\s+(?:a |an |some )?(.+)/i,
      complete: /(?:complete|finish|process|submit|confirm|checkout|pay for|finalize)\s+(?:the\s+)?order/i,
    };

    // Handle system commands
    if (patterns.stop.test(command)) {
      await respondWith("Voice commands deactivated. Have a great day!", "professional");
      await stopListening();
      return;
    }

    if (patterns.help.test(command)) {
      await respondWith(RESPONSES.help, "friendly");
      return;
    }

    // Handle order completion
    if (patterns.complete.test(command)) {
      console.log('Attempting to process order with cart:', cart);

      if (!cart || cart.length === 0) {
        await respondWith(
          "Your cart is currently empty. Would you like to order some drinks?",
          "friendly"
        );
        return;
      }

      const total = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);
      console.log('Calculated order total:', total);

      try {
        await respondWith(RESPONSES.orderComplete(total), "confirmative");

        // Call the order processing function
        await onPlaceOrder();
        console.log('Order processed successfully');

        await respondWith(RESPONSES.orderSuccess, "professional");

        toast({
          title: "Order Complete",
          description: `Successfully processed order for $${total.toFixed(2)}`,
        });
      } catch (error) {
        console.error('Error processing order:', error);
        await respondWith(RESPONSES.error, "apologetic");
      }
      return;
    }

    // Handle drink orders
    const orderMatch = command.match(patterns.order);
    if (orderMatch) {
      const orderText = orderMatch[1];
      const items = orderText.split(/\s+and\s+|\s*,\s*/);
      const successfulOrders: string[] = [];

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
          successfulOrders.push(`${quantity} ${matchedDrink.name}`);
        }
      }

      if (successfulOrders.length > 0) {
        const itemsList = successfulOrders.join(' and ');
        await respondWith(RESPONSES.orderConfirmation(itemsList), "friendly");
      } else {
        await respondWith(
          "I'm sorry, I couldn't find the drinks you mentioned. Would you like me to list our available options?",
          "apologetic"
        );
      }
      return;
    }

    // Fallback for unrecognized commands
    await respondWith(
      `I heard "${text}". If you'd like to order drinks, you can say something like "I'd like a Moscow Mule" or "three beers please". How can I assist you?`,
      "friendly"
    );
  }, [drinks, cart, lastCommand, onAddToCart, onPlaceOrder, respondWith, stopListening, toast]);

  const startListening = useCallback(async () => {
    console.log('Attempting to start voice recognition...', {
      drinksAvailable: drinks.length,
      hasAddToCart: !!onAddToCart,
      cartSize: cart.length,
      isVoiceSupported: googleVoiceService.isSupported()
    });

    try {
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
          "excited"
        );
      } catch (synthError) {
        console.error('Error with voice synthesis:', synthError);
      }

      toast({
        title: "Voice Commands Active",
        description: "Listening for your commands...",
      });
    } catch (error: any) {
      console.error('Failed to start voice commands:', error);
      setIsListening(false);

      toast({
        title: "Error",
        description: error.message || "Failed to start voice recognition",
        variant: "destructive",
      });
    }
  }, [drinks, onAddToCart, handleVoiceCommand, toast, cart]);

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