import { useState, useEffect, useCallback, useRef } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { voiceSynthesis } from '@/lib/voice-synthesis';
import type { DrinkItem, CartItem, AddToCartAction } from '@/types/speech';

interface VoiceCommandsProps {
  drinks: DrinkItem[];
  cart: CartItem[];
  onAddToCart?: (action: AddToCartAction) => void;
  onRemoveItem?: (drinkId: number) => void;
  onPlaceOrder?: () => Promise<void>;
}

export function useVoiceCommands({
  drinks = [],
  cart = [],
  onAddToCart = () => {},
  onRemoveItem = () => {},
  onPlaceOrder = async () => {}
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const lastCommandRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 1000;
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to validate dependencies
  const validateDependencies = useCallback((): boolean => {
    const isValid = drinks.length > 0 && 
                   typeof onAddToCart === 'function' &&
                   typeof onRemoveItem === 'function' &&
                   typeof onPlaceOrder === 'function';

    console.log('Validating voice command dependencies:', {
      drinks: drinks.length > 0,
      handlers: {
        addToCart: typeof onAddToCart === 'function',
        removeItem: typeof onRemoveItem === 'function',
        placeOrder: typeof onPlaceOrder === 'function'
      }
    });

    return isValid;
  }, [drinks, onAddToCart, onRemoveItem, onPlaceOrder]);

  // Define stopListening before it's used in any callbacks
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      console.log('Voice commands stopped successfully');
    } catch (error) {
      console.error('Failed to stop voice commands:', error);
      setIsListening(false);
    }
  }, [isListening]);

  // Helper function to speak responses
  const respondWith = useCallback(async (
    message: string, 
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
      // Store current listening state
      const wasListening = googleVoiceService.isActive();

      // Attempt to speak with automatic recognition resume
      await voiceSynthesis.speak(message, undefined, emotion);

      // If recognition was active and hasn't been resumed, restart it
      if (wasListening && !googleVoiceService.isActive()) {
        console.log('Ensuring speech recognition resumes...');
        try {
          await googleVoiceService.startListening(handleVoiceCommand);
        } catch (error) {
          console.error('Failed to resume speech recognition after response:', error);
          // Try one more time after a short delay
          if (restartTimeoutRef.current) {
            clearTimeout(restartTimeoutRef.current);
          }
          restartTimeoutRef.current = setTimeout(async () => {
            try {
              await googleVoiceService.startListening(handleVoiceCommand);
            } catch (retryError) {
              console.error('Failed to resume speech recognition on retry:', retryError);
              setIsListening(false);
            }
          }, 100);
        }
      }
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
    if (!cart.length) {
      await respondWith(
        "Your cart is empty. Would you like to order some drinks first?",
        "apologetic"
      );
      return false;
    }

    const total = cart.reduce((sum, item) => 
      sum + (item.drink.price * item.quantity), 0
    );

    try {
      console.log('Processing order:', { cart, total });

      await respondWith(
        `Processing your order for ${cart.length} items, total $${total.toFixed(2)}...`,
        "excited"
      );

      // Simple demo payment processing
      const response = await fetch('/api/payment/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: total * 100, // Convert to cents
          items: cart.map(item => ({
            id: item.drink.id,
            quantity: item.quantity,
            price: item.drink.price
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Payment processing failed');
      }

      // Call the provided onPlaceOrder handler
      await onPlaceOrder();

      await respondWith(
        "Order processed successfully! Your drinks will be ready shortly. Would you like to order anything else?",
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
        "apologetic"
      );

      toast({
        title: "Order Error",
        description: "Failed to process order. Please try again.",
        variant: "destructive",
      });

      return false;
    }
  }, [cart, onPlaceOrder, respondWith, toast]);

  // Handle voice commands with improved regex patterns
  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    if (command === lastCommandRef.current.text && 
        now - lastCommandRef.current.timestamp < COMMAND_DEBOUNCE_MS) {
      return;
    }

    lastCommandRef.current = { text: command, timestamp: now };
    console.log('Processing voice command:', command);

    try {
      // Check for order completion commands first
      if (/(?:complete|finish|process|submit|confirm|checkout|pay for|place)\s+(?:the\s+)?order/.test(command) ||
          /(?:i(?:\'m|\s+am)\s+(?:done|finished|ready))|(?:that(?:\'s|\s+is)\s+all)/.test(command)) {
        await processOrder();
        return;
      }

      // Enhanced order matching with multiple patterns
      const orderPatterns = [
        /(?:get|order|give|i want|i'll have|i would like|i'll take)\s+(?:a |an |some )?(.+)/i,
        /(?:bring|fetch|grab)\s+(?:me )?(?:a |an |some )?(.+)/i
      ];

      let orderMatch = null;
      for (const pattern of orderPatterns) {
        orderMatch = command.match(pattern);
        if (orderMatch) break;
      }

      if (orderMatch) {
        const orderText = orderMatch[1];
        // Split on common conjunctions and punctuation
        const items = orderText.split(/\s+and\s+|\s*,\s*|\s+with\s+|\s+plus\s+/);
        let addedItems = [];

        for (const item of items) {
          // Enhanced quantity matching
          const quantityMatch = item.match(/(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)/i);
          let quantity = 1;
          let drinkName = item;

          if (quantityMatch) {
            const [_, qStr, dName] = quantityMatch;
            const numberWords: { [key: string]: number } = {
              'a': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
              'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
            };
            quantity = parseInt(qStr) || numberWords[qStr.toLowerCase()] || 1;
            drinkName = dName;
          }

          console.log('Searching for drink:', drinkName);
          const matchedDrink = drinks.find(d => {
            const isMatch = d.name.toLowerCase().includes(drinkName.toLowerCase()) ||
                          drinkName.toLowerCase().includes(d.name.toLowerCase());
            console.log('Checking drink:', d.name, 'Match:', isMatch);
            return isMatch;
          });

          if (matchedDrink) {
            console.log('Adding to cart:', { drink: matchedDrink, quantity });
            onAddToCart({ 
              type: 'ADD_ITEM', 
              drink: { 
                id: matchedDrink.id,
                name: matchedDrink.name,
                price: matchedDrink.price,
                category: matchedDrink.category
              }, 
              quantity 
            });
            addedItems.push(`${quantity} ${matchedDrink.name}`);
          }
        }

        if (addedItems.length > 0) {
          const itemsList = addedItems.join(' and ');
          const currentTotal = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);

          await respondWith(
            `I've added ${itemsList} to your order. Your total is $${currentTotal.toFixed(2)}. Say 'complete order' when you're ready to finish.`,
            "excited"
          );

          toast({
            title: "Added to Order",
            description: `Added ${itemsList}`,
          });
        } else {
          await respondWith(
            "I couldn't find any matching drinks. Please try again or say 'help' for assistance.",
            "apologetic"
          );
        }
        return;
      }

      // Help command
      if (/help|what can i say|commands/.test(command)) {
        const currentTotal = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);
        await respondWith(
          "You can order drinks by saying things like 'I want a Moscow Mule' or 'get me two beers'. Say 'complete order' or 'process order' to finalize your purchase. Your current total is $" + currentTotal.toFixed(2),
          "excited"
        );
        return;
      }

      // Stop command
      if (/stop|end|quit|exit/.test(command)) {
        await respondWith("Voice commands deactivated.", "neutral");
        await stopListening();
        return;
      }

      // Fallback for unrecognized commands
      await respondWith(
        `I heard you say: ${text}. I didn't quite understand that. Try saying 'help' to learn what I can do.`,
        "apologetic"
      );
    } catch (error) {
      console.error('Error processing voice command:', error);
      await respondWith(
        "I'm sorry, I had trouble processing that command. Please try again.",
        "apologetic"
      );
    }
  }, [drinks, onAddToCart, respondWith, stopListening, toast, processOrder, cart]);

  // Start listening function
  const startListening = useCallback(async () => {
    try {
      console.log('Starting voice recognition...');
      if (!googleVoiceService.isSupported()) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      await googleVoiceService.startListening(handleVoiceCommand);
      setIsListening(true);

      await respondWith(
        "Voice commands activated. I'm listening and ready to help! Say 'help' to learn what I can do.",
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
  }, [handleVoiceCommand, respondWith, toast]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (isListening) {
        googleVoiceService.stopListening().catch(console.error);
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
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