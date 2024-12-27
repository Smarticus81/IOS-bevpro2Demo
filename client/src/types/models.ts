// Common types used throughout the application
export interface Drink {
  id: number;
  name: string;
  price: number;
  category: string;
  subcategory: string;
  image: string;
  inventory: number;
  sales: number;
}

export interface Order {
  id?: number;
  total: number;
  status?: 'pending' | 'paid' | 'cancelled';
  items: OrderItem[];
  created_at?: Date;
}

export interface OrderItem {
  id?: number;
  drink_id: number;
  quantity: number;
  price: number;
}

export interface Tab {
  id?: number;
  name: string;
  status: 'open' | 'closed';
  total: number;
  created_at?: Date;
  closed_at?: Date;
}

export interface PaymentMethod {
  id?: number;
  type: 'card' | 'cash' | 'mobile';
  last_four?: string;
  expires?: string;
}

export interface SplitPayment {
  id?: number;
  order_id: number;
  amount: number;
  payment_method_id: number;
  status: 'pending' | 'completed';
}

export interface EventPackage {
  id?: number;
  name: string;
  description: string;
  price: number;
  drinks: number[];
  min_guests: number;
  max_guests: number;
}
