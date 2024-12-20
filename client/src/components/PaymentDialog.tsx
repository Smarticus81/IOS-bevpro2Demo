import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaymentForm } from "@/components/PaymentForm";
import { TabManager } from "@/components/TabManager";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onSuccess?: () => void;
}

export function PaymentDialog({ open, onOpenChange, total, onSuccess }: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Order</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="card" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="card">Pay Now</TabsTrigger>
            <TabsTrigger value="tab">Open Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="card">
            <PaymentForm 
              amount={total}
              onSuccess={onSuccess}
            />
          </TabsContent>
          <TabsContent value="tab">
            <TabManager
              total={total}
              onSuccess={onSuccess}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
