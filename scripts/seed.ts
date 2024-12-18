import { db } from "../db";
import { drinks } from "../db/schema";
import drinksData from "../drinks.json";

async function seed() {
  try {
    console.log("Starting to seed drinks...");
    
    // Insert drinks in smaller batches to avoid memory issues
    const batchSize = 50;
    for (let i = 0; i < drinksData.length; i += batchSize) {
      const batch = drinksData.slice(i, i + batchSize);
      await db.insert(drinks).values(batch);
      console.log(`Inserted batch ${i/batchSize + 1}`);
    }
    
    console.log("Successfully seeded drinks!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();
