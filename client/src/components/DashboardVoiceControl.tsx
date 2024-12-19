import { useState } from 'react';
import { processDashboardCommand, type DashboardCommandResult } from '@/lib/dashboard-voice-commands';
import { VoiceControl } from './VoiceControl';
import { VoiceFeedback } from './VoiceFeedback';
import { useToast } from '@/hooks/use-toast';
import type { Drink } from '@db/schema';
import type { CartAction } from './VoiceControl';

interface DashboardVoiceControlProps {
  drinks: Drink[];
  onFilterChange: (filter: { category?: string }) => void;
  onTimeRangeChange: (range: 'day' | 'week' | 'month' | 'year') => void;
  onChartTypeChange: (type: 'bar' | 'line' | 'pie') => void;
}

export function DashboardVoiceControl({
  drinks,
  onFilterChange,
  onTimeRangeChange,
  onChartTypeChange
}: DashboardVoiceControlProps) {
  const [lastCommand, setLastCommand] = useState<DashboardCommandResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  
  const handleVoiceCommand = async (text: string) => {
    try {
      console.log('Processing dashboard voice command:', text);
      setIsProcessing(true);
      const result = await processDashboardCommand(text);
      setLastCommand(result);

      console.log('Processing intent:', result);

      switch (result.type) {
        case 'filter':
          if (result.data.category) {
            console.log('Applying category filter:', result.data.category);
            onFilterChange({ category: result.data.category });
            toast({
              title: "Filter Applied",
              description: result.message,
            });
          }
          break;
        case 'timeRange':
          if (result.data.timeRange) {
            console.log('Changing time range:', result.data.timeRange);
            onTimeRangeChange(result.data.timeRange);
            toast({
              title: "Time Range Updated",
              description: result.message,
            });
          }
          break;
        case 'chart':
          if (result.data.chartType) {
            console.log('Changing chart type:', result.data.chartType);
            onChartTypeChange(result.data.chartType);
            toast({
              title: "Chart Type Changed",
              description: result.message,
            });
          }
          break;
        case 'error':
          console.warn('Voice command error:', result.message);
          toast({
            title: "Voice Command Error",
            description: result.message,
            variant: "destructive"
          });
          break;
      }
    } catch (error) {
      console.error('Error processing dashboard voice command:', error);
      toast({
        title: "Command Processing Error",
        description: "Sorry, I couldn't process that dashboard command",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Dummy cart action handler since dashboard doesn't need cart functionality
  const handleCartAction = (action: CartAction) => {
    console.log('Cart action ignored in dashboard:', action);
  };

  return (
    <div className="mb-6">
      <VoiceControl
        drinks={drinks}
        onAddToCart={handleCartAction}
        onVoiceCommand={handleVoiceCommand}
      />
      {lastCommand && (
        <VoiceFeedback
          message={lastCommand.message}
          isPlaying={!isProcessing}
          voice="alloy"
        />
      )}
    </div>
  );
}
