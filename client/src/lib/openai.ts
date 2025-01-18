import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

export async function getOpenAIClient(): Promise<OpenAI> {
  if (openai) {
    // If we already have an instance, return it
    return openai;
  }

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

    // Create the OpenAI client
    openai = new OpenAI({
      apiKey: data.openaiKey,
      dangerouslyAllowBrowser: true
    });

    // Test the client with a simple request
    const testResponse = await openai.chat.completions.create({
      model: "gpt-4o", // Do not change unless explicitly requested
      messages: [{ role: "system", content: "Test connection" }],
      max_tokens: 5
    });

    console.log('OpenAI client initialized and tested successfully:', testResponse);

    // Return the client now that we've confirmed it's working
    return openai;
  } catch (error: any) {
    console.error('OpenAI client initialization failed:', error);
    // Reset the client to allow a future retry
    openai = null;
    throw new Error(error.message || 'Failed to initialize OpenAI client');
  }
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

export type Intent =
  | (OrderIntent | IncompleteOrderIntent | QueryIntent | GreetingIntent | CompleteTransactionIntent | ShutdownIntent | CancelIntent)
  & BaseIntent;

import { conversationState } from "./conversation-state";

// Store conversation history with improved context management
const MAX_HISTORY_LENGTH = 6; // Keep last 6 messages
let conversationHistory: Array<{ role: string; content: string }> = [];

export async function processVoiceCommand(text: string): Promise<Intent> {
  try {
    // Get OpenAI client
    const client = await getOpenAIClient().catch(error => {
      console.error('Failed to initialize OpenAI client:', error);
      throw new Error('OpenAI client initialization failed');
    });

    console.log('Processing voice command:', text);

    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Empty voice command received');
    }

    // Maintain conversation history with context
    if (conversationHistory.length > MAX_HISTORY_LENGTH) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
    }

    // Get relevant context from conversation state
    const relevantContext = conversationState.getRelevantContext();

    // Add context and user's message to history
    if (relevantContext) {
      conversationHistory.push({
        role: "system",
        content: `Previous context: ${relevantContext}`
      });
    }

    conversationHistory.push({ role: "user", content: text });

    console.log('Processing command with context:', {
      text,
      relevantContext,
      historyLength: conversationHistory.length
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a knowledgeable and helpful AI bartender. Your tasks:
          1. Remember context from previous exchanges
          2. Parse drink orders and queries accurately with exact quantities
          3. Answer questions about drinks and menu items
          4. Maintain conversation flow
          5. Format responses as JSON

          Important: Always parse exact quantities from user input. Default to 1 only when no quantity is specified.

          Response types:
          - "order": Complete orders
          - "incomplete_order": Missing info
          - "query": Questions about menu/drinks
          - "greeting": Quick greetings
          - "complete_transaction": For finishing orders
          - "shutdown": Turn off voice commands
          - "cancel": Cancel current operation
          `
        },
        { role: "user", content: text }
      ],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    console.log('OpenAI response:', response.choices[0]?.message?.content);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    const parsed = JSON.parse(content);

    // Validate response format
    if (!parsed.type || !parsed.conversational_response) {
      console.error('Invalid response format:', parsed);
      throw new Error("Invalid response format from OpenAI");
    }

    if (parsed.type === 'order' && (!Array.isArray(parsed.items) || parsed.items.length === 0)) {
      console.error('Invalid order format:', parsed);
      throw new Error("Invalid order format from OpenAI");
    }

    // Update conversation state and history
    conversationState.updateContext(parsed, text);
    conversationHistory.push({
      role: "assistant",
      content: JSON.stringify(parsed)
    });

    return parsed;
  } catch (error: any) {
    console.error("Failed to process voice command:", error);
    console.log("Current conversation history:", conversationHistory);

    // Provide more specific error messages
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