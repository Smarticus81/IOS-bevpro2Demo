import type { DrinkItem } from "@db/schema";

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
    console.log('Found exact drink match:', exactMatch.name);
    return exactMatch;
  }

  // Try partial matches with word boundaries
  const partialMatches = availableDrinks.filter(d => {
    const drinkName = d.name.toLowerCase();
    return drinkName.includes(normalizedInput) ||
           normalizedInput.includes(drinkName) ||
           // Handle special cases like "cooler" variants
           (drinkName.includes('cooler') && normalizedInput.includes('cooler'));
  });

  if (partialMatches.length > 0) {
    // If multiple matches, prefer the shortest name as it's likely more specific
    const bestMatch = partialMatches.sort((a, b) => a.name.length - b.name.length)[0];
    console.log('Found best partial match:', {
      searchTerm: normalizedInput,
      matchedDrink: bestMatch.name,
      allMatches: partialMatches.map(d => d.name)
    });
    return bestMatch;
  }

  console.log('No drink match found:', {
    searchTerm: normalizedInput,
    availableDrinks: availableDrinks.map(d => d.name)
  });
  return null;
}

// Efficient command parser that integrates with inventory
export function parseVoiceCommand(text: string, availableDrinks: DrinkItem[]): ParsedCommand | null {
  if (!text || !availableDrinks?.length) {
    console.log('Invalid input:', { text: !!text, drinksAvailable: availableDrinks?.length });
    return null;
  }

  const textLower = text.toLowerCase().trim();
  console.log('Voice command received:', {
    text: textLower,
    drinksAvailable: availableDrinks.length
  });

  // Check for complete order commands first
  const completeOrderPatterns = [
    /^(complete|process|finish|confirm|place)\s*(the\s*)?order$/i,
    /^(that'?s?\s*(it|all)|done|ready|checkout)$/i,
    /^(process|complete)\s*(the\s*)?payment$/i
  ];

  for (const pattern of completeOrderPatterns) {
    if (pattern.test(textLower)) {
      console.log('Matched complete order command');
      return { type: 'system', action: 'complete_order' };
    }
  }

  // Check for other system commands
  const systemCommands = {
    stop: /(?:stop|end|quit|exit|turn off|disable)\s+(?:listening|voice|commands?)/i,
    help: /(?:help|what can i say|commands|menu|what can you do)/i,
    repeat: /(?:repeat that|say that again|what did you say)/i,
    cancel: /(?:cancel|clear|remove)\s+(?:order|everything|all)/i
  };

  for (const [action, pattern] of Object.entries(systemCommands)) {
    if (pattern.test(textLower)) {
      console.log('Matched system command:', action);
      return { type: 'system', action };
    }
  }

  // Command patterns for orders
  const orderPatterns = [
    /(?:can i|could i|i want to|i would like to|let me|i'd like to|i want|get me|give me)\s+(?:get|have|order)/i,
    /(?:order|get|add)\s+(?:a|an|some|\d+)/i,
    /(?:i'll|i will)\s+(?:take|have)/i,
    /(?:give|get)\s+me/i
  ];

  // Split compound orders on "and"
  const orderParts = textLower.split(/\s+and\s+|\s*,\s*/);
  const items: ParsedCommand['items'] = [];

  for (const part of orderParts) {
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
    console.log('Successfully parsed order items:', items);
    return { type: 'order', items };
  }

  console.log('No valid items found in command');
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

function determineCommandType(text: string): ParsedCommand['type'] {
  if (/(cancel|remove|delete|clear)/.test(text)) return 'cancel';
  if (/(what|how|when|where|why|is there|do you have)/.test(text)) return 'inquiry';
  if (/(change|modify|make|update)/.test(text)) return 'modify';
  return 'order';
}