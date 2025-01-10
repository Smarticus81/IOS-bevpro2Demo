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
    const itemPrice = Number(item.drink.price) || 0;
    const quantity = Number(item.quantity) || 0;
    return sum + (itemPrice * quantity);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Order Summary</h3>
          <Badge variant="outline" className="bg-gray-100">
            {cart.length} items
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {cart.map((item, index) => {
          const itemPrice = Number(item.drink.price);
          const totalPrice = itemPrice * item.quantity;

          return (
            <div 
              key={`${item.drink.id}-${index}`}
              className="flex items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium">
                    {item.drink.name}
                  </div>
                  <span className="font-medium">
                    ${totalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 flex items-center justify-between">
                  <span>{item.quantity} × ${itemPrice.toFixed(2)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveItem(item.drink.id)}
                    className="h-8 px-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {cart.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-600">Ready to take your order</p>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between font-semibold text-lg">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
            onClick={onPlaceOrder}
            disabled={cart.length === 0 || isLoading}
          >
            {isLoading ? "Processing..." : "Place Order"}
          </Button>

          <Button
            variant="destructive"
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            size="lg"
            onClick={() => {
              if (cart.length > 0) {
                cart.forEach(item => onRemoveItem(item.drink.id));
              }
            }}
            disabled={cart.length === 0 || isLoading}
          >
            Void Order
          </Button>
        </div>
      </div>
    </div>
  );
}