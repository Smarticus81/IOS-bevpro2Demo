import type { Drink } from "@db/schema";

type ParsedCommand = {
  type: 'order' | 'inquiry' | 'modify' | 'cancel';
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
function findMatchingDrink(drinkName: string, availableDrinks: Drink[]): Drink | null {
  const normalizedInput = normalizeText(drinkName);
  
  // Try exact match first
  const exactMatch = availableDrinks.find(d => 
    normalizeText(d.name) === normalizedInput
  );
  
  if (exactMatch) {
    console.log('Found exact drink match:', exactMatch.name);
    return exactMatch;
  }
  
  // Try partial matches
  const partialMatches = availableDrinks.filter(d => {
    const drinkNameNorm = normalizeText(d.name);
    return drinkNameNorm.includes(normalizedInput) ||
           normalizedInput.includes(drinkNameNorm);
  });
  
  if (partialMatches.length > 0) {
    // Return the closest match by length
    const bestMatch = partialMatches.sort((a, b) => 
      Math.abs(normalizeText(a.name).length - normalizedInput.length) - 
      Math.abs(normalizeText(b.name).length - normalizedInput.length)
    )[0];
    
    console.log('Found partial drink match:', {
      input: drinkName,
      matched: bestMatch.name,
      allMatches: partialMatches.map(d => d.name)
    });
    
    return bestMatch;
  }
  
  console.log('No matching drink found for:', drinkName);
  return null;
}

// Efficient command parser that integrates with inventory
export function parseVoiceCommand(text: string, availableDrinks: Drink[]): ParsedCommand | null {
  if (!text || !availableDrinks?.length) {
    console.log('Invalid input:', { text: !!text, drinksAvailable: availableDrinks?.length });
    return null;
  }

  const textLower = text.toLowerCase().trim();
  console.log('Parsing voice command:', textLower);

  // Command patterns
  const orderPatterns = [
    /(?:can i|could i|i want to|i would like to|let me|i'd like to|i want|get me|give me)\s+(?:get|have|order)/i,
    /(?:order|get|add)\s+(?:a|an|some|\d+)/i,
    /(?:i'll take|i will take|i will have|i'll have)/i
  ];

  // Check if this is an order command
  const isOrderCommand = orderPatterns.some(pattern => pattern.test(textLower));
  if (!isOrderCommand) {
    console.log('Not recognized as an order command');
    return null;
  }

  // Remove filler words and normalize input
  const cleanedText = textLower
    .replace(/can i get|could i get|i want to get|i would like to get|i want|i would like|give me|get me|please|and/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  console.log('Cleaned command text:', cleanedText);

  // Extract quantities and drink names
  const items: ParsedCommand['items'] = [];
  const matches = cleanedText.match(/(\d+|a|one|two|three|four|five)\s+([a-z\s]+?)(?=\s+\d+|$)/g);

  if (matches) {
    console.log('Found quantity-drink matches:', matches);

    for (const match of matches) {
      const [quantityStr, ...nameParts] = match.split(/\s+/);
      const quantity = parseInt(quantityStr) || 
                      { 'a': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5 }[quantityStr] || 
                      1;
      const drinkInput = nameParts.join(' ');
      
      const matchedDrink = findMatchingDrink(drinkInput, availableDrinks);
      
      if (matchedDrink) {
        items.push({
          name: matchedDrink.name,
          quantity,
          modifiers: extractModifiers(drinkInput)
        });
      } else {
        console.log('No matching drink found for:', drinkInput);
      }
    }
  }

  if (items.length === 0) {
    console.log('No valid items found in command');
    return null;
  }

  console.log('Successfully parsed items:', items);
  return {
    type: 'order',
    items
  };
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
