import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OpenAI API key is required. Please set VITE_OPENAI_API_KEY environment variable.');
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface OrderIntent {
  type: "order";
  items: Array<{
    name: string;
    quantity: number;
  }>;
}

interface QueryIntent {
  type: "query";
  category?: string;
  attribute?: string;
}

type Intent = OrderIntent | QueryIntent;

export async function processVoiceCommand(text: string): Promise<Intent> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a bartender's AI assistant. Parse customer drink orders and queries.
          For orders, extract drink names and quantities.
          For queries, identify the category or attribute being asked about.
          Respond with JSON in one of these formats:
          Order: { "type": "order", "items": [{ "name": string, "quantity": number }] }
          Query: { "type": "query", "category": string?, "attribute": string? }`
        },
        {
          role: "user",
          content: text
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error("Failed to process voice command:", error);
    throw new Error("Failed to process voice command");
  }
}
