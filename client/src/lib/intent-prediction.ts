import { getOpenAIClient } from "./openai";
import type { Intent } from "./openai";

// Parse YAML-like intents file
function parseIntents(content: string): {
  intents: Record<string, string[]>,
  slots: Record<string, string[]>
} {
  const lines = content.split('\n');
  let currentSection: 'intents' | 'slots' | null = null;
  let currentIntent: string | null = null;
  const intents: Record<string, string[]> = {};
  const slots: Record<string, string[]> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine === 'intents:') {
      currentSection = 'intents';
      continue;
    } else if (trimmedLine === 'slots:') {
      currentSection = 'slots';
      continue;
    }

    if (currentSection === 'intents') {
      if (trimmedLine.endsWith(':')) {
        currentIntent = trimmedLine.slice(0, -1).trim();
        intents[currentIntent] = [];
      } else if (currentIntent && trimmedLine.startsWith('-')) {
        intents[currentIntent].push(trimmedLine.slice(1).trim());
      }
    } else if (currentSection === 'slots') {
      if (trimmedLine.endsWith(':')) {
        const slotName = trimmedLine.slice(0, -1).trim();
        slots[slotName] = [];
      } else if (trimmedLine.startsWith('-')) {
        const lastSlot = Object.keys(slots).pop();
        if (lastSlot) {
          slots[lastSlot].push(trimmedLine.slice(1).trim());
        }
      }
    }
  }

  return { intents, slots };
}

export class IntentPredictor {
  private static instance: IntentPredictor;
  private intents: Record<string, string[]> = {};
  private slots: Record<string, string[]> = {};
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): IntentPredictor {
    if (!IntentPredictor.instance) {
      IntentPredictor.instance = new IntentPredictor();
    }
    return IntentPredictor.instance;
  }

  async initialize(intentsContent: string) {
    if (this.initialized) return;

    try {
      console.log('Initializing intent predictor with provided intents');
      const { intents, slots } = parseIntents(intentsContent);
      this.intents = intents;
      this.slots = slots;
      this.initialized = true;
      console.log('Intent predictor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize intent predictor:', error);
      throw new Error('Intent predictor initialization failed');
    }
  }

  async predictIntent(text: string): Promise<Intent> {
    if (!this.initialized) {
      throw new Error('Intent predictor not initialized');
    }

    try {
      const openai = await getOpenAIClient();

      // Create a comprehensive prompt using our intent patterns
      const prompt = `Given the following user input: "${text}"

Analyze it based on these intent patterns:
${Object.entries(this.intents)
  .map(([intent, patterns]) => `${intent}:\n${patterns.map(p => `- ${p}`).join('\n')}`)
  .join('\n\n')}

And these slot values:
${Object.entries(this.slots)
  .map(([slot, values]) => `${slot}:\n${values.slice(0, 5).map(v => `- ${v}`).join('\n')}...`)
  .join('\n\n')}

Predict the most likely intent and extract any relevant slots. Format the response as JSON with the following structure for different cases:

For orders:
{
  "type": "order",
  "items": [{"name": string, "quantity": number}],
  "conversational_response": string
}

For incomplete orders:
{
  "type": "incomplete_order",
  "missing": "drink_type" | "quantity",
  "quantity": number | undefined,
  "drink_type": string | undefined,
  "conversational_response": string
}

For queries:
{
  "type": "query",
  "category": string | undefined,
  "attribute": string | undefined,
  "conversational_response": string
}

For greetings:
{
  "type": "greeting",
  "conversational_response": string
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text }
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response content from OpenAI");
      }

      const parsed = JSON.parse(content) as Intent;
      
      // Validate response format
      if (!parsed.type || !parsed.conversational_response) {
        throw new Error("Invalid response format from OpenAI");
      }

      return parsed;
    } catch (error: any) {
      console.error('Intent prediction failed:', error);
      throw new Error(`Intent prediction failed: ${error.message}`);
    }
  }
}

export const intentPredictor = IntentPredictor.getInstance();
