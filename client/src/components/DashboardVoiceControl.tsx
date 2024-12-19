import { useState, useEffect } from 'react';
import { processDashboardCommand, type DashboardCommandResult } from '@/lib/dashboard-voice-commands';
import { VoiceControl } from './VoiceControl';
import { VoiceFeedback } from './VoiceFeedback';
import { toast } from '@/components/ui/use-toast';
import type { Drink } from '@db/schema';

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

  const handleVoiceCommand = async (text: string) => {
    try {
      setIsProcessing(true);
      const result = await processDashboardCommand(text);
      setLastCommand(result);

      switch (result.type) {
        case 'filter':
          onFilterChange({ category: result.data.category });
          break;
        case 'timeRange':
          if (result.data.timeRange) {
            onTimeRangeChange(result.data.timeRange);
          }
          break;
        case 'chart':
          if (result.data.chartType) {
            onChartTypeChange(result.data.chartType);
          }
          break;
        case 'error':
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

  return (
    <div className="mb-6">
      <VoiceControl
        drinks={drinks}
        onAddToCart={() => {}} // Dashboard doesn't need cart functionality
      />
      {lastCommand && (
        <VoiceFeedback
          message={lastCommand.message}
          isPlaying={true}
          voice="alloy"
        />
      )}
    </div>
  );
}
