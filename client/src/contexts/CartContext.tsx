import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import type { CartState, CartContextType, AddToCartAction, CartItem } from '@/types/cart';

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
          dispatch({ type: 'CLEAR_CART' });
          queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });

          toast({
            title: 'Order Completed',
            description: 'Your order has been processed successfully!',
            variant: 'default',
          });
        } 
        else if (message.type === 'order_failed') {
          logger.info('Order failed:', message.error);
          dispatch({ type: 'SET_PROCESSING', isProcessing: false });

          toast({
            title: 'Order Failed',
            description: message.error || 'Failed to process order',
            variant: 'destructive',
          });
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
    };

    return () => {
      ws.close();
    };
  }, [toast, queryClient]);

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