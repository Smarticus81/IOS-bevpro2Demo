import type { Drink } from "@/types/models";

// Mock data for drinks (matches the data in server/routes.ts)
const mockDrinks: Drink[] = [
  {
    id: 1,
    name: "Espresso",
    price: 3.99,
    category: "Coffee",
    subcategory: "Hot",
    image: "/drinks/espresso.png",
    inventory: 100,
    sales: 0
  },
  {
    id: 2,
    name: "Latte",
    price: 4.99,
    category: "Coffee",
    subcategory: "Hot",
    image: "/drinks/latte.png",
    inventory: 100,
    sales: 0
  },
  {
    id: 3,
    name: "Iced Tea",
    price: 3.49,
    category: "Tea",
    subcategory: "Cold",
    image: "/drinks/iced-tea.png",
    inventory: 100,
    sales: 0
  }
];

export interface RecommendationContext {
  timeOfDay: string;
  dayOfWeek: string;
  weather?: string;
  currentOrder?: Array<{ drink: Drink; quantity: number }>;
  sessionId: string;
}

export interface RecommendationResult {
  drink: Drink;
  confidence: number;
  reason: string;
}

export class RecommendationService {
  private static instance: RecommendationService;
  private readonly timeBasedCategories: Record<string, string[]> = {
    morning: ["Coffee", "Tea", "Juice"],
    afternoon: ["Soda", "Iced Tea", "Cocktails"],
    evening: ["Cocktails", "Wine", "Beer"],
    night: ["Spirits", "Cocktails", "Beer"]
  };

  private constructor() {}

  public static getInstance(): RecommendationService {
    if (!RecommendationService.instance) {
      RecommendationService.instance = new RecommendationService();
    }
    return RecommendationService.instance;
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 21) return "evening";
    return "night";
  }

  public async getRecommendations(
    context: RecommendationContext
  ): Promise<RecommendationResult[]> {
    const timeOfDay = context.timeOfDay || this.getTimeOfDay();

    // Get current order categories if any
    const currentCategories = new Set(
      context.currentOrder?.map(item => item.drink.category) || []
    );

    // Filter drinks based on time and inventory
    const recommendedDrinks = mockDrinks
      .filter(drink => 
        drink.inventory > 0 && 
        this.timeBasedCategories[timeOfDay].includes(drink.category)
      )
      .sort((a, b) => (b.sales || 0) - (a.sales || 0))
      .slice(0, 3);

    return recommendedDrinks.map(drink => {
      let confidence = 0.5; // Base confidence
      let reasons: string[] = [];

      if (!currentCategories.has(drink.category)) {
        confidence += 0.1;
        reasons.push("Complements your current order");
      }

      const timeCategories = this.timeBasedCategories[timeOfDay] || [];
      if (timeCategories.includes(drink.category)) {
        confidence += 0.1;
        reasons.push(`Perfect for ${timeOfDay}`);
      }

      return {
        drink,
        confidence: Math.min(confidence, 1),
        reason: reasons.join(". ")
      };
    });
  }

  public async generateRecommendationResponse(
    recommendations: RecommendationResult[]
  ): Promise<string> {
    if (recommendations.length === 0) {
      return "I don't have any specific recommendations at the moment.";
    }

    const topRecommendation = recommendations[0];
    let response = `I'd recommend the ${topRecommendation.drink.name}. ${topRecommendation.reason}`;

    if (recommendations.length > 1) {
      response += ` You might also enjoy the ${recommendations[1].drink.name}.`;
    }

    return response;
  }

  public async recordOrderContext(
    sessionId: string,
    order: Array<{ drink: Drink; quantity: number }>,
    total: number
  ): Promise<void> {
    // In demo mode, just log the order
    console.log('Order recorded:', {
      sessionId,
      items: order.map(item => ({
        name: item.drink.name,
        quantity: item.quantity
      })),
      total,
      timestamp: new Date().toISOString()
    });
  }
}

export const recommendationService = RecommendationService.getInstance();