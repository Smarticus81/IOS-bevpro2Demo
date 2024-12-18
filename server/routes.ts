import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { drinks, orders, orderItems } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { setupRealtimeProxy } from "./realtime-proxy";
import OpenAI from "openai";

const getOpenAIClient = async () => {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OpenAI API key not configured");
  }
  return new OpenAI({ apiKey: openaiKey });
};

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  console.log('Setting up routes and realtime proxy...');
  setupRealtimeProxy(httpServer);

  // Get all drinks
  app.get("/api/drinks", async (_req, res) => {
    try {
      const allDrinks = await db.select().from(drinks);
      res.json(allDrinks);
    } catch (error) {
      console.error("Error fetching drinks:", error);
      res.status(500).json({ error: "Failed to fetch drinks" });
    }
  });

  // Create new order
  app.post("/api/orders", async (req, res) => {
    try {
      const { items, total } = req.body;
      
      // Create order
      const [order] = await db
        .insert(orders)
        .values({ total, items })
        .returning();

      // Create order items
      const orderItemsData = items.map((item: any) => ({
        order_id: order.id,
        drink_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      await db.insert(orderItems).values(orderItemsData);

      // Update inventory and sales
      for (const item of items) {
        await db
          .update(drinks)
          .set({ 
            inventory: sql`${drinks.inventory} - ${item.quantity}`,
            sales: sql`COALESCE(${drinks.sales}, 0) + ${item.quantity}`
          })
          .where(eq(drinks.id, item.id));
      }

      res.json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Get order by ID
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, parseInt(id)))
        .limit(1);

      if (!order.length) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json(order[0]);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Get API configuration
  app.get("/api/config", (_req, res) => {
    try {
      const openaiKey = process.env.OPENAI_API_KEY;
      
      // Detailed logging for debugging
      console.log({
        hasOpenAIKey: !!openaiKey,
        openAIKeyLength: openaiKey?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      if (!openaiKey) {
        throw new Error("OpenAI API key not found in environment");
      }
      
      if (!openaiKey.startsWith('sk-')) {
        throw new Error("Invalid OpenAI API key format");
      }
      
      res.json({ 
        openaiKey,
        voiceEnabled: true
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("API config error:", {
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

  // Voice synthesis endpoint
  // Voice configuration endpoints
  app.get("/api/settings/voice", (req, res) => {
    try {
      // Return current voice configuration
      res.json({
        success: true,
        config: {
          provider: process.env.VOICE_PROVIDER || 'elevenlabs',
          voiceEnabled: process.env.VOICE_ENABLED !== 'false',
          pitch: parseFloat(process.env.VOICE_PITCH || '1.0'),
          rate: parseFloat(process.env.VOICE_RATE || '1.0'),
          volume: parseFloat(process.env.VOICE_VOLUME || '1.0'),
          hasElevenLabs: !!process.env.ELEVEN_LABS_API_KEY
        }
      });
    } catch (error: any) {
      console.error('Error fetching voice settings:', error);
      res.status(500).json({ error: 'Failed to fetch voice settings' });
    }
  });

  // Voice settings endpoint
  app.post("/api/settings/voice", async (req, res) => {
    try {
      const { voiceEnabled, volume } = req.body;
      
      console.log('Voice settings update:', {
        voiceEnabled,
        volume,
        timestamp: new Date().toISOString()
      });

      // Store voice settings
      process.env.VOICE_ENABLED = String(voiceEnabled);
      process.env.VOICE_VOLUME = String(volume);

      // Return success response with current configuration
      res.json({
        success: true,
        config: {
          provider: 'openai',
          voiceEnabled,
          volume
        }
      });
    } catch (error: any) {
      console.error('Voice settings error:', {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      res.status(400).json({
        error: 'Failed to update voice settings',
        message: error.message
      });
    }
  });

  app.post("/api/synthesize", async (req, res) => {
    try {
      const { text } = req.body;
      
      console.log('Voice synthesis request:', {
        text: text?.substring(0, 50) + '...',
        timestamp: new Date().toISOString()
      });
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      try {
        console.log('Starting OpenAI Nova synthesis');
        const response = await openai_client.audio.speech.create({
          model: "tts-1",
          voice: "nova",
          input: text,
          response_format: "mp3"
        });
        
        if (!response || !response.content) {
          throw new Error('Empty response from OpenAI');
        }
        
        console.log('Sending audio response:', {
          contentLength: response.content.length,
          timestamp: new Date().toISOString()
        });
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', response.content.length);
        res.send(response.content);
        
        console.log('OpenAI Nova synthesis completed successfully');
      } catch (error: any) {
        console.error('OpenAI synthesis error:', {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred';
      console.error("Voice synthesis error:", {
        error: errorMessage,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({ 
        error: "Voice synthesis failed",
        message: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });

  return httpServer;
}