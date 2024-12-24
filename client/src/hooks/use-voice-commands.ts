import { useState, useEffect, useCallback, useRef } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { voiceSynthesis } from '@/lib/voice-synthesis';
import { paymentService } from '@/lib/paymentService';

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

const RESPONSES = {
  orderComplete: (total: number) => `Perfect. Your order total comes to $${(total / 100).toFixed(2)}. I'll process that right away for you.`,
  processingPayment: "I'm processing your payment now. Please wait a moment.",
  paymentSuccess: "Great news! Your payment has been processed successfully. Your drinks will be prepared shortly.",
  paymentError: "I apologize, but there was an issue processing your payment. Please try again or ask for assistance.",
  orderConfirmation: (items: string) => `I've added ${items} to your order. Would you like anything else?`,
  help: "You can order drinks by saying phrases like 'I'd like a Moscow Mule' or 'three beers please'. When you're ready to complete your order, just say 'process order' or 'complete order'.",
  emptyCart: "Your cart is currently empty. Would you like to order some drinks?"
};

export function useVoiceCommands({
  drinks = [],
  cart = [],
  onAddToCart,
  onRemoveItem,
  onPlaceOrder
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const cartRef = useRef(cart);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Keep cartRef current
  useEffect(() => {
    cartRef.current = cart;
    console.log('Cart updated:', {
      items: cart.map(item => ({ name: item.drink.name, quantity: item.quantity })),
      timestamp: new Date().toISOString()
    });
  }, [cart]);

  const calculateTotal = useCallback((items: typeof cart) => {
    const total = items.reduce((sum, item) => 
      sum + (item.drink.price * item.quantity * 100), 0
    );
    console.log('Calculated order total:', {
      total,
      itemCount: items.length,
      breakdown: items.map(item => ({
        name: item.drink.name,
        price: item.drink.price,
        quantity: item.quantity,
        subtotal: item.drink.price * item.quantity * 100
      })),
      timestamp: new Date().toISOString()
    });
    return total;
  }, []);

  const processPayment = useCallback(async () => {
    try {
      setIsProcessingPayment(true);
      const currentCart = cartRef.current;

      console.log('Processing payment for cart:', {
        cartItems: currentCart.map(item => ({
          name: item.drink.name,
          quantity: item.quantity,
          price: item.drink.price
        })),
        itemCount: currentCart.length,
        timestamp: new Date().toISOString()
      });

      if (!currentCart.length) {
        throw new Error('Cart is empty');
      }

      const total = calculateTotal(currentCart);

      if (total <= 0) {
        throw new Error('Invalid order total');
      }

      await voiceSynthesis.speak(RESPONSES.processingPayment, "professional");

      const result = await paymentService.processPayment({ amount: total });

      if (result.success) {
        await voiceSynthesis.speak(RESPONSES.paymentSuccess, "excited");
        onPlaceOrder();
        navigate('/payment-confirmation?status=success');
        return true;
      } else {
        throw new Error(result.message || 'Payment failed');
      }
    } catch (error) {
      console.error('Payment processing error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        cartState: cartRef.current,
        timestamp: new Date().toISOString()
      });
      await voiceSynthesis.speak(RESPONSES.paymentError, "apologetic");
      navigate('/payment-confirmation?status=error');
      return false;
    } finally {
      setIsProcessingPayment(false);
    }
  }, [navigate, onPlaceOrder, calculateTotal]);

  const handleVoiceCommand = useCallback(async (text: string) => {
    if (!text || isProcessingPayment) return;

    const command = text.toLowerCase().trim();
    const currentCart = cartRef.current;

    console.log('Processing voice command:', {
      command,
      cartItems: currentCart.map(item => ({
        name: item.drink.name,
        quantity: item.quantity
      })),
      cartSize: currentCart.length,
      timestamp: new Date().toISOString()
    });

    // Handle order completion and payment
    if (/(complete|finish|process|submit|confirm|checkout|pay for|finalize)\s+(?:the\s+)?order/.test(command)) {
      if (!currentCart.length) {
        await voiceSynthesis.speak(RESPONSES.emptyCart, "friendly");
        return;
      }

      const total = calculateTotal(currentCart);

      try {
        await voiceSynthesis.speak(RESPONSES.orderComplete(total), "confirmative");
        const success = await processPayment();

        if (success) {
          toast({
            title: "Order Complete",
            description: `Successfully processed order for $${(total / 100).toFixed(2)}`,
          });
        }
      } catch (error) {
        console.error('Error processing order:', error);
        await voiceSynthesis.speak(RESPONSES.paymentError, "apologetic");
      }
      return;
    }

    // Handle help command
    if (/help|what can (i|you) (say|do)|how does this work/.test(command)) {
      await voiceSynthesis.speak(RESPONSES.help, "friendly");
      return;
    }

    // Handle drink orders
    const orderMatch = command.match(/(?:i(?:'d| would) like|get me|order|add)\s+(?:a |an |some )?(.+)/i);
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

          console.log('Added drink to cart:', {
            drinkName: matchedDrink.name,
            quantity,
            price: matchedDrink.price,
            timestamp: new Date().toISOString()
          });
        }
      }

      if (successfulOrders.length > 0) {
        const itemsList = successfulOrders.join(' and ');
        await voiceSynthesis.speak(RESPONSES.orderConfirmation(itemsList), "friendly");
      } else {
        await voiceSynthesis.speak(
          "I'm sorry, I couldn't find the drinks you mentioned. Would you like me to list our available options?",
          "apologetic"
        );
      }
      return;
    }

    // Stop listening command
    if (/(?:stop|end|quit|exit|turn off|disable)\s+(?:listening|voice|commands?)/.test(command)) {
      await voiceSynthesis.speak("Voice commands deactivated. Have a great day!", "professional");
      await stopListening();
      return;
    }

    // Fallback for unrecognized commands
    await voiceSynthesis.speak(
      `I heard "${text}". If you'd like to order drinks, you can say something like "I'd like a Moscow Mule" or "three beers please". How can I assist you?`,
      "friendly"
    );
  }, [drinks, onAddToCart, processPayment, calculateTotal, stopListening, toast, isProcessingPayment]);

  const stopListening = useCallback(async () => {
    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
      await voiceSynthesis.speak("Voice commands deactivated.", "professional");
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
  }, [toast]);

  const startListening = useCallback(async () => {
    try {
      if (!drinks.length) {
        throw new Error('Drinks data not loaded');
      }

      if (!googleVoiceService.isSupported()) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      await googleVoiceService.startListening(handleVoiceCommand);
      setIsListening(true);

      await voiceSynthesis.speak(
        "Voice commands activated. I'm listening and ready to help!",
        "excited"
      );

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
  }, [drinks, handleVoiceCommand, toast]);

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
    isSupported: googleVoiceService.isSupported()
  };
}