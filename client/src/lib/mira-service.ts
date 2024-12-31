import OpenAI from 'openai';
import { logger } from './logger';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

interface MiraResponse {
  reply: string;
  action?: {
    type: 'update_inventory' | 'generate_report' | 'alert';
    payload: any;
  };
}

class MiraService {
  private static instance: MiraService;
  private context: string = '';

  private constructor() {}

  static getInstance(): MiraService {
    if (!MiraService.instance) {
      MiraService.instance = new MiraService();
    }
    return MiraService.instance;
  }

  private async getSystemPrompt(inventoryContext: string): Promise<string> {
    return `You are Mira, an intelligent inventory management assistant for a beverage point of sale system.
Current inventory context:
${inventoryContext}

Guidelines:
1. Provide concise, actionable responses
2. For inventory updates, include specific quantities and item IDs
3. Proactively identify potential stock issues
4. Format numbers consistently
5. Use a professional but friendly tone

Your capabilities:
- View current inventory levels
- Update stock quantities
- Generate inventory reports
- Set up alerts for low stock
- Analyze sales patterns
- Make restocking recommendations

Please structure your responses to be clear and actionable.`;
  }

  async processMessage(
    message: string,
    inventoryContext: string
  ): Promise<MiraResponse> {
    try {
      const systemPrompt = await this.getSystemPrompt(inventoryContext);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);

      // Log the interaction
      logger.info('Mira Interaction:', {
        user_message: message,
        response: result
      });

      return {
        reply: result.response,
        action: result.action
      };

    } catch (error) {
      logger.error('Mira service error:', error);
      throw error;
    }
  }

  async generateInventoryReport(inventory: any[]): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Generate a concise inventory status report highlighting critical items, trends, and recommendations. Focus on actionable insights."
          },
          {
            role: "user",
            content: `Current inventory data: ${JSON.stringify(inventory)}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result.report;

    } catch (error) {
      logger.error('Report generation error:', error);
      throw error;
    }
  }

  setContext(context: string) {
    this.context = context;
  }

  getContext(): string {
    return this.context;
  }
}

export const miraService = MiraService.getInstance();
