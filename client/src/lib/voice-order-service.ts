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
}

const responseHistory: ResponseHistory[] = [];
const MAX_HISTORY_LENGTH = 10;

// Enhanced intent types
type CommandIntent = 
  | 'add_item'           // "Add two mojitos"
  | 'remove_item'        // "Remove the last drink"
  | 'modify_item'        // "Make that three instead"
  | 'void_item'          // "Void the last order"
  | 'cancel_order'       // "Cancel this order"
  | 'split_order'        // "Split this order"
  | 'apply_discount'     // "Apply happy hour discount"
  | 'complete_order'     // "That's it"
  | 'help'              // "What can I order?"
  | 'repeat_last'        // "What was the last order?"
  | 'undo_last'         // "Undo that"
  | 'quantity_change'    // "Make that five instead"
  | 'list_orders'        // "Show my orders"
  | 'stop';             // "Stop listening"

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
  };
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

// Track order context for smarter responses
let orderContext: OrderContext = {
  emotionalTone: 'neutral',
  conversationState: {
    uncertaintyLevel: 0,
    pendingConfirmation: false
  }
};

// Intent patterns for better command matching
const intentPatterns = {
  add_item: [
    /^(add|get|give|make|pour|bring|order)\s/i,
    /^(i('d| would) like|can i (get|have)|may i have)\s/i,
    /^(get|give|make|pour) me\s/i,
    /^let('s| us) (get|have)\s/i
  ],
  remove_item: [
    /^(remove|take off|delete)\s/i,
    /(don't|do not) want|remove that|take (it|that) off/i,
    /^(never mind|forget|scratch) (that|the)\s/i
  ],
  modify_item: [
    /^(change|modify|make|adjust)\s/i,
    /\s(instead|rather|change to|make it)\s/i,
    /^(actually|wait|hold on)\s/i
  ],
  void_item: [
    /^(void|cancel|remove)\s/i,
    /last (drink|order|item)/i,
    /^start (over|fresh|again)\s/i
  ],
  cancel_order: [
    /^(cancel|void|stop|end)\s/i,
    /^(the|this|entire) order\s/i,
    /^start over|start fresh\s/i,
    /^forget (everything|it all)\s/i,
    /^let('s| us) start over\s/i
  ],
  split_order: [
    /^(split|divide|separate)\s/i,
    /^(the|this) order\s/i,
    /pay separately|split (it|check|bill)/i,
    /separate (checks|bills|payments)/i
  ],
  apply_discount: [
    /^(discount|deal|offer|special)\s/i,
    /happy hour|promotion|coupon/i,
    /^apply (the|a)\s/i,
    /^use (the|a|my)\s/i
  ],
  complete_order: [
    /^(complete|finish|done|that's it|checkout|confirm)\s/i,
    /^(process|submit|place order|ready)\s/i,
    /^(okay|alright|perfect).*done\s/i
  ],
  help: [
    /^(help|assist|guide|explain|what|how)\s/i,
    /^(can (i|you)|what's available|menu)\s/i,
    /^(show|tell) me\s/i,
    /^what (can|do)\s/i
  ],
  repeat_last: [
    /^(repeat|what|say again|last)\s/i,
    /^(what was|previous|before)\s/i,
    /^(sorry|excuse me|pardon)\s/i,
    /^remind me\s/i
  ],
  undo_last: [
    /^(undo|revert|go back|cancel that)\s/i,
    /last (thing|action|change)/i,
    /^(oops|wait|hold on)\s/i
  ],
  quantity_change: [
    /make (it|that)|change to|instead/i,
    /(\d+|one|two|three|four|five) instead/i,
    /^actually.*(want|need)/i,
    /maybe (just|make it|change to)/i
  ],
  list_orders: [
    /^(show|list|display|what's)\s/i,
    /^(my|the|current) order\s/i,
    /^what('s| is) in\s/i,
    /^remind me.*ordered\s/i
  ],
  stop: [
    /^(stop|end|quit|exit|never mind)\s/i,
    /^(listening|recording|cancel)\s/i,
    /^(that's|thats) (all|enough)\s/i
  ]
};

// Track processed commands to prevent duplicates
let lastProcessedCommand = '';
let lastProcessedTimestamp = 0;
const COMMAND_DEBOUNCE_TIME = 2000; // 2 seconds

// Common words to ignore in matching
const commonWords = ['a', 'an', 'the', 'please', 'thank', 'you', 'get', 'have', 'would', 'like', 'can', 'could', 'will'];
const numberWords = {
  'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
  'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10'
};

// Enhanced natural language understanding
function detectNaturalLanguageIntent(text: string, context: OrderContext): {
  intent: CommandIntent;
  confidence: number;
  alternativeIntents?: CommandIntent[];
  needsClarification?: boolean;
} {
  const normalized = text.toLowerCase().trim();
  let maxConfidence = 0;
  let detectedIntent: CommandIntent = 'add_item';
  let alternativeIntents: CommandIntent[] = [];

  // Check each intent pattern with fuzzy matching
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        // Calculate confidence based on:
        // 1. How much of the input matches the pattern
        // 2. Where in the input the match occurs (earlier = higher confidence)
        // 3. How specific the pattern is
        let confidence = match[0].length / normalized.length;
        confidence *= (1 - match.index! / normalized.length); // Earlier matches get higher confidence
        confidence *= pattern.toString().length / 50; // Longer patterns get higher confidence

        if (confidence > maxConfidence) {
          if (maxConfidence > 0.3) {
            alternativeIntents.push(detectedIntent);
          }
          maxConfidence = confidence;
          detectedIntent = intent as CommandIntent;
        } else if (confidence > 0.3) {
          alternativeIntents.push(intent as CommandIntent);
        }
      }
    }
  }

  // Consider conversation context
  if (context.lastIntent) {
    const isRelatedToLast = isIntentRelated(detectedIntent, context.lastIntent);
    if (isRelatedToLast) {
      maxConfidence *= 1.2; // Boost confidence for related intents
    }
  }

  // Check for uncertainty indicators
  const uncertaintyKeywords = [
    'maybe', 'perhaps', 'possibly', 'not sure', 'think', 'might',
    'could', 'would', "i'd", 'how about'
  ];

  const hasUncertainty = uncertaintyKeywords.some(keyword => 
    normalized.includes(keyword)
  );

  if (hasUncertainty) {
    maxConfidence *= 0.8; // Reduce confidence when uncertainty is detected
  }

  // Check for clarification needs
  const needsClarification = maxConfidence < 0.4 || alternativeIntents.length > 2 || hasUncertainty;

  return {
    intent: detectedIntent,
    confidence: maxConfidence,
    alternativeIntents: alternativeIntents.length > 0 ? alternativeIntents : undefined,
    needsClarification
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

// Enhanced command normalization with natural language processing
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

  // Convert number words to digits
  Object.entries(numberWords).forEach(([word, num]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    normalized = normalized.replace(regex, num);
  });

  // Remove common filler words
  normalized = normalized.split(' ')
    .filter(word => !commonWords.includes(word))
    .join(' ');

  // Detect intent with natural language understanding
  const nlpResult = detectNaturalLanguageIntent(normalized, orderContext);

  return {
    normalized,
    detectedIntent: nlpResult.intent,
    confidence: nlpResult.confidence,
    needsClarification: nlpResult.needsClarification || false
  };
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
    'void_item': () => [
      "Voiding the last item from your order.",
      "Removing that last item for you.",
      "I'll void that last item."
    ],
    'cancel_order': () => [
      "Canceling your entire order.",
      "I'll cancel everything and we can start fresh.",
      "Starting over with a clean slate."
    ],
    'split_order': () => [
      "I'll help you split this order.",
      "Let's divide this order up.",
      "We can split this order for you."
    ],
    'apply_discount': () => [
      "I'll apply that discount for you.",
      "Adding the discount to your order.",
      "Applying your discount now."
    ],
    'complete_order': () => [
      "Great, I'll complete this order for you.",
      "Finalizing your order now.",
      "Processing your order to completion."
    ],
    'help': () => [
      "I can help you order drinks, modify orders, or check status. What would you like to do?",
      "Here's what I can do: take orders, make changes, apply discounts, or process payments.",
      "I can assist with ordering, modifications, or checking your order status."
    ],
    'repeat_last': () => [
      `Let me repeat that last part for you.`,
      `Here's what was last ordered: ${context.lastOrder ? `${context.lastOrder.quantity} ${context.lastOrder.name}` : 'nothing yet'}`,
      `The last order was: ${context.lastOrder ? `${context.lastOrder.quantity} ${context.lastOrder.name}` : 'nothing yet'}`
    ],
    'undo_last': () => [
      "I'll undo that last action.",
      "Reverting the last change.",
      "Going back one step."
    ],
    'quantity_change': (items) => [
      `Changing the quantity to ${items?.[0]?.quantity || 'the requested amount'}.`,
      `Updating the quantity as requested.`,
      `Adjusting the amount to ${items?.[0]?.quantity || 'what you asked for'}.`
    ],
    'list_orders': () => [
      "Here's what's currently in your order.",
      "Let me show you your current order.",
      "I'll list out your order for you."
    ],
    'stop': () => [
      "Okay, I'll stop listening.",
      "Stopping voice recognition now.",
      "Voice commands deactivated."
    ]
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

// Enhanced voice order processing with context awareness
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
    const { normalized: normalizedCommand, detectedIntent, confidence, needsClarification } = normalizeCommand(text);
    const now = Date.now();

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

      if(suggestedResponse) {
        console.log('Using suggested response:', suggestedResponse);
      }
    }

    const emotionalTone = detectEmotionalTone(text);
    console.log('Detected emotional tone:', emotionalTone);

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
      success: true
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

// Enhanced complex order processing with better context handling
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
    if(suggestedResponse) {
      console.log("Using suggested response from OpenAI:", suggestedResponse);
    }
  }

  const emotionalTone = detectEmotionalTone(text);
  console.log('Processing complex order with tone:', emotionalTone);

  const completion = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages: [
      {
        role: "system",
        content: `Process bar POS voice commands.
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

  // Update context with parsed results
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
    }
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

// Check inventory availability
async function checkInventory(items: OrderItem[]): Promise<{ 
  available: boolean; 
  insufficientItems?: string[] 
}> {
  try {
    const response = await fetch("/api/drinks/inventory/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        items: items.map(item => ({
          drink_id: item.id,
          quantity: item.quantity
        }))
      })
    });

    if (!response.ok) {
      throw new Error("Failed to check inventory");
    }

    const result = await response.json();

    if (!result.all_available) {
      const unavailable = result.inventory_status
        .filter((status: any) => !status.is_available)
        .map((status: any) => `${status.name} (${status.available_quantity} available)`);

      return {
        available: false,
        insufficientItems: unavailable
      };
    }

    return { available: true };
  } catch (error) {
    console.error("Error checking inventory:", error);
    throw error;
  }
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