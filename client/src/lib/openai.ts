import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
let openai: OpenAI | null = null;

async function getOpenAIClient() {
  if (!openai) {
    const response = await fetch('/api/config');
    const { openaiKey } = await response.json();
    if (!openaiKey) {
      throw new Error('OpenAI API key not available');
    }
    openai = new OpenAI({ apiKey: openaiKey });
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

interface QueryIntent {
  type: "query";
  category?: string;
  attribute?: string;
  conversational_response: string;
}

type Intent = OrderIntent | QueryIntent;

export async function processVoiceCommand(text: string): Promise<Intent> {
  try {
    const client = await getOpenAIClient();
    console.log('Processing voice command:', text);
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a friendly and helpful AI bartender assistant. Your task is to:
          1. Parse customer drink orders and queries naturally
          2. Extract order details or query information
          3. Generate a natural, conversational response
          4. Format the entire response as JSON
          
          Always respond with "Sorry, I didn't catch that" for unclear requests.
          
          Examples:
          User: "I'll have two beers"
          Response: {
            "type": "order",
            "items": [{"name": "beer", "quantity": 2}],
            "conversational_response": "Coming right up! Two beers for you."
          }
          
          User: "What wines do you have?"
          Response: {
            "type": "query",
            "category": "Wine",
            "conversational_response": "We have a great selection of wines, including reds, whites, and sparkling options."
          }
          
          User: "unclear mumbling"
          Response: {
            "type": "query",
            "conversational_response": "Sorry, I didn't catch that. Could you please repeat?"
          }`
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.7,
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

    return parsed;
  } catch (error: any) {
    console.error("Failed to process voice command:", error);
    
    // Provide more specific error messages
    if (error.message.includes('fetch')) {
      throw new Error("Failed to connect to OpenAI API");
    } else if (error.message.includes('JSON')) {
      throw new Error("Failed to parse OpenAI response");
    } else {
      throw new Error(`Voice command processing failed: ${error.message}`);
    }
  }
}
