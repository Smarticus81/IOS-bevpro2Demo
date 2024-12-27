import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import type { Drink } from "../client/src/types/models";

// OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mock drinks data for demo
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

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  console.log('Setting up routes...');

  // Get all drinks (using mock data)
  app.get("/api/drinks", (_req, res) => {
    try {
      console.log('Serving drinks:', mockDrinks.length);
      res.json(mockDrinks);
    } catch (error) {
      console.error("Error fetching drinks:", error);
      res.status(500).json({ error: "Failed to fetch drinks" });
    }
  });

  // Process voice commands
  app.post("/api/voice-command", async (req, res) => {
    try {
      const { text, sessionId } = req.body;

      if (!text) {
        return res.status(400).json({ error: "No text provided" });
      }

      console.log('Processing voice command:', { text, sessionId });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an intelligent AI bartender. Process voice commands for drink orders.
            Available drinks: ${mockDrinks.map(d => d.name).join(', ')}.
            Format response as JSON with fields: type (order/query/greeting), items (array of {name, quantity}), 
            sentiment (positive/negative/neutral), conversational_response (string)`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content);
      console.log('Voice command processed:', result);
      res.json(result);
    } catch (error) {
      console.error("Error processing voice command:", error);
      res.status(500).json({ 
        error: "Failed to process voice command",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Simple payment simulation (no database required)
  app.post("/api/payment/process", async (req, res) => {
    try {
      const { amount, orderId } = req.body;
      console.log('Processing payment:', { amount, orderId });
      const success = Math.random() > 0.1; // 90% success rate

      if (success) {
        const response = { 
          success: true,
          message: `Payment of $${(amount / 100).toFixed(2)} processed successfully` 
        };
        console.log('Payment successful:', response);
        res.json(response);
      } else {
        throw new Error('Payment simulation failed');
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Payment processing failed" 
      });
    }
  });

  // Get OpenAI API configuration
  app.get("/api/config", (_req, res) => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;

      // Detailed logging for debugging
      console.log({
        hasKey: !!openaiKey,
        keyLength: openaiKey?.length || 0,
        timestamp: new Date().toISOString()
      });

      if (!openaiKey) {
        throw new Error("OpenAI API key not found in environment");
      }

      if (!openaiKey.startsWith('sk-')) {
        throw new Error("Invalid OpenAI API key format");
      }

      res.json({ openaiKey });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("OpenAI config error:", {
        message: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        error: "Configuration error",
        message: err.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  return httpServer;
}