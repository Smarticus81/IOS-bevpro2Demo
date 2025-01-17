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

  // Get default pour size for non-cocktail drinks
  const [defaultPourSize] = await db
    .select()
    .from(pourSizes)
    .where(eq(pourSizes.is_default, true))
    .limit(1);

  if (!defaultPourSize) {
    console.error("No default pour size found");
    return { totalTax: 0, pours: [] };
  }

  for (const item of items) {
    try {
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

      if (!drink) {
        console.error(`Drink not found for ID: ${item.drink_id}`);
        continue;
      }

      // For now, assume a default tax rate of 0 if no tax category is found
      const taxRate = taxCategory?.rate || 0;

      // Check if it's a cocktail
      if (drink.is_cocktail) {
        // Get recipe components
        const recipeComponents = await db
          .select({
            ingredient: drinks,
            recipe: cocktailRecipes,
            pourSize: pourSizes,
            taxCategory: taxCategories
          })
          .from(cocktailRecipes)
          .where(eq(cocktailRecipes.drink_id, drink.id))
          .leftJoin(drinks, eq(cocktailRecipes.ingredient_drink_id, drinks.id))
          .leftJoin(pourSizes, eq(cocktailRecipes.pour_size_id, pourSizes.id))
          .leftJoin(taxCategories, eq(drinks.tax_category_id, taxCategories.id));

        // Process each ingredient
        for (const component of recipeComponents) {
          if (!component.ingredient || !component.recipe || !component.pourSize) continue;

          const ingredientTaxRate = component.taxCategory?.rate || 0;
          const pourTax = (component.ingredient.price * component.recipe.quantity * ingredientTaxRate) / 100;

          totalTax += pourTax * item.quantity;

          pours.push({
            drink_id: component.ingredient.id,
            pour_size_id: component.pourSize.id,
            quantity: component.recipe.quantity * item.quantity,
            tax_amount: pourTax * item.quantity
          });
        }
      } else {
        // For regular drinks
        const pourTax = (drink.price * taxRate) / 100;
        totalTax += pourTax * item.quantity;

        pours.push({
          drink_id: drink.id,
          pour_size_id: defaultPourSize.id,
          quantity: item.quantity,
          tax_amount: pourTax * item.quantity
        });
      }
    } catch (error) {
      console.error(`Error processing item ${item.drink_id}:`, error);
      continue;
    }
  }

  return {
    totalTax: Math.round(totalTax * 100) / 100, // Round to 2 decimal places
    pours
  };
}

export async function recordPourTransactions(
  orderId: number,
  pours: PourTracking[]
) {
  try {
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
  } catch (error) {
    console.error("Error recording pour transactions:", error);
    throw error;
  }
}