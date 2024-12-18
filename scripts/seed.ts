import { drizzle } from "drizzle-orm/neon-serverless";
import { drinks } from "../db/schema";
import drinksData from "../drinks.json";
import ws from "ws";

const db = drizzle({
  connection: process.env.DATABASE_URL!,
  schema: { drinks },
  ws: ws,
});

async function seed() {
  try {
    console.log("Starting to seed drinks...");
    
    // Insert all drinks
    await db.insert(drinks).values(drinksData);
    
    console.log("Successfully seeded drinks!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

seed();
