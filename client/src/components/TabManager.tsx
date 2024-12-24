import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQuery, useMutation } from '@tanstack/react-query';
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

  // Enhanced error handling and validation for tab creation
  const createTab = useMutation({
    mutationFn: async () => {
      try {
        console.log('Creating new tab:', {
          name: tabName,
          preAuthAmount,
          total,
          timestamp: new Date().toISOString()
        });

        if (!tabName?.trim()) {
          throw new Error('Tab name is required');
        }

        if (preAuthAmount < total) {
          throw new Error('Pre-authorization amount must be at least the order total');
        }

        const response = await fetch('/api/tabs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tabName.trim(),
            pre_auth_amount: Math.round(preAuthAmount),
            current_amount: Math.round(total),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create tab');
        }

        return response.json();
      } catch (error) {
        console.error('Tab creation error:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          tabName,
          preAuthAmount,
          total,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Tab created successfully:', {
        tabId: data.id,
        name: data.name,
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Tab Created',
        description: `Tab "${data.name}" has been created successfully.`,
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error('Tab creation failed:', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

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
            onClick={() => createTab.mutate()}
            disabled={!tabName?.trim() || createTab.isPending || preAuthAmount < total}
            className="w-full bg-gradient-to-b from-zinc-800 to-black text-white shadow-sm hover:shadow-lg hover:from-zinc-700 hover:to-black transition-all duration-200"
          >
            {createTab.isPending ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </div>
            ) : (
              'Open Tab'
            )}
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