
import { logger } from "@/lib/logger";
import { parseVoiceCommand } from "./command-parser";
import type { DrinkItem } from "@/types/speech";

export type CommandHandler = {
  pattern: RegExp;
  handler: (text: string) => Promise<void>;
  priority?: number;
};

export class VoiceCommandHandler {
  private handlers: Map<string, CommandHandler> = new Map();
  private drinks: DrinkItem[] = [];

  constructor(drinks: DrinkItem[]) {
    this.drinks = drinks;
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers() {
    this.registerHandler('navigation', {
      pattern: /(?:go|navigate|show|open)\s+(?:to|me)?\s*(home|menu|cart|settings|inventory)/i,
      handler: async (text) => {
        const destination = text.match(this.handlers.get('navigation')!.pattern)?.[1];
        if (destination) {
          window.location.hash = `#/${destination.toLowerCase()}`;
        }
      },
      priority: 1
    });
  }

  registerHandler(name: string, handler: CommandHandler) {
    this.handlers.set(name, {
      ...handler,
      priority: handler.priority || 0
    });
  }

  async processCommand(text: string): Promise<void> {
    logger.info('Processing voice command:', { text });

    // Sort handlers by priority
    const sortedHandlers = Array.from(this.handlers.entries())
      .sort(([, a], [, b]) => (b.priority || 0) - (a.priority || 0));

    // Try matching command patterns
    for (const [name, handler] of sortedHandlers) {
      if (handler.pattern.test(text)) {
        logger.info(`Matched ${name} command pattern`);
        await handler.handler(text);
        return;
      }
    }

    // Fall back to drink order parsing
    const parsedCommand = parseVoiceCommand(text, this.drinks);
    if (parsedCommand) {
      logger.info('Parsed as drink order:', parsedCommand);
      // Handle the parsed command...
    }
  }
}
