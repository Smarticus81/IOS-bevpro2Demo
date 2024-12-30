import type { Drink } from '@db/schema';

export interface CartItem {
  drink: Drink;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  isProcessing: boolean;
}

export interface AddToCartAction {
  type: 'ADD_ITEM';
  drink: Drink;
  quantity: number;
}

export interface CartContextType {
  cart: CartItem[];
  isProcessing: boolean;
  addToCart: (action: AddToCartAction) => Promise<void>;
  removeItem: (drinkId: number) => Promise<void>;
  placeOrder: () => Promise<void>;
}