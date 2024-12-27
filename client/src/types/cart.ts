import type { DrinkItem } from './speech';

export interface CartItem {
  drink: DrinkItem;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  isProcessing: boolean;
}

export interface AddToCartAction {
  type: 'ADD_ITEM';
  drink: DrinkItem;
  quantity: number;
}

export interface CartContextType {
  cart: CartState;
  addToCart: (action: AddToCartAction) => Promise<void>;
  removeItem: (drinkId: number) => Promise<void>;
  placeOrder: () => Promise<void>;
}
