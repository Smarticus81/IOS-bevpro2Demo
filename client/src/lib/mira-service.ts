import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
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

  private constructor() {
    logger.info('Initializing Mira service with Anthropic configuration:', {
      apiKeyExists: !!import.meta.env.VITE_ANTHROPIC_API_KEY,
      model: "claude-3-5-sonnet-20241022"
    });
  }

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

      const messageResponse = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
        stream: !!streamHandler
      });

      if (streamHandler) {
        let fullResponse = '';

        // Type assertion for streaming response
        const stream = messageResponse as AsyncIterable<Anthropic.MessageStreamEvent>;

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') {
            const content = chunk.delta.text || '';
            streamHandler.onToken(content);
            fullResponse += content;
          }
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
        // Non-streaming response
        const content = (messageResponse as Anthropic.Message).content[0]?.text;

        if (!content) {
          throw new Error('Invalid response format from Anthropic');
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
      const response = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: "Generate a concise inventory status report highlighting critical items, trends, and recommendations. Focus on actionable insights.",
        messages: [
          { 
            role: "user", 
            content: `Current inventory data: ${JSON.stringify(inventory)}`
          }
        ]
      });

      const content = response.content[0]?.text;
      if (!content) {
        throw new Error('Invalid response format from Anthropic');
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