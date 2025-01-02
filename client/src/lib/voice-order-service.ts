import OpenAI from "openai";
import { useQueryClient } from "@tanstack/react-query";
import fuzzysort from 'fuzzysort';

// Track response history for better context
interface ResponseHistory {
  command: string;
  intent: CommandIntent;
  confidence: number;
  timestamp: number;
  success: boolean;
  context?: {
    previousItems?: string[];
    modifiedItem?: string;
    action?: string;
  };
}

const responseHistory: ResponseHistory[] = [];
const MAX_HISTORY_LENGTH = 10;

// Enhanced intent types with clear priorities
const SYSTEM_INTENTS = ['cancel_order', 'help', 'stop'] as const;
const ORDER_INTENTS = ['add_item', 'remove_item', 'modify_item'] as const;
const MANAGEMENT_INTENTS = ['split_order', 'apply_discount', 'complete_order'] as const;

type SystemIntent = typeof SYSTEM_INTENTS[number];
type OrderIntent = typeof ORDER_INTENTS[number];
type ManagementIntent = typeof MANAGEMENT_INTENTS[number];

type CommandIntent = SystemIntent | OrderIntent | ManagementIntent;

interface OrderItem {
  name: string;
  quantity: number;
  modifiers?: string[];
  id?: string;
  price?: number;
}

interface OrderContext {
  lastOrder?: OrderItem;
  currentItems?: OrderItem[];
  lastIntent?: CommandIntent;
  emotionalTone?: 'neutral' | 'enthusiastic' | 'apologetic' | 'frustrated';
  orderTotal?: number;
  modificationTarget?: {
    itemIndex: number;
    originalQuantity: number;
  };
  discounts?: {
    type: string;
    amount: number;
  }[];
  conversationState?: {
    currentTopic?: string;
    pendingConfirmation?: boolean;
    lastMentionedItem?: string;
    needsClarification?: boolean;
    uncertaintyLevel?: number;
    referenceType?: 'previous' | 'current' | 'last';
  };
  previousCommands?: string[];
  referencedItems?: {
    item: string;
    timestamp: number;
    action: string;
  }[];
}

// Track order context for smarter responses
let orderContext: OrderContext = {
  emotionalTone: 'neutral',
  conversationState: {
    uncertaintyLevel: 0,
    pendingConfirmation: false,
    referenceType: 'current'
  },
  previousCommands: [],
  referencedItems: []
};

// Enhanced intent patterns with priorities
const intentPatterns: Record<CommandIntent, RegExp[]> = {
  // System commands (highest priority)
  'cancel_order': [
    /^(cancel|void|delete|remove).*(order|everything|all|cart)/i,
    /^(start over|start fresh|begin again)\b/i,
    /^forget (everything|it all|the order|this|that)\b/i,
    /^let'?s start over\b/i,
    /^(stop|end|clear).*(order|everything)\b/i,
    /^(actually|wait|hold on).*cancel\b/i,
    /^never mind.*everything\b/i,
    /you know what.*start over\b/i
  ],
  'help': [
    /^(help|assist|guide|explain|what|how)\b/i,
    /^(can (i|you)|what's available|menu)\b/i,
    /^(show|tell) me\b/i,
    /^what (can|do)\b/i,
    /^i('m| am) not sure\b/i,
    /^what (are|do you have)\b/i
  ],
  'stop': [
    /^(stop|end|quit|exit)\b/i,
    /^(that'?s|thats) (all|enough)\b/i,
    /^(done|finished)\b/i,
    /^no more\b/i
  ],

  // Order commands (medium priority)
  'add_item': [
    /^(i('d| would) like|can i (get|have)|may i have|let me get)\s/i,
    /^let'?s (get|have|try)\s/i,
    /^(add|get|give|make|pour|bring|order)\s/i,
    /^(get|give|make|pour) me\s/i,
    /^i('ll| will) (have|take)\s/i,
    /^how about\s/i,
    /^(think|maybe|perhaps) i('d| would) like\s/i
  ],
  'modify_item': [
    /^(change|modify|make|adjust)\b/i,
    /\b(instead|rather|change to|make it)\b/i,
    /^(actually|wait|hold on)\b/i,
    /\bmake that\b/i,
    /^(on second thought|thinking about it)\b/i,
    /^(change|switch) (it|that) to\b/i,
    /\b(of|for) (them|those|that)\b/i
  ],
  'remove_item': [
    /^(remove|take off|delete)\s+(the|my|that|this)?\s*(last|previous)?\s*(drink|item|order|mojito|margarita|beer|cocktail)/i,
    /^(don't|do not) want\s+(the|that|this)?\s*(drink|mojito|margarita|beer|cocktail)/i,
    /^(never mind|forget|scratch)\s+(the|that|this)?\s*(drink|mojito|margarita|beer|cocktail)/i,
    /^take\s+(the|that|this)?\s*(drink|mojito|margarita|beer|cocktail)\s*off/i,
    /^get rid of\s+(the|that|this)?\s*(drink|mojito|margarita|beer|cocktail)/i,
    /^no\s+(more|longer want)\s+(the|that|this)?\s*(drink|mojito|margarita|beer|cocktail)/i,
    /^cancel\s+(the|that|this)?\s*(drink|mojito|margarita|beer|cocktail)/i,
    /^delete\s+(the|that|this)?\s*(drink|mojito|margarita|beer|cocktail)/i
  ],
  'split_order': [
    /^split\s+(the|this)?\s*order/i,
    /^divide\s+(the|this)?\s*(bill|check|order)/i,
    /^share\s+(the|this)?\s*(bill|check|order)/i,
    /^can we split\s+(the|this)?\s*(bill|check|order)/i
  ],
  'apply_discount': [
    /^apply\s+(a|the)?\s*(discount|coupon|promo|promotion)/i,
    /^use\s+(a|the|my)?\s*(discount|coupon|promo|promotion)/i,
    /^add\s+(a|the)?\s*(discount|coupon|promo|promotion)/i,
    /^give\s+(me|us)?\s*(a|the)?\s*(discount|coupon|promo|promotion)/i
  ],
  'complete_order': [
    /^(complete|finish|process|submit)\s+(the|this|my)?\s*order/i,
    /^check\s*out/i,
    /^pay\s+(for|the)?\s*(order|bill|check)/i,
    /^that'?s\s+(all|everything)/i,
    /^ready to\s+(pay|checkout|complete)/i
  ]
};

// Track processed commands to prevent duplicates
let lastProcessedCommand = '';
let lastProcessedTimestamp = 0;
const COMMAND_DEBOUNCE_TIME = 2000; // 2 seconds

// Reference patterns for contextual understanding
const referencePatterns = {
  previous: [
    /that (one|drink)/i,
    /the last (one|drink)/i,
    /what I (just|previously) (said|ordered)/i,
    /the previous (order|drink)/i,
    /(of|for) them\b/i,
    /\b(them|those|that)\b/i
  ],
  current: [
    /this (one|drink)/i,
    /the current (order|drink)/i,
    /what('s| is) in (my cart|the order)/i
  ],
  modifier: [
    /make (it|that)/i,
    /change (it|that) to/i,
    /instead of/i,
    /\brather\b/i
  ]
};

// Common words to ignore in matching
const commonWords = ['a', 'an', 'the', 'please', 'thank', 'you', 'get', 'have', 'would', 'like', 'can', 'could', 'will'];

// Enhanced number words mapping
const numberWords: Record<string, string> = {
  'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
  'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
  'couple': '2', 'few': '3', 'several': '4',
  'a couple': '2', 'a few': '3'
};

interface DrinkMatch {
  name: string;
  variations: string[];
  matchCount: number;
  lastMatched: number;
  recentReferences: Array<{
    phrase: string;
    timestamp: number;
  }>;
}

class DrinkNameCache {
  private cache: Map<string, DrinkMatch>;
  private readonly MAX_VARIATIONS = 5;
  private readonly MAX_REFERENCES = 10;
  private readonly FUZZY_MATCH_THRESHOLD = 0.85; // Increased threshold
  private recentRemovals: Array<{ name: string; timestamp: number }> = [];

  constructor() {
    this.cache = new Map();
  }

  addDrink(name: string) {
    if (!this.cache.has(name)) {
      this.cache.set(name, {
        name,
        variations: [],
        matchCount: 0,
        lastMatched: Date.now(),
        recentReferences: []
      });
    }
  }

  addVariation(originalName: string, variation: string) {
    const drink = this.cache.get(originalName);
    if (drink) {
      if (!drink.variations.includes(variation)) {
        drink.variations = [variation, ...drink.variations]
          .slice(0, this.MAX_VARIATIONS);
      }
      drink.matchCount++;
      drink.lastMatched = Date.now();
      drink.recentReferences.unshift({
        phrase: variation,
        timestamp: Date.now()
      });
      drink.recentReferences = drink.recentReferences.slice(0, this.MAX_REFERENCES);
    }
  }

  findBestMatch(input: string, context?: OrderContext): { name: string; confidence: number } | null {
    let bestMatch = null;
    let highestConfidence = 0;
    const inputLower = input.toLowerCase().trim();

    // First try exact matches
    for (const [name, drink] of this.cache.entries()) {
      const nameLower = name.toLowerCase();

      // Exact match
      if (inputLower === nameLower) {
        return { name, confidence: 1.0 };
      }

      // Check if input contains the full drink name
      if (inputLower.includes(nameLower)) {
        const position = inputLower.indexOf(nameLower);
        const confidence = 0.95 - (position * 0.05); // Slightly lower confidence if name appears later
        if (confidence > highestConfidence) {
          bestMatch = { name, confidence };
          highestConfidence = confidence;
        }
      }

      // Check variations
      for (const variation of drink.variations) {
        if (inputLower === variation.toLowerCase()) {
          return { name, confidence: 0.95 };
        }
      }
    }

    if (bestMatch) {
      return bestMatch;
    }

    // Try fuzzy matching with strict thresholds
    const allDrinkNames = Array.from(this.cache.keys());
    const fuzzyResults = fuzzysort.go(input, allDrinkNames, {
      threshold: -2000, // Much stricter threshold
      limit: 3 // Get top 3 matches to compare
    });

    if (fuzzyResults.length > 0) {
      // Calculate normalized scores
      const matches = fuzzyResults.map(result => ({
        name: result.target,
        score: Math.max((result.score + 1000) / 1000, 0)
      }));

      // Only consider matches above threshold
      const validMatches = matches.filter(m => m.score > this.FUZZY_MATCH_THRESHOLD);

      if (validMatches.length > 0) {
        // If multiple close matches, check context
        if (validMatches.length > 1 && context?.referencedItems?.length) {
          // Prioritize recently referenced drinks
          const recentDrink = context.referencedItems[0].item;
          const recentMatch = validMatches.find(m => m.name === recentDrink);
          if (recentMatch) {
            return {
              name: recentMatch.name,
              confidence: recentMatch.score * 0.95 // Slight penalty for fuzzy match
            };
          }
        }

        // Return the highest scoring match
        const topMatch = validMatches[0];
        return {
          name: topMatch.name,
          confidence: topMatch.score * 0.9 // Penalty for fuzzy match
        };
      }
    }

    return null;
  }

  getPrioritizedDrinks(): string[] {
    return Array.from(this.cache.values())
      .sort((a, b) => {
        // Prioritize by recency and frequency
        const recencyScore = b.lastMatched - a.lastMatched;
        const frequencyScore = b.matchCount - a.matchCount;
        return recencyScore + frequencyScore * 1000;
      })
      .map(drink => drink.name);
  }

  trackRemoval(drinkName: string) {
    this.recentRemovals.unshift({
      name: drinkName,
      timestamp: Date.now()
    });
    // Keep only last 5 removals
    this.recentRemovals = this.recentRemovals.slice(0, 5);
  }

  wasRecentlyRemoved(drinkName: string): boolean {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return this.recentRemovals.some(
      removal => removal.name === drinkName && removal.timestamp > fiveMinutesAgo
    );
  }
}

const drinkNameCache = new DrinkNameCache();

// Initialize OpenAI client
let openai: OpenAI | null = null;

async function getOpenAIClient(): Promise<OpenAI> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not found - voice features will be limited');
  }
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true
  });
}

interface OrderDetails {
  items: OrderItem[];
  specialInstructions?: string;
  intent: CommandIntent;
  action?: string;
  context?: OrderContext;
  modifications?: {
    type: 'add' | 'remove' | 'modify' | 'void';
    item: OrderItem;
    previousQuantity?: number;
  }[];
  naturalLanguageResponse?: {
    confidence: number;
    alternativeIntents?: CommandIntent[];
    needsClarification?: boolean;
    suggestedResponse?: string;
  };
}

interface VoiceOrderResult {
  success: boolean;
  order?: OrderDetails;
  error?: string;
}

// Helper function for emotional tone detection
function detectEmotionalTone(text: string): 'neutral' | 'enthusiastic' | 'apologetic' | 'frustrated' {
  const normalized = text.toLowerCase();

  // Frustration indicators
  if (normalized.includes('wrong') ||
      normalized.includes('no ') ||
      normalized.includes('not ') ||
      normalized.includes('incorrect')) {
    return 'frustrated';
  }

  // Enthusiasm indicators
  if (normalized.includes('great') ||
      normalized.includes('perfect') ||
      normalized.includes('awesome') ||
      normalized.includes('yes')) {
    return 'enthusiastic';
  }

  // Apologetic indicators
  if (normalized.includes('sorry') ||
      normalized.includes('oops') ||
      normalized.includes('mistake')) {
    return 'apologetic';
  }

  return 'neutral';
}

// Improved intent detection
function detectNaturalLanguageIntent(text: string, context: OrderContext): {
  intent: CommandIntent;
  confidence: number;
  needsClarification?: boolean;
  referenceType?: 'previous' | 'current' | 'last';
  targetDrink?: string;
} {
  const normalized = text.toLowerCase().trim();
  let maxConfidence = 0;
  let detectedIntent: CommandIntent = 'add_item';
  let alternativeIntents: CommandIntent[] = [];

  // First check for exact command matches
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        const confidence = calculateIntentConfidence(match, normalized, intent as CommandIntent);
        if (confidence > maxConfidence) {
          if (maxConfidence > 0.3) {
            alternativeIntents.push(detectedIntent);
          }
          maxConfidence = confidence;
          detectedIntent = intent as CommandIntent;
        }
      }
    }
  }

  // If we found a strong match, return it
  if (maxConfidence > 0.7) {
    return {
      intent: detectedIntent,
      confidence: maxConfidence,
      needsClarification: false
    };
  }

  // Check for ordering-related words
  const orderingWords = ['want', 'like', 'give', 'get', 'make', 'order'];
  if (orderingWords.some(word => normalized.includes(word))) {
    maxConfidence = Math.max(maxConfidence, 0.8);
    detectedIntent = 'add_item';
  }

  // Check for modification words
  const modifyWords = ['change', 'modify', 'instead', 'different'];
  if (modifyWords.some(word => normalized.includes(word))) {
    maxConfidence = Math.max(maxConfidence, 0.8);
    detectedIntent = 'modify_item';
  }

  // Check for removal words
  const removeWords = ['remove', 'delete', 'cancel', 'take'];
  if (removeWords.some(word => normalized.includes(word))) {
    const targetMatch = normalized.match(/(remove|take off|delete|cancel)\s+(.*)/i);
    if (targetMatch && targetMatch[2]) {
      const potentialDrink = targetMatch[2].trim();
      const bestMatch = drinkNameCache.findBestMatch(potentialDrink);
      if (bestMatch) {
        maxConfidence = Math.max(maxConfidence, bestMatch.confidence);
        detectedIntent = 'remove_item';
        
      }
    }
  }


  return {
    intent: detectedIntent,
    confidence: maxConfidence,
    needsClarification: maxConfidence < 0.6,
    alternativeIntents: alternativeIntents.length > 0 ? alternativeIntents : undefined
  };
}

function calculateIntentConfidence(
  match: RegExpMatchArray,
  normalized: string,
  intent: CommandIntent
): number {
  let confidence = match[0].length / normalized.length;

  // Boost confidence for exact matches
  if (match.index === 0) {
    confidence *= 1.2;
  }

  // Adjust confidence based on intent priority
  if (SYSTEM_INTENTS.includes(intent as any)) {
    confidence *= 1.3; // Higher priority for system commands
  }

  return Math.min(confidence, 1.0); // Cap at 1.0
}

// Enhanced command normalization
function normalizeCommand(text: string): {
  normalized: string;
  detectedIntent: CommandIntent;
  confidence: number;
  needsClarification: boolean;
  targetDrink?: string;
} {
  let normalized = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Don't remove words for system commands
  const isSystemCommand = SYSTEM_INTENTS.some(intent =>
    intentPatterns[intent].some(pattern => pattern.test(normalized))
  );

  if (!isSystemCommand) {
    // Convert number words to digits
    Object.entries(numberWords).forEach(([word, num]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      normalized = normalized.replace(regex, num);
    });

    // Remove common filler words
    normalized = normalized.split(' ')
      .filter(word => !commonWords.includes(word))
      .join(' ');
  }

  console.log('Normalized command:', normalized);

  // Detect intent with natural language understanding
  const nlpResult = detectNaturalLanguageIntent(normalized, orderContext);
  console.log('Detected intent:', nlpResult);

  return {
    normalized,
    detectedIntent: nlpResult.intent,
    confidence: nlpResult.confidence,
    needsClarification: nlpResult.needsClarification || false,
    targetDrink: nlpResult.targetDrink
  };
}

// Export the main process function
export async function processVoiceOrder(text: string): Promise<VoiceOrderResult> {
  if (!text) {
    return {
      success: false,
      error: 'No command received'
    };
  }

  console.log('Processing voice command:', {
    text,
    currentContext: orderContext
  });

  try {
    const { normalized: normalizedCommand, detectedIntent, confidence } = normalizeCommand(text);
    const now = Date.now();

    // Process the command through OpenAI for better understanding
    const client = await getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: `Process voice commands for a bar POS system.
            Available drinks: ${drinkNameCache.getPrioritizedDrinks().join(', ')}.
            Return a JSON object with:
            {
              "items": [{
                "name": string,
                "quantity": number,
                "modifiers": string[]
              }],
              "intent": string,
              "action": string
            }`
        },
        {
          role: "user",
          content: normalizedCommand
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const result = JSON.parse(content) as OrderDetails;

    // Update order context
    orderContext = {
      ...orderContext,
      lastIntent: detectedIntent,
      emotionalTone: detectEmotionalTone(text),
      ...(result.items?.length && {
        lastOrder: result.items[result.items.length - 1],
        currentItems: result.items
      })
    };

    return {
      success: true,
      order: {
        ...result,
        context: orderContext,
        naturalLanguageResponse: {
          confidence,
          needsClarification: false,
          suggestedResponse: `Processing your order: ${result.items.map(
            item => `${item.quantity} ${item.name}`
          ).join(', ')}`
        }
      }
    };

  } catch (error) {
    console.error('Error processing voice order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process voice order'
    };
  }
}

//Helper function to check if intents are related for better context handling
function isIntentRelated(current: CommandIntent, previous: CommandIntent): boolean {
    const relatedIntents: Record<CommandIntent, CommandIntent[]> = {
      'add_item': ['modify_item', 'quantity_change', 'undo_last'],
      'modify_item': ['add_item', 'quantity_change', 'undo_last'],
      'remove_item': ['undo_last', 'void_item', 'cancel_order'],
      'void_item': ['cancel_order', 'remove_item', 'undo_last'],
      'cancel_order': ['void_item', 'undo_last'],
      'quantity_change': ['modify_item', 'add_item'],
      'undo_last': ['modify_item', 'remove_item', 'add_item'],
      'complete_order': ['split_order', 'apply_discount'],
      'split_order': ['complete_order', 'apply_discount'],
      'apply_discount': ['complete_order', 'split_order'],
      'help': ['repeat_last', 'list_orders'],
      'repeat_last': ['help', 'list_orders'],
      'list_orders': ['help', 'repeat_last'],
      'stop': []
    };
  
    return relatedIntents[current]?.includes(previous) || false;
  }
  
  // Enhanced response generation
  function generateContextualResponse(
    intent: CommandIntent,
    confidence: number,
    context: OrderContext,
    items?: OrderItem[]
  ): string {
    const uncertaintyPrefix = confidence < 0.6 ?
      "I'm not quite sure, but I think you want to " :
      confidence < 0.8 ?
        "If I understand correctly, you want to " :
        "";
  
    const emotionalTone = context.emotionalTone || 'neutral';
    const emotionalPrefix = {
      'apologetic': "I'm sorry, but ",
      'frustrated': "Let me help fix that. ",
      'enthusiastic': "Great! ",
      'neutral': ""
    }[emotionalTone];
  
    const itemSummary = items?.length ?
      `${items.map(i => `${i.quantity} ${i.name}`).join(", ")}` :
      "";
  
    const contextAwareResponses: Record<CommandIntent, (items?: OrderItem[]) => string[]> = {
      'cancel_order': () => [
        "Canceling your entire order.",
        "I'll cancel everything and we can start fresh.",
        "Starting over with a clean slate."
      ],
      'add_item': (items) => [
        `Adding ${itemSummary} to your order.`,
        `I'll add ${itemSummary} for you.`,
        `Got it, adding ${itemSummary} to your order.`
      ],
      'remove_item': (items) => [
        `Removing ${itemSummary} from your order.`,
        `I'll take ${itemSummary} off your order.`,
        `OK, removing ${itemSummary}.`
      ],
      'modify_item': (items) => [
        `Modifying your order: ${itemSummary}.`,
        `Changing that to ${itemSummary}.`,
        `Updating your order with ${itemSummary}.`
      ],
      'help': () => [
        "I can help you order drinks, modify orders, or check status. What would you like to do?",
        "Here's what I can do: take orders, make changes, apply discounts, or process payments.",
        "I can assist with ordering, modifications, or checking your order status."
      ],
      'stop': () => [
        "Okay, I'll stop listening.",
        "Stopping voice recognition now.",
        "Voice commands deactivated."
      ],
      'split_order': () => ["How would you like to split the order?"],
      'apply_discount': () => ["What discount would you like to apply?"],
      'complete_order': () => ["Order complete!"]
    };
  
    const responses = contextAwareResponses[intent]?.(items) || ["I'll help you with that."];
    const baseResponse = responses[Math.floor(Math.random() * responses.length)];
  
    return `${emotionalPrefix}${uncertaintyPrefix}${baseResponse}`;
  }
  
  // Add natural language fallback
  async function handleAmbiguousCommand(
    text: string,
    confidence: number,
    alternativeIntents: CommandIntent[],
    context: OrderContext
  ): Promise<{
    resolvedIntent: CommandIntent;
    clarification?: string;
    suggestedResponse?: string;
  }> {
    if (!openai) {
      // Fallback to best guess if OpenAI not available
      return {
        resolvedIntent: alternativeIntents[0],
        clarification: "I'm not entirely sure what you want to do. Could you please be more specific?",
        suggestedResponse: generateContextualResponse(alternativeIntents[0], confidence, context)
      };
    }
  
    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant for a bar POS system. Analyze this ambiguous command and determine the most likely intent.
            Available intents: ${Object.keys(intentPatterns).join(", ")}.
            Consider the conversation context and previous orders.
            Return a JSON object with:
            {
              "intent": string (one of the available intents),
              "clarification": string (a question to ask the user for clarity),
              "confidence": number (between 0 and 1),
              "suggestedResponse": string (how to respond to the user)
            }`
        },
        {
          role: "user",
          content: `Command: "${text}"
            Confidence: ${confidence}
            Possible intents: ${alternativeIntents.join(", ")}
            Previous context: ${JSON.stringify(context)}`
        }
      ],
      response_format: { type: "json_object" }
    });
  
    const result = JSON.parse(completion.choices[0].message.content);
    return {
      resolvedIntent: result.intent as CommandIntent,
      clarification: result.clarification,
      suggestedResponse: result.suggestedResponse
    };
  }