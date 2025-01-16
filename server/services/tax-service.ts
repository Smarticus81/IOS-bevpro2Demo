import { db } from "@db";
import { drinks, pourTransactions, taxCategories, pourSizes, cocktailRecipes } from "@db/schema";
import { eq } from "drizzle-orm";

interface PourTracking {
  drink_id: number;
  pour_size_id: number;
  quantity: number;
  tax_amount: number;
}

export async function calculateOrderTaxAndPours(items: Array<{
  drink_id: number;
  quantity: number;
}>) {
  let totalTax = 0;
  const pours: PourTracking[] = [];

  for (const item of items) {
    // Get drink details including tax category
    const result = await db
      .select({
        drink: drinks,
        taxCategory: taxCategories
      })
      .from(drinks)
      .where(eq(drinks.id, item.drink_id))
      .leftJoin(taxCategories, eq(drinks.tax_category_id, taxCategories.id));

    const drink = result[0]?.drink;
    const taxCategory = result[0]?.taxCategory;

    if (!drink) continue;

    if (drink.is_cocktail) {
      // For cocktails, get recipe and calculate tax based on liquor components
      const recipeResult = await db
        .select({
          recipe: cocktailRecipes,
          pourSize: pourSizes
        })
        .from(cocktailRecipes)
        .where(eq(cocktailRecipes.drink_id, drink.id))
        .leftJoin(pourSizes, eq(cocktailRecipes.pour_size_id, pourSizes.id));

      for (const { recipe, pourSize } of recipeResult) {
        const ingredientResult = await db
          .select({
            drink: drinks,
            taxCategory: taxCategories
          })
          .from(drinks)
          .where(eq(drinks.id, recipe.ingredient_drink_id))
          .leftJoin(taxCategories, eq(drinks.tax_category_id, taxCategories.id));

        const ingredientDrink = ingredientResult[0]?.drink;
        const ingredientTaxCategory = ingredientResult[0]?.taxCategory;

        if (!ingredientDrink || !ingredientTaxCategory || !pourSize) continue;

        const pourTax = (ingredientDrink.price * recipe.quantity * ingredientTaxCategory.rate) / 100;
        totalTax += pourTax * item.quantity;

        pours.push({
          drink_id: recipe.ingredient_drink_id,
          pour_size_id: recipe.pour_size_id,
          quantity: recipe.quantity * item.quantity,
          tax_amount: pourTax * item.quantity
        });
      }
    } else {
      // For straight liquor, calculate tax directly
      if (!taxCategory) continue;

      const defaultPourSizeResult = await db
        .select()
        .from(pourSizes)
        .where(eq(pourSizes.is_default, true));

      const defaultPourSize = defaultPourSizeResult[0];
      if (!defaultPourSize) continue;

      const pourTax = (drink.price * taxCategory.rate) / 100;
      totalTax += pourTax * item.quantity;

      pours.push({
        drink_id: drink.id,
        pour_size_id: defaultPourSize.id,
        quantity: item.quantity,
        tax_amount: pourTax * item.quantity
      });
    }
  }

  return {
    totalTax: Math.round(totalTax), // Round to nearest cent
    pours
  };
}

export async function recordPourTransactions(
  orderId: number,
  pours: PourTracking[]
) {
  // Record all pours for tax tracking
  const pourRecords = pours.map(pour => ({
    order_id: orderId,
    pour_inventory_id: pour.drink_id,
    pour_size_id: pour.pour_size_id,
    volume_ml: pour.quantity.toString(), // Convert to string for decimal column
    tax_amount: pour.tax_amount.toString(), // Convert to string for decimal column
    transaction_time: new Date(),
  }));

  await db.insert(pourTransactions).values(pourRecords);
}