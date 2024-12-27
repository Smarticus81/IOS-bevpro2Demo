import OpenAI from "openai";
import { recommendationService } from './recommendation-service';
import { conversationState } from "./conversation-state";

// Browser-safe base64 encoding/decoding
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  if (!openai) {
    try {
      console.log('Initializing OpenAI client...');
      const response = await fetch('/api/config');

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Config API error:', response.status, errorText);
        throw new Error(`Config API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.openaiKey) {
        console.error('OpenAI API key missing from server response');
        throw new Error('OpenAI API key not configured');
      }

      openai = new OpenAI({
        apiKey: data.openaiKey,
        dangerouslyAllowBrowser: true
      });

      // Test the client with a simple request
      await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Test connection" }],
        max_tokens: 5,
        response_format: { type: "json_object" }
      });

      console.log('OpenAI client initialized and tested successfully');
      return openai;
    } catch (error: any) {
      console.error('OpenAI client initialization failed:', error);
      openai = null; // Reset the client on failure
      throw new Error(error.message || 'Failed to initialize OpenAI client');
    }
  }
  return openai;
}

interface OrderIntent {
  type: "order";
  items: Array<{
    name: string;
    quantity: number;
  }>;
  conversational_response: string;
}

interface IncompleteOrderIntent {
  type: "incomplete_order";
  missing: "drink_type" | "quantity";
  quantity?: number;
  drink_type?: string;
  conversational_response: string;
}

interface QueryIntent {
  type: "query";
  category?: string;
  attribute?: string;
  conversational_response: string;
}

interface GreetingIntent {
  type: "greeting";
  conversational_response: string;
}

interface CompleteTransactionIntent {
  type: "complete_transaction";
  total?: number;
  conversational_response: string;
}

interface ShutdownIntent {
  type: "shutdown";
  conversational_response: string;
}

interface CancelIntent {
  type: "cancel";
  conversational_response: string;
}

export interface BaseIntent {
  sentiment: 'positive' | 'negative' | 'neutral';
  conversational_response: string;
}

export interface RecommendationIntent extends BaseIntent {
  type: "recommendation";
  category?: string;
  preferences?: string[];
  context?: string;
}

export type Intent = (OrderIntent | IncompleteOrderIntent | QueryIntent | GreetingIntent | CompleteTransactionIntent | ShutdownIntent | CancelIntent | RecommendationIntent) & BaseIntent;

// Store conversation history with improved context management
const MAX_HISTORY_LENGTH = 6;
let conversationHistory: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

export async function processVoiceCommand(text: string, sessionId: string): Promise<Intent> {
  try {
    const client = await getOpenAIClient();

    if (!text || text.trim().length === 0) {
      throw new Error('Empty voice command received');
    }

    // Maintain conversation history with context
    if (conversationHistory.length > MAX_HISTORY_LENGTH) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
    }

    // Get relevant context from conversation state
    const relevantContext = conversationState.getRelevantContext();

    // Get personalized recommendations if needed
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
          drink: item.drink,
          quantity: item.quantity
        })) || []
      });

      if (recommendations.length > 0) {
        recommendationContext = await recommendationService.generateRecommendationResponse(recommendations);
      }
    }

    const systemMessage = {
      role: "system" as const,
      content: `You are a knowledgeable and helpful AI bartender with emotional intelligence and agentic capabilities.
      You should be proactive in offering recommendations and assistance.
      Your voice should be pleasant, upbeat, and feminine.
      Use natural, conversational language while maintaining professionalism.

      Response types:
      - "order": Complete orders with suggestions
      - "incomplete_order": Ask clarifying questions
      - "query": Answer questions about drinks
      - "recommendation": Provide personalized recommendations
      - "greeting": Friendly welcome with context-aware suggestions
      - "complete_transaction": Process order with final recommendations
      - "shutdown": Turn off voice commands
      - "cancel": Cancel current operation

      Always maintain a helpful, proactive, and friendly tone.
      Always include a sentiment field in the response.`
    };

    // Build messages array with proper typing
    const messages = [systemMessage];

    if (relevantContext) {
      messages.push({ 
        role: "system" as const, 
        content: `Previous context: ${relevantContext}`
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

    if (error.message.includes('fetch')) {
      throw new Error("Could not connect to the AI service. Please try again.");
    } else if (error.message.includes('JSON')) {
      console.error('Raw response:', error.response?.data);
      throw new Error("The AI service returned an invalid response. Please try again.");
    } else if (error.message.includes('format')) {
      throw new Error("Sorry, I couldn't understand that. Could you rephrase?");
    } else {
      throw new Error("Sorry, I couldn't process that request. Please try again.");
    }
  }
}

//  Added a dummy function since the edited code references it and it's not in the original
function convertToFullDrink(drink: string): string {
  return drink; // Replace with actual implementation if available.
}