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
      // Check for completion phrases first
      const completionPhrases = [
        'complete order',
        'process order',
        'finish order',
        'place order',
        'thats it',
        "that's it",
        'complete',
        'process',
        'finish',
        'done',
        'okay thats it',
        'okay that\'s it'
      ];

      const isCompletionCommand = completionPhrases.some(phrase => 
        command.includes(phrase)
      );

      if (isCompletionCommand) {
        logger.info('Completion command detected:', command);
        await processOrder();
        return;
      }

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
              'Try commands like "Add a Moscow Mule" or "Complete my order".'
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
  }, [drinks, onAddToCart, showFeedback, processOrder]);

  const handleVoiceEvent = useCallback((event: any) => {
    if (event.type === 'completion') {
      logger.info('Received completion event:', event);
      processOrder();
    }
  }, [processOrder]);

  useEffect(() => {
    if (isListening) {
      voiceRecognition.on('speech', handleVoiceCommand);
      voiceRecognition.on('completion', handleVoiceEvent);
    }

    return () => {
      voiceRecognition.off('speech', handleVoiceCommand);
      voiceRecognition.off('completion', handleVoiceEvent);
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

      if (!validateDependencies() || isProcessing) {
        throw new Error('Required dependencies unavailable or cart is processing');
      }

      await voiceRecognition.start();
      setIsListening(true);
      showFeedback('Voice Control', 'Listening... Say "help" for commands');
    } catch (error) {
      logger.error('Failed to start listening:', error);
      setIsListening(false);
      throw error;
    }
  }, [showFeedback, validateDependencies, isProcessing]);

  return {
    isListening,
    startListening,
    stopListening,
    isSupported: voiceRecognition.isSupported(),
  };
}