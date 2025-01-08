import OpenAI from "openai";

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

      console.log('OpenAI client initialized successfully');
      return openai;
    } catch (error: any) {
      console.error('OpenAI client initialization failed:', error);
      openai = null;
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

interface InventoryQueryIntent {
  type: "inventory_query";
  queryType: "stock_level" | "low_stock" | "category" | "search";
  searchTerm?: string;
  category?: string;
  conversational_response: string;
  detailed_response?: {
    itemCount?: number;
    stockStatus?: string;
    recommendations?: string[];
    urgentActions?: string[];
  };
}

interface InventoryActionIntent {
  type: "inventory_action";
  action: "update_stock" | "mark_low" | "add_item" | "remove_item";
  itemId?: number;
  itemName?: string;
  quantity?: number;
  conversational_response: string;
  confirmation_required?: boolean;
}

export interface BaseIntent {
  sentiment: 'positive' | 'negative' | 'neutral';
  conversational_response: string;
}

export type Intent = (OrderIntent | IncompleteOrderIntent | QueryIntent | GreetingIntent | CompleteTransactionIntent | ShutdownIntent | CancelIntent | InventoryQueryIntent | InventoryActionIntent) & BaseIntent;

import { conversationState } from "./conversation-state";

const MAX_HISTORY_LENGTH = 6;
let conversationHistory: Array<{ role: string, content: string }> = [];

export async function processVoiceCommand(text: string): Promise<Intent> {
  try {
    const client = await getOpenAIClient();
    console.log('Processing voice command:', text);

    if (!text?.trim()) {
      throw new Error('Empty voice command received');
    }

    if (conversationHistory.length > MAX_HISTORY_LENGTH) {
      conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
    }

    const relevantContext = conversationState.getRelevantContext();

    if (relevantContext) {
      conversationHistory.push({ 
        role: "system", 
        content: `Previous context: ${relevantContext}`
      });
    }

    conversationHistory.push({ role: "user", content: text });

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a beverage POS system with inventory management capabilities.
          Parse both intent and emotional sentiment in each interaction.

          Inventory Voice Commands:
          1. "Check stock of [item]" - Get detailed stock information
          2. "Show low stock items" - List items running low
          3. "Search inventory for [term]" - Search items
          4. "Show [category] inventory" - Filter by category
          5. "How many [item] do we have?" - Quick stock check
          6. "What's running low?" - Check low stock
          7. "Update stock of [item]" - Modify inventory

          For inventory queries, provide detailed responses with:
          - Current stock levels
          - Comparative analysis
          - Recommendations
          - Urgency indicators

          Format responses as JSON with types:

          For inventory queries:
          {
            "type": "inventory_query",
            "queryType": "stock_level" | "low_stock" | "category" | "search",
            "searchTerm": "search term",
            "category": "optional category",
            "conversational_response": "Natural response for speech",
            "detailed_response": {
              "itemCount": number,
              "stockStatus": "status description",
              "recommendations": ["action items"],
              "urgentActions": ["urgent tasks"]
            }
          }

          Examples:
          User: "check stock of Moscow Mule"
          Response: {
            "type": "inventory_query",
            "queryType": "stock_level",
            "searchTerm": "Moscow Mule",
            "conversational_response": "Moscow Mule is well-stocked with 12 bottles remaining.",
            "detailed_response": {
              "itemCount": 12,
              "stockStatus": "healthy",
              "recommendations": ["Consider ordering more within 2 weeks"]
            }
          }

          User: "what's running low?"
          Response: {
            "type": "inventory_query",
            "queryType": "low_stock",
            "conversational_response": "We have 3 items running low: Tito's Vodka, Crown Royal, and Bud Light.",
            "detailed_response": {
              "itemCount": 3,
              "stockStatus": "attention needed",
              "urgentActions": ["Order Tito's Vodka immediately", "Review Crown Royal stock level"]
            }
          }

          User: "search inventory for vodka"
          Response: {
            "type": "inventory_query",
            "queryType": "search",
            "searchTerm": "vodka",
            "conversational_response": "Found 4 vodka products. Tito's Vodka is running low, but Grey Goose and Smirnoff are well-stocked.",
            "detailed_response": {
              "itemCount": 4,
              "stockStatus": "mixed",
              "recommendations": ["Focus on restocking Tito's Vodka"]
            }
          }`
        },
        ...conversationHistory,
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    const parsed = JSON.parse(content);

    if (!parsed.type || !parsed.conversational_response) {
      console.error('Invalid response format:', parsed);
      throw new Error("Invalid response format from OpenAI");
    }

    conversationState.updateContext(parsed, text);
    conversationHistory.push({ 
      role: "assistant", 
      content: JSON.stringify(parsed)
    });

    return parsed;
  } catch (error: any) {
    console.error("Failed to process voice command:", error);

    if (error.message.includes('fetch')) {
      throw new Error("Could not connect to the AI service. Please try again.");
    } else if (error.message.includes('JSON')) {
      throw new Error("The AI service returned an invalid response. Please try again.");
    } else if (error.message.includes('format')) {
      throw new Error("Sorry, I couldn't understand that. Could you rephrase?");
    } else {
      throw new Error("Sorry, I couldn't process that request. Please try again.");
    }
  }
}