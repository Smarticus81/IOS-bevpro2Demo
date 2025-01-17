import { db } from "@db";
import { drinks, taxCategories } from "@db/schema";
import drinksData from "../drinks.json";

async function seed() {
  try {
    console.log("Starting to seed database...");

    // Define tax categories
    const taxCategoriesData = [
      {
        id: 1,
        name: "Standard Alcohol",
        rate: "0.08",
        description: "Standard tax rate for alcoholic beverages"
      },
      {
        id: 2,
        name: "Premium Spirits",
        rate: "0.10",
        description: "Higher tax rate for premium spirits"
      },
      {
        id: 3,
        name: "Non-Alcoholic",
        rate: "0.05",
        description: "Lower tax rate for non-alcoholic beverages"
      }
    ];

    console.log("Seeding tax categories...");
    // Insert tax categories
    for (const category of taxCategoriesData) {
      await db.insert(taxCategories).values({
        ...category,
        created_at: new Date()
      }).onConflictDoUpdate({
        target: taxCategories.id,
        set: {
          name: category.name,
          rate: category.rate,
          description: category.description,
          created_at: new Date()
        }
      });
    }
    console.log("Tax categories seeded successfully");

    // Map drink categories to tax category IDs
    const categoryTaxMap: { [key: string]: number } = {
      'Wine': 1, // Standard Alcohol
      'Beer': 1,
      'Spirits': 2, // Premium Spirits
      'Cocktails': 2,
      'Soft Drinks': 3, // Non-Alcoholic
      'Juices': 3,
      'Water': 3
    };

    console.log("Seeding drinks...");
    // Insert drinks in smaller batches
    const batchSize = 20;
    for (let i = 0; i < drinksData.length; i += batchSize) {
      const batch = drinksData.slice(i, i + batchSize);
      await db.insert(drinks).values(batch.map(drink => ({
        name: drink.name,
        category: drink.category,
        subcategory: drink.subcategory || null,
        price: drink.price,
        inventory: drink.inventory || 100,
        image: drink.image || null,
        sales: drink.sales || 0,
        tax_category_id: categoryTaxMap[drink.category] || 1, // Default to standard alcohol if category not found
        is_cocktail: drink.category === 'Cocktails' || false
      })));
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}`);
    }

    console.log("Successfully seeded database!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();