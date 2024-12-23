type ParsedCommand = {
  type: 'order' | 'inquiry' | 'modify' | 'cancel';
  items?: Array<{
    name: string;
    quantity: number;
    modifiers?: string[];
  }>;
  action?: string;
};

// Efficient command parser that doesn't rely on external APIs
export function parseVoiceCommand(text: string): ParsedCommand {
  const normalizedText = text.toLowerCase().trim();
  
  // Common drink quantity words to numbers
  const quantityWords: Record<string, number> = {
    'a': 1, 'an': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };
  
  // Extract quantities and items
  const items: ParsedCommand['items'] = [];
  let remainingText = normalizedText;
  
  // Match patterns like "3 diet cokes" or "a vodka and coke"
  const itemPattern = /(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+([a-z\s]+?)(?=\s+and|\s*$)/g;
  let match;
  
  while ((match = itemPattern.exec(normalizedText)) !== null) {
    const [_, quantityStr, itemName] = match;
    const quantity = quantityWords[quantityStr] || parseInt(quantityStr);
    
    if (!isNaN(quantity)) {
      items.push({
        name: itemName.trim(),
        quantity,
        modifiers: extractModifiers(itemName)
      });
    }
  }
  
  // If no structured items found, try to extract from free text
  if (items.length === 0) {
    const words = normalizedText.split(/\s+/);
    let currentQuantity = 1;
    let currentItem = '';
    
    words.forEach((word, index) => {
      if (quantityWords[word] || !isNaN(parseInt(word))) {
        if (currentItem) {
          items.push({ name: currentItem.trim(), quantity: currentQuantity });
        }
        currentQuantity = quantityWords[word] || parseInt(word);
        currentItem = '';
      } else {
        currentItem += ' ' + word;
      }
      
      if (index === words.length - 1 && currentItem) {
        items.push({ name: currentItem.trim(), quantity: currentQuantity });
      }
    });
  }
  
  // Determine command type
  const type = determineCommandType(normalizedText);
  
  return { type, items };
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
