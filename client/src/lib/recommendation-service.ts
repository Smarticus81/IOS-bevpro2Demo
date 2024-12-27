import { db } from "@db";
import type { Drink, CustomerPreference, OrderHistory } from "@db/schema";
import { drinks, customerPreferences, orderHistory } from "@db/schema";
import { eq, desc, and, or, gt } from "drizzle-orm";

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

  private async getCustomerPreferences(sessionId: string): Promise<CustomerPreference | null> {
    const [preferences] = await db
      .select()
      .from(customerPreferences)
      .where(eq(customerPreferences.session_id, sessionId))
      .limit(1);

    return preferences || null;
  }

  private async updateCustomerPreferences(
    sessionId: string,
    order: Array<{ drink: Drink; quantity: number }>
  ): Promise<void> {
    const existingPrefs = await this.getCustomerPreferences(sessionId);
    const drinkIds = order.map(item => item.drink.id);

    if (existingPrefs) {
      await db
        .update(customerPreferences)
        .set({
          last_orders: drinkIds,
          updated_at: new Date()
        })
        .where(eq(customerPreferences.session_id, sessionId));
    } else {
      await db.insert(customerPreferences).values({
        session_id: sessionId,
        last_orders: drinkIds,
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  public async getRecommendations(
    context: RecommendationContext
  ): Promise<RecommendationResult[]> {
    const timeOfDay = context.timeOfDay || this.getTimeOfDay();
    const preferences = await this.getCustomerPreferences(context.sessionId);

    // Get current order categories if any
    const currentCategories = new Set(
      context.currentOrder?.map(item => item.drink.category) || []
    );

    // Query drinks with recommendations scoring
    const recommendedDrinks = await db
      .select()
      .from(drinks)
      .where(
        and(
          // Ensure sufficient inventory
          gt(drinks.inventory, 0),
          // Match time-appropriate categories
          or(...(this.timeBasedCategories[timeOfDay] || []).map(category => 
            eq(drinks.category, category)
          ))
        )
      )
      .orderBy(desc(drinks.recommendation_score))
      .limit(3);

    return recommendedDrinks.map(drink => {
      let confidence = 0.5; // Base confidence
      let reasons: string[] = [];

      // Increase confidence based on various factors
      if (preferences?.favorite_categories?.includes(drink.category)) {
        confidence += 0.2;
        reasons.push("Based on your preferences");
      }

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
    const context = {
      time_of_day: this.getTimeOfDay(),
      day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
      weather: "unknown", // Could be enhanced with weather API integration
      special_occasion: false
    };

    await db.insert(orderHistory).values({
      session_id: sessionId,
      items: order,
      total,
      context,
      order_time: new Date()
    });

    await this.updateCustomerPreferences(sessionId, order);
  }
}

export const recommendationService = RecommendationService.getInstance();