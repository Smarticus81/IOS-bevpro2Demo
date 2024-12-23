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
function parseVoiceCommand(text: string): { items: Array<{ name: string; quantity: number; modifiers: string[] }> } | null {
  if (!text) {
    console.log('Empty text received in parseVoiceCommand');
    return null;
  }

  const textLower = text.toLowerCase().trim();
  console.log('Parsing voice command:', textLower);

  // Remove filler words and normalize input
  const cleanedText = textLower
    .replace(/can i get|i want|i would like|give me|please|and/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  console.log('Cleaned text:', cleanedText);

  // Extract quantities and drink names
  const items: Array<{ name: string; quantity: number; modifiers: string[] }> = [];

  // Match patterns like "3 diet coke" or "a vodka and coke"
  const matches = cleanedText.match(/(\d+|a|one|two|three|four|five)\s+([a-z\s]+?)(?=\s+\d+|$)/g);

  if (matches) {
    console.log('Found matches:', matches);

    for (const match of matches) {
      const [quantityStr, ...nameParts] = match.split(/\s+/);
      const quantity = parseInt(quantityStr) || 
                      { 'a': 1, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5 }[quantityStr] || 
                      1;
      const name = nameParts.join(' ');

      if (name) {
        items.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          quantity,
          modifiers: []
        });
      }
    }
  }

  console.log('Parsed items:', items);

  return items.length > 0 ? { items } : null;
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