import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Drink } from "@db/schema";

interface OrderSummaryProps {
  cart: Array<{ drink: Drink; quantity: number }>;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
  isLoading: boolean;
}

export function OrderSummary({ 
  cart, 
  onRemoveItem, 
  onPlaceOrder,
  isLoading 
}: OrderSummaryProps) {
  const total = cart.reduce((sum, item) => 
    sum + (item.drink.price * item.quantity), 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Summary</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {cart.map((item, index) => {
          const itemPrice = Number(item.drink.price);
          const totalPrice = itemPrice * item.quantity;
          
          return (
            <div 
              key={`${item.drink.id}-${index}`}
              className="flex justify-between items-center"
            >
              <div>
                <div className="font-medium">
                  {item.drink.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.quantity} × ${itemPrice.toFixed(2)}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  ${totalPrice.toFixed(2)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveItem(item.drink.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}

        {cart.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No items in cart
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-4">
        <div className="w-full flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>${total}</span>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={onPlaceOrder}
          disabled={cart.length === 0 || isLoading}
        >
          {isLoading ? "Processing..." : "Place Order"}
        </Button>
      </CardFooter>
    </Card>
  );
}
