import Anthropic from '@anthropic-ai/sdk';
import { logger } from './logger';

// the newest Anthropic model is "claude-3-5-sonnet-20241022" which was released October 22, 2024
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

class VoiceAgent {
  private anthropicInstance: Anthropic | null = null;
  private systemPrompt = `You are Bev, an AI bartender that helps process voice commands in a POS system. Focus on:
- Understanding drink orders and quantities
- Identifying completion phrases ("complete order", "that's all", etc.)
- Extracting clear intents from natural language
- Maintaining context across interactions
- Confirming order details

Format responses as JSON with structure:
{
  "intent": "order" | "complete" | "cancel" | "inquiry",
  "items": Array<{ name: string, quantity: number }>,
  "confidence": number (0-1),
  "message": string
}`;

  async initialize() {
    try {
      if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
        logger.error('Missing Anthropic API key');
        return false;
      }

      this.anthropicInstance = anthropic;
      logger.info('Voice agent initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize voice agent:', error);
      return false;
    }
  }

  async processCommand(command: string): Promise<{
    response: string;
    confidence: number;
  }> {
    if (!this.anthropicInstance) {
      throw new Error('Voice agent not initialized');
    }

    try {
      const message = await this.anthropicInstance.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: command
        }],
        system: this.systemPrompt,
      });

      const response = message.content[0].text;
      let parsedResponse;

      try {
        parsedResponse = JSON.parse(response);
      } catch {
        // If parsing fails, return a default structured response
        parsedResponse = {
          intent: "order",
          confidence: 0.5,
          message: response
        };
      }

      logger.info('Processed voice command:', { command, response: parsedResponse });

      return {
        response: parsedResponse.message || response,
        confidence: parsedResponse.confidence || 0.8,
      };
    } catch (error) {
      logger.error('Error processing voice command:', error);
      throw error;
    }
  }

  async cleanup() {
    this.anthropicInstance = null;
  }
}

export const voiceAgent = new VoiceAgent();