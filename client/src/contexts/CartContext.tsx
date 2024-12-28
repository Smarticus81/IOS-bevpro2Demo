import { createContext, useContext, useReducer, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CartState, CartContextType, AddToCartAction } from '@/types/cart';

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

  // Place Order Mutation
  const orderMutation = useMutation({
    mutationFn: async (cartItems: typeof state.items) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItems }),
      });
      if (!response.ok) {
        throw new Error('Failed to place order');
      }
      return response.json();
    },
    onSuccess: () => {
      dispatch({ type: 'CLEAR_CART' });
      queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
      toast({
        title: 'Success',
        description: 'Order placed successfully!',
        variant: 'default',
      });
      window.location.href = '/payment-confirmation';
    },
    onError: (error) => {
      console.error('Order placement failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to place order. Try again later.',
        variant: 'destructive',
      });
    },
  });

  // Add to Cart
  const addToCart = useCallback(async (action: AddToCartAction) => {
    try {
      logger.info('Adding item to cart', {
        drinkId: action.drink.id,
        drinkName: action.drink.name,
        quantity: action.quantity,
        currentCartSize: state.items.length
      });

      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      dispatch(action);

      logger.info('Item added to cart successfully', {
        drinkId: action.drink.id,
        cartSize: state.items.length + 1
      });

      toast({
        title: 'Added to Cart',
        description: `${action.quantity} ${action.drink.name}(s) added to your cart.`,
        variant: 'default',
      });
    } catch (error) {
      logger.error('Failed to add item to cart', {
        error,
        drinkId: action.drink.id,
        drinkName: action.drink.name
      });
      
      toast({
        title: 'Error',
        description: 'Failed to add item to cart.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [toast, state.items.length]);

  // Remove from Cart
  const removeItem = useCallback(async (drinkId: number) => {
    try {
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      dispatch({ type: 'REMOVE_ITEM', drinkId });
      toast({
        title: 'Removed from Cart',
        description: 'Item removed successfully.',
        variant: 'default',
      });
    } catch (error) {
      console.error('Error removing item from cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove item from cart.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [toast]);

  // Place Order
  const placeOrder = useCallback(async () => {
    try {
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
      console.error('Error placing order:', error);
      toast({
        title: 'Error',
        description: 'Failed to place order.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [state.items, state.isProcessing, orderMutation, toast]);

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
