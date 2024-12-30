import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { PaymentForm } from '@/components/PaymentForm';

interface TabManagerProps {
  orderId?: number;
  total: number;
  onSuccess?: () => void;
}

export function TabManager({ orderId, total, onSuccess }: TabManagerProps) {
  const [tabName, setTabName] = useState('');
  const [preAuthAmount, setPreAuthAmount] = useState(total);
  const { toast } = useToast();

  const createTab = async () => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: 'Tab Created',
        description: `Tab "${tabName}" has been created successfully.`,
      });

      onSuccess?.();
    } catch (error) {
      // In demo mode, still succeed
      toast({
        title: 'Tab Created',
        description: `Tab "${tabName}" has been created successfully.`,
      });
      onSuccess?.();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md border-white/20 shadow-xl">
      <CardHeader>
        <CardTitle>Open a Tab</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Tab Name</label>
          <Input 
            value={tabName}
            onChange={(e) => setTabName(e.target.value)}
            placeholder="Enter a name for this tab"
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Pre-Authorization Amount</label>
          <Input
            type="number"
            value={preAuthAmount}
            onChange={(e) => setPreAuthAmount(Number(e.target.value))}
            min={total}
            className="w-full"
          />
          <p className="text-xs text-gray-500">
            Minimum amount: ${(total / 100).toFixed(2)}
          </p>
        </div>

        <div className="space-y-4">
          <Button
            onClick={createTab}
            disabled={!tabName || preAuthAmount < total}
            className="w-full bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm hover:shadow-lg hover:from-zinc-700 hover:to-black transition-all duration-200"
          >
            Open Tab
          </Button>

          {preAuthAmount < total && (
            <p className="text-sm text-red-500">
              Pre-authorization amount must be at least the current order total.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-gray-200">
          <PaymentForm 
            amount={preAuthAmount} 
            onSuccess={onSuccess}
          />
        </div>
      </CardContent>
    </Card>
  );
}