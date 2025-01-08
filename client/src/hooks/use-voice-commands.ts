import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { DrinkItem, AddToCartAction } from '@/types/speech';
import { voiceRecognition } from '@/lib/voice';
import type { CartItem } from '@/types/cart';
import { logger } from '@/lib/logger';
import { parseVoiceCommand } from '@/lib/command-parser';
import { soundEffects } from '@/lib/sound-effects';
import { voiceAnalytics } from '@/lib/analytics';

interface VoiceCommandsProps {
  drinks: DrinkItem[];
  cart: CartItem[];
  onAddToCart: (action: AddToCartAction) => Promise<void>;
  onRemoveItem: (drinkId: number) => Promise<void>;
  onPlaceOrder: () => Promise<void>;
  isProcessing: boolean;
  onInventorySearch?: (searchTerm: string) => void;
  onCategoryFilter?: (category: string) => void;
  onLowStockFilter?: () => void;
}

export function useVoiceCommands({
  drinks = [],
  cart = [],
  onAddToCart,
  onRemoveItem,
  onPlaceOrder,
  isProcessing = false,
  onInventorySearch,
  onCategoryFilter,
  onLowStockFilter,
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const lastCommandRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 500;

  const validateDependencies = useCallback((): boolean => {
    if (!Array.isArray(drinks) || drinks.length === 0) {
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
      toast({ 
        title, 
        description: message, 
        variant: type,
        duration: type === 'destructive' ? 5000 : 3000 
      });
      logger.info(`${title}: ${message}`);
    },
    [toast]
  );

  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text?.trim()) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    logger.info('Processing voice command:', command);

    if (
      command === lastCommandRef.current.text &&
      now - lastCommandRef.current.timestamp < COMMAND_DEBOUNCE_MS
    ) {
      logger.info('Debouncing similar command:', command);
      return;
    }

    lastCommandRef.current = { text: command, timestamp: now };

    try {
      const parsedCommand = await parseVoiceCommand(command, drinks);

      if (!parsedCommand) {
        logger.info('Command not recognized:', command);
        voiceAnalytics.trackCommand('system_command', false, {
          command: text,
          error: 'Command not recognized'
        });
        showFeedback(
          'Not Understood',
          'Command not recognized. Try "check stock of [drink name]" or "show low stock items".'
        );
        return;
      }

      // Handle inventory queries with enhanced feedback
      if (parsedCommand.type === 'inventory_query') {
        logger.info('Processing inventory query:', parsedCommand);

        switch (parsedCommand.queryType) {
          case 'search':
            if (onInventorySearch && parsedCommand.searchTerm) {
              onInventorySearch(parsedCommand.searchTerm);
              voiceAnalytics.trackCommand('inventory_search', true, { command: text });

              // Enhanced feedback using detailed response
              if (parsedCommand.detailed_response) {
                const { itemCount, stockStatus, recommendations } = parsedCommand.detailed_response;
                const feedback = `Found ${itemCount} items. ${parsedCommand.conversational_response}`;
                showFeedback('Inventory Search', feedback);

                // Show recommendations if available
                if (recommendations?.length) {
                  setTimeout(() => {
                    showFeedback('Recommendation', recommendations[0]);
                  }, 2000);
                }
              } else {
                showFeedback('Inventory Search', parsedCommand.conversational_response);
              }
            }
            break;

          case 'category':
            if (onCategoryFilter && parsedCommand.category) {
              onCategoryFilter(parsedCommand.category);
              voiceAnalytics.trackCommand('inventory_filter', true, { command: text });
              showFeedback('Category Filter', parsedCommand.conversational_response);
            }
            break;

          case 'low_stock':
            if (onLowStockFilter) {
              onLowStockFilter();
              voiceAnalytics.trackCommand('inventory_filter', true, { command: text });

              // Enhanced feedback for low stock items
              if (parsedCommand.detailed_response?.urgentActions?.length) {
                showFeedback('Low Stock Alert', parsedCommand.conversational_response);
                // Show urgent actions as separate notifications
                parsedCommand.detailed_response.urgentActions.forEach((action, index) => {
                  setTimeout(() => {
                    showFeedback('Action Required', action, 'destructive');
                  }, 2000 + (index * 2000));
                });
              } else {
                showFeedback('Stock Filter', parsedCommand.conversational_response);
              }
            }
            break;

          case 'stock_level':
            if (parsedCommand.searchTerm) {
              const drink = drinks.find(
                d => d.name.toLowerCase() === parsedCommand.searchTerm?.toLowerCase()
              );
              if (drink) {
                voiceAnalytics.trackCommand('inventory_check', true, { command: text });

                // Enhanced stock level feedback
                if (parsedCommand.detailed_response) {
                  const { stockStatus, recommendations } = parsedCommand.detailed_response;
                  showFeedback(
                    'Stock Check', 
                    parsedCommand.conversational_response,
                    stockStatus === 'attention needed' ? 'destructive' : 'default'
                  );

                  // Show recommendations if available
                  if (recommendations?.length) {
                    setTimeout(() => {
                      showFeedback('Recommendation', recommendations[0]);
                    }, 2000);
                  }
                } else {
                  showFeedback('Stock Check', parsedCommand.conversational_response);
                }
              } else {
                voiceAnalytics.trackCommand('inventory_check', false, {
                  command: text,
                  error: 'Item not found'
                });
                showFeedback('Not Found', `Could not find "${parsedCommand.searchTerm}"`, 'destructive');
              }
            }
            break;
        }
        return;
      }

      // Handle existing command types...
      if (parsedCommand.type === 'system') {
        switch (parsedCommand.action) {
          case 'help':
            voiceAnalytics.trackCommand('system_command', true, { command: text });
            showFeedback(
              'Voice Commands',
              'Try commands like "check stock of [drink]", "show low stock items", or "search inventory for [term]".'
            );
            return;
          case 'complete_order':
            if (!cart.length) {
              voiceAnalytics.trackCommand('order_completion', false, {
                command: text,
                error: 'Empty cart'
              });
              showFeedback('Empty Cart', 'Your cart is empty', 'destructive');
              return;
            }
            if (isProcessing) {
              voiceAnalytics.trackCommand('order_completion', false, {
                command: text,
                error: 'Already processing'
              });
              showFeedback('Processing', 'Your order is already being processed');
              return;
            }
            voiceAnalytics.trackCommand('order_completion', true, { command: text });
            showFeedback('Processing Order', 'Placing your order...');
            await onPlaceOrder();
            // Reset voice state after successful order completion
            // await resetVoiceState(); //Commented out as resetVoiceState is not defined.
            return;
          case 'cancel':
            if (cart.length === 0) {
              voiceAnalytics.trackCommand('system_command', false, {
                command: text,
                error: 'Cart already empty'
              });
              showFeedback('Empty Cart', 'Your cart is already empty');
              return;
            }
            logger.info('Cancelling order, clearing cart');
            for (const item of cart) {
              await onRemoveItem(item.drink.id);
            }
            voiceAnalytics.trackCommand('system_command', true, { command: text });
            showFeedback('Order Cancelled', 'Your order has been cancelled');
            return;
        }
      }

      if (parsedCommand.type === 'order' && parsedCommand.items?.length) {
        // ... existing order handling
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
            voiceAnalytics.trackCommand('drink_order', true, {
              command: `${item.quantity} ${matchedDrink.name}`
            });
            showFeedback(
              'Added to Cart',
              `Added ${item.quantity} ${matchedDrink.name}(s) to your cart.`
            );
          } else {
            voiceAnalytics.trackCommand('drink_order', false, {
              command: text,
              error: 'Drink not found'
            });
            showFeedback(
              'Error',
              `Sorry, I couldn't find "${item.name}" in our menu.`,
              'destructive'
            );
          }
        }
      }
    } catch (error) {
      logger.error('Voice command processing error:', error);
      voiceAnalytics.trackCommand('system_command', false, {
        command: text,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      showFeedback(
        'Error',
        error instanceof Error ? error.message : 'Failed to process command',
        'destructive'
      );
    }
  }, [drinks, onInventorySearch, onCategoryFilter, onLowStockFilter, showFeedback, onAddToCart, onRemoveItem, onPlaceOrder, cart, isProcessing]);

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
      showFeedback('Voice Control', 'Listening... Try "help" for available commands');
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
    metrics: voiceAnalytics.getMetricsSummary()
  };
}