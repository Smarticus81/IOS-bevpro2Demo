import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { DrinkItem, AddToCartAction } from '@/types/speech';
import { googleVoiceService } from '@/lib/google-voice-service';
import type { CartItem } from '@/types/cart';
import { logger } from '@/lib/logger';

interface VoiceCommandsProps {
  drinks: DrinkItem[];
  cart: CartItem[];
  onAddToCart: (action: AddToCartAction) => Promise<void>;
  onRemoveItem: (drinkId: number) => Promise<void>;
  onPlaceOrder: () => Promise<void>;
  isProcessing: boolean;
}

export function useVoiceCommands({
  drinks = [],
  cart = [],
  onAddToCart,
  onRemoveItem,
  onPlaceOrder,
  isProcessing = false,
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const lastCommandRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 500;

  const validateDependencies = useCallback((): boolean => {
    const dependencies = {
      drinks: !!drinks.length,
      onAddToCart: !!onAddToCart,
      onRemoveItem: !!onRemoveItem,
      onPlaceOrder: !!onPlaceOrder,
    };

    const isValid = Object.values(dependencies).every(Boolean);

    if (!isValid) {
      logger.error('Missing dependencies:', dependencies);
    }

    return isValid;
  }, [drinks, onAddToCart, onRemoveItem, onPlaceOrder]);

  const showFeedback = useCallback(
    (title: string, message: string, type: 'default' | 'destructive' = 'default') => {
      toast({ title, description: message, variant: type });
      logger.info(`${title}: ${message}`);
    },
    [toast]
  );

  const processOrder = useCallback(async () => {
    try {
      logger.info('Processing order request', {
        cartSize: cart.length,
        isProcessing,
        hasItems: cart.length > 0
      });

      if (!cart || !cart.length) {
        showFeedback('Empty Cart', 'Your cart is empty', 'destructive');
        return false;
      }

      if (isProcessing) {
        showFeedback('Processing', 'Please wait while we process your order...', 'default');
        return false;
      }

      const total = cart.reduce((sum, item) => sum + item.drink.price * item.quantity, 0);
      showFeedback('Processing Order', `Total: $${total.toFixed(2)}`);

      await onPlaceOrder();
      showFeedback('Success', 'Order complete!');
      return true;
    } catch (error) {
      logger.error('Error processing order:', error);
      showFeedback('Error', error instanceof Error ? error.message : 'Failed to process order', 'destructive');
      return false;
    }
  }, [cart, onPlaceOrder, isProcessing, showFeedback]);

  const handleVoiceCommand = useCallback(
    async (text: string) => {
      if (!text?.trim()) return;

      const command = text.toLowerCase().trim();
      const now = Date.now();

      logger.info('Processing voice command:', command);

      // Debounce similar commands
      if (
        command === lastCommandRef.current.text &&
        now - lastCommandRef.current.timestamp < COMMAND_DEBOUNCE_MS
      ) {
        return;
      }

      lastCommandRef.current = { text: command, timestamp: now };

      try {
        if (/complete|checkout|finish|process/.test(command)) {
          await processOrder();
          return;
        }

        if (/help/.test(command)) {
          showFeedback(
            'Voice Commands',
            'Try commands like "Add a Moscow Mule" or "Complete my order".'
          );
          return;
        }

        const orderPatterns = /add|order|want|get|have/i;
        if (orderPatterns.test(command)) {
          const { drink, quantity } = matchDrink(command);
          if (drink) {
            await onAddToCart({ type: 'ADD_ITEM', drink, quantity });
            showFeedback('Added to Cart', `Added ${quantity} ${drink.name}(s) to your cart.`);
          } else {
            showFeedback(
              'Drink Not Found',
              'Could not find the requested drink. Try again.',
              'destructive'
            );
          }
          return;
        }

        showFeedback(
          'Not Understood',
          'Command not recognized. Say "help" for a list of commands.',
          'destructive'
        );
      } catch (error) {
        logger.error('Voice command processing error:', error);
        showFeedback('Error', 'Failed to process command', 'destructive');
      }
    },
    [drinks, onAddToCart, processOrder, showFeedback]
  );

  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      showFeedback('Voice Control', 'Stopped listening');
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

      if (!validateDependencies() || isProcessing) {
        throw new Error('Required dependencies unavailable or cart is processing');
      }

      await googleVoiceService.startListening(handleVoiceCommand);
      setIsListening(true);
      showFeedback('Voice Control', 'Listening... Say "help" for commands');
    } catch (error) {
      console.error('Failed to start:', error);
      setIsListening(false);
      throw error;
    }
  }, [handleVoiceCommand, showFeedback, validateDependencies, isProcessing]);

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
    isSupported: googleVoiceService.isSupported(),
  };
}

// Helper function to match drinks from voice input
function matchDrink(command: string): { drink: DrinkItem | null; quantity: number } {
  const quantityMatch = command.match(/(\d+|a|one|two|three|four|five)\s+(.+)/i);
  const quantityMap: Record<string, number> = {
    a: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
  };

  let quantity = 1;
  let drinkName = command;

  if (quantityMatch) {
    quantity = parseInt(quantityMatch[1]) || quantityMap[quantityMatch[1].toLowerCase()] || 1;
    drinkName = quantityMatch[2];
  }

  logger.debug('Matching drink from command:', {
    command,
    quantity,
    drinkName: drinkName.trim()
  });

  // The drink matching logic will be handled by the parent component
  return { drink: null, quantity };
}