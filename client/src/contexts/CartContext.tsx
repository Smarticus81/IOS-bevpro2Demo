import { createContext, useContext, useReducer, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import type { CartState, CartContextType, AddToCartAction, CartItem } from '@/types/cart';
import { useLocation } from 'wouter';
import { useInventoryManager } from '@/hooks/useInventoryManager';

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
  const { updateInventory } = useInventoryManager();

  // Define orderMutation first, before any functions that use it
  const orderMutation = useMutation({
    mutationFn: async (cartItems: CartItem[]) => {
      logger.info('Initiating order placement', {
        cartSize: cartItems.length,
        total: cartItems.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0)
      });

      // Update inventory for all items
      await Promise.all(cartItems.map(async (item) => {
        const success = await updateInventory({
          drinkId: item.drink.id,
          quantity: item.quantity,
          isIncrement: false
        });

        if (!success) {
          throw new Error(`Failed to update inventory for ${item.drink.name}`);
        }
      }));

      // In demo mode, always succeed after inventory update
      const demoTransactionId = `demo-${Date.now()}`;
      return {
        transactionId: demoTransactionId,
        success: true
      };
    },
    onSuccess: async (data) => {
      logger.info('Payment successful, clearing cart');
      dispatch({ type: 'CLEAR_CART' });

      // Invalidate all relevant queries to refresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/drinks'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/pour-inventory'] })
      ]);

      toast({
        title: 'Order Confirmed',
        description: 'Your order has been processed successfully!',
        variant: 'default',
      });

      // Navigate to confirmation page
      setLocation(`/payment-confirmation?transaction=${data.transactionId}`);
    },
    onError: async (error) => {
      logger.error('Payment error:', error);
      toast({
        title: 'Order Failed',
        description: error instanceof Error ? error.message : 'Failed to process order',
        variant: 'destructive',
      });

      // Restore inventory counts on error
      queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
    },
    onSettled: () => {
      logger.info('Payment processing complete');
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    },
  });

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

    try {
      await orderMutation.mutateAsync(state.items);
    } catch (error) {
      logger.error('Error during order placement:', error);
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [state.items, state.isProcessing, toast, orderMutation]);

  // Add to Cart with inventory validation
  const addToCart = useCallback(async (action: AddToCartAction) => {
    if (state.isProcessing) {
      logger.info('Cart is currently processing, ignoring add request');
      return;
    }

    try {
      // Check if we have enough inventory
      const existingItem = state.items.find(item => item.drink.id === action.drink.id);
      const totalQuantity = (existingItem?.quantity || 0) + action.quantity;

      if (action.drink.inventory < totalQuantity) {
        toast({
          title: 'Insufficient Inventory',
          description: `Only ${action.drink.inventory} units available`,
          variant: 'destructive',
        });
        return;
      }

      // Optimistically update the cart
      dispatch(action);

      // Optimistically update the cache
      queryClient.setQueryData(['/api/drinks'], (old: any) => {
        if (!old?.drinks) return old;
        return {
          ...old,
          drinks: old.drinks.map((drink: any) =>
            drink.id === action.drink.id
              ? { ...drink, inventory: drink.inventory - action.quantity }
              : drink
          ),
        };
      });

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
  }, [toast, state.isProcessing, queryClient]);

  // Remove from Cart with inventory restoration
  const removeItem = useCallback(async (drinkId: number) => {
    if (state.isProcessing) {
      logger.info('Cart is currently processing, ignoring remove request');
      return;
    }

    try {
      const item = state.items.find(item => item.drink.id === drinkId);
      if (!item) return;

      // Optimistically update the cart
      dispatch({ type: 'REMOVE_ITEM', drinkId });

      // Optimistically update the cache
      queryClient.setQueryData(['/api/drinks'], (old: any) => {
        if (!old?.drinks) return old;
        return {
          ...old,
          drinks: old.drinks.map((drink: any) =>
            drink.id === drinkId
              ? { ...drink, inventory: drink.inventory + item.quantity }
              : drink
          ),
        };
      });

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
  }, [toast, state.isProcessing, queryClient]);

  return (
    <CartContext.Provider
      value={{
        cart: state.items,
        isProcessing: state.isProcessing,
        addToCart,
        removeItem,
        placeOrder
      }}
    >
      {children}
      {state.isProcessing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
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

// useCart Hook
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}