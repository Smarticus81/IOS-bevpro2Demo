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
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-medium text-gray-900">Order Summary</h2>
        <p className="text-gray-500 mt-1">{cart.length} items</p>
      </div>

      <div className="flex-1 overflow-y-auto -mx-6 px-6">
        <div className="space-y-4">
          {cart.map((item, index) => {
            const itemPrice = Number(item.drink.price);
            const totalPrice = itemPrice * item.quantity;

            return (
              <div 
                key={`${item.drink.id}-${index}`}
                className="flex items-center justify-between py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-medium text-gray-900 truncate">
                      {item.drink.name}
                    </h3>
                    <span className="font-medium text-gray-900">
                      ${totalPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-500 text-sm">
                      {item.quantity} × ${itemPrice.toFixed(2)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveItem(item.drink.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-medium text-gray-900">Total</span>
          <span className="text-lg font-medium text-gray-900">${total.toFixed(2)}</span>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
            onClick={onPlaceOrder}
            disabled={cart.length === 0 || isLoading}
          >
            {isLoading ? "Processing..." : "Charge"}
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 text-red-600 border-red-600 hover:bg-red-50 font-medium"
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