import type { DrinkItem } from "@/types/speech";
import { logger } from "./logger";

type ParsedCommand = {
  type: 'order' | 'inquiry' | 'modify' | 'cancel' | 'system';
  items?: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
  }>;
  action?: string;
};

// Normalized drink name matching with improved fuzzy matching
function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Enhanced drink matching with fuzzy search
function findMatchingDrink(drinkName: string, availableDrinks: DrinkItem[]): DrinkItem | null {
  const normalizedInput = normalizeText(drinkName);

  // Remove common filler words
  const cleanedInput = normalizedInput
    .replace(/(?:can|could|would|like|want|get|have|give|make|add|pour|bring|serve)\s+(me|us|i|a|an|some|to)?\s*/g, '')
    .replace(/\b(please|thanks|thank you)\b/g, '')
    .trim();

  // Try exact match first
  const exactMatch = availableDrinks.find(d => 
    normalizeText(d.name) === cleanedInput
  );

  if (exactMatch) {
    logger.info('Found exact drink match:', exactMatch.name);
    return exactMatch;
  }

  // Try partial matches with word boundaries
  const partialMatches = availableDrinks.filter(d => {
    const drinkName = normalizeText(d.name);
    const words = cleanedInput.split(' ');
    return words.every(word => drinkName.includes(word)) ||
           drinkName.split(' ').some(word => cleanedInput.includes(word));
  });

  if (partialMatches.length > 0) {
    const bestMatch = partialMatches[0];
    logger.info('Found best partial match:', {
      searchTerm: cleanedInput,
      matchedDrink: bestMatch.name
    });
    return bestMatch;
  }

  logger.info('No drink match found:', {
    searchTerm: cleanedInput,
    availableDrinks: availableDrinks.map(d => d.name)
  });
  return null;
}

// Enhanced command parser with natural language support
export function parseVoiceCommand(text: string, availableDrinks: DrinkItem[]): ParsedCommand | null {
  if (!text || !availableDrinks?.length) {
    logger.info('Invalid input:', { text: !!text, drinksAvailable: availableDrinks?.length });
    return null;
  }

  const textLower = text.toLowerCase().trim();
  logger.info('Voice command received:', {
    text: textLower,
    drinksAvailable: availableDrinks.length
  });

  // Enhanced patterns for order completion
  const completeOrderPatterns = [
    // Direct completion commands
    /^(?:complete|process|finish|confirm|place|submit)\s*(?:my|the|this)?\s*order$/i,
    /^(?:that'?s?\s*(?:it|all)|done|ready|checkout|good|perfect)$/i,
    /^(?:process|complete|handle)\s*(?:my|the)?\s*payment$/i,
    /^(?:pay|checkout|finalize|ring)\s*(?:me|this|up|now|order)?$/i,
    /^(?:order|payment)\s*(?:complete|done|finished)$/i,
    // Natural language variations
    /^(?:i'?m?\s*)?(?:ready|done|finished|good)(?:\s*(?:now|with\s*(?:my\s*)?order))?$/i,
    /^(?:i'?d?\s*like\s*to|can\s*(?:you|we)|could\s*(?:you|we))?\s*(?:place|submit|send|process)\s*(?:my|the|this)?\s*order(?:\s*now|please)?$/i,
    /^(?:let'?s?\s*)?(?:check|ring|cash)\s*(?:me|this)?\s*out(?:\s*now)?$/i,
    /^(?:i'?m?\s*)?(?:all\s*set|ready\s*to\s*pay|done\s*ordering)$/i,
    /^(?:that'?s?\s*)?(?:everything|all\s*i\s*need|all\s*for\s*(?:me|now|today))$/i
  ];

  // Check for order completion first
  for (const pattern of completeOrderPatterns) {
    if (pattern.test(textLower)) {
      logger.info('Matched complete order command');
      return { type: 'system', action: 'complete_order' };
    }
  }

  // Enhanced system commands
  const systemCommands = {
    help: /^(?:help|what can (?:i|you) (?:say|do)|show (?:me )?(?:the )?(?:commands|menu)|how does this work)/i,
    cancel: /^(?:cancel|clear|remove|delete|start over|scratch that)\s+(?:order|everything|all|that)/i
  };

  for (const [action, pattern] of Object.entries(systemCommands)) {
    if (pattern.test(textLower)) {
      logger.info('System command matched:', action);
      return { type: 'system', action };
    }
  }

  // Split on conjunctions and commas, handling natural language
  const orderParts = textLower
    .replace(/(?:can|could|would)\s+(?:i|you|we)\s+(?:have|get|add)/g, '')
    .replace(/(?:i|we)\s+(?:would|want|need)\s+(?:to order|to get|to have)/g, '')
    .replace(/\b(?:please|thanks|thank you)\b/g, '')
    .split(/\s+and\s+|\s*,\s*/);

  const items: ParsedCommand['items'] = [];

  for (const part of orderParts) {
    // Skip if it looks like a system command
    if (completeOrderPatterns.some(pattern => pattern.test(part))) {
      continue;
    }

    // Enhanced quantity extraction
    const quantityMatch = part.match(/(\d+|a|one|two|three|four|five|couple|few)\s+(.+)/i);
    if (quantityMatch) {
      const [_, quantityStr, drinkName] = quantityMatch;
      const quantity = parseInt(quantityStr) || 
                      { 'a': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 'couple': 2, 'few': 3 }[quantityStr.toLowerCase()] || 
                      1;

      const matchedDrink = findMatchingDrink(drinkName, availableDrinks);
      if (matchedDrink) {
        items.push({
          name: matchedDrink.name,
          quantity,
          modifiers: extractModifiers(drinkName)
        });
      }
    } else {
      // Try to match without explicit quantity
      const matchedDrink = findMatchingDrink(part, availableDrinks);
      if (matchedDrink) {
        items.push({
          name: matchedDrink.name,
          quantity: 1,
          modifiers: extractModifiers(part)
        });
      }
    }
  }

  if (items.length > 0) {
    logger.info('Successfully parsed order items:', items);
    return { type: 'order', items };
  }

  logger.info('No valid items found in command');
  return null;
}

function extractModifiers(itemName: string): string[] {
  const modifiers: string[] = [];
  const modifierPatterns = [
    'diet', 'light', 'sugar[- ]free', 'double', 'triple',
    'with ice', 'no ice', 'neat', 'on the rocks',
    'extra', 'less', 'splash of', 'twist of', 'with',
    'chilled', 'frozen', 'hot', 'warm'
  ];

  modifierPatterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(itemName)) {
      modifiers.push(pattern);
    }
  });

  return modifiers;
}