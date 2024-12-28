import { useState, useEffect, useCallback, useRef } from 'react';

export function useVoiceCommands({
  drinks = [],
  cart = { items: [], isProcessing: false }, // Default cart
  onAddToCart,
  onRemoveItem,
  onPlaceOrder,
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  const lastCommandRef = useRef<{ text: string; timestamp: number }>({ text: '', timestamp: 0 });
  const COMMAND_DEBOUNCE_MS = 500;

  const validateDependencies = useCallback((): boolean => {
    if (!drinks.length || !onAddToCart || !onRemoveItem || !onPlaceOrder || !cart) {
      console.error('Missing dependencies:', {
        drinks: !!drinks.length,
        onAddToCart: !!onAddToCart,
        onRemoveItem: !!onRemoveItem,
        onPlaceOrder: !!onPlaceOrder,
        cart: !!cart,
      });
      return false;
    }
    return true;
  }, [drinks, onAddToCart, onRemoveItem, onPlaceOrder, cart]);

  const showFeedback = useCallback((title: string, message: string, type: 'default' | 'destructive' = 'default') => {
    toast({ title, description: message, variant: type });
    console.log(`${title}: ${message}`);
  }, [toast]);

  const matchDrink = (command: string): { drink: DrinkItem | null; quantity: number } => {
    const quantityMatch = command.match(/(\d+|a|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i);
    const quantityMap: Record<string, number> = {
      a: 1,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };
    const quantity = quantityMatch
      ? parseInt(quantityMatch[1]) || quantityMap[quantityMatch[1].toLowerCase()] || 1
      : 1;

    const drinkName = command.replace(quantityMatch?.[0] || '', '').trim();
    const matchedDrink = drinks.find(d => drinkName.toLowerCase().includes(d.name.toLowerCase()));

    return { drink: matchedDrink || null, quantity };
  };

  const processOrder = useCallback(async () => {
    if (!cart || !cart.items.length) {
      showFeedback('Empty Cart', 'Your cart is empty', 'destructive');
      return false;
    }

    if (cart.isProcessing) {
      showFeedback('Processing', 'Please wait while we process your order...', 'default');
      return false;
    }

    try {
      const total = cart.items.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);
      showFeedback('Processing Order', `Total: $${total.toFixed(2)}`);
      await onPlaceOrder();
      showFeedback('Success', 'Order complete!');
      return true;
    } catch (error) {
      console.error('Error processing order:', error);
      showFeedback('Error', 'Failed to process order', 'destructive');
      return false;
    }
  }, [cart, onPlaceOrder, showFeedback]);

  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text?.trim()) return;

    const command = text.toLowerCase().trim();
    const now = Date.now();

    // Debounce similar commands
    if (command === lastCommandRef.current.text && 
        now - lastCommandRef.current.timestamp < COMMAND_DEBOUNCE_MS) {
      return;
    }

    lastCommandRef.current = { text: command, timestamp: now };
    console.log('Processing voice command:', command);

    try {
      if (/complete|checkout|finish/.test(command)) {
        await processOrder();
        return;
      }

      if (/help/.test(command)) {
        showFeedback(
          'Voice Commands',
          'Try commands like "Add a Moscow Mule" or "Complete my order".',
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
          showFeedback('Drink Not Found', 'Could not find the requested drink. Try again.', 'destructive');
        }
        return;
      }

      showFeedback('Not Understood', 'Command not recognized. Say "help" for a list of commands.', 'destructive');
    } catch (error) {
      console.error('Voice command processing error:', error);
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

      if (!validateDependencies() || cart.isProcessing) {
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
  }, [handleVoiceCommand, showFeedback, validateDependencies, cart.isProcessing]);

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
