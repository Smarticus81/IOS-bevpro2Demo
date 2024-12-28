import { useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { OrderSummary } from "./OrderSummary";
import type { Drink } from "@db/schema";

interface OrderSummaryDrawerProps {
  cart: Array<{ drink: Drink; quantity: number }> | undefined; // Allow undefined cart
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
  isLoading: boolean;
  drinks: Drink[]; // Assuming drinks data is managed externally
  onAddToCart: (action: { type: 'ADD_ITEM'; drink: Drink; quantity: number }) => void;
}

export function OrderSummaryDrawer(props: OrderSummaryDrawerProps) {
  // Ensure cart defaults to an empty array if undefined
  const cart = props.cart || [];

  // Fetch drinks data with React Query
  const { data: drinks = [] } = useQuery({
    queryKey: ['/api/drinks'],
    queryFn: async () => {
      const response = await fetch('/api/drinks');
      if (!response.ok) {
        throw new Error('Failed to fetch drinks');
      }
      return response.json();
    },
    staleTime: 30000,
  });

  // Logging for debugging purposes
  logger.debug('OrderSummaryDrawer render', {
    cartItems: cart.length,
    availableDrinks: drinks.length,
    cartContents: cart.map(item => ({
      id: item.drink.id,
      name: item.drink.name,
      quantity: item.quantity,
    })),
  });

  console.log('OrderSummaryDrawer render:', {
    cartItems: cart.length,
    itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    isProcessing: props.isLoading,
    cartContents: cart.map(item => ({
      id: item.drink.id,
      name: item.drink.name,
      quantity: item.quantity,
    })),
  });

  // Calculate total item count
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          View Order ({itemCount} items)
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="p-4 max-h-[80vh] overflow-auto">
          <OrderSummary {...props} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
