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
const intentPatterns = {
  // System commands (highest priority)
  cancel_order: [
    /^(cancel|void|delete|remove).*(order|everything|all|cart)/i,
    /^(start over|start fresh|begin again)\b/i,
    /^forget (everything|it all|the order|this|that)\b/i,
    /^let'?s start over\b/i,
    /^(stop|end|clear).*(order|everything)\b/i,
    /^(actually|wait|hold on).*cancel\b/i,
    /^never mind.*everything\b/i,
    /you know what.*start over\b/i
  ],
  help: [
    /^(help|assist|guide|explain|what|how)\b/i,
    /^(can (i|you)|what's available|menu)\b/i,
    /^(show|tell) me\b/i,
    /^what (can|do)\b/i,
    /^i('m| am) not sure\b/i,
    /^what (are|do you have)\b/i
  ],
  stop: [
    /^(stop|end|quit|exit)\b/i,
    /^(that'?s|thats) (all|enough)\b/i,
    /^(done|finished)\b/i,
    /^no more\b/i
  ],

  // Order commands (medium priority)
  add_item: [
    /^(i('d| would) like|can i (get|have)|may i have|let me get)\s/i,
    /^let'?s (get|have|try)\s/i,
    /^(add|get|give|make|pour|bring|order)\s/i,
    /^(get|give|make|pour) me\s/i,
    /^i('ll| will) (have|take)\s/i,
    /^how about\s/i,
    /^(think|maybe|perhaps) i('d| would) like\s/i
  ],
  modify_item: [
    /^(change|modify|make|adjust)\b/i,
    /\b(instead|rather|change to|make it)\b/i,
    /^(actually|wait|hold on)\b/i,
    /\bmake that\b/i,
    /^(on second thought|thinking about it)\b/i,
    /^(change|switch) (it|that) to\b/i,
    /\b(of|for) (them|those|that)\b/i
  ],
  remove_item: [
    /^(remove|take off|delete)\b/i,
    /^(don't|do not) want|remove that/i,
    /^(never mind|forget|scratch) (that|the)\b/i,
    /take (it|that) off\b/i,
    /^get rid of\b/i,
    /^no (more|longer want)\b/i
  ],
  split_order: [],
  apply_discount: [],
  complete_order: []
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
const numberWords = {
  'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
  'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
  'couple': '2', 'few': '3', 'several': '4',
  'a couple': '2', 'a few': '3'
};

// Enhanced natural language understanding
function detectNaturalLanguageIntent(text: string, context: OrderContext): {
  intent: CommandIntent;
  confidence: number;
  alternativeIntents?: CommandIntent[];
  needsClarification?: boolean;
  referenceType?: 'previous' | 'current' | 'last';
} {
  const normalized = text.toLowerCase().trim();
  let maxConfidence = 0;
  let detectedIntent: CommandIntent = 'add_item';
  let alternativeIntents: CommandIntent[] = [];
  let referenceType: 'previous' | 'current' | 'last' | undefined;

  // First check references
  for (const [type, patterns] of Object.entries(referencePatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        referenceType = type as 'previous' | 'current' | 'last';
        console.log(`Detected reference type: ${type}`);
        break;
      }
    }
    if (referenceType) break;
  }

  // Check system commands first (highest priority)
  for (const intent of SYSTEM_INTENTS) {
    const patterns = intentPatterns[intent];
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        // System commands get higher base confidence
        let confidence = 0.9 + (match[0].length / normalized.length) * 0.1;

        // Earlier matches get higher confidence
        confidence *= (1 - match.index! / normalized.length);

        console.log(`Checking system command ${intent}: ${confidence}`);

        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          detectedIntent = intent;
          console.log(`Detected system command: ${intent} with confidence ${confidence}`);
          return {
            intent: detectedIntent,
            confidence: maxConfidence,
            needsClarification: false,
            referenceType
          };
        }
      }
    }
  }

  // Then check other intents
  for (const intent of [...ORDER_INTENTS, ...MANAGEMENT_INTENTS]) {
    const patterns = intentPatterns[intent as keyof typeof intentPatterns];
    if (!patterns) continue;

    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        let confidence = match[0].length / normalized.length;
        confidence *= (1 - match.index! / normalized.length);

        // Boost confidence for contextually relevant patterns
        if (referenceType && isIntentRelated(intent, context.lastIntent)) {
          confidence *= 1.2;
          console.log(`Boosting confidence for related intent ${intent}`);
        }

        // Additional boost for modification commands with references
        if (intent === 'modify_item' && referenceType) {
          confidence *= 1.3;
          console.log(`Boosting confidence for modification with reference`);
        }

        if (confidence > maxConfidence) {
          if (maxConfidence > 0.3) {
            alternativeIntents.push(detectedIntent);
          }
          maxConfidence = confidence;
          detectedIntent = intent;
          console.log(`Detected intent ${intent} with confidence ${confidence}`);
        }
      }
    }
  }

  // Check for uncertainty indicators
  const uncertaintyKeywords = [
    'maybe', 'perhaps', 'possibly', 'not sure', 'think', 'might',
    'could', 'would', "i'd", 'how about', 'what if', 'probably'
  ];

  const hasUncertainty = uncertaintyKeywords.some(keyword =>
    normalized.includes(keyword)
  );

  if (hasUncertainty) {
    maxConfidence *= 0.8;
    console.log('Detected uncertainty, reducing confidence');
  }

  return {
    intent: detectedIntent,
    confidence: maxConfidence,
    alternativeIntents: alternativeIntents.length > 0 ? alternativeIntents : undefined,
    needsClarification: maxConfidence < 0.4 || alternativeIntents.length > 2 || hasUncertainty,
    referenceType
  };
}

// Enhanced command normalization
function normalizeCommand(text: string): {
  normalized: string;
  detectedIntent: CommandIntent;
  confidence: number;
  needsClarification: boolean;
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
    needsClarification: nlpResult.needsClarification || false
  };
}

// Check if intents are related for better context handling
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

    // First try exact matches including variations
    for (const [name, drink] of this.cache.entries()) {
      // Exact name match
      if (input.toLowerCase() === name.toLowerCase()) {
        return { name, confidence: 1.0 };
      }

      // Variation matches
      for (const variation of drink.variations) {
        if (input.toLowerCase() === variation.toLowerCase()) {
          return { name, confidence: 0.95 };
        }
      }

      // Check for reference phrases ("another one", "same thing", etc.)
      const referenceMatch = this.matchReference(input, drink, context);
      if (referenceMatch && referenceMatch.confidence > highestConfidence) {
        bestMatch = { name, confidence: referenceMatch.confidence };
        highestConfidence = referenceMatch.confidence;
      }
    }

    if (bestMatch) {
      return bestMatch;
    }

    // Then try fuzzy matching
    const allDrinkNames = Array.from(this.cache.keys());
    const fuzzyResults = fuzzysort.go(input, allDrinkNames, {
      threshold: -10000,
      limit: 1
    });

    if (fuzzyResults.length > 0) {
      const topResult = fuzzyResults[0];
      const normalizedScore = (topResult.score + 1000) / 1000; // Convert to 0-1 range
      if (normalizedScore > 0.6) {
        bestMatch = {
          name: topResult.target,
          confidence: normalizedScore
        };
      }
    }

    return bestMatch;
  }

  private matchReference(input: string, drink: DrinkMatch, context?: OrderContext): { confidence: number } | null {
    const referencePatterns = [
      { pattern: /another (one|drink|mule|beer|cocktail)/i, confidence: 0.9 },
      { pattern: /same (thing|drink|one)/i, confidence: 0.85 },
      { pattern: /one more/i, confidence: 0.8 },
      { pattern: /(that|this) again/i, confidence: 0.8 }
    ];

    // Only consider references if this drink was recently matched
    const recentTimeWindow = 5 * 60 * 1000; // 5 minutes
    if (Date.now() - drink.lastMatched > recentTimeWindow) {
      return null;
    }

    // Check if this was the last referenced drink
    const wasLastReferenced = context?.referencedItems?.[0]?.item === drink.name;

    for (const { pattern, confidence } of referencePatterns) {
      if (pattern.test(input)) {
        // Boost confidence if this was the last referenced drink
        const contextBoost = wasLastReferenced ? 0.1 : 0;
        return { confidence: confidence + contextBoost };
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
}

const drinkNameCache = new DrinkNameCache();

// Enhanced voice order processing
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

  // Initialize drink cache if needed
  if (orderContext.currentItems?.length) {
    orderContext.currentItems.forEach(item => {
      drinkNameCache.addDrink(item.name);
    });
  }

  try {
    const { normalized: normalizedCommand, detectedIntent, confidence, needsClarification } = normalizeCommand(text);
    const now = Date.now();

    // Try to match drink names in the command with context
    const words = normalizedCommand.split(' ');
    for (let i = 0; i < words.length; i++) {
      const phrase = words.slice(i).join(' ');
      const match = drinkNameCache.findBestMatch(phrase, orderContext);
      if (match) {
        console.log('Found drink name match:', match);
        // Add successful matches to variations and update context
        drinkNameCache.addVariation(match.name, phrase);

        // Update referenced items in context
        orderContext.referencedItems = [
          {
            item: match.name,
            timestamp: now,
            action: detectedIntent
          },
          ...(orderContext.referencedItems || []).slice(0, 4)
        ];
        break;
      }
    }

    if (normalizedCommand === lastProcessedCommand &&
      now - lastProcessedTimestamp < COMMAND_DEBOUNCE_TIME) {
      console.log('Duplicate command detected, skipping:', normalizedCommand);
      return {
        success: false,
        error: 'Command debounced'
      };
    }

    let finalIntent = detectedIntent;
    let clarification: string | undefined;

    // Handle ambiguous commands
    if (needsClarification) {
      console.log('Handling ambiguous command:', {
        text,
        confidence,
        detectedIntent
      });

      const { resolvedIntent, clarification: resolvedClarification, suggestedResponse } = await handleAmbiguousCommand(
        text,
        confidence,
        [detectedIntent],
        orderContext
      );

      finalIntent = resolvedIntent;
      clarification = resolvedClarification;

      if (suggestedResponse) {
        console.log('Using suggested response:', suggestedResponse);
      }
    }

    // For system commands, return immediately
    if (finalIntent === 'cancel_order' || finalIntent === 'help' || finalIntent === 'stop') {
      console.log(`Executing system command: ${finalIntent}`);

      const response = generateContextualResponse(
        finalIntent,
        confidence,
        orderContext
      );

      responseHistory.unshift({
        command: normalizedCommand,
        intent: finalIntent,
        confidence,
        timestamp: now,
        success: true
      });

      if (responseHistory.length > MAX_HISTORY_LENGTH) {
        responseHistory.pop();
      }

      return {
        success: true,
        order: {
          items: [],
          intent: finalIntent,
          context: {
            ...orderContext,
            lastIntent: finalIntent
          },
          naturalLanguageResponse: {
            confidence,
            needsClarification: false,
            suggestedResponse: response
          }
        }
      };
    }

    const emotionalTone = detectEmotionalTone(text);
    console.log('Detected emotional tone:', emotionalTone);

    // Process order details
    const orderDetails = await processComplexOrder(text);
    console.log('Processed order details:', orderDetails);

    // Update context
    orderContext = {
      ...orderContext,
      lastIntent: finalIntent,
      emotionalTone,
      ...(orderDetails.items?.length && {
        lastOrder: orderDetails.items[orderDetails.items.length - 1],
        currentItems: orderDetails.items
      })
    };

    // Track response history
    responseHistory.unshift({
      command: normalizedCommand,
      intent: finalIntent,
      confidence,
      timestamp: now,
      success: true,
      context: {
        previousItems: orderContext.previousCommands,
        modifiedItem: orderDetails.modifications?.[0]?.item.name,
        action: orderDetails.action
      }
    });

    if (responseHistory.length > MAX_HISTORY_LENGTH) {
      responseHistory.pop();
    }

    return {
      success: true,
      order: {
        ...orderDetails,
        intent: finalIntent,
        context: orderContext,
        naturalLanguageResponse: {
          confidence,
          needsClarification,
          suggestedResponse: generateContextualResponse(
            finalIntent,
            confidence,
            orderContext,
            orderDetails.items
          ),
          alternativeIntents: needsClarification ? [detectedIntent] : undefined
        }
      }
    };

  } catch (error) {
    console.error('Error processing voice order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process voice order';

    // Track failed commands
    responseHistory.unshift({
      command: text,
      intent: 'error',
      confidence: 0,
      timestamp: Date.now(),
      success: false
    });

    if (responseHistory.length > MAX_HISTORY_LENGTH) {
      responseHistory.pop();
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

// Enhanced complex order processing
async function processComplexOrder(text: string): Promise<OrderDetails> {
  if (!openai) throw new Error('Voice processing service is not configured');

  const { normalized: normalizedCommand, detectedIntent, confidence, needsClarification } = normalizeCommand(text);
  const now = Date.now();

  if (normalizedCommand === lastProcessedCommand &&
    now - lastProcessedTimestamp < COMMAND_DEBOUNCE_TIME) {
    console.log('Duplicate complex order detected, skipping:', normalizedCommand);
    return {
      items: [],
      intent: detectedIntent,
      context: orderContext
    };
  }

  let finalIntent = detectedIntent;
  let clarification: string | undefined;

  // Handle ambiguous commands
  if (needsClarification) {
    console.log('Handling ambiguous command in complex order:', {
      text,
      confidence,
      detectedIntent
    });

    const { resolvedIntent, clarification: resolvedClarification, suggestedResponse } = await handleAmbiguousCommand(
      text,
      confidence,
      [detectedIntent],
      orderContext
    );

    finalIntent = resolvedIntent;
    clarification = resolvedClarification;
    if (suggestedResponse) {
      console.log("Using suggested response from OpenAI:", suggestedResponse);
    }
  }

  const emotionalTone = detectEmotionalTone(text);
  console.log('Processing complex order with tone:', emotionalTone);

  const prioritizedDrinks = drinkNameCache.getPrioritizedDrinks();

  const completion = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages: [
      {
        role: "system",
        content: `Process bar POS voice commands.
          Available drinks in order of popularity: ${prioritizedDrinks.join(', ')}.
          Return a JSON object with:
          {
            "items": [{
              "name": string,
              "quantity": number,
              "modifiers": string[]
            }],
            "intent": "${finalIntent}",
            "action": string,
            "context": {
              "lastIntent": string,
              "emotionalTone": string,
              "modificationTarget": {
                "itemIndex": number,
                "originalQuantity": number
              }
            }
          }`
      },
      {
        role: "user",
        content: `Previous context: ${JSON.stringify(orderContext)}
          Current command: "${normalizedCommand}"
          Detected intent: ${finalIntent}
          Confidence: ${confidence}
          Emotional tone: ${emotionalTone}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const parsed = JSON.parse(completion.choices[0].message.content);
  lastProcessedCommand = normalizedCommand;
  lastProcessedTimestamp = now;

  // Update context
  orderContext = {
    ...orderContext,
    ...parsed.context,
    emotionalTone,
    lastIntent: finalIntent,
    conversationState: {
      ...orderContext.conversationState,
      needsClarification: needsClarification,
      uncertaintyLevel: needsClarification ?
        (orderContext.conversationState?.uncertaintyLevel || 0) + 1 :
        0
    },
    previousCommands: [...orderContext.previousCommands, normalizedCommand]
  };

  const response = generateContextualResponse(
    finalIntent,
    confidence,
    orderContext,
    parsed.items
  );

  console.log('Generated response:', response);

  return {
    ...parsed,
    intent: finalIntent,
    context: orderContext,
    naturalLanguageResponse: {
      confidence,
      needsClarification,
      suggestedResponse: response,
      alternativeIntents: needsClarification ? [detectedIntent] : undefined
    }
  };
}

// Detect emotional tone from text
function detectEmotionalTone(text: string): OrderContext['emotionalTone'] {
  const normalized = text.toLowerCase();

  if (normalized.includes('wrong') ||
    normalized.includes('no ') ||
    normalized.includes('not ') ||
    normalized.includes('incorrect')) {
    return 'frustrated';
  }

  if (normalized.includes('great') ||
    normalized.includes('perfect') ||
    normalized.includes('awesome') ||
    normalized.includes('yes')) {
    return 'enthusiastic';
  }

  if (normalized.includes('sorry') ||
    normalized.includes('oops') ||
    normalized.includes('mistake')) {
    return 'apologetic';
  }

  return 'neutral';
}

// Initialize OpenAI client with proper error handling
let openai: OpenAI | null = null;

try {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI API key not found - voice features will be limited');
  } else {
    openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }
} catch (error) {
  console.error('Failed to initialize OpenAI client:', error);
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