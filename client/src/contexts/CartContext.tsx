import { createContext, useContext, useReducer, useCallback } from 'react';
import type { CartState, CartContextType, AddToCartAction } from '@/types/cart';
import { useToast } from '@/hooks/use-toast';

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
  const [cart, dispatch] = useReducer(cartReducer, {
    items: [],
    isProcessing: false
  });

  const { toast } = useToast();

  const addToCart = useCallback(async (action: AddToCartAction) => {
    try {
      if (cart.isProcessing) return;
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      dispatch(action);

      const total = cart.items.reduce((sum, item) => 
        sum + (item.drink.price * item.quantity), 0);

      // Toast notifications disabled
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: 'Error',
        description: JSON.stringify({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to add item to cart'
        }),
        variant: 'destructive',
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [cart.items, toast]);

  const removeItem = useCallback(async (drinkId: number) => {
    try {
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });
      dispatch({ type: 'REMOVE_ITEM', drinkId });
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        title: 'Error',
        description: JSON.stringify({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to remove item'
        }),
        variant: 'destructive',
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [toast]);

  const placeOrder = useCallback(async () => {
    try {
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });

      // Calculate total before clearing cart
      const total = cart.items.reduce((sum, item) => 
        sum + (item.drink.price * item.quantity), 0);

      // Clear the cart
      dispatch({ type: 'CLEAR_CART' });

      toast({
        title: 'Order Complete',
        description: JSON.stringify({
          status: 'success',
          total: `$${total.toFixed(2)}`,
          items: cart.items.length
        }),
      });
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: 'Error',
        description: JSON.stringify({
          status: 'error',
          message: error instanceof Error ? error.message : 'Failed to place order'
        }),
        variant: 'destructive',
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [cart.items, toast]);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeItem, placeOrder }}>
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