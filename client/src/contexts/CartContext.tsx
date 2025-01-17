import { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import type { CartState, CartContextType, AddToCartAction, CartItem } from '@/types/cart';
import { OrderConfirmationModal } from '@/components/OrderConfirmationModal';

const CartContext = createContext<CartContextType | undefined>(undefined);

type CartAction =
  | AddToCartAction
  | { type: 'REMOVE_ITEM'; drinkId: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_PROCESSING'; isProcessing: boolean };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      if (state.isProcessing) return state;

      const existingItem = state.items.find(item => item.drink.id === action.drink.id);
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.drink.id === action.drink.id
              ? { ...item, quantity: Math.min(99, item.quantity + action.quantity) }
              : item
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { drink: action.drink, quantity: action.quantity }],
      };
    }
    case 'REMOVE_ITEM':
      if (state.isProcessing) return state;
      return {
        ...state,
        items: state.items.filter(item => item.drink.id !== action.drinkId),
      };
    case 'CLEAR_CART':
      return {
        items: [],
        isProcessing: false,
      };
    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.isProcessing,
      };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isProcessing: false,
  });

  const [orderConfirmation, setOrderConfirmation] = useState<{
    isOpen: boolean;
    details: {
      orderId: number;
      transactionId: string;
      items: Array<{
        name: string;
        quantity: number;
        price: number;
      }>;
      subtotal: number;
      tax: number;
      total: number;
      timestamp: string;
    } | null;
  }>({
    isOpen: false,
    details: null
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        logger.info('WebSocket message received:', message);

        if (message.type === 'order_completed') {
          logger.info('Order completed successfully');

          // Show order confirmation modal
          if (message.transaction && message.order) {
            setOrderConfirmation({
              isOpen: true,
              details: {
                orderId: message.order.id,
                transactionId: message.transaction.id,
                items: state.items.map(item => ({
                  name: item.drink.name,
                  quantity: item.quantity,
                  price: item.drink.price
                })),
                subtotal: message.order.total - (message.order.tax || 0),
                tax: message.order.tax || 0,
                total: message.order.total,
                timestamp: message.timestamp
              }
            });
          }

          dispatch({ type: 'CLEAR_CART' });
          queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
        } 
        else if (message.type === 'order_failed') {
          logger.error('Order failed:', message);
          dispatch({ type: 'SET_PROCESSING', isProcessing: false });

          // Handle different types of failures with appropriate messages
          let errorMessage = 'Failed to process order';

          if (message.error === "Some items are out of stock") {
            errorMessage = "Some items in your order are no longer available. Please review your cart.";
          } else if (message.error === "Payment processing failed") {
            if (message.details?.includes("tax_category_id")) {
              errorMessage = "Order processing error. Please try again or contact support if the issue persists.";
            } else {
              errorMessage = "Payment processing failed. Please try again.";
            }
          }

          toast({
            title: 'Order Failed',
            description: errorMessage,
            variant: 'destructive',
          });

          // If items are out of stock, update the cart
          if (message.items) {
            message.items.forEach((item: { drink_id: number, available: boolean }) => {
              if (!item.available) {
                dispatch({ type: 'REMOVE_ITEM', drinkId: item.drink_id });
              }
            });
          }
        }
      } catch (error) {
        logger.error('Error processing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      logger.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      logger.info('WebSocket connection closed');
      setTimeout(() => {
        logger.info('Attempting to reconnect...');
        // The component will re-render and attempt to reconnect
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, [toast, queryClient, state.items]);

  const orderMutation = useMutation({
    mutationFn: async (cartItems: CartItem[]) => {
      logger.info('Starting order placement:', {
        cartItems: cartItems.length,
        total: cartItems.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0)
      });

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: cartItems.map(item => ({
            drink_id: item.drink.id,
            quantity: item.quantity,
            price: item.drink.price
          })),
          total: cartItems.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0)
        }),
      });

      const data = await response.json();
      logger.info('Order response received:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Failed to process order');
      }

      return data;
    },
    onMutate: () => {
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
    },
    onError: (error: Error) => {
      logger.error('Order placement failed:', error);
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });

      toast({
        title: 'Order Failed',
        description: error.message || 'Failed to process order. Please try again.',
        variant: 'destructive',
      });
    }
  });

  const placeOrder = useCallback(async () => {
    if (state.isProcessing) {
      logger.info('Order already processing');
      return;
    }

    if (state.items.length === 0) {
      toast({
        title: 'Error',
        description: 'Your cart is empty.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await orderMutation.mutateAsync(state.items);
    } catch (error) {
      logger.error('Error during order placement:', error);
    }
  }, [state.items, state.isProcessing, toast, orderMutation]);

  const addToCart = useCallback(async (action: AddToCartAction) => {
    if (state.isProcessing) {
      logger.info('Cart is processing, ignoring add request');
      return;
    }

    try {
      logger.info('Adding item to cart:', {
        drinkId: action.drink.id,
        quantity: action.quantity
      });

      dispatch(action);

      toast({
        title: 'Added to Cart',
        description: `Added ${action.quantity} ${action.drink.name}(s) to your cart.`,
        variant: 'default',
      });
    } catch (error) {
      logger.error('Failed to add item to cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to add item to cart.',
        variant: 'destructive',
      });
    }
  }, [toast, state.isProcessing]);

  const removeItem = useCallback(async (drinkId: number) => {
    if (state.isProcessing) {
      logger.info('Cart is processing, ignoring remove request');
      return;
    }

    try {
      logger.info('Removing item from cart:', { drinkId });
      dispatch({ type: 'REMOVE_ITEM', drinkId });

      toast({
        title: 'Removed from Cart',
        description: 'Item removed successfully.',
        variant: 'default',
      });
    } catch (error) {
      logger.error('Error removing item from cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove item from cart.',
        variant: 'destructive',
      });
    }
  }, [toast, state.isProcessing]);

  return (
    <CartContext.Provider
      value={{
        cart: state.items,
        isProcessing: state.isProcessing,
        addToCart,
        removeFromCart: removeItem,
        placeOrder
      }}
    >
      {children}
      {state.isProcessing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <p className="text-lg font-medium">
              {state.items.length > 1
                ? `Processing your ${state.items.length} drinks...`
                : "Processing your drink..."}
            </p>
          </div>
        </div>
      )}
      <OrderConfirmationModal
        isOpen={orderConfirmation.isOpen}
        onClose={() => setOrderConfirmation(prev => ({ ...prev, isOpen: false }))}
        orderDetails={orderConfirmation.details}
      />
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}