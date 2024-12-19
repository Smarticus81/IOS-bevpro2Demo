import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import type { Drink } from "@db/schema";

interface OrderSummaryProps {
  cart: Array<{ drink: Drink; quantity: number }>;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
  isLoading: boolean;
  variant?: "default" | "compact";
}

export function OrderSummary({ 
  cart, 
  onRemoveItem, 
  onPlaceOrder,
  isLoading,
  variant = "default" 
}: OrderSummaryProps) {
  const total = cart.reduce((sum, item) => {
    const itemPrice = Number(item.drink.price);
    return sum + (itemPrice * item.quantity);
  }, 0);

  return (
    <div className={variant === "compact" ? "space-y-3" : "space-y-4"}>
      {variant === "default" && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Order Summary</h3>
          <Badge variant="outline" className="bg-primary/10 text-primary">
            {cart.length} items
          </Badge>
        </div>
      )}
      
      <div className={`space-y-${variant === "compact" ? "2" : "3"} overflow-auto max-h-[33vh] pr-2 -mr-2`}>
        {cart.map((item, index) => {
          const itemPrice = Number(item.drink.price);
          const totalPrice = itemPrice * item.quantity;
          
          return (
            <div 
              key={`${item.drink.id}-${index}`}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium truncate">
                    {item.drink.name}
                  </div>
                  <span className="font-medium whitespace-nowrap">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-between">
                  <span>{item.quantity} × ${itemPrice.toFixed(2)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onRemoveItem(item.drink.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {cart.length === 0 && (
          <div className={`text-center text-muted-foreground py-${variant === "compact" ? "4" : "8"}`}>
            No items in cart
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <Button
          className="w-full"
          size={variant === "compact" ? "default" : "lg"}
          onClick={onPlaceOrder}
          disabled={cart.length === 0 || isLoading}
        >
          {isLoading ? "Processing..." : "Place Order"}
        </Button>
      </div>
    </div>
  );
}
