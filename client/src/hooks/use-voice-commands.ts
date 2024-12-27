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
  onAddToCart,
  onRemoveItem,
  onPlaceOrder
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const lastCommandRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 500;

  const validateDependencies = useCallback((): boolean => {
    if (!drinks.length || !onAddToCart || !onRemoveItem || !onPlaceOrder) {
      console.error('Missing dependencies:', {
        drinks: !!drinks.length,
        onAddToCart: !!onAddToCart,
        onRemoveItem: !!onRemoveItem,
        onPlaceOrder: !!onPlaceOrder
      });
      return false;
    }
    return true;
  }, [drinks, onAddToCart, onRemoveItem, onPlaceOrder]);

  const showFeedback = useCallback((title: string, message: string, type: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description: message,
      variant: type,
      duration: 2000,
    });
  }, [toast]);

  const processOrder = useCallback(async () => {
    if (isProcessing) {
      showFeedback('Processing', 'Please wait...', 'destructive');
      return false;
    }

    if (!cart.length) {
      showFeedback('Empty Cart', 'Your cart is empty', 'destructive');
      return false;
    }

    try {
      setIsProcessing(true);
      const total = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);
      showFeedback('Processing Order', `Total: $${total.toFixed(2)}`);
      await onPlaceOrder();
      showFeedback('Success', 'Order complete!');
      return true;
    } catch (error) {
      console.error('Error processing order:', error);
      showFeedback('Error', 'Failed to process order', 'destructive');
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [cart, onPlaceOrder, showFeedback, isProcessing]);

  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text?.trim()) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    if (command === lastCommandRef.current.text && 
        now - lastCommandRef.current.timestamp < COMMAND_DEBOUNCE_MS) {
      return;
    }

    lastCommandRef.current = { text: command, timestamp: now };
    console.log('Processing voice command:', command);

    try {
      // Process complete order commands
      if (/(?:complete|finish|process|submit|confirm|checkout|pay for|place)\s+(?:the\s+)?order/.test(command) ||
          /(?:i(?:\'m|\s+am)\s+(?:done|finished|ready))|(?:that(?:\'s|\s+is)\s+all)/.test(command)) {
        await processOrder();
        return;
      }

      // Process add to cart commands with improved pattern matching
      const orderPatterns = [
        /(?:get|order|add|want|have)\s+(?:a |an |some |the )?(.+)/i,
        /(?:bring|fetch|grab)\s+(?:me )?(?:a |an |some |the )?(.+)/i,
        /(?:put)\s+(?:a |an |some |the )?(.+)(?:\s+(?:in|to)\s+(?:my\s+)?(?:order|cart))?/i
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
          console.log('Searching for drink:', item);
          const quantityMatch = item.match(/(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)/i);
          let quantity = 1;
          let drinkName = item;

          if (quantityMatch) {
            const [_, qStr, dName] = quantityMatch;
            const numberWords: { [key: string]: number } = {
              'a': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
              'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
            };
            quantity = parseInt(qStr) || numberWords[qStr.toLowerCase()] || 1;
            drinkName = dName;
          }

          const matchedDrink = drinks.find(d => {
            const drinkLower = d.name.toLowerCase();
            const searchLower = drinkName.toLowerCase();
            return drinkLower.includes(searchLower) || searchLower.includes(drinkLower);
          });

          if (matchedDrink) {
            console.log('Adding to cart:', { drink: matchedDrink.name, quantity });
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
          showFeedback('Added to Cart', `Added ${itemsList}. Total: $${currentTotal.toFixed(2)}`);
        } else {
          showFeedback('Not Found', 'Could not find drink. Try again', 'destructive');
        }
        return;
      }

      if (/help|what can i say|commands/.test(command)) {
        showFeedback(
          'Voice Commands',
          'Try: "I want a Moscow Mule" or "add two beers". Say "complete order" to finish.'
        );
        return;
      }

      showFeedback(
        'Not Understood',
        'Try saying "help" for commands',
        'destructive'
      );
    } catch (error) {
      console.error('Error processing command:', error);
      showFeedback('Error', 'Failed to process command', 'destructive');
    }
  }, [drinks, onAddToCart, processOrder, cart, showFeedback]);

  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      showFeedback('Voice Control', 'Stopped');
    } catch (error) {
      console.error('Failed to stop:', error);
      setIsListening(false);
    }
  }, [isListening, showFeedback]);

  const startListening = useCallback(async () => {
    try {
      if (!googleVoiceService.isSupported()) {
        throw new Error('Speech recognition not supported');
      }

      if (!validateDependencies()) {
        throw new Error('Required dependencies unavailable');
      }

      await googleVoiceService.startListening(handleVoiceCommand);
      setIsListening(true);
      showFeedback('Voice Control', 'Listening... Say "help" for commands');
    } catch (error) {
      console.error('Failed to start:', error);
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