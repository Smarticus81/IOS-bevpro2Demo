
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { OrderSummary } from "./OrderSummary";
import type { Drink } from "@db/schema";

interface OrderSummaryDrawerProps {
  cart: Array<{ drink: Drink; quantity: number }>;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
  isLoading: boolean;
  drinks: Drink[];
  onAddToCart: (action: { type: 'ADD_ITEM'; drink: Drink; quantity: number }) => void;
}

export function OrderSummaryDrawer(props: OrderSummaryDrawerProps) {
  const { data: drinks } = useQuery({
    queryKey: ['/api/drinks'],
    staleTime: 30000,
  });

  logger.debug('OrderSummaryDrawer render', {
    cartItems: props.cart.length,
    availableDrinks: drinks?.length,
    cartContents: props.cart.map(item => ({
      id: item.drink.id,
      name: item.drink.name,
      quantity: item.quantity
    }))
  });
  console.log('OrderSummaryDrawer render:', { 
    cartItems: props.cart.length,
    itemCount: props.cart.reduce((sum, item) => sum + item.quantity, 0),
    isProcessing: props.isLoading,
    cartContents: props.cart.map(item => ({
      id: item.drink.id,
      name: item.drink.name,
      quantity: item.quantity
    }))
  });
  const itemCount = props.cart.reduce((sum, item) => sum + item.quantity, 0);
  
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
