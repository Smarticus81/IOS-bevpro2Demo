import { type Intent } from "./openai";
import type { CartItem } from "@/types/speech";

interface ConversationContext {
  lastIntent?: Intent;
  lastQuery?: string;
  timestamp: number;
  topics: string[];
  relevantDrinks: string[];
  contextExpiry: number;
  currentOrder?: CartItem[];
}

export class ConversationState {
  private static instance: ConversationState;
  private context: ConversationContext;
  private readonly DEFAULT_EXPIRY = 300000; // 5 minutes

  private constructor() {
    this.context = this.createNewContext();
  }

  static getInstance(): ConversationState {
    if (!ConversationState.instance) {
      ConversationState.instance = new ConversationState();
    }
    return ConversationState.instance;
  }

  private createNewContext(): ConversationContext {
    return {
      timestamp: Date.now(),
      topics: [],
      relevantDrinks: [],
      contextExpiry: this.DEFAULT_EXPIRY,
      currentOrder: []
    };
  }

  public getCurrentOrder(): CartItem[] | undefined {
    return this.context.currentOrder;
  }

  public setCurrentOrder(order: CartItem[]) {
    this.context.currentOrder = [...order];
    this.context.timestamp = Date.now(); // Update timestamp when order changes
  }

  public updateContext(intent: Intent, query: string) {
    console.log('Updating conversation context:', {
      previousContext: this.context,
      newIntent: intent,
      query
    });

    // Update timestamp
    this.context.timestamp = Date.now();
    this.context.lastIntent = intent;
    this.context.lastQuery = query;

    // Extract and track topics from the query
    const topics = this.extractTopics(query);
    this.context.topics = [...new Set([...this.context.topics, ...topics])];

    // Track relevant drinks for drink-related queries
    if (intent.type === 'query' && intent.category) {
      this.context.relevantDrinks = [
        ...new Set([...this.context.relevantDrinks, intent.category])
      ];
    }

    console.log('Updated context:', this.context);
  }

  public getContext(): ConversationContext {
    // Check if context has expired
    if (this.hasContextExpired()) {
      console.log('Context expired, creating new context');
      this.context = this.createNewContext();
    }
    return this.context;
  }

  public clearContext() {
    console.log('Clearing conversation context');
    this.context = this.createNewContext();
  }

  private hasContextExpired(): boolean {
    const now = Date.now();
    return now - this.context.timestamp > this.context.contextExpiry;
  }

  private extractTopics(query: string): string[] {
    const topics = new Set<string>();

    // Extract drink categories from our defined schema
    const drinkCategories = [
      'signature', 'classics', 'beer', 'wine', 'spirits', 'non-alcoholic',
      'cocktails', 'lager', 'ale', 'cider', 'red', 'white', 'sparkling'
    ];

    drinkCategories.forEach(category => {
      if (query.toLowerCase().includes(category)) {
        topics.add(category);
      }
    });

    // Extract drink types
    const drinkTypes = [
      'vodka', 'gin', 'whiskey', 'bourbon', 'rum', 'tequila', 'cognac',
      'beer', 'wine', 'champagne', 'seltzer', 'soda', 'juice'
    ];

    drinkTypes.forEach(type => {
      if (query.toLowerCase().includes(type)) {
        topics.add(type);
      }
    });

    // Extract attributes
    const attributes = [
      'price', 'cost', 'alcohol content', 'ingredients', 'inventory',
      'stock', 'available', 'special', 'popular', 'recommendation'
    ];

    attributes.forEach(attr => {
      if (query.toLowerCase().includes(attr)) {
        topics.add(attr);
      }
    });

    return Array.from(topics); // Convert Set to Array
  }

  public getRelevantContext(): string {
    const context = this.getContext();

    if (!context.lastIntent) {
      return '';
    }

    // Build context string based on recent interactions
    const contextParts = [];

    if (context.topics.length > 0) {
      contextParts.push(`Recent topics: ${context.topics.join(', ')}`);
    }

    if (context.relevantDrinks.length > 0) {
      contextParts.push(`Discussed drinks: ${context.relevantDrinks.join(', ')}`);
    }

    if (context.lastQuery) {
      contextParts.push(`Last query: ${context.lastQuery}`);
    }

    if (context.currentOrder && context.currentOrder.length > 0) {
      const orderSummary = context.currentOrder
        .map(item => `${item.quantity}x ${item.drink.name}`)
        .join(', ');
      contextParts.push(`Current order: ${orderSummary}`);
    }

    return contextParts.join('. ');
  }
}

export const conversationState = ConversationState.getInstance();