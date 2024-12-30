import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { DrinkItem, AddToCartAction } from '@/types/speech';
import { voiceRecognition } from '@/lib/voice';
import type { CartItem } from '@/types/cart';
import { logger } from '@/lib/logger';
import { parseVoiceCommand } from '@/lib/command-parser';

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
    // Allow initialization even when cart is empty
    const dependencies = {
      onAddToCart: !!onAddToCart,
      onRemoveItem: !!onRemoveItem,
      onPlaceOrder: !!onPlaceOrder,
    };

    const isValid = Object.values(dependencies).every(Boolean);

    if (!isValid) {
      logger.error('Missing dependencies:', dependencies);
    }

    return isValid;
  }, [onAddToCart, onRemoveItem, onPlaceOrder]);

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

      showFeedback('Processing Order', 'Placing your order...');
      await onPlaceOrder();
      return true;
    } catch (error) {
      logger.error('Error processing order:', error);
      showFeedback(
        'Error',
        error instanceof Error ? error.message : 'Failed to process order',
        'destructive'
      );
      return false;
    }
  }, [cart, onPlaceOrder, isProcessing, showFeedback]);

  const clearCart = useCallback(async () => {
    try {
      logger.info('Clearing cart on cancel command');
      for (const item of cart) {
        await onRemoveItem(item.drink.id);
      }
      showFeedback('Cart Cleared', 'All items have been removed from your cart');
      return true;
    } catch (error) {
      logger.error('Error clearing cart:', error);
      showFeedback(
        'Error',
        'Failed to clear cart. Please try again.',
        'destructive'
      );
      return false;
    }
  }, [cart, onRemoveItem, showFeedback]);

  const handleVoiceCommand = useCallback(async (text: string) => {
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
      // Handle regular order items
      const parsedCommand = parseVoiceCommand(command, drinks);
      if (!parsedCommand) {
        showFeedback(
          'Not Understood',
          'Command not recognized. Say "help" for a list of commands.',
          'destructive'
        );
        return;
      }

      switch (parsedCommand.type) {
        case 'system':
          if (parsedCommand.action === 'help') {
            showFeedback(
              'Voice Commands',
              'Try commands like "Add a Moscow Mule", "Complete my order", or "Cancel order".'
            );
          }
          break;

        case 'order':
          if (!parsedCommand.items?.length) {
            showFeedback('Error', 'No items specified in order', 'destructive');
            return;
          }

          // Process each item in the order
          for (const item of parsedCommand.items) {
            const matchedDrink = drinks.find(
              d => d.name.toLowerCase() === item.name.toLowerCase()
            );

            if (matchedDrink) {
              await onAddToCart({
                type: 'ADD_ITEM',
                drink: matchedDrink,
                quantity: item.quantity
              });
              showFeedback(
                'Added to Cart',
                `Added ${item.quantity} ${matchedDrink.name}(s) to your cart.`
              );
            }
          }
          break;
      }
    } catch (error) {
      logger.error('Voice command processing error:', error);
      showFeedback(
        'Error',
        error instanceof Error ? error.message : 'Failed to process command',
        'destructive'
      );
    }
  }, [drinks, onAddToCart, showFeedback]);

  const handleVoiceEvent = useCallback(async (event: any) => {
    try {
      if (event?.type === 'complete_order') {
        logger.info('Received completion event, initiating order processing');
        const success = await processOrder();
        if (success) {
          logger.info('Order processed successfully via voice command');
          showFeedback('Success', 'Order processed successfully');
        }
      } else if (event?.type === 'cancel_order') {
        logger.info('Received cancellation event, clearing cart');
        const success = await clearCart();
        if (success) {
          logger.info('Cart cleared successfully via voice command');
          showFeedback('Cart Cleared', 'Your order has been cancelled');
        }
      }
    } catch (error) {
      logger.error('Error handling voice event:', error);
      showFeedback(
        'Error',
        'Failed to process voice command',
        'destructive'
      );
    }
  }, [processOrder, clearCart, showFeedback]);

  useEffect(() => {
    if (isListening) {
      voiceRecognition.on('speech', handleVoiceCommand);
      voiceRecognition.on('completion', handleVoiceEvent);
      voiceRecognition.on('cancel', handleVoiceEvent);
    }

    return () => {
      voiceRecognition.off('speech', handleVoiceCommand);
      voiceRecognition.off('completion', handleVoiceEvent);
      voiceRecognition.off('cancel', handleVoiceEvent);
    };
  }, [isListening, handleVoiceCommand, handleVoiceEvent]);

  const stopListening = useCallback(async () => {
    try {
      await voiceRecognition.stop();
      setIsListening(false);
      showFeedback('Voice Control', 'Stopped listening');
    } catch (error) {
      logger.error('Failed to stop listening:', error);
      setIsListening(false);
    }
  }, [showFeedback]);

  const startListening = useCallback(async () => {
    try {
      if (!voiceRecognition.isSupported()) {
        throw new Error('Speech recognition not supported');
      }

      // Only check for required callbacks, not processing state
      if (!validateDependencies()) {
        throw new Error('Required voice command handlers are not available');
      }

      await voiceRecognition.start();
      setIsListening(true);
      showFeedback('Voice Control', 'Listening... Say "help" for commands');
    } catch (error) {
      logger.error('Failed to start listening:', error);
      setIsListening(false);
      throw error;
    }
  }, [showFeedback, validateDependencies]);

  return {
    isListening,
    startListening,
    stopListening,
    isSupported: voiceRecognition.isSupported(),
  };
}