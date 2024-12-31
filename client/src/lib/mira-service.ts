import { logger } from './logger';

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
  // Use the current hostname/host for the Rasa endpoint
  private rasaEndpoint: string = `${window.location.protocol}//${window.location.hostname}:5005/webhooks/rest/webhook`;

  private constructor() {
    logger.info('Initializing Mira service with Rasa NLU');
  }

  static getInstance(): MiraService {
    if (!MiraService.instance) {
      MiraService.instance = new MiraService();
    }
    return MiraService.instance;
  }

  async processMessage(
    message: string,
    inventoryContext: string,
    streamHandler?: StreamHandler
  ): Promise<MiraResponse> {
    try {
      logger.info('Sending request to Rasa:', {
        endpoint: this.rasaEndpoint,
        message: message
      });

      const response = await fetch(this.rasaEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sender: 'user',
          metadata: {
            inventory: JSON.parse(inventoryContext)
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Rasa request failed with status ${response.status}`);
      }

      const rasaResponse = await response.json();
      logger.info('Received response from Rasa:', rasaResponse);

      // Extract the text response from Rasa
      const reply = rasaResponse[0]?.text || "I'm sorry, I couldn't process that request.";

      // Determine emotion based on response content
      this.updateEmotionState(reply);

      const miraResponse: MiraResponse = {
        reply,
        voiceConfig: {
          emotion: this.emotionState,
          speed: this.getEmotionSpeed(),
          pitch: this.getEmotionPitch()
        }
      };

      // If streaming is requested, simulate token streaming with the response
      if (streamHandler) {
        const words = reply.split(' ');
        for (const word of words) {
          streamHandler.onToken(word + ' ');
          await new Promise(resolve => setTimeout(resolve, 50)); // Add small delay between words
        }
        streamHandler.onComplete(miraResponse);
      }

      logger.info('Mira Interaction:', {
        user_message: message,
        response: miraResponse
      });

      return miraResponse;
    } catch (error) {
      logger.error('Mira service error:', error);
      throw error;
    }
  }

  private updateEmotionState(response: string) {
    // Simple emotion detection based on response content
    if (response.includes('sorry') || response.includes('apologize')) {
      this.emotionState = 'apologetic';
    } else if (response.includes('great') || response.includes('excellent')) {
      this.emotionState = 'excited';
    } else {
      this.emotionState = 'neutral';
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