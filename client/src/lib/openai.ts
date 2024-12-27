import OpenAI from "openai";
import { recommendationService } from './recommendation-service';
import { conversationState } from "./conversation-state";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  if (!openai) {
    try {
      const response = await fetch('/api/config');

      if (!response.ok) {
        throw new Error(`Config API returned ${response.status}`);
      }

      const data = await response.json();
      if (!data.openaiKey) {
        throw new Error('OpenAI API key not configured');
      }

      openai = new OpenAI({
        apiKey: data.openaiKey,
        dangerouslyAllowBrowser: true
      });

      return openai;
    } catch (error: any) {
      console.error('OpenAI client initialization failed:', error);
      openai = null;
      throw error;
    }
  }
  return openai;
}

export interface BaseIntent {
  sentiment: 'positive' | 'negative' | 'neutral';
  conversational_response: string;
}

export interface OrderIntent extends BaseIntent {
  type: "order";
  items: Array<{
    name: string;
    quantity: number;
  }>;
}

export interface IncompleteOrderIntent extends BaseIntent {
  type: "incomplete_order";
  missing: "drink_type" | "quantity";
  quantity?: number;
  drink_type?: string;
}

export interface QueryIntent extends BaseIntent {
  type: "query";
  category?: string;
  attribute?: string;
}

export interface GreetingIntent extends BaseIntent {
  type: "greeting";
}

export interface CompleteTransactionIntent extends BaseIntent {
  type: "complete_transaction";
  total?: number;
}

export interface ShutdownIntent extends BaseIntent {
  type: "shutdown";
}

export interface CancelIntent extends BaseIntent {
  type: "cancel";
}

export interface RecommendationIntent extends BaseIntent {
  type: "recommendation";
  category?: string;
  preferences?: string[];
  context?: string;
}

export type Intent = OrderIntent | IncompleteOrderIntent | QueryIntent | GreetingIntent |
                     CompleteTransactionIntent | ShutdownIntent | CancelIntent | RecommendationIntent;

const MAX_HISTORY_LENGTH = 6;
let conversationHistory: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

export async function processVoiceCommand(text: string, sessionId: string): Promise<Intent> {
  try {
    const client = await getOpenAIClient();

    if (!text?.trim()) {
      throw new Error('Empty voice command received');
    }

    // Maintain conversation history
    if (conversationHistory.length > MAX_HISTORY_LENGTH) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
    }

    // Get relevant context
    const relevantContext = conversationState.getRelevantContext();

    // Get recommendations if needed
    let recommendationContext = null;
    if (text.toLowerCase().includes('recommend') || text.toLowerCase().includes('suggestion')) {
      const currentTime = new Date().getHours();
      const timeOfDay = currentTime < 12 ? 'morning' : currentTime < 17 ? 'afternoon' : 'evening';
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

      const recommendations = await recommendationService.getRecommendations({
        timeOfDay,
        dayOfWeek,
        sessionId,
        currentOrder: conversationState.getCurrentOrder()?.map(item => ({
          drink: {
            ...item.drink,
            popular_pairings: null,
            peak_hours: null,
            taste_profile: null,
            dietary_info: null,
            seasonal_availability: null,
            last_recommended: null,
            recommendation_score: 0
          },
          quantity: item.quantity
        }))
      });

      if (recommendations.length > 0) {
        recommendationContext = await recommendationService.generateRecommendationResponse(recommendations);
      }
    }

    const messages = [
      {
        role: "system" as const,
        content: `You are an intelligent AI bartender with emotional intelligence and agentic capabilities.
        Be proactive in offering recommendations and assistance.
        Use natural, pleasant, upbeat, and feminine voice while maintaining professionalism.

        Response format must be JSON with these fields:
        - type: order | incomplete_order | query | recommendation | greeting | complete_transaction | shutdown | cancel
        - sentiment: positive | negative | neutral
        - conversational_response: string
        - Additional fields based on type (items for orders, etc.)

        Always maintain a helpful, proactive, and friendly tone.`
      }
    ];

    if (relevantContext) {
      messages.push({ 
        role: "system" as const, 
        content: `Current context: ${relevantContext}`
      });
    }

    if (recommendationContext) {
      messages.push({
        role: "system" as const,
        content: `Recommendation context: ${recommendationContext}`
      });
    }

    messages.push({ role: "user" as const, content: text });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    const parsed = JSON.parse(content);

    // Update conversation state and history
    conversationState.updateContext(parsed, text);
    conversationHistory.push({ 
      role: "assistant" as const, 
      content: content
    });

    return parsed;
  } catch (error: any) {
    console.error("Failed to process voice command:", error);
    throw new Error(error.message || "Failed to process voice command");
  }
}