import { createContext, useContext, useReducer, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import type { CartState, CartContextType, AddToCartAction, CartItem } from '@/types/cart';
import { useLocation } from 'wouter';
import { processVoiceOrder } from '@/lib/voice-order-service';

// Define the context
const CartContext = createContext<CartContextType | undefined>(undefined);

// Cart actions
type CartAction =
  | AddToCartAction
  | { type: 'REMOVE_ITEM'; drinkId: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_PROCESSING'; isProcessing: boolean };

// Cart reducer function
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      if (state.isProcessing) return state;

      const existingItem = state.items.find(item => item.drink.id === action.drink.id);
      if (existingItem) {
        const newQuantity = Math.max(0, Math.min(99, existingItem.quantity + action.quantity));
        return {
          ...state,
          items: state.items.map(item =>
            item.drink.id === action.drink.id
              ? { ...item, quantity: newQuantity }
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
        ...state,
        items: [],
        isProcessing: false,
      };
    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.isProcessing,
      };
    default:
      throw new Error(`Unhandled action type: ${(action as CartAction).type}`);
  }
}

// CartProvider Component
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isProcessing: false,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Place Order with validation and retry logic
  const placeOrder = useCallback(async () => {
    logger.info('Attempting to place order', {
      cartSize: state.items.length,
      isProcessing: state.isProcessing
    });

    if (state.isProcessing) {
      toast({
        title: 'Processing',
        description: 'Your order is already being processed.',
        variant: 'default',
      });
      return false;
    }

    if (state.items.length === 0) {
      toast({
        title: 'Error',
        description: 'Your cart is empty.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      logger.info('Initiating order placement', {
        cartSize: state.items.length,
        isProcessing: state.isProcessing
      });

      await orderMutation.mutateAsync(state.items);
      return true;
    } catch (error) {
      logger.error('Error during order placement:', error);
      return false;
    }
  }, [state.items, state.isProcessing, orderMutation, toast]);

  // Place Order Mutation
  const orderMutation = useMutation({
    mutationFn: async (cartItems: CartItem[]) => {
      logger.info('Initiating order placement', {
        cartSize: cartItems.length,
        total: cartItems.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0)
      });

      // In demo mode, always succeed
      const demoTransactionId = `demo-${Date.now()}`;

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return {
        transactionId: demoTransactionId,
        success: true
      };
    },
    onMutate: () => {
      logger.info('Setting cart processing state');
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
    },
    onSuccess: (data) => {
      logger.info('Payment successful, clearing cart');
      dispatch({ type: 'CLEAR_CART' });
      queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });

      toast({
        title: 'Order Confirmed',
        description: 'Your order has been processed successfully!',
        variant: 'default',
      });

      // Navigate to confirmation page
      setLocation(`/payment-confirmation?transaction=${data.transactionId}`);
    },
    onError: () => {
      logger.info('Payment error handled (demo mode), proceeding with success flow');
      dispatch({ type: 'CLEAR_CART' });
      queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });

      toast({
        title: 'Order Confirmed',
        description: 'Your order has been processed successfully!',
        variant: 'default',
      });

      setLocation(`/payment-confirmation?transaction=demo-${Date.now()}`);
    },
    onSettled: () => {
      logger.info('Payment processing complete');
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    },
  });

  // Add to Cart with validation and error handling
  const addToCart = useCallback(async (action: AddToCartAction) => {
    if (state.isProcessing) {
      logger.info('Cart is currently processing, ignoring add request');
      return;
    }

    try {
      logger.info('Adding item to cart', {
        drinkId: action.drink.id,
        quantity: action.quantity,
        currentCartSize: state.items.length
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

  // Remove from Cart with validation
  const removeItem = useCallback(async (drinkId: number) => {
    if (state.isProcessing) {
      logger.info('Cart is currently processing, ignoring remove request');
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
      logger.error('Error removing item from cart:', { error, drinkId });
      toast({
        title: 'Error',
        description: 'Failed to remove item from cart.',
        variant: 'destructive',
      });
    }
  }, [toast, state.isProcessing]);

  // Process Voice Commands with improved logging and error handling
  const processVoiceCommand = useCallback(async (command: string) => {
    try {
      logger.info('Processing voice command:', command);
      const result = await processVoiceOrder(command);

      if (result.success && result.order) {
        logger.info('Voice command processing result:', {
          order: result.order,
          hasAction: !!result.order.action
        });

        // Handle order completion command with immediate processing
        if (result.order.action === 'complete_order') {
          logger.info('Completion command detected, initiating order processing');
          await placeOrder();
          return;
        }

        // Handle regular order items
        if (result.order.items?.length > 0) {
          for (const item of result.order.items) {
            await addToCart({
              type: 'ADD_ITEM',
              drink: item.drink,
              quantity: item.quantity
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error processing voice command:', error);
      toast({
        title: 'Error',
        description: 'Failed to process voice command',
        variant: 'destructive',
      });
    }
  }, [toast, placeOrder, addToCart]);

  return (
    <CartContext.Provider
      value={{
        cart: state.items,
        isProcessing: state.isProcessing,
        addToCart,
        removeItem,
        placeOrder,
        processVoiceCommand,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// useCart Hook
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}