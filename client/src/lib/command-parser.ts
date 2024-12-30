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

// Normalized drink name matching
function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Find best matching drink from inventory
function findMatchingDrink(drinkName: string, availableDrinks: DrinkItem[]): DrinkItem | null {
  const normalizedInput = normalizeText(drinkName);

  // Try exact match first
  const exactMatch = availableDrinks.find(d => 
    normalizeText(d.name) === normalizedInput
  );

  if (exactMatch) {
    logger.info('Found exact drink match:', exactMatch.name);
    return exactMatch;
  }

  // Try partial matches
  const partialMatches = availableDrinks.filter(d => {
    const drinkName = normalizeText(d.name);
    return drinkName.includes(normalizedInput) ||
           normalizedInput.includes(drinkName);
  });

  if (partialMatches.length > 0) {
    const bestMatch = partialMatches[0];
    logger.info('Found best partial match:', {
      searchTerm: normalizedInput,
      matchedDrink: bestMatch.name
    });
    return bestMatch;
  }

  logger.info('No drink match found:', {
    searchTerm: normalizedInput,
    availableDrinks: availableDrinks.map(d => d.name)
  });
  return null;
}

// Efficient command parser that integrates with inventory
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

  // Check for complete order commands first - prioritize these matches
  const completeOrderPatterns = [
    // Direct completion commands
    /^(?:complete|process|finish|confirm|place)\s*(?:my\s*)?(?:the\s*)?order$/i,
    /^(?:that'?s?\s*(?:it|all)|done|ready|checkout)$/i,
    /^(?:process|complete)\s*(?:my\s*)?(?:the\s*)?payment$/i,
    /^(?:pay|checkout|finalize)\s*(?:now|order)?$/i,
    /^(?:order|payment)\s*(?:complete|done|finished)$/i,
    // Informal completion phrases
    /^(?:i'?m?\s*)?(?:ready|done|finished)(?:\s*(?:now|with\s*(?:my\s*)?order))?$/i,
    /^(?:place|submit|send)(?:\s*(?:my|the)\s*order)?(?:\s*now)?$/i,
    /^(?:let'?s?\s*)?check\s*out(?:\s*now)?$/i
  ];

  for (const pattern of completeOrderPatterns) {
    if (pattern.test(textLower)) {
      logger.info('Matched complete order command');
      return { type: 'system', action: 'complete_order' };
    }
  }

  // Check for other system commands
  const systemCommands = {
    help: /^(?:help|what can i say|what are the commands|menu|what can you do)/i,
    cancel: /^(?:cancel|clear|remove)\s+(?:order|everything|all)/i
  };

  for (const [action, pattern] of Object.entries(systemCommands)) {
    if (pattern.test(textLower)) {
      logger.info('System command matched:', action);
      return { type: 'system', action };
    }
  }

  // Only try to match drink orders if no system commands matched
  const orderParts = textLower.split(/\s+and\s+|\s*,\s*/);
  const items: ParsedCommand['items'] = [];

  for (const part of orderParts) {
    // Skip if it looks like a system command
    if (completeOrderPatterns.some(pattern => pattern.test(part))) {
      continue;
    }

    // Try to extract quantity and drink name
    const quantityMatch = part.match(/(\d+|a|one|two|three|four|five)\s+(.+)/i);
    if (quantityMatch) {
      const [_, quantityStr, drinkName] = quantityMatch;
      const quantity = parseInt(quantityStr) || 
                      { 'a': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5 }[quantityStr.toLowerCase()] || 
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
    'with ice', 'no ice', 'neat', 'on the rocks'
  ];

  modifierPatterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(itemName)) {
      modifiers.push(pattern);
    }
  });

  return modifiers;
}