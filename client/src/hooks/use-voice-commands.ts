import { useState, useEffect, useCallback, useRef } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
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
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const lastCommandRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 500; // Reduced debounce time for faster response

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

  const showFeedback = useCallback((title: string, message: string, type: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description: message,
      variant: type,
      duration: 3000, // Reduced duration for faster feedback
    });
  }, [toast]);

  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      showFeedback('Voice Control', 'Voice commands stopped');
    } catch (error) {
      console.error('Failed to stop voice commands:', error);
      setIsListening(false);
    }
  }, [isListening, showFeedback]);

  const processOrder = useCallback(async () => {
    if (isProcessing) {
      showFeedback('Processing', 'Please wait while processing your previous order', 'destructive');
      return false;
    }

    if (!cart.length) {
      showFeedback('Empty Cart', 'Your cart is empty. Please add some drinks first', 'destructive');
      return false;
    }

    const total = cart.reduce((sum, item) => 
      sum + (item.drink.price * item.quantity), 0
    );

    try {
      setIsProcessing(true);
      showFeedback('Processing Order', `Processing order for $${total.toFixed(2)}`);

      const response = await fetch('/api/payment/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: total * 100, // Convert to cents for Stripe
          items: cart.map(item => ({
            id: item.drink.id,
            quantity: item.quantity,
            price: item.drink.price
          }))
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      await onPlaceOrder();
      showFeedback('Success', `Order processed successfully! Total: $${total.toFixed(2)}`);
      return true;
    } catch (error) {
      console.error('Error processing order:', error);
      showFeedback('Error', 'Failed to process order. Please try again', 'destructive');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [cart, onPlaceOrder, showFeedback]);

  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    // Debounce handling with reduced timeout
    if (command === lastCommandRef.current.text && 
        now - lastCommandRef.current.timestamp < COMMAND_DEBOUNCE_MS) {
      return;
    }

    lastCommandRef.current = { text: command, timestamp: now };
    console.log('Processing voice command:', command);

    try {
      if (/(?:complete|finish|process|submit|confirm|checkout|pay for|place)\s+(?:the\s+)?order/.test(command) ||
          /(?:i(?:\'m|\s+am)\s+(?:done|finished|ready))|(?:that(?:\'s|\s+is)\s+all)/.test(command)) {
        await processOrder();
        return;
      }

      // Enhanced order patterns for faster matching
      const orderPatterns = [
        /(?:get|order|give|want|have|like|take)\s+(?:a |an |some )?(.+)/i,
        /(?:bring|fetch|grab)\s+(?:me )?(?:a |an |some )?(.+)/i,
        /(?:add|put)\s+(?:a |an |some )?(.+)(?:\s+to\s+(?:my\s+)?(?:order|cart))?/i
      ];

      let orderMatch = null;
      for (const pattern of orderPatterns) {
        orderMatch = command.match(pattern);
        if (orderMatch) break;
      }

      if (orderMatch) {
        const orderText = orderMatch[1];
        const items = orderText.split(/\s+and\s+|\s*,\s*|\s+with\s+|\s+plus\s+/);
        let addedItems = [];

        for (const item of items) {
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

          const matchedDrink = drinks.find(d => {
            return d.name.toLowerCase().includes(drinkName.toLowerCase()) ||
                   drinkName.toLowerCase().includes(d.name.toLowerCase());
          });

          if (matchedDrink) {
            onAddToCart({ 
              type: 'ADD_ITEM', 
              drink: matchedDrink,
              quantity 
            });
            addedItems.push(`${quantity} ${matchedDrink.name}`);
          }
        }

        if (addedItems.length > 0) {
          const itemsList = addedItems.join(' and ');
          const currentTotal = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);
          showFeedback('Added to Order', `Added ${itemsList}. Total: $${currentTotal.toFixed(2)}`);
        } else {
          showFeedback('Not Found', 'Could not find matching drinks. Try again', 'destructive');
        }
        return;
      }

      if (/help|what can i say|commands/.test(command)) {
        const currentTotal = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);
        showFeedback(
          'Voice Commands Help',
          `Try: "I want a Moscow Mule" or "get me two beers". Say "complete order" to finish. Current total: $${currentTotal.toFixed(2)}`
        );
        return;
      }

      if (/stop|end|quit|exit/.test(command)) {
        await stopListening();
        return;
      }

      showFeedback(
        'Not Understood',
        'Command not recognized. Try saying "help" for available commands',
        'destructive'
      );
    } catch (error) {
      console.error('Error processing voice command:', error);
      showFeedback('Error', 'Failed to process command. Please try again', 'destructive');
    }
  }, [drinks, onAddToCart, stopListening, showFeedback, processOrder, cart]);

  const startListening = useCallback(async () => {
    try {
      if (!googleVoiceService.isSupported()) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      if (!validateDependencies()) {
        throw new Error('Required dependencies are not available');
      }

      await googleVoiceService.startListening(handleVoiceCommand);
      setIsListening(true);
      showFeedback('Voice Control', 'Listening for commands... Say "help" for available commands');
    } catch (error) {
      console.error('Failed to start voice commands:', error);
      setIsListening(false);
      throw error;
    }
  }, [handleVoiceCommand, showFeedback, validateDependencies]);

  useEffect(() => {
    return () => {
      if (isListening) {
        googleVoiceService.stopListening().catch(console.error);
      }
    };
  }, [isListening]);

  return {
    isListening,
    isProcessing,
    startListening,
    stopListening,
    isSupported: googleVoiceService.isSupported()
  };
}