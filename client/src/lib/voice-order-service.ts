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

// Track order context for smarter responses
let orderContext: OrderContext = {
  emotionalTone: 'neutral',
  conversationState: {
    uncertaintyLevel: 0,
    pendingConfirmation: false
  }
};

// Strict intent patterns - order matters, more specific patterns first
const intentPatterns = {
  cancel_order: [
    /^(cancel|void).*(order|everything)/i,
    /^(start over|start fresh)\b/i,
    /^forget (everything|it all|the order)\b/i,
    /^let'?s start over\b/i,
    /^(stop|end|clear).*(order|everything)/i
  ],
  add_item: [
    /^(i('d| would) like|can i (get|have)|may i have)\s/i,
    /^let'?s (get|have)\s/i,
    /^(add|get|give|make|pour|bring|order)\s/i,
    /^(get|give|make|pour) me\s/i
  ],
  remove_item: [
    /^(remove|take off|delete)\b/i,
    /^(don't|do not) want|remove that/i,
    /^(never mind|forget|scratch) (that|the)\b/i,
    /take (it|that) off\b/i
  ],
  modify_item: [
    /^(change|modify|make|adjust)\b/i,
    /\b(instead|rather|change to|make it)\b/i,
    /^(actually|wait|hold on)\b/i,
    /\bmake that\b/i
  ],
  help: [
    /^(help|assist|guide|explain|what|how)\b/i,
    /^(can (i|you)|what's available|menu)\b/i,
    /^(show|tell) me\b/i,
    /^what (can|do)\b/i
  ],
  stop: [
    /^(stop|end|quit|exit)\b/i,
    /^(that'?s|thats) (all|enough)\b/i
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

  // Check system commands first (cancel, help, stop)
  const systemPatterns = ['cancel_order', 'help', 'stop'];
  for (const intent of systemPatterns) {
    const patterns = intentPatterns[intent as keyof typeof intentPatterns];
    for (const pattern of patterns) {
      const match = normalized.match(pattern);
      if (match) {
        // System commands get higher base confidence
        let confidence = 0.8 + (match[0].length / normalized.length) * 0.2;
        // Earlier matches get higher confidence
        confidence *= (1 - match.index! / normalized.length);

        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          detectedIntent = intent as CommandIntent;
          console.log(`Detected system command: ${intent} with confidence ${confidence}`);
          return {
            intent: detectedIntent,
            confidence: maxConfidence,
            needsClarification: false
          };
        }
      }
    }
  }

  // Then check other intents
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (systemPatterns.includes(intent)) continue; // Skip system commands we already checked

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
    console.log('Detected uncertainty in command');
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

  // Remove common filler words only for non-system commands
  const isSystemCommand = normalized.match(/^(cancel|help|stop)/i);
  if (!isSystemCommand) {
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