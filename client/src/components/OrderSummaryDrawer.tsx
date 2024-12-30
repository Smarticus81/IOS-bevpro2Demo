import React from 'react';
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
  DrawerTitle,
  DrawerDescription,
  DrawerHeader,
  DrawerClose,
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
          disabled={isProcessing}
          aria-label={`View order cart with ${itemCount} items`}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          View Order ({itemCount} items)
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Your Order Summary</DrawerTitle>
          <DrawerDescription>
            Review your items and complete your order
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pb-6 max-h-[80vh] overflow-auto">
          <OrderSummary
            cart={cart}
            onRemoveItem={onRemoveItem}
            onPlaceOrder={onPlaceOrder}
            isLoading={isProcessing}
            variant="compact"
          />
        </div>
        <DrawerClose className="sr-only">Close order summary</DrawerClose>
      </DrawerContent>
    </Drawer>
  );
}