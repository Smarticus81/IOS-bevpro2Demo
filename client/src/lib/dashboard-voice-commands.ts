import { processVoiceCommand } from './openai';

export interface DashboardCommandResult {
  type: 'filter' | 'timeRange' | 'chart' | 'error';
  data: {
    category?: string;
    timeRange?: 'day' | 'week' | 'month' | 'year';
    chartType?: 'bar' | 'line' | 'pie';
    filter?: Record<string, any>;
  };
  message: string;
}

export async function processDashboardCommand(text: string): Promise<DashboardCommandResult> {
  try {
    const intent = await processVoiceCommand(text);
    
    // Process dashboard-specific commands
    if (intent.type === 'query' && intent.category) {
      return {
        type: 'filter',
        data: { category: intent.category },
        message: `Filtering by ${intent.category}`
      };
    }

    // Handle time range queries
    const timeRanges = ['day', 'week', 'month', 'year'] as const;
    const timeRange = timeRanges.find(range => 
      text.toLowerCase().includes(range)
    );

    if (timeRange) {
      return {
        type: 'timeRange',
        data: { timeRange },
        message: `Showing ${timeRange} view`
      };
    }

    // Handle chart type changes
    if (text.toLowerCase().includes('chart') || text.toLowerCase().includes('view')) {
      const chartTypes = {
        bar: text.includes('bar'),
        line: text.includes('line'),
        pie: text.includes('pie')
      };

      const selectedType = Object.entries(chartTypes)
        .find(([_, matches]) => matches)?.[0] as 'bar' | 'line' | 'pie' | undefined;

      if (selectedType) {
        return {
          type: 'chart',
          data: { chartType: selectedType },
          message: `Switching to ${selectedType} chart`
        };
      }
    }

    return {
      type: 'error',
      data: {},
      message: "I couldn't understand that dashboard command. Try saying something like 'show sales trends' or 'filter by category'"
    };
  } catch (error) {
    console.error('Error processing dashboard command:', error);
    return {
      type: 'error',
      data: {},
      message: 'Sorry, I had trouble processing that dashboard command'
    };
  }
}
