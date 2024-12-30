import { createContext, useContext, useReducer, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import type { CartState, CartContextType, AddToCartAction } from '@/types/cart';
import { useLocation } from 'wouter';

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
      return {
        ...state,
        items: state.items.filter(item => item.drink.id !== action.drinkId),
      };
    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
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

  // Place Order Mutation with retry logic
  const orderMutation = useMutation({
    mutationFn: async (cartItems: typeof state.items) => {
      let retryCount = 0;
      const MAX_RETRIES = 3;

      const attemptOrder = async () => {
        try {
          logger.info('Attempting order placement:', {
            attempt: retryCount + 1,
            maxRetries: MAX_RETRIES,
            itemCount: cartItems.length,
            total: cartItems.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0)
          });

          // Step 1: Create the order
          const orderResponse = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              items: cartItems,
              total: cartItems.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0),
              status: 'pending'
            }),
          });

          if (!orderResponse.ok) {
            const errorText = await orderResponse.text();
            logger.error('Order creation failed:', {
              status: orderResponse.status,
              error: errorText,
              attempt: retryCount + 1
            });

            if (retryCount < MAX_RETRIES) {
              retryCount++;
              return await attemptOrder();
            }
            throw new Error(errorText || 'Failed to create order');
          }

          const orderData = await orderResponse.json();
          logger.info('Order created successfully:', { orderId: orderData.id });

          // Step 2: Process payment with improved error tracking
          const paymentResponse = await fetch('/api/payment/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: cartItems.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0) * 100, // Convert to cents
              orderId: orderData.id
            }),
          });

          if (!paymentResponse.ok) {
            const errorText = await paymentResponse.text();
            logger.error('Payment processing failed:', {
              status: paymentResponse.status,
              error: errorText,
              orderId: orderData.id,
              attempt: retryCount + 1
            });

            if (retryCount < MAX_RETRIES) {
              retryCount++;
              return await attemptOrder();
            }
            throw new Error(errorText || 'Payment processing failed');
          }

          const paymentData = await paymentResponse.json();
          if (!paymentData.success) {
            logger.error('Payment unsuccessful:', {
              paymentData,
              attempt: retryCount + 1,
              transactionId: paymentData.transactionId
            });

            if (retryCount < MAX_RETRIES) {
              retryCount++;
              return await attemptOrder();
            }
            throw new Error(paymentData.error || 'Payment was unsuccessful');
          }

          logger.info('Payment processed successfully:', {
            orderId: orderData.id,
            transactionId: paymentData.transactionId,
            timestamp: paymentData.timestamp
          });

          return { 
            order: orderData, 
            payment: paymentData,
            transactionId: paymentData.transactionId
          };
        } catch (error) {
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            logger.warn('Retrying order/payment:', {
              error,
              attempt: retryCount,
              maxRetries: MAX_RETRIES
            });
            return await attemptOrder();
          }
          throw error;
        }
      };

      return attemptOrder();
    },
    onSuccess: (data) => {
      dispatch({ type: 'CLEAR_CART' });
      queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });

      toast({
        title: 'Success',
        description: 'Order placed and payment processed successfully!',
        variant: 'default',
      });

      // Navigate to success page with transaction ID
      setLocation(`/payment-confirmation?transaction=${data.transactionId}`);
    },
    onError: (error: Error) => {
      logger.error('Order/payment failed:', error);

      toast({
        title: 'Payment Failed',
        description: error.message || 'Failed to process order. Please try again.',
        variant: 'destructive',
      });

      // Navigate to failure page
      setLocation('/payment-failed');
    },
  });

  // Add to Cart with error recovery
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

      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      dispatch(action);

      toast({
        title: 'Added to Cart',
        description: `${action.quantity} ${action.drink.name}(s) added to your cart.`,
        variant: 'default',
      });
    } catch (error) {
      logger.error('Failed to add item to cart:', {
        error,
        drinkId: action.drink.id,
        drinkName: action.drink.name
      });

      // Revert the add action on error
      dispatch({ type: 'REMOVE_ITEM', drinkId: action.drink.id });

      toast({
        title: 'Error',
        description: 'Failed to add item to cart.',
        variant: 'destructive',
      });
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [toast, state.items.length, state.isProcessing]);

  // Remove from Cart with validation
  const removeItem = useCallback(async (drinkId: number) => {
    if (state.isProcessing) {
      logger.info('Cart is currently processing, ignoring remove request');
      return;
    }

    try {
      logger.info('Removing item from cart:', { drinkId });
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      const itemToRemove = state.items.find(item => item.drink.id === drinkId);

      if (!itemToRemove) {
        logger.warn('Item not found in cart:', { drinkId });
        return;
      }

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
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [toast, state.isProcessing, state.items]);

  // Place Order with validation and retry
  const placeOrder = useCallback(async () => {
    try {
      logger.info('Initiating order placement', {
        cartSize: state.items.length,
        isProcessing: state.isProcessing
      });

      if (state.isProcessing) {
        toast({
          title: 'Processing',
          description: 'Your order is already being processed.',
          variant: 'default',
        });
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

      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      await orderMutation.mutateAsync(state.items);
    } catch (error) {
      logger.error('Error placing order:', error);
      toast({
        title: 'Payment Failed',
        description: error instanceof Error ? error.message : 'Failed to place order.',
        variant: 'destructive',
      });
      setLocation('/payment-failed');
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [state.items, state.isProcessing, orderMutation, toast, setLocation]);

  return (
    <CartContext.Provider
      value={{
        cart: state.items,
        isProcessing: state.isProcessing,
        addToCart,
        removeItem,
        placeOrder,
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