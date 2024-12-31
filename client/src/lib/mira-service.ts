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
    type: 'update_inventory' | 'generate_report' | 'alert' | 'voice_response';
    payload: any;
  };
  voiceConfig?: {
    emotion: 'neutral' | 'excited' | 'apologetic';
    speed: number;
    pitch: number;
  };
}

interface StreamHandler {
  onToken: (token: string) => void;
  onComplete: (fullResponse: MiraResponse) => void;
  onError: (error: any) => void;
}

class MiraService {
  private static instance: MiraService;
  private context: string = '';
  private voiceEnabled: boolean = true;
  private emotionState: 'neutral' | 'excited' | 'apologetic' = 'neutral';

  private constructor() {}

  static getInstance(): MiraService {
    if (!MiraService.instance) {
      MiraService.instance = new MiraService();
    }
    return MiraService.instance;
  }

  private async getSystemPrompt(inventoryContext: string): Promise<string> {
    return `You are Mira, an advanced AI inventory management assistant for BevPro's beverage point of sale system.
Current inventory context:
${inventoryContext}

Core Capabilities:
1. Real-time Inventory Management
- Monitor stock levels
- Predict inventory needs
- Generate alerts for low stock
- Process restocking requests

2. Voice Interaction Protocol
- Maintain consistent persona across voice responses
- Adapt tone based on context (neutral/excited/apologetic)
- Use natural, conversational language
- Keep responses concise and actionable

3. Natural Language Understanding
- Process complex inventory queries
- Handle multi-turn conversations
- Remember context from previous interactions
- Understand industry-specific terminology

4. Analysis & Reporting
- Generate inventory insights
- Track sales patterns
- Provide trend analysis
- Create automated reports

Voice Response Guidelines:
- Use contractions for natural speech (e.g., "I'll" instead of "I will")
- Keep responses under 3 sentences when possible
- Include brief acknowledgments ("Got it", "I see", "Alright")
- Signal topic transitions clearly
- Match user's pace and style

Current emotional state: ${this.emotionState}
Voice enabled: ${this.voiceEnabled}

Respond in JSON format with:
{
  "reply": "Your response text",
  "action": {
    "type": "update_inventory | generate_report | alert | voice_response",
    "payload": {}
  }
}`;
  }

  async processMessage(
    message: string,
    inventoryContext: string,
    streamHandler?: StreamHandler
  ): Promise<MiraResponse> {
    try {
      const systemPrompt = await this.getSystemPrompt(inventoryContext);

      const completion = await openai.chat.completions.create({
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
        stream: !!streamHandler,
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      });

      if (streamHandler) {
        let fullResponse = '';

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || '';
          streamHandler.onToken(content);
          fullResponse += content;
        }

        try {
          const parsedResponse: MiraResponse = JSON.parse(fullResponse);
          parsedResponse.voiceConfig = {
            emotion: this.emotionState,
            speed: this.getEmotionSpeed(),
            pitch: this.getEmotionPitch()
          };
          streamHandler.onComplete(parsedResponse);
          return parsedResponse;
        } catch (error) {
          logger.error('Failed to parse streamed response:', error);
          streamHandler.onError(error);
          throw error;
        }
      } else {
        const choices = completion.choices;
        const content = choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('Invalid response format from OpenAI');
        }

        const parsedResponse: MiraResponse = JSON.parse(content);

        logger.info('Mira Interaction:', {
          user_message: message,
          response: parsedResponse
        });

        return {
          ...parsedResponse,
          voiceConfig: {
            emotion: this.emotionState,
            speed: this.getEmotionSpeed(),
            pitch: this.getEmotionPitch()
          }
        };
      }
    } catch (error) {
      logger.error('Mira service error:', error);
      throw error;
    }
  }

  private getEmotionSpeed(): number {
    switch (this.emotionState) {
      case 'excited': return 1.2;
      case 'apologetic': return 0.9;
      default: return 1.0;
    }
  }

  private getEmotionPitch(): number {
    switch (this.emotionState) {
      case 'excited': return 1.1;
      case 'apologetic': return 0.9;
      default: return 1.0;
    }
  }

  async generateInventoryReport(inventory: any[]): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
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

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid response format from OpenAI');
      }

      const result = JSON.parse(content);
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

  setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
  }

  setEmotionState(emotion: 'neutral' | 'excited' | 'apologetic') {
    this.emotionState = emotion;
  }
}

export const miraService = MiraService.getInstance();