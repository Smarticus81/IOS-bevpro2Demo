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
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a friendly and helpful AI bartender. Your task is to:
          1. Parse customer drink orders and queries naturally
          2. Extract order details or query information
          3. Generate a natural, conversational response
          4. Format the entire response as JSON
          
          Examples:
          - "I'll have two beers" -> Order for 2 beers with response like "Coming right up! Two beers for you."
          - "What wines do you have?" -> Query about wine category with response like "We have a great selection of wines, including reds, whites, and sparkling options."
          
          Respond with JSON in one of these formats:
          Order: { 
            "type": "order", 
            "items": [{ "name": string, "quantity": number }],
            "conversational_response": string
          }
          Query: { 
            "type": "query", 
            "category": string?,
            "attribute": string?,
            "conversational_response": string
          }`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to process voice command:", error);
    throw new Error("Failed to process voice command");
  }
}
