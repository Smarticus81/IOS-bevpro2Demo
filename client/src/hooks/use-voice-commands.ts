import { useState, useEffect, useCallback, useRef } from 'react';
import { googleVoiceService } from '@/lib/google-voice-service';
import { useToast } from '@/hooks/use-toast';
import { voiceSynthesis } from '@/lib/voice-synthesis';
import type { DrinkItem, CartItem, AddToCartAction, VoiceResponse } from '@/types/speech';
import { recommendationService } from '@/lib/recommendation-service';
import { conversationState } from '@/lib/conversation-state';

// Convert DrinkItem for recommendation service
function convertToFullDrink(item: DrinkItem): DrinkItem {
  return {
    ...item
  };
}

interface VoiceCommandsProps {
  drinks: DrinkItem[];
  cart: CartItem[];
  onAddToCart?: (action: AddToCartAction) => void;
  onRemoveItem?: (drinkId: number) => void;
  onPlaceOrder?: () => Promise<void>;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

function getOrCreateSessionId(): string {
  let sessionId = sessionStorage.getItem('voice_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('voice_session_id', sessionId);
  }
  return sessionId;
}

export function useVoiceCommands({
  drinks = [],
  cart = [],
  onAddToCart = () => {},
  onRemoveItem = () => {},
  onPlaceOrder = async () => {},
  onProcessingStateChange = () => {}
}: VoiceCommandsProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const responseQueueRef = useRef<VoiceResponse[]>([]);
  const isProcessingResponseRef = useRef(false);
  const sessionId = getOrCreateSessionId();

  // Update parent component with processing state
  useEffect(() => {
    onProcessingStateChange(isProcessing);
  }, [isProcessing, onProcessingStateChange]);

  // Update conversation state when cart changes
  useEffect(() => {
    conversationState.setCurrentOrder(cart);
  }, [cart]);

  const validateDependencies = useCallback((): boolean => {
    return drinks.length > 0 && 
           typeof onAddToCart === 'function' &&
           typeof onRemoveItem === 'function' &&
           typeof onPlaceOrder === 'function';
  }, [drinks, onAddToCart, onRemoveItem, onPlaceOrder]);

  const processResponseQueue = useCallback(async () => {
    if (isProcessingResponseRef.current || responseQueueRef.current.length === 0) {
      return;
    }

    try {
      isProcessingResponseRef.current = true;
      const response = responseQueueRef.current[0];

      // Process response
      await voiceSynthesis.speak(response);

      // Update UI with toast notification
      toast({
        title: "Voice Assistant",
        description: response.text,
        duration: 5000,
      });

      // Handle UI updates based on response type
      if (response.data) {
        switch (response.data.type) {
          case 'cart_update':
            if (response.data.items) {
              // Cart updates will be reflected through onAddToCart callbacks
              toast({
                title: "Cart Updated",
                description: `Updated ${response.data.items.length} items`,
                duration: 3000,
              });
            }
            break;
          case 'confirmation':
            toast({
              title: "Order Confirmation",
              description: `Total: $${response.data.total?.toFixed(2)}`,
              duration: 3000,
            });
            break;
          case 'error':
            toast({
              title: "Error",
              description: response.data.error || "An error occurred",
              variant: "destructive",
              duration: 5000,
            });
            break;
        }
      }

      // Remove processed response
      responseQueueRef.current.shift();
    } catch (error) {
      console.error('Error processing voice response:', error);
      toast({
        title: "Error",
        description: "Failed to process voice response",
        variant: "destructive",
      });
    } finally {
      isProcessingResponseRef.current = false;
      // Process next response if available
      if (responseQueueRef.current.length > 0) {
        processResponseQueue();
      }
    }
  }, [toast]);

  const queueResponse = useCallback((response: VoiceResponse) => {
    responseQueueRef.current.push(response);
    processResponseQueue();
  }, [processResponseQueue]);

  const startListening = useCallback(async () => {
    console.log('Initializing voice recognition...');

    try {
      if (!googleVoiceService.isSupported()) {
        throw new Error('Speech recognition is not supported in this browser');
      }

      if (!validateDependencies()) {
        throw new Error('Required dependencies are not available');
      }

      await googleVoiceService.startListening(async (text) => {
        try {
          const response = await fetch('/api/voice-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, sessionId })
          });

          if (!response.ok) {
            throw new Error('Failed to process voice command');
          }

          const result = await response.json();
          queueResponse({
            text: result.conversational_response,
            emotion: result.sentiment || "neutral",
            data: result
          });

          // Update UI based on command type
          switch (result.type) {
            case 'order':
              result.items.forEach((item: { name: string; quantity: number }) => {
                const matchedDrink = drinks.find(d => 
                  d.name.toLowerCase() === item.name.toLowerCase()
                );
                if (matchedDrink) {
                  onAddToCart({
                    type: 'ADD_ITEM',
                    drink: matchedDrink,
                    quantity: item.quantity
                  });
                }
              });
              break;
            case 'complete_transaction':
              await processOrder();
              break;
          }
        } catch (error) {
          console.error('Error processing voice command:', error);
          queueResponse({
            text: "I'm sorry, I couldn't process that command. Please try again.",
            emotion: "apologetic",
            data: { type: "error", error: "processing_failed" }
          });
        }
      });

      setIsListening(true);
      queueResponse({
        text: "Voice commands activated. I'm listening and ready to help! Say 'help' to learn what I can do.",
        emotion: "excited"
      });

    } catch (error) {
      console.error('Failed to start voice commands:', error);
      setIsListening(false);
      throw error;
    }
  }, [drinks, onAddToCart, queueResponse, validateDependencies, sessionId]);

  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await googleVoiceService.stopListening();
      setIsListening(false);
    } catch (error) {
      console.error('Failed to stop voice commands:', error);
      setIsListening(false);
    }
  }, [isListening]);

  const processOrder = useCallback(async () => {
    if (isProcessing) {
      queueResponse({
        text: "Please wait, I'm still processing your previous order.",
        emotion: "apologetic",
        data: {
          type: "error",
          error: "processing_in_progress"
        }
      });
      return false;
    }

    if (!cart.length) {
      queueResponse({
        text: "Your cart is empty. Would you like to order some drinks first?",
        emotion: "apologetic",
        data: {
          type: "error",
          error: "empty_cart"
        }
      });
      return false;
    }

    const total = cart.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0);

    try {
      setIsProcessing(true);

      // Pause voice recognition during payment processing
      await googleVoiceService.pauseListening();

      queueResponse({
        text: `Processing your order for ${cart.length} items, total $${total.toFixed(2)}...`,
        emotion: "excited",
        data: {
          type: "order_update",
          items: cart,
          total: total,
          status: "processing"
        }
      });

      await onPlaceOrder();

      // Record order context for recommendations
      await recommendationService.recordOrderContext(
        sessionId,
        cart.map(item => ({
          drink: convertToFullDrink(item.drink),
          quantity: item.quantity
        })),
        total
      );

      queueResponse({
        text: "Your order has been processed successfully! Your drinks will be ready shortly. Would you like to order anything else?",
        emotion: "excited",
        data: {
          type: "confirmation",
          status: "success",
          total: total
        }
      });

      // Clear conversation state after successful order
      conversationState.clearContext();
      return true;
    } catch (error) {
      console.error('Error processing order:', error);

      queueResponse({
        text: "I apologize, but there was an error processing your order. Please try again or ask for assistance.",
        emotion: "apologetic",
        data: {
          type: "error",
          error: "payment_failed",
          status: "failed"
        }
      });
      return false;
    } finally {
      setIsProcessing(false);
      await googleVoiceService.resumeListening();
    }
  }, [cart, onPlaceOrder, queueResponse, sessionId]);

  useEffect(() => {
    return () => {
      if (isListening) {
        googleVoiceService.stopListening().catch(console.error);
      }
      // Clear pending responses
      responseQueueRef.current = [];
      isProcessingResponseRef.current = false;
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