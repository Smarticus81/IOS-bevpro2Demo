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

      // Calculate total based on current cart state
      const total = cart.items.reduce((sum, item) => 
        sum + (item.drink.price * item.quantity), 0);

      // Toast notifications disabled
    } catch (error) {
      const errorDetails = {
        action: 'ADD_ITEM',
        itemDetails: { drink: action.drink, quantity: action.quantity },
        currentCartState: { itemCount: cart.items.length, isProcessing: cart.isProcessing },
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      console.error('Cart operation error:', errorDetails);
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
      const errorDetails = {
        action: 'REMOVE_ITEM',
        itemDetails: { drinkId },
        currentCartState: { itemCount: cart.items.length, isProcessing: cart.isProcessing },
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      console.error('Cart operation error:', errorDetails);
      throw error;
    } finally {
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    }
  }, [toast]);

  const placeOrder = useCallback(async () => {
    try {
      dispatch({ type: 'SET_PROCESSING', isProcessing: true });

      // Calculate total before clearing cart
      // Calculate total after the new item is added
      const updatedCart = cartReducer(cart, action);
      const total = updatedCart.items.reduce((sum, item) => 
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
      const errorDetails = {
        action: 'PLACE_ORDER',
        orderDetails: { 
          itemCount: cart.items.length,
          total: cart.items.reduce((sum, item) => sum + (item.drink.price * item.quantity), 0)
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      console.error('Order placement error:', errorDetails);
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