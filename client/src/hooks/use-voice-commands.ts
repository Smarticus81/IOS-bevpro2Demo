import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { DrinkItem, AddToCartAction } from '@/types/speech';
import { voiceRecognition } from '@/lib/voice';
import type { CartItem } from '@/types/cart';
import { logger } from '@/lib/logger';
import { parseVoiceCommand } from '@/lib/command-parser';
import { soundEffects } from '@/lib/sound-effects';

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
    if (!drinks?.length) {
      logger.error('No drinks available for voice commands');
      return false;
    }

    const dependencies = {
      onAddToCart: !!onAddToCart,
      onRemoveItem: !!onRemoveItem,
      onPlaceOrder: !!onPlaceOrder,
    };

    const isValid = Object.values(dependencies).every(Boolean);
    if (!isValid) {
      logger.error('Missing callback dependencies:', dependencies);
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

  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text?.trim()) return;

    const command = text.toLowerCase().trim();
    const now = Date.now(); // Fixed: Changed from Date.Now() to Date.now()

    // Log incoming command
    logger.info('Processing voice command:', command);

    // Debounce similar commands
    if (
      command === lastCommandRef.current.text &&
      now - lastCommandRef.current.timestamp < COMMAND_DEBOUNCE_MS
    ) {
      logger.info('Debouncing similar command:', command);
      return;
    }

    lastCommandRef.current = { text: command, timestamp: now };

    try {
      // Parse the command with available drinks
      const parsedCommand = parseVoiceCommand(command, drinks);

      if (!parsedCommand) {
        logger.info('Command not recognized:', command);
        showFeedback(
          'Not Understood',
          'Command not recognized. Say "help" for a list of commands.'
        );
        return;
      }

      // Handle system commands first
      if (parsedCommand.type === 'system') {
        logger.info('Processing system command:', parsedCommand.action);

        switch (parsedCommand.action) {
          case 'complete_order':
            logger.info('Completion command detected, checking cart state');
            if (!cart.length) {
              await soundEffects.playError();
              showFeedback('Empty Cart', 'Your cart is empty', 'destructive');
              return;
            }
            if (isProcessing) {
              showFeedback('Processing', 'Your order is already being processed');
              return;
            }
            await soundEffects.playSuccess();
            showFeedback('Processing Order', 'Placing your order...');
            await onPlaceOrder();
            return;

          case 'help':
            await soundEffects.playSuccess();
            showFeedback(
              'Voice Commands',
              'Try commands like "Add a Moscow Mule", "Complete my order", or "Cancel order".'
            );
            return;

          case 'cancel':
            if (cart.length === 0) {
              showFeedback('Empty Cart', 'Your cart is already empty');
              return;
            }
            logger.info('Cancelling order, clearing cart');
            for (const item of cart) {
              await onRemoveItem(item.drink.id);
            }
            await soundEffects.playSuccess();
            showFeedback('Order Cancelled', 'Your order has been cancelled');
            return;
        }
      }

      // Handle drink orders
      if (parsedCommand.type === 'order' && parsedCommand.items?.length) {
        logger.info('Processing drink order:', parsedCommand.items);

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
            await soundEffects.playSuccess();
            showFeedback(
              'Added to Cart',
              `Added ${item.quantity} ${matchedDrink.name}(s) to your cart.`
            );
          }
        }
      }
    } catch (error) {
      logger.error('Voice command processing error:', error);
      await soundEffects.playError();
      showFeedback(
        'Error',
        error instanceof Error ? error.message : 'Failed to process command',
        'destructive'
      );
    }
  }, [drinks, onAddToCart, onRemoveItem, onPlaceOrder, cart, isProcessing, showFeedback]);

  useEffect(() => {
    if (isListening) {
      voiceRecognition.on('speech', handleVoiceCommand);
    }

    return () => {
      voiceRecognition.off('speech', handleVoiceCommand);
    };
  }, [isListening, handleVoiceCommand]);

  const stopListening = useCallback(async () => {
    try {
      await voiceRecognition.stop();
      setIsListening(false);
      await soundEffects.playListeningStop();
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

      if (!validateDependencies()) {
        throw new Error('Required voice command handlers are not available');
      }

      await voiceRecognition.start();
      setIsListening(true);
      await soundEffects.playListeningStart();
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