import { getDb } from "@db";
import { drinks } from "@db/schema";
import drinksData from "../drinks.json";

async function seed() {
  try {
    console.log("Starting to seed drinks...");

    // Get database instance
    const db = await getDb();

    // Clear existing drinks
    await db.delete(drinks);

    // Insert drinks in smaller batches
    const batchSize = 20;
    for (let i = 0; i < drinksData.length; i += batchSize) {
      const batch = drinksData.slice(i, i + batchSize);
      await db.insert(drinks).values(batch.map(drink => ({
        name: drink.name,
        category: drink.category,
        subcategory: drink.subcategory,
        price: drink.price,
        inventory: drink.inventory,
        image: drink.image,
        sales: drink.sales || 0
      })));
      console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}`);
    }

    console.log("Successfully seeded drinks!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    console.error(error);
    process.exit(1);
  }
}

seed();