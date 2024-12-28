import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { OrderSummary } from "./OrderSummary";
import { useCart } from "@/contexts/CartContext";

export function OrderSummaryDrawer() {
  const { cart, removeItem: onRemoveItem, placeOrder: onPlaceOrder, isProcessing } = useCart();

  // Calculate total item count
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  logger.debug('OrderSummaryDrawer render', {
    cartItems: cart.length,
    itemCount,
    isProcessing,
  });

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
          <OrderSummary
            cart={cart}
            onRemoveItem={onRemoveItem}
            onPlaceOrder={onPlaceOrder}
            isLoading={isProcessing}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}