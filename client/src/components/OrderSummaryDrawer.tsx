import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { OrderSummary } from "./OrderSummary";
import { VoiceControl } from "./VoiceControl";
import type { Drink } from "@db/schema";
import type { CartAction } from "./VoiceControl";

interface OrderSummaryDrawerProps {
  cart: Array<{ drink: Drink; quantity: number }>;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
  isLoading: boolean;
  drinks: Drink[];
  onAddToCart: (params: CartAction) => void;
}

export default function OrderSummaryDrawer(props: OrderSummaryDrawerProps) {
  const itemCount = props.cart.reduce((sum, item) => sum + item.quantity, 0);
  
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <div className="flex gap-2 w-full">
          <Button 
            variant="outline" 
            className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            View Order ({itemCount} items)
          </Button>
          <VoiceControl
            drinks={props.drinks}
            onAddToCart={props.onAddToCart}
            variant="compact"
          />
        </div>
      </DrawerTrigger>
      <DrawerContent>
        <div className="p-4 max-h-[80vh] overflow-auto">
          <OrderSummary {...props} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
