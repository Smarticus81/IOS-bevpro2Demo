import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Drink } from "@db/schema";

interface OrderSummaryProps {
  cart: Array<{ drink: Drink; quantity: number }>;
  onRemoveItem: (drinkId: number) => void;
  onPlaceOrder: () => void;
  isLoading: boolean;
  variant?: "default" | "compact";
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function OrderSummary({ 
  cart, 
  onRemoveItem, 
  onPlaceOrder,
  isLoading,
  variant = "default",
  isCollapsed = false,
  onToggleCollapse
}: OrderSummaryProps) {
  const total = cart.reduce((sum, item) => {
    const itemPrice = Number(item.drink.price);
    return sum + (itemPrice * item.quantity);
  }, 0);

  return (
    <div className={variant === "compact" ? "space-y-3" : "space-y-4"}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {variant === "default" && <h3 className="text-lg font-semibold">Order Summary</h3>}
          <Badge variant="outline" className="bg-primary/10 text-primary">
            {cart.length} items
          </Badge>
        </div>
        {variant === "compact" && onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onToggleCollapse}
          >
            {isCollapsed ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
      
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={`space-y-${variant === "compact" ? "2" : "3"} overflow-y-auto max-h-[50vh] pr-2 -mr-2 scrollbar-thin scrollbar-thumb-primary/10 scrollbar-track-transparent`}
          >
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
                <div className={`text-center py-${variant === "compact" ? "4" : "8"} border-2 border-dashed border-primary/20 rounded-lg bg-white shadow-inner`}>
                  <p className="text-primary font-medium">Ready to take your order</p>
                </div>
              )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <div className="flex items-center justify-between font-semibold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full bg-gradient-to-br from-primary via-primary/90 to-primary/80 hover:from-primary/90 hover:via-primary/80 hover:to-primary/70 text-white font-semibold transform transition-all duration-200 hover:scale-[1.02] shadow-xl hover:shadow-primary/40 border border-primary/20"
            size={variant === "compact" ? "default" : "lg"}
            onClick={onPlaceOrder}
            disabled={cart.length === 0 || isLoading}
          >
            {isLoading ? "Processing..." : "Place Order"}
          </Button>
          
          <Button
            variant="destructive"
            className="w-full bg-gradient-to-br from-destructive via-destructive/90 to-destructive/80 hover:from-destructive/90 hover:via-destructive/80 hover:to-destructive/70 text-white font-semibold transform transition-all duration-200 hover:scale-[1.02] shadow-xl hover:shadow-destructive/40 border border-destructive/20"
            size={variant === "compact" ? "default" : "lg"}
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