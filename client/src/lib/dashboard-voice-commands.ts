import { processVoiceCommand } from './openai';
import type { Intent } from './openai';

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
    console.log('Processing dashboard voice command:', text);
    const intent = await processVoiceCommand(text);
    
    console.log('Received intent:', intent);

    // Process dashboard-specific commands
    if (intent.type === 'query') {
      if (intent.category) {
        return {
          type: 'filter',
          data: { category: intent.category },
          message: `Filtering by ${intent.category}`
        };
      } else if (intent.attribute === 'time') {
        // Look for time-related queries
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
      }
    }

    // Handle chart type changes
    if (text.toLowerCase().includes('chart') || text.toLowerCase().includes('view')) {
      const chartTypes = {
        bar: text.toLowerCase().includes('bar'),
        line: text.toLowerCase().includes('line') || text.toLowerCase().includes('trend'),
        pie: text.toLowerCase().includes('pie') || text.toLowerCase().includes('distribution')
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

    // If we have a conversational response but no specific command matched
    if (intent.conversational_response) {
      return {
        type: 'error',
        data: {},
        message: intent.conversational_response
      };
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
