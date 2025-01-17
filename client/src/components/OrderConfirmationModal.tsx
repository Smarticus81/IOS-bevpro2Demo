import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface OrderConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetails: {
    orderId: number;
    transactionId: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    timestamp: string;
  } | null;
}

export function OrderConfirmationModal({ 
  isOpen, 
  onClose, 
  orderDetails 
}: OrderConfirmationModalProps) {
  if (!orderDetails) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <DialogTitle className="text-xl">Order Confirmed!</DialogTitle>
          </div>
          <div className="text-sm text-muted-foreground">
            Transaction ID: {orderDetails.transactionId}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <ScrollArea className="h-[280px] pr-4">
            <div className="space-y-4">
              {orderDetails.items.map((item, index) => (
                <div 
                  key={`${item.name}-${index}`}
                  className="flex justify-between items-center py-2 border-b border-border last:border-0"
                >
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Qty: {item.quantity} × ${item.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="font-medium">
                    ${(item.quantity * item.price).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="space-y-2 pt-4 border-t border-border">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${orderDetails.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax</span>
              <span>${orderDetails.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium text-lg pt-2">
              <span>Total</span>
              <span>${orderDetails.total.toFixed(2)}</span>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {formatDate(new Date(orderDetails.timestamp))}
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
