import { createContext, useContext, useReducer, useCallback } from 'react';
import type { CartState, CartContextType, AddToCartAction } from '@/types/cart';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query'; // Added import for React Query


const CartContext = createContext<CartContextType | undefined>(undefined);

type CartAction =
  | AddToCartAction
  | { type: 'REMOVE_ITEM'; drinkId: number }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_PROCESSING'; isProcessing: boolean };

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
          )
        };
      }
      return {
        ...state,
        items: [...state.items, { drink: action.drink, quantity: action.quantity }]
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.drink.id !== action.drinkId)
      };
    case 'CLEAR_CART':
      return {
        ...state,
        items: []
      };
    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.isProcessing
      };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    isProcessing: false
  });

  const { toast } = useToast();
  const queryClient = useQueryClient(); // Added for React Query invalidation
  const logger = null; // Placeholder for centralized logger - needs implementation

  const orderMutation = useMutation({
    mutationFn: async (cartItems: typeof state.items) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItems }),
      });
      if (!response.ok) throw new Error('Failed to place order');
      return response.json();
    },
    onSuccess: () => {
      dispatch({ type: 'CLEAR_CART' });
      queryClient.invalidateQueries({ queryKey: ['/api/drinks'] });
      window.location.href = '/payment-confirmation';
    },
    onError: (error) => {
      logger.error('Order placement failed', { error }); // Assuming logger is available
      toast({
        title: "Error",
        description: "Failed to place order",
        variant: "destructive",
      });
    }
  });

  const placeOrder = useCallback(async () => {
    try {
      if (state.isProcessing) return;
      if (state.items.length === 0) {
        toast({
          title: "Error",
          description: "Cart is empty",
          variant: "destructive",
        });
        return;
      }

      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      await orderMutation.mutateAsync(state.items);
    } catch (error) {
      console.error('Order placement error:', error);
      toast({
        title: "Error",
        description: "Failed to place order",
        variant: "destructive",
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [state.items, state.isProcessing, toast, orderMutation.mutateAsync]);

  const addToCart = useCallback(async (action: AddToCartAction) => {
    try {
      if (state.isProcessing) return;

      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      dispatch(action);

    } catch (error) {
      console.error('Cart operation error:', error);
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive",
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [state.isProcessing, toast]);

  const removeItem = useCallback(async (drinkId: number) => {
    try {
      if (state.isProcessing) return;

      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      dispatch({ type: 'REMOVE_ITEM', drinkId });

    } catch (error) {
      console.error('Cart operation error:', error);
      toast({
        title: "Error",
        description: "Failed to remove item from cart",
        variant: "destructive",
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [state.isProcessing, toast]);


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