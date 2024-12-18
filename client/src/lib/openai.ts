import OpenAI from "openai";

import { intentPredictor } from "./intent-prediction";
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
      const testResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: "Test connection" }],
        max_tokens: 5
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

export type Intent = OrderIntent | IncompleteOrderIntent | QueryIntent | GreetingIntent;

import { conversationState } from "./conversation-state";

// Store conversation history with improved context management
const MAX_HISTORY_LENGTH = 6; // Keep last 3 exchanges
let conversationHistory: Array<{ role: string, content: string }> = [];

// Placeholder for the intent predictor.  Replace with actual implementation.
const intentPredictor = {
  async predictIntent(text: string): Promise<Intent> {
    // Replace this with your actual intent prediction logic.
    // This is a dummy implementation for demonstration purposes.
    if (text.toLowerCase().includes("beer")) {
      return {
        type: "order",
        items: [{ name: "beer", quantity: 1 }],
        conversational_response: "One beer coming right up!"
      };
    } else if (text.toLowerCase().includes("wine")) {
      return {
        type: "query",
        category: "Wine",
        conversational_response: "We have a nice selection of reds and whites."
      };
    } else {
      return {
        type: "greeting",
        conversational_response: "Hello there! What can I get for you?"
      };
    }
  }
};


export async function processVoiceCommand(text: string): Promise<Intent> {
  try {
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

    // Use the intent predictor for more accurate intent classification
    const intent = await intentPredictor.predictIntent(text);
    console.log('Predicted intent:', intent);

    // Update conversation state and history
    conversationState.updateContext(intent, text);
    conversationHistory.push({ 
      role: "assistant", 
      content: JSON.stringify(intent)
    });
    
    return intent;
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